<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;
use MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions;

/** @covers \MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter */
class DirectEmbeddingRewriterTest extends \MediaWikiUnitTestCase {
	/** @param string $target @return string|null */
	public function file( string $target ): ?string {
		return preg_match( '/\A(?:File|Image):([^#]+)\z/D', $target, $match ) ? 'File:' . $match[1] : null;
	}

	public function testRewritesOnlySelectedIdenticalEmbedUsingByteOffsets(): void {
		$embed = '[[File:A.jpg| thumb |layers=one|caption 🐈]]';
		$prefix = '😀 café 漢字 ' . $embed . "\n";
		$text = $prefix . $embed . ' trailing';
		$rewriter = new DirectEmbeddingRewriter();
		$found = $rewriter->scan( $text, [ $this, 'file' ] );
		$this->assertCount( 2, $found );
		$this->assertSame( strlen( $prefix ), $found[1]['start'] );
		$this->assertSame( [ ' thumb ', 'layers=one', 'caption 🐈' ], $found[1]['options'] );
		$this->assertSame( $prefix . '[[File:A.jpg| thumb |layerset=123:Drawing A|caption 🐈]] trailing',
			$rewriter->rewrite( $text, strlen( $prefix ), $embed, 123, 'Drawing A', [ $this, 'file' ] ) );
	}

	public function testRenameRewritesOnlyThisPagesNamedEmbeds(): void {
		$r = new DirectEmbeddingRewriter();
		$text = "{{#Slide: 7:Ideas |width=400}} [[File:A.jpg|thumb|layerset = 7:pump_labels|Cap]]\n" .
			'{{#Slide:8:Ideas}} [[File:A.jpg|layerset=labels]] {{#Slide:7:Other}} [[File:A.jpg|layersbinding=v1:7:x]]';
		$this->assertSame( "{{#Slide: 7:Plans |width=400}} [[File:A.jpg|thumb|layerset =7:Pump tags|Cap]]\n" .
			'{{#Slide:8:Ideas}} [[File:A.jpg|layerset=labels]] {{#Slide:7:Other}} [[File:A.jpg|layersbinding=v1:7:x]]',
			$r->renameReferences( $text, 7, [ 'ideas' => 'Plans', 'pump labels' => 'Pump tags' ], [ $this, 'file' ] ) );
		$this->assertSame( '{{#Slide:7:B}}{{#Slide:7:A}}',
			$r->renameReferences( '{{#Slide:7:A}}{{#Slide:7:B}}', 7, [ 'a' => 'B', 'b' => 'A' ], [ $this, 'file' ] ) );
	}

	public function testSlideAndFileAliasPreservePresentationAndPdfPage(): void {
		$r = new DirectEmbeddingRewriter();
		$text = '{{#Slide: Ideas |canvas=800x600| layerset = Named |noedit}}';
		$this->assertSame( 'slide', $r->scan( $text, [ $this, 'file' ] )[0]['kind'] );
		$this->assertSame( '{{#Slide: 2:Ideas |canvas=800x600|noedit}}',
			$r->rewrite( $text, 0, $text, 2, 'Ideas', [ $this, 'file' ] ) );
		$this->assertSame( '{{#Slide:2:Ideas 2}}', $r->rewrite( '{{#Slide:Ideas}}', 0, '{{#Slide:Ideas}}', 2, 'Ideas 2',
			[ $this, 'file' ] ) );
		$text = '[[Image:A.pdf|page=2|caption]]';
		$this->assertSame( 'File:A.pdf', $r->scan( $text, [ $this, 'file' ] )[0]['target'] );
		$this->assertSame( '[[Image:A.pdf|page=2|caption|layerset=2:Pdf A]]',
			$r->rewrite( $text, 0, $text, 2, 'Pdf A', [ $this, 'file' ] ) );
		foreach ( [ [ 2, 'a|b' ], [ 2, ' Pdf A' ], [ 0, 'Pdf A' ], [ 2, '' ] ] as [ $pageId, $name ] ) {
			try {
				$r->rewrite( $text, 0, $text, $pageId, $name, [ $this, 'file' ] );
				$this->fail( "\"$name\" must not be written into an embed" );
			} catch ( \InvalidArgumentException $e ) {
				$this->assertSame( 'layers-embedding-source-unavailable', $e->getMessage() );
			}
		}
	}

	/**
	 * @dataProvider provideHiddenCandidates
	 * @param string $prefix
	 */
	public function testExcludesContainedAndDynamicCandidates( string $prefix ): void {
		$visible = '[[File:Visible.jpg]]';
		$found = ( new DirectEmbeddingRewriter() )->scan( $prefix . $visible, [ $this, 'file' ] );
		$this->assertCount( 1, $found );
		$this->assertSame( strlen( $prefix ), $found[0]['start'] );
		$this->assertSame( $visible, $found[0]['raw'] );
	}

	/** @return array */
	public static function provideHiddenCandidates(): array {
		return array_map( static function ( $text ) {
			return [ $text ];
		}, [
			'<!-- [[File:A.jpg]] -->', '<nowiki>{{ [[File:A.jpg]] }}</nowiki>',
			'<ref name="x>y">[[File:A.jpg]]</ref>', '<syntaxhighlight lang="php">[[File:A.jpg]]</syntaxhighlight>',
			'{{Box|[[File:A.jpg]]}}', '{{{fallback|[[File:A.jpg]]}}}',
			'[[File:{{name}}|layers=one]]', '[[File:A.jpg|See [[Help:Layers|help]]]]',
			'{{#Slide:Ideas|caption={{Label|x}}}}', '[[Fi<!--note-->le:A.jpg]]',
			'[[:File:A.jpg]]', '[[Help:Layers]]', '<nowiki />',
			'<nowiki name="/">[[File:A.jpg]]</nowiki>',
			'{{Box|<!-- }} -->[[File:A.jpg]]}}', '{{{p|{{T|[[File:A.jpg]]}}}}}'
		] );
	}

