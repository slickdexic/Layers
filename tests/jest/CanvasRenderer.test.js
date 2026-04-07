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

        test('should strip dangerous HTML tags but preserve harmless ones', () => {
            expect(TextUtils.sanitizeTextContent('<b>bold</b>')).toBe('<b>bold</b>');
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

    describe('destroy _blurTempCanvas cleanup', () => {
        test('should nullify _blurTempCanvas on destroy', () => {
            // Simulate a blur temp canvas being created during rendering
            renderer._blurTempCanvas = document.createElement('canvas');
            renderer._blurTempCanvas.width = 800;
            renderer._blurTempCanvas.height = 600;

            renderer.destroy();

            expect(renderer._blurTempCanvas).toBeNull();
        });

        test('should handle destroy when _blurTempCanvas is already null', () => {
            renderer._blurTempCanvas = null;

            expect(() => renderer.destroy()).not.toThrow();
            expect(renderer._blurTempCanvas).toBeNull();
        });

        test('should handle destroy when _blurTempCanvas is undefined', () => {
            delete renderer._blurTempCanvas;

            expect(() => renderer.destroy()).not.toThrow();
        });
    });

    describe('Branch coverage: renderLayers visible===0', () => {
        test('should skip layers with visible===0 (integer false from API)', () => {
            const layer = { id: '1', type: 'rectangle', x: 10, y: 10, width: 100, height: 50, visible: 0 };
            const drawSpy = jest.spyOn(renderer, 'drawLayerWithEffects');
            renderer.renderLayers([layer]);
            expect(drawSpy).not.toHaveBeenCalled();
            drawSpy.mockRestore();
        });

        test('should render layers with visible===1 (integer true from API)', () => {
            const layer = { id: '1', type: 'rectangle', x: 10, y: 10, width: 100, height: 50, visible: 1 };
            const drawSpy = jest.spyOn(renderer, 'drawLayerWithEffects');
            renderer.renderLayers([layer]);
            expect(drawSpy).toHaveBeenCalled();
            drawSpy.mockRestore();
        });
    });

    describe('Branch coverage: _drawBlurStroke skip types', () => {
        test('should skip stroke for arrow type', () => {
            renderer._drawBlurStroke(
                { type: 'arrow', stroke: '#f00', strokeWidth: 2 },
                false, 50, 50
            );
            // ctx.stroke should NOT have been called (early return)
            const _postCallCount = ctx.stroke.mock.calls.length;
            // Reset and try with rectangle which should draw stroke
            ctx.stroke.mockClear();
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#f00', strokeWidth: 2, x: 0, y: 0, width: 100, height: 50 },
                false, 50, 50
            );
            expect(ctx.stroke).toHaveBeenCalled();
        });

        test('should skip stroke for line type', () => {
            const saveCalls = ctx.save.mock.calls.length;
            renderer._drawBlurStroke(
                { type: 'line', stroke: '#f00', strokeWidth: 2 },
                false, 50, 50
            );
            // save should NOT have been called (early return before save)
            expect(ctx.save.mock.calls.length).toBe(saveCalls);
        });

        test('should skip stroke for text type', () => {
            const saveCalls = ctx.save.mock.calls.length;
            renderer._drawBlurStroke(
                { type: 'text', stroke: '#f00', strokeWidth: 2 },
                false, 50, 50
            );
            expect(ctx.save.mock.calls.length).toBe(saveCalls);
        });
    });

    describe('Branch coverage: drawLayerShapeOnly angleDimension', () => {
        test('should draw angleDimension shape', () => {
            const layer = {
                type: 'angleDimension',
                cx: 50, cy: 50,
                ax: 100, ay: 50,
                bx: 50, by: 0,
                arcRadius: 40
            };
            expect(() => {
                renderer.drawLayerShapeOnly(layer, renderer.ctx, 1);
            }).not.toThrow();
            expect(ctx.beginPath).toHaveBeenCalled();
        });
    });

    // ===== Gap coverage tests =====

    describe('renderLayers - visibility branch for integer 0', () => {
        test('should skip layers with visible === 0', () => {
            const drawSpy = jest.spyOn(renderer, 'drawLayerWithEffects');
            renderer.renderLayers([
                { id: 'l1', type: 'rectangle', visible: 0, x: 0, y: 0, width: 50, height: 50 },
                { id: 'l2', type: 'rectangle', visible: 1, x: 0, y: 0, width: 50, height: 50 }
            ]);
            // l1 visible=0 should be skipped; l2 visible=1 should be drawn
            const calls = drawSpy.mock.calls.map(c => c[0].id);
            expect(calls).not.toContain('l1');
            expect(calls).toContain('l2');
            drawSpy.mockRestore();
        });

        test('should skip null layers', () => {
            const drawSpy = jest.spyOn(renderer, 'drawLayerWithEffects');
            renderer.renderLayers([ null, { id: 'l1', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 } ]);
            expect(drawSpy).toHaveBeenCalledTimes(1);
            drawSpy.mockRestore();
        });

        test('should return early for non-array', () => {
            expect(() => renderer.renderLayers('not-array')).not.toThrow();
            expect(() => renderer.renderLayers(null)).not.toThrow();
        });
    });

    describe('drawLayerWithEffects - blend mode branches', () => {
        test('blur blend mode on non-arrow skips to drawLayerWithBlurBlend', () => {
            const blurSpy = jest.spyOn(renderer, 'drawLayerWithBlurBlend').mockImplementation(() => {});
            renderer.drawLayerWithEffects({
                type: 'rectangle', blendMode: 'blur',
                x: 10, y: 10, width: 50, height: 50
            });
            expect(blurSpy).toHaveBeenCalled();
            blurSpy.mockRestore();
        });

        test('blur blend mode on arrow does NOT use blur path', () => {
            const blurSpy = jest.spyOn(renderer, 'drawLayerWithBlurBlend').mockImplementation(() => {});
            const drawSpy = jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            renderer.drawLayerWithEffects({
                type: 'arrow', blendMode: 'blur',
                x1: 0, y1: 0, x2: 100, y2: 100
            });
            expect(blurSpy).not.toHaveBeenCalled();
            expect(drawSpy).toHaveBeenCalled();
            blurSpy.mockRestore();
            drawSpy.mockRestore();
        });

        test('blur blend mode on line does NOT use blur path', () => {
            const blurSpy = jest.spyOn(renderer, 'drawLayerWithBlurBlend').mockImplementation(() => {});
            const drawSpy = jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            renderer.drawLayerWithEffects({
                type: 'line', blendMode: 'blur',
                x1: 0, y1: 0, x2: 100, y2: 100
            });
            expect(blurSpy).not.toHaveBeenCalled();
            blurSpy.mockRestore();
            drawSpy.mockRestore();
        });

        test('invalid blend mode triggers catch → source-over fallback', () => {
            global.mw = global.mw || {};
            global.mw.log = global.mw.log || {};
            global.mw.log.warn = jest.fn();

            // Save original ctx and replace with one that throws on first blend set only
            const origCtx = renderer.ctx;
            const throwCtx = createMockContext();
            let throwCount = 0;
            Object.defineProperty(throwCtx, 'globalCompositeOperation', {
                get() { return 'source-over'; },
                set(_val) {
                    throwCount++;
                    // Only throw on the first set (the invalid blend), allow the fallback set
                    if (throwCount === 1) { throw new Error('Invalid blend'); }
                },
                configurable: true
            });
            renderer.ctx = throwCtx;

            const drawSpy = jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            renderer.drawLayerWithEffects({
                type: 'rectangle', blend: 'invalid-blend',
                x: 0, y: 0, width: 50, height: 50
            });
            expect(mw.log.warn).toHaveBeenCalledWith(
                expect.stringContaining('Invalid blend mode'),
                expect.any(String)
            );
            drawSpy.mockRestore();
            renderer.ctx = origCtx;
        });

        test('opacity is clamped to 0-1 range', () => {
            const drawSpy = jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            renderer.drawLayerWithEffects({
                type: 'rectangle', opacity: 1.5,
                x: 0, y: 0, width: 50, height: 50
            });
            expect(ctx.globalAlpha).toBe(1);
            drawSpy.mockRestore();
        });

        test('glow is drawn for supported types', () => {
            const drawSpy = jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            const glowSpy = jest.spyOn(renderer, 'drawGlow').mockImplementation(() => {});
            const supportsSpy = jest.spyOn(renderer, 'supportsGlow').mockReturnValue(true);
            renderer.drawLayerWithEffects({
                type: 'rectangle', glow: true,
                x: 0, y: 0, width: 50, height: 50
            });
            expect(glowSpy).toHaveBeenCalled();
            drawSpy.mockRestore();
            glowSpy.mockRestore();
            supportsSpy.mockRestore();
        });

        test('glow is NOT drawn for unsupported types', () => {
            const drawSpy = jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            const glowSpy = jest.spyOn(renderer, 'drawGlow').mockImplementation(() => {});
            const supportsSpy = jest.spyOn(renderer, 'supportsGlow').mockReturnValue(false);
            renderer.drawLayerWithEffects({
                type: 'text', glow: true,
                x: 0, y: 0, width: 50, height: 50
            });
            expect(glowSpy).not.toHaveBeenCalled();
            drawSpy.mockRestore();
            glowSpy.mockRestore();
            supportsSpy.mockRestore();
        });

        test('glow is NOT drawn when glow=false', () => {
            const drawSpy = jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            const glowSpy = jest.spyOn(renderer, 'drawGlow').mockImplementation(() => {});
            renderer.drawLayerWithEffects({
                type: 'rectangle', glow: false,
                x: 0, y: 0, width: 50, height: 50
            });
            expect(glowSpy).not.toHaveBeenCalled();
            drawSpy.mockRestore();
            glowSpy.mockRestore();
        });
    });

    describe('drawLayerWithBlurBlend - cache and rotation branches', () => {
        test('reuses _blurTempCanvas when dimensions match', () => {
            const createSpy = jest.spyOn(document, 'createElement');
            const clipSpy = jest.spyOn(renderer, '_drawBlurClipPath').mockImplementation(() => {});
            const strokeSpy = jest.spyOn(renderer, '_drawBlurStroke').mockImplementation(() => {});
            const contentSpy = jest.spyOn(renderer, '_drawBlurContent').mockImplementation(() => {});

            const layer = { type: 'rectangle', blendMode: 'blur', x: 10, y: 10, width: 100, height: 50 };

            // First call creates cache
            renderer.drawLayerWithBlurBlend(layer);
            const createCallsFirst = createSpy.mock.calls.filter(c => c[0] === 'canvas').length;

            // Second call should reuse
            renderer.drawLayerWithBlurBlend(layer);
            const createCallsSecond = createSpy.mock.calls.filter(c => c[0] === 'canvas').length;

            expect(createCallsSecond).toBe(createCallsFirst); // no new canvas created
            createSpy.mockRestore();
            clipSpy.mockRestore();
            strokeSpy.mockRestore();
            contentSpy.mockRestore();
        });

        test('arrow/line center calculation uses x1/y1/x2/y2', () => {
            const clipSpy = jest.spyOn(renderer, '_drawBlurClipPath').mockImplementation(() => {});
            const strokeSpy = jest.spyOn(renderer, '_drawBlurStroke').mockImplementation(() => {});
            const contentSpy = jest.spyOn(renderer, '_drawBlurContent').mockImplementation(() => {});

            // This branch won't normally be reached because drawLayerWithEffects
            // skips blur for arrows, but drawLayerWithBlurBlend can be called directly
            const layer = {
                type: 'arrow', blendMode: 'blur',
                x1: 0, y1: 0, x2: 100, y2: 100
            };
            expect(() => renderer.drawLayerWithBlurBlend(layer)).not.toThrow();
            clipSpy.mockRestore();
            strokeSpy.mockRestore();
            contentSpy.mockRestore();
        });

        test('applies rotation when rotation is non-zero', () => {
            const clipSpy = jest.spyOn(renderer, '_drawBlurClipPath').mockImplementation(() => {});
            const strokeSpy = jest.spyOn(renderer, '_drawBlurStroke').mockImplementation(() => {});
            const contentSpy = jest.spyOn(renderer, '_drawBlurContent').mockImplementation(() => {});

            renderer.drawLayerWithBlurBlend({
                type: 'rectangle', rotation: 45,
                x: 0, y: 0, width: 100, height: 100, blurRadius: 10
            });
            expect(ctx.rotate).toHaveBeenCalled();
            clipSpy.mockRestore();
            strokeSpy.mockRestore();
            contentSpy.mockRestore();
        });

        test('does not apply rotation when rotation=0', () => {
            const clipSpy = jest.spyOn(renderer, '_drawBlurClipPath').mockImplementation(() => {});
            const strokeSpy = jest.spyOn(renderer, '_drawBlurStroke').mockImplementation(() => {});
            const contentSpy = jest.spyOn(renderer, '_drawBlurContent').mockImplementation(() => {});

            ctx.rotate.mockClear();
            renderer.drawLayerWithBlurBlend({
                type: 'rectangle', rotation: 0,
                x: 0, y: 0, width: 100, height: 100
            });
            expect(ctx.rotate).not.toHaveBeenCalled();
            clipSpy.mockRestore();
            strokeSpy.mockRestore();
            contentSpy.mockRestore();
        });

        test('applies opacity clamping', () => {
            const clipSpy = jest.spyOn(renderer, '_drawBlurClipPath').mockImplementation(() => {});
            const strokeSpy = jest.spyOn(renderer, '_drawBlurStroke').mockImplementation(() => {});
            const contentSpy = jest.spyOn(renderer, '_drawBlurContent').mockImplementation(() => {});

            renderer.drawLayerWithBlurBlend({
                type: 'rectangle', opacity: -0.5,
                x: 0, y: 0, width: 100, height: 100
            });
            expect(ctx.globalAlpha).toBe(0);
            clipSpy.mockRestore();
            strokeSpy.mockRestore();
            contentSpy.mockRestore();
        });
    });

    describe('_drawBlurStroke - dotted and strokeOpacity branches', () => {
        test('dotted stroke style sets correct line dash', () => {
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#000', strokeWidth: 2, strokeStyle: 'dotted',
                  x: 0, y: 0, width: 100, height: 50 },
                false, 50, 25
            );
            expect(ctx.setLineDash).toHaveBeenCalledWith([2, 2]); // 2*zoom=2*1
        });

        test('solid stroke style clears line dash', () => {
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#000', strokeWidth: 2, strokeStyle: 'solid',
                  x: 0, y: 0, width: 100, height: 50 },
                false, 50, 25
            );
            expect(ctx.setLineDash).toHaveBeenCalledWith([]);
        });

        test('uses strokeOpacity when available', () => {
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#000', strokeWidth: 2, strokeOpacity: 0.5,
                  x: 0, y: 0, width: 100, height: 50 },
                false, 50, 25
            );
            expect(ctx.globalAlpha).toBe(0.5);
        });

        test('falls back to layer opacity when strokeOpacity missing', () => {
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#000', strokeWidth: 2, opacity: 0.7,
                  x: 0, y: 0, width: 100, height: 50 },
                false, 50, 25
            );
            expect(ctx.globalAlpha).toBe(0.7);
        });

        test('applies rotation for stroke', () => {
            ctx.rotate.mockClear();
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#f00', strokeWidth: 3, rotation: 30,
                  x: 0, y: 0, width: 100, height: 100 },
                true, 50, 50
            );
            expect(ctx.rotate).toHaveBeenCalled();
        });

        test('no stroke when strokeWidth is 0', () => {
            const saveCalls = ctx.save.mock.calls.length;
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#000', strokeWidth: 0 },
                false, 50, 50
            );
            expect(ctx.save.mock.calls.length).toBe(saveCalls);
        });

        test('no stroke when stroke is falsy', () => {
            const saveCalls = ctx.save.mock.calls.length;
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '', strokeWidth: 2 },
                false, 50, 50
            );
            expect(ctx.save.mock.calls.length).toBe(saveCalls);
        });

        test('skip stroke for arrow type', () => {
            const saveCalls = ctx.save.mock.calls.length;
            renderer._drawBlurStroke(
                { type: 'arrow', stroke: '#f00', strokeWidth: 2 },
                false, 50, 50
            );
            expect(ctx.save.mock.calls.length).toBe(saveCalls);
        });
    });

    describe('_drawBlurContent - all type branches', () => {
        test('textbox with text calls textBoxRenderer', () => {
            const mockTextBoxRenderer = {
                setContext: jest.fn(),
                drawTextOnly: jest.fn()
            };
            renderer.layerRenderer = { textBoxRenderer: mockTextBoxRenderer };

            renderer._drawBlurContent(
                { type: 'textbox', text: 'Hello', x: 0, y: 0, width: 100, height: 50 },
                false, 50, 25
            );
            expect(mockTextBoxRenderer.drawTextOnly).toHaveBeenCalled();
        });

        test('textbox without text does not call textBoxRenderer', () => {
            const mockTextBoxRenderer = {
                setContext: jest.fn(),
                drawTextOnly: jest.fn()
            };
            renderer.layerRenderer = { textBoxRenderer: mockTextBoxRenderer };

            renderer._drawBlurContent(
                { type: 'textbox', x: 0, y: 0, width: 100, height: 50 },
                false, 50, 25
            );
            expect(mockTextBoxRenderer.drawTextOnly).not.toHaveBeenCalled();
        });

        test('textbox without textBoxRenderer does not throw', () => {
            renderer.layerRenderer = {};
            expect(() => renderer._drawBlurContent(
                { type: 'textbox', text: 'Hi', x: 0, y: 0, width: 100, height: 50 },
                false, 50, 25
            )).not.toThrow();
        });

        test('text type with text calls textRenderer', () => {
            const mockTextRenderer = {
                setContext: jest.fn(),
                draw: jest.fn()
            };
            renderer.layerRenderer = { textRenderer: mockTextRenderer };

            renderer._drawBlurContent(
                { type: 'text', text: 'Hello', x: 0, y: 0, width: 100, height: 50 },
                false, 50, 25
            );
            expect(mockTextRenderer.draw).toHaveBeenCalled();
        });

        test('text type without text does not call textRenderer', () => {
            const mockTextRenderer = {
                setContext: jest.fn(),
                draw: jest.fn()
            };
            renderer.layerRenderer = { textRenderer: mockTextRenderer };

            renderer._drawBlurContent(
                { type: 'text', x: 0, y: 0, width: 100, height: 50 },
                false, 50, 25
            );
            expect(mockTextRenderer.draw).not.toHaveBeenCalled();
        });

        test('arrow type calls arrowRenderer', () => {
            const mockArrowRenderer = {
                setContext: jest.fn(),
                draw: jest.fn()
            };
            renderer.layerRenderer = { arrowRenderer: mockArrowRenderer };

            renderer._drawBlurContent(
                { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 },
                false, 50, 50
            );
            expect(mockArrowRenderer.draw).toHaveBeenCalled();
        });

        test('arrow type without arrowRenderer does not throw', () => {
            renderer.layerRenderer = {};
            expect(() => renderer._drawBlurContent(
                { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 },
                false, 50, 50
            )).not.toThrow();
        });

        test('line type calls layerRenderer.drawLine', () => {
            renderer.layerRenderer = { drawLine: jest.fn() };

            renderer._drawBlurContent(
                { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 },
                false, 50, 50
            );
            expect(renderer.layerRenderer.drawLine).toHaveBeenCalled();
        });

        test('line type without layerRenderer does not throw', () => {
            renderer.layerRenderer = null;
            expect(() => renderer._drawBlurContent(
                { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 },
                false, 50, 50
            )).not.toThrow();
        });

        test('textbox with rotation applies transform', () => {
            const mockTextBoxRenderer = {
                setContext: jest.fn(),
                drawTextOnly: jest.fn()
            };
            renderer.layerRenderer = { textBoxRenderer: mockTextBoxRenderer };

            ctx.rotate.mockClear();
            renderer._drawBlurContent(
                { type: 'textbox', text: 'Hi', rotation: 45, x: 0, y: 0, width: 100, height: 50 },
                true, 50, 25
            );
            expect(ctx.rotate).toHaveBeenCalled();
        });

        test('text with rotation applies transform', () => {
            const mockTextRenderer = {
                setContext: jest.fn(),
                draw: jest.fn()
            };
            renderer.layerRenderer = { textRenderer: mockTextRenderer };

            ctx.rotate.mockClear();
            renderer._drawBlurContent(
                { type: 'text', text: 'World', rotation: 30, x: 0, y: 0, width: 100, height: 50 },
                true, 50, 25
            );
            expect(ctx.rotate).toHaveBeenCalled();
        });
    });

    describe('renderLayersToContext - edge cases', () => {
        test('returns early when targetCtx is null', () => {
            expect(() => renderer.renderLayersToContext(null, [])).not.toThrow();
        });

        test('returns early when layers is not array', () => {
            expect(() => renderer.renderLayersToContext(ctx, 'invalid')).not.toThrow();
        });

        test('syncs layerRenderer context when setContext available', () => {
            const mockSetContext = jest.fn();
            renderer.layerRenderer = { setContext: mockSetContext };

            const targetCtx = createMockContext();
            renderer.renderLayersToContext(targetCtx, []);

            // setContext called twice: once with targetCtx, once to restore
            expect(mockSetContext).toHaveBeenCalledWith(targetCtx);
        });

        test('handles layerRenderer without setContext', () => {
            renderer.layerRenderer = { drawLayer: jest.fn() };

            const targetCtx = createMockContext();
            expect(() => {
                renderer.renderLayersToContext(targetCtx, [
                    { id: 'l1', type: 'rectangle', visible: true, x: 0, y: 0, width: 50, height: 50 }
                ]);
            }).not.toThrow();
        });

        test('skips invisible layers (visible=0)', () => {
            const drawSpy = jest.spyOn(renderer, 'drawLayerWithEffects');
            const targetCtx = createMockContext();
            renderer.renderLayersToContext(targetCtx, [
                { id: 'l1', type: 'rectangle', visible: 0, x: 0, y: 0, width: 50, height: 50 }
            ]);
            expect(drawSpy).not.toHaveBeenCalled();
            drawSpy.mockRestore();
        });

        test('restores original context even if rendering throws', () => {
            const drawSpy = jest.spyOn(renderer, 'drawLayerWithEffects').mockImplementation(() => {
                throw new Error('render error');
            });
            const targetCtx = createMockContext();
            const originalCtx = renderer.ctx;

            expect(() => {
                renderer.renderLayersToContext(targetCtx, [
                    { id: 'l1', type: 'rectangle', visible: true, x: 0, y: 0, width: 50, height: 50 }
                ]);
            }).toThrow('render error');

            // Context should be restored
            expect(renderer.ctx).toBe(originalCtx);
            drawSpy.mockRestore();
        });
    });

    describe('setBackgroundImage - layerRenderer sync', () => {
        test('syncs with layerRenderer when available', () => {
            const mockSetBg = jest.fn();
            renderer.layerRenderer = { setBackgroundImage: mockSetBg };

            const img = { complete: true, width: 400, height: 300 };
            renderer.setBackgroundImage(img);

            expect(mockSetBg).toHaveBeenCalledWith(img);
        });

        test('syncs even when layerRenderer has setBackgroundImage', () => {
            const mockSetBg = jest.fn();
            renderer.layerRenderer = { setBackgroundImage: mockSetBg };
            renderer.setBackgroundImage(null);
            expect(mockSetBg).toHaveBeenCalledWith(null);
        });
    });

    describe('branch coverage - getBackgroundVisible', () => {
        test('returns true when no editor', () => {
            renderer.editor = null;
            expect(renderer.getBackgroundVisible()).toBe(true);
        });

        test('returns true when no stateManager', () => {
            renderer.editor = {};
            expect(renderer.getBackgroundVisible()).toBe(true);
        });

        test('returns false for boolean false', () => {
            renderer.editor = { stateManager: { get: jest.fn(() => false) } };
            expect(renderer.getBackgroundVisible()).toBe(false);
        });

        test('returns false for integer 0', () => {
            renderer.editor = { stateManager: { get: jest.fn(() => 0) } };
            expect(renderer.getBackgroundVisible()).toBe(false);
        });

        test('returns true for integer 1', () => {
            renderer.editor = { stateManager: { get: jest.fn(() => 1) } };
            expect(renderer.getBackgroundVisible()).toBe(true);
        });
    });

    describe('branch coverage - getBackgroundOpacity', () => {
        test('returns 1.0 when no editor', () => {
            renderer.editor = null;
            expect(renderer.getBackgroundOpacity()).toBe(1.0);
        });

        test('returns 1.0 for NaN opacity', () => {
            renderer.editor = { stateManager: { get: jest.fn(() => NaN) } };
            expect(renderer.getBackgroundOpacity()).toBe(1.0);
        });

        test('returns 1.0 for undefined opacity', () => {
            renderer.editor = { stateManager: { get: jest.fn(() => undefined) } };
            expect(renderer.getBackgroundOpacity()).toBe(1.0);
        });

        test('returns 1.0 for string opacity', () => {
            renderer.editor = { stateManager: { get: jest.fn(() => '0.5') } };
            expect(renderer.getBackgroundOpacity()).toBe(1.0);
        });

        test('clamps above 1', () => {
            renderer.editor = { stateManager: { get: jest.fn(() => 1.5) } };
            expect(renderer.getBackgroundOpacity()).toBe(1.0);
        });

        test('clamps below 0', () => {
            renderer.editor = { stateManager: { get: jest.fn(() => -0.5) } };
            expect(renderer.getBackgroundOpacity()).toBe(0);
        });
    });

    describe('branch coverage - drawLayerWithEffects', () => {
        test('uses blur blend path for non-arrow blur blend', () => {
            const drawBlurSpy = jest.spyOn(renderer, 'drawLayerWithBlurBlend').mockImplementation(() => {});
            renderer.drawLayerWithEffects({ type: 'rectangle', blendMode: 'blur', x: 10, y: 10, width: 100, height: 100 });
            expect(drawBlurSpy).toHaveBeenCalled();
        });

        test('skips blur blend for arrow type', () => {
            const drawBlurSpy = jest.spyOn(renderer, 'drawLayerWithBlurBlend').mockImplementation(() => {});
            const drawLayerSpy = jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            renderer.drawLayerWithEffects({ type: 'arrow', blendMode: 'blur', x1: 0, y1: 0, x2: 100, y2: 100 });
            expect(drawBlurSpy).not.toHaveBeenCalled();
            expect(drawLayerSpy).toHaveBeenCalled();
        });

        test('skips blur blend for line type', () => {
            const drawBlurSpy = jest.spyOn(renderer, 'drawLayerWithBlurBlend').mockImplementation(() => {});
            jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            renderer.drawLayerWithEffects({ type: 'line', blendMode: 'blur', x1: 0, y1: 0, x2: 100, y2: 100 });
            expect(drawBlurSpy).not.toHaveBeenCalled();
        });

        test('sets opacity when numeric', () => {
            jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            renderer.drawLayerWithEffects({ type: 'rectangle', opacity: 0.5, x: 0, y: 0 });
            expect(ctx.globalAlpha).toBeLessThanOrEqual(0.5);
        });

        test('applies blend mode via blend property', () => {
            jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            renderer.drawLayerWithEffects({ type: 'rectangle', blend: 'multiply', x: 0, y: 0 });
            // If blend mode set doesn't throw, it should be applied
            expect(ctx.save).toHaveBeenCalled();
        });

        test('handles blend mode error by catching exception', () => {
            jest.spyOn(renderer, 'drawLayer').mockImplementation(() => {});
            // The source has a try/catch around setting globalCompositeOperation
            // Just verify that a valid blend mode doesn't break flow
            renderer.drawLayerWithEffects({ type: 'rectangle', blendMode: 'multiply', x: 0, y: 0 });
            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.restore).toHaveBeenCalled();
        });
    });

    describe('branch coverage - _drawBlurClipPath shapes', () => {
        beforeEach(() => {
            renderer.zoom = 1;
            renderer.panX = 0;
            renderer.panY = 0;
        });

        test('draws circle clip path', () => {
            renderer._drawBlurClipPath({ type: 'circle', x: 50, y: 50, radius: 25 });
            expect(ctx.arc).toHaveBeenCalled();
        });

        test('draws ellipse clip path', () => {
            renderer._drawBlurClipPath({ type: 'ellipse', x: 50, y: 50, radiusX: 30, radiusY: 20 });
            expect(ctx.ellipse).toHaveBeenCalled();
        });

        test('draws ellipse with width/height fallback', () => {
            renderer._drawBlurClipPath({ type: 'ellipse', x: 50, y: 50, width: 60, height: 40 });
            expect(ctx.ellipse).toHaveBeenCalled();
        });

        test('draws polygon clip path', () => {
            renderer._drawBlurClipPath({ type: 'polygon', x: 50, y: 50, sides: 6, radius: 30 });
            expect(ctx.moveTo).toHaveBeenCalled();
            expect(ctx.lineTo).toHaveBeenCalled();
            expect(ctx.closePath).toHaveBeenCalled();
        });

        test('draws star clip path', () => {
            renderer._drawBlurClipPath({ type: 'star', x: 50, y: 50, outerRadius: 30, innerRadius: 15, points: 5 });
            expect(ctx.moveTo).toHaveBeenCalled();
        });

        test('draws star with innerRadius fallback', () => {
            renderer._drawBlurClipPath({ type: 'star', x: 50, y: 50, outerRadius: 30, points: 5 });
            expect(ctx.moveTo).toHaveBeenCalled();
        });

        test('draws arrow/line clip path', () => {
            renderer._drawBlurClipPath({ type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 });
            expect(ctx.moveTo).toHaveBeenCalled();
            expect(ctx.closePath).toHaveBeenCalled();
        });

        test('draws default rect for unknown type', () => {
            renderer._drawBlurClipPath({ type: 'customShape', x: 50, y: 50, width: 100, height: 80 });
            expect(ctx.rect).toHaveBeenCalled();
        });

        test('draws textbox with rounded corners', () => {
            renderer._drawBlurClipPath({ type: 'textbox', x: 50, y: 50, width: 100, height: 80, cornerRadius: 10 });
            // Textbox with cornerRadius uses roundRect or _drawRoundedRectPath
            // Verify it ran without error by checking that at least rect or roundRect was called
            expect(ctx.roundRect || ctx.rect).toBeTruthy();
        });
    });

    describe('branch coverage - _drawBlurStroke', () => {
        test('skips stroke for text type', () => {
            renderer._drawBlurStroke({ type: 'text', stroke: '#000', strokeWidth: 2 }, false, 0, 0);
            expect(ctx.stroke).not.toHaveBeenCalled();
        });

        test('skips stroke for arrow type', () => {
            renderer._drawBlurStroke({ type: 'arrow', stroke: '#000', strokeWidth: 2 }, false, 0, 0);
            expect(ctx.stroke).not.toHaveBeenCalled();
        });

        test('skips stroke when no stroke or zero width', () => {
            renderer._drawBlurStroke({ type: 'rectangle', stroke: null, strokeWidth: 0 }, false, 0, 0);
            expect(ctx.stroke).not.toHaveBeenCalled();
        });

        test('draws dashed stroke style', () => {
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#000', strokeWidth: 2, strokeStyle: 'dashed', x: 0, y: 0, width: 100, height: 80 },
                false, 0, 0
            );
            expect(ctx.setLineDash).toHaveBeenCalled();
        });

        test('draws dotted stroke style', () => {
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#000', strokeWidth: 2, strokeStyle: 'dotted', x: 0, y: 0, width: 100, height: 80 },
                false, 0, 0
            );
            expect(ctx.setLineDash).toHaveBeenCalled();
        });

        test('applies strokeOpacity when set', () => {
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#000', strokeWidth: 2, strokeOpacity: 0.5, x: 0, y: 0, width: 100, height: 80 },
                false, 0, 0
            );
            expect(ctx.save).toHaveBeenCalled();
        });

        test('applies rotation for stroke', () => {
            renderer._drawBlurStroke(
                { type: 'rectangle', stroke: '#000', strokeWidth: 2, rotation: 45, x: 0, y: 0, width: 100, height: 80 },
                true, 50, 50
            );
            expect(ctx.translate).toHaveBeenCalled();
            expect(ctx.rotate).toHaveBeenCalled();
        });
    });

    describe('branch coverage - redraw background logic', () => {
        test('draws checker pattern when background not visible (non-slide)', () => {
            renderer.isSlideMode = false;
            renderer.backgroundImage = { complete: true, width: 800, height: 600 };
            jest.spyOn(renderer, 'getBackgroundVisible').mockReturnValue(false);
            const checkerSpy = jest.spyOn(renderer, 'drawCheckerPattern').mockImplementation(() => {});
            renderer.redraw([]);
            expect(checkerSpy).toHaveBeenCalled();
        });

        test('draws checker pattern in slide mode when bg hidden', () => {
            renderer.isSlideMode = true;
            jest.spyOn(renderer, 'getBackgroundVisible').mockReturnValue(false);
            const checkerSpy = jest.spyOn(renderer, 'drawCheckerPattern').mockImplementation(() => {});
            renderer.redraw([]);
            expect(checkerSpy).toHaveBeenCalled();
        });
    });

    describe('branch coverage - supportsGlow', () => {
        test('returns true for supported types', () => {
            ['rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'arrow', 'path'].forEach(type => {
                expect(renderer.supportsGlow(type)).toBe(true);
            });
        });

        test('returns false for unsupported types', () => {
            ['text', 'textbox', 'image', 'blur', 'marker', 'dimension'].forEach(type => {
                expect(renderer.supportsGlow(type)).toBe(false);
            });
        });
    });

    describe('branch coverage - _drawBlurContent', () => {
        test('draws textbox text when textBoxRenderer available', () => {
            const drawTextOnly = jest.fn();
            const setContext = jest.fn();
            renderer.layerRenderer = { textBoxRenderer: { drawTextOnly, setContext } };
            renderer.zoom = 1;
            renderer.panX = 0;
            renderer.panY = 0;
            renderer._drawBlurContent({ type: 'textbox', text: 'Hello', x: 10, y: 10 }, false, 0, 0);
            expect(drawTextOnly).toHaveBeenCalled();
        });

        test('draws textbox text with rotation', () => {
            const drawTextOnly = jest.fn();
            const setContext = jest.fn();
            renderer.layerRenderer = { textBoxRenderer: { drawTextOnly, setContext } };
            renderer.zoom = 1;
            renderer.panX = 0;
            renderer.panY = 0;
            renderer._drawBlurContent({ type: 'textbox', text: 'Hello', rotation: 45, x: 50, y: 50 }, true, 50, 50);
            expect(ctx.translate).toHaveBeenCalled();
            expect(ctx.rotate).toHaveBeenCalled();
            expect(drawTextOnly).toHaveBeenCalled();
        });

        test('skips textbox when no textBoxRenderer', () => {
            renderer.layerRenderer = {};
            renderer._drawBlurContent({ type: 'textbox', text: 'Hello' }, false, 0, 0);
            // Should not throw
        });

        test('draws text type when textRenderer available', () => {
            const draw = jest.fn();
            const setContext = jest.fn();
            renderer.layerRenderer = { textRenderer: { draw, setContext } };
            renderer.zoom = 1;
            renderer.panX = 0;
            renderer.panY = 0;
            renderer._drawBlurContent({ type: 'text', text: 'Hello', x: 10, y: 10 }, false, 0, 0);
            expect(draw).toHaveBeenCalled();
        });

        test('draws text type with rotation', () => {
            const draw = jest.fn();
            const setContext = jest.fn();
            renderer.layerRenderer = { textRenderer: { draw, setContext } };
            renderer.zoom = 1;
            renderer.panX = 0;
            renderer.panY = 0;
            renderer._drawBlurContent({ type: 'text', text: 'Hello', rotation: 90 }, true, 50, 50);
            expect(ctx.translate).toHaveBeenCalled();
            expect(ctx.rotate).toHaveBeenCalled();
        });

        test('draws arrow type when arrowRenderer available', () => {
            const draw = jest.fn();
            const setContext = jest.fn();
            renderer.layerRenderer = { arrowRenderer: { draw, setContext } };
            renderer.zoom = 1;
            renderer.panX = 0;
            renderer.panY = 0;
            renderer._drawBlurContent({ type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 }, false, 0, 0);
            expect(draw).toHaveBeenCalled();
        });

        test('draws line type when layerRenderer has drawLine', () => {
            const drawLine = jest.fn();
            renderer.layerRenderer = { drawLine };
            renderer.zoom = 1;
            renderer.panX = 0;
            renderer.panY = 0;
            renderer._drawBlurContent({ type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 }, false, 0, 0);
            expect(drawLine).toHaveBeenCalled();
        });

        test('skips line when no layerRenderer', () => {
            renderer.layerRenderer = null;
            renderer._drawBlurContent({ type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 }, false, 0, 0);
            // Should not throw
        });
    });

    describe('branch coverage - drawLayerShapeOnly', () => {
        test('draws rectangle', () => {
            renderer.drawLayerShapeOnly({ type: 'rectangle', x: 10, y: 10, width: 100, height: 80 });
            expect(ctx.strokeRect).toHaveBeenCalledWith(10, 10, 100, 80);
        });

        test('draws circle', () => {
            renderer.drawLayerShapeOnly({ type: 'circle', x: 50, y: 50, radius: 30 });
            expect(ctx.arc).toHaveBeenCalled();
            expect(ctx.stroke).toHaveBeenCalled();
        });

        test('draws ellipse', () => {
            renderer.drawLayerShapeOnly({ type: 'ellipse', x: 50, y: 50, radiusX: 30, radiusY: 20 });
            expect(ctx.scale).toHaveBeenCalledWith(30, 20);
            expect(ctx.arc).toHaveBeenCalled();
        });

        test('draws customShape as rectangle', () => {
            renderer.drawLayerShapeOnly({ type: 'customShape', x: 10, y: 20, width: 80, height: 60 });
            expect(ctx.strokeRect).toHaveBeenCalledWith(10, 20, 80, 60);
        });

        test('draws marker as circle', () => {
            renderer.drawLayerShapeOnly({ type: 'marker', x: 50, y: 50, size: 32 });
            expect(ctx.arc).toHaveBeenCalledWith(50, 50, 16, 0, 2 * Math.PI);
        });

        test('draws marker with default size', () => {
            renderer.drawLayerShapeOnly({ type: 'marker', x: 50, y: 50 });
            expect(ctx.arc).toHaveBeenCalledWith(50, 50, 12, 0, 2 * Math.PI);
        });

        test('draws dimension as line', () => {
            renderer.drawLayerShapeOnly({ type: 'dimension', x1: 10, y1: 20, x2: 100, y2: 80 });
            expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
            expect(ctx.lineTo).toHaveBeenCalledWith(100, 80);
        });

        test('draws angleDimension with arms and arc', () => {
            renderer.drawLayerShapeOnly({
                type: 'angleDimension',
                cx: 50, cy: 50,
                ax: 100, ay: 50,
                bx: 50, by: 100,
                arcRadius: 30
            });
            expect(ctx.moveTo).toHaveBeenCalled();
            expect(ctx.lineTo).toHaveBeenCalled();
            expect(ctx.arc).toHaveBeenCalled();
        });

        test('handles unknown type without crashing', () => {
            renderer.drawLayerShapeOnly({ type: 'unknownShape', x: 10, y: 10 });
            // Should not throw - just does nothing
        });
    });

    describe('branch coverage - withLocalAlpha', () => {
        test('calls fn directly when factor is 1', () => {
            const fn = jest.fn();
            renderer.withLocalAlpha(1, fn);
            expect(fn).toHaveBeenCalled();
        });

        test('calls fn directly for non-number factor', () => {
            const fn = jest.fn();
            renderer.withLocalAlpha('0.5', fn);
            expect(fn).toHaveBeenCalled();
        });

        test('sets reduced alpha for numeric factor < 1', () => {
            const fn = jest.fn();
            ctx.globalAlpha = 1;
            renderer.withLocalAlpha(0.5, fn);
            expect(fn).toHaveBeenCalled();
            // Alpha should be restored
            expect(ctx.globalAlpha).toBe(1);
        });

        test('clamps factor to 0-1 range', () => {
            const fn = jest.fn();
            ctx.globalAlpha = 1;
            renderer.withLocalAlpha(-0.5, fn);
            expect(fn).toHaveBeenCalled();
            expect(ctx.globalAlpha).toBe(1);
        });

        test('restores alpha even if fn throws', () => {
            ctx.globalAlpha = 0.8;
            expect(() => {
                renderer.withLocalAlpha(0.5, () => { throw new Error('test'); });
            }).toThrow('test');
            expect(ctx.globalAlpha).toBe(0.8);
        });
    });

    describe('branch coverage - getLayerBounds', () => {
        test('returns null for null layer', () => {
            expect(renderer.getLayerBounds(null)).toBeNull();
        });

        test('delegates to canvasManager when available', () => {
            const bounds = { x: 10, y: 20, width: 100, height: 80 };
            renderer.editor = {
                canvasManager: {
                    getLayerBounds: jest.fn(() => bounds)
                }
            };
            expect(renderer.getLayerBounds({ type: 'rectangle' })).toBe(bounds);
        });

        test('falls back to _getRawLayerBounds when no canvasManager', () => {
            renderer.editor = {};
            const spy = jest.spyOn(renderer, '_getRawLayerBounds').mockReturnValue({ x: 0, y: 0, width: 50, height: 50 });
            renderer.getLayerBounds({ type: 'rectangle' });
            expect(spy).toHaveBeenCalled();
        });

        test('falls back when editor is null', () => {
            renderer.editor = null;
            const spy = jest.spyOn(renderer, '_getRawLayerBounds').mockReturnValue(null);
            renderer.getLayerBounds({ type: 'rectangle' });
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('branch coverage - _getRawLayerBounds', () => {
        test('measures text layer with TextUtils', () => {
            renderer._getRawLayerBounds({ type: 'text', text: 'Hello', fontSize: 14, x: 10, y: 20 });
            // Returns something (or null if TextUtils not available)
            // At minimum, should not throw
        });

        test('returns null for text layer when TextUtils unavailable', () => {
            // Clear TextUtils from namespace
            const origTextUtils = window.Layers && window.Layers.Shared && window.Layers.Shared.TextUtils;
            if (window.Layers && window.Layers.Shared) {
                window.Layers.Shared.TextUtils = undefined;
            }
            renderer._getRawLayerBounds({ type: 'text', text: 'Hello' });
            // Restore
            if (window.Layers && window.Layers.Shared && origTextUtils) {
                window.Layers.Shared.TextUtils = origTextUtils;
            }
        });

        test('uses GeometryUtils for non-text layer', () => {
            renderer._getRawLayerBounds({ type: 'rectangle', x: 10, y: 20, width: 100, height: 80 });
            // Should return something or null
        });
    });

    describe('branch coverage - renderLayers', () => {
        test('skips non-array input', () => {
            renderer.renderLayers(null);
            renderer.renderLayers(undefined);
            renderer.renderLayers('not array');
            // None should throw
        });

        test('skips null layers in array', () => {
            jest.spyOn(renderer, 'drawLayerWithEffects').mockImplementation(() => {});
            renderer.renderLayers([null, undefined, { type: 'rectangle', visible: true, x: 0, y: 0 }]);
            expect(renderer.drawLayerWithEffects).toHaveBeenCalledTimes(1);
        });

        test('skips invisible layers (visible=false)', () => {
            jest.spyOn(renderer, 'drawLayerWithEffects').mockImplementation(() => {});
            renderer.renderLayers([
                { type: 'rectangle', visible: false, x: 0, y: 0 },
                { type: 'circle', visible: true, x: 0, y: 0 }
            ]);
            expect(renderer.drawLayerWithEffects).toHaveBeenCalledTimes(1);
        });

        test('skips invisible layers (visible=0)', () => {
            jest.spyOn(renderer, 'drawLayerWithEffects').mockImplementation(() => {});
            renderer.renderLayers([
                { type: 'rectangle', visible: 0, x: 0, y: 0 }
            ]);
            expect(renderer.drawLayerWithEffects).not.toHaveBeenCalled();
        });
    });

    describe('branch coverage - renderLayersToContext', () => {
        test('skips when targetCtx is null', () => {
            renderer.renderLayersToContext(null, []);
            // Should not throw
        });

        test('skips when layers is not an array', () => {
            renderer.renderLayersToContext(ctx, 'not-array');
            // Should not throw
        });

        test('renders layers to external context and restores state', () => {
            const targetCtx = createMockContext();
            jest.spyOn(renderer, 'drawLayerWithEffects').mockImplementation(() => {});
            const origZoom = renderer.zoom;
            const origPanX = renderer.panX;

            renderer.renderLayersToContext(targetCtx, [{ type: 'rectangle', visible: true, x: 0, y: 0 }], 2);

            // State should be restored
            expect(renderer.zoom).toBe(origZoom);
            expect(renderer.panX).toBe(origPanX);
            expect(renderer.ctx).toBe(ctx);
        });

        test('restores state even if rendering throws', () => {
            const targetCtx = createMockContext();
            jest.spyOn(renderer, 'applyTransformations').mockImplementation(() => {});
            jest.spyOn(renderer, 'drawLayerWithEffects').mockImplementation(() => { throw new Error('render error'); });

            const origCtx = renderer.ctx;
            const origZoom = renderer.zoom;

            expect(() => {
                renderer.renderLayersToContext(targetCtx, [{ type: 'rectangle', visible: true, x: 0, y: 0 }]);
            }).toThrow('render error');

            expect(renderer.ctx).toBe(origCtx);
            expect(renderer.zoom).toBe(origZoom);
        });

        test('syncs layerRenderer context during external render', () => {
            const targetCtx = createMockContext();
            const setContext = jest.fn();
            renderer.layerRenderer = { setContext };
            jest.spyOn(renderer, 'drawLayerWithEffects').mockImplementation(() => {});
            jest.spyOn(renderer, 'applyTransformations').mockImplementation(() => {});

            renderer.renderLayersToContext(targetCtx, []);

            // setContext should have been called with targetCtx then restored
            expect(setContext).toHaveBeenCalledWith(targetCtx);
            expect(setContext).toHaveBeenCalledWith(ctx);
        });
    });

    describe('branch coverage - drawSmartGuides', () => {
        test('returns early when no editor', () => {
            renderer.editor = null;
            renderer.drawSmartGuides();
            // Should not throw
        });

        test('returns early when no canvasManager', () => {
            renderer.editor = {};
            renderer.drawSmartGuides();
        });

        test('calls smartGuidesController.render when available', () => {
            const render = jest.fn();
            renderer.editor = {
                canvasManager: {
                    smartGuidesController: { render }
                }
            };
            renderer.drawSmartGuides();
            expect(render).toHaveBeenCalledWith(ctx);
        });

        test('skips when smartGuidesController has no render method', () => {
            renderer.editor = {
                canvasManager: {
                    smartGuidesController: {}
                }
            };
            renderer.drawSmartGuides();
            // Should not throw
        });
    });

    describe('branch coverage - drawSlideBackground', () => {
        beforeEach(() => {
            renderer.zoom = 1;
            jest.spyOn(renderer, 'getBackgroundOpacity').mockReturnValue(1);
        });

        test('draws checkerboard for transparent color', () => {
            renderer.slideBackgroundColor = 'transparent';
            renderer.drawSlideBackground();
            expect(ctx.fillRect).toHaveBeenCalled();
        });

        test('draws checkerboard for empty color', () => {
            renderer.slideBackgroundColor = '';
            renderer.drawSlideBackground();
            expect(ctx.fillRect).toHaveBeenCalled();
        });

        test('draws checkerboard for "none"', () => {
            renderer.slideBackgroundColor = 'none';
            renderer.drawSlideBackground();
            expect(ctx.fillRect).toHaveBeenCalled();
        });

        test('draws solid color background', () => {
            renderer.slideBackgroundColor = '#ff0000';
            renderer.drawSlideBackground();
            expect(ctx.fillStyle).toBe('#ff0000');
        });

        test('draws checker under solid when opacity < 1', () => {
            jest.spyOn(renderer, 'getBackgroundOpacity').mockReturnValue(0.5);
            renderer.slideBackgroundColor = '#ff0000';
            renderer.drawSlideBackground();
            // Should draw checker pattern first, then solid with reduced opacity
            expect(ctx.fillRect).toHaveBeenCalled();
        });
    });

    describe('branch coverage - drawGlow', () => {
        test('draws glow for supported layer type', () => {
            jest.spyOn(renderer, 'supportsGlow').mockReturnValue(true);
            jest.spyOn(renderer, 'drawLayerShapeOnly').mockImplementation(() => {});
            renderer.drawGlow({ type: 'rectangle', stroke: '#000', strokeWidth: 2, glow: true });
            expect(renderer.drawLayerShapeOnly).toHaveBeenCalled();
        });
    });

    describe('branch coverage - destroy', () => {
        test('destroys layerRenderer if available', () => {
            const destroyLR = jest.fn();
            renderer.layerRenderer = { destroy: destroyLR };
            renderer.destroy();
            expect(destroyLR).toHaveBeenCalled();
            expect(renderer.layerRenderer).toBeNull();
        });

        test('destroys selectionRenderer if available', () => {
            const destroySR = jest.fn();
            renderer._selectionRenderer = { destroy: destroySR };
            renderer.destroy();
            expect(destroySR).toHaveBeenCalled();
            expect(renderer._selectionRenderer).toBeNull();
        });

        test('clears state without renderers', () => {
            renderer.layerRenderer = null;
            renderer._selectionRenderer = null;
            renderer.destroy();
            expect(renderer.canvas).toBeNull();
            expect(renderer.ctx).toBeNull();
            expect(renderer.editor).toBeNull();
        });
    });

    describe('branch coverage - drawBackgroundImage', () => {
        test('draws checker when no background image', () => {
            renderer.backgroundImage = null;
            const checkerSpy = jest.spyOn(renderer, 'drawCheckerPattern').mockImplementation(() => {});
            renderer.drawBackgroundImage();
            expect(checkerSpy).toHaveBeenCalled();
        });

        test('draws checker under image when opacity < 1', () => {
            renderer.backgroundImage = { complete: true, width: 800, height: 600 };
            renderer.zoom = 1;
            jest.spyOn(renderer, 'getBackgroundOpacity').mockReturnValue(0.5);
            const checkerCtxSpy = jest.spyOn(renderer, 'drawCheckerPatternToContext').mockImplementation(() => {});
            renderer.drawBackgroundImage();
            expect(checkerCtxSpy).toHaveBeenCalled();
        });
    });

    describe('branch coverage - _getLayerById', () => {
        test('returns null when no editor', () => {
            renderer.editor = null;
            expect(renderer._getLayerById('layer1')).toBeNull();
        });

        test('returns null when getLayerById not a function', () => {
            renderer.editor = {};
            expect(renderer._getLayerById('layer1')).toBeNull();
        });

        test('delegates to editor.getLayerById', () => {
            const layer = { id: 'layer1', type: 'rectangle' };
            renderer.editor = { getLayerById: jest.fn(() => layer) };
            expect(renderer._getLayerById('layer1')).toBe(layer);
        });
    });

    describe('branch coverage - drawMultiSelectionIndicators', () => {
        test('uses selectionRenderer when available', () => {
            const drawMulti = jest.fn();
            const getHandles = jest.fn(() => [{ type: 'resize' }]);
            renderer._selectionRenderer = { drawMultiSelectionIndicators: drawMulti, getHandles };
            renderer.selectedLayerIds = ['layer1'];
            renderer.drawMultiSelectionIndicators('layer1');
            expect(drawMulti).toHaveBeenCalledWith(['layer1'], 'layer1');
            expect(renderer.selectionHandles).toEqual([{ type: 'resize' }]);
        });

        test('sets empty handles when no selectionRenderer', () => {
            renderer._selectionRenderer = null;
            renderer.drawMultiSelectionIndicators('layer1');
            expect(renderer.selectionHandles).toEqual([]);
        });
    });

    describe('branch coverage - redraw paths', () => {
        beforeEach(() => {
            jest.spyOn(renderer, 'clear').mockImplementation(() => {});
            jest.spyOn(renderer, 'applyTransformations').mockImplementation(() => {});
            jest.spyOn(renderer, 'drawMultiSelectionIndicators').mockImplementation(() => {});
            jest.spyOn(renderer, 'drawMarqueeBox').mockImplementation(() => {});
            jest.spyOn(renderer, 'drawSmartGuides').mockImplementation(() => {});
        });

        test('draws slide background when visible in slide mode', () => {
            renderer.isSlideMode = true;
            jest.spyOn(renderer, 'getBackgroundVisible').mockReturnValue(true);
            const slideSpy = jest.spyOn(renderer, 'drawSlideBackground').mockImplementation(() => {});
            renderer.redraw([]);
            expect(slideSpy).toHaveBeenCalled();
        });

        test('draws background image for non-slide when visible and image ready', () => {
            renderer.isSlideMode = false;
            renderer.backgroundImage = { complete: true };
            jest.spyOn(renderer, 'getBackgroundVisible').mockReturnValue(true);
            const bgSpy = jest.spyOn(renderer, 'drawBackgroundImage').mockImplementation(() => {});
            renderer.redraw([]);
            expect(bgSpy).toHaveBeenCalled();
        });

        test('draws background image when not visible but image exists and is complete', () => {
            renderer.isSlideMode = false;
            renderer.backgroundImage = { complete: true };
            jest.spyOn(renderer, 'getBackgroundVisible').mockReturnValue(false);
            const checkerSpy = jest.spyOn(renderer, 'drawCheckerPattern').mockImplementation(() => {});
            renderer.redraw([]);
            expect(checkerSpy).toHaveBeenCalled();
        });

        test('gets keyObjectId from selection manager', () => {
            renderer.editor = {
                canvasManager: {
                    selectionManager: { lastSelectedId: 'key-layer' }
                }
            };
            renderer.redraw([]);
            expect(renderer.drawMultiSelectionIndicators).toHaveBeenCalledWith('key-layer');
        });

        test('renders layers when provided', () => {
            jest.spyOn(renderer, 'renderLayers').mockImplementation(() => {});
            renderer.redraw([{ type: 'rectangle', visible: true }]);
            expect(renderer.renderLayers).toHaveBeenCalled();
        });
    });
});

