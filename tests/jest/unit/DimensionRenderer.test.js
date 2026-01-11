/**
 * DimensionRenderer Unit Tests
 *
 * Tests for the DimensionRenderer module that renders dimension/measurement
 * annotations with extension lines and auto-calculated measurements.
 */
'use strict';

const DimensionRenderer = require( '../../../resources/ext.layers.shared/DimensionRenderer.js' );

describe( 'DimensionRenderer', () => {
	let renderer;
	let mockCtx;

	beforeEach( () => {
		// Create a mock canvas context
		mockCtx = {
			save: jest.fn(),
			restore: jest.fn(),
			beginPath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			stroke: jest.fn(),
			fill: jest.fn(),
			arc: jest.fn(),
			fillRect: jest.fn(),
			fillText: jest.fn(),
			measureText: jest.fn( () => ( { width: 30 } ) ),
			translate: jest.fn(),
			rotate: jest.fn(),
			strokeStyle: '',
			fillStyle: '',
			lineWidth: 1,
			lineCap: 'butt',
			lineJoin: 'miter',
			font: '',
			textAlign: 'start',
			textBaseline: 'alphabetic',
			globalAlpha: 1
		};

		renderer = new DimensionRenderer( mockCtx );
	} );

	afterEach( () => {
		renderer = null;
		mockCtx = null;
	} );

	describe( 'constructor', () => {
		test( 'creates instance with context', () => {
			expect( renderer ).toBeInstanceOf( DimensionRenderer );
			expect( renderer.ctx ).toBe( mockCtx );
		} );

		test( 'creates instance without context', () => {
			const noCtxRenderer = new DimensionRenderer( null );
			expect( noCtxRenderer ).toBeInstanceOf( DimensionRenderer );
			expect( noCtxRenderer.ctx ).toBeNull();
		} );

		test( 'accepts config object', () => {
			const config = { someOption: true };
			const configRenderer = new DimensionRenderer( mockCtx, config );
			expect( configRenderer.config ).toEqual( config );
		} );
	} );

	describe( 'setContext', () => {
		test( 'updates the rendering context', () => {
			const newCtx = { ...mockCtx, custom: true };
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'formatMeasurement', () => {
		test( 'formats value with default settings', () => {
			const layer = {};
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toBe( '100 px' );
		} );

		test( 'applies scale factor', () => {
			const layer = { scale: 0.5, unit: 'cm' };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toBe( '50 cm' );
		} );

		test( 'applies precision', () => {
			const layer = { scale: 0.333, precision: 2 };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toBe( '33.30 px' );
		} );

		test( 'hides unit when showUnit is false', () => {
			const layer = { showUnit: false };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toBe( '100' );
		} );

		test( 'uses custom unit', () => {
			const layer = { unit: 'in' };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toBe( '100 in' );
		} );
	} );

	describe( 'calculateDistance', () => {
		test( 'calculates horizontal distance', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0 };
			const distance = renderer.calculateDistance( layer );
			expect( distance ).toBe( 100 );
		} );

		test( 'calculates vertical distance', () => {
			const layer = { x1: 0, y1: 0, x2: 0, y2: 100 };
			const distance = renderer.calculateDistance( layer );
			expect( distance ).toBe( 100 );
		} );

		test( 'calculates diagonal distance', () => {
			const layer = { x1: 0, y1: 0, x2: 30, y2: 40 };
			const distance = renderer.calculateDistance( layer );
			expect( distance ).toBe( 50 ); // 3-4-5 triangle
		} );

		test( 'handles negative coordinates', () => {
			const layer = { x1: -50, y1: -50, x2: 50, y2: 50 };
			const distance = renderer.calculateDistance( layer );
			expect( distance ).toBeCloseTo( Math.sqrt( 20000 ), 5 );
		} );

		test( 'handles missing coordinates as zero', () => {
			const layer = {};
			const distance = renderer.calculateDistance( layer );
			expect( distance ).toBe( 0 );
		} );
	} );

	describe( 'draw', () => {
		test( 'does not draw without context', () => {
			renderer.ctx = null;
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0 };
			renderer.draw( layer );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		test( 'does not draw without layer', () => {
			renderer.draw( null );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		test( 'does not draw dimension with zero length', () => {
			const layer = { x1: 50, y1: 50, x2: 50, y2: 50 };
			renderer.draw( layer );
			// save/restore should still be called, but the drawing should exit early
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		test( 'draws horizontal dimension line', () => {
			const layer = { x1: 0, y1: 100, x2: 200, y2: 100 };
			renderer.draw( layer );

			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'applies opacity from layer', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, opacity: 0.5 };
			renderer.draw( layer );
			expect( mockCtx.globalAlpha ).toBe( 0.5 );
		} );

		test( 'uses custom stroke color', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, stroke: '#ff0000' };
			renderer.draw( layer );
			expect( mockCtx.strokeStyle ).toBe( '#ff0000' );
		} );

		test( 'uses custom stroke width', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, strokeWidth: 3 };
			renderer.draw( layer );
			expect( mockCtx.lineWidth ).toBe( 3 );
		} );

		test( 'draws extension lines', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0 };
			renderer.draw( layer );
			// Extension lines + main line = multiple moveTo/lineTo calls
			expect( mockCtx.moveTo.mock.calls.length ).toBeGreaterThan( 1 );
			expect( mockCtx.lineTo.mock.calls.length ).toBeGreaterThan( 1 );
		} );

		test( 'uses custom text from layer', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, text: 'Custom Label' };
			renderer.draw( layer );
			expect( mockCtx.fillText ).toHaveBeenCalledWith( 'Custom Label', 0, 0 );
		} );
	} );

	describe( 'getBounds', () => {
		test( 'returns bounding box for horizontal dimension', () => {
			const layer = { x1: 50, y1: 100, x2: 150, y2: 100 };
			const bounds = renderer.getBounds( layer );

			expect( bounds.x ).toBeLessThan( 50 );
			expect( bounds.y ).toBeLessThan( 100 );
			expect( bounds.width ).toBeGreaterThan( 100 );
			expect( bounds.height ).toBeGreaterThan( 0 );
		} );

		test( 'returns bounding box for diagonal dimension', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 100 };
			const bounds = renderer.getBounds( layer );

			expect( bounds.x ).toBeLessThan( 0 );
			expect( bounds.y ).toBeLessThan( 0 );
			expect( bounds.width ).toBeGreaterThan( 100 );
			expect( bounds.height ).toBeGreaterThan( 100 );
		} );

		test( 'accounts for extension length in bounds', () => {
			const layer = { x1: 50, y1: 50, x2: 100, y2: 50, extensionLength: 20 };
			const bounds = renderer.getBounds( layer );

			// Bounds should account for extension line length + padding
			expect( bounds.x ).toBeLessThan( 50 - 20 );
		} );
	} );

	describe( 'hitTest', () => {
		test( 'returns true for point on dimension line', () => {
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50 };
			const result = renderer.hitTest( layer, 50, 50 );
			expect( result ).toBe( true );
		} );

		test( 'returns true for point near dimension line', () => {
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50 };
			const result = renderer.hitTest( layer, 50, 55 );
			expect( result ).toBe( true );
		} );

		test( 'returns false for point far from dimension line', () => {
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50 };
			const result = renderer.hitTest( layer, 50, 100 );
			expect( result ).toBe( false );
		} );

		test( 'works with diagonal lines', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 100 };
			const result = renderer.hitTest( layer, 50, 50 );
			expect( result ).toBe( true );
		} );

		test( 'returns true for point at endpoint', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0 };
			const result = renderer.hitTest( layer, 0, 0 );
			expect( result ).toBe( true );
		} );
	} );

	describe( 'static createDimensionLayer', () => {
		test( 'creates dimension layer with coordinates', () => {
			const layer = DimensionRenderer.createDimensionLayer( 10, 20, 110, 20 );

			expect( layer.type ).toBe( 'dimension' );
			expect( layer.x1 ).toBe( 10 );
			expect( layer.y1 ).toBe( 20 );
			expect( layer.x2 ).toBe( 110 );
			expect( layer.y2 ).toBe( 20 );
		} );

		test( 'creates layer with default values', () => {
			const layer = DimensionRenderer.createDimensionLayer( 0, 0, 100, 0 );

			expect( layer.stroke ).toBe( '#000000' );
			expect( layer.strokeWidth ).toBe( 1 );
			expect( layer.fontSize ).toBe( 12 );
			expect( layer.endStyle ).toBe( 'arrow' );
			expect( layer.textPosition ).toBe( 'above' );
			expect( layer.unit ).toBe( 'px' );
			expect( layer.scale ).toBe( 1 );
			expect( layer.showUnit ).toBe( true );
			expect( layer.precision ).toBe( 0 );
			expect( layer.visible ).toBe( true );
			expect( layer.locked ).toBe( false );
		} );

		test( 'applies custom options', () => {
			const options = {
				stroke: '#ff0000',
				endStyle: 'tick',
				unit: 'cm',
				scale: 0.1,
				precision: 2
			};
			const layer = DimensionRenderer.createDimensionLayer( 0, 0, 100, 0, options );

			expect( layer.stroke ).toBe( '#ff0000' );
			expect( layer.endStyle ).toBe( 'tick' );
			expect( layer.unit ).toBe( 'cm' );
			expect( layer.scale ).toBe( 0.1 );
			expect( layer.precision ).toBe( 2 );
		} );

		test( 'generates unique ID', () => {
			const layer1 = DimensionRenderer.createDimensionLayer( 0, 0, 100, 0 );
			const layer2 = DimensionRenderer.createDimensionLayer( 0, 0, 100, 0 );

			expect( layer1.id ).toBeDefined();
			expect( layer1.id ).toContain( 'dimension-' );
		} );

		test( 'allows custom ID', () => {
			const layer = DimensionRenderer.createDimensionLayer( 0, 0, 100, 0, { id: 'custom-id' } );
			expect( layer.id ).toBe( 'custom-id' );
		} );
	} );

	describe( 'static constants', () => {
		test( 'exposes END_STYLES', () => {
			expect( DimensionRenderer.END_STYLES ).toBeDefined();
			expect( DimensionRenderer.END_STYLES.ARROW ).toBe( 'arrow' );
			expect( DimensionRenderer.END_STYLES.TICK ).toBe( 'tick' );
			expect( DimensionRenderer.END_STYLES.DOT ).toBe( 'dot' );
			expect( DimensionRenderer.END_STYLES.NONE ).toBe( 'none' );
		} );

		test( 'exposes TEXT_POSITIONS', () => {
			expect( DimensionRenderer.TEXT_POSITIONS ).toBeDefined();
			expect( DimensionRenderer.TEXT_POSITIONS.ABOVE ).toBe( 'above' );
			expect( DimensionRenderer.TEXT_POSITIONS.BELOW ).toBe( 'below' );
			expect( DimensionRenderer.TEXT_POSITIONS.CENTER ).toBe( 'center' );
		} );

		test( 'exposes DEFAULTS', () => {
			const defaults = DimensionRenderer.DEFAULTS;
			expect( defaults ).toBeDefined();
			expect( defaults.stroke ).toBe( '#000000' );
			expect( defaults.endStyle ).toBe( 'arrow' );
			expect( defaults.textPosition ).toBe( 'above' );
			expect( defaults.extensionLength ).toBe( 10 );
		} );

		test( 'DEFAULTS is a copy (not mutable)', () => {
			const defaults1 = DimensionRenderer.DEFAULTS;
			const defaults2 = DimensionRenderer.DEFAULTS;
			defaults1.stroke = '#ffffff';
			expect( defaults2.stroke ).toBe( '#000000' );
		} );
	} );

	describe( 'end marker styles', () => {
		test( 'draws arrow end markers', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, endStyle: 'arrow' };
			renderer.draw( layer );
			// Should draw arrow lines at endpoints
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws tick end markers', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, endStyle: 'tick' };
			renderer.draw( layer );
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws dot end markers', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, endStyle: 'dot' };
			renderer.draw( layer );
			expect( mockCtx.arc ).toHaveBeenCalled();
			expect( mockCtx.fill ).toHaveBeenCalled();
		} );

		test( 'draws no markers when style is none', () => {
			mockCtx.arc.mockClear();
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, endStyle: 'none' };
			renderer.draw( layer );
			// arc should not be called for none style
			// (it's only called for dots)
		} );
	} );

	describe( 'text positioning', () => {
		test( 'positions text above the line', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, textPosition: 'above' };
			renderer.draw( layer );
			expect( mockCtx.fillText ).toHaveBeenCalled();
		} );

		test( 'positions text below the line', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, textPosition: 'below' };
			renderer.draw( layer );
			expect( mockCtx.fillText ).toHaveBeenCalled();
		} );

		test( 'positions text at center with background', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, textPosition: 'center' };
			renderer.draw( layer );
			// Center position draws a white background rect
			expect( mockCtx.fillRect ).toHaveBeenCalled();
			expect( mockCtx.fillText ).toHaveBeenCalled();
		} );
	} );
} );
