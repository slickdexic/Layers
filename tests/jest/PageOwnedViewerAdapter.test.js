'use strict';
const Adapter = require( '../../resources/ext.layers/viewer/PageOwnedViewerAdapter.js' );
const PdfRenderer = require( '../../resources/ext.layers/viewer/PdfRenderer.js' );
require( '../../resources/ext.layers.shared/DrawingFields.js' );
const fixture = require( '../fixtures/revisions/slide-document-v1.json' );

describe( 'Page-owned viewer response', () => {
	function setup() {
		const surface = fixture.surfaces[ 0 ];
		const bundle = { owner: 'Owner', pageId: 10, revisionId: 42, surface };
		const viewer = { owner: 'Owner', pageId: 10, revisionId: 42, binding: 'v1:10:presentation',
			kind: 'slide', label: surface.label, initialPage: 1, pageCount: 1,
			pages: [ { page: 1, surface } ], source: null, editUrl: null };
		const api = { get: jest.fn( () => Promise.resolve( { layersread: { viewer } } ) ) };
		return { viewer, api, adapter: new Adapter( { api, bundle, binding: viewer.binding } ) };
	}

	it( 'reads only the explicit owner/revision/anchor through the viewer reader', async () => {
		const { api, adapter, viewer } = setup();
		await expect( adapter.read() ).resolves.toBe( viewer );
		expect( api.get ).toHaveBeenCalledWith( { action: 'layersread', formatversion: 2,
			owner: 'Owner', revid: 42, binding: 'v1:10:presentation', viewer: 1 } );
	} );
	it.each( [ 'owner', 'pageId', 'revisionId', 'binding', 'kind', 'label', 'initialPage', 'pageCount' ] )(
		'refuses mismatched %s before painting', async ( key ) => {
			const { adapter, viewer } = setup();
			viewer[ key ] = null;
			await expect( adapter.read() ).rejects.toThrow( 'layers-revision-unavailable' );
		}
	);
	it( 'propagates an opaque read refusal without alternate reads', async () => {
		const { adapter, api } = setup();
		api.get.mockRejectedValueOnce( new Error( 'refused' ) );
		await expect( adapter.read() ).rejects.toThrow( 'refused' );
		expect( api.get ).toHaveBeenCalledTimes( 1 );
	} );

	describe( 'exact PDF page supply', () => {
		function pdf() {
			const surface = Object.assign( {}, JSON.parse( JSON.stringify( fixture.surfaces[ 0 ] ) ), { kind: 'pdf', source: {
				repository: 'local', fileTitle: 'File:Plan.pdf', timestamp: '20261005120000', sha1: 'original', page: 2
			} } );
			const bundle = { owner: 'Owner', pageId: 10, revisionId: 42, surface };
			const viewer = { ...bundle, binding: 'v1:10:presentation', kind: 'pdf', label: surface.label,
				initialPage: 2, pageCount: 3, pages: [ { page: 2, surface } ],
				source: { url: '/rest.php/layers/v0/pdf?owner=Owner&revid=42&binding=v1%3A10%3Apresentation', exactVersion: true } };
			const pdfRenderer = { getDocument: jest.fn( () => Promise.resolve( { numPages: 3 } ) ),
				renderPage: jest.fn( () => Promise.resolve( { dataUrl: 'data:image/png;base64,test', width: 1600, height: 900, pageCount: 3 } ) ),
				destroy: jest.fn() };
			const api = { get: jest.fn( () => Promise.resolve( { layersread: { viewer } } ) ) };
			return { viewer, api, pdfRenderer, adapter: new Adapter( { api, bundle, binding: viewer.binding, pdfRenderer } ) };
		}
		it( 'supplies page 2 and empty pages from the same opaque exact source without inventing surfaces', async () => {
			const { adapter, viewer, pdfRenderer, api } = pdf();
			await adapter.read();
			const annotated = await adapter.loadPage( viewer, 2 );
			const empty = await adapter.loadPage( viewer, 3 );
			expect( annotated.layerData.layers ).toEqual( viewer.pages[ 0 ].surface.layers );
			expect( annotated.layerData.baseWidth ).toBe( 800 );
			expect( empty.layerData.layers ).toEqual( [] );
			expect( empty.layerData.baseWidth ).toBe( 1600 );
			expect( viewer.pages ).toHaveLength( 1 );
			expect( pdfRenderer.getDocument ).not.toHaveBeenCalled();
			expect( pdfRenderer.renderPage ).toHaveBeenNthCalledWith( 2, viewer.source.url, 3,
				{ exactVersion: true, targetWidth: 1600, expectedPageCount: 3, isCurrent: expect.any( Function ) } );
			expect( api.get ).toHaveBeenCalledTimes( 1 );
		} );
		it( 'refuses the wrong document count before clamping or loading an alternate source', async () => {
			const { adapter, viewer } = pdf();
			const getPage = jest.fn();
			adapter.pdfRenderer = new PdfRenderer( { pdfjsLib: { getDocument: () => ( {
				promise: Promise.resolve( { numPages: 2, getPage, destroy: jest.fn() } )
			} ) } } );
			await expect( adapter.loadPage( viewer, 3 ) ).rejects.toThrow( 'layers-revision-unavailable' );
			expect( getPage ).not.toHaveBeenCalled();
			adapter.dispose();
		} );
		it( 'bounds a stalled complete load and retries the same exact source without late page fetch', async () => {
			jest.useFakeTimers();
			const { adapter, viewer, api } = pdf();
			let complete;
			const late = { numPages: 3, getPage: jest.fn(), destroy: jest.fn() };
			const pdfPage = { getViewport: ( { scale } ) => ( { width: 320 * scale, height: 240 * scale } ),
				render: () => ( { promise: Promise.resolve() } ), cleanup: jest.fn() };
			const current = { numPages: 3, getPage: jest.fn( () => Promise.resolve( pdfPage ) ), destroy: jest.fn() };
			const library = { getDocument: jest.fn().mockReturnValueOnce( {
				promise: new Promise( ( resolve ) => { complete = resolve; } )
			} ).mockReturnValue( { promise: Promise.resolve( current ) } ) };
			adapter.pdfRenderer = new PdfRenderer( { pdfjsLib: library } );
			try {
				let state = 'pending';
				const loading = adapter.loadPage( viewer, 2 ).then( () => { state = 'resolved'; }, () => { state = 'refused'; } );
				await jest.advanceTimersByTimeAsync( 30000 );
				expect( state ).toBe( 'refused' ); await loading;
				const result = await adapter.loadPage( viewer, 2 );
				expect( result.layerData.layers ).toEqual( viewer.pages[ 0 ].surface.layers );
				expect( result.layerData.baseWidth ).toBe( 800 );
				expect( current.getPage ).toHaveBeenCalledWith( 2 );
				expect( library.getDocument ).toHaveBeenCalledTimes( 2 );
				for ( const [ parameters ] of library.getDocument.mock.calls ) {
					expect( parameters ).toMatchObject( { url: viewer.source.url, withCredentials: true,
						disableRange: true, disableStream: true, disableAutoFetch: true } );
				}
				complete( late ); await jest.advanceTimersByTimeAsync( 0 );
				expect( late.getPage ).not.toHaveBeenCalled(); expect( late.destroy ).toHaveBeenCalledTimes( 1 );
				expect( api.get ).not.toHaveBeenCalled();
			} finally { adapter.dispose(); jest.useRealTimers(); }
		} );
		it( 'does not fetch a page after disposal during the original document load', async () => {
			const { adapter, viewer } = pdf();
			let complete;
			const doc = { numPages: 3, getPage: jest.fn(), destroy: jest.fn() };
			adapter.pdfRenderer = new PdfRenderer( { pdfjsLib: { getDocument: () => ( {
				promise: new Promise( ( resolve ) => { complete = resolve; } )
			} ) } } );
			const loading = adapter.loadPage( viewer, 2 ); await Promise.resolve();
			adapter.dispose(); complete( doc );
			await expect( loading ).rejects.toThrow( 'layers-revision-unavailable' );
			expect( doc.getPage ).not.toHaveBeenCalled(); expect( doc.destroy ).toHaveBeenCalled();
		} );
		it( 'rejects cross-file and mixed-pin members without changing the inline anchor', () => {
			const { adapter, viewer } = pdf();
			const surface = JSON.parse( JSON.stringify( viewer.pages[ 0 ].surface ) );
			surface.id = 'other'; surface.source.page = 3; surface.source.sha1 = 'latest';
			viewer.pages.push( { page: 3, surface } );
			expect( () => adapter.validate( viewer ) ).toThrow( 'layers-revision-unavailable' );
		} );
		it( 'fills displayed-revision fields by surface ID and preserves stored flags and text', async () => {
			const { adapter, viewer } = pdf();
			viewer.pages[ 0 ].surface.layers[ 0 ] = { id: 'value', type: 'text', text: '{{pressure}}' };
			adapter.fields = { presentation: { pressure: 'Historical value' } };
			const result = await adapter.loadPage( viewer, 2 );
			expect( result.layerData.layers[ 0 ].text ).toBe( 'Historical value' );
			expect( result.layerData.backgroundVisible ).toBe( true );
			expect( viewer.pages[ 0 ].surface.layers[ 0 ].text ).toBe( '{{pressure}}' );
		} );
		it( 'invalidates delayed reads on disposal and releases PDF resources', async () => {
			const { adapter, api, viewer, pdfRenderer } = pdf();
			let resolve;
			api.get.mockReturnValueOnce( new Promise( ( complete ) => { resolve = complete; } ) );
			const loading = adapter.read();
			await Promise.resolve();
			adapter.dispose();
			resolve( { layersread: { viewer } } );
			await expect( loading ).rejects.toThrow( 'layers-revision-unavailable' );
			expect( pdfRenderer.destroy ).toHaveBeenCalledTimes( 1 );
		} );
	} );
} );

