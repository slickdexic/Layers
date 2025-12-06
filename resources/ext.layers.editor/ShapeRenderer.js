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
	 * Draw an arrow as a closed polygon shape
	 * This allows for both fill and stroke, creating a proper arrow shape
	 *
	 * @param {Object} layer - Layer with arrow properties
	 */
	ShapeRenderer.prototype.drawArrow = function ( layer ) {
		const x1 = layer.x1 || 0;
		const y1 = layer.y1 || 0;
		const x2 = layer.x2 || 0;
		const y2 = layer.y2 || 0;
		const arrowSize = layer.arrowSize || 15;
		const arrowStyle = layer.arrowStyle || 'single';
		const headType = layer.arrowHeadType || 'pointed';
		const headScale = typeof layer.headScale === 'number' ? layer.headScale : 1.0;
		const tailWidth = typeof layer.tailWidth === 'number' ? layer.tailWidth : 0;
		const strokeWidth = layer.strokeWidth || 2;
		// Shaft width is based on arrowSize (controls overall arrow thickness)
		// arrowSize of 15 (default) gives shaft width of ~6
		const shaftWidth = Math.max( arrowSize * 0.4, strokeWidth * 1.5, 4 );

		this.ctx.save();

		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = layer.opacity;
		}

		// Calculate line angle
		const angle = Math.atan2( y2 - y1, x2 - x1 );
		const perpAngle = angle + Math.PI / 2;

		// Build the arrow polygon vertices
		const vertices = this.buildArrowVertices(
			x1, y1, x2, y2, angle, perpAngle, shaftWidth / 2, arrowSize, arrowStyle, headType, headScale, tailWidth
		);

		// Draw the closed polygon path
		this.ctx.beginPath();
		if ( vertices.length > 0 ) {
			this.ctx.moveTo( vertices[ 0 ].x, vertices[ 0 ].y );
			for ( let i = 1; i < vertices.length; i++ ) {
				this.ctx.lineTo( vertices[ i ].x, vertices[ i ].y );
			}
			this.ctx.closePath();
		}

		const baseOpacity = this.ctx.globalAlpha;

		// Fill the arrow shape
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			const fillOpacity = typeof layer.fillOpacity === 'number' ? layer.fillOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * fillOpacity;
			this.ctx.fill();
		}

		// Stroke the arrow outline
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = strokeWidth;
			this.ctx.lineJoin = 'miter';
			this.ctx.miterLimit = 10;
			const strokeOpacity = typeof layer.strokeOpacity === 'number' ? layer.strokeOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * strokeOpacity;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	/**
	 * Build the vertices for an arrow polygon
	 *
	 * @param {number} x1 - Start X
	 * @param {number} y1 - Start Y
	 * @param {number} x2 - End X (tip direction)
	 * @param {number} y2 - End Y
	 * @param {number} angle - Angle of arrow direction
	 * @param {number} perpAngle - Perpendicular angle
	 * @param {number} halfShaft - Half of shaft width
	 * @param {number} arrowSize - Size of arrowhead
	 * @param {string} arrowStyle - 'single', 'double', or 'none'
	 * @param {string} headType - 'pointed', 'chevron', or 'standard'
	 * @param {number} headScale - Scale factor for arrow head size (default 1.0)
	 * @param {number} tailWidth - Extra width at tail end (0 = no taper)
	 * @return {Array} Array of {x, y} vertex objects
	 */
	ShapeRenderer.prototype.buildArrowVertices = function (
		x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth
	) {
		const vertices = [];
		const cos = Math.cos( angle );
		const sin = Math.sin( angle );
		const perpCos = Math.cos( perpAngle );
		const perpSin = Math.sin( perpAngle );

		// headScale affects how far the barbs extend from the tip (barb length)
		// arrowSize affects the width/thickness of shaft and barbs
		const effectiveHeadScale = headScale || 1.0;

		// Barb angle for arrowhead (30 degrees from shaft) - industry standard
		const barbAngle = Math.PI / 6;
		// How far back the barbs extend from tip - controlled by headScale
		const barbLength = arrowSize * 1.56 * effectiveHeadScale;
		// Width of the barb (perpendicular to shaft) for chevron style - controlled by arrowSize
		const barbWidth = arrowSize * 0.8;
		// How far back the chevron barb extends (squared end)
		const chevronDepth = arrowSize * 0.52 * effectiveHeadScale;

		// Calculate tail width offset
		const tailExtra = ( tailWidth || 0 ) / 2;

		if ( arrowStyle === 'none' ) {
			vertices.push( { x: x1 + perpCos * ( halfShaft + tailExtra ), y: y1 + perpSin * ( halfShaft + tailExtra ) } );
			vertices.push( { x: x2 + perpCos * halfShaft, y: y2 + perpSin * halfShaft } );
			vertices.push( { x: x2 - perpCos * halfShaft, y: y2 - perpSin * halfShaft } );
			vertices.push( { x: x1 - perpCos * ( halfShaft + tailExtra ), y: y1 - perpSin * ( halfShaft + tailExtra ) } );
			return vertices;
		}

		// Calculate where the arrowhead meets the shaft (affected by headScale)
		const headDepth = arrowSize * 1.3 * effectiveHeadScale;
		const headBaseX = x2 - cos * headDepth;
		const headBaseY = y2 - sin * headDepth;

		// Barb direction vectors
		const leftBarbAngle = angle - barbAngle;
		const leftBarbCos = Math.cos( leftBarbAngle );
		const leftBarbSin = Math.sin( leftBarbAngle );

		const rightBarbAngle = angle + barbAngle;
		const rightBarbCos = Math.cos( rightBarbAngle );
		const rightBarbSin = Math.sin( rightBarbAngle );

		if ( arrowStyle === 'single' ) {
			vertices.push( { x: x1 + perpCos * ( halfShaft + tailExtra ), y: y1 + perpSin * ( halfShaft + tailExtra ) } );

			if ( headType === 'standard' ) {
				// Standard block arrow has 3 lines per barb:
				// Line 1: Outer barb - direction (leftBarbCos, leftBarbSin)
				// Line 2: Perpendicular to Line 1
				// Line 3: Parallel to Line 1, meets shaft edge
				
				const leftOuterX = x2 - barbLength * leftBarbCos;
				const leftOuterY = y2 - barbLength * leftBarbSin;
				
				// Line 2: perpendicular (90° clockwise)
				// barbThickness determines how far the barbs extend beyond shaft
				const barbThickness = halfShaft * 1.5;
				const leftInnerX = leftOuterX + barbThickness * leftBarbSin;
				const leftInnerY = leftOuterY - barbThickness * leftBarbCos;
				
				// Line 3: parallel to Line 1, find where it hits shaft edge
				const leftDx = leftInnerX - headBaseX;
				const leftDy = leftInnerY - headBaseY;
				const leftCurrentDist = leftDx * perpCos + leftDy * perpSin;
				const leftDeltaPerStep = leftBarbCos * perpCos + leftBarbSin * perpSin;
				const leftT = ( halfShaft - leftCurrentDist ) / leftDeltaPerStep;
				const leftShaftX = leftInnerX + leftT * leftBarbCos;
				const leftShaftY = leftInnerY + leftT * leftBarbSin;
				
				vertices.push( { x: leftShaftX, y: leftShaftY } );
				vertices.push( { x: leftInnerX, y: leftInnerY } );
				vertices.push( { x: leftOuterX, y: leftOuterY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
				vertices.push( {
					x: headBaseX - cos * chevronDepth + perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth + perpSin * barbWidth
				} );
			} else {
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
				const leftBarbX = x2 - barbLength * leftBarbCos;
				const leftBarbY = y2 - barbLength * leftBarbSin;
				vertices.push( { x: leftBarbX, y: leftBarbY } );
			}

			vertices.push( { x: x2, y: y2 } );

			if ( headType === 'standard' ) {
				// Standard block arrow has 3 lines per barb
				const rightOuterX = x2 - barbLength * rightBarbCos;
				const rightOuterY = y2 - barbLength * rightBarbSin;
				
				// Line 2: perpendicular (90° counter-clockwise)
				// barbThickness determines how far the barbs extend beyond shaft
				const barbThickness = halfShaft * 1.5;
				const rightInnerX = rightOuterX - barbThickness * rightBarbSin;
				const rightInnerY = rightOuterY + barbThickness * rightBarbCos;
				
				// Line 3: parallel to Line 1, find where it hits shaft edge
				const rightDx = rightInnerX - headBaseX;
				const rightDy = rightInnerY - headBaseY;
				const rightCurrentDist = rightDx * perpCos + rightDy * perpSin;
				const rightDeltaPerStep = rightBarbCos * perpCos + rightBarbSin * perpSin;
				const rightT = ( -halfShaft - rightCurrentDist ) / rightDeltaPerStep;
				const rightShaftX = rightInnerX + rightT * rightBarbCos;
				const rightShaftY = rightInnerY + rightT * rightBarbSin;
				
				vertices.push( { x: rightOuterX, y: rightOuterY } );
				vertices.push( { x: rightInnerX, y: rightInnerY } );
				vertices.push( { x: rightShaftX, y: rightShaftY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: headBaseX - cos * chevronDepth - perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth - perpSin * barbWidth
				} );
				vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
			} else {
				const rightBarbX = x2 - barbLength * rightBarbCos;
				const rightBarbY = y2 - barbLength * rightBarbSin;
				vertices.push( { x: rightBarbX, y: rightBarbY } );
				vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
			}

			vertices.push( { x: x1 - perpCos * ( halfShaft + tailExtra ), y: y1 - perpSin * ( halfShaft + tailExtra ) } );

		} else if ( arrowStyle === 'double' ) {
			const tailBaseX = x1 + cos * headDepth;
			const tailBaseY = y1 + sin * headDepth;

			// Tail barb angles (pointing backward)
			const tailLeftAngle = angle + Math.PI - barbAngle;
			const tailLeftCos = Math.cos( tailLeftAngle );
			const tailLeftSin = Math.sin( tailLeftAngle );

			const tailRightAngle = angle + Math.PI + barbAngle;
			const tailRightCos = Math.cos( tailRightAngle );
			const tailRightSin = Math.sin( tailRightAngle );

			// barbThickness determines how far the barbs extend beyond shaft
			const barbThickness = halfShaft * 1.5;

			if ( headType === 'standard' ) {
				// Tail left outer barb
				const tailLeftOuterX = x1 + barbLength * tailLeftCos;
				const tailLeftOuterY = y1 + barbLength * tailLeftSin;
				// Line 2: perpendicular (90° clockwise)
				const tailLeftInnerX = tailLeftOuterX + barbThickness * tailLeftSin;
				const tailLeftInnerY = tailLeftOuterY - barbThickness * tailLeftCos;
				// Line 3: parallel to Line 1, find where it hits shaft edge
				const tailLeftDx = tailLeftInnerX - tailBaseX;
				const tailLeftDy = tailLeftInnerY - tailBaseY;
				const tailLeftCurrentDist = tailLeftDx * perpCos + tailLeftDy * perpSin;
				const tailLeftDeltaPerStep = tailLeftCos * perpCos + tailLeftSin * perpSin;
				const tailLeftT = ( halfShaft - tailLeftCurrentDist ) / tailLeftDeltaPerStep;
				const tailLeftShaftX = tailLeftInnerX + tailLeftT * tailLeftCos;
				const tailLeftShaftY = tailLeftInnerY + tailLeftT * tailLeftSin;
				vertices.push( { x: tailLeftShaftX, y: tailLeftShaftY } );
				vertices.push( { x: tailLeftInnerX, y: tailLeftInnerY } );
				vertices.push( { x: tailLeftOuterX, y: tailLeftOuterY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: tailBaseX + cos * chevronDepth + perpCos * barbWidth,
					y: tailBaseY + sin * chevronDepth + perpSin * barbWidth
				} );
			} else {
				const tailLeftBarbX = x1 + barbLength * tailLeftCos;
				const tailLeftBarbY = y1 + barbLength * tailLeftSin;
				vertices.push( { x: tailLeftBarbX, y: tailLeftBarbY } );
			}

			vertices.push( { x: x1, y: y1 } );

			if ( headType === 'standard' ) {
				const tailRightOuterX = x1 + barbLength * tailRightCos;
				const tailRightOuterY = y1 + barbLength * tailRightSin;
				// Line 2: perpendicular (90° counter-clockwise)
				const tailRightInnerX = tailRightOuterX - barbThickness * tailRightSin;
				const tailRightInnerY = tailRightOuterY + barbThickness * tailRightCos;
				// Line 3: parallel to Line 1, find where it hits shaft edge
				const tailRightDx = tailRightInnerX - tailBaseX;
				const tailRightDy = tailRightInnerY - tailBaseY;
				const tailRightCurrentDist = tailRightDx * perpCos + tailRightDy * perpSin;
				const tailRightDeltaPerStep = tailRightCos * perpCos + tailRightSin * perpSin;
				const tailRightT = ( -halfShaft - tailRightCurrentDist ) / tailRightDeltaPerStep;
				const tailRightShaftX = tailRightInnerX + tailRightT * tailRightCos;
				const tailRightShaftY = tailRightInnerY + tailRightT * tailRightSin;
				vertices.push( { x: tailRightOuterX, y: tailRightOuterY } );
				vertices.push( { x: tailRightInnerX, y: tailRightInnerY } );
				vertices.push( { x: tailRightShaftX, y: tailRightShaftY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: tailBaseX + cos * chevronDepth - perpCos * barbWidth,
					y: tailBaseY + sin * chevronDepth - perpSin * barbWidth
				} );
				vertices.push( { x: tailBaseX - perpCos * halfShaft, y: tailBaseY - perpSin * halfShaft } );
			} else {
				const tailRightBarbX = x1 + barbLength * tailRightCos;
				const tailRightBarbY = y1 + barbLength * tailRightSin;
				vertices.push( { x: tailRightBarbX, y: tailRightBarbY } );
				vertices.push( { x: tailBaseX - perpCos * halfShaft, y: tailBaseY - perpSin * halfShaft } );
			}

			// Right side of shaft to head (only for non-standard)
			if ( headType !== 'standard' ) {
				vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
			}

			if ( headType === 'standard' ) {
				const rightOuterX = x2 - barbLength * rightBarbCos;
				const rightOuterY = y2 - barbLength * rightBarbSin;
				// Line 2: perpendicular (90° counter-clockwise)
				const rightInnerX = rightOuterX - barbThickness * rightBarbSin;
				const rightInnerY = rightOuterY + barbThickness * rightBarbCos;
				// Line 3: parallel to Line 1, find where it hits shaft edge
				const rightDx = rightInnerX - headBaseX;
				const rightDy = rightInnerY - headBaseY;
				const rightCurrentDist = rightDx * perpCos + rightDy * perpSin;
				const rightDeltaPerStep = rightBarbCos * perpCos + rightBarbSin * perpSin;
				const rightT = ( -halfShaft - rightCurrentDist ) / rightDeltaPerStep;
				const rightShaftX = rightInnerX + rightT * rightBarbCos;
				const rightShaftY = rightInnerY + rightT * rightBarbSin;
				vertices.push( { x: rightShaftX, y: rightShaftY } );
				vertices.push( { x: rightInnerX, y: rightInnerY } );
				vertices.push( { x: rightOuterX, y: rightOuterY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: headBaseX - cos * chevronDepth - perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth - perpSin * barbWidth
				} );
			} else {
				const rightBarbX = x2 - barbLength * rightBarbCos;
				const rightBarbY = y2 - barbLength * rightBarbSin;
				vertices.push( { x: rightBarbX, y: rightBarbY } );
			}

			vertices.push( { x: x2, y: y2 } );

			if ( headType === 'standard' ) {
				const leftOuterX = x2 - barbLength * leftBarbCos;
				const leftOuterY = y2 - barbLength * leftBarbSin;
				// Line 2: perpendicular (90° clockwise)
				const leftInnerX = leftOuterX + barbThickness * leftBarbSin;
				const leftInnerY = leftOuterY - barbThickness * leftBarbCos;
				// Line 3: parallel to Line 1, find where it hits shaft edge
				const leftDx = leftInnerX - headBaseX;
				const leftDy = leftInnerY - headBaseY;
				const leftCurrentDist = leftDx * perpCos + leftDy * perpSin;
				const leftDeltaPerStep = leftBarbCos * perpCos + leftBarbSin * perpSin;
				const leftT = ( halfShaft - leftCurrentDist ) / leftDeltaPerStep;
				const leftShaftX = leftInnerX + leftT * leftBarbCos;
				const leftShaftY = leftInnerY + leftT * leftBarbSin;
				vertices.push( { x: leftOuterX, y: leftOuterY } );
				vertices.push( { x: leftInnerX, y: leftInnerY } );
				vertices.push( { x: leftShaftX, y: leftShaftY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: headBaseX - cos * chevronDepth + perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth + perpSin * barbWidth
				} );
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
			} else {
				const leftBarbX = x2 - barbLength * leftBarbCos;
				const leftBarbY = y2 - barbLength * leftBarbSin;
				vertices.push( { x: leftBarbX, y: leftBarbY } );
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
			}

			// Left side of shaft back to tail (only for non-standard)
			if ( headType !== 'standard' ) {
				vertices.push( { x: tailBaseX + perpCos * halfShaft, y: tailBaseY + perpSin * halfShaft } );
			}
		}

		return vertices;
	};

	/**
	 * Draw a custom polygon from points
	 *
	 * @param {Object} layer - Layer with points array
	 */
	ShapeRenderer.prototype.drawPolygon = function ( layer ) {
		if ( !layer.points || !Array.isArray( layer.points ) || layer.points.length < 3 ) {
			// Fallback for regular polygon defined by sides/radius
			// Always draw regular polygon if no valid points array (default 6 sides)
			this.drawRegularPolygon( layer );
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