	/**
	 * @dataProvider provideUnsafeSources
	 * @param string $text
	 */
	public function testRejectsMalformedOrUnsupportedSource( string $text ): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-embedding-source-unavailable' );
		( new DirectEmbeddingRewriter() )->scan( $text, [ $this, 'file' ] );
	}

	/** @return array */
	public static function provideUnsafeSources(): array {
		return array_map( static function ( $text ) {
			return [ $text ];
		}, [ '<!-- [[File:A.jpg]]', '<ref>[[File:A.jpg]]', '{{Box|[[File:A.jpg]]',
			"[[File:A.jpg|\0layers=one]]", '<includeonly>[[File:A.jpg]]',
			'[[File:A.jpg', '<nowiki><nowiki></nowiki>[[File:A.jpg]]</nowiki>',
			str_repeat( '{{T|', 66 ) . '[[File:A.jpg]]' . str_repeat( '}}', 66 ) ] );
	}

	/**
	 * Ordinary HTML, single brackets and stray closers are plain text to MediaWiki's preprocessor;
	 * they must not make a whole page ineligible.
	 * @dataProvider providePlainTextSurroundings
	 * @param string $prefix
	 * @param string $suffix
	 */
	public function testPlainTextSyntaxDoesNotRejectPage( string $prefix, string $suffix ): void {
		$visible = '[[File:Visible.jpg|layers=one]]';
		$found = ( new DirectEmbeddingRewriter() )->scan( $prefix . $visible . $suffix, [ $this, 'file' ] );
		$this->assertCount( 1, $found );
		$this->assertSame( strlen( $prefix ), $found[0]['start'] );
		$this->assertSame( $visible, $found[0]['raw'] );
	}

	/** @return array */
	public static function providePlainTextSurroundings(): array {
		return [
			'line break' => [ "Line one<br>Line two<br />\n", '' ],
			'html container' => [ '<div class="note">', '</div>' ],
			'references list' => [ "Text\n", "\n== Refs ==\n<references />" ],
			'external link before' => [ 'See [https://example.test docs]. ', '' ],
			'external link around' => [ '[https://example.test ', ']' ],
			'prose brackets' => [ 'Use array[0] and x] here. ', '' ],
			'stray template closer' => [ '}} ', '' ],
			'lookalike tag names' => [ '<nowiki-x>', '</nowiki>' ],
			'namespaced lookalike' => [ '<ref:custom>', '</ref>' ],
			'noinclude markers' => [ '<noinclude>', '</noinclude>' ],
			'onlyinclude markers' => [ '<onlyinclude>', '</onlyinclude>' ],
			'includeonly skipped' => [ '<includeonly>[[File:Hidden.jpg]]</includeonly>', '' ],
			'unterminated attribute' => [ '<ref name="x ', '' ],
		];
	}

	public function testNativeExtensionTagBodiesAreOpaque(): void {
		$text = '<poem>[[File:Inside.jpg]]</poem>[[File:Visible.jpg]]';
		$this->assertCount( 2, ( new DirectEmbeddingRewriter() )->scan( $text, [ $this, 'file' ] ) );
		$found = ( new DirectEmbeddingRewriter( [ 'poem' ] ) )->scan( $text, [ $this, 'file' ] );
		$this->assertCount( 1, $found );
		$this->assertSame( '[[File:Visible.jpg]]', $found[0]['raw'] );
	}

	public function testRejectsStalePartialAndAlreadyBoundSelections(): void {
		$r = new DirectEmbeddingRewriter();
		$text = 'before [[File:A.jpg|layers=one]] after';
		$raw = '[[File:A.jpg|layers=one]]';
		$cases = [
			[ $text, 8, $raw ], [ $text, 7, substr( $raw, 0, -1 ) ],
			[ $text, 7, '[[File:B.jpg|layers=one]]' ],
			[ '[[File:A.jpg|layersbinding=v1:2:a]]', 0, '[[File:A.jpg|layersbinding=v1:2:a]]' ],
			[ '[[File:A.jpg|layers=one|layerset=two]]', 0, '[[File:A.jpg|layers=one|layerset=two]]' ]
		];
		foreach ( $cases as [ $source, $start, $expected ] ) {
			try {
				$r->rewrite( $source, $start, $expected, 2, 'a', [ $this, 'file' ] );
				$this->fail( 'Unsafe selection must reject' );
			} catch ( \InvalidArgumentException $e ) {
				$this->assertSame( 'layers-embedding-source-unavailable', $e->getMessage() );
			}
		}
	}

	/** @dataProvider provideInputOutputFlags @param bool $bareNames @param bool $emitBareNames */
	public function testScopedInputAndOutputFlagsAreIndependent( bool $bareNames, bool $emitBareNames ): void {
		$rewriter = new DirectEmbeddingRewriter();
		$text = '[[File:A.jpg|layerset=7:ABC]] [[File:A.jpg|layers=ABC]] ' .
			'[[File:A.jpg|layerset=8:ABC]] {{#Slide:7:ABC}} {{#Slide:ABC}} {{#Slide:8:ABC}}';
		$renames = [ $this->renameRecord( 'ABC', 'Notes', 'File:A.jpg' ), $this->renameRecord( 'ABC', 'Plans' ) ];
		$serialized = serialize( $renames );
		$fileName = $emitBareNames ? 'Notes' : '7:Notes';
		$slideName = $emitBareNames ? 'Plans' : '7:Plans';
		$expected = '[[File:A.jpg|layerset=' . $fileName . ']] [[File:A.jpg|layers=' .
			( $bareNames ? $fileName : 'ABC' ) . ']] [[File:A.jpg|layerset=8:ABC]] {{#Slide:' . $slideName .
			'}} {{#Slide:' . ( $bareNames ? $slideName : 'ABC' ) . '}} {{#Slide:8:ABC}}';
		$this->assertSame( $expected, $rewriter->renameScopedReferences( $text, 7, $renames,
			[ $this, 'file' ], $bareNames, $emitBareNames ) );
		$this->assertSame( $serialized, serialize( $renames ) );
		$this->assertSame( '[[File:A.jpg|layerset=7:ABC]] [[File:A.jpg|layers=ABC]] ' .
			'[[File:A.jpg|layerset=8:ABC]] {{#Slide:7:ABC}} {{#Slide:ABC}} {{#Slide:8:ABC}}', $text );
	}

	public static function provideInputOutputFlags(): array {
		return [ 'explicit in / explicit out' => [ false, false ], 'bare in / explicit out' => [ true, false ],
			'explicit in / bare out' => [ false, true ], 'bare in / bare out' => [ true, true ] ];
	}

	public function testBareRewriteVerifiesActualFileAndWhitespaceSlideReplacement(): void {
		$rewriter = new DirectEmbeddingRewriter();
		foreach ( [ [ '[[Image:A.pdf|page 3| layers=8:ABC|Caption]]',
			'[[Image:A.pdf|page 3|layerset=Notes_Été|Caption]]', 'Notes_Été' ],
			[ '{{ #Slide:7:ABC |width=400}}', '{{ #Slide:Plans |width=400}}', 'Plans' ],
			[ "{{\n #Slide: 8:ABC |layers=old|width=400|noedit}}",
				"{{\n #Slide: Plans |width=400|noedit}}", 'Plans' ] ] as [ $text, $expected, $name ]
		) {
			$this->assertSame( $expected, $rewriter->rewrite( $text, 0, $text, 7, $name, [ $this, 'file' ], true ) );
			$candidate = $rewriter->scan( $expected, [ $this, 'file' ] )[0];
			$this->assertSame( [ 'pageId' => 7, 'name' => $name ], PageOwnedBindingOptions::named(
				$candidate['options'], $candidate['kind'], $candidate['target'], 7 ) );
		}
	}

	public function testOmittedAndFalseOutputRemainCompatibleIncludingOldHelper(): void {
		$rewriter = new DirectEmbeddingRewriter();
		foreach ( [ '[[Image:A.pdf|page=3|layers=ABC|Caption]]', '{{#Slide:ABC|width=400|layers=old}}' ] as $text ) {
			$this->assertSame( $rewriter->rewrite( $text, 0, $text, 7, 'Notes', [ $this, 'file' ] ),
				$rewriter->rewrite( $text, 0, $text, 7, 'Notes', [ $this, 'file' ], false ) );
		}
		$text = '[[File:A.jpg|layerset=7:ABC]] [[File:A.jpg|layerset=ABC]] {{#Slide:7:ABC}}';
		$renames = [ $this->renameRecord( 'ABC', 'on', 'File:A.jpg' ), $this->renameRecord( 'ABC', 'off' ) ];
		foreach ( [ false, true ] as $bareNames ) {
			$this->assertSame( $rewriter->renameScopedReferences( $text, 7, $renames, [ $this, 'file' ], $bareNames ),
				$rewriter->renameScopedReferences( $text, 7, $renames, [ $this, 'file' ], $bareNames, false ) );
		}
		$this->assertSame( '[[File:A.jpg|layerset=7:on]] [[File:A.jpg|layerset=ABC]] {{#Slide:7:on}}',
			$rewriter->renameReferences( $text, 7, [ 'abc' => 'on' ], [ $this, 'file' ] ) );
	}

	public function testBareSingleOccurrenceUsesUtf8ByteOffsetsAndPreservesInput(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$embed = '[[Image:A.pdf| thumb |page =3|layers=8:ABC|caption café]]';
		$prefix = '漢字 ' . $embed . "\n";
		$text = $prefix . $embed . ' suffix';
		$original = $text;
		$expected = $prefix . '[[Image:A.pdf| thumb |page =3|layerset=Notes_Été|caption café]] suffix';
		$this->assertSame( $expected, $rewriter->rewrite( $text, strlen( $prefix ), $embed, 7,
			'Notes_Été', [ $this, 'file' ], true ) );
		$this->assertSame( $original, $text );
		$this->assertSame( '[[File:A.jpg|layerset=Default]]', $rewriter->rewrite(
			'[[File:A.jpg]]', 0, '[[File:A.jpg]]', 7, 'Default', [ $this, 'file' ], true ) );
	}

	public function testLeadingWhitespaceDefaultTrapRemainsInactive(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$text = '{{ #Slide:7:ABC |width=400}}';
		foreach ( [ false, true ] as $emitBareNames ) {
			$this->assertSame( $emitBareNames ? '{{ #Slide:ABC |width=400}}' : $text,
				$rewriter->rewrite( $text, 0, $text, 7, 'ABC', [ $this, 'file' ], $emitBareNames ) );
		}
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-embedding-source-unavailable' );
		$rewriter->rewrite( $text, 0, $text, 7, 'Plans', [ $this, 'file' ] );
	}

	/** @dataProvider provideGenericFileNames @param string $name */
	public function testMatchedGenericFileBareOutputRefusesWithoutMutatingInputs( string $name ): void {
		$rewriter = new DirectEmbeddingRewriter();
		$text = '[[File:A.jpg|layerset=7:ABC]]';
		$renames = [ $this->renameRecord( 'ABC', $name, 'File:A.jpg' ) ];
		$serialized = serialize( $renames );
		$this->assertSame( '[[File:A.jpg|layerset=7:' . $name . ']]',
			$rewriter->rewrite( $text, 0, $text, 7, $name, [ $this, 'file' ], false ) );
		$this->assertSame( '[[File:A.jpg|layerset=7:' . $name . ']]',
			$rewriter->renameScopedReferences( $text, 7, $renames, [ $this, 'file' ], false, false ) );
		foreach ( [ 'rewrite', 'rename' ] as $operation ) {
			try {
				$result = $operation === 'rewrite' ?
					$rewriter->rewrite( $text, 0, $text, 7, $name, [ $this, 'file' ], true ) :
					$rewriter->renameScopedReferences( $text, 7, $renames, [ $this, 'file' ], false, true );
				$this->fail( 'Unsafe matched file output returned instead of refusing: ' . $result );
			} catch ( \InvalidArgumentException $exception ) {
				$this->assertSame( 'layers-embedding-source-unavailable', $exception->getMessage() );
			}
			$this->assertSame( '[[File:A.jpg|layerset=7:ABC]]', $text );
			$this->assertSame( $serialized, serialize( $renames ) );
		}
	}

	public static function provideGenericFileNames(): array {
		$names = [ 'on', 'true', 'all', '1', 'off', 'none', 'false', '0' ];
		return array_map( static fn ( $name ) => [ $name ], array_values( array_unique(
			array_merge( $names, array_map( 'strtoupper', $names ) ) ) ) );
	}

	public function testMixedSafeAndUnsafeBareOutputRefusesTheWholeCallInBothOrders(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$embeds = [ '[[File:A.jpg|layerset=7:ABC]]', '[[File:B.jpg|layerset=7:ABC]]' ];
		$renames = [ $this->renameRecord( 'ABC', 'Notes', 'File:A.jpg' ),
			$this->renameRecord( 'ABC', 'off', 'File:B.jpg' ) ];
		foreach ( [ $embeds, array_reverse( $embeds ) ] as $ordered ) {
			foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
				$text = implode( ' ', $ordered );
				$original = $text;
				$serialized = serialize( $instructions );
				$this->assertSame( str_replace( [ 'File:A.jpg|layerset=7:ABC', 'File:B.jpg|layerset=7:ABC' ],
					[ 'File:A.jpg|layerset=7:Notes', 'File:B.jpg|layerset=7:off' ], $text ),
					$rewriter->renameScopedReferences( $text, 7, $instructions, [ $this, 'file' ], false, false ) );
				try {
					$result = $rewriter->renameScopedReferences( $text, 7, $instructions,
						[ $this, 'file' ], false, true );
					$this->fail( 'Mixed unsafe bare output returned instead of refusing: ' . $result );
				} catch ( \InvalidArgumentException $exception ) {
					$this->assertSame( 'layers-embedding-source-unavailable', $exception->getMessage() );
				}
				$this->assertSame( $original, $text );
				$this->assertSame( $serialized, serialize( $instructions ) );
			}
		}
	}

	public function testUnsafeUnusedInstructionAndLiteralSlideIntentsRemainValid(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$text = '[[File:A.jpg|layerset=7:on]] {{ #Slide:7:ABC |width=400|layers=Other|noedit}}';
		$renames = [ $this->renameRecord( 'on', 'Notes', 'File:A.jpg' ), $this->renameRecord( 'ABC', 'on' ),
			$this->renameRecord( 'Missing', 'off', 'File:B.jpg' ) ];
		$this->assertSame( '[[File:A.jpg|layerset=Notes]] {{ #Slide:on |width=400|layers=Other|noedit}}',
			$rewriter->renameScopedReferences( $text, 7, $renames, [ $this, 'file' ], false, true ) );
		$this->assertSame( $text, $rewriter->renameScopedReferences( $text, 7,
			[ $this->renameRecord( 'Missing', 'off', 'File:A.jpg' ) ], [ $this, 'file' ], true, true ) );
		$this->assertSame( '{{#Slide:on|width=400}}', $rewriter->rewrite( '{{#Slide:8:ABC|width=400|layers=old}}',
			0, '{{#Slide:8:ABC|width=400|layers=old}}', 7, 'on', [ $this, 'file' ], true ) );
	}

	public function testBarePdfRenamePreservesFullScopeAndAllPageOptionBytes(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$options = [ 'page=1|', 'page=3|', 'page=3|', 'page 3|', 'page =3|page=1|', 'seite=3|' ];
		$embeds = [];
		$expected = [];
		foreach ( $options as $option ) {
			$embeds[] = '[[Image:Manual.pdf|thumb|' . $option . ' layers = 7:ABC|Caption]]';
			$expected[] = '[[Image:Manual.pdf|thumb|' . $option . ' layers =Notes_Été|Caption]]';
		}
		$protected = ' [[File:Manual.pdf|page=3|layerset=7:Other]] [[File:Manual.Pdf|layerset=7:ABC]] ' .
			'{{#Slide:7:ABC}} [[File:Manual.pdf|layerset=8:ABC]] [[File:Manual.pdf|layersbinding=v1:7:x]]';
		$text = implode( "\n", $embeds ) . $protected;
		$original = $text;
		$renames = [ $this->renameRecord( ' abc ', 'Notes_Été', 'File:Manual.pdf' ),
			$this->renameRecord( 'ABC', 'Notes_Été', 'File:Manual.pdf' ) ];
		$serialized = serialize( $renames );
		$this->assertSame( implode( "\n", $expected ) . $protected,
			$rewriter->renameScopedReferences( $text, 7, $renames, [ $this, 'file' ], false, true ) );
		$this->assertSame( $original, $text );
		$this->assertSame( $serialized, serialize( $renames ) );
		foreach ( $rewriter->scan( implode( "\n", $expected ), [ $this, 'file' ] ) as $candidate ) {
			$this->assertSame( [ 'pageId' => 7, 'name' => 'Notes_Été' ], PageOwnedBindingOptions::named(
				$candidate['options'], $candidate['kind'], $candidate['target'], 7 ) );
		}
	}

	public function testBareSwapsUseOriginalIdentityInEveryDescriptorAndOccurrenceOrder(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$renames = [ $this->renameRecord( 'A', 'B', 'File:Manual.pdf' ),
			$this->renameRecord( 'B', 'A', 'File:Manual.pdf' ), $this->renameRecord( 'A', 'B' ),
			$this->renameRecord( 'B', 'A' ) ];
		$embeds = [ '[[File:Manual.pdf|page=1|layerset=7:A]]', '[[File:Manual.pdf|page 3|layerset=7:B]]',
			'{{#Slide:7:A}}', '{{#Slide:7:B}}', '[[File:Other.pdf|layerset=7:A]]' ];
		$expected = [ '[[File:Manual.pdf|page=1|layerset=B]]', '[[File:Manual.pdf|page 3|layerset=A]]',
			'{{#Slide:B}}', '{{#Slide:A}}', $embeds[4] ];
		foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
			foreach ( [ false, true ] as $reverse ) {
				$text = implode( ' ', $reverse ? array_reverse( $embeds ) : $embeds );
				$this->assertSame( implode( ' ', $reverse ? array_reverse( $expected ) : $expected ),
					$rewriter->renameScopedReferences( $text, 7, $instructions, [ $this, 'file' ], false, true ) );
			}
		}
	}

	public function testOptedInOutputRetainsScannerExclusionsAndAmbiguousCandidateSkipping(): void {
		$rewriter = new DirectEmbeddingRewriter( array_merge( DirectEmbeddingRewriter::DEFAULT_EXTENSION_TAGS,
			[ 'poem' ] ) );
		$protected = '<!-- [[File:A.jpg|layerset=7:ABC]] --><nowiki>[[File:A.jpg]]</nowiki>' .
			'<gallery>File:A.jpg|layerset=7:ABC</gallery><poem>[[File:A.jpg|layerset=7:ABC]]</poem>' .
			'{{Box|[[File:A.jpg|layerset=7:ABC]]}} [[File:{{Name}}|layerset=7:ABC]] ' .
			'[[:File:A.jpg|layerset=7:ABC]] [[File:A.jpg#Section|layerset=7:ABC]] ';
		$resolve = function ( string $target ): ?string {
			return str_contains( $target, '#' ) ? null : $this->file( $target );
		};
		foreach ( self::provideAmbiguousScopedSelectors() as [ $options ] ) {
			$prefix = $protected . '[[File:A.jpg|' . $options . ']] ';
			$this->assertSame( $prefix . '[[File:A.jpg|layerset=Notes]]', $rewriter->renameScopedReferences(
				$prefix . '[[File:A.jpg|layerset=7:ABC]]', 7,
				[ $this->renameRecord( 'ABC', 'Notes', 'File:A.jpg' ) ], $resolve, true, true ) );
		}
		foreach ( self::provideUnsafeSources() as [ $text ] ) {
			try {
				$rewriter->renameScopedReferences( $text, 7, [], $resolve, false, true );
				$this->fail( 'Malformed source must still refuse' );
			} catch ( \InvalidArgumentException $exception ) {
				$this->assertSame( 'layers-embedding-source-unavailable', $exception->getMessage() );
			}
		}
	}

	public function testBareRewriteRetainsStalePartialAndBindingRefusals(): void {
		$rewriter = new DirectEmbeddingRewriter();
		foreach ( [ [ 'before [[File:A.jpg]]', 8, '[[File:A.jpg]]' ],
			[ '[[File:A.jpg]]', 0, '[[File:A.jpg]' ], [ '[[File:A.jpg]]', 0, '[[File:B.jpg]]' ],
			[ '[[File:A.jpg|layersbinding=v1:7:x]]', 0, '[[File:A.jpg|layersbinding=v1:7:x]]' ],
			[ '[[File:A.jpg|layers=7:ABC|layerset=ABC]]', 0, '[[File:A.jpg|layers=7:ABC|layerset=ABC]]' ]
		] as [ $text, $start, $expected ]
		) {
			$original = $text;
			try {
				$rewriter->rewrite( $text, $start, $expected, 7, 'Notes', [ $this, 'file' ], true );
				$this->fail( 'Unsafe occurrence must still refuse' );
			} catch ( \InvalidArgumentException $exception ) {
				$this->assertSame( 'layers-embedding-source-unavailable', $exception->getMessage() );
			}
			$this->assertSame( $original, $text );
		}
	}

	/** @param string $old @param string $new @param string|null $fileTitle @return array */
	private function renameRecord( string $old, string $new, ?string $fileTitle = null ): array {
		return [ 'kind' => $fileTitle === null ? 'slide' : 'file', 'fileTitle' => $fileTitle,
			'oldName' => $old, 'newName' => $new ];
	}

	public function testScopedRenameChangesOnlyTheMatchingFileAndOwner(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$embeds = [ '[[File:A.jpg|layerset=7:ABC]]', '[[File:B.jpg|layerset=7:ABC]]',
			'{{#Slide:7:ABC}}', '[[Image:A.jpg|thumb|layers = 7:abc|Caption]]',
			'[[File:A.jpg|layerset=8:ABC]]', '[[File:A.jpg|layerset=7:ABC]]' ];
		$expected = [ '[[File:A.jpg|layerset=7:XYZ]]', $embeds[1], $embeds[2],
			'[[Image:A.jpg|thumb|layers =7:XYZ|Caption]]', $embeds[4], '[[File:A.jpg|layerset=7:XYZ]]' ];
		$renames = [ $this->renameRecord( 'ABC', 'XYZ', 'File:A.jpg' ),
			$this->renameRecord( 'Missing', 'Unused', 'File:B.jpg' ) ];
		foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
			$this->assertSame( implode( "\n", $expected ), $rewriter->renameScopedReferences(
				implode( "\n", $embeds ), 7, $instructions, [ $this, 'file' ] ) );
		}
	}

	public function testIndependentFileRenamesAreDescriptorAndEmbedOrderIndependent(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$renames = [ $this->renameRecord( 'ABC', 'X', 'File:A.jpg' ),
			$this->renameRecord( 'ABC', 'Y', 'File:B.jpg' ) ];
		$embeds = [ '[[File:A.jpg|layerset=7:ABC]]', '[[File:B.jpg|layerset=7:ABC]]', '{{#Slide:7:ABC}}' ];
		$expected = [ '[[File:A.jpg|layerset=7:X]]', '[[File:B.jpg|layerset=7:Y]]', $embeds[2] ];
		foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
			$this->assertSame( implode( ' ', $expected ), $rewriter->renameScopedReferences(
				implode( ' ', $embeds ), 7, $instructions, [ $this, 'file' ] ) );
			$this->assertSame( implode( ' ', array_reverse( $expected ) ), $rewriter->renameScopedReferences(
				implode( ' ', array_reverse( $embeds ) ), 7, $instructions, [ $this, 'file' ] ) );
		}
	}

	public function testScopedPdfRenamePreservesEveryPageOptionAcrossTheWholeSet(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$options = [ 'page=1|', 'page=2|', '', 'page=1|page=2|', 'page 2|', 'seite=2|', 'page =2|' ];
		$embeds = [];
		$expected = [];
		foreach ( $options as $option ) {
			$embeds[] = '[[Image:Manual.pdf|thumb|' . $option . 'layerset=7:ABC|Caption]]';
			$expected[] = '[[Image:Manual.pdf|thumb|' . $option . 'layerset=7:XYZ|Caption]]';
		}
		$other = '[[File:Other.pdf|page=2|layerset=7:ABC]]';
		$this->assertSame( implode( "\n", $expected ) . $other, $rewriter->renameScopedReferences(
			implode( "\n", $embeds ) . $other, 7,
			[ $this->renameRecord( 'ABC', 'XYZ', 'File:Manual.pdf' ) ], [ $this, 'file' ] ) );
	}

	public function testScopedSlideRenamePreservesItsOptionsAndLeavesFilesUntouched(): void {
		$text = '{{#Slide: 7:ABC |width=400|layerset=Other|layers=another|noedit}} ' .
			'[[File:A.jpg|layerset=7:ABC]] {{#Slide:8:ABC}}';
		$this->assertSame( '{{#Slide: 7:XYZ |width=400|layerset=Other|layers=another|noedit}} ' .
			'[[File:A.jpg|layerset=7:ABC]] {{#Slide:8:ABC}}',
			( new DirectEmbeddingRewriter() )->renameScopedReferences( $text, 7,
				[ $this->renameRecord( 'ABC', 'XYZ' ) ], [ $this, 'file' ] ) );
	}

	public function testScopedSlideRenamePreservesLeadingWhitespaceAcceptedByScanner(): void {
		$rewriter = new DirectEmbeddingRewriter();
		foreach ( [ ' ', "\t", "\n  " ] as $space ) {
			foreach ( [ false, true ] as $bareNames ) {
				$name = $bareNames ? 'ABC' : '7:ABC';
				$text = '{{' . $space . '#Slide: ' . $name . ' |width=400|noedit}}';
				$this->assertCount( 1, $rewriter->scan( $text, [ $this, 'file' ] ) );
				$this->assertSame( '{{' . $space . '#Slide: 7:XYZ |width=400|noedit}}',
					$rewriter->renameScopedReferences( $text, 7, [ $this->renameRecord( 'ABC', 'XYZ' ) ],
						[ $this, 'file' ], $bareNames ) );
			}
		}
	}

	public function testScopedSwapsUseOriginalIdentitiesWithoutCascading(): void {
		$text = '{{#Slide:7:A}}{{#Slide:7:B}} [[File:Manual.pdf|page=1|layerset=7:A]]' .
			'[[File:Manual.pdf|page=2|layerset=7:B]]';
		$expected = '{{#Slide:7:B}}{{#Slide:7:A}} [[File:Manual.pdf|page=1|layerset=7:B]]' .
			'[[File:Manual.pdf|page=2|layerset=7:A]]';
		$renames = [ $this->renameRecord( 'A', 'B' ), $this->renameRecord( 'B', 'A' ),
			$this->renameRecord( 'A', 'B', 'File:Manual.pdf' ), $this->renameRecord( 'B', 'A', 'File:Manual.pdf' ) ];
		foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
			$this->assertSame( $expected, ( new DirectEmbeddingRewriter() )->renameScopedReferences(
				$text, 7, $instructions, [ $this, 'file' ] ) );
		}
	}

	public function testScopedBareNamesFollowTheGateWithoutChangingGenericIntents(): void {
		$renames = [ $this->renameRecord( 'ABC', 'XYZ', 'File:A.jpg' ), $this->renameRecord( 'ABC', 'Plans' ),
			$this->renameRecord( 'on', 'Literal on', 'File:A.jpg' ),
			$this->renameRecord( 'off', 'Literal off', 'File:A.jpg' ) ];
		$text = '[[File:A.jpg|layerset=ABC]] [[File:A.jpg|layers=name:ABC]] ' .
			'[[File:A.jpg|layerset=7:ABC]] [[File:A.jpg|layerset=8:ABC]] {{#Slide:ABC}} ' .
			'[[File:A.jpg|layerset=on]] [[File:A.jpg|layerset=off]] ' .
			'[[File:A.jpg|layerset=7:on]] [[File:A.jpg|layers=7:off]]';
		$common = '[[File:A.jpg|layerset=7:XYZ]] [[File:A.jpg|layerset=8:ABC]] ';
		$suffix = ' [[File:A.jpg|layerset=on]] [[File:A.jpg|layerset=off]] ' .
			'[[File:A.jpg|layerset=7:Literal on]] [[File:A.jpg|layers=7:Literal off]]';
		$rewriter = new DirectEmbeddingRewriter();
		$this->assertSame( '[[File:A.jpg|layerset=ABC]] [[File:A.jpg|layers=name:ABC]] ' .
			$common . '{{#Slide:ABC}}' . $suffix,
			$rewriter->renameScopedReferences( $text, 7, $renames, [ $this, 'file' ] ) );
		$this->assertSame( '[[File:A.jpg|layerset=7:XYZ]] [[File:A.jpg|layers=7:XYZ]] ' .
			$common . '{{#Slide:7:Plans}}' . $suffix,
			$rewriter->renameScopedReferences( $text, 7, $renames, [ $this, 'file' ], true ) );
	}

	public function testScopedRenamePreservesProtectedSourceAndUtf8Offsets(): void {
		$protected = 'café 漢字 <!-- [[File:A.jpg|layerset=7:ABC]] -->' .
			'<nowiki>[[File:A.jpg|layerset=7:ABC]]</nowiki>' .
			'<ref>[[File:A.jpg|layerset=7:ABC]]</ref>' .
			'{{Box|[[File:A.jpg|layerset=7:ABC]]}} [[File:{{Name}}|layerset=7:ABC]] ' .
			'[[File:A.jpg|layerset=7:ABC|See [[Help:Layers]]]] [[:File:A.jpg|layerset=7:ABC]] ' .
			'[[Help:Layers|layerset=7:ABC]] [[File:A.jpg|layersbinding=v1:7:x]] ' .
			'{{#Slide:7:ABC|layersbinding=v1:7:x}}';
		$text = $protected . ' [[File:A.jpg|layerset=7:ABC]] naïve {{#Slide:7:ABC}}';
		$this->assertSame( $protected . ' [[File:A.jpg|layerset=7:XYZ]] naïve {{#Slide:7:Plans}}',
			( new DirectEmbeddingRewriter() )->renameScopedReferences( $text, 7,
				[ $this->renameRecord( 'ABC', 'XYZ', 'File:A.jpg' ), $this->renameRecord( 'ABC', 'Plans' ) ],
				[ $this, 'file' ] ) );
	}

	/** @dataProvider provideAmbiguousScopedSelectors @param string $options */
	public function testScopedRenameSkipsAmbiguousSelectorsAndRenamesIndependentCandidates( string $options ): void {
		$ambiguous = '[[File:A.jpg|' . $options . ']]';
		$text = $ambiguous . ' [[File:A.jpg|layerset=7:ABC]]';
		$this->assertSame( $ambiguous . ' [[File:A.jpg|layerset=7:XYZ]]',
			( new DirectEmbeddingRewriter() )->renameScopedReferences( $text, 7,
				[ $this->renameRecord( 'ABC', 'XYZ', 'File:A.jpg' ) ], [ $this, 'file' ], true ) );
	}

	public static function provideAmbiguousScopedSelectors(): array {
		return array_map( static fn ( $options ) => [ $options ], [
			'layerset=7:ABC|layersbinding=v1:7:x', 'layersbinding=v1:7:x|layerset=ABC',
			'layerset=7:ABC|layersbinding', 'layerset=7:ABC|layersbinding=',
			'layerset=7:ABC|layerset=7:ABC', 'layerset=ABC|layerset=ABC',
			'layers=7:ABC|layerset=7:ABC', 'layers=ABC|layerset=ABC',
			'layerset=7:ABC|layerset=Other', 'layerset=ABC|layers=7:ABC',
			'layerset=7:ABC|layer=ABC', 'layerset=ABC|layersetid=10',
			'layerset=7:ABC|layers', 'layerset=7:ABC|LAYERSET=' ] );
	}

	public function testScopedEquivalentDuplicateInstructionsCoalesceButKeepDisplayCase(): void {
		$renames = [ $this->renameRecord( '  Pump__LABELS  ', 'Pump tags', 'File:A.jpg' ),
			$this->renameRecord( "Pump \t labels", 'Pump tags', 'File:A.jpg' ) ];
		$text = '[[File:A.jpg|layerset=7:pump_labels]]';
		foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
			$this->assertSame( '[[File:A.jpg|layerset=7:Pump tags]]',
				( new DirectEmbeddingRewriter() )->renameScopedReferences(
					$text, 7, $instructions, [ $this, 'file' ] ) );
		}
		$this->assertSame( 'No embed', ( new DirectEmbeddingRewriter() )->renameScopedReferences(
			'No embed', 7, [ $this->renameRecord( 'Unusable|old:name', 'Valid', 'File:A.jpg' ) ], [ $this, 'file' ] ) );
	}

	public function testScopedUnexpressibleOldNamesCannotSelectUnderscoreNames(): void {
		$rewriter = new DirectEmbeddingRewriter();
		$text = '[[File:A.jpg|layerset=7:_]] {{#Slide:7:_}}';
		foreach ( [ '', ' ', "\xff", "a\xff", 'Unusable|old:name' ] as $oldName ) {
			$this->assertSame( $text, $rewriter->renameScopedReferences( $text, 7, [
				$this->renameRecord( $oldName, 'Wrong file', 'File:A.jpg' ),
				$this->renameRecord( $oldName, 'Wrong slide' )
			], [ $this, 'file' ] ) );
		}
		$renames = [ $this->renameRecord( '', 'Unused', 'File:A.jpg' ),
			$this->renameRecord( '  _  ', 'File set', 'File:A.jpg' ),
			$this->renameRecord( '_', 'Slide set' ) ];
		foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
			$this->assertSame( '[[File:A.jpg|layerset=7:File set]] {{#Slide:7:Slide set}}',
				$rewriter->renameScopedReferences( $text, 7, $instructions, [ $this, 'file' ] ) );
		}
	}

	public function testScopedConflictingUnexpressibleInstructionsStillRefuse(): void {
		$renames = [ $this->renameRecord( '', 'First', 'File:A.jpg' ),
			$this->renameRecord( ' ', 'Second', 'File:A.jpg' ) ];
		foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
			try {
				( new DirectEmbeddingRewriter() )->renameScopedReferences( 'No embed', 7, $instructions,
					[ $this, 'file' ] );
				$this->fail( 'Conflicting instructions refuse even when their old name cannot match' );
			} catch ( \InvalidArgumentException $exception ) {
				$this->assertSame( 'layers-embedding-source-unavailable', $exception->getMessage() );
			}
		}
	}

	/** @dataProvider provideScopedConflictingDestinations @param string $destination */
	public function testScopedConflictingInstructionsRefuseInEitherOrderWithoutEmbeds( string $destination ): void {
		$renames = [ $this->renameRecord( 'ABC', 'Plans', 'File:A.jpg' ),
			$this->renameRecord( ' abc ', $destination, 'File:A.jpg' ) ];
		foreach ( [ $renames, array_reverse( $renames ) ] as $instructions ) {
			try {
				( new DirectEmbeddingRewriter() )->renameScopedReferences( 'No matching embed', 7,
					$instructions, [ $this, 'file' ] );
				$this->fail( 'Conflicting display destinations must refuse' );
			} catch ( \InvalidArgumentException $exception ) {
				$this->assertSame( 'layers-embedding-source-unavailable', $exception->getMessage() );
			}
		}
	}

	public static function provideScopedConflictingDestinations(): array {
		return [ [ 'Other' ], [ 'plans' ] ];
	}

	/** @dataProvider provideInvalidScopedRequests @param int $owner @param array $renames */
	public function testScopedRequestValidationRefusesBeforeScanning( int $owner, array $renames ): void {
		$rewriter = $this->getMockBuilder( DirectEmbeddingRewriter::class )->onlyMethods( [ 'scan' ] )->getMock();
		$rewriter->expects( $this->never() )->method( 'scan' );
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-embedding-source-unavailable' );
		$rewriter->renameScopedReferences( 'No matching embed', $owner, $renames, [ $this, 'file' ] );
	}

	public static function provideInvalidScopedRequests(): array {
		$valid = [ 'kind' => 'file', 'fileTitle' => 'File:A.jpg', 'oldName' => 'ABC', 'newName' => 'XYZ' ];
		$cases = [ [ 0, [ $valid ] ], [ -1, [] ], [ 2147483648, [] ],
			[ 7, [ 'record' => $valid ] ], [ 7, [ 1 => $valid ] ], [ 7, [ null ] ], [ 7, [ 'record' ] ],
			[ 7, [ $valid + [ 'extra' => true ] ] ] ];
		foreach ( array_keys( $valid ) as $key ) {
			$missing = $valid;
			unset( $missing[$key] );
			$cases[] = [ 7, [ $missing ] ];
		}
		foreach ( [ [ 'kind', 'pdf' ], [ 'kind', 1 ], [ 'fileTitle', null ], [ 'fileTitle', 10 ],
			[ 'fileTitle', 'Image:A.jpg' ], [ 'fileTitle', 'File:A.jpg#Section' ],
			[ 'oldName', null ], [ 'oldName', 1 ], [ 'newName', null ], [ 'newName', 1 ],
			[ 'newName', '' ], [ 'newName', ' XYZ' ], [ 'newName', 'X  Y' ], [ 'newName', 'X|Y' ],
			[ 'newName', 'X:Y' ], [ 'newName', str_repeat( 'X', 256 ) ] ] as [ $key, $value ]
		) {
			$invalid = $valid;
			$invalid[$key] = $value;
			$cases[] = [ 7, [ $valid, $invalid ] ];
		}
		$slide = $valid;
		$slide['kind'] = 'slide';
		$cases[] = [ 7, [ $slide ] ];
		return $cases;
	}

	public function testScopedIdentityFieldsCannotCollideThroughConcatenation(): void {
		$text = '[[File:A/B.png|layerset=7:C]] [[File:A|layerset=7:B.png/C]]';
		$this->assertSame( '[[File:A/B.png|layerset=7:X]] [[File:A|layerset=7:Y]]',
			( new DirectEmbeddingRewriter() )->renameScopedReferences( $text, 7, [
				$this->renameRecord( 'C', 'X', 'File:A/B.png' ),
				$this->renameRecord( 'B.png/C', 'Y', 'File:A' ) ], [ $this, 'file' ] ) );
	}
}
