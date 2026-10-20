'use strict';
const Client = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationReadClient.js' );
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const Ids = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );
const literal = 'NFD e\u0301 / NFC é / 日本 / 😀';
function encoded( value ) {
	return JSON.stringify( value ).split( '' ).map( character => character.charCodeAt( 0 ) > 127 ?
		'\\u' + character.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) : character ).join( '' );
}
function fixture( slot = true, page = 2 ) {
	const surface = number => ( { id: Ids.surfaceId( 7, 12, 'File:Document.pdf', 'ABC', number ), kind: 'pdf', label: 'ABC',
		source: { repository: 'local', fileTitle: 'File:Document.pdf', timestamp: '20261015120000', sha1: 'a'.repeat( 31 ), page: number },
		canvas: { width: number === 1 ? 416 : 208, height: number === 1 ? 208 : 416 }, layers: [] } );
	const anchor = surface( 2 ), target = surface( page );
	const base = { schemaVersion: 1, metadata: { literal, absent: null, names: [ 'e\u0301', 'é' ] }, surfaces: [ {
		id: 'sibling', kind: 'slide', label: 'ABC', canvas: { width: 400, height: 200 },
		layers: [ { id: 'sibling-text', type: 'text', text: literal } ] } ] };
	const value = { target: { owner: 'Owner', pageId: 7, revisionId: 12, surfaceId: anchor.id },
		selection: { start: 13, expected: '[[File:Document.pdf|layerset=ABC|page=2|Caption ' + literal + ']]' },
		hasLayersSlot: slot, mainText: 'Prefix ' + literal, baseText: slot ? JSON.stringify( base, null, 2 ) : null,
		baseBundle: slot ? { revisionId: 12, snapshot: base, sourceGeometry: [] } : null, anchorSurface: anchor,
		context: { owner: 'Owner', pageId: 7, revisionId: 12, binding: 'v1:7:' + anchor.id, kind: 'pdf', label: 'ABC',
			initialPage: 2, pageCount: 2, page, members: [], surface: target, stored: false,
			sourceGeometry: { page, width: target.canvas.width, height: target.canvas.height, units: 'file-handler-pixels' },
			rendition: { url: '/pinned/page-' + page + '.jpg', width: target.canvas.width, height: target.canvas.height + 1 } } };
	const options = { ...value.target, selection: copy( value.selection ), page };
	const envelope = { version: 1, data: encoded( value ) };
	const api = { post: jest.fn().mockResolvedValue( { layerspdfcreationread: envelope } ) };
	return { value, options, envelope, api, client: new Client( api ) };
}
describe( 'Exact missing-PDF creation admission transport', () => {
	it.each( [ [ false, 1 ], [ false, 2 ], [ true, 1 ], [ true, 2 ] ] )(
		'preserves the genuine base, exact embedding and page %s/%s', async ( slot, page ) => {
			const { value, options, api, client } = fixture( slot, page );
			const result = await client.read( options );
			expect( result ).toEqual( value ); expect( result ).not.toBe( value );
			expect( result.mainText ).toContain( 'e\u0301' ); expect( result.mainText ).toContain( 'é' );
			expect( api.post ).toHaveBeenCalledWith( { action: 'layerspdfcreationread', formatversion: 2, exacttext: true,
				pageid: 7, baserevid: 12, embedstart: 13, embedtext: options.selection.expected, pdfpage: page } );
			if ( slot ) expect( result.baseBundle.snapshot.surfaces ).toEqual( value.baseBundle.snapshot.surfaces );
			else { expect( result.baseBundle ).toBeNull(); expect( result.baseText ).toBeNull(); }
		} );
	it.each( [
		[ 'legacy structured payload', f => f.value ], [ 'missing data', () => ( { version: 1 } ) ],
		[ 'extra field', f => ( { ...f.envelope, other: true } ) ], [ 'wrong version', f => ( { ...f.envelope, version: 2 } ) ],
		[ 'nontext data', f => ( { ...f.envelope, data: f.value } ) ], [ 'invalid JSON', () => ( { version: 1, data: '{' } ) ],
		[ 'literal Unicode envelope', f => ( { version: 1, data: JSON.stringify( f.value ) } ) ],
		[ 'null data', () => ( { version: 1, data: 'null' } ) ]
	] )( 'refuses %s without legacy fallback', async ( name, mutate ) => {
		const f = fixture(); f.api.post.mockResolvedValueOnce( { layerspdfcreationread: mutate( f ) } );
		await expect( f.client.read( f.options ) ).rejects.toMatchObject( { code: 'layers-reading-failed', message: 'layers-reading-failed' } );
		expect( f.api.post ).toHaveBeenCalledTimes( 1 );
	} );
	it.each( [ 'same', 'escaped', 'nested' ] )( 'refuses %s duplicate member names even when JSON.parse accepts them', async mode => {
		const f = fixture(); let text = f.envelope.data;
		if ( mode === 'same' ) text = text.replace( '"hasLayersSlot":true', '"hasLayersSlot":false,"hasLayersSlot":true' );
		if ( mode === 'escaped' ) text = text.replace( '"hasLayersSlot":true', '"hasLayersSlot":false,"hasLayers\\u0053lot":true' );
		if ( mode === 'nested' ) text = text.replace( '"untouched":null', '"untouched":0,"untouched":null' )
			.replace( '"absent":null', '"absent":0,"absent":null' );
		expect( JSON.parse( text ) ).toEqual( f.value );
		f.api.post.mockResolvedValueOnce( { layerspdfcreationread: { version: 1, data: text } } );
		await expect( f.client.read( f.options ) ).rejects.toHaveProperty( 'code', 'layers-reading-failed' );
	} );
	it( 'detaches decoded data before returning and never changes the original response', async () => {
		const f = fixture(), original = copy( f.envelope );
		const result = await f.client.read( f.options ); result.baseBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'Caller';
		expect( f.envelope ).toEqual( original ); expect( f.value.baseBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text ).toBe( literal );
	} );
	it( 'does not invoke response accessors', async () => {
		const f = fixture(), getter = jest.fn(); Object.defineProperty( f.envelope, 'data', { enumerable: true, get: getter } );
		await expect( f.client.read( f.options ) ).rejects.toHaveProperty( 'code', 'layers-reading-failed' );
		expect( getter ).not.toHaveBeenCalled();
	} );
	it( 'retains literal sibling and working text through actual first-Save preparation', async () => {
		const f = fixture(), publisher = { publish: jest.fn().mockResolvedValue( { revisionId: 13 } ) };
		f.api.post.mockImplementation( request => Promise.resolve( { layerspdfcreationread: fixture( true, request.pdfpage ).envelope } ) );
		const transaction = new Transaction( f.value, { reader: f.client, publisher } );
		const initial = transaction.getDraft(); const page = await transaction.preparePage( 1 ); transaction.commit( page.handle );
		const state = transaction.getEditorState(); state.layers = [ { id: 'new-text', type: 'text', text: literal } ]; transaction.update( state );
		await transaction.save(); const sent = JSON.parse( publisher.publish.mock.calls[ 0 ][ 0 ].snapshotJson );
		expect( sent.surfaces[ 0 ] ).toEqual( initial.snapshot.surfaces[ 0 ] );
		expect( sent.surfaces.find( member => member.source && member.source.page === 1 ).layers[ 0 ].text ).toBe( literal );
		expect( f.api.post.mock.calls.every( ( [ request ] ) => request.exacttext === true ) ).toBe( true );
	} );
} );
