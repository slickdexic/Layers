<?php

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\MediaWikiServices;

class ApiLayersSave extends ApiBase {

	/**
	 * Main execution function
	 *
	 * @throws \ApiUsageException When user lacks permission or data is invalid
	 * @throws \Exception When database operations fail
	 */
	public function execute() {
		$user = $this->getUser();
		$params = $this->extractRequestParams();
		$this->checkUserRightsAny( 'editlayers' );
		// Ensure DB schema is present (helpful error if extension tables are missing)
		if ( !$this->isSchemaInstalled() ) {
			$this->dieWithError( [ 'layers-db-error', 'Layer tables missing. Please run maintenance/update.php' ], 'dbschema-missing' );
		}

		$fileName = $params['filename'];
		$data = $params['data'];
		$setName = $params['setname'] ?? 'default';
		// Sanitize user-provided set name to prevent XSS or invalid content
		if ( is_string( $setName ) ) {
			$setName = $this->sanitizeTextInput( $setName );
			if ( $setName === '' ) {
				$setName = 'default';
			}
			// Enforce sane length
			if ( strlen( $setName ) > 255 ) {
				$setName = substr( $setName, 0, 255 );
			}
		} else {
			$setName = 'default';
		}

		if ( !$this->isValidFilename( $fileName ) ) {
			$this->dieWithError( 'layers-invalid-filename', 'invalidfilename' );
		}

		$maxBytes = $this->getConfig()->get( 'LayersMaxBytes' ) ?: 2097152;
		if ( strlen( $data ) > $maxBytes ) {
			$this->dieWithError( 'layers-data-too-large', 'datatoolarge' );
		}

		$layersData = json_decode( $data, true );
		if ( $layersData === null ) {
			$this->dieWithError( 'layers-json-parse-error', 'invalidjson' );
		}

		// Use the new validation architecture
		$validator = new \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator();
		$validationResult = $validator->validateLayers( $layersData );

		if ( !$validationResult->isValid() ) {
			$errors = implode( '; ', $validationResult->getErrors() );
			$this->dieWithError( [ 'layers-validation-failed', $errors ], 'validationfailed' );
		}

		$sanitizedData = $validationResult->getData();

		// Log any validation warnings
		if ( $validationResult->hasWarnings() ) {
			$warnings = implode( '; ', $validationResult->getWarnings() );
			error_log( "Layers validation warnings: $warnings" );
		}

		// Rate limiting
		$rateLimiter = new RateLimiter();
		if ( !$rateLimiter->checkRateLimit( $user, 'save' ) ) {
			$this->dieWithError( 'layers-rate-limited', 'ratelimited' );
		}

		// Resolve file and gather metadata
		$repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
		$file = $repoGroup->findFile( $fileName );
		if ( !$file || !$file->exists() ) {
			$this->dieWithError( 'layers-file-not-found', 'filenotfound' );
		}
		$mime = $file->getMimeType() ?: '';
		$parts = explode( '/', $mime, 2 );
		$majorMime = $parts[0] ?? '';
		$minorMime = $parts[1] ?? '';
		$sha1 = $file->getSha1();

		$db = $this->getServices()->get( 'LayersDatabase' );
		$result = $db->saveLayerSet(
			$file->getName(),
			$majorMime,
			$minorMime,
			$sha1,
			$sanitizedData,
			(int)$user->getId(),
			$setName
		);

		if ( $result ) {
			$this->getResult()->addValue( null, $this->getModuleName(), [
				'success' => 1,
				'layersetid' => (int)$result,
				'result' => 'Success'
			] );
		} else {
			$this->dieWithError( 'layers-save-failed', 'savefailed' );
		}
	}

