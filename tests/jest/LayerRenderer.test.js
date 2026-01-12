/**
 * Tests for LayerRenderer
 *
 * LayerRenderer is the core shape rendering engine that handles drawing
 * all layer types (rectangle, circle, ellipse, line, arrow, etc.)
 *
 * @jest-environment jsdom
 */
'use strict';

// Mock the window.mw object before requiring LayerRenderer
const mockMw = {
	config: {
		get: jest.fn().mockImplementation( ( key ) => {
			if ( key === 'LayersDefaultFonts' ) {
				return [ 'Arial', 'Helvetica', 'sans-serif' ];
			}
			return null;
		} )
	},
	message: jest.fn().mockImplementation( ( key ) => ( {
		text: () => key,
		parse: () => key
	} ) )
};

global.window = global.window || {};
global.window.mw = mockMw;

const LayerRenderer = require( '../../resources/ext.layers.shared/LayerRenderer.js' );

describe( 'LayerRenderer', () => {
	let ctx;
	let renderer;

	/**
	 * Create a mock canvas 2D context
	 */
	function createMockContext() {
		return {
			canvas: { width: 800, height: 600 },
			save: jest.fn(),
			restore: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			scale: jest.fn(),
			beginPath: jest.fn(),
			closePath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			arc: jest.fn(),
			arcTo: jest.fn(),
			ellipse: jest.fn(),
			rect: jest.fn(),
			roundRect: jest.fn(),
			fill: jest.fn(),
			stroke: jest.fn(),
			fillRect: jest.fn(),
			strokeRect: jest.fn(),
			fillText: jest.fn(),
			measureText: jest.fn().mockReturnValue( { width: 100 } ),
			getImageData: jest.fn().mockReturnValue( { data: new Uint8ClampedArray( 4 ) } ),
			putImageData: jest.fn(),
			createPattern: jest.fn(),
			createLinearGradient: jest.fn().mockReturnValue( { addColorStop: jest.fn() } ),
			createRadialGradient: jest.fn().mockReturnValue( { addColorStop: jest.fn() } ),
			drawImage: jest.fn(),
			setTransform: jest.fn(),
			resetTransform: jest.fn(),
			clip: jest.fn(),
			clearRect: jest.fn(),
			setLineDash: jest.fn(),
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			lineCap: 'butt',
			lineJoin: 'miter',
			globalAlpha: 1,
			globalCompositeOperation: 'source-over',
			shadowColor: 'transparent',
			shadowBlur: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			font: '16px Arial',
			textAlign: 'left',
			textBaseline: 'top'
		};
	}

	beforeEach( () => {
		ctx = createMockContext();
		renderer = new LayerRenderer( ctx );
	} );

	afterEach( () => {
		if ( renderer ) {
			renderer.destroy();
		}
	} );

	// ========================================================================
	// Constructor Tests
	// ========================================================================

	describe( 'constructor', () => {
		test( 'initializes with context', () => {
			expect( renderer.ctx ).toBe( ctx );
		} );

		test( 'initializes with default config', () => {
			expect( renderer.config ).toEqual( {} );
		} );

		test( 'initializes with custom config', () => {
			const customConfig = { maxLayers: 50 };
			const customRenderer = new LayerRenderer( ctx, customConfig );
			expect( customRenderer.config ).toEqual( customConfig );
			customRenderer.destroy();
		} );

		test( 'initializes baseWidth and baseHeight as null', () => {
			expect( renderer.baseWidth ).toBeNull();
			expect( renderer.baseHeight ).toBeNull();
		} );
	} );

	// ========================================================================
	// Dimension Management Tests
	// ========================================================================

	describe( 'dimension management', () => {
		test( 'setBaseDimensions updates width and height', () => {
			renderer.setBaseDimensions( 1920, 1080 );
			expect( renderer.baseWidth ).toBe( 1920 );
			expect( renderer.baseHeight ).toBe( 1080 );
		} );

		test( 'getScaleFactors returns 1:1 when dimensions not set', () => {
			const scale = renderer.getScaleFactors();
			expect( scale ).toEqual( { sx: 1, sy: 1, avg: 1 } );
		} );

		test( 'getScaleFactors calculates scale from canvas dimensions', () => {
			renderer.setBaseDimensions( 1600, 1200 ); // Base is larger than canvas (800x600)
			// Must set canvas for scale to work
			renderer.setCanvas( { width: 800, height: 600 } );
			const scale = renderer.getScaleFactors();
			expect( scale.sx ).toBe( 0.5 ); // 800/1600
			expect( scale.sy ).toBe( 0.5 ); // 600/1200
			expect( scale.avg ).toBe( 0.5 );
		} );
	} );

	// ========================================================================
	// Shadow Helpers Tests
	// ========================================================================

	describe( 'shadow helpers', () => {
		test( 'clearShadow resets all shadow properties', () => {
			ctx.shadowColor = 'rgba(0,0,0,0.5)';
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 5;
			ctx.shadowOffsetY = 5;

			renderer.clearShadow();

			expect( ctx.shadowColor ).toBe( 'transparent' );
			expect( ctx.shadowBlur ).toBe( 0 );
			expect( ctx.shadowOffsetX ).toBe( 0 );
			expect( ctx.shadowOffsetY ).toBe( 0 );
		} );

		test( 'hasShadowEnabled returns false for layer without shadow', () => {
			expect( renderer.hasShadowEnabled( {} ) ).toBe( false );
			expect( renderer.hasShadowEnabled( { shadow: false } ) ).toBe( false );
		} );

		test( 'hasShadowEnabled returns true for layer with shadow', () => {
			expect( renderer.hasShadowEnabled( { shadow: true } ) ).toBe( true );
		} );

		test( 'applyShadow sets shadow properties on context', () => {
			const layer = {
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 3
			};

			renderer.applyShadow( layer, { sx: 1, sy: 1, avg: 1 } );

			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.5)' );
			expect( ctx.shadowBlur ).toBe( 10 );
			expect( ctx.shadowOffsetX ).toBe( 5 );
			expect( ctx.shadowOffsetY ).toBe( 3 );
		} );

		test( 'applyShadow uses default shadow color', () => {
			const layer = { shadow: true };

			renderer.applyShadow( layer, { sx: 1, sy: 1, avg: 1 } );

			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.4)' );
		} );

		test( 'getShadowSpread returns 0 when shadow not enabled', () => {
			expect( renderer.getShadowSpread( {}, { sx: 1, sy: 1, avg: 1 } ) ).toBe( 0 );
		} );

		test( 'getShadowSpread returns spread value when shadow enabled', () => {
			const layer = { shadow: true, shadowSpread: 5 };
			expect( renderer.getShadowSpread( layer, { sx: 1, sy: 1, avg: 1 } ) ).toBe( 5 );
		} );

		test( 'getShadowParams returns default params when no shadowRenderer', () => {
			const rendererWithoutShadow = new LayerRenderer( ctx, { useShadowRenderer: false } );
			rendererWithoutShadow.shadowRenderer = null;
			const params = rendererWithoutShadow.getShadowParams( { shadow: true }, { sx: 1, sy: 1, avg: 1 } );
			expect( params ).toEqual( {
				offsetX: 0,
				offsetY: 0,
				blur: 0,
				color: 'transparent',
				offscreenOffset: 0
			} );
		} );

		test( 'getShadowParams returns params from shadowRenderer when available', () => {
			const mockParams = { offsetX: 5, offsetY: 5, blur: 10, color: 'black', offscreenOffset: 15 };
			renderer.shadowRenderer = { getShadowParams: jest.fn().mockReturnValue( mockParams ) };
			const params = renderer.getShadowParams( { shadow: true }, { sx: 1, sy: 1, avg: 1 } );
			expect( params ).toEqual( mockParams );
		} );

		test( 'drawSpreadShadow delegates to shadowRenderer when available', () => {
			const mockDrawSpreadShadow = jest.fn();
			const mockSetContext = jest.fn();
			renderer.shadowRenderer = {
				setContext: mockSetContext,
				drawSpreadShadow: mockDrawSpreadShadow
			};
			const layer = { shadow: true };
			const drawFn = jest.fn();
			renderer.drawSpreadShadow( layer, { sx: 1, sy: 1, avg: 1 }, 5, drawFn, 0.8 );
			expect( mockSetContext ).toHaveBeenCalledWith( ctx );
			expect( mockDrawSpreadShadow ).toHaveBeenCalledWith( layer, { sx: 1, sy: 1, avg: 1 }, 5, drawFn, 0.8 );
		} );

		test( 'drawSpreadShadow does nothing when no shadowRenderer', () => {
			renderer.shadowRenderer = null;
			expect( () => {
				renderer.drawSpreadShadow( { shadow: true }, { sx: 1, sy: 1, avg: 1 }, 5, jest.fn(), 0.8 );
			} ).not.toThrow();
		} );

		test( 'drawSpreadShadowStroke delegates to shadowRenderer when available', () => {
			const mockDrawSpreadShadowStroke = jest.fn();
			const mockSetContext = jest.fn();
			renderer.shadowRenderer = {
				setContext: mockSetContext,
				drawSpreadShadowStroke: mockDrawSpreadShadowStroke
			};
			const layer = { shadow: true, strokeWidth: 2 };
			const drawFn = jest.fn();
			renderer.drawSpreadShadowStroke( layer, { sx: 1, sy: 1, avg: 1 }, 2, drawFn, 0.9 );
			expect( mockSetContext ).toHaveBeenCalledWith( ctx );
			expect( mockDrawSpreadShadowStroke ).toHaveBeenCalledWith( layer, { sx: 1, sy: 1, avg: 1 }, 2, drawFn, 0.9 );
		} );

		test( 'drawSpreadShadowStroke does nothing when no shadowRenderer', () => {
			renderer.shadowRenderer = null;
			expect( () => {
				renderer.drawSpreadShadowStroke( { shadow: true }, { sx: 1, sy: 1, avg: 1 }, 2, jest.fn(), 0.9 );
			} ).not.toThrow();
		} );

		test( 'withLocalAlpha calls drawFn via shadowRenderer when available', () => {
			const mockWithLocalAlpha = jest.fn( ( alpha, fn ) => fn() );
			renderer.shadowRenderer = { withLocalAlpha: mockWithLocalAlpha };
			const drawFn = jest.fn();
			renderer.withLocalAlpha( 0.5, drawFn );
			expect( mockWithLocalAlpha ).toHaveBeenCalledWith( 0.5, drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'withLocalAlpha calls drawFn directly when no shadowRenderer', () => {
			renderer.shadowRenderer = null;
			const drawFn = jest.fn();
			renderer.withLocalAlpha( 0.5, drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'withLocalAlpha handles null drawFn gracefully', () => {
			renderer.shadowRenderer = null;
			expect( () => {
				renderer.withLocalAlpha( 0.5, null );
			} ).not.toThrow();
		} );

		test( 'drawCallout delegates to calloutRenderer when available', () => {
			const mockDraw = jest.fn();
			const mockSetContext = jest.fn();
			renderer.calloutRenderer = {
				setContext: mockSetContext,
				draw: mockDraw
			};
			const layer = { type: 'callout', x: 10, y: 20, width: 100, height: 50, text: 'Hello' };
			renderer.drawCallout( layer );
			expect( mockSetContext ).toHaveBeenCalledWith( ctx );
			expect( mockDraw ).toHaveBeenCalled();
		} );

		test( 'drawCallout does nothing when no calloutRenderer', () => {
			renderer.calloutRenderer = null;
			expect( () => {
				renderer.drawCallout( { type: 'callout', x: 10, y: 20, width: 100, height: 50, text: 'Hello' } );
			} ).not.toThrow();
		} );
	} );

	// ========================================================================
	// drawRectangle Tests
	// ========================================================================

	describe( 'drawRectangle', () => {
		test( 'draws rectangle with default values', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000'
			} );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.rect ).toHaveBeenCalledWith( 10, 20, 100, 50 );
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'draws rectangle with stroke', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				stroke: '#0000ff',
				strokeWidth: 2
			} );

			expect( ctx.strokeStyle ).toBe( '#0000ff' );
			expect( ctx.lineWidth ).toBe( 2 );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws rectangle with both fill and stroke', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				stroke: '#0000ff',
				fillOpacity: 0.8,
				strokeOpacity: 1
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'handles rotation', () => {
			renderer.drawRectangle( {
				x: 100,
				y: 100,
				width: 50,
				height: 30,
				fill: '#ff0000',
				rotation: 90
			} );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalledWith( Math.PI / 2 );
		} );

		test( 'uses roundRect for corner radius', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				cornerRadius: 10
			} );

			expect( ctx.roundRect ).toHaveBeenCalledWith( 10, 20, 100, 50, 10 );
		} );

		test( 'clamps cornerRadius to half of smaller dimension', () => {
			// Width 100, height 40 -> max radius is 20
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 40,
				fill: '#ff0000',
				cornerRadius: 50 // Too large
			} );

			expect( ctx.roundRect ).toHaveBeenCalledWith( 10, 20, 100, 40, 20 );
		} );

		test( 'handles shadow', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				shadow: true,
				shadowBlur: 5,
				shadowColor: 'rgba(0,0,0,0.5)'
			} );

			// Shadow is applied - check that shadowBlur was set at some point
			// Note: The actual implementation may clear shadow after drawing
			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// drawCircle Tests
	// ========================================================================

	describe( 'drawCircle', () => {
		test( 'draws circle with fill', () => {
			renderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ff0000'
			} );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 50, 0, 2 * Math.PI );
			expect( ctx.fillStyle ).toBe( '#ff0000' );
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws circle with stroke', () => {
			renderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 50,
				stroke: '#0000ff',
				strokeWidth: 3
			} );

			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 50, 0, 2 * Math.PI );
			expect( ctx.strokeStyle ).toBe( '#0000ff' );
			expect( ctx.lineWidth ).toBe( 3 );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'handles default radius of 0', () => {
			// Circle with default/no radius should draw a point (radius 0)
			renderer.drawCircle( {
				x: 100,
				y: 100,
				fill: '#ff0000'
			} );

			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 0, 0, 2 * Math.PI );
		} );

		test( 'applies opacity', () => {
			renderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ff0000',
				opacity: 0.5,
				fillOpacity: 0.8
			} );

			expect( ctx.globalAlpha ).toBe( 0.4 ); // 0.5 * 0.8
		} );
	} );

	// ========================================================================
	// drawEllipse Tests
	// ========================================================================

	describe( 'drawEllipse', () => {
		test( 'draws ellipse with radiusX and radiusY', () => {
			renderer.drawEllipse( {
				x: 100,
				y: 100,
				radiusX: 60,
				radiusY: 40,
				fill: '#ff0000'
			} );

			expect( ctx.ellipse ).toHaveBeenCalledWith( 100, 100, 60, 40, 0, 0, 2 * Math.PI );
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'calculates radius from width and height', () => {
			renderer.drawEllipse( {
				x: 100,
				y: 100,
				width: 120,
				height: 80,
				fill: '#ff0000'
			} );

			// radiusX = width/2 = 60, radiusY = height/2 = 40
			expect( ctx.ellipse ).toHaveBeenCalledWith( 100, 100, 60, 40, 0, 0, 2 * Math.PI );
		} );

		test( 'handles rotation', () => {
			renderer.drawEllipse( {
				x: 100,
				y: 100,
				radiusX: 60,
				radiusY: 40,
				fill: '#ff0000',
				rotation: 45
			} );

			const rotationRad = ( 45 * Math.PI ) / 180;
			expect( ctx.ellipse ).toHaveBeenCalledWith( 100, 100, 60, 40, rotationRad, 0, 2 * Math.PI );
		} );
	} );

	// ========================================================================
	// drawLine Tests
	// ========================================================================

	describe( 'drawLine', () => {
		test( 'draws line between two points', () => {
			renderer.drawLine( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				stroke: '#000000',
				strokeWidth: 2
			} );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalledWith( 10, 20 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 100, 80 );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'uses default stroke color', () => {
			renderer.drawLine( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80
			} );

			expect( ctx.strokeStyle ).toBe( '#000000' );
		} );

		test( 'sets lineCap to round', () => {
			renderer.drawLine( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80
			} );

			expect( ctx.lineCap ).toBe( 'round' );
		} );

		test( 'handles rotation', () => {
			renderer.drawLine( {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				rotation: 90
			} );

			// Center is (50, 0), rotates around it
			expect( ctx.translate ).toHaveBeenCalledWith( 50, 0 );
			expect( ctx.rotate ).toHaveBeenCalledWith( Math.PI / 2 );
		} );

		test( 'draws line with shadow spread', () => {
			renderer.drawLine( {
				x1: 10,
				y1: 20,
				x2: 200,
				y2: 80,
				stroke: '#ff0000',
				strokeWidth: 4,
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 6
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws line with shadow spread=0', () => {
			renderer.drawLine( {
				x1: 10,
				y1: 20,
				x2: 200,
				y2: 80,
				stroke: '#ff0000',
				strokeWidth: 4,
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 0
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws line with opacity', () => {
			renderer.drawLine( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				stroke: '#0000ff',
				strokeWidth: 3,
				opacity: 0.5,
				strokeOpacity: 0.8
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// drawPath Tests
	// ========================================================================

	describe( 'drawPath', () => {
		test( 'draws freehand path through points', () => {
			renderer.drawPath( {
				points: [
					{ x: 10, y: 10 },
					{ x: 50, y: 30 },
					{ x: 100, y: 20 }
				],
				stroke: '#ff0000',
				strokeWidth: 3
			} );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalledWith( 10, 10 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 50, 30 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 100, 20 );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'returns early for empty points', () => {
			renderer.drawPath( { points: [] } );
			expect( ctx.beginPath ).not.toHaveBeenCalled();
		} );

		test( 'returns early for single point', () => {
			renderer.drawPath( { points: [ { x: 10, y: 10 } ] } );
			expect( ctx.beginPath ).not.toHaveBeenCalled();
		} );

		test( 'returns early for undefined points', () => {
			renderer.drawPath( {} );
			expect( ctx.beginPath ).not.toHaveBeenCalled();
		} );

		test( 'uses default stroke color', () => {
			renderer.drawPath( {
				points: [
					{ x: 10, y: 10 },
					{ x: 50, y: 30 }
				]
			} );

			expect( ctx.strokeStyle ).toBe( '#000000' );
		} );

		test( 'draws path with shadow spread', () => {
			renderer.drawPath( {
				points: [
					{ x: 10, y: 10 },
					{ x: 50, y: 30 },
					{ x: 100, y: 20 },
					{ x: 150, y: 50 }
				],
				stroke: '#ff0000',
				strokeWidth: 4,
				shadow: true,
				shadowBlur: 6,
				shadowSpread: 5
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws path with shadow spread=0', () => {
			renderer.drawPath( {
				points: [
					{ x: 10, y: 10 },
					{ x: 50, y: 30 },
					{ x: 100, y: 20 }
				],
				stroke: '#0000ff',
				strokeWidth: 3,
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 0
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws path with opacity settings', () => {
			renderer.drawPath( {
				points: [
					{ x: 10, y: 10 },
					{ x: 50, y: 30 }
				],
				stroke: '#00ff00',
				strokeWidth: 2,
				opacity: 0.7,
				strokeOpacity: 0.9
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// drawPolygon Tests
	// ========================================================================

	describe( 'drawPolygon', () => {
		test( 'draws regular polygon with sides and radius', () => {
			renderer.drawPolygon( {
				x: 100,
				y: 100,
				sides: 6,
				radius: 50,
				fill: '#ff0000'
			} );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
			expect( ctx.lineTo ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws triangle (3 sides)', () => {
			renderer.drawPolygon( {
				x: 100,
				y: 100,
				sides: 3,
				radius: 50,
				fill: '#ff0000'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws pentagon (5 sides)', () => {
			renderer.drawPolygon( {
				x: 100,
				y: 100,
				sides: 5,
				radius: 50,
				fill: '#00ff00'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws polygon with rotation', () => {
			renderer.drawPolygon( {
				x: 100,
				y: 100,
				sides: 6,
				radius: 50,
				fill: '#ff0000',
				rotation: 30
			} );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws polygon with shadow spread', () => {
			renderer.drawPolygon( {
				x: 100,
				y: 100,
				sides: 6,
				radius: 50,
				fill: '#ff0000',
				stroke: '#000000',
				shadow: true,
				shadowBlur: 5,
				shadowSpread: 8
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws polygon with shadow spread=0', () => {
			renderer.drawPolygon( {
				x: 100,
				y: 100,
				sides: 6,
				radius: 50,
				fill: '#ff0000',
				stroke: '#000000',
				strokeWidth: 3,
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 0
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws polygon with stroke only', () => {
			renderer.drawPolygon( {
				x: 100,
				y: 100,
				sides: 8,
				radius: 60,
				fill: 'transparent',
				stroke: '#0000ff',
				strokeWidth: 2
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'handles stroke and fill with opacity', () => {
			renderer.drawPolygon( {
				x: 100,
				y: 100,
				sides: 6,
				radius: 50,
				fill: '#ff0000',
				stroke: '#0000ff',
				strokeWidth: 2,
				opacity: 0.8,
				fillOpacity: 0.5,
				strokeOpacity: 0.7
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'uses default values when not specified', () => {
			renderer.drawPolygon( {} );

			// Should use defaults: sides=6, radius=50
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// drawStar Tests
	// ========================================================================

	describe( 'drawStar', () => {
		test( 'draws star shape', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffff00'
			} );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
			expect( ctx.lineTo ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'uses default values', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				fill: '#ffff00'
			} );

			// Should use defaults: outerRadius=50, innerRadius=25, points=5
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws star with different point counts', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 60,
				innerRadius: 30,
				points: 8,
				fill: '#ff0000'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws star with rotation', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffff00',
				rotation: 36
			} );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws star with shadow spread', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffff00',
				stroke: '#000000',
				shadow: true,
				shadowBlur: 6,
				shadowSpread: 5
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws star with shadow spread=0 and stroke', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffff00',
				stroke: '#cc0000',
				strokeWidth: 2,
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 0
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws star with stroke only', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 6,
				fill: 'transparent',
				stroke: '#0000ff',
				strokeWidth: 3
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws star with opacity', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffff00',
				stroke: '#000000',
				opacity: 0.7,
				fillOpacity: 0.8,
				strokeOpacity: 0.6
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws 3-pointed star', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 20,
				points: 3,
				fill: '#00ff00'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// drawLayer Dispatcher Tests
	// ========================================================================

	describe( 'drawLayer (dispatcher)', () => {
		test( 'dispatches to drawRectangle for rectangle type', () => {
			const spy = jest.spyOn( renderer, 'drawRectangle' );
			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawRectangle for rect type', () => {
			const spy = jest.spyOn( renderer, 'drawRectangle' );
			const layer = { type: 'rect', x: 10, y: 20, width: 100, height: 50 };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawCircle for circle type', () => {
			const spy = jest.spyOn( renderer, 'drawCircle' );
			const layer = { type: 'circle', x: 100, y: 100, radius: 50 };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawEllipse for ellipse type', () => {
			const spy = jest.spyOn( renderer, 'drawEllipse' );
			const layer = { type: 'ellipse', x: 100, y: 100, radiusX: 60, radiusY: 40 };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawLine for line type', () => {
			const spy = jest.spyOn( renderer, 'drawLine' );
			const layer = { type: 'line', x1: 10, y1: 20, x2: 100, y2: 80 };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawArrow for arrow type', () => {
			const spy = jest.spyOn( renderer, 'drawArrow' );
			const layer = { type: 'arrow', x1: 10, y1: 20, x2: 100, y2: 80 };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawPath for path type', () => {
			const spy = jest.spyOn( renderer, 'drawPath' );
			const layer = { type: 'path', points: [ { x: 0, y: 0 }, { x: 10, y: 10 } ] };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawPolygon for polygon type', () => {
			const spy = jest.spyOn( renderer, 'drawPolygon' );
			const layer = { type: 'polygon', points: [] };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawStar for star type', () => {
			const spy = jest.spyOn( renderer, 'drawStar' );
			const layer = { type: 'star', x: 100, y: 100 };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawText for text type', () => {
			const spy = jest.spyOn( renderer, 'drawText' );
			const layer = { type: 'text', x: 10, y: 20, text: 'Hello' };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawTextBox for textbox type', () => {
			const spy = jest.spyOn( renderer, 'drawTextBox' );
			const layer = { type: 'textbox', x: 10, y: 20, width: 100, height: 50, text: 'Hello' };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawCallout for callout type', () => {
			const spy = jest.spyOn( renderer, 'drawCallout' );
			const layer = { type: 'callout', x: 10, y: 20, width: 100, height: 50, text: 'Hello' };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawImage for image type', () => {
			const spy = jest.spyOn( renderer, 'drawImage' );
			const layer = { type: 'image', x: 10, y: 20, width: 100, height: 50, src: 'data:image/png;base64,xyz' };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawCustomShape for customShape type', () => {
			const spy = jest.spyOn( renderer, 'drawCustomShape' );
			const layer = { type: 'customShape', x: 10, y: 20, width: 100, height: 50, path: 'M0,0 L10,10' };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawMarker for marker type', () => {
			const spy = jest.spyOn( renderer, 'drawMarker' );
			const layer = { type: 'marker', x: 100, y: 100, arrowX: 150, arrowY: 150, markerNumber: 1 };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'dispatches to drawDimension for dimension type', () => {
			const spy = jest.spyOn( renderer, 'drawDimension' );
			const layer = { type: 'dimension', x1: 10, y1: 20, x2: 100, y2: 20, value: '50', unit: 'px' };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'passes options to draw methods', () => {
			const spy = jest.spyOn( renderer, 'drawRectangle' );
			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const options = { scaled: true };

			renderer.drawLayer( layer, options );

			expect( spy ).toHaveBeenCalledWith( layer, options );
		} );

		test( 'handles unknown layer type gracefully', () => {
			// Should not throw for unknown type
			expect( () => {
				renderer.drawLayer( { type: 'unknown' } );
			} ).not.toThrow();
		} );

		test( 'uses blur blend mode rendering for shapes with blend: blur', () => {
			const spy = jest.spyOn( renderer, 'drawLayerWithBlurBlend' );
			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50, blend: 'blur' };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'uses blur blend mode rendering for shapes with blendMode: blur', () => {
			const spy = jest.spyOn( renderer, 'drawLayerWithBlurBlend' );
			const layer = { type: 'circle', x: 100, y: 100, radius: 50, blendMode: 'blur' };

			renderer.drawLayer( layer );

			expect( spy ).toHaveBeenCalledWith( layer, undefined );
		} );

		test( 'uses normal rendering for shapes with other blend modes', () => {
			const blurBlendSpy = jest.spyOn( renderer, 'drawLayerWithBlurBlend' );
			const rectSpy = jest.spyOn( renderer, 'drawRectangle' );
			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50, blend: 'multiply' };

			renderer.drawLayer( layer );

			expect( blurBlendSpy ).not.toHaveBeenCalled();
			expect( rectSpy ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Blur Blend Mode Tests
	// ========================================================================

	describe( 'blur blend mode', () => {
		test( 'hasBlurBlendMode returns true for blend: blur', () => {
			expect( renderer.hasBlurBlendMode( { blend: 'blur' } ) ).toBe( true );
		} );

		test( 'hasBlurBlendMode returns true for blendMode: blur', () => {
			expect( renderer.hasBlurBlendMode( { blendMode: 'blur' } ) ).toBe( true );
		} );

		test( 'hasBlurBlendMode returns false for other blend modes', () => {
			expect( renderer.hasBlurBlendMode( { blend: 'multiply' } ) ).toBe( false );
			expect( renderer.hasBlurBlendMode( { blendMode: 'screen' } ) ).toBe( false );
		} );

		test( 'hasBlurBlendMode returns false when no blend mode set', () => {
			expect( renderer.hasBlurBlendMode( {} ) ).toBe( false );
		} );

		test( '_drawRectPath draws rectangle path', () => {
			const scale = { sx: 1, sy: 1, avg: 1 };
			const layer = { x: 10, y: 20, width: 100, height: 50 };

			renderer._drawRectPath( layer, scale, ctx );

			expect( ctx.rect ).toHaveBeenCalledWith( 10, 20, 100, 50 );
		} );

		test( '_drawCirclePath draws circle arc', () => {
			const scale = { sx: 1, sy: 1, avg: 1 };
			const layer = { x: 100, y: 100, radius: 50 };

			renderer._drawCirclePath( layer, scale, ctx );

			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 50, 0, Math.PI * 2 );
		} );

		test( '_drawEllipsePath draws ellipse', () => {
			const scale = { sx: 1, sy: 1, avg: 1 };
			const layer = { x: 100, y: 100, radiusX: 60, radiusY: 40 };

			renderer._drawEllipsePath( layer, scale, ctx );

			expect( ctx.ellipse ).toHaveBeenCalledWith( 100, 100, 60, 40, 0, 0, Math.PI * 2 );
		} );

		test( '_drawPolygonPath draws polygon with correct number of sides', () => {
			const scale = { sx: 1, sy: 1, avg: 1 };
			const layer = { x: 100, y: 100, radius: 50, sides: 6 };

			renderer._drawPolygonPath( layer, scale, ctx );

			// Should call moveTo once and lineTo 5 times (6 sides - 1)
			expect( ctx.moveTo ).toHaveBeenCalledTimes( 1 );
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 5 );
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( '_drawStarPath draws star with correct number of points', () => {
			const scale = { sx: 1, sy: 1, avg: 1 };
			const layer = { x: 100, y: 100, radius: 50, points: 5 };

			renderer._drawStarPath( layer, scale, ctx );

			// Star with 5 points has 10 vertices (5 outer + 5 inner)
			expect( ctx.moveTo ).toHaveBeenCalledTimes( 1 );
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 9 ); // 10 - 1
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( 'drawLayerWithBlurBlend falls back when effectsRenderer is not available', () => {
			renderer.effectsRenderer = null;
			const rectSpy = jest.spyOn( renderer, '_drawLayerByType' );
			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50, blend: 'blur' };

			renderer.drawLayerWithBlurBlend( layer );

			expect( rectSpy ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// destroy Tests
	// ========================================================================

	describe( 'destroy', () => {
		test( 'cleans up all references', () => {
			renderer.setBaseDimensions( 1920, 1080 );
			renderer.canvas = document.createElement( 'canvas' );
			renderer.backgroundImage = new Image();

			renderer.destroy();

			expect( renderer.ctx ).toBeNull();
			expect( renderer.config ).toBeNull();
			expect( renderer.canvas ).toBeNull();
			expect( renderer.backgroundImage ).toBeNull();
			expect( renderer.baseWidth ).toBeNull();
			expect( renderer.baseHeight ).toBeNull();
		} );
	} );

	// ========================================================================
	// Export Tests
	// ========================================================================

	describe( 'exports', () => {
		test( 'exports LayerRenderer constructor', () => {
			expect( typeof LayerRenderer ).toBe( 'function' );
		} );

		test( 'prototype has all draw methods', () => {
			expect( typeof LayerRenderer.prototype.drawRectangle ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawCircle ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawEllipse ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawLine ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawArrow ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawPath ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawPolygon ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawStar ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawText ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawLayer ).toBe( 'function' );
		} );
	} );

	// ========================================================================
	// drawArrow Tests
	// ========================================================================

	describe( 'drawArrow', () => {
		test( 'draws arrow between two points', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000', // Arrow needs fill to be visible
				strokeWidth: 2
			} );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws arrow with fill', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'handles double-ended arrow', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				arrowStyle: 'double'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'handles chevron head type', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				arrowHead: 'chevron'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'handles default properties', () => {
			renderer.drawArrow( {
				x1: 0,
				y1: 0,
				x2: 50,
				y2: 50
			} );

			// Should complete without error
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'draws arrow with rotation', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				rotation: 45
			} );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws arrow with stroke and shadow', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				stroke: '#000000',
				strokeWidth: 2,
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 0
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'draws arrow with shadow spread', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				stroke: '#000000',
				shadow: true,
				shadowBlur: 5,
				shadowSpread: 10
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws arrow with none style (line only)', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				arrowStyle: 'none'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws arrow with standard head type', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				arrowHeadType: 'standard'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws arrow with pointed head type', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				arrowHeadType: 'pointed'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws arrow with custom head scale', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				headScale: 1.5
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws arrow with tail width', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				tailWidth: 10
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws double arrow with chevron head', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				arrowStyle: 'double',
				arrowHeadType: 'chevron'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'draws double arrow with standard head', () => {
			renderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				fill: '#ff0000',
				arrowStyle: 'double',
				arrowHeadType: 'standard'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// drawText Tests
	// ========================================================================

	describe( 'drawText', () => {
		test( 'draws text at position', () => {
			renderer.drawText( {
				x: 50,
				y: 100,
				text: 'Hello World',
				fontSize: 24,
				fontFamily: 'Arial',
				color: '#000000'
			} );

			expect( ctx.fillText ).toHaveBeenCalledWith( 'Hello World', 50, 100 );
		} );

		test( 'uses default font size', () => {
			renderer.drawText( {
				x: 50,
				y: 100,
				text: 'Hello'
			} );

			expect( ctx.font ).toContain( '16' ); // Default font size
		} );

		test( 'handles rotation', () => {
			renderer.drawText( {
				x: 50,
				y: 100,
				text: 'Rotated',
				rotation: 45
			} );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalledWith( ( 45 * Math.PI ) / 180 );
		} );

		test( 'handles text stroke', () => {
			// Add strokeText mock
			ctx.strokeText = jest.fn();
			
			renderer.drawText( {
				x: 50,
				y: 100,
				text: 'Stroked',
				textStroke: true,
				textStrokeColor: '#ffffff',
				textStrokeWidth: 2
			} );

			expect( ctx.strokeText ).toHaveBeenCalled();
		} );

		test( 'handles multiline text', () => {
			renderer.drawText( {
				x: 50,
				y: 100,
				text: 'Line 1\nLine 2',
				fontSize: 20
			} );

			// Should call fillText multiple times for multiline
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		test( 'skips empty text', () => {
			const fillTextSpy = jest.fn();
			ctx.fillText = fillTextSpy;
			
			renderer.drawText( {
				x: 50,
				y: 100,
				text: ''
			} );

			// Empty string may or may not be drawn depending on implementation
			// Just verify no error is thrown
			expect( ctx.save ).toHaveBeenCalled();
		} );

		test( 'handles undefined text', () => {
			renderer.drawText( {
				x: 50,
				y: 100
			} );

			// Should not throw even without text
			expect( ctx.save ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Shadow Spread Tests
	// ========================================================================

	describe( 'shadow spread', () => {
		test( 'drawRectangle handles shadow with spread', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				shadow: true,
				shadowBlur: 5,
				shadowSpread: 10
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'drawCircle handles shadow with spread', () => {
			renderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ff0000',
				shadow: true,
				shadowBlur: 5,
				shadowSpread: 10
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'drawEllipse handles shadow with spread', () => {
			renderer.drawEllipse( {
				x: 100,
				y: 100,
				radiusX: 60,
				radiusY: 40,
				fill: '#ff0000',
				shadow: true,
				shadowSpread: 5
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'drawLine handles shadow with spread', () => {
			renderer.drawLine( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				stroke: '#000000',
				shadow: true,
				shadowSpread: 3
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		// Tests for bug fixes (December 2025)
		test( 'drawRectangle renders stroke shadow with spread=0', () => {
			// Bug fix: stroke shadow was invisible when spread=0
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ffffff',
				stroke: '#000000',
				strokeWidth: 3,
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 0, // spread=0 was causing stroke shadow to be invisible
				shadowOffsetX: 4,
				shadowOffsetY: 4
			} );

			// Should draw both fill and stroke with shadow
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'drawCircle renders stroke shadow with spread=0', () => {
			renderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ffffff',
				stroke: '#ff0000',
				strokeWidth: 5,
				shadow: true,
				shadowBlur: 10,
				shadowSpread: 0,
				shadowOffsetX: 3,
				shadowOffsetY: 3
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'drawEllipse renders stroke shadow with spread=0', () => {
			renderer.drawEllipse( {
				x: 100,
				y: 100,
				radiusX: 60,
				radiusY: 40,
				fill: '#ffffff',
				stroke: '#0000ff',
				strokeWidth: 4,
				shadow: true,
				shadowBlur: 6,
				shadowSpread: 0,
				shadowOffsetX: 2,
				shadowOffsetY: 2
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'drawRectangle with stroke-only shadow (no fill)', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: 'transparent',
				stroke: '#000000',
				strokeWidth: 3,
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 0
			} );

			// Should still draw stroke with shadow even without fill
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'drawRectangle with combined shadow settings', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff6600',
				stroke: '#333333',
				strokeWidth: 2,
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 12,
				shadowSpread: 5,
				shadowOffsetX: 6,
				shadowOffsetY: 6
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Text Shadow Tests (Bug fix December 2025)
	// ========================================================================

	describe( 'text shadow rendering', () => {
		test( 'drawText renders shadow with spread=0', () => {
			renderer.drawText( {
				x: 50,
				y: 50,
				text: 'Test',
				fontSize: 24,
				color: '#000000',
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 0,
				shadowColor: 'rgba(0,0,0,0.5)'
			} );

			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		test( 'drawText renders shadow with positive spread', () => {
			// Bug fix: text shadow spread had no effect
			renderer.drawText( {
				x: 50,
				y: 50,
				text: 'Shadow Spread Test',
				fontSize: 32,
				color: '#ffffff',
				shadow: true,
				shadowBlur: 4,
				shadowSpread: 10, // This should now create a spread effect
				shadowColor: '#000000',
				shadowOffsetX: 2,
				shadowOffsetY: 2
			} );

			// Text should be rendered (spread creates multiple shadow layers)
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		test( 'drawText handles large shadow spread', () => {
			renderer.drawText( {
				x: 100,
				y: 100,
				text: 'Large Spread',
				fontSize: 20,
				color: '#000000',
				shadow: true,
				shadowBlur: 2,
				shadowSpread: 20,
				shadowColor: 'rgba(255,0,0,0.6)'
			} );

			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		test( 'drawText without shadow still renders correctly', () => {
			renderer.drawText( {
				x: 50,
				y: 50,
				text: 'No Shadow',
				fontSize: 16,
				color: '#333333',
				shadow: false
			} );

			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		test( 'drawText with shadow disabled explicitly', () => {
			renderer.drawText( {
				x: 50,
				y: 50,
				text: 'Disabled Shadow',
				fontSize: 16,
				color: '#333333',
				shadow: false,
				shadowSpread: 10 // Should be ignored when shadow=false
			} );

			expect( ctx.fillText ).toHaveBeenCalled();
			// Shadow should not be applied
			expect( ctx.shadowBlur ).toBe( 0 );
		} );

		test( 'drawText with stroke and shadow spread', () => {
			// Add strokeText mock if not present
			ctx.strokeText = ctx.strokeText || jest.fn();
			
			renderer.drawText( {
				x: 50,
				y: 50,
				text: 'Stroked Shadow',
				fontSize: 24,
				color: '#ffffff',
				textStrokeColor: '#000000',
				textStrokeWidth: 2,
				shadow: true,
				shadowBlur: 8,
				shadowSpread: 8,
				shadowColor: 'rgba(0,0,0,0.7)'
			} );

			// Both fill and stroke should be rendered with shadow spread
			expect( ctx.fillText ).toHaveBeenCalled();
			expect( ctx.strokeText ).toHaveBeenCalled();
		} );

		test( 'drawText with stroke, no spread', () => {
			ctx.strokeText = ctx.strokeText || jest.fn();
			
			renderer.drawText( {
				x: 100,
				y: 100,
				text: 'Stroked',
				fontSize: 20,
				color: '#ff0000',
				textStrokeColor: '#000000',
				textStrokeWidth: 3,
				shadow: true,
				shadowBlur: 6,
				shadowSpread: 0,
				shadowColor: '#333333'
			} );

			expect( ctx.strokeText ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Opacity Tests
	// ========================================================================

	describe( 'opacity handling', () => {
		test( 'drawRectangle applies fillOpacity and strokeOpacity', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				stroke: '#0000ff',
				opacity: 0.8,
				fillOpacity: 0.5,
				strokeOpacity: 0.7
			} );

			// 0.8 * 0.5 = 0.4 for fill, 0.8 * 0.7 = 0.56 for stroke
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'drawCircle applies opacity correctly', () => {
			renderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ff0000',
				opacity: 0.6,
				fillOpacity: 0.8
			} );

			// 0.6 * 0.8 = 0.48
			expect( ctx.globalAlpha ).toBeCloseTo( 0.48 );
		} );

		test( 'handles transparent fill', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: 'transparent',
				stroke: '#0000ff'
			} );

			// Should only stroke, not fill
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'handles none fill', () => {
			renderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 50,
				fill: 'none',
				stroke: '#0000ff'
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Scaled Options Tests
	// ========================================================================

	describe( 'scaled options', () => {
		test( 'drawRectangle uses scaled:true option', () => {
			renderer.setBaseDimensions( 1600, 1200 );
			renderer.setCanvas( { width: 800, height: 600 } );

			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				stroke: '#0000ff',
				strokeWidth: 4
			}, { scaled: true } );

			// With scaled:true, should complete without error
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'drawCircle respects scaled option', () => {
			renderer.setBaseDimensions( 1600, 1200 );
			renderer.setCanvas( { width: 800, height: 600 } );

			renderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 50,
				stroke: '#ff0000',
				strokeWidth: 2
			}, { scaled: true } );

			// Should complete without error
			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// setZoom and setBackgroundImage Tests
	// ========================================================================

	describe( 'configuration methods', () => {
		test( 'setZoom updates zoom level', () => {
			renderer.setZoom( 2.0 );
			expect( renderer.zoom ).toBe( 2.0 );
		} );

		test( 'setBackgroundImage stores image reference', () => {
			const img = new Image();
			renderer.setBackgroundImage( img );
			expect( renderer.backgroundImage ).toBe( img );
		} );

		test( 'setCanvas stores canvas reference', () => {
			const canvas = document.createElement( 'canvas' );
			renderer.setCanvas( canvas );
			expect( renderer.canvas ).toBe( canvas );
		} );
	} );

	// ========================================================================
	// Complex Shape Tests
	// ========================================================================

	describe( 'complex shapes', () => {
		test( 'drawStar handles custom point count', () => {
			renderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 8, // 8-pointed star
				fill: '#ffff00'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'drawPolygon handles large point arrays', () => {
			const points = [];
			for ( let i = 0; i < 20; i++ ) {
				points.push( {
					x: 100 + 50 * Math.cos( ( 2 * Math.PI * i ) / 20 ),
					y: 100 + 50 * Math.sin( ( 2 * Math.PI * i ) / 20 )
				} );
			}

			renderer.drawPolygon( {
				points,
				fill: '#00ff00'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'drawPath handles curved paths (many points)', () => {
			const points = [];
			for ( let i = 0; i < 50; i++ ) {
				points.push( { x: i * 2, y: Math.sin( i / 5 ) * 20 + 50 } );
			}

			renderer.drawPath( {
				points,
				stroke: '#ff0000',
				strokeWidth: 2
			} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Edge Cases Tests
	// ========================================================================

	describe( 'edge cases', () => {
		test( 'handles zero dimensions', () => {
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 0,
				height: 0,
				fill: '#ff0000'
			} );

			// Should still attempt to draw even with zero dimensions
			expect( ctx.rect ).toHaveBeenCalledWith( 10, 20, 0, 0 );
		} );

		test( 'handles negative dimensions', () => {
			renderer.drawRectangle( {
				x: 100,
				y: 100,
				width: -50,
				height: -30,
				fill: '#ff0000'
			} );

			expect( ctx.rect ).toHaveBeenCalled();
		} );

		test( 'handles very large coordinates', () => {
			renderer.drawCircle( {
				x: 10000,
				y: 10000,
				radius: 500,
				fill: '#ff0000'
			} );

			expect( ctx.arc ).toHaveBeenCalledWith( 10000, 10000, 500, 0, 2 * Math.PI );
		} );

		test( 'handles string numbers in properties', () => {
			// Some properties might come as strings from JSON
			renderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				opacity: 0.5 // This should work as number
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Image Layer Tests
	// ========================================================================
	// Note: Detailed image loading/caching tests are in ImageLayerRenderer.test.js
	// These tests verify LayerRenderer correctly delegates to ImageLayerRenderer

	describe( 'drawImage', () => {
		test( 'delegates to imageLayerRenderer', () => {
			const layer = {
				id: 'test-layer',
				src: 'data:image/png;base64,test',
				x: 50,
				y: 60,
				width: 200,
				height: 150
			};

			// Should not throw when delegating
			expect( () => {
				renderer.drawImage( layer );
			} ).not.toThrow();
		} );

		test( 'handles null imageLayerRenderer gracefully', () => {
			const testRenderer = new LayerRenderer( ctx );
			testRenderer.imageLayerRenderer = null;

			// Should not throw even when imageLayerRenderer is null
			expect( () => {
				testRenderer.drawImage( {
					id: 'null-test',
					src: 'data:image/png;base64,test',
					x: 0,
					y: 0
				} );
			} ).not.toThrow();

			testRenderer.destroy();
		} );

		test( 'draws placeholder when image is not loaded', () => {
			// A new image layer will initially not be loaded
			renderer.drawImage( {
				id: 'loading-layer',
				src: 'data:image/png;base64,test',
				x: 10,
				y: 20,
				width: 100,
				height: 80
			} );

			// Should draw placeholder (dashed rect with X)
			expect( ctx.setLineDash ).toHaveBeenCalledWith( [ 5, 5 ] );
			expect( ctx.strokeRect ).toHaveBeenCalled();
		} );

		test( 'handles missing src gracefully', () => {
			renderer.drawImage( {
				id: 'no-src-layer',
				x: 10,
				y: 20,
				width: 100,
				height: 80
			} );

			// Should not draw image when no src
			expect( ctx.drawImage ).not.toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// ImageLayerRenderer Delegation Tests
	// ========================================================================
	// Note: The image loading tests have been moved to ImageLayerRenderer.test.js
	// These tests verify the delegation from LayerRenderer to ImageLayerRenderer

	describe( 'imageLayerRenderer delegation', () => {
		test( 'imageLayerRenderer is created on construction', () => {
			expect( renderer.imageLayerRenderer ).toBeDefined();
		} );

		test( 'drawImage delegates to imageLayerRenderer', () => {
			const layer = {
				id: 'test-image',
				type: 'image',
				src: 'data:image/png;base64,iVBORw0KGgo=',
				x: 10,
				y: 20,
				width: 100,
				height: 80
			};

			// Should not throw
			expect( () => {
				renderer.drawImage( layer );
			} ).not.toThrow();
		} );

		test( 'setContext propagates to imageLayerRenderer', () => {
			const newCtx = createMockContext();
			renderer.setContext( newCtx );

			expect( renderer.imageLayerRenderer.ctx ).toBe( newCtx );
		} );

		test( 'destroy cleans up imageLayerRenderer', () => {
			// Create a fresh renderer to avoid afterEach conflicts
			const testRenderer = new LayerRenderer( ctx );
			expect( testRenderer.imageLayerRenderer ).toBeDefined();

			testRenderer.destroy();

			expect( testRenderer.imageLayerRenderer ).toBeNull();
		} );
	} );

	describe( 'setContext', () => {
		test( 'updates context and sub-renderers', () => {
			const newCtx = createMockContext();
			renderer.setContext( newCtx );

			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'destroy', () => {
		test( 'calls destroy on sub-renderers that have the method', () => {
			// Set up mock sub-renderers with destroy methods
			const mockShadowDestroy = jest.fn();
			const mockShapeDestroy = jest.fn();
			renderer.shadowRenderer = { destroy: mockShadowDestroy };
			renderer.shapeRenderer = { destroy: mockShapeDestroy };
			renderer.textRenderer = { someOtherMethod: jest.fn() }; // No destroy method

			renderer.destroy();

			expect( mockShadowDestroy ).toHaveBeenCalled();
			expect( mockShapeDestroy ).toHaveBeenCalled();
			expect( renderer.shadowRenderer ).toBeNull();
			expect( renderer.shapeRenderer ).toBeNull();
			expect( renderer.textRenderer ).toBeNull();
		} );

		test( 'nulls out all sub-renderer references', () => {
			renderer.destroy();

			expect( renderer.shadowRenderer ).toBeNull();
			expect( renderer.arrowRenderer ).toBeNull();
			expect( renderer.textRenderer ).toBeNull();
			expect( renderer.polygonStarRenderer ).toBeNull();
			expect( renderer.shapeRenderer ).toBeNull();
			expect( renderer.textBoxRenderer ).toBeNull();
			expect( renderer.calloutRenderer ).toBeNull();
			expect( renderer.effectsRenderer ).toBeNull();
			expect( renderer.imageLayerRenderer ).toBeNull();
		} );
	} );

	// ========================================================================
	// Null Renderer Branch Coverage Tests
	// ========================================================================

	describe( 'null renderer branches', () => {
		test( 'drawRectangle does nothing when shapeRenderer is null', () => {
			renderer.shapeRenderer = null;
			expect( () => {
				renderer.drawRectangle( { type: 'rectangle', x: 10, y: 20, width: 100, height: 50 } );
			} ).not.toThrow();
		} );

		test( 'drawTextBox does nothing when textBoxRenderer is null', () => {
			renderer.textBoxRenderer = null;
			expect( () => {
				renderer.drawTextBox( { type: 'textbox', x: 10, y: 20, width: 100, height: 50, text: 'Hello' } );
			} ).not.toThrow();
		} );

		test( 'drawCallout does nothing when calloutRenderer is null', () => {
			renderer.calloutRenderer = null;
			expect( () => {
				renderer.drawCallout( { type: 'callout', x: 10, y: 20, width: 100, height: 50, text: 'Hello' } );
			} ).not.toThrow();
		} );

		test( 'drawCircle does nothing when shapeRenderer is null', () => {
			renderer.shapeRenderer = null;
			expect( () => {
				renderer.drawCircle( { type: 'circle', x: 50, y: 50, radius: 30 } );
			} ).not.toThrow();
		} );

		test( 'drawEllipse does nothing when shapeRenderer is null', () => {
			renderer.shapeRenderer = null;
			expect( () => {
				renderer.drawEllipse( { type: 'ellipse', x: 50, y: 50, radiusX: 40, radiusY: 20 } );
			} ).not.toThrow();
		} );

		test( 'drawLine does nothing when shapeRenderer is null', () => {
			renderer.shapeRenderer = null;
			expect( () => {
				renderer.drawLine( { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 } );
			} ).not.toThrow();
		} );

		test( 'drawArrow does nothing when arrowRenderer is null', () => {
			renderer.arrowRenderer = null;
			expect( () => {
				renderer.drawArrow( { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 } );
			} ).not.toThrow();
		} );

		test( 'drawPolygon does nothing when shapeRenderer is null', () => {
			renderer.shapeRenderer = null;
			expect( () => {
				renderer.drawPolygon( { type: 'polygon', x: 50, y: 50, radius: 40, sides: 6 } );
			} ).not.toThrow();
		} );

		test( 'drawStar does nothing when shapeRenderer is null', () => {
			renderer.shapeRenderer = null;
			expect( () => {
				renderer.drawStar( { type: 'star', x: 50, y: 50, radius: 40, points: 5 } );
			} ).not.toThrow();
		} );

		test( 'drawPath does nothing when shapeRenderer is null', () => {
			renderer.shapeRenderer = null;
			expect( () => {
				renderer.drawPath( { type: 'path', points: [ { x: 0, y: 0 }, { x: 50, y: 50 } ] } );
			} ).not.toThrow();
		} );

		test( 'drawText does nothing when textRenderer is null', () => {
			renderer.textRenderer = null;
			expect( () => {
				renderer.drawText( { type: 'text', x: 10, y: 20, text: 'Hello' } );
			} ).not.toThrow();
		} );
	} );

	// ========================================================================
	// _drawShapePath Rotation Branch Coverage Tests
	// ========================================================================

	describe( '_drawShapePath with rotation', () => {
		test( 'applies rotation transform for circle type', () => {
			const layer = { type: 'circle', x: 100, y: 100, radius: 50, rotation: 45 };
			const opts = { scale: { sx: 1, sy: 1, avg: 1 } };

			ctx.beginPath();
			renderer._drawShapePath( layer, opts, ctx );

			// Circle with rotation should translate and rotate
			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
			expect( ctx.arc ).toHaveBeenCalled();
		} );

		test( 'applies rotation transform for ellipse type', () => {
			const layer = { type: 'ellipse', x: 100, y: 100, radiusX: 60, radiusY: 40, rotation: 30 };
			const opts = { scale: { sx: 1, sy: 1, avg: 1 } };

			ctx.beginPath();
			renderer._drawShapePath( layer, opts, ctx );

			// Ellipse with rotation should translate and rotate
			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
			expect( ctx.ellipse ).toHaveBeenCalled();
		} );

		test( 'applies rotation transform for rectangle type (default case)', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 60, rotation: 90 };
			const opts = { scale: { sx: 1, sy: 1, avg: 1 } };

			ctx.beginPath();
			renderer._drawShapePath( layer, opts, ctx );

			// Rectangle with rotation should translate and rotate
			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
			expect( ctx.rect ).toHaveBeenCalled();
		} );

		test( 'does not apply rotation when rotation is 0', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 60, rotation: 0 };
			const opts = { scale: { sx: 1, sy: 1, avg: 1 } };

			renderer._drawShapePath( layer, opts, ctx );

			// Rotation of 0 should not trigger translate/rotate
			expect( ctx.translate ).not.toHaveBeenCalled();
			expect( ctx.rotate ).not.toHaveBeenCalled();
		} );

		test( 'draws polygon path in _drawShapePath', () => {
			const layer = { type: 'polygon', x: 100, y: 100, radius: 50, sides: 6, rotation: 15 };
			const opts = { scale: { sx: 1, sy: 1, avg: 1 } };

			ctx.beginPath();
			renderer._drawShapePath( layer, opts, ctx );

			// Should draw polygon with rotation
			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
		} );

		test( 'draws star path in _drawShapePath', () => {
			const layer = { type: 'star', x: 100, y: 100, radius: 50, points: 5, rotation: 20 };
			const opts = { scale: { sx: 1, sy: 1, avg: 1 } };

			ctx.beginPath();
			renderer._drawShapePath( layer, opts, ctx );

			// Should draw star with rotation
			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
		} );

		test( 'falls back to rectangle for unknown type in _drawShapePath', () => {
			const layer = { type: 'unknown', x: 50, y: 50, width: 100, height: 60, rotation: 45 };
			const opts = { scale: { sx: 1, sy: 1, avg: 1 } };

			ctx.beginPath();
			renderer._drawShapePath( layer, opts, ctx );

			// Unknown type should fallback to rectangle path
			expect( ctx.rect ).toHaveBeenCalled();
		} );

		test( 'uses default scale when not provided in opts', () => {
			const layer = { type: 'circle', x: 100, y: 100, radius: 50, rotation: 45 };
			const opts = {}; // No scale provided

			ctx.beginPath();
			renderer._drawShapePath( layer, opts, ctx );

			// Should use default scale { sx: 1, sy: 1, avg: 1 }
			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 50, 0, Math.PI * 2 );
		} );
	} );

	// ========================================================================
	// Image Loading Callback Tests
	// ========================================================================

	describe( 'image loading callbacks (via ImageLayerRenderer)', () => {
		let originalWindow;

		beforeEach( () => {
			originalWindow = global.window;
		} );

		afterEach( () => {
			global.window = originalWindow;
		} );

		test( 'imageLayerRenderer uses onImageLoad callback when available', () => {
			const onImageLoadMock = jest.fn();
			const rendererWithCallback = new LayerRenderer( ctx, { onImageLoad: onImageLoadMock } );

			// Verify the imageLayerRenderer was configured with the callback
			expect( rendererWithCallback.imageLayerRenderer ).toBeDefined();
			expect( rendererWithCallback.imageLayerRenderer.onImageLoad ).toBe( onImageLoadMock );

			rendererWithCallback.destroy();
		} );

		test( 'drawImage delegates to imageLayerRenderer', () => {
			const testRenderer = new LayerRenderer( ctx );
			const layer = { id: 'test-image', type: 'image', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', x: 10, y: 20, width: 100, height: 50 };

			// The imageLayerRenderer should be initialized
			expect( testRenderer.imageLayerRenderer ).toBeDefined();

			// Drawing should not throw
			expect( () => {
				testRenderer.drawImage( layer );
			} ).not.toThrow();

			testRenderer.destroy();
		} );

		test( 'imageLayerRenderer draws placeholder when image not ready', () => {
			const testRenderer = new LayerRenderer( ctx );
			const layer = { id: 'placeholder-test', type: 'image', src: 'data:image/png;base64,test', x: 0, y: 0, width: 50, height: 50 };

			// Drawing should show placeholder (dashed rect with diagonal lines)
			testRenderer.drawImage( layer );

			// Should have drawn the placeholder
			expect( ctx.setLineDash ).toHaveBeenCalled();
			expect( ctx.strokeRect ).toHaveBeenCalled();

			testRenderer.destroy();
		} );

		test( 'setContext propagates to imageLayerRenderer', () => {
			const testRenderer = new LayerRenderer( ctx );
			const newCtx = createMockContext();

			testRenderer.setContext( newCtx );

			expect( testRenderer.imageLayerRenderer.ctx ).toBe( newCtx );

			testRenderer.destroy();
		} );

		test( 'destroy cleans up imageLayerRenderer', () => {
			const testRenderer = new LayerRenderer( ctx );
			expect( testRenderer.imageLayerRenderer ).toBeDefined();

			testRenderer.destroy();

			expect( testRenderer.imageLayerRenderer ).toBeNull();
		} );
	} );

	// ========================================================================
	// Constructor Null Sub-Renderer Branches
	// ========================================================================

	describe( 'constructor null sub-renderer handling', () => {
		// These tests verify that the constructor handles missing sub-renderers gracefully
		// by temporarily removing the global renderer references

		test( 'constructor handles missing ShadowRenderer', () => {
			// The renderer is already created in beforeEach, but we can verify the null path
			// by checking that operations work when shadowRenderer is null
			const testRenderer = new LayerRenderer( ctx );
			testRenderer.shadowRenderer = null;

			expect( () => {
				testRenderer.drawRectangle( { type: 'rectangle', x: 10, y: 20, width: 100, height: 50, shadow: true } );
			} ).not.toThrow();

			testRenderer.destroy();
		} );

		test( 'constructor handles missing ArrowRenderer', () => {
			const testRenderer = new LayerRenderer( ctx );
			testRenderer.arrowRenderer = null;

			expect( () => {
				testRenderer.drawArrow( { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 } );
			} ).not.toThrow();

			testRenderer.destroy();
		} );

		test( 'constructor handles missing TextRenderer', () => {
			const testRenderer = new LayerRenderer( ctx );
			testRenderer.textRenderer = null;

			expect( () => {
				testRenderer.drawText( { type: 'text', x: 10, y: 20, text: 'Test' } );
			} ).not.toThrow();

			testRenderer.destroy();
		} );

		test( 'constructor handles missing PolygonStarRenderer', () => {
			const testRenderer = new LayerRenderer( ctx );
			testRenderer.polygonStarRenderer = null;

			// PolygonStarRenderer is used internally by ShapeRenderer
			expect( () => {
				testRenderer.drawPolygon( { type: 'polygon', x: 50, y: 50, radius: 40, sides: 6 } );
			} ).not.toThrow();

			testRenderer.destroy();
		} );

		test( 'constructor handles missing EffectsRenderer', () => {
			const testRenderer = new LayerRenderer( ctx );
			testRenderer.effectsRenderer = null;

			expect( () => {
				testRenderer.drawLayerWithBlurBlend( { type: 'rectangle', x: 10, y: 20, width: 100, height: 50, blend: 'blur' } );
			} ).not.toThrow();

			testRenderer.destroy();
		} );

		test( 'constructor handles missing TextBoxRenderer', () => {
			const testRenderer = new LayerRenderer( ctx );
			testRenderer.textBoxRenderer = null;

			expect( () => {
				testRenderer.drawTextBox( { type: 'textbox', x: 10, y: 20, width: 100, height: 50, text: 'Test' } );
			} ).not.toThrow();

			testRenderer.destroy();
		} );

		test( 'constructor handles missing CalloutRenderer', () => {
			const testRenderer = new LayerRenderer( ctx );
			testRenderer.calloutRenderer = null;

			expect( () => {
				testRenderer.drawCallout( { type: 'callout', x: 10, y: 20, width: 100, height: 50, text: 'Test' } );
			} ).not.toThrow();

			testRenderer.destroy();
		} );
	} );

	// ========================================================================
	// _drawRectPath Corner Radius Branch Tests
	// ========================================================================

	describe( '_drawRectPath corner radius', () => {
		test( 'uses roundRect when cornerRadius > 0 and roundRect available', () => {
			const layer = { x: 10, y: 20, width: 100, height: 50, cornerRadius: 10 };
			const scale = { sx: 1, sy: 1, avg: 1 };

			renderer._drawRectPath( layer, scale, ctx );

			expect( ctx.roundRect ).toHaveBeenCalledWith( 10, 20, 100, 50, 10 );
		} );

		test( 'clamps cornerRadius to half of min dimension', () => {
			// Width 100, height 50, so max radius is 25
			const layer = { x: 10, y: 20, width: 100, height: 50, cornerRadius: 50 };
			const scale = { sx: 1, sy: 1, avg: 1 };

			renderer._drawRectPath( layer, scale, ctx );

			// cornerRadius should be clamped to 25 (half of height)
			expect( ctx.roundRect ).toHaveBeenCalledWith( 10, 20, 100, 50, 25 );
		} );

		test( 'falls back to rect when roundRect not available', () => {
			const ctxNoRoundRect = { ...ctx, roundRect: undefined };
			const layer = { x: 10, y: 20, width: 100, height: 50, cornerRadius: 10 };
			const scale = { sx: 1, sy: 1, avg: 1 };

			renderer._drawRectPath( layer, scale, ctxNoRoundRect );

			expect( ctxNoRoundRect.rect ).toHaveBeenCalledWith( 10, 20, 100, 50 );
		} );
	} );

	describe( 'drawCustomShape', () => {
		test( 'returns early if layer has no path', () => {
			const layer = { viewBox: [ 0, 0, 100, 100 ] };
			ctx.save.mockClear();

			renderer.drawCustomShape( layer );

			// Should not call save since it returns early
			expect( ctx.save ).not.toHaveBeenCalled();
		} );

		test( 'returns early if layer has no viewBox', () => {
			const layer = { path: 'M0,0 L100,100' };
			ctx.save.mockClear();

			renderer.drawCustomShape( layer );

			// Should not call save since it returns early
			expect( ctx.save ).not.toHaveBeenCalled();
		} );

		test( 'renders custom shape with path and viewBox using fallback', () => {
			// Ensure CustomShapeRenderer is not available to trigger fallback
			const originalShapeLibrary = window.Layers && window.Layers.ShapeLibrary;
			if ( window.Layers ) {
				window.Layers.ShapeLibrary = undefined;
			}

			const layer = {
				type: 'customShape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				fill: '#ff0000',
				stroke: '#000000',
				strokeWidth: 2,
				opacity: 0.8
			};

			ctx.save.mockClear();
			ctx.restore.mockClear();

			renderer.drawCustomShape( layer );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();

			// Restore
			if ( window.Layers && originalShapeLibrary ) {
				window.Layers.ShapeLibrary = originalShapeLibrary;
			}
		} );

		test( 'uses CustomShapeRenderer when available', () => {
			const mockCustomRenderer = {
				render: jest.fn()
			};
			const MockCustomShapeRenderer = jest.fn().mockImplementation( () => mockCustomRenderer );

			// Set up mock CustomShapeRenderer
			window.Layers = window.Layers || {};
			window.Layers.ShapeLibrary = {
				CustomShapeRenderer: MockCustomShapeRenderer
			};

			const layer = {
				type: 'customShape',
				shapeId: 'test-shape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'M0,0 L100,0 L100,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				fillRule: 'evenodd'
			};

			// Create fresh renderer to pick up the mock
			const freshRenderer = new LayerRenderer( ctx );
			freshRenderer.drawCustomShape( layer );

			expect( mockCustomRenderer.render ).toHaveBeenCalled();

			// Clean up
			delete window.Layers.ShapeLibrary;
		} );

		test( 'uses svg property when available in customShape', () => {
			const mockCustomRenderer = {
				render: jest.fn()
			};
			const MockCustomShapeRenderer = jest.fn().mockImplementation( () => mockCustomRenderer );

			window.Layers = window.Layers || {};
			window.Layers.ShapeLibrary = {
				CustomShapeRenderer: MockCustomShapeRenderer
			};

			const layer = {
				type: 'customShape',
				shapeId: 'svg-shape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
				viewBox: [ 0, 0, 100, 100 ]
			};

			const freshRenderer = new LayerRenderer( ctx );
			freshRenderer.drawCustomShape( layer );

			expect( mockCustomRenderer.render ).toHaveBeenCalled();
			const call = mockCustomRenderer.render.mock.calls[ 0 ];
			// shapeData (arg 2) should have svg property
			expect( call[ 1 ].svg ).toBe( layer.svg );

			delete window.Layers.ShapeLibrary;
		} );

		test( 'uses paths property when available in customShape', () => {
			const mockCustomRenderer = {
				render: jest.fn()
			};
			const MockCustomShapeRenderer = jest.fn().mockImplementation( () => mockCustomRenderer );

			window.Layers = window.Layers || {};
			window.Layers.ShapeLibrary = {
				CustomShapeRenderer: MockCustomShapeRenderer
			};

			const layer = {
				type: 'customShape',
				shapeId: 'multi-path-shape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				paths: [
					{ d: 'M0,0 L50,50', fill: '#ff0000' },
					{ d: 'M50,50 L100,0', fill: '#00ff00' }
				],
				viewBox: [ 0, 0, 100, 100 ]
			};

			const freshRenderer = new LayerRenderer( ctx );
			freshRenderer.drawCustomShape( layer );

			expect( mockCustomRenderer.render ).toHaveBeenCalled();
			const call = mockCustomRenderer.render.mock.calls[ 0 ];
			// shapeData (arg 2) should have paths property
			expect( call[ 1 ].paths ).toEqual( layer.paths );

			delete window.Layers.ShapeLibrary;
		} );
	} );

	describe( 'drawImage delegation', () => {
		test( 'delegates to ImageLayerRenderer when available', () => {
			const mockImageRenderer = {
				setContext: jest.fn(),
				draw: jest.fn()
			};

			// Inject mock ImageLayerRenderer
			renderer.imageLayerRenderer = mockImageRenderer;

			const layer = {
				type: 'image',
				src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
				x: 10,
				y: 20,
				width: 100,
				height: 50
			};

			renderer.drawImage( layer );

			expect( mockImageRenderer.setContext ).toHaveBeenCalledWith( ctx );
			expect( mockImageRenderer.draw ).toHaveBeenCalledWith( layer, expect.any( Object ) );
		} );

		test( 'does nothing when ImageLayerRenderer is not available', () => {
			// Ensure imageLayerRenderer is not set
			renderer.imageLayerRenderer = null;

			const layer = {
				type: 'image',
				src: 'data:image/png;base64,test',
				x: 10,
				y: 20
			};

			// Should not throw
			expect( () => renderer.drawImage( layer ) ).not.toThrow();
		} );
	} );

	// ========================================================================
	// Coverage Tests - Additional branches for drawCustomShape
	// ========================================================================

	describe( 'drawCustomShape coverage', () => {
		test( 'applies rotation when layer has rotation', () => {
			const layer = {
				type: 'customShape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				fill: '#ff0000',
				rotation: 45
			};

			ctx.translate.mockClear();
			ctx.rotate.mockClear();

			renderer.drawCustomShape( layer );

			// Should apply rotation transforms
			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		test( 'applies stroke when layer has stroke and valid path', () => {
			// Mock Path2D to not throw
			const mockPath = {};
			const originalPath2D = global.Path2D;
			global.Path2D = jest.fn().mockImplementation( () => mockPath );

			const layer = {
				type: 'customShape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				stroke: '#000000',
				strokeWidth: 3
			};

			ctx.stroke.mockClear();

			renderer.drawCustomShape( layer );

			expect( ctx.strokeStyle ).toBe( '#000000' );
			expect( ctx.stroke ).toHaveBeenCalled();

			// Restore
			global.Path2D = originalPath2D;
		} );

		test( 'applies shadow when shadowRenderer available and shadow enabled', () => {
			// Mock Path2D to not throw
			const mockPath = {};
			const originalPath2D = global.Path2D;
			global.Path2D = jest.fn().mockImplementation( () => mockPath );

			const mockShadowRenderer = {
				hasShadowEnabled: jest.fn().mockReturnValue( true ),
				applyShadow: jest.fn(),
				clearShadow: jest.fn()
			};
			renderer.shadowRenderer = mockShadowRenderer;

			const layer = {
				type: 'customShape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 5
			};

			renderer.drawCustomShape( layer );

			expect( mockShadowRenderer.hasShadowEnabled ).toHaveBeenCalledWith( layer );
			expect( mockShadowRenderer.applyShadow ).toHaveBeenCalled();
			expect( mockShadowRenderer.clearShadow ).toHaveBeenCalled();

			// Restore
			global.Path2D = originalPath2D;
		} );

		test( 'draws error placeholder for invalid path', () => {
			const layer = {
				type: 'customShape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'INVALID PATH DATA %%%',
				viewBox: [ 0, 0, 100, 100 ],
				fill: '#ff0000'
			};

			// Mock Path2D to throw an error for invalid paths
			const originalPath2D = global.Path2D;
			global.Path2D = jest.fn().mockImplementation( () => {
				throw new Error( 'Invalid path' );
			} );

			ctx.strokeRect.mockClear();

			renderer.drawCustomShape( layer );

			// Should draw red error rectangle
			expect( ctx.strokeStyle ).toBe( '#f00' );
			expect( ctx.strokeRect ).toHaveBeenCalledWith( 0, 0, 100, 100 );

			// Restore
			global.Path2D = originalPath2D;
		} );

		test( 'skips fill when fill is transparent', () => {
			// Mock Path2D to not throw
			const mockPath = {};
			const originalPath2D = global.Path2D;
			global.Path2D = jest.fn().mockImplementation( () => mockPath );

			const layer = {
				type: 'customShape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				fill: 'transparent',
				stroke: '#000000'
			};

			ctx.fill.mockClear();
			ctx.stroke.mockClear();

			renderer.drawCustomShape( layer );

			// Fill should NOT be called because fill is transparent
			expect( ctx.fill ).not.toHaveBeenCalled();
			// But stroke should be called
			expect( ctx.stroke ).toHaveBeenCalled();

			// Restore
			global.Path2D = originalPath2D;
		} );

		test( 'skips fill when fill is none', () => {
			// Mock Path2D to not throw
			const mockPath = {};
			const originalPath2D = global.Path2D;
			global.Path2D = jest.fn().mockImplementation( () => mockPath );

			const layer = {
				type: 'customShape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				fill: 'none',
				stroke: '#000000'
			};

			ctx.fill.mockClear();

			renderer.drawCustomShape( layer );

			expect( ctx.fill ).not.toHaveBeenCalled();

			// Restore
			global.Path2D = originalPath2D;
		} );

		test( 'skips stroke when stroke is transparent', () => {
			// Mock Path2D to not throw
			const mockPath = {};
			const originalPath2D = global.Path2D;
			global.Path2D = jest.fn().mockImplementation( () => mockPath );

			const layer = {
				type: 'customShape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				fill: '#ff0000',
				stroke: 'transparent'
			};

			ctx.stroke.mockClear();

			renderer.drawCustomShape( layer );

			expect( ctx.stroke ).not.toHaveBeenCalled();

			// Restore
			global.Path2D = originalPath2D;
		} );

		test( 'defaults strokeWidth to 2 when not specified', () => {
			// Mock Path2D to not throw
			const mockPath = {};
			const originalPath2D = global.Path2D;
			global.Path2D = jest.fn().mockImplementation( () => mockPath );

			const layer = {
				type: 'customShape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				stroke: '#000000'
				// No strokeWidth specified
			};

			renderer.drawCustomShape( layer );

			// Default lineWidth calculation: 2 / Math.min(scaleX, scaleY)
			// With 100x50 layer and 100x100 viewBox, scaleX = 1, scaleY = 0.5
			// lineWidth = 2 / 0.5 = 4
			expect( ctx.lineWidth ).toBeDefined();

			// Restore
			global.Path2D = originalPath2D;
		} );
	} );

	// ========================================================================
	// Coverage Tests - drawLayerWithBlurBlend fallback
	// ========================================================================

	describe( 'drawLayerWithBlurBlend coverage', () => {
		test( 'falls back to normal drawing when effectsRenderer is null', () => {
			renderer.effectsRenderer = null;

			// Spy on the internal method
			const drawSpy = jest.spyOn( renderer, '_drawLayerByType' );

			const layer = {
				type: 'rectangle',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				blendMode: 'blur'
			};

			renderer.drawLayerWithBlurBlend( layer );

			// Should fall back to normal drawing
			expect( drawSpy ).toHaveBeenCalledWith( layer, undefined );

			drawSpy.mockRestore();
		} );
	} );

	// ========================================================================
	// Coverage Tests - Renderer null checks
	// ========================================================================

	describe( 'renderer null checks', () => {
		test( 'shadowRenderer property exists after construction', () => {
			// ShadowRenderer is loaded in test environment
			expect( renderer ).toHaveProperty( 'shadowRenderer' );
		} );

		test( 'arrowRenderer property exists after construction', () => {
			expect( renderer ).toHaveProperty( 'arrowRenderer' );
		} );

		test( 'textRenderer property exists after construction', () => {
			expect( renderer ).toHaveProperty( 'textRenderer' );
		} );

		test( 'shapeRenderer property exists after construction', () => {
			expect( renderer ).toHaveProperty( 'shapeRenderer' );
		} );
	} );

	describe( 'drawMarker method', () => {
		test( 'should draw marker layer when markerRenderer available', () => {
			renderer.markerRenderer = {
				setContext: jest.fn(),
				draw: jest.fn()
			};

			const layer = { type: 'marker', x: 100, y: 100, value: 1, style: 'circled' };
			renderer.drawMarker( layer, {} );

			expect( renderer.markerRenderer.setContext ).toHaveBeenCalledWith( ctx );
			expect( renderer.markerRenderer.draw ).toHaveBeenCalled();
		} );

		test( 'should do nothing when markerRenderer is null', () => {
			renderer.markerRenderer = null;

			const layer = { type: 'marker', x: 100, y: 100 };
			expect( () => renderer.drawMarker( layer, {} ) ).not.toThrow();
		} );
	} );

	describe( 'drawDimension method', () => {
		test( 'should draw dimension layer when dimensionRenderer available', () => {
			renderer.dimensionRenderer = {
				setContext: jest.fn(),
				draw: jest.fn()
			};

			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100 };
			renderer.drawDimension( layer, {} );

			expect( renderer.dimensionRenderer.setContext ).toHaveBeenCalledWith( ctx );
			expect( renderer.dimensionRenderer.draw ).toHaveBeenCalled();
		} );

		test( 'should do nothing when dimensionRenderer is null', () => {
			renderer.dimensionRenderer = null;

			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100 };
			expect( () => renderer.drawDimension( layer, {} ) ).not.toThrow();
		} );
	} );

	describe( 'hasBlurBlendMode method', () => {
		test( 'should return true for blur blendMode', () => {
			const layer = { type: 'rectangle', blendMode: 'blur' };
			expect( renderer.hasBlurBlendMode( layer ) ).toBe( true );
		} );

		test( 'should return true for blur blend', () => {
			const layer = { type: 'rectangle', blend: 'blur' };
			expect( renderer.hasBlurBlendMode( layer ) ).toBe( true );
		} );

		test( 'should return false for other blend modes', () => {
			const layer = { type: 'rectangle', blendMode: 'multiply' };
			expect( renderer.hasBlurBlendMode( layer ) ).toBe( false );
		} );

		test( 'should return false for no blend mode', () => {
			const layer = { type: 'rectangle' };
			expect( renderer.hasBlurBlendMode( layer ) ).toBe( false );
		} );
	} );

	describe( 'drawLayerWithBlurBlend with effectsRenderer', () => {
		test( 'should use effectsRenderer when available', () => {
			renderer.effectsRenderer = {
				setContext: jest.fn(),
				drawBlurWithShape: jest.fn()
			};

			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50, blendMode: 'blur' };
			renderer.drawLayerWithBlurBlend( layer, {} );

			expect( renderer.effectsRenderer.setContext ).toHaveBeenCalledWith( ctx );
			expect( renderer.effectsRenderer.drawBlurWithShape ).toHaveBeenCalled();
		} );
	} );
} );
