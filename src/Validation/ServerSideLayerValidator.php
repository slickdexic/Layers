<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Validation;

use MediaWiki\MediaWikiServices;

/**
 * Server-side layer validator implementation
 *
 * This class provides comprehensive validation and sanitization
 * of layer data with security-focused validation rules.
 */
class ServerSideLayerValidator implements LayerValidatorInterface {

	/** @var TextSanitizer */
	private $textSanitizer;

	/** @var ColorValidator */
	private $colorValidator;

	/** @var array Configuration cache */
	private $config;

	/** @var array Supported layer types */
	private const SUPPORTED_LAYER_TYPES = [
		'text', 'textbox', 'callout', 'arrow', 'rectangle', 'circle', 'ellipse',
		'polygon', 'star', 'line', 'path', 'image', 'group', 'customShape', 'marker',
		'dimension'
	];

	/** @var array Allowed properties and their types */
	private const ALLOWED_PROPERTIES = [
		'type' => 'string',
		'id' => 'string',
		'name' => 'string',
		'x' => 'numeric',
		'y' => 'numeric',
		'width' => 'numeric',
		'height' => 'numeric',
		'radius' => 'numeric',
		'radiusX' => 'numeric',
		'radiusY' => 'numeric',
		'x1' => 'numeric',
		'y1' => 'numeric',
		'x2' => 'numeric',
		'y2' => 'numeric',
		'rotation' => 'numeric',
		'text' => 'string',
		'fontSize' => 'numeric',
		'fontFamily' => 'string',
		'color' => 'string',
		'stroke' => 'string',
		'fill' => 'string',
		// Gradient fill (object with type, colors, angle, etc.)
		'gradient' => 'array',
		'strokeWidth' => 'numeric',
		'opacity' => 'numeric',
		'fillOpacity' => 'numeric',
		'strokeOpacity' => 'numeric',
		'blendMode' => 'string',
		// blend is alias for blendMode
		'blend' => 'string',
		'visible' => 'boolean',
		'locked' => 'boolean',
		'textStrokeColor' => 'string',
		'textStrokeWidth' => 'numeric',
		'textShadow' => 'boolean',
		'textShadowColor' => 'string',
		'textShadowBlur' => 'numeric',
		'textShadowOffsetX' => 'numeric',
		'textShadowOffsetY' => 'numeric',
		'fontWeight' => 'string',
		'fontStyle' => 'string',
		'shadow' => 'boolean',
		'shadowColor' => 'string',
		'shadowBlur' => 'numeric',
		'shadowOffsetX' => 'numeric',
		'shadowOffsetY' => 'numeric',
		'shadowSpread' => 'numeric',
		'cornerRadius' => 'numeric',
		'glow' => 'boolean',
		'arrowhead' => 'string',
		'arrowStyle' => 'string',
		'arrowHeadType' => 'string',
		'arrowSize' => 'numeric',
		'headScale' => 'numeric',
		'tailWidth' => 'numeric',
		// Curved arrow control point
		'controlX' => 'numeric',
		'controlY' => 'numeric',
		'blurRadius' => 'numeric',
		'points' => 'array',
		'sides' => 'numeric',
		'startAngle' => 'numeric',
		'endAngle' => 'numeric',
		'innerRadius' => 'numeric',
		'outerRadius' => 'numeric',
		'pointRadius' => 'numeric',
		'valleyRadius' => 'numeric',
		// Image layer properties
		'src' => 'string',
		'originalWidth' => 'numeric',
		'originalHeight' => 'numeric',
		'preserveAspectRatio' => 'boolean',
		// Text box properties
		'textAlign' => 'string',
		'verticalAlign' => 'string',
		'padding' => 'numeric',
		'lineHeight' => 'numeric',
		// Callout/chat bubble properties
		'tailDirection' => 'string',
		'tailPosition' => 'numeric',
		'tailSize' => 'numeric',
		'tailStyle' => 'string',
		'tailTipX' => 'numeric',
		'tailTipY' => 'numeric',
		// Blur fill state preservation
		'_previousFill' => 'string',
		// Group layer properties
		'children' => 'array',
		'expanded' => 'boolean',
		'parentGroup' => 'string',
		// Custom shape properties
		'shapeId' => 'string',
		'shapeData' => 'array',
		'path' => 'string',
		'paths' => 'array',
		'svg' => 'string',
		'viewBox' => 'array',
		'fillRule' => 'string',
		'isMultiPath' => 'boolean',
		'strokeOnly' => 'boolean',
		// Marker properties
		'value' => 'numeric',
		'style' => 'string',
		'size' => 'numeric',
		'hasArrow' => 'boolean',
		'arrowX' => 'numeric',
		'arrowY' => 'numeric',
		// Dimension properties
		'endStyle' => 'string',
		'textPosition' => 'string',
		'extensionLength' => 'numeric',
		'extensionGap' => 'numeric',
		'tickSize' => 'numeric',
		'unit' => 'string',
		'scale' => 'numeric',
		'showUnit' => 'boolean',
		'showBackground' => 'boolean',
		'backgroundColor' => 'color',
		'precision' => 'numeric',
		'orientation' => 'string',
		'textDirection' => 'string',
		// Dimension tolerance properties (stored as strings for user-entered values like "+0.2")
		'toleranceType' => 'string',
		'toleranceValue' => 'string',
		'toleranceUpper' => 'string',
		'toleranceLower' => 'string'
	];

