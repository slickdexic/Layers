/**
 * API Manager for Layers Editor
 * Handles all API communications with the backend
 */
( function () {
	'use strict';

	// Helper to resolve classes from namespace with global fallback
	const getClass = window.layersGetClass || function ( namespacePath, globalName ) {
		if ( window.Layers ) {
			const parts = namespacePath.split( '.' );
			let obj = window.Layers;
			for ( const part of parts ) {
				if ( obj && obj[ part ] ) {
					obj = obj[ part ];
				} else {
					break;
				}
			}
			if ( typeof obj === 'function' ) {
				return obj;
			}
		}
		return window[ globalName ];
	};

	// Get APIErrorHandler class
	const APIErrorHandler = getClass( 'Editor.APIErrorHandler', 'APIErrorHandler' );

	// Get ExportController class for export delegation
	const ExportController = getClass( 'Editor.ExportController', 'ExportController' );

	// Get shared LayerDataNormalizer for consistent data handling
	const LayerDataNormalizer = ( window.Layers && window.Layers.LayerDataNormalizer ) || window.LayerDataNormalizer;

	class APIManager {
	constructor( editor ) {
		this.editor = editor;
		this.api = new mw.Api();
		this.maxRetries = 3;
		this.retryDelay = 1000; // Start with 1 second
		this.activeTimeouts = new Set(); // Track active timeouts for cleanup
		// Optional debug aid: reject promises when requests are aborted so callers
		// can distinguish aborts from silent ignores. Defaults to current behavior
		// (ignore aborts) unless explicitly enabled via config.
		this.rejectAbortedRequests = Boolean( mw.config && mw.config.get && mw.config.get( 'wgLayersRejectAbortedRequests' ) ) ||
			Boolean( editor && editor.config && editor.config.rejectAbortedRequests );
		
		// Track pending API requests by operation type for abort handling
		// Keys: 'loadRevision', 'loadSetByName', etc.
		// Values: jqXHR object (has abort() method)
		this.pendingRequests = new Map();
		
		// API response cache for performance optimization
		// Caches layersinfo responses to reduce redundant API calls
		// Key format: 'filename:setname' or 'filename:id:revisionId'
		this.responseCache = new Map();
		this.cacheMaxSize = 20; // Max entries to prevent unbounded growth
		this.cacheTTL = 5 * 60 * 1000; // 5 minutes TTL
		
		// Prevent concurrent save operations (CORE-3 fix)
		this.saveInProgress = false;
		
		// Initialize error handler (extracted for separation of concerns)
		this.errorHandler = new APIErrorHandler( {
			editor: editor
		} );
		this.errorHandler.setEnableSaveButtonCallback( () => this.enableSaveButton() );

		// Initialize export controller (extracted for separation of concerns)
		this.exportController = new ExportController( editor );
	}

	/**
	 * Abort any pending request for the given operation type and track the new one.
	 * This prevents out-of-order completion when user switches sets/revisions quickly.
	 *
	 * @param {string} operationType - Key identifying the operation (e.g., 'loadRevision')
	 * @param {Object} jqXHR - jQuery XHR object with abort() method
	 * @private
	 */
	_trackRequest( operationType, jqXHR ) {
		// Abort any existing request for this operation type
		const existing = this.pendingRequests.get( operationType );
		if ( existing && typeof existing.abort === 'function' ) {
			existing.abort();
		}
		this.pendingRequests.set( operationType, jqXHR );
	}

	/**
	 * Clear the tracked request for an operation type (call on success or handled error).
	 *
	 * @param {string} operationType - Key identifying the operation
	 * @private
	 */
	_clearRequest( operationType ) {
		this.pendingRequests.delete( operationType );
	}

	/**
	 * Abort all pending requests (for cleanup on destroy).
	 * @private
	 */
	_abortAllRequests() {
		for ( const jqXHR of this.pendingRequests.values() ) {
			if ( jqXHR && typeof jqXHR.abort === 'function' ) {
				jqXHR.abort();
			}
		}
		this.pendingRequests.clear();
	}

	/**
	 * Schedule a timeout with automatic tracking for cleanup.
	 * Use this instead of raw setTimeout to prevent memory leaks.
	 *
	 * @param {Function} callback - Function to execute after delay
	 * @param {number} delay - Delay in milliseconds
	 * @return {number} Timeout ID
	 * @private
	 */
	_scheduleTimeout( callback, delay ) {
		const timeoutId = setTimeout( () => {
			this.activeTimeouts.delete( timeoutId );
			try {
				callback();
			} catch ( error ) {
				// Log callback errors but don't let them crash the application
				if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
					mw.log.error( 'Layers APIManager: Scheduled callback error:', error );
				}
			}
		}, delay );
		this.activeTimeouts.add( timeoutId );
		return timeoutId;
	}

	/**
	 * Clear all active timeouts (for cleanup)
	 * @private
	 */
	_clearAllTimeouts() {
		for ( const timeoutId of this.activeTimeouts ) {
			clearTimeout( timeoutId );
		}
		this.activeTimeouts.clear();
	}

	/**
	 * Get a cached API response if available and not expired.
	 * @param {string} key - Cache key
	 * @return {Object|null} Cached data or null if not found/expired
	 * @private
	 */
	_getCached( key ) {
		const entry = this.responseCache.get( key );
		if ( !entry ) {
			return null;
		}
		// Check if expired
		if ( Date.now() - entry.timestamp > this.cacheTTL ) {
			this.responseCache.delete( key );
			return null;
		}
		// LRU behavior: move to end by re-inserting
		this.responseCache.delete( key );
		this.responseCache.set( key, entry );
		return entry.data;
	}

	/**
	 * Store data in the response cache.
	 * @param {string} key - Cache key
	 * @param {Object} data - Data to cache
	 * @private
	 */
	_setCache( key, data ) {
		// Enforce max size by removing oldest entries (LRU)
		while ( this.responseCache.size >= this.cacheMaxSize ) {
			const firstKey = this.responseCache.keys().next().value;
			this.responseCache.delete( firstKey );
		}
		this.responseCache.set( key, {
			data: data,
			timestamp: Date.now()
		} );
	}

	/**
	 * Invalidate cache entries for a specific file or all entries.
	 * @param {string} [filename] - Filename to invalidate, or omit to clear all
	 * @private
	 */
	_invalidateCache( filename ) {
		if ( !filename ) {
			this.responseCache.clear();
			return;
		}
		// Remove all entries for this filename
		for ( const key of this.responseCache.keys() ) {
			if ( key.startsWith( filename + ':' ) ) {
				this.responseCache.delete( key );
			}
		}
	}

	/**
	 * Build a cache key for layersinfo requests.
	 * @param {string} filename - File name
	 * @param {Object} [options] - Options: setname or layersetid
	 * @return {string} Cache key
	 * @private
	 */
	_buildCacheKey( filename, options = {} ) {
		if ( options.layersetid ) {
			return `${ filename }:id:${ options.layersetid }`;
		}
		if ( options.setname ) {
			return `${ filename }:set:${ options.setname }`;
		}
		return `${ filename }:default`;
	}

	/**
	 * Delegate error handling to APIErrorHandler
	 * @param {*} error Error object from API call
	 * @param {string} operation Operation that failed (load, save, etc.)
	 * @param {Object} context Additional context for error handling
	 * @return {Object} Standardized error object
	 */
	handleError( error, operation = 'generic', context = {} ) {
		return this.errorHandler.handleError( error, operation, context );
	}

	/**
	 * Delegate normalizeError to APIErrorHandler (backward compatibility)
	 * @param {*} error Raw error from API or other source
	 * @return {Object} Normalized error object
	 */
	normalizeError( error ) {
		return this.errorHandler.normalizeError( error );
	}

	/**
	 * Delegate getUserMessage to APIErrorHandler (backward compatibility)
	 * @param {Object} normalizedError Normalized error object
	 * @param {string} operation Operation that failed
	 * @return {string} User-friendly error message
	 */
	getUserMessage( normalizedError, operation ) {
		return this.errorHandler.getUserMessage( normalizedError, operation );
	}

	/**
	 * Delegate showUserNotification to APIErrorHandler (backward compatibility)
	 * @param {string} message Message to show
	 * @param {string} type Notification type (error, warning, success)
	 */
	showUserNotification( message, type = 'error' ) {
		return this.errorHandler.showUserNotification( message, type );
	}
	
	/**
	 * Show spinner if uiManager is available
	 * @param {string} [message] - Optional message to display
	 * @private
	 */
	showSpinner( message ) {
		if ( this.editor && this.editor.uiManager && typeof this.editor.uiManager.showSpinner === 'function' ) {
			this.editor.uiManager.showSpinner( message );
		}
	}

	/**
	 * Hide spinner if uiManager is available
	 * @private
	 */
	hideSpinner() {
		if ( this.editor && this.editor.uiManager && typeof this.editor.uiManager.hideSpinner === 'function' ) {
			this.editor.uiManager.hideSpinner();
		}
	}

	/**
	 * Load layers for the current file
	 */
	loadLayers() {
		return new Promise( ( resolve, reject ) => {
			// Set loading state to prevent user interactions during load
			if ( this.editor.stateManager ) {
				this.editor.stateManager.set( 'isLoading', true );
			}
			this.showSpinner( this.getMessage( 'layers-loading' ) );

			this.api.get( {
				action: 'layersinfo',
				filename: this.editor.filename,
				format: 'json',
				formatversion: 2
			} ).then( ( data ) => {
				this.hideSpinner();
				this.processLayersData( data );
				// Clear loading state after processing
				if ( this.editor.stateManager ) {
					this.editor.stateManager.set( 'isLoading', false );
				}
				resolve( {
					layers: this.editor.stateManager.get( 'layers' ) || [],
					baseWidth: this.editor.stateManager.get( 'baseWidth' ),
					baseHeight: this.editor.stateManager.get( 'baseHeight' ),
					allLayerSets: this.editor.stateManager.get( 'allLayerSets' ) || [],
					currentLayerSetId: this.editor.stateManager.get( 'currentLayerSetId' )
				} );
			} ).catch( ( code, result ) => {
				this.hideSpinner();
				// Clear loading state on error
				if ( this.editor.stateManager ) {
					this.editor.stateManager.set( 'isLoading', false );
				}
				const standardizedError = this.handleLoadError( code, result );
				reject( standardizedError );
			} );
		} );
	}

	/**
	 * Process the layers data from the API response
	 */
	processLayersData( data ) {
		try {
			if ( !data || !data.layersinfo ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[APIManager] No layersinfo in API response' );
				}
				return;
			}

			const layersInfo = data.layersinfo;

			// Process the current layer set if it exists
			if ( layersInfo.layerset ) {
				this.extractLayerSetData( layersInfo.layerset );
				// Extract set name from layerset if available
				if ( layersInfo.layerset.name ) {
					this.editor.stateManager.set( 'currentSetName', layersInfo.layerset.name );
				}
			} else {
				// No layerset, set empty state (batch update for performance)
				this.editor.stateManager.update( {
					layers: [],
					currentLayerSetId: null,
					baseWidth: null,
					baseHeight: null
				} );
			}

			// Process all layer sets for the revision selector (batch update for performance)
			if ( Array.isArray( layersInfo.all_layersets ) ) {
				this.editor.stateManager.update( {
					allLayerSets: layersInfo.all_layersets,
					setRevisions: layersInfo.all_layersets
				} );
			} else {
				this.editor.stateManager.update( {
					allLayerSets: [],
					setRevisions: []
				} );
			}

			// Process named sets for the set selector
			if ( Array.isArray( layersInfo.named_sets ) ) {
				this.editor.stateManager.set( 'namedSets', layersInfo.named_sets );
				// Build the set selector UI
				this.editor.buildSetSelector();
			}

			// Build the revision selector UI
			this.editor.buildRevisionSelector();

			// Render the layers
			const layers = this.editor.stateManager.get( 'layers' ) || [];
			if ( this.editor.canvasManager ) {
				// Clear any existing selection when loading layers
				// This ensures clean state on initial load and refresh
				if ( this.editor.canvasManager.selectionManager ) {
					this.editor.canvasManager.selectionManager.clearSelection();
				}
				this.editor.canvasManager.renderLayers( layers );
			}

			// Update the layer panel UI
			if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateLayers === 'function' ) {
				this.editor.layerPanel.updateLayers( layers );
			}

			// Debug logging controlled by extension config
			if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
				mw.log( '[APIManager] Processed layers data:', {
					layersCount: layers.length,
					currentLayerSetId: this.editor.stateManager.get( 'currentLayerSetId' ),
					currentSetName: this.editor.stateManager.get( 'currentSetName' ),
					allLayerSetsCount: ( layersInfo.all_layersets || [] ).length,
					namedSetsCount: ( layersInfo.named_sets || [] ).length
				} );
			}

		} catch ( error ) {
			const standardizedError = this.handleError( error, 'load', { phase: 'processLayersData' } );
			this.handleLoadError( 'process-error', { error: standardizedError } );
		}
	}	extractLayerSetData( layerSet ) {
		// Defensive null check - layerSet can be null when no layers exist for the file
		if ( !layerSet ) {
			this.editor.stateManager.set( 'baseWidth', null );
			this.editor.stateManager.set( 'baseHeight', null );
			this.editor.stateManager.set( 'backgroundVisible', true );
			this.editor.stateManager.set( 'backgroundOpacity', 1.0 );
			this.editor.stateManager.set( 'layers', [] );
			return;
		}

		const baseWidth = layerSet.baseWidth || null;
		const baseHeight = layerSet.baseHeight || null;

		this.editor.stateManager.set( 'baseWidth', baseWidth );
		this.editor.stateManager.set( 'baseHeight', baseHeight );

		if ( this.editor.canvasManager && this.editor.canvasManager.setBaseDimensions ) {
			this.editor.canvasManager.setBaseDimensions( baseWidth, baseHeight );
		}

		// Handle both old format (layers array) and new format (object with layers + settings)
		let rawLayers;
		let backgroundVisible = true;
		let backgroundOpacity = 1.0;
		let slideCanvasWidth = null;
		let slideCanvasHeight = null;
		let slideBackgroundColor = null;
		
		if ( layerSet.data ) {
			if ( Array.isArray( layerSet.data ) ) {
				// Old format: data is just the layers array
				rawLayers = layerSet.data;
			} else if ( layerSet.data.layers ) {
				// New format: data is an object with layers and settings
				rawLayers = layerSet.data.layers || [];
				// Normalize backgroundVisible to boolean - API returns 0/1 integers
				// 0, false, "false", "0" should all be treated as hidden
				const bgVal = layerSet.data.backgroundVisible;
				if ( bgVal === undefined || bgVal === null ) {
					backgroundVisible = true;
				} else if ( bgVal === false || bgVal === 0 || bgVal === '0' || bgVal === 'false' ) {
					backgroundVisible = false;
				} else {
					backgroundVisible = true;
				}
				backgroundOpacity = layerSet.data.backgroundOpacity !== undefined ? 
					layerSet.data.backgroundOpacity : 1.0;
				
				// Extract slide-specific data if present
				if ( layerSet.data.canvasWidth ) {
					slideCanvasWidth = layerSet.data.canvasWidth;
				}
				if ( layerSet.data.canvasHeight ) {
					slideCanvasHeight = layerSet.data.canvasHeight;
				}
				if ( layerSet.data.backgroundColor ) {
					slideBackgroundColor = layerSet.data.backgroundColor;
				}
			} else {
				rawLayers = [];
			}
		} else {
			rawLayers = [];
		}
		
		const processedLayers = this.processRawLayers( rawLayers );
		
		// Set background settings BEFORE setting layers
		// This ensures correct values are available when the layers subscription triggers renderLayerList
		this.editor.stateManager.set( 'backgroundVisible', backgroundVisible );
		this.editor.stateManager.set( 'backgroundOpacity', backgroundOpacity );

		// Update slide-specific state if we loaded slide data
		const isSlide = this.editor.stateManager.get( 'isSlide' );
		if ( isSlide ) {
			if ( slideCanvasWidth ) {
				this.editor.stateManager.set( 'slideCanvasWidth', slideCanvasWidth );
				this.editor.stateManager.set( 'baseWidth', slideCanvasWidth );
			}
			if ( slideCanvasHeight ) {
				this.editor.stateManager.set( 'slideCanvasHeight', slideCanvasHeight );
				this.editor.stateManager.set( 'baseHeight', slideCanvasHeight );
			}
			if ( slideBackgroundColor ) {
				this.editor.stateManager.set( 'slideBackgroundColor', slideBackgroundColor );
				// Update canvas manager
				if ( this.editor.canvasManager && this.editor.canvasManager.setBackgroundColor ) {
					this.editor.canvasManager.setBackgroundColor( slideBackgroundColor );
				}
			}
			// Resize canvas if dimensions changed
			if ( ( slideCanvasWidth || slideCanvasHeight ) && this.editor.canvasManager ) {
				const width = slideCanvasWidth || this.editor.stateManager.get( 'slideCanvasWidth' ) || 800;
				const height = slideCanvasHeight || this.editor.stateManager.get( 'slideCanvasHeight' ) || 600;
				if ( this.editor.canvasManager.setBaseDimensions ) {
					this.editor.canvasManager.setBaseDimensions( width, height );
				}
			}
		}
		
		// Now set layers - this triggers the subscription which renders the layer list
		// including the background layer item (which now has correct visibility/opacity values)
		this.editor.stateManager.set( 'layers', processedLayers );
		this.editor.stateManager.set( 'currentLayerSetId', layerSet.id || null );
		
		// Update layer panel UI to ensure background item is updated
		// (This may be redundant now but keeps explicit sync)
		if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateBackgroundLayerItem === 'function' ) {
			this.editor.layerPanel.updateBackgroundLayerItem();
		}
	}

	/**
	 * Generate a unique layer ID.
	 * Delegates to the shared IdGenerator utility.
	 * @return {string} A unique layer ID
	 */
	generateLayerId() {
		return ( window.Layers && window.Layers.Utils && window.Layers.Utils.generateLayerId )
			? window.Layers.Utils.generateLayerId()
			: 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	}

	processRawLayers( rawLayers ) {
		return rawLayers.map( layer => {
			if ( !layer.id ) {
				layer.id = this.generateLayerId();
			}
			// Use shared normalizer (guaranteed to be loaded via ext.layers.shared dependency)
			if ( LayerDataNormalizer && typeof LayerDataNormalizer.normalizeLayer === 'function' ) {
				LayerDataNormalizer.normalizeLayer( layer );
			}
			return layer;
		} );
	}

	handleLoadError( code, result ) {
		// Use the new standardized error handling
		const errorInfo = { error: { code: code, info: result && result.error && result.error.info } };
		return this.handleError( errorInfo, 'load', { code: code, result: result } );
	}

	/**
	 * Process revision data after loading (shared by cache hit and API response).
	 * @param {Object} data - API response data
	 * @param {boolean} fromCache - Whether data came from cache
	 * @return {Object} The processed data
	 * @private
	 */
	_processRevisionData( data, fromCache = false ) {
		this.extractLayerSetData( data.layersinfo.layerset );
		// Only update allLayerSets if response contains data (preserve existing list)
		if ( data.layersinfo.all_layersets && data.layersinfo.all_layersets.length > 0 ) {
			this.editor.stateManager.set( 'allLayerSets', data.layersinfo.all_layersets );
		}
		this.editor.buildRevisionSelector();

		// Clear any existing selection when loading a different revision
		// This prevents stale selection state from persisting
		if ( this.editor.canvasManager && this.editor.canvasManager.selectionManager ) {
			this.editor.canvasManager.selectionManager.clearSelection();
		}

		this.editor.renderLayers();
		this.editor.stateManager.set( 'isDirty', false );

		// Update the layer panel UI after loading revision
		const layers = this.editor.stateManager.get( 'layers' ) || [];
		if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateLayers === 'function' ) {
			this.editor.layerPanel.updateLayers( layers );
		}

		// CRITICAL: Reset history with the loaded revision's layers as baseline
		// This prevents undo from restoring the previous revision's state
		if ( this.editor.historyManager && typeof this.editor.historyManager.saveInitialState === 'function' ) {
			this.editor.historyManager.saveInitialState();
		}

		const cacheHint = fromCache ? ' (from cache)' : '';
		mw.notify( this.getMessage( 'layers-revision-loaded' ) + cacheHint, { type: 'success' } );
		return data;
	}

	/**
	 * Load a specific revision by ID
	 */
	loadRevisionById( revisionId ) {
		return new Promise( ( resolve, reject ) => {
			// Check cache first
			const cacheKey = this._buildCacheKey( this.editor.filename, { layersetid: revisionId } );
			const cachedData = this._getCached( cacheKey );
			if ( cachedData && cachedData.layersinfo && cachedData.layersinfo.layerset ) {
				// Use cached data
				try {
					const result = this._processRevisionData( cachedData, true );
					resolve( result );
				} catch ( error ) {
					// Cache data was invalid, fall through to API fetch
					this.responseCache.delete( cacheKey );
				}
				return;
			}

			this.showSpinner( this.getMessage( 'layers-loading' ) );

			const jqXHR = this.api.get( {
				action: 'layersinfo',
				filename: this.editor.filename,
				layersetid: revisionId,
				format: 'json',
				formatversion: 2
			} );

			// Track request to abort any pending load if user switches quickly
			this._trackRequest( 'loadRevision', jqXHR );

			jqXHR.then( ( data ) => {
				this._clearRequest( 'loadRevision' );
				this.hideSpinner();
				if ( data.layersinfo && data.layersinfo.layerset ) {
					// Cache the response
					this._setCache( cacheKey, data );
					const result = this._processRevisionData( data, false );
					resolve( result );
				} else {
					reject( new Error( 'Revision not found' ) );
				}
			} ).catch( ( code, result ) => {
				this._clearRequest( 'loadRevision' );
				// Ignore aborted requests (user switched before this completed)
				if ( code === 'http' && result && result.textStatus === 'abort' ) {
					if ( this.rejectAbortedRequests ) {
						reject( { aborted: true, code, result } );
					}
					return;
				}
				this.hideSpinner();
				const errorMsg = result && result.error && result.error.info
					? result.error.info
					: this.getMessage( 'layers-revision-not-found' );
				mw.notify( errorMsg, { type: 'error' } );
				reject( { code, result } );
			} );
		} );
	}

	/**
	 * Process layer set data loaded by name (shared by cache hit and API response).
	 * @param {Object} data - API response data
	 * @param {string} setName - Name of the layer set
	 * @param {boolean} fromCache - Whether data came from cache
	 * @return {Object} Processed result
	 * @private
	 */
	_processSetNameData( data, setName, fromCache = false ) {
		const layersInfo = data.layersinfo;

		// Process the current layer set
		if ( layersInfo.layerset ) {
			this.extractLayerSetData( layersInfo.layerset );
			// Use set_revisions (specific to this named set) if available,
			// otherwise fall back to all_layersets for backwards compatibility
			const revisions = Array.isArray( layersInfo.set_revisions )
				? layersInfo.set_revisions
				: ( Array.isArray( layersInfo.all_layersets ) ? layersInfo.all_layersets : [] );
			this.editor.stateManager.set( 'setRevisions', revisions );
			this.editor.stateManager.set( 'allLayerSets', revisions );
		} else {
			// Set doesn't exist yet or has no revisions - empty state
			this.editor.stateManager.set( 'layers', [] );
			this.editor.stateManager.set( 'currentLayerSetId', null );
			this.editor.stateManager.set( 'setRevisions', [] );
			// Initialize background settings for new layer sets
			this.editor.stateManager.set( 'backgroundVisible', true );
			this.editor.stateManager.set( 'backgroundOpacity', 1.0 );
		}

		// Update current set name in state FIRST (before building selectors)
		this.editor.stateManager.set( 'currentSetName', setName );

		// Update named sets list if provided
		if ( Array.isArray( layersInfo.named_sets ) ) {
			this.editor.stateManager.set( 'namedSets', layersInfo.named_sets );
			this.editor.buildSetSelector();
		}

		// Update the revision selector UI
		this.editor.buildRevisionSelector();

		// Render layers
		const layers = this.editor.stateManager.get( 'layers' ) || [];
		if ( this.editor.canvasManager ) {
			// Clear any existing selection when switching layer sets
			// This prevents stale selection state from persisting
			if ( this.editor.canvasManager.selectionManager ) {
				this.editor.canvasManager.selectionManager.clearSelection();
			}
			this.editor.canvasManager.renderLayers( layers );
		}

		// Update layer panel
		if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateLayers === 'function' ) {
			this.editor.layerPanel.updateLayers( layers );
		}

		// CRITICAL: Reset history with the new layer set's layers as baseline
		// This prevents undo from restoring the previous layer set's state
		if ( this.editor.historyManager && typeof this.editor.historyManager.saveInitialState === 'function' ) {
			this.editor.historyManager.saveInitialState();
		}

		// Mark as clean (no unsaved changes)
		this.editor.stateManager.set( 'hasUnsavedChanges', false );
		this.editor.stateManager.set( 'isDirty', false );

		// Clear loading state after successful load
		if ( this.editor.stateManager ) {
			this.editor.stateManager.set( 'isLoading', false );
		}

		// Debug logging controlled by extension config
		const cacheHint = fromCache ? ' (from cache)' : '';
		if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
			mw.log( '[APIManager] Loaded layer set by name' + cacheHint + ':', {
				setName: setName,
				layersCount: layers.length,
				currentLayerSetId: this.editor.stateManager.get( 'currentLayerSetId' ),
				revisionsCount: ( layersInfo.all_layersets || [] ).length
			} );
		}

		return {
			layers: layers,
			setName: setName,
			currentLayerSetId: this.editor.stateManager.get( 'currentLayerSetId' ),
			revisions: this.editor.stateManager.get( 'setRevisions' ) || []
		};
	}

	/**
	 * Load layers by set name
	 * Fetches a specific named layer set and its revision history
	 * @param {string} setName - The name of the set to load
	 * @param {Object} [options] - Options
	 * @param {boolean} [options.skipCache=false] - Skip cache and fetch fresh data
	 * @return {Promise} Resolves with the layer data
	 */
	loadLayersBySetName( setName, options = {} ) {
		return new Promise( ( resolve, reject ) => {
			if ( !setName ) {
				reject( new Error( 'No set name provided' ) );
				return;
			}

			// Check cache first (unless skipCache is set)
			const cacheKey = this._buildCacheKey( this.editor.filename, { setname: setName } );
			if ( !options.skipCache ) {
				const cachedData = this._getCached( cacheKey );
				if ( cachedData ) {
					try {
						const result = this._processSetNameData( cachedData, setName, true );
						resolve( result );
						return;
					} catch ( error ) {
						// Cache data was invalid, fall through to API fetch
						this.responseCache.delete( cacheKey );
					}
				}
			}

			// Set loading state to prevent user interactions during load
			if ( this.editor.stateManager ) {
				this.editor.stateManager.set( 'isLoading', true );
			}
			this.showSpinner( this.getMessage( 'layers-loading' ) );

			const jqXHR = this.api.get( {
				action: 'layersinfo',
				filename: this.editor.filename,
				setname: setName,
				format: 'json',
				formatversion: 2
			} );

			// Track request to abort any pending load if user switches sets quickly
			this._trackRequest( 'loadSetByName', jqXHR );

			jqXHR.then( ( data ) => {
				this._clearRequest( 'loadSetByName' );
				this.hideSpinner();

				if ( !data || !data.layersinfo ) {
					reject( new Error( 'Invalid API response' ) );
					return;
				}

				// Cache the response
				this._setCache( cacheKey, data );

				const result = this._processSetNameData( data, setName, false );
				resolve( result );

			} ).catch( ( code, result ) => {
				this._clearRequest( 'loadSetByName' );
				// Ignore aborted requests (user switched before this completed)
				if ( code === 'http' && result && result.textStatus === 'abort' ) {
					// Clear loading state even for aborted requests
					if ( this.editor.stateManager ) {
						this.editor.stateManager.set( 'isLoading', false );
					}
					if ( this.rejectAbortedRequests ) {
						reject( { aborted: true, code, result } );
					}
					return;
				}
				this.hideSpinner();
				// Clear loading state on error
				if ( this.editor.stateManager ) {
					this.editor.stateManager.set( 'isLoading', false );
				}
				const standardizedError = this.handleError(
					{ error: { code: code, info: result && result.error && result.error.info } },
					'load',
					{ setName: setName }
				);
				reject( standardizedError );
			} );
		} );
	}
	saveLayers() {
		return new Promise( ( resolve, reject ) => {
			// Prevent concurrent save operations (CORE-3 fix)
			if ( this.saveInProgress ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[APIManager] Save already in progress, ignoring duplicate request' );
				}
				reject( new Error( 'Save already in progress' ) );
				return;
			}

			if ( !this.validateBeforeSave() ) {
				mw.notify( 'Save failed: validation error. Check browser console (F12) for details.', { type: 'error' } );
				reject( new Error( 'Validation failed' ) );
				return;
			}

			this.saveInProgress = true;
			this.showSpinner( this.getMessage( 'layers-saving' ) );
			this.disableSaveButton();

			let payload;
			let layersJson;
			try {
				payload = this.buildSavePayload();
				layersJson = JSON.stringify( this.editor.stateManager.get( 'layers' ) || [] );
			} catch ( buildError ) {
				mw.log.error( '[APIManager] saveLayers: failed to build payload:', buildError.message );
				this.hideSpinner();
				this.saveInProgress = false;
				this.enableSaveButton();
				reject( buildError );
				return;
			}

			if ( !this.checkSizeLimit( layersJson ) ) {
				mw.log.error( '[APIManager] saveLayers: data too large' );
				this.hideSpinner();
				this.saveInProgress = false;
				reject( new Error( 'Data too large' ) );
				return;
			}

			this.performSaveWithRetry( payload, 0, resolve, reject );
		} );
	}

	validateBeforeSave() {
		const layers = this.editor.stateManager.get( 'layers' ) || [];
		
		const LayersValidator = getClass( 'Validation.LayersValidator', 'LayersValidator' );
		if ( !LayersValidator ) {
			return true;
		}
		
		const validator = new LayersValidator();
		const validationResult = validator.validateLayers( layers, 100 );

		if ( !validationResult.isValid ) {
			validator.showValidationErrors( validationResult.errors, 'save' );
			return false;
		}

		if ( validationResult.warnings && validationResult.warnings.length > 0 ) {
			const warningMsg = 'Warnings: ' + validationResult.warnings.join( '; ' );
			mw.notify( warningMsg, { type: 'warn' } );
		}
		
		return true;
	}

	buildSavePayload() {
		const layers = this.editor.stateManager.get( 'layers' ) || [];
		const isSlide = this.editor.stateManager.get( 'isSlide' );
		
		// Include background settings in the saved data
		const backgroundVisible = this.editor.stateManager.get( 'backgroundVisible' );
		const backgroundOpacity = this.editor.stateManager.get( 'backgroundOpacity' );
		
		// Build data object with layers and background settings
		const dataObject = {
			layers: layers,
			backgroundVisible: backgroundVisible !== undefined ? backgroundVisible : true,
			backgroundOpacity: backgroundOpacity !== undefined ? backgroundOpacity : 1.0
		};

		// For slides, include canvas dimensions and background color
		if ( isSlide ) {
			dataObject.canvasWidth = this.editor.stateManager.get( 'slideCanvasWidth' ) || 800;
			dataObject.canvasHeight = this.editor.stateManager.get( 'slideCanvasHeight' ) || 600;
			dataObject.backgroundColor = this.editor.stateManager.get( 'slideBackgroundColor' ) || '#ffffff';
		}
		
		const layersJson = JSON.stringify( dataObject );
		
		// Get current set name from state, fallback to 'default'
		const currentSetName = this.editor.stateManager.get( 'currentSetName' ) || 'default';
		
		// Debug logging controlled by extension config
		if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
			mw.log( '[APIManager] Building save payload:', {
				filename: this.editor.filename,
				setname: currentSetName,
				layerCount: layers.length,
				dataSize: layersJson.length,
				dataSample: layersJson.substring( 0, 200 )
			} );
		}
		
		const payload = {
			action: 'layerssave',
			filename: this.editor.filename,
			data: layersJson,
			setname: currentSetName,
			format: 'json',
			formatversion: 2
		};

		return payload;
	}

	performSaveWithRetry( payload, attempt, resolve, reject ) {
		this.api.postWithToken( 'csrf', payload ).then( ( data ) => {
			// Debug logging controlled by extension config
			if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
				mw.log( '[APIManager] Save response received:', JSON.stringify( data ) );
			}
			
			this.saveInProgress = false; // Clear save-in-progress flag
			this.hideSpinner();
			this.enableSaveButton();
			this.handleSaveSuccess( data );
			resolve( data );
		} ).catch( ( code, result ) => {
			// Log errors for debugging (controlled by extension config)
			if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
				mw.log.error( '[APIManager] Save error caught:', {
					code: code,
					result: result,
					attempt: attempt
				} );
			}

			const error = ( result && result.error ) || { code: code, info: ( result && result.exception ) || 'No details' };
			const isRetryable = this.isRetryableError( error );
			const canRetry = attempt < this.maxRetries - 1 && isRetryable;

			if ( canRetry ) {
				const delay = this.retryDelay * Math.pow( 2, attempt ); // Exponential backoff
				if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
					mw.log( `[APIManager] Retrying save after delay: ${delay}ms` );
				}
				this._scheduleTimeout( () => {
					this.performSaveWithRetry( payload, attempt + 1, resolve, reject );
				}, delay );
			} else {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( `[APIManager] Save failed after ${attempt + 1} attempts` );
				}
				this.saveInProgress = false; // Clear save-in-progress flag on final failure
				this.hideSpinner();
				this.enableSaveButton();
				this.handleSaveError( error );
				reject( error );
			}
		} );
	}

	disableSaveButton() {
		if ( this.editor.toolbar && this.editor.toolbar.saveButton ) {
			this.editor.toolbar.saveButton.disabled = true;
		}
	}

	enableSaveButton() {
		if ( this.editor.toolbar && this.editor.toolbar.saveButton ) {
			this.editor.toolbar.saveButton.disabled = false;
		}
	}

	handleSaveSuccess( data ) {
		// Debug logging controlled by extension config
		if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
			mw.log( '[APIManager] handleSaveSuccess called with:', JSON.stringify( data ) );
			mw.log( '[APIManager] currentSetName at save success:', this.editor.stateManager.get( 'currentSetName' ) );
		}

		if ( data.layerssave && data.layerssave.success ) {
			this.editor.stateManager.markClean();

			// CORE-2 FIX: Mark history as saved for efficient hasUnsavedChanges()
			if ( this.editor.historyManager && typeof this.editor.historyManager.markAsSaved === 'function' ) {
				this.editor.historyManager.markAsSaved();
			}

			// Clear draft on successful save
			if ( this.editor.draftManager && typeof this.editor.draftManager.onSaveSuccess === 'function' ) {
				this.editor.draftManager.onSaveSuccess();
			}

			// Invalidate API response cache for this file since data has changed
			// This ensures subsequent loads fetch fresh data
			this._invalidateCache( this.editor.filename );

			// Clear the FreshnessChecker cache for this file so FR-10 will check
			// the API for fresh data when the user views the page after saving.
			// This prevents stale sessionStorage cache from causing reinitialization to be skipped.
			this.clearFreshnessCache();

			const successMsg = this.getMessage( 'layers-save-success' );
			mw.notify( successMsg, { type: 'success' } );
			// Announce for screen readers
			if ( window.layersAnnouncer ) {
				window.layersAnnouncer.announceSuccess( successMsg );
			}
			this.reloadRevisions();
		} else {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.error( '[APIManager] Save did not return success:', data );
			}
			this.handleSaveError( data );
		}
	}

	handleSaveError( error ) {
		// Log the raw error object for maximum detail.
		const errorCode = error.code || 'unknown';
		const errorInfo = error.info || 'No additional information';
		if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( `[APIManager] Detailed Save Error. Code: ${errorCode}, Info: ${errorInfo}`, error );
		}

		// Use centralized error handling
		return this.handleError( error, 'save', { rawError: error } );
	}

	reloadRevisions() {
		// Get the current set name to reload the correct set's data
		const currentSetName = this.editor.stateManager.get( 'currentSetName' ) || 'default';
		if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
			mw.log( '[APIManager] reloadRevisions for set:', currentSetName );
		}

		this.api.get( {
			action: 'layersinfo',
			filename: this.editor.filename,
			setname: currentSetName,
			format: 'json',
			formatversion: 2
		} ).then( ( data ) => {
			if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
				mw.log( '[APIManager] reloadRevisions response:', JSON.stringify( data ) );
			}

			if ( data.layersinfo ) {
				// Update revision history for the current set (all_layersets contains revisions for this named set)
				if ( Array.isArray( data.layersinfo.all_layersets ) ) {
					if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
						mw.log( '[APIManager] Setting allLayerSets:', data.layersinfo.all_layersets.length, 'revisions' );
					}
					this.editor.stateManager.set( 'allLayerSets', data.layersinfo.all_layersets.slice() );
					// Also update setRevisions for the revision selector
					this.editor.stateManager.set( 'setRevisions', data.layersinfo.all_layersets.slice() );
				}
				// Update the named sets list (for the set selector dropdown)
				if ( Array.isArray( data.layersinfo.named_sets ) ) {
					if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
						mw.log( '[APIManager] Setting namedSets:', data.layersinfo.named_sets.map( s => s.name ) );
					}
					this.editor.stateManager.set( 'namedSets', data.layersinfo.named_sets.slice() );
					// Rebuild set selector to show updated list
					if ( this.editor.buildSetSelector ) {
						this.editor.buildSetSelector();
					}
				}
				// Update current layer set ID from the returned layerset
				if ( data.layersinfo.layerset && data.layersinfo.layerset.id ) {
					if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
						mw.log( '[APIManager] Setting currentLayerSetId:', data.layersinfo.layerset.id );
					}
					this.editor.stateManager.set( 'currentLayerSetId', data.layersinfo.layerset.id );
				} else if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
					mw.log( '[APIManager] No layerset returned from API (new set not found?)' );
				}
				this.editor.buildRevisionSelector();
				if ( this.editor.uiManager && this.editor.uiManager.revNameInputEl ) {
					this.editor.uiManager.revNameInputEl.value = '';
				}
			}
		} ).catch( ( error ) => {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[APIManager] reloadRevisions error:', error );
			}
			// Show subtle notification for revision reload failures
			if ( typeof mw !== 'undefined' && mw.notify ) {
				mw.notify(
					this.getMessage( 'layers-revision-reload-failed', 'Could not refresh revision list' ),
					{ type: 'warn', autoHide: true, autoHideSeconds: 3 }
				);
			}
		} );
	}

	/**
	 * Delete a named layer set.
	 * Only the original creator or an admin can delete a set.
	 *
	 * @param {string} setName - Name of the layer set to delete
	 * @return {Promise} Resolves with result or rejects with error
	 */
	deleteLayerSet( setName ) {
		return new Promise( ( resolve, reject ) => {
			if ( !setName ) {
				reject( new Error( 'Set name is required' ) );
				return;
			}

			// Get filename from editor config (not stateManager)
			const filename = this.editor.filename ||
				( this.editor.config && this.editor.config.filename ) ||
				( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersEditorInit' ) &&
					mw.config.get( 'wgLayersEditorInit' ).filename );
			if ( !filename ) {
				reject( new Error( 'No filename available' ) );
				return;
			}

			if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
				mw.log( '[APIManager] deleteLayerSet:', setName, 'for file:', filename );
			}

			this.showSpinner();

			this.api.postWithToken( 'csrf', {
				action: 'layersdelete',
				filename: filename,
				setname: setName
			} ).then( ( data ) => {
				this.hideSpinner();

				// Check for API error in response
				if ( data.error ) {
					const errorCode = data.error.code || 'unknown';
					const errorInfo = data.error.info || 'Unknown error';
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.error( '[APIManager] deleteLayerSet API error:', errorCode, errorInfo );
					}

					if ( errorCode === 'permissiondenied' ) {
						const msg = this.getMessage(
							'layers-delete-permission-denied',
							'You do not have permission to delete this layer set'
						);
						mw.notify( msg, { type: 'error' } );
						reject( new Error( msg ) );
						return;
					}

					const msg = this.getMessage( 'layers-delete-failed', 'Failed to delete layer set' );
					mw.notify( msg + ': ' + errorInfo, { type: 'error' } );
					reject( new Error( errorInfo ) );
					return;
				}

				if ( data.layersdelete && data.layersdelete.success ) {
					const msg = this.getMessage(
						'layers-delete-set-success',
						`Layer set "${setName}" deleted`
					).replace( '$1', setName ).replace( '$2', data.layersdelete.revisionsDeleted || 0 );

					mw.notify( msg, { type: 'success' } );

					// Reload to switch to another set or show empty state
					this.loadLayers().then( () => {
						resolve( data.layersdelete );
					} ).catch( ( reloadErr ) => {
						// Even if reload fails, the delete succeeded
						if ( typeof mw !== 'undefined' && mw.log ) {
							mw.log.warn( '[APIManager] Reload after delete failed:', reloadErr );
						}
						mw.notify( this.getMessage( 'layers-reload-warning', 'Layer list may need manual refresh' ), { type: 'warn' } );
						resolve( data.layersdelete );
					} );
				} else {
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.error( '[APIManager] deleteLayerSet unexpected response:', data );
					}
					const errorMsg = this.getMessage( 'layers-delete-failed', 'Failed to delete layer set' );
					mw.notify( errorMsg, { type: 'error' } );
					reject( new Error( errorMsg ) );
				}
			} ).catch( ( code, data ) => {
				this.hideSpinner();

				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[APIManager] deleteLayerSet error:', code, data );
				}

				// Check for permission denied
				if ( code === 'permissiondenied' ) {
					const msg = this.getMessage(
						'layers-delete-permission-denied',
						'You do not have permission to delete this layer set'
					);
					mw.notify( msg, { type: 'error' } );
					reject( new Error( msg ) );
					return;
				}

				// Handle other API errors
				const errorInfo = ( data && data.error && data.error.info ) || code || 'Unknown error';
				const errorMsg = this.getMessage( 'layers-delete-failed', 'Failed to delete layer set' );
				mw.notify( errorMsg + ': ' + errorInfo, { type: 'error' } );
				reject( new Error( errorInfo ) );
			} );
		} );
	}

	/**
	 * Rename a named layer set.
	 * Only the original creator or an admin can rename a set.
	 *
	 * @param {string} oldName - Current name of the layer set
	 * @param {string} newName - New name for the layer set
	 * @return {Promise} Resolves with result or rejects with error
	 */
	renameLayerSet( oldName, newName ) {
		return new Promise( ( resolve, reject ) => {
			if ( !oldName || !newName ) {
				reject( new Error( 'Both old and new names are required' ) );
				return;
			}

			if ( oldName === newName ) {
				reject( new Error( 'New name must be different from old name' ) );
				return;
			}

			// Validate new name format (alphanumeric, hyphens, underscores, 1-50 chars)
			if ( !/^[a-zA-Z0-9_-]{1,50}$/.test( newName ) ) {
				const msg = this.getMessage(
					'layers-invalid-setname',
					'Invalid set name. Use only letters, numbers, hyphens, and underscores (1-50 characters).'
				);
				mw.notify( msg, { type: 'error' } );
				reject( new Error( msg ) );
				return;
			}

			// Get filename from editor config
			const filename = this.editor.filename ||
				( this.editor.config && this.editor.config.filename ) ||
				( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersEditorInit' ) &&
					mw.config.get( 'wgLayersEditorInit' ).filename );
			if ( !filename ) {
				reject( new Error( 'No filename available' ) );
				return;
			}

			if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
				mw.log( '[APIManager] renameLayerSet:', oldName, '->', newName, 'for file:', filename );
			}

			this.showSpinner();

			this.api.postWithToken( 'csrf', {
				action: 'layersrename',
				filename: filename,
				oldname: oldName,
				newname: newName
			} ).then( ( data ) => {
				this.hideSpinner();

				// Check for API error in response
				if ( data.error ) {
					const errorCode = data.error.code || 'unknown';
					const errorInfo = data.error.info || 'Unknown error';
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.error( '[APIManager] renameLayerSet API error:', errorCode, errorInfo );
					}

					if ( errorCode === 'permissiondenied' ) {
						const msg = this.getMessage(
							'layers-rename-permission-denied',
							'You do not have permission to rename this layer set'
						);
						mw.notify( msg, { type: 'error' } );
						reject( new Error( msg ) );
						return;
					}

					if ( errorCode === 'setnameexists' ) {
						const msg = this.getMessage(
							'layers-setname-exists',
							'A layer set with that name already exists'
						);
						mw.notify( msg, { type: 'error' } );
						reject( new Error( msg ) );
						return;
					}

					const msg = this.getMessage( 'layers-rename-failed', 'Failed to rename layer set' );
					mw.notify( msg + ': ' + errorInfo, { type: 'error' } );
					reject( new Error( errorInfo ) );
					return;
				}

				if ( data.layersrename && data.layersrename.success ) {
					const msg = this.getMessage(
						'layers-rename-set-success',
						`Layer set renamed to "${newName}"`
					).replace( '$1', oldName ).replace( '$2', newName );

					mw.notify( msg, { type: 'success' } );

					// Update current set name in state
					if ( this.editor.stateManager ) {
						this.editor.stateManager.set( 'currentSetName', newName );
					}

					// Reload to refresh set list
					this.loadLayers().then( () => {
						resolve( data.layersrename );
					} ).catch( ( reloadErr ) => {
						// Even if reload fails, the rename succeeded
						if ( typeof mw !== 'undefined' && mw.log ) {
							mw.log.warn( '[APIManager] Reload after rename failed:', reloadErr );
						}
						mw.notify( this.getMessage( 'layers-reload-warning', 'Layer list may need manual refresh' ), { type: 'warn' } );
						resolve( data.layersrename );
					} );
				} else {
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.error( '[APIManager] renameLayerSet unexpected response:', data );
					}
					const errorMsg = this.getMessage( 'layers-rename-failed', 'Failed to rename layer set' );
					mw.notify( errorMsg, { type: 'error' } );
					reject( new Error( errorMsg ) );
				}
			} ).catch( ( code, data ) => {
				this.hideSpinner();

				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[APIManager] renameLayerSet error:', code, data );
				}

				// Check for permission denied
				if ( code === 'permissiondenied' ) {
					const msg = this.getMessage(
						'layers-rename-permission-denied',
						'You do not have permission to rename this layer set'
					);
					mw.notify( msg, { type: 'error' } );
					reject( new Error( msg ) );
					return;
				}

				// Handle other API errors
				const errorInfo = ( data && data.error && data.error.info ) || code || 'Unknown error';
				const errorMsg = this.getMessage( 'layers-rename-failed', 'Failed to rename layer set' );
				mw.notify( errorMsg + ': ' + errorInfo, { type: 'error' } );
				reject( new Error( errorInfo ) );
			} );
		} );
	}

	/**
	 * Export the current canvas as an image.
	 * Delegates to ExportController.
	 *
	 * @param {Object} options - Export options
	 * @return {Promise<Blob>} Resolves with image blob
	 */
	exportAsImage( options = {} ) {
		return this.exportController.exportAsImage( options );
	}

	/**
	 * Sanitize a filename by removing/replacing problematic characters.
	 * Delegates to ExportController.
	 *
	 * @param {string} name - Filename to sanitize
	 * @return {string} Sanitized filename
	 */
	sanitizeFilename( name ) {
		return this.exportController.sanitizeFilename( name );
	}

	/**
	 * Export and download the current canvas as an image file.
	 * Delegates to ExportController.
	 *
	 * @param {Object} options - Export options
	 */
	downloadAsImage( options = {} ) {
		return this.exportController.downloadAsImage( options );
	}

	checkSizeLimit( data ) {
		const maxBytes = mw.config.get( 'wgLayersMaxBytes' ) || 2097152; // 2MB default
		// Use TextEncoder for accurate byte count (handles multibyte chars like emoji/CJK)
		let byteLength;
		if ( typeof TextEncoder !== 'undefined' ) {
			byteLength = new TextEncoder().encode( data ).length;
		} else {
			// Fallback: approximate with encodeURIComponent
			try {
				byteLength = encodeURIComponent( data ).replace( /%[A-F\d]{2}/g, 'U' ).length;
			} catch ( e ) {
				byteLength = data.length;
			}
		}
		return byteLength <= maxBytes;
	}

	sanitizeInput( input ) {
		if ( typeof input !== 'string' ) {
			return '';
		}
		return input
			.replace( /[<>]/g, '' )
			.replace( /javascript:/gi, '' )
			.replace( /on\w+\s*=/gi, '' )
			.trim();
	}

	isRetryableError( error ) {
		// Retry on network errors, timeouts, and server errors (5xx)
		if ( !error || !error.error ) {
			return true; // Network or timeout error
		}

		const code = error.error.code || '';

		// Session/token errors should NOT be retried - user needs to refresh page
		const nonRetryableCodes = [
			'badtoken',
			'assertuserfailed',
			'assertbotfailed',
			'permissiondenied',
			'permission-denied'
		];
		if ( nonRetryableCodes.includes( code ) ) {
			return false;
		}

		const retryableCodes = [
			'internal_api_error',
			'apierror-timeout',
			'apierror-http',
			'ratelimited' // May succeed after rate limit reset
		];

		return retryableCodes.includes( code );
	}

	getMessage( key, fallback = '' ) {
		if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
			return window.layersMessages.get( key, fallback );
		}
		return fallback;
	}

	/**
	 * Clear the FreshnessChecker sessionStorage cache for this file.
	 *
	 * This ensures that when the user views the page after saving,
	 * FR-10 will make a fresh API call to check for updates rather than
	 * using potentially stale cached revision information.
	 *
	 * @private
	 */
	clearFreshnessCache() {
		try {
			const filename = this.editor.filename;
			if ( !filename ) {
				return;
			}

			// FreshnessChecker uses keys like: "layers-fresh-Filename:setname"
			const STORAGE_KEY_PREFIX = 'layers-fresh-';
			const normalizedFilename = ( filename || '' ).replace( /\s+/g, '_' );

			// Clear cache for all known set names
			const namedSets = this.editor.stateManager.get( 'namedSets' ) || [];
			const currentSetName = this.editor.stateManager.get( 'currentSetName' ) || 'default';

			// Build list of set names to clear
			const setNames = new Set( [ 'default', currentSetName ] );
			namedSets.forEach( ( set ) => {
				if ( set && set.name ) {
					setNames.add( set.name );
				}
			} );

			// Clear cache for each set name
			setNames.forEach( ( setName ) => {
				const key = STORAGE_KEY_PREFIX + normalizedFilename + ':' + setName;
				try {
					sessionStorage.removeItem( key );
				} catch ( e ) {
					// Ignore sessionStorage errors
				}
			} );

			if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
				mw.log( '[APIManager] Cleared freshness cache for:', filename );
			}
		} catch ( e ) {
			// Ignore errors - cache clearing is best-effort
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[APIManager] Failed to clear freshness cache:', e.message );
			}
		}
	}

	/**
	 * Clean up resources and abort pending requests
	 */
	destroy() {
		// Clear all pending timeouts
		this._clearAllTimeouts();
		
		// Abort all tracked pending API requests
		this._abortAllRequests();
		
		// Clear API response cache
		if ( this.responseCache ) {
			this.responseCache.clear();
		}
		
		if ( this.errorHandler ) {
			this.errorHandler.destroy();
		}
		this.api = null;
		this.editor = null;
		this.errorHandler = null;
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.APIManager = APIManager;
	}

	// Export via CommonJS for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { APIManager };
	}

}() );