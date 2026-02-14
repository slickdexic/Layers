<?php

declare( strict_types=1 );
/**
 * Static utility class for foreign file detection and SHA1 calculation.
 *
 * This class provides the canonical implementation of foreign file handling
 * logic, used by both the API trait and non-API classes (Hooks, Processors,
 * Actions) to eliminate code duplication.
 *
 * @file
 * @ingroup Extensions
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Utility;

use ForeignAPIFile;
use ForeignDBFile;

/**
 * Provides static helpers for detecting foreign files and calculating SHA1 hashes.
 *
 * Foreign files (from InstantCommons, ForeignDBRepo, etc.) may not have traditional
 * SHA1 hashes available. This class provides consistent fallback behavior across
 * all Layers modules.
 */
class ForeignFileHelper {
	/**
	 * Check if a file is from a foreign repository (like InstantCommons).
	 *
	 * Detection is performed in three ways:
	 * 1. Direct instanceof check for ForeignAPIFile/ForeignDBFile
	 * 2. Class name contains "Foreign" (catches namespaced variants)
	 * 3. File's repository reports isLocal() === false
	 *
	 * @param mixed $file File object to check
	 * @return bool True if the file is from a foreign repository
	 */
	public static function isForeignFile( $file ): bool {
		// Check for ForeignAPIFile or ForeignDBFile directly
		if ( $file instanceof ForeignAPIFile || $file instanceof ForeignDBFile ) {
			return true;
		}

		// Check using class name (for namespaced classes or future subtypes)
		$className = get_class( $file );
		if ( strpos( $className, 'Foreign' ) !== false ) {
			return true;
		}

		// Check if the file's repository is not local
		if ( method_exists( $file, 'getRepo' ) ) {
			$repo = $file->getRepo();
			if ( $repo && method_exists( $repo, 'isLocal' ) && !$repo->isLocal() ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get a reliable SHA1 identifier for a file, with fallback for foreign files.
	 *
	 * Foreign files may not have SHA1 available via getSha1(). This method
	 * provides a deterministic fallback based on the file name.
	 *
	 * @param mixed $file File object
	 * @param string|null $imgName Optional image name for fallback hash.
	 *   If null, uses $file->getName().
	 * @return string SHA1 hash or fallback identifier (e.g., "foreign_abc123...")
	 */
	public static function getFileSha1( $file, ?string $imgName = null ): string {
		$sha1 = $file->getSha1();
		if ( !empty( $sha1 ) ) {
			return $sha1;
		}

		// Foreign files may not have SHA1 - use deterministic fallback
		if ( self::isForeignFile( $file ) ) {
			$name = $imgName ?? $file->getName();
			return 'foreign_' . sha1( $name );
		}

		return $sha1 ?? '';
	}
}
