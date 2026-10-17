/** Inactive lifecycle for a missing PDF layer set. Existing editor/UI callers remain unchanged. */
( function () {
	'use strict';
	const records = new WeakMap(), closes = new WeakMap(), discards = new WeakMap();
	const keys = [ 'layers', 'backgroundVisible', 'backgroundOpacity' ];
	const unavailable = () => Object.assign( new Error( 'layers-editor-session-unavailable' ), { code: 'layers-editor-session-unavailable' } );
	function classes() {
		return typeof module !== 'undefined' && module && typeof module.require === 'function' ? {
			Host: require( './PageOwnedPdfCreationHost.js' ), Controller: require( './PageOwnedPdfCreationDraftController.js' )
		} : { Host: window.Layers.Editor.PageOwnedPdfCreationHost, Controller: window.Layers.Editor.PageOwnedPdfCreationDraftController };
	}
	function data( lifecycle, ready = false ) {
		const record = records.get( lifecycle );
		if ( !record || record.disposed || record.finalized || record.transferred || ( ready && !record.ready ) ||
			record.editor.isDestroyed || record.editor.stateManager !== record.state ||
			record.exitStore._writerId !== record.exitWriter || record.exitStore._storage !== record.exitStorage ||
			!record.Host.ownsEditor( record.host, record.editor ) || !record.Controller.ownsHost( record.controller, record.host ) ) throw unavailable();
		for ( const binding of record.methods ) if ( binding.object[ binding.key ] !== binding.value ) throw unavailable();
		return record;
	}
	function notify( record, key ) {
		try { record.notifications[ key ].call( record.ui ); } catch ( error ) { /* Notification failure cannot erase known work or outcomes. */ }
	}
	function detach( record ) {
		clearTimeout( record.timer ); record.timer = null;
		for ( const unsubscribe of record.unsubscribers ) { try { unsubscribe(); } catch ( error ) {} }
		record.unsubscribers = []; window.removeEventListener( 'pagehide', record.onPageHide, true );
	}
	function idle( record ) {
		if ( record.operation ) throw unavailable();
		const status = record.controller.getLifecycleStatus();
		if ( !status.ready || status.cancelled || status.reviewing || status.saving || status.checking ) throw unavailable();
	}
	function clean( record ) {
		idle( record ); const status = record.host.getStatus();
		if ( status.phase !== 'confirmed' || status.dirty || status.needsRefresh || status.saving || status.recovering || status.publicationBlocked ||
			!Number.isInteger( status.confirmedRevisionId ) || status.confirmedRevisionId <= 0 ) throw unavailable();
		return status;
	}
	class PageOwnedPdfCreationLifecycle {
		/** Independent exitStore is mandatory. The caller still owns destruction, navigation and installation after handoff. */
		constructor( editor, host, controller, exitStore, ui ) {
			const { Host, Controller } = classes();
			if ( !Host.ownsEditor( host, editor ) || !Controller.ownsHost( controller, host ) || !exitStore || !ui ) throw unavailable();
			controller.validateExitStore( exitStore );
			const notifications = {}, entries = [ [ host, [ 'getStatus', 'getDraft', 'captureExitEnvelope', 'witnessLifecycleExit', 'handoffSavedSession' ] ],
				[ controller, [ 'getLifecycleStatus', 'validateExitStore', 'review', 'persist', 'preserveForExit', 'save', 'reconcilePublication', 'dispose' ] ],
				[ exitStore, [ 'read', 'write', 'selectRecovery', '_read', '_write', '_validateAndBuildKey', '_recordKey' ] ],
				[ editor.stateManager, [ 'subscribe' ] ], [ ui, [ 'choose', 'confirm', 'notifyFailure', 'notifyBlocked' ] ] ];
			const methods = entries.flatMap( ( [ object, names ] ) => names.map( key => {
				if ( typeof object[ key ] !== 'function' ) throw unavailable(); return { object, key, value: object[ key ] };
			} ) );
			for ( const key of [ 'notifyFailure', 'notifyBlocked' ] ) notifications[ key ] = ui[ key ];
			const target = host.getDraft().creation.target;
			const record = { Host, Controller, editor, host, controller, exitStore, ui, methods, notifications,
				state: editor.stateManager, owner: target.owner, exitWriter: exitStore._writerId, exitStorage: exitStore._storage,
				ready: false, initialized: false,
				disposed: false, finalized: false, transferred: false, epoch: 0, operation: null, pendingFlush: false,
				timer: null, unsubscribers: [], onPageHide: null };
			// Capture phase runs before the bootstrap's editor-destruction listener, even when it was registered first.
			record.onPageHide = () => this.dispose( true ); records.set( this, record );
		}

		getStatus() {
			const record = records.get( this ); if ( !record ) throw unavailable();
			return { ready: record.ready, operation: record.operation, disposed: record.disposed, finalized: record.finalized, transferred: record.transferred };
		}

		/** Native host loading precedes this explicit recovery review. Nothing is published here. */
		async initialize() {
			const record = data( this ); if ( record.initialized || record.operation ) throw unavailable();
			record.initialized = true; record.operation = 'review'; record.epoch++;
			const check = () => { data( this ); if ( record.operation !== 'review' ) throw unavailable(); };
			// Register before any async review so pagehide also preserves edits made while a dialog is pending.
			window.addEventListener( 'pagehide', record.onPageHide, true );
			try {
				await record.controller.review( {
					choose: async previews => { check(); const result = await record.ui.choose( previews ); check(); return result; },
					confirm: async preview => { check(); const result = await record.ui.confirm( preview ); check(); return result; }
				} ); check();
				const status = record.controller.getLifecycleStatus();
				if ( !status.ready || status.cancelled ) { notify( record, 'notifyBlocked' ); return false; }
				record.ready = true;
				for ( const key of keys ) record.unsubscribers.push( record.state.subscribe( key, () => {
					if ( record.disposed || record.finalized || record.transferred ) return;
					clearTimeout( record.timer ); record.timer = setTimeout( () => this.flush(), 1000 );
				} ) );
			} finally { record.operation = null; }
			this.flush(); return true;
		}

		/** Complete host draft/history, using the active writer only after review permits it. */
		flush() {
			const record = records.get( this ); if ( !record ) return false;
			clearTimeout( record.timer ); record.timer = null;
			if ( !record.ready || record.disposed || record.finalized || record.transferred ) return false;
			if ( record.operation && record.operation !== 'save' ) { record.pendingFlush = true; return false; }
			try { data( this, true ); record.controller.persist(); record.pendingFlush = false; return true; }
			catch ( error ) { notify( record, 'notifyFailure' ); return false; }
		}

		async save( summary = '' ) {
			const record = data( this, true ); idle( record ); record.operation = 'save'; record.epoch++;
			try {
				const result = await record.controller.save( summary );
				if ( result.draftPersisted === false ) notify( record, 'notifyFailure' );
				// A known native result stays known even if pagehide disposed this lifecycle during the response.
				return result;
			} finally { record.operation = null; if ( record.pendingFlush ) this.flush(); }
		}

		/** Caller supplies fresh native dependencies and a fresh independent checkpoint; never retries Save. */
		async reconcile( dependencies, checkpointStore ) {
			const record = data( this, true ); idle( record );
			if ( !checkpointStore || checkpointStore === record.exitStore || checkpointStore._writerId === record.exitStore._writerId ) throw unavailable();
			record.operation = 'check'; record.epoch++;
			try {
				const result = await record.controller.reconcilePublication( dependencies, checkpointStore );
				if ( result.draftPersisted === false ) notify( record, 'notifyFailure' ); return result;
			} finally { record.operation = null; if ( record.pendingFlush ) this.flush(); }
		}

		/** Return fresh saved ownership to the caller. No installation, Close or redirect is implicit. */
		async handoffSavedSession( dependencies, installSavedOwner ) {
			const record = data( this, true ); idle( record ); record.operation = 'handoff'; record.epoch++;
			let result;
			try {
				const proof = record.controller.preserveForExit( record.exitStore ); proof.preflight();
				result = await record.host.handoffSavedSession( dependencies, () => {
					data( this, true ); if ( record.operation !== 'handoff' ) throw unavailable(); proof.preflight();
				}, installSavedOwner );
				record.transferred = true; record.ready = false; detach( record ); record.controller.dispose();
				return { ...result, exitBackup: proof.raw };
			} finally { record.operation = null; if ( !result && record.pendingFlush ) this.flush(); }
		}

		/** Only a clean, known confirmed creation qualifies. Explicit Discard remains with the existing caller. */
		prepareCleanClose() {
			const record = data( this, true ), status = clean( record );
			const proof = record.controller.preserveForExit( record.exitStore ); proof.preflight();
			const witness = record.host.witnessLifecycleExit(), handle = Object.freeze( {} );
			const target = { owner: record.owner, revisionId: status.confirmedRevisionId };
			closes.set( handle, { owner: this, record, epoch: record.epoch, witness, proof, target } );
			return { handle, returnTarget: { ...target }, backupPreserved: true };
		}

		commitCleanClose( handle ) {
			const plan = closes.get( handle ); if ( !plan || plan.owner !== this ) throw unavailable(); closes.delete( handle );
			const record = data( this, true ); clean( record );
			if ( plan.record !== record || plan.epoch !== record.epoch ) throw unavailable(); plan.witness(); plan.proof.preflight(); plan.witness();
			record.finalized = true; record.ready = false; record.epoch++; detach( record ); record.controller.dispose();
			return { closed: true, returnTarget: { ...plan.target }, backupPreserved: true };
		}

		releaseCleanClose( handle ) { const plan = closes.get( handle ); if ( plan && plan.owner === this ) closes.delete( handle ); }

		/** Caller obtains explicit Discard first. Unresolved sent evidence is never retirement authority. */
		prepareDiscard( options ) {
			const property = options && Object.getOwnPropertyDescriptor( options, 'reviewCancelled' );
			if ( options !== undefined && ( !property || !Object.hasOwn( property, 'value' ) || property.value !== true || Reflect.ownKeys( options ).length !== 1 ) ) throw unavailable();
			const reviewCancelled = options !== undefined, record = data( this, !reviewCancelled );
			if ( reviewCancelled ) {
				const status = record.controller.getLifecycleStatus();
				if ( record.operation || !status.cancelled || status.ready || status.reviewing || status.saving || status.checking ) throw unavailable();
			} else idle( record );
			const status = record.host.getStatus(), envelope = record.host.captureExitEnvelope(), attempt = envelope.publicationAttempt;
			if ( status.saving || status.recovering || status.needsRefresh || ( status.publicationBlocked && !reviewCancelled ) ||
				![ 'ready', 'conflict', 'confirmed' ].includes( status.phase ) ||
				( reviewCancelled && attempt ) ||
				( attempt && ![ 'refused', 'confirmed' ].includes( attempt.dispatchState ) ) ) throw unavailable();
			const bindings = [ 'prepareOwnedDiscard', 'commitOwnedDiscard', 'releaseOwnedDiscard' ].map( key => {
				if ( typeof record.controller[ key ] !== 'function' ) throw unavailable(); return { key, value: record.controller[ key ] };
			} );
			const owned = record.controller.prepareOwnedDiscard( record.exitStore, options ), witness = record.host.witnessLifecycleExit();
			const handle = Object.freeze( {} ), target = { owner: record.owner, revisionId: status.confirmedRevisionId || status.baseRevisionId };
			discards.set( handle, { owner: this, record, epoch: record.epoch, owned, witness, bindings, target, reviewCancelled } );
			return { handle, returnTarget: { ...target } };
		}

		/** Private single-use handle; a late edit or storage callback refuses Close and rolls retirement back. */
		commitDiscard( handle ) {
			const plan = discards.get( handle ); if ( !plan || plan.owner !== this ) throw unavailable(); discards.delete( handle );
			const check = () => {
				const record = records.get( this );
				if ( record !== plan.record || record.disposed || record.finalized || record.transferred || ( !record.ready && !plan.reviewCancelled ) ||
					record.operation || record.epoch !== plan.epoch || record.editor.isDestroyed || record.editor.stateManager !== record.state ||
					plan.bindings.some( binding => record.controller[ binding.key ] !== binding.value ) ) throw unavailable();
				for ( const binding of record.methods ) if ( binding.object[ binding.key ] !== binding.value ) throw unavailable();
				plan.witness();
			};
			try { check(); plan.record.controller.commitOwnedDiscard( plan.owned, check ); }
			finally { plan.record.controller.releaseOwnedDiscard( plan.owned ); }
			const record = plan.record; record.finalized = true; record.ready = false; record.epoch++; detach( record );
			return { closed: true, discarded: true, returnTarget: { ...plan.target } };
		}

		releaseDiscard( handle ) {
			const plan = discards.get( handle );
			if ( plan && plan.owner === this ) { discards.delete( handle ); plan.record.controller.releaseOwnedDiscard( plan.owned ); }
		}

		/** Terminal cleanup preserves an independent copy before controller disposal; caller still owns editor destruction. */
		dispose( terminal = false ) {
			const record = records.get( this ); if ( !record ) return false;
			if ( typeof terminal !== 'boolean' ) return false;
			if ( record.disposed || record.finalized || record.transferred ) return true;
			let persisted = false;
			try { data( this ); record.controller.preserveForExit( record.exitStore ).preflight(); persisted = true; }
			catch ( error ) { notify( record, 'notifyFailure' ); }
			if ( !persisted && !terminal ) return false;
			record.disposed = true; record.ready = false; record.epoch++; detach( record ); record.controller.dispose();
			return persisted;
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationLifecycle = PageOwnedPdfCreationLifecycle;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationLifecycle;
}() );
