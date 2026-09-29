<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionContext;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\SlotRecord;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PagePublicationService
 * @covers \MediaWiki\Extension\Layers\Revision\PublicationException
 * @covers \MediaWiki\Extension\Layers\Revision\PageHistoryAccess
 * @group Database
 */
class PagePublicationServiceTest extends \MediaWikiIntegrationTestCase {
	private ?PublicationAdmissionContext $context = null;

	protected function setUp(): void {
		parent::setUp();
		$registered = TestingAdmissionRegistration::install( $this );
		$this->context = $registered['context'];
	}

	private function service( ?SourceVersionResolver $sources = null,
		?PageRevisionWriter $writer = null
	): PagePublicationService {
		$s = $this->getServiceContainer();
		return new PagePublicationService( $s->getWikiPageFactory(), new PageHistoryAccess( $s->getRevisionLookup() ),
			$sources ?? new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ),
			$writer ?? new PageRevisionWriter(),
			$this->context );
	}

	private function snapshot( string $label = 'Ideas' ): string {
		$doc = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ) );
		$doc->surfaces = [ $doc->surfaces[0] ];
		$doc->surfaces[0]->label = $label;
		return json_encode( $doc );
	}

	private function actor(): Authority {
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ] );
		return $user;
	}

	public function testRevisionsAreTaggedAndMainTextPassesEditFilters(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();
		$s = $this->getServiceContainer();
		$service = new PagePublicationService( $s->getWikiPageFactory(),
			new PageHistoryAccess( $s->getRevisionLookup() ),
			new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ),
			new PageRevisionWriter(), $this->context, $s->getHookContainer(), $s->getUserFactory() );
		$seen = [];
		$this->setTemporaryHook( 'EditFilterMergedContent',
			static function ( $context, $content, $status ) use ( &$seen ) {
				$seen[] = $context->getTitle()->getPrefixedDBkey();
				if ( str_contains( $content->getText(), 'BLOCKED' ) ) {
					$status->fatal( 'spamprotectiontext' );
				}
			} );
		$id = $service->publish( $page->getTitle(), $actor, 0, $this->snapshot(), 'Create',
			new WikitextContent( 'Owner page' ) );
		$this->assertSame( [ $page->getTitle()->getPrefixedDBkey() ], $seen );
		$this->assertContains( PagePublicationService::CHANGE_TAG,
			$s->getChangeTagsStore()->getTags( $s->getConnectionProvider()->getReplicaDatabase(), null, $id ) );
		try {
			$service->publish( $page->getTitle(), $actor, $id, $this->snapshot( 'Changed' ), 'Filtered',
				new WikitextContent( 'BLOCKED link farm' ) );
			$this->fail( 'Edit filters must apply to page text published with a drawing' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-filtered', $e->getMessage() );
		}
		// A drawing-only change leaves the main text as saved and needs no text filtering.
		$next = $service->publish( $page->getTitle(), $actor, $id, $this->snapshot( 'Changed' ), 'Drawing only' );
		$this->assertCount( 2, $seen );
		$this->assertSame( $next, $s->getRevisionLookup()->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	public function testCreateUpdateReadAndNoOpThroughCompleteService(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();
		$service = $this->service();
		$id = $service->publish( $page->getTitle(), $actor, 0, $this->snapshot(), 'Create visual content',
			new WikitextContent( 'Owner page' ) );
		$next = $service->publish( $page->getTitle(), $actor, $id, $this->snapshot( 'Changed' ), 'Change diagram',
			new WikitextContent( 'Updated owner page' ) );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $next );
		$this->assertNotSame( $id, $next );
		$this->assertSame( $id, $revision->getParentId() );
		$this->assertSame( $actor->getUser()->getId(), $revision->getUser()->getId() );
		$this->assertSame( 'Change diagram', $revision->getComment()->text );
		$this->assertSame( 'Updated owner page', $revision->getContent( SlotRecord::MAIN )->getText() );
		$old = ( new PageHistoryAccess( $this->getServiceContainer()->getRevisionLookup() ) )
			->read( $page->getTitle(), $id, $actor );
		$this->assertSame( 'Ideas', json_decode( $old->getText() )->surfaces[0]->label );
		$this->assertSame( $next,
			$service->publish( $page->getTitle(), $actor, $next, $this->snapshot( 'Changed' ), 'No change' ) );
	}

	/**
	 * @dataProvider provideFailures
	 * @param string $reason
	 * @param string $error
	 */
	public function testRejectedPublicationLeavesRevisionUnchanged( string $reason, string $error ): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$base = $page->getLatest();
		$json = $this->snapshot();
		$requestBase = $base;
		if ( $reason === 'invalid' ) {
			$json = '{}';
		} elseif ( $reason === 'stale' ) {
			$requestBase = $base + 100000;
		} elseif ( $reason === 'negative' ) {
			$requestBase = -1;
		} elseif ( $reason === 'denied' ) {
			$this->overrideUserPermissions( $actor->getUser(), [ 'read', 'edit' ] );
		} else {
			$json = file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' );
		}
		try {
			$this->service()->publish( $page->getTitle(), $actor, $requestBase, $json, 'Must fail',
				new WikitextContent( 'Must not replace owner text' ) );
			$this->fail( 'Expected publication failure' );
		} catch ( PublicationException $e ) {
			$this->assertSame( $error, $e->getMessage() );
		}
		$this->assertSame( $base, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	public function testDrawingNamesAreUniqueOnThePageAndWritableIntoAnEmbed(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();
		$service = $this->service();
		$id = $service->publish( $page->getTitle(), $actor, 0, $this->snapshot(), 'Create',
			new WikitextContent( 'Owner page' ) );
		$twin = json_decode( $this->snapshot() );
		$twin->surfaces[] = clone $twin->surfaces[0];
		$twin->surfaces[1]->id = 'second';
		foreach ( [
			[ 'ideas', 'layers-invalid-snapshot-name-taken' ],
			[ 'Ideas_', 'layers-invalid-snapshot-name-taken' ],
			[ 'Plan | B', 'layers-invalid-snapshot-name' ],
			[ '228:Ideas', 'layers-invalid-snapshot-name' ]
		] as [ $name, $message ] ) {
			$twin->surfaces[1]->label = $name;
			try {
				$service->publish( $page->getTitle(), $actor, $id, json_encode( $twin ), 'Must fail' );
				$this->fail( "\"$name\" must be refused" );
			} catch ( PublicationException $e ) {
				$this->assertSame( 'layers-invalid-snapshot', $e->getMessage() );
				$this->assertSame( [ $message, $name ], $e->getUserMessage() );
			}
		}
		$this->assertSame( $id, $page->getTitle()->getLatestRevID( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST ) );
		$twin->surfaces[1]->label = 'Ideas 2';
		$this->assertNotSame( $id, $service->publish( $page->getTitle(), $actor, $id, json_encode( $twin ), 'Two' ) );
	}

	public function testAnEmptySummaryDescribesTheDrawingChanges(): void {
		$this->setContentLang( 'en' );
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();
		$service = $this->service();
		$comment = fn ( int $revisionId ) => $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $revisionId )->getComment()->text;
		$id = $service->publish( $page->getTitle(), $actor, 0, $this->snapshot(), '', new WikitextContent( 'Owner' ) );
		$this->assertSame( 'Added drawing “Ideas”', $comment( $id ) );
		$id = $service->publish( $page->getTitle(), $actor, $id, $this->snapshot( 'Plans' ), '  ' );
		$this->assertSame( 'Renamed drawing “Ideas” to “Plans”', $comment( $id ) );
		$id = $service->publish( $page->getTitle(), $actor, $id, $this->snapshot( 'Ideas' ), 'My words' );
		$this->assertSame( 'My words', $comment( $id ) );
		$id = $service->publish( $page->getTitle(), $actor, $id, $this->snapshot(), '',
			new WikitextContent( 'Text only' ) );
		$this->assertSame( '', $comment( $id ) );
	}

	public function testRenamingADrawingRewritesThisPagesEmbeds(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();
		$service = $this->service();
		$title = $page->getTitle();
		$id = $service->publish( $title, $actor, 0, $this->snapshot(), 'Create', new WikitextContent( 'Owner page' ) );
		$pageId = $title->getArticleID( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST );
		$main = fn ( int $revisionId ) => $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $revisionId )->getContent( SlotRecord::MAIN )->getText();
		$id = $service->publish( $title, $actor, $id, $this->snapshot(), 'Embed',
			new WikitextContent( "Intro {{#Slide:$pageId:Ideas|width=400}} and {{#Slide:$pageId:Other}}" ) );

		$renamed = $service->publish( $title, $actor, $id, $this->snapshot( 'Plans' ), 'Rename' );
		$this->assertSame( "Intro {{#Slide:$pageId:Plans|width=400}} and {{#Slide:$pageId:Other}}", $main( $renamed ) );
		// Names that differ only in case still match, so the text stays as written.
		$recased = $service->publish( $title, $actor, $renamed, $this->snapshot( 'plans' ), 'Case' );
		$this->assertSame( $main( $renamed ), $main( $recased ) );
		$sent = $service->publish( $title, $actor, $recased, $this->snapshot( 'Ideas' ), 'Rename with text',
			new WikitextContent( "New {{#Slide:$pageId:PLANS}}" ) );
		$this->assertSame( "New {{#Slide:$pageId:Ideas}}", $main( $sent ) );
	}

	/** @return array */
	public static function provideFailures(): array {
		return [
			[ 'invalid', 'layers-invalid-snapshot' ],
			[ 'stale', 'layers-edit-conflict' ],
			[ 'negative', 'layers-invalid-publication-request' ],
			[ 'denied', 'layers-owner-edit-denied' ],
			[ 'source', 'layers-source-unavailable' ]
		];
	}

	public function testDenialPrecedesSourceLookup(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$this->overrideUserPermissions( $actor->getUser(), [ 'read' ] );
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		$this->expectException( PublicationException::class );
		$this->service( $sources )->publish( $page->getTitle(), $actor, $page->getLatest(), $this->snapshot(), '' );
	}

	public function testPermissionRevokedDuringValidationIsRechecked(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$base = $page->getLatest();
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturnCallback( function () use ( $actor ) {
			$this->overrideUserPermissions( $actor->getUser(), [ 'read' ] );
			return [];
		} );
		try {
			$this->service( $sources )->publish( $page->getTitle(), $actor, $base, $this->snapshot(), '' );
			$this->fail( 'Expected revoked permission to prevent saving' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-edit-denied', $e->getMessage() );
		}
		$this->assertSame( $base, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	public function testNewOwnerRequiresMainWithoutCreatingPage(): void {
		$page = $this->getNonexistingTestPage();
		try {
			$this->service()->publish( $page->getTitle(), $this->actor(), 0, $this->snapshot(), '' );
			$this->fail( 'Expected missing main to fail' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-invalid-publication-request', $e->getMessage() );
		}
		$this->assertFalse( $page->getTitle()->exists( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST ) );
	}

	public function testConcurrentEditDuringValidationPreservesWinner(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$base = $page->getLatest();
		$winner = null;
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturnCallback( function () use ( $page, $actor, $base, &$winner ) {
			$winner = $this->service()->publish( $page->getTitle(), $actor, $base, $this->snapshot( 'Winner' ), '' );
			return [];
		} );
		try {
			$this->service( $sources )->publish( $page->getTitle(), $actor, $base, $this->snapshot( 'Loser' ), '' );
			$this->fail( 'Expected conflict' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}
		$this->assertNotNull( $winner );
		$this->assertSame( $winner, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	public function testCannotChangeMainModelButCanPreserveIt(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$updater = $page->newPageUpdater( $actor );
		$updater->setContent( SlotRecord::MAIN, new \MediaWiki\Content\JsonContent( '{"keep":true}' ) );
		$revision = $updater->saveRevision(
			\MediaWiki\CommentStore\CommentStoreComment::newUnsavedComment( 'JSON owner' ) );
		$this->assertNotNull( $revision );
		$base = $revision->getId();
		try {
			$this->service()->publish( $page->getTitle(), $actor, $base, $this->snapshot(), '',
				new WikitextContent( 'Must not change model' ) );
			$this->fail( 'Expected model-change rejection' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-main-model-change-denied', $e->getMessage() );
		}
		$id = $this->service()->publish( $page->getTitle(), $actor, $base, $this->snapshot(), '' );
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$this->assertSame( $base, $current->getParentId() );
		$this->assertSame( CONTENT_MODEL_JSON, $current->getContent( SlotRecord::MAIN )->getModel() );
		$this->assertSame( [ 'keep' => true ],
			json_decode( $current->getContent( SlotRecord::MAIN )->getText(), true ) );
	}

	public function testWriteAuthorizationOccursOnlyOncePerAction(): void {
		$page = $this->getExistingTestPage();
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->getTestUser()->getUser() );
		$authority->expects( $this->exactly( 3 ) )->method( 'definitelyCan' )->willReturn( true );
		$authority->expects( $this->once() )->method( 'authorizeRead' )
			->with( 'read', $page->getTitle() )->willReturn( true );
		$authority->expects( $this->exactly( 2 ) )->method( 'authorizeWrite' )
			->withConsecutive( [ 'editlayers', $page->getTitle() ], [ 'edit', $page->getTitle() ] )->willReturn( true );
		$this->assertGreaterThan( $page->getLatest(),
			$this->service()->publish( $page->getTitle(), $authority, $page->getLatest(), $this->snapshot(), '' ) );
	}

	public function testBoundPublicationCommitsBothSlotsAndPreservesNoOp(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$base = $page->getLatest();
		$id = $page->getId();
		$main = new WikitextContent( 'Bound drawing reference' );
		$next = $this->service()->publish( $page->getTitle(), $actor, $base, $this->snapshot(),
			'Adopt drawing', $main, $id );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $next );
		$this->assertSame( $id, $revision->getPageId() );
		$this->assertSame( $base, $revision->getParentId() );
		$this->assertSame( $main->getText(), $revision->getContent( SlotRecord::MAIN )->getText() );
		$this->assertTrue( $revision->hasSlot( PageRevisionWriter::SLOT ) );
		$this->assertSame( $next, $this->service()->publish( $page->getTitle(), $actor, $next,
			$this->snapshot(), 'Unchanged', $main, $id ) );
	}

	public function testWrongBoundIdentityRejectsBeforeSourceWork(): void {
		$page = $this->getExistingTestPage();
		$other = $this->getExistingTestPage( 'Different bound owner' );
		$base = $page->getLatest();
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->expects( $this->never() )->method( 'resolve' );
		try {
			$this->service( $sources )->publish( $page->getTitle(), $this->actor(), $base,
				$this->snapshot(), '', null, $other->getId() );
			$this->fail( 'Expected identity rejection' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-unavailable', $e->getMessage() );
		}
		$this->assertSame( $base, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	public function testBoundPublicationCannotCreateAnOwner(): void {
		$page = $this->getNonexistingTestPage();
		try {
			$this->service()->publish( $page->getTitle(), $this->actor(), 0, $this->snapshot(), '',
				new WikitextContent( 'Must not create' ), 123 );
			$this->fail( 'Expected bound creation rejection' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-invalid-publication-request', $e->getMessage() );
		}
		$this->assertFalse( $page->getTitle()->exists( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST ) );
	}

	public function testWrongPreparedPageCannotOpenAdmissionOrCommit(): void {
		$page = $this->getExistingTestPage();
		$other = $this->getExistingTestPage( 'Wrong prepared page' );
		$base = $page->getLatest();
		$prepared = $this->createMock( \MediaWiki\Storage\PreparedUpdate::class );
		$prepared->method( 'getPage' )->willReturn( $other->getTitle() );
		$prepared->expects( $this->never() )->method( 'getRawContent' );
		$writer = $this->createMock( PageRevisionWriter::class );
		$writer->expects( $this->once() )->method( 'save' )->willReturnCallback(
			function ( $updater, $baseId, $content, $summary, $main, $scope ) use ( $prepared ) {
				return $scope( $prepared, function () {
					$this->fail( 'A mismatched prepared page must never reach commit' );
				} );
			}
		);
		try {
			$this->service( null, $writer )->publish( $page->getTitle(), $this->actor(), $base,
				$this->snapshot(), '', null, $page->getId() );
			$this->fail( 'Expected prepared identity rejection' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-unavailable', $e->getMessage() );
		}
		$this->assertSame( $base, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle() )->getId() );
	}

	public function testMoveDuringSourcePreparationDoesNotPublishToOldTitle(): void {
		$page = $this->getExistingTestPage();
		$old = $page->getTitle();
		$new = $this->getNonexistingTestPage()->getTitle();
		$id = $page->getId();
		$base = $page->getLatest();
		$actor = $this->actor();
		$this->overrideUserPermissions( $actor->getUser(), [ 'read', 'edit', 'editlayers', 'move', 'createpage' ] );
		$s = $this->getServiceContainer();
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturnCallback( function () use ( $s, $old, $new, $actor ) {
			$status = $s->getMovePageFactory()->newMovePage( $old, $new )->moveIfAllowed( $actor, 'Concurrent move' );
			$this->assertTrue( $status->isOK(), json_encode( $status->getErrors() ) );
			return [];
		} );
		try {
			$this->service( $sources )->publish( $old, $actor, $base, $this->snapshot(), '',
				new WikitextContent( 'Must not replace redirect' ), $id );
			$this->fail( 'Expected moved identity rejection' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-unavailable', $e->getMessage() );
		}
		$moved = $s->getRevisionLookup()->getRevisionByTitle( $new );
		$redirect = $s->getRevisionLookup()->getRevisionByTitle( $old );
		$this->assertSame( $id, $moved->getPageId() );
		$this->assertNotSame( $id, $redirect->getPageId() );
		$this->assertFalse( $moved->hasSlot( PageRevisionWriter::SLOT ) );
		$this->assertFalse( $redirect->hasSlot( PageRevisionWriter::SLOT ) );
		$this->assertStringContainsString( '#REDIRECT', $redirect->getContent( SlotRecord::MAIN )->getText() );
	}
}
