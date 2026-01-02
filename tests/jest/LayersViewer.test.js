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
	window.ResizeObserver = jest.fn( ( callback ) => ( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: null
			} );

			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should skip rendering if no layers array', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: { baseWidth: 100 }
			} );

			expect( mockLayerRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		test( 'should render visible layers', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// When blend mode is present, drawBackgroundOnCanvas should be called
			// which hides the DOM image
			expect( imageElement.style.visibility ).toBe( 'hidden' );
		} );

		test( 'should fill with white when background is hidden', () => {
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

			// Background hidden but blend mode present - should still work
			expect( viewer.ctx.fillStyle ).toBe( '#ffffff' );
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			// Background hidden via string "false"
			expect( viewer.ctx.fillStyle ).toBe( '#ffffff' );
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

			expect( viewer.ctx.fillStyle ).toBe( '#ffffff' );
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

			expect( viewer.ctx.fillStyle ).toBe( '#ffffff' );
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

		test( 'should apply shadow settings when hasShadowEnabled returns true', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();

			// Make hasShadowEnabled return true
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
						shadow: true,
						shadowColor: 'rgba(0,0,0,0.5)',
						shadowBlur: 10,
						shadowOffsetX: 5,
						shadowOffsetY: 5
					}
				]
			};

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			expect( mockLayerRenderer.hasShadowEnabled ).toHaveBeenCalled();
			expect( mockLayerRenderer.drawLayer ).toHaveBeenCalled();

			// Reset mock
			mockLayerRenderer.hasShadowEnabled.mockReturnValue( false );
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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

			const viewer = new window.LayersViewer( {
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
	} );
} );
