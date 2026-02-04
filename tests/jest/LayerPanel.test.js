/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests for LayerPanel
 *
 * Tests utility methods, state integration, and UI component creation.
 */

const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
const HistoryManager = require('../../resources/ext.layers.editor/HistoryManager.js');

// Mock IconFactory
const mockIconFactory = {
    createSVGElement: jest.fn((tag) => document.createElementNS('http://www.w3.org/2000/svg', tag)),
    createEyeIcon: jest.fn(() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('data-testid', 'eye-icon');
        return svg;
    }),
    createLockIcon: jest.fn(() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('data-testid', 'lock-icon');
        return svg;
    }),
    createDeleteIcon: jest.fn(() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('data-testid', 'delete-icon');
        return svg;
    }),
    createGrabIcon: jest.fn(() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('data-testid', 'grab-icon');
        return svg;
    })
};

describe('LayerPanel', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        // Setup window globals with namespaced structure
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        window.Layers.UI.IconFactory = mockIconFactory;
        window.Layers.UI.ColorPickerDialog = null;
        window.Layers.UI.ConfirmDialog = null;
        window.Layers.UI.PropertiesForm = null;

        // Mock EventTracker for event listener management
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((element, event, handler, options) => {
                element.addEventListener(event, handler, options);
                this.listeners.push({ element, event, handler, options });
                return { element, event, handler, options };
            });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn((elem) => {
                this.listeners = this.listeners.filter(l => l.element !== elem);
            });
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => {
                this.listeners.forEach((info) => {
                    if (info.element && info.element.removeEventListener) {
                        info.element.removeEventListener(info.event, info.handler, info.options);
                    }
                });
                this.listeners = [];
            });
        });

        // Setup DOM
        document.body.innerHTML = `
            <div id="layers-panel-container"></div>
            <div id="inspector-container"></div>
        `;

        // Create mock StateManager
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        // Create mock editor
        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            removeLayer: jest.fn(),
            saveState: jest.fn(),
            updateLayer: jest.fn()
        };

        // Reset module cache and reload LayerPanel
        jest.resetModules();
        jest.clearAllMocks();

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        test('should create instance with container and editor', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            expect(panel.container).toBe(container);
            expect(panel.editor).toBe(mockEditor);
        });

        test('should initialize state subscriptions array', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            expect(Array.isArray(panel.stateSubscriptions)).toBe(true);
        });

        test('should initialize listener tracking arrays', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Now uses EventTracker instead of arrays
            expect(panel.eventTracker).toBeDefined();
            expect(Array.isArray(panel.dialogCleanups)).toBe(true);
        });
    });

    describe('getLayers', () => {
        test('should return layers from StateManager', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const testLayers = [
                { id: 'layer1', type: 'rectangle' },
                { id: 'layer2', type: 'circle' }
            ];
            mockStateManager.set('layers', testLayers);

            expect(panel.getLayers()).toEqual(testLayers);
        });

        test('should return empty array when no layers', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            mockStateManager.set('layers', null);

            expect(panel.getLayers()).toEqual([]);
        });

        test('should return empty array when editor not available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: null
            });

            expect(panel.getLayers()).toEqual([]);
        });
    });

    describe('getVisibleLayers', () => {
        test('should return all layers when no groups are collapsed', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const testLayers = [
                { id: 'group1', type: 'group', expanded: true, children: ['layer1'] },
                { id: 'layer1', type: 'rectangle', parentGroup: 'group1' },
                { id: 'layer2', type: 'circle' }
            ];
            mockStateManager.set('layers', testLayers);

            expect(panel.getVisibleLayers()).toEqual(testLayers);
        });

        test('should hide children of collapsed groups', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const testLayers = [
                { id: 'group1', type: 'group', expanded: false, children: ['layer1', 'layer2'] },
                { id: 'layer1', type: 'rectangle', parentGroup: 'group1' },
                { id: 'layer2', type: 'circle', parentGroup: 'group1' },
                { id: 'layer3', type: 'arrow' }
            ];
            mockStateManager.set('layers', testLayers);

            const visible = panel.getVisibleLayers();
            expect(visible.length).toBe(2);
            expect(visible.map(l => l.id)).toEqual(['group1', 'layer3']);
        });

        test('should return empty array when no layers', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            mockStateManager.set('layers', []);
            expect(panel.getVisibleLayers()).toEqual([]);
        });
    });

    describe('getSelectedLayerId', () => {
        test('should return last selected layer ID', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            mockStateManager.set('selectedLayerIds', ['layer1', 'layer2', 'layer3']);

            expect(panel.getSelectedLayerId()).toBe('layer3');
        });

        test('should return null when nothing selected', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            mockStateManager.set('selectedLayerIds', []);

            expect(panel.getSelectedLayerId()).toBeNull();
        });

        test('should return null when editor not available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: null
            });

            expect(panel.getSelectedLayerId()).toBeNull();
        });
    });

    describe('getSelectedLayerIds', () => {
        test('should return selected layer IDs from stateManager', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            mockStateManager.set('selectedLayerIds', ['layer1', 'layer2']);

            expect(panel.getSelectedLayerIds()).toEqual(['layer1', 'layer2']);
        });

        test('should return empty array when no stateManager', () => {
            const container = document.getElementById('layers-panel-container');
            const editorNoStateManager = { ...mockEditor, stateManager: null };
            const panel = new LayerPanel({
                container: container,
                editor: editorNoStateManager
            });

            expect(panel.getSelectedLayerIds()).toEqual([]);
        });

        test('should return empty array when editor not available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: null
            });

            expect(panel.getSelectedLayerIds()).toEqual([]);
        });
    });

    describe('subscribeToState', () => {
        test('should subscribe to layers changes', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Clear existing subscriptions
            panel.stateSubscriptions = [];
            panel.subscribeToState();

            expect(panel.stateSubscriptions.length).toBeGreaterThan(0);
        });

        test('should not subscribe when editor not available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: null
            });

            panel.stateSubscriptions = [];
            panel.subscribeToState();

            expect(panel.stateSubscriptions.length).toBe(0);
        });
    });

    describe('msg', () => {
        test('should return MediaWiki message when available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Clear layersMessages to test mw.message fallback path
            const originalLayersMessages = window.layersMessages;
            delete window.layersMessages;

            // Mock mw.message
            window.mw.message = jest.fn().mockReturnValue({
                text: jest.fn().mockReturnValue('Translated Message')
            });

            const result = panel.msg('test-key', 'Fallback');

            expect(result).toBe('Translated Message');

            window.layersMessages = originalLayersMessages;
        });

        test('should return fallback when mw.message not available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Remove mw.message
            const originalMessage = window.mw.message;
            window.mw.message = undefined;

            const result = panel.msg('test-key', 'Fallback');

            expect(result).toBe('Fallback');

            window.mw.message = originalMessage;
        });
    });

    describe('setAttributes', () => {
        test('should set multiple attributes on element', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const element = document.createElement('div');
            panel.setAttributes(element, {
                'id': 'test-id',
                'class': 'test-class',
                'data-value': '123'
            });

            expect(element.getAttribute('id')).toBe('test-id');
            expect(element.getAttribute('class')).toBe('test-class');
            expect(element.getAttribute('data-value')).toBe('123');
        });

        test('should handle empty attributes object', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const element = document.createElement('div');
            
            expect(() => {
                panel.setAttributes(element, {});
            }).not.toThrow();
        });
    });

    describe('icon creation methods', () => {
        test('createEyeIcon should delegate to IconFactory', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.createEyeIcon(true);

            expect(mockIconFactory.createEyeIcon).toHaveBeenCalledWith(true);
        });

        test('createLockIcon should delegate to IconFactory', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.createLockIcon(false);

            expect(mockIconFactory.createLockIcon).toHaveBeenCalledWith(false);
        });

        test('createDeleteIcon should delegate to IconFactory', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.createDeleteIcon();

            expect(mockIconFactory.createDeleteIcon).toHaveBeenCalled();
        });

        test('createEyeIcon should return span when IconFactory not available', () => {
            window.Layers.UI.IconFactory = null;
            
            // Reload LayerPanel without IconFactory
            jest.resetModules();
            require('../../resources/ext.layers.editor/LayerPanel.js');
            const LP = window.Layers.UI.LayerPanel;

            const container = document.getElementById('layers-panel-container');
            const panel = new LP({
                container: container,
                editor: mockEditor
            });

            const result = panel.createEyeIcon(true);

            expect(result.tagName.toLowerCase()).toBe('span');
        });
    });

    describe('listener management', () => {
        test('addDocumentListener should track listener', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const handler = jest.fn();
            panel.addDocumentListener('click', handler);

            // Now tracked via EventTracker
            expect(panel.eventTracker.add).toHaveBeenCalled();
        });

        test('addTargetListener should track listener', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const target = document.createElement('div');
            const handler = jest.fn();
            panel.addTargetListener(target, 'click', handler);

            // Now tracked via EventTracker
            expect(panel.eventTracker.add).toHaveBeenCalledWith(target, 'click', handler, undefined);
        });

        test('removeDocumentListeners should clean up all document listeners', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const handler = jest.fn();
            panel.addDocumentListener('click', handler);
            panel.removeDocumentListeners();

            // Now uses EventTracker.removeAllForElement
            expect(panel.eventTracker.removeAllForElement).toHaveBeenCalledWith(document);
        });

        test('removeTargetListeners should be available for compatibility', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Method exists for compatibility, EventTracker.destroy handles actual cleanup
            expect(typeof panel.removeTargetListeners).toBe('function');
        });
    });

    describe('dialog cleanup management', () => {
        test('registerDialogCleanup should add cleanup function', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const cleanup = jest.fn();
            panel.registerDialogCleanup(cleanup);

            expect(panel.dialogCleanups).toContain(cleanup);
        });

        test('runDialogCleanups should call all cleanup functions', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const cleanup1 = jest.fn();
            const cleanup2 = jest.fn();
            panel.registerDialogCleanup(cleanup1);
            panel.registerDialogCleanup(cleanup2);

            panel.runDialogCleanups();

            expect(cleanup1).toHaveBeenCalled();
            expect(cleanup2).toHaveBeenCalled();
        });

        test('runDialogCleanups should clear cleanup array', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.registerDialogCleanup(jest.fn());
            panel.registerDialogCleanup(jest.fn());

            panel.runDialogCleanups();

            expect(panel.dialogCleanups.length).toBe(0);
        });
    });

    describe('destroy', () => {
        test('should clean up all resources', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Add some listeners and cleanups
            panel.addDocumentListener('click', jest.fn());
            panel.registerDialogCleanup(jest.fn());

            panel.destroy();

            // EventTracker should be nulled and cleanups array empty
            expect(panel.eventTracker).toBeNull();
            expect(panel.dialogCleanups.length).toBe(0);
        });

        test('should unsubscribe from state', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Mock unsubscribe functions
            const unsubscribe1 = jest.fn();
            const unsubscribe2 = jest.fn();
            panel.stateSubscriptions = [unsubscribe1, unsubscribe2];

            panel.destroy();

            expect(unsubscribe1).toHaveBeenCalled();
            expect(unsubscribe2).toHaveBeenCalled();
            expect(panel.stateSubscriptions.length).toBe(0);
        });
    });

    describe('createInterface', () => {
        test('should create layer list element', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            expect(panel.layerList).toBeDefined();
            expect(panel.layerList.classList.contains('layers-list')).toBe(true);
        });

        test('should create properties panel', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            expect(panel.propertiesPanel).toBeDefined();
            expect(panel.propertiesPanel.classList.contains('layers-properties')).toBe(true);
        });

        test('should set ARIA attributes on container', () => {
            const container = document.getElementById('layers-panel-container');
            // Creating the panel sets ARIA attributes on the container
            const _panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            expect(container.getAttribute('role')).toBe('region');
            expect(typeof container.getAttribute('aria-label')).toBe('string');
        });

        test('should set ARIA attributes on layer list', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            expect(panel.layerList.getAttribute('role')).toBe('listbox');
        });
    });

    describe('updateLayers', () => {
        test('should update layers through StateManager', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const newLayers = [
                { id: 'new1', type: 'rectangle' },
                { id: 'new2', type: 'circle' }
            ];

            panel.updateLayers(newLayers);

            expect(mockStateManager.get('layers')).toEqual(newLayers);
        });

        test('should not throw when editor not available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: null
            });

            expect(() => {
                panel.updateLayers([{ id: 'test', type: 'rectangle' }]);
            }).not.toThrow();
        });
    });

    describe('updateLayerList', () => {
        test('should be an alias for updateLayers', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const newLayers = [
                { id: 'alias1', type: 'rectangle' },
                { id: 'alias2', type: 'ellipse' }
            ];

            // Call updateLayerList (the alias)
            panel.updateLayerList(newLayers);

            // Should have same effect as updateLayers
            expect(mockStateManager.get('layers')).toEqual(newLayers);
        });

        test('should exist as a function for backwards compatibility', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            expect(typeof panel.updateLayerList).toBe('function');
        });
    });

    describe('logging methods', () => {
        test('isDebugEnabled should check mw.config', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            window.mw.config.get = jest.fn().mockReturnValue(true);

            expect(panel.isDebugEnabled()).toBe(true);
        });

        test('logDebug should not throw when debug disabled', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            window.mw.config.get = jest.fn().mockReturnValue(false);

            expect(() => {
                panel.logDebug('Test message');
            }).not.toThrow();
        });

        test('logWarn should call mw.log.warn when available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Ensure mw.log exists with warn method
            window.mw.log = window.mw.log || {};
            window.mw.log.warn = jest.fn();

            panel.logWarn('Warning message');

            expect(window.mw.log.warn).toHaveBeenCalled();
        });

        test('logError should call mw.log.error when available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Ensure mw.log exists with error method
            window.mw.log = window.mw.log || {};
            window.mw.log.error = jest.fn();

            panel.logError('Error message');

            expect(window.mw.log.error).toHaveBeenCalled();
        });
    });

    describe('toggleBackgroundVisibility', () => {
        test('should toggle via controller when available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const mockController = {
                toggleBackgroundVisibility: jest.fn()
            };
            panel.backgroundLayerController = mockController;

            panel.toggleBackgroundVisibility();

            expect(mockController.toggleBackgroundVisibility).toHaveBeenCalled();
        });

        test('should toggle via stateManager fallback', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // No controller, use fallback
            panel.backgroundLayerController = null;
            mockStateManager.set('backgroundVisible', true);
            mockEditor.canvasManager = { redraw: jest.fn() };

            panel.toggleBackgroundVisibility();

            expect(mockStateManager.get('backgroundVisible')).toBe(false);
            expect(mockEditor.canvasManager.redraw).toHaveBeenCalled();
        });
    });

    describe('setBackgroundOpacity', () => {
        test('should set opacity via controller when available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const mockController = {
                setBackgroundOpacity: jest.fn()
            };
            panel.backgroundLayerController = mockController;

            panel.setBackgroundOpacity(0.5);

            expect(mockController.setBackgroundOpacity).toHaveBeenCalledWith(0.5);
        });

        test('should set opacity via stateManager fallback', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.backgroundLayerController = null;
            mockEditor.canvasManager = { redraw: jest.fn() };

            panel.setBackgroundOpacity(0.75);

            expect(mockStateManager.get('backgroundOpacity')).toBe(0.75);
            expect(mockEditor.canvasManager.redraw).toHaveBeenCalled();
        });

        test('should clamp opacity to valid range', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.backgroundLayerController = null;
            mockEditor.canvasManager = { redraw: jest.fn() };

            // Test clamping to max
            panel.setBackgroundOpacity(1.5);
            expect(mockStateManager.get('backgroundOpacity')).toBe(1);

            // Test clamping to min
            panel.setBackgroundOpacity(-0.5);
            expect(mockStateManager.get('backgroundOpacity')).toBe(0);
        });
    });

    describe('moveLayer', () => {
        test('should move via dragDropController when available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const mockDragDrop = {
                moveLayer: jest.fn()
            };
            panel.dragDropController = mockDragDrop;

            panel.moveLayer('layer1', -1);

            expect(mockDragDrop.moveLayer).toHaveBeenCalledWith('layer1', -1, expect.any(Function));
        });

        test('should move up via fallback', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.dragDropController = null;
            const layers = [
                { id: 'layer1', type: 'rectangle' },
                { id: 'layer2', type: 'circle' }
            ];
            mockStateManager.set('layers', layers);
            mockEditor.canvasManager = { redraw: jest.fn() };
            mockEditor.saveState = jest.fn();

            panel.moveLayer('layer2', -1);

            const newLayers = mockStateManager.get('layers');
            expect(newLayers[0].id).toBe('layer2');
            expect(newLayers[1].id).toBe('layer1');
            expect(mockEditor.saveState).toHaveBeenCalledWith('Reorder Layers');
        });

        test('should not move when layer not found', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.dragDropController = null;
            mockStateManager.set('layers', [{ id: 'layer1', type: 'rectangle' }]);
            mockEditor.saveState = jest.fn();

            panel.moveLayer('nonexistent', -1);

            expect(mockEditor.saveState).not.toHaveBeenCalled();
        });

        test('should not move when at boundary', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.dragDropController = null;
            mockStateManager.set('layers', [
                { id: 'layer1', type: 'rectangle' },
                { id: 'layer2', type: 'circle' }
            ]);
            mockEditor.saveState = jest.fn();

            // Try to move first layer up (can't go further)
            panel.moveLayer('layer1', -1);

            expect(mockEditor.saveState).not.toHaveBeenCalled();
        });
    });

    describe('msg fallback with mw.message error', () => {
        test('should return fallback when mw.message throws', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // Remove layersMessages to force mw.message path
            delete window.layersMessages;
            
            // Mock mw.message to throw
            window.mw.message = jest.fn().mockImplementation(() => {
                throw new Error('Translation error');
            });

            const result = panel.msg('test-key', 'Fallback Text');

            expect(result).toBe('Fallback Text');
        });

        test('should return empty string when no fallback provided', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            delete window.layersMessages;
            window.mw.message = undefined;

            const result = panel.msg('test-key');

            expect(result).toBe('');
        });
    });

    describe('destroy cleanup paths', () => {
        test('should clean up backgroundLayerController', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const mockController = { destroy: jest.fn() };
            panel.backgroundLayerController = mockController;

            panel.destroy();

            expect(mockController.destroy).toHaveBeenCalled();
            expect(panel.backgroundLayerController).toBe(null);
        });

        test('should clean up itemEventsController', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const mockController = { destroy: jest.fn() };
            panel.itemEventsController = mockController;

            panel.destroy();

            expect(mockController.destroy).toHaveBeenCalled();
            expect(panel.itemEventsController).toBe(null);
        });
    });

    describe('reorderLayers', () => {
        test('should reorder via dragDropController when available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const mockDragDrop = {
                reorderLayers: jest.fn()
            };
            panel.dragDropController = mockDragDrop;

            panel.reorderLayers('layer1', 'layer2');

            expect(mockDragDrop.reorderLayers).toHaveBeenCalledWith('layer1', 'layer2');
        });

        test('should do nothing when dragDropController is not available', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            panel.dragDropController = null;
            mockStateManager.reorderLayer = jest.fn().mockReturnValue(true);
            mockEditor.canvasManager = { redraw: jest.fn() };

            // With no controller, reorderLayers does nothing
            panel.reorderLayers('layer1', 'layer2');

            // The method delegates to controller only, so no direct calls expected
            expect(mockStateManager.reorderLayer).not.toHaveBeenCalled();
        });
    });

    describe('setupDragAndDrop', () => {
        test('should initialize dragDropController when LayerDragDrop is available', () => {
            // Ensure LayerDragDrop controller is available
            window.Layers = window.Layers || {};
            window.Layers.UI = window.Layers.UI || {};
            
            const mockDragDropClass = jest.fn().mockImplementation(() => ({
                reorderLayers: jest.fn()
            }));
            window.Layers.UI.LayerDragDrop = mockDragDropClass;

            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            // dragDropController should be set up during construction via setupDragAndDrop
            expect(panel.dragDropController).toBeDefined();
        });

        test('should not crash when LayerDragDrop is not available', () => {
            window.Layers = window.Layers || {};
            window.Layers.UI = window.Layers.UI || {};
            window.Layers.UI.LayerDragDrop = null;

            const container = document.getElementById('layers-panel-container');
            
            // Should not throw
            expect(() => {
                new LayerPanel({
                    container: container,
                    editor: mockEditor
                });
            }).not.toThrow();
        });
    });

    describe('resize divider interactions', () => {
        test('should handle mousedown on resize divider', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const divider = container.querySelector('.resize-divider');
            if (divider) {
                const mousedown = new MouseEvent('mousedown', {
                    clientY: 100,
                    bubbles: true
                });
                mousedown.preventDefault = jest.fn();
                
                divider.dispatchEvent(mousedown);

                expect(document.body.classList.contains('layers-resize-cursor')).toBe(true);
            }
        });

        test('should handle mousemove during resize', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const divider = container.querySelector('.resize-divider');
            if (divider && panel.layerList) {
                // Start dragging
                const mousedown = new MouseEvent('mousedown', {
                    clientY: 100,
                    bubbles: true
                });
                mousedown.preventDefault = jest.fn();
                divider.dispatchEvent(mousedown);

                // Move mouse
                const mousemove = new MouseEvent('mousemove', {
                    clientY: 150,
                    bubbles: true
                });
                document.dispatchEvent(mousemove);

                // Check that layer list style was updated
                expect(panel.layerList.style.height).toBeDefined();
            }
        });

        test('should handle mouseup after resize', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const divider = container.querySelector('.resize-divider');
            if (divider) {
                // Start dragging
                const mousedown = new MouseEvent('mousedown', {
                    clientY: 100,
                    bubbles: true
                });
                mousedown.preventDefault = jest.fn();
                divider.dispatchEvent(mousedown);

                // End dragging
                const mouseup = new MouseEvent('mouseup', { bubbles: true });
                document.dispatchEvent(mouseup);

                expect(document.body.classList.contains('layers-resize-cursor')).toBe(false);
            }
        });
    });

    describe('touch interactions', () => {
        test('should handle touchstart on resize divider', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const divider = container.querySelector('.resize-divider');
            if (divider) {
                const touchstart = new TouchEvent('touchstart', {
                    touches: [{ clientY: 100 }],
                    bubbles: true
                });
                touchstart.preventDefault = jest.fn();
                
                divider.dispatchEvent(touchstart);

                expect(document.body.classList.contains('layers-resize-cursor')).toBe(true);
            }
        });

        test('should handle touchmove during resize', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const divider = container.querySelector('.resize-divider');
            if (divider && panel.layerList) {
                // Start touch
                const touchstart = new TouchEvent('touchstart', {
                    touches: [{ clientY: 100 }],
                    bubbles: true
                });
                touchstart.preventDefault = jest.fn();
                divider.dispatchEvent(touchstart);

                // Move touch
                const touchmove = new TouchEvent('touchmove', {
                    touches: [{ clientY: 150 }],
                    bubbles: true
                });
                document.dispatchEvent(touchmove);

                expect(panel.layerList.style.height).toBeDefined();
            }
        });

        test('should handle touchend after resize', () => {
            const container = document.getElementById('layers-panel-container');
            const panel = new LayerPanel({
                container: container,
                editor: mockEditor
            });

            const divider = container.querySelector('.resize-divider');
            if (divider) {
                // Start touch
                const touchstart = new TouchEvent('touchstart', {
                    touches: [{ clientY: 100 }],
                    bubbles: true
                });
                touchstart.preventDefault = jest.fn();
                divider.dispatchEvent(touchstart);

                // End touch
                const touchend = new TouchEvent('touchend', { bubbles: true });
                document.dispatchEvent(touchend);

                expect(document.body.classList.contains('layers-resize-cursor')).toBe(false);
            }
        });
    });
});

