'use strict';
const { copy, setup, importedContext, controllerFor, mapStorage, writerA, writerB, witness, nativeCalls } =
	require( './PageOwnedWholePdfImportDraftStorage.test.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );

async function pair( confirm = true ) {
	const old = await importedContext(), storage = mapStorage();
	try {
		const original = controllerFor( old.work, old.application, storage, writerA ); original.controller.persist();
		const fresh = await setup(), next = controllerFor( fresh.work, fresh.application, storage, writerB );
		const ui = { chooseDraft: jest.fn().mockResolvedValue( 0 ), confirmRecovery: jest.fn().mockResolvedValue( confirm ),
			notifyFailure: jest.fn(), notifyBlocked: jest.fn() };
		const lifecycle = new Lifecycle( fresh.work.bridge, next.controller, ui );
		return { old, fresh, storage, original, next, ui, lifecycle,
			close: () => { lifecycle.dispose(); fresh.work.close(); old.work.close(); } };
	} catch ( error ) { old.work.close(); throw error; }
}

describe( 'Complete whole-PDF drafts through the actual lifecycle', () => {
	it( 'restores complete work only after the existing explicit confirmation', async () => {
		const value = await pair();
		try {
			expect( value.fresh.work.session._snapshot ).not.toEqual( value.old.work.session._snapshot );
			await value.lifecycle.initialize();
			expect( value.ui.confirmRecovery ).toHaveBeenCalledTimes( 1 ); expect( value.lifecycle.ready ).toBe( true );
			expect( value.fresh.work.session._snapshot ).toEqual( value.old.work.session._snapshot );
			expect( nativeCalls( value.fresh.api ) ).toHaveLength( 0 );
		} finally { value.close(); }
	} );

	it( 'restores whole-group Undo and Redo on both PDF pages', async () => {
		const value = await pair();
		try {
			await value.lifecycle.initialize(); const imported = copy( value.fresh.work.session._snapshot );
			for ( const page of [ 1, 2 ] ) { expect( await value.fresh.work.bridge.pdfCoordinator.turn( page ) ).toBe( true ); }
			expect( value.fresh.work.editor.historyManager.undo() ).toBe( true );
			expect( value.fresh.work.session._snapshot ).not.toEqual( imported );
			expect( value.fresh.work.editor.historyManager.redo() ).toBe( true );
			expect( value.fresh.work.session._snapshot ).toEqual( imported );
		} finally { value.close(); }
	} );

	it( 'uses freshly rebuilt source authority on the recovered first Save', async () => {
		const value = await pair();
		try {
			await value.lifecycle.initialize(); const result = await value.lifecycle.save( 'Recovered whole PDF' );
			expect( result ).toMatchObject( { revisionId: 13, dirty: false, draftPersisted: true } );
			expect( nativeCalls( value.fresh.api ) ).toHaveLength( 1 );
			const records = Array.from( value.storage.rows.values(), raw => JSON.parse( raw ) );
			expect( records.some( record => record.scope.baseRevisionId === 13 && record.wholePdfImportDraft.session.sources.length === 0 ) ).toBe( true );
			expect( records.some( record => record.scope.baseRevisionId === 12 && record.wholePdfImportDraft.session.sources.length > 0 ) ).toBe( true );
		} finally { value.close(); }
	} );

	it( 'keeps all backups and current work on Keep drafts unchanged without native reads', async () => {
		const value = await pair( false );
		try {
			const before = Array.from( value.storage.rows ), snapshot = copy( value.fresh.work.session._snapshot );
			await value.lifecycle.initialize();
			expect( value.lifecycle.ready ).toBe( false ); expect( value.ui.notifyBlocked ).toHaveBeenCalledTimes( 1 );
			expect( value.fresh.work.session._snapshot ).toEqual( snapshot );
			expect( Array.from( value.storage.rows ) ).toEqual( before ); expect( value.fresh.sourceApi.post ).not.toHaveBeenCalled();
		} finally { value.close(); }
	} );

	it( 'preserves edits made while the confirmation dialog is open', async () => {
		const value = await pair();
		try {
			let confirm; value.ui.confirmRecovery.mockImplementation( () => new Promise( done => { confirm = done; } ) );
			const pending = value.lifecycle.initialize(); pending.catch( () => {} );
			value.fresh.work.edit( 'Newer work during Review' ); value.fresh.work.bridge.capture();
			const current = witness( value.fresh.work ), backups = Array.from( value.storage.rows ); confirm( true );
			await expect( pending ).rejects.toBeInstanceOf( Error );
			expect( witness( value.fresh.work ) ).toBe( current ); expect( Array.from( value.storage.rows ) ).toEqual( backups );
			expect( value.lifecycle.ready ).toBe( false );
		} finally { value.close(); }
	} );

	it( 'preserves current work and backups when source access is refused', async () => {
		const value = await pair();
		try {
			value.fresh.sourceApi.post.mockRejectedValue( { error: { code: 'permissiondenied' } } );
			const before = witness( value.fresh.work ), backups = Array.from( value.storage.rows );
			await expect( value.lifecycle.initialize() ).rejects.toBeInstanceOf( Error );
			expect( witness( value.fresh.work ) ).toBe( before ); expect( Array.from( value.storage.rows ) ).toEqual( backups );
			expect( value.lifecycle.ready ).toBe( false ); expect( nativeCalls( value.fresh.api ) ).toHaveLength( 0 );
		} finally { value.close(); }
	} );

	it( 'refuses an altered source backup during asynchronous preparation', async () => {
		const value = await pair();
		try {
			const original = value.fresh.sourceApi.post.getMockImplementation(); let release;
			value.fresh.sourceApi.post.mockImplementationOnce( params => new Promise( done => { release = () => original( params ).then( done ); } ) );
			const pending = value.lifecycle.initialize(); pending.catch( () => {} );
			for ( let tick = 0; tick < 100 && !release; tick++ ) { await Promise.resolve(); }
			expect( release ).toEqual( expect.any( Function ) );
			const key = Array.from( value.storage.rows.keys() )[ 0 ]; value.storage.rows.set( key, value.storage.rows.get( key ) + ' ' );
			const backups = Array.from( value.storage.rows ), before = witness( value.fresh.work ); release();
			await expect( pending ).rejects.toBeInstanceOf( Error );
			expect( witness( value.fresh.work ) ).toBe( before ); expect( Array.from( value.storage.rows ) ).toEqual( backups );
		} finally { value.close(); }
	} );

	it( 'retains an uncertain backup hold after explicit restoration', async () => {
		const value = await pair();
		try {
			const key = Array.from( value.storage.rows.keys() )[ 0 ], raw = JSON.parse( value.storage.rows.get( key ) );
			raw.phase = 'uncertain'; value.storage.rows.set( key, JSON.stringify( raw ) );
			await value.lifecycle.initialize();
			expect( value.fresh.work.session.getStatus().phase ).toBe( 'uncertain' ); expect( value.ui.notifyBlocked ).toHaveBeenCalledTimes( 1 );
			await expect( value.lifecycle.save() ).rejects.toBeInstanceOf( Error ); expect( nativeCalls( value.fresh.api ) ).toHaveLength( 0 );
			expect( value.lifecycle.flush() ).toBe( true );
		} finally { value.close(); }
	} );

	it( 'saves the latest complete work after an uncertain response without clearing its source backup', async () => {
		const value = await pair();
		try {
			await value.lifecycle.initialize(); const originalBackup = Array.from( value.storage.rows.entries() )[ 0 ];
			let reject; value.fresh.api.postWithToken.mockImplementationOnce( () => new Promise( ( resolve, refuse ) => { reject = refuse; } ) );
			const pending = value.lifecycle.save(); pending.catch( () => {} );
			for ( let tick = 0; tick < 100 && !reject; tick++ ) { await Promise.resolve(); }
			expect( reject ).toEqual( expect.any( Function ) );
			value.fresh.work.edit( 'Latest work during uncertain Save' ); value.fresh.work.bridge.capture(); reject( new Error( 'offline' ) );
			await expect( pending ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
			expect( value.storage.rows.get( originalBackup[ 0 ] ) ).toBe( originalBackup[ 1 ] );
			const own = Array.from( value.storage.rows ).find( ( [ key ] ) => key.endsWith( '#' + writerB ) );
			expect( own[ 1 ] ).toContain( 'Latest work during uncertain Save' ); expect( JSON.parse( own[ 1 ] ).phase ).toBe( 'uncertain' );
		} finally { value.close(); }
	} );

	it( 'refuses a copied candidate before creating a recovery transaction', async () => {
		const value = await pair();
		try {
			value.next.controller.selectRecovery( writerA ); const candidate = value.next.controller.inspectRecovery();
			await expect( value.next.controller.prepareWholePdfDraftRecovery( copy( candidate ), () => {} ) ).rejects.toBeInstanceOf( Error );
			expect( value.fresh.sourceApi.post ).not.toHaveBeenCalled();
		} finally { value.close(); }
	} );

	it( 'backs up newer work when ordinary edits trim a group marker during a pending Save', async () => {
		const value = await pair();
		try {
			await value.lifecycle.initialize(); value.fresh.work.editor.historyManager.maxHistorySteps = 2;
			let reject; value.fresh.api.postWithToken.mockImplementationOnce( () => new Promise( ( resolve, refuse ) => { reject = refuse; } ) );
			const pending = value.lifecycle.save(); pending.catch( () => {} );
			for ( let tick = 0; tick < 100 && !reject; tick++ ) { await Promise.resolve(); }
			expect( reject ).toEqual( expect.any( Function ) );
			for ( const text of [ 'First pending edit', 'Latest pending edit' ] ) { value.fresh.work.edit( text ); value.fresh.work.bridge.capture(); }
			const savedWhilePending = value.lifecycle.flush(); reject( new Error( 'offline after trimming' ) );
			await expect( pending ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
			expect( savedWhilePending ).toBe( true );
			const own = Array.from( value.storage.rows ).find( ( [ key ] ) => key.endsWith( '#' + writerB ) );
			expect( own[ 1 ] ).toContain( 'Latest pending edit' );
			const record = JSON.parse( own[ 1 ] ); expect( record.phase ).toBe( 'uncertain' );
			expect( record.wholePdfImportDraft.history.groups.every( group => group.retired ) ).toBe( true );
			value.next.controller.selectRecovery( writerB );
			expect( value.next.controller.inspectRecovery().publicationBlocked ).toBe( true );
		} finally { value.close(); }
	} );

	it( 'installs an uncertain recovery hold before notifying editor observers', async () => {
		const value = await pair();
		try {
			const key = Array.from( value.storage.rows.keys() )[ 0 ], record = JSON.parse( value.storage.rows.get( key ) );
			record.phase = 'uncertain'; value.storage.rows.set( key, JSON.stringify( record ) );
			const history = value.fresh.work.editor.historyManager, original = history.updateUndoRedoButtons, phases = [];
			history.updateUndoRedoButtons = function () { phases.push( value.fresh.work.session.getStatus().phase ); return original.call( this ); };
			await value.lifecycle.initialize();
			expect( phases.length ).toBeGreaterThan( 0 ); expect( phases.every( phase => phase === 'uncertain' ) ).toBe( true );
		} finally { value.close(); }
	} );

	it.each( [ 'wholePdfDraftChanged', 'prepareWholePdfDraftRecovery', 'commitWholePdfDraftRecovery', 'releaseWholePdfDraftRecovery' ] )(
		'refuses replaced recovery routing without overwriting backups: %s', async key => {
			const value = await pair();
			try {
				const before = witness( value.fresh.work ), backups = Array.from( value.storage.rows );
				value.next.controller[ key ] = jest.fn( () => false );
				await expect( value.lifecycle.initialize() ).rejects.toBeInstanceOf( Error );
				expect( witness( value.fresh.work ) ).toBe( before ); expect( Array.from( value.storage.rows ) ).toEqual( backups );
				expect( value.ui.confirmRecovery ).not.toHaveBeenCalled(); expect( value.lifecycle.ready ).toBe( false );
			} finally { value.close(); }
		}
	);
} );
