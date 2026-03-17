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

	describe( 'handleContainerMouseDown', () => {
		it( 'should ignore clicks on child elements (not container itself)', () => {
			mockCanvasManager.container = document.createElement( 'div' );
			canvasEvents = new CanvasEvents( mockCanvasManager );

			const childEl = document.createElement( 'canvas' );
			const event = { target: childEl };
			canvasEvents.handleContainerMouseDown( event );

			expect( mockCanvasManager.deselectAll ).not.toHaveBeenCalled();
		} );

		it( 'should finish inline text editing when clicking container', () => {
			const container = document.createElement( 'div' );
			mockCanvasManager.container = container;
			mockCanvasManager.isTextEditing = true;
			mockCanvasManager.inlineTextEditor = { finishEditing: jest.fn() };
			mockCanvasManager.currentTool = 'pointer';
			canvasEvents = new CanvasEvents( mockCanvasManager );

			canvasEvents.handleContainerMouseDown( { target: container } );

			expect( mockCanvasManager.inlineTextEditor.finishEditing ).toHaveBeenCalledWith( true );
		} );

		it( 'should deselect all with pointer tool', () => {
			const container = document.createElement( 'div' );
			mockCanvasManager.container = container;
			mockCanvasManager.currentTool = 'pointer';
			canvasEvents = new CanvasEvents( mockCanvasManager );

			canvasEvents.handleContainerMouseDown( { target: container } );

			expect( mockCanvasManager.deselectAll ).toHaveBeenCalled();
		} );

		it( 'should deselect all with marquee tool', () => {
			const container = document.createElement( 'div' );
			mockCanvasManager.container = container;
			mockCanvasManager.currentTool = 'marquee';
			canvasEvents = new CanvasEvents( mockCanvasManager );

			canvasEvents.handleContainerMouseDown( { target: container } );

			expect( mockCanvasManager.deselectAll ).toHaveBeenCalled();
		} );

		it( 'should not deselect with non-pointer tools', () => {
			const container = document.createElement( 'div' );
			mockCanvasManager.container = container;
			mockCanvasManager.currentTool = 'rectangle';
			canvasEvents = new CanvasEvents( mockCanvasManager );

			canvasEvents.handleContainerMouseDown( { target: container } );

			expect( mockCanvasManager.deselectAll ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'handleDoubleClick', () => {
		it( 'should do nothing when already text editing', () => {
			mockCanvasManager.isTextEditing = true;
			const event = { clientX: 100, clientY: 100, preventDefault: jest.fn() };
			canvasEvents.handleDoubleClick( event );

			expect( event.preventDefault ).not.toHaveBeenCalled();
		} );

		it( 'should block when interactionController blocks interaction', () => {
			mockCanvasManager.interactionController = { shouldBlockInteraction: jest.fn( () => true ) };
			const event = { clientX: 100, clientY: 100, preventDefault: jest.fn() };
			canvasEvents.handleDoubleClick( event );

			expect( event.preventDefault ).not.toHaveBeenCalled();
		} );

		it( 'should do nothing with non-pointer tool', () => {
			mockCanvasManager.currentTool = 'rectangle';
			const event = { clientX: 100, clientY: 100, preventDefault: jest.fn() };
			canvasEvents.handleDoubleClick( event );

			expect( event.preventDefault ).not.toHaveBeenCalled();
		} );

		it( 'should start editing when text layer found', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.inlineTextEditor = { startEditing: jest.fn() };
			mockCanvasManager.editor.layers = [
				{ id: 'txt1', type: 'textbox', x: 50, y: 50, width: 200, height: 100, visible: true }
			];
			mockCanvasManager.hitTestController = {
				hitTestLayer: jest.fn( () => true )
			};

			const event = { clientX: 100, clientY: 80, preventDefault: jest.fn() };
			canvasEvents.handleDoubleClick( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockCanvasManager.inlineTextEditor.startEditing ).toHaveBeenCalledWith(
				expect.objectContaining( { id: 'txt1', type: 'textbox' } )
			);
		} );

		it( 'should not start editing when no text layer at point', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.inlineTextEditor = { startEditing: jest.fn() };
			mockCanvasManager.editor.layers = [
				{ id: 'rect1', type: 'rectangle', x: 50, y: 50, width: 200, height: 100, visible: true }
			];
			const event = { clientX: 100, clientY: 80, preventDefault: jest.fn() };
			canvasEvents.handleDoubleClick( event );

			expect( mockCanvasManager.inlineTextEditor.startEditing ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'findTextLayerAtPoint', () => {
		it( 'should find topmost text layer at point', () => {
			mockCanvasManager.hitTestController = {
				hitTestLayer: jest.fn( () => true )
			};
			const layers = [
				{ id: 'txt1', type: 'text', visible: true },
				{ id: 'txt2', type: 'textbox', visible: true }
			];

			const result = canvasEvents.findTextLayerAtPoint( { x: 100, y: 100 }, layers );

			// Should return topmost (last in array)
			expect( result.id ).toBe( 'txt2' );
		} );

		it( 'should skip hidden layers (visible === false)', () => {
			mockCanvasManager.hitTestController = {
				hitTestLayer: jest.fn( () => true )
			};
			const layers = [
				{ id: 'txt1', type: 'text', visible: true },
				{ id: 'txt2', type: 'textbox', visible: false }
			];

			const result = canvasEvents.findTextLayerAtPoint( { x: 100, y: 100 }, layers );

			expect( result.id ).toBe( 'txt1' );
		} );

		it( 'should skip hidden layers (visible === 0)', () => {
			mockCanvasManager.hitTestController = {
				hitTestLayer: jest.fn( () => true )
			};
			const layers = [
				{ id: 'txt1', type: 'text', visible: true },
				{ id: 'txt2', type: 'textbox', visible: 0 }
			];

			const result = canvasEvents.findTextLayerAtPoint( { x: 100, y: 100 }, layers );

			expect( result.id ).toBe( 'txt1' );
		} );

		it( 'should skip non-text layer types', () => {
			mockCanvasManager.hitTestController = {
				hitTestLayer: jest.fn( () => true )
			};
			const layers = [
				{ id: 'rect1', type: 'rectangle', visible: true },
				{ id: 'txt1', type: 'callout', visible: true }
			];

			const result = canvasEvents.findTextLayerAtPoint( { x: 100, y: 100 }, layers );

			expect( result.id ).toBe( 'txt1' );
		} );

		it( 'should return null when no text layers found', () => {
			const layers = [
				{ id: 'rect1', type: 'rectangle', visible: true }
			];

			const result = canvasEvents.findTextLayerAtPoint( { x: 100, y: 100 }, layers );

			expect( result ).toBeNull();
		} );

		it( 'should return null for empty layers array', () => {
			const result = canvasEvents.findTextLayerAtPoint( { x: 100, y: 100 }, [] );

			expect( result ).toBeNull();
		} );
	} );

	describe( 'isPointInLayer', () => {
		it( 'should use HitTestController when available', () => {
			mockCanvasManager.hitTestController = {
				hitTestLayer: jest.fn( () => true )
			};
			const layer = { id: 'test', x: 0, y: 0, width: 100, height: 100 };
			const result = canvasEvents.isPointInLayer( { x: 50, y: 50 }, layer );

			expect( result ).toBe( true );
			expect( mockCanvasManager.hitTestController.hitTestLayer ).toHaveBeenCalledWith( layer, { x: 50, y: 50 } );
		} );

		it( 'should fall back to bounding box check', () => {
			mockCanvasManager.hitTestController = null;
			const layer = { x: 10, y: 20, width: 100, height: 50 };

			expect( canvasEvents.isPointInLayer( { x: 50, y: 40 }, layer ) ).toBe( true );
			expect( canvasEvents.isPointInLayer( { x: 5, y: 40 }, layer ) ).toBe( false );
			expect( canvasEvents.isPointInLayer( { x: 50, y: 80 }, layer ) ).toBe( false );
		} );

		it( 'should use defaults for missing dimensions', () => {
			mockCanvasManager.hitTestController = null;
			const layer = {}; // No x, y, width, height

			// Defaults: x=0, y=0, width=100, height=50
			expect( canvasEvents.isPointInLayer( { x: 50, y: 25 }, layer ) ).toBe( true );
			expect( canvasEvents.isPointInLayer( { x: 150, y: 25 }, layer ) ).toBe( false );
		} );
	} );

	describe( 'handleMouseDown - dimension handling', () => {
		it( 'should start dimension text drag when clicking in text area', () => {
			mockCanvasManager.currentTool = 'pointer';
			const dimensionLayer = {
				id: 'dim1', type: 'dimension',
				x1: 0, y1: 0, x2: 200, y2: 0,
				fontSize: 12
			};
			mockCanvasManager.handleLayerSelection.mockReturnValue( dimensionLayer );
			mockCanvasManager.transformController.startDimensionTextDrag = jest.fn();

			// Mock isPointInDimensionTextArea to return true
			jest.spyOn( canvasEvents, 'isPointInDimensionTextArea' ).mockReturnValue( true );

			const event = { clientX: 100, clientY: 0, button: 0, ctrlKey: false, metaKey: false };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.transformController.startDimensionTextDrag ).toHaveBeenCalled();
		} );

		it( 'should not drag dimension layer when clicking outside text area', () => {
			mockCanvasManager.currentTool = 'pointer';
			const dimensionLayer = { id: 'dim1', type: 'dimension' };
			mockCanvasManager.handleLayerSelection.mockReturnValue( dimensionLayer );
			mockCanvasManager.transformController.startDimensionTextDrag = jest.fn();

			jest.spyOn( canvasEvents, 'isPointInDimensionTextArea' ).mockReturnValue( false );

			const event = { clientX: 100, clientY: 0, button: 0, ctrlKey: false, metaKey: false };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.transformController.startDimensionTextDrag ).not.toHaveBeenCalled();
			// Also should NOT start regular drag for dimension layers
			expect( mockCanvasManager.transformController.startDrag ).not.toHaveBeenCalled();
		} );

		it( 'should start angle dimension text drag when clicking in text area', () => {
			mockCanvasManager.currentTool = 'pointer';
			const angleLayer = { id: 'ang1', type: 'angleDimension' };
			mockCanvasManager.handleLayerSelection.mockReturnValue( angleLayer );
			mockCanvasManager.transformController.startAngleDimensionTextDrag = jest.fn();

			jest.spyOn( canvasEvents, 'isPointInAngleDimensionTextArea' ).mockReturnValue( true );

			const event = { clientX: 100, clientY: 100, button: 0, ctrlKey: false, metaKey: false };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.transformController.startAngleDimensionTextDrag ).toHaveBeenCalled();
		} );

		it( 'should not drag angle dimension when clicking outside text area', () => {
			mockCanvasManager.currentTool = 'pointer';
			const angleLayer = { id: 'ang1', type: 'angleDimension' };
			mockCanvasManager.handleLayerSelection.mockReturnValue( angleLayer );
			mockCanvasManager.transformController.startAngleDimensionTextDrag = jest.fn();

			jest.spyOn( canvasEvents, 'isPointInAngleDimensionTextArea' ).mockReturnValue( false );

			const event = { clientX: 100, clientY: 100, button: 0, ctrlKey: false, metaKey: false };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.transformController.startAngleDimensionTextDrag ).not.toHaveBeenCalled();
			expect( mockCanvasManager.transformController.startDrag ).not.toHaveBeenCalled();
		} );

		it( 'should block mousedown when interactionController blocks', () => {
			mockCanvasManager.interactionController = { shouldBlockInteraction: jest.fn( () => true ) };
			const event = { clientX: 100, clientY: 100, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.startDrawing ).not.toHaveBeenCalled();
			expect( mockCanvasManager.handleLayerSelection ).not.toHaveBeenCalled();
		} );

		it( 'should finish text editing on mousedown then continue', () => {
			mockCanvasManager.isTextEditing = true;
			mockCanvasManager.inlineTextEditor = { finishEditing: jest.fn() };
			mockCanvasManager.currentTool = 'rectangle';

			const event = { clientX: 100, clientY: 100, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.inlineTextEditor.finishEditing ).toHaveBeenCalledWith( true );
			expect( mockCanvasManager.startDrawing ).toHaveBeenCalled();
		} );

		it( 'should handle arrowTip handle hit with marker flag', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.getSelectedLayerId.mockReturnValue( 'layer1' );
			mockCanvasManager.hitTestSelectionHandles.mockReturnValue( {
				type: 'arrowTip', isMarker: true
			} );
			mockCanvasManager.transformController.startArrowTipDrag = jest.fn();

			const event = { clientX: 100, clientY: 100, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.transformController.startArrowTipDrag ).toHaveBeenCalled();
		} );

		it( 'should handle dimensionOffset handle hit', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.getSelectedLayerId.mockReturnValue( 'layer1' );
			mockCanvasManager.hitTestSelectionHandles.mockReturnValue( {
				type: 'dimensionOffset', isDimensionOffset: true
			} );
			mockCanvasManager.transformController.startDimensionOffsetDrag = jest.fn();

			const event = { clientX: 100, clientY: 100, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.transformController.startDimensionOffsetDrag ).toHaveBeenCalled();
		} );

		it( 'should handle angleDimensionText handle hit', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.getSelectedLayerId.mockReturnValue( 'layer1' );
			mockCanvasManager.editor.getLayerById = jest.fn( () => ( {
				id: 'ang1', type: 'angleDimension', cx: 100, cy: 100, arcRadius: 40
			} ) );
			mockCanvasManager.hitTestSelectionHandles.mockReturnValue( {
				type: 'angleDimensionText', isAngleDimensionText: true, layerId: 'ang1'
			} );
			mockCanvasManager.transformController.startAngleDimensionTextDrag = jest.fn();

			// Mock AngleDimensionRenderer for createAngleDimensionTextHandle
			global.window.Layers = { AngleDimensionRenderer: null };

			const event = { clientX: 100, clientY: 100, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.transformController.startAngleDimensionTextDrag ).toHaveBeenCalled();
		} );

		it( 'should start resize for generic handle hit', () => {
			mockCanvasManager.currentTool = 'pointer';
			mockCanvasManager.getSelectedLayerId.mockReturnValue( 'layer1' );
			mockCanvasManager.hitTestSelectionHandles.mockReturnValue( {
				type: 'corner', position: 'se'
			} );

			const event = { clientX: 100, clientY: 100, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.transformController.startResize ).toHaveBeenCalled();
		} );

		it( 'should advance angle dimension phase when in progress', () => {
			mockCanvasManager.currentTool = 'angleDimension';
			mockCanvasManager.drawingController = {
				isAngleDimensionInProgress: jest.fn( () => true )
			};

			const event = { clientX: 100, clientY: 100, button: 0 };
			canvasEvents.handleMouseDown( event );

			expect( mockCanvasManager.finishDrawing ).toHaveBeenCalled();
			expect( mockCanvasManager.startDrawing ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'handleMouseMove - transform controller paths', () => {
		it( 'should handle arrow tip drag', () => {
			mockCanvasManager.transformController.isArrowTipDragging = true;
			mockCanvasManager.transformController.dragStartPoint = { x: 0, y: 0 };
			mockCanvasManager.transformController.handleArrowTipDrag = jest.fn();

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.transformController.handleArrowTipDrag ).toHaveBeenCalledWith( { x: 150, y: 150 } );
		} );

		it( 'should handle dimension text drag', () => {
			mockCanvasManager.transformController.isDimensionTextDragging = true;
			mockCanvasManager.transformController.dragStartPoint = { x: 0, y: 0 };
			mockCanvasManager.transformController.handleDimensionTextDrag = jest.fn();

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.transformController.handleDimensionTextDrag ).toHaveBeenCalledWith( { x: 150, y: 150 } );
		} );

		it( 'should handle angle dimension text drag', () => {
			mockCanvasManager.transformController.isAngleDimensionTextDragging = true;
			mockCanvasManager.transformController.dragStartPoint = { x: 0, y: 0 };
			mockCanvasManager.transformController.handleAngleDimensionTextDrag = jest.fn();

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.transformController.handleAngleDimensionTextDrag ).toHaveBeenCalledWith( { x: 150, y: 150 } );
		} );

		it( 'should update angle dimension preview between clicks', () => {
			mockCanvasManager.currentTool = 'angleDimension';
			mockCanvasManager.isDrawing = false;
			mockCanvasManager.drawingController = {
				isAngleDimensionInProgress: jest.fn( () => true )
			};

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.continueDrawing ).toHaveBeenCalled();
		} );

		it( 'should not update preview when angle dimension not in progress', () => {
			mockCanvasManager.currentTool = 'angleDimension';
			mockCanvasManager.isDrawing = false;
			mockCanvasManager.drawingController = {
				isAngleDimensionInProgress: jest.fn( () => false )
			};

			const event = { clientX: 150, clientY: 150 };
			canvasEvents.handleMouseMove( event );

			expect( mockCanvasManager.continueDrawing ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'handleMouseUp - additional paths', () => {
		it( 'should finish arrow tip drag', () => {
			mockCanvasManager.transformController.isArrowTipDragging = true;
			mockCanvasManager.transformController.finishArrowTipDrag = jest.fn();

			const event = { clientX: 100, clientY: 100 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.transformController.finishArrowTipDrag ).toHaveBeenCalled();
		} );

		it( 'should finish dimension text drag', () => {
			mockCanvasManager.transformController.isDimensionTextDragging = true;
			mockCanvasManager.transformController.finishDimensionTextDrag = jest.fn();

			const event = { clientX: 100, clientY: 100 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.transformController.finishDimensionTextDrag ).toHaveBeenCalled();
		} );

		it( 'should finish angle dimension text drag', () => {
			mockCanvasManager.transformController.isAngleDimensionTextDragging = true;
			mockCanvasManager.transformController.finishAngleDimensionTextDrag = jest.fn();

			const event = { clientX: 100, clientY: 100 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.transformController.finishAngleDimensionTextDrag ).toHaveBeenCalled();
		} );

		it( 'should not finalize angle dimension when in progress', () => {
			mockCanvasManager.isDrawing = true;
			mockCanvasManager.currentTool = 'angleDimension';
			mockCanvasManager.drawingController = {
				isAngleDimensionInProgress: jest.fn( () => true )
			};

			const event = { clientX: 100, clientY: 100 };
			canvasEvents.handleMouseUp( event );

			expect( mockCanvasManager.finishDrawing ).not.toHaveBeenCalled();
		} );

		it( 'should not zoom when arrow tip dragging', () => {
			mockCanvasManager.transformController.isArrowTipDragging = true;
			const event = { deltaY: -100, preventDefault: jest.fn() };
			canvasEvents.handleWheel( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockCanvasManager.zoomBy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'isPointInDimensionTextArea', () => {
		it( 'should return false for zero-length dimension', () => {
			const layer = { x1: 100, y1: 100, x2: 100, y2: 100 };
			expect( canvasEvents.isPointInDimensionTextArea( { x: 100, y: 100 }, layer ) ).toBe( false );
		} );

		it( 'should detect point near text area of horizontal dimension', () => {
			const layer = {
				x1: 0, y1: 0, x2: 200, y2: 0,
				fontSize: 12, dimensionOffset: 20, textOffset: 0
			};
			// Text should be near (100, -20) — midpoint offset perpendicular
			expect( canvasEvents.isPointInDimensionTextArea( { x: 100, y: -20 }, layer ) ).toBe( true );
		} );

		it( 'should return false for point far from text', () => {
			const layer = {
				x1: 0, y1: 0, x2: 200, y2: 0,
				fontSize: 12, dimensionOffset: 20, textOffset: 0
			};
			expect( canvasEvents.isPointInDimensionTextArea( { x: 100, y: 100 }, layer ) ).toBe( false );
		} );

		it( 'should handle missing dimensionOffset using extensionLength fallback', () => {
			const layer = {
				x1: 0, y1: 0, x2: 200, y2: 0,
				fontSize: 12, extensionLength: 10, extensionGap: 3
			};
			// offsetDistance = extensionGap + extensionLength/2 = 3 + 5 = 8
			// Text near (100, -8)
			expect( canvasEvents.isPointInDimensionTextArea( { x: 100, y: -8 }, layer ) ).toBe( true );
		} );

		it( 'should account for textOffset along the line', () => {
			const layer = {
				x1: 0, y1: 0, x2: 200, y2: 0,
				fontSize: 12, dimensionOffset: 20, textOffset: 50
			};
			// Text position shifted along line by 50: (150, -20)
			expect( canvasEvents.isPointInDimensionTextArea( { x: 150, y: -20 }, layer ) ).toBe( true );
		} );

		it( 'should use default values for missing properties', () => {
			const layer = { x1: 0, y1: 0, x2: 200, y2: 0 };
			// Uses default extensionLength=10, extensionGap=3, fontSize=12, textOffset=0
			// Should not throw
			const result = canvasEvents.isPointInDimensionTextArea( { x: 100, y: -8 }, layer );
			expect( typeof result ).toBe( 'boolean' );
		} );
	} );

	describe( 'createDimensionOffsetHandle', () => {
		it( 'should create handle with correct properties', () => {
			const layer = { id: 'dim1', x1: 0, y1: 0, x2: 200, y2: 0 };
			const handle = canvasEvents.createDimensionOffsetHandle( layer );

			expect( handle.type ).toBe( 'dimensionOffset' );
			expect( handle.layerId ).toBe( 'dim1' );
			expect( handle.isDimensionOffset ).toBe( true );
			expect( handle.anchorMidX ).toBe( 100 );
			expect( handle.anchorMidY ).toBe( 0 );
			expect( typeof handle.perpX ).toBe( 'number' );
			expect( typeof handle.perpY ).toBe( 'number' );
		} );

		it( 'should handle diagonal dimension', () => {
			const layer = { id: 'dim2', x1: 0, y1: 0, x2: 100, y2: 100 };
			const handle = canvasEvents.createDimensionOffsetHandle( layer );

			expect( handle.anchorMidX ).toBe( 50 );
			expect( handle.anchorMidY ).toBe( 50 );
		} );

		it( 'should use defaults for missing coordinates', () => {
			const layer = { id: 'dim3' };
			const handle = canvasEvents.createDimensionOffsetHandle( layer );

			expect( handle.anchorMidX ).toBe( 0 );
			expect( handle.anchorMidY ).toBe( 0 );
		} );
	} );

	describe( 'createDimensionTextHandle', () => {
		it( 'should create handle with direction vectors for horizontal dimension', () => {
			const layer = { id: 'dim1', x1: 0, y1: 0, x2: 200, y2: 0 };
			const handle = canvasEvents.createDimensionTextHandle( layer );

			expect( handle.type ).toBe( 'dimensionText' );
			expect( handle.layerId ).toBe( 'dim1' );
			expect( handle.isDimensionText ).toBe( true );
			expect( handle.anchorMidX ).toBe( 100 );
			expect( handle.anchorMidY ).toBe( 0 );
			expect( handle.unitDx ).toBeCloseTo( 1, 5 );
			expect( handle.unitDy ).toBeCloseTo( 0, 5 );
			expect( handle.lineLength ).toBe( 200 );
		} );

		it( 'should handle zero-length dimension', () => {
			const layer = { id: 'dim1', x1: 50, y1: 50, x2: 50, y2: 50 };
			const handle = canvasEvents.createDimensionTextHandle( layer );

			// Fallback: unitDx=1, unitDy=0 when length is 0
			expect( handle.unitDx ).toBe( 1 );
			expect( handle.unitDy ).toBe( 0 );
			expect( handle.lineLength ).toBe( 0 );
		} );

		it( 'should compute correct vectors for diagonal dimension', () => {
			const layer = { id: 'dim1', x1: 0, y1: 0, x2: 100, y2: 100 };
			const handle = canvasEvents.createDimensionTextHandle( layer );

			const expectedLen = Math.sqrt( 20000 );
			expect( handle.lineLength ).toBeCloseTo( expectedLen, 1 );
			expect( handle.unitDx ).toBeCloseTo( 100 / expectedLen, 5 );
			expect( handle.unitDy ).toBeCloseTo( 100 / expectedLen, 5 );
		} );
	} );

	describe( 'isPointInAngleDimensionTextArea', () => {
		beforeEach( () => {
			// Mock AngleDimensionRenderer
			global.window.Layers = {
				AngleDimensionRenderer: class {
					constructor() {}
					calculateAngles() {
						return { startAngle: 0, sweepAngle: Math.PI / 2 };
					}
				}
			};
		} );

		it( 'should return false when AngleDimensionRenderer is not available', () => {
			global.window.Layers = {};
			const layer = { cx: 100, cy: 100, arcRadius: 40, fontSize: 12 };
			const result = canvasEvents.isPointInAngleDimensionTextArea( { x: 100, y: 100 }, layer );

			expect( result ).toBe( false );
		} );

		it( 'should detect point near text on arc', () => {
			const layer = { cx: 0, cy: 0, arcRadius: 40, fontSize: 12 };
			// Mid angle = 0 + (PI/2)/2 = PI/4 = 45 degrees
			// Text at (40*cos(PI/4), 40*sin(PI/4)) ≈ (28.28, 28.28)
			const result = canvasEvents.isPointInAngleDimensionTextArea( { x: 28, y: 28 }, layer );

			expect( result ).toBe( true );
		} );

		it( 'should return false for point far from text', () => {
			const layer = { cx: 0, cy: 0, arcRadius: 40, fontSize: 12 };
			const result = canvasEvents.isPointInAngleDimensionTextArea( { x: 200, y: 200 }, layer );

			expect( result ).toBe( false );
		} );

		it( 'should handle textPosition above', () => {
			const layer = { cx: 0, cy: 0, arcRadius: 40, fontSize: 12, textPosition: 'above' };
			// textRadius = arcRadius + fontSize * 0.8 = 40 + 9.6 = 49.6
			const midAngle = Math.PI / 4;
			const textX = 49.6 * Math.cos( midAngle );
			const textY = 49.6 * Math.sin( midAngle );

			const result = canvasEvents.isPointInAngleDimensionTextArea( { x: textX, y: textY }, layer );
			expect( result ).toBe( true );
		} );

		it( 'should handle textPosition below', () => {
			const layer = { cx: 0, cy: 0, arcRadius: 40, fontSize: 12, textPosition: 'below' };
			// textRadius = arcRadius - fontSize * 0.8 = 40 - 9.6 = 30.4
			const midAngle = Math.PI / 4;
			const textX = 30.4 * Math.cos( midAngle );
			const textY = 30.4 * Math.sin( midAngle );

			const result = canvasEvents.isPointInAngleDimensionTextArea( { x: textX, y: textY }, layer );
			expect( result ).toBe( true );
		} );

		it( 'should use default values for missing properties', () => {
			const layer = {}; // all defaults
			// cx=0, cy=0, arcRadius=40, fontSize=12
			const result = canvasEvents.isPointInAngleDimensionTextArea( { x: 200, y: 200 }, layer );
			expect( typeof result ).toBe( 'boolean' );
		} );
	} );

	describe( 'createAngleDimensionTextHandle', () => {
		beforeEach( () => {
			global.window.Layers = {
				AngleDimensionRenderer: class {
					constructor() {}
					calculateAngles() {
						return { startAngle: 0, sweepAngle: Math.PI / 2 };
					}
				}
			};
		} );

		it( 'should create handle with correct properties', () => {
			const layer = { id: 'ang1', cx: 50, cy: 60, arcRadius: 40 };
			const handle = canvasEvents.createAngleDimensionTextHandle( layer );

			expect( handle.type ).toBe( 'angleDimensionText' );
			expect( handle.layerId ).toBe( 'ang1' );
			expect( handle.isAngleDimensionText ).toBe( true );
			expect( handle.cx ).toBe( 50 );
			expect( handle.cy ).toBe( 60 );
			expect( handle.arcRadius ).toBe( 40 );
			expect( handle.midAngle ).toBeCloseTo( Math.PI / 4, 5 );
		} );

		it( 'should still compute midAngle via require fallback when window.Layers is empty', () => {
			global.window.Layers = {};
			const layer = { id: 'ang1', cx: 50, cy: 60, arcRadius: 40 };
			const handle = canvasEvents.createAngleDimensionTextHandle( layer );

			// require() fallback loads real AngleDimensionRenderer, so midAngle is computed
			expect( typeof handle.midAngle ).toBe( 'number' );
			expect( handle.type ).toBe( 'angleDimensionText' );
		} );

		it( 'should use default values for missing layer properties', () => {
			const layer = { id: 'ang1' };
			const handle = canvasEvents.createAngleDimensionTextHandle( layer );

			expect( handle.cx ).toBe( 0 );
			expect( handle.cy ).toBe( 0 );
			expect( handle.arcRadius ).toBe( 40 );
		} );
	} );

	describe( 'setup - container listener', () => {
		it( 'should attach container mousedown listener when container exists', () => {
			const container = document.createElement( 'div' );
			container.addEventListener = jest.fn();
			mockCanvasManager.container = container;

			const ce = new CanvasEvents( mockCanvasManager );

			expect( container.addEventListener ).toHaveBeenCalledWith(
				'mousedown', ce.onContainerMouseDown
			);
		} );

		it( 'should skip container listener when no container', () => {
			// Already tested implicitly in default setup (no container), but be explicit
			mockCanvasManager.container = null;
			expect( () => new CanvasEvents( mockCanvasManager ) ).not.toThrow();
		} );
	} );

	describe( 'destroy - container cleanup', () => {
		it( 'should remove container listener on destroy', () => {
			const container = document.createElement( 'div' );
			container.addEventListener = jest.fn();
			container.removeEventListener = jest.fn();
			mockCanvasManager.container = container;

			const ce = new CanvasEvents( mockCanvasManager );
			ce.destroy();

			expect( container.removeEventListener ).toHaveBeenCalledWith(
				'mousedown', ce.onContainerMouseDown
			);
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export CanvasEvents', () => {
			expect( CanvasEvents ).toBeDefined();
			expect( typeof CanvasEvents ).toBe( 'function' );
		} );
	} );
} );
