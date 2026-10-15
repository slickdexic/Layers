'use strict';
const Client = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationReadClient.js' );
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const Ids = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );
const fs = require( 'fs' );
const vm = require( 'vm' );
const path = require( 'path' );
function preparation( page = 1, slot = false ) {
	const surface = number => ( { id: Ids.surfaceId( 7, 12, 'File:Document.pdf', 'ABC', number ), kind: 'pdf', label: 'ABC',
		source: { repository: 'local', fileTitle: 'File:Document.pdf', timestamp: '20261015120000', sha1: 'a'.repeat( 31 ), page: number },
		canvas: { width: number === 1 ? 416 : 208, height: number === 1 ? 208 : 416, backgroundColor: '#fff' }, layers: [] } );
	const anchor = surface( 2 ), target = surface( page ), base = { schemaVersion: 1, metadata: { untouched: null }, surfaces: [ {
		id: 'slide', kind: 'slide', label: 'ABC', canvas: { width: 400, height: 200 }, layers: [] } ] };
	return { target: { owner: 'Owner', pageId: 7, revisionId: 12, surfaceId: anchor.id },
		selection: { start: 13, expected: '[[File:Document.pdf|layerset=ABC|page=2|Linked [[caption]]]]' },
		hasLayersSlot: slot, mainText: 'Préface π\nOriginal owner text', baseText: slot ? JSON.stringify( base, null, 2 ) : null,
		baseBundle: slot ? { revisionId: 12, snapshot: base, sourceGeometry: [] } : null, anchorSurface: anchor,
		context: { owner: 'Owner', pageId: 7, revisionId: 12, binding: 'v1:7:' + anchor.id, kind: 'pdf', label: 'ABC',
			initialPage: 2, pageCount: 2, page, members: [], surface: target, stored: false,
			sourceGeometry: { page, width: target.canvas.width, height: target.canvas.height, units: 'file-handler-pixels' },
			rendition: { url: '/pinned/page-' + page + '.jpg', width: target.canvas.width, height: target.canvas.height + ( page === 2 ? 1 : 0 ) } } };
}
function setup( page = 1, slot = false ) {
	const value = preparation( page, slot ), api = { post: jest.fn().mockResolvedValue( { layerspdfcreationread: value } ) };
	const options = { ...value.target, selection: copy( value.selection ), page };
	return { value, api, options, client: new Client( api ) };
}
describe( 'Missing PDF creation native read client', () => {
	it.each( [ [ 1, false ], [ 2, false ], [ 1, true ], [ 2, true ] ] )( 'delivers exact page %s with slot=%s', async ( page, slot ) => {
		const { value, api, options, client } = setup( page, slot ); const result = await client.read( options );
		expect( result ).toEqual( value ); expect( result ).not.toBe( value );
		expect( api.post ).toHaveBeenCalledWith( { action: 'layerspdfcreationread', formatversion: 2,
			pageid: 7, baserevid: 12, embedstart: 13, embedtext: options.selection.expected, pdfpage: page } );
		expect( result.context.surface.source.page ).toBe( page ); expect( result.context.label ).toBe( 'ABC' );
		if ( slot ) expect( result.baseText ).toBe( value.baseText ); else expect( result.baseText ).toBeNull();
	} );
	it( 'performs fresh native admission on every identical read', async () => {
		const { api, options, client } = setup(); await client.read( options ); await client.read( options ); expect( api.post ).toHaveBeenCalledTimes( 2 );
	} );
	it( 'isolates options, response values and returned data', async () => {
		const { value, api, options, client } = setup( 1, true ); const pending = client.read( options ); options.selection.expected = 'Caller';
		const result = await pending; result.anchorSurface.canvas.width = 1; result.baseBundle.snapshot.surfaces = [];
		expect( api.post.mock.calls[ 0 ][ 0 ].embedtext ).toBe( value.selection.expected ); expect( value.anchorSurface.canvas.width ).toBe( 208 );
		expect( value.baseBundle.snapshot.surfaces ).toHaveLength( 1 );
	} );
	it.each( [
		[ 'owner', o => { o.owner = ''; } ], [ 'padded owner', o => { o.owner = ' Owner'; } ],
		[ 'pageId', o => { o.pageId = 0; } ], [ 'revision', o => { o.revisionId = 0; } ],
		[ 'member', o => { o.surfaceId = 'bad id'; } ], [ 'page zero', o => { o.page = 0; } ],
		[ 'page over limit', o => { o.page = 101; } ], [ 'fraction', o => { o.page = 1.5; } ],
		[ 'string page', o => { o.page = '1'; } ], [ 'missing selection', o => { delete o.selection; } ],
		[ 'negative start', o => { o.selection.start = -1; } ], [ 'large start', o => { o.selection.start = 2147483648; } ],
		[ 'empty text', o => { o.selection.expected = ''; } ], [ 'nonfinite', o => { o.extra = NaN; } ]
	] )( 'refuses invalid %s options before posting', async ( name, mutate ) => {
		const { api, options, client } = setup(); mutate( options ); await expect( client.read( options ) ).rejects.toHaveProperty( 'code', 'layers-invalid-read-request' ); expect( api.post ).not.toHaveBeenCalled();
	} );
	it.each( [
		[ 'owner', v => { v.target.owner = 'Other'; } ], [ 'pageId', v => { v.target.pageId = 8; } ],
		[ 'revision', v => { v.target.revisionId = 13; } ], [ 'surface', v => { v.target.surfaceId = 'foreign'; } ],
		[ 'offset', v => { v.selection.start++; } ], [ 'occurrence', v => { v.selection.expected += '|off'; } ],
		[ 'wrong requested page', v => Object.assign( v.context, preparation( 2, true ).context ) ],
		[ 'invented member', v => { v.context.surface.id = 'invented'; } ],
		[ 'stored payload', v => { v.context.stored = true; } ], [ 'stored inventory', v => { v.context.members = [ { page: 2, surfaceId: v.target.surfaceId } ]; } ],
		[ 'other PDF source', v => { v.context.surface.source.fileTitle = 'File:Other.pdf'; } ],
		[ 'unknown count', v => { v.context.pageCount = null; } ], [ 'unbounded count', v => { v.context.pageCount = 101; } ],
		[ 'raw-base mismatch', v => { v.baseText = '{}'; } ],
		[ 'null mismatch', v => { v.hasLayersSlot = false; } ],
		[ 'geometry', v => { v.context.sourceGeometry.width++; } ], [ 'URL', v => { v.context.rendition.url = 'javascript:alert(1)'; } ],
		[ 'layer substitution', v => { v.context.surface.layers = [ { id: 'foreign', type: 'text', text: 'Other page' } ]; } ]
	] )( 'refuses %s response without substituting stored work', async ( name, mutate ) => {
		const { value, client, options } = setup( 1, true ); mutate( value ); await expect( client.read( options ) ).rejects.toHaveProperty( 'code', 'layers-reading-failed' );
	} );
	it( 'rejects wrong-page native output even if every other field is valid', async () => {
		const { client, api, options } = setup(); api.post.mockResolvedValueOnce( { layerspdfcreationread: preparation( 2 ) } );
		await expect( client.read( options ) ).rejects.toHaveProperty( 'code', 'layers-reading-failed' );
	} );
	it.each( [ 'missingparam', 'outofrange', 'maxbytes', 'permissiondenied', 'mustbeposted', 'layers-revision-unavailable' ] )(
		'preserves safe %s refusal without diagnostic text', async code => {
			const { client, api, options } = setup(); api.post.mockResolvedValueOnce( { error: { code, info: 'Private path and owner data' } } );
			await expect( client.read( options ) ).rejects.toMatchObject( { code, message: code } );
		} );
	it.each( [ 'promise', 'throw', 'deferred' ] )( 'normalizes %s transport failure without exposing diagnostics', async mode => {
		const { client, api, options } = setup();
		if ( mode === 'promise' ) api.post.mockRejectedValueOnce( new Error( 'Private transport diagnostic' ) );
		if ( mode === 'throw' ) api.post.mockImplementationOnce( () => { throw new Error( 'Private transport diagnostic' ); } );
		if ( mode === 'deferred' ) api.post.mockReturnValueOnce( { then( yes, no ) { no( 'http', { error: { code: 'secret', info: 'Private details' } } ); } } );
		await expect( client.read( options ) ).rejects.toMatchObject( { code: 'layers-reading-failed', message: 'layers-reading-failed' } );
	} );
	it( 'preserves the safe code in a native MediaWiki deferred rejection', async () => {
		const { client, api, options } = setup(); api.post.mockReturnValueOnce( { then( yes, no ) { no( 'unknown', { error: { code: 'layers-revision-unavailable', info: 'Private' } } ); } } );
		await expect( client.read( options ) ).rejects.toMatchObject( { code: 'layers-revision-unavailable', message: 'layers-revision-unavailable' } );
	} );
	it( 'does not invoke options or response accessors', async () => {
		const { client, api, options } = setup(), getter = jest.fn(); Object.defineProperty( options.selection, 'expected', { enumerable: true, get: getter } );
		await expect( client.read( options ) ).rejects.toThrow(); expect( getter ).not.toHaveBeenCalled();
		const response = {}; Object.defineProperty( response, 'error', { enumerable: true, get: getter } ); api.post.mockResolvedValueOnce( response );
		await expect( client.read( setup().options ) ).rejects.toThrow(); expect( getter ).not.toHaveBeenCalled();
	} );
	it( 'refuses missing response data and invalid API instances', async () => {
		const { client, api, options } = setup(); api.post.mockResolvedValueOnce( {} ); await expect( client.read( options ) ).rejects.toThrow();
		expect( () => new Client( { get() {} } ) ).toThrow(); expect( () => new Client( null ) ).toThrow();
	} );
	it( 'composes with the actual creation model for page preparation and first-Save revalidation', async () => {
		const { client, api } = setup( 2, true ); api.post.mockImplementation( async request => ( { layerspdfcreationread: preparation( request.pdfpage, true ) } ) );
		const publisher = { publish: jest.fn().mockResolvedValue( { revisionId: 13 } ) };
		const transaction = new Transaction( preparation( 2, true ), { reader: client, publisher } );
		const prepared = await transaction.preparePage( 1 ); transaction.commit( prepared.handle );
		const state = transaction.getEditorState(); state.layers = [ { id: 'text', type: 'text', text: 'Page one' } ]; transaction.update( state );
		await transaction.save(); expect( api.post.mock.calls.map( call => call[ 0 ].pdfpage ) ).toEqual( [ 1, 1, 2 ] );
		expect( JSON.parse( publisher.publish.mock.calls[ 0 ][ 0 ].snapshotJson ).surfaces.slice( 1 ).map( member => member.source.page ) ).toEqual( [ 1, 2 ] );
	} );
	it.each( [ 'model', 'transport' ] )( 'loads the %s in MediaWiki script mode without relative require', async component => {
		const forbidden = jest.fn( () => { throw new Error( 'Relative require is unavailable in script modules' ); } );
		const sandbox = vm.createContext( { window: {}, module: { exports: {} }, require: forbidden } );
		for ( const file of [ 'PageOwnedSnapshotAdapter', 'PageOwnedPdfWorkingSet', 'PageOwnedPdfCreationTransaction', 'PageOwnedPdfCreationReadClient' ] ) {
			vm.runInContext( fs.readFileSync( path.join( __dirname, '../../resources/ext.layers.editor/', file + '.js' ), 'utf8' ), sandbox );
		}
		vm.runInContext( 'const fixture = JSON.parse(' + JSON.stringify( JSON.stringify( preparation( 1 ) ) ) + ');', sandbox );
		if ( component === 'model' ) {
			const page = vm.runInContext( 'new window.Layers.Editor.PageOwnedPdfCreationTransaction(fixture, { reader: { read() {} }, publisher: { publish() {} } }).getStatus().page', sandbox );
			expect( page ).toBe( 1 );
		} else {
			const result = await vm.runInContext( 'new window.Layers.Editor.PageOwnedPdfCreationReadClient({ post() { return Promise.resolve({ layerspdfcreationread: fixture }); } }).read({ ...fixture.target, selection: fixture.selection, page: 1 })', sandbox );
			expect( result.context.page ).toBe( 1 );
		}
		expect( forbidden ).not.toHaveBeenCalled();
	} );
} );
