/**
 * @jest-environment jsdom
 */

describe('LayerPanel confirmation flows', () => {
    let LayerPanel;
    let originalConfirm;

    beforeAll(() => {
        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.LayerPanel;
    });

    beforeEach(() => {
        originalConfirm = window.confirm;
        window.OO = null;
    });

    afterEach(() => {
        window.confirm = originalConfirm;
        jest.restoreAllMocks();
    });

    function buildPanel() {
        const panel = Object.create(LayerPanel.prototype);
        panel.editor = {
            removeLayer: jest.fn(),
            saveState: jest.fn()
        };
        panel.renderLayerList = jest.fn();
        panel.updateCodePanel = jest.fn();
        panel.updatePropertiesPanel = jest.fn();
        panel.msg = jest.fn().mockReturnValue('Delete?');
        panel.logWarn = jest.fn();
        panel.selectedLayerId = 'layer-1';
        return panel;
    }

    test('simpleConfirm respects native confirm return value', () => {
        const panel = buildPanel();
        window.confirm = jest.fn().mockReturnValue(false);

        const result = panel.simpleConfirm('Delete?');

        expect(window.confirm).toHaveBeenCalledWith('Delete?');
        expect(result).toBe(false);
    });

    test('simpleConfirm logs warning and auto-confirms when confirm unavailable', () => {
        const panel = buildPanel();
        window.confirm = undefined;

        const result = panel.simpleConfirm('Delete?');

        expect(panel.logWarn).toHaveBeenCalledWith(
            'Confirmation dialog unavailable; auto-confirming action',
            'Delete?'
        );
        expect(result).toBe(true);
    });

    test('deleteLayer aborts when fallback confirmation rejects', () => {
        const panel = buildPanel();
        // Mock createConfirmDialog to NOT call the callback (simulating cancel)
        panel.createConfirmDialog = jest.fn();

        panel.deleteLayer('layer-1');

        expect(panel.editor.removeLayer).not.toHaveBeenCalled();
        expect(panel.editor.saveState).not.toHaveBeenCalled();
    });

    test('deleteLayer proceeds when fallback confirmation accepts', () => {
        const panel = buildPanel();
        // Mock createConfirmDialog to immediately call the callback (simulating confirm)
        panel.createConfirmDialog = jest.fn((msg, callback) => callback());

        panel.deleteLayer('layer-1');

        expect(panel.editor.removeLayer).toHaveBeenCalledWith('layer-1');
        expect(panel.editor.saveState).toHaveBeenCalledWith('Delete Layer');
        expect(panel.selectedLayerId).toBeNull();
        expect(panel.updatePropertiesPanel).toHaveBeenCalledWith(null);
    });
});
