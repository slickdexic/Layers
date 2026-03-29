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

describe( 'P1.9 regression: _computeLayersHash includes all layers', () => {
	let RenderCoordinator, coordinator, mockCanvasManager;

	beforeEach( () => {
		RenderCoordinator = window.Layers.Canvas.RenderCoordinator;
		mockCanvasManager = {
			editor: { layers: [] },
			renderer: null
		};
		coordinator = new RenderCoordinator( mockCanvasManager );
	} );

	it( 'should include layers beyond index 20 in hash', () => {
		const layers = [];
		for ( let i = 0; i < 25; i++ ) {
			layers.push( { id: 'layer' + i, x: i, y: 0, width: 10, height: 10 } );
		}
		const hash1 = coordinator._computeLayersHash( layers );

		// Change layer at index 22 (beyond old cap of 20)
		const modifiedLayers = layers.map( ( l ) => ( { ...l } ) );
		modifiedLayers[ 22 ].x = 999;
		const hash2 = coordinator._computeLayersHash( modifiedLayers );

		expect( hash1 ).not.toBe( hash2 );
	} );

	it( 'should produce different hashes for 25 vs 30 layers', () => {
		const layers25 = [];
		for ( let i = 0; i < 25; i++ ) {
			layers25.push( { id: 'layer' + i, x: 0, y: 0, width: 10, height: 10 } );
		}
		const layers30 = [ ...layers25 ];
		for ( let i = 25; i < 30; i++ ) {
			layers30.push( { id: 'layer' + i, x: 0, y: 0, width: 10, height: 10 } );
		}
		const hash25 = coordinator._computeLayersHash( layers25 );
		const hash30 = coordinator._computeLayersHash( layers30 );
		expect( hash25 ).not.toBe( hash30 );
	} );
} );

// ===== BRANCH COVERAGE GAP TESTS =====

describe( 'invalidateRenderCache', () => {
	let coordinator;

	beforeEach( () => {
		coordinator = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: jest.fn() }
		} );
	} );

	afterEach( () => {
		if ( coordinator && !coordinator.isDestroyed ) {
			coordinator.destroy();
		}
	} );

	it( 'should clear lastLayersHash', () => {
		coordinator.lastLayersHash = 'some-hash-value';
		const result = coordinator.invalidateRenderCache();
		expect( coordinator.lastLayersHash ).toBeNull();
		expect( result ).toBe( coordinator ); // fluent API
	} );
} );

