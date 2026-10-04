<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions
 */
class PageOwnedBindingOptionsTest extends \MediaWikiUnitTestCase {
	/**
	 * @dataProvider provideSourcePages
	 * @param array $options
	 * @param int $expected
	 */
	public function testEffectiveSourcePage( array $options, int $expected ): void {
		// Native syntax matching is injected; core tests verify its aliases and spacing.
		$match = static fn ( string $option ): ?string => str_starts_with( $option, 'page=' ) ?
			substr( $option, 5 ) : null;
		$this->assertSame( $expected, PageOwnedBindingOptions::sourcePage( $options, $match ) );
	}

	public static function provideSourcePages(): array {
		return [
			[ [], 1 ],
			[ [ 'page=2' ], 2 ],
			[ [ 'page=1', 'page=2' ], 2 ],
			[ [ 'page=2', 'page=1' ], 1 ],
			[ [ 'page=2', 'page=oops', 'page=0', 'page=-1', 'page=02', 'page=2x' ], 2 ],
			[ [ 'page=oops' ], 1 ],
			[ [ 'page=3' ], 3 ],
			[ [ 'page= 2 ' ], 2 ]
		];
	}

	public function testReturnsNullWhenNoBindingPresent(): void {
		$this->assertNull( PageOwnedBindingOptions::extract( [] ) );
		$this->assertNull( PageOwnedBindingOptions::extract( [ 'thumb', 'right', 'alt=Diagram' ] ) );
		$this->assertNull( PageOwnedBindingOptions::extract( [ 'layerset=default', 'page=1' ] ) );
		$this->assertNull( PageOwnedBindingOptions::extract( [ 'layers=on', 'layer=2', 'layersetid=42' ] ) );
		$this->assertNull( PageOwnedBindingOptions::extract( [ 'layerslink=view', 'A caption' ] ) );
		$this->assertNull( PageOwnedBindingOptions::extract( [ 'A caption mentioning layersbinding' ] ) );
	}

	public function testExtractsValidBindingWithVariousOptionPositions(): void {
		$expected = [ 'pageId' => 100, 'surfaceId' => 'surf1' ];

		$this->assertSame( $expected, PageOwnedBindingOptions::extract( [
			'layersbinding=v1:100:surf1', 'caption', 'page=2', 'layerslink=view'
		] ) );
		$this->assertSame( $expected, PageOwnedBindingOptions::extract( [
			'thumb', 'page=3', 'layerslink=edit', 'A caption', 'layersbinding=v1:100:surf1'
		] ) );
		$this->assertSame( $expected, PageOwnedBindingOptions::extract( [
			'page=1', 'layersbinding=v1:100:surf1', 'layerslink'
		] ) );
		$this->assertSame( $expected, PageOwnedBindingOptions::extract( [
			'thumb', 'thumb', 'layersbinding=v1:100:surf1'
		] ) );
	}

	public function testPreservesCaseOfSurfaceId(): void {
		$mixed = PageOwnedBindingOptions::extract( [ 'layersbinding=v1:42:Drawing_Surface-Alpha_99' ] );
		$this->assertSame( [ 'pageId' => 42, 'surfaceId' => 'Drawing_Surface-Alpha_99' ], $mixed );

		$lower = PageOwnedBindingOptions::extract( [ 'layersbinding=v1:42:drawing_surface-alpha_99' ] );
		$this->assertSame( [ 'pageId' => 42, 'surfaceId' => 'drawing_surface-alpha_99' ], $lower );
		$this->assertNotSame( $mixed, $lower );

		// Option name casing is normalized, but value case is preserved
		$upperName = PageOwnedBindingOptions::extract( [ 'LAYERSBINDING=v1:42:SurfaceA' ] );
		$this->assertSame( [ 'pageId' => 42, 'surfaceId' => 'SurfaceA' ], $upperName );

		$pascalName = PageOwnedBindingOptions::extract( [ 'LayersBinding=v1:42:SurfaceA' ] );
		$this->assertSame( [ 'pageId' => 42, 'surfaceId' => 'SurfaceA' ], $pascalName );
	}

	public function testHandlesSurroundingOptionWhitespace(): void {
		$expected = [ 'pageId' => 55, 'surfaceId' => 'surface_one' ];

		$this->assertSame( $expected,
			PageOwnedBindingOptions::extract( [ '  layersbinding  =  v1:55:surface_one  ' ] ) );
		$this->assertSame( $expected,
			PageOwnedBindingOptions::extract( [ "\tlayersbinding\t=\tv1:55:surface_one\t" ] ) );
		$this->assertSame( $expected,
			PageOwnedBindingOptions::extract( [ '  thumb  ', '  layersbinding=v1:55:surface_one  ', '  caption  ' ] ) );
	}

