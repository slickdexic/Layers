<?php
namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\MediaWikiServices;
use ApiBase;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Security\RateLimiter;

class ApiLayersSave extends ApiBase {

	/**
	 * Main execution function
	 * @throws \ApiUsageException
	 * @throws \Exception
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

		$sanitizedData = $this->validateAndSanitizeLayersData( $layersData );
		if ( $sanitizedData === false ) {
			$this->dieWithError( 'layers-invalid-data', 'invaliddata' );
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

		$db = new LayersDatabase();
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
	 * @return bool
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
				$dbr = $lb->getConnection( DB_MASTER );
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
	 * Validates and sanitizes layer data.
	 * Returns sanitized data array on success, false on failure.
	 *
	 * @param array $layersData
	 * @return array|false
	 */
	private function validateAndSanitizeLayersData( array $layersData ) {
		if ( !is_array( $layersData ) ) {
			return false;
		}
		$maxLayers = $this->getConfig()->get( 'LayersMaxLayerCount' ) ?: 100;
		if ( count( $layersData ) > $maxLayers ) {
			return false;
		}
		$validTypes = [
			'text', 'arrow', 'rectangle', 'circle', 'ellipse',
			'polygon', 'star', 'line', 'highlight', 'path', 'blur'
		];

		$sanitized = [];
		foreach ( $layersData as $layer ) {
			if ( !is_array( $layer ) || !isset( $layer['type'] ) || !in_array( $layer['type'], $validTypes, true ) ) {
				return false; // Invalid layer structure
			}

			$cleanLayer = [];
			// Whitelist of allowed properties and their expected types
			$allowedProps = [
				'type' => 'string', 'x' => 'numeric', 'y' => 'numeric',
				'text' => 'string', 'fontSize' => 'numeric', 'color' => 'string',
				'width' => 'numeric', 'strokeWidth' => 'numeric', 'height' => 'numeric',
				'stroke' => 'string', 'fill' => 'string', 'radius' => 'numeric',
				'opacity' => 'numeric', 'fillOpacity' => 'numeric', 'strokeOpacity' => 'numeric',
				'blendMode' => 'string', 'id' => 'string',
				'name' => 'string', 'visible' => 'boolean', 'locked' => 'boolean',
				'textStrokeColor' => 'string', 'textStrokeWidth' => 'numeric', 'textShadowColor' => 'string',
				'shadowColor' => 'string', 'points' => 'array', 'sides' => 'numeric',
				'startAngle' => 'numeric', 'endAngle' => 'numeric', 'innerRadius' => 'numeric',
				'outerRadius' => 'numeric', 'arrowhead' => 'string',
				// Line coordinates for line and arrow layers
				'x1' => 'numeric', 'y1' => 'numeric', 'x2' => 'numeric', 'y2' => 'numeric',
				// Effects used by CanvasManager
				'shadow' => 'boolean', 'shadowBlur' => 'numeric',
				'shadowOffsetX' => 'numeric', 'shadowOffsetY' => 'numeric',
				'shadowSpread' => 'numeric',
				// Text-specific shadow toggle used by drawText
				'textShadow' => 'boolean',
				'glow' => 'boolean',
				// Blur layer property
				'blurRadius' => 'numeric',
				// Ellipse properties
				'radiusX' => 'numeric', 'radiusY' => 'numeric',
				// Arrow properties
				'arrowSize' => 'numeric', 'arrowStyle' => 'string',
				// Common editor props
				'rotation' => 'numeric', 'fontFamily' => 'string',
				// Accept editor alias for blend mode
				'blend' => 'string'
			];

			foreach ( $allowedProps as $prop => $type ) {
				if ( isset( $layer[$prop] ) ) {
					$value = $layer[$prop];
					$isValid = false;
					
					// Type validation with flexible boolean handling
					if ( $type === 'string' && is_string( $value ) ) {
						$isValid = true;
					} elseif ( $type === 'numeric' && is_numeric( $value ) ) {
						$isValid = true;
					} elseif ( $type === 'boolean' ) {
						// Accept various boolean representations from JavaScript
						if ( is_bool( $value ) || $value === 1 || $value === 0 || $value === '1' || $value === '0' || $value === 'true' || $value === 'false' ) {
							$isValid = true;
							// Normalize to proper boolean
							$value = (bool)$value;
							if ( $value === '0' || $value === 'false' ) {
								$value = false;
							}
						}
					} elseif ( $type === 'array' && is_array( $value ) ) {
						$isValid = true;
					}
					
					if ( $isValid ) {
						$cleanLayer[$prop] = $value;
					}
				}
			}

			// Normalize alias: if 'blend' provided, map to 'blendMode' if not already set (keep original too for client)
			if ( isset( $cleanLayer['blend'] ) && !isset( $cleanLayer['blendMode'] ) && is_string( $cleanLayer['blend'] ) ) {
				$cleanLayer['blendMode'] = $cleanLayer['blend'];
			}

			// Special handling for points array (path, polygon layers)
			if (
				isset( $cleanLayer['type'] ) &&
				in_array( $cleanLayer['type'], [ 'path', 'polygon' ] ) &&
				isset( $cleanLayer['points'] ) &&
				is_array( $cleanLayer['points'] )
			) {
				$cleanPoints = [];
				foreach ( $cleanLayer['points'] as $point ) {
					if ( is_array( $point ) && isset( $point['x'] ) && isset( $point['y'] ) &&
						is_numeric( $point['x'] ) && is_numeric( $point['y'] ) ) {
						$cleanPoints[] = [
							'x' => (float)$point['x'],
							'y' => (float)$point['y']
						];
					}
				}
				$cleanLayer['points'] = $cleanPoints;
			}

			// Validate color values
			foreach ( [ 'stroke', 'fill', 'color', 'textStrokeColor', 'textShadowColor', 'shadowColor' ] as $colorField ) {
				if ( isset( $cleanLayer[$colorField] ) ) {
					$cleanLayer[$colorField] = $this->sanitizeColor( $cleanLayer[$colorField] );
				}
			}
			$sanitized[] = $cleanLayer;
		}
		return $sanitized;
	}

