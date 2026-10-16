'use strict';
const { setup, witness, wait, tickUntil, preparation, copy } = require( './fixtures/pdfCreationHost.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationLifecycle.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const ReadClient = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
function storage() {
	const values = new Map();
	return { values, get length() { return values.size; }, key: index => Array.from( values.keys() )[ index ] || null,
		getItem: key => values.has( key ) ? values.get( key ) : null, setItem: ( key, value ) => values.set( key, value ),
		removeItem: key => values.delete( key ) };
}
function connect( work, local = storage() ) {
	const store = new Store( local, 'b'.repeat( 32 ) ), exit = new Store( local, 'd'.repeat( 32 ) );
	const controller = new Controller( work.host, store, { wiki: 'wiki', user: 'Editor' }, { retainPublicationAttempt: true } );
	const ui = { choose: jest.fn( async () => 0 ), confirm: jest.fn( async () => true ), notifyFailure: jest.fn(), notifyBlocked: jest.fn() };
	return { store, exit, controller, local, ui, lifecycle: new Lifecycle( work.editor, work.host, controller, exit, ui ) };
}
async function start( local = storage(), slot = true ) {
	const work = setup( slot, 2, 2, 3 ); expect( await work.host.load() ).toBe( true );
	const value = connect( work, local ); expect( await value.lifecycle.initialize() ).toBe( true ); return { work, value };
}
function row( value, writer ) { return Array.from( value.local.values ).find( entry => entry[ 0 ].includes( '["wiki","Editor","Owner",12,' ) && entry[ 0 ].endsWith( '#' + writer.repeat( 32 ) ) ); }
function complete( work ) { return { editor: witness( work ), draft: work.host.captureExitEnvelope() }; }
function unrelated( value ) {
	const raw = row( value, 'b' )[ 1 ], scope = JSON.parse( raw ).scope;
	for ( const writer of [ 'a', 'c', 'e' ] ) new Store( value.local, writer.repeat( 32 ) ).write( scope, raw );
	new Store( value.local, 'b'.repeat( 32 ) ).write( { ...scope, owner: 'Other_owner' }, raw );
	new Store( value.local, 'd'.repeat( 32 ) ).write( { ...scope, baseRevisionId: 11 }, raw );
	return Array.from( value.local.values ).filter( entry => entry[ 0 ] !== row( value, 'b' )[ 0 ] );
}
async function save( work, value, outcome ) {
	work.edit( 'Sent work' ); const pending = wait(); work.publisher.publish.mockReturnValue( pending.promise );
	const saving = value.lifecycle.save().catch( error => error ); await tickUntil( () => work.publisher.publish.mock.calls.length === 1 );
	work.edit( 'Newer work' );
	if ( outcome === 'confirmed' ) pending.resolve( { revisionId: 13 } );
	else pending.reject( Object.assign( new Error( outcome ), outcome === 'refused' ? { code: 'layers-edit-conflict' } : {} ) );
	return saving;
}
it.each( [ true, false ] )( 'retires only owned live/exit records after explicit commit (layers slot %s)', async slot => {
	const { work, value } = await start( storage(), slot );
	try {
		work.edit( 'Two' ); await work.host.turn( 1 ); work.edit( 'Hidden Redo' ); work.editor.historyManager.undo();
		await work.host.turn( 2 ); value.lifecycle.flush(); const retained = unrelated( value );
		value.controller.preserveForExit( value.exit ); const before = complete( work ), stored = Array.from( value.local.values );
		const plan = value.lifecycle.prepareDiscard(); expect( Array.from( value.local.values ) ).toEqual( stored );
		expect( value.lifecycle.getStatus().finalized ).toBe( false ); expect( plan.returnTarget ).toEqual( { owner: 'Owner', revisionId: 12 } );
		plan.returnTarget.owner = 'File:Source.pdf';
		expect( value.lifecycle.commitDiscard( plan.handle ) ).toEqual( { closed: true, discarded: true, returnTarget: { owner: 'Owner', revisionId: 12 } } );
		expect( complete( work ) ).toEqual( before ); expect( Array.from( value.local.values ) ).toEqual( retained );
		expect( value.lifecycle.getStatus() ).toMatchObject( { finalized: true, ready: false } );
		window.dispatchEvent( new Event( 'pagehide' ) ); expect( value.lifecycle.dispose( true ) ).toBe( true );
		expect( value.lifecycle.flush() ).toBe( false ); expect( Array.from( value.local.values ) ).toEqual( retained );
		await expect( value.lifecycle.save() ).rejects.toThrow(); expect( work.publisher.publish ).not.toHaveBeenCalled();
		expect( () => value.lifecycle.commitDiscard( plan.handle ) ).toThrow();
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it( 'discards an active record when no exit candidate has ever been written', async () => {
	const { work, value } = await start();
	try { work.edit( 'Discard' ); expect( row( value, 'd' ) ).toBeUndefined();
		expect( value.lifecycle.commitDiscard( value.lifecycle.prepareDiscard().handle ).discarded ).toBe( true );
		expect( value.local.values.size ).toBe( 0 );
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it.each( [ 'layers', 'Undo', 'offscreen history', 'selection', 'URL', 'canvas geometry', 'editor destroyed', 'state replaced',
	'exit writer', 'exit storage', 'exit read method', 'storage remove', 'storage read', 'live raw', 'exit raw', 'host invalidation', 'controller method', 'released', 'forged', 'another operation' ] )(
	'refuses a stale or forged Discard after %s without retiring any writer', async reason => {
		const { work, value } = await start();
		try {
			work.edit( 'Keep' ); value.lifecycle.flush(); value.controller.preserveForExit( value.exit );
			const plan = value.lifecycle.prepareDiscard(); let handle = plan.handle;
			if ( reason === 'layers' ) work.edit( 'Newer' );
			if ( reason === 'Undo' ) work.editor.historyManager.undo();
			if ( reason === 'offscreen history' ) work.editor.historyManager.history[ 0 ].description += ' changed';
			if ( reason === 'selection' ) work.editor.canvasManager.selectedLayerIds = [ 'text-2' ];
			if ( reason === 'URL' ) window.history.replaceState( {}, '', '?other=1' );
			if ( reason === 'canvas geometry' ) work.editor.canvasManager.canvas.height++;
			if ( reason === 'editor destroyed' ) work.editor.isDestroyed = true;
			if ( reason === 'state replaced' ) work.editor.stateManager = Object.create( work.editor.stateManager );
			if ( reason === 'exit writer' ) value.exit._writerId = 'f'.repeat( 32 );
			if ( reason === 'exit storage' ) value.exit._storage = storage();
			if ( reason === 'exit read method' ) value.exit.read = () => null;
			if ( reason === 'storage remove' ) value.local.removeItem = () => {};
			if ( reason === 'storage read' ) value.local.getItem = () => null;
			if ( reason === 'live raw' ) value.local.values.set( row( value, 'b' )[ 0 ], '{"foreign":true}' );
			if ( reason === 'exit raw' ) value.local.values.set( row( value, 'd' )[ 0 ], '{"foreign":true}' );
			if ( reason === 'host invalidation' ) work.host.invalidate();
			if ( reason === 'controller method' ) value.controller.commitOwnedDiscard = () => true;
			if ( reason === 'released' ) value.lifecycle.releaseDiscard( handle );
			if ( reason === 'forged' ) handle = Object.freeze( {} );
			if ( reason === 'another operation' ) await expect( value.lifecycle.save() ).rejects.toThrow();
			const stored = Array.from( value.local.values ), layers = copy( work.editor.layers );
			expect( () => value.lifecycle.commitDiscard( handle ) ).toThrow(); expect( value.lifecycle.getStatus().finalized ).toBe( false );
			expect( Array.from( value.local.values ) ).toEqual( stored ); expect( work.editor.layers ).toEqual( layers );
		} finally { value.lifecycle.dispose( true ); work.close(); }
	} );
it.each( [ 'first remove throws', 'second remove throws', 'second remove throws after deleting', 'silent remove', 'late layers', 'late Undo', 'foreign exit', 'late writer', 'late method', 'reentrant autosave' ] )(
	'rolls owned retirement back after %s and never overwrites foreign bytes', async reason => {
		const local = storage(), remove = local.removeItem; let armed = false, calls = 0, work, value, reentered;
		local.removeItem = key => {
			if ( !armed ) return remove( key ); calls++;
			if ( reason === 'first remove throws' && calls === 1 || reason === 'second remove throws' && calls === 2 ) throw new Error( 'refused' );
			if ( reason === 'silent remove' ) return;
			remove( key );
			if ( reason === 'second remove throws after deleting' && calls === 2 ) throw new Error( 'after delete' );
			if ( calls === 1 ) {
				if ( reason === 'late layers' ) work.edit( 'New during retirement' );
				if ( reason === 'late Undo' ) work.editor.historyManager.undo();
				if ( reason === 'foreign exit' ) local.values.set( row( value, 'd' )[ 0 ], '{"foreign":true}' );
				if ( reason === 'late writer' ) value.exit._writerId = 'e'.repeat( 32 );
				if ( reason === 'late method' ) local.removeItem = () => {};
				if ( reason === 'reentrant autosave' ) { reentered = value.lifecycle.flush(); throw new Error( 'reentrant refused' ); }
			}
		};
		( { work, value } = await start( local ) );
		try {
			work.edit( 'Current' ); value.lifecycle.flush(); const kept = unrelated( value ); value.controller.preserveForExit( value.exit );
			const before = new Map( local.values ), exitKey = row( value, 'd' )[ 0 ], plan = value.lifecycle.prepareDiscard(); armed = true;
			expect( () => value.lifecycle.commitDiscard( plan.handle ) ).toThrow(); expect( value.lifecycle.getStatus().finalized ).toBe( false );
			for ( const [ key, raw ] of before ) expect( local.values.get( key ) ).toBe( reason === 'foreign exit' && key === exitKey ? '{"foreign":true}' : raw );
			for ( const [ key, raw ] of kept ) expect( local.values.get( key ) ).toBe( raw );
			if ( reason === 'late layers' ) expect( work.editor.layers[ 0 ].text ).toBe( 'New during retirement' );
			if ( reason === 'late Undo' ) expect( work.editor.layers ).toEqual( [] );
			if ( reason === 'reentrant autosave' ) expect( reentered ).toBe( false );
		} finally { armed = false; value.lifecycle.dispose( true ); work.close(); }
	} );
it.each( [ 'unknown', 'pending' ] )( 'preserves unresolved %s sent evidence and refuses even direct controller retirement', async outcome => {
	const { work, value } = await start(); let pending, saving;
	try {
		if ( outcome === 'unknown' ) await save( work, value, outcome );
		else { work.edit( 'Sent' ); pending = wait(); work.publisher.publish.mockReturnValue( pending.promise );
			saving = value.lifecycle.save().catch( error => error ); await tickUntil( () => work.publisher.publish.mock.calls.length === 1 ); }
		value.controller.preserveForExit( value.exit ); const before = Array.from( value.local.values );
		expect( () => value.lifecycle.prepareDiscard() ).toThrow(); expect( () => value.controller.prepareOwnedDiscard( value.exit ) ).toThrow();
		expect( Array.from( value.local.values ) ).toEqual( before ); expect( value.lifecycle.getStatus().finalized ).toBe( false );
		if ( pending ) { pending.reject( new Error( 'lost' ) ); await saving; }
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it.each( [ 'refused', 'confirmed' ] )( 'permits explicit Discard of newer local edits after a known %s result', async outcome => {
	const { work, value } = await start();
	try {
		await save( work, value, outcome ); const before = complete( work ); value.controller.preserveForExit( value.exit );
		const result = value.lifecycle.commitDiscard( value.lifecycle.prepareDiscard().handle );
		expect( result ).toMatchObject( { discarded: true, returnTarget: { owner: 'Owner', revisionId: outcome === 'confirmed' ? 13 : 12 } } );
		expect( complete( work ) ).toEqual( before ); expect( value.local.values.size ).toBe( 0 ); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it( 'does not treat a read-only base-current observation as permission to erase unresolved sent evidence', async () => {
	const { work, value } = await start();
	try {
		await save( work, value, 'unknown' );
		const api = { get: jest.fn( async options => options.action === 'query' ? { query: { pages: [ { pageid: 7, title: 'Owner', revisions: [ {
			revid: 12, parentid: 11, slots: { main: { contentmodel: 'wikitext', content: work.native.mainText } } }
		] } ] } } : { layersread: options.editorpage ? preparation( true, 2, options.editorpage, 3 ).context : copy( work.native.baseBundle ) } ) };
		expect( await value.lifecycle.reconcile( { api, reader: new ReadClient( api ), pdfReader: new PdfClient( api ) }, new Store( value.local, 'c'.repeat( 32 ) ) ) ).toMatchObject( { outcome: 'base-current', applied: true } );
		expect( work.host.getStatus().phase ).toBe( 'ready' ); const before = Array.from( value.local.values );
		expect( () => value.lifecycle.prepareDiscard() ).toThrow(); expect( () => value.controller.prepareOwnedDiscard( value.exit ) ).toThrow();
		expect( Array.from( value.local.values ) ).toEqual( before );
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it( 'preserves a restored source writer byte-exactly when discarding only this live editor', async () => {
	const source = await start(), target = setup( true, 2, 2, 3 ); let value;
	try {
		source.work.edit( 'Recoverable' ); source.value.lifecycle.flush(); const raw = row( source.value, 'b' )[ 1 ];
		const local = storage(), scope = JSON.parse( raw ).scope; new Store( local, 'a'.repeat( 32 ) ).write( scope, raw );
		expect( await target.host.load() ).toBe( true ); value = connect( target, local ); expect( await value.lifecycle.initialize() ).toBe( true );
		expect( target.editor.layers[ 0 ].text ).toBe( 'Recoverable' ); target.edit( 'Discard only this work' );
		value.controller.preserveForExit( value.exit ); value.lifecycle.commitDiscard( value.lifecycle.prepareDiscard().handle );
		expect( Array.from( local.values ) ).toEqual( [ [ row( value, 'a' )[ 0 ], raw ] ] );
	} finally { source.value.lifecycle.dispose( true ); source.work.close(); if ( value ) value.lifecycle.dispose( true ); target.close(); }
} );
it.each( [ 'pending review', 'cancelled review' ] )( 'does not grant Discard while %s preserves a source writer', async reason => {
	const source = await start(), work = setup( true, 2, 2, 3 ); let value;
	try {
		source.work.edit( 'Earlier work' ); source.value.lifecycle.flush(); const raw = row( source.value, 'b' )[ 1 ];
		const local = storage(); new Store( local, 'a'.repeat( 32 ) ).write( JSON.parse( raw ).scope, raw );
		expect( await work.host.load() ).toBe( true ); value = connect( work, local ); const pending = wait();
		value.ui.confirm.mockReturnValue( pending.promise ); const reviewing = value.lifecycle.initialize();
		await tickUntil( () => value.ui.confirm.mock.calls.length === 1 );
		if ( reason === 'cancelled review' ) { pending.resolve( false ); expect( await reviewing ).toBe( false ); }
		const before = Array.from( local.values ); expect( () => value.lifecycle.prepareDiscard() ).toThrow();
		expect( () => value.controller.prepareOwnedDiscard( value.exit ) ).toThrow(); expect( Array.from( local.values ) ).toEqual( before );
		if ( reason === 'pending review' ) { pending.resolve( false ); expect( await reviewing ).toBe( false ); }
	} finally { source.value.lifecycle.dispose( true ); source.work.close(); if ( value ) value.lifecycle.dispose( true ); work.close(); }
} );
it( 'rejects a foreign lifecycle handle without consuming the real owner plan', async () => {
	const one = await start(), two = await start();
	try {
		one.work.edit( 'One' ); const plan = one.value.lifecycle.prepareDiscard(), before = Array.from( one.value.local.values );
		expect( () => two.value.lifecycle.commitDiscard( plan.handle ) ).toThrow(); expect( Array.from( one.value.local.values ) ).toEqual( before );
		expect( one.value.lifecycle.commitDiscard( plan.handle ).discarded ).toBe( true );
	} finally { one.value.lifecycle.dispose( true ); two.value.lifecycle.dispose( true ); one.work.close(); two.work.close(); }
} );
it( 'permits a fresh Discard after a failed removal is restored and the store works again', async () => {
	const local = storage(), remove = local.removeItem; let fail = false;
	local.removeItem = key => { remove( key ); if ( fail ) throw new Error( 'after deletion' ); };
	const { work, value } = await start( local );
	try {
		work.edit( 'Discard on retry' ); value.lifecycle.flush(); value.controller.preserveForExit( value.exit ); const before = new Map( local.values );
		fail = true; expect( () => value.lifecycle.commitDiscard( value.lifecycle.prepareDiscard().handle ) ).toThrow();
		for ( const [ key, raw ] of before ) expect( local.values.get( key ) ).toBe( raw );
		fail = false; expect( value.lifecycle.commitDiscard( value.lifecycle.prepareDiscard().handle ).discarded ).toBe( true );
		expect( local.values.size ).toBe( 0 );
	} finally { fail = false; value.lifecycle.dispose( true ); work.close(); }
} );
