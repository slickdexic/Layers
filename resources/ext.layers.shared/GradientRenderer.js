/**
 * GradientRenderer - Creates canvas gradient objects from layer gradient definitions
 *
 * Gradient definition format:
 * {
 *   type: 'linear' | 'radial',
 *   angle: number (0-360, for linear gradients),
 *   colors: [
 *     { offset: 0, color: '#ff0000' },
 *     { offset: 1, color: '#0000ff' }
 *   ],
 *   // For radial gradients:
 *   centerX: number (0-1, relative position),
 *   centerY: number (0-1, relative position),
 *   radius: number (0-1, relative to smallest dimension)
 * }
 *
 * @module GradientRenderer
 */
( function () {
	'use strict';

	/**
	 * GradientRenderer class
	 */
	class GradientRenderer {
		/**
		 * Create a GradientRenderer
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 */
		constructor( ctx ) {
			this.ctx = ctx;
		}

		/**
		 * Set the canvas context
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
		}

		/**
		 * Check if a layer has a gradient fill
	 * @param {Object} layer - Layer object
	 * @return {boolean} True if layer has gradient
	 */
	static hasGradient( layer ) {
		return Boolean(
			layer && layer.gradient &&
			typeof layer.gradient === 'object' &&
			( layer.gradient.type === 'linear' || layer.gradient.type === 'radial' ) &&
			Array.isArray( layer.gradient.colors ) &&
			layer.gradient.colors.length >= 2
		);
	}

	/**
	 * Create a canvas gradient from a layer's gradient definition
	 * @param {Object} layer - Layer with gradient property
	 * @param {Object} bounds - Bounding box { x, y, width, height }
		 * @param {Object} [options] - Additional options
		 * @param {number} [options.scale=1] - Scale factor
		 * @return {CanvasGradient|null} Canvas gradient or null if invalid
		 */
		createGradient( layer, bounds, options = {} ) {
			if ( !this.ctx ) {
				return null;
			}

			if ( !GradientRenderer.hasGradient( layer ) ) {
				return null;
			}

			try {
				const gradient = layer.gradient;
				const scale = options.scale || 1;

				// Scale bounds
				const x = bounds.x * scale;
				const y = bounds.y * scale;
				const width = bounds.width * scale;
				const height = bounds.height * scale;

				let canvasGradient;

				if ( gradient.type === 'linear' ) {
					canvasGradient = this._createLinearGradient( gradient, x, y, width, height );
				} else if ( gradient.type === 'radial' ) {
					canvasGradient = this._createRadialGradient( gradient, x, y, width, height );
				} else {
					return null;
				}

				// Add color stops
				this._addColorStops( canvasGradient, gradient.colors );

				return canvasGradient;
			} catch ( e ) {
				// Log error and return null to fall back to solid fill
				if ( window.mw && window.mw.log ) {
					window.mw.log.warn( '[GradientRenderer] Failed to create gradient:', e );
				}
				return null;
			}
		}

		/**
		 * Create a linear gradient
		 * @private
		 * @param {Object} gradient - Gradient definition
		 * @param {number} x - X position
		 * @param {number} y - Y position
		 * @param {number} width - Width
		 * @param {number} height - Height
		 * @return {CanvasGradient} Linear gradient
		 */
		_createLinearGradient( gradient, x, y, width, height ) {
			const angle = ( gradient.angle || 0 ) * ( Math.PI / 180 );
			const centerX = x + width / 2;
			const centerY = y + height / 2;

			// Calculate gradient line based on angle
			// The gradient should span the full bounding box
			const diagonal = Math.sqrt( width * width + height * height ) / 2;

			const x0 = centerX - Math.cos( angle ) * diagonal;
			const y0 = centerY - Math.sin( angle ) * diagonal;
			const x1 = centerX + Math.cos( angle ) * diagonal;
			const y1 = centerY + Math.sin( angle ) * diagonal;

			return this.ctx.createLinearGradient( x0, y0, x1, y1 );
		}

		/**
		 * Create a radial gradient
		 * @private
		 * @param {Object} gradient - Gradient definition
		 * @param {number} x - X position
		 * @param {number} y - Y position
		 * @param {number} width - Width
		 * @param {number} height - Height
		 * @return {CanvasGradient} Radial gradient
		 */
		_createRadialGradient( gradient, x, y, width, height ) {
			// Default center is at 50%, 50%
			const relCenterX = gradient.centerX !== undefined ? gradient.centerX : 0.5;
			const relCenterY = gradient.centerY !== undefined ? gradient.centerY : 0.5;
			const relRadius = gradient.radius !== undefined ? gradient.radius : 0.5;

			const centerX = x + width * relCenterX;
			const centerY = y + height * relCenterY;

			// Radius is relative to the smallest dimension
			const minDim = Math.min( width, height );
			const radius = minDim * relRadius;

			// Inner radius is 0 (starts from center)
			return this.ctx.createRadialGradient( centerX, centerY, 0, centerX, centerY, radius );
		}

		/**
		 * Add color stops to a gradient
		 * @private
		 * @param {CanvasGradient} canvasGradient - Canvas gradient
		 * @param {Array} colors - Color stop array
		 */
		_addColorStops( canvasGradient, colors ) {
			// Sort by offset to ensure proper order
			const sortedColors = [ ...colors ].sort( ( a, b ) => a.offset - b.offset );

			for ( const stop of sortedColors ) {
				const offset = Math.max( 0, Math.min( 1, stop.offset || 0 ) );
				const color = stop.color || '#000000';
				try {
					canvasGradient.addColorStop( offset, color );
				} catch ( e ) {
					// Invalid color, use fallback
					if ( window.mw && window.mw.log ) {
						window.mw.log.warn( '[GradientRenderer] Invalid color:', color );
					}
					canvasGradient.addColorStop( offset, '#000000' );
				}
			}
		}

		/**
		 * Apply gradient or solid fill to the current path
		 * @param {Object} layer - Layer object
		 * @param {Object} bounds - Bounding box { x, y, width, height }
		 * @param {Object} [options] - Additional options
		 * @return {boolean} True if gradient was applied, false if solid fill used
		 */
		applyFill( layer, bounds, options = {} ) {
			const gradient = this.createGradient( layer, bounds, options );

			if ( gradient ) {
				this.ctx.fillStyle = gradient;
				return true;
			}

			// Fallback to solid fill
			if ( layer.fill && layer.fill !== 'none' && layer.fill !== 'transparent' ) {
				this.ctx.fillStyle = layer.fill;
			}

			return false;
		}

		/**
		 * Create a default gradient definition
		 * @param {string} type - 'linear' or 'radial'
		 * @param {string} startColor - Start color
		 * @param {string} endColor - End color
		 * @return {Object} Gradient definition
		 */
		static createDefaultGradient( type, startColor = '#ffffff', endColor = '#000000' ) {
			const base = {
				type: type,
				colors: [
					{ offset: 0, color: startColor },
					{ offset: 1, color: endColor }
				]
			};

			if ( type === 'linear' ) {
				base.angle = 90; // Top to bottom
			} else if ( type === 'radial' ) {
				base.centerX = 0.5;
				base.centerY = 0.5;
				base.radius = 0.7;
			}

			return base;
		}

		/**
		 * Get preset gradient definitions
		 * @return {Object} Map of preset names to gradient definitions
		 */
		static getPresets() {
			return {
				'sunset': {
					type: 'linear',
					angle: 180,
					colors: [
						{ offset: 0, color: '#ff512f' },
						{ offset: 1, color: '#f09819' }
					]
				},
				'ocean': {
					type: 'linear',
					angle: 135,
					colors: [
						{ offset: 0, color: '#2193b0' },
						{ offset: 1, color: '#6dd5ed' }
					]
				},
				'forest': {
					type: 'linear',
					angle: 90,
					colors: [
						{ offset: 0, color: '#134e5e' },
						{ offset: 1, color: '#71b280' }
					]
				},
				'fire': {
					type: 'radial',
					centerX: 0.5,
					centerY: 0.5,
					radius: 0.7,
					colors: [
						{ offset: 0, color: '#f5af19' },
						{ offset: 0.5, color: '#f12711' },
						{ offset: 1, color: '#6b0f1a' }
					]
				},
				'steel': {
					type: 'linear',
					angle: 90,
					colors: [
						{ offset: 0, color: '#bdc3c7' },
						{ offset: 0.5, color: '#2c3e50' },
						{ offset: 1, color: '#bdc3c7' }
					]
				},
				'rainbow': {
					type: 'linear',
					angle: 90,
					colors: [
						{ offset: 0, color: '#ff0000' },
						{ offset: 0.17, color: '#ff8000' },
						{ offset: 0.33, color: '#ffff00' },
						{ offset: 0.5, color: '#00ff00' },
						{ offset: 0.67, color: '#0080ff' },
						{ offset: 0.83, color: '#8000ff' },
						{ offset: 1, color: '#ff00ff' }
					]
				}
			};
		}

		/**
		 * Validate a gradient definition
		 * @param {Object} gradient - Gradient to validate
		 * @return {Object} Validation result { valid: boolean, errors: string[] }
		 */
		static validate( gradient ) {
			const errors = [];

			if ( !gradient || typeof gradient !== 'object' ) {
				return { valid: false, errors: [ 'Gradient must be an object' ] };
			}

			if ( gradient.type !== 'linear' && gradient.type !== 'radial' ) {
				errors.push( 'Gradient type must be "linear" or "radial"' );
			}

			if ( !Array.isArray( gradient.colors ) ) {
				errors.push( 'Gradient colors must be an array' );
			} else if ( gradient.colors.length < 2 ) {
				errors.push( 'Gradient must have at least 2 color stops' );
			} else {
				gradient.colors.forEach( ( stop, i ) => {
					if ( typeof stop.offset !== 'number' || stop.offset < 0 || stop.offset > 1 ) {
						errors.push( `Color stop ${i}: offset must be a number between 0 and 1` );
					}
					if ( typeof stop.color !== 'string' ) {
						errors.push( `Color stop ${i}: color must be a string` );
					}
				} );
			}

			if ( gradient.type === 'linear' ) {
				if ( gradient.angle !== undefined && ( typeof gradient.angle !== 'number' || gradient.angle < 0 || gradient.angle > 360 ) ) {
					errors.push( 'Linear gradient angle must be a number between 0 and 360' );
				}
			}

			if ( gradient.type === 'radial' ) {
				[ 'centerX', 'centerY' ].forEach( ( prop ) => {
					if ( gradient[ prop ] !== undefined ) {
						const val = gradient[ prop ];
						if ( typeof val !== 'number' || val < 0 || val > 1 ) {
							errors.push( `Radial gradient ${prop} must be a number between 0 and 1` );
						}
					}
				} );
				// Radius allows 0-2 to match server-side validation
				if ( gradient.radius !== undefined ) {
					const val = gradient.radius;
					if ( typeof val !== 'number' || val < 0 || val > 2 ) {
						errors.push( 'Radial gradient radius must be a number between 0 and 2' );
					}
				}
			}

			return { valid: errors.length === 0, errors: errors };
		}

		/**
		 * Clone a gradient definition
		 * @param {Object} gradient - Gradient to clone
		 * @return {Object} Cloned gradient
		 */
		static clone( gradient ) {
			if ( !gradient ) {
				return null;
			}
			return {
				type: gradient.type,
				angle: gradient.angle,
				centerX: gradient.centerX,
				centerY: gradient.centerY,
				radius: gradient.radius,
				colors: gradient.colors ? gradient.colors.map( ( c ) => ( { offset: c.offset, color: c.color } ) ) : []
			};
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.ctx = null;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Renderers = window.Layers.Renderers || {};
		window.Layers.Renderers.GradientRenderer = GradientRenderer;
	}

	// CommonJS export for Jest
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = GradientRenderer;
	}
}() );
