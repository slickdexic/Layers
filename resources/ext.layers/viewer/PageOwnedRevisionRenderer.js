/** Exact-surface painter for the historical viewer. No editor, storage or data requests. */
( function () {
	'use strict';
	// Resource-backed/custom layers and groups need separate fidelity/error handling before exposure.
	const supported = new Set( [ 'text', 'textbox', 'callout', 'rectangle', 'rect', 'circle',
		'ellipse', 'polygon', 'star', 'line', 'arrow', 'path', 'dimension', 'angleDimension' ] );

	/**
	 * Paint an already validated, isolated slide at its original coordinate resolution.
	 * @param {HTMLCanvasElement} canvas Bounded canvas created by PageOwnedRevisionView
	 * @param {Object} surface Validated surface copy
	 * @param {Function} onFailure Fixed host failure callback
	 * @param {Function} Renderer Shared LayerRenderer constructor
	 * @param {FontFaceSet} [fonts] Font readiness source; redraw only this exact snapshot
	 * @return {Function} Idempotent disposer
	 */
	function render( canvas, surface, onFailure, Renderer, fonts ) {
		let painter = null;
		let stopped = false;
		const dispose = () => {
			if ( stopped ) {
				return;
			}
			stopped = true;
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
			if ( surface.kind !== 'slide' || surface.layers.some( ( layer ) =>
				!layer || !supported.has( layer.type ) || layer.parentGroup || layer.parentId ) ) {
				throw new Error( 'Unsupported historical surface' );
			}
			const context = canvas.getContext( '2d' );
			if ( !context ) {
				throw new Error( 'Canvas unavailable' );
			}
			const draw = () => {
				if ( stopped ) {
					return;
				}
				try {
					context.clearRect( 0, 0, canvas.width, canvas.height );
					const background = surface.canvas;
					const color = background.backgroundColor ?? '#ffffff';
					if ( background.backgroundVisible !== false && background.backgroundVisible !== 0 &&
						color !== '' && color !== 'transparent' && color !== 'none' ) {
						context.save();
						try {
							context.globalAlpha = background.backgroundOpacity ?? 1;
							context.fillStyle = color;
							context.fillRect( 0, 0, canvas.width, canvas.height );
						} finally {
							context.restore();
						}
					}
					for ( let index = surface.layers.length - 1; index >= 0; index-- ) {
						const layer = surface.layers[ index ];
						if ( layer.visible !== false && layer.visible !== 0 ) {
							painter.drawLayer( layer );
						}
					}
				} catch ( error ) {
					fail();
				}
			};
			painter = new Renderer( context, { canvas, zoom: 1,
				baseWidth: surface.canvas.width, baseHeight: surface.canvas.height } );
			draw();
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