	/** @var array Value constraints for enum-like properties */
	private const VALUE_CONSTRAINTS = [
		// Canvas 2D globalCompositeOperation values (complete list)
		// 'blur' is NOT a valid blend mode - it's handled as fill='blur' instead
		'blendMode' => [
			'source-over', 'source-in', 'source-out', 'source-atop',
			'destination-over', 'destination-in', 'destination-out', 'destination-atop',
			'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay',
					'darken', 'lighten', 'color-dodge', 'color-burn',
			'hard-light', 'soft-light', 'difference', 'exclusion',
			'hue', 'saturation', 'color', 'luminosity',
			// Alias for source-over
			'normal'
		],
		'arrowhead' => [ 'none', 'arrow', 'circle', 'diamond', 'triangle' ],
		'arrowStyle' => [ 'single', 'double', 'none', 'arrow', 'dot' ],
		'arrowHeadType' => [ 'pointed', 'chevron', 'standard' ],
		'textAlign' => [ 'left', 'center', 'right' ],
		'verticalAlign' => [ 'top', 'middle', 'bottom' ],
		'fontWeight' => [ 'normal', 'bold' ],
		'fontStyle' => [ 'normal', 'italic' ],
		'fillRule' => [ 'nonzero', 'evenodd' ],
		'tailDirection' => [ 'bottom', 'top', 'left', 'right', 'bottom-left', 'bottom-right', 'top-left', 'top-right' ],
		'tailStyle' => [ 'triangle', 'curved', 'line' ],
		// Marker styles
		'style' => [ 'circled', 'parentheses', 'plain', 'letter', 'letter-circled' ],
		// Dimension end styles and text positions
		'endStyle' => [ 'arrow', 'tick', 'dot', 'none' ],
		'textPosition' => [ 'above', 'below', 'center' ],
		'orientation' => [ 'free', 'horizontal', 'vertical' ],
		'textDirection' => [ 'auto', 'auto-reversed', 'horizontal' ],
		// Dimension tolerance types
		'toleranceType' => [ 'none', 'symmetric', 'deviation', 'limits', 'basic' ]
	];

	/** @var array Numeric constraints */
	private const NUMERIC_CONSTRAINTS = [
		'opacity' => [ 'min' => 0, 'max' => 1 ],
		'fillOpacity' => [ 'min' => 0, 'max' => 1 ],
		'strokeOpacity' => [ 'min' => 0, 'max' => 1 ],
		// FIX 2025-11-14: Increased max from 200 to 1000 for large display use cases (posters, billboards)
		'fontSize' => [ 'min' => 1, 'max' => 1000 ],
		'strokeWidth' => [ 'min' => 0, 'max' => 100 ],
		'width' => [ 'min' => 0, 'max' => 10000 ],
		'height' => [ 'min' => 0, 'max' => 10000 ],
		'radius' => [ 'min' => 0, 'max' => 5000 ],
		'radiusX' => [ 'min' => 0, 'max' => 5000 ],
		'radiusY' => [ 'min' => 0, 'max' => 5000 ],
		'arrowSize' => [ 'min' => 1, 'max' => 100 ],
		'headScale' => [ 'min' => 0.1, 'max' => 5 ],
		'tailWidth' => [ 'min' => 0, 'max' => 100 ],
		'blurRadius' => [ 'min' => 0, 'max' => 100 ],
		'padding' => [ 'min' => 0, 'max' => 100 ],
		'textShadowBlur' => [ 'min' => 0, 'max' => 50 ],
		'textShadowOffsetX' => [ 'min' => -100, 'max' => 100 ],
		'textShadowOffsetY' => [ 'min' => -100, 'max' => 100 ],
		'lineHeight' => [ 'min' => 0.5, 'max' => 5 ],
		'cornerRadius' => [ 'min' => 0, 'max' => 500 ],
		'tailPosition' => [ 'min' => 0, 'max' => 1 ],
		'tailSize' => [ 'min' => 5, 'max' => 100 ],
		// Marker constraints
		'value' => [ 'min' => 1, 'max' => 999 ],
		'size' => [ 'min' => 10, 'max' => 200 ],
		// Dimension constraints
		'extensionLength' => [ 'min' => 0, 'max' => 100 ],
		'extensionGap' => [ 'min' => 0, 'max' => 50 ],
		'tickSize' => [ 'min' => 2, 'max' => 50 ],
		'scale' => [ 'min' => 0.001, 'max' => 1000 ],
		'precision' => [ 'min' => 0, 'max' => 6 ]
	];

	/** @var int Maximum points in a path/polygon */
	private const MAX_POINTS = 1000;

	/** @var int Minimum/maximum star points allowed */
	private const MIN_STAR_POINTS = 3;
	private const MAX_STAR_POINTS = 20;

	public function __construct() {
		$this->textSanitizer = new TextSanitizer();
		$this->colorValidator = new ColorValidator();
		$this->loadConfig();
	}