describe( 'Page-owned PDF viewer target page', () => {
	function setup( targetPage = 1 ) {
		const anchor = Object.assign( {}, JSON.parse( JSON.stringify( fixture.surfaces[ 0 ] ) ), { kind: 'pdf', source: {
			repository: 'local', fileTitle: 'File:Plan.pdf', timestamp: '20261005120000', sha1: 'original', page: 2
		} } );
		const bundle = { owner: 'Owner', pageId: 10, revisionId: 42, surface: anchor };
		const viewer = { ...bundle, binding: 'v1:10:presentation', kind: 'pdf', label: anchor.label,
			initialPage: 2, pageCount: 3, pages: [ { page: 2, surface: anchor } ],
			source: { url: '/rest.php/layers/v0/pdf?owner=Owner&revid=42&binding=v1%3A10%3Apresentation', exactVersion: true },
			targetPage, display: { page: targetPage, canvas: { width: 800, height: 600 },
				source: { repository: 'local', fileTitle: 'File:Plan.pdf', timestamp: '20261005120000', sha1: 'original', page: targetPage },
				rendition: { url: '/rest.php/layers/v0/pdf-page?owner=Owner&page=1', width: 1600, height: 1200 } } };
		const pdfRenderer = { renderPage: jest.fn( () => Promise.resolve( {
			dataUrl: 'data:image/png;base64,page', width: 1600, height: 1200, pageCount: 3
		} ) ), destroy: jest.fn() };
		const api = { get: jest.fn( () => Promise.resolve( { layersread: { viewer } } ) ) };
		return { anchor, bundle, viewer, api, pdfRenderer,
			adapter: new Adapter( { api, bundle, binding: viewer.binding, targetPage, pdfRenderer } ) };
	}

	it( 'requests page 1 separately from the page 2 anchor and renders it without layers', async () => {
		const { adapter, api, viewer, pdfRenderer } = setup();
		const result = await adapter.read();
		expect( api.get ).toHaveBeenCalledWith( { action: 'layersread', formatversion: 2, owner: 'Owner',
			revid: 42, binding: 'v1:10:presentation', viewer: 1, viewpage: 1 } );
		expect( result.initialPage ).toBe( 1 );
		expect( result.pages ).toEqual( viewer.pages );
		const page = await adapter.loadPage( result, 1 );
		expect( page.imageUrl ).toBe( 'data:image/png;base64,page' );
		expect( page.layerData ).toMatchObject( { width: 1600, height: 1200, baseWidth: 1600, baseHeight: 1200, layers: [] } );
		const sibling = await adapter.loadPage( result, 2 );
		expect( sibling.layerData.layers ).toEqual( viewer.pages[ 0 ].surface.layers );
		expect( pdfRenderer.renderPage ).toHaveBeenNthCalledWith( 1, viewer.source.url, 1,
			{ exactVersion: true, targetWidth: 1600, expectedPageCount: 3, isCurrent: expect.any( Function ) } );
		expect( pdfRenderer.renderPage ).toHaveBeenNthCalledWith( 2, viewer.source.url, 2,
			{ exactVersion: true, targetWidth: 1600, expectedPageCount: 3, isCurrent: expect.any( Function ) } );
	} );

	it.each( [
		[ 'wrong target echo', viewer => { viewer.targetPage = 2; } ],
		[ 'wrong display page', viewer => { viewer.display.page = 3; } ],
		[ 'wrong source page', viewer => { viewer.display.source.page = 3; } ],
		[ 'wrong archived pin', viewer => { viewer.display.source.sha1 = 'latest'; } ],
		[ 'wrong file', viewer => { viewer.display.source.fileTitle = 'File:Other.pdf'; } ],
		[ 'invalid canvas', viewer => { viewer.display.canvas.width = 0; } ],
		[ 'unsafe rendition protocol', viewer => { viewer.display.rendition.url = 'javascript:alert(1)'; } ],
		[ 'data rendition', viewer => { viewer.display.rendition.url = 'data:image/png;base64,abc'; } ],
		[ 'credentialed rendition', viewer => { viewer.display.rendition.url = 'https://user:pass@cdn.example/page.png'; } ],
		[ 'invalid rendition dimensions', viewer => { viewer.display.rendition.height = NaN; } ]
	] )( 'refuses malformed target response: %s', async ( name, mutate ) => {
		const { adapter, viewer } = setup();
		mutate( viewer );
		await expect( adapter.read() ).rejects.toThrow( 'layers-revision-unavailable' );
	} );

	it( 'accepts an authorized credential-free HTTPS CDN rendition', async () => {
		const { adapter, viewer } = setup();
		viewer.display.rendition.url = 'https://cdn.example/page.png';
		await expect( adapter.read() ).resolves.toMatchObject( { initialPage: 1 } );
	} );

	it( 'refuses an echoed target outside the pinned page count', async () => {
		const { adapter } = setup( 4 );
		await expect( adapter.read() ).rejects.toThrow( 'layers-revision-unavailable' );
	} );

	it( 'keeps the default anchor-page request and response unchanged', async () => {
		const { api, viewer, bundle } = setup();
		const defaultAdapter = new Adapter( { api, bundle, binding: viewer.binding } );
		const result = await defaultAdapter.read();
		expect( api.get ).toHaveBeenCalledWith( { action: 'layersread', formatversion: 2,
			owner: 'Owner', revid: 42, binding: 'v1:10:presentation', viewer: 1 } );
		expect( result ).toBe( viewer );
		expect( result.initialPage ).toBe( 2 );
	} );

	it( 'accepts a requested stored target without a display rendition', async () => {
		const { adapter, api, viewer } = setup( 2 );
		delete viewer.display;
		const result = await adapter.read();
		expect( result.initialPage ).toBe( 2 );
		expect( result.pages[ 0 ].surface.layers ).toEqual( viewer.pages[ 0 ].surface.layers );
		expect( api.get ).toHaveBeenCalledWith( expect.objectContaining( { viewpage: 2 } ) );
	} );
} );
