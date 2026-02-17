<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use MediaWiki\Extension\Layers\Api\Traits\CacheInvalidationTrait;
use MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait;
use MediaWiki\Extension\Layers\Api\Traits\LayersApiHelperTrait;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Extension\Layers\Validation\SetNameSanitizer;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;
use Psr\Log\LoggerInterface;

/**
 * API module for renaming layer sets.
 *
 * This module allows users to rename named layer sets.
 * Only the original creator (owner) or administrators can rename a set.
 *
 * SECURITY:
 * - Requires 'editlayers' permission
 * - Requires CSRF token
 * - Only owner (first revision creator) or sysop can rename
 * - Validates file exists before attempting rename
 * - Validates new name doesn't conflict with existing sets
 *
 * USAGE:
 *   api.postWithToken('csrf', {
 *     action: 'layersrename',
 *     filename: 'Example.jpg',
 *     oldname: 'my-annotations',
 *     newname: 'anatomy-labels'
 *   });
 */
class ApiLayersRename extends ApiBase {
	use CacheInvalidationTrait;
	use ForeignFileHelperTrait;
	use LayersApiHelperTrait;

	/** @var LoggerInterface|null */
	private ?LoggerInterface $logger = null;

	/**
	 * Execute the rename operation.
	 */
	public function execute() {
		$user = $this->getUser();
		$params = $this->extractRequestParams();
		$requestedFilename = $params['filename'] ?? '';
		$slidename = $params['slidename'] ?? null;
		$oldName = trim( $params['oldname'] );
		$newName = trim( $params['newname'] );

		// Require editlayers permission
		$this->checkUserRightsAny( 'editlayers' );

		// Handle slide renames (slidename parameter)
		if ( $slidename !== null && $slidename !== '' ) {
			$this->executeSlideRename( $user, $slidename, $oldName, $newName );
			return;
		}

		// Also handle slides when filename starts with 'Slide:' (editor compatibility)
		if ( $requestedFilename !== null && strpos( $requestedFilename, LayersConstants::SLIDE_PREFIX ) === 0 ) {
			$slidename = substr( $requestedFilename, strlen( LayersConstants::SLIDE_PREFIX ) );
			$this->executeSlideRename( $user, $slidename, $oldName, $newName );
			return;
		}

		// For file operations, filename is required
		if ( $requestedFilename === '' || $requestedFilename === null ) {
			$this->dieWithError( LayersConstants::ERROR_FILE_NOT_FOUND, 'filenotfound' );
		}

		// Validate new name format using central validator
		if ( !SetNameSanitizer::isValid( $newName ) ) {
			$this->dieWithError( LayersConstants::ERROR_INVALID_SETNAME, 'invalidsetname' );
		}

		// Prevent renaming to 'default'
		$defaultName = strtolower( LayersConstants::DEFAULT_SET_NAME );
		if ( strtolower( $newName ) === $defaultName && strtolower( $oldName ) !== $defaultName ) {
			$this->dieWithError( LayersConstants::ERROR_CANNOT_RENAME_DEFAULT, 'invalidsetname' );
		}

		try {
			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );

			// Verify database schema exists (via LayersApiHelperTrait)
			$this->requireSchemaReady( $db );

			// Validate filename - Title must be valid and in File namespace
			// Note: We do NOT check $title->exists() because foreign files
			// (from InstantCommons) don't have local wiki pages
			$title = Title::newFromText( $requestedFilename, NS_FILE );
			if ( !$title || $title->getNamespace() !== NS_FILE ) {
				$this->dieWithError( LayersConstants::ERROR_FILE_NOT_FOUND, 'filenotfound' );
			}

			// Get file metadata (use getRepoGroup() to support foreign repos like Commons)
			$file = MediaWikiServices::getInstance()->getRepoGroup()->findFile( $title );
			if ( !$file || !$file->exists() ) {
				$this->dieWithError( LayersConstants::ERROR_FILE_NOT_FOUND, 'filenotfound' );
			}

			// Use DB key form for consistency with ApiLayersSave
			// This ensures layers saved on foreign files can be renamed correctly
			$imgName = $title->getDBkey();
			$sha1 = $this->getFileSha1( $file, $imgName );

			// Check if the source layer set exists
			$layerSet = $db->getLayerSetByName( $imgName, $sha1, $oldName );
			if ( !$layerSet ) {
				// SHA1 mismatch fallback: for foreign files, the SHA1 may have been
				// saved before InstantCommons support was added.
				$storedSha1 = $db->findSetSha1( $imgName, $oldName );
				if ( $storedSha1 !== null && $storedSha1 !== $sha1 ) {
					$this->getLogger()->info( 'Layers rename: SHA1 mismatch, using stored value', [
						'imgName' => $imgName,
						'oldName' => $oldName,
						'expectedSha1' => $sha1,
						'storedSha1' => $storedSha1
					] );
					$sha1 = $storedSha1;
					$layerSet = $db->getLayerSetByName( $imgName, $sha1, $oldName );
				}
			}

			if ( !$layerSet ) {
				$this->dieWithError( LayersConstants::ERROR_LAYERSET_NOT_FOUND, 'setnotfound' );
			}

			// Check if new name already exists
			if ( $db->namedSetExists( $imgName, $sha1, $newName ) ) {
				$this->dieWithError( LayersConstants::ERROR_SETNAME_EXISTS, 'setnameexists' );
			}

			// PERMISSION CHECK: Only owner or admin can rename (via LayersApiHelperTrait)
			if ( !$this->isOwnerOrAdmin( $db, $user, $imgName, $sha1, $oldName ) ) {
				$this->dieWithError( LayersConstants::ERROR_RENAME_PERMISSION_DENIED, 'permissiondenied' );
			}

			// RATE LIMITING: Prevent abuse by limiting rename operations per user
			// Uses MediaWiki's core rate limiter via User::pingLimiter()
			// Configure in LocalSettings.php:
			//   $wgRateLimits['editlayers-rename']['user'] = [ 20, 3600 ]; // 20 renames per hour
			//   $wgRateLimits['editlayers-rename']['newbie'] = [ 3, 3600 ]; // stricter for new users
			$rateLimiter = $this->createRateLimiter();
			if ( !$rateLimiter->checkRateLimit( $user, 'rename' ) ) {
				$this->dieWithError( LayersConstants::ERROR_RATE_LIMITED, 'ratelimited' );
			}

			// Perform the rename
			$success = $db->renameNamedSet( $imgName, $sha1, $oldName, $newName );

			if ( !$success ) {
				$this->getLogger()->error( 'Failed to rename layer set', [
					'filename' => $requestedFilename,
					'oldname' => $oldName,
					'newname' => $newName,
					'user' => $user->getName()
				] );
				$this->dieWithError( LayersConstants::ERROR_RENAME_FAILED, 'renamefailed' );
			}

			$this->getLogger()->info( 'Layer set renamed', [
				'filename' => $requestedFilename,
				'oldname' => $oldName,
				'newname' => $newName,
				'user' => $user->getName()
			] );

			// CACHE INVALIDATION: Purge caches for the file page and pages embedding this file
			// This ensures pages using [[File:X.jpg|layerset=on]] will re-render with new set name
			$this->invalidateCachesForFile( $title );

			// Return success
			$this->getResult()->addValue( 'layersrename', 'success', 1 );
			$this->getResult()->addValue( 'layersrename', 'oldname', $oldName );
			$this->getResult()->addValue( 'layersrename', 'newname', $newName );

		} catch ( \MediaWiki\Api\ApiUsageException $e ) {
			// Re-throw API usage exceptions (permission denied, rate limited, etc.)
			// so MediaWiki returns the specific error code to the client
			throw $e;
		} catch ( \Throwable $e ) {
			$this->getLogger()->error( 'Exception during layer set rename: {message}', [
				'message' => $e->getMessage(),
				'filename' => $requestedFilename,
				'oldname' => $oldName,
				'newname' => $newName
			] );
			$this->dieWithError( LayersConstants::ERROR_RENAME_FAILED, 'renamefailed' );
			return; // @codeCoverageIgnore
		}
	}

	/**
	 * Define allowed parameters for this API module.
	 *
	 * @return array Parameter definitions
	 */
	public function getAllowedParams() {
		return [
			'filename' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false,
			],
			'slidename' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false,
			],
			'oldname' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true,
			],
			'newname' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true,
			],
		];
	}

	/**
	 * Require CSRF token for this write operation.
	 *
	 * @return string Token type
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * This module modifies data.
	 *
	 * @return bool True indicating this is a write operation
	 */
	public function isWriteMode() {
		return true;
	}

	/**
	 * This module must be called via HTTP POST.
	 *
	 * Defense-in-depth: While needsToken() already requires CSRF validation,
	 * explicitly requiring POST prevents potential edge cases where GET requests
	 * might bypass token validation.
	 *
	 * @return bool True to require POST method
	 */
	public function mustBePosted() {
		return true;
	}

	/**
	 * Provide example API calls.
	 *
	 * @return array Example messages
	 */
	public function getExamplesMessages() {
		return [
			'action=layersrename&filename=Example.jpg&oldname=my-annotations&newname=anatomy-labels&token=123ABC' =>
				'apihelp-layersrename-example-1',
		];
	}

	/**
	 * Execute rename operation for slides.
	 *
	 * Slides are standalone layer sets not tied to a file. They use a synthetic
	 * imgName of 'Slide:{name}' and a fixed sha1 of 'slide'.
	 *
	 * @param \User $user The current user
	 * @param string $slidename The slide name (without 'Slide:' prefix)
	 * @param string $oldName The old set name
	 * @param string $newName The new set name
	 */
	private function executeSlideRename( $user, string $slidename, string $oldName, string $newName ): void {
		// Validate new name format using central validator
		if ( !SetNameSanitizer::isValid( $newName ) ) {
			$this->dieWithError( LayersConstants::ERROR_INVALID_SETNAME, 'invalidsetname' );
		}

		// Prevent renaming to 'default'
		$defaultName = strtolower( LayersConstants::DEFAULT_SET_NAME );
		if ( strtolower( $newName ) === $defaultName && strtolower( $oldName ) !== $defaultName ) {
			$this->dieWithError( LayersConstants::ERROR_CANNOT_RENAME_DEFAULT, 'invalidsetname' );
		}

		try {
			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );

			// Verify database schema exists (via LayersApiHelperTrait)
			$this->requireSchemaReady( $db );

			// Rate limiting (before DB lookups to prevent abuse)
			$rateLimiter = $this->createRateLimiter();
			if ( !$rateLimiter->checkRateLimit( $user, 'rename' ) ) {
				$this->dieWithError( LayersConstants::ERROR_RATE_LIMITED, 'ratelimited' );
			}

			// Slides use 'Slide:' prefix for imgName and fixed 'slide' sha1
			$imgName = LayersConstants::SLIDE_PREFIX . $slidename;
			$sha1 = LayersConstants::TYPE_SLIDE;

			// Check if the source set exists
			$exists = $db->namedSetExists( $imgName, $sha1, $oldName );
			if ( !$exists ) {
				$this->dieWithError( LayersConstants::ERROR_LAYERSET_NOT_FOUND, 'setnotfound' );
			}

			// Check if new name already exists
			if ( $db->namedSetExists( $imgName, $sha1, $newName ) ) {
				$this->dieWithError( LayersConstants::ERROR_SETNAME_EXISTS, 'setnameexists' );
			}

			// Permission check: only owner or admin can rename (via LayersApiHelperTrait)
			if ( !$this->isOwnerOrAdmin( $db, $user, $imgName, $sha1, $oldName ) ) {
				$this->dieWithError( LayersConstants::ERROR_RENAME_PERMISSION_DENIED, 'permissiondenied' );
			}

			// Perform the rename
			$success = $db->renameNamedSet( $imgName, $sha1, $oldName, $newName );

			if ( !$success ) {
				$this->getLogger()->error( 'Failed to rename slide layer set', [
					'slidename' => $slidename,
					'oldname' => $oldName,
					'newname' => $newName,
					'user' => $user->getName()
				] );
				$this->dieWithError( LayersConstants::ERROR_RENAME_FAILED, 'renamefailed' );
			}

			$this->getLogger()->info( 'Slide layer set renamed', [
				'slidename' => $slidename,
				'oldname' => $oldName,
				'newname' => $newName,
				'user' => $user->getName()
			] );

			// Return success
			$this->getResult()->addValue( 'layersrename', 'success', 1 );
			$this->getResult()->addValue( 'layersrename', 'oldname', $oldName );
			$this->getResult()->addValue( 'layersrename', 'newname', $newName );

		} catch ( \MediaWiki\Api\ApiUsageException $e ) {
			// Re-throw API usage exceptions (permission denied, rate limited, etc.)
			throw $e;
		} catch ( \Throwable $e ) {
			$this->getLogger()->error( 'Exception during slide rename: {message}', [
				'message' => $e->getMessage(),
				'slidename' => $slidename,
				'oldname' => $oldName,
				'newname' => $newName
			] );
			$this->dieWithError( LayersConstants::ERROR_RENAME_FAILED, 'renamefailed' );
			return; // @codeCoverageIgnore
		}
	}

	/**
	 * Lazily resolve the Layers-specific logger.
	 */
	protected function getLogger(): LoggerInterface {
		if ( $this->logger === null ) {
			$this->logger = MediaWikiServices::getInstance()->get( 'LayersLogger' );
		}
		return $this->logger;
	}

	/**
	 * Factory for RateLimiter to allow overrides in tests.
	 */
	protected function createRateLimiter(): RateLimiter {
		return new RateLimiter();
	}
}