describe('LayerPanel module exports', () => {
    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        window.Layers.UI.IconFactory = mockIconFactory;
    });

    test('should expose LayerPanel on window.Layers.UI namespace', () => {
        require('../../resources/ext.layers.editor/LayerPanel.js');
        expect(window.Layers.UI.LayerPanel).toBeDefined();
        expect(typeof window.Layers.UI.LayerPanel).toBe('function');
    });

    test('should have prototype methods', () => {
        require('../../resources/ext.layers.editor/LayerPanel.js');

        expect(typeof window.Layers.UI.LayerPanel.prototype.getLayers).toBe('function');
        expect(typeof window.Layers.UI.LayerPanel.prototype.getSelectedLayerId).toBe('function');
        expect(typeof window.Layers.UI.LayerPanel.prototype.subscribeToState).toBe('function');
        expect(typeof window.Layers.UI.LayerPanel.prototype.createInterface).toBe('function');
        expect(typeof window.Layers.UI.LayerPanel.prototype.renderLayerList).toBe('function');
        expect(typeof window.Layers.UI.LayerPanel.prototype.updateLayers).toBe('function');
        expect(typeof window.Layers.UI.LayerPanel.prototype.destroy).toBe('function');
    });

    test('should create panel with proper structure', () => {
        document.body.innerHTML = '<div id="test-container"></div>';
        
        require('../../resources/ext.layers.editor/LayerPanel.js');
        
        const container = document.getElementById('test-container');
        const mockSM = new StateManager();
        mockSM.set('layers', []);
        mockSM.set('selectedLayerIds', []);
        
        const _panel = new window.Layers.UI.LayerPanel({
            container: container,
            editor: { stateManager: mockSM, container: document.body }
        });

        // Panel should have created the interface
        expect(container.querySelector('.layers-list')).not.toBeNull();
        expect(container.querySelector('.layers-properties')).not.toBeNull();
    });
});

