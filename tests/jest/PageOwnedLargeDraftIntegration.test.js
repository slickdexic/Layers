'use strict';

const { context, clone } = require( './fixtures/workingCopyImportContext.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );

test( 'a large repeated image and Undo history survive Save and draft recovery under quota', async () => {
	const original = await context( 'slide', true );
	const base = clone( original.base );
	const src = 'data:image/png;base64,' + 'A'.repeat( 1000000 );
	base.surfaces[ 0 ].layers[ 0 ].src = src;
	const work = await context( 'slide', true, base );
	const records = new Map( [ [ 'unrelated', 'x'.repeat( 3000000 ) ] ] );
	const storage = {
		getItem: key => records.get( key ) ?? null,
		setItem: ( key, value ) => {
			let total = key.length + value.length;
			for ( const [ name, item ] of records ) { if ( name !== key ) { total += name.length + item.length; } }
			if ( total > 5242880 ) { throw Object.assign( new Error( 'quota' ), { name: 'QuotaExceededError' } ); }
			records.set( key, value );
		},
		removeItem: key => records.delete( key ),
		key: index => Array.from( records.keys() )[ index ],
		get length() { return records.size; }
	};
	const controller = new Controller( work.bridge, new Store( storage, 'a'.repeat( 32 ) ), work.adapter,
		{ wiki: 'test-wiki', user: '1' } );
	controller.enableWorkingCopyDrafts();
	const lifecycle = new Lifecycle( work.bridge, controller, {
		confirmRecovery: jest.fn(), notifyFailure: jest.fn(), notifyBlocked: jest.fn()
	} );
	try {
		await lifecycle.initialize();
		for ( let i = 0; i < 5; i++ ) {
			const layers = clone( work.store.get( 'layers' ) );
			layers[ 0 ].text = 'edit ' + i;
			work.store.set( 'layers', layers );
			work.history.saveState( 'edit ' + i );
		}
		expect( JSON.stringify( work.bridge.captureWorkingCopyDraft() ).length ).toBeGreaterThan( 5000000 );
		work.publisher.publish.mockResolvedValue( { revisionId: 13 } );
		const result = await lifecycle.save();
		expect( result ).toMatchObject( { revisionId: 13, draftPersisted: true } );
		expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
		expect( records.get( 'unrelated' ).length ).toBe( 3000000 );
		expect( records.size ).toBe( 2 );
		expect( Array.from( records.values() ).some( value => value.startsWith( 'layers-packed-draft-v1:' ) ) ).toBe( true );
		const candidate = controller.inspectRecovery();
		expect( candidate.editorState.layers[ 0 ].src ).toBe( src );
		expect( candidate.workingCopyDraft.timeline.history.length ).toBeGreaterThanOrEqual( 5 );
		expect( candidate.workingCopyDraft.workingState.layers[ 0 ].text ).toBe( 'edit 4' );

		// A fresh editor has a different writer ID and no in-memory store state.
		// It must discover and decode the original writer's compact backup.
		const reopened = new Controller( work.bridge, new Store( storage, 'b'.repeat( 32 ) ), work.adapter,
			{ wiki: 'test-wiki', user: '1' } );
		reopened.enableWorkingCopyDrafts();
		const beforeRecovery = Array.from( records.entries() );
		expect( reopened.listCandidates() ).toContain( 'a'.repeat( 32 ) );
		reopened.selectRecovery( 'a'.repeat( 32 ) );
		const recovered = reopened.inspectRecovery();
		expect( recovered ).toEqual( candidate );
		expect( Array.from( records.entries() ) ).toEqual( beforeRecovery );
	} finally {
		lifecycle.dispose();
	}
} );
