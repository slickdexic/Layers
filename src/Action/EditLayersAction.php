<?php

declare( strict_types=1 );

/**
 * EditLayersAction - dedicated Action to render the Layers editor
 */

namespace MediaWiki\Extension\Layers\Action;

use MediaWiki\Extension\Layers\Utility\ForeignFileHelper;

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

		// Debug logging for iframe issues
		$logger = \MediaWiki\Logger\LoggerFactory::getInstance( 'Layers' );
		$logger->debug( sprintf(
			'EditLayersAction::show - user=%s, id=%d, registered=%s, request=%s',
			$user->getName(),
			$user->getId(),
			$user->isRegistered() ? 'yes' : 'no',
			$request->getRequestURL()
		) );

		// Check permission using PermissionManager (same pattern as SpecialEditSlide)
		$services = \MediaWiki\MediaWikiServices::getInstance();
		$permissionManager = $services->getPermissionManager();
		$hasPermission = $permissionManager->userHasRight( $user, 'editlayers' );

		$logger->debug( sprintf(
			'EditLayersAction::show - hasPermission=%s',
			$hasPermission ? 'yes' : 'no'
		) );

		if ( !$hasPermission ) {
			throw new \PermissionsError( 'editlayers' );
		}

		if ( !$title || !$title->inNamespace( NS_FILE ) ) {
			$out->showErrorPage( 'error', 'layers-not-file-page' );
			return;
		}

		$repoGroup = \MediaWiki\MediaWikiServices::getInstance()->getRepoGroup();
		$file = $repoGroup->findFile( $title );
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
			$returnTitle = \MediaWiki\Title\Title::newFromText( $returnTo );
			if ( $returnTitle && $returnTitle->isKnown() ) {
				$returnToUrl = $returnTitle->getLocalURL();
			}
		}

		// Check if editor is in modal mode
		$isModalMode = $request->getBool( 'modal' );

		// In modal mode, allow the page to be framed (loaded in iframe)
		// Otherwise MediaWiki's default X-Frame-Options header blocks it
		if ( $isModalMode ) {
			// Use method_exists for compatibility across MediaWiki versions
			// allowClickjacking was deprecated in MW 1.43
			if ( method_exists( $out, 'allowClickjacking' ) ) {
				$out->allowClickjacking();
			} elseif ( method_exists( $out, 'setPreventClickjacking' ) ) {
				$out->setPreventClickjacking( false );
			}
		}

		// Page title
		$out->setPageTitle(
			wfMessage( 'layers-editor-title' )->text()
			. ': ' . $file->getName()
		);

		// Load editor module
		$out->addModules( 'ext.layers.editor' );

		// Init config via JS config vars; module will bootstrap itself
		$fileUrl = $this->getPublicImageUrl( $file );
		$isForeign = ForeignFileHelper::isForeignFile( $file );

		// Log URL generation for troubleshooting foreign file issues
		$logger = \MediaWiki\Logger\LoggerFactory::getInstance( 'Layers' );
		$logger->debug( sprintf(
			'EditLayersAction: file=%s, class=%s, isForeign=%s, url=%s',
			$file->getName(),
			get_class( $file ),
			$isForeign ? 'yes' : 'no',
			$fileUrl
		) );

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

		// NOTE: We do NOT set a custom CSP header for foreign files.
		// The image URL for foreign files is already a local proxy (Special:Redirect/file),
		// so no img-src exception is needed. Setting script-src 'self' was breaking
		// ResourceLoader module loading. See GitHub issue #52.

		// Add basic HTML content to ensure page has content
		$out->addHTML( '<div id="layers-editor-container"></div>' );

		// The editor will auto-initialize using the LayersEditor.js bootstrap code
		// No inline scripts needed - CSP compliance is maintained
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
		$isForeign = ForeignFileHelper::isForeignFile( $file );
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
			if ( $filename ) {
				$param = 'file/' . $filename;
				$spTitle = \SpecialPage::getTitleFor( 'Redirect', $param );
				if ( $spTitle ) {
					// For TIFF and other non-web formats, request a large thumbnail
					// MediaWiki will generate a PNG/JPEG that browsers can render
					if ( $needsThumbnail ) {
						$url = $spTitle->getLocalURL( [ 'width' => 2048 ] );
					} else {
						$url = $spTitle->getLocalURL();
					}
					// Log redirect URL for troubleshooting
					$logger = \MediaWiki\Logger\LoggerFactory::getInstance( 'Layers' );
					$logger->debug( sprintf(
						'getLocalRedirectUrl: filename=%s, needsThumbnail=%s, url=%s',
						$filename,
						$needsThumbnail ? 'yes' : 'no',
						$url
					) );
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
	 * Get the base URL for image access
	 *
	 * @return string
	 */
	private function getImageBaseUrl(): string {
		return $this->getContext()->getConfig()->get( 'UploadPath' ) . '/';
	}
}
