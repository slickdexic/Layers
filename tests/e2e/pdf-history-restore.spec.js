/* eslint-env node */
'use strict';
const fs = require( 'fs' );
const { expect } = require( '@playwright/test' );
const { test, getAcceptanceConfig } = require( './fixtures' );

test( 'historical Restore recovers the complete PDF after a page member was removed',
	async ( { loggedInPage: page, context }, testInfo ) => {
		test.setTimeout( 240000 );
		const config = getAcceptanceConfig(), owner = process.env.LAYERS_PDF_RESTORE_OWNER;
		test.skip( !config || !owner, 'Requires an explicitly provisioned isolated PDF restore fixture' );
		const base = new URL( config.base );
		expect( [ 'localhost', '127.0.0.1' ] ).toContain( base.hostname );
		expect( owner ).toMatch( /^Layers_pdf_restore_acceptance_/ );
		const api = async ( fields, post = false ) => {
			const data = { ...fields, format: 'json', formatversion: 2 };
			const response = post ? await context.request.post( base.origin + '/api.php', { form: data } ) :
				await context.request.get( base.origin + '/api.php', { params: data } );
			const result = await response.json(); expect( result.error ).toBeUndefined(); return result;
		};
		const latest = async () => ( await api( { action: 'query', titles: owner, prop: 'revisions',
			rvprop: 'ids|content|user', rvslots: 'main|layers', rvlimit: 1 } ) ).query.pages[ 0 ].revisions[ 0 ];
		const baseline = await latest(), main = baseline.slots.main.content;
		expect( main ).toContain( 'Dedicated PDF history restore acceptance fixture.' );
		const original = JSON.parse( baseline.slots.layers.content );
		const first = original.surfaces.find( s => s.kind === 'pdf' );
		expect( first.source.page ).toBe( 1 );
		expect( original.surfaces.filter( s => s.kind === 'pdf' ) ).toHaveLength( 1 );
		const token = ( await api( { action: 'query', meta: 'tokens' } ) ).query.tokens.csrftoken;
		let owned = baseline.revid;
		const errors = [];
		page.on( 'pageerror', error => errors.push( error.message ) );
		const publish = async ( doc, summary ) => {
			const result = await api( { action: 'layerspublish', owner, baserevid: owned,
				data: JSON.stringify( doc ), summary, token }, true );
			owned = result.layerspublish.revid; return owned;
		};
		const download = async name => {
			await page.goto( base.origin + '/index.php?title=' + encodeURIComponent( owner ) );
			const host = page.locator( '.layers-bound-file-view.layers-bound-controls' ).first();
			await host.scrollIntoViewIfNeeded(); await host.hover();
			await host.getByRole( 'button', { name: 'View full size', exact: true } ).click();
			const button = page.getByRole( 'button', { name: 'Download PDF', exact: true } );
			await expect( button ).toBeEnabled();
			const pending = page.waitForEvent( 'download' ); await button.click();
			const output = testInfo.outputPath( name ); await ( await pending ).saveAs( output );
			const bytes = fs.readFileSync( output ); expect( bytes.subarray( 0, 5 ).toString() ).toBe( '%PDF-' );
			await page.getByRole( 'button', { name: 'Close', exact: true } ).click(); return bytes;
		};
		try {
			const saved = structuredClone( original ), second = structuredClone( first );
			second.id = 'restore-pdf-second'; second.source.page = 2;
			second.canvas.width = 208; second.canvas.height = 416;
			second.layers = [ { id: 'restored-blue', type: 'rectangle', x: 20, y: 20,
				width: 120, height: 90, fill: '#0000ff' } ]; second.readingOrder = [ 'restored-blue' ];
			saved.surfaces.push( second );
			const historical = await publish( saved, 'PDF restore acceptance: saved two pages' );
			const reference = await download( 'historical-annotated.pdf' );
			const rolledBack = structuredClone( original );
			rolledBack.surfaces.find( s => s.kind === 'slide' ).layers[ 0 ].text = 'Keep later unrelated work';
			const reverted = await publish( rolledBack, 'PDF restore acceptance: remove second page layers' );
			await page.goto( base.origin + '/index.php?title=' + encodeURIComponent( owner ) + '&action=history' );
			const link = page.locator( `.layers-history-view-link[href*="revid=${ historical }&"]` )
				.filter( { hasText: first.label } );
			await expect( link ).toHaveCount( 1 ); const href = await link.getAttribute( 'href' ); await link.click();
			await expect( page.locator( '#layers-history-container canvas' ) ).toBeVisible();
			const restore = page.getByRole( 'button', { name: 'Restore this version', exact: true } );
			await expect( restore ).toBeVisible(); await restore.scrollIntoViewIfNeeded();
			await page.screenshot( { path: testInfo.outputPath( 'pdf-restore-offer.png' ) } );
			await restore.click();
			const current = await latest(); owned = current.revid;
			await page.waitForFunction( expected => window.mw?.config?.get( 'wgPageName' ) === expected, owner );
			expect( current.parentid ).toBe( reverted );
			expect( current.slots.main.content ).toBe( main );
			const actual = JSON.parse( current.slots.layers.content );
			const keyed = surfaces => Object.fromEntries( surfaces.map( surface => [ surface.id, surface ] ) );
			expect( keyed( actual.surfaces.filter( s => s.kind === 'pdf' ) ) )
				.toEqual( keyed( saved.surfaces.filter( s => s.kind === 'pdf' ) ) );
			expect( actual.surfaces.filter( s => s.kind !== 'pdf' ) )
				.toEqual( rolledBack.surfaces.filter( s => s.kind !== 'pdf' ) );
			const history = ( await api( { action: 'query', titles: owner, prop: 'revisions', rvprop: 'ids',
				rvstartid: owned, rvendid: reverted, rvlimit: 10 } ) ).query.pages[ 0 ].revisions;
			expect( history.map( r => r.revid ) ).toEqual( [ owned, reverted ] );
			const restoredPdf = await download( 'restored-annotated.pdf' );
			expect( restoredPdf.equals( reference ) ).toBe( true );
			await page.goto( new URL( href, base.origin ).href );
			await expect( restore ).toHaveCount( 0 );
			expect( ( await latest() ).revid ).toBe( owned );
			const anonymous = await context.browser().newContext(), reader = await anonymous.newPage();
			try {
				await reader.goto( new URL( href, base.origin ).href );
				await expect( reader.getByRole( 'button', { name: 'Restore this version', exact: true } ) ).toHaveCount( 0 );
			} finally { await anonymous.close(); }
			expect( errors ).toEqual( [] );
		} finally {
			const current = await latest(); expect( current.revid ).toBe( owned );
			await publish( original, 'PDF restore acceptance: restore exact baseline' );
			const restored = await latest();
			expect( restored.slots.main.content ).toBe( main );
			expect( JSON.parse( restored.slots.layers.content ) ).toEqual( original );
		}
	} );
