/**
 * Smoke tests for module bootstrap
 */

describe('Smoke: editor/viewer modules', () => {
	beforeEach( () => {
		// Mock viewer modules needed by init.js
		global.window = global.window || {};
		global.window.LayersUrlParser = jest.fn( function () {
			this.getPageLayersParam = jest.fn();
			this.detectLayersFromDataMw = jest.fn();
		} );
		global.window.LayersViewerManager = jest.fn( function () {
			this.initializeLayerViewers = jest.fn();
			this.initializeFilePageFallback = jest.fn();
		} );
		global.window.LayersApiFallback = jest.fn( function () {
			this.initialize = jest.fn();
		} );
	} );

	afterEach( () => {
		delete global.window.LayersUrlParser;
		delete global.window.LayersViewerManager;
		delete global.window.LayersApiFallback;
	} );

	it('can require LayersEditor module (if present)', () => {
		// Some environments bundle via RL; in Jest we import source directly
		const Editor = require('../../resources/ext.layers.editor/LayersEditor.js');
		expect(Editor).toBeTruthy();
		// Constructor should be a function or object factory
		const type = typeof Editor;
		expect(['function', 'object']).toContain(type);
	});

	it('can require viewer init', () => {
		const viewerInit = require('../../resources/ext.layers/init.js');
		expect(viewerInit).toBeDefined();
	});
});
