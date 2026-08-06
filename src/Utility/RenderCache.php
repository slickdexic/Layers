<?php

declare( strict_types=1 );
/**
 * Shared location and lifecycle management for generated Layers render artefacts.
 *
 * @file
 * @ingroup Extensions
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Utility;

use MediaWiki\Config\Config;
use Wikimedia\AtEase\AtEase;

/**
 * Owns the on-disk locations of generated Layers artefacts and their cleanup.
 *
 * Two kinds of artefact are produced outside MediaWiki's own file management:
 *  - composited thumbnails  <uploadDir>/thumb/layers/<sha1>_<hash>.png
 *  - exported PDFs          <exportDir>/<sha1>_<key>.pdf
 *
 * Both are keyed by the source file's SHA1, which is what makes bulk purging on
 * file deletion possible. Previously nothing ever removed them, so deleting a
 * file for copyright or privacy reasons left a full-content render permanently
 * retrievable at a stable, public URL.
 *
 * Thumbnails sit beside MediaWiki's own thumbnails and inherit whatever
 * protection the upload directory has. Exports do not: a flattened PDF of an
 * entire multi-page document is not a thumbnail, so it is written outside the
 * document root and served only through Special:LayersExport, which re-checks
 * `read` on the source file.
 */
class RenderCache {

	/** Directory mode used when creating cache directories, if not configured. */
	private const DEFAULT_DIR_MODE = 0755;

	/** Subdirectory used when the export location is derived rather than configured. */
	private const EXPORT_DIR_NAME = 'layers-export';

	/**
	 * Artefact filenames are "<sha1>_<hash>.<ext>". Bulk deletion is restricted to
	 * names matching this so a misconfigured directory cannot be emptied.
	 */
	private const ARTEFACT_PATTERN = '/^[0-9a-z]{4,40}_[0-9a-z]+\.[a-z0-9]{2,5}$/i';

	/**
	 * Resolve the base upload directory, falling back to the system temp dir.
	 *
	 * @param Config $config
	 * @return string
	 */
	private static function getUploadDir( Config $config ): string {
		$uploadDir = $config->get( 'UploadDirectory' );
		if ( !$uploadDir ) {
			$uploadDir = sys_get_temp_dir();
		}
		return rtrim( (string)$uploadDir, '/\\' );
	}

	/**
	 * Directory holding composited layer thumbnails.
	 *
	 * @param Config $config
	 * @return string
	 */
	public static function getThumbDir( Config $config ): string {
		return self::getUploadDir( $config ) . '/thumb/layers';
	}

	/**
	 * Directory holding exported PDFs.
	 *
	 * Deliberately outside the upload tree: exports are full-content documents
	 * served through Special:LayersExport after a permission check, not public
	 * derivatives. Admins can override with $wgLayersExportDirectory, which must
	 * also be outside the document root.
	 *
	 * @param Config $config
	 * @return string
	 */
	public static function getExportDir( Config $config ): string {
		$configured = $config->has( 'LayersExportDirectory' )
			? (string)$config->get( 'LayersExportDirectory' )
			: '';
		if ( $configured !== '' ) {
			return rtrim( $configured, '/\\' );
		}

		$tmp = $config->has( 'TmpDirectory' ) ? (string)$config->get( 'TmpDirectory' ) : '';
		if ( $tmp === '' ) {
			$tmp = sys_get_temp_dir();
		}
		return rtrim( $tmp, '/\\' ) . '/' . self::EXPORT_DIR_NAME;
	}

	/**
	 * Create a cache directory if it does not exist.
	 *
	 * @param Config $config
	 * @param string $dir Directory path, normally from getThumbDir()/getExportDir()
	 * @return bool True if the directory exists (or was created)
	 */
	public static function ensureDir( Config $config, string $dir ): bool {
		if ( is_dir( $dir ) ) {
			return true;
		}
		$mode = $config->has( 'DirectoryMode' )
			? (int)$config->get( 'DirectoryMode' )
			: self::DEFAULT_DIR_MODE;
		// A concurrent request may win the race; is_dir() settles it.
		return AtEase::quietCall( 'mkdir', $dir, $mode, true ) || is_dir( $dir );
	}

	/**
	 * Delete every generated artefact belonging to a file version.
	 *
	 * Both artefact families are named "<sha1>_<hash>.<ext>", so a prefix glob is
	 * exact: it cannot match another file's renders.
	 *
	 * @param Config $config
	 * @param string $sha1 Base-36 SHA1 of the file version being purged
	 * @return int Number of files deleted
	 */
	public static function purgeBySha1( Config $config, string $sha1 ): int {
		// Guard against an empty or malformed SHA1 globbing the whole directory.
		if ( !preg_match( '/^[0-9a-z]{4,40}$/', $sha1 ) ) {
			return 0;
		}

		$deleted = 0;
		foreach ( self::artefactDirs( $config ) as $dir ) {
			if ( !is_dir( $dir ) ) {
				continue;
			}
			$matches = glob( $dir . '/' . $sha1 . '_*' );
			if ( !$matches ) {
				continue;
			}
			foreach ( $matches as $path ) {
				if ( is_file( $path ) && AtEase::quietCall( 'unlink', $path ) ) {
					$deleted++;
				}
			}
		}
		return $deleted;
	}

	/**
	 * Delete artefacts older than the given age.
	 *
	 * Export filenames incorporate the layer set revision, so every save orphans
	 * the previous PDF. Without a reaper the export directory grows without
	 * bound. Called by maintenance/purgeLayersRenderCache.php.
	 *
	 * @param Config $config
	 * @param int $maxAgeSeconds Delete artefacts last modified longer ago than this
	 * @param bool $dryRun When true, count matches without deleting
	 * @return array{deleted: int, bytes: int} Counts of removed (or matched) files
	 */
	public static function purgeOlderThan( Config $config, int $maxAgeSeconds, bool $dryRun = false ): array {
		$cutoff = time() - max( 0, $maxAgeSeconds );
		$deleted = 0;
		$bytes = 0;

		foreach ( self::artefactDirs( $config ) as $dir ) {
			if ( !is_dir( $dir ) ) {
				continue;
			}
			$matches = glob( $dir . '/*' );
			if ( !$matches ) {
				continue;
			}
			foreach ( $matches as $path ) {
				if ( !is_file( $path ) || !preg_match( self::ARTEFACT_PATTERN, basename( $path ) ) ) {
					continue;
				}
				$mtime = AtEase::quietCall( 'filemtime', $path );
				if ( $mtime === false || $mtime >= $cutoff ) {
					continue;
				}
				$size = (int)AtEase::quietCall( 'filesize', $path );
				if ( $dryRun || AtEase::quietCall( 'unlink', $path ) ) {
					$deleted++;
					$bytes += $size;
				}
			}
		}

		return [ 'deleted' => $deleted, 'bytes' => $bytes ];
	}

	/**
	 * Every directory this class owns, de-duplicated.
	 *
	 * @param Config $config
	 * @return string[]
	 */
	private static function artefactDirs( Config $config ): array {
		return array_unique( [ self::getThumbDir( $config ), self::getExportDir( $config ) ] );
	}
}
