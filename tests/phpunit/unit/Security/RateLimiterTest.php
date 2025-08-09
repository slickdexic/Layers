<?php

namespace MediaWiki\Extension\Layers\Tests;

use MediaWiki\Extension\Layers\Security\RateLimiter;

/**
 * @coversDefaultClass \MediaWiki\Extension\Layers\Security\RateLimiter
 */
class RateLimiterTest extends \MediaWikiUnitTestCase {

	/**
	 * @covers ::isLayerCountAllowed
	 */
	public function testLayerCountLimits() {
		$limiter = new RateLimiter();

		$this->assertTrue( $limiter->isLayerCountAllowed( 10 ) );
		$this->assertTrue( $limiter->isLayerCountAllowed( 50 ) );
		$this->assertFalse( $limiter->isLayerCountAllowed( 51 ) );
		$this->assertFalse( $limiter->isLayerCountAllowed( 1000 ) );
	}

	/**
	 * @covers ::isComplexityAllowed
	 */
	public function testComplexityCalculation() {
		$limiter = new RateLimiter();

		// Simple layers should be allowed
		$simpleLayers = [
			[ 'type' => 'text' ],
			[ 'type' => 'rectangle' ],
			[ 'type' => 'circle' ]
		];

		$this->assertTrue( $limiter->isComplexityAllowed( $simpleLayers ) );

		// Too many complex layers should be rejected
		// 50 arrows = 150 complexity
		$complexLayers = array_fill( 0, 50, [ 'type' => 'arrow' ] );

		$this->assertFalse( $limiter->isComplexityAllowed( $complexLayers ) );
	}

	/**
	 * @covers ::isImageSizeAllowed
	 */
	public function testImageSizeLimits() {
		$limiter = new RateLimiter();

		$this->assertTrue( $limiter->isImageSizeAllowed( 1920, 1080 ) );
		$this->assertTrue( $limiter->isImageSizeAllowed( 4096, 4096 ) );
		$this->assertFalse( $limiter->isImageSizeAllowed( 10000, 10000 ) );
		$this->assertFalse( $limiter->isImageSizeAllowed( 8193, 100 ) );
	}
}
