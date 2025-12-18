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
	destroy: jest.fn()
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

	describe( 'renderBlurLayer', () => {
		test( 'should skip invisible blur layers', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = {
				baseWidth: 100,
				baseHeight: 100,
				layers: [ { id: 'blur1', type: 'blur', visible: false, x: 0, y: 0, width: 50, height: 50 } ]
			};

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// Blur layers are handled specially, not via drawLayer
			// Just verify no errors
			expect( viewer ).toBeDefined();
		} );

		test( 'should skip blur layers with zero dimensions', () => {
			const container = createMockContainer();
			const imageElement = createMockImageElement();
			const layerData = {
				baseWidth: 100,
				baseHeight: 100,
				layers: [ { id: 'blur1', type: 'blur', visible: true, x: 0, y: 0, width: 0, height: 50 } ]
			};

			const viewer = new window.LayersViewer( {
				container: container,
				imageElement: imageElement,
				layerData: layerData
			} );

			// Just verify no errors
			expect( viewer ).toBeDefined();
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
				textStrokeWidth: 1
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
			// Opacity should not be modified (stays empty)
			expect( imageElement.style.opacity ).toBe( '' );
		} );
	} );
} );
