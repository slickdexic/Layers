/**
 * Tests for LayersViewer class
 *
 * The LayersViewer is a lightweight viewer for displaying layer annotations
 * on images in article view (non-editing context).
 */

'use strict';

// Mock LayerRenderer before requiring LayersViewer
const mockLayerRenderer = {
	setCanvas: jest.fn(),
	setBaseDimensions: jest.fn(),
	setBackgroundImage: jest.fn(),
	drawLayer: jest.fn(),
	destroy: jest.fn(),
	hasShadowEnabled: jest.fn( () => false )
};

const MockLayerRenderer = jest.fn( () => mockLayerRenderer );

// Set up global mocks
beforeAll( () => {
	// Mock window.Layers namespace (only namespace export now)
	window.Layers = window.Layers || {};
	window.Layers.LayerRenderer = MockLayerRenderer;

	// Mock ResizeObserver
	window.ResizeObserver = jest.fn( ( _callback ) => ( {
		observe: jest.fn(),
		disconnect: jest.fn(),
		unobserve: jest.fn()
	} ) );

	// Mock requestAnimationFrame
	window.requestAnimationFrame = jest.fn( ( cb ) => {
		setTimeout( cb, 0 );
		return 1;
	} );
	window.cancelAnimationFrame = jest.fn();

	// Mock getComputedStyle
	window.getComputedStyle = jest.fn( () => ( { position: 'static' } ) );

	// Load LayersViewer
	require( '../../resources/ext.layers/LayersViewer.js' );

	// Create alias for backward compatibility in tests
	window.LayersViewer = window.Layers.Viewer;
} );

beforeEach( () => {
	jest.clearAllMocks();
	mockLayerRenderer.setCanvas.mockClear();
	mockLayerRenderer.setBaseDimensions.mockClear();
	mockLayerRenderer.setBackgroundImage.mockClear();
	mockLayerRenderer.drawLayer.mockClear();
	mockLayerRenderer.destroy.mockClear();
	MockLayerRenderer.mockClear();
} );

