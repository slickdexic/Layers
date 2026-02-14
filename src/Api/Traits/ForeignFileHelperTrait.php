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

use MediaWiki\Extension\Layers\Utility\ForeignFileHelper;

/**
 * Provides helper methods for detecting foreign files and calculating SHA1 hashes.
 *
 * Delegates to ForeignFileHelper for the canonical implementation, providing
 * a convenient instance-method interface for API modules.
 *
 * @see ForeignFileHelper
 */
trait ForeignFileHelperTrait {
	/**
	 * Check if a file is from a foreign repository (like InstantCommons).
	 *
	 * @param mixed $file File object to check
	 * @return bool True if the file is from a foreign repository
	 */
	protected function isForeignFile( $file ): bool {
		return ForeignFileHelper::isForeignFile( $file );
	}

	/**
	 * Get a reliable SHA1 identifier for a file, with fallback for foreign files.
	 *
	 * @param mixed $file File object
	 * @param string $imgName The image name (DB key form) to use for fallback hash
	 * @return string SHA1 hash or fallback identifier (e.g., "foreign_abc123...")
	 */
	protected function getFileSha1( $file, string $imgName ): string {
		return ForeignFileHelper::getFileSha1( $file, $imgName );
	}
}
