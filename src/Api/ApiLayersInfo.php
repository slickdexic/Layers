<?php

/**
 * API module for retrieving layer information
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use ApiMain;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;

class ApiLayersInfo extends ApiBase {
	/**
	 * Constructor
	 *
	 * @param ApiMain $main The main API instance
	 * @param string $action The action name for this module
	 */
	public function __construct( ApiMain $main, $action ) {
		parent::__construct( $main, $action );
	}

	/**
	 * Execute the API request
	 *
	 * @throws \ApiUsageException When file is not found or other errors occur
	 */
	public function execute() {
		// Get parameters
		$params = $this->extractRequestParams();
		$filename = $params['filename'];
		$layerSetId = $params['layersetid'] ?? null;
		$limit = isset( $params['limit'] ) ? (int)$params['limit'] : 50;
		$limit = max( 1, min( $limit, 200 ) );

		$title = $this->getTitleFromFilename( $filename );
		if ( !$title ) {
			$this->dieWithError( 'layers-invalid-filename', 'invalidfilename' );
		}

		$user = $this->getUser();
		$permissionManager = MediaWikiServices::getInstance()->getPermissionManager();
		if ( !$permissionManager->userCan( 'read', $user, $title ) ) {
			$this->dieWithError( 'badaccess-group0', 'permissiondenied' );
		}

		// Get file information
		$repoGroup = $this->getRepoGroup();
		$file = $repoGroup->findFile( $title );
		if ( !$file || !$file->exists() ) {
			$this->dieWithError( 'layers-file-not-found', 'filenotfound' );
		}

		$normalizedName = str_replace( ' ', '_', $file->getName() );

		// Capture original image dimensions for client-side scaling
		$origWidth = method_exists( $file, 'getWidth' ) ? (int)$file->getWidth() : null;
		$origHeight = method_exists( $file, 'getHeight' ) ? (int)$file->getHeight() : null;

		$db = $this->getLayersDatabase();

		if ( $layerSetId ) {
			// Get specific layer set
			$layerSet = $db->getLayerSet( $layerSetId );
			if ( !$layerSet ) {
				$this->dieWithError( 'layers-layerset-not-found', 'layersetnotfound' );
			}

			if ( str_replace( ' ', '_', (string)( $layerSet['imgName'] ?? '' ) ) !== $normalizedName ) {
				$this->dieWithError( 'layers-layerset-not-found', 'layersetnotfound' );
			}

			// Enrich with base dimensions to allow correct scaling by clients
			if ( is_array( $layerSet ) ) {
				$layerSet['baseWidth'] = $origWidth;
				$layerSet['baseHeight'] = $origHeight;
			}

			$result = [
				'layerset' => $layerSet
			];
		} else {
			// Get latest layer set for this file
			$layerSet = $db->getLatestLayerSet( $file->getName(), $file->getSha1() );

			if ( !$layerSet ) {
				$result = [
					'layerset' => null,
					'message' => $this->msg( 'layers-no-layers' )->text()
				];
			} else {
				// Enrich with base dimensions to allow correct scaling by clients
				if ( is_array( $layerSet ) ) {
					$layerSet['baseWidth'] = $origWidth;
					$layerSet['baseHeight'] = $origHeight;
				}
				$result = [
					'layerset' => $layerSet
				];
			}

			// Also get list of all layer sets for this file
			$allLayerSets = $db->getLayerSetsForImageWithOptions(
				$file->getName(),
				$file->getSha1(),
				[
					'sort' => 'ls_revision',
					'direction' => 'DESC',
					'limit' => $limit,
					'includeData' => false
				]
			);
			// Enrich with user names for display convenience - batch lookup to avoid N+1 queries
			try {
				// Collect all unique user IDs
				$userIds = [];
				foreach ( $allLayerSets as $row ) {
					$userId = (int)( $row['ls_user_id'] ?? 0 );
					if ( $userId > 0 ) {
						$userIds[] = $userId;
					}
				}

				// Batch load users
				$users = [];
				if ( !empty( $userIds ) ) {
					$userIds = array_unique( $userIds );
					// Batch load user names from database to avoid N+1 queries
					$dbr = $this->getDB();
					$userRows = $dbr->select(
						'user',
						[ 'user_id', 'user_name' ],
						[ 'user_id' => $userIds ],
						__METHOD__
					);
					foreach ( $userRows as $userRow ) {
						$users[(int)$userRow->user_id] = $userRow->user_name;
					}
				}

				// Apply user names to layer sets
				foreach ( $allLayerSets as &$row ) {
					$userId = (int)( $row['ls_user_id'] ?? 0 );
					$row['ls_user_name'] = $users[$userId] ?? 'Anonymous';
				}
				unset( $row );
			} catch ( \Throwable $e ) {
				// If user lookup fails in some environments, proceed without names
				// Log the error for debugging
				if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
					$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
					$logger->warning( 'Failed to batch load user names for layer sets: ' . $e->getMessage() );
				}
			}
			$result['all_layersets'] = $allLayerSets;
		}

		$this->getResult()->addValue( null, $this->getModuleName(), $result );
	}

	/**
	 * Get allowed parameters for this API module
	 *
	 * @return array Array of parameter definitions for filename and layersetid
	 */
	public function getAllowedParams() {
		return [
			'filename' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true,
			],
			'layersetid' => [
				ApiBase::PARAM_TYPE => 'integer',
				ApiBase::PARAM_REQUIRED => false,
			],
			'limit' => [
				ApiBase::PARAM_TYPE => 'integer',
				ApiBase::PARAM_REQUIRED => false,
				ApiBase::PARAM_MIN => 1,
				ApiBase::PARAM_MAX => 200,
			],
		];
	}

	/**
	 * Get example messages for this API module
	 *
	 * @return array Array of example API calls with message keys
	 */
	public function getExamplesMessages() {
		return [
			'action=layersinfo&filename=Example.jpg'
				=> 'apihelp-layersinfo-example-1',
			'action=layersinfo&filename=Example.jpg&layersetid=123'
				=> 'apihelp-layersinfo-example-2',
		];
	}

	/**
	 * Resolve the RepoGroup service. Extracted for easier testing/mocking.
	 *
	 * @return mixed RepoGroup instance
	 */
	protected function getRepoGroup() {
		return MediaWikiServices::getInstance()->getRepoGroup();
	}

	/**
	 * Resolve the LayersDatabase service. Extracted for easier testing/mocking.
	 *
	 * @return mixed LayersDatabase service instance
	 */
	protected function getLayersDatabase() {
		return MediaWikiServices::getInstance()->get( 'LayersDatabase' );
	}

	/**
	 * Build a Title object for the provided filename. Extracted for easier testing.
	 *
	 * @param string $filename
	 * @return Title|null
	 */
	protected function getTitleFromFilename( string $filename ) {
		return Title::makeTitleSafe( NS_FILE, $filename );
	}
}
