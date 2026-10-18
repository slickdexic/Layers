/** Explicitly invoked whole-PDF Import application; no registered editor callers. */
'use strict';

( function () {
	const instances = new WeakMap(), handles = new WeakMap(), commands = new WeakMap();
	const historyRoutes = new WeakMap(), historyCertificates = new WeakMap();
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
		methods.push( Store.captureWorkingCopyMethod( instance, 'enableHistory' ),
			...[ 'enablePdfImportHistory', 'hasPdfImportHistory', 'preflightPdfImportTimeline' ].map( key => Store.captureWorkingCopyMethod( history, key ) ) );
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
	function marker( entry ) {
		if ( !entry || !Object.hasOwn( entry, 'pdfImportGroup' ) ) { return null; }
		const value = entry.pdfImportGroup;
		if ( !value || typeof value !== 'object' || Object.keys( value ).length !== 2 ||
			typeof value.id !== 'string' || !/^[a-f0-9]{32}$/.test( value.id ) || !Number.isInteger( value.page ) || value.page < 1 ) { throw unavailable(); }
		return value;
	}
	function markImport( mode, timelines ) {
		const route = historyRoutes.get( mode ); if ( !route ) { return null; }
		const bytes = new Uint8Array( 16 ); window.crypto.getRandomValues( bytes );
		const id = Array.from( bytes, value => value.toString( 16 ).padStart( 2, '0' ) ).join( '' );
		if ( route.bank.has( id ) ) { throw unavailable(); }
		const entries = new Map();
		for ( const page of timelines.pages ) {
			const timeline = timelines.after.get( page ), entry = timeline.history[ timeline.historyIndex ];
			entry.pdfImportGroup = { id, page }; entries.set( page, mode.Store.copyWorkingCopyValue( entry ) );
		}
		return { id, entries };
	}
	function location( route, record, timeline, page ) {
		const matches = timeline.history.flatMap( ( entry, index ) => {
			const value = marker( entry ); return value && value.id === record.id ? [ { entry, index, page: value.page } ] : [];
		} );
		if ( matches.length !== 1 || matches[ 0 ].page !== page || !equal( matches[ 0 ].entry, record.entries.get( page ) ) ) { throw unavailable(); }
		return matches[ 0 ].index;
	}
	function routedTimelines( route, record, expected, target ) {
		const { mode } = route, command = record.command;
		if ( !mode.active || mode.busy || !command || command.released || command.phase !== expected ||
			mode.history.isDestroyed || mode.history.batchMode || record.savedJson !== mode.session._savedJson ||
			!mode.ownsSession.call( mode.binding, mode.session ) ) { throw unavailable(); }
		const timelines = effectiveTimelines( mode );
		for ( const page of command.timelines.pages ) {
			const timeline = timelines.get( page ); if ( !timeline ) { throw unavailable(); }
			const index = location( route, record, timeline, page );
			if ( index < 1 || timeline.historyIndex !== ( expected === 'after' ? index : index - 1 ) ) { throw unavailable(); }
			const original = command.timelines.after.get( page ), originalIndex = location( route, record, original, page );
			if ( index > originalIndex || !equal( timeline.history.slice( 0, index ), original.history.slice( originalIndex - index, originalIndex ) ) ) { throw unavailable(); }
			// Keep the current branch, including ordinary redo states after this Import.
			timeline.historyIndex = target === 'after' ? index : index - 1;
		}
		return timelines;
	}
	function allowsTimeline( route, timeline, page = route.mode.session.getPdfStatus().page ) {
		try {
			for ( const entry of timeline.history ) {
				const value = marker( entry );
				if ( value && ( value.page !== page || !route.bank.has( value.id ) || !route.bank.get( value.id ).entries.has( page ) ) ) { return false; }
			}
			for ( const record of route.bank.values() ) {
				if ( !record.entries.has( page ) ) { continue; }
				const found = timeline.history.some( entry => { const value = marker( entry ); return value && value.id === record.id; } );
				if ( !found ) {
					// Only a currently owned timeline can establish an official trimmed/cleared gap.
					const actual = route.mode.session.getPdfStatus().page === page ? route.mode.history.captureTimeline() : route.mode.coordinator.timelines.get( page );
					if ( !actual || !equal( { ...timeline, historyIndex: actual.historyIndex }, actual ) ) { return false; }
					continue;
				}
				const index = location( route, record, timeline, page );
				if ( ( timeline.historyIndex >= index ) !== ( ( record.command ? record.command.phase : record.phase ) === 'after' ) ) { return false; }
			}
			return true;
		} catch ( error ) { return false; }
	}
	function retireHistoryCommands( route ) {
		const { mode } = route;
		if ( !mode.active || mode.busy || mode.coordinator.committing || mode.coordinator.recovering || mode.coordinator.stage ||
			mode.history.isDestroyed || mode.history.batchMode ) { return; }
		try {
			const timelines = effectiveTimelines( mode );
			for ( const record of route.bank.values() ) {
				let unreachable = false;
				for ( const page of record.entries.keys() ) {
					const timeline = timelines.get( page );
					if ( !timeline ) { continue; }
					const found = timeline.history.some( entry => { const value = marker( entry ); return value && value.id === record.id; } );
					if ( !found ) { record.entries.delete( page ); unreachable = true; }
					else if ( location( route, record, timeline, page ) < 1 ) { unreachable = true; }
				}
				if ( unreachable && record.command ) { route.instance.releaseCommand( record.token ); }
				if ( !record.entries.size ) { route.bank.delete( record.id ); }
			}
		} catch ( error ) { /* Invalid markers remain refusal barriers. */ }
	}
	function restoreRouted( instance, token, expected, target ) {
		const mode = active( instance ), route = historyRoutes.get( mode );
		const record = route && Array.from( route.bank.values() ).find( value => value.token === token );
		if ( !record ) { throw unavailable(); }
		const guard = capture( instance, () => {} ), timelines = routedTimelines( route, record, expected, target );
		let prepared, staged, result, committed = false;
		mode.busy = true;
		try {
			prepared = mode.binding.prepareImportRestore( record.command[ expected ], record.command[ target ], guard.check );
			const preview = mode.binding.inspectImportRestore( prepared ); staged = participants( guard, preview, timelines, [] );
			result = mode.binding.commitImportRestore( prepared, staged.preflight ); prepared = null;
			staged.commit(); committed = true; record.command.phase = target; mode.generation++;
			result.diagnostics = staged.refresh(); return result;
		} catch ( error ) { if ( committed ) { result.diagnostics = [ 'working-copy-import-refresh-failed' ]; return result; } throw unavailable(); }
		finally {
			mode.busy = false;
			if ( prepared ) { try { mode.binding.releaseImportRestore( prepared ); } catch ( ignored ) {} }
			if ( staged ) { try { staged.release(); } catch ( ignored ) {} }
			retireHistoryCommands( route );
			if ( !mode.active ) { cleanup( instance, mode ); }
		}
	}
	function routeStep( route, undo, query ) {
		try {
			const history = route.mode.history, index = history.historyIndex, next = index + ( undo ? -1 : 1 );
			const value = marker( history.history[ undo ? index : next ] );
			if ( value ) {
				const record = route.bank.get( value.id ); if ( !record ) { return false; }
				routedTimelines( route, record, undo ? 'after' : 'before', undo ? 'before' : 'after' );
				if ( !query ) { restoreRouted( route.instance, record.token, undo ? 'after' : 'before', undo ? 'before' : 'after' ); }
				return true;
			}
			if ( next >= 0 && next < history.history.length && !allowsTimeline( route, { ...history.captureTimeline(), historyIndex: next } ) ) { return false; }
			return null;
		} catch ( error ) { return false; }
	}
	function createHistoryRoute( instance, mode ) {
		const route = { instance, mode, bank: new Map() };
		const certificate = Object.freeze( {
			afterChange: () => retireHistoryCommands( route ),
			tryUndo: () => routeStep( route, true, false ), tryRedo: () => routeStep( route, false, false ),
			canUndo: () => routeStep( route, true, true ), canRedo: () => routeStep( route, false, true ),
			allowsTimeline: ( timeline, page ) => allowsTimeline( route, timeline, page ),
			allowsState: state => { const index = mode.history.history.indexOf( state );
				return index >= 0 && allowsTimeline( route, { ...mode.history.captureTimeline(), historyIndex: index } ); },
			allowsJump: target => {
				try {
					const index = mode.history.historyIndex;
					if ( !Number.isInteger( target ) || target < 0 || target > index ) { return false; }
					for ( let position = target + 1; position <= index; position++ ) { if ( marker( mode.history.history[ position ] ) ) { return false; } }
					return allowsTimeline( route, { ...mode.history.captureTimeline(), historyIndex: target } );
				} catch ( error ) { return false; }
			}
		} );
		historyCertificates.set( certificate, route ); return { route, certificate };
	}
	class PageOwnedWholePdfImportApplication {
		static isPdfImportHistoryRoute( value, history, application ) {
			const route = historyCertificates.get( value );
			return !!route && route.instance === application && route.mode.history === history && route.mode.active &&
				historyRoutes.get( route.mode ) === route;
		}

		/** Explicit opt-in only; no existing editor/Import caller enables this route. */
		enableHistory() {
			try {
				const mode = active( this );
				if ( historyRoutes.has( mode ) || mode.busy || mode.handles.size || mode.commands.size ) { throw unavailable(); }
				capture( this, () => {} ).check();
				const { route, certificate } = createHistoryRoute( this, mode );
				const History = load( 'HistoryManager', true );
				historyRoutes.set( mode, route );
				try {
					History.prototype.enablePdfImportHistory.call( mode.history, this, certificate );
					if ( !History.prototype.hasPdfImportHistory.call( mode.history, this ) ) { throw unavailable(); }
				} catch ( error ) { historyRoutes.delete( mode ); throw error; }
				mode.generation++;
			} catch ( error ) { throw unavailable(); }
		}
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
				const historyPlan = markImport( mode, timelines );
				const page = preview.pages.find( value => value.page === preview.activePage );
				staged = participants( guard, preview, timelines.after, page ? page.importedLayerIds : [] );
				const token = Object.freeze( Object.create( null ) ), command = { mode, phase: 'after', timelines, released: false };
				result = mode.binding.commitPreparedImport( prepared, staged.preflight ); prepared = null;
				staged.commit(); committed = true; record.consumed = true;
				command.before = result.beforeCheckpoint; command.after = result.checkpoint;
				commands.set( token, command ); mode.commands.add( token ); mode.generation++;
				if ( historyPlan ) { historyRoutes.get( mode ).bank.set( historyPlan.id, { ...historyPlan, token, command, savedJson: mode.session._savedJson } ); }
				result.command = token; result.diagnostics = staged.refresh();
				try { mode.binding.release( record.sourceHandle ); } catch ( error ) { result.diagnostics.push( 'working-copy-import-release-failed' ); }
				return result;
			} catch ( error ) { if ( committed ) { result.diagnostics = [ 'working-copy-import-refresh-failed' ]; return result; } throw unavailable(); }
			finally {
				if ( ownsBusy ) { record.mode.busy = false; }
				if ( prepared ) { try { record.mode.binding.releaseImportCommit( prepared ); } catch ( ignored ) {} }
				if ( staged ) { try { staged.release(); } catch ( ignored ) {} }
				if ( ownsBusy && historyRoutes.has( record.mode ) ) { retireHistoryCommands( historyRoutes.get( record.mode ) ); }
				if ( ownsBusy && !record.mode.active ) { cleanup( this, record.mode ); }
			}
		}
		undo( command ) { return this._restore( command, 'after', 'before' ); }
		redo( command ) { return this._restore( command, 'before', 'after' ); }
		_restore( token, expected, target ) {
			if ( historyRoutes.has( active( this ) ) ) { return restoreRouted( this, token, expected, target ); }
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
			const route = historyRoutes.get( mode );
			if ( route ) {
				const record = Array.from( route.bank.values() ).find( value => value.token === token );
				if ( record ) { record.phase = command.phase; record.command = null; record.token = null; delete record.savedJson; }
			}
			commands.delete( token );
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
