<?php

namespace MediaWiki\Extension\Layers\Tests;

use MediaWiki\Extension\Layers\ThumbnailRenderer;

/**
 * @coversDefaultClass \MediaWiki\Extension\Layers\ThumbnailRenderer
 */
class ThumbnailRendererTest extends \MediaWikiUnitTestCase {
	/**
	 * @covers ::generateLayeredThumbnail
	 */
	public function testGenerateLayeredThumbnailWithoutLayers() {
		$fileMock = $this->createMock( \File::class );
		$fileMock->method( 'getName' )->willReturn( 'test.jpg' );
		$fileMock->method( 'getSha1' )->willReturn( 'abc123' );

		$renderer = new ThumbnailRenderer();
		$result = $renderer->generateLayeredThumbnail( $fileMock, [] );

		$this->assertFalse( $result, 'Should return false when no layers parameter' );
	}

	/**
	 * @covers ::buildTextCommand
	 */
	public function testBuildTextCommandSecurity() {
		$renderer = new ThumbnailRenderer();
		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'buildTextCommand' );
		$method->setAccessible( true );

		$maliciousLayer = [
			'x' => 10,
			'y' => 20,
			'text' => 'Hello"; rm -rf /; echo "pwned',
			'fontSize' => 14,
			'fill' => '#000000'
		];

		$result = $method->invoke( $renderer, $maliciousLayer );

		// Ensure dangerous characters are escaped
		$this->assertStringNotContainsString( '; rm -rf', $result );
		$this->assertStringContainsString( 'Hello', $result );
	}

	/**
	 * @covers ::buildRectangleCommand
	 */
	public function testBuildRectangleCommandValidation() {
		$renderer = new ThumbnailRenderer();
		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'buildRectangleCommand' );
		$method->setAccessible( true );

		$layer = [
			'x' => 10,
			'y' => 20,
			'width' => 100,
			'height' => 50,
			'stroke' => '#ff0000',
			'strokeWidth' => 2,
			'fill' => 'none'
		];

		$result = $method->invoke( $renderer, $layer );

		$this->assertStringContainsString( 'rectangle 10,20 110,70', $result );
		$this->assertStringContainsString( '-stroke \'#ff0000\'', $result );
		$this->assertStringContainsString( '-strokewidth 2', $result );
	}

	/**
	 * Test that extremely large coordinates are handled safely
	 *
	 * @covers ::buildTextCommand
	 */
	public function testCoordinateBounds() {
		$renderer = new ThumbnailRenderer();
		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'buildTextCommand' );
		$method->setAccessible( true );

		$extremeLayer = [
			'x' => 999999999,
			'y' => -999999999,
			'text' => 'Test',
			'fontSize' => 14
		];

		$result = $method->invoke( $renderer, $extremeLayer );

		// Should handle extreme coordinates without crashing
		$this->assertIsString( $result );
		$this->assertStringContainsString( 'Test', $result );
	}
}
