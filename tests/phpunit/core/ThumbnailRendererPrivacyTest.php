<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\ThumbnailRenderer;
use Psr\Log\LoggerInterface;

/**
 * @covers \MediaWiki\Extension\Layers\ThumbnailRenderer
 * @group Database
 */
class ThumbnailRendererPrivacyTest extends \MediaWikiIntegrationTestCase {
	public function testConverterFailureDoesNotLogLayerTextOrPaths(): void {
		$marker = 'private-layer-marker-e271';
		$path = '/tmp/private-render-path-e271';
		$converter = $this->getNewTempDirectory() . '/fake-converter';
		file_put_contents( $converter, "#!/bin/sh\nprintf '%s\\n' \"\$*\" >&2\nexit 23\n" );
		chmod( $converter, 0700 );
		$entries = [];
		$logger = $this->createMock( LoggerInterface::class );
		$logger->expects( $this->once() )->method( 'error' )->willReturnCallback(
			static function ( $message, array $context ) use ( &$entries ): void {
				$entries[] = [ $message, $context ];
			}
		);
		$config = new \HashConfig( [ 'UseImageMagick' => true, 'ImageMagickConvertCommand' => $converter,
			'MaxShellMemory' => 0, 'MaxShellTime' => 10, 'MaxShellFileSize' => 0,
			'LayersImageMagickTimeout' => 10, 'LayersDefaultFonts' => [ 'DejaVu-Sans' ] ] );
		$shellLog = new class extends \Psr\Log\AbstractLogger {
			public array $entries = [];

			public function log( $level, $message, array $context = [] ): void {
				$this->entries[] = [ $level, $message, $context ];
			}
		};
		$factory = $this->getServiceContainer()->getShellCommandFactory();
		$factory->setLogger( $shellLog );
		$renderer = new ThumbnailRenderer( $config, $logger );
		$method = new \ReflectionMethod( ThumbnailRenderer::class, 'overlayLayers' );
		$method->setAccessible( true );
		try {
			$result = $method->invoke( $renderer, $path . '-base', [ [ 'type' => 'text', 'x' => 1, 'y' => 1,
				'text' => $marker, 'fontSize' => 12, 'fill' => '#000000' ] ], $path . '-output', 1.0, 1.0, 10, 10 );
		} finally {
			$factory->setLogger( \MediaWiki\Logger\LoggerFactory::getInstance( 'exec' ) );
		}
		$this->assertFalse( $result );
		$logged = json_encode( [ $entries, $shellLog->entries ] );
		$this->assertStringNotContainsString( $marker, $logged );
		$this->assertStringNotContainsString( $path, $logged );
		$this->assertSame( 23, $entries[0][1]['exitCode'] );
	}

	public function testThumbnailExceptionDoesNotLogContentOrPaths(): void {
		$marker = 'private-exception-marker-e271';
		$entries = [];
		$logger = $this->createMock( LoggerInterface::class );
		$logger->expects( $this->once() )->method( 'warning' )->willReturnCallback(
			static function ( $message, array $context = [] ) use ( &$entries ): void {
				$entries[] = [ $message, $context ];
			}
		);
		$file = new class( $marker ) {
			private string $marker;

			public function __construct( string $marker ) {
				$this->marker = $marker;
			}

			public function transform( array $params ) {
				throw new \RuntimeException( $this->marker );
			}
		};
		$renderer = new ThumbnailRenderer( new \HashConfig( [] ), $logger );
		$this->assertNull( $renderer->generateLayeredThumbnail( $file, [ 'layers' => true,
			'layerData' => [ [ 'type' => 'text', 'text' => $marker ] ] ] ) );
		$this->assertStringNotContainsString( $marker, json_encode( $entries ) );
	}
}
