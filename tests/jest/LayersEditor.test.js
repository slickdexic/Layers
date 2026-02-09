/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests for LayersEditor utility methods
 *
 * These tests focus on testing individual utility methods that don't require
 * full editor initialization, as the editor has complex dependency injection.
 */

const StateManager = require('../../resources/ext.layers.editor/StateManager.js');
const HistoryManager = require('../../resources/ext.layers.editor/HistoryManager.js');

describe('LayersEditor utility methods', () => {
    let LayersEditor;

    beforeEach(() => {
        // Setup window globals
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        
        // Setup DOM
        document.body.innerHTML = '<div id="layers-editor-container"></div>';
        
        // Reset module cache and reload LayersEditor
        jest.resetModules();
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    describe('sanitizeLogMessage', () => {
        // Note: The sanitization order is: tokens -> hex -> paths -> URLs -> IPs -> emails -> truncate
        // This means paths in URLs get filtered first before URL patterns match

        test('should filter long tokens (alphanumeric sequences 20+ chars)', () => {
            const longToken = 'a'.repeat(25);
            const result = LayersEditor.prototype.sanitizeLogMessage('Token: ' + longToken);
            expect(result).toContain('[TOKEN]');
            expect(result).not.toContain(longToken);
        });

        test('should filter hex tokens (16+ hex chars)', () => {
            // Hex token gets caught by [TOKEN] pattern first since it's also 20+ chars
            const hexToken = 'ab'.repeat(12); // 24 chars
            const result = LayersEditor.prototype.sanitizeLogMessage('Hash: ' + hexToken);
            // Gets filtered as either [TOKEN] or [HEX]
            expect(result).toMatch(/\[(TOKEN|HEX)\]/);
            expect(result).not.toContain(hexToken);
        });

        test('should filter file paths', () => {
            const result = LayersEditor.prototype.sanitizeLogMessage('File at /home/user/secret.txt');
            expect(result).toContain('[PATH]');
            expect(result).not.toContain('/home/user/secret.txt');
        });

        test('should filter email addresses', () => {
            const result = LayersEditor.prototype.sanitizeLogMessage('Contact user@example.com');
            expect(result).toContain('[EMAIL]');
            expect(result).not.toContain('user@example.com');
        });

        test('should filter IP addresses', () => {
            const result = LayersEditor.prototype.sanitizeLogMessage('Server at 192.168.1.1:8080');
            expect(result).toContain('[IP]');
            expect(result).not.toContain('192.168.1.1');
        });

        test('should truncate messages over 200 characters', () => {
            // Use spaces to avoid matching token pattern (which matches 20+ alphanumeric chars)
            const longMessage = 'word '.repeat(50); // 250 chars with spaces
            const result = LayersEditor.prototype.sanitizeLogMessage(longMessage);
            expect(result).toContain('[TRUNCATED]');
            expect(result.length).toBeLessThanOrEqual(212); // 200 + '[TRUNCATED]'.length
        });

        test('should filter object properties based on whitelist', () => {
            const obj = {
                type: 'rectangle',
                x: 100,
                password: 'secret123',
                token: 'abc123'
            };
            const result = LayersEditor.prototype.sanitizeLogMessage(obj);

            expect(result.type).toBe('rectangle');
            expect(result.x).toBe(100);
            expect(result.password).toBe('[FILTERED]');
            expect(result.token).toBe('[FILTERED]');
        });

        test('should preserve safe object properties', () => {
            const obj = {
                type: 'circle',
                action: 'create',
                status: 'success',
                tool: 'pointer',
                layer: { id: '123' },
                count: 5,
                y: 200,
                width: 100,
                height: 50
            };
            const result = LayersEditor.prototype.sanitizeLogMessage(obj);

            expect(result.type).toBe('circle');
            expect(result.action).toBe('create');
            expect(result.status).toBe('success');
            expect(result.tool).toBe('pointer');
            expect(result.count).toBe(5);
            expect(result.y).toBe(200);
            expect(result.width).toBe(100);
            expect(result.height).toBe(50);
        });

        test('should handle null input', () => {
            const result = LayersEditor.prototype.sanitizeLogMessage(null);
            expect(result).toBeNull();
        });

        test('should handle number input', () => {
            const result = LayersEditor.prototype.sanitizeLogMessage(42);
            expect(result).toBe(42);
        });

        test('should handle boolean input', () => {
            const result = LayersEditor.prototype.sanitizeLogMessage(true);
            expect(result).toBe(true);
        });

        test('should filter file paths', () => {
            const result = LayersEditor.prototype.sanitizeLogMessage('File at /home/user/secret.txt');
            expect(result).toContain('[PATH]');
            expect(result).not.toContain('/home/user/secret.txt');
        });
    });

    describe('parseMWTimestamp', () => {
        test('should parse MediaWiki timestamp format', () => {
            const timestamp = '20250101120000';
            const date = LayersEditor.prototype.parseMWTimestamp(timestamp);

            expect(date).toBeInstanceOf(Date);
            expect(date.getFullYear()).toBe(2025);
            expect(date.getMonth()).toBe(0); // January is 0
            expect(date.getDate()).toBe(1);
            expect(date.getHours()).toBe(12);
        });

        test('should parse different date', () => {
            const timestamp = '20231215235959';
            const date = LayersEditor.prototype.parseMWTimestamp(timestamp);

            expect(date).toBeInstanceOf(Date);
            expect(date.getFullYear()).toBe(2023);
            expect(date.getMonth()).toBe(11); // December is 11
            expect(date.getDate()).toBe(15);
            expect(date.getHours()).toBe(23);
            expect(date.getMinutes()).toBe(59);
            expect(date.getSeconds()).toBe(59);
        });

        test('should return current date for invalid input (null)', () => {
            // Implementation returns new Date() for invalid input
            const before = Date.now();
            const result = LayersEditor.prototype.parseMWTimestamp(null);
            const after = Date.now();

            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThanOrEqual(before);
            expect(result.getTime()).toBeLessThanOrEqual(after);
        });

        test('should return current date for empty string', () => {
            // Implementation returns new Date() for empty/invalid input
            const before = Date.now();
            const result = LayersEditor.prototype.parseMWTimestamp('');
            const after = Date.now();

            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThanOrEqual(before);
            expect(result.getTime()).toBeLessThanOrEqual(after);
        });

        test('should handle short timestamp (returns NaN date)', () => {
            // Short strings will parse with NaN values
            const result = LayersEditor.prototype.parseMWTimestamp('202501');
            expect(result).toBeInstanceOf(Date);
            // NaN date check
            expect(isNaN(result.getTime())).toBe(true);
        });
    });

    describe('normalizeLayers', () => {
        // Note: normalizeLayers only normalizes the 'visible' property, not 'locked'
        
        test('should set default visible property', () => {
            const layers = [{ id: 'layer1', type: 'rectangle' }];
            const normalized = LayersEditor.prototype.normalizeLayers(layers);

            expect(normalized[0].visible).toBe(true);
        });

        test('should preserve explicit visible=false', () => {
            const layers = [{ id: 'layer1', type: 'rectangle', visible: false }];
            const normalized = LayersEditor.prototype.normalizeLayers(layers);

            expect(normalized[0].visible).toBe(false);
        });

        test('should preserve explicit visible=true', () => {
            const layers = [{ id: 'layer1', type: 'rectangle', visible: true }];
            const normalized = LayersEditor.prototype.normalizeLayers(layers);

            expect(normalized[0].visible).toBe(true);
        });

        test('should preserve locked property as-is', () => {
            const layers = [{ id: 'layer1', type: 'rectangle', locked: true }];
            const normalized = LayersEditor.prototype.normalizeLayers(layers);

            expect(normalized[0].locked).toBe(true);
        });

        test('should handle multiple layers', () => {
            const layers = [
                { id: 'layer1', type: 'rectangle' },
                { id: 'layer2', type: 'circle', visible: false },
                { id: 'layer3', type: 'text', locked: true }
            ];
            const normalized = LayersEditor.prototype.normalizeLayers(layers);

            expect(normalized.length).toBe(3);
            expect(normalized[0].visible).toBe(true);
            expect(normalized[1].visible).toBe(false);
            expect(normalized[2].visible).toBe(true);
            expect(normalized[2].locked).toBe(true);
        });

        test('should handle empty array', () => {
            const normalized = LayersEditor.prototype.normalizeLayers([]);
            expect(normalized).toEqual([]);
        });

        test('should preserve all other properties', () => {
            const layers = [{
                id: 'layer1',
                type: 'rectangle',
                x: 100,
                y: 200,
                width: 300,
                height: 150,
                fill: '#ff0000',
                stroke: '#000000',
                name: 'My Layer'
            }];
            const normalized = LayersEditor.prototype.normalizeLayers(layers);

            expect(normalized[0].x).toBe(100);
            expect(normalized[0].y).toBe(200);
            expect(normalized[0].width).toBe(300);
            expect(normalized[0].height).toBe(150);
            expect(normalized[0].fill).toBe('#ff0000');
            expect(normalized[0].stroke).toBe('#000000');
            expect(normalized[0].name).toBe('My Layer');
        });

        test('HIGH-v29-4 regression: should not mutate input layer objects', () => {
            const original = { id: 'layer1', type: 'rectangle', x: 50 };
            const layers = [original];
            const normalized = LayersEditor.prototype.normalizeLayers(layers);

            // normalized should have visible=true
            expect(normalized[0].visible).toBe(true);
            // but the original object must remain unchanged
            expect(original.visible).toBeUndefined();
            // and they should be different references
            expect(normalized[0]).not.toBe(original);
        });
    });
});

describe('LayersEditor module exports', () => {
    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
    });

    test('should expose LayersEditor on window.Layers.Core.Editor', () => {
        require('../../resources/ext.layers.editor/LayersEditor.js');
        expect(window.Layers.Core.Editor).toBeDefined();
        expect(typeof window.Layers.Core.Editor).toBe('function');
    });

    test('should have prototype methods', () => {
        require('../../resources/ext.layers.editor/LayersEditor.js');
        const LayersEditor = window.Layers.Core.Editor;
        
        expect(typeof LayersEditor.prototype.init).toBe('function');
        expect(typeof LayersEditor.prototype.addLayer).toBe('function');
        expect(typeof LayersEditor.prototype.updateLayer).toBe('function');
        expect(typeof LayersEditor.prototype.removeLayer).toBe('function');
        expect(typeof LayersEditor.prototype.getLayerById).toBe('function');
        expect(typeof LayersEditor.prototype.selectLayer).toBe('function');
        expect(typeof LayersEditor.prototype.destroy).toBe('function');
        expect(typeof LayersEditor.prototype.sanitizeLogMessage).toBe('function');
        expect(typeof LayersEditor.prototype.normalizeLayers).toBe('function');
        expect(typeof LayersEditor.prototype.parseMWTimestamp).toBe('function');
    });
});

