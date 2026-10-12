'use strict';
const Control = require( '../../resources/ext.layers.editor/PageOwnedImportControl.js' );
const en = require( '../../i18n/en.json' );
const msg = ( key, ...args ) => en[ key ].replace( /\$(\d+)/g, ( _, n ) => String( args[ n - 1 ] ) );
const tick = async () => { for ( let i = 0; i < 30; i++ ) { await Promise.resolve(); } };
const choice = { label: 'ABC', title: 'Source page', kind: 'slide', canvas: { width: 200, height: 120 },
    source: { owner: 'Source page', pageId: 9, revisionId: 42, surfaceId: 'member' } };
describe( 'approved working-copy Import picker', () => {
    let control, options, header;
    beforeEach( () => {
        header = document.createElement( 'div' ); document.body.appendChild( header );
        options = { getTarget: () => ( { match: { pageId: 7, kind: 'slide', label: 'ABC', fileTitle: null },
            name: 'ABC', owner: 'Target page', kind: 'slide', layerCount: 2, canvas: { width: 100, height: 50 } } ),
        canImport: () => true, message: msg, allocateId: () => 'fresh', maxLayers: 100, onApplied: jest.fn(),
        catalog: { search: jest.fn().mockResolvedValue( [ choice ] ) }, coordinator: {
            prepare: jest.fn().mockResolvedValue( { privateHandle: true } ),
            inspect: jest.fn().mockReturnValue( { source: { label: 'ABC' }, differentFileVersion: false } ),
            apply: jest.fn().mockResolvedValue( {} ), release: jest.fn() } };
        control = new Control( options ); control.mount( header );
    } );
    afterEach( () => { control.dispose(); header.remove(); jest.useRealTimers(); } );
    async function choose() { control.open(); await tick(); control.dialog.list.querySelector( 'button' ).click(); await tick(); }

    test( 'mounts Import, lists page labels and sizes, and keeps numeric identities out of rendered fields', async () => {
        control.button.click(); await tick();
        expect( control.button.textContent ).toBe( 'Import' ); expect( options.catalog.search ).toHaveBeenCalledWith( {
            search: '', target: { pageId: 7, kind: 'slide', label: 'ABC', fileTitle: null } } );
        expect( control.dialog.list.textContent ).toContain( 'ABC on Source page' );
        expect( control.dialog.list.textContent ).toContain( 'Canvas: 200 × 120' );
        expect( control.dialog.root.querySelector( '[data-pageid]' ) ).toBeNull();
        expect( control.dialog.root.innerHTML ).not.toContain( 'surfaceId' );
    } );
    test( 'renders exact replacement wording, both slide sizes, working-copy note and Cancel focus', async () => {
        await choose(); expect( document.activeElement ).toBe( control.dialog.cancel );
        expect( control.dialog.decision.textContent ).toContain( 'from Source page into “ABC” on Target page' );
        expect( control.dialog.decision.textContent ).toContain( 'This replaces ALL existing layers in this layer set (2 layers) with the layers from the other page.' );
        expect( control.dialog.decision.textContent ).toContain( 'This slide: 100 × 50. Source slide: 200 × 120.' );
        expect( control.dialog.decision.textContent ).toContain( 'Nothing is saved until you save the editor.' );
        expect( options.coordinator.apply ).not.toHaveBeenCalled();
    } );
    test( 'Escape cancels prepared Import, releases its private handle and stops editor Escape handling', async () => {
        await choose(); const editorEscape = jest.fn(); document.addEventListener( 'keydown', editorEscape );
        document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true, cancelable: true } ) );
        expect( control.dialog ).toBeNull(); expect( options.coordinator.release ).toHaveBeenCalledTimes( 1 );
        expect( options.coordinator.apply ).not.toHaveBeenCalled(); expect( document.activeElement ).toBe( control.button );
        expect( editorEscape ).not.toHaveBeenCalled(); document.removeEventListener( 'keydown', editorEscape );
    } );
    test( 'Append applies once, requests a draft backup and restores focus to Import', async () => {
        await choose(); control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
        expect( options.coordinator.apply ).toHaveBeenCalledTimes( 1 ); expect( options.onApplied ).toHaveBeenCalledTimes( 1 );
        expect( control.dialog ).toBeNull(); expect( document.activeElement ).toBe( control.button );
    } );
    test( 'Replace prepares a new exact handle with replace mode before applying', async () => {
        await choose(); control.dialog.decision.querySelector( '.layers-page-import-replace' ).click(); await tick();
        expect( options.coordinator.prepare.mock.calls.map( call => call[ 1 ].mode ) ).toEqual( [ 'append', 'replace' ] );
        expect( options.coordinator.release ).toHaveBeenCalledTimes( 2 ); expect( options.coordinator.apply ).toHaveBeenCalledTimes( 1 );
    } );
    test( 'an empty target imports directly with empty mode', async () => {
        const original = options.getTarget; options.getTarget = () => ( { ...original(), layerCount: 0 } );
        await choose(); expect( options.coordinator.prepare.mock.calls[ 0 ][ 1 ].mode ).toBe( 'empty' );
        expect( options.coordinator.apply ).toHaveBeenCalledTimes( 1 ); expect( control.dialog ).toBeNull();
    } );
    test( 'a file-version notice is escaped text, and differing image versions still use the native path', async () => {
        options.coordinator.inspect.mockReturnValue( { source: { label: '<script>bad</script>' }, differentFileVersion: true } );
        await choose(); expect( control.dialog.decision.textContent ).toContain( 'different version of this file' );
        expect( control.dialog.root.querySelector( 'script' ) ).toBeNull(); expect( control.dialog.decision.textContent ).toContain( '<script>bad</script>' );
    } );
    test( 'empty and failed search states expose no raw diagnostics', async () => {
        options.catalog.search.mockResolvedValueOnce( [] ); control.open(); await tick();
        expect( control.dialog.status.textContent ).toContain( 'No matching layer sets' ); control.close();
        options.catalog.search.mockRejectedValueOnce( new Error( 'private credentials' ) ); control.open(); await tick();
        expect( control.dialog.status.textContent ).toBe( en[ 'layers-page-import-failed' ] );
        expect( control.dialog.root.textContent ).not.toContain( 'credentials' );
    } );
    test( 'closed or superseded searches never replace current results', async () => {
        let finish; options.catalog.search.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
        control.open(); await tick(); control.close(); control.open(); await tick();
        finish( [ { ...choice, title: 'Old request' } ] ); await tick(); expect( control.dialog.list.textContent ).not.toContain( 'Old request' );
    } );
    test( 'debounces source search and discards the earlier response', async () => {
        jest.useFakeTimers(); control.open(); await tick();
        control.dialog.input.value = ' source '; control.dialog.input.dispatchEvent( new Event( 'input' ) );
        await jest.advanceTimersByTimeAsync( 251 ); expect( options.catalog.search.mock.calls[ 1 ][ 0 ].search ).toBe( ' source ' );
    } );
    test( 'canceling a pending preparation releases the eventual handle without applying', async () => {
        let finish; options.coordinator.prepare.mockImplementation( () => new Promise( resolve => { finish = resolve; } ) );
        control.open(); await tick(); control.dialog.list.querySelector( 'button' ).click(); await tick(); control.close();
        finish( { delayed: true } ); await tick(); expect( options.coordinator.release ).toHaveBeenCalledWith( { delayed: true } );
        expect( options.coordinator.apply ).not.toHaveBeenCalled();
    } );
    test( 'preparation/application refusal preserves the choice and reports a fixed message', async () => {
        options.coordinator.apply.mockRejectedValue( new Error( 'private path' ) ); await choose();
        control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
        expect( control.dialog.status.textContent ).toBe( en[ 'layers-page-import-failed' ] );
        expect( options.onApplied ).not.toHaveBeenCalled(); expect( document.activeElement ).toBe( control.dialog.cancel );
    } );
    test( 'focus wraps between enabled dialog controls in both directions', async () => {
        await choose(); const cancel = control.dialog.cancel, first = control.dialog.decision.querySelector( 'button' );
        cancel.focus(); document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Tab', bubbles: true, cancelable: true } ) );
        expect( document.activeElement ).toBe( first );
        document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true } ) );
        expect( document.activeElement ).toBe( cancel );
    } );
    test( 'a nonready editor cannot open or apply and duplicate clicks cannot apply twice', async () => {
        options.canImport = () => false; control.open(); expect( control.dialog ).toBeNull(); options.canImport = () => true;
        await choose(); let finish; options.coordinator.apply.mockImplementation( () => new Promise( resolve => { finish = resolve; } ) );
        const append = control.dialog.decision.querySelector( '.layers-page-import-append' ); append.click(); append.click();
        expect( options.coordinator.apply ).toHaveBeenCalledTimes( 1 ); expect( control.dialog.cancel.disabled ).toBe( true );
        finish( {} ); await tick(); expect( control.dialog ).toBeNull();
    } );
    test( 'disposal removes UI and prevents late completion or mounting again', async () => {
        await choose(); control.dispose(); expect( header.children ).toHaveLength( 0 ); expect( document.querySelector( '.layers-page-import-overlay' ) ).toBeNull();
        expect( () => control.mount( header ) ).toThrow(); control.dispose();
    } );
} );
