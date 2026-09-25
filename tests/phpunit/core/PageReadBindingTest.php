<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IDBAccessObject;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageReadService
 * @group Database
 */
class PageReadBindingTest extends \MediaWikiIntegrationTestCase {
	public function testBindingReadsDisplayedRevisionAndNeverFallsBack(): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$reader = new PageReadService( new PageHistoryAccess( $s->getRevisionLookup() ),
			new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ) );
		$page = $this->getExistingTestPage();
		$owner = $page->getTitle();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$binding = 'v1:' . $page->getId() . ':presentation';
		$first = $registered['publisher']->publish( $owner, $actor, $page->getLatest(), json_encode( $document ),
			'First bound drawing', new WikitextContent( '{{#Slide:Demo|layersbinding=' . $binding . '}}' ),
			$page->getId() );
		$document->surfaces[0]->layers[0]->text = 'Later drawing';
		$second = $registered['publisher']->publish(
			$owner, $actor, $first, json_encode( $document ), 'Update drawing' );
		$old = $reader->readBoundSurface( $owner, $first, $binding, $actor );
		$new = $reader->readBoundSurface( $owner, $second, $binding, $actor );
		$this->assertSame( $page->getId(), $old['pageId'] );
		$this->assertSame( $first, $old['revisionId'] );
		$this->assertSame( 'Visual ideas — 世界', $old['surface']['layers'][0]['text'] );
		$this->assertSame( 'Later drawing', $new['surface']['layers'][0]['text'] );
		$other = $this->getExistingTestPage( 'OtherBindingOwner' );
		$denied = $this->createMock( Authority::class );
		$denied->method( 'authorizeRead' )->willReturn( false );
		foreach ( [
			[ $owner, $second, 'v1:' . $page->getId() . ':missing', $actor ],
			[ $owner, $second, 'v1:' . $other->getId() . ':presentation', $actor ],
			[ $other->getTitle(), $first, 'v1:' . $other->getId() . ':presentation', $actor ],
			[ $owner, 0, $binding, $actor ],
			[ $owner, $first, 'invalid-private-value', $actor ],
			[ $owner, $first, $binding, $denied ]
		] as [ $target, $revision, $value, $authority ] ) {
			$this->assertUnavailable( static function () use ( $reader, $target, $revision, $value, $authority ) {
				$reader->readBoundSurface( $target, $revision, $value, $authority );
			} );
		}
		// Deleting the surface later cannot change the old view or resurrect it in the new view.
		$third = $registered['publisher']->publish( $owner, $actor, $second,
			'{"schemaVersion":1,"surfaces":[]}', 'Remove drawing' );
		$this->assertSame( $old, $reader->readBoundSurface( $owner, $first, $binding, $actor ) );
		$this->assertUnavailable( static function () use ( $reader, $owner, $third, $binding, $actor ) {
			$reader->readBoundSurface( $owner, $third, $binding, $actor );
		} );
		$this->assertUnavailable( static function () use ( $s, $owner, $first, $actor, $other ) {
			( new PageHistoryAccess( $s->getRevisionLookup() ) )->read( $owner, $first, $actor, $other->getId() );
		} );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => \MediaWiki\Revision\RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $first ] )->caller( __METHOD__ )->execute();
		$this->assertFalse( $actor->isAllowed( 'deletedtext' ) );
		$this->assertUnavailable( static function () use ( $reader, $owner, $first, $binding, $actor ) {
			$reader->readBoundSurface( $owner, $first, $binding, $actor );
		} );
	}

	public function testBoundReadFollowsNativeMoveRejectsRedirectAndVerifiesPermissions(): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$reader = new PageReadService(
			new PageHistoryAccess( $s->getRevisionLookup() ),
			new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() )
		);

		$page = $this->getExistingTestPage( 'UnscopedBindingMoveSource' );
		$origId = $page->getId();
		$oldTitle = $page->getTitle();
		$newTitle = Title::newFromText( 'UnscopedBindingMoveDestination' );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'move', 'createpage', 'delete' ] );

		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$surfaceId = 'presentation';
		$binding = 'v1:' . $origId . ':' . $surfaceId;

		$firstRev = $registered['publisher']->publish(
			$oldTitle, $actor, $page->getLatest(), json_encode( $document ),
			'First bound drawing before move',
			new WikitextContent( '{{#Slide:Demo|layersbinding=' . $binding . '}}' ),
			$origId
		);

		// Step 1: Move unscoped native test page using MediaWiki's move service.
		$status = $s->getMovePageFactory()->newMovePage( $oldTitle, $newTitle )
			->moveIfAllowed( $actor, 'Move bound page' );
		$this->assertTrue( $status->isOK(), json_encode( $status->getErrors() ) );

		// Resolve fresh Title objects after the move.
		$freshNewTitle = $s->getTitleFactory()->newFromText( $newTitle->getPrefixedText() );
		$freshOldTitle = $s->getTitleFactory()->newFromText( $oldTitle->getPrefixedText() );

		// Assert original PageID, revision and drawing read through the new title.
		$this->assertSame( $origId, $freshNewTitle->getArticleID( IDBAccessObject::READ_LATEST ) );
		$oldRead = $reader->readBoundSurface( $freshNewTitle, $firstRev, $binding, $actor );
		$this->assertSame( $origId, $oldRead['pageId'] );
		$this->assertSame( $firstRev, $oldRead['revisionId'] );
		$this->assertSame( 'Visual ideas — 世界', $oldRead['surface']['layers'][0]['text'] );

		// Step 2: Assert the old-title redirect cannot act as the binding owner.
		$this->assertGreaterThan( 0, $freshOldTitle->getArticleID( IDBAccessObject::READ_LATEST ) );
		$this->assertTrue( $freshOldTitle->isRedirect() );
		$this->assertNotSame( $origId, $freshOldTitle->getArticleID( IDBAccessObject::READ_LATEST ) );
		$this->assertUnavailable( static function () use ( $reader, $freshOldTitle, $firstRev, $binding, $actor ) {
			$reader->readBoundSurface( $freshOldTitle, $firstRev, $binding, $actor );
		} );
		$redirectBinding = 'v1:' . $freshOldTitle->getArticleID( IDBAccessObject::READ_LATEST ) . ':' . $surfaceId;
		$this->assertUnavailable(
			static function () use ( $reader, $freshOldTitle, $firstRev, $redirectBinding, $actor ) {
				$reader->readBoundSurface( $freshOldTitle, $firstRev, $redirectBinding, $actor );
			}
		);

		// Create another page with the same surface ID and label; neither confers original PageID.
		$otherPage = $this->getExistingTestPage( 'UnscopedBindingOtherOwner' );
		$otherId = $otherPage->getId();
		$otherTitle = $otherPage->getTitle();
		$this->assertNotSame( $origId, $otherId );
		$otherRev = $registered['publisher']->publish(
			$otherTitle, $actor, $otherPage->getLatest(), json_encode( $document ),
			'Other page drawing with same surface label',
			new WikitextContent( '{{#Slide:Demo|layersbinding=v1:' . $otherId . ':' . $surfaceId . '}}' ),
			$otherId
		);
		$otherBinding = 'v1:' . $otherId . ':' . $surfaceId;

		foreach ( [
			[ $otherTitle, $firstRev, $binding, $actor ],
			[ $otherTitle, $otherRev, $binding, $actor ],
			[ $freshNewTitle, $firstRev, $otherBinding, $actor ],
			[ $freshNewTitle, $otherRev, $otherBinding, $actor ],
		] as [ $targetTitle, $targetRev, $targetBinding, $targetAuth ] ) {
			$this->assertUnavailable( static function () use (
				$reader, $targetTitle, $targetRev, $targetBinding, $targetAuth
			) {
				$reader->readBoundSurface( $targetTitle, $targetRev, $targetBinding, $targetAuth );
			} );
		}

		// Step 4: Add a denied-reader check after move.
		$deniedReader = $this->createMock( Authority::class );
		$deniedReader->method( 'authorizeRead' )->willReturn( false );
		$this->assertUnavailable(
			static function () use ( $reader, $freshNewTitle, $firstRev, $binding, $deniedReader ) {
				$reader->readBoundSurface( $freshNewTitle, $firstRev, $binding, $deniedReader );
			}
		);

		$this->setGroupPermissions( '*', 'read', false );
		$unprivilegedUser = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $unprivilegedUser, [] );
		$this->assertFalse( $unprivilegedUser->authorizeRead( 'read', $freshNewTitle ) );
		$this->assertUnavailable(
			static function () use ( $reader, $freshNewTitle, $firstRev, $binding, $unprivilegedUser ) {
				$reader->readBoundSurface( $freshNewTitle, $firstRev, $binding, $unprivilegedUser );
			}
		);

		// Verify read-only access does not require editlayers permission.
		$readOnlyUser = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $readOnlyUser, [ 'read' ] );
		$this->assertFalse( $readOnlyUser->isAllowed( 'editlayers' ) );
		$this->assertFalse( $readOnlyUser->isAllowed( 'edit' ) );
		$readOnlyResult = $reader->readBoundSurface( $freshNewTitle, $firstRev, $binding, $readOnlyUser );
		$this->assertSame( $origId, $readOnlyResult['pageId'] );
		$this->assertSame( $firstRev, $readOnlyResult['revisionId'] );
		$this->assertSame( 'Visual ideas — 世界', $readOnlyResult['surface']['layers'][0]['text'] );
	}

	public function testDeletedAndRecreatedPageRejectsOriginalBindingEvenWithSameSurface(): void {
		$registered = TestingAdmissionRegistration::install( $this );
		$s = $this->getServiceContainer();
		$reader = new PageReadService(
			new PageHistoryAccess( $s->getRevisionLookup() ),
			new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() )
		);

		$page = $this->getExistingTestPage( 'UnscopedBindingDeleteSource' );
		$origId = $page->getId();
		$title = $page->getTitle();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'delete', 'createpage' ] );

		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$surfaceId = 'presentation';
		$binding = 'v1:' . $origId . ':' . $surfaceId;

		$firstRev = $registered['publisher']->publish(
			$title, $actor, $page->getLatest(), json_encode( $document ),
			'First bound drawing before delete',
			new WikitextContent( '{{#Slide:Demo|layersbinding=' . $binding . '}}' ),
			$origId
		);

		// Step 3: Delete the unscoped test owner via native services.
		$wikiPage = $s->getWikiPageFactory()->newFromTitle( $title );
		$deleteStatus = $s->getDeletePageFactory()->newDeletePage( $wikiPage, $actor )
			->deleteUnsafe( 'Delete unscoped test owner' );
		$this->assertTrue( $deleteStatus->isOK(), json_encode( $deleteStatus->getErrors() ) );

		// Preserve native archive records; verify record exists in archive table.
		$archiveRow = $this->getDb()->newSelectQueryBuilder()
			->select( [ 'ar_rev_id', 'ar_page_id' ] )
			->from( 'archive' )
			->where( [ 'ar_rev_id' => $firstRev ] )
			->caller( __METHOD__ )
			->fetchRow();
		$this->assertNotEmpty( $archiveRow, 'Deleted revision must be preserved in native archive table' );
		$this->assertSame( $firstRev, (int)$archiveRow->ar_rev_id );
		$this->assertSame( $origId, (int)$archiveRow->ar_page_id );

		// Recreate a new page at the same title via native services.
		$recreatedWikiPage = $s->getWikiPageFactory()->newFromTitle( $title );
		$this->editPage( $recreatedWikiPage, 'Recreated page main text' );

		$freshRecreatedTitle = $s->getTitleFactory()->newFromText( $title->getPrefixedText() );
		$recreatedId = $freshRecreatedTitle->getArticleID( IDBAccessObject::READ_LATEST );
		$this->assertGreaterThan( 0, $recreatedId );
		$this->assertNotSame( $origId, $recreatedId, 'Recreated page must receive a distinct PageID' );

		// Seed new snapshot with the SAME surface ID on the recreated page.
		$document->surfaces[0]->layers[0]->text = 'Replacement page drawing';
		$newBinding = 'v1:' . $recreatedId . ':' . $surfaceId;
		$recreatedLatest = $freshRecreatedTitle->getLatestRevID();
		$secondRev = $registered['publisher']->publish(
			$freshRecreatedTitle, $actor, $recreatedLatest, json_encode( $document ),
			'Recreated page drawing with same surface ID',
			new WikitextContent( '{{#Slide:Demo|layersbinding=' . $newBinding . '}}' ),
			$recreatedId
		);

		// Recreated page can read its own new binding.
		$newRead = $reader->readBoundSurface( $freshRecreatedTitle, $secondRev, $newBinding, $actor );
		$this->assertSame( $recreatedId, $newRead['pageId'] );
		$this->assertSame( $secondRev, $newRead['revisionId'] );
		$this->assertSame( 'Replacement page drawing', $newRead['surface']['layers'][0]['text'] );

		// Assert rejection of original binding by the replacement page (for both new and archived revision).
		$this->assertUnavailable(
			static function () use ( $reader, $freshRecreatedTitle, $secondRev, $binding, $actor ) {
				$reader->readBoundSurface( $freshRecreatedTitle, $secondRev, $binding, $actor );
			}
		);
		$this->assertUnavailable(
			static function () use ( $reader, $freshRecreatedTitle, $firstRev, $binding, $actor ) {
				$reader->readBoundSurface( $freshRecreatedTitle, $firstRev, $binding, $actor );
			}
		);
		$this->assertUnavailable(
			static function () use ( $reader, $freshRecreatedTitle, $firstRev, $newBinding, $actor ) {
				$reader->readBoundSurface( $freshRecreatedTitle, $firstRev, $newBinding, $actor );
			}
		);

		// Verify native archive records remain preserved without undelete or bypassing administrative guards.
		$archivePostCheck = $this->getDb()->newSelectQueryBuilder()
			->select( 'ar_rev_id' )
			->from( 'archive' )
			->where( [ 'ar_rev_id' => $firstRev ] )
			->caller( __METHOD__ )
			->fetchField();
		$this->assertSame( $firstRev, (int)$archivePostCheck, 'Native archive records must remain preserved' );
	}

	/** @param callable $read */
	private function assertUnavailable( callable $read ): void {
		try {
			$read();
			$this->fail( 'Expected unavailable binding' );
		} catch ( \DomainException $e ) {
			$this->assertSame( 'layers-revision-unavailable', $e->getMessage() );
			$this->assertNull( $e->getPrevious() );
		}
	}
}
