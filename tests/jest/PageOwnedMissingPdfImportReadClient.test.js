'use strict';
global.TextEncoder = require( 'util' ).TextEncoder;
const Client = require( '../../resources/ext.layers.editor/PageOwnedMissingPdfImportReadClient.js' );
const Ids = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );

const nfd = 'e\u0301';
const nfc = '\u00e9';
const literal = `NFD ${nfd}; NFC ${nfc}; π / 日本 / 😀`;
const targetPin = { repository: 'local', fileTitle: 'File:Target.pdf', timestamp: '20261015120000', sha1: 'a'.repeat( 31 ) };
const sourcePin = { repository: 'local', fileTitle: 'File:Target.pdf', timestamp: '20261016120000', sha1: 'b'.repeat( 31 ) };

function asciiJson( value ) {
	return JSON.stringify( value ).split( '' ).map( character => character.charCodeAt( 0 ) > 127 ?
		'\\u' + character.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) : character ).join( '' );
}

function pdfSurface( pin, page, label = 'A_BC', canvas = { width: page === 1 ? 416 : 208, height: page === 1 ? 208 : 416 } ) {
	return { id: Ids.surfaceId( 7, 12, pin.fileTitle, label, page ), kind: 'pdf', label,
		source: { ...pin, page }, canvas: { ...canvas }, layers: [] };
}

function baseSnapshot() {
	return { schemaVersion: 1, metadata: { literal, absent: null, nested: { values: [ nfd, nfc ] } }, surfaces: [
		{ id: 'image-sibling', kind: 'image', label: 'Side image', source: { repository: 'local', fileTitle: 'File:Sibling.png',
			timestamp: '20261010120000', sha1: 'd'.repeat( 31 ) },
			canvas: { width: 400, height: 200, backgroundColor: null }, layers: [ { id: 'sib', type: 'text', text: literal, unknown: null } ] },
		{ id: 'pdf-sibling', kind: 'pdf', label: 'Another set',
			source: { repository: 'local', fileTitle: 'File:Other.pdf', timestamp: '20261010120000', sha1: 'c'.repeat( 31 ), page: 1 },
			canvas: { width: 240, height: 320, backgroundColor: null }, layers: [ { id: 'other-pdf-text', type: 'text', text: nfc } ] },
		{ id: 'slide-sibling', kind: 'slide', label: 'Side slide', canvas: { width: 300, height: 180, backgroundColor: null },
			layers: [ { id: 'slide-text', type: 'text', text: nfd } ] }
	] };
}

function baseBundle( snapshot ) {
	return { revisionId: 12, snapshot,
		sourceGeometry: { 'pdf-sibling': { page: 1, width: 240, height: 320, units: 'file-handler-pixels' } },
		sourceRenditions: { 'pdf-sibling': { url: 'https://example.test/sibling.jpg', width: 240, height: 320 } } };
}

function targetAdmission( hasSlot = true ) {
	const prefix = `Préface ${nfd} π\n`, expected = `[[File:Target.pdf|page=2|layerset=A_BC|Caption ${nfd}]]`;
	const anchor = pdfSurface( targetPin, 2 );
	const base = baseSnapshot();
	const baseText = hasSlot ? JSON.stringify( base, null, 2 ) : null;
	return {
		target: { pageId: 7, owner: 'Owner', revisionId: 12, surfaceId: anchor.id },
		selection: { start: Buffer.byteLength( prefix, 'utf8' ), expected },
		hasLayersSlot: hasSlot, mainText: prefix + expected,
		baseText, baseBundle: hasSlot ? baseBundle( base ) : null,
		label: 'A_BC', initialPage: 2, pageCount: 2, source: { ...targetPin },
		pages: [ 1, 2 ].map( memberPage => ( { page: memberPage, surface: pdfSurface( targetPin, memberPage ),
			sourceGeometry: { page: memberPage, width: memberPage === 1 ? 416 : 208,
				height: memberPage === 1 ? 208 : 416, units: 'file-handler-pixels' },
			rendition: { url: `https://example.test/target-${ memberPage }.jpg`, width: memberPage === 1 ? 416 : 208,
				height: ( memberPage === 1 ? 208 : 416 ) + ( memberPage === 2 ? 1 : 0 ) } } ) )
	};
}

