/** Unregistered, read-only whole-PDF Import preparation bound to a live editor session. */
'use strict';

( function () {
	const instances = new WeakMap();
	// Opt-in transaction state never becomes serialized session authority.
	const transactions = new WeakMap(), checkpoints = new WeakMap(), citations = new WeakMap();
	const preparing = new WeakSet(), consumed = new WeakSet();
	const mapSet = Function.call.bind( Map.prototype.set ), mapDelete = Function.call.bind( Map.prototype.delete );
	const weakSet = Function.call.bind( WeakMap.prototype.set ), consume = Function.call.bind( WeakSet.prototype.add );
	const define = Object.defineProperty;
	const own = ( object, key ) => Object.prototype.hasOwnProperty.call( object, key );
	const nameKey = value => value.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
	const sessionMethods = [ '_pdfCopy', '_selected', '_pdfGroup', '_pdfPin', '_pdfAdmit',
		'_pdfNativeId', '_pdfAssociation', '_pdfOriginShape', '_pdfHistoricalOrigin', 'getEditorState', 'getPdfStatus' ];

	function unavailable() {
		const error = new Error( 'layers-working-copy-import-unavailable' );
		error.code = error.message;
		return error;
	}

	function descriptor( object, key ) {
		const value = object && Object.getOwnPropertyDescriptor( object, key );
		if ( !value || !own( value, 'value' ) ) { throw unavailable(); }
		return value;
	}

	function fields( object, keys ) {
		if ( !object || typeof object !== 'object' || Array.isArray( object ) ||
			![ Object.prototype, null ].includes( Object.getPrototypeOf( object ) ) ||
			Reflect.ownKeys( object ).length !== keys.length ) { throw unavailable(); }
		return Object.fromEntries( keys.map( key => {
			const value = descriptor( object, key );
			if ( !value.enumerable ) { throw unavailable(); }
			return [ key, value.value ];
		} ) );
	}

	function method( object, key ) {
		let holder = object;
		while ( holder && !own( holder, key ) ) { holder = Object.getPrototypeOf( holder ); }
		const value = descriptor( holder, key );
		if ( typeof value.value !== 'function' ) { throw unavailable(); }
		return { object, key, holder, descriptor: value };
	}

	function exactDescriptor( left, right ) {
		return left.value === right.value && left.enumerable === right.enumerable &&
			left.writable === right.writable && left.configurable === right.configurable;
	}

	function equal( left, right ) {
		if ( left === right ) { return true; }
		if ( !left || !right || typeof left !== 'object' || typeof right !== 'object' ||
			Array.isArray( left ) !== Array.isArray( right ) ) { return false; }
		const keys = Object.keys( left );
		return keys.length === Object.keys( right ).length && keys.every( key => own( right, key ) && equal( left[ key ], right[ key ] ) );
	}

	function exactMethods( state ) {
		for ( const captured of state.methods ) {
			const current = method( captured.object, captured.key );
			if ( current.holder !== captured.holder || !exactDescriptor( current.descriptor, captured.descriptor ) ) { throw unavailable(); }
		}
		for ( const captured of state.values ) {
			if ( !exactDescriptor( descriptor( captured.object, captured.key ), captured.descriptor ) ) { throw unavailable(); }
		}
	}

	function active( instance ) {
		const state = instances.get( instance );
		if ( !state || !state.active ) { throw unavailable(); }
		exactMethods( state );
		return state;
	}

	function copy( state, value ) {
		return state.copy.call( state.adapter, { schemaVersion: 1, surfaces: [ {
			id: 'pdf-import-session-copy', kind: 'slide', canvas: { value }, layers: []
		} ] }, 'pdf-import-session-copy' ).canvas.value;
	}

	function objectWitness( object ) {
		return { object, keys: Reflect.ownKeys( object ), descriptors: Object.getOwnPropertyDescriptors( object ) };
	}

	function checkObject( witness ) {
		const keys = Reflect.ownKeys( witness.object );
		if ( keys.length !== witness.keys.length || !keys.every( key => witness.keys.includes( key ) ) ) { throw unavailable(); }
		for ( const key of witness.keys ) {
			if ( !exactDescriptor( descriptor( witness.object, key ), witness.descriptors[ key ] ) ) { throw unavailable(); }
		}
	}

	function capture( instance, state, external ) {
		const session = state.session;
		if ( external() !== undefined || active( instance ) !== state ) { throw unavailable(); }
		const sessionWitness = objectWitness( session );
		for ( const key of sessionWitness.keys ) { descriptor( session, key ); }
		if ( session._phase !== 'ready' || session._readOnly !== false || session._reconciling !== false || session._pdfRecovery !== null ||
			session._baseHasDrawings !== true || session._newSurface !== null || !session._pdf || !session._snapshot ||
			typeof session._savedJson !== 'string' || !Number.isInteger( session._pageId ) || session._pageId < 1 ) { throw unavailable(); }
		const pdfWitness = objectWitness( session._pdf );
		for ( const witness of [ sessionWitness, pdfWitness ] ) {
			for ( const key of witness.keys ) { descriptor( witness.object, key ); }
		}
		const maps = [ 'temporary', 'admissions' ].map( key => {
			const map = session._pdf[ key ];
			if ( !( map instanceof Map ) || Object.getPrototypeOf( map ) !== Map.prototype || Reflect.ownKeys( map ).length ) { throw unavailable(); }
			const entries = Array.from( Map.prototype.entries.call( map ) );
			return { key, map, entries, data: copy( state, entries ) };
		} );
		const pdfData = Object.fromEntries( pdfWitness.keys.filter( key => ![ 'temporary', 'admissions' ].includes( key ) )
			.map( key => [ key, descriptor( session._pdf, key ).value ] ) );
		const witness = { instance, state, external, sessionWitness, pdfWitness, maps,
			mapMethods: maps.flatMap( value => [ 'entries', 'get', 'values', 'has' ].map( key => method( value.map, key ) ) ),
			pdfData: copy( state, pdfData ), snapshot: copy( state, session._snapshot ),
			context: copy( state, session._pdfContext ), base: copy( state, JSON.parse( session._savedJson ) ) };
		witness.check = () => {
			if ( active( instance ) !== state ) { throw unavailable(); }
			if ( external() !== undefined || active( instance ) !== state ) { throw unavailable(); }
			checkObject( sessionWitness ); checkObject( pdfWitness );
			for ( const captured of witness.mapMethods ) {
				const current = method( captured.object, captured.key );
				if ( current.holder !== captured.holder || !exactDescriptor( current.descriptor, captured.descriptor ) ) { throw unavailable(); }
			}
			if ( !equal( copy( state, session._snapshot ), witness.snapshot ) ||
				!equal( copy( state, session._pdfContext ), witness.context ) ||
				!equal( copy( state, pdfData ), witness.pdfData ) ) { throw unavailable(); }
			for ( const captured of maps ) {
				if ( Reflect.ownKeys( captured.map ).length ) { throw unavailable(); }
				const current = Array.from( Map.prototype.entries.call( captured.map ) );
				if ( current.length !== captured.entries.length || current.some( ( entry, index ) =>
					entry[ 0 ] !== captured.entries[ index ][ 0 ] || entry[ 1 ] !== captured.entries[ index ][ 1 ] ) ||
					!equal( copy( state, current ), captured.data ) ) { throw unavailable(); }
			}
		};
		witness.check();
		return witness;
	}

	function invoke( witness, object, key, ...args ) {
		witness.check();
		const captured = witness.state.methods.find( entry => entry.object === object && entry.key === key );
		if ( !captured ) { throw unavailable(); }
		const result = captured.descriptor.value.call( object, ...args );
		witness.check();
		return result;
	}

	async function invokeAsync( witness, object, key, ...args ) {
		witness.check();
		const captured = witness.state.methods.find( entry => entry.object === object && entry.key === key );
		if ( !captured ) { throw unavailable(); }
		const pending = Promise.resolve( captured.descriptor.value.call( object, ...args ) );
		try { witness.check(); } catch ( error ) { pending.catch( () => {} ); throw error; }
		const result = await pending;
		witness.check();
		return result;
	}

	function selected( snapshot, session ) {
		const anchor = snapshot.surfaces.find( member => member.id === session._surfaceId );
		if ( !anchor || anchor.kind !== 'pdf' ) { throw unavailable(); }
		return snapshot.surfaces.filter( member => member.source &&
			member.source.fileTitle === anchor.source.fileTitle && typeof member.label === 'string' &&
			nameKey( member.label ) === nameKey( anchor.label ) );
	}

	function fixed( surface ) {
		const result = { ...surface };
		for ( const key of [ 'canvas', 'layers', 'readingOrder', 'label' ] ) { delete result[ key ]; }
		return result;
	}

	function nativeContext( data, surface ) {
		return { owner: data.target.owner, pageId: data.target.pageId, revisionId: data.target.revisionId,
			binding: 'v1:' + data.target.pageId + ':' + data.target.surfaceId, kind: 'pdf', label: data.targetGroup.label,
			initialPage: data.targetBundle.snapshot.surfaces.find( member => member.id === data.target.surfaceId ).source.page,
			pageCount: data.targetGroup.pageCount, page: surface.source.page, stored: false, members: data.targetGroup.members,
			surface, sourceGeometry: data.admittedTargetGeometry[ surface.id ], rendition: data.admittedTargetRenditions[ surface.id ] };
	}

	function admit( witness, input ) {
		const session = witness.state.session, context = invoke( witness, session, '_pdfAdmit', input );
		if ( context.stored || invoke( witness, session, '_pdfNativeId', {
			revisionId: session._revisionId, surface: context.surface
		} ) !== context.surface.id ) { throw unavailable(); }
		return context;
	}

	async function admissions( witness, data ) {
		witness.check();
		const state = witness.state, session = state.session, pdf = witness.pdfData;
		if ( data.target.owner !== session._owner || data.targetGroup.pageCount !== pdf.pageCount ||
			!equal( data.targetGroup.source, pdf.original ) ) { throw unavailable(); }
		const baseIds = new Set( witness.base.surfaces.map( member => member.id ) );
		const extras = selected( witness.snapshot, session ).filter( member => !baseIds.has( member.id ) );
		const members = new Map( extras.map( member => [ member.id, member ] ) );
		for ( const [ id, blank ] of witness.maps.find( map => map.key === 'temporary' ).data ) {
			if ( !baseIds.has( id ) && !members.has( id ) ) { members.set( id, blank ); }
		}
		const contexts = new Map(), prepared = [], histories = new Map();
		for ( const surface of data.admittedTargetSurfaces ) {
			const context = admit( witness, nativeContext( data, surface ) );
			contexts.set( context.page, context );
		}
		for ( const member of members.values() ) {
			let context = contexts.get( member.source.page );
			if ( !context ) {
				const response = await invokeAsync( witness, state.pageReader, 'read', { owner: session._owner, revisionId: session._revisionId,
					binding: 'v1:' + session._pageId + ':' + session._surfaceId, page: member.source.page } );
				witness.check();
				context = admit( witness, copy( state, response ) );
				contexts.set( context.page, context );
			}
			const blank = session._pdf.temporary.get( member.id ), raw = session._pdf.admissions.get( member.id );
			const origin = fields( copy( state, raw ), [ 'revisionId', 'surface' ] );
			if ( !blank || !Number.isInteger( origin.revisionId ) || origin.revisionId < 1 || origin.revisionId > session._revisionId ||
				!equal( origin.surface, blank ) || !equal( fixed( member ), fixed( blank ) ) ||
				invoke( witness, session, '_pdfNativeId', origin ) !== member.id ) { throw unavailable(); }
			if ( origin.revisionId === session._revisionId ) {
				if ( !equal( origin.surface, context.surface ) ) { throw unavailable(); }
			} else {
				if ( !invoke( witness, session, '_pdfAssociation', origin, context ) ) { throw unavailable(); }
				if ( !histories.has( origin.revisionId ) ) {
					const response = await invokeAsync( witness, session._reader, 'read', { owner: session._owner, revisionId: origin.revisionId } );
					witness.check();
					const bundle = copy( state, response );
					if ( bundle.revisionId !== origin.revisionId ) { throw unavailable(); }
					histories.set( origin.revisionId, bundle.snapshot );
				}
				invoke( witness, session, '_pdfHistoricalOrigin', origin, histories.get( origin.revisionId ) );
			}
			prepared.push( { surfaceId: member.id, page: context.page, context, origin } );
		}
		for ( const context of contexts.values() ) {
			if ( !prepared.some( member => member.page === context.page ) ) {
				prepared.push( { surfaceId: context.surface.id, page: context.page, context,
					origin: { revisionId: session._revisionId, surface: context.surface } } );
			}
		}
		witness.check();
		return { allowed: extras.map( member => member.id ), prepared: copy( state, prepared.sort( ( left, right ) => left.page - right.page ) ) };
	}

	function recordFor( instance, handle ) {
		const state = active( instance ), record = state.handles.get( handle );
		if ( !record ) { throw unavailable(); }
		record.witness.check();
		invoke( record.witness, state.source, 'inspect', record.native );
		if ( state.handles.get( handle ) !== record ) { throw unavailable(); }
		return { state, record };
	}

	function scopeOf( state ) {
		const session = state.session;
		return copy( state, { owner: session._owner, pageId: session._pageId, baseRevisionId: session._revisionId,
			surfaceId: session._surfaceId, savedJson: session._savedJson, original: session._pdf.original,
			pageCount: session._pdf.pageCount, initialPage: session._pdf.initialPage } );
	}

	function claimsFor( state, scope ) {
		const claims = citations.get( state.session );
		if ( claims && !equal( claims.scope, scope ) ) { throw unavailable(); }
		return claims;
	}

	function originsFor( state, snapshot, admissionsMap ) {
		const session = state.session, base = JSON.parse( session._savedJson );
		const ids = new Set( base.surfaces.map( member => member.id ) ), result = [];
		for ( const surface of selected( snapshot, session ) ) {
			if ( ids.has( surface.id ) ) { continue; }
			const origin = admissionsMap.get( surface.id );
			if ( !origin || !Number.isInteger( origin.revisionId ) || origin.revisionId < 1 ||
				origin.revisionId > session._revisionId || !equal( fixed( surface ), fixed( origin.surface ) ) ||
				state.methods.find( entry => entry.object === session && entry.key === '_pdfNativeId' )
					.descriptor.value.call( session, origin ) !== surface.id ) { throw unavailable(); }
			if ( origin.revisionId !== session._revisionId ) { result.push( { surfaceId: surface.id, revisionId: origin.revisionId } ); }
		}
		return result.sort( ( left, right ) => left.surfaceId.localeCompare( right.surfaceId ) );
	}

	function writableSlot( object, key ) {
		const value = descriptor( object, key );
		if ( !value.writable ) { throw unavailable(); }
		return value;
	}

	function transactionMethods( instance ) {
		return [ 'prepareImportCommit', 'inspectImportCommit', 'commitPreparedImport', 'releaseImportCommit',
			'inspectImportCheckpoint', 'releaseImportCheckpoint', 'getImportPublication', 'revalidate' ]
			.map( key => method( instance, key ) );
	}

	function checkTransaction( instance, handle ) {
		const { state } = recordFor( instance, handle.source );
		if ( consumed.has( handle.source ) || claimsFor( state, handle.scope ) !== handle.claims ) { throw unavailable(); }
		for ( const captured of handle.methods ) {
			const current = method( captured.object, captured.key );
			if ( current.holder !== captured.holder || !exactDescriptor( current.descriptor, captured.descriptor ) ) { throw unavailable(); }
		}
		for ( const slot of handle.slots ) {
			if ( !exactDescriptor( writableSlot( slot.object, slot.key ), slot.descriptor ) ) { throw unavailable(); }
		}
		return state;
	}

	function commitRecord( instance, token ) {
		const store = transactions.get( instance ), handle = store && store.get( token );
		if ( !handle ) { throw unavailable(); }
		return { state: checkTransaction( instance, handle ), handle, store };
	}

	class PageOwnedWholePdfImportSession {
		constructor( session, source, pageReader ) {
			try {
				const editor = typeof window !== 'undefined' && window.Layers && window.Layers.Editor;
				const load = ( key, file ) => editor && editor[ key ] || module.require( file );
				const Session = load( 'PageOwnedEditorSession', './PageOwnedEditorSession.js' );
				const Source = load( 'PageOwnedWholePdfImportSource', './PageOwnedWholePdfImportSource.js' );
				const PdfReader = load( 'PageOwnedPdfEditorReadClient', './PageOwnedPdfEditorReadClient.js' );
				if ( !( session instanceof Session ) || !( source instanceof Source ) || !( pageReader instanceof PdfReader ) ) { throw unavailable(); }
				const adapter = descriptor( session, '_adapter' ).value;
				const methods = [ ...sessionMethods.map( key => method( session, key ) ),
					...[ 'prepare', 'prepareForSession', 'inspect', 'getReadEvidence', 'revalidate', 'release' ].map( key => method( source, key ) ),
					method( pageReader, 'read' ), method( session._reader, 'read' ), method( session._publisher, 'publish' ),
					method( adapter, 'toEditorState' ), method( adapter, 'withEditorState' ) ];
				const values = [ [ session, '_reader' ], [ session, '_adapter' ] ];
				for ( const reader of [ session._reader, pageReader ] ) {
					const api = descriptor( reader, 'api' ).value;
					values.push( [ reader, 'api' ] ); methods.push( method( api, 'get' ) );
				}
				instances.set( this, { active: true, session, source, pageReader, adapter, methods,
					copy: method( adapter, 'toEditorState' ).descriptor.value,
					values: values.map( ( [ object, key ] ) => ( { object, key, descriptor: descriptor( object, key ) } ) ), handles: new Map() } );
			} catch ( error ) { throw unavailable(); }
		}

		/** Separately invoked complete-session transaction; no editor/Undo/draft integration. */
		async prepareImportCommit( sourceHandle ) {
			if ( sourceHandle === null ) { return null; }
			let acquired = false;
			try {
				const { state, record } = recordFor( this, sourceHandle ), methods = transactionMethods( this );
				if ( preparing.has( sourceHandle ) || consumed.has( sourceHandle ) ) { throw unavailable(); }
				preparing.add( sourceHandle ); acquired = true;
				await methods.find( entry => entry.key === 'revalidate' ).descriptor.value.call( this, sourceHandle );
				recordFor( this, sourceHandle );
				const session = state.session, scope = scopeOf( state ), claims = claimsFor( state, scope );
				const preview = copy( state, record.preview ), snapshot = preview.candidateSnapshot;
				const temporary = new Map( copy( state, Array.from( session._pdf.temporary ) ) );
				const admitted = new Map( copy( state, Array.from( session._pdf.admissions ) ) );
				const baseIds = new Set( record.witness.base.surfaces.map( member => member.id ) );
				const group = invoke( record.witness, session, '_pdfGroup', snapshot,
					snapshot.surfaces.find( member => member.id === session._surfaceId ), session._pdf.pageCount );
				for ( const member of group ) {
					if ( baseIds.has( member.id ) ) { continue; }
					const prepared = preview.preparedMembers.find( value => value.surfaceId === member.id );
					if ( !prepared || !equal( fixed( prepared.origin.surface ), fixed( member ) ) ) { throw unavailable(); }
					temporary.set( member.id, copy( state, prepared.origin.surface ) );
					admitted.set( member.id, copy( state, prepared.origin ) );
				}
				const evidence = invoke( record.witness, state.source, 'getReadEvidence', record.native ).result;
				const citation = { targetSurfaceId: session._surfaceId, sourcePageId: evidence.source.pageId,
					sourceRevisionId: evidence.source.revisionId, sourceSurfaceId: evidence.source.surfaceId };
				const key = JSON.stringify( [ citation.sourcePageId, citation.sourceRevisionId,
					evidence.sourceGroup.source.fileTitle, nameKey( evidence.sourceGroup.label ) ] );
				const entries = preview.mode === 'append' && claims ? copy( state, claims.entries ) : [];
				if ( !entries.some( entry => entry.key === key ) ) { entries.push( { key, citation } ); }
				if ( entries.length > 32 ) { throw unavailable(); }
				const sources = entries.map( entry => entry.citation ), admissionRevisions = originsFor( state, snapshot, admitted );
				const before = { snapshot: record.witness.snapshot, temporary: record.witness.maps[ 0 ].data,
					admissions: record.witness.maps[ 1 ].data, sources: claims ? claims.entries.map( entry => entry.citation ) : [],
					admissionRevisions: originsFor( state, record.witness.snapshot, session._pdf.admissions ) };
				const after = { snapshot, temporary: Array.from( temporary ), admissions: Array.from( admitted ), sources, admissionRevisions };
				const token = Object.freeze( Object.create( null ) );
				const handle = { source: sourceHandle, scope, claims, nextClaims: { scope, entries }, methods,
					snapshot: copy( state, snapshot ), temporary, admitted, before: copy( state, before ), after: copy( state, after ),
					preview: copy( state, { ...preview, dirty: !equal( snapshot, record.witness.base ), sources, admissionRevisions,
						beforeSnapshot: record.witness.snapshot } ),
					slots: [ [ session, '_snapshot' ], [ session._pdf, 'temporary' ], [ session._pdf, 'admissions' ] ]
						.map( ( [ object, slot ] ) => ( { object, key: slot, descriptor: writableSlot( object, slot ) } ) ) };
				checkTransaction( this, handle );
				if ( !transactions.has( this ) ) { transactions.set( this, new Map() ); }
				transactions.get( this ).set( token, handle );
				return token;
			} catch ( error ) { throw unavailable(); }
			finally { if ( acquired ) { preparing.delete( sourceHandle ); } }
		}

		inspectImportCommit( token ) {
			try {
				const { state, handle } = commitRecord( this, token ), result = copy( state, handle.preview );
				commitRecord( this, token ); return result;
			} catch ( error ) { throw unavailable(); }
		}

		commitPreparedImport( token, beforeCommit ) {
			try {
				const { state, handle, store } = commitRecord( this, token );
				if ( typeof beforeCommit !== 'function' ) { throw unavailable(); }
				const beforeCheckpoint = Object.freeze( Object.create( null ) ), checkpoint = Object.freeze( Object.create( null ) );
				const result = { ...copy( state, handle.preview ), beforeCheckpoint, checkpoint };
				const checkpointStore = checkpoints.get( this ) || new Map();
				const before = { scope: handle.scope, data: handle.before }, after = { scope: handle.scope, data: handle.after };
				const assignments = handle.slots.map( ( slot, index ) => ( { object: slot.object, key: slot.key,
					descriptor: { ...slot.descriptor, value: [ handle.snapshot, handle.temporary, handle.admitted ][ index ] } } ) );
				const outcome = beforeCommit();
				if ( outcome !== undefined ) {
					if ( outcome instanceof Promise ) { Promise.prototype.catch.call( outcome, () => {} ); }
					throw unavailable();
				}
				commitRecord( this, token );
				// All callbacks, cloning and fallible admission checks precede these native writes.
				for ( const assignment of assignments ) { define( assignment.object, assignment.key, assignment.descriptor ); }
				weakSet( citations, state.session, handle.nextClaims );
				weakSet( checkpoints, this, checkpointStore );
				mapSet( checkpointStore, beforeCheckpoint, before ); mapSet( checkpointStore, checkpoint, after );
				consume( consumed, handle.source ); mapDelete( store, token );
				return result;
			} catch ( error ) { throw unavailable(); }
		}

		releaseImportCommit( token ) {
			const store = transactions.get( this );
			if ( !store || !store.delete( token ) ) { throw unavailable(); }
		}

		inspectImportCheckpoint( token ) {
			try {
				const state = active( this ), store = checkpoints.get( this ), checkpoint = store && store.get( token );
				if ( !checkpoint || !equal( scopeOf( state ), checkpoint.scope ) ) { throw unavailable(); }
				const witness = capture( this, state, () => {} ), result = copy( state, checkpoint.data );
				witness.check(); return result;
			} catch ( error ) { throw unavailable(); }
		}

		releaseImportCheckpoint( token ) {
			const store = checkpoints.get( this );
			if ( !store || !store.delete( token ) ) { throw unavailable(); }
		}

		getImportPublication() {
			try {
				const state = active( this ), witness = capture( this, state, () => {} ), scope = scopeOf( state );
				const claims = claimsFor( state, scope ), result = copy( state, { owner: scope.owner, pageId: scope.pageId,
					baseRevisionId: scope.baseRevisionId, surfaceId: scope.surfaceId,
					sources: claims ? claims.entries.map( entry => entry.citation ) : [],
					admissionRevisions: originsFor( state, state.session._snapshot, state.session._pdf.admissions ) } );
				witness.check(); return result;
			} catch ( error ) { throw unavailable(); }
		}

		/** Prepare privately from the real session; no live state is changed or locked. */
		async prepare( request ) {
			let cleanup;
			try {
				if ( !request || typeof request !== 'object' || Array.isArray( request ) ||
					![ Object.prototype, null ].includes( Object.getPrototypeOf( request ) ) ) { throw unavailable(); }
				const state = active( this ), mode = request && Object.getOwnPropertyDescriptor( request, 'mode' );
				if ( mode && own( mode, 'value' ) && mode.enumerable && mode.value === 'cancel' ) { return null; }
				const input = fields( request, [ 'source', 'mode', 'maxLayers', 'allocateId', 'assertCurrent' ] );
				if ( typeof input.assertCurrent !== 'function' || typeof input.allocateId !== 'function' ) { throw unavailable(); }
				const source = copy( state, fields( input.source, [ 'pageId', 'revisionId', 'surfaceId' ] ) );
				const witness = capture( this, state, input.assertCurrent ), session = state.session;
				let prepared;
				const resolver = async data => {
					const result = await admissions( witness, data );
					witness.check();
					if ( prepared && !equal( prepared, result.prepared ) ) { throw unavailable(); }
					prepared = result.prepared;
					return result.allowed;
				};
				const native = await invokeAsync( witness, state.source, 'prepareForSession', { identity: {
					targetPageId: session._pageId, targetBaseRevisionId: session._revisionId, targetSurfaceId: session._surfaceId,
					sourcePageId: source.pageId, sourceRevisionId: source.revisionId, sourceSurfaceId: source.surfaceId
				}, baseSnapshot: witness.base, targetSnapshot: witness.snapshot, mode: input.mode,
				maxLayers: input.maxLayers, allocateId: input.allocateId, assertCurrent: witness.check }, resolver );
				cleanup = { state, native };
				witness.check();
				const preview = invoke( witness, state.source, 'inspect', native );
				const activeId = witness.pdfData.activeSurfaceId;
				const blank = session._pdf.temporary.get( activeId );
				const view = preview.candidateSnapshot.surfaces.some( member => member.id === activeId ) ? preview.candidateSnapshot :
					{ ...preview.candidateSnapshot, surfaces: preview.candidateSnapshot.surfaces.concat( [ blank ] ) };
				const editorState = state.copy.call( state.adapter, view, activeId );
				witness.check();
				const handle = Object.freeze( Object.create( null ) );
				state.handles.set( handle, { native, witness, preview: copy( state, { ...preview, editorState,
					activeSurfaceId: activeId, activePage: witness.pdfData.page, preparedMembers: prepared } ) } );
				cleanup = null;
				return handle;
			} catch ( error ) { throw unavailable(); }
			finally { if ( cleanup ) { try { cleanup.state.source.release( cleanup.native ); } catch ( ignored ) {} } }
		}

		inspect( handle ) {
			try {
				const { state, record } = recordFor( this, handle ), result = copy( state, record.preview );
				recordFor( this, handle ); return result;
			} catch ( error ) { throw unavailable(); }
		}

		getReadEvidence( handle ) {
			try {
				const { state, record } = recordFor( this, handle );
				const result = invoke( record.witness, state.source, 'getReadEvidence', record.native );
				recordFor( this, handle ); return result;
			} catch ( error ) { throw unavailable(); }
		}

		async revalidate( handle ) {
			try {
				const { state, record } = recordFor( this, handle );
				await invokeAsync( record.witness, state.source, 'revalidate', record.native );
				recordFor( this, handle );
			} catch ( error ) { throw unavailable(); }
		}

		release( handle ) {
			const state = instances.get( this ), record = state && state.handles.get( handle );
			if ( !record ) { throw unavailable(); }
			state.handles.delete( handle );
			try { state.methods.find( entry => entry.object === state.source && entry.key === 'release' ).descriptor.value.call( state.source, record.native ); }
			catch ( error ) { throw unavailable(); }
		}

		dispose() {
			const state = instances.get( this );
			if ( !state ) { throw unavailable(); }
			state.active = false;
			for ( const handle of state.handles.keys() ) { try { this.release( handle ); } catch ( ignored ) {} }
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.PageOwnedWholePdfImportSession = PageOwnedWholePdfImportSession;
	}
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedWholePdfImportSession; }
}() );
