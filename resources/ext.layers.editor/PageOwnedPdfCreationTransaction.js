/** Explicit first-Save model for a missing PDF layer set. No callers are activated here. */
( function () {
	'use strict';
	const records = new WeakMap(), preparations = new WeakMap(), reconciliations = new WeakMap();
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

		getEditorState() { return state( data( this ) ); }
		getDraft() { const record = data( this ); return clone( record.adapter, envelope( record ) ); }
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

		dispose() { const record = records.get( this ); if ( record ) { record.phase = 'disposed'; record.epoch++; } }
	}
	const inspectPublication = PageOwnedPdfCreationTransaction.prototype.inspectPublication;
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationTransaction = PageOwnedPdfCreationTransaction;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationTransaction;
}() );
