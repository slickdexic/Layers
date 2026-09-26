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
 * {{#layers_cargo_store:}} projects the drawings of the parsed revision into Cargo rows.
 * @covers \MediaWiki\Extension\Layers\Cargo\PageOwnedCargoStore
 * @group Database
 */
class PageOwnedCargoStoreTest extends MediaWikiIntegrationTestCase {
	/** @return array [ title, first revision, second revision ] */
	private function owner(): array {
		$title = $this->getNonexistingTestPage()->getTitle();
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => true,
			'LayersPageOwnedPilotOwners' => [ $title->getPrefixedDBkey() ] ] );
		$publisher = TestingAdmissionRegistration::install( $this )['publisher'];
		$editor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $editor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$document = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) );
		$first = $publisher->publish( $title, $editor, 0, json_encode( $document ), 'First',
			new WikitextContent( '{{#layers_cargo_store:_table=Layers_test_drawings}}' ) );
		$document->surfaces[0]->layers[0]->text = "Valve = open\nCheck twice";
		$second = $publisher->publish( $title, $editor, $first, json_encode( $document ), 'Second' );
		return [ $title, $first, $second ];
	}

	private function rows( Title $title, int $revisionId ): array {
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$parser->startExternalParse( $title, ParserOptions::newFromAnon(), Parser::OT_HTML, true, $revisionId );
		return PageOwnedCargoStore::rows( $parser );
	}

	public function testRowsDescribeTheDrawingsOfTheParsedRevision(): void {
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

	public function testNothingIsProjectedOutsideThePilot(): void {
		[ $title, , $second ] = $this->owner();
		$this->overrideConfigValue( 'LayersPageOwnedPilotEnabled', false );
		$this->assertSame( [], $this->rows( $title, $second ) );
		$this->overrideConfigValues( [ 'LayersPageOwnedPilotEnabled' => true, 'LayersPageOwnedPilotOwners' => [] ] );
		$this->assertSame( [], $this->rows( $title, $second ) );
		// Another page never projects this page's drawings.
		$this->overrideConfigValue( 'LayersPageOwnedPilotOwners', [ $title->getPrefixedDBkey() ] );
		$this->assertSame( [], $this->rows( $this->getExistingTestPage()->getTitle(), $second ) );
	}
}
