(function (){
	'use strict';
	if ( typeof window === 'undefined' ) {
		return;
	}

	// Helper for safe MediaWiki logging
	function logWarn( msg ) {
		if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
			mw.log.warn( msg );
		}
	}

	// Soft deprecation warnings for legacy global aliases
	const found = [];
	for ( const key in window ) {
		if ( Object.prototype.hasOwnProperty.call( window, key ) ) {
			if ( key.indexOf( 'layers' ) === 0 && key.charAt(6) === key.charAt(6).toLowerCase() ) {
				// e.g., 'layersModuleRegistry' (camelCased) -> prefer 'LayersModuleRegistry' or 'layersRegistry' canonical name
				const pascal = key.replace( /^layers/, 'Layers' );
				const alt = key.replace( /^layers/, 'layers' );
				if ( window[ pascal ] ) {
					logWarn( '[Layers] Global ' + key + ' is deprecated; prefer ' + pascal + ' instead (migration helpers available).' );
					found.push( key );
				} else if ( window[ alt ] && alt !== key ) {
					logWarn( '[Layers] Global ' + key + ' is deprecated; prefer ' + alt + ' (canonical) instead.' );
					found.push( key );
				}
			}
		}
	}

	if ( found.length && typeof mw !== 'undefined' && mw.log ) {
		// For now, log the total deprecations discovered
		mw.log( '[Layers] Found legacy global exports: ' + found.join( ', ' ) );
	}
}());
