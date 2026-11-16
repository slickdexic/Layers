'use strict';
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );

describe( 'PageOwnedDraftLifecycle', () => {
	let lifecycle, bridge, controller, ui, listeners;
	beforeEach( () => {
		jest.useFakeTimers();
		listeners = {};
		bridge = {
			getLiveState: () => ( { canvas: {}, layers: [] } ),
			restoreDraft: jest.fn(),
			session: { blockPublication: jest.fn(), revalidate: jest.fn().mockResolvedValue(),
				getStatus: () => ( { phase: 'ready' } ) },
			reconcile: jest.fn().mockResolvedValue( { revisionId: 13, dirty: true } ),
			editor: { stateManager: { subscribe: ( key, fn ) => {
				listeners[ key ] = fn;
				return () => { delete listeners[ key ]; };
			} } },
			save: jest.fn( async ( summary, persist ) => {
				await persist();
				return { revisionId: 13, dirty: false };
			} )
		};
		controller = {
			inspectRecovery: jest.fn().mockReturnValue( null ), persist: jest.fn(),
			listCandidates: jest.fn().mockReturnValue( [] ), describeCandidates: jest.fn( ( ids ) => ids.map( () => ( {} ) ) ), selectRecovery: jest.fn()
		};
		ui = { confirmRecovery: jest.fn().mockResolvedValue( true ), notifyFailure: jest.fn(), notifyBlocked: jest.fn() };
		lifecycle = new Lifecycle( bridge, controller, ui );
	} );
	afterEach( () => { lifecycle.dispose(); jest.useRealTimers(); } );

	it( 'waits for both stores before offering recovery and stops if disposed during discovery', async () => {
		let resolve;
		controller.initialize = jest.fn( () => new Promise( done => { resolve = done; } ) );
		const initializing = lifecycle.initialize();
		expect( controller.listCandidates ).not.toHaveBeenCalled();
		lifecycle.dispose(); resolve(); await initializing;
		expect( controller.listCandidates ).not.toHaveBeenCalled();
		expect( lifecycle.ready ).toBe( false );
	} );

	it( 'revalidates the selected stored draft after Restore confirmation before applying it', async () => {
		controller.inspectRecovery.mockReturnValue( { editorState: {}, publicationBlocked: false } );
		controller.revalidateRecovery = jest.fn().mockRejectedValue( new Error( 'changed-backup' ) );
		await expect( lifecycle.initialize() ).rejects.toThrow( 'changed-backup' );
		expect( ui.confirmRecovery ).toHaveBeenCalledTimes( 1 );
		expect( bridge.restoreDraft ).not.toHaveBeenCalled();
		expect( lifecycle.ready ).toBe( false );
	} );

	it( 'waits for committed backup before publication and refuses Close during the pending write', async () => {
		await lifecycle.initialize();
		let complete;
		controller.persistDurably = jest.fn().mockImplementationOnce( guard => new Promise( resolve => {
			complete = () => { guard(); resolve(); };
		} ) ).mockResolvedValue();
		controller.retireOwned = jest.fn();
		const published = jest.fn();
		bridge.save.mockImplementation( async ( summary, beforePublish ) => {
			await beforePublish(); published(); return { revisionId: 13 };
		} );
		const saving = lifecycle.save();
		expect( published ).not.toHaveBeenCalled();
		expect( lifecycle.finalizeClose( true ) ).toBe( false );
		expect( controller.retireOwned ).not.toHaveBeenCalled();
		complete(); await expect( saving ).resolves.toMatchObject( { revisionId: 13, draftPersisted: true } );
		expect( published ).toHaveBeenCalledTimes( 1 );
	} );

	it.each( [ 'edits', 'close' ] )( 'does not apply recovery after %s during the renewed permission read', async change => {
		controller.inspectRecovery.mockReturnValue( { editorState: {}, publicationBlocked: false } );
		bridge.session.revalidate.mockImplementation( async () => {
			if ( change === 'close' ) { lifecycle.finalizeClose( true ); }
			else { bridge.getLiveState = () => ( { canvas: {}, layers: [ { id: 'new' } ] } ); }
		} );
		controller.retireOwned = jest.fn();
		if ( change === 'edits' ) { await expect( lifecycle.initialize() ).rejects.toThrow( 'layers-editor-session-unavailable' ); }
		else { await lifecycle.initialize(); }
		expect( bridge.restoreDraft ).not.toHaveBeenCalled();
		expect( lifecycle.ready ).toBe( false );
		expect( Object.keys( listeners ) ).toHaveLength( 0 );
	} );

	it( 'completes local-only retirement before pagehide can recreate the draft', async () => {
		await lifecycle.initialize();
		controller.retireOwnedAsync = jest.fn();
		const closing = lifecycle.finalizeCloseAsync();
		expect( lifecycle.finalized ).toBe( true );
		window.dispatchEvent( new Event( 'pagehide' ) );
		expect( controller.persist ).not.toHaveBeenCalled();
		await expect( closing ).resolves.toBe( true );
	} );

	it( 'passes quota failure details to the approved warning callback', async () => {
		await lifecycle.initialize();
		const error = Object.assign( new Error( 'layers-draft-storage-quota' ), { code: 'layers-draft-storage-quota' } );
		controller.persistDurably = jest.fn().mockRejectedValue( error );
		expect( await lifecycle.flushDurably( true ) ).toBe( false );
		expect( ui.notifyFailure ).toHaveBeenCalledWith( true, error );
	} );

	it( 'keeps synchronous Close blocked while an automatic backup transaction is pending', async () => {
		await lifecycle.initialize();
		let complete;
		controller.persistDurably = jest.fn( () => new Promise( resolve => { complete = resolve; } ) );
		controller.retireOwned = jest.fn();
		const pending = lifecycle.flushDurably();
		expect( lifecycle.finalizeClose( true ) ).toBe( false );
		expect( lifecycle.finalizeCloseAsync( true ) ).toBe( false );
		complete(); await pending;
		expect( lifecycle.finalizeClose( true ) ).toBe( true );
	} );

	it( 'rejects publication when durable storage fails and preserves the open editor', async () => {
		await lifecycle.initialize();
		controller.persistDurably = jest.fn().mockRejectedValue( new Error( 'layers-draft-storage-quota' ) );
		const published = jest.fn();
		bridge.save.mockImplementation( async ( summary, beforePublish ) => { await beforePublish(); published(); } );
		await expect( lifecycle.save() ).rejects.toThrow( 'layers-draft-storage-quota' );
		expect( published ).not.toHaveBeenCalled();
		expect( lifecycle.finalized ).toBe( false );
		expect( lifecycle.saving ).toBe( false );
	} );

	it( 'waits for owned retirement and refuses duplicate Close until its transaction completes', async () => {
		await lifecycle.initialize();
		let complete;
		controller.retireOwnedAsync = jest.fn( () => new Promise( resolve => { complete = resolve; } ) );
		const closing = lifecycle.finalizeCloseAsync();
		expect( lifecycle.finalized ).toBe( false );
		expect( lifecycle.finalizeCloseAsync() ).toBe( false );
		await expect( lifecycle.save() ).rejects.toThrow( 'layers-editor-session-unavailable' );
		complete(); await expect( closing ).resolves.toBe( true );
		expect( lifecycle.finalized ).toBe( true );
	} );

	it( 'keeps edits made during retirement open and backs them up again', async () => {
		await lifecycle.initialize();
		let complete;
		controller.retireOwnedAsync = jest.fn( () => new Promise( resolve => { complete = resolve; } ) );
		const closing = lifecycle.finalizeCloseAsync( true );
		bridge.getLiveState = () => ( { canvas: {}, layers: [ { id: 'late' } ] } );
		complete(); await expect( closing ).resolves.toBe( false );
		expect( lifecycle.finalized ).toBe( false );
		expect( controller.persist ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'refuses Close when a new automatic backup is still pending after retirement', async () => {
		await lifecycle.initialize();
		let retire, write;
		controller.retireOwnedAsync = jest.fn( () => new Promise( resolve => { retire = resolve; } ) );
		controller.persistDurably = jest.fn().mockImplementationOnce( () => new Promise( resolve => { write = resolve; } ) ).mockResolvedValue();
		const closing = lifecycle.finalizeCloseAsync();
		const backup = lifecycle.flushDurably();
		retire(); await expect( closing ).resolves.toBe( false );
		expect( lifecycle.finalized ).toBe( false );
		write(); await backup;
	} );

	it( 'preserves inactive PDF page edits made during retirement', async () => {
		await lifecycle.initialize();
		let retire, pdfState = 'before';
		bridge.pdfCoordinator = { witness: jest.fn( () => pdfState ) };
		controller.retireOwnedAsync = jest.fn( () => new Promise( resolve => { retire = resolve; } ) );
		const closing = lifecycle.finalizeCloseAsync( true );
		pdfState = 'new inactive page edits'; retire();
		await expect( closing ).resolves.toBe( false );
		expect( lifecycle.finalized ).toBe( false );
		expect( controller.persist ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'backs up before revision discovery and after reconciliation without publishing', async () => {
		await lifecycle.initialize();
		const discover = jest.fn( async () => {
			expect( controller.persist ).toHaveBeenCalledTimes( 1 );
			return 13;
		} );
		expect( await lifecycle.reconcile( discover ) ).toMatchObject( { revisionId: 13, draftPersisted: true } );
		expect( bridge.reconcile ).toHaveBeenCalledWith( 13 );
		expect( controller.persist ).toHaveBeenCalledTimes( 2 );
		expect( bridge.save ).not.toHaveBeenCalled();
	} );

	it( 'does not read or reconcile when the initial backup fails', async () => {
		await lifecycle.initialize();
		controller.persist.mockImplementation( () => { throw new Error(); } );
		const discover = jest.fn();
		await expect( lifecycle.reconcile( discover ) ).rejects.toThrow( 'layers-draft-storage-failed' );
		expect( discover ).not.toHaveBeenCalled();
		expect( bridge.reconcile ).not.toHaveBeenCalled();
	} );

	it( 'reports a failed new-base backup without reversing successful reconciliation', async () => {
		await lifecycle.initialize();
		controller.persist.mockImplementationOnce( () => {} ).mockImplementationOnce( () => { throw new Error(); } );
		expect( await lifecycle.reconcile( async () => 13 ) ).toMatchObject( { revisionId: 13, draftPersisted: false } );
		expect( ui.notifyFailure ).toHaveBeenCalledTimes( 1 );
		expect( ui.notifyFailure ).toHaveBeenCalledWith();
	} );

	it( 'rejects a check while publication is in flight before discovery', async () => {
		await lifecycle.initialize();
		bridge.session.getStatus = () => ( { phase: 'saving' } );
		const discover = jest.fn();
		await expect( lifecycle.reconcile( discover ) ).rejects.toThrow( 'layers-editor-session-unavailable' );
		expect( discover ).not.toHaveBeenCalled();
		expect( controller.persist ).not.toHaveBeenCalled();
	} );

	it( 'blocks save and duplicate checks during discovery and stops after disposal', async () => {
		await lifecycle.initialize();
		let resolve;
		const discover = jest.fn( () => new Promise( ( done ) => { resolve = done; } ) );
		const checking = lifecycle.reconcile( discover );
		await expect( lifecycle.save() ).rejects.toThrow( 'layers-editor-session-unavailable' );
		await expect( lifecycle.reconcile( discover ) ).rejects.toThrow( 'layers-editor-session-unavailable' );
		lifecycle.dispose();
		resolve( 13 );
		await expect( checking ).rejects.toThrow( 'layers-editor-session-unavailable' );
		expect( bridge.reconcile ).not.toHaveBeenCalled();
	} );

	it( 'does not apply or back up recovery after the renewed permission check fails', async () => {
		controller.inspectRecovery.mockReturnValue( { editorState: {}, publicationBlocked: false } );
		bridge.session.revalidate.mockRejectedValue( new Error( 'layers-revision-unavailable' ) );
		await expect( lifecycle.initialize() ).rejects.toThrow( 'layers-revision-unavailable' );
		expect( bridge.restoreDraft ).not.toHaveBeenCalled();
		expect( lifecycle.flush() ).toBe( false );
		expect( controller.persist ).not.toHaveBeenCalled();
	} );

	it( 'selects only the chosen record before inspecting recovery', async () => {
		controller.listCandidates.mockReturnValue( [ 'first', 'second' ] );
		ui.chooseDraft = jest.fn().mockResolvedValue( 1 );
		await lifecycle.initialize();
		expect( ui.chooseDraft ).toHaveBeenCalledWith( [ {}, {} ] );
		expect( controller.selectRecovery ).toHaveBeenCalledWith( 'second' );
	} );

	it( 'cancelling record selection never starts writes or publication', async () => {
		controller.listCandidates.mockReturnValue( [ 'first', 'second' ] );
		ui.chooseDraft = jest.fn().mockResolvedValue( null );
		await lifecycle.initialize();
		expect( lifecycle.flush() ).toBe( false );
		await expect( lifecycle.save() ).rejects.toThrow( 'layers-editor-session-unavailable' );
		expect( controller.inspectRecovery ).not.toHaveBeenCalled();
		expect( controller.persist ).not.toHaveBeenCalled();
	} );

	it( 'debounces live editor changes and flushes on pagehide', async () => {
		await lifecycle.initialize();
		listeners.layers();
		listeners.slideCanvasWidth();
		jest.advanceTimersByTime( 1000 );
		expect( controller.persist ).toHaveBeenCalledTimes( 1 );
		window.dispatchEvent( new Event( 'pagehide' ) );
		expect( controller.persist ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'offers recovery of a draft that differs from the loaded revision only in its name', async () => {
		bridge.getName = () => 'Welcome';
		const candidate = { editorState: { canvas: {}, layers: [] }, label: 'Renamed', publicationBlocked: false };
		controller.inspectRecovery.mockReturnValue( candidate );
		await lifecycle.initialize();
		expect( ui.confirmRecovery ).toHaveBeenCalledWith( candidate );
		expect( bridge.restoreDraft ).toHaveBeenCalledWith( candidate );
	} );

	it( 'renames through the bridge and backs the name up at once, only when ready', async () => {
		bridge.rename = jest.fn( ( name ) => name.trim() );
		expect( () => lifecycle.rename( 'Early' ) ).toThrow( 'layers-editor-session-unavailable' );
		await lifecycle.initialize();
		expect( lifecycle.rename( ' Renamed ' ) ).toBe( 'Renamed' );
		expect( controller.persist ).toHaveBeenCalledTimes( 1 );
		bridge.rename.mockImplementation( () => {
			throw Object.assign( new Error( 'x' ), { code: 'layers-page-drawing-rename-taken' } );
		} );
		expect( () => lifecycle.rename( 'Taken' ) ).toThrow( 'x' );
		expect( controller.persist ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not offer recovery of a draft that differs from the loaded revision only in key order', async () => {
		bridge.getLiveState = () => ( { canvas: { height: 2, width: 1 }, layers: [ { id: 'a', type: 'marker', x: 1 } ] } );
		controller.inspectRecovery.mockReturnValue( {
			editorState: { layers: [ { x: 1, type: 'marker', id: 'a' } ], canvas: { width: 1, height: 2 } },
			publicationBlocked: false
		} );
		await lifecycle.initialize();
		expect( ui.confirmRecovery ).not.toHaveBeenCalled();
		expect( lifecycle.ready ).toBe( true );
	} );

	it.each( [ true, false ] )( 'requires reconciliation of a blocked draft even when recovery choice is %s', async ( recover ) => {
		const candidate = { editorState: { canvas: {}, layers: [ {} ] }, publicationBlocked: true };
		controller.inspectRecovery.mockReturnValue( candidate );
		ui.confirmRecovery.mockResolvedValue( recover );
		await lifecycle.initialize();
		expect( ui.confirmRecovery ).toHaveBeenCalledTimes( 1 );
		if ( recover ) {
			expect( bridge.restoreDraft ).toHaveBeenCalledWith( candidate );
		} else {
			expect( bridge.session.blockPublication ).toHaveBeenCalledTimes( 1 );
			expect( bridge.restoreDraft ).not.toHaveBeenCalled();
			expect( lifecycle.flush() ).toBe( false );
			expect( controller.persist ).not.toHaveBeenCalled();
		}
		expect( ui.notifyBlocked ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not enable saving or overwrite a corrupt unread draft', async () => {
		controller.inspectRecovery.mockImplementation( () => { throw new Error( 'corrupt' ); } );
		await expect( lifecycle.initialize() ).rejects.toThrow( 'corrupt' );
		await expect( lifecycle.save() ).rejects.toThrow( 'layers-editor-session-unavailable' );
		expect( lifecycle.flush() ).toBe( false );
		expect( controller.persist ).not.toHaveBeenCalled();
	} );

	it( 'persists before publication and after confirmation', async () => {
		await lifecycle.initialize();
		expect( await lifecycle.save( 'Summary' ) ).toMatchObject( { revisionId: 13, draftPersisted: true } );
		expect( controller.persist ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'does not misreport a confirmed write when the final backup fails', async () => {
		await lifecycle.initialize();
		controller.persist.mockImplementationOnce( () => {} ).mockImplementationOnce( () => { throw new Error(); } );
		expect( await lifecycle.save() ).toMatchObject( { revisionId: 13, draftPersisted: false } );
		expect( ui.notifyFailure ).toHaveBeenCalledTimes( 1 );
		expect( ui.notifyFailure ).toHaveBeenCalledWith( true );
	} );

	it( 'does not apply an async recovery decision after disposal', async () => {
		controller.inspectRecovery.mockReturnValue( { editorState: {}, publicationBlocked: false } );
		let resolve;
		ui.confirmRecovery.mockReturnValue( new Promise( ( done ) => { resolve = done; } ) );
		const initializing = lifecycle.initialize();
		lifecycle.dispose();
		resolve( true );
		await initializing;
		expect( bridge.restoreDraft ).not.toHaveBeenCalled();
		expect( lifecycle.ready ).toBe( false );
		expect( Object.keys( listeners ) ).toHaveLength( 0 );
	} );
} );
