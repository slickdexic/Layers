/**
 * API Manager for Layers Editor
 * Handles all API communications with the backend
 */
class APIManager {
	constructor( editor ) {
		this.editor = editor;
		this.api = new mw.Api();
		this.maxRetries = 3;
		this.retryDelay = 1000; // Start with 1 second
		
		// Centralized error handling configuration
		this.errorConfig = {
			// Standard error codes and their user-friendly messages
			errorMap: {
				'invalidfilename': 'layers-invalid-filename',
				'datatoolarge': 'layers-data-too-large',
				'invalidjson': 'layers-json-parse-error',
				'invaliddata': 'layers-invalid-data',
				'ratelimited': 'layers-rate-limited',
				'filenotfound': 'layers-file-not-found',
				'savefailed': 'layers-save-failed',
				'dbschema-missing': 'layers-db-error',
				'permission-denied': 'layers-permission-denied',
				'network-error': 'layers-network-error',
				'timeout': 'layers-timeout-error'
			},
			// Default fallback messages
			defaults: {
				load: 'layers-load-error',
				save: 'layers-save-error',
				generic: 'layers-generic-error'
			}
		};
	}

	/**
	 * Centralized error handling with consistent logging and user feedback
	 * @param {*} error Error object from API call
	 * @param {string} operation Operation that failed (load, save, etc.)
	 * @param {Object} context Additional context for error handling
	 * @return {Object} Standardized error object
	 */
	handleError( error, operation = 'generic', context = {} ) {
		// Normalize error structure
		const normalizedError = this.normalizeError( error );
		
		// Get appropriate user message
		const userMessage = this.getUserMessage( normalizedError, operation );
		
		// Log error securely (without exposing sensitive information)
		this.logError( normalizedError, operation, context );
		
		// Show user notification
		this.showUserNotification( userMessage, 'error' );
		
		// Report to centralized error handler if available
		this.reportToErrorHandler( normalizedError, operation, context );
		
		// Update UI state
		this.updateUIForError( operation );
		
		return {
			code: normalizedError.code,
			message: userMessage,
			userMessage: userMessage,
			operation: operation,
			timestamp: new Date().toISOString()
		};
	}
	
	/**
	 * Normalize error object to consistent structure
	 * @param {*} error Raw error from API or other source
	 * @return {Object} Normalized error object
	 */
	normalizeError( error ) {
		const normalized = {
			code: 'unknown',
			message: 'An unknown error occurred',
			originalError: null
		};
		
		try {
			if ( typeof error === 'string' ) {
				normalized.message = error;
				normalized.code = 'string-error';
			} else if ( error && error.error ) {
				// MediaWiki API error format
				normalized.code = error.error.code || 'api-error';
				normalized.message = error.error.info || error.error.message || 'API error';
				normalized.originalError = error;
			} else if ( error && error.message ) {
				// Standard JavaScript Error object
				normalized.code = error.name || 'js-error';
				normalized.message = error.message;
				normalized.originalError = error;
			} else if ( error && typeof error === 'object' ) {
				// Other object types
				normalized.code = error.code || 'object-error';
				normalized.message = error.message || error.info || JSON.stringify( error );
				normalized.originalError = error;
			}
		} catch ( parseError ) {
			normalized.code = 'error-parsing-failed';
			normalized.message = 'Failed to parse error information';
		}
		
		return normalized;
	}
	
	/**
	 * Get user-friendly message for error
	 * @param {Object} normalizedError Normalized error object
	 * @param {string} operation Operation that failed
	 * @return {string} User-friendly error message
	 */
	getUserMessage( normalizedError, operation ) {
		// Try to get specific message for error code
		const messageKey = this.errorConfig.errorMap[ normalizedError.code ];
		if ( messageKey && mw.message ) {
			try {
				return mw.message( messageKey ).text();
			} catch ( msgError ) {
				// Fall through to default handling
			}
		}
		
		// Try to get default message for operation
		const defaultKey = this.errorConfig.defaults[ operation ];
		if ( defaultKey && mw.message ) {
			try {
				return mw.message( defaultKey ).text();
			} catch ( msgError ) {
				// Fall through to hardcoded fallback
			}
		}
		
		// Hardcoded fallbacks
		const fallbacks = {
			load: 'Failed to load layer data',
			save: 'Failed to save layer data',
			generic: 'An error occurred'
		};
		
		return fallbacks[ operation ] || fallbacks.generic;
	}
	
	/**
	 * Log error securely without exposing sensitive information
	 * @param {Object} normalizedError Normalized error object
	 * @param {string} operation Operation that failed
	 * @param {Object} context Additional context
	 */
	logError( normalizedError, operation, context ) {
		try {
			// Create sanitized log entry
			const logEntry = {
				operation: operation,
				code: normalizedError.code,
				message: this.sanitizeLogMessage( normalizedError.message ),
				timestamp: new Date().toISOString(),
				context: this.sanitizeContext( context )
			};
			
			// Use editor's error logging if available
			if ( this.editor && this.editor.errorLog ) {
				this.editor.errorLog( 'API Error:', logEntry );
			} else {
				// Fallback to console with sanitized data
				console.error( '[APIManager] Error:', logEntry );
			}
		} catch ( logError ) {
			// Prevent logging errors from breaking the application
			console.error( '[APIManager] Failed to log error' );
		}
	}
	
