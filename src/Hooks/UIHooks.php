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

// Define constants if not already defined (for static analysis/local tools)
if ( !\defined( 'NS_FILE' ) ) {
\define( 'NS_FILE', 6 );
}

class UIHooks {

	/**
	 * Add "Edit Layers" tab to file pages
	 * @param mixed $sktemplate
	 * @param array &$links
	 */
	public static function onSkinTemplateNavigation( $sktemplate, array &$links ): void {
		// Force debug mode for now to diagnose issues - this will be removed once working
		$dbg = true;
		$req = null;
		
		// Critical debug: Log that this hook is being called
		error_log( 'LAYERS HOOK CALLED: SkinTemplateNavigation hook is running' );
		try {
			if ( is_object( $sktemplate ) && method_exists( $sktemplate, 'getConfig' ) ) {
				$cfg = $sktemplate->getConfig();
				if ( $cfg && method_exists( $cfg, 'get' ) ) {
					$dbg = (bool)$cfg->get( 'LayersDebug' );
				}
			}
			if ( is_object( $sktemplate ) ) {
				$req = method_exists( $sktemplate, 'getRequest' ) ? $sktemplate->getRequest() : ( method_exists( $sktemplate, 'getContext' ) ? $sktemplate->getContext()->getRequest() : null );
				if ( $req && method_exists( $req, 'getVal' ) ) {
					$paramDbg = $req->getVal( 'layersdebug' );
					if ( $paramDbg !== null && $paramDbg !== '' && $paramDbg !== '0' && $paramDbg !== 'false' ) {
						$dbg = true;
					}
				}
			}
		} catch ( \Throwable $e ) {}
		$log = function( $msg ) use ( $dbg ) {
			if ( !$dbg ) { return; }
			try {
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
					$logger->info( '[Tab] ' . $msg );
				}
				// ALSO output directly for immediate visibility during debugging
				error_log( 'LAYERS DEBUG: ' . $msg );
			} catch ( \Throwable $e ) {}
		};
		// Be defensive about how we get Title/User across skins/versions
		$title = null;
		if ( is_object( $sktemplate ) ) {
			if ( method_exists( $sktemplate, 'getTitle' ) ) {
				$title = $sktemplate->getTitle();
			} elseif ( method_exists( $sktemplate, 'getContext' ) ) {
				$ctx = $sktemplate->getContext();
				$title = $ctx && method_exists( $ctx, 'getTitle' ) ? $ctx->getTitle() : null;
			}
		}

		$user = null;
		if ( is_object( $sktemplate ) ) {
			if ( method_exists( $sktemplate, 'getUser' ) ) {
				$user = $sktemplate->getUser();
			} elseif ( method_exists( $sktemplate, 'getContext' ) ) {
				$ctx = $sktemplate->getContext();
				$user = $ctx && method_exists( $ctx, 'getUser' ) ? $ctx->getUser() : null;
			}
		}

		// Only add to file pages (unless debugging, then we allow insertion to prove the hook runs)
		if ( !$title || !$title->inNamespace( NS_FILE ) ) {
			$log( 'Skip: not a file page - title: ' . ( $title ? $title->getFullText() : 'null' ) );
			if ( !$dbg ) {
				return;
			}
		}

		// Only add for users with editlayers permission (unless debugging enabled)
		if ( !$user ) {
			$log( 'Skip: no user object' );
			if ( !$dbg ) {
				return;
			}
		}
		
		if ( $user && !method_exists( $user, 'isAllowed' ) ) {
			$log( 'Skip: user object has no isAllowed method' );
			if ( !$dbg ) {
				return;
			}
		}
		
		if ( $user && method_exists( $user, 'isAllowed' ) && !$user->isAllowed( 'editlayers' ) ) {
			$log( 'Skip: user missing editlayers permission - user groups: ' . implode( ',', $user->getGroups() ) );
			if ( !$dbg ) {
				return;
			}
		}

		// Do not block on config; if set explicitly false, skip
		$config = method_exists( $sktemplate, 'getConfig' ) ? $sktemplate->getConfig() : null;
		if ( $config && method_exists( $config, 'get' ) ) {
			try {
				if ( $config->get( 'LayersEnable' ) === false ) {
					$log( 'Skip: LayersEnable=false' );
					return;
				}
			} catch ( \Throwable $e ) {
				// ignore
			}
		}

		// Optionally check file existence (relaxed: show tab even if lookup fails)
		try {
			$services = class_exists( '\\MediaWiki\\MediaWikiServices' )
				? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
				: null;
			$repoGroup = $services ? $services->getRepoGroup() : null;
			$file = $repoGroup ? $repoGroup->findFile( $title ) : null;
			// Do not return early if missing; still offer the tab to start the editor
		} catch ( \Throwable $e ) {
			// Ignore lookup errors
		}

		// Determine if our tab is the selected action
		$isSelected = false;
		try {
			// $req may already be set above
			if ( !$req && is_object( $sktemplate ) ) {
				$req = method_exists( $sktemplate, 'getRequest' ) ? $sktemplate->getRequest() : ( method_exists( $sktemplate, 'getContext' ) ? $sktemplate->getContext()->getRequest() : null );
			}
			$isSelected = $req && method_exists( $req, 'getVal' ) && $req->getVal( 'action' ) === 'editlayers';
			$log( 'Selected? ' . ( $isSelected ? 'yes' : 'no' ) );
		} catch ( \Throwable $e ) {
			$isSelected = false;
		}

		// Create edit layers tab data
		$editLayersTab = [
			'class' => $isSelected ? 'selected' : false,
			'text' => ( \function_exists( 'wfMessage' ) ? \wfMessage( 'layers-editor-title' )->text() : 'Edit Layers' ),
			'href' => self::getEditLayersURL( $title ),
			'context' => 'main',
		];

