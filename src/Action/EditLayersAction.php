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
		// Auto-create is allowed for any user with editlayers permission (already checked above)
		$autoCreate = $request->getBool( 'autocreate' );

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
				: 'Edit layers'
			) . ': ' . $file->getName()
		);

		// Load editor module
		$out->addModules( 'ext.layers.editor' );

		// Init config via JS config vars; module will bootstrap itself
		$fileUrl = $this->getPublicImageUrl( $file );
		$isForeign = $this->isForeignFile( $file );

		// Log URL generation for troubleshooting foreign file issues
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
			// Foreign file flag for client-side handling
			'debug_isForeign' => $isForeign,
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

		// Add CSP header for foreign files to allow loading from their origin
		if ( $isForeign ) {
			$this->addForeignFileCsp( $out, $file, $config );
		}

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
	 * For TIFF and other non-web-native formats, we request a thumbnail instead of
	 * the original file since browsers cannot render TIFF directly.
	 *
	 * @param mixed $file
	 * @return string
	 */
	private function getPublicImageUrl( $file ): string {
		$isForeign = $this->isForeignFile( $file );
		$filename = method_exists( $file, 'getName' ) ? $file->getName() : '';
		$needsThumbnail = $this->isNonWebFormat( $filename );

		// For foreign files OR non-web formats (TIFF, etc.), use redirect with optional width
		if ( $isForeign || $needsThumbnail ) {
			$redirectUrl = $this->getLocalRedirectUrl( $file, $needsThumbnail );
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

		// Fallback via Special:Redirect/file (still needs thumbnail for TIFF)
		$redirectUrl = $this->getLocalRedirectUrl( $file, $needsThumbnail );
		if ( $redirectUrl !== '' ) {
			return $redirectUrl;
		}

		return method_exists( $file, 'getUrl' ) ? (string)$file->getUrl() : '';
	}

	/**
	 * Get a local redirect URL for a file via Special:Redirect/file
	 *
	 * For TIFF and other non-web-native formats, we add a width parameter
	 * to request a thumbnail that browsers can actually render.
	 *
	 * @param mixed $file File object
	 * @param bool $needsThumbnail Whether to request a thumbnail (for TIFF, etc.)
	 * @return string Local redirect URL or empty string if unavailable
	 */
	private function getLocalRedirectUrl( $file, bool $needsThumbnail = false ): string {
		try {
			// Use the file's name directly (without namespace prefix)
			// Special:Redirect/file expects just the filename, not File:Filename
			$filename = method_exists( $file, 'getName' ) ? $file->getName() : null;
			if ( $filename && \class_exists( '\\SpecialPage' ) ) {
				$param = 'file/' . $filename;
				$spTitle = \call_user_func( [ '\\SpecialPage', 'getTitleFor' ], 'Redirect', $param );
				if ( $spTitle ) {
					// For TIFF and other non-web formats, request a large thumbnail
					// MediaWiki will generate a PNG/JPEG that browsers can render
					if ( $needsThumbnail ) {
						$url = $spTitle->getLocalURL( [ 'width' => 2048 ] );
					} else {
						$url = $spTitle->getLocalURL();
					}
					// Log redirect URL for troubleshooting
					if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
						$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
						$logger->debug( sprintf(
							'getLocalRedirectUrl: filename=%s, needsThumbnail=%s, url=%s',
							$filename,
							$needsThumbnail ? 'yes' : 'no',
							$url
						) );
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
	 * Check if a filename has a non-web-native format extension
	 *
	 * Non-web formats (TIFF, PSD, XCF, etc.) cannot be rendered directly
	 * by browsers and need to be converted to a thumbnail first.
	 *
	 * @param string $filename The filename to check
	 * @return bool True if the file has a non-web-native extension
	 */
	private function isNonWebFormat( string $filename ): bool {
		$nonWebFormats = [ 'tif', 'tiff', 'xcf', 'psd', 'ai', 'eps', 'pdf' ];
		$ext = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
		return in_array( $ext, $nonWebFormats, true );
	}

	/**
	 * Add Content Security Policy header for foreign files
	 *
	 * When editing a foreign file (from InstantCommons, etc.), we need to allow
	 * the browser to load images from the foreign origin.
	 *
	 * @param mixed $out OutputPage
	 * @param mixed $file File object
	 * @param mixed $config Main config
	 */
	private function addForeignFileCsp( $out, $file, $config ): void {
		try {
			// Get the file URL and extract its origin
			$fileUrl = $file->getUrl();
			if ( !$fileUrl ) {
				return;
			}

			$parsed = parse_url( $fileUrl );
			if ( !$parsed || empty( $parsed['host'] ) ) {
				return;
			}

			$scheme = $parsed['scheme'] ?? 'https';
			$foreignOrigin = $scheme . '://' . $parsed['host'];

			// Get server origin for local resources
			$serverUrl = $config->get( 'Server' );
			$serverOrigin = '';
			if ( $serverUrl ) {
				if ( strpos( $serverUrl, '//' ) === 0 ) {
					$isHttps = isset( $_SERVER['HTTPS'] ) && $_SERVER['HTTPS'] === 'on';
					$serverOrigin = ( $isHttps ? 'https:' : 'http:' ) . $serverUrl;
				} else {
					$serverOrigin = $serverUrl;
				}
			}

			// Build CSP policy
			$policy = [];
			$policy[] = "default-src 'self'" . ( $serverOrigin ? " $serverOrigin" : '' );
			$policy[] = "img-src 'self' data: blob: $foreignOrigin" . ( $serverOrigin ? " $serverOrigin" : '' );
			$policy[] = "style-src 'self' 'unsafe-inline'";
			$policy[] = "script-src 'self' 'unsafe-eval' 'unsafe-inline'";
			$policy[] = "connect-src 'self'" . ( $serverOrigin ? " $serverOrigin" : '' );
			$policy[] = "font-src 'self' data:";
			$policy[] = "object-src 'none'";
			$policy[] = "base-uri 'self'";

			$header = 'Content-Security-Policy: ' . implode( '; ', $policy );

			// Try different methods to set the header
			if ( method_exists( $out, 'addExtraHeader' ) ) {
				$out->addExtraHeader( $header );
			} elseif ( function_exists( 'header' ) && !headers_sent() ) {
				header( $header );
			}

			// Log for debugging
			if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->debug( 'EditLayersAction: Added CSP for foreign origin: ' . $foreignOrigin );
			}
		} catch ( \Throwable $e ) {
			// Silently fail - CSP is a security enhancement, not critical
			if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->warning( 'EditLayersAction: Failed to add CSP: ' . $e->getMessage() );
			}
		}
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
