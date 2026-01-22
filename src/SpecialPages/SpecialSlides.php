<?php

namespace MediaWiki\Extension\Layers\SpecialPages;

use MediaWiki\Extension\Layers\Validation\SlideNameValidator;
use MediaWiki\MediaWikiServices;
use MediaWiki\SpecialPage\SpecialPage;

/**
 * Special:Slides - Management interface for Layers slides.
 *
 * This special page provides:
 * - List view of all slides with search/filter
 * - Create new slide dialog
 * - Edit/delete actions for existing slides
 * - Direct link to slide editor
 *
 * URL Structure:
 * - Special:Slides - List all slides
 * - Special:Slides/SlideName - View/edit specific slide
 * - Special:Slides?action=create - Open create dialog
 *
 * @see docs/SLIDE_MODE.md Section 7 for full specification
 */
class SpecialSlides extends SpecialPage {

	/**
	 * Constructor.
	 */
	public function __construct() {
		parent::__construct( 'Slides' );
	}

	/**
	 * @inheritDoc
	 */
	public function execute( $subPage ) {
		$this->setHeaders();
		$out = $this->getOutput();
		$user = $this->getUser();
		$config = $this->getConfig();

		// Check if slides feature is enabled
		if ( !$config->get( 'LayersSlidesEnable' ) ) {
			$out->addWikiMsg( 'layers-slide-disabled' );
			return;
		}

		// Check if we're viewing a specific slide
		if ( $subPage !== null && $subPage !== '' ) {
			$this->showSlide( $subPage );
			return;
		}

		// Show the slides list
		$this->showSlidesList();
	}

	/**
	 * Show the list of all slides.
	 */
	private function showSlidesList(): void {
		$out = $this->getOutput();
		$user = $this->getUser();
		$services = MediaWikiServices::getInstance();

		// Add ResourceLoader modules
		$out->addModules( 'ext.layers.slides' );
		$out->addModuleStyles( 'ext.layers.slides.styles' );

		// Set page title
		$out->setPageTitle( $this->msg( 'special-slides' )->text() );

		// Check if user can create slides
		$permissionManager = $services->getPermissionManager();
		$canCreate = $permissionManager->userHasRight( $user, 'editlayers' );
		$canDelete = $permissionManager->userHasRight( $user, 'delete' );

		// Get configuration for JS
		$jsConfig = [
			'canCreate' => $canCreate,
			'canDelete' => $canDelete,
			'defaultWidth' => $this->getConfig()->get( 'LayersSlideDefaultWidth' ),
			'defaultHeight' => $this->getConfig()->get( 'LayersSlideDefaultHeight' ),
			'defaultBackground' => $this->getConfig()->get( 'LayersSlideDefaultBackground' ),
			'maxWidth' => $this->getConfig()->get( 'LayersSlideMaxWidth' ),
			'maxHeight' => $this->getConfig()->get( 'LayersSlideMaxHeight' ),
		];

		$out->addJsConfigVars( 'wgLayersSlidesConfig', $jsConfig );

		// Build the page structure (JS will populate the content)
		$html = $this->buildSlidesListHtml( $canCreate );
		$out->addHTML( $html );
	}

	/**
	 * Build the HTML structure for the slides list.
	 *
	 * @param bool $canCreate Whether the user can create slides
	 * @return string HTML content
	 */
	private function buildSlidesListHtml( bool $canCreate ): string {
		$html = '<div class="layers-slides-container">';

		// Header with create button
		$html .= '<div class="layers-slides-header">';
		if ( $canCreate ) {
			$html .= '<button class="layers-slides-create-btn cdx-button cdx-button--action-progressive cdx-button--weight-primary">';
			$html .= '<span class="cdx-button__icon" aria-hidden="true"></span>';
			$html .= $this->msg( 'special-slides-create' )->escaped();
			$html .= '</button>';
		}
		$html .= '</div>';

		// Search and filter bar
		$html .= '<div class="layers-slides-toolbar">';
		$html .= '<div class="layers-slides-search">';
		$html .= '<input type="text" class="layers-slides-search-input cdx-text-input__input" ';
		$html .= 'placeholder="' . $this->msg( 'special-slides-search' )->escaped() . '" />';
		$html .= '</div>';
		$html .= '<div class="layers-slides-sort">';
		$html .= '<label>' . $this->msg( 'special-slides-sort' )->escaped() . ' </label>';
		$html .= '<select class="layers-slides-sort-select cdx-select">';
		$html .= '<option value="name">' . $this->msg( 'special-slides-sort-name' )->escaped() . '</option>';
		$html .= '<option value="modified">' . $this->msg( 'special-slides-sort-modified' )->escaped() . '</option>';
		$html .= '<option value="created">' . $this->msg( 'special-slides-sort-created' )->escaped() . '</option>';
		$html .= '</select>';
		$html .= '</div>';
		$html .= '</div>';

		// Slides list (populated by JS)
		$html .= '<div class="layers-slides-list" role="list" aria-label="' .
			$this->msg( 'special-slides' )->escaped() . '">';
		$html .= '<div class="layers-slides-loading">';
		$html .= $this->msg( 'special-slides-loading' )->escaped();
		$html .= '</div>';
		$html .= '</div>';

		// Pagination (populated by JS)
		$html .= '<div class="layers-slides-pagination"></div>';

		$html .= '</div>';

		return $html;
	}

