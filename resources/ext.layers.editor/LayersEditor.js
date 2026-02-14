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
			// Minimal fallback - check namespace first, then global
			if ( namespacePath && typeof window !== 'undefined' && window.Layers ) {
				const parts = namespacePath.split( '.' );
				let obj = window.Layers;
				for ( const part of parts ) {
					obj = obj && obj[ part ];
				}
				if ( obj ) {
					return obj;
				}
			}
			return window[ globalName ] || null;
		};

	// Resolve commonly used classes
	const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
	const EditorBootstrap = window.Layers && window.Layers.Core && window.Layers.Core.EditorBootstrap || window.EditorBootstrap;

	/**
	 * LayersEditor class - Main editor for MediaWiki Layers extension
	 */
class LayersEditor {
	/**
	 * Creates a new LayersEditor instance
	 *
	 * @param {Object} config - Configuration object
	 * @param {string} config.filename - Name of the file being edited
	 * @param {string} config.imageUrl - URL of the base image
	 * @param {HTMLElement} config.container - Container element for the editor
	 */
	constructor( config ) {
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
	 *
	 * @private
	 */
	initializeRegistry() {
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
			this.registry.register( 'HistoryManager', () => new HistoryManager( { editor: this } ), [] );
		}
	}

	/**
	 * Create a fallback registry when none is available
	 * @return {Object} Fallback registry
	 * @private
	 */
	createFallbackRegistry () {
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

		// Cache instances so repeated get() calls return the same object
		const instances = {};

		return {
			get: ( name ) => {
				if ( instances[ name ] ) {
					return instances[ name ];
				}
				const constructors = {
					UIManager: () => ( typeof UIManager === 'function' ) ? new UIManager( this ) : this.createStubUIManager(),
					EventManager: () => ( typeof EventManager === 'function' ) ? new EventManager( this ) : { setupGlobalHandlers: function () {}, destroy: function () {}, handleKeyDown: function () {} },
					APIManager: () => ( typeof APIManager === 'function' ) ? new APIManager( this ) : { loadLayers: function () { return Promise.resolve( {} ); }, saveLayers: function () { return Promise.resolve( {} ); }, destroy: function () {} },
					ValidationManager: () => ( typeof ValidationManager === 'function' ) ? new ValidationManager( this ) : { checkBrowserCompatibility: function () { return true; }, sanitizeLayerData: function ( d ) { return d; }, validateLayers: function () { return true; }, destroy: function () {} },
					StateManager: () => ( typeof StateManager === 'function' ) ? new StateManager( this ) : this.createStubStateManager(),
					HistoryManager: () => ( typeof HistoryManager === 'function' ) ? new HistoryManager( { editor: this } ) : { saveState: function () {}, updateUndoRedoButtons: function () {}, undo: function () { return true; }, redo: function () { return true; }, canUndo: function () { return false; }, canRedo: function () { return false; }, destroy: function () {} },
					Toolbar: () => ( typeof Toolbar === 'function' ) ? new Toolbar( { container: ( this.uiManager && this.uiManager.toolbarContainer ) || document.createElement( 'div' ), editor: this } ) : { destroy: function () {}, setActiveTool: function () {}, updateUndoRedoState: function () {}, updateDeleteState: function () {}, updateAlignmentButtons: function () {} },
					LayerPanel: () => ( typeof LayerPanel === 'function' ) ? new LayerPanel( { container: ( this.uiManager && this.uiManager.layerPanelContainer ) || document.createElement( 'div' ), editor: this } ) : { destroy: function () {}, selectLayer: function () {}, updateLayerList: function () {} },
					CanvasManager: () => ( typeof CanvasManager === 'function' ) ? new CanvasManager( { container: ( this.uiManager && this.uiManager.canvasContainer ) || document.createElement( 'div' ), editor: this, backgroundImageUrl: this.imageUrl } ) : { destroy: function () {}, renderLayers: function () {}, events: { destroy: function () {} } }
				};
				if ( constructors[ name ] ) {
					instances[ name ] = constructors[ name ]();
					return instances[ name ];
				}
				throw new Error( `Module ${name} not found` );
			}
		};
	}

	/**
	 * Create a stub UI manager
	 * @return {Object} Stub UI manager
	 * @private
	 */
	createStubUIManager () {
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
	}

	/**
	 * Create a stub state manager
	 * @return {Object} Stub state manager
	 * @private
	 */
	createStubStateManager () {
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
	}

	/**
	 * Initialize managers through registry
	 * @private
	 */
	initializeManagers () {
		this.uiManager = this.registry.get( 'UIManager' );
		this.eventManager = this.registry.get( 'EventManager' );
		this.apiManager = this.registry.get( 'APIManager' );
		this.validationManager = this.registry.get( 'ValidationManager' );
		this.stateManager = this.registry.get( 'StateManager' );

		// Ensure state manager is valid
		if ( !this.stateManager || typeof this.stateManager.set !== 'function' ) {
			this.stateManager = this.createStubStateManager();
		}

		// Initialize draft manager for auto-save and recovery
		const DraftManager = ( window.Layers && window.Layers.Editor &&
			window.Layers.Editor.DraftManager ) || window.DraftManager;
		if ( DraftManager ) {
			this.draftManager = new DraftManager( this );
		}
	}