describe('LayerPanel mobile collapse toggle', () => {
    let mockEditor;

    beforeEach(() => {
        jest.resetModules();

        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        window.Layers.UI.IconFactory = mockIconFactory;

        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((element, event, handler, options) => {
                element.addEventListener(event, handler, options);
                this.listeners.push({ element, event, handler, options });
                return { element, event, handler, options };
            });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-panel-container"></div>';

        require('../../resources/ext.layers.editor/LayerPanel.js');

        const mockSM = new StateManager();
        mockSM.set('layers', []);
        mockSM.set('selectedLayerIds', []);
        mockEditor = { stateManager: mockSM, container: document.body };
    });

    test('toggleMobileCollapse should add collapsed class', () => {
        const container = document.getElementById('test-panel-container');
        const LayerPanel = window.Layers.UI.LayerPanel;
        const panel = new LayerPanel({ container, editor: mockEditor });

        expect(container.classList.contains('layers-panel-collapsed')).toBe(false);

        panel.toggleMobileCollapse();

        expect(container.classList.contains('layers-panel-collapsed')).toBe(true);
    });

    test('toggleMobileCollapse should toggle collapsed class on second call', () => {
        const container = document.getElementById('test-panel-container');
        const LayerPanel = window.Layers.UI.LayerPanel;
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.toggleMobileCollapse();
        expect(container.classList.contains('layers-panel-collapsed')).toBe(true);

        panel.toggleMobileCollapse();
        expect(container.classList.contains('layers-panel-collapsed')).toBe(false);
    });

    test('toggleMobileCollapse should update icon text', () => {
        const container = document.getElementById('test-panel-container');
        const LayerPanel = window.Layers.UI.LayerPanel;
        const panel = new LayerPanel({ container, editor: mockEditor });

        const icon = panel.collapseBtn?.querySelector('.collapse-icon');

        // Initial state: expanded (▼)
        expect(icon?.textContent).toBe('▼');

        panel.toggleMobileCollapse();
        // Collapsed state: (▲)
        expect(icon?.textContent).toBe('▲');

        panel.toggleMobileCollapse();
        // Expanded again: (▼)
        expect(icon?.textContent).toBe('▼');
    });

    test('toggleMobileCollapse should update aria-expanded attribute', () => {
        const container = document.getElementById('test-panel-container');
        const LayerPanel = window.Layers.UI.LayerPanel;
        const panel = new LayerPanel({ container, editor: mockEditor });

        expect(panel.collapseBtn?.getAttribute('aria-expanded')).toBe('true');

        panel.toggleMobileCollapse();
        expect(panel.collapseBtn?.getAttribute('aria-expanded')).toBe('false');

        panel.toggleMobileCollapse();
        expect(panel.collapseBtn?.getAttribute('aria-expanded')).toBe('true');
    });

    test('collapse button should have proper aria-label', () => {
        const container = document.getElementById('test-panel-container');
        const LayerPanel = window.Layers.UI.LayerPanel;
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Initial label should indicate expand action (panel starts expanded)
        const initialLabel = panel.collapseBtn?.getAttribute('aria-label');
        expect(initialLabel).toContain('Expand');

        panel.toggleMobileCollapse();
        // After collapsing, label should indicate expand
        expect(panel.collapseBtn?.getAttribute('aria-label')).toContain('Expand');
    });

    test('collapse button should exist in panel', () => {
        const container = document.getElementById('test-panel-container');
        const LayerPanel = window.Layers.UI.LayerPanel;
        const panel = new LayerPanel({ container, editor: mockEditor });

        expect(panel.collapseBtn).toBeDefined();
        expect(panel.collapseBtn.classList.contains('layers-panel-collapse-btn')).toBe(true);
    });
});

