<?php

/**
 * UI Integration hooks for the Layers extension
 * Handles file page tabs and UI enhancements
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Hooks;

// Intentionally avoid hard dependency imports here; use services at runtime

// Define constants if not already defined (for static analysis/local tools)
if ( !\defined( 'NS_FILE' ) ) {
	\define( 'NS_FILE', 6 );
}

class UIHooks {
	/**
	 * Add "Edit Layers" tab to file pages
	 * @param mixed $sktemplate SkinTemplate or Skin
	 * @param array &$links Navigation links bucket
	 */
	public static function onSkinTemplateNavigation( $sktemplate, array &$links ): void {
	// Debug flag comes from config; request param can only narrow when config already enabled
		$dbg = false;
		$req = null;
		try {
			$cfg = ( is_object( $sktemplate ) && method_exists( $sktemplate, 'getConfig' ) )
				? $sktemplate->getConfig()
				: null;
			if ( $cfg && method_exists( $cfg, 'get' ) ) {
				$dbgCfg = (bool)$cfg->get( 'LayersDebug' );
			} else {
				$dbgCfg = false;
			}
			if ( is_object( $sktemplate ) ) {
				$req = method_exists( $sktemplate, 'getRequest' )
					? $sktemplate->getRequest()
					: ( method_exists( $sktemplate, 'getContext' )
						? $sktemplate->getContext()->getRequest()
						: null );
				if ( $req && method_exists( $req, 'getVal' ) ) {
					$paramDbg = $req->getVal( 'layersdebug' );
					// Only honor request param when config debug is enabled
					if ( $dbgCfg && $paramDbg !== null ) {
						$val = strtolower( trim( (string)$paramDbg ) );
						if ( $val === '1' || $val === 'true' || $val === 'yes' ) {
							$dbg = true;
						} elseif ( $val === '0' || $val === 'false' || $val === 'no' ) {
							$dbg = false;
						}
					}
				}
			}
			// Default to config if request param didn't set it
			if ( !isset( $dbg ) || $dbg === false ) {
				$dbg = (bool)$dbgCfg;
			}
		} catch ( \Throwable $e ) {
		}
		$log = static function ( $msg ) use ( $dbg ) {
			if ( !$dbg ) {
				return;
			}
			try {
				if ( \class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
					$logger->info( '[Tab] ' . $msg );
				}
			} catch ( \Throwable $e ) {
			}
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

		// Only add to file pages
		if ( !$title || !$title->inNamespace( NS_FILE ) ) {
			$log( 'Skip: not a file page - title: ' . ( $title ? $title->getFullText() : 'null' ) );
			return;
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

		// Check editlayers permission using PermissionManager for consistency
		$hasEditLayersPermission = false;
		try {
			$services = class_exists( '\\MediaWiki\\MediaWikiServices' )
				? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
				: null;
			if ( $services && method_exists( $services, 'getPermissionManager' ) ) {
				$permManager = $services->getPermissionManager();
				$hasEditLayersPermission = $permManager->userHasRight( $user, 'editlayers' );
			} elseif ( $user && method_exists( $user, 'isAllowed' ) ) {
				$hasEditLayersPermission = $user->isAllowed( 'editlayers' );
			}
		} catch ( \Throwable $e ) {
			// If permission check fails, default to false
			$hasEditLayersPermission = false;
		}

		if ( !$hasEditLayersPermission ) {
			$userGroups = [];
			if ( $user && method_exists( $user, 'getEffectiveGroups' ) ) {
				$userGroups = $user->getEffectiveGroups();
			}
			$log( 'Skip: user missing editlayers permission - user groups: ' . implode( ',', $userGroups ) );
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
				$req = method_exists( $sktemplate, 'getRequest' )
					? $sktemplate->getRequest()
					: ( method_exists( $sktemplate, 'getContext' )
						? $sktemplate->getContext()->getRequest()
						: null );
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

	// Insert the edit layers tab after the edit tab, or after view/read if no edit tab
		$newViews = [];
		$inserted = false;
		foreach ( $links['views'] as $key => $tab ) {
			$newViews[$key] = $tab;
			// Insert after edit/ve-edit tabs
			if ( $key === 'edit' || $key === 've-edit' ) {
				$newViews['editlayers'] = $editLayersTab;
				$inserted = true;
			}
		}
		if ( !$inserted ) {
			// No edit tab found - insert after view/read tab, or append at end
			$newViews = [];
			foreach ( $links['views'] as $key => $tab ) {
				$newViews[$key] = $tab;
				if ( $key === 'view' || $key === 'read' ) {
					$newViews['editlayers'] = $editLayersTab;
					$inserted = true;
				}
			}
			// If still not inserted (no view tab either), append at end
			if ( !$inserted ) {
				$newViews['editlayers'] = $editLayersTab;
			}
		}
		$links['views'] = $newViews;

		// Also expose as an action for skins that render actions separately
		if ( !isset( $links['actions']['editlayers'] ) ) {
			$links['actions']['editlayers'] = $editLayersTab;
			$log( 'Inserted into actions' );
		}
		$log( 'Inserted into views (after edit when present)' );

		// Optional: when debugging, add a subtle debug-only action alongside the normal tab
		if ( $dbg ) {
			$debugTab = [
				'class' => false,
				'text' => 'Edit Layers (DEBUG)',
				'href' => self::getEditLayersURL( $title ),
				'context' => 'actions',
			];
			$links['actions']['editlayers-debug'] = $debugTab;
			$log( 'Debug mode: injected editlayers-debug action' );
		}
	}

	/* phpcs:disable MediaWiki.NamingConventions.LowerCamelFunctionsName.FunctionName */

	/**
	 * Universal SkinTemplateNavigation hook for newer MW versions.
	 * Delegates to onSkinTemplateNavigation to avoid duplication.
	 *
	 * @param mixed $skin Skin or SkinTemplate
	 * @param array &$links Navigation array (modified by reference)
	 * @return void
	 */
	public static function onSkinTemplateNavigation__Universal(
		$skin,
		array &$links
	): void {
		self::onSkinTemplateNavigation( $skin, $links );
	}

	/* phpcs:enable MediaWiki.NamingConventions.LowerCamelFunctionsName.FunctionName */

	/**
	 * Generate URL for editing layers
	 * @param mixed $title
	 * @return string
	 */
	private static function getEditLayersURL( $title ): string {
		return $title->getLocalURL( [ 'action' => 'editlayers' ] );
	}
}