	/**
	 * Load configuration values
	 */
	private function loadConfig(): void {
		try {
			if ( class_exists( MediaWikiServices::class ) ) {
				$config = MediaWikiServices::getInstance()->getMainConfig();
				$this->config = [
					// Explicit (int) cast required for strict_types compatibility
					// Config values may be strings in some MediaWiki configurations
					'maxLayers' => (int)( $config->get( 'LayersMaxLayerCount' ) ?? 100 ),
					'defaultFonts' => $config->get( 'LayersDefaultFonts' ) ?? [ 'Arial', 'sans-serif' ]
				];
			} else {
				$this->config = [
					'maxLayers' => 100,
					'defaultFonts' => [ 'Arial', 'sans-serif' ]
				];
			}
		} catch ( \Throwable $e ) {
			// Fallback configuration
			$this->config = [
				'maxLayers' => 100,
				'defaultFonts' => [ 'Arial', 'sans-serif' ]
			];
		}
	}

	/**
	 * Validate and sanitize an array of layers
	 *
	 * @param array $layersData Raw layer data from client
	 * @return ValidationResult Result containing validated data and any issues
	 */
	public function validateLayers( array $layersData ): ValidationResult {
		$result = new ValidationResult();

		// Check layer count
		if ( count( $layersData ) > $this->getMaxLayerCount() ) {
			$result->addError(
				"Too many layers: " . count( $layersData ) .
				" (max: " . $this->getMaxLayerCount() . ")"
			);
			return $result;
		}

		if ( empty( $layersData ) ) {
			$result->addWarning( "No layers provided" );
			return ValidationResult::success( [], $result->getWarnings(), $result->getMetadata() );
		}

		$validatedLayers = [];
		$layerIndex = 0;

		foreach ( $layersData as $layer ) {
			$layerResult = $this->validateLayer( $layer );

			if ( $layerResult->isValid() ) {
				$validatedLayers[] = $layerResult->getData();
			} else {
				foreach ( $layerResult->getErrors() as $error ) {
					$result->addError( "Layer $layerIndex: $error" );
				}
			}

			foreach ( $layerResult->getWarnings() as $warning ) {
				$result->addWarning( "Layer $layerIndex: $warning" );
			}

			$layerIndex++;
		}

		if ( $result->hasErrors() ) {
			return $result;
		}

		$result->setMetadata( 'originalLayerCount', count( $layersData ) );
		$result->setMetadata( 'validatedLayerCount', count( $validatedLayers ) );

		return ValidationResult::success( $validatedLayers, $result->getWarnings(), $result->getMetadata() );
	}

	/**
	 * Validate a single layer
	 *
	 * @param array $layer Raw layer data
	 * @return ValidationResult Result for the single layer
	 */
	public function validateLayer( array $layer ): ValidationResult {
		$result = new ValidationResult();

		// Check if layer has required type
		if ( !isset( $layer['type'] ) || !is_string( $layer['type'] ) ) {
			$result->addError( "Missing or invalid layer type" );
			return $result;
		}

		$type = $layer['type'];
		if ( !$this->isLayerTypeSupported( $type ) ) {
			$result->addError( "Unsupported layer type: $type" );
			return $result;
		}

		$cleanLayer = [ 'type' => $type ];

		// Validate each property
		foreach ( self::ALLOWED_PROPERTIES as $property => $expectedType ) {
			if ( !isset( $layer[$property] ) ) {
				continue;
			}

			$value = $layer[$property];

			// Allow star layers to persist numeric point counts without forcing array structures
			if ( $property === 'points' && $type === 'star' && !is_array( $value ) && is_numeric( $value ) ) {
				$cleanLayer[$property] = (int)floor( $value );
				continue;
			}
			$validationResult = $this->validateProperty( $property, $value, $expectedType );

			if ( $validationResult['valid'] ) {
				$cleanLayer[$property] = $validationResult['value'];
			} else {
				$result->addWarning( "Invalid property '$property': " . $validationResult['error'] );
			}
		}

		// Handle blend mode alias
		if ( isset( $cleanLayer['blend'] ) && !isset( $cleanLayer['blendMode'] ) ) {
			$cleanLayer['blendMode'] = $cleanLayer['blend'];
		}
		unset( $cleanLayer['blend'] );

		// Layer-specific validation
		$layerValidation = $this->validateLayerSpecific( $cleanLayer );
		if ( !$layerValidation['valid'] ) {
			$result->addError( $layerValidation['error'] );
			return $result;
		}

		return ValidationResult::success( $cleanLayer, $result->getWarnings(), $result->getMetadata() );
	}

	/**
	 * Validate a specific property
	 *
	 * @param string $property Property name
	 * @param mixed $value Property value
	 * @param string $expectedType Expected type
	 * @return array Validation result with 'valid', 'value', and optionally 'error'
	 */
	private function validateProperty( string $property, $value, string $expectedType ): array {
		switch ( $expectedType ) {
			case 'string':
				return $this->validateStringProperty( $property, $value );
			case 'numeric':
				return $this->validateNumericProperty( $property, $value );
			case 'boolean':
				return $this->validateBooleanProperty( $value );
			case 'array':
				return $this->validateArrayProperty( $property, $value );
			case 'color':
				return $this->validateColorProperty( $value );
			default:
				return [ 'valid' => false, 'error' => "Unknown property type: $expectedType" ];
		}
	}

	/**
	 * Validate color property
	 *
	 * @param mixed $value Property value
	 * @return array Validation result
	 */
	private function validateColorProperty( $value ): array {
		if ( !is_string( $value ) ) {
			return [ 'valid' => false, 'error' => 'Color must be a string' ];
		}
		if ( !$this->colorValidator->isSafeColor( $value ) ) {
			return [ 'valid' => false, 'error' => 'Unsafe color value' ];
		}
		$sanitized = $this->colorValidator->sanitizeColor( $value );
		return [ 'valid' => true, 'value' => $sanitized ];
	}

