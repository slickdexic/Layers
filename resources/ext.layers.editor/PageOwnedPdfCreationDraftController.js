/** Explicit local drafts for the new-PDF host; existing lifecycle/UI callers remain unchanged. */
( function () {
	'use strict';
	const records = new WeakMap(), candidates = new WeakMap(), exitStores = new WeakMap();
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
		/** Lifecycle callers must use this actual controller with its original host and attempt retention. */
		static ownsHost( controller, host ) {
			try { const record = data( controller ); return record.host === host && record.retainAttempt; } catch ( error ) { return false; }
		}

		getLifecycleStatus() {
			const record = data( this );
			return { ready: record.ready, reviewing: record.reviewing, saving: record.saving, checking: record.checking, cancelled: record.cancelled };
		}

		/** The supplied PageOwnedDraftStore must have its own independent writer ID. */
		constructor( host, store, identity, options ) {
			if ( !host || !store || !identity || typeof identity.wiki !== 'string' || !identity.wiki ||
				typeof identity.user !== 'string' || !identity.user || !/^[a-f0-9]{32}$/.test( store._writerId ) ) throw failure();
			const target = host.getDraft().creation.target;
			let retainAttempt = false;
			if ( options !== undefined ) {
				const property = options && Object.getOwnPropertyDescriptor( options, 'retainPublicationAttempt' );
				if ( !options || Reflect.ownKeys( options ).length !== 1 || !property || !Object.hasOwn( property, 'value' ) || property.value !== true ) throw failure();
				retainAttempt = true;
			}
			const methods = [ [ host, [ 'getDraft', 'getStatus', 'captureDraftEnvelope', 'prepareDraftRecovery', 'commitDraftRecovery',
				'releaseDraftRecovery', 'blockPublication', 'save' ] ], [ store, [ 'write', 'read', 'listCandidates', 'selectRecovery' ] ] ]
				.flatMap( ( [ object, keys ] ) => keys.map( key => { if ( typeof object[ key ] !== 'function' ) throw failure();
					return { object, key, value: object[ key ] }; } ) );
			records.set( this, { host, store, methods, writer: store._writerId, storage: store._storage, pageId: target.pageId,
				read: store._read, write: store._write,
				scope: { wiki: identity.wiki, user: identity.user, owner: target.owner, baseRevisionId: target.revisionId, surfaceId: target.surfaceId },
				retainAttempt, disposed: false, ready: false, reviewing: false, saving: false, checking: false, cancelled: false, lastOwnedRaw: null } );
		}

		persist() {
			const record = data( this ); if ( !record.ready || record.reviewing || record.checking || record.cancelled ) throw failure();
			const json = JSON.stringify( { version: 1, scope: record.scope, pdfCreation: record.retainAttempt ? record.host.captureDraftEnvelope( { publicationAttempt: true } ) : record.host.captureDraftEnvelope() } );
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
					canonical( envelope.scope ) !== canonical( record.scope ) || !envelope.pdfCreation ||
					( envelope.pdfCreation.version === 2 && !record.retainAttempt ) ) throw failure();
				return envelope.pdfCreation;
			} catch ( error ) { throw failure(); }
		}

		/** Reuse the approved dialog's choose/confirm interface; neither step grants native authority. */
		async review( ui ) {
			const record = data( this ); if ( record.reviewing || record.saving || record.checking || !ui || typeof ui.choose !== 'function' || typeof ui.confirm !== 'function' ) throw failure();
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
			const record = data( this ); if ( !record.ready || record.reviewing || record.saving || record.checking || record.cancelled ) throw failure();
			record.saving = true; let result;
			try { result = await record.host.save( summary, () => { data( this ); this.persist(); }, () => { data( this ); } ); return result; }
			finally {
				record.saving = false;
				try { this.persist(); if ( result ) result.draftPersisted = true; }
				catch ( error ) { if ( result ) result.draftPersisted = false; }
			}
		}

		/** Inactive explicit check. A caller supplies a fresh independent store to retain the exact pre-check backup. */
		async reconcilePublication( dependencies, checkpointStore ) {
			const record = data( this ), host = record.host, reconcile = host.reconcilePublication;
			if ( !record.retainAttempt || !record.ready || record.reviewing || record.saving || record.checking || record.cancelled ||
				typeof reconcile !== 'function' || !checkpointStore || checkpointStore === record.store ||
				checkpointStore._storage !== record.storage || !/^[a-f0-9]{32}$/.test( checkpointStore._writerId ) ||
				checkpointStore._writerId === record.writer ) throw failure();
			const writer = checkpointStore._writerId, storage = checkpointStore._storage;
			const bindings = [ 'read', 'write', 'selectRecovery', '_read', '_write', '_validateAndBuildKey', '_recordKey' ]
				.map( key => { if ( typeof checkpointStore[ key ] !== 'function' ) throw failure(); return { key, value: checkpointStore[ key ] }; } );
			const checkpointRead = () => {
				if ( checkpointStore._writerId !== writer || checkpointStore._storage !== storage ||
					bindings.some( binding => checkpointStore[ binding.key ] !== binding.value ) ) throw failure();
				checkpointStore.selectRecovery( writer ); return checkpointStore.read( record.scope );
			};
			if ( checkpointRead() !== null ) throw failure();
			const raw = this.persist(); checkpointStore.write( record.scope, raw );
			const check = () => {
				data( this ); if ( record.cancelled || record.reviewing || record.saving || !record.ready || host.reconcilePublication !== reconcile ||
					readCandidate( record, record.writer ) !== raw || checkpointRead() !== raw ||
					JSON.stringify( { version: 1, scope: record.scope, pdfCreation: host.captureDraftEnvelope( { publicationAttempt: true } ) } ) !== raw ) throw failure();
				data( this );
			};
			check(); record.checking = true; let result;
			try { result = await reconcile.call( host, dependencies, check ); return result; }
			finally {
				record.checking = false;
				if ( result && result.applied ) {
					try { this.persist(); result.draftPersisted = true; } catch ( error ) { result.draftPersisted = false; }
				}
			}
		}

		/** Validate the separate destination before installing a lifecycle or offering recovery; creates no candidate. */
		validateExitStore( store ) {
			const record = data( this ), owned = store && exitStores.get( store );
			if ( !record.retainAttempt || !store || store === record.store || store._storage !== record.storage ||
				!/^[a-f0-9]{32}$/.test( store._writerId ) || store._writerId === record.writer ||
				( owned && ( owned.record !== record || owned.writer !== store._writerId || owned.storage !== store._storage ||
					owned.methods.some( binding => store[ binding.key ] !== binding.value ) ) ) ) throw failure();
			store.selectRecovery( store._writerId ); if ( store.read( record.scope ) !== ( owned ? owned.raw : null ) ) throw failure();
		}

		/** Independent exit copy, including pending review/check/Save. Never rewrites the live or recovery writer. */
		preserveForExit( store ) {
			const record = data( this );
			if ( !record.retainAttempt || !store || store === record.store || store._storage !== record.storage ||
				!/^[a-f0-9]{32}$/.test( store._writerId ) || store._writerId === record.writer ) throw failure();
			let owned = exitStores.get( store );
			if ( !owned ) {
				owned = { record, writer: store._writerId, storage: store._storage, raw: null,
					methods: [ 'read', 'write', 'selectRecovery', '_read', '_write', '_validateAndBuildKey', '_recordKey' ].map( key => {
						if ( typeof store[ key ] !== 'function' ) throw failure(); return { key, value: store[ key ] };
					} ) };
			}
			const check = () => {
				data( this ); if ( owned.record !== record || store._writerId !== owned.writer || store._storage !== owned.storage ||
					owned.methods.some( method => store[ method.key ] !== method.value ) ) throw failure();
			};
			const read = () => { check(); store.selectRecovery( owned.writer ); return store.read( record.scope ); };
			if ( read() !== owned.raw ) throw failure(); exitStores.set( store, owned );
			const capture = () => JSON.stringify( { version: 1, scope: record.scope, pdfCreation: record.host.captureExitEnvelope() } );
			const raw = capture(), witness = record.host.witnessLifecycleExit();
			store.write( record.scope, raw ); if ( read() !== raw ) throw failure(); owned.raw = raw;
			witness(); check(); if ( capture() !== raw ) throw failure();
			return Object.freeze( { raw, preflight: () => { check(); if ( read() !== raw ) throw failure(); } } );
		}

		/** Disposal never deletes backups or transfers the recovery source's writer ownership. */
		dispose() { const record = records.get( this ); if ( record ) record.disposed = true; }
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationDraftController = PageOwnedPdfCreationDraftController;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationDraftController;
}() );
