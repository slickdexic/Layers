/**
 * Copies the non-bundled pdf.js vendor assets into `resources/lib/pdfjs/`.
 *
 * Run by `npm run vendor:pdfjs` after `scripts/webpack.pdfjs.config.js` has
 * emitted `pdf.min.js`. Two files are copied verbatim:
 *
 * - `pdf.worker.min.mjs` -> `pdf.worker.min.js`. pdf.js starts the worker with
 *   `new Worker( src, { type: 'module' } )`, so it must stay a standalone ES
 *   module; the rename only exists so web servers serve it with a JavaScript
 *   MIME type.
 * - `LICENSE`, so the vendored copy always carries the licence of the exact
 *   release it came from.
 */
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const pkgRoot = path.dirname( require.resolve( 'pdfjs-dist/package.json' ) );
const outDir = path.resolve( __dirname, '..', 'resources', 'lib', 'pdfjs' );

const copies = [
	[ path.join( pkgRoot, 'legacy', 'build', 'pdf.worker.min.mjs' ), path.join( outDir, 'pdf.worker.min.js' ) ],
	[ path.join( pkgRoot, 'LICENSE' ), path.join( outDir, 'LICENSE' ) ]
];

for ( const [ from, to ] of copies ) {
	if ( !fs.existsSync( from ) ) {
		throw new Error( 'vendor-pdfjs-assets: missing source file ' + from );
	}
	fs.copyFileSync( from, to );
	console.log( 'copied', path.relative( process.cwd(), from ), '->', path.relative( process.cwd(), to ) );
}

const version = require( 'pdfjs-dist/package.json' ).version;
console.log( 'Vendored pdfjs-dist ' + version + '. Update resources/lib/pdfjs/README.md if the version changed.' );
