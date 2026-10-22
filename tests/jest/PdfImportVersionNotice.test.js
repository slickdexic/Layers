'use strict';
const Control = require( '../../resources/ext.layers.editor/PageOwnedImportControl.js' );
const en = require( '../../i18n/en.json' );
const tick = async () => { for ( let index = 0; index < 60; index++ ) await Promise.resolve(); };
describe( 'Approved different-file-version notice after empty Import', () => {
	let control, options, parent;
	beforeEach( () => {
		mw.notify = jest.fn(); parent = document.createElement( 'div' ); document.body.appendChild( parent );
		options = { getTarget: () => ( { match: {}, layerCount: 0, kind: 'pdf' } ), canImport: () => true,
			message: key => en[ key ], allocateId: () => 'fresh', maxLayers: 100, onApplied: jest.fn(),
			catalog: { search: async () => [ { title: 'Source', label: 'ABC', source: {} } ] },
			coordinator: { prepare: jest.fn().mockResolvedValue( {} ), inspect: () => ( { differentFileVersion: true, source: { label: 'ABC' } } ),
				apply: jest.fn().mockResolvedValue( { applied: true } ), release: jest.fn() } };
		control = new Control( options ); control.mount( parent );
	} );
	afterEach( () => { control.dispose(); parent.remove(); } );
	async function choose() { control.open(); await tick(); control.dialog.list.querySelector( 'button' ).click(); await tick(); }
	it( 'imports immediately and shows the translated persistent informational notice after closing', async () => {
		await choose(); expect( control.dialog ).toBeNull(); expect( options.coordinator.apply ).toHaveBeenCalledTimes( 1 );
		expect( mw.notify ).toHaveBeenCalledTimes( 1 );
		expect( mw.notify ).toHaveBeenCalledWith( en[ 'layers-page-import-file-version' ], {
			type: 'info', autoHide: false, classes: 'layers-page-import-version-notice'
		} );
		expect( document.activeElement ).toBe( control.button ); expect( options.onApplied ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'shows no notice for the same file version', async () => {
		options.coordinator.inspect = () => ( { differentFileVersion: false } ); await choose(); expect( mw.notify ).not.toHaveBeenCalled();
	} );
	it( 'preserves the existing decision-dialog line for a nonempty target without a duplicate notice', async () => {
		options.getTarget = () => ( { match: {}, layerCount: 1, kind: 'pdf' } ); await choose();
		expect( control.dialog.decision.textContent ).toContain( en[ 'layers-page-import-file-version' ] );
		control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick(); expect( mw.notify ).not.toHaveBeenCalled();
	} );
	it( 'shows no notice after a refused application', async () => {
		options.coordinator.apply.mockRejectedValue( new Error( 'refused' ) ); await choose();
		expect( mw.notify ).not.toHaveBeenCalled(); expect( options.onApplied ).not.toHaveBeenCalled(); expect( control.dialog ).not.toBeNull();
	} );
	it( 'shows no notice when a pending preparation is canceled', async () => {
		let finish; options.coordinator.prepare.mockImplementation( () => new Promise( resolve => { finish = resolve; } ) );
		await choose(); control.close(); finish( {} ); await tick();
		expect( mw.notify ).not.toHaveBeenCalled(); expect( options.coordinator.apply ).not.toHaveBeenCalled();
	} );
	it( 'keeps a successful Import successful if the notification service is unavailable', async () => {
		mw.notify.mockImplementation( () => { throw new Error( 'notification unavailable' ); } ); await choose();
		expect( control.dialog ).toBeNull(); expect( options.onApplied ).toHaveBeenCalledTimes( 1 );
	} );
} );
