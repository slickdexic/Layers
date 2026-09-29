<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotLifecycleHooks;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Title\Title;
use MediaWiki\User\User;
use MediaWikiIntegrationTestCase;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Page-owned drawings belong to the PageID: they follow native moves and come back only onto their own page.
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedPilotLifecycleHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedScope
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @group Database
 */
class PageOwnedPilotLifecycleTest extends MediaWikiIntegrationTestCase {
	private ?array $registered = null;

	private function actor(): User {
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'move', 'delete', 'undelete',
			'createpage', 'createtalk' ] );
		return $actor;
	}

	/**
	 * A new page at $title whose text binds the fixture slide it owns.
	 * @param Title $title
	 * @return array [ page ID, drawing revision ID, binding, main text ]
	 */
	private function owner( Title $title ): array {
		$this->registered ??= TestingAdmissionRegistration::install( $this );
		$this->editPage( $title, 'Draft' );
		$pageId = $title->getArticleID( IDBAccessObject::READ_LATEST );
		$base = $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $title, 0, IDBAccessObject::READ_LATEST )->getId();
		$binding = 'v1:' . $pageId . ':presentation';
		$text = '{{#Slide:Demo|layersbinding=' . $binding . '}}';
		$revisionId = $this->registered['publisher']->publish( $title, $this->actor(), $base, $this->document(),
			'Drawing', new WikitextContent( $text ), $pageId );
		return [ $pageId, $revisionId, $binding, $text ];
	}

	private function document(): string {
		return file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
	}

	private function guardRestore( Title $enrolled ): void {
		$this->setTemporaryHook( 'PageUndelete', new PageOwnedPilotLifecycleHooks(
			PageOwnedScope::newFromServices( $this->getServiceContainer(), [ $enrolled->getPrefixedDBkey() ] )
		), true );
	}

	private function delete( Title $title ): void {
		$s = $this->getServiceContainer();
		$status = $s->getDeletePageFactory()->newDeletePage( $s->getWikiPageFactory()->newFromTitle( $title ),
			$this->actor() )->deleteUnsafe( 'Lifecycle test' );
		$this->assertStatusGood( $status );
		$this->runDeferredUpdates();
	}

	private function restore( Title $title, array $timestamps = [] ): \StatusValue {
		$s = $this->getServiceContainer();
		$restore = $s->getUndeletePageFactory()->newUndeletePage( $s->getWikiPageFactory()->newFromTitle( $title ),
			$this->actor() );
		if ( $timestamps ) {
			$restore->setUndeleteOnlyTimestamps( $timestamps );
		}
		return $restore->undeleteIfAllowed( 'Restore lifecycle test' );
	}

	private function archived( int $revisionId ): bool {
		return $this->getDb()->newSelectQueryBuilder()->select( 'ar_rev_id' )->from( 'archive' )
			->where( [ 'ar_rev_id' => $revisionId ] )->caller( __METHOD__ )->fetchField() !== false;
	}

	public function testMovedOwnerKeepsItsDrawingsAndTheOldTitleCannotClaimThem(): void {
		$old = $this->getNonexistingTestPage()->getTitle();
		$new = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersSlidesEnable' => true, 'LayersPageDrawingNamespaces' => [] ] );
		$s = $this->getServiceContainer();
		[ $pageId, , $binding, $text ] = $this->owner( $old );
		$actor = $this->actor();
		$this->assertStatusGood( $s->getMovePageFactory()->newMovePage( $old, $new )
			->moveIfAllowed( $actor, 'Rename the owner' ) );
		$moved = $s->getRevisionLookup()->getRevisionByTitle( $new, 0, IDBAccessObject::READ_LATEST );
		$this->assertSame( $pageId, $moved->getPageId() );
		$this->assertTrue( $moved->hasSlot( PageRevisionWriter::SLOT ) );

		$pilot = $s->getService( 'LayersPageOwnedPilot' );
		$scope = $pilot->getScope();
		$this->assertFalse( $scope->isEnrolled( $new ) );
		$this->assertTrue( $scope->includes( $new ) );
		$parsed = $s->getParserFactory()->create()->parse( $text, $new, ParserOptions::newFromAnon(), true, true,
			$moved->getId() );
		$this->assertSame( $moved->getId(),
			$parsed->getExtensionData( BoundSlideHooks::DATA_KEY )[$binding]['revisionId'] );
		$this->assertSame( 'presentation',
			$pilot->prepareBoundViewers( $new, $moved->getId(), [ $binding ], $actor )[$binding]['surface']['id'] );
		$editor = $pilot->prepareCurrentEditor( $new->getPrefixedText(), 'presentation', $actor );
		$this->assertSame( [ $new->getPrefixedDBkey(), $pageId ],
			[ $editor['pageOwned']['owner'], $editor['pageOwned']['pageId'] ] );
		$changed = json_decode( $this->document() );
		$changed->surfaces[0]->layers[0]->text = 'Edited after the move';
		$next = $this->registered['publisher']->publish( $new, $actor, $moved->getId(), json_encode( $changed ),
			'After the move', null, $pageId );
		$this->assertGreaterThan( $moved->getId(), $next );

		// The redirect left at the enrolled title is another page and owns nothing.
		$redirect = $s->getRevisionLookup()->getRevisionByTitle( $old, 0, IDBAccessObject::READ_LATEST );
		$this->assertNotSame( $pageId, $redirect->getPageId() );
		$this->assertFalse( $scope->ownsDrawings( $old ) );
		$claimed = $s->getParserFactory()->create()->parse( $text, $old, ParserOptions::newFromAnon(), true, true,
			$redirect->getId() );
		$this->assertNull( $claimed->getExtensionData( BoundSlideHooks::DATA_KEY ) );
		$this->assertStringNotContainsString( 'layers-bound-slide', $claimed->getRawText() );
		$this->assertSame( [], $pilot->prepareBoundViewers( $old, $redirect->getId(), [ $binding ], $actor ) );
		// A session opened before the move cannot save onto the page now at the old title.
		try {
			$this->registered['publisher']->publish( $old, $actor, $moved->getParentId(), $this->document(),
				'Stale session', new WikitextContent( $text ), $pageId );
			$this->fail( 'A stale session saved onto the old title' );
		} catch ( PublicationException $e ) {
			$this->assertSame( $redirect->getId(), $old->getLatestRevID( IDBAccessObject::READ_LATEST ) );
		}
	}

	public function testOrdinaryPagesMoveOntoAndOffEnrolledTitles(): void {
		$page = $this->getExistingTestPage();
		$enrolled = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null ] );
		$s = $this->getServiceContainer();
		$this->assertStatusGood( $s->getMovePageFactory()->newMovePage( $page->getTitle(), $enrolled )
			->moveIfAllowed( $this->actor(), 'Onto an enrolled title' ) );
		$this->assertSame( $page->getId(), $enrolled->getArticleID( IDBAccessObject::READ_LATEST ) );
		$this->assertTrue( $s->getService( 'LayersPageOwnedPilot' )->getScope()->includes( $enrolled ) );
		$this->assertStatusGood( $s->getMovePageFactory()->newMovePage( $enrolled,
			$this->getNonexistingTestPage()->getTitle() )->moveIfAllowed( $this->actor(), 'Off it again' ) );
	}

	/**
	 * @dataProvider provideExactRestores
	 * @param bool $partial
	 */
	public function testDeletedOwnerIsRestoredOntoItsOwnPage( bool $partial ): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		[ $pageId, $revisionId ] = $this->owner( $title );
		$timestamp = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId )->getTimestamp();
		$this->guardRestore( $title );
		$this->delete( $title );
		$this->assertStatusGood( $this->restore( $title, $partial ? [ $timestamp ] : [] ) );
		$current = $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $title, 0, IDBAccessObject::READ_LATEST );
		$this->assertSame( [ $pageId, $revisionId ], [ $current->getPageId(), $current->getId() ] );
		$this->assertTrue( $current->hasSlot( PageRevisionWriter::SLOT ) );
	}

	/** @return array */
	public static function provideExactRestores(): array {
		return [ 'all' => [ false ], 'selected' => [ true ] ];
	}

	public function testDrawingsAreNotRestoredOntoAPageRecreatedAtTheirTitle(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		[ , $revisionId ] = $this->owner( $title );
		$this->guardRestore( $title );
		$this->delete( $title );
		$this->editPage( $title, 'A different page' );
		$replacement = $title->getLatestRevID( IDBAccessObject::READ_LATEST );
		$status = $this->restore( $title );
		$this->assertStatusError( 'layers-restore-drawings-denied', $status );
		$this->assertTrue( $this->archived( $revisionId ) );
		$this->assertSame( $replacement, $title->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}

	public function testDrawingsFromTwoDeletedPagesAreRestoredOnlyOneDeletionAtATime(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		[ $pageId, $revisionId ] = $this->owner( $title );
		$this->guardRestore( $title );
		$this->delete( $title );
		$this->editPage( $title, 'A different page, later deleted too' );
		$this->delete( $title );
		$this->assertStatusError( 'layers-restore-drawings-denied', $this->restore( $title ) );
		$this->assertTrue( $this->archived( $revisionId ) );
		// Distinct timestamps select exactly the owner's own revisions.
		$db = $this->getDb();
		$ownRevisions = $db->newSelectQueryBuilder()->select( 'ar_rev_id' )->from( 'archive' )
			->where( [ 'ar_page_id' => $pageId ] )->orderBy( 'ar_rev_id' )->caller( __METHOD__ )->fetchFieldValues();
		foreach ( $ownRevisions as $index => $id ) {
			$db->newUpdateQueryBuilder()->update( 'archive' )
				->set( [ 'ar_timestamp' => $db->timestamp( '2020010100000' . $index ) ] )
				->where( [ 'ar_rev_id' => (int)$id ] )->caller( __METHOD__ )->execute();
		}
		$this->assertStatusGood( $this->restore( $title, [ '20200101000000', '20200101000001' ] ) );
		$current = $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $title, 0, IDBAccessObject::READ_LATEST );
		$this->assertSame( [ $pageId, $revisionId ], [ $current->getPageId(), $current->getId() ] );
	}

	public function testRevisionsAreNotRestoredOntoAPageThatOwnsDrawings(): void {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->editPage( $title, 'An earlier page at this title' );
		$earlier = $title->getLatestRevID( IDBAccessObject::READ_LATEST );
		$this->registered ??= TestingAdmissionRegistration::install( $this );
		$this->delete( $title );
		[ , $revisionId ] = $this->owner( $title );
		$this->guardRestore( $title );
		$this->assertStatusError( 'layers-restore-drawings-denied', $this->restore( $title ) );
		$this->assertTrue( $this->archived( $earlier ) );
		$this->assertSame( $revisionId, $title->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}

	public function testOrdinaryPagesRestoreAsUsual(): void {
		$page = $this->getExistingTestPage();
		$title = $page->getTitle();
		$revisionId = $page->getLatest();
		$this->owner( $this->getNonexistingTestPage()->getTitle() );
		$this->guardRestore( $title );
		$this->delete( $title );
		$this->assertStatusGood( $this->restore( $title ) );
		$this->assertSame( $revisionId, $title->getLatestRevID( IDBAccessObject::READ_LATEST ) );
	}
}