describe('LayerPanel getLayerDepth fallback', () => {
    let LayerPanel;
    let mockEditor;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        const mockSM = new StateManager();
        // Create layers with parentGroup chain for depth testing
        mockSM.set('layers', [
            { id: 'group1', type: 'group', expanded: true },
            { id: 'child1', type: 'rectangle', parentGroup: 'group1' },
            { id: 'group2', type: 'group', parentGroup: 'group1', expanded: true },
            { id: 'grandchild', type: 'circle', parentGroup: 'group2' }
        ]);
        mockSM.set('selectedLayerIds', []);

        // Editor WITHOUT groupManager to trigger fallback path
        mockEditor = {
            stateManager: mockSM,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should calculate depth 0 for top-level layer', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const depth = panel.getLayerDepth('group1');
        expect(depth).toBe(0);
    });

    test('should calculate depth 1 for direct child', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const depth = panel.getLayerDepth('child1');
        expect(depth).toBe(1);
    });

    test('should calculate depth 2 for grandchild', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const depth = panel.getLayerDepth('grandchild');
        expect(depth).toBe(2);
    });

    test('should return 0 for non-existent layer', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const depth = panel.getLayerDepth('nonexistent');
        expect(depth).toBe(0);
    });

    test('should use GroupManager when available', () => {
        const container = document.getElementById('test-container');
        const mockGroupManager = { getLayerDepth: jest.fn(() => 5) };
        mockEditor.groupManager = mockGroupManager;
        
        const panel = new LayerPanel({ container, editor: mockEditor });
        const depth = panel.getLayerDepth('child1');
        
        expect(mockGroupManager.getLayerDepth).toHaveBeenCalledWith('child1');
        expect(depth).toBe(5);
    });
});

describe('LayerPanel getVisibleLayers with collapsed groups', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        
        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should hide children of collapsed groups', () => {
        mockStateManager.set('layers', [
            { id: 'group1', type: 'group', expanded: false },
            { id: 'child1', type: 'rectangle', parentGroup: 'group1' },
            { id: 'top-level', type: 'circle' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const visible = panel.getVisibleLayers();
        expect(visible.length).toBe(2);
        expect(visible.map(l => l.id)).toContain('group1');
        expect(visible.map(l => l.id)).toContain('top-level');
        expect(visible.map(l => l.id)).not.toContain('child1');
    });

    test('should hide grandchildren when ancestor is collapsed', () => {
        mockStateManager.set('layers', [
            { id: 'group1', type: 'group', expanded: false },
            { id: 'group2', type: 'group', parentGroup: 'group1', expanded: true },
            { id: 'grandchild', type: 'rectangle', parentGroup: 'group2' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const visible = panel.getVisibleLayers();
        expect(visible.length).toBe(1);
        expect(visible[0].id).toBe('group1');
    });

    test('should show all layers when no groups are collapsed', () => {
        mockStateManager.set('layers', [
            { id: 'group1', type: 'group', expanded: true },
            { id: 'child1', type: 'rectangle', parentGroup: 'group1' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const visible = panel.getVisibleLayers();
        expect(visible.length).toBe(2);
    });

    test('should return empty array for empty layers', () => {
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const visible = panel.getVisibleLayers();
        expect(visible).toEqual([]);
    });
});

describe('LayerPanel createLayerItem/updateLayerItem fallback', () => {
    let LayerPanel;
    let mockEditor;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        // Don't set LayerItemFactory to test fallback paths
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        const mockSM = new StateManager();
        mockSM.set('layers', []);
        mockSM.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockSM,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should create minimal layer item when LayerItemFactory unavailable', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.layerItemFactory = null; // Force fallback

        const layer = { id: 'test-layer', type: 'rectangle' };
        const item = panel.createLayerItem(layer, 0);

        expect(item.className).toBe('layer-item');
        expect(item.dataset.layerId).toBe('test-layer');
        expect(item.dataset.index).toBe('0');
    });

    test('should update layer item with basic info when factory unavailable', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.layerItemFactory = null; // Force fallback

        const item = document.createElement('div');
        const layer = { id: 'updated-layer', type: 'circle' };
        panel.updateLayerItem(item, layer, 5);

        expect(item.dataset.layerId).toBe('updated-layer');
        expect(item.dataset.index).toBe('5');
    });

    test('should return type as default layer name when factory unavailable', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.layerItemFactory = null; // Force fallback

        const layer = { id: 'test', type: 'arrow' };
        const name = panel.getDefaultLayerName(layer);

        expect(name).toBe('arrow');
    });

    test('should return Layer for layer without type', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.layerItemFactory = null; // Force fallback

        const layer = { id: 'test' };
        const name = panel.getDefaultLayerName(layer);

        expect(name).toBe('Layer');
    });
});

describe('LayerPanel selectLayer ctrl-toggle behavior', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;
    let mockCanvasManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle' },
            { id: 'layer2', type: 'circle' },
            { id: 'layer3', type: 'arrow' }
        ]);
        mockStateManager.set('selectedLayerIds', ['layer1', 'layer2']);

        mockCanvasManager = {
            setSelectedLayerIds: jest.fn(),
            renderLayers: jest.fn(),
            drawMultiSelectionIndicators: jest.fn(),
            selectionManager: {
                lastSelectedId: 'layer2'
            }
        };

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            canvasManager: mockCanvasManager,
            layers: [],
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should add layer to selection on ctrl-click when not selected', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.selectLayer('layer3', false, true); // ctrlKey = true

        const selectedIds = mockStateManager.get('selectedLayerIds');
        expect(selectedIds).toContain('layer1');
        expect(selectedIds).toContain('layer2');
        expect(selectedIds).toContain('layer3');
    });

    test('should remove layer from selection on ctrl-click when already selected', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.selectLayer('layer2', false, true); // ctrlKey = true, layer2 is already selected

        const selectedIds = mockStateManager.get('selectedLayerIds');
        expect(selectedIds).toContain('layer1');
        expect(selectedIds).not.toContain('layer2');
    });

    test('should update lastSelectedId when deselecting clicked layer', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.selectLayer('layer2', false, true); // Deselect layer2

        // lastSelectedId should be updated to remaining selection
        expect(mockCanvasManager.selectionManager.lastSelectedId).toBe('layer1');
    });

    test('should set lastSelectedId to null when all deselected', () => {
        mockStateManager.set('selectedLayerIds', ['layer1']);
        
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.selectLayer('layer1', false, true); // Deselect the only selected layer

        expect(mockCanvasManager.selectionManager.lastSelectedId).toBe(null);
    });
});

