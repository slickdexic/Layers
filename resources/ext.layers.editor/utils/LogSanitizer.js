/**
 * Log Sanitizer Utility for Layers Editor
 *
 * Provides centralized message sanitization for logging, removing potentially
 * sensitive data (tokens, paths, URLs, IPs, emails) from log messages.
 * Previously duplicated in LayersEditor, APIErrorHandler, and ValidationManager.
 *
 * @module LogSanitizer
 */
( function () {
	'use strict';

	/**
	 * Safe keys that are allowed through when sanitizing object messages.
	 * @type {Array<string>}
	 */
	const SAFE_KEYS = [ 'type', 'action', 'status', 'tool', 'layer', 'count', 'x', 'y', 'width', 'height' ];

	/**
	 * Maximum length of sanitized string messages before truncation.
	 * @type {number}
	 */
	const MAX_LENGTH = 200;

	/**
	 * Sanitize a log message by removing potentially sensitive data.
	 *
	 * For string messages: replaces tokens, hex strings, file paths, URLs,
	 * connection strings, IP addresses, and email addresses with placeholders.
	 * Truncates at 200 characters.
	 *
	 * For object messages: filters keys against a safe-key whitelist,
	 * replacing unknown values with '[FILTERED]'.
	 *
	 * For other types: returns the value unchanged.
	 *
	 * @param {*} message - The message to sanitize
	 * @return {*} The sanitized message
	 */
	function sanitizeLogMessage( message ) {
		if ( typeof message !== 'string' ) {
			if ( typeof message === 'object' && message !== null ) {
				const obj = {};
				for ( const key in message ) {
					if ( Object.prototype.hasOwnProperty.call( message, key ) ) {
						obj[ key ] = SAFE_KEYS.includes( key ) ? message[ key ] : '[FILTERED]';
					}
				}
				return obj;
			}
			return message;
		}

		let result = String( message );

		// Remove potentially sensitive patterns
		result = result.replace( /[a-zA-Z0-9+/=]{20,}/g, '[TOKEN]' );
		result = result.replace( /[a-fA-F0-9]{16,}/g, '[HEX]' );
		result = result.replace( /[A-Za-z]:[\\/][\w\s\\.-]*/g, '[PATH]' );
		result = result.replace( /\/[\w\s.-]+/g, '[PATH]' );
		result = result.replace( /https?:\/\/[^\s'"<>&]*/gi, '[URL]' );
		result = result.replace( /\w+:\/\/[^\s'"<>&]*/gi, '[CONNECTION]' );
		result = result.replace( /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]' );
		result = result.replace( /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]' );

		if ( result.length > MAX_LENGTH ) {
			result = result.slice( 0, MAX_LENGTH ) + '[TRUNCATED]';
		}

		return result;
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.sanitizeLogMessage = sanitizeLogMessage;
	}

	// CommonJS export for Jest
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { sanitizeLogMessage };
	}
}() );