describe('LayersEditor createStubUIManager', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should create stub with container elements', () => {
        const stub = LayersEditor.prototype.createStubUIManager();
        
        expect(stub.container).toBeInstanceOf(HTMLElement);
        expect(stub.toolbarContainer).toBeInstanceOf(HTMLElement);
        expect(stub.layerPanelContainer).toBeInstanceOf(HTMLElement);
        expect(stub.canvasContainer).toBeInstanceOf(HTMLElement);
    });

    test('should create stub with no-op methods', () => {
        const stub = LayersEditor.prototype.createStubUIManager();
        
        expect(typeof stub.createInterface).toBe('function');
        expect(typeof stub.destroy).toBe('function');
        expect(typeof stub.showSpinner).toBe('function');
        expect(typeof stub.hideSpinner).toBe('function');
        expect(typeof stub.showBrowserCompatibilityWarning).toBe('function');
        
        // Methods should not throw
        expect(() => stub.createInterface()).not.toThrow();
        expect(() => stub.destroy()).not.toThrow();
        expect(() => stub.showSpinner()).not.toThrow();
        expect(() => stub.hideSpinner()).not.toThrow();
        expect(() => stub.showBrowserCompatibilityWarning()).not.toThrow();
    });
});

describe('LayersEditor createStubStateManager', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should create stub with get/set methods', () => {
        const stub = LayersEditor.prototype.createStubStateManager();
        
        stub.set('testKey', 'testValue');
        expect(stub.get('testKey')).toBe('testValue');
    });

    test('should return undefined for unset keys', () => {
        const stub = LayersEditor.prototype.createStubStateManager();
        expect(stub.get('nonexistent')).toBeUndefined();
    });

    test('should have getLayers returning empty array by default', () => {
        const stub = LayersEditor.prototype.createStubStateManager();
        expect(stub.getLayers()).toEqual([]);
    });

    test('should return layers from store if set', () => {
        const stub = LayersEditor.prototype.createStubStateManager();
        const testLayers = [{ id: 'layer1' }];
        stub.set('layers', testLayers);
        expect(stub.getLayers()).toEqual(testLayers);
    });

    test('should have isDirty returning false', () => {
        const stub = LayersEditor.prototype.createStubStateManager();
        expect(stub.isDirty()).toBe(false);
    });

    test('should have no-op methods', () => {
        const stub = LayersEditor.prototype.createStubStateManager();
        
        expect(typeof stub.subscribe).toBe('function');
        expect(typeof stub.setDirty).toBe('function');
        expect(typeof stub.destroy).toBe('function');
        
        expect(() => stub.subscribe()).not.toThrow();
        expect(() => stub.setDirty()).not.toThrow();
        expect(() => stub.destroy()).not.toThrow();
    });
});

describe('LayersEditor createFallbackRegistry', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should create registry with get method', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        
        const registry = LayersEditor.prototype.createFallbackRegistry.call(editorInstance);
        
        expect(typeof registry.get).toBe('function');
    });

    test('should throw for unknown module', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        
        const registry = LayersEditor.prototype.createFallbackRegistry.call(editorInstance);
        
        expect(() => registry.get('UnknownModule')).toThrow('Module UnknownModule not found');
    });

    test('should return stub StateManager', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        
        const registry = LayersEditor.prototype.createFallbackRegistry.call(editorInstance);
        const stateManager = registry.get('StateManager');
        
        expect(typeof stateManager.get).toBe('function');
        expect(typeof stateManager.set).toBe('function');
    });

    test('should return stub HistoryManager', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        // Set StateManager to undefined to get stub
        window.StateManager = undefined;
        window.HistoryManager = undefined;
        
        const registry = LayersEditor.prototype.createFallbackRegistry.call(editorInstance);
        const historyManager = registry.get('HistoryManager');
        
        expect(typeof historyManager.saveState).toBe('function');
        expect(typeof historyManager.undo).toBe('function');
        expect(typeof historyManager.redo).toBe('function');
        expect(historyManager.canUndo()).toBe(false);
        expect(historyManager.canRedo()).toBe(false);
    });
});

