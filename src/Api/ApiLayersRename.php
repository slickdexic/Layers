<?php

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use MediaWiki\MediaWikiServices;
use Title;
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

	/** @var LoggerInterface|null */
	private ?LoggerInterface $logger = null;

	/**
	 * Execute the rename operation.
	 */
	public function execute() {
		$user = $this->getUser();
		$params = $this->extractRequestParams();
		$requestedFilename = $params['filename'];
		$oldName = $this->sanitizeSetName( $params['oldname'] );
		$newName = $this->sanitizeSetName( $params['newname'] );

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

			// Validate filename
			$title = Title::newFromText( $requestedFilename, NS_FILE );
			if ( !$title || !$title->exists() ) {
				$this->dieWithError( 'layers-file-not-found', 'invalidfilename' );
			}

			// Get file metadata (use getRepoGroup() to support foreign repos like Commons)
			$file = MediaWikiServices::getInstance()->getRepoGroup()->findFile( $title );
			if ( !$file || !$file->exists() ) {
				$this->dieWithError( 'layers-file-not-found', 'invalidfilename' );
			}

			$imgName = $file->getName();
			$sha1 = $file->getSha1();

			// Check if the source layer set exists
			$layerSet = $db->getLayerSetByName( $imgName, $sha1, $oldName );
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
	 * Sanitize a user-supplied layer set name.
	 *
	 * @param string $rawSetName
	 * @return string
	 */
	protected function sanitizeSetName( string $rawSetName ): string {
		$setName = trim( $rawSetName );

		// Remove control chars and path separators
		$setName = preg_replace( '/[\x00-\x1F\x7F\/\\\\]/u', '', $setName );

		// Allow letter/number from any script plus underscore, dash, spaces
		$unicodeSafe = preg_replace( '/[^\p{L}\p{N}_\-\s]/u', '', $setName );

		if ( $unicodeSafe === null ) {
			$unicodeSafe = preg_replace( '/[^a-zA-Z0-9_\-\s]/', '', $setName );
		}
		$setName = $unicodeSafe ?? '';

		// Collapse repeated whitespace
		$setName = preg_replace( '/\s+/u', ' ', $setName );

		// Enforce limit
		if ( function_exists( 'mb_substr' ) ) {
			$setName = mb_substr( $setName, 0, 255 );
		} else {
			$setName = substr( $setName, 0, 255 );
		}

		return $setName === '' ? 'default' : $setName;
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
}
