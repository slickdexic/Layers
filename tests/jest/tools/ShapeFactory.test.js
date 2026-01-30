/**
 * Tests for ShapeFactory module
 *
 * @jest-environment jsdom
 */

'use strict';

const ShapeFactory = require( '../../../resources/ext.layers.editor/tools/ShapeFactory.js' );

describe( 'ShapeFactory', () => {
	let factory;
	let mockStyleManager;

	beforeEach( () => {
		// Mock style manager that implements the get() method
		mockStyleManager = {
			get: jest.fn( () => ( {
				color: '#ff0000',
				fill: '#00ff00',
				strokeWidth: 3,
				shadow: false,
				shadowColor: '#000000',
				shadowBlur: 8,
				shadowOffsetX: 2,
				shadowOffsetY: 2,
				arrowStyle: 'single',
				fontSize: 16,
				fontFamily: 'Arial'
			} ) )
		};
		factory = new ShapeFactory( { styleManager: mockStyleManager } );
	} );

	describe( 'constructor', () => {
		it( 'should store style manager reference', () => {
			expect( factory.styleManager ).toBe( mockStyleManager );
		} );

		it( 'should work without style manager', () => {
			const factoryNoStyle = new ShapeFactory();
			expect( factoryNoStyle.styleManager ).toBeNull();
		} );
	} );

	describe( 'getCurrentStyle', () => {
		it( 'should get style from style manager', () => {
			const style = factory.getCurrentStyle();
			expect( mockStyleManager.get ).toHaveBeenCalled();
			expect( style.color ).toBe( '#ff0000' );
		} );

		it( 'should return defaults when no style manager', () => {
			const factoryNoStyle = new ShapeFactory();
			const style = factoryNoStyle.getCurrentStyle();
			expect( style.color ).toBe( '#000000' );
			expect( style.strokeWidth ).toBe( 2 );
		} );
	} );

	describe( 'createRectangle', () => {
		it( 'should create rectangle layer with correct properties', () => {
			const point = { x: 100, y: 200 };
			const layer = factory.createRectangle( point );

			expect( layer.type ).toBe( 'rectangle' );
			expect( layer.x ).toBe( 100 );
			expect( layer.y ).toBe( 200 );
			expect( layer.width ).toBe( 0 );
			expect( layer.height ).toBe( 0 );
		} );

		it( 'should apply current style', () => {
			const layer = factory.createRectangle( { x: 0, y: 0 } );

			expect( layer.stroke ).toBe( '#ff0000' );
			expect( layer.fill ).toBe( '#00ff00' );
			expect( layer.strokeWidth ).toBe( 3 );
		} );

		it( 'should apply shadow properties', () => {
			mockStyleManager.get.mockReturnValue( {
				color: '#ff0000',
				fill: '#00ff00',
				strokeWidth: 3,
				shadow: true,
				shadowColor: '#333333',
				shadowBlur: 10
			} );
			const layer = factory.createRectangle( { x: 0, y: 0 } );

			expect( layer.shadow ).toBe( true );
			expect( layer.shadowColor ).toBe( '#333333' );
		} );
	} );

	describe( 'createCircle', () => {
		it( 'should create circle layer with correct properties', () => {
			const point = { x: 150, y: 250 };
			const layer = factory.createCircle( point );

			expect( layer.type ).toBe( 'circle' );
			expect( layer.x ).toBe( 150 );
			expect( layer.y ).toBe( 250 );
			expect( layer.radius ).toBe( 0 );
		} );

		it( 'should apply stroke and fill', () => {
			const layer = factory.createCircle( { x: 0, y: 0 } );

			expect( layer.stroke ).toBe( '#ff0000' );
			expect( layer.fill ).toBe( '#00ff00' );
		} );
	} );

	describe( 'createEllipse', () => {
		it( 'should create ellipse layer with correct properties', () => {
			const point = { x: 200, y: 300 };
			const layer = factory.createEllipse( point );

			expect( layer.type ).toBe( 'ellipse' );
			expect( layer.x ).toBe( 200 );
			expect( layer.y ).toBe( 300 );
			expect( layer.radiusX ).toBe( 0 );
			expect( layer.radiusY ).toBe( 0 );
		} );
	} );

	describe( 'createLine', () => {
		it( 'should create line layer with correct properties', () => {
			const point = { x: 10, y: 20 };
			const layer = factory.createLine( point );

			expect( layer.type ).toBe( 'line' );
			expect( layer.x1 ).toBe( 10 );
			expect( layer.y1 ).toBe( 20 );
			expect( layer.x2 ).toBe( 10 );
			expect( layer.y2 ).toBe( 20 );
		} );

		it( 'should not have fill property', () => {
			const layer = factory.createLine( { x: 0, y: 0 } );
			expect( layer.fill ).toBeUndefined();
		} );
	} );

	describe( 'createArrow', () => {
		it( 'should create arrow layer with correct properties', () => {
			const point = { x: 30, y: 40 };
			const layer = factory.createArrow( point );

			expect( layer.type ).toBe( 'arrow' );
			expect( layer.x1 ).toBe( 30 );
			expect( layer.y1 ).toBe( 40 );
		} );

		it( 'should include arrowStyle', () => {
			const layer = factory.createArrow( { x: 0, y: 0 } );
			expect( layer.arrowStyle ).toBe( 'single' );
		} );

		it( 'should include fill for proper arrow rendering', () => {
			const layer = factory.createArrow( { x: 0, y: 0 } );
			expect( layer.fill ).toBeDefined();
			expect( layer.fill ).not.toBe( 'transparent' );
			expect( layer.fill ).not.toBe( 'none' );
		} );

		it( 'should include arrowSize', () => {
			const layer = factory.createArrow( { x: 0, y: 0 } );
			expect( layer.arrowSize ).toBeDefined();
			expect( typeof layer.arrowSize ).toBe( 'number' );
			expect( layer.arrowSize ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'createPolygon', () => {
		it( 'should create polygon layer with correct properties', () => {
			const point = { x: 100, y: 100 };
			const layer = factory.createPolygon( point );

			expect( layer.type ).toBe( 'polygon' );
			expect( layer.x ).toBe( 100 );
			expect( layer.y ).toBe( 100 );
			expect( layer.radius ).toBe( 0 );
			expect( layer.sides ).toBe( 6 );
		} );

		it( 'should accept custom sides', () => {
			const layer = factory.createPolygon( { x: 0, y: 0 }, 8 );
			expect( layer.sides ).toBe( 8 );
		} );
	} );

	describe( 'createStar', () => {
		it( 'should create star layer with correct properties', () => {
			const point = { x: 150, y: 150 };
			const layer = factory.createStar( point );

			expect( layer.type ).toBe( 'star' );
			expect( layer.x ).toBe( 150 );
			expect( layer.y ).toBe( 150 );
			expect( layer.outerRadius ).toBe( 0 );
			expect( layer.innerRadius ).toBe( 0 );
			expect( layer.points ).toBe( 5 );
		} );

		it( 'should accept custom points', () => {
			const layer = factory.createStar( { x: 0, y: 0 }, 7 );
			expect( layer.points ).toBe( 7 );
		} );
	} );

	describe( 'createPath', () => {
		it( 'should create path layer with initial point', () => {
			const point = { x: 50, y: 60 };
			const layer = factory.createPath( point );

			expect( layer.type ).toBe( 'path' );
			expect( layer.points ).toHaveLength( 1 );
			expect( layer.points[ 0 ].x ).toBe( 50 );
		} );

		it( 'should have fill set to none', () => {
			const layer = factory.createPath( { x: 0, y: 0 } );
			expect( layer.fill ).toBe( 'none' );
		} );
	} );

	describe( 'createText', () => {
		it( 'should create text layer with correct properties', () => {
			const point = { x: 80, y: 90 };
			const layer = factory.createText( point, 'Hello World' );

			expect( layer.type ).toBe( 'text' );
			expect( layer.x ).toBe( 80 );
			expect( layer.y ).toBe( 90 );
			expect( layer.text ).toBe( 'Hello World' );
		} );

		it( 'should apply font properties', () => {
			const layer = factory.createText( { x: 0, y: 0 }, 'Test' );

			expect( layer.fontFamily ).toBe( 'Arial' );
			expect( layer.fontSize ).toBe( 16 );
		} );

		it( 'should apply color', () => {
			const layer = factory.createText( { x: 0, y: 0 }, 'Test' );
			expect( layer.color ).toBe( '#ff0000' );
		} );
	} );

	describe( 'createTextBox', () => {
		it( 'should create textbox layer with correct type', () => {
			const point = { x: 150, y: 250 };
			const layer = factory.createTextBox( point );

			expect( layer.type ).toBe( 'textbox' );
			expect( layer.x ).toBe( 150 );
			expect( layer.y ).toBe( 250 );
		} );

		it( 'should have zero initial dimensions', () => {
			const layer = factory.createTextBox( { x: 0, y: 0 } );

			expect( layer.width ).toBe( 0 );
			expect( layer.height ).toBe( 0 );
		} );

		it( 'should have text properties', () => {
			const layer = factory.createTextBox( { x: 0, y: 0 } );

			expect( layer.text ).toBe( '' );
			expect( layer.fontSize ).toBe( 16 );
			expect( layer.fontFamily ).toBe( 'Arial' );
			expect( layer.fontWeight ).toBe( 'normal' );
			expect( layer.fontStyle ).toBe( 'normal' );
			expect( layer.textAlign ).toBe( 'left' );
			expect( layer.verticalAlign ).toBe( 'top' );
			expect( layer.lineHeight ).toBe( 1.2 );
		} );

		it( 'should have text stroke properties', () => {
			const layer = factory.createTextBox( { x: 0, y: 0 } );

			expect( layer.textStrokeWidth ).toBe( 0 );
			expect( layer.textStrokeColor ).toBe( '#000000' );
		} );

		it( 'should have text shadow properties', () => {
			const layer = factory.createTextBox( { x: 0, y: 0 } );

			expect( layer.textShadow ).toBe( false );
			expect( layer.textShadowColor ).toBe( 'rgba(0,0,0,0.5)' );
			expect( layer.textShadowBlur ).toBe( 4 );
			expect( layer.textShadowOffsetX ).toBe( 2 );
			expect( layer.textShadowOffsetY ).toBe( 2 );
		} );

		it( 'should have rectangle properties', () => {
			const layer = factory.createTextBox( { x: 0, y: 0 } );

			// Textbox default stroke is transparent for cleaner look
			expect( layer.stroke ).toBe( 'transparent' );
			expect( layer.strokeWidth ).toBe( 0 );
			expect( layer.fill ).toBe( '#00ff00' );
			expect( layer.cornerRadius ).toBe( 0 );
			expect( layer.padding ).toBe( 8 );
		} );

		it( 'should apply color from style', () => {
			const layer = factory.createTextBox( { x: 0, y: 0 } );

			expect( layer.color ).toBe( '#ff0000' );
		} );
	} );

	describe( 'create', () => {
		it( 'should create layer by type', () => {
			const layer = factory.create( 'rectangle', { x: 10, y: 20 } );
			expect( layer.type ).toBe( 'rectangle' );
		} );

		it( 'should return null for unknown type', () => {
			const layer = factory.create( 'unknown', { x: 0, y: 0 } );
			expect( layer ).toBeNull();
		} );

		it( 'should pass options to creation method', () => {
			const layer = factory.create( 'text', { x: 0, y: 0 }, { text: 'Custom' } );
			expect( layer.text ).toBe( 'Custom' );
		} );

		it( 'should create textbox layer via create method', () => {
			const layer = factory.create( 'textbox', { x: 70, y: 80 } );
			expect( layer.type ).toBe( 'textbox' );
			expect( layer.x ).toBe( 70 );
			expect( layer.y ).toBe( 80 );
		} );

		it( 'should create pen layer as path', () => {
			const layer = factory.create( 'pen', { x: 0, y: 0 } );
			expect( layer.type ).toBe( 'path' );
		} );

		it( 'should create circle layer via create method', () => {
			const layer = factory.create( 'circle', { x: 0, y: 0 } );
			expect( layer.type ).toBe( 'circle' );
		} );

		it( 'should create ellipse layer via create method', () => {
			const layer = factory.create( 'ellipse', { x: 0, y: 0 } );
			expect( layer.type ).toBe( 'ellipse' );
		} );

		it( 'should create line layer via create method', () => {
			const layer = factory.create( 'line', { x: 0, y: 0 } );
			expect( layer.type ).toBe( 'line' );
		} );

		it( 'should create arrow layer via create method', () => {
			const layer = factory.create( 'arrow', { x: 0, y: 0 } );
			expect( layer.type ).toBe( 'arrow' );
		} );

		it( 'should create polygon layer via create method', () => {
			const layer = factory.create( 'polygon', { x: 0, y: 0 }, { sides: 6 } );
			expect( layer.type ).toBe( 'polygon' );
			expect( layer.sides ).toBe( 6 );
		} );

		it( 'should create star layer via create method', () => {
			const layer = factory.create( 'star', { x: 0, y: 0 }, { points: 5 } );
			expect( layer.type ).toBe( 'star' );
			expect( layer.points ).toBe( 5 );
		} );

		it( 'should create path layer via create method', () => {
			const layer = factory.create( 'path', { x: 0, y: 0 } );
			expect( layer.type ).toBe( 'path' );
		} );
	} );

	describe( 'updateRectangle', () => {
		it( 'should update rectangle dimensions', () => {
			const layer = factory.createRectangle( { x: 10, y: 20 } );
			factory.updateRectangle( layer, { x: 10, y: 20 }, { x: 110, y: 70 } );

			expect( layer.width ).toBe( 100 );
			expect( layer.height ).toBe( 50 );
		} );

		it( 'should handle negative dimensions (drawing from bottom-right)', () => {
			const layer = factory.createRectangle( { x: 100, y: 100 } );
			factory.updateRectangle( layer, { x: 100, y: 100 }, { x: 50, y: 50 } );

			expect( layer.x ).toBe( 50 );
			expect( layer.y ).toBe( 50 );
			expect( layer.width ).toBe( 50 );
			expect( layer.height ).toBe( 50 );
		} );
	} );

	describe( 'updateCircle', () => {
		it( 'should update circle radius based on distance', () => {
			const layer = factory.createCircle( { x: 100, y: 100 } );
			factory.updateCircle( layer, { x: 100, y: 100 }, { x: 150, y: 100 } );

			expect( layer.radius ).toBe( 50 );
		} );

		it( 'should calculate diagonal distance', () => {
			const layer = factory.createCircle( { x: 0, y: 0 } );
			factory.updateCircle( layer, { x: 0, y: 0 }, { x: 30, y: 40 } );

			expect( layer.radius ).toBe( 50 ); // 3-4-5 triangle
		} );
	} );

	describe( 'updateEllipse', () => {
		it( 'should update ellipse radii and center', () => {
			const layer = factory.createEllipse( { x: 100, y: 100 } );
			factory.updateEllipse( layer, { x: 100, y: 100 }, { x: 200, y: 150 } );

			// With this implementation, center moves to midpoint
			expect( layer.radiusX ).toBe( 50 ); // half of 100
			expect( layer.radiusY ).toBe( 25 ); // half of 50
		} );
	} );

	describe( 'updateLine', () => {
		it( 'should update line endpoint', () => {
			const layer = factory.createLine( { x: 0, y: 0 } );
			factory.updateLine( layer, { x: 100, y: 200 } );

			expect( layer.x2 ).toBe( 100 );
			expect( layer.y2 ).toBe( 200 );
		} );
	} );

	describe( 'updatePolygon', () => {
		it( 'should update polygon radius', () => {
			const layer = factory.createPolygon( { x: 100, y: 100 } );
			factory.updatePolygon( layer, { x: 100, y: 100 }, { x: 200, y: 100 } );

			expect( layer.radius ).toBe( 100 );
		} );
	} );

	describe( 'updateStar', () => {
		it( 'should update star radii', () => {
			const layer = factory.createStar( { x: 100, y: 100 } );
			factory.updateStar( layer, { x: 100, y: 100 }, { x: 200, y: 100 } );

			expect( layer.outerRadius ).toBe( 100 );
			expect( layer.radius ).toBe( 100 );
			expect( layer.innerRadius ).toBe( 40 ); // 100 * 0.4
		} );
	} );

	describe( 'hasValidSize', () => {
		it( 'should return false for rectangle with zero dimensions', () => {
			const layer = { type: 'rectangle', width: 0, height: 0 };
			expect( factory.hasValidSize( layer ) ).toBe( false );
		} );

		it( 'should return true for rectangle with valid dimensions', () => {
			const layer = { type: 'rectangle', width: 50, height: 30 };
			expect( factory.hasValidSize( layer ) ).toBe( true );
		} );

		it( 'should return false for rectangle with dimensions <= 1', () => {
			const layer = { type: 'rectangle', width: 1, height: 1 };
			expect( factory.hasValidSize( layer ) ).toBe( false );
		} );

		it( 'should return false for circle with zero radius', () => {
			const layer = { type: 'circle', radius: 0 };
			expect( factory.hasValidSize( layer ) ).toBe( false );
		} );

		it( 'should return true for circle with valid radius', () => {
			const layer = { type: 'circle', radius: 25 };
			expect( factory.hasValidSize( layer ) ).toBe( true );
		} );

		it( 'should return false for ellipse with zero radii', () => {
			const layer = { type: 'ellipse', radiusX: 0, radiusY: 0 };
			expect( factory.hasValidSize( layer ) ).toBe( false );
		} );

		it( 'should return true for ellipse with valid radii', () => {
			const layer = { type: 'ellipse', radiusX: 30, radiusY: 20 };
			expect( factory.hasValidSize( layer ) ).toBe( true );
		} );

		it( 'should return false for line with zero length', () => {
			const layer = { type: 'line', x1: 10, y1: 20, x2: 10, y2: 20 };
			expect( factory.hasValidSize( layer ) ).toBe( false );
		} );

		it( 'should return true for line with valid length', () => {
			const layer = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 };
			expect( factory.hasValidSize( layer ) ).toBe( true );
		} );

		it( 'should return false for arrow with zero length', () => {
			const layer = { type: 'arrow', x1: 50, y1: 50, x2: 50, y2: 50 };
			expect( factory.hasValidSize( layer ) ).toBe( false );
		} );

		it( 'should return true for polygon with valid radius', () => {
			const layer = { type: 'polygon', radius: 50 };
			expect( factory.hasValidSize( layer ) ).toBe( true );
		} );

		it( 'should return true for star with valid outerRadius', () => {
			const layer = { type: 'star', outerRadius: 60 };
			expect( factory.hasValidSize( layer ) ).toBe( true );
		} );

		it( 'should return false for path with single point', () => {
			const layer = { type: 'path', points: [ { x: 0, y: 0 } ] };
			expect( factory.hasValidSize( layer ) ).toBe( false );
		} );

		it( 'should return true for path with multiple points', () => {
			const layer = { type: 'path', points: [ { x: 0, y: 0 }, { x: 10, y: 10 } ] };
			expect( factory.hasValidSize( layer ) ).toBe( true );
		} );

		it( 'should return true for unknown types', () => {
			const layer = { type: 'unknown' };
			expect( factory.hasValidSize( layer ) ).toBe( true );
		} );
	} );

	describe( 'generateId', () => {
		it( 'should generate unique IDs', () => {
			const id1 = factory.generateId();
			const id2 = factory.generateId();
			expect( id1 ).not.toBe( id2 );
		} );

		it( 'should generate string IDs starting with layer_', () => {
			const id = factory.generateId();
			expect( typeof id ).toBe( 'string' );
			expect( id.startsWith( 'layer_' ) ).toBe( true );
		} );
	} );

	describe( 'createWithId', () => {
		it( 'should create layer with generated ID', () => {
			const layer = factory.createWithId( 'rectangle', { x: 10, y: 20 } );
			expect( layer.id ).toBeDefined();
			expect( layer.id.startsWith( 'layer_' ) ).toBe( true );
		} );

		it( 'should return null for unknown type', () => {
			const layer = factory.createWithId( 'unknown', { x: 0, y: 0 } );
			expect( layer ).toBeNull();
		} );
	} );

	describe( 'setStyleManager', () => {
		it( 'should update style manager reference', () => {
			const newManager = { get: jest.fn( () => ( { color: '#0000ff' } ) ) };
			factory.setStyleManager( newManager );
			expect( factory.styleManager ).toBe( newManager );
		} );
	} );

	describe( 'createCallout', () => {
		it( 'should create a callout layer with default properties', () => {
			const callout = factory.createCallout( { x: 100, y: 200 } );

			expect( callout.type ).toBe( 'callout' );
			expect( callout.x ).toBe( 100 );
			expect( callout.y ).toBe( 200 );
			expect( callout.width ).toBe( 0 );
			expect( callout.height ).toBe( 0 );
		} );

		it( 'should include text properties', () => {
			const callout = factory.createCallout( { x: 0, y: 0 } );

			expect( callout.text ).toBe( '' );
			expect( callout.fontSize ).toBe( 16 );
			expect( callout.fontFamily ).toBe( 'Arial' );
			expect( callout.fontWeight ).toBe( 'normal' );
			expect( callout.fontStyle ).toBe( 'normal' );
			expect( callout.textAlign ).toBe( 'left' );
			expect( callout.verticalAlign ).toBe( 'top' );
			expect( callout.lineHeight ).toBe( 1.2 );
		} );

		it( 'should include text stroke and shadow properties', () => {
			const callout = factory.createCallout( { x: 0, y: 0 } );

			expect( callout.textStrokeWidth ).toBe( 0 );
			expect( callout.textStrokeColor ).toBe( '#000000' );
			expect( callout.textShadow ).toBe( false );
			expect( callout.textShadowColor ).toBe( 'rgba(0,0,0,0.5)' );
			expect( callout.textShadowBlur ).toBe( 4 );
			expect( callout.textShadowOffsetX ).toBe( 2 );
			expect( callout.textShadowOffsetY ).toBe( 2 );
		} );

		it( 'should include shape properties from style', () => {
			const callout = factory.createCallout( { x: 0, y: 0 } );

			expect( callout.stroke ).toBe( '#ff0000' ); // from mock style
			expect( callout.strokeWidth ).toBe( 3 ); // from mock style
			expect( callout.fill ).toBe( '#00ff00' ); // from mock style
			expect( callout.cornerRadius ).toBe( 8 );
			expect( callout.padding ).toBe( 12 );
		} );

		it( 'should include callout-specific tail properties', () => {
			const callout = factory.createCallout( { x: 0, y: 0 } );

			expect( callout.tailDirection ).toBe( 'bottom' );
			expect( callout.tailPosition ).toBe( 0.5 );
			expect( callout.tailSize ).toBe( 20 );
		} );

		it( 'should apply shadow properties when enabled', () => {
			mockStyleManager.get.mockReturnValue( {
				color: '#000000',
				fill: '#ffffff',
				strokeWidth: 1,
				shadow: true,
				shadowColor: '#333333',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			} );

			const callout = factory.createCallout( { x: 0, y: 0 } );

			expect( callout.shadow ).toBe( true );
			expect( callout.shadowColor ).toBe( '#333333' );
		} );

		it( 'should use default values when style properties are missing', () => {
			mockStyleManager.get.mockReturnValue( {} );

			const callout = factory.createCallout( { x: 50, y: 75 } );

			expect( callout.fontSize ).toBe( 16 );
			expect( callout.fontFamily ).toBe( 'Arial, sans-serif' );
			expect( callout.color ).toBe( '#000000' );
			expect( callout.stroke ).toBe( '#000000' );
			expect( callout.strokeWidth ).toBe( 1 );
			expect( callout.fill ).toBe( '#ffffff' );
		} );
	} );

	describe( 'create - callout type', () => {
		it( 'should create callout via create switch', () => {
			const layer = factory.create( 'callout', { x: 25, y: 50 } );

			expect( layer.type ).toBe( 'callout' );
			expect( layer.x ).toBe( 25 );
			expect( layer.y ).toBe( 50 );
			expect( layer.tailDirection ).toBe( 'bottom' );
		} );
	} );

	describe( 'hasValidSize - edge cases', () => {
		it( 'should return true for unknown layer types (default case)', () => {
			const unknownLayer = { type: 'future-shape', x: 0, y: 0 };
			expect( factory.hasValidSize( unknownLayer ) ).toBe( true );
		} );

		it( 'should return true for callout type', () => {
			const calloutLayer = { type: 'callout', width: 100, height: 50 };
			expect( factory.hasValidSize( calloutLayer ) ).toBe( true );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export ShapeFactory class', () => {
			expect( typeof ShapeFactory ).toBe( 'function' );
		} );

		it( 'should allow creating new instances', () => {
			const instance = new ShapeFactory();
			expect( instance ).toBeInstanceOf( ShapeFactory );
		} );
	} );
} );
