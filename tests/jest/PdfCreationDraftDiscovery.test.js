'use strict';
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );

const current = () => ( { wiki: 'wiki', user: 'editor', owner: 'Owning Page', baseRevisionId: 30, surfaceId: 'current-pdf' } );
const prior = ( overrides = {} ) => ( { ...current(), baseRevisionId: 12, surfaceId: 'old-pdf', ...overrides } );
const envelope = scope => ( { version: 1, scope, phase: 'uncertain', pdfCreation: {
	version: 4,
	draft: { creation: { target: { owner: scope.owner, revisionId: scope.baseRevisionId, surfaceId: scope.surfaceId } } },
	importPublication: { attempted: true }, importHistory: { groups: [] }
} } );

function setup() {
	const records = new Map(), payloadReads = [], writes = [];
	const storage = {
		getItem: key => { payloadReads.push( key ); return records.get( key ) ?? null; },
		setItem: ( key, raw ) => { writes.push( key ); records.set( key, raw ); },
		removeItem: key => { records.delete( key ); },
		key: index => Array.from( records.keys() )[ index ] ?? null,
		get length() { return records.size; }
	};
	const store = new DraftStore( storage, 'c'.repeat( 32 ) );
	const seed = ( scope, writer = 'a'.repeat( 32 ), raw = JSON.stringify( envelope( scope ) ) ) => {
		const key = store._validateAndBuildKey( scope ) + ( writer === null ? '' : '#' + writer );
		records.set( key, raw ); return key;
	};
	return { records, payloadReads, writes, storage, store, seed };
}

