/**
 * IdGenerator - Utility for generating unique layer IDs
 *
 * Uses a combination of timestamp, session counter, and random suffix
 * to guarantee uniqueness even when multiple IDs are generated in
 * the same millisecond.
 *
 * @module IdGenerator
 */
( function () {
	'use strict';

	// Session-level counter for guaranteed uniqueness
	let sessionCounter = 0;

	// Session identifier (random string generated once per page load)
	const sessionId = Math.random().toString( 36 ).slice( 2, 8 );

	/**
	 * Generate a unique layer ID
	 *
	 * Format: layer_{timestamp}_{sessionId}{counter}_{random}
	 * - timestamp: Date.now() for rough temporal ordering
	 * - sessionId: Random 6-char string unique to this page load
	 * - counter: Monotonically increasing integer (resets each page load)
	 * - random: 5-char random suffix for extra uniqueness
	 *
	 * @return {string} A unique layer ID
	 */
	function generateLayerId() {
		sessionCounter++;
		const timestamp = Date.now();
		const random = Math.random().toString( 36 ).slice( 2, 7 );
		return 'layer_' + timestamp + '_' + sessionId + sessionCounter + '_' + random;
	}

	/**
	 * Generate a unique ID with a custom prefix
	 *
	 * @param {string} prefix - The prefix to use (default: 'id')
	 * @return {string} A unique ID with the specified prefix
	 */
	function generateId( prefix ) {
		sessionCounter++;
		const p = prefix || 'id';
		const timestamp = Date.now();
		const random = Math.random().toString( 36 ).slice( 2, 7 );
		return p + '_' + timestamp + '_' + sessionId + sessionCounter + '_' + random;
	}

	/**
	 * Check if a string looks like a valid layer ID
	 *
	 * @param {string} id - The ID to validate
	 * @return {boolean} True if the ID matches expected format
	 */
	function isValidLayerId( id ) {
		if ( typeof id !== 'string' || id.length === 0 ) {
			return false;
		}
		// Accept any string that starts with layer_ followed by alphanumeric/underscore
		return /^layer_[a-zA-Z0-9_]+$/.test( id );
	}

	/**
	 * Get the current session counter value (for testing/debugging)
	 *
	 * @return {number} Current counter value
	 */
	function getSessionCounter() {
		return sessionCounter;
	}

	/**
	 * Reset the session counter (for testing only)
	 * @private
	 */
	function _resetForTesting() {
		sessionCounter = 0;
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.generateLayerId = generateLayerId;
		window.Layers.Utils.generateId = generateId;
		window.Layers.Utils.isValidLayerId = isValidLayerId;
		window.Layers.Utils.getSessionCounter = getSessionCounter;
	}

	// CommonJS export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = {
			generateLayerId: generateLayerId,
			generateId: generateId,
			isValidLayerId: isValidLayerId,
			getSessionCounter: getSessionCounter,
			_resetForTesting: _resetForTesting
		};
	}

}() );
