/**
 * Property Builders for Layers Editor
 * Reusable property group builders extracted from PropertiesForm
 *
 * This module provides reusable builders for common property groups:
 * - Dimensions (width, height, corner radius)
 * - Text properties (content, font, styling)
 * - Text shadow properties
 * - Alignment properties
 * - Arrow/line endpoint properties
 *
 * @module PropertyBuilders
 */
( function () {
	'use strict';

	/**
	 * Helper to get translated message
	 * @param {string} key - Message key
	 * @param {string} fallback - Fallback text
	 * @return {string}
	 */
	function msg( key, fallback ) {
		if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
			return window.layersMessages.get( key, fallback );
		}
		return fallback || '';
	}

	/**
	 * Get LayersConstants from global namespace
	 * @return {Object}
	 */
	function getConstants() {
		const LayersConstants = ( window.Layers && window.Layers.Constants ) || {};
		return {
			LAYER_TYPES: LayersConstants.LAYER_TYPES || {},
			DEFAULTS: LayersConstants.DEFAULTS || {},
			LIMITS: LayersConstants.LIMITS || {},
			// Default effect values
			BLUR_RADIUS: ( LayersConstants.DEFAULTS && LayersConstants.DEFAULTS.EFFECTS &&
				LayersConstants.DEFAULTS.EFFECTS.BLUR_RADIUS ) || 12,
			BLUR_MIN: ( LayersConstants.DEFAULTS && LayersConstants.DEFAULTS.EFFECTS &&
				LayersConstants.DEFAULTS.EFFECTS.BLUR_MIN ) || 1,
			BLUR_MAX: ( LayersConstants.DEFAULTS && LayersConstants.DEFAULTS.EFFECTS &&
				LayersConstants.DEFAULTS.EFFECTS.BLUR_MAX ) || 64
		};
	}

	/**
	 * PropertyBuilders - Factory methods for property groups
	 * @namespace
	 */
	const PropertyBuilders = {};

	/**
	 * Add dimension properties (width, height, optional corner radius)
	 * @param {Object} ctx - Context with addInput, layer, editor
	 * @param {Object} [options] - Options for dimension inputs
	 * @param {boolean} [options.cornerRadius=false] - Include corner radius
	 * @param {number} [options.maxCornerRadius=200] - Max corner radius
	 */
	PropertyBuilders.addDimensions = function ( ctx, options ) {
		const opts = options || {};
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addInput( {
			label: t( 'layers-prop-width', 'Width' ),
			type: 'number',
			value: Math.round( layer.width || 0 ),
			step: 1,
			prop: 'width',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { width: Math.round( parseFloat( v ) ) } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-height', 'Height' ),
			type: 'number',
			value: Math.round( layer.height || 0 ),
			step: 1,
			prop: 'height',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { height: Math.round( parseFloat( v ) ) } );
			}
		} );

		if ( opts.cornerRadius ) {
			const maxRadius = opts.maxCornerRadius || 200;
			ctx.addInput( {
				label: t( 'layers-prop-corner-radius', 'Corner Radius' ),
				type: 'number',
				value: Math.round( layer.cornerRadius || 0 ),
				min: 0,
				max: maxRadius,
				step: 1,
				prop: 'cornerRadius',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, {
						cornerRadius: Math.max( 0, Math.round( parseFloat( v ) ) || 0 )
					} );
				}
			} );
		}
	};

	/**
	 * Add text content properties (text area, font family, font size, bold, italic, color, stroke)
	 * @param {Object} ctx - Context with addInput, addSelect, addCheckbox, addColorPicker, layer, editor
	 * @param {Object} [options] - Options
	 * @param {boolean} [options.useTextarea=true] - Use textarea (true) or single-line input (false)
	 * @param {boolean} [options.skipTextarea=false] - Skip textarea entirely (for richText layers like textbox/callout)
	 * @param {number} [options.maxLength=5000] - Max text length
	 * @param {number} [options.rows=5] - Textarea rows
	 * @param {number} [options.maxFontSize=200] - Max font size
	 */
	PropertyBuilders.addTextProperties = function ( ctx, options ) {
		const opts = options || {};
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;
		const useTextarea = opts.useTextarea !== false;
		const skipTextarea = opts.skipTextarea === true;
		const maxLength = opts.maxLength || ( useTextarea ? 5000 : 1000 );
		const maxFontSize = opts.maxFontSize || 200;

		// Text content - skip for layers that use richText (textbox/callout)
		// These layers are edited inline on canvas with full formatting support
		if ( !skipTextarea ) {
			ctx.addInput( {
				label: t( 'layers-prop-text', 'Text' ),
				type: useTextarea ? 'textarea' : 'text',
				value: layer.text || '',
				maxLength: maxLength,
				rows: opts.rows || 5,
				wide: useTextarea,
				onChange: function ( v ) {
					editor.updateLayer( layer.id, { text: v } );
				}
			} );
		}

		// Font family dropdown - use centralized FontConfig
		const FontConfig = window.Layers && window.Layers.FontConfig;
		const fontOptions = FontConfig ? FontConfig.getFontOptions() : [
			{ value: 'Arial', text: 'Arial' },
			{ value: 'Roboto', text: 'Roboto' },
			{ value: 'Noto Sans', text: 'Noto Sans' },
			{ value: 'Times New Roman', text: 'Times New Roman' },
			{ value: 'Courier New', text: 'Courier New' }
		];

		// Get the matching font value for the dropdown
		const currentFontValue = FontConfig ?
			FontConfig.findMatchingFont( layer.fontFamily || 'Arial' ) :
			( layer.fontFamily || 'Arial' );

		ctx.addSelect( {
			label: t( 'layers-prop-font-family', 'Font' ),
			value: currentFontValue,
			options: fontOptions,
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { fontFamily: v } );
			}
		} );

		// Font size
		ctx.addInput( {
			label: t( 'layers-prop-font-size', 'Font Size' ),
			type: 'number',
			value: layer.fontSize || 16,
			min: 6,
			max: maxFontSize,
			step: 1,
			prop: 'fontSize',
			onChange: function ( v ) {
				const fs = Math.max( 6, Math.min( maxFontSize, parseInt( v, 10 ) ) );
				editor.updateLayer( layer.id, { fontSize: fs } );
			}
		} );

		// Bold and Italic toggles
		ctx.addCheckbox( {
			label: t( 'layers-prop-bold', 'Bold' ),
			value: layer.fontWeight === 'bold',
			onChange: function ( checked ) {
				editor.updateLayer( layer.id, { fontWeight: checked ? 'bold' : 'normal' } );
			}
		} );

		ctx.addCheckbox( {
			label: t( 'layers-prop-italic', 'Italic' ),
			value: layer.fontStyle === 'italic',
			onChange: function ( checked ) {
				editor.updateLayer( layer.id, { fontStyle: checked ? 'italic' : 'normal' } );
			}
		} );

		// Text color
		ctx.addColorPicker( {
			label: t( 'layers-prop-text-color', 'Text Color' ),
			value: layer.color || '#000000',
			property: 'color',
			onChange: function ( newColor ) {
				editor.updateLayer( layer.id, { color: newColor } );
			}
		} );

		// Text stroke
		ctx.addInput( {
			label: t( 'layers-prop-text-stroke-width', 'Text Stroke Width' ),
			type: 'number',
			value: layer.textStrokeWidth || 0,
			min: 0,
			max: 20,
			step: 0.5,
			prop: 'textStrokeWidth',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, {
					textStrokeWidth: Math.max( 0, Math.min( 20, parseFloat( v ) ) )
				} );
			}
		} );

		ctx.addColorPicker( {
			label: t( 'layers-prop-text-stroke-color', 'Text Stroke Color' ),
			value: layer.textStrokeColor || '#000000',
			property: 'textStrokeColor',
			onChange: function ( newColor ) {
				editor.updateLayer( layer.id, { textStrokeColor: newColor } );
			}
		} );
	};

	/**
	 * Add text shadow properties section
	 * Shadow settings are hidden until "Enable Text Shadow" is checked
	 * @param {Object} ctx - Context with addSection, addCheckbox, addColorPicker, addInput, layer, editor
	 */
	PropertyBuilders.addTextShadowSection = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addSection( t( 'layers-section-text-shadow', 'Text Shadow' ), 'text-shadow' );

		ctx.addCheckbox( {
			label: t( 'layers-prop-text-shadow', 'Enable Text Shadow' ),
			value: layer.textShadow === true,
			onChange: function ( checked ) {
				const updates = { textShadow: checked };
				// Set default values when enabling
				if ( checked ) {
					if ( !layer.textShadowColor ) {
						updates.textShadowColor = 'rgba(0,0,0,0.5)';
					}
					if ( typeof layer.textShadowBlur === 'undefined' ) {
						updates.textShadowBlur = 4;
					}
					if ( typeof layer.textShadowOffsetX === 'undefined' ) {
						updates.textShadowOffsetX = 2;
					}
					if ( typeof layer.textShadowOffsetY === 'undefined' ) {
						updates.textShadowOffsetY = 2;
					}
				}
				editor.updateLayer( layer.id, updates );
				// Refresh properties panel to show/hide text shadow settings
				setTimeout( function () {
					if ( editor.layerPanel && typeof editor.layerPanel.updatePropertiesPanel === 'function' ) {
						editor.layerPanel.updatePropertiesPanel( layer.id );
					}
				}, 0 );
			}
		} );

		// Only show text shadow settings when enabled
		if ( layer.textShadow === true ) {
			ctx.addColorPicker( {
				label: t( 'layers-prop-text-shadow-color', 'Shadow Color' ),
				value: layer.textShadowColor || 'rgba(0,0,0,0.5)',
				property: 'textShadowColor',
				onChange: function ( newColor ) {
					editor.updateLayer( layer.id, { textShadowColor: newColor } );
				}
			} );

			ctx.addInput( {
				label: t( 'layers-prop-text-shadow-blur', 'Shadow Blur' ),
				type: 'number',
				value: layer.textShadowBlur || 4,
				min: 0,
				max: 50,
				step: 1,
				prop: 'textShadowBlur',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, {
						textShadowBlur: Math.max( 0, Math.min( 50, parseFloat( v ) ) )
					} );
				}
			} );

			ctx.addInput( {
				label: t( 'layers-prop-text-shadow-offset-x', 'Shadow Offset X' ),
				type: 'number',
				value: typeof layer.textShadowOffsetX === 'number' ? layer.textShadowOffsetX : 2,
				min: -100,
				max: 100,
				step: 1,
				prop: 'textShadowOffsetX',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, {
						textShadowOffsetX: Math.max( -100, Math.min( 100, parseFloat( v ) ) )
					} );
				}
			} );

			ctx.addInput( {
				label: t( 'layers-prop-text-shadow-offset-y', 'Shadow Offset Y' ),
				type: 'number',
				value: typeof layer.textShadowOffsetY === 'number' ? layer.textShadowOffsetY : 2,
				min: -100,
				max: 100,
				step: 1,
				prop: 'textShadowOffsetY',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, {
						textShadowOffsetY: Math.max( -100, Math.min( 100, parseFloat( v ) ) )
					} );
				}
			} );
		}
	};

	/**
	 * Add rich text formatting properties section
	 * Underline, strikethrough, and highlight controls for textbox/callout layers
	 * These controls apply to the entire richText array (all runs)
	 * @param {Object} ctx - Context with addSection, addCheckbox, addColorPicker, layer, editor
	 */
	PropertyBuilders.addRichTextFormatting = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addSection( t( 'layers-section-rich-text', 'Rich Text Formatting' ), 'rich-text' );

		/**
		 * Check if all runs have a specific style value
		 * @param {string} prop - Style property to check
		 * @param {*} value - Value to check for
		 * @return {boolean}
		 */
		function allRunsHaveStyle( prop, value ) {
			if ( !layer.richText || !Array.isArray( layer.richText ) || layer.richText.length === 0 ) {
				return false;
			}
			return layer.richText.every( ( run ) => {
				if ( !run.style ) {
					return false;
				}
				const current = run.style[ prop ] || '';
				// Support space-separated combined values (e.g. 'underline line-through')
				return current === value || current.includes( value );
			} );
		}

		/**
		 * Toggle a decoration keyword in the combined textDecoration value.
		 * Reads current state from first run; preserves other decoration keywords.
		 * @param {string} keyword - 'underline' or 'line-through'
		 * @param {boolean} add - true to add, false to remove
		 * @return {string} Updated textDecoration value
		 */
		function toggleDecoration( keyword, add ) {
			const first = ( layer.richText && layer.richText[ 0 ] &&
				layer.richText[ 0 ].style && layer.richText[ 0 ].style.textDecoration ) || 'none';
			const parts = first.split( /\s+/ ).filter( ( p ) => p && p !== 'none' );
			const idx = parts.indexOf( keyword );
			if ( add && idx === -1 ) {
				parts.push( keyword );
			} else if ( !add && idx !== -1 ) {
				parts.splice( idx, 1 );
			}
			return parts.length > 0 ? parts.join( ' ' ) : 'none';
		}

		/**
		 * Get the first run's style value, or null if not set/no runs
		 * @param {string} prop - Style property to get
		 * @return {*}
		 */
		function getFirstRunStyle( prop ) {
			if ( layer.richText && layer.richText.length > 0 && layer.richText[ 0 ].style ) {
				return layer.richText[ 0 ].style[ prop ];
			}
			return null;
		}

		/**
		 * Apply a style to all runs in richText
		 * If no richText exists, create one from the text property
		 * @param {Object} styleUpdates - Style properties to apply
		 */
		function applyStyleToAllRuns( styleUpdates ) {
			let richText = layer.richText;

			// If no richText, create from text property
			if ( !richText || !Array.isArray( richText ) || richText.length === 0 ) {
				const text = layer.text || '';
				if ( text.length === 0 ) {
					return; // No text to format
				}
				richText = [ { text: text, style: {} } ];
			}

			// Apply style to all runs
			const updatedRichText = richText.map( ( run ) => ( {
				text: run.text,
				style: { ...( run.style || {} ), ...styleUpdates }
			} ) );

			editor.updateLayer( layer.id, { richText: updatedRichText } );
		}

		// Underline toggle
		ctx.addCheckbox( {
			label: t( 'layers-prop-underline', 'Underline' ),
			value: allRunsHaveStyle( 'textDecoration', 'underline' ),
			onChange: function ( checked ) {
				applyStyleToAllRuns( {
					textDecoration: toggleDecoration( 'underline', checked )
				} );
			}
		} );

		// Strikethrough toggle
		ctx.addCheckbox( {
			label: t( 'layers-prop-strikethrough', 'Strikethrough' ),
			value: allRunsHaveStyle( 'textDecoration', 'line-through' ),
			onChange: function ( checked ) {
				applyStyleToAllRuns( {
					textDecoration: toggleDecoration( 'line-through', checked )
				} );
			}
		} );

		// Highlight color picker
		const currentHighlight = getFirstRunStyle( 'backgroundColor' ) || '';
		const hasHighlight = Boolean( currentHighlight );

		ctx.addCheckbox( {
			label: t( 'layers-prop-highlight', 'Highlight' ),
			value: hasHighlight,
			onChange: function ( checked ) {
				if ( checked ) {
					// Enable with default yellow highlight
					applyStyleToAllRuns( { backgroundColor: 'rgba(255, 255, 0, 0.5)' } );
				} else {
					// Remove highlight
					applyStyleToAllRuns( { backgroundColor: null } );
				}
				// Refresh panel to show/hide color picker
				setTimeout( function () {
					if ( editor.layerPanel && typeof editor.layerPanel.updatePropertiesPanel === 'function' ) {
						editor.layerPanel.updatePropertiesPanel( layer.id );
					}
				}, 0 );
			}
		} );

		// Show highlight color picker only when highlight is enabled
		if ( hasHighlight ) {
			ctx.addColorPicker( {
				label: t( 'layers-prop-highlight-color', 'Highlight Color' ),
				value: currentHighlight,
				property: 'highlightColor',
				onChange: function ( newColor ) {
					applyStyleToAllRuns( { backgroundColor: newColor } );
				}
			} );
		}
	};

	/**
	 * Add text alignment properties section
	 * @param {Object} ctx - Context with addSection, addSelect, addInput, layer, editor
	 */
	PropertyBuilders.addAlignmentSection = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addSection( t( 'layers-section-alignment', 'Alignment' ), 'alignment' );

		ctx.addSelect( {
			label: t( 'layers-prop-text-align', 'Horizontal Align' ),
			value: layer.textAlign || 'left',
			options: [
				{ value: 'left', text: t( 'layers-align-left', 'Left' ) },
				{ value: 'center', text: t( 'layers-align-center', 'Center' ) },
				{ value: 'right', text: t( 'layers-align-right', 'Right' ) }
			],
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { textAlign: v } );
			}
		} );

		ctx.addSelect( {
			label: t( 'layers-prop-vertical-align', 'Vertical Align' ),
			value: layer.verticalAlign || 'top',
			options: [
				{ value: 'top', text: t( 'layers-align-top', 'Top' ) },
				{ value: 'middle', text: t( 'layers-align-middle', 'Middle' ) },
				{ value: 'bottom', text: t( 'layers-align-bottom', 'Bottom' ) }
			],
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { verticalAlign: v } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-padding', 'Padding' ),
			type: 'number',
			value: layer.padding || 8,
			min: 0,
			max: 100,
			step: 1,
			prop: 'padding',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, {
					padding: Math.max( 0, Math.min( 100, parseInt( v, 10 ) ) )
				} );
			}
		} );
	};

	/**
	 * Add arrow/line endpoint properties (x1, y1, x2, y2)
	 * @param {Object} ctx - Context with addInput, layer, editor
	 */
	PropertyBuilders.addEndpoints = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addInput( {
			label: t( 'layers-prop-start-x', 'Start X' ),
			type: 'number',
			value: Math.round( layer.x1 || 0 ),
			step: 1,
			prop: 'x1',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { x1: Math.round( parseFloat( v ) ) } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-start-y', 'Start Y' ),
			type: 'number',
			value: Math.round( layer.y1 || 0 ),
			step: 1,
			prop: 'y1',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { y1: Math.round( parseFloat( v ) ) } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-end-x', 'End X' ),
			type: 'number',
			value: Math.round( layer.x2 || 0 ),
			step: 1,
			prop: 'x2',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { x2: Math.round( parseFloat( v ) ) } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-end-y', 'End Y' ),
			type: 'number',
			value: Math.round( layer.y2 || 0 ),
			step: 1,
			prop: 'y2',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { y2: Math.round( parseFloat( v ) ) } );
			}
		} );
	};

	/**
	 * Add arrow-specific properties (head size, style, etc.)
	 * @param {Object} ctx - Context with addInput, addSelect, addSliderInput, layer, editor
	 */
	PropertyBuilders.addArrowProperties = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addInput( {
			label: t( 'layers-prop-arrow-size', 'Head Size' ),
			type: 'number',
			value: layer.arrowSize || 15,
			min: 5,
			max: 100,
			step: 1,
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { arrowSize: parseFloat( v ) } );
			}
		} );

		ctx.addSliderInput( {
			label: t( 'layers-prop-head-scale', 'Head Scale' ),
			value: Math.round( ( layer.headScale || 1 ) * 100 ),
			min: 25,
			max: 300,
			step: 5,
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { headScale: v / 100 } );
			}
		} );

		// Only show tail width for single-headed arrows (not double or none)
		if ( layer.arrowStyle !== 'double' ) {
			ctx.addInput( {
				label: t( 'layers-prop-tail-width', 'Tail Width' ),
				type: 'number',
				value: layer.tailWidth || 0,
				min: 0,
				max: 100,
				step: 1,
				onChange: function ( v ) {
					editor.updateLayer( layer.id, { tailWidth: parseFloat( v ) } );
				}
			} );
		}

		ctx.addSelect( {
			label: t( 'layers-prop-arrow-ends', 'Arrow Ends' ),
			value: layer.arrowStyle || 'single',
			options: [
				{ value: 'single', text: t( 'layers-arrow-single', 'Single' ) },
				{ value: 'double', text: t( 'layers-arrow-double', 'Double' ) },
				{ value: 'none', text: t( 'layers-arrow-none', 'Line only' ) }
			],
			onChange: function ( v ) {
				// When switching to double, reset tailWidth to 0 since it's not used
				const updates = { arrowStyle: v };
				if ( v === 'double' ) {
					updates.tailWidth = 0;
				}
				editor.updateLayer( layer.id, updates );
				// Refresh properties panel to show/hide tail width control based on arrowStyle
				setTimeout( function () {
					if ( editor.layerPanel && typeof editor.layerPanel.updatePropertiesPanel === 'function' ) {
						editor.layerPanel.updatePropertiesPanel( layer.id );
					}
				}, 0 );
			}
		} );

		ctx.addSelect( {
			label: t( 'layers-prop-head-type', 'Head Type' ),
			value: layer.arrowHeadType || 'pointed',
			options: [
				{ value: 'pointed', text: t( 'layers-head-pointed', 'Pointed' ) },
				{ value: 'chevron', text: t( 'layers-head-chevron', 'Chevron' ) },
				{ value: 'standard', text: t( 'layers-head-standard', 'Standard' ) }
			],
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { arrowHeadType: v } );
			}
		} );
	};

	/**
	 * Add position properties (x, y, rotation)
	 * @param {Object} ctx - Context with addInput, layer, editor
	 */
	PropertyBuilders.addPosition = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addInput( {
			label: t( 'layers-prop-x', 'X' ),
			type: 'number',
			value: Math.round( layer.x || 0 ),
			step: 1,
			prop: 'x',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { x: Math.round( parseFloat( v ) ) } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-y', 'Y' ),
			type: 'number',
			value: Math.round( layer.y || 0 ),
			step: 1,
			prop: 'y',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { y: Math.round( parseFloat( v ) ) } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-rotation', 'Rotation' ),
			type: 'number',
			value: Math.round( layer.rotation || 0 ),
			step: 1,
			prop: 'rotation',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { rotation: Math.round( parseFloat( v ) ) } );
			}
		} );
	};

	/**
	 * Add circle radius property
	 * @param {Object} ctx - Context with addInput, layer, editor
	 */
	PropertyBuilders.addCircleRadius = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;
		const DEFAULTS = getConstants().DEFAULTS;

		ctx.addInput( {
			label: t( 'layers-prop-radius', 'Radius' ),
			type: 'number',
			value: Math.round( layer.radius || DEFAULTS.RADIUS || 50 ),
			step: 1,
			prop: 'radius',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { radius: Math.round( parseFloat( v ) ) } );
			}
		} );
	};

	/**
	 * Add ellipse properties (width/height controlling radiusX/radiusY)
	 * @param {Object} ctx - Context with addInput, layer, editor
	 */
	PropertyBuilders.addEllipseProperties = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addInput( {
			label: t( 'layers-prop-width', 'Width' ),
			type: 'number',
			value: Math.round( layer.width || ( ( layer.radiusX || 0 ) * 2 ) ),
			step: 1,
			prop: 'width',
			onChange: function ( v ) {
				const valX = Math.round( parseFloat( v ) );
				editor.updateLayer( layer.id, { width: valX, radiusX: valX / 2 } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-height', 'Height' ),
			type: 'number',
			value: Math.round( layer.height || ( ( layer.radiusY || 0 ) * 2 ) ),
			step: 1,
			prop: 'height',
			onChange: function ( v ) {
				const valY = Math.round( parseFloat( v ) );
				editor.updateLayer( layer.id, { height: valY, radiusY: valY / 2 } );
			}
		} );
	};

	/**
	 * Add polygon properties (sides, radius, corner radius)
	 * @param {Object} ctx - Context with addInput, layer, editor
	 */
	PropertyBuilders.addPolygonProperties = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;
		const constants = getConstants();
		const DEFAULTS = constants.DEFAULTS;
		const LIMITS = constants.LIMITS;

		ctx.addInput( {
			label: t( 'layers-prop-sides', 'Sides' ),
			type: 'number',
			value: layer.sides || DEFAULTS.POLYGON_SIDES || 6,
			min: LIMITS.MIN_POLYGON_SIDES || 3,
			max: LIMITS.MAX_POLYGON_SIDES || 20,
			step: 1,
			prop: 'sides',
			onChange: function ( v ) {
				const minSides = LIMITS.MIN_POLYGON_SIDES || 3;
				const sidesVal = Math.max( minSides, parseInt( v, 10 ) || 6 );
				editor.updateLayer( layer.id, { sides: sidesVal } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-radius', 'Radius' ),
			type: 'number',
			value: Math.round( layer.radius || DEFAULTS.RADIUS || 50 ),
			step: 1,
			prop: 'radius',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { radius: Math.round( parseFloat( v ) ) } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-corner-radius', 'Corner Radius' ),
			type: 'number',
			value: Math.round( layer.cornerRadius || 0 ),
			min: 0,
			max: 200,
			step: 1,
			prop: 'cornerRadius',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, {
					cornerRadius: Math.max( 0, Math.round( parseFloat( v ) ) || 0 )
				} );
			}
		} );
	};

	/**
	 * Add star properties (points, outer/inner radius, point/valley radius)
	 * @param {Object} ctx - Context with addInput, layer, editor
	 */
	PropertyBuilders.addStarProperties = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;
		const constants = getConstants();
		const DEFAULTS = constants.DEFAULTS;
		const LIMITS = constants.LIMITS;

		ctx.addInput( {
			label: t( 'layers-prop-points', 'Points' ),
			type: 'number',
			value: layer.points || DEFAULTS.STAR_POINTS || 5,
			min: LIMITS.MIN_STAR_POINTS || 3,
			max: LIMITS.MAX_STAR_POINTS || 20,
			step: 1,
			prop: 'points',
			onChange: function ( v ) {
				const minPoints = LIMITS.MIN_STAR_POINTS || 3;
				const ptsVal = Math.max( minPoints, parseInt( v, 10 ) || 5 );
				editor.updateLayer( layer.id, { points: ptsVal } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-outer-radius', 'Outer Radius' ),
			type: 'number',
			value: Math.round( layer.outerRadius || layer.radius || 50 ),
			step: 1,
			prop: 'outerRadius',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { outerRadius: Math.round( parseFloat( v ) ) } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-inner-radius', 'Inner Radius' ),
			type: 'number',
			value: Math.round( layer.innerRadius || ( ( layer.outerRadius || 50 ) * 0.5 ) ),
			step: 1,
			prop: 'innerRadius',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { innerRadius: Math.round( parseFloat( v ) ) } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-point-radius', 'Point Radius' ),
			type: 'number',
			value: Math.round( layer.pointRadius || 0 ),
			min: 0,
			max: 200,
			step: 1,
			prop: 'pointRadius',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, {
					pointRadius: Math.max( 0, Math.round( parseFloat( v ) ) || 0 )
				} );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-valley-radius', 'Valley Radius' ),
			type: 'number',
			value: Math.round( layer.valleyRadius || 0 ),
			min: 0,
			max: 200,
			step: 1,
			prop: 'valleyRadius',
			onChange: function ( v ) {
				editor.updateLayer( layer.id, {
					valleyRadius: Math.max( 0, Math.round( parseFloat( v ) ) || 0 )
				} );
			}
		} );
	};

	/**
	 * Add blur layer properties
	 * @param {Object} ctx - Context with addInput, layer, editor
	 */
	PropertyBuilders.addBlurProperties = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;
		const constants = getConstants();

		PropertyBuilders.addDimensions( ctx );

		ctx.addInput( {
			label: t( 'layers-prop-blur-radius', 'Blur Radius' ),
			type: 'number',
			value: layer.blurRadius || constants.BLUR_RADIUS,
			min: constants.BLUR_MIN,
			max: constants.BLUR_MAX,
			step: 1,
			onChange: function ( v ) {
				const br = Math.max( constants.BLUR_MIN, Math.min( constants.BLUR_MAX,
					parseInt( v, 10 ) || constants.BLUR_RADIUS ) );
				editor.updateLayer( layer.id, { blurRadius: br } );
			}
		} );
	};

	/**
	 * Add callout tail section
	 * @param {Object} ctx - Context with addSection, addSelect, layer, editor
	 */
	PropertyBuilders.addCalloutTailSection = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addSection( t( 'layers-section-callout', 'Callout Tail' ), 'callout' );

		ctx.addSelect( {
			label: t( 'layers-prop-tail-style', 'Tail Style' ),
			value: layer.tailStyle || 'triangle',
			options: [
				{ value: 'triangle', text: t( 'layers-tail-style-triangle', 'Triangle' ) },
				{ value: 'curved', text: t( 'layers-tail-style-curved', 'Curved' ) },
				{ value: 'line', text: t( 'layers-tail-style-line', 'Line' ) }
			],
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { tailStyle: v } );
			}
		} );
	};

	/**
	 * Add simple text layer properties (single-line text, font size, stroke)
	 * @param {Object} ctx - Context with addInput, addColorPicker, layer, editor
	 */
	PropertyBuilders.addSimpleTextProperties = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		ctx.addInput( {
			label: t( 'layers-prop-text', 'Text' ),
			type: 'text',
			value: layer.text || '',
			maxLength: 1000,
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { text: v } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-font-size', 'Font Size' ),
			type: 'number',
			value: layer.fontSize || 16,
			min: 6,
			max: 1000,
			step: 1,
			prop: 'fontSize',
			onChange: function ( v ) {
				const fs = Math.max( 6, Math.min( 1000, parseInt( v, 10 ) ) );
				editor.updateLayer( layer.id, { fontSize: fs } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-stroke-width', 'Text Stroke Width' ),
			type: 'number',
			value: layer.textStrokeWidth || 0,
			min: 0,
			max: 200,
			step: 1,
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { textStrokeWidth: parseInt( v, 10 ) } );
			}
		} );

		ctx.addColorPicker( {
			label: t( 'layers-prop-stroke-color', 'Text Stroke Color' ),
			value: layer.textStrokeColor || '#000000',
			property: 'textStrokeColor',
			onChange: function ( newColor ) {
				editor.updateLayer( layer.id, { textStrokeColor: newColor } );
			}
		} );
	};

	/**
	 * Add marker-specific properties (value, style, size, arrow toggle)
	 * @param {Object} ctx - Context with addInput, addSelect, addCheckbox, layer, editor
	 */
	PropertyBuilders.addMarkerProperties = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		/**
		 * Helper to update layer and persist marker defaults
		 * @param {Object} props - Properties to update
		 */
		function updateWithDefaults( props ) {
			editor.updateLayer( layer.id, props );
			// Persist marker-specific settings for future drawings
			if ( editor.canvasManager && editor.canvasManager.updateMarkerDefaults ) {
				editor.canvasManager.updateMarkerDefaults( props );
			}
		}

		ctx.addSection( t( 'layers-section-marker', 'Marker Properties' ), 'marker' );

		// Value - supports custom text like "1A", "1.1", etc.
		ctx.addInput( {
			label: t( 'layers-prop-marker-value', 'Value' ),
			type: 'text',
			value: String( layer.value || 1 ),
			prop: 'value',
			placeholder: t( 'layers-prop-marker-value-placeholder', 'e.g., 1, A, 1A, 1.1' ),
			onChange: function ( v ) {
				const val = v.trim() || '1';
				// Update name only if it's the default pattern
				const updates = { value: val };
				if ( !layer.name || layer.name.startsWith( 'Marker ' ) || layer.name.match( /^Marker\s/ ) ) {
					updates.name = t( 'layers-marker-name', val );
				}
				editor.updateLayer( layer.id, updates );
			}
		} );

		ctx.addSelect( {
			label: t( 'layers-prop-marker-style', 'Marker Style' ),
			value: layer.style || 'circled',
			options: [
				{ value: 'circled', text: t( 'layers-marker-style-circled', 'Circled (①②③)' ) },
				{ value: 'parentheses', text: t( 'layers-marker-style-parentheses', 'Parentheses ((1)(2)(3))' ) },
				{ value: 'plain', text: t( 'layers-marker-style-plain', 'Plain (1. 2. 3.)' ) },
				{ value: 'letter', text: t( 'layers-marker-style-letter', 'Letter (A B C)' ) },
				{ value: 'letter-circled', text: t( 'layers-marker-style-letter-circled', 'Circled Letter (Ⓐ Ⓑ Ⓒ)' ) }
			],
			onChange: function ( v ) {
				updateWithDefaults( { style: v } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-marker-size', 'Marker Size' ),
			type: 'number',
			value: layer.size || 24,
			min: 10,
			max: 200,
			step: 1,
			prop: 'size',
			onChange: function ( v ) {
				const size = Math.max( 10, Math.min( 200, parseInt( v, 10 ) || 24 ) );
				updateWithDefaults( { size: size } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-font-size-adjust', 'Font Size Adjust' ),
			type: 'number',
			value: layer.fontSizeAdjust || 0,
			min: -10,
			max: 20,
			step: 1,
			prop: 'fontSizeAdjust',
			onChange: function ( v ) {
				const adjust = Math.max( -10, Math.min( 20, parseInt( v, 10 ) || 0 ) );
				updateWithDefaults( { fontSizeAdjust: adjust } );
			}
		} );

		ctx.addColorPicker( {
			label: t( 'layers-prop-text-color', 'Text Color' ),
			value: layer.color || '#000000',
			prop: 'color',
			onChange: function ( v ) {
				updateWithDefaults( { color: v } );
			}
		} );

		ctx.addColorPicker( {
			label: t( 'layers-prop-fill-color', 'Fill Color' ),
			value: layer.fill || '#ffffff',
			prop: 'fill',
			onChange: function ( v ) {
				updateWithDefaults( { fill: v } );
			}
		} );

		ctx.addColorPicker( {
			label: t( 'layers-prop-stroke-color', 'Stroke Color' ),
			value: layer.stroke || '#000000',
			prop: 'stroke',
			onChange: function ( v ) {
				updateWithDefaults( { stroke: v } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-stroke-width', 'Stroke Width' ),
			type: 'number',
			value: layer.strokeWidth || 2,
			min: 0,
			max: 10,
			step: 0.5,
			prop: 'strokeWidth',
			onChange: function ( v ) {
				const val = Math.max( 0, Math.min( 10, parseFloat( v ) || 2 ) );
				const rounded = Math.round( val * 2 ) / 2;
				updateWithDefaults( { strokeWidth: rounded } );
			}
		} );

		ctx.addCheckbox( {
			label: t( 'layers-prop-marker-arrow', 'Show Arrow' ),
			checked: layer.hasArrow || false,
			prop: 'hasArrow',
			onChange: function ( v ) {
				const updates = { hasArrow: v };
				// If enabling arrow and no position set, set default offset
				if ( v && ( layer.arrowX === undefined || layer.arrowY === undefined ) ) {
					updates.arrowX = layer.x;
					updates.arrowY = ( layer.y || 0 ) + 50;
				}
				updateWithDefaults( updates );
			}
		} );
	};

	/**
	 * Add dimension-specific properties
	 * Simplified to essential controls that actually work
	 * @param {Object} ctx - Context with addInput, addSelect, addCheckbox, layer, editor
	 */
	PropertyBuilders.addDimensionProperties = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		/**
		 * Helper to update layer and persist dimension defaults
		 * @param {Object} props - Properties to update
		 */
		function updateWithDefaults( props ) {
			editor.updateLayer( layer.id, props );
			// Persist dimension-specific settings for future drawings
			if ( editor.canvasManager && editor.canvasManager.updateDimensionDefaults ) {
				editor.canvasManager.updateDimensionDefaults( props );
			}
		}

		ctx.addSection( t( 'layers-section-dimension', 'Dimension Properties' ), 'dimension' );

		// Dimension value - the main input (not persisted as it's per-dimension)
		ctx.addInput( {
			label: t( 'layers-prop-dimension-value', 'Dimension Value' ),
			type: 'text',
			value: layer.text || '',
			prop: 'text',
			placeholder: t( 'layers-prop-dimension-value-placeholder', 'e.g., 25.4 mm'),
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { text: v || undefined } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-font-size', 'Font Size' ),
			type: 'number',
			value: layer.fontSize || 12,
			min: 6,
			max: 200,
			step: 1,
			prop: 'fontSize',
			onChange: function ( v ) {
				const val = Math.max( 6, Math.min( 200, parseInt( v, 10 ) || 12 ) );
				updateWithDefaults( { fontSize: val } );
			}
		} );

		ctx.addColorPicker( {
			label: t( 'layers-prop-text-color', 'Text Color' ),
			value: layer.color || '#000000',
			prop: 'color',
			onChange: function ( v ) {
				updateWithDefaults( { color: v } );
			}
		} );

		ctx.addColorPicker( {
			label: t( 'layers-prop-stroke-color', 'Line Color' ),
			value: layer.stroke || '#000000',
			prop: 'stroke',
			onChange: function ( v ) {
				updateWithDefaults( { stroke: v } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-line-width', 'Line Width' ),
			type: 'number',
			value: layer.strokeWidth || 1,
			min: 0.5,
			max: 10,
			step: 0.5,
			prop: 'strokeWidth',
			onChange: function ( v ) {
				const val = Math.max( 0.5, Math.min( 10, parseFloat( v ) || 1 ) );
				// Round to nearest 0.5
				const rounded = Math.round( val * 2 ) / 2;
				updateWithDefaults( { strokeWidth: rounded } );
			}
		} );

		ctx.addSelect( {
			label: t( 'layers-prop-orientation', 'Orientation' ),
			value: layer.orientation || 'free',
			options: [
				{ value: 'free', text: t( 'layers-dimension-orientation-free', 'Free' ) },
				{ value: 'horizontal', text: t( 'layers-dimension-orientation-horizontal', 'Horizontal' ) },
				{ value: 'vertical', text: t( 'layers-dimension-orientation-vertical', 'Vertical' ) }
			],
			onChange: function ( v ) {
				// Use current layer state, not the stale closure reference.
				// The closure's `layer` is from when the form was built; the user
				// may have moved the dimension since then, making x1/y1 stale.
				const current = ( typeof editor.getLayerById === 'function' &&
					editor.getLayerById( layer.id ) ) || layer;
				const curX1 = current.x1 || 0;
				const curY1 = current.y1 || 0;
				const curX2 = current.x2 || 0;
				const curY2 = current.y2 || 0;

				const updates = { orientation: v };
				if ( v === 'horizontal' ) {
					// Align y2 to y1 (make horizontal)
					updates.y2 = curY1;
					// If horizontal span would be too small, use the old vertical span
					if ( Math.abs( curX2 - curX1 ) < 20 ) {
						updates.x2 = curX1 + Math.max( Math.abs( curY2 - curY1 ), 100 );
					}
				} else if ( v === 'vertical' ) {
					// Align x2 to x1 (make vertical)
					updates.x2 = curX1;
					// If vertical span would be too small, use the old horizontal span
					if ( Math.abs( curY2 - curY1 ) < 20 ) {
						updates.y2 = curY1 + Math.max( Math.abs( curX2 - curX1 ), 100 );
					}
				}
				editor.updateLayer( layer.id, updates );
			}
		} );

		ctx.addSelect( {
			label: t( 'layers-prop-end-style', 'End Style' ),
			value: layer.endStyle || 'arrow',
			options: [
				{ value: 'arrow', text: t( 'layers-dimension-end-arrow', 'Arrow' ) },
				{ value: 'tick', text: t( 'layers-dimension-end-tick', 'Tick' ) },
				{ value: 'dot', text: t( 'layers-dimension-end-dot', 'Dot' ) },
				{ value: 'none', text: t( 'layers-dimension-end-none', 'None' ) }
			],
			onChange: function ( v ) {
				updateWithDefaults( { endStyle: v } );
			}
		} );

		// Arrow/marker size control (only show for arrow, tick, or dot)
		const endStyle = layer.endStyle || 'arrow';
		if ( endStyle === 'arrow' || endStyle === 'tick' || endStyle === 'dot' ) {
			ctx.addInput( {
				label: t( 'layers-prop-marker-size', 'Marker Size' ),
				type: 'number',
				value: endStyle === 'tick' ? ( layer.tickSize || 6 ) : ( layer.arrowSize || 8 ),
				min: 2,
				max: 40,
				step: 1,
				prop: endStyle === 'tick' ? 'tickSize' : 'arrowSize',
				onChange: function ( v ) {
					const val = Math.max( 2, Math.min( 40, parseInt( v, 10 ) || 8 ) );
					const prop = endStyle === 'tick' ? 'tickSize' : 'arrowSize';
					updateWithDefaults( { [ prop ]: val } );
				}
			} );
		}

		// Arrows inside/outside option (only show for arrow end style)
		if ( endStyle === 'arrow' ) {
			// Handle both boolean and integer (from PHP serialization)
			const arrowsInside = layer.arrowsInside !== false && layer.arrowsInside !== 0;
			ctx.addSelect( {
				label: t( 'layers-prop-arrow-position', 'Arrow Position' ),
				value: arrowsInside ? 'inside' : 'outside',
				options: [
					{ value: 'inside', text: t( 'layers-arrow-position-inside', 'Inside' ) },
					{ value: 'outside', text: t( 'layers-arrow-position-outside', 'Outside' ) }
				],
				onChange: function ( v ) {
					updateWithDefaults( { arrowsInside: v === 'inside' } );
				}
			} );
		}

		ctx.addSelect( {
			label: t( 'layers-prop-text-position', 'Text Position' ),
			value: layer.textPosition || 'above',
			options: [
				{ value: 'above', text: t( 'layers-dimension-text-above', 'Above' ) },
				{ value: 'below', text: t( 'layers-dimension-text-below', 'Below' ) },
				{ value: 'center', text: t( 'layers-dimension-text-center', 'Center' ) }
			],
			onChange: function ( v ) {
				updateWithDefaults( { textPosition: v } );
			}
		} );

		// Text direction option - available for all dimensions
		ctx.addSelect( {
			label: t( 'layers-prop-text-direction', 'Text Direction' ),
			value: layer.textDirection || 'auto',
			options: [
				{ value: 'auto', text: t( 'layers-dimension-text-direction-auto', 'Auto' ) },
				{ value: 'auto-reversed', text: t( 'layers-dimension-text-direction-auto-reversed', 'Auto Reversed' ) },
				{ value: 'horizontal', text: t( 'layers-dimension-text-direction-horizontal', 'Horizontal' ) }
			],
			onChange: function ( v ) {
				updateWithDefaults( { textDirection: v } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-extension-length', 'Extension Length' ),
			type: 'number',
			value: layer.extensionLength || 10,
			min: 0,
			max: 100,
			step: 1,
			prop: 'extensionLength',
			onChange: function ( v ) {
				const val = Math.max( 0, Math.min( 100, parseInt( v, 10 ) || 10 ) );
				updateWithDefaults( { extensionLength: val } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-dimension-offset', 'Dimension Offset' ),
			type: 'number',
			value: layer.dimensionOffset !== undefined ? layer.dimensionOffset : 15,
			min: -500,
			max: 500,
			step: 1,
			prop: 'dimensionOffset',
			onChange: function ( v ) {
				const val = Math.max( -500, Math.min( 500, parseInt( v, 10 ) || 15 ) );
				updateWithDefaults( { dimensionOffset: val } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-text-offset', 'Text Offset' ),
			type: 'number',
			value: layer.textOffset !== undefined ? layer.textOffset : 0,
			min: -2000,
			max: 2000,
			step: 1,
			prop: 'textOffset',
			onChange: function ( v ) {
				const val = Math.max( -2000, Math.min( 2000, parseInt( v, 10 ) || 0 ) );
				updateWithDefaults( { textOffset: val } );
			}
		} );

		// Background section
		ctx.addSection( t( 'layers-section-background', 'Text Background' ), 'background' );

		// showBackground defaults to true, so check explicitly for false
		const showBg = layer.showBackground !== false;
		ctx.addCheckbox( {
			label: t( 'layers-prop-show-background', 'Show Background' ),
			checked: showBg,
			prop: 'showBackground',
			onChange: function ( v ) {
				updateWithDefaults( { showBackground: v } );
				// Refresh panel to show/hide background color
				setTimeout( function () {
					if ( editor.layerPanel && typeof editor.layerPanel.updatePropertiesPanel === 'function' ) {
						editor.layerPanel.updatePropertiesPanel( layer.id );
					}
				}, 0 );
			}
		} );

		if ( showBg ) {
			ctx.addColorPicker( {
				label: t( 'layers-prop-background-color', 'Background Color' ),
				value: layer.backgroundColor || '#ffffff',
				prop: 'backgroundColor',
				onChange: function ( v ) {
					updateWithDefaults( { backgroundColor: v } );
				}
			} );
		}

		// Tolerance section
		ctx.addSection( t( 'layers-section-tolerance', 'Tolerance' ), 'tolerance' );

		ctx.addSelect( {
			label: t( 'layers-prop-tolerance-type', 'Tolerance Type' ),
			value: layer.toleranceType || 'none',
			options: [
				{ value: 'none', text: t( 'layers-tolerance-none', 'None' ) },
				{ value: 'symmetric', text: t( 'layers-tolerance-symmetric', 'Symmetric (±)' ) },
				{ value: 'deviation', text: t( 'layers-tolerance-deviation', 'Deviation (+/-)' ) },
				{ value: 'limits', text: t( 'layers-tolerance-limits', 'Limits (min-max)' ) },
				{ value: 'basic', text: t( 'layers-tolerance-basic', 'Basic (reference)' ) }
			],
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { toleranceType: v } );
				// Refresh panel to show/hide tolerance value inputs
				setTimeout( function () {
					if ( editor.layerPanel && typeof editor.layerPanel.updatePropertiesPanel === 'function' ) {
						editor.layerPanel.updatePropertiesPanel( layer.id );
					}
				}, 0 );
			}
		} );

		// Symmetric tolerance value (shown for symmetric type)
		if ( layer.toleranceType === 'symmetric' ) {
			ctx.addInput( {
				label: t( 'layers-prop-tolerance-value', 'Tolerance (±)' ),
				type: 'text',
				value: layer.toleranceValue || '',
				prop: 'toleranceValue',
				placeholder: 'e.g., 0.1',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, { toleranceValue: v } );
				}
			} );
		}

		// Deviation/limits tolerance values (shown for deviation and limits types)
		if ( layer.toleranceType === 'deviation' || layer.toleranceType === 'limits' ) {
			ctx.addInput( {
				label: t( 'layers-prop-tolerance-upper', 'Upper Tolerance' ),
				type: 'text',
				value: layer.toleranceUpper || '',
				prop: 'toleranceUpper',
				placeholder: 'e.g., +0.2',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, { toleranceUpper: v } );
				}
			} );

			ctx.addInput( {
				label: t( 'layers-prop-tolerance-lower', 'Lower Tolerance' ),
				type: 'text',
				value: layer.toleranceLower || '',
				prop: 'toleranceLower',
				placeholder: 'e.g., -0.1',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, { toleranceLower: v } );
				}
			} );
		}
	};

	/**
	 * Add angle dimension-specific properties
	 * Shares many controls with dimension but has angle-specific options
	 * @param {Object} ctx - Context with addInput, addSelect, addCheckbox, layer, editor
	 */
	PropertyBuilders.addAngleDimensionProperties = function ( ctx ) {
		const layer = ctx.layer;
		const editor = ctx.editor;
		const t = msg;

		/**
		 * Helper to update layer and persist angle dimension defaults
		 * @param {Object} props - Properties to update
		 */
		function updateWithDefaults( props ) {
			editor.updateLayer( layer.id, props );
			if ( editor.canvasManager && editor.canvasManager.updateAngleDimensionDefaults ) {
				editor.canvasManager.updateAngleDimensionDefaults( props );
			}
		}

		ctx.addSection( t( 'layers-section-angle-dimension', 'Angle Dimension Properties' ), 'angleDimension' );

		// Dimension value override (empty = auto-calculate angle)
		ctx.addInput( {
			label: t( 'layers-prop-dimension-value', 'Dimension Value' ),
			type: 'text',
			value: layer.text || '',
			prop: 'text',
			placeholder: t( 'layers-prop-angle-value-placeholder', 'e.g., 45°' ),
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { text: v || undefined } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-font-size', 'Font Size' ),
			type: 'number',
			value: layer.fontSize || 12,
			min: 6,
			max: 200,
			step: 1,
			prop: 'fontSize',
			onChange: function ( v ) {
				const val = Math.max( 6, Math.min( 200, parseInt( v, 10 ) || 12 ) );
				updateWithDefaults( { fontSize: val } );
			}
		} );

		ctx.addColorPicker( {
			label: t( 'layers-prop-text-color', 'Text Color' ),
			value: layer.color || '#000000',
			prop: 'color',
			onChange: function ( v ) {
				updateWithDefaults( { color: v } );
			}
		} );

		ctx.addColorPicker( {
			label: t( 'layers-prop-stroke-color', 'Line Color' ),
			value: layer.stroke || '#000000',
			prop: 'stroke',
			onChange: function ( v ) {
				updateWithDefaults( { stroke: v } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-line-width', 'Line Width' ),
			type: 'number',
			value: layer.strokeWidth || 1,
			min: 0.5,
			max: 10,
			step: 0.5,
			prop: 'strokeWidth',
			onChange: function ( v ) {
				const val = Math.max( 0.5, Math.min( 10, parseFloat( v ) || 1 ) );
				const rounded = Math.round( val * 2 ) / 2;
				updateWithDefaults( { strokeWidth: rounded } );
			}
		} );

		// Arc radius control
		ctx.addInput( {
			label: t( 'layers-prop-arc-radius', 'Arc Radius' ),
			type: 'number',
			value: layer.arcRadius || 40,
			min: 10,
			max: 500,
			step: 5,
			prop: 'arcRadius',
			onChange: function ( v ) {
				const val = Math.max( 10, Math.min( 500, parseInt( v, 10 ) || 40 ) );
				updateWithDefaults( { arcRadius: val } );
			}
		} );

		// Reflex angle toggle
		const reflexAngle = layer.reflexAngle === true || layer.reflexAngle === 1;
		ctx.addCheckbox( {
			label: t( 'layers-prop-reflex-angle', 'Reflex Angle (>180°)' ),
			checked: reflexAngle,
			prop: 'reflexAngle',
			onChange: function ( v ) {
				updateWithDefaults( { reflexAngle: v } );
			}
		} );

		// Precision (decimal places)
		ctx.addInput( {
			label: t( 'layers-prop-precision', 'Decimal Places' ),
			type: 'number',
			value: layer.precision !== undefined ? layer.precision : 1,
			min: 0,
			max: 6,
			step: 1,
			prop: 'precision',
			onChange: function ( v ) {
				const val = Math.max( 0, Math.min( 6, parseInt( v, 10 ) || 0 ) );
				updateWithDefaults( { precision: val } );
			}
		} );

		ctx.addSelect( {
			label: t( 'layers-prop-end-style', 'End Style' ),
			value: layer.endStyle || 'arrow',
			options: [
				{ value: 'arrow', text: t( 'layers-dimension-end-arrow', 'Arrow' ) },
				{ value: 'tick', text: t( 'layers-dimension-end-tick', 'Tick' ) },
				{ value: 'dot', text: t( 'layers-dimension-end-dot', 'Dot' ) },
				{ value: 'none', text: t( 'layers-dimension-end-none', 'None' ) }
			],
			onChange: function ( v ) {
				updateWithDefaults( { endStyle: v } );
			}
		} );

		// Arrow/marker size control
		const endStyle = layer.endStyle || 'arrow';
		if ( endStyle === 'arrow' || endStyle === 'tick' || endStyle === 'dot' ) {
			ctx.addInput( {
				label: t( 'layers-prop-marker-size', 'Marker Size' ),
				type: 'number',
				value: endStyle === 'tick' ? ( layer.tickSize || 6 ) : ( layer.arrowSize || 8 ),
				min: 2,
				max: 40,
				step: 1,
				prop: endStyle === 'tick' ? 'tickSize' : 'arrowSize',
				onChange: function ( v ) {
					const val = Math.max( 2, Math.min( 40, parseInt( v, 10 ) || 8 ) );
					const prop = endStyle === 'tick' ? 'tickSize' : 'arrowSize';
					updateWithDefaults( { [ prop ]: val } );
				}
			} );
		}

		// Arrows inside/outside option
		if ( endStyle === 'arrow' ) {
			const arrowsInside = layer.arrowsInside !== false && layer.arrowsInside !== 0;
			ctx.addSelect( {
				label: t( 'layers-prop-arrow-position', 'Arrow Position' ),
				value: arrowsInside ? 'inside' : 'outside',
				options: [
					{ value: 'inside', text: t( 'layers-arrow-position-inside', 'Inside' ) },
					{ value: 'outside', text: t( 'layers-arrow-position-outside', 'Outside' ) }
				],
				onChange: function ( v ) {
					updateWithDefaults( { arrowsInside: v === 'inside' } );
				}
			} );
		}

		ctx.addSelect( {
			label: t( 'layers-prop-text-position', 'Text Position' ),
			value: layer.textPosition || 'above',
			options: [
				{ value: 'above', text: t( 'layers-dimension-text-above', 'Above' ) },
				{ value: 'below', text: t( 'layers-dimension-text-below', 'Below' ) },
				{ value: 'center', text: t( 'layers-dimension-text-center', 'Center' ) }
			],
			onChange: function ( v ) {
				updateWithDefaults( { textPosition: v } );
			}
		} );

		ctx.addSelect( {
			label: t( 'layers-prop-text-direction', 'Text Direction' ),
			value: layer.textDirection || 'auto',
			options: [
				{ value: 'auto', text: t( 'layers-dimension-text-direction-auto', 'Auto' ) },
				{ value: 'auto-reversed', text: t( 'layers-dimension-text-direction-auto-reversed', 'Auto Reversed' ) },
				{ value: 'horizontal', text: t( 'layers-dimension-text-direction-horizontal', 'Horizontal' ) }
			],
			onChange: function ( v ) {
				updateWithDefaults( { textDirection: v } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-extension-length', 'Extension Length' ),
			type: 'number',
			value: layer.extensionLength || 10,
			min: 0,
			max: 100,
			step: 1,
			prop: 'extensionLength',
			onChange: function ( v ) {
				const val = Math.max( 0, Math.min( 100, parseInt( v, 10 ) || 10 ) );
				updateWithDefaults( { extensionLength: val } );
			}
		} );

		ctx.addInput( {
			label: t( 'layers-prop-text-offset', 'Text Offset' ),
			type: 'number',
			value: layer.textOffset !== undefined ? layer.textOffset : 0,
			min: -2000,
			max: 2000,
			step: 1,
			prop: 'textOffset',
			onChange: function ( v ) {
				const val = Math.max( -2000, Math.min( 2000, parseInt( v, 10 ) || 0 ) );
				updateWithDefaults( { textOffset: val } );
			}
		} );

		// Radial text offset (toward/away from vertex)
		ctx.addInput( {
			label: t( 'layers-prop-text-radial-offset', 'Radial Text Offset' ),
			type: 'number',
			value: layer.textRadialOffset !== undefined ? layer.textRadialOffset : 0,
			min: -500,
			max: 500,
			step: 1,
			prop: 'textRadialOffset',
			onChange: function ( v ) {
				const val = Math.max( -500, Math.min( 500, parseInt( v, 10 ) || 0 ) );
				updateWithDefaults( { textRadialOffset: val } );
			}
		} );

		// Background section
		ctx.addSection( t( 'layers-section-background', 'Text Background' ), 'background' );

		const showBg = layer.showBackground !== false;
		ctx.addCheckbox( {
			label: t( 'layers-prop-show-background', 'Show Background' ),
			checked: showBg,
			prop: 'showBackground',
			onChange: function ( v ) {
				updateWithDefaults( { showBackground: v } );
				setTimeout( function () {
					if ( editor.layerPanel && typeof editor.layerPanel.updatePropertiesPanel === 'function' ) {
						editor.layerPanel.updatePropertiesPanel( layer.id );
					}
				}, 0 );
			}
		} );

		if ( showBg ) {
			ctx.addColorPicker( {
				label: t( 'layers-prop-background-color', 'Background Color' ),
				value: layer.backgroundColor || '#ffffff',
				prop: 'backgroundColor',
				onChange: function ( v ) {
					updateWithDefaults( { backgroundColor: v } );
				}
			} );
		}

		// Tolerance section
		ctx.addSection( t( 'layers-section-tolerance', 'Tolerance' ), 'tolerance' );

		ctx.addSelect( {
			label: t( 'layers-prop-tolerance-type', 'Tolerance Type' ),
			value: layer.toleranceType || 'none',
			options: [
				{ value: 'none', text: t( 'layers-tolerance-none', 'None' ) },
				{ value: 'symmetric', text: t( 'layers-tolerance-symmetric', 'Symmetric (±)' ) },
				{ value: 'deviation', text: t( 'layers-tolerance-deviation', 'Deviation (+/-)' ) },
				{ value: 'limits', text: t( 'layers-tolerance-limits', 'Limits (min-max)' ) },
				{ value: 'basic', text: t( 'layers-tolerance-basic', 'Basic (reference)' ) }
			],
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { toleranceType: v } );
				setTimeout( function () {
					if ( editor.layerPanel && typeof editor.layerPanel.updatePropertiesPanel === 'function' ) {
						editor.layerPanel.updatePropertiesPanel( layer.id );
					}
				}, 0 );
			}
		} );

		if ( layer.toleranceType === 'symmetric' ) {
			ctx.addInput( {
				label: t( 'layers-prop-tolerance-value', 'Tolerance (±)' ),
				type: 'text',
				value: layer.toleranceValue || '',
				prop: 'toleranceValue',
				placeholder: 'e.g., 0.5',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, { toleranceValue: v } );
				}
			} );
		}

		if ( layer.toleranceType === 'deviation' || layer.toleranceType === 'limits' ) {
			ctx.addInput( {
				label: t( 'layers-prop-tolerance-upper', 'Upper Tolerance' ),
				type: 'text',
				value: layer.toleranceUpper || '',
				prop: 'toleranceUpper',
				placeholder: 'e.g., +0.5',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, { toleranceUpper: v } );
				}
			} );

			ctx.addInput( {
				label: t( 'layers-prop-tolerance-lower', 'Lower Tolerance' ),
				type: 'text',
				value: layer.toleranceLower || '',
				prop: 'toleranceLower',
				placeholder: 'e.g., -0.3',
				onChange: function ( v ) {
					editor.updateLayer( layer.id, { toleranceLower: v } );
				}
			} );
		}
	};

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.PropertyBuilders = PropertyBuilders;
	}

	// Node.js/Jest compatibility
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PropertyBuilders;
	}
}() );
