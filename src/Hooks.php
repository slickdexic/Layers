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
use DatabaseUpdater;
use OutputPage;
use Skin;
use File;
use Parser;

class Hooks implements 
    \MediaWiki\Hook\BeforePageDisplayHook,
    \MediaWiki\Hook\FileDeleteCompleteHook,
    \MediaWiki\Hook\ParserFirstCallInitHook,
    \MediaWiki\Hook\LoadExtensionSchemaUpdatesHook {

    /**
     * @see https://www.mediawiki.org/wiki/Manual:Hooks/BeforePageDisplay
     * @param OutputPage $out
     * @param Skin $skin
     */
    public function onBeforePageDisplay( $out, $skin ): void {
        $config = $out->getConfig();
        if ( $config->get( 'LayersVandalizeEachPage' ) ) {
            $out->addModules( 'oojs-ui-core' );
            $out->addHTML( \Html::element( 'p', [], 'Layers was here' ) );
        }

        // Check if this page has files with layers
        $title = $out->getTitle();
        if ( $title && $title->inNamespace( NS_FILE ) ) {
            // Add editor resources if user has permission
            if ( $out->getUser()->isAllowed( 'editlayers' ) ) {
                $out->addModules( 'ext.layers.editor' );
            }
        }
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

        // TODO: Implement layer list functionality
        return '';
    }

    /**
     * Parser function: {{#layeredit:File=Example.jpg|set=pcb-callouts}}
     * Returns edit link for layers
     */
    public static function layerEditParserFunction( Parser $parser, $file = '', $set = '' ) {
        if ( empty( $file ) ) {
            return '';
        }

        // TODO: Implement edit link functionality
        return '';
    }
}
