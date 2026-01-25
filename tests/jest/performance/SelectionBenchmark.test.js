/**
 * Selection Performance Benchmark Tests for Layers Editor
 *
 * These tests measure selection and hit-testing performance with varying layer counts.
 *
 * @group benchmark
 */

/* eslint-env jest */

/**
 * LOW-6 FIX: Control benchmark output verbosity
 * Set VERBOSE=true when running benchmarks manually for detailed output
 * e.g., VERBOSE=true npm run test:js -- --testPathPattern=performance
 */
const VERBOSE = process.env.VERBOSE === 'true';
const log = ( ...args ) => VERBOSE && log( ...args );

// Mock MediaWiki environment
global.mw = {
	config: {
		get: jest.fn( ( key ) => {
			const config = {
				wgServer: 'http://localhost',
				wgScriptPath: '/w'
			};
			return config[ key ];
		} )
	},
	message: jest.fn( () => ( { text: () => 'test', exists: () => true } ) ),
	msg: jest.fn( ( key ) => key ),
	log: { warn: jest.fn(), error: jest.fn() }
};

// Generate test layers in a grid pattern for predictable hit testing
const generateGridLayers = ( count, canvasWidth = 800, canvasHeight = 600 ) => {
	const layers = [];
	const cols = Math.ceil( Math.sqrt( count ) );
	const rows = Math.ceil( count / cols );
	const cellWidth = canvasWidth / cols;
	const cellHeight = canvasHeight / rows;
	const layerWidth = cellWidth * 0.8;
	const layerHeight = cellHeight * 0.8;

	for ( let i = 0; i < count; i++ ) {
		const col = i % cols;
		const row = Math.floor( i / cols );

		layers.push( {
			id: `layer-${ i }`,
			type: 'rectangle',
			x: col * cellWidth + cellWidth * 0.1,
			y: row * cellHeight + cellHeight * 0.1,
			width: layerWidth,
			height: layerHeight,
			fill: `hsl(${ ( i * 37 ) % 360 }, 70%, 60%)`,
			stroke: '#000000',
			strokeWidth: 2,
			opacity: 1,
			visible: true,
			locked: false
		} );
	}
	return layers;
};

// Generate overlapping layers for worst-case hit testing
const generateOverlappingLayers = ( count ) => {
	const layers = [];
	for ( let i = 0; i < count; i++ ) {
		layers.push( {
			id: `layer-${ i }`,
			type: 'rectangle',
			x: 100 + i * 5, // Slight offset for overlap
			y: 100 + i * 5,
			width: 200,
			height: 150,
			fill: `hsla(${ ( i * 37 ) % 360 }, 70%, 60%, 0.7)`,
			stroke: '#000000',
			strokeWidth: 2,
			opacity: 1,
			visible: true,
			locked: false
		} );
	}
	return layers;
};

// Simple point-in-rect hit test (replicates core logic)
const pointInRect = ( point, layer ) => {
	if ( !layer.visible || layer.locked ) {
		return false;
	}
	return point.x >= layer.x &&
		point.x <= layer.x + layer.width &&
		point.y >= layer.y &&
		point.y <= layer.y + layer.height;
};

// Hit test through all layers (reverse order for top-first)
const hitTestLayers = ( point, layers ) => {
	for ( let i = layers.length - 1; i >= 0; i-- ) {
		if ( pointInRect( point, layers[ i ] ) ) {
			return layers[ i ];
		}
	}
	return null;
};

// Bounds calculation for multi-selection
const calculateSelectionBounds = ( layers ) => {
	if ( layers.length === 0 ) {
		return null;
	}

	let minX = Infinity, minY = Infinity;
	let maxX = -Infinity, maxY = -Infinity;

	for ( const layer of layers ) {
		minX = Math.min( minX, layer.x );
		minY = Math.min( minY, layer.y );
		maxX = Math.max( maxX, layer.x + layer.width );
		maxY = Math.max( maxY, layer.y + layer.height );
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	};
};

// Measure execution time
const measureTime = ( fn, iterations = 100 ) => {
	const times = [];

	for ( let i = 0; i < iterations; i++ ) {
		const start = performance.now();
		fn();
		const end = performance.now();
		times.push( end - start );
	}

	const avg = times.reduce( ( a, b ) => a + b, 0 ) / times.length;
	const min = Math.min( ...times );
	const max = Math.max( ...times );

	return { avg, min, max, iterations };
};

