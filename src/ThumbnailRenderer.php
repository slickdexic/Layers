<?php
/**
 * Server-side thumbnail renderer for layered images
 * This is the MOST CRITICAL missing piece
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers;

use Config;
use Exception;
use File;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\MediaWikiServices;
use MediaWiki\Shell\Shell;
use Psr\Log\LoggerInterface;

class ThumbnailRenderer {
	/** @var Config */
	private $config;
	private $layersDb;
	/** @var LoggerInterface */
	private $logger;

	public function __construct() {
		$this->config = MediaWikiServices::getInstance()->getMainConfig();
		$this->layersDb = new LayersDatabase();
		// TODO: Fix logger initialization for MediaWiki 1.44
		$this->logger = null;
	}

	/**
	 * Generate thumbnail with layers overlaid
	 *
	 * @param File $file
	 * @param array $params Transform parameters
	 * @return string|false Path to generated thumbnail or false on failure
	 */
	public function generateLayeredThumbnail( File $file, array $params ) {
		// Check if layers are requested and data is available
		if ( empty( $params['layers'] ) || empty( $params['layerData'] ) ) {
			return null; // Let normal thumbnail generation handle this
		}

		try {
			$layers = $params['layerData']; // Expects a pre-processed array of layers

			if ( empty( $layers ) ) {
				return null; // No layers to draw
			}

			// Generate base thumbnail first, removing our custom params
			$baseParams = $params;
			unset( $baseParams['layers'], $baseParams['layerSetId'], $baseParams['layerData'] );
			$baseThumbnail = $file->transform( $baseParams );

			if ( !$baseThumbnail || $baseThumbnail->isError() ) {
				if ( $this->logger ) {
					$this->logger->warning( 'Base thumbnail generation failed.' );
				}
				return null;
			}

			// Create output path
			$thumbDir = $this->config->get( 'UploadDirectory' ) . '/thumb/layers';
			if ( !is_dir( $thumbDir ) ) {
				mkdir( $thumbDir, 0755, true );
			}

			$outputPath = $thumbDir . '/' . $file->getSha1() . '_' .
						 md5( serialize( $params ) ) . '.png';

			// Check if already exists (caching)
			if ( file_exists( $outputPath ) ) {
				return $outputPath;
			}

			// Render layers on top of base image
			$basePath = $baseThumbnail->getLocalCopyPath();

			if ( $this->overlayLayers( $basePath, $layers, $outputPath ) ) {
				return $outputPath;
			}

		} catch ( Exception $e ) {
			error_log( 'Layers: Exception in generateLayeredThumbnail: ' . $e->getMessage() );
			if ( $this->logger ) {
				$this->logger->warning( 'Thumbnail generation failed: {message}', [ 'message' => $e->getMessage() ] );
			}
		}

		return null;
	}

	/**
	 * Use ImageMagick to overlay layers on base image
	 *
	 * @param string $basePath
	 * @param array $layers
	 * @param string $outputPath
	 * @return bool
	 */
	private function overlayLayers( string $basePath, array $layers, string $outputPath ): bool {
		// Check ImageMagick availability
		if ( !$this->config->get( 'UseImageMagick' ) ) {
			return false;
		}

		$convert = $this->config->get( 'ImageMagickConvertCommand' );
		if ( !$convert ) {
			return false;
		}

		// Build command arguments array
		$args = [ $convert, $basePath ];

		// Add each layer
		foreach ( $layers as $layer ) {
			if ( ( $layer['visible'] ?? true ) === false ) {
				continue;
			}

			$layerArgs = $this->buildLayerArguments( $layer );
			$args = array_merge( $args, $layerArgs );
		}

		// Add output path
		$args[] = $outputPath;

		// Execute command
		$result = Shell::command( $args )->execute();
		$retval = $result->getExitCode();

		if ( $retval !== 0 ) {
			error_log( 'Layers: ImageMagick failed with exit code ' . $retval . ': ' . $result->getStderr() );
			if ( $this->logger ) {
				$this->logger->warning(
					'ImageMagick command failed with exit code {retval}. Args: {args} Stderr: {stderr}',
					[
						'retval' => $retval,
						'args' => $args,
						'stderr' => $result->getStderr()
					]
				);
			}
			return false;
		}

		return file_exists( $outputPath );
	}

	/**
	 * Build ImageMagick arguments array for individual layer
	 *
	 * @param array $layer
	 * @return array
	 */
	private function buildLayerArguments( array $layer ): array {
		switch ( $layer['type'] ) {
			case 'text':
				return $this->buildTextArguments( $layer );
			case 'rectangle':
				return $this->buildRectangleArguments( $layer );
			case 'circle':
				return $this->buildCircleArguments( $layer );
			case 'ellipse':
				return $this->buildEllipseArguments( $layer );
			case 'polygon':
				return $this->buildPolygonArguments( $layer );
			case 'star':
				return $this->buildStarArguments( $layer );
			case 'path':
				return $this->buildPathArguments( $layer );
			case 'arrow':
				return $this->buildArrowArguments( $layer );
			case 'line':
				return $this->buildLineArguments( $layer );
			case 'highlight':
				return $this->buildHighlightArguments( $layer );
			default:
				return [];
		}
	}

	/**
	 * Build ImageMagick command for individual layer
	 *
	 * @param array $layer
	 * @return string
	 */
	private function buildLayerCommand( array $layer ): string {
		$cmd = '';

		switch ( $layer['type'] ) {
			case 'text':
				$cmd .= $this->buildTextCommand( $layer );
				break;
			case 'rectangle':
				$cmd .= $this->buildRectangleCommand( $layer );
				break;
			case 'circle':
				$cmd .= $this->buildCircleCommand( $layer );
				break;
			case 'ellipse':
				$cmd .= $this->buildEllipseCommand( $layer );
				break;
			case 'polygon':
				$cmd .= $this->buildPolygonCommand( $layer );
				break;
			case 'star':
				$cmd .= $this->buildStarCommand( $layer );
				break;
			case 'path':
				$cmd .= $this->buildPathCommand( $layer );
				break;
			case 'arrow':
				$cmd .= $this->buildArrowCommand( $layer );
				break;
			case 'line':
				$cmd .= $this->buildLineCommand( $layer );
				break;
			case 'highlight':
				$cmd .= $this->buildHighlightCommand( $layer );
				break;
		}

		return $cmd;
	}

	/**
	 * Build text layer arguments
	 */
	private function buildTextArguments( array $layer ): array {
		$x = $layer['x'] ?? 0;
		$y = $layer['y'] ?? 0;
		$text = $layer['text'] ?? '';
		$fontSize = $layer['fontSize'] ?? 14;
		$fill = $layer['fill'] ?? '#000000';
		$font = $layer['fontFamily'] ?? 'DejaVu-Sans'; // Use a font that exists in most systems

		return [
			'-pointsize', (string)(int)$fontSize,
			'-fill', $fill,
			'-font', $font,
			'-annotate', '+' . (int)$x . '+' . (int)$y,
			$text
		];
	}

	// Placeholder methods for other layer types
	private function buildRectangleArguments( array $layer ): array {
 return [];
	}

	private function buildCircleArguments( array $layer ): array {
 return [];
	}

	private function buildEllipseArguments( array $layer ): array {
 return [];
	}

	private function buildPolygonArguments( array $layer ): array {
 return [];
	}

	private function buildStarArguments( array $layer ): array {
 return [];
	}

	private function buildPathArguments( array $layer ): array {
 return [];
	}

	private function buildArrowArguments( array $layer ): array {
 return [];
	}

	private function buildLineArguments( array $layer ): array {
 return [];
	}

	private function buildHighlightArguments( array $layer ): array {
 return [];
	}

	private function buildTextCommand( array $layer ): string {
		$x = $layer['x'] ?? 0;
		$y = $layer['y'] ?? 0;
		$text = $layer['text'] ?? '';
		$fontSize = $layer['fontSize'] ?? 14;
		$fill = $layer['fill'] ?? '#000000';
		$font = $layer['fontFamily'] ?? 'Arial';

		return sprintf(
			' -pointsize %d -fill %s -font %s -annotate +%d+%d %s',
			(int)$fontSize,
			Shell::escape( $fill ),
			Shell::escape( $font ),
			(int)$x,
			(int)$y,
			Shell::escape( $text )
		);
	}

	private function buildRectangleCommand( array $layer ): string {
		$x = $layer['x'] ?? 0;
		$y = $layer['y'] ?? 0;
		$width = $layer['width'] ?? 100;
		$height = $layer['height'] ?? 100;
		$stroke = $layer['stroke'] ?? '#000000';
		$strokeWidth = $layer['strokeWidth'] ?? 1;
		$fill = $layer['fill'] ?? 'none';

		return sprintf(
			' -stroke %s -strokewidth %d -fill %s -draw "rectangle %d,%d %d,%d"',
			Shell::escape( $stroke ),
			(int)$strokeWidth,
			Shell::escape( $fill ),
			(int)$x,
			(int)$y,
			(int)( $x + $width ),
			(int)( $y + $height )
		);
	}

	private function buildCircleCommand( array $layer ): string {
		$x = $layer['x'] ?? 0;
		$y = $layer['y'] ?? 0;
		$radius = $layer['radius'] ?? 50;
		$stroke = $layer['stroke'] ?? '#000000';
		$strokeWidth = $layer['strokeWidth'] ?? 1;
		$fill = $layer['fill'] ?? 'none';

		return sprintf(
			' -stroke %s -strokewidth %d -fill %s -draw "circle %d,%d %d,%d"',
			Shell::escape( $stroke ),
			(int)$strokeWidth,
			Shell::escape( $fill ),
			(int)$x,
			(int)$y,
			(int)( $x + $radius ),
			(int)$y
		);
	}

	private function buildEllipseCommand( array $layer ): string {
		$x = $layer['x'] ?? 0;
		$y = $layer['y'] ?? 0;
		$radiusX = $layer['radiusX'] ?? 50;
		$radiusY = $layer['radiusY'] ?? 25;
		$stroke = $layer['stroke'] ?? '#000000';
		$strokeWidth = $layer['strokeWidth'] ?? 1;
		$fill = $layer['fill'] ?? 'none';

		return sprintf(
			' -stroke %s -strokewidth %d -fill %s -draw "ellipse %d,%d %d,%d 0,360"',
			Shell::escape( $stroke ),
			(int)$strokeWidth,
			Shell::escape( $fill ),
			(int)$x,
			(int)$y,
			(int)$radiusX,
			(int)$radiusY
		);
	}

	private function buildPolygonCommand( array $layer ): string {
		$x = $layer['x'] ?? 0;
		$y = $layer['y'] ?? 0;
		$radius = $layer['radius'] ?? 50;
		$sides = $layer['sides'] ?? 6;
		$stroke = $layer['stroke'] ?? '#000000';
		$strokeWidth = $layer['strokeWidth'] ?? 1;
		$fill = $layer['fill'] ?? 'none';

		$points = [];
		for ( $i = 0; $i < $sides; $i++ ) {
			$angle = ( $i * 2 * M_PI / $sides ) - ( M_PI / 2 );
			$points[] = (int)( $x + $radius * cos( $angle ) );
			$points[] = (int)( $y + $radius * sin( $angle ) );
		}

		return sprintf(
			' -stroke %s -strokewidth %d -fill %s -draw "polygon %s"',
			Shell::escape( $stroke ),
			(int)$strokeWidth,
			Shell::escape( $fill ),
			implode( ' ', $points )
		);
	}

	private function buildStarCommand( array $layer ): string {
		$x = $layer['x'] ?? 0;
		$y = $layer['y'] ?? 0;
		$outerRadius = $layer['outerRadius'] ?? 50;
		$innerRadius = $layer['innerRadius'] ?? 25;
		$numPoints = $layer['points'] ?? 5;
		$stroke = $layer['stroke'] ?? '#000000';
		$strokeWidth = $layer['strokeWidth'] ?? 1;
		$fill = $layer['fill'] ?? 'none';

		$points = [];
		for ( $i = 0; $i < $numPoints * 2; $i++ ) {
			$radius = ( $i % 2 == 0 ) ? $outerRadius : $innerRadius;
			$angle = ( $i * M_PI / $numPoints ) - ( M_PI / 2 );
			$points[] = (int)( $x + $radius * cos( $angle ) );
			$points[] = (int)( $y + $radius * sin( $angle ) );
		}

		return sprintf(
			' -stroke %s -strokewidth %d -fill %s -draw "polygon %s"',
			Shell::escape( $stroke ),
			(int)$strokeWidth,
			Shell::escape( $fill ),
			implode( ' ', $points )
		);
	}

	private function buildPathCommand( array $layer ): string {
		$points = $layer['points'] ?? [];
		if ( count( $points ) < 2 ) {
			return '';
		}
		$stroke = $layer['stroke'] ?? '#000000';
		$strokeWidth = $layer['strokeWidth'] ?? 1;
		$fill = $layer['fill'] ?? 'none';

		$pathString = 'M ' . (int)$points[0]['x'] . ',' . (int)$points[0]['y'];
		for ( $i = 1; $i < count( $points ); $i++ ) {
			$pathString .= ' L ' . (int)$points[$i]['x'] . ',' . (int)$points[$i]['y'];
		}

		return sprintf(
			' -stroke %s -strokewidth %d -fill %s -draw "path \'%s\'"',
			Shell::escape( $stroke ),
			(int)$strokeWidth,
			Shell::escape( $fill ),
			$pathString
		);
	}

	private function buildLineCommand( array $layer ): string {
		$x1 = $layer['x1'] ?? 0;
		$y1 = $layer['y1'] ?? 0;
		$x2 = $layer['x2'] ?? 100;
		$y2 = $layer['y2'] ?? 100;
		$stroke = $layer['stroke'] ?? '#000000';
		$strokeWidth = $layer['strokeWidth'] ?? 1;

		return sprintf(
			' -stroke %s -strokewidth %d -draw "line %d,%d %d,%d"',
			Shell::escape( $stroke ),
			(int)$strokeWidth,
			(int)$x1,
			(int)$y1,
			(int)$x2,
			(int)$y2
		);
	}

	private function buildArrowCommand( array $layer ): string {
		// Simplified arrow as line + arrowhead
		$lineCmd = $this->buildLineCommand( $layer );

		$x2 = $layer['x2'] ?? 100;
		$y2 = $layer['y2'] ?? 100;
		$x1 = $layer['x1'] ?? 0;
		$y1 = $layer['y1'] ?? 0;
		$stroke = $layer['stroke'] ?? '#000000';
		$strokeWidth = $layer['strokeWidth'] ?? 1;

		// Calculate arrowhead
		$angle = atan2( $y2 - $y1, $x2 - $x1 );
		$arrowLength = 10;
		$arrowAngle = 0.5;

		$arrowX1 = $x2 - $arrowLength * cos( $angle - $arrowAngle );
		$arrowY1 = $y2 - $arrowLength * sin( $angle - $arrowAngle );
		$arrowX2 = $x2 - $arrowLength * cos( $angle + $arrowAngle );
		$arrowY2 = $y2 - $arrowLength * sin( $angle + $arrowAngle );

		$arrowCmd = sprintf(
			' -fill %s -stroke %s -strokewidth %d -draw "polygon %d,%d %d,%d %d,%d"',
			Shell::escape( $stroke ),
			Shell::escape( $stroke ),
			(int)$strokeWidth,
			(int)$x2, (int)$y2, (int)$arrowX1, (int)$arrowY1, (int)$arrowX2, (int)$arrowY2
		);

		return $lineCmd . $arrowCmd;
	}

	private function buildHighlightCommand( array $layer ): string {
		// Semi-transparent rectangle
		$layer['fill'] = $layer['fill'] ?? '#ffff0080'; // Yellow with alpha
		$layer['stroke'] = 'none';
		return $this->buildRectangleCommand( $layer );
	}
}
