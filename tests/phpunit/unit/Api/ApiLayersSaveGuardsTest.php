<?php
// phpcs:disable MediaWiki.Commenting.FunctionComment.MissingDocumentationPublic -- Test harness

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

		$rateLimiter = $this->createMock( RateLimiter::class );
		$rateLimiter->method( 'isLayerCountAllowed' )->willReturn( false );

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

		$rateLimiter = $this->createMock( RateLimiter::class );
		$rateLimiter->method( 'isLayerCountAllowed' )->willReturn( true );
		$rateLimiter->method( 'isComplexityAllowed' )->willReturn( false );

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

		$rateLimiter = $this->createMock( RateLimiter::class );
		$rateLimiter->method( 'isImageSizeAllowed' )->willReturn( false );

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'layers-image-too-large|imagetoolarge' );
		$harness->runImageLimit( $rateLimiter, 9000, 4500 );
	}
}