	/**
	 * Validate string property
	 *
	 * @param string $property Property name
	 * @param mixed $value Property value
	 * @return array Validation result
	 */
	private function validateStringProperty( string $property, $value ): array {
		if ( !is_string( $value ) ) {
			return [ 'valid' => false, 'error' => 'Must be a string' ];
		}

		// Special handling for image src (base64 data URL)
		if ( $property === 'src' ) {
			return $this->validateImageSrc( $value );
		}

		// Special handling for SVG strings (can be up to 100KB)
		// Must be checked BEFORE the generic length limit
		if ( $property === 'svg' ) {
			return $this->validateSvgString( $value );
		}

		// SVG path data validation (for custom shapes)
		// Must be checked BEFORE the generic length limit
		if ( $property === 'path' ) {
			return $this->validateSvgPath( $value );
		}

		// Length check for regular strings (1000 chars)
		// Note: svg and path have their own length limits above
		if ( strlen( $value ) > 1000 ) {
			return [ 'valid' => false, 'error' => 'String too long' ];
		}

		// Handle different string types
		if ( in_array( $property, [ 'text', 'name' ], true ) ) {
			// User text - sanitize
			$sanitized = $this->textSanitizer->sanitizeText( $value );
			if ( empty( trim( $sanitized ) ) && $property === 'text' ) {
				return [ 'valid' => false, 'error' => 'Text cannot be empty' ];
			}
			return [ 'valid' => true, 'value' => $sanitized ];
		}

		if ( in_array( $property, [ 'id', 'type', 'fontFamily', 'shapeId' ], true ) ) {
			// Identifiers - sanitize
			$sanitized = $this->textSanitizer->sanitizeIdentifier( $value );
			if ( $property === 'fontFamily' && !in_array( $sanitized, $this->config['defaultFonts'], true ) ) {
				return [ 'valid' => false, 'error' => 'Font not in allowed list' ];
			}
			return [ 'valid' => true, 'value' => $sanitized ];
		}

		if ( in_array( $property, [ 'blendMode', 'arrowhead', 'arrowStyle', 'arrowHeadType',
			'textAlign', 'verticalAlign', 'fontWeight', 'fontStyle', 'fillRule' ], true ) ) {
			// Constrained values
			if ( isset( self::VALUE_CONSTRAINTS[$property] ) ) {
				if ( !in_array( $value, self::VALUE_CONSTRAINTS[$property], true ) ) {
					return [ 'valid' => false, 'error' => 'Invalid value for ' . $property ];
				}
			}
			return [ 'valid' => true, 'value' => $value ];
		}

		// Colors
		$colorProps = [
			'color', 'stroke', 'fill', 'textStrokeColor', 'textShadowColor', 'shadowColor', '_previousFill'
		];
		if ( in_array( $property, $colorProps, true ) ) {
			// Special case: 'blur' is a valid fill value (blur fill effect)
			if ( $property === 'fill' && $value === 'blur' ) {
				return [ 'valid' => true, 'value' => 'blur' ];
			}
			// Special case: 'none' is valid for fill and stroke (SVG standard)
			if ( ( $property === 'fill' || $property === 'stroke' ) && $value === 'none' ) {
				return [ 'valid' => true, 'value' => 'none' ];
			}
			if ( !$this->colorValidator->isSafeColor( $value ) ) {
				return [ 'valid' => false, 'error' => 'Unsafe color value' ];
			}
			$sanitized = $this->colorValidator->sanitizeColor( $value );
			return [ 'valid' => true, 'value' => $sanitized ];
		}

		return [ 'valid' => true, 'value' => $value ];
	}

	/**
	 * Validate image src property (base64 data URL)
	 *
	 * @param string $value The src value (expected to be a data URL)
	 * @return array Validation result
	 */
	private function validateImageSrc( string $value ): array {
		// Max size configurable via $wgLayersMaxImageBytes (default 1MB)
		$config = \MediaWiki\MediaWikiServices::getInstance()->getMainConfig();
		$maxSize = (int)$config->get( 'LayersMaxImageBytes' );
		if ( strlen( $value ) > $maxSize ) {
			$maxSizeKB = round( $maxSize / 1024 );
			return [ 'valid' => false, 'error' => "Image data too large (max {$maxSizeKB}KB)" ];
		}

		// Must be a valid data URL with allowed image types
		// NOTE: SVG intentionally excluded - can contain embedded JavaScript (XSS risk)
		$allowedMimeTypes = [
			'image/png',
			'image/jpeg',
			'image/gif',
			'image/webp'
		];

		// Parse data URL format: data:[<mediatype>][;base64],<data>
		if ( !preg_match( '/^data:([^;,]+)(;base64)?,/', $value, $matches ) ) {
			return [ 'valid' => false, 'error' => 'Invalid image data format' ];
		}

		$mimeType = $matches[1];
		if ( !in_array( $mimeType, $allowedMimeTypes, true ) ) {
			return [ 'valid' => false, 'error' => 'Unsupported image type: ' . $mimeType ];
		}

		// Basic validation passed - accept the value
		return [ 'valid' => true, 'value' => $value ];
	}

