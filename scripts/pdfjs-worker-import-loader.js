/**
 * Webpack loader used only by `scripts/webpack.pdfjs.config.js`.
 *
 * pdf.js falls back to main-thread rendering when a worker cannot be started
 * (strict CSP, blocked worker URL, module-worker unsupported). That fallback is
 * implemented as `await import( this.workerSrc )` — a genuinely dynamic import
 * of a URL that is only known at runtime.
 *
 * Upstream marks it `/* webpackIgnore: true *​/`, but the comment does not
 * survive into the minified `pdf.min.mjs` we vendor. Without it webpack rewrites
 * the call into a context module over `pdfjs-dist/legacy/build/`, which both
 * raises "Critical dependency: the request of a dependency is an expression" and
 * silently breaks the fallback, because the context chunks are never emitted.
 *
 * Re-inserting the comment restores the upstream behaviour exactly: webpack
 * leaves the `import()` alone and the browser resolves it against `workerSrc`.
 *
 * The loader asserts that it matched, so a future pdf.js release that renames or
 * removes the call fails the vendor build loudly instead of regressing silently.
 */
'use strict';

const NEEDLE = 'await import(this.workerSrc)';
const REPLACEMENT = 'await import(/* webpackIgnore: true */ this.workerSrc)';

module.exports = function pdfjsWorkerImportLoader( source ) {
	if ( source.includes( REPLACEMENT ) ) {
		return source;
	}
	if ( !source.includes( NEEDLE ) ) {
		throw new Error(
			'pdfjs-worker-import-loader: could not find "' + NEEDLE + '" in the ' +
			'pdf.js bundle. The main-thread worker fallback has changed upstream; ' +
			're-check scripts/webpack.pdfjs.config.js before re-vendoring.'
		);
	}
	return source.split( NEEDLE ).join( REPLACEMENT );
};