	/**
	 * Check whether required DB schema exists
	 *
	 * @return bool True if layer tables exist and are accessible
	 */
	private function isSchemaInstalled(): bool {
		try {
			$services = MediaWikiServices::getInstance();
			$lb = $services->getDBLoadBalancer();
			if ( !$lb ) {
				return false;
			}
			// Use write connection to match the target of INSERTs and avoid schema drift on replicas
			if ( defined( 'DB_PRIMARY' ) ) {
				$dbr = $lb->getConnection( DB_PRIMARY );
			} elseif ( defined( 'DB_MASTER' ) ) {
				// Fallback for older MediaWiki versions
				$dbr = $lb->getConnection( DB_PRIMARY );
			} else {
				$dbr = $lb->getConnection( 0 );
			}
			if ( !\is_object( $dbr ) ) {
				return false;
			}
			// fieldInfo handles table prefixes; existence implies table is created
			return (bool)$dbr->fieldInfo( 'layer_sets', 'ls_id' );
		} catch ( \Throwable $e ) {
			return false;
		}
	}

	/**
	 * Validate filename for security
	 *
	 * @param string $filename The filename to validate
	 * @return bool True if filename is safe and valid
	 */
	private function isValidFilename( string $filename ): bool {
		// Basic filename validation
		if ( strlen( $filename ) > 255 || strlen( $filename ) < 1 ) {
			return false;
		}

		// Check for path traversal attempts
		if ( strpos( $filename, '..' ) !== false || strpos( $filename, '/' ) !== false ) {
			return false;
		}

		// Allow alphanumerics, spaces, dots, dashes, underscores and parentheses
		if ( !preg_match( '/^[\w .()\-]+$/u', $filename ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Validate color values with enhanced security to prevent CSS injection
	 *
	 * @param mixed $color The color value to validate (string, array, or other)
	 * @return bool True if color is valid and safe
	 */
	private function isValidColor( $color ): bool {
		if ( !is_string( $color ) ) {
			return false;
		}

		// Prevent extremely long color strings (potential DoS)
		if ( strlen( $color ) > 50 ) {
			return false;
		}

		// Remove any whitespace and convert to lowercase for consistent validation
		$color = trim( strtolower( $color ) );

		// Reject empty strings
		if ( empty( $color ) ) {
			return false;
		}

		// Check for dangerous characters that could be used for CSS injection
		if ( preg_match( '/[<>"\'\\\\\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $color ) ) {
			return false;
		}

		// Check for CSS escape sequences or expressions
		if ( preg_match( '/\\\\|expression|javascript|@import|url\(|\/\*|\*\//', $color ) ) {
			return false;
		}

		// Allow hex colors with strict validation (3, 4, 6, 8 digits only)
		if ( preg_match( '/^#[0-9a-f]{3}$|^#[0-9a-f]{4}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/', $color ) ) {
			return true;
		}

		// Allow rgb/rgba with very strict validation
		if ( preg_match( '/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/', $color, $matches ) ) {
			// Validate RGB values are in 0-255 range
			for ( $i = 1; $i <= 3; $i++ ) {
				$value = (int)$matches[$i];
				if ( $value < 0 || $value > 255 ) {
					return false;
				}
			}
			return true;
		}

		// Allow rgba with alpha validation
		if ( preg_match( '/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0(?:\.\d{1,3})?|1(?:\.0{1,3})?)\s*\)$/', $color, $matches ) ) {
			// Validate RGB values are in 0-255 range
			for ( $i = 1; $i <= 3; $i++ ) {
				$value = (int)$matches[$i];
				if ( $value < 0 || $value > 255 ) {
					return false;
				}
			}
			// Validate alpha is between 0 and 1
			$alpha = (float)$matches[4];
			if ( $alpha < 0 || $alpha > 1 ) {
				return false;
			}
			return true;
		}

		// Allow HSL with strict validation
		if ( preg_match( '/^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/', $color, $matches ) ) {
			$hue = (int)$matches[1];
			$saturation = (int)$matches[2];
			$lightness = (int)$matches[3];

			if ( $hue < 0 || $hue > 360 || $saturation < 0 || $saturation > 100 || $lightness < 0 || $lightness > 100 ) {
				return false;
			}
			return true;
		}

		// Allow HSLA with strict validation
		if ( preg_match( '/^hsla\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*(0(?:\.\d{1,3})?|1(?:\.0{1,3})?)\s*\)$/', $color, $matches ) ) {
			$hue = (int)$matches[1];
			$saturation = (int)$matches[2];
			$lightness = (int)$matches[3];
			$alpha = (float)$matches[4];

			if (
				$hue < 0 || $hue > 360 || $saturation < 0 || $saturation > 100 ||
				 $lightness < 0 || $lightness > 100 || $alpha < 0 || $alpha > 1
			) {
				return false;
			}
			return true;
		}

		// Very strict whitelist of named colors (prevent CSS injection via unknown color names)
		$safeColors = [
			'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange',
			'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime',
			'navy', 'maroon', 'olive', 'teal', 'silver', 'aqua', 'fuchsia',
			'darkred', 'darkgreen', 'darkblue', 'lightgray', 'lightgrey', 'darkgray', 'darkgrey'
		];

		return in_array( $color, $safeColors, true );
	}

	/**
	 * Sanitize color values to prevent injection attacks
	 *
	 * @param mixed $color The color value to sanitize
	 * @return string Safe, sanitized color value
	 */
	private function sanitizeColor( $color ): string {
		if ( !is_string( $color ) ) {
			return '#000000';
		}

		// If it passes strict validator, return as-is
		if ( $this->isValidColor( $color ) ) {
			return $color;
		}

		// Try to coerce common slightly-off formats (e.g., spaces/no spaces in rgba/hsl)
		$normalized = trim( $color );
		// Collapse multiple spaces
		$normalized = preg_replace( '/\s+/', ' ', $normalized );

		if ( $this->isValidColor( $normalized ) ) {
			return $normalized;
		}

		// Default to black if invalid
		return '#000000';
	}

	/**
	 * Get allowed parameters for this API module
	 *
	 * @return array Array of parameter definitions for filename, data, setname, and token
	 */
	public function getAllowedParams() {
		return [
			'filename' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true,
			],
			'data' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true,
			],
			'setname' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false,
			],
			'token' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true,
			],
		];
	}

