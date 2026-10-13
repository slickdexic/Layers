'use strict';
const { rebaseContext, clone, choose, tick, observed } = require( './fixtures/creationDraftRebaseContext.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
const Dialog = require( '../../resources/ext.layers.editor/PageOwnedRecoveryDialog.js' );
const en = require( '../../i18n/en.json' );
const msg = ( key, ...args ) => en[ key ] ? en[ key ].replace( /\$(\d+)/g, ( _, n ) => String( args[ n - 1 ] ) ) : key;

beforeEach( () => {
	mw.msg = msg;
	HTMLDialogElement.prototype.showModal = jest.fn( function () { this.open = true; } );
	HTMLDialogElement.prototype.close = jest.fn( function () { this.open = false; } );
} );

async function setup( kind = 'image', slot = true, options = {} ) {
	const c = await rebaseContext( kind, slot ); await choose( c );
	if ( options.redoOnly ) { c.history.undo(); }
	c.controller.persist(); await c.drafts.reconcile( async () => 20 );
	if ( !options.redoOnly ) { c.history.undo(); }
	c.bridge.capture(); c.drafts.dispose();
	const old = Array.from( c.records.entries() ).filter( ( [ , raw ] ) => JSON.parse( raw ).scope.baseRevisionId === 12 );
	for ( const [ key, raw ] of old ) {
		const envelope = JSON.parse( raw ); if ( options.phase ) { envelope.phase = options.phase; }
		if ( options.backup ) { options.backup( envelope ); }
		c.records.set( key, JSON.stringify( envelope ) );
	}
	if ( !options.current ) {
		for ( const [ key, raw ] of c.records ) { if ( JSON.parse( raw ).scope.baseRevisionId === 20 ) { c.records.delete( key ); } }
	}
	const post = c.api.post.getMockImplementation(), events = { proof: null, response: null, proofs: 0 };
	c.api.post.mockImplementation( async params => {
		if ( params.action !== 'layersworkingcopyimportcreationdraftrebase' ) { return post( params ); }
		events.proofs++; if ( events.proof ) { await events.proof(); }
		const response = { layersworkingcopyimportcreationdraftrebase: clone( c.rebase ) };
		return events.response ? events.response( response ) : response;
	} );
	const dialog = new Dialog( msg ), ui = { chooseDraft: rows => dialog.choose( rows ),
		chooseEarlierDraft: rows => dialog.chooseEarlierCreation( rows ), confirmRecovery: row => dialog.confirm( row ),
		notifyEarlierFailure: jest.fn(), notifyFailure: jest.fn(), notifyBlocked: jest.fn() };
	const lifecycle = new Lifecycle( c.bridge, c.controller, ui ); c.integration.enableEarlierCreationRecovery( lifecycle );
	const opener = document.createElement( 'button' ); document.body.appendChild( opener ); opener.focus();
	const dispose = () => { dialog.dispose(); lifecycle.dispose(); opener.remove(); c.dispose(); };
	return { ...c, old, events, nativeEvents: c.events, dialog, lifecycle, ui, opener, dispose };
}
const modal = () => document.querySelector( 'dialog.layers-page-recovery' );
async function review( c, index = 0 ) {
	const pending = c.lifecycle.initialize(); await tick();
	expect( modal() ).not.toBeNull();
	const select = modal().querySelector( 'select' ); select.value = String( index ); select.dispatchEvent( new Event( 'change' ) );
	modal().querySelector( 'button' ).click(); await tick(); return { pending };
}
const cancel = () => modal().querySelectorAll( 'button' )[ 1 ].click();

describe( 'approved visible earlier creation recovery', () => {
	test.each( [ [ 'image', true ], [ 'image', false ], [ 'slide', true ], [ 'slide', false ] ] )(
		'%s / slot %s reviews, explicitly restores Undo and saves to the current owning-page revision', async ( kind, slot ) => {
			const c = await setup( kind, slot );
			try {
				const before = observed( c ), { pending } = await review( c );
				expect( modal().querySelector( 'h2' ).textContent ).toBe( 'Recover local Layers edits' );
				expect( modal().querySelector( 'p' ).textContent ).toBe( en[ 'layers-page-draft-dialog-earlier' ] );
				expect( modal().querySelector( 'pre' ).textContent ).toContain( 'first' );
				expect( observed( c ) ).toStrictEqual( before ); expect( c.events.proofs ).toBe( 2 );
				expect( document.activeElement.textContent ).toBe( 'Keep drafts unchanged' );
				modal().querySelector( 'button' ).click(); await pending;
				expect( c.lifecycle.ready ).toBe( true ); expect( c.editor.layers ).toHaveLength( 3 );
				expect( c.history.undo() ).toBe( true ); expect( c.editor.layers ).toHaveLength( 0 );
				expect( c.history.redo() ).toBe( true ); expect( c.editor.layers ).toHaveLength( 3 );
				expect( c.events.proofs ).toBe( 3 ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
				expect( Array.from( c.records.entries() ) ).toStrictEqual( before.records ); expect( document.activeElement ).toBe( c.opener );
				await c.lifecycle.save( 'Explicit owning-page Save' ); expect( c.session.getStatus().revisionId ).toBe( 21 );
				const request = c.api.postWithToken.mock.calls[ 0 ][ 1 ], saved = JSON.parse( request.data );
				expect( request.baserevid ).toBe( 20 ); expect( request.targetsurface ).toBe( 'current' );
				expect( request.embedtext ).toBe( c.selection.expected ); expect( request.embedstart ).toBe( 23 );
				if ( slot ) { expect( saved.surfaces.find( s => s.id !== 'current' ) ).toStrictEqual( c.currentBase.surfaces[ 0 ] ); }
				expect( saved.surfaces.find( s => s.id === 'current' ).canvas ).toStrictEqual(
					kind === 'image' ? c.added.canvas : JSON.parse( before.records.find( row => row[ 0 ] === c.old[ 0 ][ 0 ] )[ 1 ] ).editorState.canvas );
				if ( kind === 'image' ) { expect( saved.surfaces.find( s => s.id === 'current' ).source ).toStrictEqual( c.added.source ); }
				for ( const [ key ] of c.old ) { expect( c.records.get( key ) ).toBe( before.records.find( row => row[ 0 ] === key )[ 1 ] ); }
			} finally { c.dispose(); }
		} );
	test.each( [ 'chooser', 'confirm', 'Escape', 'disposeDialog' ] )( '%s cancellation preserves all work and permits editing', async boundary => {
		const c = await setup();
		try {
			const before = observed( c ), pending = c.lifecycle.initialize(); await tick();
			expect( modal().querySelector( 'option' ).textContent ).toBe( 'Earlier draft 1' );
			if ( boundary !== 'chooser' ) { modal().querySelector( 'button' ).click(); await tick(); }
			if ( boundary === 'Escape' ) { modal().dispatchEvent( new Event( 'cancel', { cancelable: true } ) ); }
			else if ( boundary === 'disposeDialog' ) { c.dialog.dispose(); }
			else { cancel(); }
			await pending; expect( observed( c ) ).toStrictEqual( before ); expect( c.lifecycle.ready ).toBe( true );
			expect( c.session.getStatus().phase ).toBe( 'ready' ); expect( c.ui.notifyBlocked ).not.toHaveBeenCalled();
			expect( document.activeElement ).toBe( c.opener ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test.each( [ 'saving', 'conflict', 'uncertain' ] )( '%s recovery retains the publication hold and active lifecycle', async phase => {
		const c = await setup( 'slide', true, { phase } );
		try {
			const { pending } = await review( c ); modal().querySelector( 'button' ).click(); await pending;
			expect( c.lifecycle.ready ).toBe( true ); expect( c.editor.layers ).toHaveLength( 3 );
			expect( c.session.getStatus().phase ).toBe( 'conflict' ); expect( c.ui.notifyBlocked ).toHaveBeenCalledTimes( 1 );
			await expect( c.lifecycle.save() ).rejects.toThrow(); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test( 'Redo-only imported sources are checked before display and again after Restore', async () => {
		const c = await setup( 'slide', true, { redoOnly: true } );
		try {
			c.api.post.mockClear(); const { pending } = await review( c );
			expect( c.api.post.mock.calls.some( ( [ p ] ) => p.sourcesurface === 'source' ) ).toBe( true );
			c.api.post.mockClear(); modal().querySelector( 'button' ).click(); await pending;
			expect( c.api.post.mock.calls.some( ( [ p ] ) => p.sourcesurface === 'source' ) ).toBe( true );
			expect( c.history.redo() ).toBe( true ); expect( c.editor.layers ).toHaveLength( 3 );
		} finally { c.dispose(); }
	} );
	test.each( [ 'hiddenSource', 'pin', 'geometry', 'historicalOwner', 'backupIdentity' ] )( 'unprovable %s never reaches the chooser and its backup stays intact', async boundary => {
		const c = await setup( 'image', true, boundary === 'backupIdentity' ? { backup: e => { e.workingCopyDraft.identity.owner = 'Foreign'; } } : {} );
		try {
			if ( boundary === 'hiddenSource' ) { c.nativeEvents.source = async () => { throw new Error( 'Hidden' ); }; }
			c.events.response = response => {
				if ( boundary === 'pin' ) { response.layersworkingcopyimportcreationdraftrebase.creation.newSurface.source.sha1 = 'Changed'; }
				if ( boundary === 'geometry' ) { response.layersworkingcopyimportcreationdraftrebase.creation.newSurface.canvas.width++; }
				if ( boundary === 'historicalOwner' ) { response.layersworkingcopyimportcreationdraftrebase.origin.pageId++; }
				return response;
			};
			const before = observed( c ); await c.lifecycle.initialize();
			expect( modal() ).toBeNull(); expect( c.lifecycle.ready ).toBe( true ); expect( observed( c ) ).toStrictEqual( before );
			expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test.each( [ 'layers', 'Undo', 'configuration', 'backup', 'finalProof', 'closed' ] )( 'late %s refusal retains newer work and reports the approved failure', async boundary => {
		const c = await setup();
		try {
			const { pending } = await review( c ); let finish;
			c.nativeEvents.source = () => new Promise( resolve => { finish = resolve; } );
			modal().querySelector( 'button' ).click(); await tick(); expect( finish ).toEqual( expect.any( Function ) );
			if ( boundary === 'layers' ) { c.store.set( 'layers', [ { id: 'late', type: 'text', text: 'Keep newer edit' } ] ); }
			if ( boundary === 'Undo' ) { c.history.history[ 0 ].layers.push( { id: 'late', type: 'text' } ); }
			if ( boundary === 'configuration' ) { c.editor.config.pageOwned.surfaceId = 'Later'; }
			if ( boundary === 'backup' ) { const [ key ] = c.old[ 0 ]; c.records.set( key, c.records.get( key ) + ' ' ); }
			if ( boundary === 'finalProof' ) { c.events.response = response => { response.layersworkingcopyimportcreationdraftrebase.creation.baseBundle.extra.push( 'Later' ); return response; }; }
			if ( boundary === 'closed' ) { c.lifecycle.dispose(); }
			const before = observed( c ); finish(); await pending; expect( observed( c ) ).toStrictEqual( before );
			expect( c.ui.notifyEarlierFailure ).toHaveBeenCalledTimes( boundary === 'closed' ? 0 : 1 );
			expect( c.lifecycle.ready ).toBe( boundary !== 'closed' ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test.each( [ 'current', 'earlier' ] )( 'mixed %s chooser cancellation keeps exact-base safeguards scoped to the selected kind', async kind => {
		const c = await setup( 'slide', true, { current: true } );
		try {
			const before = observed( c ), pending = c.lifecycle.initialize(); await tick();
			expect( Array.from( modal().querySelectorAll( 'option' ), option => option.textContent ) ).toEqual( [ 'Draft 1', 'Earlier draft 1' ] );
			const select = modal().querySelector( 'select' ); select.value = kind === 'current' ? '0' : '1';
			select.dispatchEvent( new Event( 'change' ) ); cancel(); await pending;
			expect( c.lifecycle.ready ).toBe( kind === 'earlier' ); expect( observed( c ) ).toStrictEqual( before );
			expect( c.ui.notifyBlocked ).toHaveBeenCalledTimes( kind === 'current' ? 1 : 0 );
		} finally { c.dispose(); }
	} );
	test( 'choosing a current draft in the mixed dialog reuses the existing recovery path', async () => {
		const c = await setup( 'slide', true, { current: true } );
		try {
			const { pending } = await review( c, 0 ); await pending;
			expect( c.lifecycle.ready ).toBe( true ); expect( modal() ).toBeNull(); expect( c.editor.layers ).toHaveLength( 0 );
			expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test( 'preview is bounded text, including hostile layer text, with no executable markup', async () => {
		const c = await setup( 'slide', true, { backup: e => { e.editorState.layers[ 1 ].text = '<img src=x onerror=alert(1)>' + 'x'.repeat( 5000 );
			e.workingCopyDraft.workingState.layers[ 1 ].text = e.editorState.layers[ 1 ].text; } } );
		try {
			const pending = c.lifecycle.initialize(); await tick(); expect( modal() ).not.toBeNull();
			expect( modal().querySelector( 'img' ) ).toBeNull(); expect( modal().querySelector( 'pre' ).textContent.length ).toBeLessThanOrEqual( 2000 );
			cancel(); await pending;
		} finally { c.dispose(); }
	} );
	test( 'multiple earlier writers retain independent labels, payloads and write destinations', async () => {
		const c = await setup();
		try {
			const [ key, raw ] = c.old[ 0 ], envelope = JSON.parse( raw );
			envelope.editorState.layers[ 1 ].text = 'Second independent earlier draft';
			envelope.workingCopyDraft.workingState.layers[ 1 ].text = envelope.editorState.layers[ 1 ].text;
			c.records.set( key.replace( /#[a-f0-9]{32}$/, '#22222222222222222222222222222222' ), JSON.stringify( envelope ) );
			const before = observed( c ), pending = c.lifecycle.initialize(); await tick();
			expect( Array.from( modal().querySelectorAll( 'option' ), option => option.textContent ) ).toEqual( [ 'Earlier draft 1', 'Earlier draft 2' ] );
			const select = modal().querySelector( 'select' ); select.value = '1'; select.dispatchEvent( new Event( 'change' ) );
			expect( modal().querySelector( 'pre' ).textContent ).toContain( 'Second independent' );
			modal().querySelector( 'button' ).click(); await tick(); modal().querySelector( 'button' ).click(); await pending;
			expect( c.editor.layers[ 1 ].text ).toBe( 'Second independent earlier draft' );
			expect( Array.from( c.records.entries() ) ).toStrictEqual( before.records );
			c.lifecycle.flush(); expect( c.records.get( key ) ).toBe( raw );
			expect( c.records.get( key.replace( /#[a-f0-9]{32}$/, '#22222222222222222222222222222222' ) ) ).toBe( JSON.stringify( envelope ) );
		} finally { c.dispose(); }
	} );
	test.each( [ 'closed', 'layers' ] )( 'pending preview %s cannot offer stale work or resurrect the dialog', async boundary => {
		const c = await setup(); let finish;
		try {
			c.nativeEvents.source = () => new Promise( resolve => { finish = resolve; } );
			const pending = c.lifecycle.initialize(); await tick(); expect( finish ).toEqual( expect.any( Function ) );
			if ( boundary === 'closed' ) { c.lifecycle.dispose(); }
			else { c.store.set( 'layers', [ { id: 'late', type: 'text', text: 'Retain during preview' } ] ); }
			const before = observed( c ); finish(); await pending;
			expect( modal() ).toBeNull(); expect( observed( c ) ).toStrictEqual( before );
			expect( c.lifecycle.ready ).toBe( boundary !== 'closed' ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test( 'earlier enumeration refusal still invokes the existing exact-base recovery safeguards', async () => {
		const c = await setup( 'slide', true, { current: true } );
		try {
			c.controller.listEarlierCreationCandidates = () => { throw new Error( 'Storage refused' ); };
			const inspect = jest.spyOn( c.controller, 'inspectRecovery' ), before = observed( c );
			await c.lifecycle.initialize(); expect( inspect ).toHaveBeenCalled(); expect( c.lifecycle.ready ).toBe( true );
			expect( c.ui.notifyEarlierFailure ).toHaveBeenCalledTimes( 1 ); expect( observed( c ) ).toStrictEqual( before );
		} finally { c.dispose(); }
	} );
	test( 'editor without earlier backups uses the existing recovery path without a historical API read', async () => {
		const c = await setup();
		try {
			for ( const [ key ] of c.old ) { c.records.delete( key ); }
			await c.lifecycle.initialize(); expect( c.lifecycle.ready ).toBe( true ); expect( c.events.proofs ).toBe( 0 );
			expect( modal() ).toBeNull(); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
} );
