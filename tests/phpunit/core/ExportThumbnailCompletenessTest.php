<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Config\HashConfig;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\Shell\Shell;
use Psr\Log\NullLogger;

/** @covers \MediaWiki\Extension\Layers\ThumbnailRenderer::generateLayeredThumbnail */
class ExportThumbnailCompletenessTest extends \MediaWikiIntegrationTestCase {
	public function testFreshExportRendersKeepDroppedLayerEvidence(): void {
		$convert = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		if ( !$convert ) {
			$this->markTestSkipped( 'ImageMagick is not configured' );
		}
		$root = sys_get_temp_dir() . '/layers-export-render-' . bin2hex( random_bytes( 8 ) );
		mkdir( $root );
		$base = $root . '/base.png';
		$outputs = [];
		try {
			$this->assertSame( 0, Shell::command( $convert, '-size', '8x8', 'xc:white', $base )
				->includeStderr()->execute()->getExitCode() );
			$config = new HashConfig( [
				'UploadDirectory' => $root,
				'DirectoryMode' => 0777,
				'UseImageMagick' => true,
				'ImageMagickConvertCommand' => $convert,
				'MaxShellMemory' => 0,
				'MaxShellTime' => 60,
				'MaxShellFileSize' => 0,
				'LayersImageMagickTimeout' => 60
			] );
			$file = new class( $base ) {
				private string $base;
				public array $transformParams = [];

				public function __construct( string $base ) {
					$this->base = $base;
				}

				public function getSha1(): string {
					return str_repeat( 'a', 31 );
				}

				public function getWidth( $page ): int {
					return 8;
				}

				public function getHeight( $page ): int {
					return 8;
				}

				public function transform( $params ) {
					$this->transformParams[] = $params;
					return new class( $this->base ) {
						private string $base;

						public function __construct( string $base ) {
							$this->base = $base;
						}

						public function getLocalCopyPath(): string {
							return $this->base;
						}
					};
				}
			};
			foreach ( [ 'one', 'two' ] as $nonce ) {
				$renderer = new ThumbnailRenderer( $config, new NullLogger() );
				$output = $renderer->generateLayeredThumbnail( $file, [
					'width' => 8, 'page' => 1, 'layers' => true,
					'layerData' => [ [ 'type' => 'image', 'src' => 'invalid' ] ],
					'layersExportNonce' => $nonce
				] );
				$this->assertIsString( $output );
				$outputs[] = $output;
				$this->assertSame( [ 'image' ], $renderer->getDroppedLayerTypes() );
			}
			$this->assertNotSame( $outputs[0], $outputs[1] );
			foreach ( $file->transformParams as $params ) {
				$this->assertArrayNotHasKey( 'layersExportNonce', $params );
			}
		} finally {
			foreach ( $outputs as $path ) {
				if ( is_file( $path ) ) {
					unlink( $path );
				}
			}
			if ( is_file( $base ) ) {
				unlink( $base );
			}
			foreach ( [ $root . '/thumb/layers', $root . '/thumb', $root ] as $dir ) {
				if ( is_dir( $dir ) ) {
					rmdir( $dir );
				}
			}
		}
	}
}
