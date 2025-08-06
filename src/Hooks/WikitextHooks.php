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
	public static function onParserMakeImageParams( $title, $file, array &$params, $parser ): bool {
		try {
			// Look for layers parameter in the params array
			$layersParam = null;

			// Check various ways the layers parameter might be specified
			if ( isset( $params['layers'] ) ) {
				$layersParam = $params['layers'];
			} elseif ( isset( $params['handler']['layers'] ) ) {
				$layersParam = $params['handler']['layers'];
			} else {
				// Check if any of the manual parameters contain "layers"
				foreach ( $params['manual_thumb'] ?? [] as $key => $value ) {
					if ( strpos( $key, 'layers' ) !== false ) {
						$layersParam = $value;
						break;
					}
				}
			}

			// If no layers parameter found, continue normal processing
			if ( $layersParam === null ) {
				return true;
			}

			// Don't process if explicitly disabled
			if ( $layersParam === 'off' || $layersParam === 'false' ) {
				return true;
			}

			// Get layer data for this file
			$db = new LayersDatabase();
			$layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );

			if ( empty( $layerSets ) ) {
				// No layer data found, continue normal processing
				return true;
			}

			// Use the latest layer set by default
			$selectedLayerSet = $layerSets[0];

			// Handle specific layer set selection
			if ( $layersParam !== 'on' && $layersParam !== true ) {
				if ( strpos( $layersParam, 'id:' ) === 0 ) {
					$layerSetId = (int)substr( $layersParam, 3 );
					foreach ( $layerSets as $layerSet ) {
						if ( $layerSet['id'] == $layerSetId ) {
							$selectedLayerSet = $layerSet;
							break;
						}
					}
				}
				// Could add more selection methods here (name:, version:, etc.)
			}

			// Add layer information to params for thumbnail generation
			$params['layers'] = 'on'; // This triggers our transform hook
			$params['layerSetId'] = $selectedLayerSet['id'];
			$params['layerData'] = $selectedLayerSet;

			// Optional: Add CSS class for client-side enhancements
			if ( !isset( $params['class'] ) ) {
				$params['class'] = 'layers-image';
			} else {
				$params['class'] .= ' layers-image';
			}

		} catch ( Exception $e ) {
			// Log error but don't break normal image processing
			error_log( 'Layers: Parser hook error: ' . $e->getMessage() );
		}

		return true; // Continue normal processing
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
