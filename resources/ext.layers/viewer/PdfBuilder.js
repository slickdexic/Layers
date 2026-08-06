/**
 * PdfBuilder - assemble a multi-page PDF from pre-encoded JPEG page images.
 *
 * The lightbox needs a downloadable PDF that matches what the Print button
 * produces, which means it must be built from pages composited by the shared
 * JavaScript renderer. The server-side export cannot be used for this: it draws
 * layers with ImageMagick primitives and silently omits every layer type that
 * has no primitive equivalent (custom shapes, emoji, image layers, gradients,
 * rich text), so its output can differ from what the user actually annotated.
 *
 * Writing the container here avoids adding a PDF library to the bundle. Only
 * the small subset of PDF 1.4 needed for "one full-bleed image per page" is
 * emitted, and JPEG data is embedded verbatim through /DCTDecode so no
 * compression code is required.
 *
 * @class PdfBuilder
 */
( function () {
	'use strict';

	/**
	 * Pages are laid out at this resolution, matching the server-side export's
	 * ImageMagick `-density 150`.
	 *
	 * @type {number}
	 */
	const RENDER_DPI = 150;

	const POINTS_PER_PIXEL = 72 / RENDER_DPI;

	/**
	 * Convert a Latin-1 string to bytes. PDF syntax is ASCII, so this is only
	 * ever used on generated markup, never on the embedded image data.
	 *
	 * @param {string} str Source string
	 * @return {Uint8Array} Byte view
	 */
	function toBytes( str ) {
		const bytes = new Uint8Array( str.length );
		for ( let i = 0; i < str.length; i++ ) {
			bytes[ i ] = str.charCodeAt( i ) & 0xff;
		}
		return bytes;
	}

	/**
	 * Left-pad an xref offset to the fixed 10-digit field the format requires.
	 *
	 * @param {number} value Byte offset
	 * @return {string} Zero-padded decimal
	 */
	function pad10( value ) {
		let str = String( value );
		while ( str.length < 10 ) {
			str = '0' + str;
		}
		return str;
	}

	class PdfBuilder {
		/**
		 * Decode a `data:image/jpeg;base64,...` URL into raw JPEG bytes.
		 *
		 * @param {string} dataUrl Data URL produced by canvas.toDataURL
		 * @return {Uint8Array|null} JPEG bytes, or null if the URL is not
		 *   base64 JPEG
		 */
		static decodeJpegDataUrl( dataUrl ) {
			const match = /^data:image\/jpeg;base64,(.*)$/.exec( String( dataUrl || '' ) );
			if ( !match ) {
				return null;
			}
			try {
				return toBytes( atob( match[ 1 ] ) );
			} catch ( e ) {
				return null;
			}
		}

		/**
		 * Build a PDF in which each page is a single full-bleed JPEG.
		 *
		 * @param {Array<Object>} pages Ordered pages, each
		 *   `{ data: Uint8Array, width: number, height: number }` in pixels
		 * @return {Blob|null} PDF blob, or null if there is nothing to write
		 */
		static build( pages ) {
			if ( !Array.isArray( pages ) || pages.length === 0 ) {
				return null;
			}

			const chunks = [];
			let length = 0;
			const offsets = [ 0 ];
			const push = ( chunk ) => {
				const bytes = typeof chunk === 'string' ? toBytes( chunk ) : chunk;
				chunks.push( bytes );
				length += bytes.length;
			};

			// A binary comment marks the file as non-ASCII for transfer tools.
			push( '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n' );

			offsets[ 1 ] = length;
			push( '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' );

			const kids = pages
				.map( ( page, index ) => ( 3 + index * 3 ) + ' 0 R' )
				.join( ' ' );
			offsets[ 2 ] = length;
			push(
				'2 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' +
				pages.length + ' >>\nendobj\n'
			);

			pages.forEach( ( page, index ) => {
				const pageObj = 3 + index * 3;
				const contentObj = pageObj + 1;
				const imageObj = pageObj + 2;
				const width = ( page.width * POINTS_PER_PIXEL ).toFixed( 2 );
				const height = ( page.height * POINTS_PER_PIXEL ).toFixed( 2 );

				offsets[ pageObj ] = length;
				push(
					pageObj + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
					width + ' ' + height + '] /Resources << /XObject << /Im0 ' +
					imageObj + ' 0 R >> >> /Contents ' + contentObj + ' 0 R >>\nendobj\n'
				);

				const content = 'q\n' + width + ' 0 0 ' + height + ' 0 0 cm\n/Im0 Do\nQ\n';
				offsets[ contentObj ] = length;
				push(
					contentObj + ' 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' +
					content + 'endstream\nendobj\n'
				);

				offsets[ imageObj ] = length;
				push(
					imageObj + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' +
					page.width + ' /Height ' + page.height +
					' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode' +
					' /Length ' + page.data.length + ' >>\nstream\n'
				);
				push( page.data );
				push( '\nendstream\nendobj\n' );
			} );

			const objectCount = 2 + pages.length * 3;
			const xrefOffset = length;
			let xref = 'xref\n0 ' + ( objectCount + 1 ) + '\n0000000000 65535 f \n';
			for ( let i = 1; i <= objectCount; i++ ) {
				xref += pad10( offsets[ i ] ) + ' 00000 n \n';
			}
			push( xref );
			push(
				'trailer\n<< /Size ' + ( objectCount + 1 ) +
				' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n'
			);

			return new Blob( chunks, { type: 'application/pdf' } );
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Viewer = window.Layers.Viewer || {};
	window.Layers.Viewer.PdfBuilder = PdfBuilder;

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PdfBuilder;
	}
}() );
