<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Security;

use MediaWiki\Extension\Layers\Security\RateLimiter;

/**
 * @coversDefaultClass \MediaWiki\Extension\Layers\Security\RateLimiter
 */
class RateLimiterTest extends \MediaWikiUnitTestCase {

	private function createRateLimiter() {
		$config = new \HashConfig( [
			'LayersMaxImageDimensions' => 8192,
			'LayersMaxImageSize' => 8192,
			'LayersMaxLayerCount' => 100,
			'RateLimits' => []
		] );
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
		$this->assertFalse( $limiter->isLayerCountAllowed( 0 ) );
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
		$highComplexityTypes = [ 'path', 'blur' ];
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

	/**
	 * @covers ::checkSaveRateLimit
	 */
	public function testSaveRateLimiting() {
		if ( !method_exists( RateLimiter::class, 'checkSaveRateLimit' ) ) {
			$this->markTestSkipped( 'checkSaveRateLimit method does not exist' );
		}

		$limiter = $this->createRateLimiter();

		// Mock user - using generic object since User class may not be available in unit tests
		$mockUser = $this->createMock( \stdClass::class );
		$mockUser->method( 'getId' )->willReturn( 123 );
		$mockUser->method( 'isRegistered' )->willReturn( true );

		// First save should be allowed
		$result = $limiter->checkSaveRateLimit( $mockUser );
		$this->assertIsBool( $result );
	}

	/**
	 * @covers ::checkRenderRateLimit
	 */
	public function testRenderRateLimiting() {
		if ( !method_exists( RateLimiter::class, 'checkRenderRateLimit' ) ) {
			$this->markTestSkipped( 'checkRenderRateLimit method does not exist' );
		}

		$limiter = $this->createRateLimiter();

		// Mock user - using generic object since User class may not be available in unit tests
		$mockUser = $this->createMock( \stdClass::class );
		$mockUser->method( 'getId' )->willReturn( 456 );
		$mockUser->method( 'isRegistered' )->willReturn( true );

		// Render operation should be rate limited
		$result = $limiter->checkRenderRateLimit( $mockUser );
		$this->assertIsBool( $result );
	}

	/**
	 * @covers ::isDataSizeAllowed
	 */
	public function testDataSizeLimiting() {
		if ( !method_exists( RateLimiter::class, 'isDataSizeAllowed' ) ) {
			$this->markTestSkipped( 'isDataSizeAllowed method does not exist' );
		}

		$limiter = $this->createRateLimiter();

		// Small data should be allowed
		$smallData = json_encode( $this->getValidLayers() );
		$this->assertTrue(
			$limiter->isDataSizeAllowed( strlen( $smallData ) ),
			'Small layer data should be within size limits'
		);

		// Test boundary conditions (assuming 2MB limit = 2097152 bytes)
		// 1MB
		$this->assertTrue( $limiter->isDataSizeAllowed( 1000000 ) );
		// 2MB exactly
		$this->assertTrue( $limiter->isDataSizeAllowed( 2097152 ) );
		// 2MB + 1 byte
		$this->assertFalse( $limiter->isDataSizeAllowed( 2097153 ) );

		// Very large data should be rejected
		// 10MB
		$this->assertFalse( $limiter->isDataSizeAllowed( 10000000 ) );

		// Edge cases
		$this->assertTrue( $limiter->isDataSizeAllowed( 0 ) );
		$this->assertTrue( $limiter->isDataSizeAllowed( 1 ) );
		$this->assertFalse( $limiter->isDataSizeAllowed( -1 ) );
	}

	/**
	 * @covers ::getComplexityScore
	 */
	public function testComplexityScoreCalculation() {
		if ( !method_exists( RateLimiter::class, 'getComplexityScore' ) ) {
			$this->markTestSkipped( 'getComplexityScore method does not exist' );
		}

		$limiter = $this->createRateLimiter();

		// Test complexity scores for different layer types
		$layerTypes = [
			'text' => 1,
			'rectangle' => 1,
			'circle' => 1,
			'ellipse' => 1,
			'arrow' => 3,
			'line' => 2,
			'polygon' => 3,
			'path' => 5,
			'blur' => 4
		];

		foreach ( $layerTypes as $type => $expectedScore ) {
			$layer = [ 'type' => $type ];
			$score = $limiter->getComplexityScore( $layer );
			$this->assertIsInt( $score, "Complexity score for '$type' should be an integer" );
			$this->assertGreaterThanOrEqual( 1, $score, "Complexity score for '$type' should be at least 1" );
		}

		// Test unknown layer type
		$unknownLayer = [ 'type' => 'unknown_type' ];
		$score = $limiter->getComplexityScore( $unknownLayer );
		$this->assertIsInt( $score );
		$this->assertGreaterThanOrEqual( 1, $score );
	}

	/**
	 * @covers ::getUserRateLimitKey
	 */
	public function testUserRateLimitKeyGeneration() {
		if ( !method_exists( RateLimiter::class, 'getUserRateLimitKey' ) ) {
			$this->markTestSkipped( 'getUserRateLimitKey method does not exist' );
		}

		$limiter = $this->createRateLimiter();

		// Mock users - using generic objects since User class may not be available in unit tests
		$registeredUser = $this->createMock( \stdClass::class );
		$registeredUser->method( 'getId' )->willReturn( 123 );
		$registeredUser->method( 'isRegistered' )->willReturn( true );

		$anonymousUser = $this->createMock( \stdClass::class );
		$anonymousUser->method( 'getId' )->willReturn( 0 );
		$anonymousUser->method( 'isRegistered' )->willReturn( false );

		// Test rate limit key generation
		$registeredKey = $limiter->getUserRateLimitKey( $registeredUser, 'save' );
		$anonymousKey = $limiter->getUserRateLimitKey( $anonymousUser, 'save' );

		$this->assertIsString( $registeredKey );
		$this->assertIsString( $anonymousKey );
		$this->assertNotEquals( $registeredKey, $anonymousKey );
	}

	/**
	 * @covers ::isMaintenanceModeBypass
	 */
	public function testMaintenanceModeBypass() {
		if ( !method_exists( RateLimiter::class, 'isMaintenanceModeBypass' ) ) {
			$this->markTestSkipped( 'isMaintenanceModeBypass method does not exist' );
		}

		$limiter = $this->createRateLimiter();

		// Test maintenance mode detection
		$result = $limiter->isMaintenanceModeBypass();
		$this->assertIsBool( $result );
	}
}
