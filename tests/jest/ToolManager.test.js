/**
 * ToolManager Test Suite
 * Tests for tool switching, drawing operations, and tool-specific behaviors
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

		it( 'should initialize default style', () => {
			expect( toolManager.currentStyle ).toEqual( {
				color: '#000000',
				strokeWidth: 2,
				fontSize: 16,
				fontFamily: 'Arial, sans-serif',
				fill: 'transparent',
				arrowStyle: 'single',
				shadow: false,
				shadowColor: '#000000',
				shadowBlur: 8,
				shadowOffsetX: 2,
				shadowOffsetY: 2
			} );
		} );

		it( 'should initialize path state', () => {
			expect( toolManager.pathPoints ).toEqual( [] );
			expect( toolManager.isPathComplete ).toBe( false );
		} );

		it( 'should initialize text editing state', () => {
			expect( toolManager.textEditor ).toBeNull();
			expect( toolManager.editingTextLayer ).toBeNull();
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
			expect( mockCanvasManager.canvas.style.cursor ).toBe( 'crosshair' );
		} );

		it( 'should finish current drawing before switching', () => {
			toolManager.isDrawing = true;
			toolManager.tempLayer = { type: 'rectangle' };
			toolManager.setTool( 'circle' );
			expect( toolManager.isDrawing ).toBe( false );
			expect( toolManager.tempLayer ).toBeNull();
		} );

		it( 'should reset path points when switching to path tool', () => {
			toolManager.pathPoints = [ { x: 10, y: 10 } ];
			toolManager.setTool( 'path' );
			expect( toolManager.pathPoints ).toEqual( [] );
			expect( toolManager.isPathComplete ).toBe( false );
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

		it( 'should return crosshair for drawing tools', () => {
			const drawingTools = [ 'pen', 'rectangle', 'circle', 'ellipse', 'line', 'arrow', 'path' ];
			drawingTools.forEach( tool => {
				expect( toolManager.getToolCursor( tool ) ).toBe( 'crosshair' );
			} );
		} );

		it( 'should return text cursor for text tool', () => {
			expect( toolManager.getToolCursor( 'text' ) ).toBe( 'text' );
		} );

		it( 'should return grab cursor for pan tool', () => {
			expect( toolManager.getToolCursor( 'pan' ) ).toBe( 'grab' );
		} );

		it( 'should return default cursor for unknown tools', () => {
			expect( toolManager.getToolCursor( 'unknown' ) ).toBe( 'default' );
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

		it( 'should create temp layer for rectangle tool', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( point );
			expect( toolManager.tempLayer ).not.toBeNull();
			expect( toolManager.tempLayer.type ).toBe( 'rectangle' );
			expect( toolManager.tempLayer.x ).toBe( 100 );
			expect( toolManager.tempLayer.y ).toBe( 100 );
		} );

		it( 'should create temp layer for circle tool', () => {
			toolManager.setTool( 'circle' );
			toolManager.startTool( point );
			expect( toolManager.tempLayer.type ).toBe( 'circle' );
		} );

		it( 'should create temp layer for ellipse tool', () => {
			toolManager.setTool( 'ellipse' );
			toolManager.startTool( point );
			expect( toolManager.tempLayer.type ).toBe( 'ellipse' );
		} );

		it( 'should create temp layer for line tool', () => {
			toolManager.setTool( 'line' );
			toolManager.startTool( point );
			expect( toolManager.tempLayer.type ).toBe( 'line' );
		} );

		it( 'should create temp layer for arrow tool', () => {
			toolManager.setTool( 'arrow' );
			toolManager.startTool( point );
			expect( toolManager.tempLayer.type ).toBe( 'arrow' );
		} );

		it( 'should create temp layer for pen tool with path', () => {
			toolManager.setTool( 'pen' );
			toolManager.startTool( point );
			expect( toolManager.tempLayer.type ).toBe( 'path' );
			expect( toolManager.tempLayer.points ).toHaveLength( 1 );
		} );

		it( 'should apply current style to temp layer', () => {
			toolManager.updateStyle( { color: '#ff0000', strokeWidth: 5 } );
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( point );
			expect( toolManager.tempLayer.stroke ).toBe( '#ff0000' );
			expect( toolManager.tempLayer.strokeWidth ).toBe( 5 );
		} );

		it( 'should apply shadow properties to temp layer', () => {
			toolManager.updateStyle( { shadow: true, shadowColor: '#333333' } );
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( point );
			expect( toolManager.tempLayer.shadow ).toBe( true );
			expect( toolManager.tempLayer.shadowColor ).toBe( '#333333' );
		} );
	} );

	describe( 'updateTool', () => {
		const startPoint = { x: 100, y: 100 };
		const updatePoint = { x: 200, y: 150 };

		it( 'should do nothing if not drawing', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.updateTool( updatePoint );
			expect( toolManager.tempLayer ).toBeNull();
		} );

		it( 'should update rectangle dimensions', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( updatePoint );
			expect( toolManager.tempLayer.width ).toBe( 100 );
			expect( toolManager.tempLayer.height ).toBe( 50 );
		} );

		it( 'should handle negative rectangle dimensions', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( { x: 200, y: 150 } );
			toolManager.updateTool( { x: 100, y: 100 } );
			// Width and height should be positive
			expect( toolManager.tempLayer.width ).toBe( 100 );
			expect( toolManager.tempLayer.height ).toBe( 50 );
		} );

		it( 'should update circle radius', () => {
			toolManager.setTool( 'circle' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( updatePoint );
			expect( toolManager.tempLayer.radius ).toBeGreaterThan( 0 );
		} );

		it( 'should update ellipse radii', () => {
			toolManager.setTool( 'ellipse' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( updatePoint );
			// Ellipse uses half distance as radii, with center at midpoint
			expect( toolManager.tempLayer.radiusX ).toBe( 50 ); // |200 - 100| / 2
			expect( toolManager.tempLayer.radiusY ).toBe( 25 );  // |150 - 100| / 2
			expect( toolManager.tempLayer.x ).toBe( 150 ); // midpoint x
			expect( toolManager.tempLayer.y ).toBe( 125 ); // midpoint y
		} );

		it( 'should update line endpoint', () => {
			toolManager.setTool( 'line' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( updatePoint );
			expect( toolManager.tempLayer.x2 ).toBe( 200 );
			expect( toolManager.tempLayer.y2 ).toBe( 150 );
		} );

		it( 'should add points to pen path', () => {
			toolManager.setTool( 'pen' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( updatePoint );
			expect( toolManager.tempLayer.points ).toHaveLength( 2 );
		} );

		it( 'should call renderTempLayer after update', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( updatePoint );
			// renderTempLayer should have been called
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
		} );
	} );

	describe( 'finishTool', () => {
		const startPoint = { x: 100, y: 100 };
		const endPoint = { x: 200, y: 150 };

		it( 'should do nothing if not drawing', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.finishTool( endPoint );
			expect( mockEditor.stateManager.addLayer ).not.toHaveBeenCalled();
		} );

		it( 'should add rectangle layer via stateManager', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( endPoint );
			toolManager.finishTool( endPoint );
			expect( mockEditor.stateManager.addLayer ).toHaveBeenCalled();
		} );

		it( 'should reset drawing state after finish', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( endPoint );
			toolManager.finishTool( endPoint );
			expect( toolManager.isDrawing ).toBe( false );
			expect( toolManager.startPoint ).toBeNull();
		} );

		it( 'should not add layer if dimensions are zero', () => {
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( startPoint );
			// Don't update - dimensions will be 0
			toolManager.finishTool( startPoint );
			expect( mockEditor.stateManager.addLayer ).not.toHaveBeenCalled();
		} );

		it( 'should add pen path via stateManager if has enough points', () => {
			toolManager.setTool( 'pen' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( { x: 150, y: 120 } );
			toolManager.updateTool( endPoint );
			toolManager.finishTool( endPoint );
			expect( mockEditor.stateManager.addLayer ).toHaveBeenCalled();
		} );

		it( 'should not add pen path with only one point', () => {
			toolManager.setTool( 'pen' );
			toolManager.startTool( startPoint );
			// No update calls - only one point
			toolManager.finishTool( startPoint );
			expect( mockEditor.stateManager.addLayer ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'updateStyle', () => {
		it( 'should update color', () => {
			toolManager.updateStyle( { color: '#ff0000' } );
			expect( toolManager.currentStyle.color ).toBe( '#ff0000' );
		} );

		it( 'should update stroke width', () => {
			toolManager.updateStyle( { strokeWidth: 10 } );
			expect( toolManager.currentStyle.strokeWidth ).toBe( 10 );
		} );

		it( 'should update multiple properties', () => {
			toolManager.updateStyle( {
				color: '#00ff00',
				strokeWidth: 5,
				fontSize: 24
			} );
			expect( toolManager.currentStyle.color ).toBe( '#00ff00' );
			expect( toolManager.currentStyle.strokeWidth ).toBe( 5 );
			expect( toolManager.currentStyle.fontSize ).toBe( 24 );
		} );

		it( 'should update shadow properties', () => {
			toolManager.updateStyle( {
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 12
			} );
			expect( toolManager.currentStyle.shadow ).toBe( true );
			expect( toolManager.currentStyle.shadowBlur ).toBe( 12 );
		} );

		it( 'should preserve existing properties', () => {
			toolManager.updateStyle( { color: '#ff0000' } );
			expect( toolManager.currentStyle.strokeWidth ).toBe( 2 ); // Default value
		} );
	} );

	describe( 'getStyle', () => {
		it( 'should return copy of current style', () => {
			const style = toolManager.getStyle();
			expect( style ).toEqual( toolManager.currentStyle );
			// Verify it's a copy
			style.color = '#changed';
			expect( toolManager.currentStyle.color ).not.toBe( '#changed' );
		} );
	} );

	describe( 'finishCurrentDrawing', () => {
		it( 'should reset drawing state', () => {
			toolManager.isDrawing = true;
			toolManager.tempLayer = { type: 'rectangle' };
			toolManager.pathPoints = [ { x: 10, y: 10 } ];
			toolManager.finishCurrentDrawing();
			expect( toolManager.isDrawing ).toBe( false );
			expect( toolManager.tempLayer ).toBeNull();
			expect( toolManager.pathPoints ).toEqual( [] );
		} );

		it( 'should hide text editor by removing it', () => {
			// Create mock text editor element
			const mockTextEditor = document.createElement( 'div' );
			document.body.appendChild( mockTextEditor );
			toolManager.textEditor = mockTextEditor;

			toolManager.finishCurrentDrawing();
			expect( toolManager.textEditor ).toBeNull();
			// Element should be removed from DOM
			expect( document.body.contains( mockTextEditor ) ).toBe( false );
		} );
	} );

	describe( 'generateLayerId', () => {
		it( 'should generate unique IDs', () => {
			const id1 = toolManager.generateLayerId();
			const id2 = toolManager.generateLayerId();
			expect( id1 ).not.toBe( id2 );
		} );

		it( 'should start with layer_ prefix', () => {
			const id = toolManager.generateLayerId();
			expect( id.startsWith( 'layer_' ) ).toBe( true );
		} );

		it( 'should contain timestamp', () => {
			const before = Date.now();
			const id = toolManager.generateLayerId();
			const after = Date.now();
			// Extract timestamp from ID (format: layer_<timestamp>_<random>)
			const timestamp = parseInt( id.split( '_' )[ 1 ], 10 );
			expect( timestamp ).toBeGreaterThanOrEqual( before );
			expect( timestamp ).toBeLessThanOrEqual( after );
		} );
	} );

	describe( 'polygon and star tools', () => {
		it( 'should handle polygon tool start', () => {
			toolManager.setTool( 'polygon' );
			toolManager.startTool( { x: 100, y: 100 } );
			expect( toolManager.tempLayer ).not.toBeNull();
			expect( toolManager.tempLayer.type ).toBe( 'polygon' );
		} );

		it( 'should handle star tool start', () => {
			toolManager.setTool( 'star' );
			toolManager.startTool( { x: 100, y: 100 } );
			expect( toolManager.tempLayer ).not.toBeNull();
			expect( toolManager.tempLayer.type ).toBe( 'star' );
		} );
	} );

	describe( 'initializeTool', () => {
		it( 'should reset path points for path tool', () => {
			toolManager.pathPoints = [ { x: 1, y: 1 }, { x: 2, y: 2 } ];
			toolManager.isPathComplete = true;
			toolManager.initializeTool( 'path' );
			expect( toolManager.pathPoints ).toEqual( [] );
			expect( toolManager.isPathComplete ).toBe( false );
		} );

		it( 'should hide text editor for text tool by removing it', () => {
			const mockTextEditor = document.createElement( 'div' );
			document.body.appendChild( mockTextEditor );
			toolManager.textEditor = mockTextEditor;

			toolManager.initializeTool( 'text' );
			expect( toolManager.textEditor ).toBeNull();
			expect( document.body.contains( mockTextEditor ) ).toBe( false );
		} );

		it( 'should handle unknown tools gracefully', () => {
			expect( () => {
				toolManager.initializeTool( 'unknownTool' );
			} ).not.toThrow();
		} );
	} );

	describe( 'updateCursor', () => {
		it( 'should update canvas cursor style', () => {
			toolManager.currentTool = 'text';
			toolManager.updateCursor();
			expect( mockCanvasManager.canvas.style.cursor ).toBe( 'text' );
		} );
	} );

	describe( 'startTextTool', () => {
		it( 'should create text editor input element', () => {
			// Set up container for text editor
			mockCanvasManager.container = document.createElement( 'div' );
			document.body.appendChild( mockCanvasManager.container );

			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( toolManager.textEditor ).not.toBeNull();
			expect( toolManager.textEditor.tagName ).toBe( 'INPUT' );

			// Cleanup
			document.body.removeChild( mockCanvasManager.container );
		} );

		it( 'should position text editor at click point', () => {
			mockCanvasManager.container = document.createElement( 'div' );
			document.body.appendChild( mockCanvasManager.container );

			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 150, y: 200 } );

			expect( toolManager.textEditor.style.left ).toBe( '150px' );
			expect( toolManager.textEditor.style.top ).toBe( '200px' );

			document.body.removeChild( mockCanvasManager.container );
		} );

		it( 'should apply current font style to text editor', () => {
			mockCanvasManager.container = document.createElement( 'div' );
			document.body.appendChild( mockCanvasManager.container );

			toolManager.updateStyle( { fontSize: 24, fontFamily: 'Georgia', color: '#ff0000' } );
			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( toolManager.textEditor.style.fontSize ).toBe( '24px' );
			expect( toolManager.textEditor.style.fontFamily ).toBe( 'Georgia' );
			expect( toolManager.textEditor.style.color ).toBe( 'rgb(255, 0, 0)' );

			document.body.removeChild( mockCanvasManager.container );
		} );

		it( 'should use mainContainer when available', () => {
			const mainContainer = document.createElement( 'div' );
			document.body.appendChild( mainContainer );

			mockCanvasManager.editor.ui = { mainContainer };
			mockCanvasManager.container = document.createElement( 'div' );

			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( mainContainer.contains( toolManager.textEditor ) ).toBe( true );

			document.body.removeChild( mainContainer );
		} );
	} );

	describe( 'finishTextEditing', () => {
		beforeEach( () => {
			mockCanvasManager.container = document.createElement( 'div' );
			document.body.appendChild( mockCanvasManager.container );
		} );

		afterEach( () => {
			if ( mockCanvasManager.container.parentNode ) {
				document.body.removeChild( mockCanvasManager.container );
			}
		} );

		it( 'should create text layer when input has text', () => {
			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 100, y: 100 } );

			const input = toolManager.textEditor;
			input.value = 'Hello World';

			toolManager.finishTextEditing( input, { x: 100, y: 100 } );

			expect( mockEditor.stateManager.addLayer ).toHaveBeenCalled();
			const addedLayer = mockEditor.stateManager.addLayer.mock.calls[ 0 ][ 0 ];
			expect( addedLayer.type ).toBe( 'text' );
			expect( addedLayer.text ).toBe( 'Hello World' );
		} );

		it( 'should not create layer for empty text', () => {
			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 100, y: 100 } );

			const input = toolManager.textEditor;
			input.value = '   '; // whitespace only

			toolManager.finishTextEditing( input, { x: 100, y: 100 } );

			expect( mockEditor.stateManager.addLayer ).not.toHaveBeenCalled();
		} );

		it( 'should hide text editor after finishing', () => {
			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 100, y: 100 } );

			const input = toolManager.textEditor;
			input.value = 'Test';

			toolManager.finishTextEditing( input, { x: 100, y: 100 } );

			expect( toolManager.textEditor ).toBeNull();
		} );
	} );

	describe( 'handlePathPoint', () => {
		it( 'should start new path on first click', () => {
			toolManager.setTool( 'path' );
			toolManager.handlePathPoint( { x: 100, y: 100 } );

			expect( toolManager.pathPoints ).toHaveLength( 1 );
			expect( toolManager.pathPoints[ 0 ] ).toEqual( { x: 100, y: 100 } );
			expect( toolManager.isDrawing ).toBe( true );
		} );

		it( 'should add points to existing path', () => {
			toolManager.setTool( 'path' );
			toolManager.handlePathPoint( { x: 100, y: 100 } );
			toolManager.handlePathPoint( { x: 200, y: 150 } );
			toolManager.handlePathPoint( { x: 250, y: 200 } );

			expect( toolManager.pathPoints ).toHaveLength( 3 );
		} );

		it( 'should complete path when clicking near start point', () => {
			toolManager.setTool( 'path' );
			toolManager.handlePathPoint( { x: 100, y: 100 } );
			toolManager.handlePathPoint( { x: 200, y: 150 } );
			toolManager.handlePathPoint( { x: 250, y: 200 } );

			// Click within 10px of start point to close
			toolManager.handlePathPoint( { x: 105, y: 105 } );

			expect( mockEditor.stateManager.addLayer ).toHaveBeenCalled();
			const addedLayer = mockEditor.stateManager.addLayer.mock.calls[ 0 ][ 0 ];
			expect( addedLayer.type ).toBe( 'path' );
			expect( addedLayer.closed ).toBe( true );
		} );

		it( 'should not complete path when clicking far from start', () => {
			toolManager.setTool( 'path' );
			toolManager.handlePathPoint( { x: 100, y: 100 } );
			toolManager.handlePathPoint( { x: 200, y: 150 } );
			toolManager.handlePathPoint( { x: 250, y: 200 } );
			toolManager.handlePathPoint( { x: 300, y: 250 } );

			expect( mockEditor.stateManager.addLayer ).not.toHaveBeenCalled();
			expect( toolManager.pathPoints ).toHaveLength( 4 );
		} );
	} );

	describe( 'completePath', () => {
		it( 'should create path layer with correct properties', () => {
			toolManager.pathPoints = [
				{ x: 100, y: 100 },
				{ x: 200, y: 100 },
				{ x: 150, y: 200 }
			];
			toolManager.updateStyle( { color: '#00ff00', strokeWidth: 3 } );

			toolManager.completePath();

			expect( mockEditor.stateManager.addLayer ).toHaveBeenCalled();
			const layer = mockEditor.stateManager.addLayer.mock.calls[ 0 ][ 0 ];
			expect( layer.type ).toBe( 'path' );
			expect( layer.points ).toHaveLength( 3 );
			expect( layer.stroke ).toBe( '#00ff00' );
			expect( layer.strokeWidth ).toBe( 3 );
		} );

		it( 'should reset path state after completion', () => {
			toolManager.pathPoints = [
				{ x: 100, y: 100 },
				{ x: 200, y: 100 },
				{ x: 150, y: 200 }
			];
			toolManager.isDrawing = true;
			toolManager.isPathComplete = true;

			toolManager.completePath();

			expect( toolManager.pathPoints ).toEqual( [] );
			expect( toolManager.isDrawing ).toBe( false );
			expect( toolManager.isPathComplete ).toBe( false );
		} );

		it( 'should not create layer if less than 3 points', () => {
			toolManager.pathPoints = [
				{ x: 100, y: 100 },
				{ x: 200, y: 100 }
			];

			toolManager.completePath();

			expect( mockEditor.stateManager.addLayer ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'updatePolygonTool', () => {
		it( 'should update polygon radius based on distance', () => {
			toolManager.setTool( 'polygon' );
			toolManager.startTool( { x: 100, y: 100 } );
			toolManager.updateTool( { x: 200, y: 100 } );

			expect( toolManager.tempLayer.radius ).toBe( 100 );
		} );

		it( 'should calculate radius using pythagorean theorem', () => {
			toolManager.setTool( 'polygon' );
			toolManager.startTool( { x: 100, y: 100 } );
			toolManager.updateTool( { x: 103, y: 104 } ); // 3-4-5 triangle

			expect( toolManager.tempLayer.radius ).toBe( 5 );
		} );
	} );

	describe( 'updateStarTool', () => {
		it( 'should update star radii based on distance', () => {
			toolManager.setTool( 'star' );
			toolManager.startTool( { x: 100, y: 100 } );
			toolManager.updateTool( { x: 200, y: 100 } );

			expect( toolManager.tempLayer.outerRadius ).toBe( 100 );
			expect( toolManager.tempLayer.innerRadius ).toBe( 40 ); // 0.4 ratio
		} );

		it( 'should set radius property equal to outerRadius', () => {
			toolManager.setTool( 'star' );
			toolManager.startTool( { x: 100, y: 100 } );
			toolManager.updateTool( { x: 200, y: 100 } );

			expect( toolManager.tempLayer.radius ).toBe( 100 );
		} );
	} );

	describe( 'hasValidSize', () => {
		it( 'should validate rectangle size', () => {
			expect( toolManager.hasValidSize( { type: 'rectangle', width: 10, height: 10 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'rectangle', width: 0, height: 10 } ) ).toBe( false );
			expect( toolManager.hasValidSize( { type: 'rectangle', width: 1, height: 1 } ) ).toBe( false );
		} );

		it( 'should validate textbox size', () => {
			expect( toolManager.hasValidSize( { type: 'textbox', width: 10, height: 10 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'textbox', width: 1, height: 1 } ) ).toBe( false );
		} );

		it( 'should validate circle radius', () => {
			expect( toolManager.hasValidSize( { type: 'circle', radius: 10 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'circle', radius: 0 } ) ).toBe( false );
		} );

		it( 'should validate ellipse radii', () => {
			expect( toolManager.hasValidSize( { type: 'ellipse', radiusX: 10, radiusY: 10 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'ellipse', radiusX: 0, radiusY: 10 } ) ).toBe( false );
		} );

		it( 'should validate line/arrow length', () => {
			expect( toolManager.hasValidSize( { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'arrow', x1: 0, y1: 0, x2: 10, y2: 0 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'line', x1: 0, y1: 0, x2: 0, y2: 0 } ) ).toBe( false );
		} );

		it( 'should validate polygon/star radius', () => {
			expect( toolManager.hasValidSize( { type: 'polygon', radius: 10 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'star', outerRadius: 10 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'polygon', radius: 0 } ) ).toBe( false );
		} );

		it( 'should validate path points', () => {
			expect( toolManager.hasValidSize( { type: 'path', points: [ {}, {} ] } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'path', points: [ {} ] } ) ).toBe( false );
			// When points is null, the expression "layer.points && layer.points.length > 1" returns null (falsy)
			expect( toolManager.hasValidSize( { type: 'path', points: null } ) ).toBeFalsy();
		} );

		it( 'should return true for unknown types', () => {
			expect( toolManager.hasValidSize( { type: 'unknown' } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'text' } ) ).toBe( true );
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

	describe( 'renderPathPreview', () => {
		it( 'should call renderLayers on canvasManager', () => {
			toolManager.renderPathPreview();
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should draw path when pathPoints has points', () => {
			toolManager.pathPoints = [
				{ x: 100, y: 100 },
				{ x: 200, y: 100 },
				{ x: 150, y: 200 }
			];
			toolManager.renderPathPreview();

			const ctx = mockCanvasManager.ctx;
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
			expect( ctx.lineTo ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should not draw when pathPoints is empty', () => {
			toolManager.pathPoints = [];
			mockCanvasManager.ctx.beginPath.mockClear();

			toolManager.renderPathPreview();

			// beginPath should only be called once from earlier setup
			expect( mockCanvasManager.ctx.beginPath ).not.toHaveBeenCalled();
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

		it( 'should use fallback when stateManager.addLayer is unavailable', () => {
			mockEditor.stateManager.addLayer = undefined;
			mockEditor.layers = [];

			const layer = { type: 'rectangle', width: 50, height: 50 };
			toolManager.addLayerToCanvas( layer );

			expect( mockEditor.layers ).toContain( layer );
		} );
	} );

	describe( 'text editor keyboard events', () => {
		beforeEach( () => {
			mockCanvasManager.container = document.createElement( 'div' );
			document.body.appendChild( mockCanvasManager.container );
		} );

		afterEach( () => {
			if ( mockCanvasManager.container.parentNode ) {
				document.body.removeChild( mockCanvasManager.container );
			}
		} );

		it( 'should finish editing on Enter key', () => {
			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 100, y: 100 } );

			const input = toolManager.textEditor;
			input.value = 'Test text';

			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			input.dispatchEvent( event );

			expect( mockEditor.stateManager.addLayer ).toHaveBeenCalled();
		} );

		it( 'should cancel editing on Escape key', () => {
			toolManager.setTool( 'text' );
			toolManager.startTool( { x: 100, y: 100 } );

			const input = toolManager.textEditor;
			input.value = 'Test text';

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			input.dispatchEvent( event );

			expect( mockEditor.stateManager.addLayer ).not.toHaveBeenCalled();
			expect( toolManager.textEditor ).toBeNull();
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
			// Set up some state
			toolManager.tempLayer = { type: 'rectangle' };
			toolManager.pathPoints = [ { x: 1, y: 1 } ];
			toolManager.startPoint = { x: 0, y: 0 };
			toolManager.currentStyle = { fill: '#000' };
			toolManager.toolRegistry = { tools: [] };
			toolManager.toolStyles = { rectangle: {} };
			toolManager.shapeFactory = { create: jest.fn() };

			// Call destroy
			toolManager.destroy();

			// Verify cleanup
			expect( toolManager.tempLayer ).toBeNull();
			expect( toolManager.pathPoints ).toEqual( [] );
			expect( toolManager.startPoint ).toBeNull();
			expect( toolManager.currentStyle ).toBeNull();
			expect( toolManager.toolRegistry ).toBeNull();
			expect( toolManager.toolStyles ).toBeNull();
			expect( toolManager.shapeFactory ).toBeNull();
			expect( toolManager.canvasManager ).toBeNull();
			expect( toolManager.config ).toBeNull();
		} );

		it( 'should remove text editor from DOM if present', () => {
			// Create mock text editor
			const mockTextEditor = document.createElement( 'textarea' );
			const mockParent = document.createElement( 'div' );
			mockParent.appendChild( mockTextEditor );

			toolManager.textEditor = mockTextEditor;
			toolManager.editingTextLayer = { id: 'text1' };

			// Call destroy
			toolManager.destroy();

			// Verify text editor cleanup
			expect( toolManager.textEditor ).toBeNull();
			expect( toolManager.editingTextLayer ).toBeNull();
			expect( mockParent.contains( mockTextEditor ) ).toBe( false );
		} );

		it( 'should handle missing text editor gracefully', () => {
			toolManager.textEditor = null;
			toolManager.editingTextLayer = null;

			// Should not throw
			expect( () => toolManager.destroy() ).not.toThrow();
		} );

		it( 'should finish active drawing before cleanup', () => {
			toolManager.finishCurrentDrawing = jest.fn();
			toolManager.isDrawing = true;

			toolManager.destroy();

			expect( toolManager.finishCurrentDrawing ).toHaveBeenCalled();
		} );
	} );

	describe( 'fallback initialization paths', () => {
		it( 'should use inline style management when ToolStyles is unavailable', () => {
			// Clear the module cache to test without ToolStyles
			jest.resetModules();

			// Mock the require to simulate ToolStyles being unavailable
			jest.doMock( '../../resources/ext.layers.editor/tools/ToolStyles.js', () => null );

			const ToolManagerFresh = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tmFallback = new ToolManagerFresh( {}, mockCanvasManager );

			// Should have initialized currentStyle with defaults
			expect( tmFallback.currentStyle ).toBeDefined();
			expect( tmFallback.currentStyle.color ).toBe( '#000000' );
			expect( tmFallback.currentStyle.strokeWidth ).toBe( 2 );
			expect( tmFallback.currentStyle.fontSize ).toBe( 16 );
		} );

		it( 'should handle null shapeFactory gracefully', () => {
			toolManager.shapeFactory = null;

			// Should use fallback rectangle creation
			toolManager.setTool( 'rectangle' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( toolManager.tempLayer ).toBeDefined();
			expect( toolManager.tempLayer.type ).toBe( 'rectangle' );
		} );

		it( 'should use fallback path creation when shapeFactory unavailable', () => {
			toolManager.shapeFactory = null;

			toolManager.setTool( 'pen' );
			toolManager.startTool( { x: 50, y: 50 } );

			expect( toolManager.tempLayer ).toBeDefined();
			expect( toolManager.tempLayer.type ).toBe( 'path' );
			expect( toolManager.tempLayer.points ).toHaveLength( 1 );
		} );

		it( 'should handle null toolRegistry for cursor', () => {
			toolManager.toolRegistry = null;

			const cursor = toolManager.getToolCursor( 'rectangle' );

			expect( cursor ).toBe( 'crosshair' );
		} );

		it( 'should handle toolRegistry without getCursor method', () => {
			toolManager.toolRegistry = { someOtherMethod: jest.fn() };

			const cursor = toolManager.getToolCursor( 'rectangle' );

			expect( cursor ).toBe( 'crosshair' );
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

			// Should not throw
			expect( () => toolManager.setTool( 'rectangle' ) ).not.toThrow();
		} );
	} );

	describe( 'textbox tool', () => {
		it( 'should create textbox layer with fallback when shapeFactory unavailable', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'textbox' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( toolManager.tempLayer ).toBeDefined();
			expect( toolManager.tempLayer.type ).toBe( 'textbox' );
			expect( toolManager.tempLayer.x ).toBe( 100 );
			expect( toolManager.tempLayer.y ).toBe( 100 );
		} );

		it( 'should update textbox dimensions like rectangle', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'textbox' );
			toolManager.startTool( { x: 100, y: 100 } );
			toolManager.updateTool( { x: 200, y: 150 } );

			expect( toolManager.tempLayer.width ).toBe( 100 );
			expect( toolManager.tempLayer.height ).toBe( 50 );
		} );

		it( 'should finish textbox and add layer', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'textbox' );
			toolManager.startTool( { x: 100, y: 100 } );
			toolManager.updateTool( { x: 200, y: 150 } );
			toolManager.finishTool( { x: 200, y: 150 } );

			// Should have added the layer
			expect( mockEditor.stateManager.addLayer ).toHaveBeenCalled();
		} );
	} );

	describe( 'ellipse tool', () => {
		it( 'should create ellipse with fallback when shapeFactory unavailable', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'ellipse' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( toolManager.tempLayer ).toBeDefined();
			expect( toolManager.tempLayer.type ).toBe( 'ellipse' );
		} );

		it( 'should update ellipse radii on drag', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'ellipse' );
			toolManager.startTool( { x: 100, y: 100 } );
			toolManager.updateTool( { x: 200, y: 180 } );

			expect( toolManager.tempLayer.radiusX ).toBe( 50 ); // half of 100
			expect( toolManager.tempLayer.radiusY ).toBe( 40 ); // half of 80
		} );
	} );

	describe( 'circle tool', () => {
		it( 'should create circle with fallback when shapeFactory unavailable', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'circle' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( toolManager.tempLayer ).toBeDefined();
			expect( toolManager.tempLayer.type ).toBe( 'circle' );
		} );
	} );

	describe( 'line tool', () => {
		it( 'should create line with fallback when shapeFactory unavailable', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'line' );
			toolManager.startTool( { x: 50, y: 50 } );

			expect( toolManager.tempLayer ).toBeDefined();
			expect( toolManager.tempLayer.type ).toBe( 'line' );
			expect( toolManager.tempLayer.x1 ).toBe( 50 );
			expect( toolManager.tempLayer.y1 ).toBe( 50 );
		} );

		it( 'should update line endpoint on drag', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'line' );
			toolManager.startTool( { x: 50, y: 50 } );
			toolManager.updateTool( { x: 150, y: 100 } );

			expect( toolManager.tempLayer.x2 ).toBe( 150 );
			expect( toolManager.tempLayer.y2 ).toBe( 100 );
		} );
	} );

	describe( 'arrow tool', () => {
		it( 'should create arrow with fallback when shapeFactory unavailable', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'arrow' );
			toolManager.startTool( { x: 50, y: 50 } );

			expect( toolManager.tempLayer ).toBeDefined();
			expect( toolManager.tempLayer.type ).toBe( 'arrow' );
			expect( toolManager.tempLayer.arrowStyle ).toBe( 'single' ); // fallback uses arrowStyle, not arrowhead
		} );
	} );

	describe( 'polygon tool fallback', () => {
		it( 'should create polygon with fallback when shapeFactory unavailable', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'polygon' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( toolManager.tempLayer ).toBeDefined();
			expect( toolManager.tempLayer.type ).toBe( 'polygon' );
			expect( toolManager.tempLayer.sides ).toBe( 6 );
		} );
	} );

	describe( 'star tool fallback', () => {
		it( 'should create star with fallback when shapeFactory unavailable', () => {
			toolManager.shapeFactory = null;
			toolManager.setTool( 'star' );
			toolManager.startTool( { x: 100, y: 100 } );

			expect( toolManager.tempLayer ).toBeDefined();
			expect( toolManager.tempLayer.type ).toBe( 'star' );
			expect( toolManager.tempLayer.points ).toBe( 5 );
		} );
	} );

	describe( 'updateStyle with toolStyles', () => {
		it( 'should delegate to toolStyles when available', () => {
			const mockToolStyles = {
				update: jest.fn(),
				get: jest.fn().mockReturnValue( { color: '#ff0000' } )
			};
			toolManager.toolStyles = mockToolStyles;

			toolManager.updateStyle( { color: '#ff0000' } );

			expect( mockToolStyles.update ).toHaveBeenCalledWith( { color: '#ff0000' } );
		} );

		it( 'should update currentStyle via toolStyles sync', () => {
			const newStyle = { color: '#00ff00', strokeWidth: 5 };
			const mockToolStyles = {
				update: jest.fn(),
				get: jest.fn().mockReturnValue( newStyle )
			};
			toolManager.toolStyles = mockToolStyles;

			toolManager.updateStyle( newStyle );

			// After update, currentStyle should be synced from toolStyles.get()
			expect( mockToolStyles.get ).toHaveBeenCalled();
		} );
	} );

	describe( 'getStyle with toolStyles', () => {
		it( 'should delegate to toolStyles when available', () => {
			const expectedStyle = { color: '#123456', strokeWidth: 3 };
			const mockToolStyles = {
				get: jest.fn().mockReturnValue( expectedStyle )
			};
			toolManager.toolStyles = mockToolStyles;

			const result = toolManager.getStyle();

			expect( mockToolStyles.get ).toHaveBeenCalled();
			expect( result ).toEqual( expectedStyle );
		} );
	} );

	describe( 'updateStyle fallback', () => {
		it( 'should use manual property assignment when styleManager unavailable', () => {
			toolManager.styleManager = null;
			toolManager.currentStyle = { color: '#000000', strokeWidth: 2 };

			toolManager.updateStyle( { color: '#ff0000', fontSize: 20 } );

			expect( toolManager.currentStyle.color ).toBe( '#ff0000' );
			expect( toolManager.currentStyle.fontSize ).toBe( 20 );
			expect( toolManager.currentStyle.strokeWidth ).toBe( 2 ); // preserved
		} );
	} );

	describe( 'getStyle fallback', () => {
		it( 'should create shallow copy when styleManager unavailable', () => {
			toolManager.styleManager = null;
			toolManager.currentStyle = { color: '#abcdef', strokeWidth: 4 };

			const result = toolManager.getStyle();

			expect( result ).toEqual( toolManager.currentStyle );
			// Ensure it's a copy, not the same reference
			expect( result ).not.toBe( toolManager.currentStyle );
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

	describe( 'destroy with inline textEditor', () => {
		it( 'should call remove on textEditor via hideTextEditor', () => {
			const mockTextEditor = {
				remove: jest.fn()
			};
			toolManager.textEditor = mockTextEditor;
			toolManager.textToolHandler = null;
			toolManager.pathToolHandler = null;

			toolManager.destroy();

			expect( mockTextEditor.remove ).toHaveBeenCalled();
			expect( toolManager.textEditor ).toBeNull();
		} );

		it( 'should clear editingTextLayer on destroy', () => {
			toolManager.editingTextLayer = { id: 'text-1', type: 'text' };
			toolManager.textToolHandler = null;
			toolManager.pathToolHandler = null;
			toolManager.textEditor = { remove: jest.fn(), parentNode: null };

			toolManager.destroy();

			expect( toolManager.editingTextLayer ).toBeNull();
		} );
	} );

	describe( 'path fallback - completion by closing loop', () => {
		beforeEach( () => {
			toolManager.pathToolHandler = null;
			toolManager.shapeFactory = null;
		} );

		it( 'should complete path when clicking near start point', () => {
			// Start the path
			toolManager.handlePathPoint( { x: 100, y: 100 } );
			expect( toolManager.pathPoints.length ).toBe( 1 );

			// Add more points
			toolManager.handlePathPoint( { x: 200, y: 100 } );
			toolManager.handlePathPoint( { x: 200, y: 200 } );
			expect( toolManager.pathPoints.length ).toBe( 3 );

			// Click near start (within 10px threshold)
			toolManager.handlePathPoint( { x: 105, y: 105 } );

			// Path should be completed and reset
			expect( toolManager.pathPoints.length ).toBe( 0 );
			expect( toolManager.isDrawing ).toBe( false );
		} );

		it( 'should not complete path when far from start', () => {
			toolManager.handlePathPoint( { x: 100, y: 100 } );
			toolManager.handlePathPoint( { x: 200, y: 100 } );
			toolManager.handlePathPoint( { x: 200, y: 200 } );

			// Click far from start
			toolManager.handlePathPoint( { x: 300, y: 300 } );

			// Path should still be building
			expect( toolManager.pathPoints.length ).toBe( 4 );
			expect( toolManager.isDrawing ).toBe( true );
		} );
	} );

	describe( 'renderPathPreview fallback', () => {
		beforeEach( () => {
			toolManager.pathToolHandler = null;
		} );

		it( 'should render path preview when points exist', () => {
			toolManager.pathPoints = [
				{ x: 0, y: 0 },
				{ x: 100, y: 100 }
			];

			// Should not throw
			expect( () => toolManager.renderPathPreview() ).not.toThrow();
		} );

		it( 'should not render when no points', () => {
			toolManager.pathPoints = [];

			expect( () => toolManager.renderPathPreview() ).not.toThrow();
		} );
	} );

	describe( 'initialization fallbacks', () => {
		it( 'should use inline style when ToolStyles unavailable', () => {
			// Reset modules to get fresh require with modified globals
			jest.resetModules();

			// Save and clear ToolStyles
			const originalToolStyles = window.ToolStyles;
			window.ToolStyles = null;

			// Re-require the module with ToolStyles = null
			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.styleManager ).toBeNull();
			expect( tm.currentStyle ).toBeDefined();
			expect( tm.currentStyle.color ).toBe( '#000000' );
			expect( tm.currentStyle.strokeWidth ).toBe( 2 );
			expect( tm.currentStyle.fontSize ).toBe( 16 );
			expect( tm.currentStyle.fontFamily ).toBe( 'Arial, sans-serif' );
			expect( tm.currentStyle.fill ).toBe( 'transparent' );

			// Restore
			window.ToolStyles = originalToolStyles;
		} );

		it( 'should set toolRegistry to null when registry unavailable', () => {
			// Reset modules
			jest.resetModules();

			const originalRegistry = window.Layers?.Tools?.registry;
			const originalLayers = window.Layers;

			// Clear the registry path
			window.Layers = { Tools: { registry: null } };

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			// toolRegistry should be null since registry is unavailable
			expect( tm.toolRegistry ).toBeNull();

			// Restore
			window.Layers = originalLayers;
			if ( window.Layers?.Tools ) {
				window.Layers.Tools.registry = originalRegistry;
			}
		} );

		it( 'should set textToolHandler to null when TextToolHandler unavailable', () => {
			jest.resetModules();

			const originalLayers = window.Layers;
			// Ensure TextToolHandler path is null
			window.Layers = { Tools: {} };

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.textToolHandler ).toBeNull();

			window.Layers = originalLayers;
		} );

		it( 'should set pathToolHandler to null when PathToolHandler unavailable', () => {
			jest.resetModules();

			const originalLayers = window.Layers;
			// Ensure PathToolHandler path is null
			window.Layers = { Tools: {} };

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.pathToolHandler ).toBeNull();

			window.Layers = originalLayers;
		} );

		it( 'should set shapeFactory to null when ShapeFactory unavailable', () => {
			jest.resetModules();

			const originalShapeFactory = window.ShapeFactory;
			window.ShapeFactory = null;

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.shapeFactory ).toBeNull();

			window.ShapeFactory = originalShapeFactory;
		} );

		it( 'should use ToolStyles when available', () => {
			jest.resetModules();

			// Create a mock ToolStyles class
			const MockToolStyles = function() {
				this.currentStyle = {
					color: '#ff0000',
					strokeWidth: 5,
					fontSize: 20,
					fontFamily: 'Verdana',
					fill: '#0000ff'
				};
			};

			// Set it on window before requiring
			const originalToolStyles = window.ToolStyles;
			window.ToolStyles = MockToolStyles;

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			// styleManager should be an instance of our MockToolStyles
			expect( tm.styleManager ).not.toBeNull();
			expect( tm.styleManager ).toBeInstanceOf( MockToolStyles );
			// currentStyle should reference the styleManager's currentStyle
			expect( tm.currentStyle ).toBe( tm.styleManager.currentStyle );
			expect( tm.currentStyle.color ).toBe( '#ff0000' );

			window.ToolStyles = originalToolStyles;
		} );

		it( 'should use ShapeFactory when available', () => {
			jest.resetModules();

			// Create a mock ShapeFactory class
			const MockShapeFactory = function( config ) {
				this.config = config;
			};

			const originalShapeFactory = window.ShapeFactory;
			window.ShapeFactory = MockShapeFactory;

			const FreshToolManager = require( '../../resources/ext.layers.editor/ToolManager.js' );
			const tm = new FreshToolManager( {}, mockCanvasManager );

			expect( tm.shapeFactory ).not.toBeNull();
			expect( tm.shapeFactory ).toBeInstanceOf( MockShapeFactory );

			window.ShapeFactory = originalShapeFactory;
		} );

		it( 'should use ToolRegistry when available', () => {
			jest.resetModules();

			// Set up the registry in the correct location
			const mockRegistry = { getTool: jest.fn() };
			const originalLayers = window.Layers;
			window.Layers = {
				Tools: {
					registry: mockRegistry
				}
			};

			// Also need to set window.ToolRegistry for the top-level capture
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

			// Create a mock TextToolHandler class
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

			// Create a mock PathToolHandler class
			const MockPathToolHandler = function( config ) {
				this.config = config;
			};

			const originalLayers = window.Layers;
			window.Layers = {
				Tools: {
					PathToolHandler: MockPathToolHandler
				}
			};

			// Need to provide a canvasManager with proper structure for the callback setup
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
} );
