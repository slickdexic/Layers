// Setup namespace and load NamespaceHelper BEFORE requiring other modules
window.Layers = window.Layers || {};
window.Layers.Utils = window.Layers.Utils || {};
window.Layers.Canvas = window.Layers.Canvas || {};
window.Layers.Selection = window.Layers.Selection || {};
require('../../resources/ext.layers.editor/utils/NamespaceHelper.js');

const CanvasManager = require('../../resources/ext.layers.editor/CanvasManager.js');
const CanvasEvents = require('../../resources/ext.layers.editor/CanvasEvents.js');
const SelectionManager = require('../../resources/ext.layers.editor/SelectionManager.js');
const HitTestController = require('../../resources/ext.layers.editor/canvas/HitTestController.js');
const TransformController = require('../../resources/ext.layers.editor/canvas/TransformController.js');
const GeometryUtils = require('../../resources/ext.layers.editor/GeometryUtils.js');
const TextUtils = require('../../resources/ext.layers.editor/TextUtils.js');

// Mock dependencies
jest.mock('../../resources/ext.layers.editor/CanvasRenderer.js', () => {
    return jest.fn().mockImplementation(() => ({
        drawPolygon: jest.fn(),
        drawStar: jest.fn(),
        destroy: jest.fn(),
        setBackgroundImage: jest.fn(),
        redraw: jest.fn()
    }));
});
jest.mock('../../resources/ext.layers.editor/HistoryManager.js');
jest.mock('../../resources/ext.layers.editor/UIManager.js');

describe('Rotation Handle Interaction', () => {
    let canvasManager;
    let canvasEvents;
    let selectionManager;
    let mockEditor;
    let mockCanvas;
    let mockContext;

    beforeEach(() => {
        // Restore console
        global.console = require('console');

        // Setup controllers on window.Layers namespace for CanvasManager to find
        window.Layers = window.Layers || {};
        window.Layers.Canvas = window.Layers.Canvas || {};
        window.Layers.Utils = window.Layers.Utils || {};
        window.Layers.Canvas.HitTestController = HitTestController;
        window.Layers.Canvas.TransformController = TransformController;
        window.Layers.Utils.Geometry = GeometryUtils;
        window.Layers.Utils.Text = TextUtils;
        
        // Setup DOM
        document.body.innerHTML = '<div id="layers-editor-container"><canvas id="layers-canvas"></canvas></div>';
        mockCanvas = document.getElementById('layers-canvas');
        mockContext = {
            clearRect: jest.fn(),
            save: jest.fn(),
            restore: jest.fn(),
            scale: jest.fn(),
            translate: jest.fn(),
            rotate: jest.fn(),
            drawImage: jest.fn(),
            beginPath: jest.fn(),
            rect: jest.fn(),
            fill: jest.fn(),
            stroke: jest.fn(),
            measureText: jest.fn(() => ({ width: 10 })),
            fillText: jest.fn(),
            setTransform: jest.fn()
        };
        mockCanvas.getContext = jest.fn(() => mockContext);
        mockCanvas.getBoundingClientRect = jest.fn(() => ({
            left: 0, top: 0, width: 800, height: 600
        }));

        // Setup Editor Mock with StateManager
        const mockStateManager = {
            get: jest.fn((key) => {
                if (key === 'selectedLayerIds') return ['layer1'];
                if (key === 'layers') return mockEditor.layers;
                return null;
            }),
            set: jest.fn(),
            subscribe: jest.fn(() => jest.fn())
        };
        
        mockEditor = {
            // container: document.getElementById('layers-editor-container'), // Remove container to trigger back-compat
            canvas: mockCanvas,
            layers: [],
            getLayerById: jest.fn(),
            emit: jest.fn(),
            stateManager: mockStateManager,
            config: {
                maxImageDimensions: { width: 2000, height: 2000 }
            }
        };

        // Initialize Managers
        canvasManager = new CanvasManager(mockEditor);
        selectionManager = new SelectionManager(mockEditor);
        canvasManager.selectionManager = selectionManager;
        
        // Initialize Events
        canvasEvents = new CanvasEvents(canvasManager);
        
        // Mock CanvasManager methods that interact with DOM/Rendering
        canvasManager.renderLayers = jest.fn();
        canvasManager.emitTransforming = jest.fn();
        canvasManager.getMousePoint = jest.fn((e) => ({ x: e.clientX, y: e.clientY }));
        canvasManager.getMousePointFromEvent = jest.fn((e) => ({ x: e.clientX, y: e.clientY }));
        
        // Setup a selected layer
        const layer = {
            id: 'layer1',
            type: 'rectangle',
            x: 100, y: 100, width: 100, height: 100,
            rotation: 0
        };
        mockEditor.layers = [layer];
        mockEditor.getLayerById.mockReturnValue(layer);
        selectionManager.selectedLayerIds = ['layer1'];
    });

    test('should identify rotation handle click and start rotation', () => {
        // Mock hit test to return rotation handle
        // The rotation handle is typically at the top center, slightly offset
        const rotateHandle = {
            type: 'rotate',
            x: 150,
            y: 80, // Above the rect at (100,100)
            cursor: 'grab',
            rect: { x: 145, y: 75, width: 10, height: 10 }
        };

        // Mock SelectionManager.selectionHandles
        selectionManager.selectionHandles = [rotateHandle];

        // Spy on transformController.startRotation (CanvasEvents now calls transformController directly)
        const startRotationSpy = jest.spyOn(canvasManager.transformController, 'startRotation');
        const startResizeSpy = jest.spyOn(canvasManager.transformController, 'startResize');

        // Simulate Mouse Down on the rotation handle
        const event = {
            type: 'mousedown',
            clientX: 150,
            clientY: 80,
            button: 0,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn()
        };

        canvasEvents.handleMouseDown(event);

        // Verification
        expect(startRotationSpy).toHaveBeenCalled();
        expect(startResizeSpy).not.toHaveBeenCalled();
    });

    test('should update cursor to grab when hovering rotation handle', () => {
        const rotateHandle = {
            type: 'rotate',
            cursor: 'grab',
            rect: { x: 145, y: 75, width: 10, height: 10 }
        };
        selectionManager.selectionHandles = [rotateHandle];

        const point = {
            x: 150,
            y: 80
        };

        canvasManager.updateCursor(point);

        expect(mockCanvas.style.cursor).toBe('grab');
    });

    test('handleRotation should update layer rotation', () => {
        // Setup initial state for rotation
        const layer = mockEditor.layers[0];
        
        // Center of layer is (150, 150)
        // Start rotation at (150, 80) -> -90 degrees (top)
        const startPoint = { x: 150, y: 80 };
        canvasManager.startRotation(startPoint);

        // Move to (220, 150) -> 0 degrees (right)
        // Delta should be +90 degrees
        const movePoint = { x: 220, y: 150 };
        
        canvasManager.handleRotation(movePoint, {});

        expect(layer.rotation).toBeCloseTo(90);
        // Note: emitTransforming is called on TransformController, not CanvasManager
    });
});
