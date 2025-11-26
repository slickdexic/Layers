/**
 * Main Layers Editor - manages the overall editing interface and coordinates between components
 */
( function () {
	'use strict';

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
		this.config = config || {};
		this.filename = this.config.filename;
		this.containerElement = this.config.container; // Optional legacy container
		this.canvasManager = null;
		this.layerPanel = null;
		this.toolbar = null;

		// Event listener tracking for cleanup
		this.domEventListeners = [];
		this.windowListeners = [];
		this.documentListeners = [];
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
		this.registry = window.layersRegistry || window.layersModuleRegistry;
		if ( !this.registry ) {
			// Create a basic fallback registry
			this.registry = {
				get: ( name ) => {
					const constructors = {
						UIManager: () => new window.UIManager( this ),
						EventManager: () => new window.EventManager( this ),
						APIManager: () => new window.APIManager( this ),
						ValidationManager: () => new window.ValidationManager( this ),
						StateManager: () => new window.StateManager( this ),
						HistoryManager: () => new window.HistoryManager( this )
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

		// Initialize state through StateManager
		this.stateManager.set( 'layers', [] );
		this.stateManager.set( 'selectedLayerId', null );
		this.stateManager.set( 'isDirty', false );
		this.stateManager.set( 'currentTool', 'pointer' );
		this.stateManager.set( 'baseWidth', null );
		this.stateManager.set( 'baseHeight', null );
		this.stateManager.set( 'allLayerSets', [] );
		this.stateManager.set( 'currentLayerSetId', null );
		// Named Layer Sets state
		this.stateManager.set( 'namedSets', [] );
		this.stateManager.set( 'currentSetName', 'default' );

		// Initialize HistoryManager for undo/redo
		this.historyManager = this.registry.get( 'HistoryManager' );

		// BRIDGE: Provide backward-compatible editor.layers property that routes through StateManager
		// This allows legacy code to work while we complete the migration
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

		// Initialize undo/redo system
		this.undoStack = [];
		this.redoStack = [];
		this.maxUndoSteps = 50;

		// Load existing layers
		this.apiManager.loadLayers().then( ( data ) => {
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

	LayersEditor.prototype.markDirty = function () {
		this.stateManager.set( 'isDirty', true );
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
	 * @return {void}
	 */
	LayersEditor.prototype.buildRevisionSelector = function () {
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
					
					// Use MediaWiki message system with parameter replacement
					const byUserText = mw.message( 'layers-revision-by', userName ).text();
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
	 * @return {void}
	 */
	LayersEditor.prototype.updateRevisionLoadButton = function () {
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
	 * @return {void}
	 */
	LayersEditor.prototype.buildSetSelector = function () {
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
	 * @return {void}
	 */
	LayersEditor.prototype.updateNewSetButtonState = function () {
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
	 * @param {string} setName - The name of the set to load
	 * @return {Promise<void>}
	 */
	LayersEditor.prototype.loadLayerSetByName = async function ( setName ) {
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
	 * @param {string} setName - The name for the new set
	 * @return {Promise<boolean>} True if creation succeeded
	 */
	LayersEditor.prototype.createNewLayerSet = async function ( setName ) {
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
	 * @param {number} revisionId - The revision ID to load
	 * @return {void}
	 */
	LayersEditor.prototype.loadRevisionById = function ( revisionId ) {
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
		return ( mw.message ? mw.message( key ).text() : ( mw.msg ? mw.msg( key ) : fallback ) );
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

	// Undo/Redo System
	LayersEditor.prototype.saveState = function ( action ) {
		// Delegate to canvas manager's history system
		if ( this.historyManager ) {
			this.historyManager.saveState( action );
		}
	};

	LayersEditor.prototype.undo = function () {
		// Delegate to canvas manager's undo system
		if ( this.historyManager ) {
			return this.historyManager.undo();
		}
		return false;
	};

	LayersEditor.prototype.redo = function () {
		// Delegate to canvas manager's redo system
		if ( this.historyManager ) {
			return this.historyManager.redo();
		}
		return false;
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
				duplicate.x = ( duplicate.x || 0 ) + 10;
				duplicate.y = ( duplicate.y || 0 ) + 10;
				delete duplicate.id; // Will be regenerated
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
			mw.notify( mw.message ? mw.message( 'layers-save-validation-error' ).text() : 'Layer validation failed', { type: 'error' } );
			return;
		}

		// Show saving spinner using UI manager
		this.uiManager.showSpinner( mw.message ? mw.message( 'layers-saving' ).text() : 'Saving...' );

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
				const errorMsg = error.info || ( mw.message ? mw.message( 'layers-save-error' ).text() : 'Failed to save layers' );
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
	// TODO: Implement more comprehensive keyboard navigation and screen reader support
	// Recommendations:
	// - Add ARIA labels to all toolbar buttons and controls
	// - Implement Tab navigation through layers panel
	// - Add keyboard shortcuts help dialog (Shift+? or F1)
	// - Announce layer selection changes to screen readers
	// - Add focus indicators for keyboard navigation
	// - Support arrow key navigation in layer panel

	// Security: Input sanitization before rendering user content
	// TODO: Ensure all user-generated content is sanitized before rendering in the DOM or canvas
	// Recommendations:
	// - Sanitize layer names for XSS prevention
	// - Validate color values before applying
	// - Escape text content in text layers
	// - Validate file paths and URLs
	// - Use DOMPurify or similar for HTML content

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
		// Check for unsaved changes
		const isDirty = this.stateManager.get( 'isDirty' );
		if ( isDirty ) {
			const confirmMsg = mw.message ? mw.message( 'layers-cancel-confirm' ).text() : 'You have unsaved changes. Are you sure you want to close?';
			// eslint-disable-next-line no-alert
			if ( !window.confirm( confirmMsg ) ) {
				return;
			}
		}

		// Use UI manager to handle close
		this.uiManager.destroy();
		if ( navigateBack ) {
			this.navigateBackToFile();
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

		// Clean up canvas manager and its event systems
		if ( this.canvasManager ) {
			if ( this.canvasManager.eventSystem && typeof this.canvasManager.eventSystem.destroy === 'function' ) {
				this.canvasManager.eventSystem.destroy();
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
		this.config = null;
		this.filename = null;
		this.containerElement = null;
		this.imageUrl = null;

		// Clear any cached references
		this.layers = null;
		this.clipboard = null;
		this.undoStack = null;
		this.redoStack = null;
	};

	/**
	 * Clean up global event listeners to prevent memory leaks
	 */
	LayersEditor.prototype.cleanupGlobalEventListeners = function () {
		// Note: Global error handlers are shared and shouldn't be removed per instance
		// Only clean up instance-specific listeners
		
		// Remove any window listeners that were added for this specific instance
		if ( this.windowListeners ) {
			this.windowListeners.forEach( function( listenerInfo ) {
				window.removeEventListener( listenerInfo.event, listenerInfo.handler );
			} );
			this.windowListeners = [];
		}

		// Remove any document listeners that were added for this specific instance
		if ( this.documentListeners ) {
			this.documentListeners.forEach( function( listenerInfo ) {
				document.removeEventListener( listenerInfo.event, listenerInfo.handler );
			} );
			this.documentListeners = [];
		}
	};

	/**
	 * Clean up DOM event listeners to prevent memory leaks
	 */
	LayersEditor.prototype.cleanupDOMEventListeners = function () {
		// Clean up container element listeners
		if ( this.containerElement ) {
			// Remove all event listeners from container by cloning it
			const newContainer = this.containerElement.cloneNode( true );
			if ( this.containerElement.parentNode ) {
				this.containerElement.parentNode.replaceChild( newContainer, this.containerElement );
			}
		}

		// Clean up any other DOM elements with listeners
		if ( this.domEventListeners ) {
			this.domEventListeners.forEach( function( listenerInfo ) {
				if ( listenerInfo.element && listenerInfo.element.removeEventListener ) {
					listenerInfo.element.removeEventListener( listenerInfo.event, listenerInfo.handler );
				}
			} );
			this.domEventListeners = [];
		}
	};

	/**
	 * Track event listeners for proper cleanup
	 * @param {Element} element DOM element
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 */
	LayersEditor.prototype.trackEventListener = function ( element, event, handler ) {
		if ( !this.domEventListeners ) {
			this.domEventListeners = [];
		}
		this.domEventListeners.push( { element: element, event: event, handler: handler } );
		element.addEventListener( event, handler );
	};

	/**
	 * Track window event listeners for proper cleanup
	 * @param {string} event Event name
	 * @param {Function} handler Event handler
	 */
	LayersEditor.prototype.trackWindowListener = function ( event, handler ) {
		if ( !this.windowListeners ) {
			this.windowListeners = [];
		}
		this.windowListeners.push( { event: event, handler: handler } );
		window.addEventListener( event, handler );
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

	// Initialize editor when appropriate - ensure mw.hook is available
	if ( typeof mw !== 'undefined' && mw.hook ) {
		if ( mw && mw.log ) {
			mw.log( '[LayersEditor] About to register hook listener' );
		}

		const hookListener = function ( config ) {
			// Debug mode handled by debugLog method
			document.title = '🎨 Layers Editor Initializing...';
			try {
				const editor = new LayersEditor( config );
				document.title = '🎨 Layers Editor - ' + ( config.filename || 'Unknown File' );
				// Always set the global instance for duplicate prevention
				window.layersEditorInstance = editor;
				if ( window.mw && window.mw.config.get( 'debug' ) ) {
					window.layersEditorInstance = editor;
				}
			} catch ( e ) {
				// SECURITY FIX: Sanitize error message to prevent information disclosure
				const sanitizedError = sanitizeGlobalErrorMessage( e );
				// Use mw.log.error instead of console.error
				if ( mw.log ) {
					mw.log.error( '[LayersEditor] Error creating LayersEditor:', sanitizedError );
				}
				throw e;
			}
		};

		mw.hook( 'layers.editor.init' ).add( hookListener );
	} else {
		// Fallback: try to add hook listener when mw becomes available
		const addHookListener = function () {
			if ( typeof mw !== 'undefined' && mw.hook ) {
				// ... existing fallback code ...
			} else {
				// Retry after a short delay
				setTimeout( addHookListener, 50 );
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
		function tryBootstrap() {
			try {
				const debug = window.mw && mw.config && mw.config.get( 'wgLayersDebug' );
				// Always log for now to debug the issue
				if ( debug ) {
					console.log( 'LayersEditor: Auto-bootstrap starting...' );
					console.log( 'LayersEditor: Current URL:', window.location.href );
					console.log( 'LayersEditor: wgLayersDebug config:', debug );
				}

				// Ensure MediaWiki is available
				// Check if MediaWiki is available
				if ( !window.mw || !mw.config || !mw.config.get ) {
					if ( debug ) {
						console.log( 'LayersEditor: MediaWiki not ready, retrying in 100ms...' );
					}
					setTimeout( tryBootstrap, 100 );
					return;
				}

				// Try to get config from MediaWiki config vars
				const init = mw.config.get( 'wgLayersEditorInit' );
				if ( debug ) {
					console.log( 'LayersEditor: wgLayersEditorInit config:', init );
				}

				if ( !init ) {
					if ( debug ) {
						console.log( 'LayersEditor: No wgLayersEditorInit config found, not auto-bootstrapping' );
					}
					return;
				}

				if ( debug ) {
					console.log( 'LayersEditor: wgLayersEditorInit config details:', {
						hasFilename: !!( init && init.filename ),
						hasImageUrl: !!( init && init.imageUrl ),
						filename: init && init.filename,
						imageUrl: init && init.imageUrl
					} );
				}

				const container = document.getElementById( 'layers-editor-container' );
				if ( debug ) {
					console.log( 'LayersEditor: Container element:', container );
					console.log( 'LayersEditor: Container element exists:', !!container );
					if ( container ) {
						console.log( 'LayersEditor: Container element in document:', document.body.contains( container ) );
						console.log( 'LayersEditor: Container element HTML:', container.outerHTML );
						console.log( 'LayersEditor: Container element position in DOM:', container.getBoundingClientRect() );
					} else {
						console.log( 'LayersEditor: Container element not found, checking all elements with similar IDs' );
						const allDivs = document.querySelectorAll( 'div[id*="layer"]' );
						console.log( 'LayersEditor: Found divs with "layer" in ID:', Array.from( allDivs ).map( el => el.id ) );
					}
				}

				// Try to fire the hook first (for backward compatibility)
				if ( debug ) {
					console.log( 'LayersEditor: About to check hook system state' );

					// Check if hook system is available and has our hook registered
					if ( typeof mw !== 'undefined' && mw.hook && mw.hook( 'layers.editor.init' ) ) {
						const hookObj = mw.hook( 'layers.editor.init' );
						console.log( 'LayersEditor: Hook object exists:', !!hookObj );
						console.log( 'LayersEditor: Hook has fire method:', typeof hookObj.fire === 'function' );
					}
				}

				mw.hook( 'layers.editor.init' ).fire( {
					filename: init.filename,
					imageUrl: init.imageUrl,
					container: container || document.body
				} );

				if ( debug ) {
					console.log( 'LayersEditor: Hook fired successfully with config:', {
						filename: init.filename,
						imageUrl: init.imageUrl,
						container: container ? 'layers-editor-container' : 'document.body'
					} );
					// Check if hook has listeners after firing
					const hookObjAfter = mw.hook( 'layers.editor.init' );
					if ( hookObjAfter && typeof hookObjAfter.getListeners === 'function' ) {
						const listeners = hookObjAfter.getListeners();
						console.log( 'LayersEditor: Hook listeners after firing:', listeners ? listeners.length : 'unknown' );
					}
				}
				try {
					// Check if editor already exists (created by hook listener)
					if ( window.layersEditorInstance ) {
						if ( debug ) {
							console.log( 'LayersEditor: Editor already exists from hook listener, skipping direct creation' );
						}
						return;
					}
					if ( debug ) {
						console.log( 'LayersEditor: Attempting direct editor creation with config:', {
							filename: init.filename,
							imageUrl: init.imageUrl,
							container: container ? 'layers-editor-container' : 'document.body'
						} );
					}
					const editor = new LayersEditor( {
						filename: init.filename,
						imageUrl: init.imageUrl,
						container: container || document.body
					} );
					if ( debug ) {
						console.log( 'LayersEditor: Direct editor creation successful:', editor );
					}
					document.title = '🎨 Layers Editor - ' + ( init.filename || 'Unknown File' );
					if ( window.mw && window.mw.config.get( 'debug' ) ) {
						window.layersEditorInstance = editor;
					}
				} catch ( directError ) {
					console.error( 'LayersEditor: Direct editor creation failed:', sanitizeGlobalErrorMessage( directError ) );
					// If direct creation fails, the hook-based approach should still work
				}

				if ( debug ) {
					console.log( 'LayersEditor: Auto-bootstrap fired layers.editor.init hook' );
				}
			} catch ( e ) {
				console.error( 'LayersEditor: Auto-bootstrap error:', sanitizeGlobalErrorMessage( e ) );
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
