/**
 * Tests for PathToolHandler
 *
 * @jest-environment jsdom
 */

/* eslint-disable no-unused-vars */
'use strict';

// Set up window.Layers namespace before requiring the module
window.Layers = window.Layers || {};
window.Layers.Tools = window.Layers.Tools || {};

const PathToolHandler = require( '../../../resources/ext.layers.editor/tools/PathToolHandler.js' );

describe( 'PathToolHandler', () => {
	let handler;
	let mockCanvasManager;
	let mockStyleManager;
	let addedLayers;
	let renderCalled;

	beforeEach( () => {
		// Reset state
		addedLayers = [];
		renderCalled = false;

		// Mock canvas manager with context
		mockCanvasManager = {
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				beginPath: jest.fn(),
				moveTo: jest.fn(),
				lineTo: jest.fn(),
				arc: jest.fn(),
				stroke: jest.fn(),
				fill: jest.fn(),
				setLineDash: jest.fn(),
				strokeStyle: '',
				fillStyle: '',
				lineWidth: 1
			},
			container: document.createElement( 'div' )
		};

		// Mock style manager
		mockStyleManager = {
			get: jest.fn( () => ( {
				color: '#ff0000',
				strokeWidth: 3,
				fill: '#00ff00'
			} ) )
		};

		// Create handler
		handler = new PathToolHandler( {
			canvasManager: mockCanvasManager,
			styleManager: mockStyleManager,
			addLayerCallback: ( layer ) => addedLayers.push( layer ),
			renderCallback: () => {
				renderCalled = true;
			}
		} );
	} );

	afterEach( () => {
		if ( handler ) {
			handler.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should initialize with provided config', () => {
			expect( handler.canvasManager ).toBe( mockCanvasManager );
			expect( handler.styleManager ).toBe( mockStyleManager );
			expect( handler.pathPoints ).toEqual( [] );
			expect( handler.isDrawing ).toBe( false );
		} );

		it( 'should handle missing config gracefully', () => {
			const emptyHandler = new PathToolHandler( {} );
			expect( emptyHandler.canvasManager ).toBeNull();
			expect( emptyHandler.styleManager ).toBeNull();
			emptyHandler.destroy();
		} );

		it( 'should set default close threshold', () => {
			expect( handler.closeThreshold ).toBe( 10 );
		} );
	} );

	describe( 'handlePoint', () => {
		it( 'should start a new path on first point', () => {
			handler.handlePoint( { x: 100, y: 200 } );
			expect( handler.pathPoints ).toHaveLength( 1 );
			expect( handler.pathPoints[ 0 ] ).toEqual( { x: 100, y: 200 } );
			expect( handler.isDrawing ).toBe( true );
		} );

		it( 'should add points to existing path', () => {
			handler.handlePoint( { x: 100, y: 200 } );
			handler.handlePoint( { x: 150, y: 250 } );
			handler.handlePoint( { x: 200, y: 200 } );
			expect( handler.pathPoints ).toHaveLength( 3 );
		} );

		it( 'should return false when path not complete', () => {
			const result = handler.handlePoint( { x: 100, y: 200 } );
			expect( result ).toBe( false );
		} );

		it( 'should complete path when close to start point', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			handler.handlePoint( { x: 200, y: 200 } );
			// Point close to start (within threshold of 10)
			const result = handler.handlePoint( { x: 105, y: 105 } );
			expect( result ).toBe( true );
			expect( addedLayers ).toHaveLength( 1 );
		} );

		it( 'should not complete path if not close enough to start', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			handler.handlePoint( { x: 200, y: 200 } );
			// Point not close to start
			const result = handler.handlePoint( { x: 150, y: 150 } );
			expect( result ).toBe( false );
			expect( addedLayers ).toHaveLength( 0 );
		} );

		it( 'should call renderPreview after adding point', () => {
			handler.handlePoint( { x: 100, y: 200 } );
			expect( renderCalled ).toBe( true );
		} );
	} );

	describe( 'complete', () => {
		it( 'should create a path layer with current points', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			handler.handlePoint( { x: 200, y: 200 } );
			handler.complete();

			expect( addedLayers ).toHaveLength( 1 );
			expect( addedLayers[ 0 ] ).toMatchObject( {
				type: 'path',
				points: [
					{ x: 100, y: 100 },
					{ x: 200, y: 100 },
					{ x: 200, y: 200 }
				],
				stroke: '#ff0000',
				strokeWidth: 3,
				fill: '#00ff00',
				closed: true
			} );
		} );

		it( 'should not create layer with less than 3 points', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			handler.complete();

			expect( addedLayers ).toHaveLength( 0 );
		} );

		it( 'should reset state after completing', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			handler.handlePoint( { x: 200, y: 200 } );
			handler.complete();

			expect( handler.pathPoints ).toEqual( [] );
			expect( handler.isDrawing ).toBe( false );
			expect( handler.isPathComplete ).toBe( false );
		} );
	} );

	describe( 'reset', () => {
		it( 'should clear path points', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			handler.reset();

			expect( handler.pathPoints ).toEqual( [] );
			expect( handler.isDrawing ).toBe( false );
		} );
	} );

	describe( 'cancel', () => {
		it( 'should reset state and call render callback', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			renderCalled = false; // Reset
			handler.cancel();

			expect( handler.pathPoints ).toEqual( [] );
			expect( handler.isDrawing ).toBe( false );
			expect( renderCalled ).toBe( true );
		} );
	} );

	describe( 'renderPreview', () => {
		it( 'should call render callback', () => {
			renderCalled = false;
			handler.handlePoint( { x: 100, y: 100 } );
			handler.renderPreview();
			expect( renderCalled ).toBe( true );
		} );

		it( 'should draw path lines on canvas context', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			renderCalled = false;
			handler.renderPreview();

			expect( mockCanvasManager.ctx.save ).toHaveBeenCalled();
			expect( mockCanvasManager.ctx.beginPath ).toHaveBeenCalled();
			expect( mockCanvasManager.ctx.moveTo ).toHaveBeenCalledWith( 100, 100 );
			expect( mockCanvasManager.ctx.lineTo ).toHaveBeenCalledWith( 200, 100 );
			expect( mockCanvasManager.ctx.stroke ).toHaveBeenCalled();
			expect( mockCanvasManager.ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw point markers', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.renderPreview();

			// arc is called for each point marker
			expect( mockCanvasManager.ctx.arc ).toHaveBeenCalledWith( 100, 100, 3, 0, 2 * Math.PI );
			expect( mockCanvasManager.ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should use dashed line for preview', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.renderPreview();

			expect( mockCanvasManager.ctx.setLineDash ).toHaveBeenCalledWith( [ 5, 5 ] );
		} );
	} );

	describe( 'getPoints', () => {
		it( 'should return a copy of path points', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );

			const points = handler.getPoints();
			expect( points ).toEqual( [ { x: 100, y: 100 }, { x: 200, y: 100 } ] );

			// Verify it's a copy
			points.push( { x: 300, y: 300 } );
			expect( handler.pathPoints ).toHaveLength( 2 );
		} );
	} );

	describe( 'isActive', () => {
		it( 'should return false when not drawing', () => {
			expect( handler.isActive() ).toBe( false );
		} );

		it( 'should return true when drawing with points', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			expect( handler.isActive() ).toBe( true );
		} );

		it( 'should return false after reset', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.reset();
			expect( handler.isActive() ).toBe( false );
		} );
	} );

	describe( 'getPointCount', () => {
		it( 'should return 0 for empty path', () => {
			expect( handler.getPointCount() ).toBe( 0 );
		} );

		it( 'should return correct count after adding points', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			expect( handler.getPointCount() ).toBe( 2 );
		} );
	} );

	describe( '_getCurrentStyle fallbacks', () => {
		it( 'should use styleManager.get() when available', () => {
			const style = handler._getCurrentStyle();
			expect( mockStyleManager.get ).toHaveBeenCalled();
			expect( style.color ).toBe( '#ff0000' );
		} );

		it( 'should fall back to currentStyle property', () => {
			handler.styleManager = { currentStyle: { color: '#0000ff', strokeWidth: 5 } };
			const style = handler._getCurrentStyle();
			expect( style.color ).toBe( '#0000ff' );
			expect( style.strokeWidth ).toBe( 5 );
		} );

		it( 'should use defaults when no style manager', () => {
			handler.styleManager = null;
			const style = handler._getCurrentStyle();
			expect( style.color ).toBe( '#000000' );
			expect( style.strokeWidth ).toBe( 2 );
			expect( style.fill ).toBe( 'transparent' );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all resources', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.destroy();

			expect( handler.pathPoints ).toEqual( [] );
			expect( handler.canvasManager ).toBeNull();
			expect( handler.styleManager ).toBeNull();
			expect( handler.addLayerCallback ).toBeNull();
			expect( handler.renderCallback ).toBeNull();
		} );

		it( 'should not throw when called multiple times', () => {
			handler.destroy();
			expect( () => handler.destroy() ).not.toThrow();
		} );
	} );

	describe( 'integration: closing path', () => {
		it( 'should close path when clicking near start with more than 2 points', () => {
			// Create a triangle-ish path
			handler.handlePoint( { x: 100, y: 100 } ); // Start
			handler.handlePoint( { x: 200, y: 100 } ); // Right
			handler.handlePoint( { x: 150, y: 200 } ); // Bottom

			// Click near start to close
			const closeResult = handler.handlePoint( { x: 103, y: 103 } );

			expect( closeResult ).toBe( true );
			expect( addedLayers ).toHaveLength( 1 );
			expect( addedLayers[ 0 ].type ).toBe( 'path' );
			expect( addedLayers[ 0 ].closed ).toBe( true );
		} );

		it( 'should use Euclidean distance for close detection', () => {
			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			handler.handlePoint( { x: 200, y: 200 } );

			// Point at exactly threshold distance (sqrt(50) = ~7.07 < 10)
			const result = handler.handlePoint( { x: 105, y: 105 } );
			expect( result ).toBe( true );

			// Reset for next test
			handler.reset();
			addedLayers.length = 0;

			handler.handlePoint( { x: 100, y: 100 } );
			handler.handlePoint( { x: 200, y: 100 } );
			handler.handlePoint( { x: 200, y: 200 } );

			// Point just outside threshold (sqrt(200) = ~14.14 > 10)
			const result2 = handler.handlePoint( { x: 110, y: 110 } );
			expect( result2 ).toBe( false );
		} );
	} );
} );
