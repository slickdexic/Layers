/**
 * Special:Slides JavaScript module.
 *
 * Provides the interactive UI for the Special:Slides management page,
 * including listing, searching, creating, and deleting slides.
 *
 * @module ext.layers.slides
 * @author Paul Vodrazka
 * @see docs/SLIDE_MODE.md Section 7 for specification
 */
/* global OO */
( function () {
	'use strict';

	/**
	 * SlidesManager - Handles all interactions for Special:Slides.
	 *
	 * @class
	 */
	class SlidesManager {
		/**
		 * Create a SlidesManager instance.
		 *
		 * @param {Object} config Configuration from wgLayersSlidesConfig
		 */
		constructor( config ) {
			this.config = config || {};
			this.api = new mw.Api();
			this.currentOffset = 0;
			this.limit = 20;
			this.searchPrefix = '';
			this.sortBy = 'name';
			this.totalSlides = 0;
			this.slides = [];

			// DOM references
			this.$container = $( '.layers-slides-container' );
			this.$list = $( '.layers-slides-list' );
			this.$pagination = $( '.layers-slides-pagination' );
			this.$searchInput = $( '.layers-slides-search-input' );
			this.$sortSelect = $( '.layers-slides-sort-select' );
			this.$createBtn = $( '.layers-slides-create-btn' );

			this.init();
		}

		/**
		 * Initialize the manager.
		 */
		init() {
			this.bindEvents();
			this.loadSlides();
		}

		/**
		 * Bind event handlers.
		 */
		bindEvents() {
			// Search input with debounce
			let searchTimeout;
			this.$searchInput.on( 'input', () => {
				clearTimeout( searchTimeout );
				searchTimeout = setTimeout( () => {
					this.searchPrefix = this.$searchInput.val().trim();
					this.currentOffset = 0;
					this.loadSlides();
				}, 300 );
			} );

			// Sort select
			this.$sortSelect.on( 'change', () => {
				this.sortBy = this.$sortSelect.val();
				this.currentOffset = 0;
				this.loadSlides();
			} );

			// Create button
			this.$createBtn.on( 'click', () => {
				this.showCreateDialog();
			} );

			// Delegate click events for slide items
			this.$list.on( 'click', '.layers-slide-edit-btn', ( e ) => {
				const name = $( e.currentTarget ).closest( '.layers-slide-item' ).data( 'name' );
				this.editSlide( name );
			} );

			this.$list.on( 'click', '.layers-slide-delete-btn', ( e ) => {
				const name = $( e.currentTarget ).closest( '.layers-slide-item' ).data( 'name' );
				this.confirmDeleteSlide( name );
			} );

			// Pagination
			this.$pagination.on( 'click', '.layers-pagination-prev', () => {
				if ( this.currentOffset >= this.limit ) {
					this.currentOffset -= this.limit;
					this.loadSlides();
				}
			} );

			this.$pagination.on( 'click', '.layers-pagination-next', () => {
				if ( this.currentOffset + this.limit < this.totalSlides ) {
					this.currentOffset += this.limit;
					this.loadSlides();
				}
			} );
		}

		/**
		 * Load slides from the API.
		 */
		loadSlides() {
			this.$list.html( '<div class="layers-slides-loading">' +
				mw.message( 'special-slides-loading' ).escaped() + '</div>' );

			this.api.get( {
				action: 'layerslist',
				prefix: this.searchPrefix,
				limit: this.limit,
				offset: this.currentOffset,
				sort: this.sortBy
			} ).then( ( response ) => {
				const data = response.layerslist || {};
				this.slides = data.slides || [];
				this.totalSlides = data.total || 0;
				this.renderSlides();
				this.renderPagination();
			} ).catch( ( error ) => {
				this.$list.html( '<div class="layers-slides-error">' +
					mw.message( 'special-slides-error' ).escaped() + '</div>' );
				mw.log.error( 'Failed to load slides:', error );
			} );
		}

		/**
		 * Render the slides list.
		 */
		renderSlides() {
			if ( this.slides.length === 0 ) {
				this.$list.html( '<div class="layers-slides-empty">' +
					mw.message( 'special-slides-empty' ).escaped() + '</div>' );
				return;
			}

			let html = '';
			for ( const slide of this.slides ) {
				html += this.renderSlideItem( slide );
			}
			this.$list.html( html );
		}

		/**
		 * Render a single slide item.
		 *
		 * @param {Object} slide Slide data
		 * @return {string} HTML for the slide item
		 */
		renderSlideItem( slide ) {
			const name = mw.html.escape( slide.name );
			const dimensions = `${ slide.canvasWidth }×${ slide.canvasHeight }`;
			const layerCount = slide.layerCount || 0;
			const modifiedBy = slide.modifiedBy ? mw.html.escape( slide.modifiedBy ) : '?';
			const modifiedDate = this.formatRelativeTime( slide.modified );

			let html = `<div class="layers-slide-item" data-name="${ name }" role="listitem">`;
			// Layers-style stacked diamond icon (matches Layers branding)
			html += '<div class="layers-slide-icon" aria-hidden="true">' +
				'<svg viewBox="0 0 32 32" width="32" height="32">' +
				'<path d="M4 16 L16 12 L28 16 L16 20 Z" fill="#3366cc"/>' +
				'<path d="M4 12 L16 8 L28 12 L16 16 Z" fill="#dd3333"/>' +
				'<path d="M4 8 L16 4 L28 8 L16 12 Z" fill="#00af89"/>' +
				'</svg></div>';
			html += '<div class="layers-slide-info">';
			html += `<div class="layers-slide-name">${ name }</div>`;
			html += '<div class="layers-slide-meta">';
			html += `${ dimensions } • `;
			html += mw.message( 'special-slides-layers', layerCount ).escaped() + ' • ';
			html += mw.message( 'special-slides-modified-by', modifiedDate, modifiedBy ).escaped();
			html += '</div>';
			html += '</div>';
			html += '<div class="layers-slide-actions">';
			html += '<button class="layers-slide-edit-btn cdx-button">' +
				mw.message( 'special-slides-edit' ).escaped() + '</button>';

			if ( this.config.canDelete ) {
				html += '<button class="layers-slide-delete-btn cdx-button cdx-button--action-destructive">' +
					mw.message( 'special-slides-delete' ).escaped() + '</button>';
			}

			html += '</div>';
			html += '</div>';

			return html;
		}

		/**
		 * Render pagination controls.
		 */
		renderPagination() {
			if ( this.totalSlides <= this.limit ) {
				this.$pagination.empty();
				return;
			}

			const start = this.currentOffset + 1;
			const end = Math.min( this.currentOffset + this.limit, this.totalSlides );
			const countMsg = mw.message( 'special-slides-count', start, end, this.totalSlides ).escaped();

			let html = `<span class="layers-pagination-count">${ countMsg }</span>`;
			html += '<div class="layers-pagination-buttons">';

			const prevDisabled = this.currentOffset === 0 ? 'disabled' : '';
			html += `<button class="layers-pagination-prev cdx-button" ${ prevDisabled }>` +
				mw.message( 'special-slides-prev' ).escaped() + '</button>';

			const nextDisabled = this.currentOffset + this.limit >= this.totalSlides ? 'disabled' : '';
			html += `<button class="layers-pagination-next cdx-button" ${ nextDisabled }>` +
				mw.message( 'special-slides-next' ).escaped() + '</button>';

			html += '</div>';

			this.$pagination.html( html );
		}

		/**
		 * Format a timestamp as relative time.
		 *
		 * @param {string} timestamp ISO 8601 timestamp
		 * @return {string} Relative time string
		 */
		formatRelativeTime( timestamp ) {
			if ( !timestamp ) {
				return '?';
			}

			const date = new Date( timestamp );
			const now = new Date();
			const diffMs = now - date;
			const diffMins = Math.floor( diffMs / 60000 );
			const diffHours = Math.floor( diffMs / 3600000 );
			const diffDays = Math.floor( diffMs / 86400000 );

			if ( diffMins < 1 ) {
				return mw.message( 'special-slides-just-now' ).text();
			} else if ( diffMins < 60 ) {
				return mw.message( 'special-slides-minutes-ago', diffMins ).text();
			} else if ( diffHours < 24 ) {
				return mw.message( 'special-slides-hours-ago', diffHours ).text();
			} else if ( diffDays < 30 ) {
				return mw.message( 'special-slides-days-ago', diffDays ).text();
			} else {
				return date.toLocaleDateString();
			}
		}

		/**
		 * Edit a slide.
		 *
		 * @param {string} name Slide name
		 */
		editSlide( name ) {
			const url = mw.util.getUrl( 'Special:EditSlide/' + name );
			window.location.href = url;
		}

		/**
		 * Show delete confirmation dialog.
		 *
		 * @param {string} name Slide name
		 */
		confirmDeleteSlide( name ) {
			OO.ui.confirm(
				mw.message( 'special-slides-delete-confirm', name ).text()
			).then( ( confirmed ) => {
				if ( confirmed ) {
					this.deleteSlide( name );
				}
			} );
		}

		/**
		 * Delete a slide.
		 *
		 * @param {string} name Slide name
		 */
		deleteSlide( name ) {
			this.api.postWithToken( 'csrf', {
				action: 'layersdelete',
				slidename: name,
				setname: 'default'
			} ).then( () => {
				mw.notify( mw.message( 'special-slides-deleted', name ).text(), { type: 'success' } );
				this.loadSlides();
			} ).catch( ( error ) => {
				mw.notify( mw.message( 'special-slides-delete-failed' ).text(), { type: 'error' } );
				mw.log.error( 'Failed to delete slide:', error );
			} );
		}

		/**
		 * Show the create slide dialog.
		 */
		showCreateDialog() {
			const dialog = new CreateSlideDialog( this.config );
			const windowManager = new OO.ui.WindowManager();
			$( document.body ).append( windowManager.$element );
			windowManager.addWindows( [ dialog ] );
			windowManager.openWindow( dialog ).closed.then( ( data ) => {
				if ( data && data.action === 'create' && data.slideName ) {
					this.editSlide( data.slideName );
				}
			} );
		}

		/**
		 * Clean up all event handlers and references.
		 * Call this when navigating away or when the component is no longer needed.
		 */
		destroy() {
			// Remove all jQuery event handlers
			this.$searchInput.off();
			this.$sortSelect.off();
			this.$createBtn.off();
			this.$list.off();
			this.$pagination.off();

			// Clear DOM references
			this.$container = null;
			this.$list = null;
			this.$pagination = null;
			this.$searchInput = null;
			this.$sortSelect = null;
			this.$createBtn = null;

			// Clear data
			this.slides = [];
			this.api = null;
			this.config = null;
		}
	}

	/**
	 * CreateSlideDialog - OOUI dialog for creating new slides.
	 *
	 * @class
	 * @extends OO.ui.ProcessDialog
	 */
	class CreateSlideDialog extends OO.ui.ProcessDialog {
		/**
		 * @param {Object} config Configuration
		 */
		constructor( config ) {
			super( {
				size: 'medium'
			} );
			this.slidesConfig = config || {};
		}

		/**
		 * @inheritDoc
		 */
		static get static() {
			return {
				name: 'createSlideDialog',
				title: mw.message( 'special-slides-create' ).text(),
				actions: [
					{
						action: 'create',
						label: mw.message( 'special-slides-create-and-edit' ).text(),
						flags: [ 'primary', 'progressive' ]
					},
					{
						label: mw.message( 'cancel' ).text(),
						flags: 'safe'
					}
				]
			};
		}

		/**
		 * @inheritDoc
		 */
		initialize() {
			super.initialize();

			this.content = new OO.ui.PanelLayout( {
				padded: true,
				expanded: false
			} );

			// Slide name input
			this.nameInput = new OO.ui.TextInputWidget( {
				placeholder: mw.message( 'layers-slide-name' ).text(),
				validate: /^[a-zA-Z0-9_-]+$/
			} );

			// Canvas size dropdown
			this.sizeSelect = new OO.ui.DropdownWidget( {
				menu: {
					items: [
						new OO.ui.MenuOptionWidget( { data: '800x600', label: '800×600 (Standard)' } ),
						new OO.ui.MenuOptionWidget( { data: '1024x768', label: '1024×768 (4:3)' } ),
						new OO.ui.MenuOptionWidget( { data: '1280x720', label: '1280×720 (16:9 HD)' } ),
						new OO.ui.MenuOptionWidget( { data: '1920x1080', label: '1920×1080 (16:9 Full HD)' } ),
						new OO.ui.MenuOptionWidget( { data: 'custom', label: mw.message( 'layers-slide-size-custom' ).text() } )
					]
				}
			} );
			this.sizeSelect.getMenu().selectItemByData( '800x600' );

			// Custom size inputs
			this.customWidthInput = new OO.ui.NumberInputWidget( {
				min: 100,
				max: this.slidesConfig.maxWidth || 4096,
				value: 800
			} );
			this.customHeightInput = new OO.ui.NumberInputWidget( {
				min: 100,
				max: this.slidesConfig.maxHeight || 4096,
				value: 600
			} );

			this.customSizeLayout = new OO.ui.HorizontalLayout( {
				items: [
					this.customWidthInput,
					new OO.ui.LabelWidget( { label: '×' } ),
					this.customHeightInput
				]
			} );
			this.customSizeLayout.$element.hide();

			// Background color
			this.backgroundInput = new OO.ui.TextInputWidget( {
				value: this.slidesConfig.defaultBackground || '#ffffff'
			} );

			// Build form
			this.content.$element.append(
				new OO.ui.FieldLayout( this.nameInput, {
					label: mw.message( 'layers-slide-name' ).text(),
					align: 'top'
				} ).$element,
				new OO.ui.FieldLayout( this.sizeSelect, {
					label: mw.message( 'layers-slide-canvas-size' ).text(),
					align: 'top'
				} ).$element,
				this.customSizeLayout.$element,
				new OO.ui.FieldLayout( this.backgroundInput, {
					label: mw.message( 'layers-slide-background' ).text(),
					align: 'top'
				} ).$element
			);

			this.$body.append( this.content.$element );

			// Show/hide custom size
			this.sizeSelect.getMenu().on( 'select', ( item ) => {
				if ( item.getData() === 'custom' ) {
					this.customSizeLayout.$element.show();
				} else {
					this.customSizeLayout.$element.hide();
				}
			} );
		}

		/**
		 * @inheritDoc
		 */
		getActionProcess( action ) {
			if ( action === 'create' ) {
				return new OO.ui.Process( () => {
					const name = this.nameInput.getValue().trim();

					// Validate name
					if ( !name || !/^[a-zA-Z0-9_-]+$/.test( name ) ) {
						return $.Deferred().reject(
							new OO.ui.Error( mw.message( 'layers-slide-invalid-name' ).text() )
						).promise();
					}

					// Get dimensions
					let width, height;
					const sizeValue = this.sizeSelect.getMenu().findSelectedItem().getData();
					if ( sizeValue === 'custom' ) {
						width = parseInt( this.customWidthInput.getValue(), 10 );
						height = parseInt( this.customHeightInput.getValue(), 10 );
					} else {
						const parts = sizeValue.split( 'x' );
						width = parseInt( parts[ 0 ], 10 );
						height = parseInt( parts[ 1 ], 10 );
					}

					const background = this.backgroundInput.getValue() || '#ffffff';

					// Create the slide by saving an empty layer set
					const api = new mw.Api();
					return api.postWithToken( 'csrf', {
						action: 'layerssave',
						slidename: name,
						data: JSON.stringify( {
							schema: 2,
							isSlide: true,
							canvasWidth: width,
							canvasHeight: height,
							backgroundColor: background,
							layers: []
						} )
					} ).then( () => {
						this.close( { action: 'create', slideName: name } );
					} ).catch( ( error, response ) => {
						const errorMsg = response?.error?.info || mw.message( 'special-slides-create-failed' ).text();
						return $.Deferred().reject( new OO.ui.Error( errorMsg ) ).promise();
					} );
				} );
			}
			return super.getActionProcess( action );
		}

		/**
		 * @inheritDoc
		 */
		getBodyHeight() {
			return 300;
		}
	}

	// Initialize on DOM ready
	$( () => {
		if ( $( '.layers-slides-container' ).length ) {
			const config = mw.config.get( 'wgLayersSlidesConfig' ) || {};
			window.layersSlidesManager = new SlidesManager( config );
		}
	} );

}() );
