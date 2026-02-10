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
			strokeRect: jest.fn(),
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
			// dimensionOffset: 0 means the dimension line is ON the baseline
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50, dimensionOffset: 0 };
			const result = renderer.hitTest( layer, 50, 50 );
			expect( result ).toBe( true );
		} );

		test( 'returns true for point near dimension line', () => {
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50, dimensionOffset: 0 };
			const result = renderer.hitTest( layer, 50, 55 );
			expect( result ).toBe( true );
		} );

		test( 'returns false for point far from dimension line', () => {
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50 };
			const result = renderer.hitTest( layer, 50, 100 );
			expect( result ).toBe( false );
		} );

		test( 'works with diagonal lines', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 100, dimensionOffset: 0 };
			const result = renderer.hitTest( layer, 50, 50 );
			expect( result ).toBe( true );
		} );

		test( 'returns true for point at endpoint', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0 };
			const result = renderer.hitTest( layer, 0, 0 );
			expect( result ).toBe( true );
		} );

		// P1-018 regression: hitTest must account for dimensionOffset
		test( 'returns true for point on offset dimension line (dimensionOffset)', () => {
			// Line from (0,50) to (100,50) with offset 30 means the visible
			// dimension line is drawn at y = 50 - 30 = 20 (perp = (0,-1))
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50, dimensionOffset: 30 };
			const result = renderer.hitTest( layer, 50, 20 );
			expect( result ).toBe( true );
		} );

		test( 'returns false for point on baseline when offset is large (P1-018)', () => {
			// With large offset, baseline itself should NOT be a hit target
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50, dimensionOffset: 80 };
			// Point right on the baseline at (50, 50) should be far from the
			// offset line at y = 50 - 80 = -30
			const result = renderer.hitTest( layer, 50, 50 );
			expect( result ).toBe( false );
		} );

		test( 'returns true for point near extension line (P1-018)', () => {
			// Extension lines go from base points toward the offset dimension line
			// For a horizontal line at y=50 offset by 30, extension from (0,50) to (0,20)
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50, dimensionOffset: 30 };
			// Point near the extension line from (0,50) to (0,20)
			const result = renderer.hitTest( layer, 2, 35 );
			expect( result ).toBe( true );
		} );

		test( 'hitTest works with default offset from extensionGap/Length', () => {
			// Without explicit dimensionOffset, offset = extensionGap + extensionLength/2
			// Default extensionGap=10, extensionLength=10 => offset = 10 + 5 = 15
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50, extensionGap: 10, extensionLength: 10 };
			// Dimension line should be at y = 50 - 15 = 35
			const result = renderer.hitTest( layer, 50, 35 );
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

	describe( 'tolerance formatting', () => {
		test( 'formats symmetric tolerance', () => {
			const layer = { toleranceType: 'symmetric', toleranceValue: 0.5 };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toContain( '±' );
			expect( result ).toContain( '0' );
		} );

		test( 'formats symmetric tolerance with string value', () => {
			const layer = { toleranceType: 'symmetric', toleranceValue: '0.5' };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toContain( '±' );
		} );

		test( 'skips symmetric tolerance when value is 0', () => {
			const layer = { toleranceType: 'symmetric', toleranceValue: 0 };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).not.toContain( '±' );
		} );

		test( 'skips symmetric tolerance when value is NaN', () => {
			const layer = { toleranceType: 'symmetric', toleranceValue: 'invalid' };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).not.toContain( '±' );
		} );

		test( 'formats deviation tolerance', () => {
			const layer = { toleranceType: 'deviation', toleranceUpper: 0.2, toleranceLower: -0.1 };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toContain( '+' );
			expect( result ).toContain( '/' );
		} );

		test( 'formats deviation tolerance with string values', () => {
			const layer = { toleranceType: 'deviation', toleranceUpper: '0.2', toleranceLower: '-0.1' };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toContain( '+' );
			expect( result ).toContain( '/' );
		} );

		test( 'skips deviation tolerance when both are 0', () => {
			const layer = { toleranceType: 'deviation', toleranceUpper: 0, toleranceLower: 0 };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).not.toContain( '/' );
		} );

		test( 'handles deviation tolerance with NaN values', () => {
			const layer = { toleranceType: 'deviation', toleranceUpper: 'invalid', toleranceLower: 'bad' };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toBe( '100 px' );
		} );

		test( 'formats limits tolerance', () => {
			const layer = { toleranceType: 'limits', toleranceUpper: 0.5, toleranceLower: 0.3 };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toContain( '-' );
		} );

		test( 'formats limits tolerance with NaN values', () => {
			const layer = { toleranceType: 'limits', toleranceUpper: 'invalid', toleranceLower: 'bad' };
			const result = renderer.formatMeasurement( 100, layer );
			// Should still work with defaults
			expect( result ).toContain( '-' );
		} );

		test( 'formats basic tolerance type', () => {
			const layer = { toleranceType: 'basic' };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toBe( '100 px' );
		} );

		test( 'formats none tolerance type', () => {
			const layer = { toleranceType: 'none' };
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toBe( '100 px' );
		} );

		test( 'handles undefined tolerance type', () => {
			const layer = {};
			const result = renderer.formatMeasurement( 100, layer );
			expect( result ).toBe( '100 px' );
		} );
	} );

	describe( 'formatUserTextWithTolerance', () => {
		test( 'adds symmetric tolerance to user text', () => {
			const layer = { toleranceType: 'symmetric', toleranceValue: '0.1' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toBe( '25 ±0.1' );
		} );

		test( 'skips symmetric tolerance when no value', () => {
			const layer = { toleranceType: 'symmetric', toleranceValue: '' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toBe( '25' );
		} );

		test( 'adds deviation tolerance to user text', () => {
			const layer = { toleranceType: 'deviation', toleranceUpper: '0.2', toleranceLower: '0.1' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toContain( '+0.2' );
			expect( result ).toContain( '-0.1' );
		} );

		test( 'adds deviation tolerance with existing plus sign', () => {
			const layer = { toleranceType: 'deviation', toleranceUpper: '+0.2', toleranceLower: '-0.1' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toBe( '25 +0.2/-0.1' );
		} );

		test( 'adds deviation tolerance with negative upper', () => {
			const layer = { toleranceType: 'deviation', toleranceUpper: '-0.2', toleranceLower: '0.1' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toContain( '-0.2' );
		} );

		test( 'skips deviation tolerance when both empty', () => {
			const layer = { toleranceType: 'deviation', toleranceUpper: '', toleranceLower: '' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toBe( '25' );
		} );

		test( 'handles deviation with only upper value', () => {
			const layer = { toleranceType: 'deviation', toleranceUpper: '0.2', toleranceLower: '' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toContain( '+0.2' );
			expect( result ).toContain( '-0' );
		} );

		test( 'adds limits tolerance to user text', () => {
			const layer = { toleranceType: 'limits', toleranceUpper: '26', toleranceLower: '24' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toContain( '24 to 26' );
		} );

		test( 'skips limits tolerance when both empty', () => {
			const layer = { toleranceType: 'limits', toleranceUpper: '', toleranceLower: '' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toBe( '25' );
		} );

		test( 'returns text unchanged for basic tolerance', () => {
			const layer = { toleranceType: 'basic' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toBe( '25' );
		} );

		test( 'returns text unchanged for none tolerance', () => {
			const layer = { toleranceType: 'none' };
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toBe( '25' );
		} );

		test( 'returns text unchanged for undefined tolerance type', () => {
			const layer = {};
			const result = renderer.formatUserTextWithTolerance( '25', layer );
			expect( result ).toBe( '25' );
		} );
	} );

	describe( 'buildDisplayText', () => {
		test( 'uses auto-calculated distance when no text', () => {
			const layer = {};
			const result = renderer.buildDisplayText( 100, layer );
			expect( result ).toBe( '100 px' );
		} );

		test( 'uses user-entered text when provided', () => {
			const layer = { text: '25 mm' };
			const result = renderer.buildDisplayText( 100, layer );
			expect( result ).toBe( '25 mm' );
		} );

		test( 'applies tolerance to user-entered text', () => {
			const layer = { text: '25', toleranceType: 'symmetric', toleranceValue: '0.1' };
			const result = renderer.buildDisplayText( 100, layer );
			expect( result ).toBe( '25 ±0.1' );
		} );
	} );

	describe( 'edge cases and error handling', () => {
		test( 'handles invalid strokeWidth', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, strokeWidth: 'invalid' };
			renderer.draw( layer );
			expect( mockCtx.lineWidth ).toBe( 1 ); // Default
		} );

		test( 'handles NaN strokeWidth', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, strokeWidth: NaN };
			renderer.draw( layer );
			expect( mockCtx.lineWidth ).toBe( 1 ); // Default
		} );

		test( 'handles zero strokeWidth', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, strokeWidth: 0 };
			renderer.draw( layer );
			expect( mockCtx.lineWidth ).toBe( 1 ); // Default (0 is invalid)
		} );

		test( 'handles invalid fontSize', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, fontSize: 'invalid' };
			renderer.draw( layer );
			// Should use default fontSize
			expect( mockCtx.font ).toContain( '12px' );
		} );

		test( 'handles NaN fontSize', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, fontSize: NaN };
			renderer.draw( layer );
			expect( mockCtx.font ).toContain( '12px' );
		} );

		test( 'handles invalid extensionLength', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, extensionLength: 'bad' };
			renderer.draw( layer );
			// Should not throw
			expect( mockCtx.save ).toHaveBeenCalled();
		} );

		test( 'handles invalid extensionGap', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, extensionGap: 'bad' };
			renderer.draw( layer );
			// Should not throw
			expect( mockCtx.save ).toHaveBeenCalled();
		} );

		test( 'handles opacity out of range', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, opacity: 2.0 };
			renderer.draw( layer );
			expect( mockCtx.globalAlpha ).toBe( 1 ); // Clamped to max
		} );

		test( 'handles negative opacity', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, opacity: -0.5 };
			renderer.draw( layer );
			expect( mockCtx.globalAlpha ).toBe( 0 ); // Clamped to min
		} );

		test( 'catches and handles draw errors gracefully', () => {
			// Make measureText throw
			mockCtx.measureText = jest.fn( () => {
				throw new Error( 'Test error' );
			} );
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0 };
			// Should not throw
			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );
	} );

	describe( 'line break for center text without background', () => {
		test( 'breaks line at center when no background', () => {
			const layer = {
				x1: 0, y1: 0, x2: 200, y2: 0,
				textPosition: 'center',
				showBackground: false
			};
			renderer.draw( layer );
			// Multiple strokes for broken lines
			expect( mockCtx.stroke.mock.calls.length ).toBeGreaterThan( 2 );
		} );

		test( 'breaks line at center when showBackground is 0 (PHP falsy)', () => {
			const layer = {
				x1: 0, y1: 0, x2: 200, y2: 0,
				textPosition: 'center',
				showBackground: 0
			};
			renderer.draw( layer );
			// Multiple strokes for broken lines
			expect( mockCtx.stroke.mock.calls.length ).toBeGreaterThan( 2 );
		} );

		test( 'draws continuous line at center when background is shown', () => {
			const layer = {
				x1: 0, y1: 0, x2: 200, y2: 0,
				textPosition: 'center',
				showBackground: true
			};
			mockCtx.stroke.mockClear();
			renderer.draw( layer );
			// Continuous line + extension lines = fewer separate strokes
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );
	} );

	describe( 'textDirection handling', () => {
		test( 'draws with auto text direction', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 100, textDirection: 'auto' };
			renderer.draw( layer );
			expect( mockCtx.fillText ).toHaveBeenCalled();
		} );

		test( 'draws with auto-reversed text direction', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 100, textDirection: 'auto-reversed' };
			renderer.draw( layer );
			expect( mockCtx.fillText ).toHaveBeenCalled();
		} );

		test( 'draws with horizontal text direction', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 100, textDirection: 'horizontal' };
			renderer.draw( layer );
			expect( mockCtx.fillText ).toHaveBeenCalled();
		} );
	} );

	describe( 'orientation constraints', () => {
		test( 'draws horizontal orientation correctly', () => {
			const layer = { x1: 0, y1: 50, x2: 100, y2: 50, orientation: 'horizontal' };
			renderer.draw( layer );
			expect( mockCtx.save ).toHaveBeenCalled();
		} );

		test( 'draws vertical orientation correctly', () => {
			const layer = { x1: 50, y1: 0, x2: 50, y2: 100, orientation: 'vertical' };
			renderer.draw( layer );
			expect( mockCtx.save ).toHaveBeenCalled();
		} );

		test( 'draws free orientation correctly', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 100, orientation: 'free' };
			renderer.draw( layer );
			expect( mockCtx.save ).toHaveBeenCalled();
		} );
	} );

	describe( 'basic dimension rendering', () => {
		test( 'draws basic dimension with toleranceType', () => {
			const layer = { x1: 0, y1: 0, x2: 100, y2: 0, toleranceType: 'basic' };
			renderer.draw( layer );
			// Basic type should draw successfully (may or may not call fillText based on implementation)
			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );
	} );
} );
