/**
 * AngleDimensionRenderer Unit Tests
 *
 * Tests for the AngleDimensionRenderer module that renders angle measurement
 * annotations with arc, extension lines, and auto-calculated angle values.
 */
'use strict';

const AngleDimensionRenderer = require( '../../../resources/ext.layers.shared/AngleDimensionRenderer.js' );

describe( 'AngleDimensionRenderer', () => {
	let renderer;
	let mockCtx;

	beforeEach( () => {
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

		renderer = new AngleDimensionRenderer( mockCtx );
	} );

	afterEach( () => {
		renderer = null;
		mockCtx = null;
	} );

	describe( 'constructor', () => {
		test( 'creates instance with context', () => {
			expect( renderer ).toBeInstanceOf( AngleDimensionRenderer );
			expect( renderer.ctx ).toBe( mockCtx );
		} );

		test( 'creates instance without context', () => {
			const noCtxRenderer = new AngleDimensionRenderer( null );
			expect( noCtxRenderer ).toBeInstanceOf( AngleDimensionRenderer );
			expect( noCtxRenderer.ctx ).toBeNull();
		} );

		test( 'accepts config object', () => {
			const config = { someOption: true };
			const configRenderer = new AngleDimensionRenderer( mockCtx, config );
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

	describe( 'calculateAngles', () => {
		test( 'calculates 90° right angle', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100, // right (0°)
				bx: 100, by: 0   // up (−90° → 270°)
			};
			const result = renderer.calculateAngles( layer );
			const degrees = result.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeCloseTo( 90, 0 );
		} );

		test( 'calculates 45° angle', () => {
			const layer = {
				cx: 0, cy: 0,
				ax: 100, ay: 0,   // right (0°)
				bx: 70.7, by: -70.7 // 45° up-right
			};
			const result = renderer.calculateAngles( layer );
			const degrees = result.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeCloseTo( 45, 0 );
		} );

		test( 'calculates 180° straight angle', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100, // right
				bx: 0, by: 100    // left
			};
			const result = renderer.calculateAngles( layer );
			const degrees = result.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeCloseTo( 180, 0 );
		} );

		test( 'returns minor angle by default for obtuse angles', () => {
			const layer = {
				cx: 0, cy: 0,
				ax: 100, ay: 0,    // right (0°)
				bx: -100, by: -100 // upper-left (225°)
			};
			const result = renderer.calculateAngles( layer );
			const degrees = result.sweepAngle * ( 180 / Math.PI );
			// Should return the minor angle (≤180°)
			expect( degrees ).toBeLessThanOrEqual( 180 );
		} );

		test( 'returns reflex angle when requested', () => {
			const layer = {
				cx: 0, cy: 0,
				ax: 100, ay: 0,    // right (0°)
				bx: 0, by: -100,   // up (270° from positive x-axis in screen coords)
				reflexAngle: true
			};
			const result = renderer.calculateAngles( layer );
			const degrees = result.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeGreaterThan( 180 );
		} );

		test( 'handles reflex angle with integer 1 (PHP serialization)', () => {
			const layer = {
				cx: 0, cy: 0,
				ax: 100, ay: 0,
				bx: 0, by: -100,
				reflexAngle: 1
			};
			const result = renderer.calculateAngles( layer );
			const degrees = result.sweepAngle * ( 180 / Math.PI );
			expect( degrees ).toBeGreaterThan( 180 );
		} );

		test( 'handles zero-length arms gracefully', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 100, ay: 100,
				bx: 100, by: 100
			};
			// Should not throw
			const result = renderer.calculateAngles( layer );
			expect( result ).toBeDefined();
			expect( typeof result.sweepAngle ).toBe( 'number' );
		} );

		test( 'handles missing coordinates with defaults', () => {
			const layer = {};
			const result = renderer.calculateAngles( layer );
			expect( result ).toBeDefined();
			expect( typeof result.startAngle ).toBe( 'number' );
			expect( typeof result.endAngle ).toBe( 'number' );
		} );
	} );

	describe( 'calculateDegrees', () => {
		test( 'returns angle in degrees', () => {
			const layer = {
				cx: 0, cy: 0,
				ax: 100, ay: 0,
				bx: 0, by: -100
			};
			const degrees = renderer.calculateDegrees( layer );
			expect( degrees ).toBeCloseTo( 90, 0 );
		} );

		test( 'returns 0 for coincident arms', () => {
			const layer = {
				cx: 0, cy: 0,
				ax: 100, ay: 0,
				bx: 100, by: 0
			};
			const degrees = renderer.calculateDegrees( layer );
			expect( degrees ).toBeCloseTo( 0, 0 );
		} );
	} );

	describe( 'formatMeasurement', () => {
		test( 'formats angle with default settings', () => {
			const result = renderer.formatMeasurement( 45, {} );
			expect( result ).toBe( '45.0°' );
		} );

		test( 'formats angle with custom precision', () => {
			const result = renderer.formatMeasurement( 45.678, { precision: 2 } );
			expect( result ).toBe( '45.68°' );
		} );

		test( 'formats angle with 0 precision', () => {
			const result = renderer.formatMeasurement( 45.678, { precision: 0 } );
			expect( result ).toBe( '46°' );
		} );

		test( 'hides unit when showUnit is false', () => {
			const result = renderer.formatMeasurement( 90, { showUnit: false } );
			expect( result ).toBe( '90.0' );
		} );

		test( 'hides unit when showUnit is 0 (PHP serialization)', () => {
			const result = renderer.formatMeasurement( 90, { showUnit: 0 } );
			expect( result ).toBe( '90.0' );
		} );
	} );

	describe( 'formatWithTolerance', () => {
		test( 'symmetric tolerance adds ± symbol', () => {
			const result = renderer.formatWithTolerance(
				'45.0', '°', 'symmetric', { toleranceValue: 0.5 }, 1
			);
			expect( result ).toBe( '45.0 ±0.5°' );
		} );

		test( 'symmetric tolerance with zero value returns plain', () => {
			const result = renderer.formatWithTolerance(
				'45.0', '°', 'symmetric', { toleranceValue: 0 }, 1
			);
			expect( result ).toBe( '45.0°' );
		} );

		test( 'deviation tolerance shows upper/lower', () => {
			const result = renderer.formatWithTolerance(
				'90.0', '°', 'deviation', { toleranceUpper: 0.5, toleranceLower: -0.3 }, 1
			);
			expect( result ).toContain( '+0.5' );
			expect( result ).toContain( '-0.3' );
		} );

		test( 'limits tolerance shows min-max range', () => {
			const result = renderer.formatWithTolerance(
				'90.0', '°', 'limits', { toleranceUpper: 1, toleranceLower: 0.5 }, 1
			);
			expect( result ).toContain( '89.5' ); // 90 - 0.5
			expect( result ).toContain( '91.0' ); // 90 + 1
		} );

		test( 'basic tolerance returns value as-is', () => {
			const result = renderer.formatWithTolerance( '45.0', '°', 'basic', {}, 1 );
			expect( result ).toBe( '45.0°' );
		} );

		test( 'none tolerance returns value with unit', () => {
			const result = renderer.formatWithTolerance( '45.0', '°', 'none', {}, 1 );
			expect( result ).toBe( '45.0°' );
		} );
	} );

	describe( 'buildDisplayText', () => {
		test( 'uses auto-calculated value when no text override', () => {
			const result = renderer.buildDisplayText( 45, {} );
			expect( result ).toBe( '45.0°' );
		} );

		test( 'uses custom text when provided', () => {
			const result = renderer.buildDisplayText( 45, { text: '30°' } );
			expect( result ).toBe( '30°' );
		} );

		test( 'appends tolerance to custom text', () => {
			const result = renderer.buildDisplayText( 45, {
				text: '45°',
				toleranceType: 'symmetric',
				toleranceValue: '0.5'
			} );
			expect( result ).toContain( '45°' );
			expect( result ).toContain( '±' );
		} );
	} );

	describe( 'formatUserTextWithTolerance', () => {
		test( 'symmetric tolerance appends ±value', () => {
			const result = renderer.formatUserTextWithTolerance( '45°', {
				toleranceType: 'symmetric',
				toleranceValue: '0.5'
			} );
			expect( result ).toBe( '45° ±0.5' );
		} );

		test( 'deviation tolerance appends upper/lower', () => {
			const result = renderer.formatUserTextWithTolerance( '90°', {
				toleranceType: 'deviation',
				toleranceUpper: '0.5',
				toleranceLower: '0.3'
			} );
			expect( result ).toContain( '+0.5' );
			expect( result ).toContain( '-0.3' );
		} );

		test( 'limits tolerance appends range', () => {
			const result = renderer.formatUserTextWithTolerance( '45°', {
				toleranceType: 'limits',
				toleranceUpper: '1',
				toleranceLower: '0.5'
			} );
			expect( result ).toContain( '0.5' );
			expect( result ).toContain( '1' );
		} );

		test( 'no tolerance returns text unchanged', () => {
			const result = renderer.formatUserTextWithTolerance( '45°', { toleranceType: 'none' } );
			expect( result ).toBe( '45°' );
		} );

		test( 'missing toleranceType returns text unchanged', () => {
			const result = renderer.formatUserTextWithTolerance( '45°', {} );
			expect( result ).toBe( '45°' );
		} );
	} );

	describe( 'draw', () => {
		const makeLayer = ( overrides ) => ( {
			type: 'angleDimension',
			cx: 200, cy: 200,
			ax: 300, ay: 200,
			bx: 200, by: 100,
			...overrides
		} );

		test( 'calls ctx.save and ctx.restore', () => {
			renderer.draw( makeLayer() );
			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		test( 'draws extension lines', () => {
			renderer.draw( makeLayer() );
			// Extension lines call moveTo + lineTo + stroke
			expect( mockCtx.moveTo ).toHaveBeenCalled();
			expect( mockCtx.lineTo ).toHaveBeenCalled();
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws arc', () => {
			renderer.draw( makeLayer() );
			expect( mockCtx.arc ).toHaveBeenCalled();
		} );

		test( 'draws text', () => {
			renderer.draw( makeLayer() );
			expect( mockCtx.fillText ).toHaveBeenCalled();
		} );

		test( 'applies opacity', () => {
			renderer.draw( makeLayer( { opacity: 0.5 } ) );
			expect( mockCtx.globalAlpha ).toBe( 0.5 );
		} );

		test( 'clamps opacity to valid range', () => {
			renderer.draw( makeLayer( { opacity: -0.5 } ) );
			expect( mockCtx.globalAlpha ).toBe( 0 );
		} );

		test( 'does not draw with null context', () => {
			renderer.setContext( null );
			renderer.draw( makeLayer() );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		test( 'does not draw with null layer', () => {
			renderer.draw( null );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		test( 'does not draw when arms have zero length', () => {
			renderer.draw( makeLayer( {
				ax: 200, ay: 200, // same as vertex
				bx: 200, by: 200
			} ) );
			// save/restore may or may not be called but no arc should be drawn
			// (implementation skips drawing when arms < 1px)
			const arcCalls = mockCtx.arc.mock.calls.length;
			expect( arcCalls ).toBe( 0 );
		} );

		test( 'handles error in draw gracefully', () => {
			mockCtx.beginPath.mockImplementation( () => {
				throw new Error( 'Canvas error' );
			} );
			// Should not throw
			expect( () => renderer.draw( makeLayer() ) ).not.toThrow();
		} );

		test( 'draws with custom end style tick', () => {
			renderer.draw( makeLayer( { endStyle: 'tick' } ) );
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws with custom end style dot', () => {
			renderer.draw( makeLayer( { endStyle: 'dot' } ) );
			expect( mockCtx.fill ).toHaveBeenCalled();
		} );

		test( 'draws with custom end style none', () => {
			renderer.draw( makeLayer( { endStyle: 'none' } ) );
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws background when showBackground is true', () => {
			renderer.draw( makeLayer( { showBackground: true } ) );
			// Background is drawn as fillRect
			expect( mockCtx.fillRect ).toHaveBeenCalled();
		} );

		test( 'draws basic tolerance box', () => {
			renderer.draw( makeLayer( { toleranceType: 'basic' } ) );
			// Basic tolerance draws a strokeRect around text
			expect( mockCtx.strokeRect ).toHaveBeenCalled();
		} );

		test( 'uses custom font settings', () => {
			renderer.draw( makeLayer( { fontSize: 24, fontFamily: 'Courier' } ) );
			// Font is set before fillText
			expect( mockCtx.fillText ).toHaveBeenCalled();
		} );

		test( 'draws with horizontal text direction', () => {
			renderer.draw( makeLayer( { textDirection: 'horizontal' } ) );
			// Text angle should be 0 for horizontal
			expect( mockCtx.rotate ).toHaveBeenCalled();
		} );

		test( 'uses outside arrow positioning', () => {
			renderer.draw( makeLayer( { arrowsInside: false } ) );
			expect( mockCtx.arc ).toHaveBeenCalled();
		} );

		test( 'uses outside arrow positioning with integer 0 (PHP)', () => {
			renderer.draw( makeLayer( { arrowsInside: 0 } ) );
			expect( mockCtx.arc ).toHaveBeenCalled();
		} );

		test( 'applies custom arc radius', () => {
			renderer.draw( makeLayer( { arcRadius: 80 } ) );
			// Arc should be called with custom radius
			const arcCalls = mockCtx.arc.mock.calls;
			const hasRadiusCall = arcCalls.some( ( call ) => call[ 2 ] === 80 );
			expect( hasRadiusCall ).toBe( true );
		} );

		test( 'uses default arc radius when invalid', () => {
			renderer.draw( makeLayer( { arcRadius: -10 } ) );
			const arcCalls = mockCtx.arc.mock.calls;
			const hasDefaultRadius = arcCalls.some( ( call ) => call[ 2 ] === 40 );
			expect( hasDefaultRadius ).toBe( true );
		} );

		test( 'uses default stroke width when invalid', () => {
			renderer.draw( makeLayer( { strokeWidth: -1 } ) );
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'uses default font size when NaN', () => {
			renderer.draw( makeLayer( { fontSize: NaN } ) );
			expect( mockCtx.fillText ).toHaveBeenCalled();
		} );

		test( 'draws with text override', () => {
			renderer.draw( makeLayer( { text: 'custom 30°' } ) );
			const textCalls = mockCtx.fillText.mock.calls;
			const hasCustomText = textCalls.some( ( call ) => call[ 0 ] === 'custom 30°' );
			expect( hasCustomText ).toBe( true );
		} );

		test( 'draws reflex angle correctly', () => {
			renderer.draw( makeLayer( { reflexAngle: true } ) );
			expect( mockCtx.arc ).toHaveBeenCalled();
		} );

		test( 'draws with symmetric tolerance', () => {
			renderer.draw( makeLayer( {
				toleranceType: 'symmetric',
				toleranceValue: 0.5,
				precision: 1
			} ) );
			const textCalls = mockCtx.fillText.mock.calls;
			const hasToleranceText = textCalls.some( ( call ) => call[ 0 ].includes( '±' ) );
			expect( hasToleranceText ).toBe( true );
		} );
	} );

	describe( 'getBounds', () => {
		test( 'returns bounding box for standard angle', () => {
			const layer = {
				cx: 200, cy: 200,
				ax: 300, ay: 200,
				bx: 200, by: 100,
				arcRadius: 40
			};
			const bounds = renderer.getBounds( layer );
			expect( bounds ).toHaveProperty( 'x' );
			expect( bounds ).toHaveProperty( 'y' );
			expect( bounds ).toHaveProperty( 'width' );
			expect( bounds ).toHaveProperty( 'height' );
			expect( bounds.width ).toBeGreaterThan( 0 );
			expect( bounds.height ).toBeGreaterThan( 0 );
		} );

		test( 'includes padding around the bounds', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 0,
				arcRadius: 40
			};
			const bounds = renderer.getBounds( layer );
			// Bounds should extend beyond the arc radius with padding
			expect( bounds.x ).toBeLessThan( 100 - 40 );
			expect( bounds.y ).toBeLessThan( 0 );
		} );

		test( 'uses default arcRadius when not specified', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 200, ay: 100,
				bx: 100, by: 0
			};
			const bounds = renderer.getBounds( layer );
			expect( bounds ).toBeDefined();
			expect( bounds.width ).toBeGreaterThan( 0 );
		} );

		test( 'handles missing coordinates with defaults', () => {
			const layer = {};
			const bounds = renderer.getBounds( layer );
			expect( bounds ).toBeDefined();
			expect( typeof bounds.x ).toBe( 'number' );
		} );
	} );

	describe( 'hitTest', () => {
		const baseLayer = {
			cx: 200, cy: 200,
			ax: 300, ay: 200,
			bx: 200, by: 100,
			arcRadius: 40
		};

		test( 'hits vertex area', () => {
			expect( renderer.hitTest( baseLayer, 200, 200 ) ).toBe( true );
		} );

		test( 'hits arm A line', () => {
			// Point along the horizontal arm from (200,200) to (300,200)
			expect( renderer.hitTest( baseLayer, 250, 200 ) ).toBe( true );
		} );

		test( 'hits arm B line', () => {
			// Point along the vertical arm from (200,200) to (200,100)
			expect( renderer.hitTest( baseLayer, 200, 150 ) ).toBe( true );
		} );

		test( 'hits arc at correct radius and angle', () => {
			// Arc is at radius 40 from vertex (200,200)
			// For a 90° angle between right and up, the arc midpoint is at ~45°
			const arcX = 200 + 40 * Math.cos( -Math.PI / 4 ); // ~228
			const arcY = 200 + 40 * Math.sin( -Math.PI / 4 ); // ~172
			expect( renderer.hitTest( baseLayer, arcX, arcY ) ).toBe( true );
		} );

		test( 'misses far away point', () => {
			expect( renderer.hitTest( baseLayer, 500, 500 ) ).toBe( false );
		} );

		test( 'misses point just outside tolerance', () => {
			// Point far from all arms and arc
			expect( renderer.hitTest( baseLayer, 350, 50 ) ).toBe( false );
		} );
	} );

	describe( '_isAngleInRange', () => {
		test( 'detects angle within simple range', () => {
			// 45° is within 0° to 90°
			const inRange = renderer._isAngleInRange(
				Math.PI / 4, 0, Math.PI / 2
			);
			expect( inRange ).toBe( true );
		} );

		test( 'detects angle outside simple range', () => {
			// 180° is outside 0° to 90°
			const inRange = renderer._isAngleInRange(
				Math.PI, 0, Math.PI / 2
			);
			expect( inRange ).toBe( false );
		} );

		test( 'handles range wrapping around 0', () => {
			// 350° (≈6.1 rad) should be in range 330°-30° (start=330°, sweep=60°)
			const start = ( 330 * Math.PI ) / 180;
			const sweep = ( 60 * Math.PI ) / 180;
			const angle = ( 350 * Math.PI ) / 180;
			const inRange = renderer._isAngleInRange( angle, start, sweep );
			expect( inRange ).toBe( true );
		} );
	} );

	describe( '_pointToLineDistance', () => {
		test( 'returns 0 for point on line', () => {
			const dist = renderer._pointToLineDistance( 50, 0, 0, 0, 100, 0 );
			expect( dist ).toBeCloseTo( 0, 5 );
		} );

		test( 'returns perpendicular distance', () => {
			const dist = renderer._pointToLineDistance( 50, 10, 0, 0, 100, 0 );
			expect( dist ).toBeCloseTo( 10, 5 );
		} );

		test( 'returns distance to endpoint when beyond segment', () => {
			const dist = renderer._pointToLineDistance( 200, 0, 0, 0, 100, 0 );
			expect( dist ).toBeCloseTo( 100, 5 );
		} );

		test( 'handles zero-length segment', () => {
			const dist = renderer._pointToLineDistance( 10, 0, 0, 0, 0, 0 );
			expect( dist ).toBeCloseTo( 10, 5 );
		} );
	} );

	describe( 'createAngleDimensionLayer (static)', () => {
		test( 'creates layer with correct coordinates', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer(
				100, 200, 300, 200, 100, 50
			);
			expect( layer.type ).toBe( 'angleDimension' );
			expect( layer.cx ).toBe( 100 );
			expect( layer.cy ).toBe( 200 );
			expect( layer.ax ).toBe( 300 );
			expect( layer.ay ).toBe( 200 );
			expect( layer.bx ).toBe( 100 );
			expect( layer.by ).toBe( 50 );
		} );

		test( 'generates unique id', () => {
			const layer1 = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1 );
			expect( layer1.id ).toMatch( /^angleDimension-/ );
		} );

		test( 'uses custom options', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer(
				0, 0, 100, 0, 0, 100,
				{
					stroke: '#ff0000',
					fontSize: 24,
					arcRadius: 80,
					reflexAngle: true,
					precision: 2,
					endStyle: 'tick'
				}
			);
			expect( layer.stroke ).toBe( '#ff0000' );
			expect( layer.fontSize ).toBe( 24 );
			expect( layer.arcRadius ).toBe( 80 );
			expect( layer.reflexAngle ).toBe( true );
			expect( layer.precision ).toBe( 2 );
			expect( layer.endStyle ).toBe( 'tick' );
		} );

		test( 'has sensible defaults', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer( 0, 0, 1, 0, 0, 1 );
			expect( layer.visible ).toBe( true );
			expect( layer.locked ).toBe( false );
			expect( layer.opacity ).toBe( 1 );
			expect( layer.arcRadius ).toBe( 40 );
			expect( layer.precision ).toBe( 1 );
			expect( layer.endStyle ).toBe( 'arrow' );
			expect( layer.showBackground ).toBe( true );
			expect( layer.toleranceType ).toBe( 'none' );
			expect( layer.name ).toBe( 'Angle Dimension' );
		} );

		test( 'accepts custom id', () => {
			const layer = AngleDimensionRenderer.createAngleDimensionLayer(
				0, 0, 1, 0, 0, 1, { id: 'my-angle-1' }
			);
			expect( layer.id ).toBe( 'my-angle-1' );
		} );
	} );

	describe( 'static properties', () => {
		test( 'END_STYLES contains expected values', () => {
			expect( AngleDimensionRenderer.END_STYLES ).toEqual( {
				ARROW: 'arrow',
				TICK: 'tick',
				DOT: 'dot',
				NONE: 'none'
			} );
		} );

		test( 'TEXT_POSITIONS contains expected values', () => {
			expect( AngleDimensionRenderer.TEXT_POSITIONS ).toEqual( {
				ABOVE: 'above',
				BELOW: 'below',
				CENTER: 'center'
			} );
		} );

		test( 'DEFAULTS returns a copy with expected keys', () => {
			const defaults = AngleDimensionRenderer.DEFAULTS;
			expect( defaults ).toHaveProperty( 'arcRadius', 40 );
			expect( defaults ).toHaveProperty( 'precision', 1 );
			expect( defaults ).toHaveProperty( 'endStyle', 'arrow' );
			expect( defaults ).toHaveProperty( 'reflexAngle', false );
			expect( defaults ).toHaveProperty( 'extensionLength', 10 );
			expect( defaults ).toHaveProperty( 'showBackground', true );

			// Verify it returns a copy (not the original)
			defaults.arcRadius = 999;
			expect( AngleDimensionRenderer.DEFAULTS.arcRadius ).toBe( 40 );
		} );
	} );

	describe( 'edge cases', () => {
		test( 'draws very small angle correctly', () => {
			const layer = {
				type: 'angleDimension',
				cx: 200, cy: 200,
				ax: 300, ay: 200,
				bx: 300, by: 199 // Very small angle
			};
			expect( () => renderer.draw( layer ) ).not.toThrow();
			expect( mockCtx.arc ).toHaveBeenCalled();
		} );

		test( 'draws with negative coordinates', () => {
			const layer = {
				type: 'angleDimension',
				cx: -100, cy: -100,
				ax: -200, ay: -100,
				bx: -100, by: -200
			};
			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );

		test( 'draws with very large arc radius', () => {
			const layer = {
				type: 'angleDimension',
				cx: 200, cy: 200,
				ax: 300, ay: 200,
				bx: 200, by: 100,
				arcRadius: 500
			};
			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );

		test( 'getBounds handles very small dimensions', () => {
			const layer = {
				cx: 100, cy: 100,
				ax: 101, ay: 100,
				bx: 100, by: 101,
				arcRadius: 1
			};
			const bounds = renderer.getBounds( layer );
			expect( bounds.width ).toBeGreaterThan( 0 );
			expect( bounds.height ).toBeGreaterThan( 0 );
		} );
	} );
} );