	/**
	 * Validate filename for security
	 * @param string $filename
	 * @return bool
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
	 * Validate color values with enhanced security
	 * @param mixed $color
	 * @return bool
	 */
	private function isValidColor( $color ): bool {
		if ( !is_string( $color ) ) {
			return false;
		}

		// Prevent extremely long color strings (potential DoS)
		if ( strlen( $color ) > 50 ) {
			return false;
		}

		// Allow hex colors (3, 4, 6, 8 digits)
		if ( preg_match( '/^#[0-9a-fA-F]{3,8}$/', $color ) ) {
			return true;
		}

		// Allow rgb/rgba with strict validation
		if (
			preg_match(
				'/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/',
				$color,
				$matches
			)
		) {
			// Validate RGB values are in 0-255 range
			for ( $i = 1; $i <= 3; $i++ ) {
				if ( isset( $matches[$i] ) && ( (int)$matches[$i] < 0 || (int)$matches[$i] > 255 ) ) {
					return false;
				}
			}
			return true;
		}

		// Allow HSL/HSLA with strict validation
		if (
			preg_match(
				'/^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/',
				$color,
				$matches
			)
		) {
			// Validate HSL values
			if ( isset( $matches[1] ) && ( (int)$matches[1] < 0 || (int)$matches[1] > 360 ) ) {
				return false;
			}
			if ( isset( $matches[2] ) && ( (int)$matches[2] < 0 || (int)$matches[2] > 100 ) ) {
				return false;
			}
			if ( isset( $matches[3] ) && ( (int)$matches[3] < 0 || (int)$matches[3] > 100 ) ) {
				return false;
			}
			return true;
		}

		// Strict whitelist of named colors (prevent CSS injection)
		$safeColors = [
			'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange',
			'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime',
			'navy', 'maroon', 'olive', 'teal', 'silver', 'aqua', 'fuchsia'
		];

		return in_array( strtolower( $color ), $safeColors, true );
	}

	/**
	 * Sanitize color values
	 * @param mixed $color
	 * @return string
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
	 * @return array
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
	 * @return string
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * Check if this API module is in write mode
	 * @return bool
	 */
	public function isWriteMode() {
		return true;
	}

	/**
	 * Get example messages for this API module
	 * @return array
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
