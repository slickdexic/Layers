'use strict';
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );
const deferred = () => {
	let resolve, reject;
	const promise = new Promise( ( done, fail ) => { resolve = done; reject = fail; } );
	return { promise, resolve, reject };
};
const records = new Map();
let writeFailure = false;
const storage = { getItem: key => records.get( key ) ?? null,
	setItem: ( key, value ) => { if ( writeFailure ) throw new Error( 'Quota exceeded' ); records.set( key, value ); },
	removeItem: key => records.delete( key ),
	key: index => Array.from( records.keys() )[ index ] ?? null, get length() { return records.size; } };
const stored = () => Object.fromEntries( Array.from( records ).sort( ( left, right ) => left[ 0 ].localeCompare( right[ 0 ] ) ) );
const controller = ( work, writer = 'b' ) => new Controller( work.bridge,
	new Store( storage, writer.repeat( 32 ) ), new Adapter(), { wiki: 'wiki', user: '7' } );
const ui = accept => ( { chooseDraft: jest.fn().mockResolvedValue( 0 ),
	confirmRecovery: jest.fn().mockResolvedValue( accept ), notifyBlocked: jest.fn(), notifyFailure: jest.fn() } );
const witness = work => ( { complete: work.bridge.pdfCoordinator.witness( true ), status: work.session.getStatus(),
	selection: work.session.getPdfStatus(), background: work.editor.canvasManager.backgroundImage,
	canvas: [ work.editor.canvasManager.canvas.width, work.editor.canvasManager.canvas.height ], source: stored() } );
