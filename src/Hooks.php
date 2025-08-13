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

// Avoid direct hard dependency on MediaWiki classes for static analysis

// Define constants if not already defined
if ( !defined( 'NS_FILE' ) ) {
	define( 'NS_FILE', 6 );
}

class Hooks {

	/**
	 * BeforePageDisplay hook handler
	 *
	 * @param mixed $out OutputPage
	 * @param mixed $skin Skin
	 * @return void
	 */
	public static function onBeforePageDisplay( $out, $skin ) {
		try {
			// Always add viewer resources so layered thumbnails on any page can render
			// This is critical for layers to display properly
			$out->addModules( 'ext.layers' );

			// Use proper logger instead of conditional calls
			$logger = self::getLogger();
			$logger->info( 'Layers: BeforePageDisplay hook called, added viewer module' );

			// Check if extension is enabled for additional features
			$config = $out->getConfig();
			if ( !$config->get( 'LayersEnable' ) ) {
				$logger->info( 'Layers: Extension disabled, not loading editor module' );
				return;
			}

			// Add editor resources on file pages when the user can edit layers
			$title = $out->getTitle();
			if ( $title && $title->inNamespace( NS_FILE ) ) {
				if ( $out->getUser()->isAllowed( 'editlayers' ) ) {
					$logger->info( 'Layers: Adding editor module for file page' );
					$out->addModules( 'ext.layers.editor' );
				}
			}
		} catch ( \Throwable $e ) {
			// Log error but don't break page rendering
			self::getLogger()->error( 'Layers: Error in BeforePageDisplay hook', [
				'exception' => $e->getMessage(),
				'trace' => $e->getTraceAsString()
			] );
		}
	}

	/**
	 * Get logger instance with fallback
	 *
	 * @return mixed Logger instance (Psr\Log\LoggerInterface or fallback)
	 */
	private static function getLogger() {
		static $logger = null;
		if ( $logger === null ) {
			if ( class_exists( '\MediaWiki\Logger\LoggerFactory' ) ) {
				$logger = \MediaWiki\Logger\LoggerFactory::getInstance( 'Layers' );
			} else {
				// Fallback logger that uses error_log
				$logger = new class {
					/**
					 * Log an informational message
					 * @param string $message
					 * @param array $context
					 * @return void
					 */
					public function info( $message, $context = [] ) {
						error_log( "Layers INFO: $message" );
					}

					/**
					 * Log an error message
					 * @param string $message
					 * @param array $context
					 * @return void
					 */
					public function error( $message, $context = [] ) {
						error_log( "Layers ERROR: $message" );
						if ( isset( $context['exception'] ) ) {
							error_log( "Exception: " . $context['exception'] );
						}
					}

					/**
					 * Log a warning message
					 * @param string $message
					 * @param array $context
					 * @return void
					 */
					public function warning( $message, $context = [] ) {
						error_log( "Layers WARNING: $message" );
					}
				};
			}
		}
		return $logger;
	}

	/**
	 * Ensure the viewer module is considered in the startup payload on every page.
	 * This can help skins/environments that defer module loads.
	 *
	 * @param array &$vars Global JavaScript variables array (passed by reference)
	 * @param mixed $out OutputPage instance
	 * @return bool Always returns true to continue hook processing
	 */
	public static function onMakeGlobalVariablesScript( &$vars, $out ) {
		try {
			$vars['wgLayersEnabled'] = true;
			// Surface server config toggle for client-side debug logging
			try {
				$config = $out->getConfig();
				$vars['wgLayersDebug'] = (bool)$config->get( 'LayersDebug' );
			} catch ( \Throwable $e2 ) {
				$vars['wgLayersDebug'] = false;
			}
			// Also proactively register the viewer module to be safe
			if ( method_exists( $out, 'addModules' ) ) {
				$out->addModules( 'ext.layers' );
			}
		} catch ( \Throwable $e ) {
			// ignore
		}
		return true;
	}

