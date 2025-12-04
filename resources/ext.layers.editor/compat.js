(function (){
	'use strict';
	if ( typeof window === 'undefined' ) {
		return;
	}

	// Soft deprecation warnings for legacy global aliases
	var found = [];
	for ( var key in window ) {
		if ( Object.prototype.hasOwnProperty.call( window, key ) ) {
			if ( key.indexOf( 'layers' ) === 0 && key.charAt(6) === key.charAt(6).toLowerCase() ) {
				// e.g., 'layersModuleRegistry' (camelCased) -> prefer 'LayersModuleRegistry' or 'layersRegistry' canonical name
				var pascal = key.replace( /^layers/, 'Layers' );
				var alt = key.replace( /^layers/, 'layers' );
				if ( window[ pascal ] ) {
					console.warn( '[Layers] Global ' + key + ' is deprecated; prefer ' + pascal + ' instead (migration helpers available).' );
					found.push( key );
				} else if ( window[ alt ] && alt !== key ) {
					console.warn( '[Layers] Global ' + key + ' is deprecated; prefer ' + alt + ' (canonical) instead.' );
					found.push( key );
				}
			}
		}
	}

	if ( found.length ) {
		// For now, log the total deprecations discovered
		console.info( '[Layers] Found legacy global exports: ' + found.join( ', ' ) );
	}
}());
