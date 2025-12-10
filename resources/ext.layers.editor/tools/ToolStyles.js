/**
 * Tool Styles Manager for Layers Editor
 * Manages current drawing style state and style operations
 * Extracted from ToolManager.js for better separation of concerns
 */
( function () {
	'use strict';

	/**
	 * Default style configuration
	 *
	 * @type {Object}
	 */
	const DEFAULT_STYLE = {
		// Stroke
		color: '#000000',
		strokeWidth: 2,

		// Fill
		fill: 'transparent',
		fillOpacity: 1,

		// Text
		fontSize: 16,
		fontFamily: 'Arial, sans-serif',

		// Arrow
		arrowStyle: 'single',

		// Shadow
		shadow: false,
		shadowColor: '#000000',
		shadowBlur: 8,
		shadowOffsetX: 2,
		shadowOffsetY: 2,

		// Opacity
		opacity: 1
	};

	/**
	 * ToolStyles class
	 * Manages the current drawing style state
	 */
	class ToolStyles {
		/**
		 * Create a ToolStyles instance
		 *
		 * @param {Object} [initialStyle] Initial style values
		 */
		constructor( initialStyle ) {
			/**
			 * Current style state
			 *
			 * @type {Object}
			 */
			this.currentStyle = this.createDefaultStyle();

			// Apply initial style if provided
			if ( initialStyle ) {
				this.update( initialStyle );
			}

			/**
			 * Style change listeners
			 *
			 * @type {Function[]}
			 */
			this.listeners = [];
		}

		/**
		 * Create a copy of the default style
		 *
		 * @return {Object} Default style object
		 */
		createDefaultStyle() {
			const style = {};
			for ( const prop in DEFAULT_STYLE ) {
				if ( Object.prototype.hasOwnProperty.call( DEFAULT_STYLE, prop ) ) {
					style[ prop ] = DEFAULT_STYLE[ prop ];
				}
			}
			return style;
		}

		/**
		 * Get the current style
		 *
		 * @return {Object} Copy of current style
		 */
		get() {
			const copy = {};
			for ( const prop in this.currentStyle ) {
				if ( Object.prototype.hasOwnProperty.call( this.currentStyle, prop ) ) {
					copy[ prop ] = this.currentStyle[ prop ];
				}
			}
			return copy;
		}

		/**
		 * Get a specific style property
		 *
		 * @param {string} property Property name
		 * @return {*} Property value
		 */
		getProperty( property ) {
			return this.currentStyle[ property ];
		}

		/**
		 * Set a specific style property
		 *
		 * @param {string} property Property name
		 * @param {*} value Property value
		 */
		setProperty( property, value ) {
			const oldValue = this.currentStyle[ property ];
			this.currentStyle[ property ] = value;

			if ( oldValue !== value ) {
				this.notifyListeners( property, value, oldValue );
			}
		}

		/**
		 * Update multiple style properties
		 *
		 * @param {Object} style Style properties to update
		 */
		update( style ) {
			if ( !style || typeof style !== 'object' ) {
				return;
			}

			const changes = {};
			for ( const prop in style ) {
				if ( Object.prototype.hasOwnProperty.call( style, prop ) ) {
					const oldValue = this.currentStyle[ prop ];
					const newValue = style[ prop ];

					if ( oldValue !== newValue ) {
						this.currentStyle[ prop ] = newValue;
						changes[ prop ] = { oldValue: oldValue, newValue: newValue };
					}
				}
			}

			// Notify listeners of all changes
			if ( Object.keys( changes ).length > 0 ) {
				this.notifyListeners( null, changes, null );
			}
		}

		/**
		 * Reset to default style
		 */
		reset() {
			this.currentStyle = this.createDefaultStyle();
			this.notifyListeners( null, this.currentStyle, null );
		}

		/**
		 * Subscribe to style changes
		 *
		 * @param {Function} listener Callback function(property, newValue, oldValue)
		 * @return {Function} Unsubscribe function
		 */
		subscribe( listener ) {
			if ( typeof listener === 'function' ) {
				this.listeners.push( listener );
			}

			return () => {
				const index = this.listeners.indexOf( listener );
				if ( index !== -1 ) {
					this.listeners.splice( index, 1 );
				}
			};
		}

		/**
		 * Notify all listeners of a change
		 *
		 * @param {string|null} property Changed property (null for bulk)
		 * @param {*} newValue New value
		 * @param {*} oldValue Old value
		 */
		notifyListeners( property, newValue, oldValue ) {
			this.listeners.forEach( ( listener ) => {
				try {
					listener( property, newValue, oldValue );
				} catch ( err ) {
					// Log but don't propagate listener errors
					if ( typeof console !== 'undefined' && console.error ) {
						// eslint-disable-next-line no-console
						console.error( '[ToolStyles] Listener error:', err );
					}
				}
			} );
		}

		/**
		 * Get color property
		 *
		 * @return {string} Current color
		 */
		getColor() {
			return this.currentStyle.color;
		}

		/**
		 * Set color property
		 *
		 * @param {string} color Color value
		 */
		setColor( color ) {
			this.setProperty( 'color', color );
		}

		/**
		 * Get stroke width
		 *
		 * @return {number} Current stroke width
		 */
		getStrokeWidth() {
			return this.currentStyle.strokeWidth;
		}

		/**
		 * Set stroke width
		 *
		 * @param {number} width Stroke width
		 */
		setStrokeWidth( width ) {
			this.setProperty( 'strokeWidth', Math.max( 0.5, width ) );
		}

		/**
		 * Get fill color
		 *
		 * @return {string} Current fill color
		 */
		getFill() {
			return this.currentStyle.fill;
		}

		/**
		 * Set fill color
		 *
		 * @param {string} fill Fill color
		 */
		setFill( fill ) {
			this.setProperty( 'fill', fill );
		}

		/**
		 * Get font size
		 *
		 * @return {number} Current font size
		 */
		getFontSize() {
			return this.currentStyle.fontSize;
		}

		/**
		 * Set font size
		 *
		 * @param {number} size Font size
		 */
		setFontSize( size ) {
			this.setProperty( 'fontSize', Math.max( 8, size ) );
		}

		/**
		 * Get font family
		 *
		 * @return {string} Current font family
		 */
		getFontFamily() {
			return this.currentStyle.fontFamily;
		}

		/**
		 * Set font family
		 *
		 * @param {string} family Font family
		 */
		setFontFamily( family ) {
			this.setProperty( 'fontFamily', family );
		}

		/**
		 * Get shadow enabled state
		 *
		 * @return {boolean} Whether shadow is enabled
		 */
		getShadowEnabled() {
			return this.currentStyle.shadow;
		}

		/**
		 * Set shadow enabled state
		 *
		 * @param {boolean} enabled Whether shadow is enabled
		 */
		setShadowEnabled( enabled ) {
			this.setProperty( 'shadow', !!enabled );
		}

		/**
		 * Get all shadow properties
		 *
		 * @return {Object} Shadow properties
		 */
		getShadow() {
			return {
				shadow: this.currentStyle.shadow,
				shadowColor: this.currentStyle.shadowColor,
				shadowBlur: this.currentStyle.shadowBlur,
				shadowOffsetX: this.currentStyle.shadowOffsetX,
				shadowOffsetY: this.currentStyle.shadowOffsetY
			};
		}

		/**
		 * Set shadow properties
		 *
		 * @param {Object} shadowProps Shadow properties
		 */
		setShadow( shadowProps ) {
			const props = {};
			if ( shadowProps.shadow !== undefined ) {
				props.shadow = !!shadowProps.shadow;
			}
			if ( shadowProps.shadowColor !== undefined ) {
				props.shadowColor = shadowProps.shadowColor;
			}
			if ( shadowProps.shadowBlur !== undefined ) {
				props.shadowBlur = Math.max( 0, shadowProps.shadowBlur );
			}
			if ( shadowProps.shadowOffsetX !== undefined ) {
				props.shadowOffsetX = shadowProps.shadowOffsetX;
			}
			if ( shadowProps.shadowOffsetY !== undefined ) {
				props.shadowOffsetY = shadowProps.shadowOffsetY;
			}
			this.update( props );
		}

		/**
		 * Get arrow style
		 *
		 * @return {string} Arrow style
		 */
		getArrowStyle() {
			return this.currentStyle.arrowStyle;
		}

		/**
		 * Set arrow style
		 *
		 * @param {string} style Arrow style
		 */
		setArrowStyle( style ) {
			this.setProperty( 'arrowStyle', style );
		}

		/**
		 * Apply current style to a layer object
		 *
		 * @param {Object} layer Layer to apply style to
		 * @param {Object} [options] Options
		 * @param {boolean} [options.includePosition] Include x/y from style
		 * @return {Object} Layer with style applied
		 */
		applyToLayer( layer, options ) {
			const opts = options || {};

			// Apply stroke properties
			if ( layer.stroke === undefined ) {
				layer.stroke = this.currentStyle.color;
			}
			if ( layer.strokeWidth === undefined ) {
				layer.strokeWidth = this.currentStyle.strokeWidth;
			}

			// Apply fill properties
			if ( layer.fill === undefined ) {
				layer.fill = this.currentStyle.fill;
			}

			// Apply position if requested (e.g., for pasting at cursor)
			if ( opts.includePosition ) {
				if ( this.currentStyle.x !== undefined ) {
					layer.x = this.currentStyle.x;
				}
				if ( this.currentStyle.y !== undefined ) {
					layer.y = this.currentStyle.y;
				}
			}

			// Apply shadow properties
			layer.shadow = this.currentStyle.shadow;
			layer.shadowColor = this.currentStyle.shadowColor;
			layer.shadowBlur = this.currentStyle.shadowBlur;
			layer.shadowOffsetX = this.currentStyle.shadowOffsetX;
			layer.shadowOffsetY = this.currentStyle.shadowOffsetY;

			// Apply text properties for text layers
			if ( layer.type === 'text' ) {
				if ( layer.fontSize === undefined ) {
					layer.fontSize = this.currentStyle.fontSize;
				}
				if ( layer.fontFamily === undefined ) {
					layer.fontFamily = this.currentStyle.fontFamily;
				}
				if ( layer.color === undefined ) {
					layer.color = this.currentStyle.color;
				}
			}

			// Apply arrow style for arrow layers
			if ( layer.type === 'arrow' ) {
				if ( layer.arrowStyle === undefined ) {
					layer.arrowStyle = this.currentStyle.arrowStyle;
				}
			}

			return layer;
		}

		/**
		 * Extract style from a layer object
		 *
		 * @param {Object} layer Layer to extract style from
		 * @return {Object} Extracted style
		 */
		extractFromLayer( layer ) {
			const style = {};

			if ( layer.stroke ) {
				style.color = layer.stroke;
			}
			if ( layer.color ) {
				style.color = layer.color;
			}
			if ( layer.strokeWidth !== undefined ) {
				style.strokeWidth = layer.strokeWidth;
			}
			if ( layer.fill ) {
				style.fill = layer.fill;
			}
			if ( layer.fontSize !== undefined ) {
				style.fontSize = layer.fontSize;
			}
			if ( layer.fontFamily ) {
				style.fontFamily = layer.fontFamily;
			}
			if ( layer.shadow !== undefined ) {
				style.shadow = layer.shadow;
			}
			if ( layer.shadowColor ) {
				style.shadowColor = layer.shadowColor;
			}
			if ( layer.shadowBlur !== undefined ) {
				style.shadowBlur = layer.shadowBlur;
			}
			if ( layer.shadowOffsetX !== undefined ) {
				style.shadowOffsetX = layer.shadowOffsetX;
			}
			if ( layer.shadowOffsetY !== undefined ) {
				style.shadowOffsetY = layer.shadowOffsetY;
			}
			if ( layer.arrowStyle ) {
				style.arrowStyle = layer.arrowStyle;
			}

			return style;
		}

		/**
		 * Destroy and clean up
		 */
		destroy() {
			this.listeners = [];
			this.currentStyle = null;
		}
	}

	// Export DEFAULT_STYLE for testing
	ToolStyles.DEFAULT_STYLE = DEFAULT_STYLE;

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Tools = window.Layers.Tools || {};
		window.Layers.Tools.ToolStyles = ToolStyles;

		// Backward compatibility - direct window export
		window.ToolStyles = ToolStyles;
	}

	// CommonJS export for testing
	/* eslint-disable-next-line no-undef */
	if ( typeof module !== 'undefined' && module.exports ) {
		/* eslint-disable-next-line no-undef */
		module.exports = ToolStyles;
	}
}() );
