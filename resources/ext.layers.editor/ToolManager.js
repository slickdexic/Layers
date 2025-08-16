/**
 * Tool Manager for Layers Editor
 * Handles tool-specific behaviors and drawing operations
 */
( function () {
	'use strict';

	/**
	 * Minimal typedef for CanvasManager used for JSDoc references in this file.
	 *
	 * @typedef {Object} CanvasManager
	 * @property {HTMLCanvasElement} canvas
	 * @property {CanvasRenderingContext2D} ctx
	 */

	/**
	 * ToolManager class
	 *
	 * @param {Object} config Configuration object
	 * @param {CanvasManager} canvasManager Reference to the canvas manager
	 * @class
	 */
	function ToolManager( config, canvasManager ) {
		this.config = config || {};
		this.canvasManager = canvasManager;

		// Tool state
		this.currentTool = 'pointer';
		this.isDrawing = false;
		this.startPoint = null;
		this.tempLayer = null;

		// Tool settings
		this.currentStyle = {
			color: '#000000',
			strokeWidth: 2,
			fontSize: 16,
			fontFamily: 'Arial, sans-serif',
			fill: 'transparent'
		};

		// Path drawing state
		this.pathPoints = [];
		this.isPathComplete = false;

		// Text editing state
		this.textEditor = null;
		this.editingTextLayer = null;
	}

	/**
	 * Set current tool
	 *
	 * @param {string} toolName Tool name
	 */
	ToolManager.prototype.setTool = function ( toolName ) {
		// Finish any current drawing operation
		this.finishCurrentDrawing();

		this.currentTool = toolName;
		this.updateCursor();

		// Tool-specific initialization
		this.initializeTool( toolName );
	};

	/**
	 * Get current tool
	 *
	 * @return {string} Current tool name
	 */
	ToolManager.prototype.getCurrentTool = function () {
		return this.currentTool;
	};

	/**
	 * Initialize tool-specific state
	 *
	 * @param {string} toolName Tool name
	 */
	ToolManager.prototype.initializeTool = function ( toolName ) {
		switch ( toolName ) {
			case 'path':
				this.pathPoints = [];
				this.isPathComplete = false;
				break;
			case 'text':
				this.hideTextEditor();
				break;
		}
	};

	/**
	 * Update cursor based on current tool
	 */
	ToolManager.prototype.updateCursor = function () {
		var cursor = this.getToolCursor( this.currentTool );
		this.canvasManager.canvas.style.cursor = cursor;
	};

	/**
	 * Get cursor for tool
	 *
	 * @param {string} toolName Tool name
	 * @return {string} CSS cursor value
	 */
	ToolManager.prototype.getToolCursor = function ( toolName ) {
		switch ( toolName ) {
			case 'pointer':
				return 'default';
			case 'pen':
				return 'crosshair';
			case 'rectangle':
			case 'circle':
			case 'ellipse':
			case 'line':
			case 'arrow':
				return 'crosshair';
			case 'text':
				return 'text';
			case 'path':
				return 'crosshair';
			case 'pan':
				return 'grab';
			default:
				return 'default';
		}
	};

	/**
	 * Handle tool start (mouse down)
	 *
	 * @param {Object} point Starting point
	 * @param {Object} event Original event
	 */
	ToolManager.prototype.startTool = function ( point, event ) {
		this.isDrawing = true;
		this.startPoint = point;

		switch ( this.currentTool ) {
			case 'pointer':
				this.startSelection( point, event );
				break;
			case 'pen':
				this.startPenDrawing( point );
				break;
			case 'rectangle':
				this.startRectangleTool( point );
				break;
			case 'circle':
				this.startCircleTool( point );
				break;
			case 'ellipse':
				this.startEllipseTool( point );
				break;
			case 'line':
				this.startLineTool( point );
				break;
			case 'arrow':
				this.startArrowTool( point );
				break;
			case 'text':
				this.startTextTool( point );
				break;
			case 'path':
				this.handlePathPoint( point );
				break;
			case 'polygon':
				this.startPolygonTool( point );
				break;
			case 'star':
				this.startStarTool( point );
				break;
		}
	};

	/**
	 * Handle tool update (mouse move)
	 *
	 * @param {Object} point Current point
	 * @param {Object} event Original event
	 */
	ToolManager.prototype.updateTool = function ( point, event ) {
		if ( !this.isDrawing ) {
			return;
		}

		switch ( this.currentTool ) {
			case 'pointer':
				this.updateSelection( point, event );
				break;
			case 'pen':
				this.updatePenDrawing( point );
				break;
			case 'rectangle':
				this.updateRectangleTool( point );
				break;
			case 'circle':
				this.updateCircleTool( point );
				break;
			case 'ellipse':
				this.updateEllipseTool( point );
				break;
			case 'line':
			case 'arrow':
				this.updateLineTool( point );
				break;
			case 'polygon':
				this.updatePolygonTool( point );
				break;
			case 'star':
				this.updateStarTool( point );
				break;
		}
	};

	/**
	 * Handle tool finish (mouse up)
	 *
	 * @param {Object} point End point
	 * @param {Object} event Original event
	 */
	ToolManager.prototype.finishTool = function ( point, event ) {
		if ( !this.isDrawing ) {
			return;
		}

		switch ( this.currentTool ) {
			case 'pointer':
				this.finishSelection( point, event );
				break;
			case 'pen':
				this.finishPenDrawing( point );
				break;
			case 'rectangle':
			case 'circle':
			case 'ellipse':
			case 'line':
			case 'arrow':
			case 'polygon':
			case 'star':
				this.finishShapeDrawing( point );
				break;
		}

		this.isDrawing = false;
		this.startPoint = null;
	};

	/**
	 * Start selection with pointer tool
	 *
	 * @param {Object} point Starting point
	 * @param {Object} event Original event
	 */
	ToolManager.prototype.startSelection = function ( point, event ) {
		// Delegate to selection manager if available
		if ( this.canvasManager.selectionManager ) {
			// Check for handle hits first
			var handle = this.canvasManager.selectionManager.hitTestSelectionHandles( point );
			if ( handle ) {
				if ( handle.type === 'rotate' ) {
					this.canvasManager.selectionManager.startRotation( point );
				} else {
					this.canvasManager.selectionManager.startResize( handle, point );
				}
				return;
			}

			// Check for layer hits
			var hitLayer = this.hitTestLayers( point );
			if ( hitLayer ) {
				var addToSelection = event.ctrlKey || event.metaKey;
				this.canvasManager.selectionManager.selectLayer( hitLayer.id, addToSelection );
				this.canvasManager.selectionManager.startDrag( point );
			} else {
				// Start marquee selection
				this.canvasManager.selectionManager.startMarqueeSelection( point );
			}
		}
	};

	/**
	 * Update selection with pointer tool
	 *
	 * @param {Object} point Current point
	 * @param {Object} event Original event
	 */
	ToolManager.prototype.updateSelection = function ( point, event ) {
		if ( this.canvasManager.selectionManager ) {
			var sm = this.canvasManager.selectionManager;
			if ( sm.isResizing ) {
				sm.updateResize(
					point,
					this.getModifiers( event )
				);
			} else if ( sm.isRotating ) {
				sm.updateRotation( point );
			} else if ( sm.isDragging ) {
				sm.updateDrag( point );
			} else if ( sm.isMarqueeSelecting ) {
				sm.updateMarqueeSelection( point );
			}
		}
	};

	/**
	 * Finish selection with pointer tool
	 *
	 * @param {Object} point End point (unused)
	 * @param {Object} event Original event (unused)
	 */
	// eslint-disable-next-line no-unused-vars
	ToolManager.prototype.finishSelection = function ( point, event ) {
		if ( this.canvasManager.selectionManager ) {
			if ( this.canvasManager.selectionManager.isResizing ) {
				this.canvasManager.selectionManager.finishResize();
			} else if ( this.canvasManager.selectionManager.isRotating ) {
				this.canvasManager.selectionManager.finishRotation();
			} else if ( this.canvasManager.selectionManager.isDragging ) {
				this.canvasManager.selectionManager.finishDrag();
			} else if ( this.canvasManager.selectionManager.isMarqueeSelecting ) {
				this.canvasManager.selectionManager.finishMarqueeSelection();
			}
		}
	};

	/**
	 * Start pen drawing
	 *
	 * @param {Object} point Starting point
	 */
	ToolManager.prototype.startPenDrawing = function ( point ) {
		this.tempLayer = {
			type: 'path',
			points: [ { x: point.x, y: point.y } ],
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: 'none'
		};
	};

	/**
	 * Update pen drawing
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updatePenDrawing = function ( point ) {
		if ( this.tempLayer && this.tempLayer.points ) {
			this.tempLayer.points.push( { x: point.x, y: point.y } );
			this.renderTempLayer();
		}
	};

	/**
	 * Finish pen drawing
	 *
	 * @param {Object} point End point (unused)
	 */
	// eslint-disable-next-line no-unused-vars
	ToolManager.prototype.finishPenDrawing = function ( point ) {
		if ( this.tempLayer && this.tempLayer.points && this.tempLayer.points.length > 1 ) {
			this.addLayerToCanvas( this.tempLayer );
		}
		this.tempLayer = null;
	};

	/**
	 * Start rectangle tool
	 *
	 * @param {Object} point Starting point
	 */
	ToolManager.prototype.startRectangleTool = function ( point ) {
		this.tempLayer = {
			type: 'rectangle',
			x: point.x,
			y: point.y,
			width: 0,
			height: 0,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: this.currentStyle.fill
		};
	};

	/**
	 * Update rectangle tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updateRectangleTool = function ( point ) {
		if ( this.tempLayer && this.startPoint ) {
			this.tempLayer.x = Math.min( this.startPoint.x, point.x );
			this.tempLayer.y = Math.min( this.startPoint.y, point.y );
			this.tempLayer.width = Math.abs( point.x - this.startPoint.x );
			this.tempLayer.height = Math.abs( point.y - this.startPoint.y );
			this.renderTempLayer();
		}
	};

	/**
	 * Start circle tool
	 *
	 * @param {Object} point Starting point
	 */
	ToolManager.prototype.startCircleTool = function ( point ) {
		this.tempLayer = {
			type: 'circle',
			x: point.x,
			y: point.y,
			radius: 0,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: this.currentStyle.fill
		};
	};

	/**
	 * Update circle tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updateCircleTool = function ( point ) {
		if ( this.tempLayer && this.startPoint ) {
			var dx = point.x - this.startPoint.x;
			var dy = point.y - this.startPoint.y;
			this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
			this.renderTempLayer();
		}
	};

	/**
	 * Start ellipse tool
	 *
	 * @param {Object} point Starting point
	 */
	ToolManager.prototype.startEllipseTool = function ( point ) {
		this.tempLayer = {
			type: 'ellipse',
			x: point.x,
			y: point.y,
			radiusX: 0,
			radiusY: 0,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: this.currentStyle.fill
		};
	};

	/**
	 * Update ellipse tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updateEllipseTool = function ( point ) {
		if ( this.tempLayer && this.startPoint ) {
			this.tempLayer.radiusX = Math.abs( point.x - this.startPoint.x );
			this.tempLayer.radiusY = Math.abs( point.y - this.startPoint.y );
			this.renderTempLayer();
		}
	};

	/**
	 * Start line tool
	 *
	 * @param {Object} point Starting point
	 */
	ToolManager.prototype.startLineTool = function ( point ) {
		this.tempLayer = {
			type: this.currentTool, // 'line' or 'arrow'
			x1: point.x,
			y1: point.y,
			x2: point.x,
			y2: point.y,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth
		};
	};

	/**
	 * Start arrow tool
	 *
	 * @param {Object} point Starting point
	 */
	ToolManager.prototype.startArrowTool = function ( point ) {
		this.startLineTool( point );
		this.tempLayer.type = 'arrow';
	};

	/**
	 * Update line/arrow tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updateLineTool = function ( point ) {
		if ( this.tempLayer ) {
			this.tempLayer.x2 = point.x;
			this.tempLayer.y2 = point.y;
			this.renderTempLayer();
		}
	};

	/**
	 * Start text tool
	 *
	 * @param {Object} point Click point
	 */
	ToolManager.prototype.startTextTool = function ( point ) {
		this.showTextEditor( point );
	};

	/**
	 * Handle path point
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.handlePathPoint = function ( point ) {
		if ( this.pathPoints.length === 0 ) {
			// Start new path
			this.pathPoints = [ { x: point.x, y: point.y } ];
			this.isDrawing = true;
		} else {
			// Add point to path
			this.pathPoints.push( { x: point.x, y: point.y } );
		}

		// Check for path completion (double-click or close to start)
		if ( this.pathPoints.length > 2 ) {
			var firstPoint = this.pathPoints[ 0 ];
			var distance = Math.sqrt(
				Math.pow( point.x - firstPoint.x, 2 ) +
				Math.pow( point.y - firstPoint.y, 2 )
			);

			if ( distance < 10 ) {
				this.completePath();
			}
		}

		this.renderPathPreview();
	};

	/**
	 * Complete path drawing
	 */
	ToolManager.prototype.completePath = function () {
		if ( this.pathPoints.length > 2 ) {
			var layer = {
				type: 'path',
				points: this.pathPoints.slice(),
				stroke: this.currentStyle.color,
				strokeWidth: this.currentStyle.strokeWidth,
				fill: this.currentStyle.fill,
				closed: true
			};
			this.addLayerToCanvas( layer );
		}

		this.pathPoints = [];
		this.isPathComplete = false;
		this.isDrawing = false;
	};

	/**
	 * Start polygon tool
	 *
	 * @param {Object} point Starting point
	 */
	ToolManager.prototype.startPolygonTool = function ( point ) {
		this.tempLayer = {
			type: 'polygon',
			x: point.x,
			y: point.y,
			radius: 0,
			sides: 6,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: this.currentStyle.fill
		};
	};

	/**
	 * Update polygon tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updatePolygonTool = function ( point ) {
		if ( this.tempLayer && this.startPoint ) {
			var dx = point.x - this.startPoint.x;
			var dy = point.y - this.startPoint.y;
			this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
			this.renderTempLayer();
		}
	};

	/**
	 * Start star tool
	 *
	 * @param {Object} point Starting point
	 */
	ToolManager.prototype.startStarTool = function ( point ) {
		this.tempLayer = {
			type: 'star',
			x: point.x,
			y: point.y,
			outerRadius: 0,
			innerRadius: 0,
			points: 5,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: this.currentStyle.fill
		};
	};

	/**
	 * Update star tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updateStarTool = function ( point ) {
		if ( this.tempLayer && this.startPoint ) {
			var dx = point.x - this.startPoint.x;
			var dy = point.y - this.startPoint.y;
			var radius = Math.sqrt( dx * dx + dy * dy );
			this.tempLayer.outerRadius = radius;
			this.tempLayer.innerRadius = radius * 0.4;
			this.renderTempLayer();
		}
	};

	/**
	 * Finish shape drawing
	 *
	 * @param {Object} point End point (unused)
	 */
	// eslint-disable-next-line no-unused-vars
	ToolManager.prototype.finishShapeDrawing = function ( point ) {
		if ( this.tempLayer ) {
			// Only add layer if it has meaningful size
			if ( this.hasValidSize( this.tempLayer ) ) {
				this.addLayerToCanvas( this.tempLayer );
			}
			this.tempLayer = null;
		}
	};

	/**
	 * Check if layer has valid size
	 *
	 * @param {Object} layer Layer to check
	 * @return {boolean} True if layer has valid size
	 */
	ToolManager.prototype.hasValidSize = function ( layer ) {
		switch ( layer.type ) {
			case 'rectangle':
				return layer.width > 1 && layer.height > 1;
			case 'circle':
				return layer.radius > 1;
			case 'ellipse':
				return layer.radiusX > 1 && layer.radiusY > 1;
			case 'line':
			case 'arrow':
				var dx = layer.x2 - layer.x1;
				var dy = layer.y2 - layer.y1;
				return Math.sqrt( dx * dx + dy * dy ) > 1;
			case 'polygon':
			case 'star':
				return layer.radius > 1 || layer.outerRadius > 1;
			case 'path':
				return layer.points && layer.points.length > 1;
			default:
				return true;
		}
	};

	/**
	 * Render temporary layer
	 */
	ToolManager.prototype.renderTempLayer = function () {
		if ( this.canvasManager.renderEngine ) {
			this.canvasManager.renderEngine.render( this.canvasManager.editor.layers );
			if ( this.tempLayer ) {
				this.canvasManager.renderEngine.drawLayer( this.tempLayer );
			}
		} else {
			// Fallback to canvas manager
			this.canvasManager.renderLayers( this.canvasManager.editor.layers );
			if ( this.tempLayer ) {
				this.canvasManager.drawLayer( this.tempLayer );
			}
		}
	};

	/**
	 * Render path preview
	 */
	ToolManager.prototype.renderPathPreview = function () {
		if ( this.canvasManager.renderEngine ) {
			this.canvasManager.renderEngine.render( this.canvasManager.editor.layers );
		} else {
			this.canvasManager.renderLayers( this.canvasManager.editor.layers );
		}

		// Draw path preview
		if ( this.pathPoints.length > 0 ) {
			var ctx = this.canvasManager.ctx;
			ctx.save();
			ctx.strokeStyle = this.currentStyle.color;
			ctx.lineWidth = this.currentStyle.strokeWidth;
			ctx.setLineDash( [ 5, 5 ] );

			ctx.beginPath();
			ctx.moveTo( this.pathPoints[ 0 ].x, this.pathPoints[ 0 ].y );
			for ( var i = 1; i < this.pathPoints.length; i++ ) {
				ctx.lineTo( this.pathPoints[ i ].x, this.pathPoints[ i ].y );
			}
			ctx.stroke();

			// Draw points
			ctx.fillStyle = this.currentStyle.color;
			this.pathPoints.forEach( function ( point ) {
				ctx.beginPath();
				ctx.arc( point.x, point.y, 3, 0, 2 * Math.PI );
				ctx.fill();
			} );

			ctx.restore();
		}
	};

	/**
	 * Add layer to canvas
	 *
	 * @param {Object} layer Layer to add
	 */
	ToolManager.prototype.addLayerToCanvas = function ( layer ) {
		// Generate unique ID
		layer.id = this.generateLayerId();

		// Add to layers array
		this.canvasManager.editor.layers.push( layer );

		// Select new layer
		if ( this.canvasManager.selectionManager ) {
			this.canvasManager.selectionManager.selectLayer( layer.id );
		}

		// Save state for undo
		if ( this.canvasManager.historyManager ) {
			this.canvasManager.historyManager.saveState( 'Add ' + layer.type );
		}

		// Mark dirty and update
		this.canvasManager.editor.markDirty();
		this.canvasManager.renderLayers( this.canvasManager.editor.layers );

		// Update layer panel
		if ( this.canvasManager.editor.layerPanel ) {
			this.canvasManager.editor.layerPanel.updateLayers(
				this.canvasManager.editor.layers
			);
		}
	};

	/**
	 * Show text editor
	 *
	 * @param {Object} point Position to show editor
	 */
	ToolManager.prototype.showTextEditor = function ( point ) {
		this.hideTextEditor();

		var input = document.createElement( 'input' );
		input.type = 'text';
		input.className = 'layers-text-editor';
		input.style.position = 'absolute';
		input.style.left = point.x + 'px';
		input.style.top = point.y + 'px';
		input.style.fontSize = this.currentStyle.fontSize + 'px';
		input.style.fontFamily = this.currentStyle.fontFamily;
		input.style.color = this.currentStyle.color;
		input.style.border = '1px solid #ccc';
		input.style.background = 'white';
		input.style.zIndex = '1000';

		var self = this;
		input.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Enter' ) {
				self.finishTextEditing( input, point );
			} else if ( e.key === 'Escape' ) {
				self.hideTextEditor();
			}
		} );

		input.addEventListener( 'blur', function () {
			self.finishTextEditing( input, point );
		} );

		this.canvasManager.container.appendChild( input );
		this.textEditor = input;
		input.focus();
	};

	/**
	 * Hide text editor
	 */
	ToolManager.prototype.hideTextEditor = function () {
		if ( this.textEditor ) {
			this.textEditor.remove();
			this.textEditor = null;
		}
	};

	/**
	 * Finish text editing
	 *
	 * @param {HTMLElement} input Input element
	 * @param {Object} point Position point
	 */
	ToolManager.prototype.finishTextEditing = function ( input, point ) {
		var text = input.value.trim();
		if ( text ) {
			var layer = {
				type: 'text',
				x: point.x,
				y: point.y,
				text: text,
				fontSize: this.currentStyle.fontSize,
				fontFamily: this.currentStyle.fontFamily,
				color: this.currentStyle.color
			};
			this.addLayerToCanvas( layer );
		}
		this.hideTextEditor();
	};

	/**
	 * Hit test layers at point
	 *
	 * @param {Object} point Point to test
	 * @return {Object|null} Hit layer or null
	 */
	ToolManager.prototype.hitTestLayers = function ( point ) {
		var layers = this.canvasManager.editor.layers || [];

		// Test in reverse order (top to bottom)
		for ( var i = layers.length - 1; i >= 0; i-- ) {
			var layer = layers[ i ];
			if (
				layer.visible !== false &&
				this.pointInLayer( point, layer )
			) {
				return layer;
			}
		}

		return null;
	};

	/**
	 * Check if point is in layer
	 *
	 * @param {Object} point Point to test
	 * @param {Object} layer Layer to test
	 * @return {boolean} True if point is in layer
	 */
	ToolManager.prototype.pointInLayer = function ( point, layer ) {
		var bounds = this.canvasManager.getLayerBounds( layer );
		return bounds &&
			point.x >= bounds.x &&
			point.x <= bounds.x + bounds.width &&
			point.y >= bounds.y &&
			point.y <= bounds.y + bounds.height;
	};

	/**
	 * Get modifier keys from event
	 *
	 * @param {Event} event Event object
	 * @return {Object} Modifier keys state
	 */
	ToolManager.prototype.getModifiers = function ( event ) {
		return {
			shift: event.shiftKey,
			ctrl: event.ctrlKey,
			alt: event.altKey,
			meta: event.metaKey
		};
	};

	/**
	 * Finish current drawing operation
	 */
	ToolManager.prototype.finishCurrentDrawing = function () {
		if ( this.isDrawing ) {
			this.isDrawing = false;
			this.tempLayer = null;
			this.pathPoints = [];
		}
		this.hideTextEditor();
	};

	/**
	 * Update tool style
	 *
	 * @param {Object} style Style object
	 */
	ToolManager.prototype.updateStyle = function ( style ) {
		// Use manual property assignment instead of Object.assign for IE11 compatibility
		for ( var prop in style ) {
			if ( Object.prototype.hasOwnProperty.call( style, prop ) ) {
				this.currentStyle[ prop ] = style[ prop ];
			}
		}
	};

	/**
	 * Get current style
	 *
	 * @return {Object} Current style object
	 */
	ToolManager.prototype.getStyle = function () {
		// Create shallow copy manually for IE11 compatibility
		var copy = {};
		for ( var prop in this.currentStyle ) {
			if ( Object.prototype.hasOwnProperty.call( this.currentStyle, prop ) ) {
				copy[ prop ] = this.currentStyle[ prop ];
			}
		}
		return copy;
	};

	/**
	 * Generate unique layer ID
	 *
	 * @return {string} Unique layer ID
	 */
	ToolManager.prototype.generateLayerId = function () {
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	};

	// Export ToolManager to global scope
	window.LayersToolManager = ToolManager;

}() );