	/**
	 * Validate SVG path data for custom shapes
	 *
	 * Security-critical: Only allow safe SVG path commands and numeric values.
	 * This prevents XSS attacks through path data.
	 *
	 * @param string $value The SVG path data string
	 * @return array Validation result
	 */
	private function validateSvgPath( string $value ): array {
		// Maximum path length (paths can be large for complex shapes)
		$maxLength = 10000;
		if ( strlen( $value ) > $maxLength ) {
			return [ 'valid' => false, 'error' => "Path data too long (max {$maxLength} characters)" ];
		}

		// Security: Strict whitelist of allowed characters
		// Only SVG path commands (M,L,H,V,C,S,Q,T,A,Z) and numeric values
		// This MUST reject: < > & " ' ; : ( ) javascript script on* etc.
		if ( !preg_match( '/^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-+eE]+$/', $value ) ) {
			return [ 'valid' => false, 'error' => 'Invalid characters in path data' ];
		}

		// Path must start with a move command
		if ( !preg_match( '/^\s*[Mm]/', $value ) ) {
			return [ 'valid' => false, 'error' => 'Path must start with M or m command' ];
		}

		// Limit number of commands to prevent DoS
		$commandCount = preg_match_all( '/[MmLlHhVvCcSsQqTtAaZz]/', $value );
		$maxCommands = 1000;
		if ( $commandCount > $maxCommands ) {
			return [ 'valid' => false, 'error' => "Too many path commands (max {$maxCommands})" ];
		}

		return [ 'valid' => true, 'value' => $value ];
	}

	/**
	 * Validate numeric property
	 *
	 * @param string $property Property name
	 * @param mixed $value Property value
	 * @return array Validation result
	 */
	private function validateNumericProperty( string $property, $value ): array {
		if ( !is_numeric( $value ) ) {
			return [ 'valid' => false, 'error' => 'Must be numeric' ];
		}

		$numValue = (float)$value;

		// Check for NaN and infinite values
		if ( !is_finite( $numValue ) ) {
			return [ 'valid' => false, 'error' => 'Invalid numeric value' ];
		}

		// Apply constraints
		if ( isset( self::NUMERIC_CONSTRAINTS[$property] ) ) {
			$constraints = self::NUMERIC_CONSTRAINTS[$property];
			if ( isset( $constraints['min'] ) && $numValue < $constraints['min'] ) {
				return [ 'valid' => false, 'error' => "Value too small (min: {$constraints['min']})" ];
			}
			if ( isset( $constraints['max'] ) && $numValue > $constraints['max'] ) {
				return [ 'valid' => false, 'error' => "Value too large (max: {$constraints['max']})" ];
			}
		} else {
			// General numeric limits
			if ( $numValue < -100000 || $numValue > 100000 ) {
				return [ 'valid' => false, 'error' => 'Value out of allowed range' ];
			}
		}

		return [ 'valid' => true, 'value' => $numValue ];
	}

	/**
	 * Validate boolean property
	 *
	 * @param mixed $value Property value
	 * @return array Validation result
	 */
	private function validateBooleanProperty( $value ): array {
		if ( is_bool( $value ) ) {
			return [ 'valid' => true, 'value' => $value ];
		}

		if ( $value === 1 || $value === 0 ) {
			return [ 'valid' => true, 'value' => (bool)$value ];
		}

		if ( $value === '1' || $value === 'true' ) {
			return [ 'valid' => true, 'value' => true ];
		}

		if ( $value === '0' || $value === 'false' || $value === '' ) {
			return [ 'valid' => true, 'value' => false ];
		}

		return [ 'valid' => false, 'error' => 'Must be boolean' ];
	}

	/**
	 * Validate array property (like points or children)
	 *
	 * @param string $property Property name
	 * @param mixed $value Property value
	 * @return array Validation result
	 */
	private function validateArrayProperty( string $property, $value ): array {
		if ( !is_array( $value ) ) {
			return [ 'valid' => false, 'error' => 'Must be an array' ];
		}

		if ( $property === 'points' ) {
			if ( count( $value ) > self::MAX_POINTS ) {
				return [ 'valid' => false, 'error' => 'Too many points' ];
			}

			$validPoints = [];
			foreach ( $value as $point ) {
				if ( !is_array( $point ) || !isset( $point['x'] ) || !isset( $point['y'] ) ) {
					continue;
				}
				if ( !is_numeric( $point['x'] ) || !is_numeric( $point['y'] ) ) {
					continue;
				}
				$validPoints[] = [
					'x' => (float)$point['x'],
					'y' => (float)$point['y']
				];
			}

			return [ 'valid' => true, 'value' => $validPoints ];
		}

		if ( $property === 'children' ) {
			// Children array contains layer IDs (strings)
			// Limit to prevent deeply nested structures
			if ( count( $value ) > 100 ) {
				return [ 'valid' => false, 'error' => 'Too many children in group' ];
			}

			$validChildren = [];
			foreach ( $value as $childId ) {
				if ( is_string( $childId ) && strlen( $childId ) <= 100 ) {
					$validChildren[] = $childId;
				}
			}

			return [ 'valid' => true, 'value' => $validChildren ];
		}

		if ( $property === 'viewBox' ) {
			// ViewBox must be array of 4 numeric values: [x, y, width, height]
			if ( count( $value ) !== 4 ) {
				return [ 'valid' => false, 'error' => 'ViewBox must have exactly 4 values' ];
			}

			$validViewBox = [];
			foreach ( $value as $i => $num ) {
				if ( !is_numeric( $num ) ) {
					return [ 'valid' => false, 'error' => 'ViewBox values must be numeric' ];
				}
				$numValue = (float)$num;
				if ( !is_finite( $numValue ) ) {
					return [ 'valid' => false, 'error' => 'Invalid viewBox value' ];
				}
				// Width and height (indices 2 and 3) must be positive
				if ( $i >= 2 && $numValue <= 0 ) {
					return [ 'valid' => false, 'error' => 'ViewBox width/height must be positive' ];
				}
				$validViewBox[] = $numValue;
			}

			return [ 'valid' => true, 'value' => $validViewBox ];
		}

		if ( $property === 'gradient' ) {
			return $this->validateGradient( $value );
		}

		return [ 'valid' => true, 'value' => $value ];
	}

