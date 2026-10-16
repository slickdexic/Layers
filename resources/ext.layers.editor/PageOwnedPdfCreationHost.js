/** Explicit editor connection for a new page-owned PDF layer set; no callers are activated. */
( function () {
	'use strict';
	const records = new WeakMap(), recoveries = new WeakMap();
	const unavailable = () => Object.assign( new Error( 'layers-editor-session-unavailable' ),
		{ code: 'layers-editor-session-unavailable' } );
	function classes() {
		return typeof module !== 'undefined' && module && typeof module.require === 'function' ? {
			Transaction: require( './PageOwnedPdfCreationTransaction.js' ), Store: require( './StateManager.js' )
		} : { Transaction: window.Layers.Editor.PageOwnedPdfCreationTransaction, Store: window.Layers.Core.StateManager };
	}
	function canonical( value ) {
		if ( Array.isArray( value ) ) return '[' + value.map( canonical ).join( ',' ) + ']';
		if ( value && typeof value === 'object' ) return '{' + Object.keys( value ).sort()
			.map( key => JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		return JSON.stringify( value );
	}
	function alive( record ) {
		const { editor, store, canvas, history, Store } = record;
		if ( record.disposed || record.committing || editor.isDestroyed || editor.stateManager !== store ||
			editor.canvasManager !== canvas || editor.historyManager !== history || editor.config !== record.config ||
			canvas.canvas !== record.element || canvas.config !== record.canvasConfig || canvas.isDestroyed ||
			history.isDestroyed || history.batchMode || !store.isWorkingCopyAlive() || store.isLocked || store._isProcessingPending ||
			store.pendingOperations.length || store.lockingQueue.length || store.lockTimeout !== null || store.lockAutoRecoveryTimeout !== null ) throw unavailable();
		Store.checkWorkingCopyMethods( record.methods );
		history.captureTimeline();
		for ( const participant of [ canvas, canvas.selectionManager, canvas.transformController, canvas.drawingController ].filter( Boolean ) ) {
			for ( const flag of [ 'isDrawing', 'isDragging', 'isResizing', 'isRotating', 'isMarqueeSelecting', 'isPanning' ] ) {
				if ( participant[ flag ] ) throw unavailable();
			}
		}
	}
	function ready( record ) {
		alive( record );
		if ( record.needsRefresh || record.saving || record.transaction.getStatus().phase !== 'ready' ) throw unavailable();
	}
	function data( host, loaded = true ) {
		const record = records.get( host );
		if ( !record || ( loaded && !record.loaded ) ) throw unavailable();
		alive( record );
		return record;
	}
	function live( record ) {
		const state = record.transaction.getEditorState();
		state.layers = record.Store.copyWorkingCopyValue( record.store.get( 'layers' ) );
		for ( const key of [ 'backgroundVisible', 'backgroundOpacity' ] ) {
			const value = record.store.get( key );
			if ( value !== undefined ) state.canvas[ key ] = value;
		}
		return state;
	}
	function capture( record ) {
		alive( record );
		if ( !record.loaded ) throw unavailable();
		const state = live( record );
		if ( canonical( state ) !== canonical( record.transaction.getEditorState() ) ) record.transaction.update( state );
		return state;
	}
	function freshTimeline( record, state ) {
		return record.history.preflightTimeline( {
			history: [ { layers: state.layers, description: 'Initial state', timestamp: Date.now() } ],
			historyIndex: 0, lastSaveHistoryIndex: -1, maxHistorySteps: record.history.maxHistorySteps
		} );
	}
	// Prepare writable data assignments before the final check. No setters or UI callbacks run here.
	function assignments( object, values ) {
		return Object.entries( values ).map( ( [ key, value ] ) => {
			const descriptor = Object.getOwnPropertyDescriptor( object, key );
			if ( descriptor ? !Object.hasOwn( descriptor, 'value' ) || !descriptor.writable :
				!Object.isExtensible( object ) || key in object ) throw unavailable();
			return { object, key, descriptor: { value, ...( descriptor ? {} : { writable: true, enumerable: true, configurable: true } ) } };
		} );
	}
	function guard( record, generation, admission = ready ) {
		admission( record );
		const { Store, editor, store, canvas, history } = record;
		const observations = [ Store.observeWorkingCopyObject( editor, false ), Store.observeWorkingCopyObject( editor.config, false ),
			Store.observeWorkingCopyObject( store, false ), Store.observeWorkingCopyObject( store.state ),
			Store.observeWorkingCopyObject( store.pendingOperations ), Store.observeWorkingCopyObject( store.lockingQueue ),
			Store.observeWorkingCopyObject( history, false ), Store.observeWorkingCopyObject( history.history ),
			Store.observeWorkingCopyObject( history.batchChanges ), Store.observeWorkingCopyObject( canvas.config, false ) ];
		const image = canvas.backgroundImage, selection = canvas.selectionManager, renderer = canvas.renderer;
		const selectionMethods = selection ? [ 'captureWorkingCopyImportSelection', 'prepareWorkingCopyImportSelection' ]
			.map( key => Store.captureWorkingCopyMethod( selection, key ) ) : [];
		if ( selection ) {
			observations.push( Store.observeWorkingCopyObject( selection, false ) );
			if ( selection._selectionState ) observations.push( Store.observeWorkingCopyObject( selection._selectionState ) );
			for ( const value of Object.values( Object.getOwnPropertyDescriptors( selection ) ) ) {
				if ( Array.isArray( value.value ) ) observations.push( Store.observeWorkingCopyObject( value.value ) );
			}
		}
		const version = record.version, url = window.location.href;
		const dimensions = [ canvas.baseWidth, canvas.baseHeight, canvas.canvas.width, canvas.canvas.height ];
		const draft = canonical( record.transaction.getDraft() ), timelines = canonical( Array.from( record.timelines ) );
		const selected = canonical( [ canvas.selectedLayerIds || [], canvas.selectedLayerId || null ] );
		return () => {
			admission( record );
			observations.forEach( Store.checkWorkingCopyObservation );
			Store.checkWorkingCopyMethods( selectionMethods );
			if ( generation !== record.generation || version !== record.version || url !== window.location.href ||
				canvas.backgroundImage !== image || canvas.selectionManager !== selection || canvas.renderer !== renderer ||
				canonical( dimensions ) !== canonical( [ canvas.baseWidth, canvas.baseHeight, canvas.canvas.width, canvas.canvas.height ] ) ||
				canonical( [ canvas.selectedLayerIds || [], canvas.selectedLayerId || null ] ) !== selected ||
				canonical( record.transaction.getDraft() ) !== draft || canonical( Array.from( record.timelines ) ) !== timelines ) throw unavailable();
		};
	}
	function shape( value, keys ) {
		return value && !Array.isArray( value ) && Object.keys( value ).length === keys.length && keys.every( key => Object.hasOwn( value, key ) );
	}
	function recoveryCopy( record, input ) {
		const envelope = record.Store.copyWorkingCopyValue( input ), current = record.transaction.getDraft();
		let publicationAttempt, retainedAttempt = false;
		if ( shape( envelope, [ 'version', 'phase', 'draft', 'history', 'confirmation', 'publicationBlocked', 'publicationAttempt' ] ) && envelope.version === 2 ) {
			publicationAttempt = envelope.publicationAttempt;
			if ( envelope.phase !== 'ready' && publicationAttempt === null ) throw unavailable();
			retainedAttempt = true; delete envelope.publicationAttempt; envelope.version = 1;
		}
		if ( !shape( envelope, [ 'version', 'phase', 'draft', 'history', 'confirmation', 'publicationBlocked' ] ) || envelope.version !== 1 ||
			typeof envelope.publicationBlocked !== 'boolean' ||
			![ 'ready', 'saving', 'conflict', 'uncertain' ].includes( envelope.phase ) || envelope.confirmation !== null ||
			!envelope.draft || canonical( envelope.draft.creation ) !== canonical( current.creation ) ||
			envelope.draft.pageCount !== current.pageCount ) throw unavailable();
		const { draft, history } = envelope;
		if ( !shape( history, [ 'version', 'creation', 'pageCount', 'activePage', 'members' ] ) || history.version !== 1 ||
			canonical( history.creation ) !== canonical( draft.creation ) || history.pageCount !== draft.pageCount ||
			history.activePage !== draft.activePage || !Array.isArray( history.members ) || !history.members.length ||
			history.members.length > draft.pageCount || !draft.snapshot || !Array.isArray( draft.snapshot.surfaces ) ) throw unavailable();
		const pages = new Set(), ids = new Set();
		for ( const member of history.members ) {
			if ( !shape( member, [ 'page', 'surfaceId', 'source', 'timeline' ] ) || !Number.isInteger( member.page ) ||
				member.page < 1 || member.page > draft.pageCount || pages.has( member.page ) || ids.has( member.surfaceId ) ||
				typeof member.surfaceId !== 'string' || !member.source || member.source.page !== member.page ||
				!shape( member.timeline, [ 'history', 'historyIndex', 'lastSaveHistoryIndex', 'maxHistorySteps' ] ) ) throw unavailable();
			member.timeline = record.history.preflightTimeline( member.timeline );
			if ( !member.timeline.history.length || member.timeline.lastSaveHistoryIndex !== -1 ) throw unavailable();
			pages.add( member.page ); ids.add( member.surfaceId );
		}
		if ( !pages.has( draft.activePage ) || !pages.has( draft.creation.anchorSurface.source.page ) ) throw unavailable();
		for ( const surface of draft.snapshot.surfaces.slice( draft.creation.baseBundle ? draft.creation.baseBundle.snapshot.surfaces.length : 0 ) ) {
			if ( !surface.source || !pages.has( surface.source.page ) ) throw unavailable();
		}
		if ( retainedAttempt && publicationAttempt !== null ) {
			const sent = publicationAttempt && publicationAttempt.snapshot;
			if ( !sent || !Array.isArray( sent.surfaces ) ) throw unavailable();
			for ( const member of sent.surfaces.slice( draft.creation.baseBundle ? draft.creation.baseBundle.snapshot.surfaces.length : 0 ) ) {
				if ( !member || !member.source || !pages.has( member.source.page ) ) throw unavailable();
			}
		}
		return retainedAttempt ? { ...envelope, publicationAttempt } : envelope;
	}
	function publicationGuard( record ) {
		const { editor, canvas } = record, page = editor.page, count = editor.pageCount, url = window.location.href;
		const image = canvas.backgroundImage, imageUrl = canvas.config.backgroundImageUrl, editorImageUrl = editor.config.imageUrl;
		const dimensions = [ canvas.baseWidth, canvas.baseHeight, canvas.canvas.width, canvas.canvas.height ];
		return () => {
			alive( record );
			if ( record.needsRefresh || editor.page !== page || editor.pageCount !== count || window.location.href !== url ||
				canvas.backgroundImage !== image || canvas.config.backgroundImageUrl !== imageUrl || editor.config.imageUrl !== editorImageUrl ||
				canonical( dimensions ) !== canonical( [ canvas.baseWidth, canvas.baseHeight, canvas.canvas.width, canvas.canvas.height ] ) ) throw unavailable();
			capture( record );
		};
	}
	function invalidate( record ) {
		record.generation++;
		if ( record.operation ) {
			if ( record.operation.handle ) record.transaction.cancel( record.operation.handle );
			if ( record.operation.stage ) record.operation.stage.dispose();
			record.operation = null;
		}
	}
	async function navigate( host, page, initial ) {
		let record, operation, patch, committed = false;
		try {
			record = data( host, !initial );
			ready( record );
			if ( record.recovering || ( initial && ( record.loaded || record.version !== 0 ) ) ) throw unavailable();
			invalidate( record );
			if ( !initial ) capture( record );
			operation = { generation: record.generation, handle: null, stage: null };
			record.operation = operation;
			const previous = record.transaction.getStatus().page;
			const timeline = record.history.captureTimeline(), check = guard( record, operation.generation );
			const prepared = await record.transaction.preparePage( page );
			operation.handle = prepared.handle;
			check();
			const { context, state } = prepared, { canvas, history, store, editor, Store } = record;
			const stage = canvas.stageExactBackground( context.rendition.url );
			operation.stage = stage;
			await stage.promise;
			check();
			canvas.preflightStagedBackground( stage );
			if ( stage.url !== context.rendition.url || stage.info.width !== context.rendition.width ||
				stage.info.height !== context.rendition.height ) throw unavailable();
			const target = history.preflightTimeline( !initial && page === previous ? timeline :
				record.timelines.get( page ) || freshTimeline( record, state ) );
			if ( canonical( target.history[ target.historyIndex ].layers ) !== canonical( state.layers ) ||
				target.lastSaveHistoryIndex !== -1 ) throw unavailable();
			const selection = canvas.selectionManager && canvas.selectionManager.prepareWorkingCopyImportSelection( state.layers, [] );
			patch = store.prepareWorkingCopyPatch( { values: { layers: state.layers, isSlide: false, isDirty: true,
				selectedLayerIds: [], baseWidth: state.canvas.width, baseHeight: state.canvas.height,
				backgroundVisible: state.canvas.backgroundVisible, backgroundOpacity: state.canvas.backgroundOpacity }, clear: [] } );
			const stateCommit = store.prepareWorkingCopyPatchCommit( patch );
			if ( !Store.isWorkingCopyPatchCommit( stateCommit ) ) throw unavailable();
			const writes = [ ...assignments( history, target ),
				...assignments( canvas, { baseWidth: state.canvas.width, baseHeight: state.canvas.height, selectedLayerIds: [], selectedLayerId: null } ),
				...assignments( editor, { page, pageCount: context.pageCount } ),
				...assignments( editor.config, { imageUrl: context.rendition.url } ) ];
			check();
			if ( selection ) selection.preflight();
			stateCommit.preflight();
			canvas.preflightStagedBackground( stage );
			check();
			// No await or notification between the final witness and these model/state/history assignments.
			record.transaction.commit( prepared.handle );
			stateCommit.commit();
			for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor );
			if ( selection ) selection.commit();
			if ( !initial ) record.timelines.set( previous, timeline );
			record.timelines.set( page, target );
			record.contexts.set( page, context );
			record.loaded = true;
			committed = true;
			record.committing = true;
			try {
				canvas.commitStagedBackground( stage );
				store.notifyWorkingCopyPatch( patch );
				if ( selection ) selection.refresh();
				history.updateUndoRedoButtons();
				editor.syncPageInUrl( page );
				editor.refreshPageControls();
			} finally { record.committing = false; }
			// A listener may have edited the newly visible page. Preserve that work as well.
			capture( record );
			return true;
		} catch ( error ) {
			if ( record && committed ) record.needsRefresh = true;
			if ( record && !record.disposed && operation && operation.generation === record.generation ) {
				try { record.notify.call( record.editor, page ); } catch ( notificationError ) { /* Retain work if notification fails. */ }
			}
			return false;
		} finally {
			if ( record && patch ) record.store.releaseWorkingCopyPatch( patch );
			if ( operation ) {
				if ( operation.handle ) record.transaction.cancel( operation.handle );
				if ( operation.stage ) operation.stage.dispose();
				if ( record.operation === operation ) record.operation = null;
			}
		}
	}
	class PageOwnedPdfCreationHost {
		constructor( editor, nativePreparation, dependencies ) {
			const { Transaction, Store } = classes(), transaction = new Transaction( nativePreparation, dependencies );
			const store = editor.stateManager, canvas = editor.canvasManager, history = editor.historyManager;
			const entries = [ [ store, [ 'get', 'set', 'subscribe', 'isWorkingCopyAlive', 'prepareWorkingCopyPatch',
				'prepareWorkingCopyPatchCommit', 'notifyWorkingCopyPatch', 'releaseWorkingCopyPatch' ] ],
			[ history, [ 'captureTimeline', 'copyTimeline', 'preflightTimeline', 'updateUndoRedoButtons' ] ],
			[ canvas, [ 'stageExactBackground', 'preflightStagedBackground', 'commitStagedBackground' ] ],
			[ editor, [ 'syncPageInUrl', 'refreshPageControls', 'notifyPdfPageNavigationFailure' ] ] ];
			const record = { editor, store, canvas, history, Store, transaction, config: editor.config,
				canvasConfig: canvas.config, element: canvas.canvas, disposed: false, loaded: false, committing: false,
				version: 0, generation: 0, operation: null, needsRefresh: false, saving: false, recovering: false,
				publicationBlocked: false, blockedPhase: null, reviewBlocked: false, confirmation: null, timelines: new Map(), contexts: new Map(), unsubscribers: [],
				methods: entries.flatMap( ( [ object, keys ] ) => keys.map( key => Store.captureWorkingCopyMethod( object, key ) ) ),
				notify: editor.notifyPdfPageNavigationFailure };
			alive( record );
			if ( !Array.isArray( store.get( 'layers' ) ) || store.get( 'layers' ).length || store.get( 'isDirty' ) ||
				history.captureTimeline().history.some( step => step.layers.length ) ) throw unavailable();
			const anchor = transaction.getDraft().creation.anchorSurface;
			record.timelines.set( anchor.source.page, freshTimeline( record, { layers: [] } ) );
			record.contexts.set( anchor.source.page, { surface: anchor } );
			records.set( this, record );
			for ( const key of [ 'layers', 'backgroundVisible', 'backgroundOpacity', 'selectedLayerIds', 'baseWidth', 'baseHeight' ] ) {
				record.unsubscribers.push( store.subscribe( key, () => {
					if ( !record.committing && !record.disposed ) {
						record.version++;
						if ( record.loaded ) {
							let dirty = true;
							try { capture( record ); dirty = record.transaction.getStatus().dirty; } catch ( error ) { /* Keep invalid newer editor work visible. */ }
							store.set( 'isDirty', dirty );
						}
					}
				} ) );
			}
		}

		load() { const record = data( this, false ); return navigate( this, record.transaction.getStatus().page, true ); }
		turn( page ) { return navigate( this, page, false ); }
		capture() { return capture( data( this ) ); }
		getLiveState() { return live( data( this ) ); }
		getStatus() { const record = data( this, false ); if ( record.loaded ) capture( record );
			return { ...record.transaction.getStatus(), loaded: record.loaded, needsRefresh: record.needsRefresh,
				publicationBlocked: record.publicationBlocked, saving: record.saving, recovering: record.recovering }; }
		getDraft() { const record = data( this ); capture( record ); return record.transaction.getDraft(); }

		/** Isolated per-page timelines; capture itself does not restore or publish anything. */
		captureDraftHistory() {
			const record = data( this ); capture( record );
			const draft = record.transaction.getDraft(), timelines = new Map( record.timelines );
			timelines.set( draft.activePage, record.history.captureTimeline() );
			if ( !timelines.has( draft.creation.anchorSurface.source.page ) ) {
				timelines.set( draft.creation.anchorSurface.source.page, freshTimeline( record, { layers: [] } ) );
			}
			return record.Store.copyWorkingCopyValue( { version: 1, creation: draft.creation, pageCount: draft.pageCount,
				activePage: draft.activePage, members: Array.from( timelines, ( [ page, timeline ] ) => {
					const member = record.contexts.has( page ) ? record.contexts.get( page ).surface : draft.creation.anchorSurface;
					return { page, surfaceId: member.id, source: member.source, timeline: record.history.copyTimeline( timeline ) };
				} ).sort( ( left, right ) => left.page - right.page ) } );
		}

		captureDraftEnvelope( options ) {
			const record = data( this ); capture( record );
			const retained = options !== undefined;
			if ( retained && ( record.blockedPhase || record.transaction.getStatus().phase ) !== 'ready' &&
				record.transaction.getPublicationAttempt() === null ) throw unavailable();
			if ( retained && ( !shape( options, [ 'publicationAttempt' ] ) ||
				!Object.hasOwn( Object.getOwnPropertyDescriptor( options, 'publicationAttempt' ), 'value' ) || options.publicationAttempt !== true ) ) throw unavailable();
			return record.Store.copyWorkingCopyValue( { version: 1, phase: record.blockedPhase || record.transaction.getStatus().phase,
				draft: record.transaction.getDraft(), history: this.captureDraftHistory(), confirmation: record.confirmation,
				publicationBlocked: record.publicationBlocked, ...( retained ? { version: 2, publicationAttempt: record.transaction.getPublicationAttempt() } : {} ) } );
		}

		/** Prepare only local review; the caller must obtain explicit Restore before committing this handle. */
		prepareDraftRecovery( input ) {
			const record = data( this ); ready( record ); if ( record.recovering ) throw unavailable();
			capture( record ); const envelope = recoveryCopy( record, input );
			if ( record.operation ) invalidate( record ); const check = guard( record, record.generation ), handle = Object.freeze( {} );
			recoveries.set( handle, { host: this, record, envelope, check, generation: record.generation } );
			const active = envelope.draft.snapshot.surfaces.find( member => member.id ===
				envelope.history.members.find( member => member.page === envelope.draft.activePage ).surfaceId );
			const timeline = envelope.history.members.find( member => member.page === envelope.draft.activePage ).timeline;
			return { handle, preview: record.Store.copyWorkingCopyValue( { label: envelope.draft.creation.anchorSurface.label,
				publicationBlocked: envelope.publicationBlocked || envelope.phase !== 'ready', editorState: { canvas: active ? active.canvas : {},
					layers: timeline.history[ timeline.historyIndex ].layers } } ) };
		}

		releaseDraftRecovery( handle ) { const plan = recoveries.get( handle ); if ( plan && plan.host === this ) recoveries.delete( handle ); }

		async commitDraftRecovery( handle, beforeCommit ) {
			const plan = recoveries.get( handle ); if ( !plan || plan.host !== this ) throw unavailable();
			const { record, envelope } = plan; plan.check();
			if ( record.recovering || ( beforeCommit !== undefined && typeof beforeCommit !== 'function' ) ) throw unavailable();
			recoveries.delete( handle ); record.recovering = true;
			const operation = { generation: plan.generation, handle: null, stage: null }; record.operation = operation;
			let patch, committed = false;
			const check = () => { plan.check(); if ( record.operation !== operation ) throw unavailable();
				if ( beforeCommit && beforeCommit() !== undefined ) throw unavailable(); plan.check(); };
			try {
				const prepared = await record.transaction.prepareDraft( envelope.draft, {
					pages: envelope.history.members.map( member => member.page ), guard: check,
					...( Object.hasOwn( envelope, 'publicationAttempt' ) ? { publicationAttempt: envelope.publicationAttempt } : {} )
				} ); operation.handle = prepared.handle; check();
				const contexts = new Map( prepared.contexts.map( context => [ context.page, context ] ) ), timelines = new Map();
				for ( const member of envelope.history.members ) {
					const context = contexts.get( member.page ), surface = prepared.draft.snapshot.surfaces.find( value => value.id === member.surfaceId );
					if ( !context || context.surface.id !== member.surfaceId || canonical( context.surface.source ) !== canonical( member.source ) ||
						canonical( member.timeline.history[ member.timeline.historyIndex ].layers ) !== canonical( surface ? surface.layers : [] ) ) throw unavailable();
					timelines.set( member.page, record.history.preflightTimeline( member.timeline ) );
				}
				const context = contexts.get( prepared.draft.activePage ), surface = prepared.draft.snapshot.surfaces.find( value => value.id === context.surface.id ) || context.surface;
				const state = { canvas: surface.canvas, layers: surface.layers }, { canvas, store, history, editor, Store } = record;
				const stage = canvas.stageExactBackground( context.rendition.url ); operation.stage = stage;
				await stage.promise; check(); canvas.preflightStagedBackground( stage );
				if ( stage.url !== context.rendition.url || stage.info.width !== context.rendition.width || stage.info.height !== context.rendition.height ) throw unavailable();
				const selection = canvas.selectionManager && canvas.selectionManager.prepareWorkingCopyImportSelection( state.layers, [] );
				patch = store.prepareWorkingCopyPatch( { values: { layers: state.layers, isSlide: false, isDirty: true, selectedLayerIds: [],
					baseWidth: state.canvas.width, baseHeight: state.canvas.height, backgroundVisible: state.canvas.backgroundVisible,
					backgroundOpacity: state.canvas.backgroundOpacity }, clear: [] } );
				const stateCommit = store.prepareWorkingCopyPatchCommit( patch ); if ( !Store.isWorkingCopyPatchCommit( stateCommit ) ) throw unavailable();
				const writes = [ ...assignments( history, timelines.get( context.page ) ),
					...assignments( canvas, { baseWidth: state.canvas.width, baseHeight: state.canvas.height, selectedLayerIds: [], selectedLayerId: null } ),
					...assignments( editor, { page: context.page, pageCount: context.pageCount } ), ...assignments( editor.config, { imageUrl: context.rendition.url } ) ];
				if ( selection ) selection.preflight(); stateCommit.preflight(); canvas.preflightStagedBackground( stage ); check();
				record.transaction.commit( prepared.handle ); stateCommit.commit();
				for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor );
				if ( selection ) selection.commit();
				record.timelines = timelines; record.contexts = contexts;
				record.publicationBlocked = record.publicationBlocked || envelope.publicationBlocked || envelope.phase !== 'ready';
				record.blockedPhase = record.publicationBlocked ? record.blockedPhase || ( envelope.phase === 'ready' ? 'uncertain' : envelope.phase ) : null;
				// Older envelopes cannot distinguish cancellation from uncertainty. Never clear an ambiguous persisted hold.
				record.reviewBlocked = record.reviewBlocked || envelope.publicationBlocked; committed = true;
				record.committing = true;
				try {
					canvas.commitStagedBackground( stage ); store.notifyWorkingCopyPatch( patch ); if ( selection ) selection.refresh();
					history.updateUndoRedoButtons(); editor.syncPageInUrl( context.page ); editor.refreshPageControls();
				} finally { record.committing = false; }
				capture( record ); return true;
			} catch ( error ) { if ( committed ) record.needsRefresh = true; throw unavailable(); }
			finally {
				if ( patch ) record.store.releaseWorkingCopyPatch( patch ); if ( operation.handle ) record.transaction.cancel( operation.handle );
				if ( operation.stage ) operation.stage.dispose(); if ( record.operation === operation ) record.operation = null; record.recovering = false;
			}
		}

		/** Explicit read-only outcome inspection; preserves current work and every publication/recovery hold. */
		async inspectPublication( dependencies, ownerGuard ) {
			const record = data( this );
			const admit = value => { alive( value ); if ( value.needsRefresh || value.saving ||
				![ 'ready', 'conflict', 'uncertain', 'confirmed' ].includes( value.transaction.getStatus().phase ) ) throw unavailable(); };
			admit( record ); if ( record.recovering || ( ownerGuard !== undefined && typeof ownerGuard !== 'function' ) ) throw unavailable();
			invalidate( record ); capture( record ); record.recovering = true;
			try {
				const participants = guard( record, record.generation, admit ), history = this.captureDraftHistory();
				const check = () => { participants(); if ( ownerGuard ) {
					const result = ownerGuard(); if ( result !== undefined ) { Promise.resolve( result ).catch( () => {} ); throw unavailable(); }
				} participants(); };
				const outcome = await record.transaction.inspectPublication( dependencies, { guard: check, pages: history.members.map( member => member.page ) } );
				check(); return outcome;
			} finally { record.recovering = false; }
		}

		/** Explicit opt-in only. verifyBackup must synchronously prove durable, independent pre-check bytes. */
		async reconcilePublication( dependencies, verifyBackup ) {
			const record = data( this );
			const admit = value => {
				alive( value ); const phase = value.transaction.getStatus().phase;
				if ( value.needsRefresh || value.saving || value.reviewBlocked ||
					!( [ 'conflict', 'uncertain' ].includes( phase ) || ( phase === 'ready' && value.publicationBlocked ) ) ) throw unavailable();
			};
			admit( record ); if ( record.recovering || typeof verifyBackup !== 'function' ) throw unavailable();
			invalidate( record ); capture( record ); record.recovering = true;
			let prepared, patch;
			try {
				const participants = guard( record, record.generation, admit ), history = this.captureDraftHistory();
				const hold = canonical( [ record.publicationBlocked, record.blockedPhase, record.reviewBlocked, record.confirmation ] );
				const check = () => {
					participants(); if ( canonical( [ record.publicationBlocked, record.blockedPhase, record.reviewBlocked, record.confirmation ] ) !== hold ) throw unavailable();
					const result = verifyBackup(); if ( result !== undefined ) { Promise.resolve( result ).catch( () => {} ); throw unavailable(); } participants();
					if ( canonical( [ record.publicationBlocked, record.blockedPhase, record.reviewBlocked, record.confirmation ] ) !== hold ) throw unavailable();
				};
				check(); prepared = await record.transaction.preparePublicationReconciliation( dependencies,
					{ guard: check, pages: history.members.map( member => member.page ) } ); check();
				if ( prepared.outcome.outcome === 'changed' ) return { ...prepared.outcome, applied: false, needsRefresh: false };
				const timelines = new Map(), active = record.transaction.getStatus().page;
				const anchor = record.transaction.getDraft().creation.anchorSurface, confirmation = prepared.confirmation;
				for ( const member of history.members ) {
					const timeline = record.history.copyTimeline( member.timeline );
					if ( confirmation ) {
						timeline.lastSaveHistoryIndex = -1;
						const sent = confirmation.snapshot.surfaces.find( surface => surface.kind === 'pdf' && surface.label === anchor.label &&
							surface.source.fileTitle === anchor.source.fileTitle && surface.source.page === member.page );
						if ( sent ) for ( let index = timeline.history.length - 1; index >= 0; index-- ) {
							if ( canonical( timeline.history[ index ].layers ) === canonical( sent.layers ) ) { timeline.lastSaveHistoryIndex = index; break; }
						}
					}
					timelines.set( member.page, record.history.preflightTimeline( timeline ) );
				}
				const dirty = !confirmation || canonical( record.transaction.getDraft().snapshot ) !== canonical( confirmation.snapshot );
				patch = record.store.prepareWorkingCopyPatch( { values: { isDirty: dirty }, clear: [] } );
				const stateCommit = record.store.prepareWorkingCopyPatchCommit( patch );
				if ( !record.Store.isWorkingCopyPatchCommit( stateCommit ) ) throw unavailable();
				const writes = confirmation ? assignments( record.history, timelines.get( active ) ) : [];
				stateCommit.preflight(); check();
				// Final model/backup guard precedes all changes. No await, setters or notifications intervene.
				const result = record.transaction.commitPublicationReconciliation( prepared.handle );
				stateCommit.commit(); for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor );
				if ( confirmation ) record.timelines = timelines;
				record.confirmation = confirmation; record.publicationBlocked = false; record.blockedPhase = null;
				try {
					record.committing = true; record.store.notifyWorkingCopyPatch( patch ); record.history.updateUndoRedoButtons();
				} catch ( error ) { record.needsRefresh = true; }
				finally { record.committing = false; }
				return { ...result, needsRefresh: record.needsRefresh };
			} finally {
				if ( prepared ) record.transaction.releasePublicationReconciliation( prepared.handle );
				if ( patch ) record.store.releaseWorkingCopyPatch( patch ); record.recovering = false;
			}
		}

		blockPublication() { const record = data( this ); record.reviewBlocked = true; record.publicationBlocked = true; record.blockedPhase = 'uncertain'; }

		/** Explicit first Save only. A confirmed result still requires fresh saved-session handoff. */
		async save( summary = '', beforePublish, checkOwner ) {
			const record = data( this ); ready( record );
			if ( record.recovering || record.publicationBlocked || typeof summary !== 'string' || typeof beforePublish !== 'function' ||
				( checkOwner !== undefined && typeof checkOwner !== 'function' ) ) throw unavailable();
			invalidate( record ); capture( record ); const participants = publicationGuard( record );
			const check = () => { participants(); if ( checkOwner && checkOwner() !== undefined ) throw unavailable(); participants(); };
			record.saving = true;
			let result;
			try {
				result = await record.transaction.save( summary, beforePublish, { guard: check } );
				record.confirmation = record.Store.copyWorkingCopyValue( { revisionId: result.revisionId, snapshot: result.snapshot } );
				check();
				const timelines = new Map( record.timelines ), active = record.transaction.getStatus().page;
				timelines.set( active, record.history.captureTimeline() );
				const anchor = result.originalCreation.anchorSurface;
				for ( const [ page, previous ] of timelines ) {
					const timeline = record.history.copyTimeline( previous ); timeline.lastSaveHistoryIndex = -1;
					const member = result.snapshot.surfaces.find( surface => surface.kind === 'pdf' && surface.label === anchor.label &&
						surface.source.fileTitle === anchor.source.fileTitle && surface.source.page === page );
					if ( member ) for ( let index = timeline.history.length - 1; index >= 0; index-- ) {
						if ( canonical( timeline.history[ index ].layers ) === canonical( member.layers ) ) { timeline.lastSaveHistoryIndex = index; break; }
					}
					timelines.set( page, record.history.preflightTimeline( timeline ) );
				}
				const writes = assignments( record.history, timelines.get( active ) ); check();
				for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor ); record.timelines = timelines;
				record.store.set( 'isDirty', record.transaction.getStatus().dirty ); record.history.updateUndoRedoButtons();
				return { ...result, currentSnapshot: record.transaction.getDraft().snapshot, hostReady: true, history: this.captureDraftHistory() };
			} catch ( error ) {
				if ( result ) { record.needsRefresh = true; return { ...result, hostReady: false }; }
				throw error;
			} finally {
				record.saving = false;
				if ( !record.disposed ) {
					try { capture( record ); record.store.set( 'isDirty', record.transaction.getStatus().dirty ); } catch ( error ) { /* Retain newer invalid work. */ }
				}
			}
		}

		/** Inactive confirmed-first-Save handoff; callers must retain the returned bridge and backup. */
		async handoffSavedSession( dependencies ) {
			const record = data( this );
			const admit = value => {
				alive( value );
				if ( value.needsRefresh || value.saving || value.publicationBlocked || !value.confirmation ||
					value.transaction.getStatus().phase !== 'confirmed' ) throw unavailable();
			};
			admit( record ); if ( record.recovering ) throw unavailable();
			invalidate( record ); capture( record ); record.recovering = true;
			let check;
			const common = typeof module !== 'undefined' && module && typeof module.require === 'function';
			const Saved = common ? require( './PageOwnedPdfCreationSavedSession.js' ) : window.Layers.Editor.PageOwnedPdfCreationSavedSession;
			const Bridge = common ? require( './PageOwnedEditorBridge.js' ) : window.Layers.Editor.PageOwnedEditorBridge;
			const Coordinator = common ? require( './PageOwnedPdfEditorCoordinator.js' ) : window.Layers.Editor.PageOwnedPdfEditorCoordinator;
			let prepared, patch, stage, committed = false;
			try {
				check = guard( record, record.generation, admit );
				prepared = await Saved.prepare( this.captureDraftEnvelope(), dependencies, check, Array.from( record.contexts.values() ) ); check();
				const { session, state, context, timelines } = prepared, { editor, canvas, store, history, Store } = record;
				for ( const [ page, value ] of timelines ) timelines.set( page, history.preflightTimeline( value ) );
				// Creation preserves finite layer values, including unknown null fields. Do not apply legacy clearing here.
				const bridge = new ( class extends Bridge {
					getLiveState() {
						this._requireActive(); if ( !this.loaded || !store.isWorkingCopyAlive() ) throw unavailable();
						const value = session.getEditorState(); value.layers = Store.copyWorkingCopyValue( store.get( 'layers' ) );
						for ( const key of [ 'backgroundVisible', 'backgroundOpacity' ] ) {
							if ( store.get( key ) !== undefined ) value.canvas[ key ] = store.get( key );
						}
						return value;
					}
				} )( editor, session ), coordinator = new Coordinator( bridge, dependencies.pdfReader );
				bridge.isSlide = false; bridge.loaded = true; bridge.pdfCoordinator = coordinator; coordinator.timelines = timelines;
				stage = canvas.stageExactBackground( context.rendition.url );
				await stage.promise; check(); canvas.preflightStagedBackground( stage );
				if ( stage.url !== context.rendition.url || stage.info.width !== context.rendition.width || stage.info.height !== context.rendition.height ) throw unavailable();
				await prepared.revalidate(); check();
				patch = store.prepareWorkingCopyPatch( { values: { layers: state.layers, isSlide: false, isDirty: session.getStatus().dirty,
					baseWidth: state.canvas.width, baseHeight: state.canvas.height, backgroundVisible: state.canvas.backgroundVisible,
					backgroundOpacity: state.canvas.backgroundOpacity }, clear: [] } );
				const stateCommit = store.prepareWorkingCopyPatchCommit( patch ); if ( !Store.isWorkingCopyPatchCommit( stateCommit ) ) throw unavailable();
				const writes = [ ...assignments( history, timelines.get( context.page ) ),
					...assignments( canvas, { baseWidth: state.canvas.width, baseHeight: state.canvas.height } ),
					...assignments( editor, { page: context.page, pageCount: context.pageCount } ),
					...assignments( editor.config, { imageUrl: context.rendition.url } ) ];
				stateCommit.preflight(); canvas.preflightStagedBackground( stage ); check();
				// Both models are private until this synchronous ownership transfer. No callbacks run between assignments.
				prepared.activate(); stateCommit.commit(); for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor );
				record.disposed = true; committed = true;
				const result = { bridge, coordinator, creationBackup: prepared.creationBackup, remapping: prepared.remapping, needsRefresh: false };
				try {
					record.unsubscribers.forEach( unsubscribe => unsubscribe() ); record.transaction.dispose();
					coordinator.initialize(); canvas.commitStagedBackground( stage ); store.notifyWorkingCopyPatch( patch );
					history.updateUndoRedoButtons(); editor.syncPageInUrl( context.page ); editor.refreshPageControls();
					bridge.capture(); store.set( 'isDirty', session.getStatus().dirty );
				} catch ( error ) { result.needsRefresh = true; session.blockPublication(); }
				return result;
			} catch ( error ) { if ( prepared && !committed ) prepared.session.dispose(); throw unavailable(); }
			finally { if ( patch ) record.store.releaseWorkingCopyPatch( patch ); if ( stage ) stage.dispose(); record.recovering = false; }
		}

		invalidate() { invalidate( data( this, false ) ); }
		dispose() {
			const record = records.get( this );
			if ( record && !record.disposed ) {
				invalidate( record ); record.disposed = true;
				record.unsubscribers.forEach( unsubscribe => unsubscribe() );
				record.transaction.dispose();
			}
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationHost = PageOwnedPdfCreationHost;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationHost;
}() );
