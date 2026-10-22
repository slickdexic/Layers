/** Explicit editor connection for a new page-owned PDF layer set; no callers are activated. */
( function () {
	'use strict';
	const records = new WeakMap(), recoveries = new WeakMap(), imports = new WeakMap();
	const historyCertificates = new WeakMap();
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
	function modelDraft( record ) {
		return record.imports ? record.transaction.getImportPublicationState().capsule.draft : record.transaction.getDraft();
	}
	function attempt( record ) {
		return record.imports ? record.transaction.getImportPublicationState().attempt : record.transaction.getPublicationAttempt();
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
	function groupMarker( entry ) {
		if ( !entry || !Object.hasOwn( entry, 'pdfImportGroup' ) ) return null;
		const value = entry.pdfImportGroup;
		if ( !shape( value, [ 'id', 'page' ] ) || typeof value.id !== 'string' || !/^[a-f0-9]{32}$/.test( value.id ) ||
			!Number.isInteger( value.page ) || value.page < 1 ) throw unavailable();
		return value;
	}
	function effectiveTimelines( record ) {
		const timelines = new Map( record.timelines );
		timelines.set( record.transaction.getStatus().page, record.history.captureTimeline() ); return timelines;
	}
	function groupLocation( group, timeline, page ) {
		const found = timeline.history.flatMap( ( entry, index ) => {
			const marker = groupMarker( entry ); return marker && marker.id === group.id ? [ { entry, index, page: marker.page } ] : [];
		} );
		const original = group.entries.find( value => value.page === page );
		if ( found.length !== 1 || !original || found[ 0 ].page !== page ||
			canonical( found[ 0 ].entry ) !== canonical( original.entry ) ) throw unavailable();
		return found[ 0 ].index;
	}
	function allowsGroupTimeline( record, timeline, page = record.transaction.getStatus().page, bank = record.importHistory ) {
		try {
			for ( const entry of timeline.history ) {
				const marker = groupMarker( entry ); if ( !marker ) continue;
				const group = bank && bank.get( marker.id );
				if ( !group || marker.page !== page ) return false;
				const index = groupLocation( group, timeline, page );
				if ( ( timeline.historyIndex >= index ) !== ( group.phase === 'after' ) ) return false;
			}
			if ( bank === record.importHistory ) for ( const group of bank.values() ) {
				if ( !group.entries.some( row => row.page === page ) || timeline.history.some( entry => {
					const marker = groupMarker( entry ); return marker && marker.id === group.id;
				} ) ) continue;
				// Only an already-owned branch can establish an official trim or clear.
				const actual = effectiveTimelines( record ).get( page );
				if ( actual && canonical( { ...timeline, historyIndex: actual.historyIndex } ) !== canonical( actual ) ) return false;
			}
			return true;
		} catch ( error ) { return false; }
	}
	function groupTimelines( record, group, undo ) {
		ready( record );
		if ( record.operation || record.recovering || record.publicationBlocked || group.phase !== ( undo ? 'after' : 'before' ) ) throw unavailable();
		const timelines = effectiveTimelines( record );
		const current = record.transaction.getImportPublicationState().capsule, expected = group[ undo ? 'after' : 'before' ];
		if ( !expected || canonical( current.sources ) !== canonical( expected.sources ) ) throw unavailable();
		for ( const row of group.entries ) {
			const context = record.contexts.get( row.page ); if ( !context ) throw unavailable();
			const actualMember = current.draft.snapshot.surfaces.find( member => member.id === context.surface.id ) || context.surface;
			const expectedMember = expected.draft.snapshot.surfaces.find( member => member.id === context.surface.id ) || context.surface;
			if ( canonical( actualMember ) !== canonical( expectedMember ) ) throw unavailable();
			const timeline = record.history.copyTimeline( timelines.get( row.page ) ), index = groupLocation( group, timeline, row.page );
			if ( index < 1 || timeline.historyIndex !== index - ( undo ? 0 : 1 ) ||
				canonical( timeline.history[ index - 1 ] ) !== canonical( row.previous ) ) throw unavailable();
			timeline.historyIndex += undo ? -1 : 1; timelines.set( row.page, timeline );
		}
		return timelines;
	}
	async function restoreGroup( host, group, undo ) {
		const record = data( host ); let prepared, patch, committed = false;
		try {
			capture( record ); const timelines = groupTimelines( record, group, undo );
			const participants = guard( record, record.generation );
			const check = () => { participants(); groupTimelines( record, group, undo ); };
			const capsule = record.Store.copyWorkingCopyValue( group[ undo ? 'before' : 'after' ] );
			capsule.draft.activePage = record.transaction.getStatus().page;
			prepared = await record.transaction.prepareImportRecovery( capsule, { guard: check, pages: Array.from( timelines.keys() ) } );
			check(); const { state } = prepared.preview, { store, history, canvas, Store } = record;
			const context = prepared.preview.contexts.find( value => value.page === capsule.draft.activePage );
			if ( !context || context.rendition.url !== record.editor.config.imageUrl ||
				state.canvas.width !== canvas.baseWidth || state.canvas.height !== canvas.baseHeight ) throw unavailable();
			const selection = canvas.selectionManager && canvas.selectionManager.prepareWorkingCopyImportSelection( state.layers, [] );
			const values = { layers: state.layers, isDirty: true, selectedLayerIds: [] }, clear = [];
			for ( const key of [ 'backgroundVisible', 'backgroundOpacity' ] ) {
				if ( Object.hasOwn( state.canvas, key ) ) values[ key ] = state.canvas[ key ]; else clear.push( key );
			}
			patch = store.prepareWorkingCopyPatch( { values, clear } );
			const commit = store.prepareWorkingCopyPatchCommit( patch ); if ( !Store.isWorkingCopyPatchCommit( commit ) ) throw unavailable();
			const writes = [ ...assignments( history, timelines.get( capsule.draft.activePage ) ),
				...assignments( canvas, { selectedLayerIds: [], selectedLayerId: null } ) ];
			const preflight = () => { check(); commit.preflight(); if ( selection ) selection.preflight(); check(); };
			preflight(); record.transaction.commitImportPlan( prepared.handle, preflight ); prepared = null;
			commit.commit(); for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor );
			if ( selection ) selection.commit(); record.timelines = timelines;
			group.phase = undo ? 'before' : 'after'; record.version++; committed = true; record.committing = true;
			try { store.notifyWorkingCopyPatch( patch ); if ( selection ) selection.refresh(); }
			finally { record.committing = false; }
			capture( record ); history.updateUndoRedoButtons(); return true;
		} catch ( error ) { if ( committed ) record.needsRefresh = true; return committed; }
		finally { if ( prepared ) record.transaction.releaseImportPlan( prepared.handle ); if ( patch ) record.store.releaseWorkingCopyPatch( patch ); }
	}
	function groupStep( host, undo, query ) {
		try {
			const record = data( host ), history = record.history, next = history.historyIndex + ( undo ? -1 : 1 );
			const marker = groupMarker( history.history[ undo ? history.historyIndex : next ] );
			if ( marker ) {
				const group = record.importHistory.get( marker.id ); if ( !group ) return false;
				groupTimelines( record, group, undo ); return query ? true : restoreGroup( host, group, undo );
			}
			if ( next >= 0 && next < history.history.length && !allowsGroupTimeline( record, { ...history.captureTimeline(), historyIndex: next } ) ) return false;
			return null;
		} catch ( error ) { return false; }
	}
	function retireGroups( record ) {
		if ( record.committing || record.disposed || record.recovering || record.saving ) return;
		try {
			const timelines = effectiveTimelines( record );
			for ( const [ id ] of record.importHistory ) {
				if ( !Array.from( timelines.values() ).some( timeline => timeline.history.some( entry => {
					const marker = groupMarker( entry ); return marker && marker.id === id;
				} ) ) ) record.importHistory.delete( id );
			}
		} catch ( error ) { /* Invalid surviving markers remain refusal barriers. */ }
	}
	function importHistoryCopy( record, input, timelines ) {
		if ( !shape( input, [ 'version', 'groups' ] ) || input.version !== 1 || !Array.isArray( input.groups ) ) throw unavailable();
		const bank = new Map();
		for ( const group of input.groups ) {
			if ( !shape( group, [ 'id', 'phase', 'before', 'after', 'entries' ] ) || typeof group.id !== 'string' || !/^[a-f0-9]{32}$/.test( group.id ) ||
				bank.has( group.id ) || ![ 'before', 'after' ].includes( group.phase ) || !Array.isArray( group.entries ) ||
				group.entries.length !== modelDraft( record ).pageCount ) throw unavailable();
			const pages = new Set();
			for ( const row of group.entries ) {
				if ( !shape( row, [ 'page', 'entry', 'previous' ] ) || pages.has( row.page ) ||
					!Number.isInteger( row.page ) || row.page < 1 || row.page > group.entries.length ||
					canonical( groupMarker( row.entry ) ) !== canonical( { id: group.id, page: row.page } ) ) throw unavailable();
				pages.add( row.page );
			}
			bank.set( group.id, group );
		}
		for ( const [ page, timeline ] of timelines ) if ( !allowsGroupTimeline( record, timeline, page, bank ) ) throw unavailable();
		return bank;
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
		const beforeDraft = canonical( modelDraft( record ) ), timelines = canonical( Array.from( record.timelines ) );
		const selected = canonical( [ canvas.selectedLayerIds || [], canvas.selectedLayerId || null ] );
		return () => {
			admission( record );
			observations.forEach( Store.checkWorkingCopyObservation );
			Store.checkWorkingCopyMethods( selectionMethods );
			if ( generation !== record.generation || version !== record.version || url !== window.location.href ||
				canvas.backgroundImage !== image || canvas.selectionManager !== selection || canvas.renderer !== renderer ||
				canonical( dimensions ) !== canonical( [ canvas.baseWidth, canvas.baseHeight, canvas.canvas.width, canvas.canvas.height ] ) ||
				canonical( [ canvas.selectedLayerIds || [], canvas.selectedLayerId || null ] ) !== selected ||
				canonical( modelDraft( record ) ) !== beforeDraft || canonical( Array.from( record.timelines ) ) !== timelines ) throw unavailable();
		};
	}
	function shape( value, keys ) {
		return value && !Array.isArray( value ) && Object.keys( value ).length === keys.length && keys.every( key => Object.hasOwn( value, key ) );
	}
	function recoveryCopy( record, input ) {
		const envelope = record.Store.copyWorkingCopyValue( input ), current = modelDraft( record );
		let importHistory;
		if ( envelope.version === 4 && record.importHistory && shape( envelope, [ 'version', 'phase', 'draft', 'history', 'confirmation', 'publicationBlocked', 'importPublication', 'importHistory' ] ) ) {
			importHistory = envelope.importHistory; delete envelope.importHistory; envelope.version = 3;
		}
		let importPublication;
		if ( record.imports && envelope.version === 3 && shape( envelope, [ 'version', 'phase', 'draft', 'history', 'confirmation', 'publicationBlocked', 'importPublication' ] ) ) {
			importPublication = envelope.importPublication;
			if ( !importPublication || canonical( importPublication.capsule && importPublication.capsule.draft ) !== canonical( envelope.draft ) ) throw unavailable();
			delete envelope.importPublication; envelope.version = 1;
		} else if ( record.imports ) {
			// A ready older draft has no source association to invent. Preserve its complete work.
			if ( envelope.version === 2 && envelope.publicationAttempt === null ) {
				delete envelope.publicationAttempt; envelope.version = 1;
			}
			if ( envelope.version !== 1 || envelope.phase !== 'ready' ) throw unavailable();
			importPublication = { version: 1, capsule: { version: 1, draft: envelope.draft, sources: [] }, attempt: null };
		} else if ( envelope.version === 3 ) throw unavailable();
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
		if ( record.importHistory ) importHistoryCopy( record, importHistory || { version: 1, groups: [] },
			new Map( history.members.map( member => [ member.page, member.timeline ] ) ) );
		return importPublication ? { ...envelope, importPublication, ...( importHistory ? { importHistory } : {} ) } : retainedAttempt ? { ...envelope, publicationAttempt } : envelope;
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
			if ( record.operation.handle ) {
				if ( record.operation.import ) record.transaction.releaseImportPlan( record.operation.handle );
				else record.transaction.cancel( record.operation.handle );
			}
			if ( record.operation.patch ) record.store.releaseWorkingCopyPatch( record.operation.patch );
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
			const target = history.preflightPdfImportTimeline( !initial && page === previous ? timeline :
				record.timelines.get( page ) || freshTimeline( record, state ), page );
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
			} finally { record.committing = false; }
			// A listener may have edited the newly visible page. Preserve that work as well.
			capture( record );
			// Presentation reads the completed state through the same strict host guard.
			history.updateUndoRedoButtons();
			editor.syncPageInUrl( page );
			editor.refreshPageControls();
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
		/** Inactive lifecycle admission requires the actual loaded host and its original editor. */
		static ownsEditor( host, editor ) { try { return data( host ).editor === editor; } catch ( error ) { return false; } }
		static isPdfImportHistoryRoute( route, history, host ) {
			const record = records.get( host ); return !!record && !record.disposed && record.history === history &&
				record.importHistory && historyCertificates.get( route ) === record;
		}
		static isPdfImportHistoryTransfer( host, history, application ) {
			const record = records.get( host ), Application = window.Layers.Editor.PageOwnedWholePdfImportApplication;
			return !!record && !record.disposed && record.history === history && record.recovering && !!record.handoffBridge &&
				record.transaction.getStatus().phase === 'confirmed' && !!Application &&
				Application.prototype.ownsBridge.call( application, record.handoffBridge );
		}

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
				version: 0, generation: 0, operation: null, needsRefresh: false, saving: false, recovering: false, imports: false,
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

		/** Connect the actual Import readers/publisher; UI activation still belongs to the integration. */
		enableImports( api ) {
			const record = data( this ); ready( record );
			if ( record.imports || record.operation || record.recovering || record.publicationBlocked ||
				!api || typeof api.post !== 'function' || typeof api.postWithToken !== 'function' ) throw unavailable();
			record.transaction.enableImports( api ); record.transaction.enableImportPublication( api );
			for ( const key of [ 'prepareImportPublicationReconciliation', 'commitImportPublicationReconciliation', 'releaseImportPublicationReconciliation' ] ) {
				record.methods.push( record.Store.captureWorkingCopyMethod( record.transaction, key ) );
			}
			record.imports = true; record.version++;
		}

		/** Route the existing Undo/Redo controls across every page of a creation Import. */
		enableImportHistory() {
			const record = data( this ); ready( record );
			if ( !record.imports || record.importHistory || record.operation || record.recovering || record.publicationBlocked ) throw unavailable();
			const route = Object.freeze( {
				tryUndo: () => groupStep( this, true, false ), tryRedo: () => groupStep( this, false, false ),
				canUndo: () => groupStep( this, true, true ), canRedo: () => groupStep( this, false, true ),
				afterChange: () => retireGroups( record ), allowsTimeline: ( timeline, page ) => allowsGroupTimeline( record, timeline, page ),
				allowsState: state => { const index = record.history.history.indexOf( state ); return index >= 0 &&
					allowsGroupTimeline( record, { ...record.history.captureTimeline(), historyIndex: index } ); },
				allowsJump: index => { try { return Number.isInteger( index ) && index >= 0 && index <= record.history.historyIndex &&
					!record.history.history.slice( index + 1, record.history.historyIndex + 1 ).some( groupMarker ) &&
					allowsGroupTimeline( record, { ...record.history.captureTimeline(), historyIndex: index } ); } catch ( error ) { return false; } }
			} );
			record.importHistory = new Map(); historyCertificates.set( route, record );
			try { record.history.enablePdfImportHistory( this, route ); }
			catch ( error ) { record.importHistory = null; historyCertificates.delete( route ); throw unavailable(); }
			record.version++;
		}

		/** Prepare complete model, active state and per-page timelines without changing the editor. */
		async prepareImport( source, options ) {
			const record = data( this ); ready( record );
			if ( !record.imports || record.recovering || record.publicationBlocked || !options ) throw unavailable();
			invalidate( record ); capture( record );
			const operation = { generation: record.generation, handle: null, stage: null, patch: null, import: true };
			record.operation = operation;
			const participants = guard( record, operation.generation );
			const check = () => { participants(); if ( record.publicationBlocked || record.recovering ) throw unavailable(); };
			try {
				const prepared = await record.transaction.prepareImport( { source, mode: options.mode,
					maxLayers: options.maxLayers, allocateId: options.allocateId }, { guard: check } );
				if ( !prepared ) { record.operation = null; return null; }
				operation.handle = prepared.handle; check();
				const { preview } = prepared, before = modelDraft( record ), after = preview.capsule.draft;
				const contexts = new Map( preview.contexts.map( context => [ context.page, context ] ) );
				const timelines = new Map( record.timelines ); timelines.set( before.activePage, record.history.captureTimeline() );
				let group;
				if ( record.importHistory ) {
					const bytes = new Uint8Array( 16 ); window.crypto.getRandomValues( bytes );
					const id = Array.from( bytes, value => value.toString( 16 ).padStart( 2, '0' ) ).join( '' );
					if ( record.importHistory.has( id ) ) throw unavailable();
					group = { id, phase: 'after', before: record.transaction.getImportPublicationState().capsule,
						after: record.Store.copyWorkingCopyValue( preview.capsule ), entries: [] };
				}
				for ( const [ page, context ] of contexts ) {
					const previous = before.snapshot.surfaces.find( surface => surface.id === context.surface.id ) || context.surface;
					const next = after.snapshot.surfaces.find( surface => surface.id === context.surface.id );
					if ( !next ) throw unavailable();
					const timeline = record.history.copyTimeline( timelines.get( page ) || freshTimeline( record, previous ) );
					if ( canonical( timeline.history[ timeline.historyIndex ].layers ) !== canonical( previous.layers ) ) throw unavailable();
					timeline.history = timeline.history.slice( 0, timeline.historyIndex + 1 );
					timeline.history.push( { layers: next.layers, description: 'Import', timestamp: Date.now() } );
					timeline.historyIndex++;
					if ( group ) {
						const entry = timeline.history[ timeline.historyIndex ]; entry.pdfImportGroup = { id: group.id, page };
						group.entries.push( record.Store.copyWorkingCopyValue( { page, entry, previous: timeline.history[ timeline.historyIndex - 1 ] } ) );
					}
					if ( timeline.lastSaveHistoryIndex >= timeline.historyIndex ) timeline.lastSaveHistoryIndex = -1;
					if ( timeline.history.length > timeline.maxHistorySteps ) {
						const removed = timeline.history.length - timeline.maxHistorySteps;
						timeline.history.splice( 0, removed ); timeline.historyIndex -= removed;
						timeline.lastSaveHistoryIndex = Math.max( -1, timeline.lastSaveHistoryIndex - removed );
					}
					timelines.set( page, record.history.preflightTimeline( timeline ) );
				}
				const state = preview.state, { store, canvas, history, Store } = record;
				const ids = preview.importedLayerIds.filter( id => state.layers.some( layer => layer.id === id ) );
				const selection = canvas.selectionManager && canvas.selectionManager.prepareWorkingCopyImportSelection( state.layers, ids );
				const values = { layers: state.layers, isSlide: false, isDirty: true, selectedLayerIds: ids,
					baseWidth: state.canvas.width, baseHeight: state.canvas.height }, clear = [];
				for ( const key of [ 'backgroundVisible', 'backgroundOpacity' ] ) {
					if ( Object.hasOwn( state.canvas, key ) ) values[ key ] = state.canvas[ key ]; else clear.push( key );
				}
				const patch = store.prepareWorkingCopyPatch( { values, clear } ); operation.patch = patch;
				const commit = store.prepareWorkingCopyPatchCommit( patch ); if ( !Store.isWorkingCopyPatchCommit( commit ) ) throw unavailable();
				const writes = [ ...assignments( history, timelines.get( after.activePage ) ),
					...assignments( canvas, { selectedLayerIds: ids, selectedLayerId: ids.length === 1 ? ids[ 0 ] : null } ) ];
				const preflight = () => {
					check(); if ( record.operation !== operation ) throw unavailable();
					record.transaction.inspectImportPlan( operation.handle ); commit.preflight(); if ( selection ) selection.preflight(); check();
				};
				preflight(); const handle = Object.freeze( {} );
				imports.set( handle, { host: this, record, operation, preview, timelines, contexts, commit, selection, writes, preflight, group } );
				return { handle, preview: record.Store.copyWorkingCopyValue( preview ) };
			} catch ( error ) {
				if ( operation.handle ) record.transaction.releaseImportPlan( operation.handle );
				if ( operation.patch ) record.store.releaseWorkingCopyPatch( operation.patch );
				if ( record.operation === operation ) record.operation = null;
				throw unavailable();
			}
		}

		inspectImport( handle ) {
			const plan = imports.get( handle ); if ( !plan || plan.host !== this ) throw unavailable();
			plan.preflight(); return plan.record.Store.copyWorkingCopyValue( plan.preview );
		}

		commitImport( handle ) {
			const plan = imports.get( handle ); if ( !plan || plan.host !== this ) throw unavailable();
			const { record, operation, commit, writes, selection } = plan;
			plan.preflight();
			record.transaction.commitImportPlan( operation.handle, plan.preflight );
			commit.commit(); for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor );
			if ( selection ) selection.commit();
			record.timelines = plan.timelines; record.contexts = plan.contexts; record.operation = null;
			if ( plan.group ) record.importHistory.set( plan.group.id, plan.group );
			record.version++; imports.delete( handle ); record.committing = true;
			try {
				record.store.notifyWorkingCopyPatch( operation.patch ); if ( selection ) selection.refresh();
			} catch ( error ) { record.needsRefresh = true; }
			finally { record.committing = false; record.store.releaseWorkingCopyPatch( operation.patch ); }
			try { capture( record ); record.history.updateUndoRedoButtons(); record.editor.refreshPageControls(); }
			catch ( error ) { record.needsRefresh = true; }
			return { applied: true, needsRefresh: record.needsRefresh };
		}

		releaseImport( handle ) {
			const plan = imports.get( handle ); if ( !plan || plan.host !== this ) return;
			imports.delete( handle );
			// Page turns, Save or disposal may already have released the private plan and patch.
			if ( plan.record.operation !== plan.operation ) return;
			plan.record.transaction.releaseImportPlan( plan.operation.handle );
			if ( plan.operation.patch ) plan.record.store.releaseWorkingCopyPatch( plan.operation.patch );
			if ( plan.record.operation === plan.operation ) plan.record.operation = null;
		}
		capture() { return capture( data( this ) ); }
		getLiveState() { return live( data( this ) ); }
		getStatus() { const record = data( this, false ); if ( record.loaded ) capture( record );
			return { ...record.transaction.getStatus(), loaded: record.loaded, needsRefresh: record.needsRefresh,
				publicationBlocked: record.publicationBlocked, saving: record.saving, recovering: record.recovering }; }
		getDraft() { const record = data( this ); capture( record ); return modelDraft( record ); }

		/** Isolated per-page timelines; capture itself does not restore or publish anything. */
		captureDraftHistory() {
			const record = data( this ); capture( record );
			const currentDraft = modelDraft( record ), timelines = new Map( record.timelines );
			timelines.set( currentDraft.activePage, record.history.captureTimeline() );
			if ( !timelines.has( currentDraft.creation.anchorSurface.source.page ) ) {
				timelines.set( currentDraft.creation.anchorSurface.source.page, freshTimeline( record, { layers: [] } ) );
			}
			return record.Store.copyWorkingCopyValue( { version: 1, creation: currentDraft.creation, pageCount: currentDraft.pageCount,
				activePage: currentDraft.activePage, members: Array.from( timelines, ( [ page, timeline ] ) => {
					const member = record.contexts.has( page ) ? record.contexts.get( page ).surface : currentDraft.creation.anchorSurface;
					return { page, surfaceId: member.id, source: member.source, timeline: record.history.copyTimeline( timeline ) };
				} ).sort( ( left, right ) => left.page - right.page ) } );
		}

		captureDraftEnvelope( options ) {
			const record = data( this ); capture( record );
			const retained = options !== undefined;
			if ( retained && ( record.blockedPhase || record.transaction.getStatus().phase ) !== 'ready' &&
				attempt( record ) === null ) throw unavailable();
			if ( retained && ( !shape( options, [ 'publicationAttempt' ] ) ||
				!Object.hasOwn( Object.getOwnPropertyDescriptor( options, 'publicationAttempt' ), 'value' ) || options.publicationAttempt !== true ) ) throw unavailable();
			return record.Store.copyWorkingCopyValue( { version: 1, phase: record.blockedPhase || record.transaction.getStatus().phase,
				draft: modelDraft( record ), history: this.captureDraftHistory(), confirmation: record.confirmation,
				publicationBlocked: record.publicationBlocked, ...( record.imports ? { version: 3,
					importPublication: record.transaction.getImportPublicationState(), ...( record.importHistory ? { version: 4,
						importHistory: { version: 1, groups: Array.from( record.importHistory.values() ) } } : {} ) } : retained ? { version: 2, publicationAttempt: attempt( record ) } : {} ) } );
		}

		/** Exit preservation keeps real attempt evidence when present, without inventing it for cancelled review. */
		captureExitEnvelope() {
			const record = data( this );
			return this.captureDraftEnvelope( attempt( record ) === null ? undefined : { publicationAttempt: true } );
		}

		/** Complete synchronous exit witness; a later edit, hold, operation or disposal invalidates it. */
		witnessLifecycleExit() {
			const record = data( this ); capture( record );
			const participants = guard( record, record.generation, alive );
			const status = () => canonical( [ record.transaction.getStatus(), record.needsRefresh, record.saving, record.recovering,
				record.publicationBlocked, record.blockedPhase, record.reviewBlocked, record.confirmation ] );
			const before = status();
			return () => { participants(); if ( status() !== before ) throw unavailable(); };
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
				const options = { pages: envelope.history.members.map( member => member.page ), guard: check };
				let prepared;
				if ( envelope.importPublication ) {
					const imported = await record.transaction.prepareImportPublicationRecovery( envelope.importPublication, options );
					prepared = { handle: imported.handle, contexts: imported.preview.contexts,
						draft: imported.preview.publicationState.capsule.draft, phase: imported.preview.phase };
				} else prepared = await record.transaction.prepareDraft( envelope.draft, {
					...options, ...( Object.hasOwn( envelope, 'publicationAttempt' ) ? { publicationAttempt: envelope.publicationAttempt } : {} ) } );
				operation.handle = prepared.handle; check();
				const contexts = new Map( prepared.contexts.map( context => [ context.page, context ] ) ), timelines = new Map();
				for ( const member of envelope.history.members ) {
					const context = contexts.get( member.page ), surface = prepared.draft.snapshot.surfaces.find( value => value.id === member.surfaceId );
					if ( !context || context.surface.id !== member.surfaceId || canonical( context.surface.source ) !== canonical( member.source ) ||
						canonical( member.timeline.history[ member.timeline.historyIndex ].layers ) !== canonical( surface ? surface.layers : [] ) ) throw unavailable();
					timelines.set( member.page, record.history.preflightTimeline( member.timeline ) );
				}
				const context = contexts.get( prepared.draft.activePage ), surface = prepared.draft.snapshot.surfaces.find( value => value.id === context.surface.id ) || context.surface;
				const bank = record.importHistory ? importHistoryCopy( record, envelope.importHistory || { version: 1, groups: [] }, timelines ) : null;
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
				if ( envelope.importPublication ) record.transaction.commitImportPublicationRecovery( prepared.handle, check );
				else record.transaction.commit( prepared.handle );
				stateCommit.commit();
				for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor );
				if ( selection ) selection.commit();
				record.timelines = timelines; record.contexts = contexts;
				if ( bank ) record.importHistory = bank;
				const phase = envelope.importPublication ? prepared.phase : envelope.phase;
				record.publicationBlocked = record.publicationBlocked || envelope.publicationBlocked || phase !== 'ready';
				record.blockedPhase = record.publicationBlocked ? record.blockedPhase || ( phase === 'ready' ? 'uncertain' : phase ) : null;
				// Older envelopes cannot distinguish cancellation from uncertainty. Never clear an ambiguous persisted hold.
				record.reviewBlocked = record.reviewBlocked || envelope.publicationBlocked; committed = true;
				record.committing = true;
				try {
					canvas.commitStagedBackground( stage ); store.notifyWorkingCopyPatch( patch ); if ( selection ) selection.refresh();
				} finally { record.committing = false; }
				capture( record );
				history.updateUndoRedoButtons(); editor.syncPageInUrl( context.page ); editor.refreshPageControls();
				return true;
			} catch ( error ) { if ( committed ) record.needsRefresh = true; throw unavailable(); }
			finally {
				if ( patch ) record.store.releaseWorkingCopyPatch( patch );
				if ( operation.handle ) {
					if ( envelope.importPublication ) {
						if ( !committed ) record.transaction.releaseImportPublicationRecovery( operation.handle );
					} else record.transaction.cancel( operation.handle );
				}
				if ( operation.stage ) operation.stage.dispose(); if ( record.operation === operation ) record.operation = null; record.recovering = false;
			}
		}

		/** Explicit read-only outcome inspection; preserves current work and every publication/recovery hold. */
		async inspectPublication( dependencies, ownerGuard ) {
			const record = data( this );
			if ( record.imports ) throw unavailable();
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
			if ( record.imports ) {
				if ( !dependencies || ![ Object.prototype, null ].includes( Object.getPrototypeOf( dependencies ) ) ) throw unavailable();
				for ( const key of [ 'reader', 'pdfReader' ] ) {
					const descriptor = Object.getOwnPropertyDescriptor( dependencies, key );
					if ( !descriptor || !Object.hasOwn( descriptor, 'value' ) ) throw unavailable();
					record.Store.captureWorkingCopyMethod( descriptor.value, 'read' );
				}
			}
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
				check(); prepared = await record.transaction[ record.imports ? 'prepareImportPublicationReconciliation' : 'preparePublicationReconciliation' ]( dependencies,
					{ guard: check, pages: history.members.map( member => member.page ) } ); check();
				if ( prepared.outcome.outcome === 'changed' ) return { ...prepared.outcome, applied: false, needsRefresh: false };
				const timelines = new Map(), active = record.transaction.getStatus().page;
				const anchor = modelDraft( record ).creation.anchorSurface, confirmation = prepared.confirmation;
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
				const dirty = !confirmation || canonical( modelDraft( record ).snapshot ) !== canonical( confirmation.snapshot );
				patch = record.store.prepareWorkingCopyPatch( { values: { isDirty: dirty }, clear: [] } );
				const stateCommit = record.store.prepareWorkingCopyPatchCommit( patch );
				if ( !record.Store.isWorkingCopyPatchCommit( stateCommit ) ) throw unavailable();
				const writes = confirmation ? assignments( record.history, timelines.get( active ) ) : [];
				stateCommit.preflight(); check();
				// Final model/backup guard precedes all changes. No await, setters or notifications intervene.
				const result = record.transaction[ record.imports ? 'commitImportPublicationReconciliation' : 'commitPublicationReconciliation' ]( prepared.handle );
				stateCommit.commit(); for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor );
				if ( confirmation ) record.timelines = timelines;
				record.confirmation = confirmation; record.publicationBlocked = false; record.blockedPhase = null;
				try {
					record.committing = true; record.store.notifyWorkingCopyPatch( patch ); record.history.updateUndoRedoButtons();
				} catch ( error ) { record.needsRefresh = true; }
				finally { record.committing = false; }
				return { ...result, needsRefresh: record.needsRefresh };
			} finally {
				if ( prepared ) record.transaction[ record.imports ? 'releaseImportPublicationReconciliation' : 'releasePublicationReconciliation' ]( prepared.handle );
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
			const check = () => {
				participants(); if ( record.imports && record.publicationBlocked ) throw unavailable();
				if ( checkOwner && checkOwner() !== undefined ) throw unavailable();
				participants(); if ( record.imports && record.publicationBlocked ) throw unavailable();
			};
			record.saving = true;
			let result;
			try {
				result = await record.transaction[ record.imports ? 'saveImport' : 'save' ]( summary, beforePublish, { guard: check } );
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
				return { ...result, currentSnapshot: modelDraft( record ).snapshot, hostReady: true, history: this.captureDraftHistory() };
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
		async handoffSavedSession( dependencies, ownerGuard, installSavedOwner ) {
			if ( installSavedOwner !== undefined && typeof installSavedOwner !== 'function' ) throw unavailable();
			const record = data( this );
			const admit = value => {
				alive( value );
				if ( value.needsRefresh || value.saving || value.publicationBlocked || !value.confirmation ||
					value.transaction.getStatus().phase !== 'confirmed' ) throw unavailable();
			};
			admit( record ); if ( record.recovering || ( ownerGuard !== undefined && typeof ownerGuard !== 'function' ) ) throw unavailable();
			invalidate( record ); capture( record ); record.recovering = true;
			let check;
			const common = typeof module !== 'undefined' && module && typeof module.require === 'function';
			const Saved = common ? require( './PageOwnedPdfCreationSavedSession.js' ) : window.Layers.Editor.PageOwnedPdfCreationSavedSession;
			const Bridge = common ? require( './PageOwnedEditorBridge.js' ) : window.Layers.Editor.PageOwnedEditorBridge;
			const Coordinator = common ? require( './PageOwnedPdfEditorCoordinator.js' ) : window.Layers.Editor.PageOwnedPdfEditorCoordinator;
			let prepared, patch, stage, transfer, application, binding, publicationMethod, committed = false;
			try {
				const participants = guard( record, record.generation, admit );
				check = () => { participants(); if ( ownerGuard ) {
					const result = ownerGuard(); if ( result !== undefined ) { Promise.resolve( result ).catch( () => {} ); throw unavailable(); }
					} participants(); if ( publicationMethod ) record.Store.checkWorkingCopyMethods( [ publicationMethod ] ); };
				const completeBackup = this.captureDraftEnvelope();
				const savedEnvelope = record.imports ? { version: 1, phase: completeBackup.phase, draft: completeBackup.draft,
					history: completeBackup.history, confirmation: completeBackup.confirmation, publicationBlocked: completeBackup.publicationBlocked } : completeBackup;
				prepared = await Saved.prepare( savedEnvelope, dependencies, check, Array.from( record.contexts.values() ) );
				if ( record.imports ) prepared.creationBackup = completeBackup;
				check();
				const { session, state, context } = prepared, { editor, canvas, store, history, Store } = record;
				let timelines = prepared.timelines;
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
				if ( record.importHistory ) {
					const Binding = common ? require( './PageOwnedWholePdfImportSession.js' ) : window.Layers.Editor.PageOwnedWholePdfImportSession;
					const Application = common ? require( './PageOwnedWholePdfImportApplication.js' ) : window.Layers.Editor.PageOwnedWholePdfImportApplication;
					const Publisher = common ? require( './PageOwnedWholePdfImportPublishClient.js' ) : window.Layers.Editor.PageOwnedWholePdfImportPublishClient;
					if ( !dependencies.importSource || !dependencies.importPublisher ) throw unavailable();
					if ( !( dependencies.importPublisher instanceof Publisher ) ) throw unavailable();
					publicationMethod = Store.captureWorkingCopyMethod( dependencies.importPublisher, 'publish' );
					if ( publicationMethod.owner !== Publisher.prototype || publicationMethod.method !== Publisher.prototype.publish ) throw unavailable();
					binding = new Binding( session, dependencies.importSource, dependencies.pdfReader );
					const imported = Saved.importHistory( completeBackup, binding.captureImportDraft(), timelines, prepared.remapping, Array.from( record.contexts.values() ) );
					application = new Application( bridge, binding ); record.handoffBridge = bridge;
					transfer = await application.prepareCreationHistoryTransfer( this, imported, check );
					timelines = transfer.timelines; check();
				}
				stage = canvas.stageExactBackground( context.rendition.url );
				await stage.promise; check(); canvas.preflightStagedBackground( stage );
				if ( stage.url !== context.rendition.url || stage.info.width !== context.rendition.width || stage.info.height !== context.rendition.height ) throw unavailable();
				await prepared.revalidate(); check();
				if ( transfer ) { await transfer.revalidate(); check(); }
				patch = store.prepareWorkingCopyPatch( { values: { layers: state.layers, isSlide: false, isDirty: session.getStatus().dirty,
					baseWidth: state.canvas.width, baseHeight: state.canvas.height, backgroundVisible: state.canvas.backgroundVisible,
					backgroundOpacity: state.canvas.backgroundOpacity }, clear: [] } );
				const stateCommit = store.prepareWorkingCopyPatchCommit( patch ); if ( !Store.isWorkingCopyPatchCommit( stateCommit ) ) throw unavailable();
				const writes = [ ...assignments( history, timelines.get( context.page ) ),
					...assignments( canvas, { baseWidth: state.canvas.width, baseHeight: state.canvas.height } ),
					...assignments( editor, { page: context.page, pageCount: context.pageCount } ),
					...assignments( editor.config, { imageUrl: context.rendition.url } ) ];
				stateCommit.preflight(); canvas.preflightStagedBackground( stage ); check();
				if ( transfer ) transfer.preflight();
				// Both models are private until this synchronous ownership transfer. No callbacks run between assignments.
				if ( transfer ) transfer.commit();
				prepared.activate(); stateCommit.commit(); for ( const write of writes ) Object.defineProperty( write.object, write.key, write.descriptor );
				record.disposed = true; committed = true;
				const result = { bridge, coordinator, creationBackup: prepared.creationBackup, remapping: prepared.remapping,
					...( application ? { importApplication: application, importBinding: binding } : {} ), needsRefresh: false };
				try {
					record.unsubscribers.forEach( unsubscribe => unsubscribe() ); record.transaction.dispose();
					// Native callers install the saved owner before presentation reads it.
					if ( installSavedOwner ) {
						const installed = installSavedOwner( bridge );
						if ( installed !== undefined ) { Promise.resolve( installed ).catch( () => {} ); throw unavailable(); }
					}
					coordinator.initialize();
					if ( application ) { application.enablePublication( dependencies.importPublisher ); application.enableReconciliation(); }
					canvas.commitStagedBackground( stage ); store.notifyWorkingCopyPatch( patch );
					history.updateUndoRedoButtons(); editor.syncPageInUrl( context.page ); editor.refreshPageControls();
					bridge.capture(); store.set( 'isDirty', session.getStatus().dirty );
				} catch ( error ) { result.needsRefresh = true; session.blockPublication(); }
				return result;
			} catch ( error ) {
				if ( transfer && !committed ) { try { transfer.release(); } catch ( ignored ) {} transfer = null; }
				if ( prepared && !committed ) { if ( application ) application.dispose(); if ( binding ) binding.dispose(); prepared.session.dispose(); }
				throw unavailable();
			} finally { if ( transfer ) transfer.release(); if ( patch ) record.store.releaseWorkingCopyPatch( patch );
				if ( stage ) stage.dispose(); record.handoffBridge = null; record.recovering = false; }
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
