/**
 * GridRulersController - Handles grid, rulers, and guides for the canvas
 *
 * Extracted from CanvasManager.js to reduce file size and improve maintainability.
 * This module manages grid rendering/snapping, rulers, and guide lines.
 *
 * @module canvas/GridRulersController
 */
( function () {
	'use strict';

	/**
	 * GridRulersController class
	 */
class GridRulersController {
	/**
	 * Creates a new GridRulersController instance
	 *
	 * @param {Object} canvasManager Reference to parent CanvasManager
	 */
	constructor( canvasManager ) {
		this.manager = canvasManager;

		// Grid settings (sync with manager for backwards compatibility)
		this.gridSize = 20;

		// Ruler settings
		this.rulerSize = 20;

		// Guide settings
		this.horizontalGuides = []; // y positions in canvas coords
		this.verticalGuides = []; // x positions in canvas coords

		// Dragging guide state
		this.isDraggingGuide = false;
		this.dragGuideOrientation = null; // 'h' | 'v'
		this.dragGuidePos = 0;
	}

	/**
	 * Get current grid visibility
	 *
	 * @return {boolean} Whether grid is visible
	 */
	isGridVisible() {
		return this.manager.showGrid;
	}

	/**
	 * Get current rulers visibility
	 *
	 * @return {boolean} Whether rulers are visible
	 */
	areRulersVisible () {
		return this.manager.showRulers;
	}

	/**
	 * Get current guides visibility
	 *
	 * @return {boolean} Whether guides are visible
	 */
	areGuidesVisible () {
		return this.manager.showGuides;
	}

	/**
	 * Toggle grid visibility
	 */
	toggleGrid () {
		this.manager.showGrid = !this.manager.showGrid;
		this.manager.redraw();
		this.manager.renderLayers( this.manager.editor.layers );
	}

	/**
	 * Toggle rulers visibility
	 */
	toggleRulers () {
		this.manager.showRulers = !this.manager.showRulers;
		this.manager.redraw();
		this.manager.renderLayers( this.manager.editor.layers );
	}

	/**
	 * Toggle guides visibility
	 */
	toggleGuidesVisibility () {
		this.manager.showGuides = !this.manager.showGuides;
		this.manager.redraw();
		this.manager.renderLayers( this.manager.editor.layers );
	}

	/**
	 * Toggle snap to grid
	 */
	toggleSnapToGrid () {
		this.manager.snapToGrid = !this.manager.snapToGrid;
	}

	/**
	 * Toggle snap to guides
	 */
	toggleSnapToGuides () {
		this.manager.snapToGuides = !this.manager.snapToGuides;
	}

	/**
	 * Toggle smart guides
	 */
	toggleSmartGuides () {
		this.manager.smartGuides = !this.manager.smartGuides;
	}

	/**
	 * Set grid size
	 *
	 * @param {number} size Grid cell size in pixels
	 */
	setGridSize ( size ) {
		this.gridSize = size;
		this.manager.gridSize = size;
		if ( this.manager.showGrid ) {
			this.manager.redraw();
			this.manager.renderLayers( this.manager.editor.layers );
		}
	}

	/**
	 * Draw grid (delegates to renderer)
	 */
	drawGrid () {
		if ( this.manager.renderer ) {
			this.manager.renderer.drawGrid();
		}
	}

	/**
	 * Draw rulers (delegates to renderer)
	 */
	drawRulers () {
		if ( this.manager.renderer ) {
			this.manager.renderer.drawRulers();
		}
	}

	/**
	 * Draw guides (delegates to renderer)
	 */
	drawGuides () {
		if ( this.manager.renderer ) {
			this.manager.renderer.drawGuides();
		}
	}

	/**
	 * Draw guide preview during drag (delegates to renderer)
	 */
	drawGuidePreview () {
		if ( this.manager.renderer ) {
			this.manager.renderer.drawGuidePreview();
		}
	}

	/**
	 * Add a horizontal guide at the specified y position
	 *
	 * @param {number} y Y position in canvas coordinates
	 */
	addHorizontalGuide ( y ) {
		if ( this.horizontalGuides.indexOf( y ) === -1 ) {
			this.horizontalGuides.push( y );
			this.manager.horizontalGuides = this.horizontalGuides;
			if ( this.manager.showGuides ) {
				this.manager.redraw();
				this.manager.renderLayers( this.manager.editor.layers );
			}
		}
	}

	/**
	 * Add a vertical guide at the specified x position
	 *
	 * @param {number} x X position in canvas coordinates
	 */
	addVerticalGuide ( x ) {
		if ( this.verticalGuides.indexOf( x ) === -1 ) {
			this.verticalGuides.push( x );
			this.manager.verticalGuides = this.verticalGuides;
			if ( this.manager.showGuides ) {
				this.manager.redraw();
				this.manager.renderLayers( this.manager.editor.layers );
			}
		}
	}

	/**
	 * Remove a horizontal guide
	 *
	 * @param {number} y Y position of guide to remove
	 */
	removeHorizontalGuide ( y ) {
		const idx = this.horizontalGuides.indexOf( y );
		if ( idx !== -1 ) {
			this.horizontalGuides.splice( idx, 1 );
			this.manager.horizontalGuides = this.horizontalGuides;
			if ( this.manager.showGuides ) {
				this.manager.redraw();
				this.manager.renderLayers( this.manager.editor.layers );
			}
		}
	}

	/**
	 * Remove a vertical guide
	 *
	 * @param {number} x X position of guide to remove
	 */
	removeVerticalGuide ( x ) {
		const idx = this.verticalGuides.indexOf( x );
		if ( idx !== -1 ) {
			this.verticalGuides.splice( idx, 1 );
			this.manager.verticalGuides = this.verticalGuides;
			if ( this.manager.showGuides ) {
				this.manager.redraw();
				this.manager.renderLayers( this.manager.editor.layers );
			}
		}
	}

	/**
	 * Clear all guides
	 */
	clearAllGuides () {
		this.horizontalGuides = [];
		this.verticalGuides = [];
		this.manager.horizontalGuides = [];
		this.manager.verticalGuides = [];
		if ( this.manager.showGuides ) {
			this.manager.redraw();
			this.manager.renderLayers( this.manager.editor.layers );
		}
	}

	/**
	 * Snap a point to the grid if snapping is enabled
	 *
	 * @param {number} x X coordinate
	 * @param {number} y Y coordinate
	 * @return {{x: number, y: number}} Snapped coordinates
	 */
	snapPointToGrid ( x, y ) {
		if ( !this.manager.snapToGrid ) {
			return { x: x, y: y };
		}
		const gridSize = this.gridSize || 20;
		return {
			x: Math.round( x / gridSize ) * gridSize,
			y: Math.round( y / gridSize ) * gridSize
		};
	}

	/**
	 * Calculate snap delta to guides for a given bounds
	 *
	 * @param {Object} bounds Object with x, y, width, height
	 * @param {number} deltaX Current X delta
	 * @param {number} deltaY Current Y delta
	 * @param {number} [tol=6] Snap tolerance in pixels
	 * @return {{dx: number, dy: number}} Additional delta to snap to guides
	 */
	getGuideSnapDelta ( bounds, deltaX, deltaY, tol ) {
		tol = tol || 6;
		let dx = 0;
		let dy = 0;

		// Sync guides from manager
		const verticalGuides = this.manager.verticalGuides || this.verticalGuides;
		const horizontalGuides = this.manager.horizontalGuides || this.horizontalGuides;

		if ( verticalGuides && verticalGuides.length ) {
			const left = ( bounds.x || 0 ) + deltaX;
			const right = left + ( bounds.width || 0 );
			const centerX = left + ( bounds.width || 0 ) / 2;
			for ( let i = 0; i < verticalGuides.length; i++ ) {
				const gx = verticalGuides[ i ];
				if ( Math.abs( gx - left ) <= tol ) {
					dx = gx - left;
					break;
				}
				if ( Math.abs( gx - right ) <= tol ) {
					dx = gx - right;
					break;
				}
				if ( Math.abs( gx - centerX ) <= tol ) {
					dx = gx - centerX;
					break;
				}
			}
		}

		if ( horizontalGuides && horizontalGuides.length ) {
			const top = ( bounds.y || 0 ) + deltaY;
			const bottom = top + ( bounds.height || 0 );
			const centerY = top + ( bounds.height || 0 ) / 2;
			for ( let j = 0; j < horizontalGuides.length; j++ ) {
				const gy = horizontalGuides[ j ];
				if ( Math.abs( gy - top ) <= tol ) {
					dy = gy - top;
					break;
				}
				if ( Math.abs( gy - bottom ) <= tol ) {
					dy = gy - bottom;
					break;
				}
				if ( Math.abs( gy - centerY ) <= tol ) {
					dy = gy - centerY;
					break;
				}
			}
		}

		return { dx: dx, dy: dy };
	}

	/**
	 * Start dragging a guide from a ruler
	 *
	 * @param {string} orientation 'h' for horizontal, 'v' for vertical
	 * @param {number} pos Initial position
	 */
	startGuideDrag ( orientation, pos ) {
		this.isDraggingGuide = true;
		this.dragGuideOrientation = orientation;
		this.dragGuidePos = pos;
		this.manager.isDraggingGuide = true;
		this.manager.dragGuideOrientation = orientation;
		this.manager.dragGuidePos = pos;
	}

	/**
	 * Update guide position during drag
	 *
	 * @param {number} pos New position
	 */
	updateGuideDrag ( pos ) {
		this.dragGuidePos = pos;
		this.manager.dragGuidePos = pos;
		this.drawGuidePreview();
	}

	/**
	 * Finish dragging a guide
	 *
	 * @param {number} pos Final position
	 */
	finishGuideDrag ( pos ) {
		if ( this.dragGuideOrientation === 'h' ) {
			this.addHorizontalGuide( pos );
		} else if ( this.dragGuideOrientation === 'v' ) {
			this.addVerticalGuide( pos );
		}
		this.isDraggingGuide = false;
		this.dragGuideOrientation = null;
		this.dragGuidePos = 0;
		this.manager.isDraggingGuide = false;
		this.manager.dragGuideOrientation = null;
		this.manager.dragGuidePos = 0;
	}

	/**
	 * Cancel guide drag operation
	 */
	cancelGuideDrag () {
		this.isDraggingGuide = false;
		this.dragGuideOrientation = null;
		this.dragGuidePos = 0;
		this.manager.isDraggingGuide = false;
		this.manager.dragGuideOrientation = null;
		this.manager.dragGuidePos = 0;
		this.manager.redraw();
		this.manager.renderLayers( this.manager.editor.layers );
	}

	/**
	 * Clean up resources and state
	 */
	destroy () {
		// Clear guides
		this.horizontalGuides = [];
		this.verticalGuides = [];

		// Clear drag state
		this.isDraggingGuide = false;
		this.dragGuideOrientation = null;
		this.dragGuidePos = 0;

		// Clear reference
		this.manager = null;
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.GridRulersController = GridRulersController;

		// DEPRECATED: Direct window export - use window.Layers.Canvas.GridRulersController instead
		// This will be removed in a future version
		window.GridRulersController = GridRulersController;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = GridRulersController;
	}

}() );