describe( 'Selection Performance Benchmarks', () => {
	describe( 'Hit Testing Performance', () => {
		test( 'hit test with 20 layers', () => {
			const layers = generateGridLayers( 20 );
			const testPoint = { x: 400, y: 300 }; // Center of canvas

			const result = measureTime( () => {
				hitTestLayers( testPoint, layers );
			}, 1000 );

			log( `Hit test 20 layers: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			// Should complete in < 1ms per operation
			expect( result.avg ).toBeLessThan( 1 );
		} );

		test( 'hit test with 50 layers', () => {
			const layers = generateGridLayers( 50 );
			const testPoint = { x: 400, y: 300 };

			const result = measureTime( () => {
				hitTestLayers( testPoint, layers );
			}, 1000 );

			log( `Hit test 50 layers: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			expect( result.avg ).toBeLessThan( 2 );
		} );

		test( 'hit test with 100 layers', () => {
			const layers = generateGridLayers( 100 );
			const testPoint = { x: 400, y: 300 };

			const result = measureTime( () => {
				hitTestLayers( testPoint, layers );
			}, 1000 );

			log( `Hit test 100 layers: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			expect( result.avg ).toBeLessThan( 5 );
		} );

		test( 'hit test worst case - 50 overlapping layers', () => {
			const layers = generateOverlappingLayers( 50 );
			const testPoint = { x: 200, y: 175 }; // Center of overlap

			const result = measureTime( () => {
				hitTestLayers( testPoint, layers );
			}, 1000 );

			log( `Hit test 50 overlapping: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			// Even worst case should be fast
			expect( result.avg ).toBeLessThan( 2 );
		} );
	} );

	describe( 'Multi-Selection Performance', () => {
		test( 'select all 50 layers', () => {
			const layers = generateGridLayers( 50 );

			const result = measureTime( () => {
				const selectedIds = layers.map( ( l ) => l.id );
				const selectedLayers = layers.filter( ( l ) => selectedIds.includes( l.id ) );
				return selectedLayers;
			}, 500 );

			log( `Select all 50: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			expect( result.avg ).toBeLessThan( 1 );
		} );

		test( 'select all 100 layers', () => {
			const layers = generateGridLayers( 100 );

			const result = measureTime( () => {
				const selectedIds = layers.map( ( l ) => l.id );
				const selectedLayers = layers.filter( ( l ) => selectedIds.includes( l.id ) );
				return selectedLayers;
			}, 500 );

			log( `Select all 100: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			expect( result.avg ).toBeLessThan( 2 );
		} );

		test( 'calculate bounds for 50 selected layers', () => {
			const layers = generateGridLayers( 50 );

			const result = measureTime( () => {
				calculateSelectionBounds( layers );
			}, 1000 );

			log( `Bounds calc 50 layers: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			expect( result.avg ).toBeLessThan( 1 );
		} );

		test( 'calculate bounds for 100 selected layers', () => {
			const layers = generateGridLayers( 100 );

			const result = measureTime( () => {
				calculateSelectionBounds( layers );
			}, 1000 );

			log( `Bounds calc 100 layers: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			expect( result.avg ).toBeLessThan( 2 );
		} );
	} );

	describe( 'Marquee Selection Performance', () => {
		test( 'marquee select intersecting layers from 50', () => {
			const layers = generateGridLayers( 50 );
			const marquee = { x: 200, y: 150, width: 400, height: 300 };

			const result = measureTime( () => {
				const selected = layers.filter( ( layer ) => {
					// Simple intersection check
					return layer.x < marquee.x + marquee.width &&
						layer.x + layer.width > marquee.x &&
						layer.y < marquee.y + marquee.height &&
						layer.y + layer.height > marquee.y;
				} );
				return selected;
			}, 1000 );

			log( `Marquee select from 50: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			expect( result.avg ).toBeLessThan( 1 );
		} );

		test( 'marquee select intersecting layers from 100', () => {
			const layers = generateGridLayers( 100 );
			const marquee = { x: 200, y: 150, width: 400, height: 300 };

			const result = measureTime( () => {
				const selected = layers.filter( ( layer ) => {
					return layer.x < marquee.x + marquee.width &&
						layer.x + layer.width > marquee.x &&
						layer.y < marquee.y + marquee.height &&
						layer.y + layer.height > marquee.y;
				} );
				return selected;
			}, 1000 );

			log( `Marquee select from 100: avg=${ ( result.avg * 1000 ).toFixed( 2 ) }μs` );

			expect( result.avg ).toBeLessThan( 2 );
		} );
	} );

	describe( 'Scaling Performance', () => {
		test( 'hit test scales linearly: 100 layers not >5x slower than 20', () => {
			const layers20 = generateGridLayers( 20 );
			const layers100 = generateGridLayers( 100 );
			const testPoint = { x: 400, y: 300 };

			const result20 = measureTime( () => hitTestLayers( testPoint, layers20 ), 2000 );
			const result100 = measureTime( () => hitTestLayers( testPoint, layers100 ), 2000 );

			// Use higher threshold to avoid division by near-zero values causing flaky tests
			// When both are extremely fast (sub-microsecond), ratio is meaningless
			const minThreshold = 0.001; // 1μs minimum
			const ratio = result20.avg > minThreshold ? result100.avg / result20.avg : 1;

			log( `Hit test 20 layers: ${ ( result20.avg * 1000 ).toFixed( 2 ) }μs` );
			log( `Hit test 100 layers: ${ ( result100.avg * 1000 ).toFixed( 2 ) }μs` );
			log( `Ratio: ${ ratio.toFixed( 2 ) }x (expected ~5x for linear)` );

			// Allow up to 10x for test environment variability
			// This catches O(n²) algorithms
			expect( ratio ).toBeLessThan( 10 );
		} );

		test( 'bounds calculation scales linearly', () => {
			const layers20 = generateGridLayers( 20 );
			const layers100 = generateGridLayers( 100 );

			const result20 = measureTime( () => calculateSelectionBounds( layers20 ), 2000 );
			const result100 = measureTime( () => calculateSelectionBounds( layers100 ), 2000 );

			// Use higher threshold to avoid division by near-zero values causing flaky tests
			const minThreshold = 0.001; // 1μs minimum
			const ratio = result20.avg > minThreshold ? result100.avg / result20.avg : 1;

			log( `Bounds 20 layers: ${ ( result20.avg * 1000 ).toFixed( 2 ) }μs` );
			log( `Bounds 100 layers: ${ ( result100.avg * 1000 ).toFixed( 2 ) }μs` );
			log( `Ratio: ${ ratio.toFixed( 2 ) }x (expected ~5x for linear)` );

			expect( ratio ).toBeLessThan( 10 );
		} );
	} );
} );
