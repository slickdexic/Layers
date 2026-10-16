'use strict';
const { setup, preparation, witness, wait, tickUntil, copy } = require( './fixtures/pdfCreationHost.js' );
const Ids = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const Saved = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationSavedSession.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
const fs = require( 'fs' ), path = require( 'path' ), vm = require( 'vm' );

async function savedWork( slot = true, initial = 2, active = initial, count = 3, newer = false ) {
	const work = setup( slot, initial, initial, count );
	expect( await work.host.load() ).toBe( true ); work.edit( 'Saved anchor' );
	if ( active !== initial ) { expect( await work.host.turn( active ) ).toBe( true ); work.edit( 'Saved active' ); }
	const pending = wait(); work.publisher.publish.mockReturnValueOnce( pending.promise );
	const saving = work.host.save( 'First Save', async () => {} );
	await tickUntil( () => work.publisher.publish.mock.calls.length === 1 );
	if ( newer ) work.edit( 'Newer active' ); pending.resolve( { revisionId: 13 } ); await saving;
	const sent = copy( work.host.captureDraftEnvelope().confirmation.snapshot );
	const context = page => {
		const result = preparation( slot, initial, page, count ).context;
		const member = sent.surfaces.find( surface => surface.kind === 'pdf' && surface.label === 'ABC' &&
			surface.source.fileTitle === 'File:Source.pdf' && surface.source.page === page );
		result.revisionId = 13; result.stored = Boolean( member );
		result.members = sent.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === 'ABC' && surface.source.fileTitle === 'File:Source.pdf' )
			.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ).sort( ( a, b ) => a.page - b.page );
		result.surface = member ? copy( member ) : { ...result.surface, id: Ids.surfaceId( 7, 13, 'File:Source.pdf', 'ABC', page ) };
		return result;
	};
	const dependencies = { reader: { read: jest.fn( async () => ( { revisionId: 13, snapshot: copy( sent ), future: null } ) ) },
		pdfReader: { read: jest.fn( async request => context( request.page ) ) }, publisher: { publish: jest.fn( async () => ( { revisionId: 14 } ) ) } };
	return { ...work, sent, context, dependencies };
}
function complete( work ) { return { editor: witness( work ), envelope: work.host.captureDraftEnvelope() }; }

it.each( [ [ false, 1, 2 ], [ false, 2, 1 ], [ true, 1, 2 ], [ true, 2, 1 ] ] )(
	'loads real saved anchor privately, preserves newer work and both-page history: slot=%s, initial=%s, active=%s', async ( slot, initial, active ) => {
		const work = await savedWork( slot, initial, active, 3, true ); let result;
		try {
			const before = complete( work ), displayed = [];
			work.editor.stateManager.subscribe( 'layers', layers => displayed.push( copy( layers ) ) );
			result = await work.host.handoffSavedSession( work.dependencies );
			expect( result.needsRefresh ).toBe( false ); expect( result.creationBackup ).toEqual( before.envelope );
			expect( result.bridge.session.getStatus() ).toMatchObject( { phase: 'ready', revisionId: 13, dirty: true } );
			expect( work.editor.page ).toBe( active ); expect( displayed.every( layers => layers[ 0 ].text === 'Newer active' ) ).toBe( true );
			expect( result.coordinator.captureDraftHistory().members.map( member => member.timeline ) ).toEqual( before.envelope.history.members.map( member => member.timeline ) );
			expect( result.bridge.session.getDraft().pdf.baseSnapshot ).toEqual( work.sent );
			expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Saved active' );
			expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( false );
			expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( true );
			expect( await result.coordinator.turn( initial ) ).toBe( true ); expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Saved anchor' );
			expect( work.dependencies.pdfReader.read.mock.calls[ 0 ][ 0 ].page ).toBe( initial );
			await result.bridge.session.revalidate(); expect( work.dependencies.publisher.publish ).not.toHaveBeenCalled();
		} finally { if ( result ) result.bridge.dispose(); work.close(); }
	} );
