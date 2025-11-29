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
			fill: 'transparent',
			// Default arrow style for new arrows
			arrowStyle: 'single',
			// Initialize shadow properties with defaults (can be updated via updateStyle)
			shadow: false,
			shadowColor: '#000000',
			shadowBlur: 8,
			shadowOffsetX: 2,
			shadowOffsetY: 2
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
		const cursor = this.getToolCursor( this.currentTool );
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
			case 'highlight':
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
	 */
	ToolManager.prototype.startTool = function ( point ) {
		this.isDrawing = true;
		this.startPoint = point;

		// eslint-disable-next-line no-console


		switch ( this.currentTool ) {
			// Pointer tool is handled by CanvasManager directly
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
			case 'highlight':
				this.startHighlightTool( point );
				break;
		}
	};

	/**
	 * Handle tool update (mouse move)
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updateTool = function ( point ) {
		if ( !this.isDrawing ) {
			return;
		}

		switch ( this.currentTool ) {
			// Pointer tool is handled by CanvasManager directly
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
			case 'highlight':
				this.updateHighlightTool( point );
				break;
		}
	};

	/**
	 * Handle tool finish (mouse up)
	 *
	 * @param {Object} point End point
	 */
	ToolManager.prototype.finishTool = function ( point ) {
		if ( !this.isDrawing ) {
			return;
		}

		switch ( this.currentTool ) {
			// Pointer tool is handled by CanvasManager directly
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
			case 'highlight':
				this.finishShapeDrawing( point );
				break;
		}

		this.isDrawing = false;
		this.startPoint = null;
	};

	/*
	 * The following selection-related methods are now obsolete, as the logic
	 * has been moved to CanvasManager for better integration with hit-testing
	 * and state management. They are kept here for reference but are no longer called.
	 */
	/*
	ToolManager.prototype.startSelection = function ( point, event ) { ... };
	ToolManager.prototype.updateSelection = function ( point, event ) { ... };
	ToolManager.prototype.finishSelection = function ( point, event ) { ... };
	*/

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
			fill: 'none',
			// Apply shadow properties from currentStyle
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: this.currentStyle.shadowBlur || 8,
			shadowOffsetX: this.currentStyle.shadowOffsetX || 2,
			shadowOffsetY: this.currentStyle.shadowOffsetY || 2
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
			fill: this.currentStyle.fill,
			// Apply shadow properties from currentStyle
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: this.currentStyle.shadowBlur || 8,
			shadowOffsetX: this.currentStyle.shadowOffsetX || 2,
			shadowOffsetY: this.currentStyle.shadowOffsetY || 2
		};
	};

	/**
	 * Start highlight tool
	 *
	 * @param {Object} point Starting point
	 */
	ToolManager.prototype.startHighlightTool = function ( point ) {
		let color = this.currentStyle.fill;
		if ( !color || color === 'transparent' || color === 'none' ) {
			color = this.currentStyle.color || '#ffff00';
		}

		let opacity = this.currentStyle.fillOpacity;
		if ( typeof opacity !== 'number' || Number.isNaN( opacity ) ) {
			opacity = 0.3;
		} else {
			opacity = Math.max( 0, Math.min( 1, opacity ) );
		}

		this.tempLayer = {
			type: 'highlight',
			x: point.x,
			y: point.y,
			width: 0,
			height: 0,
			color: color,
			opacity: opacity,
			fill: color,
			fillOpacity: opacity,
			// Apply shadow properties from currentStyle
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: this.currentStyle.shadowBlur || 8,
			shadowOffsetX: this.currentStyle.shadowOffsetX || 2,
			shadowOffsetY: this.currentStyle.shadowOffsetY || 2
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
	 * Update highlight tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updateHighlightTool = function ( point ) {
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
			fill: this.currentStyle.fill,
			// Apply shadow properties from currentStyle
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: this.currentStyle.shadowBlur || 8,
			shadowOffsetX: this.currentStyle.shadowOffsetX || 2,
			shadowOffsetY: this.currentStyle.shadowOffsetY || 2
		};
	};

	/**
	 * Update circle tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updateCircleTool = function ( point ) {
		if ( this.tempLayer && this.startPoint ) {
			const dx = point.x - this.startPoint.x;
			const dy = point.y - this.startPoint.y;
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
			fill: this.currentStyle.fill,
			// Apply shadow properties from currentStyle
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: this.currentStyle.shadowBlur || 8,
			shadowOffsetX: this.currentStyle.shadowOffsetX || 2,
			shadowOffsetY: this.currentStyle.shadowOffsetY || 2
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
			strokeWidth: this.currentStyle.strokeWidth,
			// Apply shadow properties from currentStyle
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: this.currentStyle.shadowBlur || 8,
			shadowOffsetX: this.currentStyle.shadowOffsetX || 2,
			shadowOffsetY: this.currentStyle.shadowOffsetY || 2
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
		// Apply default arrow-specific properties from currentStyle
		this.tempLayer.arrowStyle = this.currentStyle.arrowStyle || 'single';
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
			const firstPoint = this.pathPoints[ 0 ];
			const distance = Math.sqrt(
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
			const layer = {
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
			fill: this.currentStyle.fill,
			// Apply shadow properties from currentStyle
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: this.currentStyle.shadowBlur || 8,
			shadowOffsetX: this.currentStyle.shadowOffsetX || 2,
			shadowOffsetY: this.currentStyle.shadowOffsetY || 2
		};
	};

	/**
	 * Update polygon tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updatePolygonTool = function ( point ) {
		if ( this.tempLayer && this.startPoint ) {
			const dx = point.x - this.startPoint.x;
			const dy = point.y - this.startPoint.y;
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
			fill: this.currentStyle.fill,
			// Apply shadow properties from currentStyle
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: this.currentStyle.shadowBlur || 8,
			shadowOffsetX: this.currentStyle.shadowOffsetX || 2,
			shadowOffsetY: this.currentStyle.shadowOffsetY || 2
		};
	};

	/**
	 * Update star tool
	 *
	 * @param {Object} point Current point
	 */
	ToolManager.prototype.updateStarTool = function ( point ) {
		if ( this.tempLayer && this.startPoint ) {
			const dx = point.x - this.startPoint.x;
			const dy = point.y - this.startPoint.y;
			const radius = Math.sqrt( dx * dx + dy * dy );
			this.tempLayer.outerRadius = radius;
			this.tempLayer.radius = radius;
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
			case 'highlight':
				return layer.width > 1 && layer.height > 1;
			case 'circle':
				return layer.radius > 1;
			case 'ellipse':
				return layer.radiusX > 1 && layer.radiusY > 1;
			case 'line':
			case 'arrow': {
				const dx = layer.x2 - layer.x1;
				const dy = layer.y2 - layer.y1;
				return Math.sqrt( dx * dx + dy * dy ) > 1;
			}
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
		// Use canvas manager directly (RenderEngine removed as redundant)
		this.canvasManager.renderLayers( this.canvasManager.editor.layers );
		if ( this.tempLayer ) {
			this.canvasManager.drawLayer( this.tempLayer );
		}
	};

	/**
	 * Render path preview
	 */
	ToolManager.prototype.renderPathPreview = function () {
		// Use canvas manager directly (RenderEngine removed as redundant)
		this.canvasManager.renderLayers( this.canvasManager.editor.layers );

		// Draw path preview
		if ( this.pathPoints.length > 0 ) {
			const ctx = this.canvasManager.ctx;
			ctx.save();
			ctx.strokeStyle = this.currentStyle.color;
			ctx.lineWidth = this.currentStyle.strokeWidth;
			ctx.setLineDash( [ 5, 5 ] );

			ctx.beginPath();
			ctx.moveTo( this.pathPoints[ 0 ].x, this.pathPoints[ 0 ].y );
			for ( let i = 1; i < this.pathPoints.length; i++ ) {
				ctx.lineTo( this.pathPoints[ i ].x, this.pathPoints[ i ].y );
			}
			ctx.stroke();

			// Draw points
			ctx.fillStyle = this.currentStyle.color;
			this.pathPoints.forEach( ( point ) => {
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

		// Add to layers array via StateManager (fixes bug where unshift on getLayers() copy was lost)
		if ( this.canvasManager.editor.stateManager &&
			typeof this.canvasManager.editor.stateManager.addLayer === 'function' ) {
			this.canvasManager.editor.stateManager.addLayer( layer );
		} else {
			// Fallback: get layers, modify, and set back (triggers setter)
			const layers = this.canvasManager.editor.layers || [];
			layers.unshift( layer );
			this.canvasManager.editor.layers = layers;
		}

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
		const currentLayers = this.canvasManager.editor.stateManager ? 
			this.canvasManager.editor.stateManager.getLayers() : 
			this.canvasManager.editor.layers;
		this.canvasManager.renderLayers( currentLayers );

		// Update layer panel
		if ( this.canvasManager.editor.layerPanel ) {
			this.canvasManager.editor.layerPanel.updateLayers( currentLayers );
		}
	};

	/**
	 * Show text editor
	 *
	 * @param {Object} point Position to show editor
	 */
	ToolManager.prototype.showTextEditor = function ( point ) {
		this.hideTextEditor();

		const input = document.createElement( 'input' );
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
		input.style.zIndex = '1001'; // Higher z-index

		const self = this;
		input.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' ) {
				self.finishTextEditing( input, point );
			} else if ( e.key === 'Escape' ) {
				self.hideTextEditor();
			}
		} );

		input.addEventListener( 'blur', () => {
			self.finishTextEditing( input, point );
		} );

		// Append to the main editor container for correct stacking context
		if ( this.canvasManager.editor && this.canvasManager.editor.ui && this.canvasManager.editor.ui.mainContainer ) {
			this.canvasManager.editor.ui.mainContainer.appendChild( input );
		} else {
			this.canvasManager.container.appendChild( input );
		}
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
		const text = input.value.trim();
		if ( text ) {
			const layer = {
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

	/*
	 * The following hit-testing methods are now obsolete, as the logic
	 * has been moved to CanvasManager for better accuracy and centralization.
	 */
	/*
	ToolManager.prototype.hitTestLayers = function ( point ) { ... };
	ToolManager.prototype.pointInLayer = function ( point, layer ) { ... };
	*/

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
		for ( const prop in style ) {
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
		const copy = {};
		for ( const prop in this.currentStyle ) {
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
	window.ToolManager = ToolManager;

}() );
