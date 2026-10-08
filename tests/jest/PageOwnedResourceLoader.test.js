'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const vm = require( 'vm' );

// Classic ResourceLoader scripts receive require and module, but their require
// resolves registered module names, not relative files. Keep its actual wrapper
// signature so ordinary CommonJS tests cannot hide this browser boundary.
function loader() {
	const context = vm.createContext( { window: {}, mw: { log: { warn: jest.fn(), error: jest.fn() } } } );
	const requireModule = jest.fn( () => {
		throw new Error( 'Module names cannot start with "./" or "../". Did you mean to use Package files?' );
	} );
	function load( name, module = { exports: {} }, require = requireModule ) {
		const source = fs.readFileSync( path.join( __dirname, '../../resources/ext.layers.editor', name ), 'utf8' );
		vm.compileFunction( source, [ '$', 'jQuery', 'require', 'module' ], { parsingContext: context } )(
			undefined, undefined, require, module
		);
	}
	load( 'PageOwnedSnapshotAdapter.js' );
	return { context, load, requireModule, run: source => vm.runInContext( source, context ) };
}

const timeline = `({ history: [ { layers: [], description: 'Initial', timestamp: 1 },
	{ layers: [ { id: 'edit', x: 17, gradient: { angle: 0 } } ], extra: { value: null } } ],
	historyIndex: 0, lastSaveHistoryIndex: 1, maxHistorySteps: 50 })`;

const readSetup = `
	const data = { owner: 'Example_owner', pageId: 77, revisionId: 12, binding: 'v1:77:second',
		kind: 'pdf', label: 'ABC', initialPage: 2, pageCount: 2, page: 1, stored: true,
		members: [ { page: 1, surfaceId: 'first' }, { page: 2, surfaceId: 'second' } ],
		surface: { id: 'first', kind: 'pdf', label: 'ABC',
			canvas: { width: 416, height: 208 }, layers: [ { id: 'kept', x: 17 } ],
			source: { repository: 'local', fileTitle: 'File:Example.pdf',
				timestamp: '20261008120000', sha1: 'a'.repeat(31), page: 1 } },
		sourceGeometry: { page: 1, width: 416, height: 208, units: 'file-handler-pixels' },
		rendition: { url: '/original-page-one.jpg', width: 416, height: 208 } };
	const api = { calls: 0, get: function () { this.calls++; return Promise.resolve({ layersread: { editor: data } }); } };
	const client = new window.Layers.Editor.PageOwnedPdfEditorReadClient(api);
	const options = { owner: 'Example_owner', revisionId: 12, binding: 'v1:77:second', page: 1 };
`;

