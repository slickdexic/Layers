<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Step 2 of the D3 migration: pages that show shared sets and slides get their own copies.
 * @covers \MediaWiki\Extension\Layers\Migration\PageCopyMigration
 * @group Database
 */
class PageCopyMigrationTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	/**
	 * @param string $name
	 * @param string $text
	 * @return Title
	 */
	private function page( string $name, string $text ): Title {
		$title = Title::newFromText( $name );
		$this->assertStatusGood( $this->editPage( $title, $text, '', NS_MAIN, $this->actor ) );
		return $title;
	}

	/**
	 * @param Title $title
	 * @return RevisionRecord
	 */
	private function latest( Title $title ): RevisionRecord {
		return $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $title );
	}

	/**
	 * @param string $file
	 * @return int File: page revision after step 1
	 */
	private function stepOne( string $file ): int {
		$migration = $this->pilot->newFilePageMigration();
		return $migration->commit( $migration->plan( $file, $this->actor ), $this->actor );
	}

	public function testDirectEmbedsGetOneCopyPerSetAndNameIt(): void {
		$image = $this->upload( 'Copied_photo.png' );
		$anatomy = $this->saveSet( $image, 'anatomy', 1, 'Heart' );
		$labels = $this->saveSet( $image, 'labels', 1, 'Labels' );
		$pdf = $this->upload( 'Copied_notes.pdf', 'test-multipage.pdf' );
		$notes = $this->saveSet( $pdf, 'notes', 1, 'Second page', 2 );
		$imageRevision = $this->stepOne( $image->getName() );
		$pdfRevision = $this->stepOne( $pdf->getName() );
		$text = "A [[File:Copied_photo.png|thumb|layerset=anatomy|Heart]]\n" .
			"B [[File:Copied_photo.png|layerset=anatomy]]\n" .
			"C [[File:Copied_photo.png|layers=on]]\n" .
			"D [[File:Copied_photo.png|layerset=off]]\n" .
			"E [[File:Copied_photo.png|120px]]\n" .
			"F [[File:Copied_notes.pdf|page=2|layerset=notes]]";
		$title = $this->page( 'Migration copies', $text );
		$before = $this->latest( $title );
		$migration = $this->pilot->newPageCopyMigration();

		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( [
			[ 'anatomy', 'File:Copied photo.png', $imageRevision, 2 ],
			[ 'labels', 'File:Copied photo.png', $imageRevision, 1 ],
			[ 'notes', 'File:Copied notes.pdf', $pdfRevision, 1 ]
		], array_map( static fn ( $c ) => [ $c['name'], $c['source'], $c['sourceRevision'], $c['embeds'] ],
			$plan['copies'] ) );
		$this->assertSame( $before->getId(), $this->latest( $title )->getId(), 'planning writes nothing' );

		$revisionId = $migration->commit( $plan, $this->actor );
		$revision = $this->latest( $title );
		$this->assertSame( [ $revisionId, $before->getId() ], [ $revision->getId(), $revision->getParentId() ] );
		$id = $title->getArticleID();
		$this->assertSame( "A [[File:Copied_photo.png|thumb|layerset=$id:anatomy|Heart]]\n" .
			"B [[File:Copied_photo.png|layerset=$id:anatomy]]\n" .
			"C [[File:Copied_photo.png|layerset=$id:labels]]\n" .
			"D [[File:Copied_photo.png|layerset=off]]\n" .
			"E [[File:Copied_photo.png|120px]]\n" .
			"F [[File:Copied_notes.pdf|page=2|layerset=$id:notes]]",
			$revision->getContent( 'main' )->getText() );
		$this->assertSame( 'Copied 3 shared layer sets into this page: "anatomy" from [[:File:Copied photo.png]] ' .
			"(revision $imageRevision), \"labels\" from [[:File:Copied photo.png]] (revision $imageRevision), " .
			"\"notes\" from [[:File:Copied notes.pdf]] (revision $pdfRevision)",
			$revision->getComment()->text );
		$tags = $this->getServiceContainer()->getChangeTagsStore()->getTags( $this->getDb(), null, $revisionId );
		$this->assertContains( PagePublicationService::MIGRATION_TAG, $tags );

		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$source = $this->surfaces( $lookup->getRevisionById( $imageRevision ) );
		$copies = $this->surfaces( $revision );
		$this->assertSame( [ FilePageMigration::surfaceId( $anatomy, $id ),
			FilePageMigration::surfaceId( $labels, $id ),
			FilePageMigration::surfaceId( $notes, $id ) ], array_column( $copies, 'id' ) );
		$this->assertSame( [ $source[0]['layers'], $source[0]['source'] ],
			[ $copies[0]['layers'], $copies[0]['source'] ] );
		$this->assertSame( [ 'pdf', 2 ], [ $copies[2]['kind'], $copies[2]['source']['page'] ] );

		$again = $migration->plan( $id, $this->actor );
		$this->assertSame( [ [], null ], [ $again['copies'], $again['document'] ] );
		$this->assertNull( $migration->commit( $again, $this->actor ) );
	}

	public function testSlidesAreCopiedFromTheirRowsAndNamedAfterTheSlide(): void {
		$this->saveSlide( 'Welcome', 'default', 'Hello' );
		$intro = $this->saveSlide( 'Deck', 'intro', 'Intro' );
		$outro = $this->saveSlide( 'Deck', 'outro', 'Outro' );
		$title = $this->page( 'Migration slides',
			"{{#Slide:Welcome|size=300x200}}\n{{#slide:Deck|layerset=intro}}\n{{#Slide:Deck|layerset=outro}}" );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( [ [ 'Welcome', 'Welcome' ], [ 'Deck (intro)', 'Deck' ], [ 'Deck (outro)', 'Deck' ] ],
			array_map( static fn ( $c ) => [ $c['name'], $c['source'] ], $plan['copies'] ) );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$migration->commit( $plan, $this->actor ) );
		$id = $title->getArticleID();
		$this->assertSame(
			"{{#Slide:$id:Welcome|size=300x200}}\n{{#slide:$id:Deck (intro)}}\n{{#Slide:$id:Deck (outro)}}",
			$revision->getContent( 'main' )->getText() );
		$this->assertSame( 'Copied 3 shared layer sets into this page: "Welcome" from shared slide “Welcome”, ' .
			'"Deck (intro)" from shared slide “Deck”, "Deck (outro)" from shared slide “Deck”',
			$revision->getComment()->text );
		$copies = $this->surfaces( $revision );
		$this->assertSame( [ 'slide', 800, 'Intro' ], [ $copies[1]['kind'], $copies[1]['canvas']['width'],
			$copies[1]['layers'][0]['text'] ] );
		$this->assertSame( FilePageMigration::surfaceId( $outro, $id ), $copies[2]['id'] );
		$this->assertNotSame( FilePageMigration::surfaceId( $intro, $id ), $copies[2]['id'] );
	}

	public function testSetsShownThroughTemplatesAreCopiedUnderTheirOwnName(): void {
		$image = $this->upload( 'Templated_photo.png' );
		$this->saveSet( $image, 'anatomy', 1, 'Heart' );
		$this->saveSet( $image, 'labels', 1, 'Latest' );
		$this->stepOne( $image->getName() );
		$this->saveSlide( 'Templated', 'default', 'Slide' );
		$text = '{{Photo frame}}';
		$title = $this->page( 'Migration template', $text );
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [
			'pp_page' => $title->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY,
			'pp_value' => '[["file","Templated_photo.png","anatomy"],["file","Templated_photo.png",""],' .
				'["slide","Templated",""]]'
		] )->caller( __METHOD__ )->execute();
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( [ [ 'anatomy', true, 0 ], [ 'Templated', true, 0 ] ],
			array_map( static fn ( $c ) => [ $c['name'], $c['template'], $c['embeds'] ], $plan['copies'] ) );
		// "The latest set" cannot be named in advance; after the migration the template shows nothing there.
		$this->assertSame( [ [ 'what' => 'file Templated_photo.png', 'reason' => 'template-latest-set' ] ],
			$plan['notMoved'] );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$migration->commit( $plan, $this->actor ) );
		$this->assertSame( $text, $revision->getContent( 'main' )->getText() );
		$this->assertSame( [ 'anatomy', 'Templated' ], array_column( $this->surfaces( $revision ), 'label' ) );
	}

	public function testFilePageEmbeddingItsOwnSetOnlyNamesItsDrawing(): void {
		$image = $this->upload( 'Self_shown.png' );
		$this->saveSet( $image, 'anatomy', 1, 'Heart' );
		$this->editPage( $image->getTitle(), 'Shows [[File:Self_shown.png|layerset=anatomy]]', '', NS_MAIN,
			$this->actor );
		$this->stepOne( $image->getName() );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $image->getTitle()->getArticleID(), $this->actor );
		$this->assertSame( [ [], [ 'anatomy' ] ], [ $plan['copies'], $plan['done'] ] );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$migration->commit( $plan, $this->actor ) );
		$this->assertSame( 'Shows [[File:Self_shown.png|layerset=' . $image->getTitle()->getArticleID() . ':anatomy]]',
			$revision->getContent( 'main' )->getText() );
		$this->assertSame( "Pointed embeds at this page's own layer sets", $revision->getComment()->text );
		$this->assertCount( 1, $this->surfaces( $revision ) );
	}

	public function testUnmigratedFilesPinnedRevisionsAndOtherNamespacesAreListed(): void {
		$image = $this->upload( 'Not_yet.png' );
		$this->saveSet( $image, 'anatomy', 1, 'Heart' );
		$title = $this->page( 'Migration waits',
			"[[File:Not_yet.png|layerset=anatomy]]\n[[File:Not_yet.png|layerset=anatomy|layersetid=7]]" );
		$migration = $this->pilot->newPageCopyMigration();
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( [ 'file-not-migrated', 'pinned-revision' ], array_column( $plan['notMoved'], 'reason' ) );
		$this->assertNull( $plan['document'] );

		$project = Title::makeTitle( NS_PROJECT, 'Migration elsewhere' );
		$this->editPage( $project, '[[File:Not_yet.png|layerset=anatomy]]', '', NS_MAIN, $this->actor );
		$this->assertSame( 'namespace-not-enabled',
			$migration->plan( $project->getArticleID(), $this->actor )['problem'] );
	}

	public function testDryRunPlansAgainstStepOneAndListsWhatLegacyEmbedsDidNotShow(): void {
		$image = $this->upload( 'Dry_run.png' );
		$this->saveSet( $image, 'anatomy', 1, 'Heart' );
		$this->saveSlide( 'Valid_slide', 'default', 'Shown' );
		$this->page( 'Template:Dry frame', '[[File:Dry_run.png|layerset=anatomy]]' );
		$title = $this->page( 'Migration dry run', "{{Dry frame}}\n" .
			"[[File:Dry_run.png|layerset=missing]]\n{{#Slide:Valid slide}}\n{{#Slide:Valid_slide}}" );
		$migration = $this->pilot->newPageCopyMigration();

		$stepOne = $this->pilot->newFilePageMigration()->plan( $image->getName(), $this->actor );
		$asked = [];
		$plan = $migration->plan( $title->getArticleID(), $this->actor,
			static function ( string $file ) use ( $stepOne, &$asked ): ?string {
				$asked[] = $file;
				return $file === 'Dry_run.png' ? $stepOne['document'] : null;
			} );
		$this->assertContains( 'Dry_run.png', $asked );
		$this->assertSame( [ [ 'Valid_slide', null, false ], [ 'anatomy', null, true ] ],
			array_map( static fn ( $c ) => [ $c['name'], $c['sourceRevision'], $c['template'] ], $plan['copies'] ) );
		// The legacy parser refuses a slide name with spaces, and legacy embeds see only the current version.
		$this->assertSame( [
			[ 'what' => '[[File:Dry_run.png|layerset=missing]]', 'reason' => 'no-current-set' ],
			[ 'what' => '{{#Slide:Valid slide}}', 'reason' => 'invalid-slide-name' ]
		], $plan['notMoved'] );
		$this->assertSame( [ 'Valid_slide' ], $plan['slides'] );
		$this->assertStringContainsString( '{{#Slide:Valid slide}}', $plan['main'] );
		$this->assertFalse( $this->latest( $image->getTitle() )->hasSlot( 'layers' ), 'nothing written' );

		// Without step 1, the template's set is listed rather than skipped.
		$this->assertSame( [ 'no-current-set', 'invalid-slide-name', 'file-not-migrated' ],
			array_column( $migration->plan( $title->getArticleID(), $this->actor )['notMoved'], 'reason' ) );
	}
}
