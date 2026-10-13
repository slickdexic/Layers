'use strict';
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const current = () => ( { wiki: 'wiki', user: 'user', owner: 'Owning Page', baseRevisionId: 20, surfaceId: 'current' } );
const old = () => ( { ...current(), baseRevisionId: 12, surfaceId: 'old' } );
const envelope = scope => ( { version: 1, scope, phase: 'ready', creationOrigin: { version: 1,
	origin: { owner: scope.owner, pageId: 7, revisionId: scope.baseRevisionId, surfaceId: scope.surfaceId } },
	workingCopyDraft: { unknown: [ null, false, 0, '世界' ] } } );
function setup() {
	const records = new Map(), reads = [], writes = [], storage = { getItem: key => { reads.push( key ); return records.get( key ) ?? null; },
		setItem: ( key, raw ) => { writes.push( key ); records.set( key, raw ); }, removeItem: key => { records.delete( key ); },
		key: index => Array.from( records.keys() )[ index ] ?? null, get length() { return records.size; } };
	const store = new DraftStore( storage, 'c'.repeat( 32 ) );
	const seed = ( scope, writer = 'a'.repeat( 32 ), raw = JSON.stringify( envelope( scope ) ) ) => {
		const key = store._validateAndBuildKey( scope ) + ( writer === null ? '' : '#' + writer ); records.set( key, raw ); return key;
	};
	return { records, reads, writes, storage, store, seed };
}
describe( 'inactive same-owner earlier creation backup discovery', () => {
	test( 'handles retain complete writer scope and raw bytes without changing read or write destinations', () => {
		const c = setup(), a = c.seed( old() ), b = c.seed( old(), 'b'.repeat( 32 ) ), legacy = c.seed( old(), null );
		const before = Array.from( c.records.entries() ), readWriter = c.store._readWriterId;
		const handles = c.store.listEarlierCreationCandidates( current() ); expect( handles ).toHaveLength( 3 );
		const data = handles.map( handle => c.store.inspectEarlierCreationCandidate( handle ) );
		expect( data.map( item => item.writerId ) ).toEqual( [ 'a'.repeat( 32 ), 'b'.repeat( 32 ), null ] );
		expect( data.map( item => item.raw ) ).toEqual( [ a, b, legacy ].map( key => c.records.get( key ) ) );
		data[ 0 ].scope.owner = 'Mutated detached copy'; expect( c.store.inspectEarlierCreationCandidate( handles[ 0 ] ).scope ).toEqual( old() );
		expect( c.store._readWriterId ).toBe( readWriter ); expect( c.writes ).toHaveLength( 0 ); expect( Array.from( c.records.entries() ) ).toEqual( before );
		c.store.write( current(), '{"own":true}' ); expect( c.writes[ 0 ] ).toBe( c.store._validateAndBuildKey( current() ) + '#' + 'c'.repeat( 32 ) );
		before.forEach( ( [ key, raw ] ) => expect( c.records.get( key ) ).toBe( raw ) );
	} );
	test.each( [ 'wiki', 'user', 'owner', 'current', 'future', 'partition', 'encoding', 'revision' ] )( '%s keys are skipped before payload reads', boundary => {
		const c = setup(), scope = old();
		if ( [ 'wiki', 'user', 'owner' ].includes( boundary ) ) { scope[ boundary ] = 'foreign'; }
		if ( boundary === 'current' ) { scope.baseRevisionId = 20; }
		if ( boundary === 'future' ) { scope.baseRevisionId = 21; }
		let key = c.seed( scope );
		if ( boundary === 'partition' ) { const raw = c.records.get( key ); c.records.delete( key ); key += 'bad'; c.records.set( key, raw ); }
		if ( boundary === 'encoding' ) { const raw = c.records.get( key ); c.records.delete( key ); key = key.replace( '["wiki"', '[ "wiki"' ); c.records.set( key, raw ); }
		if ( boundary === 'revision' ) { const raw = c.records.get( key ); c.records.delete( key ); key = key.replace( ',12,', ',"12",' ); c.records.set( key, raw ); }
		const before = Array.from( c.records.entries() ); expect( c.store.listEarlierCreationCandidates( current() ) ).toEqual( [] );
		expect( c.reads ).toHaveLength( 0 ); expect( Array.from( c.records.entries() ) ).toEqual( before );
	} );
	test.each( [ 'scope', 'version', 'noOrigin', 'originVersion', 'originOwner', 'originRevision', 'originId', 'noWorking', 'corrupt' ] )( '%s record remains intact and unadvertised', boundary => {
		const c = setup(), value = envelope( old() );
		if ( boundary === 'scope' ) { value.scope.surfaceId = 'forged'; }
		if ( boundary === 'version' ) { value.version = 2; }
		if ( boundary === 'noOrigin' ) { delete value.creationOrigin; }
		if ( boundary === 'originVersion' ) { value.creationOrigin.version = 2; }
		if ( boundary === 'originOwner' ) { value.creationOrigin.origin.owner = 'Other Page'; }
		if ( boundary === 'originRevision' ) { value.creationOrigin.origin.revisionId = 11; }
		if ( boundary === 'originId' ) { value.creationOrigin.origin.surfaceId = 'forged'; }
		if ( boundary === 'noWorking' ) { delete value.workingCopyDraft; }
		c.seed( old(), 'a'.repeat( 32 ), boundary === 'corrupt' ? '{bad' : JSON.stringify( value ) );
		const before = Array.from( c.records.entries() ); expect( c.store.listEarlierCreationCandidates( current() ) ).toEqual( [] ); expect( Array.from( c.records.entries() ) ).toEqual( before );
	} );
	test.each( [ 'newValue', 'deleted', 'foreignHandle', 'forged', 'writer', 'read' ] )( '%s cannot reuse or transfer a retained handle', boundary => {
		const c = setup(), key = c.seed( old() ); let handle = c.store.listEarlierCreationCandidates( current() )[ 0 ];
		if ( boundary === 'newValue' ) { c.records.set( key, c.records.get( key ) + ' ' ); }
		if ( boundary === 'deleted' ) { c.records.delete( key ); }
		if ( boundary === 'foreignHandle' ) { const other = setup(); other.seed( old() ); handle = other.store.listEarlierCreationCandidates( current() )[ 0 ]; }
		if ( boundary === 'forged' ) { handle = Object.freeze( {} ); }
		if ( boundary === 'writer' ) { c.store._writerId = 'd'.repeat( 32 ); }
		if ( boundary === 'read' ) { c.store._read = () => c.records.get( key ); }
		const before = Array.from( c.records.entries() ); expect( () => c.store.inspectEarlierCreationCandidate( handle ) ).toThrow(); expect( Array.from( c.records.entries() ) ).toEqual( before ); expect( c.writes ).toHaveLength( 0 );
	} );
	test( 'enumeration side effects cannot change the captured wiki/user/owner permission scope', () => {
		const c = setup(), scope = current(); c.seed( { ...old(), wiki: 'foreign' } );
		const key = c.storage.key; c.storage.key = index => { scope.wiki = 'foreign'; return key( index ); };
		expect( c.store.listEarlierCreationCandidates( scope ) ).toEqual( [] ); expect( c.reads ).toHaveLength( 0 );
	} );
	test( 'scope accessors refuse without invocation', () => {
		const c = setup(), scope = current(), getter = jest.fn( () => 'wiki' ); Object.defineProperty( scope, 'wiki', { get: getter, enumerable: true } );
		expect( () => c.store.listEarlierCreationCandidates( scope ) ).toThrow(); expect( getter ).not.toHaveBeenCalled();
	} );
	test.each( [ 'read', 'enumeration' ] )( '%s storage failures refuse without claiming an empty successful scan', boundary => {
		const c = setup(); c.seed( old() ); const before = Array.from( c.records.entries() );
		if ( boundary === 'read' ) { c.store._read = () => { throw new Error( 'Private storage failure' ); }; }
		if ( boundary === 'enumeration' ) { c.storage.key = () => { throw new Error( 'Private storage failure' ); }; }
		expect( () => c.store.listEarlierCreationCandidates( current() ) ).toThrow( 'layers-draft-storage-failed' );
		expect( Array.from( c.records.entries() ) ).toEqual( before ); expect( c.writes ).toHaveLength( 0 );
	} );
} );
