/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests for LayerItemFactory
 */

const LayerItemFactory = require('../../resources/ext.layers.editor/ui/LayerItemFactory.js');

describe('LayerItemFactory', () => {
    let factory;
    let mockConfig;

    beforeEach(() => {
        // Reset window.Layers
        window.Layers = {
            UI: {},
            Constants: {
                LAYER_TYPES: {
                    TEXT: 'text',
                    RECTANGLE: 'rectangle',
                    CIRCLE: 'circle',
                    ELLIPSE: 'ellipse',
                    POLYGON: 'polygon',
                    STAR: 'star',
                    ARROW: 'arrow',
                    LINE: 'line',
                    PATH: 'path',
                    BLUR: 'blur',
                    GROUP: 'group'
                }
            }
        };

        mockConfig = {
            msg: jest.fn((key, fallback) => fallback),
            getSelectedLayerId: jest.fn(() => null),
            getSelectedLayerIds: jest.fn(() => []),
            addTargetListener: jest.fn(),
            onMoveLayer: jest.fn(),
            onToggleGroupExpand: jest.fn(),
            getLayerDepth: jest.fn(() => 0)
        };

        factory = new LayerItemFactory(mockConfig);
    });

    describe('constructor', () => {
        test('should create factory with config', () => {
            expect(factory.config).toBe(mockConfig);
            expect(factory.msg).toBe(mockConfig.msg);
        });

        test('should create factory with default config', () => {
            const defaultFactory = new LayerItemFactory({});
            
            expect(typeof defaultFactory.msg).toBe('function');
            expect(typeof defaultFactory.getSelectedLayerId).toBe('function');
            expect(typeof defaultFactory.getSelectedLayerIds).toBe('function');
            expect(typeof defaultFactory.addTargetListener).toBe('function');
            expect(typeof defaultFactory.onMoveLayer).toBe('function');
        });

        test('should use fallback for missing msg function', () => {
            const defaultFactory = new LayerItemFactory({});
            expect(defaultFactory.msg('key', 'fallback')).toBe('fallback');
        });
    });

    describe('createEyeIcon', () => {
        test('should delegate to IconFactory when available', () => {
            const mockIcon = document.createElement('svg');
            window.Layers.UI.IconFactory = {
                createEyeIcon: jest.fn().mockReturnValue(mockIcon)
            };

            const icon = factory.createEyeIcon(true);

            expect(window.Layers.UI.IconFactory.createEyeIcon).toHaveBeenCalledWith(true);
            expect(icon).toBe(mockIcon);
        });

        test('should return span when IconFactory not available', () => {
            const icon = factory.createEyeIcon(true);
            expect(icon.tagName).toBe('SPAN');
        });

        test('should pass visible=false to IconFactory', () => {
            const mockIcon = document.createElement('svg');
            window.Layers.UI.IconFactory = {
                createEyeIcon: jest.fn().mockReturnValue(mockIcon)
            };

            factory.createEyeIcon(false);

            expect(window.Layers.UI.IconFactory.createEyeIcon).toHaveBeenCalledWith(false);
        });
    });

    describe('createLockIcon', () => {
        test('should delegate to IconFactory when available', () => {
            const mockIcon = document.createElement('svg');
            window.Layers.UI.IconFactory = {
                createLockIcon: jest.fn().mockReturnValue(mockIcon)
            };

            const icon = factory.createLockIcon(true);

            expect(window.Layers.UI.IconFactory.createLockIcon).toHaveBeenCalledWith(true);
            expect(icon).toBe(mockIcon);
        });

        test('should return span when IconFactory not available', () => {
            const icon = factory.createLockIcon(false);
            expect(icon.tagName).toBe('SPAN');
        });
    });

    describe('createDeleteIcon', () => {
        test('should delegate to IconFactory when available', () => {
            const mockIcon = document.createElement('svg');
            window.Layers.UI.IconFactory = {
                createDeleteIcon: jest.fn().mockReturnValue(mockIcon)
            };

            const icon = factory.createDeleteIcon();

            expect(window.Layers.UI.IconFactory.createDeleteIcon).toHaveBeenCalled();
            expect(icon).toBe(mockIcon);
        });

        test('should return span when IconFactory not available', () => {
            const icon = factory.createDeleteIcon();
            expect(icon.tagName).toBe('SPAN');
        });
    });

    describe('getDefaultLayerName', () => {
        test('should return "Text: " prefix for text layers', () => {
            const layer = { type: 'text', text: 'Hello World' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Text: Hello World');
        });

        test('should truncate long text to 20 chars', () => {
            const layer = { type: 'text', text: 'This is a very long text that should be truncated' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Text: This is a very long ');
        });

        test('should show "Empty" for text layer without text', () => {
            const layer = { type: 'text' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Text: Empty');
        });

        test('should return "Rectangle" for rectangle layers', () => {
            const layer = { type: 'rectangle' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Rectangle');
        });

        test('should return "Circle" for circle layers', () => {
            const layer = { type: 'circle' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Circle');
        });

        test('should return "Ellipse" for ellipse layers', () => {
            const layer = { type: 'ellipse' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Ellipse');
        });

        test('should return "Polygon" for polygon layers', () => {
            const layer = { type: 'polygon' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Polygon');
        });

        test('should return "Star" for star layers', () => {
            const layer = { type: 'star' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Star');
        });

        test('should return "Arrow" for arrow layers', () => {
            const layer = { type: 'arrow' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Arrow');
        });

        test('should return "Line" for line layers', () => {
            const layer = { type: 'line' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Line');
        });

        test('should return "Drawing" for path layers', () => {
            const layer = { type: 'path' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Drawing');
        });

        test('should return "Blur Effect" for blur layers', () => {
            const layer = { type: 'blur' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Blur Effect');
        });

        test('should return "Layer" for unknown types', () => {
            const layer = { type: 'unknown' };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Layer');
        });
    });

    describe('createLayerItem', () => {
        test('should create layer item with correct class and data attributes', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);

            expect(item.className).toBe('layer-item');
            expect(item.dataset.layerId).toBe('layer1');
            expect(item.dataset.index).toBe('0');
            expect(item.draggable).toBe(true);
        });

        test('should set ARIA role="option" attribute', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);

            expect(item.getAttribute('role')).toBe('option');
        });

        test('should set aria-selected=false when not selected', () => {
            mockConfig.getSelectedLayerIds.mockReturnValue([]);
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);

            expect(item.getAttribute('aria-selected')).toBe('false');
            expect(item.classList.contains('selected')).toBe(false);
        });

        test('should set aria-selected=true and add selected class when selected', () => {
            mockConfig.getSelectedLayerIds.mockReturnValue(['layer1']);
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);

            expect(item.getAttribute('aria-selected')).toBe('true');
            expect(item.classList.contains('selected')).toBe(true);
        });

        test('should use layer.name for aria-label when available', () => {
            const layer = { id: 'layer1', type: 'rectangle', name: 'My Rectangle' };
            const item = factory.createLayerItem(layer, 0);

            expect(item.getAttribute('aria-label')).toBe('My Rectangle');
        });

        test('should create grab area with correct attributes', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);
            const grabArea = item.querySelector('.layer-grab-area');

            expect(grabArea).toBeTruthy();
            expect(grabArea.getAttribute('tabindex')).toBe('0');
            expect(grabArea.getAttribute('role')).toBe('button');
        });

        test('should add keyboard listener for arrow keys', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            factory.createLayerItem(layer, 0);

            expect(mockConfig.addTargetListener).toHaveBeenCalled();
            const [element, event] = mockConfig.addTargetListener.mock.calls[0];
            expect(event).toBe('keydown');
        });

        test('should create visibility button', () => {
            const layer = { id: 'layer1', type: 'rectangle', visible: true };
            const item = factory.createLayerItem(layer, 0);
            const visibilityBtn = item.querySelector('.layer-visibility');

            expect(visibilityBtn).toBeTruthy();
            expect(visibilityBtn.type).toBe('button');
            expect(visibilityBtn.getAttribute('aria-label')).toBe('Toggle visibility');
        });

        test('should create name element with contentEditable', () => {
            const layer = { id: 'layer1', type: 'rectangle', name: 'Test Layer' };
            const item = factory.createLayerItem(layer, 0);
            const nameEl = item.querySelector('.layer-name');

            expect(nameEl).toBeTruthy();
            // contentEditable can be boolean true or string 'true' depending on browser
            expect(nameEl.contentEditable === true || nameEl.contentEditable === 'true').toBe(true);
            expect(nameEl.textContent).toBe('Test Layer');
        });

        test('should create lock button', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);
            const lockBtn = item.querySelector('.layer-lock');

            expect(lockBtn).toBeTruthy();
            expect(lockBtn.type).toBe('button');
            expect(lockBtn.getAttribute('aria-label')).toBe('Toggle lock');
        });

        test('should create delete button', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);
            const deleteBtn = item.querySelector('.layer-delete');

            expect(deleteBtn).toBeTruthy();
            expect(deleteBtn.type).toBe('button');
            expect(deleteBtn.getAttribute('aria-label')).toBe('Delete layer');
        });

        test('should create grab SVG with circles', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);
            const svg = item.querySelector('svg');

            expect(svg).toBeTruthy();
            expect(svg.getAttribute('aria-hidden')).toBe('true');
            const circles = svg.querySelectorAll('circle');
            expect(circles.length).toBe(4);
        });
    });

    describe('updateLayerItem', () => {
        let item;
        let layer;

        beforeEach(() => {
            layer = { id: 'layer1', type: 'rectangle', visible: true, locked: false };
            item = factory.createLayerItem(layer, 0);
        });

        test('should update data attributes', () => {
            const updatedLayer = { id: 'layer2', type: 'rectangle' };
            factory.updateLayerItem(item, updatedLayer, 5);

            expect(item.dataset.layerId).toBe('layer2');
            expect(item.dataset.index).toBe('5');
        });

        test('should update selection state to selected', () => {
            mockConfig.getSelectedLayerIds.mockReturnValue(['layer1']);
            factory.updateLayerItem(item, layer, 0);

            expect(item.getAttribute('aria-selected')).toBe('true');
            expect(item.classList.contains('selected')).toBe(true);
        });

        test('should update selection state to deselected', () => {
            item.classList.add('selected');
            mockConfig.getSelectedLayerIds.mockReturnValue([]);
            factory.updateLayerItem(item, layer, 0);

            expect(item.getAttribute('aria-selected')).toBe('false');
            expect(item.classList.contains('selected')).toBe(false);
        });

        test('should update grab area aria-label', () => {
            const updatedLayer = { id: 'layer1', type: 'rectangle', name: 'Updated Name' };
            factory.updateLayerItem(item, updatedLayer, 0);

            const grabArea = item.querySelector('.layer-grab-area');
            expect(grabArea.getAttribute('aria-label')).toContain('Updated Name');
        });

        test('should update visibility icon', () => {
            const mockIcon = document.createElement('svg');
            mockIcon.id = 'new-eye-icon';
            window.Layers.UI.IconFactory = {
                createEyeIcon: jest.fn().mockReturnValue(mockIcon),
                createLockIcon: jest.fn().mockReturnValue(document.createElement('svg'))
            };

            const updatedLayer = { id: 'layer1', type: 'rectangle', visible: false };
            factory.updateLayerItem(item, updatedLayer, 0);

            const visibilityBtn = item.querySelector('.layer-visibility');
            expect(visibilityBtn.querySelector('#new-eye-icon')).toBeTruthy();
        });

        test('should update name when not being edited', () => {
            const updatedLayer = { id: 'layer1', type: 'rectangle', name: 'New Name' };
            factory.updateLayerItem(item, updatedLayer, 0);

            const nameEl = item.querySelector('.layer-name');
            expect(nameEl.textContent).toBe('New Name');
        });

        test('should not update name when same as current', () => {
            const nameEl = item.querySelector('.layer-name');
            nameEl.textContent = 'Same Name';

            const updatedLayer = { id: 'layer1', type: 'rectangle', name: 'Same Name' };
            factory.updateLayerItem(item, updatedLayer, 0);

            // Name should stay the same
            expect(nameEl.textContent).toBe('Same Name');
        });

        test('should update lock icon', () => {
            const mockIcon = document.createElement('svg');
            mockIcon.id = 'new-lock-icon';
            window.Layers.UI.IconFactory = {
                createEyeIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createLockIcon: jest.fn().mockReturnValue(mockIcon)
            };

            const updatedLayer = { id: 'layer1', type: 'rectangle', locked: true };
            factory.updateLayerItem(item, updatedLayer, 0);

            const lockBtn = item.querySelector('.layer-lock');
            expect(lockBtn.querySelector('#new-lock-icon')).toBeTruthy();
        });

        test('should handle missing grab area gracefully', () => {
            const grabArea = item.querySelector('.layer-grab-area');
            grabArea.remove();

            expect(() => factory.updateLayerItem(item, layer, 0)).not.toThrow();
        });

        test('should handle missing visibility button gracefully', () => {
            const visibilityBtn = item.querySelector('.layer-visibility');
            visibilityBtn.remove();

            expect(() => factory.updateLayerItem(item, layer, 0)).not.toThrow();
        });

        test('should handle missing name element gracefully', () => {
            const nameEl = item.querySelector('.layer-name');
            nameEl.remove();

            expect(() => factory.updateLayerItem(item, layer, 0)).not.toThrow();
        });

        test('should handle missing lock button gracefully', () => {
            const lockBtn = item.querySelector('.layer-lock');
            lockBtn.remove();

            expect(() => factory.updateLayerItem(item, layer, 0)).not.toThrow();
        });
    });

    describe('keyboard navigation in grab area', () => {
        test('should call onMoveLayer with -1 for ArrowUp', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            factory.createLayerItem(layer, 0);

            // Get the keydown handler from addTargetListener call
            const [, , handler] = mockConfig.addTargetListener.mock.calls[0];
            
            const event = {
                key: 'ArrowUp',
                preventDefault: jest.fn()
            };
            handler(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockConfig.onMoveLayer).toHaveBeenCalledWith('layer1', -1);
        });

        test('should call onMoveLayer with 1 for ArrowDown', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            factory.createLayerItem(layer, 0);

            const [, , handler] = mockConfig.addTargetListener.mock.calls[0];
            
            const event = {
                key: 'ArrowDown',
                preventDefault: jest.fn()
            };
            handler(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockConfig.onMoveLayer).toHaveBeenCalledWith('layer1', 1);
        });

        test('should not call onMoveLayer for other keys', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            factory.createLayerItem(layer, 0);

            const [, , handler] = mockConfig.addTargetListener.mock.calls[0];
            
            const event = {
                key: 'Enter',
                preventDefault: jest.fn()
            };
            handler(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(mockConfig.onMoveLayer).not.toHaveBeenCalled();
        });
    });

    describe('group layers', () => {
        test('should return "Group" for group layers', () => {
            const layer = { type: 'group', children: [] };
            const name = factory.getDefaultLayerName(layer);
            expect(name).toBe('Group');
        });

        test('should add layer-item-group class for group layers', () => {
            const layer = { id: 'group1', type: 'group', children: ['layer1'], expanded: true };
            const item = factory.createLayerItem(layer, 0);

            expect(item.classList.contains('layer-item-group')).toBe(true);
        });

        test('should create expand toggle for group layers', () => {
            const layer = { id: 'group1', type: 'group', children: ['layer1'], expanded: true };
            const item = factory.createLayerItem(layer, 0);
            const toggle = item.querySelector('.layer-expand-toggle');

            expect(toggle).toBeTruthy();
            expect(toggle.type).toBe('button');
            expect(toggle.getAttribute('aria-expanded')).toBe('true');
        });

        test('should set aria-expanded=false for collapsed groups', () => {
            const layer = { id: 'group1', type: 'group', children: ['layer1'], expanded: false };
            const item = factory.createLayerItem(layer, 0);
            const toggle = item.querySelector('.layer-expand-toggle');

            expect(toggle.getAttribute('aria-expanded')).toBe('false');
        });

        test('should not create expand toggle for non-group layers', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);
            const toggle = item.querySelector('.layer-expand-toggle');

            expect(toggle).toBeNull();
        });

        test('should apply indentation for child layers', () => {
            mockConfig.getLayerDepth.mockReturnValue(2);
            const layer = { id: 'layer1', type: 'rectangle', parentGroup: 'group1' };
            const item = factory.createLayerItem(layer, 0);

            expect(item.style.paddingLeft).toBe('40px'); // 2 * 20px
            expect(item.classList.contains('layer-item-child')).toBe(true);
        });

        test('should not apply indentation for top-level layers', () => {
            mockConfig.getLayerDepth.mockReturnValue(0);
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);

            expect(item.style.paddingLeft).toBe('');
            expect(item.classList.contains('layer-item-child')).toBe(false);
        });

        test('should use folder icon for group layers', () => {
            const mockFolderIcon = document.createElement('svg');
            mockFolderIcon.id = 'folder-icon';
            window.Layers.UI.IconFactory = {
                createFolderIcon: jest.fn().mockReturnValue(mockFolderIcon),
                createEyeIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createLockIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createDeleteIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createExpandIcon: jest.fn().mockReturnValue(document.createElement('svg'))
            };

            const layer = { id: 'group1', type: 'group', children: [], expanded: true };
            const item = factory.createLayerItem(layer, 0);
            const grabArea = item.querySelector('.layer-grab-area');

            expect(grabArea.querySelector('#folder-icon')).toBeTruthy();
            expect(window.Layers.UI.IconFactory.createFolderIcon).toHaveBeenCalledWith(true);
        });

        test('should use expand icon in toggle', () => {
            const mockExpandIcon = document.createElement('svg');
            mockExpandIcon.id = 'expand-icon';
            window.Layers.UI.IconFactory = {
                createExpandIcon: jest.fn().mockReturnValue(mockExpandIcon),
                createFolderIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createEyeIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createLockIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createDeleteIcon: jest.fn().mockReturnValue(document.createElement('svg'))
            };

            const layer = { id: 'group1', type: 'group', children: [], expanded: true };
            const item = factory.createLayerItem(layer, 0);
            const toggle = item.querySelector('.layer-expand-toggle');

            expect(toggle.querySelector('#expand-icon')).toBeTruthy();
            expect(window.Layers.UI.IconFactory.createExpandIcon).toHaveBeenCalledWith(true);
        });

        test('should call onToggleGroupExpand when expand toggle clicked', () => {
            const layer = { id: 'group1', type: 'group', children: [], expanded: true };
            factory.createLayerItem(layer, 0);

            // Find the click handler call for the expand toggle
            const toggleCall = mockConfig.addTargetListener.mock.calls.find(
                call => call[1] === 'click'
            );
            expect(toggleCall).toBeTruthy();

            // Simulate click
            const event = { stopPropagation: jest.fn() };
            toggleCall[2](event);

            expect(event.stopPropagation).toHaveBeenCalled();
            expect(mockConfig.onToggleGroupExpand).toHaveBeenCalledWith('group1');
        });

        test('should use text fallback when IconFactory not available for expand toggle', () => {
            const layer = { id: 'group1', type: 'group', children: [], expanded: true };
            const item = factory.createLayerItem(layer, 0);
            const toggle = item.querySelector('.layer-expand-toggle');

            // Without IconFactory, should use text fallback
            expect(toggle.textContent).toBe('▼');
        });

        test('should use collapsed text when group is collapsed and IconFactory not available', () => {
            const layer = { id: 'group1', type: 'group', children: [], expanded: false };
            const item = factory.createLayerItem(layer, 0);
            const toggle = item.querySelector('.layer-expand-toggle');

            expect(toggle.textContent).toBe('▶');
        });
    });

    describe('updateLayerItem with groups', () => {
        test('should update expand toggle state', () => {
            const mockExpandIcon = document.createElement('svg');
            window.Layers.UI.IconFactory = {
                createExpandIcon: jest.fn().mockReturnValue(mockExpandIcon),
                createFolderIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createEyeIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createLockIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createDeleteIcon: jest.fn().mockReturnValue(document.createElement('svg'))
            };

            const layer = { id: 'group1', type: 'group', children: [], expanded: true };
            const item = factory.createLayerItem(layer, 0);

            // Update to collapsed
            const updatedLayer = { id: 'group1', type: 'group', children: [], expanded: false };
            factory.updateLayerItem(item, updatedLayer, 0);

            const toggle = item.querySelector('.layer-expand-toggle');
            expect(toggle.getAttribute('aria-expanded')).toBe('false');
        });

        test('should add expand toggle when layer becomes a group', () => {
            mockConfig.getLayerDepth.mockReturnValue(0);
            const layer = { id: 'layer1', type: 'rectangle' };
            const item = factory.createLayerItem(layer, 0);

            // Verify no toggle initially
            expect(item.querySelector('.layer-expand-toggle')).toBeNull();

            // Update to group type
            window.Layers.UI.IconFactory = {
                createExpandIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createFolderIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createEyeIcon: jest.fn().mockReturnValue(document.createElement('svg')),
                createLockIcon: jest.fn().mockReturnValue(document.createElement('svg'))
            };

            const updatedLayer = { id: 'layer1', type: 'group', children: [], expanded: true };
            factory.updateLayerItem(item, updatedLayer, 0);

            expect(item.querySelector('.layer-expand-toggle')).toBeTruthy();
            expect(item.classList.contains('layer-item-group')).toBe(true);
        });

        test('should remove expand toggle when layer is no longer a group', () => {
            mockConfig.getLayerDepth.mockReturnValue(0);
            const layer = { id: 'group1', type: 'group', children: [], expanded: true };
            const item = factory.createLayerItem(layer, 0);

            // Verify toggle exists
            expect(item.querySelector('.layer-expand-toggle')).toBeTruthy();

            // Update to rectangle type
            const updatedLayer = { id: 'group1', type: 'rectangle' };
            factory.updateLayerItem(item, updatedLayer, 0);

            expect(item.querySelector('.layer-expand-toggle')).toBeNull();
            expect(item.classList.contains('layer-item-group')).toBe(false);
        });

        test('should update indentation when depth changes', () => {
            mockConfig.getLayerDepth.mockReturnValue(1);
            const layer = { id: 'layer1', type: 'rectangle', parentGroup: 'group1' };
            const item = factory.createLayerItem(layer, 0);

            expect(item.style.paddingLeft).toBe('20px');
            expect(item.classList.contains('layer-item-child')).toBe(true);

            // Change depth to 0 (ungroup)
            mockConfig.getLayerDepth.mockReturnValue(0);
            const updatedLayer = { id: 'layer1', type: 'rectangle' };
            factory.updateLayerItem(item, updatedLayer, 0);

            expect(item.style.paddingLeft).toBe('');
            expect(item.classList.contains('layer-item-child')).toBe(false);
        });
    });

    describe('module exports', () => {
        test('should be a function class', () => {
            expect(typeof LayerItemFactory).toBe('function');
        });
    });
});
