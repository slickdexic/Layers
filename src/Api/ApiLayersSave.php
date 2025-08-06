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
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use RepoGroup;

class ApiLayersSave extends ApiBase {

	public function __construct( ApiMain $main, $action ) {
		parent::__construct( $main, $action );
	}

	public function execute() {
		// Check permissions
		$user = $this->getUser();
		if ( !$user->isAllowed( 'editlayers' ) ) {
			// Add debugging information
			$userGroups = $user->getGroups();
			$userRights = $user->getRights();
			$hasEditLayers = in_array( 'editlayers', $userRights );
			
			error_log( 'Layers Save: Permission denied for user ID: ' . $user->getId() . 
					  ', Groups: ' . implode( ',', $userGroups ) . 
					  ', Has editlayers: ' . ( $hasEditLayers ? 'yes' : 'no' ) );
			
			$this->dieWithError( 'layers-permission-denied', 'permissiondenied' );
		}

		// Rate limiting check
		$rateLimiter = new RateLimiter();
		if ( !$rateLimiter->checkRateLimit( $user, 'save' ) ) {
			$this->dieWithError( 'layers-rate-limited', 'ratelimited' );
		}

		// Get parameters
		$params = $this->extractRequestParams();
		$filename = $params['filename'];
		$layersData = json_decode( $params['data'], true );
		$setName = $params['setname'] ?? null;

		if ( $layersData === null ) {
			$this->dieWithError( 'Invalid JSON data', 'invalidjson' );
		}

		// Security: Check data size limits
		$maxBytes = $this->getConfig()->get( 'LayersMaxBytes' );
		if ( strlen( $params['data'] ) > $maxBytes ) {
			$this->dieWithError(
				[ 'layers-data-too-large', $maxBytes ],
				'toolarge'
 );
		}

		// Security: Validate filename
		if ( !$this->isValidFilename( $filename ) ) {
			$this->dieWithError( 'Invalid filename', 'invalidfilename' );
		}

		// Get file information
		$file = RepoGroup::singleton()->findFile( $filename );
		if ( !$file || !$file->exists() ) {
			$this->dieWithError( 'File not found', 'filenotfound' );
		}

		// Validate layer data structure
		if ( !$this->validateLayersData( $layersData ) ) {
			$this->dieWithError( 'Invalid layer data structure', 'invaliddata' );
		}

		// Additional security: Sanitize layer data
		$layersData = $this->sanitizeLayersData( $layersData );

		// Performance checks
		if ( !$rateLimiter->isLayerCountAllowed( count( $layersData ) ) ) {
			$this->dieWithError( 'Too many layers', 'toolayers' );
		}

		if ( !$rateLimiter->isComplexityAllowed( $layersData ) ) {
			$this->dieWithError( 'Layer set too complex', 'toocomplex' );
		}

		// Save to database
		$db = new LayersDatabase();
		$layerSetId = $db->saveLayerSet(
			$file->getName(),
			$file->getMimeType(),
			$file->getMinorMimeType(),
			$file->getSha1(),
			$layersData,
			$user->getId(),
			$setName
		);

		if ( $layerSetId === false ) {
			$this->dieWithError( 'Failed to save layer data', 'savefailed' );
		}

		// Return success response
		$this->getResult()->addValue( null, $this->getModuleName(), [
			'success' => true,
			'layersetid' => $layerSetId,
			'message' => 'Layers saved successfully'
		] );
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

			// Validate layer ID format
			if ( !is_string( $layer['id'] ) || strlen( $layer['id'] ) > 100 ) {
				return false;
			}

			// Validate layer type
			$validTypes = [ 'text', 'arrow', 'rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'highlight', 'path' ];
			if ( !in_array( $layer['type'], $validTypes ) ) {
				return false;
			}

			// Basic coordinate validation
			if ( isset( $layer['x'] ) && ( !is_numeric( $layer['x'] ) || abs( $layer['x'] ) > 50000 ) ) {
				return false;
			}
			if ( isset( $layer['y'] ) && ( !is_numeric( $layer['y'] ) || abs( $layer['y'] ) > 50000 ) ) {
				return false;
			}

			// Validate text content length for text layers
			if ( $layer['type'] === 'text' && isset( $layer['text'] ) ) {
				if ( !is_string( $layer['text'] ) || strlen( $layer['text'] ) > 1000 ) {
					return false;
				}
			}

			// Validate points array for path, polygon layers
			if ( in_array( $layer['type'], [ 'path', 'polygon' ] ) && isset( $layer['points'] ) ) {
				if ( !is_array( $layer['points'] ) || count( $layer['points'] ) > 1000 ) {
					return false;
				}
				foreach ( $layer['points'] as $point ) {
					if ( !is_array( $point ) || !isset( $point['x'] ) || !isset( $point['y'] ) ||
						 !is_numeric( $point['x'] ) || !is_numeric( $point['y'] ) ||
						 abs( $point['x'] ) > 50000 || abs( $point['y'] ) > 50000 ) {
						return false;
					}
				}
			}

			// Validate numeric properties
			$numericFields = [ 'radiusX', 'radiusY', 'innerRadius', 'outerRadius', 'sides', 'zIndex' ];
			foreach ( $numericFields as $field ) {
				if ( isset( $layer[$field] ) && ( !is_numeric( $layer[$field] ) || abs( $layer[$field] ) > 50000 ) ) {
					return false;
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
						   'innerRadius', 'outerRadius', 'sides', 'visible', 'zIndex' ];

			foreach ( $safeFields as $field ) {
				if ( isset( $layer[$field] ) ) {
					$cleanLayer[$field] = $layer[$field];
				}
			}

			// Special handling for text content
			if ( $layer['type'] === 'text' && isset( $layer['text'] ) ) {
				$cleanLayer['text'] = htmlspecialchars( $layer['text'], ENT_QUOTES, 'UTF-8' );
			}

			// Special handling for points array (path, polygon layers)
			if ( in_array( $layer['type'], [ 'path', 'polygon' ] ) && isset( $layer['points'] ) && is_array( $layer['points'] ) ) {
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

		return true;
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

		// Allow hex colors, rgb/rgba, and named colors
		if ( preg_match( '/^#[0-9a-fA-F]{3,8}$/', $color ) ) {
			return $color;
		}

		if ( preg_match( '/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/', $color ) ) {
			return $color;
		}

		// List of safe named colors
		$safeColors = [ 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange',
					   'purple', 'pink', 'gray', 'brown', 'transparent' ];

		if ( in_array( strtolower( $color ), $safeColors ) ) {
			return $color;
		}

		return '#000000'; // Default to black if invalid
	}

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

	public function needsToken() {
		return 'csrf';
	}

	public function isWriteMode() {
		return true;
	}

	public function getExamplesMessages() {
		return [
			'action=layerssave&filename=Example.jpg&data=[{"id":"1","type":"text","text":"Hello","x":100,"y":50}]&token=123ABC'
				=> 'apihelp-layerssave-example-1',
		];
	}
}