describe( 'hash skip optimization', () => {
	let mockRedraw;
	let coordinator;

	beforeEach( () => {
		mockRedraw = jest.fn();
		coordinator = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: mockRedraw },
			editor: { layers: [ { id: 'l1', x: 10, y: 20 } ] }
		} );
	} );

	afterEach( () => {
		if ( coordinator && !coordinator.isDestroyed ) {
			coordinator.destroy();
		}
	} );

	it( 'should skip redraw when layers hash is unchanged', () => {
		// First redraw is full (constructor sets fullRedrawRequired=true),
		// so hash block is skipped entirely and hash is never stored.
		coordinator.scheduleRedraw();
		flushAnimationFrames();
		expect( mockRedraw ).toHaveBeenCalledTimes( 1 );

		// Second redraw with region — hash block executes,
		// currentHash !== null (lastLayersHash), so it redraws and stores hash
		mockRedraw.mockClear();
		coordinator.scheduleRedraw( { region: { x: 0, y: 0, width: 10, height: 10 } } );
		flushAnimationFrames();
		expect( mockRedraw ).toHaveBeenCalledTimes( 1 );

		// Third redraw with region — hash matches stored hash → skip
		mockRedraw.mockClear();
		coordinator.scheduleRedraw( { region: { x: 0, y: 0, width: 10, height: 10 } } );
		flushAnimationFrames();
		expect( mockRedraw ).not.toHaveBeenCalled();
	} );

	it( 'should redraw when layers change between frames', () => {
		const layers = [ { id: 'l1', x: 10, y: 20 } ];
		coordinator.canvasManager.editor = { layers };

		coordinator.scheduleRedraw();
		flushAnimationFrames();
		expect( mockRedraw ).toHaveBeenCalledTimes( 1 );

		// Change a layer
		layers[ 0 ].x = 99;
		coordinator.invalidateRenderCache();

		mockRedraw.mockClear();
		coordinator.scheduleRedraw();
		flushAnimationFrames();
		expect( mockRedraw ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'forceRedraw', () => {
	let mockRedraw;
	let coordinator;

	beforeEach( () => {
		mockRedraw = jest.fn();
		coordinator = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: mockRedraw },
			editor: { layers: [ { id: 'l1', x: 10, y: 20 } ] }
		} );
	} );

	afterEach( () => {
		if ( coordinator && !coordinator.isDestroyed ) {
			coordinator.destroy();
		}
	} );

	it( 'should force redraw even when hash matches', () => {
		// First redraw
		coordinator.scheduleRedraw();
		flushAnimationFrames();
		expect( mockRedraw ).toHaveBeenCalledTimes( 1 );

		// Force next redraw
		mockRedraw.mockClear();
		coordinator.forceRedraw();
		flushAnimationFrames();
		expect( mockRedraw ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'should reset forceNextRedraw after use', () => {
		coordinator.forceRedraw();
		expect( coordinator.forceNextRedraw ).toBe( true );

		flushAnimationFrames();
		expect( coordinator.forceNextRedraw ).toBe( false );
	} );
} );

describe( '_cachedStringify', () => {
	let coordinator;

	beforeEach( () => {
		coordinator = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: jest.fn() }
		} );
	} );

	afterEach( () => {
		if ( coordinator && !coordinator.isDestroyed ) {
			coordinator.destroy();
		}
	} );

	it( 'should return empty string for null', () => {
		expect( coordinator._cachedStringify( null ) ).toBe( '' );
	} );

	it( 'should return empty string for undefined', () => {
		expect( coordinator._cachedStringify( undefined ) ).toBe( '' );
	} );

	it( 'should return empty string for non-objects', () => {
		expect( coordinator._cachedStringify( 'string' ) ).toBe( '' );
		expect( coordinator._cachedStringify( 42 ) ).toBe( '' );
		expect( coordinator._cachedStringify( true ) ).toBe( '' );
	} );

	it( 'should stringify objects', () => {
		const obj = { a: 1, b: 2 };
		expect( coordinator._cachedStringify( obj ) ).toBe( '{"a":1,"b":2}' );
	} );

	it( 'should cache results for same reference', () => {
		const obj = { x: 1 };
		const first = coordinator._cachedStringify( obj );
		const second = coordinator._cachedStringify( obj );
		expect( first ).toBe( second );
		// Verify cache is used (same reference should hit cache)
		expect( coordinator._jsonCache.has( obj ) ).toBe( true );
	} );

	it( 'should stringify arrays', () => {
		const arr = [ { x: 1, y: 2 }, { x: 3, y: 4 } ];
		expect( coordinator._cachedStringify( arr ) ).toBe( '[{"x":1,"y":2},{"x":3,"y":4}]' );
	} );
} );

describe( '_computeLayersHash - renderer state', () => {
	let coordinator;
	const testLayers = [ { id: 'l1', x: 10, y: 20 } ];

	beforeEach( () => {
		coordinator = new window.Layers.Canvas.RenderCoordinator( {
			renderer: {
				redraw: jest.fn(),
				zoom: 2,
				panX: 100,
				panY: 200,
				selectedLayerIds: [ 'l1', 'l2' ]
			}
		} );
	} );

	afterEach( () => {
		if ( coordinator && !coordinator.isDestroyed ) {
			coordinator.destroy();
		}
	} );

	it( 'should include renderer zoom/pan/selection in hash', () => {
		// Use non-empty layers so hash includes renderer state (empty returns early)
		const hash1 = coordinator._computeLayersHash( testLayers );
		coordinator.canvasManager.renderer.zoom = 3;
		const hash2 = coordinator._computeLayersHash( testLayers );
		expect( hash1 ).not.toBe( hash2 );
	} );

	it( 'should include selected layer IDs in hash', () => {
		const hash1 = coordinator._computeLayersHash( testLayers );
		coordinator.canvasManager.renderer.selectedLayerIds = [ 'l3' ];
		const hash2 = coordinator._computeLayersHash( testLayers );
		expect( hash1 ).not.toBe( hash2 );
	} );
} );

describe( '_recordFrameTime - buffer overflow', () => {
	let coordinator;

	beforeEach( () => {
		coordinator = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: jest.fn() }
		} );
		coordinator.enableMetrics = true;
	} );

	afterEach( () => {
		if ( coordinator && !coordinator.isDestroyed ) {
			coordinator.destroy();
		}
	} );

	it( 'should cap frameTimes at maxFrameTimesSample', () => {
		// Fill beyond max
		for ( let i = 0; i < 70; i++ ) {
			coordinator._recordFrameTime( 16 + i );
		}
		expect( coordinator.frameTimes.length ).toBeLessThanOrEqual( coordinator.maxFrameTimesSample );
		expect( coordinator.frameCount ).toBe( 70 );
	} );
} );

