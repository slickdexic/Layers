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
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\MediaWikiServices;

class ApiLayersInfo extends ApiBase {

	/**
	 * Constructor
	 * @param ApiMain $main
	 * @param string $action
	 */
	public function __construct( ApiMain $main, $action ) {
		parent::__construct( $main, $action );
	}

	/**
	 * Execute the API request
	 */
	public function execute() {
		// Get parameters
		$params = $this->extractRequestParams();
		$filename = $params['filename'];
		$layerSetId = $params['layersetid'] ?? null;

		// Get file information
		$repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
		$file = $repoGroup->findFile( $filename );
		if ( !$file || !$file->exists() ) {
			$this->dieWithError( 'layers-file-not-found', 'filenotfound' );
		}

		$db = new LayersDatabase();

		if ( $layerSetId ) {
			// Get specific layer set
			$layerSet = $db->getLayerSet( $layerSetId );
			if ( !$layerSet ) {
				$this->dieWithError( $this->msg( 'layers-layerset-not-found' ), 'layersetnotfound' );
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
				$result = [
					'layerset' => $layerSet
				];
			}

			// Also get list of all layer sets for this file
			$allLayerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );
			// Enrich with user names for display convenience
			try {
				$userFactory = MediaWikiServices::getInstance()->getUserFactory();
				foreach ( $allLayerSets as &$row ) {
					$userId = (int)( $row['ls_user_id'] ?? 0 );
					$userName = 'Anonymous';
					if ( $userId > 0 ) {
						$user = $userFactory->newFromId( $userId );
						if ( $user ) {
							$userName = $user->getName();
						}
					}
					$row['ls_user_name'] = $userName;
				}
				unset( $row );
			} catch ( \Throwable $e ) {
				// If user lookup fails in some environments, proceed without names
			}
			$result['all_layersets'] = $allLayerSets;
		}

		$this->getResult()->addValue( null, $this->getModuleName(), $result );
	}

	/**
	 * Get allowed parameters for this API module
	 * @return array
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
		];
	}

	/**
	 * Get example messages for this API module
	 * @return array
	 */
	public function getExamplesMessages() {
		return [
			'action=layersinfo&filename=Example.jpg'
				=> 'apihelp-layersinfo-example-1',
			'action=layersinfo&filename=Example.jpg&layersetid=123'
				=> 'apihelp-layersinfo-example-2',
		];
	}
}