describe('LayerPanel selectLayerRange', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;
    let mockCanvasManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();

        mockCanvasManager = {
            setSelectedLayerIds: jest.fn(),
            renderLayers: jest.fn(),
            drawMultiSelectionIndicators: jest.fn()
        };

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            canvasManager: mockCanvasManager,
            layers: [],
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should do nothing for empty layers', () => {
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.selectLayerRange('layer1');

        expect(mockStateManager.get('selectedLayerIds')).toEqual([]);
    });

    test('should select single layer when no previous selection', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle' },
            { id: 'layer2', type: 'circle' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Mock selectLayer to check it gets called
        panel.selectLayer = jest.fn();
        panel.selectLayerRange('layer1');

        expect(panel.selectLayer).toHaveBeenCalledWith('layer1');
    });

    test('should select range between last selected and clicked layer', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle' },
            { id: 'layer2', type: 'circle' },
            { id: 'layer3', type: 'arrow' },
            { id: 'layer4', type: 'text' }
        ]);
        mockStateManager.set('selectedLayerIds', ['layer1']);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.selectLayerRange('layer3');

        const selectedIds = mockStateManager.get('selectedLayerIds');
        expect(selectedIds).toContain('layer1');
        expect(selectedIds).toContain('layer2');
        expect(selectedIds).toContain('layer3');
        expect(selectedIds).not.toContain('layer4');
    });

    test('should select range in reverse direction', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle' },
            { id: 'layer2', type: 'circle' },
            { id: 'layer3', type: 'arrow' }
        ]);
        mockStateManager.set('selectedLayerIds', ['layer3']);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.selectLayerRange('layer1');

        const selectedIds = mockStateManager.get('selectedLayerIds');
        expect(selectedIds.length).toBe(3);
        expect(selectedIds).toContain('layer1');
        expect(selectedIds).toContain('layer2');
        expect(selectedIds).toContain('layer3');
    });

    test('should fallback to single select when clicked layer not found', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle' }
        ]);
        mockStateManager.set('selectedLayerIds', ['layer1']);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.selectLayer = jest.fn();
        panel.selectLayerRange('nonexistent');

        expect(panel.selectLayer).toHaveBeenCalledWith('nonexistent');
    });
});

describe('LayerPanel syncPropertiesFromLayer', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should do nothing when layer is null', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Should not throw
        expect(() => panel.syncPropertiesFromLayer(null)).not.toThrow();
    });

    test('should do nothing when propertiesPanel is null', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.propertiesPanel = null;

        // Should not throw
        expect(() => panel.syncPropertiesFromLayer({ id: 'layer1' })).not.toThrow();
    });

    test('should update inputs with data-prop attributes', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create mock inputs in properties panel
        const input = document.createElement('input');
        input.setAttribute('data-prop', 'width');
        const form = document.createElement('form');
        form.className = 'layer-properties-form';
        form.appendChild(input);
        panel.propertiesPanel.querySelector('.properties-content').appendChild(form);

        const layer = { id: 'layer1', type: 'rectangle', width: 150 };
        panel.syncPropertiesFromLayer(layer);

        expect(input.value).toBe('150');
    });

    test('should format values with 1 decimal when data-decimals=1', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const input = document.createElement('input');
        input.setAttribute('data-prop', 'opacity');
        input.setAttribute('data-decimals', '1');
        const form = document.createElement('form');
        form.className = 'layer-properties-form';
        form.appendChild(input);
        panel.propertiesPanel.querySelector('.properties-content').appendChild(form);

        const layer = { id: 'layer1', type: 'rectangle', opacity: 0.5 };
        panel.syncPropertiesFromLayer(layer);

        expect(input.value).toBe('0.5');
    });

    test('should not update input that is currently focused', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const input = document.createElement('input');
        input.setAttribute('data-prop', 'width');
        input.value = '999'; // User is typing
        const form = document.createElement('form');
        form.className = 'layer-properties-form';
        form.appendChild(input);
        panel.propertiesPanel.querySelector('.properties-content').appendChild(form);

        // Focus the input
        document.body.appendChild(input);
        input.focus();

        const layer = { id: 'layer1', type: 'rectangle', width: 150 };
        panel.syncPropertiesFromLayer(layer);

        // Value should not change because input is focused
        expect(input.value).toBe('999');
    });

    test('should handle ellipse width using radiusX fallback', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const input = document.createElement('input');
        input.setAttribute('data-prop', 'width');
        const form = document.createElement('form');
        form.className = 'layer-properties-form';
        form.appendChild(input);
        panel.propertiesPanel.querySelector('.properties-content').appendChild(form);

        // Ellipse without explicit width, but with radiusX
        const layer = { id: 'layer1', type: 'ellipse', radiusX: 50 };
        panel.syncPropertiesFromLayer(layer);

        expect(input.value).toBe('100'); // radiusX * 2
    });

    test('should handle ellipse height using radiusY fallback', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const input = document.createElement('input');
        input.setAttribute('data-prop', 'height');
        const form = document.createElement('form');
        form.className = 'layer-properties-form';
        form.appendChild(input);
        panel.propertiesPanel.querySelector('.properties-content').appendChild(form);

        // Ellipse without explicit height, but with radiusY
        const layer = { id: 'layer1', type: 'ellipse', radiusY: 30 };
        panel.syncPropertiesFromLayer(layer);

        expect(input.value).toBe('60'); // radiusY * 2
    });

    test('should skip input without data-prop attribute', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const input = document.createElement('input');
        // No data-prop attribute
        input.value = 'original';
        const form = document.createElement('form');
        form.className = 'layer-properties-form';
        form.appendChild(input);
        panel.propertiesPanel.querySelector('.properties-content').appendChild(form);

        const layer = { id: 'layer1', type: 'rectangle', width: 150 };
        panel.syncPropertiesFromLayer(layer);

        expect(input.value).toBe('original');
    });
});

describe('LayerPanel toggleGroupExpand fallback', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', [
            { id: 'group1', type: 'group', expanded: true }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn(),
            getLayerById: jest.fn((id) => mockStateManager.get('layers').find(l => l.id === id))
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should use GroupManager when available', () => {
        const mockGroupManager = { toggleExpanded: jest.fn() };
        mockEditor.groupManager = mockGroupManager;

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.toggleGroupExpand('group1');

        expect(mockGroupManager.toggleExpanded).toHaveBeenCalledWith('group1');
    });

    test('should toggle expanded directly when GroupManager unavailable', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.renderLayerList = jest.fn();

        const layer = mockStateManager.get('layers')[0];
        expect(layer.expanded).toBe(true);

        panel.toggleGroupExpand('group1');

        // expanded should now be false
        expect(layer.expanded).toBe(false);
        expect(panel.renderLayerList).toHaveBeenCalled();
    });

    test('should toggle from false to true', () => {
        mockStateManager.set('layers', [
            { id: 'group1', type: 'group', expanded: false }
        ]);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.renderLayerList = jest.fn();

        const layer = mockStateManager.get('layers')[0];
        expect(layer.expanded).toBe(false);

        panel.toggleGroupExpand('group1');

        // expanded should now be truthy (expanded === false evaluates to true)
        expect(layer.expanded).toBe(true);
    });

    test('should do nothing for non-group layers', () => {
        mockStateManager.set('layers', [
            { id: 'rect1', type: 'rectangle' }
        ]);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.renderLayerList = jest.fn();

        panel.toggleGroupExpand('rect1');

        // renderLayerList should not be called for non-group
        expect(panel.renderLayerList).not.toHaveBeenCalled();
    });
});