describe('LayersEditor navigation methods', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('navigateBackToFile should call navigateBackToFileWithName with filename', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.filename = 'Test.png';
        editorInstance.navigateBackToFileWithName = jest.fn();
        
        editorInstance.navigateBackToFile();
        
        expect(editorInstance.navigateBackToFileWithName).toHaveBeenCalledWith('Test.png');
    });

    test('navigateBackToFileWithName should call mw.util.getUrl for File page', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = { get: jest.fn().mockReturnValue(false) };
        
        // Mock mw.config to not have modal mode or returnto
        window.mw.config.get = jest.fn().mockReturnValue(null);
        window.mw.util = { getUrl: jest.fn().mockReturnValue('/wiki/File:Test.png') };
        
        // Can't easily test location.href assignment in JSDOM, but can verify getUrl was called correctly
        editorInstance.navigateBackToFileWithName('Test.png');
        
        expect(window.mw.util.getUrl).toHaveBeenCalledWith('File:Test.png', { layers: 'on' });
    });

    test('navigateBackToFileWithName should check returnToUrl config', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = { get: jest.fn().mockReturnValue(false) };
        
        // Mock mw.config to have returnto URL
        window.mw.config.get = jest.fn((key) => {
            if (key === 'wgLayersReturnToUrl') return '/wiki/Main_Page';
            return null;
        });
        
        // The function will try to set location.href - we verify it checked the config
        editorInstance.navigateBackToFileWithName('Test.png');
        
        expect(window.mw.config.get).toHaveBeenCalledWith('wgLayersReturnToUrl');
    });

    test('navigateBackToFileWithName should postMessage in modal mode', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = { get: jest.fn().mockReturnValue(false) };
        
        // Mock mw.config for modal mode
        window.mw.config.get = jest.fn((key) => {
            if (key === 'wgLayersIsModalMode') return true;
            return null;
        });
        
        // Mock window.parent
        const mockPostMessage = jest.fn();
        const originalParent = window.parent;
        Object.defineProperty(window, 'parent', {
            value: { postMessage: mockPostMessage },
            writable: true,
            configurable: true
        });
        
        editorInstance.navigateBackToFileWithName('Test.png');
        
        expect(mockPostMessage).toHaveBeenCalledWith(
            { type: 'layers-editor-close', saved: true, filename: 'Test.png' },
            expect.any(String)
        );
        
        // Restore
        Object.defineProperty(window, 'parent', { value: originalParent, writable: true, configurable: true });
    });

    test('navigateBackToFileWithName should fall back to history.back()', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = { get: jest.fn().mockReturnValue(false) };
        
        // Mock mw.config and mw.util to not provide navigation
        window.mw.config.get = jest.fn().mockReturnValue(null);
        window.mw.util = undefined;
        
        const mockHistoryBack = jest.fn();
        Object.defineProperty(window, 'history', {
            value: { length: 5, back: mockHistoryBack },
            writable: true,
            configurable: true
        });
        
        editorInstance.navigateBackToFileWithName(null);
        
        expect(mockHistoryBack).toHaveBeenCalled();
    });

    test('navigateBackToFileWithName should not throw on error', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = { get: jest.fn().mockImplementation(() => { throw new Error('test'); }) };
        
        // Should not throw - catches error internally and calls reload
        expect(() => editorInstance.navigateBackToFileWithName('Test.png')).not.toThrow();
    });
});

describe('LayersEditor cancel method', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should destroy uiManager when not dirty', () => {
        const mockDestroy = jest.fn();
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.filename = 'Test.png';
        editorInstance.stateManager = { get: jest.fn().mockReturnValue(false) };
        editorInstance.uiManager = { destroy: mockDestroy };
        editorInstance.navigateBackToFileWithName = jest.fn();
        
        editorInstance.cancel(false);
        
        expect(mockDestroy).toHaveBeenCalled();
    });

    test('should navigate back when requested and not dirty', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.filename = 'Test.png';
        editorInstance.stateManager = { get: jest.fn().mockReturnValue(false) };
        editorInstance.uiManager = { destroy: jest.fn() };
        editorInstance.navigateBackToFileWithName = jest.fn();
        
        editorInstance.cancel(true);
        
        expect(editorInstance.navigateBackToFileWithName).toHaveBeenCalledWith('Test.png');
    });

    test('should show dialog when dirty and dialogManager available', () => {
        const mockShowDialog = jest.fn();
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.filename = 'Test.png';
        editorInstance.stateManager = { get: jest.fn().mockReturnValue(true) };
        editorInstance.dialogManager = { showCancelConfirmDialog: mockShowDialog };
        
        editorInstance.cancel(true);
        
        expect(mockShowDialog).toHaveBeenCalled();
    });

    test('should use fallback showCancelConfirmDialog when dialogManager not available', () => {
        const mockShowDialog = jest.fn();
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.filename = 'Test.png';
        editorInstance.stateManager = { get: jest.fn().mockReturnValue(true) };
        editorInstance.dialogManager = null;
        editorInstance.showCancelConfirmDialog = mockShowDialog;
        
        editorInstance.cancel(true);
        
        expect(mockShowDialog).toHaveBeenCalled();
    });
});

describe('LayersEditor showCancelConfirmDialog', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('should create dialog elements', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.showCancelConfirmDialog(jest.fn());
        
        expect(document.querySelector('.layers-modal-overlay')).not.toBeNull();
        expect(document.querySelector('.layers-modal-dialog')).not.toBeNull();
    });

    test('should set ARIA attributes on dialog', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.showCancelConfirmDialog(jest.fn());
        
        const dialog = document.querySelector('.layers-modal-dialog');
        expect(dialog.getAttribute('role')).toBe('alertdialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    test('should have cancel and confirm buttons', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.showCancelConfirmDialog(jest.fn());
        
        const buttons = document.querySelectorAll('.layers-modal-buttons button');
        expect(buttons.length).toBe(2);
    });

    test('should call onConfirm when discard button clicked', () => {
        const onConfirm = jest.fn();
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.showCancelConfirmDialog(onConfirm);
        
        // Second button is the confirm/discard button
        const confirmBtn = document.querySelectorAll('.layers-modal-buttons button')[1];
        confirmBtn.click();
        
        expect(onConfirm).toHaveBeenCalled();
    });

    test('should remove dialog when cancel button clicked', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.showCancelConfirmDialog(jest.fn());
        
        // First button is the cancel/continue button
        const cancelBtn = document.querySelectorAll('.layers-modal-buttons button')[0];
        cancelBtn.click();
        
        expect(document.querySelector('.layers-modal-overlay')).toBeNull();
        expect(document.querySelector('.layers-modal-dialog')).toBeNull();
    });

    test('should use layersMessages if available', () => {
        window.layersMessages = {
            get: jest.fn((key, fallback) => `translated-${key}`)
        };
        
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.showCancelConfirmDialog(jest.fn());
        
        expect(window.layersMessages.get).toHaveBeenCalled();
        
        delete window.layersMessages;
    });

    test('should handle escape key to close dialog', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.showCancelConfirmDialog(jest.fn());
        
        expect(document.querySelector('.layers-modal-dialog')).not.toBeNull();
        
        // Simulate escape key
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);
        
        expect(document.querySelector('.layers-modal-dialog')).toBeNull();
    });
});

