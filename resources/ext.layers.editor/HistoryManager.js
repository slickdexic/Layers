/**
 * History Manager for Layers Editor
 * Handles undo/redo functionality
 */
( function () {
	'use strict';

	/**
	 * Minimal typedef for CanvasManager used for JSDoc references in this file.
	 *
	 * @typedef {Object} CanvasManager
	 * @property {HTMLCanvasElement} canvas
	 * @property {CanvasRenderingContext2D} ctx
	 */

	/**
	 * HistoryManager class
	 *
	 * @class
	 */
	const workingCopyHistoryModes = new WeakMap();
	const workingCopyTimelineCopies = new WeakMap();
	const workingCopyDraftTimelineCertificates = new WeakSet();

	function workingHistoryError() {
		const error = new Error( 'Working-copy history unavailable' );
		error.code = 'layers-working-copy-history-unavailable';
		return error;
	}

	function workingHistoryEqual( left, right ) {
		if ( Object.is( left, right ) ) { return true; }
		if ( !left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray( left ) !== Array.isArray( right ) ) { return false; }
		const keys = Object.keys( left );
		return keys.length === Object.keys( right ).length && keys.every( key => Object.hasOwn( right, key ) && workingHistoryEqual( left[ key ], right[ key ] ) );
	}

	function workingHistoryAdmission( history, mode, batch = false ) {
		const { bridge, editor, session, store } = mode;
		if ( history.isDestroyed || history.editor !== editor || editor.historyManager !== history || editor.stateManager !== store ||
			bridge.editor !== editor || bridge.session !== session || !bridge.loaded || bridge.disposed || bridge.saving || bridge.reconciling || bridge.pdfCoordinator ||
			session._phase !== 'ready' || session._readOnly || session._reconciling || session._baseHasDrawings !== true ||
			session._pdf || session._pdfContext || session._pdfRecovery || store.isLocked || store._isProcessingPending ||
			!store.isWorkingCopyAlive() || store.pendingOperations.length || store.lockingQueue.length || store.lockTimeout !== null || store.lockAutoRecoveryTimeout !== null ||
			( !batch && history.batchMode ) ) {
			throw workingHistoryError();
		}
	}

	function workingHistoryGuard( history, mode, batch = false ) {
		workingHistoryAdmission( history, mode, batch );
		const { Store, editor, session, bridge, store } = mode, observe = Store.observeWorkingCopyObject;
		const observations = [ observe( history, false ), observe( history.history ), observe( history.batchChanges ),
			observe( editor, false ), observe( editor.config || {} ), observe( bridge, false ), observe( session, false ),
			observe( session._snapshot ), observe( store, false ), observe( store.state ), observe( store.pendingOperations ), observe( store.lockingQueue ) ];
		if ( session._newSurface ) { observations.push( observe( session._newSurface ) ); }
		if ( editor.canvasManager ) {
			observations.push( observe( editor.canvasManager, false ) );
			if ( editor.canvasManager.selectionManager ) { observations.push( observe( editor.canvasManager.selectionManager, false ) ); }
			for ( const owner of [ editor.canvasManager, editor.canvasManager.selectionManager ].filter( Boolean ) ) {
				for ( const descriptor of Object.values( Object.getOwnPropertyDescriptors( owner ) ) ) {
					if ( Array.isArray( descriptor.value ) ) { observations.push( observe( descriptor.value ) ); }
				}
			}
		}
		const entries = [ ...[ 'getWorkingCopyLiveState', 'prepareWorkingCopyDisplay', 'preflightWorkingCopyDisplay', 'commitWorkingCopyDisplay', 'refreshWorkingCopyDisplay', 'prepareWorkingCopyDisplayCommit' ].map( key => [ bridge, key ] ),
			...[ 'captureWorkingCopyCheckpoint', 'inspectWorkingCopyCheckpoint', 'prepareWorkingCopyState', 'inspectPreparedWorkingCopyState', 'commitPreparedWorkingCopyState',
				'prepareWorkingCopyRestore', 'inspectPreparedWorkingCopyRestore', 'commitWorkingCopyRestore' ].map( key => [ session, key ] ),
			...[ 'prepareWorkingCopyPatch', 'preflightWorkingCopyPatch', 'commitWorkingCopyPatch', 'notifyWorkingCopyPatch', 'isWorkingCopyAlive', 'prepareWorkingCopyPatchCommit' ].map( key => [ store, key ] ),
			...[ 'saveState', 'undo', 'redo', 'restoreState', 'captureTimeline', 'preflightTimeline', 'restoreTimeline', 'updateUndoRedoButtons' ].map( key => [ history, key ] ) ];
		const methods = entries.map( ( [ object, key ] ) => Store.captureWorkingCopyMethod( object, key ) );
		return { observations, methods, mode, history, batch };
	}

	function workingHistoryCheck( guard ) {
		workingHistoryAdmission( guard.history, guard.mode, guard.batch );
		guard.observations.forEach( guard.mode.Store.checkWorkingCopyObservation );
		guard.mode.Store.checkWorkingCopyMethods( guard.methods );
	}

	function workingHistoryCall( guard, object, key, ...args ) {
		const method = guard.methods.find( item => item.object === object && item.key === key );
		if ( !method ) { throw workingHistoryError(); }
		const result = method.method.call( object, ...args );
		workingHistoryCheck( guard );
		return result;
	}

	function workingHistoryData( history ) {
		return { history: history.history, historyIndex: history.historyIndex,
			maxHistorySteps: history.maxHistorySteps, lastSaveHistoryIndex: history.lastSaveHistoryIndex };
	}

	function workingHistoryDraftGuard( history, mode ) {
		const guard = workingHistoryGuard( history, mode );
		for ( const [ owner, keys ] of [ [ mode.session, [ 'getWorkingCopyImportIdentity',
			'prepareWorkingCopyDraftCheckpoint', 'prepareWorkingCopyDraftRestore',
			'inspectWorkingCopyDraftRestore', 'commitWorkingCopyDraftRestore', 'revalidate' ] ],
		[ history, [ 'captureWorkingCopyDraftTimeline', 'prepareWorkingCopyDraftTimeline' ] ] ] ) {
			guard.methods.push( ...keys.map( key => mode.Store.captureWorkingCopyMethod( owner, key ) ) );
		}
		return guard;
	}

	function workingHistoryAssignments( history, values ) {
		for ( const key of Object.keys( values ) ) {
			const descriptor = Object.getOwnPropertyDescriptor( history, key );
			if ( descriptor ? !Object.hasOwn( descriptor, 'value' ) || !descriptor.writable : !Object.isExtensible( history ) || key in history ) {
				throw workingHistoryError();
			}
		}
	}

	function workingHistoryAssign( history, values ) {
		for ( const [ key, value ] of Object.entries( values ) ) {
			Object.defineProperty( history, key, { value, ...( Object.hasOwn( history, key ) ? {} : { writable: true, configurable: true, enumerable: true } ) } );
		}
	}

	function workingHistoryTrim( timeline, capacity ) {
		const remove = Math.max( 0, timeline.history.length - capacity );
		return { ...timeline, history: timeline.history.slice( remove ), historyIndex: Math.max( timeline.history.length ? 0 : -1, timeline.historyIndex - remove ),
			lastSaveHistoryIndex: timeline.lastSaveHistoryIndex < remove ? -1 : timeline.lastSaveHistoryIndex - remove };
	}

	function workingHistoryRefresh( history, mode, display ) {
		try { mode.refreshDiagnostic = mode.bridge.refreshWorkingCopyDisplay( display ); }
		catch ( error ) { mode.refreshDiagnostic = [ 'working-copy-refresh-failed' ]; }
	}

	function workingHistoryTimeline( history, input ) {
		const mode = workingCopyHistoryModes.get( history ), association = workingCopyTimelineCopies.get( input );
		if ( !association || association.mode !== mode || !workingHistoryEqual( mode.Store.copyWorkingCopyValue( input ), association.data ) ) { throw workingHistoryError(); }
		return association;
	}

	const applicationHistoryCertificates = new WeakSet();

	class HistoryManager {
		/** Finite draft data only; checkpoint certificates stay private and are never serialized. */
		captureWorkingCopyDraftTimeline() {
			const mode = workingCopyHistoryModes.get( this );
			try {
				if ( !mode || this.isDestroyed || mode.bridge.disposed || !mode.bridge.loaded ||
					mode.editor !== this.editor || mode.editor.historyManager !== this ||
					mode.editor.stateManager !== mode.store || mode.bridge.editor !== mode.editor || mode.bridge.session !== mode.session || mode.bridge.pdfCoordinator ||
					mode.session._readOnly || mode.session._pdf || mode.session._pdfContext || mode.session._newSurface ||
					mode.session._baseHasDrawings !== true || !mode.store.isWorkingCopyAlive() ||
					![ 'ready', 'saving', 'conflict', 'uncertain' ].includes( mode.session._phase ) ) { throw workingHistoryError(); }
				const copy = mode.Store.copyWorkingCopyValue, observations = [
					mode.Store.observeWorkingCopyObject( this, false ), mode.Store.observeWorkingCopyObject( this.history ),
					mode.Store.observeWorkingCopyObject( mode.session, false ), mode.Store.observeWorkingCopyObject( mode.session._snapshot ),
					mode.Store.observeWorkingCopyObject( mode.editor, false ), mode.Store.observeWorkingCopyObject( mode.bridge, false ),
					mode.Store.observeWorkingCopyObject( mode.store, false ), mode.Store.observeWorkingCopyObject( mode.store.state ) ];
				const methods = [ mode.Store.captureWorkingCopyMethod( mode.bridge, 'getWorkingCopyDraftLiveState' ) ];
				const identity = { owner: mode.session._owner, pageId: mode.session._pageId,
					revisionId: mode.session._revisionId, surfaceId: mode.session._surfaceId };
				const timeline = copy( workingHistoryData( this ) );
				timeline.history.forEach( ( entry, index ) => {
					const association = mode.entries.get( this.history[ index ] );
					if ( !association ) { throw workingHistoryError(); }
					entry.workingState = copy( association.workingState );
					if ( !workingHistoryEqual( entry.layers, entry.workingState.layers ) ) { throw workingHistoryError(); }
				} );
				// A successful publication can establish a new base before the UI marks its entry saved.
				const saved = JSON.parse( mode.session._savedJson ).surfaces.find( s => s.id === identity.surfaceId );
				const savedState = { surfaceId: saved.id, canvas: saved.canvas, layers: saved.layers,
					...( Object.hasOwn( saved, 'readingOrder' ) ? { readingOrder: saved.readingOrder } : {} ) };
				if ( !workingHistoryEqual( timeline.history[ timeline.lastSaveHistoryIndex ] &&
					timeline.history[ timeline.lastSaveHistoryIndex ].workingState, savedState ) ) {
					timeline.lastSaveHistoryIndex = timeline.history.findIndex( entry => workingHistoryEqual( entry.workingState, savedState ) );
				}
				const live = mode.bridge.getWorkingCopyDraftLiveState(), selected = mode.session._snapshot.surfaces.find( s => s.id === identity.surfaceId );
				const workingState = { surfaceId: selected.id, ...copy( live ) };
				if ( Object.hasOwn( selected, 'readingOrder' ) ) {
					const oldIds = new Set( selected.layers.map( layer => layer.id ) ), ids = new Set( live.layers.map( layer => layer.id ) );
					workingState.readingOrder = selected.readingOrder.filter( id => !oldIds.has( id ) || ids.has( id ) );
				}
				observations.forEach( mode.Store.checkWorkingCopyObservation ); mode.Store.checkWorkingCopyMethods( methods );
				return copy( { version: 1, identity, timeline, workingState } );
			} catch ( error ) { throw workingHistoryError(); }
		}

		hasWorkingCopyHistory( bridge ) {
			const mode = workingCopyHistoryModes.get( this );
			return !!mode && mode.bridge === bridge;
		}

		static isWorkingCopyDraftTimeline( transaction ) {
			return workingCopyDraftTimelineCertificates.has( transaction );
		}

		/** Rebuild associations using current native identity; untrusted data supplies no permissions. */
		prepareWorkingCopyDraftTimeline( input ) {
			const mode = workingCopyHistoryModes.get( this ), checkpoints = [];
			let committed = false, released = false;
			try {
				const guard = workingHistoryDraftGuard( this, mode ), copy = mode.Store.copyWorkingCopyValue;
				const data = copy( input ), identity = workingHistoryCall( guard, mode.session, 'getWorkingCopyImportIdentity' );
				if ( !data || Object.keys( data ).length !== 4 || data.version !== 1 ||
					!workingHistoryEqual( data.identity, identity ) ) { throw workingHistoryError(); }
				const values = data.timeline;
				if ( !values || Object.keys( values ).sort().join() !==
					'history,historyIndex,lastSaveHistoryIndex,maxHistorySteps' || !Array.isArray( values.history ) ||
					!values.history.length || values.history.length > this.maxHistorySteps ||
					values.maxHistorySteps !== this.maxHistorySteps || !Number.isInteger( values.historyIndex ) ||
					values.historyIndex < 0 || values.historyIndex >= values.history.length ||
					!Number.isInteger( values.lastSaveHistoryIndex ) || values.lastSaveHistoryIndex < -1 ||
					values.lastSaveHistoryIndex >= values.history.length ) { throw workingHistoryError(); }
				const saved = JSON.parse( mode.session._savedJson ).surfaces.find( s => s.id === identity.surfaceId );
				const savedState = { surfaceId: saved.id, canvas: saved.canvas, layers: saved.layers,
					...( Object.hasOwn( saved, 'readingOrder' ) ? { readingOrder: saved.readingOrder } : {} ) };
				if ( values.lastSaveHistoryIndex >= 0 && !workingHistoryEqual(
					values.history[ values.lastSaveHistoryIndex ].workingState, savedState ) ) { throw workingHistoryError(); }
				if ( !workingHistoryEqual( values.history[ values.historyIndex ].workingState, data.workingState ) ) {
					values.history = values.history.slice( 0, values.historyIndex + 1 );
					values.history.push( { layers: copy( data.workingState.layers ),
						workingState: copy( data.workingState ), timestamp: Date.now(),
						description: mw.msg( 'layers-page-working-copy-recovered-edits' ) } );
					values.historyIndex++;
					if ( values.lastSaveHistoryIndex >= values.historyIndex ) { values.lastSaveHistoryIndex = -1; }
					Object.assign( values, workingHistoryTrim( values, values.maxHistorySteps ) );
				}
				const associations = values.history.map( entry => {
					if ( !entry || !Array.isArray( entry.layers ) || typeof entry.description !== 'string' ||
						!Number.isFinite( entry.timestamp ) || entry.timestamp < 0 ||
						!workingHistoryEqual( entry.layers, entry.workingState && entry.workingState.layers ) ) { throw workingHistoryError(); }
					const checkpoint = workingHistoryCall( guard, mode.session, 'prepareWorkingCopyDraftCheckpoint', entry.workingState );
					checkpoints.push( checkpoint );
					const state = workingHistoryCall( guard, mode.session, 'inspectWorkingCopyCheckpoint', checkpoint );
					if ( !workingHistoryEqual( state, entry.workingState ) ) { throw workingHistoryError(); }
					return { checkpoint, workingState: state };
				} );
				workingHistoryAssignments( this, values ); workingHistoryCheck( guard );
				const preflight = () => {
					if ( released || committed || workingCopyHistoryModes.get( this ) !== mode ) { throw workingHistoryError(); }
					workingHistoryCheck( guard ); workingHistoryAssignments( this, values );
				};
				const transaction = Object.freeze( {
					checkpoint: associations[ values.historyIndex ].checkpoint,
					inspect: () => copy( data.workingState ), preflight,
					commit: () => {
						if ( released || committed ) { throw workingHistoryError(); }
						values.history.forEach( ( entry, index ) => mode.entries.set( entry, associations[ index ] ) );
						workingHistoryAssign( this, values ); committed = true;
					},
					release: () => {
						if ( released ) { return; } released = true;
						if ( !committed ) { checkpoints.forEach( checkpoint => mode.session.releaseWorkingCopyCheckpoint( checkpoint ) ); }
					}
				} );
				preflight(); workingCopyDraftTimelineCertificates.add( transaction ); return transaction;
			} catch ( error ) {
				checkpoints.forEach( checkpoint => { try { mode.session.releaseWorkingCopyCheckpoint( checkpoint ); } catch ( cleanupError ) {} } );
				throw workingHistoryError();
			}
		}

		static isWorkingCopyImportHistory( value ) {
			return applicationHistoryCertificates.has( value );
		}

		captureWorkingCopyImportHistory( bridge ) {
			const mode = workingCopyHistoryModes.get( this );
			if ( !mode || mode.bridge !== bridge ) { throw workingHistoryError(); }
			const guard = workingHistoryGuard( this, mode ), history = this;
			const association = mode.entries.get( this.history[ this.historyIndex ] );
			if ( !association ) { throw workingHistoryError(); }
			const live = workingHistoryCall( guard, bridge, 'getWorkingCopyLiveState' );
			const state = workingHistoryCall( guard, mode.session, 'inspectWorkingCopyCheckpoint', association.checkpoint );
			const current = mode.Store.copyWorkingCopyValue( mode.session._snapshot.surfaces.find( surface => surface.id === state.surfaceId ) );
			if ( !workingHistoryEqual( live, { canvas: state.canvas, layers: state.layers } ) || !workingHistoryEqual( current.canvas, state.canvas ) || !workingHistoryEqual( current.layers, state.layers ) ||
				Object.hasOwn( current, 'readingOrder' ) !== Object.hasOwn( state, 'readingOrder' ) || !workingHistoryEqual( current.readingOrder, state.readingOrder ) ) { throw workingHistoryError(); }
			const witness = Object.freeze( { preflight: () => { mode.Store.checkWorkingCopyMethods( guard.methods ); workingHistoryCheck( guard );
				if ( workingCopyHistoryModes.get( history ) !== mode || mode.entries.get( history.history[ history.historyIndex ] ) !== association ) { throw workingHistoryError(); } } } );
			witness.preflight(); applicationHistoryCertificates.add( witness ); return witness;
		}

		prepareWorkingCopyImportHistory( bridge, preview ) {
			const witness = this.captureWorkingCopyImportHistory( bridge ), mode = workingCopyHistoryModes.get( this ), history = this;
			const data = mode.Store.copyWorkingCopyValue( preview );
			const entry = { layers: data.editorState.layers, workingState: data.workingState, importedLayerIds: data.importedLayerIds,
				source: data.source, differentFileVersion: data.differentFileVersion, description: 'Import', timestamp: Date.now() };
			const kept = this.history.slice( 0, this.historyIndex + 1 );
			const values = workingHistoryTrim( { history: kept.concat( entry ), historyIndex: kept.length, maxHistorySteps: this.maxHistorySteps,
				lastSaveHistoryIndex: this.lastSaveHistoryIndex > this.historyIndex ? -1 : this.lastSaveHistoryIndex }, this.maxHistorySteps );
			workingHistoryAssignments( this, values );
			const association = { checkpoint: null, workingState: data.workingState }; let committed = false;
			const transaction = Object.freeze( {
				preflight: () => { if ( committed ) { throw workingHistoryError(); } witness.preflight(); },
				commit: checkpoint => { association.checkpoint = checkpoint; mode.entries.set( entry, association ); workingHistoryAssign( history, values ); committed = true; },
				refresh: diagnostics => { mode.refreshDiagnostic = diagnostics.slice(); }
			} );
			witness.preflight(); applicationHistoryCertificates.add( transaction ); return transaction;
		}

		enableWorkingCopyHistory( bridge ) {
			try {
				if ( workingCopyHistoryModes.has( this ) || !bridge || bridge.editor !== this.editor || !this.editor || !this.editor.stateManager ) { throw workingHistoryError(); }
				const store = this.editor.stateManager, descriptor = Object.getOwnPropertyDescriptor( Object.getPrototypeOf( store ), 'constructor' );
				if ( !descriptor || typeof descriptor.value !== 'function' ) { throw workingHistoryError(); }
				const mode = { bridge, editor: this.editor, session: bridge.session, store, Store: descriptor.value, entries: new WeakMap(), batch: null, refreshDiagnostic: [] };
				const guard = workingHistoryGuard( this, mode );
				if ( this.history.length !== 1 || this.historyIndex !== 0 || this.lastSaveHistoryIndex !== 0 ||
					this.history[ 0 ].description !== 'Initial state' || !Number.isFinite( this.history[ 0 ].timestamp ) ) { throw workingHistoryError(); }
				const checkpoint = workingHistoryCall( guard, mode.session, 'captureWorkingCopyCheckpoint' );
				const state = workingHistoryCall( guard, mode.session, 'inspectWorkingCopyCheckpoint', checkpoint );
				const live = workingHistoryCall( guard, bridge, 'getWorkingCopyLiveState' ), snapshot = mode.Store.copyWorkingCopyValue( mode.session._snapshot );
				if ( !workingHistoryEqual( snapshot, JSON.parse( mode.session._savedJson ) ) ||
					!workingHistoryEqual( live, { canvas: state.canvas, layers: state.layers } ) || !workingHistoryEqual( this.history[ 0 ].layers, state.layers ) ) {
					mode.session.releaseWorkingCopyCheckpoint( checkpoint ); throw workingHistoryError();
				}
				workingHistoryCheck( guard );
				mode.entries.set( this.history[ 0 ], { checkpoint, workingState: state } ); mode.identityCheckpoint = checkpoint;
				workingCopyHistoryModes.set( this, mode );
			} catch ( error ) { throw workingHistoryError(); }
		}

		_workingCopyRecord( description, action = 'save' ) {
			const mode = workingCopyHistoryModes.get( this );
			let prepared, display;
			try {
				const guard = workingHistoryGuard( this, mode, action === 'batchEnd' || this.batchMode );
				workingHistoryCall( guard, mode.session, 'inspectWorkingCopyCheckpoint', mode.identityCheckpoint );
				const live = workingHistoryCall( guard, mode.bridge, 'getWorkingCopyLiveState' );
				prepared = workingHistoryCall( guard, mode.session, 'prepareWorkingCopyState', live );
				const preview = workingHistoryCall( guard, mode.session, 'inspectPreparedWorkingCopyState', prepared );
				const entry = { layers: mode.Store.copyWorkingCopyValue( preview.editorState.layers ), description: description || 'Edit', timestamp: Date.now(),
					workingState: mode.Store.copyWorkingCopyValue( preview.workingState ) };
				let values = {}, entries;
				if ( this.batchMode && action === 'save' ) {
					values = { batchChanges: this.batchChanges.concat( entry ) }; values.batchOperations = values.batchChanges;
				} else if ( action === 'batchStart' ) {
					values = { batchMode: true, batchDescription: description || 'Batch operation', batchChanges: [], batchStartSnapshot: preview.editorState.layers };
					values.batchOperations = values.batchChanges;
				} else {
					const kept = action === 'initial' ? [] : this.history.slice( 0, this.historyIndex + 1 );
					const marker = action === 'initial' ? 0 : this.lastSaveHistoryIndex > this.historyIndex ? -1 : this.lastSaveHistoryIndex;
					values = workingHistoryTrim( { history: kept.concat( entry ), historyIndex: kept.length, maxHistorySteps: this.maxHistorySteps, lastSaveHistoryIndex: marker }, this.maxHistorySteps );
					entries = values.history;
					if ( action === 'batchEnd' ) { values = { ...values, batchMode: false, batchChanges: [], batchStartSnapshot: null }; values.batchOperations = values.batchChanges; }
				}
				workingHistoryAssignments( this, values );
				display = workingHistoryCall( guard, mode.bridge, 'prepareWorkingCopyDisplay', preview.editorState, preview.dirty, false );
				const displayCommit = workingHistoryCall( guard, mode.bridge, 'prepareWorkingCopyDisplayCommit', display );
				const Bridge = Object.getOwnPropertyDescriptor( Object.getPrototypeOf( mode.bridge ), 'constructor' ).value;
				if ( !Bridge.isWorkingCopyDisplayCommit( displayCommit ) ) { throw workingHistoryError(); }
				workingHistoryCheck( guard );
				const result = mode.session.commitPreparedWorkingCopyState( prepared, () => {
					workingHistoryCheck( guard ); displayCommit.preflight(); workingHistoryCheck( guard );
				} );
				prepared = null;
				displayCommit.commit();
				if ( entries ) { mode.entries.set( entry, { checkpoint: result.checkpoint, workingState: result.workingState } ); }
				if ( action === 'batchStart' ) { mode.batch = { checkpoint: result.checkpoint, timeline: workingHistoryData( this ) }; }
				workingHistoryAssign( this, values );
				if ( action === 'batchEnd' ) { mode.batch = null; }
				workingHistoryRefresh( this, mode, display );
				return true;
			} catch ( error ) { throw workingHistoryError(); } finally {
				if ( prepared ) { try { mode.session.releasePreparedWorkingCopyState( prepared ); } catch ( error ) {} }
			}
		}

		_workingCopyRestore( targetIndex, batchCancel = false ) {
			const mode = workingCopyHistoryModes.get( this );
			let prepared;
			try {
				const guard = workingHistoryGuard( this, mode, batchCancel );
				if ( !batchCancel && ( !Number.isInteger( targetIndex ) || targetIndex < 0 || targetIndex >= this.history.length ) ) { return false; }
				const association = batchCancel ? mode.batch : mode.entries.get( this.history[ targetIndex ] );
				if ( !association ) { throw workingHistoryError(); }
				prepared = workingHistoryCall( guard, mode.session, 'prepareWorkingCopyRestore', association.checkpoint );
				const preview = workingHistoryCall( guard, mode.session, 'inspectPreparedWorkingCopyRestore', prepared );
				const current = mode.Store.copyWorkingCopyValue( mode.session._snapshot ), selected = current.surfaces.find( member => member.id === preview.workingState.surfaceId );
				selected.canvas = preview.workingState.canvas; selected.layers = preview.workingState.layers;
				if ( Object.hasOwn( preview.workingState, 'readingOrder' ) ) { selected.readingOrder = preview.workingState.readingOrder; } else { delete selected.readingOrder; }
				const dirty = !workingHistoryEqual( current, JSON.parse( mode.session._savedJson ) );
				const display = workingHistoryCall( guard, mode.bridge, 'prepareWorkingCopyDisplay', preview.editorState, dirty );
				const displayCommit = workingHistoryCall( guard, mode.bridge, 'prepareWorkingCopyDisplayCommit', display );
				const Bridge = Object.getOwnPropertyDescriptor( Object.getPrototypeOf( mode.bridge ), 'constructor' ).value;
				if ( !Bridge.isWorkingCopyDisplayCommit( displayCommit ) ) { throw workingHistoryError(); }
				const values = batchCancel ? { ...association.timeline, batchMode: false, batchChanges: [], batchStartSnapshot: null } : { historyIndex: targetIndex };
				if ( batchCancel ) { values.batchOperations = values.batchChanges; }
				workingHistoryAssignments( this, values );
				mode.session.commitWorkingCopyRestore( prepared, () => {
					workingHistoryCheck( guard ); displayCommit.preflight(); workingHistoryCheck( guard );
				} );
				prepared = null;
				displayCommit.commit(); workingHistoryAssign( this, values );
				if ( batchCancel ) { mode.batch = null; }
				workingHistoryRefresh( this, mode, display );
				return true;
			} catch ( error ) { return false; } finally {
				if ( prepared ) { try { mode.session.releasePreparedWorkingCopyRestore( prepared ); } catch ( error ) {} }
			}
		}

		_workingCopyTimeline( input ) {
			const mode = workingCopyHistoryModes.get( this );
			try {
				const source = input === undefined ? workingHistoryData( this ) : workingHistoryTimeline( this, input ).data;
				const data = mode.Store.copyWorkingCopyValue( source ), result = mode.Store.copyWorkingCopyValue( data );
				const associations = input === undefined ? this.history.map( entry => mode.entries.get( entry ) ) : workingHistoryTimeline( this, input ).associations;
				if ( associations.some( association => !association ) || this.isDestroyed || this.batchMode ) { throw workingHistoryError(); }
				workingCopyTimelineCopies.set( result, { mode, data, associations } );
				return result;
			} catch ( error ) { throw workingHistoryError(); }
		}

		_workingCopyTimelineRestore( input ) {
			const mode = workingCopyHistoryModes.get( this ), guard = workingHistoryGuard( this, mode ), association = workingHistoryTimeline( this, input );
			const values = mode.Store.copyWorkingCopyValue( association.data );
			workingHistoryAssignments( this, values ); workingHistoryCheck( guard );
			values.history.forEach( ( entry, index ) => mode.entries.set( entry, association.associations[ index ] ) );
			workingHistoryAssign( this, values );
			try { this.updateUndoRedoButtons(); } catch ( error ) { mode.refreshDiagnostic = [ 'working-copy-refresh-failed' ]; }
		}

		_workingCopyDirty() {
			const mode = workingCopyHistoryModes.get( this );
			let prepared;
			try {
				const guard = workingHistoryGuard( this, mode, true );
				const live = workingHistoryCall( guard, mode.bridge, 'getWorkingCopyLiveState' );
				prepared = workingHistoryCall( guard, mode.session, 'prepareWorkingCopyState', live );
				return workingHistoryCall( guard, mode.session, 'inspectPreparedWorkingCopyState', prepared ).dirty;
			} catch ( error ) { return true; } finally {
				if ( prepared ) { try { mode.session.releasePreparedWorkingCopyState( prepared ); } catch ( error ) {} }
			}
		}

		_workingCopyMaintenance( operation, value ) {
			const mode = workingCopyHistoryModes.get( this );
			try {
				if ( operation === 'destroy' ) {
					workingHistoryAssign( this, { isDestroyed: true, history: [], historyIndex: -1, lastSaveHistoryIndex: -1, batchChanges: [], batchOperations: [],
						batchStartSnapshot: null, canvasManager: null, config: null, editor: null } );
					mode.entries = new WeakMap(); mode.batch = null; return;
				}
				const guard = workingHistoryGuard( this, mode, operation === 'batchEnd' || operation === 'clear' );
				let values;
				if ( operation === 'markSaved' ) { values = { lastSaveHistoryIndex: this.historyIndex }; }
				if ( operation === 'clear' ) { values = { history: [], historyIndex: -1, lastSaveHistoryIndex: -1 }; }
				if ( operation === 'batchEnd' ) { values = { batchMode: false, batchChanges: [], batchStartSnapshot: null }; values.batchOperations = values.batchChanges; }
				if ( operation === 'capacity' ) {
					if ( !Number.isInteger( value ) || value < 1 ) { throw workingHistoryError(); }
					values = workingHistoryTrim( { ...workingHistoryData( this ), maxHistorySteps: value }, value );
				}
				if ( operation === 'compress' ) {
					if ( this.history.length <= this.maxHistorySteps / 2 ) { return; }
					values = workingHistoryTrim( workingHistoryData( this ), Math.max( 1, Math.floor( this.maxHistorySteps / 2 ) ) );
				}
				workingHistoryAssignments( this, values ); workingHistoryCheck( guard ); workingHistoryAssign( this, values );
				if ( operation === 'clear' ) { mode.entries = new WeakMap(); }
				if ( operation === 'batchEnd' ) { mode.batch = null; }
				try { this.updateUndoRedoButtons(); } catch ( error ) { mode.refreshDiagnostic = [ 'working-copy-refresh-failed' ]; }
			} catch ( error ) { throw workingHistoryError(); }
		}

		getWorkingCopyHistoryDiagnostic() {
			const mode = workingCopyHistoryModes.get( this );
			return mode ? mode.refreshDiagnostic.slice() : [];
		}

		/**
		 * @param {Object} [options={}] Configuration options
		 * @param {Object} [options.editor] Editor reference
		 * @param {CanvasManager} [options.canvasManager] Canvas manager reference
		 * @param {number} [options.maxHistorySteps=50] Maximum history steps
		 */
		constructor( options = {} ) {
			this.editor = options.editor || null;
			this.canvasManager = options.canvasManager ||
				( this.editor && this.editor.canvasManager ) || null;
			this.config = {};

			// History state
			this.history = [];
			this.historyIndex = -1;
			this.maxHistorySteps = options.maxHistorySteps || 50;
			// Backward-compat properties expected by legacy tests
			Object.defineProperty( this, 'currentIndex', {
				get: () => this.historyIndex
			} );
			Object.defineProperty( this, 'maxHistorySize', {
				get: () => this.maxHistorySteps,
				set: ( v ) => {
					this.setMaxHistorySteps( v );
				}
			} );

			// Batch operations
			this.batchMode = false;
			this.batchChanges = [];
			// Alias array used in older tests (must reference the same array)
			this.batchOperations = this.batchChanges;
			this.batchStartSnapshot = null;

			// Track which history index corresponds to last save (CORE-2 fix)
			// -1 means no save has been made yet
			this.lastSaveHistoryIndex = -1;

			// Destruction flag - prevents operations after cleanup
			this.isDestroyed = false;
		}

		/**
		 * Get the editor reference
		 * @private
		 * @return {Object|null} Editor reference
		 */
		getEditor() {
			if ( this.editor ) {
				return this.editor;
			}
			if ( this.canvasManager && this.canvasManager.editor ) {
				return this.canvasManager.editor;
			}
			return null;
		}

		/**
		 * Get the canvas manager reference
		 * @private
		 * @return {Object|null} CanvasManager reference
		 */
		getCanvasManager() {
			const editor = this.getEditor();
			if ( editor && editor.canvasManager ) {
				return editor.canvasManager;
			}
			return this.canvasManager || null;
		}

		copyTimeline( value ) {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyTimeline( value ); }
			// Classic ResourceLoader scripts also have module.exports; their require cannot load files.
			const Adapter = ( typeof window !== 'undefined' && window.Layers && window.Layers.Editor &&
				window.Layers.Editor.PageOwnedSnapshotAdapter ) ||
				( typeof module !== 'undefined' && module && typeof module.require === 'function' ?
					require( './PageOwnedSnapshotAdapter.js' ) : null );
			if ( typeof Adapter !== 'function' ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			const carrier = { id: 'timeline', kind: 'slide', canvas: {}, layers: [] };
			const timeline = new Adapter().withEditorState( { schemaVersion: 1, surfaces: [ carrier ],
				timeline: value }, carrier.id, { canvas: {}, layers: [] } ).timeline;
			if ( !timeline || !Array.isArray( timeline.history ) ||
				!Number.isInteger( timeline.maxHistorySteps ) || timeline.maxHistorySteps < 1 ||
				!Number.isInteger( timeline.historyIndex ) || timeline.historyIndex < -1 ||
				timeline.historyIndex >= timeline.history.length ||
				( timeline.history.length > 0 && timeline.historyIndex < 0 ) ||
				!Number.isInteger( timeline.lastSaveHistoryIndex ) || timeline.lastSaveHistoryIndex < -1 ||
				timeline.lastSaveHistoryIndex >= timeline.history.length ||
				timeline.history.some( state => !state || !Array.isArray( state.layers ) ) ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			return timeline;
		}

		captureTimeline() {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyTimeline(); }
			if ( this.isDestroyed || this.batchMode ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			return this.copyTimeline( { history: this.history, historyIndex: this.historyIndex,
				maxHistorySteps: this.maxHistorySteps, lastSaveHistoryIndex: this.lastSaveHistoryIndex } );
		}

		preflightTimeline( input ) {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyTimeline( input ); }
			if ( this.isDestroyed || this.batchMode ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			return this.copyTimeline( input );
		}

		restoreTimeline( input ) {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyTimelineRestore( input ); }
			const timeline = this.preflightTimeline( input );
			this.history = timeline.history;
			this.historyIndex = timeline.historyIndex;
			this.maxHistorySteps = timeline.maxHistorySteps;
			this.lastSaveHistoryIndex = timeline.lastSaveHistoryIndex;
			this.updateUndoRedoButtons();
		}

		/**
		 * Save current state to history
		 *
		 * @param {string} description Optional description of the change
		 */
		saveState( description ) {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyRecord( description ); }
			if ( this.isDestroyed ) {
				return;
			}

			if ( this.batchMode ) {
				this.batchChanges.push( {
					layers: this.getLayersSnapshot(),
					description: description || 'Batch change',
					timestamp: Date.now()
				} );
				// Keep alias in sync
				this.batchOperations = this.batchChanges;
				return;
			}

			// Remove any future history if we're not at the end
			// When saving after an undo, truncate all redo entries
			if ( this.historyIndex < this.history.length - 1 ) {
				// Keep only entries up to and including current position
				this.history = this.history.slice( 0, this.historyIndex + 1 );
			}

			// Add new state
			const snapshot = this.getLayersSnapshot();
			const state = {
				layers: snapshot,
				description: description || 'Edit',
				timestamp: Date.now()
			};

			this.history.push( state );

			// Trim history if it exceeds max size
			if ( this.history.length > this.maxHistorySteps ) {
				this.history.shift();
				// Adjust lastSaveHistoryIndex to account for the removed entry
				if ( this.lastSaveHistoryIndex > 0 ) {
					this.lastSaveHistoryIndex--;
				} else if ( this.lastSaveHistoryIndex === 0 ) {
					// The saved state was discarded; mark as unsaved
					this.lastSaveHistoryIndex = -1;
				}
			}

			// Always point to the most recently saved state
			this.historyIndex = this.history.length - 1;

			this.updateUndoRedoButtons();
		}

		/**
		 * Get efficient cloning utility from namespace
		 *
		 * @private
		 * @return {Function|null} The cloneLayersEfficient function or null
		 */
		_getCloneLayersEfficient() {
			if ( typeof window !== 'undefined' &&
				window.Layers &&
				window.Layers.Utils &&
				typeof window.Layers.Utils.cloneLayersEfficient === 'function' ) {
				return window.Layers.Utils.cloneLayersEfficient;
			}
			return null;
		}

		/**
		 * Get snapshot of current layers
		 *
		 * Uses efficient cloning that preserves references to immutable large data
		 * (image src, SVG path) to avoid expensive JSON serialization of 500KB+ strings.
		 *
		 * @return {Array} Deep copy of layers array (with immutable data by reference)
		 */
		getLayersSnapshot() {
			const editor = this.getEditor();
			let layers = [];

			if ( editor && editor.stateManager && typeof editor.stateManager.getLayers === 'function' ) {
				layers = editor.stateManager.getLayers();
			} else if ( editor && editor.layers ) {
				layers = editor.layers;
			} else if ( this.canvasManager && this.canvasManager.layers ) {
				layers = this.canvasManager.layers;
			}

			// Use efficient cloning if available (preserves src/path by reference)
			const cloneLayersEfficient = this._getCloneLayersEfficient();
			if ( cloneLayersEfficient ) {
				return cloneLayersEfficient( layers || [] );
			}

			// P2.4 FIX: Warn about memory-intensive fallback for image layers
			const hasImageLayers = Array.isArray( layers ) &&
				layers.some( layer => layer && layer.type === 'image' && layer.src );
			if ( hasImageLayers && typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[HistoryManager] Using JSON cloning for layers with images - may cause high memory usage. Consider loading DeepClone module.' );
			}

			// Fallback to JSON cloning
			try {
				return JSON.parse( JSON.stringify( layers || [] ) );
			} catch ( e ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[HistoryManager] JSON cloning failed, returning shallow copy:', e );
				}
				return ( layers || [] ).map( layer => Object.assign( {}, layer ) );
			}
		}

		/**
		 * Undo last action
		 *
		 * @return {boolean} True if undo was performed
		 */
		undo() {
			if ( workingCopyHistoryModes.has( this ) ) { return this.historyIndex > 0 && this._workingCopyRestore( this.historyIndex - 1 ); }
			if ( this.isDestroyed || !this.canUndo() ) {
				return false;
			}

			this.historyIndex--;
			const state = this.history[ this.historyIndex ];

			// CORE-9 FIX: Defensive bounds check
			if ( !state ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[HistoryManager] undo() - state at index', this.historyIndex, 'is undefined' );
				}
				this.historyIndex++; // Restore index
				return false;
			}

			this.restoreState( state );
			this.updateUndoRedoButtons();

			return true;
		}

		/**
		 * Redo next action
		 *
		 * @return {boolean} True if redo was performed
		 */
		redo() {
			if ( workingCopyHistoryModes.has( this ) ) { return this.historyIndex < this.history.length - 1 && this._workingCopyRestore( this.historyIndex + 1 ); }
			if ( this.isDestroyed || !this.canRedo() ) {
				return false;
			}

			this.historyIndex++;
			const state = this.history[ this.historyIndex ];

			// CORE-9 FIX: Defensive bounds check
			if ( !state ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[HistoryManager] redo() - state at index', this.historyIndex, 'is undefined' );
				}
				this.historyIndex--; // Restore index
				return false;
			}

			this.restoreState( state );
			this.updateUndoRedoButtons();

			return true;
		}

		/**
		 * Check if undo is available
		 *
		 * @return {boolean} True if can undo
		 */
		canUndo() {
			return this.historyIndex > 0;
		}

		/**
		 * Check if redo is available
		 *
		 * @return {boolean} True if can redo
		 */
		canRedo() {
			return this.historyIndex < this.history.length - 1;
		}

		/**
		 * Restore state from history
		 *
		 * @param {Object} state State object to restore
		 */
		restoreState( state ) {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyRestore( this.history.indexOf( state ) ); }
			// Restore layers using efficient cloning if available
			const cloneLayersEfficient = this._getCloneLayersEfficient();
			const restored = cloneLayersEfficient ?
				cloneLayersEfficient( state.layers ) :
				JSON.parse( JSON.stringify( state.layers ) );

			const editor = this.getEditor();
			const canvasMgr = this.getCanvasManager();

			// Track whether StateManager is used (determines if we need explicit renderLayerList)
			let usedStateManager = false;

			// Restore layers via StateManager (this triggers the 'layers' listener
			// which already calls renderLayerList(), so we don't call it explicitly)
			if ( editor && editor.stateManager ) {
				editor.stateManager.set( 'layers', restored );
				usedStateManager = true;
			} else if ( editor ) {
				editor.layers = restored;
			} else if ( this.canvasManager ) {
				this.canvasManager.layers = restored;
			}

			// Clear selections
			if ( canvasMgr && canvasMgr.selectionManager ) {
				canvasMgr.selectionManager.clearSelection();
			} else if ( canvasMgr ) {
				// Fallback for legacy code
				canvasMgr.selectedLayerId = null;
				canvasMgr.selectedLayerIds = [];
			}

			// Re-render using the restored layers directly
			// NOTE: renderLayers internally calls redraw(), so we only call one
			if ( canvasMgr && typeof canvasMgr.renderLayers === 'function' ) {
				canvasMgr.renderLayers( restored );
			}

			// Only call renderLayerList explicitly when StateManager was NOT used.
			// When StateManager IS used, the 'layers' subscription in LayerPanel already
			// triggers renderLayerList(), so calling it again would cause double-update.
			if ( !usedStateManager && editor && editor.layerPanel &&
				typeof editor.layerPanel.renderLayerList === 'function' ) {
				editor.layerPanel.renderLayerList();
			}

			// Mark editor as dirty (when available)
			if ( editor && typeof editor.markDirty === 'function' ) {
				editor.markDirty();
			}
			const bridge = editor && editor.apiManager && editor.apiManager.pageOwnedBridge;
			if ( bridge && bridge.pdfCoordinator ) {
				bridge.pdfCoordinator.syncDirty();
			}
		}

		/**
		 * Update undo/redo button states
		 */
		updateUndoRedoButtons() {
			const canUndo = this.canUndo();
			const canRedo = this.canRedo();
			const editor = this.getEditor();

			// Update toolbar buttons if available
			if ( editor && editor.toolbar && editor.toolbar.container ) {
				// Try both old and new selector patterns for compatibility
				const undoBtn = editor.toolbar.container.querySelector( '[data-action="undo"]' ) ||
					editor.toolbar.container.querySelector( '.undo-btn' );
				const redoBtn = editor.toolbar.container.querySelector( '[data-action="redo"]' ) ||
					editor.toolbar.container.querySelector( '.redo-btn' );

				if ( undoBtn ) {
					undoBtn.disabled = !canUndo;
					undoBtn.title = canUndo && this.historyIndex > 0 && this.history[ this.historyIndex - 1 ] ?
						'Undo: ' + this.history[ this.historyIndex - 1 ].description :
						'Nothing to undo';
				}

				if ( redoBtn ) {
					redoBtn.disabled = !canRedo;
					redoBtn.title = canRedo && this.history[ this.historyIndex + 1 ] ?
						'Redo: ' + this.history[ this.historyIndex + 1 ].description :
						'Nothing to redo';
				}
			}

			// Also try the toolbar.updateUndoRedoState method if available
			if ( editor && editor.toolbar && typeof editor.toolbar.updateUndoRedoState === 'function' ) {
				editor.toolbar.updateUndoRedoState( canUndo, canRedo );
			}

			// Update status
			if ( editor && typeof editor.updateStatus === 'function' ) {
				editor.updateStatus( {
					canUndo: canUndo,
					canRedo: canRedo,
					historyPosition: this.historyIndex + 1,
					historySize: this.history.length
				} );
			}
		}

		/**
		 * Start batch mode for grouped operations
		 *
		 * @param {string} description Description for the batch operation
		 */
		startBatch( description ) {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyRecord( description, 'batchStart' ); }
			this.batchMode = true;
			this.batchDescription = description || 'Batch operation';
			this.batchChanges = [];
			this.batchOperations = this.batchChanges;
			// Snapshot current state to allow cancel
			this.batchStartSnapshot = this.getLayersSnapshot();
		}

		/**
		 * End batch mode and save as single history entry
		 */
		endBatch() {
			if ( workingCopyHistoryModes.has( this ) ) { return this.batchMode && this.batchChanges.length ? this._workingCopyRecord( this.batchDescription, 'batchEnd' ) : this._workingCopyMaintenance( 'batchEnd' ); }
			if ( !this.batchMode || this.batchChanges.length === 0 ) {
				this.batchMode = false;
				this.batchChanges = [];
				this.batchOperations = this.batchChanges;
				return;
			}

			// Save final state as single history entry
			this.batchMode = false;
			this.saveState( this.batchDescription );
			this.batchChanges = [];
			this.batchOperations = this.batchChanges;
			this.batchStartSnapshot = null;
		}

		/**
		 * Cancel batch mode without saving
		 */
		cancelBatch() {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyRestore( -1, true ); }
			// Revert to snapshot from start of batch if available
			if ( this.batchStartSnapshot ) {
				const snapshot = JSON.parse( JSON.stringify( this.batchStartSnapshot ) );
				const editor = this.getEditor();
				const canvasMgr = this.getCanvasManager();

				if ( editor && editor.stateManager ) {
					editor.stateManager.set( 'layers', snapshot );
				} else if ( editor ) {
					editor.layers = snapshot;
				} else if ( this.canvasManager ) {
					this.canvasManager.layers = snapshot;
				}

				const layers = editor ? editor.layers : ( this.canvasManager && this.canvasManager.layers ) || [];
				if ( canvasMgr && typeof canvasMgr.renderLayers === 'function' ) {
					canvasMgr.renderLayers( layers );
				}
			}
			this.batchMode = false;
			this.batchChanges = [];
			this.batchOperations = this.batchChanges;
			this.batchStartSnapshot = null;
		}

		/**
		 * Clear all history
		 */
		clearHistory() {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyMaintenance( 'clear' ); }
			this.history = [];
			this.historyIndex = -1;
			this.updateUndoRedoButtons();
		}

		// Backward-compat aliases for older tests
		clear() {
			this.clearHistory();
		}

		commitBatch() {
			this.endBatch();
		}

		getCurrentStateDescription() {
			return this.historyIndex >= 0 && this.history[ this.historyIndex ] ?
				this.history[ this.historyIndex ].description : 'No history';
		}

		/**
		 * Get history information
		 *
		 * @return {Object} History information
		 */
		getHistoryInfo() {
			return {
				totalSteps: this.history.length,
				currentStep: this.historyIndex + 1,
				canUndo: this.canUndo(),
				canRedo: this.canRedo(),
				maxSteps: this.maxHistorySteps,
				batchMode: this.batchMode
			};
		}

		/**
		 * Get history entries for UI display
		 *
		 * @param {number} limit Maximum number of entries to return
		 * @return {Array} Array of history entries
		 */
		getHistoryEntries( limit ) {
			limit = limit || 10;
			const start = Math.max( 0, this.history.length - limit );

			return this.history.slice( start ).map( ( entry, index ) => {
				const actualIndex = start + index;
				return {
					index: actualIndex,
					description: entry.description,
					timestamp: entry.timestamp,
					isCurrent: actualIndex === this.historyIndex,
					canRevertTo: actualIndex <= this.historyIndex
				};
			} );
		}

		/**
		 * Revert to specific history entry
		 *
		 * @param {number} targetIndex Index to revert to
		 * @return {boolean} True if revert was successful
		 */
		revertTo( targetIndex ) {
			if ( workingCopyHistoryModes.has( this ) ) { return targetIndex <= this.historyIndex && this._workingCopyRestore( targetIndex ); }
			if (
				targetIndex < 0 ||
				targetIndex >= this.history.length ||
				targetIndex > this.historyIndex
			) {
				return false;
			}

			this.historyIndex = targetIndex;
			this.restoreState( this.history[ this.historyIndex ] );
			this.updateUndoRedoButtons();

			return true;
		}

		/**
		 * Compress history to save memory
		 */
		compressHistory() {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyMaintenance( 'compress' ); }
			if ( this.history.length <= this.maxHistorySteps / 2 ) {
				return;
			}

			// Keep recent half of history
			const keepCount = Math.floor( this.maxHistorySteps / 2 );
			const removeCount = this.history.length - keepCount;

			this.history = this.history.slice( removeCount );
			this.historyIndex = Math.max( 0, this.historyIndex - removeCount );

			this.updateUndoRedoButtons();
		}

		/**
		 * Set maximum history steps
		 *
		 * @param {number} maxSteps Maximum number of history steps
		 */
		setMaxHistorySteps( maxSteps ) {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyMaintenance( 'capacity', maxSteps ); }
			this.maxHistorySteps = Math.max( 1, maxSteps );

			// Trim current history if needed
			if ( this.history.length > this.maxHistorySteps ) {
				const removeCount = this.history.length - this.maxHistorySteps;
				this.history = this.history.slice( removeCount );
				this.historyIndex = Math.max( 0, this.historyIndex - removeCount );
				this.updateUndoRedoButtons();
			}
		}

		/**
		 * Check if current state differs from last saved state.
		 *
		 * CORE-2 FIX: Uses efficient comparison that avoids serializing large
		 * base64 image data (500KB+ per image). Falls back to layersEqual()
		 * which compares properties individually.
		 *
		 * @return {boolean} True if state has changed
		 */
		hasUnsavedChanges() {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyDirty(); }
			const editor = this.getEditor();

			if ( this.history.length === 0 ) {
				const initialLayers = editor ? editor.layers : ( this.canvasManager && this.canvasManager.layers ) || [];
				return initialLayers.length > 0;
			}

			// Fast path: if historyIndex matches lastSaveHistoryIndex and
			// no edits have been made since, there are no unsaved changes
			if ( this.lastSaveHistoryIndex >= 0 && this.historyIndex === this.lastSaveHistoryIndex ) {
				return false;
			}

			// Need to compare current state with saved state
			const currentLayers = this.getLayersSnapshot();

			// If we have a saved index, compare against that entry
			if ( this.lastSaveHistoryIndex >= 0 && this.history[ this.lastSaveHistoryIndex ] ) {
				return !this.layersEqual( currentLayers, this.history[ this.lastSaveHistoryIndex ].layers );
			}

			// Fall back to comparing with initial state (index 0)
			const referenceIndex = 0;
			if ( this.history[ referenceIndex ] ) {
				return !this.layersEqual( currentLayers, this.history[ referenceIndex ].layers );
			}

			return true;
		}

		/**
		 * Compare two layer arrays for equality efficiently.
		 *
		 * CORE-2 FIX: For large immutable properties (src, path), uses reference
		 * comparison instead of value comparison since cloneLayersEfficient
		 * preserves these references.
		 *
		 * @param {Array} layers1 - First layers array
		 * @param {Array} layers2 - Second layers array
		 * @return {boolean} True if layers are equal
		 */
		layersEqual( layers1, layers2 ) {
			if ( !Array.isArray( layers1 ) || !Array.isArray( layers2 ) ) {
				return layers1 === layers2;
			}

			if ( layers1.length !== layers2.length ) {
				return false;
			}

			// Properties that are large and immutable - compare by reference
			const immutableProps = [ 'src', 'path' ];

			for ( let i = 0; i < layers1.length; i++ ) {
				const l1 = layers1[ i ];
				const l2 = layers2[ i ];

				// Get all keys from both objects
				const keys1 = Object.keys( l1 || {} );
				const keys2 = Object.keys( l2 || {} );

				// Quick length check
				if ( keys1.length !== keys2.length ) {
					return false;
				}

				// Compare each key
				for ( const key of keys1 ) {
					const v1 = l1[ key ];
					const v2 = l2[ key ];

					// For immutable large props, reference equality is sufficient
					if ( immutableProps.includes( key ) ) {
						if ( v1 !== v2 ) {
							return false;
						}
					} else if ( key === 'points' && Array.isArray( v1 ) && Array.isArray( v2 ) ) {
						// Points array - compare length and values
						if ( v1.length !== v2.length ) {
							return false;
						}
						for ( let j = 0; j < v1.length; j++ ) {
							if ( v1[ j ].x !== v2[ j ].x || v1[ j ].y !== v2[ j ].y ) {
								return false;
							}
						}
					} else if ( key === 'children' && Array.isArray( v1 ) && Array.isArray( v2 ) ) {
						// Children array (for groups) - compare by JSON
						if ( JSON.stringify( v1 ) !== JSON.stringify( v2 ) ) {
							return false;
						}
					} else if ( v1 !== null && typeof v1 === 'object' ) {
						// Other objects - use JSON comparison (these are typically small)
						if ( JSON.stringify( v1 ) !== JSON.stringify( v2 ) ) {
							return false;
						}
					} else {
						// Primitives
						if ( v1 !== v2 ) {
							return false;
						}
					}
				}
			}

			return true;
		}

		/**
		 * Save initial state - clears history and saves current layers as baseline.
		 * Called after layers are loaded from API to establish undo baseline.
		 */
		saveInitialState() {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyRecord( 'Initial state', 'initial' ); }
			this.clearHistory();
			this.saveState( 'Initial state' );
			// Mark initial state as saved (CORE-2 fix)
			this.lastSaveHistoryIndex = this.historyIndex;
		}

		/**
		 * Mark current history state as saved.
		 * Called by APIManager after successful save to API.
		 * CORE-2 FIX: Enables efficient hasUnsavedChanges() check.
		 */
		markAsSaved() {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyMaintenance( 'markSaved' ); }
			this.lastSaveHistoryIndex = this.historyIndex;
		}

		/**
		 * Export history for debugging
		 *
		 * @return {Object} History export
		 */
		exportHistory() {
			return {
				history: this.history.map( ( entry ) => ( {
					description: entry.description,
					timestamp: entry.timestamp,
					layerCount: entry.layers.length
				} ) ),
				historyIndex: this.historyIndex,
				maxHistorySteps: this.maxHistorySteps,
				batchMode: this.batchMode
			};
		}

		/**
		 * Get memory usage estimate
		 *
		 * @return {Object} Memory usage information
		 */
		getMemoryUsage() {
			let totalSize = 0;
			const layerCounts = [];

			this.history.forEach( ( entry ) => {
				const serialized = JSON.stringify( entry );
				totalSize += serialized.length;
				layerCounts.push( entry.layers.length );
			} );

			// Return a single number for legacy tests (estimated bytes)
			return totalSize;
		}

		/**
		 * Clean up resources and clear state
		 */
		destroy() {
			if ( workingCopyHistoryModes.has( this ) ) { return this._workingCopyMaintenance( 'destroy' ); }
			// Mark as destroyed to prevent further operations
			this.isDestroyed = true;

			// Clear history
			this.clearHistory();
			this.history = [];
			this.batchChanges = [];
			this.batchOperations = [];
			this.batchStartSnapshot = null;

			// Clear references
			this.canvasManager = null;
			this.config = null;
			this.editor = null;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.HistoryManager = HistoryManager;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = HistoryManager;
	}

}() );