function sourcePreparation( sparse = false ) {
	const surfaces = ( sparse ? [ 2 ] : [ 1, 2 ] ).map( page => ( {
		...pdfSurface( sourcePin, page, 'a bc', { width: page === 1 ? 640 : 320, height: page === 1 ? 320 : 640 } ),
		layers: page === 1 ? [ { id: 'text-source-1', type: 'text', text: literal, future: null } ] :
			[ { id: 'text-source-2', type: 'text', text: nfd } ]
	} ) );
	const snapshot = { schemaVersion: 1, metadata: { unknown: null, text: literal }, surfaces };
	const geometry = Object.fromEntries( surfaces.map( surface => [ surface.id, {
		page: surface.source.page, width: surface.canvas.width, height: surface.canvas.height, units: 'file-handler-pixels'
	} ] ) );
	const renditions = Object.fromEntries( surfaces.map( surface => [ surface.id, {
		url: `https://example.test/source-${ surface.source.page }.jpg`, width: surface.canvas.width, height: surface.canvas.height
	} ] ) );
	const anchor = surfaces[ 0 ];
	return {
		source: { pageId: 8, owner: 'Source', revisionId: 21, surfaceId: anchor.id },
		sourceBundle: { revisionId: 21, snapshot, sourceGeometry: geometry, sourceRenditions: renditions },
		sourceGroup: { label: 'a bc', source: { ...sourcePin }, pageCount: 2,
			members: surfaces.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) }
	};
}

function preparation( slot = true, sparse = false ) {
	return { targetAdmission: targetAdmission( slot ), ...sourcePreparation( sparse ) };
}

function options( value ) {
	return { target: copy( value.targetAdmission.target ), selection: copy( value.targetAdmission.selection ),
		source: copy( value.source ) };
}

function setup( slot = true, sparse = false ) {
	const value = preparation( slot, sparse );
	const api = { post: jest.fn().mockResolvedValue( { layersmissingpdfimportread: {
		version: 1, data: asciiJson( value )
	} } ) };
	return { value, api, request: options( value ), client: new Client( api ) };
}

