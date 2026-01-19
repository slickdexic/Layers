/**
 * Tests for PropertyBuilders module
 *
 * PropertyBuilders provides reusable property group builders
 * for the Layers editor properties panel.
 */

'use strict';

// Mock context factory
function createMockContext( layerOverrides ) {
	const layer = {
		id: 'test-layer-1',
		type: 'rectangle',
		x: 100,
		y: 100,
		width: 200,
		height: 100,
		...layerOverrides
	};

	const mockEditor = {
		updateLayer: jest.fn()
	};

	return {
		layer,
		editor: mockEditor,
		addInput: jest.fn(),
		addColorPicker: jest.fn(),
		addSection: jest.fn(),
		addCheckbox: jest.fn(),
		addSelect: jest.fn()
	};
}

// Set up globals before loading module
beforeAll( () => {
	window.Layers = window.Layers || {};
	window.Layers.Constants = {
		LAYER_TYPES: {},
		DEFAULTS: {},
		LIMITS: {}
	};
	window.layersMessages = {
		get: ( key, fallback ) => fallback
	};

	// Load the module
	require( '../../resources/ext.layers.editor/ui/PropertyBuilders.js' );
} );

beforeEach( () => {
	jest.clearAllMocks();
} );

describe( 'PropertyBuilders', () => {
	describe( 'module loading', () => {
		test( 'should be available on window.Layers.UI namespace', () => {
			expect( window.Layers.UI.PropertyBuilders ).toBeDefined();
		} );

		test( 'should have all expected builder methods', () => {
			const Builders = window.Layers.UI.PropertyBuilders;
			expect( typeof Builders.addDimensions ).toBe( 'function' );
			expect( typeof Builders.addTextProperties ).toBe( 'function' );
			expect( typeof Builders.addTextShadowSection ).toBe( 'function' );
			expect( typeof Builders.addAlignmentSection ).toBe( 'function' );
			expect( typeof Builders.addEndpoints ).toBe( 'function' );
			expect( typeof Builders.addArrowProperties ).toBe( 'function' );
			expect( typeof Builders.addPosition ).toBe( 'function' );
			expect( typeof Builders.addCircleRadius ).toBe( 'function' );
			expect( typeof Builders.addEllipseProperties ).toBe( 'function' );
			expect( typeof Builders.addPolygonProperties ).toBe( 'function' );
			expect( typeof Builders.addStarProperties ).toBe( 'function' );
			expect( typeof Builders.addBlurProperties ).toBe( 'function' );
			expect( typeof Builders.addCalloutTailSection ).toBe( 'function' );
			expect( typeof Builders.addSimpleTextProperties ).toBe( 'function' );
		} );
	} );

	describe( 'addDimensions', () => {
		test( 'should add width and height inputs', () => {
			const ctx = createMockContext( { width: 200, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensions( ctx );

			expect( ctx.addInput ).toHaveBeenCalledTimes( 2 );
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( {
					label: 'Width',
					type: 'number',
					value: 200
				} )
			);
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( {
					label: 'Height',
					type: 'number',
					value: 100
				} )
			);
		} );

		test( 'should add corner radius when option enabled', () => {
			const ctx = createMockContext( { width: 200, height: 100, cornerRadius: 10 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensions( ctx, { cornerRadius: true } );

			expect( ctx.addInput ).toHaveBeenCalledTimes( 3 );
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( {
					label: 'Corner Radius',
					value: 10
				} )
			);
		} );

		test( 'width onChange should update layer', () => {
			const ctx = createMockContext( { width: 200, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensions( ctx );

			// Get the width input's onChange handler
			const widthCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Width'
			);
			const onChange = widthCall[ 0 ].onChange;

			onChange( '300' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ width: 300 }
			);
		} );

		test( 'height onChange should update layer', () => {
			const ctx = createMockContext( { width: 200, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensions( ctx );

			const heightCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Height'
			);
			const onChange = heightCall[ 0 ].onChange;

			onChange( '150' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ height: 150 }
			);
		} );

		test( 'corner radius onChange should clamp to min zero', () => {
			const ctx = createMockContext( { width: 200, height: 100, cornerRadius: 10 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensions( ctx, { cornerRadius: true, maxCornerRadius: 50 } );

			const radiusCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Corner Radius'
			);
			const onChange = radiusCall[ 0 ].onChange;

			// Test clamping to min (0) - implementation uses Math.max(0, ...)
			onChange( '-10' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ cornerRadius: 0 }
			);
		} );
	} );

	describe( 'addTextProperties', () => {
		test( 'should add text content and styling inputs', () => {
			const ctx = createMockContext( {
				type: 'textbox',
				text: 'Hello World',
				fontFamily: 'Arial',
				fontSize: 16,
				color: '#333333'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx );

			expect( ctx.addInput ).toHaveBeenCalled();
			expect( ctx.addSelect ).toHaveBeenCalled();
			expect( ctx.addColorPicker ).toHaveBeenCalled();
		} );

		test( 'text onChange should update layer', () => {
			const ctx = createMockContext( { type: 'textbox', text: 'Hello' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx );

			const textCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Text'
			);
			const onChange = textCall[ 0 ].onChange;

			onChange( 'New Text' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ text: 'New Text' }
			);
		} );

		test( 'text stroke width onChange should clamp value', () => {
			const ctx = createMockContext( { type: 'textbox', text: 'Hello', textStrokeWidth: 2 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx );

			const strokeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Text Stroke Width'
			);
			const onChange = strokeCall[ 0 ].onChange;

			// Test clamping to max (20)
			onChange( '50' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textStrokeWidth: 20 }
			);
		} );

		test( 'color picker onChange should update layer', () => {
			const ctx = createMockContext( { type: 'textbox', text: 'Hello', color: '#000000' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx );

			const colorCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].label === 'Text Color'
			);
			const onChange = colorCall[ 0 ].onChange;

			onChange( '#ff0000' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ color: '#ff0000' }
			);
		} );

		test( 'text stroke color onChange should update layer', () => {
			const ctx = createMockContext( { type: 'textbox', text: 'Hello', textStrokeColor: '#000000' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx );

			const colorCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].label === 'Text Stroke Color'
			);
			const onChange = colorCall[ 0 ].onChange;

			onChange( '#0000ff' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textStrokeColor: '#0000ff' }
			);
		} );
	} );

	describe( 'addTextShadowSection', () => {
		test( 'should add text shadow controls', () => {
			const ctx = createMockContext( {
				type: 'textbox',
				textShadow: true,
				textShadowColor: 'rgba(0,0,0,0.5)',
				textShadowBlur: 4,
				textShadowOffsetX: 2,
				textShadowOffsetY: 2
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextShadowSection( ctx );

			expect( ctx.addSection ).toHaveBeenCalled();
			expect( ctx.addCheckbox ).toHaveBeenCalled();
			expect( ctx.addColorPicker ).toHaveBeenCalled();
			expect( ctx.addInput ).toHaveBeenCalled();
		} );

		test( 'should hide text shadow controls when disabled', () => {
			const ctx = createMockContext( {
				type: 'textbox',
				textShadow: false
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextShadowSection( ctx );

			expect( ctx.addSection ).toHaveBeenCalled();
			expect( ctx.addCheckbox ).toHaveBeenCalled();
			// Color picker and inputs should NOT be called when textShadow is false
			expect( ctx.addColorPicker ).not.toHaveBeenCalled();
			expect( ctx.addInput ).not.toHaveBeenCalled();
		} );

		test( 'text shadow checkbox onChange should update layer with defaults', () => {
			const ctx = createMockContext( { type: 'textbox', textShadow: false } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextShadowSection( ctx );

			const checkboxCall = ctx.addCheckbox.mock.calls[ 0 ];
			const onChange = checkboxCall[ 0 ].onChange;

			onChange( true );

			// Now passes defaults when enabling text shadow
			const call = ctx.editor.updateLayer.mock.calls.find( ( c ) => c[ 1 ].textShadow === true );
			expect( call ).toBeDefined();
			expect( call[ 1 ].textShadowColor ).toBe( 'rgba(0,0,0,0.5)' );
			expect( call[ 1 ].textShadowBlur ).toBe( 4 );
			expect( call[ 1 ].textShadowOffsetX ).toBe( 2 );
			expect( call[ 1 ].textShadowOffsetY ).toBe( 2 );
		} );

		test( 'text shadow color onChange should update layer', () => {
			// Must have textShadow: true for color picker to be shown
			const ctx = createMockContext( {
				type: 'textbox',
				textShadow: true,
				textShadowColor: '#000000'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextShadowSection( ctx );

			const colorCall = ctx.addColorPicker.mock.calls[ 0 ];
			const onChange = colorCall[ 0 ].onChange;

			onChange( 'rgba(255,0,0,0.5)' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textShadowColor: 'rgba(255,0,0,0.5)' }
			);
		} );

		test( 'text shadow blur onChange should clamp value', () => {
			// Must have textShadow: true for blur input to be shown
			const ctx = createMockContext( {
				type: 'textbox',
				textShadow: true,
				textShadowBlur: 4
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextShadowSection( ctx );

			const blurCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Shadow Blur'
			);
			const onChange = blurCall[ 0 ].onChange;

			// Test clamping to max (50)
			onChange( '100' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textShadowBlur: 50 }
			);
		} );

		test( 'text shadow offset X onChange should clamp value', () => {
			// Must have textShadow: true for offset input to be shown
			const ctx = createMockContext( {
				type: 'textbox',
				textShadow: true,
				textShadowOffsetX: 2
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextShadowSection( ctx );

			const offsetCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Shadow Offset X'
			);
			const onChange = offsetCall[ 0 ].onChange;

			// Test clamping to range [-100, 100]
			onChange( '200' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textShadowOffsetX: 100 }
			);
		} );

		test( 'text shadow offset Y onChange should clamp value', () => {
			// Must have textShadow: true for offset input to be shown
			const ctx = createMockContext( {
				type: 'textbox',
				textShadow: true,
				textShadowOffsetY: 2
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextShadowSection( ctx );

			const offsetCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Shadow Offset Y'
			);
			const onChange = offsetCall[ 0 ].onChange;

			// Test clamping to range [-100, 100]
			onChange( '-200' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textShadowOffsetY: -100 }
			);
		} );
	} );

	describe( 'addAlignmentSection', () => {
		test( 'should add alignment controls', () => {
			const ctx = createMockContext( {
				type: 'textbox',
				textAlign: 'left',
				verticalAlign: 'top'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addAlignmentSection( ctx );

			expect( ctx.addSection ).toHaveBeenCalled();
			expect( ctx.addSelect ).toHaveBeenCalledTimes( 2 );
		} );

		test( 'horizontal align onChange should update layer', () => {
			const ctx = createMockContext( { type: 'textbox', textAlign: 'left' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addAlignmentSection( ctx );

			const alignCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].label === 'Horizontal Align'
			);
			const onChange = alignCall[ 0 ].onChange;

			onChange( 'center' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textAlign: 'center' }
			);
		} );

		test( 'vertical align onChange should update layer', () => {
			const ctx = createMockContext( { type: 'textbox', verticalAlign: 'top' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addAlignmentSection( ctx );

			const alignCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].label === 'Vertical Align'
			);
			const onChange = alignCall[ 0 ].onChange;

			onChange( 'middle' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ verticalAlign: 'middle' }
			);
		} );
	} );

	describe( 'addEndpoints', () => {
		test( 'should add start and end point inputs for arrows', () => {
			const ctx = createMockContext( {
				type: 'arrow',
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 100
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addEndpoints( ctx );

			// Should add 4 inputs: x1, y1, x2, y2
			expect( ctx.addInput ).toHaveBeenCalledTimes( 4 );
		} );

		test( 'endpoint onChange should update layer', () => {
			const ctx = createMockContext( { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addEndpoints( ctx );

			// Find x1 input
			const x1Call = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'x1'
			);
			const onChange = x1Call[ 0 ].onChange;

			onChange( '50' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ x1: 50 }
			);
		} );
	} );

	describe( 'addArrowProperties', () => {
		test( 'should add arrow style controls', () => {
			const ctx = createMockContext( {
				type: 'arrow',
				arrowhead: 'arrow',
				arrowStyle: 'solid'
			} );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			expect( ctx.addSelect ).toHaveBeenCalled();
			expect( ctx.addInput ).toHaveBeenCalled();
		} );

		test( 'arrow size onChange should update layer', () => {
			const ctx = createMockContext( { type: 'arrow', arrowSize: 15 } );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const sizeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Head Size'
			);
			const onChange = sizeCall[ 0 ].onChange;

			onChange( '25' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ arrowSize: 25 }
			);
		} );

		test( 'tail width onChange should update layer', () => {
			const ctx = createMockContext( { type: 'arrow', tailWidth: 0, arrowStyle: 'single' } );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const widthCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Tail Width'
			);
			const onChange = widthCall[ 0 ].onChange;

			onChange( '10' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ tailWidth: 10 }
			);
		} );

		test( 'tail width should be hidden when arrowStyle is double', () => {
			const ctx = createMockContext( { type: 'arrow', arrowStyle: 'double', tailWidth: 0 } );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const widthCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Tail Width'
			);
			// Tail width control should not be rendered when arrowStyle is double
			expect( widthCall ).toBeUndefined();
		} );

		test( 'tail width should be shown when arrowStyle is single', () => {
			const ctx = createMockContext( { type: 'arrow', arrowStyle: 'single', tailWidth: 5 } );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const widthCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Tail Width'
			);
			expect( widthCall ).toBeDefined();
			expect( widthCall[ 0 ].value ).toBe( 5 );
		} );

		test( 'tail width should be shown when arrowStyle is none', () => {
			const ctx = createMockContext( { type: 'arrow', arrowStyle: 'none', tailWidth: 10 } );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const widthCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Tail Width'
			);
			expect( widthCall ).toBeDefined();
			expect( widthCall[ 0 ].value ).toBe( 10 );
		} );

		test( 'arrow ends onChange should update layer', () => {
			const ctx = createMockContext( { type: 'arrow', arrowStyle: 'single' } );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const endsCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].label === 'Arrow Ends'
			);
			const onChange = endsCall[ 0 ].onChange;

			onChange( 'double' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ arrowStyle: 'double', tailWidth: 0 }
			);
		} );

		test( 'arrow ends onChange to single should not affect tailWidth', () => {
			const ctx = createMockContext( { type: 'arrow', arrowStyle: 'double' } );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const endsCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].label === 'Arrow Ends'
			);
			const onChange = endsCall[ 0 ].onChange;

			onChange( 'single' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ arrowStyle: 'single' }
			);
		} );

		test( 'head scale onChange should update layer', () => {
			const ctx = createMockContext( { type: 'arrow', headScale: 1 } );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const scaleCall = ctx.addSliderInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Head Scale'
			);
			const onChange = scaleCall[ 0 ].onChange;

			onChange( 150 );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ headScale: 1.5 }
			);
		} );
	} );

	describe( 'addPosition', () => {
		test( 'should add x, y, and rotation inputs', () => {
			const ctx = createMockContext( { x: 100, y: 200, rotation: 0 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addPosition( ctx );

			// Adds x, y, rotation = 3 inputs
			expect( ctx.addInput ).toHaveBeenCalledTimes( 3 );
		} );

		test( 'x position onChange should update layer', () => {
			const ctx = createMockContext( { x: 100, y: 200 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addPosition( ctx );

			const xCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'x'
			);
			const onChange = xCall[ 0 ].onChange;

			onChange( '150' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ x: 150 }
			);
		} );
	} );

	describe( 'addCircleRadius', () => {
		test( 'should add radius input', () => {
			const ctx = createMockContext( { type: 'circle', radius: 50 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addCircleRadius( ctx );

			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( {
					label: 'Radius',
					value: 50
				} )
			);
		} );

		test( 'radius onChange should round value', () => {
			const ctx = createMockContext( { type: 'circle', radius: 50 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addCircleRadius( ctx );

			const radiusCall = ctx.addInput.mock.calls[ 0 ];
			const onChange = radiusCall[ 0 ].onChange;

			onChange( '75.7' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ radius: 76 }
			);
		} );
	} );

	describe( 'addEllipseProperties', () => {
		test( 'should add width and height inputs for ellipse', () => {
			const ctx = createMockContext( { type: 'ellipse', width: 200, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addEllipseProperties( ctx );

			// Ellipse uses Width/Height labels, not RadiusX/RadiusY
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( { label: 'Width' } )
			);
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( { label: 'Height' } )
			);
		} );

		test( 'width onChange should update both width and radiusX', () => {
			const ctx = createMockContext( { type: 'ellipse', width: 200, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addEllipseProperties( ctx );

			const widthCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Width'
			);
			const onChange = widthCall[ 0 ].onChange;

			onChange( '300' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ width: 300, radiusX: 150 }
			);
		} );
	} );

	describe( 'addPolygonProperties', () => {
		test( 'should add sides and radius inputs', () => {
			const ctx = createMockContext( { type: 'polygon', sides: 6, radius: 50 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addPolygonProperties( ctx );

			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( {
					label: 'Sides'
				} )
			);
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( {
					label: 'Radius'
				} )
			);
		} );

		test( 'sides onChange should clamp to min', () => {
			const ctx = createMockContext( { type: 'polygon', sides: 6 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addPolygonProperties( ctx );

			const sidesCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Sides'
			);
			const onChange = sidesCall[ 0 ].onChange;

			// Test clamping to min (3)
			onChange( '1' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ sides: 3 }
			);
		} );

		test( 'radius onChange should round value', () => {
			const ctx = createMockContext( { type: 'polygon', radius: 50 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addPolygonProperties( ctx );

			const radiusCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Radius'
			);
			const onChange = radiusCall[ 0 ].onChange;

			onChange( '75.7' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ radius: 76 }
			);
		} );
	} );

	describe( 'addStarProperties', () => {
		test( 'should add points and radius inputs', () => {
			const ctx = createMockContext( { type: 'star', points: 5, innerRadius: 25, outerRadius: 50 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addStarProperties( ctx );

			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( { label: 'Points' } )
			);
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( { label: 'Inner Radius' } )
			);
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( { label: 'Outer Radius' } )
			);
		} );

		test( 'points onChange should clamp to min', () => {
			const ctx = createMockContext( { type: 'star', points: 5 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addStarProperties( ctx );

			const pointsCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Points'
			);
			const onChange = pointsCall[ 0 ].onChange;

			// Test clamping to min (3)
			onChange( '1' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ points: 3 }
			);
		} );

		test( 'inner radius onChange should round value', () => {
			const ctx = createMockContext( { type: 'star', innerRadius: 25 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addStarProperties( ctx );

			const radiusCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Inner Radius'
			);
			const onChange = radiusCall[ 0 ].onChange;

			onChange( '30.7' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ innerRadius: 31 }
			);
		} );
	} );

	describe( 'addBlurProperties', () => {
		test( 'should add blur radius input', () => {
			const ctx = createMockContext( { type: 'blur', blurRadius: 12, width: 100, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addBlurProperties( ctx );

			// Should add dimensions (width, height) plus blur radius
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( {
					label: 'Blur Radius'
				} )
			);
		} );

		test( 'blur radius onChange should clamp to valid range', () => {
			const ctx = createMockContext( { type: 'blur', blurRadius: 12, width: 100, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addBlurProperties( ctx );

			const blurCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Blur Radius'
			);
			const onChange = blurCall[ 0 ].onChange;

			// Test clamping to max (64)
			onChange( '100' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ blurRadius: 64 }
			);
		} );

		test( 'blur radius should default to 12 for invalid input', () => {
			const ctx = createMockContext( { type: 'blur', blurRadius: 12, width: 100, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addBlurProperties( ctx );

			const blurCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Blur Radius'
			);
			const onChange = blurCall[ 0 ].onChange;

			// 0 is falsy so it defaults to 12, then Math.max(1, 12) = 12
			onChange( '0' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ blurRadius: 12 }
			);
		} );
	} );

	describe( 'addCalloutTailSection', () => {
		test( 'should add tail style for callout layers', () => {
			const ctx = createMockContext( {
				type: 'callout',
				tailStyle: 'triangle'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addCalloutTailSection( ctx );

			expect( ctx.addSection ).toHaveBeenCalled();
			expect( ctx.addSelect ).toHaveBeenCalled();
		} );

		test( 'tail style onChange should update layer', () => {
			const ctx = createMockContext( { type: 'callout', tailStyle: 'triangle' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addCalloutTailSection( ctx );

			const styleCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].label === 'Tail Style'
			);
			const onChange = styleCall[ 0 ].onChange;

			onChange( 'curved' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ tailStyle: 'curved' }
			);
		} );
	} );

	describe( 'addSimpleTextProperties', () => {
		test( 'should add text input and font size for simple text layers', () => {
			const ctx = createMockContext( {
				type: 'text',
				text: 'Hello',
				fontSize: 24
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addSimpleTextProperties( ctx );

			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( { label: 'Text' } )
			);
			expect( ctx.addInput ).toHaveBeenCalledWith(
				expect.objectContaining( { label: 'Font Size' } )
			);
		} );

		test( 'font size onChange should clamp to valid range', () => {
			const ctx = createMockContext( { type: 'text', fontSize: 16 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addSimpleTextProperties( ctx );

			const fsCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Font Size'
			);
			const onChange = fsCall[ 0 ].onChange;

			// Test clamping to min (6)
			onChange( '2' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontSize: 6 }
			);
		} );

		test( 'text stroke width onChange should update layer', () => {
			const ctx = createMockContext( { type: 'text', textStrokeWidth: 0 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addSimpleTextProperties( ctx );

			const strokeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Text Stroke Width'
			);
			const onChange = strokeCall[ 0 ].onChange;

			onChange( '3' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textStrokeWidth: 3 }
			);
		} );

		test( 'text stroke color onChange should update layer', () => {
			const ctx = createMockContext( { type: 'text', textStrokeColor: '#000000' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addSimpleTextProperties( ctx );

			const colorCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].label === 'Text Stroke Color'
			);
			const onChange = colorCall[ 0 ].onChange;

			onChange( '#ff0000' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textStrokeColor: '#ff0000' }
			);
		} );
	} );

	describe( 'addMarkerProperties', () => {
		test( 'should have addMarkerProperties method', () => {
			const Builders = window.Layers.UI.PropertyBuilders;
			expect( typeof Builders.addMarkerProperties ).toBe( 'function' );
		} );

		test( 'should add marker controls with section', () => {
			const ctx = createMockContext( {
				type: 'marker',
				value: 1,
				style: 'circled',
				size: 24
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			expect( ctx.addSection ).toHaveBeenCalled();
			expect( ctx.addInput ).toHaveBeenCalled();
			expect( ctx.addSelect ).toHaveBeenCalled();
			expect( ctx.addCheckbox ).toHaveBeenCalled();
			expect( ctx.addColorPicker ).toHaveBeenCalled();
		} );

		test( 'value input should update layer and name', () => {
			const ctx = createMockContext( {
				type: 'marker',
				value: 1,
				name: 'Marker 1'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const valueCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'value'
			);
			const onChange = valueCall[ 0 ].onChange;

			onChange( '5' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				expect.objectContaining( { value: '5' } )
			);
		} );

		test( 'value input should not change name if custom name set', () => {
			const ctx = createMockContext( {
				type: 'marker',
				value: 1,
				name: 'Custom Name'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const valueCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'value'
			);
			const onChange = valueCall[ 0 ].onChange;

			onChange( '5' );

			// Should only have value, not name in the update
			const callArgs = ctx.editor.updateLayer.mock.calls[ 0 ][ 1 ];
			expect( callArgs.value ).toBe( '5' );
			expect( callArgs.name ).toBeUndefined();
		} );

		test( 'empty value should default to 1', () => {
			const ctx = createMockContext( {
				type: 'marker',
				value: 1,
				name: 'Marker 1'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const valueCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'value'
			);
			const onChange = valueCall[ 0 ].onChange;

			onChange( '  ' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				expect.objectContaining( { value: '1' } )
			);
		} );

		test( 'style select should update layer', () => {
			const ctx = createMockContext( {
				type: 'marker',
				style: 'circled'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const styleCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].value === 'circled'
			);
			const onChange = styleCall[ 0 ].onChange;

			onChange( 'letter' );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ style: 'letter' }
			);
		} );

		test( 'size input should clamp to valid range', () => {
			const ctx = createMockContext( {
				type: 'marker',
				size: 24
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const sizeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'size'
			);
			const onChange = sizeCall[ 0 ].onChange;

			// Test clamping to max (200)
			onChange( '500' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ size: 200 }
			);
		} );

		test( 'size input should clamp to min (10)', () => {
			const ctx = createMockContext( {
				type: 'marker',
				size: 24
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const sizeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'size'
			);
			const onChange = sizeCall[ 0 ].onChange;

			onChange( '5' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ size: 10 }
			);
		} );

		test( 'fontSizeAdjust input should clamp to valid range', () => {
			const ctx = createMockContext( {
				type: 'marker',
				fontSizeAdjust: 0
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const adjustCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'fontSizeAdjust'
			);
			const onChange = adjustCall[ 0 ].onChange;

			// Test clamping to max (20)
			onChange( '50' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontSizeAdjust: 20 }
			);
		} );

		test( 'strokeWidth input should round to 0.5 increments', () => {
			const ctx = createMockContext( {
				type: 'marker',
				strokeWidth: 2
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const strokeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'strokeWidth'
			);
			const onChange = strokeCall[ 0 ].onChange;

			onChange( '3.3' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ strokeWidth: 3.5 }
			);
		} );

		test( 'hasArrow checkbox should enable arrow with default position', () => {
			const ctx = createMockContext( {
				type: 'marker',
				hasArrow: false,
				x: 100,
				y: 100
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const arrowCall = ctx.addCheckbox.mock.calls.find(
				( call ) => call[ 0 ].prop === 'hasArrow'
			);
			const onChange = arrowCall[ 0 ].onChange;

			onChange( true );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				expect.objectContaining( {
					hasArrow: true,
					arrowX: 100,
					arrowY: 150
				} )
			);
		} );

		test( 'hasArrow checkbox should not set default position if already set', () => {
			const ctx = createMockContext( {
				type: 'marker',
				hasArrow: false,
				x: 100,
				y: 100,
				arrowX: 200,
				arrowY: 200
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			const arrowCall = ctx.addCheckbox.mock.calls.find(
				( call ) => call[ 0 ].prop === 'hasArrow'
			);
			const onChange = arrowCall[ 0 ].onChange;

			onChange( true );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ hasArrow: true }
			);
		} );

		test( 'color pickers should update layer', () => {
			const ctx = createMockContext( {
				type: 'marker',
				color: '#000000',
				fill: '#ffffff',
				stroke: '#000000'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addMarkerProperties( ctx );

			// Text color
			const textColorCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].prop === 'color'
			);
			textColorCall[ 0 ].onChange( '#ff0000' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ color: '#ff0000' }
			);

			// Fill color
			const fillCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].prop === 'fill'
			);
			fillCall[ 0 ].onChange( '#00ff00' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fill: '#00ff00' }
			);

			// Stroke color
			const strokeCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].prop === 'stroke'
			);
			strokeCall[ 0 ].onChange( '#0000ff' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ stroke: '#0000ff' }
			);
		} );
	} );

	describe( 'addDimensionProperties', () => {
		test( 'should have addDimensionProperties method', () => {
			const Builders = window.Layers.UI.PropertyBuilders;
			expect( typeof Builders.addDimensionProperties ).toBe( 'function' );
		} );

		test( 'should add dimension controls with section', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				text: '25.4 mm',
				fontSize: 12
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			expect( ctx.addSection ).toHaveBeenCalled();
			expect( ctx.addInput ).toHaveBeenCalled();
			expect( ctx.addSelect ).toHaveBeenCalled();
			expect( ctx.addCheckbox ).toHaveBeenCalled();
			expect( ctx.addColorPicker ).toHaveBeenCalled();
		} );

		test( 'dimension value input should update text property', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				text: '25 mm'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const textCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'text'
			);
			const onChange = textCall[ 0 ].onChange;

			onChange( '50 mm' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ text: '50 mm' }
			);
		} );

		test( 'empty dimension value should set undefined', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				text: '25 mm'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const textCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'text'
			);
			const onChange = textCall[ 0 ].onChange;

			onChange( '' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ text: undefined }
			);
		} );

		test( 'fontSize input should clamp to valid range', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				fontSize: 12
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const fontCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'fontSize'
			);
			const onChange = fontCall[ 0 ].onChange;

			// Test clamping to min (6)
			onChange( '3' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontSize: 6 }
			);
		} );

		test( 'strokeWidth input should round to 0.5 increments', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				strokeWidth: 1
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const strokeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'strokeWidth'
			);
			const onChange = strokeCall[ 0 ].onChange;

			onChange( '2.3' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ strokeWidth: 2.5 }
			);
		} );

		test( 'orientation change to horizontal should align y2 to y1', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				orientation: 'free',
				x1: 100,
				y1: 100,
				x2: 200,
				y2: 150
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const orientCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].value === 'free'
			);
			const onChange = orientCall[ 0 ].onChange;

			onChange( 'horizontal' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ orientation: 'horizontal', y2: 100 }
			);
		} );

		test( 'orientation change to vertical should align x2 to x1', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				orientation: 'free',
				x1: 100,
				y1: 100,
				x2: 200,
				y2: 150
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const orientCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].value === 'free'
			);
			const onChange = orientCall[ 0 ].onChange;

			onChange( 'vertical' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ orientation: 'vertical', x2: 100 }
			);
		} );

		test( 'endStyle select should update layer', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				endStyle: 'arrow'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const endCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].options && call[ 0 ].options.some( ( o ) => o.value === 'tick' )
			);
			const onChange = endCall[ 0 ].onChange;

			onChange( 'tick' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ endStyle: 'tick' }
			);
		} );

		test( 'textPosition select should update layer', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				textPosition: 'above'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const posCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].options && call[ 0 ].options.some( ( o ) => o.value === 'below' )
			);
			const onChange = posCall[ 0 ].onChange;

			onChange( 'below' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textPosition: 'below' }
			);
		} );

		test( 'textDirection select should update layer', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				textDirection: 'auto'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			// Find the textDirection select by looking for the one with 'auto-reversed' option
			const dirCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].options && call[ 0 ].options.some( ( o ) => o.value === 'auto-reversed' )
			);
			const onChange = dirCall[ 0 ].onChange;

			onChange( 'horizontal' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textDirection: 'horizontal' }
			);
		} );

		test( 'extensionLength input should clamp to valid range', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				extensionLength: 10
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const extCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'extensionLength'
			);
			const onChange = extCall[ 0 ].onChange;

			// Test clamping to max (100)
			onChange( '200' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ extensionLength: 100 }
			);
		} );

		test( 'showBackground checkbox should update layer', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				showBackground: true
			} );
			ctx.editor.layerPanel = {
				updatePropertiesPanel: jest.fn()
			};
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const bgCall = ctx.addCheckbox.mock.calls.find(
				( call ) => call[ 0 ].prop === 'showBackground'
			);
			const onChange = bgCall[ 0 ].onChange;

			onChange( false );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ showBackground: false }
			);
		} );

		test( 'backgroundColor color picker should update layer when showBackground is true', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				showBackground: true,
				backgroundColor: '#ffffff'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const bgColorCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].prop === 'backgroundColor'
			);
			expect( bgColorCall ).toBeDefined();

			bgColorCall[ 0 ].onChange( '#f0f0f0' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ backgroundColor: '#f0f0f0' }
			);
		} );

		test( 'backgroundColor color picker should not appear when showBackground is false', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				showBackground: false
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const bgColorCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].prop === 'backgroundColor'
			);
			expect( bgColorCall ).toBeUndefined();
		} );

		test( 'toleranceType select should update layer and refresh panel', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				toleranceType: 'none'
			} );
			ctx.editor.layerPanel = {
				updatePropertiesPanel: jest.fn()
			};
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const tolCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].options && call[ 0 ].options.some( ( o ) => o.value === 'symmetric' )
			);
			const onChange = tolCall[ 0 ].onChange;

			onChange( 'symmetric' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ toleranceType: 'symmetric' }
			);
		} );

		test( 'toleranceValue input should appear for symmetric type', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				toleranceType: 'symmetric',
				toleranceValue: '0.1'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const tolValCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'toleranceValue'
			);
			expect( tolValCall ).toBeDefined();

			tolValCall[ 0 ].onChange( '0.2' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ toleranceValue: '0.2' }
			);
		} );

		test( 'toleranceUpper and toleranceLower should appear for deviation type', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				toleranceType: 'deviation',
				toleranceUpper: '+0.1',
				toleranceLower: '-0.1'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const upperCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'toleranceUpper'
			);
			const lowerCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'toleranceLower'
			);

			expect( upperCall ).toBeDefined();
			expect( lowerCall ).toBeDefined();

			upperCall[ 0 ].onChange( '+0.2' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ toleranceUpper: '+0.2' }
			);

			lowerCall[ 0 ].onChange( '-0.2' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ toleranceLower: '-0.2' }
			);
		} );

		test( 'toleranceUpper and toleranceLower should appear for limits type', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				toleranceType: 'limits',
				toleranceUpper: '25.5',
				toleranceLower: '25.3'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const upperCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'toleranceUpper'
			);
			const lowerCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'toleranceLower'
			);

			expect( upperCall ).toBeDefined();
			expect( lowerCall ).toBeDefined();
		} );

		test( 'tolerance inputs should not appear for none type', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				toleranceType: 'none'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const tolValCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'toleranceValue'
			);
			const upperCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'toleranceUpper'
			);
			const lowerCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'toleranceLower'
			);

			expect( tolValCall ).toBeUndefined();
			expect( upperCall ).toBeUndefined();
			expect( lowerCall ).toBeUndefined();
		} );

		test( 'marker size should appear for arrow end style', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				endStyle: 'arrow',
				arrowSize: 8
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const sizeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'arrowSize'
			);
			expect( sizeCall ).toBeDefined();

			sizeCall[ 0 ].onChange( '12' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ arrowSize: 12 }
			);
		} );

		test( 'tick size should appear for tick end style', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				endStyle: 'tick',
				tickSize: 6
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const sizeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'tickSize'
			);
			expect( sizeCall ).toBeDefined();

			sizeCall[ 0 ].onChange( '10' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ tickSize: 10 }
			);
		} );

		test( 'marker size should not appear for none end style', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				endStyle: 'none'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			const arrowSizeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'arrowSize'
			);
			const tickSizeCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'tickSize'
			);

			expect( arrowSizeCall ).toBeUndefined();
			expect( tickSizeCall ).toBeUndefined();
		} );

		test( 'color pickers should update layer', () => {
			const ctx = createMockContext( {
				type: 'dimension',
				color: '#000000',
				stroke: '#000000'
			} );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addDimensionProperties( ctx );

			// Text color
			const textColorCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].prop === 'color'
			);
			textColorCall[ 0 ].onChange( '#ff0000' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ color: '#ff0000' }
			);

			// Stroke color
			const strokeCall = ctx.addColorPicker.mock.calls.find(
				( call ) => call[ 0 ].prop === 'stroke'
			);
			strokeCall[ 0 ].onChange( '#0000ff' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ stroke: '#0000ff' }
			);
		} );
	} );

	describe( 'addTextProperties edge cases', () => {
		test( 'should use single-line input when useTextarea is false', () => {
			const ctx = createMockContext( { type: 'text', text: 'Hello' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx, { useTextarea: false } );

			const textCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Text'
			);
			expect( textCall[ 0 ].type ).toBe( 'text' );
			expect( textCall[ 0 ].maxLength ).toBe( 1000 );
		} );

		test( 'font size onChange should clamp to valid range', () => {
			const ctx = createMockContext( { type: 'textbox', fontSize: 16 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx, { maxFontSize: 100 } );

			const fontCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'fontSize'
			);
			const onChange = fontCall[ 0 ].onChange;

			// Test clamping to max
			onChange( '200' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontSize: 100 }
			);

			// Test clamping to min
			onChange( '2' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontSize: 6 }
			);
		} );

		test( 'bold checkbox onChange should toggle fontWeight', () => {
			const ctx = createMockContext( { type: 'textbox', fontWeight: 'normal' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx );

			const boldCall = ctx.addCheckbox.mock.calls.find(
				( call ) => call[ 0 ].label === 'Bold'
			);
			const onChange = boldCall[ 0 ].onChange;

			onChange( true );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontWeight: 'bold' }
			);

			onChange( false );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontWeight: 'normal' }
			);
		} );

		test( 'italic checkbox onChange should toggle fontStyle', () => {
			const ctx = createMockContext( { type: 'textbox', fontStyle: 'normal' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx );

			const italicCall = ctx.addCheckbox.mock.calls.find(
				( call ) => call[ 0 ].label === 'Italic'
			);
			const onChange = italicCall[ 0 ].onChange;

			onChange( true );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontStyle: 'italic' }
			);

			onChange( false );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontStyle: 'normal' }
			);
		} );

		test( 'font family onChange should update layer', () => {
			const ctx = createMockContext( { type: 'textbox', fontFamily: 'Arial' } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextProperties( ctx );

			const fontCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].label === 'Font'
			);
			const onChange = fontCall[ 0 ].onChange;

			onChange( 'Times New Roman' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ fontFamily: 'Times New Roman' }
			);
		} );
	} );

	describe( 'addAlignmentSection edge cases', () => {
		test( 'padding onChange should clamp to valid range', () => {
			const ctx = createMockContext( { type: 'textbox', padding: 8 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addAlignmentSection( ctx );

			const paddingCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'padding'
			);
			const onChange = paddingCall[ 0 ].onChange;

			// Test clamping to max (100)
			onChange( '200' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ padding: 100 }
			);

			// Test clamping to min (0)
			onChange( '-10' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ padding: 0 }
			);
		} );
	} );

	describe( 'addPosition edge cases', () => {
		test( 'y position onChange should update layer', () => {
			const ctx = createMockContext( { x: 100, y: 200 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addPosition( ctx );

			const yCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'y'
			);
			const onChange = yCall[ 0 ].onChange;

			onChange( '250' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ y: 250 }
			);
		} );

		test( 'rotation onChange should update layer and round value', () => {
			const ctx = createMockContext( { rotation: 0 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addPosition( ctx );

			const rotCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'rotation'
			);
			const onChange = rotCall[ 0 ].onChange;

			onChange( '45.7' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ rotation: 46 }
			);
		} );
	} );

	describe( 'addEndpoints edge cases', () => {
		test( 'y1 onChange should update layer', () => {
			const ctx = createMockContext( { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addEndpoints( ctx );

			const y1Call = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'y1'
			);
			const onChange = y1Call[ 0 ].onChange;

			onChange( '25' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ y1: 25 }
			);
		} );

		test( 'x2 onChange should update layer', () => {
			const ctx = createMockContext( { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addEndpoints( ctx );

			const x2Call = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'x2'
			);
			const onChange = x2Call[ 0 ].onChange;

			onChange( '150' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ x2: 150 }
			);
		} );

		test( 'y2 onChange should update layer', () => {
			const ctx = createMockContext( { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addEndpoints( ctx );

			const y2Call = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].prop === 'y2'
			);
			const onChange = y2Call[ 0 ].onChange;

			onChange( '150' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ y2: 150 }
			);
		} );
	} );

	describe( 'addArrowProperties edge cases', () => {
		test( 'head type onChange should update layer', () => {
			const ctx = createMockContext( { type: 'arrow', arrowHeadType: 'pointed' } );
			ctx.addSliderInput = jest.fn();
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const typeCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].label === 'Head Type'
			);
			const onChange = typeCall[ 0 ].onChange;

			onChange( 'chevron' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ arrowHeadType: 'chevron' }
			);
		} );

		test( 'arrow ends onChange should refresh properties panel', () => {
			const ctx = createMockContext( { type: 'arrow', arrowStyle: 'single' } );
			ctx.addSliderInput = jest.fn();
			ctx.editor.layerPanel = {
				updatePropertiesPanel: jest.fn()
			};
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addArrowProperties( ctx );

			const endsCall = ctx.addSelect.mock.calls.find(
				( call ) => call[ 0 ].label === 'Arrow Ends'
			);
			const onChange = endsCall[ 0 ].onChange;

			// Use fake timers to test setTimeout
			jest.useFakeTimers();
			onChange( 'double' );
			jest.runAllTimers();
			jest.useRealTimers();

			expect( ctx.editor.layerPanel.updatePropertiesPanel ).toHaveBeenCalled();
		} );
	} );

	describe( 'addEllipseProperties edge cases', () => {
		test( 'height onChange should update both height and radiusY', () => {
			const ctx = createMockContext( { type: 'ellipse', width: 200, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addEllipseProperties( ctx );

			const heightCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Height'
			);
			const onChange = heightCall[ 0 ].onChange;

			onChange( '200' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ height: 200, radiusY: 100 }
			);
		} );
	} );

	describe( 'addStarProperties edge cases', () => {
		test( 'outer radius onChange should round value', () => {
			const ctx = createMockContext( { type: 'star', outerRadius: 50 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addStarProperties( ctx );

			const outerCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Outer Radius'
			);
			const onChange = outerCall[ 0 ].onChange;

			onChange( '75.7' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ outerRadius: 76 }
			);
		} );

		test( 'point radius onChange should clamp to valid range', () => {
			const ctx = createMockContext( { type: 'star', pointRadius: 0 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addStarProperties( ctx );

			const pointCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Point Radius'
			);
			const onChange = pointCall[ 0 ].onChange;

			// Test clamping to min (0)
			onChange( '-10' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ pointRadius: 0 }
			);
		} );

		test( 'valley radius onChange should clamp to valid range', () => {
			const ctx = createMockContext( { type: 'star', valleyRadius: 0 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addStarProperties( ctx );

			const valleyCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Valley Radius'
			);
			const onChange = valleyCall[ 0 ].onChange;

			// Test clamping to min (0)
			onChange( '-10' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ valleyRadius: 0 }
			);
		} );
	} );

	describe( 'addPolygonProperties edge cases', () => {
		test( 'corner radius onChange should clamp to valid range', () => {
			const ctx = createMockContext( { type: 'polygon', cornerRadius: 0 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addPolygonProperties( ctx );

			const cornerCall = ctx.addInput.mock.calls.find(
				( call ) => call[ 0 ].label === 'Corner Radius'
			);
			const onChange = cornerCall[ 0 ].onChange;

			// Test clamping to min (0)
			onChange( '-10' );
			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ cornerRadius: 0 }
			);
		} );
	} );

	describe( 'message helper fallback', () => {
		test( 'should use fallback when layersMessages not available', () => {
			// Temporarily remove layersMessages
			const original = window.layersMessages;
			delete window.layersMessages;

			const ctx = createMockContext( { width: 200, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			// Should not throw
			expect( () => Builders.addDimensions( ctx ) ).not.toThrow();

			// Restore
			window.layersMessages = original;
		} );

		test( 'should use fallback when layersMessages.get is not a function', () => {
			const original = window.layersMessages;
			window.layersMessages = {};

			const ctx = createMockContext( { width: 200, height: 100 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			// Should not throw
			expect( () => Builders.addDimensions( ctx ) ).not.toThrow();

			// Restore
			window.layersMessages = original;
		} );
	} );

	describe( 'getConstants edge cases', () => {
		test( 'should handle missing Layers.Constants gracefully', () => {
			const original = window.Layers.Constants;
			delete window.Layers.Constants;

			const ctx = createMockContext( { type: 'circle', radius: 50 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			// Should not throw and use fallback values
			expect( () => Builders.addCircleRadius( ctx ) ).not.toThrow();

			// Restore
			window.Layers.Constants = original;
		} );

		test( 'should handle missing DEFAULTS gracefully in polygon', () => {
			const original = window.Layers.Constants;
			window.Layers.Constants = { LAYER_TYPES: {}, LIMITS: {} };

			const ctx = createMockContext( { type: 'polygon', sides: 6 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			// Should not throw and use fallback values
			expect( () => Builders.addPolygonProperties( ctx ) ).not.toThrow();

			// Restore
			window.Layers.Constants = original;
		} );

		test( 'should handle missing LIMITS gracefully in star', () => {
			const original = window.Layers.Constants;
			window.Layers.Constants = { LAYER_TYPES: {}, DEFAULTS: {} };

			const ctx = createMockContext( { type: 'star', points: 5 } );
			const Builders = window.Layers.UI.PropertyBuilders;

			// Should not throw and use fallback values
			expect( () => Builders.addStarProperties( ctx ) ).not.toThrow();

			// Restore
			window.Layers.Constants = original;
		} );
	} );
} );
