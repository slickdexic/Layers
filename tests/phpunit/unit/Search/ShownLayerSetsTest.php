<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Search;

use InvalidArgumentException;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\Parser\Parser;
use MediaWikiUnitTestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Search\ShownLayerSets
 */
class ShownLayerSetsTest extends MediaWikiUnitTestCase {

	/**
	 * @param string|null $initialProperty
	 * @return array{0: Parser, 1: object}
	 */
	private function createMockParser( ?string $initialProperty = null ): array {
		$output = new class( $initialProperty ) {
			private ?string $property;

			public function __construct( ?string $initialProperty ) {
				$this->property = $initialProperty;
			}

			public function getPageProperty( string $name ): ?string {
				return $name === ShownLayerSets::PROPERTY ? $this->property : null;
			}

			public function setUnsortedPageProperty( string $name, string $value ): void {
				if ( $name === ShownLayerSets::PROPERTY ) {
					$this->property = $value;
				}
			}

			public function getProperty(): ?string {
				return $this->property;
			}
		};

		$builder = $this->getMockBuilder( Parser::class );
		if ( method_exists( Parser::class, 'getOutput' ) ) {
			$builder->onlyMethods( [ 'getOutput' ] );
		} else {
			$builder->addMethods( [ 'getOutput' ] );
		}
		$parser = $builder->getMock();
		$parser->method( 'getOutput' )->willReturn( $output );

		return [ $parser, $output ];
	}

	public function testOldCallsReverseOrderAndDuplicatesProduceByteIdenticalOutput(): void {
		// Forward order
		[ $parser1, $output1 ] = $this->createMockParser();
		ShownLayerSets::note( $parser1, 'file', 'My "Special"/File/Über.png', 'Set/1' );
		ShownLayerSets::note( $parser1, 'slide', 'Intro/Slide <1>', 'Dark/Mode' );
		// Duplicate note of the same slide
		ShownLayerSets::note( $parser1, 'slide', 'Intro/Slide <1>', 'Dark/Mode' );

		// Reverse order
		[ $parser2, $output2 ] = $this->createMockParser();
		ShownLayerSets::note( $parser2, 'slide', 'Intro/Slide <1>', 'Dark/Mode' );
		ShownLayerSets::note( $parser2, 'file', 'My "Special"/File/Über.png', 'Set/1' );
		// Duplicate note of the same file
		ShownLayerSets::note( $parser2, 'file', 'My "Special"/File/Über.png', 'Set/1' );

		$expectedBytes = '[["file","My \"Special\"/File/Über.png","Set/1"],["slide","Intro/Slide <1>","Dark/Mode"]]';
		$this->assertSame( $expectedBytes, $output1->getProperty() );
		$this->assertSame( $expectedBytes, $output2->getProperty() );

		$decoded = ShownLayerSets::decode( $expectedBytes );
		$this->assertSame(
			[
				[ 'file', 'My "Special"/File/Über.png', 'Set/1' ],
				[ 'slide', 'Intro/Slide <1>', 'Dark/Mode' ],
			],
			$decoded
		);
	}

	public function testExactPageTwoStoredBytesAndSourcePageAccessor(): void {
		[ $parser, $output ] = $this->createMockParser();
		ShownLayerSets::note( $parser, 'file', 'Doc.pdf', 'ABC', 2 );

		$expected = '[["file","Doc.pdf","ABC",2]]';
		$this->assertSame( $expected, $output->getProperty() );

		$decoded = ShownLayerSets::decode( $expected );
		$this->assertSame( [ [ 'file', 'Doc.pdf', 'ABC', 2 ] ], $decoded );

		// sourcePage accessor
		$this->assertSame( 2, ShownLayerSets::sourcePage( $decoded[0] ) );
		$this->assertSame( 1, ShownLayerSets::sourcePage( [ 'file', 'Doc.pdf', 'ABC' ] ) );
		$this->assertSame( 1, ShownLayerSets::sourcePage( [ 'slide', 'Slide1', '' ] ) );
	}

	public function testMixedTriplesAndPagesWithPageOneNormalizationAndPreservation(): void {
		// Raw property with explicit page 1 quadruple, page 2, page 3, and slide
		$initial = '[["file","Doc.pdf","SetA",1],["file","Doc.pdf","SetB",2],' .
			'["file","Doc.pdf","SetC",3],["slide","S1",""]]';
		$decoded = ShownLayerSets::decode( $initial );

		// Explicit page 1 normalizes to triple; pages 2 and 3 remain quadruples
		$this->assertSame(
			[
				[ 'file', 'Doc.pdf', 'SetA' ],
				[ 'file', 'Doc.pdf', 'SetB', 2 ],
				[ 'file', 'Doc.pdf', 'SetC', 3 ],
				[ 'slide', 'S1', '' ],
			],
			$decoded
		);

		// Note a new unrelated slide; earlier page 2 and page 3 quadruples must be preserved
		[ $parser, $output ] = $this->createMockParser( $initial );
		ShownLayerSets::note( $parser, 'slide', 'S2', 'Dark' );

		$expected = '[["file","Doc.pdf","SetA"],["file","Doc.pdf","SetB",2],' .
			'["file","Doc.pdf","SetC",3],["slide","S1",""],["slide","S2","Dark"]]';
		$this->assertSame( $expected, $output->getProperty() );

		// Further note an explicit page-1 entry for Doc.pdf SetA: it must deduplicate with SetA triple
		ShownLayerSets::note( $parser, 'file', 'Doc.pdf', 'SetA', 1 );
		$this->assertSame( $expected, $output->getProperty() );
	}

