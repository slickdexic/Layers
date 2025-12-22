/**
 * DeepClone - Utility for deep cloning objects safely
 *
 * Uses structuredClone when available (modern browsers), with fallback
 * to JSON.parse(JSON.stringify()) for older environments.
 *
 * Benefits over JSON.parse(JSON.stringify()):
 * - Handles circular references (structuredClone)
 * - Preserves undefined values in some cases
 * - Better performance in modern browsers
 * - Cleaner, more semantic API
 *
 * @module DeepClone
 */
( function () {
	'use strict';

	/**
	 * Deep clone an object or array
	 *
	 * @param {*} obj - The object to clone
	 * @return {*} A deep clone of the object
	 */
	function deepClone( obj ) {
		// Handle null/undefined
		if ( obj === null || obj === undefined ) {
			return obj;
		}

		// Handle primitives
		if ( typeof obj !== 'object' ) {
			return obj;
		}

		// Use structuredClone if available (modern browsers)
		if ( typeof structuredClone === 'function' ) {
			try {
				return structuredClone( obj );
			} catch ( e ) {
				// Fall through to JSON method for unsupported types
			}
		}

		// Fallback to JSON.parse(JSON.stringify())
		// This handles plain objects and arrays well
		try {
			return JSON.parse( JSON.stringify( obj ) );
		} catch ( e ) {
			// Last resort: shallow clone for objects that can't be serialized
			if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( '[DeepClone] Failed to clone object:', e.message );
			}
			return obj;
		}
	}

	/**
	 * Deep clone an array of objects (optimized for layer arrays)
	 *
	 * @param {Array} arr - The array to clone
	 * @return {Array} A deep clone of the array
	 */
	function deepCloneArray( arr ) {
		if ( !Array.isArray( arr ) ) {
			return [];
		}
		return deepClone( arr );
	}

	/**
	 * Deep clone a single layer object
	 *
	 * @param {Object} layer - The layer to clone
	 * @return {Object|null} A deep clone of the layer
	 */
	function deepCloneLayer( layer ) {
		if ( !layer || typeof layer !== 'object' ) {
			return null;
		}
		return deepClone( layer );
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.deepClone = deepClone;
		window.Layers.Utils.deepCloneArray = deepCloneArray;
		window.Layers.Utils.deepCloneLayer = deepCloneLayer;
	}

	// CommonJS export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = {
			deepClone: deepClone,
			deepCloneArray: deepCloneArray,
			deepCloneLayer: deepCloneLayer
		};
	}

}() );
