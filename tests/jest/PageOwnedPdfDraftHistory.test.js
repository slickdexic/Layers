'use strict';
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const records = new Map();
const storage = { getItem: key => records.get( key ) ?? null,
	setItem: ( key, value ) => records.set( key, value ), removeItem: key => records.delete( key ),
	key: index => Array.from( records.keys() )[ index ] ?? null, get length() { return records.size; } };
const copy = value => JSON.parse( JSON.stringify( value ) );
const controller = ( work, writer ) => new Controller( work.bridge, new Store( storage, writer.repeat( 32 ) ),
	new Adapter(), { wiki: 'wiki', user: '7' } );
const timelines = work => {
	const result = new Map( work.bridge.pdfCoordinator.timelines );
	result.set( work.editor.page, work.editor.historyManager.captureTimeline() );
	return copy( Array.from( result ).sort( ( left, right ) => left[ 0 ] - right[ 0 ] ) );
};
async function interrupted( active = 2, oldId = false ) {
	const work = await fixture();
	work.edit( 'Second first edit' );
	work.edit( 'Second redo edit' );
	expect( work.editor.historyManager.undo() ).toBe( true );
	expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
	work.edit( 'First first edit' );
	work.edit( 'First redo edit' );
	expect( work.editor.historyManager.undo() ).toBe( true );
	if ( oldId ) await work.bridge.reconcile( 13 );
	if ( active === 2 ) expect( await work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
	const live = work.editor.stateManager.get( 'layers' );
	live[ 0 ].unknownFiniteProperty = { pending: [ null, false, 0, 'not recorded' ] };
	work.editor.stateManager.set( 'layers', live );
	const expected = timelines( work );
	controller( work, 'a' ).persist();
	const draft = work.session.getDraft();
	const originalRecords = Object.fromEntries( records );
	work.close();
	return { expected, draft, originalRecords };
}
describe( 'Actual persisted per-member PDF Undo histories', () => {
	beforeEach( () => records.clear() );
	it.each( [ 1, 2 ] )( 'restores recorded histories, redo and pending complete work from active page %s', async active => {
		const source = await interrupted( active );
		const work = await fixture();
		try {
			const drafts = controller( work, 'b' );
			drafts.selectRecovery( drafts.listCandidates()[ 0 ] );
			const candidate = drafts.inspectRecovery();
			await work.bridge.restoreDraft( candidate );
			expect( work.editor.historyManager.captureTimeline() )
				.toStrictEqual( source.expected.find( member => member[ 0 ] === 2 )[ 1 ] );
			expect( timelines( work ) ).toStrictEqual( source.expected );
			expect( work.session.getDraft().snapshot ).toStrictEqual( source.draft.snapshot );
			expect( Object.fromEntries( records ) ).toStrictEqual( source.originalRecords );
			for ( const page of [ 2, 1, 2 ] ) {
				if ( page !== work.editor.page ) expect( await work.bridge.pdfCoordinator.turn( page ) ).toBe( true );
				const expected = source.expected.find( member => member[ 0 ] === page )[ 1 ];
				expect( work.editor.historyManager.captureTimeline() ).toStrictEqual( expected );
				expect( work.editor.historyManager.redo() ).toBe( true );
				expect( work.editor.stateManager.get( 'layers' ) ).toStrictEqual( expected.history[ expected.historyIndex + 1 ].layers );
				expect( work.editor.historyManager.undo() ).toBe( true );
			}
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it( 'retains sparse historical native IDs and authority while restoring real histories without aliases', async () => {
		const source = await interrupted( 2, true ), work = await fixture( true, 13 );
		try {
			const drafts = controller( work, 'b' );
			drafts.selectRecovery( drafts.listCandidates()[ 0 ] );
			const candidate = drafts.inspectRecovery();
			await work.bridge.restoreDraft( candidate );
			expect( timelines( work ) ).toStrictEqual( source.expected );
			expect( work.session.getDraft().snapshot ).toStrictEqual( source.draft.snapshot );
			expect( work.api.get.mock.calls.map( call => call[ 0 ] ).filter( params => !params.editorpage )
				.map( params => params.revid ) ).toStrictEqual( [ 13, 12, 13 ] );
			candidate.pdfHistory.members[ 0 ].timeline.history[ 0 ].layers.length = 0;
			expect( timelines( work ) ).toStrictEqual( source.expected );
			expect( Object.fromEntries( records ) ).toStrictEqual( source.originalRecords );
		} finally { work.close(); }
	} );
	it( 'keeps genuinely older work-only drafts compatible without inventing their missing history', async () => {
		const source = await interrupted(), work = await fixture();
		for ( const [ key, raw ] of records ) {
			const envelope = JSON.parse( raw );
			delete envelope.pdfHistory;
			records.set( key, JSON.stringify( envelope ) );
		}
		const legacy = Object.fromEntries( records );
		try {
			const drafts = controller( work, 'b' );
			drafts.selectRecovery( drafts.listCandidates()[ 0 ] );
			await work.bridge.restoreDraft( drafts.inspectRecovery() );
			expect( work.session.getDraft().snapshot ).toStrictEqual( source.draft.snapshot );
			expect( work.editor.historyManager.history ).toHaveLength( 1 );
			expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe( -1 );
			expect( Object.fromEntries( records ) ).toStrictEqual( legacy );
		} finally { work.close(); }
	} );
	const corruptions = {
		version: history => { history.version = 2; },
		owner: history => { history.owner = 'Other'; },
		base: history => { history.baseRevisionId++; },
		binding: history => { history.binding = 'v1:8:anchor'; },
		surface: history => { history.surfaceId = 'other-file'; },
		count: history => { history.pageCount++; },
		duplicate: history => { history.members.push( copy( history.members[ 0 ] ) ); },
		range: history => { history.members[ 0 ].page = 3; },
		pin: history => { history.members[ 0 ].source.sha1 = 'b'.repeat( 31 ); },
		unrelated: history => { history.members[ 0 ].surfaceId = 'other-file'; },
		cursor: history => { history.members[ 0 ].timeline.historyIndex = 99; },
		marker: history => { history.members[ 0 ].timeline.lastSaveHistoryIndex = 99; },
		empty: history => { history.members[ 0 ].timeline.history = []; },
		shape: history => { history.members[ 0 ].timeline.extra = true; },
		missing: history => { history.members = history.members.filter( member => member.page !== 2 ); },
		null: ( history, envelope ) => { envelope.pdfHistory = null; }
	};
	it.each( Object.keys( corruptions ) )( 'refuses a present %s companion without fallback or live/storage mutation', async reason => {
		await interrupted();
		const work = await fixture();
		for ( const [ key, raw ] of records ) {
			const envelope = JSON.parse( raw );
			corruptions[ reason ]( envelope.pdfHistory, envelope );
			records.set( key, JSON.stringify( envelope ) );
		}
		const source = Object.fromEntries( records );
		try {
			const drafts = controller( work, 'b' ), before = work.bridge.pdfCoordinator.witness( true );
			drafts.selectRecovery( drafts.listCandidates()[ 0 ] );
			expect( () => drafts.inspectRecovery() ).toThrow();
			expect( work.bridge.pdfCoordinator.witness( true ) ).toBe( before );
			expect( Object.fromEntries( records ) ).toStrictEqual( source );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it.each( [ 'unavailable', 'bad cursor', 'nonfinite history', 'nonfinite live', 'storage' ] )(
		'fails %s persistence without replacing an earlier draft', async reason => {
			const work = await fixture();
			const write = jest.spyOn( storage, 'setItem' );
			const drafts = controller( work, 'a' );
			try {
				work.edit( 'Keep recorded' );
				drafts.persist();
				const source = Object.fromEntries( records );
				write.mockClear();
				if ( reason === 'unavailable' ) work.editor.historyManager.batchMode = true;
				if ( reason === 'bad cursor' ) work.editor.historyManager.historyIndex = 99;
				if ( reason === 'nonfinite history' ) work.editor.historyManager.history[ 0 ].layers[ 0 ].bad = NaN;
				if ( reason === 'nonfinite live' ) work.editor.stateManager.get( 'layers' )[ 0 ].bad = Infinity;
				if ( reason === 'storage' ) write.mockImplementation( () => { throw new Error( 'Full' ); } );
				expect( () => drafts.persist() ).toThrow();
				if ( reason !== 'storage' ) expect( write ).not.toHaveBeenCalled();
				expect( Object.fromEntries( records ) ).toStrictEqual( source );
			} finally { write.mockRestore(); work.close(); }
		} );
	it.each( [ 'native edit', 'native history', 'native offscreen', 'authority edit', 'authority history',
		'authority gradient', 'native cancellation', 'authority disposal' ] )(
		'private preparation preserves complete newer work on %s', async reason => {
			await interrupted();
			const source = Object.fromEntries( records ), work = await fixture();
			try {
				const drafts = controller( work, 'b' );
				drafts.selectRecovery( drafts.listCandidates()[ 0 ] );
				const candidate = drafts.inspectRecovery(), original = work.api.get.getMockImplementation();
				let release, reached;
				const waiting = new Promise( resolve => { reached = resolve; } );
				work.api.get.mockImplementation( params => {
					if ( reason.startsWith( 'native' ) ? params.editorpage === 1 : !params.editorpage ) {
						reached();
						return new Promise( resolve => { release = () => resolve( original( params ) ); } );
					}
					return original( params );
				} );
				const pending = work.bridge.restoreDraft( candidate );
				await waiting;
				if ( reason.endsWith( 'edit' ) ) work.edit( 'Newer live edit' );
				if ( reason.endsWith( 'history' ) ) work.editor.historyManager.history[ 0 ].description = 'Changed while waiting';
				if ( reason.endsWith( 'offscreen' ) ) work.bridge.pdfCoordinator.timelines.get( 2 ).history[ 0 ].description = 'Changed map';
				if ( reason.endsWith( 'gradient' ) ) {
					work.editor.stateManager.get( 'layers' )[ 0 ].gradient = { type: 'linear', angle: 999,
						colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#0f0' } ] };
				}
				if ( reason.endsWith( 'cancellation' ) ) work.bridge.pdfCoordinator.invalidate();
				if ( reason.endsWith( 'disposal' ) ) work.bridge.pdfCoordinator.dispose();
				const before = work.bridge.pdfCoordinator.witness( true );
				release();
				await expect( pending ).rejects.toThrow();
				expect( work.bridge.pdfCoordinator.witness( true ) ).toBe( before );
				expect( Object.fromEntries( records ) ).toStrictEqual( source );
				expect( work.api.postWithToken ).not.toHaveBeenCalled();
			} finally { work.close(); }
		} );
	it( 'captures correct saved markers while a successful Save retains newer pending work', async () => {
		const work = await fixture();
		try {
			work.edit( 'Saved second' );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			work.edit( 'Saved first' );
			let complete;
			work.api.postWithToken.mockImplementationOnce( () => new Promise( resolve => { complete = resolve; } ) );
			const saving = work.bridge.save( 'Both saved' );
			work.edit( 'Newer first' );
			complete( { layerspublish: { result: 'Success', revid: 13 } } );
			expect( await saving ).toMatchObject( { revisionId: 13, dirty: true } );
			controller( work, 'a' ).persist();
			const history = JSON.parse( Array.from( records.values() )[ 0 ] ).pdfHistory;
			expect( history.members.find( member => member.page === 1 ).timeline )
				.toMatchObject( { historyIndex: 2, lastSaveHistoryIndex: 1 } );
			expect( history.members.find( member => member.page === 2 ).timeline )
				.toMatchObject( { historyIndex: 1, lastSaveHistoryIndex: 1 } );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Newer first' );
		} finally { work.close(); }
	} );
} );