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
	ErrorHandler.prototype.setupGlobalErrorHandler = function () {
		var self = this;

		// Handle unhandled promise rejections
		window.addEventListener( 'unhandledrejection', function ( event ) {
			self.handleError( event.reason, 'Unhandled Promise Rejection', 'promise' );
		} );

		// Handle general JavaScript errors
		window.addEventListener( 'error', function ( event ) {
			self.handleError( event.error, 'JavaScript Error', 'script', {
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
		var errorInfo = this.processError( error, context, type, metadata );

		// Add to error queue
		this.addToErrorQueue( errorInfo );

		// Log error for developers
		this.logError( errorInfo );

		// Show user notification based on error severity
		this.showUserNotification( errorInfo );

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
		var timestamp = new Date().toISOString();
		var message = '';
		var stack = '';

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
		var criticalTypes = [ 'security', 'data-loss', 'corruption' ];
		var highTypes = [ 'api', 'save', 'load' ];
		var mediumTypes = [ 'canvas', 'render', 'validation' ];

		// Check for critical keywords in message
		var criticalKeywords = [ 'security', 'xss', 'injection', 'unauthorized', 'corrupt' ];
		var msgLower = message.toLowerCase();

		for ( var i = 0; i < criticalKeywords.length; i++ ) {
			if ( msgLower.indexOf( criticalKeywords[ i ] ) !== -1 ) {
				return 'critical';
			}
		}

		if ( criticalTypes.indexOf( type ) !== -1 ) {
			return 'critical';
		} else if ( highTypes.indexOf( type ) !== -1 ) {
			return 'high';
		} else if ( mediumTypes.indexOf( type ) !== -1 ) {
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
			var logLevel = this.getLogLevel( errorInfo.severity );
			var logMessage = '[Layers] ' + errorInfo.context + ': ' + errorInfo.message;

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
		var shouldShowToUser = errorInfo.severity === 'high' || errorInfo.severity === 'critical';

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
		var notification = document.createElement( 'div' );
		notification.className = 'layers-error-notification layers-error-' + errorInfo.severity;

		var userMessage = this.getUserFriendlyMessage( errorInfo );
		var timestamp = new Date( errorInfo.timestamp ).toLocaleTimeString();

		notification.innerHTML =
			'<div class="error-content">' +
				'<span class="error-icon" aria-hidden="true">⚠</span>' +
				'<div class="error-details">' +
					'<div class="error-message">' + this.escapeHtml( userMessage ) + '</div>' +
					'<div class="error-time">' + this.escapeHtml( timestamp ) + '</div>' +
				'</div>' +
				'<button class="error-close" aria-label="Close notification">×</button>' +
			'</div>';

		// Add close functionality
		var closeBtn = notification.querySelector( '.error-close' );
		closeBtn.addEventListener( 'click', function () {
			notification.remove();
		} );

		// Auto-remove after delay for non-critical errors
		if ( errorInfo.severity !== 'critical' ) {
			setTimeout( function () {
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
		var msgKey = 'layers-error-' + errorInfo.type;
		var fallbackMessage = '';

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
		var div = document.createElement( 'div' );
		div.textContent = str;
		return div.innerHTML;
	};

	/**
	 * Report error to external monitoring service
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
			this.notificationContainer.innerHTML = '';
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
		this.errorQueue = [];
		this.notificationContainer = null;
	};

	// Export ErrorHandler
	window.LayersErrorHandler = ErrorHandler;

	// Create global instance
	if ( !window.layersErrorHandler ) {
		window.layersErrorHandler = new ErrorHandler();
	}

}() );
