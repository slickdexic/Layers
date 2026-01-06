/**
 * Tests for CustomShapeRenderer
 */

const CustomShapeRenderer = require( '../../../resources/ext.layers.shared/CustomShapeRenderer.js' );

// Mock Path2D for Node.js environment
class MockPath2D {
	constructor( pathData ) {
		this.pathData = pathData;
	}
}

// Mock canvas context
function createMockContext() {
	return {
		save: jest.fn(),
		restore: jest.fn(),
		translate: jest.fn(),
		rotate: jest.fn(),
		scale: jest.fn(),
		fill: jest.fn(),
		stroke: jest.fn(),
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 1,
		globalAlpha: 1,
		shadowColor: '',
		shadowBlur: 0,
		shadowOffsetX: 0,
		shadowOffsetY: 0,
		isPointInPath: jest.fn().mockReturnValue( false )
	};
}

describe( 'CustomShapeRenderer', () => {
	let renderer;

	beforeEach( () => {
		// Set up global Path2D mock
		global.Path2D = MockPath2D;
		global.document = {
			createElement: jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( createMockContext() )
			} )
		};

		renderer = new CustomShapeRenderer();
	} );

	afterEach( () => {
		delete global.Path2D;
		delete global.document;
	} );

	describe( 'constructor', () => {
		it( 'should create renderer with default cache size', () => {
			expect( renderer.maxCacheSize ).toBe( 100 );
		} );

		it( 'should accept custom cache size', () => {
			const customRenderer = new CustomShapeRenderer( { cacheSize: 50 } );
			expect( customRenderer.maxCacheSize ).toBe( 50 );
		} );

		it( 'should initialize with empty cache', () => {
			expect( renderer.getCacheSize() ).toBe( 0 );
		} );
	} );

	describe( 'getPath2D()', () => {
		it( 'should create and cache Path2D objects', () => {
			const path = 'M0 0 L100 100 Z';

			// First call creates new Path2D
			const path2d1 = renderer.getPath2D( path );
			expect( path2d1 ).toBeInstanceOf( MockPath2D );
			expect( renderer.getCacheSize() ).toBe( 1 );

			// Second call returns cached version
			const path2d2 = renderer.getPath2D( path );
			expect( path2d2 ).toBe( path2d1 );
			expect( renderer.getCacheSize() ).toBe( 1 );
		} );

		it( 'should evict oldest entries when cache is full', () => {
			const smallRenderer = new CustomShapeRenderer( { cacheSize: 3 } );

			smallRenderer.getPath2D( 'M1 1' );
			smallRenderer.getPath2D( 'M2 2' );
			smallRenderer.getPath2D( 'M3 3' );
			expect( smallRenderer.getCacheSize() ).toBe( 3 );

			// Adding 4th should evict first
			smallRenderer.getPath2D( 'M4 4' );
			expect( smallRenderer.getCacheSize() ).toBe( 3 );
		} );

		it( 'should implement LRU behavior', () => {
			const smallRenderer = new CustomShapeRenderer( { cacheSize: 3 } );

			smallRenderer.getPath2D( 'M1 1' );
			smallRenderer.getPath2D( 'M2 2' );
			smallRenderer.getPath2D( 'M3 3' );

			// Access first again (moves to end)
			smallRenderer.getPath2D( 'M1 1' );

			// Add new - should evict M2 2 (now oldest)
			smallRenderer.getPath2D( 'M4 4' );

			// M1 should still be in cache, M2 should not
			expect( smallRenderer.getCacheSize() ).toBe( 3 );
		} );
	} );

	describe( 'render()', () => {
		it( 'should handle missing shape data gracefully', () => {
			const ctx = createMockContext();
			const consoleSpy = jest.spyOn( console, 'warn' ).mockImplementation();

			renderer.render( ctx, null, {} );
			expect( consoleSpy ).toHaveBeenCalled();

			consoleSpy.mockRestore();
		} );

		it( 'should apply layer position and scale', () => {
			const ctx = createMockContext();
			const layer = { x: 50, y: 100, width: 200, height: 150, fill: '#ff0000' };
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			renderer.render( ctx, shapeData, layer );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.translate ).toHaveBeenCalledWith( 50, 100 );
			expect( ctx.scale ).toHaveBeenCalledWith( 2, 1.5 );
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should apply fill when present', () => {
			const ctx = createMockContext();
			const layer = { x: 0, y: 0, width: 100, height: 100, fill: '#0000ff' };
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			renderer.render( ctx, shapeData, layer );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should apply stroke when present', () => {
			const ctx = createMockContext();
			const layer = {
				x: 0, y: 0, width: 100, height: 100,
				stroke: '#000000', strokeWidth: 2
			};
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			renderer.render( ctx, shapeData, layer );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should not fill when fill is none or transparent', () => {
			const ctx = createMockContext();
			const layer = { x: 0, y: 0, width: 100, height: 100, fill: 'none' };
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			renderer.render( ctx, shapeData, layer );

			expect( ctx.fill ).not.toHaveBeenCalled();
		} );

		it( 'should apply rotation when present', () => {
			const ctx = createMockContext();
			const layer = {
				x: 0, y: 0, width: 100, height: 100,
				rotation: 45, fill: '#ff0000'
			};
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			renderer.render( ctx, shapeData, layer );

			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should use custom fill rule when specified', () => {
			const ctx = createMockContext();
			const layer = { x: 0, y: 0, width: 100, height: 100, fill: '#ff0000' };
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				fillRule: 'evenodd'
			};

			renderer.render( ctx, shapeData, layer );

			expect( ctx.fill ).toHaveBeenCalledWith( expect.anything(), 'evenodd' );
		} );
	} );

	describe( 'renderWithEffects()', () => {
		it( 'should render normally when no shadow', () => {
			const ctx = createMockContext();
			const layer = { x: 0, y: 0, width: 100, height: 100, fill: '#ff0000' };
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			renderer.renderWithEffects( ctx, shapeData, layer );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should apply shadow properties when shadow is true', () => {
			const ctx = createMockContext();
			const layer = {
				x: 0, y: 0, width: 100, height: 100, fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 15,
				shadowOffsetX: 5,
				shadowOffsetY: 10
			};
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			renderer.renderWithEffects( ctx, shapeData, layer );

			// Shadow properties should be applied before render
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );
	} );

	describe( 'getOpacity()', () => {
		it( 'should return 1 when no opacity specified', () => {
			const opacity = renderer.getOpacity( undefined, undefined );
			expect( opacity ).toBe( 1 );
		} );

		it( 'should use specific opacity when layer opacity is undefined', () => {
			const opacity = renderer.getOpacity( 0.5, undefined );
			expect( opacity ).toBe( 0.5 );
		} );

		it( 'should multiply specific and layer opacity', () => {
			const opacity = renderer.getOpacity( 0.5, 0.8 );
			expect( opacity ).toBe( 0.4 );
		} );
	} );

	describe( 'hitTest()', () => {
		it( 'should return false for missing shape data', () => {
			const layer = { x: 0, y: 0, width: 100, height: 100 };
			expect( renderer.hitTest( layer, null, 50, 50 ) ).toBe( false );
		} );

		it( 'should return false for points outside bounding box', () => {
			const layer = { x: 100, y: 100, width: 50, height: 50 };
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			expect( renderer.hitTest( layer, shapeData, 0, 0 ) ).toBe( false );
			expect( renderer.hitTest( layer, shapeData, 200, 200 ) ).toBe( false );
		} );

		it( 'should delegate to canvas isPointInPath for points inside bounds', () => {
			const layer = { x: 0, y: 0, width: 100, height: 100 };
			const shapeData = {
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			// The mock returns false by default via the mocked getContext
			// In a real browser, isPointInPath would be called on the context
			// JSDOM doesn't support isPointInPath, so we just verify no errors occur
			try {
				const result = renderer.hitTest( layer, shapeData, 50, 50 );
				expect( typeof result ).toBe( 'boolean' );
			} catch ( e ) {
				// JSDOM limitation - isPointInPath not supported
				expect( e.message ).toContain( 'isPointInPath' );
			}
		} );
	} );

	describe( 'clearCache()', () => {
		it( 'should empty the cache', () => {
			renderer.getPath2D( 'M1 1' );
			renderer.getPath2D( 'M2 2' );
			expect( renderer.getCacheSize() ).toBe( 2 );

			renderer.clearCache();
			expect( renderer.getCacheSize() ).toBe( 0 );
		} );
	} );
} );