describe( '_recordRenderTime - slow render', () => {
	let coordinator;

	beforeEach( () => {
		coordinator = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: jest.fn() }
		} );
	} );

	afterEach( () => {
		if ( coordinator && !coordinator.isDestroyed ) {
			coordinator.destroy();
		}
	} );

	it( 'should log error for slow renders', () => {
		const logSpy = jest.spyOn( coordinator, '_logError' ).mockImplementation( () => {} );

		coordinator._recordRenderTime( 50 ); // 50ms > 16.67ms target

		expect( logSpy ).toHaveBeenCalledWith( 'Slow render detected:', expect.any( Error ) );
	} );

	it( 'should not log for fast renders', () => {
		const logSpy = jest.spyOn( coordinator, '_logError' ).mockImplementation( () => {} );

		coordinator._recordRenderTime( 5 ); // 5ms < 16.67ms target

		expect( logSpy ).not.toHaveBeenCalled();
	} );
} );

describe( '_renderFrame - destroyed guard', () => {
	let coordinator;

	beforeEach( () => {
		coordinator = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: jest.fn() }
		} );
	} );

	afterEach( () => {
		// Already destroyed in test
	} );

	it( 'should return early if destroyed during RAF', () => {
		const performSpy = jest.spyOn( coordinator, '_performRedraw' );

		coordinator.scheduleRedraw();
		coordinator.isDestroyed = true;
		flushAnimationFrames();

		expect( performSpy ).not.toHaveBeenCalled();
	} );
} );

describe( 'scheduleRedraw - fallback timeout', () => {
	it( 'should use setTimeout when requestAnimationFrame is unavailable', () => {
		const origRAF = window.requestAnimationFrame;
		window.requestAnimationFrame = undefined;

		const mockRedraw = jest.fn();
		const coord = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: mockRedraw },
			editor: { layers: [] }
		} );

		coord.scheduleRedraw();
		expect( coord.fallbackTimeoutId ).not.toBeNull();
		expect( coord.pendingRedraw ).toBe( true );

		window.requestAnimationFrame = origRAF;
		coord.destroy();
	} );
} );

describe( 'cancelPendingRedraw - fallback timeout', () => {
	it( 'should cancel fallback timeout', () => {
		const coord = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: jest.fn() }
		} );

		coord.fallbackTimeoutId = setTimeout( () => {}, 1000 );
		coord.pendingRedraw = true;

		coord.cancelPendingRedraw();
		expect( coord.fallbackTimeoutId ).toBeNull();
		expect( coord.pendingRedraw ).toBe( false );
	} );
} );

describe( 'markFullRedraw', () => {
	let coordinator;

	beforeEach( () => {
		coordinator = new window.Layers.Canvas.RenderCoordinator( {
			renderer: { redraw: jest.fn() },
			editor: { layers: [] }
		} );
	} );

	afterEach( () => {
		if ( coordinator && !coordinator.isDestroyed ) {
			coordinator.destroy();
		}
	} );

	it( 'should set fullRedrawRequired and schedule redraw', () => {
		coordinator.markFullRedraw();
		expect( coordinator.fullRedrawRequired ).toBe( true );
		expect( coordinator.pendingRedraw ).toBe( true );
	} );

	it( 'should bypass hash check when fullRedrawRequired is true', () => {
		const mockRedraw = coordinator.canvasManager.renderer.redraw;
		coordinator.canvasManager.editor = { layers: [ { id: 'l1', x: 5 } ] };

		// First redraw — full redraw (constructor default), skips hash block
		coordinator.scheduleRedraw();
		flushAnimationFrames();
		expect( mockRedraw ).toHaveBeenCalledTimes( 1 );

		// Region-based redraw — enters hash block, stores hash, redraws
		mockRedraw.mockClear();
		coordinator.scheduleRedraw( { region: { x: 0, y: 0, width: 10, height: 10 } } );
		flushAnimationFrames();
		expect( mockRedraw ).toHaveBeenCalledTimes( 1 );

		// Another region-based redraw — hash matches, SKIPS redraw
		mockRedraw.mockClear();
		coordinator.scheduleRedraw( { region: { x: 0, y: 0, width: 10, height: 10 } } );
		flushAnimationFrames();
		expect( mockRedraw ).not.toHaveBeenCalled();

		// markFullRedraw should bypass hash check and force the redraw
		mockRedraw.mockClear();
		coordinator.markFullRedraw();
		flushAnimationFrames();
		expect( mockRedraw ).toHaveBeenCalledTimes( 1 );
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
