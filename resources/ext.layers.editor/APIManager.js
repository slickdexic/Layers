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

	// Get shared LayerDataNormalizer for consistent data handling
	const LayerDataNormalizer = ( window.Layers && window.Layers.LayerDataNormalizer ) || window.LayerDataNormalizer;

	class APIManager {
	constructor( editor ) {
		this.editor = editor;
		this.api = new mw.Api();
		this.maxRetries = 3;
		this.retryDelay = 1000; // Start with 1 second
		
		// Initialize error handler (extracted for separation of concerns)
		this.errorHandler = new APIErrorHandler( {
			editor: editor
		} );
		this.errorHandler.setEnableSaveButtonCallback( () => this.enableSaveButton() );
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
	 * Load layers for the current file
	 */
	loadLayers() {
		return new Promise( ( resolve, reject ) => {
			this.editor.uiManager.showSpinner( this.getMessage( 'layers-loading' ) );

			this.api.get( {
				action: 'layersinfo',
				filename: this.editor.filename,
				format: 'json',
				formatversion: 2
			} ).then( ( data ) => {
				this.editor.uiManager.hideSpinner();
				this.processLayersData( data );
				resolve( {
					layers: this.editor.stateManager.get( 'layers' ) || [],
					baseWidth: this.editor.stateManager.get( 'baseWidth' ),
					baseHeight: this.editor.stateManager.get( 'baseHeight' ),
					allLayerSets: this.editor.stateManager.get( 'allLayerSets' ) || [],
					currentLayerSetId: this.editor.stateManager.get( 'currentLayerSetId' )
				} );
			} ).catch( ( code, result ) => {
				this.editor.uiManager.hideSpinner();
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
				// No layerset, set empty state
				this.editor.stateManager.set( 'layers', [] );
				this.editor.stateManager.set( 'currentLayerSetId', null );
				this.editor.stateManager.set( 'baseWidth', null );
				this.editor.stateManager.set( 'baseHeight', null );
			}

			// Process all layer sets for the revision selector
			if ( Array.isArray( layersInfo.all_layersets ) ) {
				this.editor.stateManager.set( 'allLayerSets', layersInfo.all_layersets );
				this.editor.stateManager.set( 'setRevisions', layersInfo.all_layersets );
			} else {
				this.editor.stateManager.set( 'allLayerSets', [] );
				this.editor.stateManager.set( 'setRevisions', [] );
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

	processRawLayers( rawLayers ) {
		return rawLayers.map( layer => {
			if ( !layer.id ) {
				layer.id = this.generateLayerId();
			}
			// Use shared normalizer if available, otherwise fall back to local method
			if ( LayerDataNormalizer && typeof LayerDataNormalizer.normalizeLayer === 'function' ) {
				LayerDataNormalizer.normalizeLayer( layer );
			} else {
				this.normalizeBooleanProperties( layer );
			}
			return layer;
		} );
	}

	/**
	 * Normalize boolean properties on a layer
	 * Fallback method when shared LayerDataNormalizer is not available
	 * @deprecated Use LayerDataNormalizer.normalizeLayer() instead
	 * @param {Object} layer - The layer to normalize
	 */
	normalizeBooleanProperties( layer ) {
		const booleanProps = [ 'shadow', 'textShadow', 'glow', 'visible', 'locked', 'preserveAspectRatio' ];
		
		booleanProps.forEach( prop => {
			const val = layer[ prop ];
			// Convert string/numeric representations to actual booleans
			// Explicit false values: '0', 'false', numeric 0
			if ( val === '0' || val === 'false' || val === 0 ) {
				layer[ prop ] = false;
			// Explicit true values: '1', 'true', numeric 1, or empty string (legacy data)
			} else if ( val === '' || val === '1' || val === 'true' || val === 1 ) {
				layer[ prop ] = true;
			}
			// Note: actual boolean true/false and undefined are left as-is
		} );
	}

	generateLayerId() {
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	}

	handleLoadError( code, result ) {
		// Use the new standardized error handling
		const errorInfo = { error: { code: code, info: result && result.error && result.error.info } };
		return this.handleError( errorInfo, 'load', { code: code, result: result } );
	}

	/**
	 * Load a specific revision by ID
	 */
	loadRevisionById( revisionId ) {
		return new Promise( ( resolve, reject ) => {
			this.editor.uiManager.showSpinner( this.getMessage( 'layers-loading' ) );

			this.api.get( {
				action: 'layersinfo',
				filename: this.editor.filename,
				layersetid: revisionId,
				format: 'json',
				formatversion: 2
			} ).then( ( data ) => {
				this.editor.uiManager.hideSpinner();
				if ( data.layersinfo && data.layersinfo.layerset ) {
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

					mw.notify( this.getMessage( 'layers-revision-loaded' ), { type: 'success' } );
					resolve( data );
				} else {
					reject( new Error( 'Revision not found' ) );
				}
			} ).catch( ( code, result ) => {
				this.editor.uiManager.hideSpinner();
				const errorMsg = result && result.error && result.error.info
					? result.error.info
					: this.getMessage( 'layers-revision-not-found' );
				mw.notify( errorMsg, { type: 'error' } );
				reject( { code, result } );
			} );
		} );
	}

	/**
	 * Load layers by set name
	 * Fetches a specific named layer set and its revision history
	 * @param {string} setName - The name of the set to load
	 * @return {Promise} Resolves with the layer data
	 */
	loadLayersBySetName( setName ) {
		return new Promise( ( resolve, reject ) => {
			if ( !setName ) {
				reject( new Error( 'No set name provided' ) );
				return;
			}

			this.editor.uiManager.showSpinner( this.getMessage( 'layers-loading' ) );

			this.api.get( {
				action: 'layersinfo',
				filename: this.editor.filename,
				setname: setName,
				format: 'json',
				formatversion: 2
			} ).then( ( data ) => {
				this.editor.uiManager.hideSpinner();

				if ( !data || !data.layersinfo ) {
					reject( new Error( 'Invalid API response' ) );
					return;
				}

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
				}

				// Update named sets list if provided
				if ( Array.isArray( layersInfo.named_sets ) ) {
					this.editor.stateManager.set( 'namedSets', layersInfo.named_sets );
					this.editor.buildSetSelector();
				}

				// Update current set name in state
				this.editor.stateManager.set( 'currentSetName', setName );

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

				// Debug logging controlled by extension config
				if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
					mw.log( '[APIManager] Loaded layer set by name:', {
						setName: setName,
						layersCount: layers.length,
						currentLayerSetId: this.editor.stateManager.get( 'currentLayerSetId' ),
						revisionsCount: ( layersInfo.all_layersets || [] ).length
					} );
				}

				resolve( {
					layers: layers,
					setName: setName,
					currentLayerSetId: this.editor.stateManager.get( 'currentLayerSetId' ),
					revisions: this.editor.stateManager.get( 'setRevisions' ) || []
				} );

			} ).catch( ( code, result ) => {
				this.editor.uiManager.hideSpinner();
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
			if ( !this.validateBeforeSave() ) {
				reject( new Error( 'Validation failed' ) );
				return;
			}

			this.editor.uiManager.showSpinner( this.getMessage( 'layers-saving' ) );
			this.disableSaveButton();

			const payload = this.buildSavePayload();
			const layersJson = JSON.stringify( this.editor.stateManager.get( 'layers' ) || [] );

			if ( !this.checkSizeLimit( layersJson ) ) {
				this.editor.uiManager.hideSpinner();
				reject( new Error( 'Data too large' ) );
				return;
			}

			this.performSaveWithRetry( payload, 0, resolve, reject );
		} );
	}

	validateBeforeSave() {
		const layers = this.editor.stateManager.get( 'layers' ) || [];
		const LayersValidator = getClass( 'Validation.LayersValidator', 'LayersValidator' );
		if ( LayersValidator ) {
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
		}
		return true;
	}

	buildSavePayload() {
		const layers = this.editor.stateManager.get( 'layers' ) || [];
		
		// Include background settings in the saved data
		const backgroundVisible = this.editor.stateManager.get( 'backgroundVisible' );
		const backgroundOpacity = this.editor.stateManager.get( 'backgroundOpacity' );
		
		// Build data object with layers and background settings
		const dataObject = {
			layers: layers,
			backgroundVisible: backgroundVisible !== undefined ? backgroundVisible : true,
			backgroundOpacity: backgroundOpacity !== undefined ? backgroundOpacity : 1.0
		};
		
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
			
			this.editor.uiManager.hideSpinner();
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
				setTimeout( () => {
					this.performSaveWithRetry( payload, attempt + 1, resolve, reject );
				}, delay );
			} else {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( `[APIManager] Save failed after ${attempt + 1} attempts` );
				}
				this.editor.uiManager.hideSpinner();
				this.enableSaveButton();
				this.handleSaveError( error );
				reject( error );
			}
		} );
	}

	disableSaveButton() {
		if ( this.editor.toolbar && this.editor.toolbar.saveButton ) {
			this.editor.toolbar.saveButton.disabled = true;
			setTimeout( () => {
				if ( this.editor.toolbar.saveButton ) {
					this.editor.toolbar.saveButton.disabled = false;
				}
			}, 2000 );
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
				if ( this.editor.uiManager.revNameInputEl ) {
					this.editor.uiManager.revNameInputEl.value = '';
				}
			}
		} ).catch( ( error ) => {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[APIManager] reloadRevisions error:', error );
			}
			// Ignore reload errors
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

			this.editor.uiManager.showSpinner();

			this.api.postWithToken( 'csrf', {
				action: 'layersdelete',
				filename: filename,
				setname: setName
			} ).then( ( data ) => {
				this.editor.uiManager.hideSpinner();

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
					} ).catch( () => {
						// Even if reload fails, the delete succeeded
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
				this.editor.uiManager.hideSpinner();

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

			this.editor.uiManager.showSpinner();

			this.api.postWithToken( 'csrf', {
				action: 'layersrename',
				filename: filename,
				oldname: oldName,
				newname: newName
			} ).then( ( data ) => {
				this.editor.uiManager.hideSpinner();

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
					} ).catch( () => {
						// Even if reload fails, the rename succeeded
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
				this.editor.uiManager.hideSpinner();

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
	 * Composites the background image with all visible layers.
	 *
	 * @param {Object} options - Export options
	 * @param {boolean} options.includeBackground - Include background image (default: respects current visibility)
	 * @param {number} options.scale - Scale factor (default: 1)
	 * @param {string} options.format - Image format: 'png' or 'jpeg' (default: 'png')
	 * @param {number} options.quality - JPEG quality 0-1 (default: 0.92)
	 * @return {Promise<Blob>} Resolves with image blob
	 */
	exportAsImage( options = {} ) {
		return new Promise( ( resolve, reject ) => {
			// Respect current background visibility unless explicitly overridden
			const backgroundVisible = this.editor.stateManager.get( 'backgroundVisible' );
			const backgroundOpacity = this.editor.stateManager.get( 'backgroundOpacity' );
			const includeBackground = options.includeBackground !== undefined ?
				options.includeBackground :
				( backgroundVisible !== false && backgroundOpacity > 0 );
			const scale = options.scale || 1;
			const format = options.format || 'png';
			const quality = options.quality || 0.92;

			try {
				const canvasManager = this.editor.canvasManager;
				if ( !canvasManager ) {
					reject( new Error( 'Canvas manager not available' ) );
					return;
				}

				// Create an offscreen canvas for export
				const baseWidth = this.editor.stateManager.get( 'baseWidth' ) || canvasManager.canvas.width;
				const baseHeight = this.editor.stateManager.get( 'baseHeight' ) || canvasManager.canvas.height;
				const exportWidth = Math.round( baseWidth * scale );
				const exportHeight = Math.round( baseHeight * scale );

				const exportCanvas = document.createElement( 'canvas' );
				exportCanvas.width = exportWidth;
				exportCanvas.height = exportHeight;
				const ctx = exportCanvas.getContext( '2d' );

				// Draw background if requested and available
				// For PNG exports with hidden background, leave transparent (don't fill)
				if ( includeBackground && canvasManager.backgroundImage ) {
					// Apply background opacity if less than 1
					const opacity = backgroundOpacity !== undefined ? backgroundOpacity : 1;
					if ( opacity < 1 ) {
						ctx.globalAlpha = opacity;
					}
					ctx.drawImage( canvasManager.backgroundImage, 0, 0, exportWidth, exportHeight );
					ctx.globalAlpha = 1;
				} else if ( format === 'jpeg' ) {
					// JPEG doesn't support transparency, use white background
					ctx.fillStyle = '#ffffff';
					ctx.fillRect( 0, 0, exportWidth, exportHeight );
				}
				// For PNG with no background: leave transparent (no fill)

				// Draw all visible layers
				const layers = this.editor.stateManager.get( 'layers' ) || [];
				const visibleLayers = layers.filter( ( layer ) => layer.visible !== false );

				// Use the canvas renderer to draw layers
				if ( canvasManager.renderer && typeof canvasManager.renderer.renderLayersToContext === 'function' ) {
					canvasManager.renderer.renderLayersToContext( ctx, visibleLayers, scale );
				} else {
					// Fallback: draw the current canvas content
					ctx.drawImage( canvasManager.canvas, 0, 0, exportWidth, exportHeight );
				}

				// Convert to blob
				const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
				exportCanvas.toBlob( ( blob ) => {
					if ( blob ) {
						resolve( blob );
					} else {
						reject( new Error( 'Failed to create image blob' ) );
					}
				}, mimeType, quality );

			} catch ( error ) {
				reject( error );
			}
		} );
	}

	/**
	 * Export and download the current canvas as an image file.
	 *
	 * @param {Object} options - Export options (see exportAsImage)
	 * @param {string} options.filename - Custom filename (optional)
	 */
	downloadAsImage( options = {} ) {
		const filename = this.editor.stateManager.get( 'filename' ) || 'image';
		const currentSetName = this.editor.stateManager.get( 'currentSetName' ) || 'default';
		// Remove File: prefix and extension from filename
		const baseName = filename
			.replace( /^File:/i, '' )
			.replace( /\.[^/.]+$/, '' );
		const format = options.format || 'png';
		const ext = format === 'jpeg' ? '.jpg' : '.png';
		// Format: ImageName-LayerSetName.ext (omit -default for default set)
		const setNamePart = currentSetName === 'default' ? '' : `-${ currentSetName }`;
		const downloadName = options.filename || `${ baseName }${ setNamePart }${ ext }`;

		this.editor.uiManager.showSpinner();

		this.exportAsImage( options ).then( ( blob ) => {
			this.editor.uiManager.hideSpinner();

			// Create download link
			const url = URL.createObjectURL( blob );
			const a = document.createElement( 'a' );
			a.href = url;
			a.download = downloadName;
			document.body.appendChild( a );
			a.click();
			document.body.removeChild( a );
			URL.revokeObjectURL( url );

			const msg = this.getMessage( 'layers-export-success', 'Image exported successfully' );
			mw.notify( msg, { type: 'success' } );
		} ).catch( ( error ) => {
			this.editor.uiManager.hideSpinner();
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.error( '[APIManager] Export failed:', error );
			}
			const msg = this.getMessage( 'layers-export-failed', 'Failed to export image' );
			mw.notify( msg, { type: 'error' } );
		} );
	}

	checkSizeLimit( data ) {
		const maxBytes = mw.config.get( 'wgLayersMaxBytes' ) || 2097152; // 2MB default
		return data.length <= maxBytes;
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
		const retryableCodes = [
			'internal_api_error',
			'apierror-timeout',
			'apierror-http',
			'ratelimited' // May succeed after rate limit reset
		];

		return retryableCodes.includes( code );
	}

	getMessage( key, fallback = '' ) {
		return window.layersMessages.get( key, fallback );
	}

	/**
	 * Clean up resources and abort pending requests
	 */
	destroy() {
		// Abort any pending API requests if possible
		if ( this.api && typeof this.api.abort === 'function' ) {
			this.api.abort();
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