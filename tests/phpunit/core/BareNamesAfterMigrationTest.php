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

	public function testATemplateShowingTwoFilesSetsOfOneNameFindsEachFilesCopy(): void {
		$files = $this->pilot->newFilePageMigration();
		foreach ( [ 'Row_one.png', 'Row_two.png' ] as $name ) {
			$file = $this->upload( $name );
			$this->saveSet( $file, 'default', 1, $name );
			$files->commit( $files->plan( $file->getName(), $this->actor ), $this->actor );
		}
		$this->editPage( Title::newFromText( 'Template:Row' ), '[[File:{{{1}}}|layerset=default]]', '', NS_MAIN,
			$this->actor );
		$page = Title::newFromText( 'Rows page' );
		$this->editPage( $page, "{{Row|Row_one.png}}\n{{Row|Row_two.png}}", '', NS_MAIN, $this->actor );
		$this->getDb()->newDeleteQueryBuilder()->deleteFrom( 'page_props' )
			->where( [ 'pp_page' => $page->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY ] )
			->caller( __METHOD__ )->execute();
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [
			'pp_page' => $page->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY,
			'pp_value' => '[["file","Row_one.png","default"],["file","Row_two.png","default"]]'
		] )->caller( __METHOD__ )->execute();
		$copies = $this->pilot->newPageCopyMigration();
		$plan = $copies->plan( $page->getArticleID(), $this->actor );
		$this->assertSame( [ [ 'default', true ], [ 'default 2', true ] ],
			array_map( static fn ( $c ) => [ $c['name'], $c['template'] ], $plan['copies'] ) );
		$this->assertSame( [], $plan['notMoved'] );
		$copies->commit( $plan, $this->actor );

		MigrationState::markComplete( $this->getDb() );
		$surfaces = $this->surfaces( $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page ) );
		$ids = array_column( $surfaces, 'id', 'label' );
		$this->assertEqualsCanonicalizing( [ 'v1:' . $page->getArticleID() . ':' . $ids['default'],
			'v1:' . $page->getArticleID() . ':' . $ids['default 2'] ],
			array_keys( $this->parse( $page )->getExtensionData( BoundSlideHooks::DATA_KEY ) ?? [] ) );
	}

	public function testEditLinksAndRenamesUnderstandBareNamesAfterTheMigration(): void {
		$page = Title::newFromText( 'Bare links page' );
		$this->editPage( $page, "Intro\n{{#Slide:Deck}}", '', NS_MAIN, $this->actor );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionByTitle( $page )->getId();
		$this->assertSame( [], $this->pilot->listBoundEditorSelections( $page->getArticleID(), $base, $this->actor ),
			'before the migration a bare name is a shared slide' );

		MigrationState::markComplete( $this->getDb() );
		$this->assertSame( [ [ 'Deck', true ] ], array_map( static fn ( $s ) => [ $s['label'], $s['create'] ?? false ],
			$this->pilot->listBoundEditorSelections( $page->getArticleID(), $base, $this->actor ) ) );

		$slide = static fn ( string $label ) => json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ [
			'id' => 'deck', 'kind' => 'slide', 'label' => $label, 'layers' => [],
			'canvas' => [ 'width' => 800, 'height' => 600, 'backgroundColor' => '#ffffff',
				'backgroundVisible' => true, 'backgroundOpacity' => 1 ] ] ] ] );
		$first = $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => $page->getPrefixedText(),
			'baserevid' => $base, 'data' => $slide( 'Deck' ) ], null, $this->actor )[0]['layerspublish']['revid'];
		$this->assertSame( [ [ 'Deck', false ] ], array_map( static fn ( $s ) => [ $s['label'], $s['create'] ?? false ],
			$this->pilot->listBoundEditorSelections( $page->getArticleID(), $first, $this->actor ) ) );

		$renamed = $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => $page->getPrefixedText(),
			'baserevid' => $first, 'data' => $slide( 'Deck two' ) ], null, $this->actor )[0]['layerspublish']['revid'];
		$this->assertSame( "Intro\n{{#Slide:" . $page->getArticleID() . ':Deck two}}',
			$lookup->getRevisionById( $renamed )->getContent( 'main' )->getText() );
	}

	public function testSharedSetsCannotBeChangedAfterTheMigration(): void {
		$siteinfo = [ 'action' => 'query', 'meta' => 'siteinfo', 'siprop' => 'general' ];
		$this->assertFalse( $this->doApiRequest( $siteinfo )[0]['query']['general']['layerspagehistorymigrated'] );
		$image = $this->upload( 'Frozen_photo.png' );
		MigrationState::markComplete( $this->getDb() );
		$this->assertTrue( $this->doApiRequest( $siteinfo )[0]['query']['general']['layerspagehistorymigrated'] );
		$this->expectApiErrorCode( 'migrated' );
		$this->doApiRequestWithToken( [ 'action' => 'layerssave', 'filename' => $image->getName(),
			'data' => '[]', 'setname' => 'anatomy' ], null, $this->actor );
	}

	public function testGalleriesAreMigratedAndThenShowThePagesOwnDrawings(): void {
		$files = $this->pilot->newFilePageMigration();
		$one = $this->upload( 'Gallery_one.png' );
		$this->saveSet( $one, 'anatomy', 1, 'Heart' );
		$two = $this->upload( 'Gallery_two.png' );
		$this->saveSet( $two, 'labels', 1, 'Latest' );
		$this->upload( 'Gallery_three.png' );
		foreach ( [ $one, $two ] as $file ) {
			$files->commit( $files->plan( $file->getName(), $this->actor ), $this->actor );
		}
		$page = Title::newFromText( 'Gallery page' );
		$this->editPage( $page, "<gallery>\nFile:Gallery_one.png|layerset=anatomy|One\n" .
			"File:Gallery_two.png|Two\nFile:Gallery_three.png|Three\n</gallery>", '', NS_MAIN, $this->actor );

		// Before the migration a gallery shows shared sets, and the page records them as file embeds do.
		$before = $this->parse( $page );
		$this->assertSame( 2, substr_count( $before->getRawText(), 'data-layer-data=' ) );
		$this->assertStringNotContainsString( '|layerset=', $before->getRawText() );
		$shown = $before->getPageProperty( ShownLayerSets::PROPERTY );
		$this->assertSame( [ [ 'file', 'Gallery_one.png', 'anatomy' ], [ 'file', 'Gallery_two.png', '' ] ],
			ShownLayerSets::decode( $shown ) );
		$this->getDb()->newDeleteQueryBuilder()->deleteFrom( 'page_props' )
			->where( [ 'pp_page' => $page->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY ] )
			->caller( __METHOD__ )->execute();
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [
			'pp_page' => $page->getArticleID(), 'pp_propname' => ShownLayerSets::PROPERTY, 'pp_value' => $shown
		] )->caller( __METHOD__ )->execute();

		// The latest set becomes the page's only drawing of that file, so the unnamed gallery image finds it.
		$copies = $this->pilot->newPageCopyMigration();
		$plan = $copies->plan( $page->getArticleID(), $this->actor );
		$this->assertSame( [ [ 'anatomy', true ], [ 'labels', true ] ],
			array_map( static fn ( $c ) => [ $c['name'], $c['template'] ], $plan['copies'] ) );
		$this->assertSame( [], $plan['notMoved'] );
		$this->assertNull( $plan['main'], 'gallery lines keep their text' );
		$copies->commit( $plan, $this->actor );

		MigrationState::markComplete( $this->getDb() );
		$after = $this->parse( $page );
		$ids = array_column( $this->surfaces(
			$this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle( $page ) ), 'id', 'label' );
		$this->assertEqualsCanonicalizing( [ 'v1:' . $page->getArticleID() . ':' . $ids['anatomy'],
			'v1:' . $page->getArticleID() . ':' . $ids['labels'] ],
			array_keys( $after->getExtensionData( BoundSlideHooks::DATA_KEY ) ?? [] ) );
		$this->assertSame( 2, substr_count( $after->getRawText(), 'data-layers-binding=' ) );
		$this->assertStringNotContainsString( 'data-layer-data=', $after->getRawText(), 'never a shared set' );
	}

	public function testImagesOutsideAParseShowNoSharedSetAfterTheMigration(): void {
		$image = $this->upload( 'Category_photo.png' );
		$this->saveSet( $image, 'anatomy', 1, 'Heart' );
		$thumb = $image->transform( [ 'width' => 100 ] );
		$render = static function () use ( $thumb ): array {
			$attribs = [];
			$link = [];
			\MediaWiki\Extension\Layers\Hooks\WikitextHooks::onThumbnailBeforeProduceHTML( $thumb, $attribs, $link );
			return $attribs;
		};
		$this->assertArrayHasKey( 'data-layer-data', $render(), 'a category gallery shows the latest set' );
		MigrationState::markComplete( $this->getDb() );
		$this->assertSame( [], $render() );
	}
}
