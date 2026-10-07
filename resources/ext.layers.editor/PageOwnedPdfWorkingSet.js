( function () {
	'use strict';
	const ROUND = [
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
	];
	const rotate = ( value, bits ) => ( value >>> bits ) | ( value << ( 32 - bits ) );
	function sha256( ascii ) {
		const bytes = new Uint8Array( Math.ceil( ( ascii.length + 9 ) / 64 ) * 64 );
		for ( let index = 0; index < ascii.length; index++ ) {
			bytes[ index ] = ascii.charCodeAt( index );
		}
		bytes[ ascii.length ] = 128;
		const view = new DataView( bytes.buffer );
		view.setUint32( bytes.length - 4, ascii.length * 8 );
		const hash = [ 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
			0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19 ];
		for ( let offset = 0; offset < bytes.length; offset += 64 ) {
			const words = new Uint32Array( 64 );
			for ( let index = 0; index < 16; index++ ) {
				words[ index ] = view.getUint32( offset + index * 4 );
			}
			for ( let index = 16; index < 64; index++ ) {
				const left = words[ index - 15 ], right = words[ index - 2 ];
				words[ index ] = words[ index - 16 ] + ( rotate( left, 7 ) ^ rotate( left, 18 ) ^ ( left >>> 3 ) ) +
					words[ index - 7 ] + ( rotate( right, 17 ) ^ rotate( right, 19 ) ^ ( right >>> 10 ) );
			}
			const work = hash.slice();
			for ( let round = 0; round < 64; round++ ) {
				const first = work[ 7 ] + ( rotate( work[ 4 ], 6 ) ^ rotate( work[ 4 ], 11 ) ^ rotate( work[ 4 ], 25 ) ) +
					( ( work[ 4 ] & work[ 5 ] ) ^ ( ~work[ 4 ] & work[ 6 ] ) ) + ROUND[ round ] + words[ round ];
				const second = ( rotate( work[ 0 ], 2 ) ^ rotate( work[ 0 ], 13 ) ^ rotate( work[ 0 ], 22 ) ) +
					( ( work[ 0 ] & work[ 1 ] ) ^ ( work[ 0 ] & work[ 2 ] ) ^ ( work[ 1 ] & work[ 2 ] ) );
				work[ 3 ] = ( work[ 3 ] + first ) >>> 0;
				work.pop();
				work.unshift( ( first + second ) >>> 0 );
			}
			for ( let index = 0; index < 8; index++ ) {
				hash[ index ] = ( hash[ index ] + work[ index ] ) >>> 0;
			}
		}
		return hash.map( value => value.toString( 16 ).padStart( 8, '0' ) ).join( '' );
	}
	class PageOwnedPdfWorkingSet {
		static surfaceId( pageId, revisionId, fileTitle, label, page ) {
			const key = label.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
			const ascii = JSON.stringify( [ pageId, revisionId, fileTitle, key, page ] )
				.replace( /\//g, '\\/' ).replace( /[\u0080-\uffff]/g, character =>
					'\\u' + character.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) );
			return 'd' + sha256( ascii ).slice( 0, 24 );
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfWorkingSet = PageOwnedPdfWorkingSet;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedPdfWorkingSet;
	}
}() );