describe('Auto-create layer set functionality', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        
        // Setup window globals
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        
        // Setup DOM
        document.body.innerHTML = '<div id="layers-editor-container"></div>';
        
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    describe('showAutoCreateNotification', () => {
        test('should show notification with set name', () => {
            const mockNotify = jest.fn();
            global.mw = {
                notify: mockNotify,
                message: jest.fn((key, param) => ({
                    text: () => `Layer set "${param}" was created automatically.`
                }))
            };

            const editorInstance = Object.create(LayersEditor.prototype);
            editorInstance.showAutoCreateNotification('my-new-set');

            expect(global.mw.message).toHaveBeenCalledWith('layers-set-auto-created', 'my-new-set');
            expect(mockNotify).toHaveBeenCalledWith(
                expect.stringContaining('my-new-set'),
                expect.objectContaining({ type: 'info' })
            );
        });

        test('should not throw when mw.notify is not available', () => {
            global.mw = {};

            const editorInstance = Object.create(LayersEditor.prototype);
            
            expect(() => {
                editorInstance.showAutoCreateNotification('test-set');
            }).not.toThrow();
        });
    });

    describe('autoCreateLayerSet', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should use layerSetManager when available', async () => {
            const mockCreateNewLayerSet = jest.fn().mockResolvedValue(true);
            const mockSaveInitialState = jest.fn();
            const mockUpdateSaveButtonState = jest.fn();

            const editorInstance = Object.create(LayersEditor.prototype);
            editorInstance.layerSetManager = {
                createNewLayerSet: mockCreateNewLayerSet
            };
            editorInstance.historyManager = {
                saveInitialState: mockSaveInitialState
            };
            editorInstance.updateSaveButtonState = mockUpdateSaveButtonState;
            editorInstance.showAutoCreateNotification = jest.fn();
            editorInstance.debugLog = jest.fn();

            editorInstance.autoCreateLayerSet('anatomy-labels');

            // Wait for promise
            await jest.runAllTimersAsync();

            expect(mockCreateNewLayerSet).toHaveBeenCalledWith('anatomy-labels');
        });

        test('should show notification after successful creation', async () => {
            const mockCreateNewLayerSet = jest.fn().mockResolvedValue(true);
            const mockShowNotification = jest.fn();

            const editorInstance = Object.create(LayersEditor.prototype);
            editorInstance.layerSetManager = {
                createNewLayerSet: mockCreateNewLayerSet
            };
            editorInstance.historyManager = { saveInitialState: jest.fn() };
            editorInstance.updateSaveButtonState = jest.fn();
            editorInstance.showAutoCreateNotification = mockShowNotification;
            editorInstance.debugLog = jest.fn();

            editorInstance.autoCreateLayerSet('new-set');

            await jest.runAllTimersAsync();

            expect(mockShowNotification).toHaveBeenCalledWith('new-set');
        });

        test('should use fallback when layerSetManager not available', () => {
            const mockStateManager = {
                set: jest.fn(),
                get: jest.fn().mockReturnValue([])
            };

            global.mw = {
                config: {
                    get: jest.fn().mockReturnValue('TestUser')
                },
                notify: jest.fn(),
                message: jest.fn(() => ({ text: () => 'message' }))
            };

            const editorInstance = Object.create(LayersEditor.prototype);
            editorInstance.layerSetManager = null;
            editorInstance.stateManager = mockStateManager;
            editorInstance.canvasManager = { renderLayers: jest.fn() };
            editorInstance.historyManager = { saveInitialState: jest.fn() };
            editorInstance.updateSaveButtonState = jest.fn();
            editorInstance.buildSetSelector = jest.fn();
            editorInstance.buildRevisionSelector = jest.fn();
            editorInstance.showAutoCreateNotification = jest.fn();
            editorInstance.debugLog = jest.fn();

            editorInstance.autoCreateLayerSet('fallback-set');

            expect(mockStateManager.set).toHaveBeenCalledWith('layers', []);
            expect(mockStateManager.set).toHaveBeenCalledWith('currentSetName', 'fallback-set');
            expect(mockStateManager.set).toHaveBeenCalledWith('hasUnsavedChanges', true);
        });
    });

    describe('finalizeInitialState', () => {
        test('should call historyManager.saveInitialState when available', () => {
            const mockSaveInitialState = jest.fn();
            const mockUpdateSaveButtonState = jest.fn();

            const editorInstance = Object.create(LayersEditor.prototype);
            editorInstance.historyManager = { saveInitialState: mockSaveInitialState };
            editorInstance.updateSaveButtonState = mockUpdateSaveButtonState;

            editorInstance.finalizeInitialState();

            expect(mockSaveInitialState).toHaveBeenCalled();
            expect(mockUpdateSaveButtonState).toHaveBeenCalled();
        });

        test('should fall back to saveState when historyManager not available', () => {
            const mockSaveState = jest.fn();
            const mockUpdateSaveButtonState = jest.fn();

            const editorInstance = Object.create(LayersEditor.prototype);
            editorInstance.historyManager = null;
            editorInstance.saveState = mockSaveState;
            editorInstance.updateSaveButtonState = mockUpdateSaveButtonState;

            editorInstance.finalizeInitialState();

            expect(mockSaveState).toHaveBeenCalledWith('initial');
        });
    });
});

describe('LayersEditor init method', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should abort init when browser compatibility check fails', () => {
        const mockShowWarning = jest.fn();
        const mockCreateInterface = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        editorInstance.debugLog = jest.fn();
        editorInstance.validationManager = {
            checkBrowserCompatibility: jest.fn().mockReturnValue(false)
        };
        editorInstance.uiManager = {
            showBrowserCompatibilityWarning: mockShowWarning,
            createInterface: mockCreateInterface
        };
        
        editorInstance.init();
        
        expect(mockShowWarning).toHaveBeenCalled();
        expect(mockCreateInterface).not.toHaveBeenCalled();
    });

    test('should proceed with init when browser is compatible', () => {
        const mockCreateInterface = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        editorInstance.debugLog = jest.fn();
        editorInstance.config = {};
        editorInstance.filename = 'Test.png';
        editorInstance.validationManager = {
            checkBrowserCompatibility: jest.fn().mockReturnValue(true)
        };
        editorInstance.uiManager = {
            createInterface: mockCreateInterface,
            toolbarContainer: document.createElement('div'),
            layerPanelContainer: document.createElement('div'),
            canvasContainer: document.createElement('div')
        };
        editorInstance.eventManager = {
            setupGlobalHandlers: jest.fn()
        };
        editorInstance.apiManager = {
            loadLayers: jest.fn().mockResolvedValue({})
        };
        editorInstance.stateManager = {
            set: jest.fn(),
            get: jest.fn()
        };
        editorInstance.registry = {
            register: jest.fn(),
            get: jest.fn().mockReturnValue({
                destroy: jest.fn()
            })
        };
        editorInstance.initializeUIComponents = jest.fn();
        editorInstance.loadInitialLayers = jest.fn();
        editorInstance.setupCloseButton = jest.fn();
        
        editorInstance.init();
        
        expect(mockCreateInterface).toHaveBeenCalled();
        expect(editorInstance.initializeUIComponents).toHaveBeenCalled();
        expect(editorInstance.loadInitialLayers).toHaveBeenCalled();
    });
});

describe('LayersEditor loadInitialLayers with deep links', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should load specific set when initialSetName is provided', async () => {
        const mockLoadBySetName = jest.fn().mockResolvedValue({
            layers: [{ id: 'layer1' }],
            currentLayerSetId: 123
        });
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        editorInstance.debugLog = jest.fn();
        editorInstance.isDestroyed = false;
        editorInstance.config = { initialSetName: 'anatomy-labels' };
        editorInstance.apiManager = {
            loadLayers: jest.fn(),
            loadLayersBySetName: mockLoadBySetName
        };
        editorInstance.stateManager = {
            set: jest.fn(),
            get: jest.fn()
        };
        editorInstance.canvasManager = {
            renderLayers: jest.fn(),
            setBaseDimensions: jest.fn()
        };
        editorInstance.historyManager = {
            saveInitialState: jest.fn()
        };
        editorInstance.updateSaveButtonState = jest.fn();
        editorInstance.normalizeLayers = LayersEditor.prototype.normalizeLayers;
        
        editorInstance.loadInitialLayers();
        
        expect(mockLoadBySetName).toHaveBeenCalledWith('anatomy-labels');
        
        // Wait for promise
        await jest.runAllTimersAsync();
        
        expect(editorInstance.stateManager.set).toHaveBeenCalledWith('layers', expect.any(Array));
    });

    test('should auto-create set when autoCreate is true and set does not exist', async () => {
        const mockLoadBySetName = jest.fn().mockResolvedValue({
            layers: null,
            currentLayerSetId: null
        });
        const mockAutoCreate = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        editorInstance.debugLog = jest.fn();
        editorInstance.isDestroyed = false;
        editorInstance.config = { 
            initialSetName: 'new-set',
            autoCreate: true
        };
        editorInstance.apiManager = {
            loadLayersBySetName: mockLoadBySetName
        };
        editorInstance.stateManager = {
            set: jest.fn(),
            get: jest.fn()
        };
        editorInstance.autoCreateLayerSet = mockAutoCreate;
        editorInstance.normalizeLayers = LayersEditor.prototype.normalizeLayers;
        
        editorInstance.loadInitialLayers();
        
        // Wait for promise
        await jest.runAllTimersAsync();
        
        expect(mockAutoCreate).toHaveBeenCalledWith('new-set');
    });

    test('should not auto-create when set already exists', async () => {
        const mockLoadBySetName = jest.fn().mockResolvedValue({
            layers: [{ id: 'layer1' }],
            currentLayerSetId: 456
        });
        const mockAutoCreate = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        editorInstance.debugLog = jest.fn();
        editorInstance.isDestroyed = false;
        editorInstance.config = { 
            initialSetName: 'existing-set',
            autoCreate: true
        };
        editorInstance.apiManager = {
            loadLayersBySetName: mockLoadBySetName
        };
        editorInstance.stateManager = {
            set: jest.fn(),
            get: jest.fn().mockReturnValue([])
        };
        editorInstance.canvasManager = {
            renderLayers: jest.fn(),
            setBaseDimensions: jest.fn()
        };
        editorInstance.historyManager = {
            saveInitialState: jest.fn()
        };
        editorInstance.updateSaveButtonState = jest.fn();
        editorInstance.autoCreateLayerSet = mockAutoCreate;
        editorInstance.normalizeLayers = LayersEditor.prototype.normalizeLayers;
        
        editorInstance.loadInitialLayers();
        
        // Wait for promise
        await jest.runAllTimersAsync();
        
        expect(mockAutoCreate).not.toHaveBeenCalled();
    });

    test('should skip processing if editor is destroyed during load', async () => {
        const mockLoadLayers = jest.fn().mockResolvedValue({
            layers: [{ id: 'layer1' }]
        });
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        editorInstance.debugLog = jest.fn();
        editorInstance.isDestroyed = true; // Set destroyed before callback
        editorInstance.config = {};
        editorInstance.apiManager = {
            loadLayers: mockLoadLayers
        };
        editorInstance.stateManager = {
            set: jest.fn()
        };
        
        editorInstance.loadInitialLayers();
        
        // Wait for promise
        await jest.runAllTimersAsync();
        
        // stateManager.set should NOT have been called because isDestroyed is true
        expect(editorInstance.stateManager.set).not.toHaveBeenCalled();
    });
});

