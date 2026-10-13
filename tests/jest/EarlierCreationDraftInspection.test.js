'use strict';
const { rebaseContext, clone, choose, tick, observed } = require( './fixtures/creationDraftRebaseContext.js' );
const { CreationClient, Store, Controller } = require( './fixtures/creationDraftAdmissionContext.js' );

async function setup( kind = 'image', slot = true ) {
	const c = await rebaseContext( kind, slot ); await choose( c ); c.controller.persist(); await c.drafts.reconcile( async () => 20 );
	const prior = c.api.post.getMockImplementation(), nativeEvents = c.events, events = { pause: null, mutate: null };
	c.api.post.mockImplementation( async params => {
		if ( params.action !== 'layersworkingcopyimportcreationdraftrebase' ) { return prior( params ); }
		if ( events.pause ) { await events.pause(); }
		const response = { layersworkingcopyimportcreationdraftrebase: clone( c.rebase ) };
		return events.mutate ? events.mutate( response ) : response;
	} );
	const client = new CreationClient( c.api, c.currentSelection ), handles = c.controller.listEarlierCreationCandidates();
	expect( handles ).toHaveLength( 1 );
	const record = c.controller.store.inspectEarlierCreationCandidate( handles[ 0 ] );
	return { ...c, client, handle: handles[ 0 ], record, events, nativeEvents };
}
const request = c => ( { pageId: 7, currentRevisionId: 20, origin: JSON.parse( c.record.raw ).creationOrigin } );
const source = () => ( { targetPageId: 7, targetBaseRevisionId: 20, targetSurfaceId: 'current', sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source' } );

describe( 'inactive earlier creation draft inspection', () => {
	test.each( [ [ 'image', true ], [ 'image', false ], [ 'slide', true ], [ 'slide', false ] ] )(
		'%s / slot %s keeps complete backup, current work and Undo untouched', async ( kind, slot ) => {
			const c = await setup( kind, slot );
			try {
				const before = observed( c ), prepared = await c.controller.prepareEarlierCreationInspection( c.handle, c.client );
				expect( Controller.isEarlierCreationInspection( prepared ) ).toBe( true );
				const result = prepared.inspect(); expect( result.envelope ).toStrictEqual( JSON.parse( c.record.raw ) );
				expect( result.native ).toStrictEqual( c.rebase ); expect( result.scope.baseRevisionId ).toBe( 12 );
				expect( result.envelope.workingCopyDraft.timeline.history ).toHaveLength( 2 );
				expect( c.api.post ).toHaveBeenLastCalledWith( { action: 'layersworkingcopyimportcreationdraftrebase', formatversion: 2,
					targetpageid: 7, baserevid: 20, originrevid: 12, originsurface: 'target' } );
				result.envelope.workingCopyDraft.workingState.layers[ 0 ].id = 'mutated copy';
				expect( prepared.inspect().envelope ).toStrictEqual( JSON.parse( c.record.raw ) );
				await prepared.revalidate(); await prepared.readSource( source() );
				expect( observed( c ) ).toStrictEqual( before ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
				prepared.release(); expect( () => prepared.inspect() ).toThrow();
			} finally { c.dispose(); }
		} );
	const badResponse = {
		originOwner: d => { d.origin.pageId++; }, originRevision: d => { d.origin.revisionId++; },
		originId: d => { d.origin.surfaceId = 'forged'; }, originOffset: d => { d.origin.selection.start++; },
		originText: d => { d.origin.selection.expected += ' '; }, originExtra: d => { d.origin.assumed = true; },
		owner: d => { d.creation.target.owner = 'Other Page'; }, currentRevision: d => { d.creation.target.revisionId++; },
		currentId: d => { d.creation.target.surfaceId = d.creation.newSurface.id = 'target'; },
		numericId: d => { d.creation.target.surfaceId = d.creation.newSurface.id = 99; },
		currentOffset: d => { d.creation.selection.start++; }, currentText: d => { d.creation.selection.expected += ' '; },
		geometry: d => { d.creation.newSurface.canvas.width++; }, pin: d => { d.creation.newSurface.source.sha1 = 'changed'; },
		file: d => { d.creation.newSurface.source.fileTitle = 'File:Other.png'; }, repository: d => { d.creation.newSurface.source.repository = 'foreign'; },
		populated: d => { d.creation.newSurface.layers.push( { id: 'stored' } ); }, kind: d => { d.creation.newSurface.kind = 'pdf'; },
		label: d => { d.creation.newSurface.label = 'Other'; }, slot: d => { d.creation.hasLayersSlot = false; },
		baseRevision: d => { d.creation.baseBundle.revisionId++; }, oldCollision: d => { d.creation.baseBundle.snapshot.surfaces[ 0 ].id = 'target'; },
		newCollision: d => { d.creation.baseBundle.snapshot.surfaces[ 0 ].id = 'current'; }, unknown: d => { d.creation.newSurface.extra = null; }
	};
	test.each( Object.keys( badResponse ) )( 'native %s mismatch leaves every participant and backup exact', async key => {
		const c = await setup();
		try {
			c.events.mutate = response => { badResponse[ key ]( response.layersworkingcopyimportcreationdraftrebase ); return response; };
			const before = observed( c ); await expect( c.controller.prepareEarlierCreationInspection( c.handle, c.client ) ).rejects.toThrow();
			expect( observed( c ) ).toStrictEqual( before ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test.each( [ 'layers', 'history', 'selection', 'config', 'method', 'destroyed', 'backup', 'base' ] )( 'late %s changes during validation are preserved', async boundary => {
		const c = await setup();
		try {
			let finish; c.events.pause = () => new Promise( resolve => { finish = resolve; } );
			const pending = c.controller.prepareEarlierCreationInspection( c.handle, c.client ); await tick(); expect( finish ).toEqual( expect.any( Function ) );
			if ( boundary === 'layers' ) { c.store.set( 'layers', c.editor.layers.concat( { id: 'late', type: 'text', text: 'Newer work' } ) ); }
			if ( boundary === 'history' ) { c.history.history[ 0 ].layers.push( { id: 'late' } ); }
			if ( boundary === 'selection' ) { c.editor.canvasManager.selectedLayerIds.push( 'late' ); }
			if ( boundary === 'config' ) { c.editor.config.pageOwned.surfaceId = 'later'; }
			if ( boundary === 'method' ) { c.client.prepareDraftRebase = async () => null; }
			if ( boundary === 'destroyed' ) { c.store.destroy(); }
			if ( boundary === 'base' ) { c.session._savedJson = '{"schemaVersion":1,"surfaces":[],"changed":true}'; }
			if ( boundary === 'backup' ) { const key = Array.from( c.records.keys() ).find( k => c.records.get( k ) === c.record.raw ); c.records.set( key, c.record.raw + ' ' ); }
			const before = observed( c ); finish(); await expect( pending ).rejects.toThrow(); expect( observed( c ) ).toStrictEqual( before );
		} finally { c.dispose(); }
	} );
	test.each( [ 'root', 'sibling', 'rendition' ] )( 'complete %s comparison refuses a changed native result on revalidation', async boundary => {
		const c = await setup();
		try {
			const prepared = await c.controller.prepareEarlierCreationInspection( c.handle, c.client ), before = observed( c );
			c.events.mutate = response => {
				const bundle = response.layersworkingcopyimportcreationdraftrebase.creation.baseBundle;
				if ( boundary === 'root' ) { bundle.snapshot.metadata.newer.push( 'changed' ); }
				if ( boundary === 'sibling' ) { bundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'changed'; }
				if ( boundary === 'rendition' ) { bundle.sourceRenditions = { unavailable: null, extra: false }; }
				return response;
			};
			await expect( prepared.revalidate() ).rejects.toThrow(); expect( observed( c ) ).toStrictEqual( before ); prepared.release();
		} finally { c.dispose(); }
	} );
	test( 'source reads repeat exact current admission and cannot be redirected to another target', async () => {
		const c = await setup();
		try {
			const prepared = await c.controller.prepareEarlierCreationInspection( c.handle, c.client );
			c.api.post.mockClear(); await expect( prepared.readSource( { ...source(), targetPageId: 8 } ) ).rejects.toThrow(); expect( c.api.post ).not.toHaveBeenCalled();
			c.nativeEvents.response = response => { if ( response.layersworkingcopyimportcreationread ) { response.layersworkingcopyimportcreationread.creation.baseBundle.snapshot.metadata.newer.push( 'changed' ); } return response; };
			await expect( prepared.readSource( source() ) ).rejects.toThrow(); prepared.release();
		} finally { c.dispose(); }
	} );
	test( 'plain lookalike proof objects never authorize inspection', async () => {
		const c = await setup();
		try {
			const before = observed( c ), fake = { prepareDraftRebase: async () => ( { preflight() {}, inspect: () => clone( c.rebase ), release() {} } ) };
			await expect( c.controller.prepareEarlierCreationInspection( c.handle, fake ) ).rejects.toThrow(); expect( observed( c ) ).toStrictEqual( before );
		} finally { c.dispose(); }
	} );
	test( 'a genuine certificate for another claimed historical selection cannot authorize a backup', async () => {
		const c = await setup();
		try {
			const proof = await c.client.prepareDraftRebase( request( c ) ), envelope = JSON.parse( c.record.raw );
			envelope.creationOrigin.origin.selection.start++;
			const key = Array.from( c.records.keys() ).find( k => c.records.get( k ) === c.record.raw ); c.records.set( key, JSON.stringify( envelope ) );
			const handle = c.controller.listEarlierCreationCandidates()[ 0 ], before = observed( c );
			const substitute = { prepareDraftRebase: async () => proof };
			await expect( c.controller.prepareEarlierCreationInspection( handle, substitute ) ).rejects.toThrow();
			expect( observed( c ) ).toStrictEqual( before ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
	test.each( [ 'confirmed', 'sameBase', 'wrongPage', 'invalidId', 'populated', 'missingPin', 'accessor', 'extra' ] )( '%s local origin refuses before transport', async boundary => {
		const c = await setup();
		try {
			const input = request( c );
			if ( boundary === 'confirmed' ) { c.client.confirmStored( 21 ); }
			if ( boundary === 'sameBase' ) { input.currentRevisionId = 12; }
			if ( boundary === 'wrongPage' ) { input.pageId = 8; }
			if ( boundary === 'invalidId' ) { input.origin.origin.surfaceId = input.origin.newSurface.id = 99; }
			if ( boundary === 'populated' ) { input.origin.newSurface.layers.push( { id: 'local' } ); }
			if ( boundary === 'missingPin' ) { delete input.origin.newSurface.source; }
			if ( boundary === 'extra' ) { input.assumed = true; }
			const getter = jest.fn( () => 7 ); if ( boundary === 'accessor' ) { Object.defineProperty( input, 'pageId', { get: getter, enumerable: true } ); }
			c.api.post.mockClear(); await expect( c.client.prepareDraftRebase( input ) ).rejects.toThrow(); expect( c.api.post ).not.toHaveBeenCalled(); expect( getter ).not.toHaveBeenCalled();
		} finally { c.dispose(); }
	} );
} );
