/**
 * Tests for PdfBuilder.
 *
 * The output is checked against the PDF 1.4 structure rather than a snapshot,
 * because a malformed xref table still produces a plausible-looking file that
 * only fails when a real viewer opens it.
 */
'use strict';

const path = require( 'path' );

const PdfBuilder = require(
	path.join( __dirname, '../../resources/ext.layers/viewer/PdfBuilder.js' )
);

/**
 * Read a Blob built by PdfBuilder back into a Latin-1 string.
 *
 * @param {Blob} blob Blob to read
 * @return {Promise<string>} Blob contents
 */
async function readBlob( blob ) {
	const buffer = await new Promise( ( resolve, reject ) => {
		const reader = new FileReader();
		reader.onload = () => resolve( reader.result );
		reader.onerror = reject;
		reader.readAsArrayBuffer( blob );
	} );
	const bytes = new Uint8Array( buffer );
	let out = '';
	for ( let i = 0; i < bytes.length; i++ ) {
		out += String.fromCharCode( bytes[ i ] );
	}
	return out;
}

const JPEG = new Uint8Array( [ 0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9 ] );

describe( 'PdfBuilder', () => {
	describe( 'decodeJpegDataUrl', () => {
		it( 'decodes a base64 JPEG data URL to bytes', () => {
			const dataUrl = 'data:image/jpeg;base64,' +
				Buffer.from( JPEG ).toString( 'base64' );

			expect( Array.from( PdfBuilder.decodeJpegDataUrl( dataUrl ) ) )
				.toEqual( Array.from( JPEG ) );
		} );

		it( 'returns null for a PNG data URL', () => {
			expect( PdfBuilder.decodeJpegDataUrl( 'data:image/png;base64,AAAA' ) )
				.toBeNull();
		} );

		it( 'returns null for junk input', () => {
			expect( PdfBuilder.decodeJpegDataUrl( 'not a data url' ) ).toBeNull();
			expect( PdfBuilder.decodeJpegDataUrl( null ) ).toBeNull();
		} );

		it( 'returns null when the payload is not valid base64', () => {
			expect( PdfBuilder.decodeJpegDataUrl( 'data:image/jpeg;base64,!!!!' ) )
				.toBeNull();
		} );
	} );

	describe( 'build', () => {
		it( 'returns null when there are no pages', () => {
			expect( PdfBuilder.build( [] ) ).toBeNull();
			expect( PdfBuilder.build( null ) ).toBeNull();
		} );

		it( 'produces a PDF blob', () => {
			const blob = PdfBuilder.build( [
				{ data: JPEG, width: 100, height: 200 }
			] );

			expect( blob.type ).toBe( 'application/pdf' );
			expect( blob.size ).toBeGreaterThan( 0 );
		} );

		it( 'writes one page object per image', async () => {
			const blob = PdfBuilder.build( [
				{ data: JPEG, width: 100, height: 200 },
				{ data: JPEG, width: 300, height: 400 }
			] );
			const pdf = await readBlob( blob );

			expect( pdf.startsWith( '%PDF-1.4' ) ).toBe( true );
			expect( pdf.trimEnd().endsWith( '%%EOF' ) ).toBe( true );
			expect( pdf ).toContain( '/Count 2' );
			expect( ( pdf.match( /\/Type \/Page[^s]/g ) || [] ).length ).toBe( 2 );
			expect( ( pdf.match( /\/DCTDecode/g ) || [] ).length ).toBe( 2 );
			expect( pdf ).toContain( '/Kids [3 0 R 6 0 R]' );
		} );

		it( 'sizes the media box at 150 dpi', async () => {
			// 150px at 150 dpi is one inch, i.e. 72 PDF points.
			const pdf = await readBlob( PdfBuilder.build( [
				{ data: JPEG, width: 150, height: 300 }
			] ) );

			expect( pdf ).toContain( '/MediaBox [0 0 72.00 144.00]' );
			expect( pdf ).toContain( '72.00 0 0 144.00 0 0 cm' );
		} );

		it( 'writes an xref entry per object at the true byte offset', async () => {
			const pdf = await readBlob( PdfBuilder.build( [
				{ data: JPEG, width: 10, height: 10 },
				{ data: JPEG, width: 10, height: 10 }
			] ) );

			// 2 structural objects + 3 per page.
			const objectCount = 2 + 2 * 3;
			const xrefIndex = pdf.lastIndexOf( 'xref\n0 ' );
			expect( pdf ).toContain( 'xref\n0 ' + ( objectCount + 1 ) + '\n' );
			expect( pdf ).toContain( '/Size ' + ( objectCount + 1 ) );

			// startxref must point at the xref table itself.
			const startxref = /startxref\n(\d+)\n/.exec( pdf );
			expect( Number( startxref[ 1 ] ) ).toBe( xrefIndex );

			// Every offset must land on the matching "N 0 obj" header.
			const entries = pdf
				.slice( xrefIndex )
				.match( /^(\d{10}) 00000 n $/gm );
			expect( entries ).toHaveLength( objectCount );
			entries.forEach( ( entry, index ) => {
				const offset = Number( entry.slice( 0, 10 ) );
				expect( pdf.startsWith( ( index + 1 ) + ' 0 obj', offset ) ).toBe( true );
			} );
		} );

		it( 'embeds the image bytes verbatim', async () => {
			const pdf = await readBlob( PdfBuilder.build( [
				{ data: JPEG, width: 10, height: 10 }
			] ) );

			expect( pdf ).toContain( '/Length ' + JPEG.length );
			let raw = '';
			for ( let i = 0; i < JPEG.length; i++ ) {
				raw += String.fromCharCode( JPEG[ i ] );
			}
			expect( pdf ).toContain( raw );
		} );
	} );

	describe( 'namespace', () => {
		it( 'exposes the class on window.Layers.Viewer', () => {
			expect( window.Layers.Viewer.PdfBuilder ).toBe( PdfBuilder );
		} );
	} );
} );
