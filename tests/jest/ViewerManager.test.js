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

	beforeEach( () => {
		jest.resetModules();
		document.body.innerHTML = '';

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
						wgCanonicalNamespace: ''
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
			return null;
		} );

		// Load module
		ViewerManager = require( '../../resources/ext.layers/viewer/ViewerManager.js' );
	} );

	afterEach( () => {
		delete global.mw;
		delete window.layersGetClass;
		delete window.Layers;
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default options', () => {
			const manager = new ViewerManager();
			expect( manager.debug ).toBeFalsy();
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
			manager = new ViewerManager( {
				urlParser: mockUrlParser,
				debug: true
			} );
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
			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

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

			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

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

			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

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

			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

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

			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

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

			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

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

			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

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
				await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );

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

				await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );

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
	} );
} );
