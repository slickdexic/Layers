<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api\Traits;

use MediaWiki\Extension\Layers\Security\RateLimiter;
use Psr\Log\LoggerInterface;

trait LayerSaveGuardsTrait {
	abstract protected function getLogger(): LoggerInterface;

	/**
	 * Enforce configured layer count and complexity limits.
	 */
	protected function enforceLayerLimits( RateLimiter $rateLimiter, array $sanitizedData, int $layerCount ): void {
		if ( !$rateLimiter->isLayerCountAllowed( $layerCount ) ) {
			$this->logGuardRejection( 'too_many_layers', [ 'layer_count' => $layerCount ] );
			$this->dieWithError( 'layers-too-many-layers', 'toomanylayers' );
		}

		if ( !$rateLimiter->isComplexityAllowed( $sanitizedData ) ) {
			$this->logGuardRejection( 'layer_complexity', [ 'layer_count' => $layerCount ] );
			$this->dieWithError( 'layers-too-complex', 'toolayercomplex' );
		}
	}

	/**
	 * Enforce image size constraints based on configured dimensions.
	 */
	protected function enforceImageSizeLimit( RateLimiter $rateLimiter, int $imgWidth, int $imgHeight ): void {
		if ( $imgWidth <= 0 || $imgHeight <= 0 ) {
			return;
		}
		if ( !$rateLimiter->isImageSizeAllowed( $imgWidth, $imgHeight ) ) {
			$this->logGuardRejection( 'image_too_large', [ 'img_width' => $imgWidth, 'img_height' => $imgHeight ] );
			$this->dieWithError( 'layers-image-too-large', 'imagetoolarge' );
		}
	}

	/**
	 * Emit a structured warning when server-side limits reject a save.
	 */
	protected function logGuardRejection( string $reason, array $context = [] ): void {
		$this->getLogger()->warning(
			'Layer save rejected: ' . $reason,
			array_merge( [ 'reason' => $reason ], $context )
		);
	}
}
