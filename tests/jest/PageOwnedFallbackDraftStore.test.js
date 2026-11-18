'use strict';
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedIndexedDBDraftStore.js' );
const Fallback = require( '../../resources/ext.layers.editor/PageOwnedFallbackDraftStore.js' );
const database = require( './helpers/draftIndexedDB.js' );
const scope = { wiki: 'wiki', user: 'user', owner: 'Page', baseRevisionId: 1, surfaceId: 'slide' };
const writer = 'a'.repeat( 32 ), second = 'b'.repeat( 32 );
const raw = value => JSON.stringify( { version: 1, scope, phase: 'ready', editorState: { layers: [ value ] }, history: [ value, 'undo', 'redo' ] } );

test.each( [ 'local', 'database', 'both', 'different' ] )( 'explicit discard removes only the reviewed %s backup', async location => {
	const { adapter, local, storage, key, db } = setup(); storage.quota = false;
	if ( location !== 'database' ) local.set( key, raw( 'reviewed' ) );
	if ( location !== 'local' ) db.records.set( key, raw( location === 'different' ? 'other copy' : 'reviewed' ) );
	const reader = new Fallback( storage, second, true, adapter ); await reader.initialize( scope );
	const choice = reader.listCandidates( scope ).find( value => location === 'database' ? typeof value === 'object' : value === writer );
	reader.selectRecovery( choice ); const plan = reader.prepareRecoveryDiscard( scope );
	local.set( 'unrelated', 'keep' ); await plan.preflight(); await plan.discard();
	expect( local.has( key ) ).toBe( false ); expect( local.get( 'unrelated' ) ).toBe( 'keep' );
	expect( db.records.get( key ) ).toBe( location === 'different' ? raw( 'other copy' ) : undefined );
} );

test( 'discard rolls a committed database deletion back when local deletion fails', async () => {
	const { adapter, local, storage, key, db } = setup(); storage.quota = false;
	local.set( key, raw( 'reviewed' ) ); db.records.set( key, raw( 'reviewed' ) );
	const reader = new Fallback( storage, second, true, adapter ); await reader.initialize( scope ); reader.selectRecovery( writer );
	const plan = reader.prepareRecoveryDiscard( scope ); storage.removeItem = () => { throw new Error( 'storage unavailable' ); };
	await expect( plan.discard() ).rejects.toThrow();
	expect( local.get( key ) ).toBe( raw( 'reviewed' ) ); expect( db.records.get( key ) ).toBe( raw( 'reviewed' ) );
} );

test( 'discard refuses a database backup changed since review and preserves its newer bytes', async () => {
	const { adapter, storage, key, db } = setup(); db.records.set( key, raw( 'reviewed' ) );
	const reader = new Fallback( storage, second, true, adapter ); await reader.initialize( scope );
	reader.selectRecovery( reader.listCandidates( scope )[ 0 ] ); const plan = reader.prepareRecoveryDiscard( scope );
	db.records.set( key, raw( 'newer work' ) ); await expect( plan.preflight() ).rejects.toThrow();
	await expect( plan.discard() ).rejects.toThrow(); expect( db.records.get( key ) ).toBe( raw( 'newer work' ) );
} );

function setup() {
	const db = database(), adapter = new Adapter( db.factory ), local = new Map();
	const storage = { quota: true, getItem: key => local.get( key ) ?? null,
		setItem( key, value ) { if ( this.quota ) throw Object.assign( new Error(), { name: 'QuotaExceededError' } ); local.set( key, value ); },
		removeItem: key => local.delete( key ), key: index => Array.from( local.keys() )[ index ], get length() { return local.size; } };
	const store = new Fallback( storage, writer, true, adapter );
	return { db, adapter, local, storage, store, key: store._recordKey( store._validateAndBuildKey( scope ), writer ) };
}

