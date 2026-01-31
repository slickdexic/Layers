<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Logging\StaticLoggerAwareTrait;
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;
use MediaWiki\MediaWikiServices;
use Parser;
use PPFrame;

/**
 * Parser hooks for Slide Mode functionality.
 *
 * This class implements the {{#Slide:}} parser function which allows creating
 * canvas-based visual content without requiring a parent image.
 *
 * USAGE:
 * {{#Slide: SlideName
 *  | canvas = WIDTHxHEIGHT
 *  | noedit
 *  | background = COLOR
 *  | class = CSS_CLASSES
 *  | placeholder = MESSAGE
 *  | layerset = SETNAME
 * }}
 *
 * PARAMETERS:
 * - SlideName: Unique identifier (required)
 * - canvas: Canvas dimensions in pixels, e.g., "800x600" (default: 800x600)
 * - noedit: Hide the edit button (boolean flag, no value needed)
 * - background: Background color, e.g., "#ffffff" or "transparent" (default: #ffffff)
 * - class: Additional CSS classes for the container
 * - placeholder: Text shown when slide is empty
 * - editable: Whether edit button appears - "yes" or "no" (default: yes)
 * - layerset: Named layer set to display (default: "default")
 *
 * @see docs/SLIDE_MODE.md for full specification
 */
class SlideHooks {
	use StaticLoggerAwareTrait;

	/**
	 * Register the #Slide parser function.
	 *
	 * @param Parser $parser The parser instance
	 * @return bool
	 */
	public static function onParserFirstCallInit( Parser $parser ): bool {
		// Check if slides feature is enabled
		$config = MediaWikiServices::getInstance()->getMainConfig();
		if ( !$config->get( 'LayersSlidesEnable' ) ) {
			return true;
		}

		$parser->setFunctionHook(
			'Slide',
			[ self::class, 'renderSlide' ],
			Parser::SFH_OBJECT_ARGS
		);

		return true;
	}

	/**
	 * Render a slide canvas.
	 *
	 * @param Parser $parser The parser instance
	 * @param PPFrame $frame The parser frame
	 * @param array $args The function arguments
	 * @return array|string HTML output
	 */
	public static function renderSlide( Parser $parser, PPFrame $frame, array $args ) {
		try {
			return self::doRenderSlide( $parser, $frame, $args );
		} catch ( \Throwable $e ) {
			// Catch all exceptions/errors to prevent breaking page parsing
			self::logError( 'renderSlide fatal error: ' . $e->getMessage() );
			$message = wfMessage( 'layers-slide-error-generic' )->text();
			$html = sprintf(
				'<div class="layers-slide-error">%s</div>',
				htmlspecialchars( $message, ENT_QUOTES, 'UTF-8' )
			);
			return [ $html, 'noparse' => true, 'isHTML' => true ];
		}
	}