	/**
	 * Initialize state through StateManager
	 * @private
	 */
	initializeState () {
		if ( this.stateManager && typeof this.stateManager.set === 'function' ) {
			this.stateManager.set( 'layers', [] );
			this.stateManager.set( 'selectedLayerIds', [] );
			this.stateManager.set( 'isDirty', false );
			this.stateManager.set( 'currentTool', 'pointer' );
			this.stateManager.set( 'baseWidth', null );
			this.stateManager.set( 'baseHeight', null );
			this.stateManager.set( 'allLayerSets', [] );
			this.stateManager.set( 'currentLayerSetId', null );
			// Named Layer Sets state - use initialSetName from config if provided
			this.stateManager.set( 'namedSets', [] );
			this.stateManager.set( 'currentSetName', this.config.initialSetName || 'default' );

			// Slide mode state - initialized from config
			this.stateManager.set( 'isSlide', this.config.isSlide || false );
			this.stateManager.set( 'slideName', this.config.slideName || null );
			if ( this.config.isSlide ) {
				// For slides, use config dimensions as base dimensions
				this.stateManager.set( 'slideCanvasWidth', this.config.canvasWidth || 800 );
				this.stateManager.set( 'slideCanvasHeight', this.config.canvasHeight || 600 );
				// Default to white background if not specified (matches server config LayersSlideDefaultBackground)
				this.stateManager.set( 'slideBackgroundColor', this.config.backgroundColor || '#ffffff' );
				this.stateManager.set( 'baseWidth', this.config.canvasWidth || 800 );
				this.stateManager.set( 'baseHeight', this.config.canvasHeight || 600 );
			}
		}
	}

	/**
	 * Define legacy layers property for backward compatibility
	 * @private
	 */
	defineLegacyLayersProperty () {
		Object.defineProperty( this, 'layers', {
			get: () => this.stateManager.getLayers(),
			set: ( layers ) => {
				if ( Array.isArray( layers ) ) {
					this.stateManager.set( 'layers', layers );
				}
			},
			enumerable: true,
			configurable: true
		} );

		// Alias 'container' to 'containerElement' for backward compatibility
		// Some components reference editor.container instead of editor.containerElement
		Object.defineProperty( this, 'container', {
			get: () => this.containerElement,
			enumerable: true,
			configurable: true
		} );
	}

	/**
	 * Subscribe to selection changes to update toolbar alignment buttons
	 * @private
	 */
	subscribeToSelectionChanges () {
		if ( !this.stateManager || typeof this.stateManager.subscribe !== 'function' ) {
			return;
		}
		// Subscribe to selection changes to update UI (alignment buttons, delete button)
		this.selectionUnsubscribe = this.stateManager.subscribe( 'selectedLayerIds', () => {
			this.updateUIState();
		} );
	}

	/**
	 * Initialize extracted managers (RevisionManager, DialogManager, GroupManager)
	 * @private
	 */
	initializeExtractedManagers () {
		// Initialize RevisionManager
		const RevisionManager = getClass( 'Core.RevisionManager', 'RevisionManager' );
		if ( typeof RevisionManager === 'function' ) {
			this.revisionManager = new RevisionManager( { editor: this } );
		}

		// Initialize DialogManager
		const DialogManager = getClass( 'UI.DialogManager', 'DialogManager' );
		if ( typeof DialogManager === 'function' ) {
			this.dialogManager = new DialogManager( { editor: this } );
		}

		// Initialize GroupManager for layer grouping
		const GroupManager = getClass( 'Core.GroupManager', 'GroupManager' );
		if ( typeof GroupManager === 'function' ) {
			this.groupManager = new GroupManager( { editor: this } );
		}
	}

	/**
	 * Debug logging utility
	 * @param {...*} args Arguments to log
	 */
	debugLog ( ...rawArgs ) {
		if ( this.debug && mw.log ) {
			const sanitizedArgs = rawArgs
				.map( ( arg ) => this.sanitizeLogMessage( arg ) );
			mw.log( ...sanitizedArgs );
		}
	}

	/**
	 * Error logging utility
	 * @param {...*} args Arguments to log
	 */
	errorLog ( ...rawArgs ) {
		const sanitizedArgs = rawArgs
			.map( ( arg ) => this.sanitizeLogMessage( arg ) );
		if ( mw.log ) {
			mw.log.error( ...sanitizedArgs );
		}
	}

	/**
	 * Sanitize log messages to prevent sensitive information disclosure
	 * @param {*} message The message to sanitize
	 * @return {*} Sanitized message
	 */
	sanitizeLogMessage ( message ) {
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
	}

	/**
	 * Render layers on canvas (bridge method)
	 * @param {Array} layers Optional array of layers to render
	 */
	renderLayers ( layers ) {
		if ( this.canvasManager && typeof this.canvasManager.renderLayers === 'function' ) {
			this.canvasManager.renderLayers( layers || this.stateManager.getLayers() );
		}
	}

	/**
	 * Check if editor has unsaved changes
	 * @return {boolean} True if there are unsaved changes
	 */
	isDirty () {
		return this.stateManager.isDirty();
	}

	/**
	 * Mark editor as having unsaved changes
	 */
	markDirty () {
		this.stateManager.setDirty( true );
	}

	/**
	 * Mark editor as clean (no unsaved changes)
	 */
	markClean () {
		this.stateManager.setDirty( false );
	}

	/**
	 * Undo last action
	 * @return {boolean} True if undo was successful
	 */
	undo () {
		if ( this.historyManager && typeof this.historyManager.undo === 'function' ) {
			return this.historyManager.undo();
		}
		return false;
	}

	/**
	 * Redo last undone action
	 * @return {boolean} True if redo was successful
	 */
	redo () {
		if ( this.historyManager && typeof this.historyManager.redo === 'function' ) {
			return this.historyManager.redo();
		}
		return false;
	}

