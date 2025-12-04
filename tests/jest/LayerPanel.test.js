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
        // Setup window globals
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        window.IconFactory = mockIconFactory;
        window.ColorPickerDialog = null;
        window.ConfirmDialog = null;
        window.PropertiesForm = null;

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
        LayerPanel = window.LayerPanel;
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

            // Mock mw.message
            window.mw.message = jest.fn().mockReturnValue({
                text: jest.fn().mockReturnValue('Translated Message')
            });

            const result = panel.msg('test-key', 'Fallback');

            expect(result).toBe('Translated Message');
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
            window.IconFactory = null;
            
            // Reload LayerPanel without IconFactory
            jest.resetModules();
            require('../../resources/ext.layers.editor/LayerPanel.js');
            const LP = window.LayerPanel;

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
});

describe('LayerPanel module exports', () => {
    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        window.IconFactory = mockIconFactory;
    });

    test('should expose LayerPanel on window', () => {
        require('../../resources/ext.layers.editor/LayerPanel.js');
        expect(window.LayerPanel).toBeDefined();
        expect(typeof window.LayerPanel).toBe('function');
    });

    test('should have prototype methods', () => {
        require('../../resources/ext.layers.editor/LayerPanel.js');

        expect(typeof window.LayerPanel.prototype.getLayers).toBe('function');
        expect(typeof window.LayerPanel.prototype.getSelectedLayerId).toBe('function');
        expect(typeof window.LayerPanel.prototype.subscribeToState).toBe('function');
        expect(typeof window.LayerPanel.prototype.createInterface).toBe('function');
        expect(typeof window.LayerPanel.prototype.renderLayerList).toBe('function');
        expect(typeof window.LayerPanel.prototype.updateLayers).toBe('function');
        expect(typeof window.LayerPanel.prototype.destroy).toBe('function');
    });

    test('should create panel with proper structure', () => {
        document.body.innerHTML = '<div id="test-container"></div>';
        
        require('../../resources/ext.layers.editor/LayerPanel.js');
        
        const container = document.getElementById('test-container');
        const mockSM = new StateManager();
        mockSM.set('layers', []);
        mockSM.set('selectedLayerIds', []);
        
        const _panel = new window.LayerPanel({
            container: container,
            editor: { stateManager: mockSM, container: document.body }
        });

        // Panel should have created the interface
        expect(container.querySelector('.layers-list')).toBeTruthy();
        expect(container.querySelector('.layers-properties')).toBeTruthy();
    });
});
