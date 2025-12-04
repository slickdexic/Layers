/**
 * ShapeRenderer Module for Layers Editor
 * Handles rendering of all shape types (rectangle, circle, ellipse, polygon, etc.)
 * Extracted from CanvasRenderer for better separation of concerns.
 *
 * @module ShapeRenderer
 */
( function () {
	'use strict';

	/**
	 * Clamp opacity value to valid range [0, 1]
	 *
	 * @private
	 * @param {*} value - Value to clamp
	 * @return {number} Clamped opacity value
	 */
	const clampOpacity = function ( value ) {
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return 1;
		}
		return Math.max( 0, Math.min( 1, value ) );
	};

	/**
	 * ShapeRenderer - Renders individual shape layers on canvas
	 *
	 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
	 * @param {Object} config - Configuration options
	 * @param {number} [config.zoom=1] - Current zoom level
	 * @param {HTMLImageElement} [config.backgroundImage] - Background image for blur effects
	 * @class
	 */
	function ShapeRenderer( ctx, config ) {
		this.ctx = ctx;
		this.config = config || {};
		this.zoom = this.config.zoom || 1;
		this.backgroundImage = this.config.backgroundImage || null;
		this.canvas = this.config.canvas || null;
	}

	/**
	 * Update the zoom level
	 *
	 * @param {number} zoom - New zoom level
	 */
	ShapeRenderer.prototype.setZoom = function ( zoom ) {
		this.zoom = zoom;
	};

	/**
	 * Set the background image (used for blur effects)
	 *
	 * @param {HTMLImageElement} img - Background image
	 */
	ShapeRenderer.prototype.setBackgroundImage = function ( img ) {
		this.backgroundImage = img;
	};

	/**
	 * Set the canvas reference (used for text measurement)
	 *
	 * @param {HTMLCanvasElement} canvas - Canvas element
	 */
	ShapeRenderer.prototype.setCanvas = function ( canvas ) {
		this.canvas = canvas;
	};

	// --- Style Helpers ---

	/**
	 * Apply common layer styles to context
	 *
	 * @param {Object} layer - Layer object
	 */
	ShapeRenderer.prototype.applyLayerStyle = function ( layer ) {
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

	/**
	 * Clear shadow settings from context
	 */
	ShapeRenderer.prototype.clearShadow = function () {
		this.ctx.shadowColor = 'transparent';
		this.ctx.shadowBlur = 0;
		this.ctx.shadowOffsetX = 0;
		this.ctx.shadowOffsetY = 0;
	};

	// --- Shape Drawing Methods ---

	/**
	 * Draw a rectangle shape
	 *
	 * @param {Object} layer - Layer with rectangle properties
	 */
	ShapeRenderer.prototype.drawRectangle = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const width = layer.width || 0;
		const height = layer.height || 0;

		this.ctx.save();
		this.applyLayerStyle( layer );
		this.ctx.beginPath();
		this.ctx.rect( x, y, width, height );

		const baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow(); // Prevent shadow on stroke
		}
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	/**
	 * Draw a circle shape
	 *
	 * @param {Object} layer - Layer with circle properties (x, y center, radius)
	 */
	ShapeRenderer.prototype.drawCircle = function ( layer ) {
		const cx = layer.x || 0;
		const cy = layer.y || 0;
		const radius = layer.radius || 0;

		this.ctx.save();
		this.applyLayerStyle( layer );
		this.ctx.beginPath();
		this.ctx.arc( cx, cy, radius, 0, 2 * Math.PI );

		const baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow();
		}
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	/**
	 * Draw an ellipse shape
	 *
	 * @param {Object} layer - Layer with ellipse properties
	 */
	ShapeRenderer.prototype.drawEllipse = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		// Support both (radiusX, radiusY) and (width, height) formats
		let radiusX, radiusY;
		if ( layer.radiusX !== undefined && layer.radiusY !== undefined ) {
			radiusX = layer.radiusX;
			radiusY = layer.radiusY;
		} else {
			radiusX = ( layer.width || 0 ) / 2;
			radiusY = ( layer.height || 0 ) / 2;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );
		this.ctx.beginPath();
		this.ctx.ellipse( x, y, radiusX, radiusY, 0, 0, 2 * Math.PI );

		const baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow();
		}
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	/**
	 * Draw a line
	 *
	 * @param {Object} layer - Layer with line properties (x1, y1, x2, y2)
	 */
	ShapeRenderer.prototype.drawLine = function ( layer ) {
		this.ctx.save();

		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 2;
		this.ctx.lineCap = 'round';

		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = layer.opacity;
		}

		const baseOpacity = this.ctx.globalAlpha;
		this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );

		// Handle rotation for line
		if ( layer.rotation && layer.rotation !== 0 ) {
			const centerX = ( layer.x1 + layer.x2 ) / 2;
			const centerY = ( layer.y1 + layer.y2 ) / 2;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( layer.rotation * Math.PI / 180 );
			this.ctx.translate( -centerX, -centerY );
		}

		this.ctx.beginPath();
		this.ctx.moveTo( layer.x1 || 0, layer.y1 || 0 );
		this.ctx.lineTo( layer.x2 || 0, layer.y2 || 0 );
		this.ctx.stroke();

		this.ctx.restore();
	};

	/**
	 * Draw an arrow with optional arrowheads
	 *
	 * @param {Object} layer - Layer with arrow properties
	 */
	ShapeRenderer.prototype.drawArrow = function ( layer ) {
		const x1 = layer.x1 || 0;
		const y1 = layer.y1 || 0;
		const x2 = layer.x2 || 0;
		const y2 = layer.y2 || 0;

		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.fillStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 2;

		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = layer.opacity;
		}

		const baseOpacity = this.ctx.globalAlpha;
		this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );

		// Apply dash style
		if ( layer.arrowStyle === 'dashed' ) {
			this.ctx.setLineDash( [ 10, 5 ] );
		} else if ( layer.arrowStyle === 'dotted' ) {
			this.ctx.setLineDash( [ 2, 4 ] );
		}

		this.ctx.beginPath();
		this.ctx.moveTo( x1, y1 );
		this.ctx.lineTo( x2, y2 );
		this.ctx.stroke();

		// Reset dash
		this.ctx.setLineDash( [] );

		// Draw arrowhead(s)
		const arrowhead = layer.arrowhead || 'arrow';
		const arrowSize = layer.arrowSize || 10;

		// End arrowhead (x2, y2)
		if ( arrowhead !== 'none' ) {
			this.drawArrowHead( x1, y1, x2, y2, arrowhead, arrowSize );
		}

		// Start arrowhead for double arrows
		if ( layer.doubleArrow ) {
			this.drawArrowHead( x2, y2, x1, y1, arrowhead, arrowSize );
		}

		this.ctx.restore();
	};

	/**
	 * Draw an arrowhead at the end of a line
	 *
	 * @param {number} fromX - Start X
	 * @param {number} fromY - Start Y
	 * @param {number} toX - End X (arrowhead location)
	 * @param {number} toY - End Y (arrowhead location)
	 * @param {string} type - Arrowhead type (arrow, circle, diamond, triangle)
	 * @param {number} size - Arrowhead size
	 */
	ShapeRenderer.prototype.drawArrowHead = function ( fromX, fromY, toX, toY, type, size ) {
		const angle = Math.atan2( toY - fromY, toX - fromX );

		this.ctx.save();
		this.ctx.translate( toX, toY );
		this.ctx.rotate( angle );

		switch ( type ) {
			case 'circle':
				this.ctx.beginPath();
				this.ctx.arc( -size / 2, 0, size / 2, 0, 2 * Math.PI );
				this.ctx.fill();
				break;
			case 'diamond':
				this.ctx.beginPath();
				this.ctx.moveTo( 0, 0 );
				this.ctx.lineTo( -size, -size / 2 );
				this.ctx.lineTo( -size * 2, 0 );
				this.ctx.lineTo( -size, size / 2 );
				this.ctx.closePath();
				this.ctx.fill();
				break;
			case 'triangle':
			case 'arrow':
			default:
				this.ctx.beginPath();
				this.ctx.moveTo( 0, 0 );
				this.ctx.lineTo( -size, -size / 2 );
				this.ctx.lineTo( -size, size / 2 );
				this.ctx.closePath();
				this.ctx.fill();
				break;
		}

		this.ctx.restore();
	};

	/**
	 * Draw a custom polygon from points
	 *
	 * @param {Object} layer - Layer with points array
	 */
	ShapeRenderer.prototype.drawPolygon = function ( layer ) {
		if ( !layer.points || !Array.isArray( layer.points ) || layer.points.length < 3 ) {
			return;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );
		this.ctx.beginPath();
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );
		for ( let i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}
		this.ctx.closePath();

		const baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow();
		}
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	/**
	 * Draw a regular polygon (e.g., hexagon, pentagon)
	 *
	 * @param {Object} layer - Layer with sides, x, y, radius
	 */
	ShapeRenderer.prototype.drawRegularPolygon = function ( layer ) {
		const sides = layer.sides || 6;
		const x = layer.x || 0;
		const y = layer.y || 0;
		const radius = layer.radius || 50;

		this.ctx.save();

		// Apply basic styles (fill, stroke, opacity, blend) but NOT rotation
		// since applyLayerStyle uses width/height for rotation center which doesn't work for polygons
		if ( layer.fill ) {
			this.ctx.fillStyle = layer.fill;
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

		// Handle rotation around polygon center (x, y)
		if ( layer.rotation ) {
			this.ctx.translate( x, y );
			this.ctx.rotate( layer.rotation * Math.PI / 180 );
			this.ctx.translate( -x, -y );
		}

		this.ctx.beginPath();
		for ( let i = 0; i < sides; i++ ) {
			const angle = ( i * 2 * Math.PI ) / sides - Math.PI / 2;
			const px = x + radius * Math.cos( angle );
			const py = y + radius * Math.sin( angle );
			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}
		this.ctx.closePath();

		const baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow();
		}
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	/**
	 * Draw a star shape
	 *
	 * @param {Object} layer - Layer with points (count), x, y, outerRadius, innerRadius
	 */
	ShapeRenderer.prototype.drawStar = function ( layer ) {
		const points = layer.points || 5;
		const x = layer.x || 0;
		const y = layer.y || 0;
		const outerRadius = layer.outerRadius || layer.radius || 50;
		const innerRadius = layer.innerRadius || outerRadius * 0.5;

		this.ctx.save();

		// Apply basic styles (fill, stroke, opacity, blend) but NOT rotation
		// since applyLayerStyle uses width/height for rotation center which doesn't work for stars
		if ( layer.fill ) {
			this.ctx.fillStyle = layer.fill;
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

		// Handle rotation around star center (x, y)
		if ( layer.rotation ) {
			this.ctx.translate( x, y );
			this.ctx.rotate( layer.rotation * Math.PI / 180 );
			this.ctx.translate( -x, -y );
		}

		this.ctx.beginPath();

		for ( let i = 0; i < points * 2; i++ ) {
			const angle = ( i * Math.PI ) / points - Math.PI / 2;
			const r = i % 2 === 0 ? outerRadius : innerRadius;
			const px = x + Math.cos( angle ) * r;
			const py = y + Math.sin( angle ) * r;
			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}
		this.ctx.closePath();

		const baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
			this.clearShadow();
		}
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	/**
	 * Draw a freehand path
	 *
	 * @param {Object} layer - Layer with points array
	 */
	ShapeRenderer.prototype.drawPath = function ( layer ) {
		if ( !layer.points || !Array.isArray( layer.points ) || layer.points.length < 2 ) {
			return;
		}

		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 2;
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';

		const baseOpacity = this.ctx.globalAlpha;
		this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );

		this.ctx.beginPath();
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );
		for ( let i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}
		this.ctx.stroke();

		this.ctx.restore();
	};

	/**
	 * Draw a highlight overlay
	 *
	 * @param {Object} layer - Layer with highlight properties
	 */
	ShapeRenderer.prototype.drawHighlight = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const width = layer.width || 100;
		const height = layer.height || 20;

		this.ctx.save();
		let opacity = 0.3;
		if ( typeof layer.opacity === 'number' && !Number.isNaN( layer.opacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.opacity ) );
		} else if ( typeof layer.fillOpacity === 'number' && !Number.isNaN( layer.fillOpacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.fillOpacity ) );
		}
		this.ctx.globalAlpha = opacity;
		this.ctx.fillStyle = layer.color || layer.fill || '#ffff00';
		this.ctx.fillRect( x, y, width, height );
		this.ctx.restore();
	};

	/**
	 * Draw a blur effect region
	 *
	 * @param {Object} layer - Layer with blur properties
	 */
	ShapeRenderer.prototype.drawBlur = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const w = layer.width || 0;
		const h = layer.height || 0;

		if ( w <= 0 || h <= 0 ) {
			return;
		}

		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.rect( x, y, w, h );
		this.ctx.clip();

		const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );
		const prevFilter = this.ctx.filter || 'none';
		this.ctx.filter = 'blur(' + radius + 'px)';

		if ( this.backgroundImage && this.backgroundImage.complete ) {
			this.ctx.drawImage( this.backgroundImage, 0, 0 );
		}

		this.ctx.filter = prevFilter;
		this.ctx.restore();
	};

	/**
	 * Draw text layer with multi-line support
	 *
	 * @param {Object} layer - Layer with text properties
	 */
	ShapeRenderer.prototype.drawText = function ( layer ) {
		this.ctx.save();

		const canvasWidth = this.canvas ? this.canvas.width : 0;
		const metrics = window.TextUtils.measureTextLayer( layer, this.ctx, canvasWidth );
		if ( !metrics ) {
			this.ctx.restore();
			return;
		}

		let drawX = metrics.originX;
		let baselineStart = metrics.baselineY;
		const centerX = metrics.originX + ( metrics.width / 2 );
		const centerY = metrics.originY + ( metrics.height / 2 );

		this.ctx.font = metrics.fontSize + 'px ' + metrics.fontFamily;
		this.ctx.textAlign = 'left';
		this.ctx.textBaseline = 'alphabetic';

		if ( layer.rotation && layer.rotation !== 0 ) {
			const rotationRadians = ( layer.rotation * Math.PI ) / 180;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( rotationRadians );
			drawX = -( metrics.width / 2 );
			baselineStart = -( metrics.height / 2 ) + metrics.ascent;
		}

		if ( layer.textShadow ) {
			this.ctx.shadowColor = layer.textShadowColor || '#000000';
			this.ctx.shadowOffsetX = 2 * ( this.zoom || 1 );
			this.ctx.shadowOffsetY = 2 * ( this.zoom || 1 );
			this.ctx.shadowBlur = 4;
		}

		const baseAlpha = this.ctx.globalAlpha;
		const fillColor = layer.fill || layer.color || '#000000';
		const fillOpacity = clampOpacity( layer.fillOpacity );
		const strokeOpacity = clampOpacity( layer.strokeOpacity );

		for ( let j = 0; j < metrics.lines.length; j++ ) {
			const lineText = metrics.lines[ j ];
			const lineY = baselineStart + ( j * metrics.lineHeight );

			if ( layer.textStrokeWidth && layer.textStrokeWidth > 0 ) {
				this.ctx.strokeStyle = layer.textStrokeColor || '#000000';
				this.ctx.lineWidth = layer.textStrokeWidth;
				this.ctx.globalAlpha = baseAlpha * strokeOpacity;
				this.ctx.strokeText( lineText, drawX, lineY );
			}

			this.ctx.fillStyle = fillColor;
			this.ctx.globalAlpha = baseAlpha * fillOpacity;
			this.ctx.fillText( lineText, drawX, lineY );
		}

		this.ctx.restore();
	};

	/**
	 * Draw a layer by type (dispatcher method)
	 *
	 * @param {Object} layer - Layer to draw
	 */
	ShapeRenderer.prototype.drawLayer = function ( layer ) {
		switch ( layer.type ) {
			case 'text':
				this.drawText( layer );
				break;
			case 'rectangle':
			case 'rect':
				this.drawRectangle( layer );
				break;
			case 'circle':
				this.drawCircle( layer );
				break;
			case 'ellipse':
				this.drawEllipse( layer );
				break;
			case 'polygon':
				this.drawPolygon( layer );
				break;
			case 'star':
				this.drawStar( layer );
				break;
			case 'line':
				this.drawLine( layer );
				break;
			case 'arrow':
				this.drawArrow( layer );
				break;
			case 'highlight':
				this.drawHighlight( layer );
				break;
			case 'path':
				this.drawPath( layer );
				break;
			case 'blur':
				this.drawBlur( layer );
				break;
		}
	};

	/**
	 * Clean up resources
	 */
	ShapeRenderer.prototype.destroy = function () {
		this.ctx = null;
		this.config = null;
		this.backgroundImage = null;
		this.canvas = null;
	};

	// Export - ALWAYS set on window for cross-file dependencies
	if ( typeof window !== 'undefined' ) {
		window.ShapeRenderer = ShapeRenderer;
	}
	// Also export via CommonJS if available (for Node.js/Jest testing)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ShapeRenderer;
	}
	// MediaWiki loader integration
	if ( typeof mw !== 'undefined' && mw.loader ) {
		mw.loader.using( [], function () {
			mw.ShapeRenderer = ShapeRenderer;
		} );
	}

}() );
