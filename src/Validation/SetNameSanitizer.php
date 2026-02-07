<?php

declare( strict_types=1 );

/**
 * Layer set name sanitization utilities.
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Validation;

use MediaWiki\Extension\Layers\LayersConstants;

/**
 * Provides sanitization for layer set names.
 *
 * This class extracts the sanitizeSetName logic that was previously duplicated
 * across ApiLayersSave, ApiLayersDelete, and ApiLayersRename.
 *
 * SECURITY CONSIDERATIONS:
 * - Removes control characters to prevent log injection
 * - Removes path separators to prevent traversal attacks
 * - Whitelist-based character filtering (letters, numbers, underscore, dash, space)
 * - Unicode-safe with fallback for environments without PCRE unicode support
 * - Enforces database column limit (255 bytes)
 *
 * @package MediaWiki\Extension\Layers\Validation
 */
class SetNameSanitizer {

	/**
	 * Maximum length for set names (database column limit)
	 */
	private const MAX_LENGTH = 255;

	/**
	 * Sanitize a user-supplied layer set name.
	 *
	 * Transforms arbitrary user input into a safe set name suitable for:
	 * - Database storage (VARCHAR(255))
	 * - HTML output (no XSS vectors)
	 * - File system safety (no path separators)
	 * - Log safety (no control characters)
	 *
	 * @param string $rawSetName The raw user input
	 * @return string Sanitized set name, defaults to 'default' if empty
	 */
	public static function sanitize( string $rawSetName ): string {
		$setName = trim( $rawSetName );

		// Remove control chars and path separators to avoid traversal and logging issues
		$setName = preg_replace( '/[\x00-\x1F\x7F\/\\\\]/u', '', $setName );

		// Allow any letter/number from any script plus underscore, dash, and spaces
		$unicodeSafe = preg_replace( '/[^\p{L}\p{N}_\-\s]/u', '', $setName );

		if ( $unicodeSafe === null ) {
			// Fallback for environments without unicode PCRE support
			$unicodeSafe = preg_replace( '/[^a-zA-Z0-9_\-\s]/', '', $setName );
		}
		$setName = $unicodeSafe ?? '';

		// Collapse repeated whitespace
		$setName = preg_replace( '/\s+/u', ' ', $setName );

		// Enforce database column limit with multibyte-aware substring when possible
		if ( function_exists( 'mb_substr' ) ) {
			$setName = mb_substr( $setName, 0, self::MAX_LENGTH );
		} else {
			$setName = substr( $setName, 0, self::MAX_LENGTH );
		}

		return $setName === '' ? LayersConstants::DEFAULT_SET_NAME : $setName;
	}

	/**
	 * Validate that a set name meets requirements without modifying it.
	 *
	 * Use this when you want to reject invalid input rather than silently fix it.
	 *
	 * @param string $setName The set name to validate
	 * @return bool True if valid, false otherwise
	 */
	public static function isValid( string $setName ): bool {
		// Empty is invalid (though sanitize() would return 'default')
		if ( trim( $setName ) === '' ) {
			return false;
		}

		// Check for control characters
		if ( preg_match( '/[\x00-\x1F\x7F]/', $setName ) ) {
			return false;
		}

		// Check for path separators
		if ( preg_match( '/[\/\\\\]/', $setName ) ) {
			return false;
		}

		// Must match the same whitelist that sanitize() allows:
		// Unicode letters, numbers, underscore, dash, spaces
		if ( !preg_match( '/^[\p{L}\p{N}_\-\s]+$/u', $setName ) ) {
			return false;
		}

		// Check length
		$length = function_exists( 'mb_strlen' ) ? mb_strlen( $setName ) : strlen( $setName );
		if ( $length > self::MAX_LENGTH ) {
			return false;
		}

		return true;
	}

	/**
	 * Get the default set name constant.
	 *
	 * @return string The default set name ('default')
	 */
	public static function getDefaultName(): string {
		return LayersConstants::DEFAULT_SET_NAME;
	}
}
