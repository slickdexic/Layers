'use strict';
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedIndexedDBDraftStore.js' );
const database = require( './helpers/draftIndexedDB.js' );
const key = 'layers-page-owned-draft-v1:["wiki","user","Page",1,"slide"]#' + 'a'.repeat( 32 );

test( 'request success cannot resolve a backup before transaction commit and exact readback', async () => {
	const db = database(), adapter = new Adapter( db.factory ); db.hold = true;
	let complete = false;
	const write = adapter.change( [ { key, before: null, after: '{"history":[1,2]}' } ] ).then( () => { complete = true; } );
	await db.flush();
	expect( db.held ).toHaveLength( 1 ); expect( complete ).toBe( false ); expect( db.records.has( key ) ).toBe( false );
	db.commit(); await write;
	expect( complete ).toBe( true ); expect( await adapter.read( key ) ).toBe( '{"history":[1,2]}' );
	expect( db.transactions.map( tx => tx.mode ) ).toEqual( [ 'readwrite', 'readonly', 'readonly' ] );
} );

test.each( [ [ 'QuotaExceededError', 'layers-draft-storage-quota' ], [ 'AbortError', 'layers-draft-storage-failed' ] ] )(
	'commit failure %s preserves every original record and reports %s', async ( name, code ) => {
		const db = database(), adapter = new Adapter( db.factory ); db.records.set( key, 'old' ); db.records.set( key + 'b', 'other' );
		db.commitError = Object.assign( new Error(), { name } );
		await expect( adapter.change( [ { key, before: 'old', after: 'new' }, { key: key + 'b', before: 'other', after: null } ] ) ).rejects.toMatchObject( { code } );
		expect( Array.from( db.records.values() ) ).toEqual( [ 'old', 'other' ] );
	} );

test( 'a stale member aborts the complete retirement batch before deleting any writer', async () => {
	const db = database(), adapter = new Adapter( db.factory ); db.records.set( key, 'old' ); db.records.set( key + 'b', 'foreign' );
	await expect( adapter.change( [ { key, before: 'old', after: null }, { key: key + 'b', before: 'expected', after: null } ] ) ).rejects.toThrow( 'layers-draft-storage-failed' );
	expect( Array.from( db.records.values() ) ).toEqual( [ 'old', 'foreign' ] );
} );

test( 'readback mismatch cannot count as durable even after a commit', async () => {
	const db = database(), adapter = new Adapter( db.factory ); db.read = () => 'different';
	await expect( adapter.change( [ { key, before: null, after: 'exact' } ] ) ).rejects.toMatchObject( {
		code: 'layers-draft-storage-failed', committed: true
	} );
	expect( db.records.get( key ) ).toBe( 'exact' );
} );

test( 'a transaction still pending at timeout aborts without a completed backup', async () => {
	const db = database(), adapter = new Adapter( db.factory, 10 ); db.hold = true;
	await expect( adapter.change( [ { key, before: null, after: 'exact' } ] ) ).rejects.toThrow( 'layers-draft-storage-failed' );
	db.commit(); expect( db.records.size ).toBe( 0 );
} );

test( 'denied or unavailable IndexedDB remains a generic storage failure', async () => {
	for ( const factory of [ undefined, { open: () => { throw Object.assign( new Error(), { name: 'SecurityError' } ); } } ] ) {
		await expect( new Adapter( factory ).read( key ) ).rejects.toMatchObject( { code: 'layers-draft-storage-failed' } );
	}
} );

test( 'prefix discovery excludes other wiki, user and owner records', async () => {
	const db = database(), adapter = new Adapter( db.factory ); db.records.set( key, '{}' ); db.records.set( 'foreign', '{}' );
	expect( Array.from( ( await adapter.list( 'layers-page-owned-draft-v1:["wiki","user","Page",' ) ).keys() ) ).toEqual( [ key ] );
} );

test( 'blocked opening rejects and closes a connection that arrives after refusal', async () => {
	const request = {}, adapter = new Adapter( { open: () => request } );
	const opening = adapter.open();
	const refused = expect( opening ).rejects.toMatchObject( { code: 'layers-draft-storage-failed' } );
	request.onblocked(); await refused;
	request.result = { close: jest.fn() }; request.onsuccess();
	expect( request.result.close ).toHaveBeenCalledTimes( 1 );
	expect( adapter.database ).toBeNull();
} );

test( 'ResourceLoader script scope resolves the fallback superclass without package require', () => {
	const fs = require( 'fs' ), path = require( 'path' ), vm = require( 'vm' );
	const context = vm.createContext( { window: {}, module: { exports: {} }, require: () => { throw new Error( 'No package files' ); } } );
	for ( const file of [ 'PageOwnedDraftStore', 'PageOwnedIndexedDBDraftStore', 'PageOwnedFallbackDraftStore' ] ) {
		vm.runInContext( fs.readFileSync( path.join( __dirname, '../../resources/ext.layers.editor', file + '.js' ), 'utf8' ), context );
	}
	expect( Object.getPrototypeOf( context.window.Layers.Editor.PageOwnedFallbackDraftStore ) ).toBe( context.window.Layers.Editor.PageOwnedDraftStore );
} );
