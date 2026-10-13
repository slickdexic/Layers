'use strict';
const { rebaseContext, clone, choose, tick, observed } = require( './fixtures/creationRebaseContext.js' );
describe( 'creation Import conflict reconciliation', () => {
	test.each( [ [ 'slide', false ], [ 'slide', true ], [ 'image', false ], [ 'image', true ] ] )(
		'preserves imported work and Undo at the new native base: %s / slot %s', async ( kind, siblings ) => {
			const c = await rebaseContext( kind, siblings );
			try {
				await choose( c );
				const before = clone( c.session.getEditorState() ), timeline = clone( c.history.captureTimeline() );
				expect( before.layers ).toHaveLength( 3 );
				const oldRecords = clone( Array.from( c.records.entries() ) );
				const result = await c.drafts.reconcile( async () => 20 );
				expect( result ).toMatchObject( { revisionId: 20, phase: 'ready', dirty: true } );
				expect( c.session.getDraft().surfaceId ).toBe( 'current' );
				expect( c.session.getEditorState() ).toStrictEqual( before );
				expect( JSON.parse( c.session._savedJson ) ).toStrictEqual( c.currentBase );
				expect( c.history.historyIndex ).toBe( timeline.historyIndex );
				expect( c.history.lastSaveHistoryIndex ).toBe( -1 );
				expect( c.session.captureWorkingCopyImportProvenance()[ 0 ].targetSurfaceId ).toBe( 'current' );
				oldRecords.forEach( ( [ key, value ] ) => expect( c.records.get( key ) ).toBe( value ) );
				expect( Array.from( c.records.values() ).some( value => value.includes( 'current' ) && value.includes( 'importProvenance' ) ) ).toBe( true );
				c.history.undo(); expect( c.editor.layers ).toHaveLength( 0 );
				c.history.redo(); expect( c.session.getEditorState() ).toStrictEqual( before );
				await c.drafts.save( 'Newer base' );
				expect( c.session.getStatus() ).toMatchObject( { revisionId: 21, dirty: false } );
				expect( c.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			} finally { c.dispose(); }
		} );
	const refusals = {
		originOwner: data => { data.origin.pageId = 8; },
		originRevision: data => { data.origin.revisionId = 11; },
		originId: data => { data.origin.surfaceId = 'invented'; },
		originOffset: data => { data.origin.selection.start++; },
		originText: data => { data.origin.selection.expected += ' '; },
		originExtra: data => { data.origin.assumed = true; },
		currentOwner: data => { data.creation.target.owner = 'Other Page'; },
		currentPage: data => { data.creation.target.pageId = 8; },
		currentRevision: data => { data.creation.target.revisionId++; },
		currentOldId: data => { data.creation.target.surfaceId = data.creation.newSurface.id = 'target'; },
		currentOffset: data => { data.creation.selection.start = -1; },
		currentText: data => { data.creation.selection.expected += ' '; },
		populatedAdmission: data => { data.creation.newSurface.layers = [ { id: 'stored', type: 'text' } ]; },
		kind: data => { data.creation.newSurface.kind = 'pdf'; },
		name: data => { data.creation.newSurface.label = 'Other'; },
		pin: data => { data.creation.newSurface.source.sha1 = 'changed'; },
		geometry: data => { data.creation.newSurface.canvas.width++; },
		oldStoredCollision: data => { data.creation.baseBundle.snapshot.surfaces[ 0 ].id = 'target'; },
		newStoredCollision: data => { data.creation.baseBundle.snapshot.surfaces[ 0 ].id = 'current'; },
		fileNameCollision: data => { data.creation.baseBundle.snapshot.surfaces[ 0 ].source.fileTitle = 'File:Exact.png'; },
		wrongBase: data => { data.creation.baseBundle.revisionId++; },
		falseSlot: data => { data.creation.hasLayersSlot = false; },
		missingBase: data => { data.creation.baseBundle = null; }
	};
	test.each( Object.keys( refusals ) )( 'native %s refuses with complete local work intact', async boundary => {
		const c = await rebaseContext( 'image', true );
		try {
			await choose( c ); c.bridge.capture(); const before = observed( c );
			c.events.response = response => { if ( response.layersworkingcopyimportcreationrebase ) { refusals[ boundary ]( response.layersworkingcopyimportcreationrebase ); } return response; };
			await expect( c.bridge.reconcile( 20 ) ).rejects.toThrow();
			expect( observed( c ) ).toStrictEqual( before ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test.each( [ 'rebase', 'source' ] )( 'late live work during %s read refuses without overwriting it', async boundary => {
		const c = await rebaseContext( 'slide', true );
		try {
			await choose( c ); let finish;
			c.events[ boundary ] = () => new Promise( resolve => { finish = resolve; } );
			const pending = c.bridge.reconcile( 20 ); await tick(); expect( finish ).toEqual( expect.any( Function ) );
			c.store.set( 'layers', c.editor.layers.concat( { id: 'late', type: 'text', text: 'Keep newer work' } ) );
			const before = observed( c ); finish(); await expect( pending ).rejects.toThrow();
			expect( observed( c ) ).toStrictEqual( before ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test.each( [ 'selection', 'history', 'configuration', 'method', 'locked', 'queued', 'destroyed' ] )( 'changed %s during source read cannot partially commit', async boundary => {
		const c = await rebaseContext( 'image', true );
		try {
			await choose( c ); let finish; c.events.source = () => new Promise( resolve => { finish = resolve; } );
			const pending = c.bridge.reconcile( 20 ); await tick();
			if ( boundary === 'selection' ) { c.editor.canvasManager.selectedLayerIds.push( 'later' ); }
			if ( boundary === 'history' ) { c.history.history[ 0 ].layers.push( { id: 'later', type: 'text' } ); }
			if ( boundary === 'configuration' ) { c.editor.config.pageOwned.surfaceId = 'other'; }
			if ( boundary === 'method' ) { c.history.redo = () => false; }
			if ( boundary === 'locked' ) { c.store.isLocked = true; }
			if ( boundary === 'queued' ) { c.store.pendingOperations.push( { retained: 'pending' } ); }
			if ( boundary === 'destroyed' ) { c.store.destroy(); }
			const before = observed( c ); finish(); await expect( pending ).rejects.toThrow();
			expect( observed( c ) ).toStrictEqual( before ); expect( c.session._surfaceId ).toBe( 'target' );
			expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test.each( [ 'base', 'source', 'unavailable' ] )( 'fresh %s validation includes an undone Import retained by Redo', async boundary => {
		const c = await rebaseContext( 'slide', true );
		try {
			await choose( c ); expect( c.history.undo() ).toBe( true ); c.bridge.capture();
			expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 0 );
			const before = observed( c );
			c.events.response = response => {
				const read = response.layersworkingcopyimportcreationread;
				if ( read && boundary === 'base' ) { read.creation.baseBundle.snapshot.metadata.newer.push( 'changed again' ); }
				if ( read && boundary === 'source' ) { read.source.revisionId++; }
				if ( read && boundary === 'unavailable' ) { throw new Error( 'Source visibility refused' ); }
				return response;
			};
			await expect( c.bridge.reconcile( 20 ) ).rejects.toThrow(); expect( observed( c ) ).toStrictEqual( before );
			expect( c.api.post.mock.calls.some( ( [ p ] ) => p.action === 'layersworkingcopyimportcreationread' && p.baserevid === 20 ) ).toBe( true );
			expect( c.history.redo() ).toBe( true ); expect( c.editor.layers ).toHaveLength( 3 );
		} finally { c.dispose(); }
	} );
	test( 'undone Import can reconcile then Redo with new identity and original citations', async () => {
		const c = await rebaseContext( 'slide', true );
		try {
			await choose( c ); c.history.undo(); await c.bridge.reconcile( 20 );
			expect( c.editor.layers ).toHaveLength( 0 ); expect( c.history.redo() ).toBe( true );
			expect( c.session.captureWorkingCopyImportProvenance()[ 0 ].targetSurfaceId ).toBe( 'current' );
			await c.drafts.save(); expect( c.session.getStatus().dirty ).toBe( false );
		} finally { c.dispose(); }
	} );
	test.each( [ 'conflict', 'uncertain' ] )( '%s admission succeeds without automatic Save', async phase => {
		const c = await rebaseContext();
		try { await choose( c ); c.session._phase = phase; await c.bridge.reconcile( 20 ); expect( c.session._phase ).toBe( 'ready' ); expect( c.api.postWithToken ).not.toHaveBeenCalled(); }
		finally { c.dispose(); }
	} );
	test( 'same-revision readmission and a second reconciliation remain supported', async () => {
		const c = await rebaseContext();
		try {
			await choose( c ); await c.bridge.reconcile( 20 );
			c.events.response = response => { if ( response.layersworkingcopyimportcreationrebase ) { response.layersworkingcopyimportcreationrebase.origin = { pageId: 7, revisionId: 20, surfaceId: 'current', selection: clone( c.currentSelection ) }; } return response; };
			await c.bridge.reconcile( 20 ); expect( c.history.undo() ).toBe( true ); expect( c.history.redo() ).toBe( true );
		} finally { c.dispose(); }
	} );
	test.each( [ 'layers-edit-conflict', 'badtoken', 'layers-publication-outcome-unknown' ] )( '%s after reconciliation retains work and Undo until an explicit retry', async code => {
		const c = await rebaseContext( 'image', true );
		try {
			await choose( c ); await c.bridge.reconcile( 20 );
			const draft = clone( c.session.getDraft() ), history = clone( c.history.captureTimeline() ), saved = c.session._savedJson;
			c.api.postWithToken.mockRejectedValue( { error: { code } } );
			await expect( c.drafts.save() ).rejects.toMatchObject( { code } );
			expect( c.session.getDraft() ).toStrictEqual( draft ); expect( c.history.captureTimeline() ).toStrictEqual( history );
			expect( c.session._savedJson ).toBe( saved ); expect( c.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			expect( c.session.captureWorkingCopyImportProvenance()[ 0 ].targetSurfaceId ).toBe( 'current' );
		} finally { c.dispose(); }
	} );
	test( 'another Import, subsequent editing and Undo use the current canonical identity', async () => {
		const c = await rebaseContext( 'image', true );
		try {
			await choose( c ); await c.bridge.reconcile( 20 ); const original = clone( c.editor.layers );
			await choose( c ); c.integration.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
			expect( c.editor.layers ).toHaveLength( 6 ); expect( c.history.undo() ).toBe( true ); expect( c.editor.layers ).toStrictEqual( original );
			expect( c.history.redo() ).toBe( true );
			c.store.set( 'layers', c.editor.layers.concat( { id: 'edited', type: 'text', text: 'After reconciliation' } ) ); c.history.saveState( 'Edit' );
			expect( c.history.undo() ).toBe( true ); expect( c.editor.layers ).toHaveLength( 6 ); expect( c.history.redo() ).toBe( true );
			await c.drafts.save(); expect( c.session._newSurface ).toBeNull();
		} finally { c.dispose(); }
	} );
	test.each( [ 'rebase', 'source' ] )( 'concurrent reconciliation during %s refuses without cancelling the first transaction', async boundary => {
		const c = await rebaseContext();
		try {
			await choose( c ); let finish; c.events[ boundary ] = () => new Promise( resolve => { finish = resolve; } );
			const pending = c.bridge.reconcile( 20 ); await tick();
			await expect( c.bridge.reconcile( 20 ) ).rejects.toThrow(); finish();
			await expect( pending ).resolves.toMatchObject( { revisionId: 20 } );
		} finally { c.dispose(); }
	} );
	test.each( [ 'rebase', 'source' ] )( 'disposed editor during %s cannot be revived by a late response', async boundary => {
		const c = await rebaseContext();
		try {
			await choose( c ); let finish; c.events[ boundary ] = () => new Promise( resolve => { finish = resolve; } );
			const pending = c.bridge.reconcile( 20 ); await tick(); c.bridge.dispose(); finish();
			await expect( pending ).rejects.toThrow(); expect( c.session._snapshot ).toBeNull(); expect( c.bridge.disposed ).toBe( true );
			expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test( 'a consistently readmitted reupload still refuses the changed destination source pin', async () => {
		const c = await rebaseContext( 'image', true );
		try {
			await choose( c ); c.bridge.capture(); const before = observed( c );
			c.creation.newSurface.source.sha1 = 'reuploaded';
			await expect( c.bridge.reconcile( 20 ) ).rejects.toThrow(); expect( observed( c ) ).toStrictEqual( before );
		} finally { c.dispose(); }
	} );
} );
