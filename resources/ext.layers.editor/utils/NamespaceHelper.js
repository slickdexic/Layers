/**
 * Namespace Helper for Layers Editor
 *
 * Provides utilities for resolving classes from the Layers namespace with
 * graceful fallback to global scope. This centralizes the namespace resolution
 * logic that was previously duplicated across multiple files.
 *
 * @module NamespaceHelper
 */
( function () {
	'use strict';

	/**
	 * Cache for resolved class lookups to avoid repeated namespace traversal.
	 * Key format: "namespacePath|globalName"
	 * Value: resolved class/object or null (explicit null for not-found)
	 * @type {Map<string, Function|Object|null>}
	 */
	const classCache = new Map();

	/**
	 * Get a class from namespace or global fallback (lazy evaluation with caching)
	 *
	 * Prefers window.Layers.* namespace, falls back to window.* for compatibility.
	 * This allows gradual migration from global exports to namespaced exports.
	 * Results are cached to avoid repeated namespace traversal.
	 *
	 * @param {string} namespacePath - Path under window.Layers (e.g., 'Utils.EventTracker')
	 * @param {string} globalName - Global fallback name (e.g., 'EventTracker')
	 * @return {Function|Object|null} The class/object or null if not found
	 *
	 * @example
	 * // Resolve EventTracker from namespace or global
	 * const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
	 *
	 * @example
	 * // Resolve nested namespace
	 * const ColorPicker = getClass( 'UI.ColorPickerDialog', 'ColorPickerDialog' );
	 */
	function getClass( namespacePath, globalName ) {
		// Check cache first
		const cacheKey = namespacePath + '|' + globalName;
		if ( classCache.has( cacheKey ) ) {
			return classCache.get( cacheKey );
		}

		// Try namespace first (preferred)
		const parts = namespacePath.split( '.' );
		let obj = ( typeof window !== 'undefined' ) ? window.Layers : undefined;
		for ( const part of parts ) {
			obj = obj && obj[ part ];
		}
		if ( obj ) {
			classCache.set( cacheKey, obj );
			return obj;
		}

		// Global fallback (for backwards compatibility)
		if ( typeof window !== 'undefined' && window[ globalName ] ) {
			classCache.set( cacheKey, window[ globalName ] );
			return window[ globalName ];
		}

		// Node/test environment fallback
		if ( typeof global !== 'undefined' && global[ globalName ] ) {
			classCache.set( cacheKey, global[ globalName ] );
			return global[ globalName ];
		}

		// Cache the null result to avoid repeated failed lookups
		classCache.set( cacheKey, null );
		return null;
	}

	/**
	 * Clear the class resolution cache.
	 * Useful for testing or when namespace contents change dynamically.
	 */
	function clearClassCache() {
		classCache.clear();
	}

	/**
	 * Resolve multiple classes at once
	 *
	 * @param {Object.<string, string>} mappings - Object mapping namespace paths to global names
	 * @return {Object.<string, Function|Object|null>} Object with resolved classes keyed by global name
	 *
	 * @example
	 * const { EventTracker, StateManager } = resolveClasses({
	 *   'Utils.EventTracker': 'EventTracker',
	 *   'Core.StateManager': 'StateManager'
	 * });
	 */
	function resolveClasses( mappings ) {
		const result = {};
		for ( const [ namespacePath, globalName ] of Object.entries( mappings ) ) {
			result[ globalName ] = getClass( namespacePath, globalName );
		}
		return result;
	}

	/**
	 * Check if a class exists in namespace or global scope
	 *
	 * @param {string} namespacePath - Path under window.Layers
	 * @param {string} globalName - Global fallback name
	 * @return {boolean} True if the class exists
	 */
	function classExists( namespacePath, globalName ) {
		return getClass( namespacePath, globalName ) !== null;
	}

	// Export to Layers namespace
	window.Layers = window.Layers || {};
	window.Layers.Utils = window.Layers.Utils || {};
	window.Layers.Utils.getClass = getClass;
	window.Layers.Utils.resolveClasses = resolveClasses;
	window.Layers.Utils.classExists = classExists;
	window.Layers.Utils.clearClassCache = clearClassCache;

	// Also export standalone for modules that load before namespace is ready
	window.layersGetClass = getClass;
	window.layersClearClassCache = clearClassCache;

}() );
