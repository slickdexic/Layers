<?php
/**
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * @file
 */

namespace MediaWiki\Extension\Layers;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\UIHooks;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use DatabaseUpdater;
use OutputPage;
use Skin;
use File;
use Parser;
use Exception;

class Hooks implements 
    \MediaWiki\Hook\BeforePageDisplayHook,
    \MediaWiki\Hook\FileDeleteCompleteHook,
    \MediaWiki\Hook\ParserFirstCallInitHook,
    \MediaWiki\Hook\LoadExtensionSchemaUpdatesHook,
    \MediaWiki\Hook\FileTransformHook {

    /**
     * @see https://www.mediawiki.org/wiki/Manual:Hooks/BeforePageDisplay
     * @param OutputPage $out
     * @param Skin $skin
     */
    public function onBeforePageDisplay( $out, $skin ): void {
        $config = $out->getConfig();
        
        // Check if Layers extension is enabled
        if ( !$config->get( 'LayersEnable' ) ) {
            return;
        }

        // Check if this page has files with layers
        $title = $out->getTitle();
        if ( $title && $title->inNamespace( NS_FILE ) ) {
            // Add editor resources if user has permission
            if ( $out->getUser()->isAllowed( 'editlayers' ) ) {
                $out->addModules( 'ext.layers.editor' );
            }
            
            // Always add viewer resources for displaying layers
            $out->addModules( 'ext.layers' );
        }
        
        // Add viewer resources if page content includes layered images
        if ( $this->pageHasLayeredImages( $out ) ) {
            $out->addModules( 'ext.layers' );
        }
    }
    
    /**
     * Check if page content includes images with layer parameters
     * @param OutputPage $out
     * @return bool
     */
    private function pageHasLayeredImages( OutputPage $out ): bool {
        // This is a simplified check - in practice, we'd scan the page content
        // for [[File:...]] with layers= parameters
        return false; // TODO: Implement proper detection
    }

    /**
     * Handle file deletion - clean up associated layer sets
     * @param File $file
     * @param File $oldimage
     * @param \WikiPage $article
     * @param \User $user
     * @param string $reason
     */
    public function onFileDeleteComplete( $file, $oldimage, $article, $user, $reason ): void {
        if ( !$file ) {
            return;
        }
        
        $db = new LayersDatabase();
        $db->deleteLayerSetsForImage( $file->getName(), $file->getSha1() );
    }

    /**
     * Register parser functions and file options
     * @param Parser $parser
     */
    public function onParserFirstCallInit( $parser ): void {
        // Register parser functions
        $parser->setFunctionHook( 'layerlist', [ self::class, 'layerListParserFunction' ] );
        $parser->setFunctionHook( 'layeredit', [ self::class, 'layerEditParserFunction' ] );
        
        // Register image parameter handler
        $parser->setHook( 'layerimage', [ self::class, 'layerImageTag' ] );
    }

    /**
     * Database schema updates
     * @param DatabaseUpdater $updater
     */
    public function onLoadExtensionSchemaUpdates( DatabaseUpdater $updater ): void {
        $base = __DIR__ . '/..';
        $updater->addExtensionTable( 'layer_sets', "$base/sql/layers_tables.sql" );
        $updater->addExtensionTable( 'layer_assets', "$base/sql/layers_tables.sql" );
        $updater->addExtensionTable( 'layer_set_usage', "$base/sql/layers_tables.sql" );
    }

    /**
     * Parser function: {{#layerlist:File=Example.jpg}}
     * Returns comma-separated list of layer names for a file
     */
    public static function layerListParserFunction( Parser $parser, $file = '' ) {
        if ( empty( $file ) ) {
            return '';
        }

        try {
            // Get file object
            $fileObj = \RepoGroup::singleton()->findFile( $file );
            if ( !$fileObj || !$fileObj->exists() ) {
                return '';
            }

            // Get layer sets for this file
            $db = new LayersDatabase();
            $layerSets = $db->getLayerSetsForImage( $fileObj->getName(), $fileObj->getSha1() );
            
            // Extract layer set names
            $names = [];
            foreach ( $layerSets as $layerSet ) {
                if ( !empty( $layerSet['name'] ) ) {
                    $names[] = $layerSet['name'];
                }
            }
            
            return implode( ', ', $names );
            
        } catch ( Exception $e ) {
            wfLogWarning( 'Layers: Error in layerListParserFunction: ' . $e->getMessage() );
            return '';
        }
    }

    /**
     * Parser function: {{#layeredit:File=Example.jpg|set=pcb-callouts}}
     * Returns edit link for layers
     */
    public static function layerEditParserFunction( Parser $parser, $file = '', $set = '' ) {
        if ( empty( $file ) ) {
            return '';
        }

        try {
            // Check if file exists
            $fileObj = \RepoGroup::singleton()->findFile( $file );
            if ( !$fileObj || !$fileObj->exists() ) {
                return '';
            }

            // Create file title
            $fileTitle = \Title::makeTitle( NS_FILE, $file );
            if ( !$fileTitle ) {
                return '';
            }

            // Generate edit URL
            $editUrl = $fileTitle->getLocalURL( [
                'action' => 'editlayers'
            ] );
            
            // Create edit link
            $linkText = wfMessage( 'layers-editor-title' )->text();
            $link = \Linker::makeExternalLink( $editUrl, $linkText, false, '', [] );
            
            return [ $link, 'noparse' => true, 'isHTML' => true ];
            
        } catch ( Exception $e ) {
            wfLogWarning( 'Layers: Error in layerEditParserFunction: ' . $e->getMessage() );
            return '';
        }
    }
    
    /**
     * Handle <layerimage> tag for embedding images with layers
     * @param string $content
     * @param array $attributes
     * @param Parser $parser
     * @return string
     */
    public static function layerImageTag( $content, array $attributes, Parser $parser ) {
        $file = $attributes['file'] ?? '';
        $layers = $attributes['layers'] ?? 'on';
        
        if ( empty( $file ) ) {
            return '<div class="error">Error: No file specified for layerimage tag</div>';
        }
        
        // TODO: Implement proper layer image rendering
        // For now, return a placeholder
        return "        // TODO: Implement layerimage tag for $file with layers=$layers -->";
    }

    /**
     * Hook into file transformation to add layer rendering
     * @param File $file
     * @param array $params
     * @param MediaWiki\FileBackend\FileBackend $backend
     */
    public function onFileTransform( $file, array &$params, $backend ): void {
        // Only process if layers parameter is present
        if ( !isset( $params['layers'] ) ) {
            return;
        }

        // Check if extension is enabled
        if ( !$this->getConfig()->get( 'LayersEnable' ) ) {
            return;
        }

        try {
            $renderer = new ThumbnailRenderer();
            $thumbnailPath = $renderer->generateLayeredThumbnail( $file, $params );
            
            if ( $thumbnailPath ) {
                // Override the transform to use our layered thumbnail
                $params['layered_thumbnail_path'] = $thumbnailPath;
            }
        } catch ( Exception $e ) {
            wfLogWarning( 'Layers: Transform hook failed: ' . $e->getMessage() );
        }
    }";
    }
}
