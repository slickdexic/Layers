/**
 * Main Layers Editor Controller
 * Manages the overall editing interface and coordinates between components
 */
( function () {
	'use strict';

	/**
	 * LayersEditor main class
	 *
	 * @class
	 * @param {Object} config Configuration object
	 * @param {string} config.filename The name of the file being edited.
	 * @param {string} config.imageUrl The direct URL to the image being edited.
	 */
	function LayersEditor( config ) {
		this.config = config || {};
		this.filename = this.config.filename;
		this.containerElement = this.config.container; // Optional legacy container
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
				// Do not initialize if core dependencies failed to load
				self.showError( ( mw.message ? mw.message( 'layers-error-init' ).text() : 'Failed to initialize Layers editor' ) + ' (' + missing.join( ', ' ) + ')' );
			}
		}

		checkDependencies();
	};

	LayersEditor.prototype.initializeComponents = function () {
		// Initialize components
		try {
			if ( window.mw && window.mw.log ) {
				mw.log( 'Layers: Initializing components...' );
				mw.log( 'Layers: Canvas container:', this.$canvasContainer.get( 0 ) );
				mw.log( 'Layers: Layer panel container:', this.$layerPanel.get( 0 ) );
				mw.log( 'Layers: Toolbar container:', this.$toolbar.get( 0 ) );
			}

			// Check for required dependencies
			if ( !window.CanvasManager ) {
				throw new Error( 'CanvasManager not available' );
			}
			if ( !window.LayerPanel ) {
				throw new Error( 'LayerPanel not available' );
			}
			if ( !window.Toolbar ) {
				throw new Error( 'Toolbar not available' );
			}

			// Get the parent image URL
			var parentImageUrl = this.getParentImageUrl();
			if ( window.mw && window.mw.log ) {
				mw.log( 'Layers: Parent image URL:', parentImageUrl );
			}

			this.canvasManager = new window.CanvasManager( {
				container: this.$canvasContainer.get( 0 ),
				editor: this,
				backgroundImageUrl: parentImageUrl
			} );

			this.layerPanel = new window.LayerPanel( {
				container: this.$layerPanel.get( 0 ),
				editor: this,
				inspectorContainer: this.inspectorContainer
			} );

			this.toolbar = new window.Toolbar( {
				container: this.$toolbar.get( 0 ),
				editor: this
			} );

			if ( window.mw && window.mw.log ) {
				mw.log( 'Layers: Editor components initialized successfully' );
				mw.log( 'Layers: CanvasManager:', this.canvasManager );
				mw.log( 'Layers: LayerPanel:', this.layerPanel );
				mw.log( 'Layers: Toolbar:', this.toolbar );
			}
		} catch ( error ) {
			if ( window.mw && window.mw.log ) {
				mw.log.error( 'Layers: Error initializing editor components:', error );
			}
			this.showError( 'Failed to initialize editor: ' + error.message );
			return;
		}

		// Load existing layers if any
		this.loadLayers();

		// Set up event handlers
		this.setupEventHandlers();

		// Seed status bar with initial values
		if ( typeof this.updateStatus === 'function' ) {
			this.updateStatus( {
				tool: this.currentTool || 'pointer',
				zoomPercent: 100,
				pos: { x: 0, y: 0 },
				selectionCount: 0
			} );
		}

		if ( window.mw && window.mw.log ) {
			mw.log( 'Layers: Editor fully initialized for file:', this.filename );
		}
	};

	LayersEditor.prototype.createInterface = function () {
		// Always create a full-screen overlay container at body level
		this.container = document.createElement( 'div' );
		this.container.className = 'layers-editor';
		document.body.appendChild( this.container );

		// Add body class to hide skin chrome while editor is open
		document.body.classList.add( 'layers-editor-open' );

		// Header
		var header = document.createElement( 'div' );
		header.className = 'layers-header';
		var title = document.createElement( 'div' );
		title.className = 'layers-header-title';
		title.textContent = ( mw.message ? mw.message( 'layers-editor-title' ).text() : ( mw.msg ? mw.msg( 'layers-editor-title' ) : 'Layers Editor' ) ) +
			( this.filename ? ' — ' + this.filename : '' );
		header.appendChild( title );
		var headerRight = document.createElement( 'div' );
		headerRight.className = 'layers-header-right';
		// Zoom readout mirrors toolbar
		var zoomReadout = document.createElement( 'span' );
		zoomReadout.className = 'layers-zoom-readout';
		zoomReadout.textContent = '100%';
		headerRight.appendChild( zoomReadout );

		// Close button (returns to File: page)
		var closeBtn = document.createElement( 'button' );
		closeBtn.className = 'layers-header-close';
		closeBtn.type = 'button';
		closeBtn.setAttribute( 'aria-label', ( mw.message ? mw.message( 'layers-editor-close' ).text() : 'Close' ) );
		closeBtn.title = ( mw.message ? mw.message( 'layers-editor-close' ).text() : 'Close' );
		closeBtn.innerHTML = '&times;';
		headerRight.appendChild( closeBtn );
		header.appendChild( headerRight );
		this.container.appendChild( header );

		// Create toolbar
		this.toolbarContainer = document.createElement( 'div' );
		this.toolbarContainer.className = 'layers-toolbar';
		this.container.appendChild( this.toolbarContainer );

		// Create main content area (column layout: main row + bottom inspector)
		this.content = document.createElement( 'div' );
		this.content.className = 'layers-content';
		this.container.appendChild( this.content );

		// Main row holds sidebar and canvas
		var mainRow = document.createElement( 'div' );
		mainRow.className = 'layers-main';
		this.content.appendChild( mainRow );

		// Create layer panel (sidebar)
		this.layerPanelContainer = document.createElement( 'div' );
		this.layerPanelContainer.className = 'layers-panel';
		mainRow.appendChild( this.layerPanelContainer );

		// Create canvas container (stage)
		this.canvasContainer = document.createElement( 'div' );
		this.canvasContainer.className = 'layers-canvas-container';
		mainRow.appendChild( this.canvasContainer );

		// Bottom inspector (properties + code)
		this.inspectorContainer = document.createElement( 'div' );
		this.inspectorContainer.className = 'layers-inspector';
		this.content.appendChild( this.inspectorContainer );

		// Status bar at the very bottom
		this.statusBar = document.createElement( 'div' );
		this.statusBar.className = 'layers-statusbar';
		this.statusBar.innerHTML = '' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-tool' ).text() : 'Tool' ) + ':</span> <span class="status-value" data-status="tool">pointer</span></span>' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-zoom' ).text() : 'Zoom' ) + ':</span> <span class="status-value" data-status="zoom">100%</span></span>' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-pos' ).text() : 'Pos' ) + ':</span> <span class="status-value" data-status="pos">0,0</span></span>' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-size' ).text() : 'Size' ) + ':</span> <span class="status-value" data-status="size">-</span></span>' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-selection' ).text() : 'Selection' ) + ':</span> <span class="status-value" data-status="selection">0</span></span>';
		this.container.appendChild( this.statusBar );

		// Create jQuery-style references for compatibility
		this.$canvasContainer = $( this.canvasContainer );
		this.$layerPanel = $( this.layerPanelContainer );
		this.$toolbar = $( this.toolbarContainer );

		// Bridge toolbar zoom display to header readout
		var self = this;
		Object.defineProperty( this, 'zoomReadoutEl', { value: zoomReadout } );
		// Toolbar will update zoom; also update from CanvasManager hook
		this.updateZoomReadout = function ( percent ) {
			self.zoomReadoutEl.textContent = percent + '%';
		};

		// Expose simple status update helpers used by CanvasManager
		this.updateStatus = function ( fields ) {
			if ( !fields ) {
				return;
			}
			var root = self.statusBar;
			if ( !root ) {
				return;
			}
			if ( fields.tool !== null && fields.tool !== undefined ) {
				var elTool = root.querySelector( '[data-status="tool"]' );
				if ( elTool ) {
					elTool.textContent = String( fields.tool );
				}
			}
			if ( fields.zoomPercent !== null && fields.zoomPercent !== undefined ) {
				var elZoom = root.querySelector( '[data-status="zoom"]' );
				if ( elZoom ) {
					elZoom.textContent = Math.round( fields.zoomPercent ) + '%';
				}
			}
			if ( fields.pos !== null && fields.pos !== undefined &&
				typeof fields.pos.x === 'number' && typeof fields.pos.y === 'number' ) {
				var elPos = root.querySelector( '[data-status="pos"]' );
				if ( elPos ) {
					elPos.textContent = Math.round( fields.pos.x ) + ',' + Math.round( fields.pos.y );
				}
			}
			if ( fields.size !== null && fields.size !== undefined &&
				typeof fields.size.width === 'number' && typeof fields.size.height === 'number' ) {
				var elSize = root.querySelector( '[data-status="size"]' );
				if ( elSize ) {
					elSize.textContent = Math.round( fields.size.width ) + '×' + Math.round( fields.size.height );
				}
			}
			if ( fields.selectionCount !== null && fields.selectionCount !== undefined ) {
				var elSel = root.querySelector( '[data-status="selection"]' );
				if ( elSel ) {
					elSel.textContent = String( fields.selectionCount );
				}
			}
		};

		// Wire close button
		closeBtn.addEventListener( 'click', function () {
			// navigateBack=true
			self.cancel( true );
		} );
	};

	LayersEditor.prototype.setupEventHandlers = function () {
		var self = this;

		// Bind and store handlers so we can remove them on destroy
		this.onResizeHandler = function () {
			self.handleResize();
		};
		this.onBeforeUnloadHandler = function ( e ) {
			if ( self.isDirty ) {
				e.preventDefault();
				e.returnValue = '';
			}
		};

		// Handle window resize
		window.addEventListener( 'resize', this.onResizeHandler );

		// Handle unsaved changes warning
		window.addEventListener( 'beforeunload', this.onBeforeUnloadHandler );
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
				self.layers = ( data.layersinfo.layerset.data.layers || [] )
					.map( function ( layer ) {
						// Ensure every layer has an id
						if ( !layer.id ) {
							layer.id = 'layer_' + Date.now() + '_' +
								Math.random().toString( 36 ).slice( 2, 9 );
						}
						return layer;
					} );
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
			var canUndo = this.canvasManager ? this.canvasManager.historyIndex > 0 : false;
			var canRedo = this.canvasManager ? (
				this.canvasManager.historyIndex <
				this.canvasManager.history.length - 1
			) : false;
			this.toolbar.updateUndoRedoState( canUndo, canRedo );
			this.toolbar.updateDeleteState( !!this.selectedLayerId );
		}
	};

	// Apply a mutator function to all selected layers; saves state and marks dirty
	LayersEditor.prototype.applyToSelection = function ( mutator ) {
		if ( typeof mutator !== 'function' ) {
			return;
		}
		var ids = this.getSelectedLayerIds();
		if ( !ids.length ) {
			return;
		}
		this.saveState();
		for ( var i = 0; i < ids.length; i++ ) {
			var layer = this.getLayerById( ids[ i ] );
			if ( layer ) {
				mutator( layer );
			}
		}
		this.renderLayers();
		this.markDirty();
	};

	// Return selected layer ids from CanvasManager or fallback to single selection
	LayersEditor.prototype.getSelectedLayerIds = function () {
		if ( this.canvasManager && Array.isArray( this.canvasManager.selectedLayerIds ) ) {
			return this.canvasManager.selectedLayerIds.slice();
		}
		return this.selectedLayerId ? [ this.selectedLayerId ] : [];
	};

	LayersEditor.prototype.cancel = function ( navigateBack ) {
		if ( this.isDirty ) {
			var confirmMessage = ( mw.message ? mw.message( 'layers-unsaved-cancel-confirm' ).text() : 'You have unsaved changes. Are you sure you want to cancel?' );
			// Use OOUI confirm dialog if available, otherwise fallback to browser confirm
			if ( window.OO && window.OO.ui && window.OO.ui.confirm ) {
				window.OO.ui.confirm( confirmMessage ).done( function ( confirmed ) {
					if ( confirmed ) {
						this.destroy();
						this.navigateBackToFile();
					}
				}.bind( this ) );
			} else {
				// eslint-disable-next-line no-alert
				if ( window.confirm( confirmMessage ) ) {
					this.destroy();
					this.navigateBackToFile();
				}
			}
		} else {
			this.destroy();
			if ( navigateBack ) {
				this.navigateBackToFile();
			}
		}
	};

	LayersEditor.prototype.navigateBackToFile = function () {
		try {
			if ( this.filename && mw && mw.util && typeof mw.util.getUrl === 'function' ) {
				var url = mw.util.getUrl( 'File:' + this.filename );
				window.location.href = url;
				return;
			}
			// Fallbacks
			if ( window.history && window.history.length > 1 ) {
				window.history.back();
			} else {
				window.location.reload();
			}
		} catch ( e ) {
			// As a last resort, reload
			window.location.reload();
		}
	};

	LayersEditor.prototype.save = function () {
		var self = this;

		// Show saving indicator
		mw.notify( ( mw.message ? mw.message( 'layers-saving' ).text() : ( mw.msg ? mw.msg( 'layers-saving' ) : 'Saving...' ) ), { type: 'info' } );

		// Disable save button briefly
		if ( this.toolbar && this.toolbar.saveButton ) {
			this.toolbar.saveButton.disabled = true;
			setTimeout( function () {
				self.toolbar.saveButton.disabled = false;
			}, 2000 );
		}

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
				mw.notify( ( mw.message ? mw.message( 'layers-save-success' ).text() : ( mw.msg ? mw.msg( 'layers-save-success' ) : 'Saved' ) ), { type: 'success' } );
				// After a successful save, keep the editor open but update title indicator
				// Optionally, navigate back quickly if user clicked header close earlier
			} else {
				var errorMsg = ( data.error && data.error.info ) ||
					( data.layerssave && data.layerssave.error ) ||
					( mw.message ? mw.message( 'layers-save-error' ).text() : ( mw.msg ? mw.msg( 'layers-save-error' ) : 'Error saving layers' ) );
				mw.notify( 'Save failed: ' + errorMsg, { type: 'error' } );
			}
		} ).fail( function ( code, result ) {
			var errorMsg = ( mw.message ? mw.message( 'layers-save-error' ).text() : ( mw.msg ? mw.msg( 'layers-save-error' ) : 'Error saving layers' ) );
			if ( result && result.error && result.error.info ) {
				errorMsg = result.error.info;
			}
			mw.notify( 'API Error: ' + errorMsg, { type: 'error' } );
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
		var pageImage = document.querySelector( '.mw-file-element img, .fullImageLink img, .filehistory img' );
		if ( pageImage ) {
			var pageImageUrl = pageImage.getAttribute( 'src' );
			// console.log('Layers: Using page image URL:', pageImageUrl);
			return pageImageUrl;
		}

		// Priority 4: Use a default fallback
		// console.log('Layers: No parent image found, using fallback');
		return null;
	};

	LayersEditor.prototype.showError = function ( message ) {
		// Create error display in the editor
		var errorEl = document.createElement( 'div' );
		errorEl.className = 'layers-error';
		errorEl.innerHTML = '<h3>Error</h3><p>' + message + '</p>';
		errorEl.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border: 2px solid #d63638; border-radius: 8px; z-index: 10001; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';
		this.container.appendChild( errorEl );

		// Auto-hide after 10 seconds
		setTimeout( function () {
			errorEl.style.opacity = '0';
			setTimeout( function () {
				if ( errorEl.parentNode ) {
					errorEl.parentNode.removeChild( errorEl );
				}
			}, 500 ); // Allow fade out transition
		}, 10000 );
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
		if ( this.onResizeHandler ) {
			window.removeEventListener( 'resize', this.onResizeHandler );
			this.onResizeHandler = null;
		}
		if ( this.onBeforeUnloadHandler ) {
			window.removeEventListener( 'beforeunload', this.onBeforeUnloadHandler );
			this.onBeforeUnloadHandler = null;
		}
		if ( this.container && this.container.parentNode ) {
			this.container.parentNode.removeChild( this.container );
		}

		// Remove body class when editor closes
		document.body.classList.remove( 'layers-editor-open' );
	};

	// Export LayersEditor to global scope
	window.LayersEditor = LayersEditor;

	// Initialize editor when appropriate
	mw.hook( 'layers.editor.init' ).add( function ( config ) {
		var editor = new LayersEditor( config );
		if ( window.mw && window.mw.config.get( 'debug' ) ) {
			window.layersEditorInstance = editor;
		}
	} );

	// Auto-bootstrap if server provided config via wgLayersEditorInit
	( function autoBootstrap() {
		try {
			var init = mw && mw.config && mw.config.get ? mw.config.get( 'wgLayersEditorInit' ) : null;
			if ( !init ) {
				return;
			}
			var container = document.getElementById( 'layers-editor-container' );
			mw.hook( 'layers.editor.init' ).fire( {
				filename: init.filename,
				imageUrl: init.imageUrl,
				container: container || document.body
			} );
		} catch ( e ) {
			// noop
		}
	}() );

}() );
