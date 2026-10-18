/** Unregistered, read-only whole-PDF Import preparation bound to a live editor session. */
'use strict';

( function () {
	const instances = new WeakMap();
	// Opt-in transaction state never becomes serialized session authority.
	const transactions = new WeakMap(), checkpoints = new WeakMap(), citations = new WeakMap();
	const checkpointClaims = new WeakMap(), restores = new WeakMap();
	const draftRecoveries = new WeakMap();
	const draftSourceTypes = new WeakMap();
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

	function restoreRecord( instance, token ) {
		const state = active( instance ), store = restores.get( instance ), record = store && store.get( token );
		if ( !record ) { throw unavailable(); }
		record.check();
		return { state, store, record };
	}

	function checkpointGroup( state, snapshot, origins ) {
		const ids = new Set( JSON.parse( state.session._savedJson ).surfaces.map( member => member.id ) );
		return selected( snapshot, state.session ).filter( member => ids.has( member.id ) ||
			!equal( member, origins.get( member.id ) ) ).sort( ( left, right ) => left.id.localeCompare( right.id ) );
	}

	function draftCall( record, object, key, ...args ) {
		record.check();
		const entry = record.methods.find( value => value.object === object && value.key === key );
		if ( !entry ) { throw unavailable(); }
		const result = entry.descriptor.value.call( object, ...args ); record.check(); return result;
	}
	async function draftAwait( record, object, key, ...args ) {
		record.check();
		const entry = record.methods.find( value => value.object === object && value.key === key );
		if ( !entry ) { throw unavailable(); }
		const pending = Promise.resolve( entry.descriptor.value.call( object, ...args ) );
		const cleanup = value => {
			if ( object === record.state.source && key === 'prepareDraftReads' ) {
				const release = record.methods.find( methodEntry => methodEntry.object === object && methodEntry.key === 'releaseDraftReads' );
				try { release.descriptor.value.call( object, value ); } catch ( ignored ) {}
			}
		};
		try { record.check(); } catch ( error ) { pending.then( cleanup, () => {} ); throw error; }
		const result = await pending;
		try { record.check(); } catch ( error ) { cleanup( result ); throw error; } return result;
	}
	function draftRecord( instance, token ) {
		const state = active( instance ), store = draftRecoveries.get( instance ), record = store && store.get( token );
		if ( !record || record.committed || record.released ) { throw unavailable(); }
		record.check();
		if ( !draftCall( record, record.Source, 'isDraftReadHandle', record.native, state.source ) ) { throw unavailable(); }
		return { state, store, record };
	}
	function draftHolders( plan ) {
		return [ plan.session, ...plan.history.groups.filter( group => !group.retired )
			.flatMap( group => [ group.checkpoints.before, group.checkpoints.after ] ) ];
	}
	async function authorizeDraft( record ) {
		const { state, witness, plan } = record, session = state.session, holders = draftHolders( plan );
		const reads = draftCall( record, state.source, 'inspectDraftReads', record.native ), keys = new Map(), contexts = new Map();
		for ( const { identity, data } of reads ) {
			if ( data.target.owner !== session._owner || data.target.pageId !== session._pageId || data.target.revisionId !== session._revisionId ||
				data.target.surfaceId !== session._surfaceId || !equal( data.targetBundle.snapshot, witness.base ) ||
				data.targetGroup.pageCount !== session._pdf.pageCount || !equal( data.targetGroup.source, session._pdf.original ) ||
				data.sourceGroup.source.fileTitle !== data.targetGroup.source.fileTitle ||
				nameKey( data.sourceGroup.label ) !== nameKey( data.targetGroup.label ) ) { throw unavailable(); }
			keys.set( JSON.stringify( [ identity.sourcePageId, identity.sourceRevisionId, identity.sourceSurfaceId ] ),
				JSON.stringify( [ identity.sourcePageId, identity.sourceRevisionId, data.sourceGroup.source.fileTitle, nameKey( data.sourceGroup.label ) ] ) );
			for ( const surface of data.admittedTargetSurfaces ) {
				const context = admit( witness, nativeContext( data, surface ) ), existing = contexts.get( context.page );
				if ( existing && !equal( existing, context ) ) { throw unavailable(); } contexts.set( context.page, context );
			}
		}
		// This native editor read proves current edit access even when the draft has no source citations.
		const current = copy( state, await invokeAsync( witness, state.pageReader, 'read', { owner: session._owner,
			revisionId: session._revisionId, binding: 'v1:' + session._pageId + ':' + session._surfaceId, page: session._pdf.page } ) );
		const currentContext = invoke( witness, session, '_pdfAdmit', current );
		if ( currentContext.page !== session._pdf.page ) { throw unavailable(); }
		const base = copy( state, await invokeAsync( witness, session._reader, 'read', { owner: session._owner, revisionId: session._revisionId } ) );
		if ( base.revisionId !== session._revisionId || !equal( base.snapshot, witness.base ) ) { throw unavailable(); }
		const histories = new Map(), origins = holders.flatMap( holder => holder.admissions );
		// A currently viewed blank is also retained; it must not gain authority from stored draft data.
		origins.push( ...witness.maps[ 1 ].data );
		const checked = new Map();
		for ( const [ id, origin ] of origins ) {
			const key = JSON.stringify( [ id, origin ] ); if ( checked.has( key ) ) { continue; }
			let context = contexts.get( origin.surface.source.page );
			if ( !context ) {
				const raw = copy( state, await invokeAsync( witness, state.pageReader, 'read', { owner: session._owner, revisionId: session._revisionId,
					binding: 'v1:' + session._pageId + ':' + session._surfaceId, page: origin.surface.source.page } ) );
				context = admit( witness, raw ); contexts.set( context.page, context );
			}
			if ( invoke( witness, session, '_pdfNativeId', origin ) !== id ) { throw unavailable(); }
			if ( origin.revisionId === session._revisionId ) {
				if ( !equal( origin.surface, context.surface ) ) { throw unavailable(); }
			} else {
				if ( !invoke( witness, session, '_pdfAssociation', origin, context ) ) { throw unavailable(); }
				if ( !histories.has( origin.revisionId ) ) {
					const historical = copy( state, await invokeAsync( witness, session._reader, 'read', { owner: session._owner, revisionId: origin.revisionId } ) );
					if ( historical.revisionId !== origin.revisionId ) { throw unavailable(); } histories.set( origin.revisionId, historical.snapshot );
				}
				invoke( witness, session, '_pdfHistoricalOrigin', origin, histories.get( origin.revisionId ) );
			}
			checked.set( key, true );
		}
		const claims = [], cache = new Map();
		for ( const holder of holders ) {
			const group = invoke( witness, session, '_pdfGroup', holder.snapshot,
				holder.snapshot.surfaces.find( value => value.id === session._surfaceId ), session._pdf.pageCount );
			for ( const surface of group ) { state.copy.call( state.adapter, holder.snapshot, surface.id ); }
			if ( !equal( originsFor( state, holder.snapshot, new Map( holder.admissions ) ), holder.admissionRevisions ) ) { throw unavailable(); }
			const entries = holder.sources.map( citation => {
				const key = keys.get( JSON.stringify( [ citation.sourcePageId, citation.sourceRevisionId, citation.sourceSurfaceId ] ) );
				if ( !key ) { throw unavailable(); } return { key, citation: copy( state, citation ) };
			} );
			if ( new Set( entries.map( entry => entry.key ) ).size !== entries.length ) { throw unavailable(); }
			const key = JSON.stringify( holder.sources.map( citation => [ citation.targetSurfaceId,
				citation.sourcePageId, citation.sourceRevisionId, citation.sourceSurfaceId ] ) );
			if ( !cache.has( key ) ) { cache.set( key, entries.length ? { scope: record.scope, entries } : undefined ); }
			claims.push( cache.get( key ) );
		}
		record.check(); return { claims, currentContext };
	}
	function stageDraft( record, authority ) {
		const { state, witness, plan } = record, session = state.session, data = plan.session;
		const snapshot = copy( state, data.snapshot ), temporary = new Map( copy( state, data.temporary ) ), admitted = new Map( copy( state, data.admissions ) );
		const member = selected( snapshot, session ).find( surface => surface.source.page === session._pdf.page );
		const activeId = member ? member.id : session._pdf.activeSurfaceId;
		if ( !member && !temporary.has( activeId ) ) {
			const blank = session._pdf.temporary.get( activeId ), origin = session._pdf.admissions.get( activeId );
			if ( !blank || !origin ) { throw unavailable(); }
			temporary.set( activeId, copy( state, blank ) ); admitted.set( activeId, copy( state, origin ) );
		}
		const view = member ? snapshot : { ...snapshot, surfaces: snapshot.surfaces.concat( temporary.get( activeId ) ) };
		const editorState = state.copy.call( state.adapter, view, activeId );
		const preview = copy( state, { candidateSnapshot: snapshot, editorState, activeSurfaceId: activeId,
			activePage: session._pdf.page, dirty: !equal( snapshot, witness.base ), sources: data.sources,
			admissionRevisions: originsFor( state, snapshot, admitted ), history: plan.history } );
		const checkpointStore = new Map(), pairs = [], rows = [], holders = draftHolders( plan );
		let index = 1;
		for ( const group of plan.history.groups.filter( value => !value.retired ) ) {
			const tokens = [];
			for ( const phase of [ 'before', 'after' ] ) {
				const token = Object.freeze( Object.create( null ) ); tokens.push( token );
				checkpointStore.set( token, { scope: record.scope, data: copy( state, group.checkpoints[ phase ] ) } );
				pairs.push( [ token, authority.claims[ index++ ] ] );
			}
			rows.push( { id: group.id, beforeCheckpoint: tokens[ 0 ], checkpoint: tokens[ 1 ] } );
		}
		if ( holders.length !== index ) { throw unavailable(); }
		const slots = [ [ session, '_snapshot', snapshot ], [ session._pdf, 'temporary', temporary ],
			[ session._pdf, 'admissions', admitted ], [ session._pdf, 'activeSurfaceId', activeId ] ]
			.map( ( [ object, key, value ] ) => ( { object, key, descriptor: writableSlot( object, key ), value } ) );
		return { preview, rows, checkpointStore, pairs, claims: authority.claims[ 0 ], slots };
	}

	class PageOwnedWholePdfImportSession {
		/** Prepare inert data privately; fresh native reads provide all admission authority. */
		async prepareDraftRecovery( input, assertCurrent ) {
			let record;
			try {
				if ( typeof assertCurrent !== 'function' ) { throw unavailable(); }
				const state = active( this ), external = () => {
					const result = assertCurrent();
					if ( result !== undefined ) { if ( result instanceof Promise ) { Promise.prototype.catch.call( result, () => {} ); } throw unavailable(); }
				};
				const witness = capture( this, state, external ), scope = scopeOf( state );
				const editor = typeof window !== 'undefined' && window.Layers && window.Layers.Editor;
				const Plan = editor && editor.PageOwnedWholePdfImportDraftPlan || module.require( './PageOwnedWholePdfImportDraftPlan.js' );
				const Source = draftSourceTypes.get( this );
				const methods = [ ...[ 'prepareDraftRecovery', 'inspectDraftRecovery', 'revalidateDraftRecovery', 'commitDraftRecovery',
					'releaseDraftRecovery', 'captureImportDraft' ].map( key => method( this, key ) ),
				...[ 'prepareDraftReads', 'inspectDraftReads', 'revalidateDraftReads', 'releaseDraftReads' ].map( key => method( state.source, key ) ),
				method( Source, 'isDraftReadHandle' ), method( Plan, 'prepare' ) ];
				const initialClaims = claimsFor( state, scope ), initialCheckpoints = checkpoints.get( this );
				record = { state, witness, scope, Source, methods, committed: false, released: false, ready: false, checking: false };
				record.check = () => {
					witness.check();
					if ( record.released || record.committed || claimsFor( state, scope ) !== initialClaims || checkpoints.get( this ) !== initialCheckpoints ) { throw unavailable(); }
					for ( const captured of methods ) {
						const current = method( captured.object, captured.key );
						if ( current.holder !== captured.holder || !exactDescriptor( current.descriptor, captured.descriptor ) ) { throw unavailable(); }
					}
					if ( record.stage ) { for ( const slot of record.stage.slots ) {
						if ( !exactDescriptor( writableSlot( slot.object, slot.key ), slot.descriptor ) ) { throw unavailable(); }
					} }
				};
				record.plan = draftCall( record, Plan, 'prepare', input, this.captureImportDraft() );
				record.native = await draftAwait( record, state.source, 'prepareDraftReads', {
					target: { pageId: scope.pageId, baseRevisionId: scope.baseRevisionId, surfaceId: scope.surfaceId },
					sources: draftHolders( record.plan ).flatMap( holder => holder.sources ), assertCurrent: record.check } );
				if ( !draftCall( record, Source, 'isDraftReadHandle', record.native, state.source ) ) { throw unavailable(); }
				const authority = await authorizeDraft( record ); record.stage = stageDraft( record, authority ); record.check();
				const token = Object.freeze( Object.create( null ) );
				if ( !draftRecoveries.has( this ) ) { draftRecoveries.set( this, new Map() ); }
				draftRecoveries.get( this ).set( token, record ); return token;
			} catch ( error ) {
				if ( record && record.native ) { try { record.state.source.releaseDraftReads( record.native ); } catch ( ignored ) {} }
				throw unavailable();
			}
		}

		inspectDraftRecovery( token ) {
			try {
				const { state, record } = draftRecord( this, token );
				const result = { ...copy( state, record.stage.preview ), commands: record.stage.rows.map( row => ( { ...row } ) ) };
				draftRecord( this, token ); return result;
			} catch ( error ) { throw unavailable(); }
		}

		async revalidateDraftRecovery( token ) {
			let record;
			try {
				( { record } = draftRecord( this, token ) );
				if ( record.checking ) { throw unavailable(); } record.checking = true; record.ready = false;
				await draftAwait( record, record.state.source, 'revalidateDraftReads', record.native );
				const authority = await authorizeDraft( record ); draftRecord( this, token );
				if ( !equal( authority.claims, [ record.stage.claims, ...record.stage.pairs.map( pair => pair[ 1 ] ) ] ) ) { throw unavailable(); }
				record.ready = true;
			} catch ( error ) { throw unavailable(); }
			finally { if ( record ) { record.checking = false; } }
		}

		commitDraftRecovery( token, beforeCommit ) {
			try {
				const { state, record } = draftRecord( this, token );
				if ( !record.ready || record.checking || typeof beforeCommit !== 'function' ) { throw unavailable(); }
				const stage = record.stage, result = copy( state, stage.preview );
				const assignments = stage.slots.map( slot => ( { ...slot, descriptor: { ...slot.descriptor, value: slot.value } } ) );
				const outcome = beforeCommit();
				if ( outcome !== undefined ) { if ( outcome instanceof Promise ) { Promise.prototype.catch.call( outcome, () => {} ); } throw unavailable(); }
				draftRecord( this, token );
				// No callbacks or data validation follow the first native write.
				for ( const assignment of assignments ) { define( assignment.object, assignment.key, assignment.descriptor ); }
				weakSet( citations, state.session, stage.claims ); weakSet( checkpoints, this, stage.checkpointStore );
				for ( const [ checkpoint, claims ] of stage.pairs ) { weakSet( checkpointClaims, checkpoint, claims ); }
				record.committed = true; return result;
			} catch ( error ) { throw unavailable(); }
		}

		releaseDraftRecovery( token ) {
			const store = draftRecoveries.get( this ), record = store && store.get( token );
			if ( !record ) { throw unavailable(); } mapDelete( store, token ); record.released = true;
			const release = record.methods.find( value => value.object === record.state.source && value.key === 'releaseDraftReads' );
			release.descriptor.value.call( record.state.source, record.native );
		}

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
				methods.push( ...[ 'prepareDraftReads', 'inspectDraftReads', 'revalidateDraftReads', 'releaseDraftReads' ]
					.map( key => method( source, key ) ), method( Source, 'isDraftReadHandle' ),
				...[ 'prepareDraftRecovery', 'inspectDraftRecovery', 'revalidateDraftRecovery', 'commitDraftRecovery', 'releaseDraftRecovery' ]
					.map( key => method( this, key ) ) );
				draftSourceTypes.set( this, Source );
				for ( const reader of [ session._reader, pageReader ] ) {
					const api = descriptor( reader, 'api' ).value;
					values.push( [ reader, 'api' ] ); methods.push( method( api, 'get' ) );
				}
				instances.set( this, { active: true, session, source, pageReader, adapter, methods,
					copy: method( adapter, 'toEditorState' ).descriptor.value,
					values: values.map( ( [ object, key ] ) => ( { object, key, descriptor: descriptor( object, key ) } ) ), handles: new Map() } );
			} catch ( error ) { throw unavailable(); }
		}

		/** Prove the actual live session association, rather than matching serialized IDs. */
		ownsSession( session ) {
			try { return active( this ).session === session; } catch ( error ) { return false; }
		}

		/** Detached draft data only; serialized origins and citations grant no authority. */
		captureImportDraft() {
			try {
				const state = active( this ), witness = capture( this, state, () => {} ), scope = scopeOf( state );
				const claims = claimsFor( state, scope );
				const result = copy( state, { version: 1, scope, snapshot: witness.snapshot, pdf: witness.pdfData,
					context: witness.context, temporary: witness.maps[ 0 ].data, admissions: witness.maps[ 1 ].data,
					sources: claims ? claims.entries.map( entry => entry.citation ) : [],
					admissionRevisions: originsFor( state, witness.snapshot, state.session._pdf.admissions ) } );
				witness.check(); return result;
			} catch ( error ) { throw unavailable(); }
		}

		/** Prepare a private group checkpoint restore; preserve unrelated live work and selection. */
		prepareImportRestore( expectedToken, targetToken, assertCurrent ) {
			try {
				if ( typeof assertCurrent !== 'function' ) { throw unavailable(); }
				const state = active( this ), store = checkpoints.get( this ), expected = store && store.get( expectedToken );
				const target = store && store.get( targetToken ), scope = scopeOf( state ), session = state.session;
				if ( !expected || !target || !checkpointClaims.has( expectedToken ) || !checkpointClaims.has( targetToken ) ||
					!equal( scope, expected.scope ) || !equal( scope, target.scope ) ) { throw unavailable(); }
				const witness = capture( this, state, assertCurrent ), claims = claimsFor( state, scope );
				if ( claims !== checkpointClaims.get( expectedToken ) ||
					!equal( checkpointGroup( state, witness.snapshot, session._pdf.temporary ),
						checkpointGroup( state, expected.data.snapshot, new Map( expected.data.temporary ) ) ) ) { throw unavailable(); }
				const desired = copy( state, selected( target.data.snapshot, session ) );
				const currentIds = new Set( selected( witness.snapshot, session ).map( member => member.id ) );
				const desiredIds = new Set( desired.map( member => member.id ) ), next = copy( state, witness.snapshot );
				next.surfaces = next.surfaces.filter( member => !currentIds.has( member.id ) || desiredIds.has( member.id ) )
					.map( member => currentIds.has( member.id ) ? desired.find( value => value.id === member.id ) : member );
				for ( const member of desired ) { if ( !next.surfaces.some( value => value.id === member.id ) ) { next.surfaces.push( member ); } }
				invoke( witness, session, '_pdfGroup', next, next.surfaces.find( member => member.id === session._surfaceId ), session._pdf.pageCount );
				const temporary = new Map( copy( state, target.data.temporary ) ), admitted = new Map( copy( state, target.data.admissions ) );
				const expectedIds = new Set( expected.data.temporary.map( entry => entry[ 0 ] ) );
				for ( const [ id, blank ] of witness.maps[ 0 ].data ) {
					if ( !temporary.has( id ) && ( id === session._pdf.activeSurfaceId || !expectedIds.has( id ) ) ) {
						const origin = session._pdf.admissions.get( id );
						if ( !origin || !equal( origin.surface, blank ) || invoke( witness, session, '_pdfNativeId', origin ) !== id ||
							!equal( invoke( witness, session, '_pdfPin', blank ), session._pdf.original ) ) { throw unavailable(); }
						temporary.set( id, copy( state, blank ) ); admitted.set( id, copy( state, origin ) );
					}
				}
				const activeId = session._pdf.activeSurfaceId, view = next.surfaces.some( member => member.id === activeId ) ? next :
					{ ...next, surfaces: next.surfaces.concat( [ temporary.get( activeId ) ] ) };
				const editorState = state.copy.call( state.adapter, view, activeId );
				const preview = copy( state, { candidateSnapshot: next, editorState, activeSurfaceId: activeId,
					activePage: session._pdf.page, dirty: !equal( next, witness.base ), sources: target.data.sources,
					admissionRevisions: originsFor( state, next, admitted ) } );
				const slots = [ [ session, '_snapshot', next ], [ session._pdf, 'temporary', temporary ], [ session._pdf, 'admissions', admitted ] ]
					.map( ( [ object, key, value ] ) => ( { object, key, descriptor: writableSlot( object, key ), value } ) );
				const methods = [ 'prepareImportRestore', 'inspectImportRestore', 'commitImportRestore', 'releaseImportRestore', 'ownsSession' ]
					.map( key => method( this, key ) );
				const check = () => {
					witness.check();
					if ( checkpoints.get( this ) !== store || store.get( expectedToken ) !== expected || store.get( targetToken ) !== target ||
						claimsFor( state, scope ) !== claims ) { throw unavailable(); }
					for ( const captured of methods ) {
						const current = method( captured.object, captured.key );
						if ( current.holder !== captured.holder || !exactDescriptor( current.descriptor, captured.descriptor ) ) { throw unavailable(); }
					}
					for ( const slot of slots ) { if ( !exactDescriptor( writableSlot( slot.object, slot.key ), slot.descriptor ) ) { throw unavailable(); } }
				};
				check(); const token = Object.freeze( Object.create( null ) );
				if ( !restores.has( this ) ) { restores.set( this, new Map() ); }
				restores.get( this ).set( token, { check, slots, preview, claims: checkpointClaims.get( targetToken ) } );
				return token;
			} catch ( error ) { throw unavailable(); }
		}

		inspectImportRestore( token ) {
			try {
				const { state, record } = restoreRecord( this, token ), result = copy( state, record.preview );
				record.check(); return result;
			} catch ( error ) { throw unavailable(); }
		}

		commitImportRestore( token, beforeCommit ) {
			try {
				const { state, store, record } = restoreRecord( this, token );
				if ( typeof beforeCommit !== 'function' ) { throw unavailable(); }
				const result = copy( state, record.preview ), assignments = record.slots.map( slot => ( { ...slot,
					descriptor: { ...slot.descriptor, value: slot.value } } ) );
				const outcome = beforeCommit();
				if ( outcome !== undefined ) {
					if ( outcome instanceof Promise ) { Promise.prototype.catch.call( outcome, () => {} ); }
					throw unavailable();
				}
				record.check();
				for ( const assignment of assignments ) { define( assignment.object, assignment.key, assignment.descriptor ); }
				weakSet( citations, state.session, record.claims ); mapDelete( store, token );
				return result;
			} catch ( error ) { throw unavailable(); }
		}

		releaseImportRestore( token ) {
			const store = restores.get( this );
			if ( !store || !store.delete( token ) ) { throw unavailable(); }
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
				weakSet( checkpointClaims, beforeCheckpoint, handle.claims ); weakSet( checkpointClaims, checkpoint, handle.nextClaims );
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
			const recovery = draftRecoveries.get( this );
			if ( recovery ) { for ( const token of Array.from( recovery.keys() ) ) { try { this.releaseDraftRecovery( token ); } catch ( ignored ) {} } }
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