describe( 'LayersViewer', () => {
	/**
	 * Create a mock container element
	 *
	 * @return {Object} Mock container
	 */
	function createMockContainer() {
		const children = [];
		return {
			style: {},
			appendChild: jest.fn( ( child ) => children.push( child ) ),
			removeChild: jest.fn(),
			children: children
		};
	}

	/**
	 * Create a mock image element
	 *
	 * @param {Object} options - Options for the mock
	 * @return {Object} Mock image element
	 */
	function createMockImageElement( options = {} ) {
		const listeners = {};
		return {
			complete: options.complete !== false,
			offsetWidth: options.width || 800,
			offsetHeight: options.height || 600,
			naturalWidth: options.naturalWidth || 1600,
			naturalHeight: options.naturalHeight || 1200,
			width: options.width || 800,
			height: options.height || 600,
			addEventListener: jest.fn( ( event, handler ) => {
				listeners[ event ] = listeners[ event ] || [];
				listeners[ event ].push( handler );
			} ),
			removeEventListener: jest.fn(),
			_listeners: listeners,
			_triggerLoad: function () {
				if ( listeners.load ) {
					listeners.load.forEach( ( h ) => h() );
				}
			}
		};
	}

	/**
	 * Create sample layer data
	 *
	 * @return {Object} Layer data
	 */
	function createSampleLayerData() {
		return {
			baseWidth: 1600,
			baseHeight: 1200,
			layers: [
				{
					id: 'layer-1',
					type: 'rectangle',
					x: 100,
					y: 100,
					width: 200,
					height: 150,
					visible: true,
					stroke: '#ff0000',
					strokeWidth: 2
				},
				{
					id: 'layer-2',
					type: 'text',
					x: 300,
					y: 200,
					text: 'Hello',
					fontSize: 24,
					visible: true
				},
				{
					id: 'layer-3',
					type: 'circle',
					x: 500,
					y: 400,
					radius: 50,
					visible: false
				}
			]
		};
	}

	describe( 'constructor', () => {
		test( 'should initialize with valid config', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( viewer.container ).toBe( container );
			expect( viewer.imageElement ).toBe( imageElement );
			expect( viewer.layerData ).toBe( layerData );
			expect( viewer.baseWidth ).toBe( 1600 );
			expect( viewer.baseHeight ).toBe( 1200 );
		} );

		test( 'should handle empty config', () => {
			const viewer = new window.LayersViewer( {} );

			expect( viewer.container ).toBeUndefined();
			expect( viewer.imageElement ).toBeUndefined();
			expect( viewer.layerData ).toEqual( [] );
		} );

		test( 'should handle null config', () => {
			const viewer = new window.LayersViewer( null );

			expect( viewer.container ).toBeUndefined();
		} );

		test( 'should not initialize without container', () => {
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				imageElement: imageElement
			} );

			expect( viewer.canvas ).toBeNull();
		} );

		test( 'should not initialize without imageElement', () => {
			const container = createMockContainer();

			const viewer = new window.LayersViewer( {
				container: container
			} );

			expect( viewer.canvas ).toBeNull();
		} );
	} );

	describe( 'createCanvas', () => {
		test( 'should create canvas element with correct properties', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( viewer.canvas ).toBeDefined();
			expect( viewer.canvas.className ).toBe( 'layers-viewer-canvas' );
			expect( viewer.canvas.style.position ).toBe( 'absolute' );
			expect( viewer.canvas.style.top ).toMatch( /^0(px)?$/ );
			expect( viewer.canvas.style.left ).toMatch( /^0(px)?$/ );
			expect( viewer.canvas.style.pointerEvents ).toBe( 'none' );
			expect( viewer.canvas.style.zIndex ).toBe( '1000' );
		} );

		test( 'should set container to relative position if static', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			window.getComputedStyle = jest.fn( () => ( { position: 'static' } ) );

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( container.style.position ).toBe( 'relative' );
		} );

		test( 'should not change container position if not static', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			window.getComputedStyle = jest.fn( () => ( { position: 'absolute' } ) );

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( container.style.position ).not.toBe( 'relative' );
		} );

		test( 'should append canvas to container', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( container.appendChild ).toHaveBeenCalledWith( viewer.canvas );
		} );

		test( 'should initialize LayerRenderer', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( MockLayerRenderer ).toHaveBeenCalled();
			expect( viewer.renderer ).toBe( mockLayerRenderer );
		} );
	} );

	describe( 'loadImageAndRender', () => {
		test( 'should render immediately if image is complete', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement( { complete: true } );

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			// Canvas should have been sized
			expect( viewer.canvas.width ).toBe( 800 );
			expect( viewer.canvas.height ).toBe( 600 );
		} );

		test( 'should wait for image load if not complete', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement( { complete: false } );

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( imageElement.addEventListener ).toHaveBeenCalledWith(
				'load',
				expect.any( Function )
			);
		} );

		test( 'should set up window resize listener', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const addEventListenerSpy = jest.spyOn( window, 'addEventListener' );

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( addEventListenerSpy ).toHaveBeenCalledWith(
				'resize',
				expect.any( Function )
			);
			expect( viewer.boundWindowResize ).toBeDefined();

			addEventListenerSpy.mockRestore();
		} );

		test( 'should set up ResizeObserver if available', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( window.ResizeObserver ).toHaveBeenCalled();
			expect( viewer.resizeObserver ).toBeDefined();
		} );

		test( 'should handle ResizeObserver setup failure', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			// Make ResizeObserver throw on construction
			const originalResizeObserver = window.ResizeObserver;
			window.ResizeObserver = jest.fn( () => {
				throw new Error( 'ResizeObserver not supported' );
			} );

			// Mock mw.log.warn
			const originalMw = window.mw;
			window.mw = { log: { warn: jest.fn() } };

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			// Should log warning but not throw
			expect( window.mw.log.warn ).toHaveBeenCalled();
			expect( viewer ).toBeDefined();

			// Restore
			window.ResizeObserver = originalResizeObserver;
			window.mw = originalMw;
		} );

		test( 'should trigger renderLayers on image layer load callback', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			// Track calls to the LayerRenderer constructor
			let capturedOnImageLoad;
			MockLayerRenderer.mockImplementation( ( ctx, options ) => {
				capturedOnImageLoad = options.onImageLoad;
				return mockLayerRenderer;
			} );

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			// Clear previous render calls
			mockLayerRenderer.drawLayer.mockClear();

			// Trigger the onImageLoad callback
			if ( capturedOnImageLoad ) {
				capturedOnImageLoad();
			}

			// renderLayers should have been called
			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalled();

			// Restore mock
			MockLayerRenderer.mockImplementation( () => mockLayerRenderer );
		} );
	} );

	describe( 'scheduleResize', () => {
		test( 'should debounce resize calls with rAF', ( done ) => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			// Clear initial render
			mockLayerRenderer.drawLayer.mockClear();

			viewer.scheduleResize();
			viewer.scheduleResize(); // Should not queue another

			expect( window.requestAnimationFrame ).toHaveBeenCalled();

			// Wait for rAF callback
			setTimeout( () => {
				expect( viewer.rAFId ).toBeNull();
				done();
			}, 10 );
		} );
	} );

	describe( 'destroy', () => {
		test( 'should disconnect ResizeObserver', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const mockObserver = {
				observe: jest.fn(),
				disconnect: jest.fn()
			};
			window.ResizeObserver = jest.fn( () => mockObserver );

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			viewer.destroy();

			expect( mockObserver.disconnect ).toHaveBeenCalled();
		} );

		test( 'should remove window resize listener', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const removeEventListenerSpy = jest.spyOn( window, 'removeEventListener' );

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			const boundResize = viewer.boundWindowResize;
			viewer.destroy();

			expect( removeEventListenerSpy ).toHaveBeenCalledWith( 'resize', boundResize );
			expect( viewer.boundWindowResize ).toBeNull();

			removeEventListenerSpy.mockRestore();
		} );

		test( 'should cancel pending animation frame', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			viewer.rAFId = 123;
			viewer.destroy();

			expect( window.cancelAnimationFrame ).toHaveBeenCalledWith( 123 );
			expect( viewer.rAFId ).toBeNull();
		} );

		test( 'should destroy renderer', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			viewer.destroy();

			expect( mockLayerRenderer.destroy ).toHaveBeenCalled();
			expect( viewer.renderer ).toBeNull();
		} );
	} );

	describe( 'resizeCanvasAndRender', () => {
		test( 'should set canvas size to match image display size', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement( { width: 400, height: 300 } );

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( viewer.canvas.width ).toBe( 400 );
			expect( viewer.canvas.height ).toBe( 300 );
			expect( viewer.canvas.style.width ).toBe( '400px' );
			expect( viewer.canvas.style.height ).toBe( '300px' );
		} );

		test( 'should update renderer with canvas and dimensions', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( mockLayerRenderer.setCanvas ).toHaveBeenCalledWith( viewer.canvas );
			expect( mockLayerRenderer.setBaseDimensions ).toHaveBeenCalledWith( 1600, 1200 );
			expect( mockLayerRenderer.setBackgroundImage ).toHaveBeenCalledWith( imageElement );
		} );

		test( 'should fall back to natural dimensions when offset is 0', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement( {
				width: 0,
				height: 0,
				naturalWidth: 1000,
				naturalHeight: 800
			} );
			imageElement.offsetWidth = 0;
			imageElement.offsetHeight = 0;

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			expect( viewer.canvas.width ).toBe( 1000 );
			expect( viewer.canvas.height ).toBe( 800 );
		} );
	} );

	describe( 'renderLayers', () => {
		test( 'should skip rendering if no layerData', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: null
			} );

			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should skip rendering if no layers array', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: { baseWidth: 100 }
			} );

			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should render visible layers', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: createSampleLayerData()
			} );

			// Only 2 visible layers should be rendered (layer-3 is invisible)
			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalledTimes( 2 );
		} );

		test( 'should render layers from bottom to top', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				layers: [
					{ id: 'top', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, visible: true },
					{ id: 'middle', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, visible: true },
					{ id: 'bottom', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, visible: true }
				]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const calls = mockLayerRenderer.drawLayer.mock.calls;
			expect( calls[ 0 ][ 0 ].id ).toBe( 'bottom' );
			expect( calls[ 1 ][ 0 ].id ).toBe( 'middle' );
			expect( calls[ 2 ][ 0 ].id ).toBe( 'top' );
		} );
	} );

	describe( 'renderLayer', () => {
		test( 'should skip invisible layers (boolean false)', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = {
				baseWidth: 100,
				baseHeight: 100,
				layers: [ { id: 'test', type: 'rectangle', visible: false } ]
			};

			mockLayerRenderer.drawLayer.mockClear();

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should skip invisible layers (string "false")', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = {
				baseWidth: 100,
				baseHeight: 100,
				layers: [ { id: 'test', type: 'rectangle', visible: 'false' } ]
			};

			mockLayerRenderer.drawLayer.mockClear();

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should skip invisible layers (number 0)', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = {
				baseWidth: 100,
				baseHeight: 100,
				layers: [ { id: 'test', type: 'rectangle', visible: 0 } ]
			};

			mockLayerRenderer.drawLayer.mockClear();

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should pass scaled layer to renderer', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement( { width: 400, height: 300 } );
			const layerData = {
				baseWidth: 800,
				baseHeight: 600,
				layers: [ { id: 'test', type: 'rectangle', x: 100, y: 100, width: 200, height: 100, visible: true } ]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const call = mockLayerRenderer.drawLayer.mock.calls[ 0 ];
			const scaledLayer = call[ 0 ];

			// Scale is 0.5 (400/800, 300/600)
			expect( scaledLayer.x ).toBe( 50 ); // 100 * 0.5
			expect( scaledLayer.y ).toBe( 50 ); // 100 * 0.5
			expect( scaledLayer.width ).toBe( 100 ); // 200 * 0.5
			expect( scaledLayer.height ).toBe( 50 ); // 100 * 0.5
		} );

		test( 'should pass options with scaled=true and shadowScale', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement( { width: 400, height: 300 } );
			const layerData = {
				baseWidth: 800,
				baseHeight: 600,
				layers: [ { id: 'test', type: 'rectangle', x: 0, y: 0, visible: true } ]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const call = mockLayerRenderer.drawLayer.mock.calls[ 0 ];
			const options = call[ 1 ];

			expect( options.scaled ).toBe( true );
			expect( options.shadowScale ).toBeDefined();
			expect( options.shadowScale.sx ).toBe( 0.5 );
			expect( options.shadowScale.sy ).toBe( 0.5 );
		} );
	} );

	describe( 'scaleLayerCoordinates', () => {
		test( 'should scale all coordinate properties', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const layer = {
				x: 100,
				y: 200,
				width: 300,
				height: 400,
				radius: 50,
				radiusX: 60,
				radiusY: 70,
				x1: 10,
				y1: 20,
				x2: 30,
				y2: 40,
				fontSize: 24,
				strokeWidth: 2,
				arrowSize: 10,
				outerRadius: 100,
				innerRadius: 50,
				tailWidth: 20,
				textStrokeWidth: 1,
				padding: 8
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 3, 2.5 );

			expect( scaled.x ).toBe( 200 );
			expect( scaled.y ).toBe( 600 );
			expect( scaled.width ).toBe( 600 );
			expect( scaled.height ).toBe( 1200 );
			expect( scaled.radius ).toBe( 125 );
			expect( scaled.radiusX ).toBe( 120 );
			expect( scaled.radiusY ).toBe( 210 );
			expect( scaled.x1 ).toBe( 20 );
			expect( scaled.y1 ).toBe( 60 );
			expect( scaled.x2 ).toBe( 60 );
			expect( scaled.y2 ).toBe( 120 );
			expect( scaled.fontSize ).toBe( 60 );
			expect( scaled.strokeWidth ).toBe( 5 );
			expect( scaled.arrowSize ).toBe( 25 );
			expect( scaled.outerRadius ).toBe( 250 );
			expect( scaled.innerRadius ).toBe( 125 );
			expect( scaled.tailWidth ).toBe( 50 );
			expect( scaled.textStrokeWidth ).toBe( 2.5 );
			// Text box padding must be scaled to maintain correct text positioning
			expect( scaled.padding ).toBe( 20 );
		} );

		test( 'should scale points array', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const layer = {
				points: [
					{ x: 10, y: 20 },
					{ x: 30, y: 40 },
					{ x: 50, y: 60 }
				]
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 3, 2.5 );

			expect( scaled.points ).toHaveLength( 3 );
			expect( scaled.points[ 0 ] ).toEqual( { x: 20, y: 60 } );
			expect( scaled.points[ 1 ] ).toEqual( { x: 60, y: 120 } );
			expect( scaled.points[ 2 ] ).toEqual( { x: 100, y: 180 } );
		} );

		test( 'should preserve non-coordinate properties', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const layer = {
				id: 'test-layer',
				type: 'rectangle',
				visible: true,
				stroke: '#ff0000',
				fill: '#00ff00',
				opacity: 0.8
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 3, 2.5 );

			expect( scaled.id ).toBe( 'test-layer' );
			expect( scaled.type ).toBe( 'rectangle' );
			expect( scaled.visible ).toBe( true );
			expect( scaled.stroke ).toBe( '#ff0000' );
			expect( scaled.fill ).toBe( '#00ff00' );
			expect( scaled.opacity ).toBe( 0.8 );
		} );

		test( 'should scale curved arrow control point (FR-4 fix)', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// Curved arrow with control point at (150, 75) - midpoint offset by 50 pixels
			const layer = {
				type: 'arrow',
				x1: 100,
				y1: 100,
				x2: 200,
				y2: 50,
				controlX: 150,
				controlY: 25
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 3, 2.5 );

			// Arrow endpoints should scale with x/y factors
			expect( scaled.x1 ).toBe( 200 );
			expect( scaled.y1 ).toBe( 300 );
			expect( scaled.x2 ).toBe( 400 );
			expect( scaled.y2 ).toBe( 150 );
			// Control point must also scale to maintain curve shape
			expect( scaled.controlX ).toBe( 300 ); // 150 * 2
			expect( scaled.controlY ).toBe( 75 );  // 25 * 3
		} );

		test( 'should scale corner radius properties', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const layer = {
				type: 'rectangle',
				cornerRadius: 8,
				pointRadius: 4,
				valleyRadius: 2
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 3, 2.5 );

			expect( scaled.cornerRadius ).toBe( 20 ); // 8 * 2.5
			expect( scaled.pointRadius ).toBe( 10 );  // 4 * 2.5
			expect( scaled.valleyRadius ).toBe( 5 );  // 2 * 2.5
		} );

		test( 'should scale blurRadius for blur layers', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const layer = {
				type: 'blur',
				blurRadius: 12
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 3, 2.5 );

			expect( scaled.blurRadius ).toBe( 30 ); // 12 * 2.5
		} );

		test( 'should scale dimension layer properties', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const layer = {
				type: 'dimension',
				extensionLength: 10,
				extensionGap: 5,
				tickSize: 8
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 3, 2.5 );

			expect( scaled.extensionLength ).toBe( 25 ); // 10 * 2.5
			expect( scaled.extensionGap ).toBe( 12.5 ); // 5 * 2.5
			expect( scaled.tickSize ).toBe( 20 ); // 8 * 2.5
		} );

		test( 'should scale callout tailSize property (P2.16 regression)', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const layer = {
				type: 'callout',
				tailSize: 20,
				tailTipX: 100,
				tailTipY: 50
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 3, 2.5 );

			expect( scaled.tailSize ).toBe( 50 ); // 20 * 2.5
			expect( scaled.tailTipX ).toBe( 200 ); // 100 * 2
			expect( scaled.tailTipY ).toBe( 150 ); // 50 * 3
		} );

		test( 'should scale marker layer properties', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = createSampleLayerData();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			const layer = {
				type: 'marker',
				size: 24,
				arrowX: 100,
				arrowY: 50,
				fontSizeAdjust: 4
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 3, 2.5 );

			expect( scaled.size ).toBe( 60 ); // 24 * 2.5
			expect( scaled.arrowX ).toBe( 200 ); // 100 * 2
			expect( scaled.arrowY ).toBe( 150 ); // 50 * 3
			expect( scaled.fontSizeAdjust ).toBe( 10 ); // 4 * 2.5
		} );

		test( 'should scale per-run fontSize in richText (P1-034 regression)', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: { baseWidth: 800, baseHeight: 600, layers: [] }
			} );

			const layer = {
				type: 'textbox',
				x: 100,
				y: 50,
				fontSize: 16,
				richText: [
					{ text: 'Normal text' },
					{ text: 'Large text', style: { fontSize: 24 } },
					{ text: 'Small text', style: { fontSize: 10 } },
					{ text: 'Style without fontSize', style: { fontWeight: 'bold' } }
				]
			};

			const scaled = viewer.scaleLayerCoordinates( layer, 2, 2, 2 );

			// Top-level fontSize should be scaled
			expect( scaled.fontSize ).toBe( 32 ); // 16 * 2

			// Per-run fontSize in richText should also be scaled
			expect( scaled.richText ).toHaveLength( 4 );
			expect( scaled.richText[ 0 ].style ).toBeUndefined(); // No style object
			expect( scaled.richText[ 1 ].style.fontSize ).toBe( 48 ); // 24 * 2
			expect( scaled.richText[ 2 ].style.fontSize ).toBe( 20 ); // 10 * 2
			expect( scaled.richText[ 3 ].style.fontSize ).toBeUndefined(); // No fontSize in style
			expect( scaled.richText[ 3 ].style.fontWeight ).toBe( 'bold' ); // Other styles preserved
		} );
	} );

	describe( 'drawBackgroundOnCanvas', () => {
		test( 'should draw background image when hasBlendMode is true', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			imageElement.style = { visibility: '' };

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'multiply', visible: true }
				]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// When blend mode is present, drawBackgroundOnCanvas should be called
			// which hides the DOM image
			expect( imageElement.style.visibility ).toBe( 'hidden' );
		} );

		test( 'should clear to transparent when background is hidden', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			imageElement.style = { visibility: '' };

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				backgroundVisible: false,
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'exclusion', visible: true }
				]
			};

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// Background hidden - should clearRect (transparent), not fill white
			expect( viewer.ctx.fillStyle ).not.toBe( '#ffffff' );
		} );

		test( 'should apply background opacity from layer data', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			imageElement.style = { visibility: '' };

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				backgroundVisible: true,
				backgroundOpacity: 0.5,
				layers: [
					{ id: 'layer1', type: 'rectangle', blendMode: 'screen', visible: true }
				]
			};

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// ctx.drawImage should be called with opacity applied
			expect( viewer ).toBeDefined();
		} );

		test( 'should parse string opacity value', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			imageElement.style = { visibility: '' };

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				backgroundOpacity: '0.7',
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'overlay', visible: true }
				]
			};

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( viewer ).toBeDefined();
		} );

		test( 'should ignore blend mode "normal"', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			imageElement.style = { visibility: '' };

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'normal', visible: true }
				]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// Normal blend mode should not trigger drawBackgroundOnCanvas
			// So image visibility should not be hidden (no blend mode processing)
			expect( imageElement.style.visibility ).not.toBe( 'hidden' );
		} );

		test( 'should ignore blend mode "source-over"', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			imageElement.style = { visibility: '' };

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'source-over', visible: true }
				]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( imageElement.style.visibility ).not.toBe( 'hidden' );
		} );

		test( 'should handle backgroundVisible as string "false"', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			imageElement.style = { visibility: '' };

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				backgroundVisible: 'false',
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'multiply', visible: true }
				]
			};

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// Background hidden via string "false" - should clearRect, not fill white
			expect( viewer.ctx.fillStyle ).not.toBe( '#ffffff' );
		} );

		test( 'should handle backgroundVisible as string "0"', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			imageElement.style = { visibility: '' };

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				backgroundVisible: '0',
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'difference', visible: true }
				]
			};

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// Background hidden via string "0" - should clearRect, not fill white
			expect( viewer.ctx.fillStyle ).not.toBe( '#ffffff' );
		} );

		test( 'should handle backgroundVisible as integer 0', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			imageElement.style = { visibility: '' };

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				backgroundVisible: 0,
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'hard-light', visible: true }
				]
			};

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// Background hidden via integer 0 - should clearRect, not fill white
			expect( viewer.ctx.fillStyle ).not.toBe( '#ffffff' );
		} );
	} );

	describe( 'renderLayer blend mode handling', () => {
		test( 'should apply blend mode from blend property', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'multiply', visible: true, x: 0, y: 0, width: 100, height: 100 }
				]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalled();
		} );

		test( 'should apply blend mode from blendMode property', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				layers: [
					{ id: 'layer1', type: 'rectangle', blendMode: 'screen', visible: true, x: 0, y: 0, width: 100, height: 100 }
				]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalled();
		} );

		test( 'should handle invalid blend mode gracefully', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			// Mock ctx to throw on invalid blend mode
			const mockCtx = {
				clearRect: jest.fn(),
				fillRect: jest.fn(),
				drawImage: jest.fn(),
				save: jest.fn(),
				restore: jest.fn(),
				get globalCompositeOperation() {
					return 'source-over';
				},
				set globalCompositeOperation( value ) {
					if ( value === 'invalid-blend-mode' ) {
						throw new Error( 'Invalid blend mode' );
					}
				},
				globalAlpha: 1,
				fillStyle: '#ffffff',
				shadowColor: 'transparent',
				shadowBlur: 0,
				shadowOffsetX: 0,
				shadowOffsetY: 0
			};

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'invalid-blend-mode', visible: true, x: 0, y: 0, width: 100, height: 100 }
				]
			};

			// Override ctx after viewer creation
			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: { baseWidth: 1600, baseHeight: 1200, layers: [] }
			} );

			viewer.ctx = mockCtx;
			viewer.layerData = layerData;

			// Should not throw
			expect( () => viewer.renderLayers() ).not.toThrow();
		} );

		test( 'should delegate shadow rendering to individual renderers', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				layers: [
					{
						id: 'layer1',
						type: 'rectangle',
						visible: true,
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						shadow: true,
						shadowColor: 'rgba(0,0,0,0.5)',
						shadowBlur: 10,
						shadowOffsetX: 5,
						shadowOffsetY: 5
					}
				]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// Shadow is handled by individual renderers (ShapeRenderer, MarkerRenderer, etc.)
			// via drawSpreadShadow, not at the viewer level
			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalled();
		} );

		test( 'should use default shadow values when not specified', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			mockLayerRenderer.hasShadowEnabled.mockReturnValue( true );

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200,
				layers: [
					{
						id: 'layer1',
						type: 'rectangle',
						visible: true,
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						shadow: true
						// No shadow properties - should use defaults
					}
				]
			};

			new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalled();

			mockLayerRenderer.hasShadowEnabled.mockReturnValue( false );
		} );
	} );

	describe( 'exports', () => {
		test( 'should export to window.Layers.Viewer namespace', () => {
			expect( window.Layers ).toBeDefined();
			expect( window.Layers.Viewer ).toBeDefined();
			expect( typeof window.Layers.Viewer ).toBe( 'function' );
		} );
	} );

	describe( 'applyBackgroundSettings', () => {
		const createImageWithStyle = () => {
			return {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: {
					visibility: '',
					opacity: ''
				}
			};
		};

		test( 'should set visibility to hidden when backgroundVisible is false', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [],
					backgroundVisible: false,
					backgroundOpacity: 1.0
				}
			} );

			expect( imageElement.style.visibility ).toBe( 'hidden' );
		} );

		test( 'should set visibility to visible when backgroundVisible is true', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();
			imageElement.style.visibility = 'hidden'; // Start hidden

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [],
					backgroundVisible: true,
					backgroundOpacity: 1.0
				}
			} );

			expect( imageElement.style.visibility ).toBe( 'visible' );
		} );

		test( 'should set visibility to hidden when backgroundVisible is string "false"', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [],
					backgroundVisible: 'false',
					backgroundOpacity: 1.0
				}
			} );

			expect( imageElement.style.visibility ).toBe( 'hidden' );
		} );

		test( 'should set visibility to hidden when backgroundVisible is 0', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [],
					backgroundVisible: 0,
					backgroundOpacity: 1.0
				}
			} );

			expect( imageElement.style.visibility ).toBe( 'hidden' );
		} );

		test( 'should apply opacity when backgroundOpacity is a number', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [],
					backgroundVisible: true,
					backgroundOpacity: 0.5
				}
			} );

			expect( imageElement.style.opacity ).toBe( '0.5' );
		} );

		test( 'should apply opacity when backgroundOpacity is a string', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [],
					backgroundVisible: true,
					backgroundOpacity: '0.75'
				}
			} );

			expect( imageElement.style.opacity ).toBe( '0.75' );
		} );

		test( 'should not apply invalid opacity values', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();
			imageElement.style.opacity = '1'; // Set initial value

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [],
					backgroundVisible: true,
					backgroundOpacity: 1.5 // Invalid - out of range
				}
			} );

			// Should not change because 1.5 > 1
			expect( imageElement.style.opacity ).toBe( '1' );
		} );

		test( 'should handle missing style object gracefully', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				addEventListener: jest.fn()
				// No style property
			};

			// Should not throw
			expect( () => {
				new window.LayersViewer( {
					container,
					imageElement,
					layerData: {
						layers: [],
						backgroundVisible: false,
						backgroundOpacity: 0.5
					}
				} );
			} ).not.toThrow();
		} );

		test( 'should default to visible and full opacity when settings not provided', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();
			imageElement.style.visibility = 'hidden'; // Start hidden

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: []
					// No backgroundVisible or backgroundOpacity
				}
			} );

			// Should be visible (default behavior - visibility restored)
			expect( imageElement.style.visibility ).toBe( 'visible' );
			// Opacity should be set to full (1) when visible
			expect( imageElement.style.opacity ).toBe( '1' );
		} );

		test( 'should return early when imageElement is null', () => {
			const container = document.createElement( 'div' );

			// Create viewer without imageElement
			const viewer = new window.LayersViewer( {
				container,
				imageElement: null,
				layerData: {
					layers: [],
					backgroundVisible: false,
					backgroundOpacity: 0.5
				}
			} );

			// Should not throw - just returns early
			expect( viewer.imageElement ).toBeNull();
		} );

		test( 'should make image visible when layerData is null', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();
			imageElement.style.visibility = 'hidden';

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: null
			} );

			// When layerData is null, image should be visible (fail-safe)
			expect( imageElement.style.visibility ).toBe( 'visible' );
			expect( imageElement.style.opacity ).toBe( '1' );
		} );
	} );

	describe( 'normalizeLayerData', () => {
		const createImageWithStyle = () => {
			return {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: {
					visibility: '',
					opacity: ''
				}
			};
		};

		test( 'should convert string boolean values to actual booleans', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const layerData = {
				layers: [
					{ id: 'layer1', type: 'textbox', textShadow: 'true', shadow: 'false', visible: '1' },
					{ id: 'layer2', type: 'rectangle', shadow: '1', glow: '0', locked: 'true' }
				]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// After normalization, string values should be converted to booleans
			expect( viewer.layerData.layers[ 0 ].textShadow ).toBe( true );
			expect( viewer.layerData.layers[ 0 ].shadow ).toBe( false );
			expect( viewer.layerData.layers[ 0 ].visible ).toBe( true );
			expect( viewer.layerData.layers[ 1 ].shadow ).toBe( true );
			expect( viewer.layerData.layers[ 1 ].glow ).toBe( false );
			expect( viewer.layerData.layers[ 1 ].locked ).toBe( true );
		} );

		test( 'should convert numeric boolean values to actual booleans', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const layerData = {
				layers: [
					{ id: 'layer1', type: 'textbox', textShadow: 1, shadow: 0 }
				]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			expect( viewer.layerData.layers[ 0 ].textShadow ).toBe( true );
			expect( viewer.layerData.layers[ 0 ].shadow ).toBe( false );
		} );

		test( 'should preserve actual boolean values', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const layerData = {
				layers: [
					{ id: 'layer1', type: 'textbox', textShadow: true, shadow: false }
				]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			expect( viewer.layerData.layers[ 0 ].textShadow ).toBe( true );
			expect( viewer.layerData.layers[ 0 ].shadow ).toBe( false );
		} );

		test( 'should handle missing layers gracefully', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {}
			} );

			expect( viewer.layerData.layers ).toBeUndefined();
		} );

		test( 'should handle null layerData gracefully', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: null
			} );

			// When layerData is null, it defaults to empty array
			expect( viewer.layerData ).toEqual( [] );
		} );

		test( 'should normalize all supported boolean properties', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			// Test all boolean properties that should be normalized
			const layerData = {
				layers: [
					{
						id: 'layer1',
						type: 'textbox',
						shadow: 'true',
						textShadow: '1',
						glow: 1,
						visible: 'false',
						locked: '0',
						preserveAspectRatio: 'true'
					}
				]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			const layer = viewer.layerData.layers[ 0 ];
			expect( layer.shadow ).toBe( true );
			expect( layer.textShadow ).toBe( true );
			expect( layer.glow ).toBe( true );
			expect( layer.visible ).toBe( false );
			expect( layer.locked ).toBe( false );
			expect( layer.preserveAspectRatio ).toBe( true );
		} );

		test( 'should use fallback normalization when LayerDataNormalizer is not available', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			// Temporarily remove the shared normalizer
			const originalNormalizer = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const layerData = {
				layers: [
					{ id: 'layer1', type: 'rectangle', shadow: '1', visible: '0' }
				]
			};

			// Create viewer without shared normalizer - it will use fallbackNormalize
			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// Restore the normalizer
			window.Layers.LayerDataNormalizer = originalNormalizer;

			// Fallback should still normalize the values
			expect( viewer.layerData.layers[ 0 ].shadow ).toBe( true );
			expect( viewer.layerData.layers[ 0 ].visible ).toBe( false );
		} );

		test( 'should handle fallback normalization with null layerData', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: null
			} );

			// Should not throw
			expect( viewer ).toBeDefined();
		} );

		test( 'should handle fallback normalization with empty string boolean values', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const layerData = {
				layers: [
					{ id: 'layer1', type: 'rectangle', shadow: '' }
				]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// Empty string should be converted to true
			expect( viewer.layerData.layers[ 0 ].shadow ).toBe( true );
		} );

		test( 'should normalize blendMode to blend alias in fallback', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			// Temporarily remove the shared normalizer
			const originalNormalizer = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const layerData = {
				layers: [
					{ id: 'layer1', type: 'rectangle', blendMode: 'multiply' }
				]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// Restore the normalizer
			window.Layers.LayerDataNormalizer = originalNormalizer;

			// blendMode should be aliased to blend
			expect( viewer.layerData.layers[ 0 ].blend ).toBe( 'multiply' );
			expect( viewer.layerData.layers[ 0 ].blendMode ).toBe( 'multiply' );
		} );

		test( 'should normalize blend to blendMode alias in fallback', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			// Temporarily remove the shared normalizer
			const originalNormalizer = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const layerData = {
				layers: [
					{ id: 'layer1', type: 'rectangle', blend: 'screen' }
				]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// Restore the normalizer
			window.Layers.LayerDataNormalizer = originalNormalizer;

			// blend should be aliased to blendMode
			expect( viewer.layerData.layers[ 0 ].blend ).toBe( 'screen' );
			expect( viewer.layerData.layers[ 0 ].blendMode ).toBe( 'screen' );
		} );

		test( 'should skip fallback when layerData has no layers array', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			// Temporarily remove the shared normalizer
			const originalNormalizer = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const layerData = {
				baseWidth: 1600,
				baseHeight: 1200
				// No layers array
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// Restore the normalizer
			window.Layers.LayerDataNormalizer = originalNormalizer;

			// Should not throw
			expect( viewer ).toBeDefined();
			expect( viewer.layerData.layers ).toBeUndefined();
		} );

		test( 'should normalize backgroundVisible in fallback when shared normalizer unavailable', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			// Temporarily remove the shared normalizer
			const originalNormalizer = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			// Test with integer 0 (from PHP API serialization)
			const layerData = {
				layers: [
					{ id: 'layer1', type: 'rectangle' }
				],
				backgroundVisible: 0,
				backgroundOpacity: '0.5'
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// Restore the normalizer
			window.Layers.LayerDataNormalizer = originalNormalizer;

			// backgroundVisible should be normalized to boolean false
			expect( viewer.layerData.backgroundVisible ).toBe( false );
			// backgroundOpacity should be normalized to number
			expect( viewer.layerData.backgroundOpacity ).toBe( 0.5 );
		} );

		test( 'should normalize backgroundVisible=1 to true in fallback', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			// Temporarily remove the shared normalizer
			const originalNormalizer = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const layerData = {
				layers: [],
				backgroundVisible: 1
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// Restore the normalizer
			window.Layers.LayerDataNormalizer = originalNormalizer;

			// backgroundVisible should be normalized to boolean true
			expect( viewer.layerData.backgroundVisible ).toBe( true );
		} );
	} );

	describe( 'destroy and cleanup', () => {
		const createImageWithStyle = () => {
			return {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: {
					visibility: '',
					opacity: ''
				}
			};
		};

		it( 'should restore original image visibility on destroy', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();
			imageElement.style.visibility = 'visible';
			imageElement.style.opacity = '0.8';

			const layerData = {
				layers: [ { id: 'l1', type: 'text', text: 'Test' } ],
				backgroundVisible: false
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// Image should be hidden (backgroundVisible: false)
			expect( imageElement.style.visibility ).toBe( 'hidden' );

			// Destroy the viewer
			viewer.destroy();

			// Original visibility should be restored
			expect( imageElement.style.visibility ).toBe( 'visible' );
			expect( imageElement.style.opacity ).toBe( '0.8' );
		} );

		it( 'should handle applyBackgroundSettings with no layer data', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();
			imageElement.style.visibility = 'hidden';

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: null
			} );

			// With no layer data, image should be visible
			expect( imageElement.style.visibility ).toBe( 'visible' );
			expect( imageElement.style.opacity ).toBe( '1' );
		} );

		it( 'should parse string backgroundOpacity', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const layerData = {
				layers: [],
				backgroundVisible: true,
				backgroundOpacity: '0.5'
			};

			new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// String opacity should be parsed
			expect( imageElement.style.opacity ).toBe( '0.5' );
		} );
	} );

	// ===== BRANCH COVERAGE GAP TESTS =====

	describe( 'ResizeObserver setup and error handling', () => {
		const createImageWithStyle = () => ( {
			complete: true,
			offsetWidth: 800,
			offsetHeight: 600,
			naturalWidth: 800,
			naturalHeight: 600,
			addEventListener: jest.fn(),
			style: { visibility: '', opacity: '' }
		} );

		test( 'should handle ResizeObserver constructor throwing', () => {
			const origRO = window.ResizeObserver;
			window.ResizeObserver = jest.fn( () => {
				throw new Error( 'ResizeObserver not supported' );
			} );

			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			// Should not throw, viewer should still work
			expect( viewer.canvas ).not.toBeNull();
			// resizeObserver stays null (its constructor init value) when setup fails
			expect( viewer.resizeObserver ).toBeNull();

			window.ResizeObserver = origRO;
		} );

		test( 'should handle ResizeObserver being unavailable', () => {
			const origRO = window.ResizeObserver;
			delete window.ResizeObserver;

			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			expect( viewer.canvas ).not.toBeNull();
			expect( viewer.resizeObserver ).toBeNull();

			window.ResizeObserver = origRO;
		} );
	} );

	describe( 'destroy edge cases', () => {
		const createImageWithStyle = () => ( {
			complete: true,
			offsetWidth: 800,
			offsetHeight: 600,
			naturalWidth: 800,
			naturalHeight: 600,
			addEventListener: jest.fn(),
			style: { visibility: '', opacity: '' }
		} );

		test( 'should handle ResizeObserver disconnect throwing', () => {
			const origRO = window.ResizeObserver;
			const mockDisconnect = jest.fn( () => {
				throw new Error( 'disconnect failed' );
			} );
			window.ResizeObserver = jest.fn( () => ( {
				observe: jest.fn(),
				disconnect: mockDisconnect,
				unobserve: jest.fn()
			} ) );

			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			// Should not throw on destroy
			expect( () => viewer.destroy() ).not.toThrow();

			window.ResizeObserver = origRO;
		} );

		test( 'should handle cancelAnimationFrame throwing', () => {
			const origCAF = window.cancelAnimationFrame;
			window.cancelAnimationFrame = jest.fn( () => {
				throw new Error( 'cancel failed' );
			} );

			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			// Set a pending rAFId to trigger cancelAnimationFrame
			viewer.rAFId = 42;

			expect( () => viewer.destroy() ).not.toThrow();
			expect( viewer.rAFId ).toBeNull();

			window.cancelAnimationFrame = origCAF;
		} );

		test( 'should remove canvas from DOM on destroy', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			const canvas = viewer.canvas;
			expect( canvas ).not.toBeNull();
			// Canvas should be appended to container
			expect( canvas.parentNode ).toBe( container );

			viewer.destroy();
			expect( viewer.canvas ).toBeNull();
			expect( viewer.ctx ).toBeNull();
		} );

		test( 'should handle destroy when imageElement has no style', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			// Remove style before destroy
			viewer.imageElement = { style: null };
			viewer.originalImageVisibility = 'visible';

			expect( () => viewer.destroy() ).not.toThrow();
		} );

		test( 'should handle destroy when canvas has no parentNode', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			// Simulate canvas already removed from DOM
			if ( viewer.canvas && viewer.canvas.parentNode ) {
				viewer.canvas.parentNode.removeChild( viewer.canvas );
			}

			expect( () => viewer.destroy() ).not.toThrow();
		} );

		test( 'should clean up renderer on destroy', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			viewer.destroy();
			expect( viewer.renderer ).toBeNull();
			expect( mockLayerRenderer.destroy ).toHaveBeenCalled();
		} );
	} );

	describe( 'renderLayers edge cases', () => {
		const createImageWithStyle = () => ( {
			complete: true,
			offsetWidth: 800,
			offsetHeight: 600,
			naturalWidth: 800,
			naturalHeight: 600,
			addEventListener: jest.fn(),
			style: { visibility: '', opacity: '' }
		} );

		test( 'should return early when layerData is null', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			viewer.layerData = null;
			mockLayerRenderer.drawLayer.mockClear();

			viewer.renderLayers();
			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should return early when layerData has no layers property', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			viewer.layerData = {};
			mockLayerRenderer.drawLayer.mockClear();

			viewer.renderLayers();
			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should return early when ctx is null (after destroy)', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [ { id: 'l1', type: 'text' } ] }
			} );

			viewer.ctx = null;
			mockLayerRenderer.drawLayer.mockClear();

			viewer.renderLayers();
			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should detect blend mode and draw background on canvas', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const layerData = {
				baseWidth: 800,
				baseHeight: 600,
				layers: [
					{ id: 'l1', type: 'rectangle', blend: 'multiply', x: 10, y: 10, width: 50, height: 50 }
				]
			};

			new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// After rendering with blend mode, image should be hidden
			expect( imageElement.style.visibility ).toBe( 'hidden' );
		} );

		test( 'should detect blendMode property (server alias)', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const layerData = {
				baseWidth: 800,
				baseHeight: 600,
				layers: [
					{ id: 'l1', type: 'rectangle', blendMode: 'overlay', x: 10, y: 10, width: 50, height: 50 }
				]
			};

			new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			expect( imageElement.style.visibility ).toBe( 'hidden' );
		} );

		test( 'should NOT hide image when blend is normal', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const layerData = {
				baseWidth: 800,
				baseHeight: 600,
				layers: [
					{ id: 'l1', type: 'rectangle', blend: 'normal', x: 10, y: 10, width: 50, height: 50 }
				]
			};

			new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// normal blend ≠ hasBlendMode, so DOM image should stay visible
			expect( imageElement.style.visibility ).not.toBe( 'hidden' );
		} );

		test( 'should NOT hide image when blend is source-over', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const layerData = {
				baseWidth: 800,
				baseHeight: 600,
				layers: [
					{ id: 'l1', type: 'rectangle', blend: 'source-over', x: 10, y: 10, width: 50, height: 50 }
				]
			};

			new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			expect( imageElement.style.visibility ).not.toBe( 'hidden' );
		} );

		test( 'should not hide image when image is not ready for blend mode', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: false,  // Image not loaded yet
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 0,  // Not loaded
				naturalHeight: 0,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			const layerData = {
				baseWidth: 800,
				baseHeight: 600,
				layers: [
					{ id: 'l1', type: 'rectangle', blend: 'multiply', x: 10, y: 10, width: 50, height: 50 }
				]
			};

			new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			// Image not ready → backgroundDrawn=false → should NOT hide
			expect( imageElement.style.visibility ).not.toBe( 'hidden' );
		} );

		test( 'should handle non-array layers gracefully in renderLayers', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			// Create viewer with valid array first, then swap to non-array
			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			// Override layers with a non-array after init to test renderLayers guard
			viewer.layerData.layers = 'not-an-array';
			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			// Non-Array layers should become empty array, no drawLayer calls
			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'drawBackgroundOnCanvas edge cases', () => {
		const createImageWithStyle = () => ( {
			complete: true,
			offsetWidth: 800,
			offsetHeight: 600,
			naturalWidth: 800,
			naturalHeight: 600,
			addEventListener: jest.fn(),
			style: { visibility: '', opacity: '' }
		} );

		test( 'should return early when imageElement is null', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			viewer.imageElement = null;
			// clearRect was already called during construction; clear spy after
			const ctxSpy = jest.spyOn( viewer.ctx, 'clearRect' );
			ctxSpy.mockClear();

			viewer.drawBackgroundOnCanvas();
			// Should return early without touching ctx
			expect( ctxSpy ).not.toHaveBeenCalled();
		} );

		test( 'should clear canvas when background is hidden', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [], backgroundVisible: false }
			} );

			const ctxSpy = jest.spyOn( viewer.ctx, 'clearRect' );
			viewer.drawBackgroundOnCanvas();
			expect( ctxSpy ).toHaveBeenCalled();
		} );

		test( 'should handle bgVisible === 0 as hidden', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [], backgroundVisible: 0 }
			} );

			const ctxSpy = jest.spyOn( viewer.ctx, 'clearRect' );
			viewer.drawBackgroundOnCanvas();
			expect( ctxSpy ).toHaveBeenCalled();
		} );

		test( 'should parse string backgroundOpacity in drawBackgroundOnCanvas', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [ { id: 'l1', type: 'rectangle', blend: 'multiply', x: 10, y: 10, width: 50, height: 50 } ],
					backgroundVisible: true,
					backgroundOpacity: '0.7'
				}
			} );

			const saveSpy = jest.spyOn( viewer.ctx, 'save' );
			viewer.drawBackgroundOnCanvas();
			expect( saveSpy ).toHaveBeenCalled();
		} );

		test( 'should clamp invalid string opacity', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [],
					backgroundVisible: true,
					backgroundOpacity: 'invalid'
				}
			} );

			// invalid string should fall through, bgOpacity stays 1.0
			const drawImageSpy = jest.spyOn( viewer.ctx, 'drawImage' ).mockImplementation( () => {} );
			viewer.drawBackgroundOnCanvas();
			expect( drawImageSpy ).toHaveBeenCalled();
		} );

		test( 'should reject out-of-range numeric opacity', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [],
					backgroundVisible: true,
					backgroundOpacity: 5.0
				}
			} );

			// Out of range (>1) should keep default 1.0
			jest.spyOn( viewer.ctx, 'drawImage' ).mockImplementation( () => {} );
			viewer.drawBackgroundOnCanvas();
			expect( viewer.ctx.globalAlpha ).toBe( 1 );
		} );
	} );

	describe( 'renderLayer edge cases', () => {
		const createImageWithStyle = () => ( {
			complete: true,
			offsetWidth: 800,
			offsetHeight: 600,
			naturalWidth: 800,
			naturalHeight: 600,
			addEventListener: jest.fn(),
			style: { visibility: '', opacity: '' }
		} );

		test( 'should skip invisible layers (visible=false)', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 800,
					baseHeight: 600,
					layers: [ { id: 'l1', type: 'rectangle', visible: false, x: 10, y: 10, width: 50, height: 50 } ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should skip layers with visible=0 (integer)', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 800,
					baseHeight: 600,
					layers: [ { id: 'l1', type: 'rectangle', visible: 0, x: 10, y: 10, width: 50, height: 50 } ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should render without scaling when no baseWidth/baseHeight', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					layers: [ { id: 'l1', type: 'rectangle', visible: true, x: 100, y: 100, width: 200, height: 150 } ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			// Layer should be passed without scaling
			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalledTimes( 1 );
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.x ).toBe( 100 ); // No scaling applied
		} );

		test( 'should apply layer opacity to ctx', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 800,
					baseHeight: 600,
					layers: [ { id: 'l1', type: 'rectangle', opacity: 0.5, visible: true, x: 10, y: 10, width: 50, height: 50 } ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalledTimes( 1 );
		} );

		test( 'should apply blend mode to ctx', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 800,
					baseHeight: 600,
					layers: [ { id: 'l1', type: 'rectangle', blend: 'screen', visible: true, x: 10, y: 10, width: 50, height: 50 } ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalledTimes( 1 );
		} );

		test( 'should handle blend mode set error gracefully', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 800,
					baseHeight: 600,
					layers: [ { id: 'l1', type: 'rectangle', visible: true, x: 10, y: 10, width: 50, height: 50 } ]
				}
			} );

			// Make globalCompositeOperation throw
			Object.defineProperty( viewer.ctx, 'globalCompositeOperation', {
				set() {
					throw new Error( 'unsupported' );
				},
				get() {
					return 'source-over';
				},
				configurable: true
			} );

			// Render a layer with blend mode - should catch error
			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayer( { id: 'l2', type: 'rectangle', blend: 'invalid-mode', visible: true, x: 0, y: 0, width: 10, height: 10 } );
			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalled();
		} );
	} );

	describe( 'scaleLayerCoordinates edge cases', () => {
		const createImageWithStyle = () => ( {
			complete: true,
			offsetWidth: 800,
			offsetHeight: 600,
			naturalWidth: 800,
			naturalHeight: 600,
			addEventListener: jest.fn(),
			style: { visibility: '', opacity: '' }
		} );

		test( 'should deep copy gradient object', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const gradient = { type: 'linear', colors: [ { offset: 0, color: '#000' }, { offset: 1, color: '#fff' } ] };
			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 800,
					baseHeight: 600,
					layers: [ { id: 'l1', type: 'rectangle', x: 10, y: 10, width: 100, height: 100, gradient } ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			// Gradient should be deep copied (not same reference)
			expect( passedLayer.gradient ).not.toBe( gradient );
			expect( passedLayer.gradient.type ).toBe( 'linear' );
		} );

		test( 'should deep copy richText and scale per-run fontSize', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const richText = [
				{ text: 'Hello', style: { fontSize: 20 } },
				{ text: ' World' }
			];
			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 800,
					baseHeight: 600,
					layers: [ { id: 'l1', type: 'textbox', x: 10, y: 10, width: 200, height: 100, richText } ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			// richText should be deep copied
			expect( passedLayer.richText ).not.toBe( richText );
			// fontSize should be scaled by scaleAvg
			expect( passedLayer.richText[ 0 ].style.fontSize ).toBeCloseTo( 20 );
		} );

		test( 'should scale controlX and controlY for curved arrows', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'arrow', x1: 100, y1: 100, x2: 400, y2: 300,
						controlX: 250, controlY: 200
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			// controlX should be scaled by sx (800/1600 = 0.5)
			expect( passedLayer.controlX ).toBe( 125 );
			// controlY should be scaled by sy (600/1200 = 0.5)
			expect( passedLayer.controlY ).toBe( 100 );
		} );

		test( 'should scale outerRadius and innerRadius', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'star', x: 400, y: 300,
						outerRadius: 100, innerRadius: 50
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			// Scaled by scaleAvg = (0.5 + 0.5) / 2 = 0.5
			expect( passedLayer.outerRadius ).toBe( 50 );
			expect( passedLayer.innerRadius ).toBe( 25 );
		} );

		test( 'should scale dimension-specific properties', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'dimension', x1: 100, y1: 100, x2: 500, y2: 100,
						extensionLength: 40, extensionGap: 10, tickSize: 8
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.extensionLength ).toBe( 20 );
			expect( passedLayer.extensionGap ).toBe( 5 );
			expect( passedLayer.tickSize ).toBe( 4 );
		} );

		test( 'should scale angle dimension properties (cx, cy, ax, ay, bx, by, arcRadius)', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'angleDimension',
						cx: 400, cy: 300, ax: 600, ay: 300, bx: 400, by: 100, arcRadius: 80
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.cx ).toBe( 200 );
			expect( passedLayer.cy ).toBe( 150 );
			expect( passedLayer.ax ).toBe( 300 );
			expect( passedLayer.ay ).toBe( 150 );
			expect( passedLayer.bx ).toBe( 200 );
			expect( passedLayer.by ).toBe( 50 );
			expect( passedLayer.arcRadius ).toBe( 40 );
		} );

		test( 'should scale marker-specific properties (size, arrowX, arrowY)', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'marker', x: 800, y: 600,
						size: 40, arrowX: 900, arrowY: 700
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.size ).toBe( 20 );
			expect( passedLayer.arrowX ).toBe( 450 );
			expect( passedLayer.arrowY ).toBe( 350 );
		} );

		test( 'should scale callout properties (tailTipX, tailTipY, tailSize)', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'callout', x: 100, y: 100, width: 300, height: 200,
						tailTipX: 500, tailTipY: 400, tailSize: 30
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.tailTipX ).toBe( 250 );
			expect( passedLayer.tailTipY ).toBe( 200 );
			expect( passedLayer.tailSize ).toBe( 15 );
		} );

		test( 'should scale fontSizeAdjust', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'text', x: 100, y: 100, text: 'Test',
						fontSizeAdjust: 12
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.fontSizeAdjust ).toBe( 6 );
		} );

		test( 'should scale blurRadius', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'rectangle', x: 100, y: 100, width: 200, height: 200,
						fill: 'blur', blurRadius: 24
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.blurRadius ).toBe( 12 );
		} );

		test( 'should scale corner radii (cornerRadius, pointRadius, valleyRadius)', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'star', x: 400, y: 300,
						outerRadius: 100, cornerRadius: 20, pointRadius: 10, valleyRadius: 8
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.cornerRadius ).toBe( 10 );
			expect( passedLayer.pointRadius ).toBe( 5 );
			expect( passedLayer.valleyRadius ).toBe( 4 );
		} );

		test( 'should scale textStrokeWidth and padding', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'textbox', x: 100, y: 100, width: 300, height: 200,
						textStrokeWidth: 4, padding: 16
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.textStrokeWidth ).toBe( 2 );
			expect( passedLayer.padding ).toBe( 8 );
		} );

		test( 'should scale tailWidth', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'arrow', x1: 100, y1: 100, x2: 400, y2: 300,
						tailWidth: 20
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.tailWidth ).toBe( 10 );
		} );

		test( 'should scale points array', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 1600,
					baseHeight: 1200,
					layers: [ {
						id: 'l1', type: 'polygon',
						points: [ { x: 100, y: 200 }, { x: 300, y: 400 }, { x: 500, y: 200 } ]
					} ]
				}
			} );

			mockLayerRenderer.drawLayer.mockClear();
			viewer.renderLayers();
			const passedLayer = mockLayerRenderer.drawLayer.mock.calls[ 0 ][ 0 ];
			expect( passedLayer.points ).toEqual( [
				{ x: 50, y: 100 },
				{ x: 150, y: 200 },
				{ x: 250, y: 100 }
			] );
		} );
	} );

	describe( 'scheduleResize debouncing', () => {
		const createImageWithStyle = () => ( {
			complete: true,
			offsetWidth: 800,
			offsetHeight: 600,
			naturalWidth: 800,
			naturalHeight: 600,
			addEventListener: jest.fn(),
			style: { visibility: '', opacity: '' }
		} );

		test( 'should debounce multiple resize calls', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			window.requestAnimationFrame.mockClear();

			viewer.scheduleResize();
			viewer.scheduleResize();
			viewer.scheduleResize();

			// Only one rAF should have been requested
			expect( window.requestAnimationFrame ).toHaveBeenCalledTimes( 1 );
		} );
	} );

	describe( 'resizeCanvasAndRender edge cases', () => {
		const createImageWithStyle = () => ( {
			complete: true,
			offsetWidth: 800,
			offsetHeight: 600,
			naturalWidth: 800,
			naturalHeight: 600,
			addEventListener: jest.fn(),
			style: { visibility: '', opacity: '' }
		} );

		test( 'should return early when canvas is null', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			viewer.canvas = null;

			// Should not throw
			expect( () => viewer.resizeCanvasAndRender() ).not.toThrow();
		} );

		test( 'should return early when imageElement is null', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			viewer.imageElement = null;

			expect( () => viewer.resizeCanvasAndRender() ).not.toThrow();
		} );

		test( 'should fall back to naturalWidth when offsetWidth is 0', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			// Simulate hidden image (0 offset dimensions)
			viewer.imageElement.offsetWidth = 0;
			viewer.imageElement.offsetHeight = 0;
			viewer.imageElement.naturalWidth = 1600;
			viewer.imageElement.naturalHeight = 1200;

			viewer.resizeCanvasAndRender();
			expect( viewer.canvas.width ).toBe( 1600 );
			expect( viewer.canvas.height ).toBe( 1200 );
		} );

		test( 'should fall back to .width when both offset and naturalWidth are 0', () => {
			const container = document.createElement( 'div' );
			const imageElement = createImageWithStyle();

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			viewer.imageElement.offsetWidth = 0;
			viewer.imageElement.offsetHeight = 0;
			viewer.imageElement.naturalWidth = 0;
			viewer.imageElement.naturalHeight = 0;
			viewer.imageElement.width = 640;
			viewer.imageElement.height = 480;

			viewer.resizeCanvasAndRender();
			expect( viewer.canvas.width ).toBe( 640 );
			expect( viewer.canvas.height ).toBe( 480 );
		} );
	} );

	describe( 'applyBackgroundSettings edge cases', () => {
		test( 'should return early when imageElement has no style', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn()
				// No style property
			};

			// Should not throw
			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			expect( viewer.canvas ).not.toBeNull();
		} );

		test( 'should only store original styles once', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: 'visible', opacity: '0.9' }
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [], backgroundVisible: true }
			} );

			// First call already stored original styles
			expect( viewer.originalImageOpacity ).toBe( '0.9' );

			// Second apply should NOT overwrite original with current modified ones
			imageElement.style.opacity = '0.5'; // Modified by first apply
			viewer.applyBackgroundSettings();
			expect( viewer.originalImageOpacity ).toBe( '0.9' ); // Still original
		} );

		test( 'should handle bgVisible=false with string representation', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [], backgroundVisible: 'false' }
			} );

			expect( imageElement.style.visibility ).toBe( 'hidden' );
			expect( imageElement.style.opacity ).toBe( '0' );
		} );

		test( 'should handle bgVisible=\'0\' string', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [], backgroundVisible: '0' }
			} );

			expect( imageElement.style.visibility ).toBe( 'hidden' );
		} );
	} );

	describe( 'fallbackNormalize edge cases', () => {
		test( 'should copy blendMode to blend when blend is undefined', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			const origNorm = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const layerData = {
				layers: [ { id: 'l1', type: 'rectangle', blendMode: 'multiply' } ]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			window.Layers.LayerDataNormalizer = origNorm;

			expect( viewer.layerData.layers[ 0 ].blend ).toBe( 'multiply' );
		} );

		test( 'should copy blend to blendMode when blendMode is undefined', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			const origNorm = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const layerData = {
				layers: [ { id: 'l1', type: 'rectangle', blend: 'screen' } ]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			window.Layers.LayerDataNormalizer = origNorm;

			expect( viewer.layerData.layers[ 0 ].blendMode ).toBe( 'screen' );
		} );

		test( 'should normalize boolean string properties in layers', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			const origNorm = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const layerData = {
				layers: [ {
					id: 'l1', type: 'rectangle',
					shadow: '1',
					textShadow: '0',
					glow: 'true',
					locked: 'false',
					visible: 1,
					preserveAspectRatio: 0
				} ]
			};

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData
			} );

			window.Layers.LayerDataNormalizer = origNorm;

			const layer = viewer.layerData.layers[ 0 ];
			expect( layer.shadow ).toBe( true );
			expect( layer.textShadow ).toBe( false );
			expect( layer.glow ).toBe( true );
			expect( layer.locked ).toBe( false );
			expect( layer.visible ).toBe( true );
			expect( layer.preserveAspectRatio ).toBe( false );
		} );

		test( 'should return early when layerData is null', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			const origNorm = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: null
			} );

			window.Layers.LayerDataNormalizer = origNorm;

			// Constructor defaults null layerData to []
			expect( viewer.layerData ).toEqual( [] );
		} );

		test( 'should handle layerData with no layers array', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			const origNorm = window.Layers.LayerDataNormalizer;
			window.Layers.LayerDataNormalizer = null;

			const viewer = new window.LayersViewer( {
				container,
				imageElement,
				layerData: { backgroundVisible: '1' }
			} );

			window.Layers.LayerDataNormalizer = origNorm;

			expect( viewer.layerData.backgroundVisible ).toBe( true );
		} );
	} );

	describe( 'loadImageAndRender - image not yet loaded', () => {
		test( 'should add load listener when image is not complete', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: false,
				offsetWidth: 0,
				offsetHeight: 0,
				naturalWidth: 0,
				naturalHeight: 0,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: {
					baseWidth: 800,
					baseHeight: 600,
					layers: [ { id: 'l1', type: 'text', text: 'Test' } ]
				}
			} );

			// Should have registered a load listener
			expect( imageElement.addEventListener ).toHaveBeenCalledWith( 'load', expect.any( Function ) );
		} );
	} );

	describe( 'createCanvas with position detection', () => {
		test( 'should set container to relative when position is static', () => {
			const container = document.createElement( 'div' );
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			window.getComputedStyle = jest.fn( () => ( { position: 'static' } ) );

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			expect( container.style.position ).toBe( 'relative' );
		} );

		test( 'should NOT change container position when already positioned', () => {
			const container = document.createElement( 'div' );
			container.style.position = 'absolute';
			const imageElement = {
				complete: true,
				offsetWidth: 800,
				offsetHeight: 600,
				naturalWidth: 800,
				naturalHeight: 600,
				addEventListener: jest.fn(),
				style: { visibility: '', opacity: '' }
			};

			window.getComputedStyle = jest.fn( () => ( { position: 'absolute' } ) );

			new window.LayersViewer( {
				container,
				imageElement,
				layerData: { layers: [] }
			} );

			expect( container.style.position ).toBe( 'absolute' );
		} );
	} );
} );
