<?php

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
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

	/**
	 * @var LoggerInterface|null
	 */
	private $logger = null;

	/**
	 * Execute the delete operation.
	 */
	public function execute() {
		$user = $this->getUser();
		$params = $this->extractRequestParams();
		$requestedFilename = $params['filename'];
		$setName = $params['setname'];

		// Require editlayers permission
		$this->checkUserRightsAny( 'editlayers' );

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

			// Get file metadata
			$file = MediaWikiServices::getInstance()->getRepoGroup()->getLocalRepo()->findFile( $title );
			if ( !$file || !$file->exists() ) {
				$this->dieWithError( 'layers-file-not-found', 'invalidfilename' );
			}

			$imgName = $file->getName();
			$sha1 = $file->getSha1();

			// Check if the layer set exists
			$layerSet = $db->getLayerSetByName( $imgName, $sha1, $setName );
			if ( !$layerSet ) {
				$this->dieWithError( 'layers-layerset-not-found', 'setnotfound' );
			}

			// PERMISSION CHECK: Only owner or admin can delete
			$ownerId = $db->getNamedSetOwner( $imgName, $sha1, $setName );
			$userId = $user->getId();
			$isOwner = ( $ownerId !== null && $ownerId === $userId );
			$isAdmin = $user->isAllowed( 'delete' );

			if ( !$isOwner && !$isAdmin ) {
				$this->dieWithError( 'layers-delete-permission-denied', 'permissiondenied' );
			}

			// Perform the delete
			$rowsDeleted = $db->deleteNamedSet( $imgName, $sha1, $setName );

			if ( $rowsDeleted < 0 ) {
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

		} catch ( \Exception $e ) {
			$this->getLogger()->error( 'Exception during layer set delete: {message}', [
				'message' => $e->getMessage(),
				'filename' => $requestedFilename,
				'setname' => $setName
			] );
			$this->dieWithError( 'layers-delete-failed', 'deletefailed' );
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
				ApiBase::PARAM_REQUIRED => true,
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
}
