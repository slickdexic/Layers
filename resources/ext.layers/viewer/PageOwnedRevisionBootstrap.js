/** Standalone historical view startup. Never loads the editor or resolves latest content. */
( function () {
	'use strict';
	const HOSTS = '.layers-bound-slide, img.layers-bound-file, .layers-bound-file-view';
	const mounted = new WeakMap();
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
	function mountControls( container, bundle, binding, fields, api, diff = false ) {
		const Overlay = window.Layers.Viewer.Overlay;
		const Adapter = window.Layers.Viewer.PageOwnedViewerAdapter;
		const lightbox = window.Layers.lightbox;
		if ( typeof Overlay !== 'function' || typeof Adapter !== 'function' || !lightbox ||
			!Number.isInteger( bundle.pageId ) || binding !== 'v1:' + bundle.pageId + ':' + bundle.surface.id ) {
			return () => {};
		}
		let context;
		let disposed = false;
		container.classList.add( 'layers-bound-controls' );
		const config = mw.config;
		const canEdit = !diff && typeof bundle.editUrl === 'string' && bundle.editUrl.trim().length > 0 &&
			!container.hasAttribute( 'data-layers-noedit' ) && config.get( 'wgAction' ) === 'view' &&
			!new URL( window.location.href ).searchParams.has( 'oldid' ) &&
			!new URL( window.location.href ).searchParams.has( 'diff' ) &&
			!config.get( 'wgDiffOldId' ) && !config.get( 'wgDiffNewId' ) &&
			bundle.revisionId === config.get( 'wgCurRevisionId' ) &&
			bundle.revisionId === config.get( 'wgRevisionId' );
		const overlay = new Overlay( { container, canEdit,
			onEdit: () => { window.location.href = bundle.editUrl; },
			onView: ( opener ) => {
				if ( disposed ) {
					return;
				}
				context = new Adapter( { api: api || new mw.Api(), bundle, binding, fields } );
				lightbox.open( { filename: bundle.surface.label, pageOwned: context, opener } );
			} } );
		overlay.init();
		return () => {
			disposed = true;
			overlay.destroy();
			container.classList.remove( 'layers-bound-controls' );
			if ( context && lightbox.pageOwned === context ) {
				lightbox.close( true );
			}
		};
	}
	function mountInline( root, bundles, fields, api ) {
		const disposers = [];
		root.querySelectorAll( HOSTS ).forEach( ( container ) => {
			if ( mounted.has( container ) ) {
				return;
			}
			const binding = container.getAttribute( 'data-layers-binding' );
			if ( !bundles || !Object.prototype.hasOwnProperty.call( bundles, binding ) ) {
				return;
			}
			let bundle = bundles[ binding ];
			if ( !bundle || !bundle.surface ||
				String( bundle.revisionId ) !== container.getAttribute( 'data-layers-revision' ) ) {
				return;
			}
			const admitted = bundle;
			if ( fields && typeof fields === 'object' &&
				Object.prototype.hasOwnProperty.call( fields, bundle.surface.id ) ) {
				bundle = withFields( bundle, fields[ bundle.surface.id ] );
			}
			const isFile = container.tagName === 'IMG' || container.classList.contains( 'layers-bound-file-view' );
			if ( isFile !== ( bundle.surface.kind === 'image' || bundle.surface.kind === 'pdf' ) ) {
				return;
			}
			if ( !isFile ) {
				container.textContent = '';
				const viewDispose = mount( container, bundle );
				const controlsDispose = mountControls( container, admitted, binding, fields, api );
				const dispose = () => {
					if ( mounted.get( container ) === dispose ) {
						controlsDispose(); viewDispose(); mounted.delete( container );
					}
				};
				mounted.set( container, dispose );
				disposers.push( dispose );
				return;
			}
			// Keep core's layout box and link; the canvas replaces the (possibly newer) image version.
			const host = container.tagName === 'IMG' ? document.createElement( 'span' ) : container;
			host.className = 'layers-bound-file-view';
			host.setAttribute( 'data-layers-binding', binding );
			host.setAttribute( 'data-layers-revision', String( bundle.revisionId ) );
			if ( container.hasAttribute( 'data-layers-noedit' ) ) {
				host.setAttribute( 'data-layers-noedit', '1' );
			}
			// The skin styles the image by element and class; the host must take the same box or the page moves.
			const computed = window.getComputedStyle( container );
			IMAGE_BOX_STYLES.forEach( ( name ) => {
				host.style.setProperty( name, computed.getPropertyValue( name ) );
			} );
			host.style.display = 'inline-block';
			host.style.maxWidth = '100%';
			host.style.width = ( parseInt( container.getAttribute( 'width' ), 10 ) || container.width ||
				parseFloat( container.style.width ) ) + 'px';
			const label = container.getAttribute( 'alt' ) || container.getAttribute( 'data-layers-label' ) || '';
			host.setAttribute( 'data-layers-label', label );
			if ( container !== host ) {
				container.replaceWith( host );
			}
			const viewDispose = mount( host, bundle, { inline: true, label } );
			const controlsDispose = mountControls( host, admitted, binding, fields, api );
			const dispose = () => {
				if ( mounted.get( host ) === dispose ) {
					controlsDispose(); viewDispose(); mounted.delete( host );
				}
			};
			mounted.set( host, dispose );
			disposers.push( dispose );
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
				revid: revisionId, binding: bindings.slice( i, i + 50 ), controls: 1 } ) )
				.then( ( response ) => ( response && response.layersread && response.layersread.bindings ) || {} )
				.catch( () => ( {} ) ) );
		}
		return Promise.all( requests ).then( ( parts ) => mountInline( root, Object.assign( {}, ...parts ), fields, api ) );
	}
	/**
	 * Fetch and mount each comparison host's drawing at its own revision.
	 * @param {Document|Element} root
	 * @param {Object} api mw.Api-compatible client
	 * @param {string} owner Displayed page name
	 * @return {Promise<Function>} Disposer
	 */
	function loadComparison( root, api, owner, fieldsByRevision = {} ) {
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
						if ( mounted.has( host ) ) {
							return;
						}
						host.textContent = '';
						const fields = fieldsByRevision[ revision ] || {};
						const viewDispose = mount( host, withFields( bundle, fields[ bundle.surface.id ] ) );
						const controlsDispose = mountControls( host, bundle, binding, fields, api, true );
						const dispose = () => {
							if ( mounted.get( host ) === dispose ) {
								controlsDispose(); viewDispose(); mounted.delete( host );
							}
						};
						mounted.set( host, dispose );
						disposers.push( dispose );
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
		module.exports.mountControls = mountControls;
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
				const bundle = mw.config.get( 'wgLayersRevisionView' );
				const fields = fieldsFromConfig( mw.config.get( 'wgLayersDrawingFields' ) );
				const viewDispose = mount( container, bundle && withFields( bundle, fields[ bundle.surface.id ] ) );
				const controlsDispose = bundle ? mountControls( container, bundle,
					'v1:' + bundle.pageId + ':' + bundle.surface.id, fields, new mw.Api(), true ) : () => {};
				dispose = () => { controlsDispose(); viewDispose(); };
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