	/**
	 * Check if this API module needs a token
	 *
	 * @return string Type of token required ('csrf' for write operations)
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * Check if this API module is in write mode
	 *
	 * @return bool True since this module modifies data
	 */
	public function isWriteMode() {
		return true;
	}

	/**
	 * Sanitize text input to prevent XSS attacks
	 * Uses secure whitelist-based approach instead of complex multi-step sanitization
	 *
	 * @param string $text The text input to sanitize
	 * @return string Safe, sanitized text
	 */
	private function sanitizeTextInput( string $text ): string {
		// Limit text length to prevent DoS attacks
		if ( strlen( $text ) > 1000 ) {
			$text = substr( $text, 0, 1000 );
		}

		// Simple but secure approach: strip all HTML tags first
		$text = strip_tags( $text );

		// Remove any protocol handlers that could be dangerous
		$text = preg_replace( '/(?:javascript|data|vbscript|file|about):/i', '', $text );

		// Remove event handlers that might slip through
		$text = preg_replace( '/on\w+\s*=/i', '', $text );

		// Remove any remaining angle brackets to prevent HTML injection
		$text = str_replace( [ '<', '>' ], '', $text );

		// Final safety: encode any remaining special characters
		$text = htmlspecialchars( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8', false );

		return trim( $text );
	}

	/**
	 * Sanitize identifier fields (id, type, etc.) to ensure they contain only safe values
	 *
	 * @param string $identifier The identifier to sanitize
	 * @return string Safe, sanitized identifier
	 */
	private function sanitizeIdentifier( string $identifier ): string {
		// Limit length
		if ( strlen( $identifier ) > 100 ) {
			$identifier = substr( $identifier, 0, 100 );
		}

		// Allow only alphanumeric characters, hyphens, underscores
		$identifier = preg_replace( '/[^a-zA-Z0-9_-]/', '', $identifier );

		return trim( $identifier );
	}

	/**
	 * Get example messages for this API module
	 *
	 * @return array Array of example API calls with descriptions
	 */
	public function getExamplesMessages() {
		return [
			// Example: action=layerssave&filename=Example.jpg&data=[{"id":"1","type":"text","text":"Hello","x":100,"y":50}]&token=123ABC
			'action=layerssave&filename=Example.jpg&data=' .
				'[{"id":"1","type":"text","text":"Hello","x":100,"y":50}]&token=123ABC' =>
				'apihelp-layerssave-example-1',
		];
	}
}
