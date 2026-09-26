<?php

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\JsonContent;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;

/**
 * Requires MediaWiki's real database-isolated integration harness.
 * Never load through the extension's standalone stub bootstrap.
 *
 * @covers \MediaWiki\Extension\Layers\Revision\PageRevisionWriter
 * @group Database
 */
class PageRevisionWriterTest extends \MediaWikiIntegrationTestCase {
	use ExcludesInstalledPilot;

	protected function setUp(): void {
		parent::setUp();
		$this->excludeInstalledPilot();
		$this->getServiceContainer()->getSlotRoleRegistry()->defineRoleWithModel(
			PageRevisionWriter::SLOT, CONTENT_MODEL_JSON, [ 'display' => 'none' ], false
		);
	}

	protected function tearDown(): void {
		try {
			parent::tearDown();
		} finally {
			$this->installedPilotOverride = null;
		}
	}

	private function snapshot( string $text ): JsonContent {
		return new JsonContent( json_encode( [
			'schemaVersion' => 1,
			'surfaces' => [
				[ 'id' => 'slide', 'kind' => 'slide', 'text' => $text ],
				[ 'id' => 'image', 'kind' => 'image', 'text' => $text ],
				[ 'id' => 'pdf', 'kind' => 'pdf', 'page' => 2, 'text' => $text ]
			]
		] ) );
	}

	public function testRealRevisionHistoryAndRestoration(): void {
		$page = $this->getNonexistingTestPage();
		$user = $this->getTestUser()->getUser();
		$writer = new PageRevisionWriter();
		$first = $writer->save( $page->newPageUpdater( $user ), 0, $this->snapshot( 'Original' ),
			CommentStoreComment::newUnsavedComment( 'Create visual document' ),
			new WikitextContent( 'Owner page text' ) );
		$second = $writer->save( $page->newPageUpdater( $user ), $first->getId(),
			$this->snapshot( 'Changed' ), CommentStoreComment::newUnsavedComment( 'Change annotation' ) );
		$this->assertNotSame( $first->getId(), $second->getId() );
		$this->assertSame( $first->getId(), $second->getParentId() );
		$this->assertSame( 'Owner page text', $second->getContent( SlotRecord::MAIN )->getText() );
		$this->assertSame( 'Change annotation', $second->getComment()->text );
		$this->assertSame( $user->getId(), $second->getUser()->getId() );

		$historical = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $first->getId() );
		$oldContent = $historical->getContent( PageRevisionWriter::SLOT, RevisionRecord::FOR_THIS_USER, $user );
		$this->assertSame( 'Original', json_decode( $oldContent->getText(), true )['surfaces'][0]['text'] );
		$restored = $writer->save( $page->newPageUpdater( $user ), $second->getId(), $oldContent,
			CommentStoreComment::newUnsavedComment( 'Restore original content' ) );
		$this->assertSame( $second->getId(), $restored->getParentId() );
		$this->assertTrue( $oldContent->equals( $restored->getContent( PageRevisionWriter::SLOT ) ) );
		$this->assertSame( 'Changed', json_decode(
			$second->getContent( PageRevisionWriter::SLOT )->getText(), true )['surfaces'][0]['text'] );
	}

	public function testStaleBaseDoesNotOverwrite(): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$writer = new PageRevisionWriter();
		$this->expectException( \DomainException::class );
		$this->expectExceptionMessage( 'layers-edit-conflict' );
		$writer->save( $page->newPageUpdater( $user ), 0, $this->snapshot( 'Rejected' ),
			CommentStoreComment::newUnsavedComment( 'Must not save' ) );
	}

	public function testIdenticalSnapshotIsNoOp(): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$writer = new PageRevisionWriter();
		$content = $this->snapshot( 'Same' );
		$first = $writer->save( $page->newPageUpdater( $user ), $page->getLatest(), $content,
			CommentStoreComment::newUnsavedComment( 'First save' ) );
		$again = $writer->save( $page->newPageUpdater( $user ), $first->getId(), $content,
			CommentStoreComment::newUnsavedComment( 'No change' ) );
		$this->assertSame( $first->getId(), $again->getId() );
	}

	public function testConcurrentUpdateAfterParentCaptureFails(): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$writer = new PageRevisionWriter();
		$waiting = $page->newPageUpdater( $user );
		$base = $waiting->grabParentRevision()->getId();
		$winner = $writer->save( $page->newPageUpdater( $user ), $base, $this->snapshot( 'Winner' ),
			CommentStoreComment::newUnsavedComment( 'Concurrent winner' ) );
		try {
			$writer->save( $waiting, $base, $this->snapshot( 'Must not publish' ),
				CommentStoreComment::newUnsavedComment( 'Stale writer' ) );
			$this->fail( 'A write after the captured parent changed must fail.' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( 'layers-revision-save-failed', $e->getMessage() );
		}
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$this->assertSame( $winner->getId(), $current->getId() );
		$this->assertSame( json_decode( $this->snapshot( 'Winner' )->getText(), true ),
			json_decode( $current->getContent( PageRevisionWriter::SLOT )->getText(), true ) );
	}

	public function testMainAndLayersChangeInOneRevision(): void {
		$page = $this->getExistingTestPage();
		$user = $this->getTestUser()->getUser();
		$base = $page->getLatest();
		$revision = ( new PageRevisionWriter() )->save( $page->newPageUpdater( $user ), $base,
			$this->snapshot( 'Updated layers' ), CommentStoreComment::newUnsavedComment( 'Combined edit' ),
			new WikitextContent( 'Updated page text' ) );
		$this->assertSame( $base, $revision->getParentId() );
		$this->assertSame( 'Updated page text', $revision->getContent( SlotRecord::MAIN )->getText() );
		$this->assertSame( json_decode( $this->snapshot( 'Updated layers' )->getText(), true ),
			json_decode( $revision->getContent( PageRevisionWriter::SLOT )->getText(), true ) );
	}

	public function testNewPageCannotOmitMainContent(): void {
		$page = $this->getNonexistingTestPage();
		$this->expectException( \InvalidArgumentException::class );
		( new PageRevisionWriter() )->save( $page->newPageUpdater( $this->getTestUser()->getUser() ),
			0, $this->snapshot( 'Missing owner text' ), CommentStoreComment::newUnsavedComment( 'Rejected' ) );
	}

	public function testNegativeBaseRejected(): void {
		$page = $this->getExistingTestPage();
		$this->expectException( \InvalidArgumentException::class );
		( new PageRevisionWriter() )->save( $page->newPageUpdater( $this->getTestUser()->getUser() ),
			-1, $this->snapshot( 'Invalid base' ), CommentStoreComment::newUnsavedComment( 'Rejected' ) );
	}

}
