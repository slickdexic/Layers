/**
 * Smoke test for the *vendored* pdf.js bundle.
 *
 * PdfRenderer.test.js injects a mock library, so it stays green even if the
 * real artifact in resources/lib/pdfjs is unusable. That is exactly how a
 * broken bundle reached production once already. This suite loads the actual
 * file and asserts the module shape the renderer depends on, plus the two
 * properties that determine whether it survives delivery to the browser.
 */

'use strict';

const path = require( 'path' );
const fs = require( 'fs' );

const PROJECT_ROOT = path.join( __dirname, '..', '..' );
const LIB_DIR = path.join( PROJECT_ROOT, 'resources', 'lib', 'pdfjs' );
const ENTRY = path.join( LIB_DIR, 'pdf.min.js' );
const WORKER = path.join( LIB_DIR, 'pdf.worker.min.js' );

describe( 'vendored pdf.js bundle', () => {
	let lib;

	beforeAll( () => {
		lib = require( ENTRY );
	} );

	it( 'resolves to an object when required as CommonJS', () => {
		expect( lib ).toBeTruthy();
		expect( typeof lib ).toBe( 'object' );
	} );

	it( 'exposes the entry points PdfRenderer calls', () => {
		expect( typeof lib.getDocument ).toBe( 'function' );
		expect( lib.GlobalWorkerOptions ).toBeTruthy();
	} );

	it( 'reports a version matching the worker build', () => {
		expect( typeof lib.version ).toBe( 'string' );
		const worker = fs.readFileSync( WORKER, 'utf8' );
		// An API/worker version mismatch makes pdf.js refuse every document.
		expect( worker ).toContain( '"' + lib.version + '"' );
	} );

	it( 'contains no bare ESM syntax that a classic script cannot execute', () => {
		const bundle = fs.readFileSync( ENTRY, 'utf8' );
		// The browser loads this as a classic <script>, so a top-level export
		// statement or import.meta would be a hard syntax error.
		expect( bundle ).not.toMatch( /(^|[;\n])export[\s{*]/ );
		expect( bundle ).not.toContain( 'import.meta' );
	} );

	it( 'assigns the window.pdfjsLib global when no CommonJS wrapper is present', () => {
		const bundle = fs.readFileSync( ENTRY, 'utf8' );
		// PdfRenderer injects a plain script tag and then reads window.pdfjsLib;
		// the UMD preamble only falls through to that branch when module/exports
		// and AMD define are all absent, which is the case in the page scope.
		expect( bundle ).toContain( 'root["pdfjsLib"] = factory()' );
	} );

	it( 'leaves the worker import unbundled so workerSrc is honoured', () => {
		const bundle = fs.readFileSync( ENTRY, 'utf8' );
		// If webpack inlines this dynamic import, the main-thread fallback
		// loads a stale copy of the worker instead of the vendored one.
		expect( bundle ).toContain( 'import(/* webpackIgnore: true */ this.workerSrc)' );
	} );

	it( 'is not served through ResourceLoader', () => {
		// ResourceLoader pipes module content through JavaScriptMinifier, which is
		// token-based and corrupts this bundle: it loses string-boundary sync and
		// truncates the rest, so load.php returns a script that cannot parse and
		// mw.loader.using() never settles. Keep pdf.js a static asset.
		const extension = JSON.parse(
			fs.readFileSync( path.join( PROJECT_ROOT, 'extension.json' ), 'utf8' )
		);
		const shipped = JSON.stringify( extension.ResourceModules );
		expect( shipped ).not.toContain( 'pdf.min.js' );
	} );

	it( 'pins a cache-busting version matching the pdfjs-dist dependency', () => {
		// Static assets are not versioned by ResourceLoader, so PdfRenderer appends
		// this itself; a stale constant would serve browsers the cached old build.
		const renderer = fs.readFileSync(
			path.join( PROJECT_ROOT, 'resources', 'ext.layers', 'viewer', 'PdfRenderer.js' ),
			'utf8'
		);
		const pinned = /PDFJS_VERSION = '([^']+)'/.exec( renderer );
		expect( pinned ).not.toBeNull();
		expect( pinned[ 1 ] ).toBe( lib.version );
	} );
} );
