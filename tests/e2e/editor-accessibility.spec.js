/* eslint-env node */
'use strict';
const { expect } = require( '@playwright/test' );
const { test, getAcceptanceConfig } = require( './fixtures' );
const guardReads = require( '../perf/native-request-guard' );
const path = require( 'path' );
const fs = require( 'fs' );
const owner = process.env.LAYERS_ACCESSIBILITY_OWNER, surface = process.env.LAYERS_ACCESSIBILITY_SURFACE;
const skin = process.env.LAYERS_ACCESSIBILITY_SKIN || 'vector-2022';
const server = getAcceptanceConfig()?.base || process.env.MW_SERVER;
test.skip( !server || !owner || !surface, 'Requires an explicit synthetic accessibility fixture' );

async function audit( page, root, rules ) {
	return page.evaluate( async ( { selector, selectedRules } ) => {
		const result = await window.axe.run( document.querySelector( selector ), {
			runOnly: selectedRules ? { type: 'rule', values: selectedRules } :
				{ type: 'tag', values: [ 'wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa' ] }
		} );
		return result.violations.map( v => ( { id: v.id, impact: v.impact,
			nodes: v.nodes.map( n => ( { target: n.target, failure: n.failureSummary } ) ) } ) );
	}, { selector: root, selectedRules: rules } );
}

// Observe focus, but reach the control using the browser's normal Tab order.
async function tabTo( page, control ) {
	for ( let step = 0; step < 250; step++ ) {
		if ( await control.evaluate( node => document.activeElement === node ) ) {
			return;
		}
		await page.keyboard.press( 'Tab' );
	}
	await expect( control ).toBeFocused();
}

test( 'confirmed draft discard survives a failed destination and completes on a healthy reopen', async ( { loggedInPage: page, context }, testInfo ) => {
	test.setTimeout( 240000 );
	const base = new URL( server ).origin;
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( new URL( base ).hostname );
	expect( owner ).toMatch( /^Layers[_ ]/ );
	const editorUrl = base + '/index.php?' + new URLSearchParams( {
		title: 'Special:EditLayersPage', owner, surface, revid: 'current', useskin: skin
	} );
	const snapshot = async () => {
		const response = await context.request.get( base + '/api.php', { params: {
			action: 'query', titles: owner, prop: 'revisions', rvprop: 'ids|slotsha1', rvslots: '*', format: 'json', formatversion: 2
		} } );
		const data = await response.json();
		return data.query.pages[ 0 ].revisions[ 0 ];
	};
	const before = await snapshot();
	const errors = [];
	let failNextEditorNavigation = false;
	await page.route( '**/*', route => {
		const request = route.request(), url = new URL( request.url() );
		if ( url.origin !== base || request.method() !== 'GET' ) {
			errors.push( request.method() + ' ' + url.pathname );
			return route.abort();
		}
		if ( failNextEditorNavigation && request.isNavigationRequest() && url.searchParams.get( 'title' ) === 'Special:EditLayersPage' ) {
			failNextEditorNavigation = false;
			return route.fulfill( { status: 503, contentType: 'text/html', body: '<p>Test editor unavailable</p>' } );
		}
		return route.continue();
	} );
	const ready = page.getByRole( 'button', { name: 'Check saved page', exact: true } );
	await page.goto( editorUrl ); await ready.waitFor( { timeout: 90000 } );
	const visibility = page.locator( '.layer-item:not(.background-layer-item) .layer-visibility' ).first();
	const initial = await visibility.getAttribute( 'aria-pressed' );
	await tabTo( page, visibility ); await page.keyboard.press( 'Space' );
	await expect( visibility ).not.toHaveAttribute( 'aria-pressed', initial );
	const backups = () => page.evaluate( () => Object.fromEntries( Object.entries( localStorage )
		.filter( ( [ key ] ) => key.startsWith( 'layers-page-owned-draft-v1:' ) ) ) );
	await expect.poll( async () => Object.keys( await backups() ) ).toHaveLength( 1 );
	await page.reload();
	const decision = page.getByRole( 'button', { name: 'Discard draft and open saved version', exact: true } );
	const discard = page.getByRole( 'button', { name: 'Discard draft', exact: true } );
	const cancel = page.getByRole( 'button', { name: 'Cancel', exact: true } );
	await decision.waitFor( { timeout: 90000 } );
	const reviewed = await backups();
	expect( Object.keys( reviewed ) ).toHaveLength( 1 );
	await tabTo( page, decision ); await page.keyboard.press( 'Enter' );
	await expect( cancel ).toBeFocused();
	await page.keyboard.press( 'Delete' ); await page.keyboard.press( 'Control+s' ); await page.keyboard.press( 'Escape' );
	await expect( decision ).toBeVisible();
	await expect( cancel ).toBeFocused();
	await page.locator( 'dialog.layers-page-recovery' ).screenshot( { path: testInfo.outputPath( 'recovery.png' ) } );
	const confirm = async () => {
		await tabTo( page, decision ); await page.keyboard.press( 'Enter' );
		await expect( cancel ).toBeFocused();
		await page.keyboard.press( 'Shift+Tab' ); await expect( discard ).toBeFocused();
		await page.keyboard.press( 'Enter' );
	};
	failNextEditorNavigation = true;
	await confirm(); await expect( page.getByText( 'Test editor unavailable', { exact: true } ) ).toBeVisible( { timeout: 60000 } );
	expect( await backups() ).toEqual( reviewed );
	await page.goto( editorUrl ); await decision.waitFor( { timeout: 90000 } ); await confirm();
	await ready.waitFor( { timeout: 90000 } );
	await expect.poll( async () => ( await backups() )[ Object.keys( reviewed )[ 0 ] ] ).toBeUndefined();
	await expect( visibility ).toHaveAttribute( 'aria-pressed', initial );
	expect( await snapshot() ).toEqual( before ); expect( errors ).toEqual( [] );
} );

