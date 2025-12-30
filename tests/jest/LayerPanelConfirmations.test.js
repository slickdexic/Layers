/**
 * @jest-environment jsdom
 */

describe('LayerPanel confirmation flows', () => {
    let LayerPanel;
    let originalConfirm;

    beforeAll(() => {
        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
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
        // Mock StateManager for state access
        const mockStateManager = {
            get: jest.fn().mockImplementation((key) => {
                if (key === 'selectedLayerIds') return ['layer-1'];
                return null;
            }),
            set: jest.fn()
        };
        panel.editor = {
            removeLayer: jest.fn(),
            saveState: jest.fn(),
            stateManager: mockStateManager,
            getLayerById: jest.fn().mockReturnValue({ id: 'layer-1', type: 'rectangle' }),
            historyManager: null
        };
        panel.renderLayerList = jest.fn();
        panel.updateCodePanel = jest.fn();
        panel.updatePropertiesPanel = jest.fn();
        panel.msg = jest.fn().mockReturnValue('Delete?');
        panel.logWarn = jest.fn();
        panel.getSelectedLayerId = jest.fn().mockReturnValue('layer-1');
        panel.registerDialogCleanup = jest.fn();
        // Mock folderController for delegation - will be overridden in individual tests
        panel.folderController = {
            deleteLayer: jest.fn()
        };
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

    test('deleteLayer delegates to folderController', () => {
        const panel = buildPanel();

        panel.deleteLayer('layer-1');

        // deleteLayer now delegates to folderController
        expect(panel.folderController.deleteLayer).toHaveBeenCalledWith(
            'layer-1',
            expect.any(Function) // the bound createConfirmDialog
        );
    });

    test('deleteLayer passes createConfirmDialog bound to panel', () => {
        const panel = buildPanel();
        panel.createConfirmDialog = jest.fn();

        panel.deleteLayer('layer-1');

        // Get the callback that was passed to folderController
        const passedCallback = panel.folderController.deleteLayer.mock.calls[0][1];
        // Call it to verify it's bound correctly
        passedCallback('test message', () => {});
        expect(panel.createConfirmDialog).toHaveBeenCalledWith('test message', expect.any(Function));
    });
});
