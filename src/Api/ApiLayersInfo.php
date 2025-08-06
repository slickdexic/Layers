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
use RepoGroup;

class ApiLayersInfo extends ApiBase {

	public function __construct( ApiMain $main, $action ) {
		parent::__construct( $main, $action );
	}

	public function execute() {
		// Get parameters
		$params = $this->extractRequestParams();
		$filename = $params['filename'];
		$layerSetId = $params['layersetid'] ?? null;

		// Get file information
		$file = RepoGroup::singleton()->findFile( $filename );
		if ( !$file || !$file->exists() ) {
			$this->dieWithError( 'File not found', 'filenotfound' );
		}

		$db = new LayersDatabase();

		if ( $layerSetId ) {
			// Get specific layer set
			$layerSet = $db->getLayerSet( $layerSetId );
			if ( !$layerSet ) {
				$this->dieWithError( 'Layer set not found', 'layersetnotfound' );
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
					'message' => 'No layers found for this file'
				];
			} else {
				$result = [
					'layerset' => $layerSet
				];
			}

			// Also get list of all layer sets for this file
			$allLayerSets = $db->getLayerSetsForImage( $file->getName(), $file->getSha1() );
			$result['all_layersets'] = $allLayerSets;
		}

		$this->getResult()->addValue( null, $this->getModuleName(), $result );
	}

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

	public function getExamplesMessages() {
		return [
			'action=layersinfo&filename=Example.jpg'
				=> 'apihelp-layersinfo-example-1',
			'action=layersinfo&filename=Example.jpg&layersetid=123'
				=> 'apihelp-layersinfo-example-2',
		];
	}
}