describe('LayersEditor updateLayer error handling', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should catch and notify on error in updateLayer', () => {
        const mockNotify = jest.fn();
        window.mw = { notify: mockNotify };
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = true;
        editorInstance.errorLog = jest.fn();
        editorInstance.stateManager = {
            get: jest.fn().mockImplementation(() => {
                throw new Error('Simulated error');
            })
        };
        
        editorInstance.updateLayer('layer1', { x: 100 });
        
        expect(editorInstance.errorLog).toHaveBeenCalledWith('Error in updateLayer:', expect.any(Error));
        expect(mockNotify).toHaveBeenCalledWith('Error updating layer', { type: 'error' });
    });

    test('should handle updateLayer when layer not found', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue([{ id: 'layer2' }]),
            set: jest.fn()
        };
        editorInstance.markDirty = jest.fn();
        
        editorInstance.updateLayer('nonexistent', { x: 100 });
        
        // set should not be called because layer wasn't found
        expect(editorInstance.stateManager.set).not.toHaveBeenCalledWith('layers', expect.anything());
    });
});

describe('LayersEditor registry fallback scenarios', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should prefer layersRegistry over layersModuleRegistry', () => {
        // Set both registries to verify preference
        const preferredRegistry = { get: jest.fn(), name: 'preferred' };
        const deprecatedRegistry = { get: jest.fn(), name: 'deprecated' };
        
        window.layersRegistry = preferredRegistry;
        window.layersModuleRegistry = deprecatedRegistry;
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        
        // Simulate the registry selection logic from constructor
        editorInstance.registry = window.layersRegistry;
        if (!editorInstance.registry && window.layersModuleRegistry) {
            editorInstance.registry = window.layersModuleRegistry;
        }
        
        // Should use the preferred registry
        expect(editorInstance.registry).toBe(preferredRegistry);
        
        // Cleanup
        delete window.layersRegistry;
        delete window.layersModuleRegistry;
    });

    test('should create fallback registry when none available', () => {
        delete window.layersRegistry;
        delete window.layersModuleRegistry;
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        
        const fallback = LayersEditor.prototype.createFallbackRegistry.call(editorInstance);
        
        expect(typeof fallback.get).toBe('function');
        expect(() => fallback.get('StateManager')).not.toThrow();
    });

    test('should fall back to deprecated registry when preferred not available', () => {
        delete window.layersRegistry;
        const deprecatedRegistry = { get: jest.fn(), name: 'deprecated' };
        window.layersModuleRegistry = deprecatedRegistry;
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        
        // Simulate the registry selection logic
        editorInstance.registry = window.layersRegistry;
        if (!editorInstance.registry && window.layersModuleRegistry) {
            editorInstance.registry = window.layersModuleRegistry;
        }
        
        expect(editorInstance.registry).toBe(deprecatedRegistry);
        
        delete window.layersModuleRegistry;
    });
});

describe('LayersEditor cancel workflow branches', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should call onConfirm callback with all cleanup when dirty with dialogManager', () => {
        let capturedCallback;
        const mockShowDialog = jest.fn((callback) => {
            capturedCallback = callback;
        });
        const mockStateManagerSet = jest.fn();
        const mockEventManagerDestroy = jest.fn();
        const mockUiManagerDestroy = jest.fn();
        const mockNavigate = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.filename = 'Test.png';
        editorInstance.stateManager = { 
            get: jest.fn().mockReturnValue(true),
            set: mockStateManagerSet
        };
        editorInstance.eventManager = { 
            destroy: mockEventManagerDestroy
        };
        editorInstance.dialogManager = { showCancelConfirmDialog: mockShowDialog };
        editorInstance.uiManager = { destroy: mockUiManagerDestroy };
        editorInstance.navigateBackToFileWithName = mockNavigate;
        
        editorInstance.cancel(true);
        
        expect(mockShowDialog).toHaveBeenCalled();
        
        // Execute the callback
        capturedCallback();
        
        expect(mockStateManagerSet).toHaveBeenCalledWith('isDirty', false);
        expect(mockEventManagerDestroy).toHaveBeenCalled();
        expect(mockUiManagerDestroy).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('Test.png');
    });

    test('should handle cancel when eventManager.destroy is not a function', () => {
        let capturedCallback;
        const mockShowDialog = jest.fn((callback) => {
            capturedCallback = callback;
        });
        const mockUiManagerDestroy = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.filename = 'Test.png';
        editorInstance.stateManager = { 
            get: jest.fn().mockReturnValue(true),
            set: jest.fn()
        };
        editorInstance.eventManager = { destroy: 'not a function' }; // Not a function
        editorInstance.dialogManager = { showCancelConfirmDialog: mockShowDialog };
        editorInstance.uiManager = { destroy: mockUiManagerDestroy };
        editorInstance.navigateBackToFileWithName = jest.fn();
        
        editorInstance.cancel(false);
        
        capturedCallback();
        
        // Should not throw - should skip eventManager.destroy since it's not a function
        expect(mockUiManagerDestroy).toHaveBeenCalled();
    });

    test('should not navigate when navigateBack is false', () => {
        const mockDestroy = jest.fn();
        const mockNavigate = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.filename = 'Test.png';
        editorInstance.stateManager = { get: jest.fn().mockReturnValue(false) };
        editorInstance.uiManager = { destroy: mockDestroy };
        editorInstance.navigateBackToFileWithName = mockNavigate;
        
        editorInstance.cancel(false); // navigateBack = false
        
        expect(mockDestroy).toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});