describe( 'Page-owned native ResourceLoader dependency resolution', () => {
	it( 'captures and restores complete independent Undo timelines through classic scripts', () => {
		const env = loader();
		env.load( 'HistoryManager.js' );
		const result = env.run( `(() => {
			const manager = new window.Layers.Core.HistoryManager();
			const input = ${ timeline };
			manager.restoreTimeline(input);
			const before = JSON.stringify(manager.captureTimeline());
			input.history[1].layers[0].x = 900;
			const captured = manager.captureTimeline();
			captured.history[1].extra.value = 'changed outside';
			return { before, after: JSON.stringify(manager.captureTimeline()), redo: manager.canRedo() };
		})()` );
		expect( result.after ).toBe( result.before );
		expect( JSON.parse( result.after ) ).toMatchObject( { historyIndex: 0, lastSaveHistoryIndex: 1,
			history: [ { layers: [] }, { layers: [ { x: 17, gradient: { angle: 0 } } ], extra: { value: null } } ] } );
		expect( result.redo ).toBe( true );
		expect( env.requireModule ).not.toHaveBeenCalled();
	} );

	it( 'refuses invalid browser timeline restoration without changing the complete timeline', () => {
		const env = loader();
		env.load( 'HistoryManager.js' );
		const result = env.run( `(() => {
			const manager = new window.Layers.Core.HistoryManager();
			manager.restoreTimeline(${ timeline });
			const before = JSON.stringify(manager.captureTimeline());
			let refused = false;
			try { manager.restoreTimeline({ ...manager.captureTimeline(), historyIndex: 10 }); }
			catch (error) { refused = error.message === 'layers-editor-session-unavailable'; }
			return { before, after: JSON.stringify(manager.captureTimeline()), refused };
		})()` );
		expect( result.refused ).toBe( true );
		expect( result.after ).toBe( result.before );
		expect( env.requireModule ).not.toHaveBeenCalled();
	} );

	it( 'reads the exact requested PDF member without a relative browser require or retry', async () => {
		const env = loader();
		env.load( 'PageOwnedPdfEditorReadClient.js' );
		const result = await env.run( `(async () => { ${ readSetup }
			const expected = JSON.stringify(data);
			const answer = await client.read(options);
			answer.surface.layers[0].x = 900;
			return { expected, unchanged: JSON.stringify(data), page: answer.page,
				initialPage: answer.initialPage, calls: api.calls };
		})()` );
		expect( result.unchanged ).toBe( result.expected );
		expect( result.page ).toBe( 1 );
		expect( result.initialPage ).toBe( 2 );
		expect( result.calls ).toBe( 1 );
		expect( env.requireModule ).not.toHaveBeenCalled();
	} );

	it( 'keeps browser identity refusal and error redaction when adapter loading succeeds', async () => {
		const env = loader();
		env.load( 'PageOwnedPdfEditorReadClient.js' );
		const result = await env.run( `(async () => { ${ readSetup }
			data.revisionId = 999;
			try { await client.read(options); return { resolved: true }; }
			catch(error) { return { code: error.code, message: error.message, calls: api.calls }; }
		})()` );
		expect( result.code ).toBe( 'layers-reading-failed' );
		expect( result.message ).toBe( 'layers-reading-failed' );
		expect( result.calls ).toBe( 1 );
		expect( env.requireModule ).not.toHaveBeenCalled();
	} );

	it( 'refuses missing browser dependencies without invoking relative require', async () => {
		const env = loader();
		env.run( 'delete window.Layers.Editor.PageOwnedSnapshotAdapter;' );
		env.load( 'HistoryManager.js' );
		env.load( 'PageOwnedPdfEditorReadClient.js' );
		expect( () => env.run( 'new window.Layers.Core.HistoryManager().captureTimeline()' ) ).toThrow(
			'layers-editor-session-unavailable'
		);
		await expect( env.run( `(async () => { ${ readSetup } return client.read(options); })()` ) ).rejects.toMatchObject(
			{ code: 'layers-reading-failed', message: 'layers-reading-failed' }
		);
		expect( env.requireModule ).not.toHaveBeenCalled();
	} );

	it( 'retains standalone CommonJS timeline and PDF read loading when the browser adapter is absent', async () => {
		const env = loader();
		const adapter = env.run( 'window.Layers.Editor.PageOwnedSnapshotAdapter' );
		env.run( 'delete window.Layers.Editor.PageOwnedSnapshotAdapter;' );
		const commonRequire = jest.fn( name => {
			expect( name ).toBe( './PageOwnedSnapshotAdapter.js' );
			return adapter;
		} );
		const nodeModule = () => ( { exports: {}, require: commonRequire } );
		env.load( 'HistoryManager.js', nodeModule(), commonRequire );
		env.load( 'PageOwnedPdfEditorReadClient.js', nodeModule(), commonRequire );
		expect( env.run( 'new window.Layers.Core.HistoryManager().captureTimeline().historyIndex' ) ).toBe( -1 );
		const answer = await env.run( `(async () => { ${ readSetup } return client.read(options); })()` );
		expect( answer.page ).toBe( 1 );
		expect( commonRequire ).toHaveBeenCalledTimes( 2 );
		expect( env.requireModule ).not.toHaveBeenCalled();
	} );
} );
