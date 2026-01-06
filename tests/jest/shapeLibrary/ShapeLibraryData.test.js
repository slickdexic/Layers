/**
 * Tests for ShapeLibraryData
 */

const ShapeLibraryData = require( '../../../resources/ext.layers.editor/shapeLibrary/ShapeLibraryData.js' );

describe( 'ShapeLibraryData', () => {
	describe( 'getCategories()', () => {
		it( 'should return array of categories', () => {
			const categories = ShapeLibraryData.getCategories();
			expect( Array.isArray( categories ) ).toBe( true );
			expect( categories.length ).toBeGreaterThan( 0 );
		} );

		it( 'should have required properties on each category', () => {
			const categories = ShapeLibraryData.getCategories();
			categories.forEach( ( cat ) => {
				expect( cat ).toHaveProperty( 'id' );
				expect( cat ).toHaveProperty( 'name' );
				expect( cat ).toHaveProperty( 'icon' );
				expect( typeof cat.id ).toBe( 'string' );
				expect( typeof cat.name ).toBe( 'string' );
			} );
		} );

		it( 'should include expected categories', () => {
			const categories = ShapeLibraryData.getCategories();
			const categoryIds = categories.map( ( c ) => c.id );

			expect( categoryIds ).toContain( 'arrows' );
			expect( categoryIds ).toContain( 'flowchart' );
			expect( categoryIds ).toContain( 'callouts' );
			expect( categoryIds ).toContain( 'geometric' );
			expect( categoryIds ).toContain( 'symbols' );
			expect( categoryIds ).toContain( 'decorative' );
		} );
	} );

	describe( 'getAllShapes()', () => {
		it( 'should return array of shapes', () => {
			const shapes = ShapeLibraryData.getAllShapes();
			expect( Array.isArray( shapes ) ).toBe( true );
			expect( shapes.length ).toBeGreaterThan( 20 );
		} );

		it( 'should have required properties on each shape', () => {
			const shapes = ShapeLibraryData.getAllShapes();
			shapes.forEach( ( shape ) => {
				expect( shape ).toHaveProperty( 'id' );
				expect( shape ).toHaveProperty( 'name' );
				expect( shape ).toHaveProperty( 'category' );
				expect( shape ).toHaveProperty( 'tags' );
				expect( shape ).toHaveProperty( 'path' );
				expect( shape ).toHaveProperty( 'viewBox' );

				expect( typeof shape.id ).toBe( 'string' );
				expect( typeof shape.name ).toBe( 'string' );
				expect( typeof shape.category ).toBe( 'string' );
				expect( Array.isArray( shape.tags ) ).toBe( true );
				expect( typeof shape.path ).toBe( 'string' );
				expect( Array.isArray( shape.viewBox ) ).toBe( true );
				expect( shape.viewBox ).toHaveLength( 4 );
			} );
		} );

		it( 'should have unique IDs for all shapes', () => {
			const shapes = ShapeLibraryData.getAllShapes();
			const ids = shapes.map( ( s ) => s.id );
			const uniqueIds = new Set( ids );
			expect( uniqueIds.size ).toBe( ids.length );
		} );

		it( 'should have valid path data (starts with M)', () => {
			const shapes = ShapeLibraryData.getAllShapes();
			shapes.forEach( ( shape ) => {
				expect( shape.path.trim()[ 0 ] ).toBe( 'M' );
			} );
		} );
	} );

	describe( 'getShapesByCategory()', () => {
		it( 'should return shapes in the specified category', () => {
			const arrowShapes = ShapeLibraryData.getShapesByCategory( 'arrows' );
			expect( arrowShapes.length ).toBeGreaterThan( 0 );
			arrowShapes.forEach( ( shape ) => {
				expect( shape.category ).toBe( 'arrows' );
			} );
		} );

		it( 'should return empty array for non-existent category', () => {
			const shapes = ShapeLibraryData.getShapesByCategory( 'nonexistent' );
			expect( shapes ).toEqual( [] );
		} );

		it( 'should return correct shapes for each category', () => {
			const categories = ShapeLibraryData.getCategories();
			categories.forEach( ( cat ) => {
				const shapes = ShapeLibraryData.getShapesByCategory( cat.id );
				expect( shapes.length ).toBeGreaterThan( 0 );
			} );
		} );
	} );

	describe( 'getShapeById()', () => {
		it( 'should return shape with matching ID', () => {
			const shape = ShapeLibraryData.getShapeById( 'arrows/right' );
			expect( shape ).not.toBeNull();
			expect( shape.id ).toBe( 'arrows/right' );
		} );

		it( 'should return null for non-existent ID', () => {
			const shape = ShapeLibraryData.getShapeById( 'nonexistent/shape' );
			expect( shape ).toBeNull();
		} );

		it( 'should find shapes from all categories', () => {
			expect( ShapeLibraryData.getShapeById( 'flowchart/decision' ) ).not.toBeNull();
			expect( ShapeLibraryData.getShapeById( 'symbols/checkmark' ) ).not.toBeNull();
			expect( ShapeLibraryData.getShapeById( 'geometric/cross' ) ).not.toBeNull();
		} );
	} );

	describe( 'getArrowShapes()', () => {
		it( 'should return array of arrow shapes', () => {
			const arrows = ShapeLibraryData.getArrowShapes();
			expect( Array.isArray( arrows ) ).toBe( true );
			expect( arrows.length ).toBeGreaterThan( 0 );
		} );

		it( 'should include directional arrows', () => {
			const arrows = ShapeLibraryData.getArrowShapes();
			const ids = arrows.map( ( a ) => a.id );
			expect( ids ).toContain( 'arrows/right' );
			expect( ids ).toContain( 'arrows/left' );
			expect( ids ).toContain( 'arrows/up' );
			expect( ids ).toContain( 'arrows/down' );
		} );
	} );

	describe( 'getFlowchartShapes()', () => {
		it( 'should return array of flowchart shapes', () => {
			const flowcharts = ShapeLibraryData.getFlowchartShapes();
			expect( Array.isArray( flowcharts ) ).toBe( true );
			expect( flowcharts.length ).toBeGreaterThan( 0 );
		} );

		it( 'should include essential flowchart shapes', () => {
			const flowcharts = ShapeLibraryData.getFlowchartShapes();
			const ids = flowcharts.map( ( f ) => f.id );
			expect( ids ).toContain( 'flowchart/process' );
			expect( ids ).toContain( 'flowchart/decision' );
			expect( ids ).toContain( 'flowchart/terminator' );
		} );
	} );

	describe( 'getSymbolShapes()', () => {
		it( 'should return array of symbol shapes', () => {
			const symbols = ShapeLibraryData.getSymbolShapes();
			expect( Array.isArray( symbols ) ).toBe( true );
			expect( symbols.length ).toBeGreaterThan( 0 );
		} );

		it( 'should include common symbols', () => {
			const symbols = ShapeLibraryData.getSymbolShapes();
			const ids = symbols.map( ( s ) => s.id );
			expect( ids ).toContain( 'symbols/checkmark' );
			expect( ids ).toContain( 'symbols/xmark' );
			expect( ids ).toContain( 'symbols/warning' );
		} );
	} );

	describe( 'search()', () => {
		it( 'should find shapes by ID', () => {
			const results = ShapeLibraryData.search( 'arrow' );
			expect( results.length ).toBeGreaterThan( 0 );
			expect( results.some( ( r ) => r.id.includes( 'arrow' ) ) ).toBe( true );
		} );

		it( 'should find shapes by tag', () => {
			const results = ShapeLibraryData.search( 'diamond' );
			expect( results.length ).toBeGreaterThan( 0 );
			// Decision shape has 'diamond' tag
			expect( results.some( ( r ) => r.id === 'flowchart/decision' ) ).toBe( true );
		} );

		it( 'should find shapes by category', () => {
			const results = ShapeLibraryData.search( 'geometric' );
			expect( results.length ).toBeGreaterThan( 0 );
			expect( results.every( ( r ) => r.category === 'geometric' ) ).toBe( true );
		} );

		it( 'should be case-insensitive', () => {
			const resultsLower = ShapeLibraryData.search( 'arrow' );
			const resultsUpper = ShapeLibraryData.search( 'ARROW' );
			const resultsMixed = ShapeLibraryData.search( 'ArRoW' );

			expect( resultsLower.length ).toBe( resultsUpper.length );
			expect( resultsLower.length ).toBe( resultsMixed.length );
		} );

		it( 'should support multi-word search', () => {
			const results = ShapeLibraryData.search( 'flowchart decision' );
			expect( results.length ).toBeGreaterThan( 0 );
			expect( results[ 0 ].id ).toBe( 'flowchart/decision' );
		} );

		it( 'should return empty array for no matches', () => {
			const results = ShapeLibraryData.search( 'xyznonexistent123' );
			expect( results ).toEqual( [] );
		} );

		it( 'should return empty array for empty/null/undefined query', () => {
			expect( ShapeLibraryData.search( '' ) ).toEqual( [] );
			expect( ShapeLibraryData.search( null ) ).toEqual( [] );
			expect( ShapeLibraryData.search( undefined ) ).toEqual( [] );
			expect( ShapeLibraryData.search( '   ' ) ).toEqual( [] );
		} );
	} );

	describe( 'shape data integrity', () => {
		it( 'all shapes should have valid path syntax', () => {
			const shapes = ShapeLibraryData.getAllShapes();
			const validPathPattern = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-+eE]+$/;

			shapes.forEach( ( shape ) => {
				expect( validPathPattern.test( shape.path ) ).toBe( true );
			} );
		} );

		it( 'all shapes should have positive viewBox dimensions', () => {
			const shapes = ShapeLibraryData.getAllShapes();

			shapes.forEach( ( shape ) => {
				expect( shape.viewBox[ 2 ] ).toBeGreaterThan( 0 );
				expect( shape.viewBox[ 3 ] ).toBeGreaterThan( 0 );
			} );
		} );

		it( 'all i18n name keys should follow naming convention', () => {
			const shapes = ShapeLibraryData.getAllShapes();

			shapes.forEach( ( shape ) => {
				expect( shape.name ).toMatch( /^layers-shape-/ );
			} );
		} );

		it( 'all category name keys should follow naming convention', () => {
			const categories = ShapeLibraryData.getCategories();

			categories.forEach( ( cat ) => {
				expect( cat.name ).toMatch( /^layers-shape-category-/ );
			} );
		} );
	} );
} );
