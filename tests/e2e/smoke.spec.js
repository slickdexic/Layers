/* eslint-env node */
const { test, expect } = require( '@playwright/test' );

/**
 * Smoke tests for Layers extension
 * 
 * These tests verify basic functionality without requiring a full MediaWiki instance.
 * For comprehensive E2E tests, see editor.spec.js (requires MW_SERVER environment variable).
 */

test.describe( 'Smoke tests', () => {
	test( 'can run Playwright and make assertions', async ( { page } ) => {
		// Basic sanity check that Playwright is working
		await page.goto( 'about:blank' );
		const title = await page.title();
		expect( title ).toBe( '' );
	} );

	test( 'can execute JavaScript in browser context', async ( { page } ) => {
		await page.goto( 'about:blank' );
		
		const result = await page.evaluate( () => {
			return 2 + 2;
		} );
		
		expect( result ).toBe( 4 );
	} );

	test( 'can interact with DOM', async ( { page } ) => {
		await page.goto( 'about:blank' );
		
		// Create a simple element
		await page.evaluate( () => {
			const div = document.createElement( 'div' );
			div.id = 'test-element';
			div.textContent = 'Test Content';
			document.body.appendChild( div );
		} );
		
		const element = await page.$( '#test-element' );
		expect( element ).not.toBeNull();
		
		const text = await element.textContent();
		expect( text ).toBe( 'Test Content' );
	} );

	test( 'can handle async operations', async ( { page } ) => {
		await page.goto( 'about:blank' );
		
		const result = await page.evaluate( async () => {
			return new Promise( ( resolve ) => {
				setTimeout( () => resolve( 'async result' ), 100 );
			} );
		} );
		
		expect( result ).toBe( 'async result' );
	} );
} );

test.describe( 'Canvas API smoke tests', () => {
	test( 'browser supports HTML5 canvas', async ( { page } ) => {
		await page.goto( 'about:blank' );
		
		const hasCanvas = await page.evaluate( () => {
			const canvas = document.createElement( 'canvas' );
			return !!canvas.getContext;
		} );
		
		expect( hasCanvas ).toBe( true );
	} );

	test( 'can create and draw on canvas', async ( { page } ) => {
		await page.goto( 'about:blank' );
		
		const pixelData = await page.evaluate( () => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = 100;
			canvas.height = 100;
			document.body.appendChild( canvas );
			
			const ctx = canvas.getContext( '2d' );
			ctx.fillStyle = 'red';
			ctx.fillRect( 10, 10, 50, 50 );
			
			// Get pixel at (25, 25) - should be red
			const imageData = ctx.getImageData( 25, 25, 1, 1 );
			return Array.from( imageData.data );
		} );
		
		// Red pixel: [255, 0, 0, 255]
		expect( pixelData[ 0 ] ).toBe( 255 ); // R
		expect( pixelData[ 1 ] ).toBe( 0 );   // G
		expect( pixelData[ 2 ] ).toBe( 0 );   // B
		expect( pixelData[ 3 ] ).toBe( 255 ); // A
	} );
} );
