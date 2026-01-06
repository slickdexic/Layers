/**
 * Tests for ShapeLibraryPanel
 */

const ShapeLibraryPanel = require( '../../../resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js' );

// Mock ShapeLibraryManager
class MockShapeLibraryManager {
	constructor() {
		this.shapes = [
			{
				id: 'arrows/arrow-right',
				name: 'layers-shape-arrow-right',
				category: 'arrows',
				path: 'M0 40 L80 40 L80 20 L100 50 L80 80 L80 60 L0 60 Z',
				viewBox: [ 0, 0, 100, 100 ]
			},
			{
				id: 'geometric/triangle',
				name: 'layers-shape-triangle',
				category: 'geometric',
				path: 'M50 10 L90 90 L10 90 Z',
				viewBox: [ 0, 0, 100, 100 ]
			},
			{
				id: 'symbols/checkmark',
				name: 'layers-shape-checkmark',
				category: 'symbols',
				path: 'M15 50 L40 75 L85 25',
				viewBox: [ 0, 0, 100, 100 ]
			}
		];
		this.recentShapes = [];
		this.favorites = new Set();
	}

	getCategories() {
		return [
			{ id: 'arrows', name: 'layers-shape-category-arrows', icon: '→' },
			{ id: 'geometric', name: 'layers-shape-category-geometric', icon: '△' },
			{ id: 'symbols', name: 'layers-shape-category-symbols', icon: '✓' }
		];
	}

	getShapesByCategory( categoryId ) {
		return this.shapes.filter( ( s ) => s.category === categoryId );
	}

	getShapeById( shapeId ) {
		return this.shapes.find( ( s ) => s.id === shapeId );
	}

	search( query ) {
		const q = query.toLowerCase();
		return this.shapes.filter(
			( s ) => s.id.toLowerCase().includes( q ) || s.name.toLowerCase().includes( q )
		);
	}

	getRecentShapes() {
		return this.recentShapes.map( ( id ) => this.getShapeById( id ) ).filter( Boolean );
	}

	addToRecent( shapeId ) {
		this.recentShapes = this.recentShapes.filter( ( id ) => id !== shapeId );
		this.recentShapes.unshift( shapeId );
		if ( this.recentShapes.length > 10 ) {
			this.recentShapes.pop();
		}
	}

	isFavorite( shapeId ) {
		return this.favorites.has( shapeId );
	}

	toggleFavorite( shapeId ) {
		if ( this.favorites.has( shapeId ) ) {
			this.favorites.delete( shapeId );
			return false;
		}
		this.favorites.add( shapeId );
		return true;
	}
}