describe( 'earlier whole-PDF creation backup discovery', () => {
	test( 'retains exact prior scope and writer namespace without changing bytes or read selection', () => {
		const c = setup(), legacyKey = c.seed( prior(), null ), writerA = 'a'.repeat( 32 ), writerB = 'b'.repeat( 32 );
		const keyA = c.seed( prior(), writerA ), keyB = c.seed( prior(), writerB );
		const before = Array.from( c.records.entries() ), selectedWriter = c.store._readWriterId, ownWriter = c.store._writerId;
		const handles = c.store.listEarlierPdfCreationCandidates( current() );
		expect( handles ).toHaveLength( 3 );
		const values = handles.map( handle => c.store.inspectEarlierCreationCandidate( handle ) );
		expect( values.map( value => value.writerId ) ).toEqual( [ null, writerA, writerB ] );
		expect( values.map( value => value.scope ) ).toEqual( [ prior(), prior(), prior() ] );
		expect( values.map( value => value.raw ) ).toEqual( [ legacyKey, keyA, keyB ].map( key => c.records.get( key ) ) );
		values[ 0 ].scope.surfaceId = 'mutated-copy';
		expect( c.store.inspectEarlierCreationCandidate( handles[ 0 ] ).scope ).toEqual( prior() );
		expect( c.store._writerId ).toBe( ownWriter ); expect( c.store._readWriterId ).toBe( selectedWriter );
		expect( c.writes ).toEqual( [] ); expect( Array.from( c.records.entries() ) ).toEqual( before );
		// PDF discovery is additive: the existing non-PDF candidate path still ignores these records.
		expect( c.store.listEarlierCreationCandidates( current() ) ).toEqual( [] );
		expect( Array.from( c.records.entries() ) ).toEqual( before );
	} );

	test.each( [ 'wiki', 'user', 'owner', 'current', 'newer', 'badNamespace', 'nonCanonicalScope' ] )(
		'%s partition is skipped before its payload is read', boundary => {
			const c = setup(), scope = prior();
			if ( [ 'wiki', 'user', 'owner' ].includes( boundary ) ) { scope[ boundary ] = 'foreign'; }
			if ( boundary === 'current' ) { scope.baseRevisionId = current().baseRevisionId; }
			if ( boundary === 'newer' ) { scope.baseRevisionId = current().baseRevisionId + 1; }
			let key = c.seed( scope ); const raw = c.records.get( key ); c.records.delete( key );
			if ( boundary === 'badNamespace' ) { key += '#not-a-writer'; }
			if ( boundary === 'nonCanonicalScope' ) { key = key.replace( '["wiki"', '[ "wiki"' ); }
			c.records.set( key, raw ); const before = Array.from( c.records.entries() );
			expect( c.store.listEarlierPdfCreationCandidates( current() ) ).toEqual( [] );
			expect( c.payloadReads ).toEqual( [] ); expect( Array.from( c.records.entries() ) ).toEqual( before );
		}
	);

	test.each( [ 'corruptJson', 'outerVersion', 'scopeMismatch', 'missingCreation', 'creationVersion', 'missingPublication',
		'missingHistory', 'missingTarget', 'foreignOwner', 'wrongBase', 'wrongSurface' ] )(
		'%s record remains intact and is not advertised', boundary => {
			const c = setup(), scope = prior(), value = envelope( scope );
			if ( boundary === 'outerVersion' ) { value.version = 2; }
			if ( boundary === 'scopeMismatch' ) { value.scope.surfaceId = 'other'; }
			if ( boundary === 'missingCreation' ) { delete value.pdfCreation; }
			if ( boundary === 'creationVersion' ) { value.pdfCreation.version = 3; }
			if ( boundary === 'missingPublication' ) { delete value.pdfCreation.importPublication; }
			if ( boundary === 'missingHistory' ) { delete value.pdfCreation.importHistory; }
			if ( boundary === 'missingTarget' ) { delete value.pdfCreation.draft.creation.target; }
			if ( boundary === 'foreignOwner' ) { value.pdfCreation.draft.creation.target.owner = 'Other Page'; }
			if ( boundary === 'wrongBase' ) { value.pdfCreation.draft.creation.target.revisionId++; }
			if ( boundary === 'wrongSurface' ) { value.pdfCreation.draft.creation.target.surfaceId = 'other'; }
			c.seed( scope, 'a'.repeat( 32 ), boundary === 'corruptJson' ? '{broken' : JSON.stringify( value ) );
			const before = Array.from( c.records.entries() );
			expect( c.store.listEarlierPdfCreationCandidates( current() ) ).toEqual( [] );
			expect( Array.from( c.records.entries() ) ).toEqual( before ); expect( c.writes ).toEqual( [] );
		}
	);

	test.each( [ 'changedRaw', 'deleted', 'foreignHandle', 'forgedHandle', 'changedReadMethod', 'changedWriter' ] )(
		'%s cannot reuse a discovery handle', boundary => {
			const c = setup(), key = c.seed( prior() ); let handle = c.store.listEarlierPdfCreationCandidates( current() )[ 0 ];
			if ( boundary === 'changedRaw' ) { c.records.set( key, c.records.get( key ) + ' ' ); }
			if ( boundary === 'deleted' ) { c.records.delete( key ); }
			if ( boundary === 'foreignHandle' ) {
				const other = setup(); other.seed( prior() ); handle = other.store.listEarlierPdfCreationCandidates( current() )[ 0 ];
			}
			if ( boundary === 'forgedHandle' ) { handle = Object.freeze( Object.create( null ) ); }
			if ( boundary === 'changedReadMethod' ) { c.store._read = keyValue => c.records.get( keyValue ) ?? null; }
			if ( boundary === 'changedWriter' ) { c.store._writerId = 'd'.repeat( 32 ); }
			const before = Array.from( c.records.entries() ), readWriter = c.store._readWriterId, writer = c.store._writerId;
			expect( () => c.store.inspectEarlierCreationCandidate( handle ) ).toThrow( 'layers-draft-storage-failed' );
			expect( Array.from( c.records.entries() ) ).toEqual( before ); expect( c.writes ).toEqual( [] );
			expect( c.store._readWriterId ).toBe( readWriter ); expect( c.store._writerId ).toBe( writer );
		}
	);

	test( 'a valid source-shaped envelope is only a raw discovery record, not a native capability', () => {
		const c = setup(), key = c.seed( prior() ), handle = c.store.listEarlierPdfCreationCandidates( current() )[ 0 ];
		const record = c.store.inspectEarlierCreationCandidate( handle );
		expect( record.raw ).toBe( c.records.get( key ) );
		expect( Object.keys( record ).sort() ).toEqual( [ 'raw', 'scope', 'writerId' ] );
		expect( record.native ).toBeUndefined(); expect( record.authority ).toBeUndefined();
		expect( c.writes ).toEqual( [] );
	} );
} );
