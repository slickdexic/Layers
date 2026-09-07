<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageHistoryAccess
 * @group Database
 */
class PageHistoryAccessTest extends \MediaWikiIntegrationTestCase {
	protected function setUp(): void {
		parent::setUp();
		$this->getServiceContainer()->getContentHandlerFactory()->defineContentHandler(
			LayersDocumentContent::MODEL, LayersDocumentContentHandler::class );
		$this->getServiceContainer()->getSlotRoleRegistry()->defineRoleWithModel(
			PageRevisionWriter::SLOT, LayersDocumentContent::MODEL, [ 'display' => 'none' ], false );
	}

	private function access(): PageHistoryAccess {
		return new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() );
	}

	private function snapshot(): LayersDocumentContent {
		return new LayersDocumentContent( '{"schemaVersion":1,"surfaces":[]}' );
	}

	/**
	 * @dataProvider provideEditPermissions
	 * @param string|null $missing
	 * @param bool $newPage
	 * @param int $namespace
	 */
	public function testEditRequiresOwnerAndLayersAuthority( ?string $missing, bool $newPage, int $namespace ): void {
		$user = $this->getTestUser()->getUser();
		$this->overrideConfigValue( 'GroupPermissions', [ '*' => [ 'read' => false ] ] );
		$rights = [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ];
		$this->overrideUserPermissions( $user, array_values( array_diff( $rights, [ $missing ] ) ) );
		$page = $newPage ? $this->getNonexistingTestPage( Title::makeTitle( $namespace, __METHOD__ ) ) :
			$this->getExistingTestPage();
		if ( $missing !== null ) {
			$this->expectException( \DomainException::class );
			$this->expectExceptionMessage( 'layers-owner-edit-denied' );
		}
		$this->access()->assertCanEdit( $page->getTitle(), $user );
		$this->addToAssertionCount( 1 );
	}

	/** @return array */
	public static function provideEditPermissions(): array {
		return [
			'allowed-existing' => [ null, false, NS_MAIN ],
			'allowed-new' => [ null, true, NS_MAIN ],
			'allowed-talk' => [ null, true, NS_TALK ],
			'no-read' => [ 'read', false, NS_MAIN ],
			'no-edit' => [ 'edit', false, NS_MAIN ],
			'no-layers' => [ 'editlayers', false, NS_MAIN ],
			'no-create' => [ 'createpage', true, NS_MAIN ],
			'no-create-talk' => [ 'createtalk', true, NS_TALK ]
		];
	}

	public function testDeniedReadNeverLooksUpRevision(): void {
		$lookup = $this->createMock( RevisionLookup::class );
		$lookup->expects( $this->never() )->method( 'getRevisionById' );
		$authority = $this->createMock( Authority::class );
		$authority->method( 'authorizeRead' )->willReturn( false );
		$this->expectException( \DomainException::class );
		( new PageHistoryAccess( $lookup ) )->read( $this->getExistingTestPage()->getTitle(), 1, $authority );
	}

	public function testReadReturnsExactOldSnapshot(): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$writer = new PageRevisionWriter();
		$first = $writer->save( $page->newPageUpdater( $user ), $page->getLatest(), $this->snapshot(),
			CommentStoreComment::newUnsavedComment( 'Initial snapshot' ) );
		$later = new LayersDocumentContent( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ) );
		$writer->save( $page->newPageUpdater( $user ), $first->getId(), $later,
			CommentStoreComment::newUnsavedComment( 'Later snapshot' ) );
		$this->assertSame( $this->snapshot()->getText(),
			$this->access()->read( $page->getTitle(), $first->getId(), $user )->getText() );
	}

	/**
	 * @dataProvider provideUnavailableRevision
	 * @param string $reason
	 */
	public function testUnavailableRevisionNeverFallsBack( string $reason ): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers' ] );
		$beforeLayers = $page->getLatest();
		$revision = ( new PageRevisionWriter() )->save(
			$page->newPageUpdater( $user ), $beforeLayers, $this->snapshot(),
			CommentStoreComment::newUnsavedComment( 'Snapshot' ) );
		$id = $revision->getId();
		$owner = $page->getTitle();
		if ( $reason === 'other-owner' ) {
			$owner = $this->getExistingTestPage( 'Other owner' )->getTitle();
		} elseif ( $reason === 'no-slot' ) {
			$id = $beforeLayers;
		} elseif ( $reason === 'missing' ) {
			$id = 2147483647;
		} elseif ( $reason === 'zero' ) {
			$id = 0;
		} elseif ( $reason === 'deleted-owner' ) {
			$owner = $this->getNonexistingTestPage()->getTitle();
		} else {
			if ( $reason !== 'inconsistent-current' ) {
				( new PageRevisionWriter() )->save( $page->newPageUpdater( $user ), $id, $this->snapshot(),
					CommentStoreComment::newUnsavedComment( 'Advance current revision' ),
					new \MediaWiki\Content\WikitextContent( 'Later page text' ) );
			}
			$visibility = RevisionRecord::DELETED_TEXT;
			if ( $reason === 'suppressed' ) {
				$visibility |= RevisionRecord::DELETED_RESTRICTED;
			}
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
				->set( [ 'rev_deleted' => $visibility ] )->where( [ 'rev_id' => $id ] )
				->caller( __METHOD__ )->execute();
			$this->assertSame( $visibility, $this->getServiceContainer()->getRevisionLookup()
				->getRevisionById( $id, \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST )->getVisibility() );
			$this->assertFalse( $user->isAllowed( 'deletedtext' ) );
			$this->assertFalse( $user->authorizeRead( 'deletedtext', $owner ) );
		}
		$this->expectException( \DomainException::class );
		$this->expectExceptionMessage( 'layers-revision-unavailable' );
		$this->access()->read( $owner, $id, $user );
	}

	/** @return array */
	public static function provideUnavailableRevision(): array {
		return array_map( static function ( $reason ) {
			return [ $reason ];
		}, [ 'other-owner', 'no-slot', 'missing', 'zero', 'deleted-owner',
			'hidden', 'suppressed', 'inconsistent-current' ] );
	}

	public function testProtectedOwnerRejectsOtherwiseAuthorizedEditor(): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers' ] );
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_restrictions' )->row( [
			'pr_page' => $page->getId(), 'pr_type' => 'edit', 'pr_level' => 'sysop',
			'pr_cascade' => 0, 'pr_expiry' => 'infinity'
		] )->caller( __METHOD__ )->execute();
		$this->getServiceContainer()->getRestrictionStore()->flushRestrictions( $page->getTitle() );
		$this->expectException( \DomainException::class );
		$this->access()->assertCanEdit( $page->getTitle(), $user );
	}

	public function testBlockedEditorCannotPublish(): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers' ] );
		$this->getServiceContainer()->getDatabaseBlockStore()->insertBlockWithParams( [
			'target' => new \MediaWiki\Block\UserBlockTarget( $user ), 'by' => $this->getTestSysop()->getUser(),
			'reason' => 'Access regression test', 'expiry' => 'infinity', 'enableAutoblock' => false
		] );
		$this->expectException( \DomainException::class );
		$this->access()->assertCanEdit( $page->getTitle(), $user );
	}

	public function testAuthorizedReviewerCanReadHiddenHistoricalContent(): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers', 'deletedtext' ] );
		$writer = new PageRevisionWriter();
		$first = $writer->save( $page->newPageUpdater( $user ), $page->getLatest(), $this->snapshot(),
			CommentStoreComment::newUnsavedComment( 'Initial' ) );
		$writer->save( $page->newPageUpdater( $user ), $first->getId(), $this->snapshot(),
			CommentStoreComment::newUnsavedComment( 'Later' ),
			new \MediaWiki\Content\WikitextContent( 'Later main content' ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $first->getId() ] )->caller( __METHOD__ )->execute();
		$this->assertSame( $this->snapshot()->getText(),
			$this->access()->read( $page->getTitle(), $first->getId(), $user )->getText() );
	}
}
