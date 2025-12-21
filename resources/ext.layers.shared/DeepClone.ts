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

/// <reference path="./globals.d.ts" />

/**
 * Layer object type (simplified for this module)
 */
interface Layer {
	id?: string;
	type?: string;
	[ key: string ]: unknown;
}

/**
 * Deep clone an object or array
 *
 * @param obj - The object to clone
 * @returns A deep clone of the object
 */
export function deepClone<T>( obj: T ): T {
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
		} catch {
			// Fall through to JSON method for unsupported types
		}
	}

	// Fallback to JSON.parse(JSON.stringify())
	// This handles plain objects and arrays well
	try {
		return JSON.parse( JSON.stringify( obj ) ) as T;
	} catch ( e ) {
		// Last resort: return original for objects that can't be serialized
		if ( typeof mw !== 'undefined' && mw.log?.warn ) {
			mw.log.warn( '[DeepClone] Failed to clone object:', ( e as Error ).message );
		}
		return obj;
	}
}

/**
 * Deep clone an array of objects (optimized for layer arrays)
 *
 * @param arr - The array to clone
 * @returns A deep clone of the array
 */
export function deepCloneArray<T>( arr: T[] ): T[] {
	if ( !Array.isArray( arr ) ) {
		return [];
	}
	return deepClone( arr );
}

/**
 * Deep clone a single layer object
 *
 * @param layer - The layer to clone
 * @returns A deep clone of the layer, or null if invalid
 */
export function deepCloneLayer( layer: Layer | null | undefined ): Layer | null {
	if ( !layer || typeof layer !== 'object' ) {
		return null;
	}
	return deepClone( layer );
}

// Browser environment: Export to window.Layers namespace
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.Utils = window.Layers.Utils || {};
	window.Layers.Utils.deepClone = deepClone;
	window.Layers.Utils.deepCloneArray = deepCloneArray;
	window.Layers.Utils.deepCloneLayer = deepCloneLayer;
}

// Default export for ES module usage
export default {
	deepClone,
	deepCloneArray,
	deepCloneLayer
};
