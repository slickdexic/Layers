/**
 * @jest-environment jsdom
 */
'use strict';

// Mock localStorage
const localStorageMock = {
	store: {},
	getItem: jest.fn( ( key ) => localStorageMock.store[ key ] || null ),
	setItem: jest.fn( ( key, value ) => {
		localStorageMock.store[ key ] = value;
	} ),
	clear: jest.fn( () => {
		localStorageMock.store = {};
	} )
};
Object.defineProperty( window, 'localStorage', { value: localStorageMock } );

// Load the module
require( '../../resources/ext.layers.editor/ui/IconFactory.js' );

describe( 'IconFactory', () => {
	let IconFactory;

	beforeEach( () => {
		IconFactory = window.Layers.UI.IconFactory;
	} );

	describe( 'createSVGElement', () => {
		it( 'should create an SVG element with the given tag', () => {
			const svg = IconFactory.createSVGElement( 'svg' );
			expect( svg.tagName.toLowerCase() ).toBe( 'svg' );
			expect( svg.namespaceURI ).toBe( 'http://www.w3.org/2000/svg' );
		} );

		it( 'should set attributes when provided', () => {
			const circle = IconFactory.createSVGElement( 'circle', {
				cx: '10',
				cy: '20',
				r: '5'
			} );
			expect( circle.getAttribute( 'cx' ) ).toBe( '10' );
			expect( circle.getAttribute( 'cy' ) ).toBe( '20' );
			expect( circle.getAttribute( 'r' ) ).toBe( '5' );
		} );
	} );

	describe( 'setAttributes', () => {
		it( 'should set multiple attributes on an element', () => {
			const el = document.createElement( 'div' );
			IconFactory.setAttributes( el, {
				id: 'test-id',
				class: 'test-class',
				'data-value': '123'
			} );
			expect( el.getAttribute( 'id' ) ).toBe( 'test-id' );
			expect( el.getAttribute( 'class' ) ).toBe( 'test-class' );
			expect( el.getAttribute( 'data-value' ) ).toBe( '123' );
		} );
	} );

	describe( 'createEyeIcon', () => {
		it( 'should create a visible eye icon with pupil', () => {
			const icon = IconFactory.createEyeIcon( true );
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
			// Modern Feather-style: path for eye shape and circle for pupil
			const path = icon.querySelector( 'path' );
			const circle = icon.querySelector( 'circle' );
			expect( path ).not.toBeNull();
			expect( circle ).not.toBeNull();
			expect( path.getAttribute( 'stroke' ) ).toBe( '#555' );
		} );

		it( 'should create a hidden eye icon with slash', () => {
			const icon = IconFactory.createEyeIcon( false );
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			// Modern Feather-style: path for eye-off and line for slash
			const path = icon.querySelector( 'path' );
			const line = icon.querySelector( 'line' );
			expect( path ).not.toBeNull();
			expect( line ).not.toBeNull();
			expect( path.getAttribute( 'stroke' ) ).toBe( '#aaa' );
			expect( line.getAttribute( 'stroke' ) ).toBe( '#aaa' );
		} );
	} );

	describe( 'createLockIcon', () => {
		it( 'should create a locked icon with red color', () => {
			const icon = IconFactory.createLockIcon( true );
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'style' ) ).toContain( 'opacity' );
			const rect = icon.querySelector( 'rect' );
			expect( rect.getAttribute( 'stroke' ) ).toBe( '#d63031' );
			const path = icon.querySelector( 'path' );
			// Modern Feather-style: shackle path starts at M7 11V7
			expect( path.getAttribute( 'd' ) ).toContain( 'M7 11V7' );
		} );

		it( 'should create an unlocked icon with muted color', () => {
			const icon = IconFactory.createLockIcon( false );
			expect( icon.getAttribute( 'style' ) ).toContain( 'opacity' );
			const rect = icon.querySelector( 'rect' );
			expect( rect.getAttribute( 'stroke' ) ).toBe( '#888' );
			const path = icon.querySelector( 'path' );
			// Open shackle has different path
			expect( path.getAttribute( 'd' ) ).toContain( 'M7 11V7' );
		} );
	} );

	describe( 'createDeleteIcon', () => {
		it( 'should create a trash can icon', () => {
			const icon = IconFactory.createDeleteIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
			const path = icon.querySelector( 'path' );
			expect( path ).not.toBeNull();
			expect( path.getAttribute( 'd' ) ).toContain( 'M3 6h18' ); // top bar
			const lines = icon.querySelectorAll( 'line' );
			expect( lines.length ).toBe( 2 ); // two trash lines
		} );
	} );

	describe( 'createGrabIcon', () => {
		it( 'should create a 6-dot grab handle icon (2x3 grid)', () => {
			const icon = IconFactory.createGrabIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			const circles = icon.querySelectorAll( 'circle' );
			// Modern drag handle uses 6 dots in 2x3 grid pattern
			expect( circles.length ).toBe( 6 );
		} );
	} );

	describe( 'createPlusIcon', () => {
		it( 'should create a plus icon with default options', () => {
			const icon = IconFactory.createPlusIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'width' ) ).toBe( '20' );
			const lines = icon.querySelectorAll( 'line' );
			expect( lines.length ).toBe( 2 );
		} );

		it( 'should create a plus icon with custom size and color', () => {
			const icon = IconFactory.createPlusIcon( { size: 32, color: '#ff0000' } );
			expect( icon.getAttribute( 'width' ) ).toBe( '32' );
			const line = icon.querySelector( 'line' );
			expect( line.getAttribute( 'stroke' ) ).toBe( '#ff0000' );
		} );
	} );

	describe( 'createChevronIcon', () => {
		it( 'should create chevron icons for all directions', () => {
			const directions = [ 'up', 'down', 'left', 'right' ];
			directions.forEach( ( dir ) => {
				const icon = IconFactory.createChevronIcon( dir );
				expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
				const path = icon.querySelector( 'path' );
				expect( path ).not.toBeNull();
			} );
		} );

		it( 'should apply custom size and color', () => {
			const icon = IconFactory.createChevronIcon( 'down', { size: 24, color: '#0000ff' } );
			expect( icon.getAttribute( 'width' ) ).toBe( '24' );
			const path = icon.querySelector( 'path' );
			expect( path.getAttribute( 'stroke' ) ).toBe( '#0000ff' );
		} );
	} );

	describe( 'createCheckIcon', () => {
		it( 'should create a checkmark icon', () => {
			const icon = IconFactory.createCheckIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			const path = icon.querySelector( 'path' );
			expect( path ).not.toBeNull();
			expect( path.getAttribute( 'stroke' ) ).toBe( '#27ae60' );
		} );

		it( 'should apply custom options', () => {
			const icon = IconFactory.createCheckIcon( { size: 24, color: '#ff0000' } );
			expect( icon.getAttribute( 'width' ) ).toBe( '24' );
			const path = icon.querySelector( 'path' );
			expect( path.getAttribute( 'stroke' ) ).toBe( '#ff0000' );
		} );
	} );

	describe( 'createCloseIcon', () => {
		it( 'should create an X/close icon', () => {
			const icon = IconFactory.createCloseIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			const lines = icon.querySelectorAll( 'line' );
			expect( lines.length ).toBe( 2 );
		} );

		it( 'should apply custom options', () => {
			const icon = IconFactory.createCloseIcon( { size: 20, color: '#888' } );
			expect( icon.getAttribute( 'width' ) ).toBe( '20' );
			const line = icon.querySelector( 'line' );
			expect( line.getAttribute( 'stroke' ) ).toBe( '#888' );
		} );
	} );

	describe( 'createFolderIcon', () => {
		it( 'should create a folder icon', () => {
			const icon = IconFactory.createFolderIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
			const paths = icon.querySelectorAll( 'path' );
			expect( paths.length ).toBeGreaterThan( 0 );
		} );

		it( 'should create expanded folder by default', () => {
			const icon = IconFactory.createFolderIcon( true );
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			// Expanded folder has a flap path
			const paths = icon.querySelectorAll( 'path' );
			expect( paths.length ).toBe( 2 );
		} );

		it( 'should create collapsed folder when expanded=false', () => {
			const icon = IconFactory.createFolderIcon( false );
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			// Collapsed folder has just one path
			const paths = icon.querySelectorAll( 'path' );
			expect( paths.length ).toBe( 1 );
		} );

		it( 'should apply custom options', () => {
			const icon = IconFactory.createFolderIcon( true, { size: 24, color: '#333' } );
			expect( icon.getAttribute( 'width' ) ).toBe( '24' );
			const path = icon.querySelector( 'path' );
			expect( path.getAttribute( 'fill' ) ).toBe( '#333' );
		} );

		it( 'should use default golden color', () => {
			const icon = IconFactory.createFolderIcon( true );
			const path = icon.querySelector( 'path' );
			expect( path.getAttribute( 'fill' ) ).toBe( '#f39c12' );
		} );
	} );

	describe( 'createExpandIcon', () => {
		it( 'should create an expand icon', () => {
			const icon = IconFactory.createExpandIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
			const path = icon.querySelector( 'path' );
			expect( path ).not.toBeNull();
		} );

		it( 'should create down-pointing triangle when expanded', () => {
			const icon = IconFactory.createExpandIcon( true );
			const path = icon.querySelector( 'path' );
			// Expanded: points down (M2 4l4 5 4-5z)
			expect( path.getAttribute( 'd' ) ).toBe( 'M2 4l4 5 4-5z' );
		} );

		it( 'should create right-pointing triangle when collapsed', () => {
			const icon = IconFactory.createExpandIcon( false );
			const path = icon.querySelector( 'path' );
			// Collapsed: points right (M4 2l5 4-5 4z)
			expect( path.getAttribute( 'd' ) ).toBe( 'M4 2l5 4-5 4z' );
		} );

		it( 'should apply custom options', () => {
			const icon = IconFactory.createExpandIcon( true, { size: 16, color: '#999' } );
			expect( icon.getAttribute( 'width' ) ).toBe( '16' );
			const path = icon.querySelector( 'path' );
			expect( path.getAttribute( 'fill' ) ).toBe( '#999' );
		} );

		it( 'should use default size of 12', () => {
			const icon = IconFactory.createExpandIcon( true );
			expect( icon.getAttribute( 'width' ) ).toBe( '12' );
		} );
	} );

	describe( 'createAddFolderIcon', () => {
		it( 'should create a folder icon with plus badge', () => {
			const icon = IconFactory.createAddFolderIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
			// Should have folder path
			const path = icon.querySelector( 'path' );
			expect( path ).not.toBeNull();
			// Should have badge circle
			const circle = icon.querySelector( 'circle' );
			expect( circle ).not.toBeNull();
			// Should have plus sign (2 lines)
			const lines = icon.querySelectorAll( 'line' );
			expect( lines.length ).toBe( 2 );
		} );

		it( 'should use default colors and size', () => {
			const icon = IconFactory.createAddFolderIcon();
			expect( icon.getAttribute( 'width' ) ).toBe( '20' );
			const path = icon.querySelector( 'path' );
			expect( path.getAttribute( 'fill' ) ).toBe( '#f39c12' ); // default folder color
			const circle = icon.querySelector( 'circle' );
			expect( circle.getAttribute( 'fill' ) ).toBe( '#4caf50' ); // default badge color
		} );

		it( 'should apply custom options', () => {
			const icon = IconFactory.createAddFolderIcon( {
				size: 32,
				folderColor: '#3498db',
				badgeColor: '#e74c3c'
			} );
			expect( icon.getAttribute( 'width' ) ).toBe( '32' );
			const path = icon.querySelector( 'path' );
			expect( path.getAttribute( 'fill' ) ).toBe( '#3498db' );
			const circle = icon.querySelector( 'circle' );
			expect( circle.getAttribute( 'fill' ) ).toBe( '#e74c3c' );
		} );

		it( 'should create plus sign with correct stroke properties', () => {
			const icon = IconFactory.createAddFolderIcon();
			const lines = icon.querySelectorAll( 'line' );
			lines.forEach( ( line ) => {
				expect( line.getAttribute( 'stroke' ) ).toBe( '#fff' );
				expect( line.getAttribute( 'stroke-width' ) ).toBe( '2' );
				expect( line.getAttribute( 'stroke-linecap' ) ).toBe( 'round' );
			} );
		} );

		it( 'should create badge circle with white border', () => {
			const icon = IconFactory.createAddFolderIcon();
			const circle = icon.querySelector( 'circle' );
			expect( circle.getAttribute( 'stroke' ) ).toBe( '#fff' );
			expect( circle.getAttribute( 'stroke-width' ) ).toBe( '1.5' );
		} );
	} );

	describe( 'createPencilIcon', () => {
		it( 'should create SVG element with default size', () => {
			const icon = IconFactory.createPencilIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'width' ) ).toBe( '18' );
			expect( icon.getAttribute( 'height' ) ).toBe( '18' );
		} );

		it( 'should create pencil icon with custom size', () => {
			const icon = IconFactory.createPencilIcon( { size: 24 } );
			expect( icon.getAttribute( 'width' ) ).toBe( '24' );
			expect( icon.getAttribute( 'height' ) ).toBe( '24' );
		} );

		it( 'should create pencil icon with custom color', () => {
			const icon = IconFactory.createPencilIcon( { color: '#ff0000' } );
			const paths = icon.querySelectorAll( 'path' );
			expect( paths.length ).toBe( 2 );
			paths.forEach( ( path ) => {
				expect( path.getAttribute( 'stroke' ) ).toBe( '#ff0000' );
			} );
		} );

		it( 'should have proper stroke properties on paths', () => {
			const icon = IconFactory.createPencilIcon();
			const paths = icon.querySelectorAll( 'path' );
			paths.forEach( ( path ) => {
				expect( path.getAttribute( 'stroke-width' ) ).toBe( '2' );
				expect( path.getAttribute( 'stroke-linecap' ) ).toBe( 'round' );
				expect( path.getAttribute( 'stroke-linejoin' ) ).toBe( 'round' );
			} );
		} );
	} );

	describe( 'createFullscreenIcon', () => {
		it( 'should create SVG element with default size', () => {
			const icon = IconFactory.createFullscreenIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'width' ) ).toBe( '18' );
			expect( icon.getAttribute( 'height' ) ).toBe( '18' );
		} );

		it( 'should create fullscreen icon with custom size', () => {
			const icon = IconFactory.createFullscreenIcon( { size: 32 } );
			expect( icon.getAttribute( 'width' ) ).toBe( '32' );
			expect( icon.getAttribute( 'height' ) ).toBe( '32' );
		} );

		it( 'should create fullscreen icon with custom color', () => {
			const icon = IconFactory.createFullscreenIcon( { color: '#00ff00' } );
			const paths = icon.querySelectorAll( 'path' );
			const lines = icon.querySelectorAll( 'line' );
			paths.forEach( ( path ) => {
				expect( path.getAttribute( 'stroke' ) ).toBe( '#00ff00' );
			} );
			lines.forEach( ( line ) => {
				expect( line.getAttribute( 'stroke' ) ).toBe( '#00ff00' );
			} );
		} );

		it( 'should have corner paths and diagonal lines', () => {
			const icon = IconFactory.createFullscreenIcon();
			const paths = icon.querySelectorAll( 'path' );
			const lines = icon.querySelectorAll( 'line' );
			expect( paths.length ).toBe( 2 ); // Top-right and bottom-left corners
			expect( lines.length ).toBe( 2 ); // Two diagonal lines
		} );

		it( 'should have proper stroke properties', () => {
			const icon = IconFactory.createFullscreenIcon();
			const lines = icon.querySelectorAll( 'line' );
			lines.forEach( ( line ) => {
				expect( line.getAttribute( 'stroke-width' ) ).toBe( '2' );
				expect( line.getAttribute( 'stroke-linecap' ) ).toBe( 'round' );
			} );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export IconFactory for Node.js', () => {
			const exported = require( '../../resources/ext.layers.editor/ui/IconFactory.js' );
			expect( typeof exported ).toBe( 'object' );
			expect( typeof exported.createEyeIcon ).toBe( 'function' );
		} );
	} );
} );
