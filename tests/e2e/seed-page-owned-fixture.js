/* eslint-env node */
'use strict';

// This writes only to the fresh, disposable CI wiki, never to a maintained wiki.
const { request } = require( '@playwright/test' );
const assert = require( 'assert' );

( async () => {
	const base = process.env.MW_SERVER, user = process.env.MW_USERNAME, password = process.env.MW_PASSWORD;
	if ( process.env.CI !== 'true' || process.env.LAYERS_E2E_DISPOSABLE !== '1' ||
		base !== 'http://localhost:8080' || !user || !password ) {
		throw new Error( 'Disposable CI wiki and explicit test credentials required' );
	}
	const api = await request.newContext();
	const get = async params => ( await api.get( base + '/api.php', {
		params: { ...params, format: 'json', formatversion: 2 }
	} ) ).json();
	const post = async params => ( await api.post( base + '/api.php', {
		form: { ...params, format: 'json', formatversion: 2 }
	} ) ).json();
	try {
		const loginToken = ( await get( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
		const login = await post( { action: 'login', lgname: user, lgpassword: password, lgtoken: loginToken } );
		if ( login.login?.result !== 'Success' ) { throw new Error( 'CI login failed' ); }
		const info = await get( { action: 'query', meta: 'siteinfo', siprop: 'general' } );
		if ( info.query?.general?.sitename !== 'Layers Test Wiki' ) { throw new Error( 'Disposable CI wiki identity does not match' ); }
		if ( info.query?.general?.layerspagehistorymigrated !== true ) { throw new Error( 'Migration is not complete' ); }
		const csrf = ( await get( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;
		const owner = 'Layers_browser_acceptance';
		const created = await post( { action: 'edit', title: owner, createonly: 1,
			text: 'Dedicated automated Layers history acceptance page.\n\n{{#Slide:Welcome Slide}}',
			summary: 'Create disposable browser fixture', token: csrf } );
		if ( created.error || created.edit?.result !== 'Success' || !created.edit.newrevid ) {
			throw new Error( 'Could not create the disposable owner: ' + ( created.error?.code || 'unknown' ) );
		}
		const snapshot = { schemaVersion: 1, surfaces: [ { id: 'presentation', kind: 'slide', label: 'Welcome Slide',
			canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
			layers: [] } ] };
		const published = await post( { action: 'layerspublish', owner, baserevid: created.edit.newrevid,
			data: JSON.stringify( snapshot ), summary: 'Seed disposable layer set', token: csrf } );
		if ( published.error || published.layerspublish?.result !== 'Success' || !published.layerspublish.revid ) {
			throw new Error( 'Could not publish the disposable layer set: ' + ( published.error?.code || 'unknown' ) );
		}
		const read = await get( { action: 'layersread', owner, revid: published.layerspublish.revid } );
		assert.deepStrictEqual( read.layersread?.snapshot, snapshot, 'Disposable layer-set verification failed' );
		// Keep accessibility edits independent of the existing editor suite's fixture.
		const accessibilityOwner = 'Layers_accessibility_ci';
		const accessibilityCreated = await post( { action: 'edit', title: accessibilityOwner, createonly: 1,
			text: 'Dedicated automated accessibility fixture.\n\n{{#Slide:Keyboard checks}}',
			summary: 'Create disposable accessibility fixture', token: csrf } );
		if ( accessibilityCreated.error || accessibilityCreated.edit?.result !== 'Success' || !accessibilityCreated.edit.newrevid ) {
			throw new Error( 'Could not create the disposable accessibility owner' );
		}
		const accessibilitySnapshot = { schemaVersion: 1, surfaces: [ { id: 'pc-accessibility', kind: 'slide', label: 'Keyboard checks',
			canvas: { width: 400, height: 200, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
			layers: [ { id: 'ci-text', type: 'text', text: 'Keyboard layer name test', x: 20, y: 40, fontSize: 20, fill: '#000000' } ] } ] };
		const accessibilityPublished = await post( { action: 'layerspublish', owner: accessibilityOwner,
			baserevid: accessibilityCreated.edit.newrevid, data: JSON.stringify( accessibilitySnapshot ),
			summary: 'Seed disposable accessibility layer set', token: csrf } );
		if ( accessibilityPublished.error || accessibilityPublished.layerspublish?.result !== 'Success' || !accessibilityPublished.layerspublish.revid ) {
			throw new Error( 'Could not publish the disposable accessibility layer set' );
		}
		const accessibilityRead = await get( { action: 'layersread', owner: accessibilityOwner, revid: accessibilityPublished.layerspublish.revid } );
		assert.deepStrictEqual( accessibilityRead.layersread?.snapshot, accessibilitySnapshot, 'Accessibility fixture verification failed' );
		console.log( 'Disposable page-owned slide fixture created and verified.' );
	} finally { await api.dispose(); }
} )().catch( error => { console.error( error.message ); process.exitCode = 1; } );
