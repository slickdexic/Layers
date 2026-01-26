<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\SpecialPages;

use MediaWiki\Extension\Layers\Validation\SlideNameValidator;
use MediaWiki\MediaWikiServices;
use MediaWiki\SpecialPage\SpecialPage;

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
		$setName = $request->getText( 'setname', 'default' );

		// DEBUG: Log what we received
		wfDebugLog( 'Layers', "SpecialEditSlide: setname from request = '$setName', full query = " .
			$request->getQueryString() );

		// Get slide info to determine lock mode
		$db = $services->get( 'LayersDatabase' );
		$normalizedName = 'Slide:' . $slideName;
		$layerSet = $db->getLayerSetByName( $normalizedName, 'slide', $setName );
		$lockMode = $request->getText( 'lockmode', 'none' );
		// Support both 'canvaswidth'/'canvasheight' (from JS) and 'width'/'height' (legacy)
		$canvasWidth = $request->getInt( 'canvaswidth', 0 ) ?: $request->getInt( 'width', 0 );
		$canvasHeight = $request->getInt( 'canvasheight', 0 ) ?: $request->getInt( 'height', 0 );
		$backgroundColor = $request->getText( 'bgcolor', '' ) ?: $request->getText( 'background', '' );

		// Check if editor is in modal mode (opened as popup/iframe from article page)
		$isModalMode = $request->getBool( 'modal' );

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
		$normalizedFilename = 'Slide:' . $slideName;
		$out->addJsConfigVars( [
			'wgLayersEditorInit' => [
				'filename' => $normalizedFilename,
				// Slides don't have a base image
				'imageUrl' => null,
				'isSlide' => true,
				'slideName' => $slideName,
				// Use 'initialSetName' to match EditLayersAction and EditorBootstrap.js
				'initialSetName' => $setName,
				'lockMode' => $lockMode,
				'canvasWidth' => $canvasWidth,
				'canvasHeight' => $canvasHeight,
				'backgroundColor' => $backgroundColor,
				'isModalMode' => $isModalMode,
			],
			'wgLayersSlideConfig' => [
				'slideName' => $slideName,
				'setName' => $setName,
				'isSlide' => true,
				'lockMode' => $lockMode,
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
		return $this->msg( 'special-editslide-desc' );
	}
}
