<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\SpecialPages;

use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Validation\ColorValidator;
use MediaWiki\Extension\Layers\Validation\SlideNameValidator;
use MediaWiki\MediaWikiServices;
use SpecialPage;

/**
 * Special:EditSlide - Direct slide editor access.
 *
 * This special page provides direct access to the slide editor without
 * going through the Special:Slides list. It's an alias/shortcut for
 * editing slides directly.
 *
 * URL Structure:
 * - Special:EditSlide/SlideName - Open editor for specific slide
 *
 * @see docs/SLIDE_MODE.md Section 7.2 for URL structure
 */
class SpecialEditSlide extends SpecialPage {

	/**
	 * Constructor.
	 */
	public function __construct() {
		parent::__construct( 'EditSlide' );
	}

	/**
	 * @inheritDoc
	 */
	public function execute( $subPage ) {
		$this->setHeaders();
		$out = $this->getOutput();
		$user = $this->getUser();
		$config = $this->getConfig();
		$request = $this->getRequest();

		// Check if slides feature is enabled
		if ( !$config->get( 'LayersSlidesEnable' ) ) {
			$out->addWikiMsg( 'layers-slide-disabled' );
			return;
		}

		// Require a slide name
		if ( $subPage === null || $subPage === '' ) {
			$out->redirect( SpecialPage::getTitleFor( 'Slides' )->getLocalURL() );
			return;
		}

		$slideName = $subPage;

		// Validate slide name
		$validator = new SlideNameValidator();
		if ( !$validator->isValid( $slideName ) ) {
			$out->showErrorPage( 'error', 'layers-slide-invalid-name' );
			return;
		}

		// Check permissions
		$services = MediaWikiServices::getInstance();
		$permissionManager = $services->getPermissionManager();
		if ( !$permissionManager->userHasRight( $user, 'editlayers' ) ) {
			throw new \PermissionsError( 'editlayers' );
		}

		// Get optional parameters - must get setname BEFORE database query
		$setName = $request->getText( 'setname', LayersConstants::DEFAULT_SET_NAME );

		// Get slide info to determine canvas dimensions
		$db = $services->get( 'LayersDatabase' );
		$normalizedName = LayersConstants::SLIDE_PREFIX . $slideName;
		$layerSet = $db->getLayerSetByName( $normalizedName, LayersConstants::TYPE_SLIDE, $setName );
		// Support both 'canvaswidth'/'canvasheight' (from JS) and 'width'/'height' (legacy)
		$canvasWidth = $request->getInt( 'canvaswidth', 0 ) ?: $request->getInt( 'width', 0 );
		$canvasHeight = $request->getInt( 'canvasheight', 0 ) ?: $request->getInt( 'height', 0 );
		$backgroundColor = $request->getText( 'bgcolor', '' ) ?: $request->getText( 'background', '' );

		// Validate backgroundColor from URL params to prevent CSS injection
		if ( $backgroundColor !== '' && !ColorValidator::isValidColor( $backgroundColor ) ) {
			$backgroundColor = '';
		}

		// Check if editor is in modal mode (opened as popup/iframe from article page)
		$isModalMode = $request->getBool( 'modal' );

		// In modal mode, allow the page to be framed (loaded in iframe)
		// Otherwise MediaWiki's default X-Frame-Options header blocks it
		if ( $isModalMode ) {
			if ( method_exists( $out, 'allowClickjacking' ) ) {
				$out->allowClickjacking();
			} elseif ( method_exists( $out, 'setPreventClickjacking' ) ) {
				$out->setPreventClickjacking( false );
			}
		}

		// Extract dimensions from existing slide or use defaults
		if ( $layerSet && isset( $layerSet['data'] ) ) {
			$data = $layerSet['data'];
			if ( $canvasWidth === 0 ) {
				$canvasWidth = $data['canvasWidth'] ?? $config->get( 'LayersSlideDefaultWidth' );
			}
			if ( $canvasHeight === 0 ) {
				$canvasHeight = $data['canvasHeight'] ?? $config->get( 'LayersSlideDefaultHeight' );
			}
			if ( $backgroundColor === '' ) {
				$backgroundColor = $data['backgroundColor'] ?? $config->get( 'LayersSlideDefaultBackground' );
			}
		} else {
			// New slide - use defaults
			if ( $canvasWidth === 0 ) {
				$canvasWidth = $config->get( 'LayersSlideDefaultWidth' );
			}
			if ( $canvasHeight === 0 ) {
				$canvasHeight = $config->get( 'LayersSlideDefaultHeight' );
			}
			if ( $backgroundColor === '' ) {
				$backgroundColor = $config->get( 'LayersSlideDefaultBackground' );
			}
		}

		// Set page title
		$out->setPageTitle( $this->msg( 'special-editslide-title', $slideName )->text() );

		// Add ResourceLoader modules for the editor
		$out->addModules( 'ext.layers.editor' );
		$out->addModuleStyles( 'ext.layers.editor.styles' );

		// Provide editor init configuration (same format as EditLayersAction)
		// The slide-specific config is passed via wgLayersEditorInit to trigger auto-bootstrap
		$normalizedFilename = LayersConstants::SLIDE_PREFIX . $slideName;
		$out->addJsConfigVars( [
			'wgLayersEditorInit' => [
				'filename' => $normalizedFilename,
				// Slides don't have a base image
				'imageUrl' => null,
				'isSlide' => true,
				'slideName' => $slideName,
				// Use 'initialSetName' to match EditLayersAction and EditorBootstrap.js
				'initialSetName' => $setName,
				'canvasWidth' => $canvasWidth,
				'canvasHeight' => $canvasHeight,
				'backgroundColor' => $backgroundColor,
				'isModalMode' => $isModalMode,
			],
			'wgLayersSlideConfig' => [
				'slideName' => $slideName,
				'setName' => $setName,
				'isSlide' => true,
				'canvasWidth' => $canvasWidth,
				'canvasHeight' => $canvasHeight,
				'backgroundColor' => $backgroundColor,
				'exists' => $layerSet !== null && $layerSet !== false,
				'maxWidth' => $config->get( 'LayersSlideMaxWidth' ),
				'maxHeight' => $config->get( 'LayersSlideMaxHeight' ),
			],
			'wgLayersIsModalMode' => $isModalMode,
			'wgLayersMaxNamedSets' => $config->get( 'LayersMaxNamedSets' ),
			'wgLayersMaxRevisionsPerSet' => $config->get( 'LayersMaxRevisionsPerSet' ),
			'wgLayersDefaultSetName' => $config->get( 'LayersDefaultSetName' ),
		] );

		// Use the same container ID as EditLayersAction for consistent bootstrap
		$out->addHTML( '<div id="layers-editor-container"></div>' );
	}

	/**
	 * @inheritDoc
	 */
	protected function getGroupName() {
		return 'media';
	}

	/**
	 * @inheritDoc
	 */
	public function getDescription() {
		return $this->msg( 'special-editslide-desc' )->text();
	}
}
