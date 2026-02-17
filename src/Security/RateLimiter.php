<?php

declare( strict_types=1 );

/**
 * Rate limiting and performance protection
 *
 * RATE LIMIT CONFIGURATION:
 * This class uses MediaWiki's built-in rate limiting via User::pingLimiter().
 * Limits must be configured in LocalSettings.php using $wgRateLimits.
 *
 * Example configuration in LocalSettings.php:
 * ```php
 * $wgRateLimits['editlayers-save']['user'] = [ 30, 3600 ];   // 30 saves/hour
 * $wgRateLimits['editlayers-save']['newbie'] = [ 5, 3600 ];  // 5 saves/hour for new users
 * $wgRateLimits['editlayers-delete']['user'] = [ 20, 3600 ]; // 20 deletes/hour
 * $wgRateLimits['editlayers-rename']['user'] = [ 20, 3600 ]; // 20 renames/hour
 * $wgRateLimits['editlayers-create']['user'] = [ 10, 3600 ]; // 10 creates/hour
 * $wgRateLimits['editlayers-render']['user'] = [ 100, 3600 ]; // 100 renders/hour
 * $wgRateLimits['editlayers-info']['user'] = [ 200, 3600 ];  // 200 info requests/hour
 * $wgRateLimits['editlayers-list']['user'] = [ 100, 3600 ];  // 100 list requests/hour
 * ```
 *
 * Supported actions: save, delete, rename, create, render, info, list
 * Without configuration, no rate limiting is enforced.
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
	 * Check if user is within rate limits for layer operations.
	 *
	 * Uses MediaWiki's built-in rate limiting via User::pingLimiter().
	 * Limits must be configured in $wgRateLimits (see class docblock for examples).
	 *
	 * Supported actions and their limit keys:
	 * - save: editlayers-save
	 * - delete: editlayers-delete
	 * - rename: editlayers-rename
	 * - create: editlayers-create
	 * - render: editlayers-render
	 * - info: editlayers-info
	 * - list: editlayers-list
	 *
	 * @param User $user The user performing the action
	 * @param string $action Type of action: 'save', 'delete', 'rename', 'create', 'render', 'info', 'list'
	 * @return bool True if allowed, false if rate limited
	 */
	public function checkRateLimit( User $user, string $action ): bool {
		$limitKey = "editlayers-{$action}";

		// Check against MediaWiki's rate limiting system
		// pingLimiter() returns true if the user is being rate limited
		// Limits must be configured in $wgRateLimits (see class docblock)
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