	/**
	 * @dataProvider provideMalformedBindings
	 * @param array $options
	 */
	public function testRejectsMalformedEmptyAndBareBindings( array $options ): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-invalid-page-binding' );
		PageOwnedBindingOptions::extract( $options );
	}

	/** @return array */
	public static function provideMalformedBindings(): array {
		return [
			'nul before value' => [ [ "layersbinding=\0v1:1:a" ] ],
			'nul after value' => [ [ "layersbinding=v1:1:a\0" ] ],
			'vertical tab after value' => [ [ "layersbinding=v1:1:a\v" ] ],
			'bare binding' => [ [ 'layersbinding' ] ],
			'bare binding with whitespace' => [ [ '  layersbinding  ' ] ],
			'bare binding uppercase' => [ [ 'LAYERSBINDING' ] ],
			'empty value after equals' => [ [ 'layersbinding=' ] ],
			'whitespace value after equals' => [ [ 'layersbinding =   ' ] ],
			'legacy set name value' => [ [ 'layersbinding=default' ] ],
			'wrong version' => [ [ 'layersbinding=v2:1:a' ] ],
			'uppercase version' => [ [ 'layersbinding=V1:1:a' ] ],
			'zero page id' => [ [ 'layersbinding=v1:0:a' ] ],
			'negative page id' => [ [ 'layersbinding=v1:-1:a' ] ],
			'missing surface id' => [ [ 'layersbinding=v1:1:' ] ],
			'surface id too long' => [ [ 'layersbinding=v1:1:' . str_repeat( 'a', 65 ) ] ],
			'page id overflow' => [ [ 'layersbinding=v1:2147483648:a' ] ],
			'non-ascii surface id' => [ [ 'layersbinding=v1:1:概要' ] ],
			'script tag in surface id' => [ [ 'layersbinding=v1:1:<script>' ] ],
		];
	}

	/**
	 * @dataProvider provideDuplicateBindings
	 * @param array $options
	 */
	public function testRejectsDuplicateBindings( array $options ): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-invalid-page-binding' );
		PageOwnedBindingOptions::extract( $options );
	}

	/** @return array */
	public static function provideDuplicateBindings(): array {
		return [
			'identical bindings' => [ [ 'layersbinding=v1:1:a', 'layersbinding=v1:1:a' ] ],
			'different bindings' => [ [ 'layersbinding=v1:1:a', 'layersbinding=v1:2:b' ] ],
			'different name case' => [ [ 'layersbinding=v1:1:a', 'LAYERSBINDING=v1:1:a' ] ],
			'bare and valued' => [ [ 'layersbinding', 'layersbinding=v1:1:a' ] ],
			'valued and bare' => [ [ 'layersbinding=v1:1:a', 'layersbinding' ] ],
			'three bindings' => [ [ 'layersbinding=v1:1:a', 'thumb', 'layersbinding=v1:1:a', 'layersbinding=v1:1:a' ] ],
		];
	}

	/**
	 * @dataProvider provideConflictingLegacySelectors
	 * @param array $options
	 */
	public function testRejectsConflictingLegacySelectorsWhenBindingPresent( array $options ): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-invalid-page-binding' );
		PageOwnedBindingOptions::extract( $options );
	}

	/** @return array */
	public static function provideConflictingLegacySelectors(): array {
		return [
			'layerset before binding' => [ [ 'layerset=default', 'layersbinding=v1:1:a' ] ],
			'layerset after binding' => [ [ 'layersbinding=v1:1:a', 'layerset=default' ] ],
			'bare layerset' => [ [ 'layerset', 'layersbinding=v1:1:a' ] ],
			'empty layerset' => [ [ 'layerset=', 'layersbinding=v1:1:a' ] ],
			'mixed-case layerset' => [ [ 'LayerSet=default', 'layersbinding=v1:1:a' ] ],
			'layers before binding' => [ [ 'layers=on', 'layersbinding=v1:1:a' ] ],
			'layers after binding' => [ [ 'layersbinding=v1:1:a', 'layers=on' ] ],
			'bare layers' => [ [ 'layers', 'layersbinding=v1:1:a' ] ],
			'empty layers' => [ [ 'layers=', 'layersbinding=v1:1:a' ] ],
			'uppercase layers' => [ [ 'LAYERS=off', 'layersbinding=v1:1:a' ] ],
			'layer before binding' => [ [ 'layer=1', 'layersbinding=v1:1:a' ] ],
			'layer after binding' => [ [ 'layersbinding=v1:1:a', 'layer=1' ] ],
			'bare layer' => [ [ 'layer', 'layersbinding=v1:1:a' ] ],
			'empty layer' => [ [ 'layer=', 'layersbinding=v1:1:a' ] ],
			'layersetid before binding' => [ [ 'layersetid=42', 'layersbinding=v1:1:a' ] ],
			'layersetid after binding' => [ [ 'layersbinding=v1:1:a', 'layersetid=42' ] ],
			'bare layersetid' => [ [ 'layersetid', 'layersbinding=v1:1:a' ] ],
			'empty layersetid' => [ [ 'layersetid=', 'layersbinding=v1:1:a' ] ],
			'uppercase layersetid' => [ [ 'LAYERSETID=99', 'layersbinding=v1:1:a' ] ],
			'whitespace around selector' => [ [ '  layerset  =  custom  ', 'layersbinding=v1:1:a' ] ],
		];
	}

	/**
	 * @dataProvider provideExtraDelimiters
	 * @param array $options
	 */
	public function testRejectsExtraEqualsOrPipesInBindingValue( array $options ): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-invalid-page-binding' );
		PageOwnedBindingOptions::extract( $options );
	}

	/** @return array */
	public static function provideExtraDelimiters(): array {
		return [
			'extra equals in value' => [ [ 'layersbinding=v1:1:surf=extra' ] ],
			'double equals' => [ [ 'layersbinding==v1:1:surf' ] ],
			'pipe in value' => [ [ 'layersbinding=v1:1:surf|param' ] ],
			'colon in surface id' => [ [ 'layersbinding=v1:1:surf:extra' ] ],
		];
	}

	public function testDoesNotTreatCaptionSubstringsAsOptionNames(): void {
		// Caption containing layersbinding= substring is not treated as a duplicate binding
		$result = PageOwnedBindingOptions::extract( [
			'layersbinding=v1:10:surf',
			'See layersbinding=v1:1:a in documentation'
		] );
		$this->assertSame( [ 'pageId' => 10, 'surfaceId' => 'surf' ], $result );

		// Caption containing layerset= substring is not treated as a conflicting selector
		$resultWithLayersetCaption = PageOwnedBindingOptions::extract( [
			'Figure showing layerset=default in caption',
			'layersbinding=v1:10:surf'
		] );
		$this->assertSame( [ 'pageId' => 10, 'surfaceId' => 'surf' ], $resultWithLayersetCaption );

		// Caption mentioning layersbinding without any binding option returns null
		$this->assertNull( PageOwnedBindingOptions::extract( [
			'This caption mentions layersbinding as plain text'
		] ) );
	}

	/**
	 * @dataProvider provideInvalidContainerInput
	 * @param array $options
	 */
	public function testRejectsSparseOrNonStringInput( array $options ): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-invalid-page-binding' );
		PageOwnedBindingOptions::extract( $options );
	}

	/** @return array */
	public static function provideInvalidContainerInput(): array {
		return [
			'associative array' => [ [ 'opt' => 'layersbinding=v1:1:a' ] ],
			'sparse array' => [ [ 0 => 'thumb', 2 => 'layersbinding=v1:1:a' ] ],
			'null element' => [ [ 'thumb', null ] ],
			'integer element' => [ [ 'thumb', 123 ] ],
			'boolean element' => [ [ false ] ],
			'array element' => [ [ [] ] ],
			'object element' => [ [ new \stdClass() ] ],
		];
	}

	public function testAssertsFixedErrorWithoutPayloadLeakageAndUnchangedInput(): void {
		$sensitivePayload = 'v1:999:secret_token_12345';
		$input = [ 'thumb', 'layersbinding=' . $sensitivePayload, 'layerset=default' ];
		$inputCopy = $input;

		try {
			PageOwnedBindingOptions::extract( $input );
			$this->fail( 'Expected InvalidArgumentException' );
		} catch ( \InvalidArgumentException $e ) {
			$this->assertSame( 'layers-invalid-page-binding', $e->getMessage() );
			$this->assertStringNotContainsString( 'secret_token', $e->getMessage() );
			$this->assertStringNotContainsString( 'layerset', $e->getMessage() );
		}

		// Input array must remain unchanged
		$this->assertSame( $inputCopy, $input );
	}
}
