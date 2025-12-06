/**
 * Main Layers Editor - manages the overall editing interface and coordinates between components
 */
( function () {
	'use strict';

	/**
	 * Validate that required dependencies are loaded before editor initialization.
	 * Logs warning if a critical dependency is missing but allows initialization to continue.
	 * This approach prevents complete editor failure while still alerting developers.
	 *
	 * @return {boolean} True if all dependencies are present, false otherwise
	 */
	function validateDependencies() {
		const missing = [];

		// Check required global classes
		const requiredClasses = [
			'UIManager', 'EventManager', 'APIManager', 'ValidationManager',
			'StateManager', 'HistoryManager', 'CanvasManager', 'Toolbar', 'LayerPanel'
		];
		requiredClasses.forEach( function ( name ) {
			if ( typeof window[ name ] !== 'function' ) {
				missing.push( name );
			}
		} );

		// Check LayersConstants (critical for configuration)
		if ( typeof window.LayersConstants === 'undefined' ) {
			missing.push( 'LayersConstants' );
		} else {
			// Validate critical constant groups exist
			const requiredConstantGroups = [ 'TOOLS', 'LAYER_TYPES', 'DEFAULTS', 'UI', 'LIMITS' ];
			requiredConstantGroups.forEach( function ( group ) {
				if ( !window.LayersConstants[ group ] ) {
					missing.push( 'LayersConstants.' + group );
				}
			} );
		}

		if ( missing.length > 0 ) {
			const errorMsg = 'Layers Editor: Missing dependencies: ' + missing.join( ', ' ) +
				'. Some features may not work correctly. Check ResourceLoader module order in extension.json.';
			if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( errorMsg );
			}
			return false;
		}
		return true;
	}

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
		// Validate dependencies before initialization
		validateDependencies();

		this.config = config || {};
		this.filename = this.config.filename;
		this.containerElement = this.config.container; // Optional legacy container
		this.canvasManager = null;
		this.layerPanel = null;
		this.toolbar = null;

		// Initialize EventTracker for memory-safe event listener management
		this.eventTracker = window.EventTracker ? new window.EventTracker() : null;
		this.isDestroyed = false;

		// Debug mode - check MediaWiki config first, then fallback to config
		this.debug = mw.config.get( 'wgLayersDebug' ) || this.config.debug || false;

		this.debugLog( '[LayersEditor] Constructor called with config:', this.config );
		this.debugLog( '[LayersEditor] Constructor config details:', {
			hasFilename: !!this.filename,
			hasContainer: !!this.containerElement,
			filename: this.filename,
			container: this.containerElement
		} );

		// Set image URL from config
		this.imageUrl = this.config.imageUrl;

		// Initialize module registry if not available
		// Prefer layersRegistry; layersModuleRegistry is deprecated
		this.registry = window.layersRegistry;
		if ( !this.registry && window.layersModuleRegistry ) {
			// Fallback to deprecated export with warning
			if ( this.debug && typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( '[LayersEditor] window.layersModuleRegistry is deprecated. Use window.layersRegistry instead.' );
			}
			this.registry = window.layersModuleRegistry;
		}
		if ( !this.registry ) {
			// Create a basic fallback registry
			this.registry = {
				get: ( name ) => {
					const constructors = {
						UIManager: () => ( typeof window.UIManager === 'function' ) ? new window.UIManager( this ) : ( function () {
							const stub = {};
							stub.container = document.createElement( 'div' );
							stub.toolbarContainer = document.createElement( 'div' );
							stub.layerPanelContainer = document.createElement( 'div' );
							stub.canvasContainer = document.createElement( 'div' );
							stub.createInterface = function () {};
							stub.destroy = function () {};
							return stub;
						} )(),
						EventManager: () => ( typeof window.EventManager === 'function' ) ? new window.EventManager( this ) : ( function () { return { setupGlobalHandlers: function () {}, destroy: function () {}, handleKeyDown: function () {} }; } )(),
						APIManager: () => ( typeof window.APIManager === 'function' ) ? new window.APIManager( this ) : ( function () { return { loadLayers: function () { return Promise.resolve( {} ); }, saveLayers: function () { return Promise.resolve( {} ); }, destroy: function () {} }; } )(),
						ValidationManager: () => ( typeof window.ValidationManager === 'function' ) ? new window.ValidationManager( this ) : ( function () { return { checkBrowserCompatibility: function () { return true; }, sanitizeLayerData: function ( d ) { return d; }, destroy: function () {} }; } )(),
						StateManager: () => ( typeof window.StateManager === 'function' ) ? new window.StateManager( this ) : ( function () {
							const store = {};
							const subs = {};
							return {
								set: function ( k, v ) { store[ k ] = v; },
								get: function ( k ) { return store[ k ]; },
								subscribe: function ( k, fn ) { subs[ k ] = subs[ k ] || []; subs[ k ].push( fn ); },
								setDirty: function () {},
								isDirty: function () { return false; },
								getLayers: function () { return store.layers || []; },
								destroy: function () { }
							};
						} )(),
						HistoryManager: () => ( typeof window.HistoryManager === 'function' ) ? new window.HistoryManager( this ) : ( function () { return { saveState: function () {}, updateUndoRedoButtons: function () {}, undo: function () { return true; }, redo: function () { return true; }, destroy: function () {} }; } )(),
						Toolbar: () => ( typeof window.Toolbar === 'function' ) ? new window.Toolbar( { container: ( this.uiManager && this.uiManager.toolbarContainer ) || document.createElement( 'div' ), editor: this } ) : ( function () { return { destroy: function () {}, setActiveTool: function () {}, updateUndoRedoState: function () {}, updateDeleteState: function () {} }; } )(),
						LayerPanel: () => ( typeof window.LayerPanel === 'function' ) ? new window.LayerPanel( { container: ( this.uiManager && this.uiManager.layerPanelContainer ) || document.createElement( 'div' ), editor: this } ) : ( function () { return { destroy: function () {}, selectLayer: function () {}, updateLayerList: function () {} }; } )(),
						CanvasManager: () => ( typeof window.CanvasManager === 'function' ) ? new window.CanvasManager( { container: ( this.uiManager && this.uiManager.canvasContainer ) || document.createElement( 'div' ), editor: this, backgroundImageUrl: this.imageUrl } ) : ( function () { return { destroy: function () {}, renderLayers: function () {}, events: { destroy: function () {} } }; } )()
					};
					if ( constructors[ name ] ) {
						return constructors[ name ]();
					}
					throw new Error( `Module ${name} not found` );
				}
			};
		}

		// Register manager factories with context
		if ( this.registry.register ) {
			this.registry.register( 'UIManager', () => new window.UIManager( this ), [] );
			this.registry.register( 'EventManager', () => new window.EventManager( this ), [] );
			this.registry.register( 'APIManager', () => new window.APIManager( this ), [] );
			this.registry.register( 'ValidationManager', () => new window.ValidationManager( this ), [] );
			this.registry.register( 'StateManager', () => new window.StateManager( this ), [] );
			this.registry.register( 'HistoryManager', () => new window.HistoryManager( this ), [] );
		}

		// Initialize managers through registry
		this.uiManager = this.registry.get( 'UIManager' );
		this.eventManager = this.registry.get( 'EventManager' );
		this.apiManager = this.registry.get( 'APIManager' );
		this.validationManager = this.registry.get( 'ValidationManager' );
		this.stateManager = this.registry.get( 'StateManager' );
		if ( !this.stateManager || typeof this.stateManager.set !== 'function' || typeof this.stateManager.get !== 'function' ) {
			// Ensure a safe default stateManager is present to avoid runtime errors
			this.stateManager = ( function () {
				const store = {};
				const subs = {};
				return {
					set: function ( k, v ) { store[ k ] = v; },
					get: function ( k ) { return store[ k ]; },
					subscribe: function ( k, fn ) { subs[ k ] = subs[ k ] || []; subs[ k ].push( fn ); },
					setDirty: function () {},
					isDirty: function () { return false; },
					getLayers: function () { return store.layers || []; },
					destroy: function () { }
				};
			} )();
		}

		// Initialize state through StateManager (defensive: ensure methods exist)
		if ( this.stateManager && typeof this.stateManager.set === 'function' ) {
			this.stateManager.set( 'layers', [] );
		}
		if ( this.stateManager && typeof this.stateManager.set === 'function' ) {
			this.stateManager.set( 'selectedLayerId', null );
			this.stateManager.set( 'isDirty', false );
			this.stateManager.set( 'currentTool', 'pointer' );
			this.stateManager.set( 'baseWidth', null );
			this.stateManager.set( 'baseHeight', null );
			this.stateManager.set( 'allLayerSets', [] );
			this.stateManager.set( 'currentLayerSetId', null );
		}
		// Named Layer Sets state
		if ( this.stateManager && typeof this.stateManager.set === 'function' ) {
			this.stateManager.set( 'namedSets', [] );
			this.stateManager.set( 'currentSetName', 'default' );
		}

		// BRIDGE: Provide backward-compatible editor.layers property that routes through StateManager
		// This allows legacy code to work while we complete the migration
		// NOTE: Must be defined BEFORE HistoryManager initialization so it can access layers
		Object.defineProperty( this, 'layers', {
			get: function() {
				return this.stateManager.getLayers();
			}.bind( this ),
			set: function( layers ) {
				if ( Array.isArray( layers ) ) {
					this.stateManager.set( 'layers', layers );
				}
			}.bind( this ),
			enumerable: true,
			configurable: true
		});

		// Initialize HistoryManager for undo/redo
		// NOTE: Must be after layers property is defined
		this.historyManager = this.registry.get( 'HistoryManager' );

		this.init();
	}

	/**
	 * Debug logging utility that only logs when debug mode is enabled
	 * Sanitizes messages to prevent information disclosure
	 *
	 * @param {...*} args Arguments to log
	 */
	LayersEditor.prototype.debugLog = function () {
		if ( this.debug ) {
			// Sanitize arguments to prevent sensitive data exposure
			const sanitizedArgs = Array.prototype.slice.call( arguments )
				.map( ( arg ) => LayersEditor.prototype.sanitizeLogMessage( arg ) );

			// Using MediaWiki's logging system for consistent debug output
			if ( mw.log ) {
				mw.log.apply( mw, sanitizedArgs );
			}
		}
	};

	/**
	 * Error logging utility with message sanitization
	 * Ensures no sensitive information is exposed in console logs
	 *
	 * @param {...*} args Arguments to log
	 */
	LayersEditor.prototype.errorLog = function () {
		// Sanitize error messages before logging
		const sanitizedArgs = Array.prototype.slice.call( arguments )
			.map( ( arg ) => LayersEditor.prototype.sanitizeLogMessage( arg ) );

		// Always log errors using MediaWiki's error handling
		if ( mw.log ) {
			mw.log.error.apply( mw.log, sanitizedArgs );
		}
	};

	/**
	 * Sanitize log messages to prevent sensitive information disclosure
	 * Uses a whitelist approach for better security
	 *
	 * @param {*} message The message to sanitize
	 * @return {*} Sanitized message
	 */
	LayersEditor.prototype.sanitizeLogMessage = function ( message ) {
		// Don't modify non-string values
		if ( typeof message !== 'string' ) {
			// For objects, use a whitelist approach for safety
			if ( typeof message === 'object' && message !== null ) {
				const safeKeys = [ 'type', 'action', 'status', 'tool', 'layer', 'count', 'x', 'y', 'width', 'height' ];
				const obj = {};
				for ( const key in message ) {
					if ( Object.prototype.hasOwnProperty.call( message, key ) ) {
						if ( safeKeys.includes( key ) ) {
							obj[ key ] = message[ key ];
						} else {
							obj[ key ] = '[FILTERED]';
						}
					}
				}
				return obj;
			}
			return message;
		}

		// For strings, apply comprehensive sanitization
		let result = String( message );

		// Remove any token-like patterns (base64, hex, etc.)
		result = result.replace( /[a-zA-Z0-9+/=]{20,}/g, '[TOKEN]' );
		result = result.replace( /[a-fA-F0-9]{16,}/g, '[HEX]' );

		// Remove file paths completely
		result = result.replace(
			/[A-Za-z]:[\\/]][\w\s\\.-]*/g,
			'[PATH]'
		);
		// Remove file paths completely
		result = result.replace(
			/\/[\w\s.-]+/g,
			'[PATH]'
		);

		// Remove URLs and connection strings
		result = result.replace( /https?:\/\/[^\s'"<>&]*/gi, '[URL]' );
		result = result.replace( /\w+:\/\/[^\s'"<>&]*/gi, '[CONNECTION]' );

		// Remove IP addresses and ports
		result = result.replace( /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]' );

		// Remove email addresses
		result = result.replace( /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]' );

		// Limit length to prevent log flooding
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

	LayersEditor.prototype.init = function () {
		// Add immediate visual feedback
		document.title = '🔄 Layers Editor Loading...';

		this.debugLog( '[LayersEditor] init() method called' );
		this.debugLog( '[LayersEditor] init() - checking browser compatibility' );

		// Check browser compatibility first
		if ( !this.validationManager.checkBrowserCompatibility() ) {
			this.uiManager.showBrowserCompatibilityWarning();
			return;
		}

		// Create the main editor interface
		this.uiManager.createInterface();

		this.debugLog( '[LayersEditor] UI Manager created interface' );
		this.debugLog( '[LayersEditor] UI Manager containers:', {
			mainContainer: this.uiManager.container,
			toolbarContainer: this.uiManager.toolbarContainer,
			layerPanelContainer: this.uiManager.layerPanelContainer,
			canvasContainer: this.uiManager.canvasContainer
		});

		// Register UI component factories with context after UI manager creates containers
		if ( this.registry.register ) {
			this.registry.register( 'Toolbar', () => new window.Toolbar({
				container: this.uiManager.toolbarContainer,
				editor: this
			}), [] );
			this.registry.register( 'LayerPanel', () => new window.LayerPanel({
				container: this.uiManager.layerPanelContainer,
				editor: this
			}), [] );
			this.registry.register( 'CanvasManager', () => new window.CanvasManager({
				container: this.uiManager.canvasContainer,
				editor: this,
				backgroundImageUrl: this.imageUrl
			}), [] );
		}

		// Initialize UI components through registry
		this.toolbar = this.registry.get( 'Toolbar' );
		this.debugLog( '[LayersEditor] Toolbar created:', this.toolbar );

		this.layerPanel = this.registry.get( 'LayerPanel' );
		this.debugLog( '[LayersEditor] LayerPanel created:', this.layerPanel );

		this.canvasManager = this.registry.get( 'CanvasManager' );

		this.debugLog( '[LayersEditor] CanvasManager created:', this.canvasManager );
		this.debugLog( '[LayersEditor] CanvasManager backgroundImageUrl:', this.imageUrl );

		// Initialize LayerSetManager for revision/set management
		if ( typeof window.LayerSetManager === 'function' ) {
			this.layerSetManager = new window.LayerSetManager( {
				editor: this,
				stateManager: this.stateManager,
				apiManager: this.apiManager,
				uiManager: this.uiManager,
				debug: this.debug
			} );
			this.debugLog( '[LayersEditor] LayerSetManager created' );
		}

		// Note: Undo/redo is handled by HistoryManager via this.historyManager

		// Load existing layers
		this.apiManager.loadLayers().then( ( data ) => {
			// If the editor was destroyed during the async API call, abort further processing
			if ( this.isDestroyed ) {
				return;
			}
			this.debugLog( '[LayersEditor] API loadLayers completed with data:', data );
			if ( data && data.layers ) {
				// Normalize layers to ensure visibility defaults are correct
				const normalizedLayers = this.normalizeLayers( data.layers );
				this.stateManager.set( 'layers', normalizedLayers );
			} else {
				this.stateManager.set( 'layers', [] );
			}
			if ( data && data.baseWidth ) {
				this.stateManager.set( 'baseWidth', data.baseWidth );
				// Sync base dimensions to canvas manager
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
			this.debugLog( '[LayersEditor] About to render layers:', layers.length, 'layers' );
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

		// Set up event handlers
		this.eventManager.setupGlobalHandlers();

		// Set up close button handler
		this.setupCloseButton();

		document.title = '🎨 Layers Editor - ' + ( this.filename || 'Unknown File' );
	};

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
	 *
	 * @param {Object} layerData - Layer data object
	 * @return {void}
	 */
	LayersEditor.prototype.addLayer = function ( layerData ) {
		// Save current state for undo
		this.saveState();

		// Sanitize layer data for security
		layerData = this.validationManager.sanitizeLayerData( layerData );

		// Add new layer
		layerData.id = this.apiManager.generateLayerId();
		layerData.visible = layerData.visible !== false; // Default to visible

		// Get current layers from state manager
		const layers = this.stateManager.get( 'layers' ) || [];
		// Insert at top so top of list = top of draw order
		layers.unshift( layerData );
		// Update state
		this.stateManager.set( 'layers', layers );

		if ( this.canvasManager ) {
			this.canvasManager.renderLayers( layers );
		}
		this.markDirty();

		// Select the newly created layer
		this.selectLayer( layerData.id );
	};

	/**
	 * Update an existing layer with new data
	 *
	 * @param {string} layerId - ID of the layer to update
	 * @param {Object} changes - Changes to apply to the layer
	 * @return {void}
	 */
	LayersEditor.prototype.updateLayer = function ( layerId, changes ) {
		try {
			// Debug: Log updateLayer call (only in debug mode)
			if ( this.debug ) {
				this.debugLog( 'updateLayer called with layerId:', layerId, 'changes:', changes );
			}

			// Save current state for undo
			this.saveState();

			// Keep derived geometry fields in sync
			if ( Object.prototype.hasOwnProperty.call( changes, 'outerRadius' ) &&
				!Object.prototype.hasOwnProperty.call( changes, 'radius' ) ) {
				changes.radius = changes.outerRadius;
			}

			// Sanitize changes for security
			changes = this.validationManager.sanitizeLayerData( changes );

			// Get current layers from state manager
			const layers = this.stateManager.get( 'layers' ) || [];
			// Update existing layer
			const layer = layers.find( ( l ) => l.id === layerId );
			if ( layer ) {
				Object.assign( layer, changes );
				// Update state
				this.stateManager.set( 'layers', layers );
				
				// Trigger full redraw to ensure proper rendering with transforms
				if ( this.canvasManager ) {
					this.canvasManager.redraw();
				}
				this.markDirty();

				// Debug: Log successful update (only in debug mode)
				if ( this.debug ) {
					this.debugLog( 'Layer updated successfully:', layerId, 'new layer data:', layer );
				}
			} else {
				// Debug: Log layer not found (only in debug mode)
				if ( this.debug ) {
					this.debugLog( 'Layer not found for update:', layerId );
				}
			}
		} catch ( error ) {
			// Log error but don't re-throw to prevent breaking the UI
			if ( this.debug ) {
				this.errorLog( 'Error in updateLayer:', error );
			}
			if ( window.mw && window.mw.notify ) {
				mw.notify( 'Error updating layer', { type: 'error' } );
			}
		}
	};

	LayersEditor.prototype.removeLayer = function ( layerId ) {
		// Save current state for undo
		this.saveState();

		// Get current layers from state manager
		const layers = this.stateManager.get( 'layers' ) || [];
		// Remove layer
		const updatedLayers = layers.filter( ( layer ) => layer.id !== layerId );
		// Update state
		this.stateManager.set( 'layers', updatedLayers );

		// Trigger full redraw to ensure proper rendering with transforms
		if ( this.canvasManager ) {
			this.canvasManager.redraw();
		}
		this.markDirty();

		// Update UI state
		this.updateUIState();
	};

	LayersEditor.prototype.getLayerById = function ( layerId ) {
		const layers = this.stateManager.get( 'layers' ) || [];
		return layers.find( ( layer ) => layer.id === layerId );
	};

	/**
	 * Parse MediaWiki binary(14) timestamp format (YYYYMMDDHHmmss) to Date
	 * @param {string} mwTimestamp MediaWiki timestamp string
	 * @return {Date} Parsed date object
	 */
	LayersEditor.prototype.parseMWTimestamp = function ( mwTimestamp ) {
		if ( !mwTimestamp || typeof mwTimestamp !== 'string' ) {
			return new Date();
		}

		// MediaWiki binary(14) format: YYYYMMDDHHmmss
		const year = parseInt( mwTimestamp.substring( 0, 4 ), 10 );
		const month = parseInt( mwTimestamp.substring( 4, 6 ), 10 ) - 1; // JS months are 0-indexed
		const day = parseInt( mwTimestamp.substring( 6, 8 ), 10 );
		const hour = parseInt( mwTimestamp.substring( 8, 10 ), 10 );
		const minute = parseInt( mwTimestamp.substring( 10, 12 ), 10 );
		const second = parseInt( mwTimestamp.substring( 12, 14 ), 10 );

		return new Date( year, month, day, hour, minute, second );
	};

	/**
	 * Build the revision selector dropdown
	 * Delegates to LayerSetManager if available
	 * @return {void}
	 */
	LayersEditor.prototype.buildRevisionSelector = function () {
		// Delegate to LayerSetManager if available
		if ( this.layerSetManager ) {
			this.layerSetManager.buildRevisionSelector();
			return;
		}

		// Fallback to direct implementation
		try {
			if ( this.uiManager && this.uiManager.revSelectEl ) {
				const selectEl = this.uiManager.revSelectEl;
				const allLayerSets = this.stateManager.get( 'allLayerSets' ) || [];
				const currentLayerSetId = this.stateManager.get( 'currentLayerSetId' );

				// Clear existing options
				selectEl.innerHTML = '';

				// Add default option
				const defaultOption = document.createElement( 'option' );
				defaultOption.value = '';
				defaultOption.textContent = this.getMessage( 'layers-revision-latest' );
				selectEl.appendChild( defaultOption );

				// Add revision options
				allLayerSets.forEach( layerSet => {
					const option = document.createElement( 'option' );
					option.value = layerSet.ls_id || layerSet.id;
					const timestamp = layerSet.ls_timestamp || layerSet.timestamp;
					const userName = layerSet.ls_user_name || layerSet.userName || 'Unknown';
					const name = layerSet.ls_name || layerSet.name || '';

					// Parse MediaWiki binary(14) timestamp format
					const date = this.parseMWTimestamp( timestamp );
					let displayText = date.toLocaleString();
					
					// Use MessageHelper for parameter substitution
					const byUserText = window.layersMessages ?
						window.layersMessages.getWithParams( 'layers-revision-by', userName ) :
						'by ' + userName;
					displayText += ' ' + byUserText;
					
					if ( name ) {
						displayText += ' (' + name + ')';
					}

					option.textContent = displayText;
					option.selected = ( layerSet.ls_id || layerSet.id ) === currentLayerSetId;
					selectEl.appendChild( option );
				} );

				// Update load button state
				this.updateRevisionLoadButton();
			}
		} catch ( error ) {
			this.errorLog( 'Error building revision selector:', error );
		}
	};

	/**
	 * Update the revision load button state
	 * Delegates to LayerSetManager if available
	 * @return {void}
	 */
	LayersEditor.prototype.updateRevisionLoadButton = function () {
		// Delegate to LayerSetManager if available
		if ( this.layerSetManager ) {
			this.layerSetManager.updateRevisionLoadButton();
			return;
		}

		// Fallback to direct implementation
		try {
			if ( this.uiManager && this.uiManager.revLoadBtnEl && this.uiManager.revSelectEl ) {
				const selectedValue = this.uiManager.revSelectEl.value;
				const currentLayerSetId = this.stateManager.get( 'currentLayerSetId' );
				const isCurrent = selectedValue && parseInt( selectedValue, 10 ) === currentLayerSetId;
				this.uiManager.revLoadBtnEl.disabled = !selectedValue || isCurrent;
			}
		} catch ( error ) {
			this.errorLog( 'Error updating revision load button:', error );
		}
	};

	/**
	 * Build and populate the named layer sets selector dropdown
	 * Delegates to LayerSetManager if available
	 * @return {void}
	 */
	LayersEditor.prototype.buildSetSelector = function () {
		// Delegate to LayerSetManager if available
		if ( this.layerSetManager ) {
			this.layerSetManager.buildSetSelector();
			return;
		}

		// Fallback to direct implementation
		try {
			const namedSets = this.stateManager.get( 'namedSets' ) || [];
			const currentSetName = this.stateManager.get( 'currentSetName' ) || 'default';
			const selectEl = this.uiManager && this.uiManager.setSelectEl;

			if ( !selectEl ) {
				return;
			}

			// Clear existing options
			selectEl.innerHTML = '';

			if ( namedSets.length === 0 ) {
				// No sets exist yet - show default placeholder
				const option = document.createElement( 'option' );
				option.value = 'default';
				option.textContent = this.getMessage( 'layers-set-default', 'Default' );
				option.selected = true;
				selectEl.appendChild( option );
			} else {
				// Build options from named sets
				namedSets.forEach( ( setInfo ) => {
					const option = document.createElement( 'option' );
					option.value = setInfo.name;

					// Format: "SetName (X revisions)"
					const revCount = setInfo.revision_count || 1;
					const revLabel = revCount === 1 ?
						this.getMessage( 'layers-set-revision-single', '1 revision' ) :
						this.getMessage( 'layers-set-revision-plural', `${ revCount } revisions` )
							.replace( '$1', revCount );

					option.textContent = `${ setInfo.name } (${ revLabel })`;
					option.selected = setInfo.name === currentSetName;
					selectEl.appendChild( option );
				} );
			}

			// Add "+ New" option at the end (if not at limit)
			const maxSets = mw.config.get( 'wgLayersMaxNamedSets', 15 );
			if ( namedSets.length < maxSets ) {
				const newOption = document.createElement( 'option' );
				newOption.value = '__new__';
				newOption.textContent = this.getMessage( 'layers-set-new', '+ New' );
				selectEl.appendChild( newOption );
			}

			// Update new set button state (disable if at limit)
			this.updateNewSetButtonState();

			this.debugLog( `Built set selector with ${ namedSets.length } sets, current: ${ currentSetName }` );
		} catch ( error ) {
			this.errorLog( 'Error building set selector:', error );
		}
	};

	/**
	 * Update the new set button's enabled/disabled state based on limits
	 * Delegates to LayerSetManager if available
	 * @return {void}
	 */
	LayersEditor.prototype.updateNewSetButtonState = function () {
		// Delegate to LayerSetManager if available
		if ( this.layerSetManager ) {
			this.layerSetManager.updateNewSetButtonState();
			return;
		}

		// Fallback to direct implementation
		try {
			const newSetBtn = this.uiManager && this.uiManager.setNewBtnEl;
			if ( !newSetBtn ) {
				return;
			}

			const namedSets = this.stateManager.get( 'namedSets' ) || [];
			const maxSets = mw.config.get( 'wgLayersMaxNamedSets', 15 );
			const atLimit = namedSets.length >= maxSets;

			newSetBtn.disabled = atLimit;
			newSetBtn.title = atLimit ?
				this.getMessage( 'layers-set-limit-reached', `Maximum of ${ maxSets } sets reached` )
					.replace( '$1', maxSets ) :
				this.getMessage( 'layers-set-new-tooltip', 'Create a new layer set' );
		} catch ( error ) {
			this.errorLog( 'Error updating new set button state:', error );
		}
	};

	/**
	 * Load a layer set by its name
	 * Delegates to LayerSetManager if available
	 * @param {string} setName - The name of the set to load
	 * @return {Promise<void>}
	 */
	LayersEditor.prototype.loadLayerSetByName = async function ( setName ) {
		// Delegate to LayerSetManager if available
		if ( this.layerSetManager ) {
			return this.layerSetManager.loadLayerSetByName( setName );
		}

		// Fallback to direct implementation
		try {
			if ( !setName ) {
				this.errorLog( 'loadLayerSetByName: No set name provided' );
				return;
			}

			// Check for unsaved changes before switching
			if ( this.hasUnsavedChanges() ) {
				const confirmSwitch = confirm(
					this.getMessage( 'layers-unsaved-changes-warning',
						'You have unsaved changes. Switch sets without saving?' )
				);
				if ( !confirmSwitch ) {
					// Revert selector to current set
					this.buildSetSelector();
					return;
				}
			}

			this.debugLog( `Loading layer set: ${ setName }` );

			// Update current set name in state
			this.stateManager.set( 'currentSetName', setName );

			// Load the set via API
			await this.apiManager.loadLayersBySetName( setName );

			// Notify user
			mw.notify(
				this.getMessage( 'layers-set-loaded', `Loaded layer set: ${ setName }` )
					.replace( '$1', setName ),
				{ type: 'info' }
			);
		} catch ( error ) {
			this.errorLog( 'Error loading layer set by name:', error );
			mw.notify(
				this.getMessage( 'layers-set-load-error', 'Failed to load layer set' ),
				{ type: 'error' }
			);
		}
	};

	/**
	 * Create a new named layer set
	 * Delegates to LayerSetManager if available
	 * @param {string} setName - The name for the new set
	 * @return {Promise<boolean>} True if creation succeeded
	 */
	LayersEditor.prototype.createNewLayerSet = async function ( setName ) {
		// Delegate to LayerSetManager if available
		if ( this.layerSetManager ) {
			return this.layerSetManager.createNewLayerSet( setName );
		}

		// Fallback to direct implementation
		try {
			if ( !setName || !setName.trim() ) {
				mw.notify(
					this.getMessage( 'layers-set-name-required', 'Please enter a name for the new set' ),
					{ type: 'warn' }
				);
				return false;
			}

			const trimmedName = setName.trim();

			// Validate name format (alphanumeric, hyphens, underscores)
			if ( !/^[a-zA-Z0-9_-]+$/.test( trimmedName ) ) {
				mw.notify(
					this.getMessage( 'layers-set-name-invalid',
						'Set name can only contain letters, numbers, hyphens, and underscores' ),
					{ type: 'error' }
				);
				return false;
			}

			// Check for duplicate names
			const namedSets = this.stateManager.get( 'namedSets' ) || [];
			const exists = namedSets.some( ( s ) => s.name.toLowerCase() === trimmedName.toLowerCase() );
			if ( exists ) {
				mw.notify(
					this.getMessage( 'layers-set-name-exists', 'A set with this name already exists' ),
					{ type: 'error' }
				);
				return false;
			}

			// Check limit
			const maxSets = mw.config.get( 'wgLayersMaxNamedSets', 15 );
			if ( namedSets.length >= maxSets ) {
				mw.notify(
					this.getMessage( 'layers-set-limit-reached', `Maximum of ${ maxSets } sets reached` )
						.replace( '$1', maxSets ),
					{ type: 'error' }
				);
				return false;
			}

			this.debugLog( `Creating new layer set: ${ trimmedName }` );

			// Clear current layers for fresh start
			this.stateManager.set( 'layers', [] );
			this.stateManager.set( 'currentSetName', trimmedName );
			this.stateManager.set( 'currentLayerSetId', null );
			this.stateManager.set( 'setRevisions', [] );

			// Update canvas
			if ( this.canvasManager ) {
				this.canvasManager.clearLayers();
				this.canvasManager.render();
			}

			// Update layer panel
			if ( this.layerPanel ) {
				this.layerPanel.updateLayerList( [] );
			}

			// Add to named sets list
			namedSets.push( {
				name: trimmedName,
				revision_count: 0,
				latest_revision: null,
				latest_timestamp: null,
				latest_user_name: mw.config.get( 'wgUserName' )
			} );
			this.stateManager.set( 'namedSets', namedSets );

			// Rebuild selector
			this.buildSetSelector();

			// Mark as having unsaved changes
			this.stateManager.set( 'hasUnsavedChanges', true );
			this.updateSaveButtonState();

			mw.notify(
				this.getMessage( 'layers-set-created', `Created new set: ${ trimmedName }. Add layers and save.` )
					.replace( '$1', trimmedName ),
				{ type: 'info' }
			);

			return true;
		} catch ( error ) {
			this.errorLog( 'Error creating new layer set:', error );
			mw.notify(
				this.getMessage( 'layers-set-create-error', 'Failed to create layer set' ),
				{ type: 'error' }
			);
			return false;
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
	 * Update the save button state based on unsaved changes
	 * @return {void}
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
	 * Load a specific revision by ID
	 * Delegates to LayerSetManager if available
	 * @param {number} revisionId - The revision ID to load
	 * @return {void}
	 */
	LayersEditor.prototype.loadRevisionById = function ( revisionId ) {
		// Delegate to LayerSetManager if available
		if ( this.layerSetManager ) {
			this.layerSetManager.loadRevisionById( revisionId );
			return;
		}

		// Fallback to direct implementation
		try {
			this.apiManager.loadRevisionById( revisionId );
		} catch ( error ) {
			this.errorLog( 'Error loading revision:', error );
			mw.notify( this.getMessage( 'layers-revision-load-error' ), { type: 'error' } );
		}
	};

	/**
	 * Get a localized message
	 * @param {string} key - Message key
	 * @param {string} fallback - Fallback text
	 * @return {string} Localized message
	 */
	LayersEditor.prototype.getMessage = function ( key, fallback = '' ) {
		return window.layersMessages.get( key, fallback );
	};

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

	// Undo/Redo System - delegates to HistoryManager
	LayersEditor.prototype.saveState = function ( action ) {
		if ( this.historyManager ) {
			this.historyManager.saveState( action );
		}
	};

	// Selection Management
	LayersEditor.prototype.selectLayer = function ( layerId ) {
		try {
			this.stateManager.set( 'selectedLayerId', layerId );

			// Update canvas selection
			if ( this.canvasManager ) {
				this.canvasManager.selectLayer( layerId );
			}

			// Update layer panel selection
			if ( this.layerPanel ) {
				this.layerPanel.selectLayer( layerId );
			}

			// Update UI state (toolbar buttons, etc.)
			this.updateUIState();

			// this.debugLog( 'Selected layer:', layerId );
		} catch ( error ) {
			// Log error but don't re-throw to prevent breaking the UI
			if ( this.debug ) {
				this.errorLog( 'Error in selectLayer:', error );
			}
			if ( window.mw && window.mw.notify ) {
				mw.notify( 'Error selecting layer', { type: 'error' } );
			}
		}
	};

	LayersEditor.prototype.deleteSelected = function () {
		const selectedLayerId = this.stateManager.get( 'selectedLayerId' );
		if ( selectedLayerId ) {
			this.removeLayer( selectedLayerId );
			this.stateManager.set( 'selectedLayerId', null );
		}
	};

	LayersEditor.prototype.duplicateSelected = function () {
		const selectedLayerId = this.stateManager.get( 'selectedLayerId' );
		if ( selectedLayerId ) {
			const layer = this.getLayerById( selectedLayerId );
			if ( layer ) {
				const duplicate = JSON.parse( JSON.stringify( layer ) );
				duplicate.x = ( duplicate.x || 0 ) + 20;
				duplicate.y = ( duplicate.y || 0 ) + 20;
				delete duplicate.id; // Will be regenerated by addLayer
				// Note: addLayer already calls saveState
				this.addLayer( duplicate );
			}
		}
	};

	LayersEditor.prototype.updateUIState = function () {
		try {
			// Update toolbar state
			if ( this.toolbar ) {
				const canUndo = this.historyManager ? this.historyManager.canUndo() : false;
				const canRedo = this.historyManager ? this.historyManager.canRedo() : false;
				const selectedLayerId = this.stateManager.get( 'selectedLayerId' );
				this.toolbar.updateUndoRedoState( canUndo, canRedo );
				this.toolbar.updateDeleteState( !!selectedLayerId );
			}
		} catch ( error ) {
			// Log error but don't re-throw to prevent breaking the UI
			if ( this.debug ) {
				this.errorLog( 'Error in updateUIState:', error );
			}
			if ( window.mw && window.mw.notify ) {
				mw.notify( 'Error updating UI state', { type: 'error' } );
			}
		}
	};

	// Apply a mutator function to all selected layers; saves state and marks dirty
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

	// Return selected layer ids from CanvasManager or fallback to single selection
	LayersEditor.prototype.getSelectedLayerIds = function () {
		if ( this.canvasManager && Array.isArray( this.canvasManager.selectedLayerIds ) ) {
			return this.canvasManager.selectedLayerIds.slice();
		}
		const selectedLayerId = this.stateManager.get( 'selectedLayerId' );
		return selectedLayerId ? [ selectedLayerId ] : [];
	};

	LayersEditor.prototype.navigateBackToFile = function () {
		try {
			if ( this.filename && mw && mw.util && typeof mw.util.getUrl === 'function' ) {
				const url = mw.util.getUrl( 'File:' + this.filename );
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

	/**
	 * Save the current layers to the server
	 *
	 * @return {void}
	 */
	LayersEditor.prototype.save = function () {
		// Get layers from state manager
		const layers = this.stateManager.get( 'layers' ) || [];

		// Validate layers before saving using validation manager
		if ( !this.validationManager.validateLayers( layers ) ) {
			const validationMsg = window.layersMessages ?
				window.layersMessages.get( 'layers-save-validation-error', 'Layer validation failed' ) :
				'Layer validation failed';
			mw.notify( validationMsg, { type: 'error' } );
			return;
		}

		// Show saving spinner using UI manager
		const savingMsg = window.layersMessages ?
			window.layersMessages.get( 'layers-saving', 'Saving...' ) :
			'Saving...';
		this.uiManager.showSpinner( savingMsg );

		// Use API manager to save (no parameters needed - APIManager reads from stateManager)
		// Note: APIManager.handleSaveSuccess() handles markClean, reloadRevisions, and success notification
		this.apiManager.saveLayers()
			.then( ( result ) => {
				// APIManager already handles success notification and reload
				// Just update the layer set ID here
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
	 * @return {void}
	 */
	LayersEditor.prototype.reloadRevisions = function () {
		try {
			// Delegate to APIManager which properly handles the current set name
			if ( this.apiManager && this.apiManager.reloadRevisions ) {
				this.apiManager.reloadRevisions();
			}
		} catch ( error ) {
			this.errorLog( 'Error in reloadRevisions:', error );
		}
	};
	// Accessibility: Add ARIA roles and keyboard navigation stubs
	// NOTE: Basic ARIA roles are implemented. Future enhancements could include:
	// - More comprehensive keyboard navigation (Tab through layers panel)
	// - Keyboard shortcuts help dialog (Shift+? or F1)
	// - Screen reader announcements for layer selection changes
	// - Arrow key navigation in layer panel

	// Security: Input sanitization
	// IMPLEMENTED: User-generated content is sanitized before use:
	// - ValidationManager.sanitizeString() strips HTML tags, javascript: protocol, event handlers
	// - ValidationManager.sanitizeLayerData() recursively sanitizes all layer properties
	// - Layer names use textContent (not innerHTML) for safe DOM insertion
	// - Server-side validation also enforces property whitelists and sanitization

	/**
	 * Normalize layer visibility on load (ensure undefined = visible)
	 * @param {Array} layers - Array of layer objects
	 * @return {Array} Normalized layers
	 */
	LayersEditor.prototype.normalizeLayers = function ( layers ) {
		if ( !layers || !Array.isArray( layers ) ) {
			return layers;
		}
		return layers.map( function ( layer ) {
			// Normalize visibility: undefined or true = visible
			if ( layer.visible === undefined ) {
				layer.visible = true;
			}
			return layer;
		} );
	};

	/**
	 * Cancel editing and return to the file page
	 *
	 * @param {boolean} navigateBack - Whether to navigate back to the file page
	 * @return {void}
	 */
	LayersEditor.prototype.cancel = function ( navigateBack ) {
		const self = this;
		// Save filename before any cleanup (it gets nulled in destroy())
		const savedFilename = this.filename;

		// Check for unsaved changes
		const isDirty = this.stateManager.get( 'isDirty' );
		if ( isDirty ) {
			// Use custom modal dialog instead of window.confirm for better UX
			this.showCancelConfirmDialog( function () {
				// User confirmed - close editor and navigate
				// Mark clean and destroy event manager FIRST to prevent browser's beforeunload
				if ( self.stateManager ) {
					self.stateManager.set( 'isDirty', false );
				}
				if ( self.eventManager && typeof self.eventManager.destroy === 'function' ) {
					self.eventManager.destroy();
				}
				self.uiManager.destroy();
				if ( navigateBack ) {
					self.navigateBackToFileWithName( savedFilename );
				}
			} );
		} else {
			// No unsaved changes - close immediately
			this.uiManager.destroy();
			if ( navigateBack ) {
				this.navigateBackToFileWithName( savedFilename );
			}
		}
	};

	/**
	 * Show a confirmation dialog for canceling with unsaved changes
	 *
	 * @param {Function} onConfirm - Callback when user confirms discarding changes
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

		// Focus the "Continue Editing" button (safer default)
		cancelBtn.focus();
	};

	/**
	 * Navigate back to the file page using a specific filename
	 * This version takes a filename parameter to avoid issues with nulled properties
	 *
	 * @param {string} filename - The filename to navigate to
	 * @private
	 */
	LayersEditor.prototype.navigateBackToFileWithName = function ( filename ) {
		try {
			if ( filename && mw && mw.util && typeof mw.util.getUrl === 'function' ) {
				const url = mw.util.getUrl( 'File:' + filename );
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

	/**
	 * Handle keyboard shortcuts and navigation
	 *
	 * @param {KeyboardEvent} e - Keyboard event
	 * @private
	 */
	LayersEditor.prototype.handleKeyDown = function ( e ) {
		this.eventManager.handleKeyDown( e );
	};

	LayersEditor.prototype.destroy = function () {
		// Prevent multiple destroy calls
		if ( this.isDestroyed ) {
			return;
		}
		this.isDestroyed = true;

		// Clean up global event listeners if this instance registered them
		this.cleanupGlobalEventListeners();

		// Clean up managers
		if ( this.uiManager && typeof this.uiManager.destroy === 'function' ) {
			this.uiManager.destroy();
		}
		if ( this.eventManager && typeof this.eventManager.destroy === 'function' ) {
			this.eventManager.destroy();
		}
		if ( this.apiManager && typeof this.apiManager.destroy === 'function' ) {
			this.apiManager.destroy();
		}
		if ( this.validationManager && typeof this.validationManager.destroy === 'function' ) {
			this.validationManager.destroy();
		}
		if ( this.stateManager && typeof this.stateManager.destroy === 'function' ) {
			this.stateManager.destroy();
		}
		if ( this.historyManager ) {
			if ( typeof this.historyManager.destroy === 'function' ) {
				this.historyManager.destroy();
			} else if ( typeof this.historyManager.clearHistory === 'function' ) {
				this.historyManager.clearHistory();
			}
		}

		// Clean up LayerSetManager
		if ( this.layerSetManager && typeof this.layerSetManager.destroy === 'function' ) {
			this.layerSetManager.destroy();
		}

		// Clean up canvas manager and its event systems
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

		// Clean up DOM elements and their event listeners
		this.cleanupDOMEventListeners();

		// Clear all object references to prevent memory leaks
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
		this.config = null;
		this.filename = null;
		this.containerElement = null;
		this.imageUrl = null;

		// Clear any cached references
		this.layers = null;
		this.clipboard = null;
	};

	/**
	 * Clean up global event listeners to prevent memory leaks
	 */
	LayersEditor.prototype.cleanupGlobalEventListeners = function () {
		// Note: Global error handlers are shared and shouldn't be removed per instance
		// Only clean up instance-specific listeners tracked by EventTracker
		if ( this.eventTracker ) {
			this.eventTracker.removeAllForElement( window );
			this.eventTracker.removeAllForElement( document );
		}
	};

	/**
	 * Clean up DOM event listeners to prevent memory leaks
	 */
	LayersEditor.prototype.cleanupDOMEventListeners = function () {
		// Clean up all DOM element listeners tracked by EventTracker
		if ( this.eventTracker ) {
			this.eventTracker.destroy();
			// Recreate tracker in case editor is reused
			this.eventTracker = window.EventTracker ? new window.EventTracker() : null;
		}
	};

	/**
	 * Track event listeners for proper cleanup
	 * @param {Element} element DOM element
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 * @param {Object} [options] Event listener options
	 */
	LayersEditor.prototype.trackEventListener = function ( element, event, handler, options ) {
		if ( this.eventTracker ) {
			this.eventTracker.add( element, event, handler, options );
		} else {
			// Fallback if EventTracker not available
			element.addEventListener( event, handler, options );
		}
	};

	/**
	 * Track window event listeners for proper cleanup
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 * @param {Object} [options] Event listener options
	 */
	LayersEditor.prototype.trackWindowListener = function ( event, handler, options ) {
		if ( this.eventTracker ) {
			this.eventTracker.add( window, event, handler, options );
		} else {
			// Fallback if EventTracker not available
			window.addEventListener( event, handler, options );
		}
	};

	/**
	 * Track document event listeners for proper cleanup
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 * @param {Object} [options] Event listener options
	 */
	LayersEditor.prototype.trackDocumentListener = function ( event, handler, options ) {
		if ( this.eventTracker ) {
			this.eventTracker.add( document, event, handler, options );
		} else {
			// Fallback if EventTracker not available
			document.addEventListener( event, handler, options );
		}
	};

	// Export LayersEditor to global scope
	window.LayersEditor = LayersEditor;

	/**
	 * Global error message sanitizer for preventing information disclosure
	 * @param {Error|string|*} error Error object or message to sanitize
	 * @return {string} Sanitized error message
	 */
	function sanitizeGlobalErrorMessage( error ) {
		let message = 'An error occurred';

		try {
			if ( error && typeof error.message === 'string' ) {
				message = error.message;
			} else if ( typeof error === 'string' ) {
				message = error;
			} else if ( error && error.toString ) {
				message = error.toString();
			}

			// Apply the same sanitization logic as in LayersEditor
			if ( typeof message !== 'string' ) {
				return 'Non-string error encountered';
			}

			// Remove any token-like patterns (base64, hex, etc.)
			message = message.replace( /[a-zA-Z0-9+/=]{20,}/g, '[TOKEN]' );
			message = message.replace( /[a-fA-F0-9]{16,}/g, '[HEX]' );

			// Remove file paths completely
			message = message.replace( /[A-Za-z]:[\\/][\w\s\\.-]*/g, '[PATH]' );
			message = message.replace( /\/[\w\s.-]+/g, '[PATH]' );

			// Remove URLs and connection strings
			message = message.replace( /https?:\/\/[^\s'"<>&]*/gi, '[URL]' );
			message = message.replace( /\w+:\/\/[^\s'"<>&]*/gi, '[CONNECTION]' );

			// Remove IP addresses and ports
			message = message.replace( /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]' );

			// Remove email addresses
			message = message.replace( /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]' );

			// Limit length to prevent log flooding
			if ( message.length > 200 ) {
				message = message.slice( 0, 200 ) + '[TRUNCATED]';
			}

			return message;
		} catch ( sanitizeError ) {
			return 'Error sanitization failed';
		}
	}

	/**
	 * Quick check if critical dependencies are available for editor initialization.
	 * Used by both hook listener and auto-bootstrap to prevent premature instantiation.
	 * @return {boolean} True if LayersConstants and CanvasManager are available
	 */
	function areEditorDependenciesReady() {
		return typeof window.LayersConstants !== 'undefined' &&
			typeof window.CanvasManager === 'function';
	}

	// Max retries for hook listener dependency checks
	const MAX_HOOK_DEPENDENCY_RETRIES = 20;
	let hookDependencyRetries = 0;

	// Hook listener for editor initialization - defined outside if/else so fallback can use it
	const hookListener = function ( config ) {
		// Verify dependencies before creating editor
		if ( !areEditorDependenciesReady() ) {
			hookDependencyRetries++;
			if ( hookDependencyRetries < MAX_HOOK_DEPENDENCY_RETRIES ) {
				if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
					mw.log.warn( '[LayersEditor] Hook fired but dependencies not ready (attempt ' + hookDependencyRetries + '/' + MAX_HOOK_DEPENDENCY_RETRIES + '), deferring...' );
				}
				// Defer and retry
				setTimeout( function () {
					hookListener( config );
				}, 100 );
				return;
			}
			// Max retries reached - proceed anyway and let validateDependencies handle it
			if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
				mw.log.error( '[LayersEditor] Max dependency retries reached in hook listener, proceeding with available dependencies' );
			}
		}

		// Debug mode handled by debugLog method
		document.title = '🎨 Layers Editor Initializing...';
		try {
			const editor = new LayersEditor( config );
			document.title = '🎨 Layers Editor - ' + ( config.filename || 'Unknown File' );
			// Always set the global instance for duplicate prevention
			window.layersEditorInstance = editor;
		} catch ( e ) {
			// SECURITY FIX: Sanitize error message to prevent information disclosure
			const sanitizedError = sanitizeGlobalErrorMessage( e );
			// Use mw.log.error instead of console.error
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.error( '[LayersEditor] Error creating LayersEditor:', sanitizedError );
			}
			throw e;
		}
	};

	// Initialize editor when appropriate - ensure mw.hook is available
	if ( typeof mw !== 'undefined' && mw.hook ) {
		if ( mw && mw.log ) {
			mw.log( '[LayersEditor] About to register hook listener' );
		}
		mw.hook( 'layers.editor.init' ).add( hookListener );
	} else {
		// Fallback: try to add hook listener when mw becomes available
		const MAX_MW_HOOK_RETRIES = 40; // 40 retries at 50ms = 2 seconds max
		let mwHookRetries = 0;
		const addHookListener = function () {
			if ( typeof mw !== 'undefined' && mw.hook ) {
				// mw.hook is available, register the listener
				mw.hook( 'layers.editor.init' ).add( hookListener );
			} else {
				mwHookRetries++;
				if ( mwHookRetries < MAX_MW_HOOK_RETRIES ) {
					// Retry after a short delay
					setTimeout( addHookListener, 50 );
				}
				// Note: If max retries reached, MediaWiki environment is not available.
				// This is expected in non-MediaWiki contexts (tests, standalone).
			}
		};
		addHookListener();
	}

	// Global error handler for unhandled promise rejections
	if ( typeof window !== 'undefined' && window.addEventListener ) {
		window.addEventListener( 'unhandledrejection', ( event ) => {
			const error = event.reason;
			if ( error && typeof error.message === 'string' &&
				error.message.includes( 'message channel closed' ) ) {
				// This is likely a browser extension or third-party script issue
				if ( mw && mw.log ) {
					mw.log.warn( '[Layers] Suppressed message channel error (likely browser extension):', error );
				}
				// Prevent the error from being logged to console
				event.preventDefault();
			} else if ( mw && mw.log ) {
				mw.log.error( '[Layers] Unhandled promise rejection:', error );
			}
		} );

		// Also catch regular errors
		window.addEventListener( 'error', ( event ) => {
			if ( event.error && typeof event.error.message === 'string' &&
				event.error.message.includes( 'message channel closed' ) ) {
				if ( mw && mw.log ) {
					mw.log.warn( '[Layers] Suppressed message channel error (likely browser extension):', event.error );
				}
				event.preventDefault();
			}
		} );
	}

	// Auto-bootstrap if server provided config via wgLayersEditorInit
	( function autoBootstrap() {
		// Maximum number of retry attempts for dependency loading
		const MAX_DEPENDENCY_RETRIES = 20;
		let dependencyRetries = 0;

		function tryBootstrap() {
			try {
				const debug = window.mw && mw.config && mw.config.get( 'wgLayersDebug' );

				// Helper for debug logging via MediaWiki's logging system
				const debugLog = function ( msg ) {
					if ( debug && mw.log ) {
						mw.log( '[LayersEditor] ' + msg );
					}
				};

				// Check if MediaWiki is available
				if ( !window.mw || !mw.config || !mw.config.get ) {
					debugLog( 'MediaWiki not ready, retrying in 100ms...' );
					setTimeout( tryBootstrap, 100 );
					return;
				}

				// Try to get config from MediaWiki config vars
				const init = mw.config.get( 'wgLayersEditorInit' );
				debugLog( 'wgLayersEditorInit config: ' + ( init ? 'present' : 'not found' ) );

				if ( !init ) {
					return;
				}

				// Check if dependencies are ready before proceeding
				// Uses the shared areEditorDependenciesReady function defined above
				if ( !areEditorDependenciesReady() ) {
					dependencyRetries++;
					if ( dependencyRetries < MAX_DEPENDENCY_RETRIES ) {
						debugLog( 'Dependencies not ready (attempt ' + dependencyRetries + '/' + MAX_DEPENDENCY_RETRIES + '), retrying in 50ms...' );
						setTimeout( tryBootstrap, 50 );
						return;
					}
					// After max retries, continue anyway and let validateDependencies log the warning
					debugLog( 'Max dependency retries reached, proceeding with available dependencies' );
				}

				const container = document.getElementById( 'layers-editor-container' );
				debugLog( 'Container element exists: ' + !!container );

				// Fire the hook for initialization
				mw.hook( 'layers.editor.init' ).fire( {
					filename: init.filename,
					imageUrl: init.imageUrl,
					container: container || document.body
				} );

				debugLog( 'Hook fired for: ' + init.filename );

				try {
					// Check if editor already exists (created by hook listener)
					if ( window.layersEditorInstance ) {
						debugLog( 'Editor already exists from hook listener' );
						return;
					}

					const editor = new LayersEditor( {
						filename: init.filename,
						imageUrl: init.imageUrl,
						container: container || document.body
					} );
					debugLog( 'Direct editor creation successful' );

					document.title = '🎨 Layers Editor - ' + ( init.filename || 'Unknown File' );
					if ( window.mw && window.mw.config.get( 'debug' ) ) {
						window.layersEditorInstance = editor;
					}
				} catch ( directError ) {
					// Use mw.log.error instead of console.error
					if ( mw.log && mw.log.error ) {
						mw.log.error( '[LayersEditor] Direct editor creation failed:', sanitizeGlobalErrorMessage( directError ) );
					}
				}
			} catch ( e ) {
				// Use mw.log.error instead of console.error
				if ( mw.log && mw.log.error ) {
					mw.log.error( '[LayersEditor] Auto-bootstrap error:', sanitizeGlobalErrorMessage( e ) );
				}
			}
		}

		// Try bootstrapping immediately, or when DOM is ready
		if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', tryBootstrap );
		} else {
			tryBootstrap();
		}
	}() );

	// Add cleanup for page navigation to prevent memory leaks
	function cleanupGlobalEditorInstance() {
		if ( window.layersEditorInstance && typeof window.layersEditorInstance.destroy === 'function' ) {
			window.layersEditorInstance.destroy();
			window.layersEditorInstance = null;
		}
	}

	// Clean up on page unload
	if ( typeof window !== 'undefined' ) {
		window.addEventListener( 'beforeunload', cleanupGlobalEditorInstance );
		
		// MediaWiki page navigation cleanup
		if ( typeof mw !== 'undefined' && mw.hook ) {
			// Clean up when navigating to new content
			mw.hook( 'wikipage.content' ).add( function() {
				// Only cleanup if we're not on a layers editor page
				const isEditLayersPage = mw.config.get( 'wgAction' ) === 'editlayers';
				if ( !isEditLayersPage ) {
					cleanupGlobalEditorInstance();
				}
			} );
		}
	}

}() );