	/**
	 * @dataProvider provideMalformedTuples
	 */
	public function testDecodeDropsMalformedTuples( string $description, ?string $raw, array $expected ): void {
		$actual = ShownLayerSets::decode( $raw );
		$this->assertSame( $expected, $actual, "Failed for case: $description" );
	}

	public function provideMalformedTuples(): array {
		return [
			'page 0 dropped' => [
				'page 0',
				'[["file","A.pdf","set",0]]',
				[],
			],
			'negative page dropped' => [
				'negative page',
				'[["file","A.pdf","set",-1]]',
				[],
			],
			'string page dropped' => [
				'string page',
				'[["file","A.pdf","set","2"]]',
				[],
			],
			'float page dropped' => [
				'float page',
				'[["file","A.pdf","set",2.5]]',
				[],
			],
			'bool page dropped' => [
				'bool page',
				'[["file","A.pdf","set",true]]',
				[],
			],
			'null page dropped' => [
				'null page',
				'[["file","A.pdf","set",null]]',
				[],
			],
			'slide quadruple dropped' => [
				'slide quadruple',
				'[["slide","S1","",2]]',
				[],
			],
			'slide quadruple with page 1 dropped' => [
				'slide quadruple page 1',
				'[["slide","S1","",1]]',
				[],
			],
			'extra fields on quadruple dropped' => [
				'extra field on quadruple',
				'[["file","A.pdf","set",2,"extra"]]',
				[],
			],
			'extra fields on triple dropped' => [
				'extra field on triple',
				'[["file","A.pdf","set","extra"]]',
				[],
			],
			'two-element tuple dropped' => [
				'two element tuple',
				'[["file","A.pdf"]]',
				[],
			],
			'empty name dropped' => [
				'empty name',
				'[["file","","set"]]',
				[],
			],
			'invalid kind dropped' => [
				'invalid kind',
				'[["image","A.png","set"]]',
				[],
			],
			'non-string name dropped' => [
				'non string name',
				'[["file",123,"set"]]',
				[],
			],
			'non-string set dropped' => [
				'non string set',
				'[["file","A.pdf",123]]',
				[],
			],
			'not array of arrays dropped' => [
				'not array of arrays',
				'["not-array-of-arrays"]',
				[],
			],
			'associative tuple dropped' => [
				'associative tuple',
				'[{"kind":"file","name":"A.pdf","set":"set"}]',
				[],
			],
			'not json returns empty' => [
				'not json',
				'invalid-json-string',
				[],
			],
			'null returns empty' => [
				'null value',
				null,
				[],
			],
			'retains literal suffixes in names and selectors' => [
				'literal suffix',
				'[["file","Notes (page 2).pdf","Notes (page 2)",2]]',
				[ [ 'file', 'Notes (page 2).pdf', 'Notes (page 2)', 2 ] ],
			],
		];
	}

	public function testRefusedNoteLeavesPropertyUnchanged(): void {
		$initialBytes = '[["file","A.pdf","set"]]';
		[ $parser, $output ] = $this->createMockParser( $initialBytes );

		// Refuse page 0
		try {
			ShownLayerSets::note( $parser, 'file', 'B.pdf', '', 0 );
			$this->fail( 'Expected InvalidArgumentException for page 0' );
		} catch ( InvalidArgumentException $e ) {
			$this->assertSame( 'Page must be greater than zero', $e->getMessage() );
		}
		$this->assertSame( $initialBytes, $output->getProperty() );

		// Refuse negative page
		try {
			ShownLayerSets::note( $parser, 'file', 'B.pdf', '', -5 );
			$this->fail( 'Expected InvalidArgumentException for negative page' );
		} catch ( InvalidArgumentException $e ) {
			$this->assertSame( 'Page must be greater than zero', $e->getMessage() );
		}
		$this->assertSame( $initialBytes, $output->getProperty() );

		// Refuse slide with page other than 1
		try {
			ShownLayerSets::note( $parser, 'slide', 'SlideX', '', 2 );
			$this->fail( 'Expected InvalidArgumentException for slide page 2' );
		} catch ( InvalidArgumentException $e ) {
			$this->assertSame( 'Slide page must be 1', $e->getMessage() );
		}
		$this->assertSame( $initialBytes, $output->getProperty() );

		// Refuse slide with page 0
		try {
			ShownLayerSets::note( $parser, 'slide', 'SlideX', '', 0 );
			$this->fail( 'Expected InvalidArgumentException for slide page 0' );
		} catch ( InvalidArgumentException $e ) {
			$this->assertSame( 'Page must be greater than zero', $e->getMessage() );
		}
		$this->assertSame( $initialBytes, $output->getProperty() );
	}

