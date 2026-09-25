/**
 * Page-owned lossless surface snapshot adapter for Layers.
 * Extracts and replaces a single surface's canvas and layers
 * while preserving the complete document and all other surfaces.
 *
 * Unregistered stateless component.
 */
'use strict';

( function () {
	const ERROR_CODE = 'layers-invalid-editor-snapshot';
	const ERROR_MESSAGE = 'Invalid editor snapshot';
	const SUPPORTED_KINDS = new Set( [ 'image', 'pdf', 'slide' ] );

	/**
	 * Create a safe fixed error object with code layers-invalid-editor-snapshot.
	 * Never exposes raw input or diagnostic text in the message or properties.
	 *
	 * @return {Error}
	 */
	function createInvalidSnapshotError() {
		const err = new Error( ERROR_MESSAGE );
		err.code = ERROR_CODE;
		return err;
	}

	/**
	 * Deep clone a value while strictly validating that it is finite JSON data:
	 * null, booleans, strings, finite numbers, dense arrays, and plain objects.
	 * Rejects undefined, functions, symbols, BigInt, NaN/Infinity, sparse arrays,
	 * symbol keys, non-enumerable properties, accessors, custom class instances,
	 * and cyclic references. Permitted shared acyclic references are cloned independently.
	 *
	 * @param {*} value
	 * @param {Set<Object>} activeAncestors
	 * @return {*}
	 */
	function deepCloneAndValidateJson( value, activeAncestors ) {
		if ( value === null ) {
			return null;
		}

		const type = typeof value;

		if ( type === 'boolean' || type === 'string' ) {
			return value;
		}

		if ( type === 'number' ) {
			if ( !Number.isFinite( value ) ) {
				throw createInvalidSnapshotError();
			}
			return value;
		}

		// Reject undefined, function, symbol, bigint
		if ( type !== 'object' ) {
			throw createInvalidSnapshotError();
		}

		if ( Array.isArray( value ) ) {
			if ( Object.getPrototypeOf( value ) !== Array.prototype ) {
				throw createInvalidSnapshotError();
			}

			if ( Object.getOwnPropertySymbols( value ).length > 0 ) {
				throw createInvalidSnapshotError();
			}

			if ( activeAncestors.has( value ) ) {
				throw createInvalidSnapshotError();
			}

			const len = value.length;
			if ( typeof len !== 'number' || !Number.isInteger( len ) || len < 0 ) {
				throw createInvalidSnapshotError();
			}

			const lenDesc = Object.getOwnPropertyDescriptor( value, 'length' );
			if ( !lenDesc || lenDesc.enumerable || lenDesc.get || lenDesc.set ) {
				throw createInvalidSnapshotError();
			}

			const propNames = Object.getOwnPropertyNames( value );
			if ( propNames.length !== len + 1 ) {
				throw createInvalidSnapshotError();
			}

			activeAncestors.add( value );
			try {
				const clone = new Array( len );
				for ( let i = 0; i < len; i++ ) {
					const key = String( i );
					const desc = Object.getOwnPropertyDescriptor( value, key );
					if ( !desc || !desc.enumerable || desc.get || desc.set ) {
						throw createInvalidSnapshotError();
					}
					clone[ i ] = deepCloneAndValidateJson( desc.value, activeAncestors );
				}
				return clone;
			} finally {
				activeAncestors.delete( value );
			}
		}

		// Plain object validation
		const proto = Object.getPrototypeOf( value );
		if ( proto !== Object.prototype && proto !== null ) {
			throw createInvalidSnapshotError();
		}

		if ( Object.getOwnPropertySymbols( value ).length > 0 ) {
			throw createInvalidSnapshotError();
		}

		if ( activeAncestors.has( value ) ) {
			throw createInvalidSnapshotError();
		}

		const propNames = Object.getOwnPropertyNames( value );
		const ownKeys = Object.keys( value );
		if ( propNames.length !== ownKeys.length ) {
			throw createInvalidSnapshotError();
		}

		activeAncestors.add( value );
		try {
			const clone = proto === null ? Object.create( null ) : {};
			for ( let i = 0; i < ownKeys.length; i++ ) {
				const key = ownKeys[ i ];
				const desc = Object.getOwnPropertyDescriptor( value, key );
				if ( !desc || !desc.enumerable || desc.get || desc.set ) {
					throw createInvalidSnapshotError();
				}
				Object.defineProperty( clone, key, {
					value: deepCloneAndValidateJson( desc.value, activeAncestors ),
					enumerable: true, writable: true, configurable: true
				} );
			}
			return clone;
		} finally {
			activeAncestors.delete( value );
		}
	}

	/**
	 * Validate root snapshot structure and boundaries, returning a deep cloned copy.
	 *
	 * @param {*} snapshot
	 * @return {Object} Deep cloned validated snapshot
	 */
	function validateAndCloneSnapshot( input ) {
		const snapshot = cloneJson( input );
		if ( typeof snapshot !== 'object' || snapshot === null || Array.isArray( snapshot ) ) {
			throw createInvalidSnapshotError();
		}

		const rootProto = Object.getPrototypeOf( snapshot );
		if ( rootProto !== Object.prototype && rootProto !== null ) {
			throw createInvalidSnapshotError();
		}

		if ( snapshot.schemaVersion !== 1 ) {
			throw createInvalidSnapshotError();
		}

		if ( !Array.isArray( snapshot.surfaces ) ) {
			throw createInvalidSnapshotError();
		}

		const clonedSnapshot = snapshot;
		const surfaces = clonedSnapshot.surfaces;
		const seenSurfaceIds = new Set();

		for ( let i = 0; i < surfaces.length; i++ ) {
			const surface = surfaces[ i ];
			if ( typeof surface !== 'object' || surface === null || Array.isArray( surface ) ) {
				throw createInvalidSnapshotError();
			}

			if ( typeof surface.id !== 'string' || surface.id.length === 0 ) {
				throw createInvalidSnapshotError();
			}

			if ( seenSurfaceIds.has( surface.id ) ) {
				throw createInvalidSnapshotError();
			}
			seenSurfaceIds.add( surface.id );

			if ( !SUPPORTED_KINDS.has( surface.kind ) ) {
				throw createInvalidSnapshotError();
			}

			if ( typeof surface.canvas !== 'object' || surface.canvas === null || Array.isArray( surface.canvas ) ) {
				throw createInvalidSnapshotError();
			}
			const canvasProto = Object.getPrototypeOf( surface.canvas );
			if ( canvasProto !== Object.prototype && canvasProto !== null ) {
				throw createInvalidSnapshotError();
			}

			if ( !Array.isArray( surface.layers ) ) {
				throw createInvalidSnapshotError();
			}

			if ( Object.prototype.hasOwnProperty.call( surface, 'readingOrder' ) ) {
				if ( !Array.isArray( surface.readingOrder ) ) {
					throw createInvalidSnapshotError();
				}
				const seenRoIds = new Set();
				for ( let j = 0; j < surface.readingOrder.length; j++ ) {
					const roId = surface.readingOrder[ j ];
					if ( typeof roId !== 'string' || roId.length === 0 || seenRoIds.has( roId ) ) {
						throw createInvalidSnapshotError();
					}
					seenRoIds.add( roId );
				}
			}
		}

		return clonedSnapshot;
	}

	/**
	 * Validate descriptors before inspecting data and redact reflection/recursion failures.
	 *
	 * @param {*} value
	 * @return {*}
	 */
	function cloneJson( value ) {
		try {
			return deepCloneAndValidateJson( value, new Set() );
		} catch ( error ) {
			throw createInvalidSnapshotError();
		}
	}

	class PageOwnedSnapshotAdapter {
		/**
		 * Extract the editor state { canvas, layers } from the exact selected surface.
		 *
		 * @param {Object} snapshot Decoded version-1 snapshot object
		 * @param {string} surfaceId Exact literal surface ID
		 * @return {{ canvas: Object, layers: Array }}
		 */
		toEditorState( snapshot, surfaceId ) {
			if ( typeof surfaceId !== 'string' || surfaceId.length === 0 ) {
				throw createInvalidSnapshotError();
			}

			const clonedSnapshot = validateAndCloneSnapshot( snapshot );
			let targetSurface = null;

			for ( let i = 0; i < clonedSnapshot.surfaces.length; i++ ) {
				if ( clonedSnapshot.surfaces[ i ].id === surfaceId ) {
					targetSurface = clonedSnapshot.surfaces[ i ];
					break;
				}
			}

			if ( !targetSurface ) {
				throw createInvalidSnapshotError();
			}

			return {
				canvas: targetSurface.canvas,
				layers: targetSurface.layers
			};
		}

		/**
		 * Produce a complete snapshot replacing only the selected surface's canvas and layers
		 * with the provided editor state.
		 *
		 * @param {Object} snapshot Decoded version-1 snapshot object
		 * @param {string} surfaceId Exact literal surface ID
		 * @param {Object} state Editor state containing exactly canvas and layers
		 * @return {Object} Complete updated snapshot deep copy
		 */
		withEditorState( snapshot, surfaceId, state ) {
			if ( typeof surfaceId !== 'string' || surfaceId.length === 0 ) {
				throw createInvalidSnapshotError();
			}

			// Inspect only a validated data copy, never caller accessors.
			state = cloneJson( state );
			// Validate state object structure
			if ( typeof state !== 'object' || state === null || Array.isArray( state ) ) {
				throw createInvalidSnapshotError();
			}

			const stateProto = Object.getPrototypeOf( state );
			if ( stateProto !== Object.prototype && stateProto !== null ) {
				throw createInvalidSnapshotError();
			}

			if ( Object.getOwnPropertySymbols( state ).length > 0 ) {
				throw createInvalidSnapshotError();
			}

			const stateKeys = Object.keys( state );
			if ( stateKeys.length !== 2 ) {
				throw createInvalidSnapshotError();
			}

			if (
				!Object.prototype.hasOwnProperty.call( state, 'canvas' ) ||
				!Object.prototype.hasOwnProperty.call( state, 'layers' )
			) {
				throw createInvalidSnapshotError();
			}

			const clonedState = state;

			if (
				typeof clonedState.canvas !== 'object' ||
				clonedState.canvas === null ||
				Array.isArray( clonedState.canvas )
			) {
				throw createInvalidSnapshotError();
			}
			const canvasProto = Object.getPrototypeOf( clonedState.canvas );
			if ( canvasProto !== Object.prototype && canvasProto !== null ) {
				throw createInvalidSnapshotError();
			}

			if ( !Array.isArray( clonedState.layers ) ) {
				throw createInvalidSnapshotError();
			}

			const clonedSnapshot = validateAndCloneSnapshot( snapshot );
			let targetSurface = null;

			for ( let i = 0; i < clonedSnapshot.surfaces.length; i++ ) {
				if ( clonedSnapshot.surfaces[ i ].id === surfaceId ) {
					targetSurface = clonedSnapshot.surfaces[ i ];
					break;
				}
			}

			if ( !targetSurface ) {
				throw createInvalidSnapshotError();
			}

			// Retained reading-order check
			if ( Object.prototype.hasOwnProperty.call( targetSurface, 'readingOrder' ) ) {
				const readingOrder = targetSurface.readingOrder;
				const replacementIdCounts = new Map();

				for ( let i = 0; i < clonedState.layers.length; i++ ) {
					const layer = clonedState.layers[ i ];
					if (
						typeof layer === 'object' &&
						layer !== null &&
						!Array.isArray( layer ) &&
						typeof layer.id === 'string'
					) {
						replacementIdCounts.set( layer.id, ( replacementIdCounts.get( layer.id ) || 0 ) + 1 );
					}
				}

				for ( let i = 0; i < readingOrder.length; i++ ) {
					const roId = readingOrder[ i ];
					if ( typeof roId !== 'string' || replacementIdCounts.get( roId ) !== 1 ) {
						throw createInvalidSnapshotError();
					}
				}
			}

			targetSurface.canvas = clonedState.canvas;
			targetSurface.layers = clonedState.layers;

			return clonedSnapshot;
		}
	}

	// Export for ResourceLoader
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedSnapshotAdapter = PageOwnedSnapshotAdapter;

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedSnapshotAdapter;
	}
}() );
