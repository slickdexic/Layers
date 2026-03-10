/**
 * Tests for ViewerIcons shared SVG icon factory
 */

const ViewerIcons = require( '../../resources/ext.layers.shared/ViewerIcons.js' );

describe( 'ViewerIcons', () => {
	describe( 'createPencilIcon', () => {
		test( 'should return an SVG element', () => {
			const icon = ViewerIcons.createPencilIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
		} );

		test( 'should default to 16px size', () => {
			const icon = ViewerIcons.createPencilIcon();
			expect( icon.getAttribute( 'width' ) ).toBe( '16' );
			expect( icon.getAttribute( 'height' ) ).toBe( '16' );
		} );

		test( 'should default to white stroke color', () => {
			const icon = ViewerIcons.createPencilIcon();
			const paths = icon.querySelectorAll( 'path' );
			expect( paths.length ).toBeGreaterThan( 0 );
			expect( paths[ 0 ].getAttribute( 'stroke' ) ).toBe( '#fff' );
		} );

		test( 'should accept custom size', () => {
			const icon = ViewerIcons.createPencilIcon( { size: 24 } );
			expect( icon.getAttribute( 'width' ) ).toBe( '24' );
			expect( icon.getAttribute( 'height' ) ).toBe( '24' );
		} );

		test( 'should accept custom color', () => {
			const icon = ViewerIcons.createPencilIcon( { color: '#333' } );
			const paths = icon.querySelectorAll( 'path' );
			expect( paths[ 0 ].getAttribute( 'stroke' ) ).toBe( '#333' );
		} );

		test( 'should set aria-hidden', () => {
			const icon = ViewerIcons.createPencilIcon();
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		} );

		test( 'should set viewBox', () => {
			const icon = ViewerIcons.createPencilIcon();
			expect( icon.getAttribute( 'viewBox' ) ).toBe( '0 0 24 24' );
		} );

		test( 'should contain two path elements', () => {
			const icon = ViewerIcons.createPencilIcon();
			const paths = icon.querySelectorAll( 'path' );
			expect( paths.length ).toBe( 2 );
		} );

		test( 'should work with empty options object', () => {
			const icon = ViewerIcons.createPencilIcon( {} );
			expect( icon.getAttribute( 'width' ) ).toBe( '16' );
		} );
	} );

	describe( 'createExpandIcon', () => {
		test( 'should return an SVG element', () => {
			const icon = ViewerIcons.createExpandIcon();
			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
		} );

		test( 'should default to 16px size', () => {
			const icon = ViewerIcons.createExpandIcon();
			expect( icon.getAttribute( 'width' ) ).toBe( '16' );
			expect( icon.getAttribute( 'height' ) ).toBe( '16' );
		} );

		test( 'should default to white stroke color', () => {
			const icon = ViewerIcons.createExpandIcon();
			const lines = icon.querySelectorAll( 'line' );
			expect( lines.length ).toBeGreaterThan( 0 );
			expect( lines[ 0 ].getAttribute( 'stroke' ) ).toBe( '#fff' );
		} );

		test( 'should accept custom size', () => {
			const icon = ViewerIcons.createExpandIcon( { size: 32 } );
			expect( icon.getAttribute( 'width' ) ).toBe( '32' );
			expect( icon.getAttribute( 'height' ) ).toBe( '32' );
		} );

		test( 'should accept custom color', () => {
			const icon = ViewerIcons.createExpandIcon( { color: '#000' } );
			const paths = icon.querySelectorAll( 'path' );
			expect( paths.length ).toBeGreaterThan( 0 );
			expect( paths[ 0 ].getAttribute( 'stroke' ) ).toBe( '#000' );
		} );

		test( 'should set aria-hidden', () => {
			const icon = ViewerIcons.createExpandIcon();
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		} );

		test( 'should contain two path elements and two line elements', () => {
			const icon = ViewerIcons.createExpandIcon();
			const paths = icon.querySelectorAll( 'path' );
			const lines = icon.querySelectorAll( 'line' );
			expect( paths.length ).toBe( 2 );
			expect( lines.length ).toBe( 2 );
		} );

		test( 'should set viewBox to 0 0 24 24', () => {
			const icon = ViewerIcons.createExpandIcon();
			expect( icon.getAttribute( 'viewBox' ) ).toBe( '0 0 24 24' );
		} );

		test( 'should have fill none on svg', () => {
			const icon = ViewerIcons.createExpandIcon();
			expect( icon.getAttribute( 'fill' ) ).toBe( 'none' );
		} );
	} );

	describe( 'module export', () => {
		test( 'should export createPencilIcon as a function', () => {
			expect( typeof ViewerIcons.createPencilIcon ).toBe( 'function' );
		} );

		test( 'should export createExpandIcon as a function', () => {
			expect( typeof ViewerIcons.createExpandIcon ).toBe( 'function' );
		} );

		test( 'each call should return a new independent SVG element', () => {
			const icon1 = ViewerIcons.createPencilIcon();
			const icon2 = ViewerIcons.createPencilIcon();
			expect( icon1 ).not.toBe( icon2 );
		} );
	} );
} );
