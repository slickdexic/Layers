/**
 * One owner/revision/surface editing session. No legacy storage or automatic retry.
 * The UI owns draft persistence and deliberate conflict reconciliation.
 */
( function () {
	'use strict';

	const preparedPdfDrafts = new WeakMap();
	const pendingPdfDrafts = new WeakMap();

	function failure( code ) {
		const error = new Error( code );
		error.code = code;
		return error;
	}

	// Snapshots have already passed finite-JSON copying; object key order is not a content change.
	function comparable( value ) {
		if ( Array.isArray( value ) ) {
			return '[' + value.map( comparable ).join( ',' ) + ']';
		}
		if ( value && typeof value === 'object' ) {
			return '{' + Object.keys( value ).sort().map( ( key ) =>
				JSON.stringify( key ) + ':' + comparable( value[ key ] ) ).join( ',' ) + '}';
		}
		return JSON.stringify( value );
	}

	// Mirrors src/Revision/DrawingName.php; the server makes the final decision.
	function normalizeName( name ) {
		name = String( name ).replace( /\s+/gu, ' ' ).trim();
		const chars = Array.from( name );
		return chars.length === 0 || chars.length > 255 || chars.some( ( char ) =>
			char.charCodeAt( 0 ) < 32 || char.charCodeAt( 0 ) === 127 || '|[]{}<>:'.includes( char ) ) ? null : name;
	}

	function nameKey( name ) {
		return String( name ).replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
	}

	function labelOf( surface ) {
		return typeof surface.label === 'string' ? surface.label : '';
	}

	// File titles are already canonical. Their case, underscores and source versions are not name keys.
	function sameScope( left, right ) {
		if ( left.kind === 'slide' || right.kind === 'slide' ) {
			return left.kind === 'slide' && right.kind === 'slide';
		}
		return Boolean( left.source && right.source ) && typeof left.source.fileTitle === 'string' &&
			left.source.fileTitle === right.source.fileTitle;
	}

	function sameSet( left, right ) {
		return sameScope( left, right ) && nameKey( labelOf( left ) ) === nameKey( labelOf( right ) );
	}

	function newSurfaceCollides( existing, added ) {
		return existing.id === added.id || ( sameSet( existing, added ) &&
			( labelOf( existing ) !== labelOf( added ) || !( existing.kind === 'pdf' && added.kind === 'pdf' &&
				Number.isInteger( existing.source.page ) && Number.isInteger( added.source.page ) &&
				existing.source.page > 0 && added.source.page > 0 && existing.source.page !== added.source.page ) ) );
	}

	function setMembers( snapshot, selected ) {
		return snapshot.surfaces.filter( ( surface ) => surface.id === selected.id ||
			( selected.kind === 'pdf' && surface.kind === 'pdf' && sameSet( surface, selected ) ) );
	}

	function isNewSurface( surface, surfaceId ) {
		return Boolean( surface ) && Object.getPrototypeOf( surface ) === Object.prototype &&
			surface.id === surfaceId && [ 'slide', 'image', 'pdf' ].includes( surface.kind ) &&
			typeof surface.label === 'string' && Boolean( surface.canvas ) && typeof surface.canvas === 'object' &&
			Array.isArray( surface.layers ) && surface.layers.length === 0;
	}

	const workingCopyImports = new WeakMap();
	const workingCopyProvenance = new WeakMap();
	const provenanceCheckpoints = new WeakMap();

	function provenanceObserve( session, guard ) {
		const mode = workingCopyProvenance.get( session );
		guard.provenance = mode && { mode, current: mode.current, epoch: mode.epoch };
	}

	function provenanceCheck( session, guard ) {
		const mode = workingCopyProvenance.get( session ), observed = guard.provenance;
		if ( observed ? mode !== observed.mode || mode.current !== observed.current || mode.epoch !== observed.epoch : mode ) {
			throw importUnavailable();
		}
		if ( mode ) { importMethodsExact( [ mode.read ] ); }
	}

	function provenanceClaims( session, input ) {
		const claims = restoreClone( input );
		if ( !Array.isArray( claims ) || claims.length > 32 ) { throw importUnavailable(); }
		for ( const claim of claims ) {
			importObjectFields( claim, [ 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId', 'targetSurfaceId', 'layerIds', 'canvas' ] );
			if ( ![ claim.sourcePageId, claim.sourceRevisionId ].every( id => Number.isInteger( id ) && id > 0 && id <= 2147483647 ) ||
				claim.sourcePageId === session._pageId || claim.targetSurfaceId !== session._surfaceId ||
				![ claim.sourceSurfaceId, claim.targetSurfaceId ].every( id => typeof id === 'string' && id.length > 0 && id.length <= 80 && !/[^A-Za-z0-9_.:-]/.test( id ) ) ||
				typeof claim.canvas !== 'boolean' || !Array.isArray( claim.layerIds ) || claim.layerIds.length > 2000 ||
				claim.layerIds.some( id => typeof id !== 'string' || !id ) || new Set( claim.layerIds ).size !== claim.layerIds.length ) { throw importUnavailable(); }
		}
		return claims;
	}

	function provenanceSetCheckpoint( session, checkpoint, claims, validated = true ) {
		const mode = workingCopyProvenance.get( session );
		if ( mode ) { provenanceCheckpoints.set( checkpoint, { session, epoch: mode.epoch,
			claims: provenanceClaims( session, claims === undefined ? mode.current : claims ), validated } ); }
	}

	function provenancePreparedCheckpoint( session, claims ) {
		const mode = workingCopyProvenance.get( session );
		return mode && { session, epoch: mode.epoch, claims: provenanceClaims( session, claims === undefined ? mode.current : claims ), validated: true };
	}

	function provenanceForCheckpoint( session, checkpoint ) {
		const mode = workingCopyProvenance.get( session ), record = provenanceCheckpoints.get( checkpoint );
		return mode && record && record.session === session && record.epoch === mode.epoch ? record : { claims: [], validated: true };
	}

	function provenanceState( session, state, checkpoint ) {
		const issued = checkpoint && restoreMaps( workingCopyCheckpoints, session ).has( checkpoint );
		return workingCopyProvenance.has( session ) ? { ...state,
			importProvenance: restoreClone( issued ? provenanceForCheckpoint( session, checkpoint ).claims : workingCopyProvenance.get( session ).current ) } : state;
	}

	function provenanceImported( session, record, preview ) {
		const mode = workingCopyProvenance.get( session );
		if ( !mode ) { return undefined; }
		const source = importMethod( record.source.inspect.object, 'getWorkingCopyImportProvenance' ).call( record.sourceHandle );
		importObjectFields( source, [ 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId', 'targetSurfaceId' ] );
		if ( source.sourceRevisionId !== preview.source.revisionId || source.sourceSurfaceId !== preview.source.surfaceId ) { throw importUnavailable(); }
		const before = record.guard.snapshot.surfaces.find( s => s.id === preview.targetSurfaceId );
		const after = preview.candidateSnapshot.surfaces.find( s => s.id === preview.targetSurfaceId );
		const claim = { ...source, layerIds: restoreClone( preview.importedLayerIds ),
			canvas: preview.mode === 'empty' && before.kind === 'slide' && !importDataEqual( before.canvas, after.canvas ) };
		const retained = mode.current.filter( previous => previous.canvas || previous.layerIds.some( id => after.layers.some( layer => layer.id === id ) ) );
		const existing = retained.find( previous => previous.sourcePageId === claim.sourcePageId &&
			previous.sourceRevisionId === claim.sourceRevisionId && previous.sourceSurfaceId === claim.sourceSurfaceId );
		const claims = restoreClone( retained );
		if ( existing ) {
			const merged = claims[ retained.indexOf( existing ) ];
			merged.layerIds = Array.from( new Set( merged.layerIds.concat( claim.layerIds ) ) ); merged.canvas = merged.canvas || claim.canvas;
		} else { claims.push( claim ); }
		return provenanceClaims( session, claims );
	}

	function provenanceCommit( session, claims ) {
		const mode = workingCopyProvenance.get( session );
		if ( mode ) { mode.current = claims; }
	}

	async function provenanceRevalidate( session, claims, afterAwait ) {
		const mode = workingCopyProvenance.get( session );
		if ( !mode ) { throw importUnavailable(); }
		const captured = { mode, epoch: mode.epoch, current: mode.current, owner: session._owner,
			pageId: session._pageId, revisionId: session._revisionId, surfaceId: session._surfaceId, saved: session._savedJson };
		const check = () => {
			if ( workingCopyProvenance.get( session ) !== mode || mode.epoch !== captured.epoch || mode.current !== captured.current ||
				session._phase === 'disposed' || session._owner !== captured.owner || session._pageId !== captured.pageId ||
				session._revisionId !== captured.revisionId || session._surfaceId !== captured.surfaceId || session._savedJson !== captured.saved ) { throw importUnavailable(); }
			importMethodsExact( [ mode.read ] ); workingStateCallback( afterAwait );
		};
		const saved = JSON.parse( captured.saved ), target = saved.surfaces.find( s => s.id === captured.surfaceId ), seen = new Set();
		for ( const claim of claims.flatMap( entry => provenanceClaims( session, [ entry ] ) ) ) {
			const key = JSON.stringify( [ claim.sourcePageId, claim.sourceRevisionId, claim.sourceSurfaceId ] );
			if ( seen.has( key ) ) { continue; } seen.add( key ); check();
			const response = restoreClone( await mode.read.call( { targetPageId: captured.pageId,
				targetBaseRevisionId: captured.revisionId, targetSurfaceId: captured.surfaceId,
				sourcePageId: claim.sourcePageId, sourceRevisionId: claim.sourceRevisionId, sourceSurfaceId: claim.sourceSurfaceId } ) );
			check();
			const selected = response.sourceBundle && response.sourceBundle.snapshot.surfaces.filter( s => s.id === claim.sourceSurfaceId );
			if ( !response.target || response.target.pageId !== captured.pageId || response.target.revisionId !== captured.revisionId ||
				response.target.surfaceId !== captured.surfaceId || response.target.owner !== captured.owner ||
				!response.source || response.source.pageId !== claim.sourcePageId || response.source.revisionId !== claim.sourceRevisionId ||
				response.source.surfaceId !== claim.sourceSurfaceId || !response.targetBundle ||
				!importDataEqual( response.targetBundle.snapshot, saved ) || !selected || selected.length !== 1 ||
				selected[ 0 ].kind !== target.kind || nameKey( selected[ 0 ].label ) !== nameKey( target.label ) ||
				( target.kind === 'image' && selected[ 0 ].source.fileTitle !== target.source.fileTitle ) ) { throw importUnavailable(); }
		}
		check();
	}
	const importHasOwn = ( value, key ) => Object.prototype.hasOwnProperty.call( value, key );
	const importFields = [ '_owner', '_pageId', '_surfaceId', '_revisionId', '_readOnly', '_newSurface',
		'_baseHasDrawings', '_reader', '_publisher', '_adapter', '_pdfContext', '_pdf', '_pdfRecovery',
		'_phase', '_snapshot', '_savedJson', '_reconciling' ];

	function importUnavailable() {
		const error = new Error( 'Working-copy Import unavailable' );
		error.code = 'layers-working-copy-import-unavailable';
		return error;
	}

	function importDescriptor( value, key ) {
		const descriptor = Object.getOwnPropertyDescriptor( value, key );
		if ( !descriptor || !descriptor.enumerable || !importHasOwn( descriptor, 'value' ) ) {
			throw importUnavailable();
		}
		return descriptor;
	}

	function importObjectFields( value, keys ) {
		if ( !value || typeof value !== 'object' || Array.isArray( value ) ||
			![ Object.prototype, null ].includes( Object.getPrototypeOf( value ) ) ||
			Reflect.ownKeys( value ).length !== keys.length ) {
			throw importUnavailable();
		}
		const descriptors = keys.map( key => importDescriptor( value, key ) );
		return Object.fromEntries( keys.map( ( key, index ) => [ key, descriptors[ index ].value ] ) );
	}

	function importMethod( object, key ) {
		if ( !object || typeof object !== 'object' || Array.isArray( object ) ) {
			throw importUnavailable();
		}
		let owner = object;
		while ( owner !== null ) {
			const descriptor = Object.getOwnPropertyDescriptor( owner, key );
			if ( descriptor ) {
				if ( !importHasOwn( descriptor, 'value' ) || typeof descriptor.value !== 'function' ) {
					throw importUnavailable();
				}
				return { object, owner, key, method: descriptor.value, call: descriptor.value.bind( object ) };
			}
			owner = Object.getPrototypeOf( owner );
		}
		throw importUnavailable();
	}

	function importMethodsExact( methods ) {
		for ( const captured of methods ) {
			const current = importMethod( captured.object, captured.key );
			if ( current.method !== captured.method || current.owner !== captured.owner ) {
				throw importUnavailable();
			}
		}
	}

	function importCall( guard, method, ...args ) {
		const result = method.call( ...args );
		if ( guard.session ) {
			importCheckWork( guard.session, guard );
		}
		return result;
	}

	function importCopy( guard, value ) {
		return importCall( guard, guard.copy, { schemaVersion: 1, surfaces: [ {
			id: 'session-import-data', kind: 'slide', layers: [], canvas: { value }
		} ] }, 'session-import-data' ).canvas.value;
	}

	function importDataEqual( left, right, ancestors = new Set() ) {
		if ( left === null || typeof left !== 'object' ) {
			return left === right && ( typeof left !== 'number' || Number.isFinite( left ) );
		}
		if ( !right || typeof right !== 'object' || Array.isArray( left ) !== Array.isArray( right ) || ancestors.has( left ) ) {
			return false;
		}
		const array = Array.isArray( left ), prototype = Object.getPrototypeOf( left );
		if ( array ? prototype !== Array.prototype : ![ Object.prototype, null ].includes( prototype ) ) {
			return false;
		}
		const keys = Reflect.ownKeys( left ), otherKeys = Reflect.ownKeys( right );
		if ( keys.length !== otherKeys.length || keys.some( key => typeof key !== 'string' || !otherKeys.includes( key ) ) ) {
			return false;
		}
		ancestors.add( left );
		try {
			return keys.every( key => {
				const descriptor = Object.getOwnPropertyDescriptor( left, key );
				return descriptor && importHasOwn( descriptor, 'value' ) &&
					( descriptor.enumerable || ( array && key === 'length' ) ) &&
					importDataEqual( descriptor.value, Object.getOwnPropertyDescriptor( right, key ).value, ancestors );
			} );
		} finally {
			ancestors.delete( left );
		}
	}

	function importCheckWork( session, guard ) {
		provenanceCheck( session, guard );
		for ( const key of importFields ) {
			const current = importDescriptor( session, key ), captured = guard.descriptors[ key ];
			if ( current.value !== captured.value || current.writable !== captured.writable ||
				current.configurable !== captured.configurable ) {
				throw importUnavailable();
			}
		}
		importMethodsExact( guard.methods );
		if ( !importDataEqual( guard.descriptors._snapshot.value, guard.snapshot ) ||
			!importDataEqual( guard.descriptors._newSurface.value, guard.newSurface ) ) {
			throw importUnavailable();
		}
	}

	function importCaptureWork( session ) {
		const descriptors = Object.fromEntries( importFields.map( key => [ key, importDescriptor( session, key ) ] ) );
		const value = key => descriptors[ key ].value;
		if ( value( '_phase' ) !== 'ready' || value( '_readOnly' ) !== false || value( '_reconciling' ) !== false ||
			value( '_baseHasDrawings' ) !== true || value( '_pdfContext' ) !== null || value( '_pdf' ) !== null ||
			value( '_pdfRecovery' ) !== null || !value( '_snapshot' ) || typeof value( '_savedJson' ) !== 'string' ||
			typeof value( '_owner' ) !== 'string' || !value( '_owner' ).trim() || typeof value( '_surfaceId' ) !== 'string' ||
			!value( '_surfaceId' ) || !Number.isInteger( value( '_revisionId' ) ) || value( '_revisionId' ) < 1 ||
			value( '_revisionId' ) > 2147483647 || ( value( '_pageId' ) !== undefined &&
				( !Number.isInteger( value( '_pageId' ) ) || value( '_pageId' ) < 1 || value( '_pageId' ) > 2147483647 ) ) ) {
			throw importUnavailable();
		}
		const copy = importMethod( value( '_adapter' ), 'toEditorState' ), apply = importMethod( value( '_adapter' ), 'withWorkingCopyImport' );
		const read = importMethod( value( '_reader' ), 'read' );
		const guard = { descriptors, copy, apply, read, methods: [ copy, apply, read,
			importMethod( value( '_adapter' ), 'withEditorState' ), importMethod( value( '_publisher' ), 'publish' ) ] };
		guard.snapshot = importCopy( guard, value( '_snapshot' ) );
		guard.newSurface = importCopy( guard, value( '_newSurface' ) );
		provenanceObserve( session, guard );
		guard.session = session;
		guard.saved = importCopy( guard, JSON.parse( value( '_savedJson' ) ) );
		importCall( guard, copy, guard.snapshot, value( '_surfaceId' ) );
		const selected = guard.snapshot.surfaces.find( surface => surface.id === value( '_surfaceId' ) );
		if ( !selected || ![ 'image', 'slide' ].includes( selected.kind ) ) {
			throw importUnavailable();
		}
		if ( guard.newSurface !== null ) {
			if ( !isNewSurface( guard.newSurface, selected.id ) || guard.saved.surfaces.some( surface => surface.id === selected.id ) ) {
				throw importUnavailable();
			}
		}
		const savedValidation = { ...guard.saved, surfaces: guard.saved.surfaces.concat( [ {
			id: 'session-import-saved-check', kind: 'slide', canvas: {}, layers: []
		} ] ) };
		importCall( guard, copy, savedValidation, 'session-import-saved-check' );
		importCheckWork( session, guard );
		return guard;
	}

	function importHandles( session ) {
		let handles = workingCopyImports.get( session );
		if ( !handles ) {
			handles = new WeakMap();
			workingCopyImports.set( session, handles );
		}
		return handles;
	}

	function importRecord( session, handle ) {
		const record = importHandles( session ).get( handle );
		if ( !record ) {
			throw importUnavailable();
		}
		importCheckWork( session, record.guard );
		importMethodsExact( record.sourceMethods );
		return record;
	}

	function importCleanup( record ) {
		try {
			record.source.release.call( record.sourceHandle );
		} catch ( error ) {
			return;
		}
	}

	function importPreview( guard, input, request ) {
		const preview = importCopy( guard, input );
		importObjectFields( preview, [ 'source', 'targetSurfaceId', 'mode', 'importedLayerIds', 'candidateSnapshot', 'differentFileVersion' ] );
		const source = importObjectFields( preview.source, [ 'owner', 'revisionId', 'surfaceId', 'label' ] );
		if ( source.owner !== request.source.owner || source.revisionId !== request.source.revisionId ||
			source.surfaceId !== request.source.surfaceId || typeof source.label !== 'string' ||
			preview.mode !== request.mode || preview.targetSurfaceId !== guard.descriptors._surfaceId.value ||
			typeof preview.differentFileVersion !== 'boolean' ) {
			throw importUnavailable();
		}
		importCall( guard, guard.copy, preview.candidateSnapshot, preview.targetSurfaceId );
		const surface = preview.candidateSnapshot.surfaces.find( member => member.id === preview.targetSurfaceId );
		const original = guard.snapshot.surfaces.find( member => member.id === preview.targetSurfaceId );
		if ( nameKey( source.label ) !== nameKey( original.label ) ||
			( original.kind === 'slide' && preview.differentFileVersion ) ||
			!Array.isArray( preview.importedLayerIds ) || surface.layers.length > request.maxLayers ) {
			throw importUnavailable();
		}
		const rebuilt = importCall( guard, guard.apply, guard.snapshot, preview.targetSurfaceId,
			{ surface, importedLayerIds: preview.importedLayerIds }, preview.mode );
		if ( !importDataEqual( rebuilt, preview.candidateSnapshot ) ) {
			throw importUnavailable();
		}
		return preview;
	}

	const workingCopyCheckpoints = new WeakMap();
	const preparedWorkingCopyRestores = new WeakMap();

	function restoreUnavailable() {
		const error = new Error( 'Working-copy restore unavailable' );
		error.code = 'layers-working-copy-restore-unavailable';
		return error;
	}

	function restoreClone( value, ancestors = new Set() ) {
		if ( value === null || typeof value === 'boolean' || typeof value === 'string' ||
			( typeof value === 'number' && Number.isFinite( value ) ) ) {
			return value;
		}
		if ( !value || typeof value !== 'object' || ancestors.has( value ) ) {
			throw restoreUnavailable();
		}
		const array = Array.isArray( value ), prototype = Object.getPrototypeOf( value );
		if ( array ? prototype !== Array.prototype : ![ Object.prototype, null ].includes( prototype ) ) {
			throw restoreUnavailable();
		}
		const keys = Reflect.ownKeys( value );
		if ( keys.some( key => typeof key !== 'string' ) ) {
			throw restoreUnavailable();
		}
		const length = array ? Object.getOwnPropertyDescriptor( value, 'length' ) : null;
		if ( array && ( !length || !importHasOwn( length, 'value' ) || length.enumerable ||
			!Number.isInteger( length.value ) || length.value < 0 || keys.length !== length.value + 1 ||
			keys.some( key => key !== 'length' && ( !/^(0|[1-9][0-9]*)$/.test( key ) || Number( key ) >= length.value ) ) ) ) {
			throw restoreUnavailable();
		}
		const result = array ? new Array( length.value ) : Object.create( prototype );
		ancestors.add( value );
		try {
			for ( const key of keys.filter( name => !array || name !== 'length' ) ) {
				const descriptor = importDescriptor( value, key );
				Object.defineProperty( result, key, { value: restoreClone( descriptor.value, ancestors ),
					enumerable: true, configurable: true, writable: true } );
			}
		} finally {
			ancestors.delete( value );
		}
		return result;
	}

	function restoreMaps( map, session ) {
		let records = map.get( session );
		if ( !records ) {
			records = new WeakMap();
			map.set( session, records );
		}
		return records;
	}

	function restoreCheckWork( session, guard ) {
		provenanceCheck( session, guard );
		for ( const key of importFields ) {
			const current = importDescriptor( session, key ), original = guard.descriptors[ key ];
			if ( current.value !== original.value || current.writable !== original.writable || current.configurable !== original.configurable ) {
				throw restoreUnavailable();
			}
		}
		for ( const method of guard.methods ) {
			const current = importMethod( method.object, method.key ), descriptor = Object.getOwnPropertyDescriptor( current.owner, current.key );
			if ( current.owner !== method.owner || current.method !== method.method ||
				descriptor.writable !== method.descriptor.writable || descriptor.enumerable !== method.descriptor.enumerable ||
				descriptor.configurable !== method.descriptor.configurable ) {
				throw restoreUnavailable();
			}
		}
		if ( !importDataEqual( restoreClone( guard.descriptors._snapshot.value ), guard.snapshot ) ||
			!importDataEqual( restoreClone( guard.descriptors._newSurface.value ), guard.newSurface ) ) {
			throw restoreUnavailable();
		}
	}

	function restoreCall( session, guard, method, ...args ) {
		const result = method.call( ...args );
		restoreCheckWork( session, guard );
		return result;
	}

	function restoreCaptureWork( session ) {
		const descriptors = Object.fromEntries( importFields.map( key => [ key, importDescriptor( session, key ) ] ) ), value = key => descriptors[ key ].value;
		if ( value( '_phase' ) !== 'ready' || value( '_readOnly' ) !== false || value( '_reconciling' ) !== false ||
			value( '_baseHasDrawings' ) !== true || value( '_pdfContext' ) !== null || value( '_pdf' ) !== null ||
			value( '_pdfRecovery' ) !== null || !value( '_snapshot' ) || typeof value( '_savedJson' ) !== 'string' ||
			typeof value( '_owner' ) !== 'string' || !value( '_owner' ).trim() || typeof value( '_surfaceId' ) !== 'string' || !value( '_surfaceId' ) ||
			!Number.isInteger( value( '_revisionId' ) ) || value( '_revisionId' ) < 1 || value( '_revisionId' ) > 2147483647 ||
			( value( '_pageId' ) !== undefined && ( !Number.isInteger( value( '_pageId' ) ) || value( '_pageId' ) < 1 || value( '_pageId' ) > 2147483647 ) ) ) {
			throw restoreUnavailable();
		}
		const guard = { descriptors, snapshot: restoreClone( value( '_snapshot' ) ), newSurface: restoreClone( value( '_newSurface' ) ) };
		provenanceObserve( session, guard );
		const selected = guard.snapshot.surfaces && guard.snapshot.surfaces.find( surface => surface.id === value( '_surfaceId' ) );
		if ( !selected || ![ 'image', 'slide' ].includes( selected.kind ) ) {
			throw restoreUnavailable();
		}
		const entries = [ [ value( '_adapter' ), 'toEditorState' ], [ value( '_adapter' ), 'withWorkingCopyRestore' ],
			[ value( '_adapter' ), 'withEditorState' ], [ value( '_reader' ), 'read' ], [ value( '_publisher' ), 'publish' ] ];
		guard.methods = entries.map( ( [ object, key ] ) => {
			const method = importMethod( object, key );
			return { ...method, descriptor: Object.getOwnPropertyDescriptor( method.owner, key ) };
		} );
		guard.copy = guard.methods[ 0 ]; guard.apply = guard.methods[ 1 ];
		restoreCall( session, guard, guard.copy, restoreClone( guard.snapshot ), value( '_surfaceId' ) );
		restoreCheckWork( session, guard );
		return guard;
	}

	function restoreWorkingState( surface ) {
		return restoreClone( { surfaceId: surface.id, canvas: surface.canvas, layers: surface.layers,
			...( importHasOwn( surface, 'readingOrder' ) ? { readingOrder: surface.readingOrder } : {} ) } );
	}

	function restoreIdentity( guard ) {
		const surface = guard.snapshot.surfaces.find( member => member.id === guard.descriptors._surfaceId.value );
		return restoreClone( { owner: guard.descriptors._owner.value,
			...( guard.descriptors._pageId.value === undefined ? {} : { pageId: guard.descriptors._pageId.value } ),
			surfaceId: surface.id, kind: surface.kind,
			...( importHasOwn( surface, 'source' ) ? { source: surface.source } : {} ) } );
	}

	function restoreCheckpoint( session, checkpoint, guard ) {
		const record = restoreMaps( workingCopyCheckpoints, session ).get( checkpoint );
		if ( !record || !importDataEqual( restoreIdentity( guard ), record.identity ) ) {
			throw restoreUnavailable();
		}
		return record;
	}

	function restoreExpected( snapshot, state ) {
		const result = restoreClone( snapshot ), target = result.surfaces.find( member => member.id === state.surfaceId );
		target.canvas = restoreClone( state.canvas ); target.layers = restoreClone( state.layers );
		if ( importHasOwn( state, 'readingOrder' ) ) {
			target.readingOrder = restoreClone( state.readingOrder );
		} else {
			delete target.readingOrder;
		}
		return result;
	}

	function restorePrepared( session, handle ) {
		const record = restoreMaps( preparedWorkingCopyRestores, session ).get( handle );
		if ( !record ) {
			throw restoreUnavailable();
		}
		restoreCheckWork( session, record.guard );
		restoreCheckpoint( session, record.checkpoint, record.guard );
		return record;
	}

	function restoreResult( session, record ) {
		const candidate = restoreClone( record.candidate ), workingState = restoreWorkingState(
			candidate.surfaces.find( member => member.id === record.guard.descriptors._surfaceId.value ) );
		const editorState = restoreCall( session, record.guard, record.guard.copy, candidate, workingState.surfaceId );
		const result = restoreClone( { editorState, workingState: provenanceState( session, workingState, record.checkpoint ) } );
		if ( !importDataEqual( result.editorState, { canvas: workingState.canvas, layers: workingState.layers } ) ) {
			throw restoreUnavailable();
		}
		return result;
	}

	const preparedWorkingCopyStates = new WeakMap();
	const preparedWorkingCopyDraftRestores = new WeakMap();

	function workingStateBeforeCommit( callback ) {
		if ( callback !== undefined && typeof callback !== 'function' ) {
			throw restoreUnavailable();
		}
	}

	function workingStateCallback( callback ) {
		if ( callback !== undefined && callback() !== undefined ) {
			throw restoreUnavailable();
		}
	}

	function workingStateRecord( session, handle ) {
		const record = restoreMaps( preparedWorkingCopyStates, session ).get( handle );
		if ( !record ) {
			throw restoreUnavailable();
		}
		restoreCheckWork( session, record.guard );
		return record;
	}

	const applicationImportCommits = new WeakMap();
	const applicationImportCleanup = new WeakMap();

	function applicationImportRecord( session, handle ) {
		const record = restoreMaps( applicationImportCommits, session ).get( handle );
		if ( !record || importRecord( session, record.handle ) !== record.importRecord || !record.importRecord.ready || record.importRecord.checking ) {
			throw importUnavailable();
		}
		return record;
	}

	class PageOwnedEditorSession {
		/** Explicitly enable pending native Import citations for a fresh existing image/slide base. */
		enableWorkingCopyImportProvenance( readClient ) {
			const identity = this.getWorkingCopyImportIdentity();
			if ( workingCopyProvenance.has( this ) || this.getStatus().dirty || !identity.pageId ) { throw importUnavailable(); }
			workingCopyProvenance.set( this, { read: importMethod( readClient, 'read' ), current: [], epoch: 0 } );
		}

		hasWorkingCopyImportProvenance() { return workingCopyProvenance.has( this ); }

		captureWorkingCopyImportProvenance( checkpoint ) {
			this._requireLoaded();
			if ( !workingCopyProvenance.has( this ) ) { throw importUnavailable(); }
			if ( checkpoint && !restoreMaps( workingCopyCheckpoints, this ).has( checkpoint ) ) { throw restoreUnavailable(); }
			return restoreClone( checkpoint ? provenanceForCheckpoint( this, checkpoint ).claims : workingCopyProvenance.get( this ).current );
		}

		inspectWorkingCopyDraftCheckpoint( checkpoint ) {
			this._requireLoaded();
			const record = restoreMaps( workingCopyCheckpoints, this ).get( checkpoint );
			const surface = this._snapshot.surfaces.find( s => s.id === this._surfaceId );
			if ( !record || !importDataEqual( record.identity, { owner: this._owner,
				...( this._pageId === undefined ? {} : { pageId: this._pageId } ), surfaceId: this._surfaceId,
				kind: surface.kind, ...( importHasOwn( surface, 'source' ) ? { source: surface.source } : {} ) } ) ) { throw restoreUnavailable(); }
			return provenanceState( this, restoreClone( record.state ), checkpoint );
		}

		async revalidateWorkingCopyDraftProvenance( checkpoints, afterAwait ) {
			if ( checkpoints.some( checkpoint => !restoreMaps( workingCopyCheckpoints, this ).has( checkpoint ) ) ) { throw restoreUnavailable(); }
			const records = checkpoints.map( checkpoint => provenanceForCheckpoint( this, checkpoint ) );
			await provenanceRevalidate( this, records.flatMap( r => r.claims ), afterAwait );
			records.forEach( record => { record.validated = true; } );
		}
		/** Capture complete live backup work, including during a publication hold. */
		updateWorkingCopyDraftState( input ) {
			try {
				this._requireLoaded();
				if ( this._readOnly || this._newSurface || this._pdf || this._pdfContext || this._pdfRecovery ||
					!this._baseHasDrawings || ![ 'ready', 'saving', 'conflict', 'uncertain' ].includes( this._phase ) ) { throw restoreUnavailable(); }
				const descriptors = Object.fromEntries( importFields.map( key => [ key, importDescriptor( this, key ) ] ) );
				const method = importMethod( this._adapter, 'withWorkingCopyRestore' );
				const guard = { descriptors, snapshot: restoreClone( this._snapshot ), newSurface: null,
					methods: [ { ...method, descriptor: Object.getOwnPropertyDescriptor( method.owner, method.key ) } ] };
				provenanceObserve( this, guard );
				const state = restoreClone( input ), surface = guard.snapshot.surfaces.find( s => s.id === this._surfaceId );
				if ( workingCopyProvenance.has( this ) ) { delete state.importProvenance; }
				if ( !surface || ![ 'image', 'slide' ].includes( surface.kind ) || state.surfaceId !== surface.id ||
					Object.keys( state ).some( key => ![ 'surfaceId', 'canvas', 'layers', 'readingOrder' ].includes( key ) ) ) { throw restoreUnavailable(); }
				const expected = restoreExpected( guard.snapshot, state ), values = restoreClone( state ); delete values.surfaceId;
				const candidate = restoreClone( restoreCall( this, guard, method, restoreClone( guard.snapshot ), surface.id, values ) );
				if ( !importDataEqual( candidate, expected ) || !descriptors._snapshot.writable ) { throw restoreUnavailable(); }
				restoreCheckWork( this, guard ); this._snapshot = candidate;
			} catch ( error ) { throw restoreUnavailable(); }
		}

		/** Rebuild a private checkpoint from draft data within the current native surface identity. */
		prepareWorkingCopyDraftCheckpoint( input ) {
			try {
				const guard = restoreCaptureWork( this ), state = restoreClone( input );
				const claims = workingCopyProvenance.has( this ) ? provenanceClaims( this,
					importHasOwn( state, 'importProvenance' ) ? state.importProvenance : [] ) : undefined;
				if ( workingCopyProvenance.has( this ) ) { delete state.importProvenance; }
				if ( !state || Array.isArray( state ) || state.surfaceId !== guard.descriptors._surfaceId.value ||
					!importHasOwn( state, 'canvas' ) || !Array.isArray( state.layers ) ||
					Object.keys( state ).some( key => ![ 'surfaceId', 'canvas', 'layers', 'readingOrder' ].includes( key ) ) ) {
					throw restoreUnavailable();
				}
				const candidate = restoreExpected( guard.snapshot, state ), adapterState = restoreClone( state );
				delete adapterState.surfaceId;
				const actual = restoreClone( restoreCall( this, guard, guard.apply,
					restoreClone( guard.snapshot ), state.surfaceId, adapterState ) );
				if ( !importDataEqual( actual, candidate ) ) { throw restoreUnavailable(); }
				const handle = Object.freeze( Object.create( null ) );
				restoreCheckWork( this, guard );
				restoreMaps( workingCopyCheckpoints, this ).set( handle, {
					identity: restoreIdentity( guard ), state: restoreWorkingState( actual.surfaces.find( s => s.id === state.surfaceId ) )
				} );
				provenanceSetCheckpoint( this, handle, claims, !claims || claims.length === 0 );
				return handle;
			} catch ( error ) { throw restoreUnavailable(); }
		}

		/** Privately prepare complete draft state and an optional validated unsaved rename. */
		prepareWorkingCopyDraftRestore( checkpoint, label, publicationBlocked = false ) {
			try {
				const guard = restoreCaptureWork( this ), captured = restoreCheckpoint( this, checkpoint, guard );
				if ( typeof publicationBlocked !== 'boolean' || !importDescriptor( this, '_phase' ).writable ) { throw restoreUnavailable(); }
				const state = restoreClone( captured.state ), candidate = restoreExpected( guard.snapshot, state );
				const selected = candidate.surfaces.find( s => s.id === state.surfaceId );
				if ( typeof label !== 'string' || ( label !== selected.label && ( normalizeName( label ) !== label ||
					candidate.surfaces.some( s => s.id !== selected.id && sameScope( s, selected ) &&
						nameKey( labelOf( s ) ) === nameKey( label ) ) ) ) ) { throw restoreUnavailable(); }
				selected.label = label;
				const adapterState = restoreClone( state ); delete adapterState.surfaceId;
				const actual = restoreClone( restoreCall( this, guard, guard.apply,
					restoreClone( candidate ), state.surfaceId, adapterState ) );
				if ( !importDataEqual( actual, candidate ) || !importDescriptor( this, '_snapshot' ).writable ) { throw restoreUnavailable(); }
				const handle = Object.freeze( Object.create( null ) );
				restoreCheckWork( this, guard );
				restoreMaps( preparedWorkingCopyDraftRestores, this ).set( handle, { guard, checkpoint, candidate, state, label, publicationBlocked } );
				return handle;
			} catch ( error ) { throw restoreUnavailable(); }
		}

		inspectWorkingCopyDraftRestore( handle ) {
			try {
				const record = restoreMaps( preparedWorkingCopyDraftRestores, this ).get( handle );
				if ( !record ) { throw restoreUnavailable(); }
				restoreCheckWork( this, record.guard ); restoreCheckpoint( this, record.checkpoint, record.guard );
				const result = { ...restoreResult( this, record ), label: record.label,
					dirty: comparable( record.candidate ) !== comparable( JSON.parse( record.guard.descriptors._savedJson.value ) ) };
				restoreCheckWork( this, record.guard ); return result;
			} catch ( error ) { throw restoreUnavailable(); }
		}

		commitWorkingCopyDraftRestore( handle, beforeCommit ) {
			try {
				workingStateBeforeCommit( beforeCommit );
				const record = restoreMaps( preparedWorkingCopyDraftRestores, this ).get( handle );
				if ( !record ) { throw restoreUnavailable(); }
				const result = this.inspectWorkingCopyDraftRestore( handle ), candidate = restoreClone( record.candidate );
				const expected = restoreExpected( record.guard.snapshot, restoreCheckpoint( this, record.checkpoint, record.guard ).state );
				expected.surfaces.find( s => s.id === record.state.surfaceId ).label = record.label;
				if ( !importDataEqual( expected, record.candidate ) || !importDescriptor( this, '_snapshot' ).writable ) { throw restoreUnavailable(); }
				const provenance = provenanceForCheckpoint( this, record.checkpoint ), claims = restoreClone( provenance.claims );
				if ( !provenance.validated ) { throw restoreUnavailable(); }
				workingStateCallback( beforeCommit ); restoreCheckWork( this, record.guard );
				restoreCheckpoint( this, record.checkpoint, record.guard );
				this._snapshot = candidate;
				provenanceCommit( this, claims );
				if ( record.publicationBlocked ) { this._phase = 'conflict'; }
				preparedWorkingCopyDraftRestores.get( this ).delete( handle );
				return result;
			} catch ( error ) { throw restoreUnavailable(); }
		}

		releaseWorkingCopyDraftRestore( handle ) {
			if ( !restoreMaps( preparedWorkingCopyDraftRestores, this ).delete( handle ) ) { throw restoreUnavailable(); }
		}

		getWorkingCopyImportIdentity() {
			try {
				const guard = importCaptureWork( this );
				const value = key => guard.descriptors[ key ].value;
				if ( !Number.isInteger( value( '_pageId' ) ) || value( '_pageId' ) < 1 ||
					value( '_pageId' ) > 2147483647 || value( '_newSurface' ) !== null ) {
					throw importUnavailable();
				}
				const identity = { owner: value( '_owner' ), pageId: value( '_pageId' ),
					revisionId: value( '_revisionId' ), surfaceId: value( '_surfaceId' ) };
				importCheckWork( this, guard );
				return identity;
			} catch ( error ) {
				throw importUnavailable();
			}
		}

		async revalidateWorkingCopyImportApplication( handle, afterAwait ) {
			return arguments.length > 1 ? this.revalidateWorkingCopyImport( handle, afterAwait ) : this.revalidateWorkingCopyImport( handle );
		}

		prepareWorkingCopyImportCommit( handle ) {
			try {
				const record = importRecord( this, handle );
				if ( !record.ready || record.checking ) { throw importUnavailable(); }
				const preview = importPreview( record.guard, record.preview, record.request );
				const candidate = restoreClone( preview.candidateSnapshot );
				const state = restoreWorkingState( candidate.surfaces.find( member => member.id === preview.targetSurfaceId ) );
				if ( !importDataEqual( candidate, restoreExpected( record.guard.snapshot, state ) ) || !importDescriptor( this, '_snapshot' ).writable ) { throw importUnavailable(); }
				const result = { editorState: importCall( record.guard, record.guard.copy, restoreClone( candidate ), preview.targetSurfaceId ),
					workingState: restoreClone( state ), source: restoreClone( preview.source ), mode: preview.mode,
					importedLayerIds: restoreClone( preview.importedLayerIds ), differentFileVersion: preview.differentFileVersion,
					dirty: comparable( candidate ) !== comparable( JSON.parse( this._savedJson ) ) };
				const prepared = Object.freeze( Object.create( null ) ), checkpoint = Object.freeze( Object.create( null ) );
				const claims = provenanceImported( this, record, preview );
				importRecord( this, handle );
				restoreMaps( workingCopyCheckpoints, this );
				restoreMaps( applicationImportCleanup, this );
				restoreMaps( applicationImportCommits, this ).set( prepared, { handle, importRecord: record, candidate, state,
					identity: restoreIdentity( record.guard ), checkpoint, claims, result: restoreClone( result ) } );
				return prepared;
			} catch ( error ) { throw importUnavailable(); }
		}

		inspectPreparedWorkingCopyImportCommit( handle ) {
			try { const record = applicationImportRecord( this, handle ); return restoreClone( record.result ); }
			catch ( error ) { throw importUnavailable(); }
		}

		commitPreparedWorkingCopyImport( handle, beforeCommit ) {
			try {
				workingStateBeforeCommit( beforeCommit );
				const record = applicationImportRecord( this, handle ), original = record.importRecord;
				const preview = importPreview( original.guard, original.preview, original.request );
				const candidate = restoreClone( record.candidate );
				if ( !importDataEqual( candidate, preview.candidateSnapshot ) || !importDataEqual( candidate, restoreExpected( original.guard.snapshot, record.state ) ) ||
					!importDescriptor( this, '_snapshot' ).writable ) { throw importUnavailable(); }
				const result = { ...restoreClone( record.result ), editorState: restoreClone( importCall( original.guard, original.guard.copy, restoreClone( candidate ), preview.targetSurfaceId ) ), checkpoint: record.checkpoint };
				const liveSource = original.source.inspect.call( original.sourceHandle );
				if ( !importDataEqual( liveSource, original.preview ) ) { throw importUnavailable(); }
				applicationImportRecord( this, handle );
				const provenance = provenancePreparedCheckpoint( this, record.claims );
				workingStateCallback( beforeCommit );
				applicationImportRecord( this, handle );
				this._snapshot = candidate;
				provenanceCommit( this, record.claims );
				workingCopyCheckpoints.get( this ).set( record.checkpoint, { identity: record.identity, state: record.state } );
				if ( provenance ) { provenanceCheckpoints.set( record.checkpoint, provenance ); }
				workingCopyImports.get( this ).delete( record.handle );
				applicationImportCleanup.get( this ).set( record.handle, original );
				applicationImportCommits.get( this ).delete( handle );
				return result;
			} catch ( error ) { throw importUnavailable(); }
		}

		releasePreparedWorkingCopyImportCommit( handle ) {
			if ( !restoreMaps( applicationImportCommits, this ).delete( handle ) ) { throw importUnavailable(); }
		}

		prepareWorkingCopyImportCleanup() {
			restoreMaps( applicationImportCleanup, this );
		}

		cleanupAppliedWorkingCopyImport( handle ) {
			const handles = applicationImportCleanup.get( this ), record = handles && handles.get( handle );
			if ( !record ) { throw importUnavailable(); }
			handles.delete( handle );
			try { record.source.release.call( record.sourceHandle ); return []; }
			catch ( error ) { return [ 'working-copy-import-cleanup-failed' ]; }
		}

		prepareWorkingCopyState( state ) {
			try {
				const guard = restoreCaptureWork( this ), copied = restoreClone( state );
				if ( !copied || Array.isArray( copied ) || Object.keys( copied ).length !== 2 ||
					!importHasOwn( copied, 'canvas' ) || !importHasOwn( copied, 'layers' ) || !Array.isArray( copied.layers ) ) {
					throw restoreUnavailable();
				}
				const selected = guard.snapshot.surfaces.find( member => member.id === guard.descriptors._surfaceId.value );
				const stateWithOrder = { ...copied, surfaceId: selected.id };
				if ( importHasOwn( selected, 'readingOrder' ) ) {
					const oldIds = new Set( selected.layers.filter( layer => layer && typeof layer === 'object' ).map( layer => layer.id ) );
					const counts = new Map();
					copied.layers.forEach( layer => {
						if ( layer && typeof layer === 'object' ) {
							counts.set( layer.id, ( counts.get( layer.id ) || 0 ) + 1 );
						}
					} );
					stateWithOrder.readingOrder = selected.readingOrder.filter( id => !oldIds.has( id ) || counts.has( id ) );
					if ( stateWithOrder.readingOrder.some( id => counts.get( id ) !== 1 ) ) {
						throw restoreUnavailable();
					}
				}
				const expected = restoreExpected( guard.snapshot, stateWithOrder ), adapterState = restoreClone( stateWithOrder );
				delete adapterState.surfaceId;
				const candidate = restoreClone( restoreCall( this, guard, guard.apply,
					restoreClone( guard.snapshot ), selected.id, adapterState ) );
				if ( !importDataEqual( candidate, expected ) ) {
					throw restoreUnavailable();
				}
				const checkpoint = Object.freeze( Object.create( null ) ), handle = Object.freeze( Object.create( null ) );
				const record = { guard, candidate, checkpoint, state: restoreWorkingState( candidate.surfaces.find( member => member.id === selected.id ) ),
					identity: restoreIdentity( guard ), dirty: comparable( candidate ) !== comparable( JSON.parse( guard.descriptors._savedJson.value ) ) };
				restoreCheckWork( this, guard );
				restoreMaps( workingCopyCheckpoints, this );
				restoreMaps( preparedWorkingCopyStates, this ).set( handle, record );
				return handle;
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		inspectPreparedWorkingCopyState( handle ) {
			try {
				const record = workingStateRecord( this, handle ), result = { ...restoreResult( this, record ), dirty: record.dirty };
				workingStateRecord( this, handle );
				return result;
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		commitPreparedWorkingCopyState( handle, beforeCommit ) {
			try {
				workingStateBeforeCommit( beforeCommit );
				const record = workingStateRecord( this, handle ), candidate = restoreClone( record.candidate );
				if ( !importDataEqual( candidate, restoreExpected( record.guard.snapshot, record.state ) ) || !importDescriptor( this, '_snapshot' ).writable ) {
					throw restoreUnavailable();
				}
				const result = { ...restoreResult( this, record ), dirty: record.dirty, checkpoint: record.checkpoint };
				const provenance = provenancePreparedCheckpoint( this );
				workingStateCallback( beforeCommit );
				workingStateRecord( this, handle );
				this._snapshot = candidate;
				workingCopyCheckpoints.get( this ).set( record.checkpoint, { identity: record.identity, state: record.state } );
				if ( provenance ) { provenanceCheckpoints.set( record.checkpoint, provenance ); }
				preparedWorkingCopyStates.get( this ).delete( handle );
				return result;
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		releasePreparedWorkingCopyState( handle ) {
			try {
				if ( !restoreMaps( preparedWorkingCopyStates, this ).delete( handle ) ) {
					throw restoreUnavailable();
				}
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		/** @return {Object} Owned reusable opaque full working-state checkpoint */
		captureWorkingCopyCheckpoint() {
			try {
				const guard = restoreCaptureWork( this ), surface = guard.snapshot.surfaces.find( member => member.id === guard.descriptors._surfaceId.value );
				const state = restoreWorkingState( surface ), identity = restoreIdentity( guard );
				const checkpoint = Object.freeze( Object.create( null ) );
				restoreCheckWork( this, guard );
				restoreMaps( workingCopyCheckpoints, this ).set( checkpoint, { identity, state } );
				provenanceSetCheckpoint( this, checkpoint );
				return checkpoint;
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		/** @param {Object} checkpoint Owned checkpoint @return {Object} Detached working state */
		inspectWorkingCopyCheckpoint( checkpoint ) {
			try {
				const guard = restoreCaptureWork( this ), record = restoreCheckpoint( this, checkpoint, guard ), result = provenanceState( this, restoreClone( record.state ), checkpoint );
				restoreCheckWork( this, guard );
				return result;
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		/** @param {Object} checkpoint Owned checkpoint @return {Object} Guarded opaque restore handle */
		prepareWorkingCopyRestore( checkpoint ) {
			try {
				const guard = restoreCaptureWork( this ), captured = restoreCheckpoint( this, checkpoint, guard );
				const expected = restoreExpected( guard.snapshot, captured.state ), state = restoreClone( captured.state );
				delete state.surfaceId;
				const candidate = restoreClone( restoreCall( this, guard, guard.apply,
					restoreClone( guard.snapshot ), guard.descriptors._surfaceId.value, state ) );
				if ( !importDataEqual( candidate, expected ) ) {
					throw restoreUnavailable();
				}
				const handle = Object.freeze( Object.create( null ) );
				restoreCheckpoint( this, checkpoint, guard );
				restoreCheckWork( this, guard );
				restoreMaps( preparedWorkingCopyRestores, this ).set( handle, { guard, checkpoint, candidate } );
				return handle;
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		/** @param {Object} handle Prepared restore @return {Object} Detached editor and working state */
		inspectPreparedWorkingCopyRestore( handle ) {
			try {
				const record = restorePrepared( this, handle ), result = restoreResult( this, record );
				restorePrepared( this, handle );
				return result;
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		/** @param {Object} handle Prepared restore @return {Object} Detached synchronous result */
		commitWorkingCopyRestore( handle, beforeCommit ) {
			try {
				workingStateBeforeCommit( beforeCommit );
				const record = restorePrepared( this, handle ), candidate = restoreClone( record.candidate );
				if ( !importDataEqual( candidate, restoreExpected( record.guard.snapshot,
					restoreCheckpoint( this, record.checkpoint, record.guard ).state ) ) || !importDescriptor( this, '_snapshot' ).writable ) {
					throw restoreUnavailable();
				}
				const result = restoreResult( this, record );
				const provenance = provenanceForCheckpoint( this, record.checkpoint ), claims = restoreClone( provenance.claims );
				if ( !provenance.validated ) { throw restoreUnavailable(); }
				workingStateCallback( beforeCommit );
				restorePrepared( this, handle );
				this._snapshot = candidate;
				provenanceCommit( this, claims );
				preparedWorkingCopyRestores.get( this ).delete( handle );
				return result;
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		/** @param {Object} checkpoint Owned reusable checkpoint; private cleanup only */
		releaseWorkingCopyCheckpoint( checkpoint ) {
			try {
				if ( !restoreMaps( workingCopyCheckpoints, this ).delete( checkpoint ) ) {
					throw restoreUnavailable();
				}
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		/** @param {Object} handle Owned prepared restore; private cleanup only */
		releasePreparedWorkingCopyRestore( handle ) {
			try {
				if ( !restoreMaps( preparedWorkingCopyRestores, this ).delete( handle ) ) {
					throw restoreUnavailable();
				}
			} catch ( error ) {
				throw restoreUnavailable();
			}
		}

		/**
		 * @param {Object} sourceComponent Accepted injected exact-source component
		 * @param {Object} request Source descriptor and Import options only
		 * @return {Promise<Object|null>} Private frozen session handle, or null for Cancel
		 */
		async prepareWorkingCopyImport( sourceComponent, request ) {
			let cleanup = null;
			try {
				const modeDescriptor = importDescriptor( request, 'mode' );
				if ( modeDescriptor.value === 'cancel' ) {
					return null;
				}
				const captured = importObjectFields( request, [ 'source', 'mode', 'maxLayers', 'allocateId' ] );
				const guard = importCaptureWork( this );
				captured.source = importCopy( guard, importObjectFields( captured.source, [ 'owner', 'revisionId', 'surfaceId' ] ) );
				if ( ![ 'empty', 'append', 'replace' ].includes( captured.mode ) ||
					!Number.isInteger( captured.maxLayers ) || captured.maxLayers <= 0 || typeof captured.allocateId !== 'function' ||
					typeof captured.source.owner !== 'string' || !captured.source.owner.trim() ||
					!Number.isInteger( captured.source.revisionId ) || captured.source.revisionId < 1 || captured.source.revisionId > 2147483647 ||
					typeof captured.source.surfaceId !== 'string' || !captured.source.surfaceId ) {
					throw importUnavailable();
				}
				const source = Object.fromEntries( [ 'prepare', 'inspect', 'revalidate', 'release' ].map( key => [ key, importMethod( sourceComponent, key ) ] ) );
				const sourceMethods = Object.values( source );
				const targetSnapshot = importCopy( guard, guard.snapshot );
				importMethodsExact( sourceMethods );
				importCheckWork( this, guard );
				const sourceHandle = await source.prepare.call( { ...captured, targetSnapshot, targetSurfaceId: guard.descriptors._surfaceId.value } );
				cleanup = { source, sourceHandle };
				importCheckWork( this, guard );
				importMethodsExact( sourceMethods );
				const preview = importPreview( guard, importCall( guard, source.inspect, sourceHandle ), captured );
				importMethodsExact( sourceMethods );
				importCheckWork( this, guard );
				const handle = Object.freeze( Object.create( null ) );
				importHandles( this ).set( handle, { guard, source, sourceMethods, sourceHandle, preview, request: captured,
					ready: false, checking: false } );
				cleanup = null;
				return handle;
			} catch ( error ) {
				if ( cleanup ) {
					importCleanup( cleanup );
				}
				throw importUnavailable();
			}
		}

		/** @param {Object} handle Live session handle @return {Object} Detached preview */
		inspectWorkingCopyImport( handle ) {
			try {
				const record = importRecord( this, handle );
				const fresh = importCopy( record.guard, record.source.inspect.call( record.sourceHandle ) );
				const result = importCopy( record.guard, record.preview );
				if ( !importDataEqual( fresh, record.preview ) ) {
					throw importUnavailable();
				}
				importRecord( this, handle );
				return result;
			} catch ( error ) {
				throw importUnavailable();
			}
		}

		/** @param {Object} handle Live session handle @return {Promise<void>} Fresh checks only */
		async revalidateWorkingCopyImport( handle, participantGuard ) {
			let record;
			let ownsCheck = false;
			try {
				const callback = participantGuard;
				if ( arguments.length > 1 && typeof callback !== 'function' ) { throw importUnavailable(); }
				workingStateBeforeCommit( callback );
				record = importRecord( this, handle );
				if ( record.checking ) {
					throw importUnavailable();
				}
				record.ready = false;
				record.checking = true;
				ownsCheck = true;
				const guard = record.guard;
				const response = await guard.read.call( { owner: guard.descriptors._owner.value, revisionId: guard.descriptors._revisionId.value } );
				workingStateCallback( callback );
				importRecord( this, handle );
				const bundle = importCopy( guard, response );
				if ( callback !== undefined ) { workingStateCallback( callback ); importRecord( this, handle ); }
				if ( bundle.revisionId !== guard.descriptors._revisionId.value || !importDataEqual( bundle.snapshot, guard.saved ) ) {
					throw importUnavailable();
				}
				importRecord( this, handle );
				await record.source.revalidate.call( record.sourceHandle );
				workingStateCallback( callback );
				importRecord( this, handle );
				record.ready = true;
			} catch ( error ) {
				if ( ownsCheck ) {
					record.ready = false;
				}
				throw importUnavailable();
			} finally {
				if ( ownsCheck ) {
					record.checking = false;
				}
			}
		}

		/** @param {Object} handle Revalidated live handle @return {Object} Detached bridge data */
		commitWorkingCopyImport( handle ) {
			try {
				const record = importRecord( this, handle );
				if ( !record.ready || record.checking ) {
					throw importUnavailable();
				}
				const preview = importPreview( record.guard, record.preview, record.request );
				const candidate = importCopy( record.guard, preview.candidateSnapshot );
				const result = importCopy( record.guard, {
					editorState: importCall( record.guard, record.guard.copy, candidate, preview.targetSurfaceId ), source: preview.source,
					mode: preview.mode, importedLayerIds: preview.importedLayerIds, differentFileVersion: preview.differentFileVersion
				} );
				const assignment = importDescriptor( this, '_snapshot' );
				if ( !assignment.writable ) {
					throw importUnavailable();
				}
				const liveSource = record.source.inspect.call( record.sourceHandle );
				if ( !importDataEqual( liveSource, record.preview ) ) {
					throw importUnavailable();
				}
				importRecord( this, handle );
				const claims = provenanceImported( this, record, preview );
				this._snapshot = candidate;
				provenanceCommit( this, claims );
				workingCopyImports.get( this ).delete( handle );
				return result;
			} catch ( error ) {
				throw importUnavailable();
			}
		}

		/** @param {Object} handle Owned handle; cleanup is allowed after session disposal */
		releaseWorkingCopyImport( handle ) {
			try {
				const handles = workingCopyImports.get( this ), record = handles && handles.get( handle );
				if ( !record ) {
					throw importUnavailable();
				}
				handles.delete( handle );
				importCleanup( record );
			} catch ( error ) {
				throw importUnavailable();
			}
		}

		/**
		 * @param {Object} options Immutable owner, revisionId, surfaceId and optional pageId/readOnly; newSurface
		 *  starts a drawing the page does not have yet, and emptyBase says the base revision has no drawings
		 * @param {Object} dependencies Accepted reader, publisher and snapshot adapter
		 */
		constructor( options, dependencies ) {
			if ( !options || typeof options.owner !== 'string' || !options.owner.trim() ||
				typeof options.surfaceId !== 'string' || !options.surfaceId ||
				!Number.isInteger( options.revisionId ) || options.revisionId < 1 ||
				options.revisionId > 2147483647 ||
				( options.pageId !== undefined && ( !Number.isInteger( options.pageId ) ||
					options.pageId < 1 || options.pageId > 2147483647 ) ) ||
				( options.readOnly !== undefined && typeof options.readOnly !== 'boolean' ) ||
				( options.newSurface !== undefined && !isNewSurface( options.newSurface, options.surfaceId ) ) ||
				( options.emptyBase !== undefined &&
					( typeof options.emptyBase !== 'boolean' || options.newSurface === undefined ) ) ||
				!dependencies || !dependencies.reader || typeof dependencies.reader.read !== 'function' ||
				!dependencies.publisher || typeof dependencies.publisher.publish !== 'function' ||
				!dependencies.adapter || typeof dependencies.adapter.toEditorState !== 'function' ||
				typeof dependencies.adapter.withEditorState !== 'function' ) {
				throw failure( 'layers-invalid-editor-session' );
			}
			this._owner = options.owner;
			this._pageId = options.pageId;
			this._surfaceId = options.surfaceId;
			this._revisionId = options.revisionId;
			this._readOnly = options.readOnly === true;
			this._newSurface = options.newSurface ? JSON.parse( JSON.stringify( options.newSurface ) ) : null;
			this._baseHasDrawings = options.emptyBase !== true;
			this._reader = dependencies.reader;
			this._publisher = dependencies.publisher;
			this._adapter = dependencies.adapter;
			this._pdfContext = options.pdfContext === undefined ? null : this._pdfCopy( options.pdfContext );
			if ( options.pdfContext !== undefined && ( !this._pdfContext ||
				this._readOnly || this._newSurface || this._pageId === undefined ) ) {
				throw failure( 'layers-invalid-editor-session' );
			}
			this._pdf = null;
			this._pdfRecovery = null;
			this._phase = 'unloaded';
			this._snapshot = null;
			this._savedJson = null;
			this._reconciling = false;
		}

		/** @return {Promise<Object>} Initial editor state; never refreshes over a draft */
		async load() {
			if ( this._phase !== 'unloaded' ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._phase = 'loading';
			try {
				// A revision without drawings has no document to read; the new drawing is its first.
				const bundle = this._baseHasDrawings ? await this._reader.read( {
					owner: this._owner, revisionId: this._revisionId
				} ) : { revisionId: this._revisionId, snapshot: { schemaVersion: 1, surfaces: [] } };
				if ( this._phase === 'disposed' ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				if ( bundle.revisionId !== this._revisionId ) {
					throw failure( 'layers-invalid-read-response' );
				}
				let snapshot = bundle.snapshot;
				let saved = null;
				if ( this._newSurface ) {
					if ( !snapshot || !Array.isArray( snapshot.surfaces ) || snapshot.surfaces.some( ( surface ) =>
						newSurfaceCollides( surface, this._newSurface ) ) ) {
						throw failure( 'layers-editor-session-unavailable' );
					}
					// The page does not have this drawing until a save adds it, so it starts out unsaved.
					saved = snapshot;
					snapshot = Object.assign( {}, snapshot, { surfaces: snapshot.surfaces.concat( [ this._newSurface ] ) } );
				}
				const state = this._adapter.toEditorState( snapshot, this._surfaceId );
				this._snapshot = this._adapter.withEditorState( snapshot, this._surfaceId, state );
				this._savedJson = JSON.stringify( saved || this._snapshot );
				if ( this._pdfContext !== null ) {
					const context = this._pdfAdmit( this._pdfContext );
					if ( !context.stored || context.page !== context.initialPage || context.surface.id !== this._surfaceId ) {
						throw failure( 'layers-editor-session-unavailable' );
					}
					this._pdf = { pageCount: context.pageCount, initialPage: context.initialPage,
						activeSurfaceId: this._surfaceId, page: context.page,
						original: this._pdfPin( context.surface ), temporary: new Map(), admissions: new Map() };
				}
				this._phase = 'ready';
				return state;
			} catch ( error ) {
				if ( this._phase !== 'disposed' ) {
					this._phase = 'unloaded';
					if ( this._pdfContext !== null ) {
						this._snapshot = null;
						this._savedJson = null;
						this._pdf = null;
					}
				}
				throw error;
			}
		}

		/** @return {Promise<void>} Recheck revision visibility/source access before applying local recovery */
		async revalidate() {
			this._requireLoaded();
			if ( this._phase !== 'ready' || this._reconciling ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			if ( !this._baseHasDrawings ) {
				return;
			}
			const bundle = await this._reader.read( { owner: this._owner, revisionId: this._revisionId } );
			this._requireLoaded();
			if ( this._phase !== 'ready' || bundle.revisionId !== this._revisionId ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
		}

		/** @return {Object} Isolated copy for rendering */
		getEditorState() {
			this._requireLoaded();
			if ( this._pdf ) {
				return this._adapter.toEditorState( this._pdfView(), this._pdf.activeSurfaceId );
			}
			return this._adapter.toEditorState( this._snapshot, this._surfaceId );
		}

		/**
		 * Accept edits even while saving or resolving a conflict; never overwrite them on completion.
		 * @param {Object} state Exact canvas/layers pair
		 */
		update( state ) {
			this._requireLoaded();
			if ( this._readOnly ) {
				throw failure( 'layers-editor-read-only' );
			}
			if ( this._pdf ) {
				const next = this._adapter.withEditorState( this._pdfView(), this._pdf.activeSurfaceId, state );
				const blank = this._pdfBlank( this._pdf.activeSurfaceId );
				if ( blank && !JSON.parse( this._savedJson ).surfaces.some( ( surface ) => surface.id === blank.id ) &&
					comparable( next.surfaces.find( ( surface ) => surface.id === blank.id ) ) === comparable( blank ) ) {
					next.surfaces = next.surfaces.filter( ( surface ) => surface.id !== blank.id );
				}
				this._snapshot = next;
				return;
			}
			this._snapshot = this._adapter.withEditorState( this._snapshot, this._surfaceId, state );
		}

		/** @return {string} The drawing's name, including a rename not yet saved */
		getLabel() {
			this._requireLoaded();
			const label = this._selected( this._snapshot ).label;
			return typeof label === 'string' ? label : '';
		}

		/**
		 * Rename the drawing as part of the current edits; the next save publishes it.
		 * @param {string} name Proposed name
		 * @return {string} The name as it will be saved, with spacing tidied
		 */
		rename( name ) {
			this._requireLoaded();
			if ( this._pdfRecovery ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			if ( this._readOnly ) {
				throw failure( 'layers-editor-read-only' );
			}
			const label = typeof name === 'string' ? normalizeName( name ) : null;
			if ( label === null ) {
				throw failure( 'layers-page-drawing-rename-invalid' );
			}
			// The page's embed names the new drawing; renaming it before its first save would lose that link.
			if ( this.isUnsavedNew() ) {
				throw failure( 'layers-page-drawing-rename-new' );
			}
			const selected = this._selected( this._snapshot );
			const members = setMembers( this._snapshot, selected );
			const ids = new Set( members.map( ( surface ) => surface.id ) );
			if ( this._snapshot.surfaces.some( ( surface ) => !ids.has( surface.id ) && sameScope( surface, selected ) &&
				nameKey( labelOf( surface ) ) === nameKey( label ) ) ) {
				throw failure( 'layers-page-drawing-rename-taken' );
			}
			members.forEach( ( surface ) => { surface.label = label; } );
			return label;
		}

		/** @return {boolean} The drawing exists only in this editor; no save has added it to the page yet */
		isUnsavedNew() {
			this._requireLoaded();
			return !this._selected( JSON.parse( this._savedJson ) );
		}

		/** @param {Object} snapshot @return {Object} This session's surface @private */
		_selected( snapshot ) {
			return snapshot.surfaces.find( ( surface ) => surface.id === this._surfaceId );
		}

		/** @return {Object} Draft envelope; returned objects share no mutable references */
		getDraft() {
			this._requireLoaded();
			if ( this._pdf ) {
				const baseIds = new Set( JSON.parse( this._savedJson ).surfaces.map( surface => surface.id ) );
				const admissions = Array.from( this._pdf.admissions.values() ).filter( record =>
					record.revisionId < this._revisionId && !baseIds.has( record.surface.id ) &&
					this._snapshot.surfaces.some( surface => surface.id === record.surface.id ) &&
					this._pdfNativeId( record ) === record.surface.id );
				return this._pdfCopy( { owner: this._owner, baseRevisionId: this._revisionId,
					surfaceId: this._surfaceId, snapshot: this._snapshot, pdf: {
						...( admissions.length ? { admissions } : {} ),
						version: 1, pageId: this._pageId, binding: 'v1:' + this._pageId + ':' + this._surfaceId,
						initialPage: this._pdf.initialPage, pageCount: this._pdf.pageCount,
						activePage: this._pdf.page, original: this._pdf.original,
						baseSnapshot: JSON.parse( this._savedJson )
					} } );
			}
			return {
				owner: this._owner,
				baseRevisionId: this._revisionId,
				surfaceId: this._surfaceId,
				snapshot: this._adapter.withEditorState( this._snapshot, this._surfaceId, this.getEditorState() )
			};
		}

		_pdfCopy( value ) {
			return this._adapter.toEditorState( { schemaVersion: 1, surfaces: [ {
				id: 'json-copy', kind: 'slide', canvas: { value }, layers: []
			} ] }, 'json-copy' ).canvas.value;
		}

		_pdfPin( surface ) {
			const pin = Object.assign( {}, surface.source );
			delete pin.page;
			return pin;
		}

		_pdfGroup( snapshot, anchor, count ) {
			const members = snapshot.surfaces.filter( ( surface ) => sameSet( surface, anchor ) );
			const pages = new Set();
			for ( const member of members ) {
				if ( member.kind !== 'pdf' || !Number.isInteger( member.source.page ) ||
					member.source.page < 1 || member.source.page > count || pages.has( member.source.page ) ||
					member.label !== anchor.label ||
					comparable( this._pdfPin( member ) ) !== comparable( this._pdfPin( anchor ) ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				pages.add( member.source.page );
			}
			return members;
		}

		_pdfAdmit( input ) {
			const context = this._pdfCopy( input );
			const base = JSON.parse( this._savedJson );
			const anchor = this._selected( base );
			if ( !context || !anchor || anchor.kind !== 'pdf' || context.kind !== 'pdf' ||
				context.owner !== this._owner || context.pageId !== this._pageId ||
				context.revisionId !== this._revisionId || context.binding !== 'v1:' + this._pageId + ':' + this._surfaceId ||
				context.initialPage !== anchor.source.page || context.label !== anchor.label ||
				!Number.isInteger( context.pageCount ) || context.pageCount < 1 || context.pageCount > 2147483647 ||
				!Number.isInteger( context.page ) || context.page < 1 || context.page > context.pageCount ||
				( this._pdf && ( context.pageCount !== this._pdf.pageCount ||
					comparable( this._pdfPin( anchor ) ) !== comparable( this._pdf.original ) ) ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const group = this._pdfGroup( base, anchor, context.pageCount );
			const inventory = group.slice().sort( ( left, right ) => left.source.page - right.source.page )
				.map( ( surface ) => ( { page: surface.source.page, surfaceId: surface.id } ) );
			const stored = group.find( ( surface ) => surface.source.page === context.page );
			const surface = context.surface;
			const geometry = context.sourceGeometry;
			const rendition = context.rendition;
			if ( comparable( context.members ) !== comparable( inventory ) || !surface || surface.kind !== 'pdf' ||
				!sameSet( surface, anchor ) || surface.label !== anchor.label || surface.source.page !== context.page ||
				comparable( this._pdfPin( surface ) ) !== comparable( this._pdfPin( anchor ) ) ||
				context.stored !== Boolean( stored ) || ( stored && comparable( surface ) !== comparable( stored ) ) ||
				( !stored && ( !isNewSurface( surface, surface.id ) || base.surfaces.some( ( member ) =>
					member.id === surface.id ) ) ) || !geometry || geometry.page !== context.page ||
				geometry.units !== 'file-handler-pixels' || !Number.isInteger( geometry.width ) || geometry.width < 1 ||
				!Number.isInteger( geometry.height ) || geometry.height < 1 || !rendition ||
				typeof rendition.url !== 'string' || !rendition.url || !Number.isInteger( rendition.width ) ||
				rendition.width < 1 || !Number.isInteger( rendition.height ) || rendition.height < 1 ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._adapter.toEditorState( { schemaVersion: 1, surfaces: [ surface ] }, surface.id );
			if ( this._pdf && !stored ) {
				for ( const temporary of this._pdf.temporary.values() ) {
					if ( temporary.source.page === context.page || temporary.id === surface.id ) {
						const record = this._pdf.admissions.get( temporary.id );
						if ( !record || temporary.source.page !== context.page ||
							( record.revisionId === this._revisionId ? comparable( temporary ) !== comparable( surface ) :
								!this._pdfAssociation( record, context ) ) ) {
							throw failure( 'layers-editor-session-unavailable' );
						}
					}
				}
			}
			return context;
		}

		_pdfBlank( id ) {
			const blank = this._pdf.temporary.get( id );
			return blank ? Object.assign( {}, this._pdfCopy( blank ), { label: this.getLabel() } ) : null;
		}

		_pdfView() {
			if ( this._snapshot.surfaces.some( ( surface ) => surface.id === this._pdf.activeSurfaceId ) ) {
				return this._snapshot;
			}
			const blank = this._pdfBlank( this._pdf.activeSurfaceId );
			if ( !blank ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			return Object.assign( {}, this._snapshot, { surfaces: this._snapshot.surfaces.concat( [ blank ] ) } );
		}

		_pdfReady() {
			this._requireLoaded();
			if ( !this._pdf || this._phase !== 'ready' || this._reconciling || this._pdfRecovery ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
		}

		getPdfStatus() {
			return this._pdf ? { page: this._pdf.page, pageCount: this._pdf.pageCount,
				initialPage: this._pdf.initialPage, anchorSurfaceId: this._surfaceId,
				activeSurfaceId: this._pdf.activeSurfaceId } : null;
		}

		selectPdfPage( context ) {
			this._pdfReady();
			const admitted = this._pdfAdmit( context );
			let selectedId = admitted.surface.id;
			if ( !admitted.stored ) {
				const retained = this._snapshot.surfaces.find( surface => surface.kind === 'pdf' &&
					sameSet( surface, this._selected( this._snapshot ) ) && surface.source.page === admitted.page );
				if ( retained ) {
					selectedId = retained.id;
				} else {
					for ( const [ id, temporary ] of this._pdf.temporary ) {
						if ( temporary.source.page === admitted.page ) {
							this._pdf.temporary.delete( id );
							this._pdf.admissions.delete( id );
						}
					}
					this._pdf.temporary.set( selectedId, admitted.surface );
					this._pdf.admissions.set( selectedId, { revisionId: this._revisionId, surface: admitted.surface } );
				}
			}
			this._pdf.activeSurfaceId = selectedId;
			this._pdf.page = admitted.page;
			return this.getEditorState();
		}

		_pdfNativeId( record ) {
			const helper = typeof module !== 'undefined' && module.exports ?
				require( './PageOwnedPdfWorkingSet.js' ) : window.Layers.Editor.PageOwnedPdfWorkingSet;
			return helper.surfaceId( this._pageId, record.revisionId, record.surface.source.fileTitle,
				record.surface.label, record.surface.source.page );
		}

		_pdfOriginShape( record, context ) {
			if ( !record || comparable( Object.keys( record ).sort() ) !== comparable( [ 'revisionId', 'surface' ] ) ||
				!Number.isInteger( record.revisionId ) || record.revisionId < 1 || record.revisionId >= this._revisionId ||
				!record.surface || !isNewSurface( record.surface, record.surface.id ) || record.surface.kind !== 'pdf' ) {
				return false;
			}
			const equivalent = surface => Object.assign( {}, surface, { id: context.surface.id, label: context.label } );
			return comparable( equivalent( record.surface ) ) === comparable( context.surface );
		}

		_pdfAssociation( record, context ) {
			if ( !this._pdfOriginShape( record, context ) ) {
				return false;
			}
			return ( this._pdfNativeId( record ) === record.surface.id ?
				this._pdfNativeId( { revisionId: this._revisionId, surface: context.surface } ) === context.surface.id :
				record.surface.id === context.surface.id );
		}

		_pdfFixed( surface ) {
			const fixed = this._pdfCopy( surface );
			delete fixed.canvas;
			delete fixed.layers;
			delete fixed.label;
			return fixed;
		}

		restorePdfDraft( input, preparedPages ) {
			this._pdfReady();
			const plan = this._pdfRestorePlan( input, preparedPages );
			if ( plan.records.length ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._snapshot = plan.snapshot;
			this._pdf.temporary = plan.temporary;
			this._pdf.admissions = plan.admissions;
			return this.getEditorState();
		}

		_pdfRestorePlan( input, preparedPages ) {
			const draft = this._pdfCopy( input );
			preparedPages = this._pdfCopy( preparedPages );
			const expected = this.getDraft();
			const draftPdf = Object.assign( {}, draft && draft.pdf, { activePage: expected.pdf.activePage } );
			const expectedPdf = Object.assign( {}, expected.pdf );
			delete draftPdf.admissions;
			delete expectedPdf.admissions;
			if ( !draft || !draft.pdf || draft.owner !== expected.owner ||
				draft.surfaceId !== expected.surfaceId || draft.baseRevisionId !== expected.baseRevisionId ||
				!Number.isInteger( draft.pdf.activePage ) || draft.pdf.activePage < 1 ||
				draft.pdf.activePage > this._pdf.pageCount || !Array.isArray( preparedPages ) ||
				comparable( draftPdf ) !== comparable( expectedPdf ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const next = draft.snapshot;
			this._adapter.toEditorState( next, this._surfaceId );
			const base = JSON.parse( this._savedJson );
			const root = snapshot => {
				const result = Object.assign( {}, snapshot );
				delete result.surfaces;
				return result;
			};
			if ( comparable( root( next ) ) !== comparable( root( base ) ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const anchor = this._selected( base );
			const group = this._pdfGroup( base, anchor, this._pdf.pageCount );
			const ids = new Set( group.map( surface => surface.id ) );
			const nextById = new Map( next.surfaces.map( surface => [ surface.id, surface ] ) );
			for ( const member of base.surfaces ) {
				const local = nextById.get( member.id );
				if ( !local || comparable( ids.has( member.id ) ? this._pdfFixed( local ) : local ) !==
					comparable( ids.has( member.id ) ? this._pdfFixed( member ) : member ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
			}
			const temporary = new Map( this._pdf.temporary );
			const admissions = new Map( this._pdf.admissions );
			const provenance = draft.pdf.admissions === undefined ? [] : draft.pdf.admissions;
			if ( !Array.isArray( provenance ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const recordById = new Map();
			for ( const record of provenance ) {
				if ( !record || !record.surface || recordById.has( record.surface.id ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				recordById.set( record.surface.id, record );
			}
			const admittedById = new Map();
			const pages = new Set();
			const preparedIds = new Set();
			for ( const inputPage of preparedPages ) {
				const admitted = this._pdfAdmit( inputPage );
				if ( pages.has( admitted.page ) || preparedIds.has( admitted.surface.id ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				pages.add( admitted.page );
				preparedIds.add( admitted.surface.id );
				admittedById.set( admitted.page, admitted );
			}
			const baseIds = new Set( base.surfaces.map( surface => surface.id ) );
			for ( const member of next.surfaces.filter( surface => !baseIds.has( surface.id ) ) ) {
				const admitted = member.source && admittedById.get( member.source.page );
				const record = recordById.get( member.id );
				const blank = record ? record.surface : admitted && admitted.surface;
				if ( !admitted || admitted.stored || !sameSet( member, this._selected( next ) ) ||
					member.label !== this._selected( next ).label || ( record ?
						!this._pdfOriginShape( record, admitted ) ||
							this._pdfNativeId( { revisionId: this._revisionId, surface: admitted.surface } ) !== admitted.surface.id :
						member.id !== admitted.surface.id ) || comparable( this._pdfFixed( member ) ) !==
					comparable( this._pdfFixed( blank ) ) ||
					comparable( { canvas: member.canvas, layers: member.layers } ) ===
					comparable( { canvas: blank.canvas, layers: blank.layers } ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				temporary.set( member.id, blank );
				admissions.set( member.id, record || { revisionId: this._revisionId, surface: blank } );
				recordById.delete( member.id );
			}
			if ( recordById.size ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const localAnchor = this._selected( next );
			const restored = this._pdfGroup( next, localAnchor, this._pdf.pageCount );
			const restoredIds = new Set( restored.map( surface => surface.id ) );
			if ( restored.some( member => baseIds.has( member.id ) && !ids.has( member.id ) ) ||
				normalizeName( localAnchor.label ) !== localAnchor.label || next.surfaces.some( surface =>
				!restoredIds.has( surface.id ) && sameSet( surface, localAnchor ) ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			return { snapshot: next, temporary, admissions, records: provenance };
		}

		preparePdfDraftWithHistory( input, preparedPages ) {
			try {
				return this._preparePdfDraftWithHistory( input, preparedPages );
			} catch ( error ) {
				return Promise.reject( error );
			}
		}

		_preparePdfDraftWithHistory( input, preparedPages ) {
			this._pdfReady();
			const plan = this._pdfRestorePlan( input, preparedPages );
			const handle = Object.freeze( Object.create( null ) );
			const operation = { revisionId: this._revisionId, base: this._savedJson,
				snapshot: this._snapshot, pdf: this._pdf, selection: comparable( this.getPdfStatus() ),
				work: this._pdfRecoveryWitness(), session: this, plan, ready: false };
			const activeId = this._pdf.activeSurfaceId;
			const view = plan.snapshot.surfaces.some( surface => surface.id === activeId ) ? plan.snapshot :
				Object.assign( {}, plan.snapshot, { surfaces: plan.snapshot.surfaces.concat( [
					Object.assign( {}, plan.temporary.get( activeId ), { label: this._selected( plan.snapshot ).label } )
				] ) } );
			operation.state = this._adapter.toEditorState( view, activeId );
			preparedPdfDrafts.set( handle, operation );
			this._pdfRecovery = handle;
			const preparation = ( async () => {
			try {
				const histories = new Map();
				for ( const record of plan.records ) {
					if ( !histories.has( record.revisionId ) ) {
						const bundle = await this._reader.read( { owner: this._owner, revisionId: record.revisionId } );
						this._checkPreparedPdfDraft( handle );
						if ( !bundle || bundle.revisionId !== record.revisionId ) {
							throw failure( 'layers-invalid-read-response' );
						}
						const historical = this._pdfCopy( bundle.snapshot );
						this._adapter.toEditorState( historical, this._surfaceId );
						histories.set( record.revisionId, historical );
					}
					this._pdfHistoricalOrigin( record, histories.get( record.revisionId ) );
				}
				const current = await this._reader.read( { owner: this._owner, revisionId: operation.revisionId } );
				if ( !current || current.revisionId !== operation.revisionId ||
					comparable( this._pdfCopy( current.snapshot ) ) !== comparable( JSON.parse( operation.base ) ) ) {
					throw failure( 'layers-invalid-read-response' );
				}
				await Promise.resolve();
				this._checkPreparedPdfDraft( handle );
				operation.ready = true;
				return handle;
			} catch ( error ) {
				this.cancelPreparedPdfDraft( handle );
				throw error;
			}
			} )();
			operation.preparation = preparation;
			pendingPdfDrafts.set( preparation, handle );
			return preparation;
		}

		_pdfRecoveryWitness() {
			return comparable( { draft: this.getDraft(), selection: this.getPdfStatus(),
				temporary: Array.from( this._pdf.temporary ), admissions: Array.from( this._pdf.admissions ) } );
		}

		_checkPreparedPdfDraft( handle ) {
			this._requireLoaded();
			const operation = preparedPdfDrafts.get( handle );
			if ( !operation || operation.session !== this || this._pdfRecovery !== handle ||
				this._phase !== 'ready' || this._reconciling || this._readOnly ||
				this._revisionId !== operation.revisionId || this._savedJson !== operation.base ||
				this._snapshot !== operation.snapshot || this._pdf !== operation.pdf ||
				comparable( this.getPdfStatus() ) !== operation.selection || this._pdfRecoveryWitness() !== operation.work ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			return operation;
		}

		commitPreparedPdfDraft( handle ) {
			const operation = this._checkPreparedPdfDraft( handle );
			if ( !operation.ready ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const state = this._pdfCopy( operation.state );
			this.cancelPreparedPdfDraft( handle );
			this._snapshot = operation.plan.snapshot;
			this._pdf.temporary = operation.plan.temporary;
			this._pdf.admissions = operation.plan.admissions;
			return state;
		}

		cancelPreparedPdfDraft( handle ) {
			handle = pendingPdfDrafts.get( handle ) || handle;
			const operation = preparedPdfDrafts.get( handle );
			if ( operation && operation.session === this ) {
				preparedPdfDrafts.delete( handle );
				pendingPdfDrafts.delete( operation.preparation );
				if ( this._pdfRecovery === handle ) {
					this._pdfRecovery = null;
				}
			}
		}

		async restorePdfDraftWithHistory( input, preparedPages ) {
			let handle;
			try {
				handle = await this.preparePdfDraftWithHistory( input, preparedPages );
				return this.commitPreparedPdfDraft( handle );
			} finally {
				this.cancelPreparedPdfDraft( handle );
			}
		}

		_pdfHistoricalOrigin( record, snapshot ) {
			const anchor = this._selected( snapshot );
			if ( !anchor || anchor.kind !== 'pdf' || !anchor.source || anchor.source.page !== this._pdf.initialPage ||
				comparable( this._pdfPin( anchor ) ) !== comparable( this._pdf.original ) ||
				anchor.label !== record.surface.label || this._pdfGroup( snapshot, anchor, this._pdf.pageCount )
					.some( member => member.source.page === record.surface.source.page ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const actual = { revisionId: record.revisionId, surface: Object.assign( {}, record.surface, {
				label: anchor.label, source: Object.assign( {}, anchor.source, { page: record.surface.source.page } )
			} ) };
			if ( this._pdfNativeId( actual ) !== record.surface.id ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
		}

		_pdfReconcile( input, revisionId ) {
			const server = this._pdfCopy( input );
			this._adapter.toEditorState( server, this._surfaceId );
			const base = JSON.parse( this._savedJson );
			const baseAnchor = this._selected( base );
			const localAnchor = this._selected( this._snapshot );
			const remoteAnchor = this._selected( server );
			if ( remoteAnchor.kind !== 'pdf' || remoteAnchor.source.page !== this._pdf.initialPage ||
				comparable( this._pdfPin( remoteAnchor ) ) !== comparable( this._pdf.original ) ) {
				throw failure( 'layers-editor-reconciliation-required' );
			}
			const baseGroup = this._pdfGroup( base, baseAnchor, this._pdf.pageCount );
			const localGroup = this._pdfGroup( this._snapshot, localAnchor, this._pdf.pageCount );
			const remoteGroup = this._pdfGroup( server, remoteAnchor, this._pdf.pageCount );
			const baseById = new Map( baseGroup.map( member => [ member.id, member ] ) );
			const localById = new Map( localGroup.map( member => [ member.id, member ] ) );
			const remoteById = new Map( server.surfaces.map( member => [ member.id, member ] ) );
			const merged = this._pdfCopy( server );
			for ( const member of baseGroup ) {
				const local = localById.get( member.id );
				const remote = remoteById.get( member.id );
				const dirty = comparable( member ) !== comparable( local );
				if ( !local || ( !remote && ( dirty || member.id === this._pdf.activeSurfaceId ) ) ||
					( remote && ( remote.kind !== 'pdf' || remote.source.page !== member.source.page ||
						comparable( this._pdfPin( remote ) ) !== comparable( this._pdf.original ) ||
						remote.label !== remoteAnchor.label ) ) ||
					( dirty && comparable( remote ) !== comparable( member ) && comparable( remote ) !== comparable( local ) ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
				if ( dirty ) {
					merged.surfaces[ merged.surfaces.findIndex( surface => surface.id === member.id ) ] = this._pdfCopy( local );
				}
			}
			for ( const local of localGroup.filter( member => !baseById.has( member.id ) ) ) {
				const remote = remoteById.get( local.id );
				if ( remote && comparable( remote ) !== comparable( local ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
				if ( !remote ) {
					merged.surfaces.push( this._pdfCopy( local ) );
				}
			}
			const label = localAnchor.label !== baseAnchor.label ? localAnchor.label : remoteAnchor.label;
			const ids = new Set( [ ...baseGroup, ...localGroup, ...remoteGroup ].map( member => member.id ) );
			if ( server.surfaces.some( member => !ids.has( member.id ) && sameScope( baseAnchor, member ) &&
				nameKey( labelOf( member ) ) === nameKey( label ) ) ) {
				throw failure( 'layers-editor-reconciliation-required' );
			}
			merged.surfaces.forEach( member => {
				if ( ids.has( member.id ) ) {
					member.label = label;
				}
			} );
			this._adapter.toEditorState( merged, this._surfaceId );
			this._pdfGroup( merged, this._selected( merged ), this._pdf.pageCount );
			const active = merged.surfaces.find( member => member.id === this._pdf.activeSurfaceId );
			if ( !active && remoteGroup.some( member => member.source.page === this._pdf.page ) ) {
				throw failure( 'layers-editor-reconciliation-required' );
			}
			this._snapshot = merged;
			this._savedJson = JSON.stringify( server );
			this._revisionId = revisionId;
			this._phase = 'ready';
			return this.getStatus();
		}

		/** @return {Object} UI state; conflict/uncertain requires explicit reconciliation */
		getStatus() {
			return {
				phase: this._phase,
				revisionId: this._revisionId,
				readOnly: this._readOnly,
				dirty: this._snapshot !== null && comparable( this._snapshot ) !== comparable( JSON.parse( this._savedJson ) )
			};
		}

		/**
		 * @param {string} summary Page-history edit summary
		 * @param {Function} [beforePublish] Persist the saving-phase draft before any POST
		 * @return {Promise<Object>} Confirmed revision and current dirty state
		 */
		async save( summary = '', beforePublish ) {
			if ( workingCopyProvenance.has( this ) ) { return this.saveWorkingCopyImportProvenance( summary, beforePublish ); }
			this._requireLoaded();
			if ( this._readOnly ) {
				throw failure( 'layers-editor-read-only' );
			}
			if ( this._phase !== 'ready' || this._reconciling || this._pdfRecovery ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			if ( typeof summary !== 'string' || ( beforePublish !== undefined && typeof beforePublish !== 'function' ) ) {
				throw failure( 'layers-invalid-publication-request' );
			}
			const snapshotJson = JSON.stringify( this._snapshot );
			this._phase = 'saving';
			try {
				if ( beforePublish ) {
					try {
						await beforePublish();
					} catch ( error ) {
						throw failure( 'layers-draft-storage-failed' );
					}
					if ( this._phase === 'disposed' ) {
						throw failure( 'layers-editor-session-unavailable' );
					}
				}
				const request = {
					owner: this._owner, baseRevisionId: this._revisionId, snapshotJson, summary
				};
				if ( this._pageId !== undefined ) {
					request.pageId = this._pageId;
				}
				const result = await this._publisher.publish( request );
				if ( this._phase === 'disposed' ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				if ( !result || !Number.isInteger( result.revisionId ) ||
					result.revisionId < this._revisionId || result.revisionId > 2147483647 ) {
					throw failure( 'layers-publication-outcome-unknown' );
				}
				this._revisionId = result.revisionId;
				this._savedJson = snapshotJson;
				this._baseHasDrawings = true;
				this._phase = 'ready';
				return this.getStatus();
			} catch ( error ) {
				const safeError = error && typeof error.code === 'string' ? error :
					failure( 'layers-publication-outcome-unknown' );
				if ( this._phase !== 'disposed' ) {
					this._phase = safeError.code === 'layers-edit-conflict' ? 'conflict' :
						safeError.code === 'layers-publication-outcome-unknown' ? 'uncertain' : 'ready';
				}
				throw safeError;
			}
		}

		/** Opt-in publication; only a confirmed revision acknowledges pending source citations. */
		async saveWorkingCopyImportProvenance( summary = '', beforePublish ) {
			this._requireLoaded();
			const mode = workingCopyProvenance.get( this );
			if ( !mode || this._readOnly || this._phase !== 'ready' || this._reconciling || this._pdfRecovery ) { throw failure( 'layers-editor-session-unavailable' ); }
			if ( typeof summary !== 'string' || ( beforePublish !== undefined && typeof beforePublish !== 'function' ) ) { throw failure( 'layers-invalid-publication-request' ); }
			const snapshotJson = JSON.stringify( this._snapshot ), captured = JSON.parse( snapshotJson );
			const selected = captured.surfaces.find( s => s.id === this._surfaceId ), saved = JSON.parse( this._savedJson ).surfaces.find( s => s.id === this._surfaceId );
			const layerIds = new Set( selected.layers.map( layer => layer.id ) );
			const active = mode.current.filter( claim => claim.layerIds.some( id => layerIds.has( id ) ) ||
				( claim.canvas && !importDataEqual( selected.canvas, saved.canvas ) ) );
			const sources = new Map();
			if ( !importDataEqual( restoreWorkingState( selected ), restoreWorkingState( saved ) ) ) {
				active.forEach( claim => { const descriptor = { sourcePageId: claim.sourcePageId, sourceRevisionId: claim.sourceRevisionId,
					sourceSurfaceId: claim.sourceSurfaceId, targetSurfaceId: claim.targetSurfaceId }; sources.set( JSON.stringify( descriptor ), descriptor ); } );
			}
			const owner = this._owner, pageId = this._pageId, surfaceId = this._surfaceId, baseRevisionId = this._revisionId, baseJson = this._savedJson, current = mode.current;
			const publisher = importMethod( this._publisher, 'publish' ), epoch = mode.epoch;
			this._phase = 'saving';
			try {
				if ( beforePublish ) { try { await beforePublish(); } catch ( error ) { throw failure( 'layers-draft-storage-failed' ); } }
				const check = () => {
					if ( this._phase !== 'saving' || this._revisionId !== baseRevisionId || this._savedJson !== baseJson ||
						this._owner !== owner || this._pageId !== pageId || this._surfaceId !== surfaceId || workingCopyProvenance.get( this ) !== mode || mode.current !== current || mode.epoch !== epoch ||
						this._publisher !== publisher.object ) { throw failure( 'layers-editor-session-unavailable' ); }
					importMethodsExact( [ publisher ] );
				};
				check(); if ( sources.size ) { await provenanceRevalidate( this, active, check ); } check();
				const request = { owner, pageId, baseRevisionId, snapshotJson, summary,
					...( sources.size ? { importSources: Array.from( sources.values() ) } : {} ) };
				const result = await publisher.call( request ); check();
				if ( !result || !Number.isInteger( result.revisionId ) || result.revisionId < baseRevisionId || result.revisionId > 2147483647 ||
					( sources.size && result.revisionId === baseRevisionId ) ) { throw failure( 'layers-publication-outcome-unknown' ); }
				this._revisionId = result.revisionId; this._savedJson = snapshotJson; this._baseHasDrawings = true;
				mode.current = []; mode.epoch++; this._phase = 'ready'; return this.getStatus();
			} catch ( error ) {
				const safe = error && typeof error.code === 'string' ? error : failure( 'layers-publication-outcome-unknown' );
				if ( this._phase !== 'disposed' ) { this._phase = safe.code === 'layers-edit-conflict' ? 'conflict' : safe.code === 'layers-publication-outcome-unknown' ? 'uncertain' : 'ready'; }
				throw safe;
			}
		}

		/**
		 * Reconcile with an explicitly selected server revision without publishing or dropping local edits.
		 * @param {number} revisionId Authorized revision to compare
		 * @return {Promise<Object>}
		 */
		async reconcile( revisionId ) {
			this._requireLoaded();
			if ( this._readOnly || this._reconciling || this._pdfRecovery ||
				![ 'ready', 'conflict', 'uncertain' ].includes( this._phase ) ||
				!Number.isInteger( revisionId ) || revisionId < this._revisionId || revisionId > 2147483647 ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._reconciling = true;
			try {
				const bundle = await this._reader.read( { owner: this._owner, revisionId } );
				this._requireLoaded();
				if ( bundle.revisionId !== revisionId ) {
					throw failure( 'layers-invalid-read-response' );
				}
				if ( this._pdf ) {
					return this._pdfReconcile( bundle.snapshot, revisionId );
				}
				if ( !bundle.snapshot.surfaces.some( ( surface ) => surface.id === this._surfaceId ) ) {
					return this._reconcileUnsavedNew( bundle.snapshot, revisionId );
				}
				const serverState = this._adapter.toEditorState( bundle.snapshot, this._surfaceId );
				const server = this._adapter.withEditorState( bundle.snapshot, this._surfaceId, serverState );
				const base = JSON.parse( this._savedJson );
				const remote = comparable( this._selected( server ) );
				if ( remote !== comparable( this._selected( base ) ) &&
					remote !== comparable( this._selected( this._snapshot ) ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
				// Retain newer sibling content while carrying the selected edits and the complete set's rename.
				const merged = this._adapter.withEditorState( server, this._surfaceId, this.getEditorState() );
				this._selected( merged ).label = this._selected( this._snapshot ).label;
				this._reconcileRename( base, server, merged );
				this._snapshot = merged;
				this._savedJson = JSON.stringify( server );
				this._revisionId = revisionId;
				this._phase = 'ready';
				return this.getStatus();
			} finally {
				this._reconciling = false;
			}
		}

		/**
		 * Carry a pending name across stable group IDs without overwriting another editor's rename.
		 * New PDF pages may join the same set; newer layers/source versions remain server-owned.
		 * @param {Object} base Last confirmed document
		 * @param {Object} server Newer document
		 * @param {Object} merged Candidate with the selected surface's local content
		 * @private
		 */
		_reconcileRename( base, server, merged ) {
			const original = this._selected( base );
			if ( !original ) {
				return;
			}
			const members = setMembers( base, original );
			const label = labelOf( this._selected( this._snapshot ) );
			const localById = new Map( this._snapshot.surfaces.map( ( surface ) => [ surface.id, surface ] ) );
			if ( !members.some( ( member ) => labelOf( localById.get( member.id ) ) !== labelOf( member ) ) ) {
				return;
			}
			const remoteById = new Map( server.surfaces.map( ( surface ) => [ surface.id, surface ] ) );
			const ids = new Set( members.map( ( member ) => member.id ) );
			for ( const member of members ) {
				const remote = remoteById.get( member.id );
				if ( !remote || !sameScope( member, remote ) || member.kind !== remote.kind ||
					( member.kind === 'pdf' && member.source.page !== remote.source.page ) ||
					( labelOf( remote ) !== labelOf( member ) && labelOf( remote ) !== label ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
			}
			const alreadyRenamed = members.every( ( member ) => labelOf( remoteById.get( member.id ) ) === label );
			for ( const remote of server.surfaces ) {
				if ( ids.has( remote.id ) || !sameScope( original, remote ) ) {
					continue;
				}
				const originalName = sameSet( original, remote );
				const targetName = nameKey( labelOf( remote ) ) === nameKey( label );
				if ( original.kind === 'pdf' && remote.kind === 'pdf' &&
					( alreadyRenamed ? targetName : originalName ) ) {
					ids.add( remote.id );
				} else if ( targetName ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
			}
			merged.surfaces.forEach( ( surface ) => {
				if ( ids.has( surface.id ) ) {
					surface.label = label;
				}
			} );
		}

		/**
		 * The server revision lacks this drawing: fine only if it was never saved and its name is still free.
		 * @param {Object} server Newer revision's document
		 * @param {number} revisionId
		 * @return {Object} Status
		 * @private
		 */
		_reconcileUnsavedNew( server, revisionId ) {
			const local = this._selected( this._snapshot );
			const baseMembers = setMembers( JSON.parse( this._savedJson ), local );
			const remoteById = new Map( server.surfaces.map( ( surface ) => [ surface.id, surface ] ) );
			if ( !this.isUnsavedNew() ||
				server.surfaces.some( ( surface ) => newSurfaceCollides( surface, local ) ) ||
				baseMembers.some( ( member ) => {
					const remote = remoteById.get( member.id );
					return !remote || !sameSet( remote, local ) || labelOf( remote ) !== labelOf( local ) ||
						remote.kind !== member.kind || comparable( remote.source ) !== comparable( member.source );
				} ) ) {
				throw failure( 'layers-editor-reconciliation-required' );
			}
			const merged = Object.assign( {}, server, { surfaces: server.surfaces.concat( [ local ] ) } );
			this._snapshot = this._adapter.withEditorState( merged, this._surfaceId, this.getEditorState() );
			this._savedJson = JSON.stringify( server );
			this._revisionId = revisionId;
			this._baseHasDrawings = true;
			this._phase = 'ready';
			return this.getStatus();
		}

		/** Preserve a recovery hold until the UI explicitly reconciles with server history. */
		blockPublication() {
			this._requireLoaded();
			if ( this._phase !== 'ready' ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._phase = 'uncertain';
		}

		/** Stop late results from changing this session. Export any draft before disposal. */
		dispose() {
			this.cancelPreparedPdfDraft( this._pdfRecovery );
			this._phase = 'disposed';
			this._pdfRecovery = null;
			this._snapshot = null;
			this._savedJson = null;
		}

		/** @private */
		_requireLoaded() {
			if ( this._snapshot === null || this._phase === 'disposed' ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedEditorSession = PageOwnedEditorSession;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedEditorSession;
	}
}() );
