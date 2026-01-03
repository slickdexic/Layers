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
			LIMITS: LayersConstants.LIMITS || {}
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
		const maxLength = opts.maxLength || ( useTextarea ? 5000 : 1000 );
		const maxFontSize = opts.maxFontSize || 200;

		// Text content
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

		// Font family dropdown
		const defaultFonts = ( typeof mw !== 'undefined' && mw.config ) ?
			mw.config.get( 'LayersDefaultFonts' ) || [ 'Arial', 'Roboto', 'Noto Sans', 'Times New Roman', 'Courier New' ] :
			[ 'Arial', 'Roboto', 'Noto Sans', 'Times New Roman', 'Courier New' ];
		const fontOptions = defaultFonts.map( function ( font ) {
			return { value: font, text: font };
		} );
		ctx.addSelect( {
			label: t( 'layers-prop-font-family', 'Font' ),
			value: layer.fontFamily || 'Arial, sans-serif',
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
				editor.updateLayer( layer.id, { textShadow: checked } );
			}
		} );

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
			value: layer.textShadowOffsetX || 2,
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
			value: layer.textShadowOffsetY || 2,
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

		ctx.addSelect( {
			label: t( 'layers-prop-arrow-ends', 'Arrow Ends' ),
			value: layer.arrowStyle || 'single',
			options: [
				{ value: 'single', text: t( 'layers-arrow-single', 'Single' ) },
				{ value: 'double', text: t( 'layers-arrow-double', 'Double' ) },
				{ value: 'none', text: t( 'layers-arrow-none', 'Line only' ) }
			],
			onChange: function ( v ) {
				editor.updateLayer( layer.id, { arrowStyle: v } );
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

		PropertyBuilders.addDimensions( ctx );

		ctx.addInput( {
			label: t( 'layers-prop-blur-radius', 'Blur Radius' ),
			type: 'number',
			value: layer.blurRadius || 12,
			min: 1,
			max: 64,
			step: 1,
			onChange: function ( v ) {
				const br = Math.max( 1, Math.min( 64, parseInt( v, 10 ) || 12 ) );
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
