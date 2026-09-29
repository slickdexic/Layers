<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Step 3 of the D3 migration: a shared slide no page shows gets a page of its own.
 * @covers \MediaWiki\Extension\Layers\Migration\SlidePageMigration
 * @group Database
 */
class SlidePageMigrationTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	public function testAnUnshownSlideGetsAPageThatStep2ThenGivesItsDrawings(): void {
		$this->saveSlide( 'Lonely_deck', 'intro', 'Intro' );
		$this->saveSlide( 'Lonely_deck', 'outro', 'Outro' );
		$slides = $this->pilot->newSlidePageMigration();
		$this->assertContains( 'Lonely_deck', $slides->listSlides() );
		$this->assertSame( [], $slides->copiedSlides( [ 'Lonely_deck' ] ) );

		$plan = $slides->plan( 'Lonely_deck' );
		$this->assertSame( [ null, 'Slide:Lonely deck', [ 'intro', 'outro' ] ],
			[ $plan['problem'], $plan['title']->getPrefixedText(), $plan['sets'] ] );
		$this->assertFalse( $plan['title']->exists(), 'planning writes nothing' );
		$pageId = $slides->commit( $plan, $this->actor );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$created = $lookup->getRevisionByPageId( $pageId );
		$this->assertSame( "{{#Slide:Lonely_deck|layerset=intro}}\n{{#Slide:Lonely_deck|layerset=outro}}",
			$created->getContent( 'main' )->getText() );
		$this->assertSame( 'Created to keep shared slide “Lonely_deck”, which no page showed',
			$created->getComment()->text );

		$copies = $this->pilot->newPageCopyMigration();
		$copyPlan = $copies->plan( $pageId, $this->actor );
		$this->assertSame( [ 'Lonely_deck' ], array_values( array_unique( $copyPlan['slides'] ) ) );
		$revision = $lookup->getRevisionById( $copies->commit( $copyPlan, $this->actor ) );
		$this->assertSame( "{{#Slide:$pageId:Lonely_deck (intro)}}\n{{#Slide:$pageId:Lonely_deck (outro)}}",
			$revision->getContent( 'main' )->getText() );
		$this->assertSame( [ 'Intro', 'Outro' ], array_map( static fn ( $s ) => $s['layers'][0]['text'],
			$this->surfaces( $revision ) ) );
		$this->assertSame( [ 'Lonely_deck' => true ], $slides->copiedSlides( [ 'Lonely_deck' ] ) );
		$this->assertSame( 'title-taken', $slides->plan( 'Lonely_deck' )['problem'] );
	}

	public function testAnExistingPageIsNeverOverwritten(): void {
		$this->saveSlide( 'Taken_title', 'default', 'Text' );
		$this->editPage( Title::newFromText( 'Slide:Taken title' ), 'Someone\'s page', '', NS_MAIN, $this->actor );
		$plan = $this->pilot->newSlidePageMigration()->plan( 'Taken_title' );
		$this->assertSame( [ 'title-taken', null ], [ $plan['problem'], $plan['main'] ] );
		$this->assertNull( $this->pilot->newSlidePageMigration()->commit( $plan, $this->actor ) );
	}

	public function testPagePropertiesTellWhetherAPageShowsASlide(): void {
		$slides = $this->pilot->newSlidePageMigration();
		$this->assertFalse( $slides->shownByPageProperties( 'Prop_slide' ) );
		$page = $this->getExistingTestPage( 'Shows prop slide' );
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [ 'pp_page' => $page->getId(),
			'pp_propname' => 'layers-shown-sets', 'pp_value' => '[["slide","Prop_slide","intro"]]' ] )
			->caller( __METHOD__ )->execute();
		$this->assertTrue( $slides->shownByPageProperties( 'Prop_slide' ) );
		$this->assertFalse( $slides->shownByPageProperties( 'Prop' ) );
	}
}
