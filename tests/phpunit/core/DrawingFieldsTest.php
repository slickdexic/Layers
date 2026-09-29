<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * {{#layers_fields:}} turns wikitext values into plain-text page output for a drawing's {{name}} tokens.
 * @covers \MediaWiki\Extension\Layers\Hooks\DrawingFields
 * @group Database
 */
class DrawingFieldsTest extends MediaWikiIntegrationTestCase {
	private function parse( string $text ): ParserOutput {
		return $this->getServiceContainer()->getParserFactory()->create()->parse( $text,
			Title::makeTitle( NS_MAIN, 'DrawingFieldsProbe' ), ParserOptions::newFromAnon() );
	}

	public function testFieldsBecomePlainTextPageOutput(): void {
		$this->editPage( 'Template:DrawingFieldsValue', 'from a [[Target page|template]]' );
		$output = $this->parse( "Before{{#layers_fields: presentation | pressure = 12 '''bar''' | " .
			"status = {{DrawingFieldsValue}} }}{{#layers_fields:presentation|pressure=13 bar}}" .
			"{{#layers_fields:other|a = <b>x</b> &amp; y|Line 2.x=}}After" );
		$entries = array_map( static fn ( $key ) => json_decode( (string)$key, true ),
			array_keys( $output->getJsConfigVars()['wgLayersDrawingFields'] ) );
		sort( $entries );
		// Each call adds entries; the viewer resolves them, leaving out a name given two different values.
		$this->assertSame( [
			[ 'other', 'Line 2.x', '' ],
			[ 'other', 'a', 'x & y' ],
			[ 'presentation', 'pressure', '12 bar' ],
			[ 'presentation', 'pressure', '13 bar' ],
			[ 'presentation', 'status', 'from a template' ],
		], $entries );
		$this->assertStringContainsString( 'BeforeAfter', $output->getRawText() );
	}

	public function testFilesAndSlidesAreNamedTheWayViewersLookThemUp(): void {
		$output = $this->parse( '{{#layers_fields:File:pump diagram.png|pressure=12}}' .
			'{{#layers_fields:Image:Pump_diagram.png|status=OK}}{{#layers_fields: Slide: Line_overview |a=b}}' );
		$entries = array_map( static fn ( $key ) => json_decode( (string)$key, true ),
			array_keys( $output->getJsConfigVars()['wgLayersDrawingFields'] ) );
		sort( $entries );
		$this->assertSame( [
			[ 'File:Pump_diagram.png', 'pressure', '12' ],
			[ 'File:Pump_diagram.png', 'status', 'OK' ],
			[ 'Slide:Line_overview', 'a', 'b' ],
		], $entries );
	}

	public function testAPageDrawingIsNamedByPageIdAndName(): void {
		$this->overrideConfigValues( [ 'LayersPageDrawingNamespaces' => null ] );
		$registered = TestingAdmissionRegistration::install( $this );
		$page = $this->getExistingTestPage( 'DrawingFieldsNamed' );
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers' ] );
		$pageId = $page->getId();
		$text = "{{#layers_fields: $pageId:welcome_SLIDE | pressure = 12 }}";
		$revisionId = $registered['publisher']->publish( $page->getTitle(), $actor, $page->getLatest(),
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), 'Fields',
			new \MediaWiki\Content\WikitextContent( $text ), $pageId );
		$parse = fn ( string $wikitext ) => $this->getServiceContainer()->getParserFactory()->create()->parse(
			$wikitext, $page->getTitle(), ParserOptions::newFromAnon(), true, true, $revisionId );
		$this->assertSame( [ json_encode( [ 'presentation', 'pressure', '12' ] ) ],
			array_keys( $parse( $text )->getJsConfigVars()['wgLayersDrawingFields'] ) );
		$other = $pageId + 1000;
		foreach ( [
			"{{#layers_fields: $pageId:Missing | a = b }}", "{{#layers_fields: $other:Welcome Slide | a = b }}"
		] as $wikitext ) {
			$output = $parse( $wikitext );
			$this->assertStringContainsString( '<strong class="error">', $output->getRawText(), $wikitext );
			$this->assertArrayNotHasKey( 'wgLayersDrawingFields', $output->getJsConfigVars(), $wikitext );
		}
	}

	/** @dataProvider provideInvalidCalls */
	public function testInvalidCallsShowAnErrorAndAddNothing( string $call, string $message ): void {
		$output = $this->parse( $call );
		$this->assertStringContainsString( '<strong class="error">' . wfMessage( $message )->text(),
			$output->getRawText() );
		$this->assertArrayNotHasKey( 'wgLayersDrawingFields', $output->getJsConfigVars() );
	}

	public static function provideInvalidCalls(): array {
		return [
			'no drawing' => [ '{{#layers_fields:|a=b}}', 'layers-fields-invalid-drawing' ],
			'binding instead of ID' => [ '{{#layers_fields:v1:1:presentation|a=b}}', 'layers-fields-invalid-drawing' ],
			'not a file' => [ '{{#layers_fields:Talk:Pump|a=b}}', 'layers-fields-invalid-drawing' ],
			'invalid slide name' => [ '{{#layers_fields:Slide:|a=b}}', 'layers-fields-invalid-drawing' ],
			'no value' => [ '{{#layers_fields:presentation|pressure}}', 'layers-fields-invalid-field' ],
			'bad name' => [ '{{#layers_fields:presentation|<b>=x}}', 'layers-fields-invalid-field' ],
			'too many fields' => [ '{{#layers_fields:presentation|' . implode( '|',
				array_map( static fn ( $i ) => "f$i=x", range( 1, 101 ) ) ) . '}}', 'layers-fields-too-many' ],
		];
	}
}
