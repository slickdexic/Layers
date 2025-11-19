<?php

namespace MediaWiki\Extension\Layers\Security;

if ( !class_exists( __NAMESPACE__ . '\\RateLimiter', false ) ) {
	class RateLimiter {
		public bool $layerCountAllowed = true;
		public bool $complexityAllowed = true;
		public bool $imageAllowed = true;

		public function isLayerCountAllowed( int $layerCount ): bool {
			return $this->layerCountAllowed;
		}

		public function isComplexityAllowed( array $layers ): bool {
			return $this->complexityAllowed;
		}

		public function isImageSizeAllowed( int $width, int $height ): bool {
			return $this->imageAllowed;
		}
	}
}

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

require_once __DIR__ . '/../../../../src/Api/Traits/LayerSaveGuardsTrait.php';

use MediaWiki\Extension\Layers\Api\Traits\LayerSaveGuardsTrait;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use Psr\Log\LoggerInterface;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 */
class ApiLayersSaveGuardsTest extends \MediaWikiUnitTestCase {
	private function createHarness(): array {
		$logger = $this->createMock( LoggerInterface::class );
		$harness = new class( $logger ) {
			use LayerSaveGuardsTrait;

			private LoggerInterface $logger;

			public function __construct( LoggerInterface $logger ) {
				$this->logger = $logger;
			}

			protected function getLogger(): LoggerInterface {
				return $this->logger;
			}

			public function dieWithError( $msg, $code ) {
				throw new \RuntimeException( $msg . '|' . $code );
			}

			public function runLayerLimits( RateLimiter $rateLimiter, array $data, int $count ): void {
				$this->enforceLayerLimits( $rateLimiter, $data, $count );
			}

			public function runImageLimit( RateLimiter $rateLimiter, int $width, int $height ): void {
				$this->enforceImageSizeLimit( $rateLimiter, $width, $height );
			}
		};

		return [ $harness, $logger ];
	}

	public function testEnforceLayerLimitsRejectsTooManyLayers(): void {
		[ $harness, $logger ] = $this->createHarness();

		$logger->expects( $this->once() )
			->method( 'warning' )
			->with(
				$this->stringContains( 'Layer save rejected' ),
				$this->arrayHasKey( 'layer_count' )
			);

		$rateLimiter = new RateLimiter();
		$rateLimiter->layerCountAllowed = false;

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'layers-too-many-layers|toomanylayers' );
		$harness->runLayerLimits( $rateLimiter, [ [ 'type' => 'text' ] ], 5 );
	}

	public function testEnforceLayerLimitsRejectsExcessiveComplexity(): void {
		[ $harness, $logger ] = $this->createHarness();

		$logger->expects( $this->once() )
			->method( 'warning' )
			->with(
				$this->stringContains( 'Layer save rejected' ),
				$this->arrayHasKey( 'layer_count' )
			);

		$rateLimiter = new RateLimiter();
		$rateLimiter->layerCountAllowed = true;
		$rateLimiter->complexityAllowed = false;

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'layers-too-complex|toolayercomplex' );
		$harness->runLayerLimits( $rateLimiter, [ [ 'type' => 'path' ], [ 'type' => 'path' ] ], 2 );
	}

	public function testEnforceImageSizeLimitRejectsOversizedImages(): void {
		[ $harness, $logger ] = $this->createHarness();

		$logger->expects( $this->once() )
			->method( 'warning' )
			->with(
				$this->stringContains( 'image_too_large' ),
				$this->arrayHasKey( 'img_width' )
			);

		$rateLimiter = new RateLimiter();
		$rateLimiter->imageAllowed = false;

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'layers-image-too-large|imagetoolarge' );
		$harness->runImageLimit( $rateLimiter, 9000, 4500 );
	}
}
