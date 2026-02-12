<?php

declare( strict_types=1 );

/**
 * Hooks for the Layers extension
 * Simplified version for compatibility with various MediaWiki versions
 *
 * @file
 */

namespace MediaWiki\Extension\Layers;

use Exception;
use MediaWiki\Extension\Layers\Hooks\WikitextHooks;
use MediaWiki\MediaWikiServices;

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
			// Use proper logger instead of conditional calls
			$logger = self::getLogger();

			// Check if extension is enabled
			$config = $out->getConfig();
			if ( !$config->get( 'LayersEnable' ) ) {
				$logger->info( 'Layers: Extension disabled, not loading modules' );
				WikitextHooks::resetPageLayersFlag();
				return;
			}

			$title = $out->getTitle();
			$isFilePage = $title && $title->inNamespace( NS_FILE );

			// Detect whether this page needs layers using multiple signals:
			// 1. File: pages (always — for viewer overlay + editor action)
			// 2. Parser flag set during current request ($pageHasLayers)
			// 3. Parser cache: ext.layers module already added to OutputPage
			//    by cached ParserOutput (parser hooks don't re-run on cached views)
			$parserDetected = WikitextHooks::pageHasLayers();
			$fromParserCache = in_array( 'ext.layers', $out->getModules() );
			$needsLayers = $isFilePage || $parserDetected || $fromParserCache;

			// Reset the parser flag now that we've captured its value.
			// This prevents stale state in long-running processes.
			WikitextHooks::resetPageLayersFlag();

			if ( $needsLayers ) {
				$out->addModules( 'ext.layers' );
				$logger->info( 'Layers: Added viewer module' );
			}

			// Add editor resources on file pages when the user can edit layers
			if ( $isFilePage ) {
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
				// Fallback logger that uses wfDebugLog (safer than error_log)
				$logger = new class {
					/**
					 * Log an informational message
					 * @param string $message
					 * @param array $context
					 * @return void
					 */
					public function info( $message, $context = [] ) {
						wfDebugLog( 'Layers', "INFO: $message" );
					}

					/**
					 * Log an error message
					 * @param string $message
					 * @param array $context
					 * @return void
					 */
					public function error( $message, $context = [] ) {
						wfDebugLog( 'Layers', "ERROR: $message" );
						if ( isset( $context['exception'] ) ) {
							wfDebugLog( 'Layers', "Exception: " . $context['exception'] );
						}
					}

					/**
					 * Log a warning message
					 * @param string $message
					 * @param array $context
					 * @return void
					 */
					public function warning( $message, $context = [] ) {
						wfDebugLog( 'Layers', "WARNING: $message" );
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
			$title = $out->getTitle();
			$isFilePage = $title && $title->inNamespace( NS_FILE );
			// Detect layers need from: File page, parser flag, or parser cache modules.
			// The parser flag may have been reset by onBeforePageDisplay, so also
			// check whether ext.layers was already added to OutputPage (from parser
			// cache or from onBeforePageDisplay itself).
			$hasLayersModule = in_array( 'ext.layers', $out->getModules() );
			$needsLayers = $isFilePage || $hasLayersModule || WikitextHooks::pageHasLayers();

			// Only export Layers JS config vars on pages that need them
			if ( !$needsLayers ) {
				return true;
			}

			$vars['wgLayersEnabled'] = true;
			// Surface server config toggle for client-side debug logging
			try {
				$config = $out->getConfig();
				$vars['wgLayersDebug'] = (bool)$config->get( 'LayersDebug' );
				$vars['wgLayersMaxBytes'] = (int)$config->get( 'LayersMaxBytes' );
			} catch ( \Throwable $e2 ) {
				$vars['wgLayersDebug'] = false;
				$vars['wgLayersMaxBytes'] = 0;
			}
			// Expose editlayers permission for viewer overlay UI
			try {
				$user = $out->getUser();
				$vars['wgLayersCanEdit'] = $user && $user->isAllowed( 'editlayers' );
			} catch ( \Throwable $e3 ) {
				$vars['wgLayersCanEdit'] = false;
			}
			// Provide the raw page-level layers query param to the client, if present
			try {
				$layersParam = null;

				// First check URL parameters
				if ( method_exists( $out, 'getRequest' ) ) {
					$req = $out->getRequest();
					if ( $req ) {
						$val = $req->getVal( 'layers', null );
						if ( $val === null ) {
							$val = $req->getVal( 'Layers', null );
						}
						if ( $val !== null && $val !== '' ) {
							$layersParam = $val;
						}
					}
				}

				if ( $layersParam ) {
					$vars['wgLayersParam'] = $layersParam;
				}
			} catch ( \Throwable $e3 ) {
				// ignore
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
			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );
			$db->deleteLayerSetsForImage( $file->getName(), self::getFileSha1( $file ) );
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

			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );
			$layerSets = $db->getLayerSetsForImage( $fileObj->getName(), self::getFileSha1( $fileObj ) );

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

			$editParams = [ 'action' => 'editlayers' ];
			if ( $set !== '' ) {
				$editParams['setname'] = $set;
			}
			$editUrl = $fileTitle->getLocalURL( $editParams );
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
