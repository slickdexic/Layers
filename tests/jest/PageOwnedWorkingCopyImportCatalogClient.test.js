'use strict';

const Client = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportCatalogClient.js' );
const CODE = 'layers-working-copy-import-unavailable';
const clone = value => JSON.parse( JSON.stringify( value ) );
const slide = { pageId: 1, kind: 'slide', label: 'Welcome Slide', fileTitle: null };
const image = { pageId: 1, kind: 'image', label: 'ABC', fileTitle: 'File:Sample.png' };

function response() {
	return { layersdrawings: { pages: [ { title: 'Source page', owner: 'Source_page', pageid: 2, revid: 20,
		drawings: [ { id: 'presentation', label: 'welcome_slide', kind: 'slide',
			canvas: { width: 800, height: 600 }, fileTitle: null } ] } ] } };
}

describe( 'PageOwnedWorkingCopyImportCatalogClient', () => {
	let api, client, wire;
	beforeEach( () => {
		wire = response();
		api = { get: jest.fn( () => Promise.resolve( wire ) ) };
		client = new Client( api );
	} );

	test( 'exports without activating any caller and validates API dependency', () => {
		expect( window.Layers.Editor.PageOwnedWorkingCopyImportCatalogClient ).toBe( Client );
		for ( const invalid of [ null, {}, { get: true } ] ) { expect( () => new Client( invalid ) ).toThrow( CODE ); }
	} );

	test( 'requests native Import metadata and returns the coordinator four-field identity', async () => {
		const choices = await client.search( { search: ' Source ', target: slide } );
		expect( api.get ).toHaveBeenCalledWith( { action: 'layersdrawings', purpose: 'import',
			search: 'Source', exclude: 1, limit: 20, format: 'json', formatversion: 2 } );
		expect( choices ).toStrictEqual( [ { title: 'Source page', label: 'welcome_slide', kind: 'slide',
			canvas: { width: 800, height: 600 }, fileTitle: null,
			source: { owner: 'Source_page', pageId: 2, revisionId: 20, surfaceId: 'presentation' } } ] );
		expect( Object.keys( choices[ 0 ].source ).sort() ).toEqual( [ 'owner', 'pageId', 'revisionId', 'surfaceId' ] );
	} );

	test( 'same layer-set name on different files is not an Import match', async () => {
		wire.layersdrawings.pages[ 0 ].drawings = [ 'File:Sample.png', 'File:Other.png' ].map( ( fileTitle, index ) => ( {
			id: 'image' + index, label: 'ABC', kind: 'image', canvas: { width: 100, height: 200 }, fileTitle
		} ) );
		const choices = await client.search( { search: '', target: image } );
		expect( choices ).toHaveLength( 1 );
		expect( choices[ 0 ].source.surfaceId ).toBe( 'image0' );
	} );

	test( 'same-name sets on separate owners remain distinct choices with unchanged native IDs', async () => {
		wire.layersdrawings.pages.push( { ...clone( wire.layersdrawings.pages[ 0 ] ),
			title: 'Second page', owner: 'Second_page', pageid: 3, revid: 21 } );
		const choices = await client.search( { search: '', target: slide } );
		expect( choices.map( c => c.source ) ).toEqual( [
			{ owner: 'Source_page', pageId: 2, revisionId: 20, surfaceId: 'presentation' },
			{ owner: 'Second_page', pageId: 3, revisionId: 21, surfaceId: 'presentation' }
		] );
	} );

	test( 'filters different slide names and different content kinds', async () => {
		wire.layersdrawings.pages[ 0 ].drawings.push(
			{ id: 'other', label: 'Other slide', kind: 'slide', canvas: { width: 200, height: 100 }, fileTitle: null },
			{ id: 'image', label: 'Welcome Slide', kind: 'image', canvas: { width: 100, height: 100 },
				fileTitle: 'File:Sample.png' } );
		expect( ( await client.search( { search: '', target: slide } ) ).map( c => c.source.surfaceId ) )
			.toEqual( [ 'presentation' ] );
	} );

	test( 'keeps native canonical owner separate from the displayed title and returns detached data', async () => {
		wire.layersdrawings.pages[ 0 ].title = 'A displayed title with spaces';
		wire.layersdrawings.pages[ 0 ].owner = 'Project:Canonical_owner';
		const choices = await client.search( { search: '', target: slide } );
		expect( choices[ 0 ].source.owner ).toBe( 'Project:Canonical_owner' );
		choices[ 0 ].source.owner = 'Changed'; choices[ 0 ].canvas.width = 10;
		expect( wire.layersdrawings.pages[ 0 ].owner ).toBe( 'Project:Canonical_owner' );
		expect( wire.layersdrawings.pages[ 0 ].drawings[ 0 ].canvas.width ).toBe( 800 );
	} );

	test.each( [ 0, -1, 2147483648, 1.1, '2', null ] )( 'rejects malformed native source ID %p', async value => {
		wire.layersdrawings.pages[ 0 ].pageid = value;
		await expect( client.search( { search: '', target: slide } ) ).rejects.toThrow( CODE );
	} );

	test.each( [ 'own-page', 'duplicate-page', 'duplicate-member', 'missing-canonical', 'unknown-member-field',
		'null-canvas', 'bad-width', 'pdf', 'legacy-shape', 'api-error' ] )( 'refuses ambiguous/malformed %s', async mode => {
		const page = wire.layersdrawings.pages[ 0 ], entry = page.drawings[ 0 ];
		if ( mode === 'own-page' ) { page.pageid = 1; }
		if ( mode === 'duplicate-page' ) { wire.layersdrawings.pages.push( clone( page ) ); }
		if ( mode === 'duplicate-member' ) { page.drawings.push( clone( entry ) ); }
		if ( mode === 'missing-canonical' ) { delete page.owner; }
		if ( mode === 'unknown-member-field' ) { entry.layers = []; }
		if ( mode === 'null-canvas' ) { entry.canvas = null; }
		if ( mode === 'bad-width' ) { entry.canvas.width = Infinity; }
		if ( mode === 'pdf' ) { entry.kind = 'pdf'; }
		if ( mode === 'legacy-shape' ) { delete entry.canvas; delete entry.fileTitle; }
		if ( mode === 'api-error' ) { wire = { error: { code: 'permissiondenied', info: 'private' } }; }
		await expect( client.search( { search: '', target: slide } ) ).rejects.toThrow( CODE );
	} );

	test( 'invalid request and getter identities make zero API calls', async () => {
		const target = { ...slide };
		const getter = jest.fn( () => 1 ); Object.defineProperty( target, 'pageId', { get: getter, enumerable: true } );
		for ( const request of [ null, { search: '', target }, { search: 'x'.repeat( 256 ), target: slide },
			{ search: '', target: { ...slide, pageId: '1' } } ] ) {
			await expect( client.search( request ) ).rejects.toThrow( CODE );
		}
		expect( getter ).not.toHaveBeenCalled(); expect( api.get ).not.toHaveBeenCalled();
	} );

	test( 'does not invoke a response-module getter', async () => {
		const getter = jest.fn( () => response().layersdrawings );
		wire = {}; Object.defineProperty( wire, 'layersdrawings', { enumerable: true, get: getter } );
		await expect( client.search( { search: '', target: slide } ) ).rejects.toThrow( CODE );
		expect( getter ).not.toHaveBeenCalled();
	} );

	test( 'later target mutations cannot change the captured matching request', async () => {
		let resolve; api.get.mockImplementation( () => new Promise( r => { resolve = r; } ) );
		const target = { ...slide }, pending = client.search( { search: '', target } );
		target.label = 'Changed'; target.pageId = 99;
		resolve( wire ); const choices = await pending;
		expect( choices ).toHaveLength( 1 ); expect( api.get.mock.calls[ 0 ][ 0 ].exclude ).toBe( 1 );
	} );

	test( 'captures matching data before the await and suppresses superseded search responses', async () => {
		const resolves = []; api.get.mockImplementation( () => new Promise( resolve => resolves.push( resolve ) ) );
		const target = { ...slide }, first = client.search( { search: 'Old', target } );
		const refused = expect( first ).rejects.toThrow( CODE );
		target.label = 'Changed';
		const second = client.search( { search: 'New', target: slide } );
		resolves[ 1 ]( wire ); expect( await second ).toHaveLength( 1 );
		resolves[ 0 ]( wire ); await refused;
	} );

	test( 'dispose invalidates outstanding searches and refuses later reads', async () => {
		let resolve; api.get.mockImplementation( () => new Promise( r => { resolve = r; } ) );
		const pending = client.search( { search: '', target: slide } );
		client.dispose(); client.dispose(); resolve( wire );
		await expect( pending ).rejects.toThrow( CODE );
		await expect( client.search( { search: '', target: slide } ) ).rejects.toThrow( CODE );
		expect( api.get ).toHaveBeenCalledTimes( 1 );
	} );

	test( 'empty authorized search and rejected API have no publication side effects', async () => {
		wire.layersdrawings.pages = []; expect( await client.search( { search: '', target: slide } ) ).toEqual( [] );
		api.get.mockRejectedValue( new Error( 'private native message' ) );
		await expect( client.search( { search: '', target: slide } ) ).rejects.toMatchObject( { code: CODE, message: CODE } );
		expect( Object.keys( api ) ).toEqual( [ 'get' ] );
	} );
} );