		// Ensure buckets exist
		if ( !isset( $links['views'] ) || !is_array( $links['views'] ) ) {
			$links['views'] = [];
		}
		if ( !isset( $links['actions'] ) || !is_array( $links['actions'] ) ) {
			$links['actions'] = [];
		}

	// Insert the edit layers tab after the edit tab when present; otherwise prepend
		$newViews = [];
		$inserted = false;
		foreach ( $links['views'] as $key => $tab ) {
			$newViews[$key] = $tab;
			if ( $key === 'edit' || $key === 've-edit' ) {
				$newViews['editlayers'] = $editLayersTab;
				$inserted = true;
			}
		}
		if ( !$inserted ) {
			$newViews = [ 'editlayers' => $editLayersTab ] + $newViews;
		}
		$links['views'] = $newViews;

		// Also expose as an action for skins that render actions separately
		if ( !isset( $links['actions']['editlayers'] ) ) {
			$links['actions']['editlayers'] = $editLayersTab;
			$log( 'Inserted into actions' );
		}
		$log( 'Inserted into views (after edit when present)' );

		// When debugging, add an explicit debug-only action so we can see something even if above conditions would skip
		if ( $dbg ) {
			// Force tab insertion for debugging
			$debugTab = [
				'class' => false,
				'text' => 'Edit Layers (DEBUG)',
				'href' => ( $title && method_exists( $title, 'getLocalURL' ) ) ? self::getEditLayersURL( $title ) : '#debug'
			];
			$links['actions']['editlayers-debug'] = $debugTab;
			$links['views']['editlayers-debug'] = $debugTab;
			$log( 'Debug mode: injected editlayers-debug action AND view tab' );
		}
	}

	/**
	 * Add "Edit Layers" tab using universal hook signature for newer MW versions.
	 * @param mixed $skin
	 * @param array &$links
	 */
	public static function onSkinTemplateNavigation__Universal( $skin, array &$links ): void {
		// Reuse the main implementation; Skin or SkinTemplate exposes getTitle/getUser in modern MW
		self::onSkinTemplateNavigation( $skin, $links );
	}

	/**
	 * Generate URL for editing layers
	* @param mixed $title
	 * @return string
	 */
    private static function getEditLayersURL( $title ): string {
		return $title->getLocalURL( [ 'action' => 'editlayers' ] );
	}

	/**
	 * Handle edit layers action
	* @param string $action
	* @param mixed $article
	 * @return bool
	 */
    public static function onUnknownAction( string $action, $article ): bool {
		if ( $action !== 'editlayers' ) {
			return true;
		}

		$title = $article->getTitle();
		$user = $article->getContext()->getUser();
		$out = $article->getContext()->getOutput();

		// Check permissions
		if ( !$user->isAllowed( 'editlayers' ) ) {
			$out->showErrorPage( 'permissionserrorstext-withaction', 'layers-editor-title' );
			return false;
		}

		// Check if it's a file page
		if ( !$title->inNamespace( NS_FILE ) ) {
			$out->showErrorPage( 'error', 'layers-not-file-page' );
			return false;
		}

		// Check if file exists
		$services = class_exists( '\\MediaWiki\\MediaWikiServices' )
			? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
			: null;
		$repoGroup = $services ? $services->getRepoGroup() : null;
		$file = $repoGroup ? $repoGroup->findFile( $title ) : null;
		if ( !$file || !$file->exists() ) {
			$out->showErrorPage( 'error', 'layers-file-not-found' );
			return false;
		}

		self::showLayersEditor( $out, $file );
		return false;
	}

	/**
	 * Show the layers editor interface
	* @param mixed $out
	* @param mixed $file
	 */
	private static function showLayersEditor( $out, $file ): void {
		// Set page title
		$titleText = ( \function_exists( 'wfMessage' ) ? \wfMessage( 'layers-editor-title' )->text() : 'Layers Editor' );
		$out->setPageTitle( $titleText . ': ' . $file->getName() );

		// Add editor resources
		$out->addModules( 'ext.layers.editor' );


		// Pass editor init config via JS config vars for CSP-safe startup
		$fileUrl = self::getPublicImageUrl( $file );
		$out->addJsConfigVars( 'wgLayersEditorInit', [
			'filename' => $file->getName(),
			'imageUrl' => $fileUrl,
		] );

	}

	/**
	 * Resolve a best-effort public URL for the image, with a robust fallback for private repos.
	 * @param mixed $file
	 * @return string
	 */
	private static function getPublicImageUrl( $file ): string {
		try {
			// Prefer direct URL when available
			if ( method_exists( $file, 'getFullUrl' ) ) {
				$direct = $file->getFullUrl();
				if ( is_string( $direct ) && $direct !== '' ) {
					return $direct;
				}
			}
		} catch ( \Throwable $e ) {
			// ignore and try fallback
		}

		// Fallback: Special:Redirect/file/Title to stream file through MediaWiki
		try {
			$title = method_exists( $file, 'getTitle' ) ? $file->getTitle() : null;
			if ( $title && \class_exists( '\\SpecialPage' ) ) {
				$param = 'file/' . $title->getPrefixedDBkey();
				$spTitle = \call_user_func( [ '\\SpecialPage', 'getTitleFor' ], 'Redirect', $param );
				if ( $spTitle ) {
					return $spTitle->getLocalURL();
				}
			}
		} catch ( \Throwable $e ) {
			// last resort below
		}

		// Last resort: return description URL
		return method_exists( $file, 'getUrl' ) ? (string)$file->getUrl() : '';
	}

	/**
	* (Removed) ThumbnailBeforeProduceHTML handled in WikitextHooks to avoid duplication.
	*/
}
