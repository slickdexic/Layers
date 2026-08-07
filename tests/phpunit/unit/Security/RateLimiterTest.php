<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Security;

use MediaWiki\Extension\Layers\Security\RateLimiter;

/**
 * @coversDefaultClass \MediaWiki\Extension\Layers\Security\RateLimiter
 */
class RateLimiterTest extends \MediaWikiUnitTestCase {

	private function createRateLimiter() {
		$config = $this->createMock( \Config::class );
		$config->method( 'get' )
			->willReturnCallback( static function ( string $key ) {
				$values = [
					'LayersMaxImageDimensions' => 8192,
					'LayersMaxImageSize' => 8192,
					'LayersMaxLayerCount' => 100,
					'LayersMaxComplexity' => 100,
					'RateLimits' => []
				];

				return $values[$key] ?? null;
			} );
		return new RateLimiter( $config );
	}

	private function getValidLayers() {
		return [
			[
				'id' => 'layer_1',
				'type' => 'text',
				'x' => 100,
				'y' => 50,
				'text' => 'Test'
			],
			[
				'id' => 'layer_2',
				'type' => 'rectangle',
				'x' => 0,
				'y' => 0,
				'width' => 100,
				'height' => 50
			]
		];
	}

	/**
	 * @covers ::isLayerCountAllowed
	 */
	public function testLayerCountLimits() {
		$limiter = $this->createRateLimiter();

		// Test valid layer counts
		$this->assertTrue( $limiter->isLayerCountAllowed( 1 ) );
		$this->assertTrue( $limiter->isLayerCountAllowed( 10 ) );
		$this->assertTrue( $limiter->isLayerCountAllowed( 50 ) );

		// Test boundary conditions
		// Assuming 100 is the limit
		$this->assertTrue( $limiter->isLayerCountAllowed( 100 ) );
		$this->assertFalse( $limiter->isLayerCountAllowed( 101 ) );
		$this->assertFalse( $limiter->isLayerCountAllowed( 1000 ) );

		// Test edge cases
		$this->assertTrue( $limiter->isLayerCountAllowed( 0 ) );
		$this->assertFalse( $limiter->isLayerCountAllowed( -1 ) );
		$this->assertFalse( $limiter->isLayerCountAllowed( -100 ) );
	}

	/**
	 * @covers ::isComplexityAllowed
	 */
	public function testComplexityCalculation() {
		$limiter = $this->createRateLimiter();

		// Simple layers should be allowed
		$simpleLayers = [
			[ 'type' => 'text' ],
			[ 'type' => 'rectangle' ],
			[ 'type' => 'circle' ],
			[ 'type' => 'ellipse' ]
		];

		$this->assertTrue(
			$limiter->isComplexityAllowed( $simpleLayers ),
			'Simple layers should be within complexity limits'
		);

		// Test individual layer types for complexity
		$lowComplexityTypes = [ 'text', 'rectangle', 'circle', 'ellipse' ];
		foreach ( $lowComplexityTypes as $type ) {
			$layers = array_fill( 0, 20, [ 'type' => $type ] );
			$this->assertTrue(
				$limiter->isComplexityAllowed( $layers ),
				"20 layers of type '$type' should be allowed"
			);
		}

		// Medium complexity layers
		$mediumComplexityTypes = [ 'arrow', 'line', 'polygon' ];
		foreach ( $mediumComplexityTypes as $type ) {
			$layers = array_fill( 0, 10, [ 'type' => $type ] );
			$this->assertTrue(
				$limiter->isComplexityAllowed( $layers ),
				"10 layers of type '$type' should be allowed"
			);
		}

		// High complexity layers should be limited
		$highComplexityTypes = [ 'path' ];
		foreach ( $highComplexityTypes as $type ) {
			$layers = array_fill( 0, 5, [ 'type' => $type ] );
			$result = $limiter->isComplexityAllowed( $layers );
			$this->assertIsBool( $result, "Complexity check should return boolean for '$type'" );
		}

		// Test excessive complexity
		$tooManyComplexLayers = array_fill( 0, 100, [ 'type' => 'path' ] );
		$this->assertFalse(
			$limiter->isComplexityAllowed( $tooManyComplexLayers ),
			'Too many complex layers should be rejected'
		);
	}

