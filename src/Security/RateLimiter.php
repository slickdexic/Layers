<?php
/**
 * Rate limiting and performance protection
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Security;

use MediaWiki\MediaWikiServices;
use User;

class RateLimiter {

	/** @var \Config */
	private $config;

	public function __construct() {
		$this->config = MediaWikiServices::getInstance()->getMainConfig();
	}

	/**
	 * Check if user is within rate limits for layer operations
	 *
	 * @param User $user
	 * @param string $action Type of action: 'save', 'render', 'create'
	 * @return bool True if allowed, false if rate limited
	 */
	public function checkRateLimit( User $user, string $action ): bool {
		// Skip rate limiting for privileged users
		if ( $user->isAllowed( 'managelayerlibrary' ) ) {
			return true;
		}

		// Get rate limits from config with proper fallback
		$rateLimits = $this->config->get( 'RateLimits' ) ?? [];

		$limitKey = "editlayers-{$action}";

		// Default limits if not configured
		$defaultLimits = [
			'editlayers-save' => [
				// 30 saves per hour for users
				'user' => [ 30, 3600 ],
				// 5 saves per hour for new users
				'newbie' => [ 5, 3600 ],
				// 50 saves per hour for autoconfirmed
				'autoconfirmed' => [ 50, 3600 ],
			],
			'editlayers-render' => [
				// 100 renders per hour
				'user' => [ 100, 3600 ],
				// 20 renders per hour for new users
				'newbie' => [ 20, 3600 ],
				// 200 renders per hour for autoconfirmed
				'autoconfirmed' => [ 200, 3600 ],
			],
			'editlayers-create' => [
				// 10 new layer sets per hour
				'user' => [ 10, 3600 ],
				// 2 new layer sets per hour for new users
				'newbie' => [ 2, 3600 ],
				// 20 new layer sets per hour for autoconfirmed
				'autoconfirmed' => [ 20, 3600 ],
			],
		];

		// Use configured limits or fall back to defaults
		$limits = $rateLimits[$limitKey] ?? $defaultLimits[$limitKey] ?? null;

		if ( !$limits ) {
			// No limits configured
			return true;
		}

		// Set the limits in MediaWiki's rate limiting system
		$this->config->set( 'RateLimits', array_merge( $rateLimits, [ $limitKey => $limits ] ) );

		// Check against MediaWiki's rate limiting system
		return !$user->pingLimiter( $limitKey );
	}

	/**
	 * Validate image size for processing
	 *
	 * @param int $width
	 * @param int $height
	 * @return bool
	 */
	public function isImageSizeAllowed( int $width, int $height ): bool {
		$maxDimensions = $this->config->get( 'LayersMaxImageDimensions' );

		return $width <= $maxDimensions && $height <= $maxDimensions;
	}

	/**
	 * Check if layer count is within limits
	 *
	 * @param int $layerCount
	 * @return bool
	 */
	public function isLayerCountAllowed( int $layerCount ): bool {
		// Prevent abuse with too many layers
		return $layerCount <= 50;
	}

	/**
	 * Validate layer complexity (approximate processing cost)
	 *
	 * @param array $layers
	 * @return bool
	 */
	public function isComplexityAllowed( array $layers ): bool {
		$complexity = 0;

		foreach ( $layers as $layer ) {
			switch ( $layer['type'] ) {
				case 'text':
					$complexity += 2;
					break;
				case 'rectangle':
				case 'circle':
				case 'line':
					$complexity += 1;
					break;
				case 'arrow':
					// More complex to render
					$complexity += 3;
					break;
				case 'highlight':
					$complexity += 1;
					break;
				default:
					$complexity += 2; // Unknown types are more expensive
			}
		}

		// Maximum complexity threshold
		return $complexity <= 100;
	}
}
