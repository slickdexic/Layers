<?php

/**
 * EditLayersAction - dedicated Action to render the Layers editor
 */

namespace MediaWiki\Extension\Layers\Action;

class EditLayersAction extends \Action {

	/** @inheritDoc */
	public function getName() {
		return 'editlayers';
	}

	/** @inheritDoc */
	public function requiresWrite() {
		return false;
	}

	/** @inheritDoc */
	public function requiresUnblock() {
		return false;
	}

	/** @inheritDoc */
	public function show() {
		$out = $this->getOutput();
		$user = $this->getUser();
		$title = $this->getTitle();
		$request = $this->getRequest();

		// Check permission using Authority (modern MW 1.36+) or PermissionManager
		$hasPermission = false;
		$services = class_exists( '\\MediaWiki\\MediaWikiServices' )
			? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
			: null;

		if ( $services && method_exists( $services, 'getPermissionManager' ) ) {
			// Use PermissionManager (MW 1.33+)
			$permManager = $services->getPermissionManager();
			$hasPermission = $permManager->userHasRight( $user, 'editlayers' );
		} elseif ( method_exists( $this, 'getAuthority' ) ) {
			// Use Authority interface (MW 1.36+)
			$authority = $this->getAuthority();
			$hasPermission = $authority->isAllowed( 'editlayers' );
		} elseif ( method_exists( $user, 'isAllowed' ) ) {
			// Legacy fallback
			$hasPermission = $user->isAllowed( 'editlayers' );
		}

		if ( !$hasPermission ) {
			throw new \PermissionsError( 'editlayers' );
		}

		if ( !$title || !$title->inNamespace( NS_FILE ) ) {
			$out->showErrorPage( 'error', 'layers-not-file-page' );
			return;
		}

		$services = class_exists( '\\MediaWiki\\MediaWikiServices' )
			? \call_user_func( [ '\\MediaWiki\\MediaWikiServices', 'getInstance' ] )
			: null;
		$repoGroup = $services ? $services->getRepoGroup() : null;
		$file = $repoGroup ? $repoGroup->findFile( $title ) : null;
		if ( !$file || !$file->exists() ) {
			$out->showErrorPage( 'error', 'layers-file-not-found' );
			return;
		}

		// Get optional layer set name from URL (deep linking support)
		// Accepts: ?setname=anatomy, ?layerset=anatomy, or &layers=anatomy
		$initialSetName = $request->getText( 'setname', '' );
		if ( $initialSetName === '' ) {
			$initialSetName = $request->getText( 'layerset', '' );
		}
		if ( $initialSetName === '' ) {
			$initialSetName = $request->getText( 'layers', '' );
		}
		// Sanitize: only allow alphanumeric, hyphens, underscores
		if ( $initialSetName !== '' && !preg_match( '/^[a-zA-Z0-9_-]+$/', $initialSetName ) ) {
			$initialSetName = '';
		}

		// Check if auto-create is requested (for layerslink=editor to non-existent sets)
		$autoCreate = $request->getBool( 'autocreate' );
		// Also check for createlayers permission if auto-create is requested
		$canCreateLayers = false;
		if ( $autoCreate ) {
			if ( $services && method_exists( $services, 'getPermissionManager' ) ) {
				$permManager = $services->getPermissionManager();
				$canCreateLayers = $permManager->userHasRight( $user, 'createlayers' );
			} elseif ( method_exists( $user, 'isAllowed' ) ) {
				$canCreateLayers = $user->isAllowed( 'createlayers' );
			}
			// Only allow auto-create if user has createlayers permission
			if ( !$canCreateLayers ) {
				$autoCreate = false;
			}
		}

		// Get return URL for editor-return mode
		$returnTo = $request->getText( 'returnto', '' );
		$returnToUrl = null;
		if ( $returnTo !== '' ) {
			// Validate returnto is a valid title to prevent open redirects
			// Use fully qualified class name for MW 1.44+ compatibility
			$titleClass = class_exists( '\\MediaWiki\\Title\\Title' )
				? '\\MediaWiki\\Title\\Title'
				: '\\Title';
			$returnTitle = $titleClass::newFromText( $returnTo );
			if ( $returnTitle && $returnTitle->isKnown() ) {
				$returnToUrl = $returnTitle->getLocalURL();
			}
		}

		// Check if editor is in modal mode
		$isModalMode = $request->getBool( 'modal' );

		// Page title
		$out->setPageTitle(
			( function_exists( 'wfMessage' )
				? wfMessage( 'layers-editor-title' )->text()
				: 'Edit Layers'
			) . ': ' . $file->getName()
		);

		// Load editor module
		$out->addModules( 'ext.layers.editor' );

		// Init config via JS config vars; module will bootstrap itself
		$fileUrl = $this->getPublicImageUrl( $file );
		$isForeign = $this->isForeignFile( $file );

		// DEBUG: Log what URL we're generating for debugging
		if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
			$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
			$logger->debug( sprintf(
				'EditLayersAction: file=%s, class=%s, isForeign=%s, url=%s',
				$file->getName(),
				get_class( $file ),
				$isForeign ? 'yes' : 'no',
				$fileUrl
			) );
		}

