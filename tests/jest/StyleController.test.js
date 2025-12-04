const StyleController = require('../../resources/ext.layers.editor/StyleController.js');

describe('StyleController', () => {
	let sc;
	beforeEach(() => {
		sc = new StyleController();
	});

	test('updateStyleOptions sets new values', () => {
		const next = sc.updateStyleOptions({ color: '#ff0000', strokeWidth: 5, fontSize: 20 });
		expect(next.color).toBe('#ff0000');
		expect(next.strokeWidth).toBe(5);
		expect(next.fontSize).toBe(20);
	});

	test('applyToLayer updates layer properties appropriately', () => {
		const layer = { type: 'rectangle', stroke: '#000', strokeWidth: 1, fill: '#fff' };
		const next = sc.updateStyleOptions({ color: '#00ff00', fill: '#0000ff', strokeWidth: 4 });
		sc.applyToLayer(layer, next);
		expect(layer.stroke).toBe('#00ff00');
		expect(layer.fill).toBe('#0000ff');
		expect(layer.strokeWidth).toBe(4);
	});

	test('applyToLayer updates text layers correctly', () => {
		const layer = { type: 'text', fill: '#000', fontSize: 16, fontFamily: 'Arial' };
		const next = sc.updateStyleOptions({ color: '#123456', fontSize: 22, fontFamily: 'Roboto' });
		sc.applyToLayer(layer, next);
		expect(layer.fill).toBe('#123456');
		expect(layer.fontSize).toBe(22);
		expect(layer.fontFamily).toBe('Roboto');
	});

});
