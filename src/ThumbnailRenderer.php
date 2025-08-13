<?php
/**
 * Server-side thumbnail renderer for layered images
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers;

use Exception;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use Psr\Log\LoggerInterface;

class ThumbnailRenderer {
	/** @var mixed */
	private $config;

	/** @var LayersDatabase */
	private $layersDb;

	/** @var LoggerInterface|null */
	private $logger;

	public function __construct() {
		$services = \is_callable( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
			? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
			: null;
		$this->config = $services ? $services->getMainConfig() : null;
		$this->layersDb = new LayersDatabase();
		$this->logger = \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' )
			? \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' )
			: null;
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

			$uploadDir = $this->config ? $this->config->get( 'UploadDirectory' ) : sys_get_temp_dir();
			$thumbDir = rtrim( $uploadDir, '/\\' ) . '/thumb/layers';
			if ( !is_dir( $thumbDir ) ) {
				$ok = mkdir( $thumbDir, 0755, true );
				if ( !$ok && !is_dir( $thumbDir ) ) {
					if ( $this->logger ) {
						$this->logger->error( 'Layers: failed to create thumb directory', [ 'dir' => $thumbDir ] );
					}
					return null;
				}
			}

			$outputPath = $thumbDir . '/' . $file->getSha1() . '_' . md5( serialize( $params ) ) . '.png';
			if ( file_exists( $outputPath ) ) {
				return $outputPath;
			}

			$basePath = method_exists( $baseThumb, 'getLocalCopyPath' )
				? $baseThumb->getLocalCopyPath()
				: ( $baseThumb->getFile() ? $baseThumb->getFile()->getLocalRefPath() : null );
			if ( !$basePath ) {
				return null;
			}

			// Determine scale from original to target dimensions
			$origW = method_exists( $file, 'getWidth' ) ? (int)$file->getWidth() : 0;
			$origH = method_exists( $file, 'getHeight' ) ? (int)$file->getHeight() : 0;
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

			if ( $this->overlayLayers( $basePath, $layers, $outputPath, $scaleX, $scaleY ) ) {
				return $outputPath;
			}
		} catch ( Exception $e ) {
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
		float $scaleY
	): bool {
		if ( !$this->config || !$this->config->get( 'UseImageMagick' ) ) {
			return false;
		}
		$convert = $this->config->get( 'ImageMagickConvertCommand' );
		if ( !$convert ) {
			return false;
		}

		$args = [ $convert, $basePath ];

		foreach ( $layers as $layer ) {
			if ( ( $layer['visible'] ?? true ) === false ) {
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

		if ( \class_exists( '\\MediaWiki\\Shell\\Shell' ) ) {
			try {
				$result = \call_user_func( [ '\\MediaWiki\\Shell\\Shell', 'command' ], ...$args )
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
			}
		} else {
			// Shell not available; cannot safely execute ImageMagick
			if ( $this->logger ) {
				$this->logger->warning( 'Layers: Shell class not available; skipping overlay' );
			}
			return false;
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
			case 'highlight':
				return $this->buildHighlightArguments( $layer, $scaleX, $scaleY );
			default:
				return [];
		}
	}

	   private function buildTextArguments( array $layer, float $scaleX, float $scaleY ): array {
		   $x = ( $layer['x'] ?? 0 ) * $scaleX;
		   $y = ( $layer['y'] ?? 0 ) * $scaleY;
		   $text = (string)( $layer['text'] ?? '' );
		   $fontSize = (int)round( ( $layer['fontSize'] ?? 14 ) * ( ( $scaleX + $scaleY ) / 2 ) );
		   $fill = (string)( $layer['fill'] ?? '#000000' );
		   $opacity = isset( $layer['opacity'] ) ? (float)$layer['opacity'] : 1.0;
		   $fill = $this->withOpacity( $fill, $opacity );
		   $font = (string)( $layer['fontFamily'] ?? 'DejaVu-Sans' );

		   $args = [];
		   // Shadow support
		   if ( !empty( $layer['shadow'] ) ) {
			   $shadowColor = $layer['shadowColor'] ?? 'rgba(0,0,0,0.4)';
			   $shadowBlur = $layer['shadowBlur'] ?? 8;
			   $shadowOffsetX = $layer['shadowOffsetX'] ?? 2;
			   $shadowOffsetY = $layer['shadowOffsetY'] ?? 2;
			   $shadowColor = $this->withOpacity( $shadowColor, 1.0 );
			   $args = array_merge( $args, [
				   '-fill', $shadowColor,
				   '-pointsize', (string)$fontSize,
				   '-font', $font,
				   '-annotate', '+' . (int)($x + $shadowOffsetX) . '+' . (int)($y + $shadowOffsetY),
				   $text,
				   '-blur', '0x' . (int)$shadowBlur
			   ] );
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
		   if ( !empty( $layer['shadow'] ) ) {
			   $shadowColor = $layer['shadowColor'] ?? 'rgba(0,0,0,0.4)';
			   $shadowBlur = $layer['shadowBlur'] ?? 8;
			   $shadowOffsetX = $layer['shadowOffsetX'] ?? 2;
			   $shadowOffsetY = $layer['shadowOffsetY'] ?? 2;
			   $shadowColor = $this->withOpacity( $shadowColor, 1.0 );
			   $args = array_merge( $args, [
				   '-fill', $shadowColor,
				   '-draw', 'rectangle ' . (int)($x + $shadowOffsetX) . ',' . (int)($y + $shadowOffsetY) . ' ' . (int)($x + $width + $shadowOffsetX) . ',' . (int)($y + $height + $shadowOffsetY),
				   '-blur', '0x' . (int)$shadowBlur
			   ] );
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
		   if ( !empty( $layer['shadow'] ) ) {
			   $shadowColor = $layer['shadowColor'] ?? 'rgba(0,0,0,0.4)';
			   $shadowBlur = $layer['shadowBlur'] ?? 8;
			   $shadowOffsetX = $layer['shadowOffsetX'] ?? 2;
			   $shadowOffsetY = $layer['shadowOffsetY'] ?? 2;
			   $shadowColor = $this->withOpacity( $shadowColor, 1.0 );
			   $args = array_merge( $args, [
				   '-fill', $shadowColor,
				   '-draw', 'circle ' . (int)($x + $shadowOffsetX) . ',' . (int)($y + $shadowOffsetY) . ' ' . (int)($x + $radius + $shadowOffsetX) . ',' . (int)($y + $shadowOffsetY),
				   '-blur', '0x' . (int)$shadowBlur
			   ] );
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

		return [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'ellipse ' . (int)$x . ',' . (int)$y . ' ' . (int)$radiusX . ',' . (int)$radiusY . ' 0,360'
		];
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

		return [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'polygon ' . implode( ' ', $pts )
		];
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

		return [
			'-stroke', $stroke,
			'-strokewidth', (string)$strokeWidth,
			'-fill', $fill,
			'-draw', 'polygon ' . implode( ' ', $pts )
		];
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

	private function buildHighlightArguments( array $layer, float $scaleX, float $scaleY ): array {
		$layer['fill'] = $layer['fill'] ?? '#ffff0080';
		$layer['stroke'] = 'none';
		// Respect layer opacity if set
		if ( isset( $layer['opacity'] ) ) {
			$layer['fill'] = $this->withOpacity( (string)$layer['fill'], (float)$layer['opacity'] );
		}
		return $this->buildRectangleArguments( $layer, $scaleX, $scaleY );
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

		// Unknown (e.g., named colors). Best effort: if opacity < 1, return rgba black with that opacity? No.
		// Keep original to avoid unexpected color changes.
		return $color;
	}
}
