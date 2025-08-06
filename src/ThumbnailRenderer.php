<?php
/**
 * Server-side thumbnail renderer for layered images
 * This is the MOST CRITICAL missing piece
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers;

use Exception;
use File;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\MediaWikiServices;

class ThumbnailRenderer {

	private $config;
	private $layersDb;

	public function __construct() {
		$this->config = MediaWikiServices::getInstance()->getMainConfig();
		$this->layersDb = new LayersDatabase();
	}

	/**
	 * Generate thumbnail with layers overlaid
	 *
	 * @param File $file
	 * @param array $params Transform parameters
	 * @return string|false Path to generated thumbnail or false on failure
	 */
	public function generateLayeredThumbnail( File $file, array $params ) {
		// Check if layers are requested
		if ( empty( $params['layers'] ) ) {
			return false; // Let normal thumbnail generation handle this
		}

		try {
			// Get layer data
			$layerSets = $this->layersDb->getLayerSetsForImage(
				$file->getName(),
				$file->getSha1()
 );

			if ( empty( $layerSets ) ) {
				return false; // No layers found
			}

			// Use the latest layer set
			$layerSet = $layerSets[0];
			$layers = json_decode( $layerSet['json_blob'], true );

			if ( !$layers || empty( $layers['layers'] ) ) {
				return false;
			}

			// Generate base thumbnail first
			$baseThumbnail = $file->transform( array_diff_key( $params, [ 'layers' => null ] ) );
			if ( !$baseThumbnail || $baseThumbnail->isError() ) {
				return false;
			}

			// Create output path
			$thumbDir = $this->config->get( 'UploadDirectory' ) . '/thumb/layers';
			if ( !is_dir( $thumbDir ) ) {
				mkdir( $thumbDir, 0755, true );
			}

			$outputPath = $thumbDir . '/' . $file->getSha1() . '_' .
						 md5( serialize( $params ) ) . '.png';

			// Check if already exists
			if ( file_exists( $outputPath ) ) {
				return $outputPath;
			}

			// Render layers on top of base image
			if ( $this->overlayLayers( $baseThumbnail->getLocalCopyPath(), $layers['layers'], $outputPath ) ) {
				return $outputPath;
			}

		} catch ( Exception $e ) {
			wfLogWarning( 'Layers: Thumbnail generation failed: ' . $e->getMessage() );
		}

		return false;
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

		// Start with base image
		$cmd = wfEscapeShellArg( $convert ) . ' ' . wfEscapeShellArg( $basePath );

		// Add each layer
		foreach ( $layers as $layer ) {
			if ( $layer['visible'] === false ) {
				continue;
			}

			$cmd .= $this->buildLayerCommand( $layer );
		}

		// Output to final path
		$cmd .= ' ' . wfEscapeShellArg( $outputPath );

		// Execute command
		$retval = null;
		$output = wfShellExec( $cmd, $retval );

		if ( $retval !== 0 ) {
			wfLogWarning( "Layers: ImageMagick command failed: $cmd (exit code: $retval)" );
			return false;
		}

		return file_exists( $outputPath );
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
			wfEscapeShellArg( $fill ),
			wfEscapeShellArg( $font ),
			(int)$x,
			(int)$y,
			wfEscapeShellArg( $text )
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
			wfEscapeShellArg( $stroke ),
			(int)$strokeWidth,
			wfEscapeShellArg( $fill ),
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
			wfEscapeShellArg( $stroke ),
			(int)$strokeWidth,
			wfEscapeShellArg( $fill ),
			(int)$x,
			(int)$y,
			(int)( $x + $radius ),
			(int)$y
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
			wfEscapeShellArg( $stroke ),
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
			' -stroke %s -strokewidth %d -draw "line %d,%d %d,%d" -draw "line %d,%d %d,%d"',
			wfEscapeShellArg( $stroke ),
			(int)$strokeWidth,
			(int)$x2, (int)$y2, (int)$arrowX1, (int)$arrowY1,
			(int)$x2, (int)$y2, (int)$arrowX2, (int)$arrowY2
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
