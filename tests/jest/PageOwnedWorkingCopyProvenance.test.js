'use strict';

const { context, clone, Coordinator, State } = require( './fixtures/workingCopyImportContext.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );

async function setup( kind = 'slide', populated = false ) {
    const c = await context( kind, populated );
    c.coordinator = new Coordinator( c.dependencies ); c.coordinator.enablePublicationProvenance();
    c.import = async mode => { const handle = await c.coordinator.prepare( c.choice, c.options( mode ) );
        const result = await c.coordinator.apply( handle ); c.coordinator.release( handle ); return result; };
    return c;
}

const source = { sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source', targetSurfaceId: 'target' };

describe( 'opt-in working-copy Import provenance', () => {
    test( 'changed target identity during publication cannot acknowledge pending citations', async () => {
        const c = await setup( 'image' ); await c.import();
        const before = clone( c.session.getDraft() );
        c.publisher.publish.mockImplementation( async () => { c.session._surfaceId = 'other'; return { revisionId: 13 }; } );
        await expect( c.session.save() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
        expect( c.session.getDraft().snapshot ).toEqual( before.snapshot );
        expect( c.session.getStatus().revisionId ).toBe( 12 );
        c.session._surfaceId = 'target';
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
    } );

    test( 'an ordinary opted-in Save cannot publish a changed target after backup', async () => {
        const c = await setup( 'image' );
        c.store.state.layers = [ { id: 'local', type: 'text', text: 'Local edit' } ]; c.bridge.capture();
        c.publisher.publish.mockResolvedValue( { revisionId: 13 } );
        await expect( c.session.save( '', async () => { c.session._surfaceId = 'other'; } ) ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
        expect( c.publisher.publish ).not.toHaveBeenCalled();
        expect( c.session.getStatus().revisionId ).toBe( 12 );
    } );

    test.each( [ 'slide', 'image' ] )( 'first Save publishes native source IDs for %s and subsequent edits omit them', async kind => {
        const c = await setup( kind ); await c.import();
        expect( c.session.captureWorkingCopyImportProvenance()[ 0 ] ).toMatchObject( source );
        c.publisher.publish.mockResolvedValue( { revisionId: 13 } );
        await c.bridge.save( 'Owner note' );
        expect( c.publisher.publish.mock.calls[ 0 ][ 0 ] ).toMatchObject( { importSources: [ source ], summary: 'Owner note' } );
        expect( c.session.captureWorkingCopyImportProvenance() ).toEqual( [] );
        c.store.state.layers[ 1 ].text = 'Subsequent edit';
        c.publisher.publish.mockResolvedValue( { revisionId: 14 } ); await c.bridge.save();
        expect( c.publisher.publish.mock.calls[ 1 ][ 0 ].importSources ).toBeUndefined();
    } );

    test( 'Undo removes pending citations, Redo restores them, and canceled Import adds none', async () => {
        const c = await setup(); await c.import();
        expect( c.history.undo() ).toBe( true ); expect( c.session.captureWorkingCopyImportProvenance() ).toEqual( [] );
        expect( c.history.redo() ).toBe( true ); expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
        expect( await c.coordinator.prepare( c.choice, c.options( 'cancel' ) ) ).toBeNull();
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
    } );

    test.each( [ 'layers-working-copy-import-unavailable', 'layers-edit-conflict', 'layers-publication-outcome-unknown' ] )(
        'refused or uncertain Save retains all work and pending citations: %s', async code => {
            const c = await setup(); await c.import(); const before = c.bridge.captureWorkingCopyDraft();
            c.publisher.publish.mockRejectedValue( Object.assign( new Error( code ), { code } ) );
            await expect( c.bridge.save() ).rejects.toMatchObject( { code } );
            expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
            expect( c.bridge.captureWorkingCopyDraft().workingCopyDraft.workingState ).toEqual( before.workingCopyDraft.workingState );
        }
    );

    test( 'confirmed Save acknowledges old Undo checkpoints and preserves newer live edits', async () => {
        const c = await setup(); await c.import(); let finish;
        c.publisher.publish.mockImplementation( () => new Promise( resolve => { finish = resolve; } ) );
        const save = c.bridge.save(); while ( !finish ) { await Promise.resolve(); }
        c.store.state.layers[ 1 ].text = 'Newer text'; finish( { revisionId: 13 } ); await save;
        expect( c.store.state.layers[ 1 ].text ).toBe( 'Newer text' );
        expect( c.session.captureWorkingCopyImportProvenance() ).toEqual( [] );
        expect( c.bridge.captureWorkingCopyDraft().workingCopyDraft.timeline.history.every( entry => entry.workingState.importProvenance.length === 0 ) ).toBe( true );
    } );

    test( 'source revocation refuses before POST and preserves the complete session', async () => {
        const c = await setup(); await c.import(); const before = clone( c.session.getDraft() );
        c.hooks.native = async () => { throw Object.assign( new Error( 'Private details' ), { code: 'layers-working-copy-import-unavailable' } ); };
        await expect( c.bridge.save() ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
        expect( c.publisher.publish ).not.toHaveBeenCalled(); expect( c.session.getDraft() ).toEqual( before );
    } );

    test.each( [ 'slide', 'image' ] )( 'full draft recovery revalidates sources and restores Import Undo/Redo for %s', async kind => {
        const first = await setup( kind ); await first.import(); const draft = first.bridge.captureWorkingCopyDraft();
        const c = await setup( kind ); const candidate = { ...draft, label: 'Same', publicationBlocked: false };
        const nativeBefore = c.counts.native;
        await c.bridge.restoreDraft( candidate );
        expect( c.counts.native ).toBeGreaterThan( nativeBefore );
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
        expect( c.history.undo() ).toBe( true ); expect( c.session.captureWorkingCopyImportProvenance() ).toEqual( [] );
        expect( c.history.redo() ).toBe( true ); expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
        c.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await c.bridge.save();
        expect( c.publisher.publish.mock.calls[ 0 ][ 0 ].importSources ).toEqual( [ source ] );
    } );

    test( 'revoked draft source refuses without changing session, history, display or selection', async () => {
        const first = await setup(); await first.import(); const c = await setup();
        const observations = [ State.observeWorkingCopyObject( c.session, false ), State.observeWorkingCopyObject( c.session._snapshot ),
            State.observeWorkingCopyObject( c.history.history ), State.observeWorkingCopyObject( c.store.state ),
            State.observeWorkingCopyObject( c.selection, false ) ];
        c.hooks.native = async () => { throw new Error( 'Source unavailable' ); };
        await expect( c.bridge.restoreDraft( { ...first.bridge.captureWorkingCopyDraft(), label: 'Same', publicationBlocked: false } ) ).rejects.toThrow();
        observations.forEach( State.checkWorkingCopyObservation );
    } );

    test( 'actual draft storage/lifecycle recovery preserves source writer bytes and publishes the citation', async () => {
        const records = new Map(), storage = { getItem: key => records.get( key ) || null,
            setItem: ( key, value ) => records.set( key, value ), removeItem: key => records.delete( key ),
            key: index => Array.from( records.keys() )[ index ], get length() { return records.size; } };
        const first = await setup(), c = await setup(); await first.import();
        const build = ( ctx, writer ) => { const controller = new Controller( ctx.bridge, new DraftStore( storage, writer ), ctx.adapter,
            { wiki: 'test-wiki', user: '1' } ); controller.enableWorkingCopyDrafts(); return controller; };
        const writer = build( first, 'a'.repeat( 32 ) ); writer.persist(); const original = Array.from( records.entries() );
        const reader = build( c, 'b'.repeat( 32 ) ); reader.selectRecovery( 'a'.repeat( 32 ) );
        const lifecycle = new Lifecycle( c.bridge, reader, { confirmRecovery: async () => true,
            chooseDraft: async () => 0, notifyFailure: jest.fn(), notifyBlocked: jest.fn() } );
        await lifecycle.initialize();
        expect( records.get( original[ 0 ][ 0 ] ) ).toBe( original[ 0 ][ 1 ] );
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
        c.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await lifecycle.save( 'Recovered' );
        expect( c.publisher.publish.mock.calls[ 0 ][ 0 ].importSources ).toEqual( [ source ] );
    } );

    test.each( [ 'delete-all', 'missing-live', 'downgrade', 'foreign-target', 'foreign-owner', 'invalid-id', 'invalid-canvas', 'null-claims' ] )(
        'malformed or downgraded draft provenance refuses without participant writes: %s', async mutation => {
            const first = await setup(); await first.import(); const draft = first.bridge.captureWorkingCopyDraft();
            if ( mutation === 'delete-all' ) { draft.workingCopyDraft.timeline.history.forEach( entry => { delete entry.workingState.importProvenance; } ); }
            if ( mutation === 'missing-live' ) { delete draft.workingCopyDraft.workingState.importProvenance; }
            if ( mutation === 'downgrade' ) { draft.workingCopyDraft.version = 1; }
            const claim = draft.workingCopyDraft.workingState.importProvenance && draft.workingCopyDraft.workingState.importProvenance[ 0 ];
            if ( mutation === 'foreign-target' ) { claim.targetSurfaceId = 'other'; }
            if ( mutation === 'foreign-owner' ) { claim.sourcePageId = 7; }
            if ( mutation === 'invalid-id' ) { claim.sourceRevisionId = 1.25; }
            if ( mutation === 'invalid-canvas' ) { claim.canvas = 'true'; }
            if ( mutation === 'null-claims' ) { draft.workingCopyDraft.workingState.importProvenance = null; }
            const c = await setup(), observations = [ State.observeWorkingCopyObject( c.session, false ), State.observeWorkingCopyObject( c.session._snapshot ),
                State.observeWorkingCopyObject( c.store.state ), State.observeWorkingCopyObject( c.history.history ), State.observeWorkingCopyObject( c.selection, false ) ];
            await expect( Promise.resolve().then( () => c.bridge.restoreDraft( { ...draft, label: 'Same', publicationBlocked: false } ) ) ).rejects.toThrow();
            observations.forEach( State.checkWorkingCopyObservation ); expect( c.publisher.publish ).not.toHaveBeenCalled();
        }
    );

    test.each( [ 'layers', 'selection', 'history', 'offscreen', 'destroy', 'method' ] )(
        'a native source await refuses late recovery mutation while preserving newer work: %s', async mutation => {
            const first = await setup(); await first.import(); const c = await setup();
            c.hooks.native = async () => {
                if ( mutation === 'layers' ) { c.store.state.layers = [ { id: 'late', type: 'text', text: 'Newer' } ]; }
                if ( mutation === 'selection' ) { c.store.state.selectedLayerIds = [ 'late' ]; }
                if ( mutation === 'history' ) { c.history.history[ 0 ].description = 'Newer history'; }
                if ( mutation === 'offscreen' ) { c.session._snapshot.surfaces[ 1 ].layers[ 0 ].text = 'Newer offscreen'; }
                if ( mutation === 'destroy' ) { c.store.destroy(); }
                if ( mutation === 'method' ) { c.client.read = jest.fn(); }
            };
            await expect( c.bridge.restoreDraft( { ...first.bridge.captureWorkingCopyDraft(), label: 'Same', publicationBlocked: false } ) ).rejects.toThrow();
            expect( c.publisher.publish ).not.toHaveBeenCalled(); expect( c.session.captureWorkingCopyImportProvenance() ).toEqual( [] );
            if ( mutation === 'layers' ) { expect( c.store.state.layers[ 0 ].text ).toBe( 'Newer' ); }
            if ( mutation === 'selection' ) { expect( c.store.state.selectedLayerIds ).toEqual( [ 'late' ] ); }
            if ( mutation === 'history' ) { expect( c.history.history[ 0 ].description ).toBe( 'Newer history' ); }
            if ( mutation === 'offscreen' ) { expect( c.session._snapshot.surfaces[ 1 ].layers[ 0 ].text ).toBe( 'Newer offscreen' ); }
            if ( mutation === 'destroy' ) { expect( c.store.isWorkingCopyAlive() ).toBe( false ); }
        }
    );

    test( 'normal edits and one-step Undo keep pending citations with complete checkpoints', async () => {
        const c = await setup(); await c.import();
        c.store.state.layers[ 1 ].text = 'Edited imported layer'; c.history.saveState( 'Edit imported text' );
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
        expect( c.history.undo() ).toBe( true ); expect( c.store.state.layers[ 1 ].text ).toBe( 'first' );
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
        expect( c.history.redo() ).toBe( true ); expect( c.store.state.layers[ 1 ].text ).toBe( 'Edited imported layer' );
    } );

    test( 'removing imported image layers omits their citation while keeping ordinary newer work', async () => {
        const c = await setup( 'image', true ); await c.import( 'append' );
        c.store.state.layers = c.store.state.layers.filter( layer => layer.id === 'old' ); c.store.state.layers[ 0 ].text = 'Independent edit';
        c.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await c.bridge.save();
        expect( c.publisher.publish.mock.calls[ 0 ][ 0 ].importSources ).toBeUndefined();
    } );

    test( 'copied empty-slide canvas retains its citation after imported layers are removed', async () => {
        const c = await setup(); await c.import(); c.store.state.layers = [];
        c.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await c.bridge.save();
        expect( c.publisher.publish.mock.calls[ 0 ][ 0 ].importSources ).toEqual( [ source ] );
    } );

    test( 'repeated Imports deduplicate the source and Replace preserves valid one-step Undo', async () => {
        const c = await setup( 'image', true ); await c.import( 'append' ); await c.import( 'replace' );
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
        expect( c.history.undo() ).toBe( true ); expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
        expect( c.history.redo() ).toBe( true ); c.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await c.bridge.save();
        expect( c.publisher.publish.mock.calls[ 0 ][ 0 ].importSources ).toEqual( [ source ] );
    } );

    test( 'a replaced publisher during native preflight cannot receive the prepared Save', async () => {
        const c = await setup(); await c.import(); const replacement = jest.fn().mockResolvedValue( { revisionId: 13 } );
        c.hooks.native = async () => { c.publisher.publish = replacement; };
        await expect( c.bridge.save() ).rejects.toThrow(); expect( replacement ).not.toHaveBeenCalled();
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
    } );

    test( 'same-revision success cannot acknowledge a required first-Save citation', async () => {
        const c = await setup(); await c.import(); c.publisher.publish.mockResolvedValue( { revisionId: 12 } );
        await expect( c.bridge.save() ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
    } );

    test( 'disposal during native preflight never posts a Save', async () => {
        const c = await setup(); await c.import(); c.hooks.native = async () => { c.session.dispose(); };
        await expect( c.bridge.save() ).rejects.toThrow(); expect( c.publisher.publish ).not.toHaveBeenCalled();
    } );

    test( 'a clean current draft still revalidates every pending Redo source before recovery', async () => {
        const first = await setup(); await first.import(); first.history.undo(); const c = await setup();
        const draft = first.bridge.captureWorkingCopyDraft(); expect( draft.workingCopyDraft.workingState.importProvenance ).toEqual( [] );
        c.hooks.native = async () => { throw new Error( 'Hidden Redo source' ); };
        const observations = [ State.observeWorkingCopyObject( c.session, false ), State.observeWorkingCopyObject( c.history.history ), State.observeWorkingCopyObject( c.store.state ) ];
        await expect( c.bridge.restoreDraft( { ...draft, label: 'Same', publicationBlocked: false } ) ).rejects.toThrow();
        observations.forEach( State.checkWorkingCopyObservation ); expect( c.counts.native ).toBe( 1 );
    } );

    test.each( [ 'label', 'file', 'kind' ] )( 'fresh native source mismatch refuses before publication: %s', async field => {
        const c = await setup( 'image' ); await c.import();
        if ( field === 'label' ) { c.bundle.snapshot.surfaces[ 0 ].label = 'Another layer set'; }
        if ( field === 'file' ) { c.bundle.snapshot.surfaces[ 0 ].source.fileTitle = 'File:Another.png'; }
        if ( field === 'kind' ) { c.bundle.snapshot.surfaces[ 0 ].kind = 'slide'; }
        await expect( c.bridge.save() ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
        expect( c.publisher.publish ).not.toHaveBeenCalled(); expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
    } );

    test( 'newer edits during the native Save read are retained while the captured snapshot is published', async () => {
        const c = await setup(); await c.import(); const captured = clone( c.session.getDraft().snapshot );
        c.hooks.native = async () => { c.store.state.layers[ 1 ].text = 'Edited while checking sources'; };
        c.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await c.bridge.save();
        expect( JSON.parse( c.publisher.publish.mock.calls[ 0 ][ 0 ].snapshotJson ) ).toEqual( captured );
        expect( c.store.state.layers[ 1 ].text ).toBe( 'Edited while checking sources' ); expect( c.session.getStatus().dirty ).toBe( true );
    } );

    test( 'a failed pre-publication backup retains citations and sends no native source request or POST', async () => {
        const c = await setup(); await c.import(); const count = c.counts.native;
        await expect( c.bridge.save( 'Note', async () => { throw new Error( 'Storage full' ); } ) ).rejects.toMatchObject( { code: 'layers-draft-storage-failed' } );
        expect( c.counts.native ).toBe( count ); expect( c.publisher.publish ).not.toHaveBeenCalled();
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
    } );

    test( 'multiple native sources are recorded while Replace drops obsolete image contributions', async () => {
        const c = await setup( 'image', true ); await c.import( 'append' );
        c.api.get.mockImplementation( async params => ( { layersworkingcopyimportread: {
            target: { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' },
            source: { owner: params.sourcepageid === 9 ? 'Source Page' : 'Second Page', pageId: params.sourcepageid,
                revisionId: params.sourcerevid, surfaceId: 'source' },
            targetBundle: { revisionId: 12, snapshot: clone( c.base ), sourceGeometry: [] },
            sourceBundle: { ...clone( c.bundle ), revisionId: params.sourcerevid }
        } } ) );
        const second = { owner: 'Second Page', pageId: 10, revisionId: 43, surfaceId: 'source' };
        let handle = await c.coordinator.prepare( second, c.options( 'append' ) ); await c.coordinator.apply( handle ); c.coordinator.release( handle );
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 2 );
        handle = await c.coordinator.prepare( second, c.options( 'replace' ) ); await c.coordinator.apply( handle ); c.coordinator.release( handle );
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 );
        c.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await c.bridge.save();
        expect( c.publisher.publish.mock.calls[ 0 ][ 0 ].importSources ).toEqual( [ { ...source, sourcePageId: 10, sourceRevisionId: 43 } ] );
    } );

    test( 'provenance is absent from ordinary defaults and cannot enable onto unsaved work', async () => {
        const c = await context(); const coordinator = new Coordinator( c.dependencies );
        expect( c.session.hasWorkingCopyImportProvenance() ).toBe( false );
        c.store.state.layers = [ { id: 'unsaved', type: 'text', text: 'Own work' } ]; c.bridge.capture();
        expect( () => coordinator.enablePublicationProvenance() ).toThrow();
        expect( c.session.hasWorkingCopyImportProvenance() ).toBe( false );
    } );
} );
