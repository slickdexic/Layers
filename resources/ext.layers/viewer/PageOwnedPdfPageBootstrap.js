/** Inline controls for an untouched page in a page-owned PDF layer set. */
( function () {
	'use strict';
	const MARKERS = 'img.layers-bound-pdf-page';
	const mounted = new WeakMap();
	const unavailable = () => new Error( 'layers-revision-unavailable' );
	const positive = value => Number.isSafeInteger( value ) && value > 0 && value <= 2147483647;
	const ownerKey = value => typeof value === 'string' ? value.replace( /_/gu, ' ' ).replace( /\s+/gu, ' ' ).trim() : '';
	function failureText() {
		return mw.msg( 'layers-page-history-render-failed' );
	}
	function sameOriginUrl( value ) {
		if ( typeof value !== 'string' || !value.trim() ) {
			return null;
		}
		try {
			const url = new URL( value, window.location.href );
			return [ 'http:', 'https:' ].includes( url.protocol ) && url.origin === window.location.origin ? url : null;
		} catch ( error ) {
			return null;
		}
	}
	function editAllowed( bundle, marker, targetPage ) {
		const config = mw.config;
		const location = new URL( window.location.href );
		return typeof bundle.editUrl === 'string' && !!sameOriginUrl( bundle.editUrl ) &&
			!marker.hasAttribute( 'data-layers-noedit' ) && config.get( 'wgAction' ) === 'view' &&
			!location.searchParams.has( 'oldid' ) && !location.searchParams.has( 'diff' ) &&
			!config.get( 'wgDiffOldId' ) && !config.get( 'wgDiffNewId' ) &&
			bundle.revisionId === config.get( 'wgCurRevisionId' ) &&
			bundle.revisionId === config.get( 'wgRevisionId' ) && positive( targetPage );
	}
	function markerData( image, owner, revisionId ) {
		const binding = image.getAttribute( 'data-layers-pdf-anchor' );
		const revision = image.getAttribute( 'data-layers-pdf-revision' );
		const targetText = image.getAttribute( 'data-layers-pdf-page' );
		const targetPage = /^[1-9][0-9]*$/.test( targetText || '' ) ? Number( targetText ) : NaN;
		const match = typeof binding === 'string' && /^v1:([1-9][0-9]*):([A-Za-z0-9_-]{1,64})$/.exec( binding );
		if ( !match || revision !== String( revisionId ) || !positive( targetPage ) ||
			!Number.isSafeInteger( Number( match[ 1 ] ) ) || !owner || !positive( revisionId ) ) {
			throw unavailable();
		}
		return { binding, pageId: Number( match[ 1 ] ), surfaceId: match[ 2 ], targetPage };
	}
	function sameOccurrence( image, record ) {
		return image.isConnected && image.classList.contains( 'layers-bound-pdf-page' ) &&
			image.getAttribute( 'src' ) === record.originalSrc &&
			image.getAttribute( 'srcset' ) === record.originalSrcset &&
			image.getAttribute( 'sizes' ) === record.originalSizes &&
			image.getAttribute( 'data-layers-pdf-anchor' ) === record.originalBinding &&
			image.getAttribute( 'data-layers-pdf-revision' ) === record.originalRevision &&
			image.getAttribute( 'data-layers-pdf-page' ) === record.originalTargetPage;
	}
	function requestBundle( api, owner, revisionId, binding ) {
		return Promise.resolve().then( () => api.get( { action: 'layersread', formatversion: 2,
			owner, revid: revisionId, binding, controls: 1 } ) ).then( response => {
			const bindings = response && response.layersread && response.layersread.bindings;
			if ( !bindings || !Object.prototype.hasOwnProperty.call( bindings, binding ) ) {
				throw unavailable();
			}
			return bindings[ binding ];
		} );
	}
	function editUrlForPage( value, targetPage ) {
		const url = sameOriginUrl( value );
		if ( !url ) {
			return null;
		}
		url.searchParams.set( 'pdfpage', String( targetPage ) );
		return url.href;
	}
	function displayImage( image, display, record ) {
		return new Promise( ( resolve, reject ) => {
			const preload = new window.Image();
			record.preload = preload;
			let settled = false;
			const observer = typeof window.MutationObserver === 'function' ? new window.MutationObserver( mutations => {
				const changed = mutations.some( mutation => {
					if ( mutation.type === 'attributes' ) {
						return mutation.target === image;
					}
					return !image.isConnected || Array.from( mutation.removedNodes ).some( node =>
						node === image || ( typeof node.contains === 'function' && node.contains( image ) ) );
				} );
				if ( changed ) {
					cleanup( image, record );
				}
			} ) : null;
			record.preloadObserver = observer;
			if ( observer ) {
				observer.observe( image.ownerDocument, { subtree: true, childList: true, attributes: true,
					attributeFilter: [ 'src', 'srcset', 'sizes', 'class', 'data-layers-pdf-anchor',
						'data-layers-pdf-revision', 'data-layers-pdf-page' ] } );
			}
			const finish = ( error ) => {
				if ( settled ) {
					return;
				}
				settled = true;
				preload.onload = null;
				preload.onerror = null;
				record.cancelPreload = null;
				if ( record.preloadObserver ) {
					record.preloadObserver.disconnect();
					record.preloadObserver = null;
				}
				if ( error ) {
					reject( error );
				} else {
					resolve();
				}
			};
			record.cancelPreload = () => finish( unavailable() );
			preload.onload = () => {
				if ( record.disposed || !sameOccurrence( image, record ) ) {
					cleanup( image, record );
					return;
				}
				record.display = display;
				record.renditionUrl = display.rendition.url;
				finish();
			};
			preload.onerror = () => finish( unavailable() );
			preload.src = display.rendition.url;
		} );
	}
	function mountOverlay( image, wrapper, bundle, data, api, fields, record ) {
		const Overlay = window.Layers && window.Layers.Viewer && window.Layers.Viewer.Overlay;
		const Adapter = window.Layers && window.Layers.Viewer && window.Layers.Viewer.PageOwnedViewerAdapter;
		const lightbox = window.Layers && window.Layers.lightbox;
		if ( typeof Overlay !== 'function' || typeof Adapter !== 'function' || !lightbox ) {
			throw unavailable();
		}
		const editUrl = editUrlForPage( bundle.editUrl, data.targetPage );
		const overlay = new Overlay( { container: wrapper,
			canEdit: !!editUrl && editAllowed( bundle, image, data.targetPage ),
			onEdit: () => { if ( !record.disposed && editUrl ) { window.location.href = editUrl; } },
			onView: opener => {
				if ( record.disposed ) {
					return;
				}
				record.context = new Adapter( { api, bundle, binding: data.binding, fields, targetPage: data.targetPage } );
				lightbox.open( { filename: bundle.surface.label, pageOwned: record.context, opener } );
				record.lightboxSession = lightbox._sessionToken;
			} } );
		overlay.init();
		record.overlay = overlay;
	}
	function replaceWithError( image, record ) {
		if ( record.disposed || !image.isConnected ) {
			return;
		}
		const message = document.createElement( 'span' );
		message.className = 'layers-page-history-render-error';
		message.textContent = failureText();
		if ( record.wrapper && record.wrapper.parentNode ) {
			record.wrapper.replaceWith( message );
			record.wrapper = null;
		} else {
			image.replaceWith( message );
		}
		record.errorNode = message;
	}
	function cleanup( image, record ) {
		if ( record.disposed ) {
			return;
		}
		record.disposed = true;
		if ( record.preload ) {
			if ( record.cancelPreload ) {
				record.cancelPreload();
			}
			record.preload.onload = null;
			record.preload.onerror = null;
			record.preload.src = '';
			record.preload = null;
		}
		if ( record.preloadObserver ) {
			record.preloadObserver.disconnect();
			record.preloadObserver = null;
		}
		if ( record.overlay ) {
			record.overlay.destroy();
			record.overlay = null;
		}
		if ( record.adapter ) {
			record.adapter.dispose();
			record.adapter = null;
		}
		const lightbox = window.Layers && window.Layers.lightbox;
		if ( record.context && lightbox && lightbox.pageOwned === record.context &&
			lightbox._sessionToken === record.lightboxSession ) {
			lightbox.close( true );
		}
		if ( record.context ) {
			record.context.dispose();
			record.context = null;
		}
		const ownsRenditionSource = record.renditionUrl && image.getAttribute( 'src' ) === record.renditionUrl;
		if ( ownsRenditionSource ) {
			if ( record.originalSrc === null ) {
				image.removeAttribute( 'src' );
			} else {
				image.setAttribute( 'src', record.originalSrc );
			}
		}
		if ( ownsRenditionSource && record.removedSrcset && image.getAttribute( 'srcset' ) === null ) {
			image.setAttribute( 'srcset', record.originalSrcset );
		}
		if ( ownsRenditionSource && record.removedSizes && image.getAttribute( 'sizes' ) === null ) {
			image.setAttribute( 'sizes', record.originalSizes );
		}
		if ( record.originalAspectRatio !== undefined &&
			image.style.getPropertyValue( 'aspect-ratio' ) === record.appliedAspectRatio ) {
			if ( record.originalAspectRatio === '' ) {
				image.style.removeProperty( 'aspect-ratio' );
			} else {
				image.style.setProperty( 'aspect-ratio', record.originalAspectRatio );
			}
		}
		if ( record.appliedHeight !== undefined && image.getAttribute( 'height' ) === record.appliedHeight ) {
			if ( record.originalHeight === null ) {
				image.removeAttribute( 'height' );
			} else {
				image.setAttribute( 'height', record.originalHeight );
			}
		}
		if ( record.wrapper && record.wrapper.contains( image ) ) {
			record.wrapper.replaceWith( image );
		}
		if ( record.errorNode && record.errorNode.parentNode ) {
			record.errorNode.replaceWith( image );
		}
		if ( mounted.get( image ) === record ) {
			mounted.delete( image );
		}
	}
	async function activate( image, api, owner, revisionId, fields, record ) {
		try {
			const data = markerData( image, owner, revisionId );
			record.data = data;
			const bundle = await requestBundle( api, owner, revisionId, data.binding );
			if ( record.disposed ) {
				return;
			}
			if ( !sameOccurrence( image, record ) ) {
				cleanup( image, record );
				return;
			}
			if ( !bundle || ownerKey( bundle.owner ) !== ownerKey( owner ) || bundle.pageId !== data.pageId ||
				bundle.revisionId !== revisionId || !bundle.surface || bundle.surface.id !== data.surfaceId ||
				bundle.surface.kind !== 'pdf' || !bundle.surface.source || bundle.surface.source.page < 1 ||
				!Array.isArray( bundle.surface.layers ) ) {
				throw unavailable();
			}
			const Adapter = window.Layers && window.Layers.Viewer && window.Layers.Viewer.PageOwnedViewerAdapter;
			if ( typeof Adapter !== 'function' ) {
				throw unavailable();
			}
			record.adapter = new Adapter( { api, bundle, binding: data.binding, fields, targetPage: data.targetPage } );
			const viewer = await record.adapter.read();
			if ( record.disposed ) {
				return;
			}
			if ( !sameOccurrence( image, record ) ) {
				cleanup( image, record );
				return;
			}
			if ( viewer.pages.some( entry => entry.page === data.targetPage ) ||
				!viewer.display || viewer.display.page !== data.targetPage ) {
				throw unavailable();
			}
			await displayImage( image, viewer.display, record );
			if ( record.disposed ) {
				return;
			}
			const computed = window.getComputedStyle( image );
			const requestedWidth = Number.parseInt( image.getAttribute( 'width' ), 10 ) ||
				Math.round( image.getBoundingClientRect().width ) || image.naturalWidth || viewer.display.canvas.width;
			const wrapper = document.createElement( 'span' );
			wrapper.className = 'layers-bound-controls';
			wrapper.style.display = 'inline-block';
			wrapper.style.maxWidth = computed.maxWidth || '100%';
			wrapper.style.width = requestedWidth + 'px';
			if ( computed.verticalAlign ) {
				wrapper.style.verticalAlign = computed.verticalAlign;
			}
			record.wrapper = wrapper;
			record.originalAspectRatio = image.style.getPropertyValue( 'aspect-ratio' );
			record.appliedAspectRatio = viewer.display.canvas.width + ' / ' + viewer.display.canvas.height;
			record.originalHeight = image.getAttribute( 'height' );
			record.appliedHeight = String( Math.max( 1, Math.round( requestedWidth *
				viewer.display.canvas.height / viewer.display.canvas.width ) ) );
			image.style.setProperty( 'aspect-ratio', record.appliedAspectRatio );
			image.setAttribute( 'height', record.appliedHeight );
			if ( record.originalSrcset !== null && image.getAttribute( 'srcset' ) === record.originalSrcset ) {
				image.removeAttribute( 'srcset' );
				record.removedSrcset = true;
			}
			if ( record.originalSizes !== null && image.getAttribute( 'sizes' ) === record.originalSizes ) {
				image.removeAttribute( 'sizes' );
				record.removedSizes = true;
			}
			image.setAttribute( 'src', viewer.display.rendition.url );
			image.before( wrapper );
			wrapper.append( image );
			mountOverlay( image, wrapper, bundle, data, api, fields, record );
		} catch ( error ) {
			if ( !record.disposed ) {
				replaceWithError( image, record );
			}
		}
	}
	function load( root, api, owner, revisionId, fields ) {
		const disposers = [];
		if ( !root || !api || typeof api.get !== 'function' || typeof owner !== 'string' || !owner || !positive( revisionId ) ) {
			return Promise.resolve( () => {} );
		}
		root.querySelectorAll( MARKERS ).forEach( image => {
			if ( mounted.has( image ) ) {
				return;
			}
			const record = { disposed: false, originalSrc: image.getAttribute( 'src' ),
				originalSrcset: image.getAttribute( 'srcset' ), originalSizes: image.getAttribute( 'sizes' ),
				originalBinding: image.getAttribute( 'data-layers-pdf-anchor' ),
				originalRevision: image.getAttribute( 'data-layers-pdf-revision' ),
				originalTargetPage: image.getAttribute( 'data-layers-pdf-page' ),
				removedSrcset: false, removedSizes: false, originalAspectRatio: '',
				appliedAspectRatio: undefined, originalHeight: null, appliedHeight: undefined,
				wrapper: null, overlay: null, adapter: null, context: null, preload: null,
				cancelPreload: null, preloadObserver: null, errorNode: null };
			mounted.set( image, record );
			disposers.push( () => cleanup( image, record ) );
			activate( image, api, owner, revisionId, fields, record );
		} );
		return Promise.resolve( () => disposers.forEach( dispose => dispose() ) );
	}
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = load;
		module.exports.load = load;
		module.exports.markerData = markerData;
		module.exports.editUrlForPage = editUrlForPage;
	}
	if ( typeof $ === 'function' && typeof mw !== 'undefined' ) {
		$( () => {
			if ( !document.querySelector( MARKERS ) ) {
				return;
			}
			const disposePromise = load( document, new mw.Api(), mw.config.get( 'wgPageName' ),
				mw.config.get( 'wgRevisionId' ), window.Layers && window.Layers.DrawingFields ?
					window.Layers.DrawingFields.fromConfig( mw.config.get( 'wgLayersDrawingFields' ) ) : {} );
			let disposed = false;
			let dispose = () => {};
			disposePromise.then( cleanupAll => {
				if ( disposed ) {
					cleanupAll();
				} else {
					dispose = cleanupAll;
				}
			} );
			window.addEventListener( 'pagehide', () => { disposed = true; dispose(); }, { once: true } );
			window.addEventListener( 'pageshow', event => {
				if ( event.persisted ) {
					window.location.reload();
				}
			} );
		} );
	}
}() );
