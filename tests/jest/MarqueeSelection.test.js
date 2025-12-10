/**
 * Tests for MarqueeSelection module
 */
'use strict';

const MarqueeSelection = require( '../../resources/ext.layers.editor/selection/MarqueeSelection.js' );

describe( 'MarqueeSelection', () => {
	let marquee;
	let testLayers;
	let selectionUpdateCallback;

	beforeEach( () => {
		testLayers = [
			{ id: 'layer1', x: 10, y: 10, width: 50, height: 50, visible: true, locked: false },
			{ id: 'layer2', x: 100, y: 100, width: 50, height: 50, visible: true, locked: false },
			{ id: 'layer3', x: 200, y: 200, width: 50, height: 50, visible: false, locked: false },
			{ id: 'layer4', x: 50, y: 50, width: 30, height: 30, visible: true, locked: true },
			{ id: 'layer5', x: 150, y: 150, width: 40, height: 40, visible: true, locked: false }
		];
		selectionUpdateCallback = jest.fn();
		marquee = new MarqueeSelection( {
			getLayersArray: () => testLayers,
			onSelectionUpdate: selectionUpdateCallback
		} );
	} );

	afterEach( () => {
		marquee.destroy();
	} );

	describe( 'constructor', () => {
		it( 'should initialize with inactive state', () => {
			expect( marquee.isActive() ).toBe( false );
			expect( marquee.startPoint ).toBeNull();
			expect( marquee.endPoint ).toBeNull();
		} );

		it( 'should accept empty options', () => {
			const m = new MarqueeSelection();
			expect( m.isActive() ).toBe( false );
			m.destroy();
		} );
	} );

	describe( 'start', () => {
		it( 'should start selection with point object', () => {
			marquee.start( { x: 10, y: 20 } );
			expect( marquee.isActive() ).toBe( true );
			expect( marquee.startPoint ).toEqual( { x: 10, y: 20 } );
			expect( marquee.endPoint ).toEqual( { x: 10, y: 20 } );
		} );

		it( 'should start selection with x, y arguments', () => {
			marquee.start( 30, 40 );
			expect( marquee.isActive() ).toBe( true );
			expect( marquee.startPoint ).toEqual( { x: 30, y: 40 } );
		} );
	} );

	describe( 'update', () => {
		beforeEach( () => {
			marquee.start( 0, 0 );
		} );

		it( 'should update end point with object', () => {
			marquee.update( { x: 100, y: 100 } );
			expect( marquee.endPoint ).toEqual( { x: 100, y: 100 } );
		} );

		it( 'should update end point with x, y arguments', () => {
			marquee.update( 150, 200 );
			expect( marquee.endPoint ).toEqual( { x: 150, y: 200 } );
		} );

		it( 'should find layers within marquee', () => {
			const selectedIds = marquee.update( 70, 70 );
			// Should include layer1 (10,10,50,50) and layer4 (50,50,30,30)
			expect( selectedIds ).toContain( 'layer1' );
			// layer4 is locked, should be excluded
			expect( selectedIds ).not.toContain( 'layer4' );
		} );

		it( 'should exclude invisible layers', () => {
			marquee.start( 0, 0 );
			const selectedIds = marquee.update( 300, 300 );
			expect( selectedIds ).not.toContain( 'layer3' );
		} );

		it( 'should exclude locked layers', () => {
			marquee.start( 40, 40 );
			const selectedIds = marquee.update( 90, 90 );
			expect( selectedIds ).not.toContain( 'layer4' );
		} );

		it( 'should call onSelectionUpdate callback', () => {
			marquee.update( 100, 100 );
			expect( selectionUpdateCallback ).toHaveBeenCalled();
		} );

		it( 'should return empty array when not selecting', () => {
			const m = new MarqueeSelection();
			const result = m.update( 100, 100 );
			expect( result ).toEqual( [] );
			m.destroy();
		} );
	} );

	describe( 'finish', () => {
		it( 'should finish selection and return selected IDs', () => {
			marquee.start( 0, 0 );
			marquee.update( 70, 70 );
			const selectedIds = marquee.finish();
			expect( selectedIds ).toContain( 'layer1' );
			expect( marquee.isActive() ).toBe( false );
			expect( marquee.startPoint ).toBeNull();
			expect( marquee.endPoint ).toBeNull();
		} );

		it( 'should return empty array when not selecting', () => {
			const selectedIds = marquee.finish();
			expect( selectedIds ).toEqual( [] );
		} );
	} );

	describe( 'cancel', () => {
		it( 'should cancel selection without selecting', () => {
			marquee.start( 0, 0 );
			marquee.update( 300, 300 );
			marquee.cancel();
			expect( marquee.isActive() ).toBe( false );
			expect( marquee.startPoint ).toBeNull();
			expect( marquee.endPoint ).toBeNull();
		} );
	} );

	describe( 'getRect', () => {
		it( 'should return correct rectangle for normal direction', () => {
			marquee.start( 10, 20 );
			marquee.update( 110, 120 );
			const rect = marquee.getRect();
			expect( rect ).toEqual( { x: 10, y: 20, width: 100, height: 100 } );
		} );

		it( 'should handle reversed coordinates', () => {
			marquee.start( 110, 120 );
			marquee.update( 10, 20 );
			const rect = marquee.getRect();
			expect( rect ).toEqual( { x: 10, y: 20, width: 100, height: 100 } );
		} );

		it( 'should return zero rect when not selecting', () => {
			const rect = marquee.getRect();
			expect( rect ).toEqual( { x: 0, y: 0, width: 0, height: 0 } );
		} );
	} );

	describe( 'getSelectedIds', () => {
		it( 'should return layers within marquee', () => {
			marquee.start( 0, 0 );
			marquee.update( 70, 70 );
			const ids = marquee.getSelectedIds();
			expect( ids ).toContain( 'layer1' );
		} );

		it( 'should return empty array when not selecting', () => {
			expect( marquee.getSelectedIds() ).toEqual( [] );
		} );
	} );

	describe( 'rectIntersects', () => {
		it( 'should return true for overlapping rectangles', () => {
			const rect1 = { x: 0, y: 0, width: 100, height: 100 };
			const rect2 = { x: 50, y: 50, width: 100, height: 100 };
			expect( marquee.rectIntersects( rect1, rect2 ) ).toBe( true );
		} );

		it( 'should return false for non-overlapping rectangles', () => {
			const rect1 = { x: 0, y: 0, width: 100, height: 100 };
			const rect2 = { x: 200, y: 200, width: 100, height: 100 };
			expect( marquee.rectIntersects( rect1, rect2 ) ).toBe( false );
		} );

		it( 'should return true for adjacent rectangles', () => {
			const rect1 = { x: 0, y: 0, width: 100, height: 100 };
			const rect2 = { x: 99, y: 0, width: 100, height: 100 };
			expect( marquee.rectIntersects( rect1, rect2 ) ).toBe( true );
		} );
	} );

	describe( 'pointInRect', () => {
		it( 'should return true when point is inside', () => {
			const point = { x: 50, y: 50 };
			const rect = { x: 0, y: 0, width: 100, height: 100 };
			expect( marquee.pointInRect( point, rect ) ).toBe( true );
		} );

		it( 'should return false when point is outside', () => {
			const point = { x: 150, y: 150 };
			const rect = { x: 0, y: 0, width: 100, height: 100 };
			expect( marquee.pointInRect( point, rect ) ).toBe( false );
		} );

		it( 'should return true for point on edge', () => {
			const point = { x: 0, y: 50 };
			const rect = { x: 0, y: 0, width: 100, height: 100 };
			expect( marquee.pointInRect( point, rect ) ).toBe( true );
		} );
	} );

	describe( 'calculateLayerBounds', () => {
		it( 'should calculate bounds for rectangular layer', () => {
			const layer = { x: 10, y: 20, width: 100, height: 50 };
			const bounds = marquee.calculateLayerBounds( layer );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		it( 'should handle negative dimensions', () => {
			const layer = { x: 110, y: 70, width: -100, height: -50 };
			const bounds = marquee.calculateLayerBounds( layer );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		it( 'should calculate bounds for line layer', () => {
			const layer = { x1: 10, y1: 20, x2: 110, y2: 70 };
			const bounds = marquee.calculateLayerBounds( layer );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		it( 'should calculate bounds for ellipse layer', () => {
			const layer = { x: 100, y: 100, radiusX: 50, radiusY: 30 };
			const bounds = marquee.calculateLayerBounds( layer );
			expect( bounds ).toEqual( { x: 50, y: 70, width: 100, height: 60 } );
		} );

		it( 'should calculate bounds for circle layer', () => {
			const layer = { x: 100, y: 100, radius: 50 };
			const bounds = marquee.calculateLayerBounds( layer );
			expect( bounds ).toEqual( { x: 50, y: 50, width: 100, height: 100 } );
		} );

		it( 'should calculate bounds for polygon layer', () => {
			const layer = { points: [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 50, y: 100 }
			] };
			const bounds = marquee.calculateLayerBounds( layer );
			expect( bounds ).toEqual( { x: 0, y: 0, width: 100, height: 100 } );
		} );

		it( 'should return null for invalid layer', () => {
			expect( marquee.calculateLayerBounds( null ) ).toBeNull();
			expect( marquee.calculateLayerBounds( {} ) ).toBeNull();
		} );
	} );

	describe( 'getRenderInfo', () => {
		it( 'should return render info when selecting', () => {
			marquee.start( 10, 20 );
			marquee.update( 110, 120 );
			const info = marquee.getRenderInfo();
			expect( info ).not.toBeNull();
			expect( info.rect ).toEqual( { x: 10, y: 20, width: 100, height: 100 } );
			expect( info.startPoint ).toEqual( { x: 10, y: 20 } );
			expect( info.endPoint ).toEqual( { x: 110, y: 120 } );
		} );

		it( 'should return null when not selecting', () => {
			expect( marquee.getRenderInfo() ).toBeNull();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up state', () => {
			marquee.start( 0, 0 );
			marquee.destroy();
			expect( marquee.isActive() ).toBe( false );
			expect( marquee.startPoint ).toBeNull();
			expect( marquee.endPoint ).toBeNull();
		} );
	} );

	describe( 'with custom getLayerBounds', () => {
		it( 'should use custom bounds function', () => {
			const customMarquee = new MarqueeSelection( {
				getLayersArray: () => [ { id: 'test' } ],
				getLayerBounds: () => ( { x: 0, y: 0, width: 50, height: 50 } )
			} );
			customMarquee.start( 0, 0 );
			const ids = customMarquee.update( 100, 100 );
			expect( ids ).toContain( 'test' );
			customMarquee.destroy();
		} );
	} );
} );
