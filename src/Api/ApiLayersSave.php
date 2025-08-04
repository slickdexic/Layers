<?php
/**
 * API module for saving layer data
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use ApiMain;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use File;
use RepoGroup;

class ApiLayersSave extends ApiBase {

    public function __construct( ApiMain $main, $action ) {
        parent::__construct( $main, $action );
    }

    public function execute() {
        // Check permissions
        $user = $this->getUser();
        if ( !$user->isAllowed( 'editlayers' ) ) {
            $this->dieWithError( 'layers-permission-denied', 'permissiondenied' );
        }

        // Get parameters
        $params = $this->extractRequestParams();
        $filename = $params['filename'];
        $layersData = json_decode( $params['data'], true );
        $setName = $params['setname'] ?? null;

        if ( $layersData === null ) {
            $this->dieWithError( 'Invalid JSON data', 'invalidjson' );
        }

        // Get file information
        $file = RepoGroup::singleton()->findFile( $filename );
        if ( !$file || !$file->exists() ) {
            $this->dieWithError( 'File not found', 'filenotfound' );
        }

        // Validate layer data structure
        if ( !$this->validateLayersData( $layersData ) ) {
            $this->dieWithError( 'Invalid layer data structure', 'invaliddata' );
        }

        // Save to database
        $db = new LayersDatabase();
        $layerSetId = $db->saveLayerSet(
            $file->getName(),
            $file->getMimeType(),
            $file->getMinorMimeType(),
            $file->getSha1(),
            $layersData,
            $user->getId(),
            $setName
        );

        if ( $layerSetId === false ) {
            $this->dieWithError( 'Failed to save layer data', 'savefailed' );
        }

        // Return success response
        $this->getResult()->addValue( null, $this->getModuleName(), [
            'success' => true,
            'layersetid' => $layerSetId,
            'message' => 'Layers saved successfully'
        ] );
    }

    /**
     * Validate the structure of layer data
     * @param array $layersData
     * @return bool
     */
    private function validateLayersData( array $layersData ): bool {
        // Basic validation - check if it's an array of layer objects
        if ( !is_array( $layersData ) ) {
            return false;
        }

        foreach ( $layersData as $layer ) {
            if ( !is_array( $layer ) ) {
                return false;
            }
            
            // Each layer must have at least id and type
            if ( !isset( $layer['id'] ) || !isset( $layer['type'] ) ) {
                return false;
            }

            // Validate layer type
            $validTypes = [ 'text', 'arrow', 'rectangle', 'circle', 'line', 'highlight' ];
            if ( !in_array( $layer['type'], $validTypes ) ) {
                return false;
            }

            // Basic coordinate validation
            if ( isset( $layer['x'] ) && !is_numeric( $layer['x'] ) ) {
                return false;
            }
            if ( isset( $layer['y'] ) && !is_numeric( $layer['y'] ) ) {
                return false;
            }
        }

        return true;
    }

    public function getAllowedParams() {
        return [
            'filename' => [
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => true,
            ],
            'data' => [
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => true,
            ],
            'setname' => [
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => false,
            ],
            'token' => [
                ApiBase::PARAM_TYPE => 'string',
                ApiBase::PARAM_REQUIRED => true,
            ],
        ];
    }

    public function needsToken() {
        return 'csrf';
    }

    public function isWriteMode() {
        return true;
    }

    public function getExamplesMessages() {
        return [
            'action=layerssave&filename=Example.jpg&data=[{"id":"1","type":"text","text":"Hello","x":100,"y":50}]&token=123ABC'
                => 'apihelp-layerssave-example-1',
        ];
    }
}
