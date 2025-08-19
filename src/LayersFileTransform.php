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

class LayersFileTransform
{
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
    public static function onBitmapHandlerTransform($handler, $file, array &$params, &$thumb = null): bool
    {
        try {
            // Only act when layer data requested and present
            if (empty($params['layers']) || empty($params['layerData'])) {
                // Let core handle
                return true;
            }

            $renderer = new ThumbnailRenderer();
            $path = $renderer->generateLayeredThumbnail($file, $params);
            if (!$path) {
                // Fall back to core
                return true;
            }

            // Build custom transform output so MW uses our composite
            $thumb = new LayeredThumbnail($file, $path, $params);
            // We handled it
            return false;
        } catch (Exception $e) {
            if (\class_exists('\\MediaWiki\\Logger\\LoggerFactory')) {
                $logger = \call_user_func([ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers');
                $logger->error('Layers: Exception in BitmapHandlerTransform', [ 'exception' => $e ]);
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
    public static function hasLayers($file): bool
    {
        try {
            $db = new LayersDatabase();
            $layerSets = $db->getLayerSetsForImage($file->getName(), $file->getSha1());
            return !empty($layerSets);
        } catch (Exception $e) {
            return false;
        }
    }
}
