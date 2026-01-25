<?php

declare( strict_types=1 );
/**
 * Trait providing foreign file detection and SHA1 calculation helpers.
 *
 * This trait consolidates common file handling logic used across multiple
 * API modules (Info, Save, Delete, Rename) to support InstantCommons and
 * other foreign file repositories.
 *
 * @file
 * @ingroup Extensions
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Api\Traits;

use ForeignAPIFile;
use ForeignDBFile;

/**
 * Provides helper methods for detecting foreign files and calculating SHA1 hashes.
 *
 * Foreign files (from InstantCommons, ForeignDBRepo, etc.) may not have traditional
 * SHA1 hashes available. This trait provides consistent fallback behavior across
 * all Layers API modules.
 */
trait ForeignFileHelperTrait {
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
	protected function isForeignFile( $file ): bool {
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
	 * Foreign files may not have SHA1 available via getSha1(). For consistency
	 * across all API operations, this method provides a deterministic fallback
	 * based on the image name.
	 *
	 * @param mixed $file File object
	 * @param string $imgName The image name (DB key form) to use for fallback hash
	 * @return string SHA1 hash or fallback identifier (e.g., "foreign_abc123...")
	 */
	protected function getFileSha1( $file, string $imgName ): string {
		$sha1 = $file->getSha1();
		if ( !empty( $sha1 ) ) {
			return $sha1;
		}

		// Foreign files may not have SHA1 - use deterministic fallback
		if ( $this->isForeignFile( $file ) ) {
			// Use a hash of the DB key for consistency across all API modules
			return 'foreign_' . sha1( $imgName );
		}

		return $sha1 ?? '';
	}
}
