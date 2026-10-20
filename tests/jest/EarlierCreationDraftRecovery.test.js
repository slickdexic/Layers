'use strict';
const { rebaseContext, clone, choose, tick, observed } = require( './fixtures/creationDraftRebaseContext.js' );
const { exactTextResponse } = require( './fixtures/workingCopyImportContext.js' );
const { CreationClient } = require( './fixtures/creationDraftAdmissionContext.js' );
const Bridge = require( '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
beforeEach( () => { mw.msg = key => key; } );

async function setup( kind = 'image', slot = true, alterBackup ) {
	const c = await rebaseContext( kind, slot ); await choose( c );
	if ( alterBackup ) { await alterBackup( c ); }
	c.controller.persist(); await c.drafts.reconcile( async () => 20 ); c.history.undo(); c.bridge.capture(); c.drafts.dispose();
	const previous = c.api.post.getMockImplementation(), nativeEvents = c.events, events = { proof: null, response: null, proofs: 0 };
	c.api.post.mockImplementation( async params => {
		if ( params.action !== 'layersworkingcopyimportcreationdraftrebase' ) { return previous( params ); }
		events.proofs++; if ( events.proof ) { await events.proof(); }
		const response = { layersworkingcopyimportcreationdraftrebase: clone( c.rebase ) };
		return exactTextResponse( events.response ? events.response( response ) : response, 'layersworkingcopyimportcreationdraftrebase' );
	} );
	const client = new CreationClient( c.api, c.currentSelection ), handles = c.controller.listEarlierCreationCandidates(); expect( handles ).toHaveLength( 1 );
	return { ...c, client, handle: handles[ 0 ], events, nativeEvents };
}

describe( 'inactive atomic earlier creation recovery', () => {
	test.each( [ [ 'image', true ], [ 'image', false ], [ 'slide', true ], [ 'slide', false ] ] )(
		'%s / slot %s restores native current identity, complete work and actual Undo/Redo without Save', async ( kind, slot ) => {
			const c = await setup( kind, slot );
			try {
				const before = observed( c ), raw = c.controller.store.inspectEarlierCreationCandidate( c.handle ).raw;
				const handle = await c.controller.prepareEarlierCreationRecovery( c.handle, c.client );
				expect( Bridge.isEarlierCreationDraftRecovery( handle ) ).toBe( true ); expect( observed( c ) ).toStrictEqual( before );
				const preview = c.bridge.inspectEarlierCreationDraftRecovery( handle ); expect( preview.workingState.surfaceId ).toBe( 'current' );
				expect( preview.workingState.importProvenance[ 0 ].targetSurfaceId ).toBe( 'current' );
				const result = await c.bridge.commitEarlierCreationDraftRecovery( handle );
				expect( result.editorState ).toStrictEqual( JSON.parse( raw ).editorState ); expect( c.session.getStatus().revisionId ).toBe( 20 );
				expect( c.session.getDraft().surfaceId ).toBe( 'current' ); expect( JSON.parse( c.session._savedJson ) ).toStrictEqual( c.currentBase );
				expect( c.history.history ).toHaveLength( 2 ); expect( c.history.lastSaveHistoryIndex ).toBe( -1 );
				expect( c.history.history.every( entry => entry.workingState.surfaceId === 'current' ) ).toBe( true );
				expect( c.history.undo() ).toBe( true ); expect( c.editor.layers ).toHaveLength( 0 );
				expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 0 );
				expect( c.history.redo() ).toBe( true ); expect( c.editor.layers ).toHaveLength( 3 );
				expect( c.editor.layers[ 1 ].extra ).toBeNull(); expect( c.session.captureWorkingCopyImportProvenance()[ 0 ].targetSurfaceId ).toBe( 'current' );
				expect( Array.from( c.records.entries() ) ).toStrictEqual( before.records ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
				expect( c.events.proofs ).toBe( 2 );
				await expect( c.bridge.commitEarlierCreationDraftRecovery( handle ) ).rejects.toThrow();
			} finally { c.dispose(); }
		} );
	test( 'an undone Import retained by Redo is revalidated and remapped even when current citations are empty', async () => {
		const c = await setup( 'slide', true, async row => { row.history.undo(); } );
		try {
			const handle = await c.controller.prepareEarlierCreationRecovery( c.handle, c.client ); c.api.post.mockClear();
			await c.bridge.commitEarlierCreationDraftRecovery( handle ); expect( c.editor.layers ).toHaveLength( 0 );
			expect( c.api.post.mock.calls.some( ( [ p ] ) => p.action === 'layersworkingcopyimportcreationread' && p.sourcesurface === 'source' ) ).toBe( true );
			expect( c.history.redo() ).toBe( true ); expect( c.session.captureWorkingCopyImportProvenance()[ 0 ].targetSurfaceId ).toBe( 'current' );
		} finally { c.dispose(); }
	} );
	test( 'pending edits become a recoverable step and retain complete null, unknown and reading-order data', async () => {
		const c = await setup( 'image', true, async row => { row.store.state.layers[ 1 ].text = 'Pending edits'; } );
		try {
			const handle = await c.controller.prepareEarlierCreationRecovery( c.handle, c.client );
			await c.bridge.commitEarlierCreationDraftRecovery( handle );
			expect( c.editor.layers[ 1 ].text ).toBe( 'Pending edits' ); expect( c.history.history ).toHaveLength( 3 );
			expect( c.history.undo() ).toBe( true ); expect( c.editor.layers[ 1 ].text ).toBe( 'first' );
			expect( c.history.redo() ).toBe( true ); expect( c.editor.layers[ 1 ].legacy.list ).toEqual( [ null, false, 0, 1.25, 'Legacy 世界' ] );
		} finally { c.dispose(); }
	} );
	test.each( [ 'layers', 'Undo', 'selection', 'configuration', 'method', 'lock', 'queue', 'destroyed', 'backup', 'base' ] )(
		'late %s changes during source revalidation survive complete refusal', async boundary => {
			const c = await setup();
			try {
				const handle = await c.controller.prepareEarlierCreationRecovery( c.handle, c.client ); let finish;
				c.nativeEvents.source = () => new Promise( resolve => { finish = resolve; } );
				const pending = c.bridge.commitEarlierCreationDraftRecovery( handle ); await tick(); expect( finish ).toEqual( expect.any( Function ) );
				if ( boundary === 'layers' ) { c.store.set( 'layers', c.editor.layers.concat( { id: 'late', type: 'text', text: 'Keep' } ) ); }
				if ( boundary === 'Undo' ) { c.history.history[ 0 ].layers.push( { id: 'late', type: 'text' } ); }
				if ( boundary === 'selection' ) { c.editor.canvasManager.selectedLayerIds.push( 'late' ); }
				if ( boundary === 'configuration' ) { c.editor.config.pageOwned.surfaceId = 'later'; }
				if ( boundary === 'method' ) { c.history.redo = () => false; }
				if ( boundary === 'lock' ) { c.store.isLocked = true; }
				if ( boundary === 'queue' ) { c.store.pendingOperations.push( { retained: true } ); }
				if ( boundary === 'destroyed' ) { c.store.destroy(); }
				if ( boundary === 'base' ) { c.session._savedJson = '{"schemaVersion":1,"surfaces":[],"late":true}'; }
				if ( boundary === 'backup' ) { const record = c.controller.store.inspectEarlierCreationCandidate( c.handle ); const key = Array.from( c.records.keys() ).find( k => c.records.get( k ) === record.raw ); c.records.set( key, record.raw + ' ' ); }
				const before = observed( c ); finish(); await expect( pending ).rejects.toThrow(); expect( observed( c ) ).toStrictEqual( before );
				expect( c.api.postWithToken ).not.toHaveBeenCalled();
			} finally { c.dispose(); }
		} );
	test.each( [ 'changedBase', 'pin', 'hiddenSource', 'sourceIdentity', 'finalProof', 'lateFinalEdit' ] )( '%s refuses before any model changes', async boundary => {
		const c = await setup();
		try {
			const handle = await c.controller.prepareEarlierCreationRecovery( c.handle, c.client );
			c.nativeEvents.response = response => {
				const read = response.layersworkingcopyimportcreationread;
				if ( read && boundary === 'changedBase' ) { read.creation.baseBundle.snapshot.metadata.newer.push( 'changed' ); }
				if ( read && boundary === 'pin' ) { read.creation.newSurface.source.sha1 = 'changed'; }
				if ( read && boundary === 'hiddenSource' ) { throw new Error( 'Hidden source' ); }
				if ( read && boundary === 'sourceIdentity' ) { read.source.revisionId++; }
				return response;
			};
			if ( boundary === 'finalProof' ) { c.events.response = response => { response.layersworkingcopyimportcreationdraftrebase.creation.baseBundle.extra.push( 'changed' ); return response; }; }
			if ( boundary === 'lateFinalEdit' ) { c.events.proof = async () => { c.store.set( 'layers', [ { id: 'last', type: 'text', text: 'Keep last edit' } ] ); }; }
			const before = observed( c ); await expect( c.bridge.commitEarlierCreationDraftRecovery( handle ) ).rejects.toThrow();
			if ( boundary === 'lateFinalEdit' ) { expect( c.editor.layers[ 0 ].text ).toBe( 'Keep last edit' ); }
			else { expect( observed( c ) ).toStrictEqual( before ); }
			expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test.each( [ 'identity', 'checkpointId', 'citationId', 'missingClaims', 'savedMarker', 'rename', 'pdf', 'version' ] )( 'unproven %s backup is retained and refused', async boundary => {
		const c = await setup();
		try {
			const record = c.controller.store.inspectEarlierCreationCandidate( c.handle ), envelope = JSON.parse( record.raw );
			if ( boundary === 'identity' ) { envelope.workingCopyDraft.identity.pageId++; }
			if ( boundary === 'checkpointId' ) { envelope.workingCopyDraft.timeline.history[ 0 ].workingState.surfaceId = 'foreign'; }
			if ( boundary === 'citationId' ) { envelope.workingCopyDraft.workingState.importProvenance[ 0 ].targetSurfaceId = 'foreign'; }
			if ( boundary === 'missingClaims' ) { delete envelope.workingCopyDraft.timeline.history[ 1 ].workingState.importProvenance; }
			if ( boundary === 'savedMarker' ) { envelope.workingCopyDraft.timeline.lastSaveHistoryIndex = 0; }
			if ( boundary === 'rename' ) { envelope.label = 'Unproved rename'; }
			if ( boundary === 'pdf' ) { envelope.pdfDraft = null; }
			if ( boundary === 'version' ) { envelope.workingCopyDraft.version = 1; }
			const key = Array.from( c.records.keys() ).find( k => c.records.get( k ) === record.raw ); c.records.set( key, JSON.stringify( envelope ) );
			const candidate = c.controller.listEarlierCreationCandidates()[ 0 ], before = observed( c );
			await expect( c.controller.prepareEarlierCreationRecovery( candidate, c.client ) ).rejects.toThrow(); expect( observed( c ) ).toStrictEqual( before );
		} finally { c.dispose(); }
	} );
	test.each( [ 'saving', 'conflict', 'uncertain' ] )( '%s backups restore work while retaining the publication hold', async phase => {
		const c = await setup();
		try {
			const record = c.controller.store.inspectEarlierCreationCandidate( c.handle ), envelope = JSON.parse( record.raw ); envelope.phase = phase;
			const key = Array.from( c.records.keys() ).find( k => c.records.get( k ) === record.raw ); c.records.set( key, JSON.stringify( envelope ) );
			const handle = await c.controller.prepareEarlierCreationRecovery( c.controller.listEarlierCreationCandidates()[ 0 ], c.client );
			await c.bridge.commitEarlierCreationDraftRecovery( handle ); expect( c.editor.layers ).toHaveLength( 3 ); expect( c.session.getStatus().phase ).toBe( 'conflict' );
			await expect( c.bridge.save() ).rejects.toThrow(); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test( 'release is no-write and closes the plan; forged and another bridge’s handles refuse', async () => {
		const c = await setup(), other = await setup( 'slide', false );
		try {
			const before = observed( c ), handle = await c.controller.prepareEarlierCreationRecovery( c.handle, c.client );
			await expect( other.bridge.commitEarlierCreationDraftRecovery( handle ) ).rejects.toThrow();
			await expect( c.bridge.commitEarlierCreationDraftRecovery( Object.freeze( {} ) ) ).rejects.toThrow();
			c.bridge.releaseEarlierCreationDraftRecovery( handle ); expect( observed( c ) ).toStrictEqual( before );
			await expect( c.bridge.commitEarlierCreationDraftRecovery( handle ) ).rejects.toThrow();
		} finally { c.dispose(); other.dispose(); }
	} );
	test( 'the shared recovery record refuses competing legacy commit and release while a native read is pending', async () => {
		const c = await setup(); let finish, pending;
		try {
			const original = c.bridge.prepareWorkingCopyDraftRecovery; let inner;
			c.bridge.prepareWorkingCopyDraftRecovery = function ( candidate ) { inner = original.call( this, candidate ); return inner; };
			const handle = await c.controller.prepareEarlierCreationRecovery( c.handle, c.client ); let reads = 0;
			c.nativeEvents.source = () => ++reads === 1 ? new Promise( resolve => { finish = resolve; } ) : Promise.resolve();
			pending = c.bridge.commitEarlierCreationDraftRecovery( handle ); await tick(); expect( finish ).toEqual( expect.any( Function ) );
			await expect( c.bridge.commitWorkingCopyDraftRecovery( inner ) ).rejects.toThrow();
			expect( () => c.bridge.releaseWorkingCopyDraftRecovery( inner ) ).toThrow();
			expect( () => c.bridge.releaseEarlierCreationDraftRecovery( handle ) ).toThrow();
			finish(); await pending; expect( c.editor.layers ).toHaveLength( 3 );
		} finally { if ( finish ) { finish(); } if ( pending ) { await pending.catch( () => {} ); } c.dispose(); }
	} );
	test.each( [ 'image', 'slide' ] )( '%s recovered work uses existing first-Save admission only when Save is explicit', async kind => {
		const c = await setup( kind, true );
		try {
			const handle = await c.controller.prepareEarlierCreationRecovery( c.handle, c.client ); await c.bridge.commitEarlierCreationDraftRecovery( handle );
			expect( c.api.postWithToken ).not.toHaveBeenCalled(); await c.bridge.save( 'Explicit recovered work Save' );
			expect( c.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			const params = c.api.postWithToken.mock.calls[ 0 ][ 1 ]; expect( params.baserevid ).toBe( 20 ); expect( params.targetsurface ).toBe( 'current' );
			expect( JSON.parse( params.importsources ) ).toEqual( [ { sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source' } ] );
			expect( JSON.parse( params.data ).surfaces.find( row => row.id === 'other' ) ).toEqual( c.currentBase.surfaces[ 0 ] );
			expect( c.session.getStatus() ).toMatchObject( { phase: 'ready', revisionId: 21, dirty: false } );
		} finally { c.dispose(); }
	} );
} );
