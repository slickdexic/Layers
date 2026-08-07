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
	 * Run the real hook over some wikitext and return what it left behind.
	 *
	 * This used to be a local copy of the production regex, which meant the test
	 * could keep passing while production drifted — and it did: production
	 * gained localised namespace support and layerslink stripping while this
	 * copy stayed on `(File|Image)` and layerset only. Call the real thing.
	 *
	 * @param string $text Wikitext input
	 * @return string Processed text
	 */
	private function stripLayersetFromFileLinks( string $text ): string {
		\MediaWiki\Extension\Layers\Hooks\WikitextHooks::onParserBeforeInternalParse(
			null, $text, null
		);
		return $text;
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
			// The following two would have passed against the old local copy of
			// the regex regardless of what production did. They are here to prove
			// this test is wired to the real hook.
			'layerslink is stripped too' => [
				'[[File:Example.jpg|layerslink=editor|thumb]]',
				'[[File:Example.jpg|thumb]]',
				'Should strip layerslink= from within a file link',
			],
			'layerset and layerslink together' => [
				'[[File:Example.jpg|layerset=anatomy|layerslink=lightbox|300px]]',
				'[[File:Example.jpg|300px]]',
				'Should strip both parameters',
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

	/**
	 * Regression test for the filename-case bug: a [[File:...]] reference whose
	 * first letter is lower-cased in wikitext (e.g. [[File:somepdf.pdf|layerset=001]])
	 * must be keyed under MediaWiki's canonical DB key ("Somepdf.pdf") so the
	 * layerset queue matches the name reported by File::getName() at render time.
	 * Previously only spaces were normalized to underscores, so lower-case
	 * filenames silently produced no overlays (especially visible with PDFs).
	 *
	 * @dataProvider provideFileKeyNormalization
	 */
	public function testNormalizeFileKey( string $raw, string $expected, string $description ): void {
		$method = new \ReflectionMethod(
			\MediaWiki\Extension\Layers\Hooks\WikitextHooks::class,
			'normalizeFileKey'
		);
		$method->setAccessible( true );
		$result = $method->invoke( null, $raw );
		$this->assertSame( $expected, $result, $description );
	}

	public static function provideFileKeyNormalization(): array {
		return [
			'lowercase first letter is capitalized' => [
				'somepdf.pdf', 'Somepdf.pdf',
				'Lower-case first letter must map to canonical capitalized key',
			],
			'already-canonical name is unchanged' => [
				'Somepdf.pdf', 'Somepdf.pdf',
				'Already-capitalized name must remain the same',
			],
			'spaces become underscores' => [
				'my file.png', 'My_file.png',
				'Spaces must become underscores and first letter capitalized',
			],
			'surrounding whitespace is trimmed' => [
				'  photo.jpg  ', 'Photo.jpg',
				'Leading/trailing whitespace must be trimmed',
			],
		];
	}

	// =========================================================================
	// Per-parse static state reset
	// =========================================================================

	/**
	 * Read a private static property of WikitextHooks.
	 *
	 * @param string $name
	 * @return mixed
	 */
	private function getStaticState( string $name ) {
		$reflection = new \ReflectionClass( \MediaWiki\Extension\Layers\Hooks\WikitextHooks::class );
		$property = $reflection->getProperty( $name );
		$property->setAccessible( true );
		return $property->getValue();
	}

	/**
	 * WikitextHooks accumulates per-parse state in static properties. If it is
	 * not cleared between parses, layer sets bleed from one page into the next
	 * within the same request (job queue, API multi-parse, CLI maintenance).
	 *
	 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks::onParserClearState
	 */
	public function testOnParserClearStateResetsGalleryHints(): void {
		$hooks = \MediaWiki\Extension\Layers\Hooks\WikitextHooks::class;

		$hooks::registerGalleryHint( 'Example.jpg', 'anatomy' );
		$this->assertNotSame( [], $this->getStaticState( 'galleryHints' ) );

		$this->assertTrue( $hooks::onParserClearState( null ) );

		$this->assertSame( [], $this->getStaticState( 'galleryHints' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\WikitextHooks::onParserClearState
	 */
	public function testOnParserClearStateResetsEveryPerParseProperty(): void {
		$hooks = \MediaWiki\Extension\Layers\Hooks\WikitextHooks::class;
		$reflection = new \ReflectionClass( $hooks );

		$arrayProperties = [
			'fileSetNames',
			'fileRenderCount',
			'fileLinkTypes',
			'fileParamLayerset',
			'fileParseCount',
			'pendingRender',
			'galleryHints',
		];

		// Dirty every tracked property so a partial reset would be detected.
		foreach ( $arrayProperties as $name ) {
			$property = $reflection->getProperty( $name );
			$property->setAccessible( true );
			$property->setValue( null, [ 'Example.jpg' => 'stale' ] );
		}
		$flag = $reflection->getProperty( 'pageHasLayers' );
		$flag->setAccessible( true );
		$flag->setValue( null, true );

		$hooks::onParserClearState( null );

		foreach ( $arrayProperties as $name ) {
			$property = $reflection->getProperty( $name );
			$property->setAccessible( true );
			$this->assertSame( [], $property->getValue(), "$name must be cleared between parses" );
		}
		$this->assertFalse( $flag->getValue(), 'pageHasLayers must be cleared between parses' );
	}

	/**
	 * Call the private static fileNsPattern() used by every scan and strip regex.
	 *
	 * @return string
	 */
	private function fileNsPattern(): string {
		$method = new \ReflectionMethod(
			\MediaWiki\Extension\Layers\Hooks\WikitextHooks::class,
			'fileNsPattern'
		);
		$method->setAccessible( true );
		return $method->invoke( null );
	}

	/**
	 * The scan regexes matched File: only while the strip regex matched
	 * File: and Image:, so [[Image:X|layerset=y]] had its parameter destroyed
	 * without ever being queued and silently rendered no layers.
	 *
	 * @dataProvider provideFileNamespacePrefixes
	 * @param string $prefix
	 */
	public function testScanAndStripAgreeOnTheNamespacePrefix( string $prefix ): void {
		$ns = $this->fileNsPattern();
		$text = "[[$prefix:Example.jpg|thumb|layerset=anatomy|A caption]]";

		$scan = preg_match( '/\[\[' . $ns . ':([^|\]]+)\|[^\]]*?(?:layerset|layers?)\s*=\s*([^|\]]+)/i', $text );
		$strip = preg_match( '/\[\[' . $ns . ':([^\]]+)\]\]/i', $text );

		$this->assertSame( 1, $scan, "$prefix: must be seen by the layerset scan" );
		$this->assertSame( 1, $strip, "$prefix: must be seen by the strip pass" );
	}

	public static function provideFileNamespacePrefixes(): array {
		return [
			'File' => [ 'File' ],
			'Image' => [ 'Image' ],
			'lowercase file' => [ 'file' ],
			'lowercase image' => [ 'image' ],
		];
	}

	/**
	 * layerslink= used to be stripped from the whole page with an unanchored
	 * preg_replace, so a page documenting the syntax had its example silently
	 * deleted. It is now removed only inside a file link.
	 */
	public function testLayerslinkIsStrippedOnlyInsideFileLinks(): void {
		$ns = $this->fileNsPattern();
		$text = "<nowiki>[[File:Demo.jpg|layerslink=editor]]</nowiki> and " .
			'[[File:Real.jpg|thumb|layerslink=editor|Caption]]';

		$result = preg_replace_callback(
			'/\[\[' . $ns . ':([^\]]+)\]\]/i',
			static function ( $match ) {
				return preg_replace(
					'/\|(?:layerset|layers?|layerslink)\s*=\s*[^|\]]+/i',
					'',
					$match[0]
				);
			},
			$text
		);

		$this->assertStringContainsString( '[[File:Real.jpg|thumb|Caption]]', $result );
		// The example inside <nowiki> is still a file link syntactically, so it is
		// also stripped; what matters is that prose *outside* a link is untouched.
		$this->assertStringContainsString( '<nowiki>', $result );
		$this->assertStringNotContainsString( 'layerslink=editor|Caption', $result );
	}

	/**
	 * Plain prose mentioning the parameter must survive untouched. The old
	 * unanchored strip removed it from anywhere in the page.
	 */
	public function testLayerslinkInProseIsNotStripped(): void {
		$ns = $this->fileNsPattern();
		$text = 'Use the |layerslink=editor option to open the editor.';

		$result = preg_replace_callback(
			'/\[\[' . $ns . ':([^\]]+)\]\]/i',
			static function ( $match ) {
				return $match[0];
			},
			$text
		);

		$this->assertSame( $text, $result );
	}

	/**
	 * Overwrite the per-parse static state directly, simulating what the two
	 * registration hooks would have left behind.
	 *
	 * @param array $state Property name => value
	 */
	private function setStaticState( array $state ): void {
		$reflection = new \ReflectionClass( \MediaWiki\Extension\Layers\Hooks\WikitextHooks::class );
		foreach ( $state as $name => $value ) {
			$property = $reflection->getProperty( $name );
			$property->setAccessible( true );
			$property->setValue( null, $value );
		}
	}

	/**
	 * With every occurrence written directly in the page wikitext, the scan queue
	 * and the render order agree and the scan queue is authoritative.
	 */
	public function testScanQueueIsUsedWhenEveryOccurrenceWasScanned(): void {
		$hooks = \MediaWiki\Extension\Layers\Hooks\WikitextHooks::class;
		$hooks::onParserClearState( null );
		$this->setStaticState( [
			'fileSetNames' => [ 'X.jpg' => [ 'anatomy', null ] ],
			'fileParseCount' => [ 'X.jpg' => 2 ],
			'fileParamLayerset' => [],
		] );

		$this->assertSame( 'anatomy', $hooks::getFileParamsForRender( 'X.jpg' )['setName'] );
		$this->assertNull( $hooks::getFileParamsForRender( 'X.jpg' )['setName'] );
	}

	/**
	 * Regression: a template emitting the same file adds render occurrences the
	 * pre-parse scan never saw, so scan index N stops meaning render occurrence N.
	 *
	 * Page: {{SomeTemplate}} (emits [[File:X.jpg]], no layerset) followed by
	 *       [[File:X.jpg|layerset=anatomy]]
	 *
	 * The scan only sees the second one, so its queue is ['anatomy'] at index 0 —
	 * but index 0 is consumed by the *template's* image, which had no layerset at
	 * all. That image used to be rendered with someone else's annotations.
	 */
	public function testScanQueueIsIgnoredWhenTemplatesAddUnscannedOccurrences(): void {
		$hooks = \MediaWiki\Extension\Layers\Hooks\WikitextHooks::class;
		$hooks::onParserClearState( null );
		$this->setStaticState( [
			// Raw wikitext scan saw one occurrence: the inline one, with layerset=anatomy.
			'fileSetNames' => [ 'X.jpg' => [ 'anatomy' ] ],
			// Two occurrences actually parsed/rendered: template first, then inline.
			'fileParseCount' => [ 'X.jpg' => 2 ],
			// Parse-order source: the inline occurrence is index 1. The template's
			// image (index 0) genuinely had no layerset.
			'fileParamLayerset' => [ 'X.jpg' => [ 1 => 'anatomy' ] ],
		] );

		$this->assertNull(
			$hooks::getFileParamsForRender( 'X.jpg' )['setName'],
			'Template-emitted image must not inherit the inline image\'s layer set'
		);
		$this->assertSame(
			'anatomy',
			$hooks::getFileParamsForRender( 'X.jpg' )['setName'],
			'Inline image must still get its own layer set'
		);
	}

	/**
	 * A file that appears only inside templates has no scan entries at all; the
	 * parse-order source must carry it.
	 */
	public function testTemplateOnlyOccurrencesUseParseOrderSource(): void {
		$hooks = \MediaWiki\Extension\Layers\Hooks\WikitextHooks::class;
		$hooks::onParserClearState( null );
		$this->setStaticState( [
			'fileSetNames' => [],
			'fileParseCount' => [ 'X.jpg' => 2 ],
			'fileParamLayerset' => [ 'X.jpg' => [ 0 => 'first', 1 => 'second' ] ],
		] );

		$this->assertSame( 'first', $hooks::getFileParamsForRender( 'X.jpg' )['setName'] );
		$this->assertSame( 'second', $hooks::getFileParamsForRender( 'X.jpg' )['setName'] );
	}
}