	/**
	 * Show a specific slide or redirect to editor.
	 *
	 * @param string $slideName The slide name from the URL
	 */
	private function showSlide( string $slideName ): void {
		$out = $this->getOutput();
		$user = $this->getUser();
		$services = MediaWikiServices::getInstance();

		// Validate slide name
		$validator = new SlideNameValidator();
		if ( !$validator->isValid( $slideName ) ) {
			$out->showErrorPage( 'error', 'layers-slide-invalid-name' );
			return;
		}

		// Check if slide exists
		$db = $services->get( 'LayersDatabase' );
		$normalizedName = 'Slide:' . $slideName;
		$layerSet = $db->getLayerSetByName( $normalizedName, 'slide', 'default' );

		// Check permissions
		$permissionManager = $services->getPermissionManager();
		$canEdit = $permissionManager->userHasRight( $user, 'editlayers' );

		if ( !$layerSet ) {
			// Slide doesn't exist
			if ( $canEdit ) {
				// Offer to create it
				$out->setPageTitle( $this->msg( 'special-slides-create-title', $slideName )->text() );
				$out->addWikiMsg( 'special-slides-not-found-create', $slideName );

				// Add create form
				$this->showCreateForm( $slideName );
			} else {
				$out->showErrorPage( 'error', 'layers-slide-not-found' );
			}
			return;
		}

		// Slide exists - redirect to editor
		$editorUrl = $this->getSlideEditorUrl( $slideName );
		$out->redirect( $editorUrl );
	}

	/**
	 * Show the create slide form.
	 *
	 * @param string $defaultName Optional default slide name
	 */
	private function showCreateForm( string $defaultName = '' ): void {
		$out = $this->getOutput();

		// Add the create module
		$out->addModules( 'ext.layers.slides' );
		$out->addModuleStyles( 'ext.layers.slides.styles' );

		$html = '<div class="layers-slide-create-form">';
		$html .= '<form id="layers-slide-create-form">';

		// Slide name
		$html .= '<div class="layers-form-field">';
		$html .= '<label for="slide-name">' . $this->msg( 'layers-slide-name' )->escaped() . '</label>';
		$html .= '<input type="text" id="slide-name" class="cdx-text-input__input" ';
		$html .= 'value="' . htmlspecialchars( $defaultName ) . '" ';
		$html .= 'pattern="[a-zA-Z0-9_-]+" required />';
		$html .= '<div class="layers-form-hint">' . $this->msg( 'layers-slide-name-hint' )->escaped() . '</div>';
		$html .= '</div>';

		// Canvas size
		$html .= '<fieldset class="layers-form-field">';
		$html .= '<legend>' . $this->msg( 'layers-slide-canvas-size' )->escaped() . '</legend>';
		$html .= '<div class="layers-size-presets">';
		$presets = [
			[ 800, 600, 'layers-slide-size-standard' ],
			[ 1024, 768, 'layers-slide-size-4-3' ],
			[ 1280, 720, 'layers-slide-size-16-9-hd' ],
			[ 1920, 1080, 'layers-slide-size-16-9-fhd' ],
		];
		foreach ( $presets as $i => $preset ) {
			$checked = $i === 0 ? 'checked' : '';
			$html .= '<label class="layers-size-preset">';
			$html .= '<input type="radio" name="canvas-size" value="' . $preset[0] . 'x' . $preset[1] . '" ' . $checked . ' />';
			$html .= $this->msg( $preset[2] )->escaped() . ' (' . $preset[0] . '×' . $preset[1] . ')';
			$html .= '</label>';
		}
		$html .= '<label class="layers-size-preset">';
		$html .= '<input type="radio" name="canvas-size" value="custom" />';
		$html .= $this->msg( 'layers-slide-size-custom' )->escaped();
		$html .= '</label>';
		$html .= '<div class="layers-size-custom-fields">';
		$html .= '<input type="number" id="custom-width" min="100" max="4096" value="800" class="cdx-text-input__input" />';
		$html .= '<span>×</span>';
		$html .= '<input type="number" id="custom-height" min="100" max="4096" value="600" class="cdx-text-input__input" />';
		$html .= '</div>';
		$html .= '</div>';
		$html .= '</fieldset>';

		// Background color
		$html .= '<div class="layers-form-field">';
		$html .= '<label for="slide-background">' . $this->msg( 'layers-slide-background' )->escaped() . '</label>';
		$html .= '<div class="layers-color-input">';
		$html .= '<input type="color" id="slide-background" value="#ffffff" />';
		$html .= '<input type="text" id="slide-background-text" value="#ffffff" class="cdx-text-input__input" />';
		$html .= '</div>';
		$html .= '</div>';

		// Submit button
		$html .= '<div class="layers-form-actions">';
		$html .= '<button type="submit" class="cdx-button cdx-button--action-progressive cdx-button--weight-primary">';
		$html .= $this->msg( 'special-slides-create-and-edit' )->escaped();
		$html .= '</button>';
		$html .= '</div>';

		$html .= '</form>';
		$html .= '</div>';

		$out->addHTML( $html );
	}

	/**
	 * Get the URL for editing a slide.
	 *
	 * @param string $slideName The slide name
	 * @return string The editor URL
	 */
	private function getSlideEditorUrl( string $slideName ): string {
		// Use Special:EditSlide or a query parameter
		$title = \SpecialPage::getTitleFor( 'EditSlide', $slideName );
		return $title->getLocalURL();
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
		return $this->msg( 'special-slides-desc' );
	}
}
