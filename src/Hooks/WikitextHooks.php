<?php
/**
 * Wikitext parser integration for layers parameter
 * Handles [[File:Example.jpg|layers=on]] syntax
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks;

use Exception;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\ThumbnailRenderer;

class WikitextHooks {

	/**
	 * Handle file parameter parsing in wikitext
	 * Called when MediaWiki processes [[File:...]] syntax
	 *
	 * @param object $title
	 * @param object $file
	 * @param array &$params
	 * @param object $parser
	 * @return bool
	 */
	/**
	 * Handle wikitext after parsing to find and replace layer image syntax
	 * This catches [[File:Example.jpg|layers=on]] after MediaWiki has processed it
	 *
	 * @param object $parser
	 * @param string &$text
	 * @param object $stripState
	 * @return bool
	 */

	/**
	 * Register parser functions and hooks
	 * @param Parser $parser The parser object
	 * @return bool
	 */
	public static function onParserFirstCallInit( $parser ): bool {
		// Register a parser function to handle layered images
		$parser->setFunctionHook( 'layeredfile', [ self::class, 'renderLayeredFile' ], \Parser::SFH_OBJECT_ARGS );
		return true;
	}

	/**
	 * Render a file with layers
	 * Usage: {{#layeredfile:ImageTest02.jpg|500px|layers=on|caption}}
	 * @param Parser $parser The parser object
	 * @param PPFrame $frame The frame object
	 * @param array $args The arguments array
	 * @return string
	 */
	public static function renderLayeredFile( $parser, $frame, $args ) {
		try {
			// Parse arguments - first is filename, rest are key=value or simple values
			if ( empty( $args ) ) {
				return '<span class="error">No filename specified</span>';
			}

			$filename = isset( $args[0] ) ? trim( $frame->expand( $args[0] ) ) : '';
			$size = isset( $args[1] ) ? trim( $frame->expand( $args[1] ) ) : '';
			$layersArg = isset( $args[2] ) ? trim( $frame->expand( $args[2] ) ) : '';
			$caption = isset( $args[3] ) ? trim( $frame->expand( $args[3] ) ) : '';

			if ( empty( $filename ) ) {
				return '<span class="error">No filename specified</span>';
			}

			// Parse the layers parameter
			$layersParam = 'off'; // default to off
			if ( !empty( $layersArg ) && strpos( $layersArg, 'layers=' ) === 0 ) {
				$layersParam = substr( $layersArg, 7 ); // Remove 'layers=' prefix
			} elseif ( $layersArg === 'layers' || $layersArg === 'on' ) {
				$layersParam = 'on';
			}

			// Get the file
			$services = \MediaWiki\MediaWikiServices::getInstance();
			$repoGroup = $services->getRepoGroup();
			$file = $repoGroup->findFile( $filename );

			if ( !$file ) {
				return '<span class="error">File not found: ' . htmlspecialchars( $filename ) . '</span>';
			}

			// If layers are not requested, fall back to normal image display
			if ( $layersParam === 'off' ) {
				return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
			}

			// Check for layer data
			$db = new LayersDatabase();
			$layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );

			if ( empty( $layerSets ) ) {
				// Fall back to normal image display
				return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );
			}

			// Parse size parameter
			$width = 300; // default
			if ( preg_match( '/(\d+)px/', $size, $sizeMatch ) ) {
				$width = intval( $sizeMatch[1] );
			} elseif ( preg_match( '/x(\d+)px/', $size, $sizeMatch ) ) {
				$width = intval( $sizeMatch[1] );
			} elseif ( $size === 'thumb' ) {
				$width = 220; // MediaWiki default thumb size
			}

			// Generate layered thumbnail
			$layeredSrc = self::generateLayeredThumbnailUrl( $filename, $width, $layersParam );

			if ( $layeredSrc ) {
				// Generate HTML for layered image
				$alt = !empty( $caption ) ? htmlspecialchars( $caption ) : htmlspecialchars( $filename );
				$title = !empty( $caption ) ? htmlspecialchars( $caption ) : '';

				return '<span class="mw-default-size" typeof="mw:File">' .
					   '<a href="/index.php/File:' . htmlspecialchars( $filename ) . '" class="mw-file-description"' .
					   ( $title ? ' title="' . $title . '"' : '' ) . '>' .
					   '<img alt="' . $alt . '" src="' . htmlspecialchars( $layeredSrc ) . '" ' .
					   'decoding="async" width="' . $width . '" class="mw-file-element" />' .
					   '</a></span>';
			}

			// Fall back to normal image display
			return $parser->recursiveTagParse( "[[File:$filename|$size|$caption]]", $frame );

		} catch ( Exception $e ) {
			error_log( 'Layers: renderLayeredFile error: ' . $e->getMessage() );
			return '<span class="error">Error rendering layered file</span>';
		}
	}

	/**
	 * Generate URL for layered thumbnail
	 * @param string $filename The filename to generate URL for
	 * @param int $width The width for the thumbnail
	 * @param string $layersParam The layers parameter
	 * @return string|null
	 */
	private static function generateLayeredThumbnailUrl( $filename, $width, $layersParam ) {
		try {
			$services = \MediaWiki\MediaWikiServices::getInstance();
			$repoGroup = $services->getRepoGroup();
			$file = $repoGroup->findFile( $filename );

			if ( !$file ) {
				return null;
			}

			// Get layer data
			$db = new LayersDatabase();
			$layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );

			if ( empty( $layerSets ) ) {
				return null;
			}

			// Find the right layer set
			$selectedLayerSet = $layerSets[0]; // Default to first

			if ( $layersParam !== 'on' ) {
				foreach ( $layerSets as $layerSet ) {
					if ( $layerSet['ls_name'] === $layersParam ) {
						$selectedLayerSet = $layerSet;
						break;
					}
				}
			}

			// Generate layered thumbnail
			$params = [
				'width' => intval( $width ),
				'layers' => 'on',
				'layerSetId' => $selectedLayerSet['ls_id'],
				'layerData' => json_decode( $selectedLayerSet['ls_json_blob'], true )['layers']
			];

			$renderer = new ThumbnailRenderer();
			$layeredPath = $renderer->generateLayeredThumbnail( $file, $params );

			if ( $layeredPath ) {
				// Convert local path to URL
				$config = $services->getMainConfig();
				$uploadDirectory = $config->get( 'UploadDirectory' );
				$uploadPath = $config->get( 'UploadPath' );

				// Replace the upload directory with the upload path to get URL
				$relativePath = str_replace( $uploadDirectory, '', $layeredPath );
				$url = $uploadPath . $relativePath;

				return $url;
			}

		} catch ( Exception $e ) {
			error_log( 'Layers: generateLayeredThumbnailUrl error: ' . $e->getMessage() );
		}

		return null;
	}

	/**
	 * Handle file link parameters
	 * This handles the actual file link generation with layers
	 *
	 * @param object $file
	 * @param array &$params
	 * @param object $parser
	 * @param array &$time
	 * @param array &$descQuery
	 * @param array &$query
	 * @return bool
	 */
	public static function onFileLink( $file, array &$params, $parser, array &$time, array &$descQuery, array &$query ): bool {
		// If this file has layers enabled, add query parameters for the file page
		if ( isset( $params['layers'] ) && $params['layers'] !== 'off' ) {
			$query['layers'] = $params['layers'];
		}

		return true;
	}
}
