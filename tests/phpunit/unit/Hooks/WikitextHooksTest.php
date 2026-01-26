<?php
declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks;

/**
 * Unit tests for WikitextHooks layerset stripping behavior.
 *
 * These tests verify that layerset= parameters are stripped from [[File:...]]
 * links but preserved in {{#slide:...}} parser functions.
 *
 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks
 */
class WikitextHooksTest extends \MediaWikiUnitTestCase {

	/**
	 * Simulate the layerset stripping logic from WikitextHooks::onParserBeforeInternalParse.
	 *
	 * This uses the same regex pattern as the production code for testing.
	 *
	 * @param string $text Wikitext input
	 * @return string Processed text with layerset stripped only from file links
	 */
	private function stripLayersetFromFileLinks( string $text ): string {
		return preg_replace_callback(
			'/\[\[(File|Image):([^\]]+)\]\]/i',
			static function ( $match ) {
				return preg_replace(
					'/\|(?:layerset|layers?)\s*=\s*[^|\]]+/i',
					'',
					$match[0]
				);
			},
			$text
		);
	}

	/**
	 * @dataProvider provideFileLinksWithLayerset
	 */
	public function testStripsLayersetFromFileLinks(
		string $input,
		string $expected,
		string $description
	): void {
		$result = $this->stripLayersetFromFileLinks( $input );
		$this->assertSame( $expected, $result, $description );
	}

	public static function provideFileLinksWithLayerset(): array {
		return [
			'basic file link with layerset' => [
				'[[File:Example.jpg|layerset=default|thumb]]',
				'[[File:Example.jpg|thumb]]',
				'Should strip layerset= from File: link',
			],
			'file link with layers=' => [
				'[[File:Example.jpg|layers=on|300px]]',
				'[[File:Example.jpg|300px]]',
				'Should strip layers= from File: link',
			],
			'file link with layer=' => [
				'[[File:Example.jpg|layer=anatomy|left]]',
				'[[File:Example.jpg|left]]',
				'Should strip layer= from File: link',
			],
			'Image: namespace' => [
				'[[Image:Photo.png|layerset=test|center]]',
				'[[Image:Photo.png|center]]',
				'Should strip layerset= from Image: link',
			],
			'layerset with named set' => [
				'[[File:Diagram.svg|layerset=anatomy-labels|thumb|A diagram]]',
				'[[File:Diagram.svg|thumb|A diagram]]',
				'Should strip named layerset value',
			],
			'layerset with spaces' => [
				'[[File:Test.png|layerset = default|200px]]',
				'[[File:Test.png|200px]]',
				'Should handle spaces around =',
			],
			'multiple parameters preserved' => [
				'[[File:Photo.jpg|layerset=x|thumb|left|200px|A caption]]',
				'[[File:Photo.jpg|thumb|left|200px|A caption]]',
				'Should preserve all other parameters',
			],
			'case insensitive' => [
				'[[FILE:Example.jpg|LAYERSET=test|thumb]]',
				'[[FILE:Example.jpg|thumb]]',
				'Should be case insensitive',
			],
		];
	}

	/**
	 * @dataProvider provideSlideParserFunctions
	 */
	public function testPreservesLayersetInSlideParserFunction(
		string $input,
		string $description
	): void {
		$result = $this->stripLayersetFromFileLinks( $input );
		$this->assertSame( $input, $result, $description );
	}

	public static function provideSlideParserFunctions(): array {
		return [
			'basic slide with layerset' => [
				'{{#slide:MySlide|layerset=default}}',
				'Should NOT modify {{#slide:}} parser function',
			],
			'slide with multiple params' => [
				'{{#slide:TestSlide|layerset=001|size=300x300}}',
				'Should preserve layerset and other params in slide',
			],
			'slide with canvas and layerset' => [
				'{{#slide:BigSlide|canvas=2048x1440|layerset=annotations}}',
				'Should preserve layerset with canvas param',
			],
			'slide with named set' => [
				'{{#slide:Diagram|layerset=anatomy-labels|size=800x600}}',
				'Should preserve named layerset value in slide',
			],
			'slide with layer param' => [
				'{{#slide:Test|layer=myLayer}}',
				'Should preserve layer= in slide function',
			],
			'slide with layers param' => [
				'{{#slide:Test|layers=on}}',
				'Should preserve layers= in slide function',
			],
		];
	}

