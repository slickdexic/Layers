/**
 * StyleController - Manages style state for the Layers editor
 *
 * Tracks current style settings (colors, fonts, effects) and applies them to layers.
 *
 * @class StyleController
 */
( function () {
	'use strict';

	/**
	 * Default style settings
	 *
	 * @type {Object}
	 */
	const DEFAULT_STYLE = {
		color: '#000000',
		fill: null,
		strokeWidth: 2,
		fontSize: 16,
		fontFamily: 'Arial, sans-serif'
	};

	/**
	 * Check if a value is defined (not undefined or null)
	 *
	 * @private
	 * @param {*} value - Value to check
	 * @return {boolean} True if value is defined
	 */
	function isDefined( value ) {
		return value !== undefined && value !== null;
	}

	/**
	 * StyleController class - manages editor style state
	 */
	class StyleController {
		/**
		 * Creates a new StyleController instance
		 *
		 * @param {Object|null} editor - Reference to the editor instance
		 */
		constructor( editor = null ) {
			this.editor = editor;
			this.currentStyle = { ...DEFAULT_STYLE };
		}

		/**
		 * Get the default style settings
		 *
		 * @static
		 * @return {Object} Default style settings
		 */
		static getDefaultStyle() {
			return { ...DEFAULT_STYLE };
		}

		/**
		 * Set the current style by merging with existing
		 *
		 * @param {Object} style - Style properties to merge
		 */
		setCurrentStyle( style ) {
			this.currentStyle = { ...this.currentStyle, ...style };
		}

		/**
		 * Get the current style object
		 *
		 * @return {Object} Current style settings
		 */
		getCurrentStyle() {
			return this.currentStyle;
		}

		/**
		 * Update style options, preserving existing values for unspecified properties
		 *
		 * @param {Object} options - Style options to update
		 * @return {Object} Updated style object
		 */
		updateStyleOptions( options ) {
			this.currentStyle = this.currentStyle || {};
			const prev = this.currentStyle;

			// Start with previous style to preserve unmanaged properties (like arrowhead, arrowSize)
			const next = { ...prev };

			// Update managed properties if defined in options
			if ( isDefined( options.color ) ) {
				next.color = options.color;
			}
			if ( isDefined( options.fill ) ) {
				next.fill = options.fill;
			}
			if ( isDefined( options.strokeWidth ) ) {
				next.strokeWidth = options.strokeWidth;
			}
			if ( isDefined( options.fontSize ) ) {
				next.fontSize = options.fontSize;
			}
			if ( isDefined( options.fontFamily ) ) {
				next.fontFamily = options.fontFamily;
			}
			if ( isDefined( options.textStrokeColor ) ) {
				next.textStrokeColor = options.textStrokeColor;
			}
			if ( isDefined( options.textStrokeWidth ) ) {
				next.textStrokeWidth = options.textStrokeWidth;
			}
			if ( isDefined( options.textShadow ) ) {
				next.textShadow = options.textShadow;
			}
			if ( isDefined( options.textShadowColor ) ) {
				next.textShadowColor = options.textShadowColor;
			}
			if ( isDefined( options.arrowStyle ) ) {
				next.arrowStyle = options.arrowStyle;
			}
			// Allow unmanaged properties to be set via options too
			// This allows PresetStyleManager to inject properties like arrowhead
			Object.keys( options ).forEach( ( k ) => {
				// Skip properties we already handled specifically if we want specific logic,
				// but for now, simple overwrite for others is fine.
				// We exclude the ones above only if we wanted custom logic, but we don't.
				// However, to be safe and cleaner, let's just merge options onto next.
				if ( isDefined( options[ k ] ) ) {
					next[ k ] = options[ k ];
				}
			} );

			// Basic shadow properties mapping
			if ( isDefined( options.shadow ) ) {
				next.shadow = options.shadow;
			}
			if ( isDefined( options.shadowColor ) ) {
				next.shadowColor = options.shadowColor;
			}
			if ( isDefined( options.shadowBlur ) ) {
				next.shadowBlur = options.shadowBlur;
			}
			if ( isDefined( options.shadowOffsetX ) ) {
				next.shadowOffsetX = options.shadowOffsetX;
			}
			if ( isDefined( options.shadowOffsetY ) ) {
				next.shadowOffsetY = options.shadowOffsetY;
			}

			// Ensure essential defaults
			if ( !next.fontFamily ) {
				next.fontFamily = DEFAULT_STYLE.fontFamily;
			}

			this.currentStyle = next;
			return next;
		}

		/**
		 * Apply style settings to a layer based on its type
		 *
		 * @param {Object} layer - Layer to apply styles to
		 * @param {Object} next - Style settings to apply
		 */
		applyToLayer( layer, next ) {
			if ( !layer ) {
				return;
			}

			// Apply color based on layer type
			if ( next.color ) {
				if ( layer.type === 'text' ) {
					layer.fill = next.color;
				} else {
					layer.stroke = next.color;
				}
			}

			// Apply fill (not for text or line)
			// Text uses fill for text color; line has no fill.
			// Arrows DO support fill (e.g. storage arrows, fat arrows), so we allow it there.
			if ( next.fill ) {
				if ( layer.type !== 'text' && layer.type !== 'line' ) {
					layer.fill = next.fill;
				}
			}

			// Apply stroke width (not for text)
			if ( next.strokeWidth && layer.type !== 'text' ) {
				layer.strokeWidth = next.strokeWidth;
			}

			// Apply text-specific styles
			if ( layer.type === 'text' ) {
				layer.fontSize = next.fontSize || layer.fontSize || 16;
				layer.fontFamily = next.fontFamily || layer.fontFamily;
				if ( next.textStrokeColor ) {
					layer.textStrokeColor = next.textStrokeColor;
				}
				if ( next.textStrokeWidth ) {
					layer.textStrokeWidth = next.textStrokeWidth;
				}
			}

			// Apply shadow effects
			if ( next.shadow ) {
				layer.shadow = next.shadow;
				if ( next.shadowColor ) {
					layer.shadowColor = next.shadowColor;
				}
				if ( next.shadowBlur ) {
					layer.shadowBlur = next.shadowBlur;
				}
				if ( next.shadowOffsetX !== undefined ) {
					layer.shadowOffsetX = next.shadowOffsetX;
				}
				if ( next.shadowOffsetY !== undefined ) {
					layer.shadowOffsetY = next.shadowOffsetY;
				}
			}
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.StyleController = StyleController;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = StyleController;
	}

}() );