test( 'ordinary and compact local backups precede IndexedDB without deleting unrelated bytes', async () => {
	const { store, db, storage, local } = setup(); storage.quota = false; local.set( 'unrelated', 'keep' );
	await store.persistDurably( () => store.write( scope, raw( 'normal' ) ) );
	expect( db.transactions ).toHaveLength( 0 ); expect( local.get( 'unrelated' ) ).toBe( 'keep' );
	storage.setItem = ( key, value ) => {
		if ( !value.startsWith( 'layers-packed-draft-v1:' ) ) throw Object.assign( new Error(), { name: 'QuotaExceededError' } );
		local.set( key, value );
	}; store._write = storage.setItem;
	const value = raw( 'x'.repeat( 10000 ) ).replace( '"undo"', JSON.stringify( 'x'.repeat( 10000 ) ) );
	await store.persistDurably( () => store.write( scope, value ) );
	expect( store.read( scope ) ).toBe( value ); expect( db.transactions ).toHaveLength( 0 );
} );

test( 'synchronous capture never launches a pending write; awaited capture waits for commit', async () => {
	const { store, db } = setup(), value = raw( 'current' );
	expect( () => store.write( scope, value ) ).toThrow( 'layers-draft-storage-failed' ); expect( db.transactions ).toHaveLength( 0 );
	db.hold = true; let durable = false;
	const pending = store.persistDurably( () => store.write( scope, value ) ).then( () => { durable = true; } );
	await db.flush(); expect( durable ).toBe( false ); expect( () => store.retireOwned() ).toThrow();
	expect( () => store.write( scope, value ) ).toThrow(); db.commit(); await pending;
	expect( store.read( scope ) ).toBe( value ); expect( durable ).toBe( true );
} );

test( 'a verified local backup can proceed when a prior fallback cannot be read', async () => {
	const { store, db, key, local, storage } = setup();
	const fallback = raw( 'earlier fallback' ), replacement = raw( 'new local backup' );
	await store.persistDurably( () => store.write( scope, fallback ) );
	db.read = () => 'unverifiable';
	await expect( store.persistDurably( () => store.write( scope, fallback ) ) ).rejects.toThrow();
	const transactions = db.transactions.length;
	storage.quota = false;
	await store.persistDurably( () => store.write( scope, replacement ) );
	expect( db.transactions ).toHaveLength( transactions );
	expect( local.get( key ) ).toBe( replacement );
	expect( store.read( scope ) ).toBe( replacement );
	expect( db.records.get( key ) ).toBe( fallback );
} );

test( 'edits during commit require another verified capture using the same writer', async () => {
	const { store, db, key } = setup(); let current = raw( 'before' ); db.hold = true;
	const persist = store.persistDurably( () => store.write( scope, current ) ); await db.flush();
	current = raw( 'after' ); db.commit(); await persist;
	expect( Array.from( db.records.keys() ) ).toEqual( [ key ] ); expect( db.records.get( key ) ).toBe( current );
	expect( store.read( scope ) ).toBe( current );
} );

test( 'reload recovery is explicit, scoped and preserves distinct copies and other writers', async () => {
	const { store, db, adapter, storage, key, local } = setup(); const value = raw( 'fallback' );
	await store.persistDurably( () => store.write( scope, value ) );
	local.set( key, raw( 'different local' ) ); db.records.set( key.replace( '"Page"', '"Foreign"' ), 'foreign' );
	const reader = new Fallback( storage, second, true, adapter ); await reader.initialize( scope );
	const choices = reader.listCandidates( scope ); expect( choices ).toHaveLength( 2 ); expect( reader.read( scope ) ).toBeNull();
	reader.selectRecovery( choices[ 1 ] ); await reader.revalidateRecovery(); expect( reader.read( scope ) ).toBe( value );
	await reader.persistDurably( () => reader.write( scope, raw( 'restored' ) ) );
	expect( db.records.get( key ) ).toBe( value ); expect( local.get( key ) ).toBe( raw( 'different local' ) );
	expect( db.records.size ).toBe( 3 );
} );

