<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Hooks\PageOwnedAdmissionHooks;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionContext;
use MediaWiki\Extension\Layers\Revision\PublicationAdmissionIntent;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\SlotRecord;
use MediaWikiIntegrationTestCase;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * Real-core security and admission matrix for page-owned Layers revisions.
 *
 * Exercises part of the acceptance matrix in docs/PAGE_OWNED_ADMISSION_DESIGN.md.
 * Requires MediaWiki's real database-isolated integration harness.
 *
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedAdmissionHooks
 * @covers \MediaWiki\Extension\Layers\Revision\PublicationAdmissionContext
 * @covers \MediaWiki\Extension\Layers\Revision\PublicationAdmissionIntent
 * @covers \MediaWiki\Extension\Layers\Revision\PagePublicationService
 * @covers \MediaWiki\Extension\Layers\Revision\PageRevisionWriter
 * @group Database
 */
class PageOwnedAdmissionTest extends MediaWikiIntegrationTestCase {
	private PublicationAdmissionContext $context;
	private PagePublicationService $publisher;
	private PageOwnedAdmissionHooks $hooks;

	protected function setUp(): void {
		parent::setUp();
		$registered = TestingAdmissionRegistration::install( $this );
		$this->context = $registered['context'];
		$this->hooks = $registered['hooks'];
		$this->publisher = $registered['publisher'];
	}

	private function actor(
		array $permissions = [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk' ]
	): Authority {
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, $permissions );
		return $user;
	}