for ( const theme of [ 'light', 'dark' ] ) {
	test( `PC editor accessibility: ${ theme } keyboard, dialogs, layer controls and contrast`, async ( { loggedInPage: page, context }, testInfo ) => {
		test.setTimeout( 180000 );
		const base = new URL( server ).origin;
		expect( [ 'localhost', '127.0.0.1' ] ).toContain( new URL( base ).hostname );
		expect( owner ).toMatch( /^Layers[_ ]/ );
		expect( [ 'vector', 'vector-2022' ] ).toContain( skin );
		const errors = []; await guardReads( page, base, errors );
		page.on( 'pageerror', error => errors.push( { message: error.message } ) );
		const saved = async () => {
			const response = await context.request.get( base + '/api.php', { params: {
				action: 'query', titles: owner, prop: 'revisions', rvprop: 'ids|content', rvslots: '*', format: 'json', formatversion: 2
			} } );
			const data = await response.json(); expect( data.error ).toBeUndefined(); return data.query.pages[ 0 ].revisions[ 0 ];
		};
		const before = await saved();
		const editorUrl = base + '/index.php?' + new URLSearchParams( {
			title: 'Special:EditLayersPage', owner, surface, revid: 'current', useskin: skin
		} );
		await page.goto( editorUrl );
		await page.getByRole( 'button', { name: 'Check saved page', exact: true } ).waitFor( { timeout: 90000 } );
		await page.evaluate( selected => {
			document.documentElement.classList.remove( 'skin-theme-clientpref-os', 'skin-theme-clientpref-night', 'skin-theme-clientpref-day' );
			document.documentElement.classList.add( 'skin-theme-clientpref-' + ( selected === 'dark' ? 'night' : 'day' ) );
		}, theme );
		const original = await page.evaluate( () => JSON.stringify( window.layersEditorInstance.layers ) );
		const skip = page.locator( '.layers-skip-link' ).first(); await skip.focus();
		await page.keyboard.press( 'Shift+Tab' );
		expect( await page.evaluate( () => !!document.activeElement.closest( '.layers-editor' ) ) ).toBe( true );
		await page.keyboard.press( 'Tab' ); await expect( skip ).toBeFocused();
		for ( const key of [ 'Tab', 'Shift+Tab' ] ) {
			for ( let i = 0; i < 60; i++ ) {
				await page.keyboard.press( key );
				expect( await page.evaluate( () => !!document.activeElement.closest( '.layers-editor' ) ) ).toBe( true );
			}
		}
		const help = page.locator( '.help-button' ); await help.focus(); await page.keyboard.press( 'Enter' );
		await expect( page.locator( '.layers-help-dialog' ) ).toBeVisible();
		for ( let i = 0; i < 20; i++ ) {
			await page.keyboard.press( i < 10 ? 'Tab' : 'Shift+Tab' );
			expect( await page.evaluate( () => !!document.activeElement.closest( '.layers-help-dialog' ) ) ).toBe( true );
		}
		await page.keyboard.press( 'Escape' ); await expect( help ).toBeFocused();
		for ( const [ buttonClass, dialogClass ] of [
			[ '.shape-library-button', '.layers-shape-library-panel' ],
			[ '.emoji-picker-button', '.layers-emoji-picker' ]
		] ) {
			const opener = page.locator( buttonClass ), picker = page.locator( dialogClass );
			await tabTo( page, opener );
			await page.keyboard.press( 'Enter' );
			await expect( picker ).toBeVisible( { timeout: 30000 } );
			await expect( picker.locator( '.layers-shape-library-item, .layers-emoji-picker-item' ).first() )
				.toBeVisible( { timeout: 30000 } );
			for ( const key of [ 'Shift+Tab', 'Shift+Tab', 'Tab', 'Tab' ] ) {
				await page.keyboard.press( key );
				expect( await picker.evaluate( node => node.contains( document.activeElement ) ) ).toBe( true );
			}
			if ( theme === 'light' ) {
				await picker.screenshot( { path: testInfo.outputPath( dialogClass.slice( 1 ) + '.png' ) } );
			}
			await page.keyboard.press( 'Escape' );
			await expect( picker ).toBeHidden();
			await expect( opener ).toBeFocused();
		}
		const colour = page.locator( '.color-display-button.stroke-color' ); await colour.focus(); await page.keyboard.press( 'Enter' );
		await expect( page.locator( '.color-picker-dialog' ) ).toBeVisible();
		for ( let i = 0; i < 12; i++ ) {
			await page.keyboard.press( i < 6 ? 'Tab' : 'Shift+Tab' );
			expect( await page.evaluate( () => !!document.activeElement.closest( '.color-picker-dialog' ) ) ).toBe( true );
		}
		await page.keyboard.press( 'Escape' ); await expect( colour ).toBeFocused();
		await page.addScriptTag( { path: path.resolve( 'node_modules/axe-core/axe.min.js' ) } );
		const violations = await audit( page, '.layers-editor' );
		expect( violations.filter( v => [ 'critical', 'serious' ].includes( v.impact ) ) ).toEqual( [] );
		const counter = page.locator( '.toolbar-page-display' ), contrast = [];
		if ( await counter.count() ) {
			const classes = await counter.evaluate( node => node.parentElement.className );
			if ( theme === 'dark' ) {
				const style = await counter.getAttribute( 'style' );
				await counter.evaluate( node => { node.style.color = '#3366cc'; } );
				expect( ( await audit( page, '.toolbar-page-display', [ 'color-contrast' ] ) ).map( v => v.id ) ).toContain( 'color-contrast' );
				await counter.evaluate( ( node, value ) => {
					if ( value === null ) { node.removeAttribute( 'style' ); } else { node.setAttribute( 'style', value ); }
				}, style );
			}
			for ( const state of [ 'normal', 'annotated', 'unsaved' ] ) {
				await counter.evaluate( ( node, value ) => {
					node.parentElement.classList.toggle( 'page-has-layers', value !== 'normal' );
					node.parentElement.classList.toggle( 'page-is-dirty', value === 'unsaved' );
				}, state );
				const findings = await audit( page, '.toolbar-page-display', [ 'color-contrast' ] );
				expect( findings ).toEqual( [] ); contrast.push( { state, violations: findings,
					colour: await counter.evaluate( node => getComputedStyle( node ).color ) } );
			}
			await counter.evaluate( ( node, value ) => { node.parentElement.className = value; }, classes );
		}
		const row = page.locator( '.layer-item:not(.background-layer-item)' ).first();
		if ( await row.count() ) {
			await expect( row ).toHaveAttribute( 'role', 'listitem' );
			const grab = row.locator( '.layer-grab-area' ); await grab.focus(); await page.keyboard.press( 'Enter' );
			await expect( grab ).toHaveAttribute( 'aria-pressed', 'true' );
			const name = row.locator( '.layer-name' ), originalName = await name.textContent();
			await name.focus();
			await expect.poll( () => name.evaluate( node => parseFloat( getComputedStyle( node ).outlineWidth ) ) ).toBeGreaterThanOrEqual( 2 );
			await page.keyboard.press( 'Enter' ); await expect( name ).toHaveAttribute( 'contenteditable', 'true' );
			await expect( name ).toHaveAttribute( 'role', 'textbox' );
			await page.keyboard.type( 'Temporary layer name' ); await expect( name ).toHaveText( 'Temporary layer name' );
			await page.keyboard.press( 'Escape' ); await expect( name ).toHaveText( originalName );
			await expect( name ).toHaveAttribute( 'role', 'button' );
			const visibility = row.locator( '.layer-visibility' ), visible = await visibility.getAttribute( 'aria-pressed' );
			await visibility.focus(); await page.keyboard.press( 'Space' );
			await expect( visibility ).toHaveAttribute( 'aria-pressed', visible === 'true' ? 'false' : 'true' );
			await page.waitForFunction( () => window.layersEditorInstance.historyManager.canUndo() );
			await page.keyboard.press( 'Control+z' ); await expect( visibility ).toHaveAttribute( 'aria-pressed', visible );
			await page.keyboard.press( 'Control+y' );
			await expect( visibility ).toHaveAttribute( 'aria-pressed', visible === 'true' ? 'false' : 'true' );
			await page.keyboard.press( 'Control+z' ); await expect( visibility ).toHaveAttribute( 'aria-pressed', visible );
		}
		const canvasName = page.locator( '.canvas-name' );
		if ( await canvasName.count() ) {
			await canvasName.focus(); await page.keyboard.press( 'Enter' ); await expect( canvasName ).toHaveAttribute( 'aria-pressed', 'true' );
			await expect.poll( () => canvasName.evaluate( node => parseFloat( getComputedStyle( node ).outlineWidth ) ) ).toBeGreaterThanOrEqual( 2 );
		}
		expect( await page.evaluate( () => JSON.stringify( window.layersEditorInstance.layers ) ) ).toBe( original );
		expect( await saved() ).toEqual( before ); expect( errors ).toEqual( [] );
		await page.screenshot( { path: testInfo.outputPath( `editor-${ theme }.png` ) } );
		let closeReopen = false;
		if ( theme === 'light' && await canvasName.count() ) {
			// Exercise Cancel/Discard through the real unsaved-work dialog, without Save.
			await row.locator( '.layer-visibility' ).focus(); await page.keyboard.press( 'Space' );
			await page.waitForFunction( () => window.layersEditorInstance.historyManager.canUndo() );
			const edited = await page.evaluate( () => JSON.stringify( window.layersEditorInstance.layers ) );
			expect( edited ).not.toBe( original );
			const close = page.locator( '.layers-header-close' ); await close.focus(); await page.keyboard.press( 'Enter' );
			const dialog = page.getByRole( 'alertdialog', { name: 'Unsaved Changes', exact: true } ); await expect( dialog ).toBeVisible();
			await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).focus(); await page.keyboard.press( 'Enter' );
			await expect( close ).toBeFocused();
			expect( await page.evaluate( () => JSON.stringify( window.layersEditorInstance.layers ) ) ).toBe( edited );
			await page.keyboard.press( 'Enter' );
			await dialog.getByRole( 'button', { name: 'Discard', exact: true } ).focus(); await page.keyboard.press( 'Enter' );
			await page.waitForURL( url => url.searchParams.get( 'title' ) === owner || decodeURIComponent( url.pathname ).endsWith( '/' + owner ) );
			const wikiLink = page.locator( '.mw-jump-link' ).first(); await wikiLink.focus(); await expect( wikiLink ).toBeFocused();
			await page.goto( editorUrl ); await page.getByRole( 'button', { name: 'Check saved page', exact: true } ).waitFor( { timeout: 90000 } );
			expect( await page.evaluate( () => JSON.stringify( window.layersEditorInstance.layers ) ) ).toBe( original );
			expect( await saved() ).toEqual( before ); expect( errors ).toEqual( [] ); closeReopen = true;
		}
		const evidence = testInfo.outputPath( 'native-accessibility.json' );
		fs.writeFileSync( evidence, JSON.stringify( { owner, surface, revision: before.revid, skin, theme, violations, contrast,
			keyboardFocus: true, layerControlsAndHistory: true, closeReopen, savedContentUnchanged: true, errors }, null, 2 ) );
		await testInfo.attach( 'native-accessibility', { path: evidence, contentType: 'application/json' } );
	} );
}
