'use strict';
const { context } = require( './fixtures/workingCopyImportContext.js' );
const ValidationManager = require( '../../resources/ext.layers.editor/ValidationManager.js' );
require( '../../resources/ext.layers.editor/LayersEditor.js' );
const Editor = window.Layers.Core.Editor;

describe( 'native property history while Save is pending', () => {
	let c;
	beforeEach( async () => {
		jest.useFakeTimers(); c = await context( 'slide', true );
		c.editor.validationManager = new ValidationManager( c.editor );
		c.editor.markDirty = Editor.prototype.markDirty;
		c.editor.updateLayer = Editor.prototype.updateLayer;
		c.editor.saveState = description => c.history.saveState( description );
		c.editor.apiManager = { pageOwnedBridge: c.bridge };
	} );
	afterEach( () => { c.bridge.dispose(); jest.clearAllTimers(); jest.useRealTimers(); } );

	test( 'coalesces later property edits, keeps them dirty and makes them undoable after confirmation', async () => {
		c.editor.updateLayer( 'old', { gradient: { type: 'radial', radius: 0.5, colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ] } } );
		jest.advanceTimersByTime( 300 ); const initialSteps = c.history.history.length;
		let confirm; c.publisher.publish.mockImplementation( () => new Promise( resolve => { confirm = resolve; } ) );
		const saving = c.bridge.save().finally( () => { c.editor._savePromise = null; } ); c.editor._savePromise = saving;
		c.editor.updateLayer( 'old', { gradient: { ...c.store.state.layers[ 0 ].gradient, radius: 0 } } );
		expect( () => jest.advanceTimersByTime( 300 ) ).not.toThrow();
		c.editor.updateLayer( 'old', { gradient: { ...c.store.state.layers[ 0 ].gradient, centerX: 0.125 } } );
		expect( () => jest.advanceTimersByTime( 300 ) ).not.toThrow();
		expect( c.history.history ).toHaveLength( initialSteps );
		confirm( { revisionId: 13 } ); expect( ( await saving ).dirty ).toBe( true );
		for ( let turn = 0; turn < 5; turn++ ) await Promise.resolve();
		expect( c.history.history ).toHaveLength( initialSteps + 1 );
		expect( c.history.undo() ).toBe( true ); expect( c.store.state.layers[ 0 ].gradient.radius ).toBe( 0.5 );
		expect( c.history.redo() ).toBe( true ); expect( c.store.state.layers[ 0 ].gradient ).toMatchObject( { radius: 0, centerX: 0.125 } );
	} );

	test( 'an uncertain Save preserves later live edits without recording against an unconfirmed base', async () => {
		let refuse; c.publisher.publish.mockImplementation( () => new Promise( ( resolve, reject ) => { refuse = reject; } ) );
		const saving = c.bridge.save().catch( () => false ).finally( () => { c.editor._savePromise = null; } );
		c.editor._savePromise = saving; const before = c.history.history.length;
		c.editor.updateLayer( 'old', { text: 'Keep these later edits' } );
		expect( () => jest.advanceTimersByTime( 300 ) ).not.toThrow();
		refuse( Object.assign( new Error( 'unknown' ), { code: 'layers-publication-outcome-unknown' } ) );
		await saving; for ( let turn = 0; turn < 5; turn++ ) await Promise.resolve();
		expect( c.store.state.layers[ 0 ].text ).toBe( 'Keep these later edits' );
		expect( c.session.getStatus().phase ).toBe( 'uncertain' );
		expect( c.history.history ).toHaveLength( before ); expect( c.editor._updateLayerSaveTimer ).toBe( null );
	} );
} );
