<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Cargo\PageOwnedCargoStore;
use MediaWiki\MediaWikiServices;
use MediaWiki\Parser\Parser;
use MediaWiki\Parser\ParserOptions;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * {{#layers_cargo_store:}} projects the layer sets of the parsed revision into Cargo rows.
 * @covers \MediaWiki\Extension\Layers\Cargo\PageOwnedCargoStore
 * @group Database
 */
class PageOwnedCargoStoreTest extends MediaWikiIntegrationTestCase {
	/** @return array [ title, first revision, second revision ] */
	private function owner( ?object $document = null ): array {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null ] );
		$publisher = TestingAdmissionRegistration::install( $this )['publisher'];
		$editor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $editor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$document ??= json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$first = $publisher->publish( $title, $editor, 0, json_encode( $document ), 'First',
			new WikitextContent( '{{#layers_cargo_store:_table=Layers_test_drawings}}' ) );
		$document->surfaces[0]->layers[0]->text = "Valve = open\nCheck twice";
		$second = $publisher->publish( $title, $editor, $first, json_encode( $document ), 'Second' );
		return [ $title, $first, $second ];
	}

	private function rows( Title $title, int $revisionId ): array {
		return PageOwnedCargoStore::rows( $this->parserForRevision( $title, $revisionId ) );
	}

	private function parserForRevision( Title $title, int $revisionId ): Parser {
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$parser->startExternalParse( $title, ParserOptions::newFromAnon(), Parser::OT_HTML, true, $revisionId );
		return $parser;
	}

	public function testRowsDescribeEachStoredSurfaceOfTheParsedRevision(): void {
		[ $title, $first, $second ] = $this->owner();
		$this->assertSame( [ [ 'surface_id' => 'presentation', 'surface_label' => 'Welcome Slide',
			'surface_kind' => 'slide', 'source_file' => '', 'source_page' => '',
			'drawing_text' => 'Visual ideas — 世界' ] ], $this->rows( $title, $first ) );
		$this->assertSame( "Valve = open\nCheck twice", $this->rows( $title, $second )[0]['drawing_text'] );

		// Blank fields are passed too, so Cargo never fills them from the calling template's arguments.
		$fields = [ 'surface_id=presentation', 'surface_label=Welcome Slide', 'surface_kind=slide', 'source_file=',
			'source_page=', "drawing_text=Valve = open\nCheck twice" ];
		$this->assertSame( [ array_merge( [ '_table=Drawings' ], $fields ) ],
			PageOwnedCargoStore::storeArguments( 'Drawings', $this->rows( $title, $second ) ) );
		$this->assertSame( [ $fields ], PageOwnedCargoStore::storeArguments( '', $this->rows( $title, $second ) ) );

		// An ordinary parse shows nothing; Cargo itself decides when rows are written.
		$parsed = $this->getServiceContainer()->getParserFactory()->create()->parse(
			'{{#layers_cargo_store:_table=Layers_test_drawings}}', $title, ParserOptions::newFromAnon(), true, true,
			$second );
		$this->assertSame( '', trim( strip_tags( $parsed->getRawText() ) ) );
	}

	public function testRowsDuringSaveDescribeTheSavedRevision(): void {
		$this->markTestSkippedIfExtensionNotLoaded( 'Cargo' );
		$settings = \CargoStore::$settings;
		$parse = static function ( Title $title ): array {
			$parser = MediaWikiServices::getInstance()->getParserFactory()->create();
			$parser->startExternalParse( $title, ParserOptions::newFromAnon(), Parser::OT_HTML );
			return array_column( PageOwnedCargoStore::rows( $parser ), 'drawing_text' );
		};
		// After each save Cargo sets its origin and reparses the saved text with no revision ID, as done here.
		$seen = [];
		$this->setTemporaryHook( 'PageSaveComplete', static function ( $wikiPage ) use ( &$seen, $parse ) {
			\CargoStore::$settings['origin'] = 'page save';
			$seen[] = $parse( $wikiPage->getTitle() );
		}, false );
		try {
			[ $title ] = $this->owner();
			$this->assertSame( [ [ 'Visual ideas — 世界' ], [ "Valve = open\nCheck twice" ] ], $seen );
			// Any other parse without a revision ID is a preview and projects nothing.
			\CargoStore::$settings = [];
			$this->assertSame( [], $parse( $title ) );
		} finally {
			\CargoStore::$settings = $settings;
		}
	}

	public function testAnotherPageNeverProjectsThisPagesStoredSurfaces(): void {
		[ , , $second ] = $this->owner();
		$otherTitle = $this->getExistingTestPage()->getTitle();
		$this->assertSame( [], $this->rows( $otherTitle, $second ) );
		$this->assertSame( [], PageOwnedCargoStore::layerRows( $this->parserForRevision( $otherTitle, $second ) ) );
	}

	public function testLayerRowsProjectVisibleTextAndLinksWithoutChangingSetRows(): void {
		$document = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$document->surfaces[0]->layers = [
			(object)[ 'id' => 'text-layer', 'type' => 'textbox', 'x' => 10, 'y' => 10, 'width' => 100,
				'height' => 30, 'text' => 'Visible SOP text', 'fontSize' => 16, 'fontFamily' => 'Arial',
				'color' => '#000000' ],
			(object)[ 'id' => 'link-only', 'type' => 'rectangle', 'x' => 120, 'y' => 10, 'width' => 80,
				'height' => 40, 'stroke' => '#000000', 'strokeWidth' => 1, 'fill' => 'transparent',
				'link' => 'Operations/Intake#Procedure', 'visible' => false ],
			(object)[ 'id' => 'hidden-text', 'type' => 'textbox', 'x' => 10, 'y' => 60, 'width' => 100,
				'height' => 30, 'text' => 'Private hidden text', 'fontSize' => 16, 'fontFamily' => 'Arial',
				'color' => '#000000', 'visible' => false ],
			(object)[ 'id' => 'empty-layer', 'type' => 'rectangle', 'x' => 220, 'y' => 10, 'width' => 80,
				'height' => 40, 'stroke' => '#000000', 'strokeWidth' => 1, 'fill' => 'transparent' ],
		];
		$document->surfaces[0]->readingOrder = [ 'text-layer', 'link-only', 'hidden-text', 'empty-layer' ];
		[ $title, $revisionId ] = $this->owner( $document );
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$parser->startExternalParse( $title, ParserOptions::newFromAnon(), Parser::OT_HTML, true, $revisionId );

		$layerRows = PageOwnedCargoStore::layerRows( $parser );
		$this->assertSame( [
			[
				'page' => $title->getDBkey(), 'revision' => (string)$revisionId, 'layer_set' => 'Welcome Slide',
				'kind' => 'slide', 'layer' => 'text-layer', 'type' => 'textbox', 'text' => 'Visible SOP text',
				'link_target' => '',
			],
			[
				'page' => $title->getDBkey(), 'revision' => (string)$revisionId, 'layer_set' => 'Welcome Slide',
				'kind' => 'slide', 'layer' => 'link-only', 'type' => 'rectangle', 'text' => '',
				'link_target' => 'Operations/Intake#Procedure',
			],
		], $layerRows );

		// The existing mode remains one unchanged row per stored surface for the same exact revision.
		$this->assertSame( [ [ 'surface_id' => 'presentation', 'surface_label' => 'Welcome Slide',
			'surface_kind' => 'slide', 'source_file' => '', 'source_page' => '',
			'drawing_text' => 'Visible SOP text' ] ], PageOwnedCargoStore::rows( $parser ) );

		$this->assertSame( [
			[ '_table=LayerRows', 'page=' . $title->getDBkey(), 'revision=' . $revisionId,
				'layer_set=Welcome Slide', 'kind=slide', 'layer=text-layer', 'type=textbox',
				'text=Visible SOP text', 'link_target=' ],
			[ '_table=LayerRows', 'page=' . $title->getDBkey(), 'revision=' . $revisionId,
				'layer_set=Welcome Slide', 'kind=slide', 'layer=link-only', 'type=rectangle', 'text=',
				'link_target=Operations/Intake#Procedure' ],
		], PageOwnedCargoStore::layerStoreArguments( 'LayerRows', $layerRows ) );
	}

	public function testUnsupportedLayerRowModeShowsLocalizedError(): void {
		$this->markTestSkippedIfExtensionNotLoaded( 'Cargo' );
		$title = $this->getNonexistingTestPage()->getTitle();
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$output = $parser->parse( '{{#layers_cargo_store:_rows=secret-unsupported-mode}}', $title,
			ParserOptions::newFromAnon(), true, true );
		$this->assertStringContainsString( 'Unsupported Cargo row mode', $output->getRawText() );
		$this->assertStringNotContainsString( 'secret-unsupported-mode', $output->getRawText() );
		$this->assertStringNotContainsString( 'surface_id=', $output->getRawText() );
	}
}
