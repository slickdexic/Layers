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
	 * Only processes images when layers parameter is explicitly set
	 *
	 * @param object $handler
	 * @param object $file
	 * @param array &$params
	 * @param object|null &$thumb
	 * @return bool
	 */
	public static function onBitmapHandlerTransform( $handler, $file, array &$params, &$thumb = null ): bool {
		// Simple logging only - no processing for now
		error_log( 'Layers: BitmapHandlerTransform called for ' . $file->getName() );
		return true; // Continue with normal processing
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