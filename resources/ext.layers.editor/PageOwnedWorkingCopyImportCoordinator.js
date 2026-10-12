/** Inactive native-ID composition of the accepted read, preparation and application path. */
'use strict';

( function () {
	const instances = new WeakMap();
	const activeBridges = new WeakSet();
	const hasOwn = ( value, key ) => Object.prototype.hasOwnProperty.call( value, key );
	const identityFields = [ 'owner', 'pageId', 'revisionId', 'surfaceId' ];

	function unavailable() {
		const error = new Error( 'Working-copy Import unavailable' );
		error.code = 'layers-working-copy-import-unavailable';
		return error;
	}

	function fields( value, names ) {
		if ( !value || typeof value !== 'object' || Array.isArray( value ) ||
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

	function identity( value ) {
		const result = fields( value, identityFields );
		if ( typeof result.owner !== 'string' || !result.owner.trim() ||
			![ result.pageId, result.revisionId ].every( number => Number.isInteger( number ) && number >= 1 && number <= 2147483647 ) ||
			typeof result.surfaceId !== 'string' || !result.surfaceId ||
			encodeURIComponent( result.surfaceId ).replace( /%[A-F\d]{2}|./g, 'x' ).length > 128 ) {
			throw unavailable();
		}
		return result;
	}

	function equalIdentity( left, right ) {
		return identityFields.every( field => left[ field ] === right[ field ] );
	}

	function method( object, key ) {
		if ( !object || ![ 'object', 'function' ].includes( typeof object ) ) {
			throw unavailable();
		}
		for ( let owner = object; owner; owner = Object.getPrototypeOf( owner ) ) {
			const descriptor = Object.getOwnPropertyDescriptor( owner, key );
			if ( descriptor ) {
				if ( !hasOwn( descriptor, 'value' ) || typeof descriptor.value !== 'function' ) {
					throw unavailable();
				}
				return { object, key, owner, value: descriptor.value, call: descriptor.value.bind( object ) };
			}
		}
		throw unavailable();
	}

	function checkMethods( methods ) {
		for ( const captured of methods ) {
			const current = method( captured.object, captured.key );
			if ( current.owner !== captured.owner || current.value !== captured.value ) {
				throw unavailable();
			}
		}
	}

	function stateFor( coordinator ) {
		const state = instances.get( coordinator );
		if ( !state || !state.active ) {
			throw unavailable();
		}
		checkMethods( state.methods );
		const session = Object.getOwnPropertyDescriptor( state.bridge, 'session' );
		if ( !session || !hasOwn( session, 'value' ) || session.value !== state.session ) {
			throw unavailable();
		}
		return state;
	}

	function checkRecord( coordinator, record ) {
		const state = stateFor( coordinator );
		if ( record.closed || record.consumed || !equalIdentity( identity( state.getIdentity.call() ), record.target ) ) {
			throw unavailable();
		}
		if ( record.componentMethods ) {
			checkMethods( record.componentMethods );
		}
		return state;
	}

	function recordFor( coordinator, handle ) {
		const state = stateFor( coordinator ), record = state.records.get( handle );
		if ( !record ) {
			throw unavailable();
		}
		checkRecord( coordinator, record );
		return { state, record };
	}

	function cleanup( state, record ) {
		if ( record.bridgeHandle && !record.applying ) {
			try {
				state.releaseBridge.call( record.bridgeHandle );
			} catch ( error ) {}
			record.bridgeHandle = null;
		}
		if ( record.component ) {
			try {
				record.disposeComponent.call();
			} catch ( error ) {}
		}
	}

	class PageOwnedWorkingCopyImportCoordinator {
		enableCreationProvenance() {
			const state = stateFor( this );
			if ( !state.session.hasCreationImport() || !state.session.hasWorkingCopyImportProvenance() ) { throw unavailable(); }
			state.provenanceEnabled = true;
		}
		/** Explicit opt-in; no existing editor or UI caller invokes this method. */
		enablePublicationProvenance() {
			const state = stateFor( this );
			state.session.enableWorkingCopyImportProvenance( state.readClient );
			state.provenanceEnabled = true;
		}
		constructor( dependencies ) {
			try {
				const state = fields( dependencies, [ 'bridge', 'session', 'readClient', 'Source', 'planner', 'adapter' ] );
				if ( typeof state.Source !== 'function' ) {
					throw unavailable();
				}
				state.getIdentity = method( state.session, 'getWorkingCopyImportIdentity' );
				state.creation = typeof state.session.hasCreationImport === 'function' && state.session.hasCreationImport();
				state.read = method( state.readClient, 'read' );
				state.prepareBridge = method( state.bridge, 'prepareWorkingCopyImport' );
				state.inspectBridge = method( state.bridge, 'inspectWorkingCopyImport' );
				state.applyBridge = method( state.bridge, 'applyWorkingCopyImport' );
				state.releaseBridge = method( state.bridge, 'releaseWorkingCopyImport' );
				state.methods = [ state.getIdentity, state.read, state.prepareBridge, state.inspectBridge, state.applyBridge, state.releaseBridge,
					method( state.planner, 'prepare' ), method( state.adapter, 'toEditorState' ), method( state.adapter, 'withWorkingCopyImport' ),
					...[ 'prepare', 'inspect', 'apply', 'release', 'dispose' ].map( key => method( this, key ) ) ];
				if ( state.creation ) { state.methods.push( method( state.session, 'validateCreationImportResponse' ) ); }
				state.active = true;
				state.records = new Map();
				state.pending = new Set();
				instances.set( this, state );
				stateFor( this );
			} catch ( error ) {
				throw unavailable();
			}
		}

		async prepare( sourceChoice, options ) {
			let state, record, ownsActive = false;
			try {
				state = stateFor( this );
				const mode = options && Object.getOwnPropertyDescriptor( options, 'mode' );
				if ( !mode || !mode.enumerable || !hasOwn( mode, 'value' ) ) {
					throw unavailable();
				}
				if ( mode.value === 'cancel' ) {
					return null;
				}
				const captured = fields( options, [ 'mode', 'maxLayers', 'allocateId' ] );
				if ( ![ 'empty', 'append', 'replace' ].includes( captured.mode ) ||
					!Number.isInteger( captured.maxLayers ) || captured.maxLayers < 1 || typeof captured.allocateId !== 'function' ) {
					throw unavailable();
				}
				const source = identity( sourceChoice ), target = identity( state.getIdentity.call() );
				if ( source.pageId === target.pageId || activeBridges.has( state.bridge ) ) {
					throw unavailable();
				}
				record = { target, source, closed: false, consumed: false, applying: false, bridgeHandle: null };
				state.pending.add( record );
				activeBridges.add( state.bridge );
				ownsActive = true;
				const reader = { read: async request => {
					checkRecord( this, record );
					const requested = fields( request, [ 'owner', 'revisionId' ] );
					if ( requested.owner !== source.owner || requested.revisionId !== source.revisionId ) {
						throw unavailable();
					}
					const response = await state.read.call( {
						targetPageId: target.pageId, targetBaseRevisionId: target.revisionId, targetSurfaceId: target.surfaceId,
						sourcePageId: source.pageId, sourceRevisionId: source.revisionId, sourceSurfaceId: source.surfaceId
					} );
					checkRecord( this, record );
					let result;
					if ( Object.hasOwn( response, 'creation' ) ) {
						if ( !state.creation ) { throw unavailable(); }
						method( state.session, 'validateCreationImportResponse' ).call( response ); checkRecord( this, record );
						const creationResult = fields( response, [ 'creation', 'source', 'sourceBundle' ] );
						result = { target: creationResult.creation.target, source: creationResult.source, sourceBundle: creationResult.sourceBundle };
					} else { result = fields( response, [ 'target', 'source', 'targetBundle', 'sourceBundle' ] ); }
					if ( !equalIdentity( identity( result.target ), target ) || !equalIdentity( identity( result.source ), source ) ) {
						throw unavailable();
					}
					return result.sourceBundle;
				} };
				if ( state.provenanceEnabled ) {
					reader.getNativeIdentity = () => { checkRecord( this, record ); return { target: { ...target }, source: { ...source } }; };
				}
				record.component = new state.Source( { reader, planner: state.planner, adapter: state.adapter } );
				record.componentMethods = [ 'prepare', 'inspect', 'revalidate', 'release', 'dispose' ].map( key => method( record.component, key ) );
				record.disposeComponent = method( record.component, 'dispose' );
				checkRecord( this, record );
				record.bridgeHandle = await state.prepareBridge.call( record.component, {
					source: { owner: source.owner, revisionId: source.revisionId, surfaceId: source.surfaceId }, ...captured
				} );
				checkRecord( this, record );
				const handle = Object.freeze( Object.create( null ) );
				state.records.set( handle, record );
				state.pending.delete( record );
				return handle;
			} catch ( error ) {
				if ( record ) {
					record.closed = true;
					state.pending.delete( record );
					cleanup( state, record );
				}
				throw unavailable();
			} finally {
				if ( ownsActive ) {
					activeBridges.delete( state.bridge );
				}
			}
		}

		inspect( handle ) {
			try {
				const { state, record } = recordFor( this, handle );
				const preview = state.inspectBridge.call( record.bridgeHandle );
				checkRecord( this, record );
				return preview;
			} catch ( error ) {
				throw unavailable();
			}
		}

		async apply( handle ) {
			let state, record, ownsActive = false;
			try {
				state = stateFor( this );
				if ( handle === null ) {
					return null;
				}
				record = recordFor( this, handle ).record;
				if ( record.applying || activeBridges.has( state.bridge ) ) {
					throw unavailable();
				}
				record.applying = true;
				activeBridges.add( state.bridge );
				ownsActive = true;
				const result = await state.applyBridge.call( record.bridgeHandle );
				record.consumed = true;
				return result;
			} catch ( error ) {
				throw unavailable();
			} finally {
				if ( ownsActive ) {
					record.applying = false;
					activeBridges.delete( state.bridge );
					if ( record.closed ) {
						cleanup( state, record );
					}
				}
			}
		}

		release( handle ) {
			const state = instances.get( this ), record = state && state.records.get( handle );
			if ( !record || record.closed || record.applying ) {
				throw unavailable();
			}
			record.closed = true;
			state.records.delete( handle );
			cleanup( state, record );
		}

		dispose() {
			const state = instances.get( this );
			if ( !state ) {
				throw unavailable();
			}
			state.active = false;
			for ( const record of [ ...state.records.values(), ...state.pending ] ) {
				record.closed = true;
				cleanup( state, record );
			}
			state.records.clear();
			state.pending.clear();
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.PageOwnedWorkingCopyImportCoordinator = PageOwnedWorkingCopyImportCoordinator;
	}
	if ( typeof module !== 'undefined' && typeof module.require === 'function' && module.exports ) {
		module.exports = PageOwnedWorkingCopyImportCoordinator;
	}
}() );
