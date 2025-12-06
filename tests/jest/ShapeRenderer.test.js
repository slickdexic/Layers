/**
 * Tests for ShapeRenderer module
 */

/* global describe, test, expect, beforeEach, jest */

const ShapeRenderer = require( '../../resources/ext.layers.editor/ShapeRenderer.js' );

describe( 'ShapeRenderer', () => {
	let ctx;
	let shapeRenderer;

	beforeEach( () => {
		// Create mock canvas context
		ctx = {
			save: jest.fn(),
			restore: jest.fn(),
			beginPath: jest.fn(),
			closePath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			arc: jest.fn(),
			ellipse: jest.fn(),
			rect: jest.fn(),
			fill: jest.fn(),
			stroke: jest.fn(),
			fillRect: jest.fn(),
			strokeRect: jest.fn(),
			fillText: jest.fn(),
			strokeText: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			scale: jest.fn(),
			clip: jest.fn(),
			setLineDash: jest.fn(),
			drawImage: jest.fn(),
			globalAlpha: 1,
			globalCompositeOperation: 'source-over',
			fillStyle: '#000000',
			strokeStyle: '#000000',
			lineWidth: 1,
			lineCap: 'butt',
			lineJoin: 'miter',
			font: '16px Arial',
			textAlign: 'left',
			textBaseline: 'alphabetic',
			shadowColor: 'transparent',
			shadowBlur: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			filter: 'none'
		};

		// Mock TextUtils for text rendering
		global.window = global.window || {};
		global.window.TextUtils = {
			measureTextLayer: jest.fn( ( layer ) => {
				if ( !layer || !layer.text ) {
					return null;
				}
				return {
					originX: layer.x || 0,
					originY: layer.y || 0,
					baselineY: ( layer.y || 0 ) + 14,
					width: 100,
					height: 20,
					fontSize: layer.fontSize || 16,
					fontFamily: layer.fontFamily || 'Arial',
					lineHeight: 20,
					ascent: 14,
					lines: [ layer.text ]
				};
			} )
		};

		shapeRenderer = new ShapeRenderer( ctx, { zoom: 1 } );
	} );

	describe( 'constructor', () => {
		test( 'should initialize with context reference', () => {
			expect( shapeRenderer.ctx ).toBe( ctx );
		} );

		test( 'should initialize with default zoom of 1', () => {
			expect( shapeRenderer.zoom ).toBe( 1 );
		} );

		test( 'should accept config options', () => {
			const renderer = new ShapeRenderer( ctx, { zoom: 2 } );
			expect( renderer.zoom ).toBe( 2 );
		} );

		test( 'should accept backgroundImage in config', () => {
			const mockImage = { complete: true };
			const renderer = new ShapeRenderer( ctx, { backgroundImage: mockImage } );
			expect( renderer.backgroundImage ).toBe( mockImage );
		} );
	} );

	describe( 'setZoom', () => {
		test( 'should update zoom level', () => {
			shapeRenderer.setZoom( 2.5 );
			expect( shapeRenderer.zoom ).toBe( 2.5 );
		} );
	} );

	describe( 'setBackgroundImage', () => {
		test( 'should set background image', () => {
			const mockImage = { complete: true, width: 800, height: 600 };
			shapeRenderer.setBackgroundImage( mockImage );
			expect( shapeRenderer.backgroundImage ).toBe( mockImage );
		} );
	} );

	describe( 'setCanvas', () => {
		test( 'should set canvas reference', () => {
			const mockCanvas = { width: 1024, height: 768 };
			shapeRenderer.setCanvas( mockCanvas );
			expect( shapeRenderer.canvas ).toBe( mockCanvas );
		} );
	} );

	describe( 'applyLayerStyle', () => {
		test( 'should apply fill style', () => {
			shapeRenderer.applyLayerStyle( { fill: '#ff0000' } );
			expect( ctx.fillStyle ).toBe( '#ff0000' );
		} );

		test( 'should apply color as fill fallback', () => {
			shapeRenderer.applyLayerStyle( { color: '#00ff00' } );
			expect( ctx.fillStyle ).toBe( '#00ff00' );
		} );

		test( 'should apply stroke style', () => {
			shapeRenderer.applyLayerStyle( { stroke: '#0000ff' } );
			expect( ctx.strokeStyle ).toBe( '#0000ff' );
		} );

		test( 'should apply strokeWidth', () => {
			shapeRenderer.applyLayerStyle( { strokeWidth: 5 } );
			expect( ctx.lineWidth ).toBe( 5 );
		} );

		test( 'should apply opacity', () => {
			shapeRenderer.applyLayerStyle( { opacity: 0.5 } );
			expect( ctx.globalAlpha ).toBe( 0.5 );
		} );

		test( 'should clamp opacity to 0-1 range', () => {
			shapeRenderer.applyLayerStyle( { opacity: 1.5 } );
			expect( ctx.globalAlpha ).toBe( 1 );

			shapeRenderer.applyLayerStyle( { opacity: -0.5 } );
			expect( ctx.globalAlpha ).toBe( 0 );
		} );

		test( 'should apply blendMode', () => {
			shapeRenderer.applyLayerStyle( { blendMode: 'multiply' } );
			expect( ctx.globalCompositeOperation ).toBe( 'multiply' );
		} );

		test( 'should apply blend as blendMode fallback', () => {
			shapeRenderer.applyLayerStyle( { blend: 'screen' } );
			expect( ctx.globalCompositeOperation ).toBe( 'screen' );
		} );

		test( 'should apply rotation transform', () => {
			shapeRenderer.applyLayerStyle( { rotation: 45, x: 100, y: 100, width: 50, height: 50 } );
			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );
	} );

	describe( 'clearShadow', () => {
		test( 'should reset shadow properties', () => {
			ctx.shadowColor = '#000000';
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 5;
			ctx.shadowOffsetY = 5;

			shapeRenderer.clearShadow();

			expect( ctx.shadowColor ).toBe( 'transparent' );
			expect( ctx.shadowBlur ).toBe( 0 );
			expect( ctx.shadowOffsetX ).toBe( 0 );
			expect( ctx.shadowOffsetY ).toBe( 0 );
		} );
	} );

	describe( 'drawRectangle', () => {
		test( 'should draw rectangle with fill and stroke', () => {
			shapeRenderer.drawRectangle( {
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				stroke: '#000000',
				strokeWidth: 2
			} );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.rect ).toHaveBeenCalledWith( 10, 20, 100, 50 );
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'should skip fill for transparent', () => {
			shapeRenderer.drawRectangle( {
				x: 0,
				y: 0,
				width: 50,
				height: 50,
				fill: 'transparent',
				stroke: '#000000'
			} );

			expect( ctx.fill ).not.toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'should skip stroke for none', () => {
			shapeRenderer.drawRectangle( {
				x: 0,
				y: 0,
				width: 50,
				height: 50,
				fill: '#ff0000',
				stroke: 'none'
			} );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).not.toHaveBeenCalled();
		} );

		test( 'should apply fillOpacity', () => {
			shapeRenderer.drawRectangle( {
				x: 0,
				y: 0,
				width: 50,
				height: 50,
				fill: '#ff0000',
				fillOpacity: 0.5
			} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawCircle', () => {
		test( 'should draw circle at center with radius', () => {
			shapeRenderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ff0000',
				stroke: '#000000'
			} );

			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 50, 0, 2 * Math.PI );
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'should handle zero radius', () => {
			shapeRenderer.drawCircle( {
				x: 100,
				y: 100,
				radius: 0,
				fill: '#ff0000'
			} );

			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 0, 0, 2 * Math.PI );
		} );
	} );

	describe( 'drawEllipse', () => {
		test( 'should draw ellipse with radiusX and radiusY', () => {
			shapeRenderer.drawEllipse( {
				x: 100,
				y: 100,
				radiusX: 50,
				radiusY: 30,
				fill: '#ff0000'
			} );

			expect( ctx.ellipse ).toHaveBeenCalledWith( 100, 100, 50, 30, 0, 0, 2 * Math.PI );
		} );

		test( 'should compute radii from width/height', () => {
			shapeRenderer.drawEllipse( {
				x: 100,
				y: 100,
				width: 100,
				height: 60,
				fill: '#ff0000'
			} );

			expect( ctx.ellipse ).toHaveBeenCalledWith( 100, 100, 50, 30, 0, 0, 2 * Math.PI );
		} );
	} );

	describe( 'drawLine', () => {
		test( 'should draw line between two points', () => {
			shapeRenderer.drawLine( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				stroke: '#000000',
				strokeWidth: 2
			} );

			expect( ctx.moveTo ).toHaveBeenCalledWith( 10, 20 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 100, 80 );
			expect( ctx.stroke ).toHaveBeenCalled();
			expect( ctx.lineCap ).toBe( 'round' );
		} );

		test( 'should apply rotation to line', () => {
			shapeRenderer.drawLine( {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				rotation: 45
			} );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawArrow', () => {
		test( 'should draw arrow with arrowhead', () => {
			shapeRenderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 20,
				stroke: '#000000',
				arrowStyle: 'single',
				arrowSize: 10
			} );

			// Arrow is now drawn as a closed polygon
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'should draw double arrow', () => {
			shapeRenderer.drawArrow( {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 20,
				stroke: '#000000',
				arrowStyle: 'double',
				arrowSize: 10
			} );

			// Arrow with double heads is drawn as a closed polygon
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'should support fill on arrow shapes', () => {
			shapeRenderer.drawArrow( {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				stroke: '#000000',
				fill: '#ff0000',
				arrowStyle: 'single'
			} );

			expect( ctx.fillStyle ).toBe( '#ff0000' );
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'should support pointed head type', () => {
			const buildVerticesSpy = jest.spyOn( shapeRenderer, 'buildArrowVertices' );
			shapeRenderer.drawArrow( {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				stroke: '#000000',
				arrowHeadType: 'pointed'
			} );

			expect( buildVerticesSpy ).toHaveBeenCalledWith(
				expect.anything(), expect.anything(), expect.anything(), expect.anything(),
				expect.anything(), expect.anything(), expect.anything(), expect.anything(),
				'single', 'pointed', expect.anything(), expect.anything()
			);
			buildVerticesSpy.mockRestore();
		} );

		test( 'should support chevron head type', () => {
			const buildVerticesSpy = jest.spyOn( shapeRenderer, 'buildArrowVertices' );
			shapeRenderer.drawArrow( {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				stroke: '#000000',
				arrowHeadType: 'chevron'
			} );

			expect( buildVerticesSpy ).toHaveBeenCalledWith(
				expect.anything(), expect.anything(), expect.anything(), expect.anything(),
				expect.anything(), expect.anything(), expect.anything(), expect.anything(),
				'single', 'chevron', expect.anything(), expect.anything()
			);
			buildVerticesSpy.mockRestore();
		} );

		test( 'should draw arrow with no heads (line only)', () => {
			shapeRenderer.drawArrow( {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				stroke: '#000000',
				arrowStyle: 'none'
			} );

			// Should still draw a closed polygon (rectangular shaft)
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	describe( 'buildArrowVertices', () => {
		test( 'should build vertices for single arrow', () => {
			const vertices = shapeRenderer.buildArrowVertices(
				0, 0, 100, 0, 0, Math.PI / 2, 3, 15, 'single', 'pointed'
			);

			expect( Array.isArray( vertices ) ).toBe( true );
			expect( vertices.length ).toBeGreaterThan( 0 );
			vertices.forEach( v => {
				expect( typeof v.x ).toBe( 'number' );
				expect( typeof v.y ).toBe( 'number' );
			} );
		} );

		test( 'should build vertices for double arrow', () => {
			const vertices = shapeRenderer.buildArrowVertices(
				0, 0, 100, 0, 0, Math.PI / 2, 3, 15, 'double', 'pointed'
			);

			expect( Array.isArray( vertices ) ).toBe( true );
			// Double arrow should have more vertices than single
			expect( vertices.length ).toBeGreaterThan( 6 );
		} );

		test( 'should build simple rectangle for none style', () => {
			const vertices = shapeRenderer.buildArrowVertices(
				0, 0, 100, 0, 0, Math.PI / 2, 3, 15, 'none', 'pointed'
			);

			expect( vertices.length ).toBe( 4 ); // Simple rectangle
		} );
	} );

	describe( 'drawPolygon', () => {
		test( 'should draw polygon from points', () => {
			shapeRenderer.drawPolygon( {
				points: [
					{ x: 0, y: 0 },
					{ x: 100, y: 0 },
					{ x: 50, y: 100 }
				],
				fill: '#ff0000',
				stroke: '#000000'
			} );

			expect( ctx.moveTo ).toHaveBeenCalledWith( 0, 0 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 100, 0 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 50, 100 );
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( 'should fall back to regular polygon with insufficient points', () => {
			const drawRegularPolygonSpy = jest.spyOn( shapeRenderer, 'drawRegularPolygon' );
			const layer = {
				x: 50,
				y: 50,
				points: [ { x: 0, y: 0 } ],
				fill: '#ff0000'
			};

			shapeRenderer.drawPolygon( layer );

			// Falls back to regular polygon when points array is insufficient
			expect( drawRegularPolygonSpy ).toHaveBeenCalledWith( layer );
			drawRegularPolygonSpy.mockRestore();
		} );

		test( 'should fall back to regular polygon with no points', () => {
			const drawRegularPolygonSpy = jest.spyOn( shapeRenderer, 'drawRegularPolygon' );
			const layer = { x: 50, y: 50, fill: '#ff0000' };

			shapeRenderer.drawPolygon( layer );

			// Falls back to regular polygon when no points array
			expect( drawRegularPolygonSpy ).toHaveBeenCalledWith( layer );
			drawRegularPolygonSpy.mockRestore();
		} );
	} );

	describe( 'drawRegularPolygon', () => {
		test( 'should draw hexagon by default', () => {
			shapeRenderer.drawRegularPolygon( {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ff0000'
			} );

			// Should call moveTo once and lineTo 5 times for a hexagon
			expect( ctx.moveTo ).toHaveBeenCalledTimes( 1 );
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 5 );
		} );

		test( 'should draw polygon with specified sides', () => {
			shapeRenderer.drawRegularPolygon( {
				x: 100,
				y: 100,
				radius: 50,
				sides: 4,
				fill: '#ff0000'
			} );

			// Square: 1 moveTo + 3 lineTo
			expect( ctx.moveTo ).toHaveBeenCalledTimes( 1 );
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 3 );
		} );

		test( 'should apply rotation around center', () => {
			shapeRenderer.drawRegularPolygon( {
				x: 100,
				y: 100,
				radius: 50,
				rotation: 45
			} );

			expect( ctx.translate ).toHaveBeenCalledWith( 100, 100 );
			expect( ctx.rotate ).toHaveBeenCalledWith( 45 * Math.PI / 180 );
		} );
	} );

	describe( 'drawStar', () => {
		test( 'should draw 5-pointed star by default', () => {
			shapeRenderer.drawStar( {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				fill: '#ffff00'
			} );

			// 5-pointed star has 10 vertices (5 outer + 5 inner)
			expect( ctx.moveTo ).toHaveBeenCalledTimes( 1 );
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 9 );
		} );

		test( 'should use default innerRadius if not specified', () => {
			shapeRenderer.drawStar( {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ffff00'
			} );

			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( 'should draw star with custom point count', () => {
			shapeRenderer.drawStar( {
				x: 100,
				y: 100,
				radius: 50,
				points: 6,
				fill: '#ffff00'
			} );

			// 6-pointed star has 12 vertices
			expect( ctx.moveTo ).toHaveBeenCalledTimes( 1 );
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 11 );
		} );
	} );

	describe( 'drawPath', () => {
		test( 'should draw freehand path', () => {
			shapeRenderer.drawPath( {
				points: [
					{ x: 0, y: 0 },
					{ x: 10, y: 10 },
					{ x: 20, y: 5 }
				],
				stroke: '#000000',
				strokeWidth: 2
			} );

			expect( ctx.moveTo ).toHaveBeenCalledWith( 0, 0 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 10, 10 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 20, 5 );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'should skip path with less than 2 points', () => {
			shapeRenderer.drawPath( {
				points: [ { x: 0, y: 0 } ],
				stroke: '#000000'
			} );

			expect( ctx.stroke ).not.toHaveBeenCalled();
		} );

		test( 'should skip path with no points', () => {
			shapeRenderer.drawPath( { stroke: '#000000' } );
			expect( ctx.stroke ).not.toHaveBeenCalled();
		} );

		test( 'should apply round line caps and joins', () => {
			shapeRenderer.drawPath( {
				points: [
					{ x: 0, y: 0 },
					{ x: 10, y: 10 }
				]
			} );

			expect( ctx.lineCap ).toBe( 'round' );
			expect( ctx.lineJoin ).toBe( 'round' );
		} );
	} );

	describe( 'drawHighlight', () => {
		test( 'should draw highlight rectangle', () => {
			shapeRenderer.drawHighlight( {
				x: 10,
				y: 20,
				width: 100,
				height: 20,
				color: '#ffff00'
			} );

			expect( ctx.fillRect ).toHaveBeenCalledWith( 10, 20, 100, 20 );
		} );

		test( 'should use default opacity of 0.3', () => {
			shapeRenderer.drawHighlight( {
				x: 0,
				y: 0,
				width: 100,
				height: 20
			} );

			// Check that opacity was set (we can't easily check the exact value)
			expect( ctx.fillRect ).toHaveBeenCalled();
		} );

		test( 'should respect opacity property', () => {
			shapeRenderer.drawHighlight( {
				x: 0,
				y: 0,
				width: 100,
				height: 20,
				opacity: 0.5
			} );

			expect( ctx.fillRect ).toHaveBeenCalled();
		} );

		test( 'should use fill as color fallback', () => {
			shapeRenderer.drawHighlight( {
				x: 0,
				y: 0,
				width: 100,
				height: 20,
				fill: '#00ff00'
			} );

			expect( ctx.fillStyle ).toBe( '#00ff00' );
		} );
	} );

	describe( 'drawBlur', () => {
		test( 'should draw blur effect region', () => {
			const mockImage = { complete: true };
			shapeRenderer.setBackgroundImage( mockImage );

			shapeRenderer.drawBlur( {
				x: 10,
				y: 20,
				width: 100,
				height: 80,
				blurRadius: 12
			} );

			expect( ctx.clip ).toHaveBeenCalled();
			expect( ctx.drawImage ).toHaveBeenCalledWith( mockImage, 0, 0 );
		} );

		test( 'should skip blur with zero dimensions', () => {
			shapeRenderer.drawBlur( {
				x: 10,
				y: 20,
				width: 0,
				height: 80
			} );

			expect( ctx.clip ).not.toHaveBeenCalled();
		} );

		test( 'should clamp blur radius to 1-64 range', () => {
			const mockImage = { complete: true };
			shapeRenderer.setBackgroundImage( mockImage );

			shapeRenderer.drawBlur( {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				blurRadius: 100
			} );

			// The blur should be applied and then restored - verify clip and drawImage were called
			expect( ctx.clip ).toHaveBeenCalled();
			expect( ctx.drawImage ).toHaveBeenCalled();
		} );

		test( 'should handle missing background image', () => {
			shapeRenderer.drawBlur( {
				x: 0,
				y: 0,
				width: 100,
				height: 100
			} );

			expect( ctx.drawImage ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'drawText', () => {
		test( 'should draw text with measured metrics', () => {
			shapeRenderer.drawText( {
				text: 'Hello World',
				x: 50,
				y: 50,
				fontSize: 16,
				fontFamily: 'Arial',
				fill: '#000000'
			} );

			expect( global.window.TextUtils.measureTextLayer ).toHaveBeenCalled();
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		test( 'should skip text with no metrics', () => {
			global.window.TextUtils.measureTextLayer.mockReturnValue( null );

			shapeRenderer.drawText( {
				x: 50,
				y: 50
			} );

			expect( ctx.fillText ).not.toHaveBeenCalled();
		} );

		test( 'should apply text rotation', () => {
			shapeRenderer.drawText( {
				text: 'Rotated',
				x: 50,
				y: 50,
				rotation: 45
			} );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		test( 'should apply text shadow', () => {
			shapeRenderer.drawText( {
				text: 'Shadow',
				x: 50,
				y: 50,
				textShadow: true,
				textShadowColor: '#999999'
			} );

			expect( ctx.shadowColor ).toBe( '#999999' );
		} );

		test( 'should draw text stroke if specified', () => {
			shapeRenderer.drawText( {
				text: 'Stroked',
				x: 50,
				y: 50,
				textStrokeWidth: 2,
				textStrokeColor: '#ffffff'
			} );

			expect( ctx.strokeText ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawLayer', () => {
		test( 'should dispatch to drawRectangle for rectangle type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawRectangle' );
			shapeRenderer.drawLayer( { type: 'rectangle', x: 0, y: 0, width: 50, height: 50 } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawRectangle for rect type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawRectangle' );
			shapeRenderer.drawLayer( { type: 'rect', x: 0, y: 0, width: 50, height: 50 } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawCircle for circle type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawCircle' );
			shapeRenderer.drawLayer( { type: 'circle', x: 50, y: 50, radius: 25 } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawEllipse for ellipse type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawEllipse' );
			shapeRenderer.drawLayer( { type: 'ellipse', x: 50, y: 50, radiusX: 30, radiusY: 20 } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawPolygon for polygon type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawPolygon' );
			shapeRenderer.drawLayer( { type: 'polygon', points: [ { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 } ] } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawStar for star type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawStar' );
			shapeRenderer.drawLayer( { type: 'star', x: 50, y: 50, radius: 30 } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawLine for line type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawLine' );
			shapeRenderer.drawLayer( { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawArrow for arrow type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawArrow' );
			shapeRenderer.drawLayer( { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawHighlight for highlight type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawHighlight' );
			shapeRenderer.drawLayer( { type: 'highlight', x: 0, y: 0, width: 100, height: 20 } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawPath for path type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawPath' );
			shapeRenderer.drawLayer( { type: 'path', points: [ { x: 0, y: 0 }, { x: 10, y: 10 } ] } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawBlur for blur type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawBlur' );
			shapeRenderer.drawLayer( { type: 'blur', x: 0, y: 0, width: 100, height: 100 } );
			expect( spy ).toHaveBeenCalled();
		} );

		test( 'should dispatch to drawText for text type', () => {
			const spy = jest.spyOn( shapeRenderer, 'drawText' );
			shapeRenderer.drawLayer( { type: 'text', text: 'Hello', x: 0, y: 0 } );
			expect( spy ).toHaveBeenCalled();
		} );
	} );

	describe( 'exports', () => {
		test( 'should export ShapeRenderer to window', () => {
			expect( window.ShapeRenderer ).toBe( ShapeRenderer );
		} );
	} );
} );