	/**
	 * @covers ::isComplexityAllowed
	 * @dataProvider provideLayerTypeComplexity
	 */
	public function testComplexityAllowedForAllLayerTypes( string $type, int $expectedScore ) {
		$limiter = $this->createRateLimiter();

		// Create a single layer of this type
		$layers = [ [ 'type' => $type ] ];
		$this->assertTrue(
			$limiter->isComplexityAllowed( $layers ),
			"Single layer of type '$type' should be allowed"
		);

		// Verify that (100 / expectedScore) layers are allowed
		// but (100 / expectedScore + 1) are rejected (at the boundary)
		$maxAllowed = (int)floor( 100 / $expectedScore );
		$layers = array_fill( 0, $maxAllowed, [ 'type' => $type ] );
		$this->assertTrue(
			$limiter->isComplexityAllowed( $layers ),
			"$maxAllowed layers of type '$type' (score=$expectedScore) should be at limit"
		);

		// One more should push over the limit
		if ( $expectedScore > 1 ) {
			$layers = array_fill( 0, $maxAllowed + 1, [ 'type' => $type ] );
			$this->assertFalse(
				$limiter->isComplexityAllowed( $layers ),
				( $maxAllowed + 1 ) . " layers of type '$type' should exceed limit"
			);
		}
	}

	/**
	 * Data provider for every supported layer type with its complexity score.
	 *
	 * Must stay in step with ServerSideLayerValidator::SUPPORTED_LAYER_TYPES;
	 * scripts/check-parallel-lists.js enforces that the switch itself does.
	 *
	 * @return array<string, array{0: string, 1: int}>
	 */
	public static function provideLayerTypeComplexity(): array {
		return [
			// Text rendering is moderately expensive (+2)
			'text' => [ 'text', 2 ],
			'textbox' => [ 'textbox', 2 ],
			'callout' => [ 'callout', 2 ],

			// Complex types with potential for large data (+3)
			'customShape' => [ 'customShape', 3 ],
			'image' => [ 'image', 3 ],
			'path' => [ 'path', 3 ],

			// Arrows are moderately complex (+2)
			'arrow' => [ 'arrow', 2 ],

			// A group only holds child ids; the children are costed on their own
			// iteration of the same flat array, so there is nothing to multiply.
			'group' => [ 'group', 1 ],

			// Simple shapes (+1)
			'rectangle' => [ 'rectangle', 1 ],
			'circle' => [ 'circle', 1 ],
			'ellipse' => [ 'ellipse', 1 ],
			'line' => [ 'line', 1 ],
			'polygon' => [ 'polygon', 1 ],
			'star' => [ 'star', 1 ],
			'marker' => [ 'marker', 1 ],
			'dimension' => [ 'dimension', 1 ],
			'angleDimension' => [ 'angleDimension', 1 ],
		];
	}

	/**
	 * @covers ::isComplexityAllowed
	 */
	public function testComplexityWithUnknownLayerType() {
		$limiter = $this->createRateLimiter();

		// Unknown types should be treated as expensive (+3 each)
		$unknownLayers = array_fill( 0, 33, [ 'type' => 'future_type' ] );
		$this->assertTrue(
			$limiter->isComplexityAllowed( $unknownLayers ),
			'33 unknown layers (33*3=99) should be within limit'
		);

		$unknownLayers = array_fill( 0, 34, [ 'type' => 'future_type' ] );
		$this->assertFalse(
			$limiter->isComplexityAllowed( $unknownLayers ),
			'34 unknown layers (34*3=102) should exceed limit'
		);
	}

	/**
	 * @covers ::isImageSizeAllowed
	 */
	public function testImageSizeLimits() {
		$limiter = $this->createRateLimiter();

		// Standard image sizes should be allowed
		$this->assertTrue( $limiter->isImageSizeAllowed( 800, 600 ) );
		$this->assertTrue( $limiter->isImageSizeAllowed( 1920, 1080 ) );
		$this->assertTrue( $limiter->isImageSizeAllowed( 4096, 4096 ) );

		// Test boundary conditions (assuming 8192 is the limit)
		$this->assertTrue( $limiter->isImageSizeAllowed( 8192, 1000 ) );
		$this->assertTrue( $limiter->isImageSizeAllowed( 1000, 8192 ) );
		$this->assertFalse( $limiter->isImageSizeAllowed( 8193, 100 ) );
		$this->assertFalse( $limiter->isImageSizeAllowed( 100, 8193 ) );

		// Test very large images
		$this->assertFalse( $limiter->isImageSizeAllowed( 10000, 10000 ) );
		$this->assertFalse( $limiter->isImageSizeAllowed( 50000, 1000 ) );

		// Test edge cases
		$this->assertFalse( $limiter->isImageSizeAllowed( 0, 100 ) );
		$this->assertFalse( $limiter->isImageSizeAllowed( 100, 0 ) );
		$this->assertFalse( $limiter->isImageSizeAllowed( -100, 100 ) );
		$this->assertFalse( $limiter->isImageSizeAllowed( 100, -100 ) );

		// Test small but valid images
		$this->assertTrue( $limiter->isImageSizeAllowed( 1, 1 ) );
		$this->assertTrue( $limiter->isImageSizeAllowed( 100, 100 ) );
	}
}