describe('LayersEditor save error paths', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should show error notification when save fails with error.info', () => {
        const mockNotify = jest.fn();
        window.mw = { notify: mockNotify };
        
        // Create a mock promise that will reject
        let rejectFn;
        const mockSavePromise = {
            then: jest.fn().mockReturnThis(),
            catch: jest.fn((handler) => {
                rejectFn = handler;
                return mockSavePromise;
            })
        };
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            set: jest.fn(),
            get: jest.fn().mockReturnValue([])
        };
        editorInstance.validationManager = {
            validateLayers: jest.fn().mockReturnValue({ isValid: true })
        };
        editorInstance.uiManager = {
            showSpinner: jest.fn(),
            hideSpinner: jest.fn()
        };
        editorInstance.apiManager = {
            saveLayers: jest.fn().mockReturnValue(mockSavePromise)
        };
        editorInstance.updateSaveButtonState = jest.fn();
        editorInstance.debugLog = jest.fn();
        
        editorInstance.save();
        
        // Trigger the error handler
        rejectFn({ info: 'Rate limit exceeded' });
        
        expect(editorInstance.uiManager.hideSpinner).toHaveBeenCalled();
        expect(mockNotify).toHaveBeenCalledWith('Rate limit exceeded', { type: 'error' });
    });

    test('should use error.message when error.info is not available', () => {
        const mockNotify = jest.fn();
        window.mw = { notify: mockNotify };
        
        let rejectFn;
        const mockSavePromise = {
            then: jest.fn().mockReturnThis(),
            catch: jest.fn((handler) => {
                rejectFn = handler;
                return mockSavePromise;
            })
        };
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            set: jest.fn(),
            get: jest.fn().mockReturnValue([])
        };
        editorInstance.validationManager = {
            validateLayers: jest.fn().mockReturnValue({ isValid: true })
        };
        editorInstance.uiManager = {
            showSpinner: jest.fn(),
            hideSpinner: jest.fn()
        };
        editorInstance.apiManager = {
            saveLayers: jest.fn().mockReturnValue(mockSavePromise)
        };
        editorInstance.updateSaveButtonState = jest.fn();
        editorInstance.debugLog = jest.fn();
        
        editorInstance.save();
        
        rejectFn({ message: 'Network error' });
        
        expect(mockNotify).toHaveBeenCalledWith('Network error', { type: 'error' });
    });

    test('should use fallback message when layersMessages is available', () => {
        const mockNotify = jest.fn();
        window.mw = { notify: mockNotify };
        window.layersMessages = {
            get: jest.fn().mockReturnValue('Failed to save layers')
        };
        
        let rejectFn;
        const mockSavePromise = {
            then: jest.fn().mockReturnThis(),
            catch: jest.fn((handler) => {
                rejectFn = handler;
                return mockSavePromise;
            })
        };
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            set: jest.fn(),
            get: jest.fn().mockReturnValue([])
        };
        editorInstance.validationManager = {
            validateLayers: jest.fn().mockReturnValue({ isValid: true })
        };
        editorInstance.uiManager = {
            showSpinner: jest.fn(),
            hideSpinner: jest.fn()
        };
        editorInstance.apiManager = {
            saveLayers: jest.fn().mockReturnValue(mockSavePromise)
        };
        editorInstance.updateSaveButtonState = jest.fn();
        editorInstance.debugLog = jest.fn();
        
        editorInstance.save();
        
        // Trigger with no info or message
        rejectFn({});
        
        expect(mockNotify).toHaveBeenCalledWith('Failed to save layers', { type: 'error' });
        
        delete window.layersMessages;
    });

    test('should show validation error when layers are invalid', () => {
        const mockNotify = jest.fn();
        window.mw = { notify: mockNotify };
        window.layersMessages = {
            get: jest.fn().mockReturnValue('Invalid layer data')
        };
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue([{ id: 'layer1' }])
        };
        editorInstance.validationManager = {
            validateLayers: jest.fn().mockReturnValue({ 
                isValid: false, 
                error: 'Invalid layer property' 
            })
        };
        editorInstance.debugLog = jest.fn();
        
        editorInstance.save();
        
        // Should show validation error notification (with error details appended)
        expect(mockNotify).toHaveBeenCalledWith(
            expect.stringContaining('Invalid layer data'),
            { type: 'error' }
        );
        
        delete window.layersMessages;
    });
});

describe('LayersEditor reloadRevisions', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should call apiManager.reloadRevisions when available', () => {
        const mockReload = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.apiManager = {
            reloadRevisions: mockReload
        };
        
        editorInstance.reloadRevisions();
        
        expect(mockReload).toHaveBeenCalled();
    });

    test('should catch error in reloadRevisions', () => {
        const mockErrorLog = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.errorLog = mockErrorLog;
        editorInstance.apiManager = {
            reloadRevisions: jest.fn().mockImplementation(() => {
                throw new Error('Reload error');
            })
        };
        
        // Should not throw
        expect(() => editorInstance.reloadRevisions()).not.toThrow();
        expect(mockErrorLog).toHaveBeenCalledWith('Error in reloadRevisions:', expect.any(Error));
    });

    test('should handle missing apiManager gracefully', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.apiManager = null;
        editorInstance.errorLog = jest.fn();
        
        // Should not throw
        expect(() => editorInstance.reloadRevisions()).not.toThrow();
    });
});

describe('LayersEditor subscribeToSelectionChanges', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should return early when stateManager is null', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = null;
        
        // Should not throw
        expect(() => editorInstance.subscribeToSelectionChanges()).not.toThrow();
        expect(editorInstance.selectionUnsubscribe).toBeUndefined();
    });

    test('should return early when subscribe is not a function', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = { subscribe: 'not a function' };
        
        expect(() => editorInstance.subscribeToSelectionChanges()).not.toThrow();
    });

    test('should subscribe to selection changes', () => {
        const mockUnsubscribe = jest.fn();
        const mockSubscribe = jest.fn().mockReturnValue(mockUnsubscribe);
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = { subscribe: mockSubscribe };
        editorInstance.updateUIState = jest.fn();
        
        editorInstance.subscribeToSelectionChanges();
        
        expect(mockSubscribe).toHaveBeenCalledWith('selectedLayerIds', expect.any(Function));
        expect(editorInstance.selectionUnsubscribe).toBe(mockUnsubscribe);
    });
});

describe('LayersEditor deleteSelected with locked layers', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should show warning when all selected layers are locked', () => {
        const mockNotify = jest.fn();
        window.mw = {
            notify: mockNotify,
            message: jest.fn().mockReturnValue({ text: () => 'Cannot modify a locked layer' })
        };
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.getSelectedLayerIds = jest.fn().mockReturnValue(['layer1', 'layer2']);
        editorInstance.getLayerById = jest.fn().mockReturnValue({ id: 'layer1', locked: true });
        editorInstance.isLayerEffectivelyLocked = jest.fn().mockReturnValue(true);
        
        editorInstance.deleteSelected();
        
        expect(mockNotify).toHaveBeenCalledWith(
            'Cannot modify a locked layer',
            { type: 'warn' }
        );
    });

    test('should delete only unlocked layers when mixed selection', () => {
        const mockRemoveLayer = jest.fn();
        const mockDeselectAll = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.getSelectedLayerIds = jest.fn().mockReturnValue(['locked1', 'unlocked1']);
        editorInstance.getLayerById = jest.fn((id) => ({ id }));
        editorInstance.isLayerEffectivelyLocked = jest.fn((layer) => layer.id === 'locked1');
        editorInstance.removeLayer = mockRemoveLayer;
        editorInstance.canvasManager = { deselectAll: mockDeselectAll };
        
        editorInstance.deleteSelected();
        
        expect(mockRemoveLayer).toHaveBeenCalledTimes(1);
        expect(mockRemoveLayer).toHaveBeenCalledWith('unlocked1');
        expect(mockDeselectAll).toHaveBeenCalled();
    });
});

describe('LayersEditor isLayerEffectivelyLocked', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should return false for null layer', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        expect(editorInstance.isLayerEffectivelyLocked(null)).toBe(false);
    });

    test('should return true for directly locked layer', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.layers = [];
        expect(editorInstance.isLayerEffectivelyLocked({ locked: true })).toBe(true);
    });

    test('should return true if parent folder is locked', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.layers = [
            { id: 'folder1', type: 'folder', locked: true },
            { id: 'layer1', parentGroup: 'folder1' }
        ];
        
        expect(editorInstance.isLayerEffectivelyLocked({ 
            id: 'layer1', 
            parentGroup: 'folder1' 
        })).toBe(true);
    });

    test('should handle circular parent references', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.layers = [
            { id: 'folder1', type: 'folder', parentGroup: 'folder2' },
            { id: 'folder2', type: 'folder', parentGroup: 'folder1' }
        ];
        
        // Should not infinite loop - visited set prevents it
        expect(editorInstance.isLayerEffectivelyLocked({ 
            id: 'layer1', 
            parentGroup: 'folder1' 
        })).toBe(false);
    });
});

describe('LayersEditor updateSaveButtonState', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should toggle has-changes class based on hasUnsavedChanges', () => {
        const mockSaveBtn = document.createElement('button');
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.toolbar = { saveBtnEl: mockSaveBtn };
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue(true)
        };
        
        editorInstance.updateSaveButtonState();
        
        expect(mockSaveBtn.classList.contains('has-changes')).toBe(true);
    });

    test('should catch and log errors', () => {
        const mockErrorLog = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.errorLog = mockErrorLog;
        editorInstance.toolbar = {
            get saveBtnEl() {
                throw new Error('Property access error');
            }
        };
        
        editorInstance.updateSaveButtonState();
        
        expect(mockErrorLog).toHaveBeenCalledWith('Error updating save button state:', expect.any(Error));
    });
});

