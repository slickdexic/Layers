/** Explicit first-Save model for a missing PDF layer set. No callers are activated here. */
( function () {
	'use strict';
	const records = new WeakMap(), preparations = new WeakMap(), reconciliations = new WeakMap();
	const importModes = new WeakMap(), importPlans = new WeakMap(), importCheckpoints = new WeakMap();
	const importPublications = new WeakMap();
	const importPublicationRecoveries = new WeakMap();
	const unavailable = () => Object.assign( new Error( 'layers-editor-session-unavailable' ),
		{ code: 'layers-editor-session-unavailable' } );
	const positive = value => Number.isInteger( value ) && value > 0 && value <= 2147483647;
	const controls = value => Array.from( value ).some( character => character.charCodeAt( 0 ) < 32 );
	const publicationCodes = new Set( [ 'permissiondenied', 'badtoken', 'ratelimited', 'layers-owner-edit-denied',
		'layers-invalid-publication-request', 'layers-invalid-snapshot', 'layers-source-unavailable',
		'layers-edit-conflict', 'layers-publication-disabled', 'layers-admission-unauthorized',
		'layers-slot-removal-denied', 'layers-content-not-renderable', 'layers-edit-filtered' ] );
	const additionalPublicationCodes = [ 'missingparam', 'outofrange', 'maxbytes', 'mustbeposted',
		'layers-main-model-change-denied', 'layers-working-copy-import-unavailable' ];
	additionalPublicationCodes.forEach( code => publicationCodes.add( code ) );
	const nameKey = name => name.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
	function canonical( value ) {
		if ( Array.isArray( value ) ) return '[' + value.map( canonical ).join( ',' ) + ']';
		if ( value && typeof value === 'object' ) return '{' + Object.keys( value ).sort()
			.map( key => JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		return JSON.stringify( value );
	}
	const equal = ( left, right ) => canonical( left ) === canonical( right );
	function classes() {
		return typeof module !== 'undefined' && module && typeof module.require === 'function' ? {
			Adapter: require( './PageOwnedSnapshotAdapter.js' ), Ids: require( './PageOwnedPdfWorkingSet.js' )
		} : { Adapter: window.Layers.Editor.PageOwnedSnapshotAdapter, Ids: window.Layers.Editor.PageOwnedPdfWorkingSet };
	}
	function clone( adapter, value ) {
		return adapter.toEditorState( { schemaVersion: 1, surfaces: [ {
			id: 'copy', kind: 'slide', canvas: { value }, layers: []
		} ] }, 'copy' ).canvas.value;
	}
	function data( transaction, ready = false ) {
		const record = records.get( transaction );
		if ( !record || record.phase === 'disposed' || ( ready && record.phase !== 'ready' ) ||
			record.reader.read !== record.read || record.publisher.publish !== record.publish ) throw unavailable();
		return record;
	}
	function identity( value ) {
		const result = { ...value };
		delete result.context;
		return result;
	}
	function pin( surface ) {
		const result = { ...surface.source };
		delete result.page;
		return result;
	}
	function admit( record, input, requested ) {
		const value = clone( record.adapter, input ), fixed = record.fixed;
		if ( !equal( identity( value ), identity( fixed ) ) ) throw unavailable();
		const context = value.context, original = fixed.context, surface = context && context.surface;
		const source = surface && surface.source, geometry = context && context.sourceGeometry;
		const rendition = context && context.rendition, target = fixed.target;
		if ( !context || context.owner !== target.owner || context.pageId !== target.pageId ||
			context.revisionId !== target.revisionId || context.binding !== 'v1:' + target.pageId + ':' + target.surfaceId ||
			context.kind !== 'pdf' || context.label !== fixed.anchorSurface.label ||
			context.initialPage !== fixed.anchorSurface.source.page || context.pageCount !== original.pageCount ||
			!positive( context.pageCount ) || context.pageCount > 100 || !positive( requested ) ||
			context.page !== requested || requested > context.pageCount || context.stored !== false ||
			!equal( context.members, [] ) || !surface || surface.kind !== 'pdf' || surface.label !== context.label ||
			!source || source.page !== requested || !equal( pin( surface ), pin( fixed.anchorSurface ) ) ||
			surface.id !== record.ids.surfaceId( target.pageId, target.revisionId, source.fileTitle, surface.label, requested ) ||
			!equal( surface.layers, [] ) || record.base.surfaces.some( member => member.id === surface.id ) ||
			!geometry || geometry.page !== requested || geometry.units !== 'file-handler-pixels' ||
			!positive( geometry.width ) || !positive( geometry.height ) || !rendition ||
			typeof rendition.url !== 'string' || !/^(?:https?:\/\/[^/\s]+\/|\/)[^\s]*$/.test( rendition.url ) ||
			controls( rendition.url ) || !positive( rendition.width ) || !positive( rendition.height ) ) throw unavailable();
		const scale = Math.min( 1, 4096 / Math.max( geometry.width, geometry.height ) );
		if ( surface.canvas.width !== Math.max( 1, Math.round( geometry.width * scale ) ) ||
			surface.canvas.height !== Math.max( 1, Math.round( geometry.height * scale ) ) ) throw unavailable();
		record.adapter.toEditorState( { schemaVersion: 1, surfaces: [ surface ] }, surface.id );
		if ( requested === context.initialPage && !equal( surface, fixed.anchorSurface ) ) throw unavailable();
		const previous = record.pages.get( requested );
		if ( previous && ( !equal( previous.surface, surface ) || !equal( previous.sourceGeometry, geometry ) ) ) throw unavailable();
		return context;
	}
	function current( transaction, record, epoch, phase = 'ready' ) {
		if ( data( transaction ) !== record || record.phase !== phase ||
			( epoch !== null && record.epoch !== epoch ) ) throw unavailable();
	}
	async function readPage( transaction, record, page, epoch, phase = 'ready' ) {
		if ( !positive( page ) || page > record.fixed.context.pageCount ) throw unavailable();
		const target = record.fixed.target, selection = record.fixed.selection;
		let result;
		try { result = await record.read.call( record.reader, { ...target, selection: clone( record.adapter, selection ), page } ); }
		catch ( error ) { throw unavailable(); }
		current( transaction, record, epoch, phase );
		return admit( record, result, page );
	}
	function snapshot( record, members = record.members ) {
		return { ...clone( record.adapter, record.base ), surfaces: record.base.surfaces.concat(
			Array.from( members.values() ).sort( ( left, right ) => left.source.page - right.source.page ) ) };
	}
	function state( record ) {
		const member = record.members.get( record.page ) || record.pages.get( record.page ).surface;
		return record.adapter.toEditorState( { schemaVersion: 1, surfaces: [ member ] }, member.id );
	}
	function envelope( record ) {
		return { version: 1, creation: identity( record.fixed ), pageCount: record.fixed.context.pageCount,
			activePage: record.page, snapshot: snapshot( record ) };
	}
	/** Optional synchronous host guard and history-only pages; default preparation remains unchanged. */
	function operationOptions( record, input, allowPages = false ) {
		let guard, pages = [], publicationAttempt;
		if ( input !== undefined ) {
			if ( !input || Object.getPrototypeOf( input ) !== Object.prototype || Reflect.ownKeys( input ).some( key =>
				key !== 'guard' && ( !allowPages || ( key !== 'pages' && key !== 'publicationAttempt' ) ) ) ) throw unavailable();
			const properties = Object.getOwnPropertyDescriptors( input );
			for ( const descriptor of Object.values( properties ) ) if ( !Object.hasOwn( descriptor, 'value' ) ) throw unavailable();
			guard = properties.guard && properties.guard.value;
			if ( guard !== undefined && typeof guard !== 'function' ) throw unavailable();
			if ( properties.pages ) pages = clone( record.adapter, properties.pages.value );
			if ( properties.publicationAttempt ) publicationAttempt = clone( record.adapter, properties.publicationAttempt.value );
		}
		if ( !Array.isArray( pages ) || pages.length > 100 || new Set( pages ).size !== pages.length ||
			pages.some( page => !positive( page ) || page > record.fixed.context.pageCount ) ) throw unavailable();
		return { pages, publicationAttempt, check: () => {
			if ( guard ) {
				const result = guard();
				if ( result !== undefined && result !== true ) { Promise.resolve( result ).catch( () => {} ); throw unavailable(); }
			}
		} };
	}
	function validateAttempt( record, input, pages ) {
		if ( input === null ) return null;
		const attempt = clone( record.adapter, input );
		if ( !attempt || !equal( Object.keys( attempt ).sort(), [ 'baseRevisionId', 'code', 'dispatchState', 'revisionId', 'sequence', 'snapshot', 'version' ] ) ||
			attempt.version !== 1 || !positive( attempt.sequence ) || attempt.baseRevisionId !== record.fixed.target.revisionId ||
			![ 'prepared', 'dispatched', 'refused', 'unknown' ].includes( attempt.dispatchState ) ||
			attempt.revisionId !== null ||
			( attempt.code !== null && !publicationCodes.has( attempt.code ) &&
				![ 'layers-publication-outcome-unknown', 'layers-draft-storage-failed', 'layers-editor-session-unavailable' ].includes( attempt.code ) ) ||
			( [ 'prepared', 'dispatched', 'confirmed' ].includes( attempt.dispatchState ) && attempt.code !== null ) ) throw unavailable();
		const next = attempt.snapshot, expected = snapshot( record, new Map() );
		if ( !next || !Array.isArray( next.surfaces ) || !equal( { ...next, surfaces: [] }, { ...expected, surfaces: [] } ) ||
			!equal( next.surfaces.slice( 0, record.base.surfaces.length ), record.base.surfaces ) ) throw unavailable();
		let previous = 0; const members = next.surfaces.slice( record.base.surfaces.length );
		if ( !members.length || members.length > record.fixed.context.pageCount ||
			!members.some( member => member.source && member.source.page === record.fixed.context.initialPage ) ) throw unavailable();
		for ( const member of members ) {
			const page = member.source && member.source.page, blank = pages.get( page );
			if ( !positive( page ) || page <= previous || !blank ) throw unavailable();
			const surface = blank.surface, rebuilt = record.adapter.withEditorState( { schemaVersion: 1, surfaces: [ surface ] }, surface.id,
				{ canvas: member.canvas, layers: member.layers } ).surfaces[ 0 ];
			if ( !equal( member, rebuilt ) ) throw unavailable(); previous = page;
		}
		return attempt;
	}
	function importTypes() {
		return typeof module !== 'undefined' && module && typeof module.require === 'function' ? {
			Reader: require( './PageOwnedMissingPdfImportReadClient.js' ), Planner: require( './PageOwnedWholePdfImportPlan.js' )
		} : { Reader: window.Layers.Editor.PageOwnedMissingPdfImportReadClient, Planner: window.Layers.Editor.PageOwnedWholePdfImportPlan };
	}
	function importMode( transaction ) {
		const record = data( transaction, true ), mode = importModes.get( transaction );
		if ( !mode || !mode.active || mode.reader.read !== mode.read || mode.reader.dispose !== mode.dispose ||
			mode.Planner.prepare !== mode.plan || record.adapter.toEditorState !== mode.toState ||
			record.adapter.withEditorState !== mode.withState ||
			window.Layers.Editor.PageOwnedSnapshotAdapter !== mode.adapterClass ) throw unavailable();
		return { record, mode };
	}
	function importCapsule( record, mode ) {
		return clone( record.adapter, { version: 1, draft: envelope( record ), sources: mode.claims.map( value => value.citation ) } );
	}
	function importGuard( transaction, record, mode, epoch, options ) {
		const host = operationOptions( record, options, true ), generation = mode.generation;
		if ( host.publicationAttempt !== undefined && host.publicationAttempt !== null ) throw unavailable();
		const check = () => {
			const currentMode = importMode( transaction );
			if ( currentMode.record !== record || currentMode.mode !== mode || mode.generation !== generation ) throw unavailable();
			current( transaction, record, epoch ); host.check(); current( transaction, record, epoch );
		};
		check(); return { check, pages: host.pages };
	}
	function importContext( record, entry ) {
		const fixed = record.fixed;
		return admit( record, { ...fixed, context: { ...fixed.context, page: entry.page,
			surface: entry.surface, sourceGeometry: entry.sourceGeometry, rendition: entry.rendition } }, entry.page );
	}
	async function readImport( transaction, record, mode, source, check ) {
		check();
		const result = clone( record.adapter, await mode.read.call( mode.reader, {
			target: record.fixed.target, selection: record.fixed.selection, source
		} ) ); check();
		const target = result.targetAdmission, fixed = record.fixed;
		for ( const key of [ 'target', 'selection', 'hasLayersSlot', 'mainText', 'baseText', 'baseBundle' ] ) {
			if ( !equal( target[ key ], fixed[ key ] ) ) throw unavailable();
		}
		if ( target.initialPage !== fixed.context.initialPage || target.pageCount !== fixed.context.pageCount ||
			target.label !== fixed.anchorSurface.label || !equal( target.source, pin( fixed.anchorSurface ) ) ||
			!equal( target.pages[ target.initialPage - 1 ].surface, fixed.anchorSurface ) ) throw unavailable();
		const contexts = new Map();
		for ( const entry of target.pages ) contexts.set( entry.page, importContext( record, entry ) );
		check(); return { result, contexts };
	}
	const importFixed = member => { const value = { ...member }; delete value.canvas; delete value.layers; delete value.readingOrder; return value; };
	function importMembers( record, candidate, contexts, activePage ) {
		const base = record.base, members = new Map(); let previous = 0;
		if ( !candidate || !Array.isArray( candidate.surfaces ) ||
			!equal( { ...candidate, surfaces: [] }, { ...base, surfaces: [] } ) ||
			!equal( candidate.surfaces.slice( 0, base.surfaces.length ), base.surfaces ) ) throw unavailable();
		for ( const member of candidate.surfaces.slice( base.surfaces.length ) ) {
			const page = member && member.source && member.source.page, context = contexts.get( page ), blank = context && context.surface;
			if ( !blank || page <= previous || members.has( page ) || !equal( importFixed( member ), importFixed( blank ) ) ||
				!member.canvas || member.canvas.width !== blank.canvas.width || member.canvas.height !== blank.canvas.height ) throw unavailable();
			previous = page;
			const seeded = { ...blank, layers: member.layers, ...( Object.hasOwn( member, 'readingOrder' ) ? { readingOrder: member.readingOrder } : {} ) };
			const rebuilt = record.adapter.withEditorState( { schemaVersion: 1, surfaces: [ seeded ] }, blank.id,
				{ canvas: member.canvas, layers: member.layers } ).surfaces[ 0 ];
			if ( !equal( rebuilt, member ) ) throw unavailable();
			members.set( page, member );
		}
		if ( !members.has( record.fixed.context.initialPage ) || members.size > record.fixed.context.pageCount || !contexts.has( activePage ) ) throw unavailable();
		return members;
	}
	function importKey( result ) {
		return JSON.stringify( [ result.source.pageId, result.source.revisionId, result.sourceGroup.source.fileTitle,
			nameKey( result.sourceGroup.label ) ] );
	}
	function importSource( record, source ) {
		const value = clone( record.adapter, source );
		if ( !value || !equal( Object.keys( value ).sort(), [ 'owner', 'pageId', 'revisionId', 'surfaceId' ] ) ||
			!positive( value.pageId ) || !positive( value.revisionId ) || value.pageId === record.fixed.target.pageId ||
			typeof value.owner !== 'string' || !value.owner || value.owner === record.fixed.target.owner ||
			typeof value.surfaceId !== 'string' || !value.surfaceId ) throw unavailable();
		return value;
	}
	function importPlan( transaction, handle ) {
		const plan = importPlans.get( handle );
		if ( !plan || plan.owner !== transaction ) throw unavailable();
		plan.check(); return plan;
	}
	async function prepareImportRestore( transaction, input, options ) {
		const { record, mode } = importMode( transaction ), epoch = ++record.epoch;
		const capsule = clone( record.adapter, input ), guard = importGuard( transaction, record, mode, epoch, options ), check = guard.check;
		if ( !capsule || !equal( Object.keys( capsule ).sort(), [ 'draft', 'sources', 'version' ] ) || capsule.version !== 1 ||
			!Array.isArray( capsule.sources ) || capsule.sources.length > 32 ) throw unavailable();
		const draft = capsule.draft;
		if ( !draft || !equal( Object.keys( draft ).sort(), [ 'activePage', 'creation', 'pageCount', 'snapshot', 'version' ] ) ||
			draft.version !== 1 || !equal( draft.creation, identity( record.fixed ) ) ||
			draft.pageCount !== record.fixed.context.pageCount || !positive( draft.activePage ) || draft.activePage > draft.pageCount ) throw unavailable();
		const claims = [], seen = new Set(), reads = []; let contexts = new Map(), targetWitness;
		for ( const citation of capsule.sources ) {
			if ( !citation || !equal( Object.keys( citation ).sort(), [ 'source', 'targetSurfaceId' ] ) ||
				citation.targetSurfaceId !== record.fixed.target.surfaceId ) throw unavailable();
			const source = importSource( record, citation.source ), native = await readImport( transaction, record, mode, source, check );
			if ( targetWitness && !equal( targetWitness, native.result.targetAdmission ) ) throw unavailable();
			targetWitness = native.result.targetAdmission; reads.push( { source, value: native.result } );
			const key = importKey( native.result ); if ( seen.has( key ) ) throw unavailable(); seen.add( key );
			claims.push( { key, citation: clone( record.adapter, citation ) } ); contexts = native.contexts;
		}
		const wanted = new Set( [ draft.activePage, record.fixed.context.initialPage, ...guard.pages ] );
		if ( !draft.snapshot || !Array.isArray( draft.snapshot.surfaces ) ) throw unavailable();
		for ( const member of draft.snapshot.surfaces.slice( record.base.surfaces.length ) ) {
			if ( !member || !member.source || !positive( member.source.page ) ) throw unavailable(); wanted.add( member.source.page );
		}
		for ( const page of wanted ) {
			check(); if ( !contexts.has( page ) ) contexts.set( page, await readPage( transaction, record, page, epoch ) ); check();
		}
		const members = importMembers( record, draft.snapshot, contexts, draft.activePage );
		if ( claims.length && members.size !== draft.pageCount ) throw unavailable();
		for ( const read of reads ) {
			const fresh = await readImport( transaction, record, mode, read.source, check );
			if ( !equal( fresh.result, read.value ) ) throw unavailable();
		}
		const member = members.get( draft.activePage ) || contexts.get( draft.activePage ).surface;
		const stateValue = record.adapter.toEditorState( { schemaVersion: 1, surfaces: [ member ] }, member.id );
		const handle = Object.freeze( {} ); check();
		importPlans.set( handle, { owner: transaction, record, mode, check, members, contexts, page: draft.activePage,
			claims, capsule, state: stateValue, preview: { capsule, contexts: Array.from( contexts.values() ), state: stateValue } } );
		return { handle, preview: clone( record.adapter, { capsule, contexts: Array.from( contexts.values() ), state: stateValue } ) };
	}
	function importPublisherTypes() {
		return typeof module !== 'undefined' && module && typeof module.require === 'function' ?
			require( './PageOwnedMissingPdfImportPublishClient.js' ) : window.Layers.Editor.PageOwnedMissingPdfImportPublishClient;
	}
	function importPublicationRecord( transaction ) {
		const record = data( transaction ), mode = importModes.get( transaction ), publication = importPublications.get( transaction );
		if ( !mode || !mode.active || !publication || mode.reader.read !== mode.read || mode.reader.dispose !== mode.dispose ||
			record.adapter.toEditorState !== mode.toState || record.adapter.withEditorState !== mode.withState ||
			window.Layers.Editor.PageOwnedSnapshotAdapter !== mode.adapterClass ||
			publication.client.publish !== publication.publish || publication.Client.isConfirmationFor !== publication.confirm ) throw unavailable();
		return { record, mode, publication };
	}
	async function validateImportPublicationAttempt( transaction, live, attempt ) {
		if ( attempt === null ) return;
		const { record, mode, check } = live;
		if ( !attempt || !equal( Object.keys( attempt ).sort(), [ 'capsule', 'code', 'dispatchState', 'request', 'revisionId', 'sequence', 'version' ] ) ||
			attempt.version !== 1 || !positive( attempt.sequence ) ||
			![ 'prepared', 'dispatched', 'refused', 'unknown', 'confirmed' ].includes( attempt.dispatchState ) ) throw unavailable();
		const confirmed = attempt.dispatchState === 'confirmed', unknown = attempt.dispatchState === 'unknown';
		if ( confirmed ? !positive( attempt.revisionId ) || attempt.revisionId <= record.fixed.target.revisionId : attempt.revisionId !== null ) throw unavailable();
		if ( unknown ? attempt.code !== 'layers-publication-outcome-unknown' : attempt.dispatchState === 'refused' ?
			!publicationCodes.has( attempt.code ) && ![ 'layers-revision-save-failed', 'layers-draft-storage-failed', 'layers-editor-session-unavailable' ].includes( attempt.code ) :
			attempt.code !== null ) throw unavailable();
		const capsule = attempt.capsule, draft = capsule && capsule.draft;
		if ( !capsule || !equal( Object.keys( capsule ).sort(), [ 'draft', 'sources', 'version' ] ) || capsule.version !== 1 ||
			!Array.isArray( capsule.sources ) || capsule.sources.length < 1 || capsule.sources.length > 32 ||
			!draft || !equal( Object.keys( draft ).sort(), [ 'activePage', 'creation', 'pageCount', 'snapshot', 'version' ] ) ||
			draft.version !== 1 || !equal( draft.creation, identity( record.fixed ) ) || draft.pageCount !== record.fixed.context.pageCount ||
			!positive( draft.activePage ) || draft.activePage > draft.pageCount ) throw unavailable();
		const sources = [], seen = new Set(), reads = []; let contexts, targetWitness;
		for ( const citation of capsule.sources ) {
			if ( !citation || !equal( Object.keys( citation ).sort(), [ 'source', 'targetSurfaceId' ] ) ||
				citation.targetSurfaceId !== record.fixed.target.surfaceId ) throw unavailable();
			const source = importSource( record, citation.source );
			sources.push( { sourcePageId: source.pageId, sourceRevisionId: source.revisionId, sourceSurfaceId: source.surfaceId } );
			const native = await readImport( transaction, record, mode, source, check ), key = importKey( native.result );
			if ( seen.has( key ) || ( targetWitness && !equal( targetWitness, native.result.targetAdmission ) ) ) throw unavailable();
			seen.add( key ); targetWitness = native.result.targetAdmission; reads.push( { source, result: native.result } ); contexts = native.contexts;
		}
		const members = importMembers( record, draft.snapshot, contexts, draft.activePage );
		if ( members.size !== draft.pageCount ) throw unavailable();
		const request = attempt.request;
		if ( !request || typeof request.summary !== 'string' || Array.from( request.summary ).length > 500 ||
			!equal( request, { pageId: record.fixed.target.pageId, baseRevisionId: record.fixed.target.revisionId,
				selection: record.fixed.selection, snapshotJson: JSON.stringify( draft.snapshot ), sources, summary: request.summary } ) ) throw unavailable();
		for ( const read of reads ) {
			const fresh = await readImport( transaction, record, mode, read.source, check );
			if ( !equal( read.result, fresh.result ) ) throw unavailable();
		}
		check();
	}
	function importPublicationRecovery( transaction, handle ) {
		const plan = importPublicationRecoveries.get( handle );
		if ( !plan || plan.owner !== transaction ) throw unavailable();
		plan.live.check();
		const currentMode = importPublicationRecord( transaction );
		if ( currentMode.publication !== plan.publication || currentMode.publication.attempt !== null || currentMode.publication.sequence !== 0 ) throw unavailable();
		return plan;
	}
	class PageOwnedPdfCreationTransaction {
		/** Native preparation and injected native-read/publication transports; never a publication token. */
		constructor( input, dependencies ) {
			const { Adapter, Ids } = classes(), adapter = new Adapter(), fixed = clone( adapter, input );
			const target = fixed && fixed.target, anchor = fixed && fixed.anchorSurface, selection = fixed && fixed.selection;
			if ( !dependencies || !dependencies.reader || typeof dependencies.reader.read !== 'function' ||
				!dependencies.publisher || typeof dependencies.publisher.publish !== 'function' || !target ||
				typeof target.owner !== 'string' || !target.owner || target.owner.trim() !== target.owner ||
				!positive( target.pageId ) || !positive( target.revisionId ) || !anchor || anchor.kind !== 'pdf' ||
				anchor.id !== target.surfaceId || typeof anchor.label !== 'string' || !nameKey( anchor.label ) ||
				!anchor.source || anchor.source.repository !== 'local' || typeof anchor.source.fileTitle !== 'string' ||
				!/^File:[^\s#]+$/.test( anchor.source.fileTitle ) || controls( anchor.source.fileTitle ) ||
				typeof anchor.source.timestamp !== 'string' || !/^\d{14}$/.test( anchor.source.timestamp ) ||
				typeof anchor.source.sha1 !== 'string' || !/^[a-z0-9]{31,40}$/.test( anchor.source.sha1 ) ||
				!selection || !Number.isInteger( selection.start ) || selection.start < 0 || typeof selection.expected !== 'string' ||
				!selection.expected || typeof fixed.mainText !== 'string' || typeof fixed.hasLayersSlot !== 'boolean' ||
				!fixed.context || !positive( fixed.context.initialPage ) || fixed.context.initialPage > fixed.context.pageCount ||
				anchor.id !== Ids.surfaceId( target.pageId, target.revisionId, anchor.source.fileTitle, anchor.label, anchor.source.page ) ||
				!equal( anchor.layers, [] ) ) throw unavailable();
			let base = { schemaVersion: 1, surfaces: [] };
			if ( fixed.hasLayersSlot ) {
				if ( typeof fixed.baseText !== 'string' || !fixed.baseBundle || fixed.baseBundle.revisionId !== target.revisionId ) throw unavailable();
				base = fixed.baseBundle.snapshot;
				if ( !equal( JSON.parse( fixed.baseText ), base ) ) throw unavailable();
			} else if ( fixed.baseText !== null || fixed.baseBundle !== null ) throw unavailable();
			// Validate the real document without inserting a pretend stored anchor.
			adapter.toEditorState( { ...base, surfaces: [ ...base.surfaces, anchor ] }, anchor.id );
			if ( base.surfaces.length + fixed.context.pageCount > 100 || base.surfaces.some( member => member.id === anchor.id ||
				( member.kind !== 'slide' && member.source.fileTitle === anchor.source.fileTitle &&
					nameKey( member.label || '' ) === nameKey( anchor.label ) ) ) ) throw unavailable();
			const record = { adapter, ids: Ids, fixed, base, reader: dependencies.reader, read: dependencies.reader.read,
				publisher: dependencies.publisher, publish: dependencies.publisher.publish,
				phase: 'ready', epoch: 0, pages: new Map(), members: new Map( [ [ anchor.source.page, anchor ] ] ),
				page: fixed.context.page, confirmed: null, attempt: null, sequence: 0 };
			const context = admit( record, fixed, fixed.context.page );
			record.pages.set( context.page, context );
			records.set( this, record );
		}

		/** Explicit model-only opt-in. Host/history/draft/publication callers are deliberately separate. */
		enableImports( api ) {
			const record = data( this, true );
			if ( importModes.has( this ) || record.attempt !== null ) throw unavailable();
			const { Reader, Planner } = importTypes(), reader = new Reader( api );
			if ( window.Layers.Editor.PageOwnedSnapshotAdapter && window.Layers.Editor.PageOwnedSnapshotAdapter !== record.adapter.constructor ) throw unavailable();
			importModes.set( this, { active: true, generation: 0, reader, read: reader.read, dispose: reader.dispose,
				Planner, plan: Planner.prepare, claims: [], toState: record.adapter.toEditorState,
				withState: record.adapter.withEditorState, adapterClass: window.Layers.Editor.PageOwnedSnapshotAdapter } );
			importMode( this );
		}

		getImportCapsule() { const { record, mode } = importMode( this ); return importCapsule( record, mode ); }

		captureImportCheckpoint() {
			const { record, mode } = importMode( this ), handle = Object.freeze( {} );
			importCheckpoints.set( handle, { owner: this, capsule: importCapsule( record, mode ) } ); return handle;
		}

		inspectImportCheckpoint( handle ) {
			const { record } = importMode( this ), value = importCheckpoints.get( handle );
			if ( !value || value.owner !== this ) throw unavailable(); return clone( record.adapter, value.capsule );
		}

		releaseImportCheckpoint( handle ) {
			const value = importCheckpoints.get( handle ); if ( !value || value.owner !== this ) throw unavailable(); importCheckpoints.delete( handle );
		}

		/** Privately prepare all pages and citation changes, then repeat the native source/target read. */
		async prepareImport( input, options ) {
			if ( !input || ![ Object.prototype, null ].includes( Object.getPrototypeOf( input ) ) ) throw unavailable();
			const { record, mode } = importMode( this ), fields = input && Object.getOwnPropertyDescriptors( input );
			if ( !fields || !fields.mode || !Object.hasOwn( fields.mode, 'value' ) ) throw unavailable();
			if ( fields.mode.value === 'cancel' ) return null;
			if ( !equal( Reflect.ownKeys( fields ).sort(), [ 'allocateId', 'maxLayers', 'mode', 'source' ] ) ||
				Object.values( fields ).some( field => !field.enumerable || !Object.hasOwn( field, 'value' ) ) ||
				typeof fields.allocateId.value !== 'function' ) throw unavailable();
			const source = importSource( record, fields.source.value ), epoch = ++record.epoch;
			const { check } = importGuard( this, record, mode, epoch, options );
			const native = await readImport( this, record, mode, source, check );
			const target = snapshot( record ), all = Array.from( native.contexts.values() ).map( context =>
				record.members.get( context.page ) || context.surface );
			const targetSnapshot = { ...target, surfaces: target.surfaces.slice( 0, record.base.surfaces.length ).concat( all ) };
			check();
			const candidate = mode.plan.call( mode.Planner, { targetSnapshot, targetSurfaceId: record.fixed.target.surfaceId,
				sourceSnapshot: native.result.sourceBundle.snapshot, sourceSurfaceId: source.surfaceId, admittedTargetSurfaces: [],
				mode: fields.mode.value, maxLayers: fields.maxLayers.value, allocateId: () => {
					check(); const id = Reflect.apply( fields.allocateId.value, undefined, [] ); check(); return id;
				} } ); check();
			const fresh = await readImport( this, record, mode, source, check );
			if ( !equal( native.result, fresh.result ) ) throw unavailable();
			const members = importMembers( record, candidate.snapshot, fresh.contexts, record.page ), key = importKey( fresh.result );
			const claims = fields.mode.value === 'append' ? clone( record.adapter, mode.claims ) : [];
			if ( !claims.some( value => value.key === key ) ) claims.push( { key,
				citation: { targetSurfaceId: record.fixed.target.surfaceId, source: fresh.result.source } } );
			if ( claims.length > 32 ) throw unavailable();
			const capsule = { version: 1, draft: { ...envelope( record ), snapshot: candidate.snapshot }, sources: claims.map( value => value.citation ) };
			const value = members.get( record.page ), stateValue = record.adapter.toEditorState( { schemaVersion: 1, surfaces: [ value ] }, value.id );
			const preview = { capsule, contexts: Array.from( fresh.contexts.values() ), state: stateValue,
				mode: fields.mode.value, source: fresh.result.source, sourceLabel: fresh.result.sourceGroup.label,
				importedLayerIds: candidate.importedLayerIds, pages: candidate.pages };
			const handle = Object.freeze( {} ); check();
			importPlans.set( handle, { owner: this, record, mode, check, members, contexts: fresh.contexts, page: record.page, claims, capsule, state: stateValue, preview } );
			return { handle, preview: clone( record.adapter, preview ) };
		}

		inspectImportPlan( handle ) { const plan = importPlan( this, handle ); return clone( plan.record.adapter, plan.preview ); }

		prepareImportRestore( handle, options ) {
			const value = importCheckpoints.get( handle );
			if ( !value || value.owner !== this ) return Promise.reject( unavailable() );
			return prepareImportRestore( this, value.capsule, options );
		}

		/** Detached recovery data is reauthorized; it never stands in for an owned live checkpoint. */
		prepareImportRecovery( capsule, options ) { return prepareImportRestore( this, capsule, options ); }

		commitImportPlan( handle, beforeCommit ) {
			const plan = importPlan( this, handle );
			if ( beforeCommit !== undefined && typeof beforeCommit !== 'function' ) throw unavailable();
			const output = clone( plan.record.adapter, plan.state );
			if ( beforeCommit ) { const value = beforeCommit(); if ( value !== undefined ) { Promise.resolve( value ).catch( () => {} ); throw unavailable(); } }
			plan.check();
			// Private data only: no awaits, notifications, setters or external callbacks in this commit.
			plan.record.members = plan.members; plan.record.pages = plan.contexts; plan.record.page = plan.page;
			plan.mode.claims = plan.claims; plan.mode.generation++; plan.record.epoch++; importPlans.delete( handle );
			return output;
		}

		releaseImportPlan( handle ) {
			const plan = importPlans.get( handle ); if ( !plan || plan.owner !== this ) throw unavailable(); importPlans.delete( handle );
		}

		/** Explicit first-Save opt-in. No existing publisher, host or draft caller is changed. */
		enableImportPublication( api ) {
			const { record } = importMode( this );
			if ( importPublications.has( this ) || record.attempt !== null ) throw unavailable();
			const Client = importPublisherTypes(), client = new Client( api );
			importPublications.set( this, { Client, client, publish: client.publish, confirm: Client.isConfirmationFor, sequence: 0, attempt: null } );
		}

		/** Detached complete state for future storage wiring; serialized attempts never grant confirmation. */
		getImportPublicationState() {
			const { record, mode, publication } = importPublicationRecord( this );
			return clone( record.adapter, { version: 1, capsule: importCapsule( record, mode ), attempt: publication.attempt } );
		}

		async saveImport( summary = '', beforePublish, options ) {
			const { record, mode, publication } = importPublicationRecord( this );
			importMode( this );
			if ( typeof summary !== 'string' || Array.from( summary ).length > 500 ||
				( beforePublish !== undefined && typeof beforePublish !== 'function' ) ||
				mode.claims.length < 1 || mode.claims.length > 32 || !positive( publication.sequence + 1 ) ) throw unavailable();
			const host = operationOptions( record, options ); host.check(); importMode( this );
			const capsule = importCapsule( record, mode ), sent = capsule.draft.snapshot;
			const sources = capsule.sources.map( citation => {
				if ( citation.targetSurfaceId !== record.fixed.target.surfaceId ) throw unavailable();
				const source = importSource( record, citation.source );
				return { sourcePageId: source.pageId, sourceRevisionId: source.revisionId, sourceSurfaceId: source.surfaceId };
			} );
			const request = { pageId: record.fixed.target.pageId, baseRevisionId: record.fixed.target.revisionId,
				selection: clone( record.adapter, record.fixed.selection ), snapshotJson: JSON.stringify( sent ), sources, summary };
			publication.attempt = { version: 1, sequence: ++publication.sequence, capsule, request: clone( record.adapter, request ),
				dispatchState: 'prepared', revisionId: null, code: null };
			record.phase = 'saving'; record.epoch++; mode.generation++;
			const generation = mode.generation, claims = clone( record.adapter, mode.claims );
			const check = () => {
				const currentMode = importPublicationRecord( this );
				if ( currentMode.record !== record || currentMode.mode !== mode || currentMode.publication !== publication ||
					record.phase !== 'saving' || mode.generation !== generation || !equal( mode.claims, claims ) ) throw unavailable();
				host.check();
				importPublicationRecord( this );
				if ( record.phase !== 'saving' || mode.generation !== generation || !equal( mode.claims, claims ) ) throw unavailable();
			};
			let dispatched = false;
			try {
				if ( beforePublish ) {
					try { await beforePublish(); }
					catch ( ignored ) { throw Object.assign( new Error( 'layers-draft-storage-failed' ), { code: 'layers-draft-storage-failed' } ); }
				}
				check(); const reads = [];
				for ( const claim of claims ) {
					const native = await readImport( this, record, mode, claim.citation.source, check );
					if ( importKey( native.result ) !== claim.key ) throw unavailable();
					const members = importMembers( record, sent, native.contexts, capsule.draft.activePage );
					if ( members.size !== record.fixed.context.pageCount ) throw unavailable();
					reads.push( native.result );
				}
				for ( let index = 0; index < claims.length; index++ ) {
					const fresh = await readImport( this, record, mode, claims[ index ].citation.source, check );
					if ( !equal( reads[ index ], fresh.result ) ) throw unavailable();
				}
				check(); dispatched = true; publication.attempt.dispatchState = 'dispatched';
				const proof = await publication.publish.call( publication.client, request );
				check();
				if ( !publication.confirm.call( publication.Client, proof, publication.client, request ) ) {
					throw Object.assign( new Error( 'layers-publication-outcome-unknown' ), { code: 'layers-publication-outcome-unknown' } );
				}
				const output = clone( record.adapter, { revisionId: proof.revisionId, snapshot: sent, currentSnapshot: snapshot( record ),
					activePage: record.page, originalCreation: identity( record.fixed ), sourceReferences: capsule.sources } );
				check(); record.confirmed = { revisionId: proof.revisionId, snapshot: sent };
				publication.attempt.dispatchState = 'confirmed'; publication.attempt.revisionId = proof.revisionId;
				record.phase = 'confirmed'; record.epoch++; return output;
			} catch ( error ) {
				const code = dispatched ? ( error && ( publicationCodes.has( error.code ) || error.code === 'layers-revision-save-failed' ) ?
					error.code : 'layers-publication-outcome-unknown' ) :
					error && error.code === 'layers-draft-storage-failed' ? error.code : 'layers-editor-session-unavailable';
				if ( record.phase !== 'disposed' ) record.phase = code === 'layers-edit-conflict' ? 'conflict' :
					code === 'layers-publication-outcome-unknown' ? 'uncertain' : 'ready';
				publication.attempt.dispatchState = code === 'layers-publication-outcome-unknown' ? 'unknown' : 'refused';
				publication.attempt.code = code; throw Object.assign( new Error( code ), { code } );
			}
		}

		/** Prepare an untrusted complete backup against the unchanged native base, without altering work. */
		async prepareImportPublicationRecovery( input, options ) {
			const { record, publication } = importPublicationRecord( this ); importMode( this );
			if ( publication.attempt !== null || publication.sequence !== 0 ) throw unavailable();
			const value = clone( record.adapter, input );
			if ( !value || !equal( Object.keys( value ).sort(), [ 'attempt', 'capsule', 'version' ] ) || value.version !== 1 ) throw unavailable();
			let handle;
			try {
				const prepared = await prepareImportRestore( this, value.capsule, options ); handle = prepared.handle;
				const live = importPlan( this, handle );
				await validateImportPublicationAttempt( this, live, value.attempt ); live.check();
				const token = Object.freeze( {} ), phase = value.attempt === null ? 'ready' : 'uncertain';
				const preview = clone( record.adapter, { publicationState: value, phase, state: live.state,
					contexts: Array.from( live.contexts.values() ), confirmation: null, holdCleared: false } );
				importPublicationRecoveries.set( token, { owner: this, liveHandle: handle, live, publication, value, phase, preview } );
				importPublicationRecovery( this, token ); return { handle: token, preview: clone( record.adapter, preview ) };
			} catch ( error ) { if ( handle ) importPlans.delete( handle ); throw error; }
		}

		inspectImportPublicationRecovery( handle ) {
			const plan = importPublicationRecovery( this, handle ); return clone( plan.live.record.adapter, plan.preview );
		}

		/** Confirmation by the host precedes one synchronous model/attempt/hold transition. No write occurs. */
		commitImportPublicationRecovery( handle, beforeCommit ) {
			const plan = importPublicationRecovery( this, handle ), { live, publication } = plan, { record, mode } = live;
			if ( beforeCommit !== undefined && typeof beforeCommit !== 'function' ) throw unavailable();
			const output = clone( record.adapter, plan.preview ), attempt = clone( record.adapter, plan.value.attempt );
			if ( beforeCommit ) { const result = beforeCommit(); if ( result !== undefined ) { Promise.resolve( result ).catch( () => {} ); throw unavailable(); } }
			importPublicationRecovery( this, handle );
			// Private assignments only: no awaits, notifications, setters or callbacks in the transition.
			record.members = live.members; record.pages = live.contexts; record.page = live.page; mode.claims = live.claims;
			publication.attempt = attempt; publication.sequence = attempt ? attempt.sequence : 0;
			record.confirmed = null; record.phase = plan.phase; mode.generation++; record.epoch++;
			importPlans.delete( plan.liveHandle ); importPublicationRecoveries.delete( handle ); return output;
		}

		releaseImportPublicationRecovery( handle ) {
			const plan = importPublicationRecoveries.get( handle ); if ( !plan || plan.owner !== this ) throw unavailable();
			importPlans.delete( plan.liveHandle ); importPublicationRecoveries.delete( handle );
		}

		getEditorState() { return state( data( this ) ); }
		getDraft() { if ( importModes.has( this ) ) throw unavailable(); const record = data( this ); return clone( record.adapter, envelope( record ) ); }
		getPublicationAttempt() { const record = data( this ); return clone( record.adapter, record.attempt ); }
		getStatus() {
			const record = data( this );
			return { phase: record.phase, page: record.page, pageCount: record.fixed.context.pageCount,
				initialPage: record.fixed.context.initialPage, label: record.fixed.anchorSurface.label,
				baseRevisionId: record.fixed.target.revisionId, confirmedRevisionId: record.confirmed && record.confirmed.revisionId,
				dirty: !record.confirmed || !equal( snapshot( record ), record.confirmed.snapshot ) };
		}

		update( input ) {
			const record = data( this );
			if ( record.phase !== 'ready' && record.phase !== 'saving' && record.phase !== 'conflict' && record.phase !== 'uncertain' &&
				record.phase !== 'confirmed' ) throw unavailable();
			const blank = record.pages.get( record.page ).surface;
			const member = record.members.get( record.page ) || blank;
			const next = record.adapter.withEditorState( { schemaVersion: 1, surfaces: [ member ] }, member.id, input ).surfaces[ 0 ];
			const imports = importModes.get( this );
			if ( imports && imports.claims.length ) { record.members.set( record.page, next ); record.epoch++; return; }
			if ( record.page !== record.fixed.context.initialPage && equal( next, blank ) ) record.members.delete( record.page );
			else record.members.set( record.page, next );
			record.epoch++;
		}

		/** Two phases allow the host to stage the background and complete Undo timeline before mutation. */
		async preparePage( page ) {
			const record = data( this, true ), epoch = ++record.epoch;
			const context = await readPage( this, record, page, epoch );
			const handle = Object.freeze( {} );
			preparations.set( handle, { owner: this, record, epoch, kind: 'page', context } );
			return { handle, context: clone( record.adapter, context ), state: record.adapter.toEditorState(
				{ schemaVersion: 1, surfaces: [ record.members.get( page ) || context.surface ] }, context.surface.id ) };
		}

		commit( handle ) {
			const plan = preparations.get( handle );
			if ( !plan || plan.owner !== this ) throw unavailable();
			preparations.delete( handle );
			current( this, plan.record, plan.epoch );
			const record = plan.record;
			if ( plan.kind === 'page' ) { record.pages.set( plan.context.page, plan.context ); record.page = plan.context.page; }
			else { record.pages = plan.pages; record.members = plan.members; record.page = plan.page;
				if ( plan.publicationAttempt !== undefined ) { record.attempt = plan.publicationAttempt;
					record.sequence = Math.max( record.sequence, record.attempt ? record.attempt.sequence : 0 ); }
			}
			record.epoch++;
			return state( record );
		}

		cancel( handle ) { const plan = preparations.get( handle ); if ( plan && plan.owner === this ) preparations.delete( handle ); }

		/** Same-base recovery only. The host still owns explicit confirmation and per-page Undo validation. */
		async prepareDraft( input, options ) {
			if ( importModes.has( this ) ) throw unavailable();
			const record = data( this, true ), epoch = ++record.epoch, draft = clone( record.adapter, input );
			const host = operationOptions( record, options, true ); host.check(); current( this, record, epoch );
			if ( !draft || !equal( Object.keys( draft ).sort(), [ 'activePage', 'creation', 'pageCount', 'snapshot', 'version' ] ) ||
				draft.version !== 1 || !equal( draft.creation, identity( record.fixed ) ) ||
				draft.pageCount !== record.fixed.context.pageCount || !positive( draft.activePage ) || draft.activePage > draft.pageCount ) throw unavailable();
			const expected = snapshot( record, new Map() ), next = draft.snapshot;
			if ( !next || !Array.isArray( next.surfaces ) ||
				!equal( { ...next, surfaces: [] }, { ...expected, surfaces: [] } ) ||
				!equal( next.surfaces.slice( 0, record.base.surfaces.length ), record.base.surfaces ) ) throw unavailable();
			const members = new Map(), pages = new Map(), wanted = new Set( [ draft.activePage, record.fixed.context.initialPage ] );
			for ( const member of next.surfaces.slice( record.base.surfaces.length ) ) {
				if ( !member || !member.source || members.has( member.source.page ) ) throw unavailable();
				members.set( member.source.page, member ); wanted.add( member.source.page );
			}
			if ( !members.has( record.fixed.context.initialPage ) || members.size > draft.pageCount ) throw unavailable();
			host.pages.forEach( page => wanted.add( page ) );
			if ( host.publicationAttempt !== undefined && host.publicationAttempt !== null ) {
				const sent = host.publicationAttempt.snapshot;
				if ( !sent || !Array.isArray( sent.surfaces ) ) throw unavailable();
				for ( const member of sent.surfaces.slice( record.base.surfaces.length ) ) {
					if ( !member || !member.source ) throw unavailable(); wanted.add( member.source.page );
				}
			}
			for ( const page of wanted ) {
				host.check(); current( this, record, epoch );
				pages.set( page, await readPage( this, record, page, epoch ) );
				host.check(); current( this, record, epoch );
			}
			for ( const [ page, member ] of members ) {
				const blank = pages.get( page ).surface;
				const rebuilt = record.adapter.withEditorState( { schemaVersion: 1, surfaces: [ blank ] }, blank.id,
					{ canvas: member.canvas, layers: member.layers } ).surfaces[ 0 ];
				if ( !equal( member, rebuilt ) ) throw unavailable();
			}
			const handle = Object.freeze( {} );
			const publicationAttempt = host.publicationAttempt === undefined ? undefined : validateAttempt( record, host.publicationAttempt, pages );
			preparations.set( handle, { owner: this, record, epoch, kind: 'draft', pages, members, page: draft.activePage, publicationAttempt } );
			return { handle, draft: clone( record.adapter, draft ), contexts: clone( record.adapter, Array.from( pages.values() ) ) };
		}

		async save( summary = '', beforePublish, options ) {
			if ( importModes.has( this ) ) throw unavailable();
			const record = data( this, true );
			const host = operationOptions( record, options ); host.check(); current( this, record, record.epoch );
			if ( typeof summary !== 'string' || ( beforePublish !== undefined && typeof beforePublish !== 'function' ) ) throw unavailable();
			const sent = clone( record.adapter, snapshot( record ) ), target = record.fixed.target;
			if ( !positive( record.sequence + 1 ) ) throw unavailable();
			record.attempt = { version: 1, sequence: ++record.sequence, baseRevisionId: target.revisionId, snapshot: sent,
				dispatchState: 'prepared', revisionId: null, code: null };
			let publishing = false;
			record.epoch++;
			record.phase = 'saving';
			try {
				if ( beforePublish ) {
					try { await beforePublish(); }
					catch ( error ) { throw Object.assign( new Error( 'layers-draft-storage-failed' ), { code: 'layers-draft-storage-failed' } ); }
				}
				current( this, record, null, 'saving' );
				host.check(); current( this, record, null, 'saving' );
				for ( const member of sent.surfaces.slice( record.base.surfaces.length ) ) {
					await readPage( this, record, member.source.page, null, 'saving' );
					host.check(); current( this, record, null, 'saving' );
				}
				current( this, record, null, 'saving' );
				publishing = true; record.attempt.dispatchState = 'dispatched';
				const result = clone( record.adapter, await record.publish.call( record.publisher, { owner: target.owner, pageId: target.pageId,
					baseRevisionId: target.revisionId, snapshotJson: JSON.stringify( sent ), summary } ) );
				current( this, record, null, 'saving' );
				if ( !result || !positive( result.revisionId ) || result.revisionId <= target.revisionId ) {
					throw Object.assign( new Error( 'layers-publication-outcome-unknown' ), { code: 'layers-publication-outcome-unknown' } );
				}
				record.confirmed = { revisionId: result.revisionId, snapshot: sent };
				record.attempt.dispatchState = 'confirmed'; record.attempt.revisionId = result.revisionId;
				record.phase = 'confirmed'; record.epoch++;
				return clone( record.adapter, { ...record.confirmed, currentSnapshot: snapshot( record ),
					activePage: record.page, originalCreation: identity( record.fixed ) } );
			} catch ( error ) {
				const code = publishing ? ( error && publicationCodes.has( error.code ) ? error.code : 'layers-publication-outcome-unknown' ) :
					error && error.code === 'layers-draft-storage-failed' ? error.code : 'layers-editor-session-unavailable';
				if ( record.phase !== 'disposed' ) record.phase = code === 'layers-edit-conflict' ? 'conflict' :
					code === 'layers-publication-outcome-unknown' ? 'uncertain' : 'ready';
				record.attempt.dispatchState = code === 'layers-publication-outcome-unknown' ? 'unknown' : 'refused'; record.attempt.code = code;
				const description = code === 'layers-invalid-snapshot' && error && Object.getOwnPropertyDescriptor( error, 'message' );
				const message = description && Object.hasOwn( description, 'value' ) && typeof description.value === 'string' &&
					description.value.length <= 300 ? description.value : code;
				throw Object.assign( new Error( message ), { code } );
			}
		}

		/** Explicit point-in-time inspection only: never publishes, changes phase or clears a hold. */
		async inspectPublication( dependencies, options ) {
			const record = data( this ), phase = record.phase, epoch = record.epoch;
			if ( ![ 'ready', 'conflict', 'uncertain', 'confirmed' ].includes( phase ) || !record.attempt ) throw unavailable();
			if ( !dependencies || !equal( Reflect.ownKeys( dependencies ).sort(), [ 'api', 'pdfReader', 'reader' ] ) ||
				Object.values( Object.getOwnPropertyDescriptors( dependencies ) ).some( descriptor => !Object.hasOwn( descriptor, 'value' ) ) ) throw unavailable();
			const host = operationOptions( record, options, true );
			const check = () => { current( this, record, epoch, phase ); host.check(); current( this, record, epoch, phase ); };
			check();
			const Outcome = typeof module !== 'undefined' && module && typeof module.require === 'function' ?
				require( './PageOwnedPdfCreationOutcomeReader.js' ) : window.Layers.Editor.PageOwnedPdfCreationOutcomeReader;
			const outcome = await Outcome.inspect( { draft: envelope( record ), attempt: clone( record.adapter, record.attempt ) },
				{ ...dependencies, creationReader: record.reader }, check, host.pages );
			check(); return clone( record.adapter, outcome );
		}

		/** Fresh inspection prepares an owned, single-use transition; result objects grant no authority. */
		async preparePublicationReconciliation( dependencies, options ) {
			const record = data( this ), phase = record.phase, epoch = record.epoch;
			const host = operationOptions( record, options, true );
			const check = () => { current( this, record, epoch, phase ); host.check(); current( this, record, epoch, phase ); };
			check(); const outcome = await inspectPublication.call( this, dependencies, options ); check();
			const confirmation = outcome.outcome === 'payload-current' ?
				{ revisionId: outcome.revisionId, snapshot: clone( record.adapter, record.attempt.snapshot ) } : null;
			const handle = Object.freeze( {} );
			reconciliations.set( handle, { owner: this, record, check, outcome, confirmation } );
			return { handle, outcome: clone( record.adapter, outcome ), confirmation: clone( record.adapter, confirmation ) };
		}

		/** No await or notifications between validation and transition. Sent-attempt attribution stays unchanged. */
		commitPublicationReconciliation( handle ) {
			const plan = reconciliations.get( handle );
			if ( !plan || plan.owner !== this ) throw unavailable();
			reconciliations.delete( handle ); plan.check();
			const { record, outcome, confirmation } = plan;
			if ( outcome.outcome === 'changed' ) return { ...outcome, applied: false };
			if ( outcome.outcome !== 'base-current' && outcome.outcome !== 'payload-current' ) throw unavailable();
			record.confirmed = confirmation; record.phase = confirmation ? 'confirmed' : 'ready'; record.epoch++;
			return { ...outcome, applied: true, holdCleared: true };
		}

		releasePublicationReconciliation( handle ) {
			const plan = reconciliations.get( handle ); if ( plan && plan.owner === this ) reconciliations.delete( handle );
		}

		dispose() { const mode = importModes.get( this ); if ( mode ) { mode.active = false; mode.generation++; mode.dispose.call( mode.reader ); } const record = records.get( this ); if ( record ) { record.phase = 'disposed'; record.epoch++; } }
	}
	const inspectPublication = PageOwnedPdfCreationTransaction.prototype.inspectPublication;
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationTransaction = PageOwnedPdfCreationTransaction;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationTransaction;
}() );
