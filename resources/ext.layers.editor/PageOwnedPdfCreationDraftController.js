/** Explicit local drafts for the new-PDF host; existing lifecycle/UI callers remain unchanged. */
( function () {
	'use strict';
	const records = new WeakMap(), candidates = new WeakMap();
	const failure = () => Object.assign( new Error( 'layers-draft-storage-failed' ), { code: 'layers-draft-storage-failed' } );
	function canonical( value ) {
		if ( Array.isArray( value ) ) return '[' + value.map( canonical ).join( ',' ) + ']';
		if ( value && typeof value === 'object' ) return '{' + Object.keys( value ).sort()
			.map( key => JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		return JSON.stringify( value );
	}
	function data( controller ) {
		const record = records.get( controller );
		if ( !record || record.disposed || record.store._writerId !== record.writer || record.store._storage !== record.storage ||
			record.store._read !== record.read || record.store._write !== record.write ) throw failure();
		for ( const method of record.methods ) if ( method.object[ method.key ] !== method.value ) throw failure();
		const current = record.host.getDraft().creation.target;
		if ( current.owner !== record.scope.owner || current.revisionId !== record.scope.baseRevisionId || current.surfaceId !== record.scope.surfaceId ||
			current.pageId !== record.pageId ) throw failure();
		return record;
	}
	function readCandidate( record, writer ) {
		record.store.selectRecovery( writer );
		try { return record.store.read( record.scope ); }
		finally { record.store.selectRecovery( record.writer ); }
	}
	function inspect( record, handle ) {
		const candidate = candidates.get( handle );
		if ( !candidate || candidate.record !== record || readCandidate( record, candidate.writer ) !== candidate.raw ) throw failure();
		return candidate;
	}
	class PageOwnedPdfCreationDraftController {
		/** The supplied PageOwnedDraftStore must have its own independent writer ID. */
		constructor( host, store, identity ) {
			if ( !host || !store || !identity || typeof identity.wiki !== 'string' || !identity.wiki ||
				typeof identity.user !== 'string' || !identity.user || !/^[a-f0-9]{32}$/.test( store._writerId ) ) throw failure();
			const target = host.getDraft().creation.target;
			const methods = [ [ host, [ 'getDraft', 'getStatus', 'captureDraftEnvelope', 'prepareDraftRecovery', 'commitDraftRecovery',
				'releaseDraftRecovery', 'blockPublication', 'save' ] ], [ store, [ 'write', 'read', 'listCandidates', 'selectRecovery' ] ] ]
				.flatMap( ( [ object, keys ] ) => keys.map( key => { if ( typeof object[ key ] !== 'function' ) throw failure();
					return { object, key, value: object[ key ] }; } ) );
			records.set( this, { host, store, methods, writer: store._writerId, storage: store._storage, pageId: target.pageId,
				read: store._read, write: store._write,
				scope: { wiki: identity.wiki, user: identity.user, owner: target.owner, baseRevisionId: target.revisionId, surfaceId: target.surfaceId },
				disposed: false, ready: false, reviewing: false, saving: false, cancelled: false, lastOwnedRaw: null } );
		}

		persist() {
			const record = data( this ); if ( !record.ready || record.reviewing || record.cancelled ) throw failure();
			const json = JSON.stringify( { version: 1, scope: record.scope, pdfCreation: record.host.captureDraftEnvelope() } );
			const current = readCandidate( record, record.writer );
			if ( current !== null && current !== record.lastOwnedRaw ) throw failure();
			record.store.write( record.scope, json );
			if ( readCandidate( record, record.writer ) !== json ) throw failure(); record.lastOwnedRaw = json;
			return json;
		}

		listCandidates() {
			const record = data( this );
			return record.store.listCandidates( record.scope ).map( writer => {
				const raw = readCandidate( record, writer ), handle = Object.freeze( {} );
				candidates.set( handle, { record, writer, raw } ); return handle;
			} );
		}

		inspectCandidate( handle ) {
			const record = data( this ), candidate = inspect( record, handle );
			try {
				const envelope = JSON.parse( candidate.raw );
				if ( !envelope || Object.keys( envelope ).length !== 3 || envelope.version !== 1 ||
					canonical( envelope.scope ) !== canonical( record.scope ) || !envelope.pdfCreation ) throw failure();
				return envelope.pdfCreation;
			} catch ( error ) { throw failure(); }
		}

		/** Reuse the approved dialog's choose/confirm interface; neither step grants native authority. */
		async review( ui ) {
			const record = data( this ); if ( record.reviewing || record.saving || !ui || typeof ui.choose !== 'function' || typeof ui.confirm !== 'function' ) throw failure();
			record.reviewing = true; record.ready = false; const plans = [];
			try {
				const handles = this.listCandidates();
				if ( !handles.length ) { record.ready = true; return false; }
				for ( const handle of handles ) {
					try { plans.push( { candidate: handle, ...record.host.prepareDraftRecovery( this.inspectCandidate( handle ) ) } ); }
					catch ( error ) { plans.push( { candidate: handle, handle: null, preview: {} } ); }
				}
				const selected = plans.length === 1 ? 0 : await ui.choose( plans.map( plan => plan.preview ) ); data( this );
				if ( !Number.isInteger( selected ) || selected < 0 || selected >= plans.length ) {
					record.cancelled = true; record.host.blockPublication(); return false;
				}
				const plan = plans[ selected ]; if ( !plan.handle ) throw failure(); inspect( record, plan.candidate );
				const restore = await ui.confirm( plan.preview ); data( this ); inspect( record, plan.candidate );
				if ( !restore ) { record.cancelled = true; record.host.blockPublication(); return false; }
				const restored = await record.host.commitDraftRecovery( plan.handle, () => { data( this ); inspect( record, plan.candidate ); } );
				record.ready = true; return restored;
			} finally {
				plans.forEach( plan => { if ( plan.handle ) record.host.releaseDraftRecovery( plan.handle ); } ); record.reviewing = false;
			}
		}

		async save( summary = '' ) {
			const record = data( this ); if ( !record.ready || record.reviewing || record.saving || record.cancelled ) throw failure();
			record.saving = true; let result;
			try { result = await record.host.save( summary, () => { data( this ); this.persist(); }, () => { data( this ); } ); return result; }
			finally {
				record.saving = false;
				try { this.persist(); if ( result ) result.draftPersisted = true; }
				catch ( error ) { if ( result ) result.draftPersisted = false; }
			}
		}

		/** Disposal never deletes backups or transfers the recovery source's writer ownership. */
		dispose() { const record = records.get( this ); if ( record ) record.disposed = true; }
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationDraftController = PageOwnedPdfCreationDraftController;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationDraftController;
}() );