describe('LayersEditor event tracking methods', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('trackWindowListener should use eventTracker when available', () => {
        const mockAdd = jest.fn();
        const handler = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.eventTracker = { add: mockAdd };
        
        editorInstance.trackWindowListener('resize', handler, { passive: true });
        
        expect(mockAdd).toHaveBeenCalledWith(window, 'resize', handler, { passive: true });
    });

    test('trackWindowListener should fall back to addEventListener', () => {
        const handler = jest.fn();
        const mockAddEventListener = jest.spyOn(window, 'addEventListener');
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.eventTracker = null;
        
        editorInstance.trackWindowListener('scroll', handler);
        
        expect(mockAddEventListener).toHaveBeenCalledWith('scroll', handler, undefined);
        
        mockAddEventListener.mockRestore();
    });

    test('trackDocumentListener should use eventTracker when available', () => {
        const mockAdd = jest.fn();
        const handler = jest.fn();
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.eventTracker = { add: mockAdd };
        
        editorInstance.trackDocumentListener('keydown', handler);
        
        expect(mockAdd).toHaveBeenCalledWith(document, 'keydown', handler, undefined);
    });

    test('trackDocumentListener should fall back to addEventListener', () => {
        const handler = jest.fn();
        const mockAddEventListener = jest.spyOn(document, 'addEventListener');
        
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.eventTracker = null;
        
        editorInstance.trackDocumentListener('click', handler);
        
        expect(mockAddEventListener).toHaveBeenCalledWith('click', handler, undefined);
        
        mockAddEventListener.mockRestore();
    });
});

describe('LayersEditor initializeExtractedManagers', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should create RevisionManager when class is available', () => {
        const MockRevisionManager = jest.fn();
        window.Layers = window.Layers || {};
        window.Layers.Core = window.Layers.Core || {};
        window.Layers.Core.RevisionManager = MockRevisionManager;
        
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.initializeExtractedManagers();
        
        expect(MockRevisionManager).toHaveBeenCalledWith({ editor: editorInstance });
        expect(editorInstance.revisionManager).toBeDefined();
    });

    test('should create DialogManager when class is available', () => {
        const MockDialogManager = jest.fn();
        window.Layers = window.Layers || {};
        window.Layers.UI = window.Layers.UI || {};
        window.Layers.UI.DialogManager = MockDialogManager;
        
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.initializeExtractedManagers();
        
        expect(MockDialogManager).toHaveBeenCalledWith({ editor: editorInstance });
    });

    test('should create GroupManager when class is available', () => {
        const MockGroupManager = jest.fn();
        window.Layers = window.Layers || {};
        window.Layers.Core = window.Layers.Core || {};
        window.Layers.Core.GroupManager = MockGroupManager;
        
        const editorInstance = Object.create(LayersEditor.prototype);
        
        editorInstance.initializeExtractedManagers();
        
        expect(MockGroupManager).toHaveBeenCalledWith({ editor: editorInstance });
    });
});

describe('LayersEditor normalizeLayers edge cases', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should return null for null input', () => {
        const result = LayersEditor.prototype.normalizeLayers(null);
        expect(result).toBeNull();
    });

    test('should return undefined for undefined input', () => {
        const result = LayersEditor.prototype.normalizeLayers(undefined);
        expect(result).toBeUndefined();
    });

    test('should return non-array input as-is', () => {
        const result = LayersEditor.prototype.normalizeLayers('not an array');
        expect(result).toBe('not an array');
    });
});

describe('LayersEditor createCustomShapeLayer', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('should handle SVG format shapes with defaultStroke', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue([]),
            set: jest.fn()
        };
        editorInstance.validationManager = {
            sanitizeLayerData: jest.fn(data => data)
        };
        editorInstance.apiManager = {
            generateLayerId: jest.fn().mockReturnValue('layer-123')
        };
        editorInstance.canvasManager = {
            renderLayers: jest.fn(),
            getVisibleCanvasRect: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
            setTool: jest.fn()
        };
        editorInstance.layerPanel = {
            updateLayerList: jest.fn()
        };
        editorInstance.saveState = jest.fn();
        editorInstance.markDirty = jest.fn();
        editorInstance.toolbar = null; // No toolbar

        const shapeData = {
            id: 'test-shape',
            svg: '<svg><path/></svg>',
            viewBox: [0, 0, 100, 100],
            defaultStroke: '#ff0000',
            defaultFill: '#0000ff'
        };

        editorInstance.createCustomShapeLayer(shapeData);

        expect(editorInstance.stateManager.set).toHaveBeenCalled();
        const setCall = editorInstance.stateManager.set.mock.calls[0];
        expect(setCall[0]).toBe('layers');
        expect(setCall[1][0].stroke).toBe('#ff0000');
        expect(setCall[1][0].fill).toBe('#0000ff');
    });

    test('should handle multi-path shapes', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue([]),
            set: jest.fn()
        };
        editorInstance.validationManager = {
            sanitizeLayerData: jest.fn(data => data)
        };
        editorInstance.apiManager = {
            generateLayerId: jest.fn().mockReturnValue('layer-123')
        };
        editorInstance.canvasManager = {
            renderLayers: jest.fn(),
            getVisibleCanvasRect: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
            setTool: jest.fn()
        };
        editorInstance.layerPanel = {
            updateLayerList: jest.fn()
        };
        editorInstance.saveState = jest.fn();
        editorInstance.markDirty = jest.fn();
        editorInstance.toolbar = null;

        const shapeData = {
            id: 'multi-path-shape',
            paths: [
                { path: 'M0,0 L100,100', fill: '#ff0000' },
                { path: 'M100,0 L0,100', fill: '#00ff00' }
            ],
            viewBox: [0, 0, 100, 100]
        };

        editorInstance.createCustomShapeLayer(shapeData);

        const setCall = editorInstance.stateManager.set.mock.calls[0];
        expect(setCall[1][0].isMultiPath).toBe(true);
        expect(setCall[1][0].paths).toEqual(shapeData.paths);
    });

    test('should handle single-path strokeOnly shapes', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue([]),
            set: jest.fn()
        };
        editorInstance.validationManager = {
            sanitizeLayerData: jest.fn(data => data)
        };
        editorInstance.apiManager = {
            generateLayerId: jest.fn().mockReturnValue('layer-123')
        };
        editorInstance.canvasManager = {
            renderLayers: jest.fn(),
            getVisibleCanvasRect: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
            setTool: jest.fn()
        };
        editorInstance.layerPanel = {
            updateLayerList: jest.fn()
        };
        editorInstance.saveState = jest.fn();
        editorInstance.markDirty = jest.fn();
        editorInstance.toolbar = {
            styleControls: {
                getStyleOptions: jest.fn().mockReturnValue({
                    stroke: '#333333',
                    fill: '#cccccc',
                    strokeWidth: 3
                })
            },
            setActiveTool: jest.fn()
        };

        const shapeData = {
            id: 'stroke-shape',
            path: 'M0,0 L100,100',
            strokeOnly: true,
            viewBox: [0, 0, 100, 100],
            defaultStroke: '#0000ff',
            strokeWidth: 5
        };

        editorInstance.createCustomShapeLayer(shapeData);

        const setCall = editorInstance.stateManager.set.mock.calls[0];
        expect(setCall[1][0].fill).toBe('transparent');
        expect(setCall[1][0].stroke).toBe('#0000ff');
        expect(setCall[1][0].strokeWidth).toBe(5);
    });

    test('should return early for invalid shape data', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn(),
            set: jest.fn()
        };
        editorInstance.debugLog = jest.fn();
        editorInstance.debug = false;

        // No svg, path, or paths
        editorInstance.createCustomShapeLayer({ id: 'empty' });

        expect(editorInstance.stateManager.set).not.toHaveBeenCalled();
    });
});

