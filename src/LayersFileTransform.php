<?php
/**
 * Custom file transformation for layered images
 * Integrates with MediaWiki's transform pipeline
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers;

use Exception;
use MediaWiki\Extension\Layers\Database\LayersDatabase;

class LayersFileTransform {

	/**
	 * Transform hook for layered images
	 * Called by MediaWiki's file transform system
	 *
	 * @param object $handler
	 * @param object $file
	 * @param array &$params
	 * @param object|null &$thumb
	 * @return bool
	 */
	public static function onBitmapHandlerTransform( $handler, $file, array &$params, &$thumb = null ): bool {
		// Only process if layers parameter is present
		if ( !isset( $params['layers'] ) || $params['layers'] === 'off' ) {
			return true; // Continue with normal processing
		}

		try {
			// Generate layered thumbnail
			$renderer = new ThumbnailRenderer();
			$layeredPath = $renderer->generateLayeredThumbnail( $file, $params );

			if ( $layeredPath ) {
				// Create custom thumbnail object
				$thumb = new LayeredThumbnail( $file, $layeredPath, $params );
				return false; // Stop normal processing, we handled it
			}

		} catch ( Exception $e ) {
				error_log( 'Layers: Transform failed: ' . $e->getMessage() );
		}

		return true; // Continue with normal processing if we failed
	}

	/**
	 * Check if image has layers and should be processed
	 *
	 * @param object $file
	 * @return bool
	 */
	public static function hasLayers( $file ): bool {
		try {
			$db = new LayersDatabase();
			$layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );
			return !empty( $layerSets );
		} catch ( Exception $e ) {
			return false;
		}
	}
}