	/**
	 * Initialize the editor
	 */
	init () {
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
		const LayerSetManagerClass = getClass( 'Core.LayerSetManager', 'LayerSetManager' );
		if ( typeof LayerSetManagerClass === 'function' ) {
			this.layerSetManager = new LayerSetManagerClass( {
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
	}

	/**
	 * Initialize UI components (toolbar, layer panel, canvas)
	 * @private
	 */
	initializeUIComponents () {
		// Register UI component factories using namespaced classes
		const ToolbarClass = getClass( 'UI.Toolbar', 'Toolbar' );
		const LayerPanelClass = getClass( 'UI.LayerPanel', 'LayerPanel' );
		const CanvasManagerClass = getClass( 'Canvas.Manager', 'CanvasManager' );

		if ( this.registry.register ) {
			this.registry.register( 'Toolbar', () => new ToolbarClass( {
				container: this.uiManager.toolbarContainer,
				editor: this
			} ), [] );
			this.registry.register( 'LayerPanel', () => new LayerPanelClass( {
				container: this.uiManager.layerPanelContainer,
				editor: this
			} ), [] );
			this.registry.register( 'CanvasManager', () => new CanvasManagerClass( {
				container: this.uiManager.canvasContainer,
				editor: this,
				backgroundImageUrl: this.imageUrl,
				isSlide: this.stateManager.get( 'isSlide' ) || false
			} ), [] );
		}

		// Initialize components
		this.toolbar = this.registry.get( 'Toolbar' );
		this.layerPanel = this.registry.get( 'LayerPanel' );
		this.canvasManager = this.registry.get( 'CanvasManager' );

		// Configure slide mode if applicable
		if ( this.stateManager.get( 'isSlide' ) && this.canvasManager ) {
			const slideWidth = this.stateManager.get( 'slideCanvasWidth' ) || 800;
			const slideHeight = this.stateManager.get( 'slideCanvasHeight' ) || 600;
			const slideBackgroundColor = this.stateManager.get( 'slideBackgroundColor' ) || 'transparent';

			// Set canvas dimensions for slide
			this.canvasManager.setBaseDimensions( slideWidth, slideHeight );
			// Enable slide mode (no background image)
			this.canvasManager.setSlideMode( true );
			// Set slide background color
			this.canvasManager.setBackgroundColor( slideBackgroundColor );

			this.debugLog( '[LayersEditor] Slide mode configured: ' +
				slideWidth + 'x' + slideHeight + ', bg=' + slideBackgroundColor );
		}

		// Subscribe to selection changes to update toolbar alignment buttons
		this.subscribeToSelectionChanges();

		this.debugLog( '[LayersEditor] UI components initialized' );
	}

	/**
	 * Load initial layers from API
	 * If config.initialSetName is provided (deep link), load that specific set
	 * If config.autoCreate is true and the set doesn't exist, auto-create it
	 * @private
	 */
	loadInitialLayers () {
		// Check for deep link: load specific set if initialSetName is provided
		const initialSetName = this.config.initialSetName;
		const autoCreate = this.config.autoCreate || false;
		const loadPromise = initialSetName
			? this.apiManager.loadLayersBySetName( initialSetName )
			: this.apiManager.loadLayers();

		if ( initialSetName ) {
			this.debugLog( '[LayersEditor] Loading initial set via deep link:', initialSetName,
				autoCreate ? '(autoCreate enabled)' : '' );
		}

		loadPromise.then( ( data ) => {
			if ( this.isDestroyed ) {
				return;
			}

			this.debugLog( '[LayersEditor] API loadLayers completed' );

			// Check if we need to auto-create the set
			// This happens when autoCreate is true and no layerset was returned
			const needsAutoCreate = autoCreate && initialSetName &&
				( !data || !data.currentLayerSetId );

			if ( needsAutoCreate ) {
				this.debugLog( '[LayersEditor] Set does not exist, auto-creating:', initialSetName );
				this.autoCreateLayerSet( initialSetName );
				return; // autoCreateLayerSet will handle the rest
			}

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

			// Check for unsaved draft recovery (async, doesn't block UI)
			if ( this.draftManager && typeof this.draftManager.checkAndRecoverDraft === 'function' ) {
				this.draftManager.checkAndRecoverDraft().catch( ( err ) => {
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.warn( '[LayersEditor] Draft recovery check failed:', err );
					}
				} );
			}

			// Use saveInitialState to clear any premature history entries
			// and establish correct baseline for undo/redo
			if ( this.historyManager && typeof this.historyManager.saveInitialState === 'function' ) {
				this.historyManager.saveInitialState();
			} else {
				this.saveState( 'initial' );
			}
		} ).catch( ( error ) => {
			if ( this.isDestroyed ) {
				return;
			}
			this.debugLog( '[LayersEditor] API loadLayers failed:', error );

			// If autoCreate is enabled and we failed to load, try to auto-create
			if ( autoCreate && initialSetName ) {
				this.debugLog( '[LayersEditor] Load failed, attempting auto-create:', initialSetName );
				this.autoCreateLayerSet( initialSetName );
				return;
			}

			this.stateManager.set( 'layers', [] );
			if ( this.canvasManager ) {
				this.canvasManager.renderLayers( [] );
			}
			// Use saveInitialState to clear any premature history entries
			if ( this.historyManager && typeof this.historyManager.saveInitialState === 'function' ) {
				this.historyManager.saveInitialState();
			} else {
				this.saveState( 'initial' );
			}
		} );
	}

	/**
	 * Auto-create a new layer set when opened via deep link
	 * This is called when config.autoCreate is true and the requested set doesn't exist
	 * @param {string} setName - Name of the set to create
	 * @private
	 */
	autoCreateLayerSet ( setName ) {
		this.debugLog( '[LayersEditor] Auto-creating layer set:', setName );

		// Use the LayerSetManager if available (preferred)
		if ( this.layerSetManager && typeof this.layerSetManager.createNewLayerSet === 'function' ) {
			this.layerSetManager.createNewLayerSet( setName ).then( ( success ) => {
				if ( success ) {
					this.showAutoCreateNotification( setName );
				}
				this.finalizeInitialState();
			} ).catch( ( err ) => {
				// Log error but continue - show empty editor
				this.debugWarn( '[LayersEditor] Auto-create failed:', err );
				this.finalizeInitialState();
			} );
			return;
		}

		// Fallback: manually create the set state
		this.stateManager.set( 'layers', [] );
		this.stateManager.set( 'currentSetName', setName );
		this.stateManager.set( 'currentLayerSetId', null );
		this.stateManager.set( 'hasUnsavedChanges', true );

		// Add to named sets list (use immutable pattern for state tracking)
		const existingNamedSets = this.stateManager.get( 'namedSets' ) || [];
		const userName = mw.config.get( 'wgUserName' ) || 'Anonymous';
		const updatedNamedSets = [ ...existingNamedSets, {
			name: setName,
			revision_count: 0,
			latest_revision: null,
			latest_timestamp: null,
			latest_user_name: userName
		} ];
		this.stateManager.set( 'namedSets', updatedNamedSets );

		// Update UI
		if ( this.canvasManager ) {
			this.canvasManager.renderLayers( [] );
		}

		// Update selectors
		this.buildSetSelector();
		this.buildRevisionSelector();

		// Show notification
		this.showAutoCreateNotification( setName );

		// Finalize initial state
		this.finalizeInitialState();
	}

	/**
	 * Show notification that a layer set was auto-created
	 * @param {string} setName - Name of the created set
	 * @private
	 */
	showAutoCreateNotification ( setName ) {
		if ( typeof mw !== 'undefined' && mw.notify ) {
			const message = mw.message( 'layers-set-auto-created', setName ).text();
			mw.notify( message, { type: 'info', autoHide: true, autoHideSeconds: 5 } );
		}
	}

	/**
	 * Finalize the initial state after loading or creating a set
	 * @private
	 */
	finalizeInitialState () {
		if ( this.historyManager && typeof this.historyManager.saveInitialState === 'function' ) {
			this.historyManager.saveInitialState();
		} else {
			this.saveState( 'initial' );
		}
		this.updateSaveButtonState();
	}

	/**
	 * Set up close button handler
	 * @private
	 */
	setupCloseButton () {
		const closeBtn = this.uiManager.container.querySelector( '.layers-header-close' );
		if ( closeBtn ) {
			const closeHandler = () => {
				this.cancel( true );
			};
			this.trackEventListener( closeBtn, 'click', closeHandler );
		}
	}

	/**
	 * Add a new layer to the editor
	 * @param {Object} layerData - Layer data object
	 */
	addLayer ( layerData ) {
		layerData = this.validationManager.sanitizeLayerData( layerData );
		layerData.id = this.apiManager.generateLayerId();
		layerData.visible = layerData.visible !== false;

		const layers = [ ...( this.stateManager.get( 'layers' ) || [] ) ];
		layers.unshift( layerData );
		this.stateManager.set( 'layers', layers );

		if ( this.canvasManager ) {
			this.canvasManager.renderLayers( layers );
		}
		this.markDirty();
		this.selectLayer( layerData.id );
		this.saveState( 'Add layer' );
	}

	/**
	 * Add a new layer without selecting it
	 * Used for marker auto-number mode where the tool should stay active
	 * @param {Object} layerData - Layer data object
	 */
	addLayerWithoutSelection ( layerData ) {
		layerData = this.validationManager.sanitizeLayerData( layerData );
		layerData.id = this.apiManager.generateLayerId();
		layerData.visible = layerData.visible !== false;

		const layers = [ ...( this.stateManager.get( 'layers' ) || [] ) ];
		layers.unshift( layerData );
		this.stateManager.set( 'layers', layers );

		if ( this.canvasManager ) {
			this.canvasManager.renderLayers( layers );
		}
		// Update layer panel without selecting the new layer
		if ( this.layerPanel ) {
			this.layerPanel.updateLayerList( layers );
		}
		this.markDirty();
		this.saveState( 'Add layer' );
	}

	/**
	 * Create a custom shape layer from shape library data
	 *
	 * Supports both single-path shapes (legacy) and multi-path compound shapes.
	 * Multi-path shapes (like safety signs) have colors baked into the path data.
	 *
	 * @param {Object} shapeData - Shape data from the shape library
	 * @param {string} shapeData.id - Shape ID (e.g., 'arrows/right')
	 * @param {string} [shapeData.svg] - Complete SVG markup string (new format)
	 * @param {string} [shapeData.path] - SVG path data (single-path shapes)
	 * @param {Array} [shapeData.paths] - Multi-path array [{path, fill, stroke}]
	 * @param {number[]} shapeData.viewBox - ViewBox [x, y, width, height]
	 * @param {string} [shapeData.nameKey] - i18n key for shape name
	 */
	createCustomShapeLayer ( shapeData ) {
		// Validate: need svg, path, or paths array
		const hasSvg = shapeData && shapeData.svg;
		const hasPath = shapeData && shapeData.path;
		const hasPaths = shapeData && shapeData.paths && Array.isArray( shapeData.paths );

		if ( !shapeData || !shapeData.viewBox || ( !hasSvg && !hasPath && !hasPaths ) ) {
			if ( this.debug ) {
				this.errorLog( 'createCustomShapeLayer: Invalid shape data', shapeData );
			}
			return;
		}

		const viewBox = shapeData.viewBox;
		const viewBoxWidth = viewBox[ 2 ];
		const viewBoxHeight = viewBox[ 3 ];

		// Get canvas center for placement
		const canvasEl = this.canvasManager ? this.canvasManager.canvas : null;
		const canvasWidth = canvasEl ? canvasEl.width : 800;
		const canvasHeight = canvasEl ? canvasEl.height : 600;

		// Calculate position accounting for zoom/pan
		let centerX = canvasWidth / 2;
		let centerY = canvasHeight / 2;

		if ( this.canvasManager ) {
			// zoom, panX, panY are stored directly on canvasManager, not on zoomPanController
			const zoom = this.canvasManager.zoom || 1;
			const panX = this.canvasManager.panX || 0;
			const panY = this.canvasManager.panY || 0;
			// Convert canvas center to world coordinates
			centerX = ( centerX - panX ) / zoom;
			centerY = ( centerY - panY ) / zoom;
		}

		// Default size (scale to ~100px while preserving aspect ratio)
		const targetSize = 100;
		const aspectRatio = viewBoxWidth / viewBoxHeight;
		let width, height;

		if ( aspectRatio >= 1 ) {
			width = targetSize;
			height = targetSize / aspectRatio;
		} else {
			height = targetSize;
			width = targetSize * aspectRatio;
		}

		// Create the layer data
		const layerData = {
			type: 'customShape',
			shapeId: shapeData.id,
			viewBox: shapeData.viewBox,
			x: centerX - width / 2,
			y: centerY - height / 2,
			width: width,
			height: height,
			name: shapeData.nameKey ?
				this.getMessage( shapeData.nameKey, shapeData.id.split( '/' ).pop() ) :
				shapeData.id.split( '/' ).pop()
		};

		// Handle multi-path vs single-path vs SVG shapes
		if ( hasSvg ) {
			// New SVG format - store the complete SVG markup
			layerData.svg = shapeData.svg;

			// Get current style settings from toolbar for stroke color only
			let toolbarStroke = '#000000';

			if ( this.toolbar && this.toolbar.styleControls ) {
				const styleOpts = this.toolbar.styleControls.getStyleOptions();
				toolbarStroke = styleOpts.stroke || styleOpts.color || toolbarStroke;
			}

			// Use shape's default colors or toolbar settings
			// NOTE: We do NOT set strokeWidth for SVG shapes - the stroke widths are
			// baked into the SVG and scale correctly with the viewBox.
			layerData.stroke = shapeData.defaultStroke || toolbarStroke;
			layerData.fill = shapeData.defaultFill || 'none';
		} else if ( hasPaths ) {
			// Multi-path compound shapes (e.g., safety signs)
			// Colors are baked into the paths array - don't override with toolbar
			layerData.paths = shapeData.paths;
			layerData.isMultiPath = true;
		} else {
			// Single-path shapes (legacy format)
			layerData.path = shapeData.path;
			layerData.strokeOnly = shapeData.strokeOnly || false;
			layerData.fillRule = shapeData.fillRule || 'nonzero';

			// Get current style settings from toolbar as fallbacks
			let toolbarStroke = '#000000';
			let toolbarFill = 'transparent';
			let toolbarStrokeWidth = 2;

			if ( this.toolbar && this.toolbar.styleControls ) {
				const styleOpts = this.toolbar.styleControls.getStyleOptions();
				toolbarStroke = styleOpts.stroke || styleOpts.color || toolbarStroke;
				toolbarFill = styleOpts.fill || toolbarFill;
				toolbarStrokeWidth = styleOpts.strokeWidth || toolbarStrokeWidth;
			}

			// Determine fill and stroke based on shape type
			// Priority: shape defaults > toolbar settings > hardcoded defaults
			let stroke, fill, strokeWidth;

			if ( shapeData.strokeOnly ) {
				// Stroke-only icons: no fill, use shape's stroke color or toolbar
				fill = 'transparent';
				stroke = shapeData.defaultStroke || toolbarStroke;
				strokeWidth = shapeData.strokeWidth || toolbarStrokeWidth;
			} else {
				// Filled shapes: use shape's default colors if provided
				fill = shapeData.defaultFill || toolbarFill;
				stroke = shapeData.defaultStroke || toolbarStroke;
				strokeWidth = toolbarStrokeWidth;
			}

			layerData.stroke = stroke;
			layerData.fill = fill;
			layerData.strokeWidth = strokeWidth;
		}

		this.addLayer( layerData );

		// Switch to pointer tool after adding shape so user can interact with it
		this.setCurrentTool( 'pointer' );
	}

	/**
	 * Update an existing layer with new data
	 * @param {string} layerId - ID of the layer to update
	 * @param {Object} changes - Changes to apply to the layer
	 */
	updateLayer ( layerId, changes ) {
		try {
			if ( Object.prototype.hasOwnProperty.call( changes, 'outerRadius' ) &&
				!Object.prototype.hasOwnProperty.call( changes, 'radius' ) ) {
				changes.radius = changes.outerRadius;
			}

			changes = this.validationManager.sanitizeLayerData( changes );

			// Note: We previously had code here to clear text/richText during inline editing,
			// but it was causing data loss during property changes (like verticalAlign).
			// The InlineTextEditor now handles this internally - it clears text when editing
			// starts and restores/saves it when editing finishes.

			const layers = this.stateManager.get( 'layers' ) || [];
			const layerIndex = layers.findIndex( ( l ) => l.id === layerId );
			if ( layerIndex !== -1 ) {
				// Use immutable update pattern - create new layer object and new array
				const updatedLayer = { ...layers[ layerIndex ], ...changes };
				const updatedLayers = [
					...layers.slice( 0, layerIndex ),
					updatedLayer,
					...layers.slice( layerIndex + 1 )
				];
				this.stateManager.set( 'layers', updatedLayers );

				// Throttle redraw to prevent canvas crashes during rapid property changes
				if ( !this._updateLayerRenderScheduled ) {
					this._updateLayerRenderScheduled = true;
					window.requestAnimationFrame( () => {
						this._updateLayerRenderScheduled = false;
						if ( this.canvasManager ) {
							this.canvasManager.redraw();
						}
					} );
				}
				this.markDirty();
				this.saveState( 'Update layer' );
			}
		} catch ( error ) {
			if ( this.debug ) {
				this.errorLog( 'Error in updateLayer:', error );
			}
			if ( window.mw && window.mw.notify ) {
				mw.notify( 'Error updating layer', { type: 'error' } );
			}
		}
	}

	/**
	 * Remove a layer from the editor
	 * @param {string} layerId - ID of the layer to remove
	 */
	removeLayer ( layerId ) {
		const layers = this.stateManager.get( 'layers' ) || [];
		const updatedLayers = layers.filter( ( layer ) => layer.id !== layerId );
		this.stateManager.set( 'layers', updatedLayers );

		if ( this.canvasManager ) {
			this.canvasManager.redraw();
		}
		this.markDirty();
		this.updateUIState();
		this.saveState( 'Remove layer' );
	}

	/**
	 * Get a layer by its ID
	 * @param {string} layerId - ID of the layer
	 * @return {Object|undefined} The layer object or undefined
	 */
	getLayerById ( layerId ) {
		const layers = this.stateManager.get( 'layers' ) || [];
		return layers.find( ( layer ) => layer.id === layerId );
	}

	// ============================================
	// Revision Management - Delegate to RevisionManager
	// ============================================

	/**
	 * Parse MediaWiki binary(14) timestamp format
	 * @param {string} mwTimestamp MediaWiki timestamp string
	 * @return {Date} Parsed date object
	 */
	parseMWTimestamp ( mwTimestamp ) {
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
	}

	/**
	 * Build the revision selector dropdown
	 */
	buildRevisionSelector () {
		if ( this.revisionManager ) {
			this.revisionManager.buildRevisionSelector();
		}
	}

	/**
	 * Update the revision load button state
	 */
	updateRevisionLoadButton () {
		if ( this.revisionManager ) {
			this.revisionManager.updateRevisionLoadButton();
		}
	}

	/**
	 * Build and populate the named layer sets selector
	 */
	buildSetSelector () {
		if ( this.revisionManager ) {
			this.revisionManager.buildSetSelector();
		}
	}

	/**
	 * Update the new set button state
	 */
	updateNewSetButtonState () {
		if ( this.revisionManager ) {
			this.revisionManager.updateNewSetButtonState();
		}
	}

	/**
	 * Load a layer set by name
	 *
	 * @param {string} setName The name of the set to load
	 * @return {Promise<void>}
	 */
	async loadLayerSetByName( setName ) {
		if ( this.revisionManager ) {
			return this.revisionManager.loadLayerSetByName( setName );
		}
	}

	/**
	 * Create a new named layer set
	 *
	 * @param {string} setName The name for the new set
	 * @return {Promise<boolean>}
	 */
	async createNewLayerSet( setName ) {
		if ( this.revisionManager ) {
			return this.revisionManager.createNewLayerSet( setName );
		}
		return false;
	}

	/**
	 * Load a specific revision by ID
	 *
	 * @param {number} revisionId The revision ID to load
	 */
	loadRevisionById( revisionId ) {
		if ( this.revisionManager ) {
			this.revisionManager.loadRevisionById( revisionId );
		}
	}

	/**
	 * Show the keyboard shortcuts help dialog
	 */
	showKeyboardShortcutsDialog() {
		if ( this.dialogManager ) {
			this.dialogManager.showKeyboardShortcutsDialog();
		}
	}

	/**
	 * Show the built-in help dialog
	 */
	showHelpDialog() {
		const HelpDialog = window.Layers && window.Layers.UI && window.Layers.UI.HelpDialog;
		if ( HelpDialog ) {
			if ( !this.helpDialog ) {
				this.helpDialog = new HelpDialog();
			}
			this.helpDialog.show();
		} else if ( this.dialogManager ) {
			// Fallback to shortcuts dialog if HelpDialog not loaded
			this.debugLog( '[Layers] HelpDialog not found, falling back to shortcuts dialog' );
			this.dialogManager.showKeyboardShortcutsDialog();
		} else {
			this.debugLog( '[Layers] Neither HelpDialog nor dialogManager available' );
		}
	}

	/**
	 * Check if there are unsaved changes
	 * @return {boolean}
	 */
	hasUnsavedChanges () {
		return this.stateManager.get( 'hasUnsavedChanges' ) || false;
	}

	/**
	 * Update the save button state
	 */
	updateSaveButtonState () {
		try {
			if ( this.toolbar && this.toolbar.saveBtnEl ) {
				const hasChanges = this.hasUnsavedChanges();
				this.toolbar.saveBtnEl.classList.toggle( 'has-changes', hasChanges );
			}
		} catch ( error ) {
			this.errorLog( 'Error updating save button state:', error );
		}
	}

	/**
	 * Get a localized message
	 * @param {string} key Message key
	 * @param {string} fallback Fallback text
	 * @return {string} Localized message
	 */
	getMessage ( key, fallback = '' ) {
		if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
			return window.layersMessages.get( key, fallback );
		}
		return fallback;
	}

	/**
	 * Set the current tool
	 * @param {string} tool Tool name
	 * @param {Object} options Options
	 */
	setCurrentTool ( tool, options ) {
		const opts = options || {};
		this.stateManager.set( 'currentTool', tool );
		if ( this.canvasManager ) {
			this.canvasManager.setTool( tool );
		}
		if ( this.toolbar && !opts.skipToolbarSync ) {
			this.toolbar.setActiveTool( tool );
		}
	}

	/**
	 * Save state for undo/redo
	 * @param {string} action Action description
	 */
	saveState ( action ) {
		if ( this.historyManager ) {
			this.historyManager.saveState( action );
		}
	}

	/**
	 * Select a layer by ID
	 * @param {string} layerId Layer ID to select
	 */
	selectLayer ( layerId ) {
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
	}

	/**
	 * Delete the selected layer
	 */
	deleteSelected () {
		const selectedIds = this.getSelectedLayerIds();
		if ( selectedIds.length > 0 ) {
			// Filter out locked layers - they cannot be deleted
			const deletableIds = selectedIds.filter( id => {
				const layer = this.getLayerById( id );
				return layer && !this.isLayerEffectivelyLocked( layer );
			} );

			// If all selected layers are locked, show warning
			if ( deletableIds.length === 0 && selectedIds.length > 0 ) {
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						mw.message( 'layers-layer-locked-warning' ).text() ||
							'Cannot modify a locked layer',
						{ type: 'warn' }
					);
				}
				return;
			}

			// Delete only unlocked layers
			deletableIds.forEach( id => this.removeLayer( id ) );
			// Clear selection through CanvasManager (updates StateManager)
			if ( this.canvasManager ) {
				this.canvasManager.deselectAll();
			}
		}
	}

	/**
	 * Check if a layer is effectively locked (directly or via parent folder)
	 *
	 * @param {Object} layer - Layer to check
	 * @return {boolean} True if layer is locked or in a locked folder
	 */
	isLayerEffectivelyLocked ( layer ) {
		if ( !layer ) {
			return false;
		}

		// Check if layer is directly locked
		if ( layer.locked === true ) {
			return true;
		}

		// Check if any parent folder is locked
		let parentId = layer.parentGroup;
		const layers = this.layers || [];
		const visited = new Set();

		while ( parentId && !visited.has( parentId ) ) {
			visited.add( parentId );
			const parent = layers.find( l => l.id === parentId );
			if ( !parent ) {
				break;
			}
			if ( parent.locked === true ) {
				return true;
			}
			parentId = parent.parentGroup;
		}

		return false;
	}

	/**
	 * Duplicate the selected layer(s)
	 */
	duplicateSelected () {
		const selectedIds = this.getSelectedLayerIds();
		if ( selectedIds.length > 0 ) {
			const newIds = [];
			// Duplicate all selected layers, not just the last one
			for ( const layerId of selectedIds ) {
				const layer = this.getLayerById( layerId );
				if ( layer ) {
					const duplicate = JSON.parse( JSON.stringify( layer ) );
					duplicate.x = ( duplicate.x || 0 ) + 20;
					duplicate.y = ( duplicate.y || 0 ) + 20;
					delete duplicate.id;
					this.addLayer( duplicate );
					if ( duplicate.id ) {
						newIds.push( duplicate.id );
					}
				}
			}
			// Select the newly duplicated layers
			if ( newIds.length > 0 && this.canvasManager &&
				typeof this.canvasManager.setSelectedLayerIds === 'function' ) {
				this.canvasManager.setSelectedLayerIds( newIds );
			}
		}
	}

	/**
	 * Update UI state (toolbar buttons, etc.)
	 */
	updateUIState () {
		try {
			if ( this.toolbar ) {
				const canUndo = this.historyManager ? this.historyManager.canUndo() : false;
				const canRedo = this.historyManager ? this.historyManager.canRedo() : false;
				const selectedIds = this.getSelectedLayerIds();
				const hasSelection = selectedIds.length > 0;
				this.toolbar.updateUndoRedoState( canUndo, canRedo );
				this.toolbar.updateDeleteState( hasSelection );
				// Update alignment buttons based on selection count
				if ( typeof this.toolbar.updateAlignmentButtons === 'function' ) {
					this.toolbar.updateAlignmentButtons( selectedIds.length );
				}
			}
		} catch ( error ) {
			if ( this.debug ) {
				this.errorLog( 'Error in updateUIState:', error );
			}
		}
	}

	/**
	 * Apply a mutator function to all selected layers
	 * @param {Function} mutator Function to apply to each layer
	 */
	applyToSelection ( mutator ) {
		if ( typeof mutator !== 'function' ) {
			return;
		}
		const ids = this.getSelectedLayerIds();
		if ( !ids.length ) {
			return;
		}
		// Shallow-clone selected layers to avoid mutating state in-place
		const layers = ( this.stateManager.get( 'layers' ) || [] ).map(
			( l ) => ids.includes( l.id ) ? { ...l } : l
		);
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
		this.saveState( 'Update selection' );
	}

	/**
	 * Get selected layer IDs
	 * @return {string[]} Array of selected layer IDs
	 */
	getSelectedLayerIds () {
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
	}

	/**
	 * Navigate back to file page
	 */
	navigateBackToFile () {
		this.navigateBackToFileWithName( this.filename );
	}

	/**
	 * Navigate back to file page with specific filename
	 * @param {string} filename The filename to navigate to
	 * @private
	 */
	navigateBackToFileWithName ( filename ) {
		try {
			// Check if we're in modal mode - use postMessage to close
			const isModalMode = mw && mw.config && mw.config.get( 'wgLayersIsModalMode' );
			if ( isModalMode && window.parent !== window ) {
				const hasSaved = !this.stateManager.get( 'isDirty' );
				window.parent.postMessage( {
					type: 'layers-editor-close',
					saved: hasSaved,
					filename: filename
				}, window.location.origin );
				return;
			}

			// Check for returnto URL (editor-return mode)
			const returnToUrl = mw && mw.config && mw.config.get( 'wgLayersReturnToUrl' );
			if ( returnToUrl ) {
				window.location.href = returnToUrl;
				return;
			}

			// For slides, navigate back to the referring page or Special:Slides
			// Slides don't have a File: page, so we use history.back() by default
			const isSlide = this.stateManager && this.stateManager.get( 'isSlide' );
			if ( isSlide ) {
				// IMPORTANT: In modal mode, the postMessage above already handled closing.
				// This code only runs in non-modal mode (direct URL navigation).
				
				// Use history.back() to return to the page that opened the editor
				// This handles: embedded slides, Special:Slides, and any other context
				if ( window.history && window.history.length > 1 ) {
					window.history.back();
					return;
				}
				// Fallback: go to Special:Slides if no history
				if ( mw && mw.util && typeof mw.util.getUrl === 'function' ) {
					window.location.href = mw.util.getUrl( 'Special:Slides' );
					return;
				}
				window.location.reload();
				return;
			}

			// Default: navigate to File: page with layers=on to trigger layer viewer
			if ( filename && mw && mw.util && typeof mw.util.getUrl === 'function' ) {
				// Include layers=on so initializeFilePageFallback() fetches and displays layers
				const url = mw.util.getUrl( 'File:' + filename, { layers: 'on' } );
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
	}

	/**
	 * Save the current layers to the server
	 */
	save () {
		// Debug logging (controlled by extension config)
		const debug = typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' );

		// If inline text editing is active, finish it first to capture the current content
		// Otherwise the layer would be saved with empty text (editing state)
		if ( this.canvasManager &&
			this.canvasManager.inlineTextEditor &&
			this.canvasManager.inlineTextEditor.isActive() ) {
			if ( debug && mw.log ) {
				mw.log( '[LayersEditor] Finishing inline editing before save' );
			}
			this.canvasManager.inlineTextEditor.finishEditing( true );
		}

		const layers = this.stateManager.get( 'layers' ) || [];

		// Debug: log textbox layers to verify text was captured
		if ( debug && mw.log ) {
			const textboxLayers = layers.filter( l => l.type === 'textbox' || l.type === 'callout' );
			mw.log( '[LayersEditor] Saving layers', {
				totalLayers: layers.length,
				textboxCount: textboxLayers.length,
				textboxDetails: textboxLayers.map( l => ( {
					id: l.id,
					text: l.text,
					hasRichText: !!l.richText,
					richTextLength: l.richText ? l.richText.length : 0
				} ) )
			} );
		}

		const validationResult = this.validationManager.validateLayers( layers );
		
		if ( validationResult && !validationResult.isValid ) {
			const validationMsg = window.layersMessages ?
				window.layersMessages.get( 'layers-save-validation-error', 'Layer validation failed' ) :
				'Layer validation failed';
			mw.notify( validationMsg + ': ' + ( validationResult.errors || [] ).join( '; ' ), { type: 'error' } );
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
				const errorMsg = error.info || error.message || defaultErrorMsg;
				mw.notify( errorMsg, { type: 'error' } );
			} );
	}

	/**
	 * Reload the revision selector after saving
	 */
	reloadRevisions () {
		try {
			if ( this.apiManager && this.apiManager.reloadRevisions ) {
				this.apiManager.reloadRevisions();
			}
		} catch ( error ) {
			this.errorLog( 'Error in reloadRevisions:', error );
		}
	}

	/**
	 * Normalize layer visibility on load
	 * @param {Array} layers Array of layer objects
	 * @return {Array} Normalized layers
	 */
	normalizeLayers ( layers ) {
		if ( !layers || !Array.isArray( layers ) ) {
			return layers;
		}
		return layers.map( ( layer ) => {
			if ( layer.visible === undefined ) {
				return { ...layer, visible: true };
			}
			return layer;
		} );
	}

	/**
	 * Cancel editing and return to the file page
	 * @param {boolean} navigateBack Whether to navigate back
	 */
	cancel ( navigateBack ) {
		const savedFilename = this.filename;
		const isDirty = this.stateManager.get( 'isDirty' );

		if ( isDirty ) {
			// Use DialogManager if available
			if ( this.dialogManager ) {
				this.dialogManager.showCancelConfirmDialog( () => {
					if ( this.stateManager ) {
						this.stateManager.set( 'isDirty', false );
					}
					// Clear draft when user confirms discarding changes
					if ( this.draftManager ) {
						this.draftManager.clearDraft();
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
				// Fallback to window.confirm when DialogManager unavailable
				// eslint-disable-next-line no-alert
				if ( window.confirm( mw.message( 'layers-cancel-confirm' ).text() ) ) {
					if ( this.stateManager ) {
						this.stateManager.set( 'isDirty', false );
					}
					if ( this.draftManager ) {
						this.draftManager.clearDraft();
					}
					if ( this.eventManager && typeof this.eventManager.destroy === 'function' ) {
						this.eventManager.destroy();
					}
					this.uiManager.destroy();
					if ( navigateBack ) {
						this.navigateBackToFileWithName( savedFilename );
					}
				}
			}
		} else {
			// No unsaved changes - clear any stale draft and close
			if ( this.draftManager ) {
				this.draftManager.clearDraft();
			}
			this.uiManager.destroy();
			if ( navigateBack ) {
				this.navigateBackToFileWithName( savedFilename );
			}
		}
	}

	/**
	 * Handle keyboard shortcuts
	 * @param {KeyboardEvent} e Keyboard event
	 * @private
	 */
	handleKeyDown ( e ) {
		this.eventManager.handleKeyDown( e );
	}

	/**
	 * Destroy the editor and clean up resources
	 */
	destroy () {
		if ( this.isDestroyed ) {
			return;
		}
		this.isDestroyed = true;

		// Clean up selection subscription
		if ( this.selectionUnsubscribe && typeof this.selectionUnsubscribe === 'function' ) {
			this.selectionUnsubscribe();
			this.selectionUnsubscribe = null;
		}

		// Clean up event listeners
		this.cleanupGlobalEventListeners();

		// Clean up managers
		const managers = [
			'uiManager', 'eventManager', 'apiManager', 'validationManager',
			'stateManager', 'historyManager', 'layerSetManager',
			'revisionManager', 'dialogManager', 'draftManager'
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

		// Clean up help dialog
		if ( this.helpDialog && typeof this.helpDialog.close === 'function' ) {
			this.helpDialog.close();
		}
		this.helpDialog = null;

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
	}

	/**
	 * Clean up global event listeners
	 * @private
	 */
	cleanupGlobalEventListeners () {
		if ( this.eventTracker ) {
			this.eventTracker.removeAllForElement( window );
			this.eventTracker.removeAllForElement( document );
		}
	}

	/**
	 * Clean up DOM event listeners
	 * @private
	 */
	cleanupDOMEventListeners () {
		if ( this.eventTracker ) {
			this.eventTracker.destroy();
			this.eventTracker = EventTracker ? new EventTracker() : null;
		}
	}

	/**
	 * Track event listeners for cleanup
	 * @param {Element} element DOM element
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 * @param {Object} options Event listener options
	 */
	trackEventListener ( element, event, handler, options ) {
		if ( this.eventTracker ) {
			this.eventTracker.add( element, event, handler, options );
		} else {
			element.addEventListener( event, handler, options );
		}
	}

	/**
	 * Track window event listeners
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 * @param {Object} options Event listener options
	 */
	trackWindowListener ( event, handler, options ) {
		if ( this.eventTracker ) {
			this.eventTracker.add( window, event, handler, options );
		} else {
			window.addEventListener( event, handler, options );
		}
	}

	/**
	 * Track document event listeners
	 *
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 * @param {Object} options Event listener options
	 */
	trackDocumentListener( event, handler, options ) {
		if ( this.eventTracker ) {
			this.eventTracker.add( document, event, handler, options );
		} else {
			document.addEventListener( event, handler, options );
		}
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.Editor = LayersEditor;
	}

}() );
