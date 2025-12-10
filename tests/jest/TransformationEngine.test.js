/**
 * @jest-environment jsdom
 *
 * Comprehensive unit tests for TransformationEngine
 *
 * TransformationEngine handles zoom, pan, rotation, and coordinate transformations
 * for the Layers editor canvas. These tests ensure viewport transformations work
 * correctly across all zoom levels and pan states.
 *
 * @see resources/ext.layers.editor/TransformationEngine.js
 */

const TransformationEngine = require( '../../resources/ext.layers.editor/TransformationEngine.js' );

describe( 'TransformationEngine', () => {
	let engine;
	let mockCanvas;
	let mockContainer;

	beforeEach( () => {
		// Create mock canvas with parent container
		mockContainer = document.createElement( 'div' );
		Object.defineProperty( mockContainer, 'clientWidth', { value: 800, configurable: true } );
		Object.defineProperty( mockContainer, 'clientHeight', { value: 600, configurable: true } );

		mockCanvas = document.createElement( 'canvas' );
		mockCanvas.width = 800;
		mockCanvas.height = 600;
		mockContainer.appendChild( mockCanvas );

		// Mock getBoundingClientRect
		mockCanvas.getBoundingClientRect = jest.fn( () => ( {
			left: 0,
			top: 0,
			width: 800,
			height: 600,
			right: 800,
			bottom: 600
		} ) );

		// Mock performance.now for animations
		jest.spyOn( performance, 'now' ).mockReturnValue( 0 );

		// Mock requestAnimationFrame
		jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation( ( cb ) => {
			setTimeout( cb, 16 );
			return 1;
		} );

		engine = new TransformationEngine( mockCanvas, {} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		if ( engine ) {
			engine.destroy();
		}
	} );

	describe( 'initialization', () => {
		test( 'should create TransformationEngine with default properties', () => {
			expect( engine.canvas ).toBe( mockCanvas );
			expect( engine.zoom ).toBe( 1.0 );
			expect( engine.minZoom ).toBe( 0.1 );
			expect( engine.maxZoom ).toBe( 5.0 );
			expect( engine.panX ).toBe( 0 );
			expect( engine.panY ).toBe( 0 );
			expect( engine.isPanning ).toBe( false );
			expect( engine.snapToGrid ).toBe( false );
			expect( engine.gridSize ).toBe( 10 );
		} );

		test( 'should initialize with custom config values', () => {
			const customEngine = new TransformationEngine( mockCanvas, {
				minZoom: 0.5,
				maxZoom: 3.0,
				gridSize: 20
			} );

			expect( customEngine.minZoom ).toBe( 0.5 );
			expect( customEngine.maxZoom ).toBe( 3.0 );
			expect( customEngine.gridSize ).toBe( 20 );

			customEngine.destroy();
		} );

		test( 'should initialize with editor reference', () => {
			const mockEditor = { updateStatus: jest.fn() };
			const engineWithEditor = new TransformationEngine( mockCanvas, { editor: mockEditor } );

			expect( engineWithEditor.editor ).toBe( mockEditor );

			engineWithEditor.destroy();
		} );
	} );

	describe( 'zoom operations', () => {
		test( 'setZoom should set zoom level', () => {
			engine.setZoom( 2.0 );
			expect( engine.zoom ).toBe( 2.0 );
			expect( engine.userHasSetZoom ).toBe( true );
		} );

		test( 'setZoom should clamp to minimum', () => {
			engine.setZoom( 0.01 );
			expect( engine.zoom ).toBe( 0.1 );
		} );

		test( 'setZoom should clamp to maximum', () => {
			engine.setZoom( 10.0 );
			expect( engine.zoom ).toBe( 5.0 );
		} );

		test( 'getZoom should return current zoom level', () => {
			engine.setZoom( 1.5 );
			expect( engine.getZoom() ).toBe( 1.5 );
		} );

		test( 'setZoomDirect should set zoom without user flag modification', () => {
			engine.userHasSetZoom = false;
			engine.setZoomDirect( 2.0 );

			expect( engine.zoom ).toBe( 2.0 );
			// setZoomDirect doesn't modify userHasSetZoom
		} );

		test( 'zoomIn should increase zoom level', () => {
			engine.zoom = 1.0;
			engine.zoomIn();

			// Zoom target is set for animation
			expect( engine.zoomAnimationTargetZoom ).toBe( 1.2 );
			expect( engine.userHasSetZoom ).toBe( true );
		} );

		test( 'zoomOut should decrease zoom level', () => {
			engine.zoom = 1.0;
			engine.zoomOut();

			expect( engine.zoomAnimationTargetZoom ).toBe( 0.8 );
			expect( engine.userHasSetZoom ).toBe( true );
		} );

		test( 'zoomIn should not exceed maximum', () => {
			engine.zoom = 4.9;
			engine.zoomIn();

			// Animation target should be clamped
			expect( engine.zoomAnimationTargetZoom ).toBeLessThanOrEqual( 5.0 );
		} );

		test( 'zoomOut should not go below minimum', () => {
			engine.zoom = 0.2;
			engine.zoomOut();

			expect( engine.zoomAnimationTargetZoom ).toBeGreaterThanOrEqual( 0.1 );
		} );

		test( 'zoomBy should zoom by delta amount', () => {
			engine.zoom = 1.0;
			engine.zoomBy( 0.5, null );

			expect( engine.zoom ).toBe( 1.5 );
			expect( engine.userHasSetZoom ).toBe( true );
		} );

		test( 'zoomBy should zoom around anchor point', () => {
			engine.zoom = 1.0;
			engine.panX = 0;
			engine.panY = 0;

			const anchor = { x: 100, y: 100 };
			engine.zoomBy( 1.0, anchor );

			// After zooming in with anchor, the anchor point should stay at same screen position
			expect( engine.zoom ).toBe( 2.0 );
			// Pan should be adjusted
			expect( engine.panX ).not.toBe( 0 );
		} );

		test( 'resetZoom should reset to default state', () => {
			engine.setZoom( 2.0 );
			engine.panX = 100;
			engine.panY = 50;

			engine.resetZoom();

			expect( engine.panX ).toBe( 0 );
			expect( engine.panY ).toBe( 0 );
			expect( engine.zoomAnimationTargetZoom ).toBe( 1.0 );
			expect( engine.userHasSetZoom ).toBe( true );
		} );

		test( 'setZoom should update editor status', () => {
			const mockEditor = { updateStatus: jest.fn() };
			const engineWithEditor = new TransformationEngine( mockCanvas, { editor: mockEditor } );

			engineWithEditor.setZoom( 2.0 );

			expect( mockEditor.updateStatus ).toHaveBeenCalledWith( { zoomPercent: 200 } );

			engineWithEditor.destroy();
		} );
	} );

	describe( 'zoom limits', () => {
		test( 'setZoomLimits should update min and max zoom', () => {
			engine.setZoomLimits( 0.25, 4.0 );

			expect( engine.minZoom ).toBe( 0.25 );
			expect( engine.maxZoom ).toBe( 4.0 );
		} );

		test( 'setZoomLimits should clamp current zoom if out of bounds', () => {
			engine.setZoom( 2.0 );
			engine.setZoomLimits( 0.5, 1.5 );

			expect( engine.zoom ).toBe( 1.5 );
		} );

		test( 'setZoomLimits should ignore invalid min value', () => {
			engine.minZoom = 0.1;
			engine.setZoomLimits( -1, 5.0 );

			expect( engine.minZoom ).toBe( 0.1 );
		} );

		test( 'setZoomLimits should ignore max lower than min', () => {
			engine.minZoom = 0.5;
			engine.maxZoom = 5.0;
			engine.setZoomLimits( 0.5, 0.2 );

			expect( engine.maxZoom ).toBe( 5.0 );
		} );

		test( 'getZoomLimits should return current limits', () => {
			engine.minZoom = 0.2;
			engine.maxZoom = 4.0;

			const limits = engine.getZoomLimits();

			expect( limits.min ).toBe( 0.2 );
			expect( limits.max ).toBe( 4.0 );
		} );
	} );

	describe( 'smooth zoom animation', () => {
		test( 'smoothZoomTo should start animation', () => {
			engine.zoom = 1.0;
			engine.smoothZoomTo( 2.0 );

			expect( engine.isAnimatingZoom ).toBe( true );
			expect( engine.zoomAnimationStartZoom ).toBe( 1.0 );
			expect( engine.zoomAnimationTargetZoom ).toBe( 2.0 );
		} );

		test( 'smoothZoomTo should not animate if already at target', () => {
			engine.zoom = 2.0;
			engine.smoothZoomTo( 2.0 );

			expect( engine.isAnimatingZoom ).toBe( false );
		} );

		test( 'smoothZoomTo should clamp target to limits', () => {
			engine.smoothZoomTo( 10.0 );
			expect( engine.zoomAnimationTargetZoom ).toBe( 5.0 );

			engine.isAnimatingZoom = false;
			engine.smoothZoomTo( 0.01 );
			expect( engine.zoomAnimationTargetZoom ).toBe( 0.1 );
		} );

		test( 'smoothZoomTo should accept custom duration', () => {
			engine.smoothZoomTo( 2.0, 500 );
			expect( engine.zoomAnimationDuration ).toBe( 500 );
		} );

		test( 'isAnimating should return animation state', () => {
			expect( engine.isAnimating() ).toBe( false );

			engine.smoothZoomTo( 2.0 );
			expect( engine.isAnimating() ).toBe( true );
		} );

		test( 'animateZoom should progress animation', () => {
			engine.zoom = 1.0;
			engine.isAnimatingZoom = true;
			engine.zoomAnimationStartTime = 0;
			engine.zoomAnimationStartZoom = 1.0;
			engine.zoomAnimationTargetZoom = 2.0;
			engine.zoomAnimationDuration = 300;

			// Simulate mid-animation (150ms elapsed)
			performance.now.mockReturnValue( 150 );
			engine.animateZoom();

			// Should be animating toward target
			expect( engine.zoom ).toBeGreaterThan( 1.0 );
			expect( engine.zoom ).toBeLessThan( 2.0 );
		} );

		test( 'animateZoom should complete animation', () => {
			engine.zoom = 1.0;
			engine.isAnimatingZoom = true;
			engine.zoomAnimationStartTime = 0;
			engine.zoomAnimationStartZoom = 1.0;
			engine.zoomAnimationTargetZoom = 2.0;
			engine.zoomAnimationDuration = 300;

			// Simulate animation complete (400ms elapsed)
			performance.now.mockReturnValue( 400 );
			engine.animateZoom();

			expect( engine.zoom ).toBe( 2.0 );
			expect( engine.isAnimatingZoom ).toBe( false );
		} );

		test( 'animateZoom should stop if isAnimatingZoom is false', () => {
			engine.isAnimatingZoom = false;
			engine.zoom = 1.0;

			engine.animateZoom();

			expect( engine.zoom ).toBe( 1.0 );
		} );
	} );

	describe( 'pan operations', () => {
		test( 'getPan should return current pan position', () => {
			engine.panX = 50;
			engine.panY = 100;

			const pan = engine.getPan();

			expect( pan.x ).toBe( 50 );
			expect( pan.y ).toBe( 100 );
		} );

		test( 'setPan should set pan position', () => {
			engine.setPan( 100, 200 );

			expect( engine.panX ).toBe( 100 );
			expect( engine.panY ).toBe( 200 );
		} );

		test( 'panByPixels should add to pan position', () => {
			engine.panX = 50;
			engine.panY = 50;

			engine.panByPixels( 25, 30 );

			expect( engine.panX ).toBe( 75 );
			expect( engine.panY ).toBe( 80 );
		} );

		test( 'startPan should begin panning operation', () => {
			engine.startPan( 100, 150 );

			expect( engine.isPanning ).toBe( true );
			expect( engine.lastPanPoint ).toEqual( { x: 100, y: 150 } );
		} );

		test( 'updatePan should update pan during drag', () => {
			engine.startPan( 100, 100 );
			engine.updatePan( 150, 120 );

			expect( engine.panX ).toBe( 50 );
			expect( engine.panY ).toBe( 20 );
			expect( engine.lastPanPoint ).toEqual( { x: 150, y: 120 } );
		} );

		test( 'updatePan should do nothing if not panning', () => {
			engine.panX = 0;
			engine.panY = 0;

			engine.updatePan( 100, 100 );

			expect( engine.panX ).toBe( 0 );
			expect( engine.panY ).toBe( 0 );
		} );

		test( 'stopPan should end panning operation', () => {
			engine.startPan( 100, 100 );
			engine.stopPan();

			expect( engine.isPanning ).toBe( false );
			expect( engine.lastPanPoint ).toBe( null );
		} );

		test( 'isPanningActive should return panning state', () => {
			expect( engine.isPanningActive() ).toBe( false );

			engine.startPan( 100, 100 );
			expect( engine.isPanningActive() ).toBe( true );

			engine.stopPan();
			expect( engine.isPanningActive() ).toBe( false );
		} );
	} );

	describe( 'coordinate conversions', () => {
		test( 'clientToCanvas should convert coordinates at 1x zoom', () => {
			engine.zoom = 1.0;
			engine.panX = 0;
			engine.panY = 0;

			const result = engine.clientToCanvas( 100, 150 );

			expect( result.x ).toBe( 100 );
			expect( result.y ).toBe( 150 );
		} );

		test( 'clientToCanvas should account for zoom', () => {
			engine.zoom = 2.0;
			engine.panX = 0;
			engine.panY = 0;

			const result = engine.clientToCanvas( 200, 300 );

			expect( result.x ).toBe( 100 );
			expect( result.y ).toBe( 150 );
		} );

		test( 'clientToCanvas should account for pan', () => {
			engine.zoom = 1.0;
			engine.panX = 50;
			engine.panY = 100;

			const result = engine.clientToCanvas( 100, 150 );

			expect( result.x ).toBe( 50 );
			expect( result.y ).toBe( 50 );
		} );

		test( 'clientToCanvas should account for both zoom and pan', () => {
			engine.zoom = 2.0;
			engine.panX = 25;
			engine.panY = 50;

			const result = engine.clientToCanvas( 200, 300 );

			expect( result.x ).toBe( 75 );
			expect( result.y ).toBe( 100 );
		} );

		test( 'clientToCanvas should apply grid snapping when enabled', () => {
			engine.zoom = 1.0;
			engine.panX = 0;
			engine.panY = 0;
			engine.snapToGrid = true;
			engine.gridSize = 10;

			const result = engine.clientToCanvas( 53, 67 );

			expect( result.x ).toBe( 50 );
			expect( result.y ).toBe( 70 );
		} );

		test( 'clientToCanvas should return zeros if no canvas', () => {
			engine.canvas = null;
			const result = engine.clientToCanvas( 100, 100 );

			expect( result.x ).toBe( 0 );
			expect( result.y ).toBe( 0 );
		} );

		test( 'canvasToClient should convert canvas to client coordinates', () => {
			engine.zoom = 1.0;

			const result = engine.canvasToClient( 100, 150 );

			expect( result.x ).toBe( 100 );
			expect( result.y ).toBe( 150 );
		} );

		test( 'canvasToClient should return zeros if no canvas', () => {
			engine.canvas = null;
			const result = engine.canvasToClient( 100, 100 );

			expect( result.x ).toBe( 0 );
			expect( result.y ).toBe( 0 );
		} );

		test( 'getRawCoordinates should return coordinates without snapping', () => {
			engine.zoom = 1.0;
			engine.panX = 0;
			engine.panY = 0;
			engine.snapToGrid = true;
			engine.gridSize = 10;

			const mockEvent = { clientX: 53, clientY: 67 };
			const result = engine.getRawCoordinates( mockEvent );

			// Raw coordinates should not be snapped
			expect( result.canvasX ).toBe( 53 );
			expect( result.canvasY ).toBe( 67 );
		} );

		test( 'getRawCoordinates should return zeros if no canvas', () => {
			engine.canvas = null;
			const mockEvent = { clientX: 100, clientY: 100 };
			const result = engine.getRawCoordinates( mockEvent );

			expect( result.canvasX ).toBe( 0 );
			expect( result.canvasY ).toBe( 0 );
		} );
	} );

	describe( 'grid snapping', () => {
		test( 'setSnapToGrid should enable/disable grid snapping', () => {
			expect( engine.snapToGrid ).toBe( false );

			engine.setSnapToGrid( true );
			expect( engine.snapToGrid ).toBe( true );

			engine.setSnapToGrid( false );
			expect( engine.snapToGrid ).toBe( false );
		} );

		test( 'setSnapToGrid should coerce values to boolean', () => {
			engine.setSnapToGrid( 1 );
			expect( engine.snapToGrid ).toBe( true );

			engine.setSnapToGrid( 0 );
			expect( engine.snapToGrid ).toBe( false );
		} );

		test( 'setGridSize should update grid size', () => {
			engine.setGridSize( 25 );
			expect( engine.gridSize ).toBe( 25 );
		} );

		test( 'setGridSize should reject invalid values', () => {
			engine.gridSize = 10;

			engine.setGridSize( -5 );
			expect( engine.gridSize ).toBe( 10 );

			engine.setGridSize( 0 );
			expect( engine.gridSize ).toBe( 10 );

			engine.setGridSize( 'invalid' );
			expect( engine.gridSize ).toBe( 10 );
		} );
	} );

	describe( 'viewport bounds', () => {
		test( 'updateViewportBounds should calculate visible area', () => {
			engine.zoom = 1.0;
			engine.panX = 0;
			engine.panY = 0;

			engine.updateViewportBounds();

			// Use toBeCloseTo to handle -0 vs 0 edge case
			expect( engine.viewportBounds.x ).toBeCloseTo( 0, 10 );
			expect( engine.viewportBounds.y ).toBeCloseTo( 0, 10 );
			expect( engine.viewportBounds.width ).toBe( 800 );
			expect( engine.viewportBounds.height ).toBe( 600 );
		} );

		test( 'updateViewportBounds should account for zoom', () => {
			engine.zoom = 2.0;
			engine.panX = 0;
			engine.panY = 0;

			engine.updateViewportBounds();

			expect( engine.viewportBounds.width ).toBe( 400 );
			expect( engine.viewportBounds.height ).toBe( 300 );
		} );

		test( 'updateViewportBounds should account for pan', () => {
			engine.zoom = 1.0;
			engine.panX = 100;
			engine.panY = 50;

			engine.updateViewportBounds();

			expect( engine.viewportBounds.x ).toBe( -100 );
			expect( engine.viewportBounds.y ).toBe( -50 );
		} );

		test( 'updateViewportBounds should handle missing canvas', () => {
			engine.canvas = null;
			expect( () => engine.updateViewportBounds() ).not.toThrow();
		} );

		test( 'updateViewportBounds should handle missing container', () => {
			mockCanvas.remove();
			expect( () => engine.updateViewportBounds() ).not.toThrow();
		} );

		test( 'getViewportBounds should return current bounds', () => {
			engine.viewportBounds = { x: 10, y: 20, width: 300, height: 200 };

			const bounds = engine.getViewportBounds();

			expect( bounds ).toEqual( { x: 10, y: 20, width: 300, height: 200 } );
		} );
	} );

	describe( 'fit operations', () => {
		test( 'fitToWindow should fit image to container', () => {
			const mockImage = { width: 1600, height: 1200 };

			engine.fitToWindow( mockImage );

			// Container is 800x600 with 40px padding = 760x560 usable
			// Image is 1600x1200, scale to fit: min(760/1600, 560/1200) = min(0.475, 0.467) = 0.467
			expect( engine.zoomAnimationTargetZoom ).toBeCloseTo( 0.467, 2 );
			expect( engine.panX ).toBe( 0 );
			expect( engine.panY ).toBe( 0 );
			expect( engine.userHasSetZoom ).toBe( true );
		} );

		test( 'fitToWindow should do nothing without image', () => {
			engine.zoom = 2.0;
			engine.fitToWindow( null );

			// Should not change zoom
			expect( engine.zoom ).toBe( 2.0 );
		} );

		test( 'fitToWindow should do nothing without canvas', () => {
			engine.canvas = null;
			const mockImage = { width: 800, height: 600 };

			expect( () => engine.fitToWindow( mockImage ) ).not.toThrow();
		} );

		test( 'fitToWindow should update toolbar', () => {
			const mockToolbar = { updateZoomDisplay: jest.fn() };
			const mockEditor = { toolbar: mockToolbar };
			const engineWithEditor = new TransformationEngine( mockCanvas, { editor: mockEditor } );
			const mockImage = { width: 800, height: 600 };

			engineWithEditor.fitToWindow( mockImage );

			expect( mockToolbar.updateZoomDisplay ).toHaveBeenCalled();

			engineWithEditor.destroy();
		} );

		test( 'zoomToFitBounds should fit bounds with padding', () => {
			const bounds = { left: 100, top: 100, right: 300, bottom: 300 };

			engine.zoomToFitBounds( bounds, 50 );

			// Content is 200x200 + 100 padding = 300x300
			// Container is 760x560 after padding
			// Scale: min(760/300, 560/300) = min(2.53, 1.87) = 1.87
			expect( engine.zoomAnimationTargetZoom ).toBeCloseTo( 1.87, 1 );
			expect( engine.userHasSetZoom ).toBe( true );
		} );

		test( 'zoomToFitBounds should use default padding', () => {
			const bounds = { left: 0, top: 0, right: 400, bottom: 300 };

			engine.zoomToFitBounds( bounds );

			// Should use default padding of 50
			expect( engine.isAnimatingZoom ).toBe( true );
		} );

		test( 'zoomToFitBounds should do nothing without bounds', () => {
			engine.zoom = 1.0;
			engine.zoomToFitBounds( null );

			expect( engine.zoom ).toBe( 1.0 );
		} );

		test( 'zoomToFitBounds should do nothing without canvas', () => {
			engine.canvas = null;
			const bounds = { left: 0, top: 0, right: 100, bottom: 100 };

			expect( () => engine.zoomToFitBounds( bounds ) ).not.toThrow();
		} );
	} );

	describe( 'configuration', () => {
		test( 'updateConfig should update configuration', () => {
			engine.updateConfig( { gridSize: 25 } );
			expect( engine.gridSize ).toBe( 25 );
		} );

		test( 'updateConfig should update editor reference', () => {
			const mockEditor = { updateStatus: jest.fn() };
			engine.updateConfig( { editor: mockEditor } );

			expect( engine.editor ).toBe( mockEditor );
		} );

		test( 'updateConfig should do nothing with null config', () => {
			const originalConfig = { ...engine.config };
			engine.updateConfig( null );

			// Config should be unchanged
			expect( engine.config ).toEqual( originalConfig );
		} );
	} );

	describe( 'destroy', () => {
		test( 'destroy should clean up resources', () => {
			engine.destroy();

			expect( engine.canvas ).toBe( null );
			expect( engine.editor ).toBe( null );
			expect( engine.config ).toBe( null );
			expect( engine.isAnimatingZoom ).toBe( false );
			expect( engine.lastPanPoint ).toBe( null );
		} );
	} );

	describe( 'edge cases', () => {
		test( 'should handle very small zoom levels', () => {
			engine.setZoom( 0.1 );
			expect( engine.zoom ).toBe( 0.1 );

			const result = engine.clientToCanvas( 1000, 1000 );
			expect( result.x ).toBe( 10000 );
			expect( result.y ).toBe( 10000 );
		} );

		test( 'should handle very large zoom levels', () => {
			engine.setZoom( 5.0 );
			expect( engine.zoom ).toBe( 5.0 );

			const result = engine.clientToCanvas( 100, 100 );
			expect( result.x ).toBe( 20 );
			expect( result.y ).toBe( 20 );
		} );

		test( 'should handle negative pan values', () => {
			engine.setPan( -100, -200 );

			expect( engine.panX ).toBe( -100 );
			expect( engine.panY ).toBe( -200 );

			const result = engine.clientToCanvas( 100, 100 );
			expect( result.x ).toBe( 200 );
			expect( result.y ).toBe( 300 );
		} );

		test( 'should handle rapid zoom changes', () => {
			for ( let i = 0; i < 10; i++ ) {
				engine.setZoom( 1.0 + ( i * 0.1 ) );
			}

			expect( engine.zoom ).toBe( 1.9 );
		} );

		test( 'should handle rapid pan updates', () => {
			engine.startPan( 0, 0 );

			for ( let i = 1; i <= 10; i++ ) {
				engine.updatePan( i * 10, i * 5 );
			}

			engine.stopPan();

			expect( engine.panX ).toBe( 100 );
			expect( engine.panY ).toBe( 50 );
		} );
	} );
} );
