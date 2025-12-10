<?php

namespace MediaWiki\Extension\Layers\Tests;

use MediaWiki\Extension\Layers\ThumbnailRenderer;

/**
 * @coversDefaultClass \MediaWiki\Extension\Layers\ThumbnailRenderer
 */
class ThumbnailRendererTest extends \MediaWikiUnitTestCase {

	private function newRenderer(): ThumbnailRenderer {
		$config = new \HashConfig( [
			'UploadDirectory' => sys_get_temp_dir(),
			'UseImageMagick' => false,
			'ImageMagickConvertCommand' => '/usr/bin/convert',
			'LayersImageMagickTimeout' => 30,
			'MaxShellMemory' => 0,
			'MaxShellTime' => 0,
			'MaxShellFileSize' => 0
		] );
		$logger = $this->createMock( \Psr\Log\LoggerInterface::class );
		return new ThumbnailRenderer( $config, $logger );
	}

	private function getPrivateMethod( string $methodName ): \ReflectionMethod {
		$method = new \ReflectionMethod( ThumbnailRenderer::class, $methodName );
		$method->setAccessible( true );
		return $method;
	}

	/**
	 * @covers ::generateLayeredThumbnail
	 */
	public function testGenerateLayeredThumbnailWithoutLayers() {
		$fileMock = $this->createMock( \File::class );
		$fileMock->method( 'getName' )->willReturn( 'test.jpg' );
		$fileMock->method( 'getSha1' )->willReturn( 'abc123' );

		$renderer = $this->newRenderer();
		$result = $renderer->generateLayeredThumbnail( $fileMock, [] );

		$this->assertNull( $result, 'Should return null when no layer data provided' );
	}

	/**
	 * @covers ::buildTextArguments
	 */
	public function testBuildTextArgumentsSecurity() {
		$renderer = $this->newRenderer();
		$method = $this->getPrivateMethod( 'buildTextArguments' );

		$maliciousLayer = [
			'x' => 10,
			'y' => 20,
			'text' => 'Hello"; rm -rf /; echo "pwned',
			'fontSize' => 14,
			'fill' => '#000000'
		];

		$result = $method->invoke( $renderer, $maliciousLayer, 1.0, 1.0 );

		$this->assertIsArray( $result );
		$this->assertContains( '-annotate', $result );
		$this->assertContains( '+10+20', $result );
		$this->assertContains( 'Hello"; rm -rf /; echo "pwned', $result );
	}

	/**
	 * @covers ::buildRectangleArguments
	 */
	public function testBuildRectangleCommandValidation() {
		$renderer = $this->newRenderer();
		$method = $this->getPrivateMethod( 'buildRectangleArguments' );

		$layer = [
			'x' => 10,
			'y' => 20,
			'width' => 100,
			'height' => 50,
			'stroke' => '#ff0000',
			'strokeWidth' => 2,
			'fill' => 'none'
		];

		$result = $method->invoke( $renderer, $layer, 1.0, 1.0 );

		$this->assertIsArray( $result );
		$drawIndex = array_search( '-draw', $result );
		$this->assertNotFalse( $drawIndex );
		$this->assertSame( 'rectangle 10,20 110,70', $result[$drawIndex + 1] );
		$this->assertContains( '#ff0000', $result );
	}

	/**
	 * Test that extremely large coordinates are handled safely
	 *
	 * @covers ::buildTextArguments
	 */
	public function testCoordinateBounds() {
		$renderer = $this->newRenderer();
		$method = $this->getPrivateMethod( 'buildTextArguments' );

		$extremeLayer = [
			'x' => 999999999,
			'y' => -999999999,
			'text' => 'Test',
			'fontSize' => 14
		];

		$result = $method->invoke( $renderer, $extremeLayer, 1.0, 1.0 );

		$this->assertIsArray( $result );
		$this->assertContains( 'Test', $result );
	}
}
