( function () {
	'use strict';

	class PointerController {
		/**
		 * @param {CanvasManager} manager
		 */
		constructor( manager ) {
			this.manager = manager;
		}

		getMousePoint( e ) {
			return this.getMousePointFromClient( e.clientX, e.clientY );
		}

		getMousePointFromClient( clientX, clientY ) {
			const canvas = this.manager.canvas;
			if ( !canvas ) {
				return { x: 0, y: 0 };
			}
			const rect = canvas.getBoundingClientRect();
			const relX = clientX - rect.left;
			const relY = clientY - rect.top;
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;
			let canvasX = relX * scaleX;
			let canvasY = relY * scaleY;

			if ( this.manager.snapToGrid && this.manager.gridSize > 0 ) {
				const gridSize = this.manager.gridSize;
				canvasX = Math.round( canvasX / gridSize ) * gridSize;
				canvasY = Math.round( canvasY / gridSize ) * gridSize;
			}

			return { x: canvasX, y: canvasY };
		}

		getRawClientPoint( e ) {
			const canvas = this.manager.canvas;
			if ( !canvas ) {
				return { canvasX: 0, canvasY: 0 };
			}
			const rect = canvas.getBoundingClientRect();
			const clientX = e.clientX - rect.left;
			const clientY = e.clientY - rect.top;
			return {
				canvasX: ( clientX - ( this.manager.panX || 0 ) ) / this.manager.zoom,
				canvasY: ( clientY - ( this.manager.panY || 0 ) ) / this.manager.zoom
			};
		}

		destroy() {
			this.manager = null;
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.PointerController = PointerController;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PointerController;
	}

}() );
