/** Standalone historical view startup. Never loads the editor or resolves latest content. */
( function () {
	'use strict';
	const HOSTS = '.layers-bound-slide, img.layers-bound-file';
	// Diff pages show the same drawing at two revisions; the server emits these hosts per request.
	const COMPARISON_HOSTS = '.layers-drawing-diff-view';
	const IMAGE_BOX_STYLES = [ 'vertical-align', 'background-color' ].concat(
		...[ 'top', 'right', 'bottom', 'left' ].map( ( side ) => [ 'margin-' + side, 'padding-' + side,
			'border-' + side + '-width', 'border-' + side + '-style', 'border-' + side + '-color' ] ) );
	// {{name}} in drawing text shows the value the page gives through {{#layers_fields:}}.
	const DrawingFields = () => window.Layers.DrawingFields;
	/**
	 * @param {Object} bundle Bound drawing
	 * @param {Object|undefined} fields Plain-text values by name for this drawing
	 * @return {Object} The bundle, or a copy whose text layers show the values; unknown names stay as written
	 */
	function withFields( bundle, fields ) {
		const layers = DrawingFields().fillLayers( bundle.surface.layers, fields );
		return layers === bundle.surface.layers ? bundle :
			Object.assign( {}, bundle, { surface: Object.assign( {}, bundle.surface, { layers } ) } );
	}
	/**
	 * @param {Object|null} config wgLayersDrawingFields
	 * @return {Object} Values by drawing ID and name
	 */
	function fieldsFromConfig( config ) {
		return DrawingFields().fromConfig( config );
	}
	function mount( container, bundle, options ) {
		let view;
		try {
			view = new window.Layers.Viewer.PageOwnedRevisionView( Object.assign( {
				bundle,
				adapter: new window.Layers.Editor.PageOwnedSnapshotAdapter(),
				message: ( ...args ) => mw.msg( ...args ),
				render: ( canvas, surface, failure, source ) => window.Layers.Viewer.renderPageOwnedRevision(
					canvas, surface, failure, window.Layers.LayerRenderer, document.fonts, source )
			}, options ) );
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
	function mountInline( root, bundles, fields ) {
		const disposers = [];
		root.querySelectorAll( HOSTS ).forEach( ( container ) => {
			const binding = container.getAttribute( 'data-layers-binding' );
			if ( !bundles || !Object.prototype.hasOwnProperty.call( bundles, binding ) ) {
				return;
			}
			let bundle = bundles[ binding ];
			if ( !bundle || !bundle.surface ||
				String( bundle.revisionId ) !== container.getAttribute( 'data-layers-revision' ) ) {
				return;
			}
			if ( fields && typeof fields === 'object' &&
				Object.prototype.hasOwnProperty.call( fields, bundle.surface.id ) ) {
				bundle = withFields( bundle, fields[ bundle.surface.id ] );
			}
			const isFile = container.tagName === 'IMG';
			if ( isFile !== ( bundle.surface.kind === 'image' || bundle.surface.kind === 'pdf' ) ) {
				return;
			}
			if ( !isFile ) {
				container.textContent = '';
				disposers.push( mount( container, bundle ) );
				return;
			}
			// Keep core's layout box and link; the canvas replaces the (possibly newer) image version.
			const host = document.createElement( 'span' );
			host.className = 'layers-bound-file-view';
			// The skin styles the image by element and class; the host must take the same box or the page moves.
			const computed = window.getComputedStyle( container );
			IMAGE_BOX_STYLES.forEach( ( name ) => {
				host.style.setProperty( name, computed.getPropertyValue( name ) );
			} );
			host.style.display = 'inline-block';
			host.style.maxWidth = '100%';
			host.style.width = ( parseInt( container.getAttribute( 'width' ), 10 ) || container.width ) + 'px';
			container.replaceWith( host );
			disposers.push( mount( host, bundle, { inline: true, label: container.getAttribute( 'alt' ) || '' } ) );
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
	 * @param {Object} [fields] Page-supplied field values by drawing ID
	 * @return {Promise<Function>} Disposer
	 */
	function loadInline( root, api, owner, revisionId, fields ) {
		const bindings = [];
		root.querySelectorAll( HOSTS ).forEach( ( host ) => {
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
		return Promise.all( requests ).then( ( parts ) => mountInline( root, Object.assign( {}, ...parts ), fields ) );
	}
	/**
	 * Fetch and mount each comparison host's drawing at its own revision.
	 * @param {Document|Element} root
	 * @param {Object} api mw.Api-compatible client
	 * @param {string} owner Displayed page name
	 * @return {Promise<Function>} Disposer
	 */
	function loadComparison( root, api, owner ) {
		const byRevision = new Map();
		root.querySelectorAll( COMPARISON_HOSTS ).forEach( ( host ) => {
			const revision = Number( host.getAttribute( 'data-layers-revision' ) );
			if ( host.getAttribute( 'data-layers-binding' ) && Number.isInteger( revision ) && revision > 0 ) {
				byRevision.set( revision, ( byRevision.get( revision ) || [] ).concat( [ host ] ) );
			}
		} );
		if ( !byRevision.size || typeof owner !== 'string' || !owner ) {
			return Promise.resolve( () => {} );
		}
		const requests = [];
		byRevision.forEach( ( hosts, revision ) => {
			const bindings = Array.from( new Set( hosts.map( ( host ) => host.getAttribute( 'data-layers-binding' ) ) ) );
			requests.push( Promise.resolve( api.get( { action: 'layersread', formatversion: 2, owner,
				revid: revision, binding: bindings.slice( 0, 50 ) } ) ).then( ( response ) => {
				const bundles = ( response && response.layersread && response.layersread.bindings ) || {};
				const disposers = [];
				hosts.forEach( ( host ) => {
					const binding = host.getAttribute( 'data-layers-binding' );
					const bundle = Object.prototype.hasOwnProperty.call( bundles, binding ) ? bundles[ binding ] : null;
					if ( bundle && bundle.surface && bundle.revisionId === revision ) {
						host.textContent = '';
						disposers.push( mount( host, bundle ) );
					}
				} );
				return () => disposers.forEach( ( dispose ) => dispose() );
			} ).catch( () => () => {} ) );
		} );
		return Promise.all( requests ).then( ( disposers ) => () => disposers.forEach( ( dispose ) => dispose() ) );
	}
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = mount;
		module.exports.mountInline = mountInline;
		module.exports.loadInline = loadInline;
		module.exports.loadComparison = loadComparison;
		module.exports.withFields = withFields;
		module.exports.fieldsFromConfig = fieldsFromConfig;
	}
	if ( typeof $ === 'function' && typeof mw !== 'undefined' ) {
		$( () => {
			const container = document.getElementById( 'layers-history-container' );
			if ( !container && !document.querySelector( HOSTS ) && !document.querySelector( COMPARISON_HOSTS ) ) {
				return;
			}
			let dispose = () => {};
			let disposed = false;
			if ( container ) {
				dispose = mount( container, mw.config.get( 'wgLayersRevisionView' ) );
			} else {
				const api = new mw.Api();
				Promise.all( [
					loadInline( document, api, mw.config.get( 'wgPageName' ), mw.config.get( 'wgRevisionId' ),
						fieldsFromConfig( mw.config.get( 'wgLayersDrawingFields' ) ) ),
					loadComparison( document, api, mw.config.get( 'wgPageName' ) )
				] ).then( ( disposers ) => {
					const inlineDispose = () => disposers.forEach( ( part ) => part() );
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
