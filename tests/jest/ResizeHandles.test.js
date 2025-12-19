/**
 * @jest-environment jsdom
 */

// Setup namespace before loading modules
window.Layers = window.Layers || {};
window.Layers.Utils = window.Layers.Utils || {};
window.Layers.Canvas = window.Layers.Canvas || {};
window.Layers.Core = window.Layers.Core || {};

// Load SelectionRenderer for CanvasRenderer delegation
require('../../resources/ext.layers.editor/canvas/SelectionRenderer.js');

const CanvasManager = require('../../resources/ext.layers.editor/CanvasManager.js');
const CanvasEvents = require('../../resources/ext.layers.editor/CanvasEvents.js');
const CanvasRenderer = require('../../resources/ext.layers.editor/CanvasRenderer.js');
const SelectionManager = require('../../resources/ext.layers.editor/SelectionManager.js');
const HitTestController = require('../../resources/ext.layers.editor/canvas/HitTestController.js');
const TransformController = require('../../resources/ext.layers.editor/canvas/TransformController.js');

describe('Resize Handles', () => {
    let canvasManager;
    let mockEditor;
    let canvas;
    let selectionManager;

    beforeEach(() => {
        // Setup global namespaced exports for CanvasManager to find
        window.Layers = window.Layers || {};
        window.Layers.Canvas = window.Layers.Canvas || {};
        window.Layers.Core = window.Layers.Core || {};
        window.Layers.Canvas.Events = CanvasEvents;
        window.Layers.Canvas.Renderer = CanvasRenderer;
        window.Layers.Canvas.HitTestController = HitTestController;
        window.Layers.Canvas.TransformController = TransformController;
        window.Layers.Core.SelectionManager = SelectionManager;

        // Create a canvas element
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);

        // Mock setLineDash if missing (JSDOM/canvas issue)
        const ctx = canvas.getContext('2d');
        if (!ctx.setLineDash) {
            ctx.setLineDash = jest.fn();
        }

        // Create mock editor with StateManager
        const mockStateManager = {
            get: jest.fn((key) => {
                if (key === 'selectedLayerIds') return mockEditor.selectedLayerIds || [];
                if (key === 'layers') return mockEditor.layers;
                return null;
            }),
            set: jest.fn((key, value) => {
                if (key === 'selectedLayerIds') {
                    mockEditor.selectedLayerIds = value;
                }
            }),
            subscribe: jest.fn(() => jest.fn())
        };

        mockEditor = {
            canvas: canvas,
            layers: [],
            selectedLayerIds: [],
            currentTool: 'pointer',
            getLayerById: jest.fn(),
            redraw: jest.fn(),
            saveState: jest.fn(),
            selectLayer: jest.fn(),
            stateManager: mockStateManager
        };

        // Create CanvasManager instance
        canvasManager = new CanvasManager(mockEditor);
        canvasManager.canvas = canvas;
        canvasManager.ctx = canvas.getContext('2d');
        
        // Initialize SelectionManager
        selectionManager = new SelectionManager(mockEditor, canvasManager);
        canvasManager.selectionManager = selectionManager;

        // Patch renderer context if needed
        if (canvasManager.renderer && canvasManager.renderer.ctx && !canvasManager.renderer.ctx.setLineDash) {
            canvasManager.renderer.ctx.setLineDash = jest.fn();
        }
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
            // Set selection via stateManager mock
            mockEditor.selectedLayerIds = ['test-layer'];
            mockEditor.stateManager.get.mockImplementation((key) => {
                if (key === 'selectedLayerIds') return ['test-layer'];
                if (key === 'layers') return mockEditor.layers;
                return null;
            });

            // Mock getLayerBounds to return the expected bounds
            canvasManager.getLayerBounds = jest.fn().mockReturnValue({
                x: 100,
                y: 100,
                width: 200,
                height: 150
            });

            // Draw selection handles (this sets up this.selectionHandles)
            const bounds = { x: 100, y: 100, width: 200, height: 150 }; // World bounds
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
            // Set selection via stateManager mock
            mockEditor.selectedLayerIds = ['test-layer'];
            mockEditor.stateManager.get.mockImplementation((key) => {
                if (key === 'selectedLayerIds') return ['test-layer'];
                if (key === 'layers') return mockEditor.layers;
                return null;
            });

            // World bounds (actual layer position)
            const worldBounds = {
                x: 100,
                y: 100,
                width: 200,
                height: 150
            };

            // Mock getLayerBounds to return the expected bounds
            canvasManager.getLayerBounds = jest.fn().mockReturnValue(worldBounds);

            // Draw selection handles
            const bounds = { x: -100, y: -75, width: 200, height: 150 }; // Local bounds for rotated layer
            // Call renderer directly to pass isRotated=true with worldBounds
            canvasManager.renderer.drawSelectionHandles(bounds, layer, true, worldBounds);

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
            // Set selection via stateManager mock
            mockEditor.selectedLayerIds = ['test-layer'];
            mockEditor.stateManager.get.mockImplementation((key) => {
                if (key === 'selectedLayerIds') return ['test-layer'];
                if (key === 'layers') return mockEditor.layers;
                return null;
            });

            // Mock getLayerBounds
            canvasManager.getLayerBounds = jest.fn().mockReturnValue({
                x: 100,
                y: 100,
                width: 200,
                height: 150
            });

            // Draw selection handles
            const bounds = { x: 100, y: 100, width: 200, height: 150 };
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
            mockEditor.layers = [layer];
            // Set selection via stateManager mock
            mockEditor.selectedLayerIds = ['test-layer'];
            mockEditor.stateManager.get.mockImplementation((key) => {
                if (key === 'selectedLayerIds') return ['test-layer'];
                if (key === 'layers') return mockEditor.layers;
                return null;
            });
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
            const bounds = { x: 100, y: 100, width: 200, height: 150 };
            canvasManager.drawSelectionHandles(bounds, layer);

            // Sync SelectionManager handles (since CanvasEvents now uses SelectionManager)
            selectionManager.selectedLayerIds = ['test-layer'];
            // Mock getLayerBoundsCompat for SelectionManager
            selectionManager.getLayerBoundsCompat = jest.fn().mockReturnValue(bounds);
            selectionManager.updateSelectionHandles();

            // Simulate mouse down on handle
            const mockEvent = { button: 0, clientX: 100, clientY: 100 };
            canvasManager.events.handleMouseDown(mockEvent);

            // Should have started resize (state is now on transformController)
            expect(canvasManager.transformController.isResizing).toBe(true);
            expect(canvasManager.transformController.resizeHandle).toBeTruthy();
            expect(canvasManager.transformController.resizeHandle.type).toBe('nw');
        });
    });
});
