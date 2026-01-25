/**
 * Tool Manager for Layers Editor
 * Handles tool-specific behaviors and drawing operations
 */
( function() {
	'use strict';

	// Import extracted modules(available as globals from ResourceLoader)
	const ToolRegistry = window.ToolRegistry;
	const ToolStyles = window.ToolStyles;
	const ShapeFactory = window.ShapeFactory;
	const TextToolHandler = window.Layers && window.Layers.Tools && window.Layers.Tools.TextToolHandler;
	const PathToolHandler = window.Layers && window.Layers.Tools && window.Layers.Tools.PathToolHandler;

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
	 * @class
	 */
class ToolManager {
	/**
	 * @param {Object} config Configuration object
	 * @param {CanvasManager} canvasManager Reference to the canvas manager
	 */
	constructor( config, canvasManager ) {
		this.config = config || {};
		this.canvasManager = canvasManager;

		// Tool state
		this.currentTool = 'pointer';
		this.isDrawing = false;
		this.startPoint = null;
		this.tempLayer = null;

		// Initialize extracted modules
		this._initializeModules();

		// Path drawing state (fallback if PathToolHandler unavailable)
		this.pathPoints = [];
		this.isPathComplete = false;

		// Text editing state (fallback if TextToolHandler unavailable)
		this.textEditor = null;
		this.editingTextLayer = null;
	}

	/**
	 * Initialize extracted modules if available
	 */
	_initializeModules() {
		// Use ToolStyles if available
		if( ToolStyles ) {
			this.styleManager = new ToolStyles();
			// Keep currentStyle as reference for backward compatibility
			this.currentStyle = this.styleManager.currentStyle;
		} else {
			// Fallback: inline style management
			this.styleManager = null;
			this.currentStyle = {
				color: '#000000',
				strokeWidth: 2,
				fontSize: 16,
				fontFamily: 'Arial, sans-serif',
				fill: 'transparent',
				arrowStyle: 'single',
				shadow: false,
				shadowColor: '#000000',
				shadowBlur: 8,
				shadowOffsetX: 2,
				shadowOffsetY: 2
			};
		}

		// Use ShapeFactory if available
		if( ShapeFactory ) {
			this.shapeFactory = new ShapeFactory( { styleManager: this.styleManager } );
		} else {
			this.shapeFactory = null;
		}

		// Use ToolRegistry singleton if available
		if( ToolRegistry && window.Layers && window.Layers.Tools && window.Layers.Tools.registry ) {
			this.toolRegistry = window.Layers.Tools.registry;
		} else {
			this.toolRegistry = null;
		}

		// Initialize TextToolHandler if available
		if( TextToolHandler ) {
			this.textToolHandler = new TextToolHandler( {
				canvasManager: this.canvasManager,
				styleManager: this.styleManager,
				addLayerCallback: ( layer ) => this.addLayerToCanvas( layer )
			} );
		} else {
			this.textToolHandler = null;
		}

		// Initialize PathToolHandler if available
		if( PathToolHandler ) {
			this.pathToolHandler = new PathToolHandler( {
				canvasManager: this.canvasManager,
				styleManager: this.styleManager,
				addLayerCallback: ( layer ) => this.addLayerToCanvas( layer ),
				renderCallback: () => {
					const currentLayers = this.canvasManager.editor.stateManager ?
						this.canvasManager.editor.stateManager.getLayers() :
						this.canvasManager.editor.layers;
					this.canvasManager.renderLayers( currentLayers );
				}
			} );
		} else {
			this.pathToolHandler = null;
		}
	}

	/**
	 * Set current tool
	 *
	 * @param {string} toolName Tool name
	 */
	setTool( toolName ) {
		// Finish any current drawing operation
		this.finishCurrentDrawing();

		this.currentTool = toolName;
		this.updateCursor();

		// Tool-specific initialization
		this.initializeTool( toolName );

		// Announce tool change for screen readers
		if( window.layersAnnouncer ) {
			const toolDisplayName = this.getToolDisplayName( toolName );
			window.layersAnnouncer.announceTool( toolDisplayName );
		}
	}

	/**
	 * Get display name for a tool(for accessibility announcements)
	 *
	 * @param {string} toolName Tool name
	 * @return {string} Human-readable tool name
	 */
	getToolDisplayName( toolName ) {
		// Delegate to ToolRegistry if available
		if( this.toolRegistry && typeof this.toolRegistry.getDisplayName === 'function' ) {
			return this.toolRegistry.getDisplayName( toolName );
		}

		// Fallback: Use i18n messages if available
		if( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
			const msgKey = 'layers-tool-' + toolName;
			const msg = window.layersMessages.get( msgKey, '' );
			if( msg ) {
				return msg;
			}
		}
		// Fallback to capitalized tool name
		return toolName.charAt( 0 ).toUpperCase() + toolName.slice( 1 );
	}

	/**
	 * Get current tool
	 *
	 * @return {string} Current tool name
	 */
	getCurrentTool() {
		return this.currentTool;
	}

	/**
	 * Initialize tool-specific state
	 *
	 * @param {string} toolName Tool name
	 */
	initializeTool( toolName ) {
		switch( toolName ) {
			case 'path':
				this.pathPoints = [];
				this.isPathComplete = false;
				break;
			case 'text':
				this.hideTextEditor();
				break;
		}
	}

	/**
	 * Update cursor based on current tool
	 */
	updateCursor() {
		const cursor = this.getToolCursor( this.currentTool );
		this.canvasManager.canvas.style.cursor = cursor;
	}

	/**
	 * Get cursor for tool
	 *
	 * @param {string} toolName Tool name
	 * @return {string} CSS cursor value
	 */
	getToolCursor( toolName ) {
		// Delegate to ToolRegistry if available
		if( this.toolRegistry && typeof this.toolRegistry.getCursor === 'function' ) {
			return this.toolRegistry.getCursor( toolName );
		}

		// Fallback implementation
		switch( toolName ) {
			case 'pointer':
				return 'default';
			case 'pen':
				return 'crosshair';
			case 'rectangle':
			case 'textbox':
			case 'callout':
			case 'circle':
			case 'ellipse':
			case 'polygon':
			case 'star':
			case 'line':
			case 'arrow':
			case 'marker':
			case 'dimension':
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
	}

	/**
	 * Handle tool start(mouse down)
	 *
	 * @param {Object} point Starting point
	 */
	startTool( point ) {
		this.isDrawing = true;
		this.startPoint = point;

		switch( this.currentTool ) {
			// Pointer tool is handled by CanvasManager directly
			case 'pen':
				this.startPenDrawing( point );
				break;
			case 'rectangle':
				this.startRectangleTool( point );
				break;
			case 'textbox':
				this.startTextBoxTool( point );
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
	}

	/**
	 * Handle tool update(mouse move)
	 *
	 * @param {Object} point Current point
	 */
	updateTool( point ) {
		if( !this.isDrawing ) {
			return;
		}

		switch( this.currentTool ) {
			// Pointer tool is handled by CanvasManager directly
			case 'pen':
				this.updatePenDrawing( point );
				break;
			case 'rectangle':
			case 'textbox':
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
	}

	/**
	 * Handle tool finish(mouse up)
	 *
	 * @param {Object} point End point
	 */
	finishTool( point ) {
		if( !this.isDrawing ) {
			return;
		}

		switch( this.currentTool ) {
			// Pointer tool is handled by CanvasManager directly
			case 'pen':
				this.finishPenDrawing( point );
				break;
			case 'rectangle':
			case 'textbox':
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
	}

	/**
	 * Start pen drawing
	 *
	 * @param {Object} point Starting point
	 */
	startPenDrawing( point ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.createPath === 'function' ) {
			this.tempLayer = this.shapeFactory.createPath( point );
			return;
		}

		// Fallback implementation
		this.tempLayer = {
			type: 'path',
			points: [ { x: point.x, y: point.y } ],
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: 'none',
			// Apply shadow properties from currentStyle
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: typeof this.currentStyle.shadowBlur === 'number' ? this.currentStyle.shadowBlur : 8,
			shadowOffsetX: typeof this.currentStyle.shadowOffsetX === 'number' ? this.currentStyle.shadowOffsetX : 2,
			shadowOffsetY: typeof this.currentStyle.shadowOffsetY === 'number' ? this.currentStyle.shadowOffsetY : 2
		};
	}

	/**
	 * Update pen drawing
	 *
	 * @param {Object} point Current point
	 */
	updatePenDrawing( point ) {
		if( this.tempLayer && this.tempLayer.points ) {
			this.tempLayer.points.push( { x: point.x, y: point.y } );
			this.renderTempLayer();
		}
	}

	/**
	 * Finish pen drawing
	 *
	 * @param {Object} _point End point (unused)
	 */
	finishPenDrawing( _point ) {
		if( this.tempLayer && this.tempLayer.points && this.tempLayer.points.length > 1 ) {
			this.addLayerToCanvas( this.tempLayer );
		}
		this.tempLayer = null;
	}

	/**
	 * Start rectangle tool
	 *
	 * @param {Object} point Starting point
	 */
	startRectangleTool( point ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.createRectangle === 'function' ) {
			this.tempLayer = this.shapeFactory.createRectangle( point );
			return;
		}

		// Fallback implementation
		this.tempLayer = {
			type: 'rectangle',
			x: point.x,
			y: point.y,
			width: 0,
			height: 0,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: this.currentStyle.fill,
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: typeof this.currentStyle.shadowBlur === 'number' ? this.currentStyle.shadowBlur : 8,
			shadowOffsetX: typeof this.currentStyle.shadowOffsetX === 'number' ? this.currentStyle.shadowOffsetX : 2,
			shadowOffsetY: typeof this.currentStyle.shadowOffsetY === 'number' ? this.currentStyle.shadowOffsetY : 2
		};
	}

	/**
	 * Start text box tool
	 *
	 * @param {Object} point Starting point
	 */
	startTextBoxTool( point ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.createTextBox === 'function' ) {
			this.tempLayer = this.shapeFactory.createTextBox( point );
			return;
		}

		// Fallback implementation
		this.tempLayer = {
			type: 'textbox',
			x: point.x,
			y: point.y,
			width: 0,
			height: 0,
			text: '',
			fontSize: this.currentStyle.fontSize || 16,
			fontFamily: this.currentStyle.fontFamily || 'Arial, sans-serif',
			color: this.currentStyle.color || '#000000',
			textAlign: 'left',
			verticalAlign: 'top',
			lineHeight: 1.2,
			stroke: this.currentStyle.color || '#000000',
			strokeWidth: this.currentStyle.strokeWidth || 1,
			fill: this.currentStyle.fill || '#ffffff',
			cornerRadius: 0,
			padding: 8,
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: typeof this.currentStyle.shadowBlur === 'number' ? this.currentStyle.shadowBlur : 8,
			shadowOffsetX: typeof this.currentStyle.shadowOffsetX === 'number' ? this.currentStyle.shadowOffsetX : 2,
			shadowOffsetY: typeof this.currentStyle.shadowOffsetY === 'number' ? this.currentStyle.shadowOffsetY : 2
		};
	}

	/**
	 * Update rectangle tool
	 *
	 * @param {Object} point Current point
	 */
	updateRectangleTool( point ) {
		if( this.tempLayer && this.startPoint ) {
			this.tempLayer.x = Math.min( this.startPoint.x, point.x );
			this.tempLayer.y = Math.min( this.startPoint.y, point.y );
			this.tempLayer.width = Math.abs( point.x - this.startPoint.x );
			this.tempLayer.height = Math.abs( point.y - this.startPoint.y );
			this.renderTempLayer();
		}
	}

	/**
	 * Start circle tool
	 *
	 * @param {Object} point Starting point
	 */
	startCircleTool( point ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.createCircle === 'function' ) {
			this.tempLayer = this.shapeFactory.createCircle( point );
			return;
		}

		// Fallback implementation
		this.tempLayer = {
			type: 'circle',
			x: point.x,
			y: point.y,
			radius: 0,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: this.currentStyle.fill,
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: typeof this.currentStyle.shadowBlur === 'number' ? this.currentStyle.shadowBlur : 8,
			shadowOffsetX: typeof this.currentStyle.shadowOffsetX === 'number' ? this.currentStyle.shadowOffsetX : 2,
			shadowOffsetY: typeof this.currentStyle.shadowOffsetY === 'number' ? this.currentStyle.shadowOffsetY : 2
		};
	}

	/**
	 * Update circle tool
	 *
	 * @param {Object} point Current point
	 */
	updateCircleTool( point ) {
		if( this.tempLayer && this.startPoint ) {
			const dx = point.x - this.startPoint.x;
			const dy = point.y - this.startPoint.y;
			this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
			this.renderTempLayer();
		}
	}

	/**
	 * Start ellipse tool
	 *
	 * @param {Object} point Starting point
	 */
	startEllipseTool( point ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.createEllipse === 'function' ) {
			this.tempLayer = this.shapeFactory.createEllipse( point );
			return;
		}

		// Fallback implementation
		this.tempLayer = {
			type: 'ellipse',
			x: point.x,
			y: point.y,
			radiusX: 0,
			radiusY: 0,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: this.currentStyle.fill,
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: typeof this.currentStyle.shadowBlur === 'number' ? this.currentStyle.shadowBlur : 8,
			shadowOffsetX: typeof this.currentStyle.shadowOffsetX === 'number' ? this.currentStyle.shadowOffsetX : 2,
			shadowOffsetY: typeof this.currentStyle.shadowOffsetY === 'number' ? this.currentStyle.shadowOffsetY : 2
		};
	}

	/**
	 * Update ellipse tool
	 *
	 * @param {Object} point Current point
	 */
	updateEllipseTool( point ) {
		if( this.tempLayer && this.startPoint ) {
			// Ellipse center should be midpoint between start and current point
			// radiusX/radiusY are half the width/height
			this.tempLayer.radiusX = Math.abs( point.x - this.startPoint.x ) / 2;
			this.tempLayer.radiusY = Math.abs( point.y - this.startPoint.y ) / 2;
			this.tempLayer.x = ( this.startPoint.x + point.x ) / 2;
			this.tempLayer.y = ( this.startPoint.y + point.y ) / 2;
			this.renderTempLayer();
		}
	}

	/**
	 * Start line tool
	 *
	 * @param {Object} point Starting point
	 */
	startLineTool( point ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.createLine === 'function' ) {
			this.tempLayer = this.shapeFactory.createLine( point );
			return;
		}

		// Fallback implementation
		this.tempLayer = {
			type: this.currentTool, // 'line' or 'arrow'
			x1: point.x,
			y1: point.y,
			x2: point.x,
			y2: point.y,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: typeof this.currentStyle.shadowBlur === 'number' ? this.currentStyle.shadowBlur : 8,
			shadowOffsetX: typeof this.currentStyle.shadowOffsetX === 'number' ? this.currentStyle.shadowOffsetX : 2,
			shadowOffsetY: typeof this.currentStyle.shadowOffsetY === 'number' ? this.currentStyle.shadowOffsetY : 2
		};
	}

	/**
	 * Start arrow tool
	 *
	 * @param {Object} point Starting point
	 */
	startArrowTool( point ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.createArrow === 'function' ) {
			this.tempLayer = this.shapeFactory.createArrow( point );
			return;
		}

		// Fallback implementation
		this.startLineTool( point );
		this.tempLayer.type = 'arrow';
		this.tempLayer.arrowStyle = this.currentStyle.arrowStyle || 'single';
	}

	/**
	 * Update line/arrow tool
	 *
	 * @param {Object} point Current point
	 */
	updateLineTool( point ) {
		if( this.tempLayer ) {
			this.tempLayer.x2 = point.x;
			this.tempLayer.y2 = point.y;
			this.renderTempLayer();
		}
	}

	/**
	 * Start text tool
	 *
	 * @param {Object} point Click point
	 */
	startTextTool( point ) {
		// Delegate to TextToolHandler if available
		if( this.textToolHandler ) {
			this.textToolHandler.start( point );
			return;
		}
		// Fallback to inline implementation
		this.showTextEditor( point );
	}

	/**
	 * Handle path point
	 *
	 * @param {Object} point Current point
	 */
	handlePathPoint( point ) {
		// Delegate to PathToolHandler if available
		if( this.pathToolHandler ) {
			const completed = this.pathToolHandler.handlePoint( point );
			if( !completed ) {
				this.isDrawing = true;
			} else {
				this.isDrawing = false;
			}
			return;
		}

		// Fallback to inline implementation
		if( this.pathPoints.length === 0 ) {
			// Start new path
			this.pathPoints = [ { x: point.x, y: point.y } ];
			this.isDrawing = true;
		} else {
			// Add point to path
			this.pathPoints.push( { x: point.x, y: point.y } );
		}

		// Check for path completion(double-click or close to start)
		if( this.pathPoints.length > 2 ) {
			const firstPoint = this.pathPoints[ 0 ];
			const distance = Math.sqrt(
				Math.pow( point.x - firstPoint.x, 2 ) +
				Math.pow( point.y - firstPoint.y, 2 )
			);

			if( distance < 10 ) {
				this.completePath();
			}
		}

		this.renderPathPreview();
	}

	/**
	 * Complete path drawing
	 */
	completePath() {
		// Delegate to PathToolHandler if available
		if( this.pathToolHandler ) {
			this.pathToolHandler.complete();
			this.isDrawing = false;
			return;
		}

		// Fallback to inline implementation
		if( this.pathPoints.length > 2 ) {
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
	}

	/**
	 * Start polygon tool
	 *
	 * @param {Object} point Starting point
	 */
	startPolygonTool( point ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.createPolygon === 'function' ) {
			this.tempLayer = this.shapeFactory.createPolygon( point );
			return;
		}

		// Fallback implementation
		this.tempLayer = {
			type: 'polygon',
			x: point.x,
			y: point.y,
			radius: 0,
			sides: 6,
			stroke: this.currentStyle.color,
			strokeWidth: this.currentStyle.strokeWidth,
			fill: this.currentStyle.fill,
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: typeof this.currentStyle.shadowBlur === 'number' ? this.currentStyle.shadowBlur : 8,
			shadowOffsetX: typeof this.currentStyle.shadowOffsetX === 'number' ? this.currentStyle.shadowOffsetX : 2,
			shadowOffsetY: typeof this.currentStyle.shadowOffsetY === 'number' ? this.currentStyle.shadowOffsetY : 2
		};
	}

	/**
	 * Update polygon tool
	 *
	 * @param {Object} point Current point
	 */
	updatePolygonTool( point ) {
		if( this.tempLayer && this.startPoint ) {
			const dx = point.x - this.startPoint.x;
			const dy = point.y - this.startPoint.y;
			this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
			this.renderTempLayer();
		}
	}

	/**
	 * Start star tool
	 *
	 * @param {Object} point Starting point
	 */
	startStarTool( point ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.createStar === 'function' ) {
			this.tempLayer = this.shapeFactory.createStar( point );
			return;
		}

		// Fallback implementation
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
			shadow: this.currentStyle.shadow || false,
			shadowColor: this.currentStyle.shadowColor || '#000000',
			shadowBlur: typeof this.currentStyle.shadowBlur === 'number' ? this.currentStyle.shadowBlur : 8,
			shadowOffsetX: typeof this.currentStyle.shadowOffsetX === 'number' ? this.currentStyle.shadowOffsetX : 2,
			shadowOffsetY: typeof this.currentStyle.shadowOffsetY === 'number' ? this.currentStyle.shadowOffsetY : 2
		};
	}

	/**
	 * Update star tool
	 *
	 * @param {Object} point Current point
	 */
	updateStarTool( point ) {
		if( this.tempLayer && this.startPoint ) {
			const dx = point.x - this.startPoint.x;
			const dy = point.y - this.startPoint.y;
			const radius = Math.sqrt( dx * dx + dy * dy );
			this.tempLayer.outerRadius = radius;
			this.tempLayer.radius = radius;
			this.tempLayer.innerRadius = radius * 0.4;
			this.renderTempLayer();
		}
	}

	/**
	 * Finish shape drawing
	 *
	 * @param {Object} _point End point (unused)
	 */
	finishShapeDrawing( _point ) {
		if( this.tempLayer ) {
			// Only add layer if it has meaningful size
			if( this.hasValidSize( this.tempLayer ) ) {
				this.addLayerToCanvas( this.tempLayer );
			}
			this.tempLayer = null;
		}
	}

	/**
	 * Check if layer has valid size
	 *
	 * @param {Object} layer Layer to check
	 * @return {boolean} True if layer has valid size
	 */
	hasValidSize( layer ) {
		// Delegate to ShapeFactory if available
		if( this.shapeFactory && typeof this.shapeFactory.hasValidSize === 'function' ) {
			return this.shapeFactory.hasValidSize( layer );
		}

		// Fallback implementation
		switch( layer.type ) {
			case 'rectangle':
			case 'blur':
			case 'textbox':
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
	}

	/**
	 * Render temporary layer
	 */
	renderTempLayer() {
		// Use canvas manager directly(RenderEngine removed as redundant)
		this.canvasManager.renderLayers( this.canvasManager.editor.layers );
		if( this.tempLayer ) {
			this.canvasManager.drawLayer( this.tempLayer );
		}
	}

	/**
	 * Render path preview
	 */
	renderPathPreview() {
		// Delegate to PathToolHandler if available
		if( this.pathToolHandler ) {
			this.pathToolHandler.renderPreview();
			return;
		}

		// Fallback: Use canvas manager directly(RenderEngine removed as redundant)
		this.canvasManager.renderLayers( this.canvasManager.editor.layers );

		// Draw path preview
		if( this.pathPoints.length > 0 ) {
			const ctx = this.canvasManager.ctx;
			ctx.save();
			ctx.strokeStyle = this.currentStyle.color;
			ctx.lineWidth = this.currentStyle.strokeWidth;
			ctx.setLineDash( [ 5, 5 ] );

			ctx.beginPath();
			ctx.moveTo( this.pathPoints[ 0 ].x, this.pathPoints[ 0 ].y );
			for( let i = 1; i < this.pathPoints.length; i++ ) {
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
	}

	/**
	 * Add layer to canvas
	 *
	 * @param {Object} layer Layer to add
	 */
	addLayerToCanvas( layer ) {
		// Generate unique ID
		layer.id = this.generateLayerId();

		// Add to layers array via StateManager
		if( this.canvasManager.editor.stateManager &&
			typeof this.canvasManager.editor.stateManager.addLayer === 'function' ) {
			this.canvasManager.editor.stateManager.addLayer( layer );
		} else {
			// Fallback: get layers, modify, and set back(triggers setter)
			const layers = this.canvasManager.editor.layers || [];
			layers.unshift( layer );
			if( this.canvasManager.editor.stateManager ) {
				this.canvasManager.editor.stateManager.set( 'layers', layers );
			} else {
				this.canvasManager.editor.layers = layers;
			}
		}

		// Select new layer
		if( this.canvasManager.selectionManager ) {
			this.canvasManager.selectionManager.selectLayer( layer.id );
		}

		// Save state for undo
		if( this.canvasManager.historyManager ) {
			this.canvasManager.historyManager.saveState( 'Add ' + layer.type );
		}

		// Mark dirty and update
		this.canvasManager.editor.markDirty();
		const currentLayers = this.canvasManager.editor.stateManager ? 
			this.canvasManager.editor.stateManager.getLayers() : 
			this.canvasManager.editor.layers;
		this.canvasManager.renderLayers( currentLayers );

		// Update layer panel
		if( this.canvasManager.editor.layerPanel ) {
			this.canvasManager.editor.layerPanel.updateLayers( currentLayers );
		}
	}

	/**
	 * Show text editor
	 *
	 * @param {Object} point Position to show editor
	 */
	showTextEditor( point ) {
		// Delegate to TextToolHandler if available
		if( this.textToolHandler ) {
			this.textToolHandler.showTextEditor( point );
			return;
		}

		// Fallback to inline implementation
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
		input.style.zIndex = String( window.Layers.Constants.Z_INDEX.TEXT_INPUT );

		input.addEventListener( 'keydown', ( e ) => {
			if( e.key === 'Enter' ) {
				this.finishTextEditing( input, point );
			} else if( e.key === 'Escape' ) {
				this.hideTextEditor();
			}
		} );

		input.addEventListener( 'blur', () => {
			this.finishTextEditing( input, point );
		} );

		// Append to the main editor container for correct stacking context
		if( this.canvasManager.editor && this.canvasManager.editor.ui && this.canvasManager.editor.ui.mainContainer ) {
			this.canvasManager.editor.ui.mainContainer.appendChild( input );
		} else {
			this.canvasManager.container.appendChild( input );
		}
		this.textEditor = input;
		input.focus();
	}

	/**
	 * Hide text editor
	 */
	hideTextEditor() {
		// Delegate to TextToolHandler if available
		if( this.textToolHandler ) {
			this.textToolHandler.hideTextEditor();
			return;
		}

		// Fallback to inline implementation
		if( this.textEditor ) {
			this.textEditor.remove();
			this.textEditor = null;
		}
	}

	/**
	 * Finish text editing
	 *
	 * @param {HTMLElement} input Input element
	 * @param {Object} point Position point
	 */
	finishTextEditing( input, point ) {
		// Delegate to TextToolHandler if available
		if( this.textToolHandler ) {
			this.textToolHandler.finishTextEditing( input, point );
			return;
		}

		// Fallback to inline implementation
		const text = input.value.trim();
		if( text ) {
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
	}

	/*
	 * The following hit-testing methods are now obsolete, as the logic
	 * has been moved to CanvasManager for better accuracy and centralization.
	 */
	/*
	hitTestLayers( point ) { ... };
	pointInLayer( point, layer ) { ... };
	*/

	/**
	 * Get modifier keys from event
	 *
	 * @param {Event} event Event object
	 * @return {Object} Modifier keys state
	 */
	getModifiers( event ) {
		return {
			shift: event.shiftKey,
			ctrl: event.ctrlKey,
			alt: event.altKey,
			meta: event.metaKey
		};
	}

	/**
	 * Finish current drawing operation
	 */
	finishCurrentDrawing() {
		if( this.isDrawing ) {
			this.isDrawing = false;
			this.tempLayer = null;
			this.pathPoints = [];
		}
		this.hideTextEditor();
	}

	/**
	 * Update tool style
	 *
	 * @param {Object} style Style object
	 */
	updateStyle( style ) {
		// Delegate to ToolStyles if available
		if( this.toolStyles && typeof this.toolStyles.update === 'function' ) {
			this.toolStyles.update( style );
			// Keep currentStyle in sync for fallback code
			this.currentStyle = this.toolStyles.get();
			return;
		}

		// Fallback: Use manual property assignment for IE11 compatibility
		for( const prop in style ) {
			if( Object.prototype.hasOwnProperty.call( style, prop ) ) {
				this.currentStyle[ prop ] = style[ prop ];
			}
		}
	}

	/**
	 * Get current style
	 *
	 * @return {Object} Current style object
	 */
	getStyle() {
		// Delegate to ToolStyles if available
		if( this.toolStyles && typeof this.toolStyles.get === 'function' ) {
			return this.toolStyles.get();
		}

		// Fallback: Create shallow copy manually for IE11 compatibility
		const copy = {};
		for( const prop in this.currentStyle ) {
			if( Object.prototype.hasOwnProperty.call( this.currentStyle, prop ) ) {
				copy[ prop ] = this.currentStyle[ prop ];
			}
		}
		return copy;
	}

	/**
	 * Generate unique layer ID
	 *
	 * @return {string} Unique layer ID
	 */
	generateLayerId() {
		// Use shared IdGenerator for guaranteed uniqueness with monotonic counter
		if ( window.Layers && window.Layers.Utils && window.Layers.Utils.generateLayerId ) {
			return window.Layers.Utils.generateLayerId();
		}
		// Fallback (should not be reached in production)
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	}

	/**
	 * Clean up resources and clear state
	 */
	destroy() {
		// Finish any active drawing
		this.finishCurrentDrawing();

		// Clean up TextToolHandler if available
		if( this.textToolHandler ) {
			this.textToolHandler.destroy();
			this.textToolHandler = null;
		}

		// Clean up PathToolHandler if available
		if( this.pathToolHandler ) {
			this.pathToolHandler.destroy();
			this.pathToolHandler = null;
		}

		// Hide and clean up text editor (fallback)
		this.hideTextEditor();
		if( this.textEditor && this.textEditor.parentNode ) {
			this.textEditor.parentNode.removeChild( this.textEditor );
		}
		this.textEditor = null;
		this.editingTextLayer = null;

		// Clear state
		this.pathPoints = [];
		this.tempLayer = null;
		this.startPoint = null;
		this.currentStyle = null;

		// Clear module references
		this.toolRegistry = null;
		this.toolStyles = null;
		this.shapeFactory = null;

		// Clear references
		this.canvasManager = null;
		this.config = null;
	}
}

	// Export to window.Layers namespace(preferred)
	if( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.ToolManager = ToolManager;
	}

	// Export for Node.js/Jest testing
	if( typeof module !== 'undefined' && module.exports ) {
		module.exports = ToolManager;
	}

}() );
