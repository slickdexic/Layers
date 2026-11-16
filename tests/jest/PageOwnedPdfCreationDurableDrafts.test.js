'use strict';
const { setup, wait, tickUntil } = require( './fixtures/pdfCreationHost.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationLifecycle.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedFallbackDraftStore.js' );

function storage() {
	const values = new Map();
	return { values, quota: true, get length() { return values.size; }, key: index => Array.from( values.keys() )[ index ],
		getItem: key => values.get( key ) ?? null,
		setItem( key, raw ) { if ( this.quota ) throw Object.assign( new Error( 'full' ), { name: 'QuotaExceededError' } ); values.set( key, raw ); },
		removeItem: key => values.delete( key ) };
}
function database() {
	const values = new Map();
	return { values, beforeChange: null, afterChange: null,
		list: async prefix => Array.from( values ).filter( ( [ key ] ) => key.startsWith( prefix ) ),
		read: async key => values.get( key ) ?? null,
		async change( entries ) {
			if ( this.beforeChange ) await this.beforeChange( entries );
			for ( const entry of entries ) if ( ( values.get( entry.key ) ?? null ) !== entry.before ) throw new Error( 'concurrent writer' );
			for ( const entry of entries ) if ( entry.after === null ) values.delete( entry.key ); else values.set( entry.key, entry.after );
			if ( this.afterChange ) await this.afterChange( entries );
		} };
}
async function create( local = storage(), db = database(), writer = 'b', exitWriter = 'd', restore = true ) {
	const work = setup(); await work.host.load();
	const store = new Store( local, writer.repeat( 32 ), true, db ), exit = new Store( local, exitWriter.repeat( 32 ), true, db );
	const controller = new Controller( work.host, store, { wiki: 'wiki', user: 'Editor' }, { retainPublicationAttempt: true } );
	const ui = { choose: jest.fn( async () => 0 ), confirm: jest.fn( async () => restore ), notifyFailure: jest.fn(), notifyBlocked: jest.fn() };
	const lifecycle = new Lifecycle( work.editor, work.host, controller, exit, ui );
	return { work, store, exit, local, db, controller, lifecycle, ui,
		close() { lifecycle.dispose( true ); work.close(); } };
}
it( 'waits for the committed fallback before native first Save and preserves later edits', async () => {
	const value = await create(); const { work, lifecycle, db } = value;
	try {
		await lifecycle.initialize(); work.edit( 'Sent' );
		const blocked = wait(); let entered = false;
		db.beforeChange = async () => { entered = true; await blocked.promise; };
		work.publisher.publish.mockResolvedValue( { revisionId: 13 } );
		const saving = lifecycle.save(); await tickUntil( () => entered );
		expect( work.publisher.publish ).not.toHaveBeenCalled(); work.edit( 'Later' ); blocked.resolve();
		expect( await saving ).toMatchObject( { revisionId: 13, draftPersisted: true } );
		expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
		expect( work.editor.layers[ 0 ].text ).toBe( 'Later' ); expect( work.host.getStatus().dirty ).toBe( true );
		expect( Array.from( db.values.values() ).some( raw => raw.includes( 'Later' ) ) ).toBe( true );
	} finally { value.close(); }
} );
it.each( [ 'layers-draft-storage-failed', 'layers-draft-storage-quota' ] )( 'refuses %s before dispatch while retaining drafts and work', async code => {
	const value = await create();
	try {
		await value.lifecycle.initialize(); const before = new Map( value.db.values ); value.work.edit( 'Keep' );
		value.db.beforeChange = () => { throw Object.assign( new Error( 'aborted' ), { code } ); };
		await expect( value.lifecycle.save() ).rejects.toMatchObject( { code } );
		expect( value.work.publisher.publish ).not.toHaveBeenCalled(); expect( value.db.values ).toEqual( before );
		expect( value.work.editor.layers[ 0 ].text ).toBe( 'Keep' );
	} finally { value.close(); }
} );
it( 'passes quota refusal to the existing warning callback during an automatic backup', async () => {
	const value = await create();
	try {
		await value.lifecycle.initialize(); value.work.edit( 'Keep' );
		const before = new Map( value.db.values );
		value.db.beforeChange = () => { throw Object.assign( new Error( 'full' ), { code: 'layers-draft-storage-quota' } ); };
		expect( await value.lifecycle.flushAsync() ).toBe( false );
		expect( value.ui.notifyFailure ).toHaveBeenCalledWith( expect.objectContaining( { code: 'layers-draft-storage-quota' } ) );
		expect( value.db.values ).toEqual( before );
	} finally { value.close(); }
} );
it( 'reloads explicit fallback Restore with Undo/Redo and preserves another writer on Discard', async () => {
	const source = await create(); let target;
	try {
		await source.lifecycle.initialize(); source.work.edit( 'One' ); source.work.edit( 'Hidden Redo' ); source.work.editor.historyManager.undo();
		await source.lifecycle.flushAsync(); const retained = new Map( source.db.values );
		target = await create( source.local, source.db, 'e', 'f' ); await target.lifecycle.initialize();
		expect( target.ui.confirm ).toHaveBeenCalledTimes( 1 ); expect( target.work.editor.layers[ 0 ].text ).toBe( 'One' );
		expect( target.work.editor.historyManager.redo() ).toBe( true ); expect( target.work.editor.layers[ 0 ].text ).toBe( 'Hidden Redo' );
		await target.controller.preserveForExitAsync( target.exit );
		const plan = await target.lifecycle.prepareDiscardAsync();
		expect( await target.lifecycle.commitDiscardAsync( plan.handle ) ).toMatchObject( { closed: true, discarded: true } );
		expect( source.db.values ).toEqual( retained );
	} finally { if ( target ) target.close(); source.close(); }
} );
it( 'rechecks the selected database record after native reads and image decode before Restore', async () => {
	const source = await create(); let target;
	try {
		await source.lifecycle.initialize(); source.work.edit( 'Source' ); await source.lifecycle.flushAsync();
		const [ key ] = source.db.values.keys();
		target = await create( source.local, source.db, 'e', 'f' );
		const decode = global.Image.prototype.decode;
		global.Image.prototype.decode = function () { return decode.call( this ).then( () => { source.db.values.set( key, 'changed-after-decode' ); } ); };
		await expect( target.lifecycle.initialize() ).rejects.toThrow();
		expect( target.work.editor.layers ).toEqual( [] ); expect( source.db.values.get( key ) ).toBe( 'changed-after-decode' );
	} finally { if ( target ) target.close(); source.close(); }
} );
it( 'keeps a pending clean Close open and refuses a late edit after the exit write', async () => {
	const value = await create();
	try {
		await value.lifecycle.initialize(); value.work.edit( 'Saved' ); value.work.publisher.publish.mockResolvedValue( { revisionId: 13 } );
		await value.lifecycle.save(); const blocked = wait(); let entered = false;
		value.db.beforeChange = async entries => { if ( entries[ 0 ].key.endsWith( '#' + 'd'.repeat( 32 ) ) ) { entered = true; await blocked.promise; } };
		const closing = value.lifecycle.prepareCleanCloseAsync(); await tickUntil( () => entered );
		expect( value.lifecycle.getStatus().finalized ).toBe( false ); value.work.edit( 'Keep late edit' ); blocked.resolve();
		await expect( closing ).rejects.toThrow(); expect( value.lifecycle.getStatus().finalized ).toBe( false );
		expect( value.work.editor.layers[ 0 ].text ).toBe( 'Keep late edit' );
	} finally { value.close(); }
} );
it( 'rolls database retirement back when the second local writer removal fails', async () => {
	const value = await create();
	try {
		await value.lifecycle.initialize(); await value.controller.preserveForExitAsync( value.exit );
		value.local.quota = false; value.work.edit( 'Local copies' ); await value.lifecycle.flushAsync(); await value.controller.preserveForExitAsync( value.exit );
		const beforeDb = new Map( value.db.values ), beforeLocal = new Map( value.local.values );
		const remove = value.local.removeItem; let calls = 0;
		value.local.removeItem = key => { if ( ++calls === 2 ) throw new Error( 'second remove refused' ); remove( key ); };
		const plan = await value.lifecycle.prepareDiscardAsync();
		await expect( value.lifecycle.commitDiscardAsync( plan.handle ) ).rejects.toThrow();
		expect( value.db.values ).toEqual( beforeDb ); expect( value.local.values ).toEqual( beforeLocal );
		expect( value.lifecycle.getStatus().finalized ).toBe( false );
	} finally { value.close(); }
} );
