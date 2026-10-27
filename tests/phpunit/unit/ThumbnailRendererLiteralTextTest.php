<?php

namespace {

	require_once __DIR__ . '/../../../src/ThumbnailRenderer.php';
	if ( !class_exists( 'HashConfig' ) ) {
		require_once __DIR__ . '/stubs/HashConfig.php';
	}
}

namespace MediaWiki\Extension\Layers\Tests {

	use MediaWiki\Extension\Layers\ThumbnailRenderer;

	/** Literal authored text at the native renderer's annotation boundary. */
	class ThumbnailRendererLiteralTextTest extends \MediaWikiUnitTestCase {
		/**
		 * @covers \MediaWiki\Extension\Layers\ThumbnailRenderer
		 * @dataProvider provideTextLayers
		 * @param string $type Layer type
		 * @param string $text Authored text
		 * @param string $expected Literal ImageMagick annotation argument
		 */
		public function testEveryAnnotationKeepsAuthoredTextLiteral(
			string $type, string $text, string $expected
		): void {
			$config = new \HashConfig( [ 'LayersDefaultFonts' => [ 'DejaVu-Sans' ] ] );
			$renderer = new ThumbnailRenderer( $config, new \Psr\Log\NullLogger() );
			$layer = [ 'type' => $type, 'text' => $text, 'value' => $text,
				'x' => 0, 'y' => 0, 'width' => 200, 'height' => 40,
				'x1' => 0, 'y1' => 20, 'x2' => 120, 'y2' => 20,
				'cx' => 20, 'cy' => 20, 'ax' => 120, 'ay' => 20, 'bx' => 20, 'by' => 120,
				'fontFamily' => 'DejaVu-Sans', 'fontSize' => 14 ];
			$before = $layer;
			$method = new \ReflectionMethod( ThumbnailRenderer::class, 'buildLayerArguments' );
			$method->setAccessible( true );
			$args = $method->invoke( $renderer, $layer, 1.0, 1.0 );
			$annotations = array_keys( $args, '-annotate', true );
			$this->assertNotEmpty( $annotations, $type );
			foreach ( $annotations as $index ) {
				$this->assertSame( $expected, $args[$index + 2], $type );
			}
			$this->assertSame( $before, $layer, 'Rendering must not rewrite the stored layer.' );
		}

		/** @return array */
		public static function provideTextLayers(): array {
			$cases = [];
			foreach ( [ 'text', 'textbox', 'marker', 'callout', 'dimension', 'angleDimension' ] as $type ) {
				$cases[$type . ' expression'] = [ $type, '%[fx:6*7]', '%%[fx:6*7]' ];
				$cases[$type . ' property and percentage'] = [ $type, '50% / %n / %%', '50%% / %%n / %%%%' ];
				$cases[$type . ' plain'] = [ $type, 'Plain note', 'Plain note' ];
			}
			return $cases;
		}

		/**
		 * An old interpreted-text artifact must not bypass the corrected renderer.
		 * @covers \MediaWiki\Extension\Layers\ThumbnailRenderer
		 */
		public function testPreviouslyRenderedCacheIsNotReused(): void {
			$directory = tempnam( sys_get_temp_dir(), 'layers-literal-' );
			$this->assertNotFalse( $directory );
			unlink( $directory );
			mkdir( $directory . '/thumb/layers', 0700, true );
			$params = [ 'width' => 200, 'layers' => true,
				'layerData' => [ [ 'type' => 'text', 'text' => '%[fx:6*7]' ] ] ];
			$old = $directory . '/thumb/layers/abcd_' . md5( json_encode( $params ) ) . '.png';
			file_put_contents( $old, 'Old expression output' );
			try {
				$config = new \HashConfig( [ 'UploadDirectory' => $directory, 'UseImageMagick' => false ] );
				$renderer = new ThumbnailRenderer( $config, new \Psr\Log\NullLogger() );
				$file = new class {
					public function getSha1() {
						return 'abcd';
					}

					public function getWidth( $page ) {
						return 200;
					}

					public function getHeight( $page ) {
						return 40;
					}

					public function transform( $params ) {
						return new class {
							public function getLocalCopyPath() {
								return __FILE__;
							}
						};
					}
				};
				// No decoder is enabled: only an unsafe old-cache hit could return a path.
				$this->assertNull( $renderer->generateLayeredThumbnail( $file, $params ) );
				$this->assertSame( 'Old expression output', file_get_contents( $old ) );
			} finally {
				unlink( $old );
				rmdir( $directory . '/thumb/layers' );
				rmdir( $directory . '/thumb' );
				rmdir( $directory );
			}
		}
	}
}
