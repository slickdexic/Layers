/**
 * @jest-environment jsdom
 */

const ZoomPanController = require('../../resources/ext.layers.editor/canvas/ZoomPanController.js');

// Mock performance.now for animation tests
const originalPerformanceNow = performance.now.bind(performance);
let mockTime = 0;

describe('ZoomPanController', () => {
    let zoomPanController;
    let mockCanvasManager;
    let mockCanvas;
    let mockEditor;

    beforeEach(() => {
        // Reset mock time
        mockTime = 0;

        // Create mock canvas element
        mockCanvas = document.createElement('canvas');
        mockCanvas.width = 800;
        mockCanvas.height = 600;
        mockCanvas.style.transform = '';
        mockCanvas.style.transformOrigin = '';

        // Create mock container
        const mockContainer = document.createElement('div');
        mockContainer.style.width = '1000px';
        mockContainer.style.height = '700px';
        Object.defineProperty(mockContainer, 'clientWidth', { value: 1000 });
        Object.defineProperty(mockContainer, 'clientHeight', { value: 700 });
        mockContainer.appendChild(mockCanvas);

        // Create mock toolbar
        const mockToolbar = {
            updateZoomDisplay: jest.fn()
        };

        // Create mock editor
        mockEditor = {
            layers: [],
            toolbar: mockToolbar,
            updateStatus: jest.fn(),
            updateZoomReadout: jest.fn()
        };

        // Create mock background image
        const mockBackgroundImage = {
            width: 1200,
            height: 900
        };

        // Create mock CanvasManager
        mockCanvasManager = {
            canvas: mockCanvas,
            editor: mockEditor,
            backgroundImage: mockBackgroundImage,
            zoom: 1.0,
            panX: 0,
            panY: 0,
            userHasSetZoom: false,
            getLayerBounds: jest.fn((layer) => {
                if (layer.type === 'rectangle') {
                    return {
                        left: layer.x,
                        top: layer.y,
                        right: layer.x + layer.width,
                        bottom: layer.y + layer.height
                    };
                }
                return null;
            })
        };

        // Create ZoomPanController instance
        zoomPanController = new ZoomPanController(mockCanvasManager);
    });

    afterEach(() => {
        // Restore performance.now
        performance.now = originalPerformanceNow;
    });

    describe('initialization', () => {
        test('should create ZoomPanController with correct properties', () => {
            expect(zoomPanController.manager).toBe(mockCanvasManager);
            expect(zoomPanController.minZoom).toBe(0.1);
            expect(zoomPanController.maxZoom).toBe(5.0);
            expect(zoomPanController.isAnimatingZoom).toBe(false);
            expect(zoomPanController.zoomAnimationDuration).toBe(300);
        });
    });

    describe('getZoom', () => {
        test('should return current zoom level', () => {
            mockCanvasManager.zoom = 1.5;
            expect(zoomPanController.getZoom()).toBe(1.5);
        });
    });

    describe('getPan', () => {
        test('should return current pan offset', () => {
            mockCanvasManager.panX = 100;
            mockCanvasManager.panY = 200;

            const pan = zoomPanController.getPan();

            expect(pan.x).toBe(100);
            expect(pan.y).toBe(200);
        });
    });

    describe('setZoom', () => {
        test('should set zoom level', () => {
            zoomPanController.setZoom(2.0);

            expect(mockCanvasManager.zoom).toBe(2.0);
            expect(mockCanvasManager.userHasSetZoom).toBe(true);
        });

        test('should clamp zoom to minimum', () => {
            zoomPanController.setZoom(0.01);

            expect(mockCanvasManager.zoom).toBe(0.1);
        });

        test('should clamp zoom to maximum', () => {
            zoomPanController.setZoom(10.0);

            expect(mockCanvasManager.zoom).toBe(5.0);
        });

        test('should update canvas transform', () => {
            zoomPanController.setZoom(1.5);

            expect(mockCanvas.style.transform).toContain('scale(1.5)');
        });

        test('should update status with zoom percent', () => {
            zoomPanController.setZoom(1.5);

            expect(mockEditor.updateStatus).toHaveBeenCalledWith({ zoomPercent: 150 });
        });
    });

    describe('setZoomDirect', () => {
        test('should set zoom without triggering userHasSetZoom', () => {
            mockCanvasManager.userHasSetZoom = false;

            zoomPanController.setZoomDirect(1.5);

            expect(mockCanvasManager.zoom).toBe(1.5);
            // setZoomDirect does NOT set userHasSetZoom
        });
    });

    describe('zoomIn', () => {
        test('should increase zoom by 0.2', () => {
            mockCanvasManager.zoom = 1.0;

            // Mock smoothZoomTo to just set zoom directly
            zoomPanController.smoothZoomTo = jest.fn((target) => {
                mockCanvasManager.zoom = target;
            });

            zoomPanController.zoomIn();

            expect(zoomPanController.smoothZoomTo).toHaveBeenCalledWith(1.2);
            expect(mockCanvasManager.userHasSetZoom).toBe(true);
        });
    });

    describe('zoomOut', () => {
        test('should decrease zoom by 0.2', () => {
            mockCanvasManager.zoom = 1.0;

            zoomPanController.smoothZoomTo = jest.fn((target) => {
                mockCanvasManager.zoom = target;
            });

            zoomPanController.zoomOut();

            expect(zoomPanController.smoothZoomTo).toHaveBeenCalledWith(0.8);
            expect(mockCanvasManager.userHasSetZoom).toBe(true);
        });
    });

    describe('resetZoom', () => {
        test('should reset zoom to 1.0', () => {
            mockCanvasManager.zoom = 2.0;
            mockCanvasManager.panX = 100;
            mockCanvasManager.panY = 200;

            zoomPanController.smoothZoomTo = jest.fn();

            zoomPanController.resetZoom();

            expect(mockCanvasManager.panX).toBe(0);
            expect(mockCanvasManager.panY).toBe(0);
            expect(zoomPanController.smoothZoomTo).toHaveBeenCalledWith(1.0);
            expect(mockCanvasManager.userHasSetZoom).toBe(true);
        });

        test('should update toolbar display', () => {
            zoomPanController.smoothZoomTo = jest.fn();

            zoomPanController.resetZoom();

            expect(mockEditor.toolbar.updateZoomDisplay).toHaveBeenCalledWith(100);
        });
    });

    describe('updateCanvasTransform', () => {
        test('should set correct CSS transform', () => {
            mockCanvasManager.zoom = 1.5;
            mockCanvasManager.panX = 50;
            mockCanvasManager.panY = 75;

            zoomPanController.updateCanvasTransform();

            expect(mockCanvas.style.transform).toBe('translate(50px, 75px) scale(1.5)');
            expect(mockCanvas.style.transformOrigin).toBe('0 0');
        });

        test('should update toolbar zoom display', () => {
            mockCanvasManager.zoom = 1.75;

            zoomPanController.updateCanvasTransform();

            expect(mockEditor.toolbar.updateZoomDisplay).toHaveBeenCalledWith(175);
        });
    });

    describe('smoothZoomTo', () => {
        test('should not animate if already at target', () => {
            mockCanvasManager.zoom = 1.0;

            zoomPanController.smoothZoomTo(1.0);

            expect(zoomPanController.isAnimatingZoom).toBe(false);
        });

        test('should not animate if very close to target', () => {
            mockCanvasManager.zoom = 1.005;

            zoomPanController.smoothZoomTo(1.0);

            expect(zoomPanController.isAnimatingZoom).toBe(false);
        });

        test('should start animation for significant zoom change', () => {
            mockCanvasManager.zoom = 1.0;

            // Stop animation immediately for testing
            const originalAnimateZoom = zoomPanController.animateZoom.bind(zoomPanController);
            zoomPanController.animateZoom = jest.fn();

            zoomPanController.smoothZoomTo(2.0);

            expect(zoomPanController.isAnimatingZoom).toBe(true);
            expect(zoomPanController.zoomAnimationTargetZoom).toBe(2.0);
            expect(zoomPanController.zoomAnimationStartZoom).toBe(1.0);
        });

        test('should clamp target zoom to valid range', () => {
            mockCanvasManager.zoom = 1.0;
            zoomPanController.animateZoom = jest.fn();

            zoomPanController.smoothZoomTo(10.0);

            expect(zoomPanController.zoomAnimationTargetZoom).toBe(5.0);
        });
    });

    describe('fitToWindow', () => {
        test('should calculate fit zoom based on container size', () => {
            // Background image is 1200x900
            // Container is 1000x700 with 40px padding = 960x660
            // Scale X = 960/1200 = 0.8
            // Scale Y = 660/900 = 0.733...
            // Target zoom = min(0.8, 0.733) = 0.733

            zoomPanController.smoothZoomTo = jest.fn();

            zoomPanController.fitToWindow();

            expect(mockCanvasManager.panX).toBe(0);
            expect(mockCanvasManager.panY).toBe(0);
            expect(zoomPanController.smoothZoomTo).toHaveBeenCalled();
            // Check the zoom is approximately correct
            const targetZoom = zoomPanController.smoothZoomTo.mock.calls[0][0];
            expect(targetZoom).toBeCloseTo(0.733, 2);
        });

        test('should do nothing if no background image', () => {
            mockCanvasManager.backgroundImage = null;

            zoomPanController.smoothZoomTo = jest.fn();

            zoomPanController.fitToWindow();

            expect(zoomPanController.smoothZoomTo).not.toHaveBeenCalled();
        });
    });

    describe('zoomToFitLayers', () => {
        test('should fall back to fitToWindow when no layers', () => {
            mockEditor.layers = [];

            const originalFitToWindow = zoomPanController.fitToWindow.bind(zoomPanController);
            zoomPanController.fitToWindow = jest.fn();

            zoomPanController.zoomToFitLayers();

            expect(zoomPanController.fitToWindow).toHaveBeenCalled();
        });

        test('should fall back when all layers invisible', () => {
            mockEditor.layers = [
                { id: 'layer1', visible: false, type: 'rectangle', x: 0, y: 0, width: 100, height: 100 }
            ];

            zoomPanController.fitToWindow = jest.fn();

            zoomPanController.zoomToFitLayers();

            expect(zoomPanController.fitToWindow).toHaveBeenCalled();
        });

        test('should calculate zoom to fit visible layers', () => {
            mockEditor.layers = [
                { id: 'layer1', visible: true, type: 'rectangle', x: 100, y: 100, width: 200, height: 150 }
            ];

            zoomPanController.smoothZoomTo = jest.fn();

            zoomPanController.zoomToFitLayers();

            expect(zoomPanController.smoothZoomTo).toHaveBeenCalled();
            expect(mockCanvasManager.userHasSetZoom).toBe(true);
        });
    });

    describe('zoomBy', () => {
        test('should zoom in by delta', () => {
            mockCanvasManager.zoom = 1.0;
            const point = { x: 400, y: 300 };

            zoomPanController.zoomBy(0.5, point);

            expect(mockCanvasManager.zoom).toBe(1.5);
            expect(mockCanvasManager.userHasSetZoom).toBe(true);
        });

        test('should zoom out by negative delta', () => {
            mockCanvasManager.zoom = 1.0;
            const point = { x: 400, y: 300 };

            zoomPanController.zoomBy(-0.3, point);

            expect(mockCanvasManager.zoom).toBe(0.7);
        });

        test('should anchor zoom around point', () => {
            mockCanvasManager.zoom = 1.0;
            mockCanvasManager.panX = 0;
            mockCanvasManager.panY = 0;
            const point = { x: 400, y: 300 };

            zoomPanController.zoomBy(1.0, point); // zoom from 1.0 to 2.0

            // The point should stay in the same screen position
            // screenX = panX + zoom * point.x
            // Before: 0 + 1.0 * 400 = 400
            // After: panX + 2.0 * 400 = 400
            // So panX = 400 - 800 = -400
            expect(mockCanvasManager.panX).toBe(-400);
            expect(mockCanvasManager.panY).toBe(-300);
        });

        test('should not zoom if already at limit', () => {
            mockCanvasManager.zoom = 5.0;
            const originalPanX = mockCanvasManager.panX;
            const point = { x: 400, y: 300 };

            zoomPanController.zoomBy(1.0, point); // Try to exceed max

            expect(mockCanvasManager.zoom).toBe(5.0);
            expect(mockCanvasManager.panX).toBe(originalPanX); // Should not change
        });

        test('should clamp zoom to minimum', () => {
            mockCanvasManager.zoom = 0.2;
            const point = { x: 400, y: 300 };

            zoomPanController.zoomBy(-0.5, point);

            expect(mockCanvasManager.zoom).toBe(0.1);
        });
    });

    describe('setPan', () => {
        test('should set pan position', () => {
            zoomPanController.setPan(100, 200);

            expect(mockCanvasManager.panX).toBe(100);
            expect(mockCanvasManager.panY).toBe(200);
        });

        test('should update canvas transform', () => {
            zoomPanController.setPan(50, 75);

            expect(mockCanvas.style.transform).toContain('translate(50px, 75px)');
        });
    });

    describe('panBy', () => {
        test('should pan by delta', () => {
            mockCanvasManager.panX = 100;
            mockCanvasManager.panY = 200;

            zoomPanController.panBy(50, -30);

            expect(mockCanvasManager.panX).toBe(150);
            expect(mockCanvasManager.panY).toBe(170);
        });
    });

    describe('animateZoom', () => {
        test('should not animate when isAnimatingZoom is false', () => {
            zoomPanController.isAnimatingZoom = false;
            zoomPanController.setZoomDirect = jest.fn();

            zoomPanController.animateZoom();

            expect(zoomPanController.setZoomDirect).not.toHaveBeenCalled();
        });

        test('should complete animation when progress reaches 1', () => {
            mockCanvasManager.zoom = 1.0;

            // Set up animation state
            zoomPanController.isAnimatingZoom = true;
            zoomPanController.zoomAnimationStartTime = 0;
            zoomPanController.zoomAnimationStartZoom = 1.0;
            zoomPanController.zoomAnimationTargetZoom = 2.0;
            zoomPanController.zoomAnimationDuration = 300;

            // Mock performance.now to return time past animation duration
            performance.now = jest.fn().mockReturnValue(500);

            zoomPanController.animateZoom();

            expect(zoomPanController.isAnimatingZoom).toBe(false);
            expect(mockCanvasManager.zoom).toBe(2.0);
        });

        test('should use easing function during animation', () => {
            mockCanvasManager.zoom = 1.0;

            // Set up animation state
            zoomPanController.isAnimatingZoom = true;
            zoomPanController.zoomAnimationStartTime = 0;
            zoomPanController.zoomAnimationStartZoom = 1.0;
            zoomPanController.zoomAnimationTargetZoom = 2.0;
            zoomPanController.zoomAnimationDuration = 300;

            // Mock performance.now to return 50% through animation
            performance.now = jest.fn().mockReturnValue(150);

            // Mock requestAnimationFrame
            global.requestAnimationFrame = jest.fn();

            zoomPanController.animateZoom();

            // With ease-out cubic, 50% progress should result in more than 50% of zoom change
            // easedProgress = 1 - (1 - 0.5)^3 = 1 - 0.125 = 0.875
            // currentZoom = 1.0 + (2.0 - 1.0) * 0.875 = 1.875
            expect(mockCanvasManager.zoom).toBeCloseTo(1.875, 2);
            expect(global.requestAnimationFrame).toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        test('should handle missing toolbar gracefully', () => {
            mockEditor.toolbar = null;

            // Should not throw
            expect(() => zoomPanController.updateCanvasTransform()).not.toThrow();
        });

        test('should handle missing updateStatus function', () => {
            mockEditor.updateStatus = undefined;

            // Should not throw
            expect(() => zoomPanController.setZoom(1.5)).not.toThrow();
        });

        test('should handle missing updateZoomReadout function', () => {
            mockEditor.updateZoomReadout = undefined;

            // Should not throw
            expect(() => zoomPanController.updateCanvasTransform()).not.toThrow();
        });

        test('should handle missing updateZoomReadout in resetZoom', () => {
            mockEditor.updateZoomReadout = undefined;
            mockEditor.updateStatus = undefined;

            // Set zoom to something other than 1
            mockCanvasManager.zoom = 1.5;

            // resetZoom should not throw when these functions are missing
            expect(() => zoomPanController.resetZoom()).not.toThrow();
        });
    });

    describe('destroy', () => {
        test('should cancel pending animation frame if present', () => {
            const mockCancelAnimationFrame = jest.spyOn(global, 'cancelAnimationFrame');

            // Set up a pending animation frame
            zoomPanController.animationFrameId = 123;

            zoomPanController.destroy();

            expect(mockCancelAnimationFrame).toHaveBeenCalledWith(123);
            expect(zoomPanController.animationFrameId).toBeNull();
            expect(zoomPanController.manager).toBeNull();
            expect(zoomPanController.isPanning).toBe(false);

            mockCancelAnimationFrame.mockRestore();
        });

        test('should not call cancelAnimationFrame if no pending frame', () => {
            const mockCancelAnimationFrame = jest.spyOn(global, 'cancelAnimationFrame');

            // No pending animation frame
            zoomPanController.animationFrameId = null;

            zoomPanController.destroy();

            expect(mockCancelAnimationFrame).not.toHaveBeenCalled();
            expect(zoomPanController.manager).toBeNull();

            mockCancelAnimationFrame.mockRestore();
        });
    });
});