	public function testEnforcesFiftyEntryLimitAndNoDuplicateBudgetConsumption(): void {
		[ $parser, $output ] = $this->createMockParser();

		// Add 55 distinct entries
		for ( $i = 1; $i <= 55; $i++ ) {
			ShownLayerSets::note( $parser, 'file', sprintf( 'Doc%02d.pdf', $i ), 'default', 2 );
		}

		$decoded = ShownLayerSets::decode( $output->getProperty() );
		$this->assertCount( 50, $decoded );

		// Test no duplicate budget consumption for equivalent page 1 forms:
		// Setup parser with 49 entries including one page 1 file
		[ $budgetParser, $budgetOutput ] = $this->createMockParser();
		for ( $i = 1; $i <= 48; $i++ ) {
			ShownLayerSets::note( $budgetParser, 'file', sprintf( 'Test%02d.pdf', $i ), 'default' );
		}
		// Note 49th entry as explicit triple
		ShownLayerSets::note( $budgetParser, 'file', 'Target.pdf', 'SetX' );
		$this->assertCount( 49, ShownLayerSets::decode( $budgetOutput->getProperty() ) );

		// Note equivalent entry with explicit page 1: should deduplicate, not reach 50
		ShownLayerSets::note( $budgetParser, 'file', 'Target.pdf', 'SetX', 1 );
		$this->assertCount( 49, ShownLayerSets::decode( $budgetOutput->getProperty() ) );
	}

	public function testFragmentMatchesBothTriplesAndQuadruples(): void {
		$fileFrag = ShownLayerSets::fragment( 'file', 'Doc.pdf' );
		$this->assertSame( '["file","Doc.pdf",', $fileFrag );

		$triple = '["file","Doc.pdf","ABC"]';
		$quadruple = '["file","Doc.pdf","ABC",2]';
		$slide = '["slide","Doc.pdf","ABC"]';

		$this->assertStringContainsString( $fileFrag, $triple );
		$this->assertStringContainsString( $fileFrag, $quadruple );
		$this->assertStringNotContainsString( $fileFrag, $slide );

		$slideFrag = ShownLayerSets::fragment( 'slide', 'Intro' );
		$this->assertSame( '["slide","Intro",', $slideFrag );
		$this->assertStringContainsString( $slideFrag, '["slide","Intro","Dark"]' );
	}

	public function testSameSetPagesRemainDistinctRegardlessOfNoteOrder(): void {
		$expected = '[["file","Doc.pdf","ABC",2],["file","Doc.pdf","ABC",3],["file","Doc.pdf","ABC"]]';
		foreach ( [ [ 1, 2, 3, 2 ], [ 3, 2, 1, 3 ] ] as $pages ) {
			[ $parser, $output ] = $this->createMockParser();
			foreach ( $pages as $page ) {
				ShownLayerSets::note( $parser, 'file', 'Doc.pdf', 'ABC', $page );
			}
			$this->assertSame( $expected, $output->getProperty() );
		}
	}

	public function testRawPageOneQuadrupleAndTripleShareTheLastEntryBudget(): void {
		$triples = [];
		for ( $i = 1; $i <= 48; $i++ ) {
			$triples[] = [ 'file', sprintf( 'Doc%02d.pdf', $i ), 'ABC' ];
		}
		$triples[] = [ 'file', 'Target.pdf', 'ABC' ];
		$raw = array_merge( $triples, [ [ 'file', 'Target.pdf', 'ABC', 1 ] ] );
		[ $parser, $output ] = $this->createMockParser( json_encode( $raw ) );
		ShownLayerSets::note( $parser, 'file', 'Z-last.pdf', 'ABC', 3 );
		$expected = array_merge( $triples, [ [ 'file', 'Z-last.pdf', 'ABC', 3 ] ] );
		$this->assertSame( json_encode( $expected ), $output->getProperty() );
		$this->assertSame( $expected, ShownLayerSets::decode( $output->getProperty() ) );
		$this->assertCount( 50, $expected );
	}

	public function testEscapedUnicodePageMetadataRoundTripsAndMatchesFragment(): void {
		[ $parser, $output ] = $this->createMockParser();
		ShownLayerSets::note( $parser, 'file', 'My "File"/Über.pdf', 'Set "A"/ß', 2 );
		$expected = '[["file","My \\"File\\"/Über.pdf","Set \\"A\\"/ß",2]]';
		$this->assertSame( $expected, $output->getProperty() );
		$this->assertSame( [ [ 'file', 'My "File"/Über.pdf', 'Set "A"/ß', 2 ] ],
			ShownLayerSets::decode( $output->getProperty() ) );
		$fragment = ShownLayerSets::fragment( 'file', 'My "File"/Über.pdf' );
		$this->assertSame( '["file","My \\"File\\"/Über.pdf",', $fragment );
		$this->assertStringContainsString( $fragment, $output->getProperty() );
	}
}