it( 'remaps only an unpublished blank/Redo page by fresh native page identity, retaining its complete branch', async () => {
	const work = setup( true, 2, 2, 3 ); let result;
	try {
		expect( await work.host.load() ).toBe( true ); work.edit( 'Anchor' );
		expect( await work.host.turn( 1 ) ).toBe( true ); work.edit( 'Unpublished Redo' ); work.editor.historyManager.undo();
		expect( await work.host.turn( 2 ) ).toBe( true );
		work.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await work.host.save( '', async () => {} );
		const sent = work.host.captureDraftEnvelope().confirmation.snapshot, before = work.host.captureDraftHistory();
		const context = page => { const result = preparation( true, 2, page, 3 ).context;
			result.revisionId = 13; result.members = [ { page: 2, surfaceId: work.native.anchorSurface.id } ];
			result.stored = page === 2; result.surface = page === 2 ? copy( sent.surfaces[ 2 ] ) :
				{ ...result.surface, id: Ids.surfaceId( 7, 13, 'File:Source.pdf', 'ABC', page ) }; return result; };
		const dependencies = { reader: { read: jest.fn( async () => ( { revisionId: 13, snapshot: copy( sent ) } ) ) },
			pdfReader: { read: jest.fn( async request => context( request.page ) ) }, publisher: work.publisher };
		result = await work.host.handoffSavedSession( dependencies );
		expect( result.remapping.find( member => member.page === 1 ) ).toEqual( { page: 1,
			previous: before.members[ 0 ].surfaceId, surfaceId: Ids.surfaceId( 7, 13, 'File:Source.pdf', 'ABC', 1 ) } );
		expect( result.coordinator.captureDraftHistory().members[ 0 ].timeline ).toEqual( before.members[ 0 ].timeline );
		expect( await result.coordinator.turn( 1 ) ).toBe( true ); expect( work.editor.historyManager.redo() ).toBe( true );
		expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Unpublished Redo' );
		expect( result.bridge.session.getDraft().snapshot.surfaces.find( member => member.source && member.source.fileTitle === 'File:Source.pdf' && member.source.page === 1 ).id )
			.toBe( Ids.surfaceId( 7, 13, 'File:Source.pdf', 'ABC', 1 ) );
	} finally { if ( result ) result.bridge.dispose(); work.close(); }
} );
it.each( [ 'wrong snapshot', 'wrong revision', 'owner', 'page ID', 'binding', 'count', 'source', 'not stored', 'inventory', 'permission' ] )(
	'refuses %s native handoff without changing current work, confirmation or histories', async reason => {
		const work = await savedWork( true, 2, 1, 3, true );
		try {
			const before = complete( work );
			if ( reason === 'wrong snapshot' ) work.dependencies.reader.read.mockImplementation( async () => ( { revisionId: 13, snapshot: { ...copy( work.sent ), future: [ 'changed' ] } } ) );
			else if ( reason === 'wrong revision' ) work.dependencies.reader.read.mockResolvedValue( { revisionId: 14, snapshot: work.sent } );
			else work.dependencies.pdfReader.read.mockImplementation( async request => {
				if ( reason === 'permission' ) throw new Error( 'permissiondenied' );
				const value = work.context( request.page );
				if ( reason === 'owner' ) value.owner = 'Other'; if ( reason === 'page ID' ) value.pageId++;
				if ( reason === 'binding' ) value.binding += 'x'; if ( reason === 'count' ) value.pageCount++;
				if ( reason === 'source' ) value.surface.source.sha1 = 'b'.repeat( 31 ); if ( reason === 'not stored' ) value.stored = false;
				if ( reason === 'inventory' ) value.members.pop(); return value;
			} );
			await expect( work.host.handoffSavedSession( work.dependencies ) ).rejects.toThrow(); expect( complete( work ) ).toEqual( before );
			expect( work.dependencies.publisher.publish ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
it.each( [ 'layers', 'history', 'canvas', 'selection', 'URL', 'destroy', 'method', 'offscreen' ] )(
	'refuses late %s changes before any handoff mutation', async reason => {
		const work = await savedWork();
		try {
			const pending = wait(), before = complete( work ); work.dependencies.pdfReader.read.mockReturnValueOnce( pending.promise );
			const handing = work.host.handoffSavedSession( work.dependencies );
			if ( reason === 'layers' ) work.edit( 'Keep late edit' );
			if ( reason === 'history' ) work.editor.historyManager.history[ 0 ].description += ' changed';
			if ( reason === 'canvas' ) work.editor.canvasManager.canvas.width++;
			if ( reason === 'selection' ) work.editor.canvasManager.selectedLayerIds = [ 'text-2' ];
			if ( reason === 'URL' ) window.history.replaceState( {}, '', '?elsewhere=1' );
			if ( reason === 'destroy' ) work.editor.stateManager.destroy();
			if ( reason === 'method' ) work.dependencies.pdfReader.read = jest.fn();
			if ( reason === 'offscreen' ) work.host.invalidate();
			const observed = witness( work ); pending.resolve( work.context( 2 ) );
			await expect( handing ).rejects.toThrow(); expect( witness( work ) ).toEqual( observed );
			expect( work.dependencies.reader.read ).not.toHaveBeenCalled();
			if ( ![ 'destroy', 'method' ].includes( reason ) ) expect( work.host.captureDraftEnvelope().confirmation ).toEqual( before.envelope.confirmation );
		} finally { work.close(); }
	} );
it( 'uses the actual saved-page read client and preserves complete geometry/background fields', async () => {
	const work = await savedWork(); let result;
	try {
		const api = { get: jest.fn( async request => ( { layersread: { editor: work.context( request.editorpage ) } } ) ) };
		work.dependencies.pdfReader = new PdfClient( api ); result = await work.host.handoffSavedSession( work.dependencies );
		expect( result.needsRefresh ).toBe( false ); expect( work.editor.canvasManager.baseHeight ).toBe( 416 );
		expect( work.editor.canvasManager.backgroundImage.height ).toBe( 417 );
		expect( api.get.mock.calls.every( call => call[ 0 ].action === 'layersread' && call[ 0 ].revid === 13 ) ).toBe( true );
	} finally { if ( result ) result.bridge.dispose(); work.close(); }
} );
it( 'uses registered dependencies when ResourceLoader supplies module.exports without relative require', () => {
	const source = fs.readFileSync( path.resolve( __dirname, '../../resources/ext.layers.editor/PageOwnedPdfCreationSavedSession.js' ), 'utf8' );
	const sandbox = { window: { Layers: { Editor: {}, Core: {} } }, module: { exports: {} }, require: jest.fn( () => { throw new Error( 'relative require refused' ); } ) };
	vm.runInNewContext( source, sandbox ); expect( typeof sandbox.module.exports.prepare ).toBe( 'function' ); expect( sandbox.require ).not.toHaveBeenCalled();
} );

it( 'continues with a genuine saved-session Save while preserving null/unknown layer values', async () => {
	const work = await savedWork( true, 2, 1, 3, true ); let result;
	try {
		result = await work.host.handoffSavedSession( work.dependencies );
		expect( ( await result.bridge.save( 'Second Save' ) ) ).toMatchObject( { phase: 'ready', revisionId: 14, dirty: false } );
		const request = work.dependencies.publisher.publish.mock.calls[ 0 ][ 0 ];
		expect( request.baseRevisionId ).toBe( 13 ); expect( request ).not.toHaveProperty( 'mainText' );
		expect( JSON.parse( request.snapshotJson ).surfaces ).toEqual( result.bridge.session.getDraft().snapshot.surfaces );
		expect( work.editor.stateManager.get( 'layers' )[ 0 ] ).toMatchObject( { text: 'Newer active', future: null, gradient: { angle: 0 } } );
	} finally { if ( result ) result.bridge.dispose(); work.close(); }
} );
it( 'retains the creation backup and every saved marker on a subsequent refused Save', async () => {
	const work = await savedWork( true, 2, 1, 3, true ); let result;
	try {
		result = await work.host.handoffSavedSession( work.dependencies );
		const backup = copy( result.creationBackup ), before = result.coordinator.captureDraftHistory();
		work.dependencies.publisher.publish.mockRejectedValue( Object.assign( new Error( 'layers-invalid-snapshot' ), { code: 'layers-invalid-snapshot' } ) );
		await expect( result.bridge.save( 'Refused' ) ).rejects.toThrow();
		expect( result.coordinator.captureDraftHistory() ).toEqual( before ); expect( result.creationBackup ).toEqual( backup );
		expect( result.bridge.session.getStatus().dirty ).toBe( true );
	} finally { if ( result ) result.bridge.dispose(); work.close(); }
} );
it.each( [ 'new optional member', 'Undo of confirmed optional member' ] )( 'retains %s while first Save is pending', async reason => {
	const work = setup( true, 2, 2, 3 ); let result;
	try {
		expect( await work.host.load() ).toBe( true ); work.edit( 'Saved anchor' );
		expect( await work.host.turn( 1 ) ).toBe( true );
		if ( reason === 'Undo of confirmed optional member' ) work.edit( 'Sent optional' );
		const pending = wait(); work.publisher.publish.mockReturnValue( pending.promise );
		const saving = work.host.save( '', async () => {} ); await tickUntil( () => work.publisher.publish.mock.calls.length === 1 );
		if ( reason === 'new optional member' ) work.edit( 'New optional' ); else work.editor.historyManager.undo();
		pending.resolve( { revisionId: 13 } ); await saving;
		const before = work.host.captureDraftEnvelope(), sent = before.confirmation.snapshot;
		const context = page => { const value = preparation( true, 2, page, 3 ).context;
			const stored = sent.surfaces.find( surface => surface.kind === 'pdf' && surface.source.fileTitle === 'File:Source.pdf' && surface.source.page === page );
			value.revisionId = 13; value.stored = Boolean( stored ); value.members = sent.surfaces.slice( 2 )
				.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ).sort( ( a, b ) => a.page - b.page );
			value.surface = stored ? copy( stored ) : { ...value.surface, id: Ids.surfaceId( 7, 13, 'File:Source.pdf', 'ABC', page ) }; return value; };
		const dependencies = { reader: { read: jest.fn( async () => ( { revisionId: 13, snapshot: copy( sent ) } ) ) },
			pdfReader: { read: jest.fn( async request => context( request.page ) ) }, publisher: work.publisher };
		result = await work.host.handoffSavedSession( dependencies );
		expect( result.needsRefresh ).toBe( false ); expect( result.bridge.session.getStatus().dirty ).toBe( true );
		expect( work.editor.stateManager.get( 'layers' ) ).toEqual( reason === 'new optional member' ? before.draft.snapshot.surfaces[ 2 ].layers : [] );
		expect( result.coordinator.captureDraftHistory().members.map( member => member.timeline ) ).toEqual( before.history.members.map( member => member.timeline ) );
		if ( reason === 'Undo of confirmed optional member' ) {
			expect( work.editor.historyManager.redo() ).toBe( true ); expect( result.bridge.session.getStatus().dirty ).toBe( false );
		}
	} finally { if ( result ) result.bridge.dispose(); work.close(); }
} );
it.each( [ 'final native read', 'decode failure', 'late decode edit', 'dependency replacement' ] )(
	'refuses %s after private preparation and preserves the creation host for retry', async reason => {
		const work = await savedWork();
		try {
			const before = complete( work );
			if ( reason === 'final native read' ) work.dependencies.pdfReader.read.mockImplementationOnce( async request => work.context( request.page ) )
				.mockImplementationOnce( async request => work.context( request.page ) ).mockRejectedValueOnce( new Error( 'permission lost' ) );
			else if ( reason === 'dependency replacement' ) work.dependencies.reader.read.mockImplementationOnce( async () => {
				work.dependencies.pdfReader = { read: jest.fn() }; return { revisionId: 13, snapshot: copy( work.sent ) };
			} );
			else {
				const pending = wait(); global.Image.prototype.decode = () => pending.promise;
				const handing = work.host.handoffSavedSession( work.dependencies );
				for ( let index = 0; index < 150 && !work.editor.canvasManager.exactStages.size; index++ ) await Promise.resolve();
				expect( work.editor.canvasManager.exactStages.size ).toBe( 1 );
				if ( reason === 'decode failure' ) pending.reject( new Error( 'decode failed' ) );
				else { work.edit( 'Late decode edit' ); pending.resolve(); }
				const observed = witness( work ); await expect( handing ).rejects.toThrow(); expect( witness( work ) ).toEqual( observed );
				expect( work.editor.canvasManager.exactStages.size ).toBe( 0 ); return;
			}
			await expect( work.host.handoffSavedSession( work.dependencies ) ).rejects.toThrow(); expect( complete( work ) ).toEqual( before );
			expect( work.dependencies.publisher.publish ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
it( 'returns the committed saved host and retained receipt on a post-commit refresh failure, holding further publication', async () => {
	const work = await savedWork(); let result;
	try {
		work.editor.canvasManager.renderLayers = () => { throw new Error( 'refresh unavailable' ); };
		result = await work.host.handoffSavedSession( work.dependencies );
		expect( result.needsRefresh ).toBe( true ); expect( result.creationBackup.confirmation.revisionId ).toBe( 13 );
		expect( result.bridge.session.getDraft().pdf.baseSnapshot ).toEqual( work.sent );
		await expect( result.bridge.save( 'No unsafe retry' ) ).rejects.toThrow();
		expect( work.dependencies.publisher.publish ).not.toHaveBeenCalled();
	} finally { if ( result ) result.bridge.dispose(); work.close(); }
} );
it.each( [ 'ready', 'uncertain', 'blocked confirmed' ] )( 'does not hand off %s work from local claims', async phase => {
	const work = phase === 'blocked confirmed' ? await savedWork() : setup();
	try {
		if ( phase !== 'blocked confirmed' ) expect( await work.host.load() ).toBe( true );
		if ( phase !== 'ready' ) work.host.blockPublication(); const before = complete( work );
		await expect( work.host.handoffSavedSession( { reader: { read: jest.fn() }, pdfReader: { read: jest.fn() }, publisher: work.publisher } ) ).rejects.toThrow();
		expect( complete( work ) ).toEqual( before );
	} finally { work.close(); }
} );
it.each( [ 'fabricated member', 'history source', 'missing history', 'sibling', 'root' ] )( 'refuses %s in a caller-supplied preparation envelope', async reason => {
	const work = await savedWork();
	try {
		const envelope = work.host.captureDraftEnvelope();
		if ( reason === 'fabricated member' ) envelope.history.members[ 0 ].surfaceId = 'fabricated';
		if ( reason === 'history source' ) envelope.history.members[ 0 ].source.sha1 = 'b'.repeat( 31 );
		if ( reason === 'missing history' ) envelope.history.members = [];
		if ( reason === 'sibling' ) envelope.draft.snapshot.surfaces[ 0 ].layers = [];
		if ( reason === 'root' ) envelope.draft.snapshot.future = 'Changed';
		const before = complete( work ); await expect( Saved.prepare( envelope, work.dependencies, () => {} ) ).rejects.toThrow();
		expect( complete( work ) ).toEqual( before );
	} finally { work.close(); }
} );

it( 'rechecks native authorization after decoding and keeps current work if that final read is refused', async () => {
	const work = await savedWork();
	try {
		const pending = wait(), before = complete( work ); global.Image.prototype.decode = () => pending.promise;
		const handing = work.host.handoffSavedSession( work.dependencies );
		for ( let index = 0; index < 150 && !work.editor.canvasManager.exactStages.size; index++ ) await Promise.resolve();
		expect( work.editor.canvasManager.exactStages.size ).toBe( 1 );
		work.dependencies.pdfReader.read.mockRejectedValue( new Error( 'source visibility changed' ) ); pending.resolve();
		await expect( handing ).rejects.toThrow(); expect( complete( work ) ).toEqual( before );
		expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
	} finally { work.close(); }
} );
it( 'refuses a parallel handoff and keeps the pending one private until its final commit', async () => {
	const work = await savedWork(); let result;
	try {
		const pending = wait(), before = complete( work ); work.dependencies.pdfReader.read.mockReturnValueOnce( pending.promise );
		const handing = work.host.handoffSavedSession( work.dependencies );
		await expect( work.host.handoffSavedSession( work.dependencies ) ).rejects.toThrow(); expect( witness( work ) ).toEqual( before.editor );
		pending.resolve( work.context( 2 ) ); result = await handing; expect( result.needsRefresh ).toBe( false );
		await expect( work.host.handoffSavedSession( work.dependencies ) ).rejects.toThrow();
	} finally { if ( result ) result.bridge.dispose(); work.close(); }
} );
it( 'retains selection and late edits made by post-commit refresh callbacks in the saved host', async () => {
	const work = await savedWork(); let result;
	try {
		work.editor.canvasManager.selectedLayerIds = [ 'text-2' ]; work.editor.canvasManager.selectedLayerId = 'text-2';
		work.editor.stateManager.set( 'selectedLayerIds', [ 'text-2' ] );
		work.editor.refreshPageControls.mockImplementationOnce( () => work.edit( 'Refresh listener edit' ) );
		result = await work.host.handoffSavedSession( work.dependencies );
		expect( result.needsRefresh ).toBe( false ); expect( work.editor.canvasManager.selectedLayerIds ).toEqual( [ 'text-2' ] );
		expect( result.bridge.session.getEditorState().layers[ 0 ].text ).toBe( 'Refresh listener edit' );
		expect( result.bridge.session.getStatus().dirty ).toBe( true );
	} finally { if ( result ) result.bridge.dispose(); work.close(); }
} );
it( 'consumes an invalid asynchronous guard refusal without treating its promise as permission', async () => {
	const work = await savedWork();
	try {
		const before = complete( work ); await expect( Saved.prepare( work.host.captureDraftEnvelope(), work.dependencies,
			() => Promise.reject( new Error( 'not a synchronous permission' ) ) ) ).rejects.toThrow();
		expect( complete( work ) ).toEqual( before ); expect( work.dependencies.pdfReader.read ).not.toHaveBeenCalled();
	} finally { work.close(); }
} );

it( 'computes later sparse-page draft associations through ResourceLoader without relative require', () => {
	const source = fs.readFileSync( path.resolve( __dirname, '../../resources/ext.layers.editor/PageOwnedEditorSession.js' ), 'utf8' );
	const sandbox = { window: { Layers: { Editor: { PageOwnedPdfWorkingSet: Ids } } }, module: { exports: {} },
		require: jest.fn( () => { throw new Error( 'relative require unavailable' ); } ) };
	vm.runInNewContext( source, sandbox );
	const record = { revisionId: 13, surface: { label: 'ABC', source: { fileTitle: 'File:Source.pdf', page: 1 } } };
	expect( sandbox.module.exports.prototype._pdfNativeId.call( { _pageId: 7 }, record ) ).toBe( Ids.surfaceId( 7, 13, 'File:Source.pdf', 'ABC', 1 ) );
	expect( sandbox.require ).not.toHaveBeenCalled();
} );

it( 'retains explicit empty first Save and its real stored anchor', async () => {
	const work = setup( false, 2, 1, 3 ); let result;
	try {
		expect( await work.host.load() ).toBe( true ); work.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await work.host.save( '', async () => {} );
		const sent = work.host.captureDraftEnvelope().confirmation.snapshot;
		const context = page => { const value = preparation( false, 2, page, 3 ).context; value.revisionId = 13;
			value.members = [ { page: 2, surfaceId: work.native.anchorSurface.id } ]; value.stored = page === 2;
			value.surface = page === 2 ? copy( sent.surfaces[ 0 ] ) : { ...value.surface, id: Ids.surfaceId( 7, 13, 'File:Source.pdf', 'ABC', page ) }; return value; };
		const dependencies = { reader: { read: jest.fn( async () => ( { revisionId: 13, snapshot: copy( sent ) } ) ) },
			pdfReader: { read: jest.fn( async request => context( request.page ) ) }, publisher: work.publisher };
		result = await work.host.handoffSavedSession( dependencies );
		expect( result.bridge.session.getStatus().dirty ).toBe( false ); expect( work.editor.page ).toBe( 1 );
		expect( result.bridge.session.getPdfStatus().anchorSurfaceId ).toBe( work.native.anchorSurface.id );
		expect( result.bridge.session.getDraft().snapshot.surfaces ).toHaveLength( 1 );
	} finally { if ( result ) result.bridge.dispose(); work.close(); }
} );
