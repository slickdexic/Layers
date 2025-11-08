<?php

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;

class ApiLayersSave extends ApiBase {

	/**
	 * Main execution function
	 *
	 * @throws \ApiUsageException When user lacks permission or data is invalid
	 */
	public function execute() {
		$user = $this->getUser();
		$params = $this->extractRequestParams();
		$this->checkUserRightsAny( 'editlayers' );

		try {
			$db = MediaWikiServices::getInstance()->get( 'LayersDatabase' );

			// Ensure DB schema is present
			if ( !$db->isSchemaReady() ) {
				$this->dieWithError(
					[ 'layers-db-error', 'Layer tables missing. Please run maintenance/update.php' ],
					'dbschema-missing'
				);
			}

			$fileName = $params['filename'];
			$data = $params['data'];
			$setName = $params['setname'] ?? 'default';

			// Sanitize set name
			$setName = htmlspecialchars( $setName, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			if ( strlen( $setName ) > 255 ) {
				$setName = substr( $setName, 0, 255 );
			}
			if ( $setName === '' ) {
				$setName = 'default';
			}

			$title = Title::newFromText( $fileName, NS_FILE );
			if ( !$title || !$title->exists() ) {
				$this->dieWithError( 'layers-invalid-filename', 'invalidfilename' );
			}
			$fileName = $title->getText();

			$maxBytes = $this->getConfig()->get( 'LayersMaxBytes' );
			if ( strlen( $data ) > $maxBytes ) {
				$this->dieWithError( 'layers-data-too-large', 'datatoolarge' );
			}

			$layersData = json_decode( $data, true );
			if ( $layersData === null ) {
				$this->dieWithError( 'layers-json-parse-error', 'invalidjson' );
			}

			$validator = new ServerSideLayerValidator();
			$validationResult = $validator->validateLayers( $layersData );

			if ( !$validationResult->isValid() ) {
				$errors = implode( '; ', $validationResult->getErrors() );
				$this->dieWithError( [ 'layers-validation-failed', $errors ], 'validationfailed' );
			}

			$sanitizedData = $validationResult->getData();

			if ( $validationResult->hasWarnings() ) {
				$warnings = implode( '; ', $validationResult->getWarnings() );
				$this->getLogger()->warning(
					'Layers validation warnings: {warnings}',
					[ 'warnings' => $warnings ]
				);
			}

			$rateLimiter = new RateLimiter();
			if ( !$rateLimiter->checkRateLimit( $user, 'save' ) ) {
				$this->dieWithError( 'layers-rate-limited', 'ratelimited' );
			}

			$repoGroup = MediaWikiServices::getInstance()->getRepoGroup();
			$file = $repoGroup->findFile( $fileName );
			if ( !$file || !$file->exists() ) {
				$this->dieWithError( 'layers-file-not-found', 'filenotfound' );
			}

			$imgMetadata = [
				'mime' => $file->getMimeType(),
				'sha1' => $file->getSha1(),
			];

			$layerSetId = $db->saveLayerSet(
				$fileName,
				$imgMetadata,
				$sanitizedData,
				$user->getId(),
				$setName
			);

			if ( $layerSetId ) {
				$resultData = [
					'success' => 1,
					'layersetid' => $layerSetId,
					'result' => 'Success'
				];
				$this->getResult()->addValue( null, $this->getModuleName(), $resultData );
			} else {
				$this->dieWithError( 'layers-save-failed', 'savefailed' );
			}
		} catch ( \Throwable $e ) {
			// Log the full error to a file for debugging
			$logMessage = "[DEBUG] " . date( 'Y-m-d H:i:s' ) . " ApiLayersSave Exception: " . $e->getMessage() . "\n";
			file_put_contents( dirname( __DIR__, 2 ) . '/layers.log', $logMessage, FILE_APPEND );

			// Die with a structured error for the client, including the message for debugging
			$this->dieStatus( \StatusValue::newFatal( 'layers-save-failed-internal', $e->getMessage() ) );
		}
	}

	/**
	 * @inheritDoc
	 */
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

	/**
	 * Check if this API module needs a token
	 *
	 * @return string Type of token required ('csrf' for write operations)
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * Check if this API module is in write mode
	 *
	 * @return bool True since this module modifies data
	 */
	public function isWriteMode() {
		return true;
	}

	/**
	 * Get example messages for this API module
	 *
	 * @return array Array of example API calls with descriptions
	 */
	public function getExamplesMessages() {
		return [
			'action=layerssave&filename=Example.jpg&data=' .
				'[{"id":"1","type":"text","text":"Hello","x":100,"y":50}]&token=123ABC' =>
				'apihelp-layerssave-example-1',
		];
	}
}
