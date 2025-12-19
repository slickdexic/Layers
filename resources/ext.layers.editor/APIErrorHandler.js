/**
 * API Error Handler for Layers Editor
 * Extracted from APIManager for separation of concerns
 * Handles error normalization, logging, user notifications, and UI state updates
 */
( function () {
	'use strict';

	class APIErrorHandler {
		/**
		 * @param {Object} options Configuration options
		 * @param {Object} options.editor Reference to the editor instance
		 * @param {Object} options.errorConfig Error code to message key mappings
		 */
		constructor( options = {} ) {
			this.editor = options.editor || null;
			
			// Centralized error handling configuration
			this.errorConfig = options.errorConfig || {
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
			
			// Callbacks for UI operations (set by APIManager)
			this.onEnableSaveButton = null;
		}

		/**
		 * Set editor reference (for late binding)
		 * @param {Object} editor Editor instance
		 */
		setEditor( editor ) {
			this.editor = editor;
		}

		/**
		 * Set callback for enabling save button
		 * @param {Function} callback Callback function
		 */
		setEnableSaveButtonCallback( callback ) {
			this.onEnableSaveButton = callback;
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
		 * Delegates to centralized MessageHelper for consistent i18n handling.
		 * @param {Object} normalizedError Normalized error object
		 * @param {string} operation Operation that failed
		 * @return {string} User-friendly error message
		 */
		getUserMessage( normalizedError, operation ) {
			// Hardcoded fallbacks
			const fallbacks = {
				load: 'Failed to load layer data',
				save: 'Failed to save layer data',
				generic: 'An error occurred'
			};
			const fallback = fallbacks[ operation ] || fallbacks.generic;

			// Try to get specific message for error code via MessageHelper
			const messageKey = this.errorConfig.errorMap[ normalizedError.code ];
			if ( messageKey && window.layersMessages ) {
				const msg = window.layersMessages.get( messageKey, '' );
				if ( msg ) {
					return msg;
				}
			}
			
			// Try to get default message for operation via MessageHelper
			const defaultKey = this.errorConfig.defaults[ operation ];
			if ( defaultKey && window.layersMessages ) {
				const msg = window.layersMessages.get( defaultKey, '' );
				if ( msg ) {
					return msg;
				}
			}
			
			return fallback;
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
				} else if ( typeof mw !== 'undefined' && mw.log ) {
					// Fallback to mw.log with sanitized data
					mw.log.error( '[APIErrorHandler] Error:', logEntry );
				}
			} catch ( logError ) {
				// Prevent logging errors from breaking the application
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[APIErrorHandler] Failed to log error' );
				}
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
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify( message, { type: type } );
				} else if ( typeof mw !== 'undefined' && mw.log ) {
					// Fallback for environments without mw.notify
					mw.log.error( 'User notification:', message );
				}
			} catch ( notifyError ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( 'Failed to show user notification:', message );
				}
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
				if ( operation === 'save' && this.onEnableSaveButton ) {
					this.onEnableSaveButton();
				}
			} catch ( uiError ) {
				// Don't let UI updates break the application
			}
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.editor = null;
			this.onEnableSaveButton = null;
		}
	}

	// Export to namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.APIErrorHandler = APIErrorHandler;
	}

	// Export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = APIErrorHandler;
	}
}() );
