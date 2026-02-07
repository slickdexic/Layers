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
			this.canvasSnapEnabled = false; // Canvas snap off by default - toggle with "'" key
			this.snapThreshold = 8; // Pixels to snap within
			this.showGuides = true;

			// Guide line style
			this.guideColor = '#ff00ff'; // Magenta for visibility
			this.guideWidth = 1;
			this.guideDashPattern = [ 4, 4 ];

			// Center guide style (different from edge guides)
			this.centerGuideColor = '#00ffff'; // Cyan for centers
			this.centerGuideDashPattern = [ 2, 2 ];

			// Canvas snap guide style (green for canvas boundaries)
			this.canvasGuideColor = '#00ff00'; // Green for canvas
			this.canvasGuideDashPattern = [ 6, 3 ];

			// Active guides to render
			this.activeGuides = [];

			// Snap points cache (rebuilt when layers change)
			this.snapPointsCache = null;
			this.cacheExcludedIds = null;
			this._cachedLayersRef = null;
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
		 * Enable or disable canvas snap
		 *
		 * @param {boolean} enabled - Whether canvas snap is enabled
		 */
		setCanvasSnapEnabled( enabled ) {
			this.canvasSnapEnabled = Boolean( enabled );
			if ( !this.canvasSnapEnabled && !this.enabled ) {
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
			this._cachedLayersRef = null;
		}

		/**
		 * Clear all active guides
		 */
		clearGuides() {
			this.activeGuides = [];
		}

		/**
		 * Get visual bounds for a layer, including stroke width and shadow
		 * Canvas strokes are center-aligned, so stroke extends strokeWidth/2 beyond geometric bounds
		 * Shadows extend based on blur, offset, and spread values
		 *
		 * @param {Object} layer - Layer object
		 * @return {Object|null} Visual bounds object {x, y, width, height, expandLeft, expandTop, expandRight, expandBottom} or null
		 */
		getVisualBounds( layer ) {
			const bounds = this.getLayerBounds( layer );
			if ( !bounds ) {
				return null;
			}

			// Calculate stroke expansion (center-aligned strokes extend half on each side)
			const strokeWidth = layer.strokeWidth || layer.lineWidth || 0;
			let strokeExpansion = 0;
			if ( strokeWidth > 0 && layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
				strokeExpansion = strokeWidth / 2;
			}

			// Calculate shadow expansion
			let shadowLeft = 0, shadowRight = 0, shadowTop = 0, shadowBottom = 0;
			const hasShadow = layer.shadow === true ||
				( typeof layer.shadow === 'object' && layer.shadow && layer.shadow.enabled !== false );

			if ( hasShadow ) {
				// Use explicit 0 check to allow zero values (0 is valid, undefined/null uses default)
				const blur = ( layer.shadowBlur !== undefined && layer.shadowBlur !== null )
					? Number( layer.shadowBlur ) : 8;
				const offsetX = ( layer.shadowOffsetX !== undefined && layer.shadowOffsetX !== null )
					? Number( layer.shadowOffsetX ) : 2;
				const offsetY = ( layer.shadowOffsetY !== undefined && layer.shadowOffsetY !== null )
					? Number( layer.shadowOffsetY ) : 2;
				const spread = Number( layer.shadowSpread ) || 0;

				// Shadow extends in all directions by blur + spread
				// Plus additional extension in the offset direction
				const baseExpansion = blur + spread;

				// Calculate expansion for each edge
				shadowLeft = Math.max( 0, baseExpansion - offsetX );
				shadowRight = Math.max( 0, baseExpansion + offsetX );
				shadowTop = Math.max( 0, baseExpansion - offsetY );
				shadowBottom = Math.max( 0, baseExpansion + offsetY );
			}

			// Combine stroke and shadow expansions (use the larger of the two for each edge)
			const expandLeft = Math.max( strokeExpansion, shadowLeft );
			const expandRight = Math.max( strokeExpansion, shadowRight );
			const expandTop = Math.max( strokeExpansion, shadowTop );
			const expandBottom = Math.max( strokeExpansion, shadowBottom );

			// Always return the expansion values so calculateSnappedPosition can use them
			return {
				x: bounds.x - expandLeft,
				y: bounds.y - expandTop,
				width: bounds.width + expandLeft + expandRight,
				height: bounds.height + expandTop + expandBottom,
				// Include expansion values for snap calculation
				expandLeft: expandLeft,
				expandTop: expandTop,
				expandRight: expandRight,
				expandBottom: expandBottom
			};
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

			// Return cached if valid (same excluded IDs AND same layers reference)
			if ( this.snapPointsCache && this.cacheExcludedIds === cacheKey &&
				this._cachedLayersRef === layers ) {
				return this.snapPointsCache;
			}

			const horizontal = []; // Y coordinates (top, center, bottom of each layer)
			const vertical = []; // X coordinates (left, center, right of each layer)

			if ( !layers || layers.length === 0 ) {
				this.snapPointsCache = { horizontal, vertical };
				this.cacheExcludedIds = cacheKey;
				this._cachedLayersRef = layers;
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

				// Use visual bounds (includes stroke width) for accurate snapping
				const bounds = this.getVisualBounds( layer );
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
			this._cachedLayersRef = layers;
			return this.snapPointsCache;
		}

		/**
		 * Build snap points for canvas edges and center
		 * These allow snapping objects to the canvas boundaries
		 *
		 * @return {Object} Snap points { horizontal: [], vertical: [] }
		 */
		buildCanvasSnapPoints() {
			const horizontal = []; // Y coordinates (top, center, bottom of canvas)
			const vertical = []; // X coordinates (left, center, right of canvas)

			// Get canvas dimensions from manager
			const canvasWidth = this.manager?.baseWidth || this.manager?.canvas?.width || 0;
			const canvasHeight = this.manager?.baseHeight || this.manager?.canvas?.height || 0;

			if ( canvasWidth <= 0 || canvasHeight <= 0 ) {
				return { horizontal, vertical };
			}

			const centerX = canvasWidth / 2;
			const centerY = canvasHeight / 2;

			// Vertical snap points (X coordinates) - left edge, center, right edge
			vertical.push( { value: 0, type: 'edge', edge: 'left', isCanvas: true } );
			vertical.push( { value: centerX, type: 'center', isCanvas: true } );
			vertical.push( { value: canvasWidth, type: 'edge', edge: 'right', isCanvas: true } );

			// Horizontal snap points (Y coordinates) - top edge, center, bottom edge
			horizontal.push( { value: 0, type: 'edge', edge: 'top', isCanvas: true } );
			horizontal.push( { value: centerY, type: 'center', isCanvas: true } );
			horizontal.push( { value: canvasHeight, type: 'edge', edge: 'bottom', isCanvas: true } );

			return { horizontal, vertical };
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
			// Check if any snapping is enabled
			if ( ( !this.enabled && !this.canvasSnapEnabled ) || !layer ) {
				return { x: proposedX, y: proposedY, snappedX: false, snappedY: false, guides: [] };
			}

			// Get the layer's visual bounds (includes stroke width for accurate edge snapping)
			const bounds = this.getVisualBounds( layer );
			if ( !bounds ) {
				return { x: proposedX, y: proposedY, snappedX: false, snappedY: false, guides: [] };
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

			// Add canvas snap points if enabled
			const canvasSnapPoints = this.canvasSnapEnabled ? this.buildCanvasSnapPoints() : { horizontal: [], vertical: [] };

			// Merge canvas snap points with object snap points
			const allVerticalSnaps = this.enabled ? [ ...snapPoints.vertical, ...canvasSnapPoints.vertical ] : canvasSnapPoints.vertical;
			const allHorizontalSnaps = this.enabled ? [ ...snapPoints.horizontal, ...canvasSnapPoints.horizontal ] : canvasSnapPoints.horizontal;

			// Get expansion values for calculating visual edges from proposed geometric position
			// expandLeft/Top/Right/Bottom tell us how far the visual bounds extend beyond the geometric bounds
			const expandLeft = bounds.expandLeft || 0;
			const expandTop = bounds.expandTop || 0;
			const expandRight = bounds.expandRight || 0;
			const expandBottom = bounds.expandBottom || 0;

			// Get geometric bounds (without expansion) for width/height calculation
			const geomWidth = bounds.width - expandLeft - expandRight;
			const geomHeight = bounds.height - expandTop - expandBottom;

			// Calculate visual snap targets for the dragged layer
			// The visual left edge is at (proposedX - expandLeft), not proposedX
			const left = proposedX - expandLeft;
			const right = proposedX + geomWidth + expandRight;
			const top = proposedY - expandTop;
			const bottom = proposedY + geomHeight + expandBottom;
			const centerX = proposedX + geomWidth / 2;
			const centerY = proposedY + geomHeight / 2;

			let snappedX = proposedX;
			let snappedY = proposedY;
			let didSnapX = false;
			let didSnapY = false;
			const guides = [];

			// Check vertical snapping (X axis) - use merged snap points
			const leftSnap = this.findNearestSnap( left, allVerticalSnaps );
			const rightSnap = this.findNearestSnap( right, allVerticalSnaps );
			const centerXSnap = this.findNearestSnap( centerX, allVerticalSnaps );

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
					isCanvas: bestVerticalSnap.isCanvas || false,
					layerId: bestVerticalSnap.layerId
				} );
			}

			// Check horizontal snapping (Y axis) - use merged snap points
			const topSnap = this.findNearestSnap( top, allHorizontalSnaps );
			const bottomSnap = this.findNearestSnap( bottom, allHorizontalSnaps );
			const centerYSnap = this.findNearestSnap( centerY, allHorizontalSnaps );

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
					isCanvas: bestHorizontalSnap.isCanvas || false,
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
		 * CSS vs Canvas Transform Architecture:
		 * ZoomPanController applies CSS transform on the canvas element:
		 *   canvas.style.transform = 'translate(panX, panY) scale(zoom)'
		 * CanvasRenderer sets context transform to identity via setTransform(1,0,0).
		 * Layers are drawn at layer coordinates; CSS handles visual zoom/pan.
		 *
		 * Therefore, guides should also be drawn at layer coordinates (not screen
		 * coordinates) - CSS will apply the same zoom/pan transformation visually.
		 * Previously this function calculated screenX = guide.x * zoom + panX, but
		 * since CSS applies the same transform, that resulted in double-transformation.
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} zoom - Current zoom level (unused - for backwards compat)
		 * @param {number} panX - Current pan X offset (unused - for backwards compat)
		 * @param {number} panY - Current pan Y offset (unused - for backwards compat)
		 */
		renderGuides( ctx, zoom, panX, panY ) {
			// Parameters zoom, panX, panY are kept for API compatibility but not used.
			// CSS handles zoom/pan via canvas element transform.
			void zoom;
			void panX;
			void panY;

			if ( !this.showGuides || this.activeGuides.length === 0 ) {
				return;
			}

			const canvasWidth = ctx.canvas.width;
			const canvasHeight = ctx.canvas.height;

			ctx.save();

			// Do NOT reset the transform - keep the same identity transform that
			// CanvasRenderer uses for layers. CSS applies zoom/pan to the canvas element.
			// Guides should be drawn at layer coordinates, matching how layers are drawn.

			for ( const guide of this.activeGuides ) {
				// Choose color based on guide type
				if ( guide.isCanvas ) {
					// Canvas snap guides - green
					ctx.strokeStyle = this.canvasGuideColor;
					ctx.setLineDash( this.canvasGuideDashPattern );
				} else if ( guide.isCenter ) {
					// Object center guides - cyan
					ctx.strokeStyle = this.centerGuideColor;
					ctx.setLineDash( this.centerGuideDashPattern );
				} else {
					// Object edge guides - magenta
					ctx.strokeStyle = this.guideColor;
					ctx.setLineDash( this.guideDashPattern );
				}
				ctx.lineWidth = this.guideWidth;

				ctx.beginPath();

				if ( guide.type === 'vertical' ) {
					// Draw vertical line at layer X coordinate across full canvas height
					// CSS transform handles converting to screen coordinates
					ctx.moveTo( guide.x, 0 );
					ctx.lineTo( guide.x, canvasHeight );
				} else if ( guide.type === 'horizontal' ) {
					// Draw horizontal line at layer Y coordinate across full canvas width
					// CSS transform handles converting to screen coordinates
					ctx.moveTo( 0, guide.y );
					ctx.lineTo( canvasWidth, guide.y );
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
