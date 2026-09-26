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
				render: ( canvas, surface, failure, source ) => window.Layers.Viewer.renderPageOwnedRevision(
					canvas, surface, failure, window.Layers.LayerRenderer, document.fonts, source )
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
	/**
	 * Fetch this reader's authorized drawings for the displayed revision, then mount them.
	 * Page HTML holds only binding identities, so it stays cacheable for every reader.
	 * @param {Document|Element} root
	 * @param {Object} api mw.Api-compatible client
	 * @param {string} owner Displayed page name
	 * @param {number} revisionId Displayed revision; placeholders from other revisions stay unavailable
	 * @return {Promise<Function>} Disposer
	 */
	function loadInline( root, api, owner, revisionId ) {
		const bindings = [];
		root.querySelectorAll( '.layers-bound-slide' ).forEach( ( host ) => {
			const binding = host.getAttribute( 'data-layers-binding' );
			if ( binding && host.getAttribute( 'data-layers-revision' ) === String( revisionId ) &&
				!bindings.includes( binding ) ) {
				bindings.push( binding );
			}
		} );
		if ( !bindings.length || typeof owner !== 'string' || !owner || !Number.isInteger( revisionId ) ) {
			return Promise.resolve( () => {} );
		}
		const requests = [];
		for ( let i = 0; i < bindings.length; i += 50 ) {
			requests.push( Promise.resolve( api.get( { action: 'layersread', formatversion: 2, owner,
				revid: revisionId, binding: bindings.slice( i, i + 50 ) } ) )
				.then( ( response ) => ( response && response.layersread && response.layersread.bindings ) || {} )
				.catch( () => ( {} ) ) );
		}
		return Promise.all( requests ).then( ( parts ) => mountInline( root, Object.assign( {}, ...parts ) ) );
	}
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = mount;
		module.exports.mountInline = mountInline;
		module.exports.loadInline = loadInline;
	}
	if ( typeof $ === 'function' && typeof mw !== 'undefined' ) {
		$( () => {
			const container = document.getElementById( 'layers-history-container' );
			if ( !container && !document.querySelector( '.layers-bound-slide' ) ) {
				return;
			}
			let dispose = () => {};
			let disposed = false;
			if ( container ) {
				dispose = mount( container, mw.config.get( 'wgLayersRevisionView' ) );
			} else {
				loadInline( document, new mw.Api(), mw.config.get( 'wgPageName' ),
					mw.config.get( 'wgRevisionId' ) ).then( ( inlineDispose ) => {
					if ( disposed ) {
						inlineDispose();
					} else {
						dispose = inlineDispose;
					}
				} );
			}
			window.addEventListener( 'pagehide', () => {
				disposed = true;
				dispose();
			}, { once: true } );
			window.addEventListener( 'pageshow', ( event ) => {
				if ( event.persisted ) {
					// Reauthorize this exact URL after back/forward cache restoration.
					window.location.reload();
				}
			} );
		} );
	}
}() );