function pauseRead( work, predicate = params => !params.editorpage ) {
	const entered = deferred(), response = deferred(), original = work.api.get.getMockImplementation();
	let claimed = false;
	work.api.get.mockImplementation( params => {
		if ( !claimed && predicate( params ) ) {
			claimed = true;
			entered.resolve( params );
			return response.promise;
		}
		return original( params );
	} );
	return { entered: entered.promise, release: async override => {
		const params = await entered.promise;
		response.resolve( override || await original( params ) );
	}, reject: response.reject };
}
async function recoveredDraft( oldId = false ) {
	const work = await fixture();
	try {
		await work.bridge.pdfCoordinator.turn( 1 );
		work.edit( 'Recovered off-screen' );
		const layers = work.editor.stateManager.get( 'layers' );
		layers[ 0 ].gradient = { type: 'linear', angle: 999,
			colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#0f0' } ] };
		layers[ 0 ].unknown = { pending: [ null, false, -17 ] };
		work.editor.stateManager.set( 'layers', layers );
		if ( oldId ) await work.bridge.reconcile( 13 );
		await work.bridge.pdfCoordinator.turn( 2 );
		work.edit( 'Recovered selected' );
		controller( work, 'a' ).persist();
		return work.session.getDraft();
	} finally { work.close(); }
}
const contexts = work => [ work.context( 2 ), work.context( 1 ) ];
function inspected( work ) {
	const drafts = controller( work );
	drafts.selectRecovery( drafts.listCandidates()[ 0 ] );
	return drafts.inspectRecovery();
}
describe( 'Authorized PDF recovery transactions through actual components', () => {
	beforeEach( () => { records.clear(); writeFailure = false; } );
	it.each( [ false, true ] )( 'preparation never installs any working restore plan, old-ID=%s', async oldId => {
		const draft = await recoveredDraft( oldId ), work = await fixture( true, oldId ? 13 : 12 );
		try {
			const before = witness( work ), gate = pauseRead( work );
			const pending = work.session.preparePdfDraftWithHistory( draft, contexts( work ) );
			await gate.entered;
			expect( witness( work ) ).toStrictEqual( before );
			await gate.release();
			const handle = await pending;
			expect( witness( work ) ).toStrictEqual( before );
			expect( Object.keys( handle ) ).toStrictEqual( [] );
			expect( JSON.stringify( handle ) ).toBe( '{}' );
			expect( Object.isFrozen( handle ) ).toBe( true );
			const state = work.session.commitPreparedPdfDraft( handle );
			expect( state ).not.toBeInstanceOf( Promise );
			expect( work.session.getDraft().snapshot ).toStrictEqual( draft.snapshot );
			state.layers[ 0 ].text = 'Returned-state mutation';
			state.canvas.width = 999;
			expect( work.session.getDraft().snapshot ).toStrictEqual( draft.snapshot );
			expect( () => work.session.commitPreparedPdfDraft( handle ) ).toThrow();
			work.session.cancelPreparedPdfDraft( handle );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it( 'copies input and contexts before authorization without exposing a mutable plan', async () => {
		const draft = await recoveredDraft(), expected = copy( draft ), work = await fixture();
		try {
			const pages = contexts( work ), gate = pauseRead( work );
			const pending = work.session.preparePdfDraftWithHistory( draft, pages );
			await gate.entered;
			draft.snapshot.surfaces.find( member => member.id === 'anchor' ).layers[ 0 ].text = 'Tampered';
			pages[ 0 ].surface.source.sha1 = 'b'.repeat( 31 );
			pages[ 1 ].surface.canvas.width = 777;
			await gate.release();
			work.session.commitPreparedPdfDraft( await pending );
			expect( work.session.getDraft().snapshot ).toStrictEqual( expected.snapshot );
		} finally { work.close(); }
	} );
	it.each( [ 'during authorization', 'after preparation' ] )( 'stale whole-work guard preserves newer complete work %s', async boundary => {
		const draft = await recoveredDraft(), work = await fixture( false );
		try {
			const storedDraft = work.session.getDraft();
			storedDraft.snapshot.surfaces.find( member => member.id === 'stored-first' ).layers =
				draft.snapshot.surfaces.find( member => member.source.page === 1 && member.source.fileTitle === 'File:Example.pdf' ).layers;
			storedDraft.snapshot.surfaces.find( member => member.id === 'anchor' ).layers = draft.snapshot.surfaces[ 0 ].layers;
			const gate = pauseRead( work );
			const pending = work.session.preparePdfDraftWithHistory( storedDraft, contexts( work ) );
			await gate.entered;
			let handle;
			if ( boundary === 'after preparation' ) { await gate.release(); handle = await pending; }
			work.edit( 'Newer selected' );
			const layers = work.editor.stateManager.get( 'layers' );
			layers[ 0 ].gradient = { type: 'linear', angle: 999, colors: [
				{ offset: 0, color: '#f00' }, { offset: 1, color: '#0f0' } ] };
			work.editor.stateManager.set( 'layers', layers );
			const before = witness( work );
			if ( handle ) expect( () => work.session.commitPreparedPdfDraft( handle ) ).toThrow();
			else { await gate.release(); await expect( pending ).rejects.toThrow(); }
			expect( witness( work ) ).toStrictEqual( before );
			work.session.cancelPreparedPdfDraft( handle );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it.each( [ 'forged', 'serialized', 'foreign', 'cancelled', 'consumed' ] )( 'refuses %s handles without cancelling an owned plan', async kind => {
		const draft = await recoveredDraft(), work = await fixture();
		let other;
		try {
			const handle = await work.session.preparePdfDraftWithHistory( draft, contexts( work ) );
			let invalid = {};
			if ( kind === 'serialized' ) invalid = JSON.parse( JSON.stringify( handle ) );
			if ( kind === 'foreign' ) {
				other = await fixture();
				invalid = await other.session.preparePdfDraftWithHistory( draft, contexts( other ) );
			}
			if ( kind === 'cancelled' ) { invalid = handle; work.session.cancelPreparedPdfDraft( handle ); }
			if ( kind === 'consumed' ) { invalid = handle; work.session.commitPreparedPdfDraft( handle ); }
			const before = witness( work );
			expect( () => work.session.commitPreparedPdfDraft( invalid ) ).toThrow();
			work.session.cancelPreparedPdfDraft( invalid );
			expect( witness( work ) ).toStrictEqual( before );
			if ( [ 'forged', 'serialized', 'foreign' ].includes( kind ) ) {
				work.session.commitPreparedPdfDraft( handle );
				expect( work.session.getDraft().snapshot ).toStrictEqual( draft.snapshot );
			}
			if ( other ) other.session.cancelPreparedPdfDraft( invalid );
		} finally { if ( other ) other.close(); work.close(); }
	} );
	it( 'cancelled pending authorization cannot install later or release a newer reservation', async () => {
		const draft = await recoveredDraft(), work = await fixture();
		try {
			const gate = pauseRead( work );
			const first = work.session.preparePdfDraftWithHistory( draft, contexts( work ) );
			const refusal = expect( first ).rejects.toThrow();
			await gate.entered;
			work.session.cancelPreparedPdfDraft( first );
			const second = await work.session.preparePdfDraftWithHistory( draft, contexts( work ) );
			const before = witness( work );
			await gate.release();
			await refusal;
			expect( witness( work ) ).toStrictEqual( before );
			work.session.cancelPreparedPdfDraft( first );
			work.session.commitPreparedPdfDraft( second );
			expect( work.session.getDraft().snapshot ).toStrictEqual( draft.snapshot );
		} finally { work.close(); }
	} );
	it( 'rejects duplicate preparation and conflicting session operations without discarding edits', async () => {
		const draft = await recoveredDraft(), work = await fixture();
		try {
			const handle = await work.session.preparePdfDraftWithHistory( draft, contexts( work ) );
			const before = witness( work );
			await expect( work.session.preparePdfDraftWithHistory( draft, contexts( work ) ) ).rejects.toThrow();
			expect( () => work.session.rename( 'Late name' ) ).toThrow();
			expect( () => work.session.selectPdfPage( work.context( 1 ) ) ).toThrow();
			await expect( work.session.save() ).rejects.toThrow();
			await expect( work.session.reconcile( 13 ) ).rejects.toThrow();
			expect( witness( work ) ).toStrictEqual( before );
			work.session.cancelPreparedPdfDraft( handle );
			work.edit( 'Still editable' );
			expect( work.session.getEditorState().layers[ 0 ].text ).toBe( 'Still editable' );
		} finally { work.close(); }
	} );
	it.each( [ 'selection', 'rename', 'reconcile', 'save', 'blocked' ] )( 'refuses a handle after %s invalidation', async change => {
		const draft = await recoveredDraft(), work = await fixture();
		try {
			const handle = await work.session.preparePdfDraftWithHistory( draft, contexts( work ) );
			if ( change !== 'blocked' ) work.session.cancelPreparedPdfDraft( handle );
			if ( change === 'selection' ) work.session.selectPdfPage( work.context( 1 ) );
			if ( change === 'rename' ) work.bridge.rename( 'Newer name' );
			if ( change === 'reconcile' ) await work.bridge.reconcile( 13 );
			if ( change === 'save' ) await work.bridge.save( 'Explicit test transport save' );
			if ( change === 'blocked' ) work.session.blockPublication();
			const before = witness( work );
			expect( () => work.session.commitPreparedPdfDraft( handle ) ).toThrow();
			expect( witness( work ) ).toStrictEqual( before );
			work.session.cancelPreparedPdfDraft( handle );
		} finally { work.close(); }
	} );
	it.each( [ 'before', 'after' ] )( 'disposal %s preparation invalidates completion and handles', async boundary => {
		const draft = await recoveredDraft(), work = await fixture();
		try {
			const gate = pauseRead( work ), pending = work.session.preparePdfDraftWithHistory( draft, contexts( work ) );
			await gate.entered;
			let handle;
			if ( boundary === 'after' ) { await gate.release(); handle = await pending; }
			work.session.dispose();
			if ( handle ) expect( () => work.session.commitPreparedPdfDraft( handle ) ).toThrow();
			else { await gate.release(); await expect( pending ).rejects.toThrow(); }
			expect( work.session.getStatus().phase ).toBe( 'disposed' );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it.each( [ 'denied', 'suppressed', 'wrong base', 'wrong snapshot' ] )( 'refuses %s authorization with complete preservation', async kind => {
		const draft = await recoveredDraft(), work = await fixture();
		try {
			const before = witness( work ), gate = pauseRead( work );
			const pending = work.session.preparePdfDraftWithHistory( draft, contexts( work ) );
			await gate.entered;
			let response = { error: { code: kind === 'suppressed' ? 'revision-hidden' : 'permissiondenied' } };
			if ( kind.startsWith( 'wrong' ) ) {
				const snapshot = copy( work.base );
				if ( kind === 'wrong snapshot' ) snapshot.metadata.unknown.push( 'Changed base' );
				response = { layersread: { revisionId: kind === 'wrong base' ? 13 : 12, snapshot, sourceGeometry: [] } };
			}
			await gate.release( response );
			await expect( pending ).rejects.toThrow();
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it.each( [ 'selected edit', 'off-screen edit', 'history', 'geometry', 'background', 'URL', 'stage', 'batch', 'blocked' ] )(
		'coordinator refuses final-boundary %s and preserves the whole witness', async change => {
			await recoveredDraft();
			const work = await fixture(), candidate = inspected( work );
			try {
				const gate = pauseRead( work );
				const pending = work.bridge.restoreDraft( candidate );
				const refusal = expect( pending ).rejects.toThrow();
				await gate.entered;
				if ( change === 'selected edit' ) work.edit( 'Newer editor work' );
				if ( change === 'off-screen edit' ) {
					const next = work.session.getEditorState();
					next.canvas.unknown = { finite: [ false, 777 ] };
					work.session.update( next );
				}
				if ( change === 'history' ) work.editor.historyManager.history[ 0 ].unknown = { keep: 'timeline' };
				if ( change === 'geometry' ) work.editor.canvasManager.baseWidth = 777;
				if ( change === 'background' ) work.editor.canvasManager.backgroundImage = { newer: true };
				if ( change === 'URL' ) window.history.replaceState( {}, '', '?page=2&newer=1' );
				if ( change === 'stage' ) work.bridge.pdfCoordinator.stage.dispose();
				if ( change === 'blocked' ) work.session.blockPublication();
				let before;
				if ( change === 'batch' ) {
					before = witness( work );
					work.editor.historyManager.batchMode = true;
				} else before = witness( work );
				await gate.release();
				await refusal;
				if ( change === 'batch' ) {
					expect( work.editor.historyManager.batchMode ).toBe( true );
					work.editor.historyManager.batchMode = false;
				}
				expect( witness( work ) ).toStrictEqual( before );
				expect( work.api.postWithToken ).not.toHaveBeenCalled();
				expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
			} finally { work.close(); }
		} );
	it.each( [ 'supersede', 'lifecycle dispose', 'close', 'coordinator dispose' ] )( 'cancels owned pending recovery on %s before a late read', async action => {
		await recoveredDraft();
		const work = await fixture(), drafts = new Lifecycle( work.bridge, controller( work ), ui( true ) );
		try {
			const gate = pauseRead( work ), pending = drafts.initialize();
			const refusal = expect( pending ).rejects.toThrow();
			await gate.entered;
			if ( action === 'lifecycle dispose' ) drafts.dispose();
			if ( action === 'close' ) expect( drafts.finalizeClose( true ) ).toBe( true );
			if ( action === 'coordinator dispose' ) work.bridge.pdfCoordinator.dispose();
			if ( action === 'supersede' ) {
				await work.bridge.restoreDraft( inspected( work ) );
			}
			const before = witness( work );
			await gate.release();
			await refusal;
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
			expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
			if ( action === 'supersede' ) expect( work.bridge.pdfCoordinator.recovering ).toBe( false );
		} finally { drafts.dispose(); work.close(); }
	} );
	it( 'old selected-page PDF records recover explicitly without rewriting the independent source', async () => {
		await recoveredDraft();
		for ( const [ key, raw ] of records ) { const envelope = JSON.parse( raw ); delete envelope.pdfDraft; delete envelope.pdfHistory; records.set( key, JSON.stringify( envelope ) ); }
		const source = stored(), work = await fixture(), controls = ui( true );
		const drafts = new Lifecycle( work.bridge, controller( work ), controls );
		try {
			await drafts.initialize();
			expect( controls.confirmRecovery ).toHaveBeenCalledTimes( 1 );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Recovered selected' );
			expect( work.session.getDraft().snapshot.surfaces ).toHaveLength( work.base.surfaces.length );
			expect( stored() ).toStrictEqual( source );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { drafts.dispose(); work.close(); }
	} );
	it( 'cancelled confirmation preserves every page/source and keeps the intentional publication hold', async () => {
		await recoveredDraft();
		const work = await fixture(), drafts = new Lifecycle( work.bridge, controller( work ), ui( false ) );
		try {
			const before = witness( work );
			await drafts.initialize();
			expect( { ...witness( work ), status: before.status } ).toStrictEqual( before );
			expect( work.session.getStatus().phase ).toBe( 'uncertain' );
			expect( drafts.ready ).toBe( false );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { drafts.dispose(); work.close(); }
	} );
	it( 'storage failure preserves newer complete work and the independent source for explicit retry', async () => {
		await recoveredDraft();
		const source = stored(), work = await fixture(), controls = ui( true );
		const drafts = new Lifecycle( work.bridge, controller( work ), controls );
		try {
			await drafts.initialize();
			work.edit( 'Newer pending gradient' );
			const layers = work.editor.stateManager.get( 'layers' );
			layers[ 0 ].gradient = { type: 'radial', angle: 999, colors: [
				{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ] };
			work.editor.stateManager.set( 'layers', layers );
			const before = witness( work );
			writeFailure = true;
			expect( drafts.flush() ).toBe( false );
			expect( witness( work ) ).toStrictEqual( before );
			expect( stored() ).toStrictEqual( source );
			writeFailure = false;
			expect( drafts.flush() ).toBe( true );
			for ( const [ key, raw ] of Object.entries( source ) ) expect( records.get( key ) ).toBe( raw );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { writeFailure = false; drafts.dispose(); work.close(); }
	} );
	it.each( [ 'save', 'reconcile' ] )( 'invalidates pending recovery for explicit %s and retains newer gradients', async action => {
		await recoveredDraft();
		const work = await fixture();
		try {
			const gate = pauseRead( work );
			const recovery = work.bridge.restoreDraft( inspected( work ) );
			const refusal = expect( recovery ).rejects.toThrow();
			await gate.entered;
			if ( action === 'save' ) {
				const published = deferred(), entered = deferred();
				const publish = work.api.postWithToken.getMockImplementation();
				work.api.postWithToken.mockImplementationOnce( ( ...args ) => {
					entered.resolve( args );
					return published.promise;
				} );
				const saving = work.bridge.save( 'One deliberate transport save' );
				const args = await entered.promise;
				const layers = copy( work.editor.stateManager.get( 'layers' ) );
				layers[ 0 ].gradient = { type: 'linear', angle: 999, colors: [
					{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ] };
				work.editor.stateManager.set( 'layers', layers );
				const before = witness( work );
				await gate.release();
				await refusal;
				expect( witness( work ) ).toStrictEqual( before );
				published.resolve( await publish( ...args ) );
				await saving;
				expect( work.session.getEditorState().layers[ 0 ].gradient.angle ).toBe( 999 );
				expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( true );
				expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			} else {
				await work.bridge.reconcile( 13 );
				const before = witness( work );
				await gate.release();
				await refusal;
				expect( witness( work ) ).toStrictEqual( before );
				expect( work.api.postWithToken ).not.toHaveBeenCalled();
			}
		} finally { work.close(); }
	} );
	it.each( [ 'dimensions', 'URL' ] )( 'rechecks exact staged %s after authorization before installing any page', async field => {
		await recoveredDraft();
		const work = await fixture();
		try {
			await work.bridge.pdfCoordinator.turn( 1 );
			work.edit( 'Newer off-screen work to preserve' );
			await work.bridge.pdfCoordinator.turn( 2 );
			const gate = pauseRead( work ), pending = work.bridge.restoreDraft( inspected( work ) );
			const refusal = expect( pending ).rejects.toThrow();
			await gate.entered;
			const stage = work.bridge.pdfCoordinator.stage;
			if ( field === 'dimensions' ) stage.info.width = 777;
			else stage.url = '/wrong-exact-stage';
			const before = witness( work );
			await gate.release();
			await refusal;
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it.each( [ 'edit', 'cancel' ] )( 'preserves complete work on %s while exact image decode is stalled', async action => {
		await recoveredDraft();
		const work = await fixture(), Image = global.Image, decoded = deferred(), entered = deferred();
		global.Image = class extends Image { decode() { entered.resolve(); return decoded.promise; } };
		try {
			const pending = work.bridge.restoreDraft( inspected( work ) ), refusal = expect( pending ).rejects.toThrow();
			await entered.promise;
			if ( action === 'edit' ) work.edit( 'Newer work during decode' );
			else work.bridge.pdfCoordinator.invalidate();
			const before = witness( work );
			decoded.resolve();
			await refusal;
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { decoded.resolve(); global.Image = Image; work.close(); }
	} );
} );