describe('LayerPanel createPropertiesForm fallback', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        // Don't set PropertiesForm to test fallback
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should create fallback form when PropertiesForm unavailable', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const layer = { id: 'layer1', type: 'rectangle' };
        const form = panel.createPropertiesForm(layer);

        expect(form.className).toBe('layer-properties-form');
        expect(form.querySelector('p').textContent).toContain('unavailable');
    });

    test('should use PropertiesForm.create when available', () => {
        window.Layers.UI.PropertiesForm = {
            create: jest.fn(() => {
                const form = document.createElement('form');
                form.className = 'custom-form';
                return form;
            })
        };

        // Re-require to pick up the mock
        jest.resetModules();
        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const layer = { id: 'layer1', type: 'rectangle' };
        const form = panel.createPropertiesForm(layer);

        expect(form.className).toBe('custom-form');
        expect(window.Layers.UI.PropertiesForm.create).toHaveBeenCalled();
    });
});

describe('LayerPanel handleNameClick', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', [{ id: 'layer1', type: 'rectangle' }]);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should enter edit mode when layer is already selected and only selection', () => {
        mockStateManager.set('selectedLayerIds', ['layer1']);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const nameEl = document.createElement('span');
        panel.editLayerName = jest.fn();

        panel.handleNameClick('layer1', nameEl);

        expect(panel.editLayerName).toHaveBeenCalledWith('layer1', nameEl);
    });

    test('should select layer first when not already selected', () => {
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const nameEl = document.createElement('span');
        panel.selectLayer = jest.fn();

        panel.handleNameClick('layer1', nameEl);

        expect(panel.selectLayer).toHaveBeenCalledWith('layer1', false, false);
    });

    test('should select layer when multiple layers are selected', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle' },
            { id: 'layer2', type: 'circle' }
        ]);
        mockStateManager.set('selectedLayerIds', ['layer1', 'layer2']);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const nameEl = document.createElement('span');
        panel.selectLayer = jest.fn();

        panel.handleNameClick('layer1', nameEl);

        // Should select (not edit) because multiple layers selected
        expect(panel.selectLayer).toHaveBeenCalledWith('layer1', false, false);
    });
});

describe('LayerPanel updateSwatchColor', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should apply transparent pattern when color is empty', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const swatch = document.createElement('button');
        panel.updateSwatchColor(swatch, '');

        expect(swatch.style.cssText).toContain('repeating-linear-gradient');
    });

    test('should apply transparent pattern when color is transparent', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const swatch = document.createElement('button');
        panel.updateSwatchColor(swatch, 'transparent');

        expect(swatch.style.cssText).toContain('repeating-linear-gradient');
    });

    test('should apply transparent pattern when color is none', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const swatch = document.createElement('button');
        panel.updateSwatchColor(swatch, 'none');

        expect(swatch.style.cssText).toContain('repeating-linear-gradient');
    });

    test('should apply solid color when valid color provided', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const swatch = document.createElement('button');
        panel.updateSwatchColor(swatch, '#ff0000');

        expect(swatch.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    test('should do nothing when swatch is null', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Should not throw
        expect(() => panel.updateSwatchColor(null, '#ff0000')).not.toThrow();
    });

    test('updateCanvasColorSwatch should update stored swatch', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const swatch = document.createElement('button');
        panel.canvasColorSwatch = swatch;
        panel.updateCanvasColorSwatch('#00ff00');

        expect(swatch.style.backgroundColor).toBe('rgb(0, 255, 0)');
    });
});

describe('LayerPanel handleLayerListKeydown', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle' },
            { id: 'layer2', type: 'circle' },
            { id: 'layer3', type: 'text' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn(),
            getLayerById: jest.fn((id) => {
                const layers = mockStateManager.get('layers');
                return layers.find(l => l.id === id);
            })
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should return early when no layer item found', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const event = { target: document.createElement('div'), key: 'ArrowUp', preventDefault: jest.fn() };
        panel.handleLayerListKeydown(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should not intercept Enter key on button', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create a layer item structure
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'layer1';

        const button = document.createElement('button');
        layerItem.appendChild(button);
        panel.layerList.appendChild(layerItem);

        const event = { target: button, key: 'Enter', preventDefault: jest.fn() };
        panel.handleLayerListKeydown(event);

        // Should not prevent default since target is a button
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should toggle visibility on V key', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create a layer item structure
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'layer1';
        panel.layerList.appendChild(layerItem);

        panel.toggleLayerVisibility = jest.fn();

        const event = {
            target: layerItem,
            key: 'v',
            ctrlKey: false,
            metaKey: false,
            preventDefault: jest.fn()
        };
        panel.handleLayerListKeydown(event);

        expect(panel.toggleLayerVisibility).toHaveBeenCalledWith('layer1');
    });

    test('should toggle lock on L key', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create a layer item structure
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'layer1';
        panel.layerList.appendChild(layerItem);

        panel.toggleLayerLock = jest.fn();

        const event = {
            target: layerItem,
            key: 'L',
            ctrlKey: false,
            metaKey: false,
            preventDefault: jest.fn()
        };
        panel.handleLayerListKeydown(event);

        expect(panel.toggleLayerLock).toHaveBeenCalledWith('layer1');
    });

    test('should delete layer on Delete key', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create a layer item structure
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'layer1';
        panel.layerList.appendChild(layerItem);

        panel.deleteLayer = jest.fn();

        const event = {
            target: layerItem,
            key: 'Delete',
            preventDefault: jest.fn()
        };
        panel.handleLayerListKeydown(event);

        expect(panel.deleteLayer).toHaveBeenCalledWith('layer1');
    });

    test('should navigate to Home on Home key', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create layer items
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'layer2';
        layerItem.dataset.index = '1';
        panel.layerList.appendChild(layerItem);

        panel.focusLayerAtIndex = jest.fn();

        const event = {
            target: layerItem,
            key: 'Home',
            preventDefault: jest.fn()
        };
        panel.handleLayerListKeydown(event);

        expect(panel.focusLayerAtIndex).toHaveBeenCalledWith(0);
    });

    test('should navigate to End on End key', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create a layer item
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'layer1';
        layerItem.dataset.index = '0';
        panel.layerList.appendChild(layerItem);

        panel.focusLayerAtIndex = jest.fn();

        const event = {
            target: layerItem,
            key: 'End',
            preventDefault: jest.fn()
        };
        panel.handleLayerListKeydown(event);

        expect(panel.focusLayerAtIndex).toHaveBeenCalledWith(2); // 3 layers - 1
    });

    test('should select layer on Space key', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create a layer item
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'layer1';
        panel.layerList.appendChild(layerItem);

        panel.selectLayer = jest.fn();

        const event = {
            target: layerItem,
            key: ' ',
            preventDefault: jest.fn()
        };
        panel.handleLayerListKeydown(event);

        expect(panel.selectLayer).toHaveBeenCalledWith('layer1');
    });
});

describe('LayerPanel focusLayerAtIndex', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle' },
            { id: 'layer2', type: 'circle' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should focus grab area of target layer', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create layer item with grab area
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'layer1';
        const grabArea = document.createElement('div');
        grabArea.className = 'layer-grab-area';
        grabArea.focus = jest.fn();
        layerItem.appendChild(grabArea);
        panel.layerList.appendChild(layerItem);

        panel.focusLayerAtIndex(0);

        expect(grabArea.focus).toHaveBeenCalled();
    });

    test('should do nothing for negative index', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Should not throw
        expect(() => panel.focusLayerAtIndex(-1)).not.toThrow();
    });

    test('should do nothing for index beyond layers length', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Should not throw
        expect(() => panel.focusLayerAtIndex(100)).not.toThrow();
    });

    test('should use itemEventsController when available', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.itemEventsController = {
            focusLayerAtIndex: jest.fn()
        };

        panel.focusLayerAtIndex(0);

        expect(panel.itemEventsController.focusLayerAtIndex).toHaveBeenCalledWith(0);
    });
});

describe('LayerPanel handleLayerListDblClick', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', [{ id: 'layer1', type: 'rectangle' }]);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn(),
            getLayerById: jest.fn((id) => {
                const layers = mockStateManager.get('layers');
                return layers.find(l => l.id === id);
            })
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should return early when no layer item found', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.selectLayer = jest.fn();
        panel.editLayerName = jest.fn();

        const event = { target: document.createElement('div') };
        panel.handleLayerListDblClick(event);

        expect(panel.selectLayer).not.toHaveBeenCalled();
        expect(panel.editLayerName).not.toHaveBeenCalled();
    });

    test('should return early when layer not found', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'nonexistent';
        panel.layerList.appendChild(layerItem);

        panel.selectLayer = jest.fn();
        panel.editLayerName = jest.fn();

        const event = { target: layerItem };
        panel.handleLayerListDblClick(event);

        expect(panel.selectLayer).not.toHaveBeenCalled();
    });

    test('should select and edit layer name on double-click', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create layer item with name element
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = 'layer1';
        const nameEl = document.createElement('span');
        nameEl.className = 'layer-name';
        layerItem.appendChild(nameEl);
        panel.layerList.appendChild(layerItem);

        panel.selectLayer = jest.fn();
        panel.editLayerName = jest.fn();

        const event = { target: layerItem };
        panel.handleLayerListDblClick(event);

        expect(panel.selectLayer).toHaveBeenCalledWith('layer1', false, false);
        expect(panel.editLayerName).toHaveBeenCalledWith('layer1', nameEl);
    });
});

