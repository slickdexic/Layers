/**
 * Canvas Utilities Module
 * Pure utility functions extracted from CanvasManager for reusability
 * These are stateless helpers that can be used independently
 *
 * @class CanvasUtilities
 */
( function () {
	'use strict';

	/**
	 * Whitelist of safe fonts for sanitization
	 *
	 * @type {string[]}
	 */
	const SAFE_FONTS = [
		'Arial', 'Helvetica', 'Times', 'Times New Roman',
		'Courier', 'Courier New', 'Verdana', 'Georgia',
		'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
		'Trebuchet MS', 'Arial Black', 'Impact', 'Roboto',
		'Noto Sans', 'sans-serif', 'serif', 'monospace'
	];

	/**
	 * Valid canvas blend modes
	 *
	 * @type {string[]}
	 */
	const VALID_BLEND_MODES = [
		'source-over', 'source-in', 'source-out', 'source-atop',
		'destination-over', 'destination-in', 'destination-out', 'destination-atop',
		'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay',
		'darken', 'lighten', 'color-dodge', 'color-burn',
		'hard-light', 'soft-light', 'difference', 'exclusion',
		'hue', 'saturation', 'color', 'luminosity'
	];

	/**
	 * Handle type to cursor mapping
	 *
	 * @type {Object}
	 */
	const HANDLE_CURSORS = {
		nw: 'nw-resize',
		se: 'nw-resize',
		ne: 'ne-resize',
		sw: 'ne-resize',
		n: 'ns-resize',
		s: 'ns-resize',
		e: 'ew-resize',
		w: 'ew-resize',
		rotate: 'crosshair'
	};

	/**
	 * CanvasUtilities - Collection of pure static utility functions
	 */
	class CanvasUtilities {
		/**
		 * Sanitize a numeric value with range constraints
		 *
		 * @param {*} value - Value to sanitize
		 * @param {number} defaultVal - Default value if invalid
		 * @param {number} [min] - Minimum allowed value
		 * @param {number} [max] - Maximum allowed value
		 * @return {number} Sanitized number
		 */
		static sanitizeNumber( value, defaultVal, min, max ) {
			const num = typeof value === 'number' ? value : parseFloat( value );
			if ( isNaN( num ) || !isFinite( num ) ) {
				return defaultVal;
			}
			if ( typeof min === 'number' && num < min ) {
				return min;
			}
			if ( typeof max === 'number' && num > max ) {
				return max;
			}
			return num;
		}

		/**
		 * Sanitize color value
		 *
		 * @param {string} color - Color to sanitize
		 * @param {string} defaultColor - Default color if invalid
		 * @return {string} Sanitized color
		 */
		static sanitizeColor( color, defaultColor ) {
			if ( !color || typeof color !== 'string' ) {
				return defaultColor;
			}

			// Allow transparent and none
			if ( color === 'transparent' || color === 'none' ) {
				return color;
			}

			// Basic validation - must start with # for hex or be a named color
			if ( color.match( /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/ ) ||
				color.match( /^(rgb|rgba|hsl|hsla)\s*\([^)]+\)$/ ) ||
				color.match( /^[a-zA-Z]+$/ ) ) {
				return color;
			}

			return defaultColor;
		}

		/**
		 * Sanitize font family
		 *
		 * @param {string} fontFamily - Font family to sanitize
		 * @return {string} Sanitized font family
		 */
		static sanitizeFontFamily( fontFamily ) {
			if ( !fontFamily || typeof fontFamily !== 'string' ) {
				return 'Arial, sans-serif';
			}

			// Check if font is in whitelist
			const lowerFont = fontFamily.toLowerCase();
			for ( let i = 0; i < SAFE_FONTS.length; i++ ) {
				if ( lowerFont.indexOf( SAFE_FONTS[ i ].toLowerCase() ) !== -1 ) {
					return fontFamily;
				}
			}

			return 'Arial, sans-serif';
		}

		/**
		 * Check if rectangles intersect
		 *
		 * @param {Object} rect1 - First rectangle {x, y, width, height}
		 * @param {Object} rect2 - Second rectangle {x, y, width, height}
		 * @return {boolean} True if rectangles intersect
		 */
		static rectanglesIntersect( rect1, rect2 ) {
			return rect1.x < rect2.x + rect2.width &&
				rect1.x + rect1.width > rect2.x &&
				rect1.y < rect2.y + rect2.height &&
				rect1.y + rect1.height > rect2.y;
		}

		/**
		 * Clamp a value between min and max
		 *
		 * @param {number} value - Value to clamp
		 * @param {number} min - Minimum value
		 * @param {number} max - Maximum value
		 * @return {number} Clamped value
		 */
		static clamp( value, min, max ) {
			return Math.max( min, Math.min( max, value ) );
		}

		/**
		 * Get cursor for a resize handle
		 *
		 * @param {Object} handle - Handle object with type property
		 * @return {string} CSS cursor value
		 */
		static getCursorForHandle( handle ) {
			if ( !handle || !handle.type ) {
				return 'default';
			}

			return HANDLE_CURSORS[ handle.type ] || 'move';
		}

		/**
		 * Get cursor for a tool
		 *
		 * @param {string} tool - Tool name
		 * @return {string} CSS cursor value
		 */
		static getToolCursor( tool ) {
			switch ( tool ) {
				case 'pointer':
					return 'default';
				case 'pan':
					return 'grab';
				case 'text':
					return 'text';
				default:
					return 'crosshair';
			}
		}

		/**
		 * Check if a blend mode is valid
		 *
		 * @param {string} blendMode - Blend mode to check
		 * @return {boolean} True if valid blend mode
		 */
		static isValidBlendMode( blendMode ) {
			return VALID_BLEND_MODES.indexOf( blendMode ) !== -1;
		}

		/**
		 * Calculate scaled dimensions maintaining aspect ratio
		 *
		 * @param {number} sourceWidth - Source width
		 * @param {number} sourceHeight - Source height
		 * @param {number} targetWidth - Target width
		 * @param {number} targetHeight - Target height
		 * @return {Object} Scaled dimensions {width, height, x, y}
		 */
		static calculateAspectFit( sourceWidth, sourceHeight, targetWidth, targetHeight ) {
			const sourceAspect = sourceWidth / sourceHeight;
			const targetAspect = targetWidth / targetHeight;

			let width, height, x, y;

			if ( targetAspect > sourceAspect ) {
				// Target is wider - fit to height
				height = targetHeight;
				width = height * sourceAspect;
				x = ( targetWidth - width ) / 2;
				y = 0;
			} else {
				// Target is taller or same - fit to width
				width = targetWidth;
				height = width / sourceAspect;
				x = 0;
				y = ( targetHeight - height ) / 2;
			}

			return { width: width, height: height, x: x, y: y };
		}

		/**
		 * Deep clone an object (simple implementation for layer data)
		 *
		 * @param {*} obj - Object to clone
		 * @return {*} Cloned object
		 */
		static deepClone( obj ) {
			if ( obj === null || typeof obj !== 'object' ) {
				return obj;
			}

			if ( Array.isArray( obj ) ) {
				return obj.map( function ( item ) {
					return CanvasUtilities.deepClone( item );
				} );
			}

			const cloned = {};
			for ( const key in obj ) {
				if ( Object.prototype.hasOwnProperty.call( obj, key ) ) {
					cloned[ key ] = CanvasUtilities.deepClone( obj[ key ] );
				}
			}
			return cloned;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.Utilities = CanvasUtilities;
	}

	// CommonJS export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CanvasUtilities;
	}

}() );