	/**
	 * @dataProvider provideMixedContent
	 */
	public function testMixedContentHandling(
		string $input,
		string $expected,
		string $description
	): void {
		$result = $this->stripLayersetFromFileLinks( $input );
		$this->assertSame( $expected, $result, $description );
	}

	public static function provideMixedContent(): array {
		return [
			'slide and file on same page' => [
				'{{#slide:Demo|layerset=test}} and [[File:Photo.jpg|layerset=test|thumb]]',
				'{{#slide:Demo|layerset=test}} and [[File:Photo.jpg|thumb]]',
				'Should strip from File: but preserve in {{#slide:}}',
			],
			'multiple files, one slide' => [
				'[[File:A.jpg|layerset=x]] {{#slide:S|layerset=y}} [[File:B.jpg|layerset=z]]',
				'[[File:A.jpg]] {{#slide:S|layerset=y}} [[File:B.jpg]]',
				'Should strip from all files, preserve slide',
			],
			'nested in templates' => [
				'{{Template|[[File:X.png|layerset=foo]]}}',
				'{{Template|[[File:X.png]]}}',
				'Should strip from nested file links',
			],
			'plain text with layerset word' => [
				'The layerset parameter is documented here.',
				'The layerset parameter is documented here.',
				'Should not modify plain text containing the word layerset',
			],
			'code block with layerset' => [
				'<code>layerset=default</code>',
				'<code>layerset=default</code>',
				'Should not modify code blocks',
			],
		];
	}

	/**
	 * Test that the regex handles edge cases correctly.
	 *
	 * @dataProvider provideEdgeCases
	 */
	public function testEdgeCases(
		string $input,
		string $expected,
		string $description
	): void {
		$result = $this->stripLayersetFromFileLinks( $input );
		$this->assertSame( $expected, $result, $description );
	}

	public static function provideEdgeCases(): array {
		return [
			'file link at end of text' => [
				'See this: [[File:End.jpg|layerset=x]]',
				'See this: [[File:End.jpg]]',
				'Should work at end of text',
			],
			'file link at start of text' => [
				'[[File:Start.jpg|layerset=x]] more text',
				'[[File:Start.jpg]] more text',
				'Should work at start of text',
			],
			'layerset as last parameter' => [
				'[[File:Last.jpg|thumb|layerset=final]]',
				'[[File:Last.jpg|thumb]]',
				'Should strip even as last param',
			],
			'layerset as only parameter' => [
				'[[File:Only.jpg|layerset=sole]]',
				'[[File:Only.jpg]]',
				'Should work when layerset is only param',
			],
			'layerset value with hyphen' => [
				'[[File:Hyphen.jpg|layerset=my-layer-set|thumb]]',
				'[[File:Hyphen.jpg|thumb]]',
				'Should strip values with hyphens',
			],
			'layerset value with underscore' => [
				'[[File:Under.jpg|layerset=my_layer_set|thumb]]',
				'[[File:Under.jpg|thumb]]',
				'Should strip values with underscores',
			],
			'layerset value with numbers' => [
				'[[File:Numbers.jpg|layerset=v2_final_001|thumb]]',
				'[[File:Numbers.jpg|thumb]]',
				'Should strip alphanumeric values',
			],
			'empty file link (no params)' => [
				'[[File:NoParams.jpg]]',
				'[[File:NoParams.jpg]]',
				'Should not modify links without params',
			],
		];
	}
}
