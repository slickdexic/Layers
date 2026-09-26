/** Exact-surface painter for the historical viewer. No editor, storage or data requests. */
( function () {
	'use strict';
	// Mirrors PageOwnedRenderCapability::LAYER_TYPES, which publication enforces (check-parallel-lists.js).
	const RENDERABLE_LAYER_TYPES = [ 'text', 'textbox', 'callout', 'rectangle', 'circle',
		'ellipse', 'polygon', 'star', 'line', 'arrow', 'path', 'dimension', 'angleDimension',
		'image', 'customShape', 'marker', 'group' ];
	const supported = new Set( RENDERABLE_LAYER_TYPES );

	/**
	 * Paint an already validated, isolated surface at its original coordinate resolution.
	 * Image and PDF surfaces are drawn over the server-issued rendition of their exact source version.
	 * @param {HTMLCanvasElement} canvas Bounded canvas created by PageOwnedRevisionView
	 * @param {Object} surface Validated surface copy
	 * @param {Function} onFailure Fixed host failure callback
	 * @param {Function} Renderer Shared LayerRenderer constructor
	 * @param {FontFaceSet} [fonts] Font readiness source; redraw only this exact snapshot
	 * @param {Object} [source] Rendition { url } for image/PDF surfaces
	 * @return {Function} Idempotent disposer
	 */
	function render( canvas, surface, onFailure, Renderer, fonts, source ) {
		let painter = null;
		let stopped = false;
		let image = null;
		const dispose = () => {
			if ( stopped ) {
				return;
			}
			stopped = true;
			if ( image ) {
				image.onload = null;
				image.onerror = null;
			}
			if ( painter ) {
				try {
					painter.destroy();
				} catch ( error ) {
					// Teardown must not expose diagnostics or revive a failed view.
				}
			}
		};
		const fail = () => {
			if ( stopped ) {
				return;
			}
			try {
				dispose();
			} finally {
				onFailure();
			}
		};
		try {
			const hasSource = surface.kind === 'image' || surface.kind === 'pdf';
			if ( ( !hasSource && surface.kind !== 'slide' ) || surface.layers.some( ( layer ) =>
				!layer || !supported.has( layer.type ) ) ) {
				throw new Error( 'Unsupported historical surface' );
			}
			if ( hasSource && ( !source || typeof source.url !== 'string' ||
				![ 'http:', 'https:' ].includes( new URL( source.url, window.location.href ).protocol ) ) ) {
				throw new Error( 'Unavailable historical source' );
			}
			const context = canvas.getContext( '2d' );
			if ( !context ) {
				throw new Error( 'Canvas unavailable' );
			}
			// As in the ordinary viewer: blend modes apply at context level, and groups draw nothing themselves.
			const drawLayer = ( layer ) => {
				const blend = layer.blendMode || layer.blend;
				if ( typeof blend !== 'string' || blend === 'normal' || blend === 'blur' ) {
					painter.drawLayer( layer );
					return;
				}
				context.save();
				try {
					context.globalCompositeOperation = blend;
					painter.drawLayer( layer );
				} finally {
					context.restore();
				}
			};
			const draw = () => {
				if ( stopped || ( hasSource && !( image.complete && image.naturalWidth > 0 ) ) ) {
					return;
				}
				try {
					context.clearRect( 0, 0, canvas.width, canvas.height );
					const background = surface.canvas;
					const visible = background.backgroundVisible !== false && background.backgroundVisible !== 0;
					const color = background.backgroundColor ?? '#ffffff';
					if ( visible && ( hasSource ||
						( color !== '' && color !== 'transparent' && color !== 'none' ) ) ) {
						context.save();
						try {
							context.globalAlpha = background.backgroundOpacity ?? 1;
							if ( hasSource ) {
								// The rendition may be smaller than the canvas; layer coordinates use the canvas.
								context.drawImage( image, 0, 0, canvas.width, canvas.height );
							} else {
								context.fillStyle = color;
								context.fillRect( 0, 0, canvas.width, canvas.height );
							}
						} finally {
							context.restore();
						}
					}
					for ( let index = surface.layers.length - 1; index >= 0; index-- ) {
						const layer = surface.layers[ index ];
						if ( layer.visible !== false && layer.visible !== 0 && layer.type !== 'group' ) {
							drawLayer( layer );
						}
					}
				} catch ( error ) {
					fail();
				}
			};
			// Image layers and SVG shapes (emoji included) decode asynchronously; each decode redraws.
			painter = new Renderer( context, { canvas, zoom: 1, onImageLoad: () => draw(),
				baseWidth: surface.canvas.width, baseHeight: surface.canvas.height } );
			if ( hasSource ) {
				image = new window.Image();
				image.onload = draw;
				image.onerror = fail;
				image.src = source.url;
			} else {
				draw();
			}
			if ( fonts && !stopped ) {
				Promise.resolve( fonts.ready ).then( draw, fail );
			}
		} catch ( error ) {
			fail();
		}
		return dispose;
	}
	window.Layers = window.Layers || {};
	window.Layers.Viewer = window.Layers.Viewer || {};
	window.Layers.Viewer.renderPageOwnedRevision = render;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = render;
	}
}() );
