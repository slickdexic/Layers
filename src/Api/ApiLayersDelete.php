<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait;
use MediaWiki\Extension\Layers\Api\Traits\LayersApiHelperTrait;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Extension\Layers\Validation\SetNameSanitizer;
use MediaWiki\MediaWikiServices;
use Psr\Log\LoggerInterface;
use Title;

/**
 * API module for deleting layer sets.
 *
 * This module allows users to delete named layer sets from images.
 * Only the original creator (owner) or administrators can delete a set.
 *
 * SECURITY:
 * - Requires 'editlayers' permission
 * - Requires CSRF token
 * - Rate limited via MediaWiki's rate limiter ($wgRateLimits['editlayers-delete'])
 * - Only owner (first revision creator) or sysop can delete
 * - Validates file exists before attempting delete
 *
 * USAGE:
 *   api.postWithToken('csrf', {
 *     action: 'layersdelete',
 *     filename: 'Example.jpg',
 *     setname: 'my-annotations'
 *   });
 */
class ApiLayersDelete extends ApiBase {
	use ForeignFileHelperTrait;
	use LayersApiHelperTrait;

	/** @var LoggerInterface|null */
	private ?LoggerInterface $logger = null;

	/**
	 * Execute the delete operation.
	 */
	public function execute() {
		$user = $this->getUser();
		$params = $this->extractRequestParams();
		$requestedFilename = $params['filename'] ?? null;
		$slidename = $params['slidename'] ?? null;
		$setName = SetNameSanitizer::sanitize( $params['setname'] );

		// Require editlayers permission
		$this->checkUserRightsAny( 'editlayers' );

		// Handle slide deletes (slidename parameter)
		if ( $slidename !== null && $slidename !== '' ) {
			$this->executeSlideDelete( $user, $slidename, $setName );
			return;
		}

		// Also handle slides when filename starts with 'Slide:' (editor compatibility)
		if ( $requestedFilename !== null && strpos( $requestedFilename, 'Slide:' ) === 0 ) {
			// Remove 'Slide:' prefix
			$slidename = substr( $requestedFilename, 6 );
			$this->executeSlideDelete( $user, $slidename, $setName );
			return;
		}

		// Require filename for non-slide requests
		if ( $requestedFilename === null || $requestedFilename === '' ) {
			$this->dieWithError(
				[ 'apierror-missingparam', 'filename' ],
				'missingparam'
			);
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
				$this->dieWithError( 'layers-file-not-found', 'invalidfilename' );
			}

			// Get file metadata (use getRepoGroup() to support foreign repos like Commons)
			$file = MediaWikiServices::getInstance()->getRepoGroup()->findFile( $title );
			if ( !$file || !$file->exists() ) {
				$this->dieWithError( 'layers-file-not-found', 'invalidfilename' );
			}

			// Use DB key form for consistency with ApiLayersSave
			// This ensures layers saved on foreign files can be deleted correctly
			$imgName = $title->getDBkey();
			$sha1 = $this->getFileSha1( $file, $imgName );

			// Debug logging for SHA1 lookup
			$isForeign = $this->isForeignFile( $file );
			$fileSha1 = $file->getSha1();
			$this->getLogger()->info( 'Layers delete: looking for layer set', [
				'imgName' => $imgName,
				'setName' => $setName,
				'lookupSha1' => $sha1,
				'fileSha1' => $fileSha1 ?: '(empty)',
				'isForeign' => $isForeign ? 'yes' : 'no',
				'fileClass' => get_class( $file )
			] );

			// Check if the layer set exists with expected SHA1
			$layerSet = $db->getLayerSetByName( $imgName, $sha1, $setName );
			if ( !$layerSet ) {
				// SHA1 mismatch fallback: for foreign files, the SHA1 may have been
				// saved before InstantCommons support was added. Try to find the
				// actual SHA1 used in the database.
				$storedSha1 = $db->findSetSha1( $imgName, $setName );
				if ( $storedSha1 !== null && $storedSha1 !== $sha1 ) {
					$this->getLogger()->info( 'Layers delete: SHA1 mismatch, using stored value', [
						'imgName' => $imgName,
						'setName' => $setName,
						'expectedSha1' => $sha1,
						'storedSha1' => $storedSha1
					] );
					$sha1 = $storedSha1;
					$layerSet = $db->getLayerSetByName( $imgName, $sha1, $setName );
				}
			}

			if ( !$layerSet ) {
				// Log debug info for troubleshooting SHA1 mismatch issues
				$this->getLogger()->warning( 'Layers delete: set not found', [
					'imgName' => $imgName,
					'setName' => $setName,
					'lookupSha1' => $sha1,
					'isForeign' => $isForeign ? 'yes' : 'no',
					'fileSha1' => $fileSha1 ?: '(empty)'
				] );
				$this->dieWithError( 'layers-layerset-not-found', 'setnotfound' );
			}

			// PERMISSION CHECK: Only owner or admin can delete (via LayersApiHelperTrait)
			if ( !$this->isOwnerOrAdmin( $db, $user, $imgName, $sha1, $setName ) ) {
				$this->dieWithError( 'layers-delete-permission-denied', 'permissiondenied' );
			}

			// RATE LIMITING: Prevent abuse by limiting delete operations per user
			// Uses MediaWiki's core rate limiter via User::pingLimiter()
			// Configure in LocalSettings.php:
			//   $wgRateLimits['editlayers-delete']['user'] = [ 20, 3600 ]; // 20 deletes per hour
			//   $wgRateLimits['editlayers-delete']['newbie'] = [ 3, 3600 ]; // stricter for new users
			$rateLimiter = $this->createRateLimiter();
			if ( !$rateLimiter->checkRateLimit( $user, 'delete' ) ) {
				$this->dieWithError( 'layers-rate-limited', 'ratelimited' );
			}

			// Perform the delete
			$rowsDeleted = $db->deleteNamedSet( $imgName, $sha1, $setName );

			if ( $rowsDeleted === null ) {
				$this->getLogger()->error( 'Failed to delete layer set', [
					'filename' => $requestedFilename,
					'setname' => $setName,
					'user' => $user->getName()
				] );
				$this->dieWithError( 'layers-delete-failed', 'deletefailed' );
			}

			$this->getLogger()->info( 'Layer set deleted', [
				'filename' => $requestedFilename,
				'setname' => $setName,
				'user' => $user->getName(),
				'rowsDeleted' => $rowsDeleted
			] );

			// Return success
			$this->getResult()->addValue( 'layersdelete', 'success', 1 );
			$this->getResult()->addValue( 'layersdelete', 'setname', $setName );
			$this->getResult()->addValue( 'layersdelete', 'revisionsDeleted', $rowsDeleted );

		} catch ( \Throwable $e ) {
			$this->getLogger()->error( 'Exception during layer set delete: {message}', [
				'message' => $e->getMessage(),
				'filename' => $requestedFilename,
				'setname' => $setName
			] );
			$this->dieWithError( 'layers-delete-failed', 'deletefailed' );
			return; // @codeCoverageIgnore
		}
	}

	/**
	 * Handle slide-specific delete requests.
	 *
	 * Slides are stored with imgName='Slide:{name}' and sha1='slide'.
	 *
	 * @param \User $user The current user
	 * @param string $slidename The slide name (without 'Slide:' prefix)
	 * @param string $setName The named set to delete
	 */
	private function executeSlideDelete( $user, string $slidename, string $setName ): void {
		try {
			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );

			// Verify database schema exists (via LayersApiHelperTrait)
			$this->requireSchemaReady( $db );

			// Slides use 'Slide:' prefix for imgName and fixed 'slide' sha1
			$imgName = 'Slide:' . $slidename;
			$sha1 = 'slide';

			// Check if the set exists
			$exists = $db->namedSetExists( $imgName, $sha1, $setName );
			if ( !$exists ) {
				$this->dieWithError( 'layers-layerset-not-found', 'setnotfound' );
			}

			// Permission check: only owner or admin can delete (via LayersApiHelperTrait)
			if ( !$this->isOwnerOrAdmin( $db, $user, $imgName, $sha1, $setName ) ) {
				$this->dieWithError( 'layers-delete-permission-denied', 'permissiondenied' );
			}

			// Rate limiting
			$rateLimiter = $this->createRateLimiter();
			if ( !$rateLimiter->checkRateLimit( $user, 'delete' ) ) {
				$this->dieWithError( 'layers-rate-limited', 'ratelimited' );
			}

			// Perform the delete
			$rowsDeleted = $db->deleteNamedSet( $imgName, $sha1, $setName );

			if ( $rowsDeleted === null ) {
				$this->getLogger()->error( 'Failed to delete slide layer set', [
					'slidename' => $slidename,
					'setname' => $setName,
					'user' => $user->getName()
				] );
				$this->dieWithError( 'layers-delete-failed', 'deletefailed' );
			}

			$this->getLogger()->info( 'Slide layer set deleted', [
				'slidename' => $slidename,
				'setname' => $setName,
				'user' => $user->getName(),
				'rowsDeleted' => $rowsDeleted
			] );

			// Return success
			$this->getResult()->addValue( 'layersdelete', 'success', 1 );
			$this->getResult()->addValue( 'layersdelete', 'setname', $setName );
			$this->getResult()->addValue( 'layersdelete', 'revisionsDeleted', $rowsDeleted );

		} catch ( \Throwable $e ) {
			$this->getLogger()->error( 'Exception during slide delete: {message}', [
				'message' => $e->getMessage(),
				'slidename' => $slidename,
				'setname' => $setName
			] );
			$this->dieWithError( 'layers-delete-failed', 'deletefailed' );
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
			'setname' => [
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
			'action=layersdelete&filename=Example.jpg&setname=my-annotations&token=123ABC' =>
				'apihelp-layersdelete-example-1',
		];
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
