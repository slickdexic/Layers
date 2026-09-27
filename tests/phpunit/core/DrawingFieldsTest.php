<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Parser\ParserOptions;
use MediaWiki\Parser\ParserOutput;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;

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
			'no value' => [ '{{#layers_fields:presentation|pressure}}', 'layers-fields-invalid-field' ],
			'bad name' => [ '{{#layers_fields:presentation|<b>=x}}', 'layers-fields-invalid-field' ],
			'too many fields' => [ '{{#layers_fields:presentation|' . implode( '|',
				array_map( static fn ( $i ) => "f$i=x", range( 1, 101 ) ) ) . '}}', 'layers-fields-too-many' ],
		];
	}
}