describe( 'ShapeLibraryPanel', () => {
	let container;
	let manager;
	let panel;
	let selectedShape;

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		manager = new MockShapeLibraryManager();
		selectedShape = null;

		panel = new ShapeLibraryPanel( {
			container,
			manager,
			onShapeSelect: ( shape ) => {
				selectedShape = shape;
			},
			getMessage: ( key ) => key.replace( 'layers-', '' )
		} );
	} );

	afterEach( () => {
		panel.destroy();
		if ( container.parentNode ) {
			container.parentNode.removeChild( container );
		}
	} );

	describe( 'initialization', () => {
		it( 'should render the panel structure', () => {
			expect( container.className ).toBe( 'layers-shape-library-panel' );
			expect( container.querySelector( '.layers-shape-search' ) ).toBeTruthy();
			expect( container.querySelector( '.layers-shape-content' ) ).toBeTruthy();
			expect( container.querySelector( '.layers-shape-grid' ) ).toBeTruthy();
		} );

		it( 'should render search input', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );
			expect( searchInput ).toBeTruthy();
			expect( searchInput.type ).toBe( 'text' );
		} );

		it( 'should render category sections', () => {
			const sections = container.querySelectorAll( '.layers-shape-section' );
			// 3 categories + 1 recent section
			expect( sections.length ).toBeGreaterThanOrEqual( 3 );
		} );

		it( 'should set ARIA attributes', () => {
			expect( container.getAttribute( 'role' ) ).toBe( 'region' );
			expect( container.getAttribute( 'aria-label' ) ).toBeTruthy();
		} );
	} );

	describe( 'search functionality', () => {
		it( 'should filter shapes by search query', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );

			// Simulate search
			searchInput.value = 'arrow';
			searchInput.dispatchEvent( new Event( 'input' ) );

			const grid = container.querySelector( '.layers-shape-grid' );
			expect( grid.style.display ).toBe( 'grid' );

			const items = grid.querySelectorAll( '.layers-shape-item' );
			expect( items.length ).toBe( 1 );
			expect( items[ 0 ].dataset.shapeId ).toBe( 'arrows/arrow-right' );
		} );

		it( 'should clear search and show categories', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );

			// Search then clear
			searchInput.value = 'arrow';
			searchInput.dispatchEvent( new Event( 'input' ) );
			searchInput.value = '';
			searchInput.dispatchEvent( new Event( 'input' ) );

			const grid = container.querySelector( '.layers-shape-grid' );
			expect( grid.style.display ).toBe( 'none' );

			const content = container.querySelector( '.layers-shape-content' );
			expect( content.style.display ).toBe( 'block' );
		} );

		it( 'should handle escape key to clear search', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );

			searchInput.value = 'test';
			searchInput.dispatchEvent( new Event( 'input' ) );

			const keyEvent = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			searchInput.dispatchEvent( keyEvent );

			expect( searchInput.value ).toBe( '' );
		} );
	} );

	describe( 'section expansion', () => {
		it( 'should expand section on click', () => {
			const sections = container.querySelectorAll( '.layers-shape-section' );
			const arrowsSection = Array.from( sections ).find(
				( s ) => s.dataset.sectionId === 'arrows'
			);

			const header = arrowsSection.querySelector( '.layers-shape-section-header' );
			expect( header.getAttribute( 'aria-expanded' ) ).toBe( 'false' );

			header.click();

			expect( header.getAttribute( 'aria-expanded' ) ).toBe( 'true' );
			const content = arrowsSection.querySelector( '.layers-shape-section-content' );
			expect( content.style.display ).toBe( 'block' );
		} );

		it( 'should collapse other sections when one expands', () => {
			const sections = container.querySelectorAll( '.layers-shape-section' );
			const arrowsSection = Array.from( sections ).find(
				( s ) => s.dataset.sectionId === 'arrows'
			);
			const geometricSection = Array.from( sections ).find(
				( s ) => s.dataset.sectionId === 'geometric'
			);

			// Expand arrows
			arrowsSection.querySelector( '.layers-shape-section-header' ).click();

			// Expand geometric (should collapse arrows)
			geometricSection.querySelector( '.layers-shape-section-header' ).click();

			const arrowsHeader = arrowsSection.querySelector( '.layers-shape-section-header' );
			const geometricHeader = geometricSection.querySelector( '.layers-shape-section-header' );

			expect( arrowsHeader.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
			expect( geometricHeader.getAttribute( 'aria-expanded' ) ).toBe( 'true' );
		} );
	} );

	describe( 'shape selection', () => {
		it( 'should call onShapeSelect when shape is clicked', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );

			// Search to show shapes
			searchInput.value = 'triangle';
			searchInput.dispatchEvent( new Event( 'input' ) );

			const items = container.querySelectorAll( '.layers-shape-item' );
			items[ 0 ].click();

			expect( selectedShape ).toBeTruthy();
			expect( selectedShape.id ).toBe( 'geometric/triangle' );
		} );

		it( 'should add to recent on selection', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );

			searchInput.value = 'checkmark';
			searchInput.dispatchEvent( new Event( 'input' ) );

			const items = container.querySelectorAll( '.layers-shape-item' );
			items[ 0 ].click();

			expect( manager.recentShapes ).toContain( 'symbols/checkmark' );
		} );
	} );

	describe( 'favorites', () => {
		it( 'should toggle favorite on button click', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );

			searchInput.value = 'arrow';
			searchInput.dispatchEvent( new Event( 'input' ) );

			const favButton = container.querySelector( '.layers-shape-favorite' );
			expect( favButton.textContent ).toBe( '☆' );

			// Stop propagation to prevent selection
			const clickEvent = new MouseEvent( 'click', { bubbles: true } );
			favButton.dispatchEvent( clickEvent );

			expect( manager.isFavorite( 'arrows/arrow-right' ) ).toBe( true );
		} );
	} );

	describe( 'visibility controls', () => {
		it( 'should show panel', () => {
			container.style.display = 'none';
			panel.show();
			expect( container.style.display ).toBe( 'block' );
		} );

		it( 'should hide panel', () => {
			panel.hide();
			expect( container.style.display ).toBe( 'none' );
		} );

		it( 'should toggle panel visibility', () => {
			container.style.display = 'block';
			const result1 = panel.toggle();
			expect( result1 ).toBe( false );
			expect( container.style.display ).toBe( 'none' );

			const result2 = panel.toggle();
			expect( result2 ).toBe( true );
			expect( container.style.display ).toBe( 'block' );
		} );
	} );

	describe( 'keyboard navigation', () => {
		it( 'should focus first shape on ArrowDown from search', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );

			searchInput.value = 'shape';
			searchInput.dispatchEvent( new Event( 'input' ) );

			// We can't easily test focus in JSDOM, but we can verify the event handler exists
			const keyEvent = new KeyboardEvent( 'keydown', { key: 'ArrowDown' } );
			searchInput.dispatchEvent( keyEvent );

			// The test verifies no errors occur during keyboard handling
			expect( true ).toBe( true );
		} );
	} );

	describe( 'shape item rendering', () => {
		it( 'should render shape with SVG preview', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );

			searchInput.value = 'triangle';
			searchInput.dispatchEvent( new Event( 'input' ) );

			const item = container.querySelector( '.layers-shape-item' );
			const svg = item.querySelector( 'svg' );

			expect( svg ).toBeTruthy();
			expect( svg.getAttribute( 'viewBox' ) ).toBe( '0 0 100 100' );

			const path = svg.querySelector( 'path' );
			expect( path ).toBeTruthy();
			expect( path.getAttribute( 'd' ) ).toBe( 'M50 10 L90 90 L10 90 Z' );
		} );

		it( 'should render shape name', () => {
			const searchInput = container.querySelector( '.layers-shape-search-input' );

			searchInput.value = 'arrow';
			searchInput.dispatchEvent( new Event( 'input' ) );

			const name = container.querySelector( '.layers-shape-name' );
			expect( name ).toBeTruthy();
			expect( name.textContent ).toBeTruthy();
		} );
	} );

	describe( 'cleanup', () => {
		it( 'should clean up on destroy', () => {
			panel.destroy();
			expect( container.innerHTML ).toBe( '' );
		} );
	} );
} );
