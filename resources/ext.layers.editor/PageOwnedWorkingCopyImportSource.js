/**
 * Inactive exact-source preparation and fresh revalidation for working-copy Import.
 * Injected reads supply authority; detached previews never apply or publish work.
 */
'use strict';

( function () {
	const instances = new WeakMap();
	const hasOwn = ( value, key ) => Object.prototype.hasOwnProperty.call( value, key );
	const isId = value => typeof value === 'string' && value.length > 0;
	const nameKey = value => value.replace( /[\s_]+/g, ' ' ).trim().toLowerCase();

	function unavailable() {
		const error = new Error( 'Working-copy Import unavailable' );
		error.code = 'layers-working-copy-import-unavailable';
		return error;
	}

	function fields( value, names ) {
		if ( value === null || typeof value !== 'object' || Array.isArray( value ) ||
			![ Object.prototype, null ].includes( Object.getPrototypeOf( value ) ) ) {
			throw unavailable();
		}
		const keys = Reflect.ownKeys( value );
		if ( keys.length !== names.length || !names.every( name => keys.includes( name ) ) ) {
			throw unavailable();
		}
		const descriptors = names.map( name => Object.getOwnPropertyDescriptor( value, name ) );
		if ( descriptors.some( descriptor => !descriptor || !descriptor.enumerable || !hasOwn( descriptor, 'value' ) ) ) {
			throw unavailable();
		}
		return Object.fromEntries( names.map( ( name, index ) => [ name, descriptors[ index ].value ] ) );
	}

	function dataEqual( left, right ) {
		if ( left === right ) {
			return true;
		}
		if ( left === null || right === null || typeof left !== 'object' || typeof right !== 'object' ||
			Array.isArray( left ) !== Array.isArray( right ) ) {
			return false;
		}
		const keys = Object.keys( left );
		return keys.length === Object.keys( right ).length && keys.every( key =>
			hasOwn( right, key ) && dataEqual( left[ key ], right[ key ] ) );
	}

	function activeState( instance ) {
		const state = instances.get( instance );
		if ( !state || !state.active ) {
			throw unavailable();
		}
		return state;
	}

	function recordFor( instance, handle ) {
		const state = activeState( instance ), record = state.handles.get( handle );
		if ( !record ) {
			throw unavailable();
		}
		return { state, record };
	}

	function copyData( state, value ) {
		return state.toEditorState( {
			schemaVersion: 1,
			surfaces: [ { id: 'import-data', kind: 'slide', layers: [], canvas: { value } } ]
		}, 'import-data' ).canvas.value;
	}

	function selectSurface( state, snapshot, id ) {
		state.toEditorState( snapshot, id );
		const surface = snapshot.surfaces.find( member => member.id === id );
		if ( !surface || ![ 'image', 'slide' ].includes( surface.kind ) || typeof surface.label !== 'string' ||
			!Number.isFinite( surface.canvas.width ) || surface.canvas.width <= 0 ||
			!Number.isFinite( surface.canvas.height ) || surface.canvas.height <= 0 ) {
			throw unavailable();
		}
		return surface;
	}

	function sourceResult( state, response, source ) {
		const result = copyData( state, response );
		if ( !result || typeof result !== 'object' || Array.isArray( result ) ||
			result.revisionId !== source.revisionId ) {
			throw unavailable();
		}
		const surface = selectSurface( state, result.snapshot, source.surfaceId );
		return { result, surface };
	}

	class PageOwnedWorkingCopyImportSource {
		/**
		 * @param {Object} dependencies Accepted reader, planner and snapshot adapter
		 */
		constructor( dependencies ) {
			try {
				const { reader, planner, adapter } = fields( dependencies, [ 'reader', 'planner', 'adapter' ] );
				if ( !reader || !planner || !adapter || typeof reader.read !== 'function' ||
					typeof planner.prepare !== 'function' || typeof adapter.toEditorState !== 'function' ||
					typeof adapter.withWorkingCopyImport !== 'function' ) {
					throw unavailable();
				}
				instances.set( this, {
					active: true, handles: new WeakMap(), read: reader.read.bind( reader ),
					prepare: planner.prepare.bind( planner ), toEditorState: adapter.toEditorState.bind( adapter ),
					apply: adapter.withWorkingCopyImport.bind( adapter )
				} );
			} catch ( error ) {
				throw unavailable();
			}
		}

		/**
		 * @param {Object} request Exact target, source descriptor, mode and planner options
		 * @return {Promise<Object|null>} Frozen opaque handle, or null for Cancel
		 */
		async prepare( request ) {
			try {
				const state = activeState( this );
				if ( request === null || typeof request !== 'object' || Array.isArray( request ) ||
					![ Object.prototype, null ].includes( Object.getPrototypeOf( request ) ) ) {
					throw unavailable();
				}
				const modeDescriptor = Object.getOwnPropertyDescriptor( request, 'mode' );
				if ( !modeDescriptor || !modeDescriptor.enumerable || !hasOwn( modeDescriptor, 'value' ) ) {
					throw unavailable();
				}
				if ( modeDescriptor.value === 'cancel' ) {
					return null;
				}
				const captured = fields( request, [ 'targetSnapshot', 'targetSurfaceId', 'source', 'mode', 'maxLayers', 'allocateId' ] );
				const { targetSurfaceId, mode, maxLayers, allocateId } = captured;
				if ( !isId( targetSurfaceId ) || ![ 'empty', 'append', 'replace' ].includes( mode ) ||
					!Number.isInteger( maxLayers ) || maxLayers <= 0 || typeof allocateId !== 'function' ) {
					throw unavailable();
				}
				const source = copyData( state, fields( captured.source, [ 'owner', 'revisionId', 'surfaceId' ] ) );
				if ( typeof source.owner !== 'string' || !source.owner.trim() || !isId( source.surfaceId ) ||
					!Number.isInteger( source.revisionId ) || source.revisionId < 1 || source.revisionId > 2147483647 ) {
					throw unavailable();
				}
				const targetSnapshot = copyData( state, captured.targetSnapshot );
				const target = selectSurface( state, targetSnapshot, targetSurfaceId );
				if ( mode === 'empty' ? target.layers.length !== 0 : target.layers.length === 0 ) {
					throw unavailable();
				}
				const response = await state.read( { owner: source.owner, revisionId: source.revisionId } );
				activeState( this );
				const authorized = sourceResult( state, response, source );
				const selected = authorized.surface;
				if ( target.kind !== selected.kind || nameKey( target.label ) !== nameKey( selected.label ) ||
					( target.kind === 'image' && ( !target.source || !selected.source ||
						target.source.fileTitle !== selected.source.fileTitle ) ) ) {
					throw unavailable();
				}
				const plan = state.prepare( { targetSurface: target, sourceSurface: selected, mode, maxLayers, allocateId } );
				const candidateSnapshot = state.apply( targetSnapshot, targetSurfaceId, plan, mode );
				const differentFileVersion = target.kind === 'image' &&
					[ 'timestamp', 'sha1', 'repository' ].some( key =>
						hasOwn( target.source, key ) !== hasOwn( selected.source, key ) ||
						!dataEqual( target.source[ key ], selected.source[ key ] ) );
				activeState( this );
				const handle = Object.freeze( Object.create( null ) );
				state.handles.set( handle, {
					source, sourceLabel: selected.label, authorizedSource: authorized.result,
					targetSnapshot, candidateSnapshot, targetSurfaceId, mode,
					importedLayerIds: copyData( state, plan.importedLayerIds ), differentFileVersion
				} );
				return handle;
			} catch ( error ) {
				throw unavailable();
			}
		}

		/**
		 * @param {Object} handle Issued live handle
		 * @return {Object} Fresh detached preview, never application authority
		 */
		inspect( handle ) {
			try {
				const { state, record } = recordFor( this, handle );
				return copyData( state, {
					source: { ...record.source, label: record.sourceLabel }, targetSurfaceId: record.targetSurfaceId,
					mode: record.mode, importedLayerIds: record.importedLayerIds,
					candidateSnapshot: record.candidateSnapshot, differentFileVersion: record.differentFileVersion
				} );
			} catch ( error ) {
				throw unavailable();
			}
		}

		/**
		 * @param {Object} handle Issued live handle
		 * @return {Promise<undefined>} Fresh source check only; no commit-capable token
		 */
		async revalidate( handle ) {
			try {
				const { state, record } = recordFor( this, handle );
				const response = await state.read( { owner: record.source.owner, revisionId: record.source.revisionId } );
				if ( recordFor( this, handle ).record !== record ) {
					throw unavailable();
				}
				const fresh = sourceResult( state, response, record.source );
				if ( !dataEqual( fresh.result, record.authorizedSource ) ) {
					throw unavailable();
				}
				recordFor( this, handle );
			} catch ( error ) {
				throw unavailable();
			}
		}

		/** @param {Object} handle Issued live handle */
		release( handle ) {
			try {
				const { state } = recordFor( this, handle );
				state.handles.delete( handle );
			} catch ( error ) {
				throw unavailable();
			}
		}

		dispose() {
			const state = instances.get( this );
			if ( !state ) {
				throw unavailable();
			}
			state.active = false;
			state.handles = new WeakMap();
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.PageOwnedWorkingCopyImportSource = PageOwnedWorkingCopyImportSource;
	}
	if ( typeof module !== 'undefined' && typeof module.require === 'function' && module.exports ) {
		module.exports = PageOwnedWorkingCopyImportSource;
	}
}() );