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
        
        expect(window.mw.util.getUrl).toHaveBeenCalledWith('File:Test.png');
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
        
        expect(document.querySelector('.layers-modal-overlay')).toBeTruthy();
        expect(document.querySelector('.layers-modal-dialog')).toBeTruthy();
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
        
        expect(document.querySelector('.layers-modal-overlay')).toBeFalsy();
        expect(document.querySelector('.layers-modal-dialog')).toBeFalsy();
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
        
        expect(document.querySelector('.layers-modal-dialog')).toBeTruthy();
        
        // Simulate escape key
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);
        
        expect(document.querySelector('.layers-modal-dialog')).toBeFalsy();
    });
});
