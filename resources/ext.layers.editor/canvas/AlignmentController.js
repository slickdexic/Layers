/**
 * Alignment Controller for Layers Editor
 * Provides alignment and distribution operations for selected layers
 *
 * Implements industry-standard alignment:
 * - Align Left/Center/Right (horizontal)
 * - Align Top/Middle/Bottom (vertical)
 * - Distribute Horizontally/Vertically (when 3+ layers selected)
 *
 * @module AlignmentController
 */
( function () {
	'use strict';

	/**
	 * AlignmentController class
	 * Handles layer alignment and distribution operations
	 */
	class AlignmentController {
		/**
		 * Create an AlignmentController instance
		 *
		 * @param {Object} config Configuration options
		 * @param {Object} config.editor Reference to LayersEditor
		 * @param {Object} config.canvasManager Reference to CanvasManager
		 */
		constructor( config ) {
			this.editor = config.editor || null;
			this.canvasManager = config.canvasManager || null;
		}

		/**
		 * Get the bounds of a layer (works for all layer types)
		 *
		 * @param {Object} layer Layer object
		 * @return {Object} Bounds { left, top, right, bottom, width, height, centerX, centerY }
		 */
		getLayerBounds( layer ) {
			let left, top, right, bottom;

			switch ( layer.type ) {
				case 'line':
				case 'arrow':
					left = Math.min( layer.x1 || 0, layer.x2 || 0 );
					right = Math.max( layer.x1 || 0, layer.x2 || 0 );
					top = Math.min( layer.y1 || 0, layer.y2 || 0 );
					bottom = Math.max( layer.y1 || 0, layer.y2 || 0 );
					break;

				case 'path':
					if ( layer.points && layer.points.length > 0 ) {
						const xs = layer.points.map( ( p ) => p.x );
						const ys = layer.points.map( ( p ) => p.y );
						left = Math.min( ...xs );
						right = Math.max( ...xs );
						top = Math.min( ...ys );
						bottom = Math.max( ...ys );
					} else {
						left = top = right = bottom = 0;
					}
					break;

				case 'circle': {
					const radius = layer.radius || 0;
					left = ( layer.x || 0 ) - radius;
					top = ( layer.y || 0 ) - radius;
					right = ( layer.x || 0 ) + radius;
					bottom = ( layer.y || 0 ) + radius;
					break;
				}

				default:
					// Rectangle, ellipse, text, textbox, blur, image, polygon, star
					left = layer.x || 0;
					top = layer.y || 0;
					right = left + ( layer.width || 0 );
					bottom = top + ( layer.height || 0 );
					break;
			}

			const width = right - left;
			const height = bottom - top;

			return {
				left,
				top,
				right,
				bottom,
				width,
				height,
				centerX: left + width / 2,
				centerY: top + height / 2
			};
		}

		/**
		 * Move a layer by delta amounts
		 *
		 * @param {Object} layer Layer to move
		 * @param {number} deltaX Horizontal movement
		 * @param {number} deltaY Vertical movement
		 */
		moveLayer( layer, deltaX, deltaY ) {
			switch ( layer.type ) {
				case 'line':
				case 'arrow':
					layer.x1 = ( layer.x1 || 0 ) + deltaX;
					layer.y1 = ( layer.y1 || 0 ) + deltaY;
					layer.x2 = ( layer.x2 || 0 ) + deltaX;
					layer.y2 = ( layer.y2 || 0 ) + deltaY;
					break;

				case 'path':
					if ( layer.points && layer.points.length > 0 ) {
						layer.points = layer.points.map( ( p ) => ( {
							x: p.x + deltaX,
							y: p.y + deltaY
						} ) );
					}
					break;

				default:
					layer.x = ( layer.x || 0 ) + deltaX;
					layer.y = ( layer.y || 0 ) + deltaY;
					break;
			}
		}

		/**
		 * Get the combined bounds of multiple layers
		 *
		 * @param {Array} layers Array of layer objects
		 * @return {Object} Combined bounds
		 */
		getCombinedBounds( layers ) {
			if ( !layers || layers.length === 0 ) {
				return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
			}

			const bounds = layers.map( ( layer ) => this.getLayerBounds( layer ) );

			return {
				left: Math.min( ...bounds.map( ( b ) => b.left ) ),
				top: Math.min( ...bounds.map( ( b ) => b.top ) ),
				right: Math.max( ...bounds.map( ( b ) => b.right ) ),
				bottom: Math.max( ...bounds.map( ( b ) => b.bottom ) ),
				width: 0, // Will be calculated
				height: 0
			};
		}

		/**
		 * Get currently selected layers
		 *
		 * @return {Array} Array of selected layer objects
		 */
		getSelectedLayers() {
			if ( !this.editor ) {
				return [];
			}

			const selectedIds = this.canvasManager ?
				this.canvasManager.getSelectedLayerIds() :
				[];

			if ( selectedIds.length === 0 ) {
				// Single selection fallback
				const singleId = this.canvasManager ?
					this.canvasManager.getSelectedLayerId() :
					null;
				if ( singleId ) {
					const layer = this.editor.getLayerById( singleId );
					return layer ? [ layer ] : [];
				}
				return [];
			}

			return selectedIds
				.map( ( id ) => this.editor.getLayerById( id ) )
				.filter( ( layer ) => layer && !layer.locked );
		}

		/**
		 * Align selected layers to left edge
		 */
		alignLeft() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const bounds = layers.map( ( layer ) => ( {
				layer,
				bounds: this.getLayerBounds( layer )
			} ) );

			const targetLeft = Math.min( ...bounds.map( ( b ) => b.bounds.left ) );

			bounds.forEach( ( { layer, bounds: b } ) => {
				const deltaX = targetLeft - b.left;
				if ( deltaX !== 0 ) {
					this.moveLayer( layer, deltaX, 0 );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to horizontal center
		 */
		alignCenterH() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const bounds = layers.map( ( layer ) => ( {
				layer,
				bounds: this.getLayerBounds( layer )
			} ) );

			const combined = this.getCombinedBounds( layers );
			const targetCenterX = ( combined.left + combined.right ) / 2;

			bounds.forEach( ( { layer, bounds: b } ) => {
				const deltaX = targetCenterX - b.centerX;
				if ( deltaX !== 0 ) {
					this.moveLayer( layer, deltaX, 0 );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to right edge
		 */
		alignRight() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const bounds = layers.map( ( layer ) => ( {
				layer,
				bounds: this.getLayerBounds( layer )
			} ) );

			const targetRight = Math.max( ...bounds.map( ( b ) => b.bounds.right ) );

			bounds.forEach( ( { layer, bounds: b } ) => {
				const deltaX = targetRight - b.right;
				if ( deltaX !== 0 ) {
					this.moveLayer( layer, deltaX, 0 );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to top edge
		 */
		alignTop() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const bounds = layers.map( ( layer ) => ( {
				layer,
				bounds: this.getLayerBounds( layer )
			} ) );

			const targetTop = Math.min( ...bounds.map( ( b ) => b.bounds.top ) );

			bounds.forEach( ( { layer, bounds: b } ) => {
				const deltaY = targetTop - b.top;
				if ( deltaY !== 0 ) {
					this.moveLayer( layer, 0, deltaY );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to vertical center
		 */
		alignCenterV() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const bounds = layers.map( ( layer ) => ( {
				layer,
				bounds: this.getLayerBounds( layer )
			} ) );

			const combined = this.getCombinedBounds( layers );
			const targetCenterY = ( combined.top + combined.bottom ) / 2;

			bounds.forEach( ( { layer, bounds: b } ) => {
				const deltaY = targetCenterY - b.centerY;
				if ( deltaY !== 0 ) {
					this.moveLayer( layer, 0, deltaY );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to bottom edge
		 */
		alignBottom() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const bounds = layers.map( ( layer ) => ( {
				layer,
				bounds: this.getLayerBounds( layer )
			} ) );

			const targetBottom = Math.max( ...bounds.map( ( b ) => b.bounds.bottom ) );

			bounds.forEach( ( { layer, bounds: b } ) => {
				const deltaY = targetBottom - b.bottom;
				if ( deltaY !== 0 ) {
					this.moveLayer( layer, 0, deltaY );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Distribute selected layers horizontally with equal spacing
		 */
		distributeHorizontal() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 3 ) {
				return; // Need at least 3 layers to distribute
			}

			// Get bounds and sort by centerX
			const items = layers.map( ( layer ) => ( {
				layer,
				bounds: this.getLayerBounds( layer )
			} ) ).sort( ( a, b ) => a.bounds.centerX - b.bounds.centerX );

			const first = items[ 0 ].bounds;
			const last = items[ items.length - 1 ].bounds;
			const totalSpan = last.centerX - first.centerX;
			const step = totalSpan / ( items.length - 1 );

			items.forEach( ( item, index ) => {
				if ( index === 0 || index === items.length - 1 ) {
					return; // Don't move first and last
				}

				const targetCenterX = first.centerX + step * index;
				const deltaX = targetCenterX - item.bounds.centerX;
				if ( deltaX !== 0 ) {
					this.moveLayer( item.layer, deltaX, 0 );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Distribute selected layers vertically with equal spacing
		 */
		distributeVertical() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 3 ) {
				return; // Need at least 3 layers to distribute
			}

			// Get bounds and sort by centerY
			const items = layers.map( ( layer ) => ( {
				layer,
				bounds: this.getLayerBounds( layer )
			} ) ).sort( ( a, b ) => a.bounds.centerY - b.bounds.centerY );

			const first = items[ 0 ].bounds;
			const last = items[ items.length - 1 ].bounds;
			const totalSpan = last.centerY - first.centerY;
			const step = totalSpan / ( items.length - 1 );

			items.forEach( ( item, index ) => {
				if ( index === 0 || index === items.length - 1 ) {
					return; // Don't move first and last
				}

				const targetCenterY = first.centerY + step * index;
				const deltaY = targetCenterY - item.bounds.centerY;
				if ( deltaY !== 0 ) {
					this.moveLayer( item.layer, 0, deltaY );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Common cleanup after alignment operations
		 */
		finishAlignment() {
			// Re-render
			if ( this.canvasManager ) {
				this.canvasManager.renderLayers( this.editor.layers );
			}

			// Mark dirty and save state for undo
			if ( this.editor ) {
				this.editor.markDirty();
				if ( typeof this.editor.saveState === 'function' ) {
					this.editor.saveState();
				}
			}
		}

		/**
		 * Check if alignment operations are available
		 *
		 * @return {Object} Availability { align: boolean, distribute: boolean }
		 */
		getAvailability() {
			const layers = this.getSelectedLayers();
			return {
				align: layers.length >= 2,
				distribute: layers.length >= 3
			};
		}

		/**
		 * Destroy and clean up
		 */
		destroy() {
			this.editor = null;
			this.canvasManager = null;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.AlignmentController = AlignmentController;
	}

	// CommonJS export for testing
	/* eslint-disable-next-line no-undef */
	if ( typeof module !== 'undefined' && module.exports ) {
		/* eslint-disable-next-line no-undef */
		module.exports = AlignmentController;
	}
}() );
