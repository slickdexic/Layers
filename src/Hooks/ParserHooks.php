<?php
/**
 * Wikitext parser hooks for image parameter handling
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\MediaWikiServices;
use Exception;

class ParserHooks {

    /**
     * Handle the "layers" parameter in [[File:...]] wikitext
     * This is the CRITICAL missing piece for actual functionality
     */
    public static function onParserMakeImageParams( $title, $file, &$params, $parser ) {
        // Check if layers parameter is present
        if ( !isset( $params['handler']['layers'] ) ) {
            return true;
        }

        $layersParam = $params['handler']['layers'];
        
        // Don't process if layers=off
        if ( $layersParam === 'off' || $layersParam === 'false' ) {
            return true;
        }

        try {
            // Get layer data for this file
            $db = new LayersDatabase();
            $layerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );
            
            if ( empty( $layerSets ) ) {
                // No layers found, proceed with normal rendering
                return true;
            }

            // Use the latest layer set or specific named set
            $layerSet = null;
            if ( $layersParam === 'on' || $layersParam === 'true' ) {
                // Use most recent layer set
                $layerSet = $layerSets[0];
            } elseif ( is_string( $layersParam ) ) {
                // Look for named layer set
                foreach ( $layerSets as $set ) {
                    if ( !empty( $set['name'] ) && $set['name'] === $layersParam ) {
                        $layerSet = $set;
                        break;
                    }
                }
                
                // If named set not found, use latest
                if ( !$layerSet ) {
                    $layerSet = $layerSets[0];
                }
            }

            if ( $layerSet ) {
                // Add layer data to params for thumbnail generation
                $params['handler']['layerdata'] = $layerSet;
                
                // Mark for special handling
                $params['handler']['layers_active'] = true;
            }

        } catch ( Exception $e ) {
            // Log error but don't break normal image rendering
            if ( function_exists( 'wfLogWarning' ) ) {
                wfLogWarning( 'Layers: Parser hook error: ' . $e->getMessage() );
            }
        }

        return true;
    }

    /**
     * Handle thumbnail generation with layers
     */
    public static function onThumbnailBeforeProduceHTML( $thumbnail, &$attribs, &$linkAttribs ) {
        $file = $thumbnail->getFile();
        
        // Check if this thumbnail has layer data
        $params = $thumbnail->getParameters();
        if ( empty( $params['layers_active'] ) || empty( $params['layerdata'] ) ) {
            return true;
        }

        try {
            // Generate layered thumbnail
            $renderer = new ThumbnailRenderer();
            $layeredPath = $renderer->generateLayeredThumbnail( $file, $params );
            
            if ( $layeredPath ) {
                // Update the src attribute to use layered thumbnail
                $config = MediaWikiServices::getInstance()->getMainConfig();
                $uploadDir = $config->get( 'UploadDirectory' );
                $uploadPath = $config->get( 'UploadPath' );
                
                if ( strpos( $layeredPath, $uploadDir ) === 0 ) {
                    $relativePath = substr( $layeredPath, strlen( $uploadDir ) );
                    $attribs['src'] = $uploadPath . $relativePath;
                }
                
                // Add layers class for CSS styling
                if ( !empty( $attribs['class'] ) ) {
                    $attribs['class'] .= ' layers-thumbnail';
                } else {
                    $attribs['class'] = 'layers-thumbnail';
                }
                
                // Add data attribute for viewer initialization
                $layerData = json_decode( $params['layerdata']['json_blob'], true );
                if ( $layerData ) {
                    $attribs['data-layers'] = htmlspecialchars( json_encode( $layerData ) );
                }
            }

        } catch ( Exception $e ) {
            if ( function_exists( 'wfLogWarning' ) ) {
                wfLogWarning( 'Layers: Thumbnail hook error: ' . $e->getMessage() );
            }
        }

        return true;
    }

    /**
     * Enhanced parser function for layer lists with more options
     */
    public static function layerListFunction( $parser, $file = '', $format = 'names' ) {
        if ( empty( $file ) ) {
            return '';
        }

        try {
            // Get file object
            $fileObj = class_exists( 'RepoGroup' ) ? 
                \RepoGroup::singleton()->findFile( $file ) : null;
                
            if ( !$fileObj || !$fileObj->exists() ) {
                return '';
            }

            // Get layer sets for this file
            $db = new LayersDatabase();
            $layerSets = $db->getLayerSetsForImage( $fileObj->getName(), $fileObj->getSha1() );
            
            if ( empty( $layerSets ) ) {
                return '';
            }

            switch ( $format ) {
                case 'count':
                    return (string)count( $layerSets );
                    
                case 'dates':
                    $dates = array_map( function( $set ) {
                        return $set['timestamp'];
                    }, $layerSets );
                    return implode( ', ', $dates );
                    
                case 'names':
                default:
                    $names = [];
                    foreach ( $layerSets as $layerSet ) {
                        if ( !empty( $layerSet['name'] ) ) {
                            $names[] = $layerSet['name'];
                        } else {
                            $names[] = 'Unnamed (' . $layerSet['timestamp'] . ')';
                        }
                    }
                    return implode( ', ', $names );
            }
            
        } catch ( Exception $e ) {
            if ( function_exists( 'wfLogWarning' ) ) {
                wfLogWarning( 'Layers: layerListFunction error: ' . $e->getMessage() );
            }
            return '';
        }
    }
}
