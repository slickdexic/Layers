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
		 * @param {Object} canvasManager Reference to CanvasManager (or config object)
		 */
		constructor( canvasManager ) {
			// Support both direct CanvasManager reference and config object
			// A CanvasManager has both 'editor' AND canvas-specific methods like 'getSelectedLayerIds'
			const isCanvasManager = canvasManager &&
				canvasManager.editor &&
				typeof canvasManager.getSelectedLayerIds === 'function';

			if ( isCanvasManager ) {
				// Direct CanvasManager reference (standard usage)
				this.canvasManager = canvasManager;
				this.editor = canvasManager.editor;
			} else if ( canvasManager && canvasManager.canvasManager ) {
				// Config object with canvasManager property (legacy)
				this.canvasManager = canvasManager.canvasManager;
				this.editor = canvasManager.editor || null;
			} else {
				// Fallback
				this.canvasManager = canvasManager || null;
				this.editor = null;
			}
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
				case 'text': {
					// Text layers need special handling - measure using canvas context
					const ctx = this.canvasManager && this.canvasManager.ctx;
					const canvasWidth = this.canvasManager && this.canvasManager.canvas ?
						this.canvasManager.canvas.width : 800;

					// Try to use TextUtils if available
					const TextUtils = window.Layers && window.Layers.Utils && window.Layers.Utils.Text;
					if ( TextUtils && ctx ) {
						const metrics = TextUtils.measureTextLayer( layer, ctx, canvasWidth );
						if ( metrics ) {
							left = metrics.originX;
							top = metrics.originY;
							right = left + metrics.width;
							bottom = top + metrics.height;
							break;
						}
					}

					// Fallback: estimate based on fontSize and text length
					const fontSize = layer.fontSize || 16;
					const text = layer.text || '';
					const estimatedWidth = Math.max( text.length * fontSize * 0.6, fontSize );
					const estimatedHeight = fontSize * 1.2;

					// Text anchor is at baseline, so adjust top position
					left = layer.x || 0;
					top = ( layer.y || 0 ) - fontSize * 0.8; // Approximate ascent
					right = left + estimatedWidth;
					bottom = top + estimatedHeight;
					break;
				}

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

				case 'ellipse': {
					const rx = layer.radiusX || 0;
					const ry = layer.radiusY || 0;
					left = ( layer.x || 0 ) - rx;
					top = ( layer.y || 0 ) - ry;
					right = ( layer.x || 0 ) + rx;
					bottom = ( layer.y || 0 ) + ry;
					break;
				}

				case 'polygon': {
					const polyRadius = layer.radius || 0;
					left = ( layer.x || 0 ) - polyRadius;
					top = ( layer.y || 0 ) - polyRadius;
					right = ( layer.x || 0 ) + polyRadius;
					bottom = ( layer.y || 0 ) + polyRadius;
					break;
				}

				case 'star': {
					const starRadius = layer.radius || layer.outerRadius || 0;
					left = ( layer.x || 0 ) - starRadius;
					top = ( layer.y || 0 ) - starRadius;
					right = ( layer.x || 0 ) + starRadius;
					bottom = ( layer.y || 0 ) + starRadius;
					break;
				}

				default:
					// Rectangle, textbox, blur, image
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
					// Move control point with the arrow (for curved arrows)
					if ( layer.controlX !== undefined ) {
						layer.controlX = layer.controlX + deltaX;
					}
					if ( layer.controlY !== undefined ) {
						layer.controlY = layer.controlY + deltaY;
					}
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

			const left = Math.min( ...bounds.map( ( b ) => b.left ) );
			const top = Math.min( ...bounds.map( ( b ) => b.top ) );
			const right = Math.max( ...bounds.map( ( b ) => b.right ) );
			const bottom = Math.max( ...bounds.map( ( b ) => b.bottom ) );

			return {
				left: left,
				top: top,
				right: right,
				bottom: bottom,
				width: right - left,
				height: bottom - top
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
		 * Get the key object (last selected layer) for alignment reference
		 * Other layers align TO this layer, which stays fixed.
		 * This follows the Adobe Illustrator/Photoshop "Key Object" pattern.
		 *
		 * @return {Object|null} The key object layer, or null if not found
		 */
		getKeyObject() {
			if ( !this.canvasManager || !this.canvasManager.selectionManager ) {
				return null;
			}

			const lastSelectedId = this.canvasManager.selectionManager.lastSelectedId;
			if ( !lastSelectedId || !this.editor ) {
				return null;
			}

			const layer = this.editor.getLayerById( lastSelectedId );
			return ( layer && !layer.locked ) ? layer : null;
		}

		/**
		 * Align selected layers to left edge of key object
		 */
		alignLeft() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const keyObject = this.getKeyObject();
			const keyBounds = keyObject ? this.getLayerBounds( keyObject ) : null;

			// If no key object, fall back to leftmost layer
			const targetLeft = keyBounds ?
				keyBounds.left :
				Math.min( ...layers.map( ( l ) => this.getLayerBounds( l ).left ) );

			layers.forEach( ( layer ) => {
				// Skip the key object - it stays fixed
				if ( keyObject && layer.id === keyObject.id ) {
					return;
				}
				const bounds = this.getLayerBounds( layer );
				const deltaX = targetLeft - bounds.left;
				if ( deltaX !== 0 ) {
					this.moveLayer( layer, deltaX, 0 );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to horizontal center of key object
		 */
		alignCenterH() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const keyObject = this.getKeyObject();
			const keyBounds = keyObject ? this.getLayerBounds( keyObject ) : null;

			// If no key object, use combined bounds center
			let targetCenterX;
			if ( keyBounds ) {
				targetCenterX = keyBounds.centerX;
			} else {
				const combined = this.getCombinedBounds( layers );
				targetCenterX = ( combined.left + combined.right ) / 2;
			}

			layers.forEach( ( layer ) => {
				if ( keyObject && layer.id === keyObject.id ) {
					return;
				}
				const bounds = this.getLayerBounds( layer );
				const deltaX = targetCenterX - bounds.centerX;
				if ( deltaX !== 0 ) {
					this.moveLayer( layer, deltaX, 0 );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to right edge of key object
		 */
		alignRight() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const keyObject = this.getKeyObject();
			const keyBounds = keyObject ? this.getLayerBounds( keyObject ) : null;

			const targetRight = keyBounds ?
				keyBounds.right :
				Math.max( ...layers.map( ( l ) => this.getLayerBounds( l ).right ) );

			layers.forEach( ( layer ) => {
				if ( keyObject && layer.id === keyObject.id ) {
					return;
				}
				const bounds = this.getLayerBounds( layer );
				const deltaX = targetRight - bounds.right;
				if ( deltaX !== 0 ) {
					this.moveLayer( layer, deltaX, 0 );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to top edge of key object
		 */
		alignTop() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const keyObject = this.getKeyObject();
			const keyBounds = keyObject ? this.getLayerBounds( keyObject ) : null;

			const targetTop = keyBounds ?
				keyBounds.top :
				Math.min( ...layers.map( ( l ) => this.getLayerBounds( l ).top ) );

			layers.forEach( ( layer ) => {
				if ( keyObject && layer.id === keyObject.id ) {
					return;
				}
				const bounds = this.getLayerBounds( layer );
				const deltaY = targetTop - bounds.top;
				if ( deltaY !== 0 ) {
					this.moveLayer( layer, 0, deltaY );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to vertical center of key object
		 */
		alignCenterV() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const keyObject = this.getKeyObject();
			const keyBounds = keyObject ? this.getLayerBounds( keyObject ) : null;

			let targetCenterY;
			if ( keyBounds ) {
				targetCenterY = keyBounds.centerY;
			} else {
				const combined = this.getCombinedBounds( layers );
				targetCenterY = ( combined.top + combined.bottom ) / 2;
			}

			layers.forEach( ( layer ) => {
				if ( keyObject && layer.id === keyObject.id ) {
					return;
				}
				const bounds = this.getLayerBounds( layer );
				const deltaY = targetCenterY - bounds.centerY;
				if ( deltaY !== 0 ) {
					this.moveLayer( layer, 0, deltaY );
				}
			} );

			this.finishAlignment();
		}

		/**
		 * Align selected layers to bottom edge of key object
		 */
		alignBottom() {
			const layers = this.getSelectedLayers();
			if ( layers.length < 2 ) {
				return;
			}

			const keyObject = this.getKeyObject();
			const keyBounds = keyObject ? this.getLayerBounds( keyObject ) : null;

			const targetBottom = keyBounds ?
				keyBounds.bottom :
				Math.max( ...layers.map( ( l ) => this.getLayerBounds( l ).bottom ) );

			layers.forEach( ( layer ) => {
				if ( keyObject && layer.id === keyObject.id ) {
					return;
				}
				const bounds = this.getLayerBounds( layer );
				const deltaY = targetBottom - bounds.bottom;
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
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = AlignmentController;
	}
}() );