	/**
	 * Internal implementation of slide rendering.
	 *
	 * @param Parser $parser The parser instance
	 * @param PPFrame $frame The parser frame
	 * @param array $args The function arguments
	 * @return array|string HTML output
	 */
	private static function doRenderSlide( Parser $parser, PPFrame $frame, array $args ) {
		self::log( 'renderSlide called with ' . count( $args ) . ' args' );

		$config = MediaWikiServices::getInstance()->getMainConfig();

		// Check if slides are enabled
		if ( !$config->get( 'LayersSlidesEnable' ) ) {
			self::log( 'Slides feature is disabled' );
			return self::errorHtml( 'layers-slide-disabled' );
		}

		// Parse arguments
		$params = self::parseArguments( $frame, $args );
		self::log( 'Parsed params: ' . json_encode( array_keys( $params ) ) );

		// Validate slide name (first positional argument)
		$slideName = $params['name'] ?? '';
		if ( $slideName === '' ) {
			return self::errorHtml( 'layers-slide-name-required' );
		}

		$validator = new SlideNameValidator();
		if ( !$validator->isValid( $slideName ) ) {
			return self::errorHtml( 'layers-slide-invalid-name' );
		}

		// Determine layer set name early (needed for fetching saved dimensions)
		$layerSetName = $params['layerset'] ?? 'default';

		// Parse canvas dimensions
		// Priority: explicit canvas= param > saved dimensions from DB > config defaults
		$canvasWidth = (int)$config->get( 'LayersSlideDefaultWidth' );
		$canvasHeight = (int)$config->get( 'LayersSlideDefaultHeight' );

		// Ensure minimum dimensions (fallback if config is missing/invalid)
		if ( $canvasWidth <= 0 ) {
			$canvasWidth = 800;
		}
		if ( $canvasHeight <= 0 ) {
			$canvasHeight = 600;
		}

		if ( !empty( $params['canvas'] ) ) {
			// Explicit canvas= param takes priority
			$dimensions = self::parseCanvasDimensions( $params['canvas'], $config );
			if ( $dimensions ) {
				$canvasWidth = $dimensions['width'];
				$canvasHeight = $dimensions['height'];
			}
		} else {
			// No explicit canvas param - try to get saved dimensions from database
			$savedDimensions = self::getSavedSlideDimensions( $slideName, $layerSetName );
			if ( $savedDimensions ) {
				$canvasWidth = $savedDimensions['width'];
				$canvasHeight = $savedDimensions['height'];
				self::log( 'Using saved canvas dimensions from DB: ' .
					$canvasWidth . 'x' . $canvasHeight );
			}
		}

		// Parse display size (how the slide appears on the page)
		// If not specified, display at canvas size
		// If specified, scale to fit within bounds while preserving aspect ratio
		$displayWidth = $canvasWidth;
		$displayHeight = $canvasHeight;

		if ( !empty( $params['size'] ) ) {
			$sizeConstraints = self::parseCanvasDimensions( $params['size'], $config );
			if ( $sizeConstraints ) {
				// Calculate scaled dimensions that fit within constraints while preserving aspect ratio
				$scaled = self::calculateScaledDimensions(
					$canvasWidth,
					$canvasHeight,
					$sizeConstraints['width'],
					$sizeConstraints['height']
				);
				$displayWidth = $scaled['width'];
				$displayHeight = $scaled['height'];
			}
		}

		// Parse noedit flag (hides edit button in overlay)
		$noEdit = isset( $params['noedit'] );

		// Parse background color
		$backgroundColor = $config->get( 'LayersSlideDefaultBackground' );
		if ( !empty( $params['background'] ) ) {
			$bgValue = trim( $params['background'] );
			if ( self::isValidColor( $bgValue ) ) {
				$backgroundColor = $bgValue;
			}
		}

		// Parse other options
		$cssClasses = [];
		if ( !empty( $params['class'] ) ) {
			// Sanitize CSS class names
			$cssClasses = self::sanitizeCssClasses( $params['class'] );
		}

		$placeholder = $params['placeholder'] ?? '';

		// $layerSetName was already set above (needed for fetching saved dimensions)

		// NOTE: We cannot reliably check user permissions during parsing because
		// MediaWiki's parser cache means parsing often runs as anonymous user.
		// Instead, we always render the edit button container and let the
		// JavaScript/viewer check permissions client-side using mw.config.
		// The 'noedit' flag from wikitext controls whether the edit button appears.
		$canEdit = !$noEdit;

		self::log( 'Rendering slide: ' . $slideName . ', noedit=' . ( $noEdit ? 'true' : 'false' ) .
			', layerset=' . $layerSetName . ', canvas=' . $canvasWidth . 'x' . $canvasHeight .
			', display=' . $displayWidth . 'x' . $displayHeight );

		// Build the HTML output
		$html = self::buildSlideHtml(
			$slideName,
			$canvasWidth,
			$canvasHeight,
			$displayWidth,
			$displayHeight,
			$backgroundColor,
			$cssClasses,
			$placeholder,
			$canEdit,
			$layerSetName
		);

		// Add ResourceLoader modules
		$parser->getOutput()->addModules( [ 'ext.layers' ] );

		self::log( 'Slide HTML generated, length=' . strlen( $html ) );

		// Return raw HTML (no further parsing)
		return [ $html, 'noparse' => true, 'isHTML' => true ];
	}

	/**
	 * Parse function arguments into a key-value array.
	 *
	 * @param PPFrame $frame The parser frame
	 * @param array $args Raw arguments
	 * @return array Parsed parameters
	 */
	private static function parseArguments( PPFrame $frame, array $args ): array {
		$params = [];

		foreach ( $args as $i => $arg ) {
			$expanded = trim( $frame->expand( $arg ) );

			if ( $i === 0 ) {
				// First argument is the slide name
				$params['name'] = $expanded;
				continue;
			}

			// Parse key=value pairs
			$equalsPos = strpos( $expanded, '=' );
			if ( $equalsPos !== false ) {
				$key = strtolower( trim( substr( $expanded, 0, $equalsPos ) ) );
				$value = trim( substr( $expanded, $equalsPos + 1 ) );
				$params[$key] = $value;
			}
		}

		return $params;
	}

