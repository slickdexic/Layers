'use strict';

const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );

function setup( limit = Infinity ) {
	const records = new Map();
	const storage = {
		getItem: key => records.get( key ) ?? null,
		setItem: ( key, value ) => {
			let size = value.length;
			for ( const [ name, item ] of records ) { if ( name !== key ) { size += item.length; } }
			if ( size > limit ) { throw new Error( 'quota' ); }
			records.set( key, value );
		},
		removeItem: key => records.delete( key ),
		key: index => Array.from( records.keys() )[ index ],
		get length() { return records.size; }
	};
	const store = new Store( storage, 'a'.repeat( 32 ) );
	let revision = 12;
	let content = 'x'.repeat( 1000 );
	const scope = () => ( { wiki: 'wiki', user: '1', owner: 'Page', baseRevisionId: revision, surfaceId: 'slide' } );
	const controller = { store, _scope: scope, inspectRecovery: () => null, listCandidates: () => [],
		persist: () => store.write( scope(), JSON.stringify( { scope: scope(), text: content } ) ) };
	const bridge = {
		getLiveState: () => ( { canvas: {}, layers: [] } ),
		session: { getStatus: () => ( { phase: 'ready' } ) },
		editor: { stateManager: { subscribe: () => () => {} } },
		save: jest.fn( async ( summary, before ) => {
			await before(); revision++;
			return { revisionId: revision, dirty: false, editorStateValid: true };
		} )
	};
	const ui = { confirmRecovery: jest.fn(), notifyFailure: jest.fn(), notifyBlocked: jest.fn() };
	const lifecycle = new Lifecycle( bridge, controller, ui );
	return { lifecycle, bridge, controller, records, storage, scope, setContent: value => { content = value; } };
}

test( 'repeated confirmed saves retain only the latest own backup within a bounded quota', async () => {
	const state = setup( 2500 );
	await state.lifecycle.initialize();
	for ( let i = 0; i < 5; i++ ) {
		expect( ( await state.lifecycle.save() ).draftPersisted ).toBe( true );
		expect( state.records.size ).toBe( 1 );
	}
	expect( state.bridge.save ).toHaveBeenCalledTimes( 5 );
	state.lifecycle.dispose();
} );

test( 'a failed new-base backup keeps the prior record', async () => {
	const state = setup( 1500 );
	await state.lifecycle.initialize();
	const result = await state.lifecycle.save();
	expect( result.draftPersisted ).toBe( false );
	expect( state.records.size ).toBe( 1 );
	expect( Array.from( state.records.values() )[ 0 ] ).toContain( '"baseRevisionId":12' );
	state.lifecycle.dispose();
} );

test( 'confirmed cleanup leaves other writers and legacy recovery records intact', async () => {
	const state = setup();
	const scope = state.scope();
	new Store( state.storage, 'b'.repeat( 32 ) ).write( scope, '{"other":true}' );
	new Store( state.storage ).write( scope, '{"legacy":true}' );
	await state.lifecycle.initialize();
	await state.lifecycle.save();
	expect( Array.from( state.records.values() ) ).toEqual( expect.arrayContaining( [
		'{"other":true}', '{"legacy":true}'
	] ) );
	expect( state.records.size ).toBe( 3 );
	state.lifecycle.dispose();
} );

test( 'an uncertain publication retains the old backup and does not retire it', async () => {
	const state = setup();
	state.bridge.save.mockImplementation( async ( summary, before ) => {
		await before();
		throw Object.assign( new Error( 'unknown' ), { code: 'layers-publication-outcome-unknown' } );
	} );
	await state.lifecycle.initialize();
	await expect( state.lifecycle.save() ).rejects.toThrow( 'unknown' );
	expect( state.records.size ).toBe( 1 );
	expect( Array.from( state.records.values() )[ 0 ] ).toContain( '"baseRevisionId":12' );
	state.lifecycle.dispose();
} );

test( 'replacement backup retains newer changes made during Save', async () => {
	const state = setup();
	const originalSave = state.bridge.save.getMockImplementation();
	state.bridge.save.mockImplementation( async ( summary, before ) => {
		const result = await originalSave( summary, before );
		state.setContent( 'newer work' );
		return { ...result, dirty: true };
	} );
	await state.lifecycle.initialize();
	expect( ( await state.lifecycle.save() ).dirty ).toBe( true );
	expect( state.records.size ).toBe( 1 );
	expect( Array.from( state.records.values() )[ 0 ] ).toContain( '"baseRevisionId":13' );
	expect( JSON.parse( Array.from( state.records.values() )[ 0 ] ).text ).toBe( 'newer work' );
	state.lifecycle.dispose();
} );

test( 'cleanup refuses an old record changed by another writer', () => {
	const state = setup();
	const oldScope = state.scope();
	state.controller.persist();
	const oldKey = Array.from( state.records.keys() )[ 0 ];
	state.records.set( oldKey, '{"changed":"external"}' );
	const nextScope = { ...oldScope, baseRevisionId: 13 };
	state.controller.store.write( nextScope, '{"current":"safe"}' );
	expect( state.controller.store.retireConfirmed( oldScope, nextScope ) ).toBe( false );
	expect( state.records.get( oldKey ) ).toBe( '{"changed":"external"}' );
	expect( state.records.size ).toBe( 2 );
	state.lifecycle.dispose();
} );

test.each( [ 'creationOrigin', 'pdfCreation' ] )( 'preserves a recovery source carrying %s', field => {
	const state = setup();
	const oldScope = state.scope();
	state.controller.store.write( oldScope, JSON.stringify( { [ field ]: { source: true } } ) );
	const nextScope = { ...oldScope, baseRevisionId: 13 };
	state.controller.store.write( nextScope, '{"current":"safe"}' );
	expect( state.controller.store.retireConfirmed( oldScope, nextScope ) ).toBe( false );
	expect( state.records.size ).toBe( 2 );
	state.lifecycle.dispose();
} );
