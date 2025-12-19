/**
 * Shape Factory for Layers Editor
 * Creates layer objects for different shape types
 * Extracted from ToolManager.js for better separation of concerns
 */
( function () {
	'use strict';

	/**
	 * ShapeFactory class
	 * Factory for creating layer objects with appropriate properties
	 */
	class ShapeFactory {
		/**
		 * Create a ShapeFactory instance
		 *
		 * @param {Object} [options] Configuration options
		 * @param {Object} [options.styleManager] ToolStyles instance for default styles
		 */
		constructor( options ) {
			this.options = options || {};
			this.styleManager = this.options.styleManager || null;
		}

		/**
		 * Get current style from style manager or use defaults
		 *
		 * @return {Object} Current style
		 */
		getCurrentStyle() {
			if ( this.styleManager && typeof this.styleManager.get === 'function' ) {
				return this.styleManager.get();
			}

			// Default style if no manager
			return {
				color: '#000000',
				strokeWidth: 2,
				fill: 'transparent',
				fontSize: 16,
				fontFamily: 'Arial, sans-serif',
				arrowStyle: 'single',
				shadow: false,
				shadowColor: '#000000',
				shadowBlur: 8,
				shadowOffsetX: 2,
				shadowOffsetY: 2
			};
		}

		/**
		 * Apply shadow properties to a layer
		 *
		 * @param {Object} layer Layer to apply shadows to
		 * @param {Object} style Style containing shadow properties
		 * @return {Object} Layer with shadow properties
		 */
		applyShadow( layer, style ) {
			layer.shadow = style.shadow || false;
			layer.shadowColor = style.shadowColor || '#000000';
			layer.shadowBlur = style.shadowBlur || 8;
			layer.shadowOffsetX = style.shadowOffsetX || 2;
			layer.shadowOffsetY = style.shadowOffsetY || 2;
			return layer;
		}

		/**
		 * Create a path/pen layer
		 *
		 * @param {Object} point Starting point
		 * @return {Object} Path layer object
		 */
		createPath( point ) {
			const style = this.getCurrentStyle();
			const layer = {
				type: 'path',
				points: [ { x: point.x, y: point.y } ],
				stroke: style.color,
				strokeWidth: style.strokeWidth,
				fill: 'none'
			};
			return this.applyShadow( layer, style );
		}

		/**
		 * Create a rectangle layer
		 *
		 * @param {Object} point Starting point
		 * @return {Object} Rectangle layer object
		 */
		createRectangle( point ) {
			const style = this.getCurrentStyle();
			const layer = {
				type: 'rectangle',
				x: point.x,
				y: point.y,
				width: 0,
				height: 0,
				stroke: style.color,
				strokeWidth: style.strokeWidth,
				fill: style.fill
			};
			return this.applyShadow( layer, style );
		}

		/**
		 * Create a circle layer
		 *
		 * @param {Object} point Center point
		 * @return {Object} Circle layer object
		 */
		createCircle( point ) {
			const style = this.getCurrentStyle();
			const layer = {
				type: 'circle',
				x: point.x,
				y: point.y,
				radius: 0,
				stroke: style.color,
				strokeWidth: style.strokeWidth,
				fill: style.fill
			};
			return this.applyShadow( layer, style );
		}

		/**
		 * Create an ellipse layer
		 *
		 * @param {Object} point Center point
		 * @return {Object} Ellipse layer object
		 */
		createEllipse( point ) {
			const style = this.getCurrentStyle();
			const layer = {
				type: 'ellipse',
				x: point.x,
				y: point.y,
				radiusX: 0,
				radiusY: 0,
				stroke: style.color,
				strokeWidth: style.strokeWidth,
				fill: style.fill
			};
			return this.applyShadow( layer, style );
		}

		/**
		 * Create a line layer
		 *
		 * @param {Object} point Starting point
		 * @return {Object} Line layer object
		 */
		createLine( point ) {
			const style = this.getCurrentStyle();
			const layer = {
				type: 'line',
				x1: point.x,
				y1: point.y,
				x2: point.x,
				y2: point.y,
				stroke: style.color,
				strokeWidth: style.strokeWidth
			};
			return this.applyShadow( layer, style );
		}

		/**
		 * Create an arrow layer
		 *
		 * @param {Object} point Starting point
		 * @return {Object} Arrow layer object
		 */
		createArrow( point ) {
			const style = this.getCurrentStyle();
			const layer = {
				type: 'arrow',
				x1: point.x,
				y1: point.y,
				x2: point.x,
				y2: point.y,
				stroke: style.color,
				strokeWidth: style.strokeWidth,
				arrowStyle: style.arrowStyle || 'single'
			};
			return this.applyShadow( layer, style );
		}

		/**
		 * Create a polygon layer
		 *
		 * @param {Object} point Center point
		 * @param {number} [sides=6] Number of sides
		 * @return {Object} Polygon layer object
		 */
		createPolygon( point, sides ) {
			const style = this.getCurrentStyle();
			const layer = {
				type: 'polygon',
				x: point.x,
				y: point.y,
				radius: 0,
				sides: sides || 6,
				cornerRadius: 0,
				stroke: style.color,
				strokeWidth: style.strokeWidth,
				fill: style.fill
			};
			return this.applyShadow( layer, style );
		}

		/**
		 * Create a star layer
		 *
		 * @param {Object} point Center point
		 * @param {number} [points=5] Number of star points
		 * @return {Object} Star layer object
		 */
		createStar( point, points ) {
			const style = this.getCurrentStyle();
			const layer = {
				type: 'star',
				x: point.x,
				y: point.y,
				outerRadius: 0,
				innerRadius: 0,
				radius: 0, // For compatibility
				points: points || 5,
				pointRadius: 0,
				valleyRadius: 0,
				stroke: style.color,
				strokeWidth: style.strokeWidth,
				fill: style.fill
			};
			return this.applyShadow( layer, style );
		}

		/**
		 * Create a text layer
		 *
		 * @param {Object} point Position point
		 * @param {string} [text=''] Initial text
		 * @return {Object} Text layer object
		 */
		createText( point, text ) {
			const style = this.getCurrentStyle();
			return {
				type: 'text',
				x: point.x,
				y: point.y,
				text: text || '',
				fontSize: style.fontSize,
				fontFamily: style.fontFamily,
				color: style.color
			};
		}

		/**
		 * Create a blur/redaction layer
		 *
		 * @param {Object} point Starting point
		 * @return {Object} Blur layer object
		 */
		createBlur( point ) {
			const style = this.getCurrentStyle();
			return {
				type: 'blur',
				x: point.x,
				y: point.y,
				width: 0,
				height: 0,
				blurAmount: 10,
				stroke: style.color,
				strokeWidth: style.strokeWidth
			};
		}

		/**
		 * Create a text box layer
		 * Text box combines rectangle properties with multi-line text
		 *
		 * @param {Object} point Starting point
		 * @return {Object} Text box layer object
		 */
		createTextBox( point ) {
			const style = this.getCurrentStyle();
			const layer = {
				type: 'textbox',
				x: point.x,
				y: point.y,
				width: 0,
				height: 0,
				// Text properties
				text: '',
				fontSize: style.fontSize || 16,
				fontFamily: style.fontFamily || 'Arial, sans-serif',
				fontWeight: 'normal',
				fontStyle: 'normal',
				color: style.color || '#000000',
				textAlign: 'left',
				verticalAlign: 'top',
				lineHeight: 1.2,
				// Text stroke (outline) - relative to font size, typically 2-5% of font size
				textStrokeWidth: 0,
				textStrokeColor: '#000000',
				// Text drop shadow
				textShadow: false,
				textShadowColor: 'rgba(0,0,0,0.5)',
				textShadowBlur: 4,
				textShadowOffsetX: 2,
				textShadowOffsetY: 2,
				// Rectangle properties
				stroke: style.color || '#000000',
				strokeWidth: style.strokeWidth || 1,
				fill: style.fill || '#ffffff',
				cornerRadius: 0,
				padding: 8
			};
			return this.applyShadow( layer, style );
		}

		/**
		 * Create a layer by type
		 *
		 * @param {string} type Layer type
		 * @param {Object} point Starting/center point
		 * @param {Object} [options] Additional options
		 * @return {Object|null} Layer object or null if type unknown
		 */
		create( type, point, options ) {
			const opts = options || {};

			switch ( type ) {
				case 'path':
				case 'pen':
					return this.createPath( point );
				case 'rectangle':
					return this.createRectangle( point );
				case 'circle':
					return this.createCircle( point );
				case 'ellipse':
					return this.createEllipse( point );
				case 'line':
					return this.createLine( point );
				case 'arrow':
					return this.createArrow( point );
				case 'polygon':
					return this.createPolygon( point, opts.sides );
				case 'star':
					return this.createStar( point, opts.points );
				case 'text':
					return this.createText( point, opts.text );
				case 'blur':
					return this.createBlur( point );
				case 'textbox':
					return this.createTextBox( point );
				default:
					return null;
			}
		}

		/**
		 * Update rectangle dimensions from drag
		 *
		 * @param {Object} layer Rectangle layer
		 * @param {Object} startPoint Original start point
		 * @param {Object} currentPoint Current mouse point
		 */
		updateRectangle( layer, startPoint, currentPoint ) {
			layer.x = Math.min( startPoint.x, currentPoint.x );
			layer.y = Math.min( startPoint.y, currentPoint.y );
			layer.width = Math.abs( currentPoint.x - startPoint.x );
			layer.height = Math.abs( currentPoint.y - startPoint.y );
		}

		/**
		 * Update circle dimensions from drag
		 *
		 * @param {Object} layer Circle layer
		 * @param {Object} startPoint Center point
		 * @param {Object} currentPoint Current mouse point
		 */
		updateCircle( layer, startPoint, currentPoint ) {
			const dx = currentPoint.x - startPoint.x;
			const dy = currentPoint.y - startPoint.y;
			layer.radius = Math.sqrt( dx * dx + dy * dy );
		}

		/**
		 * Update ellipse dimensions from drag
		 *
		 * @param {Object} layer Ellipse layer
		 * @param {Object} startPoint Original start point
		 * @param {Object} currentPoint Current mouse point
		 */
		updateEllipse( layer, startPoint, currentPoint ) {
			layer.radiusX = Math.abs( currentPoint.x - startPoint.x ) / 2;
			layer.radiusY = Math.abs( currentPoint.y - startPoint.y ) / 2;
			layer.x = ( startPoint.x + currentPoint.x ) / 2;
			layer.y = ( startPoint.y + currentPoint.y ) / 2;
		}

		/**
		 * Update line/arrow endpoint from drag
		 *
		 * @param {Object} layer Line or arrow layer
		 * @param {Object} currentPoint Current mouse point
		 */
		updateLine( layer, currentPoint ) {
			layer.x2 = currentPoint.x;
			layer.y2 = currentPoint.y;
		}

		/**
		 * Update polygon dimensions from drag
		 *
		 * @param {Object} layer Polygon layer
		 * @param {Object} startPoint Center point
		 * @param {Object} currentPoint Current mouse point
		 */
		updatePolygon( layer, startPoint, currentPoint ) {
			const dx = currentPoint.x - startPoint.x;
			const dy = currentPoint.y - startPoint.y;
			layer.radius = Math.sqrt( dx * dx + dy * dy );
		}

		/**
		 * Update star dimensions from drag
		 *
		 * @param {Object} layer Star layer
		 * @param {Object} startPoint Center point
		 * @param {Object} currentPoint Current mouse point
		 * @param {number} [innerRatio=0.4] Inner to outer radius ratio
		 */
		updateStar( layer, startPoint, currentPoint, innerRatio ) {
			const dx = currentPoint.x - startPoint.x;
			const dy = currentPoint.y - startPoint.y;
			const radius = Math.sqrt( dx * dx + dy * dy );
			const ratio = innerRatio || 0.4;

			layer.outerRadius = radius;
			layer.radius = radius;
			layer.innerRadius = radius * ratio;
		}

		/**
		 * Check if a layer has valid size (not too small)
		 *
		 * @param {Object} layer Layer to check
		 * @param {number} [minSize=1] Minimum valid size
		 * @return {boolean} True if layer has valid size
		 */
		hasValidSize( layer, minSize ) {
			const min = minSize || 1;

			switch ( layer.type ) {
				case 'rectangle':
				case 'blur':
				case 'textbox':
					return layer.width > min && layer.height > min;
				case 'circle':
					return layer.radius > min;
				case 'ellipse':
					return layer.radiusX > min && layer.radiusY > min;
				case 'line':
				case 'arrow': {
					const dx = layer.x2 - layer.x1;
					const dy = layer.y2 - layer.y1;
					return Math.sqrt( dx * dx + dy * dy ) > min;
				}
				case 'polygon':
				case 'star':
					return ( layer.radius > min ) || ( layer.outerRadius > min );
				case 'path':
					return layer.points && layer.points.length > 1;
				case 'text':
					return layer.text && layer.text.length > 0;
				default:
					return true;
			}
		}

		/**
		 * Set the style manager
		 *
		 * @param {Object} styleManager ToolStyles instance
		 */
		setStyleManager( styleManager ) {
			this.styleManager = styleManager;
		}

		/**
		 * Generate unique layer ID
		 *
		 * @return {string} Unique layer ID
		 */
		generateId() {
			return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
		}

		/**
		 * Create a layer with a generated ID
		 *
		 * @param {string} type Layer type
		 * @param {Object} point Starting/center point
		 * @param {Object} [options] Additional options
		 * @return {Object|null} Layer object with ID or null
		 */
		createWithId( type, point, options ) {
			const layer = this.create( type, point, options );
			if ( layer ) {
				layer.id = this.generateId();
			}
			return layer;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Tools = window.Layers.Tools || {};
		window.Layers.Tools.ShapeFactory = ShapeFactory;
	}

	// CommonJS export for testing
	/* eslint-disable-next-line no-undef */
	if ( typeof module !== 'undefined' && module.exports ) {
		/* eslint-disable-next-line no-undef */
		module.exports = ShapeFactory;
	}
}() );