test( 'matching local and fallback copies are offered once and corrupt copies stay intact', async () => {
	const { store, storage, adapter, db, local, key } = setup(); await store.persistDurably( () => store.write( scope, raw( 'same' ) ) );
	local.set( key, raw( 'same' ) );
	const reader = new Fallback( storage, second, true, adapter ); await reader.initialize( scope ); expect( reader.listCandidates( scope ) ).toEqual( [ writer ] );
	db.records.set( key + 'c', 'broken' ); reader.cached.set( key.replace( writer, 'c'.repeat( 32 ) ), 'broken' );
	expect( reader.listCandidates( scope ) ).toHaveLength( 2 ); expect( local.get( key ) ).toBe( raw( 'same' ) );
} );

test( 'selected recovery revalidates its own bytes without blocking on an unrelated tab', async () => {
	const { store, adapter, storage, db, key } = setup(); await store.persistDurably( () => store.write( scope, raw( 'safe' ) ) );
	const foreignKey = key.replace( writer, 'c'.repeat( 32 ) ); db.records.set( foreignKey, raw( 'tab' ) );
	const reader = new Fallback( storage, second, true, adapter ); await reader.initialize( scope ); reader.selectRecovery( reader.listCandidates( scope )[ 0 ] );
	db.records.set( foreignKey, raw( 'tab updated' ) ); await expect( reader.revalidateRecovery() ).resolves.toBeUndefined();
	db.records.set( key, raw( 'source changed' ) ); await expect( reader.revalidateRecovery() ).rejects.toThrow();
} );

test.each( [ [ 'QuotaExceededError', 'layers-draft-storage-quota' ], [ 'SecurityError', 'layers-draft-storage-failed' ] ] )(
	'failed fallback %s preserves earlier records and distinguishes %s', async ( name, code ) => {
		const { store, db, local } = setup(); local.set( 'unrelated', 'keep' ); db.records.set( 'foreign', 'keep' );
		db.commitError = Object.assign( new Error(), { name } );
		await expect( store.persistDurably( () => store.write( scope, raw( 'new' ) ) ) ).rejects.toMatchObject( { code } );
		expect( Array.from( db.records.values() ) ).toEqual( [ 'keep' ] ); expect( local.get( 'unrelated' ) ).toBe( 'keep' );
	} );

test( 'non-quota local failure never starts fallback writes', async () => {
	const { store, db } = setup(); store._write = () => { throw new Error( 'denied' ); };
	await expect( store.persistDurably( () => store.write( scope, raw( 'new' ) ) ) ).rejects.toMatchObject( { code: 'layers-draft-storage-failed' } );
	expect( db.transactions ).toHaveLength( 0 );
} );

test( 'a failed capture after committed fallback can retry with the same writer and exact newer bytes', async () => {
	const { store, db, key } = setup(); await store.persistDurably( () => store.write( scope, raw( 'old' ) ) );
	let calls = 0;
	await expect( store.persistDurably( () => { if ( ++calls === 2 ) throw new Error( 'guard' ); store.write( scope, raw( 'new' ) ); } ) ).rejects.toThrow( 'guard' );
	await store.persistDurably( () => store.write( scope, raw( 'retry' ) ) );
	expect( db.records.get( key ) ).toBe( raw( 'retry' ) ); expect( db.records.size ).toBe( 1 );
} );

test( 'batch retirement abort preserves both PDF writers when a member changes', async () => {
	const { store, storage, adapter, db, key } = setup();
	const exit = new Fallback( storage, second, true, adapter );
	await store.persistDurably( () => store.write( scope, raw( 'live' ) ) ); await exit.persistDurably( () => exit.write( scope, raw( 'exit' ) ) );
	db.records.set( key.replace( writer, second ), raw( 'foreign replacement' ) );
	await expect( store.retireGroupAsync( [ store, exit ] ) ).rejects.toThrow();
	expect( db.records.get( key ) ).toBe( raw( 'live' ) ); expect( db.records.size ).toBe( 2 );
} );

test( 'local retirement failure restores both committed fallback and removed local copies', async () => {
	const { store, storage, adapter, db, key, local } = setup(); const exit = new Fallback( storage, second, true, adapter );
	await store.persistDurably( () => store.write( scope, raw( 'live' ) ) ); storage.quota = false;
	exit.write( scope, raw( 'exit' ) ); const before = new Map( local );
	storage.removeItem = name => { local.delete( name ); throw new Error( 'remove failed' ); };
	await expect( store.retireGroupAsync( [ store, exit ] ) ).rejects.toThrow( 'remove failed' );
	expect( local ).toEqual( before ); expect( db.records.get( key ) ).toBe( raw( 'live' ) );
} );

