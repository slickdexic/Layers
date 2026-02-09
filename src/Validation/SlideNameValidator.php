<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Validation;

/**
 * Validator for slide names.
 *
 * Slide names must:
 * - Be 1-100 characters long
 * - Contain only alphanumeric characters, hyphens, and underscores
 * - Not start with a hyphen or underscore
 *
 * This is stricter than general set names to ensure URL-safety and
 * prevent issues with file system storage or database lookups.
 */
class SlideNameValidator {

	/** @var int Minimum slide name length */
	private const MIN_LENGTH = 1;

	/** @var int Maximum slide name length */
	private const MAX_LENGTH = 100;

	/**
	 * Valid characters pattern: alphanumeric, hyphen, underscore
	 * Must start with alphanumeric character
	 * @var string
	 */
	private const PATTERN = '/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/';

	/**
	 * Reserved names that cannot be used
	 * @var array
	 */
	private const RESERVED_NAMES = [
		'new',
		'create',
		'delete',
		'edit',
		'list',
		'all',
		'none',
		'null',
		'undefined'
	];

	/**
	 * Validate a slide name.
	 *
	 * @param string $name The slide name to validate
	 * @return bool True if valid, false otherwise
	 */
	public function isValid( string $name ): bool {
		$name = trim( $name );

		// Check length
		$length = strlen( $name );
		if ( $length < self::MIN_LENGTH || $length > self::MAX_LENGTH ) {
			return false;
		}

		// Check pattern
		if ( !preg_match( self::PATTERN, $name ) ) {
			return false;
		}

		// Check reserved names (case-insensitive)
		if ( in_array( strtolower( $name ), self::RESERVED_NAMES, true ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Validate and return error message if invalid.
	 *
	 * @param string $name The slide name to validate
	 * @return string|null Error message key, or null if valid
	 */
	public function validate( string $name ): ?string {
		$name = trim( $name );

		// Check length
		$length = strlen( $name );
		if ( $length < self::MIN_LENGTH ) {
			return 'layers-slide-name-required';
		}

		if ( $length > self::MAX_LENGTH ) {
			return 'layers-slide-name-too-long';
		}

		// Check pattern
		if ( !preg_match( self::PATTERN, $name ) ) {
			return 'layers-slide-invalid-name';
		}

		// Check reserved names
		if ( in_array( strtolower( $name ), self::RESERVED_NAMES, true ) ) {
			return 'layers-slide-name-reserved';
		}

		return null;
	}

	/**
	 * Sanitize a slide name by removing invalid characters.
	 *
	 * Note: This should be used for suggestion/correction only,
	 * not as a security measure. Always validate after sanitizing.
	 *
	 * @param string $name The slide name to sanitize
	 * @return string Sanitized name
	 */
	public function sanitize( string $name ): string {
		$name = trim( $name );

		// Collapse multiple spaces into one, then replace with hyphens
		$name = preg_replace( '/\s+/', ' ', $name );
		$name = str_replace( ' ', '-', $name );

		// Remove invalid characters
		$name = preg_replace( '/[^a-zA-Z0-9_-]/', '', $name );

		// Ensure it starts and ends with alphanumeric
		$name = ltrim( $name, '_-' );
		$name = rtrim( $name, '_-' );

		// Truncate to max length
		if ( strlen( $name ) > self::MAX_LENGTH ) {
			$name = substr( $name, 0, self::MAX_LENGTH );
		}

		return $name;
	}

	/**
	 * Get the minimum allowed length.
	 *
	 * @return int
	 */
	public function getMinLength(): int {
		return self::MIN_LENGTH;
	}

	/**
	 * Get the maximum allowed length.
	 *
	 * @return int
	 */
	public function getMaxLength(): int {
		return self::MAX_LENGTH;
	}
}
