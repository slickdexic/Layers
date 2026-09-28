<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;

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
}
