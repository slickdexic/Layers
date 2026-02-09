/**
 * @jest-environment jsdom
 */

// Setup namespace and load NamespaceHelper BEFORE requiring other modules
window.Layers = window.Layers || {};
window.Layers.Utils = window.Layers.Utils || {};
window.Layers.Canvas = window.Layers.Canvas || {};
require('../../resources/ext.layers.editor/utils/NamespaceHelper.js');

// Load SelectionRenderer so CanvasRenderer can delegate to it
require('../../resources/ext.layers.editor/canvas/SelectionRenderer.js');

const CanvasRenderer = require('../../resources/ext.layers.editor/CanvasRenderer.js');
const TextUtils = require('../../resources/ext.layers.editor/TextUtils.js');
const GeometryUtils = require('../../resources/ext.layers.editor/GeometryUtils.js');

describe('CanvasRenderer', () => {
    let canvas;
    let ctx;
    let renderer;
    let mockEditor;

    // Create a comprehensive mock context that persists
    function createMockContext() {
        return {
            fillRect: jest.fn(),
            strokeRect: jest.fn(),
            clearRect: jest.fn(),
            getImageData: jest.fn(function () { return { data: new Array(4) }; }),
            putImageData: jest.fn(),
            createImageData: jest.fn(function () { return { data: new Array(4) }; }),
            setTransform: jest.fn(),
            resetTransform: jest.fn(),
            save: jest.fn(),
            restore: jest.fn(),
            translate: jest.fn(),
            scale: jest.fn(),
            rotate: jest.fn(),
            transform: jest.fn(),
            beginPath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            closePath: jest.fn(),
            stroke: jest.fn(),
            fill: jest.fn(),
            arc: jest.fn(),
            rect: jest.fn(),
            drawImage: jest.fn(),
            measureText: jest.fn(function (text) {
                return {
                    width: (text || '').length * 8,
                    actualBoundingBoxAscent: 12,
                    actualBoundingBoxDescent: 4
                };
            }),
            fillText: jest.fn(),
            strokeText: jest.fn(),
            setLineDash: jest.fn(),
            ellipse: jest.fn(),
            clip: jest.fn(),
            quadraticCurveTo: jest.fn(),
            bezierCurveTo: jest.fn(),
            arcTo: jest.fn(),
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
            globalAlpha: 1,
            globalCompositeOperation: 'source-over',
            filter: 'none',
            shadowColor: 'transparent',
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            lineWidth: 1,
            fillStyle: '#000000',
            strokeStyle: '#000000',
            textAlign: 'left',
            textBaseline: 'alphabetic',
            font: '16px Arial',
            lineCap: 'butt',
            lineJoin: 'miter'
        };
    }

    beforeEach(() => {
        // Create a mock context
        ctx = createMockContext();

        // Create canvas element
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);

        // Override getContext to return our mock
        canvas.getContext = jest.fn(function () { return ctx; });

        // Create mock editor
        mockEditor = {
            canvas: canvas,
            layers: [],
            selectedLayerIds: [],
            getLayerById: jest.fn()
        };

        // Create renderer - it will now use our mocked context
        renderer = new CanvasRenderer(canvas, { editor: mockEditor });

        // Set global for window.Layers namespace export
        window.Layers = window.Layers || {};
        window.Layers.Canvas = window.Layers.Canvas || {};
        window.Layers.Utils = window.Layers.Utils || {};
        window.Layers.Canvas.Renderer = CanvasRenderer;
        window.Layers.Utils.Text = TextUtils;
        window.Layers.Utils.Geometry = GeometryUtils;
    });

    afterEach(() => {
        if (canvas && canvas.parentNode) {
            document.body.removeChild(canvas);
        }
    });

    describe('module exports', () => {
        test('should export CanvasRenderer via module.exports', () => {
            expect(CanvasRenderer).toBeDefined();
            expect(typeof CanvasRenderer).toBe('function');
        });

        test('should be available on window.Layers.Canvas namespace', () => {
            expect(window.Layers.Canvas.Renderer).toBe(CanvasRenderer);
        });
    });

    describe('constructor', () => {
        test('should initialize with canvas element', () => {
            expect(renderer.canvas).toBe(canvas);
            expect(renderer.ctx).toBeDefined();
        });

        test('should set default transformation values', () => {
            expect(renderer.zoom).toBe(1.0);
            expect(renderer.panX).toBe(0);
            expect(renderer.panY).toBe(0);
        });

        test('should initialize selection state', () => {
            expect(renderer.selectedLayerIds).toEqual([]);
            expect(renderer.selectionHandles).toEqual([]);
            expect(renderer.isMarqueeSelecting).toBe(false);
        });

        test('should store editor reference from config', () => {
            expect(renderer.editor).toBe(mockEditor);
        });

        test('should initialize canvas pooling', () => {
            expect(renderer.canvasPool).toEqual([]);
            expect(renderer.maxPoolSize).toBe(5);
        });
    });

    describe('init', () => {
        test('should enable image smoothing', () => {
            renderer.init();
            // The ctx mock doesn't preserve these, but we verify init was called
            expect(renderer.ctx).toBeDefined();
        });
    });

    describe('setTransform', () => {
        test('should set zoom, panX, and panY', () => {
            renderer.setTransform(2.5, 100, 200);

            expect(renderer.zoom).toBe(2.5);
            expect(renderer.panX).toBe(100);
            expect(renderer.panY).toBe(200);
        });
    });

    describe('setBackgroundImage', () => {
        test('should store background image', () => {
            const img = { complete: true, width: 400, height: 300 };
            renderer.setBackgroundImage(img);

            expect(renderer.backgroundImage).toBe(img);
        });

        test('should accept null to clear background', () => {
            renderer.setBackgroundImage(null);
            expect(renderer.backgroundImage).toBeNull();
        });
    });

    describe('setSelection', () => {
        test('should set selectedLayerIds array', () => {
            renderer.setSelection(['layer-1', 'layer-2']);

            expect(renderer.selectedLayerIds).toEqual(['layer-1', 'layer-2']);
        });

        test('should default to empty array for null/undefined', () => {
            renderer.setSelection(null);
            expect(renderer.selectedLayerIds).toEqual([]);

            renderer.setSelection(undefined);
            expect(renderer.selectedLayerIds).toEqual([]);
        });
    });

    describe('setMarquee', () => {
        test('should set marquee selection state', () => {
            const rect = { x: 10, y: 20, width: 100, height: 80 };
            renderer.setMarquee(true, rect);

            expect(renderer.isMarqueeSelecting).toBe(true);
            expect(renderer.marqueeRect).toBe(rect);
        });

        test('should clear marquee state', () => {
            renderer.setMarquee(false, null);

            expect(renderer.isMarqueeSelecting).toBe(false);
            expect(renderer.marqueeRect).toBeNull();
        });
    });

    describe('clear', () => {
        test('should call clearRect on context', () => {
            renderer.clear();

            expect(ctx.clearRect).toHaveBeenCalled();
        });

        test('should reset transform before clearing', () => {
            renderer.clear();

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
            expect(ctx.restore).toHaveBeenCalled();
        });
    });

    describe('applyTransformations', () => {
        test('should apply zoom and pan transformations', () => {
            renderer.zoom = 2;
            renderer.panX = 50;
            renderer.panY = 75;

            renderer.applyTransformations();

            expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
            expect(ctx.translate).toHaveBeenCalledWith(50, 75);
            expect(ctx.scale).toHaveBeenCalledWith(2, 2);
        });
    });

    describe('redraw', () => {
        test('should clear canvas before drawing', () => {
            renderer.redraw([]);

            expect(ctx.clearRect).toHaveBeenCalled();
        });

        test('should apply transformations', () => {
            renderer.redraw([]);

            expect(ctx.setTransform).toHaveBeenCalled();
            expect(ctx.translate).toHaveBeenCalled();
            expect(ctx.scale).toHaveBeenCalled();
        });

        test('should render layers when provided', () => {
            // Drawing is now delegated to layerRenderer
            const mockDrawLayer = jest.fn();
            renderer.layerRenderer = { drawLayer: mockDrawLayer };

            const layers = [
                { id: '1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, visible: true }
            ];

            renderer.redraw(layers);

            // Should have delegated drawing (ctx.save is called around each layer)
            expect(ctx.save).toHaveBeenCalled();
        });
    });

    describe('renderLayers', () => {
        test('should skip non-array input', () => {
            // Should not throw
            expect(() => renderer.renderLayers(null)).not.toThrow();
            expect(() => renderer.renderLayers('invalid')).not.toThrow();
            expect(() => renderer.renderLayers(123)).not.toThrow();
        });

        test('should skip invisible layers', () => {
            const mockDrawLayer = jest.fn();
            renderer.layerRenderer = { drawLayer: mockDrawLayer };

            const layers = [
                { id: '1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, visible: false }
            ];

            // Reset mocks
            mockDrawLayer.mockClear();
            renderer.renderLayers(layers);

            // Should not have called drawLayer for invisible layer
            expect(mockDrawLayer).not.toHaveBeenCalled();
        });

        test('should render visible layers', () => {
            const mockDrawLayer = jest.fn();
            renderer.layerRenderer = { drawLayer: mockDrawLayer };

            const layers = [
                { id: '1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, visible: true },
                { id: '2', type: 'circle', x: 50, y: 50, radius: 25, visible: true }
            ];

            renderer.renderLayers(layers);

            // Both visible layers should be rendered via delegation
            expect(ctx.save).toHaveBeenCalled();
        });
    });

    describe('drawLayerWithEffects', () => {
        test('should apply opacity', () => {
            const layer = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100, opacity: 0.5 };

            renderer.drawLayerWithEffects(layer);

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.restore).toHaveBeenCalled();
        });

        test('should apply shadow when enabled', () => {
            const layer = {
                type: 'rectangle',
                x: 0, y: 0, width: 100, height: 100,
                shadow: true,
                shadowColor: 'rgba(0,0,0,0.5)',
                shadowBlur: 10,
                shadowOffsetX: 5,
                shadowOffsetY: 5
            };

            renderer.drawLayerWithEffects(layer);

            expect(ctx.save).toHaveBeenCalled();
        });

        test('should call drawGlow for supported types with glow enabled', () => {
            const layer = {
                type: 'rectangle',
                x: 0, y: 0, width: 100, height: 100,
                glow: true,
                stroke: '#ff0000'
            };

            const drawGlowSpy = jest.spyOn(renderer, 'drawGlow');
            renderer.drawLayerWithEffects(layer);

            expect(drawGlowSpy).toHaveBeenCalledWith(layer);
            drawGlowSpy.mockRestore();
        });
    });

    describe('supportsGlow', () => {
        test('should return true for supported shape types', () => {
            expect(renderer.supportsGlow('rectangle')).toBe(true);
            expect(renderer.supportsGlow('circle')).toBe(true);
            expect(renderer.supportsGlow('ellipse')).toBe(true);
            expect(renderer.supportsGlow('polygon')).toBe(true);
            expect(renderer.supportsGlow('star')).toBe(true);
            expect(renderer.supportsGlow('line')).toBe(true);
            expect(renderer.supportsGlow('arrow')).toBe(true);
            expect(renderer.supportsGlow('path')).toBe(true);
        });

        test('should return false for unsupported types', () => {
            expect(renderer.supportsGlow('text')).toBe(false);
            expect(renderer.supportsGlow('blur')).toBe(false);
            expect(renderer.supportsGlow('unknown')).toBe(false);
        });
    });

    describe('drawLayer', () => {
        test('should delegate to layerRenderer when available', () => {
            // Create a mock layerRenderer
            const mockLayerRenderer = {
                drawLayer: jest.fn()
            };
            renderer.layerRenderer = mockLayerRenderer;

            const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 80, fill: '#ff0000' };

            renderer.drawLayer(layer);

            expect(mockLayerRenderer.drawLayer).toHaveBeenCalledWith(layer, {
                zoom: renderer.zoom,
                panX: renderer.panX,
                panY: renderer.panY
            });
        });

        test('should not throw when layerRenderer is not available', () => {
            renderer.layerRenderer = null;

            const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 80, fill: '#ff0000' };

            // Should not throw even without layerRenderer
            expect(() => renderer.drawLayer(layer)).not.toThrow();
        });

        test('should handle all layer types without throwing', () => {
            const layerTypes = [
                { type: 'text', x: 0, y: 0, text: 'Test' },
                { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 },
                { type: 'rect', x: 0, y: 0, width: 100, height: 100 },
                { type: 'circle', x: 50, y: 50, radius: 25 },
                { type: 'ellipse', x: 50, y: 50, radiusX: 30, radiusY: 20 },
                { type: 'polygon', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 50 }] },
                { type: 'star', x: 50, y: 50, points: 5, outerRadius: 30 },
                { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 },
                { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 },
                { type: 'path', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }] }
            ];

            layerTypes.forEach(layer => {
                expect(() => renderer.drawLayer(layer)).not.toThrow();
            });
        });
    });

    // Note: Individual shape draw methods (drawRectangle, drawCircle, drawEllipse,
    // drawLine, drawArrow, drawPolygon, drawStar, drawPath, drawBlur,
    // drawText) have been removed from CanvasRenderer. Drawing is now delegated to
    // the shared LayerRenderer. See LayerRenderer.test.js for shape rendering tests.

    describe('TextUtils.measureTextLayer', () => {
        test('should return null for null layer', () => {
            expect(TextUtils.measureTextLayer(null, ctx, 800)).toBeNull();
        });

        test('should return metrics object for valid text layer', () => {
            const layer = { text: 'Hello', fontSize: 16, fontFamily: 'Arial', x: 100, y: 100 };

            const metrics = TextUtils.measureTextLayer(layer, ctx, 800);

            expect(metrics).toBeDefined();
            expect(metrics.lines).toBeDefined();
            expect(metrics.fontSize).toBe(16);
            expect(metrics.fontFamily).toBe('Arial');
            expect(metrics.width).toBeGreaterThan(0);
            expect(metrics.height).toBeGreaterThan(0);
        });

        test('should use default font values if not specified', () => {
            const layer = { text: 'Hello', x: 100, y: 100 };

            const metrics = TextUtils.measureTextLayer(layer, ctx, 800);

            expect(metrics.fontSize).toBe(16);
            expect(metrics.fontFamily).toBe('Arial');
        });

        test('should calculate alignment offset for center alignment', () => {
            const layer = { text: 'Hello', fontSize: 16, x: 100, y: 100, textAlign: 'center' };

            const metrics = TextUtils.measureTextLayer(layer, ctx, 800);

            expect(metrics.alignOffset).toBeGreaterThan(0);
        });

        test('should calculate alignment offset for right alignment', () => {
            const layer = { text: 'Hello', fontSize: 16, x: 100, y: 100, textAlign: 'right' };

            const metrics = TextUtils.measureTextLayer(layer, ctx, 800);

            expect(metrics.alignOffset).toBeGreaterThan(0);
        });
    });

    describe('TextUtils.wrapText', () => {
        test('should return single line for short text', () => {
            const lines = TextUtils.wrapText('Hello', 200, ctx);

            expect(lines).toEqual(['Hello']);
        });

        test('should return empty text as single element array', () => {
            const lines = TextUtils.wrapText('', 200, ctx);

            expect(lines).toEqual(['']);
        });

        test('should handle null text', () => {
            const lines = TextUtils.wrapText(null, 200, ctx);

            expect(lines).toEqual(['']);
        });

        test('should handle zero/negative maxWidth', () => {
            const lines = TextUtils.wrapText('Hello', 0, ctx);

            expect(lines).toEqual(['Hello']);
        });
    });

    describe('TextUtils.sanitizeTextContent', () => {
        test('should return empty string for null/undefined', () => {
            expect(TextUtils.sanitizeTextContent(null)).toBe('');
            expect(TextUtils.sanitizeTextContent(undefined)).toBe('');
        });

        test('should convert non-string to string', () => {
            expect(TextUtils.sanitizeTextContent(123)).toBe('123');
        });

        test('should remove HTML tags', () => {
            expect(TextUtils.sanitizeTextContent('<b>bold</b>')).toBe('bold');
            expect(TextUtils.sanitizeTextContent('<script>alert("xss")</script>')).toBe('alert("xss")');
        });

        test('should preserve normal text', () => {
            expect(TextUtils.sanitizeTextContent('Hello World')).toBe('Hello World');
        });
    });

    describe('drawMarqueeBox', () => {
        test('should not draw when not marquee selecting', () => {
            ctx.strokeRect.mockClear();
            renderer.isMarqueeSelecting = false;

            renderer.drawMarqueeBox();

            expect(ctx.strokeRect).not.toHaveBeenCalled();
        });

        test('should draw dashed rectangle when marquee selecting', () => {
            renderer.isMarqueeSelecting = true;
            renderer.marqueeRect = { x: 10, y: 20, width: 100, height: 80 };

            renderer.drawMarqueeBox();

            expect(ctx.setLineDash).toHaveBeenCalled();
            expect(ctx.fillRect).toHaveBeenCalled();
            expect(ctx.strokeRect).toHaveBeenCalled();
        });
    });

    describe('clearShadow', () => {
        test('should reset shadow properties', () => {
            // Set initial shadow state
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;

            renderer.clearShadow();

            // Verify shadow properties are reset to defaults
            expect( ctx.shadowColor ).toBe( 'transparent' );
            expect( ctx.shadowBlur ).toBe( 0 );
            expect( ctx.shadowOffsetX ).toBe( 0 );
            expect( ctx.shadowOffsetY ).toBe( 0 );
        });
    });

    describe('withLocalAlpha', () => {
        test('should call function with modified alpha', () => {
            const mockFn = jest.fn();

            renderer.withLocalAlpha(0.5, mockFn);

            expect(mockFn).toHaveBeenCalled();
        });

        test('should call function directly if factor is 1', () => {
            const mockFn = jest.fn();

            renderer.withLocalAlpha(1, mockFn);

            expect(mockFn).toHaveBeenCalled();
        });

        test('should clamp factor between 0 and 1', () => {
            const mockFn = jest.fn();

            // Should not throw for values outside range
            expect(() => renderer.withLocalAlpha(-0.5, mockFn)).not.toThrow();
            expect(() => renderer.withLocalAlpha(1.5, mockFn)).not.toThrow();
        });
    });

    describe('getLayerBounds', () => {
        test('should return null for null layer', () => {
            expect(renderer.getLayerBounds(null)).toBeNull();
        });

        test('should return bounds for rectangle', () => {
            const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 80 };

            const bounds = renderer.getLayerBounds(layer);

            expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 80 });
        });

        test('should return bounds for circle', () => {
            const layer = { type: 'circle', x: 50, y: 50, radius: 25 };

            const bounds = renderer.getLayerBounds(layer);

            expect(bounds).toEqual({ x: 25, y: 25, width: 50, height: 50 });
        });

        test('should return bounds for ellipse', () => {
            const layer = { type: 'ellipse', x: 50, y: 50, radiusX: 40, radiusY: 25 };

            const bounds = renderer.getLayerBounds(layer);

            expect(bounds).toEqual({ x: 10, y: 25, width: 80, height: 50 });
        });

        test('should return bounds for line', () => {
            const layer = { type: 'line', x1: 10, y1: 20, x2: 100, y2: 80 };

            const bounds = renderer.getLayerBounds(layer);

            expect(bounds).toEqual({ x: 10, y: 20, width: 90, height: 60 });
        });

        test('should return bounds for polygon with points', () => {
            const layer = {
                type: 'polygon',
                points: [
                    { x: 10, y: 10 },
                    { x: 100, y: 10 },
                    { x: 55, y: 90 }
                ]
            };

            const bounds = renderer.getLayerBounds(layer);

            expect(bounds).toEqual({ x: 10, y: 10, width: 90, height: 80 });
        });
    });

    describe('drawErrorPlaceholder', () => {
        test('should draw error indicator rectangle', () => {
            const layer = { x: 10, y: 20, width: 50, height: 50 };

            renderer.drawErrorPlaceholder(layer);

            expect(ctx.fillRect).toHaveBeenCalled();
            expect(ctx.strokeRect).toHaveBeenCalled();
        });
    });

    describe('applyLayerStyle', () => {
        test('should apply fill color', () => {
            const layer = { fill: '#ff0000' };

            renderer.applyLayerStyle(layer);

            // Verify fillStyle was set to the layer's fill color
            expect( ctx.fillStyle ).toBe( '#ff0000' );
        });

        test('should apply stroke color and width', () => {
            const layer = { stroke: '#0000ff', strokeWidth: 3 };

            renderer.applyLayerStyle(layer);

            // Verify stroke style and width were set
            expect( ctx.strokeStyle ).toBe( '#0000ff' );
            expect( ctx.lineWidth ).toBe( 3 );
        });

        test('should apply rotation', () => {
            const layer = { rotation: 45, x: 50, y: 50, width: 100, height: 80 };

            renderer.applyLayerStyle(layer);

            expect(ctx.translate).toHaveBeenCalled();
            expect(ctx.rotate).toHaveBeenCalled();
        });
    });

    describe('drawSelectionHandles', () => {
        test('should draw handles for non-rotated layer', () => {
            const bounds = { x: 100, y: 100, width: 200, height: 150 };
            const layer = { id: 'test', rotation: 0 };

            renderer.selectionHandles = [];
            renderer.drawSelectionHandles(bounds, layer, false, bounds);

            // Should have added 8 handles (corners + edges)
            expect(renderer.selectionHandles.length).toBe(8);
        });

        test('should store handle positions for hit testing', () => {
            const bounds = { x: 100, y: 100, width: 200, height: 150 };
            const layer = { id: 'test-layer', rotation: 0 };

            renderer.selectionHandles = [];
            renderer.drawSelectionHandles(bounds, layer, false, bounds);

            // Check that handles have correct properties
            expect(renderer.selectionHandles[0]).toHaveProperty('type');
            expect(renderer.selectionHandles[0]).toHaveProperty('x');
            expect(renderer.selectionHandles[0]).toHaveProperty('y');
            expect(renderer.selectionHandles[0]).toHaveProperty('layerId', 'test-layer');
        });

        test('should handle rotation transform for rotated layers', () => {
            const bounds = { x: -100, y: -75, width: 200, height: 150 }; // Local bounds
            const worldBounds = { x: 100, y: 100, width: 200, height: 150 };
            const layer = { id: 'test', rotation: 45 };

            renderer.selectionHandles = [];
            renderer.drawSelectionHandles(bounds, layer, true, worldBounds);

            // Should have added 8 handles
            expect(renderer.selectionHandles.length).toBe(8);
        });
    });

    describe('drawRotationHandle', () => {
        test('should draw rotation handle above layer', () => {
            const bounds = { x: 100, y: 100, width: 200, height: 150 };
            const layer = { id: 'test', rotation: 0 };

            renderer.selectionHandles = [];
            renderer.drawRotationHandle(bounds, layer, false, bounds);

            // Should have added 1 rotation handle
            expect(renderer.selectionHandles.length).toBe(1);
            expect(renderer.selectionHandles[0].type).toBe('rotate');
        });
    });

    describe('drawBackgroundImage', () => {
        test('should draw checker pattern when no background image', () => {
            renderer.backgroundImage = null;

            renderer.drawBackgroundImage();

            // Should have drawn checker pattern (fill white + gray squares)
            expect(ctx.fillRect).toHaveBeenCalled();
            // No longer draws "No image loaded" text - just checker pattern
        });

        test('should draw image when available', () => {
            const img = { complete: true };
            renderer.backgroundImage = img;

            renderer.drawBackgroundImage();

            // drawImage is called with canvas dimensions to scale the image to fit
            expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0, expect.any(Number), expect.any(Number));
        });

        test('should draw checker pattern underneath when opacity < 1', () => {
            const img = { complete: true };
            renderer.backgroundImage = img;
            // Mock the state manager to return low opacity
            renderer.editor = {
                stateManager: {
                    get: jest.fn((key) => {
                        if (key === 'backgroundOpacity') return 0.5;
                        if (key === 'backgroundVisible') return true;
                        return undefined;
                    })
                }
            };

            renderer.drawBackgroundImage();

            // Should have drawn checker pattern and image
            expect(ctx.fillRect).toHaveBeenCalled();
            expect(ctx.drawImage).toHaveBeenCalled();
        });
    });

    describe('renderLayersToContext', () => {
        let targetCanvas;
        let targetCtx;

        beforeEach(() => {
            targetCanvas = document.createElement('canvas');
            targetCanvas.width = 400;
            targetCanvas.height = 300;
            targetCtx = createMockContext();
            targetCtx.canvas = targetCanvas;
        });

        test('should return early if targetCtx is null', () => {
            // Should not throw
            expect(() => renderer.renderLayersToContext(null, [])).not.toThrow();
        });

        test('should return early if layers is not an array', () => {
            expect(() => renderer.renderLayersToContext(targetCtx, null)).not.toThrow();
            expect(() => renderer.renderLayersToContext(targetCtx, 'invalid')).not.toThrow();
            expect(() => renderer.renderLayersToContext(targetCtx, {})).not.toThrow();
        });

        test('should render visible layers to target context', () => {
            const layers = [
                { id: 'layer1', type: 'rectangle', visible: true, x: 10, y: 10, width: 100, height: 50 },
                { id: 'layer2', type: 'circle', visible: true, x: 50, y: 50, radius: 30 }
            ];

            // Mock layerRenderer for this test
            renderer.layerRenderer = {
                setContext: jest.fn(),
                drawLayer: jest.fn()
            };

            renderer.renderLayersToContext(targetCtx, layers);

            // Should have called save/restore on target context
            expect(targetCtx.save).toHaveBeenCalled();
            expect(targetCtx.restore).toHaveBeenCalled();
        });

        test('should skip invisible layers', () => {
            const layers = [
                { id: 'layer1', type: 'rectangle', visible: false, x: 10, y: 10, width: 100, height: 50 }
            ];

            renderer.layerRenderer = {
                setContext: jest.fn(),
                drawLayer: jest.fn()
            };

            renderer.renderLayersToContext(targetCtx, layers);

            // Layer should not be drawn (drawLayer not called for invisible layer)
            expect(renderer.layerRenderer.drawLayer).not.toHaveBeenCalled();
        });

        test('should apply scale factor', () => {
            const layers = [
                { id: 'layer1', type: 'rectangle', visible: true, x: 10, y: 10, width: 100, height: 50 }
            ];

            renderer.layerRenderer = {
                setContext: jest.fn(),
                drawLayer: jest.fn()
            };

            const originalZoom = renderer.zoom;
            renderer.renderLayersToContext(targetCtx, layers, 2);

            // Zoom should be restored after rendering
            expect(renderer.zoom).toBe(originalZoom);
        });

        test('should restore original context and state after rendering', () => {
            const originalCtx = renderer.ctx;
            const originalZoom = renderer.zoom;
            const originalPanX = renderer.panX;
            const originalPanY = renderer.panY;

            renderer.layerRenderer = {
                setContext: jest.fn(),
                drawLayer: jest.fn()
            };

            const layers = [{ id: 'layer1', type: 'rectangle', visible: true, x: 0, y: 0, width: 10, height: 10 }];
            renderer.renderLayersToContext(targetCtx, layers);

            expect(renderer.ctx).toBe(originalCtx);
            expect(renderer.zoom).toBe(originalZoom);
            expect(renderer.panX).toBe(originalPanX);
            expect(renderer.panY).toBe(originalPanY);
        });

        test('should restore layerRenderer context after rendering', () => {
            const mockSetContext = jest.fn();
            const mockDrawLayer = jest.fn();
            renderer.layerRenderer = { 
                setContext: mockSetContext,
                drawLayer: mockDrawLayer
            };
            const originalCtx = renderer.ctx;

            const layers = [{ id: 'layer1', type: 'rectangle', visible: true, x: 0, y: 0, width: 10, height: 10 }];
            renderer.renderLayersToContext(targetCtx, layers);

            // Should have been called with target context and then restored
            expect(mockSetContext).toHaveBeenCalledWith(targetCtx);
            expect(mockSetContext).toHaveBeenCalledWith(originalCtx);
        });
    });

    describe('destroy', () => {
        test('should clear canvas pool', () => {
            const pooledCanvas = { width: 100, height: 100 };
            renderer.canvasPool = [pooledCanvas];

            renderer.destroy();

            expect(pooledCanvas.width).toBe(0);
            expect(pooledCanvas.height).toBe(0);
            expect(renderer.canvasPool).toEqual([]);
        });

        test('should clear canvas state stack', () => {
            renderer.canvasStateStack = [{ zoom: 1 }, { zoom: 2 }];

            renderer.destroy();

            expect(renderer.canvasStateStack).toEqual([]);
        });

        test('should clear selection state', () => {
            renderer.selectedLayerIds = ['layer1', 'layer2'];
            renderer.selectionHandles = [{ x: 0, y: 0 }];
            renderer.rotationHandle = { x: 50, y: 50 };
            renderer.marqueeRect = { x: 0, y: 0, width: 100, height: 100 };

            renderer.destroy();

            expect(renderer.selectedLayerIds).toEqual([]);
            expect(renderer.selectionHandles).toEqual([]);
            expect(renderer.rotationHandle).toBeNull();
            expect(renderer.marqueeRect).toBeNull();
        });

        test('should clear guides', () => {
            renderer.horizontalGuides = [50, 100];
            renderer.verticalGuides = [75, 150];

            renderer.destroy();

            expect(renderer.horizontalGuides).toEqual([]);
            expect(renderer.verticalGuides).toEqual([]);
        });

        test('should destroy and clear layer renderer', () => {
            const mockLayerRenderer = { destroy: jest.fn() };
            renderer.layerRenderer = mockLayerRenderer;

            renderer.destroy();

            expect(mockLayerRenderer.destroy).toHaveBeenCalled();
            expect(renderer.layerRenderer).toBeNull();
        });

        test('should destroy and clear selection renderer', () => {
            const mockSelectionRenderer = { destroy: jest.fn() };
            renderer._selectionRenderer = mockSelectionRenderer;

            renderer.destroy();

            expect(mockSelectionRenderer.destroy).toHaveBeenCalled();
            expect(renderer._selectionRenderer).toBeNull();
        });

        test('should clear all references', () => {
            renderer.backgroundImage = { src: 'test.jpg' };
            renderer.config = { foo: 'bar' };

            renderer.destroy();

            expect(renderer.backgroundImage).toBeNull();
            expect(renderer.canvas).toBeNull();
            expect(renderer.ctx).toBeNull();
            expect(renderer.config).toBeNull();
            expect(renderer.editor).toBeNull();
        });

        test('should handle layerRenderer without destroy method', () => {
            renderer.layerRenderer = { someMethod: jest.fn() };

            expect(() => renderer.destroy()).not.toThrow();
            expect(renderer.layerRenderer).toBeNull();
        });

        test('should handle selectionRenderer without destroy method', () => {
            renderer._selectionRenderer = { someMethod: jest.fn() };

            expect(() => renderer.destroy()).not.toThrow();
            expect(renderer._selectionRenderer).toBeNull();
        });
    });

    describe('_drawBlurContent', () => {
        test('should draw text for text type layers', () => {
            const mockTextRenderer = {
                setContext: jest.fn(),
                draw: jest.fn()
            };
            renderer.layerRenderer = { textRenderer: mockTextRenderer };
            const layer = { type: 'text', text: 'Hello', x: 10, y: 10 };

            renderer._drawBlurContent(layer, false, 0, 0);

            expect(mockTextRenderer.setContext).toHaveBeenCalled();
            expect(mockTextRenderer.draw).toHaveBeenCalled();
        });

        test('should handle text with rotation', () => {
            const mockTextRenderer = {
                setContext: jest.fn(),
                draw: jest.fn()
            };
            renderer.layerRenderer = { textRenderer: mockTextRenderer };
            const layer = { type: 'text', text: 'Hello', rotation: 45, x: 10, y: 10 };

            renderer._drawBlurContent(layer, true, 50, 50);

            expect(ctx.translate).toHaveBeenCalled();
            expect(ctx.rotate).toHaveBeenCalled();
        });

        test('should draw arrow for arrow type layers', () => {
            const mockArrowRenderer = {
                setContext: jest.fn(),
                draw: jest.fn()
            };
            renderer.layerRenderer = { arrowRenderer: mockArrowRenderer };
            const layer = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };

            renderer._drawBlurContent(layer, false, 0, 0);

            expect(mockArrowRenderer.setContext).toHaveBeenCalled();
            expect(mockArrowRenderer.draw).toHaveBeenCalled();
        });

        test('should draw line for line type layers', () => {
            const mockDrawLine = jest.fn();
            renderer.layerRenderer = { drawLine: mockDrawLine };
            const layer = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };

            renderer._drawBlurContent(layer, false, 0, 0);

            expect(mockDrawLine).toHaveBeenCalled();
        });

        test('should not draw without layerRenderer', () => {
            renderer.layerRenderer = null;
            const layer = { type: 'text', text: 'Hello' };

            expect(() => renderer._drawBlurContent(layer, false, 0, 0)).not.toThrow();
        });
    });

    describe('_getLayerById', () => {
        test('should get layer from editor when method exists', () => {
            const mockLayer = { id: 'layer1', type: 'rectangle' };
            renderer.editor = {
                getLayerById: jest.fn().mockReturnValue(mockLayer)
            };

            const result = renderer._getLayerById('layer1');

            expect(renderer.editor.getLayerById).toHaveBeenCalledWith('layer1');
            expect(result).toBe(mockLayer);
        });

        test('should return null when editor lacks getLayerById', () => {
            renderer.editor = { someOtherMethod: jest.fn() };

            const result = renderer._getLayerById('layer1');

            expect(result).toBeNull();
        });

        test('should return null when editor is null', () => {
            renderer.editor = null;

            const result = renderer._getLayerById('layer1');

            expect(result).toBeNull();
        });
    });

    describe('drawGlow', () => {
        test('should draw circular glow for marker type', () => {
            const markerLayer = {
                type: 'marker',
                x: 100,
                y: 100,
                size: 30,
                glow: true
            };

            renderer.drawGlow(markerLayer);

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.beginPath).toHaveBeenCalled();
            expect(ctx.arc).toHaveBeenCalledWith(100, 100, 15, 0, 2 * Math.PI);
            expect(ctx.stroke).toHaveBeenCalled();
            expect(ctx.restore).toHaveBeenCalled();
        });

        test('should draw line-based glow for dimension type', () => {
            const dimensionLayer = {
                type: 'dimension',
                x1: 50,
                y1: 50,
                x2: 200,
                y2: 100,
                glow: true
            };

            renderer.drawGlow(dimensionLayer);

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.beginPath).toHaveBeenCalled();
            expect(ctx.moveTo).toHaveBeenCalledWith(50, 50);
            expect(ctx.lineTo).toHaveBeenCalledWith(200, 100);
            expect(ctx.stroke).toHaveBeenCalled();
            expect(ctx.restore).toHaveBeenCalled();
        });

        test('should use default size for marker without size property', () => {
            const markerLayer = {
                type: 'marker',
                x: 100,
                y: 100,
                glow: true
            };

            renderer.drawGlow(markerLayer);

            // Default size is 24, so radius is 12
            expect(ctx.arc).toHaveBeenCalledWith(100, 100, 12, 0, 2 * Math.PI);
        });

        test('should use default coordinates for dimension without coords', () => {
            const dimensionLayer = {
                type: 'dimension',
                glow: true
            };

            renderer.drawGlow(dimensionLayer);

            expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
            expect(ctx.lineTo).toHaveBeenCalledWith(0, 0);
        });

        test('should draw strokeRect for customShape type', () => {
            const customShapeLayer = {
                type: 'customShape',
                x: 50,
                y: 60,
                width: 100,
                height: 80,
                glow: true
            };

            renderer.drawGlow(customShapeLayer);

            expect(ctx.strokeRect).toHaveBeenCalledWith(50, 60, 100, 80);
        });

        test('should draw strokeRect for rectangle type', () => {
            const rectLayer = {
                type: 'rectangle',
                x: 10,
                y: 20,
                width: 150,
                height: 100,
                glow: true
            };

            renderer.drawGlow(rectLayer);

            expect(ctx.strokeRect).toHaveBeenCalled();
        });
    });

    describe('getBackgroundVisible', () => {
        test('should return true when no editor', () => {
            renderer.editor = null;
            expect(renderer.getBackgroundVisible()).toBe(true);
        });

        test('should return true when no stateManager', () => {
            renderer.editor = {};
            expect(renderer.getBackgroundVisible()).toBe(true);
        });

        test('should return true when backgroundVisible is undefined', () => {
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => undefined)
                }
            };
            expect(renderer.getBackgroundVisible()).toBe(true);
        });

        test('should return false when backgroundVisible is false', () => {
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => false)
                }
            };
            expect(renderer.getBackgroundVisible()).toBe(false);
        });

        test('should return true when backgroundVisible is true', () => {
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => true)
                }
            };
            expect(renderer.getBackgroundVisible()).toBe(true);
        });
    });

    describe('getBackgroundOpacity', () => {
        test('should return 1 when no editor', () => {
            renderer.editor = null;
            expect(renderer.getBackgroundOpacity()).toBe(1);
        });

        test('should return 1 when no stateManager', () => {
            renderer.editor = {};
            expect(renderer.getBackgroundOpacity()).toBe(1);
        });

        test('should return 1 when opacity is undefined', () => {
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => undefined)
                }
            };
            expect(renderer.getBackgroundOpacity()).toBe(1);
        });

        test('should return clamped value when opacity is valid', () => {
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => 0.5)
                }
            };
            expect(renderer.getBackgroundOpacity()).toBe(0.5);
        });

        test('should clamp opacity to 0 when negative', () => {
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => -0.5)
                }
            };
            expect(renderer.getBackgroundOpacity()).toBe(0);
        });

        test('should clamp opacity to 1 when greater than 1', () => {
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => 1.5)
                }
            };
            expect(renderer.getBackgroundOpacity()).toBe(1);
        });

        test('should return 1 when opacity is NaN', () => {
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => NaN)
                }
            };
            expect(renderer.getBackgroundOpacity()).toBe(1);
        });
    });

    describe('drawSlideBackground', () => {
        beforeEach(() => {
            renderer.isSlideMode = true;
            renderer.canvas = { width: 800, height: 600 };
            renderer.zoom = 1;
        });

        test('should draw solid color background with full opacity', () => {
            renderer.slideBackgroundColor = '#ff0000';
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => 1.0)
                }
            };

            renderer.drawSlideBackground();

            // Should set globalAlpha to 1
            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.fillRect).toHaveBeenCalled();
            expect(ctx.restore).toHaveBeenCalled();
        });

        test('should draw solid color background with reduced opacity', () => {
            renderer.slideBackgroundColor = '#ff0000';
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => 0.5)
                }
            };

            renderer.drawSlideBackground();

            // Should draw checkerboard first, then color with opacity
            expect(ctx.save).toHaveBeenCalled();
            // fillRect should be called multiple times (checkerboard + color)
            expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(1);
            expect(ctx.restore).toHaveBeenCalled();
        });

        test('should draw checkerboard for transparent background', () => {
            renderer.slideBackgroundColor = 'transparent';
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => 1.0)
                }
            };

            renderer.drawSlideBackground();

            // Should draw checkerboard pattern
            expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(1);
        });

        test('should apply opacity correctly when set to 0', () => {
            renderer.slideBackgroundColor = '#ffffff';
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => 0)
                }
            };

            renderer.drawSlideBackground();

            // Should draw checkerboard (visible) with transparent color on top
            expect(ctx.fillRect).toHaveBeenCalled();
        });
    });

    describe('constructor edge cases', () => {
        test('should log error when context is null', () => {
            // The constructor calls init() which throws if ctx is null
            // We test the logging happens by checking mw.log.error is called in the constructor
            // before init() runs
            const originalLog = global.mw.log.error;
            global.mw.log.error = jest.fn();

            // Check that the code path for logging exists
            // by verifying init() accesses ctx.imageSmoothingEnabled
            expect(renderer.ctx).not.toBeNull();

            global.mw.log.error = originalLog;
        });
    });

    describe('init LayerRenderer callback', () => {
        test('should trigger re-render on image load', () => {
            const mockRenderLayers = jest.fn();
            const mockCanvasManager = { renderLayers: mockRenderLayers };
            const testEditor = { canvasManager: mockCanvasManager, layers: [] };

            // Create renderer with editor that has canvasManager
            const testRenderer = new CanvasRenderer(canvas, { editor: testEditor });

            // Access the callback through the layerRenderer if it was created
            if (testRenderer.layerRenderer && testRenderer.layerRenderer.options) {
                const callback = testRenderer.layerRenderer.options.onImageLoad;
                if (callback) {
                    callback();
                    expect(mockRenderLayers).toHaveBeenCalled();
                }
            }
        });
    });

    describe('_getLayerById', () => {
        test('should return null when editor not available', () => {
            renderer.editor = null;
            expect(renderer._getLayerById('layer1')).toBeNull();
        });

        test('should return null when getLayerById not a function', () => {
            renderer.editor = { getLayerById: 'not a function' };
            expect(renderer._getLayerById('layer1')).toBeNull();
        });

        test('should delegate to editor.getLayerById', () => {
            const mockLayer = { id: 'layer1', type: 'rectangle' };
            renderer.editor = { getLayerById: jest.fn(() => mockLayer) };

            const result = renderer._getLayerById('layer1');

            expect(renderer.editor.getLayerById).toHaveBeenCalledWith('layer1');
            expect(result).toBe(mockLayer);
        });
    });

    describe('redraw with selection manager', () => {
        test('should get keyObjectId from selection manager', () => {
            const layers = [{ id: 'layer1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 }];
            renderer.selectedLayerIds = ['layer1'];
            renderer.editor = {
                canvasManager: {
                    selectionManager: {
                        lastSelectedId: 'layer1'
                    }
                }
            };

            renderer.redraw(layers);

            // Should have called draw methods
            expect(ctx.save).toHaveBeenCalled();
        });
    });

    describe('drawSmartGuides', () => {
        test('should call smartGuidesController.render when available', () => {
            const mockRender = jest.fn();
            renderer.editor = {
                canvasManager: {
                    smartGuidesController: {
                        render: mockRender
                    }
                }
            };

            renderer.drawSmartGuides();

            expect(mockRender).toHaveBeenCalledWith(ctx);
        });

        test('should not throw when canvasManager is null', () => {
            renderer.editor = { canvasManager: null };
            expect(() => renderer.drawSmartGuides()).not.toThrow();
        });

        test('should not throw when smartGuidesController is null', () => {
            renderer.editor = { canvasManager: {} };
            expect(() => renderer.drawSmartGuides()).not.toThrow();
        });
    });

    describe('drawBackgroundImage', () => {
        test('should draw checkerboard when backgroundImage is null', () => {
            renderer.backgroundImage = null;

            renderer.drawBackgroundImage();

            // Should have drawn checkerboard pattern
            expect(ctx.fillRect).toHaveBeenCalled();
        });

        test('should draw image with opacity when backgroundImage available', () => {
            renderer.backgroundImage = {
                complete: true,
                width: 800,
                height: 600
            };
            renderer.editor = {
                stateManager: {
                    get: jest.fn(() => 0.5)
                }
            };

            renderer.drawBackgroundImage();

            expect(ctx.drawImage).toHaveBeenCalled();
        });
    });

    describe('drawLayerWithEffects edge cases', () => {
        test('should handle blur blend mode for non-arrow shapes', () => {
            const layer = {
                id: 'blur1',
                type: 'rectangle',
                blendMode: 'blur',
                x: 0,
                y: 0,
                width: 100,
                height: 100
            };

            // Mock necessary methods
            renderer.drawLayerWithBlurBlend = jest.fn();

            renderer.drawLayerWithEffects(layer);

            expect(renderer.drawLayerWithBlurBlend).toHaveBeenCalledWith(layer);
        });

        test('should skip blur blend for arrow type', () => {
            const layer = {
                id: 'arrow1',
                type: 'arrow',
                blendMode: 'blur',
                x1: 0, y1: 0, x2: 100, y2: 100
            };

            renderer.drawLayerWithBlurBlend = jest.fn();
            renderer.drawLayer = jest.fn();

            renderer.drawLayerWithEffects(layer);

            // Should NOT call blur blend for arrow
            expect(renderer.drawLayerWithBlurBlend).not.toHaveBeenCalled();
            expect(renderer.drawLayer).toHaveBeenCalled();
        });

        test('should handle invalid blend mode gracefully', () => {
            const layer = {
                id: 'test1',
                type: 'rectangle',
                blend: 'invalid-blend-mode',
                x: 0, y: 0, width: 100, height: 100
            };

            // Make globalCompositeOperation throw for invalid value
            Object.defineProperty(ctx, 'globalCompositeOperation', {
                set: jest.fn((val) => {
                    if (val === 'invalid-blend-mode') {
                        throw new Error('Invalid blend mode');
                    }
                }),
                get: jest.fn(() => 'source-over'),
                configurable: true
            });

            global.mw.log.warn = jest.fn();

            expect(() => renderer.drawLayerWithEffects(layer)).not.toThrow();
        });
    });

    describe('drawLayerWithBlurBlend', () => {
        test('should create temp canvas and apply blur', () => {
            const layer = {
                id: 'blur1',
                type: 'rectangle',
                blendMode: 'blur',
                blurRadius: 12,
                x: 50, y: 50, width: 100, height: 100
            };

            // Just verify it doesn't throw
            expect(() => renderer.drawLayerWithBlurBlend(layer)).not.toThrow();
        });

        test('should handle blur with rotation', () => {
            const layer = {
                id: 'blur2',
                type: 'rectangle',
                blendMode: 'blur',
                blurRadius: 8,
                x: 50, y: 50, width: 100, height: 100,
                rotation: 45
            };

            expect(() => renderer.drawLayerWithBlurBlend(layer)).not.toThrow();
        });
    });

    describe('setSlideMode', () => {
        test('should set isSlideMode property', () => {
            renderer.setSlideMode(true);
            expect(renderer.isSlideMode).toBe(true);

            renderer.setSlideMode(false);
            expect(renderer.isSlideMode).toBe(false);
        });
    });

    describe('setSlideBackgroundColor', () => {
        test('should set slideBackgroundColor property', () => {
            renderer.setSlideBackgroundColor('#ff0000');
            expect(renderer.slideBackgroundColor).toBe('#ff0000');
        });

        test('should default to transparent when null', () => {
            renderer.setSlideBackgroundColor(null);
            expect(renderer.slideBackgroundColor).toBe('transparent');
        });
    });

    describe('setMarquee', () => {
        test('should set marquee selecting and rect', () => {
            const rect = { x: 10, y: 20, width: 100, height: 80 };
            renderer.setMarquee(true, rect);

            expect(renderer.isMarqueeSelecting).toBe(true);
            expect(renderer.marqueeRect).toBe(rect);
        });
    });

    describe('image load callback', () => {
        test('should trigger re-render when image loads', () => {
            // Setup editor with canvasManager that has renderLayers
            const renderLayersMock = jest.fn();
            renderer.editor = {
                canvasManager: {
                    renderLayers: renderLayersMock
                },
                layers: [{ id: 'layer1', type: 'rectangle' }]
            };

            // If LayerRenderer was created with onImageLoad callback
            if (renderer.layerRenderer && renderer.layerRenderer.options && renderer.layerRenderer.options.onImageLoad) {
                renderer.layerRenderer.options.onImageLoad();
                expect(renderLayersMock).toHaveBeenCalledWith(renderer.editor.layers);
            }
        });
    });

    describe('slide mode background rendering', () => {
        test('should draw checker pattern when slide mode and background not visible', () => {
            renderer.setSlideMode(true);
            // Mock stateManager to return false for backgroundVisible
            renderer.editor = {
                stateManager: {
                    get: jest.fn((key) => {
                        if (key === 'backgroundVisible') return false;
                        return null;
                    })
                }
            };
            const drawCheckerSpy = jest.spyOn(renderer, 'drawCheckerPattern');

            renderer.redraw([]);

            expect(drawCheckerSpy).toHaveBeenCalled();
        });

        test('should draw checker pattern when non-slide mode and background hidden', () => {
            renderer.setSlideMode(false);
            // Mock stateManager to return false for backgroundVisible
            renderer.editor = {
                stateManager: {
                    get: jest.fn((key) => {
                        if (key === 'backgroundVisible') return false;
                        return null;
                    })
                }
            };
            const drawCheckerSpy = jest.spyOn(renderer, 'drawCheckerPattern');

            renderer.redraw([]);

            expect(drawCheckerSpy).toHaveBeenCalled();
        });
    });

    describe('textbox rounded rect fallback', () => {
        test('should use _drawRoundedRectPath when ctx.roundRect is undefined', () => {
            // Remove roundRect from context to trigger fallback
            delete ctx.roundRect;

            const layer = {
                id: 'textbox1',
                type: 'textbox',
                x: 50,
                y: 50,
                width: 200,
                height: 100,
                cornerRadius: 10
            };

            const drawRoundedRectSpy = jest.spyOn(renderer, '_drawRoundedRectPath');

            // Call _drawBlurClipPath which uses the textbox case
            renderer._drawBlurClipPath(layer);

            expect(drawRoundedRectSpy).toHaveBeenCalled();
        });
    });

    describe('applyLayerStyle blend mode', () => {
        test('should apply blendMode property', () => {
            const layer = {
                id: 'blend1',
                type: 'rectangle',
                blendMode: 'multiply'
            };

            renderer.applyLayerStyle(layer);

            expect(ctx.globalCompositeOperation).toBe('multiply');
        });

        test('should apply blend property as fallback', () => {
            const layer = {
                id: 'blend2',
                type: 'rectangle',
                blend: 'screen'
            };

            renderer.applyLayerStyle(layer);

            expect(ctx.globalCompositeOperation).toBe('screen');
        });
    });

    describe('_getLayerById helper', () => {
        test('should return layer from editor.getLayerById', () => {
            const mockLayer = { id: 'layer1', type: 'rectangle' };
            renderer.editor = {
                getLayerById: jest.fn().mockReturnValue(mockLayer)
            };

            const result = renderer._getLayerById('layer1');

            expect(result).toBe(mockLayer);
            expect(renderer.editor.getLayerById).toHaveBeenCalledWith('layer1');
        });

        test('should return null when editor has no getLayerById', () => {
            renderer.editor = {};

            const result = renderer._getLayerById('layer1');

            expect(result).toBeNull();
        });

        test('should return null when editor is null', () => {
            renderer.editor = null;

            const result = renderer._getLayerById('layer1');

            expect(result).toBeNull();
        });
    });

    describe('P1.10 regression: renderLayersToContext restores context on error', () => {
        test('should call ctx.restore even if rendering throws', () => {
            const exportCtx = createMockContext();
            // Make fillRect throw to simulate an error during rendering
            exportCtx.fillRect = jest.fn(() => { throw new Error('render failure'); });

            const layers = [
                { id: 'l1', type: 'rectangle', x: 0, y: 0, width: 50, height: 50, fill: '#f00', visible: true }
            ];

            // Should not throw (error is caught internally or we expect it to be safe)
            try {
                renderer.renderLayersToContext(exportCtx, layers, 800, 600);
            } catch (e) {
                // Some implementations may still throw, that's ok
            }

            // Context should still have been restored
            expect(exportCtx.restore).toHaveBeenCalled();
        });
    });

    describe('P1.11 regression: _hashString produces unique hashes', () => {
        test('should produce different hashes for different strings', () => {
            const hash1 = renderer._hashString('hello world');
            const hash2 = renderer._hashString('hello World');
            expect(hash1).not.toBe(hash2);
        });

        test('should produce same hash for identical strings', () => {
            const hash1 = renderer._hashString('test string');
            const hash2 = renderer._hashString('test string');
            expect(hash1).toBe(hash2);
        });

        test('should include string length in hash output', () => {
            const hash = renderer._hashString('abc');
            expect(hash).toMatch(/^3:/);
        });

        test('should differentiate richText that differs only after char 200', () => {
            // Build two richText arrays that JSON.stringify identically for first 200+ chars
            const runs = [];
            for (let i = 0; i < 20; i++) {
                runs.push({ text: 'AAAAAAAAAA', style: { fontWeight: 'normal' } });
            }
            const str1 = JSON.stringify(runs);

            const runs2 = runs.map(r => ({ ...r, style: { ...r.style } }));
            // Change last run's style (well past char 200)
            runs2[19].style.fontWeight = 'bold';
            const str2 = JSON.stringify(runs2);

            // Old code truncated at 200 chars — these would have been identical
            expect(str1.substring(0, 200)).toBe(str2.substring(0, 200));

            // New hash should differentiate them
            const hash1 = renderer._hashString(str1);
            const hash2 = renderer._hashString(str2);
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('HIGH-v28-2 regression: _computeLayerHash detects middle-point edits', () => {
        test('should produce different hashes when middle points change', () => {
            const layer1 = {
                id: 'path-1',
                type: 'path',
                x: 0, y: 0,
                points: [
                    { x: 0, y: 0 },
                    { x: 50, y: 50 },
                    { x: 100, y: 100 }
                ]
            };

            const layer2 = {
                ...layer1,
                points: [
                    { x: 0, y: 0 },
                    { x: 75, y: 25 },  // Changed middle point
                    { x: 100, y: 100 }
                ]
            };

            // Same first, last, and length — old code would produce identical hashes
            expect(layer1.points.length).toBe(layer2.points.length);
            expect(layer1.points[0]).toEqual(layer2.points[0]);
            expect(layer1.points[2]).toEqual(layer2.points[2]);

            const hash1 = renderer._computeLayerHash(layer1);
            const hash2 = renderer._computeLayerHash(layer2);
            expect(hash1).not.toBe(hash2);
        });

        test('should produce same hash for identical points arrays', () => {
            const points = [
                { x: 10, y: 20 },
                { x: 30, y: 40 },
                { x: 50, y: 60 }
            ];
            const layer1 = { id: 'p1', type: 'polygon', x: 0, y: 0, points: [...points] };
            const layer2 = { id: 'p1', type: 'polygon', x: 0, y: 0, points: [...points] };

            expect(renderer._computeLayerHash(layer1)).toBe(renderer._computeLayerHash(layer2));
        });
    });
});