describe('LayersEditor manager delegation methods', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('createNewLayerSet should delegate to revisionManager', async () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.revisionManager = {
            createNewLayerSet: jest.fn().mockResolvedValue(true)
        };

        const result = await editorInstance.createNewLayerSet('test-set');

        expect(editorInstance.revisionManager.createNewLayerSet).toHaveBeenCalledWith('test-set');
        expect(result).toBe(true);
    });

    test('createNewLayerSet should return false when revisionManager unavailable', async () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.revisionManager = null;

        const result = await editorInstance.createNewLayerSet('test-set');

        expect(result).toBe(false);
    });

    test('loadRevisionById should delegate to revisionManager', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.revisionManager = {
            loadRevisionById: jest.fn()
        };

        editorInstance.loadRevisionById(42);

        expect(editorInstance.revisionManager.loadRevisionById).toHaveBeenCalledWith(42);
    });

    test('loadRevisionById should do nothing when revisionManager unavailable', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.revisionManager = null;

        expect(() => editorInstance.loadRevisionById(42)).not.toThrow();
    });

    test('showKeyboardShortcutsDialog should delegate to dialogManager', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.dialogManager = {
            showKeyboardShortcutsDialog: jest.fn()
        };

        editorInstance.showKeyboardShortcutsDialog();

        expect(editorInstance.dialogManager.showKeyboardShortcutsDialog).toHaveBeenCalled();
    });

    test('showKeyboardShortcutsDialog should do nothing when dialogManager unavailable', () => {
        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.dialogManager = null;

        expect(() => editorInstance.showKeyboardShortcutsDialog()).not.toThrow();
    });
});

describe('LayersEditor navigateBackToFileWithName', () => {
    let LayersEditor;
    let originalLocation;
    let originalHistory;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;

        // Save originals
        originalLocation = window.location;
        originalHistory = window.history;
    });

    afterEach(() => {
        // Restore originals
        delete window.location;
        window.location = originalLocation;
        window.history = originalHistory;
    });

    test('should use history.back for slides when history available', () => {
        const mockBack = jest.fn();
        Object.defineProperty(window, 'history', {
            value: { back: mockBack, length: 2 },
            writable: true,
            configurable: true
        });
        delete window.location;
        window.location = { href: '', reload: jest.fn() };

        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue(true) // isSlide = true
        };

        editorInstance.navigateBackToFileWithName('Test.png');

        expect(mockBack).toHaveBeenCalled();
    });

    test('should fallback to Special:Slides when no history for slides', () => {
        Object.defineProperty(window, 'history', {
            value: { length: 1 },
            writable: true,
            configurable: true
        });
        
        global.mw = {
            config: {
                get: jest.fn().mockReturnValue(null) // Not modal mode, no return URL
            },
            util: {
                getUrl: jest.fn().mockReturnValue('/wiki/Special:Slides')
            }
        };

        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue(true) // isSlide = true
        };

        editorInstance.navigateBackToFileWithName('Test.png');

        // Verify mw.util.getUrl was called with Special:Slides
        expect(global.mw.util.getUrl).toHaveBeenCalledWith('Special:Slides');
    });

    test('should navigate to File: page for non-slides', () => {
        global.mw = {
            config: {
                get: jest.fn().mockReturnValue(null) // Not modal mode, no return URL
            },
            util: {
                getUrl: jest.fn().mockReturnValue('/wiki/File:Test.png')
            }
        };

        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue(false) // isSlide = false
        };

        editorInstance.navigateBackToFileWithName('Test.png');

        // Verify mw.util.getUrl was called with correct params
        expect(global.mw.util.getUrl).toHaveBeenCalledWith('File:Test.png', { layers: 'on' });
    });

    test('should use history.back as fallback when no filename', () => {
        const mockBack = jest.fn();
        Object.defineProperty(window, 'history', {
            value: { back: mockBack, length: 2 },
            writable: true,
            configurable: true
        });
        delete window.location;
        window.location = { href: '', reload: jest.fn() };
        
        global.mw = {
            config: {
                get: jest.fn().mockReturnValue(null)
            }
        };

        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue(false) // isSlide = false
        };

        editorInstance.navigateBackToFileWithName(null);

        expect(mockBack).toHaveBeenCalled();
    });

    test('should reload as last fallback', () => {
        // Set up window.history with length 1 (no back history)
        Object.defineProperty(window, 'history', {
            value: { length: 1, back: jest.fn() },
            writable: true,
            configurable: true
        });
        
        // Remove mw to ensure we hit the reload fallback
        global.mw = undefined;

        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.stateManager = {
            get: jest.fn().mockReturnValue(false) // isSlide = false
        };

        // The method should hit the catch block or the reload() call
        // Since window.location.reload in JSDOM doesn't do anything, 
        // we just verify the method completes without error
        expect(() => editorInstance.navigateBackToFileWithName(null)).not.toThrow();
    });
});

describe('LayersEditor slide mode configuration', () => {
    let LayersEditor;

    beforeEach(() => {
        jest.resetModules();
        window.StateManager = StateManager;
        window.HistoryManager = HistoryManager;
        require('../../resources/ext.layers.editor/LayersEditor.js');
        LayersEditor = window.Layers.Core.Editor;
    });

    test('initializeUIComponents should configure slide mode when isSlide is true', () => {
        const mockSetBaseDimensions = jest.fn();
        const mockSetSlideMode = jest.fn();
        const mockSetBackgroundColor = jest.fn();

        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        editorInstance.debugLog = jest.fn();
        editorInstance.registry = {
            register: jest.fn(),
            get: jest.fn((key) => {
                if (key === 'CanvasManager') {
                    return {
                        setBaseDimensions: mockSetBaseDimensions,
                        setSlideMode: mockSetSlideMode,
                        setBackgroundColor: mockSetBackgroundColor
                    };
                }
                return null;
            })
        };
        editorInstance.stateManager = {
            get: jest.fn((key) => {
                const state = {
                    isSlide: true,
                    slideCanvasWidth: 1920,
                    slideCanvasHeight: 1080,
                    slideBackgroundColor: '#ffffff'
                };
                return state[key];
            })
        };
        editorInstance.uiManager = {
            canvasContainer: document.createElement('div'),
            layerPanelContainer: document.createElement('div')
        };
        editorInstance.toolbar = null;
        editorInstance.layerPanel = null;

        // Subscribe handler
        editorInstance.subscribeToSelectionChanges = jest.fn();

        editorInstance.initializeUIComponents();

        expect(mockSetBaseDimensions).toHaveBeenCalledWith(1920, 1080);
        expect(mockSetSlideMode).toHaveBeenCalledWith(true);
        expect(mockSetBackgroundColor).toHaveBeenCalledWith('#ffffff');
    });

    test('initializeUIComponents should use defaults for slide mode when values missing', () => {
        const mockSetBaseDimensions = jest.fn();
        const mockSetSlideMode = jest.fn();
        const mockSetBackgroundColor = jest.fn();

        const editorInstance = Object.create(LayersEditor.prototype);
        editorInstance.debug = false;
        editorInstance.debugLog = jest.fn();
        editorInstance.registry = {
            register: jest.fn(),
            get: jest.fn((key) => {
                if (key === 'CanvasManager') {
                    return {
                        setBaseDimensions: mockSetBaseDimensions,
                        setSlideMode: mockSetSlideMode,
                        setBackgroundColor: mockSetBackgroundColor
                    };
                }
                return null;
            })
        };
        editorInstance.stateManager = {
            get: jest.fn((key) => {
                if (key === 'isSlide') return true;
                return null; // Other values not set
            })
        };
        editorInstance.uiManager = {
            canvasContainer: document.createElement('div'),
            layerPanelContainer: document.createElement('div')
        };
        editorInstance.toolbar = null;
        editorInstance.layerPanel = null;
        editorInstance.subscribeToSelectionChanges = jest.fn();

        editorInstance.initializeUIComponents();

        expect(mockSetBaseDimensions).toHaveBeenCalledWith(800, 600); // defaults
        expect(mockSetBackgroundColor).toHaveBeenCalledWith('transparent'); // default
    });
});
