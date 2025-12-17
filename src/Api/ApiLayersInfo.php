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
use MediaWiki\Extension\Layers\Api\Traits\LayersContinuationTrait;
use MediaWiki\MediaWikiServices;
use Title;

class ApiLayersInfo extends ApiBase {
	use LayersContinuationTrait;

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
		$setName = $params['setname'] ?? null;
		$limit = isset( $params['limit'] ) ? (int)$params['limit'] : 50;
		$limit = max( 1, min( $limit, 200 ) );
		$offset = isset( $params['offset'] ) ? (int)$params['offset'] : 0;
		$offset = max( 0, $offset );
		if ( isset( $params['continue'] ) && $params['continue'] !== '' ) {
			$offset = max( $offset, $this->parseContinueParameter( (string)$params['continue'] ) );
		}

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
		$fileSha1 = $file->getSha1();

		if ( $layerSetId ) {
			// Get specific layer set by ID
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
		} elseif ( $setName ) {
			// Get specific named set
			$layerSet = $db->getLayerSetByName( $file->getName(), $fileSha1, $setName );

			if ( !$layerSet ) {
				$result = [
					'layerset' => null,
					'message' => $this->msg( 'layers-no-layers' )->text()
				];
			} else {
				// Normalize response format
				$layerSet = [
					'id' => $layerSet['id'],
					'imgName' => $layerSet['imgName'],
					'userId' => $layerSet['userId'],
					'timestamp' => $layerSet['timestamp'],
					'revision' => $layerSet['revision'],
					'name' => $layerSet['setName'],
					'data' => $layerSet['data'],
					'baseWidth' => $origWidth,
					'baseHeight' => $origHeight
				];
				$result = [
					'layerset' => $layerSet
				];
			}

			// Get revision history for this specific named set
			$setRevisions = $db->getSetRevisions( $file->getName(), $fileSha1, $setName, $limit );
			$setRevisions = $this->enrichWithUserNames( $setRevisions );
			$result['set_revisions'] = $setRevisions;
		} else {
			// Get latest layer set for this file (default behavior)
			// Try default set first, then fall back to any latest
			$defaultSetName = $this->getConfig()->get( 'LayersDefaultSetName' );
			$layerSet = $db->getLayerSetByName( $file->getName(), $fileSha1, $defaultSetName );

			if ( !$layerSet ) {
				// Fall back to latest of any set
				$layerSet = $db->getLatestLayerSet( $file->getName(), $fileSha1 );
			}

			if ( !$layerSet ) {
				$result = [
					'layerset' => null,
					'message' => $this->msg( 'layers-no-layers' )->text()
				];
			} else {
				// Normalize response format for getLayerSetByName result
				if ( isset( $layerSet['setName'] ) ) {
					$layerSet = [
						'id' => $layerSet['id'],
						'imgName' => $layerSet['imgName'],
						'userId' => $layerSet['userId'],
						'timestamp' => $layerSet['timestamp'],
						'revision' => $layerSet['revision'],
						'name' => $layerSet['setName'],
						'data' => $layerSet['data'],
						'baseWidth' => $origWidth,
						'baseHeight' => $origHeight
					];
				} else {
					// Enrich with base dimensions
					$layerSet['baseWidth'] = $origWidth;
					$layerSet['baseHeight'] = $origHeight;
				}
				$result = [
					'layerset' => $layerSet
				];
			}

			// Get all revisions for the CURRENT set only (not all sets)
			// This ensures the revision selector shows only relevant history
			$currentSetName = $layerSet['name'] ?? $layerSet['setName'] ?? null;
			if ( $currentSetName ) {
				// Use set-specific revisions
				$allLayerSets = $db->getSetRevisions( $file->getName(), $fileSha1, $currentSetName, $limit );
			} else {
				// Fallback for backwards compatibility - get all revisions
				$fetchLimit = min( $limit + 1, 201 );
				$allLayerSets = $db->getLayerSetsForImageWithOptions(
					$file->getName(),
					$fileSha1,
					[
						'sort' => 'ls_revision',
						'direction' => 'DESC',
						'limit' => $fetchLimit,
						'offset' => $offset,
						'includeData' => false
					]
				);
				$hasMore = count( $allLayerSets ) > $limit;
				if ( $hasMore ) {
					$allLayerSets = array_slice( $allLayerSets, 0, $limit );
				}
			}
			$allLayerSets = $this->enrichWithUserNames( $allLayerSets );
			$result['all_layersets'] = $allLayerSets;
		}

