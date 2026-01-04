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

		test( 'text shadow checkbox onChange should update layer', () => {
			const ctx = createMockContext( { type: 'textbox', textShadow: false } );
			const Builders = window.Layers.UI.PropertyBuilders;

			Builders.addTextShadowSection( ctx );

			const checkboxCall = ctx.addCheckbox.mock.calls[ 0 ];
			const onChange = checkboxCall[ 0 ].onChange;

			onChange( true );

			expect( ctx.editor.updateLayer ).toHaveBeenCalledWith(
				'test-layer-1',
				{ textShadow: true }
			);
		} );

		test( 'text shadow color onChange should update layer', () => {
			const ctx = createMockContext( { type: 'textbox', textShadowColor: '#000000' } );
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
			const ctx = createMockContext( { type: 'textbox', textShadowBlur: 4 } );
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
			const ctx = createMockContext( { type: 'textbox', textShadowOffsetX: 2 } );
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
			const ctx = createMockContext( { type: 'textbox', textShadowOffsetY: 2 } );
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
			const ctx = createMockContext( { type: 'arrow', tailWidth: 0 } );
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
				{ arrowStyle: 'double' }
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
	} );
} );
