/**
 * Tests for CanvasEvents
 *
 * CanvasEvents handles all DOM event binding and processing for the canvas editor.
 */

const CanvasEvents = require( '../../resources/ext.layers.editor/CanvasEvents.js' );

describe( 'CanvasEvents', () => {
	let canvasEvents;
	let mockCanvas;
	let mockCanvasManager;
	let addedListeners;
	let removedListeners;

	beforeEach( () => {
		// Track addEventListener/removeEventListener calls
		addedListeners = [];
		removedListeners = [];

		mockCanvas = {
			addEventListener: jest.fn( ( type, handler, options ) => {
				addedListeners.push( { type, handler, options } );
			} ),
			removeEventListener: jest.fn( ( type, handler ) => {
				removedListeners.push( { type, handler } );
			} ),
			style: { cursor: 'default' },
			getBoundingClientRect: jest.fn( () => ( {
				left: 0, top: 0, width: 800, height: 600
			} ) )
		};

		mockCanvasManager = {
			canvas: mockCanvas,
			editor: {
				layers: [],
				undo: jest.fn(),
				redo: jest.fn()
			},
			currentTool: 'pointer',
			isDrawing: false,
			isResizing: false,
			isRotating: false,
			isDragging: false,
			isPanning: false,
			isMarqueeSelecting: false,
			isPinching: false,
			isDraggingGuide: false,
			spacePressed: false,
			showRulers: false,
			rulerSize: 20,
			zoom: 1,
			panX: 0,
			panY: 0,
			startPoint: null,
			dragStartPoint: null,
			lastPanPoint: null,
			lastTouchPoint: null,
			lastTouchTime: 0,
			resizeHandle: null,

			// TransformController for resize/rotate/drag operations
			transformController: {
				isResizing: false,
				isRotating: false,
				isDragging: false,
				resizeHandle: null,
				dragStartPoint: null,
				startResize: jest.fn(),
				startRotation: jest.fn(),
				startDrag: jest.fn(),
				handleResize: jest.fn(),
				handleRotation: jest.fn(),
				handleDrag: jest.fn(),
				finishResize: jest.fn(),
				finishRotation: jest.fn(),
				finishDrag: jest.fn()
			},

			// Methods
			getMousePoint: jest.fn( ( e ) => ( { x: e.clientX, y: e.clientY } ) ),
			getRawClientPoint: jest.fn( ( e ) => ( { canvasX: e.clientX, canvasY: e.clientY } ) ),
			getSelectedLayerId: jest.fn( () => null ),
			hitTestSelectionHandles: jest.fn( () => null ),
			startRotation: jest.fn(),
			startResize: jest.fn(),
			startDrag: jest.fn(),
			startMarqueeSelection: jest.fn(),
			startDrawing: jest.fn(),
			handleLayerSelection: jest.fn( () => null ),
			handleZoomClick: jest.fn(),
			handleZoomDrag: jest.fn(),
			continueDrawing: jest.fn(),
			handleResize: jest.fn(),
			handleRotation: jest.fn(),
			handleDrag: jest.fn(),
			updateCursor: jest.fn(),
			updateMarqueeSelection: jest.fn(),
			finishMarqueeSelection: jest.fn(),
			finishResize: jest.fn(),
			finishRotation: jest.fn(),
			finishDrag: jest.fn(),
			finishDrawing: jest.fn(),
			addHorizontalGuide: jest.fn(),
			addVerticalGuide: jest.fn(),
			renderLayers: jest.fn(),
			drawGuidePreview: jest.fn(),
			updateCanvasTransform: jest.fn(),
			getToolCursor: jest.fn( () => 'default' ),
			zoomBy: jest.fn(),
			zoomIn: jest.fn(),
			zoomOut: jest.fn(),
			resetZoom: jest.fn(),
			fitToWindow: jest.fn(),
			setZoom: jest.fn(),
			selectAll: jest.fn(),
			deselectAll: jest.fn(),
			copySelected: jest.fn(),
			pasteFromClipboard: jest.fn(),
			cutSelected: jest.fn(),
			deleteSelected: jest.fn(),
			updateStatus: jest.fn()
		};

		// Mock document.addEventListener/removeEventListener
		jest.spyOn( document, 'addEventListener' ).mockImplementation( ( type, handler ) => {
			addedListeners.push( { type, handler, target: 'document' } );
		} );
		jest.spyOn( document, 'removeEventListener' ).mockImplementation( ( type, handler ) => {
			removedListeners.push( { type, handler, target: 'document' } );
		} );

		canvasEvents = new CanvasEvents( mockCanvasManager );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
	} );

	describe( 'constructor and setup', () => {
		it( 'should store canvas manager reference', () => {
			expect( canvasEvents.cm ).toBe( mockCanvasManager );
		} );

		it( 'should store canvas reference', () => {
			expect( canvasEvents.canvas ).toBe( mockCanvas );
		} );

		it( 'should attach mouse event listeners to canvas', () => {
			const canvasListeners = addedListeners.filter( l => l.target !== 'document' );
			const types = canvasListeners.map( l => l.type );
			expect( types ).toContain( 'mousedown' );
			expect( types ).toContain( 'mousemove' );
			expect( types ).toContain( 'mouseup' );
		} );

		it( 'should attach wheel listener with passive: false', () => {
			const wheelListener = addedListeners.find( l => l.type === 'wheel' );
			expect( wheelListener ).toBeDefined();
			expect( wheelListener.options ).toEqual( { passive: false } );
		} );

		it( 'should attach contextmenu listener', () => {
			const contextMenuListener = addedListeners.find( l => l.type === 'contextmenu' );
			expect( contextMenuListener ).toBeDefined();
		} );

		it( 'should attach keyboard listeners to document', () => {
			const docListeners = addedListeners.filter( l => l.target === 'document' );
			const types = docListeners.map( l => l.type );
			expect( types ).toContain( 'keydown' );
			expect( types ).toContain( 'keyup' );
		} );

		it( 'should attach touch event listeners', () => {
			const types = addedListeners.map( l => l.type );
			expect( types ).toContain( 'touchstart' );
			expect( types ).toContain( 'touchmove' );
			expect( types ).toContain( 'touchend' );
			expect( types ).toContain( 'touchcancel' );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should remove all event listeners', () => {
			canvasEvents.destroy();

			const types = removedListeners.map( l => l.type );
			expect( types ).toContain( 'mousedown' );
			expect( types ).toContain( 'mousemove' );
			expect( types ).toContain( 'mouseup' );
			expect( types ).toContain( 'wheel' );
			expect( types ).toContain( 'contextmenu' );
			expect( types ).toContain( 'keydown' );
			expect( types ).toContain( 'keyup' );
			expect( types ).toContain( 'touchstart' );
			expect( types ).toContain( 'touchmove' );
			expect( types ).toContain( 'touchend' );
			expect( types ).toContain( 'touchcancel' );
		} );
	} );

	describe( 'handleContextMenu', () => {
		it( 'should prevent default context menu', () => {
			const event = { preventDefault: jest.fn() };
			canvasEvents.handleContextMenu( event );
			expect( event.preventDefault ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleMouseDown', () => {
		it( 'should set start point and drag start point', () => {
			const event = { clientX: 100, clientY: 200, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.startPoint ).toEqual( { x: 100, y: 200 } );
			expect( mockCanvasManager.dragStartPoint ).toEqual( { x: 100, y: 200 } );
		} );

		it( 'should ignore right click (button 2)', () => {
			const event = { clientX: 100, clientY: 200, button: 2 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.isDrawing ).toBe( false );
		} );

		it( 'should start panning on middle mouse button', () => {
			const event = { clientX: 100, clientY: 200, button: 1 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.isPanning ).toBe( true );
			expect( mockCanvasManager.lastPanPoint ).toEqual( { x: 100, y: 200 } );
			expect( mockCanvas.style.cursor ).toBe( 'grabbing' );
		} );

		it( 'should start panning when space is pressed and left click', () => {
			mockCanvasManager.spacePressed = true;
			const event = { clientX: 100, clientY: 200, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.isPanning ).toBe( true );
		} );

		it( 'should check selection handles when pointer tool and layer selected', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.getSelectedLayerId.mockReturnValue( 'layer1' );
			mockCanvasManager.hitTestSelectionHandles.mockReturnValue( { type: 'se' } );

			const event = { clientX: 100, clientY: 200, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.hitTestSelectionHandles ).toHaveBeenCalled();
			expect( mockCanvasManager.transformController.startResize ).toHaveBeenCalled();
		} );

		it( 'should start rotation when rotate handle hit', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.getSelectedLayerId.mockReturnValue( 'layer1' );
			mockCanvasManager.hitTestSelectionHandles.mockReturnValue( { type: 'rotate' } );

			const event = { clientX: 100, clientY: 200, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.transformController.startRotation ).toHaveBeenCalled();
		} );

		it( 'should handle zoom tool click', () => {
			mockCanvasManager.currentTool = 'zoom';
			const event = { clientX: 100, clientY: 200, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.isDrawing ).toBe( true );
			expect( mockCanvasManager.handleZoomClick ).toHaveBeenCalled();
		} );

		it( 'should start drawing for non-pointer tools', () => {
			mockCanvasManager.currentTool = 'rectangle';
			const event = { clientX: 100, clientY: 200, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.startDrawing ).toHaveBeenCalled();
		} );

		it( 'should handle layer selection and start drag when layer selected', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.handleLayerSelection.mockReturnValue( { id: 'layer1' } );

			const event = { clientX: 100, clientY: 200, button: 0, ctrlKey: false, metaKey: false };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.handleLayerSelection ).toHaveBeenCalled();
			expect( mockCanvasManager.transformController.startDrag ).toHaveBeenCalled();
		} );

		it( 'should start marquee selection when no layer selected', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.handleLayerSelection.mockReturnValue( null );

			const event = { clientX: 100, clientY: 200, button: 0, ctrlKey: false, metaKey: false };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.startMarqueeSelection ).toHaveBeenCalled();
		} );

		it( 'should start marquee selection with marquee tool', () => {
			mockCanvasManager.currentTool = 'marquee';

			const event = { clientX: 100, clientY: 200, button: 0, ctrlKey: false, metaKey: false };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.startMarqueeSelection ).toHaveBeenCalled();
		} );

		it( 'should start guide drag when clicking in ruler area', () => {
			mockCanvasManager.showRulers = true;
			mockCanvasManager.rulerSize = 20;
			mockCanvasManager.getRawClientPoint.mockReturnValue( { canvasX: 100, canvasY: 10 } );

			const event = { clientX: 100, clientY: 10, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.isDraggingGuide ).toBe( true );
			expect( mockCanvasManager.dragGuideOrientation ).toBe( 'h' );
		} );

		it( 'should start vertical guide drag when clicking in left ruler', () => {
			mockCanvasManager.showRulers = true;
			mockCanvasManager.rulerSize = 20;
			mockCanvasManager.getRawClientPoint.mockReturnValue( { canvasX: 10, canvasY: 100 } );

			const event = { clientX: 10, clientY: 100, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.isDraggingGuide ).toBe( true );
			expect( mockCanvasManager.dragGuideOrientation ).toBe( 'v' );
		} );
	} );

	describe( 'handleMouseMove', () => {
		it( 'should update cursor position status', () => {
			mockCanvasManager.editor.updateStatus = jest.fn();
			const event = { clientX: 150, clientY: 250 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.editor.updateStatus ).toHaveBeenCalledWith( {
				pos: { x: 150, y: 250 }
			} );
		} );

		it( 'should update marquee selection when marquee selecting', () => {
			mockCanvasManager.isMarqueeSelecting = true;
			const event = { clientX: 150, clientY: 250 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.updateMarqueeSelection ).toHaveBeenCalled();
		} );

		it( 'should pan when panning', () => {
			mockCanvasManager.isPanning = true;
			mockCanvasManager.lastPanPoint = { x: 100, y: 100 };
			mockCanvasManager.panX = 0;
			mockCanvasManager.panY = 0;

			const event = { clientX: 120, clientY: 130 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.panX ).toBe( 20 );
			expect( mockCanvasManager.panY ).toBe( 30 );
			expect( mockCanvasManager.updateCanvasTransform ).toHaveBeenCalled();
		} );

		it( 'should handle resize when resizing', () => {
			mockCanvasManager.transformController.isResizing = true;
			mockCanvasManager.transformController.resizeHandle = { type: 'se' };
			mockCanvasManager.transformController.dragStartPoint = { x: 100, y: 100 };

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.transformController.handleResize ).toHaveBeenCalled();
		} );

		it( 'should log error and continue when handleResize throws', () => {
			// Setup mw.log.error mock
			global.mw = { log: { error: jest.fn() } };

			mockCanvasManager.transformController.isResizing = true;
			mockCanvasManager.transformController.resizeHandle = { type: 'se' };
			mockCanvasManager.transformController.dragStartPoint = { x: 100, y: 100 };
			mockCanvasManager.transformController.handleResize.mockImplementation( () => {
				throw new Error( 'Resize calculation failed' );
			} );

			const event = { clientX: 150, clientY: 150 };

			// Should not throw
			expect( () => {
				canvasEvents.handleMouseMove( event );
			} ).not.toThrow();

			// Should log the error
			expect( global.mw.log.error ).toHaveBeenCalledWith(
				'[CanvasEvents] handleResize error:',
				'Resize calculation failed'
			);

			delete global.mw;
		} );

		it( 'should handle resize error when mw.log is not available', () => {
			// No mw global
			delete global.mw;

			mockCanvasManager.transformController.isResizing = true;
			mockCanvasManager.transformController.resizeHandle = { type: 'se' };
			mockCanvasManager.transformController.dragStartPoint = { x: 100, y: 100 };
			mockCanvasManager.transformController.handleResize.mockImplementation( () => {
				throw new Error( 'Resize error' );
			} );

			const event = { clientX: 150, clientY: 150 };

			// Should not throw even without mw.log
			expect( () => {
				canvasEvents.handleMouseMove( event );
			} ).not.toThrow();
		} );

		it( 'should handle resize error with error object without message', () => {
			global.mw = { log: { error: jest.fn() } };

			mockCanvasManager.transformController.isResizing = true;
			mockCanvasManager.transformController.resizeHandle = { type: 'se' };
			mockCanvasManager.transformController.dragStartPoint = { x: 100, y: 100 };

			const errorObj = { code: 'ERR_UNKNOWN' };
			mockCanvasManager.transformController.handleResize.mockImplementation( () => {
				throw errorObj;
			} );

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			// Should log the error object itself when no message
			expect( global.mw.log.error ).toHaveBeenCalledWith(
				'[CanvasEvents] handleResize error:',
				errorObj
			);

			delete global.mw;
		} );

		it( 'should handle rotation when rotating', () => {
			mockCanvasManager.transformController.isRotating = true;
			mockCanvasManager.transformController.dragStartPoint = { x: 100, y: 100 };

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.transformController.handleRotation ).toHaveBeenCalled();
		} );

		it( 'should handle drag when dragging', () => {
			mockCanvasManager.transformController.isDragging = true;
			mockCanvasManager.transformController.dragStartPoint = { x: 100, y: 100 };

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.transformController.handleDrag ).toHaveBeenCalled();
		} );

		it( 'should update cursor when not in active state', () => {
			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.updateCursor ).toHaveBeenCalled();
		} );

		it( 'should handle zoom drag when zoom tool is active and drawing', () => {
			mockCanvasManager.currentTool = 'zoom';
			mockCanvasManager.isDrawing = true;

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.handleZoomDrag ).toHaveBeenCalled();
		} );

		it( 'should continue drawing for non-pointer tools', () => {
			mockCanvasManager.currentTool = 'rectangle';
			mockCanvasManager.isDrawing = true;

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.continueDrawing ).toHaveBeenCalled();
		} );

		it( 'should update guide preview when dragging guide', () => {
			mockCanvasManager.isDraggingGuide = true;
			mockCanvasManager.dragGuideOrientation = 'h';

			const event = { clientX: 150, clientY: 200 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.dragGuidePos ).toBe( 200 );
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
			expect( mockCanvasManager.drawGuidePreview ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleMouseUp', () => {
		it( 'should finish marquee selection', () => {
			mockCanvasManager.isMarqueeSelecting = true;
			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.finishMarqueeSelection ).toHaveBeenCalled();
		} );

		it( 'should finish panning', () => {
			mockCanvasManager.isPanning = true;
			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.isPanning ).toBe( false );
		} );

		it( 'should finish resize', () => {
			mockCanvasManager.transformController.isResizing = true;
			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.transformController.finishResize ).toHaveBeenCalled();
		} );

		it( 'should finish rotation', () => {
			mockCanvasManager.transformController.isRotating = true;
			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.transformController.finishRotation ).toHaveBeenCalled();
		} );

		it( 'should finish drag', () => {
			mockCanvasManager.transformController.isDragging = true;
			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.transformController.finishDrag ).toHaveBeenCalled();
		} );

		it( 'should finish drawing for non-pointer tools', () => {
			mockCanvasManager.isDrawing = true;
			mockCanvasManager.currentTool = 'rectangle';
			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.finishDrawing ).toHaveBeenCalled();
			expect( mockCanvasManager.isDrawing ).toBe( false );
		} );

		it( 'should add horizontal guide when finishing guide drag', () => {
			mockCanvasManager.isDraggingGuide = true;
			mockCanvasManager.dragGuideOrientation = 'h';
			mockCanvasManager.dragGuidePos = 200;

			const event = { clientX: 150, clientY: 200 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.addHorizontalGuide ).toHaveBeenCalledWith( 200 );
			expect( mockCanvasManager.isDraggingGuide ).toBe( false );
		} );

		it( 'should add vertical guide when finishing vertical guide drag', () => {
			mockCanvasManager.isDraggingGuide = true;
			mockCanvasManager.dragGuideOrientation = 'v';
			mockCanvasManager.dragGuidePos = 150;

			const event = { clientX: 150, clientY: 200 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.addVerticalGuide ).toHaveBeenCalledWith( 150 );
		} );
	} );

	describe( 'handleWheel', () => {
		it( 'should prevent default', () => {
			const event = { deltaY: -100, preventDefault: jest.fn() };
			canvasEvents.handleWheel( event );
			expect( event.preventDefault ).toHaveBeenCalled();
		} );

		it( 'should zoom in when scrolling up (negative deltaY)', () => {
			const event = { deltaY: -100, clientX: 400, clientY: 300, preventDefault: jest.fn() };
			canvasEvents.handleWheel( event );

			expect( mockCanvasManager.zoomBy ).toHaveBeenCalledWith( 0.1, { x: 400, y: 300 } );
		} );

		it( 'should zoom out when scrolling down (positive deltaY)', () => {
			const event = { deltaY: 100, clientX: 400, clientY: 300, preventDefault: jest.fn() };
			canvasEvents.handleWheel( event );

			expect( mockCanvasManager.zoomBy ).toHaveBeenCalledWith( -0.1, { x: 400, y: 300 } );
		} );

		it( 'should not zoom when resizing', () => {
			mockCanvasManager.transformController.isResizing = true;
			const event = { deltaY: -100, preventDefault: jest.fn() };
			canvasEvents.handleWheel( event );

			expect( mockCanvasManager.zoomBy ).not.toHaveBeenCalled();
		} );

		it( 'should not zoom when rotating', () => {
			mockCanvasManager.transformController.isRotating = true;
			const event = { deltaY: -100, preventDefault: jest.fn() };
			canvasEvents.handleWheel( event );

			expect( mockCanvasManager.zoomBy ).not.toHaveBeenCalled();
		} );

		it( 'should not zoom when dragging', () => {
			mockCanvasManager.transformController.isDragging = true;
			const event = { deltaY: -100, preventDefault: jest.fn() };
			canvasEvents.handleWheel( event );

			expect( mockCanvasManager.zoomBy ).not.toHaveBeenCalled();
		} );

		it( 'should not zoom when panning', () => {
			mockCanvasManager.isPanning = true;
			const event = { deltaY: -100, preventDefault: jest.fn() };
			canvasEvents.handleWheel( event );

			expect( mockCanvasManager.zoomBy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'handleKeyDown', () => {
		it( 'should ignore keys in input fields', () => {
			const event = {
				target: { tagName: 'INPUT' },
				key: 'a',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.selectAll ).not.toHaveBeenCalled();
		} );

		it( 'should ignore keys in textarea', () => {
			const event = {
				target: { tagName: 'TEXTAREA' },
				key: 'a',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.selectAll ).not.toHaveBeenCalled();
		} );

		it( 'should ignore keys in contentEditable', () => {
			const event = {
				target: { tagName: 'DIV', contentEditable: 'true' },
				key: 'a',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.selectAll ).not.toHaveBeenCalled();
		} );

		it( 'should select all with Ctrl+A', () => {
			const event = {
				target: { tagName: 'CANVAS' },
				key: 'a',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockCanvasManager.selectAll ).toHaveBeenCalled();
		} );

		// Note: Ctrl+D is now handled by EventManager for duplicate (not deselect)
		// This test is removed as CanvasEvents no longer handles Ctrl+D

		it( 'should copy with Ctrl+C', () => {
			const event = {
				target: { tagName: 'CANVAS' },
				key: 'c',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.copySelected ).toHaveBeenCalled();
		} );

		it( 'should paste with Ctrl+V', () => {
			const event = {
				target: { tagName: 'CANVAS' },
				key: 'v',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.pasteFromClipboard ).toHaveBeenCalled();
		} );

		it( 'should cut with Ctrl+X', () => {
			const event = {
				target: { tagName: 'CANVAS' },
				key: 'x',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.cutSelected ).toHaveBeenCalled();
		} );

		// Note: Ctrl+Z/Y undo/redo is handled by EventManager to avoid duplicate handlers
		// CanvasEvents no longer handles these shortcuts

		it( 'should zoom in with Ctrl++', () => {
			const event = {
				target: { tagName: 'CANVAS' },
				key: '+',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.zoomIn ).toHaveBeenCalled();
		} );

		it( 'should zoom in with Ctrl+=', () => {
			const event = {
				target: { tagName: 'CANVAS' },
				key: '=',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.zoomIn ).toHaveBeenCalled();
		} );

		it( 'should zoom out with Ctrl+-', () => {
			const event = {
				target: { tagName: 'CANVAS' },
				key: '-',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.zoomOut ).toHaveBeenCalled();
		} );

		it( 'should reset zoom with Ctrl+0', () => {
			const event = {
				target: { tagName: 'CANVAS' },
				key: '0',
				ctrlKey: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.resetZoom ).toHaveBeenCalled();
		} );

		// Note: Delete/Backspace are now handled by EventManager to avoid duplicate handlers
		// These tests are removed as CanvasEvents no longer handles Delete/Backspace

		it( 'should pan up with ArrowUp', () => {
			mockCanvasManager.panY = 0;
			const event = {
				target: { tagName: 'CANVAS' },
				key: 'ArrowUp',
				ctrlKey: false,
				metaKey: false,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.panY ).toBe( 20 );
			expect( mockCanvasManager.updateCanvasTransform ).toHaveBeenCalled();
		} );

		it( 'should pan down with ArrowDown', () => {
			mockCanvasManager.panY = 0;
			const event = {
				target: { tagName: 'CANVAS' },
				key: 'ArrowDown',
				ctrlKey: false,
				metaKey: false,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.panY ).toBe( -20 );
		} );

		it( 'should pan left with ArrowLeft', () => {
			mockCanvasManager.panX = 0;
			const event = {
				target: { tagName: 'CANVAS' },
				key: 'ArrowLeft',
				ctrlKey: false,
				metaKey: false,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.panX ).toBe( 20 );
		} );

		it( 'should pan right with ArrowRight', () => {
			mockCanvasManager.panX = 0;
			const event = {
				target: { tagName: 'CANVAS' },
				key: 'ArrowRight',
				ctrlKey: false,
				metaKey: false,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.panX ).toBe( -20 );
		} );

		it( 'should enable pan mode with Space key', () => {
			const event = {
				target: { tagName: 'CANVAS' },
				code: 'Space',
				repeat: false,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			expect( mockCanvasManager.spacePressed ).toBe( true );
			expect( mockCanvas.style.cursor ).toBe( 'grab' );
		} );

		it( 'should not re-enable pan mode on space key repeat', () => {
			mockCanvasManager.spacePressed = true;
			const event = {
				target: { tagName: 'CANVAS' },
				code: 'Space',
				repeat: true,
				preventDefault: jest.fn()
			};
			canvasEvents.handleKeyDown( event );

			// Should not call preventDefault since repeat is true
			expect( event.preventDefault ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'handleKeyUp', () => {
		it( 'should disable pan mode when Space is released', () => {
			mockCanvasManager.spacePressed = true;
			const event = { code: 'Space' };
			canvasEvents.handleKeyUp( event );

			expect( mockCanvasManager.spacePressed ).toBe( false );
		} );

		it( 'should restore cursor when Space is released and not panning', () => {
			mockCanvasManager.spacePressed = true;
			mockCanvasManager.isPanning = false;
			mockCanvasManager.getToolCursor.mockReturnValue( 'crosshair' );

			const event = { code: 'Space' };
			canvasEvents.handleKeyUp( event );

			expect( mockCanvas.style.cursor ).toBe( 'crosshair' );
		} );

		it( 'should not restore cursor when still panning', () => {
			mockCanvasManager.spacePressed = true;
			mockCanvasManager.isPanning = true;
			mockCanvas.style.cursor = 'grabbing';

			const event = { code: 'Space' };
			canvasEvents.handleKeyUp( event );

			// Cursor should remain as grabbing
			expect( mockCanvas.style.cursor ).toBe( 'grabbing' );
		} );
	} );

	describe( 'handleTouchStart', () => {
		it( 'should store last touch point', () => {
			const event = {
				touches: [ { clientX: 100, clientY: 200 } ]
			};
			canvasEvents.handleTouchStart( event );

			expect( mockCanvasManager.lastTouchPoint ).toEqual( { clientX: 100, clientY: 200 } );
		} );

		it( 'should store last touch time', () => {
			const before = Date.now();
			const event = {
				touches: [ { clientX: 100, clientY: 200 } ]
			};
			canvasEvents.handleTouchStart( event );
			const after = Date.now();

			expect( mockCanvasManager.lastTouchTime ).toBeGreaterThanOrEqual( before );
			expect( mockCanvasManager.lastTouchTime ).toBeLessThanOrEqual( after );
		} );

		it( 'should handle multi-touch as pinch start', () => {
			const event = {
				touches: [
					{ clientX: 100, clientY: 200 },
					{ clientX: 200, clientY: 300 }
				]
			};
			canvasEvents.handleTouchStart( event );

			expect( mockCanvasManager.isPinching ).toBe( true );
		} );

		it( 'should do nothing when no touches', () => {
			const event = { touches: [] };
			canvasEvents.handleTouchStart( event );

			expect( mockCanvasManager.lastTouchPoint ).toBeNull();
		} );
	} );

	describe( 'handleTouchMove', () => {
		it( 'should update last touch point', () => {
			const event = {
				touches: [ { clientX: 150, clientY: 250 } ]
			};
			canvasEvents.handleTouchMove( event );

			expect( mockCanvasManager.lastTouchPoint ).toEqual( { clientX: 150, clientY: 250 } );
		} );

		it( 'should handle pinch move for multi-touch', () => {
			mockCanvasManager.isPinching = true;
			mockCanvasManager.initialPinchDistance = 100;
			mockCanvasManager.initialZoom = 1;

			const event = {
				touches: [
					{ clientX: 50, clientY: 100 },
					{ clientX: 250, clientY: 300 }
				]
			};
			canvasEvents.handleTouchMove( event );

			expect( mockCanvasManager.setZoom ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleTouchEnd', () => {
		it( 'should update last touch point from changedTouches', () => {
			mockCanvasManager.lastTouchPoint = { clientX: 100, clientY: 100 };
			const event = {
				changedTouches: [ { clientX: 200, clientY: 300 } ]
			};
			canvasEvents.handleTouchEnd( event );

			expect( mockCanvasManager.lastTouchPoint ).toEqual( { clientX: 200, clientY: 300 } );
		} );

		it( 'should handle pinch end', () => {
			mockCanvasManager.isPinching = true;
			const event = { changedTouches: [] };
			canvasEvents.handleTouchEnd( event );

			expect( mockCanvasManager.isPinching ).toBe( false );
		} );

		it( 'should trigger double-tap when tapped twice quickly', () => {
			// Setup: recent touch time to trigger double-tap
			const now = Date.now();
			mockCanvasManager.lastTouchTime = now - 100; // 100ms ago
			mockCanvasManager.lastTouchPoint = { clientX: 100, clientY: 100 };
			mockCanvasManager.zoom = 1;

			// Spy on handleDoubleTap
			const doubleTapSpy = jest.spyOn( canvasEvents, 'handleDoubleTap' );

			const event = {
				changedTouches: [ { clientX: 100, clientY: 100 } ]
			};
			canvasEvents.handleTouchEnd( event );

			expect( doubleTapSpy ).toHaveBeenCalled();
			doubleTapSpy.mockRestore();
		} );

		it( 'should convert touch to mouseUp when not double-tap or pinch', () => {
			// No recent touch time, not pinching
			mockCanvasManager.lastTouchTime = null;
			mockCanvasManager.isPinching = false;
			mockCanvasManager.lastTouchPoint = { clientX: 150, clientY: 250 };

			// Spy on handleMouseUp
			const mouseUpSpy = jest.spyOn( canvasEvents, 'handleMouseUp' ).mockImplementation( () => {} );

			const event = {
				changedTouches: [ { clientX: 150, clientY: 250 } ]
			};
			canvasEvents.handleTouchEnd( event );

			expect( mouseUpSpy ).toHaveBeenCalled();
			mouseUpSpy.mockRestore();
		} );
	} );

	describe( 'handleTouchMove (extended)', () => {
		it( 'should do nothing when no touches', () => {
			const event = { touches: [] };
			const result = canvasEvents.handleTouchMove( event );

			// Should return early
			expect( result ).toBeUndefined();
		} );

		it( 'should convert single touch to mouse move', () => {
			mockCanvasManager.isPinching = false;

			// Spy on handleMouseMove
			const mouseMoveSpy = jest.spyOn( canvasEvents, 'handleMouseMove' ).mockImplementation( () => {} );

			const event = {
				touches: [ { clientX: 200, clientY: 300 } ]
			};
			canvasEvents.handleTouchMove( event );

			expect( mouseMoveSpy ).toHaveBeenCalled();
			mouseMoveSpy.mockRestore();
		} );
	} );

	describe( 'handlePinchStart', () => {
		it( 'should calculate initial pinch distance', () => {
			const event = {
				touches: [
					{ clientX: 0, clientY: 0 },
					{ clientX: 100, clientY: 0 }
				]
			};
			canvasEvents.handlePinchStart( event );

			expect( mockCanvasManager.isPinching ).toBe( true );
			expect( mockCanvasManager.initialPinchDistance ).toBe( 100 );
		} );

		it( 'should store initial zoom', () => {
			mockCanvasManager.zoom = 1.5;
			const event = {
				touches: [
					{ clientX: 0, clientY: 0 },
					{ clientX: 100, clientY: 0 }
				]
			};
			canvasEvents.handlePinchStart( event );

			expect( mockCanvasManager.initialZoom ).toBe( 1.5 );
		} );

		it( 'should not start pinch with only one touch', () => {
			const event = {
				touches: [ { clientX: 0, clientY: 0 } ]
			};
			canvasEvents.handlePinchStart( event );

			expect( mockCanvasManager.isPinching ).toBe( false );
		} );
	} );

	describe( 'handlePinchMove', () => {
		it( 'should scale zoom based on pinch distance', () => {
			mockCanvasManager.isPinching = true;
			mockCanvasManager.initialPinchDistance = 100;
			mockCanvasManager.initialZoom = 1;

			const event = {
				touches: [
					{ clientX: 0, clientY: 0 },
					{ clientX: 200, clientY: 0 } // Distance doubled
				]
			};
			canvasEvents.handlePinchMove( event );

			expect( mockCanvasManager.setZoom ).toHaveBeenCalledWith( 2 );
		} );

		it( 'should clamp zoom to maximum', () => {
			mockCanvasManager.isPinching = true;
			mockCanvasManager.initialPinchDistance = 100;
			mockCanvasManager.initialZoom = 3;

			const event = {
				touches: [
					{ clientX: 0, clientY: 0 },
					{ clientX: 200, clientY: 0 } // Would result in 6x zoom
				]
			};
			canvasEvents.handlePinchMove( event );

			expect( mockCanvasManager.setZoom ).toHaveBeenCalledWith( 5 );
		} );

		it( 'should clamp zoom to minimum', () => {
			mockCanvasManager.isPinching = true;
			mockCanvasManager.initialPinchDistance = 100;
			mockCanvasManager.initialZoom = 0.2;

			const event = {
				touches: [
					{ clientX: 0, clientY: 0 },
					{ clientX: 25, clientY: 0 } // Would result in 0.05x zoom
				]
			};
			canvasEvents.handlePinchMove( event );

			expect( mockCanvasManager.setZoom ).toHaveBeenCalledWith( 0.1 );
		} );

		it( 'should not move when not pinching', () => {
			mockCanvasManager.isPinching = false;
			const event = {
				touches: [
					{ clientX: 0, clientY: 0 },
					{ clientX: 200, clientY: 0 }
				]
			};
			canvasEvents.handlePinchMove( event );

			expect( mockCanvasManager.setZoom ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'handlePinchEnd', () => {
		it( 'should reset pinch state', () => {
			mockCanvasManager.isPinching = true;
			mockCanvasManager.initialPinchDistance = 100;
			mockCanvasManager.initialZoom = 1.5;

			canvasEvents.handlePinchEnd();

			expect( mockCanvasManager.isPinching ).toBe( false );
			expect( mockCanvasManager.initialPinchDistance ).toBeNull();
			expect( mockCanvasManager.initialZoom ).toBeNull();
		} );
	} );

	describe( 'handleDoubleTap', () => {
		it( 'should fit to window when zoom >= 1.0', () => {
			// The code calls fitToWindow when zoom >= 1.0
			mockCanvasManager.zoom = 2;
			canvasEvents.handleDoubleTap();

			expect( mockCanvasManager.fitToWindow ).toHaveBeenCalled();
		} );

		it( 'should reset zoom when zoom < 1.0', () => {
			// The code calls resetZoom when zoom < 1.0
			mockCanvasManager.zoom = 0.5;
			canvasEvents.handleDoubleTap();

			expect( mockCanvasManager.resetZoom ).toHaveBeenCalled();
		} );

		it( 'should fit to window when zoom is exactly 1.0', () => {
			mockCanvasManager.zoom = 1.0;
			canvasEvents.handleDoubleTap();

			expect( mockCanvasManager.fitToWindow ).toHaveBeenCalled();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export CanvasEvents', () => {
			expect( CanvasEvents ).toBeDefined();
			expect( typeof CanvasEvents ).toBe( 'function' );
		} );
	} );
} );
