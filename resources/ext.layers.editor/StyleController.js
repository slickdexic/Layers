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
			this.currentStyle = Object.assign( {}, DEFAULT_STYLE );
		}

		/**
		 * Get the default style settings
		 *
		 * @static
		 * @return {Object} Default style settings
		 */
		static getDefaultStyle() {
			return Object.assign( {}, DEFAULT_STYLE );
		}

		/**
		 * Set the current style by merging with existing
		 *
		 * @param {Object} style - Style properties to merge
		 */
		setCurrentStyle( style ) {
			this.currentStyle = Object.assign( {}, this.currentStyle, style );
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

			const next = {
				color: isDefined( options.color ) ? options.color : prev.color,
				fill: isDefined( options.fill ) ? options.fill : prev.fill,
				strokeWidth: isDefined( options.strokeWidth ) ? options.strokeWidth : prev.strokeWidth,
				fontSize: isDefined( options.fontSize ) ? options.fontSize : prev.fontSize,
				fontFamily: isDefined( options.fontFamily ) ? options.fontFamily : prev.fontFamily || 'Arial, sans-serif',
				textStrokeColor: isDefined( options.textStrokeColor ) ? options.textStrokeColor : prev.textStrokeColor,
				textStrokeWidth: isDefined( options.textStrokeWidth ) ? options.textStrokeWidth : prev.textStrokeWidth,
				textShadow: isDefined( options.textShadow ) ? options.textShadow : prev.textShadow,
				textShadowColor: isDefined( options.textShadowColor ) ? options.textShadowColor : prev.textShadowColor,
				arrowStyle: isDefined( options.arrowStyle ) ? options.arrowStyle : prev.arrowStyle,
				shadow: isDefined( options.shadow ) ? options.shadow : prev.shadow,
				shadowColor: isDefined( options.shadowColor ) ? options.shadowColor : prev.shadowColor,
				shadowBlur: isDefined( options.shadowBlur ) ? options.shadowBlur : prev.shadowBlur,
				shadowOffsetX: isDefined( options.shadowOffsetX ) ? options.shadowOffsetX : prev.shadowOffsetX,
				shadowOffsetY: isDefined( options.shadowOffsetY ) ? options.shadowOffsetY : prev.shadowOffsetY
			};

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
				if ( layer.type === 'text' || layer.type === 'highlight' ) {
					layer.fill = next.color;
				} else {
					layer.stroke = next.color;
				}
			}

			// Apply fill (not for text, line, or arrow)
			if ( next.fill ) {
				if ( layer.type !== 'text' && layer.type !== 'line' && layer.type !== 'arrow' ) {
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
