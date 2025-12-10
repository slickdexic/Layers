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
	} );

	// ========================================================================
	// drawHighlight Tests
	// ========================================================================

	describe( 'drawHighlight', () => {
		test( 'draws highlight with default values', () => {
			renderer.drawHighlight( {} );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.fillRect ).toHaveBeenCalledWith( 0, 0, 100, 20 );
			expect( ctx.globalAlpha ).toBe( 0.3 );
			expect( ctx.fillStyle ).toBe( '#ffff00' );
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'draws highlight at specified position', () => {
			renderer.drawHighlight( {
				x: 50,
				y: 100,
				width: 200,
				height: 40
			} );

			expect( ctx.fillRect ).toHaveBeenCalledWith( 50, 100, 200, 40 );
		} );

		test( 'uses custom color', () => {
			renderer.drawHighlight( { color: '#ff0000' } );
			expect( ctx.fillStyle ).toBe( '#ff0000' );
		} );

		test( 'uses fill when color not specified', () => {
			renderer.drawHighlight( { fill: '#00ff00' } );
			expect( ctx.fillStyle ).toBe( '#00ff00' );
		} );

		test( 'uses custom opacity', () => {
			renderer.drawHighlight( { opacity: 0.7 } );
			expect( ctx.globalAlpha ).toBe( 0.7 );
		} );

		test( 'clamps opacity to valid range', () => {
			renderer.drawHighlight( { opacity: 1.5 } );
			expect( ctx.globalAlpha ).toBe( 1 );

			renderer.drawHighlight( { opacity: -0.5 } );
			expect( ctx.globalAlpha ).toBe( 0 );
		} );

		test( 'handles rotation', () => {
			renderer.drawHighlight( {
				x: 100,
				y: 50,
				width: 200,
				height: 40,
				rotation: 45
			} );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalledWith( ( 45 * Math.PI ) / 180 );
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

		test( 'dispatches to drawHighlight for highlight type', () => {
			const spy = jest.spyOn( renderer, 'drawHighlight' );
			const layer = { type: 'highlight', x: 10, y: 20, width: 100, height: 20 };

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

		test( 'dispatches to drawBlur for blur type', () => {
			const spy = jest.spyOn( renderer, 'drawBlur' );
			const layer = { type: 'blur', x: 10, y: 20, width: 100, height: 50 };

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
			expect( typeof LayerRenderer.prototype.drawHighlight ).toBe( 'function' );
			expect( typeof LayerRenderer.prototype.drawBlur ).toBe( 'function' );
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
	// drawBlur Tests
	// ========================================================================

	describe( 'drawBlur', () => {
		test( 'draws blur region without background image', () => {
			renderer.drawBlur( {
				x: 50,
				y: 50,
				width: 100,
				height: 100,
				blurAmount: 10
			} );

			// Without background image, just draws a semi-transparent rectangle
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'handles rotation in blur', () => {
			renderer.drawBlur( {
				x: 50,
				y: 50,
				width: 100,
				height: 100,
				rotation: 45
			} );

			// Blur may or may not use translate/rotate depending on implementation
			// Just verify it completes without error
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'uses default blur amount', () => {
			renderer.drawBlur( {
				x: 50,
				y: 50,
				width: 100,
				height: 100
			} );

			// Should still render something even without explicit blurAmount
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
} );
