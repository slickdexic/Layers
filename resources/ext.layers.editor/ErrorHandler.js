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
	function ErrorHandler() {
		this.errorQueue = [];
		this.maxErrors = 10;
		this.notificationContainer = null;
		this.debugMode = false;
		this.globalListeners = [];

		// Initialize error container
		this.initErrorContainer();

		// Set up global error handler
		this.setupGlobalErrorHandler();
	}

	/**
	 * Initialize error notification container
	 */
	ErrorHandler.prototype.initErrorContainer = function () {
		this.notificationContainer = document.createElement( 'div' );
		this.notificationContainer.className = 'layers-error-notifications';
		this.notificationContainer.setAttribute( 'role', 'alert' );
		this.notificationContainer.setAttribute( 'aria-live', 'polite' );
		document.body.appendChild( this.notificationContainer );
	};

	/**
	 * Set up global error handler for unhandled errors
	 */
	ErrorHandler.prototype.registerWindowListener = function ( type, handler, options ) {
		window.addEventListener( type, handler, options );
		this.globalListeners.push( { type: type, handler: handler, options: options } );
	};

	ErrorHandler.prototype.setupGlobalErrorHandler = function () {
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
	};

	/**
	 * Handle errors with classification and user feedback
	 *
	 * @param {Error|string} error - The error object or message
	 * @param {string} context - Context where the error occurred
	 * @param {string} type - Type of error (api, canvas, validation, etc.)
	 * @param {Object} metadata - Additional error metadata
	 */
	ErrorHandler.prototype.handleError = function ( error, context, type, metadata ) {
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
	};

	/**
	 * Process error into standardized format
	 *
	 * @param {Error|string} error - The error
	 * @param {string} context - Error context
	 * @param {string} type - Error type
	 * @param {Object} metadata - Additional metadata
	 * @return {Object} Processed error information
	 */
	ErrorHandler.prototype.processError = function ( error, context, type, metadata ) {
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
	};

	/**
	 * Generate unique error ID
	 *
	 * @return {string} Unique error identifier
	 */
	ErrorHandler.prototype.generateErrorId = function () {
		return 'err_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	};

	/**
	 * Determine error severity based on type and message
	 *
	 * @param {string} type - Error type
	 * @param {string} message - Error message
	 * @return {string} Severity level (low, medium, high, critical)
	 */
	ErrorHandler.prototype.determineSeverity = function ( type, message ) {
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
	};

	/**
	 * Add error to internal queue with size management
	 *
	 * @param {Object} errorInfo - Processed error information
	 */
	ErrorHandler.prototype.addToErrorQueue = function ( errorInfo ) {
		this.errorQueue.push( errorInfo );

		// Maintain queue size
		if ( this.errorQueue.length > this.maxErrors ) {
			this.errorQueue.shift();
		}
	};

	/**
	 * Log error for developers
	 *
	 * @param {Object} errorInfo - Error information
	 */
	ErrorHandler.prototype.logError = function ( errorInfo ) {
		if ( this.debugMode || window.console ) {
			const logLevel = this.getLogLevel( errorInfo.severity );
			const logMessage = '[Layers] ' + errorInfo.context + ': ' + errorInfo.message;

			if ( window.console && window.console[ logLevel ] ) {
				window.console[ logLevel ]( logMessage, errorInfo );
			}
		}

		// Use MediaWiki logging if available
		if ( window.mw && window.mw.log ) {
			mw.log.error( 'Layers Error: ' + errorInfo.context + ' - ' + errorInfo.message );
		}
	};

	/**
	 * Get appropriate console log level for severity
	 *
	 * @param {string} severity - Error severity
	 * @return {string} Console method name
	 */
	ErrorHandler.prototype.getLogLevel = function ( severity ) {
		switch ( severity ) {
			case 'critical':
			case 'high':
				return 'error';
			case 'medium':
				return 'warn';
			default:
				return 'log';
		}
	};

	/**
	 * Show user notification based on error severity
	 *
	 * @param {Object} errorInfo - Error information
	 */
	ErrorHandler.prototype.showUserNotification = function ( errorInfo ) {
		const shouldShowToUser = errorInfo.severity === 'high' || errorInfo.severity === 'critical';

		if ( shouldShowToUser ) {
			this.createUserNotification( errorInfo );
		}
	};

	/**
	 * Create user-visible error notification
	 *
	 * @param {Object} errorInfo - Error information
	 */
	ErrorHandler.prototype.createUserNotification = function ( errorInfo ) {
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

		// Add close functionality
		closeBtn.addEventListener( 'click', () => {
			notification.remove();
		} );

		// Auto-remove after delay for non-critical errors
		if ( errorInfo.severity !== 'critical' ) {
			setTimeout( () => {
				if ( notification.parentNode ) {
					notification.remove();
				}
			}, 8000 );
		}

		this.notificationContainer.appendChild( notification );
	};

	/**
	 * Convert technical error to user-friendly message
	 *
	 * @param {Object} errorInfo - Error information
	 * @return {string} User-friendly message
	 */
	ErrorHandler.prototype.getUserFriendlyMessage = function ( errorInfo ) {
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

		// Use MediaWiki message if available
		if ( window.mw && window.mw.message && mw.message( msgKey ).exists() ) {
			return mw.message( msgKey ).text();
		}

		return fallbackMessage;
	};

	/**
	 * Escape HTML to prevent XSS in error messages
	 *
	 * @param {string} str - String to escape
	 * @return {string} HTML-escaped string
	 */
	ErrorHandler.prototype.escapeHtml = function ( str ) {
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
	};

	/**
	 * Attempt recovery for recoverable errors
	 *
	 * @param {Object} errorInfo - Processed error information
	 */
	ErrorHandler.prototype.attemptRecovery = function ( errorInfo ) {
		const recoveryStrategy = this.getRecoveryStrategy( errorInfo );

		if ( recoveryStrategy ) {
			this.executeRecoveryStrategy( recoveryStrategy, errorInfo );
		}
	};

	/**
	 * Report error to external services
	 *
	 * @param {Object} errorInfo - Error information
	 */
	ErrorHandler.prototype.reportError = function ( errorInfo ) {
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
	};

	/**
	 * Get recovery strategy for error type
	 *
	 * @param {Object} errorInfo - Error information
	 * @return {Object|null} Recovery strategy or null
	 */
	ErrorHandler.prototype.getRecoveryStrategy = function ( errorInfo ) {
		const strategies = {
			'load': {
				action: 'retry',
				delay: 2000,
				maxAttempts: 2,
				message: 'Retrying layer load...'
			},
			'save': {
				action: 'retry',
				delay: 3000,
				maxAttempts: 1,
				message: 'Retrying save operation...'
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
	};

	/**
	 * Execute recovery strategy
	 *
	 * @param {Object} strategy - Recovery strategy
	 * @param {Object} errorInfo - Error information
	 */
	ErrorHandler.prototype.executeRecoveryStrategy = function ( strategy, errorInfo ) {
		switch ( strategy.action ) {
			case 'retry':
				this.showRecoveryNotification( strategy.message );
				setTimeout( () => {
					this.retryOperation( errorInfo );
				}, strategy.delay );
				break;
			case 'refresh':
				this.showRecoveryNotification( strategy.message );
				setTimeout( () => {
					window.location.reload();
				}, 2000 );
				break;
			case 'notify':
				this.showRecoveryNotification( strategy.message );
				break;
		}
	};

	/**
	 * Show recovery notification to user
	 *
	 * @param {string} message - Recovery message
	 */
	ErrorHandler.prototype.showRecoveryNotification = function ( message ) {
		if ( window.mw && window.mw.notify ) {
			mw.notify( message, { type: 'info', autoHide: true } );
		}
	};

	/**
	 * Retry failed operation
	 *
	 * @param {Object} errorInfo - Error information
	 */
	ErrorHandler.prototype.retryOperation = function ( errorInfo ) {
		// This would need to be implemented based on the specific operation
		// For now, just log that a retry was attempted
		this.logError( Object.assign( {}, errorInfo, {
			message: 'Recovery: Retrying operation - ' + errorInfo.message,
			severity: 'low'
		} ) );
	};

	/**
	 * Get recent errors for debugging
	 *
	 * @param {number} limit - Maximum number of errors to return
	 * @return {Array} Recent error information
	 */
	ErrorHandler.prototype.getRecentErrors = function ( limit ) {
		limit = limit || 5;
		return this.errorQueue.slice( -limit );
	};

	/**
	 * Clear error queue
	 */
	ErrorHandler.prototype.clearErrors = function () {
		this.errorQueue = [];
		if ( this.notificationContainer ) {
			while ( this.notificationContainer.firstChild ) {
				this.notificationContainer.removeChild( this.notificationContainer.firstChild );
			}
		}
	};

	/**
	 * Set debug mode
	 *
	 * @param {boolean} enabled - Whether to enable debug mode
	 */
	ErrorHandler.prototype.setDebugMode = function ( enabled ) {
		this.debugMode = !!enabled;
	};

	/**
	 * Destroy error handler and clean up
	 */
	ErrorHandler.prototype.destroy = function () {
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
	};

	// Export ErrorHandler
	window.LayersErrorHandler = ErrorHandler;

	// Create global instance
	if ( !window.layersErrorHandler ) {
		window.layersErrorHandler = new ErrorHandler();
	}

}());