	/**
	 * Parse canvas dimension string into width and height.
	 *
	 * @param string $dimensionStr Dimension string (e.g., "800x600")
	 * @param \Config $config MediaWiki config
	 * @return array|null Array with 'width' and 'height', or null if invalid
	 */
	private static function parseCanvasDimensions( string $dimensionStr, $config ): ?array {
		// Match WIDTHxHEIGHT pattern
		if ( !preg_match( '/^(\d+)\s*[xX×]\s*(\d+)$/', trim( $dimensionStr ), $matches ) ) {
			return null;
		}

		$width = (int)$matches[1];
		$height = (int)$matches[2];

		// Enforce size limits
		$maxWidth = (int)$config->get( 'LayersSlideMaxWidth' );
		$maxHeight = (int)$config->get( 'LayersSlideMaxHeight' );

		// Minimum 50px is a reasonable minimum size
		$minSize = 50;

		if ( $width < $minSize || $height < $minSize ) {
			return null;
		}

		if ( $width > $maxWidth || $height > $maxHeight ) {
			// Clamp to max values
			$width = min( $width, $maxWidth );
			$height = min( $height, $maxHeight );
		}

		return [ 'width' => $width, 'height' => $height ];
	}

	/**
	 * Validate a color value.
	 *
	 * @param string $color Color string
	 * @return bool True if valid
	 */
	private static function isValidColor( string $color ): bool {
		// Allow 'transparent' keyword
		if ( strtolower( $color ) === 'transparent' ) {
			return true;
		}

		// Allow hex colors (#RGB, #RRGGBB, #RRGGBBAA)
		if ( preg_match( '/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $color ) ) {
			return true;
		}

		// Allow rgb/rgba
		if ( preg_match( '/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/', $color ) ) {
			return true;
		}

		// Allow common named colors
		$namedColors = [
			'white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
			'gray', 'grey', 'pink', 'brown', 'cyan', 'magenta'
		];
		if ( in_array( strtolower( $color ), $namedColors, true ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Get saved canvas dimensions for a slide from the database.
	 *
	 * @param string $slideName The slide name
	 * @param string $layerSetName The layer set name (default: 'default')
	 * @return array|null Array with 'width' and 'height' keys, or null if not found
	 */
	private static function getSavedSlideDimensions( string $slideName, string $layerSetName ): ?array {
		try {
			$db = MediaWikiServices::getInstance()->getService( 'LayersDatabase' );
			$imgName = LayersConstants::SLIDE_PREFIX . $slideName;

			// Use TYPE_SLIDE as sha1 for slides (consistent with save logic)
			$layerSet = $db->getLayerSetByName( $imgName, LayersConstants::TYPE_SLIDE, $layerSetName );

			if ( $layerSet && isset( $layerSet['data'] ) ) {
				$data = $layerSet['data'];
				// Canvas dimensions are stored inside the data object
				// Check for valid positive dimensions (must be > 0 to prevent division by zero)
				$width = isset( $data['canvasWidth'] ) ? (int)$data['canvasWidth'] : 0;
				$height = isset( $data['canvasHeight'] ) ? (int)$data['canvasHeight'] : 0;
				if ( $width > 0 && $height > 0 ) {
					return [
						'width' => $width,
						'height' => $height
					];
				}
			}
		} catch ( \Throwable $e ) {
			// Catch all throwables (Error and Exception) to prevent parser breakage
			self::log( 'Error fetching slide dimensions: ' . $e->getMessage() );
		}

		return null;
	}

	/**
	 * Sanitize CSS class names.
	 *
	 * @param string $classStr Space-separated class names
	 * @return array Valid CSS class names
	 */
	private static function sanitizeCssClasses( string $classStr ): array {
		$classes = preg_split( '/\s+/', $classStr, -1, PREG_SPLIT_NO_EMPTY );
		$valid = [];

		foreach ( $classes as $class ) {
			// Allow alphanumeric, hyphens, and underscores
			if ( preg_match( '/^[a-zA-Z][a-zA-Z0-9_-]*$/', $class ) ) {
				$valid[] = htmlspecialchars( $class, ENT_QUOTES, 'UTF-8' );
			}
		}

		return $valid;
	}

	/**
	 * Build the HTML for a slide container.
	 *
	 * @param string $slideName Slide identifier
	 * @param int $canvasWidth Canvas width in pixels (editor working size)
	 * @param int $canvasHeight Canvas height in pixels (editor working size)
	 * @param int $displayWidth Display width in pixels (how it appears on page)
	 * @param int $displayHeight Display height in pixels (how it appears on page)
	 * @param string $backgroundColor Background color
	 * @param array $cssClasses Additional CSS classes
	 * @param string $placeholder Placeholder text
	 * @param bool $canEdit Whether user can edit (noedit flag not set)
	 * @param string $layerSetName Named layer set
	 * @return string HTML output
	 */
	private static function buildSlideHtml(
		string $slideName,
		int $canvasWidth,
		int $canvasHeight,
		int $displayWidth,
		int $displayHeight,
		string $backgroundColor,
		array $cssClasses,
		string $placeholder,
		bool $canEdit,
		string $layerSetName
	): string {
		// Build CSS classes
		$allClasses = array_merge(
			[ 'layers-slide-container' ],
			$cssClasses
		);

		$classAttr = htmlspecialchars( implode( ' ', $allClasses ), ENT_QUOTES, 'UTF-8' );
		$slideNameAttr = htmlspecialchars( $slideName, ENT_QUOTES, 'UTF-8' );
		$bgColorAttr = htmlspecialchars( $backgroundColor, ENT_QUOTES, 'UTF-8' );
		$placeholderAttr = htmlspecialchars( $placeholder, ENT_QUOTES, 'UTF-8' );
		$layerSetAttr = htmlspecialchars( $layerSetName, ENT_QUOTES, 'UTF-8' );

		// Inline style for DISPLAY dimensions (how slide appears on page) and background
		$bgStyle = $backgroundColor === 'transparent'
			? 'background: transparent; background-image: url(data:image/svg+xml,' .
			  'base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+' .
			  'PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4' .
			  'IiBoZWlnaHQ9IjgiIGZpbGw9IiNjY2MiLz48L3N2Zz4=);'
			: "background-color: {$bgColorAttr};";

		// Use DISPLAY dimensions for the visible container size
		$style = "width: {$displayWidth}px; height: {$displayHeight}px; {$bgStyle}";

		// Build data attributes
		// Calculate the scale factor for the renderer
		// This is the ratio between display size and canvas size
		// Guard against division by zero (defensive - should not happen with valid data)
		$scale = ( $canvasWidth > 0 ) ? ( $displayWidth / $canvasWidth ) : 1.0;

		$dataAttrs = sprintf(
			'data-slide-name="%s" data-canvas-width="%d" data-canvas-height="%d" ' .
			'data-display-width="%d" data-display-height="%d" data-display-scale="%s" ' .
			'data-background="%s" data-layerset="%s" data-editable="%s"',
			$slideNameAttr,
			$canvasWidth,
			$canvasHeight,
			$displayWidth,
			$displayHeight,
			number_format( $scale, 4, '.', '' ),
			$bgColorAttr,
			$layerSetAttr,
			$canEdit ? 'true' : 'false'
		);

		// Build inner content (canvas placeholder)
		$innerContent = '<canvas class="layers-slide-canvas"></canvas>';

		// Add placeholder if set
		if ( $placeholder !== '' ) {
			$innerContent .= sprintf(
				'<div class="layers-slide-placeholder">%s</div>',
				$placeholderAttr
			);
		}

		// Note: Edit/view overlay buttons are created by JavaScript (ViewerManager.setupSlideOverlay)
		// This ensures consistent behavior and permission checking client-side.
		// We only need to pass data-editable attribute for JS to know if editing is allowed.

		// Assemble final HTML
		return sprintf(
			'<div class="%s" style="%s" %s>%s</div>',
			$classAttr,
			htmlspecialchars( $style, ENT_QUOTES, 'UTF-8' ),
			$dataAttrs,
			$innerContent
		);
	}

	/**
	 * Calculate scaled dimensions that fit within a bounding box while preserving aspect ratio.
	 *
	 * Similar to how MediaWiki thumbnail sizing works - fits within the constraint box
	 * without exceeding either dimension, preserving the original aspect ratio.
	 *
	 * @param int $sourceWidth Original width (canvas width)
	 * @param int $sourceHeight Original height (canvas height)
	 * @param int $maxWidth Maximum allowed width
	 * @param int $maxHeight Maximum allowed height
	 * @return array Array with 'width' and 'height'
	 */
	private static function calculateScaledDimensions(
		int $sourceWidth,
		int $sourceHeight,
		int $maxWidth,
		int $maxHeight
	): array {
		// Handle edge cases
		if ( $sourceWidth <= 0 || $sourceHeight <= 0 ) {
			return [ 'width' => $maxWidth, 'height' => $maxHeight ];
		}

		$aspectRatio = $sourceWidth / $sourceHeight;

		// Calculate dimensions that fit within the bounding box
		// Try fitting by width first
		$scaledWidth = $maxWidth;
		$scaledHeight = (int)round( $maxWidth / $aspectRatio );

		// If height exceeds max, fit by height instead
		if ( $scaledHeight > $maxHeight ) {
			$scaledHeight = $maxHeight;
			$scaledWidth = (int)round( $maxHeight * $aspectRatio );
		}

		return [ 'width' => $scaledWidth, 'height' => $scaledHeight ];
	}

	/**
	 * Generate error HTML output.
	 *
	 * @param string $messageKey i18n message key
	 * @return array Parser function return value
	 */
	private static function errorHtml( string $messageKey ): array {
		$message = wfMessage( $messageKey )->text();
		$html = sprintf(
			'<div class="layers-slide-error">%s</div>',
			htmlspecialchars( $message, ENT_QUOTES, 'UTF-8' )
		);
		return [ $html, 'noparse' => true, 'isHTML' => true ];
	}
}
