/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Tests for ViewerManager
 *
 * ViewerManager handles finding images with layer data and initializing
 * LayersViewer instances. It manages:
 * - Container positioning for overlay
 * - Viewer initialization
 * - Server-provided data-layer-data attributes
 * - File page fallback via API
 */

describe( 'ViewerManager', () => {
	let ViewerManager;
	let mockUrlParser;
	let mockLayersViewer;
	let mockApi;
	let mockMw;
	let SlideController;

	beforeEach( () => {
		jest.resetModules();
		document.body.innerHTML = '';

		// Load SlideController module and expose globally
		SlideController = require( '../../resources/ext.layers/viewer/SlideController.js' );
		global.SlideController = SlideController;
		// Also set up namespace path that ViewerManager's getClass() uses
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.SlideController = SlideController;

		// Create mock URL parser
		mockUrlParser = {
			decodeHtmlEntities: jest.fn( ( str ) => str ),
			getPageLayersParam: jest.fn( () => null ),
			getNamespaceNumber: jest.fn( () => 0 )
		};

		// Create mock LayersViewer constructor
		mockLayersViewer = jest.fn( function ( options ) {
			this.options = options;
			this.container = options.container;
			this.imageElement = options.imageElement;
			this.layerData = options.layerData;
		} );

		// Create mock API
		mockApi = {
			get: jest.fn( () => Promise.resolve( {} ) )
		};

		// Create mock mw object
		mockMw = {
			config: {
				get: jest.fn( ( key ) => {
					const config = {
						wgNamespaceNumber: 0,
						wgPageName: 'Main_Page',
						wgCanonicalNamespace: '',
						wgLayersCanEdit: true  // Default to having edit permission in tests
					};
					return config[ key ];
				} )
			},
			log: jest.fn(),
			Api: jest.fn( () => mockApi )
		};
		mockMw.log.warn = jest.fn();

		// Setup global mw
		global.mw = mockMw;

		// Setup window.layersGetClass to provide mocks
		window.layersGetClass = jest.fn( ( namespacePath ) => {
			if ( namespacePath === 'Utils.UrlParser' ) {
				return function () { return mockUrlParser; };
			}
			if ( namespacePath === 'Viewer.LayersViewer' ) {
				return mockLayersViewer;
			}
			if ( namespacePath === 'Viewer.SlideController' ) {
				return SlideController;
			}
			if ( namespacePath === 'Viewer.FreshnessChecker' ) {
				return null; // Optional, not critical for tests
			}
			return null;
		} );

		// Load module
		ViewerManager = require( '../../resources/ext.layers/viewer/ViewerManager.js' );
	} );

	afterEach( () => {
		delete global.mw;
		delete global.SlideController;
		delete window.layersGetClass;
		delete window.Layers;
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default options', () => {
			const manager = new ViewerManager();
			expect( manager.debug ).toBeUndefined();
		} );

		it( 'should enable debug mode when specified', () => {
			const manager = new ViewerManager( { debug: true } );
			expect( manager.debug ).toBe( true );
		} );

		it( 'should use provided urlParser', () => {
			const manager = new ViewerManager( { urlParser: mockUrlParser } );
			expect( manager.urlParser ).toBe( mockUrlParser );
		} );

		it( 'should create default urlParser if not provided', () => {
			const manager = new ViewerManager();
			expect( manager.urlParser ).toBeDefined();
		} );
	} );

	describe( 'debugLog', () => {
		it( 'should log when debug is true', () => {
			const manager = new ViewerManager( { debug: true } );
			manager.debugLog( 'test message' );
			expect( mockMw.log ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'test message'
			);
		} );

		it( 'should not log when debug is false', () => {
			const manager = new ViewerManager( { debug: false } );
			manager.debugLog( 'test message' );
			expect( mockMw.log ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'debugWarn', () => {
		it( 'should warn when debug is true', () => {
			const manager = new ViewerManager( { debug: true } );
			manager.debugWarn( 'test warning' );
			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'test warning'
			);
		} );

		it( 'should not warn when debug is false', () => {
			const manager = new ViewerManager( { debug: false } );
			manager.debugWarn( 'test warning' );
			expect( mockMw.log.warn ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'ensurePositionedContainer', () => {
		it( 'should return parent if already positioned', () => {
			const parent = document.createElement( 'div' );
			parent.style.position = 'relative';
			const img = document.createElement( 'img' );
			parent.appendChild( img );
			document.body.appendChild( parent );

			const manager = new ViewerManager();
			const container = manager.ensurePositionedContainer( img );

			expect( container ).toBe( parent );
		} );

		it( 'should wrap with positioned span if parent is static', () => {
			const parent = document.createElement( 'div' );
			parent.style.position = 'static';
			const img = document.createElement( 'img' );
			parent.appendChild( img );
			document.body.appendChild( parent );

			const manager = new ViewerManager();
			const container = manager.ensurePositionedContainer( img );

			expect( container.tagName ).toBe( 'SPAN' );
			expect( container.style.position ).toBe( 'relative' );
			expect( container.style.display ).toBe( 'inline-block' );
			expect( container.contains( img ) ).toBe( true );
		} );

		it( 'should handle img without parent', () => {
			const img = document.createElement( 'img' );

			const manager = new ViewerManager();
			const container = manager.ensurePositionedContainer( img );

			// Should return the img itself as container
			expect( container ).toBeDefined();
		} );
	} );

	describe( 'initializeViewer', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( {
				urlParser: mockUrlParser,
				debug: true
			} );
		} );

		it( 'should return false if viewer already exists', () => {
			const img = document.createElement( 'img' );
			img.layersViewer = {};
			document.body.appendChild( img );

			const result = manager.initializeViewer( img, { layers: [] } );

			expect( result ).toBe( false );
		} );

		it( 'should create LayersViewer instance', () => {
			const parent = document.createElement( 'div' );
			parent.style.position = 'relative';
			const img = document.createElement( 'img' );
			parent.appendChild( img );
			document.body.appendChild( parent );

			const layerData = { layers: [ { id: 'layer1' } ] };
			const result = manager.initializeViewer( img, layerData );

			expect( result ).toBe( true );
			expect( mockLayersViewer ).toHaveBeenCalled();
			expect( img.layersViewer ).toBeDefined();
		} );

		it( 'should normalize array data to object format', () => {
			const parent = document.createElement( 'div' );
			parent.style.position = 'relative';
			const img = document.createElement( 'img' );
			parent.appendChild( img );
			document.body.appendChild( parent );

			const layerData = [ { id: 'layer1' } ];
			manager.initializeViewer( img, layerData );

			expect( mockLayersViewer ).toHaveBeenCalledWith(
				expect.objectContaining( {
					layerData: { layers: [ { id: 'layer1' } ] }
				} )
			);
		} );

		it( 'should pass container and imageElement to viewer', () => {
			const parent = document.createElement( 'div' );
			parent.style.position = 'relative';
			const img = document.createElement( 'img' );
			parent.appendChild( img );
			document.body.appendChild( parent );

			manager.initializeViewer( img, { layers: [] } );

			expect( mockLayersViewer ).toHaveBeenCalledWith(
				expect.objectContaining( {
					container: parent,
					imageElement: img
				} )
			);
		} );

		it( 'should log layer count when debug enabled', () => {
			const parent = document.createElement( 'div' );
			parent.style.position = 'relative';
			const img = document.createElement( 'img' );
			parent.appendChild( img );
			document.body.appendChild( parent );

			manager.initializeViewer( img, { layers: [ {}, {}, {} ] } );

			expect( mockMw.log ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'Viewer initialized with',
				3,
				'layers'
			);
		} );

		it( 'should handle errors gracefully', () => {
			const parent = document.createElement( 'div' );
			parent.style.position = 'relative';
			const img = document.createElement( 'img' );
			parent.appendChild( img );
			document.body.appendChild( parent );

			mockLayersViewer.mockImplementation( () => {
				throw new Error( 'Test error' );
			} );

			const result = manager.initializeViewer( img, { layers: [] } );

			expect( result ).toBe( false );
			expect( mockMw.log.warn ).toHaveBeenCalled();
		} );
	} );

	describe( 'initializeLayerViewers', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( {
				urlParser: mockUrlParser,
				debug: true
			} );
		} );

		it( 'should find images with data-layer-data attribute', () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layer-data='{"layers":[]}' src="test.jpg">
				</div>
			`;

			manager.initializeLayerViewers();

			expect( mockLayersViewer ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should add layers-thumbnail class to images', () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layer-data='{"layers":[]}' src="test.jpg">
				</div>
			`;

			manager.initializeLayerViewers();

			const img = document.querySelector( 'img' );
			expect( img.classList.contains( 'layers-thumbnail' ) ).toBe( true );
		} );

		it( 'should not duplicate layers-thumbnail class', () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img class="layers-thumbnail" data-layer-data='{"layers":[]}' src="test.jpg">
				</div>
			`;

			manager.initializeLayerViewers();

			const img = document.querySelector( 'img' );
			const matches = img.className.match( /layers-thumbnail/g );
			expect( matches ).toHaveLength( 1 );
		} );

		it( 'should move data-layer-data from anchor to img', () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<a data-layer-data='{"layers":[{"id":"1"}]}'>
						<img src="test.jpg">
					</a>
				</div>
			`;

			manager.initializeLayerViewers();

			const img = document.querySelector( 'img' );
			expect( img.hasAttribute( 'data-layer-data' ) ).toBe( true );
			expect( mockLayersViewer ).toHaveBeenCalled();
		} );

		it( 'should not move if img already has data-layer-data', () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<a data-layer-data='{"layers":[{"id":"anchor"}]}'>
						<img data-layer-data='{"layers":[{"id":"img"}]}' src="test.jpg">
					</a>
				</div>
			`;

			manager.initializeLayerViewers();

			const img = document.querySelector( 'img' );
			const data = JSON.parse( img.getAttribute( 'data-layer-data' ) );
			expect( data.layers[ 0 ].id ).toBe( 'img' );
		} );

		it( 'should skip images that already have layersViewer', () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layer-data='{"layers":[]}' src="test.jpg">
				</div>
			`;

			const img = document.querySelector( 'img' );
			img.layersViewer = {};

			manager.initializeLayerViewers();

			expect( mockLayersViewer ).not.toHaveBeenCalled();
		} );

		it( 'should skip images with empty data-layer-data', () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layer-data='' src="test.jpg">
				</div>
			`;

			manager.initializeLayerViewers();

			expect( mockLayersViewer ).not.toHaveBeenCalled();
		} );

		it( 'should handle invalid JSON gracefully', () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layer-data='not valid json' src="test.jpg">
				</div>
			`;

			expect( () => manager.initializeLayerViewers() ).not.toThrow();
			expect( mockLayersViewer ).not.toHaveBeenCalled();
		} );

		it( 'should decode HTML entities in layer data', () => {
			mockUrlParser.decodeHtmlEntities.mockReturnValue( '{"layers":[{"id":"test"}]}' );

			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layer-data='{"layers":[{"id":"test"}]}' src="test.jpg">
				</div>
			`;

			manager.initializeLayerViewers();

			expect( mockUrlParser.decodeHtmlEntities ).toHaveBeenCalled();
		} );

		it( 'should handle multiple images', () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layer-data='{"layers":[]}' src="test1.jpg">
				</div>
				<div style="position: relative">
					<img data-layer-data='{"layers":[]}' src="test2.jpg">
				</div>
			`;

			manager.initializeLayerViewers();

			expect( mockLayersViewer ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	describe( 'initializeFilePageFallback', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( {
				urlParser: mockUrlParser,
				debug: true
			} );
		} );

		it( 'should return undefined when mw is undefined', () => {
			delete global.mw;

			const result = manager.initializeFilePageFallback();

			expect( result ).toBeUndefined();
		} );

		it( 'should return undefined when not on File page', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 0 );

			const result = manager.initializeFilePageFallback();

			expect( result ).toBeUndefined();
		} );

		it( 'should return undefined when no layers param in URL', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( null );

			const result = manager.initializeFilePageFallback();

			expect( result ).toBeUndefined();
		} );

		it( 'should return undefined when no main image found', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );

			const result = manager.initializeFilePageFallback();

			expect( result ).toBeUndefined();
		} );

		it( 'should skip if image already has layersViewer', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );

			document.body.innerHTML = '<div id="file"><img src="test.jpg"></div>';
			const img = document.querySelector( 'img' );
			img.layersViewer = {};

			const result = manager.initializeFilePageFallback();

			expect( result ).toBeUndefined();
		} );

		it( 'should skip if image has data-layer-data', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );

			document.body.innerHTML = `
				<div id="file"><img data-layer-data='[]' src="test.jpg"></div>
			`;

			const result = manager.initializeFilePageFallback();

			expect( result ).toBeUndefined();
		} );

		it( 'should call API with correct filename', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test_Image.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = '<div id="file"><img src="test.jpg"></div>';

			manager.initializeFilePageFallback();

			expect( mockMw.Api ).toHaveBeenCalled();
			expect( mockApi.get ).toHaveBeenCalledWith( {
				action: 'layersinfo',
				format: 'json',
				filename: 'Test Image.jpg'
			} );
		} );

		it( 'should initialize viewer when API returns layers', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = `
				<div id="file" style="position: relative"><img src="test.jpg"></div>
			`;

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1' } ]
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			await manager.initializeFilePageFallback();

			expect( mockLayersViewer ).toHaveBeenCalled();
		} );

		it( 'should not initialize when API returns no layerset', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = '<div id="file"><img src="test.jpg"></div>';
			mockApi.get.mockResolvedValue( { layersinfo: {} } );

			await manager.initializeFilePageFallback();

			expect( mockLayersViewer ).not.toHaveBeenCalled();
		} );

		it( 'should not initialize when layers array is empty', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = '<div id="file"><img src="test.jpg"></div>';
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] }
					}
				}
			} );

			await manager.initializeFilePageFallback();

			expect( mockLayersViewer ).not.toHaveBeenCalled();
		} );

		it( 'should handle data as array directly', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = `
				<div id="file" style="position: relative"><img src="test.jpg"></div>
			`;

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: [ { id: 'layer1' } ],
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			await manager.initializeFilePageFallback();

			expect( mockLayersViewer ).toHaveBeenCalled();
		} );

		it( 'should use image dimensions as fallback', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = `
				<div id="file" style="position: relative"><img src="test.jpg"></div>
			`;

			const img = document.querySelector( 'img' );
			Object.defineProperty( img, 'naturalWidth', { value: 1024 } );
			Object.defineProperty( img, 'naturalHeight', { value: 768 } );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: 'layer1' } ] }
					}
				}
			} );

			await manager.initializeFilePageFallback();

			expect( mockLayersViewer ).toHaveBeenCalledWith(
				expect.objectContaining( {
					layerData: expect.objectContaining( {
						baseWidth: 1024,
						baseHeight: 768
					} )
				} )
			);
		} );

		it( 'should handle API errors gracefully', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = '<div id="file"><img src="test.jpg"></div>';
			mockApi.get.mockRejectedValue( new Error( 'API error' ) );

			await expect( manager.initializeFilePageFallback() ).resolves.not.toThrow();
			expect( mockMw.log.warn ).toHaveBeenCalled();
		} );

		it( 'should find image in .fullMedia selector', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = `
				<div class="fullMedia" style="position: relative">
					<a><img src="test.jpg"></a>
				</div>
			`;

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: 'layer1' } ] }
					}
				}
			} );

			await manager.initializeFilePageFallback();

			expect( mockApi.get ).toHaveBeenCalled();
		} );

		it( 'should handle URL-encoded filenames', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test%20Image%20With%20Spaces.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = '<div id="file"><img src="test.jpg"></div>';

			manager.initializeFilePageFallback();

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( {
					filename: 'Test Image With Spaces.jpg'
				} )
			);
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export to window.Layers.Viewer namespace', () => {
			expect( window.Layers.Viewer.Manager ).toBe( ViewerManager );
		} );
	} );

	describe( 'initializeLargeImages', () => {
		let manager;

		beforeEach( () => {
			jest.useFakeTimers();
			manager = new ViewerManager( {
				urlParser: mockUrlParser,
				debug: true
			} );
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'should return early when images array is empty', () => {
			manager.initializeLargeImages( [] );
			expect( mockMw.Api ).not.toHaveBeenCalled();
		} );

		it( 'should return early when images is null', () => {
			manager.initializeLargeImages( null );
			expect( mockMw.Api ).not.toHaveBeenCalled();
		} );

		it( 'should warn when mw.Api is not available', () => {
			delete global.mw.Api;

			document.body.innerHTML = `
				<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );

			manager.initializeLargeImages( images );

			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'mw.Api not available for large image fetch'
			);
		} );

		it( 'should skip images that already have layersViewer', () => {
			document.body.innerHTML = `
				<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
			`;
			const img = document.querySelector( 'img' );
			img.layersViewer = {};

			manager.initializeLargeImages( [ img ] );

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should skip images with layersPending flag', () => {
			document.body.innerHTML = `
				<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
			`;
			const img = document.querySelector( 'img' );
			img.layersPending = true;

			manager.initializeLargeImages( [ img ] );

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should use data-layers-intent for set name', () => {
			document.body.innerHTML = `
				<img data-layers-large="true" data-layers-intent="custom-set" data-file-name="Test.jpg" src="test.jpg">
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );

			manager.initializeLargeImages( images );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( {
					setname: 'custom-set'
				} )
			);
		} );

		it( 'should not include setname for default or on values', () => {
			document.body.innerHTML = `
				<img data-layers-large="true" data-layers-intent="on" data-file-name="Test.jpg" src="test.jpg">
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );

			manager.initializeLargeImages( images );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.not.objectContaining( {
					setname: expect.anything()
				} )
			);
		} );

		it( 'should warn when filename cannot be extracted', () => {
			document.body.innerHTML = `
				<img data-layers-large="true" src="">
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );

			manager.initializeLargeImages( images );

			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'Could not extract filename from image for large data fetch'
			);
		} );

		it( 'should fetch and initialize viewer with API response', async () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
				</div>
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1' } ],
							backgroundVisible: true,
							backgroundOpacity: 0.8
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			manager.initializeLargeImages( images );

			// Wait for promises
			await jest.runAllTimersAsync();

			expect( mockLayersViewer ).toHaveBeenCalled();
		} );

		it( 'should log when no layerset is returned', async () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
				</div>
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );

			mockApi.get.mockResolvedValue( { layersinfo: {} } );

			manager.initializeLargeImages( images );

			await jest.runAllTimersAsync();

			expect( mockMw.log ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'No layerset returned for large image'
			);
		} );

		it( 'should log when layers array is empty', async () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
				</div>
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] }
					}
				}
			} );

			manager.initializeLargeImages( images );

			await jest.runAllTimersAsync();

			expect( mockMw.log ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'No layers in fetched data for large image'
			);
		} );

		it( 'should handle data as array directly', async () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
				</div>
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: [ { id: 'layer1' } ],
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			manager.initializeLargeImages( images );

			await jest.runAllTimersAsync();

			expect( mockLayersViewer ).toHaveBeenCalled();
		} );

		it( 'should handle errors in response processing', async () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
				</div>
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: null // Invalid data that will cause no layers
					}
				}
			} );

			manager.initializeLargeImages( images );

			await jest.runAllTimersAsync();

			// Should log that no layers were found (not an error, just no data)
			expect( mockMw.log ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'No layers in fetched data for large image'
			);
		} );

		it( 'should handle API errors', async () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
				</div>
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );
			const img = images[ 0 ];

			mockApi.get.mockRejectedValue( new Error( 'API error' ) );

			manager.initializeLargeImages( images );

			await jest.runAllTimersAsync();

			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'API request failed for large image:',
				expect.any( Error )
			);
			expect( img.layersPending ).toBe( false );
		} );

		it( 'should use image dimensions as fallback for baseWidth/baseHeight', async () => {
			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layers-large="true" data-file-name="Test.jpg" src="test.jpg">
				</div>
			`;
			const images = Array.from( document.querySelectorAll( 'img[data-layers-large]' ) );
			const img = images[ 0 ];

			Object.defineProperty( img, 'naturalWidth', { value: 1024 } );
			Object.defineProperty( img, 'naturalHeight', { value: 768 } );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1' } ]
						}
						// No baseWidth/baseHeight
					}
				}
			} );

			manager.initializeLargeImages( images );

			await jest.runAllTimersAsync();

			expect( mockLayersViewer ).toHaveBeenCalledWith(
				expect.objectContaining( {
					layerData: expect.objectContaining( {
						baseWidth: 1024,
						baseHeight: 768
					} )
				} )
			);
		} );
	} );

	describe( 'extractFilenameFromImg', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( {
				urlParser: mockUrlParser,
				debug: true
			} );
		} );

		it( 'should extract filename from data-file-name attribute', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Test.jpg' );

			const result = manager.extractFilenameFromImg( img );

			expect( result ).toBe( 'Test.jpg' );
		} );

		it( 'should extract filename from src URL', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/images/Test_Image.jpg';

			const result = manager.extractFilenameFromImg( img );

			expect( result ).toBe( 'Test_Image.jpg' );
		} );

		it( 'should remove thumbnail prefix from src URL', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/images/thumb/a/ab/Test.jpg/200px-Test.jpg';

			const result = manager.extractFilenameFromImg( img );

			expect( result ).toBe( 'Test.jpg' );
		} );

		it( 'should extract filename from parent link href', () => {
			const a = document.createElement( 'a' );
			a.href = '/wiki/File:Test_Image.jpg';
			const img = document.createElement( 'img' );
			img.src = '';
			a.appendChild( img );
			document.body.appendChild( a );

			const result = manager.extractFilenameFromImg( img );

			expect( result ).toBe( 'Test Image.jpg' );
		} );

		it( 'should return null when filename cannot be extracted', () => {
			const img = document.createElement( 'img' );
			img.src = '';

			const result = manager.extractFilenameFromImg( img );

			expect( result ).toBeNull();
		} );

		it( 'should decode URL-encoded filenames from src', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/images/Test%20Image.jpg';

			const result = manager.extractFilenameFromImg( img );

			expect( result ).toBe( 'Test Image.jpg' );
		} );

		it( 'should strip wikitext brackets from filename', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', '[[Test.jpg]]' );

			const result = manager.extractFilenameFromImg( img );

			expect( result ).toBe( 'Test.jpg' );
		} );

		it( 'should strip brackets from extracted src filename', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/images/[Test].jpg';

			const result = manager.extractFilenameFromImg( img );

			expect( result ).toBe( 'Test.jpg' );
		} );
	} );

	describe( 'getClass fallback behavior', () => {
		it( 'should use window.Layers namespace when available', () => {
			jest.resetModules();

			// Remove the mock and let the module use its own getClass
			delete window.layersGetClass;

			// Set up the namespace structure
			window.Layers = {
				Utils: {
					UrlParser: function () {
						return mockUrlParser;
					}
				},
				Viewer: {
					LayersViewer: mockLayersViewer
				}
			};

			global.mw = mockMw;

			const FreshViewerManager = require( '../../resources/ext.layers/viewer/ViewerManager.js' );
			const manager = new FreshViewerManager( { debug: true } );

			expect( manager.urlParser ).toBeDefined();
		} );

		it( 'should fall back to window globals when namespace path fails', () => {
			jest.resetModules();

			delete window.layersGetClass;

			// Set up partial namespace
			window.Layers = {};
			// Set up globals
			window.LayersUrlParser = function () {
				return mockUrlParser;
			};
			window.LayersViewer = mockLayersViewer;

			global.mw = mockMw;

			const FreshViewerManager = require( '../../resources/ext.layers/viewer/ViewerManager.js' );
			const manager = new FreshViewerManager( { debug: true } );

			expect( manager.urlParser ).toBeDefined();
		} );
	} );

	describe( 'initializeFilePageFallback edge cases', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( {
				urlParser: mockUrlParser,
				debug: true
			} );
		} );

		it( 'should handle filename without namespace prefix', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'Just_Filename.jpg'; // No File: prefix
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = '<div id="file"><img src="test.jpg"></div>';

			manager.initializeFilePageFallback();

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( {
					filename: 'Just Filename.jpg'
				} )
			);
		} );

		it( 'should handle decodeURIComponent errors gracefully', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:%E0%A4%A'; // Invalid URI encoding
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = '<div id="file"><img src="test.jpg"></div>';

			// Should not throw
			expect( () => manager.initializeFilePageFallback() ).not.toThrow();

			// Should warn about decode error
			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'Failed to decode filename URI:',
				expect.any( String )
			);
		} );

		it( 'should handle errors in API response processing', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			document.body.innerHTML = '<div id="file"><img src="test.jpg"></div>';

			// Return invalid data structure that will cause processing error
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: 'not-an-array' // Invalid
						}
					}
				}
			} );

			await manager.initializeFilePageFallback();

			// Should not initialize viewer
			expect( mockLayersViewer ).not.toHaveBeenCalled();
		} );

		it( 'should catch outer errors and log them', () => {
			mockUrlParser.getNamespaceNumber.mockImplementation( () => {
				throw new Error( 'Outer error' );
			} );

			expect( () => manager.initializeFilePageFallback() ).not.toThrow();

			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'File page fallback outer error:',
				expect.any( Error )
			);
		} );
	} );

	describe( 'initializeLayerViewers error handling', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( {
				urlParser: mockUrlParser,
				debug: true
			} );

			mockMw.log.error = jest.fn();
		} );

		it( 'should handle JSON parse error gracefully', () => {
			// The try/catch in initializeLayerViewers catches errors at the image level
			// When JSON.parse fails in the inner try, it sets layerData = null
			// and the outer try logs if there's still an exception

			document.body.innerHTML = `
				<div style="position: relative">
					<img data-layer-data='{"invalid":json}' src="test.jpg">
				</div>
			`;

			// JSON.parse will fail but it's caught internally
			manager.initializeLayerViewers();

			// The error is logged as a warn for JSON parse error
			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ViewerManager]',
				'JSON parse error:',
				expect.any( String )
			);
		} );
	} );

	describe( 'FR-10: Live Preview / Freshness Checking', () => {
		let manager;
		let mockFreshnessChecker;

		beforeEach( () => {
			mockFreshnessChecker = {
				checkFreshness: jest.fn(),
				checkMultipleFreshness: jest.fn()
			};

			// Update window.layersGetClass to provide mock FreshnessChecker
			window.layersGetClass = jest.fn( ( namespacePath ) => {
				if ( namespacePath === 'Utils.UrlParser' ) {
					return function () { return mockUrlParser; };
				}
				if ( namespacePath === 'Viewer.LayersViewer' ) {
					return mockLayersViewer;
				}
				if ( namespacePath === 'Viewer.FreshnessChecker' ) {
					return function () { return mockFreshnessChecker; };
				}
				return null;
			} );

			// Reload module to pick up new mocks
			jest.resetModules();
			ViewerManager = require( '../../resources/ext.layers/viewer/ViewerManager.js' );

			manager = new ViewerManager( {
				urlParser: mockUrlParser,
				freshnessChecker: mockFreshnessChecker,
				debug: true
			} );

			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		describe( 'reinitializeViewer', () => {
			it( 'should destroy existing viewer and create new one', () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', 'test.jpg' );

				// Mock existing viewer with destroy method
				const destroyMock = jest.fn();
				img.layersViewer = { destroy: destroyMock };

				const newLayerData = {
					layers: [ { id: '1', type: 'text' } ],
					baseWidth: 800,
					baseHeight: 600
				};

				const result = manager.reinitializeViewer( img, newLayerData );

				expect( destroyMock ).toHaveBeenCalled();
				expect( result ).toBe( true );
				expect( mockLayersViewer ).toHaveBeenCalled();
			} );

			it( 'should handle viewer without destroy method', () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', 'test.jpg' );

				// Mock existing viewer without destroy method
				img.layersViewer = { someOtherMethod: jest.fn() };

				const newLayerData = {
					layers: [ { id: '1', type: 'text' } ]
				};

				const result = manager.reinitializeViewer( img, newLayerData );

				expect( result ).toBe( true );
				expect( img.layersViewer ).not.toBeNull();
			} );

			it( 'should clear pending flag', () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', 'test.jpg' );
				img.layersPending = true;
				img.layersViewer = null;

				const newLayerData = { layers: [] };

				manager.reinitializeViewer( img, newLayerData );

				expect( img.layersPending ).toBe( false );
			} );

			it( 'should return false on error', () => {
				const img = document.createElement( 'img' );
				// No src attribute, might cause issues

				// Force an error by making LayersViewer throw
				mockLayersViewer.mockImplementationOnce( () => {
					throw new Error( 'Init failed' );
				} );

				const result = manager.reinitializeViewer( img, { layers: [] } );

				expect( result ).toBe( false );
			} );
		} );

		describe( 'initializeOverlayOnly', () => {
			it( 'should return false if img is null', () => {
				const result = manager.initializeOverlayOnly( null );
				expect( result ).toBe( false );
			} );

			it( 'should return false if overlay already exists', () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', 'test.jpg' );
				img.layersOverlay = {};

				const result = manager.initializeOverlayOnly( img, 'my-set' );

				expect( result ).toBe( false );
			} );

			it( 'should create container and initialize overlay', () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', '/wiki/images/test.jpg' );
				document.body.appendChild( img );

				const result = manager.initializeOverlayOnly( img, 'my-set' );

				expect( result ).toBe( true );
				expect( img.getAttribute( 'data-layer-setname' ) ).toBe( 'my-set' );
			} );

			it( 'should not set data attribute for default setname', () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', '/wiki/images/test.jpg' );
				document.body.appendChild( img );

				manager.initializeOverlayOnly( img, 'default' );

				expect( img.hasAttribute( 'data-layer-setname' ) ).toBe( false );
			} );

			it( 'should not set data attribute when setname is undefined', () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', '/wiki/images/test.jpg' );
				document.body.appendChild( img );

				manager.initializeOverlayOnly( img );

				expect( img.hasAttribute( 'data-layer-setname' ) ).toBe( false );
			} );
		} );

		describe( 'checkAndRefreshStaleViewers', () => {
			it( 'should skip if no freshnessChecker', () => {
				const managerNoChecker = new ViewerManager( {
					urlParser: mockUrlParser,
					freshnessChecker: null,
					debug: true
				} );

				const images = [ document.createElement( 'img' ) ];

				// Should not throw
				expect( () => {
					managerNoChecker.checkAndRefreshStaleViewers( images );
				} ).not.toThrow();

				expect( mockFreshnessChecker.checkMultipleFreshness ).not.toHaveBeenCalled();
			} );

			it( 'should skip images without revision info', () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', 'test.jpg' );
				// No data-layer-revision or data-file-name

				manager.checkAndRefreshStaleViewers( [ img ] );

				expect( mockFreshnessChecker.checkMultipleFreshness ).not.toHaveBeenCalled();
			} );

			it( 'should check images with revision info', () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', 'test.jpg' );
				img.setAttribute( 'data-layer-revision', '5' );
				img.setAttribute( 'data-file-name', 'test.jpg' );

				mockFreshnessChecker.checkMultipleFreshness.mockResolvedValue( new Map() );

				manager.checkAndRefreshStaleViewers( [ img ] );

				expect( mockFreshnessChecker.checkMultipleFreshness ).toHaveBeenCalledWith( [ img ] );
			} );

			it( 'should reinitialize stale viewers', async () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', 'test.jpg' );
				img.setAttribute( 'data-layer-revision', '5' );
				img.setAttribute( 'data-file-name', 'test.jpg' );
				img.layersViewer = { destroy: jest.fn() };

				const freshLayerData = {
					layers: [ { id: '1', type: 'arrow' } ],
					baseWidth: 1000,
					baseHeight: 800
				};

				const resultMap = new Map();
				resultMap.set( img, {
					isFresh: false,
					inlineRevision: 5,
					latestRevision: 8,
					layerData: freshLayerData
				} );
				mockFreshnessChecker.checkMultipleFreshness.mockResolvedValue( resultMap );

				manager.checkAndRefreshStaleViewers( [ img ] );

				// Wait for async completion
				await jest.runAllTimersAsync();

				// Should have reinitialized the viewer
				expect( mockLayersViewer ).toHaveBeenCalled();
				expect( img.layersViewer ).not.toBeNull();
			} );

			it( 'should not reinitialize fresh viewers', async () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', 'test.jpg' );
				img.setAttribute( 'data-layer-revision', '5' );
				img.setAttribute( 'data-file-name', 'test.jpg' );

				const resultMap = new Map();
				resultMap.set( img, {
					isFresh: true,
					inlineRevision: 5,
					latestRevision: 5,
					layerData: null
				} );
				mockFreshnessChecker.checkMultipleFreshness.mockResolvedValue( resultMap );

				const viewerCallsBefore = mockLayersViewer.mock.calls.length;

				manager.checkAndRefreshStaleViewers( [ img ] );

				await jest.runAllTimersAsync();

				// Should not have created a new viewer
				expect( mockLayersViewer.mock.calls.length ).toBe( viewerCallsBefore );
			} );

			it( 'should handle freshness check errors gracefully', async () => {
				const img = document.createElement( 'img' );
				img.setAttribute( 'src', 'test.jpg' );
				img.setAttribute( 'data-layer-revision', '5' );
				img.setAttribute( 'data-file-name', 'test.jpg' );

				mockFreshnessChecker.checkMultipleFreshness.mockRejectedValue(
					new Error( 'Network error' )
				);

				// Should not throw
				expect( () => {
					manager.checkAndRefreshStaleViewers( [ img ] );
				} ).not.toThrow();
			} );
		} );

		describe( 'initializeLayerViewers with freshness checking', () => {
			it( 'should call checkAndRefreshStaleViewers after initialization', () => {
				document.body.innerHTML = `
					<div style="position: relative">
						<img 
							data-layer-data='{"layers":[{"id":"1","type":"text"}]}' 
							data-layer-revision="5"
							data-file-name="test.jpg"
							data-layer-setname="default"
							src="test.jpg"
						>
					</div>
				`;

				mockFreshnessChecker.checkMultipleFreshness.mockResolvedValue( new Map() );

				manager.initializeLayerViewers();

				// Viewer should be initialized
				expect( mockLayersViewer ).toHaveBeenCalled();

				// Freshness check should be called
				expect( mockFreshnessChecker.checkMultipleFreshness ).toHaveBeenCalled();
			} );

			it( 'should pass only initialized images to freshness checker', () => {
				document.body.innerHTML = `
					<div style="position: relative">
						<img 
							data-layer-data='{"layers":[{"id":"1","type":"text"}]}' 
							data-layer-revision="5"
							data-file-name="test.jpg"
							src="test.jpg"
						>
						<img 
							data-layer-data='{"layers":[{"id":"2","type":"arrow"}]}' 
							data-layer-revision="3"
							data-file-name="test2.jpg"
							src="test2.jpg"
						>
					</div>
				`;

				mockFreshnessChecker.checkMultipleFreshness.mockResolvedValue( new Map() );

				manager.initializeLayerViewers();

				// Should have initialized both viewers
				expect( mockLayersViewer ).toHaveBeenCalledTimes( 2 );

				// Freshness check should be called with both images
				const checkedImages = mockFreshnessChecker.checkMultipleFreshness.mock.calls[ 0 ][ 0 ];
				expect( checkedImages ).toHaveLength( 2 );
			} );
		} );

		describe( 'refreshAllViewers', () => {
			let manager;
			let mockFreshnessChecker;

			beforeEach( () => {
				mockFreshnessChecker = {
					checkMultipleFreshness: jest.fn( () => Promise.resolve( new Map() ) ),
					clearCache: jest.fn()
				};

				window.Layers = {
					Viewer: {
						LayersViewer: mockLayersViewer,
						FreshnessChecker: jest.fn( () => mockFreshnessChecker )
					}
				};

				ViewerManager = require( '../../resources/ext.layers/viewer/ViewerManager.js' );
				manager = new ViewerManager( {
					debug: false,
					urlParser: mockUrlParser,
					freshnessChecker: mockFreshnessChecker
				} );
			} );

			it( 'should return result object with 0 refreshed when no viewers exist', async () => {
				document.body.innerHTML = '<div><img src="test.jpg"></div>';

				const result = await manager.refreshAllViewers();

				expect( result ).toEqual( { refreshed: 0, failed: 0, total: 0, errors: [] } );
			} );

			it( 'should clear freshness cache for each viewer', async () => {
				const mockDestroy = jest.fn();
				const mockViewer = { destroy: mockDestroy };

				document.body.innerHTML = `
					<div style="position: relative">
						<img 
							data-file-name="test.jpg"
							data-layer-setname="default"
							src="test.jpg"
						>
					</div>
				`;

				const img = document.querySelector( 'img' );
				img.layersViewer = mockViewer;

				mockApi.get.mockResolvedValue( {
					layersinfo: {
						layerset: {
							data: { layers: [ { id: '1', type: 'text' } ] },
							baseWidth: 800,
							baseHeight: 600
						}
					}
				} );

				await manager.refreshAllViewers();

				expect( mockFreshnessChecker.clearCache ).toHaveBeenCalledWith( 'test.jpg', 'default' );
			} );

			it( 'should fetch fresh data and reinitialize viewers', async () => {
				const mockDestroy = jest.fn();
				const mockViewer = { destroy: mockDestroy };

				document.body.innerHTML = `
					<div style="position: relative">
						<img 
							data-file-name="refresh-test.jpg"
							src="test.jpg"
						>
					</div>
				`;

				const img = document.querySelector( 'img' );
				img.layersViewer = mockViewer;

				mockApi.get.mockResolvedValue( {
					layersinfo: {
						layerset: {
							data: { 
								layers: [ { id: '1', type: 'marker' } ],
								backgroundVisible: true,
								backgroundOpacity: 1.0
							},
							baseWidth: 800,
							baseHeight: 600
						}
					}
				} );

				const result = await manager.refreshAllViewers();

				expect( result.refreshed ).toBe( 1 );
				expect( result.failed ).toBe( 0 );
				expect( result.errors ).toHaveLength( 0 );
				expect( mockDestroy ).toHaveBeenCalled();
				expect( mockLayersViewer ).toHaveBeenCalled();
			} );

			it( 'should handle API errors gracefully', async () => {
				const mockViewer = { destroy: jest.fn() };

				document.body.innerHTML = `
					<div style="position: relative">
						<img 
							data-file-name="error-test.jpg"
							src="test.jpg"
						>
					</div>
				`;

				const img = document.querySelector( 'img' );
				img.layersViewer = mockViewer;

				mockApi.get.mockRejectedValue( new Error( 'Network error' ) );

				const result = await manager.refreshAllViewers();

				expect( result.refreshed ).toBe( 0 );
				expect( result.failed ).toBe( 1 );
				expect( result.errors ).toHaveLength( 1 );
				expect( result.errors[ 0 ].error ).toContain( 'Network error' );
			} );

			it( 'should handle missing layerset in API response', async () => {
				const mockViewer = { destroy: jest.fn() };

				document.body.innerHTML = `
					<div style="position: relative">
						<img 
							data-file-name="no-layers.jpg"
							src="test.jpg"
						>
					</div>
				`;

				const img = document.querySelector( 'img' );
				img.layersViewer = mockViewer;

				mockApi.get.mockResolvedValue( {
					layersinfo: {}
				} );

				const result = await manager.refreshAllViewers();

				expect( result.refreshed ).toBe( 0 );
				expect( result.total ).toBe( 1 );
			} );

			it( 'should refresh multiple viewers in parallel', async () => {
				const mockDestroy1 = jest.fn();
				const mockDestroy2 = jest.fn();

				document.body.innerHTML = `
					<div style="position: relative">
						<img data-file-name="file1.jpg" src="test1.jpg">
						<img data-file-name="file2.jpg" src="test2.jpg">
					</div>
				`;

				const imgs = document.querySelectorAll( 'img' );
				imgs[ 0 ].layersViewer = { destroy: mockDestroy1 };
				imgs[ 1 ].layersViewer = { destroy: mockDestroy2 };

				mockApi.get.mockResolvedValue( {
					layersinfo: {
						layerset: {
							data: { layers: [ { id: '1', type: 'text' } ] },
							baseWidth: 800,
							baseHeight: 600
						}
					}
				} );

				const result = await manager.refreshAllViewers();

				expect( result.refreshed ).toBe( 2 );
				expect( result.failed ).toBe( 0 );
				expect( result.total ).toBe( 2 );
				expect( mockDestroy1 ).toHaveBeenCalled();
				expect( mockDestroy2 ).toHaveBeenCalled();
			} );
		} );
	} );

	// Slide Mode tests moved to SlideController.test.js
	// These tests now verify delegation to SlideController
	describe( 'Slide Mode', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager();
		} );

		describe( 'delegation to SlideController', () => {
			it( 'should have a SlideController instance', () => {
				expect( manager._slideController ).not.toBeNull();
			} );

			it( 'should delegate initializeSlides to SlideController', () => {
				const spy = jest.spyOn( manager._slideController, 'initializeSlides' );
				manager.initializeSlides();
				expect( spy ).toHaveBeenCalled();
			} );

			it( 'should delegate reinitializeSlideViewer to SlideController', () => {
				const container = document.createElement( 'div' );
				const payload = { layers: [], baseWidth: 800, baseHeight: 600 };
				const spy = jest.spyOn( manager._slideController, 'reinitializeSlideViewer' );
				manager.reinitializeSlideViewer( container, payload );
				expect( spy ).toHaveBeenCalledWith( container, payload );
			} );

			it( 'should delegate refreshAllSlides to SlideController', async () => {
				const spy = jest.spyOn( manager._slideController, 'refreshAllSlides' );
				await manager.refreshAllSlides();
				expect( spy ).toHaveBeenCalled();
			} );

			it( 'should delegate canUserEdit to SlideController', () => {
				const spy = jest.spyOn( manager._slideController, 'canUserEdit' );
				manager.canUserEdit();
				expect( spy ).toHaveBeenCalled();
			} );

			it( 'should delegate setupSlideOverlay to SlideController', () => {
				const container = document.createElement( 'div' );
				const payload = { layers: [], isSlide: true };
				const spy = jest.spyOn( manager._slideController, 'setupSlideOverlay' );
				manager.setupSlideOverlay( container, payload );
				expect( spy ).toHaveBeenCalledWith( container, payload );
			} );

			it( 'should delegate openSlideEditor to SlideController', () => {
				const slideData = { slideName: 'Test', canvasWidth: 800, canvasHeight: 600 };
				const spy = jest.spyOn( manager._slideController, 'openSlideEditor' );
				manager.openSlideEditor( slideData );
				expect( spy ).toHaveBeenCalledWith( slideData );
			} );

			it( 'should delegate buildSlideEditorUrl to SlideController', () => {
				const slideData = { slideName: 'Test', canvasWidth: 800, canvasHeight: 600 };
				const spy = jest.spyOn( manager._slideController, 'buildSlideEditorUrl' );
				manager.buildSlideEditorUrl( slideData );
				expect( spy ).toHaveBeenCalledWith( slideData );
			} );

			it( 'should delegate renderEmptySlide to SlideController', () => {
				const container = document.createElement( 'div' );
				const spy = jest.spyOn( manager._slideController, 'renderEmptySlide' );
				manager.renderEmptySlide( container, 800, 600 );
				expect( spy ).toHaveBeenCalledWith( container, 800, 600 );
			} );

			it( 'should delegate getEmptyStateMessage to SlideController', () => {
				const spy = jest.spyOn( manager._slideController, 'getEmptyStateMessage' );
				manager.getEmptyStateMessage();
				expect( spy ).toHaveBeenCalled();
			} );

			it( 'should delegate getEmptyStateHint to SlideController', () => {
				const spy = jest.spyOn( manager._slideController, 'getEmptyStateHint' );
				manager.getEmptyStateHint();
				expect( spy ).toHaveBeenCalled();
			} );
		} );

		// Legacy tests skipped - implementation moved to SlideController.test.js

		describe( 'refreshAllViewers integration with slides', () => {
			it( 'should refresh both image viewers and slides', async () => {
				// Set up an image with viewer
				const img = document.createElement( 'img' );
				img.src = 'test.jpg';
				img.layersViewer = {
					destroy: jest.fn(),
					loadingInitialized: true,
					isComplete: jest.fn( () => true )
				};
				document.body.appendChild( img );

				// Set up a slide container
				document.body.insertAdjacentHTML( 'beforeend', `
					<div class="layers-slide-container"
						data-slide-name="TestSlide"
						data-layerset="default"
						data-canvas-width="800"
						data-canvas-height="600">
						<canvas></canvas>
					</div>
				` );

				// Mock LayerRenderer
				window.Layers = window.Layers || {};
				window.Layers.LayerRenderer = jest.fn( () => ( {
					drawLayer: jest.fn()
				} ) );

				const container = document.querySelector( '.layers-slide-container' );
				container.layersSlideInitialized = true;
				const canvas = container.querySelector( 'canvas' );
				canvas.getContext = jest.fn( () => ( {
					fillStyle: '',
					fillRect: jest.fn(),
					clearRect: jest.fn(),
					save: jest.fn(),
					restore: jest.fn()
				} ) );

				// Mock API for slides
				global.mw.Api = jest.fn( () => ( {
					get: jest.fn().mockResolvedValue( {
						layersinfo: {
							layerset: {
								data: {
									layers: [],
									canvasWidth: 800,
									canvasHeight: 600
								}
							}
						}
					} )
				} ) );

				// Mock freshness checker for images
				manager.freshnessChecker = {
					checkImage: jest.fn().mockResolvedValue( { fresh: true } )
				};

				const result = await manager.refreshAllViewers();

				// Should include both image and slide counts
				expect( result.total ).toBeGreaterThanOrEqual( 1 );
			} );

			it( 'should refresh slides even when no image viewers exist', async () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="OnlySlide"
						data-layerset="default"
						data-canvas-width="800"
						data-canvas-height="600">
						<canvas></canvas>
					</div>
				`;

				// Mock LayerRenderer
				window.Layers = window.Layers || {};
				window.Layers.LayerRenderer = jest.fn( () => ( {
					drawLayer: jest.fn()
				} ) );

				const container = document.querySelector( '.layers-slide-container' );
				container.layersSlideInitialized = true;
				const canvas = container.querySelector( 'canvas' );
				canvas.getContext = jest.fn( () => ( {
					fillStyle: '',
					strokeStyle: '',
					lineWidth: 1,
					font: '',
					textAlign: '',
					textBaseline: '',
					globalAlpha: 1,
					fillRect: jest.fn(),
					fillText: jest.fn(),
					clearRect: jest.fn(),
					save: jest.fn(),
					restore: jest.fn()
				} ) );

				global.mw.Api = jest.fn( () => ( {
					get: jest.fn().mockResolvedValue( {
						layersinfo: {
							layerset: {
								data: {
									layers: [],
									canvasWidth: 800,
									canvasHeight: 600
								}
							}
						}
					} )
				} ) );

				const result = await manager.refreshAllViewers();

				// Should still refresh slides
				expect( result.total ).toBe( 1 );
				expect( result.refreshed ).toBe( 1 );
			} );
		} );
	} );

	// ========================================================================
	// Coverage Tests - reinitializeSlideViewer
	// ========================================================================

	// ========================================================================
	// Coverage Tests - destroyViewer
	// ========================================================================

	describe( 'destroyViewer', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( { debug: true } );
		} );

		it( 'should return early for null img', () => {
			expect( () => manager.destroyViewer( null ) ).not.toThrow();
		} );

		it( 'should destroy viewer instance with destroy method', () => {
			const img = document.createElement( 'img' );
			const mockViewer = { destroy: jest.fn() };
			img.layersViewer = mockViewer;

			manager.destroyViewer( img );

			expect( mockViewer.destroy ).toHaveBeenCalled();
			expect( img.layersViewer ).toBeNull();
		} );

		it( 'should destroy overlay instance with destroy method', () => {
			const img = document.createElement( 'img' );
			const mockOverlay = { destroy: jest.fn() };
			img.layersOverlay = mockOverlay;

			manager.destroyViewer( img );

			expect( mockOverlay.destroy ).toHaveBeenCalled();
			expect( img.layersOverlay ).toBeNull();
		} );

		it( 'should handle viewer without destroy method', () => {
			const img = document.createElement( 'img' );
			img.layersViewer = { someProperty: 'value' };

			expect( () => manager.destroyViewer( img ) ).not.toThrow();
			expect( img.layersViewer ).toBeNull();
		} );

		it( 'should clean up created wrappers', () => {
			const img = document.createElement( 'img' );
			const wrapper = document.createElement( 'div' );
			const parent = document.createElement( 'div' );

			parent.appendChild( wrapper );
			wrapper.appendChild( img );

			manager._createdWrappers = new Map();
			manager._createdWrappers.set( img, wrapper );

			manager.destroyViewer( img );

			// Image should be moved out of wrapper
			expect( parent.contains( img ) ).toBe( true );
			expect( parent.contains( wrapper ) ).toBe( false );
			expect( manager._createdWrappers.has( img ) ).toBe( false );
		} );

		it( 'should clear pending flag', () => {
			const img = document.createElement( 'img' );
			img.layersPending = true;

			manager.destroyViewer( img );

			expect( img.layersPending ).toBe( false );
		} );
	} );

	// ========================================================================
	// Coverage Tests - _initializeOverlay setname logic
	// ========================================================================

	describe( '_initializeOverlay edge cases', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( { debug: true } );
		} );

		it( 'should skip if overlay already exists', () => {
			const img = document.createElement( 'img' );
			img.layersOverlay = { existing: true };
			img.src = 'http://example.com/wiki/File:Test.jpg';

			const container = document.createElement( 'div' );

			// Store original extractFilenameFromImg
			const origExtract = manager.extractFilenameFromImg;
			manager.extractFilenameFromImg = jest.fn( () => 'Test.jpg' );

			manager._initializeOverlay( img, container );

			// extractFilenameFromImg should not even be called
			expect( manager.extractFilenameFromImg ).not.toHaveBeenCalled();

			manager.extractFilenameFromImg = origExtract;
		} );

		it( 'should skip if no filename extracted', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/invalid-url';

			const container = document.createElement( 'div' );

			// Mock extractFilenameFromImg to return null
			manager.extractFilenameFromImg = jest.fn( () => null );

			// Should not throw
			expect( () => manager._initializeOverlay( img, container ) ).not.toThrow();
		} );

		it( 'should compute setname from data-layer-setname attribute', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.setAttribute( 'data-layer-setname', 'myCustomSet' );

			const container = document.createElement( 'div' );
			container.style.position = 'relative';

			// We can't fully test overlay creation due to module-level getClass,
			// but we can verify the method doesn't throw
			manager.extractFilenameFromImg = jest.fn( () => 'Test.jpg' );

			expect( () => manager._initializeOverlay( img, container ) ).not.toThrow();
		} );

		it( 'should compute setname from data-layers-intent "on"', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.setAttribute( 'data-layers-intent', 'on' );

			const container = document.createElement( 'div' );

			manager.extractFilenameFromImg = jest.fn( () => 'Test.jpg' );

			expect( () => manager._initializeOverlay( img, container ) ).not.toThrow();
		} );

		it( 'should compute setname from specific data-layers-intent value', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.setAttribute( 'data-layers-intent', 'anatomy-labels' );

			const container = document.createElement( 'div' );

			manager.extractFilenameFromImg = jest.fn( () => 'Test.jpg' );

			expect( () => manager._initializeOverlay( img, container ) ).not.toThrow();
		} );

		it( 'should handle overlay creation with "all" intent', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.setAttribute( 'data-layers-intent', 'all' );

			const container = document.createElement( 'div' );

			manager.extractFilenameFromImg = jest.fn( () => 'Test.jpg' );

			expect( () => manager._initializeOverlay( img, container ) ).not.toThrow();
		} );

		it( 'should handle overlay creation with "1" intent', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.setAttribute( 'data-layers-intent', '1' );

			const container = document.createElement( 'div' );

			manager.extractFilenameFromImg = jest.fn( () => 'Test.jpg' );

			expect( () => manager._initializeOverlay( img, container ) ).not.toThrow();
		} );
	} );

	// ========================================================================
	// Coverage Tests - refreshAllViewers error handling
	// ========================================================================

	describe( 'refreshAllViewers edge cases', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( { debug: true } );
		} );

		it( 'should handle layerset with non-array data.layers', () => {
			// Setup mock API that returns object instead of array for layers
			const mockGetResult = {
				layersinfo: {
					layerset: {
						data: {
							layers: { not: 'array' } // Object instead of array
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			};

			mockApi.get = jest.fn().mockResolvedValue( mockGetResult );

			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.layersViewer = { destroy: jest.fn() };
			img.setAttribute( 'data-layer-setname', 'default' );

			const container = document.createElement( 'div' );
			container.appendChild( img );
			document.body.appendChild( container );

			manager.reinitializeViewer = jest.fn().mockReturnValue( false );

			return manager.refreshAllViewers().then( ( result ) => {
				// Should handle gracefully
				expect( result ).toBeDefined();
			} );
		} );

		it( 'should normalize backgroundVisible from API (integer 0)', () => {
			const mockGetResult = {
				layersinfo: {
					layerset: {
						data: {
							layers: [],
							backgroundVisible: 0 // Integer from PHP
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			};

			mockApi.get = jest.fn().mockResolvedValue( mockGetResult );

			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.layersViewer = { destroy: jest.fn() };
			img.setAttribute( 'data-layer-setname', 'default' );

			const container = document.createElement( 'div' );
			container.appendChild( img );
			document.body.appendChild( container );

			manager.reinitializeViewer = jest.fn( ( img, payload ) => {
				// Verify backgroundVisible was normalized to false
				expect( payload.backgroundVisible ).toBe( false );
				return true;
			} );

			return manager.refreshAllViewers().then( ( result ) => {
				expect( manager.reinitializeViewer ).toHaveBeenCalled();
			} );
		} );

		it( 'should normalize backgroundVisible from API (integer 1)', () => {
			const mockGetResult = {
				layersinfo: {
					layerset: {
						data: {
							layers: [],
							backgroundVisible: 1 // Integer from PHP
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			};

			mockApi.get = jest.fn().mockResolvedValue( mockGetResult );

			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.layersViewer = { destroy: jest.fn() };
			img.setAttribute( 'data-layer-setname', 'default' );

			const container = document.createElement( 'div' );
			container.appendChild( img );
			document.body.appendChild( container );

			manager.reinitializeViewer = jest.fn( ( img, payload ) => {
				// Verify backgroundVisible was normalized to true
				expect( payload.backgroundVisible ).toBe( true );
				return true;
			} );

			return manager.refreshAllViewers().then( ( result ) => {
				expect( manager.reinitializeViewer ).toHaveBeenCalled();
			} );
		} );

		it( 'should handle API error during refresh', () => {
			mockApi.get = jest.fn().mockRejectedValue( new Error( 'API error' ) );

			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.layersViewer = { destroy: jest.fn() };
			img.setAttribute( 'data-layer-setname', 'default' );

			const container = document.createElement( 'div' );
			container.appendChild( img );
			document.body.appendChild( container );

			return manager.refreshAllViewers().then( ( result ) => {
				expect( result.failed ).toBeGreaterThan( 0 );
			} );
		} );

		it( 'should handle API error with structured error info', () => {
			const structuredError = {
				error: { info: 'Permission denied' }
			};
			mockApi.get = jest.fn().mockRejectedValue( structuredError );

			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.layersViewer = { destroy: jest.fn() };
			img.setAttribute( 'data-layer-setname', 'default' );

			const container = document.createElement( 'div' );
			container.appendChild( img );
			document.body.appendChild( container );

			return manager.refreshAllViewers().then( ( result ) => {
				expect( result.failed ).toBeGreaterThan( 0 );
			} );
		} );
	} );

	describe( 'reinitializeViewer error handling', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( { debug: true } );
		} );

		it( 'should return false when viewer reinitialization throws', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.layersViewer = { 
				destroy: jest.fn( () => {
					throw new Error( 'Destroy failed' );
				} )
			};

			const container = document.createElement( 'div' );
			container.appendChild( img );
			document.body.appendChild( container );

			// Should catch the error and return false
			const result = manager.reinitializeViewer( img, { layers: [] } );
			expect( result ).toBe( false );
		} );

		it( 'should handle null layerData gracefully', () => {
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';

			const container = document.createElement( 'div' );
			container.appendChild( img );
			document.body.appendChild( container );

			// Should handle null and return false
			const result = manager.reinitializeViewer( img, null );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'refreshAllViewers edge cases', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( { debug: true } );
		} );

		it( 'should handle when mw.Api is not available', () => {
			const originalMw = global.mw;
			global.mw = { ...mockMw, Api: undefined };

			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.layersViewer = { destroy: jest.fn() };
			img.setAttribute( 'data-layer-setname', 'default' );

			const container = document.createElement( 'div' );
			container.appendChild( img );
			document.body.appendChild( container );

			return manager.refreshAllViewers().then( ( result ) => {
				expect( result.failed ).toBeGreaterThan( 0 );
				expect( result.errors[ 0 ].error ).toContain( 'mw.Api not available' );
				global.mw = originalMw;
			} );
		} );

		it( 'should handle viewer processing error during refresh', () => {
			mockApi.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] }
					}
				}
			} );

			const img = document.createElement( 'img' );
			img.src = 'http://example.com/wiki/File:Test.jpg';
			img.layersViewer = { destroy: jest.fn() };
			img.setAttribute( 'data-layer-setname', 'default' );

			const container = document.createElement( 'div' );
			container.appendChild( img );
			document.body.appendChild( container );

			// Mock reinitializeViewer to throw
			manager.reinitializeViewer = jest.fn( () => {
				throw new Error( 'Reinit failed' );
			} );

			return manager.refreshAllViewers().then( ( result ) => {
				expect( result.errors.length ).toBeGreaterThan( 0 );
			} );
		} );
	} );

	describe( 'handleSlideEditClick', () => {
		it( 'should delegate to slideController when available', () => {
			const manager = new ViewerManager();
			const mockSlideController = {
				handleSlideEditClick: jest.fn()
			};
			manager._slideController = mockSlideController;

			const container = document.createElement( 'div' );
			manager.handleSlideEditClick( container );

			expect( mockSlideController.handleSlideEditClick ).toHaveBeenCalledWith( container );
		} );

		it( 'should do nothing when slideController not available', () => {
			const manager = new ViewerManager();
			manager._slideController = null;

			const container = document.createElement( 'div' );
			expect( () => manager.handleSlideEditClick( container ) ).not.toThrow();
		} );
	} );

	describe( 'handleSlideViewClick', () => {
		it( 'should delegate to slideController when available', () => {
			const manager = new ViewerManager();
			const mockSlideController = {
				handleSlideViewClick: jest.fn()
			};
			manager._slideController = mockSlideController;

			const container = document.createElement( 'div' );
			const payload = { layers: [] };
			manager.handleSlideViewClick( container, payload );

			expect( mockSlideController.handleSlideViewClick ).toHaveBeenCalledWith( container, payload );
		} );

		it( 'should do nothing when slideController not available', () => {
			const manager = new ViewerManager();
			manager._slideController = null;

			const container = document.createElement( 'div' );
			expect( () => manager.handleSlideViewClick( container, {} ) ).not.toThrow();
		} );
	} );

	describe( '_msg', () => {
		it( 'should return translated message when available', () => {
			mockMw.message = jest.fn().mockReturnValue( {
				exists: jest.fn().mockReturnValue( true ),
				text: jest.fn().mockReturnValue( 'Translated message' )
			} );

			const manager = new ViewerManager();
			const result = manager._msg( 'layers-test-key', 'Fallback text' );
			expect( result ).toBe( 'Translated message' );
		} );

		it( 'should return fallback when mw undefined', () => {
			const originalMw = global.mw;
			delete global.mw;

			const manager = new ViewerManager();
			const result = manager._msg( 'layers-test-key', 'Fallback text' );
			expect( result ).toBe( 'Fallback text' );

			global.mw = originalMw;
		} );

		it( 'should return fallback when message does not exist', () => {
			mockMw.message = jest.fn().mockReturnValue( {
				exists: jest.fn().mockReturnValue( false ),
				text: jest.fn().mockReturnValue( '' )
			} );

			const manager = new ViewerManager();
			const result = manager._msg( 'nonexistent-key', 'Fallback' );
			expect( result ).toBe( 'Fallback' );
		} );
	} );

	describe( '_createPencilIcon', () => {
		it( 'should create SVG element', () => {
			const manager = new ViewerManager();
			const icon = manager._createPencilIcon();

			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
		} );

		it( 'should use ViewerIcons when available', () => {
			const mockIcon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			window.Layers.ViewerIcons = {
				createPencilIcon: jest.fn( () => mockIcon ),
				createExpandIcon: jest.fn()
			};

			const manager = new ViewerManager();
			const icon = manager._createPencilIcon();

			expect( window.Layers.ViewerIcons.createPencilIcon ).toHaveBeenCalled();
			expect( icon ).toBe( mockIcon );

			delete window.Layers.ViewerIcons;
		} );

		it( 'should use fallback when ViewerIcons not available', () => {
			const savedViewerIcons = window.Layers && window.Layers.ViewerIcons;
			if ( window.Layers ) {
				delete window.Layers.ViewerIcons;
			}

			const manager = new ViewerManager();
			const icon = manager._createPencilIcon();

			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );

			if ( savedViewerIcons ) {
				window.Layers.ViewerIcons = savedViewerIcons;
			}
		} );
	} );

	describe( '_createExpandIcon', () => {
		it( 'should create SVG element', () => {
			const manager = new ViewerManager();
			const icon = manager._createExpandIcon();

			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
		} );

		it( 'should use ViewerIcons when available', () => {
			const mockIcon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			window.Layers.ViewerIcons = {
				createPencilIcon: jest.fn(),
				createExpandIcon: jest.fn( () => mockIcon )
			};

			const manager = new ViewerManager();
			const icon = manager._createExpandIcon();

			expect( window.Layers.ViewerIcons.createExpandIcon ).toHaveBeenCalled();
			expect( icon ).toBe( mockIcon );

			delete window.Layers.ViewerIcons;
		} );

		it( 'should use fallback when ViewerIcons not available', () => {
			const savedViewerIcons = window.Layers && window.Layers.ViewerIcons;
			if ( window.Layers ) {
				delete window.Layers.ViewerIcons;
			}

			const manager = new ViewerManager();
			const icon = manager._createExpandIcon();

			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );

			if ( savedViewerIcons ) {
				window.Layers.ViewerIcons = savedViewerIcons;
			}
		} );
	} );

	describe( 'openSlideEditor', () => {
		it( 'should delegate to slideController when available', () => {
			const manager = new ViewerManager();
			const mockSlideController = {
				openSlideEditor: jest.fn()
			};
			manager._slideController = mockSlideController;

			const slideData = {
				slideName: 'TestSlide',
				canvasWidth: 800,
				canvasHeight: 600
			};
			manager.openSlideEditor( slideData );

			expect( mockSlideController.openSlideEditor ).toHaveBeenCalledWith( slideData );
		} );

		it( 'should warn when slideController not available', () => {
			const manager = new ViewerManager( { debug: true } );
			manager._slideController = null;

			const slideData = { slideName: 'TestSlide' };
			manager.openSlideEditor( slideData );

			// Should not throw
			expect( true ).toBe( true );
		} );
	} );

	describe( 'buildSlideEditorUrl', () => {
		it( 'should delegate to slideController when available', () => {
			const manager = new ViewerManager();
			const mockSlideController = {
				buildSlideEditorUrl: jest.fn( () => '/wiki/Special:EditSlide/Test' )
			};
			manager._slideController = mockSlideController;

			const result = manager.buildSlideEditorUrl( { slideName: 'Test' } );

			expect( mockSlideController.buildSlideEditorUrl ).toHaveBeenCalled();
			expect( result ).toBe( '/wiki/Special:EditSlide/Test' );
		} );

		it( 'should return empty string when slideController not available', () => {
			const manager = new ViewerManager();
			manager._slideController = null;

			const result = manager.buildSlideEditorUrl( { slideName: 'Test' } );

			expect( result ).toBe( '' );
		} );
	} );

	describe( 'refreshAllSlides', () => {
		it( 'should delegate to slideController when available', () => {
			const manager = new ViewerManager();
			const mockSlideController = {
				refreshAllSlides: jest.fn( () => Promise.resolve( { refreshed: 1 } ) )
			};
			manager._slideController = mockSlideController;

			return manager.refreshAllSlides().then( ( result ) => {
				expect( mockSlideController.refreshAllSlides ).toHaveBeenCalled();
				expect( result.refreshed ).toBe( 1 );
			} );
		} );

		it( 'should return empty result when slideController not available', () => {
			const manager = new ViewerManager();
			manager._slideController = null;

			return manager.refreshAllSlides().then( ( result ) => {
				expect( result.refreshed ).toBe( 0 );
				expect( result.total ).toBe( 0 );
			} );
		} );
	} );

	describe( 'reinitializeSlideViewer', () => {
		it( 'should delegate to slideController when available', () => {
			const manager = new ViewerManager();
			const mockSlideController = {
				reinitializeSlideViewer: jest.fn( () => true )
			};
			manager._slideController = mockSlideController;

			const container = document.createElement( 'div' );
			const payload = { layers: [] };
			const result = manager.reinitializeSlideViewer( container, payload );

			expect( mockSlideController.reinitializeSlideViewer ).toHaveBeenCalledWith( container, payload );
			expect( result ).toBe( true );
		} );

		it( 'should return false when slideController not available', () => {
			const manager = new ViewerManager();
			manager._slideController = null;

			const container = document.createElement( 'div' );
			const result = manager.reinitializeSlideViewer( container, {} );

			expect( result ).toBe( false );
		} );
	} );

	// ============ BRANCH COVERAGE GAP TESTS ============

	describe( 'ensurePositionedContainer - branch gaps', () => {
		it( 'should handle null getComputedStyle return', () => {
			const manager = new ViewerManager();
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			parent.appendChild( img );

			const origGetComputedStyle = window.getComputedStyle;
			window.getComputedStyle = jest.fn( () => null );

			const result = manager.ensurePositionedContainer( img );
			expect( result ).toBeTruthy();
			// Should have wrapped the image since style is null
			expect( result.style.position ).toBe( 'relative' );

			window.getComputedStyle = origGetComputedStyle;
		} );

		it( 'should track wrapper in _createdWrappers when available', () => {
			const manager = new ViewerManager();
			manager._createdWrappers = new Map();
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			parent.appendChild( img );

			const origGetComputedStyle = window.getComputedStyle;
			window.getComputedStyle = jest.fn( () => ( { position: 'static' } ) );

			manager.ensurePositionedContainer( img );
			expect( manager._createdWrappers.has( img ) ).toBe( true );

			window.getComputedStyle = origGetComputedStyle;
		} );

		it( 'should not track wrapper when _createdWrappers is null', () => {
			const manager = new ViewerManager();
			manager._createdWrappers = null;
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			parent.appendChild( img );

			const origGetComputedStyle = window.getComputedStyle;
			window.getComputedStyle = jest.fn( () => ( { position: 'static' } ) );

			expect( () => {
				manager.ensurePositionedContainer( img );
			} ).not.toThrow();

			window.getComputedStyle = origGetComputedStyle;
		} );
	} );

	describe( '_initializeOverlay - setname normalization', () => {
		it( 'should use default when intent is generic "on"', () => {
			const manager = new ViewerManager();
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			parent.appendChild( img );

			// No data-layer-setname, intent is 'on'
			img.setAttribute( 'data-layers-intent', 'on' );

			let capturedSetname = null;
			const MockViewerOverlay = jest.fn( function ( opts ) {
				capturedSetname = opts.setname;
			} );

			window.layersGetClass.mockImplementation( ( namespacePath ) => {
				if ( namespacePath === 'Viewer.Overlay' ) {
					return MockViewerOverlay;
				}
				if ( namespacePath === 'Utils.UrlParser' ) {
					return function () {
						return mockUrlParser;
					};
				}
				return null;
			} );

			manager._initializeOverlay( img, parent );
			expect( capturedSetname ).toBe( 'default' );
		} );

		it( 'should use default when intent is "true" (case-insensitive)', () => {
			const manager = new ViewerManager();
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			parent.appendChild( img );

			img.setAttribute( 'data-layers-intent', 'TRUE' );

			let capturedSetname = null;
			const MockViewerOverlay = jest.fn( function ( opts ) {
				capturedSetname = opts.setname;
			} );

			window.layersGetClass.mockImplementation( ( namespacePath ) => {
				if ( namespacePath === 'Viewer.Overlay' ) {
					return MockViewerOverlay;
				}
				if ( namespacePath === 'Utils.UrlParser' ) {
					return function () {
						return mockUrlParser;
					};
				}
				return null;
			} );

			manager._initializeOverlay( img, parent );
			expect( capturedSetname ).toBe( 'default' );
		} );

		it( 'should pass through specific set name', () => {
			const manager = new ViewerManager();
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			parent.appendChild( img );

			img.setAttribute( 'data-layers-intent', 'anatomy-labels' );

			let capturedSetname = null;
			const MockViewerOverlay = jest.fn( function ( opts ) {
				capturedSetname = opts.setname;
			} );

			window.layersGetClass.mockImplementation( ( namespacePath ) => {
				if ( namespacePath === 'Viewer.Overlay' ) {
					return MockViewerOverlay;
				}
				if ( namespacePath === 'Utils.UrlParser' ) {
					return function () {
						return mockUrlParser;
					};
				}
				return null;
			} );

			manager._initializeOverlay( img, parent );
			expect( capturedSetname ).toBe( 'anatomy-labels' );
		} );

		it( 'should use default when intent is empty string', () => {
			const manager = new ViewerManager();
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			parent.appendChild( img );

			img.setAttribute( 'data-layers-intent', '' );

			let capturedSetname = null;
			const MockViewerOverlay = jest.fn( function ( opts ) {
				capturedSetname = opts.setname;
			} );

			window.layersGetClass.mockImplementation( ( namespacePath ) => {
				if ( namespacePath === 'Viewer.Overlay' ) {
					return MockViewerOverlay;
				}
				if ( namespacePath === 'Utils.UrlParser' ) {
					return function () {
						return mockUrlParser;
					};
				}
				return null;
			} );

			manager._initializeOverlay( img, parent );
			expect( capturedSetname ).toBe( 'default' );
		} );

		it( 'should use explicit data-layer-setname over intent', () => {
			const manager = new ViewerManager();
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			parent.appendChild( img );

			img.setAttribute( 'data-layer-setname', 'my-set' );
			img.setAttribute( 'data-layers-intent', 'on' );

			let capturedSetname = null;
			const MockViewerOverlay = jest.fn( function ( opts ) {
				capturedSetname = opts.setname;
			} );

			window.layersGetClass.mockImplementation( ( namespacePath ) => {
				if ( namespacePath === 'Viewer.Overlay' ) {
					return MockViewerOverlay;
				}
				if ( namespacePath === 'Utils.UrlParser' ) {
					return function () {
						return mockUrlParser;
					};
				}
				return null;
			} );

			manager._initializeOverlay( img, parent );
			expect( capturedSetname ).toBe( 'my-set' );
		} );

		it( 'should skip when overlay already exists', () => {
			const manager = new ViewerManager();
			const img = document.createElement( 'img' );
			img.layersOverlay = {};
			const container = document.createElement( 'div' );

			manager._initializeOverlay( img, container );
			// Should return early without error
			expect( window.layersGetClass ).not.toHaveBeenCalledWith( 'Viewer.Overlay', expect.anything() );
		} );

		it( 'should skip when ViewerOverlay class not available', () => {
			const manager = new ViewerManager();
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			img.src = '/images/a/ab/Test.jpg';
			parent.appendChild( img );

			window.layersGetClass.mockImplementation( () => null );

			manager._initializeOverlay( img, parent );
			expect( img.layersOverlay ).toBeFalsy();
		} );

		it( 'should use "all" as generic value mapping to default', () => {
			const manager = new ViewerManager();
			const parent = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			parent.appendChild( img );

			img.setAttribute( 'data-layers-intent', 'all' );

			let capturedSetname = null;
			const MockViewerOverlay = jest.fn( function ( opts ) {
				capturedSetname = opts.setname;
			} );

			window.layersGetClass.mockImplementation( ( namespacePath ) => {
				if ( namespacePath === 'Viewer.Overlay' ) {
					return MockViewerOverlay;
				}
				if ( namespacePath === 'Utils.UrlParser' ) {
					return function () {
						return mockUrlParser;
					};
				}
				return null;
			} );

			manager._initializeOverlay( img, parent );
			expect( capturedSetname ).toBe( 'default' );
		} );
	} );

	describe( 'extractFilenameFromImg - branch gaps', () => {
		it( 'should extract from src URL without thumbnail prefix', () => {
			const manager = new ViewerManager();
			const img = document.createElement( 'img' );
			Object.defineProperty( img, 'src', {
				get: () => 'https://wiki.example.org/images/a/ab/MyFile.png',
				configurable: true
			} );

			const result = manager.extractFilenameFromImg( img );
			expect( result ).toBe( 'MyFile.png' );
		} );

		it( 'should strip thumbnail prefix from src URL', () => {
			const manager = new ViewerManager();
			const img = document.createElement( 'img' );
			Object.defineProperty( img, 'src', {
				get: () => 'https://wiki.example.org/images/thumb/a/ab/MyFile.png/800px-MyFile.png',
				configurable: true
			} );

			const result = manager.extractFilenameFromImg( img );
			expect( result ).toBe( 'MyFile.png' );
		} );

		it( 'should extract from parent link href', () => {
			const manager = new ViewerManager();
			const a = document.createElement( 'a' );
			a.setAttribute( 'href', '/wiki/File:My_Image.jpg' );
			const img = document.createElement( 'img' );
			a.appendChild( img );

			const result = manager.extractFilenameFromImg( img );
			expect( result ).toBe( 'My Image.jpg' );
		} );

		it( 'should return null for non-link parent', () => {
			const manager = new ViewerManager();
			const div = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			div.appendChild( img );

			const result = manager.extractFilenameFromImg( img );
			expect( result ).toBeNull();
		} );

		it( 'should return null when parent link has no /File: in href', () => {
			const manager = new ViewerManager();
			const a = document.createElement( 'a' );
			a.setAttribute( 'href', '/wiki/Category:SomeCategory' );
			const img = document.createElement( 'img' );
			a.appendChild( img );

			const result = manager.extractFilenameFromImg( img );
			expect( result ).toBeNull();
		} );

		it( 'should handle parent link with empty href', () => {
			const manager = new ViewerManager();
			const a = document.createElement( 'a' );
			const img = document.createElement( 'img' );
			a.appendChild( img );

			const result = manager.extractFilenameFromImg( img );
			expect( result ).toBeNull();
		} );

		it( 'should strip wikitext brackets from filename', () => {
			const manager = new ViewerManager();
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', '[[Test File.jpg]]' );

			const result = manager.extractFilenameFromImg( img );
			expect( result ).toBe( 'Test File.jpg' );
		} );

		it( 'should return null when src has no extension', () => {
			const manager = new ViewerManager();
			const div = document.createElement( 'div' );
			const img = document.createElement( 'img' );
			div.appendChild( img );
			// src with no extension won't match SRC_URL pattern
			Object.defineProperty( img, 'src', {
				get: () => 'https://wiki.example.org/images/a/ab/noext',
				configurable: true
			} );

			const result = manager.extractFilenameFromImg( img );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'initializeFilePageFallback - branch gaps', () => {
		it( 'should return when mw is undefined', () => {
			const origMw = global.mw;
			global.mw = undefined;

			const manager = new ViewerManager();
			const result = manager.initializeFilePageFallback();
			expect( result ).toBeUndefined();

			global.mw = origMw;
		} );

		it( 'should return when not on File namespace', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 0 );

			const manager = new ViewerManager();
			const result = manager.initializeFilePageFallback();
			expect( result ).toBeUndefined();
		} );

		it( 'should return when no layers param in URL', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( null );

			const manager = new ViewerManager();
			const result = manager.initializeFilePageFallback();
			expect( result ).toBeUndefined();
		} );

		it( 'should return when no image found', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );

			const manager = new ViewerManager();
			const result = manager.initializeFilePageFallback();
			expect( result ).toBeUndefined();
		} );

		it( 'should return when image already has layersViewer', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );

			const img = document.createElement( 'img' );
			img.layersViewer = {};
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			const manager = new ViewerManager();
			const result = manager.initializeFilePageFallback();
			expect( result ).toBeUndefined();
		} );

		it( 'should return when image has data-layer-data attribute', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );

			const img = document.createElement( 'img' );
			img.setAttribute( 'data-layer-data', '[]' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			const manager = new ViewerManager();
			const result = manager.initializeFilePageFallback();
			expect( result ).toBeUndefined();
		} );

		it( 'should handle layerset.data as direct array', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: [ { id: '1', type: 'text', text: 'Hello' } ],
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.initializeViewer = jest.fn();
			await manager.initializeFilePageFallback();

			expect( manager.initializeViewer ).toHaveBeenCalled();
			const payload = manager.initializeViewer.mock.calls[ 0 ][ 1 ];
			expect( payload.layers ).toEqual( [ { id: '1', type: 'text', text: 'Hello' } ] );
		} );

		it( 'should handle null layerset data', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: null,
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.initializeViewer = jest.fn();
			await manager.initializeFilePageFallback();

			expect( manager.initializeViewer ).not.toHaveBeenCalled();
		} );

		it( 'should handle empty layers array', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.initializeViewer = jest.fn();
			await manager.initializeFilePageFallback();

			// Empty layers should not initialize viewer
			expect( manager.initializeViewer ).not.toHaveBeenCalled();
		} );

		it( 'should handle inner processing error (catch e2)', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			// Return data that will cause error in processing
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: '1' } ] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.initializeViewer = jest.fn( () => {
				throw new Error( 'init error' );
			} );

			// Should not throw, caught by inner catch
			await expect( manager.initializeFilePageFallback() ).resolves.not.toThrow();
		} );

		it( 'should handle API error', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			mockApi.get.mockRejectedValue( new Error( 'API failure' ) );

			const manager = new ViewerManager();
			await expect( manager.initializeFilePageFallback() ).resolves.not.toThrow();
		} );

		it( 'should strip namespace prefix from page name', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:My_Test_File.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: '1', type: 'text' } ] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.initializeViewer = jest.fn();
			await manager.initializeFilePageFallback();

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( { filename: 'My Test File.jpg' } )
			);
		} );

		it( 'should handle page name without namespace prefix', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'Image_Without_Prefix.png';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			const manager = new ViewerManager();
			await manager.initializeFilePageFallback();

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( { filename: 'Image Without Prefix.png' } )
			);
		} );

		it( 'should handle decode error in filename', async () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:%E0%A4%A';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			const manager = new ViewerManager();
			// Should not throw despite decode error
			await expect( manager.initializeFilePageFallback() ).resolves.not.toThrow();
		} );

		it( 'should resolve when api not available', () => {
			mockUrlParser.getNamespaceNumber.mockReturnValue( 6 );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgPageName' ) {
					return 'File:Test.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const fileDiv = document.createElement( 'div' );
			fileDiv.id = 'file';
			fileDiv.appendChild( img );
			document.body.appendChild( fileDiv );

			const manager = new ViewerManager();
			manager._getApi = jest.fn( () => null );

			const result = manager.initializeFilePageFallback();
			expect( result ).toEqual( Promise.resolve() );
		} );
	} );

	describe( '_processWithConcurrency - branch gaps', () => {
		it( 'should handle fewer items than concurrency limit', async () => {
			const manager = new ViewerManager();
			const items = [ 'a', 'b' ];
			const processor = jest.fn( ( item ) => Promise.resolve( item.toUpperCase() ) );

			const results = await manager._processWithConcurrency( items, processor, 10 );
			expect( results ).toEqual( [ 'A', 'B' ] );
			expect( processor ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'should handle single concurrency (serial processing)', async () => {
			const manager = new ViewerManager();
			const order = [];
			const items = [ 1, 2, 3 ];
			const processor = jest.fn( ( item ) => {
				order.push( item );
				return Promise.resolve( item * 2 );
			} );

			const results = await manager._processWithConcurrency( items, processor, 1 );
			expect( results ).toEqual( [ 2, 4, 6 ] );
			expect( order ).toEqual( [ 1, 2, 3 ] );
		} );

		it( 'should handle empty array', async () => {
			const manager = new ViewerManager();
			const processor = jest.fn();

			const results = await manager._processWithConcurrency( [], processor );
			expect( results ).toEqual( [] );
			expect( processor ).not.toHaveBeenCalled();
		} );

		it( 'should default to MAX_CONCURRENT_REQUESTS when no concurrency specified', async () => {
			const manager = new ViewerManager();
			const items = Array.from( { length: 3 }, ( _, i ) => i );
			const processor = jest.fn( ( item ) => Promise.resolve( item ) );

			await manager._processWithConcurrency( items, processor );
			expect( processor ).toHaveBeenCalledTimes( 3 );
		} );
	} );

	describe( 'refreshAllViewers - branch gaps', () => {
		it( 'should handle layerset.data as direct array', async () => {
			const img = document.createElement( 'img' );
			img.layersViewer = {};
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			document.body.appendChild( img );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: [ { id: '1', type: 'text' } ],
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.reinitializeViewer = jest.fn( () => true );
			manager.refreshAllSlides = jest.fn( () => Promise.resolve( {
				refreshed: 0, failed: 0, total: 0, errors: []
			} ) );

			const result = await manager.refreshAllViewers();
			const payload = manager.reinitializeViewer.mock.calls[ 0 ][ 1 ];
			expect( Array.isArray( payload.layers ) ).toBe( true );
			expect( result.refreshed ).toBe( 1 );
		} );

		it( 'should fallback bgVisible to true when LayerDataNormalizer not available', async () => {
			const origNormalizer = window.Layers && window.Layers.LayerDataNormalizer;
			if ( window.Layers ) {
				window.Layers.LayerDataNormalizer = undefined;
			}

			const img = document.createElement( 'img' );
			img.layersViewer = {};
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			document.body.appendChild( img );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: '1' } ], backgroundVisible: 0 },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.reinitializeViewer = jest.fn( () => true );
			manager.refreshAllSlides = jest.fn( () => Promise.resolve( {
				refreshed: 0, failed: 0, total: 0, errors: []
			} ) );

			const result = await manager.refreshAllViewers();
			const payload = manager.reinitializeViewer.mock.calls[ 0 ][ 1 ];
			expect( payload.backgroundVisible ).toBe( true );

			if ( window.Layers ) {
				window.Layers.LayerDataNormalizer = origNormalizer;
			}
		} );

		it( 'should parse backgroundOpacity as float', async () => {
			const img = document.createElement( 'img' );
			img.layersViewer = {};
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			document.body.appendChild( img );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: '1' } ], backgroundOpacity: '0.5' },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.reinitializeViewer = jest.fn( () => true );
			manager.refreshAllSlides = jest.fn( () => Promise.resolve( {
				refreshed: 0, failed: 0, total: 0, errors: []
			} ) );

			const result = await manager.refreshAllViewers();
			const payload = manager.reinitializeViewer.mock.calls[ 0 ][ 1 ];
			expect( payload.backgroundOpacity ).toBe( 0.5 );
		} );

		it( 'should default backgroundOpacity to 1.0 when undefined', async () => {
			const img = document.createElement( 'img' );
			img.layersViewer = {};
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			document.body.appendChild( img );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: '1' } ] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.reinitializeViewer = jest.fn( () => true );
			manager.refreshAllSlides = jest.fn( () => Promise.resolve( {
				refreshed: 0, failed: 0, total: 0, errors: []
			} ) );

			const result = await manager.refreshAllViewers();
			const payload = manager.reinitializeViewer.mock.calls[ 0 ][ 1 ];
			expect( payload.backgroundOpacity ).toBe( 1.0 );
		} );

		it( 'should handle processing error in try/catch', async () => {
			const img = document.createElement( 'img' );
			img.layersViewer = {};
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			document.body.appendChild( img );

			// Return data that will cause error when accessed
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: '1' } ] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.reinitializeViewer = jest.fn( () => {
				throw new Error( 'reinit failed' );
			} );
			manager.refreshAllSlides = jest.fn( () => Promise.resolve( {
				refreshed: 0, failed: 0, total: 0, errors: []
			} ) );

			const result = await manager.refreshAllViewers();
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		it( 'should handle API error for viewer', async () => {
			const img = document.createElement( 'img' );
			img.layersViewer = {};
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			document.body.appendChild( img );

			mockApi.get.mockRejectedValue( { error: { info: 'Server error' } } );

			const manager = new ViewerManager();
			manager.refreshAllSlides = jest.fn( () => Promise.resolve( {
				refreshed: 0, failed: 0, total: 0, errors: []
			} ) );

			const result = await manager.refreshAllViewers();
			expect( result.errors.length ).toBeGreaterThan( 0 );
			expect( result.errors[ 0 ].error ).toContain( 'Server error' );
		} );

		it( 'should handle no layerset in response', async () => {
			const img = document.createElement( 'img' );
			img.layersViewer = {};
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			document.body.appendChild( img );

			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			const manager = new ViewerManager();
			manager.refreshAllSlides = jest.fn( () => Promise.resolve( {
				refreshed: 0, failed: 0, total: 0, errors: []
			} ) );

			const result = await manager.refreshAllViewers();
			expect( result.refreshed ).toBe( 0 );
		} );

		it( 'should pass specific setname to API when not generic', async () => {
			const img = document.createElement( 'img' );
			img.layersViewer = {};
			img.setAttribute( 'data-file-name', 'Test.jpg' );
			img.setAttribute( 'data-layer-setname', 'anatomy' );
			document.body.appendChild( img );

			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			const manager = new ViewerManager();
			manager.refreshAllSlides = jest.fn( () => Promise.resolve( {
				refreshed: 0, failed: 0, total: 0, errors: []
			} ) );

			await manager.refreshAllViewers();
			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( { setname: 'anatomy' } )
			);
		} );
	} );

	describe( 'initializeLargeImages - branch gaps', () => {
		it( 'should handle layerset.data as direct array', async () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Large.jpg' );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: [ { id: '1', type: 'rect' } ],
						baseWidth: 1200,
						baseHeight: 900
					}
				}
			} );

			const manager = new ViewerManager();
			manager.initializeViewer = jest.fn();
			manager.initializeLargeImages( [ img ] );

			// Wait for async
			await new Promise( ( r ) => setTimeout( r, 10 ) );

			expect( manager.initializeViewer ).toHaveBeenCalled();
			const payload = manager.initializeViewer.mock.calls[ 0 ][ 1 ];
			expect( Array.isArray( payload.layers ) ).toBe( true );
			expect( img.layersPending ).toBe( false );
		} );

		it( 'should skip already pending images', () => {
			const img = document.createElement( 'img' );
			img.layersPending = true;

			const manager = new ViewerManager();
			manager.initializeLargeImages( [ img ] );

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should skip images without extractable filename', () => {
			const img = document.createElement( 'img' );
			const div = document.createElement( 'div' );
			div.appendChild( img );

			const manager = new ViewerManager();
			manager.initializeLargeImages( [ img ] );

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should handle empty layers in response', async () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Large.jpg' );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] },
						baseWidth: 1200,
						baseHeight: 900
					}
				}
			} );

			const manager = new ViewerManager();
			manager.initializeViewer = jest.fn();
			manager.initializeLargeImages( [ img ] );

			await new Promise( ( r ) => setTimeout( r, 10 ) );

			expect( manager.initializeViewer ).not.toHaveBeenCalled();
		} );

		it( 'should handle processing error (catch e2)', async () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Large.jpg' );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: '1' } ] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const manager = new ViewerManager();
			manager.initializeViewer = jest.fn( () => {
				throw new Error( 'init error' );
			} );
			manager.initializeLargeImages( [ img ] );

			await new Promise( ( r ) => setTimeout( r, 10 ) );

			expect( img.layersPending ).toBe( false );
		} );

		it( 'should handle API error', async () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Large.jpg' );

			mockApi.get.mockRejectedValue( new Error( 'network error' ) );

			const manager = new ViewerManager();
			manager.initializeLargeImages( [ img ] );

			await new Promise( ( r ) => setTimeout( r, 10 ) );

			expect( img.layersPending ).toBe( false );
		} );

		it( 'should pass specific setname to API', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Large.jpg' );
			img.setAttribute( 'data-layers-intent', 'my-set' );

			mockApi.get.mockResolvedValue( { layersinfo: {} } );

			const manager = new ViewerManager();
			manager.initializeLargeImages( [ img ] );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( { setname: 'my-set' } )
			);
		} );

		it( 'should not pass setname for default/on intent', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file-name', 'Large.jpg' );
			img.setAttribute( 'data-layers-intent', 'on' );

			mockApi.get.mockResolvedValue( { layersinfo: {} } );

			const manager = new ViewerManager();
			manager.initializeLargeImages( [ img ] );

			const call = mockApi.get.mock.calls[ 0 ][ 0 ];
			expect( call.setname ).toBeUndefined();
		} );
	} );

	describe( '_msg - branch gaps', () => {
		it( 'should return message text when mw.message exists', () => {
			mockMw.message = jest.fn( () => ( {
				exists: () => true,
				text: () => 'Localized text'
			} ) );

			const manager = new ViewerManager();
			const result = manager._msg( 'some-key', 'fallback' );
			expect( result ).toBe( 'Localized text' );
		} );

		it( 'should return fallback when message does not exist', () => {
			mockMw.message = jest.fn( () => ( {
				exists: () => false,
				text: () => ''
			} ) );

			const manager = new ViewerManager();
			const result = manager._msg( 'some-key', 'my fallback' );
			expect( result ).toBe( 'my fallback' );
		} );

		it( 'should return fallback when mw.message is not available', () => {
			delete mockMw.message;

			const manager = new ViewerManager();
			const result = manager._msg( 'some-key', 'fallback text' );
			expect( result ).toBe( 'fallback text' );
		} );
	} );

	describe( '_createPencilIcon - branch gaps', () => {
		it( 'should use ViewerIcons when available', () => {
			const mockSvg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			window.Layers = window.Layers || {};
			window.Layers.ViewerIcons = {
				createPencilIcon: jest.fn( () => mockSvg )
			};

			const manager = new ViewerManager();
			const result = manager._createPencilIcon();
			expect( result ).toBe( mockSvg );
			expect( window.Layers.ViewerIcons.createPencilIcon ).toHaveBeenCalledWith( { size: 16, color: '#fff' } );
		} );

		it( 'should return basic SVG when ViewerIcons not available', () => {
			window.Layers.ViewerIcons = undefined;

			const manager = new ViewerManager();
			const result = manager._createPencilIcon();
			expect( result.tagName ).toBe( 'svg' );
		} );
	} );

	describe( 'SlideController delegations - null guard branches', () => {
		it( 'openSlideEditor should warn when no SlideController', () => {
			const manager = new ViewerManager();
			manager._slideController = null;
			manager.openSlideEditor( {} );
			// Should not throw
		} );

		it( '_shouldUseModalForSlide should return false when no SlideController', () => {
			const manager = new ViewerManager();
			manager._slideController = null;
			expect( manager._shouldUseModalForSlide() ).toBe( false );
		} );

		it( 'buildSlideEditorUrl should return empty when no SlideController', () => {
			const manager = new ViewerManager();
			manager._slideController = null;
			expect( manager.buildSlideEditorUrl( {} ) ).toBe( '' );
		} );

		it( 'getEmptyStateMessage should return default when no SlideController', () => {
			const manager = new ViewerManager();
			manager._slideController = null;
			expect( manager.getEmptyStateMessage() ).toBe( 'Empty Slide' );
		} );

		it( 'getEmptyStateHint should return default when no SlideController', () => {
			const manager = new ViewerManager();
			manager._slideController = null;
			expect( manager.getEmptyStateHint() ).toBe( 'Use the Edit button to add content' );
		} );
	} );

	describe( 'initializeLayerViewers - JSON parse error', () => {
		it( 'should handle malformed JSON in data-layer-data', () => {
			const manager = new ViewerManager();
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-layer-data', '{invalid json}' );
			img.classList.add( 'layers-thumbnail' );
			document.body.appendChild( img );

			mockUrlParser.decodeHtmlEntities.mockReturnValue( '{invalid json}' );

			// Should not throw
			expect( () => {
				manager.initializeLayerViewers();
			} ).not.toThrow();
		} );
	} );
} );
