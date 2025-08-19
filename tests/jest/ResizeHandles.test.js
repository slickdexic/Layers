/**
 * @jest-environment jsdom
 */

const CanvasManager = require('../../resources/ext.layers.editor/CanvasManager.js');

describe('Resize Handles', () => {
    let canvasManager;
    let mockEditor;
    let canvas;

    beforeEach(() => {
        // Create a canvas element
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);

        // Create mock editor
        mockEditor = {
            canvas: canvas,
            layers: [],
            selectedLayerIds: [],
            currentTool: 'pointer',
            getLayerById: jest.fn(),
            redraw: jest.fn(),
            saveState: jest.fn()
        };

        // Create CanvasManager instance
        canvasManager = new CanvasManager(mockEditor);
        canvasManager.canvas = canvas;
        canvasManager.ctx = canvas.getContext('2d');
    });

    afterEach(() => {
        document.body.removeChild(canvas);
    });

    describe('handle hit testing', () => {
        test('should detect handle hits in world coordinates', () => {
            // Create a test layer
            const layer = {
                id: 'test-layer',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                rotation: 0
            };

            mockEditor.getLayerById.mockReturnValue(layer);
            canvasManager.selectedLayerId = 'test-layer';

            // Mock getLayerBounds to return the expected bounds
            canvasManager.getLayerBounds = jest.fn().mockReturnValue({
                x: 100,
                y: 100,
                width: 200,
                height: 150
            });

            // Draw selection handles (this sets up this.selectionHandles)
            const bounds = { x: -100, y: -75, width: 200, height: 150 }; // Transformed bounds for drawing
            canvasManager.drawSelectionHandles(bounds, layer);

            // Test hit detection on northwest handle
            // Handle should be at (100, 100) in world coordinates
            const handleHit = canvasManager.hitTestSelectionHandles({ x: 100, y: 100 });

            expect(handleHit).toBeTruthy();
            expect(handleHit.type).toBe('nw');
        });

        test('should detect handle hits with rotation', () => {
            // Create a rotated test layer
            const layer = {
                id: 'test-layer',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                rotation: 45 // 45 degree rotation
            };

            mockEditor.getLayerById.mockReturnValue(layer);
            canvasManager.selectedLayerId = 'test-layer';

            // Mock getLayerBounds to return the expected bounds
            canvasManager.getLayerBounds = jest.fn().mockReturnValue({
                x: 100,
                y: 100,
                width: 200,
                height: 150
            });

            // Draw selection handles
            const bounds = { x: -100, y: -75, width: 200, height: 150 }; // Transformed bounds for drawing
            canvasManager.drawSelectionHandles(bounds, layer);

            // For a 45-degree rotation, the northwest corner should be at a different position
            // We're testing that the handles are properly calculated in world coordinates
            const centerX = 100 + 200 / 2; // 200
            const centerY = 100 + 150 / 2; // 175

            // Calculate where the NW corner would be after 45-degree rotation
            const rotRad = 45 * Math.PI / 180;
            const cos = Math.cos(rotRad);
            const sin = Math.sin(rotRad);

            // Original NW corner relative to center
            const relX = 100 - centerX; // -100
            const relY = 100 - centerY; // -75

            // Rotated position
            const rotatedX = centerX + relX * cos - relY * sin;
            const rotatedY = centerY + relX * sin + relY * cos;

            // Test hit detection near the rotated handle position
            const handleHit = canvasManager.hitTestSelectionHandles({
                x: Math.round(rotatedX),
                y: Math.round(rotatedY)
            });

            expect(handleHit).toBeTruthy();
            expect(handleHit.type).toBe('nw');
        });

        test('should not detect hits outside handle areas', () => {
            // Create a test layer
            const layer = {
                id: 'test-layer',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                rotation: 0
            };

            mockEditor.getLayerById.mockReturnValue(layer);
            canvasManager.selectedLayerId = 'test-layer';

            // Mock getLayerBounds
            canvasManager.getLayerBounds = jest.fn().mockReturnValue({
                x: 100,
                y: 100,
                width: 200,
                height: 150
            });

            // Draw selection handles
            const bounds = { x: -100, y: -75, width: 200, height: 150 };
            canvasManager.drawSelectionHandles(bounds, layer);

            // Test hit detection at a point far from any handles
            const handleHit = canvasManager.hitTestSelectionHandles({ x: 500, y: 500 });

            expect(handleHit).toBeNull();
        });

        test('should start resize when handle is clicked', () => {
            // Create a test layer
            const layer = {
                id: 'test-layer',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                rotation: 0
            };

            mockEditor.getLayerById.mockReturnValue(layer);
            canvasManager.selectedLayerId = 'test-layer';
            canvasManager.currentTool = 'pointer';

            // Mock getLayerBounds
            canvasManager.getLayerBounds = jest.fn().mockReturnValue({
                x: 100,
                y: 100,
                width: 200,
                height: 150
            });

            // Mock getMousePoint to return handle coordinates
            canvasManager.getMousePoint = jest.fn().mockReturnValue({ x: 100, y: 100 });

            // Draw selection handles
            const bounds = { x: -100, y: -75, width: 200, height: 150 };
            canvasManager.drawSelectionHandles(bounds, layer);

            // Simulate mouse down on handle
            const mockEvent = { button: 0, clientX: 100, clientY: 100 };
            canvasManager.handleMouseDown(mockEvent);

            // Should have started resize
            expect(canvasManager.isResizing).toBe(true);
            expect(canvasManager.resizeHandle).toBeTruthy();
            expect(canvasManager.resizeHandle.type).toBe('nw');
        });
    });
});
