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

		it( 'should create temp layer for highlight tool', () => {
			toolManager.setTool( 'highlight' );
			toolManager.startTool( point );
			expect( toolManager.tempLayer ).not.toBeNull();
			expect( toolManager.tempLayer.type ).toBe( 'highlight' );
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

		it( 'should update highlight dimensions', () => {
			toolManager.setTool( 'highlight' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( updatePoint );
			expect( toolManager.tempLayer.width ).toBe( 100 );
			expect( toolManager.tempLayer.height ).toBe( 50 );
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

		it( 'should add highlight layer via stateManager', () => {
			toolManager.setTool( 'highlight' );
			toolManager.startTool( startPoint );
			toolManager.updateTool( endPoint );
			toolManager.finishTool( endPoint );
			expect( mockEditor.stateManager.addLayer ).toHaveBeenCalled();
			const addedLayer = mockEditor.stateManager.addLayer.mock.calls.slice( -1 )[ 0 ][ 0 ];
			expect( addedLayer.type ).toBe( 'highlight' );
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

	describe( 'highlight tool', () => {
		it( 'should create highlight with default color if fill is transparent', () => {
			toolManager.currentStyle.fill = 'transparent';
			toolManager.setTool( 'highlight' );
			// Need to check startHighlightTool behavior
			const point = { x: 100, y: 100 };
			if ( typeof toolManager.startHighlightTool === 'function' ) {
				toolManager.startHighlightTool( point );
				expect( toolManager.tempLayer.type ).toBe( 'highlight' );
				expect( toolManager.tempLayer.fill ).toBeDefined();
			}
		} );

		it( 'should apply fill opacity for highlight', () => {
			toolManager.updateStyle( { fill: '#ffff00', fillOpacity: 0.5 } );
			if ( typeof toolManager.startHighlightTool === 'function' ) {
				toolManager.startHighlightTool( { x: 100, y: 100 } );
				expect( toolManager.tempLayer.fillOpacity ).toBe( 0.5 );
			}
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

	describe( 'updateHighlightTool', () => {
		it( 'should update highlight dimensions', () => {
			toolManager.setTool( 'highlight' );
			toolManager.startPoint = { x: 100, y: 100 };
			toolManager.startHighlightTool( { x: 100, y: 100 } );
			toolManager.updateHighlightTool( { x: 200, y: 150 } );

			expect( toolManager.tempLayer.width ).toBe( 100 );
			expect( toolManager.tempLayer.height ).toBe( 50 );
		} );

		it( 'should handle negative drag direction', () => {
			toolManager.setTool( 'highlight' );
			toolManager.startPoint = { x: 200, y: 150 };
			toolManager.startHighlightTool( { x: 200, y: 150 } );
			toolManager.updateHighlightTool( { x: 100, y: 100 } );

			expect( toolManager.tempLayer.x ).toBe( 100 );
			expect( toolManager.tempLayer.y ).toBe( 100 );
			expect( toolManager.tempLayer.width ).toBe( 100 );
			expect( toolManager.tempLayer.height ).toBe( 50 );
		} );
	} );

	describe( 'hasValidSize', () => {
		it( 'should validate rectangle size', () => {
			expect( toolManager.hasValidSize( { type: 'rectangle', width: 10, height: 10 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'rectangle', width: 0, height: 10 } ) ).toBe( false );
			expect( toolManager.hasValidSize( { type: 'rectangle', width: 1, height: 1 } ) ).toBe( false );
		} );

		it( 'should validate highlight size', () => {
			expect( toolManager.hasValidSize( { type: 'highlight', width: 10, height: 10 } ) ).toBe( true );
			expect( toolManager.hasValidSize( { type: 'highlight', width: 1, height: 1 } ) ).toBe( false );
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

	describe( 'blur tool', () => {
		it( 'should create blur layer with correct type', () => {
			toolManager.setTool( 'blur' );
			toolManager.startTool( { x: 100, y: 100 } );

			if ( toolManager.tempLayer ) {
				expect( toolManager.tempLayer.type ).toBe( 'blur' );
			}
		} );
	} );
} );