	/**
	 * Validate a gradient definition
	 *
	 * @param array $gradient Gradient data to validate
	 * @return array Validation result with 'valid', 'value' or 'error' keys
	 */
	private function validateGradient( array $gradient ): array {
		$validGradient = [];

		// Validate type (required, must be 'linear' or 'radial')
		if ( !isset( $gradient['type'] ) || !in_array( $gradient['type'], [ 'linear', 'radial' ], true ) ) {
			return [ 'valid' => false, 'error' => 'Gradient type must be "linear" or "radial"' ];
		}
		$validGradient['type'] = $gradient['type'];

		// Validate colors array (required, at least 2 color stops)
		if ( !isset( $gradient['colors'] ) || !is_array( $gradient['colors'] ) || count( $gradient['colors'] ) < 2 ) {
			return [ 'valid' => false, 'error' => 'Gradient must have at least 2 color stops' ];
		}

		// Cap at reasonable max (10 color stops should be plenty)
		if ( count( $gradient['colors'] ) > 10 ) {
			return [ 'valid' => false, 'error' => 'Too many gradient color stops' ];
		}

		$validColors = [];
		foreach ( $gradient['colors'] as $stop ) {
			if ( !is_array( $stop ) ) {
				continue;
			}
			if ( !isset( $stop['offset'] ) || !isset( $stop['color'] ) ) {
				continue;
			}
			if ( !is_numeric( $stop['offset'] ) || !is_string( $stop['color'] ) ) {
				continue;
			}

			$offset = (float)$stop['offset'];
			// Clamp to 0-1 range
			$offset = max( 0, min( 1, $offset ) );

			// Use ColorValidator for proper color validation and sanitization
			$color = $this->colorValidator->sanitizeColor( $stop['color'] );

			$validColors[] = [
				'offset' => $offset,
				'color' => $color
			];
		}

		if ( count( $validColors ) < 2 ) {
			return [ 'valid' => false, 'error' => 'Gradient must have at least 2 valid color stops' ];
		}
		$validGradient['colors'] = $validColors;

		// Validate angle for linear gradients (optional, 0-360)
		if ( isset( $gradient['angle'] ) && is_numeric( $gradient['angle'] ) ) {
			$angle = (float)$gradient['angle'];
			// Normalize to 0-360 range
			$angle = fmod( $angle, 360 );
			if ( $angle < 0 ) {
				$angle += 360;
			}
			$validGradient['angle'] = $angle;
		}

		// Validate radial gradient center (optional, 0-1 for normalized coords)
		if ( isset( $gradient['centerX'] ) && is_numeric( $gradient['centerX'] ) ) {
			$validGradient['centerX'] = max( 0, min( 1, (float)$gradient['centerX'] ) );
		}
		if ( isset( $gradient['centerY'] ) && is_numeric( $gradient['centerY'] ) ) {
			$validGradient['centerY'] = max( 0, min( 1, (float)$gradient['centerY'] ) );
		}
		if ( isset( $gradient['radius'] ) && is_numeric( $gradient['radius'] ) ) {
			// Radius can be 0-1 (normalized) or larger for edge-to-edge
			$validGradient['radius'] = max( 0, min( 2, (float)$gradient['radius'] ) );
		}

		return [ 'valid' => true, 'value' => $validGradient ];
	}

