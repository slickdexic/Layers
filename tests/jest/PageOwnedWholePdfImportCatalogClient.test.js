'use strict';

const Client = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportCatalogClient.js' );
const CODE = 'layers-working-copy-import-unavailable';
const asciiJson = value => JSON.stringify( value ).replace( /[\u0080-\uffff]/g,
	char => '\\u' + char.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) );
const target = { pageId: 1, kind: 'pdf', label: 'Project Atlas', fileTitle: 'File:Atlas.pdf' };
const group = ( id, label = 'project_atlas', fileTitle = 'File:Atlas.pdf', canvas = { width: 800, height: 600 } ) =>
	( { id, label, kind: 'pdf', canvas, fileTitle } );
const page = ( pageid = 2, owner = 'Source_page', label = 'project_atlas', fileTitle = 'File:Atlas.pdf' ) =>
	( { title: 'Source page', owner, pageid, revid: 20, layerSets: [ group( 'source-anchor', label, fileTitle ) ] } );
const encoded = ( ...pages ) => asciiJson( { pages } );
const wire = ( ...pages ) => ( { layersworkingcopypdfimportcatalog: { version: 1, data: encoded( ...pages ) } } );

describe( 'PageOwnedWholePdfImportCatalogClient', () => {
	let api, client, response;
	beforeEach( () => { response = wire( page() ); api = { get: jest.fn( () => Promise.resolve( response ) ) }; client = new Client( api ); } );

	test( 'exports an inactive client and requires an API getter', () => {
		expect( window.Layers.Editor.PageOwnedWholePdfImportCatalogClient ).toBe( Client );
		for ( const value of [ null, {}, { get: true } ] ) { expect( () => new Client( value ) ).toThrow( CODE ); }
	} );

	test( 'uses the PDF catalog action and returns picker-compatible exact source identities', async () => {
		const choices = await client.search( { search: ' atlas ', target } );
		expect( api.get ).toHaveBeenCalledWith( { action: 'layersworkingcopypdfimportcatalog', search: 'atlas', exclude: 1,
			limit: 20, format: 'json', formatversion: 2 } );
		expect( choices ).toStrictEqual( [ { title: 'Source page', label: 'project_atlas', kind: 'pdf', canvas: { width: 800, height: 600 },
			fileTitle: 'File:Atlas.pdf', source: { owner: 'Source_page', pageId: 2, revisionId: 20, surfaceId: 'source-anchor' } } ] );
		expect( Object.keys( choices[ 0 ].source ).sort() ).toEqual( [ 'owner', 'pageId', 'revisionId', 'surfaceId' ] );
	} );

	test( 'preserves the exact NFD Unicode owner, file and label from the ASCII data envelope', async () => {
		const label = 'Re\u0301sume\u0301 Ω', fileTitle = 'File:Re\u0301sume\u0301 Ω.pdf', owner = 'Project:Re\u0301sume\u0301';
		const unicodeTarget = { ...target, label, fileTitle };
		response = wire( { title: 'Re\u0301sume\u0301', owner, pageid: 2, revid: 20,
			layerSets: [ group( 'anchor-Ω', label, fileTitle ) ] } );
		const choices = await client.search( { search: '', target: unicodeTarget } );
		expect( choices[ 0 ] ).toMatchObject( { title: 'Re\u0301sume\u0301', label, fileTitle,
			source: { owner, surfaceId: 'anchor-Ω' } } );
		expect( response.layersworkingcopypdfimportcatalog.data ).toMatch( /\\u0301/ );
	} );

	test( 'matches normalized layer-set names and exact files while retaining distinct owner choices', async () => {
		response = wire( page( 2, 'Source_A' ), page( 3, 'Source_B', 'PROJECT ATLAS' ), page( 4, 'Other_file', 'project atlas', 'File:Other.pdf' ) );
		expect( ( await client.search( { search: '', target } ) ).map( choice => choice.source.owner ) ).toEqual( [ 'Source_A', 'Source_B' ] );
	} );

	test( 'keeps the same name on different files within one owner independent', async () => {
		const owner = page( 2, 'Source_A' ); owner.layerSets.push( group( 'other-file-anchor', 'Project Atlas', 'File:Other.pdf' ) );
		response = wire( owner );
		expect( ( await client.search( { search: '', target } ) ).map( choice => choice.source.surfaceId ) ).toEqual( [ 'source-anchor' ] );
		expect( ( await client.search( { search: '', target: { ...target, fileTitle: 'File:Other.pdf' } } ) )
			.map( choice => choice.source.surfaceId ) ).toEqual( [ 'other-file-anchor' ] );
	} );

	test.each( [ 'duplicate-group-after-filter', 'duplicate-page-id', 'duplicate-owner', 'duplicate-layer-id' ] )( 'refuses ambiguous catalog records: %s', async mode => {
			if ( mode === 'duplicate-group-after-filter' ) { response = wire( { ...page(), layerSets: [ group( 'a' ), group( 'b', 'Project Atlas' ) ] } ); }
			if ( mode === 'duplicate-page-id' ) { response = wire( page(), page( 2, 'Other_owner' ) ); }
			if ( mode === 'duplicate-owner' ) { response = wire( page(), page( 3, 'Source_page' ) ); }
			if ( mode === 'duplicate-layer-id' ) { response = wire( { ...page(), layerSets: [ group( 'same' ), group( 'same', 'Different name' ) ] } ); }
			await expect( client.search( { search: '', target } ) ).rejects.toThrow( CODE );
		} );

	test.each( [ 0, -1, 2147483648, 1.1, '2', null ] )( 'rejects malformed native source ID %p', async value => {
		response = wire( { ...page(), pageid: value } ); await expect( client.search( { search: '', target } ) ).rejects.toThrow( CODE );
	} );

	test.each( [ 'own-page', 'too-many-pages', 'bad-canvas', 'bad-file', 'unknown-entry-field', 'bad-kind' ] )( 'refuses malformed catalog metadata: %s', async mode => {
			let pages = [ page() ];
			if ( mode === 'own-page' ) { pages[ 0 ].pageid = 1; }
			if ( mode === 'too-many-pages' ) { pages = Array.from( { length: 21 }, ( _, index ) => page( index + 2, 'Owner_' + index ) ); }
			if ( mode === 'bad-canvas' ) { pages[ 0 ].layerSets[ 0 ].canvas.width = Infinity; }
			if ( mode === 'bad-file' ) { pages[ 0 ].layerSets[ 0 ].fileTitle = null; }
			if ( mode === 'unknown-entry-field' ) { pages[ 0 ].layerSets[ 0 ].extra = true; }
			if ( mode === 'bad-kind' ) { pages[ 0 ].layerSets[ 0 ].kind = 'image'; }
			response = wire( ...pages ); await expect( client.search( { search: '', target } ) ).rejects.toThrow( CODE );
		} );

	test.each( [ 'wrong-version', 'non-ascii-data', 'malformed-json', 'duplicate-equivalent-escaped-key', 'missing-data', 'extra-envelope-field' ] )( 'refuses malformed versioned catalog data: %s', async mode => {
			if ( mode === 'wrong-version' ) { response.layersworkingcopypdfimportcatalog.version = 2; }
			if ( mode === 'non-ascii-data' ) { response.layersworkingcopypdfimportcatalog.data = '{"pages":[],"label":"Ω"}'; }
			if ( mode === 'malformed-json' ) { response.layersworkingcopypdfimportcatalog.data = '{"pages":'; }
			if ( mode === 'duplicate-equivalent-escaped-key' ) { response.layersworkingcopypdfimportcatalog.data = '{"pages":[],"p\\u0061ges":[]}'; }
			if ( mode === 'missing-data' ) { delete response.layersworkingcopypdfimportcatalog.data; }
			if ( mode === 'extra-envelope-field' ) { response.layersworkingcopypdfimportcatalog.extra = true; }
			await expect( client.search( { search: '', target } ) ).rejects.toThrow( CODE );
		} );

	test( 'invalid requests and accessor identities make zero API calls', async () => {
		const getter = jest.fn( () => 1 ), badTarget = { ...target };
		Object.defineProperty( badTarget, 'pageId', { enumerable: true, get: getter } );
		for ( const request of [ null, { search: '', target: badTarget }, { search: 'x'.repeat( 256 ), target },
			{ search: '', target: { ...target, pageId: '1' } } ] ) { await expect( client.search( request ) ).rejects.toThrow( CODE ); }
		expect( getter ).not.toHaveBeenCalled(); expect( api.get ).not.toHaveBeenCalled();
	} );

	test( 'does not invoke response-module or envelope accessors', async () => {
		const getter = jest.fn( () => ( { version: 1, data: encoded( page() ) } ) ); response = {};
		Object.defineProperty( response, 'layersworkingcopypdfimportcatalog', { enumerable: true, get: getter } );
		await expect( client.search( { search: '', target } ) ).rejects.toThrow( CODE ); expect( getter ).not.toHaveBeenCalled();
		response = {}; const moduleValue = {}; Object.defineProperty( moduleValue, 'data', { enumerable: true, get: getter } );
		Object.defineProperty( moduleValue, 'version', { enumerable: true, value: 1 } );
		response.layersworkingcopypdfimportcatalog = moduleValue;
		await expect( client.search( { search: '', target } ) ).rejects.toThrow( CODE ); expect( getter ).not.toHaveBeenCalled();
	} );

	test( 'captures request matching data before awaiting and refuses superseded responses', async () => {
		const pending = []; api.get.mockImplementation( () => new Promise( resolve => pending.push( resolve ) ) );
		const mutable = { ...target }, first = client.search( { search: 'old', target: mutable } ), refused = expect( first ).rejects.toThrow( CODE );
		mutable.pageId = 99; mutable.fileTitle = 'File:Changed.pdf';
		const second = client.search( { search: 'new', target } ); pending[ 1 ]( wire( page() ) ); expect( await second ).toHaveLength( 1 );
		pending[ 0 ]( wire( page() ) ); await refused; expect( api.get.mock.calls[ 0 ][ 0 ].exclude ).toBe( 1 );
	} );

	test( 'dispose invalidates pending searches and refuses later reads', async () => {
		let resolve; api.get.mockImplementation( () => new Promise( done => { resolve = done; } ) );
		const pending = client.search( { search: '', target } ); client.dispose(); client.dispose(); resolve( wire( page() ) );
		await expect( pending ).rejects.toThrow( CODE ); await expect( client.search( { search: '', target } ) ).rejects.toThrow( CODE );
		expect( api.get ).toHaveBeenCalledTimes( 1 );
	} );

	test( 'returns detached metadata, empty catalogs and generic API errors', async () => {
		const choices = await client.search( { search: '', target } ); choices[ 0 ].canvas.width = 1; choices[ 0 ].source.owner = 'Changed';
		expect( JSON.parse( response.layersworkingcopypdfimportcatalog.data ).pages[ 0 ].owner ).toBe( 'Source_page' );
		response = wire(); expect( await client.search( { search: '', target } ) ).toEqual( [] );
		api.get.mockRejectedValue( new Error( 'private native failure detail' ) );
		await expect( client.search( { search: '', target } ) ).rejects.toMatchObject( { code: CODE, message: CODE } );
	} );
	test( 'matches the captured target after the caller mutates its request during a read', async () => {
		let resolve; api.get.mockImplementation( () => new Promise( done => { resolve = done; } ) );
		const mutable = { ...target }, pending = client.search( { search: '', target: mutable } );
		mutable.fileTitle = 'File:Other.pdf'; mutable.label = 'Different'; mutable.pageId = 99;
		resolve( wire( page() ) );
		expect( ( await pending ).map( choice => choice.source.surfaceId ) ).toEqual( [ 'source-anchor' ] );
	} );

} );