		// Always include named_sets summary (except for specific layersetid lookup)
		if ( !$layerSetId ) {
			$namedSets = $db->getNamedSetsForImage( $file->getName(), $fileSha1 );
			$namedSets = $this->enrichNamedSetsWithUserNames( $namedSets );
			$result['named_sets'] = $namedSets;
		}

		$this->getResult()->addValue( null, $this->getModuleName(), $result );
	}

	/**
	 * Enrich layer set rows with user names
	 *
	 * @param array $rows Array of layer set rows
	 * @return array Enriched rows
	 */
	private function enrichWithUserNames( array $rows ): array {
		if ( empty( $rows ) ) {
			return $rows;
		}

		try {
			// Collect all unique user IDs
			$userIds = [];
			foreach ( $rows as $row ) {
				$userId = (int)( $row['ls_user_id'] ?? 0 );
				if ( $userId > 0 ) {
					$userIds[] = $userId;
				}
			}

			// Batch load users
			$users = [];
			if ( !empty( $userIds ) ) {
				$userIds = array_unique( $userIds );
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
			foreach ( $rows as &$row ) {
				$userId = (int)( $row['ls_user_id'] ?? 0 );
				$row['ls_user_name'] = $users[$userId] ?? 'Anonymous';
			}
			unset( $row );
		} catch ( \Throwable $e ) {
			// If user lookup fails, proceed without names
			if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->warning( 'Failed to batch load user names for layer sets: ' . $e->getMessage() );
			}
		}

		return $rows;
	}

	/**
	 * Enrich named sets summary with user names
	 *
	 * @param array $namedSets Array of named set summaries
	 * @return array Enriched named sets
	 */
	private function enrichNamedSetsWithUserNames( array $namedSets ): array {
		if ( empty( $namedSets ) ) {
			return $namedSets;
		}

		try {
			// Collect all unique user IDs
			$userIds = [];
			foreach ( $namedSets as $set ) {
				$userId = (int)( $set['latest_user_id'] ?? 0 );
				if ( $userId > 0 ) {
					$userIds[] = $userId;
				}
			}

			// Batch load users
			$users = [];
			if ( !empty( $userIds ) ) {
				$userIds = array_unique( $userIds );
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

			// Apply user names
			foreach ( $namedSets as &$set ) {
				$userId = (int)( $set['latest_user_id'] ?? 0 );
				$set['latest_user_name'] = $users[$userId] ?? 'Anonymous';
			}
			unset( $set );
		} catch ( \Throwable $e ) {
			// If user lookup fails, proceed without names
			if ( class_exists( '\\MediaWiki\\Logger\\LoggerFactory' ) ) {
				$logger = \call_user_func( [ '\\MediaWiki\\Logger\\LoggerFactory', 'getInstance' ], 'Layers' );
				$logger->warning( 'Failed to batch load user names for named sets: ' . $e->getMessage() );
			}
		}

		return $namedSets;
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
			'setname' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false,
			],
			'limit' => [
				ApiBase::PARAM_TYPE => 'integer',
				ApiBase::PARAM_REQUIRED => false,
				ApiBase::PARAM_MIN => 1,
				ApiBase::PARAM_MAX => 200,
			],
			'offset' => [
				ApiBase::PARAM_TYPE => 'integer',
				ApiBase::PARAM_REQUIRED => false,
				ApiBase::PARAM_MIN => 0,
			],
			'continue' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false,
			],
		];
	}

	/**
	 * Parse the continue parameter into an offset integer.
	 *
	 * @param string $continue
	 * @return int
	 */
	protected function parseContinueParameter( string $continue ): int {
		if ( strpos( $continue, 'offset|' ) === 0 ) {
			$parts = explode( '|', $continue );
			$offset = (int)( $parts[1] ?? 0 );
			return max( 0, $offset );
		}
		return max( 0, (int)$continue );
	}

	/**
	 * Build a continue parameter for the next offset.
	 *
	 * @param int $offset
	 * @return string
	 */
	protected function formatContinueParameter( int $offset ): string {
		return 'offset|' . max( 0, $offset );
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