	/**
	 * FileDeleteComplete hook handler
	 * Cleans up layer data when files are deleted
	 *
	 * @param mixed $file The File object being deleted
	 * @param mixed $oldimage The OldLocalFile object (or mixed type)
	 * @param mixed $article The Article or WikiPage object (or mixed type)
	 * @param mixed $user The User performing the deletion
	 * @param string $reason The reason for deletion
	 * @return void
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
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error( 'Layers: Error cleaning up layer sets', [ 'exception' => $e ] );
			}
		}
	}

	/**
	 * ParserFirstCallInit hook handler
	 *
	 * @param mixed $parser Parser
	 * @return void
	 */
	public static function onParserFirstCallInit( $parser ) {
		// Register parser functions
		try {
			$parser->setFunctionHook( 'layerlist', [ self::class, 'layerListParserFunction' ] );
			$parser->setFunctionHook( 'layeredit', [ self::class, 'layerEditParserFunction' ] );
		} catch ( Exception $e ) {
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error( 'Layers: Error registering parser functions', [ 'exception' => $e ] );
			}
		}
	}

	/**
	 * LoadExtensionSchemaUpdates hook handler
	 *
	 * @param mixed $updater DatabaseUpdater
	 * @return void
	 */
	public static function onLoadExtensionSchemaUpdates( $updater ) {
		$dir = dirname( __DIR__ );
		$tablesDir = $dir . '/sql/tables';
		$monolithic = $dir . '/sql/layers_tables.sql';

		// Prefer per-table files to avoid re-running a monolithic schema multiple times
		if ( is_dir( $tablesDir )
			&& file_exists( $tablesDir . '/layer_sets.sql' )
			&& file_exists( $tablesDir . '/layer_assets.sql' )
			&& file_exists( $tablesDir . '/layer_set_usage.sql' )
		) {
			$updater->addExtensionTable( 'layer_sets', $tablesDir . '/layer_sets.sql' );
			$updater->addExtensionTable( 'layer_assets', $tablesDir . '/layer_assets.sql' );
			$updater->addExtensionTable( 'layer_set_usage', $tablesDir . '/layer_set_usage.sql' );
		} else {
			// Fallback: run the monolithic schema once, anchored on layer_sets
			if ( file_exists( $monolithic ) ) {
				$updater->addExtensionTable( 'layer_sets', $monolithic );
			}
		}

		// Add post-install patches for added columns (Updater will no-op if already present)
		$patchDir = $dir . '/sql/patches';
		$patchSize = $patchDir . '/patch-layer_sets-add-ls_size.sql';
		$patchCount = $patchDir . '/patch-layer_sets-add-ls_layer_count.sql';
		if ( file_exists( $patchSize ) ) {
			$updater->addExtensionField( 'layer_sets', 'ls_size', $patchSize );
		}
		if ( file_exists( $patchCount ) ) {
			$updater->addExtensionField( 'layer_sets', 'ls_layer_count', $patchCount );
		}
	}

	/**
	 * FileTransform hook handler
	 *
	 * @return void
	 */
	// NOTE: Transform processing is handled downstream via ThumbnailBeforeProduceHTML/UI hooks

	/**
	 * Parser function: {{#layerlist:File=Example.jpg}}
	 *
	 * @param mixed $parser Parser
	 * @param string $file
	 * @return string
	 */
	public static function layerListParserFunction( $parser, $file = '' ) {
		if ( empty( $file ) ) {
			return '';
		}

		try {
			// Get file using MediaWikiServices if available
			$services = \is_callable( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
				? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
				: null;
			$repoGroup = $services ? $services->getRepoGroup() : null;
			$fileObj = $repoGroup ? $repoGroup->findFile( $file ) : null;
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
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error( 'Layers: Error in layerListParserFunction', [ 'exception' => $e ] );
			}
			return '';
		}
	}

	/**
	 * Parser function: {{#layeredit:File=Example.jpg|set=pcb-callouts}}
	 *
	 * @param mixed $parser Parser
	 * @param string $file
	 * @param string $set
	 * @return string
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

			$services = \is_callable( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
				? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
				: null;
			$repoGroup = $services ? $services->getRepoGroup() : null;
			$fileObj = $repoGroup ? $repoGroup->findFile( $file ) : null;
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
			if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->error( 'Layers: Error in layerEditParserFunction', [ 'exception' => $e ] );
			}
			return '';
		}
	}
}
