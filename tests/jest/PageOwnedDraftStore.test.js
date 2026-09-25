'use strict';

const PageOwnedDraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );

function createMockStorage( initialData = {} ) {
	const data = { ...initialData };
	return {
		getItem: jest.fn( ( key ) => ( Object.prototype.hasOwnProperty.call( data, key ) ? data[ key ] : null ) ),
		setItem: jest.fn( ( key, value ) => { data[ key ] = String( value ); } ),
		_data: data
	};
}

describe( 'PageOwnedDraftStore', () => {
	let validScope, validDraftJson, mockStorage, store;

	describe( 'independent editor records', () => {
		let shared, records, first, second;
		beforeEach( () => {
			records = new Map();
			shared = {
				getItem: ( key ) => records.get( key ) ?? null,
				setItem: ( key, value ) => records.set( key, value ),
				key: ( index ) => Array.from( records.keys() )[ index ] ?? null,
				get length() { return records.size; }
			};
			first = new PageOwnedDraftStore( shared, 'a'.repeat( 32 ) );
			second = new PageOwnedDraftStore( shared, 'b'.repeat( 32 ) );
		} );

		it( 'interleaves writes for the same scope without overwriting either editor', () => {
			first.write( validScope, '{"text":"first"}' );
			second.write( validScope, '{"text":"second"}' );
			first.write( validScope, '{"text":"first newer"}' );
			expect( first.read( validScope ) ).toBe( '{"text":"first newer"}' );
			expect( second.read( validScope ) ).toBe( '{"text":"second"}' );
			expect( first.listCandidates( validScope ) ).toEqual( [ 'a'.repeat( 32 ), 'b'.repeat( 32 ) ] );
		} );

		it( 'recovers another editor without acquiring its write destination', () => {
			first.write( validScope, '{"text":"original"}' );
			second.selectRecovery( 'a'.repeat( 32 ) );
			expect( second.read( validScope ) ).toBe( '{"text":"original"}' );
			second.write( validScope, '{"text":"recovered and edited"}' );
			expect( first.read( validScope ) ).toBe( '{"text":"original"}' );
			expect( records.size ).toBe( 2 );
		} );

		it( 'retains older unpartitioned drafts as recovery sources only', () => {
			const legacy = new PageOwnedDraftStore( shared );
			legacy.write( validScope, '{"text":"legacy"}' );
			expect( first.listCandidates( validScope ) ).toEqual( [ null ] );
			first.selectRecovery( null );
			expect( first.read( validScope ) ).toBe( '{"text":"legacy"}' );
			first.write( validScope, '{"text":"new"}' );
			expect( legacy.read( validScope ) ).toBe( '{"text":"legacy"}' );
		} );

		it( 'discovers no records from another owner or base revision', () => {
			first.write( validScope, '{}' );
			expect( first.listCandidates( { ...validScope, owner: 'Other' } ) ).toEqual( [] );
			expect( first.listCandidates( { ...validScope, baseRevisionId: 43 } ) ).toEqual( [] );
		} );

		it( 'redacts enumeration failures and rejects unsafe record identifiers', () => {
			shared.key = () => { throw new Error( 'private diagnostic' ); };
			first.write( validScope, '{}' );
			expect( () => first.listCandidates( validScope ) ).toThrow( 'layers-draft-storage-failed' );
			expect( () => first.selectRecovery( '../other' ) ).toThrow( 'layers-invalid-draft-storage-request' );
			expect( () => new PageOwnedDraftStore( shared, Symbol( 'bad' ) ) )
				.toThrow( 'layers-invalid-draft-storage-request' );
		} );
	} );

	it( 'redacts storage method accessor failures during construction', () => {
		const storage = Object.defineProperty( {}, 'getItem', {
			get() { throw new Error( 'private diagnostic' ); }
		} );
		expect( () => new PageOwnedDraftStore( storage ) ).toThrow( 'layers-draft-storage-failed' );
	} );

	it( 'rejects inherited identity hidden behind five unrelated own keys', () => {
		const scope = Object.assign( Object.create( validScope ), { a: 1, b: 2, c: 3, d: 4, e: 5 } );
		expect( () => store.write( scope, '{}' ) ).toThrow( 'layers-invalid-draft-storage-request' );
		expect( mockStorage.setItem ).not.toHaveBeenCalled();
	} );

	it( 'rejects accessors without evaluating scope identity', () => {
		const getter = jest.fn( () => { throw new Error( 'private diagnostic' ); } );
		Object.defineProperty( validScope, 'owner', { get: getter } );
		expect( () => store.read( validScope ) ).toThrow( 'layers-invalid-draft-storage-request' );
		expect( getter ).not.toHaveBeenCalled();
		expect( mockStorage.getItem ).not.toHaveBeenCalled();
	} );

	it( 'rejects extra symbol keys and redacts reflection errors', () => {
		validScope[ Symbol( 'extra' ) ] = true;
		expect( () => store.read( validScope ) ).toThrow( 'layers-invalid-draft-storage-request' );
		const scope = new Proxy( {}, { ownKeys() { throw new Error( 'private diagnostic' ); } } );
		expect( () => store.read( scope ) ).toThrow( 'layers-invalid-draft-storage-request' );
	} );

	beforeEach( () => {
		validScope = {
			wiki: 'testwiki',
			user: 'TestUser',
			owner: 'Page:Test_Slide',
			baseRevisionId: 42,
			surfaceId: 'presentation'
		};
		validDraftJson = JSON.stringify( {
			schemaVersion: 1,
			surfaceId: 'presentation',
			layers: [ { id: 'l1', type: 'rect' } ],
			unknownField: 'preserveMe',
			booleanFalse: false,
			zeroNumber: 0,
			emptyStr: '',
			nullValue: null
		} );
		mockStorage = createMockStorage();
		store = new PageOwnedDraftStore( mockStorage );
	} );

	describe( 'constructor and exports', () => {
		it( 'instantiates as a class with injected storage', () => {
			expect( store ).toBeInstanceOf( PageOwnedDraftStore );
		} );

		it( 'exports to window.Layers.Editor.PageOwnedDraftStore', () => {
			expect( window.Layers.Editor.PageOwnedDraftStore ).toBe( PageOwnedDraftStore );
		} );

		it( 'exports via CommonJS module.exports', () => {
			expect( typeof PageOwnedDraftStore ).toBe( 'function' );
		} );

		it.each( [
			[ 'null storage', null ],
			[ 'undefined storage', undefined ],
			[ 'empty object', {} ],
			[ 'missing setItem', { getItem: () => null } ],
			[ 'missing getItem', { setItem: () => {} } ],
			[ 'non-function getItem', { getItem: 'notAFunction', setItem: () => {} } ],
			[ 'non-function setItem', { getItem: () => null, setItem: 123 } ]
		] )( 'rejects invalid storage dependency with layers-draft-storage-failed: %s', ( _label, badStorage ) => {
			expect( () => new PageOwnedDraftStore( badStorage ) ).toThrow(
				expect.objectContaining( { code: 'layers-draft-storage-failed', message: 'layers-draft-storage-failed' } )
			);
		} );

		it( 'never accesses global localStorage, mw.config, or window.wgPageName', () => {
			const globalStorageSpy = jest.spyOn( window.localStorage, 'getItem' );
			const globalSetSpy = jest.spyOn( window.localStorage, 'setItem' );

			store.write( validScope, validDraftJson );
			store.read( validScope );

			expect( globalStorageSpy ).not.toHaveBeenCalled();
			expect( globalSetSpy ).not.toHaveBeenCalled();

			globalStorageSpy.mockRestore();
			globalSetSpy.mockRestore();
		} );
	} );

	describe( 'key construction and injective distinctness', () => {
		it( 'constructs keys with versioned prefix and JSON tuple', () => {
			store.write( validScope, validDraftJson );
			expect( mockStorage.setItem ).toHaveBeenCalledTimes( 1 );
			const key = mockStorage.setItem.mock.calls[ 0 ][ 0 ];
			expect( key.startsWith( 'layers-page-owned-draft-v1:' ) ).toBe( true );
			const tupleJson = key.slice( 'layers-page-owned-draft-v1:'.length );
			const tuple = JSON.parse( tupleJson );
			expect( tuple ).toEqual( [ 'testwiki', 'TestUser', 'Page:Test_Slide', 42, 'presentation' ] );
		} );

		it( 'generates distinct keys when varying any of the 5 scope components', () => {
			const keys = new Set();
			const variations = [
				{ ...validScope, wiki: 'otherwiki' },
				{ ...validScope, user: 'OtherUser' },
				{ ...validScope, owner: 'OtherOwner' },
				{ ...validScope, baseRevisionId: 43 },
				{ ...validScope, surfaceId: 'diagram' },
				validScope
			];

			for ( const scope of variations ) {
				store.write( scope, validDraftJson );
			}

			for ( const call of mockStorage.setItem.mock.calls ) {
				keys.add( call[ 0 ] );
			}
			expect( keys.size ).toBe( variations.length );
		} );

		it( 'preserves literal identity without trimming or case-folding', () => {
			const scope1 = { ...validScope, owner: 'Page:Test_Slide' };
			const scope2 = { ...validScope, owner: 'page:test_slide' };
			const scope3 = { ...validScope, owner: ' Page:Test_Slide ' };

			store.write( scope1, validDraftJson );
			store.write( scope2, validDraftJson );
			store.write( scope3, validDraftJson );

			const calls = mockStorage.setItem.mock.calls;
			expect( calls[ 0 ][ 0 ] ).not.toBe( calls[ 1 ][ 0 ] );
			expect( calls[ 0 ][ 0 ] ).not.toBe( calls[ 2 ][ 0 ] );
			expect( calls[ 1 ][ 0 ] ).not.toBe( calls[ 2 ][ 0 ] );
		} );

		it( 'faithfully encodes Unicode in all string components', () => {
			const unicodeScope = {
				wiki: 'ウィキ',
				user: 'ユーザー',
				owner: 'Présentation:世界',
				baseRevisionId: 1,
				surfaceId: 'スライド'
			};
			store.write( unicodeScope, validDraftJson );
			const key = mockStorage.setItem.mock.calls[ 0 ][ 0 ];
			expect( key ).toContain( 'ウィキ' );
			expect( key ).toContain( 'ユーザー' );
			expect( key ).toContain( 'Présentation:世界' );
			expect( key ).toContain( 'スライド' );

			const readResult = store.read( unicodeScope );
			expect( readResult ).toBe( validDraftJson );
		} );

		it( 'avoids delimiter collisions through JSON tuple encoding', () => {
			const scopeA = { ...validScope, owner: 'a:b', surfaceId: 'c' };
			const scopeB = { ...validScope, owner: 'a', surfaceId: 'b:c' };

			store.write( scopeA, validDraftJson );
			store.write( scopeB, validDraftJson );

			const keyA = mockStorage.setItem.mock.calls[ 0 ][ 0 ];
			const keyB = mockStorage.setItem.mock.calls[ 1 ][ 0 ];
			expect( keyA ).not.toBe( keyB );
		} );

		it( 'accepts valid boundary revision IDs 1 and 2147483647', () => {
			const minScope = { ...validScope, baseRevisionId: 1 };
			const maxScope = { ...validScope, baseRevisionId: 2147483647 };

			store.write( minScope, validDraftJson );
			store.write( maxScope, validDraftJson );

			expect( store.read( minScope ) ).toBe( validDraftJson );
			expect( store.read( maxScope ) ).toBe( validDraftJson );
		} );
	} );

	describe( 'read and write byte preservation', () => {
		it( 'performs exact byte round-trip preserving unknown fields and edge values', () => {
			store.write( validScope, validDraftJson );
			const retrieved = store.read( validScope );
			expect( retrieved ).toBe( validDraftJson );
			expect( JSON.parse( retrieved ) ).toEqual( JSON.parse( validDraftJson ) );
		} );

		it( 'returns null for an absent record without throwing', () => {
			const result = store.read( validScope );
			expect( result ).toBeNull();
		} );

		it( 'does not read or fall back to legacy draft keys', () => {
			mockStorage._data[ 'layers-draft-legacyhash' ] = validDraftJson;
			mockStorage._data[ 'layers-draft-v2:["testwiki","TestUser","Page:Test_Slide",42,"presentation"]' ] = validDraftJson;

			const result = store.read( validScope );
			expect( result ).toBeNull();
			expect( mockStorage.getItem ).toHaveBeenCalledTimes( 1 );
			expect( mockStorage.getItem ).not.toHaveBeenCalledWith( expect.stringMatching( /^layers-draft-(?!v1:)/ ) );
		} );
	} );

	describe( 'corrupt stored record handling', () => {
		it.each( [
			[ 'syntax error', '{broken-json' ],
			[ 'empty string', '' ],
			[ 'JSON null', 'null' ],
			[ 'JSON number', '123' ],
			[ 'JSON boolean', 'true' ],
			[ 'JSON string primitive', '"just-a-string"' ],
			[ 'JSON array', '[1, 2, 3]' ]
		] )( 'throws layers-draft-storage-failed on corrupt stored record and leaves it untouched: %s', ( _label, corruptData ) => {
			store.write( validScope, validDraftJson );
			const key = mockStorage.setItem.mock.calls[ 0 ][ 0 ];
			mockStorage._data[ key ] = corruptData;

			expect( () => store.read( validScope ) ).toThrow(
				expect.objectContaining( { code: 'layers-draft-storage-failed', message: 'layers-draft-storage-failed' } )
			);

			// Assert corrupt record remains untouched in storage; never removed or overwritten
			expect( mockStorage._data[ key ] ).toBe( corruptData );
		} );
	} );

	describe( 'caller input validation on scope', () => {
		it.each( [
			[ 'null scope', null ],
			[ 'undefined scope', undefined ],
			[ 'number scope', 123 ],
			[ 'string scope', 'scope' ],
			[ 'array scope', [ 'testwiki', 'TestUser', 'Page:Test_Slide', 42, 'presentation' ] ],
			[ 'missing wiki', { user: 'u', owner: 'o', baseRevisionId: 1, surfaceId: 's' } ],
			[ 'missing user', { wiki: 'w', owner: 'o', baseRevisionId: 1, surfaceId: 's' } ],
			[ 'missing owner', { wiki: 'w', user: 'u', baseRevisionId: 1, surfaceId: 's' } ],
			[ 'missing baseRevisionId', { wiki: 'w', user: 'u', owner: 'o', surfaceId: 's' } ],
			[ 'missing surfaceId', { wiki: 'w', user: 'u', owner: 'o', baseRevisionId: 1 } ],
			[ 'extra property', { wiki: 'w', user: 'u', owner: 'o', baseRevisionId: 1, surfaceId: 's', extra: 1 } ],
			[ 'empty string wiki', { wiki: '', user: 'u', owner: 'o', baseRevisionId: 1, surfaceId: 's' } ],
			[ 'empty string user', { wiki: 'w', user: '', owner: 'o', baseRevisionId: 1, surfaceId: 's' } ],
			[ 'empty string owner', { wiki: 'w', user: 'u', owner: '', baseRevisionId: 1, surfaceId: 's' } ],
			[ 'empty string surfaceId', { wiki: 'w', user: 'u', owner: 'o', baseRevisionId: 1, surfaceId: '' } ],
			[ 'non-string wiki', { wiki: 123, user: 'u', owner: 'o', baseRevisionId: 1, surfaceId: 's' } ],
			[ 'zero baseRevisionId', { wiki: 'w', user: 'u', owner: 'o', baseRevisionId: 0, surfaceId: 's' } ],
			[ 'negative baseRevisionId', { wiki: 'w', user: 'u', owner: 'o', baseRevisionId: -1, surfaceId: 's' } ],
			[ 'fractional baseRevisionId', { wiki: 'w', user: 'u', owner: 'o', baseRevisionId: 1.5, surfaceId: 's' } ],
			[ 'overflow baseRevisionId', { wiki: 'w', user: 'u', owner: 'o', baseRevisionId: 2147483648, surfaceId: 's' } ],
			[ 'string baseRevisionId', { wiki: 'w', user: 'u', owner: 'o', baseRevisionId: '42', surfaceId: 's' } ],
			[ 'null baseRevisionId', { wiki: 'w', user: 'u', owner: 'o', baseRevisionId: null, surfaceId: 's' } ]
		] )( 'rejects invalid scope with layers-invalid-draft-storage-request without touching storage: %s', ( _label, badScope ) => {
			expect( () => store.write( badScope, validDraftJson ) ).toThrow(
				expect.objectContaining( { code: 'layers-invalid-draft-storage-request', message: 'layers-invalid-draft-storage-request' } )
			);
			expect( () => store.read( badScope ) ).toThrow(
				expect.objectContaining( { code: 'layers-invalid-draft-storage-request', message: 'layers-invalid-draft-storage-request' } )
			);

			expect( mockStorage.setItem ).not.toHaveBeenCalled();
			expect( mockStorage.getItem ).not.toHaveBeenCalled();
		} );

		it( 'never mutates the caller scope object', () => {
			const scopeCopy = { ...validScope };
			store.write( validScope, validDraftJson );
			expect( validScope ).toEqual( scopeCopy );

			store.read( validScope );
			expect( validScope ).toEqual( scopeCopy );
		} );
	} );

	describe( 'caller input validation on draftJson', () => {
		it.each( [
			[ 'null draft', null ],
			[ 'undefined draft', undefined ],
			[ 'number draft', 12345 ],
			[ 'empty string draft', '' ],
			[ 'non-JSON string', '{not-json' ],
			[ 'JSON null', 'null' ],
			[ 'JSON boolean', 'false' ],
			[ 'JSON number', '0' ],
			[ 'JSON string primitive', '"plain string"' ],
			[ 'JSON array', '[ { "surfaceId": "presentation" } ]' ]
		] )( 'rejects invalid draftJson with layers-invalid-draft-storage-request without touching storage: %s', ( _label, badDraft ) => {
			expect( () => store.write( validScope, badDraft ) ).toThrow(
				expect.objectContaining( { code: 'layers-invalid-draft-storage-request', message: 'layers-invalid-draft-storage-request' } )
			);
			expect( mockStorage.setItem ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'storage error redaction and diagnostics safety', () => {
		it( 'redacts QuotaExceededError and diagnostic messages on setItem failure', () => {
			mockStorage.setItem.mockImplementation( () => {
				const quotaErr = new Error( 'Disk quota exceeded on /var/storage/cache at sector 0x889' );
				quotaErr.name = 'QuotaExceededError';
				throw quotaErr;
			} );

			let caught;
			try {
				store.write( validScope, validDraftJson );
			} catch ( err ) {
				caught = err;
			}

			expect( caught ).toBeDefined();
			expect( caught.code ).toBe( 'layers-draft-storage-failed' );
			expect( caught.message ).toBe( 'layers-draft-storage-failed' );
			expect( caught.message ).not.toContain( 'quota' );
			expect( caught.message ).not.toContain( '/var/storage' );
			expect( caught.message ).not.toContain( 'validDraftJson' );
			expect( caught.message ).not.toContain( 'testwiki' );
		} );

		it( 'redacts SecurityError on getItem failure', () => {
			mockStorage.getItem.mockImplementation( () => {
				const secErr = new Error( 'SecurityError: Access to storage restricted for domain wiki.internal' );
				secErr.name = 'SecurityError';
				throw secErr;
			} );

			let caught;
			try {
				store.read( validScope );
			} catch ( err ) {
				caught = err;
			}

			expect( caught ).toBeDefined();
			expect( caught.code ).toBe( 'layers-draft-storage-failed' );
			expect( caught.message ).toBe( 'layers-draft-storage-failed' );
			expect( caught.message ).not.toContain( 'SecurityError' );
			expect( caught.message ).not.toContain( 'wiki.internal' );
		} );
	} );
} );
