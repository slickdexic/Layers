<?php

declare( strict_types=1 );
/**
 * Trait providing common API helper methods for Layers API modules.
 *
 * This trait consolidates repeated patterns across Delete, Rename, and other
 * API modules including schema checks, file validation, and permission checks.
 *
 * @file
 * @ingroup Extensions
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Api\Traits;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;

/**
 * Provides common helper methods for Layers API modules.
 *
 * This trait reduces code duplication across Api modules by providing:
 * - Database schema validation
 * - File title/existence validation
 * - Owner or admin permission checks
 * - SHA1 mismatch fallback lookups
 * - Rate limiter creation
 *
 * Requires: ApiBase (for error methods) and ForeignFileHelperTrait (for getFileSha1).
 */
trait LayersApiHelperTrait {
	/**
	 * Ensure the database schema is ready, or die with error.
	 *
	 * @param LayersDatabase $db The LayersDatabase instance
	 */
	protected function requireSchemaReady( LayersDatabase $db ): void {
		if ( !$db->isSchemaReady() ) {
			// @phan-suppress-next-line PhanUndeclaredMethod - dieWithError from ApiBase
			$this->dieWithError(
				[ 'layers-db-error', 'Layer tables missing. Please run maintenance/update.php' ],
				'dbschema-missing'
			);
		}
	}

	/**
	 * Validate a filename and return the Title and File objects.
	 *
	 * Dies with appropriate error if validation fails.
	 *
	 * @param string $filename The requested filename
	 * @return array{title Title, file: \File, imgName: string} Validated file data
	 */
	protected function validateAndGetFile( string $filename ): array {
		// Validate filename - Title must be valid and in File namespace
		// Note: We do NOT check $title->exists() because foreign files
		// (from InstantCommons) don't have local wiki pages
		$title = Title::newFromText( $filename, NS_FILE );
		if ( !$title || $title->getNamespace() !== NS_FILE ) {
			// @phan-suppress-next-line PhanUndeclaredMethod - dieWithError from ApiBase
			$this->dieWithError( 'layers-file-not-found', 'invalidfilename' );
		}

		// Get file metadata (use getRepoGroup() to support foreign repos like Commons)
		$file = MediaWikiServices::getInstance()->getRepoGroup()->findFile( $title );
		if ( !$file || !$file->exists() ) {
			// @phan-suppress-next-line PhanUndeclaredMethod - dieWithError from ApiBase
			$this->dieWithError( 'layers-file-not-found', 'invalidfilename' );
		}

		// Use DB key form for consistency across all API modules
		$imgName = $title->getDBkey();

		return [
			'title' => $title,
			'file' => $file,
			'imgName' => $imgName
		];
	}

	/**
	 * Check if user is owner or admin for a named set.
	 *
	 * @param LayersDatabase $db The LayersDatabase instance
	 * @param \User $user The user to check
	 * @param string $imgName Image name (DB key form)
	 * @param string $sha1 File SHA1 hash
	 * @param string $setName Name of the layer set
	 * @return bool True if user has permission (is owner or admin)
	 */
	protected function isOwnerOrAdmin(
		LayersDatabase $db,
		$user,
		string $imgName,
		string $sha1,
		string $setName
	): bool {
		$ownerId = $db->getNamedSetOwner( $imgName, $sha1, $setName );
		$userId = $user->getId();
		$isOwner = ( $ownerId !== null && $ownerId === $userId );
		$isAdmin = $user->isAllowed( 'delete' );

		return $isOwner || $isAdmin;
	}

	/**
	 * Get layer set with SHA1 mismatch fallback for foreign files.
	 *
	 * Foreign files may have been saved with a different SHA1 before
	 * InstantCommons support was fully implemented. This method attempts
	 * to find the set using the stored SHA1 if the expected one doesn't match.
	 *
	 * @param LayersDatabase $db The LayersDatabase instance
	 * @param string $imgName Image name (DB key form)
	 * @param string &$sha1 Expected SHA1 (modified by reference if fallback used)
	 * @param string $setName Name of the layer set
	 * @return array|null The layer set data, or null if not found
	 */
	protected function getLayerSetWithFallback(
		LayersDatabase $db,
		string $imgName,
		string &$sha1,
		string $setName
	): ?array {
		$layerSet = $db->getLayerSetByName( $imgName, $sha1, $setName );

		if ( !$layerSet ) {
			// SHA1 mismatch fallback: for foreign files, the SHA1 may have been
			// saved before InstantCommons support was added.
			$storedSha1 = $db->findSetSha1( $imgName, $setName );
			if ( $storedSha1 !== null && $storedSha1 !== $sha1 ) {
				// Caller can use this to log the fallback via getLogger()
				$sha1 = $storedSha1;
				$layerSet = $db->getLayerSetByName( $imgName, $sha1, $setName );
			}
		}

		return $layerSet;
	}

	/**
	 * Create a new rate limiter instance.
	 *
	 * @return RateLimiter A configured rate limiter
	 */
	protected function createRateLimiter(): RateLimiter {
		return new RateLimiter();
	}
}