describe( 'PageOwnedMissingPdfImportReadClient', () => {
	it.each( [ [ false, false ], [ false, true ], [ true, false ], [ true, true ] ] )(
		'reads all target pages with slot=%s and sparse source=%s without replacing the saved base', async ( slot, sparse ) => {
			const { value, api, request, client } = setup( slot, sparse );
			const result = await client.read( request );
			expect( result ).toEqual( value );
			expect( result ).not.toBe( value );
			expect( result.targetAdmission.mainText ).toContain( nfd );
			expect( result.targetAdmission.selection.expected ).toContain( nfd );
			expect( result.targetAdmission.pages ).toHaveLength( 2 );
			expect( result.targetAdmission.pages.map( entry => entry.surface.label ) ).toEqual( [ 'A_BC', 'A_BC' ] );
			expect( result.targetAdmission.pages.map( entry => entry.surface.source.page ) ).toEqual( [ 1, 2 ] );
			expect( result.targetAdmission.baseBundle ).toEqual( slot ? value.targetAdmission.baseBundle : null );
			expect( result.sourceBundle.snapshot.metadata ).toEqual( { unknown: null, text: literal } );
			expect( result.sourceGroup.members ).toEqual( value.sourceGroup.members );
			expect( api.post ).toHaveBeenCalledTimes( 1 );
			expect( api.post ).toHaveBeenCalledWith( {
				action: 'layersmissingpdfimportread', formatversion: 2,
				targetpageid: 7, baserevid: 12, embedstart: value.targetAdmission.selection.start,
				embedtext: value.targetAdmission.selection.expected,
				sourcepageid: 8, sourcerevid: 21, sourcesurface: value.source.surfaceId
			} );
		} );

	it( 'preserves version-distinct source pins for the same canonical file and normalized name', async () => {
		const { value, client, request } = setup( true, true );
		const result = await client.read( request );
		expect( result.sourceGroup.source.timestamp ).not.toBe( result.targetAdmission.source.timestamp );
		expect( result.sourceGroup.source.sha1 ).not.toBe( result.targetAdmission.source.sha1 );
		expect( result.sourceGroup.source.fileTitle ).toBe( result.targetAdmission.source.fileTitle );
		expect( result.sourceGroup.label ).toBe( 'a bc' );
		expect( value.targetAdmission.label ).toBe( 'A_BC' );
	} );

	it( 'requests fresh native admission for repeated reads and isolates input, response and result', async () => {
		const { value, api, request, client } = setup( true );
		const pending = client.read( request );
		request.selection.expected = 'caller';
		const result = await pending;
		await client.read( options( value ) );
		result.targetAdmission.pages[ 0 ].surface.layers.push( { id: 'mutated' } );
		expect( api.post ).toHaveBeenCalledTimes( 2 );
		expect( api.post.mock.calls[ 0 ][ 0 ].embedtext ).toBe( value.targetAdmission.selection.expected );
		expect( value.targetAdmission.pages[ 0 ].surface.layers ).toEqual( [] );
	} );

	it.each( [
			[ 'legacy payload', f => f.value ], [ 'missing data', () => ( { version: 1 } ) ],
			[ 'wrong version', f => ( { ...f.envelope, version: 2 } ) ],
			[ 'extra envelope field', f => ( { ...f.envelope, extra: true } ) ],
			[ 'non-ASCII data', f => ( { version: 1, data: JSON.stringify( f.value ) } ) ],
			[ 'invalid JSON', () => ( { version: 1, data: '{' } ) ],
			[ 'literal duplicate keys', f => ( { version: 1, data: f.envelope.data.replace( '"hasLayersSlot":true', '"hasLayersSlot":false,"hasLayersSlot":true' ) } ) ],
			[ 'escaped duplicate keys', f => ( { version: 1, data: f.envelope.data.replace( '"hasLayersSlot":true', '"hasLayersSlot":false,"hasLayers\\u0053lot":true' ) } ) ]
		] )( 'rejects malformed %s envelope without fallback', async ( name, mutate ) => {
			const f = setup();
			f.api.post.mockResolvedValueOnce( { layersmissingpdfimportread: mutate( { value: f.value,
				envelope: { version: 1, data: asciiJson( f.value ) } } ) } );
			const failure = await f.client.read( f.request ).then( () => null, error => error );
			expect( failure ).toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
			expect( f.api.post ).toHaveBeenCalledTimes( 1 );
		} );

	it.each( [
		[ 'target owner', value => { value.targetAdmission.target.owner = 'Other'; } ],
		[ 'target revision', value => { value.targetAdmission.target.revisionId++; } ],
		[ 'source owner', value => { value.source.owner = value.targetAdmission.target.owner; } ],
		[ 'source revision', value => { value.source.revisionId++; } ],
		[ 'source anchor', value => { value.source.surfaceId = 'other'; } ],
		[ 'selection bytes', value => { value.targetAdmission.selection.expected += 'x'; } ],
		[ 'missing admitted page', value => { value.targetAdmission.pages.pop(); } ],
		[ 'extra admitted page', value => { value.targetAdmission.pages.push( copy( value.targetAdmission.pages[ 0 ] ) ); } ],
		[ 'duplicate admitted page', value => { value.targetAdmission.pages[ 1 ].page = value.targetAdmission.pages[ 0 ].page; } ],
		[ 'inconsistent visible name', value => { value.targetAdmission.pages[ 0 ].surface.label = 'Different'; } ],
		[ 'target geometry', value => { value.targetAdmission.pages[ 0 ].sourceGeometry.width++; } ],
		[ 'source page group mismatch', value => { value.sourceGroup.members[ 0 ].surfaceId = 'unknown'; } ],
		[ 'source file mismatch', value => { value.sourceGroup.source.fileTitle = 'File:Other.pdf'; } ],
		[ 'source name mismatch', value => { value.sourceGroup.label = 'Unrelated'; } ],
		[ 'source snapshot mismatch', value => { value.sourceBundle.snapshot.surfaces[ 0 ].source.fileTitle = 'File:Other.pdf'; } ],
		[ 'base differs from raw text', value => { value.targetAdmission.baseText = '{}'; } ],
		[ 'absent slot has stored base', value => { value.targetAdmission.hasLayersSlot = false; } ]
	] )( 'refuses inconsistent %s data', async ( name, mutate ) => {
		const f = setup( true ); mutate( f.value );
		f.api.post.mockResolvedValueOnce( { layersmissingpdfimportread: { version: 1, data: asciiJson( f.value ) } } );
		const failure = await f.client.read( f.request ).then( () => null, error => error );
		expect( failure ).toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
	} );

	it.each( [ 'same', 'escaped', 'nested' ] )( 'rejects %s decoded duplicate keys', async mode => {
		const f = setup(); let json = asciiJson( f.value );
		if ( mode === 'same' ) json = json.replace( '"hasLayersSlot":true', '"hasLayersSlot":false,"hasLayersSlot":true' );
		if ( mode === 'escaped' ) json = json.replace( '"hasLayersSlot":true', '"hasLayersSlot":false,"hasLayers\\u0053lot":true' );
		if ( mode === 'nested' ) json = json.replace( '"absent":null', '"absent":0,"absent":null' );
		expect( JSON.parse( json ) ).toEqual( f.value );
		f.api.post.mockResolvedValueOnce( { layersmissingpdfimportread: { version: 1, data: json } } );
		await expect( f.client.read( f.request ) ).rejects.toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
	} );

	it( 'refuses accessors and does not invoke them', async () => {
		const f = setup(), getter = jest.fn();
		Object.defineProperty( f.request.selection, 'expected', { enumerable: true, get: getter } );
		await expect( f.client.read( f.request ) ).rejects.toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
		expect( getter ).not.toHaveBeenCalled();
		const response = {}; Object.defineProperty( response, 'layersmissingpdfimportread', { enumerable: true, get: getter } );
		f.api.post.mockResolvedValueOnce( response );
		await expect( f.client.read( options( f.value ) ) ).rejects.toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
		expect( getter ).not.toHaveBeenCalled();
	} );

	it( 'rejects malformed requests before posting', async () => {
		const f = setup(); const invalid = options( f.value ); invalid.source.pageId = invalid.target.pageId;
		await expect( f.client.read( invalid ) ).rejects.toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
		expect( f.api.post ).not.toHaveBeenCalled();
	} );

	it( 'disposal invalidates pending and future reads', async () => {
		let resolve;
		const f = setup(); f.api.post.mockImplementationOnce( () => new Promise( done => { resolve = done; } ) );
		const pending = f.client.read( f.request ); f.client.dispose();
		resolve( { layersmissingpdfimportread: { version: 1, data: asciiJson( f.value ) } } );
		await expect( pending ).rejects.toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
		await expect( f.client.read( options( f.value ) ) ).rejects.toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
		expect( f.api.post ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'normalizes transport failures and preserves only fixed native errors', async () => {
		for ( const mode of [ 'throw', 'promise', 'deferred' ] ) {
			const f = setup();
			if ( mode === 'throw' ) { f.api.post.mockImplementationOnce( () => { throw new Error( 'Private diagnostic' ); } ); }
			if ( mode === 'promise' ) { f.api.post.mockRejectedValueOnce( new Error( 'Private diagnostic' ) ); }
			if ( mode === 'deferred' ) {
				f.api.post.mockReturnValueOnce( { then( resolve, reject ) { void resolve; reject( 'failed', { error: { code: 'secret', info: 'Private' } } ); } } );
			}
			await expect( f.client.read( f.request ) ).rejects.toMatchObject( {
				code: 'layers-working-copy-import-unavailable', message: 'layers-working-copy-import-unavailable'
			} );
		}
		const f = setup();
		f.api.post.mockReturnValueOnce( { then( resolve, reject ) { void resolve; reject( 'unknown', { error: { code: 'layers-working-copy-import-unavailable', info: 'Private' } } ); } } );
		await expect( f.client.read( f.request ) ).rejects.toMatchObject( {
			code: 'layers-working-copy-import-unavailable', message: 'layers-working-copy-import-unavailable'
		} );
	} );

	it( 'invalidates an in-flight read if the captured API method is replaced', async () => {
		let resolve;
		const f = setup(); f.api.post.mockImplementationOnce( () => new Promise( done => { resolve = done; } ) );
		const pending = f.client.read( f.request ); f.api.post = jest.fn();
		resolve( { layersmissingpdfimportread: { version: 1, data: asciiJson( f.value ) } } );
		await expect( pending ).rejects.toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
	} );

	it( 'refuses an older reply after a newer selection has already completed', async () => {
		const f = setup(); let resolve;
		f.api.post.mockImplementationOnce( () => new Promise( done => { resolve = done; } ) );
		const older = f.client.read( f.request ).then( () => null, error => error );
		expect( await f.client.read( f.request ) ).toEqual( f.value );
		resolve( { layersmissingpdfimportread: { version: 1, data: asciiJson( f.value ) } } );
		expect( await older ).toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
		expect( f.api.post ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'checks the saved embedding at its UTF-8 byte offset even when both descriptors agree', async () => {
		const f = setup(); f.request.selection.start--;
		f.value.targetAdmission.selection.start = f.request.selection.start;
		f.api.post.mockResolvedValueOnce( { layersmissingpdfimportread: { version: 1, data: asciiJson( f.value ) } } );
		await expect( f.client.read( f.request ) ).rejects.toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
	} );

	it( 'refuses a valid source member that lies outside the admitted target page count', async () => {
		const f = setup( true, true ), member = f.value.sourceBundle.snapshot.surfaces[ 0 ];
		member.source.page = 3; f.value.sourceGroup.pageCount = 3; f.value.sourceGroup.members[ 0 ].page = 3;
		f.value.sourceBundle.sourceGeometry[ member.id ].page = 3;
		f.api.post.mockResolvedValueOnce( { layersmissingpdfimportread: { version: 1, data: asciiJson( f.value ) } } );
		await expect( f.client.read( f.request ) ).rejects.toHaveProperty( 'code', 'layers-working-copy-import-unavailable' );
	} );

	it( 'retains unknown and unavailable sibling data outside the selected source group', async () => {
		const f = setup();
		const sibling = { id: 'unavailable-source-sibling', kind: 'image', label: 'ABC', source: {
			repository: 'local', fileTitle: 'File:Unavailable.png', timestamp: '20261011120000', sha1: 'c'.repeat( 31 )
		}, canvas: { width: 200, height: 100, future: null }, layers: [], metadata: { unknown: [ null, nfd, nfc ] } };
		f.value.sourceBundle.snapshot.surfaces.push( sibling );
		f.api.post.mockResolvedValueOnce( { layersmissingpdfimportread: { version: 1, data: asciiJson( f.value ) } } );
		const result = await f.client.read( f.request );
		expect( result.sourceBundle.snapshot.surfaces.at( -1 ) ).toEqual( sibling );
		expect( result.sourceBundle.sourceGeometry ).not.toHaveProperty( sibling.id );
	} );
} );
