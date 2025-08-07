<?php
/**
 * Hooks for the Layers extension
 * Simplified version for compatibility with various MediaWiki versions
 *
 * @file
 */

namespace MediaWiki\Extension\Layers;

use Exception;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\MediaWikiServices;

// Define constants if not already defined
if ( !defined( 'NS_FILE' ) ) {
	define( 'NS_FILE', 6 );
}

class Hooks {

	/**
	 * UserGetRights hook handler
	 * Grant editlayers permission to all users by default
	 */
	public static function onUserGetRights( $user, &$rights ) {
		// Grant editlayers permission to all logged-in users by default
		if ( $user->isRegistered() ) {
			$rights[] = 'editlayers';
		}

		// Grant to anonymous users as well if configured
		global $wgLayersAllowAnonymousEdit;
		if ( $wgLayersAllowAnonymousEdit ?? false ) {
			$rights[] = 'editlayers';
		}
	}

	/**
	 * BeforePageDisplay hook handler
	 */
	public static function onBeforePageDisplay( $out, $skin ) {
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
	}

	/**
	 * FileDeleteComplete hook handler
	 */
	public static function onFileDeleteComplete( $file, $oldimage, $article, $user, $reason ) {
		if ( !$file ) {
			return;
		}

		try {
			$db = new LayersDatabase();
			$db->deleteLayerSetsForImage( $file->getName(), $file->getSha1() );
		} catch ( Exception $e ) {
			// Log error but don't break deletion
			error_log( 'Layers: Error cleaning up layer sets: ' . $e->getMessage() );
		}
	}

	/**
	 * ParserFirstCallInit hook handler
	 */
	public static function onParserFirstCallInit( $parser ) {
		// Temporarily disable parser function registration to avoid Special:Version errors
		// TODO: Re-enable once proper configuration is working
		/*
		try {
			$parser->setFunctionHook( 'layerlist', [ self::class, 'layerListParserFunction' ] );
			$parser->setFunctionHook( 'layeredit', [ self::class, 'layerEditParserFunction' ] );
		} catch ( Exception $e ) {
			error_log( 'Layers: Error registering parser functions: ' . $e->getMessage() );
		}
		*/
	}

	/**
	 * LoadExtensionSchemaUpdates hook handler
	 */
	public static function onLoadExtensionSchemaUpdates( $updater ) {
		$base = __DIR__ . '/..';
		$updater->addExtensionTable( 'layer_sets', "$base/sql/layers_tables.sql" );
		$updater->addExtensionTable( 'layer_assets', "$base/sql/layers_tables.sql" );
		$updater->addExtensionTable( 'layer_set_usage', "$base/sql/layers_tables.sql" );
	}

	/**
	 * FileTransform hook handler
	 */
	public static function onFileTransform( $file, &$params, $backend ) {
		// Only process if layers parameter is present
		if ( !isset( $params['layers'] ) ) {
			return;
		}

		try {
			$renderer = new ThumbnailRenderer();
			$thumbnailPath = $renderer->generateLayeredThumbnail( $file, $params );

			if ( $thumbnailPath ) {
				$params['layered_thumbnail_path'] = $thumbnailPath;
			}
		} catch ( Exception $e ) {
			error_log( 'Layers: Transform hook failed: ' . $e->getMessage() );
		}
	}

	/**
	 * Parser function: {{#layerlist:File=Example.jpg}}
	 */
	public static function layerListParserFunction( $parser, $file = '' ) {
		if ( empty( $file ) ) {
			return '';
		}

		try {
			// Get file using MediaWikiServices
			$repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
			$fileObj = $repoGroup->findFile( $file );
			if ( !$fileObj || !$fileObj->exists() ) {
				return '';
			}

			$db = new LayersDatabase();
			$layerSets = $db->getLayerSetsForImage( $fileObj->getName(), $fileObj->getSha1() );

			$names = [];
			foreach ( $layerSets as $layerSet ) {
				if ( !empty( $layerSet['name'] ) ) {
					$names[] = $layerSet['name'];
				}
			}

			return implode( ', ', $names );

		} catch ( Exception $e ) {
			error_log( 'Layers: Error in layerListParserFunction: ' . $e->getMessage() );
			return '';
		}
	}

	/**
	 * Parser function: {{#layeredit:File=Example.jpg|set=pcb-callouts}}
	 */
	public static function layerEditParserFunction( $parser, $file = '', $set = '' ) {
		if ( empty( $file ) ) {
			return '';
		}

		try {
			// Check class existence for compatibility
			if ( !class_exists( 'RepoGroup' ) || !class_exists( 'Title' ) ) {
				return '';
			}

			$repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
			$fileObj = $repoGroup->findFile( $file );
			if ( !$fileObj || !$fileObj->exists() ) {
				return '';
			}

			$fileTitle = \Title::makeTitle( NS_FILE, $file );
			if ( !$fileTitle ) {
				return '';
			}

			$editUrl = $fileTitle->getLocalURL( [ 'action' => 'editlayers' ] );
			$linkText = 'Edit Layers';

			return "[$editUrl $linkText]";

		} catch ( Exception $e ) {
			error_log( 'Layers: Error in layerEditParserFunction: ' . $e->getMessage() );
			return '';
		}
	}
}
