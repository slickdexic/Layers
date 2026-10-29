<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Api\ApiLayersExport;
use Psr\Log\LoggerInterface;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersExport
 * @group Database
 */
class ApiLayersExportPrivacyTest extends \MediaWikiIntegrationTestCase {
	public function testFailedStitchDoesNotLogPrivatePaths(): void {
		$converter = $this->getNewTempDirectory() . '/fake-converter';
		file_put_contents( $converter, "#!/bin/sh\nprintf '%s\\n' \"\$*\" >&2\nexit 23\n" );
		chmod( $converter, 0700 );
		$marker = '/tmp/private-export-marker-e271';
		$entries = [];
		$logger = $this->createMock( LoggerInterface::class );
		$logger->expects( $this->once() )->method( 'warning' )->willReturnCallback(
			static function ( $message, array $context = [] ) use ( &$entries ): void {
				$entries[] = [ $message, $context ];
			}
		);
		$config = new \HashConfig( [ 'ImageMagickConvertCommand' => $converter, 'MaxShellMemory' => 0,
			'MaxShellFileSize' => 0, 'LayersImageMagickTimeout' => 10 ] );
		$module = $this->getMockBuilder( ApiLayersExport::class )->disableOriginalConstructor()
			->onlyMethods( [ 'getConfig', 'getLogger' ] )->getMock();
		$module->method( 'getConfig' )->willReturn( $config );
		$module->method( 'getLogger' )->willReturn( $logger );
		$shellLog = new class extends \Psr\Log\AbstractLogger {
			public array $entries = [];

			public function log( $level, $message, array $context = [] ): void {
				$this->entries[] = [ $level, $message, $context ];
			}
		};
		$factory = $this->getServiceContainer()->getShellCommandFactory();
		$factory->setLogger( $shellLog );
		$method = new \ReflectionMethod( ApiLayersExport::class, 'stitchPdf' );
		$method->setAccessible( true );
		try {
			$result = $method->invoke( $module, [ $marker . '-page.png' ], $marker . '-output.pdf' );
		} finally {
			$factory->setLogger( \MediaWiki\Logger\LoggerFactory::getInstance( 'exec' ) );
		}
		$this->assertFalse( $result );
		$this->assertArrayHasKey( 'exitCode', $entries[0][1], json_encode( [ $entries, $shellLog->entries ] ) );
		$logged = json_encode( [ $entries, $shellLog->entries ], JSON_UNESCAPED_SLASHES );
		$this->assertStringNotContainsString( $marker, $logged );
		$this->assertSame( 23, $entries[0][1]['exitCode'] );
	}
}
