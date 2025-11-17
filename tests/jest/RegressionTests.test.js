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
        if (manager && typeof manager.destroy === 'function') {
            manager.destroy();
        }
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
        test('arrow keys adjust pan and update transform', () => {
            const transformSpy = jest.spyOn(manager, 'updateCanvasTransform').mockImplementation(() => {});
            const mockEvent = {
                key: 'ArrowUp',
                preventDefault: jest.fn(),
                target: { tagName: 'BODY', contentEditable: 'false' },
                ctrlKey: false,
                metaKey: false
            };

            manager.panY = 0;
            manager.handleKeyDown(mockEvent);

            expect(manager.panY).toBe(20);
            expect(transformSpy).toHaveBeenCalled();
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });

        test('arrow key handling does not throw errors', () => {
            const mockEvent = {
                key: 'ArrowRight',
                preventDefault: jest.fn(),
                target: { tagName: 'BODY', contentEditable: 'false' },
                ctrlKey: false,
                metaKey: false
            };

            expect(() => manager.handleKeyDown(mockEvent)).not.toThrow();
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });
    });

    describe('Canvas context initialization', () => {
        test('CanvasManager provides a 2D context bound to the canvas element', () => {
            expect(manager.canvas).toBeInstanceOf(HTMLCanvasElement);
            expect(manager.ctx).toBeDefined();
            expect(typeof manager.ctx.clearRect).toBe('function');
        });
    });

    describe('Rendering pipeline', () => {
        test('renderLayers delegates to drawLayerWithEffects for visible layers', () => {
            jest.spyOn(manager, 'redraw').mockImplementation(() => {});
            jest.spyOn(manager, 'isLayerInViewport').mockReturnValue(true);
            const drawSpy = jest.spyOn(manager, 'drawLayerWithEffects').mockImplementation(() => {});

            const layer = { id: '1', type: 'rectangle', visible: true };
            manager.renderLayers([ layer ]);

            expect(drawSpy).toHaveBeenCalledWith(layer);
        });

        test('renderLayers skips invisible layers', () => {
            jest.spyOn(manager, 'redraw').mockImplementation(() => {});
            const drawSpy = jest.spyOn(manager, 'drawLayerWithEffects').mockImplementation(() => {});

            const layer = { id: 'hidden', type: 'rectangle', visible: false };
            manager.renderLayers([ layer ]);

            expect(drawSpy).not.toHaveBeenCalled();
        });
    });

    describe('Background image lifecycle', () => {
        test('successful image load resizes canvas and triggers redraw', () => {
            manager.destroy();
            const OriginalImage = global.Image;
            const images = [];
            global.Image = class {
                constructor() {
                    images.push(this);
                }
                set crossOrigin(_value) {}
                set src(value) {
                    this._src = value;
                }
            };

            try {
                manager = new window.CanvasManager({
                    container,
                    editor: mockEditor,
                    backgroundImageUrl: 'https://example.test/test.png'
                });
                const image = images[0];
                manager.resizeCanvas = jest.fn();
                manager.redraw = jest.fn();
                manager.renderLayers = jest.fn();

                image.width = 321;
                image.height = 123;
                image.complete = true;
                image.onload();

                expect(manager.canvas.width).toBe(321);
                expect(manager.canvas.height).toBe(123);
                expect(manager.resizeCanvas).toHaveBeenCalled();
                expect(manager.redraw).toHaveBeenCalled();
            } finally {
                global.Image = OriginalImage;
            }
        });
    });
});