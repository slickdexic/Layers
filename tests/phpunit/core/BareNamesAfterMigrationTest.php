<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Hooks\BoundSlideHooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Once the migration has finished, bare set and slide names mean the page's own drawings.
 * @covers \MediaWiki\Extension\Layers\Migration\MigrationState
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\SlideHooks
 * @covers \MediaWiki\Extension\Layers\Hooks\BoundSlideHooks
 * @group Database
 * @group API
 */
class BareNamesAfterMigrationTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
		MigrationState::clear( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	/**
	 * A page shown shared sets through a template, migrated: it owns copies named as the template names them.
	 * @return Title
	 */
	private function migratedTemplatePage(): Title {
		$image = $this->upload( 'Bare_photo.png' );
		$this->saveSet( $image, 'anatomy', 1, 'Heart' );
		$this->saveSlide( 'Bare_slide', 'default', 'Slide text' );
		$files = $this->pilot->newFilePageMigration();
		$files->commit( $files->plan( $image->getName(), $this->actor ), $this->actor );
		$this->editPage( Title::newFromText( 'Template:Bare frame' ),
			"[[File:Bare_photo.png|layerset=anatomy]]\n[[File:Bare_photo.png|layerset=on]]\n" .
			"[[File:Bare_photo.png|layerset=missing]]\n{{#Slide:Bare_slide}}", '', NS_MAIN, $this->actor );
		$page = Title::newFromText( 'Bare names page' );
		$this->editPage( $page, '{{Bare frame}}', '', NS_MAIN, $this->actor );
		$this->getDb()->newDeleteQueryBuilder()->deleteFrom( 'page_props' )
			->where( [ 'pp_page' => $page->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY ] )
			->caller( __METHOD__ )->execute();
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [
			'pp_page' => $page->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY,
			'pp_value' => '[["file","Bare_photo.png","anatomy"],["slide","Bare_slide",""]]'
		] )->caller( __METHOD__ )->execute();
		$copies = $this->pilot->newPageCopyMigration();
		$plan = $copies->plan( $page->getArticleID(), $this->actor );
		$this->assertSame( [ 'anatomy', 'Bare_slide' ], array_column( $plan['copies'], 'name' ) );
		$copies->commit( $plan, $this->actor );
		return $page;
	}

	/**
	 * @param Title $page
	 * @return ParserOutput
	 */
	private function parse( Title $page ): ParserOutput {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page );
		return $this->getServiceContainer()->getParserFactory()->create()->parse(
			$revision->getContent( 'main' )->getText(), $page, ParserOptions::newFromAnon(), true, true,
			$revision->getId() );
	}

	public function testBareNamesShowTheSharedSetsUntilTheMigrationIsRecorded(): void {
		$page = $this->migratedTemplatePage();
		$this->assertNull( ParserOptions::newFromAnon()->getOption( MigrationState::PARSER_OPTION ) );
		$this->assertStringNotContainsString( MigrationState::PARSER_OPTION,
			ParserOptions::newFromAnon()->optionsHash( [ MigrationState::PARSER_OPTION ] ) );
		$this->assertNull( $this->parse( $page )->getExtensionData( BoundSlideHooks::DATA_KEY ) );
	}

	public function testAfterTheMigrationBareNamesMeanThePagesOwnDrawings(): void {
		$page = $this->migratedTemplatePage();
		MigrationState::markComplete( $this->getDb() );
		$options = ParserOptions::newFromAnon();
		$this->assertTrue( $options->getOption( MigrationState::PARSER_OPTION ) );
		$this->assertStringContainsString( MigrationState::PARSER_OPTION . '=1',
			$options->optionsHash( [ MigrationState::PARSER_OPTION ] ) );

		$output = $this->parse( $page );
		$surfaces = $this->surfaces( $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page ) );
		$ids = array_column( $surfaces, 'id', 'label' );
		$bound = array_keys( $output->getExtensionData( BoundSlideHooks::DATA_KEY ) ?? [] );
		$this->assertEqualsCanonicalizing( [ 'v1:' . $page->getArticleID() . ':' . $ids['anatomy'],
			'v1:' . $page->getArticleID() . ':' . $ids['Bare_slide'] ], $bound,
			'the named set and `on` find the one drawing of the file, the slide its own drawing' );
		$this->assertSame( 2, substr_count( $output->getRawText(),
			'data-layers-binding="v1:' . $page->getArticleID() . ':' . $ids['anatomy'] . '"' ) );
		// "missing" names a drawing the page does not have: nothing is shown, and editors may create it.
		$this->assertTrue( $output->getExtensionData( BoundSlideHooks::CREATABLE_KEY ) );
		$this->assertNull( $output->getExtensionData( BoundSlideHooks::ADOPTABLE_KEY ) );
	}

	public function testSharedSetsCannotBeChangedAfterTheMigration(): void {
		$image = $this->upload( 'Frozen_photo.png' );
		MigrationState::markComplete( $this->getDb() );
		$this->expectApiErrorCode( 'migrated' );
		$this->doApiRequestWithToken( [ 'action' => 'layerssave', 'filename' => $image->getName(),
			'data' => '[]', 'setname' => 'anatomy' ], null, $this->actor );
	}
}
