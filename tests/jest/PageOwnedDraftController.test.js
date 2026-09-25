'use strict';
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );

describe( 'PageOwnedDraftController', () => {
	let controller, bridge, data, state, identity, status, storage;
	beforeEach( () => {
		data = new Map();
		storage = { getItem: jest.fn( ( key ) => data.get( key ) ?? null ),
			setItem: jest.fn( ( key, value ) => data.set( key, value ) ) };
		state = { canvas: { width: 800, height: 600, backgroundOpacity: 0 }, layers: [] };
		identity = { owner: 'Owner', baseRevisionId: 12, surfaceId: 'selected' };
		status = { phase: 'ready', readOnly: false };
		bridge = { getLiveState: () => state, session: {
			getStatus: () => status, getDraft: () => identity
		} };
		controller = new Controller( bridge, new Store( storage ), new Adapter(), { wiki: 'wiki', user: 'user' } );
	} );

	it( 'round trips live state independently of the valid publication snapshot', () => {
		state.layers = [ { id: 'draft-only', invalidDrawingField: false } ];
		controller.persist();
		const recovery = controller.inspectRecovery();
		expect( recovery ).toEqual( { editorState: state, publicationBlocked: false } );
		recovery.editorState.layers.length = 0;
		expect( controller.inspectRecovery().editorState.layers ).toHaveLength( 1 );
		expect( identity.baseRevisionId ).toBe( 12 );
	} );

	it.each( [ 'saving', 'conflict', 'uncertain' ] )( 'requires reconciliation for a stored %s phase', ( phase ) => {
		status.phase = phase;
		controller.persist();
		status.phase = 'ready';
		expect( controller.inspectRecovery().publicationBlocked ).toBe( true );
		expect( status.phase ).toBe( 'ready' );
	} );

	it( 'does not look up drafts from another base revision', () => {
		controller.persist();
		identity.baseRevisionId = 13;
		expect( controller.inspectRecovery() ).toBeNull();
		expect( data.size ).toBe( 1 );
	} );

	it( 'rejects tampered envelope scope without applying or deleting it', () => {
		controller.persist();
		const [ key, raw ] = [ ...data.entries() ][ 0 ];
		const envelope = JSON.parse( raw );
		envelope.scope.owner = 'Other owner';
		data.set( key, JSON.stringify( envelope ) );
		expect( () => controller.inspectRecovery() ).toThrow( 'layers-invalid-page-owned-draft' );
		expect( data.size ).toBe( 1 );
		expect( identity.owner ).toBe( 'Owner' );
	} );

	it( 'rejects non-JSON edits rather than silently dropping data', () => {
		state.layers = [ { text: undefined } ];
		expect( () => controller.persist() ).toThrow( 'layers-invalid-page-owned-draft' );
		expect( storage.setItem ).not.toHaveBeenCalled();
	} );

	it( 'does not read or persist drafts in historical read-only mode', () => {
		status.readOnly = true;
		expect( () => controller.persist() ).toThrow( 'layers-invalid-page-owned-draft' );
		expect( () => controller.inspectRecovery() ).toThrow( 'layers-invalid-page-owned-draft' );
		expect( storage.setItem ).not.toHaveBeenCalled();
		expect( storage.getItem ).not.toHaveBeenCalled();
	} );

	it( 'surfaces a safe storage failure and leaves live edits intact', () => {
		const store = new Store( { getItem: () => null, setItem: () => { throw new Error( 'quota secret' ); } } );
		controller = new Controller( bridge, store, new Adapter(), { wiki: 'wiki', user: 'user' } );
		expect( () => controller.persist() ).toThrow( 'layers-draft-storage-failed' );
		expect( state.canvas.backgroundOpacity ).toBe( 0 );
	} );
} );
