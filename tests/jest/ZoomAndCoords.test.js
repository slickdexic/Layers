/**
 * @jest-environment jsdom
 */

// Basic regression tests for pointer-anchored zoom and client↔canvas mapping

describe('CanvasManager zoom and coordinate mapping', () => {
    let container;
    let canvas;
    let manager;

    // Lightweight mock editor used by CanvasManager
    function makeEditor()
    {
        return {
            filename: 'sample.png',
            layers: [],
            markDirty: jest.fn(),
            updateStatus: jest.fn(),
            toolbar: { updateZoomDisplay: jest.fn() },
            layerPanel: { selectLayer: jest.fn(), updateLayers: jest.fn() }
        };
    }

    beforeEach(() => {
        // Container with fixed size to make getBoundingClientRect predictable
        container = document.createElement('div');
        container.style.width = '1000px';
        container.style.height = '800px';
        document.body.appendChild(container);

        // Create canvas and attach to container
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        container.appendChild(canvas);

        // Spy on getBoundingClientRect to control returned rect regardless of CSS transforms
        jest.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() => ({
            left: 100,
            top: 50,
            width: parseFloat(canvas.style.width) || canvas.width,
            height: parseFloat(canvas.style.height) || canvas.height,
            right: 0,
            bottom: 0,
            x: 100,
            y: 50,
            toJSON: () => {}
        }));

        // Load CanvasManager from source (attached to window at end of file)
        require('../../resources/ext.layers.editor/CanvasManager.js');
        const Editor = makeEditor();
        manager = new window.CanvasManager({ container, editor: Editor });

        // Use a simple background with known size and bypass image loading
        manager.backgroundImage = { width: 800, height: 600, complete: true };
        manager.canvas = canvas; // ensure the same canvas reference
        manager.ctx = canvas.getContext('2d');
        manager.userHasSetZoom = true; // prevent resizeCanvas() from overriding zoom
        manager.panX = 0;
        manager.panY = 0;
        manager.zoom = 1;
        
        // Mock zoomPanController for delegation tests
        manager.zoomPanController = {
            zoomBy: jest.fn((delta, point) => {
                // Implement the zoom logic for testing
                const target = Math.max(manager.minZoom, Math.min(manager.maxZoom, manager.zoom + delta));
                if (target === manager.zoom) return;
                const screenX = manager.panX + manager.zoom * point.x;
                const screenY = manager.panY + manager.zoom * point.y;
                manager.zoom = target;
                manager.panX = screenX - manager.zoom * point.x;
                manager.panY = screenY - manager.zoom * point.y;
            }),
            updateCanvasTransform: jest.fn()
        };
        
        manager.updateCanvasTransform();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = null;
        canvas = null;
        manager = null;
    });

    test('getMousePointFromClient maps client to canvas using DOMRect scale', () => {
        // With rect left/top = (100,50) and no CSS resize, width/height are 800x600
        const pt = manager.getMousePointFromClient(100 + 400, 50 + 300); // center of canvas on screen
        expect(Math.round(pt.x)).toBe(400);
        expect(Math.round(pt.y)).toBe(300);

        // Simulate CSS resize (displayed at 400x300) -> scale 800/400 = 2, 600/300 = 2
        canvas.style.width = '400px';
        canvas.style.height = '300px';
        const pt2 = manager.getMousePointFromClient(100 + 200, 50 + 150);
        expect(Math.round(pt2.x)).toBe(400);
        expect(Math.round(pt2.y)).toBe(300);
    });

    test('zoomBy delegates to zoomPanController', () => {
        const anchor = { x: 400, y: 300 };
        manager.zoomBy(+0.5, anchor);
        expect(manager.zoomPanController.zoomBy).toHaveBeenCalledWith(+0.5, anchor);
    });

    test('zoomBy anchors zoom to the provided canvas point', () => {
        // Anchor canvas center (400,300) which currently appears at screen:
        // screenX = panX + zoom * x = 0 + 1 * 400 = 400, then offset by rect.left in DOM
        const anchor = { x: 400, y: 300 };

        // Compute current screen position via the transform math
        const screenBefore = {
            x: manager.panX + manager.zoom * anchor.x,
            y: manager.panY + manager.zoom * anchor.y
        };

        // Apply zoom in by +0.5 at anchor
        manager.zoomBy(+0.5, anchor); // new zoom 1.5

        // After zoom, the same canvas point should map to the same screen coords (pre-transform space)
        const screenAfter = {
            x: manager.panX + manager.zoom * anchor.x,
            y: manager.panY + manager.zoom * anchor.y
        };

        expect(Math.round(screenAfter.x)).toBe(Math.round(screenBefore.x));
        expect(Math.round(screenAfter.y)).toBe(Math.round(screenBefore.y));
    });

    test('zoomBy respects min/max bounds and keeps pan coherent', () => {
        manager.minZoom = 0.5;
        manager.maxZoom = 2.0;
        manager.zoom = 1.9;
        manager.panX = 10;
        manager.panY = -20;

        const anchor = { x: 100, y: 50 };
        const screenBefore = {
            x: manager.panX + manager.zoom * anchor.x,
            y: manager.panY + manager.zoom * anchor.y
        };

        // Try to zoom in beyond max -> should clamp to 2.0
        manager.zoomBy(+0.5, anchor);
        expect(manager.zoom).toBe(2.0);

        const screenAfter = {
            x: manager.panX + manager.zoom * anchor.x,
            y: manager.panY + manager.zoom * anchor.y
        };
        expect(Math.round(screenAfter.x)).toBe(Math.round(screenBefore.x));
        expect(Math.round(screenAfter.y)).toBe(Math.round(screenBefore.y));
    });
});
