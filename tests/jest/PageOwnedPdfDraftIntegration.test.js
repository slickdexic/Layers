'use strict';
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
const records = new Map();
const storage = { getItem: key => records.get( key ) ?? null,
	setItem: ( key, value ) => records.set( key, value ), removeItem: key => records.delete( key ),
	key: index => Array.from( records.keys() )[ index ] ?? null, get length() { return records.size; } };
const stored = () => Object.fromEntries( Array.from( records.entries() ).sort( ( left, right ) => left[ 0 ].localeCompare( right[ 0 ] ) ) );
const controller = ( work, writer ) => new Controller( work.bridge, new Store( storage, writer.repeat( 32 ) ),
	new Adapter(), { wiki: 'wiki', user: '7' } );
const ui = accept => ( { chooseDraft: jest.fn().mockResolvedValue( 0 ),
	confirmRecovery: jest.fn().mockResolvedValue( accept ), notifyBlocked: jest.fn(), notifyFailure: jest.fn() } );
async function sourceDraft( oldId = false ) {
	const work = await fixture();
	await work.bridge.pdfCoordinator.turn( 1 );
	work.edit( 'Off-screen only' );
	const layers = work.editor.stateManager.get( 'layers' );
	layers[ 0 ].gradient = { type: 'linear', angle: 999, colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#0f0' } ] };
	work.editor.stateManager.set( 'layers', layers );
	if ( oldId ) await work.bridge.reconcile( 13 );
	await work.bridge.pdfCoordinator.turn( 2 );
	controller( work, 'a' ).persist();
	const expected = work.session.getDraft();
	work.close();
	return expected;
}
describe( 'Complete PDF drafts through actual storage and lifecycle', () => {
	beforeEach( () => records.clear() );
	it.each( [ false, true ] )( 'recovers complete off-screen work with fresh contexts and historical authority old-ID=%s', async oldId => {
		const expected = await sourceDraft( oldId ), source = stored(), work = await fixture( true, oldId ? 13 : 12 );
		const controls = ui( true ), drafts = new Lifecycle( work.bridge, controller( work, 'b' ), controls );
		try {
			await drafts.initialize();
			expect( controls.confirmRecovery ).toHaveBeenCalledTimes( 1 );
			expect( controls.confirmRecovery.mock.calls[ 0 ][ 0 ].editorState ).toStrictEqual( work.bridge.getLiveState() );
			expect( work.session.getDraft().snapshot ).toStrictEqual( expected.snapshot );
			expect( work.editor.page ).toBe( 2 );
			expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe(
				controls.confirmRecovery.mock.calls[ 0 ][ 0 ].pdfHistory.members.find( member => member.page === 2 )
					.timeline.lastSaveHistoryIndex );
			expect( work.api.get.mock.calls.map( call => call[ 0 ] ).filter( params => params.editorpage )
				.map( params => [ params.revid, params.binding, params.editorpage ] ) )
				.toStrictEqual( [ [ oldId ? 13 : 12, 'v1:7:anchor', 2 ], [ oldId ? 13 : 12, 'v1:7:anchor', 1 ] ] );
			if ( oldId ) expect( work.api.get.mock.calls.map( call => call[ 0 ] ).filter( params => !params.editorpage )
				.map( params => params.revid ) ).toStrictEqual( [ 13, 12, 13 ] );
			expect( stored() ).toStrictEqual( source );
			expect( drafts.flush() ).toBe( true );
			expect( Object.values( stored() ).map( raw => JSON.parse( raw ).pdfDraft.snapshot ) )
				.toStrictEqual( [ expected.snapshot, expected.snapshot ] );
			expect( drafts.finalizeClose( true ) ).toBe( true );
			expect( stored() ).toStrictEqual( source );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { drafts.dispose(); work.close(); }
	} );
	it.each( [ 'cancel', 'denial', 'historical suppression' ] )( 'preserves complete live work and independent source on %s', async reason => {
		await sourceDraft( reason === 'historical suppression' );
		const source = stored(), work = await fixture( true, reason === 'historical suppression' ? 13 : 12 );
		const controls = ui( reason !== 'cancel' ), drafts = new Lifecycle( work.bridge, controller( work, 'b' ), controls );
		try {
			const before = work.bridge.pdfCoordinator.witness();
			const original = work.api.get.getMockImplementation();
			if ( reason !== 'cancel' ) work.api.get.mockImplementation( params =>
				( reason === 'denial' ? params.editorpage === 1 : params.revid === 12 ) ?
					Promise.resolve( { error: { code: 'permissiondenied' } } ) : original( params ) );
			if ( reason === 'cancel' ) await drafts.initialize();
			else await expect( drafts.initialize() ).rejects.toThrow();
			expect( work.bridge.pdfCoordinator.witness() ).toBe( before );
			expect( stored() ).toStrictEqual( source );
			expect( drafts.ready ).toBe( false );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { drafts.dispose(); work.close(); }
	} );
	it( 'retires every owned base after a clean complete save and does not recreate it on disposal', async () => {
		const work = await fixture(), drafts = new Lifecycle( work.bridge, controller( work, 'b' ), ui( true ) );
		try {
			await drafts.initialize();
			await work.bridge.pdfCoordinator.turn( 1 );
			work.edit( 'Saved first' );
			expect( drafts.flush() ).toBe( true );
			const result = await drafts.save( 'One complete save' );
			expect( result ).toMatchObject( { revisionId: 13, dirty: false, draftPersisted: true } );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			expect( Object.keys( stored() ) ).toHaveLength( 2 );
			expect( drafts.finalizeClose() ).toBe( true );
			drafts.dispose();
			expect( stored() ).toStrictEqual( {} );
		} finally { drafts.dispose(); work.close(); }
	} );
	it( 'refuses a late authorization-response edit without merging recovered off-screen work', async () => {
		await sourceDraft();
		const source = stored(), work = await fixture();
		const drafts = new Lifecycle( work.bridge, controller( work, 'b' ), ui( true ) );
		try {
			const original = work.api.get.getMockImplementation();
			work.api.get.mockImplementation( params => {
				if ( !params.editorpage ) {
					let queued = Promise.resolve();
					for ( let index = 0; index < 6; index++ ) queued = queued.then( () => {} );
					queued.then( () => work.edit( 'Late selected edit' ) );
				}
				return original( params );
			} );
			let failure;
			try { await drafts.initialize(); } catch ( error ) { failure = error; }
			const expected = JSON.parse( JSON.stringify( work.base ) );
			expected.surfaces.find( member => member.id === 'anchor' ).layers =
				[ { id: 'edit-2', type: 'text', text: 'Late selected edit', x: -17 } ];
			expect( work.session.getDraft().snapshot ).toStrictEqual( expected );
			expect( failure ).toBeInstanceOf( Error );
			expect( stored() ).toStrictEqual( source );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Late selected edit' );
		} finally { drafts.dispose(); work.close(); }
	} );
} );