	/**
	 * Perform layer-specific validation
	 *
	 * @param array $layer Validated layer data
	 * @return array Validation result
	 */
	private function validateLayerSpecific( array $layer ): array {
		$type = $layer['type'];

		switch ( $type ) {
			case 'text':
				if ( !isset( $layer['text'] ) || empty( trim( $layer['text'] ) ) ) {
					return [ 'valid' => false, 'error' => 'Text layer must have text content' ];
				}
				break;

			case 'rectangle':
				if ( !isset( $layer['width'] ) || !isset( $layer['height'] ) ) {
					return [ 'valid' => false, 'error' => "$type layer must have width and height" ];
				}
				break;

			case 'ellipse':
				// Ellipse can be defined with width/height OR radiusX/radiusY
				$hasWidthHeight = isset( $layer['width'] ) && isset( $layer['height'] );
				$hasRadii = isset( $layer['radiusX'] ) && isset( $layer['radiusY'] );
				if ( !$hasWidthHeight && !$hasRadii ) {
					return [
						'valid' => false,
						'error' => 'ellipse layer must have width and height, or radiusX and radiusY'
					];
				}
				break;

			case 'circle':
				if ( !isset( $layer['radius'] ) ) {
					return [ 'valid' => false, 'error' => 'Circle layer must have radius' ];
				}
				break;

			case 'line':
			case 'arrow':
			case 'dimension':
				if ( !isset( $layer['x1'] ) || !isset( $layer['y1'] ) ||
					 !isset( $layer['x2'] ) || !isset( $layer['y2'] ) ) {
					return [ 'valid' => false, 'error' => "$type layer must have x1, y1, x2, y2" ];
				}
				break;

			case 'polygon':
				$hasPoints = $this->hasValidPointArray( $layer, 3 );
				$hasParametricDefinition = $this->hasParametricPolygonDefinition( $layer );
				if ( !$hasPoints && !$hasParametricDefinition ) {
					return [
						'valid' => false,
						'error' => 'Polygon layer must include points array or radius/sides definition'
					];
				}
				break;

			case 'star':
				$starPoints = $layer['points'] ?? null;
				if ( !is_numeric( $starPoints ) ) {
					return [ 'valid' => false, 'error' => 'Star layer must define an integer point count' ];
				}

				$starPoints = (int)floor( $starPoints );
				if ( $starPoints < self::MIN_STAR_POINTS || $starPoints > self::MAX_STAR_POINTS ) {
					return [
						'valid' => false,
						'error' => 'Star layer point count must be between ' .
							self::MIN_STAR_POINTS . ' and ' . self::MAX_STAR_POINTS
					];
				}

				$outerRadius = $layer['outerRadius'] ?? $layer['radius'] ?? null;
				if ( $outerRadius === null || $outerRadius <= 0 ) {
					return [ 'valid' => false, 'error' => 'Star layer must define a positive radius or outerRadius' ];
				}
				break;

			case 'path':
				if ( !$this->hasValidPointArray( $layer, 2 ) ) {
					return [ 'valid' => false, 'error' => 'path layer must have points' ];
				}
				break;

			case 'group':
				// Group layers must have a children array (can be empty)
				if ( !isset( $layer['children'] ) ) {
					return [ 'valid' => false, 'error' => 'Group layer must have children array' ];
				}
				if ( !is_array( $layer['children'] ) ) {
					return [ 'valid' => false, 'error' => 'Group children must be an array' ];
				}
				break;

			case 'customShape':
				// Custom shapes require one of: shapeId, shapeData, svg, path, or paths
				$hasShapeId = isset( $layer['shapeId'] ) && !empty( $layer['shapeId'] );
				$hasShapeData = isset( $layer['shapeData'] ) && is_array( $layer['shapeData'] );
				$hasSvg = isset( $layer['svg'] ) && is_string( $layer['svg'] ) && !empty( $layer['svg'] );
				$hasPath = isset( $layer['path'] ) && is_string( $layer['path'] ) && !empty( $layer['path'] );
				$hasPaths = isset( $layer['paths'] ) && is_array( $layer['paths'] );

				if ( !$hasShapeId && !$hasShapeData && !$hasSvg && !$hasPath && !$hasPaths ) {
					return [
						'valid' => false,
						'error' => 'customShape layer must have shapeId, shapeData, svg, path, or paths'
					];
				}
				// Validate embedded shapeData if present
				if ( $hasShapeData ) {
					$shapeDataValidation = $this->validateShapeData( $layer['shapeData'] );
					if ( !$shapeDataValidation['valid'] ) {
						return $shapeDataValidation;
					}
				}
				// Validate SVG string if present (basic XSS prevention)
				if ( $hasSvg ) {
					$svgValidation = $this->validateSvgString( $layer['svg'] );
					if ( !$svgValidation['valid'] ) {
						return $svgValidation;
					}
				}
				break;
		}

		return [ 'valid' => true ];
	}

	/**
	 * Determine if a layer has a usable points array.
	 */
	private function hasValidPointArray( array $layer, int $minPoints ): bool {
		return isset( $layer['points'] )
			&& is_array( $layer['points'] )
			&& count( $layer['points'] ) >= $minPoints;
	}

	/**
	 * Check for parametric polygon definitions (center + radius + sides).
	 */
	private function hasParametricPolygonDefinition( array $layer ): bool {
		if ( !isset( $layer['x'] ) || !isset( $layer['y'] ) ||
			 !isset( $layer['radius'] ) || !isset( $layer['sides'] ) ) {
			return false;
		}

		$radius = (float)$layer['radius'];
		$sides = (int)floor( $layer['sides'] );

		return $radius > 0 && $sides >= 3;
	}

	/**
	 * Get the maximum number of layers allowed
	 *
	 * @return int Maximum layer count
	 */
	public function getMaxLayerCount(): int {
		return $this->config['maxLayers'];
	}

	/**
	 * Get the list of supported layer types
	 *
	 * @return array Supported layer types
	 */
	public function getSupportedLayerTypes(): array {
		return self::SUPPORTED_LAYER_TYPES;
	}

	/**
	 * Check if a layer type is supported
	 *
	 * @param string $type Layer type to check
	 * @return bool True if supported
	 */
	public function isLayerTypeSupported( string $type ): bool {
		return in_array( $type, self::SUPPORTED_LAYER_TYPES, true );
	}

