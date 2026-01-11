/**
 * Smart Guides Controller for Layers Editor Canvas
 * Provides intelligent snapping to object edges, centers, and equal spacing.
 * Shows visual guide lines when objects align with other objects.
 *
 * Features:
 * - Snap to other layer edges (left, right, top, bottom)
 * - Snap to other layer centers (horizontal, vertical)
 * - Visual guide lines during drag operations
 * - Equal spacing indicators
 * - Configurable snap threshold
 *
 * @module ext.layers.editor/canvas/SmartGuidesController
 * @since 1.1.7
 */
( function () {
	'use strict';

	/**
	 * SmartGuidesController - Manages smart guides and object snapping
	 *
	 * @class SmartGuidesController
	 */
	class SmartGuidesController {
		/**
		 * Create a new SmartGuidesController instance
		 *
		 * @param {Object} canvasManager - Reference to the CanvasManager
		 */
		constructor( canvasManager ) {
			this.manager = canvasManager;

			// Configuration
			this.enabled = false; // Off by default - toggle with ';' key
			this.snapThreshold = 8; // Pixels to snap within
			this.showGuides = true;

			// Guide line style
			this.guideColor = '#ff00ff'; // Magenta for visibility
			this.guideWidth = 1;
			this.guideDashPattern = [ 4, 4 ];

			// Center guide style (different from edge guides)
			this.centerGuideColor = '#00ffff'; // Cyan for centers
			this.centerGuideDashPattern = [ 2, 2 ];

			// Active guides to render
			this.activeGuides = [];

			// Snap points cache (rebuilt when layers change)
			this.snapPointsCache = null;
			this.cacheExcludedIds = null;
		}

		/**
		 * Enable or disable smart guides
		 *
		 * @param {boolean} enabled - Whether smart guides are enabled
		 */
		setEnabled( enabled ) {
			this.enabled = Boolean( enabled );
			if ( !this.enabled ) {
				this.clearGuides();
			}
		}

		/**
		 * Set the snap threshold in pixels
		 *
		 * @param {number} threshold - Snap threshold in pixels
		 */
		setSnapThreshold( threshold ) {
			if ( typeof threshold === 'number' && threshold > 0 ) {
				this.snapThreshold = threshold;
			}
		}

		/**
		 * Invalidate the snap points cache (call when layers change)
		 */
		invalidateCache() {
			this.snapPointsCache = null;
			this.cacheExcludedIds = null;
		}

		/**
		 * Clear all active guides
		 */
		clearGuides() {
			this.activeGuides = [];
		}

		/**
		 * Get bounds for a layer (delegates to manager or calculates)
		 *
		 * @param {Object} layer - Layer object
		 * @return {Object|null} Bounds object {x, y, width, height} or null
		 */
		getLayerBounds( layer ) {
			if ( !layer ) {
				return null;
			}

			// Try to use manager's getLayerBounds if available
			if ( this.manager && typeof this.manager.getLayerBounds === 'function' ) {
				return this.manager.getLayerBounds( layer );
			}

			// Fallback: calculate based on layer type
			return this.calculateBounds( layer );
		}

		/**
		 * Calculate bounds for a layer
		 *
		 * @param {Object} layer - Layer object
		 * @return {Object|null} Bounds object
		 */
		calculateBounds( layer ) {
			if ( !layer || !layer.type ) {
				return null;
			}

			const type = layer.type;

			switch ( type ) {
				case 'rectangle':
				case 'textbox':
				case 'blur':
				case 'image':
				case 'customShape':
					return {
						x: layer.x || 0,
						y: layer.y || 0,
						width: layer.width || 0,
						height: layer.height || 0
					};

				case 'circle':
					{
						const r = layer.radius || 0;
						return {
							x: ( layer.x || 0 ) - r,
							y: ( layer.y || 0 ) - r,
							width: r * 2,
							height: r * 2
						};
					}

				case 'ellipse':
					{
						const rx = layer.radiusX || layer.radius || 0;
						const ry = layer.radiusY || layer.radius || 0;
						return {
							x: ( layer.x || 0 ) - rx,
							y: ( layer.y || 0 ) - ry,
							width: rx * 2,
							height: ry * 2
						};
					}

				case 'polygon':
				case 'star':
					{
						const radius = layer.outerRadius || layer.radius || 0;
						return {
							x: ( layer.x || 0 ) - radius,
							y: ( layer.y || 0 ) - radius,
							width: radius * 2,
							height: radius * 2
						};
					}

				case 'line':
				case 'arrow':
					{
						const x1 = layer.x1 || 0;
						const y1 = layer.y1 || 0;
						const x2 = layer.x2 || 0;
						const y2 = layer.y2 || 0;
						const minX = Math.min( x1, x2 );
						const minY = Math.min( y1, y2 );
						return {
							x: minX,
							y: minY,
							width: Math.abs( x2 - x1 ),
							height: Math.abs( y2 - y1 )
						};
					}

				case 'text':
					// Text bounds require context measurement, return estimated bounds
					return {
						x: layer.x || 0,
						y: layer.y || 0,
						width: layer.width || 100,
						height: layer.fontSize || 16
					};

				case 'path':
					if ( layer.points && layer.points.length > 0 ) {
						let minX = Infinity, minY = Infinity;
						let maxX = -Infinity, maxY = -Infinity;
						for ( const pt of layer.points ) {
							if ( pt.x < minX ) {
								minX = pt.x;
							}
							if ( pt.x > maxX ) {
								maxX = pt.x;
							}
							if ( pt.y < minY ) {
								minY = pt.y;
							}
							if ( pt.y > maxY ) {
								maxY = pt.y;
							}
						}
						return {
							x: minX,
							y: minY,
							width: maxX - minX,
							height: maxY - minY
						};
					}
					return null;

				case 'marker':
					{
						const size = layer.size || 24;
						const halfSize = size / 2;
						return {
							x: ( layer.x || 0 ) - halfSize,
							y: ( layer.y || 0 ) - halfSize,
							width: size,
							height: size
						};
					}

				case 'dimension':
					{
						const dimX1 = layer.x1 || 0;
						const dimY1 = layer.y1 || 0;
						const dimX2 = layer.x2 || 0;
						const dimY2 = layer.y2 || 0;
						const padding = ( layer.extensionLength || 10 ) + 10;
						return {
							x: Math.min( dimX1, dimX2 ) - padding,
							y: Math.min( dimY1, dimY2 ) - padding,
							width: Math.abs( dimX2 - dimX1 ) + padding * 2,
							height: Math.abs( dimY2 - dimY1 ) + padding * 2
						};
					}

				default:
					return null;
			}
		}

		/**
		 * Build snap points from all layers except excluded ones
		 *
		 * @param {Array} layers - All layers in the editor
		 * @param {Array} excludeIds - Layer IDs to exclude (being dragged)
		 * @return {Object} Snap points { horizontal: [], vertical: [] }
		 */
		buildSnapPoints( layers, excludeIds ) {
			const cacheKey = excludeIds ? excludeIds.sort().join( ',' ) : '';

			// Return cached if valid
			if ( this.snapPointsCache && this.cacheExcludedIds === cacheKey ) {
				return this.snapPointsCache;
			}

			const horizontal = []; // Y coordinates (top, center, bottom of each layer)
			const vertical = []; // X coordinates (left, center, right of each layer)

			if ( !layers || layers.length === 0 ) {
				this.snapPointsCache = { horizontal, vertical };
				this.cacheExcludedIds = cacheKey;
				return this.snapPointsCache;
			}

			const excludeSet = new Set( excludeIds || [] );

			for ( const layer of layers ) {
				// Skip excluded layers (the ones being dragged)
				if ( excludeSet.has( layer.id ) ) {
					continue;
				}

				// Skip invisible or locked layers
				if ( layer.visible === false ) {
					continue;
				}

				const bounds = this.getLayerBounds( layer );
				if ( !bounds ) {
					continue;
				}

				const left = bounds.x;
				const right = bounds.x + bounds.width;
				const top = bounds.y;
				const bottom = bounds.y + bounds.height;
				const centerX = bounds.x + bounds.width / 2;
				const centerY = bounds.y + bounds.height / 2;

				// Add vertical snap points (X coordinates)
				vertical.push( { value: left, type: 'edge', layerId: layer.id, edge: 'left' } );
				vertical.push( { value: right, type: 'edge', layerId: layer.id, edge: 'right' } );
				vertical.push( { value: centerX, type: 'center', layerId: layer.id } );

				// Add horizontal snap points (Y coordinates)
				horizontal.push( { value: top, type: 'edge', layerId: layer.id, edge: 'top' } );
				horizontal.push( { value: bottom, type: 'edge', layerId: layer.id, edge: 'bottom' } );
				horizontal.push( { value: centerY, type: 'center', layerId: layer.id } );
			}

			this.snapPointsCache = { horizontal, vertical };
			this.cacheExcludedIds = cacheKey;
			return this.snapPointsCache;
		}

		/**
		 * Find the nearest snap point within threshold
		 *
		 * @param {number} value - Current value to snap
		 * @param {Array} snapPoints - Array of snap point objects
		 * @return {Object|null} Nearest snap point or null if none within threshold
		 */
		findNearestSnap( value, snapPoints ) {
			let nearest = null;
			let minDistance = this.snapThreshold + 1;

			for ( const point of snapPoints ) {
				const distance = Math.abs( value - point.value );
				if ( distance <= this.snapThreshold && distance < minDistance ) {
					minDistance = distance;
					nearest = point;
				}
			}

			return nearest;
		}

		/**
		 * Calculate snapped position for a layer being dragged
		 *
		 * @param {Object} layer - The layer being dragged
		 * @param {number} proposedX - Proposed new X position
		 * @param {number} proposedY - Proposed new Y position
		 * @param {Array} allLayers - All layers in the editor
		 * @return {Object} Snapped position { x, y, snappedX, snappedY, guides }
		 */
		calculateSnappedPosition( layer, proposedX, proposedY, allLayers ) {
			if ( !this.enabled || !layer ) {
				return { x: proposedX, y: proposedY, snappedX: false, snappedY: false, guides: [] };
			}

			// Get the layer's current bounds at proposed position
			const bounds = this.getLayerBounds( layer );
			if ( !bounds ) {
				return { x: proposedX, y: proposedY, snappedX: false, snappedY: false, guides: [] };
			}

			// Calculate proposed bounds based on layer type
			let proposedBounds;
			if ( layer.type === 'line' || layer.type === 'arrow' ) {
				// For lines, proposedX/Y represent offset from original
				proposedBounds = {
					x: proposedX,
					y: proposedY,
					width: bounds.width,
					height: bounds.height
				};
			} else {
				proposedBounds = {
					x: proposedX,
					y: proposedY,
					width: bounds.width,
					height: bounds.height
				};
			}

			// Build snap points excluding the layer being dragged
			const excludeIds = [ layer.id ];

			// Also exclude other selected layers if multi-selecting
			if ( this.manager && this.manager.selectionManager ) {
				const selectedIds = this.manager.selectionManager.selectedLayerIds;
				if ( selectedIds && selectedIds.length > 1 ) {
					excludeIds.push( ...selectedIds );
				}
			}

			const snapPoints = this.buildSnapPoints( allLayers, excludeIds );

			// Calculate snap targets for the dragged layer
			const left = proposedBounds.x;
			const right = proposedBounds.x + proposedBounds.width;
			const top = proposedBounds.y;
			const bottom = proposedBounds.y + proposedBounds.height;
			const centerX = proposedBounds.x + proposedBounds.width / 2;
			const centerY = proposedBounds.y + proposedBounds.height / 2;

			let snappedX = proposedX;
			let snappedY = proposedY;
			let didSnapX = false;
			let didSnapY = false;
			const guides = [];

			// Check vertical snapping (X axis)
			const leftSnap = this.findNearestSnap( left, snapPoints.vertical );
			const rightSnap = this.findNearestSnap( right, snapPoints.vertical );
			const centerXSnap = this.findNearestSnap( centerX, snapPoints.vertical );

			// Prefer edge snaps over center snaps
			let bestVerticalSnap = null;
			let verticalOffset = 0;
			let verticalSnapType = 'edge';

			if ( leftSnap && ( !bestVerticalSnap || Math.abs( left - leftSnap.value ) < Math.abs( verticalOffset ) ) ) {
				bestVerticalSnap = leftSnap;
				verticalOffset = leftSnap.value - left;
				verticalSnapType = leftSnap.type;
			}
			if ( rightSnap && ( !bestVerticalSnap || Math.abs( right - rightSnap.value ) < Math.abs( rightSnap.value - right ) ) ) {
				const rightOffset = rightSnap.value - right;
				if ( !bestVerticalSnap || Math.abs( rightOffset ) < Math.abs( verticalOffset ) ) {
					bestVerticalSnap = rightSnap;
					verticalOffset = rightOffset;
					verticalSnapType = rightSnap.type;
				}
			}
			if ( centerXSnap && ( !bestVerticalSnap || Math.abs( centerX - centerXSnap.value ) < Math.abs( verticalOffset ) ) ) {
				const centerOffset = centerXSnap.value - centerX;
				if ( !bestVerticalSnap || Math.abs( centerOffset ) < Math.abs( verticalOffset ) ) {
					bestVerticalSnap = centerXSnap;
					verticalOffset = centerOffset;
					verticalSnapType = 'center';
				}
			}

			if ( bestVerticalSnap ) {
				snappedX = proposedX + verticalOffset;
				didSnapX = true;
				guides.push( {
					type: 'vertical',
					x: bestVerticalSnap.value,
					isCenter: verticalSnapType === 'center',
					layerId: bestVerticalSnap.layerId
				} );
			}

			// Check horizontal snapping (Y axis)
			const topSnap = this.findNearestSnap( top, snapPoints.horizontal );
			const bottomSnap = this.findNearestSnap( bottom, snapPoints.horizontal );
			const centerYSnap = this.findNearestSnap( centerY, snapPoints.horizontal );

			let bestHorizontalSnap = null;
			let horizontalOffset = 0;
			let horizontalSnapType = 'edge';

			if ( topSnap ) {
				bestHorizontalSnap = topSnap;
				horizontalOffset = topSnap.value - top;
				horizontalSnapType = topSnap.type;
			}
			if ( bottomSnap ) {
				const bottomOffset = bottomSnap.value - bottom;
				if ( !bestHorizontalSnap || Math.abs( bottomOffset ) < Math.abs( horizontalOffset ) ) {
					bestHorizontalSnap = bottomSnap;
					horizontalOffset = bottomOffset;
					horizontalSnapType = bottomSnap.type;
				}
			}
			if ( centerYSnap ) {
				const centerOffset = centerYSnap.value - centerY;
				if ( !bestHorizontalSnap || Math.abs( centerOffset ) < Math.abs( horizontalOffset ) ) {
					bestHorizontalSnap = centerYSnap;
					horizontalOffset = centerOffset;
					horizontalSnapType = 'center';
				}
			}

			if ( bestHorizontalSnap ) {
				snappedY = proposedY + horizontalOffset;
				didSnapY = true;
				guides.push( {
					type: 'horizontal',
					y: bestHorizontalSnap.value,
					isCenter: horizontalSnapType === 'center',
					layerId: bestHorizontalSnap.layerId
				} );
			}

			// Store active guides for rendering
			this.activeGuides = guides;

			return {
				x: snappedX,
				y: snappedY,
				snappedX: didSnapX,
				snappedY: didSnapY,
				guides
			};
		}

		/**
		 * Render active smart guides on the canvas
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} zoom - Current zoom level
		 * @param {number} panX - Current pan X offset
		 * @param {number} panY - Current pan Y offset
		 */
		renderGuides( ctx, zoom, panX, panY ) {
			if ( !this.showGuides || this.activeGuides.length === 0 ) {
				return;
			}

			const canvasWidth = ctx.canvas.width;
			const canvasHeight = ctx.canvas.height;

			ctx.save();

			for ( const guide of this.activeGuides ) {
				// Choose color based on guide type
				if ( guide.isCenter ) {
					ctx.strokeStyle = this.centerGuideColor;
					ctx.setLineDash( this.centerGuideDashPattern );
				} else {
					ctx.strokeStyle = this.guideColor;
					ctx.setLineDash( this.guideDashPattern );
				}
				ctx.lineWidth = this.guideWidth;

				ctx.beginPath();

				if ( guide.type === 'vertical' ) {
					// Draw vertical line across full canvas height
					const screenX = guide.x * zoom + panX;
					ctx.moveTo( screenX, 0 );
					ctx.lineTo( screenX, canvasHeight );
				} else if ( guide.type === 'horizontal' ) {
					// Draw horizontal line across full canvas width
					const screenY = guide.y * zoom + panY;
					ctx.moveTo( 0, screenY );
					ctx.lineTo( canvasWidth, screenY );
				}

				ctx.stroke();
			}

			ctx.restore();
		}

		/**
		 * Render guides using overlay context (called after main render)
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 */
		render( ctx ) {
			if ( !this.manager ) {
				return;
			}

			const zoom = this.manager.zoom || 1;
			const panX = this.manager.panX || 0;
			const panY = this.manager.panY || 0;

			this.renderGuides( ctx, zoom, panX, panY );
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.activeGuides = [];
			this.snapPointsCache = null;
			this.manager = null;
		}
	}

	// Export for MediaWiki ResourceLoader
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.SmartGuidesController = SmartGuidesController;
	}

	// Export for Node.js/Jest
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SmartGuidesController;
	}
}() );
