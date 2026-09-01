<?php

declare( strict_types=1 );

/**
 * Server-side thumbnail renderer for layered images
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers;

use MediaWiki\Config\Config;
use MediaWiki\Extension\Layers\Utility\ForeignFileHelper;
use MediaWiki\Extension\Layers\Utility\RenderCache;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\MediaWikiServices;
use MediaWiki\Shell\Shell;
use Psr\Log\LoggerInterface;
use Wikimedia\AtEase\AtEase;

class ThumbnailRenderer {
	/**
	 * Layer types this renderer has no ImageMagick primitive for.
	 *
	 * Empty as of 1.5.87: every type the validator accepts is now drawn
	 * server-side. The list and its gate are kept because the failure mode it
	 * guards against — a new layer type silently vanishing from PDF exports and
	 * server-composited thumbnails — is invisible until a user compares the two.
	 * A type added here must also be reported through getDroppedLayerTypes().
	 *
	 * Note that a *runtime* drop is still possible and still reported: an image
	 * layer whose data URL will not decode, or a custom shape carrying only a
	 * raw `svg` blob, is added to droppedTypes when it is encountered.
	 *
	 * Keep in sync with ServerSideLayerValidator::ALLOWED_TYPES; enforced by
	 * scripts/check-parallel-lists.js.
	 */
	public const UNSUPPORTED_SERVER_SIDE = [];

	/**
	 * Layer types that draw nothing anywhere, including in the browser.
	 *
	 * `group` is a pure container: GroupManager stores child ids and leaves the
	 * children in the same flat array, so they are drawn on their own iteration.
	 * Reporting it as "dropped" told users an export was incomplete when nothing
	 * had been lost.
	 */
	private const NON_VISUAL_TYPES = [
		'group',
	];

	/** @var Config */
	private $config;

	/** @var LoggerInterface|null */
	private $logger;

	/**
	 * Layer types skipped during the most recent overlayLayers() call.
	 * @var string[]
	 */
	private array $droppedTypes = [];

	/**
	 * Temp files written for image layers during the current render.
	 * @var string[]
	 */
	private array $tempFiles = [];

	/**
	 * Render dimensions of the current canvas (set during overlayLayers).
	 * Used by buildShadowSubImage to create isolated shadow canvases.
	 */
	private int $renderWidth = 0;
	private int $renderHeight = 0;

	public function __construct( ?Config $config = null, ?LoggerInterface $logger = null ) {
		if ( $config === null && class_exists( MediaWikiServices::class ) ) {
			$config = MediaWikiServices::getInstance()->getMainConfig();
		}
		$this->config = $config ?? new \HashConfig( [] );
		if ( $logger === null ) {
			$logger = LoggerFactory::getInstance( 'Layers' );
		}
		$this->logger = $logger;
	}

	/**
	 * Generate thumbnail with layers overlaid
	 *
	 * @param mixed $file MediaWiki File
	 * @param array $params Transform parameters (must include 'layers' and 'layerData')
	 * @return string|null Path to generated thumbnail or null on failure
	 */
	public function generateLayeredThumbnail( $file, array $params ) {
		if ( empty( $params['layers'] ) || empty( $params['layerData'] ) ) {
			return null;
		}

		try {
			$layers = $params['layerData'];
			if ( empty( $layers ) ) {
				return null;
			}

			// Produce the base thumbnail first
			$baseParams = $params;
			unset( $baseParams['layers'], $baseParams['layerSetId'], $baseParams['layerData'] );
			$baseThumb = $file->transform( $baseParams );
			if ( !$baseThumb || ( method_exists( $baseThumb, 'isError' ) && $baseThumb->isError() ) ) {
				if ( $this->logger ) {
					$this->logger->warning( 'Layers: base thumbnail generation failed' );
				}
				return null;
			}

			$thumbDir = RenderCache::getThumbDir( $this->config );
			if ( !RenderCache::ensureDir( $this->config, $thumbDir ) ) {
				if ( $this->logger ) {
					$this->logger->error( 'Layers: failed to create thumb directory', [ 'dir' => $thumbDir ] );
				}
				return null;
			}

			$outputPath = $thumbDir . '/' .
				RenderCache::artefactKey( ForeignFileHelper::getFileSha1( $file ) ) . '_' .
				md5( json_encode( $params ) ) . '.png';
			if ( file_exists( $outputPath ) ) {
				return $outputPath;
			}

			$basePath = method_exists( $baseThumb, 'getLocalCopyPath' )
				? $baseThumb->getLocalCopyPath()
				: ( $baseThumb->getFile() ? $baseThumb->getFile()->getLocalRefPath() : null );
			if ( !$basePath ) {
				return null;
			}

			// Determine scale from original to target dimensions. For multi-page
			// files (PDFs) getWidth/getHeight are page-specific, so pass the page
			// through — otherwise the overlay is scaled against page 1's size.
			$page = isset( $params['page'] ) ? (int)$params['page'] : 1;
			if ( $page < 1 ) {
				$page = 1;
			}
			$origW = (int)$file->getWidth( $page );
			$origH = (int)$file->getHeight( $page );
			$targetW = isset( $baseParams['width'] ) ? (int)$baseParams['width'] : $origW;
			$targetH = isset( $baseParams['height'] )
				? (int)$baseParams['height']
				: (
					$origW > 0 && $origH > 0 && $targetW > 0
						? (int)round( $origH * ( $targetW / $origW ) )
						: $origH
				);
			$scaleX = $origW > 0 ? ( $targetW / $origW ) : 1.0;
			$scaleY = $origH > 0 ? ( $targetH / $origH ) : $scaleX;

			if ( $this->overlayLayers( $basePath, $layers, $outputPath, $scaleX, $scaleY, $targetW, $targetH ) ) {
				return $outputPath;
			}
		} catch ( \Throwable $e ) {
			if ( $this->logger ) {
				$this->logger->warning(
					'Layers: thumbnail generation failed: {message}',
					[ 'exception' => $e, 'message' => $e->getMessage() ]
				);
			}
		}

		return null;
	}

	/**
	 * Use ImageMagick to overlay layers on base image
	 */
	private function overlayLayers(
		string $basePath,
		array $layers,
		string $outputPath,
		float $scaleX,
		float $scaleY,
		int $targetW = 0,
		int $targetH = 0
	): bool {
		if ( !$this->config || !$this->config->get( 'UseImageMagick' ) ) {
			return false;
		}
		$convert = $this->config->get( 'ImageMagickConvertCommand' );
		if ( !$convert ) {
			return false;
		}

		// Store canvas dimensions for shadow sub-image isolation
		$this->renderWidth = $targetW;
		$this->renderHeight = $targetH;
		$this->droppedTypes = [];

		$args = [ $convert, $basePath ];

		// Draw back-to-front: earlier array entries are background; later entries are on top
		// Render in given order so top-most (last) are applied last
		foreach ( $layers as $layer ) {
			// Handle both boolean false and integer 0 (API serialization)
			$visible = $layer['visible'] ?? true;
			if ( $visible === false || $visible === 0 ) {
				continue;
			}
			$args = array_merge( $args, $this->buildLayerArguments( $layer, $scaleX, $scaleY ) );
		}

		$args[] = $outputPath;

		// Use MediaWiki Shell abstraction for safety and resource limits
		$limits = [];
		try {
			$limits = [
				'memory' => $this->config->get( 'MaxShellMemory' ),
				'time' => min(
					(int)$this->config->get( 'MaxShellTime' ),
					(int)$this->config->get( 'LayersImageMagickTimeout' )
				),
				'filesize' => $this->config->get( 'MaxShellFileSize' ),
			];
		} catch ( \Throwable $e ) {
			// If config keys missing, proceed with defaults
			$limits = [ 'time' => (int)( $this->config->get( 'LayersImageMagickTimeout' ) ?? 30 ) ];
		}

		try {
			$result = Shell::command( ...$args )
				->limits( $limits )
				->includeStderr()
				->execute();

			if (
				method_exists( $result, 'getExitCode' )
					? $result->getExitCode() !== 0
					: ( method_exists( $result, 'isOK' ) ? !$result->isOK() : false )
			) {
				$stderr = method_exists( $result, 'getStderr' ) ? $result->getStderr() : '';
				if ( $this->logger ) {
					$this->logger->error(
						'Layers: ImageMagick failed',
						[ 'stderr' => $stderr, 'args' => $args ]
					);
				}
				return false;
			}
		} catch ( \Throwable $e ) {
			if ( $this->logger ) {
				$this->logger->error(
					'Layers: Shell execution failed',
					[ 'exception' => $e, 'args' => $args ]
				);
			}
			return false;
		} finally {
			// Image layers are staged on disk for ImageMagick to read; every exit
			// from here must remove them.
			$this->cleanupTempFiles();
		}

		return file_exists( $outputPath );
	}

	/**
	 * Build ImageMagick arguments for a layer with scaling applied
	 *
	 * @param array $layer Layer configuration array containing type and properties
	 * @param float $scaleX Horizontal scaling factor to apply to coordinates
	 * @param float $scaleY Vertical scaling factor to apply to coordinates
	 * @return array Array of ImageMagick command arguments for this layer
	 */
	private function buildLayerArguments( array $layer, float $scaleX, float $scaleY ): array {
		switch ( $layer['type'] ) {
			case 'text':
				return $this->buildTextArguments( $layer, $scaleX, $scaleY );
			case 'textbox':
				return $this->buildTextBoxArguments( $layer, $scaleX, $scaleY );
			case 'rectangle':
				return $this->buildRectangleArguments( $layer, $scaleX, $scaleY );
			case 'circle':
				return $this->buildCircleArguments( $layer, $scaleX, $scaleY );
			case 'ellipse':
				return $this->buildEllipseArguments( $layer, $scaleX, $scaleY );
			case 'polygon':
				return $this->buildPolygonArguments( $layer, $scaleX, $scaleY );
			case 'star':
				return $this->buildStarArguments( $layer, $scaleX, $scaleY );
			case 'path':
				return $this->buildPathArguments( $layer, $scaleX, $scaleY );
			case 'arrow':
				return $this->buildArrowArguments( $layer, $scaleX, $scaleY );
			case 'line':
				return $this->buildLineArguments( $layer, $scaleX, $scaleY );
			case 'marker':
				return $this->buildMarkerArguments( $layer, $scaleX, $scaleY );
			case 'callout':
				return $this->buildCalloutArguments( $layer, $scaleX, $scaleY );
			case 'dimension':
				return $this->buildDimensionArguments( $layer, $scaleX, $scaleY );
			case 'angleDimension':
				return $this->buildAngleDimensionArguments( $layer, $scaleX, $scaleY );
			case 'image':
				return $this->buildImageArguments( $layer, $scaleX, $scaleY );
			case 'customShape':
				return $this->buildCustomShapeArguments( $layer, $scaleX, $scaleY );
			default:
				$type = (string)( $layer['type'] ?? 'unknown' );
				if ( in_array( $type, self::NON_VISUAL_TYPES, true ) ) {
					return [];
				}
				if ( !in_array( $type, $this->droppedTypes, true ) ) {
					$this->droppedTypes[] = $type;
				}
				return [];
		}
	}

	/**
	 * Layer types that the most recent render could not draw.
	 *
	 * Callers that present the render to a user (PDF export) should surface this
	 * so the omission is visible rather than silent.
	 *
	 * @return string[] Distinct layer types skipped, in first-seen order
	 */
	public function getDroppedLayerTypes(): array {
		return $this->droppedTypes;
	}

	/**
	 * Extract and compute shadow parameters from a layer.
	 *
	 * Centralises the shadow property extraction that was previously duplicated
	 * across buildTextArguments, buildTextBoxArguments, buildRectangleArguments,
	 * buildCircleArguments and buildEllipseArguments.
	 *
	 * @param array $layer Layer data
	 * @param float $scaleX X scale factor
	 * @param float $scaleY Y scale factor
	 * @return array|null Associative array with 'color', 'blur', 'offsetX', 'offsetY',
	 *                    or null if shadow is not enabled on this layer
	 */
	private function extractShadowParams( array $layer, float $scaleX, float $scaleY ): ?array {
		if ( empty( $layer['shadow'] ) ) {
			return null;
		}
		$shadowColor = $layer['shadowColor'] ?? 'rgba(0,0,0,0.4)';
		$shadowColor = $this->withOpacity( $shadowColor, 1.0 );
		return [
			'color' => $shadowColor,
			'blur' => (int)( ( (float)( $layer['shadowBlur'] ?? 8 ) ) * min( $scaleX, $scaleY ) ),
			'offsetX' => ( (float)( $layer['shadowOffsetX'] ?? 2 ) ) * $scaleX,
			'offsetY' => ( (float)( $layer['shadowOffsetY'] ?? 2 ) ) * $scaleY,
		];
	}

	/**
	 * Wrap shadow drawing arguments in a parenthesized sub-image to isolate
	 * the blur effect. Without this, -blur affects all previously drawn
	 * content on the canvas (corrupting earlier layers).
	 *
	 * Uses ImageMagick's parenthesized sub-image: creates a fresh transparent
	 * canvas, draws the shadow shape, blurs it, then composites back.
	 *
	 * @param array $drawArgs Arguments to draw the shadow shape (fill, draw commands)
	 * @param int $blurRadius Blur radius for the shadow
	 * @return array ImageMagick arguments with isolated blur
	 */
	private function buildShadowSubImage( array $drawArgs, int $blurRadius ): array {
		if ( $this->renderWidth <= 0 || $this->renderHeight <= 0 || $blurRadius <= 0 ) {
			// Fallback: draw without blur if dimensions unknown
			return $drawArgs;
		}
		return array_merge(
			[
				'(',
				'-size', $this->renderWidth . 'x' . $this->renderHeight,
				'xc:none',
			],
			$drawArgs,
			[
				'-blur', '0x' . $blurRadius,
				')',
				'-compose', 'Over',
				'-composite',
			]
		);
	}

	private function buildTextArguments( array $layer, float $scaleX, float $scaleY ): array {
		$x = ( $layer['x'] ?? 0 ) * $scaleX;
		$y = ( $layer['y'] ?? 0 ) * $scaleY;
		// SECURITY: Strip leading '@' to prevent ImageMagick file read injection.
		// IM interprets '@filename' as "read contents from file" in -annotate.
		$text = ltrim( (string)( $layer['text'] ?? '' ), '@' );
		$fontSize = (int)round( ( $layer['fontSize'] ?? 14 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$fill = (string)( $layer['fill'] ?? '#000000' );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( $fill, $opacity );
		$font = (string)( $layer['fontFamily'] ?? 'DejaVu-Sans' );
		$allowedFonts = $this->config->get( 'LayersDefaultFonts' );
		if ( !in_array( $font, $allowedFonts, true ) ) {
			$font = 'DejaVu-Sans';
		}

		$args = [];
		// Shadow support
		$shadow = $this->extractShadowParams( $layer, $scaleX, $scaleY );
		if ( $shadow !== null ) {
			$shadowDrawArgs = [
				'-fill', $shadow['color'],
				'-pointsize', (string)$fontSize,
				'-font', $font,
				'-annotate', '+' . (int)( $x + $shadow['offsetX'] ) . '+' . (int)( $y + $shadow['offsetY'] ),
				$text,
			];
			$args = array_merge( $args, $this->buildShadowSubImage(
				$shadowDrawArgs, $shadow['blur']
			) );
		}
		$args = array_merge( $args, [
			'-pointsize', (string)$fontSize,
			'-fill', $fill,
			'-font', $font,
			'-annotate', '+' . (int)$x . '+' . (int)$y,
			$text
		] );
		return $args;
	}

	/**
	 * Build ImageMagick arguments for a text box layer (rectangle + text)
	 *
	 * @param array $layer Layer data
	 * @param float $scaleX X scale factor
	 * @param float $scaleY Y scale factor
	 * @return array ImageMagick command arguments
	 */
	private function buildTextBoxArguments( array $layer, float $scaleX, float $scaleY ): array {
		$x = ( $layer['x'] ?? 0 ) * $scaleX;
		$y = ( $layer['y'] ?? 0 ) * $scaleY;
		$width = ( $layer['width'] ?? 100 ) * $scaleX;
		$height = ( $layer['height'] ?? 100 ) * $scaleY;
		$stroke = (string)( $layer['stroke'] ?? '#000000' );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$fill = (string)( $layer['fill'] ?? '#ffffff' );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( $fill, $opacity );
		$stroke = $this->withOpacity( $stroke, $opacity );

		$args = [];

		// Draw shadow if enabled
		$shadow = $this->extractShadowParams( $layer, $scaleX, $scaleY );
		if ( $shadow !== null ) {
			$shadowDrawArgs = [
				'-fill', $shadow['color'],
				'-draw',
				'rectangle ' .
					(int)( $x + $shadow['offsetX'] ) . ',' . (int)( $y + $shadow['offsetY'] ) . ' ' .
					(int)( $x + $width + $shadow['offsetX'] ) . ',' . (int)( $y + $height + $shadow['offsetY'] ),
			];
			$args = array_merge( $args, $this->buildShadowSubImage(
				$shadowDrawArgs, $shadow['blur']
			) );
		}

		// Draw the rectangle background
		$args = array_merge( $args, [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'rectangle ' . (int)$x . ',' . (int)$y . ' ' . (int)( $x + $width ) . ',' . (int)( $y + $height )
		] );

		// Draw text if present
		// SECURITY: Strip leading '@' to prevent ImageMagick file read injection.
		$text = ltrim( (string)( $layer['text'] ?? '' ), '@' );
		if ( $text !== '' ) {
			$fontSize = (int)round( ( $layer['fontSize'] ?? 16 ) * ( ( $scaleX + $scaleY ) / 2 ) );
			$textColor = (string)( $layer['color'] ?? '#000000' );
			$textColor = $this->withOpacity( $textColor, $opacity );
			$font = (string)( $layer['fontFamily'] ?? 'DejaVu-Sans' );
			$allowedFonts = $this->config->get( 'LayersDefaultFonts' );
			if ( !in_array( $font, $allowedFonts, true ) ) {
				$font = 'DejaVu-Sans';
			}
			$padding = ( $layer['padding'] ?? 8 ) * ( ( $scaleX + $scaleY ) / 2 );

			// Calculate text position (simplified - top-left alignment)
			$textX = (int)( $x + $padding );
			$textY = (int)( $y + $padding + $fontSize );

			$args = array_merge( $args, [
				// Reset stroke so it does not bleed onto the text (P2-076)
				'-stroke', 'none',
				'-strokewidth', '0',
				'-fill', $textColor,
				'-pointsize', (string)$fontSize,
				'-font', $font,
				'-annotate', '+' . $textX . '+' . $textY,
				$text
			] );
		}

		return $args;
	}

	private function buildRectangleArguments( array $layer, float $scaleX, float $scaleY ): array {
		$x = ( $layer['x'] ?? 0 ) * $scaleX;
		$y = ( $layer['y'] ?? 0 ) * $scaleY;
		$width = ( $layer['width'] ?? 100 ) * $scaleX;
		$height = ( $layer['height'] ?? 100 ) * $scaleY;
		$stroke = (string)( $layer['stroke'] ?? '#000000' );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$fill = (string)( $layer['fill'] ?? 'none' );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( $fill, $opacity );
		$stroke = $this->withOpacity( $stroke, $opacity );

		$args = [];
		$shadow = $this->extractShadowParams( $layer, $scaleX, $scaleY );
		if ( $shadow !== null ) {
			$shadowDrawArgs = [
				'-fill', $shadow['color'],
				'-draw',
				'rectangle ' .
					(int)( $x + $shadow['offsetX'] ) . ',' . (int)( $y + $shadow['offsetY'] ) . ' ' .
					(int)( $x + $width + $shadow['offsetX'] ) . ',' . (int)( $y + $height + $shadow['offsetY'] ),
			];
			$args = array_merge( $args, $this->buildShadowSubImage(
				$shadowDrawArgs, $shadow['blur']
			) );
		}
		$args = array_merge( $args, [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'rectangle ' . (int)$x . ',' . (int)$y . ' ' . (int)( $x + $width ) . ',' . (int)( $y + $height )
		] );
		return $args;
	}

	private function buildCircleArguments( array $layer, float $scaleX, float $scaleY ): array {
		$x = ( $layer['x'] ?? 0 ) * $scaleX;
		$y = ( $layer['y'] ?? 0 ) * $scaleY;
		$radius = ( $layer['radius'] ?? 50 ) * ( ( $scaleX + $scaleY ) / 2 );
		$stroke = (string)( $layer['stroke'] ?? '#000000' );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$fill = (string)( $layer['fill'] ?? 'none' );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( $fill, $opacity );
		$stroke = $this->withOpacity( $stroke, $opacity );

		$args = [];
		$shadow = $this->extractShadowParams( $layer, $scaleX, $scaleY );
		if ( $shadow !== null ) {
			$shadowDrawArgs = [
				'-fill', $shadow['color'],
				'-draw',
				'circle ' . (int)( $x + $shadow['offsetX'] ) . ',' . (int)( $y + $shadow['offsetY'] ) . ' '
				. (int)( $x + $radius + $shadow['offsetX'] ) . ',' . (int)( $y + $shadow['offsetY'] ),
			];
			$args = array_merge( $args, $this->buildShadowSubImage(
				$shadowDrawArgs, $shadow['blur']
			) );
		}
		$args = array_merge( $args, [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'circle ' . (int)$x . ',' . (int)$y . ' ' . (int)( $x + $radius ) . ',' . (int)$y
		] );
		return $args;
	}

	private function buildEllipseArguments( array $layer, float $scaleX, float $scaleY ): array {
		$x = ( $layer['x'] ?? 0 ) * $scaleX;
		$y = ( $layer['y'] ?? 0 ) * $scaleY;
		$radiusX = ( $layer['radiusX'] ?? 50 ) * $scaleX;
		$radiusY = ( $layer['radiusY'] ?? 25 ) * $scaleY;
		$stroke = (string)( $layer['stroke'] ?? '#000000' );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$fill = (string)( $layer['fill'] ?? 'none' );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( $fill, $opacity );
		$stroke = $this->withOpacity( $stroke, $opacity );

		$args = [];
		$shadow = $this->extractShadowParams( $layer, $scaleX, $scaleY );
		if ( $shadow !== null ) {
			$shadowDrawArgs = [
				'-fill', $shadow['color'],
				'-draw',
				'ellipse ' .
					(int)( $x + $shadow['offsetX'] ) . ',' . (int)( $y + $shadow['offsetY'] ) . ' ' .
					(int)$radiusX . ',' . (int)$radiusY . ' 0,360',
			];
			$args = array_merge( $args, $this->buildShadowSubImage(
				$shadowDrawArgs, $shadow['blur']
			) );
		}
		$args = array_merge( $args, [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw',
			'ellipse ' . (int)$x . ',' . (int)$y . ' ' . (int)$radiusX . ',' . (int)$radiusY . ' 0,360'
		] );
		return $args;
	}

	private function buildPolygonArguments( array $layer, float $scaleX, float $scaleY ): array {
		$x = ( $layer['x'] ?? 0 ) * $scaleX;
		$y = ( $layer['y'] ?? 0 ) * $scaleY;
		$radius = ( $layer['radius'] ?? 50 ) * ( ( $scaleX + $scaleY ) / 2 );
		$sides = (int)( $layer['sides'] ?? 6 );
		$stroke = (string)( $layer['stroke'] ?? '#000000' );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$fill = (string)( $layer['fill'] ?? 'none' );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( $fill, $opacity );
		$stroke = $this->withOpacity( $stroke, $opacity );

		$pts = [];
		for ( $i = 0; $i < $sides; $i++ ) {
			$angle = ( $i * 2 * M_PI / $sides ) - ( M_PI / 2 );
			$pts[] = (int)( $x + $radius * cos( $angle ) ) . ',' . (int)( $y + $radius * sin( $angle ) );
		}

		$args = [];
		$shadow = $this->extractShadowParams( $layer, $scaleX, $scaleY );
		if ( $shadow !== null ) {
			$shadowPts = [];
			for ( $i = 0; $i < $sides; $i++ ) {
				$angle = ( $i * 2 * M_PI / $sides ) - ( M_PI / 2 );
				$shadowPts[] =
					(int)( $x + $shadow['offsetX'] + $radius * cos( $angle ) ) . ',' .
					(int)( $y + $shadow['offsetY'] + $radius * sin( $angle ) );
			}
			$shadowDrawArgs = [
				'-fill', $shadow['color'],
				'-draw', 'polygon ' . implode( ' ', $shadowPts )
			];
			$args = array_merge( $args, $this->buildShadowSubImage(
				$shadowDrawArgs, $shadow['blur']
			) );
		}

		return array_merge( $args, [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'polygon ' . implode( ' ', $pts )
		] );
	}

	private function buildStarArguments( array $layer, float $scaleX, float $scaleY ): array {
		$x = ( $layer['x'] ?? 0 ) * $scaleX;
		$y = ( $layer['y'] ?? 0 ) * $scaleY;
		$outerRadius = ( $layer['outerRadius'] ?? 50 ) * ( ( $scaleX + $scaleY ) / 2 );
		$innerRadius = ( $layer['innerRadius'] ?? 25 ) * ( ( $scaleX + $scaleY ) / 2 );
		$numPoints = (int)( $layer['points'] ?? 5 );
		$stroke = (string)( $layer['stroke'] ?? '#000000' );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$fill = (string)( $layer['fill'] ?? 'none' );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( $fill, $opacity );
		$stroke = $this->withOpacity( $stroke, $opacity );

		$pts = [];
		for ( $i = 0; $i < $numPoints * 2; $i++ ) {
			$radius = ( $i % 2 === 0 ) ? $outerRadius : $innerRadius;
			$angle = ( $i * M_PI / $numPoints ) - ( M_PI / 2 );
			$pts[] = (int)( $x + $radius * cos( $angle ) ) . ',' . (int)( $y + $radius * sin( $angle ) );
		}

		$args = [];
		$shadow = $this->extractShadowParams( $layer, $scaleX, $scaleY );
		if ( $shadow !== null ) {
			$shadowPts = [];
			for ( $i = 0; $i < $numPoints * 2; $i++ ) {
				$radius = ( $i % 2 === 0 ) ? $outerRadius : $innerRadius;
				$angle = ( $i * M_PI / $numPoints ) - ( M_PI / 2 );
				$shadowPts[] =
					(int)( $x + $shadow['offsetX'] + $radius * cos( $angle ) ) . ',' .
					(int)( $y + $shadow['offsetY'] + $radius * sin( $angle ) );
			}
			$shadowDrawArgs = [
				'-fill', $shadow['color'],
				'-draw', 'polygon ' . implode( ' ', $shadowPts )
			];
			$args = array_merge( $args, $this->buildShadowSubImage(
				$shadowDrawArgs, $shadow['blur']
			) );
		}

		return array_merge( $args, [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'polygon ' . implode( ' ', $pts )
		] );
	}

	private function buildPathArguments( array $layer, float $scaleX, float $scaleY ): array {
		$points = $layer['points'] ?? [];
		if ( count( $points ) < 2 ) {
			return [];
		}
		$stroke = (string)( $layer['stroke'] ?? '#000000' );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$fill = (string)( $layer['fill'] ?? 'none' );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( $fill, $opacity );
		$stroke = $this->withOpacity( $stroke, $opacity );

		$cmd = 'path "M ' . (int)( $points[0]['x'] * $scaleX ) . ',' . (int)( $points[0]['y'] * $scaleY ) . ' ';
		for ( $i = 1; $i < count( $points ); $i++ ) {
			$cmd .= 'L ' . (int)( $points[$i]['x'] * $scaleX ) . ',' . (int)( $points[$i]['y'] * $scaleY ) . ' ';
		}
		$cmd .= '"';

		return [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', $cmd
		];
	}

	private function buildArrowArguments( array $layer, float $scaleX, float $scaleY ): array {
		$lineArgs = $this->buildLineArguments( $layer, $scaleX, $scaleY );

		$x2 = ( $layer['x2'] ?? 100 ) * $scaleX;
		$y2 = ( $layer['y2'] ?? 100 ) * $scaleY;
		$x1 = ( $layer['x1'] ?? 0 ) * $scaleX;
		$y1 = ( $layer['y1'] ?? 0 ) * $scaleY;
		$stroke = (string)( $layer['stroke'] ?? '#000000' );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$strokeWithA = $this->withOpacity( $stroke, $opacity );

		$angle = atan2( $y2 - $y1, $x2 - $x1 );
		$arrowLength = 10 * ( ( $scaleX + $scaleY ) / 2 );
		$arrowAngle = 0.5;

		$arrowX1 = $x2 - $arrowLength * cos( $angle - $arrowAngle );
		$arrowY1 = $y2 - $arrowLength * sin( $angle - $arrowAngle );
		$arrowX2 = $x2 - $arrowLength * cos( $angle + $arrowAngle );
		$arrowY2 = $y2 - $arrowLength * sin( $angle + $arrowAngle );

		$arrowArgs = [
			'-fill', $strokeWithA,
			'-stroke', $strokeWithA,
			'-strokewidth', (string)$strokeWidth,
			'-draw',
			'polygon '
				. (int)$x2 . ',' . (int)$y2 . ' '
				. (int)$arrowX1 . ',' . (int)$arrowY1 . ' '
				. (int)$arrowX2 . ',' . (int)$arrowY2
		];

		return array_merge( $lineArgs, $arrowArgs );
	}

	private function buildLineArguments( array $layer, float $scaleX, float $scaleY ): array {
		$x1 = ( $layer['x1'] ?? 0 ) * $scaleX;
		$y1 = ( $layer['y1'] ?? 0 ) * $scaleY;
		$x2 = ( $layer['x2'] ?? 100 ) * $scaleX;
		$y2 = ( $layer['y2'] ?? 100 ) * $scaleY;
		$stroke = (string)( $layer['stroke'] ?? '#000000' );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$stroke = $this->withOpacity( $stroke, $opacity );

		return [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-draw', 'line ' . (int)$x1 . ',' . (int)$y1 . ' ' . (int)$x2 . ',' . (int)$y2
		];
	}

	/**
	 * Resolve a layer's font to one the wiki allows, defaulting safely.
	 *
	 * @param array $layer Layer data
	 * @return string Font name accepted by ImageMagick
	 */
	private function resolveFont( array $layer ): string {
		$font = (string)( $layer['fontFamily'] ?? 'DejaVu-Sans' );
		$allowed = $this->config->get( 'LayersDefaultFonts' );
		return in_array( $font, (array)$allowed, true ) ? $font : 'DejaVu-Sans';
	}

	/**
	 * Strip characters ImageMagick would interpret rather than draw.
	 *
	 * A leading '@' makes -annotate read the rest as a filename.
	 *
	 * @param mixed $text Raw text
	 * @return string Text safe to pass to -annotate
	 */
	private function safeText( $text ): string {
		return ltrim( (string)$text, '@' );
	}

	/**
	 * Format a marker's value the same way MarkerRenderer.js does.
	 *
	 * @param mixed $value Numeric or custom value
	 * @param string $style Marker style
	 * @return string Display text
	 */
	private function formatMarkerValue( $value, string $style ): string {
		if ( is_string( $value ) && !preg_match( '/^\d+$/', $value ) ) {
			switch ( $style ) {
				case 'parentheses':
					return '(' . $value . ')';
				case 'plain':
					return $value . '.';
				default:
					return $value;
			}
		}
		$num = (int)$value ?: 1;
		switch ( $style ) {
			case 'letter':
			case 'letterCircled':
				if ( $num <= 26 ) {
					return chr( 64 + $num );
				}
				return chr( 64 + (int)floor( ( $num - 1 ) / 26 ) )
					. chr( 64 + ( ( $num - 1 ) % 26 ) + 1 );
			case 'parentheses':
				return '(' . $num . ')';
			case 'plain':
				return $num . '.';
			default:
				return (string)$num;
		}
	}

	/**
	 * Numbered or lettered marker: a filled disc with centred text.
	 *
	 * @param array $layer Layer data
	 * @param float $scaleX Horizontal scale
	 * @param float $scaleY Vertical scale
	 * @return array ImageMagick arguments
	 */
	private function buildMarkerArguments( array $layer, float $scaleX, float $scaleY ): array {
		$avgScale = ( $scaleX + $scaleY ) / 2;
		$x = ( $layer['x'] ?? 0 ) * $scaleX;
		$y = ( $layer['y'] ?? 0 ) * $scaleY;
		$radius = ( ( $layer['size'] ?? 32 ) / 2 ) * $avgScale;
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( (string)( $layer['fill'] ?? '#ffffff' ), $opacity );
		$stroke = $this->withOpacity( (string)( $layer['stroke'] ?? '#000000' ), $opacity );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 2 ) * $avgScale );
		$textColor = $this->withOpacity( (string)( $layer['color'] ?? '#000000' ), $opacity );

		$text = $this->safeText( $this->formatMarkerValue(
			$layer['value'] ?? 1,
			(string)( $layer['style'] ?? 'circled' )
		) );
		// MarkerRenderer.js uses 58% of the marker size, then applies the adjustment.
		$fontSize = max( 6, (int)round( ( $layer['size'] ?? 32 ) * 0.58 )
			+ (int)( $layer['fontSizeAdjust'] ?? 0 ) );
		$fontSize = max( 6, (int)round( $fontSize * $avgScale ) );

		$args = [];
		$shadow = $this->extractShadowParams( $layer, $scaleX, $scaleY );
		if ( $shadow !== null ) {
			$args = array_merge( $args, $this->buildShadowSubImage( [
				'-fill', $shadow['color'],
				'-stroke', 'none',
				'-draw', 'circle ' . (int)( $x + $shadow['offsetX'] ) . ','
					. (int)( $y + $shadow['offsetY'] ) . ' '
					. (int)( $x + $radius + $shadow['offsetX'] ) . ','
					. (int)( $y + $shadow['offsetY'] ),
			], $shadow['blur'] ) );
		}

		$args = array_merge( $args, [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'circle ' . (int)$x . ',' . (int)$y . ' '
				. (int)( $x + $radius ) . ',' . (int)$y,
		] );

		if ( $text !== '' ) {
			// -gravity none keeps +x+y absolute; the text is centred by measuring
			// it with -annotate's own box, which IM does when gravity is Center on
			// a sub-region, so place it by offset instead.
			$args = array_merge( $args, [
				'-stroke', 'none',
				'-fill', $textColor,
				'-font', $this->resolveFont( $layer ),
				'-pointsize', (string)$fontSize,
				'-gravity', 'Center',
				'-annotate', $this->centredOffset( $x, $y ),
				$text,
				'-gravity', 'None',
			] );
		}

		return $args;
	}

	/**
	 * Offset used to centre text on a point when -gravity Center is active.
	 *
	 * Gravity Center measures from the canvas centre, so the offset is the
	 * distance from that centre rather than an absolute coordinate.
	 *
	 * @param float $x Target centre x
	 * @param float $y Target centre y
	 * @return string ImageMagick geometry string
	 */
	private function centredOffset( float $x, float $y ): string {
		$dx = (int)round( $x - ( $this->renderWidth / 2 ) );
		$dy = (int)round( $y - ( $this->renderHeight / 2 ) );
		return sprintf( '%+d%+d', $dx, $dy );
	}

	/**
	 * Callout: a rounded box with a tail pointing at the annotated spot.
	 *
	 * @param array $layer Layer data
	 * @param float $scaleX Horizontal scale
	 * @param float $scaleY Vertical scale
	 * @return array ImageMagick arguments
	 */
	private function buildCalloutArguments( array $layer, float $scaleX, float $scaleY ): array {
		$avgScale = ( $scaleX + $scaleY ) / 2;
		$x = ( $layer['x'] ?? 0 ) * $scaleX;
		$y = ( $layer['y'] ?? 0 ) * $scaleY;
		$w = ( $layer['width'] ?? 120 ) * $scaleX;
		$h = ( $layer['height'] ?? 60 ) * $scaleY;
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$fill = $this->withOpacity( (string)( $layer['fill'] ?? '#ffffff' ), $opacity );
		$stroke = $this->withOpacity( (string)( $layer['stroke'] ?? '#000000' ), $opacity );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * $avgScale );
		$corner = (int)round( ( $layer['cornerRadius'] ?? 4 ) * $avgScale );

		$args = [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'roundrectangle ' . (int)$x . ',' . (int)$y . ' '
				. (int)( $x + $w ) . ',' . (int)( $y + $h ) . ' '
				. $corner . ',' . $corner,
		];

		// The tail is a triangle from the nearest box edge to the target point.
		if ( isset( $layer['tailX'] ) && isset( $layer['tailY'] ) ) {
			$tx = (float)$layer['tailX'] * $scaleX;
			$ty = (float)$layer['tailY'] * $scaleY;
			$baseX = max( $x, min( $tx, $x + $w ) );
			$baseY = max( $y, min( $ty, $y + $h ) );
			$spread = max( 4, $w * 0.1 );
			$args = array_merge( $args, [
				'-draw', 'polygon '
					. (int)( $baseX - $spread / 2 ) . ',' . (int)$baseY . ' '
					. (int)( $baseX + $spread / 2 ) . ',' . (int)$baseY . ' '
					. (int)$tx . ',' . (int)$ty,
			] );
		}

		$text = $this->safeText( $layer['text'] ?? '' );
		if ( $text !== '' ) {
			$fontSize = max( 6, (int)round( ( $layer['fontSize'] ?? 14 ) * $avgScale ) );
			$padding = (int)round( ( $layer['padding'] ?? 8 ) * $avgScale );
			$args = array_merge( $args, [
				'-stroke', 'none',
				'-fill', $this->withOpacity( (string)( $layer['color'] ?? '#000000' ), $opacity ),
				'-font', $this->resolveFont( $layer ),
				'-pointsize', (string)$fontSize,
				'-annotate', '+' . (int)( $x + $padding ) . '+' . (int)( $y + $padding + $fontSize ),
				$text,
			] );
		}

		return $args;
	}

	/**
	 * Linear dimension: a measured line with end ticks and a label.
	 *
	 * @param array $layer Layer data
	 * @param float $scaleX Horizontal scale
	 * @param float $scaleY Vertical scale
	 * @return array ImageMagick arguments
	 */
	private function buildDimensionArguments( array $layer, float $scaleX, float $scaleY ): array {
		$avgScale = ( $scaleX + $scaleY ) / 2;
		$x1 = ( $layer['x1'] ?? 0 ) * $scaleX;
		$y1 = ( $layer['y1'] ?? 0 ) * $scaleY;
		$x2 = ( $layer['x2'] ?? 100 ) * $scaleX;
		$y2 = ( $layer['y2'] ?? 0 ) * $scaleY;
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$stroke = $this->withOpacity( (string)( $layer['stroke'] ?? '#000000' ), $opacity );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * $avgScale );

		// End ticks perpendicular to the measured line.
		$dx = $x2 - $x1;
		$dy = $y2 - $y1;
		$len = sqrt( $dx * $dx + $dy * $dy );
		$tick = 6 * $avgScale;
		$nx = $len > 0 ? ( -$dy / $len ) * $tick : 0;
		$ny = $len > 0 ? ( $dx / $len ) * $tick : 0;

		$args = [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', 'none',
			'-draw', 'line ' . (int)$x1 . ',' . (int)$y1 . ' ' . (int)$x2 . ',' . (int)$y2,
			'-draw', 'line ' . (int)( $x1 - $nx ) . ',' . (int)( $y1 - $ny ) . ' '
				. (int)( $x1 + $nx ) . ',' . (int)( $y1 + $ny ),
			'-draw', 'line ' . (int)( $x2 - $nx ) . ',' . (int)( $y2 - $ny ) . ' '
				. (int)( $x2 + $nx ) . ',' . (int)( $y2 + $ny ),
		];

		$label = $this->dimensionLabel( $layer, $len / max( $avgScale, 0.0001 ) );
		if ( $label !== '' ) {
			$fontSize = max( 6, (int)round( ( $layer['fontSize'] ?? 12 ) * $avgScale ) );
			$args = array_merge( $args, [
				'-stroke', 'none',
				'-fill', $this->withOpacity( (string)( $layer['color'] ?? $layer['stroke'] ?? '#000000' ), $opacity ),
				'-font', $this->resolveFont( $layer ),
				'-pointsize', (string)$fontSize,
				'-gravity', 'Center',
				'-annotate', $this->centredOffset(
					( $x1 + $x2 ) / 2 + $nx, ( $y1 + $y2 ) / 2 + $ny - $fontSize
				),
				$label,
				'-gravity', 'None',
			] );
		}

		return $args;
	}

	/**
	 * Build the text shown against a dimension.
	 *
	 * @param array $layer Layer data
	 * @param float $pixelLength Measured length in unscaled pixels
	 * @return string Label text
	 */
	private function dimensionLabel( array $layer, float $pixelLength ): string {
		if ( isset( $layer['text'] ) && (string)$layer['text'] !== '' ) {
			return $this->safeText( $layer['text'] );
		}
		$scaleFactor = (float)( $layer['scale'] ?? 1 );
		$value = round( $pixelLength * ( $scaleFactor ?: 1 ), 1 );
		$unit = ( $layer['showUnit'] ?? true ) ? (string)( $layer['unit'] ?? 'px' ) : '';
		return $this->safeText( $value . ( $unit !== '' ? ' ' . $unit : '' ) );
	}

	/**
	 * Angle dimension: two legs from a vertex with a label.
	 *
	 * @param array $layer Layer data
	 * @param float $scaleX Horizontal scale
	 * @param float $scaleY Vertical scale
	 * @return array ImageMagick arguments
	 */
	private function buildAngleDimensionArguments( array $layer, float $scaleX, float $scaleY ): array {
		$avgScale = ( $scaleX + $scaleY ) / 2;
		$ax = ( $layer['ax'] ?? 0 ) * $scaleX;
		$ay = ( $layer['ay'] ?? 0 ) * $scaleY;
		$cx = ( $layer['cx'] ?? 0 ) * $scaleX;
		$cy = ( $layer['cy'] ?? 0 ) * $scaleY;
		$bx = ( $layer['bx'] ?? 0 ) * $scaleX;
		$by = ( $layer['by'] ?? 0 ) * $scaleY;
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$stroke = $this->withOpacity( (string)( $layer['stroke'] ?? '#000000' ), $opacity );
		$strokeWidth = (int)round( ( $layer['strokeWidth'] ?? 1 ) * $avgScale );

		$args = [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', 'none',
			'-draw', 'line ' . (int)$cx . ',' . (int)$cy . ' ' . (int)$ax . ',' . (int)$ay,
			'-draw', 'line ' . (int)$cx . ',' . (int)$cy . ' ' . (int)$bx . ',' . (int)$by,
		];

		$angle = $this->angleBetween( $ax - $cx, $ay - $cy, $bx - $cx, $by - $cy );
		if ( !empty( $layer['reflexAngle'] ) ) {
			$angle = 360 - $angle;
		}
		$label = isset( $layer['text'] ) && (string)$layer['text'] !== ''
			? $this->safeText( $layer['text'] )
			: round( $angle, 1 ) . '°';

		$fontSize = max( 6, (int)round( ( $layer['fontSize'] ?? 12 ) * $avgScale ) );
		$args = array_merge( $args, [
			'-stroke', 'none',
			'-fill', $this->withOpacity( (string)( $layer['color'] ?? $layer['stroke'] ?? '#000000' ), $opacity ),
			'-font', $this->resolveFont( $layer ),
			'-pointsize', (string)$fontSize,
			'-gravity', 'Center',
			'-annotate', $this->centredOffset( $cx, $cy - $fontSize * 1.5 ),
			$label,
			'-gravity', 'None',
		] );

		return $args;
	}

	/**
	 * Interior angle in degrees between two vectors sharing a vertex.
	 *
	 * @param float $ux First vector x
	 * @param float $uy First vector y
	 * @param float $vx Second vector x
	 * @param float $vy Second vector y
	 * @return float Angle in degrees, 0-180
	 */
	private function angleBetween( float $ux, float $uy, float $vx, float $vy ): float {
		$magU = sqrt( $ux * $ux + $uy * $uy );
		$magV = sqrt( $vx * $vx + $vy * $vy );
		if ( $magU <= 0.0 || $magV <= 0.0 ) {
			return 0.0;
		}
		$cos = max( -1.0, min( 1.0, ( $ux * $vx + $uy * $vy ) / ( $magU * $magV ) ) );
		return rad2deg( acos( $cos ) );
	}

	/**
	 * Imported image layer, composited from its embedded data URL.
	 *
	 * @param array $layer Layer data
	 * @param float $scaleX Horizontal scale
	 * @param float $scaleY Vertical scale
	 * @return array ImageMagick arguments
	 */
	private function buildImageArguments( array $layer, float $scaleX, float $scaleY ): array {
		$path = $this->materializeImageLayer( (string)( $layer['src'] ?? '' ) );
		if ( $path === null ) {
			if ( !in_array( 'image', $this->droppedTypes, true ) ) {
				$this->droppedTypes[] = 'image';
			}
			return [];
		}

		$x = (int)round( ( $layer['x'] ?? 0 ) * $scaleX );
		$y = (int)round( ( $layer['y'] ?? 0 ) * $scaleY );
		$w = (int)round( ( $layer['width'] ?? 0 ) * $scaleX );
		$h = (int)round( ( $layer['height'] ?? 0 ) * $scaleY );

		$args = [ '(', $path ];
		if ( $w > 0 && $h > 0 ) {
			$args[] = '-resize';
			$args[] = $w . 'x' . $h . '!';
		}
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		if ( $opacity < 1.0 ) {
			$args[] = '-alpha';
			$args[] = 'set';
			$args[] = '-channel';
			$args[] = 'A';
			$args[] = '-evaluate';
			$args[] = 'multiply';
			$args[] = (string)max( 0.0, min( 1.0, $opacity ) );
			$args[] = '+channel';
		}
		$args[] = ')';
		$args[] = '-geometry';
		$args[] = sprintf( '%+d%+d', $x, $y );
		$args[] = '-composite';

		return $args;
	}

	/**
	 * Write an image layer's data URL to a temp file ImageMagick can read.
	 *
	 * @param string $src data: URL from the layer
	 * @return string|null Temp file path, or null when the source is unusable
	 */
	private function materializeImageLayer( string $src ): ?string {
		if ( !preg_match( '#^data:image/(png|jpe?g|gif|webp);base64,#i', $src, $m ) ) {
			return null;
		}
		$payload = substr( $src, strpos( $src, ',' ) + 1 );
		$binary = base64_decode( $payload, true );
		if ( $binary === false || $binary === '' ) {
			return null;
		}
		$maxBytes = (int)$this->config->get( 'LayersMaxImageBytes' );
		if ( $maxBytes > 0 && strlen( $binary ) > $maxBytes ) {
			return null;
		}
		$ext = strtolower( $m[1] ) === 'jpg' ? 'jpeg' : strtolower( $m[1] );
		$path = tempnam( sys_get_temp_dir(), 'layers-img-' );
		if ( $path === false ) {
			return null;
		}
		// ImageMagick picks the decoder from the extension, so the format must be
		// stated rather than guessed from content.
		$typed = $path . '.' . $ext;
		if ( file_put_contents( $typed, $binary ) === false ) {
			unlink( $path );
			return null;
		}
		unlink( $path );
		$this->tempFiles[] = $typed;
		return $typed;
	}

	/**
	 * Delete temp files created for image layers during this render.
	 */
	private function cleanupTempFiles(): void {
		foreach ( $this->tempFiles as $path ) {
			if ( is_file( $path ) ) {
				AtEase::quietCall( 'unlink', $path );
			}
		}
		$this->tempFiles = [];
	}

	/**
	 * Shape-library shape, drawn from its SVG path data.
	 *
	 * ImageMagick's `-draw path` takes the same path grammar as SVG, so no SVG
	 * delegate is required. Only `path`/`paths` are drawn: those are character-
	 * whitelisted by ServerSideLayerValidator::validateSvgPath(), which is a
	 * provable safety property. A raw `svg` blob is sanitised by blacklist
	 * instead, so it is still reported as dropped rather than handed to a
	 * server-side renderer.
	 *
	 * @param array $layer Layer data
	 * @param float $scaleX Horizontal scale
	 * @param float $scaleY Vertical scale
	 * @return array ImageMagick arguments
	 */
	private function buildCustomShapeArguments( array $layer, float $scaleX, float $scaleY ): array {
		$x = (int)round( ( $layer['x'] ?? 0 ) * $scaleX );
		$y = (int)round( ( $layer['y'] ?? 0 ) * $scaleY );

		$viewBox = $layer['viewBox'] ?? null;
		if ( !is_array( $viewBox ) || count( $viewBox ) !== 4 ) {
			$viewBox = [ 0, 0, 24, 24 ];
		}
		[ $vbX, $vbY, $vbW, $vbH ] = array_map( 'floatval', $viewBox );
		if ( $vbW <= 0 || $vbH <= 0 ) {
			return $this->dropCustomShape();
		}

		$w = max( 1, (int)round( ( $layer['width'] ?? $vbW ) * $scaleX ) );
		$h = max( 1, (int)round( ( $layer['height'] ?? $vbH ) * $scaleY ) );

		$paths = $this->collectShapePaths( $layer );
		if ( $paths !== [] ) {
			return $this->drawShapePaths( $layer, $paths, $x, $y, $w, $h, $vbX, $vbY, $vbW, $vbH, $scaleX, $scaleY );
		}

		// The bundled library stores whole SVG documents, and 92% of them use
		// groups, transforms or basic shapes that a path extractor would place
		// wrongly. Rendering a shape in the wrong spot is worse than declaring it
		// missing, so those go to a real SVG rasteriser or nowhere.
		$png = $this->rasterizeShapeSvg( (string)( $layer['svg'] ?? '' ), $w, $h );
		if ( $png === null ) {
			return $this->dropCustomShape();
		}

		$args = [ '(', $png ];
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		if ( $opacity < 1.0 ) {
			$args = array_merge( $args, [
				'-alpha', 'set', '-channel', 'A',
				'-evaluate', 'multiply', (string)max( 0.0, min( 1.0, $opacity ) ), '+channel',
			] );
		}
		$args[] = ')';
		$args[] = '-geometry';
		$args[] = sprintf( '%+d%+d', $x, $y );
		$args[] = '-composite';

		return $args;
	}

	/**
	 * Record a custom shape this render could not draw.
	 *
	 * @return array Always empty, for use as a return value
	 */
	private function dropCustomShape(): array {
		if ( !in_array( 'customShape', $this->droppedTypes, true ) ) {
			$this->droppedTypes[] = 'customShape';
		}
		return [];
	}

	/**
	 * Draw a shape supplied as raw path data.
	 *
	 * ImageMagick's `-draw path` takes the same grammar as SVG, so this route
	 * needs no SVG converter. It is preferred when available because the path
	 * data is character-whitelisted, which is a provable safety property.
	 *
	 * @param array $layer Layer data
	 * @param array $paths Normalised path entries
	 * @param int $x Target x in output pixels
	 * @param int $y Target y in output pixels
	 * @param int $w Target width in output pixels
	 * @param int $h Target height in output pixels
	 * @param float $vbX ViewBox origin x
	 * @param float $vbY ViewBox origin y
	 * @param float $vbW ViewBox width
	 * @param float $vbH ViewBox height
	 * @param float $scaleX Horizontal scale
	 * @param float $scaleY Vertical scale
	 * @return array ImageMagick arguments
	 */
	private function drawShapePaths(
		array $layer, array $paths, int $x, int $y, int $w, int $h,
		float $vbX, float $vbY, float $vbW, float $vbH, float $scaleX, float $scaleY
	): array {
		$sx = $w / $vbW;
		$sy = $h / $vbH;
		$opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		$layerFill = (string)( $layer['fill'] ?? '#000000' );
		$layerStroke = (string)( $layer['stroke'] ?? 'none' );
		$strokeWidth = (float)( $layer['strokeWidth'] ?? 0 );
		$fillRule = ( $layer['fillRule'] ?? 'nonzero' ) === 'evenodd' ? 'evenodd' : 'nonzero';

		$transform = sprintf(
			'translate %s,%s scale %s,%s translate %s,%s ',
			$this->num( $x ), $this->num( $y ),
			$this->num( $sx ), $this->num( $sy ),
			$this->num( -$vbX ), $this->num( -$vbY )
		);

		$args = [ '-fill-rule', $fillRule ];
		foreach ( $paths as $entry ) {
			$fill = $this->withOpacity( (string)( $entry['fill'] ?? $layerFill ), $opacity );
			$stroke = $this->withOpacity( (string)( $entry['stroke'] ?? $layerStroke ), $opacity );
			// Stroke width is authored in viewBox units, so it scales with the shape.
			$width = (float)( $entry['strokeWidth'] ?? $strokeWidth );
			$args = array_merge( $args, [
				'-fill', $fill,
				'-stroke', $stroke,
				'-strokewidth', $this->num( $width * ( ( $sx + $sy ) / 2 ) ),
				'-draw', $transform . "path '" . $entry['path'] . "'",
			] );
		}

		return $args;
	}

	/**
	 * Rasterise a shape's SVG document to a temp PNG.
	 *
	 * Uses the wiki's own $wgSVGConverter rather than a hardcoded binary: any
	 * wiki that accepts SVG uploads already runs that converter over untrusted
	 * SVG, so this introduces no new class of exposure and honours whatever the
	 * administrator has hardened. Returns null when no converter is configured,
	 * which leaves the shape declared as dropped exactly as before.
	 *
	 * @param string $svg SVG document from the layer
	 * @param int $width Target width in px
	 * @param int $height Target height in px
	 * @return string|null Temp PNG path, or null when it could not be rendered
	 */
	private function rasterizeShapeSvg( string $svg, int $width, int $height ): ?string {
		if ( $svg === '' || stripos( ltrim( $svg ), '<svg' ) !== 0 ) {
			return null;
		}
		// Entity and DOCTYPE declarations are the XXE vector; the shape library
		// never emits them, so refuse rather than try to clean them.
		if ( preg_match( '/<!DOCTYPE|<!ENTITY/i', $svg ) ) {
			return null;
		}
		$maxSize = (int)$this->configValue( 'SVGMaxSize', 5120 );
		if ( $width > $maxSize || $height > $maxSize ) {
			return null;
		}

		$command = $this->svgConverterCommand();
		if ( $command === null ) {
			return null;
		}

		$base = tempnam( sys_get_temp_dir(), 'layers-shape-' );
		if ( $base === false ) {
			return null;
		}
		$input = $base . '.svg';
		$output = $base . '.png';
		AtEase::quietCall( 'unlink', $base );
		if ( file_put_contents( $input, $svg ) === false ) {
			return null;
		}
		$this->tempFiles[] = $input;
		$this->tempFiles[] = $output;

		$converterPath = (string)$this->configValue( 'SVGConverterPath', '' );
		$prefix = $converterPath !== '' ? rtrim( $converterPath, '/' ) . '/' : '';
		$cmd = str_replace(
			[ '$path/', '$width', '$height', '$input', '$output' ],
			[
				$prefix,
				(string)$width,
				(string)$height,
				Shell::escape( $input ),
				Shell::escape( $output ),
			],
			$command
		);

		try {
			Shell::command( [] )
				->unsafeParams( $cmd )
				->limits( [ 'time' => (int)$this->configValue( 'LayersImageMagickTimeout', 30 ) ] )
				->includeStderr()
				->execute();
		} catch ( \Throwable $e ) {
			if ( $this->logger ) {
				$this->logger->warning( 'Layers: SVG shape rasterise failed', [ 'exception' => $e ] );
			}
			return null;
		}

		return ( is_file( $output ) && filesize( $output ) > 0 ) ? $output : null;
	}

	/**
	 * Resolve the configured SVG converter command template.
	 *
	 * @return string|null Command template, or null when none is usable
	 */
	private function svgConverterCommand(): ?string {
		$name = (string)$this->configValue( 'SVGConverter', '' );
		$converters = $this->configValue( 'SVGConverters', [] );
		if ( $name === '' || !is_array( $converters ) || !isset( $converters[$name] ) ) {
			return null;
		}
		$command = $converters[$name];
		// The ImagickExt entry is a PHP callable, not a shell command.
		return is_string( $command ) ? $command : null;
	}

	/**
	 * Read a config value, tolerating keys the wiki does not define.
	 *
	 * @param string $key Config key
	 * @param mixed $default Value to use when the key is absent
	 * @return mixed Config value or default
	 */
	private function configValue( string $key, $default ) {
		try {
			if ( $this->config->has( $key ) ) {
				return $this->config->get( $key );
			}
		} catch ( \Throwable $e ) {
			// Fall through to the default.
		}
		return $default;
	}

	/**
	 * Normalise the path entries of a custom shape into one list.
	 *
	 * @param array $layer Layer data
	 * @return array List of [ 'path' => string, ... ] entries
	 */
	private function collectShapePaths( array $layer ): array {
		$out = [];
		if ( isset( $layer['paths'] ) && is_array( $layer['paths'] ) ) {
			foreach ( $layer['paths'] as $entry ) {
				if ( is_string( $entry ) && $this->isDrawablePath( $entry ) ) {
					$out[] = [ 'path' => $entry ];
				} elseif ( is_array( $entry ) && isset( $entry['path'] )
					&& $this->isDrawablePath( (string)$entry['path'] )
				) {
					$out[] = $entry;
				}
			}
		}
		if ( $out === [] && isset( $layer['path'] ) && $this->isDrawablePath( (string)$layer['path'] ) ) {
			$out[] = [ 'path' => (string)$layer['path'] ];
		}
		return $out;
	}

	/**
	 * Re-check path data against the same whitelist the validator applied.
	 *
	 * Stored rows predate the current validator and the string is interpolated
	 * into a shell argument, so this is checked again at render time rather than
	 * trusted.
	 *
	 * @param string $path SVG path data
	 * @return bool True when safe to draw
	 */
	private function isDrawablePath( string $path ): bool {
		return $path !== ''
			&& strlen( $path ) <= 10000
			&& preg_match( '/^\s*[Mm]/', $path ) === 1
			&& preg_match( '/^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-+eE]+$/', $path ) === 1;
	}

	/**
	 * Format a float for an ImageMagick draw string without locale surprises.
	 *
	 * @param float $value Value to format
	 * @return string Formatted number
	 */
	private function num( float $value ): string {
		return rtrim( rtrim( number_format( $value, 4, '.', '' ), '0' ), '.' ) ?: '0';
	}

	/**
	 * Convert a color to include the given opacity, returning a form ImageMagick accepts.
	 * Supports #RGB, #RGBA, #RRGGBB, #RRGGBBAA, rgb(), rgba(), 'none'/'transparent'.
	 *
	 * @param string $color Color in various CSS formats
	 * @param float $opacity Opacity value between 0.0 (transparent) and 1.0 (opaque)
	 * @return string Color in rgba() format that ImageMagick can process
	 */
	private function withOpacity( string $color, float $opacity ): string {
		$opacity = max( 0.0, min( 1.0, $opacity ) );
		$lc = strtolower( trim( $color ) );
		if ( $lc === '' ) {
			return $color;
		}
		if ( $lc === 'none' ) {
			return 'none';
		}
		if ( $lc === 'transparent' ) {
			return 'rgba(0,0,0,0)';
		}
		// Hex forms
		if ( $lc[0] === '#' ) {
			$hex = substr( $lc, 1 );
			// RGB -> RRGGBB
			if ( strlen( $hex ) === 3 ) {
				$r = hexdec( str_repeat( $hex[0], 2 ) );
				$g = hexdec( str_repeat( $hex[1], 2 ) );
				$b = hexdec( str_repeat( $hex[2], 2 ) );
				$a = 1.0;
			// RGBA -> RRGGBBAA
			} elseif ( strlen( $hex ) === 4 ) {
				$r = hexdec( str_repeat( $hex[0], 2 ) );
				$g = hexdec( str_repeat( $hex[1], 2 ) );
				$b = hexdec( str_repeat( $hex[2], 2 ) );
				$aa = hexdec( str_repeat( $hex[3], 2 ) );
				$a = $aa / 255.0;
			// RRGGBB
			} elseif ( strlen( $hex ) === 6 ) {
				$r = hexdec( substr( $hex, 0, 2 ) );
				$g = hexdec( substr( $hex, 2, 2 ) );
				$b = hexdec( substr( $hex, 4, 2 ) );
				$a = 1.0;
			// RRGGBBAA
			} elseif ( strlen( $hex ) === 8 ) {
				$r = hexdec( substr( $hex, 0, 2 ) );
				$g = hexdec( substr( $hex, 2, 2 ) );
				$b = hexdec( substr( $hex, 4, 2 ) );
				$aa = hexdec( substr( $hex, 6, 2 ) );
				$a = $aa / 255.0;
			} else {
				return $color;
			}
			$a = max( 0.0, min( 1.0, $a * $opacity ) );
			return sprintf( 'rgba(%d,%d,%d,%.3f)', $r, $g, $b, $a );
		}

		// rgb/rgba forms
		if ( strpos( $lc, 'rgba(' ) === 0 ) {
			$inside = trim( substr( $lc, 5, -1 ) );
			$parts = array_map( 'trim', explode( ',', $inside ) );
			if ( count( $parts ) === 4 ) {
				$r = (int)$parts[0];
				$g = (int)$parts[1];
				$b = (int)$parts[2];
				$a = (float)$parts[3];
				$a = max( 0.0, min( 1.0, $a * $opacity ) );
				return sprintf( 'rgba(%d,%d,%d,%.3f)', $r, $g, $b, $a );
			}
			return $color;
		}
		if ( strpos( $lc, 'rgb(' ) === 0 ) {
			$inside = trim( substr( $lc, 4, -1 ) );
			$parts = array_map( 'trim', explode( ',', $inside ) );
			if ( count( $parts ) === 3 ) {
				$r = (int)$parts[0];
				$g = (int)$parts[1];
				$b = (int)$parts[2];
				$a = max( 0.0, min( 1.0, $opacity ) );
				return sprintf( 'rgba(%d,%d,%d,%.3f)', $r, $g, $b, $a );
			}
			return $color;
		}

		// Named CSS colors → RGB lookup (P2-046)
		// Covers the 17 standard CSS2.1 named colors plus common extras
		// that users are likely to select in the editor
		$namedColors = [
			'black' => [ 0, 0, 0 ],
			'white' => [ 255, 255, 255 ],
			'red' => [ 255, 0, 0 ],
			'green' => [ 0, 128, 0 ],
			'blue' => [ 0, 0, 255 ],
			'yellow' => [ 255, 255, 0 ],
			'cyan' => [ 0, 255, 255 ],
			'magenta' => [ 255, 0, 255 ],
			'silver' => [ 192, 192, 192 ],
			'gray' => [ 128, 128, 128 ],
			'grey' => [ 128, 128, 128 ],
			'maroon' => [ 128, 0, 0 ],
			'olive' => [ 128, 128, 0 ],
			'lime' => [ 0, 255, 0 ],
			'aqua' => [ 0, 255, 255 ],
			'teal' => [ 0, 128, 128 ],
			'navy' => [ 0, 0, 128 ],
			'fuchsia' => [ 255, 0, 255 ],
			'purple' => [ 128, 0, 128 ],
			'orange' => [ 255, 165, 0 ],
			'pink' => [ 255, 192, 203 ],
			'brown' => [ 165, 42, 42 ],
			'coral' => [ 255, 127, 80 ],
			'crimson' => [ 220, 20, 60 ],
			'gold' => [ 255, 215, 0 ],
			'indigo' => [ 75, 0, 130 ],
			'ivory' => [ 255, 255, 240 ],
			'khaki' => [ 240, 230, 140 ],
			'lavender' => [ 230, 230, 250 ],
			'salmon' => [ 250, 128, 114 ],
			'tan' => [ 210, 180, 140 ],
			'tomato' => [ 255, 99, 71 ],
			'turquoise' => [ 64, 224, 208 ],
			'violet' => [ 238, 130, 238 ],
			'wheat' => [ 245, 222, 179 ],
		];

		if ( isset( $namedColors[$lc] ) ) {
			[ $r, $g, $b ] = $namedColors[$lc];
			$a = max( 0.0, min( 1.0, $opacity ) );
			return sprintf( 'rgba(%d,%d,%d,%.3f)', $r, $g, $b, $a );
		}

		// Unknown color format. Keep original to avoid unexpected color changes.
		return $color;
	}
}
