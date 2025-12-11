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
			// Should have ellipse and circle (pupil)
			const ellipse = icon.querySelector( 'ellipse' );
			const circle = icon.querySelector( 'circle' );
			expect( ellipse ).not.toBeNull();
			expect( circle ).not.toBeNull();
			expect( ellipse.getAttribute( 'stroke' ) ).toBe( '#666' );
		} );

		it( 'should create a hidden eye icon with slash', () => {
			const icon = IconFactory.createEyeIcon( false );
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			// Should have ellipse and line (slash)
			const ellipse = icon.querySelector( 'ellipse' );
			const line = icon.querySelector( 'line' );
			expect( ellipse ).not.toBeNull();
			expect( line ).not.toBeNull();
			expect( ellipse.getAttribute( 'stroke' ) ).toBe( '#aaa' );
			expect( line.getAttribute( 'stroke' ) ).toBe( '#c00' );
		} );
	} );

	describe( 'createLockIcon', () => {
		it( 'should create a locked icon with red color', () => {
			const icon = IconFactory.createLockIcon( true );
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'style' ) ).toContain( 'opacity: 1' );
			const rect = icon.querySelector( 'rect' );
			expect( rect.getAttribute( 'stroke' ) ).toBe( '#d63031' );
			const path = icon.querySelector( 'path' );
			expect( path.getAttribute( 'd' ) ).toContain( 'M9 10V8' ); // closed shackle
		} );

		it( 'should create an unlocked icon with green color', () => {
			const icon = IconFactory.createLockIcon( false );
			expect( icon.getAttribute( 'style' ) ).toContain( 'opacity: 0.4' );
			const rect = icon.querySelector( 'rect' );
			expect( rect.getAttribute( 'stroke' ) ).toBe( '#27ae60' );
			const path = icon.querySelector( 'path' );
			expect( path.getAttribute( 'd' ) ).toContain( 'M9 10V6' ); // open shackle
		} );
	} );

	describe( 'createDeleteIcon', () => {
		it( 'should create a trash can icon', () => {
			const icon = IconFactory.createDeleteIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'style' ) ).toContain( 'opacity' );
			const path = icon.querySelector( 'path' );
			expect( path ).not.toBeNull();
			expect( path.getAttribute( 'd' ) ).toContain( 'M3 6h18' ); // top bar
			const lines = icon.querySelectorAll( 'line' );
			expect( lines.length ).toBe( 2 ); // two trash lines
		} );
	} );

	describe( 'createGrabIcon', () => {
		it( 'should create a 4-dot grab handle icon', () => {
			const icon = IconFactory.createGrabIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			const circles = icon.querySelectorAll( 'circle' );
			expect( circles.length ).toBe( 4 );
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

	describe( 'module exports', () => {
		it( 'should export IconFactory for Node.js', () => {
			const exported = require( '../../resources/ext.layers.editor/ui/IconFactory.js' );
			expect( typeof exported ).toBe( 'object' );
			expect( typeof exported.createEyeIcon ).toBe( 'function' );
		} );
	} );
} );
