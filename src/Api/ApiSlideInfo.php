<?php
/**
 * API module for retrieving slide information
 *
 * Provides an API endpoint to get a specific slide's layer data
 * by slide name.
 *
 * @file
 * @ingroup API
 */

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Logging\LoggerAwareTrait;
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;
use Wikimedia\ParamValidator\ParamValidator;

class ApiSlideInfo extends ApiBase {
	use LoggerAwareTrait;

	/** @var LayersDatabase */
	private LayersDatabase $layersDatabase;

	/**
	 * Constructor
	 *
	 * @param \ApiMain $mainModule
	 * @param string $moduleName
	 * @param LayersDatabase $layersDatabase
	 */
	public function __construct(
		\ApiMain $mainModule,
		string $moduleName,
		LayersDatabase $layersDatabase
	) {
		parent::__construct( $mainModule, $moduleName );
		$this->layersDatabase = $layersDatabase;
	}

	/**
	 * @inheritDoc
	 */
	public function execute() {
		// Check if slides feature is enabled
		$config = $this->getConfig();
		try {
			$enabled = $config->get( 'LayersSlidesEnable' );
		} catch ( \ConfigException $e ) {
			$enabled = false;
		}

		if ( !$enabled ) {
			$this->dieWithError( 'layers-slides-disabled', 'slidesdisabled' );
			return;
		}

		$params = $this->extractRequestParams();
		$slideName = $params['slidename'];
		$setName = $params['setname'] ?? 'default';

		// Validate slide name
		$validator = new SlideNameValidator();
		$validationResult = $validator->validate( $slideName );
		if ( !$validationResult->isValid() ) {
			$this->dieWithError( $validationResult->getMessage(), 'invalidslidename' );
			return;
		}

		// Get slide data from database
		$slideData = $this->layersDatabase->getSlideByName( $slideName );

		if ( $slideData === null ) {
			// Slide doesn't exist - return empty response
			$this->getResult()->addValue( null, $this->getModuleName(), [
				'slide' => null,
				'exists' => false,
				'slidename' => $slideName,
			] );
			return;
		}

		// The database returns 'layerData' which contains the full layer structure
		$data = $slideData['layerData'] ?? null;
		if ( is_string( $data ) ) {
			$data = json_decode( $data, true );
		}

		// Build response
		$response = [
			'slide' => [
				'id' => $slideData['id'] ?? null,
				'slidename' => $slideName,
				'setname' => $slideData['setName'] ?? $setName,
				'revision' => $slideData['revision'] ?? 1,
				'userId' => $slideData['userId'] ?? null,
				'timestamp' => $slideData['timestamp'] ?? null,
				'canvasWidth' => $slideData['canvasWidth'] ?? 800,
				'canvasHeight' => $slideData['canvasHeight'] ?? 600,
				'backgroundColor' => $slideData['backgroundColor'] ?? '#ffffff',
				'data' => $data,
			],
			'exists' => true,
			'slidename' => $slideName,
		];

		// Add baseWidth/baseHeight for compatibility with viewer
		$response['slide']['baseWidth'] = $response['slide']['canvasWidth'];
		$response['slide']['baseHeight'] = $response['slide']['canvasHeight'];

		$this->getResult()->addValue( null, $this->getModuleName(), $response );
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'slidename' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_REQUIRED => true,
			],
			'setname' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_REQUIRED => false,
				ParamValidator::PARAM_DEFAULT => 'default',
			],
		];
	}

	/**
	 * @inheritDoc
	 */
	protected function getExamplesMessages() {
		return [
			'action=slideinfo&slidename=MySlide'
				=> 'apihelp-slideinfo-example-basic',
		];
	}

	/**
	 * @inheritDoc
	 */
	public function getHelpUrls() {
		return 'https://www.mediawiki.org/wiki/Extension:Layers/API#slideinfo';
	}

	/**
	 * @inheritDoc
	 */
	public function isReadMode() {
		return true;
	}
}
