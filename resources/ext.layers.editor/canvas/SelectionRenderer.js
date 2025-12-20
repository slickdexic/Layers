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

			this.ctx.save();

			// Special handling for lines and arrows: use line-aligned selection box
			if ( layer.type === 'line' || layer.type === 'arrow' ) {
				this.drawLineSelectionIndicators( layer, isKeyObject );
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
			} else {
				this.drawSelectionHandles( bounds, layer, false, bounds, isKeyObject );
				this.drawRotationHandle( bounds, layer, false, bounds );
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