	private function slideSnapshot( string $label = 'Slide 1' ): string {
		$doc = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ) );
		$doc->surfaces = [ $doc->surfaces[0] ];
		$doc->surfaces[0]->label = $label;
		return json_encode( $doc );
	}

	private function mixedSnapshot( string $label = 'Mixed Surface' ): string {
		$doc = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ) );
		$doc->surfaces[0]->label = $label;
		return json_encode( $doc );
	}

	/**
	 * Case 1: Admitted slide creation and snapshot replacement.
	 * Genuine owner revision; main and Layers changes atomic.
	 */
	public function testAdmittedSlideCreationAndSnapshotReplacement(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		// 1a. Slide creation (base 0, new page, main + layers).
		$id = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$this->slideSnapshot( 'Initial Slide' ),
			'Create slide presentation',
			new WikitextContent( 'Slide deck page' )
		);
		$this->assertGreaterThan( 0, $id );

		$revisionLookup = $this->getServiceContainer()->getRevisionLookup();
		$createdRev = $revisionLookup->getRevisionById( $id );
		$this->assertNotNull( $createdRev );
		$this->assertSame( 0, $createdRev->getParentId() );
		$this->assertSame( $actor->getUser()->getId(), $createdRev->getUser()->getId() );
		$this->assertSame( 'Create slide presentation', $createdRev->getComment()->text );
		$this->assertSame( 'Slide deck page', $createdRev->getContent( SlotRecord::MAIN )->getText() );
		$this->assertInstanceOf( LayersDocumentContent::class, $createdRev->getContent( PageRevisionWriter::SLOT ) );

		$slideData = json_decode( $createdRev->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertSame( 'slide', $slideData['surfaces'][0]['kind'] );
		$this->assertSame( 'Initial Slide', $slideData['surfaces'][0]['label'] );
		$this->assertArrayNotHasKey( 'source', $slideData['surfaces'][0] );

		// 1b. Snapshot replacement on existing page with atomic main update.
		$nextId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			$id,
			$this->slideSnapshot( 'Updated Slide Deck' ),
			'Update slides and description',
			new WikitextContent( 'Updated deck description' )
		);
		$this->assertGreaterThan( $id, $nextId );

		$updatedRev = $revisionLookup->getRevisionById( $nextId );
		$this->assertSame( $id, $updatedRev->getParentId() );
		$this->assertSame( 'Updated deck description', $updatedRev->getContent( SlotRecord::MAIN )->getText() );
		$updatedData = json_decode( $updatedRev->getContent( PageRevisionWriter::SLOT )->getText(), true );
		$this->assertSame( 'Updated Slide Deck', $updatedData['surfaces'][0]['label'] );
	}

	/**
	 * Case 2: Direct PageUpdater add/replace/remove denied without service scope,
	 * including a user with editlayers right.
	 */
	public function testDirectPageUpdaterDeniedWithoutScope(): void {
		$actor = $this->actor();

		// 2a. Direct add on page without layers: denied.
		$pageWithoutLayers = $this->getExistingTestPage();
		$initialRevId = $pageWithoutLayers->getLatest();

		$updater = $pageWithoutLayers->newPageUpdater( $actor );
		$updater->setContent( PageRevisionWriter::SLOT, new LayersDocumentContent( $this->slideSnapshot() ) );
		$savedRev = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Direct add attempt' ) );
		$this->assertNull( $savedRev );
		$this->assertFalse( $updater->wasSuccessful() );
		$this->assertTrue( $updater->getStatus()->hasMessage( 'layers-admission-unauthorized' ) );
		$this->assertSame( $initialRevId, $pageWithoutLayers->getTitle()->getLatestRevID() );

		// 2b. Direct replace on page with layers: denied.
		$publishedPage = $this->getNonexistingTestPage();
		$pubRevId = $this->publisher->publish(
			$publishedPage->getTitle(),
			$actor,
			0,
			$this->slideSnapshot(),
			'Initial',
			new WikitextContent( 'Owner' )
		);

		$updaterReplace = $publishedPage->newPageUpdater( $actor );
		$updaterReplace->setContent(
			PageRevisionWriter::SLOT,
			new LayersDocumentContent( $this->slideSnapshot( 'Hijacked' ) )
		);
		$savedReplace = $updaterReplace->saveRevision(
			CommentStoreComment::newUnsavedComment( 'Direct replace attempt' )
		);
		$this->assertNull( $savedReplace );
		$this->assertFalse( $updaterReplace->wasSuccessful() );
		$this->assertTrue( $updaterReplace->getStatus()->hasMessage( 'layers-admission-unauthorized' ) );
		$this->assertSame( $pubRevId, $publishedPage->getTitle()->getLatestRevID() );

		// 2c. Direct remove slot on page with layers: denied with layers-slot-removal-denied.
		$updaterRemove = $publishedPage->newPageUpdater( $actor );
		$updaterRemove->removeSlot( PageRevisionWriter::SLOT );
		$savedRemove = $updaterRemove->saveRevision(
			CommentStoreComment::newUnsavedComment( 'Direct remove attempt' )
		);
		$this->assertNull( $savedRemove );
		$this->assertFalse( $updaterRemove->wasSuccessful() );
		$this->assertTrue( $updaterRemove->getStatus()->hasMessage( 'layers-slot-removal-denied' ) );
		$this->assertSame( $pubRevId, $publishedPage->getTitle()->getLatestRevID() );
	}

	/**
	 * Case 3: Scope borrowing denied on mismatch (owner, base, author, snapshot, role/model, extra slot).
	 */
	public function testScopeBorrowingDeniedOnMismatch(): void {
		$actor = $this->actor();
		$pageA = $this->getExistingTestPage();
		$pageB = $this->getExistingTestPage();
		$baseA = $pageA->getLatest();
		$snapshot = $this->slideSnapshot( 'Authorized Snapshot' );

		// 3a. Scope opened for Page A; save attempted for Page B.
		$intentWrongOwner = new PublicationAdmissionIntent(
			$actor,
			$actor->getUser(),
			$pageA->getId(),
			$pageA->getTitle()->getNamespace(),
			$pageA->getTitle()->getDBkey(),
			$baseA,
			PublicationAdmissionIntent::ACTION_ADD,
			PageRevisionWriter::SLOT,
			LayersDocumentContent::MODEL,
			( new LayersDocumentContent( $snapshot ) )->getCanonicalText()
		);

		$writer = new PageRevisionWriter();
		$updaterB = $pageB->newPageUpdater( $actor );
		try {
			$this->context->executeInScope(
				$intentWrongOwner,
				static function () use ( $writer, $updaterB, $pageB, $snapshot ) {
					return $writer->save(
						$updaterB,
						$pageB->getLatest(),
						new LayersDocumentContent( $snapshot ),
						CommentStoreComment::newUnsavedComment( 'Scope theft attempt' )
					);
				}
			);
			$this->fail( 'Save for Page B borrowing Page A scope must fail' );
		} catch ( \RuntimeException $e ) {
			if ( $e instanceof \PHPUnit\Framework\Exception ) {
				throw $e;
			}
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}
		$this->assertFalse( $this->context->hasActiveScope() );

		// 3b. Scope opened for base revision X; save attempted with base Y.
		$intentWrongBase = new PublicationAdmissionIntent(
			$actor,
			$actor->getUser(),
			$pageA->getId(),
			$pageA->getTitle()->getNamespace(),
			$pageA->getTitle()->getDBkey(),
			// mismatched base
			$baseA + 999,
			PublicationAdmissionIntent::ACTION_ADD,
			PageRevisionWriter::SLOT,
			LayersDocumentContent::MODEL,
			( new LayersDocumentContent( $snapshot ) )->getCanonicalText()
		);

		$updaterBase = $pageA->newPageUpdater( $actor );
		try {
			$this->context->executeInScope(
				$intentWrongBase,
				static function () use ( $writer, $updaterBase, $baseA, $snapshot ) {
					return $writer->save(
						$updaterBase,
						$baseA,
						new LayersDocumentContent( $snapshot ),
						CommentStoreComment::newUnsavedComment( 'Base mismatch attempt' )
					);
				}
			);
			$this->fail( 'Mismatched base revision in intent must fail' );
		} catch ( \RuntimeException $e ) {
			if ( $e instanceof \PHPUnit\Framework\Exception ) {
				throw $e;
			}
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}

		// 3c. Scope opened for User A; save attempted by User B.
		$otherUser = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $otherUser, [ 'read', 'edit', 'editlayers' ] );

		$intentWrongAuthor = new PublicationAdmissionIntent(
			$actor,
			// User A
			$actor->getUser(),
			$pageA->getId(),
			$pageA->getTitle()->getNamespace(),
			$pageA->getTitle()->getDBkey(),
			$baseA,
			PublicationAdmissionIntent::ACTION_ADD,
			PageRevisionWriter::SLOT,
			LayersDocumentContent::MODEL,
			( new LayersDocumentContent( $snapshot ) )->getCanonicalText()
		);

		// User B
		$updaterOtherAuthor = $pageA->newPageUpdater( $otherUser );
		try {
			$this->context->executeInScope(
				$intentWrongAuthor,
				static function () use ( $writer, $updaterOtherAuthor, $baseA, $snapshot ) {
					return $writer->save(
						$updaterOtherAuthor,
						$baseA,
						new LayersDocumentContent( $snapshot ),
						CommentStoreComment::newUnsavedComment( 'Author mismatch attempt' )
					);
				}
			);
			$this->fail( 'Mismatched author in intent must fail' );
		} catch ( \RuntimeException $e ) {
			if ( $e instanceof \PHPUnit\Framework\Exception ) {
				throw $e;
			}
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}

		// 3d. Scope opened for snapshot X; save attempted with snapshot Y.
		$intentWrongSnapshot = new PublicationAdmissionIntent(
			$actor,
			$actor->getUser(),
			$pageA->getId(),
			$pageA->getTitle()->getNamespace(),
			$pageA->getTitle()->getDBkey(),
			$baseA,
			PublicationAdmissionIntent::ACTION_ADD,
			PageRevisionWriter::SLOT,
			LayersDocumentContent::MODEL,
			( new LayersDocumentContent( $this->slideSnapshot( 'Original Intent' ) ) )->getCanonicalText()
		);

		$tamperedSnapshot = $this->slideSnapshot( 'Tampered Snapshot' );
		$updaterSnapshot = $pageA->newPageUpdater( $actor );
		try {
			$this->context->executeInScope(
				$intentWrongSnapshot,
				static function () use ( $writer, $updaterSnapshot, $baseA, $tamperedSnapshot ) {
					return $writer->save(
						$updaterSnapshot,
						$baseA,
						new LayersDocumentContent( $tamperedSnapshot ),
						CommentStoreComment::newUnsavedComment( 'Snapshot mismatch attempt' )
					);
				}
			);
			$this->fail( 'Mismatched snapshot in intent must fail' );
		} catch ( \RuntimeException $e ) {
			if ( $e instanceof \PHPUnit\Framework\Exception ) {
				throw $e;
			}
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}

		// 3e. Scope opened without main change; save mutates main slot.
		$intentNoMain = new PublicationAdmissionIntent(
			$actor,
			$actor->getUser(),
			$pageA->getId(),
			$pageA->getTitle()->getNamespace(),
			$pageA->getTitle()->getDBkey(),
			$baseA,
			PublicationAdmissionIntent::ACTION_ADD,
			PageRevisionWriter::SLOT,
			LayersDocumentContent::MODEL,
			( new LayersDocumentContent( $snapshot ) )->getCanonicalText(),
			// allowsMainModification = false
			false,
			null
		);

		$updaterExtraMain = $pageA->newPageUpdater( $actor );
		try {
			$this->context->executeInScope(
				$intentNoMain,
				static function () use ( $writer, $updaterExtraMain, $baseA, $snapshot ) {
					return $writer->save(
						$updaterExtraMain,
						$baseA,
						new LayersDocumentContent( $snapshot ),
						CommentStoreComment::newUnsavedComment( 'Extra main mutation' ),
						new WikitextContent( 'Unauthorized main text replacement' )
					);
				}
			);
			$this->fail( 'Unauthorized main mutation must fail' );
		} catch ( \RuntimeException $e ) {
			if ( $e instanceof \PHPUnit\Framework\Exception ) {
				throw $e;
			}
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}
	}

	/**
	 * Case 4: Replay, nested scope, exception during save, and no-op then another save.
	 * Scope cannot leak or authorize a later operation.
	 */
	public function testScopeLifecycleIsolationReplayAndNesting(): void {
		$actor = $this->actor();
		$page = $this->getExistingTestPage();
		$base = $page->getLatest();
		$snapshot = $this->slideSnapshot( 'Single Use' );

		$intent = new PublicationAdmissionIntent(
			$actor,
			$actor->getUser(),
			$page->getId(),
			$page->getTitle()->getNamespace(),
			$page->getTitle()->getDBkey(),
			$base,
			PublicationAdmissionIntent::ACTION_ADD,
			PageRevisionWriter::SLOT,
			LayersDocumentContent::MODEL,
			( new LayersDocumentContent( $snapshot ) )->getCanonicalText()
		);

		$writer = new PageRevisionWriter();

		// 4a. Replay: Once a scope is consumed by a save, a second save within the callback fails.
		try {
			$this->context->executeInScope( $intent, function () use ( $writer, $page, $actor, $base, $snapshot ) {
				$first = $writer->save(
					$page->newPageUpdater( $actor ),
					$base,
					new LayersDocumentContent( $snapshot ),
					CommentStoreComment::newUnsavedComment( 'First save' )
				);

				// Attempt second save within the same scope
				$writer->save(
					$page->newPageUpdater( $actor ),
					$first->getId(),
					new LayersDocumentContent( $this->slideSnapshot( 'Replay save' ) ),
					CommentStoreComment::newUnsavedComment( 'Replay attempt' )
				);
			} );
			$this->fail( 'Replaying a consumed scope must fail' );
		} catch ( \RuntimeException $e ) {
			if ( $e instanceof \PHPUnit\Framework\Exception ) {
				throw $e;
			}
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}
		$this->assertFalse( $this->context->hasActiveScope() );

		// 4b. Nested scope: Calling executeInScope inside executeInScope throws LogicException.
		$nestedIntent = new PublicationAdmissionIntent(
			$actor, $actor->getUser(), $page->getId(),
			$page->getTitle()->getNamespace(), $page->getTitle()->getDBkey(),
			$base, PublicationAdmissionIntent::ACTION_ADD
		);

		try {
			$this->context->executeInScope( $nestedIntent, function () use ( $nestedIntent ) {
				$this->context->executeInScope( $nestedIntent, function () {
					$this->fail( 'Nested scope must not be entered' );
				} );
			} );
			$this->fail( 'Nested scope must throw LogicException' );
		} catch ( \LogicException $e ) {
			$this->assertSame( 'Nested publication scopes are rejected.', $e->getMessage() );
		}
		$this->assertFalse( $this->context->hasActiveScope() );

		// 4c. Exception during save: Scope is cleaned up; subsequent direct save fails; subsequent valid save succeeds.
		try {
			$this->context->executeInScope( $nestedIntent, static function () {
				throw new \Exception( 'Simulated failure during save' );
			} );
		} catch ( \Exception $e ) {
			$this->assertSame( 'Simulated failure during save', $e->getMessage() );
		}
		$this->assertFalse( $this->context->hasActiveScope() );

		// Direct save after exception is denied
		$directUpdater = $page->newPageUpdater( $actor );
		$directUpdater->setContent(
			PageRevisionWriter::SLOT,
			new LayersDocumentContent( $this->slideSnapshot( 'Tampered after exception' ) )
		);
		$directRev = $directUpdater->saveRevision(
			CommentStoreComment::newUnsavedComment( 'Post-exception direct save' )
		);
		$this->assertNull( $directRev );
		$this->assertFalse( $directUpdater->wasSuccessful() );
		$this->assertTrue( $directUpdater->getStatus()->hasMessage( 'layers-admission-unauthorized' ) );

		// Fresh legitimate publication with new scope succeeds
		$freshId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			$page->getLatest(),
			$snapshot,
			'Fresh publication after exception'
		);
		$this->assertGreaterThan( $base, $freshId );
	}

	/**
	 * Case 5: Restricted Authority; permission revoked before final publication check.
	 * No widening to unrestricted author permissions.
	 */
	public function testRestrictedAuthorityNotWidened(): void {
		$page = $this->getExistingTestPage();
		// Lacks edit and editlayers
		$restrictedActor = $this->actor( [ 'read' ] );

		try {
			$this->publisher->publish(
				$page->getTitle(),
				$restrictedActor,
				$page->getLatest(),
				$this->slideSnapshot(),
				'Unauthorized publish'
			);
			$this->fail( 'Restricted authority must be rejected' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-edit-denied', $e->getMessage() );
		}

		// Revocation right before save
		$revokedActor = $this->actor();
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturnCallback( function () use ( $revokedActor ) {
			$this->overrideUserPermissions( $revokedActor->getUser(), [ 'read' ] );
			return [];
		} );

		$services = $this->getServiceContainer();
		$customPublisher = new PagePublicationService(
			$services->getWikiPageFactory(),
			new PageHistoryAccess( $services->getRevisionLookup() ),
			$sources,
			new PageRevisionWriter(),
			$this->context
		);

		try {
			$customPublisher->publish(
				$page->getTitle(),
				$revokedActor,
				$page->getLatest(),
				$this->slideSnapshot(),
				'Revoked during validation'
			);
			$this->fail( 'Revocation during validation must prevent save' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-edit-denied', $e->getMessage() );
		}
	}

	/**
	 * Case 6 (partial): Main-only edit with unchanged source-free slide.
	 * New main revision retains exact snapshot without resolving sources again.
	 */
	public function testMainOnlyEditWithUnchangedLayersPreservedWithoutSourceResolution(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		// Create page with Layers slot
		$initialId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$this->slideSnapshot( 'Original Annotation' ),
			'Initial publication',
			new WikitextContent( 'Initial wikitext' )
		);

		// Editor with only ordinary edit permission (NO editlayers right)
		$ordinaryEditor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $ordinaryEditor, [ 'read', 'edit' ] );

		// Perform main-only edit using normal PageUpdater
		$updater = $page->newPageUpdater( $ordinaryEditor );
		$updater->setContent( SlotRecord::MAIN, new WikitextContent( 'Updated wikitext without touching layers' ) );
		$newRev = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Ordinary main-only edit' ) );

		$this->assertNotNull( $newRev );
		$this->assertTrue( $updater->wasSuccessful() );
		$this->assertSame( $initialId, $newRev->getParentId() );
		$this->assertSame(
			'Updated wikitext without touching layers',
			$newRev->getContent( SlotRecord::MAIN )->getText()
		);

		// Layers slot was inherited and retained with exact identical snapshot content
		$this->assertTrue( $newRev->hasSlot( PageRevisionWriter::SLOT ) );
		$inheritedLayers = $newRev->getContent( PageRevisionWriter::SLOT );
		$this->assertInstanceOf( LayersDocumentContent::class, $inheritedLayers );
		$this->assertSame(
			'Original Annotation',
			json_decode( $inheritedLayers->getText(), true )['surfaces'][0]['label']
		);
	}

	/**
	 * Case 7 (partial): Concurrent winner during source validation, before parent capture.
	 * Loser rejected; winner and its Layers snapshot preserved.
	 */
	public function testConcurrentWinnerAfterParentCapture(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$base = $page->getLatest();

		$winnerId = null;
		$sources = $this->createMock( SourceVersionResolver::class );
		$sources->method( 'resolve' )->willReturnCallback( function () use ( $page, $actor, $base, &$winnerId ) {
			// Intervening winning save
			$winnerId = $this->publisher->publish(
				$page->getTitle(),
				$actor,
				$base,
				$this->slideSnapshot( 'Winning Snapshot' ),
				'Winning save'
			);
			return [];
		} );

		$services = $this->getServiceContainer();
		$racingPublisher = new PagePublicationService(
			$services->getWikiPageFactory(),
			new PageHistoryAccess( $services->getRevisionLookup() ),
			$sources,
			new PageRevisionWriter(),
			$this->context
		);

		try {
			$racingPublisher->publish(
				$page->getTitle(),
				$actor,
				$base,
				$this->slideSnapshot( 'Losing Snapshot' ),
				'Losing save'
			);
			$this->fail( 'Intervening write must reject stale loser' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-edit-conflict', $e->getMessage() );
		}

		$this->assertNotNull( $winnerId );
		$latestRev = $services->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $winnerId, $latestRev->getId() );
		$this->assertSame(
			'Winning Snapshot',
			json_decode( $latestRev->getContent( PageRevisionWriter::SLOT )->getText(), true )['surfaces'][0]['label']
		);
	}

	/**
	 * Case 8 (partial): Missing context service.
	 * Safe failure and stable error mapping; no private content in response/logs.
	 */
	public function testMissingContextFailsClosed(): void {
		$actor = $this->actor();
		$page = $this->getExistingTestPage();

		// 8a. Missing context service: hook instantiated with null context fails closed.
		$services = $this->getServiceContainer();
		$isolatedHook = new PageOwnedAdmissionHooks( null, $services->getRevisionLookup() );

		// Register isolated hook with replace=true
		( function () use ( $isolatedHook ) {
			$this->setTemporaryHook( 'MultiContentSave', $isolatedHook, true );
		} )->bindTo( $this, $this )();

		$updater = $page->newPageUpdater( $actor );
		$updater->setContent( PageRevisionWriter::SLOT, new LayersDocumentContent( $this->slideSnapshot() ) );
		$failedRev = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Missing context attempt' ) );
		$this->assertNull( $failedRev );
		$this->assertFalse( $updater->wasSuccessful() );
		$this->assertTrue( $updater->getStatus()->hasMessage( 'layers-admission-unauthorized' ) );

		// 8b. Restore normal testing registration
		TestingAdmissionRegistration::install( $this, $this->context );
	}

	/**
	 * Case 9: Legacy named-set operations and pages without Layers slots.
	 * Existing behavior remains unaffected by isolated registration.
	 */
	public function testPagesWithoutLayersUnaffectedByAdmissionHook(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();

		// Normal page creation without Layers slot proceeds smoothly
		$updater = $page->newPageUpdater( $actor );
		$updater->setContent( SlotRecord::MAIN, new WikitextContent( 'Standard article text' ) );
		$rev = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Standard page creation' ) );

		$this->assertNotNull( $rev );
		$this->assertTrue( $updater->wasSuccessful() );
		$this->assertFalse( $rev->hasSlot( PageRevisionWriter::SLOT ) );
		$this->assertSame( 'Standard article text', $rev->getContent( SlotRecord::MAIN )->getText() );

		// Subsequent standard edit
		$updaterEdit = $page->newPageUpdater( $actor );
		$updaterEdit->setContent( SlotRecord::MAIN, new WikitextContent( 'Second standard revision' ) );
		$rev2 = $updaterEdit->saveRevision( CommentStoreComment::newUnsavedComment( 'Second edit' ) );

		$this->assertNotNull( $rev2 );
		$this->assertTrue( $updaterEdit->wasSuccessful() );
		$this->assertSame( $rev->getId(), $rev2->getParentId() );
		$this->assertFalse( $rev2->hasSlot( PageRevisionWriter::SLOT ) );
	}

	/** Unauthorized removals and model-only changes must not accompany a Layers write. */
	public function testAdmittedWritePreservesOtherSlotModelsAndPresence(): void {
		$actor = $this->actor();
		$services = $this->getServiceContainer();
		$roleHandler = $this->getMockBuilder( \MediaWiki\Revision\SlotRoleHandler::class )
			->setConstructorArgs( [ 'admission_aux', CONTENT_MODEL_WIKITEXT, [ 'display' => 'none' ], false ] )
			->onlyMethods( [ 'isAllowedModel' ] )->getMock();
		$roleHandler->method( 'isAllowedModel' )->willReturn( true );
		$services->getSlotRoleRegistry()->defineRole( 'admission_aux', static function () use ( $roleHandler ) {
			return $roleHandler;
		} );
		$page = $this->getExistingTestPage();
		$seed = $page->newPageUpdater( $actor );
		$seed->setContent( SlotRecord::MAIN, new WikitextContent( 'Same bytes' ) );
		$seed->setContent( 'admission_aux', new WikitextContent( 'Same bytes' ) );
		$parent = $seed->saveRevision( CommentStoreComment::newUnsavedComment( 'Fixture' ) );
		$this->assertNotNull( $parent );
		$content = new LayersDocumentContent( $this->slideSnapshot() );
		foreach ( [ 'remove', 'aux-model', 'main-model', 'wrong-intent-role', 'wrong-intent-model' ] as $case ) {
			$intent = new PublicationAdmissionIntent(
				$actor, $actor->getUser(), $page->getId(), $page->getTitle()->getNamespace(),
				$page->getTitle()->getDBkey(), $parent->getId(), PublicationAdmissionIntent::ACTION_ADD,
				$case === 'wrong-intent-role' ? 'admission_aux' : PageRevisionWriter::SLOT,
				$case === 'wrong-intent-model' ? CONTENT_MODEL_TEXT : LayersDocumentContent::MODEL,
				$content->getCanonicalText()
			);
			$updater = $page->newPageUpdater( $actor );
			$updater->setContent( PageRevisionWriter::SLOT, $content );
			if ( $case === 'remove' ) {
				$updater->removeSlot( 'admission_aux' );
			} elseif ( $case === 'aux-model' || $case === 'main-model' ) {
				$updater->setContent( $case === 'aux-model' ? 'admission_aux' : SlotRecord::MAIN,
					new \MediaWiki\Content\TextContent( 'Same bytes' ) );
			}
			$result = $this->context->executeInScope( $intent, static function () use ( $updater ) {
				return $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Must reject' ) );
			} );
			$this->assertNull( $result, $case );
			$this->assertTrue( $updater->getStatus()->hasMessage( 'layers-admission-unauthorized' ), $case );
			$current = $services->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
			$this->assertSame( $parent->getId(), $current->getId(), $case );
			$this->assertFalse( $current->hasSlot( PageRevisionWriter::SLOT ), $case );
			foreach ( [ SlotRecord::MAIN, 'admission_aux' ] as $role ) {
				$this->assertSame( CONTENT_MODEL_WIKITEXT, $current->getContent( $role )->getModel(), $case );
				$this->assertSame( 'Same bytes', $current->getContent( $role )->serialize(), $case );
			}
		}
	}

	/**
	 * J25 (1): Failed exact-parent lookup using an injected RevisionLookup at the hook boundary.
	 * Denies save closed; asserts no revision advance and unchanged slot models/content.
	 */
	public function testFailedExactParentLookupFailsClosed(): void {
		$actor = $this->actor();
		$services = $this->getServiceContainer();
		$page = $this->getExistingTestPage();
		$parent = $services->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertNotNull( $parent );

		// Injected RevisionLookup returning null on parent lookup
		$failingLookup = $this->createMock( \MediaWiki\Revision\RevisionLookup::class );
		$failingLookup->expects( $this->once() )->method( 'getRevisionById' )
			->with( $parent->getId(), \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST )->willReturn( null );

		$isolatedHook = new PageOwnedAdmissionHooks( $this->context, $failingLookup );
		( function () use ( $isolatedHook ) {
			$this->setTemporaryHook( 'MultiContentSave', $isolatedHook, true );
		} )->bindTo( $this, $this )();

		$snapshot = $this->slideSnapshot( 'Failing Parent Lookup' );
		$content = new LayersDocumentContent( $snapshot );
		$intent = new PublicationAdmissionIntent(
			$actor,
			$actor->getUser(),
			$page->getId(),
			$page->getTitle()->getNamespace(),
			$page->getTitle()->getDBkey(),
			$parent->getId(),
			PublicationAdmissionIntent::ACTION_ADD,
			PageRevisionWriter::SLOT,
			LayersDocumentContent::MODEL,
			$content->getCanonicalText()
		);

		$updater = $page->newPageUpdater( $actor );
		$updater->setContent( PageRevisionWriter::SLOT, $content );

		$savedRev = $this->context->executeInScope( $intent, static function () use ( $updater ) {
			return $updater->saveRevision(
				CommentStoreComment::newUnsavedComment( 'Attempt with failing parent lookup' )
			);
		} );

		// Save rejected at the hook boundary
		$this->assertNull( $savedRev );
		$this->assertFalse( $updater->wasSuccessful() );
		$this->assertTrue(
			$updater->getStatus()->hasMessage( 'layers-admission-unauthorized' ),
			'Failure must occur at hook boundary with layers-admission-unauthorized'
		);

		// No revision advance in authoritative storage
		$current = $services->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $parent->getId(), $current->getId() );
		$this->assertFalse( $current->hasSlot( PageRevisionWriter::SLOT ) );
		$this->assertSame(
			$parent->getContent( SlotRecord::MAIN )->getModel(),
			$current->getContent( SlotRecord::MAIN )->getModel()
		);
		$this->assertSame(
			$parent->getContent( SlotRecord::MAIN )->serialize(),
			$current->getContent( SlotRecord::MAIN )->serialize()
		);

		// Scope was cleaned up
		$this->assertFalse( $this->context->hasActiveScope() );

		// Restore standard test registration
		TestingAdmissionRegistration::install( $this, $this->context );
	}

	/**
	 * J25 (2): Inherited image/PDF snapshot with deliberately unavailable source resolution.
	 * Synthetic source metadata is mocked for testing, not real asset proof.
	 * Ordinary main edit preserves exact snapshot bytes and never invokes the source resolver.
	 */
	public function testInheritedImagePdfSnapshotPreservedWithoutSourceResolver(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();
		$services = $this->getServiceContainer();

		// Mocked synthetic source metadata resolver for initial publication fixture
		$initialResolver = $this->createMock( SourceVersionResolver::class );
		$initialResolver->method( 'resolve' )->willReturn( [
			'diagram' => [ 'version' => 'mocked-diagram-v1' ],
			'reference' => [ 'version' => 'mocked-reference-v1' ],
		] );

		$registered = TestingAdmissionRegistration::install( $this, $this->context, $initialResolver );
		$publisher = $registered['publisher'];

		// Mixed snapshot has image and PDF surfaces with mocked source metadata
		$mixedSnapshot = $this->mixedSnapshot( 'Initial Mixed Document' );
		$initialId = $publisher->publish(
			$page->getTitle(),
			$actor,
			0,
			$mixedSnapshot,
			'Initial publication with synthetic image/PDF sources',
			new WikitextContent( 'Initial wikitext' )
		);
		$this->assertGreaterThan( 0, $initialId );

		$initialRev = $services->getRevisionLookup()->getRevisionById( $initialId );
		$this->assertNotNull( $initialRev );
		$initialStoredBytes = $initialRev->getContent( PageRevisionWriter::SLOT )->serialize();

		// Deliberately unavailable source resolver (must NEVER be invoked during ordinary main edit)
		$unavailableResolver = $this->createMock( SourceVersionResolver::class );
		$unavailableResolver->expects( $this->never() )
			->method( 'resolve' );

		TestingAdmissionRegistration::install( $this, $this->context, $unavailableResolver );

		// Editor lacking editlayers performs an ordinary main-only edit (separate test user)
		$ordinaryEditor = $this->getMutableTestUser()->getUser();
		$this->overrideUserPermissions( $ordinaryEditor, [ 'read', 'edit' ] );

		$freshPage = $services->getWikiPageFactory()->newFromTitle( $page->getTitle() );
		$updater = $freshPage->newPageUpdater( $ordinaryEditor );
		$updater->setContent( SlotRecord::MAIN, new WikitextContent( 'Updated wikitext content' ) );
		$savedRev = $updater->saveRevision( CommentStoreComment::newUnsavedComment( 'Ordinary main update' ) );

		// Save succeeds; new revision committed; parent advances
		$this->assertNotNull( $savedRev );
		$this->assertTrue( $updater->wasSuccessful() );
		$this->assertSame( $initialId, $savedRev->getParentId() );
		$this->assertGreaterThan( $initialId, $savedRev->getId() );
		$this->assertSame( 'Updated wikitext content', $savedRev->getContent( SlotRecord::MAIN )->getText() );

		// Inherited layers slot retains exact identical stored bytes and model without re-resolving sources
		$this->assertTrue( $savedRev->hasSlot( PageRevisionWriter::SLOT ) );
		$inheritedContent = $savedRev->getContent( PageRevisionWriter::SLOT );
		$this->assertSame( LayersDocumentContent::MODEL, $inheritedContent->getModel() );
		$this->assertSame( $initialStoredBytes, $inheritedContent->serialize() );

		// Negative test: an attempt to publish/mutate Layers when resolver is unavailable must fail before the hook
		$failingResolver = $this->createMock( SourceVersionResolver::class );
		$failingResolver->method( 'resolve' )
			->willThrowException( new \DomainException( 'Source resolver is unavailable' ) );

		$customPublisher = new PagePublicationService(
			$services->getWikiPageFactory(),
			new PageHistoryAccess( $services->getRevisionLookup() ),
			$failingResolver,
			new PageRevisionWriter(),
			$this->context
		);

		try {
			$customPublisher->publish(
				$page->getTitle(),
				$actor,
				$savedRev->getId(),
				$this->mixedSnapshot( 'Mutated snapshot attempt' ),
				'Mutation attempt'
			);
			$this->fail( 'Mutation with unavailable source resolver must fail before hook' );
		} catch ( PublicationException $e ) {
			// Failure happened before the hook during source validation in PagePublicationService
			$this->assertSame( 'layers-source-unavailable', $e->getMessage() );
		}

		// Assert no revision advance and unchanged content
		$latestRev = $services->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $savedRev->getId(), $latestRev->getId() );
		$this->assertSame( $initialStoredBytes, $latestRev->getContent( PageRevisionWriter::SLOT )->serialize() );

		// Restore standard test registration
		TestingAdmissionRegistration::install( $this, $this->context );
	}

	/**
	 * J25 (3): Concurrent winner after losing PageUpdater has captured its parent, with admission enabled.
	 * Admission hook matches captured parent, but core's CAS check rejects the save after the hook.
	 * Asserts winner and its Layers snapshot are preserved; loser creates no revision.
	 */
	public function testConcurrentWinnerAfterParentCaptureWithAdmissionEnabled(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$services = $this->getServiceContainer();
		$baseId = $page->getLatest();

		// Loser PageUpdater initialized and captures the parent revision as its CAS token
		$loserActor = $this->actor();
		$loserUpdater = $page->newPageUpdater( $loserActor );
		$capturedParent = $loserUpdater->grabParentRevision();
		$this->assertNotNull( $capturedParent );
		$this->assertSame( $baseId, $capturedParent->getId() );

		// Concurrent winner commits an intervening revision to the database
		$winnerSnapshot = $this->slideSnapshot( 'Winner Snapshot' );
		$winnerId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			$baseId,
			$winnerSnapshot,
			'Intervening winning publication'
		);
		$this->assertGreaterThan( $baseId, $winnerId );

		$winnerRev = $services->getRevisionLookup()->getRevisionById( $winnerId );
		$this->assertNotNull( $winnerRev );
		$winnerRawBytes = $winnerRev->getContent( PageRevisionWriter::SLOT )->serialize();

		// Loser enters admission scope matching baseId and attempts save
		$loserSnapshot = $this->slideSnapshot( 'Loser Snapshot' );
		$loserContent = new LayersDocumentContent( $loserSnapshot );
		$loserIntent = new PublicationAdmissionIntent(
			$loserActor,
			$loserActor->getUser(),
			$page->getId(),
			$page->getTitle()->getNamespace(),
			$page->getTitle()->getDBkey(),
			$baseId,
			PublicationAdmissionIntent::ACTION_ADD,
			PageRevisionWriter::SLOT,
			LayersDocumentContent::MODEL,
			$loserContent->getCanonicalText()
		);

		$loserUpdater->setContent( PageRevisionWriter::SLOT, $loserContent );

		$loserSavedRev = null;
		$this->context->executeInScope( $loserIntent, function () use ( $loserUpdater, &$loserSavedRev ) {
			$loserSavedRev = $loserUpdater->saveRevision(
				CommentStoreComment::newUnsavedComment( 'Loser save attempt' )
			);
			$this->assertTrue( $this->context->isConsumed(), 'Admission ran before the CAS failure' );
		} );

		// Failure occurred AFTER the hook: hook passed parent check, but core PageUpdater CAS failed with edit-conflict
		$this->assertNull( $loserSavedRev );
		$this->assertFalse( $loserUpdater->wasSuccessful() );
		$this->assertTrue(
			$loserUpdater->getStatus()->hasMessage( 'edit-conflict' ),
			'Failure must occur after hook in PageUpdater CAS with edit-conflict'
		);

		// Assert winner's revision and snapshot are preserved intact; loser created no revision
		$latestRev = $services->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $winnerId, $latestRev->getId() );
		$this->assertSame(
			LayersDocumentContent::MODEL,
			$latestRev->getContent( PageRevisionWriter::SLOT )->getModel()
		);
		$this->assertSame( $winnerRawBytes, $latestRev->getContent( PageRevisionWriter::SLOT )->serialize() );

		// Scope was consumed/cleaned up; subsequent replay without scope fails closed at hook
		$this->assertFalse( $this->context->hasActiveScope() );

		$replayUpdater = $page->newPageUpdater( $loserActor );
		$replayUpdater->setContent( PageRevisionWriter::SLOT, $loserContent );
		$replayRev = $replayUpdater->saveRevision( CommentStoreComment::newUnsavedComment( 'Replay attempt' ) );
		$this->assertNull( $replayRev );
		$this->assertTrue(
			$replayUpdater->getStatus()->hasMessage( 'layers-admission-unauthorized' ),
			'Replay after failed CAS must fail closed at hook'
		);
	}

	/**
	 * J25 (4): No-op scope cleanup followed by a denied out-of-scope mutation.
	 * Publication identical to parent is a no-op; scope is cleaned up; subsequent direct mutation is denied.
	 */
	public function testNoOpScopeCleanupFollowedByDeniedMutation(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$services = $this->getServiceContainer();

		$initialSnapshot = $this->slideSnapshot( 'Initial Snapshot' );
		$initialMainText = 'Initial wikitext content';

		$initialId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			$page->getLatest(),
			$initialSnapshot,
			'Initial publication',
			new WikitextContent( $initialMainText )
		);
		$this->assertGreaterThan( 0, $initialId );

		$initialRev = $services->getRevisionLookup()->getRevisionById( $initialId );
		$initialLayersBytes = $initialRev->getContent( PageRevisionWriter::SLOT )->serialize();

		// Perform a no-op publication (identical snapshot and identical main text against same base)
		$noOpId = $this->publisher->publish(
			$page->getTitle(),
			$actor,
			$initialId,
			$initialSnapshot,
			'No-op publication attempt',
			new WikitextContent( $initialMainText )
		);

		// No revision ID advance
		$this->assertSame( $initialId, $noOpId );
		$this->assertSame( $initialId, $page->getTitle()->getLatestRevID() );

		// Scope was cleaned up on no-op completion
		$this->assertFalse( $this->context->hasActiveScope() );

		// Content unchanged in database
		$currentRev = $services->getRevisionLookup()->getRevisionById( $initialId );
		$this->assertSame( $initialLayersBytes, $currentRev->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame( $initialMainText, $currentRev->getContent( SlotRecord::MAIN )->getText() );

		// Direct out-of-scope mutation (add/replace) without scope must be denied at hook boundary
		$freshPage = $services->getWikiPageFactory()->newFromTitle( $page->getTitle() );
		$directUpdater = $freshPage->newPageUpdater( $actor );
		$directUpdater->setContent(
			PageRevisionWriter::SLOT,
			new LayersDocumentContent( $this->slideSnapshot( 'Denied out-of-scope mutation' ) )
		);
		$deniedRev = $directUpdater->saveRevision(
			CommentStoreComment::newUnsavedComment( 'Direct mutation after no-op' )
		);
		$this->assertNull( $deniedRev );
		$this->assertFalse( $directUpdater->wasSuccessful() );
		$this->assertTrue(
			$directUpdater->getStatus()->hasMessage( 'layers-admission-unauthorized' ),
			'Direct mutation must fail at hook with layers-admission-unauthorized'
		);

		// Direct out-of-scope slot removal must be denied at hook boundary
		$removePage = $services->getWikiPageFactory()->newFromTitle( $page->getTitle() );
		$removeUpdater = $removePage->newPageUpdater( $actor );
		$removeUpdater->removeSlot( PageRevisionWriter::SLOT );
		$deniedRemoveRev = $removeUpdater->saveRevision(
			CommentStoreComment::newUnsavedComment( 'Direct removal after no-op' )
		);
		$this->assertNull( $deniedRemoveRev );
		$this->assertFalse( $removeUpdater->wasSuccessful() );
		$this->assertTrue(
			$removeUpdater->getStatus()->hasMessage( 'layers-slot-removal-denied' ),
			'Direct slot removal must fail at hook with layers-slot-removal-denied'
		);

		// Database state completely unchanged
		$finalRev = $services->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $initialId, $finalRev->getId() );
		$this->assertTrue( $finalRev->hasSlot( PageRevisionWriter::SLOT ) );
		$this->assertSame( $initialLayersBytes, $finalRev->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame(
			LayersDocumentContent::MODEL,
			$finalRev->getContent( PageRevisionWriter::SLOT )->getModel()
		);
		$this->assertSame( $initialMainText, $finalRev->getContent( SlotRecord::MAIN )->getText() );
	}

	/** Core transforms main text once; admission binds the resulting bytes. */
	public function testPreparedMainSubstitutionAndSignaturePublishAtomically(): void {
		$page = $this->getNonexistingTestPage();
		$actor = $this->actor();
		$passes = 0;
		$this->setTemporaryHook( 'ParserPreSaveTransformComplete',
			static function ( $parser, &$text ) use ( &$passes ) {
				$passes++;
				return true;
			} );
		$id = $this->publisher->publish( $page->getTitle(), $actor, 0,
			$this->slideSnapshot( 'Prepared main' ), 'Publish transformed text',
			new WikitextContent( '{{subst:FULLPAGENAME}} ~~~~' ) );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$text = $revision->getContent( SlotRecord::MAIN )->serialize();
		$this->assertSame( 1, $passes, 'Do not execute core PST twice' );
		$this->assertStringContainsString( $page->getTitle()->getPrefixedText(), $text );
		$this->assertStringNotContainsString( '{{subst:', $text );
		$this->assertStringNotContainsString( '~~~~', $text );
		$this->assertStringContainsString( $actor->getUser()->getName(), $text );
		$this->assertSame( 0, $revision->getParentId() );
		$this->assertSame( 'Prepared main', json_decode(
			$revision->getContent( PageRevisionWriter::SLOT )->serialize(), true
		)['surfaces'][0]['label'] );
		$this->assertFalse( $this->context->hasActiveScope() );
	}

	/** Preparation callbacks must not carry stale permissions into publication. */
	public function testPermissionRevokedDuringMainPreparationPreventsPublication(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$base = $page->getLatest();
		$this->setTemporaryHook( 'ParserPreSaveTransformComplete', function ( $parser, &$text ) use ( $actor ) {
			$this->overrideUserPermissions( $actor->getUser(), [ 'read' ] );
			return true;
		} );
		try {
			$this->publisher->publish( $page->getTitle(), $actor, $base,
				$this->slideSnapshot(), 'Denied after preparation', new WikitextContent( '{{subst:FULLPAGENAME}}' ) );
			$this->fail( 'Revoked authority must not publish prepared text' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-owner-edit-denied', $e->getMessage() );
		}
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $base, $current->getId() );
		$this->assertFalse( $current->hasSlot( PageRevisionWriter::SLOT ) );
		$this->assertFalse( $this->context->hasActiveScope() );
	}

	/** A later proposed-main mutation cannot borrow the prepared publication scope. */
	public function testPreparedMainTamperingIsDenied(): void {
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$base = $page->getLatest();
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$before = $lookup->getRevisionById( $base )->getContent( SlotRecord::MAIN )->serialize();
		$this->setTemporaryHook( 'MultiContentSave', function ( $rendered, $user, $summary, $flags, $status ) {
			$rendered->getRevision()->setContent( SlotRecord::MAIN, new WikitextContent( 'Unrelated replacement' ) );
			return $this->hooks->onMultiContentSave( $rendered, $user, $summary, $flags, $status );
		}, true );
		try {
			$this->publisher->publish( $page->getTitle(), $actor, $base,
				$this->slideSnapshot(), 'Must reject altered prepared main',
				new WikitextContent( '{{subst:FULLPAGENAME}} ~~~~' ) );
			$this->fail( 'Prepared main tampering must be denied' );
		} catch ( PublicationException $e ) {
			$this->assertSame( 'layers-admission-unauthorized', $e->getMessage() );
		}
		$current = $lookup->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $base, $current->getId() );
		$this->assertSame( $before, $current->getContent( SlotRecord::MAIN )->serialize() );
		$this->assertFalse( $current->hasSlot( PageRevisionWriter::SLOT ) );
		$this->assertFalse( $this->context->hasActiveScope() );
	}

}
