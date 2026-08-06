/**
 * Webpack config used only to re-vendor pdf.js into `resources/lib/pdfjs/`.
 *
 * pdf.js stopped shipping a UMD build in 4.0; `pdfjs-dist` is now ESM-only
 * (`legacy/build/pdf.min.mjs`), which a classic `<script>` tag cannot execute.
 * This config wraps the ESM entry point in a UMD shell that assigns a
 * `pdfjsLib` global when loaded as a plain script — exactly the contract the old
 * 3.x UMD build had, and the one `PdfRenderer.js` relies on.
 *
 * The worker is NOT bundled here: pdf.js loads it by URL as a module worker
 * (`new Worker( src, { type: 'module' } )`), so it must stay a standalone ES
 * module. It is copied verbatim by `npm run vendor:pdfjs`.
 *
 * Run via `npm run vendor:pdfjs`; this config is not part of `npm run build`.
 */
const path = require( 'path' );

const outDir = path.resolve( __dirname, '..', 'resources', 'lib', 'pdfjs' );

module.exports = {
	mode: 'production',
	target: [ 'web', 'es2017' ],
	entry: require.resolve( 'pdfjs-dist/legacy/build/pdf.min.mjs' ),
	output: {
		path: outDir,
		filename: 'pdf.min.js',
		library: {
			name: 'pdfjsLib',
			type: 'umd'
		},
		globalObject: 'this'
	},
	optimization: {
		// The upstream file is already minified; re-minifying only risks
		// changing behaviour and makes the diff impossible to audit.
		minimize: false
	},
	module: {
		rules: [
			{
				test: /pdf\.min\.mjs$/,
				use: [ require.resolve( './pdfjs-worker-import-loader.js' ) ]
			}
		]
	},
	performance: {
		// A ~1 MB PDF engine is expected; the size budget lives in
		// bundlesize.config.json, not here.
		hints: false
	}
};
