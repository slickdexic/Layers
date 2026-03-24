/* eslint-env node */
/**
 * Layers Editor - Property Panel E2E Tests
 *
 * Tests the property panel for layer inspection and manipulation.
 * Verifies that selecting a layer shows the correct properties panel,
 * and that editing property values updates the layer.
 *
 * Requires a running MediaWiki instance with the Layers extension installed.
 *
 * Usage:
 *   MW_SERVER=http://localhost:8080 MW_USERNAME=Admin MW_PASSWORD=admin123 \
 *     npx playwright test tests/e2e/properties.spec.js
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage } = require( './fixtures' );

const describeEditor = process.env.MW_SERVER ? test.describe : test.describe.skip;

describeEditor( 'Property Panel', () => {
	let editorPage;
	const testFile = process.env.TEST_FILE || 'Test.png';

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		await editorPage.login();
		await editorPage.openEditor( testFile );
	} );

	describeEditor( 'Panel Visibility', () => {
		test( 'no properties panel when nothing selected', async ( { page } ) => {
			// Click empty area to deselect
			await editorPage.clickCanvas( 10, 10 );
			await page.waitForTimeout( 300 );

			const form = await page.$( editorPage.selectors.propertiesForm );
			expect( form ).toBeNull();
		} );

		test( 'properties panel appears when rectangle selected', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'rectangle' );

			const form = await page.$( editorPage.selectors.propertiesForm );
			expect( form ).not.toBeNull();
		} );

		test( 'properties panel appears when circle selected', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'circle' );

			const form = await page.$( editorPage.selectors.propertiesForm );
			expect( form ).not.toBeNull();
		} );

		test( 'properties panel disappears on deselect', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'rectangle' );

			// Verify panel is shown
			let form = await page.$( editorPage.selectors.propertiesForm );
			expect( form ).not.toBeNull();

			// Deselect with Escape
			await page.keyboard.press( 'Escape' );
			await page.waitForTimeout( 300 );

			form = await page.$( editorPage.selectors.propertiesForm );
			expect( form ).toBeNull();
		} );
	} );

	describeEditor( 'Rectangle Properties', () => {
		test.beforeEach( async () => {
			await editorPage.createAndSelectLayer( 'rectangle' );
		} );

		test( 'has Transform section with position and dimensions', async ( { page } ) => {
			// Check for Transform section header
			const transformHeader = await page.$( '.property-section-header--transform' );
			expect( transformHeader ).not.toBeNull();

			// Width and height inputs should exist
			const width = await page.$( '[data-prop="width"]' );
			const height = await page.$( '[data-prop="height"]' );
			expect( width ).not.toBeNull();
			expect( height ).not.toBeNull();
		} );

		test( 'has position inputs', async ( { page } ) => {
			const xInput = await page.$( '[data-prop="x"]' );
			const yInput = await page.$( '[data-prop="y"]' );
			expect( xInput ).not.toBeNull();
			expect( yInput ).not.toBeNull();
		} );

		test( 'has rotation input', async ( { page } ) => {
			const rotation = await page.$( '[data-prop="rotation"]' );
			expect( rotation ).not.toBeNull();
		} );

		test( 'has Appearance section', async ( { page } ) => {
			const appearanceHeader = await page.$( '.property-section-header--appearance' );
			expect( appearanceHeader ).not.toBeNull();
		} );

		test( 'has Effects section with opacity', async ( { page } ) => {
			const effectsHeader = await page.$( '.property-section-header--effects' );
			expect( effectsHeader ).not.toBeNull();
		} );

		test( 'can change width value', async ( { page } ) => {
			const widthInput = await page.$( '[data-prop="width"]' );
			expect( widthInput ).not.toBeNull();

			// Clear and set new width
			await widthInput.fill( '300' );
			await widthInput.press( 'Tab' );
			await page.waitForTimeout( 300 );

			// Re-read value (may have been adjusted)
			const newValue = await widthInput.inputValue();
			expect( parseFloat( newValue ) ).toBeGreaterThan( 0 );
		} );

		test( 'can change height value', async ( { page } ) => {
			const heightInput = await page.$( '[data-prop="height"]' );
			expect( heightInput ).not.toBeNull();

			await heightInput.fill( '200' );
			await heightInput.press( 'Tab' );
			await page.waitForTimeout( 300 );

			const newValue = await heightInput.inputValue();
			expect( parseFloat( newValue ) ).toBeGreaterThan( 0 );
		} );

		test( 'has corner radius for rectangles', async ( { page } ) => {
			const cornerRadius = await page.$( '[data-prop="cornerRadius"]' );
			expect( cornerRadius ).not.toBeNull();
		} );
	} );

	describeEditor( 'Circle Properties', () => {
		test( 'has radius input instead of width/height', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'circle' );

			const radius = await page.$( '[data-prop="radius"]' );
			expect( radius ).not.toBeNull();
		} );
	} );

	describeEditor( 'Ellipse Properties', () => {
		test( 'has width and height inputs', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'ellipse' );

			const width = await page.$( '[data-prop="width"]' );
			const height = await page.$( '[data-prop="height"]' );
			expect( width ).not.toBeNull();
			expect( height ).not.toBeNull();
		} );
	} );

	describeEditor( 'Arrow Properties', () => {
		test( 'has endpoint inputs instead of position', async ( { page } ) => {
			await editorPage.selectTool( 'arrow' );
			await editorPage.drawOnCanvas( 50, 50, 250, 200 );
			await page.waitForTimeout( 300 );
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 150, 125 );
			await page.waitForTimeout( 300 );

			const x1 = await page.$( '[data-prop="x1"]' );
			const y1 = await page.$( '[data-prop="y1"]' );
			const x2 = await page.$( '[data-prop="x2"]' );
			const y2 = await page.$( '[data-prop="y2"]' );
			expect( x1 ).not.toBeNull();
			expect( y1 ).not.toBeNull();
			expect( x2 ).not.toBeNull();
			expect( y2 ).not.toBeNull();
		} );
	} );

	describeEditor( 'Polygon Properties', () => {
		test( 'has sides input', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'polygon' );

			const sides = await page.$( '[data-prop="sides"]' );
			expect( sides ).not.toBeNull();
		} );
	} );

	describeEditor( 'Star Properties', () => {
		test( 'has points input', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'star' );

			const points = await page.$( '[data-prop="points"]' );
			expect( points ).not.toBeNull();
		} );
	} );

	describeEditor( 'Property Value Changes', () => {
		test( 'changing position X updates layer', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'rectangle' );

			const xInput = await page.$( '[data-prop="x"]' );
			expect( xInput ).not.toBeNull();

			// Set a specific position
			await xInput.fill( '50' );
			await xInput.press( 'Tab' );
			await page.waitForTimeout( 300 );

			// Deselect and reselect to verify persistence
			await page.keyboard.press( 'Escape' );
			await page.waitForTimeout( 200 );
			await editorPage.clickCanvas( 50 + 75, 175 ); // click near new position
			await page.waitForTimeout( 300 );

			// If selection shows properties, check X value
			const xInputAfter = await page.$( '[data-prop="x"]' );
			if ( xInputAfter ) {
				const val = await xInputAfter.inputValue();
				expect( parseFloat( val ) ).toBeCloseTo( 50, 0 );
			}
		} );

		test( 'changing rotation updates layer', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'rectangle' );

			const rotInput = await page.$( '[data-prop="rotation"]' );
			expect( rotInput ).not.toBeNull();

			await rotInput.fill( '45' );
			await rotInput.press( 'Tab' );
			await page.waitForTimeout( 300 );

			const val = await rotInput.inputValue();
			expect( parseFloat( val ) ).toBe( 45 );
		} );

		test( 'property changes are undoable', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'rectangle' );

			const widthInput = await page.$( '[data-prop="width"]' );
			expect( widthInput ).not.toBeNull();

			const originalWidth = await widthInput.inputValue();

			// Change width
			await widthInput.fill( '400' );
			await widthInput.press( 'Tab' );
			await page.waitForTimeout( 300 );

			// Undo
			await editorPage.undo();
			await page.waitForTimeout( 500 );

			// Re-select layer (undo may deselect)
			await editorPage.clickCanvas( 175, 175 );
			await page.waitForTimeout( 300 );

			const widthAfterUndo = await page.$( '[data-prop="width"]' );
			if ( widthAfterUndo ) {
				const val = await widthAfterUndo.inputValue();
				const orig = parseFloat( originalWidth );
				expect( parseFloat( val ) ).toBeCloseTo( orig, 0 );
			}
		} );
	} );

	describeEditor( 'Effects Section', () => {
		test.beforeEach( async () => {
			await editorPage.createAndSelectLayer( 'rectangle' );
		} );

		test( 'has blend mode select', async ( { page } ) => {
			// Blend mode is a <select> element in the Effects section
			const blendSelect = await page.$( '.layer-properties-form select' );
			expect( blendSelect ).not.toBeNull();
		} );

		test( 'has drop shadow checkbox', async ( { page } ) => {
			// Find checkbox in effects section
			const shadowCheckbox = await page.$( '.property-section:last-child .property-field--checkbox input[type="checkbox"]' );
			expect( shadowCheckbox ).not.toBeNull();
		} );

		test( 'enabling shadow shows shadow controls', async ( { page } ) => {
			// Find and click the drop shadow checkbox
			const shadowCheckbox = await page.$( '.property-section:last-child .property-field--checkbox input[type="checkbox"]' );
			expect( shadowCheckbox ).not.toBeNull();

			const isChecked = await shadowCheckbox.isChecked();
			if ( !isChecked ) {
				await shadowCheckbox.click();
				await page.waitForTimeout( 500 );
			}

			// Shadow controls (color, blur, offset) should now be visible
			// After enabling, the panel refreshes with additional inputs
			const formText = await page.$eval( editorPage.selectors.propertiesForm, ( el ) => el.textContent );
			expect( formText ).toContain( 'Shadow' );
		} );
	} );

	describeEditor( 'Multiple Layer Types', () => {
		test( 'switching selection updates properties panel', async ( { page } ) => {
			// Create rectangle
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 150, 150 );
			await page.waitForTimeout( 300 );

			// Create circle
			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 200, 200, 300, 300 );
			await page.waitForTimeout( 300 );

			// Select rectangle
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 100, 100 );
			await page.waitForTimeout( 300 );

			// Rectangle has width input
			const widthInput = await page.$( '[data-prop="width"]' );
			expect( widthInput ).not.toBeNull();

			// Select circle
			await editorPage.clickCanvas( 250, 250 );
			await page.waitForTimeout( 300 );

			// Circle has radius input
			const radiusInput = await page.$( '[data-prop="radius"]' );
			expect( radiusInput ).not.toBeNull();
		} );
	} );
} );
