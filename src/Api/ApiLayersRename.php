<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use MediaWiki\Extension\Layers\Api\Traits\ForeignFileHelperTrait;
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
	use ForeignFileHelperTrait;

	/** @var LoggerInterface|null */
	private ?LoggerInterface $logger = null;

	/**
	 * Execute the rename operation.
	 */
	public function execute() {
		$user = $this->getUser();
		$params = $this->extractRequestParams();
		$requestedFilename = $params['filename'];
		$oldName = SetNameSanitizer::sanitize( $params['oldname'] );
		$newName = SetNameSanitizer::sanitize( $params['newname'] );

		// Require editlayers permission
		$this->checkUserRightsAny( 'editlayers' );

		// Validate new name format
		if ( !$this->isValidSetName( $newName ) ) {
			$this->dieWithError( 'layers-invalid-setname', 'invalidsetname' );
		}

		// Prevent renaming to 'default'
		if ( strtolower( $newName ) === 'default' && strtolower( $oldName ) !== 'default' ) {
			$this->dieWithError( 'layers-cannot-rename-to-default', 'invalidsetname' );
		}

		try {
			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );

			// Verify database schema exists
			if ( !$db->isSchemaReady() ) {
				$this->dieWithError(
					[ 'layers-db-error', 'Layer tables missing. Please run maintenance/update.php' ],
					'dbschema-missing'
				);
			}

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
				$this->dieWithError( 'layers-layerset-not-found', 'setnotfound' );
			}

			// Check if new name already exists
			if ( $db->namedSetExists( $imgName, $sha1, $newName ) ) {
				$this->dieWithError( 'layers-setname-exists', 'setnameexists' );
			}

			// PERMISSION CHECK: Only owner or admin can rename
			$ownerId = $db->getNamedSetOwner( $imgName, $sha1, $oldName );
			$userId = $user->getId();
			$isOwner = ( $ownerId !== null && $ownerId === $userId );
			$isAdmin = $user->isAllowed( 'delete' );

			if ( !$isOwner && !$isAdmin ) {
				$this->dieWithError( 'layers-rename-permission-denied', 'permissiondenied' );
			}

			// RATE LIMITING: Prevent abuse by limiting rename operations per user
			// Uses MediaWiki's core rate limiter via User::pingLimiter()
			// Configure in LocalSettings.php:
			//   $wgRateLimits['editlayers-rename']['user'] = [ 20, 3600 ]; // 20 renames per hour
			//   $wgRateLimits['editlayers-rename']['newbie'] = [ 3, 3600 ]; // stricter for new users
			$rateLimiter = $this->createRateLimiter();
			if ( !$rateLimiter->checkRateLimit( $user, 'rename' ) ) {
				$this->dieWithError( 'layers-rate-limited', 'ratelimited' );
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
				$this->dieWithError( 'layers-rename-failed', 'renamefailed' );
			}

			$this->getLogger()->info( 'Layer set renamed', [
				'filename' => $requestedFilename,
				'oldname' => $oldName,
				'newname' => $newName,
				'user' => $user->getName()
			] );

			// Return success
			$this->getResult()->addValue( 'layersrename', 'success', 1 );
			$this->getResult()->addValue( 'layersrename', 'oldname', $oldName );
			$this->getResult()->addValue( 'layersrename', 'newname', $newName );

		} catch ( \Exception $e ) {
			$this->getLogger()->error( 'Exception during layer set rename: {message}', [
				'message' => $e->getMessage(),
				'filename' => $requestedFilename,
				'oldname' => $oldName,
				'newname' => $newName
			] );
			$this->dieWithError( 'layers-rename-failed', 'renamefailed' );
		}
	}

	/**
	 * Validate a set name.
	 *
	 * @param string $name The name to validate
	 * @return bool True if valid
	 */
	private function isValidSetName( string $name ): bool {
		// Must be 1-50 characters, alphanumeric, hyphens, underscores
		if ( strlen( $name ) < 1 || strlen( $name ) > 50 ) {
			return false;
		}
		return (bool)preg_match( '/^[a-zA-Z0-9_-]+$/', $name );
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
				ApiBase::PARAM_REQUIRED => true,
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
