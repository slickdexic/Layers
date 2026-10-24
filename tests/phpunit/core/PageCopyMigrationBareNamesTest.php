<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\FilePageMigration;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\FileRepo\File\LocalFile;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * The native migration emits owner-local names while retaining existing internal defaults.
 * @covers \MediaWiki\Extension\Layers\Migration\PageCopyMigration
 * @group Database
 */
class PageCopyMigrationBareNamesTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
	}

	private function stepOne( LocalFile $file ): void {
		$migration = $this->pilot->newFilePageMigration();
		$this->assertNotNull( $migration->commit( $migration->plan( $file->getName(), $this->actor ), $this->actor ) );
	}

	private function owner( string $text ): Title {
		$title = $this->getExistingTestPage()->getTitle();
		$this->assertStatusGood( $this->editPage( $title, $text, '', NS_MAIN, $this->actor ) );
		return $title;
	}

	public function testExistingBareImageAndSlideBytesStayExact(): void {
		$file = $this->upload( 'Bare_owner_' . wfRandomString() . '.png' );
		$this->saveSet( $file, 'ABC', 1, 'Image payload' );
		$this->saveSlide( 'ABC', 'default', 'Independent slide payload' );
		$this->stepOne( $file );
		$text = '[[File:' . $file->getName() . '|thumb|layers = ABC |Caption]]' . "\n{{#Slide:ABC|width=300}}";
		$title = $this->owner( $text );
		$migration = $this->pilot->newPageCopyMigration( true );
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertNull( $plan['main'], 'Already-correct author syntax needs no rewrite' );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$migration->commit( $plan, $this->actor ) );
		$this->assertSame( $text, $revision->getContent( 'main' )->getText() );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( $this->surfaces( $revision ), 'label' ) );
	}

	public function testWholePdfKeepsOneNameAndBothPages(): void {
		$file = $this->upload( 'Bare_pdf_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$this->saveSet( $file, 'ABC', 1, 'First member', 1 );
		$this->saveSet( $file, 'ABC', 1, 'Second member', 2 );
		$this->stepOne( $file );
		$text = '[[File:' . $file->getName() . '|page=2|layerset=ABC]]';
		$title = $this->owner( $text );
		$migration = $this->pilot->newPageCopyMigration( true );
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertNull( $plan['main'] );
		$surfaces = json_decode( $plan['document'], true )['surfaces'];
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( $surfaces, 'label' ) );
		$this->assertSame( [ 1, 2 ], array_column( array_column( $surfaces, 'source' ), 'page' ) );
		$this->assertSame( [ 'First member', 'Second member' ],
			array_map( static fn ( $surface ) => $surface['layers'][0]['text'], $surfaces ) );
	}

	public function testDefaultIntentStaysButOtherLatestSetBecomesItsName(): void {
		$default = $this->upload( 'Bare_default_' . wfRandomString() . '.png' );
		$named = $this->upload( 'Bare_latest_' . wfRandomString() . '.png' );
		$this->saveSet( $default, 'Default', 1, 'Default payload' );
		$this->saveSet( $named, 'ABC', 1, 'Latest named payload' );
		$this->stepOne( $default );
		$this->stepOne( $named );
		$first = '[[File:' . $default->getName() . '|layerset=on|Default caption]]';
		$second = '[[File:' . $named->getName() . '|layers=on|Named caption]]';
		$title = $this->owner( $first . "\n" . $second );
		$plan = $this->pilot->newPageCopyMigration( true )->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( $first . "\n" . str_replace( 'layers=on', 'layerset=ABC', $second ), $plan['main'] );
	}

	public function testMultipleSlideSetsUseApprovedBareNames(): void {
		$this->saveSlide( 'Deck', 'intro', 'Intro payload' );
		$this->saveSlide( 'Deck', 'outro', 'Outro payload' );
		$title = $this->owner( "{{#Slide:Deck|layerset=intro|width=300}}\n{{#Slide:Deck|layerset=outro}}" );
		$plan = $this->pilot->newPageCopyMigration( true )->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertSame( "{{#Slide:Deck (intro)|width=300}}\n{{#Slide:Deck (outro)}}", $plan['main'] );
	}

	public function testUnsafeBareNameRefusesWithoutPublishing(): void {
		$file = $this->upload( 'Bare_refusal_' . wfRandomString() . '.png' );
		$this->saveSet( $file, 'on', 1, 'Retained historical literal name' );
		$this->stepOne( $file );
		$title = $this->owner( '[[File:' . $file->getName() . '|layers=on]]' );
		$base = $title->getLatestRevID();
		$migration = $this->pilot->newPageCopyMigration( true );
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertSame( 'embed-not-rewritable', $plan['problem'] );
		$this->assertNull( $migration->commit( $plan, $this->actor ) );
		$this->assertSame( $base, $title->getLatestRevID() );
	}

	/** @dataProvider provideTemplateNames @param string $name */
	public function testTemplateShowIntentPreservesItsPostMigrationIdentity( string $name ): void {
		$file = $this->upload( 'Bare_template_' . wfRandomString() . '.pdf', 'test-multipage.pdf' );
		$this->saveSet( $file, $name, 1, 'First template member', 1 );
		$second = $this->saveSet( $file, $name, 1, 'Second template member', 2 );
		$this->stepOne( $file );
		$template = Title::makeTitle( NS_TEMPLATE, 'Bare_template_' . wfRandomString() );
		$named = '[[File:' . $file->getName() . '|thumb|page=2|layerset=' . $name . ']]';
		$templateText = $named . "\n" . str_replace( 'layerset=' . $name, 'layerset=on', $named );
		$this->assertStatusGood( $this->editPage( $template, $templateText, '', NS_MAIN, $this->actor ) );
		$title = $this->owner( '{{' . $template->getText() . '}}' );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $title )->getId();
		$templateBase = $lookup->getRevisionByTitle( $template )->getId();
		$migration = $this->pilot->newPageCopyMigration( true );
		$plan = $migration->plan( $title->getArticleID(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$this->assertNull( $plan['main'], 'Shared template text is never rewritten on its host' );
		if ( $name !== 'Default' ) {
			$this->assertContains( 'template-latest-set', array_column( $plan['notMoved'], 'reason' ) );
			$this->assertSame( [], $plan['copies'] );
			$this->assertNull( $plan['document'] );
			$this->assertNull( $migration->commit( $plan, $this->actor ) );
			$this->assertSame( $base, $lookup->getRevisionByTitle( $title )->getId() );
		} else {
			$this->assertSame( [], $plan['notMoved'] );
			$this->assertCount( 2, $plan['copies'] );
			$revision = $lookup->getRevisionById( $migration->commit( $plan, $this->actor ) );
			$this->assertSame( [ 'Default', 'Default' ], array_column( $this->surfaces( $revision ), 'label' ) );
			$options = ParserOptions::newFromAnon();
			$options->setOption( MigrationState::PARSER_OPTION, true );
			$output = $this->getServiceContainer()->getParserFactory()->create()->parse(
				$revision->getContent( 'main' )->getText(), $title, $options, true, true, $revision->getId() );
			$binding = 'data-layers-binding="v1:' . $title->getArticleID() . ':' .
				FilePageMigration::surfaceId( $second, $title->getArticleID() ) . '"';
			$this->assertSame( 2, substr_count( $output->getRawText(), $binding ) );
		}
		$this->assertSame( $templateBase, $lookup->getRevisionByTitle( $template )->getId() );
		$this->assertSame( $templateText,
			$lookup->getRevisionByTitle( $template )->getContent( 'main' )->getText() );
	}

	public static function provideTemplateNames(): array {
		return [ 'Default retains both occurrences' => [ 'Default' ],
			'other latest name must refuse' => [ 'ABC' ] ];
	}
}
