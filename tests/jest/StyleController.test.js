const StyleController = require('../../resources/ext.layers.editor/StyleController.js');

describe('StyleController', () => {
	let sc;
	beforeEach(() => {
		sc = new StyleController();
	});

	describe('constructor', () => {
		test('should create instance with default style', () => {
			expect(sc.currentStyle).toBeDefined();
			expect(sc.currentStyle.color).toBe('#000000');
			expect(sc.currentStyle.strokeWidth).toBe(2);
		});

		test('should accept editor reference', () => {
			const mockEditor = { name: 'test' };
			const scWithEditor = new StyleController(mockEditor);
			expect(scWithEditor.editor).toBe(mockEditor);
		});
	});

	describe('static getDefaultStyle', () => {
		test('should return default style object', () => {
			const defaults = StyleController.getDefaultStyle();
			expect(defaults.color).toBe('#000000');
			expect(defaults.strokeWidth).toBe(2);
			expect(defaults.fontSize).toBe(16);
		});

		test('should return a copy, not reference', () => {
			const defaults1 = StyleController.getDefaultStyle();
			const defaults2 = StyleController.getDefaultStyle();
			defaults1.color = '#ff0000';
			expect(defaults2.color).toBe('#000000');
		});
	});

	describe('setCurrentStyle', () => {
		test('should merge with existing style', () => {
			sc.setCurrentStyle({ color: '#ff0000' });
			expect(sc.currentStyle.color).toBe('#ff0000');
			expect(sc.currentStyle.strokeWidth).toBe(2); // Preserved
		});

		test('should overwrite specified properties', () => {
			sc.setCurrentStyle({ strokeWidth: 5, fontSize: 20 });
			expect(sc.currentStyle.strokeWidth).toBe(5);
			expect(sc.currentStyle.fontSize).toBe(20);
		});
	});

	describe('getCurrentStyle', () => {
		test('should return current style', () => {
			const style = sc.getCurrentStyle();
			expect(style).toBe(sc.currentStyle);
		});
	});

	describe('updateStyleOptions', () => {
		test('sets new values', () => {
			const next = sc.updateStyleOptions({ color: '#ff0000', strokeWidth: 5, fontSize: 20 });
			expect(next.color).toBe('#ff0000');
			expect(next.strokeWidth).toBe(5);
			expect(next.fontSize).toBe(20);
		});

		test('preserves undefined values from previous', () => {
			sc.setCurrentStyle({ color: '#123456' });
			const next = sc.updateStyleOptions({ strokeWidth: 10 });
			expect(next.color).toBe('#123456');
			expect(next.strokeWidth).toBe(10);
		});

		test('handles all style properties', () => {
			const next = sc.updateStyleOptions({
				color: '#ff0000',
				fill: '#00ff00',
				strokeWidth: 3,
				fontSize: 18,
				fontFamily: 'Roboto',
				textStrokeColor: '#000',
				textStrokeWidth: 1,
				textShadow: true,
				textShadowColor: '#333',
				arrowStyle: 'double',
				shadow: true,
				shadowColor: '#444',
				shadowBlur: 5,
				shadowOffsetX: 2,
				shadowOffsetY: 2
			});
			expect(next.color).toBe('#ff0000');
			expect(next.fill).toBe('#00ff00');
			expect(next.fontFamily).toBe('Roboto');
			expect(next.textStrokeColor).toBe('#000');
			expect(next.shadow).toBe(true);
			expect(next.shadowBlur).toBe(5);
		});

		test('uses default fontFamily when not set', () => {
			sc.currentStyle.fontFamily = undefined;
			const next = sc.updateStyleOptions({ color: '#abc' });
			expect(next.fontFamily).toBe('Arial, sans-serif');
		});
	});

	describe('applyToLayer', () => {
		test('updates layer properties appropriately', () => {
			const layer = { type: 'rectangle', stroke: '#000', strokeWidth: 1, fill: '#fff' };
			const next = sc.updateStyleOptions({ color: '#00ff00', fill: '#0000ff', strokeWidth: 4 });
			sc.applyToLayer(layer, next);
			expect(layer.stroke).toBe('#00ff00');
			expect(layer.fill).toBe('#0000ff');
			expect(layer.strokeWidth).toBe(4);
		});

		test('updates text layers correctly', () => {
			const layer = { type: 'text', fill: '#000', fontSize: 16, fontFamily: 'Arial' };
			const next = sc.updateStyleOptions({ color: '#123456', fontSize: 22, fontFamily: 'Roboto' });
			sc.applyToLayer(layer, next);
			expect(layer.fill).toBe('#123456');
			expect(layer.fontSize).toBe(22);
			expect(layer.fontFamily).toBe('Roboto');
		});

		test('applies color to text as fill', () => {
			const layer = { type: 'text' };
			sc.applyToLayer(layer, { color: '#aabbcc' });
			expect(layer.fill).toBe('#aabbcc');
		});

		test('applies color to highlight as fill', () => {
			const layer = { type: 'highlight' };
			sc.applyToLayer(layer, { color: '#dddddd' });
			expect(layer.fill).toBe('#dddddd');
		});

		test('applies color to shapes as stroke', () => {
			const layer = { type: 'circle' };
			sc.applyToLayer(layer, { color: '#eeeeee' });
			expect(layer.stroke).toBe('#eeeeee');
		});

		test('does not apply fill to line layers', () => {
			const layer = { type: 'line' };
			sc.applyToLayer(layer, { fill: '#ffffff' });
			expect(layer.fill).toBeUndefined();
		});

		test('does not apply fill to arrow layers', () => {
			const layer = { type: 'arrow' };
			sc.applyToLayer(layer, { fill: '#ffffff' });
			expect(layer.fill).toBeUndefined();
		});

		test('does not apply strokeWidth to text layers', () => {
			const layer = { type: 'text', strokeWidth: 1 };
			sc.applyToLayer(layer, { strokeWidth: 5 });
			expect(layer.strokeWidth).toBe(1);
		});

		test('applies text stroke properties', () => {
			const layer = { type: 'text' };
			sc.applyToLayer(layer, { textStrokeColor: '#000', textStrokeWidth: 2 });
			expect(layer.textStrokeColor).toBe('#000');
			expect(layer.textStrokeWidth).toBe(2);
		});

		test('applies shadow effects', () => {
			const layer = { type: 'rectangle' };
			sc.applyToLayer(layer, {
				shadow: true,
				shadowColor: '#333',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			});
			expect(layer.shadow).toBe(true);
			expect(layer.shadowColor).toBe('#333');
			expect(layer.shadowBlur).toBe(10);
			expect(layer.shadowOffsetX).toBe(5);
			expect(layer.shadowOffsetY).toBe(5);
		});

		test('does not apply shadow when shadow is false', () => {
			const layer = { type: 'rectangle' };
			sc.applyToLayer(layer, { shadow: false, shadowColor: '#333' });
			expect(layer.shadowColor).toBeUndefined();
		});

		test('handles null layer gracefully', () => {
			expect(() => sc.applyToLayer(null, { color: '#000' })).not.toThrow();
		});

		test('uses default fontSize for text without fontSize', () => {
			const layer = { type: 'text' };
			sc.applyToLayer(layer, {});
			expect(layer.fontSize).toBe(16);
		});
	});

	describe('module exports', () => {
		test('should export to Layers.Core namespace', () => {
			expect(window.Layers.Core.StyleController).toBeDefined();
		});
	});
});
