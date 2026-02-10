/**
 * ToolManager Test Suite
 * Tests for tool switching, drawing operations, and tool-specific behaviors.
 *
 * Note: Fallback behavior tests were removed in v1.5.55 (P2-010) because
 * all extracted modules (ToolRegistry, ToolStyles, ShapeFactory, TextToolHandler,
 * PathToolHandler) are always loaded via ResourceLoader dependencies.
 */

describe( 'ToolManager', () => {
	let ToolManager;
	let toolManager;
	let mockCanvasManager;
	let mockEditor;

	beforeEach( () => {
		// Create mock canvas element
		const mockCanvas = {
			getContext: jest.fn().mockReturnValue( {
				save: jest.fn(),
				restore: jest.fn(),
				beginPath: jest.fn(),
				moveTo: jest.fn(),
				lineTo: jest.fn(),
				stroke: jest.fn(),
				fill: jest.fn(),
				arc: jest.fn(),
				rect: jest.fn(),
				fillRect: jest.fn(),
				clearRect: jest.fn(),
				setTransform: jest.fn(),
				translate: jest.fn(),
				scale: jest.fn(),
				measureText: jest.fn().mockReturnValue( { width: 50 } ),
				fillText: jest.fn(),
				setLineDash: jest.fn()
			} ),
			width: 800,
			height: 600,
			style: {},
			getBoundingClientRect: jest.fn().mockReturnValue( {
				left: 0,
				top: 0,
				width: 800,
				height: 600
			} )
		};

		// Create mock editor
		mockEditor = {
			layers: [],
			addLayer: jest.fn( ( layer ) => {
				mockEditor.layers.push( layer );
				return layer;
			} ),
			saveState: jest.fn(),
			markDirty: jest.fn(),
			historyManager: {
				saveState: jest.fn()
			},
			stateManager: {
				get: jest.fn().mockReturnValue( [] ),
				set: jest.fn(),
				getLayers: jest.fn().mockReturnValue( [] ),
				addLayer: jest.fn()
			},
			getLayerById: jest.fn( ( id ) => mockEditor.layers.find( l => l.id === id ) )
		};

		// Create mock canvas manager
		mockCanvasManager = {
			canvas: mockCanvas,
			ctx: mockCanvas.getContext( '2d' ),
			editor: mockEditor,
			zoom: 1,
			panX: 0,
			panY: 0,
			renderLayers: jest.fn(),
			renderTempLayer: jest.fn(),
			drawLayer: jest.fn(),
			addLayer: jest.fn( ( layer ) => {
				layer.id = layer.id || 'layer_' + Date.now();
				mockEditor.layers.push( layer );
				return layer;
			} ),
			screenToCanvas: jest.fn( ( point ) => point ),
			getSelectedLayerIds: jest.fn().mockReturnValue( [] )
		};

		// Load ToolManager
		ToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );

		// Create instance
		toolManager = new ToolManager( {}, mockCanvasManager );
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default values', () => {
			expect( toolManager.currentTool ).toBe( 'pointer' );
			expect( toolManager.isDrawing ).toBe( false );
			expect( toolManager.startPoint ).toBeNull();
			expect( toolManager.tempLayer ).toBeNull();
		} );

		it( 'should accept config object', () => {
			const configTM = new ToolManager( { customOption: true }, mockCanvasManager );
			expect( configTM.config.customOption ).toBe( true );
		} );

		it( 'should handle null config', () => {
			const nullConfigTM = new ToolManager( null, mockCanvasManager );
			expect( nullConfigTM.config ).toEqual( {} );
		} );
	} );

	describe( 'setTool', () => {
		it( 'should change current tool', () => {
			toolManager.setTool( 'rectangle' );
			expect( toolManager.currentTool ).toBe( 'rectangle' );
		} );

		it( 'should update cursor on tool change', () => {
			toolManager.setTool( 'rectangle' );
			// Without ToolRegistry, cursor defaults to 'default'
			expect( mockCanvasManager.canvas.style.cursor ).toBe( 'default' );
		} );

		it( 'should finish current drawing before switching', () => {
			toolManager.isDrawing = true;
			toolManager.tempLayer = { type: 'rectangle' };
			toolManager.setTool( 'circle' );
			expect( toolManager.isDrawing ).toBe( false );
			expect( toolManager.tempLayer ).toBeNull();
		} );
	} );

	describe( 'getCurrentTool', () => {
		it( 'should return current tool', () => {
			expect( toolManager.getCurrentTool() ).toBe( 'pointer' );
			toolManager.setTool( 'pen' );
			expect( toolManager.getCurrentTool() ).toBe( 'pen' );
		} );
	} );

	describe( 'getToolCursor', () => {
		it( 'should return default cursor for pointer tool', () => {
			expect( toolManager.getToolCursor( 'pointer' ) ).toBe( 'default' );
		} );

		it( 'should return default cursor without ToolRegistry', () => {
			// Without ToolRegistry, all tools return 'default'
			expect( toolManager.getToolCursor( 'rectangle' ) ).toBe( 'default' );
			expect( toolManager.getToolCursor( 'text' ) ).toBe( 'default' );
			expect( toolManager.getToolCursor( 'pan' ) ).toBe( 'default' );
		} );

		it( 'should return default cursor for unknown tools', () => {
			expect( toolManager.getToolCursor( 'unknown' ) ).toBe( 'default' );
		} );

		it( 'should delegate to ToolRegistry when available', () => {
			toolManager.toolRegistry = {
				getCursor: jest.fn().mockReturnValue( 'crosshair' )
			};
			expect( toolManager.getToolCursor( 'rectangle' ) ).toBe( 'crosshair' );
			expect( toolManager.toolRegistry.getCursor ).toHaveBeenCalledWith( 'rectangle' );
		} );
	} );

	describe( 'startTool', () => {
		const point = { x: 100, y: 100 };

		it( 'should set isDrawing to true', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( point );
			expect( toolManager.isDrawing ).toBe( true );
		} );

		it( 'should save start point', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( point );
			expect( toolManager.startPoint ).toEqual( point );
		} );
	} );

	describe( 'updateTool', () => {
		it( 'should do nothing if not drawing', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.updateTool( { x: 200, y: 150 } );
			expect( toolManager.tempLayer ).toBeNull();
		} );
	} );

	describe( 'finishTool', () => {
		it( 'should do nothing if not drawing', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.finishTool( { x: 200, y: 150 } );
			expect( mockEditor.stateManager.addLayer ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'updateStyle', () => {
		it( 'should be a no-op without styleManager', () => {
			toolManager.styleManager = null;
			toolManager.updateStyle( { color: '#ff0000' } );
			// No error thrown, currentStyle unchanged
		} );

		it( 'should delegate to styleManager when available', () => {
			const mockStyleManager = {
				update: jest.fn(),
				get: jest.fn().mockReturnValue( { color: '#ff0000', strokeWidth: 5 } )
			};
			toolManager.styleManager = mockStyleManager;

			toolManager.updateStyle( { color: '#ff0000' } );

			expect( mockStyleManager.update ).toHaveBeenCalledWith( { color: '#ff0000' } );
			expect( mockStyleManager.get ).toHaveBeenCalled();
			expect( toolManager.currentStyle ).toEqual( { color: '#ff0000', strokeWidth: 5 } );
		} );
	} );

	describe( 'getStyle', () => {
		it( 'should create shallow copy when styleManager unavailable', () => {
			toolManager.styleManager = null;
			toolManager.currentStyle = { color: '#abcdef', strokeWidth: 4 };

			const result = toolManager.getStyle();

			expect( result ).toEqual( toolManager.currentStyle );
			// Ensure it's a copy, not the same reference
			expect( result ).not.toBe( toolManager.currentStyle );
		} );

		it( 'should delegate to styleManager when available', () => {
			const expectedStyle = { color: '#123456', strokeWidth: 3 };
			const mockStyleManager = {
				get: jest.fn().mockReturnValue( expectedStyle )
			};
			toolManager.styleManager = mockStyleManager;

			const result = toolManager.getStyle();

			expect( mockStyleManager.get ).toHaveBeenCalled();
			expect( result ).toEqual( expectedStyle );
		} );
	} );

	describe( 'finishCurrentDrawing', () => {
		it( 'should reset drawing state', () => {
			toolManager.isDrawing = true;
			toolManager.tempLayer = { type: 'rectangle' };
			toolManager.finishCurrentDrawing();
			expect( toolManager.isDrawing ).toBe( false );
			expect( toolManager.tempLayer ).toBeNull();
		} );

		it( 'should call pathToolHandler.reset when available', () => {
			const mockReset = jest.fn();
			toolManager.pathToolHandler = { reset: mockReset, destroy: jest.fn() };
			toolManager.isDrawing = true;
			toolManager.tempLayer = { type: 'path' };
			toolManager.finishCurrentDrawing();
			expect( mockReset ).toHaveBeenCalled();
		} );
	} );

	describe( 'initializeTool', () => {
		it( 'should call pathToolHandler.reset for path tool', () => {
			const mockReset = jest.fn();
			toolManager.pathToolHandler = { reset: mockReset };
			toolManager.initializeTool( 'path' );
			expect( mockReset ).toHaveBeenCalled();
		} );

		it( 'should call hideTextEditor for text tool', () => {
			const mockHide = jest.fn();
			toolManager.textToolHandler = { hideTextEditor: mockHide };
			toolManager.initializeTool( 'text' );
			expect( mockHide ).toHaveBeenCalled();
		} );

		it( 'should handle unknown tools gracefully', () => {
			expect( () => {
				toolManager.initializeTool( 'unknownTool' );
			} ).not.toThrow();
		} );
	} );

	describe( 'renderTempLayer', () => {
		it( 'should call renderLayers on canvasManager', () => {
			toolManager.renderTempLayer();
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should call drawLayer if tempLayer exists', () => {
			toolManager.tempLayer = { type: 'rectangle', width: 50, height: 50 };
			toolManager.renderTempLayer();

			expect( mockCanvasManager.drawLayer ).toHaveBeenCalledWith( toolManager.tempLayer );
		} );

		it( 'should not call drawLayer if tempLayer is null', () => {
			toolManager.tempLayer = null;
			toolManager.renderTempLayer();

			expect( mockCanvasManager.drawLayer ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'addLayerToCanvas', () => {
		beforeEach( () => {
			mockCanvasManager.selectionManager = {
				selectLayer: jest.fn()
			};
			mockCanvasManager.historyManager = {
				saveState: jest.fn()
			};
			mockEditor.markDirty = jest.fn();
			mockEditor.layerPanel = {
				updateLayers: jest.fn()
			};
		} );

		it( 'should generate unique ID for layer', () => {
			const layer = { type: 'rectangle', width: 50, height: 50 };
			toolManager.addLayerToCanvas( layer );

			expect( layer.id ).toBeDefined();
			expect( layer.id ).toMatch( /^layer_\d+_[a-z0-9]+$/ );
		} );

		it( 'should add layer via stateManager', () => {
			const layer = { type: 'rectangle', width: 50, height: 50 };
			toolManager.addLayerToCanvas( layer );

			expect( mockEditor.stateManager.addLayer ).toHaveBeenCalledWith( layer );
		} );

		it( 'should select newly added layer', () => {
			const layer = { type: 'rectangle', width: 50, height: 50 };
			toolManager.addLayerToCanvas( layer );

			expect( mockCanvasManager.selectionManager.selectLayer ).toHaveBeenCalled();
		} );

		it( 'should save state for undo', () => {
			const layer = { type: 'rectangle', width: 50, height: 50 };
			toolManager.addLayerToCanvas( layer );

			expect( mockCanvasManager.historyManager.saveState ).toHaveBeenCalledWith( 'Add rectangle' );
		} );

		it( 'should mark editor as dirty', () => {
			const layer = { type: 'rectangle', width: 50, height: 50 };
			toolManager.addLayerToCanvas( layer );

			expect( mockEditor.markDirty ).toHaveBeenCalled();
		} );

		it( 'should update layer panel', () => {
			const layer = { type: 'rectangle', width: 50, height: 50 };
			toolManager.addLayerToCanvas( layer );

			expect( mockEditor.layerPanel.updateLayers ).toHaveBeenCalled();
		} );
	} );

	describe( 'hasValidSize', () => {
		it( 'should return true without shapeFactory', () => {
			toolManager.shapeFactory = null;
			expect( toolManager.hasValidSize( { type: 'rectangle', width: 0, height: 0 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'unknown' } ) ).toBe( true );
		} );

		it( 'should delegate to shapeFactory when available', () => {
			toolManager.shapeFactory = {
				hasValidSize: jest.fn().mockReturnValue( false )
			};
			const layer = { type: 'rectangle', width: 0, height: 0 };
			expect( toolManager.hasValidSize( layer ) ).toBe( false );
			expect( toolManager.shapeFactory.hasValidSize ).toHaveBeenCalledWith( layer );
		} );
	} );

	describe( 'getModifiers', () => {
		it( 'should extract modifier keys from event', () => {
			const event = {
				shiftKey: true,
				ctrlKey: false,
				altKey: true,
				metaKey: false
			};

			const modifiers = toolManager.getModifiers( event );

			expect( modifiers.shift ).toBe( true );
			expect( modifiers.ctrl ).toBe( false );
			expect( modifiers.alt ).toBe( true );
			expect( modifiers.meta ).toBe( false );
		} );
	} );

	describe( 'getToolDisplayName', () => {
		it( 'should use toolRegistry if available', () => {
			toolManager.toolRegistry = {
				getDisplayName: jest.fn().mockReturnValue( 'Custom Rectangle' )
			};

			const result = toolManager.getToolDisplayName( 'rectangle' );

			expect( toolManager.toolRegistry.getDisplayName ).toHaveBeenCalledWith( 'rectangle' );
			expect( result ).toBe( 'Custom Rectangle' );
		} );

		it( 'should fall back to layersMessages if toolRegistry not available', () => {
			toolManager.toolRegistry = null;
			window.layersMessages = {
				get: jest.fn().mockReturnValue( 'Rectangle Tool' )
			};

			const result = toolManager.getToolDisplayName( 'rectangle' );

			expect( window.layersMessages.get ).toHaveBeenCalledWith( 'layers-tool-rectangle', '' );
			expect( result ).toBe( 'Rectangle Tool' );

			delete window.layersMessages;
		} );

		it( 'should fall back to capitalized name if message is empty', () => {
			toolManager.toolRegistry = null;
			window.layersMessages = {
				get: jest.fn().mockReturnValue( '' )
			};

			const result = toolManager.getToolDisplayName( 'rectangle' );

			expect( result ).toBe( 'Rectangle' );

			delete window.layersMessages;
		} );

		it( 'should fall back to capitalized name if no i18n system', () => {
			toolManager.toolRegistry = null;
			delete window.layersMessages;

			const result = toolManager.getToolDisplayName( 'pointer' );

			expect( result ).toBe( 'Pointer' );
		} );

		it( 'should handle toolRegistry without getDisplayName method', () => {
			toolManager.toolRegistry = {};

			const result = toolManager.getToolDisplayName( 'circle' );

			expect( result ).toBe( 'Circle' );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all resources', () => {
			toolManager.tempLayer = { type: 'rectangle' };
			toolManager.startPoint = { x: 0, y: 0 };
			toolManager.currentStyle = { fill: '#000' };
			toolManager.toolRegistry = { tools: [] };
			toolManager.styleManager = { get: jest.fn() };
			toolManager.shapeFactory = { create: jest.fn() };

			toolManager.destroy();

			expect( toolManager.tempLayer ).toBeNull();
			expect( toolManager.startPoint ).toBeNull();
			expect( toolManager.currentStyle ).toBeNull();
			expect( toolManager.toolRegistry ).toBeNull();
			expect( toolManager.styleManager ).toBeNull();
			expect( toolManager.shapeFactory ).toBeNull();
			expect( toolManager.canvasManager ).toBeNull();
			expect( toolManager.config ).toBeNull();
		} );

		it( 'should handle missing text editor gracefully', () => {
			expect( () => toolManager.destroy() ).not.toThrow();
		} );

		it( 'should finish active drawing before cleanup', () => {
			toolManager.finishCurrentDrawing = jest.fn();
			toolManager.isDrawing = true;

			toolManager.destroy();

			expect( toolManager.finishCurrentDrawing ).toHaveBeenCalled();
		} );
	} );

	describe( 'destroy with handlers', () => {
		it( 'should destroy textToolHandler if present', () => {
			const mockHandler = {
				destroy: jest.fn(),
				hideTextEditor: jest.fn()
			};
			toolManager.textToolHandler = mockHandler;

			toolManager.destroy();

			expect( mockHandler.destroy ).toHaveBeenCalled();
			expect( toolManager.textToolHandler ).toBeNull();
		} );

		it( 'should destroy pathToolHandler if present', () => {
			const mockHandler = { destroy: jest.fn() };
			toolManager.pathToolHandler = mockHandler;

			toolManager.destroy();

			expect( mockHandler.destroy ).toHaveBeenCalled();
			expect( toolManager.pathToolHandler ).toBeNull();
		} );
	} );

	describe( 'screen reader announcer integration', () => {
		it( 'should announce tool change via layersAnnouncer', () => {
			const mockAnnouncer = {
				announceTool: jest.fn()
			};
			window.layersAnnouncer = mockAnnouncer;

			toolManager.setTool( 'rectangle' );

			expect( mockAnnouncer.announceTool ).toHaveBeenCalledWith( 'Rectangle' );

			delete window.layersAnnouncer;
		} );

		it( 'should handle missing announcer gracefully', () => {
			delete window.layersAnnouncer;

			expect( () => toolManager.setTool( 'rectangle' ) ).not.toThrow();
		} );
	} );

	describe( 'handlePathPoint with PathToolHandler', () => {
		it( 'should delegate to pathToolHandler when available', () => {
			const mockHandler = {
				handlePoint: jest.fn().mockReturnValue( false )
			};
			toolManager.pathToolHandler = mockHandler;

			toolManager.handlePathPoint( { x: 100, y: 100 } );

			expect( mockHandler.handlePoint ).toHaveBeenCalledWith( { x: 100, y: 100 } );
			expect( toolManager.isDrawing ).toBe( true );
		} );

		it( 'should set isDrawing false when pathToolHandler returns completed', () => {
			const mockHandler = {
				handlePoint: jest.fn().mockReturnValue( true )
			};
			toolManager.pathToolHandler = mockHandler;

			toolManager.handlePathPoint( { x: 100, y: 100 } );

			expect( toolManager.isDrawing ).toBe( false );
		} );
	} );

	describe( 'completePath with PathToolHandler', () => {
		it( 'should delegate to pathToolHandler when available', () => {
			const mockHandler = {
				complete: jest.fn()
			};
			toolManager.pathToolHandler = mockHandler;
			toolManager.isDrawing = true;

			toolManager.completePath();

			expect( mockHandler.complete ).toHaveBeenCalled();
			expect( toolManager.isDrawing ).toBe( false );
		} );
	} );

	describe( 'renderPathPreview', () => {
		it( 'should delegate to pathToolHandler when available', () => {
			const mockHandler = {
				renderPreview: jest.fn()
			};
			toolManager.pathToolHandler = mockHandler;

			toolManager.renderPathPreview();

			expect( mockHandler.renderPreview ).toHaveBeenCalled();
		} );

		it( 'should be a no-op without pathToolHandler', () => {
			toolManager.pathToolHandler = null;
			expect( () => toolManager.renderPathPreview() ).not.toThrow();
		} );
	} );

	describe( 'showTextEditor with TextToolHandler', () => {
		it( 'should delegate to textToolHandler when available', () => {
			const mockHandler = {
				showTextEditor: jest.fn()
			};
			toolManager.textToolHandler = mockHandler;

			toolManager.showTextEditor( { x: 50, y: 50 } );

			expect( mockHandler.showTextEditor ).toHaveBeenCalledWith( { x: 50, y: 50 } );
		} );
	} );

	describe( 'hideTextEditor', () => {
		it( 'should delegate to textToolHandler when available', () => {
			const mockHandler = {
				hideTextEditor: jest.fn()
			};
			toolManager.textToolHandler = mockHandler;

			toolManager.hideTextEditor();

			expect( mockHandler.hideTextEditor ).toHaveBeenCalled();
		} );

		it( 'should be a no-op without textToolHandler', () => {
			toolManager.textToolHandler = null;
			expect( () => toolManager.hideTextEditor() ).not.toThrow();
		} );
	} );

	describe( 'finishTextEditing', () => {
		it( 'should delegate to textToolHandler when available', () => {
			const mockHandler = {
				finishTextEditing: jest.fn()
			};
			toolManager.textToolHandler = mockHandler;

			const input = document.createElement( 'input' );
			const point = { x: 100, y: 100 };
			toolManager.finishTextEditing( input, point );

			expect( mockHandler.finishTextEditing ).toHaveBeenCalledWith( input, point );
		} );

		it( 'should be a no-op without textToolHandler', () => {
			toolManager.textToolHandler = null;
			expect( () => toolManager.finishTextEditing( {}, { x: 0, y: 0 } ) ).not.toThrow();
		} );
	} );

	describe( 'startTool with text', () => {
		it( 'should delegate text tool to textToolHandler when available', () => {
			toolManager.textToolHandler = {
				startTextInput: jest.fn(),
				hideTextEditor: jest.fn(),
				start: jest.fn()
			};

			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( toolManager.textToolHandler.start ).toHaveBeenCalledWith( { x: 100, y: 100 } );
		} );
	} );

	describe( 'startTool with path', () => {
		it( 'should delegate path tool to pathToolHandler when available', () => {
			toolManager.pathToolHandler = {
				handlePoint: jest.fn().mockReturnValue( false ),
				reset: jest.fn()
			};
			toolManager.setTool( 'path' );

			toolManager.handlePathPoint( { x: 100, y: 100 } );

			expect( toolManager.pathToolHandler.handlePoint ).toHaveBeenCalled();
		} );

		it( 'should set isDrawing based on pathToolHandler result', () => {
			toolManager.pathToolHandler = {
				handlePoint: jest.fn().mockReturnValue( true ),
				reset: jest.fn()
			};
			toolManager.setTool( 'path' );
			toolManager.isDrawing = true;

			toolManager.handlePathPoint( { x: 100, y: 100 } );

			expect( toolManager.isDrawing ).toBe( false );
		} );
	} );

	describe( 'updateTool when not drawing', () => {
		it( 'should return early when isDrawing is false', () => {
			toolManager.isDrawing = false;
			toolManager.setTool( 'rectangle' );

			expect( () => toolManager.updateTool( { x: 100, y: 100 } ) ).not.toThrow();
		} );
	} );

	describe( 'finishTool when not drawing', () => {
		it( 'should return early when isDrawing is false', () => {
			toolManager.isDrawing = false;
			toolManager.setTool( 'rectangle' );

			expect( () => toolManager.finishTool( { x: 100, y: 100 } ) ).not.toThrow();
		} );
	} );

	describe( 'getToolDisplayName fallback', () => {
		it( 'should use ToolRegistry when available', () => {
			toolManager.toolRegistry = {
				getDisplayName: jest.fn().mockReturnValue( 'Rectangle Tool' )
			};

			const name = toolManager.getToolDisplayName( 'rectangle' );

			expect( name ).toBe( 'Rectangle Tool' );
		} );

		it( 'should use i18n fallback when ToolRegistry unavailable', () => {
			toolManager.toolRegistry = null;
			window.layersMessages = {
				get: jest.fn().mockReturnValue( 'Rect' )
			};

			const name = toolManager.getToolDisplayName( 'rectangle' );

			expect( name ).toBe( 'Rect' );

			delete window.layersMessages;
		} );

		it( 'should use capitalized fallback when no ToolRegistry or i18n', () => {
			toolManager.toolRegistry = null;
			delete window.layersMessages;

			const name = toolManager.getToolDisplayName( 'rectangle' );

			expect( name ).toBe( 'Rectangle' );
		} );
	} );

	describe( 'ShapeFactory delegation', () => {
		it( 'should use shapeFactory.createRectangle when available', () => {
			const mockRect = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };
			toolManager.shapeFactory = {
				createRectangle: jest.fn().mockReturnValue( mockRect )
			};

			toolManager.startRectangleTool( { x: 50, y: 50 } );

			expect( toolManager.shapeFactory.createRectangle ).toHaveBeenCalledWith( { x: 50, y: 50 } );
			expect( toolManager.tempLayer ).toBe( mockRect );
		} );

		it( 'should use shapeFactory.createPath when available', () => {
			const mockPath = { type: 'path', points: [{ x: 10, y: 20 }] };
			toolManager.shapeFactory = {
				createPath: jest.fn().mockReturnValue( mockPath )
			};

			toolManager.startPenDrawing( { x: 10, y: 20 } );

			expect( toolManager.shapeFactory.createPath ).toHaveBeenCalledWith( { x: 10, y: 20 } );
			expect( toolManager.tempLayer ).toBe( mockPath );
		} );

		it( 'should use shapeFactory.createEllipse when available', () => {
			const mockEllipse = { type: 'ellipse', x: 30, y: 40 };
			toolManager.shapeFactory = {
				createEllipse: jest.fn().mockReturnValue( mockEllipse )
			};

			toolManager.startEllipseTool( { x: 30, y: 40 } );

			expect( toolManager.shapeFactory.createEllipse ).toHaveBeenCalledWith( { x: 30, y: 40 } );
			expect( toolManager.tempLayer ).toBe( mockEllipse );
		} );

		it( 'should use shapeFactory.createCircle when available', () => {
			const mockCircle = { type: 'circle', x: 50, y: 60 };
			toolManager.shapeFactory = {
				createCircle: jest.fn().mockReturnValue( mockCircle )
			};

			toolManager.startCircleTool( { x: 50, y: 60 } );

			expect( toolManager.shapeFactory.createCircle ).toHaveBeenCalledWith( { x: 50, y: 60 } );
			expect( toolManager.tempLayer ).toBe( mockCircle );
		} );

		it( 'should use shapeFactory.createLine when available', () => {
			const mockLine = { type: 'line', x1: 10, y1: 20 };
			toolManager.shapeFactory = {
				createLine: jest.fn().mockReturnValue( mockLine )
			};

			toolManager.startLineTool( { x: 10, y: 20 } );

			expect( toolManager.shapeFactory.createLine ).toHaveBeenCalledWith( { x: 10, y: 20 } );
			expect( toolManager.tempLayer ).toBe( mockLine );
		} );

		it( 'should use shapeFactory.createArrow when available', () => {
			const mockArrow = { type: 'arrow', x1: 10, y1: 20 };
			toolManager.shapeFactory = {
				createArrow: jest.fn().mockReturnValue( mockArrow )
			};

			toolManager.startArrowTool( { x: 10, y: 20 } );

			expect( toolManager.shapeFactory.createArrow ).toHaveBeenCalledWith( { x: 10, y: 20 } );
			expect( toolManager.tempLayer ).toBe( mockArrow );
		} );

		it( 'should use shapeFactory.createPolygon when available', () => {
			const mockPoly = { type: 'polygon', x: 10, y: 20 };
			toolManager.shapeFactory = {
				createPolygon: jest.fn().mockReturnValue( mockPoly )
			};

			toolManager.startPolygonTool( { x: 10, y: 20 } );

			expect( toolManager.shapeFactory.createPolygon ).toHaveBeenCalledWith( { x: 10, y: 20 } );
			expect( toolManager.tempLayer ).toBe( mockPoly );
		} );

		it( 'should use shapeFactory.createStar when available', () => {
			const mockStar = { type: 'star', x: 10, y: 20 };
			toolManager.shapeFactory = {
				createStar: jest.fn().mockReturnValue( mockStar )
			};

			toolManager.startStarTool( { x: 10, y: 20 } );

			expect( toolManager.shapeFactory.createStar ).toHaveBeenCalledWith( { x: 10, y: 20 } );
			expect( toolManager.tempLayer ).toBe( mockStar );
		} );

		it( 'should use shapeFactory.createTextBox when available', () => {
			const mockTextBox = { type: 'textbox', x: 10, y: 20 };
			toolManager.shapeFactory = {
				createTextBox: jest.fn().mockReturnValue( mockTextBox )
			};

			toolManager.startTextBoxTool( { x: 10, y: 20 } );

			expect( toolManager.shapeFactory.createTextBox ).toHaveBeenCalledWith( { x: 10, y: 20 } );
			expect( toolManager.tempLayer ).toBe( mockTextBox );
		} );
	} );

	describe( 'initialization with modules', () => {
		it( 'should use ToolStyles when available', () => {
			jest.resetModules();

			const MockToolStyles = function() {
				this.currentStyle = {
					color: '#ff0000',
					strokeWidth: 5,
					fontSize: 20,
					fontFamily: 'Verdana',
					fill: '#0000ff'
				};
			};

			const originalToolStyles = window.ToolStyles;
			window.ToolStyles = MockToolStyles;

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.styleManager ).not.toBeNull();
			expect( tm.styleManager ).toBeInstanceOf( MockToolStyles );
			expect( tm.currentStyle ).toBe( tm.styleManager.currentStyle );

			window.ToolStyles = originalToolStyles;
		} );

		it( 'should use ShapeFactory when available', () => {
			jest.resetModules();

			const MockShapeFactory = function( config ) {
				this.config = config;
			};

			const originalLayers = window.Layers;
			window.Layers = {
				...( window.Layers || {} ),
				Tools: {
					...( window.Layers && window.Layers.Tools || {} ),
					ShapeFactory: MockShapeFactory
				}
			};

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.shapeFactory ).not.toBeNull();
			expect( tm.shapeFactory ).toBeInstanceOf( MockShapeFactory );

			window.Layers = originalLayers;
		} );

		it( 'should use ToolRegistry when available', () => {
			jest.resetModules();

			const mockRegistry = { getTool: jest.fn() };
			const originalLayers = window.Layers;
			window.Layers = {
				Tools: {
					registry: mockRegistry
				}
			};

			const originalToolRegistry = window.ToolRegistry;
			window.ToolRegistry = { someProp: true };

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.toolRegistry ).toBe( mockRegistry );

			window.Layers = originalLayers;
			window.ToolRegistry = originalToolRegistry;
		} );

		it( 'should use TextToolHandler when available', () => {
			jest.resetModules();

			const MockTextToolHandler = function( config ) {
				this.config = config;
			};

			const originalLayers = window.Layers;
			window.Layers = {
				Tools: {
					TextToolHandler: MockTextToolHandler
				}
			};

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.textToolHandler ).not.toBeNull();
			expect( tm.textToolHandler ).toBeInstanceOf( MockTextToolHandler );

			window.Layers = originalLayers;
		} );

		it( 'should use PathToolHandler when available', () => {
			jest.resetModules();

			const MockPathToolHandler = function( config ) {
				this.config = config;
			};

			const originalLayers = window.Layers;
			window.Layers = {
				Tools: {
					PathToolHandler: MockPathToolHandler
				}
			};

			const localMockCanvasManager = {
				canvas: { width: 100, height: 100 },
				ctx: {},
				editor: {
					stateManager: {
						getLayers: jest.fn().mockReturnValue( [] )
					},
					layers: []
				},
				renderLayers: jest.fn()
			};

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, localMockCanvasManager );

			expect( tm.pathToolHandler ).not.toBeNull();
			expect( tm.pathToolHandler ).toBeInstanceOf( MockPathToolHandler );

			window.Layers = originalLayers;
		} );
	} );

	describe( 'handler null fallbacks', () => {
		it( 'should handle missing TextToolHandler', () => {
			jest.resetModules();

			const originalLayers = window.Layers;
			window.Layers = { Tools: {} };

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.textToolHandler ).toBeFalsy();

			window.Layers = originalLayers;
		} );

		it( 'should handle missing PathToolHandler', () => {
			jest.resetModules();

			const originalLayers = window.Layers;
			window.Layers = { Tools: {} };

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.pathToolHandler ).toBeFalsy();

			window.Layers = originalLayers;
		} );
	} );

	describe( 'layersAnnouncer integration', () => {
		it( 'should announce tool change when layersAnnouncer is available', () => {
			const mockAnnouncer = { announceTool: jest.fn() };
			window.layersAnnouncer = mockAnnouncer;

			toolManager.setTool( 'rectangle' );

			expect( mockAnnouncer.announceTool ).toHaveBeenCalled();

			delete window.layersAnnouncer;
		} );

		it( 'should not throw when layersAnnouncer is not available', () => {
			delete window.layersAnnouncer;

			expect( () => toolManager.setTool( 'circle' ) ).not.toThrow();
		} );
	} );
} );
