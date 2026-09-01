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
use MediaWiki\Extension\Layers\Utility\ForeignFileHelper;
use MediaWiki\Extension\Layers\Utility\RenderCache;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;

class Hooks {
	/**
	 * ChangeTagsAllowedAdd hook handler.
	 * Registers the 'layers-data-change' tag so it can be applied to edits
	 * created by the audit trail feature.
	 *
	 * @param array &$allowedTags Array of allowed change tag names
	 */
	public static function onChangeTagsAllowedAdd( array &$allowedTags ): void {
		$allowedTags[] = 'layers-data-change';
	}

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
			// 4. Persisted page property set during parsing for cached article views
			$parserDetected = WikitextHooks::pageHasLayers();
			$fromParserCache = in_array( 'ext.layers', $out->getModules() );
			$fromPageProperty = method_exists( $out, 'getProperty' )
				? (bool)$out->getProperty( 'layers-present' )
				: false;
			$needsLayers = $isFilePage || $parserDetected || $fromParserCache || $fromPageProperty;

			// Reset the parser flag now that we've captured its value.
			// This prevents stale state in long-running processes.
			WikitextHooks::resetPageLayersFlag();

			if ( $needsLayers ) {
				$out->addModules( 'ext.layers' );
				$logger->info( 'Layers: Added viewer module' );
			}

			// The editor module is deliberately NOT added here. It only ever runs in
			// its own document — the tab links to action=editlayers and the modal
			// loads that same URL in an iframe — and EditLayersAction adds it there.
			// Loading it on every File: page cost every logged-in visitor 214 KB
			// gzipped (1 MB parsed) for code that never ran.
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
				// Fully PSR-3 compliant fallback — NullLogger silently discards
				// all log messages when LoggerFactory is unavailable (P2-050)
				$logger = new \Psr\Log\NullLogger();
			}
		}
		return $logger;
	}

	/**
	 * Get the installed Layers extension version.
	 *
	 * Read from the extension registry so it tracks extension.json without a
	 * second place to update. Falls back to a stable placeholder when the
	 * registry is unavailable (unit tests, or a partially bootstrapped
	 * environment) so callers always receive a usable string.
	 *
	 * @return string Extension version, or 'unknown'
	 */
	private static function getExtensionVersion() {
		static $version = null;
		if ( $version !== null ) {
			return $version;
		}
		$version = 'unknown';
		try {
			if ( class_exists( \ExtensionRegistry::class ) ) {
				$credits = \ExtensionRegistry::getInstance()->getAllThings();
				if ( isset( $credits['Layers']['version'] ) ) {
					$version = (string)$credits['Layers']['version'];
				}
			}
		} catch ( \Throwable $e ) {
			// Keep the placeholder; a missing version must never break page
			// rendering.
		}
		return $version;
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
			// Extension version, used by the emoji picker to cache-bust the
			// per-category SVG shards. Those are fetched directly rather than
			// through ResourceLoader, so without a version in the URL a browser
			// would keep serving the previous release's data indefinitely.
			$vars['wgLayersVersion'] = self::getExtensionVersion();
			// Surface server config toggle for client-side debug logging
			try {
				$config = $out->getConfig();
				$vars['wgLayersDebug'] = (bool)$config->get( 'LayersDebug' );
				$vars['wgLayersMaxBytes'] = (int)$config->get( 'LayersMaxBytes' );
				// Import tuning: surfaced so the client-side downscale/compression
				// in Toolbar.js honours the administrator's configured limits
				// instead of silently falling back to hardcoded defaults.
				$vars['wgLayersMaxImageBytes'] = (int)$config->get( 'LayersMaxImageBytes' );
				$vars['wgLayersMaxImportSide'] = (int)$config->get( 'LayersMaxImportSide' );
				$vars['wgLayersImportJpegQuality'] = (float)$config->get( 'LayersImportJpegQuality' );
			} catch ( \Throwable $e2 ) {
				$vars['wgLayersDebug'] = false;
				$vars['wgLayersMaxBytes'] = 0;
				// Use the same safe defaults as the extension.json config so the
				// client never receives a zero that would break compression math.
				$vars['wgLayersMaxImageBytes'] = 1048576;
				$vars['wgLayersMaxImportSide'] = 2048;
				$vars['wgLayersImportJpegQuality'] = 0.8;
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

		$imgName = str_replace( ' ', '_', $file->getName() );
		$sha1 = ForeignFileHelper::getFileSha1( $file, $imgName );

		try {
			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );
			$db->deleteLayerSetsForImage( $file->getName(), $sha1 );
		} catch ( Exception $e ) {
			// Log error but don't break deletion
			LoggerFactory::getInstance( 'Layers' )
				->error( 'Layers: Error cleaning up layer sets', [ 'exception' => $e ] );
		}

		// Generated renders live outside MediaWiki's file management, so deleting
		// the source file would otherwise leave composited thumbnails and exported
		// PDFs permanently retrievable at stable public URLs.
		try {
			$config = MediaWikiServices::getInstance()->getMainConfig();
			$purged = RenderCache::purgeBySha1( $config, $sha1 );
			if ( $purged > 0 ) {
				LoggerFactory::getInstance( 'Layers' )->info(
					'Layers: purged {count} generated renders for deleted file {file}',
					[ 'count' => $purged, 'file' => $imgName ]
				);
			}
		} catch ( Exception $e ) {
			LoggerFactory::getInstance( 'Layers' )
				->error( 'Layers: Error purging render cache', [ 'exception' => $e ] );
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
			LoggerFactory::getInstance( 'Layers' )
				->error( 'Layers: Error registering parser functions', [ 'exception' => $e ] );
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
			$repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
			$fileObj = $repoGroup->findFile( $file );
			if ( !$fileObj || !$fileObj->exists() ) {
				return '';
			}

			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );
			$imgName = str_replace( ' ', '_', $fileObj->getName() );
			$layerSets = $db->getLayerSetsForImage(
				$fileObj->getName(),
				ForeignFileHelper::getFileSha1( $fileObj, $imgName )
			);

			$names = [];
			foreach ( $layerSets as $layerSet ) {
				if ( !empty( $layerSet['name'] ) ) {
					$names[] = $layerSet['name'];
				}
			}

			return implode( ', ', $names );
		} catch ( Exception $e ) {
			LoggerFactory::getInstance( 'Layers' )
				->error( 'Layers: Error in layerListParserFunction', [ 'exception' => $e ] );
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
			$repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
			$fileObj = $repoGroup->findFile( $file );
			if ( !$fileObj || !$fileObj->exists() ) {
				return '';
			}

				$fileTitle = Title::makeTitle( NS_FILE, $file );
			if ( !$fileTitle ) {
				return '';
			}

			$editParams = [ 'action' => 'editlayers' ];
			if ( $set !== '' ) {
				$editParams['setname'] = $set;
			}
			$editUrl = $fileTitle->getLocalURL( $editParams );
			$linkText = wfMessage( 'layers-edit-link-text' )->text();

			return "[$editUrl $linkText]";
		} catch ( Exception $e ) {
			LoggerFactory::getInstance( 'Layers' )
				->error( 'Layers: Error in layerEditParserFunction', [ 'exception' => $e ] );
			return '';
		}
	}
}
