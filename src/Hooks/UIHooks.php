<?php
/**
 * UI Integration hooks for the Layers extension
 * Handles file page tabs and UI enhancements
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\MediaWikiServices;
use MediaWiki\Html\Html;
use SkinTemplate;
use Title;
use User;

class UIHooks {

    /**
     * Add "Edit Layers" tab to file pages
     * @param SkinTemplate $sktemplate
     * @param array &$links
     */
    public static function onSkinTemplateNavigation( SkinTemplate $sktemplate, array &$links ): void {
        $title = $sktemplate->getTitle();
        $user = $sktemplate->getUser();
        
        // Only add to file pages
        if ( !$title || !$title->inNamespace( NS_FILE ) ) {
            return;
        }
        
        // Check if user has permission
        if ( !$user->isAllowed( 'editlayers' ) ) {
            return;
        }
        
        // Check if file exists
        $file = MediaWikiServices::getInstance()->getRepoGroup()->findFile( $title );
        if ( !$file || !$file->exists() ) {
            return;
        }
        
        // Add edit layers tab
        $links['views']['editlayers'] = [
            'class' => false,
            'text' => wfMessage( 'layers-editor-title' )->text(),
            'href' => self::getEditLayersURL( $title ),
            'context' => 'main',
        ];
    }

    /**
     * Generate URL for editing layers
     * @param Title $title
     * @return string
     */
    private static function getEditLayersURL( Title $title ): string {
        return $title->getLocalURL( [
            'action' => 'editlayers'
        ] );
    }

    /**
     * Handle edit layers action
     * @param string $action
     * @param \Article $article
     * @return bool
     */
    public static function onUnknownAction( string $action, \Article $article ): bool {
        if ( $action !== 'editlayers' ) {
            return true;
        }
        
        $title = $article->getTitle();
        $user = $article->getContext()->getUser();
        $out = $article->getContext()->getOutput();
        
        // Check permissions
        if ( !$user->isAllowed( 'editlayers' ) ) {
            throw new \PermissionsError( 'editlayers' );
        }
        
        // Check if it's a file page
        if ( !$title->inNamespace( NS_FILE ) ) {
            $out->showErrorPage( 'error', 'layers-not-file-page' );
            return false;
        }
        
        // Check if file exists
        $file = MediaWikiServices::getInstance()->getRepoGroup()->findFile( $title );
        if ( !$file || !$file->exists() ) {
            $out->showErrorPage( 'error', 'layers-file-not-found' );
            return false;
        }
        
        self::showLayersEditor( $out, $file );
        return false;
    }

    /**
     * Show the layers editor interface
     * @param \OutputPage $out
     * @param \File $file
     */
    private static function showLayersEditor( \OutputPage $out, \File $file ): void {
        // Set page title
        $out->setPageTitle( wfMessage( 'layers-editor-title' )->text() . ': ' . $file->getName() );
        
        // Add editor resources
        $out->addModules( 'ext.layers.editor' );
        
        // Add editor container
        $out->addHTML( '<div id="layers-editor-container"></div>' );
        
        // Add initialization script
        $fileUrl = $file->getFullUrl();
        $out->addInlineScript(
            "mw.loader.using('ext.layers.editor', function() {" .
            "mw.hook('layers.editor.init').fire({" .
            "filename: " . json_encode( $file->getName() ) . "," .
            "imageUrl: " . json_encode( $fileUrl ) . "," .
            "container: document.getElementById('layers-editor-container')" .
            "});" .
            "});"
        );
        
        // Prevent normal page rendering
        $out->setArticleBodyOnly( true );
    }

    /**
     * Add layers parameter to file thumbnails
     * @param \Title $title
     * @param \File $file  
     * @param array &$params
     * @param \Parser $parser
     * @return bool
     */
    public static function onParserMakeImageParams( \Title $title, \File $file, array &$params, \Parser $parser ): bool {
        // Check if layers parameter is specified
        if ( !isset( $params['layers'] ) ) {
            return true;
        }
        
        $layersParam = $params['layers'];
        
        // Handle different layer parameter formats
        if ( $layersParam === 'on' || $layersParam === true ) {
            // Use latest layer set
            self::addLatestLayersToImage( $file, $params );
        } elseif ( is_string( $layersParam ) ) {
            // Handle specific layer set ID or name
            self::addSpecificLayersToImage( $file, $layersParam, $params );
        }
        
        return true;
    }

    /**
     * Add latest layer set to image parameters
     * @param \File $file
     * @param array &$params
     */
    private static function addLatestLayersToImage( \File $file, array &$params ): void {
        $db = new LayersDatabase();
        $layerSet = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );
        
        if ( $layerSet ) {
            $params['layerSetId'] = $layerSet['id'];
            $params['layerData'] = $layerSet['data'];
        }
    }

    /**
     * Add specific layer set to image parameters
     * @param \File $file
     * @param string $layersParam
     * @param array &$params
     */
    private static function addSpecificLayersToImage( \File $file, string $layersParam, array &$params ): void {
        $db = new LayersDatabase();
        
        if ( strpos( $layersParam, 'id:' ) === 0 ) {
            // Layer set by ID
            $layerSetId = (int)substr( $layersParam, 3 );
            $layerSet = $db->getLayerSet( $layerSetId );
        } elseif ( strpos( $layersParam, 'name:' ) === 0 ) {
            // Layer set by name
            $layerSetName = substr( $layersParam, 5 );
            // TODO: Implement getLayerSetByName method
            $layerSet = null;
        } else {
            // Legacy format or other formats
            $layerSet = null;
        }
        
        if ( $layerSet ) {
            $params['layerSetId'] = $layerSet['id'];
            $params['layerData'] = $layerSet['data'];
        }
    }
    
    /**
     * Modify thumbnail generation to include layers
     * @param \ThumbnailImage $thumbnail
     * @param array &$attribs
     * @param array &$linkAttribs
     * @return bool
     */
    public static function onThumbnailBeforeProduceHTML( $thumbnail, array &$attribs, array &$linkAttribs ): bool {
        // Check if this thumbnail should include layers
        if ( !isset( $attribs['layerSetId'] ) && !isset( $attribs['layerData'] ) ) {
            return true;
        }
        
        // TODO: Implement server-side layer rendering
        // For now, add a CSS class to indicate this thumbnail has layers
        $classes = $attribs['class'] ?? '';
        $attribs['class'] = trim( $classes . ' layers-thumbnail' );
        
        // Add data attributes for client-side rendering
        if ( isset( $attribs['layerSetId'] ) ) {
            $attribs['data-layer-set-id'] = $attribs['layerSetId'];
        }
        
        if ( isset( $attribs['layerData'] ) ) {
            $attribs['data-layer-data'] = json_encode( $attribs['layerData'] );
        }
        
        return true;
    }
}
