/**
 * Tests for RenderCoordinator
 */

// Mock requestAnimationFrame and cancelAnimationFrame
let rafCallbacks = [];
let rafId = 0;
global.requestAnimationFrame = jest.fn( ( callback ) => {
	const id = ++rafId;
	rafCallbacks.push( { id, callback } );
	return id;
} );
global.cancelAnimationFrame = jest.fn( ( id ) => {
	rafCallbacks = rafCallbacks.filter( ( item ) => item.id !== id );
} );

// Execute pending animation frames
function flushAnimationFrames( timestamp = performance.now() ) {
	const callbacks = rafCallbacks.slice();
	rafCallbacks = [];
	callbacks.forEach( ( { callback } ) => callback( timestamp ) );
}

// Mock performance.now
let mockTime = 0;
global.performance = {
	now: jest.fn( () => mockTime )
};

// Load the module
require( '../../resources/ext.layers.editor/canvas/RenderCoordinator.js' );

describe( 'RenderCoordinator', () => {
	let RenderCoordinator;
	let mockCanvasManager;
	let coordinator;

	beforeEach( () => {
		RenderCoordinator = window.Layers.Canvas.RenderCoordinator;
		rafCallbacks = [];
		rafId = 0;
		mockTime = 0;
		jest.clearAllMocks();

		// Create mock canvas manager
		mockCanvasManager = {
			editor: {
				layers: [
					{ id: 'layer1', type: 'rectangle', x: 10, y: 10, width: 100, height: 100 }
				]
			},
			renderer: {
				redraw: jest.fn()
			}
		};

		coordinator = new RenderCoordinator( mockCanvasManager );
	} );

	afterEach( () => {
		if ( coordinator && !coordinator.isDestroyed ) {
			coordinator.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default options', () => {
			expect( coordinator.canvasManager ).toBe( mockCanvasManager );
			expect( coordinator.pendingRedraw ).toBe( false );
			expect( coordinator.enableMetrics ).toBe( false );
			expect( coordinator.targetFps ).toBe( 60 );
		} );

		it( 'should accept custom options', () => {
			const customCoordinator = new RenderCoordinator( mockCanvasManager, {
				enableMetrics: true,
				targetFps: 30
			} );
			expect( customCoordinator.enableMetrics ).toBe( true );
			expect( customCoordinator.targetFps ).toBe( 30 );
			customCoordinator.destroy();
		} );
	} );

	describe( 'scheduleRedraw', () => {
		it( 'should schedule a redraw using requestAnimationFrame', () => {
			coordinator.scheduleRedraw();

			expect( coordinator.pendingRedraw ).toBe( true );
			expect( global.requestAnimationFrame ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should coalesce multiple redraw requests into one', () => {
			coordinator.scheduleRedraw();
			coordinator.scheduleRedraw();
			coordinator.scheduleRedraw();

			expect( global.requestAnimationFrame ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should perform redraw on animation frame', () => {
			coordinator.scheduleRedraw();
			flushAnimationFrames();

			expect( mockCanvasManager.renderer.redraw ).toHaveBeenCalledTimes( 1 );
			expect( mockCanvasManager.renderer.redraw ).toHaveBeenCalledWith(
				mockCanvasManager.editor.layers
			);
		} );

		it( 'should allow scheduling after redraw completes', () => {
			coordinator.scheduleRedraw();
			flushAnimationFrames();

			coordinator.scheduleRedraw();
			expect( global.requestAnimationFrame ).toHaveBeenCalledTimes( 2 );

			flushAnimationFrames();
			expect( mockCanvasManager.renderer.redraw ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'should support immediate redraw option', () => {
			coordinator.scheduleRedraw( { immediate: true } );

			expect( mockCanvasManager.renderer.redraw ).toHaveBeenCalledTimes( 1 );
			expect( global.requestAnimationFrame ).not.toHaveBeenCalled();
		} );

		it( 'should return this for chaining', () => {
			const result = coordinator.scheduleRedraw();
			expect( result ).toBe( coordinator );
		} );

		it( 'should not schedule after destroy', () => {
			coordinator.destroy();
			coordinator.scheduleRedraw();

			expect( global.requestAnimationFrame ).not.toHaveBeenCalled();
		} );

		it( 'should fall back to setTimeout when requestAnimationFrame is unavailable', () => {
			jest.useFakeTimers();
			
			// Temporarily remove rAF
			const originalRAF = global.requestAnimationFrame;
			delete global.window.requestAnimationFrame;
			global.requestAnimationFrame = undefined;
			
			// Create a new coordinator that will use the fallback
			const fallbackCoordinator = new RenderCoordinator( mockCanvasManager );
			fallbackCoordinator.scheduleRedraw();
			
			// Fast-forward timers
			jest.advanceTimersByTime( 20 );
			
			expect( mockCanvasManager.renderer.redraw ).toHaveBeenCalled();
			
			// Cleanup
			fallbackCoordinator.destroy();
			global.requestAnimationFrame = originalRAF;
			jest.useRealTimers();
		} );
	} );

	describe( 'dirty regions', () => {
		it( 'should track dirty regions', () => {
			coordinator.scheduleRedraw( { region: { x: 0, y: 0, width: 100, height: 100 } } );

			expect( coordinator.dirtyRegions ).toHaveLength( 1 );
			expect( coordinator.dirtyRegions[ 0 ] ).toEqual( { x: 0, y: 0, width: 100, height: 100 } );
		} );

		it( 'should clear dirty regions after redraw', () => {
			coordinator.scheduleRedraw( { region: { x: 0, y: 0, width: 100, height: 100 } } );
			flushAnimationFrames();

			expect( coordinator.dirtyRegions ).toHaveLength( 0 );
		} );

		it( 'should mark full redraw when no region specified', () => {
			coordinator.scheduleRedraw();

			expect( coordinator.fullRedrawRequired ).toBe( true );
		} );

		it( 'should support markDirty helper', () => {
			coordinator.markDirty( 10, 20, 50, 60 );

			expect( coordinator.dirtyRegions ).toHaveLength( 1 );
			expect( coordinator.dirtyRegions[ 0 ] ).toEqual( { x: 10, y: 20, width: 50, height: 60 } );
			expect( coordinator.pendingRedraw ).toBe( true );
		} );

		it( 'should support markFullRedraw helper', () => {
			coordinator.markFullRedraw();

			expect( coordinator.fullRedrawRequired ).toBe( true );
			expect( coordinator.pendingRedraw ).toBe( true );
		} );
	} );

	describe( 'callbacks', () => {
		it( 'should call pre-render callbacks before redraw', () => {
			const preCallback = jest.fn();
			coordinator.addPreRenderCallback( preCallback );

			coordinator.scheduleRedraw();
			flushAnimationFrames();

			expect( preCallback ).toHaveBeenCalledTimes( 1 );
			expect( preCallback ).toHaveBeenCalledBefore( mockCanvasManager.renderer.redraw );
		} );

		it( 'should call post-render callbacks after redraw', () => {
			const postCallback = jest.fn();
			coordinator.addPostRenderCallback( postCallback );

			coordinator.scheduleRedraw();
			flushAnimationFrames();

			expect( postCallback ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should support removing callbacks', () => {
			const callback = jest.fn();
			coordinator.addPreRenderCallback( callback );
			coordinator.removePreRenderCallback( callback );

			coordinator.scheduleRedraw();
			flushAnimationFrames();

			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'should support removing post-render callbacks', () => {
			const callback = jest.fn();
			coordinator.addPostRenderCallback( callback );
			coordinator.removePostRenderCallback( callback );

			coordinator.scheduleRedraw();
			flushAnimationFrames();

			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'should handle removing callback that does not exist', () => {
			const callback = jest.fn();
			// Try to remove a callback that was never added
			expect( () => {
				coordinator.removePreRenderCallback( callback );
				coordinator.removePostRenderCallback( callback );
			} ).not.toThrow();
		} );

		it( 'should handle callback errors gracefully', () => {
			const errorCallback = jest.fn( () => {
				throw new Error( 'Test error' );
			} );
			const normalCallback = jest.fn();

			coordinator.addPreRenderCallback( errorCallback );
			coordinator.addPreRenderCallback( normalCallback );

			coordinator.scheduleRedraw();
			flushAnimationFrames();

			// Both callbacks should have been called despite the error
			expect( errorCallback ).toHaveBeenCalled();
			expect( normalCallback ).toHaveBeenCalled();
			expect( mockCanvasManager.renderer.redraw ).toHaveBeenCalled();
		} );
	} );

	describe( 'cancelPendingRedraw', () => {
		it( 'should cancel pending animation frame', () => {
			coordinator.scheduleRedraw();
			const result = coordinator.cancelPendingRedraw();

			expect( global.cancelAnimationFrame ).toHaveBeenCalled();
			expect( coordinator.pendingRedraw ).toBe( false );
			expect( result ).toBe( coordinator );
		} );

		it( 'should prevent redraw from executing', () => {
			coordinator.scheduleRedraw();
			coordinator.cancelPendingRedraw();
			flushAnimationFrames();

			expect( mockCanvasManager.renderer.redraw ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'metrics', () => {
		beforeEach( () => {
			coordinator.setMetricsEnabled( true );
		} );

		it( 'should track frame times when enabled', () => {
			coordinator.scheduleRedraw();
			mockTime = 16.67; // ~60fps
			flushAnimationFrames( 16.67 );

			coordinator.scheduleRedraw();
			mockTime = 33.34;
			flushAnimationFrames( 33.34 );

			expect( coordinator.frameCount ).toBe( 2 );
		} );

		it( 'should return metrics via getMetrics', () => {
			coordinator.scheduleRedraw();
			flushAnimationFrames( 16.67 );

			coordinator.scheduleRedraw();
			flushAnimationFrames( 33.34 );

			const metrics = coordinator.getMetrics();
			expect( metrics.frameCount ).toBe( 2 );
			expect( metrics.enabled ).toBe( true );
			expect( typeof metrics.fps ).toBe( 'number' );
			expect( typeof metrics.avgFrameTime ).toBe( 'number' );
		} );

		it( 'should reset metrics', () => {
			coordinator.scheduleRedraw();
			flushAnimationFrames( 16.67 );

			coordinator.resetMetrics();

			expect( coordinator.frameCount ).toBe( 0 );
			expect( coordinator.frameTimes ).toHaveLength( 0 );
		} );

		it( 'should return empty metrics when disabled', () => {
			coordinator.setMetricsEnabled( false );
			const metrics = coordinator.getMetrics();

			expect( metrics.fps ).toBe( 0 );
			expect( metrics.avgFrameTime ).toBe( 0 );
			expect( metrics.enabled ).toBe( false );
		} );
	} );

	describe( 'error handling', () => {
		it( 'should handle renderer errors gracefully', () => {
			mockCanvasManager.renderer.redraw = jest.fn( () => {
				throw new Error( 'Render error' );
			} );

			// Should not throw
			expect( () => {
				coordinator.scheduleRedraw();
				flushAnimationFrames();
			} ).not.toThrow();
		} );

		it( 'should log errors using mw.log.error when available', () => {
			const mockLogError = jest.fn();
			global.mw = {
				log: {
					error: mockLogError
				}
			};
			
			mockCanvasManager.renderer.redraw = jest.fn( () => {
				throw new Error( 'Render error' );
			} );

			coordinator.scheduleRedraw();
			flushAnimationFrames();

			expect( mockLogError ).toHaveBeenCalledWith(
				'[RenderCoordinator]',
				expect.any( String ),
				expect.any( Error )
			);
			
			delete global.mw;
		} );

		it( 'should call window.layersErrorHandler when available', () => {
			const mockErrorHandler = jest.fn();
			global.window.layersErrorHandler = {
				handleError: mockErrorHandler
			};
			
			mockCanvasManager.renderer.redraw = jest.fn( () => {
				throw new Error( 'Render error' );
			} );

			coordinator.scheduleRedraw();
			flushAnimationFrames();

			expect( mockErrorHandler ).toHaveBeenCalledWith(
				expect.any( Error ),
				'RenderCoordinator._performRedraw',
				'canvas'
			);
			
			delete global.window.layersErrorHandler;
		} );

		it( 'should handle missing renderer', () => {
			mockCanvasManager.renderer = null;

			expect( () => {
				coordinator.scheduleRedraw();
				flushAnimationFrames();
			} ).not.toThrow();
		} );

		it( 'should handle missing layers', () => {
			mockCanvasManager.editor = null;

			coordinator.scheduleRedraw();
			flushAnimationFrames();

			expect( mockCanvasManager.renderer.redraw ).toHaveBeenCalledWith( [] );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up resources', () => {
			const callback = jest.fn();
			coordinator.addPreRenderCallback( callback );
			coordinator.scheduleRedraw();

			coordinator.destroy();

			expect( coordinator.isDestroyed ).toBe( true );
			expect( coordinator.preRenderCallbacks ).toHaveLength( 0 );
			expect( coordinator.postRenderCallbacks ).toHaveLength( 0 );
			expect( coordinator.canvasManager ).toBeNull();
		} );

		it( 'should cancel pending redraws', () => {
			coordinator.scheduleRedraw();
			coordinator.destroy();

			expect( global.cancelAnimationFrame ).toHaveBeenCalled();
		} );

		it( 'should prevent further redraws', () => {
			coordinator.destroy();
			coordinator.scheduleRedraw();
			flushAnimationFrames();

			expect( mockCanvasManager.renderer.redraw ).not.toHaveBeenCalled();
		} );
	} );
} );

// Add matcher for call order
expect.extend( {
	toHaveBeenCalledBefore( received, other ) {
		const receivedCalls = received.mock.invocationCallOrder;
		const otherCalls = other.mock.invocationCallOrder;

		if ( receivedCalls.length === 0 || otherCalls.length === 0 ) {
			return {
				pass: false,
				message: () => 'Expected both functions to have been called'
			};
		}

		const pass = receivedCalls[ 0 ] < otherCalls[ 0 ];
		return {
			pass,
			message: () =>
				pass
					? 'Expected first function not to have been called before second'
					: 'Expected first function to have been called before second'
		};
	}
} );