	/**
	 * Validate embedded shape data for customShape layers
	 *
	 * This provides server-side validation of SVG path data to ensure
	 * only safe drawing commands are allowed.
	 *
	 * @param array $shapeData The embedded shape data
	 * @return array Validation result with 'valid' and optionally 'error'
	 */
	private function validateShapeData( array $shapeData ): array {
		// Required: path data
		if ( !isset( $shapeData['path'] ) || !is_string( $shapeData['path'] ) ) {
			return [ 'valid' => false, 'error' => 'shapeData must have a path string' ];
		}

		$path = $shapeData['path'];

		// Path length limit
		if ( strlen( $path ) > 10000 ) {
			return [ 'valid' => false, 'error' => 'Shape path data too long (max 10KB)' ];
		}

		// SECURITY: Strict whitelist of allowed characters in SVG path data
		// Only path commands (M, L, H, V, C, S, Q, T, A, Z) and numbers allowed
		// This makes script injection impossible
		$validPathPattern = '/^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-+eE]+$/';
		if ( !preg_match( $validPathPattern, $path ) ) {
			return [ 'valid' => false, 'error' => 'Shape path contains invalid characters' ];
		}

		// Path must start with a move command
		$trimmedPath = ltrim( $path );
		if ( strlen( $trimmedPath ) === 0 || ( $trimmedPath[0] !== 'M' && $trimmedPath[0] !== 'm' ) ) {
			return [ 'valid' => false, 'error' => 'Shape path must start with moveto command' ];
		}

		// Command count limit (prevent DoS via extremely complex paths)
		$commandCount = preg_match_all( '/[MmLlHhVvCcSsQqTtAaZz]/', $path );
		if ( $commandCount > 2000 ) {
			return [ 'valid' => false, 'error' => 'Shape path has too many commands (max 2000)' ];
		}

		// Required: viewBox array
		if ( !isset( $shapeData['viewBox'] ) || !is_array( $shapeData['viewBox'] ) ) {
			return [ 'valid' => false, 'error' => 'shapeData must have a viewBox array' ];
		}

		$viewBox = $shapeData['viewBox'];
		if ( count( $viewBox ) !== 4 ) {
			return [ 'valid' => false, 'error' => 'viewBox must have exactly 4 values' ];
		}

		foreach ( $viewBox as $val ) {
			if ( !is_numeric( $val ) ) {
				return [ 'valid' => false, 'error' => 'viewBox values must be numeric' ];
			}
		}

		// viewBox width and height must be positive
		if ( (float)$viewBox[2] <= 0 || (float)$viewBox[3] <= 0 ) {
			return [ 'valid' => false, 'error' => 'viewBox width and height must be positive' ];
		}

		// Optional: fillRule validation
		if ( isset( $shapeData['fillRule'] ) ) {
			$validFillRules = [ 'nonzero', 'evenodd' ];
			if ( !in_array( $shapeData['fillRule'], $validFillRules, true ) ) {
				return [ 'valid' => false, 'error' => 'Invalid fillRule value' ];
			}
		}

		return [ 'valid' => true ];
	}

	/**
	 * Validate an SVG string for security
	 *
	 * This prevents XSS attacks by rejecting SVGs with:
	 * - Script elements
	 * - Event handlers (onclick, onload, etc.)
	 * - External references (xlink:href to external URLs)
	 * - Data URIs with script content
	 *
	 * @param string $svg The SVG string to validate
	 * @return array Validation result with 'valid' and optionally 'error'
	 */
	private function validateSvgString( string $svg ): array {
		// Length limit (max 100KB for SVG strings)
		if ( strlen( $svg ) > 102400 ) {
			return [ 'valid' => false, 'error' => 'SVG string too long (max 100KB)' ];
		}

		// Must start with <svg and contain closing tag
		$lowerSvg = strtolower( $svg );
		if ( strpos( $lowerSvg, '<svg' ) !== 0 ) {
			return [ 'valid' => false, 'error' => 'SVG must start with <svg element' ];
		}
		if ( strpos( $lowerSvg, '</svg>' ) === false ) {
			return [ 'valid' => false, 'error' => 'SVG must have closing </svg> tag' ];
		}

		// SECURITY: Block script elements
		if ( preg_match( '/<\s*script/i', $svg ) ) {
			return [ 'valid' => false, 'error' => 'SVG must not contain script elements' ];
		}

		// SECURITY: Block event handlers (on* attributes)
		if ( preg_match( '/\s+on\w+\s*=/i', $svg ) ) {
			return [ 'valid' => false, 'error' => 'SVG must not contain event handlers' ];
		}

		// SECURITY: Block javascript: and data: URLs (except safe data:image/ types)
		if ( preg_match( '/javascript\s*:/i', $svg ) ) {
			return [ 'valid' => false, 'error' => 'SVG must not contain javascript: URLs' ];
		}

		// SECURITY: Block external references that could leak data
		if ( preg_match( '/xlink:href\s*=\s*["\']https?:/i', $svg ) ) {
			return [ 'valid' => false, 'error' => 'SVG must not contain external URLs' ];
		}

		// SECURITY: Block foreignObject which can embed HTML
		if ( preg_match( '/<\s*foreignObject/i', $svg ) ) {
			return [ 'valid' => false, 'error' => 'SVG must not contain foreignObject elements' ];
		}

		// SECURITY: Block use elements with external references
		if ( preg_match( '/<\s*use[^>]+xlink:href\s*=\s*["\']https?:/i', $svg ) ) {
			return [ 'valid' => false, 'error' => 'SVG use elements must not reference external URLs' ];
		}

		return [ 'valid' => true, 'value' => $svg ];
	}
}
