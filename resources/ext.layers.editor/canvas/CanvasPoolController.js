( function () {
	'use strict';

	class CanvasPoolController {
		/**
		 * @param {CanvasManager} manager
		 * @param {Object} options
		 */
		constructor( manager, options ) {
			this.manager = manager;
			this.pool = [];
			this.maxPoolSize = ( options && options.maxPoolSize ) || ( manager && manager.maxPoolSize ) || 5;
		}

		getTempCanvas( width, height ) {
			const tempCanvasObj = this.pool.pop();
			if ( tempCanvasObj ) {
				tempCanvasObj.canvas.width = width || 100;
				tempCanvasObj.canvas.height = height || 100;
				tempCanvasObj.context.clearRect( 0, 0, tempCanvasObj.canvas.width, tempCanvasObj.canvas.height );
				return tempCanvasObj;
			}

			const tempCanvas = document.createElement( 'canvas' );
			tempCanvas.width = width || 100;
			tempCanvas.height = height || 100;
			return { canvas: tempCanvas, context: tempCanvas.getContext( '2d' ) };
		}

		returnTempCanvas( tempCanvasObj ) {
			if ( !tempCanvasObj || !tempCanvasObj.canvas || !tempCanvasObj.context ) {
				return;
			}

			if ( this.pool.length < this.maxPoolSize ) {
				const canvas = tempCanvasObj.canvas;
				tempCanvasObj.context.clearRect( 0, 0, canvas.width, canvas.height );
				tempCanvasObj.context.setTransform( 1, 0, 0, 1, 0, 0 );
				tempCanvasObj.context.globalAlpha = 1;
				tempCanvasObj.context.globalCompositeOperation = 'source-over';
				this.pool.push( tempCanvasObj );
			} else {
				// Let GC reclaim
				tempCanvasObj.canvas = null;
				tempCanvasObj.context = null;
			}
		}

		destroy() {
			this.pool.forEach( function ( item ) {
				if ( item && item.canvas ) {
					item.canvas.width = 0;
					item.canvas.height = 0;
				}
			} );
			this.pool = [];
			this.manager = null;
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.CanvasPoolController = CanvasPoolController;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CanvasPoolController;
	}

}() );
