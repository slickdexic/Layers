/**
 * Drawing Controller - Handles shape drawing and tool operations for the Layers extension
 *
 * This module extracts drawing logic from CanvasManager.js to provide a focused,
 * maintainable controller for all shape creation tools.
 *
 * Responsibilities:
 * - Starting/continuing/finishing drawing operations
 * - Tool-specific initialization (rectangle, circle, line, arrow, etc.)
 * - Drawing preview during creation
 * - Creating layer data from completed drawings
 * - Tool cursor management
 *
 * @class DrawingController
 */
( function () {
	'use strict';

	/**
	 * DrawingController class
	 */
class DrawingController {
	/**
	 * Creates a new DrawingController instance
	 *
	 * @param {Object} canvasManager - Reference to the parent CanvasManager
	 */
	constructor( canvasManager ) {
		this.canvasManager = canvasManager;
		this.tempLayer = null;
		this.isDrawing = false;

		// Minimum size thresholds for shape creation
		this.MIN_SHAPE_SIZE = 5;
		this.MIN_LINE_LENGTH = 5;
		this.MIN_PATH_POINTS = 2;
	}

	/**
	 * Start a drawing operation based on the current tool
	 *
	 * @param {Object} point - {x, y} starting point in canvas coordinates
	 * @param {string} tool - Current tool name
	 * @param {Object} style - Current style options
	 */
	startDrawing( point, tool, style ) {
		// Reset any previous temp layer
		this.tempLayer = null;
		this.isDrawing = true;
		this.startPoint = { x: point.x, y: point.y }; // Store start point for tools that need it

		// Prepare for drawing based on current tool
		switch ( tool ) {
			case 'text':
				this.startTextTool( point, style );
				break;
			case 'pen':
				this.startPenTool( point, style );
				break;
			case 'rectangle':
				this.startRectangleTool( point, style );
				break;
			case 'textbox':
				this.startTextBoxTool( point, style );
				break;
			case 'callout':
				this.startCalloutTool( point, style );
				break;
			case 'circle':
				this.startCircleTool( point, style );
				break;
			case 'ellipse':
				this.startEllipseTool( point, style );
				break;
			case 'polygon':
				this.startPolygonTool( point, style );
				break;
			case 'star':
				this.startStarTool( point, style );
				break;
			case 'line':
				this.startLineTool( point, style );
				break;
			case 'arrow':
				this.startArrowTool( point, style );
				break;
			case 'marker':
				this.startMarkerTool( point, style );
				break;
			case 'dimension':
				this.startDimensionTool( point, style );
				break;
			default:
				// Unknown tool - do nothing
				break;
		}
	}

	/**
	 * Continue drawing operation as mouse moves
	 *
	 * @param {Object} point - Current mouse position {x, y}
	 */
	continueDrawing ( point ) {
		if ( this.tempLayer ) {
			this.updatePreview( point );
		}
	}

	/**
	 * Finish drawing operation and create layer
	 *
	 * @param {Object} point - Final mouse position {x, y}
	 * @param {string} _currentTool - Current tool name (unused but kept for API compatibility)
	 * @return {Object|null} Layer data if valid, null otherwise
	 */
	finishDrawing ( point, _currentTool ) {
		this.isDrawing = false;

		// Finish drawing and create layer
		const layerData = this.createLayerFromDrawing( point );

		// Clean up
		this.tempLayer = null;

		return layerData;
	}

	/**
	 * Get the current temporary layer being drawn
	 *
	 * @return {Object|null} Temporary layer or null
	 */
	getTempLayer () {
		return this.tempLayer;
	}

	/**
	 * Check if currently drawing
	 *
	 * @return {boolean} True if drawing in progress
	 */
	getIsDrawing () {
		return this.isDrawing;
	}

	/**
	 * Set drawing state
	 *
	 * @param {boolean} value - New drawing state
	 */
	setIsDrawing ( value ) {
		this.isDrawing = value;
	}

	// ========== Tool-specific start methods ==========

	/**
	 * Start text tool - creates text input modal
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startTextTool ( point, style ) {
		// Text tool delegates to the canvas manager's modal creation
		// as it requires DOM manipulation outside the drawing scope
		this.isDrawing = false;

		if ( this.canvasManager && typeof this.canvasManager.createTextInputModal === 'function' ) {
			const modal = this.canvasManager.createTextInputModal( point, style );
			document.body.appendChild( modal );

			// Focus on text input
			const textInput = modal.querySelector( '.text-input' );
			if ( textInput ) {
				textInput.focus();
			}
		}
	}

	/**
	 * Start pen tool - creates a path for free-hand drawing
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startPenTool ( point, style ) {
		this.tempLayer = {
			type: 'path',
			points: [ point ],
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: 'none'
		};
	}

	/**
	 * Start rectangle tool
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startRectangleTool ( point, style ) {
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'rectangle',
			x: point.x,
			y: point.y,
			width: 0,
			height: 0,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	}

	/**
	 * Start text box tool - creates a rectangle with text content
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startTextBoxTool ( point, style ) {
		this.tempLayer = {
			type: 'textbox',
			x: point.x,
			y: point.y,
			width: 0,
			height: 0,
			text: '',
			fontSize: style.fontSize || 16,
			fontFamily: style.fontFamily || 'Arial, sans-serif',
			color: style.color || '#000000',
			textAlign: 'left',
			verticalAlign: 'top',
			lineHeight: 1.2,
			// Rectangle properties - stroke is transparent by default for cleaner look
			stroke: 'transparent',
			strokeWidth: 0,
			fill: style.fill || '#ffffff',
			cornerRadius: 0,
			padding: 8
		};
	}

	/**
	 * Start callout tool - creates a speech bubble with tail
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startCalloutTool( point, style ) {
		this.tempLayer = {
			type: 'callout',
			x: point.x,
			y: point.y,
			width: 0,
			height: 0,
			text: '',
			fontSize: style.fontSize || 16,
			fontFamily: style.fontFamily || 'Arial, sans-serif',
			color: style.color || '#000000',
			textAlign: 'center',
			verticalAlign: 'middle',
			lineHeight: 1.2,
			// Callout has visible stroke to show the bubble shape and tail
			stroke: style.stroke || '#000000',
			strokeWidth: style.strokeWidth || 1,
			fill: style.fill || '#ffffff',
			cornerRadius: 8,
			padding: 12,
			tailDirection: 'bottom',
			tailPosition: 0.5,
			tailSize: 20
		};
	}

	/**
	 * Start marker tool - places a numbered marker at the click point
	 * Markers are placed immediately on click (not drag-created)
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options (includes markerDefaults)
	 */
	startMarkerTool( point, style ) {
		// Get next marker value from existing layers
		// Layers are on editor.layers, not canvasManager.layers
		const layers = this.canvasManager && this.canvasManager.editor && this.canvasManager.editor.layers ?
			this.canvasManager.editor.layers : [];
		const MarkerRenderer = ( typeof window !== 'undefined' &&
			window.Layers && window.Layers.MarkerRenderer ) ?
			window.Layers.MarkerRenderer : null;

		const nextValue = MarkerRenderer ?
			MarkerRenderer.getNextValue( layers ) : 1;

		this.tempLayer = {
			type: 'marker',
			x: point.x,
			y: point.y,
			value: nextValue,
			style: style.style || 'circled',
			size: style.size || 24,
			fontSizeAdjust: style.fontSizeAdjust || 0,
			fontFamily: style.fontFamily || 'Arial, sans-serif',
			fontWeight: 'bold',
			fill: style.fill || '#ffffff',
			stroke: style.stroke || style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			color: style.color || '#000000',
			hasArrow: style.hasArrow || false,
			arrowX: point.x,
			arrowY: point.y + 50,
			arrowStyle: style.arrowStyle || 'arrow',
			visible: true,
			locked: false,
			opacity: 1,
			name: ( typeof mw !== 'undefined' && mw.message )
				? mw.message( 'layers-marker-name', nextValue ).text()
				: 'Marker ' + nextValue
		};
	}

	/**
	 * Start dimension tool
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startDimensionTool( point, style ) {
		this.tempLayer = {
			type: 'dimension',
			x1: point.x,
			y1: point.y,
			x2: point.x,
			y2: point.y,
			stroke: style.stroke || style.color || '#000000',
			strokeWidth: style.strokeWidth || 1,
			fontSize: style.fontSize || 12,
			fontFamily: style.fontFamily || 'Arial, sans-serif',
			color: style.color || '#000000',
			endStyle: style.endStyle || 'arrow',
			textPosition: style.textPosition || 'above',
			extensionLength: style.extensionLength || 10,
			extensionGap: style.extensionGap || 3,
			dimensionOffset: style.dimensionOffset || 15,
			arrowSize: style.arrowSize || 8,
			tickSize: style.tickSize || 6,
			unit: style.unit || 'px',
			scale: style.scale || 1,
			showUnit: style.showUnit !== false,
			showBackground: style.showBackground !== false,
			backgroundColor: style.backgroundColor || '#ffffff',
			precision: style.precision !== undefined ? style.precision : 0,
			toleranceType: style.toleranceType || 'none',
			toleranceValue: style.toleranceValue || 0,
			toleranceUpper: style.toleranceUpper || 0,
			toleranceLower: style.toleranceLower || 0,
			text: '', // Empty = auto-calculate
			visible: true,
			locked: false,
			opacity: 1,
			name: 'Dimension'
		};
	}

	/**
	 * Start circle tool
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startCircleTool ( point, style ) {
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'circle',
			x: point.x,
			y: point.y,
			radius: 0,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	}

	/**
	 * Start ellipse tool
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startEllipseTool ( point, style ) {
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'ellipse',
			x: point.x,
			y: point.y,
			radiusX: 0,
			radiusY: 0,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	}

	/**
	 * Start polygon tool
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startPolygonTool ( point, style ) {
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'polygon',
			x: point.x,
			y: point.y,
			radius: 0,
			sides: 6, // Default hexagon
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	}

	/**
	 * Start star tool
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startStarTool ( point, style ) {
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'star',
			x: point.x,
			y: point.y,
			radius: 0,
			outerRadius: 0,
			innerRadius: 0,
			points: 5, // Default 5-pointed star
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	}

	/**
	 * Start line tool
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startLineTool ( point, style ) {
		this.tempLayer = {
			type: 'line',
			x1: point.x,
			y1: point.y,
			x2: point.x,
			y2: point.y,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2
		};
	}

	/**
	 * Start arrow tool
	 *
	 * @param {Object} point - Starting point
	 * @param {Object} style - Style options
	 */
	startArrowTool ( point, style ) {
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'arrow',
			x1: point.x,
			y1: point.y,
			x2: point.x,
			y2: point.y,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor,
			arrowSize: style.arrowSize !== undefined ? style.arrowSize : 10,
			arrowStyle: style.arrowStyle || 'single',
			arrowhead: style.arrowhead || 'arrow',
			arrowHeadType: style.arrowHeadType,
			headScale: style.headScale,
			tailWidth: style.tailWidth
		};
	}

	// ========== Preview and creation methods ==========

	/**
	 * Update the temp layer preview based on current mouse point
	 *
	 * @param {Object} point - Current mouse position
	 */
	updatePreview ( point ) {
		if ( !this.tempLayer ) {
			return;
		}

		let dx, dy;

		// Update temp layer geometry based on type
		switch ( this.tempLayer.type ) {
			case 'rectangle':
			case 'textbox':
			case 'callout':
				this.tempLayer.width = point.x - this.tempLayer.x;
				this.tempLayer.height = point.y - this.tempLayer.y;
				break;
			case 'circle':
				dx = point.x - this.tempLayer.x;
				dy = point.y - this.tempLayer.y;
				this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
				break;
			case 'ellipse':
				// Ellipse center should be midpoint between start and current point
				// radiusX/radiusY are half the width/height
				this.tempLayer.radiusX = Math.abs( point.x - this.startPoint.x ) / 2;
				this.tempLayer.radiusY = Math.abs( point.y - this.startPoint.y ) / 2;
				this.tempLayer.x = ( this.startPoint.x + point.x ) / 2;
				this.tempLayer.y = ( this.startPoint.y + point.y ) / 2;
				break;
			case 'polygon':
				dx = point.x - this.tempLayer.x;
				dy = point.y - this.tempLayer.y;
				this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
				break;
			case 'star':
				dx = point.x - this.tempLayer.x;
				dy = point.y - this.tempLayer.y;
				this.tempLayer.outerRadius = Math.sqrt( dx * dx + dy * dy );
				this.tempLayer.radius = this.tempLayer.outerRadius;
				this.tempLayer.innerRadius = this.tempLayer.outerRadius * 0.5;
				break;
			case 'line':
				this.tempLayer.x2 = point.x;
				this.tempLayer.y2 = point.y;
				break;
			case 'arrow':
				this.tempLayer.x2 = point.x;
				this.tempLayer.y2 = point.y;
				break;
			case 'marker':
				// Dragging while placing a marker sets the arrow target position
				this.tempLayer.hasArrow = true;
				this.tempLayer.arrowX = point.x;
				this.tempLayer.arrowY = point.y;
				break;
			case 'dimension':
				// Dragging extends the dimension line endpoint
				this.tempLayer.x2 = point.x;
				this.tempLayer.y2 = point.y;
				break;
			case 'path':
				// Add point to path for pen tool
				this.tempLayer.points.push( point );
				break;
		}
	}

	/**
	 * Draw the preview of the current temp layer
	 */
	drawPreview () {
		if ( !this.tempLayer ) {
			return;
		}

		// Delegate rendering to the canvas manager's renderer
		if ( this.canvasManager && this.canvasManager.renderer ) {
			this.canvasManager.renderer.drawLayer( this.tempLayer );

			// For textbox with transparent stroke, draw a visible bounding box
			// so users can see what they're creating during the drag operation
			// (Callout has visible stroke so doesn't need this)
			if ( this.tempLayer.type === 'textbox' &&
				( !this.tempLayer.stroke || this.tempLayer.stroke === 'transparent' ||
				this.tempLayer.strokeWidth === 0 ) ) {
				this._drawPreviewBoundingBox( this.tempLayer );
			}
		}
	}

	/**
	 * Draw a dashed bounding box around a layer during drawing preview
	 *
	 * @private
	 * @param {Object} layer - The layer to draw bounds for
	 */
	_drawPreviewBoundingBox ( layer ) {
		const ctx = this.canvasManager.ctx;
		if ( !ctx ) {
			return;
		}

		const x = layer.x;
		const y = layer.y;
		const width = layer.width || 0;
		const height = layer.height || 0;

		ctx.save();
		ctx.strokeStyle = '#2196F3';
		ctx.lineWidth = 1;
		ctx.setLineDash( [ 4, 4 ] );
		ctx.strokeRect( x, y, width, height );
		ctx.setLineDash( [] );
		ctx.restore();
	}

	/**
	 * Create final layer data from the drawing operation
	 *
	 * @param {Object} point - Final mouse position
	 * @return {Object|null} Layer data or null if invalid
	 */
	createLayerFromDrawing ( point ) {
		if ( !this.tempLayer ) {
			return null;
		}

		const layer = this.tempLayer;
		this.tempLayer = null;

		let dx, dy;

		// Final adjustments based on tool type
		switch ( layer.type ) {
			case 'rectangle':
			case 'textbox':
			case 'callout':
				layer.width = point.x - layer.x;
				layer.height = point.y - layer.y;
				break;
			case 'circle':
				dx = point.x - layer.x;
				dy = point.y - layer.y;
				layer.radius = Math.sqrt( dx * dx + dy * dy );
				break;
			case 'ellipse':
				layer.radiusX = Math.abs( point.x - layer.x );
				layer.radiusY = Math.abs( point.y - layer.y );
				break;
			case 'polygon':
				dx = point.x - layer.x;
				dy = point.y - layer.y;
				layer.radius = Math.sqrt( dx * dx + dy * dy );
				break;
			case 'star':
				dx = point.x - layer.x;
				dy = point.y - layer.y;
				layer.outerRadius = Math.sqrt( dx * dx + dy * dy );
				layer.innerRadius = layer.outerRadius * 0.5;
				layer.radius = layer.outerRadius;
				break;
			case 'line':
				layer.x2 = point.x;
				layer.y2 = point.y;
				break;
			case 'arrow':
				layer.x2 = point.x;
				layer.y2 = point.y;
				break;
			case 'marker':
				// Marker position is already set; finalize arrow if dragged
				{
					const markerDx = point.x - layer.x;
					const markerDy = point.y - layer.y;
					const distance = Math.sqrt( markerDx * markerDx + markerDy * markerDy );
					// Only enable arrow if user dragged more than 20px
					if ( distance > 20 ) {
						layer.hasArrow = true;
						layer.arrowX = point.x;
						layer.arrowY = point.y;
					} else {
						layer.hasArrow = false;
					}
				}
				break;
			case 'dimension':
				// Finalize dimension endpoint
				layer.x2 = point.x;
				layer.y2 = point.y;
				break;
			case 'path':
				// Path is already complete
				break;
		}

		// Validate minimum size - don't create tiny shapes
		if ( !this.isValidShape( layer ) ) {
			return null;
		}

		return layer;
	}

	/**
	 * Check if a shape meets minimum size requirements
	 *
	 * @param {Object} layer - Layer data to validate
	 * @return {boolean} True if shape is valid size
	 */
	isValidShape ( layer ) {
		switch ( layer.type ) {
			case 'rectangle':
			case 'textbox':
			case 'callout':
				return Math.abs( layer.width ) >= this.MIN_SHAPE_SIZE &&
					Math.abs( layer.height ) >= this.MIN_SHAPE_SIZE;

			case 'circle':
			case 'polygon':
				return layer.radius >= this.MIN_SHAPE_SIZE;

			case 'ellipse':
				return layer.radiusX >= this.MIN_SHAPE_SIZE ||
					layer.radiusY >= this.MIN_SHAPE_SIZE;

			case 'star':
				return layer.outerRadius >= this.MIN_SHAPE_SIZE;

			case 'line':
			case 'arrow': {
				const length = Math.sqrt(
					Math.pow( layer.x2 - layer.x1, 2 ) +
					Math.pow( layer.y2 - layer.y1, 2 )
				);
				return length >= this.MIN_LINE_LENGTH;
			}

			case 'dimension': {
				const dimLength = Math.sqrt(
					Math.pow( layer.x2 - layer.x1, 2 ) +
					Math.pow( layer.y2 - layer.y1, 2 )
				);
				// Dimensions need a minimum length to be useful
				return dimLength >= this.MIN_LINE_LENGTH;
			}

			case 'path':
				return layer.points && layer.points.length >= this.MIN_PATH_POINTS;

			case 'marker':
				// Markers are always valid (single click creates them)
				return true;

			default:
				return true;
		}
	}

	// ========== Cursor management ==========

	/**
	 * Get the appropriate cursor for a tool
	 *
	 * @param {string} tool - Tool name
	 * @return {string} CSS cursor value
	 */
	getToolCursor ( tool ) {
		switch ( tool ) {
			case 'pen':
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
			default:
				return 'default';
		}
	}

	/**
	 * Check if a tool is a drawing tool
	 *
	 * @param {string} tool - Tool name
	 * @return {boolean} True if tool creates shapes
	 */
	isDrawingTool ( tool ) {
		const drawingTools = [
			'text', 'textbox', 'callout', 'pen', 'rectangle', 'circle',
			'ellipse', 'polygon', 'star', 'line', 'arrow', 'marker', 'dimension'
		];
		return drawingTools.indexOf( tool ) !== -1;
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.tempLayer = null;
		this.isDrawing = false;
		this.canvasManager = null;
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.DrawingController = DrawingController;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = DrawingController;
	}
}() );
