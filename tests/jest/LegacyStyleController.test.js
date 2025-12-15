const LegacyStyleController = require('../../resources/ext.layers.editor/canvas/LegacyStyleController');

describe('LegacyStyleController', () => {
    test('updateStyleOptions applies styles to selected layers and returns next style', () => {
        const layer = { id: 'l1', type: 'rectangle', visible: true };
        const editor = {
            layers: [ layer ],
            getLayerById: (id) => (id === 'l1' ? layer : null)
        };
        const manager = {
            currentStyle: { color: '#000' },
            getSelectedLayerIds: () => ['l1'],
            editor: editor,
            renderLayers: jest.fn()
        };

        const ctrl = new LegacyStyleController(manager);
        const next = ctrl.updateStyleOptions({ color: '#f00', strokeWidth: 5 });
        expect(next.color).toBe('#f00');
        expect(layer.stroke).toBe('#f00');
        expect(layer.strokeWidth).toBe(5);
        expect(manager.renderLayers).toHaveBeenCalled();
    });
});
