/**
 * Selection Renderer for Layers Editor Canvas
 * Handles rendering of selection indicators, handles, and marquee boxes.
 * Extracted from CanvasRenderer for modularity.
 *
 * @module ext.layers.editor/canvas/SelectionRenderer
 */
( function () {
	'use strict';

	/**
	 * SelectionRenderer - Manages rendering of selection UI elements
	 *
	 * @class SelectionRenderer
	 */
	class SelectionRenderer {
		/**
		 * Create a new SelectionRenderer instance
		 *
		 * @param {Object} config - Configuration options
		 * @param {CanvasRenderingContext2D} config.ctx - Canvas 2D context to draw on
		 * @param {Function} config.getLayerById - Function to get layer by ID
		 * @param {Function} config.getLayerBounds - Function to get layer bounds
		 */
		constructor( config ) {
			this.config = config || {};
			this.ctx = config.ctx || null;
			this.getLayerById = config.getLayerById || ( () => null );
			this.getLayerBounds = config.getLayerBounds || ( () => null );

			// Selection state
			this.selectionHandles = [];

			// Style configuration
			this.handleSize = 12;
			this.handleColor = '#2196f3';
			this.handleBorderColor = '#ffffff';
			this.rotationHandleColor = '#ff9800';
			this.lineColor = '#2196f3';
			this.marqueeStrokeColor = '#007bff';
			this.marqueeFillColor = 'rgba(0, 123, 255, 0.1)';
		}

		/**
		 * Set the canvas context
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
		}

		/**
		 * Clear selection handles array
		 */
		clearHandles() {
			this.selectionHandles = [];
		}

		/**
		 * Get current selection handles
		 *
		 * @return {Array} Array of selection handle objects
		 */
		getHandles() {
			return this.selectionHandles;
		}

		/**
		 * Draw selection indicators for multiple selected layers
		 *
		 * @param {Array} selectedLayerIds - Array of selected layer IDs
		 * @param {string} [keyObjectId] - ID of the key object (last selected) for visual distinction
		 */
		drawMultiSelectionIndicators( selectedLayerIds, keyObjectId ) {
			this.selectionHandles = [];
			if ( !selectedLayerIds || selectedLayerIds.length === 0 ) {
				return;
			}
			for ( let i = 0; i < selectedLayerIds.length; i++ ) {
				const isKeyObject = selectedLayerIds.length > 1 && selectedLayerIds[ i ] === keyObjectId;
				this.drawSelectionIndicators( selectedLayerIds[ i ], isKeyObject );
			}
		}

		/**
		 * Draw selection indicators for a single layer
		 *
		 * @param {string} layerId - Layer ID to draw indicators for
		 * @param {boolean} [isKeyObject=false] - Whether this is the key object (alignment reference)
		 */
		drawSelectionIndicators( layerId, isKeyObject ) {
			if ( !this.ctx ) {
				return;
			}

			const layer = this.getLayerById( layerId );
			if ( !layer ) {
				return;
			}

			// Group layers (folders) are containers only - no canvas representation
			// They should not have selection handles drawn on the canvas
			if ( layer.type === 'group' ) {
				return;
			}

			this.ctx.save();

			// Special handling for lines and arrows: use line-aligned selection box
			if ( layer.type === 'line' || layer.type === 'arrow' ) {
				this.drawLineSelectionIndicators( layer, isKeyObject );
				this.ctx.restore();
				return;
			}

			// Special handling for dimension: use line endpoint handles like arrow
			if ( layer.type === 'dimension' ) {
				this.drawDimensionSelectionIndicators( layer, isKeyObject );
				this.ctx.restore();
				return;
			}

			// Special handling for marker: circular selection around the marker
			if ( layer.type === 'marker' ) {
				this.drawMarkerSelectionIndicators( layer, isKeyObject );
				this.ctx.restore();
				return;
			}

			const bounds = this.getLayerBounds( layer );
			if ( !bounds ) {
				this.ctx.restore();
				return;
			}

			const rotation = layer.rotation || 0;
			if ( rotation !== 0 ) {
				const centerX = bounds.x + bounds.width / 2;
				const centerY = bounds.y + bounds.height / 2;
				this.ctx.translate( centerX, centerY );
				this.ctx.rotate( rotation * Math.PI / 180 );

				// When rotated, draw handles around the unrotated bounds centered at 0,0
				const localBounds = {
					x: -bounds.width / 2,
					y: -bounds.height / 2,
					width: bounds.width,
					height: bounds.height
				};
				// Pass world-space bounds for correct hit testing coordinate calculation
				this.drawSelectionHandles( localBounds, layer, true, bounds, isKeyObject );
				this.drawRotationHandle( localBounds, layer, true, bounds );

				// Restore context before drawing callout tail handle (it handles its own transforms)
				this.ctx.restore();

				// For callouts, draw tail tip handle (drawn in world space)
				if ( layer.type === 'callout' ) {
					this.drawCalloutTailHandle( layer, bounds, isKeyObject );
				}

				return;
			} else {
				this.drawSelectionHandles( bounds, layer, false, bounds, isKeyObject );
				this.drawRotationHandle( bounds, layer, false, bounds );

				// For callouts, draw tail tip handle
				if ( layer.type === 'callout' ) {
					this.drawCalloutTailHandle( layer, bounds, isKeyObject );
				}
			}

			this.ctx.restore();
		}

		/**
		 * Draw selection handles and register them for hit testing
		 *
		 * @param {Object} bounds - Drawing bounds (local if rotated, world if not)
		 * @param {Object} layer - The layer object
		 * @param {boolean} isRotated - Whether the layer is rotated
		 * @param {Object} worldBounds - World-space bounds for hit testing calculation
		 * @param {boolean} [isKeyObject=false] - Whether this is the key object (alignment reference)
		 */
		drawSelectionHandles( bounds, layer, isRotated, worldBounds, isKeyObject ) {
			const handleSize = this.handleSize;

			const handles = [
				{ x: bounds.x, y: bounds.y, type: 'nw' },
				{ x: bounds.x + bounds.width / 2, y: bounds.y, type: 'n' },
				{ x: bounds.x + bounds.width, y: bounds.y, type: 'ne' },
				{ x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, type: 'e' },
				{ x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se' },
				{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, type: 's' },
				{ x: bounds.x, y: bounds.y + bounds.height, type: 'sw' },
				{ x: bounds.x, y: bounds.y + bounds.height / 2, type: 'w' }
			];

			// Key object gets a thicker orange border to distinguish it as the alignment reference
			if ( isKeyObject ) {
				this.ctx.fillStyle = this.handleColor;
				this.ctx.strokeStyle = '#ff9800'; // Orange border for key object
				this.ctx.lineWidth = 3;
			} else {
				this.ctx.fillStyle = this.handleColor;
				this.ctx.strokeStyle = this.handleBorderColor;
				this.ctx.lineWidth = 1;
			}
			this.ctx.setLineDash( [] );

			for ( let i = 0; i < handles.length; i++ ) {
				const h = handles[ i ];
				this.ctx.fillRect( h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize );
				this.ctx.strokeRect( h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize );

				// Transform coordinates to world space for hit testing if rotated
				let worldX = h.x;
				let worldY = h.y;

				if ( isRotated && layer.rotation ) {
					const wb = worldBounds || bounds;
					const centerX = wb.x + wb.width / 2;
					const centerY = wb.y + wb.height / 2;
					const rad = layer.rotation * Math.PI / 180;
					const cos = Math.cos( rad );
					const sin = Math.sin( rad );

					worldX = centerX + ( h.x * cos - h.y * sin );
					worldY = centerY + ( h.x * sin + h.y * cos );
				}

				this.selectionHandles.push( {
					type: h.type,
					x: worldX - handleSize / 2,
					y: worldY - handleSize / 2,
					width: handleSize,
					height: handleSize,
					layerId: layer.id,
					rotation: layer.rotation || 0
				} );
			}
		}

		/**
		 * Draw selection indicators for line/arrow layers - just endpoint handles
		 * Lines and arrows don't need a bounding box or rotation handle -
		 * they are manipulated by dragging their endpoints directly.
		 * Arrows with control points also get a draggable curve handle.
		 *
		 * @param {Object} layer - The line or arrow layer
		 * @param {boolean} [isKeyObject=false] - Whether this is the key object (alignment reference)
		 */
		drawLineSelectionIndicators( layer, isKeyObject ) {
			const handleSize = this.handleSize;

			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;

			// Key object gets a thicker orange border to distinguish it as the alignment reference
			if ( isKeyObject ) {
				this.ctx.fillStyle = this.handleColor;
				this.ctx.strokeStyle = '#ff9800'; // Orange border for key object
				this.ctx.lineWidth = 3;
			} else {
				this.ctx.fillStyle = this.handleColor;
				this.ctx.strokeStyle = this.handleBorderColor;
				this.ctx.lineWidth = 1;
			}
			this.ctx.setLineDash( [] );

			// Draw and register endpoint handles at the actual coordinates
			const endpoints = [
				{ x: x1, y: y1, type: 'w' },  // Start point (tail)
				{ x: x2, y: y2, type: 'e' }   // End point (head/tip)
			];

			for ( let i = 0; i < endpoints.length; i++ ) {
				const ep = endpoints[ i ];

				// Draw the handle
				this.ctx.fillRect( ep.x - handleSize / 2, ep.y - handleSize / 2, handleSize, handleSize );
				this.ctx.strokeRect( ep.x - handleSize / 2, ep.y - handleSize / 2, handleSize, handleSize );

				// Register handle for hit testing
				this.selectionHandles.push( {
					type: ep.type,
					x: ep.x - handleSize / 2,
					y: ep.y - handleSize / 2,
					width: handleSize,
					height: handleSize,
					layerId: layer.id,
					rotation: 0,
					isLine: true
				} );
			}

			// For arrows with control points, draw a curve control handle
			if ( layer.type === 'arrow' ) {
				this.drawCurveControlHandle( layer, x1, y1, x2, y2, handleSize, isKeyObject );
			}
		}

		/**
		 * Draw selection indicators for marker layers - circular selection around the marker
		 * If the marker has an arrow, also show the arrow endpoint handle.
		 *
		 * @param {Object} layer - The marker layer
		 * @param {boolean} [isKeyObject=false] - Whether this is the key object
		 */
		drawMarkerSelectionIndicators( layer, isKeyObject ) {
			const handleSize = this.handleSize;
			const markerSize = layer.size || 24;
			const markerRadius = markerSize / 2;
			const mx = layer.x || 0;
			const my = layer.y || 0;

			// Key object styling
			if ( isKeyObject ) {
				this.ctx.strokeStyle = '#ff9800'; // Orange border for key object
				this.ctx.lineWidth = 3;
			} else {
				this.ctx.strokeStyle = this.lineColor;
				this.ctx.lineWidth = 1.5;
			}
			this.ctx.setLineDash( [ 4, 4 ] );

			// Draw circular selection around the marker
			this.ctx.beginPath();
			this.ctx.arc( mx, my, markerRadius + 4, 0, 2 * Math.PI );
			this.ctx.stroke();
			this.ctx.setLineDash( [] );

			// Draw center handle for moving the marker
			this.ctx.fillStyle = this.handleColor;
			this.ctx.strokeStyle = isKeyObject ? '#ff9800' : this.handleBorderColor;
			this.ctx.lineWidth = isKeyObject ? 3 : 1;

			// Draw circular center handle
			this.ctx.beginPath();
			this.ctx.arc( mx, my, handleSize / 2 - 1, 0, 2 * Math.PI );
			this.ctx.fill();
			this.ctx.stroke();

			// Register center handle
			this.selectionHandles.push( {
				type: 'move',
				x: mx - handleSize / 2,
				y: my - handleSize / 2,
				width: handleSize,
				height: handleSize,
				layerId: layer.id,
				rotation: 0,
				isMarker: true
			} );

			// If marker has an arrow, draw and register the arrow endpoint handle
			if ( layer.hasArrow && layer.arrowX !== undefined && layer.arrowY !== undefined ) {
				const arrowX = layer.arrowX;
				const arrowY = layer.arrowY;

				// Draw dashed line showing the arrow connection
				this.ctx.strokeStyle = '#666';
				this.ctx.lineWidth = 1;
				this.ctx.setLineDash( [ 3, 3 ] );
				this.ctx.beginPath();
				this.ctx.moveTo( mx, my );
				this.ctx.lineTo( arrowX, arrowY );
				this.ctx.stroke();
				this.ctx.setLineDash( [] );

				// Draw arrow endpoint handle (diamond shape for distinction)
				this.ctx.fillStyle = '#ff5722'; // Orange-red for arrow point
				this.ctx.strokeStyle = isKeyObject ? '#ff9800' : this.handleBorderColor;
				this.ctx.lineWidth = isKeyObject ? 3 : 1;

				this.ctx.save();
				this.ctx.translate( arrowX, arrowY );
				this.ctx.rotate( Math.PI / 4 ); // 45° rotation for diamond
				this.ctx.fillRect( -handleSize / 2 + 1, -handleSize / 2 + 1, handleSize - 2, handleSize - 2 );
				this.ctx.strokeRect( -handleSize / 2 + 1, -handleSize / 2 + 1, handleSize - 2, handleSize - 2 );
				this.ctx.restore();

				// Register arrow endpoint handle
				this.selectionHandles.push( {
					type: 'arrowTip',
					x: arrowX - handleSize / 2,
					y: arrowY - handleSize / 2,
					width: handleSize,
					height: handleSize,
					layerId: layer.id,
					rotation: 0,
					isMarker: true,
					isArrowTip: true
				} );
			}
		}

		/**
		 * Draw selection indicators for dimension layers - endpoint handles like arrow
		 * Dimensions use line-style endpoints at the actual dimension line (offset from measurement points).
		 *
		 * @param {Object} layer - The dimension layer
		 * @param {boolean} [isKeyObject=false] - Whether this is the key object
		 */
		drawDimensionSelectionIndicators( layer, isKeyObject ) {
			const handleSize = this.handleSize;

			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;

			// Calculate the angle and perpendicular direction (same as DimensionRenderer)
			const dx = x2 - x1;
			const dy = y2 - y1;
			const angle = Math.atan2( dy, dx );
			const perpX = -Math.sin( angle );
			const perpY = Math.cos( angle );

			// Get extension line parameters (match DimensionRenderer defaults)
			let extensionLength = layer.extensionLength;
			if ( typeof extensionLength !== 'number' || isNaN( extensionLength ) ) {
				extensionLength = 10; // DEFAULTS.extensionLength from DimensionRenderer
			}
			let extensionGap = layer.extensionGap;
			if ( typeof extensionGap !== 'number' || isNaN( extensionGap ) ) {
				extensionGap = 3; // DEFAULTS.extensionGap from DimensionRenderer
			}

			// Calculate dimension line offset (same formula as DimensionRenderer)
			const offsetDistance = extensionGap + extensionLength / 2;
			const dimX1 = x1 + perpX * offsetDistance;
			const dimY1 = y1 + perpY * offsetDistance;
			const dimX2 = x2 + perpX * offsetDistance;
			const dimY2 = y2 + perpY * offsetDistance;

			// Key object styling
			if ( isKeyObject ) {
				this.ctx.fillStyle = this.handleColor;
				this.ctx.strokeStyle = '#ff9800';
				this.ctx.lineWidth = 3;
			} else {
				this.ctx.fillStyle = this.handleColor;
				this.ctx.strokeStyle = this.handleBorderColor;
				this.ctx.lineWidth = 1;
			}
			this.ctx.setLineDash( [] );

			// Draw and register endpoint handles at the actual dimension line coordinates
			const endpoints = [
				{ x: dimX1, y: dimY1, type: 'w' },  // Start point of dimension line
				{ x: dimX2, y: dimY2, type: 'e' }   // End point of dimension line
			];

			for ( let i = 0; i < endpoints.length; i++ ) {
				const ep = endpoints[ i ];

				// Draw the handle
				this.ctx.fillRect( ep.x - handleSize / 2, ep.y - handleSize / 2, handleSize, handleSize );
				this.ctx.strokeRect( ep.x - handleSize / 2, ep.y - handleSize / 2, handleSize, handleSize );

				// Register handle for hit testing
				this.selectionHandles.push( {
					type: ep.type,
					x: ep.x - handleSize / 2,
					y: ep.y - handleSize / 2,
					width: handleSize,
					height: handleSize,
					layerId: layer.id,
					rotation: 0,
					isDimension: true
				} );
			}
		}

		/**
		 * Draw a curve control handle for arrows
		 * The control handle allows users to bend the arrow into a curve.
		 *
		 * @param {Object} layer - The arrow layer
		 * @param {number} x1 - Start X coordinate
		 * @param {number} y1 - Start Y coordinate
		 * @param {number} x2 - End X coordinate
		 * @param {number} y2 - End Y coordinate
		 * @param {number} handleSize - Size of handles
		 * @param {boolean} isKeyObject - Whether this is the key object
		 */
		drawCurveControlHandle( layer, x1, y1, x2, y2, handleSize, isKeyObject ) {
			// Calculate control point position (default to midpoint if not set)
			let controlX, controlY;
			if ( typeof layer.controlX === 'number' && typeof layer.controlY === 'number' ) {
				controlX = layer.controlX;
				controlY = layer.controlY;
			} else {
				// Default: midpoint of line
				controlX = ( x1 + x2 ) / 2;
				controlY = ( y1 + y2 ) / 2;
			}

			// Draw a line from control point to the midpoint (visual connection)
			const midX = ( x1 + x2 ) / 2;
			const midY = ( y1 + y2 ) / 2;

			this.ctx.save();
			this.ctx.strokeStyle = '#9c27b0'; // Purple for curve control
			this.ctx.lineWidth = 1;
			this.ctx.setLineDash( [ 4, 4 ] );
			this.ctx.beginPath();
			this.ctx.moveTo( midX, midY );
			this.ctx.lineTo( controlX, controlY );
			this.ctx.stroke();
			this.ctx.restore();

			// Draw circular control handle (different from square endpoint handles)
			this.ctx.save();
			this.ctx.fillStyle = '#9c27b0'; // Purple for curve control
			if ( isKeyObject ) {
				this.ctx.strokeStyle = '#ff9800';
				this.ctx.lineWidth = 3;
			} else {
				this.ctx.strokeStyle = this.handleBorderColor;
				this.ctx.lineWidth = 1;
			}
			this.ctx.setLineDash( [] );

			this.ctx.beginPath();
			this.ctx.arc( controlX, controlY, handleSize / 2, 0, 2 * Math.PI );
			this.ctx.fill();
			this.ctx.stroke();
			this.ctx.restore();

			// Register control handle for hit testing
			this.selectionHandles.push( {
				type: 'control',
				x: controlX - handleSize / 2,
				y: controlY - handleSize / 2,
				width: handleSize,
				height: handleSize,
				layerId: layer.id,
				rotation: 0,
				isLine: true,
				isControl: true
			} );
		}

		/**
		 * Draw a tail tip handle for callout layers
		 * The tail handle allows users to drag the tail tip to any position.
		 *
		 * @param {Object} layer - The callout layer
		 * @param {Object} bounds - Layer bounds
		 * @param {boolean} isKeyObject - Whether this is the key object
		 */
		drawCalloutTailHandle( layer, bounds, isKeyObject ) {
			const handleSize = this.handleSize;

			// Get tail tip position
			let tipX, tipY;

			// tailTipX/tailTipY are stored in LOCAL coordinates (relative to callout center)
			// so they rotate with the shape. We need to convert to world coords for display.
			const hasExplicitTip = typeof layer.tailTipX === 'number' && typeof layer.tailTipY === 'number';

			if ( hasExplicitTip ) {
				// Use explicit tip position - stored relative to callout center in local space
				tipX = layer.tailTipX;
				tipY = layer.tailTipY;
			} else {
				// Calculate default tip position from tailDirection/tailPosition/tailSize
				// These are in local space relative to layer bounds
				const tailDirection = layer.tailDirection || 'bottom';
				const tailPosition = typeof layer.tailPosition === 'number' ? layer.tailPosition : 0.5;
				const tailSize = layer.tailSize || 20;

				const x = bounds.x;
				const y = bounds.y;
				const width = bounds.width;
				const height = bounds.height;

				// Calculate tip position based on direction (in world space for unrotated)
				switch ( tailDirection ) {
					case 'top':
					case 'top-left':
					case 'top-right':
						tipX = x + width * tailPosition;
						tipY = y - tailSize;
						break;
					case 'bottom':
					case 'bottom-left':
					case 'bottom-right':
						tipX = x + width * tailPosition;
						tipY = y + height + tailSize;
						break;
					case 'left':
						tipX = x - tailSize;
						tipY = y + height * tailPosition;
						break;
					case 'right':
						tipX = x + width + tailSize;
						tipY = y + height * tailPosition;
						break;
					default:
						tipX = x + width * 0.5;
						tipY = y + height + tailSize;
				}
			}

			// For explicit tailTipX/tailTipY (local coords) or legacy positions, apply rotation
			if ( layer.rotation ) {
				const centerX = bounds.x + bounds.width / 2;
				const centerY = bounds.y + bounds.height / 2;
				const rad = layer.rotation * Math.PI / 180;
				const cos = Math.cos( rad );
				const sin = Math.sin( rad );

				if ( hasExplicitTip ) {
					// tailTipX/tailTipY are relative to center in local space
					// Rotate to get world position
					tipX = centerX + ( layer.tailTipX * cos - layer.tailTipY * sin );
					tipY = centerY + ( layer.tailTipX * sin + layer.tailTipY * cos );
				} else {
					// Legacy: rotate around center
					const dx = tipX - centerX;
					const dy = tipY - centerY;
					tipX = centerX + ( dx * cos - dy * sin );
					tipY = centerY + ( dx * sin + dy * cos );
				}
			} else if ( hasExplicitTip ) {
				// No rotation - tailTipX/tailTipY are relative to center
				const centerX = bounds.x + bounds.width / 2;
				const centerY = bounds.y + bounds.height / 2;
				tipX = centerX + layer.tailTipX;
				tipY = centerY + layer.tailTipY;
			}

			// Draw a line from the callout center to the tail tip (visual connection)
			const centerX = bounds.x + bounds.width / 2;
			const centerY = bounds.y + bounds.height / 2;

			this.ctx.save();
			this.ctx.strokeStyle = '#4caf50'; // Green for tail control
			this.ctx.lineWidth = 1;
			this.ctx.setLineDash( [ 4, 4 ] );
			this.ctx.beginPath();
			this.ctx.moveTo( centerX, centerY );
			this.ctx.lineTo( tipX, tipY );
			this.ctx.stroke();
			this.ctx.restore();

			// Draw diamond-shaped tail handle (different from square resize handles and circular control handles)
			this.ctx.save();
			this.ctx.fillStyle = '#4caf50'; // Green for tail control
			if ( isKeyObject ) {
				this.ctx.strokeStyle = '#ff9800';
				this.ctx.lineWidth = 3;
			} else {
				this.ctx.strokeStyle = this.handleBorderColor;
				this.ctx.lineWidth = 1;
			}
			this.ctx.setLineDash( [] );

			// Draw diamond shape
			const diamondSize = handleSize * 0.7;
			this.ctx.beginPath();
			this.ctx.moveTo( tipX, tipY - diamondSize );
			this.ctx.lineTo( tipX + diamondSize, tipY );
			this.ctx.lineTo( tipX, tipY + diamondSize );
			this.ctx.lineTo( tipX - diamondSize, tipY );
			this.ctx.closePath();
			this.ctx.fill();
			this.ctx.stroke();
			this.ctx.restore();

			// Register tail handle for hit testing
			this.selectionHandles.push( {
				type: 'tailTip',
				x: tipX - handleSize / 2,
				y: tipY - handleSize / 2,
				width: handleSize,
				height: handleSize,
				layerId: layer.id,
				rotation: 0,
				isCalloutTail: true
			} );
		}

		/**
		 * Draw rotation handle and register it for hit testing
		 *
		 * @param {Object} bounds - Drawing bounds (local if rotated, world if not)
		 * @param {Object} layer - The layer object
		 * @param {boolean} isRotated - Whether the layer is rotated
		 * @param {Object} worldBounds - World-space bounds for hit testing calculation
		 */
		drawRotationHandle( bounds, layer, isRotated, worldBounds ) {
			const handleSize = this.handleSize;
			const rotationHandleOffset = 20;

			const rotationHandleX = bounds.x + bounds.width / 2;
			const rotationHandleY = bounds.y - rotationHandleOffset;

			// Draw connecting line
			this.ctx.strokeStyle = this.lineColor;
			this.ctx.lineWidth = 1;
			this.ctx.setLineDash( [] );
			this.ctx.beginPath();
			this.ctx.moveTo( bounds.x + bounds.width / 2, bounds.y );
			this.ctx.lineTo( rotationHandleX, rotationHandleY );
			this.ctx.stroke();

			// Draw circular rotation handle
			this.ctx.fillStyle = this.rotationHandleColor;
			this.ctx.strokeStyle = this.handleBorderColor;
			this.ctx.beginPath();
			this.ctx.arc( rotationHandleX, rotationHandleY, handleSize / 2, 0, 2 * Math.PI );
			this.ctx.fill();
			this.ctx.stroke();

			// Transform coordinates to world space for hit testing if rotated
			let worldX = rotationHandleX;
			let worldY = rotationHandleY;

			if ( isRotated && layer.rotation ) {
				const wb = worldBounds || bounds;
				const centerX = wb.x + wb.width / 2;
				const centerY = wb.y + wb.height / 2;
				const rad = layer.rotation * Math.PI / 180;
				const cos = Math.cos( rad );
				const sin = Math.sin( rad );

				worldX = centerX + ( rotationHandleX * cos - rotationHandleY * sin );
				worldY = centerY + ( rotationHandleX * sin + rotationHandleY * cos );
			}

			this.selectionHandles.push( {
				type: 'rotate',
				x: worldX - handleSize / 2,
				y: worldY - handleSize / 2,
				width: handleSize,
				height: handleSize,
				layerId: layer.id,
				rotation: layer.rotation || 0
			} );
		}

		/**
		 * Draw marquee selection box
		 *
		 * @param {Object} marqueeRect - Rectangle object { x, y, width, height }
		 */
		drawMarqueeBox( marqueeRect ) {
			if ( !marqueeRect || !this.ctx ) {
				return;
			}

			this.ctx.save();
			this.ctx.strokeStyle = this.marqueeStrokeColor;
			this.ctx.fillStyle = this.marqueeFillColor;
			this.ctx.lineWidth = 1;
			this.ctx.setLineDash( [ 5, 5 ] );
			this.ctx.fillRect( marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height );
			this.ctx.strokeRect( marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height );
			this.ctx.restore();
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.selectionHandles = [];
			this.ctx = null;
			this.getLayerById = null;
			this.getLayerBounds = null;
			this.config = null;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.SelectionRenderer = SelectionRenderer;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SelectionRenderer;
	}

}() );
