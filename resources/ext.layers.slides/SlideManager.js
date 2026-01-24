/**
 * Slide Mode Integration Module
 *
 * Handles the integration between the Layers editor and Slide Mode,
 * providing canvas-based graphics editing without a parent image.
 *
 * @module ext.layers.slides
 */

( function () {
	'use strict';

	/**
	 * SlideManager handles slide-specific editor functionality
	 *
	 * @class
	 */
	class SlideManager {
		/**
		 * Create a SlideManager instance
		 *
		 * @param {Object} config Slide configuration from server
		 */
		constructor( config ) {
			this.config = config;
			this.slideName = config.slideName;
			this.isNew = config.isNew;
			this.canvasWidth = config.canvasWidth || 800;
			this.canvasHeight = config.canvasHeight || 600;
			this.backgroundColor = config.backgroundColor || '#ffffff';
			this.backgroundVisible = config.backgroundVisible !== false;
			this.backgroundOpacity = config.backgroundOpacity ?? 1.0;
			this.layers = config.layers || [];
			this.revision = config.revision || 0;
			this.editor = null;
			this.isDirty = false;
		}

		/**
		 * Initialize the slide editor
		 *
		 * @return {Promise<void>}
		 */
		async init() {
			const container = document.getElementById( 'layers-slide-editor-container' );
			if ( !container ) {
				mw.log.error( '[SlideManager] Editor container not found' );
				return;
			}

			// Clear loading state
			container.innerHTML = '';

			// Create editor canvas structure
			this.createEditorStructure( container );

			// Wait for the editor module to be available
			await this.loadEditor();

			// Configure the editor for slide mode
			this.configureEditor();
		}

		/**
		 * Create the editor DOM structure
		 *
		 * @param {HTMLElement} container The container element
		 */
		createEditorStructure( container ) {
			// Main editor wrapper
			const wrapper = document.createElement( 'div' );
			wrapper.className = 'layers-slide-editor-wrapper';

			// Canvas container
			const canvasContainer = document.createElement( 'div' );
			canvasContainer.id = 'layers-canvas-container';
			canvasContainer.className = 'layers-canvas-container layers-slide-canvas-container';
			canvasContainer.style.width = this.canvasWidth + 'px';
			canvasContainer.style.height = this.canvasHeight + 'px';

			// Main canvas
			const canvas = document.createElement( 'canvas' );
			canvas.id = 'layers-canvas';
			canvas.className = 'layers-canvas';
			canvas.width = this.canvasWidth;
			canvas.height = this.canvasHeight;
			canvasContainer.appendChild( canvas );

			wrapper.appendChild( canvasContainer );
			container.appendChild( wrapper );

			// Store references
			this.container = container;
			this.canvasContainer = canvasContainer;
			this.canvas = canvas;
		}

		/**
		 * Load the layers editor module
		 *
		 * @return {Promise<void>}
		 */
		async loadEditor() {
			return new Promise( ( resolve, reject ) => {
				mw.loader.using( 'ext.layers.editor' ).then( () => {
					resolve();
				} ).catch( ( err ) => {
					mw.log.error( '[SlideManager] Failed to load editor module:', err );
					reject( err );
				} );
			} );
		}

		/**
		 * Configure the editor for slide mode
		 */
		configureEditor() {
			// Get the editor class from the new namespace
			// LayersEditor is exported to window.Layers.Core.Editor
			const EditorClass = ( window.Layers && window.Layers.Core && window.Layers.Core.Editor ) ||
				( window.Layers && window.Layers.Editor ) ||
				window.LayersEditor;

			if ( !EditorClass ) {
				mw.log.error( '[SlideManager] LayersEditor class not available' );
				return;
			}

			// Create slide-specific configuration
			const editorConfig = {
				mode: 'slide',
				slideName: this.slideName,
				canvasWidth: this.canvasWidth,
				canvasHeight: this.canvasHeight,
				backgroundColor: this.backgroundColor,
				backgroundVisible: this.backgroundVisible,
				backgroundOpacity: this.backgroundOpacity,
				layers: this.layers,
				showBackgroundImage: false, // No background image in slide mode
				allowCanvasResize: true, // Allow resizing the canvas
				onSave: this.handleSave.bind( this ),
				onDirty: this.handleDirty.bind( this ),
			};

			// Initialize the editor
			try {
				this.editor = new EditorClass( this.container, editorConfig );
				this.editor.init();
			} catch ( err ) {
				mw.log.error( '[SlideManager] Failed to initialize editor:', err );
			}
		}

		/**
		 * Handle save request from editor
		 *
		 * @param {Object} data Layer data to save
		 * @return {Promise<Object>} Save result
		 */
		async handleSave( data ) {
			const api = new mw.Api();

			try {
				const result = await api.postWithToken( 'csrf', {
					action: 'slidessave',
					slidename: this.slideName,
					data: JSON.stringify( data.layers || [] ),
					canvaswidth: data.canvasWidth || this.canvasWidth,
					canvasheight: data.canvasHeight || this.canvasHeight,
					backgroundcolor: data.backgroundColor || this.backgroundColor,
					backgroundvisible: data.backgroundVisible !== false,
					backgroundopacity: data.backgroundOpacity ?? 1.0,
				} );

				if ( result.slidessave && result.slidessave.success ) {
					this.isDirty = false;
					this.revision++;
					this.updateRevisionDisplay();
					mw.notify( mw.message( 'layers-slide-save-success' ).text(), { type: 'success' } );
					return { success: true, slideId: result.slidessave.slideid };
				} else {
					throw new Error( 'Save failed' );
				}
			} catch ( err ) {
				mw.log.error( '[SlideManager] Save error:', err );
				mw.notify( mw.message( 'layers-slide-save-error' ).text(), { type: 'error' } );
				return { success: false, error: err.message };
			}
		}

		/**
		 * Handle dirty state change from editor
		 *
		 * @param {boolean} dirty Whether the editor has unsaved changes
		 */
		handleDirty( dirty ) {
			this.isDirty = dirty;

			// Update browser beforeunload warning
			if ( dirty ) {
				window.onbeforeunload = () => mw.message( 'layers-cancel-confirm' ).text();
			} else {
				window.onbeforeunload = null;
			}
		}

		/**
		 * Update the revision display in the UI
		 */
		updateRevisionDisplay() {
			const revisionEl = document.querySelector( '.layers-editslide-revision' );
			if ( revisionEl ) {
				revisionEl.textContent = mw.message( 'layers-editslide-revision', this.revision ).text();
			}
		}

		/**
		 * Get the current canvas dimensions
		 *
		 * @return {Object} Object with width and height
		 */
		getCanvasDimensions() {
			return {
				width: this.canvasWidth,
				height: this.canvasHeight,
			};
		}

		/**
		 * Update the canvas dimensions
		 *
		 * @param {number} width New canvas width
		 * @param {number} height New canvas height
		 */
		setCanvasDimensions( width, height ) {
			this.canvasWidth = width;
			this.canvasHeight = height;

			if ( this.canvas ) {
				this.canvas.width = width;
				this.canvas.height = height;
			}

			if ( this.canvasContainer ) {
				this.canvasContainer.style.width = width + 'px';
				this.canvasContainer.style.height = height + 'px';
			}

			if ( this.editor && typeof this.editor.setCanvasSize === 'function' ) {
				this.editor.setCanvasSize( width, height );
			}

			this.isDirty = true;
		}
	}

	/**
	 * SlideViewer handles rendering slides in wiki pages
	 *
	 * @class
	 */
	class SlideViewer {
		/**
		 * Create a SlideViewer instance
		 *
		 * @param {HTMLElement} container The slide container element
		 */
		constructor( container ) {
			this.container = container;
			this.slideName = container.dataset.slideName;
			this.canvasWidth = parseInt( container.dataset.canvasWidth, 10 ) || 800;
			this.canvasHeight = parseInt( container.dataset.canvasHeight, 10 ) || 600;
			this.displayWidth = parseInt( container.dataset.displayWidth, 10 ) || this.canvasWidth;
			this.displayHeight = parseInt( container.dataset.displayHeight, 10 ) || this.canvasHeight;
			this.displayScale = parseFloat( container.dataset.displayScale ) || 1.0;
			this.backgroundColor = container.dataset.backgroundColor || '';
			this.layerData = null;

			// Parse layer data from data attribute
			const layersJson = container.dataset.layers;
			if ( layersJson ) {
				try {
					this.layerData = JSON.parse( layersJson );
				} catch ( e ) {
					mw.log.error( '[SlideViewer] Failed to parse layer data:', e );
				}
			}
		}

		/**
		 * Initialize the viewer and render the slide
		 */
		init() {
			const canvas = this.container.querySelector( '.layers-slide-canvas' );
			if ( !canvas ) {
				mw.log.error( '[SlideViewer] Canvas not found in container' );
				return;
			}

			this.canvas = canvas;
			this.ctx = canvas.getContext( '2d' );

			// Hide empty state if we have layers
			if ( this.layerData && this.layerData.layers && this.layerData.layers.length > 0 ) {
				const emptyState = this.container.querySelector( '.layers-slide-empty-state' );
				if ( emptyState ) {
					emptyState.style.display = 'none';
				}
			}

			this.render();
		}

		/**
		 * Render the slide content
		 */
		render() {
			if ( !this.ctx ) {
				return;
			}

			// Clear canvas
			this.ctx.clearRect( 0, 0, this.canvasWidth, this.canvasHeight );

			// Draw background
			// Note: For 'transparent', we don't draw anything on canvas.
			// The container element already has CSS background (checkerboard pattern)
			// applied by SlideHooks.php, so transparent slides show the pattern correctly.
			if ( this.backgroundColor && this.backgroundColor !== 'transparent' ) {
				this.ctx.fillStyle = this.backgroundColor;
				this.ctx.fillRect( 0, 0, this.canvasWidth, this.canvasHeight );
			}

			// Render layers if we have them and the LayerRenderer is available
			if ( this.layerData && this.layerData.layers && this.layerData.layers.length > 0 ) {
				this.renderLayers( this.layerData.layers );
			}
		}

		/**
		 * Render layer content
		 *
		 * @param {Array} layers Array of layer objects
		 */
		renderLayers( layers ) {
			// Use the shared LayerRenderer if available
			if ( typeof window.LayerRenderer !== 'undefined' ) {
				// Create renderer with onImageLoad callback to handle async SVG loading
				// This ensures placeholder boxes are replaced when SVGs finish loading
				if ( !this.renderer ) {
					this.renderer = new window.LayerRenderer( this.ctx, {
						onImageLoad: () => {
							this.render();
						}
					} );
				}
				for ( const layer of layers ) {
					if ( layer.visible !== false ) {
						this.renderer.renderLayer( layer );
					}
				}
			} else {
				// Fallback: load the renderer module
				mw.loader.using( 'ext.layers.shared' ).then( () => {
					if ( typeof window.LayerRenderer !== 'undefined' ) {
						// Create renderer with onImageLoad callback
						if ( !this.renderer ) {
							this.renderer = new window.LayerRenderer( this.ctx, {
								onImageLoad: () => {
									this.render();
								}
							} );
						}
						for ( const layer of layers ) {
							if ( layer.visible !== false ) {
								this.renderer.renderLayer( layer );
							}
						}
					}
				} );
			}
		}
	}

	/**
	 * Initialize slide functionality on page load
	 */
	function init() {
		// Check if we're in slide edit mode
		const isSlideMode = mw.config.get( 'wgLayersSlideMode' );
		if ( isSlideMode ) {
			const slideConfig = mw.config.get( 'wgLayersSlideConfig' );
			if ( slideConfig ) {
				const manager = new SlideManager( slideConfig );
				manager.init();

				// Expose for debugging
				window.layersSlideManager = manager;
			}
		}

		// Initialize slide viewers for embedded slides
		const slideContainers = document.querySelectorAll( '.layers-slide-container' );
		for ( const container of slideContainers ) {
			const viewer = new SlideViewer( container );
			viewer.init();
		}
	}

	// Initialize on DOM ready
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}

	// Expose classes for external use
	window.SlideManager = SlideManager;
	window.SlideViewer = SlideViewer;

}() );
