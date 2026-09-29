<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Undoing the D3 migration, and its completion record.
 * @covers \MediaWiki\Extension\Layers\Migration\MigrationUndo
 * @covers \MediaWiki\Extension\Layers\Migration\MigrationState
 * @group Database
 */
class MigrationUndoTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	public function testMigratedPagesGoBackAndCreatedPagesAreDeleted(): void {
		$image = $this->upload( 'Undo_photo.png' );
		$this->saveSet( $image, 'anatomy', 1, 'Heart' );
		$this->saveSlide( 'Undo_slide', 'default', 'Slide' );
		$text = "[[File:Undo_photo.png|layerset=anatomy]]\n{{#Slide:Undo_slide}}";
		$page = Title::newFromText( 'Undo migrated page' );
		$this->editPage( $page, $text, '', NS_MAIN, $this->actor );
		$before = $page->getLatestRevID();
		$fileBefore = $image->getTitle()->getLatestRevID();

		$files = $this->pilot->newFilePageMigration();
		$files->commit( $files->plan( $image->getName(), $this->actor ), $this->actor );
		$copies = $this->pilot->newPageCopyMigration();
		$copies->commit( $copies->plan( $page->getArticleID(), $this->actor ), $this->actor );
		$slides = $this->pilot->newSlidePageMigration();
		$this->saveSlide( 'Undo_lonely', 'default', 'Lonely' );
		$created = $slides->commit( $slides->plan( 'Undo_lonely' ), $this->actor );
		$copies->commit( $copies->plan( $created, $this->actor ), $this->actor );

		$undo = $this->pilot->newMigrationUndo();
		$this->assertEqualsCanonicalizing(
			[ $image->getTitle()->getArticleID(), $page->getArticleID(), $created ], $undo->pages() );

		$plan = $undo->plan( $page->getArticleID() );
		$this->assertSame( [ null, $before, 1 ],
			[ $plan['problem'], $plan['baseRevisionId'], count( $plan['revisions'] ) ] );
		$revisionId = $undo->commit( $plan, $this->actor );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$revision = $lookup->getRevisionById( $revisionId );
		$this->assertSame( $text, $revision->getContent( 'main' )->getText() );
		$this->assertSame( [], $this->surfaces( $revision ) );
		$this->assertSame( 'Undid the Layers migration (revision ' . $plan['revisions'][0] . ')',
			$revision->getComment()->text );
		$tags = $this->getServiceContainer()->getChangeTagsStore()->getTags( $this->getDb(), null, $revisionId );
		$this->assertContains( PagePublicationService::MIGRATION_UNDO_TAG, $tags );
		$this->assertNotContains( PagePublicationService::MIGRATION_TAG, $tags );
		$this->assertSame( 'already-undone', $undo->plan( $page->getArticleID() )['problem'] );

		$filePlan = $undo->plan( $image->getTitle()->getArticleID() );
		$this->assertSame( $fileBefore, $filePlan['baseRevisionId'] );
		$this->assertSame( [],
			$this->surfaces( $lookup->getRevisionById( $undo->commit( $filePlan, $this->actor ) ) ) );

		$createdPlan = $undo->plan( $created );
		$this->assertSame( [ 0, 2 ], [ $createdPlan['baseRevisionId'], count( $createdPlan['revisions'] ) ] );
		$this->assertSame( 0, $undo->commit( $createdPlan, $this->actor ) );
		$this->assertFalse( Title::newFromText( 'Slide:Undo lonely' )->exists( \IDBAccessObject::READ_LATEST ) );

		// Migrating again after an undo works, and can be undone again.
		$again = $copies->plan( $page->getArticleID(), $this->actor );
		$this->assertSame( 'file-not-migrated', $again['notMoved'][0]['reason'] ?? null );
		$files->commit( $files->plan( $image->getName(), $this->actor ), $this->actor );
		$again = $copies->plan( $page->getArticleID(), $this->actor );
		$this->assertCount( 2, $again['copies'] );
		$copies->commit( $again, $this->actor );
		$this->assertSame( $revisionId, $undo->plan( $page->getArticleID() )['baseRevisionId'] );
	}

	public function testAPageEditedSinceTheMigrationIsLeftAlone(): void {
		$this->saveSlide( 'Edited_slide', 'default', 'Slide' );
		$page = Title::newFromText( 'Undo edited page' );
		$this->editPage( $page, '{{#Slide:Edited_slide}}', '', NS_MAIN, $this->actor );
		$copies = $this->pilot->newPageCopyMigration();
		$copies->commit( $copies->plan( $page->getArticleID(), $this->actor ), $this->actor );
		$this->editPage( $page, 'Someone rewrote the page', '', NS_MAIN, $this->actor );
		$undo = $this->pilot->newMigrationUndo();
		$plan = $undo->plan( $page->getArticleID() );
		$this->assertSame( 'edited-since-migration', $plan['problem'] );
		$this->assertNull( $undo->commit( $plan, $this->actor ) );
		$never = $this->getExistingTestPage( 'Undo never migrated' );
		$this->assertSame( 'not-migrated', $undo->plan( $never->getId() )['problem'] );
	}

	public function testCompletionRecord(): void {
		$db = $this->getDb();
		MigrationState::clear( $db );
		$this->assertFalse( MigrationState::isComplete( $db ) );
		MigrationState::markComplete( $db );
		MigrationState::markComplete( $db );
		$this->assertTrue( MigrationState::isComplete( $db ) );
		MigrationState::clear( $db );
		$this->assertFalse( MigrationState::isComplete( $db ) );
	}
}
