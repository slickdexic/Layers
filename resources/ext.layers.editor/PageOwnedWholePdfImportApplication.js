/** Explicitly invoked whole-PDF Import application; no registered editor callers. */
'use strict';

( function () {
	const instances = new WeakMap(), handles = new WeakMap(), commands = new WeakMap();
	const historyRoutes = new WeakMap(), historyCertificates = new WeakMap();
	const draftRecoveryHandles = new WeakMap(), draftRecoverySets = new WeakMap();
	const publicationRoutes = new WeakMap(), publicationModes = new WeakMap(), publicationProofs = new WeakMap();
	const weakSet = Function.call.bind( WeakMap.prototype.set ), weakDelete = Function.call.bind( WeakMap.prototype.delete );
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
		for ( const handle of Array.from( draftRecoverySets.get( mode ) || [] ) ) { try { instance.releaseDraftRecovery( handle ); } catch ( ignored ) {} }
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
	function draftTimelineRows( mode, timelines ) {
		return Array.from( timelines, ( [ page, timeline ] ) => {
			if ( !Number.isInteger( page ) || page < 1 || page > mode.session._pdf.pageCount ) { throw unavailable(); }
			return { page, timeline: mode.history.preflightTimeline( timeline ) };
		} ).sort( ( left, right ) => left.page - right.page );
	}
	function draftHistory( route ) {
		const { mode } = route, timelines = effectiveTimelines( mode ), groups = [], seen = new Set();
		for ( const [ page, timeline ] of timelines ) { if ( !allowsTimeline( route, timeline, page ) ) { throw unavailable(); } }
		for ( const record of route.bank.values() ) {
			const command = record.command, phase = command ? command.phase : record.phase;
			if ( ![ 'before', 'after' ].includes( phase ) || !record.entries.size ) { throw unavailable(); }
			const entries = Array.from( record.entries, ( [ page, entry ] ) => {
				const timeline = timelines.get( page ); if ( !timeline ) { throw unavailable(); }
				const index = location( route, record, timeline, page );
				if ( command && index < 1 ) { throw unavailable(); }
				return { page, entry };
			} ).sort( ( left, right ) => left.page - right.page );
			let checkpointData = null, commandTimelines = null;
			if ( command ) {
				if ( command.mode !== mode || command.released || commands.get( record.token ) !== command ||
					!mode.commands.has( record.token ) || record.savedJson !== mode.session._savedJson ||
					command.timelines.pages.length !== entries.length ||
					command.timelines.pages.some( page => !record.entries.has( page ) ) ) { throw unavailable(); }
				seen.add( record.token );
				checkpointData = { before: mode.binding.inspectImportCheckpoint( command.before ),
					after: mode.binding.inspectImportCheckpoint( command.after ) };
				commandTimelines = { pages: command.timelines.pages.slice(),
					before: draftTimelineRows( mode, command.timelines.before ), after: draftTimelineRows( mode, command.timelines.after ) };
			}
			groups.push( { id: record.id, phase, retired: !command, entries, checkpoints: checkpointData, timelines: commandTimelines } );
		}
		if ( seen.size !== mode.commands.size ) { throw unavailable(); }
		return { version: 1, activePage: mode.session.getPdfStatus().page,
			timelines: draftTimelineRows( mode, timelines ), groups: groups.sort( ( left, right ) => left.id.localeCompare( right.id ) ) };
	}
	function recoveryEntry( instance, handle ) {
		const mode = active( instance ), record = draftRecoveryHandles.get( handle );
		if ( !record || record.mode !== mode || record.consumed || record.released || record.bindingReleased ) { throw unavailable(); }
		record.guard.check(); return record;
	}

	function publicationFailure( code ) {
		const error = new Error( code ); error.code = code; return error;
	}
	function publicationParticipants( record ) {
		const { mode, instance, generation, methods } = record;
		if ( active( instance ) !== mode || mode.generation !== generation || !mode.busy || !mode.bridge.saving ||
			mode.bridge.disposed || mode.bridge.reconciling || !mode.bridge.loaded || mode.bridge.editor !== mode.editor ||
			mode.bridge.session !== mode.session || mode.bridge.pdfCoordinator !== mode.coordinator ||
			mode.coordinator.bridge !== mode.bridge || mode.coordinator.stage || mode.coordinator.committing || mode.coordinator.recovering ||
			mode.editor.isDestroyed || mode.editor.canvasManager !== mode.canvas || mode.canvas.isDestroyed || mode.canvas.editor !== mode.editor ||
			mode.editor.stateManager !== mode.store || mode.store.editor !== mode.editor ||
			mode.editor.historyManager !== mode.history || mode.history.editor !== mode.editor ||
			mode.canvas.selectionManager !== mode.selection || mode.selection.canvasManager !== mode.canvas ||
			!mode.store.isWorkingCopyAlive() || mode.store.isLocked || mode.store._isProcessingPending ||
			mode.store.pendingOperations.length || mode.store.lockingQueue.length || mode.store.lockTimeout !== null ||
			mode.store.lockAutoRecoveryTimeout !== null || mode.history.isDestroyed || mode.history.batchMode ||
			!mode.ownsSession.call( mode.binding, mode.session ) || mode.session._phase !== 'saving' ) { throw unavailable(); }
		mode.Store.checkWorkingCopyMethods( methods );
	}
	function savedTimelines( mode, source, snapshot ) {
		return new Map( Array.from( source, ( [ page, previous ] ) => {
			const timeline = mode.history.copyTimeline( previous ), saved = member( snapshot, mode, page );
			timeline.lastSaveHistoryIndex = -1;
			if ( saved ) {
				for ( let index = timeline.history.length - 1; index >= 0; index-- ) {
					if ( equal( timeline.history[ index ].layers, saved.layers ) ) { timeline.lastSaveHistoryIndex = index; break; }
				}
			}
			return [ page, mode.history.preflightTimeline( timeline ) ];
		} ) );
	}
	function publicationHistory( record, request ) {
		const { mode } = record, route = historyRoutes.get( mode ), base = JSON.parse( request.snapshotJson );
		if ( !route ) { throw unavailable(); }
		const timelines = savedTimelines( mode, effectiveTimelines( mode ), base ), current = timelines.get( mode.session.getPdfStatus().page );
		if ( !current ) { throw unavailable(); }
		const slots = fields.map( key => slot( mode.history, key, current[ key ] ) );
		slots.push( slot( mode.coordinator, 'timelines', timelines ), slot( mode.bridge, 'saving', false ) );
		for ( const entry of route.bank.values() ) {
			if ( !entry.command ) { continue; }
			if ( !mode.commands.has( entry.token ) || commands.get( entry.token ) !== entry.command || entry.command.released ||
				entry.savedJson !== mode.session._savedJson ) { throw unavailable(); }
			slots.push( slot( entry, 'savedJson', request.snapshotJson ), slot( entry.command, 'timelines', {
				...entry.command.timelines, before: savedTimelines( mode, entry.command.timelines.before, base ),
				after: savedTimelines( mode, entry.command.timelines.after, base ) } ) );
		}
		const observed = [ mode.Store.observeWorkingCopyObject( mode.history, false ), mode.Store.observeWorkingCopyObject( mode.history.history ),
			mode.Store.observeWorkingCopyObject( mode.coordinator, false ) ];
		const check = () => { publicationParticipants( record ); checkSlots( slots ); observed.forEach( mode.Store.checkWorkingCopyObservation ); };
		check(); return { check, commit: () => { for ( const value of slots ) { define( value.object, value.key, value.descriptor ); } } };
	}
	function recoveryTimelines( mode, preview ) {
		const history = mode.Store.copyWorkingCopyValue( preview.history ), ids = new Map(), used = new Set();
		for ( const group of history.groups ) {
			const bytes = new Uint8Array( 16 ); window.crypto.getRandomValues( bytes );
			const id = Array.from( bytes, value => value.toString( 16 ).padStart( 2, '0' ) ).join( '' );
			if ( used.has( id ) || history.groups.some( value => value.id === id ) ) { throw unavailable(); }
			used.add( id ); ids.set( group.id, id );
		}
		const remap = timeline => {
			for ( const entry of timeline.history ) {
				const value = marker( entry ); if ( value && ids.has( value.id ) ) { value.id = ids.get( value.id ); }
			}
			return mode.history.preflightTimeline( timeline );
		};
		const rows = values => new Map( values.map( row => [ row.page, remap( row.timeline ) ] ) );
		const timelines = rows( history.timelines ), bank = new Map(), commandSet = new Set(), commandRows = [];
		if ( !timelines.has( preview.activePage ) ) {
			const base = member( JSON.parse( mode.session._savedJson ), mode, preview.activePage );
			timelines.set( preview.activePage, mode.coordinator.freshTimeline( { ...preview.editorState, id: preview.activeSurfaceId },
				!!base && equal( base.layers, preview.editorState.layers ) ) );
		}
		for ( const group of history.groups ) {
			const entries = new Map( group.entries.map( row => {
				row.entry.pdfImportGroup.id = ids.get( group.id ); return [ row.page, row.entry ];
			} ) );
			let command = null, token = null;
			if ( !group.retired ) {
				const pair = preview.commands.find( row => row.id === group.id ); if ( !pair ) { throw unavailable(); }
				token = Object.freeze( Object.create( null ) );
				command = { mode, phase: group.phase, released: false, before: pair.beforeCheckpoint, after: pair.checkpoint,
					timelines: { pages: group.timelines.pages.slice(), before: rows( group.timelines.before ), after: rows( group.timelines.after ) } };
				commandSet.add( token ); commandRows.push( [ token, command ] );
			}
			bank.set( ids.get( group.id ), { id: ids.get( group.id ), entries, phase: group.phase, command, token,
				...( command ? { savedJson: mode.session._savedJson } : {} ) } );
		}
		return { timelines, bank, commandSet, commandRows };
	}
	class PageOwnedWholePdfImportApplication {
		/** Separately invoked recovery; existing draft storage and controls do not call this. */
		async prepareDraftRecovery( input, assertCurrent = () => {} ) {
			let native, mode;
			try {
				mode = active( this );
				if ( !historyRoutes.has( mode ) || mode.busy || typeof assertCurrent !== 'function' ) { throw unavailable(); }
				const original = capture( this, assertCurrent ), methods = [
					[ this, [ 'prepareDraftRecovery', 'inspectDraftRecovery', 'commitDraftRecovery', 'releaseDraftRecovery' ] ],
					[ mode.binding, [ 'prepareDraftRecovery', 'inspectDraftRecovery', 'revalidateDraftRecovery', 'commitDraftRecovery', 'releaseDraftRecovery' ] ]
				].flatMap( ( [ object, keys ] ) => keys.map( key => mode.Store.captureWorkingCopyMethod( object, key ) ) );
				const guard = { mode, check: () => { original.check(); mode.Store.checkWorkingCopyMethods( methods ); } };
				native = await mode.binding.prepareDraftRecovery( input, guard.check ); guard.check();
				const handle = Object.freeze( Object.create( null ) );
				draftRecoveryHandles.set( handle, { mode, guard, native, consumed: false, released: false, bindingReleased: false } );
				if ( !draftRecoverySets.has( mode ) ) { draftRecoverySets.set( mode, new Set() ); }
				draftRecoverySets.get( mode ).add( handle ); return handle;
			} catch ( error ) {
				if ( native ) { try { mode.binding.releaseDraftRecovery( native ); } catch ( ignored ) {} } throw unavailable();
			}
		}

		inspectDraftRecovery( handle ) {
			try {
				const record = recoveryEntry( this, handle ), preview = record.mode.binding.inspectDraftRecovery( record.native );
				delete preview.commands; record.guard.check(); return preview;
			} catch ( error ) { throw unavailable(); }
		}

		async commitDraftRecovery( handle ) {
			let record, staged, result, committed = false, ownsBusy = false;
			try {
				record = recoveryEntry( this, handle ); const { mode, guard } = record;
				if ( mode.busy ) { throw unavailable(); } mode.busy = true; ownsBusy = true;
				await mode.binding.revalidateDraftRecovery( record.native ); recoveryEntry( this, handle );
				const preview = mode.binding.inspectDraftRecovery( record.native ), history = recoveryTimelines( mode, preview );
				staged = participants( guard, preview, history.timelines, [] );
				const route = historyRoutes.get( mode ), oldCommands = Array.from( mode.commands, token => [ token, commands.get( token ) ] );
				if ( !route || oldCommands.some( ( [ , command ] ) => !command || command.mode !== mode || command.released ) ) { throw unavailable(); }
				result = mode.binding.commitDraftRecovery( record.native, staged.preflight );
				staged.commit();
				for ( const [ token, command ] of oldCommands ) { command.released = true; weakDelete( commands, token ); }
				for ( const [ token, command ] of history.commandRows ) { weakSet( commands, token, command ); }
				route.bank = history.bank; mode.commands = history.commandSet; mode.generation++;
				record.consumed = true; committed = true;
				result.diagnostics = staged.refresh(); return result;
			} catch ( error ) {
				if ( committed ) { result.diagnostics = [ 'working-copy-import-refresh-failed' ]; return result; } throw unavailable();
			} finally {
				if ( ownsBusy ) {
					record.mode.busy = false;
					try { record.mode.binding.releaseDraftRecovery( record.native ); } catch ( ignored ) {} record.bindingReleased = true;
				}
				if ( staged ) { try { staged.release(); } catch ( ignored ) {} }
				if ( record && !record.mode.active ) { cleanup( this, record.mode ); }
			}
		}

		releaseDraftRecovery( handle ) {
			const mode = instances.get( this ), record = draftRecoveryHandles.get( handle );
			if ( !record || record.mode !== mode || record.released || mode.busy ) { throw unavailable(); }
			record.released = true; draftRecoverySets.get( mode ).delete( handle );
			if ( !record.bindingReleased ) { mode.binding.releaseDraftRecovery( record.native ); record.bindingReleased = true; }
		}

		/** Capture a complete inert recovery record; never store it or restore capabilities. */
		captureDraft() {
			try {
				const mode = active( this ), route = historyRoutes.get( mode );
				if ( !route || mode.busy ) { throw unavailable(); }
				const guard = capture( this, () => {} ), methods = [
					[ this, 'captureDraft' ], [ mode.binding, 'captureImportDraft' ],
					[ mode.binding, 'inspectImportCheckpoint' ], [ mode.Store, 'copyWorkingCopyValue' ]
				].map( ( [ object, key ] ) => mode.Store.captureWorkingCopyMethod( object, key ) );
				const session = mode.binding.captureImportDraft(), history = draftHistory( route );
				const result = mode.Store.copyWorkingCopyValue( { format: 'layers-whole-pdf-import-draft', version: 1, session, history } );
				mode.Store.checkWorkingCopyMethods( methods ); guard.check(); return result;
			} catch ( error ) { throw unavailable(); }
		}

		static isPdfImportHistoryRoute( value, history, application ) {
			const route = historyCertificates.get( value );
			return !!route && route.instance === application && route.mode.history === history && route.mode.active &&
				historyRoutes.get( route.mode ) === route;
		}

		static isPublicationRoute( certificate, bridge, application ) {
			const record = publicationRoutes.get( certificate );
			return !!record && record.instance === application && record.mode.bridge === bridge && record.mode.active &&
				publicationModes.get( record.mode ) === record;
		}

		static isConfirmedPublicationFor( proof, binding, token, request ) {
			const record = publicationProofs.get( proof );
			return !!record && record.binding === binding && record.token === token && record.mode.active &&
				record.mode.busy && equal( record.request, request ) && proof.revisionId === record.revisionId;
		}

		/** Explicitly connect the real Bridge Save entry; no production controller enables it. */
		enablePublication( publisher ) {
			const mode = active( this ), Client = load( 'PageOwnedWholePdfImportPublishClient' );
			if ( !( publisher instanceof Client ) || !historyRoutes.has( mode ) || publicationModes.has( mode ) || mode.busy ) { throw unavailable(); }
			const guard = capture( this, () => {} ), captured = mode.Store.captureWorkingCopyMethod( publisher, 'publish' );
			if ( captured.owner !== Client.prototype || captured.method !== Client.prototype.publish ) { throw unavailable(); }
			const certificate = Object.freeze( Object.create( null ) ), record = { instance: this, mode, publisher, captured };
			guard.check(); publicationRoutes.set( certificate, record ); publicationModes.set( mode, record );
			try { mode.bridge.enableWholePdfImportPublication( this, certificate ); }
			catch ( error ) { publicationRoutes.delete( certificate ); publicationModes.delete( mode ); throw unavailable(); }
			mode.generation++;
		}

		/** Keep the submitted bytes fixed; confirm every saved-base/history guard synchronously. */
		async savePublication( certificate, summary = '', beforePublish ) {
			const route = publicationRoutes.get( certificate ), mode = active( this );
			if ( !route || !PageOwnedWholePdfImportApplication.isPublicationRoute( certificate, mode.bridge, this ) || mode.busy ||
				Array.from( mode.handles ).some( handle => { const record = handles.get( handle ); return !record || !record.consumed; } ) ||
				typeof summary !== 'string' || ( beforePublish !== undefined && typeof beforePublish !== 'function' ) ) { throw unavailable(); }
			mode.bridge._requireActive(); mode.coordinator.invalidate(); mode.bridge.capture();
			const guard = capture( this, () => {} ), tokens = [];
			for ( const token of mode.commands ) {
				const command = commands.get( token );
				if ( !command || command.mode !== mode || command.released ) { throw unavailable(); } tokens.push( command.before, command.after );
			}
			const methods = [ route.captured, mode.Store.captureWorkingCopyMethod( this, 'savePublication' ),
				...[ 'prepareImportPublication', 'inspectImportPublication', 'beginImportPublication', 'preparePublicationConfirmation',
					'commitPublicationConfirmation', 'releaseImportPublication' ].map( key => mode.Store.captureWorkingCopyMethod( mode.binding, key ) ),
				...[ 'capture', 'getLiveState' ].map( key => mode.Store.captureWorkingCopyMethod( mode.bridge, key ) ),
				...[ 'captureTimeline', 'copyTimeline', 'preflightTimeline' ].map( key => mode.Store.captureWorkingCopyMethod( mode.history, key ) ) ];
			const record = { mode, instance: this, generation: mode.generation, methods }, check = () => publicationParticipants( record );
			let token, proof, committed = false, dispatched = false, result;
			try {
				mode.Store.checkWorkingCopyMethods( methods );
				token = mode.binding.prepareImportPublication( tokens, guard.check, check );
				const request = mode.binding.inspectImportPublication( token ), bridgeLock = slot( mode.bridge, 'saving', true );
				const publisher = request.sources.length ? route.captured : mode.Store.captureWorkingCopyMethod( mode.session._publisher, 'publish' );
				if ( !request.sources.length ) { methods.push( publisher ); }
				const outgoing = request.sources.length ? { ...request, summary } :
					{ owner: mode.session._owner, pageId: request.pageId, baseRevisionId: request.baseRevisionId, snapshotJson: request.snapshotJson, summary };
				checkSlots( [ bridgeLock ] ); mode.binding.beginImportPublication( token );
				define( bridgeLock.object, bridgeLock.key, bridgeLock.descriptor ); mode.busy = true;
				if ( beforePublish ) {
					try { await beforePublish(); } catch ( error ) { throw publicationFailure( 'layers-draft-storage-failed' ); }
				}
				check(); mode.binding.inspectImportPublication( token ); dispatched = true;
				const response = await publisher.descriptor.value.call( publisher.object, outgoing );
				check(); mode.binding.inspectImportPublication( token );
				if ( !response || !Number.isInteger( response.revisionId ) || response.revisionId < request.baseRevisionId ||
					response.revisionId > 2147483647 || ( response.revisionId === request.baseRevisionId &&
					( request.sources.length || !equal( JSON.parse( request.snapshotJson ), JSON.parse( mode.session._savedJson ) ) ) ) ) {
					throw publicationFailure( 'layers-publication-outcome-unknown' );
				}
				// Only a response from the captured actual transport can mint this confirmation.
				proof = Object.freeze( { revisionId: response.revisionId } );
				publicationProofs.set( proof, { binding: mode.binding, token, mode, request, revisionId: response.revisionId } );
				mode.bridge.capture(); check();
				const confirmation = mode.binding.preparePublicationConfirmation( token, proof ), history = publicationHistory( record, request );
				result = mode.binding.commitPublicationConfirmation( token, confirmation, history.check );
				history.commit(); mode.generation++; committed = true;
			} catch ( error ) {
				const known = new Set( [ 'layers-edit-conflict', 'layers-draft-storage-failed', 'layers-working-copy-import-unavailable',
					'layers-owner-edit-denied', 'layers-invalid-publication-request', 'layers-invalid-snapshot', 'layers-source-unavailable',
					'layers-main-model-change-denied', 'layers-publication-disabled',
					'layers-admission-unauthorized', 'layers-slot-removal-denied', 'layers-content-not-renderable', 'layers-edit-filtered',
					'badtoken', 'missingparam', 'permissiondenied', 'ratelimited', 'mustbeposted', 'maxbytes', 'outofrange' ] );
				let code = error && known.has( error.code ) ? error.code : 'layers-publication-outcome-unknown';
				if ( dispatched && code === 'layers-working-copy-import-unavailable' && mode.session._phase === 'saving' ) {
					// Local post-dispatch drift is uncertain; a native refusal keeps its explicit safe code.
					try { check(); mode.binding.inspectImportPublication( token ); } catch ( ignored ) { code = 'layers-publication-outcome-unknown'; }
				}
				if ( mode.session._phase !== 'disposed' ) {
					mode.session._phase = code === 'layers-edit-conflict' ? 'conflict' : code === 'layers-publication-outcome-unknown' ? 'uncertain' : 'ready';
				}
				throw publicationFailure( code );
			} finally {
				mode.busy = false; mode.bridge.saving = false;
				if ( proof ) { publicationProofs.delete( proof ); }
				if ( token ) { try { mode.binding.releaseImportPublication( token ); } catch ( ignored ) {} }
				if ( !committed && !mode.bridge.disposed ) {
					try { mode.bridge.capture(); mode.store.set( 'isDirty', mode.session.getStatus().dirty ); }
					catch ( ignored ) { try { mode.store.set( 'isDirty', true ); } catch ( ignoredAgain ) {} }
				}
				if ( !mode.active ) { cleanup( this, mode ); }
			}
			const diagnostics = [];
			for ( const refresh of [ () => retireHistoryCommands( historyRoutes.get( mode ) ),
				() => mode.store.set( 'isDirty', result.dirty ), () => mode.history.updateUndoRedoButtons() ] ) {
				try { refresh(); } catch ( ignored ) { diagnostics.push( 'working-copy-import-refresh-failed' ); }
			}
			return { ...result, editorStateValid: true, diagnostics };
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
