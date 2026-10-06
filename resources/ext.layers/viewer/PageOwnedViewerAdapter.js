( function () {
	'use strict';

	class PageOwnedViewerAdapter {
		constructor( options ) {
			this.api = options.api;
			this.bundle = options.bundle;
			this.binding = options.binding;
			this.fields = JSON.parse( JSON.stringify( options.fields || {} ) );
			this.pdfRenderer = options.pdfRenderer || null;
			this.disposed = false;
		}

		unavailable() {
			return new Error( 'layers-revision-unavailable' );
		}

		read() {
			const bundle = this.bundle;
			return Promise.resolve().then( () => this.api.get( {
				action: 'layersread', formatversion: 2, owner: bundle.owner,
				revid: bundle.revisionId, binding: this.binding, viewer: 1
			} ) ).then( ( response ) => {
				if ( this.disposed ) {
					throw this.unavailable();
				}
				return this.validate( response && response.layersread && response.layersread.viewer );
			} );
		}

		validate( viewer ) {
			const bundle = this.bundle;
			const anchor = bundle.surface;
			if ( !viewer || viewer.owner !== bundle.owner || viewer.pageId !== bundle.pageId ||
				viewer.revisionId !== bundle.revisionId || viewer.binding !== this.binding ||
				viewer.kind !== anchor.kind || viewer.label !== anchor.label ||
				!Number.isInteger( viewer.pageCount ) || viewer.pageCount < 1 ||
				viewer.initialPage !== ( anchor.kind === 'pdf' ? anchor.source.page : 1 ) ||
				viewer.initialPage > viewer.pageCount || !Array.isArray( viewer.pages ) || !viewer.pages.length ) {
				throw this.unavailable();
			}
			if ( anchor.kind === 'pdf' ) {
				if ( !viewer.source || viewer.source.exactVersion !== true ||
					typeof viewer.source.url !== 'string' || !/^\/(?!\/)/.test( viewer.source.url ) ||
					new URL( viewer.source.url, window.location.href ).origin !== window.location.origin ) {
					throw this.unavailable();
				}
			} else if ( viewer.pageCount !== 1 || viewer.pages.length !== 1 ||
				( anchor.kind === 'slide' ? viewer.source !== null :
					!viewer.source || typeof viewer.source.url !== 'string' ||
					!( viewer.source.width > 0 && viewer.source.height > 0 ) ) ) {
				throw this.unavailable();
			}
			let previous = 0;
			const nameKey = ( name ) => name.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
			const ids = new Set();
			let selected = false;
			for ( const entry of viewer.pages ) {
				const surface = entry && entry.surface;
				if ( !entry || !Number.isInteger( entry.page ) || entry.page <= previous ||
					entry.page > viewer.pageCount || !surface || surface.kind !== anchor.kind ||
					!surface.canvas || !Number.isFinite( surface.canvas.width ) || !Number.isFinite( surface.canvas.height ) ||
					!( surface.canvas.width > 0 && surface.canvas.height > 0 ) || typeof surface.label !== 'string' ||
					!Array.isArray( surface.layers ) || typeof surface.id !== 'string' || ids.has( surface.id ) ) {
					throw this.unavailable();
				}
				if ( anchor.kind === 'pdf' && ( !surface.source || surface.source.page !== entry.page ||
					[ 'fileTitle', 'repository', 'timestamp', 'sha1' ].some( ( key ) =>
						surface.source[ key ] !== anchor.source[ key ] ) ||
					nameKey( surface.label ) !== nameKey( anchor.label ) ) ) {
					throw this.unavailable();
				}
				if ( surface.id === anchor.id ) {
					if ( entry.page !== viewer.initialPage || JSON.stringify( surface ) !== JSON.stringify( anchor ) ) {
						throw this.unavailable();
					}
					selected = true;
				}
				previous = entry.page;
				ids.add( surface.id );
			}
			if ( !selected ) {
				throw this.unavailable();
			}
			return viewer;
		}

		async loadPage( viewer, page, targetWidth = 1600 ) {
			if ( this.disposed || !Number.isInteger( page ) || page < 1 || page > viewer.pageCount ) {
				throw this.unavailable();
			}
			const entry = viewer.pages.find( ( member ) => member.page === page );
			const surface = entry && entry.surface;
			let imageUrl;
			let dimensions;
			if ( viewer.kind === 'pdf' ) {
				if ( !this.pdfRenderer ) {
					const Renderer = window.Layers.Viewer.PdfRenderer;
					if ( typeof Renderer !== 'function' ) {
						throw this.unavailable();
					}
					this.pdfRenderer = new Renderer();
				}
				const result = await this.pdfRenderer.renderPage( viewer.source.url, page,
					{ exactVersion: true, targetWidth, expectedPageCount: viewer.pageCount,
						isCurrent: () => !this.disposed } );
				if ( !result || result.pageCount !== viewer.pageCount ||
					!( result.width > 0 && result.height > 0 ) ||
					typeof result.dataUrl !== 'string' || !result.dataUrl.startsWith( 'data:image/png;base64,' ) ) {
					throw this.unavailable();
				}
				imageUrl = result.dataUrl;
				dimensions = { width: result.width, height: result.height };
			} else if ( viewer.kind === 'image' ) {
				imageUrl = viewer.source.url;
				dimensions = viewer.source;
			} else {
				const canvas = document.createElement( 'canvas' );
				canvas.width = surface.canvas.width;
				canvas.height = surface.canvas.height;
				try {
					const context = canvas.getContext( '2d' );
					context.fillStyle = surface.canvas.backgroundColor || '#ffffff';
					context.fillRect( 0, 0, canvas.width, canvas.height );
					imageUrl = canvas.toDataURL( 'image/png' );
				} finally {
					canvas.width = 0;
					canvas.height = 0;
				}
				dimensions = surface.canvas;
			}
			if ( this.disposed ) {
				throw this.unavailable();
			}
			const canvas = surface ? surface.canvas : dimensions;
			const layers = surface ? window.Layers.DrawingFields.fillLayers(
				JSON.parse( JSON.stringify( surface.layers ) ), this.fields[ surface.id ] ) : [];
			return { imageUrl, layerData: Object.assign( {}, canvas, {
				baseWidth: canvas.width, baseHeight: canvas.height, layers
			} ) };
		}

		dispose() {
			this.disposed = true;
			if ( this.pdfRenderer ) {
				this.pdfRenderer.destroy();
				this.pdfRenderer = null;
			}
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Viewer = window.Layers.Viewer || {};
	window.Layers.Viewer.PageOwnedViewerAdapter = PageOwnedViewerAdapter;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedViewerAdapter;
	}
}() );