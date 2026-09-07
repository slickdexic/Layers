<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\SlotRecord;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PagePublicationService
 * @covers \MediaWiki\Extension\Layers\Revision\PublicationException
 * @covers \MediaWiki\Extension\Layers\Revision\PageHistoryAccess
 * @group Database
 */
class PagePublicationServiceTest extends \MediaWikiIntegrationTestCase {
	protected function setUp(): void {
		parent::setUp();
		$this->getServiceContainer()->getContentHandlerFactory()->defineContentHandler(
			LayersDocumentContent::MODEL, LayersDocumentContentHandler::class );
		$this->getServiceContainer()->getSlotRoleRegistry()->defineRoleWithModel(
			PageRevisionWriter::SLOT, LayersDocumentContent::MODEL, [ 'display' => 'none' ], false );
	}

	private function service( ?SourceVersionResolver $sources = null ): PagePublicationService {
		$s = $this->getServiceContainer();
		return new PagePublicationService( $s->getWikiPageFactory(), new PageHistoryAccess( $s->getRevisionLookup() ),
			$sources ?? new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ),
			new PageRevisionWriter() );
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
}
