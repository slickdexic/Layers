/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests for LayerPanel Multi-Select and Context Menu
 *
 * Tests Ctrl+click, Shift+click, double-click editing, and context menu functionality.
 */

const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
const HistoryManager = require('../../resources/ext.layers.editor/HistoryManager.js');

// Mock IconFactory
const mockIconFactory = {
    createSVGElement: jest.fn((tag) => document.createElementNS('http://www.w3.org/2000/svg', tag)),
    createEyeIcon: jest.fn(() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        return svg;
    }),
    createLockIcon: jest.fn(() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        return svg;
    }),
    createDeleteIcon: jest.fn(() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        return svg;
    }),
    createFolderIcon: jest.fn(() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        return svg;
    })
};

describe('LayerPanel Multi-Select', () => {
    let LayerPanel;
    let mockEditor;
    let mockStateManager;
    let panel;
    let container;

    beforeEach(() => {
        jest.resetModules();
        
        // Setup window globals
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        window.Layers.UI.IconFactory = mockIconFactory;
        
        // Mock mw object
        global.mw = {
            log: jest.fn(),
            config: {
                get: jest.fn(() => false)
            },
            notify: jest.fn()
        };

        // Create container
        document.body.innerHTML = '<div id="test-container"></div>';
        container = document.getElementById('test-container');

        // Create mock editor with state manager
        mockStateManager = new StateManager();
        mockStateManager.set('layers', [
            { id: 'layer1', type: 'rectangle', name: 'Layer 1', visible: true },
            { id: 'layer2', type: 'circle', name: 'Layer 2', visible: true },
            { id: 'layer3', type: 'text', name: 'Layer 3', visible: true },
            { id: 'layer4', type: 'arrow', name: 'Layer 4', visible: true }
        ]);
        mockStateManager.set('selectedLayerIds', []);

        mockEditor = {
            stateManager: mockStateManager,
            container: document.body,
            layers: mockStateManager.get('layers'),
            canvasManager: {
                setSelectedLayerIds: jest.fn(),
                renderLayers: jest.fn(),
                drawMultiSelectionIndicators: jest.fn(),
                selectionManager: {
                    lastSelectedId: null
                }
            },
            getLayerById: jest.fn((id) => {
                const layers = mockStateManager.get('layers');
                return layers.find(l => l.id === id);
            }),
            groupManager: {
                groupSelected: jest.fn(() => ({ success: true })),
                createGroup: jest.fn((layerIds) => ({ id: 'group-1', type: 'group', children: layerIds })),
                createFolder: jest.fn((layerIds) => ({ id: 'folder-1', type: 'group', children: layerIds || [] })),
                ungroup: jest.fn(() => ({ success: true }))
            },
            updateLayer: jest.fn(),
            saveState: jest.fn(),
            removeLayer: jest.fn(),
            duplicateSelected: jest.fn()
        };

        // Load LayerPanel
        LayerPanel = require('../../resources/ext.layers.editor/LayerPanel.js');
        panel = new window.Layers.UI.LayerPanel({
            container: container,
            editor: mockEditor
        });
    });

    afterEach(() => {
        if (panel && panel.destroy) {
            panel.destroy();
        }
        delete global.mw;
    });

    describe('handleLayerListClick with modifiers', () => {
        test('should add to selection with Ctrl+click', () => {
            // First, select layer1
            mockStateManager.set('selectedLayerIds', ['layer1']);
            
            // Create a mock click event with ctrlKey
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer2';
            
            const event = new MouseEvent('click', {
                ctrlKey: true,
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: layerItem });
            
            panel.handleLayerListClick(event);
            
            const selectedIds = mockStateManager.get('selectedLayerIds');
            expect(selectedIds).toContain('layer1');
            expect(selectedIds).toContain('layer2');
        });

        test('should remove from selection with Ctrl+click on already selected layer', () => {
            // Select both layers
            mockStateManager.set('selectedLayerIds', ['layer1', 'layer2']);
            
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer2';
            
            const event = new MouseEvent('click', {
                ctrlKey: true,
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: layerItem });
            
            panel.handleLayerListClick(event);
            
            const selectedIds = mockStateManager.get('selectedLayerIds');
            expect(selectedIds).toContain('layer1');
            expect(selectedIds).not.toContain('layer2');
        });

        test('should select range with Shift+click', () => {
            // Select layer1 first
            mockStateManager.set('selectedLayerIds', ['layer1']);
            
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer3';
            
            const event = new MouseEvent('click', {
                shiftKey: true,
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: layerItem });
            
            panel.handleLayerListClick(event);
            
            const selectedIds = mockStateManager.get('selectedLayerIds');
            // Should select layer1, layer2, layer3
            expect(selectedIds.length).toBe(3);
            expect(selectedIds).toContain('layer1');
            expect(selectedIds).toContain('layer2');
            expect(selectedIds).toContain('layer3');
        });

        test('should select single layer on regular click', () => {
            mockStateManager.set('selectedLayerIds', ['layer1', 'layer2']);
            
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer3';
            
            const event = new MouseEvent('click', {
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: layerItem });
            
            panel.handleLayerListClick(event);
            
            const selectedIds = mockStateManager.get('selectedLayerIds');
            expect(selectedIds.length).toBe(1);
            expect(selectedIds).toContain('layer3');
        });

        test('should select layer when clicking on layer name (not edit)', () => {
            mockStateManager.set('selectedLayerIds', []);
            
            const nameEl = document.createElement('span');
            nameEl.className = 'layer-name';
            
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer2';
            layerItem.appendChild(nameEl);
            
            const event = new MouseEvent('click', {
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: nameEl });
            
            panel.handleLayerListClick(event);
            
            const selectedIds = mockStateManager.get('selectedLayerIds');
            expect(selectedIds).toContain('layer2');
        });
    });

    describe('handleLayerListDblClick', () => {
        test('should enable editing on double-click on layer item', () => {
            const nameEl = document.createElement('span');
            nameEl.className = 'layer-name';
            nameEl.textContent = 'Layer 1';
            nameEl.focus = jest.fn();
            
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer1';
            layerItem.appendChild(nameEl);
            
            // Mock querySelector on layerItem
            layerItem.querySelector = jest.fn((selector) => {
                if (selector === '.layer-name') return nameEl;
                return null;
            });
            
            const event = new MouseEvent('dblclick', { bubbles: true });
            Object.defineProperty(event, 'target', { value: layerItem });
            
            // Mock getSelection
            const mockRange = {
                selectNodeContents: jest.fn(),
                collapse: jest.fn()
            };
            const mockSelection = {
                removeAllRanges: jest.fn(),
                addRange: jest.fn()
            };
            global.document.createRange = jest.fn(() => mockRange);
            global.window.getSelection = jest.fn(() => mockSelection);
            
            panel.handleLayerListDblClick(event);
            
            expect(nameEl.focus).toHaveBeenCalled();
        });

        test('should not throw on double-click when no name element found', () => {
            const grabArea = document.createElement('div');
            grabArea.className = 'layer-grab-area';
            
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer1';
            layerItem.appendChild(grabArea);
            
            // Mock querySelector to return null for .layer-name
            layerItem.querySelector = jest.fn(() => null);
            
            const event = new MouseEvent('dblclick', { bubbles: true });
            Object.defineProperty(event, 'target', { value: grabArea });
            
            // Should not throw
            expect(() => panel.handleLayerListDblClick(event)).not.toThrow();
        });
    });

    describe('createGroupFromSelection', () => {
        test('should create folder even with no layers selected', () => {
            mockStateManager.set('selectedLayerIds', []);
            
            panel.createGroupFromSelection();
            
            // createFolder should be called (can create empty folders)
            expect(mockEditor.groupManager.createFolder).toHaveBeenCalledWith([]);
        });

        test('should create folder with single layer selected', () => {
            mockStateManager.set('selectedLayerIds', ['layer1']);
            
            panel.createGroupFromSelection();
            
            expect(mockEditor.groupManager.createFolder).toHaveBeenCalledWith(['layer1']);
        });

        test('should call groupManager.createFolder when 2+ layers selected', () => {
            mockStateManager.set('selectedLayerIds', ['layer1', 'layer2']);
            
            panel.createGroupFromSelection();
            
            expect(mockEditor.groupManager.createFolder).toHaveBeenCalledWith(['layer1', 'layer2']);
        });

        test('should show success notification after creating folder', () => {
            mockStateManager.set('selectedLayerIds', ['layer1', 'layer2']);
            
            panel.createGroupFromSelection();
            
            expect(mw.notify).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'success' })
            );
        });
    });

    describe('handleLayerContextMenu', () => {
        test('should create context menu on right-click', () => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer1';
            
            const event = new MouseEvent('contextmenu', {
                clientX: 100,
                clientY: 200,
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: layerItem });
            event.preventDefault = jest.fn();
            
            panel.handleLayerContextMenu(event);
            
            expect(event.preventDefault).toHaveBeenCalled();
            expect(document.querySelector('.layers-context-menu')).toBeTruthy();
        });

        test('should close context menu when calling closeLayerContextMenu', () => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer1';
            
            const event = new MouseEvent('contextmenu', {
                clientX: 100,
                clientY: 200,
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: layerItem });
            event.preventDefault = jest.fn();
            
            panel.handleLayerContextMenu(event);
            expect(document.querySelector('.layers-context-menu')).toBeTruthy();
            
            panel.closeLayerContextMenu();
            expect(document.querySelector('.layers-context-menu')).toBeFalsy();
        });

        test('should disable Group option when less than 2 layers selected', () => {
            mockStateManager.set('selectedLayerIds', ['layer1']);
            
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer1';
            
            const event = new MouseEvent('contextmenu', {
                clientX: 100,
                clientY: 200,
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: layerItem });
            event.preventDefault = jest.fn();
            
            panel.handleLayerContextMenu(event);
            
            const menuItems = document.querySelectorAll('.layers-context-menu-item');
            const groupItem = Array.from(menuItems).find(item => 
                item.textContent.includes('Group')
            );
            expect(groupItem.disabled).toBe(true);
        });

        test('should enable Group option when 2+ layers selected', () => {
            mockStateManager.set('selectedLayerIds', ['layer1', 'layer2']);
            
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = 'layer1';
            
            const event = new MouseEvent('contextmenu', {
                clientX: 100,
                clientY: 200,
                bubbles: true
            });
            Object.defineProperty(event, 'target', { value: layerItem });
            event.preventDefault = jest.fn();
            
            panel.handleLayerContextMenu(event);
            
            const menuItems = document.querySelectorAll('.layers-context-menu-item');
            const groupItem = Array.from(menuItems).find(item => 
                item.textContent.includes('Group') && !item.textContent.includes('Ungroup')
            );
            expect(groupItem.disabled).toBe(false);
        });
    });

    describe('ungroupLayer', () => {
        test('should call groupManager.ungroup', () => {
            panel.ungroupLayer('group1');
            
            expect(mockEditor.groupManager.ungroup).toHaveBeenCalledWith('group1');
        });

        test('should show success notification after ungrouping', () => {
            panel.ungroupLayer('group1');
            
            expect(mw.notify).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'success' })
            );
        });

        test('should do nothing when groupId is null', () => {
            panel.ungroupLayer(null);
            
            expect(mockEditor.groupManager.ungroup).not.toHaveBeenCalled();
        });
    });
});
