'use strict';

const { context: storedContext } = require( './fixtures/workingCopyImportContext.js' );
const storedContexts = [];
async function context( ...args ) { const c = await storedContext( ...args ); storedContexts.push( c ); return c; }
const { creationContext, CreationClient } = require( './fixtures/creationImportContext.js' );
const { rebaseContext, observed } = require( './fixtures/creationRebaseContext.js' );
const { rebaseContext: draftRebaseContext } = require( './fixtures/creationDraftRebaseContext.js' );
const StoredClient = require( process.env.LAYERS_EXACT_STORED_CLIENT_SOURCE || '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportReadClient.js' );

const readOptions = () => ( { targetPageId: 7, targetBaseRevisionId: 12, targetSurfaceId: 'target',
	sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source' } );
const rebaseOptions = () => ( { pageId: 7, originRevisionId: 12, surfaceId: 'target', currentRevisionId: 20 } );
const nfd = 'Cafe\u0301 and π';
const asciiJson = value => JSON.stringify( value ).split( '' ).map( character => character.charCodeAt( 0 ) > 127 ?
	'\\u' + character.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) : character ).join( '' );
const invalidEnvelopes = [
	[ 'plain object', { safe: true } ],
	[ 'wrong version', { version: 2, data: '{"safe":true}' } ],
	[ 'non-ASCII data', { version: 1, data: '{"text":"é"}' } ],
	[ 'malformed JSON', { version: 1, data: '{' } ],
	[ 'duplicate escaped key', { version: 1, data: '{"key":1,"\\u006bey":2}' } ]
];

describe( 'exact-text Import transport', () => {
	afterEach( () => { storedContexts.splice( 0 ).forEach( c => { c.bridge.dispose(); c.history.destroy(); } ); } );
	test( 'stored GET and creation POST preserve NFD and complete unknown nested data', async () => {
		const stored = await context( 'image' );
		stored.bundle.snapshot.surfaces[ 0 ].layers[ 1 ].text = nfd;
		stored.bundle.snapshot.surfaces[ 0 ].layers[ 1 ].futureField = { nested: [ 'unknown', { exact: nfd } ] };
		const storedResult = await new StoredClient( stored.api ).read( readOptions() );
		expect( stored.api.get ).toHaveBeenCalledWith( expect.objectContaining( { action: 'layersworkingcopyimportread', exacttext: true } ) );
		expect( storedResult.sourceBundle.snapshot.surfaces[ 0 ].layers[ 1 ].text ).toBe( nfd );
		expect( storedResult.sourceBundle.snapshot.surfaces[ 0 ].layers[ 1 ].futureField ).toEqual( { nested: [ 'unknown', { exact: nfd } ] } );

		const creation = await creationContext( 'image', true ), client = new CreationClient( creation.api, creation.selection );
		creation.bundle.snapshot.surfaces[ 0 ].layers[ 1 ].text = nfd;
		creation.bundle.snapshot.surfaces[ 0 ].layers[ 1 ].futureField = { nested: [ 'unknown', { exact: nfd } ] };
		const created = await client.read( readOptions() );
		expect( creation.api.post ).toHaveBeenCalledWith( expect.objectContaining( { action: 'layersworkingcopyimportcreationread', exacttext: true } ) );
		expect( created.sourceBundle.snapshot.surfaces[ 0 ].layers[ 1 ].text ).toBe( nfd );
		expect( created.sourceBundle.snapshot.surfaces[ 0 ].layers[ 1 ].futureField ).toEqual( { nested: [ 'unknown', { exact: nfd } ] } );
		creation.dispose();
	} );

	test( 'creation rebase and draft rebase preserve complete unknown native members through POST', async () => {
		const current = await rebaseContext( 'image', true );
		current.rebase.creation.baseBundle.snapshot.metadata.note = nfd;
		current.rebase.creation.baseBundle.snapshot.metadata.future = { nested: [ { exact: nfd } ] };
		const client = new CreationClient( current.api, current.selection );
		const prepared = await client.prepareRebase( rebaseOptions() );
		expect( current.api.post ).toHaveBeenCalledWith( expect.objectContaining( {
			action: 'layersworkingcopyimportcreationrebase', exacttext: true, origintext: current.selection.expected
		} ) );
		expect( prepared.inspect().baseBundle.snapshot.metadata.note ).toBe( nfd );
		expect( prepared.inspect().baseBundle.snapshot.metadata.future ).toEqual( { nested: [ { exact: nfd } ] } );

		const draft = await draftRebaseContext( 'image', false );
		draft.rebase.creation.newSurface.futureField = { label: nfd, nested: [ { exact: nfd } ] };
		draft.added.futureField = { label: nfd, nested: [ { exact: nfd } ] };
		const draftClient = new CreationClient( draft.api, draft.currentSelection );
		const origin = { version: 1, origin: { ...draft.rebase.origin, owner: 'Target Page' },
			newSurface: draft.added, hasLayersSlot: false };
		draft.api.post.mockResolvedValueOnce( { layersworkingcopyimportcreationdraftrebase: { version: 1, data: asciiJson( draft.rebase ) } } );
		const certificate = await draftClient.prepareDraftRebase( { pageId: 7, currentRevisionId: 20, origin } );
		expect( draft.api.post ).toHaveBeenCalledWith( expect.objectContaining( {
			action: 'layersworkingcopyimportcreationdraftrebase', exacttext: true
		} ) );
		expect( certificate.inspect().creation.newSurface.futureField ).toEqual( { label: nfd, nested: [ { exact: nfd } ] } );
		prepared.preflight(); certificate.release(); current.dispose(); draft.dispose();
	} );



	test( 'stored duplicate escaped key on an otherwise valid payload refuses', async () => {
		const c = await context(), value = await new StoredClient( c.api ).read( readOptions() );
		value.sourceBundle.extra = { proof: 1 };
		const data = asciiJson( value ).replace( '"proof":1', '"proof":1,"\\u0070roof":1' );
		c.api.get.mockResolvedValueOnce( { layersworkingcopyimportread: { version: 1, data } } );
		await expect( new StoredClient( c.api ).read( readOptions() ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
	} );

	test( 'creation duplicate escaped key on an otherwise valid payload refuses', async () => {
		const c = await creationContext(), client = new CreationClient( c.api, c.selection );
		const value = c.response().layersworkingcopyimportcreationread;
		value.sourceBundle.extra = { proof: 1 };
		const data = asciiJson( value ).replace( '"proof":1', '"proof":1,"\\u0070roof":1' );
		c.api.post.mockResolvedValueOnce( { layersworkingcopyimportcreationread: { version: 1, data } } );
		await expect( client.read( readOptions() ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
		c.dispose();
	} );

	test.each( [ false, true ] )( 'wire envelope getters refuse without invocation (creation=%s)', async creation => {
		const c = creation ? await creationContext() : await context(), getter = jest.fn( () => '{}' );
		const envelope = { version: 1 }; Object.defineProperty( envelope, 'data', { get: getter, enumerable: true } );
		if ( creation ) { c.api.post.mockResolvedValueOnce( { layersworkingcopyimportcreationread: envelope } ); }
		else { c.api.get.mockResolvedValueOnce( { layersworkingcopyimportread: envelope } ); }
		const client = creation ? new CreationClient( c.api, c.selection ) : new StoredClient( c.api );
		await expect( client.read( readOptions() ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
		expect( getter ).not.toHaveBeenCalled(); if ( creation ) { c.dispose(); }
	} );

	test.each( invalidEnvelopes )( 'stored read refuses %s without plain-object fallback', async ( name, envelope ) => {
		const c = await context();
		c.api.get.mockResolvedValueOnce( { layersworkingcopyimportread: envelope } );
		await expect( new StoredClient( c.api ).read( readOptions() ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
	} );

	test.each( invalidEnvelopes )( 'creation read refuses %s without plain-object fallback', async ( name, envelope ) => {
		const c = await creationContext(), client = new CreationClient( c.api, c.selection );
		c.api.post.mockResolvedValueOnce( { layersworkingcopyimportcreationread: envelope } );
		await expect( client.read( readOptions() ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
		c.dispose();
	} );

	test.each( invalidEnvelopes )( 'creation rebase refuses %s without committing selection', async ( name, envelope ) => {
		const c = await rebaseContext();
		const client = new CreationClient( c.api, c.selection );
		c.api.post.mockResolvedValueOnce( { layersworkingcopyimportcreationrebase: envelope } );
		await expect( client.prepareRebase( rebaseOptions() ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
		expect( client.selection ).toStrictEqual( c.selection );
		expect( c.api.postWithToken ).not.toHaveBeenCalled(); c.dispose();
	} );

	test.each( invalidEnvelopes )( 'draft rebase refuses %s without publishing or mutating work', async ( name, envelope ) => {
		const c = await draftRebaseContext();
		const client = new CreationClient( c.api, c.currentSelection ), before = observed( c );
		const origin = { version: 1, origin: { ...c.rebase.origin, owner: 'Target Page' }, newSurface: c.added, hasLayersSlot: false };
		c.api.post.mockResolvedValueOnce( { layersworkingcopyimportcreationdraftrebase: envelope } );
		await expect( client.prepareDraftRebase( { pageId: 7, currentRevisionId: 20, origin } ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
		expect( observed( c ) ).toStrictEqual( before ); expect( c.api.postWithToken ).not.toHaveBeenCalled(); c.dispose();
	} );

	test( 'rebase participant replacement during an awaited POST refuses without applying or publishing', async () => {
		const c = await rebaseContext();
		const client = new CreationClient( c.api, c.selection ), before = observed( c );
		let release, started;
		const waiting = new Promise( resolve => { release = resolve; } ), entered = new Promise( resolve => { started = resolve; } );
		c.events.rebase = async () => { started(); await waiting; };
		const pending = client.prepareRebase( rebaseOptions() );
		await entered;
		client.selection = Object.freeze( { start: 999, expected: 'changed while awaiting' } );
		release();
		await expect( pending ).rejects.toMatchObject( { code: 'layers-working-copy-state-unavailable' } );
		expect( observed( c ) ).toStrictEqual( before ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		c.dispose();
	} );
} );
