/**
 * ResourceLoader entry point for the vendored pdf.js UMD build.
 *
 * Re-exports the pdf.js library so callers can obtain it via:
 *   mw.loader.using( 'ext.layers.pdfjs' )
 *     .then( ( require ) => require( 'ext.layers.pdfjs' ) );
 *
 * The vendored pdf.min.js is a webpack UMD bundle: under ResourceLoader's
 * CommonJS packageFiles wrapper it assigns `module.exports = pdfjsLib`, so this
 * one-line re-export is all that is needed. Do not hand-edit pdf.min.js.
 */
module.exports = require( './pdf.min.js' );
