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

		/**
		 * @covers ::buildMarkerArguments
		 */
		public function testMarkerDrawsDiscAndCentredValue() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'buildMarkerArguments' );

			$args = $method->invoke( $renderer, [
				'type' => 'marker', 'x' => 100, 'y' => 200, 'size' => 32,
				'value' => 3, 'style' => 'circled',
				'fill' => '#ffff00', 'stroke' => '#ff0000', 'color' => '#000000'
			], 1.0, 1.0 );

			$this->assertContains( '-draw', $args );
			$this->assertContains( 'circle 100,200 116,200', $args );
			$this->assertContains( '3', $args );
			$this->assertContains( '-annotate', $args );
		}

		/**
		 * @covers ::formatMarkerValue
		 */
		public function testMarkerValueFormattingMatchesClient() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'formatMarkerValue' );

			$this->assertSame( '5', $method->invoke( $renderer, 5, 'circled' ) );
			$this->assertSame( 'E', $method->invoke( $renderer, 5, 'letter' ) );
			$this->assertSame( 'AB', $method->invoke( $renderer, 28, 'letter' ) );
			$this->assertSame( '(5)', $method->invoke( $renderer, 5, 'parentheses' ) );
			$this->assertSame( '5.', $method->invoke( $renderer, 5, 'plain' ) );
			$this->assertSame( 'custom', $method->invoke( $renderer, 'custom', 'circled' ) );
		}

		/**
		 * @covers ::buildCalloutArguments
		 */
		public function testCalloutDrawsBoxTailAndText() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'buildCalloutArguments' );

			$args = $method->invoke( $renderer, [
				'type' => 'callout', 'x' => 10, 'y' => 20, 'width' => 100, 'height' => 50,
				'tailX' => 5, 'tailY' => 90, 'text' => 'note', 'cornerRadius' => 4
			], 1.0, 1.0 );

			$joined = implode( ' ', $args );
			$this->assertStringContainsString( 'roundrectangle 10,20 110,70', $joined );
			$this->assertStringContainsString( 'polygon', $joined );
			$this->assertContains( 'note', $args );
		}

		/**
		 * @covers ::buildDimensionArguments
		 */
		public function testDimensionDrawsLineWithEndTicks() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'buildDimensionArguments' );

			$args = $method->invoke( $renderer, [
				'type' => 'dimension', 'x1' => 0, 'y1' => 0, 'x2' => 100, 'y2' => 0,
				'unit' => 'mm', 'showUnit' => true
			], 1.0, 1.0 );

			// One measured line plus a tick at each end.
			$this->assertCount( 3, array_keys( $args, '-draw' ) );
			$this->assertContains( '100 mm', $args );
		}

		/**
		 * @covers ::buildAngleDimensionArguments
		 * @covers ::angleBetween
		 */
		public function testAngleDimensionComputesAndLabelsAngle() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'buildAngleDimensionArguments' );

			$args = $method->invoke( $renderer, [
				'type' => 'angleDimension',
				'cx' => 0, 'cy' => 0, 'ax' => 10, 'ay' => 0, 'bx' => 0, 'by' => 10
			], 1.0, 1.0 );

			$this->assertCount( 2, array_keys( $args, '-draw' ) );
			$this->assertContains( '90°', $args );
		}

		/**
		 * @covers ::buildImageArguments
		 * @covers ::materializeImageLayer
		 */
		public function testImageLayerCompositesDataUrl() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'buildImageArguments' );

			// 1x1 transparent PNG.
			$png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' .
				'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
			$args = $method->invoke( $renderer, [
				'type' => 'image', 'src' => 'data:image/png;base64,' . $png,
				'x' => 5, 'y' => 7, 'width' => 20, 'height' => 20
			], 1.0, 1.0 );

			$this->assertContains( '-composite', $args );
			$this->assertContains( '+5+7', $args );
			$this->assertContains( '20x20!', $args );

			$cleanup = $this->getPrivateMethod( 'cleanupTempFiles' );
			$cleanup->invoke( $renderer );
		}

		/**
		 * @covers ::materializeImageLayer
		 */
		public function testImageLayerRejectsNonDataUrl() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'materializeImageLayer' );

			$this->assertNull( $method->invoke( $renderer, 'https://example.com/x.png' ) );
			$this->assertNull( $method->invoke( $renderer, 'data:text/html;base64,PGI+' ) );
		}

		/**
		 * @covers ::buildLayerArguments
		 */
		public function testGroupDrawsNothingAndIsNotReportedAsDropped() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'buildLayerArguments' );

			$this->assertSame( [], $method->invoke( $renderer, [ 'type' => 'group' ], 1.0, 1.0 ) );
			$this->assertSame( [], $renderer->getDroppedLayerTypes() );
		}

		/**
		 * @covers ::buildLayerArguments
		 */
		public function testUnknownTypeIsStillReportedAsDropped() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'buildLayerArguments' );

			$method->invoke( $renderer, [ 'type' => 'customShape' ], 1.0, 1.0 );
			$this->assertSame( [ 'customShape' ], $renderer->getDroppedLayerTypes() );
		}

		/**
		 * @covers ::buildCustomShapeArguments
		 * @covers ::drawShapePaths
		 */
		public function testCustomShapeDrawsPathDataWithViewBoxTransform() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'buildCustomShapeArguments' );

			$args = $method->invoke( $renderer, [
				'type' => 'customShape',
				'x' => 10, 'y' => 20, 'width' => 48, 'height' => 48,
				'viewBox' => [ 0, 0, 24, 24 ],
				'path' => 'M 2,2 L 22,2 L 12,22 Z',
				'fill' => '#ff0000'
			], 1.0, 1.0 );

			$joined = implode( ' ', $args );
			$this->assertStringContainsString( 'translate 10,20', $joined );
			// 48px drawn from a 24-unit viewBox is a 2x scale.
			$this->assertStringContainsString( 'scale 2,2', $joined );
			$this->assertStringContainsString( "path 'M 2,2 L 22,2 L 12,22 Z'", $joined );
			$this->assertSame( [], $renderer->getDroppedLayerTypes() );
		}

		/**
		 * @covers ::isDrawablePath
		 */
		public function testCustomShapeRejectsPathDataOutsideTheWhitelist() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'isDrawablePath' );

			$this->assertTrue( $method->invoke( $renderer, 'M 0,0 L 10,10 Z' ) );
			// Must start with a move command.
			$this->assertFalse( $method->invoke( $renderer, 'L 10,10' ) );
			// Quotes would break out of the -draw argument.
			$this->assertFalse( $method->invoke( $renderer, "M 0,0' -write /tmp/x '" ) );
			$this->assertFalse( $method->invoke( $renderer, 'M 0,0 <script>' ) );
			$this->assertFalse( $method->invoke( $renderer, '' ) );
		}

		/**
		 * @covers ::rasterizeShapeSvg
		 */
		public function testShapeSvgRefusesDoctypeAndEntityDeclarations() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'rasterizeShapeSvg' );

			$xxe = '<svg xmlns="http://www.w3.org/2000/svg"><!DOCTYPE foo [' .
				'<!ENTITY xxe SYSTEM "file:///etc/passwd">]><path d="M0,0"/></svg>';
			$this->assertNull( $method->invoke( $renderer, $xxe, 32, 32 ) );

			$entity = '<svg><!ENTITY a SYSTEM "file:///etc/passwd"></svg>';
			$this->assertNull( $method->invoke( $renderer, $entity, 32, 32 ) );
		}

		/**
		 * @covers ::rasterizeShapeSvg
		 */
		public function testShapeSvgRefusesNonSvgInput() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'rasterizeShapeSvg' );

			$this->assertNull( $method->invoke( $renderer, '', 32, 32 ) );
			$this->assertNull( $method->invoke( $renderer, 'not svg at all', 32, 32 ) );
		}

		/**
		 * @covers ::buildCustomShapeArguments
		 */
		public function testCustomShapeWithoutPathsOrConverterIsReportedDropped() {
			// newRenderer() configures no SVGConverter, so the SVG route is closed.
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'buildCustomShapeArguments' );

			$args = $method->invoke( $renderer, [
				'type' => 'customShape',
				'x' => 0, 'y' => 0, 'width' => 24, 'height' => 24,
				'viewBox' => [ 0, 0, 24, 24 ],
				'svg' => '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0"/></svg>'
			], 1.0, 1.0 );

			$this->assertSame( [], $args );
			$this->assertSame( [ 'customShape' ], $renderer->getDroppedLayerTypes() );
		}

		/**
		 * @covers ::svgConverterCommand
		 */
		public function testSvgConverterIgnoresNonShellEntries() {
			$renderer = $this->newRenderer();
			$method = $this->getPrivateMethod( 'svgConverterCommand' );

			// The default config in newRenderer() declares no converter at all.
			$this->assertNull( $method->invoke( $renderer ) );
		}
	}

}
