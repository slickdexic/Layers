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

	const importHasOwn = ( value, key ) => Object.prototype.hasOwnProperty.call( value, key );
	const importIsObject = value => value !== null && typeof value === 'object' && !Array.isArray( value );
	const importIsId = value => typeof value === 'string' && value.length > 0;

	function importDataEqual( left, right ) {
		if ( left === right ) {
			return true;
		}
		if ( left === null || right === null || typeof left !== 'object' || typeof right !== 'object' ||
			Array.isArray( left ) !== Array.isArray( right ) ) {
			return false;
		}
		const keys = Object.keys( left );
		return keys.length === Object.keys( right ).length && keys.every( key =>
			importHasOwn( right, key ) && importDataEqual( left[ key ], right[ key ] ) );
	}

	function validateImportSurface( surface ) {
		if ( !importIsObject( surface ) || !importIsId( surface.id ) || typeof surface.label !== 'string' ||
			![ 'image', 'slide' ].includes( surface.kind ) || !importIsObject( surface.canvas ) ||
			!Number.isFinite( surface.canvas.width ) || surface.canvas.width <= 0 ||
			!Number.isFinite( surface.canvas.height ) || surface.canvas.height <= 0 || !Array.isArray( surface.layers ) ) {
			throw createInvalidSnapshotError();
		}
		const layers = new Map(), parents = new Map();
		for ( const layer of surface.layers ) {
			if ( !importIsObject( layer ) || !importIsId( layer.id ) || !importIsId( layer.type ) || layers.has( layer.id ) ) {
				throw createInvalidSnapshotError();
			}
			layers.set( layer.id, layer );
		}
		for ( const layer of surface.layers ) {
			if ( layer.type !== 'group' ) {
				continue;
			}
			if ( !Array.isArray( layer.children ) ) {
				throw createInvalidSnapshotError();
			}
			for ( const child of layer.children ) {
				if ( !importIsId( child ) || !layers.has( child ) || parents.has( child ) ||
					layers.get( child ).parentGroup !== layer.id ) {
					throw createInvalidSnapshotError();
				}
				parents.set( child, layer.id );
			}
		}
		for ( const layer of surface.layers ) {
			if ( importHasOwn( layer, 'parentGroup' ) && layer.parentGroup !== null &&
				( !importIsId( layer.parentGroup ) || parents.get( layer.id ) !== layer.parentGroup ) ) {
				throw createInvalidSnapshotError();
			}
			const seen = new Set( [ layer.id ] );
			let parent = parents.get( layer.id );
			while ( parent !== undefined ) {
				if ( seen.has( parent ) ) {
					throw createInvalidSnapshotError();
				}
				seen.add( parent );
				parent = parents.get( parent );
			}
		}
		if ( importHasOwn( surface, 'readingOrder' ) ) {
			if ( !Array.isArray( surface.readingOrder ) ) {
				throw createInvalidSnapshotError();
			}
			const seen = new Set();
			for ( const id of surface.readingOrder ) {
				if ( !importIsId( id ) || !layers.has( id ) || seen.has( id ) ) {
					throw createInvalidSnapshotError();
				}
				seen.add( id );
			}
		}
		return layers;
	}

	function validateImportCandidate( target, plan, mode ) {
		if ( !importIsObject( plan ) || Object.keys( plan ).length !== 2 ||
			!importHasOwn( plan, 'surface' ) || !importHasOwn( plan, 'importedLayerIds' ) ||
			!Array.isArray( plan.importedLayerIds ) ) {
			throw createInvalidSnapshotError();
		}
		const candidate = plan.surface, oldLayers = validateImportSurface( target );
		validateImportSurface( candidate );
		if ( mode === 'empty' ? target.layers.length !== 0 : target.layers.length === 0 ) {
			throw createInvalidSnapshotError();
		}
		const mutable = new Set( [ 'layers', 'readingOrder' ] );
		if ( mode === 'empty' && target.kind === 'slide' ) {
			mutable.add( 'canvas' );
		}
		const targetKeys = Object.keys( target ).filter( key => !mutable.has( key ) );
		const candidateKeys = Object.keys( candidate ).filter( key => !mutable.has( key ) );
		if ( targetKeys.length !== candidateKeys.length || targetKeys.some( key =>
			!importHasOwn( candidate, key ) || !importDataEqual( target[ key ], candidate[ key ] ) ) ) {
			throw createInvalidSnapshotError();
		}
		const imported = new Set();
		for ( const [ index, id ] of plan.importedLayerIds.entries() ) {
			if ( !importIsId( id ) || imported.has( id ) || oldLayers.has( id ) ||
				!candidate.layers[ index ] || candidate.layers[ index ].id !== id ) {
				throw createInvalidSnapshotError();
			}
			imported.add( id );
		}
		const suffix = candidate.layers.slice( plan.importedLayerIds.length );
		if ( mode === 'append' ? !importDataEqual( suffix, target.layers ) : suffix.length !== 0 ) {
			throw createInvalidSnapshotError();
		}
		if ( importHasOwn( target, 'readingOrder' ) && !importHasOwn( candidate, 'readingOrder' ) ) {
			throw createInvalidSnapshotError();
		}
		if ( importHasOwn( candidate, 'readingOrder' ) ) {
			const prefix = mode === 'append' ? ( target.readingOrder || target.layers.map( layer => layer.id ) ) : [];
			if ( !importDataEqual( candidate.readingOrder.slice( 0, prefix.length ), prefix ) ||
				candidate.readingOrder.slice( prefix.length ).some( id => !imported.has( id ) ) ) {
				throw createInvalidSnapshotError();
			}
		}
		return candidate;
	}

	class PageOwnedSnapshotAdapter {
		/**
		 * @param {Object} snapshot Current complete document
		 * @param {string} surfaceId Exact existing image/slide ID
		 * @param {Object} state Canvas, layers and optional own readingOrder
		 * @return {Object} Detached document with only the selected working fields restored
		 */
		withWorkingCopyRestore( snapshot, surfaceId, state ) {
			try {
				if ( !importIsId( surfaceId ) ) {
					throw createInvalidSnapshotError();
				}
				const copied = cloneJson( state );
				if ( !importIsObject( copied ) || !importHasOwn( copied, 'canvas' ) || !importHasOwn( copied, 'layers' ) ||
					Object.keys( copied ).some( key => ![ 'canvas', 'layers', 'readingOrder' ].includes( key ) ) ) {
					throw createInvalidSnapshotError();
				}
				const result = validateAndCloneSnapshot( snapshot ), target = result.surfaces.find( surface => surface.id === surfaceId );
				if ( !target || ![ 'image', 'slide' ].includes( target.kind ) ||
					( target.kind === 'image' && ( !importIsObject( copied.canvas ) ||
						copied.canvas.width !== target.canvas.width || copied.canvas.height !== target.canvas.height ) ) ) {
					throw createInvalidSnapshotError();
				}
				target.canvas = copied.canvas;
				target.layers = copied.layers;
				if ( importHasOwn( copied, 'readingOrder' ) ) {
					target.readingOrder = copied.readingOrder;
				} else {
					delete target.readingOrder;
				}
				const validated = validateAndCloneSnapshot( result );
				if ( importHasOwn( copied, 'readingOrder' ) ) {
					const counts = new Map();
					for ( const layer of copied.layers ) {
						if ( importIsObject( layer ) && typeof layer.id === 'string' ) {
							counts.set( layer.id, ( counts.get( layer.id ) || 0 ) + 1 );
						}
					}
					if ( copied.readingOrder.some( id => counts.get( id ) !== 1 ) ) {
						throw createInvalidSnapshotError();
					}
				}
				return validated;
			} catch ( error ) {
				throw createInvalidSnapshotError();
			}
		}

		/**
		 * Apply a validated detached Import plan without publication or editor mutation.
		 *
		 * @param {Object} snapshot Complete version-1 snapshot
		 * @param {string} surfaceId Exact target surface ID
		 * @param {Object} plan Detached surface and ordered importedLayerIds
		 * @param {string} mode Empty, append or replace
		 * @return {Object} Complete isolated snapshot
		 */
		withWorkingCopyImport( snapshot, surfaceId, plan, mode ) {
			try {
				if ( !importIsId( surfaceId ) || ![ 'empty', 'append', 'replace' ].includes( mode ) ) {
					throw createInvalidSnapshotError();
				}
				const result = validateAndCloneSnapshot( snapshot ), clonedPlan = cloneJson( plan );
				const target = result.surfaces.find( surface => surface.id === surfaceId );
				if ( !target ) {
					throw createInvalidSnapshotError();
				}
				const candidate = validateImportCandidate( target, clonedPlan, mode );
				target.canvas = candidate.canvas;
				target.layers = candidate.layers;
				if ( importHasOwn( candidate, 'readingOrder' ) ) {
					target.readingOrder = candidate.readingOrder;
				}
				return validateAndCloneSnapshot( result );
			} catch ( error ) {
				throw createInvalidSnapshotError();
			}
		}

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
