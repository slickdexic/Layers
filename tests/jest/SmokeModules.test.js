/**
 * Smoke tests for module bootstrap
 */

describe('Smoke: editor/viewer modules', () => {
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
