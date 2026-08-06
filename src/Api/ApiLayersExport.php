<?php

declare( strict_types=1 );

/**
 * API module for exporting a marked-up file as a flattened PDF.
 *
 * For a (multi-page) file this renders each page's background raster with its
 * saved layer set composited on top (via ThumbnailRenderer), then stitches the
 * per-page images into a single PDF using ImageMagick. The generated PDF is
 * cached outside the document root and a Special:LayersExport URL is returned,
 * so delivery re-checks the caller's `read` permission on the source file.
 *
 * This is a read-only operation (no CSRF token): it never mutates layer data.
 * It is rate limited under the 'render' key because rasterisation + compositing
 * is expensive.
 *
 * @file
 * @ingroup Extensions
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Api;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiResult;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait;
use MediaWiki\Extension\Layers\Api\Traits\LayersApiHelperTrait;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use MediaWiki\Extension\Layers\Utility\RenderCache;
use MediaWiki\Extension\Layers\Utility\SetNameResolver;
use MediaWiki\MediaWikiServices;
use MediaWiki\Shell\Shell;
use MediaWiki\SpecialPage\SpecialPage;
use Wikimedia\ParamValidator\ParamValidator;

class ApiLayersExport extends ApiBase {
	use ForeignFileHelperTrait;
	use LayersApiHelperTrait;

	/**
	 * @param ApiMain $main
	 * @param string $action
	 */
	public function __construct( ApiMain $main, $action ) {
		parent::__construct( $main, $action );
	}

	/**
	 * Execute the API request.
	 *
	 * @throws ApiUsageException
	 */
	public function execute() {
		try {
			$this->executeInternal();
		} catch ( ApiUsageException $e ) {
			throw $e;
		} catch ( \Throwable $e ) {
			$this->getLogger()->error(
				'Layers export failed: {message}',
				[ 'message' => $e->getMessage(), 'exception' => $e ]
			);
			$this->dieWithError( 'layers-export-pdf-failed', 'exportfailed' );
		}
	}

	/**
	 * Internal execution logic.
	 *
	 * @throws ApiUsageException
	 */
	private function executeInternal(): void {
		$user = $this->getUser();

		// Rate limit: rasterisation + compositing is expensive.
		$rateLimiter = $this->createRateLimiter();
		if ( !$rateLimiter->checkRateLimit( $user, 'render' ) ) {
			$this->dieWithError( LayersConstants::ERROR_RATE_LIMITED, 'ratelimited' );
		}

		$params = $this->extractRequestParams();
		$filename = (string)( $params['filename'] ?? '' );
		if ( $filename === '' ) {
			$this->dieWithError( [ 'apierror-missingparam', 'filename' ], 'missingparam' );
		}

		// Validate file + read permission.
		$fileInfo = $this->validateAndGetFile( $filename );
		$title = $fileInfo['title'];
		$file = $fileInfo['file'];
		$imgName = $fileInfo['imgName'];

		$permissionManager = MediaWikiServices::getInstance()->getPermissionManager();
		if ( !$permissionManager->userCan( 'read', $user, $title ) ) {
			$this->dieWithError( 'badaccess-group0', 'permissiondenied' );
		}

		$db = $this->getLayersDatabase();
		$this->requireSchemaReady( $db );

		$sha1 = $this->getFileSha1( $file, $imgName );
		$pageCount = $this->getPageCount( $file );

		// Set names are user-defined, so an unnamed request resolves to whatever
		// this file's most recent set is called rather than to a fixed name.
		$setName = (string)( SetNameResolver::resolve(
			$db, $imgName, $sha1, $params['setname'] ?? null
		) ?? '' );

		$maxPages = (int)$this->getConfig()->get( 'LayersPdfExportMaxPages' );
		if ( $maxPages > 0 && $pageCount > $maxPages ) {
			$this->dieWithError(
				[ 'layers-export-too-many-pages', (string)$pageCount, (string)$maxPages ],
				'toomanypages'
			);
		}

		$width = (int)$this->getConfig()->get( 'LayersPdfExportWidth' );
		if ( isset( $params['width'] ) && (int)$params['width'] > 0 ) {
			$width = (int)$params['width'];
		}
		$width = max( 200, min( $width, 4096 ) );
		// Snap to 200px buckets. The width is part of the on-disk cache key, so an
		// unbounded attacker-controlled width would let a single reader cache-bust
		// with thousands of distinct values, each forcing a fresh (expensive)
		// rasterise + multi-page ImageMagick stitch and a new orphaned PDF on disk.
		$width = max( 200, min( (int)( round( $width / 200 ) * 200 ), 4096 ) );

		// Build a cache key that changes whenever any page's layer set changes.
		$pageMeta = [];
		for ( $page = 1; $page <= $pageCount; $page++ ) {
			$set = $db->getLayerSetByName( $imgName, $sha1, $setName, $page );
			$pageMeta[$page] = $set
				? ( (string)( $set['id'] ?? '' ) . ':' . (string)( $set['revision'] ?? '' ) .
					':' . (string)( $set['timestamp'] ?? '' ) )
				: 'none';
		}

		$cacheKey = md5( implode( '|', [
			$sha1, $setName, (string)$width, (string)$pageCount, implode( ',', $pageMeta ),
		] ) );

		$outputDir = $this->getExportDir();
		if ( $outputDir === null ) {
			$this->dieWithError( 'layers-export-pdf-failed', 'exportfailed' );
		}
		$outputPath = $outputDir . '/' . $sha1 . '_' . $cacheKey . '.pdf';

		$cached = false;
		if ( file_exists( $outputPath ) ) {
			$cached = true;
		} else {
			$pageImages = [];
			for ( $page = 1; $page <= $pageCount; $page++ ) {
				$imgPath = $this->renderPageImage(
					$file, $db, $imgName, $sha1, $setName, $page, $width, ( $pageMeta[$page] !== 'none' )
				);
				if ( $imgPath === null ) {
					continue;
				}
				$pageImages[] = $imgPath;
			}

			if ( count( $pageImages ) === 0 ) {
				$this->dieWithError( 'layers-export-pdf-failed', 'exportfailed' );
			}

			if ( !$this->stitchPdf( $pageImages, $outputPath ) ) {
				$this->dieWithError( 'layers-export-pdf-failed', 'exportfailed' );
			}
		}

		$url = $this->getExportUrl( $title, $cacheKey );

		$this->getResult()->addValue( null, $this->getModuleName(), [
			'success' => 1,
			'url' => $url,
			'pageCount' => $pageCount,
			'setname' => $setName,
			'cached' => $cached ? 1 : 0,
		], ApiResult::NO_SIZE_CHECK );
	}

	/**
	 * Render a single page as an image: the rasterised page background with its
	 * layer set composited on top (if any layers are saved for the page).
	 *
	 * @param mixed $file File object
	 * @param mixed $db LayersDatabase
	 * @param string $imgName Image DB key
	 * @param string $sha1 File SHA1
	 * @param string $setName Layer set name
	 * @param int $page 1-based page number
	 * @param int $width Render width in px
	 * @param bool $hasLayers Whether a layer set exists for this page
	 * @return string|null Filesystem path to the page image, or null on failure
	 */
	private function renderPageImage(
		$file, $db, string $imgName, string $sha1, string $setName, int $page, int $width, bool $hasLayers
	): ?string {
		if ( $hasLayers ) {
			$set = $db->getLayerSetByName( $imgName, $sha1, $setName, $page );
			$layers = $this->extractLayers( $set );
			if ( $layers ) {
				$renderer = $this->createThumbnailRenderer();
				$path = $renderer->generateLayeredThumbnail( $file, [
					'width' => $width,
					'page' => $page,
					'layers' => true,
					'layerData' => $layers,
				] );
				if ( $path && file_exists( $path ) ) {
					return $path;
				}
			}
		}

		// No layers (or compositing failed): use the plain rasterised page.
		return $this->basePageImage( $file, $width, $page );
	}

	/**
	 * Extract a flat layers array from a stored layer set structure.
	 *
	 * @param array|null $set Layer set row (with 'data')
	 * @return array Layers array (possibly empty)
	 */
	private function extractLayers( ?array $set ): array {
		if ( !$set || !isset( $set['data'] ) ) {
			return [];
		}
		$data = $set['data'];
		if ( is_array( $data ) ) {
			if ( isset( $data['layers'] ) && is_array( $data['layers'] ) ) {
				return $data['layers'];
			}
			// Data may itself be the layers array.
			if ( array_key_exists( 0, $data ) ) {
				return $data;
			}
		}
		return [];
	}

	/**
	 * Transform a file page to a plain background image and return its local path.
	 *
	 * @param mixed $file File object
	 * @param int $width Render width in px
	 * @param int $page 1-based page number
	 * @return string|null Local filesystem path, or null on failure
	 */
	private function basePageImage( $file, int $width, int $page ): ?string {
		try {
			$thumb = $file->transform( [ 'width' => $width, 'page' => max( 1, $page ) ] );
			if ( !$thumb || ( method_exists( $thumb, 'isError' ) && $thumb->isError() ) ) {
				return null;
			}
			if ( method_exists( $thumb, 'getLocalCopyPath' ) ) {
				$path = $thumb->getLocalCopyPath();
				if ( $path && file_exists( $path ) ) {
					return $path;
				}
			}
			if ( method_exists( $thumb, 'getFile' ) && $thumb->getFile() ) {
				$path = $thumb->getFile()->getLocalRefPath();
				if ( $path && file_exists( $path ) ) {
					return $path;
				}
			}
		} catch ( \Throwable $e ) {
			$this->getLogger()->debug(
				'Layers export: base page transform failed: {msg}',
				[ 'msg' => $e->getMessage() ]
			);
		}
		return null;
	}

	/**
	 * Stitch an ordered list of page images into a single PDF via ImageMagick.
	 *
	 * @param string[] $pageImages Ordered filesystem paths
	 * @param string $outputPath Destination PDF path
	 * @return bool True on success
	 */
	private function stitchPdf( array $pageImages, string $outputPath ): bool {
		$convert = $this->getConfig()->get( 'ImageMagickConvertCommand' );
		if ( !$convert ) {
			return false;
		}

		// convert page1 page2 ... -density 150 output.pdf
		$args = array_merge( [ $convert ], $pageImages, [ '-density', '150', $outputPath ] );

		$limits = [ 'time' => 60 ];
		try {
			$limits = [
				'memory' => $this->getConfig()->get( 'MaxShellMemory' ),
				'time' => max(
					60,
					(int)$this->getConfig()->get( 'LayersImageMagickTimeout' )
				),
				'filesize' => $this->getConfig()->get( 'MaxShellFileSize' ),
			];
		} catch ( \Throwable $e ) {
			// Use default limits.
		}

		try {
			$result = Shell::command( ...$args )
				->limits( $limits )
				->includeStderr()
				->execute();
			$exit = method_exists( $result, 'getExitCode' ) ? $result->getExitCode() : 0;
			if ( $exit !== 0 ) {
				$this->getLogger()->warning(
					'Layers export: convert failed: {out}',
					[ 'out' => method_exists( $result, 'getStdout' ) ? $result->getStdout() : '' ]
				);
				return false;
			}
		} catch ( \Throwable $e ) {
			$this->getLogger()->warning(
				'Layers export: convert threw: {msg}',
				[ 'msg' => $e->getMessage() ]
			);
			return false;
		}

		return file_exists( $outputPath );
	}

	/**
	 * Resolve (and create) the export cache directory under the upload thumb dir.
	 *
	 * @return string|null Directory path, or null if it cannot be created
	 */
	private function getExportDir(): ?string {
		$dir = RenderCache::getExportDir( $this->getConfig() );
		if ( !RenderCache::ensureDir( $this->getConfig(), $dir ) ) {
			$this->getLogger()->error( 'Layers export: cannot create dir', [ 'dir' => $dir ] );
			return null;
		}
		return $dir;
	}

	/**
	 * Build the URL the client should open to retrieve the export.
	 *
	 * Exports are served through Special:LayersExport rather than as a direct
	 * upload-path URL: they are full-content flattened documents, so delivery has
	 * to re-check `read` on the source file instead of relying on the URL being
	 * hard to guess.
	 *
	 * @param Title $title File title the export belongs to
	 * @param string $cacheKey Export cache key
	 * @return string Local URL
	 */
	private function getExportUrl( $title, string $cacheKey ): string {
		return SpecialPage::getTitleFor( 'LayersExport' )->getLocalURL( [
			'file' => $title->getDBkey(),
			'key' => $cacheKey,
		] );
	}

	/**
	 * Create a ThumbnailRenderer. Extracted for testability.
	 *
	 * @return ThumbnailRenderer
	 */
	protected function createThumbnailRenderer(): ThumbnailRenderer {
		return new ThumbnailRenderer( $this->getConfig() );
	}

	/**
	 * Resolve the LayersDatabase service.
	 *
	 * @return mixed LayersDatabase service instance
	 */
	protected function getLayersDatabase() {
		return MediaWikiServices::getInstance()->get( 'LayersDatabase' );
	}

	/**
	 * Resolve the Layers-specific logger.
	 *
	 * @return \Psr\Log\LoggerInterface
	 */
	protected function getLogger(): \Psr\Log\LoggerInterface {
		return MediaWikiServices::getInstance()->get( 'LayersLogger' );
	}

	/** @inheritDoc */
	public function getAllowedParams() {
		return [
			'filename' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_REQUIRED => true,
			],
			'setname' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_REQUIRED => false,
			],
			'width' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_REQUIRED => false,
			],
		];
	}

	/** @inheritDoc */
	public function isReadMode() {
		return true;
	}

	/** @inheritDoc */
	public function isWriteMode() {
		return false;
	}

	/** @inheritDoc */
	public function needsToken() {
		return false;
	}

	/** @inheritDoc */
	protected function getExamplesMessages() {
		return [
			'action=layerspdfexport&filename=Example.pdf&setname=anatomy-labels'
				=> 'apihelp-layerspdfexport-example-1',
		];
	}
}
