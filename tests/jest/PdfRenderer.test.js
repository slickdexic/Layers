/**
 * Tests for PdfRenderer - the client-side pdf.js page rasterizer.
 *
 * pdf.js itself is never loaded here; instead a mock library is injected via
 * the constructor so the renderer's own logic (loading/caching, scaling,
 * clamping, page-count handling, cleanup) is exercised deterministically.
 */

'use strict';

const PdfRenderer = require( '../../resources/ext.layers/viewer/PdfRenderer.js' );

/**
 * Build a mock pdf.js library.
 *
 * @param {Object} [opts]
 * @param {number} [opts.numPages=3] Pages in the mock document.
 * @param {number} [opts.pageWidth=800] Base (scale 1) page width.
 * @param {number} [opts.pageHeight=600] Base (scale 1) page height.
 * @param {boolean} [opts.failGetDocument=false] Reject getDocument().
 * @return {Object} Mock library plus jest spies for assertions.
 */
function makeMockPdfjs( opts = {} ) {
	const numPages = opts.numPages || 3;
	const pageWidth = opts.pageWidth || 800;
	const pageHeight = opts.pageHeight || 600;

	const renderTask = { promise: Promise.resolve() };
	const pageRender = jest.fn( () => renderTask );
	const pageCleanup = jest.fn();
	const docDestroy = jest.fn();

	const getViewport = jest.fn( ( { scale } ) => ( {
		width: pageWidth * scale,
		height: pageHeight * scale
	} ) );

	const pdfPage = {
		getViewport: getViewport,
		render: pageRender,
		cleanup: pageCleanup
	};

	const getPage = jest.fn( () => Promise.resolve( pdfPage ) );

	const doc = {
		numPages: numPages,
		getPage: getPage,
		destroy: docDestroy
	};

	const getDocument = jest.fn( () => ( {
		promise: opts.failGetDocument ?
			Promise.reject( new Error( 'fetch failed' ) ) :
			Promise.resolve( doc )
	} ) );

	const lib = {
		getDocument: getDocument,
		GlobalWorkerOptions: {}
	};

	return {
		lib: lib,
		getDocument: getDocument,
		getPage: getPage,
		getViewport: getViewport,
		pageRender: pageRender,
		pageCleanup: pageCleanup,
		docDestroy: docDestroy
	};
}