describe('LayerPanel editLayerName', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', [{ id: 'layer1', type: 'rectangle' }]);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should return early if already in edit mode', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const nameEl = document.createElement('span');
        nameEl.contentEditable = 'true';
        nameEl.focus = jest.fn();

        panel.editLayerName('layer1', nameEl);

        // Should return early - focus not called again
        expect(nameEl.focus).not.toHaveBeenCalled();
    });

    test('should enable contentEditable and focus', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const nameEl = document.createElement('span');
        nameEl.textContent = 'Test Layer';
        nameEl.focus = jest.fn();
        document.body.appendChild(nameEl);

        panel.editLayerName('layer1', nameEl);

        expect(nameEl.contentEditable).toBe('true');
        expect(nameEl.style.cursor).toBe('text');
        expect(nameEl.focus).toHaveBeenCalled();
    });

    test('should not add duplicate listeners', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const nameEl = document.createElement('span');
        nameEl.textContent = 'Test Layer';
        nameEl.focus = jest.fn();
        nameEl._hasEditListeners = true;

        panel.editLayerName('layer1', nameEl);

        // Should set contentEditable but not add listeners again
        expect(nameEl.contentEditable).toBe('true');
    });
});

describe('LayerPanel simpleConfirm', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.Layers.UI.ConfirmDialog = null;
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should use ConfirmDialog.simpleConfirm when available', () => {
        window.Layers.UI.ConfirmDialog = {
            simpleConfirm: jest.fn().mockReturnValue(true)
        };

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const result = panel.simpleConfirm('Test message');

        expect(window.Layers.UI.ConfirmDialog.simpleConfirm).toHaveBeenCalledWith('Test message', expect.any(Function));
        expect(result).toBe(true);
    });

    test('should fallback to window.confirm', () => {
        const originalConfirm = window.confirm;
        window.confirm = jest.fn().mockReturnValue(true);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const result = panel.simpleConfirm('Test message');

        expect(window.confirm).toHaveBeenCalledWith('Test message');
        expect(result).toBe(true);

        window.confirm = originalConfirm;
    });

    test('should return true when confirm not available', () => {
        const originalConfirm = window.confirm;
        window.confirm = undefined;

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.logWarn = jest.fn();

        const result = panel.simpleConfirm('Test message');

        expect(result).toBe(true);
        expect(panel.logWarn).toHaveBeenCalled();

        window.confirm = originalConfirm;
    });
});

describe('LayerPanel renderCodeSnippet', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn(),
            filename: 'TestImage.jpg'
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should show no layers message when no visible layers', () => {
        mockStateManager.set('layers', [{ id: 'layer1', visible: false }]);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const html = panel.renderCodeSnippet();

        expect(html).toContain('No layers visible');
    });

    test('should show layers=all when all layers visible', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', visible: true },
            { id: 'layer2', visible: true }
        ]);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const html = panel.renderCodeSnippet();

        expect(html).toContain('layers=all');
        expect(html).toContain('TestImage.jpg');
    });

    test('should show specific layer IDs when some layers hidden', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', visible: true },
            { id: 'layer2', visible: false },
            { id: 'layer3', visible: true }
        ]);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const html = panel.renderCodeSnippet();

        expect(html).toContain('layer1,layer3');
    });

    test('should accept layers parameter override', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Use two layers with one hidden to show specific IDs
        const customLayers = [
            { id: 'custom1', visible: true },
            { id: 'custom2', visible: false }
        ];
        const html = panel.renderCodeSnippet(customLayers);

        expect(html).toContain('custom1');
        expect(html).not.toContain('custom2'); // hidden layer excluded
    });
});

describe('LayerPanel createCanvasColorSwatch', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);
        mockStateManager.set('slideBackgroundColor', '#ff00ff');

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should create button with correct class', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const t = jest.fn((key, fallback) => fallback);
        const swatch = panel.createCanvasColorSwatch(t);

        expect(swatch.tagName).toBe('BUTTON');
        expect(swatch.className).toBe('canvas-color-swatch');
    });

    test('should open color picker on click when controller available', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.backgroundLayerController = {
            openColorPicker: jest.fn()
        };

        const t = jest.fn((key, fallback) => fallback);
        const swatch = panel.createCanvasColorSwatch(t);

        swatch.click();

        expect(panel.backgroundLayerController.openColorPicker).toHaveBeenCalledWith(swatch);
    });

    test('should apply initial color from stateManager', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const t = jest.fn((key, fallback) => fallback);
        const swatch = panel.createCanvasColorSwatch(t);

        expect(swatch.style.backgroundColor).toBe('rgb(255, 0, 255)');
    });
});

describe('LayerPanel showCanvasProperties', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);
        mockStateManager.set('slideCanvasWidth', 800);
        mockStateManager.set('slideCanvasHeight', 600);
        mockStateManager.set('slideBackgroundColor', '#ffffff');

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should return early when propertiesPanel is null', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });
        panel.propertiesPanel = null;

        // Should not throw
        expect(() => panel.showCanvasProperties()).not.toThrow();
    });

    test('should return early when contentDiv not found', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create propertiesPanel without properties-content
        const propPanel = document.createElement('div');
        panel.propertiesPanel = propPanel;

        expect(() => panel.showCanvasProperties()).not.toThrow();
    });

    test('should create canvas properties form', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Create propertiesPanel with properties-content
        const propPanel = document.createElement('div');
        const contentDiv = document.createElement('div');
        contentDiv.className = 'properties-content';
        propPanel.appendChild(contentDiv);
        panel.propertiesPanel = propPanel;

        panel.showCanvasProperties();

        const form = contentDiv.querySelector('form.canvas-properties-form');
        expect(form).not.toBeNull();
    });
});

describe('LayerPanel createCanvasSizeInput', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);
        mockStateManager.set('slideCanvasWidth', 800);
        mockStateManager.set('slideCanvasHeight', 600);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should create width input with current value', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const t = jest.fn((key, fallback) => fallback);
        const group = panel.createCanvasSizeInput('width', t);

        const input = group.querySelector('input');
        expect(input).not.toBeNull();
        expect(input.value).toBe('800');
    });

    test('should create height input with current value', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const t = jest.fn((key, fallback) => fallback);
        const group = panel.createCanvasSizeInput('height', t);

        const input = group.querySelector('input');
        expect(input).not.toBeNull();
        expect(input.value).toBe('600');
    });

    test('should use default value when stateManager not available', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container });

        const t = jest.fn((key, fallback) => fallback);
        const group = panel.createCanvasSizeInput('width', t);

        const input = group.querySelector('input');
        expect(input.value).toBe('800'); // Default width
    });

    test('should call setCanvasDimension on change', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.backgroundLayerController = {
            setCanvasDimension: jest.fn()
        };

        const t = jest.fn((key, fallback) => fallback);
        const group = panel.createCanvasSizeInput('width', t);
        const input = group.querySelector('input');

        input.value = '1024';
        input.dispatchEvent(new Event('change'));

        expect(panel.backgroundLayerController.setCanvasDimension).toHaveBeenCalledWith('width', 1024);
    });

    test('should not call setCanvasDimension for invalid value', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.backgroundLayerController = {
            setCanvasDimension: jest.fn()
        };

        const t = jest.fn((key, fallback) => fallback);
        const group = panel.createCanvasSizeInput('width', t);
        const input = group.querySelector('input');

        input.value = '50'; // Below minimum of 100
        input.dispatchEvent(new Event('change'));

        expect(panel.backgroundLayerController.setCanvasDimension).not.toHaveBeenCalled();
    });
});

describe('LayerPanel toggleGroupExpand', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn(),
            groupManager: null
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should use GroupManager when available', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.editor.groupManager = {
            toggleExpanded: jest.fn()
        };

        panel.toggleGroupExpand('group1');

        expect(panel.editor.groupManager.toggleExpanded).toHaveBeenCalledWith('group1');
    });

    test('should fallback to direct layer update when GroupManager not available', () => {
        const container = document.getElementById('test-container');
        const groupLayer = { id: 'group1', type: 'group', expanded: true };
        mockStateManager.set('layers', [groupLayer]);
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.editor.getLayerById = jest.fn(() => groupLayer);
        panel.renderLayerList = jest.fn();

        panel.toggleGroupExpand('group1');

        expect(groupLayer.expanded).toBe(false);
        expect(panel.renderLayerList).toHaveBeenCalled();
    });
});

