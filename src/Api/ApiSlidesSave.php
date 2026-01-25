<?php

declare( strict_types=1 );
/**
 * API module for saving slides
 *
 * Provides an API endpoint for saving slide layer data,
 * including canvas dimensions and background settings.
 *
 * @file
 * @ingroup API
 */

namespace MediaWiki\Extension\Layers\Api;

use ApiBase;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Logging\LoggerAwareTrait;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator;
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\ParamValidator\TypeDef\IntegerDef;

class ApiSlidesSave extends ApiBase {
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
		$user = $this->getUser();

		// Check permissions
		$this->checkUserRightsAny( 'editlayers' );

		// Check if slides feature is enabled
		$config = $this->getConfig();
		try {
			$enabled = $config->get( 'LayersSlidesEnable' );
		} catch ( \ConfigException $e ) {
			$enabled = false;
		}

		if ( !$enabled ) {
			$this->dieWithError( 'layers-slides-disabled' );
		}

		// Rate limiting
		$rateLimiter = new RateLimiter( $user );
		if ( $rateLimiter->isLimited( 'editlayers-save' ) ) {
			$this->dieWithError( 'layers-rate-limited' );
		}

		$params = $this->extractRequestParams();

		// Validate slide name
		$slideName = $params['slidename'];
		$validator = new SlideNameValidator();
		$validationResult = $validator->validate( $slideName );
		if ( !$validationResult->isValid() ) {
			$this->dieWithError( $validationResult->getErrors()[0] );
		}

		// Parse and validate layer data
		$dataJson = $params['data'];
		$layerData = json_decode( $dataJson, true );

		if ( $layerData === null && json_last_error() !== JSON_ERROR_NONE ) {
			$this->dieWithError( 'layers-json-parse-error' );
		}

		// Validate layers
		$layerValidator = new ServerSideLayerValidator( $config );
		$layers = $layerData['layers'] ?? $layerData;
		if ( is_array( $layers ) ) {
			$layerValidationResult = $layerValidator->validateLayers( $layers );
			if ( !$layerValidationResult->isValid() ) {
				$this->dieWithError( [
					'layers-invalid-data',
					implode( ', ', $layerValidationResult->getErrors() )
				] );
			}
			$layers = $layerValidationResult->getSanitizedData();
		} else {
			$layers = [];
		}

		// Get canvas dimensions
		$canvasWidth = $params['canvaswidth'];
		$canvasHeight = $params['canvasheight'];

		// Validate dimensions
		$maxWidth = 4096;
		$maxHeight = 4096;
		try {
			$maxWidth = $config->get( 'LayersSlideMaxWidth' );
			$maxHeight = $config->get( 'LayersSlideMaxHeight' );
		} catch ( \ConfigException $e ) {
			// Use defaults
		}

		$canvasWidth = max( 100, min( $maxWidth, $canvasWidth ) );
		$canvasHeight = max( 100, min( $maxHeight, $canvasHeight ) );

		// Get background settings
		$backgroundColor = $params['backgroundcolor'] ?? '';
		$backgroundVisible = $params['backgroundvisible'];
		$backgroundOpacity = $params['backgroundopacity'];

		// Sanitize background color
		if ( $backgroundColor !== '' ) {
			$backgroundColor = $this->sanitizeColor( $backgroundColor );
		}

		// Save the slide
		$slideId = $this->layersDatabase->saveSlide(
			$slideName,
			$layers,
			$user->getId(),
			$canvasWidth,
			$canvasHeight,
			$backgroundColor,
			$backgroundVisible,
			$backgroundOpacity
		);

		if ( $slideId === null ) {
			$this->dieWithError( 'layers-slide-save-error' );
		}

		// Return success
		$result = $this->getResult();
		$result->addValue( null, $this->getModuleName(), [
			'success' => 1,
			'slideid' => $slideId,
			'slidename' => $slideName,
		] );
	}

	/**
	 * Sanitize a color value
	 *
	 * @param string $color The color value
	 * @return string Sanitized color or empty string
	 */
	private function sanitizeColor( string $color ): string {
		$color = trim( $color );

		// Allow hex colors
		if ( preg_match( '/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $color ) ) {
			return $color;
		}

		// Allow rgb/rgba
		if ( preg_match( '/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/', $color ) ) {
			return $color;
		}

		// Allow named colors (basic set)
		$namedColors = [
			'transparent', 'white', 'black', 'red', 'green', 'blue',
			'yellow', 'orange', 'purple', 'pink', 'gray', 'grey'
		];
		if ( in_array( strtolower( $color ), $namedColors, true ) ) {
			return strtolower( $color );
		}

		return '';
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
			'data' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_REQUIRED => true,
			],
			'canvaswidth' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_DEFAULT => 800,
				IntegerDef::PARAM_MIN => 100,
				IntegerDef::PARAM_MAX => 4096,
			],
			'canvasheight' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_DEFAULT => 600,
				IntegerDef::PARAM_MIN => 100,
				IntegerDef::PARAM_MAX => 4096,
			],
			'backgroundcolor' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_DEFAULT => '',
			],
			'backgroundvisible' => [
				ParamValidator::PARAM_TYPE => 'boolean',
				ParamValidator::PARAM_DEFAULT => true,
			],
			'backgroundopacity' => [
				ParamValidator::PARAM_TYPE => 'double',
				ParamValidator::PARAM_DEFAULT => 1.0,
			],
		];
	}

	/**
	 * @inheritDoc
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * @inheritDoc
	 */
	public function isWriteMode() {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function mustBePosted() {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	protected function getExamplesMessages() {
		return [
			'action=slidessave&slidename=MySlide&data=[]&canvaswidth=800&canvasheight=600&token=TOKEN'
				=> 'apihelp-slidessave-example-basic',
		];
	}

	/**
	 * @inheritDoc
	 */
	public function getHelpUrls() {
		return 'https://www.mediawiki.org/wiki/Extension:Layers/API#slidessave';
	}
}
