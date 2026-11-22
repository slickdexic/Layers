( function () {
	'use strict';
	const sha256 = typeof module !== 'undefined' && module.require ?
		module.require( './Sha256.js' ) : window.Layers.Editor.sha256;
	class PageOwnedPdfWorkingSet {
		static surfaceId( pageId, revisionId, fileTitle, label, page ) {
			const key = label.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
			const ascii = JSON.stringify( [ pageId, revisionId, fileTitle, key, page ] )
				.replace( /\//g, '\\/' ).replace( /[\u0080-\uffff]/g, character =>
					'\\u' + character.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) );
			return 'd' + sha256( Uint8Array.from( ascii, character => character.charCodeAt( 0 ) ) ).slice( 0, 24 );
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfWorkingSet = PageOwnedPdfWorkingSet;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedPdfWorkingSet;
	}
}() );