		$config = \MediaWiki\MediaWikiServices::getInstance()->getMainConfig();
		$out->addJsConfigVars( [
			'wgLayersEditorInit' => [
				'filename' => $file->getName(),
				'imageUrl' => $fileUrl,
				'debug_isForeign' => $isForeign, // DEBUG: Include in JS config for inspection
				'initialSetName' => $initialSetName !== '' ? $initialSetName : null,
				'autoCreate' => $autoCreate,
				'returnToUrl' => $returnToUrl,
				'isModalMode' => $isModalMode,
			],
			'wgLayersReturnToUrl' => $returnToUrl,
			'wgLayersIsModalMode' => $isModalMode,
			'wgLayersCurrentImageUrl' => $fileUrl,
			'wgLayersImageBaseUrl' => $this->getImageBaseUrl(),
			'wgLayersMaxImageBytes' => $config->get( 'LayersMaxImageBytes' ),
			'wgLayersMaxNamedSets' => $config->get( 'LayersMaxNamedSets' ),
			'wgLayersMaxRevisionsPerSet' => $config->get( 'LayersMaxRevisionsPerSet' ),
			'wgLayersDefaultSetName' => $config->get( 'LayersDefaultSetName' ),
		] );

		// Add basic HTML content to ensure page has content
		$out->addHTML( '<div id="layers-editor-container"></div>' );

		// The editor will auto-initialize using the LayersEditor.js bootstrap code
		// No inline scripts needed - CSP compliance is maintained
	}

	/**
	 * Check if a file is from a foreign repository (like InstantCommons)
	 *
	 * @param mixed $file File object
	 * @return bool True if the file is from a foreign repository
	 */
	private function isForeignFile( $file ): bool {
		// Check for ForeignAPIFile or ForeignDBFile
		if ( $file instanceof \ForeignAPIFile || $file instanceof \ForeignDBFile ) {
			return true;
		}

		// Check using class name (for namespaced classes)
		$className = get_class( $file );
		if ( strpos( $className, 'Foreign' ) !== false ) {
			return true;
		}

		// Check if the file's repo is foreign
		if ( method_exists( $file, 'getRepo' ) ) {
			$repo = $file->getRepo();
			if ( $repo && method_exists( $repo, 'isLocal' ) && !$repo->isLocal() ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Resolve a best-effort public URL for the image, with a robust fallback for private repos.
	 *
	 * For foreign files (InstantCommons, etc.), we prefer the local Special:Redirect/file
	 * proxy to avoid CORS issues when loading images into the canvas editor.
	 *
	 * @param mixed $file
	 * @return string
	 */
	private function getPublicImageUrl( $file ): string {
		$isForeign = $this->isForeignFile( $file );

		// For foreign files, prefer local redirect to avoid CORS issues
		if ( $isForeign ) {
			$redirectUrl = $this->getLocalRedirectUrl( $file );
			if ( $redirectUrl !== '' ) {
				return $redirectUrl;
			}
		}

		// For local files, try direct URL first (fastest)
		try {
			if ( method_exists( $file, 'getFullUrl' ) ) {
				$direct = $file->getFullUrl();
				if ( is_string( $direct ) && $direct !== '' ) {
					return $direct;
				}
			}
		} catch ( \Throwable $e ) {
			// ignore and try fallback
		}

		// Fallback via Special:Redirect/file
		$redirectUrl = $this->getLocalRedirectUrl( $file );
		if ( $redirectUrl !== '' ) {
			return $redirectUrl;
		}

		return method_exists( $file, 'getUrl' ) ? (string)$file->getUrl() : '';
	}

	/**
	 * Get a local redirect URL for a file via Special:Redirect/file
	 *
	 * @param mixed $file File object
	 * @return string Local redirect URL or empty string if unavailable
	 */
	private function getLocalRedirectUrl( $file ): string {
		try {
			// Use the file's name directly (without namespace prefix)
			// Special:Redirect/file expects just the filename, not File:Filename
			$filename = method_exists( $file, 'getName' ) ? $file->getName() : null;
			if ( $filename && \class_exists( '\\SpecialPage' ) ) {
				$param = 'file/' . $filename;
				$spTitle = \call_user_func( [ '\\SpecialPage', 'getTitleFor' ], 'Redirect', $param );
				if ( $spTitle ) {
					$url = $spTitle->getLocalURL();
					// DEBUG: Log the redirect URL
					if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
						$logger->debug( sprintf( 'getLocalRedirectUrl: filename=%s, url=%s', $filename, $url ) );
					}
					return $url;
				}
			}
		} catch ( \Throwable $e ) {
			// Return empty string on failure
		}
		return '';
	}

	/**
	 * Get the base URL for image access
	 *
	 * @return string
	 */
	private function getImageBaseUrl(): string {
		global $wgUploadPath;
		return $wgUploadPath . '/';
	}
}
