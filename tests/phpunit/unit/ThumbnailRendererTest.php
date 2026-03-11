<?php

namespace {
	require_once __DIR__ . '/../../../src/ThumbnailRenderer.php';

	if ( !class_exists( 'Config' ) ) {
		require_once __DIR__ . '/stubs/Config.php';
	}

	if ( !class_exists( 'HashConfig' ) ) {
		require_once __DIR__ . '/stubs/HashConfig.php';
	}
}

namespace MediaWiki\Extension\Layers\Tests {

	use MediaWiki\Extension\Layers\ThumbnailRenderer;

	class ThumbnailRendererTest extends \MediaWikiUnitTestCase {

		private function newRenderer(): ThumbnailRenderer {
			$config = new \HashConfig( [
				'UploadDirectory' => sys_get_temp_dir(),
				'UseImageMagick' => false,
				'ImageMagickConvertCommand' => '/usr/bin/convert',
				'LayersImageMagickTimeout' => 30,
				'LayersDefaultFonts' => [ 'DejaVu-Sans' ],
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
			$fileMock = new class {
				/**
				 * @return string
				 */
				public function getName() {
					return 'test.jpg';
				}

				/**
				 * @return string
				 */
				public function getSha1() {
					return 'abc123';
				}
			};

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
			$this->assertContains( 'rgba(255,0,0,1.000)', $result );
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

		/**
		 * @covers ::buildShadowSubImage
		 * @covers ::buildTextArguments
		 */
		public function testTextShadowUsesIsolatedSubImage() {
			$renderer = $this->newRenderer();

			// Set render dimensions via reflection
			$widthProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderWidth' );
			$widthProp->setAccessible( true );
			$widthProp->setValue( $renderer, 800 );
			$heightProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderHeight' );
			$heightProp->setAccessible( true );
			$heightProp->setValue( $renderer, 600 );

			$method = $this->getPrivateMethod( 'buildTextArguments' );

			$layer = [
				'x' => 10, 'y' => 20, 'text' => 'Hello',
				'fontSize' => 14, 'fill' => '#000000',
				'shadow' => true, 'shadowBlur' => 8,
				'shadowOffsetX' => 2, 'shadowOffsetY' => 2
			];

			$result = $method->invoke( $renderer, $layer, 1.0, 1.0 );

			// Should contain parenthesized sub-image for isolated blur
			$this->assertContains( '(', $result );
			$this->assertContains( ')', $result );
			$this->assertContains( 'xc:none', $result );
			$this->assertContains( '-composite', $result );
			$this->assertContains( '-blur', $result );

			// The blur should appear between ( and ), not at the top level
			$openIdx = array_search( '(', $result );
			$closeIdx = array_search( ')', $result );
			$blurIdx = array_search( '-blur', $result );
			$this->assertGreaterThan( $openIdx, $blurIdx );
			$this->assertLessThan( $closeIdx, $blurIdx );
		}

		/**
		 * @covers ::buildShadowSubImage
		 * @covers ::buildRectangleArguments
		 */
		public function testRectangleShadowUsesIsolatedSubImage() {
			$renderer = $this->newRenderer();

			$widthProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderWidth' );
			$widthProp->setAccessible( true );
			$widthProp->setValue( $renderer, 400 );
			$heightProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderHeight' );
			$heightProp->setAccessible( true );
			$heightProp->setValue( $renderer, 300 );

			$method = $this->getPrivateMethod( 'buildRectangleArguments' );

			$layer = [
				'x' => 10, 'y' => 20, 'width' => 100, 'height' => 50,
				'stroke' => '#ff0000', 'strokeWidth' => 2, 'fill' => 'none',
				'shadow' => true, 'shadowBlur' => 5,
				'shadowOffsetX' => 3, 'shadowOffsetY' => 3
			];

			$result = $method->invoke( $renderer, $layer, 1.0, 1.0 );

			$this->assertContains( '(', $result );
			$this->assertContains( '400x300', $result );
			$this->assertContains( 'xc:none', $result );
			$this->assertContains( '-composite', $result );
		}

		/**
		 * @covers ::buildShadowSubImage
		 */
		public function testShadowSubImageFallsBackWithoutDimensions() {
			$renderer = $this->newRenderer();

			// renderWidth/renderHeight default to 0
			$method = $this->getPrivateMethod( 'buildShadowSubImage' );

			$drawArgs = [ '-fill', 'red', '-draw', 'rectangle 0,0 100,100' ];
			$result = $method->invoke( $renderer, $drawArgs, 8 );

			// Without dimensions, should return drawArgs without parenthesized wrapper
			$this->assertNotContains( '(', $result );
			$this->assertNotContains( 'xc:none', $result );
			$this->assertSame( $drawArgs, $result );
		}

		/**
		 * @covers ::buildShadowSubImage
		 * @covers ::buildCircleArguments
		 */
		public function testCircleShadowUsesIsolatedSubImage() {
			$renderer = $this->newRenderer();

			$widthProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderWidth' );
			$widthProp->setAccessible( true );
			$widthProp->setValue( $renderer, 500 );
			$heightProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderHeight' );
			$heightProp->setAccessible( true );
			$heightProp->setValue( $renderer, 400 );

			$method = $this->getPrivateMethod( 'buildCircleArguments' );

			$layer = [
				'x' => 100, 'y' => 100, 'radius' => 50,
				'stroke' => '#000', 'fill' => 'blue',
				'shadow' => true, 'shadowBlur' => 10,
				'shadowOffsetX' => 2, 'shadowOffsetY' => 2
			];

			$result = $method->invoke( $renderer, $layer, 1.0, 1.0 );

			$this->assertContains( '(', $result );
			$this->assertContains( '500x400', $result );
			$this->assertContains( 'xc:none', $result );
			// Should also have the actual circle draw after the shadow
			$drawCount = count( array_keys( $result, '-draw' ) );
			$this->assertGreaterThanOrEqual( 2, $drawCount,
				'Should have one draw for shadow, one for actual circle' );
		}

		/**
		 * @covers ::buildShadowSubImage
		 * @covers ::buildPolygonArguments
		 */
		public function testPolygonShadowUsesIsolatedSubImage() {
			$renderer = $this->newRenderer();

			$widthProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderWidth' );
			$widthProp->setAccessible( true );
			$widthProp->setValue( $renderer, 600 );
			$heightProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderHeight' );
			$heightProp->setAccessible( true );
			$heightProp->setValue( $renderer, 450 );

			$method = $this->getPrivateMethod( 'buildPolygonArguments' );

			$layer = [
				'x' => 120, 'y' => 90, 'radius' => 40, 'sides' => 6,
				'stroke' => '#000', 'fill' => '#f00',
				'shadow' => true, 'shadowBlur' => 6,
				'shadowOffsetX' => 4, 'shadowOffsetY' => 3
			];

			$result = $method->invoke( $renderer, $layer, 1.0, 1.0 );

			$this->assertContains( '(', $result );
			$this->assertContains( '600x450', $result );
			$this->assertContains( 'xc:none', $result );
			$this->assertContains( '-composite', $result );
			$this->assertGreaterThanOrEqual( 2, count( array_keys( $result, '-draw' ) ) );
		}

		/**
		 * @covers ::buildShadowSubImage
		 * @covers ::buildStarArguments
		 */
		public function testStarShadowUsesIsolatedSubImage() {
			$renderer = $this->newRenderer();

			$widthProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderWidth' );
			$widthProp->setAccessible( true );
			$widthProp->setValue( $renderer, 640 );
			$heightProp = new \ReflectionProperty( ThumbnailRenderer::class, 'renderHeight' );
			$heightProp->setAccessible( true );
			$heightProp->setValue( $renderer, 480 );

			$method = $this->getPrivateMethod( 'buildStarArguments' );

			$layer = [
				'x' => 140, 'y' => 120,
				'outerRadius' => 45, 'innerRadius' => 20, 'points' => 5,
				'stroke' => '#000', 'fill' => '#ff0',
				'shadow' => true, 'shadowBlur' => 5,
				'shadowOffsetX' => 2, 'shadowOffsetY' => 2
			];

			$result = $method->invoke( $renderer, $layer, 1.0, 1.0 );

			$this->assertContains( '(', $result );
			$this->assertContains( '640x480', $result );
			$this->assertContains( 'xc:none', $result );
			$this->assertContains( '-composite', $result );
			$this->assertGreaterThanOrEqual( 2, count( array_keys( $result, '-draw' ) ) );
		}
	}

}
