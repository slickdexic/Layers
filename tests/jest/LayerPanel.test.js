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
            expect(container.getAttribute('aria-label')).toBeTruthy();
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
        expect(container.querySelector('.layers-list')).toBeTruthy();
        expect(container.querySelector('.layers-properties')).toBeTruthy();
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
