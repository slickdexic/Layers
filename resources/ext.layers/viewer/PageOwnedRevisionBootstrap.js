/** Standalone historical view startup. Never loads the editor or resolves latest content. */
( function () {
	'use strict';
	function mount( container, bundle ) {
		let view;
		try {
			view = new window.Layers.Viewer.PageOwnedRevisionView( {
				bundle,
				adapter: new window.Layers.Editor.PageOwnedSnapshotAdapter(),
				message: ( ...args ) => mw.msg( ...args ),
				render: ( canvas, surface, failure ) => window.Layers.Viewer.renderPageOwnedRevision(
					canvas, surface, failure, window.Layers.LayerRenderer, document.fonts )
			} );
			view.mount( container );
		} catch ( error ) {
			if ( view ) {
				view.dispose();
			}
			container.textContent = mw.msg( 'layers-page-history-render-failed' );
		}
		return () => {
			if ( view ) {
				view.dispose();
			}
		};
	}
	function mountInline( root, bundles ) {
		const disposers = [];
		root.querySelectorAll( '.layers-bound-slide' ).forEach( ( container ) => {
			const binding = container.getAttribute( 'data-layers-binding' );
			if ( !bundles || !Object.prototype.hasOwnProperty.call( bundles, binding ) ) {
				return;
			}
			const bundle = bundles[ binding ];
			if ( !bundle || String( bundle.revisionId ) !== container.getAttribute( 'data-layers-revision' ) ) {
				return;
			}
			container.textContent = '';
			disposers.push( mount( container, bundle ) );
		} );
		return () => disposers.forEach( ( dispose ) => dispose() );
	}
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = mount;
		module.exports.mountInline = mountInline;
	}
	if ( typeof $ === 'function' && typeof mw !== 'undefined' ) {
		$( () => {
			const container = document.getElementById( 'layers-history-container' );
			if ( !container && !document.querySelector( '.layers-bound-slide' ) ) {
				return;
			}
			const dispose = container ? mount( container, mw.config.get( 'wgLayersRevisionView' ) ) :
				mountInline( document, mw.config.get( 'wgLayersBoundSlides' ) );
			window.addEventListener( 'pagehide', dispose, { once: true } );
			window.addEventListener( 'pageshow', ( event ) => {
				if ( event.persisted ) {
					// Reauthorize this exact URL after back/forward cache restoration.
					window.location.reload();
				}
			} );
		} );
	}
}() );
