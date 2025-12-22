/**
 * Path Tool Handler for Layers Editor
 * Handles freeform path drawing with click-to-add points
 *
 * Extracted from ToolManager.js to reduce god class size.
 *
 * @module tools/PathToolHandler
 */
( function () {
	'use strict';

	/**
	 * PathToolHandler class
	 * Manages freeform path creation via point-by-point drawing
	 *
	 * @class
	 */
	class PathToolHandler {
		/**
		 * Create a PathToolHandler instance
		 *
		 * @param {Object} config Configuration object
		 * @param {Object} config.canvasManager Reference to canvas manager
		 * @param {Object} config.styleManager Reference to style manager for current styles
		 * @param {Function} config.addLayerCallback Callback to add created layer
		 * @param {Function} config.renderCallback Callback to trigger canvas render
		 */
		constructor( config ) {
			this.config = config || {};
			this.canvasManager = config.canvasManager || null;
			this.styleManager = config.styleManager || null;
			this.addLayerCallback = config.addLayerCallback || null;
			this.renderCallback = config.renderCallback || null;

			// Path drawing state
			this.pathPoints = [];
			this.isPathComplete = false;
			this.isDrawing = false;

			// Threshold for closing path (in pixels)
			this.closeThreshold = 10;
		}

		/**
		 * Get current style, falling back to defaults
		 *
		 * @private
		 * @return {Object} Current style object
		 */
		_getCurrentStyle() {
			if ( this.styleManager && typeof this.styleManager.get === 'function' ) {
				return this.styleManager.get();
			}
			if ( this.styleManager && this.styleManager.currentStyle ) {
				return this.styleManager.currentStyle;
			}
			// Fallback defaults
			return {
				color: '#000000',
				strokeWidth: 2,
				fill: 'transparent'
			};
		}

		/**
		 * Handle a point click during path drawing
		 *
		 * @param {Object} point Click point { x, y }
		 * @return {boolean} True if path was completed
		 */
		handlePoint( point ) {
			if ( this.pathPoints.length === 0 ) {
				// Start new path
				this.pathPoints = [ { x: point.x, y: point.y } ];
				this.isDrawing = true;
			} else {
				// Add point to path
				this.pathPoints.push( { x: point.x, y: point.y } );
			}

			// Check for path completion (close to start point)
			if ( this.pathPoints.length > 2 ) {
				const firstPoint = this.pathPoints[ 0 ];
				const distance = Math.sqrt(
					Math.pow( point.x - firstPoint.x, 2 ) +
					Math.pow( point.y - firstPoint.y, 2 )
				);

				if ( distance < this.closeThreshold ) {
					this.complete();
					return true;
				}
			}

			this.renderPreview();
			return false;
		}

		/**
		 * Complete path drawing and create the layer
		 */
		complete() {
			if ( this.pathPoints.length > 2 && this.addLayerCallback ) {
				const style = this._getCurrentStyle();
				const layer = {
					type: 'path',
					points: this.pathPoints.slice(),
					stroke: style.color || '#000000',
					strokeWidth: style.strokeWidth || 2,
					fill: style.fill || 'transparent',
					closed: true
				};
				this.addLayerCallback( layer );
			}

			this.reset();
		}

		/**
		 * Reset path state without creating a layer
		 */
		reset() {
			this.pathPoints = [];
			this.isPathComplete = false;
			this.isDrawing = false;
		}

		/**
		 * Cancel path drawing
		 */
		cancel() {
			this.reset();
			if ( this.renderCallback ) {
				this.renderCallback();
			}
		}

		/**
		 * Render path preview on the canvas
		 */
		renderPreview() {
			// First render existing layers
			if ( this.renderCallback ) {
				this.renderCallback();
			}

			// Then draw path preview
			if ( this.pathPoints.length > 0 && this.canvasManager && this.canvasManager.ctx ) {
				const ctx = this.canvasManager.ctx;
				const style = this._getCurrentStyle();

				ctx.save();
				ctx.strokeStyle = style.color || '#000000';
				ctx.lineWidth = style.strokeWidth || 2;
				ctx.setLineDash( [ 5, 5 ] );

				// Draw path lines
				ctx.beginPath();
				ctx.moveTo( this.pathPoints[ 0 ].x, this.pathPoints[ 0 ].y );
				for ( let i = 1; i < this.pathPoints.length; i++ ) {
					ctx.lineTo( this.pathPoints[ i ].x, this.pathPoints[ i ].y );
				}
				ctx.stroke();

				// Draw point markers
				ctx.fillStyle = style.color || '#000000';
				ctx.setLineDash( [] );
				this.pathPoints.forEach( ( point ) => {
					ctx.beginPath();
					ctx.arc( point.x, point.y, 3, 0, 2 * Math.PI );
					ctx.fill();
				} );

				ctx.restore();
			}
		}

		/**
		 * Get current path points
		 *
		 * @return {Array} Array of point objects { x, y }
		 */
		getPoints() {
			return this.pathPoints.slice();
		}

		/**
		 * Check if path drawing is in progress
		 *
		 * @return {boolean} True if drawing
		 */
		isActive() {
			return this.isDrawing && this.pathPoints.length > 0;
		}

		/**
		 * Get the number of points in the current path
		 *
		 * @return {number} Point count
		 */
		getPointCount() {
			return this.pathPoints.length;
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.reset();
			this.canvasManager = null;
			this.styleManager = null;
			this.addLayerCallback = null;
			this.renderCallback = null;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Tools = window.Layers.Tools || {};
		window.Layers.Tools.PathToolHandler = PathToolHandler;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PathToolHandler;
	}

}() );
