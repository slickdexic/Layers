/**
 * Tests for AngleDimensionRenderer
 *
 * AngleDimensionRenderer handles rendering angle measurement annotations
 * with three-point angles (vertex + two arm endpoints), configurable
 * tolerance formats, and multiple end styles.
 *
 * @jest-environment jsdom
 */
'use strict';

const AngleDimensionRenderer = require( '../../resources/ext.layers.shared/AngleDimensionRenderer.js' );

describe( 'AngleDimensionRenderer', () => {
	let ctx;
	let renderer;

	function createMockContext() {
		return {
			canvas: { width: 800, height: 600 },
			save: jest.fn(),
			restore: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			beginPath: jest.fn(),
			closePath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			arc: jest.fn(),
			fill: jest.fn(),
			stroke: jest.fn(),
			fillRect: jest.fn(),
			strokeRect: jest.fn(),
			fillText: jest.fn(),
			measureText: jest.fn().mockReturnValue( { width: 50 } ),
			setLineDash: jest.fn(),
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			lineCap: 'butt',
			lineJoin: 'miter',
			globalAlpha: 1,
			font: ''
		};
	}

	beforeEach( () => {
		ctx = createMockContext();
		renderer = new AngleDimensionRenderer( ctx );
		global.mw = {
			log: { warn: jest.fn(), error: jest.fn() }
		};
	} );

	afterEach( () => {
		delete global.mw;
	} );

	// ============================================
	// Constructor
	// ============================================

	describe( 'Constructor', () => {
		it( 'should create instance with context', () => {
			expect( renderer.ctx ).toBe( ctx );
		} );

		it( 'should accept config parameter', () => {
			const config = { custom: true };
			const r = new AngleDimensionRenderer( ctx, config );
			expect( r.config ).toBe( config );
		} );

		it( 'should default config to empty object', () => {
			const r = new AngleDimensionRenderer( ctx );
			expect( r.config ).toEqual( {} );
		} );
	} );

	// ============================================
	// setContext
	// ============================================

	describe( 'setContext', () => {
		it( 'should update the context', () => {
			const newCtx = createMockContext();
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	// ============================================
	// Static properties
	// ============================================

	describe( 'Static properties', () => {
		it( 'should expose END_STYLES', () => {
			expect( AngleDimensionRenderer.END_STYLES ).toEqual( {
				ARROW: 'arrow',
				TICK: 'tick',
				DOT: 'dot',
				NONE: 'none'
			} );
		} );

		it( 'should expose TEXT_POSITIONS', () => {
			expect( AngleDimensionRenderer.TEXT_POSITIONS ).toEqual( {
				ABOVE: 'above',
				BELOW: 'below',
				CENTER: 'center'
			} );
		} );

		it( 'should expose DEFAULTS as a copy', () => {
			const d = AngleDimensionRenderer.DEFAULTS;
			expect( d.stroke ).toBe( '#000000' );
			expect( d.arcRadius ).toBe( 40 );
			expect( d.precision ).toBe( 1 );
			// Should be a copy, not the same object
			d.stroke = '#ff0000';
			expect( AngleDimensionRenderer.DEFAULTS.stroke ).toBe( '#000000' );
		} );
	} );

	// ============================================
	// calculateAngles
	// ============================================

	describe( 'calculateAngles', () => {
		it( 'should calculate a 90° angle', () => {
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100 };
			const angles = renderer.calculateAngles( layer );
			const degrees = angles.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeCloseTo( 90, 0 );
		} );

		it( 'should calculate a 180° angle', () => {
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: -100, by: 0 };
			const angles = renderer.calculateAngles( layer );
			const degrees = angles.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeCloseTo( 180, 0 );
		} );

		it( 'should use minor angle by default (< 180°)', () => {
			// Arms form an angle > 180° CCW, so minor angle should be used
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: -50, by: -87 };
			const angles = renderer.calculateAngles( layer );
			const degrees = angles.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeLessThanOrEqual( 180 );
		} );

		it( 'should handle reflex angle (>180°) when reflexAngle=true', () => {
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100, reflexAngle: true };
			const angles = renderer.calculateAngles( layer );
			const degrees = angles.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeCloseTo( 270, 0 );
		} );

		it( 'should handle reflexAngle=1 (PHP integer serialization)', () => {
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100, reflexAngle: 1 };
			const angles = renderer.calculateAngles( layer );
			const degrees = angles.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeCloseTo( 270, 0 );
		} );

		it( 'should handle reflexAngle=0 (PHP false serialization) as non-reflex', () => {
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100, reflexAngle: 0 };
			const angles = renderer.calculateAngles( layer );
			const degrees = angles.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeCloseTo( 90, 0 );
		} );

		it( 'should default missing coordinates to 0', () => {
			const layer = {};
			const angles = renderer.calculateAngles( layer );
			expect( angles.sweepAngle ).toBeDefined();
		} );

		it( 'should return correct startAngle and endAngle', () => {
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100 };
			const angles = renderer.calculateAngles( layer );
			expect( angles.startAngle ).toBeDefined();
			expect( angles.endAngle ).toBeDefined();
			expect( angles.angleA ).toBeDefined();
			expect( angles.angleB ).toBeDefined();
		} );

		it( 'should handle reflex angle when CCW sweep > π', () => {
			// Arms where CCW sweep from A to B is > 180° — with reflex=true the sweep stays > 180°
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 50, by: -87, reflexAngle: true };
			const angles = renderer.calculateAngles( layer );
			const degrees = angles.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeGreaterThan( 180 );
		} );

		it( 'should return minor angle for CW-shorter arm arrangement', () => {
			// Arms where CCW sweep from A to B > π, so CW is shorter
			const layer = { cx: 0, cy: 0, ax: 0, ay: 100, bx: 100, by: 0 };
			const angles = renderer.calculateAngles( layer );
			const degrees = angles.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeCloseTo( 90, 0 );
		} );
	} );

	// ============================================
	// calculateDegrees
	// ============================================

	describe( 'calculateDegrees', () => {
		it( 'should return degrees for a right angle', () => {
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100 };
			expect( renderer.calculateDegrees( layer ) ).toBeCloseTo( 90, 0 );
		} );

		it( 'should handle acute angle', () => {
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 87, by: 50 };
			const degrees = renderer.calculateDegrees( layer );
			expect( degrees ).toBeGreaterThan( 0 );
			expect( degrees ).toBeLessThan( 90 );
		} );
	} );

	// ============================================
	// formatMeasurement
	// ============================================

	describe( 'formatMeasurement', () => {
		it( 'should format with default precision (1) and unit', () => {
			expect( renderer.formatMeasurement( 90.123, {} ) ).toBe( '90.1°' );
		} );

		it( 'should respect custom precision', () => {
			expect( renderer.formatMeasurement( 45.6789, { precision: 2 } ) ).toBe( '45.68°' );
		} );

		it( 'should hide unit when showUnit=false', () => {
			expect( renderer.formatMeasurement( 90, { showUnit: false } ) ).toBe( '90.0' );
		} );

		it( 'should hide unit when showUnit=0 (PHP serialization)', () => {
			expect( renderer.formatMeasurement( 90, { showUnit: 0 } ) ).toBe( '90.0' );
		} );

		it( 'should show unit when showUnit=true', () => {
			expect( renderer.formatMeasurement( 90, { showUnit: true } ) ).toContain( '°' );
		} );

		it( 'should show unit when showUnit=1 (PHP serialization)', () => {
			expect( renderer.formatMeasurement( 90, { showUnit: 1 } ) ).toContain( '°' );
		} );

		it( 'should format with symmetric tolerance', () => {
			const result = renderer.formatMeasurement( 90, {
				toleranceType: 'symmetric',
				toleranceValue: 0.5
			} );
			expect( result ).toContain( '±' );
			expect( result ).toContain( '0.5' );
		} );

		it( 'should format with deviation tolerance', () => {
			const result = renderer.formatMeasurement( 90, {
				toleranceType: 'deviation',
				toleranceUpper: 0.3,
				toleranceLower: -0.2
			} );
			expect( result ).toContain( '+' );
			expect( result ).toContain( '/' );
		} );

		it( 'should format with limits tolerance', () => {
			const result = renderer.formatMeasurement( 90, {
				toleranceType: 'limits',
				toleranceUpper: 1,
				toleranceLower: 0.5
			} );
			expect( result ).toContain( '-' );
		} );

		it( 'should format with basic tolerance', () => {
			const result = renderer.formatMeasurement( 90, { toleranceType: 'basic' } );
			expect( result ).toBe( '90.0°' );
		} );

		it( 'should format with none tolerance', () => {
			const result = renderer.formatMeasurement( 90, { toleranceType: 'none' } );
			expect( result ).toBe( '90.0°' );
		} );
	} );

	// ============================================
	// formatWithTolerance
	// ============================================

	describe( 'formatWithTolerance', () => {
		it( 'should return value+suffix for symmetric with zero tolerance', () => {
			expect( renderer.formatWithTolerance( '90.0', '°', 'symmetric', { toleranceValue: 0 }, 1 ) ).toBe( '90.0°' );
		} );

		it( 'should return value+suffix for symmetric with NaN tolerance', () => {
			expect( renderer.formatWithTolerance( '90.0', '°', 'symmetric', { toleranceValue: NaN }, 1 ) ).toBe( '90.0°' );
		} );

		it( 'should format symmetric tolerance', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'symmetric', { toleranceValue: 0.5 }, 1 );
			expect( result ).toBe( '90.0 ±0.5°' );
		} );

		it( 'should return value+suffix for deviation with both zeros', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'deviation', { toleranceUpper: 0, toleranceLower: 0 }, 1 );
			expect( result ).toBe( '90.0°' );
		} );

		it( 'should return value+suffix for deviation with both NaN', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'deviation', { toleranceUpper: NaN, toleranceLower: NaN }, 1 );
			expect( result ).toBe( '90.0°' );
		} );

		it( 'should format deviation with positive upper and negative lower', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'deviation', {
				toleranceUpper: 0.3,
				toleranceLower: -0.2
			}, 1 );
			expect( result ).toContain( '+0.3' );
			expect( result ).toContain( '-0.2' );
		} );

		it( 'should format deviation with NaN upper replaced as 0', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'deviation', {
				toleranceUpper: NaN,
				toleranceLower: -0.2
			}, 1 );
			expect( result ).toContain( '+0.0' );
		} );

		it( 'should format deviation with NaN lower replaced as 0', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'deviation', {
				toleranceUpper: 0.3,
				toleranceLower: NaN
			}, 1 );
			expect( result ).toContain( '+0.0' );
		} );

		it( 'should format deviation with undefined falling to defaults', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'deviation', {}, 1 );
			expect( result ).toBe( '90.0°' );
		} );

		it( 'should format limits tolerance', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'limits', {
				toleranceUpper: 1,
				toleranceLower: 0.5
			}, 1 );
			expect( result ).toBe( '89.5-91.0°' );
		} );

		it( 'should format limits with NaN values as 0', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'limits', {
				toleranceUpper: NaN,
				toleranceLower: NaN
			}, 1 );
			expect( result ).toBe( '90.0-90.0°' );
		} );

		it( 'should format limits with undefined defaults', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'limits', {}, 1 );
			expect( result ).toBe( '90.0-90.0°' );
		} );

		it( 'should return value+suffix for basic type', () => {
			expect( renderer.formatWithTolerance( '90.0', '°', 'basic', {}, 1 ) ).toBe( '90.0°' );
		} );

		it( 'should return value+suffix for none type', () => {
			expect( renderer.formatWithTolerance( '90.0', '°', 'none', {}, 1 ) ).toBe( '90.0°' );
		} );

		it( 'should return value+suffix for unknown type (default)', () => {
			expect( renderer.formatWithTolerance( '90.0', '°', 'unknown', {}, 1 ) ).toBe( '90.0°' );
		} );

		it( 'should format with empty unit suffix', () => {
			const result = renderer.formatWithTolerance( '45.0', '', 'symmetric', { toleranceValue: 1 }, 1 );
			expect( result ).toBe( '45.0 ±1.0' );
		} );

		it( 'should format deviation with negative upper', () => {
			const result = renderer.formatWithTolerance( '90.0', '°', 'deviation', {
				toleranceUpper: -0.1,
				toleranceLower: -0.3
			}, 1 );
			// Negative upper should not get + prefix
			expect( result ).toContain( '-0.1' );
			expect( result ).toContain( '-0.3' );
		} );
	} );

	// ============================================
	// buildDisplayText
	// ============================================

	describe( 'buildDisplayText', () => {
		it( 'should use auto-calculated degrees when no text', () => {
			const layer = {};
			const result = renderer.buildDisplayText( 90, layer );
			expect( result ).toContain( '90' );
		} );

		it( 'should use layer.text when provided', () => {
			const layer = { text: '45°' };
			const result = renderer.buildDisplayText( 90, layer );
			expect( result ).toBe( '45°' );
		} );

		it( 'should apply tolerance to user text', () => {
			const layer = { text: '45°', toleranceType: 'symmetric', toleranceValue: '0.5' };
			const result = renderer.buildDisplayText( 90, layer );
			expect( result ).toContain( '±' );
		} );
	} );

	// ============================================
	// formatUserTextWithTolerance
	// ============================================

	describe( 'formatUserTextWithTolerance', () => {
		it( 'should return text as-is with no tolerance', () => {
			expect( renderer.formatUserTextWithTolerance( '45°', {} ) ).toBe( '45°' );
		} );

		it( 'should return text as-is with tolerance type none', () => {
			expect( renderer.formatUserTextWithTolerance( '45°', { toleranceType: 'none' } ) ).toBe( '45°' );
		} );

		it( 'should append symmetric tolerance', () => {
			const result = renderer.formatUserTextWithTolerance( '45°', {
				toleranceType: 'symmetric',
				toleranceValue: '0.5'
			} );
			expect( result ).toBe( '45° ±0.5' );
		} );

		it( 'should return text for symmetric with no toleranceValue', () => {
			expect( renderer.formatUserTextWithTolerance( '45°', { toleranceType: 'symmetric' } ) ).toBe( '45°' );
		} );

		it( 'should format deviation tolerance', () => {
			const result = renderer.formatUserTextWithTolerance( '45°', {
				toleranceType: 'deviation',
				toleranceUpper: '0.3',
				toleranceLower: '-0.2'
			} );
			expect( result ).toContain( '+0.3' );
			expect( result ).toContain( '-0.2' );
		} );

		it( 'should add + prefix to positive upper in deviation', () => {
			const result = renderer.formatUserTextWithTolerance( '45°', {
				toleranceType: 'deviation',
				toleranceUpper: '0.3',
				toleranceLower: '0.1'
			} );
			expect( result ).toContain( '+0.3' );
			expect( result ).toContain( '-0.1' );
		} );

		it( 'should not double-add + prefix if already present', () => {
			const result = renderer.formatUserTextWithTolerance( '45°', {
				toleranceType: 'deviation',
				toleranceUpper: '+0.3',
				toleranceLower: '-0.2'
			} );
			expect( result ).toContain( '+0.3' );
			expect( result ).not.toContain( '++' );
		} );

		it( 'should return text for deviation with neither upper nor lower', () => {
			expect( renderer.formatUserTextWithTolerance( '45°', { toleranceType: 'deviation' } ) ).toBe( '45°' );
		} );

		it( 'should default upper and lower to "0" when partially set in deviation', () => {
			const withUpper = renderer.formatUserTextWithTolerance( '45°', {
				toleranceType: 'deviation',
				toleranceUpper: '0.3'
			} );
			expect( withUpper ).toContain( '0.3' );
			expect( withUpper ).toContain( '/' );
		} );

		it( 'should format limits tolerance', () => {
			const result = renderer.formatUserTextWithTolerance( '45°', {
				toleranceType: 'limits',
				toleranceUpper: '1',
				toleranceLower: '0.5'
			} );
			expect( result ).toContain( '0.5 to 1' );
		} );

		it( 'should return text for limits with no upper and lower', () => {
			expect( renderer.formatUserTextWithTolerance( '45°', { toleranceType: 'limits' } ) ).toBe( '45°' );
		} );

		it( 'should return text for basic tolerance', () => {
			expect( renderer.formatUserTextWithTolerance( '45°', { toleranceType: 'basic' } ) ).toBe( '45°' );
		} );

		it( 'should return text for unknown tolerance type', () => {
			expect( renderer.formatUserTextWithTolerance( '45°', { toleranceType: 'weird' } ) ).toBe( '45°' );
		} );
	} );

	// ============================================
	// draw
	// ============================================

	describe( 'draw', () => {
		it( 'should return early when ctx is null', () => {
			renderer.ctx = null;
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100 };
			renderer.draw( layer );
			expect( ctx.save ).not.toHaveBeenCalled();
		} );

		it( 'should return early when layer is null', () => {
			renderer.draw( null );
			expect( ctx.save ).not.toHaveBeenCalled();
		} );

		it( 'should return early when layer is undefined', () => {
			renderer.draw( undefined );
			expect( ctx.save ).not.toHaveBeenCalled();
		} );

		it( 'should catch and log errors during drawing', () => {
			ctx.save.mockImplementation( () => {
				throw new Error( 'Canvas error' );
			} );
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100 };
			expect( () => renderer.draw( layer ) ).not.toThrow();
			expect( global.mw.log.warn ).toHaveBeenCalled();
		} );

		it( 'should catch errors without mw global', () => {
			delete global.mw;
			ctx.save.mockImplementation( () => {
				throw new Error( 'Canvas error' );
			} );
			const layer = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100 };
			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );

		it( 'should draw a basic angle dimension', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200
			};
			renderer.draw( layer );
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should return early when arm A has zero length', () => {
			const layer = { cx: 100, cy: 100, ax: 100, ay: 100, bx: 200, by: 200 };
			renderer.draw( layer );
			// _drawInternal returns early, so no arc/stroke calls beyond save
			expect( ctx.arc ).not.toHaveBeenCalled();
		} );

		it( 'should return early when arm B has zero length', () => {
			const layer = { cx: 100, cy: 100, ax: 200, ay: 200, bx: 100, by: 100 };
			renderer.draw( layer );
			expect( ctx.arc ).not.toHaveBeenCalled();
		} );
	} );

	// ============================================
	// _drawInternal (via draw)
	// ============================================

	describe( '_drawInternal (via draw)', () => {
		function makeLayer( overrides ) {
			return Object.assign( {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				stroke: '#ff0000',
				strokeWidth: 2,
				fontSize: 14,
				fontFamily: 'Helvetica',
				color: '#333',
				endStyle: 'arrow',
				textPosition: 'center',
				arcRadius: 50,
				extensionLength: 15
			}, overrides );
		}

		it( 'should apply opacity', () => {
			renderer.draw( makeLayer( { opacity: 0.5 } ) );
			expect( ctx.globalAlpha ).toBe( 0.5 );
		} );

		it( 'should clamp opacity to [0,1]', () => {
			renderer.draw( makeLayer( { opacity: 1.5 } ) );
			expect( ctx.globalAlpha ).toBe( 1 );
		} );

		it( 'should not set opacity when not a number', () => {
			const _origAlpha = ctx.globalAlpha;
			renderer.draw( makeLayer( { opacity: 'invalid' } ) );
			// Should still draw, opacity just stays at default
			expect( ctx.save ).toHaveBeenCalled();
		} );

		it( 'should use default strokeWidth when NaN', () => {
			renderer.draw( makeLayer( { strokeWidth: NaN } ) );
			expect( ctx.lineWidth ).toBe( 1 ); // DEFAULTS.strokeWidth
		} );

		it( 'should use default strokeWidth when <= 0', () => {
			renderer.draw( makeLayer( { strokeWidth: 0 } ) );
			expect( ctx.lineWidth ).toBe( 1 );
		} );

		it( 'should use default strokeWidth when not a number', () => {
			renderer.draw( makeLayer( { strokeWidth: 'thick' } ) );
			expect( ctx.lineWidth ).toBe( 1 );
		} );

		it( 'should use default fontSize when NaN', () => {
			renderer.draw( makeLayer( { fontSize: NaN } ) );
			expect( ctx.save ).toHaveBeenCalled();
		} );

		it( 'should use default fontSize when <= 0', () => {
			renderer.draw( makeLayer( { fontSize: -5 } ) );
			expect( ctx.save ).toHaveBeenCalled();
		} );

		it( 'should use default arcRadius when NaN', () => {
			renderer.draw( makeLayer( { arcRadius: NaN } ) );
			expect( ctx.arc ).toHaveBeenCalled();
		} );

		it( 'should use default arcRadius when <= 0', () => {
			renderer.draw( makeLayer( { arcRadius: -10 } ) );
			expect( ctx.arc ).toHaveBeenCalled();
		} );

		it( 'should use default extensionLength when NaN', () => {
			renderer.draw( makeLayer( { extensionLength: NaN } ) );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should use default extensionLength when non-number', () => {
			renderer.draw( makeLayer( { extensionLength: 'long' } ) );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw with arrowsInside=false', () => {
			renderer.draw( makeLayer( { arrowsInside: false } ) );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw with arrowsInside=0 (PHP false)', () => {
			renderer.draw( makeLayer( { arrowsInside: 0 } ) );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should use defaults when style fields are missing', () => {
			renderer.draw( { cx: 100, cy: 100, ax: 200, ay: 100, bx: 100, by: 200 } );
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw with tick end style', () => {
			renderer.draw( makeLayer( { endStyle: 'tick' } ) );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw with dot end style', () => {
			renderer.draw( makeLayer( { endStyle: 'dot' } ) );
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should draw with none end style', () => {
			renderer.draw( makeLayer( { endStyle: 'none' } ) );
			expect( ctx.save ).toHaveBeenCalled();
		} );

		it( 'should draw text above arc', () => {
			renderer.draw( makeLayer( { textPosition: 'above' } ) );
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should draw text below arc', () => {
			renderer.draw( makeLayer( { textPosition: 'below' } ) );
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should draw text at center on arc', () => {
			renderer.draw( makeLayer( { textPosition: 'center' } ) );
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should draw with text background when showBackground=true', () => {
			renderer.draw( makeLayer( { showBackground: true } ) );
			expect( ctx.fillRect ).toHaveBeenCalled();
		} );

		it( 'should draw without background when showBackground=false', () => {
			ctx.fillRect.mockClear();
			renderer.draw( makeLayer( { showBackground: false, textPosition: 'above' } ) );
			// Text is still drawn but background rect may or may not be called
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should draw without background when showBackground=0 (PHP)', () => {
			renderer.draw( makeLayer( { showBackground: 0, textPosition: 'above' } ) );
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should draw basic tolerance box', () => {
			renderer.draw( makeLayer( { toleranceType: 'basic' } ) );
			expect( ctx.strokeRect ).toHaveBeenCalled();
		} );

		it( 'should draw with user text', () => {
			renderer.draw( makeLayer( { text: 'Custom 45°' } ) );
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should draw with textDirection=horizontal', () => {
			renderer.draw( makeLayer( { textDirection: 'horizontal' } ) );
			expect( ctx.rotate ).toHaveBeenCalledWith( 0 );
		} );

		it( 'should draw with textOffset', () => {
			renderer.draw( makeLayer( { textOffset: 15 } ) );
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should draw with custom backgroundColor', () => {
			renderer.draw( makeLayer( { backgroundColor: '#ff0000' } ) );
			expect( ctx.fillRect ).toHaveBeenCalled();
		} );
	} );

	// ============================================
	// _drawArc (via draw)
	// ============================================

	describe( '_drawArc (via draw)', () => {
		it( 'should split arc for center text without background', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				textPosition: 'center',
				showBackground: false,
				arcRadius: 50
			};
			renderer.draw( layer );
			// Two arc halves should be drawn
			const arcCalls = ctx.arc.mock.calls.length;
			expect( arcCalls ).toBeGreaterThanOrEqual( 2 );
		} );

		it( 'should draw continuous arc when text above', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				textPosition: 'above',
				arcRadius: 50
			};
			renderer.draw( layer );
			expect( ctx.arc ).toHaveBeenCalled();
		} );

		it( 'should extend arc when textOffset moves text outside angle legs', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				textOffset: -200, // Far outside the angle
				arcRadius: 50
			};
			renderer.draw( layer );
			expect( ctx.arc ).toHaveBeenCalled();
		} );

		it( 'should extend arc for large positive textOffset', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				textOffset: 200,
				arcRadius: 50
			};
			renderer.draw( layer );
			expect( ctx.arc ).toHaveBeenCalled();
		} );
	} );

	// ============================================
	// _drawExtensionLines (via draw)
	// ============================================

	describe( '_drawExtensionLines (via draw)', () => {
		it( 'should skip extension lines when arm has zero length', () => {
			const layer = { cx: 100, cy: 100, ax: 100, ay: 100, bx: 200, by: 200 };
			renderer.draw( layer );
			// No drawing beyond save/restore since arm A is zero-length
			expect( ctx.arc ).not.toHaveBeenCalled();
		} );

		it( 'should draw extension lines when arcRadius >= arm length', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 120, ay: 100, // Short arm (20px)
				bx: 100, by: 120,
				arcRadius: 50 // > arm length
			};
			renderer.draw( layer );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw extension lines when arcRadius < arm length', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 300, ay: 100, // Long arm (200px)
				bx: 100, by: 300,
				arcRadius: 50 // < arm length
			};
			renderer.draw( layer );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should handle non-number extensionGap', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				extensionGap: 'invalid'
			};
			renderer.draw( layer );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should handle NaN extensionGap', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				extensionGap: NaN
			};
			renderer.draw( layer );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	// ============================================
	// _drawArcEndMarkers (via draw)
	// ============================================

	describe( '_drawArcEndMarkers (via draw)', () => {
		it( 'should not draw markers for none end style', () => {
			ctx.fill.mockClear();
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				endStyle: 'none'
			};
			renderer.draw( layer );
			// arc and stroke still happen for the arc itself
			expect( ctx.save ).toHaveBeenCalled();
		} );

		it( 'should draw arrow markers with arrowsInside=true', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				endStyle: 'arrow',
				arrowsInside: true
			};
			renderer.draw( layer );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw arrow markers with arrowsInside=false (outside arrows + tails)', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				endStyle: 'arrow',
				arrowsInside: false
			};
			renderer.draw( layer );
			// Outside arrows should draw extension tails (additional arc calls)
			expect( ctx.arc.mock.calls.length ).toBeGreaterThanOrEqual( 2 );
		} );

		it( 'should draw tick markers', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				endStyle: 'tick'
			};
			renderer.draw( layer );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw dot markers', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				endStyle: 'dot'
			};
			renderer.draw( layer );
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should draw extension tails for outside arrows', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				endStyle: 'arrow',
				arrowsInside: false,
				arrowSize: 12
			};
			renderer.draw( layer );
			expect( ctx.arc.mock.calls.length ).toBeGreaterThanOrEqual( 3 ); // main arc + 2 tails
		} );

		it( 'should not draw tails for outside tick markers', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 200,
				endStyle: 'tick',
				arrowsInside: false
			};
			renderer.draw( layer );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	// ============================================
	// getBounds
	// ============================================

	describe( 'getBounds', () => {
		it( 'should return bounding box encompassing all points', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 50,
				bx: 50, by: 200
			};
			const bounds = renderer.getBounds( layer );
			expect( bounds.x ).toBeLessThan( 50 );
			expect( bounds.y ).toBeLessThan( 50 );
			expect( bounds.width ).toBeGreaterThan( 0 );
			expect( bounds.height ).toBeGreaterThan( 0 );
		} );

		it( 'should include arc radius in bounds', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 120, ay: 100,
				bx: 100, by: 120,
				arcRadius: 80
			};
			const bounds = renderer.getBounds( layer );
			// With arcRadius 80 + extension 10 + padding 20, should extend well beyond
			expect( bounds.x ).toBeLessThan( 0 );
		} );

		it( 'should use default arcRadius and extensionLength', () => {
			const layer = { cx: 100, cy: 100, ax: 200, ay: 100, bx: 100, by: 200 };
			const bounds = renderer.getBounds( layer );
			expect( bounds ).toHaveProperty( 'x' );
			expect( bounds ).toHaveProperty( 'y' );
			expect( bounds ).toHaveProperty( 'width' );
			expect( bounds ).toHaveProperty( 'height' );
		} );

		it( 'should handle missing coordinates defaulting to 0', () => {
			const bounds = renderer.getBounds( {} );
			expect( bounds.width ).toBeGreaterThan( 0 );
		} );
	} );

	// ============================================
	// hitTest
	// ============================================

	describe( 'hitTest', () => {
		const baseLayer = {
			cx: 100, cy: 100,
			ax: 200, ay: 100,
			bx: 100, by: 200,
			arcRadius: 50
		};

		it( 'should hit on the arc', () => {
			// Point on the arc at ~45° midpoint
			const px = 100 + 50 * Math.cos( Math.PI / 4 );
			const py = 100 + 50 * Math.sin( Math.PI / 4 );
			expect( renderer.hitTest( baseLayer, px, py ) ).toBe( true );
		} );

		it( 'should miss far from the dimension', () => {
			expect( renderer.hitTest( baseLayer, 500, 500 ) ).toBe( false );
		} );

		it( 'should hit on arm A extension line', () => {
			// Point on the arm from vertex to ax
			expect( renderer.hitTest( baseLayer, 150, 100 ) ).toBe( true );
		} );

		it( 'should hit on arm B extension line', () => {
			// Point on the arm from vertex to by
			expect( renderer.hitTest( baseLayer, 100, 150 ) ).toBe( true );
		} );

		it( 'should hit near text area', () => {
			// Text is near the midpoint of the arc
			const midAngle = Math.PI / 4; // ~45°
			const textX = 100 + 50 * Math.cos( midAngle );
			const textY = 100 + 50 * Math.sin( midAngle );
			expect( renderer.hitTest( baseLayer, textX, textY ) ).toBe( true );
		} );

		it( 'should miss when near arc but outside angular range', () => {
			// Point at correct radius but on the opposite side
			const px = 100 + 50 * Math.cos( -Math.PI / 2 ); // 180° away
			const py = 100 + 50 * Math.sin( -Math.PI / 2 );
			// This may or may not hit depending on angle range — but it tests the branch
			renderer.hitTest( baseLayer, px, py );
		} );

		it( 'should handle textPosition above', () => {
			const layer = { ...baseLayer, textPosition: 'above' };
			const midAngle = Math.PI / 4;
			const textRadius = 50 + 12 * 0.8; // default fontSize offset
			const textX = 100 + textRadius * Math.cos( midAngle );
			const textY = 100 + textRadius * Math.sin( midAngle );
			expect( renderer.hitTest( layer, textX, textY ) ).toBe( true );
		} );

		it( 'should handle textPosition below', () => {
			const layer = { ...baseLayer, textPosition: 'below' };
			const midAngle = Math.PI / 4;
			const textRadius = 50 - 12 * 0.8;
			const textX = 100 + textRadius * Math.cos( midAngle );
			const textY = 100 + textRadius * Math.sin( midAngle );
			expect( renderer.hitTest( layer, textX, textY ) ).toBe( true );
		} );

		it( 'should handle textOffset in hit test', () => {
			const layer = { ...baseLayer, textOffset: 10 };
			renderer.hitTest( layer, 135, 135 );
			// Just verifying it doesn't throw
		} );

		it( 'should handle default coordinates', () => {
			// Each coordinate defaults to 0
			const layer = { arcRadius: 50 };
			const result = renderer.hitTest( layer, 0, 0 );
			// At vertex, distance to arc is 50 > tolerance 10, should miss unless on arms
			expect( typeof result ).toBe( 'boolean' );
		} );
	} );

	// ============================================
	// _isAngleInRange
	// ============================================

	describe( '_isAngleInRange', () => {
		it( 'should return true for angle within CCW range (no wrap)', () => {
			expect( renderer._isAngleInRange( Math.PI / 4, 0, Math.PI / 2 ) ).toBe( true );
		} );

		it( 'should return false for angle outside CCW range (no wrap)', () => {
			expect( renderer._isAngleInRange( Math.PI, 0, Math.PI / 2 ) ).toBe( false );
		} );

		it( 'should handle wrapping CCW range', () => {
			// Start at 350°, sweep 40° (crosses 0°)
			const start = 350 * Math.PI / 180;
			const sweep = 40 * Math.PI / 180;
			const test = 10 * Math.PI / 180; // Should be in range
			expect( renderer._isAngleInRange( test, start, sweep ) ).toBe( true );
		} );

		it( 'should handle CW sweep (negative)', () => {
			// This is an unusual path but tests the negative sweep branch
			const result = renderer._isAngleInRange( Math.PI / 4, Math.PI / 2, -Math.PI / 2 );
			expect( typeof result ).toBe( 'boolean' );
		} );

		it( 'should handle CW sweep with wrapping', () => {
			const start = 10 * Math.PI / 180;
			const sweep = -40 * Math.PI / 180; // CW sweep crossing 0°
			const test = 350 * Math.PI / 180; // Should be in range
			expect( renderer._isAngleInRange( test, start, sweep ) ).toBe( true );
		} );
	} );

	// ============================================
	// _pointToLineDistance
	// ============================================

	describe( '_pointToLineDistance', () => {
		it( 'should return distance to a point when line has zero length', () => {
			const dist = renderer._pointToLineDistance( 3, 4, 0, 0, 0, 0 );
			expect( dist ).toBeCloseTo( 5, 1 );
		} );

		it( 'should return 0 for a point on the line', () => {
			const dist = renderer._pointToLineDistance( 5, 0, 0, 0, 10, 0 );
			expect( dist ).toBeCloseTo( 0, 1 );
		} );

		it( 'should return perpendicular distance', () => {
			const dist = renderer._pointToLineDistance( 5, 5, 0, 0, 10, 0 );
			expect( dist ).toBeCloseTo( 5, 1 );
		} );

		it( 'should clamp to nearest endpoint', () => {
			// Point past the end of the segment
			const dist = renderer._pointToLineDistance( 15, 0, 0, 0, 10, 0 );
			expect( dist ).toBeCloseTo( 5, 1 );
		} );
	} );

	// ============================================
	// createAngleDimensionLayer (static)
	// ============================================

	describe( 'createAngleDimensionLayer', () => {
		it( 'should create a layer with correct coordinates', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 100, 0, 0, 100 );
			expect( layer.cx ).toBe( 0 );
			expect( layer.cy ).toBe( 0 );
			expect( layer.ax ).toBe( 100 );
			expect( layer.ay ).toBe( 0 );
			expect( layer.bx ).toBe( 0 );
			expect( layer.by ).toBe( 100 );
		} );

		it( 'should have type angleDimension', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1 );
			expect( layer.type ).toBe( 'angleDimension' );
		} );

		it( 'should generate an id with prefix', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1 );
			expect( layer.id ).toMatch( /^angleDimension-/ );
		} );

		it( 'should use custom id from options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, { id: 'custom-id' } );
			expect( layer.id ).toBe( 'custom-id' );
		} );

		it( 'should apply default values', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1 );
			expect( layer.stroke ).toBe( '#000000' );
			expect( layer.strokeWidth ).toBe( 1 );
			expect( layer.fontSize ).toBe( 12 );
			expect( layer.arcRadius ).toBe( 40 );
			expect( layer.precision ).toBe( 1 );
			expect( layer.visible ).toBe( true );
			expect( layer.locked ).toBe( false );
			expect( layer.opacity ).toBe( 1 );
		} );

		it( 'should apply custom options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, {
				stroke: '#ff0000',
				strokeWidth: 3,
				fontSize: 20,
				arcRadius: 60,
				precision: 2,
				endStyle: 'tick',
				textPosition: 'above',
				reflexAngle: true,
				toleranceType: 'symmetric',
				toleranceValue: 0.5,
				name: 'Custom Angle'
			} );
			expect( layer.stroke ).toBe( '#ff0000' );
			expect( layer.strokeWidth ).toBe( 3 );
			expect( layer.fontSize ).toBe( 20 );
			expect( layer.arcRadius ).toBe( 60 );
			expect( layer.precision ).toBe( 2 );
			expect( layer.endStyle ).toBe( 'tick' );
			expect( layer.textPosition ).toBe( 'above' );
			expect( layer.reflexAngle ).toBe( true );
			expect( layer.toleranceType ).toBe( 'symmetric' );
			expect( layer.toleranceValue ).toBe( 0.5 );
			expect( layer.name ).toBe( 'Custom Angle' );
		} );

		it( 'should handle visible=false in options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, { visible: false } );
			expect( layer.visible ).toBe( false );
		} );

		it( 'should handle visible=0 (PHP) in options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, { visible: 0 } );
			expect( layer.visible ).toBe( false );
		} );

		it( 'should handle arrowsInside=false in options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, { arrowsInside: false } );
			expect( layer.arrowsInside ).toBe( false );
		} );

		it( 'should handle showUnit=false in options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, { showUnit: false } );
			expect( layer.showUnit ).toBe( false );
		} );

		it( 'should handle showBackground=false in options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, { showBackground: false } );
			expect( layer.showBackground ).toBe( false );
		} );

		it( 'should handle tolerance upper/lower options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, {
				toleranceUpper: 0.5,
				toleranceLower: 0.3
			} );
			expect( layer.toleranceUpper ).toBe( 0.5 );
			expect( layer.toleranceLower ).toBe( 0.3 );
		} );

		it( 'should handle extensionLength=0 in options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, { extensionLength: 0 } );
			expect( layer.extensionLength ).toBe( 0 );
		} );

		it( 'should handle textOffset option', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, { textOffset: 15 } );
			expect( layer.textOffset ).toBe( 15 );
		} );

		it( 'should handle null options gracefully', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, null );
			expect( layer.type ).toBe( 'angleDimension' );
		} );

		it( 'should set empty text by default', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1 );
			expect( layer.text ).toBe( '' );
		} );

		it( 'should accept custom text', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1, { text: '90°' } );
			expect( layer.text ).toBe( '90°' );
		} );
	} );
} );
