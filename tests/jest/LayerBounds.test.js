/**
 * Independent acceptance tests for shared layer bounds.
 */
'use strict';

const fs = require( 'fs' );
const vm = require( 'vm' );
const LayerBounds = require( '../../resources/ext.layers.shared/LayerBounds.js' );
const GeometryUtils = require( '../../resources/ext.layers.editor/GeometryUtils.js' );

describe( 'LayerBounds.getBounds', () => {
	it( 'returns null when there is no layer or type', () => {
		expect( LayerBounds.getBounds( null ) ).toBeNull();
		expect( LayerBounds.getBounds( {} ) ).toBeNull();
	} );

	it( 'returns null for group layers, which have no painted bounds', () => {
		expect( LayerBounds.getBounds( { type: 'group', x: 4, y: 8, width: 30, height: 20 } ) ).toBeNull();
	} );

	it( 'bounds a rectangle with negative dimensions by moving its origin', () => {
		// x=40-12=28; y=30-8=22; the dimensions are absolute values.
		expect( LayerBounds.getBounds( { type: 'rectangle', x: 40, y: 30, width: -12, height: -8 } ) ).toEqual( {
			x: 28, y: 22, width: 12, height: 8
		} );
	} );

	it( 'defaults a rectangle with missing geometry to a zero-sized origin box', () => {
		// Missing x, y, width and height each default to zero.
		expect( LayerBounds.getBounds( { type: 'rectangle' } ) ).toEqual( { x: 0, y: 0, width: 0, height: 0 } );
	} );

	it( 'bounds a textbox from its top-left and dimensions', () => {
		// The textbox occupies x=3..23 and y=7..16.
		expect( LayerBounds.getBounds( { type: 'textbox', x: 3, y: 7, width: 20, height: 9 } ) ).toEqual( {
			x: 3, y: 7, width: 20, height: 9
		} );
	} );

	it( 'bounds a callout like a rectangular layer', () => {
		// The callout occupies x=11..46 and y=13..38.
		expect( LayerBounds.getBounds( { type: 'callout', x: 11, y: 13, width: 35, height: 25 } ) ).toEqual( {
			x: 11, y: 13, width: 35, height: 25
		} );
	} );

	it( 'bounds an image layer like a rectangular layer', () => {
		// The image occupies x=5..45 and y=6..36.
		expect( LayerBounds.getBounds( { type: 'image', x: 5, y: 6, width: 40, height: 30 } ) ).toEqual( {
			x: 5, y: 6, width: 40, height: 30
		} );
	} );

	it( 'bounds a circle from its center and absolute radius', () => {
		// Center (20,30) plus/minus radius 6 gives [14,26] × [24,36].
		expect( LayerBounds.getBounds( { type: 'circle', x: 20, y: 30, radius: -6 } ) ).toEqual( {
			x: 14, y: 24, width: 12, height: 12
		} );
	} );

	it( 'uses zero defaults for a circle without coordinates or radius', () => {
		// A missing center and radius yield a zero-area box at the origin.
		expect( LayerBounds.getBounds( { type: 'circle' } ) ).toEqual( { x: 0, y: 0, width: 0, height: 0 } );
	} );

	it( 'bounds an ellipse using its independent radii', () => {
		// Center (20,30), radii (7,4): x=13, y=26, width=14, height=8.
		expect( LayerBounds.getBounds( { type: 'ellipse', x: 20, y: 30, radiusX: 7, radiusY: 4 } ) ).toEqual( {
			x: 13, y: 26, width: 14, height: 8
		} );
	} );

	it( 'uses a zero default when ellipse radii and center are absent', () => {
		// Both radii and the center default to zero.
		expect( LayerBounds.getBounds( { type: 'ellipse', radiusX: 0, radiusY: 0, radius: 0 } ) ).toEqual( {
			x: 0, y: 0, width: 0, height: 0
		} );
	} );

	it( 'bounds a line with negative direction and half stroke on each side', () => {
		// Endpoints span x=10..40 and y=20..60; a 4px stroke adds 2px per edge.
		expect( LayerBounds.getBounds( { type: 'line', x1: 40, y1: 60, x2: 10, y2: 20, strokeWidth: 4 } ) ).toEqual( {
			x: 8, y: 18, width: 34, height: 44
		} );
	} );

	it( 'honors an explicit stroke inclusion option', () => {
		// Endpoints span x=10..20 and y=15..25; 2px stroke adds 1px on each edge.
		expect( LayerBounds.getBounds( {
			type: 'arrow', x1: 10, y1: 15, x2: 20, y2: 25, strokeWidth: 2
		}, { includeStroke: true } ) ).toEqual( { x: 9, y: 14, width: 12, height: 12 } );
	} );

	it( 'keeps the editor adapter byte-for-byte compatible for unrotated lines', () => {
		// The legacy editor bounds endpoints only (10..40, 20..60), even with stroke metadata.
		expect( GeometryUtils.getLayerBoundsForType( {
			type: 'line', x1: 40, y1: 60, x2: 10, y2: 20, strokeWidth: 4
		} ) ).toEqual( { x: 10, y: 20, width: 30, height: 40 } );
	} );

	it( 'leaves rotation to the editor adapter caller to avoid applying it twice', () => {
		// CanvasManager rotates these raw 100×50 bounds itself around (60,45).
		expect( GeometryUtils.getLayerBoundsForType( {
			type: 'rectangle', x: 10, y: 20, width: 100, height: 50, rotation: 90
		} ) ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
	} );

	it( 'bounds an arrow and gives a zero-length axis a one-pixel minimum', () => {
		// A vertical arrow at x=9 has a 1px width and a 15px height.
		expect( LayerBounds.getBounds( { type: 'arrow', x1: 9, y1: 3, x2: 9, y2: 18 } ) ).toEqual( {
			x: 9, y: 3, width: 1, height: 15
		} );
	} );

	it( 'uses the origin fallback when a line has no endpoint or layer coordinates', () => {
		// All four endpoint coordinates default to zero; each axis receives the 1px minimum.
		expect( LayerBounds.getBounds( { type: 'line' } ) ).toEqual( { x: 0, y: 0, width: 1, height: 1 } );
	} );

	it( 'bounds a polygon with negative point coordinates', () => {
		// x runs -12..8 (20px); y runs -5..15 (20px).
		expect( LayerBounds.getBounds( {
			type: 'polygon', points: [ { x: -12, y: -5 }, { x: 8, y: 4 }, { x: -3, y: 15 } ]
		} ) ).toEqual( { x: -12, y: -5, width: 20, height: 20 } );
	} );

	it( 'bounds a star from explicit points', () => {
		// Point extrema are x=2..14 and y=1..11.
		expect( LayerBounds.getBounds( {
			type: 'star', points: [ { x: 2, y: 8 }, { x: 9, y: 1 }, { x: 14, y: 11 } ]
		} ) ).toEqual( { x: 2, y: 1, width: 12, height: 10 } );
	} );

	it( 'bounds a path with negative point coordinates', () => {
		// Point extrema are x=-9..6 and y=-12..3.
		expect( LayerBounds.getBounds( {
			type: 'path', points: [ { x: -9, y: 0 }, { x: 6, y: -12 }, { x: 2, y: 3 } ]
		} ) ).toEqual( { x: -9, y: -12, width: 15, height: 15 } );
	} );

	it( 'bounds a marker with its arrow endpoint', () => {
		// Marker circle spans 18..42 in both axes; endpoint (5,50) expands the box.
		expect( LayerBounds.getBounds( {
			type: 'marker', x: 30, y: 30, size: 24, hasArrow: true, arrowX: 5, arrowY: 50
		} ) ).toEqual( { x: 5, y: 18, width: 37, height: 32 } );
	} );

	it( 'bounds a dimension line with a one-pixel height', () => {
		// Horizontal endpoints span 7..27; minimum height is 1 pixel.
		expect( LayerBounds.getBounds( { type: 'dimension', x1: 7, y1: 12, x2: 27, y2: 12 } ) ).toEqual( {
			x: 7, y: 12, width: 20, height: 1
		} );
	} );

	it( 'bounds all three points of an angle dimension', () => {
		// x extrema 10..60 and y extrema 5..50.
		expect( LayerBounds.getBounds( {
			type: 'angleDimension', cx: 30, cy: 40, ax: 10, ay: 50, bx: 60, by: 5
		} ) ).toEqual( { x: 10, y: 5, width: 50, height: 45 } );
	} );

	it( 'uses the origin and one-pixel minimum for an angle dimension without points', () => {
		// Vertex and arms default to (0,0), producing the minimum 1×1 extent.
		expect( LayerBounds.getBounds( { type: 'angleDimension' } ) ).toEqual( { x: 0, y: 0, width: 1, height: 1 } );
	} );

	it( 'uses explicit dimensions for a custom shape', () => {
		// Custom-shape box starts at (4,6) and measures 19 by 12.
		expect( LayerBounds.getBounds( { type: 'customShape', x: 4, y: 6, width: 19, height: 12 } ) ).toEqual( {
			x: 4, y: 6, width: 19, height: 12
		} );
	} );

	it( 'measures text layers with no explicit width', () => {
		// The test measurer reports 31×14 at the text layer's origin (8,9).
		const layer = { type: 'text', x: 8, y: 9, text: 'Measured label' };
		expect( LayerBounds.getBounds( layer, { measureText: () => ( { width: 31, height: 14 } ) } ) ).toEqual( {
			x: 8, y: 9, width: 31, height: 14
		} );
	} );

	it( 'uses explicit text dimensions without calling the measurer', () => {
		// Explicit text box x=2..17, y=5..12.
		const measureText = jest.fn();
		expect( LayerBounds.getBounds( { type: 'text', x: 2, y: 5, width: 15, height: 7 }, { measureText } ) ).toEqual( {
			x: 2, y: 5, width: 15, height: 7
		} );
		expect( measureText ).not.toHaveBeenCalled();
	} );

	it( 'returns null when text needs measurement but no valid measurer exists', () => {
		const layer = { type: 'text', x: 1, y: 2, text: 'Needs size' };
		expect( LayerBounds.getBounds( layer ) ).toBeNull();
		expect( LayerBounds.getBounds( layer, {} ) ).toBeNull();
		expect( LayerBounds.getBounds( layer, { measureText: () => null } ) ).toBeNull();
		expect( LayerBounds.getBounds( layer, { measureText: () => ( { height: 8 } ) } ) ).toBeNull();
		expect( LayerBounds.getBounds( layer, { measureText: () => ( { width: 10 } ) } ) ).toBeNull();
	} );

	it( 'keeps a zero-height explicit text box without measuring it', () => {
		// Explicit width means no measurement is needed; absent height uses zero.
		expect( LayerBounds.getBounds( { type: 'text', x: 3, y: 4, width: 12 } ) ).toEqual( {
			x: 3, y: 4, width: 12, height: 0
		} );
	} );

	it( 'preserves zero text coordinates and dimensions', () => {
		// Every explicit zero remains zero; falsy coordinates/dimensions do not drift.
		expect( LayerBounds.getBounds( { type: 'text', x: 0, y: 0, width: 0, height: 0 } ) ).toEqual( {
			x: 0, y: 0, width: 0, height: 0
		} );
	} );

	it( 'rotates a non-square rectangle by 90 degrees about its center', () => {
		// Center is (60,45); a 100×50 rectangle swaps to 50×100, starting at (35,-5).
		expect( LayerBounds.getBounds( { type: 'rectangle', x: 10, y: 20, width: 100, height: 50, rotation: 90 } ) ).toEqual( {
			x: 35, y: -5, width: 50, height: 100
		} );
	} );

	it( 'normalizes right-angle trigonometry without moving a half-turn box', () => {
		// A 180° turn about the box center leaves its axis-aligned box unchanged.
		expect( LayerBounds.getBounds( { type: 'rectangle', x: 10, y: 20, width: 8, height: 4, rotation: 180 } ) ).toEqual( {
			x: 10, y: 20, width: 8, height: 4
		} );
	} );

	it( 'bounds a negative quarter-turn with the same centered envelope', () => {
		// A -90° turn swaps the 100×50 sides about center (60,45).
		expect( LayerBounds.getBounds( { type: 'rectangle', x: 10, y: 20, width: 100, height: 50, rotation: -90 } ) ).toEqual( {
			x: 35, y: -5, width: 50, height: 100
		} );
	} );

	it( 'bounds a square rotated 45 degrees using its diagonal', () => {
		// A 20px square has a 20√2px envelope around center (20,30).
		const diagonal = 20 * Math.SQRT2;
		expect( LayerBounds.getBounds( { type: 'rectangle', x: 10, y: 20, width: 20, height: 20, rotation: 45 } ) ).toEqual( {
			x: 20 - diagonal / 2,
			y: 30 - diagonal / 2,
			width: diagonal,
			height: diagonal
		} );
	} );

	it( 'uses the star outer radius when point data is absent', () => {
		// Center (40,50) and outer radius 9 yields (31,41) with 18px sides.
		expect( LayerBounds.getBounds( { type: 'star', x: 40, y: 50, radius: 3, outerRadius: 9 } ) ).toEqual( {
			x: 31, y: 41, width: 18, height: 18
		} );
	} );

	it( 'uses the documented radius fallback for paths with too few points', () => {
		// Two points do not define this legacy bounds path; radius 5 gives 10×10.
		expect( LayerBounds.getBounds( {
			type: 'path', x: 20, y: 25, radius: 5, points: [ { x: 0, y: 0 }, { x: 2, y: 2 } ]
		} ) ).toEqual( { x: 15, y: 20, width: 10, height: 10 } );
	} );

	it( 'uses an origin-centered default box for a path without coordinates', () => {
		// Missing path center defaults to (0,0); the legacy radius default is 50.
		expect( LayerBounds.getBounds( { type: 'path' } ) ).toEqual( { x: -50, y: -50, width: 100, height: 100 } );
	} );

	it( 'returns null for malformed point data instead of producing invalid bounds', () => {
		expect( LayerBounds.getBounds( { type: 'polygon', points: [ { x: 1, y: 2 }, null, { x: 3, y: 4 } ] } ) ).toBeNull();
		expect( LayerBounds.getBounds( { type: 'path', points: [ { y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 } ] } ) ).toBeNull();
	} );

	it( 'falls back to a marker circle if an arrow endpoint is incomplete', () => {
		// Incomplete arrow metadata cannot add bounds; a size-10 marker is centered at (8,12).
		expect( LayerBounds.getBounds( { type: 'marker', x: 8, y: 12, size: 10, hasArrow: true, arrowX: 20 } ) ).toEqual( {
			x: 3, y: 7, width: 10, height: 10
		} );
	} );

	it( 'uses the marker defaults when its size and center are absent', () => {
		// Default marker size is 24, centered at origin: radius 12 on all sides.
		expect( LayerBounds.getBounds( { type: 'marker' } ) ).toEqual( { x: -12, y: -12, width: 24, height: 24 } );
	} );

	it( 'uses the existing default box for unknown shape types', () => {
		// Unknown geometry retains the legacy default 50×50 box at its origin.
		expect( LayerBounds.getBounds( { type: 'futureShape', x: 7, y: 13 } ) ).toEqual( {
			x: 7, y: 13, width: 50, height: 50
		} );
	} );

	it( 'preserves zero origins and uses legacy defaults for malformed dimensions', () => {
		// The old fallback turns non-numeric truthy dimensions into its 50px default.
		expect( LayerBounds.getBounds( { type: 'futureShape', x: 0, y: 0, width: 'wide', height: 'tall' } ) ).toEqual( {
			x: 0, y: 0, width: 50, height: 50
		} );
	} );

	it( 'exports to a browser namespace without relying on CommonJS', () => {
		const filename = require.resolve( '../../resources/ext.layers.shared/LayerBounds.js' );
		const source = fs.readFileSync( filename, 'utf8' );
		const browserWindow = {};
		vm.runInNewContext( source, { window: browserWindow } );
		// The fresh global namespace is created and the browser API can calculate a 4×3 box.
		expect( browserWindow.Layers.Utils.LayerBounds.getBounds( {
			type: 'rectangle', x: 2, y: 5, width: 4, height: 3
		} ) ).toEqual( { x: 2, y: 5, width: 4, height: 3 } );
	} );
} );