test( 'successful batch retirement removes only owned writers and keeps recovery sources', async () => {
	const { store, storage, adapter, db } = setup(); const exit = new Fallback( storage, second, true, adapter );
	await store.persistDurably( () => store.write( scope, raw( 'live' ) ) ); await exit.persistDurably( () => exit.write( scope, raw( 'exit' ) ) );
	db.records.set( Store.STORAGE_KEY_PREFIX + 'foreign', 'keep' );
	await store.retireGroupAsync( [ store, exit ] ); expect( Array.from( db.records.values() ) ).toEqual( [ 'keep' ] );
} );

test( 'a committed delete whose readback fails restores the backup and permits later Save', async () => {
	const { store, db, key } = setup(); await store.persistDurably( () => store.write( scope, raw( 'live' ) ) );
	db.read = value => value === undefined ? 'verification failed' : value;
	await expect( store.retireOwnedAsync() ).rejects.toMatchObject( { committed: true } );
	expect( db.records.get( key ) ).toBe( raw( 'live' ) );
	db.read = value => value;
	await store.persistDurably( () => store.write( scope, raw( 'later' ) ) );
	expect( db.records.get( key ) ).toBe( raw( 'later' ) );
} );

test.each( [ false, true ] )( 'failed readback after committed write can verify and retry (existing copy: %s)', async existing => {
	const { store, db, key } = setup();
	if ( existing ) await store.persistDurably( () => store.write( scope, raw( 'old' ) ) );
	db.read = value => value === raw( 'new' ) ? 'verification failed' : value;
	await expect( store.persistDurably( () => store.write( scope, raw( 'new' ) ) ) ).rejects.toMatchObject( { committed: true } );
	expect( db.records.get( key ) ).toBe( raw( 'new' ) );
	expect( () => store.write( scope, raw( 'old' ) ) ).toThrow();
	expect( () => store.write( scope, raw( 'new' ) ) ).toThrow();
	await expect( store.retireOwnedAsync() ).rejects.toThrow();
	db.read = value => value;
	await store.persistDurably( () => store.write( scope, raw( 'retry' ) ) );
	expect( db.records.get( key ) ).toBe( raw( 'retry' ) ); expect( db.records.size ).toBe( 1 );
} );

test( 'rollback preserves concurrent bytes while restoring every other missing owned copy', async () => {
	const { store, storage, adapter, db, key } = setup(), exit = new Fallback( storage, second, true, adapter );
	await store.persistDurably( () => store.write( scope, raw( 'live' ) ) );
	await exit.persistDurably( () => exit.write( scope, raw( 'exit' ) ) );
	let checks = 0;
	await expect( store.retireGroupAsync( [ store, exit ], () => {
		if ( ++checks === 2 ) { db.records.set( key, raw( 'concurrent' ) ); throw new Error( 'late change' ); }
	} ) ).rejects.toThrow( 'late change' );
	expect( db.records.get( key ) ).toBe( raw( 'concurrent' ) );
	expect( db.records.get( key.replace( writer, second ) ) ).toBe( raw( 'exit' ) );
} );

test( 'confirmed retirement with failed verification does not leave stale ownership blocking the next Save', async () => {
	const { store, db, key } = setup(), current = { ...scope, baseRevisionId: 2 };
	await store.persistDurably( () => store.write( scope, raw( 'old base' ) ) );
	await store.persistDurably( () => store.write( current, raw( 'saved base' ) ) );
	db.read = value => value === undefined ? 'verification failed' : value;
	await expect( store.retireConfirmedAsync( scope, current ) ).rejects.toMatchObject( { committed: true } );
	expect( db.records.has( key ) ).toBe( false );
	db.read = value => value;
	await store.persistDurably( () => store.write( current, raw( 'next edit' ) ) );
	expect( Array.from( db.records.values() ) ).toEqual( [ raw( 'next edit' ) ] );
} );
