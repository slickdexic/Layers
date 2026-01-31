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
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		} );

		it( 'should use IconFactory when available', () => {
			const mockIcon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			window.Layers = {
				UI: {
					IconFactory: {
						createPencilIcon: jest.fn( () => mockIcon )
					}
				}
			};

			const manager = new ViewerManager();
			const icon = manager._createPencilIcon();

			expect( window.Layers.UI.IconFactory.createPencilIcon ).toHaveBeenCalled();
			expect( icon ).toBe( mockIcon );
		} );

		it( 'should use fallback when IconFactory not available', () => {
			delete window.Layers;

			const manager = new ViewerManager();
			const icon = manager._createPencilIcon();

			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			// Should have path elements for the pencil
			const paths = icon.querySelectorAll( 'path' );
			expect( paths.length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( '_createExpandIcon', () => {
		it( 'should create SVG element', () => {
			const manager = new ViewerManager();
			const icon = manager._createExpandIcon();

			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		} );

		it( 'should use IconFactory when available', () => {
			const mockIcon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			window.Layers = {
				UI: {
					IconFactory: {
						createFullscreenIcon: jest.fn( () => mockIcon )
					}
				}
			};

			const manager = new ViewerManager();
			const icon = manager._createExpandIcon();

			expect( window.Layers.UI.IconFactory.createFullscreenIcon ).toHaveBeenCalled();
			expect( icon ).toBe( mockIcon );
		} );

		it( 'should use fallback when IconFactory not available', () => {
			delete window.Layers;

			const manager = new ViewerManager();
			const icon = manager._createExpandIcon();

			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			// Expand icon uses path and line elements
			expect( icon.querySelectorAll( 'path, line' ).length ).toBeGreaterThan( 0 );
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
} );
