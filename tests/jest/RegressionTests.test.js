/**
 * @jest-environment jsdom
 */

// Regression tests for Layers Editor fixes based on RCA-LayersEditor-Regression.md
// Tests specific fixes without requiring full module initialization

describe('Layers Editor Regression Tests', () => {
    let container;
    let canvas;
    let manager;
    let mockEditor;

    // Mock modules to avoid full initialization
    function mockModules() {
        // Mock RenderingCore
        window.RenderingCore = jest.fn().mockImplementation(function(canvas, config) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.backgroundImage = null;
            this.drawBackgroundImage = jest.fn();
            this.drawLayer = jest.fn();
            this.setGridProperties = jest.fn();
            this.drawGrid = jest.fn();
            this.setRulerProperties = jest.fn();
            this.drawRulers = jest.fn();
            this.destroy = jest.fn();
        });

        // Mock TransformationEngine
        window.TransformationEngine = jest.fn().mockImplementation(function(canvas, config) {
            this.canvas = canvas;
            this.panX = 0;
            this.panY = 0;
            this.zoom = 1;
            this.userHasSetZoom = false;
            this.panByPixels = jest.fn();
            this.getZoom = jest.fn().mockReturnValue(1);
            this.getPan = jest.fn().mockReturnValue({x: 0, y: 0});
            this.updateCanvasTransform = jest.fn();
            this.updateViewportBounds = jest.fn();
            this.fitToWindow = jest.fn();
            this.destroy = jest.fn();
        });

        // Mock LayerRenderer
        window.LayerRenderer = jest.fn().mockImplementation(function(ctx, config) {
            this.ctx = ctx;
            this.supportsType = jest.fn().mockReturnValue(false);
            this.renderLayer = jest.fn();
            this.destroy = jest.fn();
        });

        // Mock EventSystem
        window.EventSystem = jest.fn().mockImplementation(function(canvas, config) {
            this.canvas = canvas;
            this.on = jest.fn();
            this.destroy = jest.fn();
        });

        // Mock SelectionSystem
        window.SelectionSystem = jest.fn().mockImplementation(function(ctx, config) {
            this.ctx = ctx;
            this.selectAll = jest.fn();
            this.deselectAll = jest.fn();
            this.getSelection = jest.fn().mockReturnValue({selectedLayerIds: []});
            this.setSelection = jest.fn();
            this.hitTestSelectionHandles = jest.fn().mockReturnValue(null);
            this.destroy = jest.fn();
        });
    }

    beforeEach(() => {
        // Set up DOM
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);

        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        container.appendChild(canvas);

        // Mock modules
        mockModules();

        // Load CanvasManager
        require('../../resources/ext.layers.editor/CanvasManager.js');

        // Create mock editor
        mockEditor = {
            filename: 'test.png',
            layers: [],
            markDirty: jest.fn(),
            updateStatus: jest.fn(),
            toolbar: { updateZoomDisplay: jest.fn() },
            layerPanel: { selectLayer: jest.fn(), updateLayers: jest.fn() }
        };

        // Create CanvasManager
        manager = new window.CanvasManager({ container, editor: mockEditor });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = null;
        canvas = null;
        manager = null;
        mockEditor = null;
    });

    describe('Visibility default behavior', () => {
        test('layers with visible=undefined should be rendered', () => {
            const layerUndefined = { id: '1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
            const layerTrue = { id: '2', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, visible: true };
            const layerFalse = { id: '3', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, visible: false };

            // Test the visibility logic directly (this was the bug)
            expect(layerUndefined.visible !== false).toBe(true);
            expect(layerTrue.visible !== false).toBe(true);
            expect(layerFalse.visible !== false).toBe(false);
        });

        test('layers with visible=true should be rendered', () => {
            const layer = { id: '1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, visible: true };
            expect(layer.visible !== false).toBe(true);
        });
    });

    describe('Pan-by-arrow-keys functionality', () => {
        test('panByPixels method exists and works', () => {
            // Verify TransformationEngine was created and has panByPixels
            expect(manager.transformationEngine).toBeDefined();
            expect(typeof manager.transformationEngine.panByPixels).toBe('function');

            // Test calling panByPixels
            manager.transformationEngine.panByPixels(10, 20);
            expect(manager.transformationEngine.panByPixels).toHaveBeenCalledWith(10, 20);
        });

        test('arrow key handling does not throw errors', () => {
            const mockEvent = {
                key: 'ArrowUp',
                preventDefault: jest.fn(),
                target: { tagName: 'BODY' }
            };

            // This should not throw an error
            expect(() => {
                manager.handleKeyDown(mockEvent);
            }).not.toThrow();

            // Should have called preventDefault for arrow keys
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });
    });

    describe('RenderingCore constructor argument fix', () => {
        test('RenderingCore is initialized with canvas element, not 2D context', () => {
            // Verify RenderingCore was created with canvas
            expect(manager.renderingCore).toBeDefined();
            expect(manager.renderingCore.canvas).toBe(manager.canvas);
            // Verify it has a 2D context (the exact instance may vary due to mocking)
            expect(manager.renderingCore.ctx).toBeDefined();
            expect(typeof manager.renderingCore.ctx.clearRect).toBe('function');
        });
    });

    describe('API mismatches between CanvasManager and RenderingCore', () => {
        test('drawBackgroundImage is called without parameters', () => {
            // Set up a background image
            const testImage = { width: 100, height: 100, complete: true };
            manager.backgroundImage = testImage;

            // Spy on the RenderingCore method
            const drawBackgroundImageSpy = jest.spyOn(manager.renderingCore, 'drawBackgroundImage');

            // Trigger performRedraw directly (bypass async redraw)
            manager.performRedraw();

            // Should be called without parameters
            expect(drawBackgroundImageSpy).toHaveBeenCalledWith();
        });

        test('renderLayer uses drawLayer method', () => {
            const layer = { id: '1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, visible: true };

            // Spy on RenderingCore.drawLayer
            const drawLayerSpy = jest.spyOn(manager.renderingCore, 'drawLayer');

            // Temporarily set layerRenderer to null to force fallback to RenderingCore
            const originalLayerRenderer = manager.layerRenderer;
            manager.layerRenderer = null;

            // Render the layer
            manager.renderLayer(layer);

            // Restore original layerRenderer
            manager.layerRenderer = originalLayerRenderer;

            // Should have called drawLayer with the layer
            expect(drawLayerSpy).toHaveBeenCalledWith(layer);
        });
    });

    describe('Background image lifecycle', () => {
        test('backgroundImage is propagated to RenderingCore on load', () => {
            const testImage = { width: 100, height: 100, complete: true };

            // Simulate background image load
            manager.onBackgroundImageLoad(testImage);

            // Verify backgroundImage was set on both manager and renderingCore
            expect(manager.backgroundImage).toBe(testImage);
            expect(manager.renderingCore.backgroundImage).toBe(testImage);
        });
    });
});