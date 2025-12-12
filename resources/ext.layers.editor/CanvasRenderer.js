/**
 * CanvasRenderer Module for Layers Editor
 * Unified rendering engine handling all canvas drawing operations.
 * Consolidates logic from CanvasManager, RenderingCore, and LayerRenderer.
 */
( function () {
	'use strict';

	// Use shared namespace helper
	const getClass = ( window.Layers && window.Layers.Utils && window.Layers.Utils.getClass ) ||
		window.layersGetClass ||
		function ( namespacePath, globalName ) {
			return window[ globalName ] || null;
		};

	/**
	 * CanvasRenderer - Manages all canvas rendering operations
	 *
	 * @param {HTMLCanvasElement} canvas - Canvas element to render on
	 * @param {Object} config - Configuration options
	 * @class
	 */
	function CanvasRenderer( canvas, config ) {
		this.canvas = canvas;
		this.ctx = canvas.getContext( '2d' );
		this.config = config || {};
		this.editor = this.config.editor || null;

		// Canvas state management
		this.canvasStateStack = [];
		this.backgroundImage = null;

		// Transformation state
		this.zoom = 1.0;
		this.panX = 0;
		this.panY = 0;

		// Grid and rulers
		this.showGrid = false;
		this.gridSize = 20;
		this.showRulers = false;
		this.rulerSize = 20;
		this.showGuides = false;
		this.horizontalGuides = [];
		this.verticalGuides = [];

		// Selection state
		this.selectedLayerIds = [];
		this.selectionHandles = [];
		this.rotationHandle = null;
		this.isMarqueeSelecting = false;
		this.marqueeRect = null;

		// Canvas pooling
		this.canvasPool = [];
		this.maxPoolSize = 5;

		// Layer renderer (delegated shape drawing - uses shared LayerRenderer)
		this.layerRenderer = null;

		this.init();
	}

	CanvasRenderer.prototype.init = function () {
		this.ctx.imageSmoothingEnabled = true;
		this.ctx.imageSmoothingQuality = 'high';

		// Initialize LayerRenderer for shape drawing delegation
		// Uses shared LayerRenderer (ext.layers.shared) for consistency with viewer
		const LayerRenderer = getClass( 'Canvas.LayerRenderer', 'LayerRenderer' );
		if ( LayerRenderer ) {
			this.layerRenderer = new LayerRenderer( this.ctx, {
				zoom: this.zoom,
				backgroundImage: this.backgroundImage,
				canvas: this.canvas
			} );
		}
	};

	CanvasRenderer.prototype.setTransform = function ( zoom, panX, panY ) {
		this.zoom = zoom;
		this.panX = panX;
		this.panY = panY;
		// Sync zoom to LayerRenderer
		if ( this.layerRenderer ) {
			this.layerRenderer.setZoom( zoom );
		}
	};

	CanvasRenderer.prototype.setBackgroundImage = function ( img ) {
		this.backgroundImage = img;
		// Sync background to LayerRenderer (for blur effects)
		if ( this.layerRenderer ) {
			this.layerRenderer.setBackgroundImage( img );
		}
	};

	CanvasRenderer.prototype.setSelection = function ( selectedLayerIds ) {
		this.selectedLayerIds = selectedLayerIds || [];
	};

	CanvasRenderer.prototype.setMarquee = function ( isSelecting, rect ) {
		this.isMarqueeSelecting = isSelecting;
		this.marqueeRect = rect;
	};

	CanvasRenderer.prototype.setGuides = function ( show, hGuides, vGuides ) {
		this.showGuides = show;
		this.horizontalGuides = hGuides || [];
		this.verticalGuides = vGuides || [];
	};

	CanvasRenderer.prototype.clear = function () {
		this.ctx.save();
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );
		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
		this.ctx.restore();
	};

	CanvasRenderer.prototype.redraw = function ( layers ) {
		this.clear();
		this.applyTransformations();

		if ( this.backgroundImage && this.backgroundImage.complete ) {
			this.drawBackgroundImage();
		}

		if ( this.showGrid ) {
			this.drawGrid();
		}

		if ( this.showRulers ) {
			this.drawRulers();
		}

		if ( layers && layers.length > 0 ) {
			this.renderLayers( layers );
		}

		this.drawGuides();
		this.drawGuidePreview();
		this.drawMultiSelectionIndicators();
		this.drawMarqueeBox();
	};

	CanvasRenderer.prototype.applyTransformations = function () {
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );
		this.ctx.translate( this.panX, this.panY );
		this.ctx.scale( this.zoom, this.zoom );
	};

	CanvasRenderer.prototype.drawBackgroundImage = function () {
		if ( !this.backgroundImage ) {
			// Draw placeholder
			this.ctx.save();
			this.ctx.fillStyle = '#ffffff';
			this.ctx.fillRect( 0, 0, this.canvas.width, this.canvas.height );
			
			// Checker pattern
			this.ctx.fillStyle = '#f0f0f0';
			const checkerSize = 20;
			for ( let x = 0; x < this.canvas.width; x += checkerSize * 2 ) {
				for ( let y = 0; y < this.canvas.height; y += checkerSize * 2 ) {
					this.ctx.fillRect( x, y, checkerSize, checkerSize );
					this.ctx.fillRect( x + checkerSize, y + checkerSize, checkerSize, checkerSize );
				}
			}
			
			this.ctx.fillStyle = '#666666';
			this.ctx.font = '24px Arial';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';
			this.ctx.fillText( 'No image loaded', this.canvas.width / 2, this.canvas.height / 2 );
			this.ctx.restore();
			return;
		}
		this.ctx.drawImage( this.backgroundImage, 0, 0 );
	};

	CanvasRenderer.prototype.renderLayers = function ( layers ) {
		if ( !Array.isArray( layers ) ) {
			return;
		}
		// Render in reverse order (bottom to top) if that's how the array is structured,
		// or normal order if array is bottom-to-top.
		// CanvasManager loop was: for ( var i = layers.length - 1; i >= 0; i-- )
		// which implies layers[0] is top? No, usually layers[0] is bottom.
		// Let's check CanvasManager.renderLayers.
		// CanvasManager.js: for ( var i = layers.length - 1; i >= 0; i-- )
		// This means layers[length-1] is drawn first? No, loop goes backwards.
		// If i=length-1 is drawn first, then it's at the bottom.
		// So layers array is Top-to-Bottom.
		for ( let i = layers.length - 1; i >= 0; i-- ) {
			const layer = layers[ i ];
			if ( layer && layer.visible !== false ) {
				// Special handling for blur layers - blur everything rendered so far
				if ( layer.type === 'blur' ) {
					this.drawBlurEffect( layer );
				} else {
					this.drawLayerWithEffects( layer );
				}
			}
		}
	};

	/**
	 * Draw a blur effect that blurs everything below it (background + layers)
	 *
	 * @param {Object} layer - Blur layer with x, y, width, height, blurRadius
	 */
	CanvasRenderer.prototype.drawBlurEffect = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const w = layer.width || 0;
		const h = layer.height || 0;

		if ( w <= 0 || h <= 0 ) {
			return;
		}

		const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );

		this.ctx.save();

		// Apply layer opacity and blend mode
		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
		}
		if ( layer.blend ) {
			try {
				this.ctx.globalCompositeOperation = String( layer.blend );
			} catch ( e ) {
				this.ctx.globalCompositeOperation = 'source-over';
			}
		}

		try {
			// Create a temp canvas to capture what's been drawn so far
			const tempCanvas = document.createElement( 'canvas' );
			tempCanvas.width = Math.max( 1, Math.ceil( w ) );
			tempCanvas.height = Math.max( 1, Math.ceil( h ) );
			const tempCtx = tempCanvas.getContext( '2d' );

			if ( tempCtx ) {
				// Copy the region from the main canvas to temp canvas
				// We need to account for the current transform (zoom/pan)
				tempCtx.drawImage(
					this.canvas,
					x * this.zoom + this.panX,
					y * this.zoom + this.panY,
					w * this.zoom,
					h * this.zoom,
					0, 0,
					tempCanvas.width,
					tempCanvas.height
				);

				// Apply blur filter and draw back
				this.ctx.filter = 'blur(' + radius + 'px)';
				this.ctx.drawImage( tempCanvas, x, y, w, h );
				this.ctx.filter = 'none';
			}
		} catch ( e ) {
			// Fallback: gray overlay
			this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
			this.ctx.fillRect( x, y, w, h );
		}

		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawLayerWithEffects = function ( layer ) {
		this.ctx.save();
		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
		}
		if ( layer.blend ) {
			try {
				this.ctx.globalCompositeOperation = String( layer.blend );
			} catch ( blendError ) {
				// Invalid blend mode - fall back to default 'source-over'
				mw.log.warn( '[CanvasRenderer] Invalid blend mode "' + layer.blend + '":', blendError.message );
				this.ctx.globalCompositeOperation = 'source-over';
			}
		}

		// Shadow
		if ( layer.shadow ) {
			this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
			this.ctx.shadowBlur = Math.round( layer.shadowBlur || 8 );
			this.ctx.shadowOffsetX = Math.round( layer.shadowOffsetX || 2 );
			this.ctx.shadowOffsetY = Math.round( layer.shadowOffsetY || 2 );
		} else {
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		try {
			this.drawLayer( layer );

			// Glow effect
			if ( layer.glow && this.supportsGlow( layer.type ) ) {
				this.drawGlow( layer );
			}
		} finally {
			this.ctx.restore();
		}
	};

	CanvasRenderer.prototype.supportsGlow = function ( type ) {
		return [ 'rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'arrow', 'path' ].indexOf( type ) !== -1;
	};

	CanvasRenderer.prototype.drawGlow = function ( layer ) {
		const prevAlpha = this.ctx.globalAlpha;
		this.ctx.globalAlpha = ( prevAlpha || 1 ) * 0.3;
		this.ctx.save();
		this.ctx.strokeStyle = ( layer.stroke || '#000' );
		this.ctx.lineWidth = ( layer.strokeWidth || 1 ) + 6;
		// Re-draw shape outline for glow
		// This is a simplified version, ideally we'd reuse the path
		this.drawLayerShapeOnly( layer );
		this.ctx.restore();
		this.ctx.globalAlpha = prevAlpha;
	};

	CanvasRenderer.prototype.drawLayerShapeOnly = function ( layer ) {
		// Helper to draw just the path/shape for glow effect
		// This duplicates some logic but avoids full drawLayer overhead
		switch ( layer.type ) {
			case 'rectangle':
				this.ctx.strokeRect( layer.x || 0, layer.y || 0, layer.width || 0, layer.height || 0 );
				break;
			case 'circle':
				this.ctx.beginPath();
				this.ctx.arc( layer.x || 0, layer.y || 0, layer.radius || 0, 0, 2 * Math.PI );
				this.ctx.stroke();
				break;
			case 'ellipse':
				this.ctx.save();
				this.ctx.translate( layer.x || 0, layer.y || 0 );
				this.ctx.scale( layer.radiusX || 1, layer.radiusY || 1 );
				this.ctx.beginPath();
				this.ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
				this.ctx.stroke();
				this.ctx.restore();
				break;
			// Add others as needed
		}
	};

	/**
	 * Draw a layer using the shared LayerRenderer
	 * LayerRenderer is a required dependency (ext.layers.shared)
	 *
	 * @param {Object} layer - Layer to draw
	 */
	CanvasRenderer.prototype.drawLayer = function ( layer ) {
		if ( this.layerRenderer ) {
			this.layerRenderer.drawLayer( layer );
		}
	};

	// --- UI Rendering (Selection, Guides, etc.) ---

	CanvasRenderer.prototype.drawMultiSelectionIndicators = function () {
		this.selectionHandles = [];
		if ( !this.selectedLayerIds || this.selectedLayerIds.length === 0 ) {
			return;
		}
		for ( let i = 0; i < this.selectedLayerIds.length; i++ ) {
			this.drawSelectionIndicators( this.selectedLayerIds[ i ] );
		}
	};

	CanvasRenderer.prototype.drawSelectionIndicators = function ( layerId ) {
		// We need the layer object. Since we don't have direct access to editor.getLayerById here easily
		// unless we pass it or look it up.
		// We can pass the layer object instead of ID, or rely on this.editor.
		if ( !this.editor ) {
			return;
		}
		const layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			return;
		}

		this.ctx.save();

		// Special handling for lines and arrows: use line-aligned selection box
		if ( layer.type === 'line' || layer.type === 'arrow' ) {
			this.drawLineSelectionIndicators( layer );
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
			// When rotated, we draw handles around the unrotated bounds centered at 0,0
			// But wait, if we translate/rotate context, the coordinates for drawing are local.
			// But for hit testing, we need world coordinates.
			// This complicates hit testing if we store transformed coordinates.
			// For now, let's store the handles as they are drawn (transformed).
			// Actually, if we rotate context, the rects we draw are aligned with local axes.
			// But on screen they are rotated.
			// Hit testing usually happens in world space.
			// If we want to hit test rotated handles, we need to rotate the point or the handles.
			// CanvasManager.hitTestSelectionHandles uses simple rect intersection.
			// This implies handles are axis-aligned in world space?
			// If rotation is supported, handles should rotate with the object.
			// If CanvasManager doesn't support rotated hit testing, then we have a problem.
			// But let's stick to drawing first.
			
			// We need to pass the effective bounds for drawing handles.
			// If we rotated the context, we draw at relative coordinates.
			const localBounds = {
				x: -bounds.width / 2,
				y: -bounds.height / 2,
				width: bounds.width,
				height: bounds.height
			};
			// Pass world-space bounds for correct hit testing coordinate calculation
			this.drawSelectionHandles( localBounds, layer, true, bounds );
			this.drawRotationHandle( localBounds, layer, true, bounds );
		} else {
			this.drawSelectionHandles( bounds, layer, false, bounds );
			this.drawRotationHandle( bounds, layer, false, bounds );
		}

		this.ctx.restore();
	};

	/**
	 * Draw selection handles and register them for hit testing
	 *
	 * @param {Object} bounds - Drawing bounds (local if rotated, world if not)
	 * @param {Object} layer - The layer object
	 * @param {boolean} isRotated - Whether the layer is rotated
	 * @param {Object} worldBounds - World-space bounds for hit testing calculation
	 */
	CanvasRenderer.prototype.drawSelectionHandles = function ( bounds, layer, isRotated, worldBounds ) {
		const handleSize = 12;
		const handleColor = '#2196f3';
		const handleBorderColor = '#ffffff';

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

		this.ctx.fillStyle = handleColor;
		this.ctx.strokeStyle = handleBorderColor;
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [] );

		for ( let i = 0; i < handles.length; i++ ) {
			const h = handles[ i ];
			this.ctx.fillRect( h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize );
			this.ctx.strokeRect( h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize );

			// Store handle for hit testing
			// If isRotated, the coordinates h.x/h.y are in local rotated space.
			// We need to transform them back to world space for hit testing.
			let worldX = h.x;
			let worldY = h.y;
			
			if ( isRotated && layer.rotation ) {
				// We are currently in a rotated context centered at layer center.
				// We need to transform (h.x, h.y) which are relative to center, back to world.
				// Use worldBounds to get correct center for all layer types (including text)
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
				rotation: layer.rotation || 0 // Store rotation if needed
			} );
		}
	};

	/**
	 * Draw selection indicators for line/arrow layers - just endpoint handles
	 * Lines and arrows don't need a bounding box or rotation handle - 
	 * they are manipulated by dragging their endpoints directly.
	 *
	 * @param {Object} layer - The line or arrow layer
	 */
	CanvasRenderer.prototype.drawLineSelectionIndicators = function ( layer ) {
		const handleSize = 12;
		const handleColor = '#2196f3';
		const handleBorderColor = '#ffffff';

		const x1 = layer.x1 || 0;
		const y1 = layer.y1 || 0;
		const x2 = layer.x2 || 0;
		const y2 = layer.y2 || 0;

		this.ctx.fillStyle = handleColor;
		this.ctx.strokeStyle = handleBorderColor;
		this.ctx.lineWidth = 1;
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
	};

	/**
	 * Draw rotation handle and register it for hit testing
	 *
	 * @param {Object} bounds - Drawing bounds (local if rotated, world if not)
	 * @param {Object} layer - The layer object
	 * @param {boolean} isRotated - Whether the layer is rotated
	 * @param {Object} worldBounds - World-space bounds for hit testing calculation
	 */
	CanvasRenderer.prototype.drawRotationHandle = function ( bounds, layer, isRotated, worldBounds ) {
		const handleSize = 12;
		const handleColor = '#ff9800';
		const handleBorderColor = '#ffffff';
		const lineColor = '#2196f3';

		const rotationHandleX = bounds.x + bounds.width / 2;
		const rotationHandleY = bounds.y - 20;

		this.ctx.strokeStyle = lineColor;
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [] );
		this.ctx.beginPath();
		this.ctx.moveTo( bounds.x + bounds.width / 2, bounds.y );
		this.ctx.lineTo( rotationHandleX, rotationHandleY );
		this.ctx.stroke();

		this.ctx.fillStyle = handleColor;
		this.ctx.strokeStyle = handleBorderColor;
		this.ctx.beginPath();
		this.ctx.arc( rotationHandleX, rotationHandleY, handleSize / 2, 0, 2 * Math.PI );
		this.ctx.fill();
		this.ctx.stroke();

		// Add to selection handles for hit testing
		// Rotation handle is circular, but we can use a rect for hit testing
		
		let worldX = rotationHandleX;
		let worldY = rotationHandleY;

		if ( isRotated && layer.rotation ) {
			// Transform local coordinates back to world coordinates
			// Use worldBounds to get correct center for all layer types (including text)
			const wb = worldBounds || bounds;
			const centerX = wb.x + wb.width / 2;
			const centerY = wb.y + wb.height / 2;
			const rad = layer.rotation * Math.PI / 180;
			const cos = Math.cos( rad );
			const sin = Math.sin( rad );
			
			// rotationHandleX/Y are relative to the rotated context origin (which is centerX, centerY)
			// because bounds passed in are localBounds (centered at 0,0)
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
	};

	CanvasRenderer.prototype.drawMarqueeBox = function () {
		if ( !this.isMarqueeSelecting || !this.marqueeRect ) {
			return;
		}
		const rect = this.marqueeRect;
		this.ctx.save();
		this.ctx.strokeStyle = '#007bff';
		this.ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [ 5, 5 ] );
		this.ctx.fillRect( rect.x, rect.y, rect.width, rect.height );
		this.ctx.strokeRect( rect.x, rect.y, rect.width, rect.height );
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawGrid = function () {
		const size = this.gridSize || 20;

		this.ctx.save();
		this.ctx.strokeStyle = '#e9ecef';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [] );

		// We need to account for pan/zoom if we want grid to move with canvas,
		// but usually grid is drawn in world coordinates.
		// Since we applied transform in redraw(), we are drawing in world coordinates.
		// But we need to cover the visible area.
		// For simplicity, let's draw a large enough grid or calculate visible bounds.
		// The original code drew from 0 to canvas.width/height which implies screen coordinates?
		// No, if transform is applied, 0,0 is world origin.
		// If we want infinite grid, we need to calculate bounds.
		// For now, let's just draw a fixed large area or match original behavior.
		// Original behavior: 0 to canvas.width. This is likely wrong if zoomed/panned.
		// But let's keep it simple and maybe improve later.
		// Actually, let's try to cover the visible area.
		const left = -this.panX / this.zoom;
		const top = -this.panY / this.zoom;
		const right = ( this.canvas.width - this.panX ) / this.zoom;
		const bottom = ( this.canvas.height - this.panY ) / this.zoom;

		// Snap to grid
		const startX = Math.floor( left / size ) * size;
		const startY = Math.floor( top / size ) * size;

		this.ctx.beginPath();
		for ( let x = startX; x < right; x += size ) {
			this.ctx.moveTo( x, top );
			this.ctx.lineTo( x, bottom );
		}
		for ( let y = startY; y < bottom; y += size ) {
			this.ctx.moveTo( left, y );
			this.ctx.lineTo( right, y );
		}
		this.ctx.stroke();
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawRulers = function () {
		// Rulers should be drawn in screen space (fixed to top/left)
		// So we need to reset transform temporarily.
		this.ctx.save();
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );

		const size = this.rulerSize;
		const w = this.canvas.width;
		const h = this.canvas.height;

		this.ctx.fillStyle = '#f3f3f3';
		this.ctx.fillRect( 0, 0, w, size );
		this.ctx.fillRect( 0, 0, size, h );

		this.ctx.strokeStyle = '#ddd';
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		this.ctx.moveTo( 0, size + 0.5 );
		this.ctx.lineTo( w, size + 0.5 );
		this.ctx.moveTo( size + 0.5, 0 );
		this.ctx.lineTo( size + 0.5, h );
		this.ctx.stroke();

		// Draw ticks... (simplified for now)
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawGuides = function () {
		if ( !this.showGuides ) {
			return;
		}
		this.ctx.save();
		this.ctx.strokeStyle = '#26c6da';
		this.ctx.lineWidth = 1 / this.zoom; // Keep line width constant on screen
		this.ctx.setLineDash( [ 4 / this.zoom, 4 / this.zoom ] );

		// Guides are in world coordinates
		// We need to draw them across the visible area
		const top = -this.panY / this.zoom;
		const bottom = ( this.canvas.height - this.panY ) / this.zoom;
		const left = -this.panX / this.zoom;
		const right = ( this.canvas.width - this.panX ) / this.zoom;

		for ( let i = 0; i < this.verticalGuides.length; i++ ) {
			const gx = this.verticalGuides[ i ];
			this.ctx.beginPath();
			this.ctx.moveTo( gx, top );
			this.ctx.lineTo( gx, bottom );
			this.ctx.stroke();
		}
		for ( let j = 0; j < this.horizontalGuides.length; j++ ) {
			const gy = this.horizontalGuides[ j ];
			this.ctx.beginPath();
			this.ctx.moveTo( left, gy );
			this.ctx.lineTo( right, gy );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	CanvasRenderer.prototype.drawGuidePreview = function () {
		// This requires state about dragging guide.
		// We can pass it in or set it.
		// For now, let's assume the controller handles the preview by drawing it manually or we add state.
		// Let's add state methods: setDragGuide(orientation, pos)
		if ( !this.dragGuide ) {
			return;
		}
		this.ctx.save();
		this.ctx.strokeStyle = '#ff4081';
		this.ctx.lineWidth = 1 / this.zoom;
		this.ctx.setLineDash( [ 8 / this.zoom, 4 / this.zoom ] );

		const top = -this.panY / this.zoom;
		const bottom = ( this.canvas.height - this.panY ) / this.zoom;
		const left = -this.panX / this.zoom;
		const right = ( this.canvas.width - this.panX ) / this.zoom;

		if ( this.dragGuide.orientation === 'h' ) {
			this.ctx.beginPath();
			this.ctx.moveTo( left, this.dragGuide.pos );
			this.ctx.lineTo( right, this.dragGuide.pos );
			this.ctx.stroke();
		} else {
			this.ctx.beginPath();
			this.ctx.moveTo( this.dragGuide.pos, top );
			this.ctx.lineTo( this.dragGuide.pos, bottom );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	CanvasRenderer.prototype.setDragGuide = function ( orientation, pos ) {
		if ( orientation ) {
			this.dragGuide = { orientation: orientation, pos: pos };
		} else {
			this.dragGuide = null;
		}
	};

	// --- Helpers ---

	CanvasRenderer.prototype.applyLayerStyle = function ( layer ) {
		if ( layer.fill ) {
			this.ctx.fillStyle = layer.fill;
		} else if ( layer.color ) {
			this.ctx.fillStyle = layer.color;
		}
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
		}
		if ( layer.strokeWidth ) {
			this.ctx.lineWidth = layer.strokeWidth;
		}
		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
		}
		if ( layer.blendMode || layer.blend ) {
			this.ctx.globalCompositeOperation = layer.blendMode || layer.blend;
		}
		if ( layer.rotation ) {
			const centerX = ( layer.x || 0 ) + ( layer.width || 0 ) / 2;
			const centerY = ( layer.y || 0 ) + ( layer.height || 0 ) / 2;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( layer.rotation * Math.PI / 180 );
			this.ctx.translate( -centerX, -centerY );
		}
	};

	CanvasRenderer.prototype.withLocalAlpha = function ( factor, fn ) {
		const f = ( typeof factor === 'number' ) ? Math.max( 0, Math.min( 1, factor ) ) : 1;
		if ( f === 1 ) {
			fn();
			return;
		}
		const prev = this.ctx.globalAlpha;
		this.ctx.globalAlpha = ( prev || 1 ) * f;
		try {
			fn();
		} finally {
			this.ctx.globalAlpha = prev;
		}
	};

	CanvasRenderer.prototype.clearShadow = function () {
		this.ctx.shadowColor = 'transparent';
		this.ctx.shadowBlur = 0;
		this.ctx.shadowOffsetX = 0;
		this.ctx.shadowOffsetY = 0;
	};

	CanvasRenderer.prototype.getLayerBounds = function ( layer ) {
		// Uses TextUtils/GeometryUtils for bounds calculation
		if ( !layer ) {
			return null;
		}
		const baseBounds = this._getRawLayerBounds( layer );
		if ( !baseBounds ) {
			return null;
		}
		return baseBounds; // Simplified for now, rotation handled in drawSelectionIndicators
	};

	CanvasRenderer.prototype._getRawLayerBounds = function ( layer ) {
		// Handle text layers specially - they need canvas context for measurement
		if ( layer && layer.type === 'text' ) {
			const canvasWidth = this.canvas ? this.canvas.width : 0;
			const metrics = window.TextUtils.measureTextLayer( layer, this.ctx, canvasWidth );
			return metrics ? { x: metrics.originX, y: metrics.originY, width: metrics.width, height: metrics.height } : null;
		}
		// Use GeometryUtils for all other layer types
		return window.GeometryUtils.getLayerBoundsForType( layer );
	};

	CanvasRenderer.prototype.drawErrorPlaceholder = function ( layer ) {
		this.ctx.save();
		this.ctx.fillStyle = '#ff9999';
		this.ctx.strokeStyle = '#cc0000';
		this.ctx.lineWidth = 2;

		const x = layer.x || 0;
		const y = layer.y || 0;
		const width = layer.width || 50;
		const height = layer.height || 50;

		this.ctx.fillRect( x, y, width, height );
		this.ctx.strokeRect( x, y, width, height );

		// Draw error icon (X)
		this.ctx.strokeStyle = '#ffffff';
		this.ctx.lineWidth = 3;
		this.ctx.beginPath();
		this.ctx.moveTo( x + 10, y + 10 );
		this.ctx.lineTo( x + width - 10, y + height - 10 );
		this.ctx.moveTo( x + width - 10, y + 10 );
		this.ctx.lineTo( x + 10, y + height - 10 );
		this.ctx.stroke();

		this.ctx.restore();
	};

	/**
	 * Clean up resources
	 */
	CanvasRenderer.prototype.destroy = function () {
		// Clear canvas pool
		if ( this.canvasPool && this.canvasPool.length > 0 ) {
			this.canvasPool.forEach( function ( pooledCanvas ) {
				pooledCanvas.width = 0;
				pooledCanvas.height = 0;
			} );
			this.canvasPool = [];
		}

		// Clear canvas state stack
		this.canvasStateStack = [];

		// Clear selection state
		this.selectedLayerIds = [];
		this.selectionHandles = [];
		this.rotationHandle = null;
		this.marqueeRect = null;

		// Clear guides
		this.horizontalGuides = [];
		this.verticalGuides = [];

		// Destroy layer renderer
		if ( this.layerRenderer && typeof this.layerRenderer.destroy === 'function' ) {
			this.layerRenderer.destroy();
		}
		this.layerRenderer = null;

		// Clear references
		this.backgroundImage = null;
		this.canvas = null;
		this.ctx = null;
		this.config = null;
		this.editor = null;
	};

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.Renderer = CanvasRenderer;

		// Backward compatibility - direct window export
		window.CanvasRenderer = CanvasRenderer;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CanvasRenderer;
	}

}() );
