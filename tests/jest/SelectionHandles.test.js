/**
 * Tests for SelectionHandles module
 */
'use strict';

const SelectionHandles = require( '../../resources/ext.layers.editor/selection/SelectionHandles.js' );

describe( 'SelectionHandles', () => {
	let handles;

	beforeEach( () => {
		handles = new SelectionHandles( {
			handleSize: 8,
			rotationHandleOffset: 20
		} );
	} );

	afterEach( () => {
		handles.destroy();
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default values', () => {
			const h = new SelectionHandles();
			expect( h.handleSize ).toBe( 8 );
			expect( h.rotationHandleOffset ).toBe( 20 );
			expect( h.handles ).toEqual( [] );
			h.destroy();
		} );

		it( 'should accept custom options', () => {
			const h = new SelectionHandles( { handleSize: 12, rotationHandleOffset: 30 } );
			expect( h.handleSize ).toBe( 12 );
			expect( h.rotationHandleOffset ).toBe( 30 );
			h.destroy();
		} );
	} );

	describe( 'createSingleSelectionHandles', () => {
		const bounds = { x: 100, y: 100, width: 200, height: 150 };

		it( 'should create all handles for single selection', () => {
			const result = handles.createSingleSelectionHandles( bounds );
			// 4 corners + 4 edges + 1 rotation = 9 handles
			expect( result ).toHaveLength( 9 );
		} );

		it( 'should create corner handles at correct positions', () => {
			handles.createSingleSelectionHandles( bounds );
			const handleList = handles.getHandles();

			const nw = handleList.find( ( h ) => h.type === 'nw' );
			expect( nw.x ).toBe( 100 );
			expect( nw.y ).toBe( 100 );

			const ne = handleList.find( ( h ) => h.type === 'ne' );
			expect( ne.x ).toBe( 300 );
			expect( ne.y ).toBe( 100 );

			const se = handleList.find( ( h ) => h.type === 'se' );
			expect( se.x ).toBe( 300 );
			expect( se.y ).toBe( 250 );

			const sw = handleList.find( ( h ) => h.type === 'sw' );
			expect( sw.x ).toBe( 100 );
			expect( sw.y ).toBe( 250 );
		} );

		it( 'should create edge handles at correct positions', () => {
			handles.createSingleSelectionHandles( bounds );
			const handleList = handles.getHandles();

			const n = handleList.find( ( h ) => h.type === 'n' );
			expect( n.x ).toBe( 200 ); // center x
			expect( n.y ).toBe( 100 );

			const e = handleList.find( ( h ) => h.type === 'e' );
			expect( e.x ).toBe( 300 );
			expect( e.y ).toBe( 175 ); // center y

			const s = handleList.find( ( h ) => h.type === 's' );
			expect( s.x ).toBe( 200 );
			expect( s.y ).toBe( 250 );

			const w = handleList.find( ( h ) => h.type === 'w' );
			expect( w.x ).toBe( 100 );
			expect( w.y ).toBe( 175 );
		} );

		it( 'should create rotation handle above selection', () => {
			handles.createSingleSelectionHandles( bounds );
			const handleList = handles.getHandles();

			const rotate = handleList.find( ( h ) => h.type === 'rotate' );
			expect( rotate ).toBeDefined();
			expect( rotate.x ).toBe( 200 ); // center x
			expect( rotate.y ).toBe( 80 ); // y - rotationHandleOffset
		} );

		it( 'should create handle rects with correct size', () => {
			handles.createSingleSelectionHandles( bounds );
			const handleList = handles.getHandles();

			handleList.forEach( ( handle ) => {
				expect( handle.rect.width ).toBe( 8 );
				expect( handle.rect.height ).toBe( 8 );
				expect( handle.rect.x ).toBe( handle.x - 4 );
				expect( handle.rect.y ).toBe( handle.y - 4 );
			} );
		} );

		it( 'should exclude edges when includeEdges=false', () => {
			handles.createSingleSelectionHandles( bounds, { includeEdges: false } );
			const handleList = handles.getHandles();
			// 4 corners + 1 rotation = 5
			expect( handleList ).toHaveLength( 5 );
			expect( handleList.find( ( h ) => h.type === 'n' ) ).toBeUndefined();
			expect( handleList.find( ( h ) => h.type === 'e' ) ).toBeUndefined();
		} );

		it( 'should exclude rotation when includeRotation=false', () => {
			handles.createSingleSelectionHandles( bounds, { includeRotation: false } );
			const handleList = handles.getHandles();
			// 4 corners + 4 edges = 8
			expect( handleList ).toHaveLength( 8 );
			expect( handleList.find( ( h ) => h.type === 'rotate' ) ).toBeUndefined();
		} );

		it( 'should return empty array for null bounds', () => {
			const result = handles.createSingleSelectionHandles( null );
			expect( result ).toEqual( [] );
		} );
	} );

	describe( 'createMultiSelectionHandles', () => {
		const bounds = { x: 50, y: 50, width: 300, height: 200 };

		it( 'should create only corner handles by default', () => {
			const result = handles.createMultiSelectionHandles( bounds );
			expect( result ).toHaveLength( 4 );
			expect( result.every( ( h ) => [ 'nw', 'ne', 'se', 'sw' ].includes( h.type ) ) ).toBe( true );
		} );

		it( 'should include rotation handle when requested', () => {
			handles.createMultiSelectionHandles( bounds, { includeRotation: true } );
			const handleList = handles.getHandles();
			expect( handleList ).toHaveLength( 5 );
			expect( handleList.find( ( h ) => h.type === 'rotate' ) ).toBeDefined();
		} );

		it( 'should return empty array for null bounds', () => {
			const result = handles.createMultiSelectionHandles( null );
			expect( result ).toEqual( [] );
		} );
	} );

	describe( 'clear', () => {
		it( 'should clear all handles', () => {
			handles.createSingleSelectionHandles( { x: 0, y: 0, width: 100, height: 100 } );
			expect( handles.getHandles().length ).toBeGreaterThan( 0 );
			handles.clear();
			expect( handles.getHandles() ).toEqual( [] );
		} );
	} );

	describe( 'hitTest', () => {
		beforeEach( () => {
			handles.createSingleSelectionHandles( { x: 100, y: 100, width: 100, height: 100 } );
		} );

		it( 'should return handle when point is inside', () => {
			// NW corner is at (100, 100), rect from (96, 96) to (104, 104)
			const result = handles.hitTest( { x: 100, y: 100 } );
			expect( result ).not.toBeNull();
			expect( result.type ).toBe( 'nw' );
		} );

		it( 'should return null when point is outside all handles', () => {
			const result = handles.hitTest( { x: 150, y: 150 } );
			expect( result ).toBeNull();
		} );

		it( 'should detect rotation handle', () => {
			// Rotation handle is at (150, 80), rect from (146, 76) to (154, 84)
			const result = handles.hitTest( { x: 150, y: 80 } );
			expect( result ).not.toBeNull();
			expect( result.type ).toBe( 'rotate' );
		} );
	} );

	describe( 'pointInRect', () => {
		it( 'should return true for point inside rect', () => {
			const point = { x: 50, y: 50 };
			const rect = { x: 0, y: 0, width: 100, height: 100 };
			expect( handles.pointInRect( point, rect ) ).toBe( true );
		} );

		it( 'should return false for point outside rect', () => {
			const point = { x: 150, y: 150 };
			const rect = { x: 0, y: 0, width: 100, height: 100 };
			expect( handles.pointInRect( point, rect ) ).toBe( false );
		} );

		it( 'should return true for point on edge', () => {
			const point = { x: 100, y: 50 };
			const rect = { x: 0, y: 0, width: 100, height: 100 };
			expect( handles.pointInRect( point, rect ) ).toBe( true );
		} );
	} );

	describe( 'getCursor', () => {
		it( 'should return crosshair for rotate handle', () => {
			expect( handles.getCursor( 'rotate' ) ).toBe( 'crosshair' );
		} );

		it( 'should return nwse-resize for nw/se corners', () => {
			expect( handles.getCursor( 'nw' ) ).toBe( 'nwse-resize' );
			expect( handles.getCursor( 'se' ) ).toBe( 'nwse-resize' );
		} );

		it( 'should return nesw-resize for ne/sw corners', () => {
			expect( handles.getCursor( 'ne' ) ).toBe( 'nesw-resize' );
			expect( handles.getCursor( 'sw' ) ).toBe( 'nesw-resize' );
		} );

		it( 'should return ns-resize for n/s edges', () => {
			expect( handles.getCursor( 'n' ) ).toBe( 'ns-resize' );
			expect( handles.getCursor( 's' ) ).toBe( 'ns-resize' );
		} );

		it( 'should return ew-resize for e/w edges', () => {
			expect( handles.getCursor( 'e' ) ).toBe( 'ew-resize' );
			expect( handles.getCursor( 'w' ) ).toBe( 'ew-resize' );
		} );

		it( 'should return default for unknown handle type', () => {
			expect( handles.getCursor( 'unknown' ) ).toBe( 'default' );
		} );
	} );

	describe( 'getOppositeHandle', () => {
		it( 'should return opposite corners', () => {
			expect( handles.getOppositeHandle( 'nw' ) ).toBe( 'se' );
			expect( handles.getOppositeHandle( 'ne' ) ).toBe( 'sw' );
			expect( handles.getOppositeHandle( 'se' ) ).toBe( 'nw' );
			expect( handles.getOppositeHandle( 'sw' ) ).toBe( 'ne' );
		} );

		it( 'should return opposite edges', () => {
			expect( handles.getOppositeHandle( 'n' ) ).toBe( 's' );
			expect( handles.getOppositeHandle( 's' ) ).toBe( 'n' );
			expect( handles.getOppositeHandle( 'e' ) ).toBe( 'w' );
			expect( handles.getOppositeHandle( 'w' ) ).toBe( 'e' );
		} );

		it( 'should return same for unknown', () => {
			expect( handles.getOppositeHandle( 'unknown' ) ).toBe( 'unknown' );
		} );
	} );

	describe( 'isCornerHandle', () => {
		it( 'should return true for corners', () => {
			expect( handles.isCornerHandle( 'nw' ) ).toBe( true );
			expect( handles.isCornerHandle( 'ne' ) ).toBe( true );
			expect( handles.isCornerHandle( 'se' ) ).toBe( true );
			expect( handles.isCornerHandle( 'sw' ) ).toBe( true );
		} );

		it( 'should return false for non-corners', () => {
			expect( handles.isCornerHandle( 'n' ) ).toBe( false );
			expect( handles.isCornerHandle( 'rotate' ) ).toBe( false );
		} );
	} );

	describe( 'isEdgeHandle', () => {
		it( 'should return true for edges', () => {
			expect( handles.isEdgeHandle( 'n' ) ).toBe( true );
			expect( handles.isEdgeHandle( 'e' ) ).toBe( true );
			expect( handles.isEdgeHandle( 's' ) ).toBe( true );
			expect( handles.isEdgeHandle( 'w' ) ).toBe( true );
		} );

		it( 'should return false for non-edges', () => {
			expect( handles.isEdgeHandle( 'nw' ) ).toBe( false );
			expect( handles.isEdgeHandle( 'rotate' ) ).toBe( false );
		} );
	} );

	describe( 'isRotationHandle', () => {
		it( 'should return true for rotate', () => {
			expect( handles.isRotationHandle( 'rotate' ) ).toBe( true );
		} );

		it( 'should return false for non-rotate', () => {
			expect( handles.isRotationHandle( 'nw' ) ).toBe( false );
			expect( handles.isRotationHandle( 'n' ) ).toBe( false );
		} );
	} );

	describe( 'getRenderInfo', () => {
		it( 'should return render info for all handles', () => {
			handles.createSingleSelectionHandles( { x: 0, y: 0, width: 100, height: 100 } );
			const info = handles.getRenderInfo();
			expect( info ).toHaveLength( 9 );
			info.forEach( ( item ) => {
				expect( item ).toHaveProperty( 'x' );
				expect( item ).toHaveProperty( 'y' );
				expect( item ).toHaveProperty( 'type' );
				expect( item ).toHaveProperty( 'size' );
				expect( item ).toHaveProperty( 'rect' );
			} );
		} );
	} );

	describe( 'setHandleSize', () => {
		it( 'should update handle size and recalculate rects', () => {
			handles.createSingleSelectionHandles( { x: 100, y: 100, width: 100, height: 100 } );
			handles.setHandleSize( 16 );

			const handleList = handles.getHandles();
			handleList.forEach( ( handle ) => {
				expect( handle.rect.width ).toBe( 16 );
				expect( handle.rect.height ).toBe( 16 );
				expect( handle.rect.x ).toBe( handle.x - 8 );
				expect( handle.rect.y ).toBe( handle.y - 8 );
			} );
		} );
	} );

	describe( 'setRotationHandleOffset', () => {
		it( 'should update rotation handle offset', () => {
			handles.setRotationHandleOffset( 40 );
			expect( handles.rotationHandleOffset ).toBe( 40 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up handles', () => {
			handles.createSingleSelectionHandles( { x: 0, y: 0, width: 100, height: 100 } );
			handles.destroy();
			expect( handles.handles ).toEqual( [] );
		} );
	} );

	describe( 'touch device detection', () => {
		it( 'should use 8px handle size for mouse devices', () => {
			window.matchMedia = jest.fn().mockReturnValue( { matches: false } );
			const mouseHandles = new SelectionHandles();
			expect( mouseHandles.handleSize ).toBe( 8 );
		} );

		it( 'should use 14px handle size for touch devices', () => {
			window.matchMedia = jest.fn().mockReturnValue( { matches: true } );
			const touchHandles = new SelectionHandles();
			expect( touchHandles.handleSize ).toBe( 14 );
		} );

		it( 'should use provided handleSize option over auto-detect', () => {
			window.matchMedia = jest.fn().mockReturnValue( { matches: true } );
			const customHandles = new SelectionHandles( { handleSize: 20 } );
			expect( customHandles.handleSize ).toBe( 20 );
		} );

		it( 'should fall back to 8px when matchMedia unavailable', () => {
			const originalMatchMedia = window.matchMedia;
			delete window.matchMedia;
			const fallbackHandles = new SelectionHandles();
			expect( fallbackHandles.handleSize ).toBe( 8 );
			window.matchMedia = originalMatchMedia;
		} );
	} );
} );
