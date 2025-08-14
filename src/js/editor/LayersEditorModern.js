/**
 * Improved LayersEditor that integrates with modular components
 *
 * This is an enhanced version that uses the new modular architecture
 * while maintaining compatibility with the existing API
 */
( function () {
	'use strict';

	/**
	 * LayersEditor constructor
	 *
	 * @param {Object} config Configuration object
	 * @class
	 */
	function LayersEditorModern( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.filename = this.config.filename;

		// Core components
		this.canvasManager = null;
		this.toolbar = null;
		this.layerPanel = null;

		// UI state
		this.isInitialized = false;
		this.isLoading = false;
		this.hasUnsavedChanges = false;

		// Configuration from MediaWiki
		this.editorConfig = mw.config.get( 'wgLayersEditorInit' ) || {};

		// Initialize the editor
		this.init();
	}

	/**
	 * Initialize the editor
	 */
	LayersEditorModern.prototype.init = function () {
		var self = this;

		// Check if we have the required modules loaded
		if ( !this.checkDependencies() ) {
			this.showError( 'Required modules not loaded' );
			return;
		}

		// Set up the editor structure
		this.setupEditorStructure();

		// Initialize components
		this.initializeCanvasManager();
		this.initializeToolbar();
		this.initializeLayerPanel();

		// Load existing layer data
		this.loadLayerData().done( function () {
			self.isInitialized = true;
			self.showEditor();
		} ).fail( function ( error ) {
			self.showError( 'Failed to load layer data: ' + error );
		} );

		// Set up global event handlers
		this.setupGlobalHandlers();
	};

	/**
	 * Check if all required dependencies are available
	 *
	 * @return {boolean} True if all dependencies are available
	 */
	LayersEditorModern.prototype.checkDependencies = function () {
		var required = [
			'LayersCanvasManagerModern',
			'LayersHistoryManager',
			'LayersDialogManager',
			'LayersImageLoader',
			'LayersRenderer'
		];

		for ( var i = 0; i < required.length; i++ ) {
			if ( !window[ required[ i ] ] ) {
				mw.log.error( 'Missing required module: ' + required[ i ] );
				return false;
			}
		}

		return true;
	};

	/**
	 * Set up the basic editor structure
	 */
	LayersEditorModern.prototype.setupEditorStructure = function () {
		// Clear the container
		this.container.innerHTML = '';
		this.container.className = 'layers-editor-container';

		// Create main layout
		var layout = document.createElement( 'div' );
		layout.className = 'layers-editor-layout';

		// Create toolbar container
		var toolbarContainer = document.createElement( 'div' );
		toolbarContainer.className = 'layers-toolbar-container';
		toolbarContainer.id = 'layers-toolbar';

		// Create main content area
		var contentArea = document.createElement( 'div' );
		contentArea.className = 'layers-content-area';

		// Create canvas container
		var canvasContainer = document.createElement( 'div' );
		canvasContainer.className = 'layers-canvas-container';
		canvasContainer.id = 'layers-canvas';

		// Create layer panel container
		var layerPanelContainer = document.createElement( 'div' );
		layerPanelContainer.className = 'layers-panel-container';
		layerPanelContainer.id = 'layers-panel';

		// Assemble the layout
		contentArea.appendChild( canvasContainer );
		contentArea.appendChild( layerPanelContainer );

		layout.appendChild( toolbarContainer );
		layout.appendChild( contentArea );

		this.container.appendChild( layout );

		// Store references
		this.toolbarContainer = toolbarContainer;
		this.canvasContainer = canvasContainer;
		this.layerPanelContainer = layerPanelContainer;
	};

	/**
	 * Initialize the canvas manager
	 */
	LayersEditorModern.prototype.initializeCanvasManager = function () {
		this.canvasManager = new window.LayersCanvasManagerModern( {
			container: this.canvasContainer,
			editor: this,
			filename: this.filename
		} );

		// Listen for changes to update UI state
		this.canvasManager.on = this.canvasManager.on || function () {}; // Fallback

		// Manual change tracking for now
		this.setupChangeTracking();
	};

	/**
	 * Set up change tracking for the canvas
	 */
	LayersEditorModern.prototype.setupChangeTracking = function () {
		var originalSaveState = this.canvasManager.saveState;
		var editor = this;
		this.canvasManager.saveState = function () {
			originalSaveState.call( this );
			editor.markAsChanged();
		};
	};

	/**
	 * Initialize the toolbar
	 */
	LayersEditorModern.prototype.initializeToolbar = function () {
		// Check if we have the Toolbar module available
		if ( window.LayersToolbar ) {
			this.toolbar = new window.LayersToolbar( {
				container: this.toolbarContainer,
				canvasManager: this.canvasManager,
				editor: this
			} );
		} else {
			// Create a simple toolbar fallback
			this.createSimpleToolbar();
		}
	};

	/**
	 * Create a simple toolbar if the full Toolbar module is not available
	 */
	LayersEditorModern.prototype.createSimpleToolbar = function () {
		var toolbar = document.createElement( 'div' );
		toolbar.className = 'layers-simple-toolbar';

		var tools = [
			{ name: 'pointer', label: 'Select', icon: '↖' },
			{ name: 'pen', label: 'Draw', icon: '✏' },
			{ name: 'text', label: 'Text', icon: 'T' },
			{ name: 'rectangle', label: 'Rectangle', icon: '□' },
			{ name: 'circle', label: 'Circle', icon: '○' }
		];

		var self = this;

		for ( var i = 0; i < tools.length; i++ ) {
			var tool = tools[ i ];
			var button = document.createElement( 'button' );
			button.className = 'layers-tool-button';
			button.setAttribute( 'data-tool', tool.name );
			button.title = tool.label;
			button.textContent = tool.icon;

			button.addEventListener( 'click', function ( e ) {
				var toolName = e.target.getAttribute( 'data-tool' );
				self.setTool( toolName );

				// Update button states
				var buttons = toolbar.querySelectorAll( '.layers-tool-button' );
				for ( var j = 0; j < buttons.length; j++ ) {
					buttons[ j ].classList.remove( 'active' );
				}
				e.target.classList.add( 'active' );
			} );

			toolbar.appendChild( button );
		}

		// Add save button
		var saveButton = document.createElement( 'button' );
		saveButton.className = 'layers-save-button';
		saveButton.textContent = 'Save';
		saveButton.addEventListener( 'click', function () {
			self.saveLayerData();
		} );

		toolbar.appendChild( saveButton );

		this.toolbarContainer.appendChild( toolbar );

		// Set default tool
		toolbar.querySelector( '[data-tool="pointer"]' ).classList.add( 'active' );
	};

	/**
	 * Initialize the layer panel
	 */
	LayersEditorModern.prototype.initializeLayerPanel = function () {
		// Check if we have the LayerPanel module available
		if ( window.LayersLayerPanel ) {
			this.layerPanel = new window.LayersLayerPanel( {
				container: this.layerPanelContainer,
				canvasManager: this.canvasManager,
				editor: this
			} );
		} else {
			// Create a simple layer panel fallback
			this.createSimpleLayerPanel();
		}
	};

	/**
	 * Create a simple layer panel if the full LayerPanel module is not available
	 */
	LayersEditorModern.prototype.createSimpleLayerPanel = function () {
		var panel = document.createElement( 'div' );
		panel.className = 'layers-simple-panel';

		var title = document.createElement( 'h3' );
		title.textContent = 'Layers';
		panel.appendChild( title );

		var layerList = document.createElement( 'ul' );
		layerList.className = 'layers-list';
		panel.appendChild( layerList );

		this.layerPanelContainer.appendChild( panel );
		this.layerList = layerList;

		// Update the layer list when canvas changes
		this.updateLayerPanel();
	};

	/**
	 * Update the simple layer panel
	 */
	LayersEditorModern.prototype.updateLayerPanel = function () {
		if ( !this.layerList || !this.canvasManager ) {
			return;
		}

		var layers = this.canvasManager.getLayersData();
		this.layerList.innerHTML = '';

		for ( var i = 0; i < layers.length; i++ ) {
			var layer = layers[ i ];
			var listItem = document.createElement( 'li' );
			listItem.className = 'layer-item';
			listItem.textContent = layer.type + ' Layer';

			if ( this.canvasManager.selectedLayerIds.indexOf( layer.id ) !== -1 ) {
				listItem.classList.add( 'selected' );
			}

			this.layerList.appendChild( listItem );
		}
	};

	/**
	 * Set the current tool
	 *
	 * @param {string} toolName Name of the tool to set
	 */
	LayersEditorModern.prototype.setTool = function ( toolName ) {
		if ( this.canvasManager ) {
			this.canvasManager.setTool( toolName );
		}
	};

	/**
	 * Load layer data from the server
	 *
	 * @return {jQuery.Deferred} Promise that resolves when data is loaded
	 */
	LayersEditorModern.prototype.loadLayerData = function () {
		var deferred = $.Deferred();
		var self = this;

		if ( !this.filename ) {
			deferred.resolve( [] );
			return deferred.promise();
		}

		this.isLoading = true;

		// Use MediaWiki API to get layer data
		new mw.Api().get( {
			action: 'layers-info',
			filename: this.filename,
			format: 'json'
		} ).done( function ( data ) {
			self.isLoading = false;

			if ( data && data.layers ) {
				self.canvasManager.setLayersData( data.layers );
				deferred.resolve( data.layers );
			} else {
				deferred.resolve( [] );
			}
		} ).fail( function ( error ) {
			self.isLoading = false;
			deferred.reject( error );
		} );

		return deferred.promise();
	};

	/**
	 * Save layer data to the server
	 *
	 * @return {jQuery.Deferred} Promise that resolves when data is saved
	 */
	LayersEditorModern.prototype.saveLayerData = function () {
		var deferred = $.Deferred();
		var self = this;

		if ( !this.filename ) {
			deferred.reject( 'No filename specified' );
			return deferred.promise();
		}

		var layersData = this.canvasManager.getLayersData();

		// Show saving indicator
		this.showSaving();

		// Use MediaWiki API to save layer data
		new mw.Api().postWithToken( 'csrf', {
			action: 'layers-save',
			filename: this.filename,
			layers: JSON.stringify( layersData ),
			format: 'json'
		} ).done( function ( data ) {
			self.hideSaving();

			if ( data && data.success ) {
				self.markAsSaved();
				deferred.resolve( data );
				mw.notify( 'Layers saved successfully', { type: 'success' } );
			} else {
				deferred.reject( data.error || 'Save failed' );
				mw.notify( 'Failed to save layers', { type: 'error' } );
			}
		} ).fail( function ( error ) {
			self.hideSaving();
			deferred.reject( error );
			mw.notify( 'Error saving layers: ' + error, { type: 'error' } );
		} );

		return deferred.promise();
	};

	/**
	 * Mark the editor as having unsaved changes
	 */
	LayersEditorModern.prototype.markAsChanged = function () {
		this.hasUnsavedChanges = true;
		this.updateTitle();
		this.updateLayerPanel(); // Update the layer panel when changes occur
	};

	/**
	 * Mark the editor as saved
	 */
	LayersEditorModern.prototype.markAsSaved = function () {
		this.hasUnsavedChanges = false;
		this.updateTitle();
	};

	/**
	 * Update the editor title to reflect save state
	 */
	LayersEditorModern.prototype.updateTitle = function () {
		var title = this.container.querySelector( '.layers-editor-title' );
		if ( title ) {
			var text = 'Layers Editor';
			if ( this.hasUnsavedChanges ) {
				text += ' *';
			}
			title.textContent = text;
		}
	};

	/**
	 * Show saving indicator
	 */
	LayersEditorModern.prototype.showSaving = function () {
		mw.notify( 'Saving layers...', { type: 'info', autoHide: false, tag: 'layers-saving' } );
	};

	/**
	 * Hide saving indicator
	 */
	LayersEditorModern.prototype.hideSaving = function () {
		// Use a more specific selector approach
		var notifications = document.querySelectorAll( '[data-mw-notification-tag="layers-saving"]' );
		for ( var i = 0; i < notifications.length; i++ ) {
			notifications[ i ].remove();
		}
	};

	/**
	 * Show the editor (hide loading state)
	 */
	LayersEditorModern.prototype.showEditor = function () {
		this.container.style.display = 'block';

		// Trigger resize to ensure canvas is properly sized
		if ( this.canvasManager ) {
			this.canvasManager.handleResize();
		}
	};

	/**
	 * Show an error message
	 *
	 * @param {string} message Error message to show
	 */
	LayersEditorModern.prototype.showError = function ( message ) {
		this.container.innerHTML = '<div class="layers-error">Error: ' +
			mw.html.escape( message ) + '</div>';
		mw.notify( message, { type: 'error' } );
	};

	/**
	 * Set up global event handlers
	 */
	LayersEditorModern.prototype.setupGlobalHandlers = function () {
		var self = this;

		// Warn about unsaved changes before leaving the page
		window.addEventListener( 'beforeunload', function ( e ) {
			if ( self.hasUnsavedChanges ) {
				var message = 'You have unsaved changes. Are you sure you want to leave?';
				e.returnValue = message;
				return message;
			}
		} );

		// Auto-save every 30 seconds if there are changes
		setInterval( function () {
			if ( self.hasUnsavedChanges && self.isInitialized ) {
				self.saveLayerData();
			}
		}, 30000 );
	};

	/**
	 * Get the current editor state for debugging
	 *
	 * @return {Object} Editor state object
	 */
	LayersEditorModern.prototype.getState = function () {
		return {
			isInitialized: this.isInitialized,
			isLoading: this.isLoading,
			hasUnsavedChanges: this.hasUnsavedChanges,
			layerCount: this.canvasManager ? this.canvasManager.layers.length : 0,
			currentTool: this.canvasManager ? this.canvasManager.currentTool : null
		};
	};

	/**
	 * Destroy the editor and clean up resources
	 */
	LayersEditorModern.prototype.destroy = function () {
		// Remove event listeners
		window.removeEventListener( 'beforeunload', this.beforeUnloadHandler );

		// Clear the container
		if ( this.container ) {
			this.container.innerHTML = '';
		}

		// Clean up references
		this.canvasManager = null;
		this.toolbar = null;
		this.layerPanel = null;
	};

	// Export the modern editor
	window.LayersEditorModern = LayersEditorModern;

	// Also maintain compatibility with the old name
	if ( !window.LayersEditor ) {
		window.LayersEditor = LayersEditorModern;
	}

}() );