	/**
	 * Sanitize log message to prevent information disclosure
	 * @param {string} message Raw error message
	 * @return {string} Sanitized message
	 */
	sanitizeLogMessage( message ) {
		if ( typeof message !== 'string' ) {
			return 'Non-string error message';
		}
		
		// Apply same sanitization as in LayersEditor
		let sanitized = message;
		
		// Remove tokens and sensitive patterns
		sanitized = sanitized.replace( /[a-zA-Z0-9+/=]{20,}/g, '[TOKEN]' );
		sanitized = sanitized.replace( /[a-fA-F0-9]{16,}/g, '[HEX]' );
		sanitized = sanitized.replace( /[A-Za-z]:[\\/][\w\s\\.-]*/g, '[PATH]' );
		sanitized = sanitized.replace( /\/[\w\s.-]+/g, '[PATH]' );
		sanitized = sanitized.replace( /https?:\/\/[^\s'"<>&]*/gi, '[URL]' );
		sanitized = sanitized.replace( /\w+:\/\/[^\s'"<>&]*/gi, '[CONNECTION]' );
		sanitized = sanitized.replace( /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]' );
		sanitized = sanitized.replace( /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]' );
		
		// Truncate if too long
		if ( sanitized.length > 200 ) {
			sanitized = sanitized.slice( 0, 200 ) + '[TRUNCATED]';
		}
		
		return sanitized;
	}
	
	/**
	 * Sanitize context object for logging
	 * @param {Object} context Context object
	 * @return {Object} Sanitized context
	 */
	sanitizeContext( context ) {
		const sanitized = {};
		
		try {
			Object.keys( context ).forEach( key => {
				const value = context[ key ];
				if ( typeof value === 'string' ) {
					sanitized[ key ] = this.sanitizeLogMessage( value );
				} else if ( typeof value === 'number' || typeof value === 'boolean' ) {
					sanitized[ key ] = value;
				} else {
					sanitized[ key ] = '[OBJECT]';
				}
			} );
		} catch ( sanitizeError ) {
			return { sanitizationFailed: true };
		}
		
		return sanitized;
	}
	
	/**
	 * Show user notification
	 * @param {string} message Message to show
	 * @param {string} type Notification type (error, warning, success)
	 */
	showUserNotification( message, type = 'error' ) {
		try {
			if ( mw.notify ) {
				mw.notify( message, { type: type } );
			} else {
				// Fallback for environments without mw.notify
				console.error( 'User notification:', message );
			}
		} catch ( notifyError ) {
			console.error( 'Failed to show user notification:', message );
		}
	}
	
	/**
	 * Report to centralized error handler
	 * @param {Object} normalizedError Normalized error object
	 * @param {string} operation Operation that failed
	 * @param {Object} context Additional context
	 */
	reportToErrorHandler( normalizedError, operation, context ) {
		try {
			if ( window.layersErrorHandler && window.layersErrorHandler.handleError ) {
				window.layersErrorHandler.handleError(
					new Error( normalizedError.message ),
					`API ${operation}`,
					operation,
					{ 
						code: normalizedError.code,
						context: context 
					}
				);
			}
		} catch ( reportError ) {
			// Don't let error reporting break the application
		}
	}
	
	/**
	 * Update UI state for error conditions
	 * @param {string} operation Operation that failed
	 */
	updateUIForError( operation ) {
		try {
			// Hide any active spinners
			if ( this.editor && this.editor.uiManager ) {
				this.editor.uiManager.hideSpinner();
			}
			
			// Re-enable buttons based on operation
			if ( operation === 'save' ) {
				this.enableSaveButton();
			}
		} catch ( uiError ) {
			// Don't let UI updates break the application
		}
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
				format: 'json'
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
				console.warn( '[APIManager] No layersinfo in API response' );
				return;
			}

			const layersInfo = data.layersinfo;

			// Process the current layer set if it exists
			if ( layersInfo.layerset ) {
				this.extractLayerSetData( layersInfo.layerset );
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
			} else {
				this.editor.stateManager.set( 'allLayerSets', [] );
			}

			// Build the revision selector UI
			this.editor.buildRevisionSelector();

			// Render the layers
			const layers = this.editor.stateManager.get( 'layers' ) || [];
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.renderLayers( layers );
			}

			// Update the layer panel UI
			if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateLayers === 'function' ) {
				this.editor.layerPanel.updateLayers( layers );
			}

			console.log( '[APIManager] Processed layers data:', {
				layersCount: layers.length,
				currentLayerSetId: this.editor.stateManager.get( 'currentLayerSetId' ),
				allLayerSetsCount: ( layersInfo.all_layersets || [] ).length
			} );

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

		const rawLayers = layerSet.data.layers || [];
		const processedLayers = this.processRawLayers( rawLayers );
		this.editor.stateManager.set( 'layers', processedLayers );
		this.editor.stateManager.set( 'currentLayerSetId', layerSet.id || null );
	}

	processRawLayers( rawLayers ) {
		return rawLayers.map( layer => {
			if ( !layer.id ) {
				layer.id = this.generateLayerId();
			}
			this.normalizeBooleanProperties( layer );
			return layer;
		} );
	}

	normalizeBooleanProperties( layer ) {
		const booleanProps = [ 'shadow', 'textShadow', 'glow', 'visible', 'locked' ];
		booleanProps.forEach( prop => {
			if ( layer[ prop ] === '0' || layer[ prop ] === 'false' ) {
				layer[ prop ] = false;
			} else if ( layer[ prop ] === '' || layer[ prop ] === '1' || layer[ prop ] === 'true' ) {
				layer[ prop ] = true;
			}
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
				format: 'json'
			} ).then( ( data ) => {
				this.editor.uiManager.hideSpinner();
				if ( data.layersinfo && data.layersinfo.layerset ) {
					this.extractLayerSetData( data.layersinfo.layerset );
					this.editor.stateManager.set( 'allLayerSets', data.layersinfo.all_layersets || [] );
					this.editor.buildRevisionSelector();
					this.editor.renderLayers();
					this.editor.stateManager.set( 'isDirty', false );

					// Update the layer panel UI after loading revision
					const layers = this.editor.stateManager.get( 'layers' ) || [];
					if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateLayers === 'function' ) {
						this.editor.layerPanel.updateLayers( layers );
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
		if ( window.LayersValidator ) {
			const validator = new window.LayersValidator();
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
		const layersJson = JSON.stringify( layers );
		
		// DEBUG: Log what we're sending
		console.log( '[APIManager] Building save payload:', {
			filename: this.editor.filename,
			layerCount: layers.length,
			dataSize: layersJson.length,
			dataSample: layersJson.substring( 0, 200 )
		} );
		
		const payload = {
			action: 'layerssave',
			filename: this.editor.filename,
			data: layersJson,
			format: 'json'
		};

		if ( this.editor.uiManager.revNameInputEl && this.editor.uiManager.revNameInputEl.value ) {
			const setname = this.sanitizeInput( this.editor.uiManager.revNameInputEl.value.trim() );
			if ( setname ) {
				payload.setname = setname;
			}
		}

		return payload;
	}

	performSaveWithRetry( payload, attempt, resolve, reject ) {
		this.api.postWithToken( 'csrf', payload ).then( ( data ) => {
			// DEBUG: Log the actual response
			console.log( '[APIManager] Save response received:', JSON.stringify( data ) );
			
			this.editor.uiManager.hideSpinner();
			this.enableSaveButton();
			this.handleSaveSuccess( data );
			resolve( data );
		} ).catch( ( error ) => {
			// DEBUG: Log the actual error BEFORE processing
			console.error( '[APIManager] Save error caught (RAW):', {
				error: error,
				errorString: JSON.stringify( error, null, 2 ),
				errorKeys: Object.keys( error || {} ),
				errorError: error && error.error ? JSON.stringify( error.error, null, 2 ) : 'no error.error',
				attempt: attempt
			} );
			
			const isRetryable = this.isRetryableError( error );
			const canRetry = attempt < this.maxRetries && isRetryable;

			if ( canRetry ) {
				const delay = this.retryDelay * Math.pow( 2, attempt ); // Exponential backoff
				console.log( '[APIManager] Retrying save after delay:', delay );
				setTimeout( () => {
					this.performSaveWithRetry( payload, attempt + 1, resolve, reject );
				}, delay );
			} else {
				console.error( '[APIManager] Save failed after', attempt, 'attempts' );
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
		if ( data.layerssave && data.layerssave.success ) {
			this.editor.stateManager.markClean();
			mw.notify( this.getMessage( 'layers-save-success' ), { type: 'success' } );
			this.reloadRevisions();
		} else {
			this.handleSaveError( data );
		}
	}

	handleSaveError( error ) {
		// Use centralized error handling - no double display
		return this.handleError( error, 'save', { error: error } );
	}

	reloadRevisions() {
		this.api.get( {
			action: 'layersinfo',
			filename: this.editor.filename,
			format: 'json'
		} ).then( ( data ) => {
			if ( data.layersinfo ) {
				if ( Array.isArray( data.layersinfo.all_layersets ) ) {
					this.editor.stateManager.set( 'allLayerSets', data.layersinfo.all_layersets.slice() );
				}
				if ( data.layersinfo.layerset && data.layersinfo.layerset.id ) {
					this.editor.stateManager.set( 'currentLayerSetId', data.layersinfo.layerset.id );
				}
				this.editor.buildRevisionSelector();
				if ( this.editor.uiManager.revNameInputEl ) {
					this.editor.uiManager.revNameInputEl.value = '';
				}
			}
		} ).catch( () => {
			// Ignore reload errors
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
		return ( mw.message ? mw.message( key ).text() : ( mw.msg ? mw.msg( key ) : fallback ) );
	}
}

// Export APIManager to global scope
window.APIManager = APIManager;