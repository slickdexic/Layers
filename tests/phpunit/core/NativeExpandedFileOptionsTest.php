<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Revision\ExpandedFileOptions;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Parser\ParserOptions;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\ExpandedFileOptions
 * @group Database
 */
class NativeExpandedFileOptionsTest extends RealAssetTestCase {
	protected function setUp(): void {
		parent::setUp();
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repos->method( 'findFile' )->willReturnCallback( fn ( $title ) => $this->repo->findFile( $title ) );
		$this->setService( 'RepoGroup', $repos );
	}

	/** @return array */
	public static function provideBoundaryCases(): array {
		return [
			'literal-colon' => [ '[[:FILE|ordinary link]]\n', 'Native caption', '' ],
			'encoded-colon' => [ '[[%3AFILE|ordinary link]]\n', 'Native caption', '' ],
			'malformed-head' => [ '[[FILE]broken]]\n', 'Native caption', '' ],
			'empty-option' => [ '[[FILE|]]\n', 'Native caption', '' ],
			'external-triple-close' => [ '', '[https://example.org native external label]', '' ],
			'nested-literal-trailing-bracket' => [ '', 'Caption [[Main Page|native label]]', ']' ]
		];
	}

	/**
	 * @dataProvider provideBoundaryCases
	 * @param string $prefix
	 * @param string $caption
	 * @param string $trailing
	 */
	public function testNativeBoundaryDifferential( string $prefix, string $caption, string $trailing ): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Expanded-options-' . wfRandomString( 8 ) . '.png' );
		$title = $file->getTitle()->getPrefixedDBkey();
		$prefix = str_replace( 'FILE', $title, $prefix );
		$image = '[[' . $title . '|thumb|80px|alt=Native alt|class=native-options|' . $caption . ']]';
		$source = $prefix . $image . $trailing . "\nAFTER\n" . $image;
		$page = $this->getExistingTestPage();
		$before = $this->witness();
		$captures = [];
		$this->setTemporaryHook( 'InternalParseBeforeLinks', static function ( $parser, &$text ) use ( &$captures ) {
			$files = ExpandedFileOptions::collect( $parser, $text );
			foreach ( $files as $occurrence ) {
				if ( $occurrence['parser'] !== $parser || $occurrence['stripState'] !== $parser->getStripState() ) {
					throw new \RuntimeException( 'Collector escaped native invocation' );
				}
			}
			$captures[] = [ 'expanded' => $text, 'files' => $files ];
		}, true );
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$native = $parser->parse( $source, $page->getTitle(), ParserOptions::newFromAnon() )->getRawText();
		$first = $captures[0];
		$this->retain( [ 'source' => $source, 'native' => $native, 'expanded' => $first['expanded'],
			'files' => array_map( static function ( array $item ): array {
				unset( $item['parser'], $item['stripState'], $item['invocation'] );
				return $item;
			}, $first['files'] ) ] );
		try {
			$this->assertCount( 2, $first['files'], 'Ordinary file links cannot consume image queue slots' );
			foreach ( $first['files'] as $occurrence ) {
				$this->assertSame( $image, $occurrence['raw'],
					'Only the native image, not trailing text, belongs to its extent' );
				$this->assertSame( $image, substr( $first['expanded'], $occurrence['start'], $occurrence['length'] ) );
				$this->assertSame( 'File:' . $file->getName(), $occurrence['target'] );
				$this->assertSame( [ 'thumb', '80px', 'alt=Native alt', 'class=native-options', $caption ],
					$occurrence['options'] );
			}
			$this->assertSame( $first['files'][0]['invocation'], $first['files'][1]['invocation'] );
			$this->assertStringContainsString( 'AFTER', $native );
			$this->assertSame( 2, substr_count( $native, '<img ' ) );
			$captures = [];
			$reconstructed = $source;
			foreach ( array_reverse( $first['files'] ) as $occurrence ) {
				$reconstructed = substr_replace( $reconstructed, '[[' . $occurrence['head'] . '|' .
					implode( '|', $occurrence['options'] ) . ']]', $occurrence['start'], $occurrence['length'] );
			}
			$again = $parser->parse( $reconstructed, $page->getTitle(), ParserOptions::newFromAnon() )->getRawText();
			$this->retain( [ 'reconstructed' => $reconstructed, 'differential' => $again ] );
			$this->assertSame( $source, $reconstructed );
			$this->assertSame( 2, preg_match_all( '/ data-layers-instance="[^"]*"/', $native ) );
			$this->assertSame( 2, preg_match_all( '/ data-layers-instance="[^"]*"/', $again ) );
			$this->assertSame( preg_replace( '/ data-layers-instance="[^"]*"/', '', $native ),
				preg_replace( '/ data-layers-instance="[^"]*"/', '', $again ),
				'Only the intentional runtime instance token differs; native output is byte-identical' );
			$this->assertNotSame( $first['files'][0]['invocation'], $captures[0]['files'][0]['invocation'] );
		} finally {
			$this->assertSame( $before, $this->witness() );
		}
	}

	/** @return array */
	public static function provideOrderedCases(): array {
		return [
			'multiple-internal' => [ 'First [[Main Page|layerset=off]] and [[Help:Contents|second label]]' ],
			'external-caption-pipe' => [ '[https://example.org native label|layerset=off]' ],
			'opaque-nowiki' => [ '<nowiki>[[File:Hidden.png|layerset=off]]|layersbinding=hidden</nowiki>' ],
			'conversion-delimiters' => [ '-{en:Caption|layerset=off;zh:Other}-' ]
		];
	}

	/**
	 * @dataProvider provideOrderedCases
	 * @param string $caption
	 */
	public function testOrderedOpaqueAndTemplatedNeighbors( string $caption ): void {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Expanded-ordered-' . wfRandomString( 8 ) . '.png' );
		$template = $this->getExistingTestPage( 'Template:Expanded-options-' . wfRandomString( 8 ) );
		$templateText = '[[Image:' . $file->getName() . '|thumb|80px|Templated caption]]';
		$this->editPage( $template, $templateText );
		$page = $this->getExistingTestPage();
		$image = '[[Image:' . $file->getName() . '|thumb|80x60px|alt=Ordered alt|class=ordered-native|' .
			'link=Main Page|' . $caption . '|layerset=on]]';
		$source = $image . "\n[[File:" . $file->getName() . '|40px|Unlayered]]' . "\n{{" .
			$template->getTitle()->getPrefixedDBkey() . '}}';
		$before = $this->witness();
		$captures = [];
		$stripOptions = false;
		$this->setTemporaryHook( 'InternalParseBeforeLinks', static function ( $parser, &$text ) use (
			&$captures, &$stripOptions
		) {
			$files = ExpandedFileOptions::collect( $parser, $text );
			$captures[] = [ 'expanded' => $text, 'files' => $files ];
			if ( $stripOptions ) {
				foreach ( array_reverse( $files ) as $item ) {
					$options = array_values( array_filter( $item['options'], static fn ( string $part ): bool =>
						!preg_match( '/\A\s*(?:layerset|layers|layer|layersetid|layersbinding)\s*=/i', $part ) ) );
					$text = substr_replace( $text, '[[' . $item['head'] . '|' . implode( '|', $options ) . ']]',
						$item['start'], $item['length'] );
				}
			}
		}, true );
		$parser = $this->getServiceContainer()->getParserFactory()->create();
		$core = $parser->parse( str_replace( '|layerset=on]]', ']]', $source ), $page->getTitle(),
			ParserOptions::newFromAnon() )->getRawText();
		$captures = [];
		$stripOptions = true;
		$actual = $parser->parse( $source, $page->getTitle(), ParserOptions::newFromAnon() )->getRawText();
		$first = $captures[0];
		$this->retain( [ 'source' => $source, 'native' => $core, 'differential' => $actual,
			'expanded' => $first['expanded'], 'files' => array_map( static function ( array $item ): array {
				unset( $item['parser'], $item['stripState'], $item['invocation'] );
				return $item;
			}, $first['files'] ) ] );
		try {
			$this->assertCount( 3, $first['files'] );
			$this->assertSame( [ 'thumb', '80x60px', 'alt=Ordered alt', 'class=ordered-native', 'link=Main Page' ],
				array_slice( $first['files'][0]['options'], 0, 5 ) );
			$this->assertCount( 7, $first['files'][0]['options'] );
			$this->assertSame( 'layerset=on', $first['files'][0]['options'][6] );
			$this->assertSame( [ '40px', 'Unlayered' ], $first['files'][1]['options'] );
			$this->assertSame( [ 'thumb', '80px', 'Templated caption' ], $first['files'][2]['options'] );
			foreach ( $first['files'] as $item ) {
				$this->assertSame( 'File:' . $file->getName(), $item['target'] );
				$this->assertSame( $item['raw'], substr( $first['expanded'], $item['start'], $item['length'] ) );
			}
			$this->assertSame( 3, substr_count( $core, '<img ' ) );
			$this->assertSame( 3, substr_count( $actual, '<img ' ) );
			$this->assertSame( preg_replace( '/ data-layers-instance="[^"]*"/', '', $core ),
				preg_replace( '/ data-layers-instance="[^"]*"/', '', $actual ) );
		} finally {
			$after = $this->witness();
			$this->retain( [ 'before' => base64_encode( $before ), 'after' => base64_encode( $after ) ] );
			$this->assertSame( $before, $after );
		}
	}

	/** @return string */
	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$tables[$table] = $rows;
		}
		return serialize( $tables );
	}

	/** @param array $evidence */
	private function retain( array $evidence ): void {
		$output = getenv( 'LAYERS_CREATION_WITNESSES' );
		if ( $output ) {
			file_put_contents( $output, json_encode( [ 'case' => $this->getName(), 'collector' => $evidence ] ) . "\n",
				FILE_APPEND | LOCK_EX );
		}
	}
}
