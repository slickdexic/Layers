/**
 * @jest-environment jsdom
 */

const EventHandler = require('../../resources/ext.layers.editor/EventHandler.js');

describe('EventHandler', () => {
    let eventHandler;
    let mockCanvasManager;
    let mockCanvas;

    beforeEach(() => {
        // Create mock canvas
        mockCanvas = document.createElement('canvas');
        mockCanvas.width = 800;
        mockCanvas.height = 600;

        // Create mock CanvasManager
        mockCanvasManager = {
            canvas: mockCanvas,
            layers: [],
            selectedLayerIds: [],
            currentTool: 'pointer',
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            startDrawing: jest.fn(),
            updateDrawing: jest.fn(),
            finishDrawing: jest.fn(),
            handlePointerDown: jest.fn(),
            handlePointerMove: jest.fn(),
            handlePointerUp: jest.fn(),
            selectLayer: jest.fn(),
            deleteSelectedLayers: jest.fn(),
            undo: jest.fn(),
            redo: jest.fn(),
            isModified: false
        };

        // Create EventHandler instance
        eventHandler = new EventHandler(mockCanvasManager);
    });

    afterEach(() => {
        eventHandler.destroy();
    });

    describe('initialization', () => {
        test('should create EventHandler with correct properties', () => {
            expect(eventHandler.canvasManager).toBe(mockCanvasManager);
            expect(eventHandler.canvas).toBe(mockCanvas);
            expect(eventHandler.isMouseDown).toBe(false);
            expect(eventHandler.lastTouchTime).toBe(0);
        });

        test('should setup event listeners on canvas', () => {
            const addEventListenerSpy = jest.spyOn(mockCanvas, 'addEventListener');

            const newEventHandler = new EventHandler(mockCanvasManager);

            expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

            newEventHandler.destroy();
        });
    });

    describe('mouse events', () => {
        test('should handle mouse down event', () => {
            const mockEvent = {
                preventDefault: jest.fn(),
                offsetX: 100,
                offsetY: 150,
                button: 0
            };

            eventHandler.handleMouseDown(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(eventHandler.isMouseDown).toBe(true);
            expect(mockCanvasManager.handlePointerDown).toHaveBeenCalledWith(100, 150);
        });

        test('should ignore non-left mouse button', () => {
            const mockEvent = {
                preventDefault: jest.fn(),
                offsetX: 100,
                offsetY: 150,
                button: 1 // Right click
            };

            eventHandler.handleMouseDown(mockEvent);

            expect(eventHandler.isMouseDown).toBe(false);
            expect(mockCanvasManager.handlePointerDown).not.toHaveBeenCalled();
        });

        test('should handle mouse move when mouse is down', () => {
            eventHandler.isMouseDown = true;

            const mockEvent = {
                preventDefault: jest.fn(),
                offsetX: 120,
                offsetY: 180
            };

            eventHandler.handleMouseMove(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockCanvasManager.handlePointerMove).toHaveBeenCalledWith(120, 180);
        });

        test('should not handle mouse move when mouse is not down', () => {
            eventHandler.isMouseDown = false;

            const mockEvent = {
                preventDefault: jest.fn(),
                offsetX: 120,
                offsetY: 180
            };

            eventHandler.handleMouseMove(mockEvent);

            expect(mockCanvasManager.handlePointerMove).not.toHaveBeenCalled();
        });

        test('should handle mouse up event', () => {
            eventHandler.isMouseDown = true;

            const mockEvent = {
                preventDefault: jest.fn(),
                offsetX: 140,
                offsetY: 200
            };

            eventHandler.handleMouseUp(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(eventHandler.isMouseDown).toBe(false);
            expect(mockCanvasManager.handlePointerUp).toHaveBeenCalledWith(140, 200);
        });
    });

    describe('touch events', () => {
        test('should handle single touch start', () => {
            const mockEvent = {
                preventDefault: jest.fn(),
                touches: [{
                    clientX: 250,
                    clientY: 300
                }]
            };

            // Mock getBoundingClientRect
            mockCanvas.getBoundingClientRect = jest.fn().mockReturnValue({
                left: 50,
                top: 100
            });

            eventHandler.handleTouchStart(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockCanvasManager.handlePointerDown).toHaveBeenCalledWith(200, 200);
        });

        test('should handle touch move', () => {
            const mockEvent = {
                preventDefault: jest.fn(),
                touches: [{
                    clientX: 270,
                    clientY: 320
                }]
            };

            mockCanvas.getBoundingClientRect = jest.fn().mockReturnValue({
                left: 50,
                top: 100
            });

            eventHandler.handleTouchMove(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockCanvasManager.handlePointerMove).toHaveBeenCalledWith(220, 220);
        });

        test('should handle touch end', () => {
            const mockEvent = {
                preventDefault: jest.fn(),
                changedTouches: [{
                    clientX: 290,
                    clientY: 340
                }]
            };

            mockCanvas.getBoundingClientRect = jest.fn().mockReturnValue({
                left: 50,
                top: 100
            });

            eventHandler.handleTouchEnd(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockCanvasManager.handlePointerUp).toHaveBeenCalledWith(240, 240);
        });
    });

    describe('keyboard events', () => {
        test('should handle delete key', () => {
            const mockEvent = {
                key: 'Delete',
                preventDefault: jest.fn()
            };

            eventHandler.handleKeyDown(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockCanvasManager.deleteSelectedLayers).toHaveBeenCalled();
        });

        test('should handle Ctrl+Z (undo)', () => {
            const mockEvent = {
                key: 'z',
                ctrlKey: true,
                shiftKey: false,
                preventDefault: jest.fn()
            };

            eventHandler.handleKeyDown(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockCanvasManager.undo).toHaveBeenCalled();
        });

        test('should handle Ctrl+Shift+Z (redo)', () => {
            const mockEvent = {
                key: 'z',
                ctrlKey: true,
                shiftKey: true,
                preventDefault: jest.fn()
            };

            eventHandler.handleKeyDown(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockCanvasManager.redo).toHaveBeenCalled();
        });

        test('should handle Ctrl+Y (redo)', () => {
            const mockEvent = {
                key: 'y',
                ctrlKey: true,
                preventDefault: jest.fn()
            };

            eventHandler.handleKeyDown(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockCanvasManager.redo).toHaveBeenCalled();
        });
    });

    describe('destruction', () => {
        test('should remove event listeners when destroyed', () => {
            const removeEventListenerSpy = jest.spyOn(mockCanvas, 'removeEventListener');

            eventHandler.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
        });
    });
});
