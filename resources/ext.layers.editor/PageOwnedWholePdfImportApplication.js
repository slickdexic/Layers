/** Explicitly invoked whole-PDF Import application; no registered editor callers. */
'use strict';

( function () {
	const instances = new WeakMap(), handles = new WeakMap(), commands = new WeakMap();
	const define = Object.defineProperty;
	const fields = [ 'history', 'historyIndex', 'lastSaveHistoryIndex', 'maxHistorySteps' ];
	function unavailable() {
		const error = new Error( 'layers-working-copy-import-unavailable' ); error.code = error.message; return error;
	}
	function load( name, core = false ) {
		const layers = typeof window !== 'undefined' && window.Layers;
		return layers && layers[ core ? 'Core' : 'Editor' ] && layers[ core ? 'Core' : 'Editor' ][ name ] ||
			module.require( './' + name + '.js' );
	}
	function equal( left, right ) {
		if ( left === right ) { return true; }
		if ( !left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray( left ) !== Array.isArray( right ) ) { return false; }
		const keys = Object.keys( left );
		return keys.length === Object.keys( right ).length && keys.every( key => Object.hasOwn( right, key ) && equal( left[ key ], right[ key ] ) );
	}
	function active( instance ) {
		const mode = instances.get( instance ); if ( !mode || !mode.active ) { throw unavailable(); } return mode;
	}
	function input( request ) {
		if ( !request || typeof request !== 'object' || Array.isArray( request ) ||
			![ Object.prototype, null ].includes( Object.getPrototypeOf( request ) ) ) { throw unavailable(); }
		const mode = Object.getOwnPropertyDescriptor( request, 'mode' );
		if ( mode && Object.hasOwn( mode, 'value' ) && mode.enumerable && mode.value === 'cancel' ) { return null; }
		const keys = [ 'source', 'mode', 'maxLayers', 'allocateId', 'assertCurrent' ];
		if ( Reflect.ownKeys( request ).length !== keys.length ) { throw unavailable(); }
		return Object.fromEntries( keys.map( key => {
			const value = Object.getOwnPropertyDescriptor( request, key );
			if ( !value || !Object.hasOwn( value, 'value' ) || !value.enumerable ) { throw unavailable(); }
			return [ key, value.value ];
		} ) );
	}
	function slot( object, key, value ) {
		const descriptor = Object.getOwnPropertyDescriptor( object, key );
		if ( !descriptor || !Object.hasOwn( descriptor, 'value' ) || !descriptor.writable ) { throw unavailable(); }
		return { object, key, original: descriptor, descriptor: { ...descriptor, value } };
	}
	function checkSlots( slots ) {
		for ( const assignment of slots ) {
			const current = Object.getOwnPropertyDescriptor( assignment.object, assignment.key );
			if ( !current || Reflect.ownKeys( assignment.original ).some( key => current[ key ] !== assignment.original[ key ] ) ) { throw unavailable(); }
		}
	}
	function capture( instance, external ) {
		const mode = active( instance ), { bridge, binding, editor, coordinator, store, history, selection, Store } = mode;
		const generation = mode.generation;
		const methods = [ [ instance, [ 'prepare', 'inspect', 'apply', 'undo', 'redo', 'release', 'releaseCommand', 'dispose' ] ],
			[ binding, [ 'ownsSession', 'prepare', 'inspect', 'prepareImportCommit', 'inspectImportCommit', 'commitPreparedImport',
				'releaseImportCommit', 'release', 'prepareImportRestore', 'inspectImportRestore', 'commitImportRestore', 'releaseImportRestore' ] ],
			[ bridge, [ 'getLiveState', 'capture' ] ], [ coordinator, [ 'witness', 'assertReady', 'freshTimeline' ] ],
			[ history, [ 'captureTimeline', 'copyTimeline', 'preflightTimeline', 'updateUndoRedoButtons' ] ],
			[ selection, [ 'captureWorkingCopyImportSelection', 'prepareWorkingCopyImportSelection' ] ],
			[ store, [ 'isWorkingCopyAlive', 'prepareWorkingCopyPatch', 'prepareWorkingCopyPatchCommit', 'notifyWorkingCopyPatch', 'releaseWorkingCopyPatch' ] ] ]
			.flatMap( ( [ object, keys ] ) => keys.map( key => Store.captureWorkingCopyMethod( object, key ) ) );
		const ready = () => {
			if ( active( instance ) !== mode || mode.generation !== generation || bridge.editor !== editor || bridge.session !== mode.session ||
				bridge.pdfCoordinator !== coordinator || editor.stateManager !== store || editor.historyManager !== history ||
				editor.canvasManager !== mode.canvas || mode.canvas.selectionManager !== selection || coordinator.bridge !== bridge ||
				store.editor !== editor || history.editor !== editor || mode.canvas.editor !== editor || selection.canvasManager !== mode.canvas ||
				!mode.ownsSession.call( binding, mode.session ) || !store.isWorkingCopyAlive() || store.isLocked || store._isProcessingPending ||
				store.pendingOperations.length || store.lockingQueue.length || store.lockTimeout !== null || store.lockAutoRecoveryTimeout !== null ||
				coordinator.stage || coordinator.committing || coordinator.recovering || history.batchMode ) { throw unavailable(); }
			coordinator.assertReady(); Store.checkWorkingCopyMethods( methods );
			const value = external();
			if ( value !== undefined ) { if ( value instanceof Promise ) { Promise.prototype.catch.call( value, () => {} ); } throw unavailable(); }
		};
		ready();
		if ( !equal( bridge.getLiveState(), mode.session.getEditorState() ) ||
			!equal( history.captureTimeline().history[ history.historyIndex ].layers, bridge.getLiveState().layers ) ) { throw unavailable(); }
		const observations = [ Store.observeWorkingCopyObject( bridge, false ), Store.observeWorkingCopyObject( editor, false ),
			Store.observeWorkingCopyObject( editor.config ), Store.observeWorkingCopyObject( coordinator, false ),
			Store.observeWorkingCopyObject( history, false ), Store.observeWorkingCopyObject( history.history ),
			Store.observeWorkingCopyObject( history.batchChanges ), Store.observeWorkingCopyObject( store, false ),
			Store.observeWorkingCopyObject( store.state ), Store.observeWorkingCopyObject( mode.canvas, false ) ];
		const witness = coordinator.witness( true ), selectionWitness = selection.captureWorkingCopyImportSelection();
		if ( !mode.Selection.isWorkingCopyImportSelection( selectionWitness ) ) { throw unavailable(); }
		const check = () => {
			ready(); observations.forEach( Store.checkWorkingCopyObservation ); selectionWitness.preflight();
			if ( coordinator.witness( true ) !== witness ) { throw unavailable(); }
		};
		check(); return { mode, check };
	}
	function entry( instance, handle ) {
		const mode = active( instance ), record = handles.get( handle );
		if ( !record || record.mode !== mode || record.consumed || record.released ) { throw unavailable(); }
		record.guard.check(); return record;
	}
	function effectiveTimelines( mode ) {
		const result = new Map( Array.from( mode.coordinator.timelines, ( [ page, timeline ] ) => [ page, mode.history.copyTimeline( timeline ) ] ) );
		result.set( mode.session.getPdfStatus().page, mode.history.captureTimeline() ); return result;
	}
	function member( snapshot, mode, page ) {
		const anchor = snapshot.surfaces.find( value => value.id === mode.session._surfaceId );
		return snapshot.surfaces.find( value => value.kind === 'pdf' && value.label === anchor.label &&
			value.source.fileTitle === anchor.source.fileTitle && value.source.page === page );
	}
	function timelinesForImport( mode, preview ) {
		const before = effectiveTimelines( mode ), after = new Map( before ), pages = new Set( [ preview.activePage ] );
		const anchor = preview.candidateSnapshot.surfaces.find( value => value.id === mode.session._surfaceId );
		for ( const value of preview.candidateSnapshot.surfaces ) {
			if ( value.kind === 'pdf' && value.label === anchor.label && value.source.fileTitle === anchor.source.fileTitle ) { pages.add( value.source.page ); }
		}
		for ( const page of pages ) {
			const blank = preview.preparedMembers.find( value => value.page === page );
			const previous = member( preview.beforeSnapshot, mode, page ) || blank && blank.origin.surface;
			const next = member( preview.candidateSnapshot, mode, page ) || previous;
			if ( !previous || !next ) { throw unavailable(); }
			const current = before.get( page ) || mode.coordinator.freshTimeline( previous,
				equal( previous, member( JSON.parse( mode.session._savedJson ), mode, page ) ) );
			if ( !equal( current.history[ current.historyIndex ].layers, previous.layers ) ) { throw unavailable(); }
			before.set( page, current );
			const kept = current.history.slice( 0, current.historyIndex + 1 );
			const timeline = { ...current, history: kept.concat( { layers: next.layers, description: 'Import', timestamp: Date.now() } ),
				historyIndex: kept.length, lastSaveHistoryIndex: current.lastSaveHistoryIndex > current.historyIndex ? -1 : current.lastSaveHistoryIndex };
			if ( timeline.history.length > timeline.maxHistorySteps ) {
				const removed = timeline.history.length - timeline.maxHistorySteps; timeline.history.splice( 0, removed );
				timeline.historyIndex -= removed; timeline.lastSaveHistoryIndex = Math.max( -1, timeline.lastSaveHistoryIndex - removed );
			}
			after.set( page, mode.history.preflightTimeline( timeline ) );
		}
		return { before, after, pages: Array.from( pages ) };
	}
	function participants( guard, preview, timelines, selectedIds ) {
		const { mode } = guard, { store, history, coordinator, selection, Store } = mode;
		const selectionCommit = selection.prepareWorkingCopyImportSelection( preview.editorState.layers, selectedIds );
		if ( !mode.Selection.isWorkingCopyImportSelection( selectionCommit ) ) { throw unavailable(); }
		const canvas = preview.editorState.canvas, values = { layers: preview.editorState.layers,
			selectedLayerIds: selectionCommit.selectedIds.slice(), isDirty: preview.dirty, isSlide: false,
			baseWidth: canvas.width, baseHeight: canvas.height }, clear = [];
		for ( const key of [ 'backgroundVisible', 'backgroundOpacity' ] ) {
			if ( Object.hasOwn( canvas, key ) ) { values[ key ] = canvas[ key ]; } else { clear.push( key ); }
		}
		let patch;
		try {
			patch = store.prepareWorkingCopyPatch( { values, clear } );
			const display = store.prepareWorkingCopyPatchCommit( patch );
			if ( !Store.isWorkingCopyPatchCommit( display ) ) { throw unavailable(); }
			const activeTimeline = history.preflightTimeline( timelines.get( preview.activePage ) );
			const slots = [ slot( coordinator, 'timelines', timelines ), ...fields.map( key => slot( history, key, activeTimeline[ key ] ) ) ];
			const preflight = () => { guard.check(); checkSlots( slots ); display.preflight(); selectionCommit.preflight(); guard.check(); };
			preflight();
			return { preflight, commit: () => {
				display.commit(); selectionCommit.commit();
				for ( const assignment of slots ) { define( assignment.object, assignment.key, assignment.descriptor ); }
			}, refresh: () => refresh( mode, patch, selectionCommit ), release: () => store.releaseWorkingCopyPatch( patch ) };
		} catch ( error ) { if ( patch ) { try { store.releaseWorkingCopyPatch( patch ); } catch ( ignored ) {} } throw error; }
	}
	function refresh( mode, patch, selection ) {
		const diagnostics = [], attempt = callback => {
			try { const notes = callback(); if ( Array.isArray( notes ) ) { diagnostics.push( ...notes ); } }
			catch ( error ) { diagnostics.push( 'working-copy-import-refresh-failed' ); }
		};
		mode.coordinator.committing = true;
		try {
			attempt( () => mode.store.notifyWorkingCopyPatch( patch ) ); attempt( selection.refresh );
			if ( mode.store.isWorkingCopyAlive() && !mode.editor.isDestroyed && !mode.canvas.isDestroyed ) {
				attempt( () => mode.canvas.setBaseDimensions( mode.store.state.baseWidth, mode.store.state.baseHeight ) );
				attempt( () => mode.canvas.renderLayers( mode.store.state.layers ) );
				if ( mode.editor.layerPanel ) { attempt( () => mode.editor.layerPanel.updateLayers( mode.store.state.layers ) ); }
				attempt( () => mode.history.updateUndoRedoButtons() ); attempt( selection.refresh );
			}
		} finally { mode.coordinator.committing = false; }
		return diagnostics;
	}
	function cleanup( instance, mode ) {
		for ( const handle of Array.from( mode.handles ) ) { try { instance.release( handle ); } catch ( ignored ) {} }
		for ( const command of Array.from( mode.commands ) ) { try { instance.releaseCommand( command ); } catch ( ignored ) {} }
	}
	class PageOwnedWholePdfImportApplication {
		constructor( bridge, binding ) {
			try {
				const Binding = load( 'PageOwnedWholePdfImportSession' ), Bridge = load( 'PageOwnedEditorBridge' );
				const Coordinator = load( 'PageOwnedPdfEditorCoordinator' ), Store = load( 'StateManager', true );
				const Selection = load( 'SelectionManager', true ), History = load( 'HistoryManager', true );
				const editor = bridge.editor, coordinator = bridge.pdfCoordinator;
				if ( !( bridge instanceof Bridge ) || !( binding instanceof Binding ) || !Binding.prototype.ownsSession.call( binding, bridge.session ) ||
					!( coordinator instanceof Coordinator ) || !( editor.stateManager instanceof Store ) ||
					!( editor.historyManager instanceof History ) || !( editor.canvasManager.selectionManager instanceof Selection ) ||
					coordinator.bridge !== bridge || editor.stateManager.editor !== editor || editor.historyManager.editor !== editor ||
					editor.canvasManager.editor !== editor || editor.canvasManager.selectionManager.canvasManager !== editor.canvasManager ) { throw unavailable(); }
				instances.set( this, { active: true, bridge, binding, editor, session: bridge.session, coordinator, Store, Selection,
					store: editor.stateManager, history: editor.historyManager, canvas: editor.canvasManager,
					selection: editor.canvasManager.selectionManager, ownsSession: Binding.prototype.ownsSession,
					generation: 0, busy: false, handles: new Set(), commands: new Set() } );
			} catch ( error ) { throw unavailable(); }
		}
		async prepare( request ) {
			let sourceHandle;
			try {
				const mode = active( this );
				const options = input( request );
				if ( options === null ) { return null; }
				if ( mode.busy || typeof options.assertCurrent !== 'function' ) { throw unavailable(); }
				const guard = capture( this, options.assertCurrent );
				sourceHandle = await mode.binding.prepare( { ...options, assertCurrent: guard.check } ); guard.check();
				const handle = Object.freeze( Object.create( null ) );
				handles.set( handle, { mode, guard, sourceHandle, consumed: false, released: false } ); mode.handles.add( handle );
				return handle;
			} catch ( error ) {
				if ( sourceHandle ) { try { instances.get( this ).binding.release( sourceHandle ); } catch ( ignored ) {} }
				throw unavailable();
			}
		}
		inspect( handle ) {
			try { const record = entry( this, handle ), result = record.mode.binding.inspect( record.sourceHandle ); record.guard.check(); return result; }
			catch ( error ) { throw unavailable(); }
		}
		async apply( handle ) {
			if ( handle === null ) { return null; }
			let record, prepared, staged, committed = false, result, ownsBusy = false;
			try {
				record = entry( this, handle ); const { mode, guard } = record;
				if ( mode.busy ) { throw unavailable(); } mode.busy = true; ownsBusy = true;
				prepared = await mode.binding.prepareImportCommit( record.sourceHandle ); guard.check();
				const preview = mode.binding.inspectImportCommit( prepared ), timelines = timelinesForImport( mode, preview );
				const page = preview.pages.find( value => value.page === preview.activePage );
				staged = participants( guard, preview, timelines.after, page ? page.importedLayerIds : [] );
				const token = Object.freeze( Object.create( null ) ), command = { mode, phase: 'after', timelines, released: false };
				result = mode.binding.commitPreparedImport( prepared, staged.preflight ); prepared = null;
				staged.commit(); committed = true; record.consumed = true;
				command.before = result.beforeCheckpoint; command.after = result.checkpoint;
				commands.set( token, command ); mode.commands.add( token ); mode.generation++;
				result.command = token; result.diagnostics = staged.refresh();
				try { mode.binding.release( record.sourceHandle ); } catch ( error ) { result.diagnostics.push( 'working-copy-import-release-failed' ); }
				return result;
			} catch ( error ) { if ( committed ) { result.diagnostics = [ 'working-copy-import-refresh-failed' ]; return result; } throw unavailable(); }
			finally {
				if ( ownsBusy ) { record.mode.busy = false; }
				if ( prepared ) { try { record.mode.binding.releaseImportCommit( prepared ); } catch ( ignored ) {} }
				if ( staged ) { try { staged.release(); } catch ( ignored ) {} }
				if ( ownsBusy && !record.mode.active ) { cleanup( this, record.mode ); }
			}
		}
		undo( command ) { return this._restore( command, 'after', 'before' ); }
		redo( command ) { return this._restore( command, 'before', 'after' ); }
		_restore( token, expected, target ) {
			let prepared, staged, mode, ownsBusy = false, committed = false, result;
			try {
				mode = active( this ); const command = commands.get( token );
				if ( !command || command.mode !== mode || command.released || command.phase !== expected || mode.busy ) { throw unavailable(); }
				const guard = capture( this, () => {} ), timelines = effectiveTimelines( mode );
				for ( const page of command.timelines.pages ) {
					if ( !equal( timelines.get( page ), command.timelines[ expected ].get( page ) ) ) { throw unavailable(); }
					timelines.set( page, mode.history.copyTimeline( command.timelines[ target ].get( page ) ) );
				}
				mode.busy = true; ownsBusy = true;
				prepared = mode.binding.prepareImportRestore( command[ expected ], command[ target ], guard.check );
				const preview = mode.binding.inspectImportRestore( prepared );
				staged = participants( guard, preview, timelines, [] );
				result = mode.binding.commitImportRestore( prepared, staged.preflight ); prepared = null;
				staged.commit(); committed = true; command.phase = target; mode.generation++;
				result.diagnostics = staged.refresh(); return result;
			} catch ( error ) { if ( committed ) { result.diagnostics = [ 'working-copy-import-refresh-failed' ]; return result; } throw unavailable(); }
			finally {
				if ( ownsBusy ) { mode.busy = false; }
				if ( prepared ) { try { mode.binding.releaseImportRestore( prepared ); } catch ( ignored ) {} }
				if ( staged ) { try { staged.release(); } catch ( ignored ) {} }
				if ( ownsBusy && !mode.active ) { cleanup( this, mode ); }
			}
		}
		release( handle ) {
			const mode = instances.get( this ), record = handles.get( handle );
			if ( !record || record.mode !== mode || record.released || mode.busy ) { throw unavailable(); }
			record.released = true; mode.handles.delete( handle );
			if ( !record.consumed ) { mode.binding.release( record.sourceHandle ); }
		}
		releaseCommand( token ) {
			const mode = instances.get( this ), command = commands.get( token );
			if ( !command || command.mode !== mode || command.released || mode.busy ) { throw unavailable(); }
			command.released = true; mode.commands.delete( token );
			mode.binding.releaseImportCheckpoint( command.before ); mode.binding.releaseImportCheckpoint( command.after );
		}
		dispose() {
			const mode = active( this );
			mode.active = false; mode.generation++;
			if ( !mode.busy ) { cleanup( this, mode ); }
		}
	}
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.PageOwnedWholePdfImportApplication = PageOwnedWholePdfImportApplication;
	}
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedWholePdfImportApplication; }
}() );
