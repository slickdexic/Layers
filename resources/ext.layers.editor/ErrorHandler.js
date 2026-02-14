/**
 * Centralized Error Handler for Layers Editor
 * Provides consistent error handling and user feedback
 */
( function () {
	'use strict';

	/**
	 * ErrorHandler class for centralized error management
	 *
	 * @class
	 */
	class ErrorHandler {
		/**
		 * Create an ErrorHandler instance
		 */
		constructor() {
			this.errorQueue = [];
			this.maxErrors = 10;
			this.notificationContainer = null;
			this.debugMode = false;
			this.globalListeners = [];
			/**
			 * Tracked timeout IDs for cleanup
			 * @type {Set<number>}
			 */
			this.activeTimeouts = new Set();

			// Initialize error container
			this.initErrorContainer();

			// Set up global error handler
			this.setupGlobalErrorHandler();
		}

		/**
		 * Initialize error notification container
		 */
		initErrorContainer() {
			this.notificationContainer = document.createElement( 'div' );
			this.notificationContainer.className = 'layers-error-notifications';
			this.notificationContainer.setAttribute( 'role', 'alert' );
			this.notificationContainer.setAttribute( 'aria-live', 'polite' );
			// Guard against early initialization before document.body exists (P3-058)
			if ( document.body ) {
				document.body.appendChild( this.notificationContainer );
			} else {
				document.addEventListener( 'DOMContentLoaded', () => {
					if ( document.body && this.notificationContainer ) {
						document.body.appendChild( this.notificationContainer );
					}
				} );
			}
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
				callback();
			}, delay );
			this.activeTimeouts.add( timeoutId );
			return timeoutId;
		}

		/**
		 * Set up global error handler for unhandled errors
		 */
		registerWindowListener( type, handler, options ) {
			window.addEventListener( type, handler, options );
			this.globalListeners.push( { type: type, handler: handler, options: options } );
		}

		setupGlobalErrorHandler() {
			// Handle unhandled promise rejections
			this.registerWindowListener( 'unhandledrejection', ( event ) => {
				this.handleError( event.reason, 'Unhandled Promise Rejection', 'promise' );
			} );

			// Handle general JavaScript errors
			this.registerWindowListener( 'error', ( event ) => {
				this.handleError( event.error, 'JavaScript Error', 'script', {
					filename: event.filename,
					lineno: event.lineno,
					colno: event.colno
				} );
			} );
		}

		/**
		 * Handle errors with classification and user feedback
		 *
		 * @param {Error|string} error - The error object or message
		 * @param {string} context - Context where the error occurred
		 * @param {string} type - Type of error (api, canvas, validation, etc.)
		 * @param {Object} metadata - Additional error metadata
		 */
		handleError( error, context, type, metadata ) {
			const errorInfo = this.processError( error, context, type, metadata );

			// Add to error queue
			this.addToErrorQueue( errorInfo );

			// Log error for developers
			this.logError( errorInfo );

			// Show user notification based on error severity
			this.showUserNotification( errorInfo );

			// Attempt recovery for recoverable errors
			this.attemptRecovery( errorInfo );

			// Report to external services if configured
			this.reportError( errorInfo );
		}

		/**
		 * Process error into standardized format
		 *
		 * @param {Error|string} error - The error
		 * @param {string} context - Error context
		 * @param {string} type - Error type
		 * @param {Object} metadata - Additional metadata
		 * @return {Object} Processed error information
		 */
		processError( error, context, type, metadata ) {
			const timestamp = new Date().toISOString();
			let message = '';
			let stack = '';

			if ( error instanceof Error ) {
				message = error.message;
				stack = error.stack || '';
			} else if ( typeof error === 'string' ) {
				message = error;
			} else {
				message = 'Unknown error occurred';
			}

			return {
				id: this.generateErrorId(),
				timestamp: timestamp,
				message: message,
				context: context || 'Unknown',
				type: type || 'general',
				stack: stack,
				metadata: metadata || {},
				severity: this.determineSeverity( type, message ),
				userAgent: navigator.userAgent,
				url: window.location.href
			};
		}

		/**
		 * Generate unique error ID
		 *
		 * @return {string} Unique error identifier
		 */
		generateErrorId() {
			return 'err_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
		}

		/**
		 * Determine error severity based on type and message
		 *
		 * @param {string} type - Error type
		 * @param {string} message - Error message
		 * @return {string} Severity level (low, medium, high, critical)
		 */
		determineSeverity( type, message ) {
			const criticalTypes = [ 'security', 'data-loss', 'corruption' ];
			const highTypes = [ 'api', 'save', 'load' ];
			const mediumTypes = [ 'canvas', 'render', 'validation' ];

			// Check for critical keywords in message
			const criticalKeywords = [ 'security', 'xss', 'injection', 'unauthorized', 'corrupt' ];
			const msgLower = message.toLowerCase();

			for ( let i = 0; i < criticalKeywords.length; i++ ) {
				if ( msgLower.includes( criticalKeywords[ i ] ) ) {
					return 'critical';
				}
			}

			if ( criticalTypes.includes( type ) ) {
				return 'critical';
			} else if ( highTypes.includes( type ) ) {
				return 'high';
			} else if ( mediumTypes.includes( type ) ) {
				return 'medium';
			} else {
				return 'low';
			}
		}

		/**
		 * Add error to internal queue with size management
		 *
		 * @param {Object} errorInfo - Processed error information
		 */
		addToErrorQueue( errorInfo ) {
			this.errorQueue.push( errorInfo );

			// Maintain queue size
			if ( this.errorQueue.length > this.maxErrors ) {
				this.errorQueue.shift();
			}
		}

		/**
		 * Log error for developers
		 *
		 * @param {Object} errorInfo - Error information
		 */
		logError( errorInfo ) {
			if ( this.debugMode || window.console ) {
				const logLevel = this.getLogLevel( errorInfo.severity );
				const logMessage = '[Layers] ' + errorInfo.context + ': ' + errorInfo.message;

				if ( window.console && window.console[ logLevel ] ) {
					window.console[ logLevel ]( logMessage, errorInfo );
				}
			}

			// Use MediaWiki logging if available
			if ( window.mw && window.mw.log ) {
				mw.log.error( `Layers Error: ${errorInfo.context} - ${errorInfo.message}` );
			}
		}

		/**
		 * Get appropriate console log level for severity
		 *
		 * @param {string} severity - Error severity
		 * @return {string} Console method name
		 */
		getLogLevel( severity ) {
			switch ( severity ) {
				case 'critical':
				case 'high':
					return 'error';
				case 'medium':
					return 'warn';
				default:
					return 'log';
			}
		}

		/**
		 * Show user notification based on error severity
		 *
		 * @param {Object} errorInfo - Error information
		 */
		showUserNotification( errorInfo ) {
			const shouldShowToUser = errorInfo.severity === 'high' || errorInfo.severity === 'critical';

			if ( shouldShowToUser ) {
				this.createUserNotification( errorInfo );
			}
		}

		/**
		 * Create user-visible error notification
		 *
		 * @param {Object} errorInfo - Error information
		 */
		createUserNotification( errorInfo ) {
			const notification = document.createElement( 'div' );
			// CSS classes used here:
			// - layers-error-notifications
			// - layers-error-notification
			// - layers-error-critical
			// - layers-error-high
			// - layers-error-medium
			// - layers-error-low
			// - error-content
			// - error-icon
			// - error-details
			// - error-message
			// - error-time
			// - error-close
			notification.className = 'layers-error-notification layers-error-' + errorInfo.severity;

			const userMessage = this.getUserFriendlyMessage( errorInfo );
			const timestamp = new Date( errorInfo.timestamp ).toLocaleTimeString();

			// Build content safely via DOM APIs
			const content = document.createElement( 'div' );
			content.className = 'error-content';

			const icon = document.createElement( 'span' );
			icon.className = 'error-icon';
			icon.setAttribute( 'aria-hidden', 'true' );
			icon.textContent = '⚠';

			const details = document.createElement( 'div' );
			details.className = 'error-details';

			const messageEl = document.createElement( 'div' );
			messageEl.className = 'error-message';
			messageEl.textContent = userMessage;

			const timeEl = document.createElement( 'div' );
			timeEl.className = 'error-time';
			timeEl.textContent = timestamp;

			const closeBtn = document.createElement( 'button' );
			closeBtn.className = 'error-close';
			closeBtn.type = 'button';
			closeBtn.setAttribute( 'aria-label', 'Close notification' );
			closeBtn.textContent = '×';

			details.appendChild( messageEl );
			details.appendChild( timeEl );
			content.appendChild( icon );
			content.appendChild( details );
			content.appendChild( closeBtn );
			notification.appendChild( content );

			// Announce error for screen readers
			if ( window.layersAnnouncer ) {
				window.layersAnnouncer.announceError( userMessage );
			}

			// Add close functionality
			closeBtn.addEventListener( 'click', () => {
				notification.remove();
			} );

			// Auto-remove after delay for non-critical errors
			if ( errorInfo.severity !== 'critical' ) {
				this._scheduleTimeout( () => {
					if ( notification.parentNode ) {
						notification.remove();
					}
				}, 8000 );
			}

			this.notificationContainer.appendChild( notification );
		}

		/**
		 * Convert technical error to user-friendly message
		 *
		 * @param {Object} errorInfo - Error information
		 * @return {string} User-friendly message
		 */
		getUserFriendlyMessage( errorInfo ) {
			const msgKey = 'layers-error-' + errorInfo.type;
			let fallbackMessage = '';

			// Message keys potentially requested here (documented to satisfy mediawiki/msg-doc):
			// - layers-error-api
			// - layers-error-canvas
			// - layers-error-validation
			// - layers-error-load
			// - layers-error-general

			switch ( errorInfo.type ) {
				case 'api':
					fallbackMessage = 'Failed to save changes. Please try again.';
					break;
				case 'canvas':
					fallbackMessage = 'Drawing error occurred. Please refresh if issues persist.';
					break;
				case 'validation':
					fallbackMessage = 'Invalid data entered. Please check your input.';
					break;
				case 'load':
					fallbackMessage = 'Failed to load layer data. Please refresh the page.';
					break;
				default:
					fallbackMessage = 'An unexpected error occurred. Please refresh if issues persist.';
			}

			// Use centralized MessageHelper for consistent i18n handling
			if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
				const msg = window.layersMessages.get( msgKey, '' );
				if ( msg ) {
					return msg;
				}
			}

			return fallbackMessage;
		}

		/**
		 * Escape HTML to prevent XSS in error messages
		 *
		 * @param {string} str - String to escape
		 * @return {string} HTML-escaped string
		 */
		escapeHtml( str ) {
			// Avoid using innerHTML; perform minimal escaping manually
			const map = {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;'
			};
			return String( str ).replace(
				/[&<>"']/g,
				( ch ) => map[ ch ] || ch
			);
		}

		/**
		 * Attempt recovery for recoverable errors
		 *
		 * @param {Object} errorInfo - Processed error information
		 */
		attemptRecovery( errorInfo ) {
			const recoveryStrategy = this.getRecoveryStrategy( errorInfo );

			if ( recoveryStrategy ) {
				this.executeRecoveryStrategy( recoveryStrategy, errorInfo );
			}
		}

		/**
		 * Report error to external services
		 *
		 * @param {Object} errorInfo - Error information
		 */
		reportError( errorInfo ) {
			// Only report critical and high severity errors
			if ( errorInfo.severity !== 'critical' && errorInfo.severity !== 'high' ) {
				return;
			}

			// Report to MediaWiki's error logging if available
			if ( window.mw && window.mw.track ) {
				mw.track( 'layers.error', {
					errorId: errorInfo.id,
					type: errorInfo.type,
					severity: errorInfo.severity,
					context: errorInfo.context,
					message: errorInfo.message,
					timestamp: errorInfo.timestamp
				} );
			}

			// Could integrate with external services like Sentry here
			// Example: Sentry.captureException(errorInfo);
		}

		/**
		 * Get recovery strategy for error type
		 *
		 * @param {Object} errorInfo - Error information
		 * @return {Object|null} Recovery strategy or null
		 */
		getRecoveryStrategy( errorInfo ) {
			const strategies = {
				'load': {
					action: 'notify',
					message: 'Layer load failed. Please try again.'
				},
				'save': {
					action: 'notify',
					message: 'Save failed. Please try again.'
				},
				'canvas': {
					action: 'refresh',
					message: 'Canvas error detected. Refreshing...'
				},
				'validation': {
					action: 'notify',
					message: 'Please check your input and try again.'
				}
			};

			return strategies[ errorInfo.type ] || null;
		}

		/**
		 * Execute recovery strategy
		 *
		 * @param {Object} strategy - Recovery strategy
		 * @param {Object} errorInfo - Error information
		 */
		executeRecoveryStrategy( strategy, _errorInfo ) {
			switch ( strategy.action ) {
				case 'refresh':
					this.showRecoveryNotification( strategy.message );
					// Save draft before reload to prevent unsaved work loss
					this._saveDraftBeforeReload();
					this._scheduleTimeout( () => {
						window.location.reload();
					}, 2000 );
					break;
				case 'notify':
					this.showRecoveryNotification( strategy.message );
					break;
			}
		}

		/**
		 * Attempt to save the current draft before a page reload.
		 * This prevents data loss when the error handler triggers auto-reload.
		 *
		 * @private
		 */
		_saveDraftBeforeReload() {
			try {
				const editor = window.layersEditorInstance;
				if ( editor && editor.draftManager &&
					typeof editor.draftManager.saveDraft === 'function' ) {
					editor.draftManager.saveDraft();
				}
			} catch ( e ) {
				// Best-effort — don't let draft save failure block recovery
			}
		}

		/**
		 * Show recovery notification to user
		 *
		 * @param {string} message - Recovery message
		 */
		showRecoveryNotification( message ) {
			if ( window.mw && window.mw.notify ) {
				mw.notify( message, { type: 'info', autoHide: true } );
			}
		}

		/**
		 * Get recent errors for debugging
		 *
		 * @param {number} limit - Maximum number of errors to return
		 * @return {Array} Recent error information
		 */
		getRecentErrors( limit ) {
			limit = limit || 5;
			return this.errorQueue.slice( -limit );
		}

		/**
		 * Clear error queue
		 */
		clearErrors() {
			this.errorQueue = [];
			if ( this.notificationContainer ) {
				while ( this.notificationContainer.firstChild ) {
					this.notificationContainer.removeChild( this.notificationContainer.firstChild );
				}
			}
		}

		/**
		 * Set debug mode
		 *
		 * @param {boolean} enabled - Whether to enable debug mode
		 */
		setDebugMode( enabled ) {
			this.debugMode = !!enabled;
		}

		/**
		 * Destroy error handler and clean up
		 */
		destroy() {
			// Cancel all tracked timeouts to prevent memory leaks
			if ( this.activeTimeouts ) {
				this.activeTimeouts.forEach( ( timeoutId ) => {
					clearTimeout( timeoutId );
				} );
				this.activeTimeouts.clear();
			}
			if ( this.notificationContainer && this.notificationContainer.parentNode ) {
				this.notificationContainer.parentNode.removeChild( this.notificationContainer );
			}
			if ( this.globalListeners && this.globalListeners.length ) {
				this.globalListeners.forEach( function ( listener ) {
					window.removeEventListener( listener.type, listener.handler, listener.options );
				} );
			}
			this.errorQueue = [];
			this.notificationContainer = null;
			this.globalListeners = [];
			if ( window.layersErrorHandler === this ) {
				window.layersErrorHandler = null;
			}
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.ErrorHandler = ErrorHandler;

		// Global singleton instance (intentional - for error handling)
		if ( !window.layersErrorHandler ) {
			window.layersErrorHandler = new ErrorHandler();
		}
	}

	// Export via CommonJS for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { ErrorHandler };
	}

}());
