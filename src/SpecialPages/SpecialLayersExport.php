<?php

declare( strict_types=1 );

/**
 * Special:LayersExport - authenticated delivery of generated PDF exports.
 *
 * @file
 * @ingroup Extensions
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\SpecialPages;

use MediaWiki\Extension\Layers\Utility\ForeignFileHelper;
use MediaWiki\Extension\Layers\Utility\RenderCache;
use MediaWiki\MediaWikiServices;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;

/**
 * Streams a PDF produced by the `layerspdfexport` API module.
 *
 * Exports are full-content flattened renders of a file plus its annotations.
 * They used to be written into the public upload tree and handed to the client
 * as a direct `$wgUploadPath` URL, which made them readable by anyone who
 * learned the URL regardless of the file's own read restrictions, and left them
 * readable after the file was deleted.
 *
 * They now live outside the document root and are served only through this
 * page, which re-checks `read` on the source file for the current user.
 *
 * The on-disk name is `<sha1>_<key>.pdf`, and the SHA1 half is taken from the
 * file the caller has just proven they may read. A caller therefore cannot use
 * a guessed or borrowed `key` to reach an export of some *other* file: the
 * worst case is reaching a differently-parameterised export of a file they are
 * already entitled to read.
 */
class SpecialLayersExport extends SpecialPage {

	/** Cache keys are md5 hex digests produced by ApiLayersExport. */
	private const KEY_PATTERN = '/^[0-9a-f]{32}$/';

	public function __construct() {
		parent::__construct( 'LayersExport' );
	}

	/**
	 * @inheritDoc
	 */
	public function execute( $subPage ) {
		$request = $this->getRequest();
		$filename = (string)$request->getText( 'file' );
		$key = (string)$request->getText( 'key' );

		$path = $this->resolveExportPath( $filename, $key );
		if ( $path === null ) {
			$this->setHeaders();
			$this->getOutput()->showErrorPage( 'error', 'layers-export-not-found' );
			return;
		}

		$this->streamPdf( $path, $filename, $request->getBool( 'download' ) );
	}

	/**
	 * Resolve the on-disk export for a request, or null if it may not be served.
	 *
	 * Returns null for every failure mode (bad input, missing file, no read
	 * permission, no such export) so the response cannot be used to probe for
	 * the existence of files the caller cannot read.
	 *
	 * @param string $filename Requested file name
	 * @param string $key Export cache key
	 * @return string|null Absolute path to the PDF, or null
	 */
	private function resolveExportPath( string $filename, string $key ): ?string {
		if ( $filename === '' || !preg_match( self::KEY_PATTERN, $key ) ) {
			return null;
		}

		$title = Title::newFromText( $filename, NS_FILE );
		if ( !$title || $title->getNamespace() !== NS_FILE ) {
			return null;
		}

		$services = MediaWikiServices::getInstance();
		if ( !$services->getPermissionManager()->userCan( 'read', $this->getUser(), $title ) ) {
			return null;
		}

		$file = $services->getRepoGroup()->findFile( $title );
		if ( !$file || !$file->exists() ) {
			return null;
		}

		$sha1 = ForeignFileHelper::getFileSha1( $file, $title->getDBkey() );
		$fileKey = RenderCache::artefactKey( $sha1 );
		if ( $fileKey === '' ) {
			return null;
		}

		$path = RenderCache::getExportDir( $this->getConfig() ) . '/' . $fileKey . '_' . $key . '.pdf';
		return is_file( $path ) ? $path : null;
	}

	/**
	 * Send the PDF to the client.
	 *
	 * @param string $path Absolute path to an existing PDF
	 * @param string $filename Source file name, used for the download name
	 * @param bool $asAttachment Save to disk instead of opening a viewer
	 */
	private function streamPdf( string $path, string $filename, bool $asAttachment = false ): void {
		$out = $this->getOutput();
		$out->disable();

		$size = filesize( $path );
		$response = $this->getRequest()->response();
		$response->header( 'Content-Type: application/pdf' );
		$response->header( 'X-Content-Type-Options: nosniff' );
		// Exports vary per user permission; never let a shared cache hold one.
		$response->header( 'Cache-Control: private, no-cache, must-revalidate' );
		$response->header(
			'Content-Disposition: ' . ( $asAttachment ? 'attachment' : 'inline' ) .
			'; filename="' . $this->downloadName( $filename ) . '"'
		);
		if ( $size !== false ) {
			$response->header( 'Content-Length: ' . $size );
		}

		if ( function_exists( 'wfResetOutputBuffers' ) ) {
			wfResetOutputBuffers();
		}
		readfile( $path );
	}

	/**
	 * Build a safe `filename=` value for the Content-Disposition header.
	 *
	 * @param string $filename Source file name
	 * @return string ASCII name with no quotes, control characters or separators
	 */
	private function downloadName( string $filename ): string {
		$base = pathinfo( str_replace( [ '\\', '/' ], '_', $filename ), PATHINFO_FILENAME );
		$base = preg_replace( '/[^A-Za-z0-9._-]/', '_', $base ) ?? '';
		$base = trim( substr( $base, 0, 100 ), '._-' );
		return ( $base === '' ? 'export' : $base ) . '.pdf';
	}

	/**
	 * @inheritDoc
	 */
	public function isListed() {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function getDescription() {
		return $this->msg( 'layers-export-page-title' );
	}

	/**
	 * @inheritDoc
	 */
	protected function getGroupName() {
		return 'layers';
	}
}
