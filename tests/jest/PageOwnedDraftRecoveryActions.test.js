'use strict';
const Actions = require( '../../resources/ext.layers.editor/PageOwnedDraftRecoveryActions.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const State = require( '../../resources/ext.layers.editor/StateManager.js' );
const first = 'a'.repeat( 32 ), second = 'b'.repeat( 32 );
const scope = { wiki: 'wiki', user: 'Editor', owner: 'Owner', baseRevisionId: 12, surfaceId: 'slide' };
function memory() {
	const values = new Map(); return { values, get length() { return values.size; }, key: i => Array.from( values.keys() )[ i ],
		getItem: key => values.get( key ) ?? null, setItem: ( key, value ) => values.set( key, value ), removeItem: key => values.delete( key ) };
}
function setup( decisions ) {
	const local = memory(), session = memory(), source = new Store( local, first ), reader = new Store( local, second );
	const raw = JSON.stringify( { version: 1, scope, phase: 'ready', editorState: { layers: [ { text: 'unsaved' } ] } } );
	source.write( scope, raw ); reader.selectRecovery( first );
	const editor = { config: { pageOwned: { owner: 'Owner', surfaceId: 'slide', revisionId: 12 } }, uiManager: { container: document.createElement( 'div' ) } };
	editor.stateManager = new State( editor ); editor.stateManager.set( 'layers', [] );
	const api = { get: jest.fn().mockResolvedValue( { query: { pages: [ { revisions: [ { revid: 13 } ] } ] } } ), postWithToken: jest.fn() };
	const manager = { editor, api }, controller = { getRecoveryScope: () => ( { ...scope } ),
		prepareRecoveryDiscard: () => reader.prepareRecoveryDiscard( scope ) };
	const dialog = { decide: jest.fn() }; for ( const decision of decisions ) dialog.decide.mockResolvedValueOnce( decision );
	window.sessionStorage = session;
	window.history.replaceState( {}, '', '/index.php?title=Special:EditLayersPage&owner=Owner&surface=slide&revid=12' );
	window.fetch = jest.fn().mockResolvedValue( { ok: true, text: async () => '<script>RLCONF={"wgLayersEditorInit":' +
		JSON.stringify( { pageOwned: { owner: 'Owner', surfaceId: 'slide', revisionId: 13, readOnly: false } } ) + '};</script>' } );
	mw.util = { getUrl: title => '/wiki/' + title }; mw.config.get = jest.fn().mockReturnValue( null ); mw.notify = jest.fn(); mw.msg = key => key;
	const actions = new Actions( manager, controller, dialog );
	const leave = jest.spyOn( actions, 'leave' ).mockImplementation( function () { this.departing = true; } );
	return { actions, source, reader, raw, local, session, editor, api, dialog, leave };
}
afterEach( () => jest.restoreAllMocks() );

test( 'Continue keeps the exact source and does not load or publish a saved replacement', async () => {
	const ctx = setup( [ 'continue' ] );
	expect( await ctx.actions.confirm( {} ) ).toBe( true );
	expect( ctx.source.read( scope ) ).toBe( ctx.raw ); expect( ctx.api.get ).not.toHaveBeenCalled();
	expect( ctx.api.postWithToken ).not.toHaveBeenCalled(); expect( ctx.leave ).not.toHaveBeenCalled();
} );

test( 'confirmed Discard deletes only its selected backup and grants one exact saved-editor continuation', async () => {
	const ctx = setup( [ 'discard' ] ); ctx.local.setItem( 'unrelated', 'keep' );
	new Store( ctx.local, 'c'.repeat( 32 ) ).write( scope, ctx.raw );
	expect( await ctx.actions.confirm( {} ) ).toBe( false );
	expect( ctx.source.read( scope ) ).toBeNull(); expect( ctx.local.getItem( 'unrelated' ) ).toBe( 'keep' );
	expect( ctx.local.values.size ).toBe( 2 ); expect( ctx.api.postWithToken ).not.toHaveBeenCalled();
	const target = new URL( ctx.leave.mock.calls[ 0 ][ 0 ] ); expect( target.searchParams.get( 'revid' ) ).toBe( '13' );
	window.history.replaceState( {}, '', target.pathname + target.search ); ctx.editor.config.pageOwned.revisionId = 13;
	expect( ctx.actions.consumeSavedOpen() ).toBe( true ); expect( ctx.actions.consumeSavedOpen() ).toBe( false );
} );

test( 'Cancel returns to the owning page and preserves every backup without a publication request', async () => {
	const ctx = setup( [ 'cancel' ] ), before = Array.from( ctx.local.values );
	expect( await ctx.actions.confirm( {} ) ).toBe( false ); expect( ctx.leave ).toHaveBeenCalledWith( '/wiki/Owner' );
	expect( Array.from( ctx.local.values ) ).toEqual( before ); expect( window.fetch ).not.toHaveBeenCalled();
	expect( ctx.api.postWithToken ).not.toHaveBeenCalled();
} );

test( 'changed backup bytes require a new review and are never discarded', async () => {
	const ctx = setup( [] ), newer = ctx.raw.replace( 'unsaved', 'newer edit' );
	ctx.dialog.decide.mockImplementationOnce( async () => { ctx.source.write( scope, newer ); return 'discard'; } );
	expect( await ctx.actions.confirm( {} ) ).toBe( false ); expect( ctx.source.read( scope ) ).toBe( newer );
	expect( window.fetch ).not.toHaveBeenCalled(); expect( ctx.leave ).toHaveBeenCalledWith( window.location.href );
} );

test( 'Cancel retains the editor return path used by embedded modal hosts', async () => {
	const ctx = setup( [ 'cancel' ] ); ctx.editor.filename = 'Owner'; ctx.editor.navigateBackToFileWithName = jest.fn();
	expect( await ctx.actions.confirm( {} ) ).toBe( false );
	expect( ctx.editor.navigateBackToFileWithName ).toHaveBeenCalledWith( 'Owner' );
	expect( ctx.leave ).not.toHaveBeenCalled(); expect( ctx.source.read( scope ) ).toBe( ctx.raw );
} );

test( 'refused native saved-editor entry preserves the draft and permits Cancel', async () => {
	const ctx = setup( [ 'discard', 'cancel' ] ); window.fetch.mockResolvedValue( { ok: false } );
	expect( await ctx.actions.confirm( {} ) ).toBe( false ); expect( ctx.source.read( scope ) ).toBe( ctx.raw );
	expect( ctx.leave ).toHaveBeenCalledWith( '/wiki/Owner' ); expect( ctx.session.values.size ).toBe( 0 );
} );

test( 'navigation failure rolls deletion back without overwriting other records', async () => {
	const ctx = setup( [ 'discard', 'cancel' ] ); ctx.leave.mockImplementationOnce( () => { throw new Error( 'navigation failed' ); } );
	expect( await ctx.actions.confirm( {} ) ).toBe( false ); expect( ctx.source.read( scope ) ).toBe( ctx.raw );
	expect( ctx.session.values.size ).toBe( 0 );
} );

test( 'late work during the decision is preserved and refuses the stale action', async () => {
	const ctx = setup( [] ); ctx.dialog.decide.mockImplementationOnce( async () => {
		ctx.editor.stateManager.set( 'layers', [ { id: 'new', text: 'newer work' } ] ); return 'discard';
	} );
	await expect( ctx.actions.confirm( {} ) ).rejects.toThrow( 'layers-editor-session-unavailable' );
	expect( ctx.source.read( scope ) ).toBe( ctx.raw ); expect( ctx.leave ).not.toHaveBeenCalled();
	expect( ctx.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'newer work' );
} );

test( 'rollback still restores the backup when clearing the saved-open intent fails', async () => {
	const ctx = setup( [ 'discard', 'cancel' ] );
	ctx.leave.mockImplementationOnce( () => { ctx.session.removeItem = () => { throw new Error( 'session storage failed' ); }; throw new Error( 'navigation failed' ); } );
	expect( await ctx.actions.confirm( {} ) ).toBe( false ); expect( ctx.source.read( scope ) ).toBe( ctx.raw );
} );
