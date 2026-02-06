<?php

declare( strict_types=1 );

/**
 * Rate limiting and performance protection
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Security;

use Config;
use MediaWiki\MediaWikiServices;
use User;

class RateLimiter {
	/** @var Config|null */
	private $config;

	public function __construct( ?Config $config = null ) {
		$this->config = $config;
	}

	private function getConfig(): Config {
		if ( $this->config ) {
			return $this->config;
		}
		if ( class_exists( MediaWikiServices::class ) ) {
			$this->config = MediaWikiServices::getInstance()->getMainConfig();
			return $this->config;
		}
		return new \HashConfig( [] );
	}

	/**
	 * Check if user is within rate limits for layer operations
	 * Implements separate rate limits for privileged users to prevent resource exhaustion
	 * attacks from compromised admin accounts
	 *
	 * @param User $user
	 * @param string $action Type of action: 'save', 'render', 'create'
	 * @return bool True if allowed, false if rate limited
	 */
	public function checkRateLimit( User $user, string $action ): bool {
		// Get rate limits from config with proper fallback
		$config = $this->getConfig();
		$rateLimits = $config->get( 'RateLimits' ) ?? [];

		$limitKey = "editlayers-{$action}";

		// Default limits if not configured - includes privileged user limits
		$defaultLimits = [
			'editlayers-save' => [
				// 30 saves per hour for users
				'user' => [ 30, 3600 ],
				// 5 saves per hour for new users
				'newbie' => [ 5, 3600 ],
				// 50 saves per hour for autoconfirmed
				'autoconfirmed' => [ 50, 3600 ],
				// Higher but limited rate for privileged users (prevents abuse)
				'sysop' => [ 100, 3600 ],
				// Separate limit for library managers
				'managelayerlibrary' => [ 200, 3600 ],
			],
			'editlayers-delete' => [
				// 20 deletes per hour for users (lower than save since deletes are destructive)
				'user' => [ 20, 3600 ],
				// 3 deletes per hour for new users (very restrictive)
				'newbie' => [ 3, 3600 ],
				// 30 deletes per hour for autoconfirmed
				'autoconfirmed' => [ 30, 3600 ],
				// Higher but limited rate for privileged users
				'sysop' => [ 50, 3600 ],
				// Separate limit for library managers
				'managelayerlibrary' => [ 100, 3600 ],
			],
			'editlayers-render' => [
				// 100 renders per hour
				'user' => [ 100, 3600 ],
				// 20 renders per hour for new users
				'newbie' => [ 20, 3600 ],
				// 200 renders per hour for autoconfirmed
				'autoconfirmed' => [ 200, 3600 ],
				// Higher but limited rate for privileged users
				'sysop' => [ 500, 3600 ],
				'managelayerlibrary' => [ 1000, 3600 ],
			],
			'editlayers-create' => [
				// 10 new layer sets per hour
				'user' => [ 10, 3600 ],
				// 2 new layer sets per hour for new users
				'newbie' => [ 2, 3600 ],
				// 20 new layer sets per hour for autoconfirmed
				'autoconfirmed' => [ 20, 3600 ],
				// Higher but limited rate for privileged users
				'sysop' => [ 50, 3600 ],
				'managelayerlibrary' => [ 100, 3600 ],
			],
			'editlayers-rename' => [
				// 20 renames per hour for users (same as delete since it's a metadata change)
				'user' => [ 20, 3600 ],
				// 3 renames per hour for new users (restrictive)
				'newbie' => [ 3, 3600 ],
				// 30 renames per hour for autoconfirmed
				'autoconfirmed' => [ 30, 3600 ],
				// Higher but limited rate for privileged users
				'sysop' => [ 50, 3600 ],
				// Separate limit for library managers
				'managelayerlibrary' => [ 100, 3600 ],
			],
			'editlayers-info' => [
				// 200 info requests per hour for users (read-only but still limited)
				'user' => [ 200, 3600 ],
				// 50 info requests per hour for new users
				'newbie' => [ 50, 3600 ],
				// 500 info requests per hour for autoconfirmed
				'autoconfirmed' => [ 500, 3600 ],
				// Higher limits for privileged users
				'sysop' => [ 1000, 3600 ],
				'managelayerlibrary' => [ 2000, 3600 ],
			],
			'editlayers-list' => [
				// 100 list requests per hour for users (Special:Slides pagination)
				'user' => [ 100, 3600 ],
				// 30 list requests per hour for new users
				'newbie' => [ 30, 3600 ],
				// 200 list requests per hour for autoconfirmed
				'autoconfirmed' => [ 200, 3600 ],
				// Higher limits for privileged users
				'sysop' => [ 500, 3600 ],
				'managelayerlibrary' => [ 1000, 3600 ],
			],
		];

		// Use configured limits or fall back to defaults
		$limits = $rateLimits[$limitKey] ?? $defaultLimits[$limitKey] ?? null;

		if ( !$limits ) {
			// No limits configured - allow but log this condition
			$this->logRateLimitEvent( $user, $action, 'no_limits_configured' );
			return true;
		}

		// Check against MediaWiki's rate limiting system
		// This will automatically handle different user groups and their limits
		$isLimited = $user->pingLimiter( $limitKey );

		if ( $isLimited ) {
			$this->logRateLimitEvent( $user, $action, 'rate_limited' );
		}

		return !$isLimited;
	}

	/**
	 * Log rate limiting events for security monitoring
	 *
	 * @param User $user The user being rate limited
	 * @param string $action The action being performed
	 * @param string $result The result (rate_limited, no_limits_configured, etc.)
	 */
	private function logRateLimitEvent( User $user, string $action, string $result ): void {
		// Use MediaWiki logging if available
		if ( function_exists( 'wfLogWarning' ) ) {
			wfLogWarning( sprintf(
				'Layers rate limit: user=%d action=%s result=%s',
				$user->getId(),
				$action,
				$result
			) );
		}
	}

	/**
	 * Validate image size for processing
	 *
	 * @param int $width
	 * @param int $height
	 * @return bool
	 */
	public function isImageSizeAllowed( int $width, int $height ): bool {
		$config = $this->getConfig();
		$maxDimensions = $config->get( 'LayersMaxImageDimensions' );

		// Support both scalar (single max edge) and array [maxW, maxH] or ['width'=>, 'height'=>]
		if ( is_array( $maxDimensions ) ) {
			$maxW = null;
			$maxH = null;
			if ( isset( $maxDimensions['width'] ) || isset( $maxDimensions['height'] ) ) {
				$w = $maxDimensions['width'] ?? ( $maxDimensions['height'] ?? 0 );
				$h = $maxDimensions['height'] ?? ( $maxDimensions['width'] ?? 0 );
				$maxW = (int)$w;
				$maxH = (int)$h;
			} else {
				$maxW = (int)( $maxDimensions[0] ?? 0 );
				$maxH = (int)( $maxDimensions[1] ?? $maxW );
			}
			if ( $maxW <= 0 || $maxH <= 0 ) {
				// no effective limit configured
				return true;
			}
			return ( $width <= $maxW && $height <= $maxH );
		}

		// Fallback to single edge limit, prefer LayersMaxImageDimensions, else LayersMaxImageSize
		$maxEdge = (int)$maxDimensions;
		if ( $maxEdge <= 0 ) {
			$maxEdge = (int)( $config->get( 'LayersMaxImageSize' ) ?? 0 );
		}
		if ( $maxEdge <= 0 ) {
			return true;
		}
		return ( $width <= $maxEdge && $height <= $maxEdge );
	}

	/**
	 * Check if layer count is within limits
	 *
	 * @param int $layerCount
	 * @return bool
	 */
	public function isLayerCountAllowed( int $layerCount ): bool {
		// Use configured limit with a safe default
		$config = $this->getConfig();
		$maxLayers = (int)( $config->get( 'LayersMaxLayerCount' ) ?? 100 );
		if ( $maxLayers <= 0 ) {
			$maxLayers = 100;
		}
		return $layerCount <= $maxLayers;
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
			$type = $layer['type'] ?? 'unknown';
			switch ( $type ) {
				// Text rendering is moderately expensive
				case 'text':
				case 'textbox':
				case 'callout':
					$complexity += 2;
					break;

				// Complex types with potential for large data
				case 'customShape':
				case 'image':
				case 'path':
					$complexity += 3;
					break;

				// Arrows with curves are moderately complex
				case 'arrow':
					$complexity += 2;
					break;

				// Groups multiply complexity by contained layers
				case 'group':
					$complexity += 2;
					break;

				// Simple shapes and other known types
				case 'rectangle':
				case 'circle':
				case 'ellipse':
				case 'line':
				case 'polygon':
				case 'star':
				case 'blur':
				case 'marker':
				case 'dimension':
					$complexity += 1;
					break;

				// Unknown types are expensive (conservative)
				default:
					$complexity += 3;
					break;
			}
		}

		// Use configured limit with a safe default
		$config = $this->getConfig();
		$maxComplexity = (int)( $config->get( 'LayersMaxComplexity' ) ?? LayersConstants::DEFAULT_MAX_COMPLEXITY );
		if ( $maxComplexity <= 0 ) {
			$maxComplexity = LayersConstants::DEFAULT_MAX_COMPLEXITY;
		}
		return $complexity <= $maxComplexity;
	}
}