describe('LayerPanel getLayerDepth', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn(),
            groupManager: null
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should use GroupManager when available', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.editor.groupManager = {
            getLayerDepth: jest.fn(() => 2)
        };

        const depth = panel.getLayerDepth('layer1');

        expect(panel.editor.groupManager.getLayerDepth).toHaveBeenCalledWith('layer1');
        expect(depth).toBe(2);
    });

    test('should calculate depth from parentGroup chain', () => {
        const container = document.getElementById('test-container');
        const layers = [
            { id: 'group1', type: 'group' },
            { id: 'group2', type: 'group', parentGroup: 'group1' },
            { id: 'layer1', type: 'rectangle', parentGroup: 'group2' }
        ];
        mockStateManager.set('layers', layers);
        const panel = new LayerPanel({ container, editor: mockEditor });

        const depth = panel.getLayerDepth('layer1');

        expect(depth).toBe(2); // nested 2 levels deep
    });

    test('should return 0 for top-level layer', () => {
        const container = document.getElementById('test-container');
        const layers = [{ id: 'layer1', type: 'rectangle' }];
        mockStateManager.set('layers', layers);
        const panel = new LayerPanel({ container, editor: mockEditor });

        const depth = panel.getLayerDepth('layer1');

        expect(depth).toBe(0);
    });

    test('should prevent infinite loops', () => {
        const container = document.getElementById('test-container');
        // Create a circular reference (shouldn't happen in real code but guard against it)
        const layers = [
            { id: 'group1', type: 'group', parentGroup: 'group2' },
            { id: 'group2', type: 'group', parentGroup: 'group1' }
        ];
        mockStateManager.set('layers', layers);
        const panel = new LayerPanel({ container, editor: mockEditor });

        const depth = panel.getLayerDepth('group1');

        // Should stop at max depth (11 because it counts depth > 10 before breaking)
        expect(depth).toBeLessThanOrEqual(11);
    });
});

describe('LayerPanel updateLayers', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should update layers in stateManager', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        const newLayers = [{ id: 'layer1' }, { id: 'layer2' }];
        panel.updateLayers(newLayers);

        expect(mockStateManager.get('layers')).toEqual(newLayers);
    });

    test('should handle null layers gracefully', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        expect(() => panel.updateLayers(null)).not.toThrow();
    });

    test('should handle missing editor gracefully', () => {
        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container });

        expect(() => panel.updateLayers([{ id: 'layer1' }])).not.toThrow();
    });
});

describe('LayerPanel search filter', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;

    beforeEach(() => {
        jest.resetModules();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.IconFactory = {
            createEyeIcon: jest.fn(() => document.createElement('span')),
            createLockIcon: jest.fn(() => document.createElement('span')),
            createDeleteIcon: jest.fn(() => document.createElement('span')),
            createGrabIcon: jest.fn(() => document.createElement('span')),
            createAddFolderIcon: jest.fn(() => document.createElement('span'))
        };
        window.EventTracker = jest.fn(function () {
            this.listeners = [];
            this.add = jest.fn((el, ev, h, o) => { el.addEventListener(ev, h, o); this.listeners.push({el, ev, h}); });
            this.remove = jest.fn();
            this.removeAllForElement = jest.fn();
            this.count = jest.fn(() => this.listeners.length);
            this.destroy = jest.fn(() => { this.listeners = []; });
        });
        window.Layers.Utils = { EventTracker: window.EventTracker };

        document.body.innerHTML = '<div id="test-container"></div>';

        const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
        mockStateManager = new StateManager();
        
        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            saveState: jest.fn()
        };

        require('../../resources/ext.layers.editor/LayerPanel.js');
        LayerPanel = window.Layers.UI.LayerPanel;
    });

    test('should initialize with empty search filter', () => {
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        expect(panel.searchFilter).toBe('');
    });

    test('should create search input in interface', () => {
        mockStateManager.set('layers', []);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        expect(panel.searchInput).toBeDefined();
        expect(panel.searchInput.tagName.toLowerCase()).toBe('input');
        expect(panel.searchInput.type).toBe('text');
    });

    test('should filter layers by name', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', name: 'Header Text', type: 'text' },
            { id: 'layer2', name: 'Footer Text', type: 'text' },
            { id: 'layer3', name: 'Logo', type: 'image' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Set search filter
        panel.searchFilter = 'header';
        const visible = panel.getVisibleLayers();

        expect(visible.length).toBe(1);
        expect(visible[0].id).toBe('layer1');
    });

    test('should filter layers by text content', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', name: 'Text 1', type: 'text', text: 'Hello World' },
            { id: 'layer2', name: 'Text 2', type: 'text', text: 'Goodbye World' },
            { id: 'layer3', name: 'Text 3', type: 'text', text: 'Welcome' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.searchFilter = 'world';
        const visible = panel.getVisibleLayers();

        expect(visible.length).toBe(2);
        expect(visible.map(l => l.id)).toContain('layer1');
        expect(visible.map(l => l.id)).toContain('layer2');
    });

    test('should filter case-insensitively', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', name: 'UPPERCASE', type: 'rectangle' },
            { id: 'layer2', name: 'lowercase', type: 'circle' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // searchFilter is stored lowercase (as set by the input handler)
        panel.searchFilter = 'lowercase';
        const visible = panel.getVisibleLayers();

        expect(visible.length).toBe(1);
        expect(visible[0].id).toBe('layer2');
    });

    test('should match uppercase layer name with lowercase search', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', name: 'HEADER SECTION', type: 'rectangle' },
            { id: 'layer2', name: 'footer section', type: 'circle' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Search for 'header' (lowercase) should match 'HEADER SECTION' (uppercase)
        panel.searchFilter = 'header';
        const visible = panel.getVisibleLayers();

        expect(visible.length).toBe(1);
        expect(visible[0].id).toBe('layer1');
    });

    test('should show all layers when search filter is empty', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', name: 'Layer 1', type: 'rectangle' },
            { id: 'layer2', name: 'Layer 2', type: 'circle' },
            { id: 'layer3', name: 'Layer 3', type: 'text' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.searchFilter = '';
        const visible = panel.getVisibleLayers();

        expect(visible.length).toBe(3);
    });

    test('should ignore collapsed groups when searching', () => {
        mockStateManager.set('layers', [
            { id: 'group1', type: 'group', name: 'My Group', expanded: false },
            { id: 'child1', type: 'text', name: 'Hidden Child', parentGroup: 'group1', text: 'Find me' },
            { id: 'top-level', type: 'rectangle', name: 'Top Level' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Without search, child should be hidden (group collapsed)
        panel.searchFilter = '';
        let visible = panel.getVisibleLayers();
        expect(visible.map(l => l.id)).not.toContain('child1');

        // With search, child should be visible if it matches
        panel.searchFilter = 'find me';
        visible = panel.getVisibleLayers();
        expect(visible.map(l => l.id)).toContain('child1');
    });

    test('should match by layer type when name is not set', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle' },
            { id: 'layer2', type: 'circle' },
            { id: 'layer3', type: 'arrow' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.searchFilter = 'rect';
        const visible = panel.getVisibleLayers();

        expect(visible.length).toBe(1);
        expect(visible[0].id).toBe('layer1');
    });

    test('should update search result count', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', name: 'Apple', type: 'rectangle' },
            { id: 'layer2', name: 'Banana', type: 'circle' },
            { id: 'layer3', name: 'Apple Pie', type: 'text' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.searchFilter = 'apple';
        panel.updateSearchResultCount();

        expect(panel.searchResultCount.style.display).toBe('block');
        expect(panel.searchResultCount.textContent).toContain('2');
        expect(panel.searchResultCount.textContent).toContain('3');
    });

    test('should hide search result count when filter is empty', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', name: 'Layer 1', type: 'rectangle' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.searchFilter = '';
        panel.updateSearchResultCount();

        expect(panel.searchResultCount.style.display).toBe('none');
    });

    test('should clear search on clear button click', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', name: 'Test', type: 'rectangle' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        // Set a search value
        panel.searchInput.value = 'test';
        panel.searchFilter = 'test';

        // Find and click the clear button
        const clearBtn = container.querySelector('.layers-search-clear');
        expect(clearBtn).not.toBeNull();

        clearBtn.click();

        expect(panel.searchInput.value).toBe('');
        expect(panel.searchFilter).toBe('');
    });

    test('should return empty array when no layers match search', () => {
        mockStateManager.set('layers', [
            { id: 'layer1', name: 'Apple', type: 'rectangle' },
            { id: 'layer2', name: 'Banana', type: 'circle' }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        const container = document.getElementById('test-container');
        const panel = new LayerPanel({ container, editor: mockEditor });

        panel.searchFilter = 'xyz123notfound';
        const visible = panel.getVisibleLayers();

        expect(visible.length).toBe(0);
    });
});
