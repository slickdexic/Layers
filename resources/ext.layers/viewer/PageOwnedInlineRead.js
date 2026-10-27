/** Start the existing authorized read independently of renderer initialization. */
( function () {
	'use strict';
	const HOSTS = '.layers-bound-slide, img.layers-bound-file, .layers-bound-file-view';
	let record = null, closed = false;
	function prepare() {
		if ( closed || typeof mw === 'undefined' || typeof mw.Api !== 'function' ||
			mw.config.get( 'wgAction' ) !== 'view' || document.getElementById( 'layers-history-container' ) ||
			document.querySelector( '.layers-drawing-diff-view' ) ) {
			return;
		}
		const owner = mw.config.get( 'wgPageName' ), revisionId = mw.config.get( 'wgRevisionId' );
		if ( typeof owner !== 'string' || !owner || !Number.isInteger( revisionId ) || revisionId <= 0 ) {
			return;
		}
		const bindings = [];
		document.querySelectorAll( HOSTS ).forEach( host => {
			const binding = host.getAttribute( 'data-layers-binding' );
			if ( binding && host.getAttribute( 'data-layers-revision' ) === String( revisionId ) &&
				!bindings.includes( binding ) ) {
				bindings.push( binding );
			}
		} );
		if ( !bindings.length ) { return; }
		try {
			const api = new mw.Api(), requests = [];
			for ( let i = 0; i < bindings.length; i += 50 ) {
				try {
					requests.push( Promise.resolve( api.get( { action: 'layersread', formatversion: 2, owner,
						revid: revisionId, binding: bindings.slice( i, i + 50 ), controls: 1 } ) )
						.then( response => ( response && response.layersread && response.layersread.bindings ) || {} )
						.catch( () => ( {} ) ) );
				} catch ( error ) { requests.push( Promise.resolve( {} ) ); }
			}
			record = { root: document, owner, revisionId, bindings,
				pending: Promise.all( requests ).then( parts => Object.assign( {}, ...parts ) ) };
		} catch ( error ) { /* The existing bootstrap remains the fallback if preparation is unavailable. */ }
	}
	const reader = {
		take( root, owner, revisionId, bindings ) {
			if ( !record || record.root !== root ) { return null; }
			const captured = record; record = null;
			return !closed && captured.owner === owner && captured.revisionId === revisionId &&
				captured.bindings.length === bindings.length &&
				bindings.every( ( binding, index ) => captured.bindings[ index ] === binding ) ? captured.pending : null;
		}
	};
	window.Layers = window.Layers || {};
	window.Layers.InlineRead = reader;
	window.addEventListener( 'pagehide', () => { closed = true; record = null; }, { once: true } );
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', prepare, { once: true } );
	} else {
		prepare();
	}
}() );
