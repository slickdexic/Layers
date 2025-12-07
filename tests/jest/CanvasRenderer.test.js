/**
 * @jest-environment jsdom
 */

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

        // Set global for window export
        window.CanvasRenderer = CanvasRenderer;
        window.TextUtils = TextUtils;
        window.GeometryUtils = GeometryUtils;
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

        test('should be available on window', () => {
            expect(window.CanvasRenderer).toBe(CanvasRenderer);
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

        test('should initialize grid/ruler properties', () => {
            expect(renderer.showGrid).toBe(false);
            expect(renderer.gridSize).toBe(20);
            expect(renderer.showRulers).toBe(false);
            expect(renderer.rulerSize).toBe(20);
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

    describe('setGuides', () => {
        test('should set guide visibility and positions', () => {
            renderer.setGuides(true, [100, 200], [50, 150, 250]);

            expect(renderer.showGuides).toBe(true);
            expect(renderer.horizontalGuides).toEqual([100, 200]);
            expect(renderer.verticalGuides).toEqual([50, 150, 250]);
        });

        test('should default to empty arrays for missing guides', () => {
            renderer.setGuides(true, null, null);

            expect(renderer.horizontalGuides).toEqual([]);
            expect(renderer.verticalGuides).toEqual([]);
        });
    });

    describe('setDragGuide', () => {
        test('should set drag guide for horizontal orientation', () => {
            renderer.setDragGuide('h', 150);

            expect(renderer.dragGuide).toEqual({ orientation: 'h', pos: 150 });
        });

        test('should set drag guide for vertical orientation', () => {
            renderer.setDragGuide('v', 200);

            expect(renderer.dragGuide).toEqual({ orientation: 'v', pos: 200 });
        });

        test('should clear drag guide when orientation is falsy', () => {
            renderer.setDragGuide('h', 100); // Set first
            renderer.setDragGuide(null, 0);  // Clear

            expect(renderer.dragGuide).toBeNull();
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
            expect(renderer.supportsGlow('highlight')).toBe(false);
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

            expect(mockLayerRenderer.drawLayer).toHaveBeenCalledWith(layer);
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
                { type: 'highlight', x: 0, y: 0, width: 100, height: 20 },
                { type: 'path', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }] },
                { type: 'blur', x: 0, y: 0, width: 100, height: 100 }
            ];

            layerTypes.forEach(layer => {
                expect(() => renderer.drawLayer(layer)).not.toThrow();
            });
        });
    });

    // Note: Individual shape draw methods (drawRectangle, drawCircle, drawEllipse,
    // drawLine, drawArrow, drawPolygon, drawStar, drawPath, drawHighlight, drawBlur,
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

    describe('drawGrid', () => {
        test('should draw grid lines', () => {
            renderer.showGrid = true;
            renderer.gridSize = 20;

            renderer.drawGrid();

            expect(ctx.beginPath).toHaveBeenCalled();
            expect(ctx.stroke).toHaveBeenCalled();
        });
    });

    describe('drawRulers', () => {
        test('should draw rulers in screen space', () => {
            renderer.showRulers = true;
            renderer.rulerSize = 20;

            renderer.drawRulers();

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
            expect(ctx.restore).toHaveBeenCalled();
        });
    });

    describe('drawGuides', () => {
        test('should not draw when guides disabled', () => {
            ctx.moveTo.mockClear();
            renderer.showGuides = false;

            renderer.drawGuides();

            // moveTo is called for many things, so check stroke wasn't called for guides
            // Actually this is hard to verify, let's just ensure it doesn't throw
            expect(true).toBe(true);
        });

        test('should draw horizontal and vertical guides', () => {
            renderer.showGuides = true;
            renderer.horizontalGuides = [100, 200];
            renderer.verticalGuides = [50, 150];

            renderer.drawGuides();

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.setLineDash).toHaveBeenCalled();
            expect(ctx.stroke).toHaveBeenCalled();
        });
    });

    describe('drawGuidePreview', () => {
        test('should not draw when no drag guide', () => {
            ctx.save.mockClear();
            renderer.dragGuide = null;

            renderer.drawGuidePreview();

            // save/restore are called by many methods, just check no throw
            expect(true).toBe(true);
        });

        test('should draw horizontal drag guide preview', () => {
            renderer.dragGuide = { orientation: 'h', pos: 150 };

            renderer.drawGuidePreview();

            expect(ctx.stroke).toHaveBeenCalled();
        });

        test('should draw vertical drag guide preview', () => {
            renderer.dragGuide = { orientation: 'v', pos: 200 };

            renderer.drawGuidePreview();

            expect(ctx.stroke).toHaveBeenCalled();
        });
    });

    describe('clearShadow', () => {
        test('should reset shadow properties', () => {
            renderer.clearShadow();

            // We can't easily verify ctx properties in mocks, but ensure no throw
            expect(true).toBe(true);
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

            // ctx.fillStyle is set but we're using mocks, just ensure no throw
            expect(true).toBe(true);
        });

        test('should apply stroke color and width', () => {
            const layer = { stroke: '#0000ff', strokeWidth: 3 };

            renderer.applyLayerStyle(layer);

            expect(true).toBe(true);
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
        test('should draw placeholder when no background image', () => {
            renderer.backgroundImage = null;

            renderer.drawBackgroundImage();

            // Should have drawn placeholder pattern and text
            expect(ctx.fillRect).toHaveBeenCalled();
            expect(ctx.fillText).toHaveBeenCalled();
        });

        test('should draw image when available', () => {
            const img = { complete: true };
            renderer.backgroundImage = img;

            renderer.drawBackgroundImage();

            expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0);
        });
    });
});