describe( 'PdfRenderer', () => {
	describe( 'isAvailable', () => {
		it( 'is true when a library is injected', () => {
			const { lib } = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: lib } );
			expect( r.isAvailable() ).toBe( true );
		} );

		it( 'is true when a custom loader is injected', () => {
			const r = new PdfRenderer( { loadLibrary: () => Promise.resolve( {} ) } );
			expect( r.isAvailable() ).toBe( true );
		} );

		it( 'is false without a library, loader, or mw.loader', () => {
			const prev = global.mw;
			global.mw = undefined;
			const r = new PdfRenderer();
			expect( r.isAvailable() ).toBe( false );
			global.mw = prev;
		} );
	} );

	describe( 'ensureLibrary', () => {
		it( 'resolves an injected library without loading', async () => {
			const { lib } = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: lib } );
			await expect( r.ensureLibrary() ).resolves.toBe( lib );
		} );

		it( 'invokes a custom loader once and caches the result', async () => {
			const { lib } = makeMockPdfjs();
			const loadLibrary = jest.fn( () => Promise.resolve( lib ) );
			const r = new PdfRenderer( { loadLibrary: loadLibrary } );
			const a = await r.ensureLibrary();
			const b = await r.ensureLibrary();
			expect( a ).toBe( lib );
			expect( b ).toBe( lib );
			expect( loadLibrary ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'configures the worker source when unset', async () => {
			const { lib } = makeMockPdfjs();
			const r = new PdfRenderer( { loadLibrary: () => Promise.resolve( lib ) } );
			await r.ensureLibrary();
			expect( lib.GlobalWorkerOptions.workerSrc ).toContain(
				'pdf.worker.min.js'
			);
		} );

		it( 'rejects and allows retry when the loader yields no usable library', async () => {
			const loadLibrary = jest.fn()
				.mockResolvedValueOnce( null )
				.mockResolvedValueOnce( makeMockPdfjs().lib );
			const r = new PdfRenderer( { loadLibrary: loadLibrary } );
			await expect( r.ensureLibrary() ).rejects.toThrow();
			// Cache cleared on failure → a second attempt retries the loader.
			await expect( r.ensureLibrary() ).resolves.toBeTruthy();
			expect( loadLibrary ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	describe( 'getDocument', () => {
		it( 'caches the document promise per URL', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			const d1 = await r.getDocument( 'a.pdf' );
			const d2 = await r.getDocument( 'a.pdf' );
			expect( d1 ).toBe( d2 );
			expect( mock.getDocument ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'does not cache a failed fetch (allows retry)', async () => {
			const mock = makeMockPdfjs( { failGetDocument: true } );
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await expect( r.getDocument( 'bad.pdf' ) ).rejects.toThrow();
			await expect( r.getDocument( 'bad.pdf' ) ).rejects.toThrow();
			expect( mock.getDocument ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	describe( 'getPageCount', () => {
		it( 'returns the document page count', async () => {
			const mock = makeMockPdfjs( { numPages: 7 } );
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await expect( r.getPageCount( 'x.pdf' ) ).resolves.toBe( 7 );
		} );
	} );

	describe( 'renderPage', () => {
		it( 'renders to a PNG data URL with the expected shape', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			const out = await r.renderPage( 'x.pdf', 1 );
			expect( out.dataUrl ).toBe( 'data:image/png;base64,test' );
			expect( out.pageCount ).toBe( 3 );
			expect( out.width ).toBeGreaterThan( 0 );
			expect( out.height ).toBeGreaterThan( 0 );
			expect( mock.pageRender ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'scales a page to the requested target width', async () => {
			const mock = makeMockPdfjs( { pageWidth: 800, pageHeight: 600 } );
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			const out = await r.renderPage( 'x.pdf', 1, { targetWidth: 1600 } );
			// 800 → 1600 is scale 2, so height 600 → 1200.
			expect( out.width ).toBe( 1600 );
			expect( out.height ).toBe( 1200 );
		} );

		it( 'clamps the largest side to maxDimension', async () => {
			const mock = makeMockPdfjs( { pageWidth: 1000, pageHeight: 4000 } );
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			const out = await r.renderPage( 'x.pdf', 1, {
				targetWidth: 5000,
				maxDimension: 2000
			} );
			expect( Math.max( out.width, out.height ) ).toBeLessThanOrEqual( 2000 );
		} );

		it( 'clamps an out-of-range page number to the last page', async () => {
			const mock = makeMockPdfjs( { numPages: 2 } );
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await r.renderPage( 'x.pdf', 99 );
			expect( mock.getPage ).toHaveBeenCalledWith( 2 );
		} );

		it( 'defaults an invalid page number to page 1', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await r.renderPage( 'x.pdf', 'not-a-number' );
			expect( mock.getPage ).toHaveBeenCalledWith( 1 );
		} );

		it( 'calls page cleanup after rendering', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await r.renderPage( 'x.pdf', 1 );
			expect( mock.pageCleanup ).toHaveBeenCalled();
		} );

		it( 'rejects when the document cannot be fetched', async () => {
			const mock = makeMockPdfjs( { failGetDocument: true } );
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await expect( r.renderPage( 'bad.pdf', 1 ) ).rejects.toThrow();
		} );
	} );

	describe( 'destroy', () => {
		it( 'destroys cached documents and clears the cache', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await r.getDocument( 'x.pdf' );
			r.destroy();
			// Allow the async destroy chain to settle.
			await Promise.resolve();
			expect( mock.docDestroy ).toHaveBeenCalled();
			// Cache cleared → a subsequent getDocument re-fetches.
			await r.getDocument( 'x.pdf' );
			expect( mock.getDocument ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'is safe to call with an empty cache', () => {
			const r = new PdfRenderer( { pdfjsLib: makeMockPdfjs().lib } );
			expect( () => r.destroy() ).not.toThrow();
		} );
	} );

	describe( 'ResourceLoader loading path', () => {
		let prevMw;
		let prevPdfjsGlobal;

		beforeEach( () => {
			prevMw = global.mw;
			prevPdfjsGlobal = window.pdfjsLib;
		} );

		afterEach( () => {
			global.mw = prevMw;
			window.pdfjsLib = prevPdfjsGlobal;
		} );

		it( 'loads pdf.js via mw.loader.using require()', async () => {
			const { lib } = makeMockPdfjs();
			const req = jest.fn( () => lib );
			global.mw = {
				loader: { using: jest.fn( () => Promise.resolve( req ) ) },
				config: { get: jest.fn( () => '/w/extensions' ) },
				log: jest.fn()
			};
			const r = new PdfRenderer();
			const out = await r.ensureLibrary();
			expect( out ).toBe( lib );
			expect( global.mw.loader.using ).toHaveBeenCalledWith( 'ext.layers.pdfjs' );
			expect( req ).toHaveBeenCalledWith( 'ext.layers.pdfjs' );
			// Worker configured from wgExtensionAssetsPath (trailing slash added).
			expect( lib.GlobalWorkerOptions.workerSrc ).toBe(
				'/w/extensions/Layers/resources/lib/pdfjs/pdf.worker.min.js'
			);
		} );

		it( 'falls back to the window.pdfjsLib global when require() throws', async () => {
			const { lib } = makeMockPdfjs();
			const req = jest.fn( () => {
				throw new Error( 'no module' );
			} );
			window.pdfjsLib = lib;
			global.mw = {
				loader: { using: jest.fn( () => Promise.resolve( req ) ) },
				config: { get: jest.fn( () => '' ) }
			};
			const r = new PdfRenderer();
			await expect( r.ensureLibrary() ).resolves.toBe( lib );
		} );

		it( 'rejects when ResourceLoader is unavailable', async () => {
			global.mw = undefined;
			const r = new PdfRenderer();
			await expect( r.ensureLibrary() ).rejects.toThrow();
		} );

		it( 'debugLog forwards to mw.log when debug is enabled', () => {
			global.mw = { log: jest.fn() };
			const r = new PdfRenderer( { debug: true } );
			r.debugLog( 'hello', 1 );
			expect( global.mw.log ).toHaveBeenCalledWith( '[PdfRenderer]', 'hello', 1 );
		} );
	} );
} );
