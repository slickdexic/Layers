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
		GlobalWorkerOptions: {},
		VerbosityLevel: { ERRORS: 0, WARNINGS: 1, INFOS: 5 }
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

		it( 'is true in a DOM environment even without MediaWiki present', () => {
			// pdf.js is fetched as a static script now, so ResourceLoader is not
			// required — only somewhere to inject the tag.
			const prev = global.mw;
			global.mw = undefined;
			const r = new PdfRenderer();
			expect( r.isAvailable() ).toBe( true );
			global.mw = prev;
		} );

		it( 'is false without a library, loader, or a usable DOM', () => {
			const spy = jest.spyOn( document, 'createElement' );
			// Simulate an environment where document exists but cannot build nodes.
			Object.defineProperty( document, 'createElement', {
				value: undefined,
				configurable: true
			} );
			const r = new PdfRenderer();
			expect( r.isAvailable() ).toBe( false );
			spy.mockRestore();
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

		it( 'passes isEvalSupported:false (CVE-2024-4367 mitigation)', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await r.getDocument( 'a.pdf' );
			expect( mock.getDocument ).toHaveBeenCalledWith(
				expect.objectContaining( { isEvalSupported: false } )
			);
		} );

		it( 'does not cache a failed fetch (allows retry)', async () => {
			const mock = makeMockPdfjs( { failGetDocument: true } );
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await expect( r.getDocument( 'bad.pdf' ) ).rejects.toThrow();
			await expect( r.getDocument( 'bad.pdf' ) ).rejects.toThrow();
			expect( mock.getDocument ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'caps pdf.js image decoding (maxImageSize)', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await r.getDocument( 'a.pdf' );
			const arg = mock.getDocument.mock.calls[ 0 ][ 0 ];
			expect( typeof arg.maxImageSize ).toBe( 'number' );
			expect( arg.maxImageSize ).toBeGreaterThan( 0 );
		} );

		it( 'silences pdf.js font-recovery warnings by default', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await r.getDocument( 'a.pdf' );
			expect( mock.getDocument ).toHaveBeenCalledWith(
				expect.objectContaining( { verbosity: mock.lib.VerbosityLevel.ERRORS } )
			);
		} );

		it( 'restores pdf.js warnings when debug is enabled', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib, debug: true } );
			await r.getDocument( 'a.pdf' );
			expect( mock.getDocument ).toHaveBeenCalledWith(
				expect.objectContaining( { verbosity: mock.lib.VerbosityLevel.WARNINGS } )
			);
		} );

		it( 'falls back to numeric verbosity when VerbosityLevel is absent', async () => {
			const mock = makeMockPdfjs();
			delete mock.lib.VerbosityLevel;
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			await r.getDocument( 'a.pdf' );
			expect( mock.getDocument ).toHaveBeenCalledWith(
				expect.objectContaining( { verbosity: 0 } )
			);
		} );

		it( 'evicts and destroys least-recently-used documents beyond the cap', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			for ( let i = 0; i < 9; i++ ) {
				await r.getDocument( 'doc' + i + '.pdf' );
			}
			// Let the async destroy of the evicted entry settle.
			await Promise.resolve();
			expect( r._docCache.size ).toBe( 8 );
			expect( r._docCache.has( 'doc0.pdf' ) ).toBe( false );
			expect( r._docCache.has( 'doc8.pdf' ) ).toBe( true );
			expect( mock.docDestroy ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'a cache hit refreshes the entry so it is not evicted next', async () => {
			const mock = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: mock.lib } );
			for ( let i = 0; i < 8; i++ ) {
				await r.getDocument( 'doc' + i + '.pdf' );
			}
			// Touch the oldest entry, then push the cache over the cap.
			await r.getDocument( 'doc0.pdf' );
			await r.getDocument( 'new.pdf' );
			await Promise.resolve();
			expect( r._docCache.has( 'doc0.pdf' ) ).toBe( true );
			expect( r._docCache.has( 'doc1.pdf' ) ).toBe( false );
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

	describe( 'static script loading path', () => {
		let prevMw;
		let prevPdfjsGlobal;
		let appended;

		// ensureLibrary() defers the loader by a microtask, so the script tag does
		// not exist until the queue drains.
		const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

		beforeEach( () => {
			prevMw = global.mw;
			prevPdfjsGlobal = window.pdfjsLib;
			PdfRenderer._scriptPromise = null;
			appended = [];
			jest.spyOn( document.head, 'appendChild' ).mockImplementation( ( node ) => {
				appended.push( node );
				return node;
			} );
		} );

		afterEach( () => {
			jest.restoreAllMocks();
			global.mw = prevMw;
			window.pdfjsLib = prevPdfjsGlobal;
			PdfRenderer._scriptPromise = null;
		} );

		it( 'injects a cache-busted script tag and resolves the global', async () => {
			const { lib } = makeMockPdfjs();
			global.mw = {
				config: { get: jest.fn( () => '/w/extensions' ) },
				log: jest.fn()
			};
			delete window.pdfjsLib;
			const r = new PdfRenderer();
			const promise = r.ensureLibrary();
			await flush();

			expect( appended ).toHaveLength( 1 );
			expect( appended[ 0 ].src ).toContain(
				'/w/extensions/Layers/resources/lib/pdfjs/pdf.min.js?version='
			);
			// The bundle assigns the global as it executes.
			window.pdfjsLib = lib;
			appended[ 0 ].onload();

			await expect( promise ).resolves.toBe( lib );
			expect( lib.GlobalWorkerOptions.workerSrc ).toContain(
				'/w/extensions/Layers/resources/lib/pdfjs/pdf.worker.min.js?version='
			);
		} );

		it( 'reuses an already-present global without injecting a script', async () => {
			const { lib } = makeMockPdfjs();
			window.pdfjsLib = lib;
			global.mw = { config: { get: jest.fn( () => '' ) } };
			const r = new PdfRenderer();
			await expect( r.ensureLibrary() ).resolves.toBe( lib );
			expect( appended ).toHaveLength( 0 );
		} );

		it( 'shares one download across renderer instances', async () => {
			const { lib } = makeMockPdfjs();
			global.mw = { config: { get: jest.fn( () => '' ) } };
			delete window.pdfjsLib;
			const first = new PdfRenderer().ensureLibrary();
			const second = new PdfRenderer().ensureLibrary();
			await flush();

			expect( appended ).toHaveLength( 1 );
			window.pdfjsLib = lib;
			appended[ 0 ].onload();
			await expect( first ).resolves.toBe( lib );
			await expect( second ).resolves.toBe( lib );
		} );

		it( 'rejects and allows a retry when the script fails to load', async () => {
			global.mw = { config: { get: jest.fn( () => '' ) } };
			delete window.pdfjsLib;
			const r = new PdfRenderer();
			const promise = r.ensureLibrary();
			await flush();
			appended[ 0 ].onerror();
			await expect( promise ).rejects.toThrow( /Failed to load pdf\.js/ );
			// The cached promise is cleared, so a later attempt re-injects.
			expect( PdfRenderer._scriptPromise ).toBeNull();
		} );

		it( 'debugLog forwards to mw.log when debug is enabled', () => {
			global.mw = { log: jest.fn() };
			const r = new PdfRenderer( { debug: true } );
			r.debugLog( 'hello', 1 );
			expect( global.mw.log ).toHaveBeenCalledWith( '[PdfRenderer]', 'hello', 1 );
		} );
	} );

	describe( 'stall protection', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'rejects renderPage when pdf.js never settles', async () => {
			const { lib } = makeMockPdfjs();
			// A worker that never completes its handshake leaves getDocument()
			// pending forever; pdf.js applies no timeout of its own.
			lib.getDocument = jest.fn( () => ( { promise: new Promise( () => {} ) } ) );
			const r = new PdfRenderer( { pdfjsLib: lib } );

			const rendering = r.renderPage( 'stalled.pdf', 1 );
			const assertion = expect( rendering ).rejects.toThrow( /timed out/ );
			jest.advanceTimersByTime( 30000 );
			await assertion;
		} );

		it( 'honours an explicit timeoutMs option', async () => {
			const { lib } = makeMockPdfjs();
			lib.getDocument = jest.fn( () => ( { promise: new Promise( () => {} ) } ) );
			const r = new PdfRenderer( { pdfjsLib: lib } );

			const rendering = r.renderPage( 'stalled.pdf', 1, { timeoutMs: 500 } );
			const assertion = expect( rendering ).rejects.toThrow( /timed out/ );
			jest.advanceTimersByTime( 500 );
			await assertion;
		} );

		it( 'evicts the stalled document so a retry is not queued behind it', async () => {
			const { lib } = makeMockPdfjs();
			lib.getDocument = jest.fn( () => ( { promise: new Promise( () => {} ) } ) );
			const r = new PdfRenderer( { pdfjsLib: lib } );

			const rendering = r.renderPage( 'stalled.pdf', 1, { timeoutMs: 100 } );
			const assertion = expect( rendering ).rejects.toThrow( /timed out/ );
			jest.advanceTimersByTime( 100 );
			await assertion;

			expect( r._docCache.has( 'stalled.pdf' ) ).toBe( false );
		} );

		it( 'rejects ensureLibrary when the loader never settles', async () => {
			const r = new PdfRenderer( { loadLibrary: () => new Promise( () => {} ) } );

			const loading = r.ensureLibrary();
			const assertion = expect( loading ).rejects.toThrow( /failed to load/ );
			jest.advanceTimersByTime( 15000 );
			await assertion;

			// The failed attempt must not be cached, so a retry can succeed.
			expect( r._libPromise ).toBeNull();
		} );

		it( 'does not reject when the render resolves before the timeout', async () => {
			const { lib } = makeMockPdfjs();
			const r = new PdfRenderer( { pdfjsLib: lib } );

			const result = await r.renderPage( 'ok.pdf', 1 );
			expect( result.pageCount ).toBe( 3 );

			// The timeout timer must be cleared, not left armed.
			expect( jest.getTimerCount() ).toBe( 0 );
		} );
	} );
} );
