/**
 * Main Layers Editor Controller
 * Manages the overall editing interface and coordinates between components
 */
( function () {
	'use strict';

	/**
	 * LayersEditor main class
	 *
	 * @param config
	 * @class
	 */
	function LayersEditor( config ) {
		this.config = config || {};
		this.filename = this.config.filename;
		this.canvasManager = null;
		this.layerPanel = null;
		this.toolbar = null;
		this.layers = [];
		this.currentTool = 'pointer';
		this.isDirty = false;

		this.init();
	}

	LayersEditor.prototype.init = function () {
		// Create the main editor interface
		this.createInterface();

		// Initialize undo/redo system
		this.undoStack = [];
		this.redoStack = [];
		this.maxUndoSteps = 50;

		// Wait for all dependencies to be available, then initialize components
		this.waitForDependencies();
	};

	LayersEditor.prototype.waitForDependencies = function () {
		var self = this;
		var maxAttempts = 50; // Wait up to 5 seconds
		var attempt = 0;

		function checkDependencies() {
			attempt++;

			if ( window.CanvasManager && window.LayerPanel && window.Toolbar ) {
				// Use MediaWiki logging if available
				if ( window.mw && window.mw.log ) {
					mw.log( 'Layers: All dependencies loaded, initializing components' );
				}
				self.initializeComponents();
			} else if ( attempt < maxAttempts ) {
				setTimeout( checkDependencies, 100 );
			} else {
				var missing = [];
				if ( !window.CanvasManager ) {
					missing.push( 'CanvasManager' );
				}
				if ( !window.LayerPanel ) {
					missing.push( 'LayerPanel' );
				}
				if ( !window.Toolbar ) {
					missing.push( 'Toolbar' );
				}
				if ( window.mw && window.mw.log ) {
					mw.log.error( 'Layers: Missing dependencies after 5 seconds: ' + missing.join( ', ' ) );
				}
			}
		}

		checkDependencies();
	};

	LayersEditor.prototype.initializeComponents = function () {
		// Initialize components
		try {
			// console.log( 'Layers: Initializing components...' );
			// console.log( 'Layers: Canvas container:', this.$canvasContainer.get( 0 ) );
			// console.log( 'Layers: Layer panel container:', this.$layerPanel.get( 0 ) );
			// console.log( 'Layers: Toolbar container:', this.$toolbar.get( 0 ) );

			// Get the parent image URL
			var parentImageUrl = this.getParentImageUrl();
			// console.log( 'Layers: Parent image URL:', parentImageUrl );

			this.canvasManager = new window.CanvasManager( {
				container: this.$canvasContainer.get( 0 ),
				editor: this,
				backgroundImageUrl: parentImageUrl
			} );

			this.layerPanel = new window.LayerPanel( {
				container: this.$layerPanel.get( 0 ),
				editor: this
			} );

			this.toolbar = new window.Toolbar( {
				container: this.$toolbar.get( 0 ),
				editor: this
			} );

			// console.log( 'Layers: Editor components initialized successfully' );
			// console.log( 'Layers: CanvasManager:', this.canvasManager );
			// console.log( 'Layers: LayerPanel:', this.layerPanel );
			// console.log( 'Layers: Toolbar:', this.toolbar );
		} catch ( error ) {
			// console.error( 'Layers: Error initializing editor components:', error );
			this.showError( 'Failed to initialize editor: ' + error.message );
			return;
		}

		// Load existing layers if any
		this.loadLayers();

		// Set up event handlers
		this.setupEventHandlers();

		// console.log( 'Layers: Editor fully initialized for file:', this.filename );
	};

	LayersEditor.prototype.createInterface = function () {
		// Create main editor container
		this.$container = $( '<div>' )
			.addClass( 'layers-editor' )
			.css( {
				position: 'fixed',
				top: '0',
				left: '0',
				width: '100%',
				height: '100%',
				background: '#f5f5f5',
				'z-index': '10000',
				display: 'flex',
				'flex-direction': 'column'
			} )
			.appendTo( 'body' );

		// Create toolbar
		this.$toolbar = $( '<div>' )
			.addClass( 'layers-toolbar' )
			.css( {
				background: '#ffffff',
				'border-bottom': '1px solid #ddd',
				padding: '8px 16px',
				display: 'flex',
				'align-items': 'center',
				gap: '16px',
				'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
				'flex-shrink': '0'
			} )
			.appendTo( this.$container );

		// Create main content area
		this.$content = $( '<div>' )
			.addClass( 'layers-content' )
			.css( {
				flex: '1',
				display: 'flex',
				overflow: 'hidden'
			} )
			.appendTo( this.$container );

		// Create layer panel
		this.$layerPanel = $( '<div>' )
			.addClass( 'layers-panel' )
			.css( {
				width: '280px',
				background: '#ffffff',
				'border-right': '1px solid #ddd',
				display: 'flex',
				'flex-direction': 'column',
				overflow: 'hidden'
			} )
			.appendTo( this.$content );

		// Create canvas container
		this.$canvasContainer = $( '<div>' )
			.addClass( 'layers-canvas-container' )
			.css( {
				flex: '1',
				overflow: 'hidden',
				background: '#e9ecef',
				display: 'flex',
				'align-items': 'center',
				'justify-content': 'center',
				padding: '20px',
				position: 'relative'
			} )
			.appendTo( this.$content );
	};

	LayersEditor.prototype.setupEventHandlers = function () {
		var self = this;

		// Handle window resize
		$( window ).on( 'resize.layerseditor', function () {
			self.handleResize();
		} );

		// Handle unsaved changes warning
		$( window ).on( 'beforeunload.layerseditor', function () {
			if ( self.isDirty ) {
				return 'You have unsaved changes. Are you sure you want to leave?';
			}
		} );
	};

	LayersEditor.prototype.loadLayers = function () {
		var self = this;

		// Load existing layers from API
		var api = new mw.Api();
		api.get( {
			action: 'layersinfo',
			filename: this.filename,
			format: 'json'
		} ).done( function ( data ) {
			if ( data.layersinfo && data.layersinfo.layerset ) {
				self.layers = data.layersinfo.layerset.data.layers || [];
				// console.log( 'Layers: Loaded', self.layers.length, 'existing layers' );
			} else {
				self.layers = [];
				// console.log( 'Layers: No existing layers found, starting fresh' );
			}
			self.renderLayers();
			
			// Save initial state for undo system
			self.saveState( 'initial' );
		} ).fail( function () {
			// console.error( 'Failed to load layers:', err );
			self.layers = [];
			self.renderLayers();
			
			// Save initial empty state for undo system
			self.saveState( 'initial' );
			// Don't show error to user as this is expected for new files
		} );
	};

	LayersEditor.prototype.renderLayers = function () {
		// Render layers on canvas
		if ( this.canvasManager ) {
			this.canvasManager.renderLayers( this.layers );
		}

		// Update layer panel
		if ( this.layerPanel ) {
			this.layerPanel.updateLayers( this.layers );
		}

		// Update UI state
		this.updateUIState();
	};

	LayersEditor.prototype.addLayer = function ( layerData ) {
		// Save current state for undo
		this.saveState();

		// Add new layer
		layerData.id = this.generateLayerId();
		layerData.visible = layerData.visible !== false; // Default to visible

		this.layers.push( layerData );
		this.renderLayers();
		this.markDirty();

		// Select the newly created layer
		this.selectLayer( layerData.id );

		// console.log( 'Added layer:', layerData );
	};

	LayersEditor.prototype.updateLayer = function ( layerId, changes ) {
		// Save current state for undo
		this.saveState();

		// Update existing layer
		var layer = this.getLayerById( layerId );
		if ( layer ) {
			$.extend( layer, changes );
			this.renderLayers();
			this.markDirty();
		}
	};

	LayersEditor.prototype.removeLayer = function ( layerId ) {
		// Save current state for undo
		this.saveState();

		// Remove layer
		this.layers = this.layers.filter( function ( layer ) {
			return layer.id !== layerId;
		} );
		this.renderLayers();
		this.markDirty();

		// Update UI state
		this.updateUIState();
	};

	LayersEditor.prototype.getLayerById = function ( layerId ) {
		return this.layers.find( function ( layer ) {
			return layer.id === layerId;
		} );
	};

	LayersEditor.prototype.generateLayerId = function () {
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	};

	LayersEditor.prototype.setCurrentTool = function ( tool ) {
		this.currentTool = tool;
		if ( this.canvasManager ) {
			this.canvasManager.setTool( tool );
		}
	};

	// Undo/Redo System
	LayersEditor.prototype.saveState = function ( action ) {
		// Delegate to canvas manager's history system
		if ( this.canvasManager ) {
			this.canvasManager.saveState( action );
		}
	};

	LayersEditor.prototype.undo = function () {
		// Delegate to canvas manager's undo system
		if ( this.canvasManager ) {
			return this.canvasManager.undo();
		}
		return false;
	};

	LayersEditor.prototype.redo = function () {
		// Delegate to canvas manager's redo system
		if ( this.canvasManager ) {
			return this.canvasManager.redo();
		}
		return false;
	};

	// Selection Management
	LayersEditor.prototype.selectLayer = function ( layerId ) {
		this.selectedLayerId = layerId;

		// Update canvas selection
		if ( this.canvasManager ) {
			this.canvasManager.selectLayer( layerId );
		}

		// Update layer panel selection
		if ( this.layerPanel ) {
			this.layerPanel.selectLayer( layerId );
		}

		this.updateUIState();

		// console.log( 'Selected layer:', layerId );
	};

	LayersEditor.prototype.deleteSelected = function () {
		if ( this.selectedLayerId ) {
			this.removeLayer( this.selectedLayerId );
			this.selectedLayerId = null;
		}
	};

	LayersEditor.prototype.duplicateSelected = function () {
		if ( this.selectedLayerId ) {
			var layer = this.getLayerById( this.selectedLayerId );
			if ( layer ) {
				var duplicate = JSON.parse( JSON.stringify( layer ) );
				duplicate.x = ( duplicate.x || 0 ) + 10;
				duplicate.y = ( duplicate.y || 0 ) + 10;
				delete duplicate.id; // Will be regenerated
				this.addLayer( duplicate );
			}
		}
	};

	LayersEditor.prototype.updateUIState = function () {
		// Update toolbar state
		if ( this.toolbar ) {
			this.toolbar.updateUndoRedoState(
				this.undoStack.length > 0,
				this.redoStack.length > 0
			);
			this.toolbar.updateDeleteState( !!this.selectedLayerId );
		}
	};

	LayersEditor.prototype.cancel = function () {
		if ( this.isDirty ) {
			if ( confirm( 'You have unsaved changes. Are you sure you want to cancel?' ) ) {
				this.destroy();
			}
		} else {
			this.destroy();
		}
	};

	LayersEditor.prototype.save = function () {
		var self = this;

		// Save layers to API
		var api = new mw.Api();
		api.postWithToken( 'csrf', {
			action: 'layerssave',
			filename: this.filename,
			data: JSON.stringify( this.layers ),
			format: 'json'
		} ).done( function ( data ) {
			if ( data.layerssave && data.layerssave.success ) {
				self.markClean();
				mw.notify( mw.msg( 'layers-save-success' ), { type: 'success' } );
			} else {
				mw.notify( mw.msg( 'layers-save-error' ), { type: 'error' } );
			}
		} ).fail( function () {
			// console.error( 'Failed to save layers:', err );
			mw.notify( mw.msg( 'layers-save-error' ), { type: 'error' } );
		} );
	};

	LayersEditor.prototype.markDirty = function () {
		this.isDirty = true;
		// Update UI to show unsaved changes
	};

	LayersEditor.prototype.markClean = function () {
		this.isDirty = false;
		// Update UI to show saved state
	};

	LayersEditor.prototype.getParentImageUrl = function () {
		// Priority 1: Use imageUrl from config (passed by MediaWiki)
		if ( this.config.imageUrl ) {
			// console.log('Layers: Using imageUrl from config:', this.config.imageUrl);
			return this.config.imageUrl;
		}

		// Priority 2: Try to construct URL using MediaWiki file path
		if ( this.filename ) {
			// Method 1: Construct URL using MediaWiki file path
			var imageUrl = mw.config.get( 'wgServer' ) + mw.config.get( 'wgScriptPath' ) +
                          '/index.php?title=Special:Redirect/file/' + encodeURIComponent( this.filename );
			// console.log('Layers: Using MediaWiki file URL:', imageUrl);
			return imageUrl;
		}

		// Priority 3: Look for current page image
		var $pageImage = $( '.mw-file-element img, .fullImageLink img, .filehistory img' ).first();
		if ( $pageImage.length ) {
			var pageImageUrl = $pageImage.attr( 'src' );
			// console.log('Layers: Using page image URL:', pageImageUrl);
			return pageImageUrl;
		}

		// Priority 4: Use a default fallback
		// console.log('Layers: No parent image found, using fallback');
		return null;
	};

	LayersEditor.prototype.showError = function ( message ) {
		// Create error display in the editor
		var $error = $( '<div>' )
			.addClass( 'layers-error' )
			.text( message )
			.appendTo( this.$container );

		// Auto-hide after 5 seconds
		setTimeout( function () {
			$error.fadeOut();
		}, 5000 );

		// console.error( 'Layers Editor Error:', message );
	};

	LayersEditor.prototype.handleResize = function () {
		// console.log( 'Layers: Handling window resize...' );
		if ( this.canvasManager ) {
			this.canvasManager.handleResize();
		}

		// Also trigger a canvas resize to ensure proper sizing
		if ( this.canvasManager && this.canvasManager.resizeCanvas ) {
			var self = this;
			setTimeout( function () {
				self.canvasManager.resizeCanvas();
			}, 100 ); // Small delay to let CSS settle
		}
	};

	LayersEditor.prototype.destroy = function () {
		// Cleanup
		$( window ).off( '.layerseditor' );
		if ( this.$container ) {
			this.$container.remove();
		}
	};

	// Export LayersEditor to global scope
	window.LayersEditor = LayersEditor;

	// Initialize editor when appropriate
	mw.hook( 'layers.editor.init' ).add( function ( config ) {
		new LayersEditor( config );
	} );

}() );
