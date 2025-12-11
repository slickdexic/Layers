/**
 * Main Layers Editor - manages the overall editing interface and coordinates between components
 *
 * This is the orchestrator class that coordinates UI managers, canvas, toolbar, and layer panel.
 * Extracted modules handle specific concerns:
 * - EditorBootstrap: Initialization, hook handling, global error handlers
 * - RevisionManager: Revision and named layer set management
 * - DialogManager: Modal dialogs
 */
( function () {
	'use strict';

	// Use shared namespace helper (loaded via utils/NamespaceHelper.js)
	const getClass = ( window.Layers && window.Layers.Utils && window.Layers.Utils.getClass ) ||
		window.layersGetClass ||
		function ( namespacePath, globalName ) {
			// Minimal fallback
			return window[ globalName ] || null;
		};

	// Resolve commonly used classes
	const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
	const EditorBootstrap = window.Layers && window.Layers.Core && window.Layers.Core.EditorBootstrap || window.EditorBootstrap;

	/**
	 * Main Layers Editor class for MediaWiki Layers extension
	 *
	 * @class LayersEditor
	 * @param {Object} config - Configuration object
	 * @param {string} config.filename - Name of the file being edited
	 * @param {string} config.imageUrl - URL of the base image
	 * @param {HTMLElement} config.container - Container element for the editor
	 */
	function LayersEditor( config ) {
		// Validate dependencies using EditorBootstrap
		if ( EditorBootstrap && EditorBootstrap.validateDependencies ) {
			EditorBootstrap.validateDependencies();
		}

		this.config = config || {};
		this.filename = this.config.filename;
		this.containerElement = this.config.container;
		this.canvasManager = null;
		this.layerPanel = null;
		this.toolbar = null;

		// Initialize EventTracker for memory-safe event listener management
		this.eventTracker = EventTracker ? new EventTracker() : null;
		this.isDestroyed = false;

		// Debug mode - check MediaWiki config first, then fallback to config
		this.debug = mw.config.get( 'wgLayersDebug' ) || this.config.debug || false;

		this.debugLog( '[LayersEditor] Constructor called with config:', this.config );

		// Set image URL from config
		this.imageUrl = this.config.imageUrl;

		// Initialize module registry
		this.initializeRegistry();

		// Initialize managers through registry
		this.initializeManagers();

		// Initialize state through StateManager
		this.initializeState();

		// BRIDGE: Provide backward-compatible editor.layers property
		this.defineLegacyLayersProperty();

		// Initialize HistoryManager (must be after layers property is defined)
		this.historyManager = this.registry.get( 'HistoryManager' );

		// Initialize extracted managers
		this.initializeExtractedManagers();

		this.init();
	}

	/**
	 * Initialize the module registry
	 * @private
	 */
	LayersEditor.prototype.initializeRegistry = function () {
		// Resolve manager classes (prefer namespaced)
		const UIManager = getClass( 'UI.Manager', 'UIManager' );
		const EventManager = getClass( 'Core.EventManager', 'EventManager' );
		const APIManager = getClass( 'Core.APIManager', 'APIManager' );
		const ValidationManager = getClass( 'Validation.Manager', 'ValidationManager' );
		const StateManager = getClass( 'Core.StateManager', 'StateManager' );
		const HistoryManager = getClass( 'Core.HistoryManager', 'HistoryManager' );

		// Prefer layersRegistry; layersModuleRegistry is deprecated
		this.registry = window.layersRegistry;
		if ( !this.registry && window.layersModuleRegistry ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( '[LayersEditor] window.layersModuleRegistry is deprecated. Use window.layersRegistry instead.' );
			}
			this.registry = window.layersModuleRegistry;
		}
		if ( !this.registry ) {
			this.registry = this.createFallbackRegistry();
		}

		// Register manager factories with context
		if ( this.registry.register ) {
			this.registry.register( 'UIManager', () => new UIManager( this ), [] );
			this.registry.register( 'EventManager', () => new EventManager( this ), [] );
			this.registry.register( 'APIManager', () => new APIManager( this ), [] );
			this.registry.register( 'ValidationManager', () => new ValidationManager( this ), [] );
			this.registry.register( 'StateManager', () => new StateManager( this ), [] );
			this.registry.register( 'HistoryManager', () => new HistoryManager( this ), [] );
		}
	};

	/**
	 * Create a fallback registry when none is available
	 * @return {Object} Fallback registry
	 * @private
	 */
	LayersEditor.prototype.createFallbackRegistry = function () {
		// Resolve classes using namespace-first approach
		const UIManager = getClass( 'UI.Manager', 'UIManager' );
		const EventManager = getClass( 'Core.EventManager', 'EventManager' );
		const APIManager = getClass( 'Core.APIManager', 'APIManager' );
		const ValidationManager = getClass( 'Validation.Manager', 'ValidationManager' );
		const StateManager = getClass( 'Core.StateManager', 'StateManager' );
		const HistoryManager = getClass( 'Core.HistoryManager', 'HistoryManager' );
		const Toolbar = getClass( 'UI.Toolbar', 'Toolbar' );
		const LayerPanel = getClass( 'UI.LayerPanel', 'LayerPanel' );
		const CanvasManager = getClass( 'Canvas.Manager', 'CanvasManager' );
		const self = this;

		return {
			get: ( name ) => {
				const constructors = {
					UIManager: () => ( typeof UIManager === 'function' ) ? new UIManager( self ) : self.createStubUIManager(),
					EventManager: () => ( typeof EventManager === 'function' ) ? new EventManager( self ) : { setupGlobalHandlers: function () {}, destroy: function () {}, handleKeyDown: function () {} },
					APIManager: () => ( typeof APIManager === 'function' ) ? new APIManager( self ) : { loadLayers: function () { return Promise.resolve( {} ); }, saveLayers: function () { return Promise.resolve( {} ); }, destroy: function () {} },
					ValidationManager: () => ( typeof ValidationManager === 'function' ) ? new ValidationManager( self ) : { checkBrowserCompatibility: function () { return true; }, sanitizeLayerData: function ( d ) { return d; }, validateLayers: function () { return true; }, destroy: function () {} },
					StateManager: () => ( typeof StateManager === 'function' ) ? new StateManager( self ) : self.createStubStateManager(),
					HistoryManager: () => ( typeof HistoryManager === 'function' ) ? new HistoryManager( self ) : { saveState: function () {}, updateUndoRedoButtons: function () {}, undo: function () { return true; }, redo: function () { return true; }, canUndo: function () { return false; }, canRedo: function () { return false; }, destroy: function () {} },
					Toolbar: () => ( typeof Toolbar === 'function' ) ? new Toolbar( { container: ( self.uiManager && self.uiManager.toolbarContainer ) || document.createElement( 'div' ), editor: self } ) : { destroy: function () {}, setActiveTool: function () {}, updateUndoRedoState: function () {}, updateDeleteState: function () {} },
					LayerPanel: () => ( typeof LayerPanel === 'function' ) ? new LayerPanel( { container: ( self.uiManager && self.uiManager.layerPanelContainer ) || document.createElement( 'div' ), editor: self } ) : { destroy: function () {}, selectLayer: function () {}, updateLayerList: function () {} },
					CanvasManager: () => ( typeof CanvasManager === 'function' ) ? new CanvasManager( { container: ( self.uiManager && self.uiManager.canvasContainer ) || document.createElement( 'div' ), editor: self, backgroundImageUrl: self.imageUrl } ) : { destroy: function () {}, renderLayers: function () {}, events: { destroy: function () {} } }
				};
				if ( constructors[ name ] ) {
					return constructors[ name ]();
				}
				throw new Error( `Module ${name} not found` );
			}
		};
	};

	/**
	 * Create a stub UI manager
	 * @return {Object} Stub UI manager
	 * @private
	 */
	LayersEditor.prototype.createStubUIManager = function () {
		const stub = {};
		stub.container = document.createElement( 'div' );
		stub.toolbarContainer = document.createElement( 'div' );
		stub.layerPanelContainer = document.createElement( 'div' );
		stub.canvasContainer = document.createElement( 'div' );
		stub.createInterface = function () {};
		stub.destroy = function () {};
		stub.showSpinner = function () {};
		stub.hideSpinner = function () {};
		stub.showBrowserCompatibilityWarning = function () {};
		return stub;
	};

	/**
	 * Create a stub state manager
	 * @return {Object} Stub state manager
	 * @private
	 */
	LayersEditor.prototype.createStubStateManager = function () {
		const store = {};
		return {
			set: function ( k, v ) { store[ k ] = v; },
			get: function ( k ) { return store[ k ]; },
			subscribe: function () {},
			setDirty: function () {},
			isDirty: function () { return false; },
			getLayers: function () { return store.layers || []; },
			destroy: function () {}
		};
	};

	/**
	 * Initialize managers through registry
	 * @private
	 */
	LayersEditor.prototype.initializeManagers = function () {
		this.uiManager = this.registry.get( 'UIManager' );
		this.eventManager = this.registry.get( 'EventManager' );
		this.apiManager = this.registry.get( 'APIManager' );
		this.validationManager = this.registry.get( 'ValidationManager' );
		this.stateManager = this.registry.get( 'StateManager' );

		// Ensure state manager is valid
		if ( !this.stateManager || typeof this.stateManager.set !== 'function' ) {
			this.stateManager = this.createStubStateManager();
		}
	};

	/**
	 * Initialize state through StateManager
	 * @private
	 */
	LayersEditor.prototype.initializeState = function () {
		if ( this.stateManager && typeof this.stateManager.set === 'function' ) {
			this.stateManager.set( 'layers', [] );
			this.stateManager.set( 'selectedLayerIds', [] );
			this.stateManager.set( 'isDirty', false );
			this.stateManager.set( 'currentTool', 'pointer' );
			this.stateManager.set( 'baseWidth', null );
			this.stateManager.set( 'baseHeight', null );
			this.stateManager.set( 'allLayerSets', [] );
			this.stateManager.set( 'currentLayerSetId', null );
			// Named Layer Sets state
			this.stateManager.set( 'namedSets', [] );
			this.stateManager.set( 'currentSetName', 'default' );
		}
	};

	/**
	 * Define legacy layers property for backward compatibility
	 * @private
	 */
	LayersEditor.prototype.defineLegacyLayersProperty = function () {
		Object.defineProperty( this, 'layers', {
			get: function () {
				return this.stateManager.getLayers();
			}.bind( this ),
			set: function ( layers ) {
				if ( Array.isArray( layers ) ) {
					this.stateManager.set( 'layers', layers );
				}
			}.bind( this ),
			enumerable: true,
			configurable: true
		} );
	};

	/**
	 * Initialize extracted managers (RevisionManager, DialogManager)
	 * @private
	 */
	LayersEditor.prototype.initializeExtractedManagers = function () {
		// Initialize RevisionManager
		if ( typeof window.RevisionManager === 'function' ) {
			this.revisionManager = new window.RevisionManager( { editor: this } );
		}

		// Initialize DialogManager
		if ( typeof window.DialogManager === 'function' ) {
			this.dialogManager = new window.DialogManager( { editor: this } );
		}
	};

	/**
	 * Debug logging utility
	 * @param {...*} args Arguments to log
	 */
	LayersEditor.prototype.debugLog = function () {
		if ( this.debug && mw.log ) {
			const sanitizedArgs = Array.prototype.slice.call( arguments )
				.map( ( arg ) => this.sanitizeLogMessage( arg ) );
			mw.log.apply( mw, sanitizedArgs );
		}
	};

	/**
	 * Error logging utility
	 * @param {...*} args Arguments to log
	 */
	LayersEditor.prototype.errorLog = function () {
		const sanitizedArgs = Array.prototype.slice.call( arguments )
			.map( ( arg ) => this.sanitizeLogMessage( arg ) );
		if ( mw.log ) {
			mw.log.error.apply( mw.log, sanitizedArgs );
		}
	};

	/**
	 * Sanitize log messages to prevent sensitive information disclosure
	 * @param {*} message The message to sanitize
	 * @return {*} Sanitized message
	 */
	LayersEditor.prototype.sanitizeLogMessage = function ( message ) {
		if ( typeof message !== 'string' ) {
			if ( typeof message === 'object' && message !== null ) {
				const safeKeys = [ 'type', 'action', 'status', 'tool', 'layer', 'count', 'x', 'y', 'width', 'height' ];
				const obj = {};
				for ( const key in message ) {
					if ( Object.prototype.hasOwnProperty.call( message, key ) ) {
						obj[ key ] = safeKeys.includes( key ) ? message[ key ] : '[FILTERED]';
					}
				}
				return obj;
			}
			return message;
		}

		let result = String( message );
		result = result.replace( /[a-zA-Z0-9+/=]{20,}/g, '[TOKEN]' );
		result = result.replace( /[a-fA-F0-9]{16,}/g, '[HEX]' );
		result = result.replace( /[A-Za-z]:[\\/][\w\s\\.-]*/g, '[PATH]' );
		result = result.replace( /\/[\w\s.-]+/g, '[PATH]' );
		result = result.replace( /https?:\/\/[^\s'"<>&]*/gi, '[URL]' );
		result = result.replace( /\w+:\/\/[^\s'"<>&]*/gi, '[CONNECTION]' );
		result = result.replace( /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]' );
		result = result.replace( /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]' );

		if ( result.length > 200 ) {
			result = result.slice( 0, 200 ) + '[TRUNCATED]';
		}

		return result;
	};

	/**
	 * Render layers on canvas (bridge method)
	 * @param {Array} layers Optional array of layers to render
	 */
	LayersEditor.prototype.renderLayers = function ( layers ) {
		if ( this.canvasManager && typeof this.canvasManager.renderLayers === 'function' ) {
			this.canvasManager.renderLayers( layers || this.stateManager.getLayers() );
		}
	};

	/**
	 * Check if editor has unsaved changes
	 * @return {boolean} True if there are unsaved changes
	 */
	LayersEditor.prototype.isDirty = function () {
		return this.stateManager.isDirty();
	};

	/**
	 * Mark editor as having unsaved changes
	 */
	LayersEditor.prototype.markDirty = function () {
		this.stateManager.setDirty( true );
	};

	/**
	 * Mark editor as clean (no unsaved changes)
	 */
	LayersEditor.prototype.markClean = function () {
		this.stateManager.setDirty( false );
	};

	/**
	 * Undo last action
	 * @return {boolean} True if undo was successful
	 */
	LayersEditor.prototype.undo = function () {
		if ( this.historyManager && typeof this.historyManager.undo === 'function' ) {
			return this.historyManager.undo();
		}
		return false;
	};

	/**
	 * Redo last undone action
	 * @return {boolean} True if redo was successful
	 */
	LayersEditor.prototype.redo = function () {
		if ( this.historyManager && typeof this.historyManager.redo === 'function' ) {
			return this.historyManager.redo();
		}
		return false;
	};

	/**
	 * Initialize the editor
	 */
	LayersEditor.prototype.init = function () {
		document.title = '🔄 Layers Editor Loading...';
		this.debugLog( '[LayersEditor] init() method called' );

		// Check browser compatibility first
		if ( !this.validationManager.checkBrowserCompatibility() ) {
			this.uiManager.showBrowserCompatibilityWarning();
			return;
		}

		// Create the main editor interface
		this.uiManager.createInterface();
		this.debugLog( '[LayersEditor] UI Manager created interface' );

		// Register and initialize UI components
		this.initializeUIComponents();

		// Initialize LayerSetManager if available
		if ( typeof window.LayerSetManager === 'function' ) {
			this.layerSetManager = new window.LayerSetManager( {
				editor: this,
				stateManager: this.stateManager,
				apiManager: this.apiManager,
				uiManager: this.uiManager,
				debug: this.debug
			} );
		}

		// Load existing layers
		this.loadInitialLayers();

		// Set up event handlers
		this.eventManager.setupGlobalHandlers();
		this.setupCloseButton();

		document.title = '🎨 Layers Editor - ' + ( this.filename || 'Unknown File' );
	};

	/**
	 * Initialize UI components (toolbar, layer panel, canvas)
	 * @private
	 */
	LayersEditor.prototype.initializeUIComponents = function () {
		// Register UI component factories
		if ( this.registry.register ) {
			this.registry.register( 'Toolbar', () => new window.Toolbar( {
				container: this.uiManager.toolbarContainer,
				editor: this
			} ), [] );
			this.registry.register( 'LayerPanel', () => new window.LayerPanel( {
				container: this.uiManager.layerPanelContainer,
				editor: this
			} ), [] );
			this.registry.register( 'CanvasManager', () => new window.CanvasManager( {
				container: this.uiManager.canvasContainer,
				editor: this,
				backgroundImageUrl: this.imageUrl
			} ), [] );
		}

		// Initialize components
		this.toolbar = this.registry.get( 'Toolbar' );
		this.layerPanel = this.registry.get( 'LayerPanel' );
		this.canvasManager = this.registry.get( 'CanvasManager' );

		this.debugLog( '[LayersEditor] UI components initialized' );
	};

	/**
	 * Load initial layers from API
	 * @private
	 */
	LayersEditor.prototype.loadInitialLayers = function () {
		this.apiManager.loadLayers().then( ( data ) => {
			if ( this.isDestroyed ) {
				return;
			}

			this.debugLog( '[LayersEditor] API loadLayers completed' );

			if ( data && data.layers ) {
				const normalizedLayers = this.normalizeLayers( data.layers );
				this.stateManager.set( 'layers', normalizedLayers );
			} else {
				this.stateManager.set( 'layers', [] );
			}

			if ( data && data.baseWidth ) {
				this.stateManager.set( 'baseWidth', data.baseWidth );
				if ( this.canvasManager && this.canvasManager.setBaseDimensions ) {
					this.canvasManager.setBaseDimensions( data.baseWidth, data.baseHeight );
				}
			}
			if ( data && data.baseHeight ) {
				this.stateManager.set( 'baseHeight', data.baseHeight );
			}
			if ( data && data.allLayerSets ) {
				this.stateManager.set( 'allLayerSets', data.allLayerSets );
			}
			if ( data && data.currentLayerSetId ) {
				this.stateManager.set( 'currentLayerSetId', data.currentLayerSetId );
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			if ( this.canvasManager ) {
				this.canvasManager.renderLayers( layers );
			}
			this.saveState( 'initial' );
		} ).catch( ( error ) => {
			if ( this.isDestroyed ) {
				return;
			}
			this.debugLog( '[LayersEditor] API loadLayers failed:', error );
			this.stateManager.set( 'layers', [] );
			if ( this.canvasManager ) {
				this.canvasManager.renderLayers( [] );
			}
			this.saveState( 'initial' );
		} );
	};

	/**
	 * Set up close button handler
	 * @private
	 */
	LayersEditor.prototype.setupCloseButton = function () {
		const closeBtn = this.uiManager.container.querySelector( '.layers-header-close' );
		if ( closeBtn ) {
			const closeHandler = () => {
				this.cancel( true );
			};
			this.trackEventListener( closeBtn, 'click', closeHandler );
		}
	};

	/**
	 * Add a new layer to the editor
	 * @param {Object} layerData - Layer data object
	 */
	LayersEditor.prototype.addLayer = function ( layerData ) {
		this.saveState();
		layerData = this.validationManager.sanitizeLayerData( layerData );
		layerData.id = this.apiManager.generateLayerId();
		layerData.visible = layerData.visible !== false;

		const layers = this.stateManager.get( 'layers' ) || [];
		layers.unshift( layerData );
		this.stateManager.set( 'layers', layers );

		if ( this.canvasManager ) {
			this.canvasManager.renderLayers( layers );
		}
		this.markDirty();
		this.selectLayer( layerData.id );
	};

	/**
	 * Update an existing layer with new data
	 * @param {string} layerId - ID of the layer to update
	 * @param {Object} changes - Changes to apply to the layer
	 */
	LayersEditor.prototype.updateLayer = function ( layerId, changes ) {
		try {
			this.saveState();

			if ( Object.prototype.hasOwnProperty.call( changes, 'outerRadius' ) &&
				!Object.prototype.hasOwnProperty.call( changes, 'radius' ) ) {
				changes.radius = changes.outerRadius;
			}

			changes = this.validationManager.sanitizeLayerData( changes );

			const layers = this.stateManager.get( 'layers' ) || [];
			const layer = layers.find( ( l ) => l.id === layerId );
			if ( layer ) {
				Object.assign( layer, changes );
				this.stateManager.set( 'layers', layers );

				if ( this.canvasManager ) {
					this.canvasManager.redraw();
				}
				this.markDirty();
			}
		} catch ( error ) {
			if ( this.debug ) {
				this.errorLog( 'Error in updateLayer:', error );
			}
			if ( window.mw && window.mw.notify ) {
				mw.notify( 'Error updating layer', { type: 'error' } );
			}
		}
	};

	/**
	 * Remove a layer from the editor
	 * @param {string} layerId - ID of the layer to remove
	 */
	LayersEditor.prototype.removeLayer = function ( layerId ) {
		this.saveState();

		const layers = this.stateManager.get( 'layers' ) || [];
		const updatedLayers = layers.filter( ( layer ) => layer.id !== layerId );
		this.stateManager.set( 'layers', updatedLayers );

		if ( this.canvasManager ) {
			this.canvasManager.redraw();
		}
		this.markDirty();
		this.updateUIState();
	};

	/**
	 * Get a layer by its ID
	 * @param {string} layerId - ID of the layer
	 * @return {Object|undefined} The layer object or undefined
	 */
	LayersEditor.prototype.getLayerById = function ( layerId ) {
		const layers = this.stateManager.get( 'layers' ) || [];
		return layers.find( ( layer ) => layer.id === layerId );
	};

	// ============================================
	// Revision Management - Delegate to RevisionManager
	// ============================================

	/**
	 * Parse MediaWiki binary(14) timestamp format
	 * @param {string} mwTimestamp MediaWiki timestamp string
	 * @return {Date} Parsed date object
	 */
	LayersEditor.prototype.parseMWTimestamp = function ( mwTimestamp ) {
		if ( this.revisionManager ) {
			return this.revisionManager.parseMWTimestamp( mwTimestamp );
		}
		// Fallback
		if ( !mwTimestamp || typeof mwTimestamp !== 'string' ) {
			return new Date();
		}
		const year = parseInt( mwTimestamp.substring( 0, 4 ), 10 );
		const month = parseInt( mwTimestamp.substring( 4, 6 ), 10 ) - 1;
		const day = parseInt( mwTimestamp.substring( 6, 8 ), 10 );
		const hour = parseInt( mwTimestamp.substring( 8, 10 ), 10 );
		const minute = parseInt( mwTimestamp.substring( 10, 12 ), 10 );
		const second = parseInt( mwTimestamp.substring( 12, 14 ), 10 );
		return new Date( year, month, day, hour, minute, second );
	};

	/**
	 * Build the revision selector dropdown
	 */
	LayersEditor.prototype.buildRevisionSelector = function () {
		if ( this.revisionManager ) {
			this.revisionManager.buildRevisionSelector();
		}
	};

	/**
	 * Update the revision load button state
	 */
	LayersEditor.prototype.updateRevisionLoadButton = function () {
		if ( this.revisionManager ) {
			this.revisionManager.updateRevisionLoadButton();
		}
	};

	/**
	 * Build and populate the named layer sets selector
	 */
	LayersEditor.prototype.buildSetSelector = function () {
		if ( this.revisionManager ) {
			this.revisionManager.buildSetSelector();
		}
	};

	/**
	 * Update the new set button state
	 */
	LayersEditor.prototype.updateNewSetButtonState = function () {
		if ( this.revisionManager ) {
			this.revisionManager.updateNewSetButtonState();
		}
	};

	/**
	 * Load a layer set by name
	 * @param {string} setName The name of the set to load
	 * @return {Promise<void>}
	 */
	LayersEditor.prototype.loadLayerSetByName = async function ( setName ) {
		if ( this.revisionManager ) {
			return this.revisionManager.loadLayerSetByName( setName );
		}
	};

	/**
	 * Create a new named layer set
	 * @param {string} setName The name for the new set
	 * @return {Promise<boolean>}
	 */
	LayersEditor.prototype.createNewLayerSet = async function ( setName ) {
		if ( this.revisionManager ) {
			return this.revisionManager.createNewLayerSet( setName );
		}
		return false;
	};

	/**
	 * Load a specific revision by ID
	 * @param {number} revisionId The revision ID to load
	 */
	LayersEditor.prototype.loadRevisionById = function ( revisionId ) {
		if ( this.revisionManager ) {
			this.revisionManager.loadRevisionById( revisionId );
		}
	};

	/**
	 * Show the keyboard shortcuts help dialog
	 */
	LayersEditor.prototype.showKeyboardShortcutsDialog = function () {
		if ( this.dialogManager ) {
			this.dialogManager.showKeyboardShortcutsDialog();
		}
	};

	/**
	 * Check if there are unsaved changes
	 * @return {boolean}
	 */
	LayersEditor.prototype.hasUnsavedChanges = function () {
		return this.stateManager.get( 'hasUnsavedChanges' ) || false;
	};

	/**
	 * Update the save button state
	 */
	LayersEditor.prototype.updateSaveButtonState = function () {
		try {
			if ( this.toolbar && this.toolbar.saveBtnEl ) {
				const hasChanges = this.hasUnsavedChanges();
				this.toolbar.saveBtnEl.classList.toggle( 'has-changes', hasChanges );
			}
		} catch ( error ) {
			this.errorLog( 'Error updating save button state:', error );
		}
	};

	/**
	 * Get a localized message
	 * @param {string} key Message key
	 * @param {string} fallback Fallback text
	 * @return {string} Localized message
	 */
	LayersEditor.prototype.getMessage = function ( key, fallback = '' ) {
		return window.layersMessages.get( key, fallback );
	};

	/**
	 * Set the current tool
	 * @param {string} tool Tool name
	 * @param {Object} options Options
	 */
	LayersEditor.prototype.setCurrentTool = function ( tool, options ) {
		const opts = options || {};
		this.stateManager.set( 'currentTool', tool );
		if ( this.canvasManager ) {
			this.canvasManager.setTool( tool );
		}
		if ( this.toolbar && !opts.skipToolbarSync ) {
			this.toolbar.setActiveTool( tool );
		}
	};

	/**
	 * Save state for undo/redo
	 * @param {string} action Action description
	 */
	LayersEditor.prototype.saveState = function ( action ) {
		if ( this.historyManager ) {
			this.historyManager.saveState( action );
		}
	};

	/**
	 * Select a layer by ID
	 * @param {string} layerId Layer ID to select
	 */
	LayersEditor.prototype.selectLayer = function ( layerId ) {
		try {
			// Delegate to CanvasManager which manages selection via StateManager
			if ( this.canvasManager ) {
				this.canvasManager.selectLayer( layerId );
			} else if ( this.stateManager ) {
				// Fallback: set directly in StateManager using plural form
				this.stateManager.set( 'selectedLayerIds', layerId ? [ layerId ] : [] );
			}
			if ( this.layerPanel ) {
				this.layerPanel.selectLayer( layerId );
			}
			this.updateUIState();
		} catch ( error ) {
			if ( this.debug ) {
				this.errorLog( 'Error in selectLayer:', error );
			}
		}
	};

	/**
	 * Delete the selected layer
	 */
	LayersEditor.prototype.deleteSelected = function () {
		const selectedIds = this.getSelectedLayerIds();
		if ( selectedIds.length > 0 ) {
			// Delete all selected layers
			selectedIds.forEach( id => this.removeLayer( id ) );
			// Clear selection through CanvasManager (updates StateManager)
			if ( this.canvasManager ) {
				this.canvasManager.deselectAll();
			}
		}
	};

	/**
	 * Duplicate the selected layer
	 */
	LayersEditor.prototype.duplicateSelected = function () {
		const selectedIds = this.getSelectedLayerIds();
		if ( selectedIds.length > 0 ) {
			// Duplicate the first selected layer (primary selection)
			const layerId = selectedIds[ selectedIds.length - 1 ]; // Last = primary
			const layer = this.getLayerById( layerId );
			if ( layer ) {
				const duplicate = JSON.parse( JSON.stringify( layer ) );
				duplicate.x = ( duplicate.x || 0 ) + 20;
				duplicate.y = ( duplicate.y || 0 ) + 20;
				delete duplicate.id;
				this.addLayer( duplicate );
			}
		}
	};

	/**
	 * Update UI state (toolbar buttons, etc.)
	 */
	LayersEditor.prototype.updateUIState = function () {
		try {
			if ( this.toolbar ) {
				const canUndo = this.historyManager ? this.historyManager.canUndo() : false;
				const canRedo = this.historyManager ? this.historyManager.canRedo() : false;
				const hasSelection = this.getSelectedLayerIds().length > 0;
				this.toolbar.updateUndoRedoState( canUndo, canRedo );
				this.toolbar.updateDeleteState( hasSelection );
			}
		} catch ( error ) {
			if ( this.debug ) {
				this.errorLog( 'Error in updateUIState:', error );
			}
		}
	};

	/**
	 * Apply a mutator function to all selected layers
	 * @param {Function} mutator Function to apply to each layer
	 */
	LayersEditor.prototype.applyToSelection = function ( mutator ) {
		if ( typeof mutator !== 'function' ) {
			return;
		}
		const ids = this.getSelectedLayerIds();
		if ( !ids.length ) {
			return;
		}
		this.saveState();
		const layers = this.stateManager.get( 'layers' ) || [];
		for ( let i = 0; i < ids.length; i++ ) {
			const layer = layers.find( ( l ) => l.id === ids[ i ] );
			if ( layer ) {
				mutator( layer );
			}
		}
		this.stateManager.set( 'layers', layers );
		if ( this.canvasManager ) {
			this.canvasManager.renderLayers( layers );
		}
		this.markDirty();
	};

	/**
	 * Get selected layer IDs
	 * @return {string[]} Array of selected layer IDs
	 */
	LayersEditor.prototype.getSelectedLayerIds = function () {
		// Delegate to CanvasManager if available (preferred path)
		if ( this.canvasManager && typeof this.canvasManager.getSelectedLayerIds === 'function' ) {
			// Return a copy to prevent accidental mutation
			return this.canvasManager.getSelectedLayerIds().slice();
		}
		// Fallback to StateManager directly (uses plural key 'selectedLayerIds')
		if ( this.stateManager ) {
			const ids = this.stateManager.get( 'selectedLayerIds' );
			return ids ? ids.slice() : [];
		}
		return [];
	};

	/**
	 * Navigate back to file page
	 */
	LayersEditor.prototype.navigateBackToFile = function () {
		this.navigateBackToFileWithName( this.filename );
	};

	/**
	 * Navigate back to file page with specific filename
	 * @param {string} filename The filename to navigate to
	 * @private
	 */
	LayersEditor.prototype.navigateBackToFileWithName = function ( filename ) {
		try {
			if ( filename && mw && mw.util && typeof mw.util.getUrl === 'function' ) {
				const url = mw.util.getUrl( 'File:' + filename );
				window.location.href = url;
				return;
			}
			if ( window.history && window.history.length > 1 ) {
				window.history.back();
			} else {
				window.location.reload();
			}
		} catch ( e ) {
			window.location.reload();
		}
	};

	/**
	 * Save the current layers to the server
	 */
	LayersEditor.prototype.save = function () {
		const layers = this.stateManager.get( 'layers' ) || [];

		if ( !this.validationManager.validateLayers( layers ) ) {
			const validationMsg = window.layersMessages ?
				window.layersMessages.get( 'layers-save-validation-error', 'Layer validation failed' ) :
				'Layer validation failed';
			mw.notify( validationMsg, { type: 'error' } );
			return;
		}

		const savingMsg = window.layersMessages ?
			window.layersMessages.get( 'layers-saving', 'Saving...' ) :
			'Saving...';
		this.uiManager.showSpinner( savingMsg );

		this.apiManager.saveLayers()
			.then( ( result ) => {
				this.stateManager.set( 'currentLayerSetId', result.layersetid );
			} )
			.catch( ( error ) => {
				this.uiManager.hideSpinner();
				const defaultErrorMsg = window.layersMessages ?
					window.layersMessages.get( 'layers-save-error', 'Failed to save layers' ) :
					'Failed to save layers';
				const errorMsg = error.info || defaultErrorMsg;
				mw.notify( errorMsg, { type: 'error' } );
			} );
	};

	/**
	 * Reload the revision selector after saving
	 */
	LayersEditor.prototype.reloadRevisions = function () {
		try {
			if ( this.apiManager && this.apiManager.reloadRevisions ) {
				this.apiManager.reloadRevisions();
			}
		} catch ( error ) {
			this.errorLog( 'Error in reloadRevisions:', error );
		}
	};

	/**
	 * Normalize layer visibility on load
	 * @param {Array} layers Array of layer objects
	 * @return {Array} Normalized layers
	 */
	LayersEditor.prototype.normalizeLayers = function ( layers ) {
		if ( !layers || !Array.isArray( layers ) ) {
			return layers;
		}
		return layers.map( function ( layer ) {
			if ( layer.visible === undefined ) {
				layer.visible = true;
			}
			return layer;
		} );
	};

	/**
	 * Cancel editing and return to the file page
	 * @param {boolean} navigateBack Whether to navigate back
	 */
	LayersEditor.prototype.cancel = function ( navigateBack ) {
		const savedFilename = this.filename;
		const isDirty = this.stateManager.get( 'isDirty' );

		if ( isDirty ) {
			// Use DialogManager if available
			if ( this.dialogManager ) {
				this.dialogManager.showCancelConfirmDialog( () => {
					if ( this.stateManager ) {
						this.stateManager.set( 'isDirty', false );
					}
					if ( this.eventManager && typeof this.eventManager.destroy === 'function' ) {
						this.eventManager.destroy();
					}
					this.uiManager.destroy();
					if ( navigateBack ) {
						this.navigateBackToFileWithName( savedFilename );
					}
				} );
			} else {
				// Fallback to showCancelConfirmDialog method
				this.showCancelConfirmDialog( () => {
					if ( this.stateManager ) {
						this.stateManager.set( 'isDirty', false );
					}
					if ( this.eventManager && typeof this.eventManager.destroy === 'function' ) {
						this.eventManager.destroy();
					}
					this.uiManager.destroy();
					if ( navigateBack ) {
						this.navigateBackToFileWithName( savedFilename );
					}
				} );
			}
		} else {
			this.uiManager.destroy();
			if ( navigateBack ) {
				this.navigateBackToFileWithName( savedFilename );
			}
		}
	};

	/**
	 * Show cancel confirmation dialog (fallback when DialogManager not available)
	 * @param {Function} onConfirm Callback when user confirms
	 * @private
	 */
	LayersEditor.prototype.showCancelConfirmDialog = function ( onConfirm ) {
		const t = function ( key, fallback ) {
			if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
				return window.layersMessages.get( key, fallback );
			}
			return fallback;
		};

		const overlay = document.createElement( 'div' );
		overlay.className = 'layers-modal-overlay';
		overlay.setAttribute( 'role', 'presentation' );

		const dialog = document.createElement( 'div' );
		dialog.className = 'layers-modal-dialog';
		dialog.setAttribute( 'role', 'alertdialog' );
		dialog.setAttribute( 'aria-modal', 'true' );
		dialog.setAttribute( 'aria-label', t( 'layers-confirm-title', 'Confirm' ) );

		const text = document.createElement( 'p' );
		text.textContent = t( 'layers-cancel-confirm', 'You have unsaved changes. Are you sure you want to close the editor? All changes will be lost.' );
		dialog.appendChild( text );

		const buttons = document.createElement( 'div' );
		buttons.className = 'layers-modal-buttons';

		const cancelBtn = document.createElement( 'button' );
		cancelBtn.textContent = t( 'layers-cancel-continue', 'Continue Editing' );
		cancelBtn.className = 'layers-btn layers-btn-primary';

		const confirmBtn = document.createElement( 'button' );
		confirmBtn.textContent = t( 'layers-cancel-discard', 'Discard Changes' );
		confirmBtn.className = 'layers-btn layers-btn-secondary layers-btn-danger';

		buttons.appendChild( cancelBtn );
		buttons.appendChild( confirmBtn );
		dialog.appendChild( buttons );

		document.body.appendChild( overlay );
		document.body.appendChild( dialog );

		const cleanup = function () {
			if ( overlay.parentNode ) {
				overlay.parentNode.removeChild( overlay );
			}
			if ( dialog.parentNode ) {
				dialog.parentNode.removeChild( dialog );
			}
			document.removeEventListener( 'keydown', handleKey );
		};

		const handleKey = function ( e ) {
			if ( e.key === 'Escape' ) {
				cleanup();
			} else if ( e.key === 'Tab' ) {
				const focusable = dialog.querySelectorAll( 'button' );
				if ( focusable.length ) {
					const first = focusable[ 0 ];
					const last = focusable[ focusable.length - 1 ];
					if ( e.shiftKey && document.activeElement === first ) {
						e.preventDefault();
						last.focus();
					} else if ( !e.shiftKey && document.activeElement === last ) {
						e.preventDefault();
						first.focus();
					}
				}
			}
		};
		document.addEventListener( 'keydown', handleKey );

		cancelBtn.addEventListener( 'click', cleanup );
		confirmBtn.addEventListener( 'click', function () {
			cleanup();
			onConfirm();
		} );

		cancelBtn.focus();
	};

	/**
	 * Handle keyboard shortcuts
	 * @param {KeyboardEvent} e Keyboard event
	 * @private
	 */
	LayersEditor.prototype.handleKeyDown = function ( e ) {
		this.eventManager.handleKeyDown( e );
	};

	/**
	 * Destroy the editor and clean up resources
	 */
	LayersEditor.prototype.destroy = function () {
		if ( this.isDestroyed ) {
			return;
		}
		this.isDestroyed = true;

		// Clean up event listeners
		this.cleanupGlobalEventListeners();

		// Clean up managers
		const managers = [
			'uiManager', 'eventManager', 'apiManager', 'validationManager',
			'stateManager', 'historyManager', 'layerSetManager',
			'revisionManager', 'dialogManager'
		];

		managers.forEach( ( name ) => {
			if ( this[ name ] && typeof this[ name ].destroy === 'function' ) {
				this[ name ].destroy();
			}
		} );

		// Clean up canvas manager
		if ( this.canvasManager ) {
			if ( this.canvasManager.events && typeof this.canvasManager.events.destroy === 'function' ) {
				this.canvasManager.events.destroy();
			}
			if ( this.canvasManager.selectionSystem && typeof this.canvasManager.selectionSystem.destroy === 'function' ) {
				this.canvasManager.selectionSystem.destroy();
			}
			if ( typeof this.canvasManager.destroy === 'function' ) {
				this.canvasManager.destroy();
			}
		}

		// Clean up toolbar and layer panel
		if ( this.toolbar && typeof this.toolbar.destroy === 'function' ) {
			this.toolbar.destroy();
		}
		if ( this.layerPanel && typeof this.layerPanel.destroy === 'function' ) {
			this.layerPanel.destroy();
		}

		// Clean up DOM event listeners
		this.cleanupDOMEventListeners();

		// Clear all object references
		this.uiManager = null;
		this.eventManager = null;
		this.apiManager = null;
		this.validationManager = null;
		this.stateManager = null;
		this.historyManager = null;
		this.canvasManager = null;
		this.toolbar = null;
		this.layerPanel = null;
		this.layerSetManager = null;
		this.revisionManager = null;
		this.dialogManager = null;
		this.config = null;
		this.filename = null;
		this.containerElement = null;
		this.imageUrl = null;
		this.layers = null;
		this.clipboard = null;
	};

	/**
	 * Clean up global event listeners
	 * @private
	 */
	LayersEditor.prototype.cleanupGlobalEventListeners = function () {
		if ( this.eventTracker ) {
			this.eventTracker.removeAllForElement( window );
			this.eventTracker.removeAllForElement( document );
		}
	};

	/**
	 * Clean up DOM event listeners
	 * @private
	 */
	LayersEditor.prototype.cleanupDOMEventListeners = function () {
		if ( this.eventTracker ) {
			this.eventTracker.destroy();
			this.eventTracker = window.EventTracker ? new window.EventTracker() : null;
		}
	};

	/**
	 * Track event listeners for cleanup
	 * @param {Element} element DOM element
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 * @param {Object} options Event listener options
	 */
	LayersEditor.prototype.trackEventListener = function ( element, event, handler, options ) {
		if ( this.eventTracker ) {
			this.eventTracker.add( element, event, handler, options );
		} else {
			element.addEventListener( event, handler, options );
		}
	};

	/**
	 * Track window event listeners
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 * @param {Object} options Event listener options
	 */
	LayersEditor.prototype.trackWindowListener = function ( event, handler, options ) {
		if ( this.eventTracker ) {
			this.eventTracker.add( window, event, handler, options );
		} else {
			window.addEventListener( event, handler, options );
		}
	};

	/**
	 * Track document event listeners
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 * @param {Object} options Event listener options
	 */
	LayersEditor.prototype.trackDocumentListener = function ( event, handler, options ) {
		if ( this.eventTracker ) {
			this.eventTracker.add( document, event, handler, options );
		} else {
			document.addEventListener( event, handler, options );
		}
	};

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.Editor = LayersEditor;

		// Backward compatibility - direct window export
		window.LayersEditor = LayersEditor;
	}

}() );
