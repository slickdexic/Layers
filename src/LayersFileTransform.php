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
	 * @param mixed $handler
	 * @param mixed $file
	 * @param array &$params
	 * @param mixed|null &$thumb
	 * @return bool
	 */
	public static function onBitmapHandlerTransform( $handler, $file, array &$params, &$thumb = null ): bool {
		try {
			// Only act when layer data requested and present
			if ( empty( $params['layers'] ) || empty( $params['layerData'] ) ) {
				// Let core handle
				return true;
			}

			$renderer = new ThumbnailRenderer();
			$path = $renderer->generateLayeredThumbnail( $file, $params );
			if ( !$path ) {
				// Fall back to core
				return true;
			}

			// Build custom transform output so MW uses our composite
			$thumb = new LayeredThumbnail( $file, $path, $params );
			// We handled it
			return false;
		} catch ( Exception $e ) {
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error( 'Layers: Exception in BitmapHandlerTransform', [ 'exception' => $e ] );
			}
			return true;
		}
	}

	/**
	 * Check if image has layers and should be processed
	 *
	 * @param mixed $file
	 * @return bool
	 */
	public static function hasLayers( $file ): bool {
		try {
			$db = new LayersDatabase();
			$layerSets = $db->getLayerSetsForImage( $file->getName(), self::getFileSha1( $file ) );
			return !empty( $layerSets );
		} catch ( Exception $e ) {
			return false;
		}
	}

	/**
	 * Get a stable SHA1 identifier for a file (static version).
	 *
	 * For foreign files (from InstantCommons, etc.) that don't have a SHA1,
	 * we generate a stable fallback identifier based on the filename.
	 *
	 * @param mixed $file File object
	 * @return string SHA1 hash or fallback identifier
	 */
	private static function getFileSha1( $file ): string {
		$sha1 = $file->getSha1();
		if ( !empty( $sha1 ) ) {
			return $sha1;
		}

		// Check if this is a foreign file
		if ( self::isForeignFile( $file ) ) {
			// Use a hash of the filename as a fallback (prefixed for clarity)
			return 'foreign_' . sha1( $file->getName() );
		}

		return $sha1 ?? '';
	}

	/**
	 * Check if a file is from a foreign repository (like InstantCommons)
	 *
	 * @param mixed $file File object
	 * @return bool True if the file is from a foreign repository
	 */
	private static function isForeignFile( $file ): bool {
		// Check if file is a ForeignAPIFile or ForeignDBFile
		$className = get_class( $file );
		if ( strpos( $className, 'Foreign' ) !== false ) {
			return true;
		}

		// Check if the file's repository is not local
		if ( method_exists( $file, 'getRepo' ) ) {
			$repo = $file->getRepo();
			if ( $repo && method_exists( $repo, 'isLocal' ) && !$repo->isLocal() ) {
				return true;
			}
		}

		return false;
	}
}
