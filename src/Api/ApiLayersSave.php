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

			// SECURITY FIX: Validate and sanitize set name more strictly
			// Remove path traversal, control characters, and dangerous patterns
			$setName = trim( $setName );
			// Remove any path traversal attempts, null bytes, and control characters
			$setName = preg_replace( '/[\x00-\x1F\x7F\/\\\\]/', '', $setName );
			// Allow only safe characters: alphanumeric, spaces, dashes, underscores
			$setName = preg_replace( '/[^a-zA-Z0-9_\-\s]/', '', $setName );
			// Collapse multiple spaces
			$setName = preg_replace( '/\s+/', ' ', $setName );
			// Truncate to safe length
			$setName = substr( $setName, 0, 255 );
			// Ensure not empty after sanitization
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
			// SECURITY FIX: Use MediaWiki's logging system instead of file_put_contents
			// This prevents disk exhaustion attacks and information disclosure
			$this->getLogger()->error(
				'Layer save failed: {message}',
				[
					'message' => $e->getMessage(),
					'exception' => $e,
					'user_id' => $user->getId(),
					'filename' => $fileName
				]
			);

			// SECURITY FIX: Return generic error to client, not exception details
			// This prevents information disclosure of internal system details
			$this->dieWithError( 'layers-save-failed', 'savefailed' );
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
