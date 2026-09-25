<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\FileRepo\File\File;
use MediaWiki\Shell\Shell;
use Wikimedia\FileBackend\FSFile\TempFSFileFactory;

/** Internal rendering primitive. Caller must authorize sources and provide private staging. */
class PrivateRasterRenderer {
	// Shared with the cheap request preflight; normalized/output dimensions use the same ceiling.
	public const MAX_SIDE = 4096;
	private const MAX_BYTES = 8388608;
	private TempFSFileFactory $temporaryFiles;
	private string $decoder;

	/**
	 * @param TempFSFileFactory $temporaryFiles Must point outside web/public repository roots
	 * @param string $decoder Trusted configured ImageMagick convert executable, never request input
	 */
	public function __construct( TempFSFileFactory $temporaryFiles, string $decoder ) {
		$this->temporaryFiles = $temporaryFiles;
		$this->decoder = $decoder;
	}

	/**
	 * Render an already-resolved exact source into bounded raster bytes.
	 * No authorization, endpoint, public thumbnail storage or caching is provided here.
	 *
	 * @param File $file Exact, authorized source
	 * @param int $page Pinned page from the snapshot
	 * @param int $width Requested pixel width
	 * @return array MIME, actual dimensions and bytes; never a path or URL
	 * @throws \DomainException Invalid/unsupported/failed rendering
	 */
	public function render( File $file, int $page, int $width ): array {
		if ( $page < 1 || $width < 1 || $width > self::MAX_SIDE || $this->decoder === '' ) {
			throw new \DomainException( 'layers-render-unavailable' );
		}
		$handler = $file->getHandler();
		if ( !$handler || !in_array( $file->getMimeType(),
			[ 'image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf' ], true )
		) {
			throw new \DomainException( 'layers-render-unavailable' );
		}
		$params = [ 'width' => $width, 'page' => $page ];
		if ( !$handler->normaliseParams( $file, $params ) ) {
			throw new \DomainException( 'layers-render-unavailable' );
		}
		foreach ( [ 'width', 'height', 'physicalWidth', 'physicalHeight' ] as $dimension ) {
			if ( isset( $params[$dimension] ) &&
				( $params[$dimension] <= 0 || $params[$dimension] > self::MAX_SIDE )
			) {
				throw new \DomainException( 'layers-render-unavailable' );
			}
		}
		[ $extension, $mime ] = $handler->getThumbType( $file->getExtension(), $file->getMimeType(), $params );
		if ( !in_array( $mime, [ 'image/png', 'image/jpeg' ], true ) ||
			!in_array( $extension, [ 'png', 'jpg', 'jpeg' ], true )
		) {
			throw new \DomainException( 'layers-render-unavailable' );
		}
		$artifact = $this->temporaryFiles->newTempFSFile( 'layers-private-', $extension );
		if ( !$artifact ) {
			throw new \DomainException( 'layers-render-unavailable' );
		}
		$path = $artifact->getPath();
		try {
			// Empty destination URL is intentional: this artifact has no public address.
			$output = $handler->doTransform( $file, $path, '', $params, 0 );
			if ( !$output || $output->isError() || !$output->hasFile() ) {
				throw new \DomainException( 'layers-render-unavailable' );
			}
			if ( $output->fileIsSource() ) {
				// Native-size PNG/JPEG needs no resampling. Copy only this explicit
				// raster case into private staging and validate it below; never use its URL.
				if ( !in_array( $file->getMimeType(), [ 'image/png', 'image/jpeg' ], true ) ||
					$file->getWidth() !== $params['width'] || $file->getHeight() !== $params['height'] ||
					$file->getSize() > self::MAX_BYTES
				) {
					throw new \DomainException( 'layers-render-unavailable' );
				}
				$source = $file->getLocalRefPath();
				if ( !$source || !copy( $source, $path ) ) {
					throw new \DomainException( 'layers-render-unavailable' );
				}
			} elseif ( $output->getLocalCopyPath() !== $path ) {
				throw new \DomainException( 'layers-render-unavailable' );
			}
			if ( is_link( $path ) || !is_file( $path ) ) {
				throw new \DomainException( 'layers-render-unavailable' );
			}
			clearstatcache( true, $path );
			$size = filesize( $path );
			if ( !$size || $size > self::MAX_BYTES ) {
				throw new \DomainException( 'layers-render-unavailable' );
			}
			$bytes = file_get_contents( $path, false, null, 0, self::MAX_BYTES + 1 );
			if ( $bytes === false || strlen( $bytes ) !== $size ) {
				throw new \DomainException( 'layers-render-unavailable' );
			}
			// phpcs:ignore Generic.PHP.NoSilencedErrors.Discouraged -- Invalid output is rejected below.
			$info = @getimagesizefromstring( $bytes );
			if ( !$info || ( $info['mime'] ?? '' ) !== $mime ||
				$info[0] < 1 || $info[1] < 1 || $info[0] > self::MAX_SIDE || $info[1] > self::MAX_SIDE
			) {
				throw new \DomainException( 'layers-render-unavailable' );
			}
			// Header sniffing is insufficient: decode the entire generated image using
			// core's shell infrastructure and configured resource limits, not a renderer URL.
			$decoded = Shell::command( [ $this->decoder, '-regard-warnings', $path, 'null:' ] )->execute();
			if ( $decoded->getExitCode() !== 0 ) {
				throw new \DomainException( 'layers-render-unavailable' );
			}
			return [ 'mime' => $mime, 'width' => $info[0], 'height' => $info[1], 'bytes' => $bytes ];
		} finally {
			if ( file_exists( $path ) && !$artifact->purge() ) {
				throw new \RuntimeException( 'layers-render-cleanup-failed' );
			}
		}
	}
}
