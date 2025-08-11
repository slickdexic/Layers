<?php
/**
 * API module for saving layer data
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use ApiMain;
use Exception;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\MediaWikiServices;

class ApiLayersSave extends ApiBase {

	/**
	 * Constructor
	 * @param ApiMain $main
	 * @param string $action
	 */
	public function __construct( ApiMain $main, $action ) {
		parent::__construct( $main, $action );
	}

	/**
	 * Execute the API request
	 */
	public function execute() {
		// Check permissions
		$user = $this->getUser();
		if ( !$user->isAllowed( 'editlayers' ) ) {
			// Log and return a localized error
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				try {
					$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
					$logger->warning( 'Layers Save: Permission denied', [ 'userId' => $user->getId() ] );
				} catch ( \Throwable $e ) {
					// ignore
				}
			}
			$this->dieWithError( $this->msg( 'layers-permission-denied' ), 'permissiondenied' );
		}

		// Rate limiting check
		$rateLimiter = new RateLimiter();
		if ( !$rateLimiter->checkRateLimit( $user, 'save' ) ) {
			$this->dieWithError( $this->msg( 'layers-rate-limited' ), 'ratelimited' );
		}

		// Get parameters
		$params = $this->extractRequestParams();
		$filename = $params['filename'];
		$layersData = json_decode( $params['data'], true );
		$setName = $params['setname'] ?? null;

		if ( $layersData === null ) {
			$this->dieWithError( $this->msg( 'layers-invalid-data' ), 'invalidjson' );
		}

		// Security: Check data size limits
		$maxBytes = $this->getConfig()->get( 'LayersMaxBytes' );
		if ( strlen( $params['data'] ) > $maxBytes ) {
			$this->dieWithError(
				[ $this->msg( 'layers-data-too-large' )->plain(), $maxBytes ],
				'toolarge'
			);
		}

		// Security: Validate filename
		if ( !$this->isValidFilename( $filename ) ) {
			$this->dieWithError( $this->msg( 'layers-invalid-filename' ), 'invalidfilename' );
		}

		// Get file information
		$repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
		$file = $repoGroup->findFile( $filename );
		if ( !$file || !$file->exists() ) {
			$this->dieWithError( $this->msg( 'layers-file-not-found' ), 'filenotfound' );
		}

		// Validate layer data structure
		if ( !$this->validateLayersData( $layersData ) ) {
			$this->dieWithError( $this->msg( 'layers-invalid-data' ), 'invaliddata' );
		}

		// Additional security: Sanitize layer data
		$layersData = $this->sanitizeLayersData( $layersData );

		// Performance checks
		if ( !$rateLimiter->isLayerCountAllowed( count( $layersData ) ) ) {
			$this->dieWithError( $this->msg( 'layers-too-many-layers' ), 'toolayers' );
		}

		if ( !$rateLimiter->isComplexityAllowed( $layersData ) ) {
			$this->dieWithError( $this->msg( 'layers-too-complex' ), 'toocomplex' );
		}

		// Save to database
		$db = new LayersDatabase();

		// Split MIME type into major and minor parts
		$mimeType = (string)$file->getMimeType();
		$mimeParts = explode( '/', $mimeType, 2 );
		$majorMime = $mimeParts[0] ?? 'unknown';
		$minorMime = $mimeParts[1] ?? 'unknown';

		try {
			$layerSetId = $db->saveLayerSet(
				$file->getName(),
				$majorMime,
				$minorMime,
				$file->getSha1(),
				$layersData,
				$user->getId(),
				$setName
			);

		} catch ( Exception $e ) {
			$this->dieWithError(
				[ $this->msg( 'layers-db-error' )->plain(), $e->getMessage() ],
				'dberror'
			);
		}

		if ( $layerSetId === false ) {
			$this->dieWithError( $this->msg( 'layers-save-failed' ), 'savefailed' );
		}

		// Return success response
		$this->getResult()->addValue(
			null,
			$this->getModuleName(),
			[
				'success' => true,
				'layersetid' => $layerSetId,
				'message' => $this->msg( 'layers-save-success' )->text(),
			]
		);
	}

	/**
	 * Validate the structure of layer data
	 * @param array $layersData
	 * @return bool
	 */
	private function validateLayersData( array $layersData ): bool {
		// Basic validation - check if it's an array of layer objects
		if ( !is_array( $layersData ) ) {
			return false;
		}

		// Limit number of layers to prevent abuse
		if ( count( $layersData ) > 100 ) {
			return false;
		}

		foreach ( $layersData as $layer ) {
			if ( !is_array( $layer ) ) {
				return false;
			}

			// Each layer must have at least id and type
			if ( !isset( $layer['id'] ) || !isset( $layer['type'] ) ) {
				return false;
			}

			// Validate layer ID format - prevent code injection
			if ( !is_string( $layer['id'] ) || strlen( $layer['id'] ) > 100 ||
				 !preg_match( '/^[a-zA-Z0-9_-]+$/', $layer['id'] ) ) {
				return false;
			}

			// Validate layer type - strict whitelist
			$validTypes = [
				'text', 'arrow', 'rectangle', 'circle', 'ellipse',
				'polygon', 'star', 'line', 'highlight', 'path'
			];
			if ( !in_array( $layer['type'], $validTypes, true ) ) {
				return false;
			}

			// Basic coordinate validation with stricter bounds
			$coordinateFields = [ 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'radius', 'radiusX', 'radiusY' ];
			foreach ( $coordinateFields as $field ) {
				if ( isset( $layer[$field] ) ) {
					if ( !is_numeric( $layer[$field] ) || abs( $layer[$field] ) > 10000 ) {
						return false;
					}
				}
			}

			// Validate text content length for text layers with HTML stripping
			if ( $layer['type'] === 'text' && isset( $layer['text'] ) ) {
				if ( !is_string( $layer['text'] ) || strlen( $layer['text'] ) > 500 ) {
					return false;
				}
				// Check for potential script injection
				if ( preg_match( '/<script|javascript:|data:|vbscript:|on\w+\s*=/i', $layer['text'] ) ) {
					return false;
				}
			}

			// Validate font family - prevent injection
			if ( isset( $layer['fontFamily'] ) ) {
				if ( !is_string( $layer['fontFamily'] ) ||
					 !preg_match( '/^[a-zA-Z0-9\s,-]+$/', $layer['fontFamily'] ) ||
					 strlen( $layer['fontFamily'] ) > 100 ) {
					return false;
				}
			}

			// Validate points array for path, polygon layers with stricter limits
				if ( in_array( $layer['type'], [ 'path', 'polygon' ] ) && isset( $layer['points'] ) ) {
				if ( !is_array( $layer['points'] ) || count( $layer['points'] ) > 500 ) {
					return false;
				}
				foreach ( $layer['points'] as $point ) {
					if ( !is_array( $point ) || !isset( $point['x'] ) || !isset( $point['y'] ) ||
						 !is_numeric( $point['x'] ) || !is_numeric( $point['y'] ) ||
						 abs( $point['x'] ) > 10000 || abs( $point['y'] ) > 10000 ) {
						return false;
					}
				}
				}

			// Validate numeric properties with bounds
			$numericFields = [
				'innerRadius', 'outerRadius', 'sides', 'zIndex',
				'rotation', 'fontSize', 'strokeWidth', 'opacity'
			];
			foreach ( $numericFields as $field ) {
				if ( isset( $layer[$field] ) ) {
					if ( !is_numeric( $layer[$field] ) ) {
						return false;
					}

					// Field-specific validation
					switch ( $field ) {
						case 'sides':
							if ( $layer[$field] < 3 || $layer[$field] > 20 ) {
								return false;
							}
							break;
						case 'fontSize':
							if ( $layer[$field] < 1 || $layer[$field] > 200 ) {
								return false;
							}
							break;
						case 'strokeWidth':
							if ( $layer[$field] < 0 || $layer[$field] > 50 ) {
								return false;
							}
							break;
						case 'opacity':
							if ( $layer[$field] < 0 || $layer[$field] > 1 ) {
								return false;
							}
							break;
						default:
							if ( abs( $layer[$field] ) > 10000 ) {
								return false;
							}
					}
				}
			}

			// Validate color values strictly
			$colorFields = [ 'stroke', 'fill', 'textStrokeColor', 'textShadowColor' ];
			foreach ( $colorFields as $colorField ) {
				if ( isset( $layer[$colorField] ) ) {
					if ( !$this->isValidColor( $layer[$colorField] ) ) {
						return false;
					}
				}
			}
		}

		return true;
	}

	/**
	 * Sanitize layer data to prevent XSS
	 * @param array $layersData
	 * @return array
	 */
	private function sanitizeLayersData( array $layersData ): array {
		$sanitized = [];

		foreach ( $layersData as $layer ) {
			$cleanLayer = [];

			// Copy safe fields
			$safeFields = [ 'id', 'type', 'x', 'y', 'width', 'height', 'radius',
					   'x1', 'y1', 'x2', 'y2', 'stroke', 'fill', 'strokeWidth',
					   'fontSize', 'fontFamily', 'opacity', 'points', 'radiusX', 'radiusY',
					   'innerRadius', 'outerRadius', 'sides', 'visible', 'zIndex', 'rotation' ];

			foreach ( $safeFields as $field ) {
				if ( isset( $layer[$field] ) ) {
					$cleanLayer[$field] = $layer[$field];
				}
			}

		// Special handling for text content: ensure string and limit length
		if ( $layer['type'] === 'text' && isset( $layer['text'] ) ) {
			$cleanText = is_string( $layer['text'] ) ? $layer['text'] : (string)$layer['text'];
			// Strip control characters and potential HTML/script tags
			$cleanText = preg_replace( '/[\x00-\x1F\x7F]/u', '', $cleanText );
			$cleanText = htmlspecialchars( $cleanText, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			// Remove any potential script tags or event handlers
			$cleanText = preg_replace( '/<script[^>]*>.*?<\/script>/si', '', $cleanText );
			$cleanText = preg_replace( '/on\w+\s*=\s*["\'][^"\']*["\']/i', '', $cleanText );
			// Enforce max length
			if ( strlen( $cleanText ) > 1000 ) {
				$cleanText = substr( $cleanText, 0, 1000 );
			}
			$cleanLayer['text'] = $cleanText;
		}

		// Special handling for points array (path, polygon layers)
		if (
				in_array( $layer['type'], [ 'path', 'polygon' ] )
				&& isset( $layer['points'] )
				&& is_array( $layer['points'] )
			) {
				$cleanPoints = [];
				foreach ( $layer['points'] as $point ) {
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
			foreach ( [ 'stroke', 'fill' ] as $colorField ) {
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
