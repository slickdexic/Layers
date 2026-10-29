'use strict';

const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const scope = { wiki: 'test', user: '1', owner: 'Page', baseRevisionId: 12, surfaceId: 'image' };

function boundedStorage( limit ) {
	const records = new Map( [ [ 'unrelated', 'x'.repeat( 3000000 ) ] ] );
	return {
		records,
		getItem: key => records.get( key ) ?? null,
		setItem: ( key, value ) => {
			let size = key.length + value.length;
			for ( const [ name, raw ] of records ) { if ( name !== key ) { size += name.length + raw.length; } }
			if ( size > limit ) { throw Object.assign( new Error( 'quota' ), { name: 'QuotaExceededError' } ); }
			records.set( key, value );
		},
		removeItem: key => records.delete( key ),
		key: index => Array.from( records.keys() )[ index ],
		get length() { return records.size; }
	};
}

test( 'stores and restores a large repeated image backup exactly when normal storage exceeds quota', () => {
	const storage = boundedStorage( 5242880 ), store = new Store( storage, 'a'.repeat( 32 ) );
	const src = 'data:image/png;base64,' + 'A'.repeat( 1000000 );
	const original = JSON.stringify( { version: 1, scope, phase: 'ready',
		editorState: { layers: [ { src } ] }, workingCopyDraft: { timeline: Array.from( { length: 9 }, () => ( { src } ) ) } } );
	expect( original.length ).toBeGreaterThan( 10000000 );
	store.write( scope, original );
	expect( store.read( scope ) ).toBe( original );
	expect( storage.records.get( 'unrelated' ).length ).toBe( 3000000 );
	expect( Array.from( storage.records.values() )[ 1 ].length ).toBeLessThan( 2000000 );
} );

test( 'a quota refusal preserves existing records if the draft cannot be made small enough', () => {
	const storage = boundedStorage( 3000100 ), store = new Store( storage, 'b'.repeat( 32 ) );
	const draft = JSON.stringify( { version: 1, scope, data: 'x'.repeat( 100000 ) } );
	expect( () => store.write( scope, draft ) ).toThrow( 'layers-draft-storage-failed' );
	expect( Array.from( storage.records.keys() ) ).toEqual( [ 'unrelated' ] );
} );

test( 'an earlier packed creation backup remains discoverable and retains its exact contents', () => {
	const storage = boundedStorage( 5242880 ), writer = new Store( storage, 'a'.repeat( 32 ) );
	const src = 'data:image/png;base64,' + 'B'.repeat( 1000000 );
	const original = JSON.stringify( { version: 1, scope, phase: 'ready',
		creationOrigin: { version: 1, origin: { owner: scope.owner, revisionId: 12, surfaceId: scope.surfaceId } },
		workingCopyDraft: { history: Array.from( { length: 8 }, () => ( { src } ) ) } } );
	writer.write( scope, original );
	const reader = new Store( storage, 'b'.repeat( 32 ) );
	const handles = reader.listEarlierCreationCandidates( { ...scope, baseRevisionId: 13 } );
	expect( handles ).toHaveLength( 1 );
	expect( reader.inspectEarlierCreationCandidate( handles[ 0 ] ).raw ).toBe( original );
	const key = Array.from( storage.records.keys() ).find( value => value.startsWith( Store.STORAGE_KEY_PREFIX ) );
	storage.records.set( key, 'changed' );
	expect( () => reader.inspectEarlierCreationCandidate( handles[ 0 ] ) ).toThrow( 'layers-draft-storage-failed' );
	expect( storage.records.get( key ) ).toBe( 'changed' );
} );

test( 'malformed packed records are refused without deleting the source', () => {
	const storage = boundedStorage( 5242880 ), store = new Store( storage, 'a'.repeat( 32 ) );
	store.write( scope, '{}' );
	const key = Array.from( storage.records.keys() ).find( value => value.startsWith( Store.STORAGE_KEY_PREFIX ) );
	const corrupt = 'layers-packed-draft-v1:["~layers-draft-0_",["x"],"missing"]';
	storage.records.set( key, corrupt );
	expect( () => store.read( scope ) ).toThrow( 'layers-draft-storage-failed' );
	expect( storage.records.get( key ) ).toBe( corrupt );
} );
