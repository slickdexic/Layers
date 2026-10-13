/** Maps a page-owned surface session to the existing editor state without legacy API calls. */
( function () {
	'use strict';

	const slideFields = {
		width: 'slideCanvasWidth', height: 'slideCanvasHeight',
		backgroundColor: 'slideBackgroundColor', backgroundVisible: 'backgroundVisible',
		backgroundOpacity: 'backgroundOpacity'
	};
	// An image/PDF canvas is the pinned source page; only how its picture shows is editable.
	const sourceFields = { backgroundVisible: 'backgroundVisible', backgroundOpacity: 'backgroundOpacity' };

	// The editor clears a property by setting it to null or undefined; the server stores neither.
	function withoutClearedValues( layer ) {
		if ( !layer || Object.getPrototypeOf( layer ) !== Object.prototype ) {
			return layer;
		}
		return Object.fromEntries( Object.entries( layer ).filter( ( [ , value ] ) => value !== null && value !== undefined ) );
	}

	const workingCopyDisplays = new WeakMap();
	const workingCopyDisplayCommits = new WeakSet();
	const workingCopyDraftRecoveries = new WeakMap();

	function workingCopyDraftEqual( left, right ) {
		if ( Object.is( left, right ) ) { return true; }
		if ( !left || !right || typeof left !== 'object' || typeof right !== 'object' ||
			Array.isArray( left ) !== Array.isArray( right ) ) { return false; }
		const keys = Object.keys( left );
		return keys.length === Object.keys( right ).length && keys.every( key =>
			Object.hasOwn( right, key ) && workingCopyDraftEqual( left[ key ], right[ key ] ) );
	}

	function workingCopyDisplayError() {
		const error = new Error( 'Working-copy display unavailable' );
		error.code = 'layers-working-copy-display-unavailable';
		return error;
	}

	function workingCopyStoreClass( bridge ) {
		const prototype = Object.getPrototypeOf( bridge.editor.stateManager );
		const descriptor = prototype && Object.getOwnPropertyDescriptor( prototype, 'constructor' );
		if ( !descriptor || typeof descriptor.value !== 'function' || typeof descriptor.value.copyWorkingCopyValue !== 'function' ) {
			throw workingCopyDisplayError();
		}
		return descriptor.value;
	}

	function workingCopyDisplayRecord( bridge, handle, committed = false ) {
		const record = workingCopyDisplays.get( handle );
		if ( !record || record.bridge !== bridge || record.committed !== committed ) {
			throw workingCopyDisplayError();
		}
		if ( !committed ) {
			if ( !record.store.isWorkingCopyAlive() ) { throw workingCopyDisplayError(); }
			record.Store.checkWorkingCopyObservation( record.owner );
			record.Store.checkWorkingCopyObservation( record.editor );
			record.Store.checkWorkingCopyMethods( record.methods );
			record.store.preflightWorkingCopyPatch( record.patch );
		}
		return record;
	}

	const importApplications = new WeakMap();
	const importApplicationActive = new WeakSet();
	const importDisplayCertificates = new WeakSet();

	function importApplicationError() {
		const error = new Error( 'Working-copy Import unavailable' );
		error.code = 'layers-working-copy-import-application-unavailable'; return error;
	}

	function importApplicationMethods( Store, entries ) {
		return entries.map( ( [ object, keys ] ) => keys.map( key => Store.captureWorkingCopyMethod( object, key ) ) ).flat();
	}

	function importApplicationCapture( bridge, source ) {
		const Store = workingCopyStoreClass( bridge ), editor = bridge.editor, session = bridge.session, store = editor.stateManager, canvas = editor.canvasManager;
		if ( !canvas || !canvas.selectionManager || !editor.historyManager ) { throw importApplicationError(); }
		const selection = canvas.selectionManager, history = editor.historyManager;
		const observations = [ Store.observeWorkingCopyObject( bridge, false ), Store.observeWorkingCopyObject( editor, false ), Store.observeWorkingCopyObject( editor.config || {} ),
			Store.observeWorkingCopyObject( session, false ), Store.observeWorkingCopyObject( session._snapshot ), Store.observeWorkingCopyObject( store, false ),
			Store.observeWorkingCopyObject( store.state ), Store.observeWorkingCopyObject( store.pendingOperations ), Store.observeWorkingCopyObject( store.lockingQueue ),
			Store.observeWorkingCopyObject( history, false ), Store.observeWorkingCopyObject( history.history ), Store.observeWorkingCopyObject( history.batchChanges ),
			Store.observeWorkingCopyObject( canvas, false ), Store.observeWorkingCopyObject( selection, false ) ];
		if ( session._newSurface ) { observations.push( Store.observeWorkingCopyObject( session._newSurface ) ); }
		const methods = importApplicationMethods( Store, [ [ bridge, [ 'getWorkingCopyLiveState', 'prepareWorkingCopyImportDisplay', 'inspectWorkingCopyImport', 'applyWorkingCopyImport' ] ],
			[ history, [ 'captureWorkingCopyImportHistory', 'prepareWorkingCopyImportHistory' ] ], [ selection, [ 'captureWorkingCopyImportSelection', 'prepareWorkingCopyImportSelection' ] ],
			[ session, [ 'prepareWorkingCopyImport', 'inspectWorkingCopyImport', 'revalidateWorkingCopyImport', 'prepareWorkingCopyImportCommit',
				'inspectPreparedWorkingCopyImportCommit', 'commitPreparedWorkingCopyImport', 'releaseWorkingCopyImport', 'cleanupAppliedWorkingCopyImport' ] ],
			[ source, [ 'prepare', 'inspect', 'revalidate', 'release' ] ], [ store, [ 'isWorkingCopyAlive', 'prepareWorkingCopyPatch', 'prepareWorkingCopyPatchCommit', 'notifyWorkingCopyPatch' ] ],
			[ session._adapter, [ 'toEditorState', 'withWorkingCopyImport', 'withWorkingCopyRestore', 'withEditorState' ] ], [ session._reader, [ 'read' ] ], [ session._publisher, [ 'publish' ] ] ] );
		let historyWitness, selectionWitness;
		const check = () => {
			Store.checkWorkingCopyMethods( methods ); observations.forEach( Store.checkWorkingCopyObservation );
			if ( bridge.disposed || !bridge.loaded || bridge.saving || bridge.reconciling || bridge.pdfCoordinator || !store.isWorkingCopyAlive() ||
				session._phase !== 'ready' || session._readOnly || session._reconciling || ( !session._baseHasDrawings && !session.hasCreationImport() ) || session._pdf || session._pdfContext || session._pdfRecovery ||
				store.isLocked || store._isProcessingPending || store.pendingOperations.length || store.lockingQueue.length || store.lockTimeout !== null || store.lockAutoRecoveryTimeout !== null || history.batchMode ) { throw importApplicationError(); }
			if ( historyWitness ) { historyWitness.preflight(); } if ( selectionWitness ) { selectionWitness.preflight(); }
		};
		check(); selectionWitness = selection.captureWorkingCopyImportSelection();
		const Selection = Object.getOwnPropertyDescriptor( Object.getPrototypeOf( selection ), 'constructor' ).value;
		if ( !Selection.isWorkingCopyImportSelection( selectionWitness ) ) { throw importApplicationError(); } check();
		historyWitness = history.captureWorkingCopyImportHistory( bridge );
		const History = Object.getOwnPropertyDescriptor( Object.getPrototypeOf( history ), 'constructor' ).value;
		if ( !History.isWorkingCopyImportHistory( historyWitness ) ) { throw importApplicationError(); } check();
		return { Store, editor, session, store, canvas, selection, history, Selection, History, check };
	}

	function importApplicationRecord( bridge, handle ) {
		const record = importApplications.get( handle );
		if ( !record || record.bridge !== bridge || record.consumed || record.released ) { throw importApplicationError(); }
		record.guard.check(); return record;
	}

	class PageOwnedEditorBridge {
		/** Capture complete draft data in the already opted-in working-copy history mode. */
		captureWorkingCopyDraft() {
			const timeline = this.editor.historyManager.captureWorkingCopyDraftTimeline();
			return { workingCopyDraft: timeline,
				editorState: { canvas: timeline.workingState.canvas, layers: timeline.workingState.layers } };
		}

		/** Read-only backup remains available during saving/conflict/uncertain publication holds. */
		getWorkingCopyDraftLiveState() {
			if ( this.disposed || !this.loaded || this.pdfCoordinator || this.session.getStatus().readOnly ) { throw workingCopyDisplayError(); }
			const Store = workingCopyStoreClass( this ), observations = [ Store.observeWorkingCopyObject( this, false ),
				Store.observeWorkingCopyObject( this.editor, false ), Store.observeWorkingCopyObject( this.editor.stateManager.state ) ];
			const methods = [ Store.captureWorkingCopyMethod( this.session, 'getEditorState' ) ];
			const state = Store.copyWorkingCopyValue( this.session.getEditorState() );
			for ( const [ field, key ] of Object.entries( this.isSlide ? slideFields : sourceFields ) ) {
				const descriptor = Object.getOwnPropertyDescriptor( this.editor.stateManager.state, key );
				if ( descriptor && descriptor.value !== undefined ) { state.canvas[ field ] = Store.copyWorkingCopyValue( descriptor.value ); }
				else { delete state.canvas[ field ]; }
			}
			state.layers = Store.copyWorkingCopyValue( this.editor.stateManager.state.layers );
			observations.forEach( Store.checkWorkingCopyObservation ); Store.checkWorkingCopyMethods( methods ); return state;
		}

		/** Prepare recovery before confirmation/read awaits; no live participant is changed. */
		prepareWorkingCopyDraftRecovery( candidate ) {
			let history, prepared, display, selection;
			try {
				const Store = workingCopyStoreClass( this ), copied = Store.copyWorkingCopyValue( candidate );
				const editor = this.editor, session = this.session, manager = editor.historyManager;
				const selectionManager = editor.canvasManager && editor.canvasManager.selectionManager;
				if ( !selectionManager || copied.pdfDraft || typeof copied.publicationBlocked !== 'boolean' || typeof copied.label !== 'string' ) {
					throw workingCopyDisplayError();
				}
				history = manager.prepareWorkingCopyDraftTimeline( copied.workingCopyDraft );
				if ( !manager.constructor.isWorkingCopyDraftTimeline( history ) ) { throw workingCopyDisplayError(); }
				prepared = session.prepareWorkingCopyDraftRestore( history.checkpoint, copied.label, copied.publicationBlocked );
				const preview = session.inspectWorkingCopyDraftRestore( prepared );
				if ( !workingCopyDraftEqual( preview.editorState, copied.editorState ) ) {
					throw workingCopyDisplayError();
				}
				display = this.prepareWorkingCopyImportDisplay( preview.editorState, preview.dirty, [] );
				if ( !importDisplayCertificates.has( display ) ) { throw workingCopyDisplayError(); }
				selection = selectionManager.prepareWorkingCopyImportSelection( preview.editorState.layers, [] );
				if ( !selectionManager.constructor.isWorkingCopyImportSelection( selection ) ) { throw workingCopyDisplayError(); }
				const methods = [ [ session, 'revalidate' ], [ session, 'inspectWorkingCopyDraftRestore' ],
					[ session, 'commitWorkingCopyDraftRestore' ], [ manager, 'prepareWorkingCopyDraftTimeline' ],
					[ this, 'commitWorkingCopyDraftRecovery' ], [ this, 'prepareWorkingCopyImportDisplay' ],
					[ selectionManager, 'prepareWorkingCopyImportSelection' ] ].map( ( [ object, key ] ) => Store.captureWorkingCopyMethod( object, key ) );
				const preflight = () => {
					Store.checkWorkingCopyMethods( methods ); history.preflight();
					session.inspectWorkingCopyDraftRestore( prepared ); display.preflight(); selection.preflight();
				};
				preflight(); const handle = Object.freeze( Object.create( null ) );
				workingCopyDraftRecoveries.set( handle, { bridge: this, Store, session, editor, manager,
					selectionManager, history, prepared, display, selection, preflight, committed: false, applying: false } );
				return handle;
			} catch ( error ) {
				if ( prepared ) { try { this.session.releaseWorkingCopyDraftRestore( prepared ); } catch ( cleanupError ) {} }
				if ( display ) { try { display.release(); } catch ( cleanupError ) {} }
				if ( history ) { try { history.release(); } catch ( cleanupError ) {} }
				throw workingCopyDisplayError();
			}
		}

		preflightWorkingCopyDraftRecovery( handle ) {
			const record = workingCopyDraftRecoveries.get( handle );
			if ( !record || record.bridge !== this || record.committed ) { throw workingCopyDisplayError(); }
			record.preflight();
		}

		async commitWorkingCopyDraftRecovery( handle ) {
			const record = workingCopyDraftRecoveries.get( handle );
			if ( !record || record.bridge !== this || record.committed || record.applying ) { throw workingCopyDisplayError(); }
			record.applying = true;
			try {
				record.preflight(); await record.session.revalidate(); record.preflight();
				if ( record.history.revalidateProvenance ) { await record.history.revalidateProvenance( record.preflight ); record.preflight(); }
				const result = record.session.commitWorkingCopyDraftRestore( record.prepared, record.preflight );
				record.prepared = null;
				record.display.commit(); record.selection.commit(); record.history.commit(); record.committed = true;
				const diagnostics = [], attempt = callback => {
					try { const notes = callback(); if ( Array.isArray( notes ) ) { diagnostics.push( ...notes ); } }
					catch ( error ) { diagnostics.push( 'working-copy-refresh-failed' ); }
				};
				attempt( record.display.notify ); attempt( record.selection.refresh );
				attempt( () => {
					if ( record.editor.stateManager.isWorkingCopyAlive() ) {
						attempt( () => record.editor.canvasManager.setBaseDimensions( result.editorState.canvas.width, result.editorState.canvas.height ) );
						attempt( () => record.editor.canvasManager.renderLayers( record.editor.stateManager.state.layers ) );
						attempt( () => record.editor.layerPanel.updateLayers( record.editor.stateManager.state.layers ) );
						attempt( record.selection.refresh ); attempt( () => record.manager.updateUndoRedoButtons() );
					}
				} );
				result.diagnostics = diagnostics; return result;
			} catch ( error ) { throw workingCopyDisplayError(); }
			finally { record.applying = false; this.releaseWorkingCopyDraftRecovery( handle ); }
		}

		releaseWorkingCopyDraftRecovery( handle ) {
			const record = workingCopyDraftRecoveries.get( handle );
			if ( !record || record.bridge !== this || record.applying ) { throw workingCopyDisplayError(); }
			workingCopyDraftRecoveries.delete( handle );
			if ( record.prepared ) { record.session.releaseWorkingCopyDraftRestore( record.prepared ); }
			record.display.release(); record.history.release();
		}

		async prepareWorkingCopyImport( source, request ) {
			let sessionHandle, guard;
			try {
				const mode = request && Object.getOwnPropertyDescriptor( request, 'mode' );
				if ( !mode || !Object.hasOwn( mode, 'value' ) ) { throw importApplicationError(); }
				if ( mode.value === 'cancel' ) { return null; }
				if ( importApplicationActive.has( this ) ) { throw importApplicationError(); }
				guard = importApplicationCapture( this, source ); importApplicationActive.add( this );
				sessionHandle = await guard.session.prepareWorkingCopyImport( source, request ); guard.check();
				const preview = guard.session.inspectWorkingCopyImport( sessionHandle ); guard.check();
				const handle = Object.freeze( Object.create( null ) );
				importApplications.set( handle, { bridge: this, guard, sessionHandle, preview: guard.Store.copyWorkingCopyValue( preview ), consumed: false, released: false, applying: false } );
				return handle;
			} catch ( error ) {
				if ( sessionHandle ) { try { guard.session.releaseWorkingCopyImport( sessionHandle ); } catch ( cleanupError ) {} }
				throw importApplicationError();
			} finally { if ( guard ) { importApplicationActive.delete( this ); } }
		}

		inspectWorkingCopyImport( handle ) {
			try { const record = importApplicationRecord( this, handle ); const result = record.guard.session.inspectWorkingCopyImport( record.sessionHandle );
				record.guard.check(); return record.guard.Store.copyWorkingCopyValue( result ); }
			catch ( error ) { throw importApplicationError(); }
		}

		prepareWorkingCopyImportDisplay( state, dirty, selectedIds ) {
			const Store = workingCopyStoreClass( this ), store = this.editor.stateManager, copied = Store.copyWorkingCopyValue( state );
			const values = { layers: copied.layers, selectedLayerIds: Store.copyWorkingCopyValue( selectedIds ), isDirty: dirty, isSlide: this.isSlide,
				baseWidth: copied.canvas.width, baseHeight: copied.canvas.height }, clear = [];
			for ( const [ field, key ] of Object.entries( this.isSlide ? slideFields : sourceFields ) ) {
				if ( Object.hasOwn( copied.canvas, field ) ) { values[ key ] = copied.canvas[ field ]; } else { clear.push( key ); }
			}
			const patch = store.prepareWorkingCopyPatch( { values, clear } ), commit = store.prepareWorkingCopyPatchCommit( patch );
			if ( !Store.isWorkingCopyPatchCommit( commit ) ) { throw importApplicationError(); }
			const display = Object.freeze( { preflight: commit.preflight, commit: commit.commit,
				notify: () => store.notifyWorkingCopyPatch( patch ), release: () => store.releaseWorkingCopyPatch( patch ) } );
			importDisplayCertificates.add( display ); return display;
		}

		async applyWorkingCopyImport( handle ) {
			if ( handle === null ) { return null; }
			let record, prepared, display, result, committed = false, ownsActive = false;
			try {
				record = importApplicationRecord( this, handle );
				if ( record.applying || importApplicationActive.has( this ) ) { throw importApplicationError(); }
				record.applying = true; importApplicationActive.add( this ); ownsActive = true;
				const guard = record.guard;
				await guard.session.revalidateWorkingCopyImport( record.sessionHandle, guard.check ); guard.check();
				prepared = guard.session.prepareWorkingCopyImportCommit( record.sessionHandle ); guard.check();
				const preview = guard.session.inspectPreparedWorkingCopyImportCommit( prepared ); guard.check();
				const selection = guard.selection.prepareWorkingCopyImportSelection( preview.editorState.layers, preview.importedLayerIds ); guard.check();
				if ( !guard.Selection.isWorkingCopyImportSelection( selection ) ) { throw importApplicationError(); }
				display = this.prepareWorkingCopyImportDisplay( preview.editorState, preview.dirty, selection.selectedIds ); guard.check();
				if ( !importDisplayCertificates.has( display ) ) { throw importApplicationError(); }
				const history = guard.history.prepareWorkingCopyImportHistory( this, preview ); guard.check();
				if ( !guard.History.isWorkingCopyImportHistory( history ) ) { throw importApplicationError(); }
				result = guard.session.commitPreparedWorkingCopyImport( prepared, () => {
					guard.check(); display.preflight(); selection.preflight(); history.preflight(); guard.check();
				} );
				prepared = null;
				display.commit(); selection.commit(); history.commit( result.checkpoint );
				committed = true; record.consumed = true;
				const diagnostics = [], attempt = callback => { try { const notes = callback(); if ( Array.isArray( notes ) ) { diagnostics.push( ...notes ); } } catch ( error ) { diagnostics.push( 'working-copy-import-refresh-failed' ); } };
				attempt( display.notify ); attempt( selection.refresh );
				if ( guard.store.isWorkingCopyAlive() ) {
					attempt( () => guard.canvas.setBaseDimensions( this.isSlide ? guard.store.state.slideCanvasWidth : guard.store.state.baseWidth, this.isSlide ? guard.store.state.slideCanvasHeight : guard.store.state.baseHeight ) );
					attempt( () => guard.canvas.renderLayers( guard.store.state.layers ) ); attempt( selection.refresh );
					attempt( () => guard.editor.layerPanel.updateLayers( guard.store.state.layers ) ); attempt( selection.refresh );
					attempt( () => guard.history.updateUndoRedoButtons() );
				}
				attempt( () => guard.session.cleanupAppliedWorkingCopyImport( record.sessionHandle ) ); attempt( selection.refresh );
				history.refresh( diagnostics ); result.diagnostics = diagnostics;
				return result;
			} catch ( error ) {
				if ( committed ) { result.diagnostics = [ 'working-copy-import-refresh-failed' ]; return result; }
				throw importApplicationError();
			} finally {
				if ( ownsActive ) { record.applying = false; importApplicationActive.delete( this ); }
				if ( prepared ) { try { record.guard.session.releasePreparedWorkingCopyImportCommit( prepared ); } catch ( error ) {} }
				if ( display ) { try { display.release(); } catch ( error ) {} }
			}
		}

		releaseWorkingCopyImport( handle ) {
			const record = importApplications.get( handle );
			if ( !record || record.bridge !== this || record.released || record.applying ) { throw importApplicationError(); }
			record.released = true; importApplications.delete( handle );
			if ( !record.consumed ) { try { record.guard.session.releaseWorkingCopyImport( record.sessionHandle ); } catch ( error ) {} }
		}

		static isWorkingCopyDisplayCommit( value ) {
			return workingCopyDisplayCommits.has( value );
		}

		prepareWorkingCopyDisplayCommit( handle ) {
			const record = workingCopyDisplayRecord( this, handle ), bridge = this;
			const stateCommit = record.store.prepareWorkingCopyPatchCommit( record.patch );
			if ( !record.Store.isWorkingCopyPatchCommit( stateCommit ) ) { throw workingCopyDisplayError(); }
			workingCopyDisplayRecord( this, handle );
			const commit = Object.freeze( {
				preflight: () => { workingCopyDisplayRecord( bridge, handle ); stateCommit.preflight(); },
				commit: () => { stateCommit.commit(); record.committed = true; }
			} );
			workingCopyDisplayCommits.add( commit );
			return commit;
		}

		getWorkingCopyLiveState() {
			try {
				if ( this.disposed || !this.loaded || this.saving || this.reconciling || this.pdfCoordinator || !this.editor.stateManager.isWorkingCopyAlive() ) {
					throw workingCopyDisplayError();
				}
				const Store = workingCopyStoreClass( this ), owner = Store.observeWorkingCopyObject( this, false );
				const editor = Store.observeWorkingCopyObject( this.editor, false ), bag = Store.observeWorkingCopyObject( this.editor.stateManager.state );
				const method = Store.captureWorkingCopyMethod( this.session, 'getEditorState' );
				const state = Store.copyWorkingCopyValue( method.method.call( this.session ) );
				const fields = this.isSlide ? slideFields : sourceFields;
				for ( const [ field, key ] of Object.entries( fields ) ) {
					const descriptor = Object.getOwnPropertyDescriptor( this.editor.stateManager.state, key );
					if ( descriptor && descriptor.value !== undefined ) {
						state.canvas[ field ] = Store.copyWorkingCopyValue( descriptor.value );
					} else {
						delete state.canvas[ field ];
					}
				}
				state.layers = Store.copyWorkingCopyValue( this.editor.stateManager.state.layers );
				Store.checkWorkingCopyObservation( owner ); Store.checkWorkingCopyObservation( editor ); Store.checkWorkingCopyObservation( bag );
				Store.checkWorkingCopyMethods( [ method ] );
				return state;
			} catch ( error ) {
				throw workingCopyDisplayError();
			}
		}

		prepareWorkingCopyDisplay( state, dirty, clearSelection = true ) {
			try {
				if ( this.disposed || !this.loaded || this.saving || this.reconciling || this.pdfCoordinator || typeof dirty !== 'boolean' || !this.editor.stateManager.isWorkingCopyAlive() ) {
					throw workingCopyDisplayError();
				}
				const Store = workingCopyStoreClass( this ), copied = Store.copyWorkingCopyValue( state );
				if ( !copied || !copied.canvas || !Array.isArray( copied.layers ) || Object.keys( copied ).some( key => ![ 'canvas', 'layers' ].includes( key ) ) ) {
					throw workingCopyDisplayError();
				}
				const owner = Store.observeWorkingCopyObject( this, false ), editor = Store.observeWorkingCopyObject( this.editor, false ), store = this.editor.stateManager;
				const methods = [ 'prepareWorkingCopyPatch', 'preflightWorkingCopyPatch', 'commitWorkingCopyPatch', 'notifyWorkingCopyPatch', 'isWorkingCopyAlive', 'prepareWorkingCopyPatchCommit' ]
					.map( key => Store.captureWorkingCopyMethod( store, key ) );
				const values = { layers: copied.layers, isDirty: dirty, isSlide: this.isSlide,
					baseWidth: copied.canvas.width, baseHeight: copied.canvas.height }, clear = [];
				if ( clearSelection ) { values.selectedLayerIds = []; }
				for ( const [ field, key ] of Object.entries( this.isSlide ? slideFields : sourceFields ) ) {
					if ( Object.hasOwn( copied.canvas, field ) ) {
						values[ key ] = copied.canvas[ field ];
					} else {
						clear.push( key );
					}
				}
				const patch = store.prepareWorkingCopyPatch( { values, clear } ), handle = Object.freeze( Object.create( null ) );
				workingCopyDisplays.set( handle, { bridge: this, Store, owner, editor, store, methods, patch, clearSelection, committed: false, refreshed: false } );
				workingCopyDisplayRecord( this, handle );
				return handle;
			} catch ( error ) {
				throw workingCopyDisplayError();
			}
		}

		preflightWorkingCopyDisplay( handle ) {
			workingCopyDisplayRecord( this, handle );
		}

		commitWorkingCopyDisplay( handle ) {
			const record = workingCopyDisplayRecord( this, handle );
			record.store.commitWorkingCopyPatch( record.patch );
			record.committed = true;
		}

		refreshWorkingCopyDisplay( handle ) {
			const record = workingCopyDisplayRecord( this, handle, true );
			if ( record.refreshed ) {
				throw workingCopyDisplayError();
			}
			record.refreshed = true;
			const diagnostics = [], attempt = callback => {
				try { callback(); } catch ( error ) { diagnostics.push( 'working-copy-refresh-failed' ); }
			};
			const selection = record.store.state.selectedLayerIds;
			if ( !record.store.isWorkingCopyAlive() ) { return [ 'working-copy-refresh-destroyed' ]; }
			attempt( () => diagnostics.push( ...record.store.notifyWorkingCopyPatch( record.patch ) ) );
			if ( !record.store.isWorkingCopyAlive() ) { return diagnostics.concat( 'working-copy-refresh-destroyed' ); }
			const editor = this.editor, store = record.store;
			if ( editor && editor.canvasManager ) {
				attempt( () => {
					const width = this.isSlide ? store.state.slideCanvasWidth : store.state.baseWidth;
					const height = this.isSlide ? store.state.slideCanvasHeight : store.state.baseHeight;
					editor.canvasManager.setBaseDimensions( width, height );
				} );
				attempt( () => {
					if ( !record.clearSelection || store.state.selectedLayerIds !== selection ) { return; }
					if ( editor.canvasManager.selectionManager ) {
						editor.canvasManager.selectionManager.clearSelection();
					} else {
						editor.canvasManager.selectedLayerId = null; editor.canvasManager.selectedLayerIds = [];
					}
				} );
				attempt( () => editor.canvasManager.renderLayers( store.state.layers ) );
			}
			if ( editor && editor.layerPanel ) {
				attempt( () => editor.layerPanel.updateLayers( store.state.layers ) );
			}
			if ( editor && editor.historyManager ) {
				attempt( () => editor.historyManager.updateUndoRedoButtons() );
			}
			return diagnostics;
		}

		releaseWorkingCopyDisplay( handle ) {
			const record = workingCopyDisplays.get( handle );
			if ( !record || record.bridge !== this ) {
				throw workingCopyDisplayError();
			}
			record.store.releaseWorkingCopyPatch( record.patch );
			workingCopyDisplays.delete( handle );
		}

		/**
		 * @param {Object} editor Existing editor with StateManager and optional rendering components
		 * @param {Object} session PageOwnedEditorSession
		 */
		constructor( editor, session ) {
			this.editor = editor;
			this.session = session;
			this.disposed = false;
			this.loaded = false;
			this.saving = false;
			this.reconciling = false;
			this.isSlide = true;
		}

		/** @return {Object} Surface canvas fields mapped to editor state keys @private */
		_fields() {
			return this.isSlide ? slideFields : sourceFields;
		}

		/** @return {Promise<Object>} Loaded selected surface, with no legacy normalization or draft recovery */
		async load() {
			const state = await this.session.load();
			this._requireActive();
			const draft = this.session.getDraft();
			const surface = draft.snapshot.surfaces.find( ( item ) => item.id === draft.surfaceId );
			// The background must be the pinned file version the server issued; never draw one as a blank slide.
			const config = this.editor.config || {};
			if ( surface.kind === 'slide' ? config.isSlide === false : config.isSlide !== false || !config.imageUrl ) {
				throw this._error( 'layers-editor-surface-unavailable' );
			}
			this.isSlide = surface.kind === 'slide';
			this._applyState( state );
			this.editor.stateManager.set( 'isDirty', false );
			this.loaded = true;
			if ( this.pdfCoordinator ) {
				this.pdfCoordinator.initialize();
			}
			return state;
		}

		/**
		 * Apply an inspected, explicitly accepted draft without changing server identity.
		 * @param {Object} candidate Validated draft-controller recovery candidate
		 */
		restoreDraft( candidate ) {
			this._requireActive();
			if ( candidate.workingCopyDraft ) {
				return this.commitWorkingCopyDraftRecovery( this.prepareWorkingCopyDraftRecovery( candidate ) );
			}
			if ( !this.loaded || this.session.getStatus().readOnly || this.session.getStatus().phase !== 'ready' ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
			if ( candidate.pdfDraft ) {
				if ( !this.pdfCoordinator ) {
					throw this._error( 'layers-editor-session-unavailable' );
				}
				return this.pdfCoordinator.restoreDraft( candidate );
			}
			this._applyState( candidate.editorState );
			if ( typeof candidate.label === 'string' && candidate.label !== this.session.getLabel() ) {
				this.session.rename( candidate.label );
			}
			if ( candidate.publicationBlocked ) {
				this.session.blockPublication();
			}
			this.editor.stateManager.set( 'isDirty', true );
		}

		/** @param {Object} state Canvas/layers pair @private */
		_applyState( state, resetHistory = true ) {
			const store = this.editor.stateManager;
			store.set( 'isSlide', this.isSlide );
			for ( const [ field, key ] of Object.entries( this._fields() ) ) {
				store.set( key, state.canvas[ field ] );
			}
			store.set( 'baseWidth', state.canvas.width );
			store.set( 'baseHeight', state.canvas.height );
			store.set( 'layers', state.layers );
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.setBaseDimensions( state.canvas.width, state.canvas.height );
				this.editor.canvasManager.renderLayers( state.layers );
			}
			if ( this.editor.layerPanel ) {
				this.editor.layerPanel.updateLayers( state.layers );
			}
			if ( resetHistory && this.editor.historyManager ) {
				this.editor.historyManager.saveInitialState();
			}
		}

		/** @return {string} The drawing's name, including a rename not yet saved */
		getName() {
			this._requireActive();
			return this.session.getLabel();
		}

		/**
		 * Rename the drawing; the next save publishes the name and updates this page's embeds.
		 * @param {string} name Proposed name
		 * @return {string} The name as it will be saved
		 */
		rename( name ) {
			this._requireActive();
			if ( !this.loaded ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
			const label = this.session.rename( name );
			if ( this.session.getStatus().dirty ) {
				this.editor.stateManager.set( 'isDirty', true );
			}
			return label;
		}

		/** Capture current editor values while retaining unexposed canvas fields. */
		capture() {
			if ( this.editor.historyManager && this.editor.historyManager.hasWorkingCopyHistory &&
				this.editor.historyManager.hasWorkingCopyHistory( this ) ) {
				this.session.updateWorkingCopyDraftState( this.captureWorkingCopyDraft().workingCopyDraft.workingState );
				return;
			}
			this.session.update( this.getLiveState() );
		}

		/** @return {Object} Live editor data, including edits not yet valid for publication */
		getLiveState() {
			this._requireActive();
			if ( !this.loaded ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
			if ( this.editor.historyManager && this.editor.historyManager.hasWorkingCopyHistory &&
				this.editor.historyManager.hasWorkingCopyHistory( this ) ) {
				return this.getWorkingCopyDraftLiveState();
			}
			const state = this.session.getEditorState();
			for ( const [ field, key ] of Object.entries( this._fields() ) ) {
				const value = this.editor.stateManager.get( key );
				if ( value !== undefined ) {
					state.canvas[ field ] = value;
				}
			}
			const layers = this.editor.stateManager.get( 'layers' );
			state.layers = Array.isArray( layers ) ? layers.map( withoutClearedValues ) : layers;
			return state;
		}

		/**
		 * @param {string} summary Explicit page-history summary
		 * @param {Function} [beforePublish] Persist a saving-phase draft before dispatch
		 * @return {Promise<Object>} Confirmed save state, including whether newer editor data is valid
		 */
		async save( summary = '', beforePublish ) {
			this._requireActive();
			if ( this.pdfCoordinator ) {
				this.pdfCoordinator.invalidate();
			}
			if ( this.saving || this.session.getStatus().phase !== 'ready' ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
			this.capture();
			this.saving = true;
			let editorStateValid = true;
			let publicationConfirmed = false;
			try {
				await this.session.save( summary, beforePublish );
				publicationConfirmed = true;
			} finally {
				this.saving = false;
				if ( !this.disposed ) {
					// The canvas can change while the POST is pending. Do not mark those edits saved.
					try {
						this.capture();
					} catch ( error ) {
						// A confirmed write remains confirmed. Keep newer invalid editor data intact/dirty.
						editorStateValid = false;
					}
					this.editor.stateManager.set( 'isDirty', !editorStateValid || this.session.getStatus().dirty );
					if ( publicationConfirmed && editorStateValid && this.pdfCoordinator ) {
						this.pdfCoordinator.confirmBase();
					}
				}
			}
			this._requireActive();
			return {
				...this.session.getStatus(),
				dirty: this.editor.stateManager.get( 'isDirty' ),
				editorStateValid
			};
		}

		/**
		 * @param {number} revisionId Exact server revision to compare
		 * @return {Promise<Object>} Reconciled status; newer live edits remain dirty
		 */
		async reconcile( revisionId ) {
			if ( this.session.hasCreationImport() ) { return this._reconcileCreationImport( revisionId ); }
			if ( this.pdfCoordinator ) {
				this.pdfCoordinator.invalidate();
			}
			this.capture();
			this.reconciling = true;
			let editorStateValid = true;
			let reconciliationConfirmed = false;
			try {
				await this.session.reconcile( revisionId );
				reconciliationConfirmed = true;
			} finally {
				this.reconciling = false;
				if ( !this.disposed ) {
					try {
						this.capture();
					} catch ( error ) {
						editorStateValid = false;
					}
					this.editor.stateManager.set( 'isDirty', !editorStateValid || this.session.getStatus().dirty );
					if ( reconciliationConfirmed && editorStateValid && this.pdfCoordinator ) {
						this.pdfCoordinator.confirmBase();
					}
				}
			}
			this._requireActive();
			return { ...this.session.getStatus(), dirty: this.editor.stateManager.get( 'isDirty' ), editorStateValid };
		}

		/** Prepared session/history/configuration commit; live editor geometry and selection stay intact. */
		async _reconcileCreationImport( revisionId ) {
			this._requireActive();
			if ( this.saving || this.reconciling || !this.loaded || this.pdfCoordinator ) { throw importApplicationError(); }
			this.capture();
			const editor = this.editor, history = editor.historyManager, store = editor.stateManager, Store = workingCopyStoreClass( this );
			this.reconciling = true;
			let sessionTransaction;
			try {
				const captured = history.prepareCreationImportRebaseHistory( this );
				const check = () => { captured.preflight(); };
				sessionTransaction = await this.session.prepareCreationImportRebase( revisionId, captured.checkpoints, check );
				check();
				if ( !this.session.constructor.isCreationImportRebase( sessionTransaction ) ) { throw importApplicationError(); }
				const creation = sessionTransaction.inspect(), historyTransaction = captured.prepare( sessionTransaction );
				if ( !history.constructor.isCreationRebaseHistory( historyTransaction ) ) { throw importApplicationError(); }
				const configured = Object.getOwnPropertyDescriptor( editor.config, 'pageOwned' );
				if ( !configured || !Object.hasOwn( configured, 'value' ) || !configured.writable ) { throw importApplicationError(); }
				const nextConfig = { ...Store.copyWorkingCopyValue( configured.value ), revisionId, surfaceId: creation.target.surfaceId,
					newSurface: Store.copyWorkingCopyValue( creation.newSurface ), emptyBase: !creation.hasLayersSlot,
					creationSelection: Store.copyWorkingCopyValue( creation.selection ) };
				const patch = store.prepareWorkingCopyPatch( { values: { isDirty: true }, clear: [] } ), patchCommit = store.prepareWorkingCopyPatchCommit( patch );
				if ( !Store.isWorkingCopyPatchCommit( patchCommit ) ) { throw importApplicationError(); }
				sessionTransaction.preflight(); historyTransaction.preflight(); patchCommit.preflight(); check();
				// No await or notification between these checked, synchronous participant commits.
				sessionTransaction.commit(); historyTransaction.commit(); patchCommit.commit();
				Object.defineProperty( editor.config, 'pageOwned', { value: nextConfig } );
				this.reconciling = false;
				try { store.notifyWorkingCopyPatch( patch ); history.updateUndoRedoButtons(); } catch ( error ) { /* Committed work remains intact. */ }
				return { ...this.session.getStatus(), dirty: true, editorStateValid: true };
			} catch ( error ) { throw importApplicationError(); }
			finally { if ( sessionTransaction ) { sessionTransaction.release(); } this.reconciling = false; }
		}

		/** Call only after the owning UI has preserved any draft it needs. */
		dispose() {
			if ( this.pdfCoordinator ) {
				this.pdfCoordinator.dispose();
			}
			this.disposed = true;
			this.loaded = false;
			this.session.dispose();
			this.editor = null;
		}

		/** @private */
		_requireActive() {
			if ( this.disposed ) {
				throw this._error( 'layers-editor-session-unavailable' );
			}
		}

		/** @param {string} code @return {Error} @private */
		_error( code ) {
			const error = new Error( code );
			error.code = code;
			return error;
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedEditorBridge = PageOwnedEditorBridge;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedEditorBridge;
	}
}() );
