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

	describe( 'Slide Mode', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager();
		} );

		describe( 'setupSlideEditButton', () => {
			it( 'should bind click handler to edit button', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="TestSlide"
						data-lock-mode="none"
						data-canvas-width="800"
						data-canvas-height="600"
						data-background="#ffffff"
						data-layerset="default">
						<canvas></canvas>
						<button class="layers-slide-edit-button">Edit</button>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				const button = container.querySelector( '.layers-slide-edit-button' );

				manager.setupSlideEditButton( container );

				expect( button.layersClickBound ).toBe( true );
			} );

			it( 'should not double-bind click handler', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="TestSlide">
						<button class="layers-slide-edit-button">Edit</button>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				const button = container.querySelector( '.layers-slide-edit-button' );

				manager.setupSlideEditButton( container );
				manager.setupSlideEditButton( container );

				// Should still only have one handler
				expect( button.layersClickBound ).toBe( true );
			} );

			it( 'should handle missing edit button gracefully', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="TestSlide">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );

				// Should not throw
				expect( () => manager.setupSlideEditButton( container ) ).not.toThrow();
			} );

			it( 'should fire layers.slide.edit hook when clicked', () => {
				const hookFireSpy = jest.fn();
				global.mw.hook = jest.fn( () => ( {
					fire: hookFireSpy,
					add: jest.fn()
				} ) );

				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="MySlide"
						data-lock-mode="size"
						data-canvas-width="1024"
						data-canvas-height="768"
						data-background="#f0f0f0"
						data-layerset="annotations">
						<button class="layers-slide-edit-button">Edit</button>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				const button = container.querySelector( '.layers-slide-edit-button' );

				manager.setupSlideEditButton( container );
				button.click();

				expect( global.mw.hook ).toHaveBeenCalledWith( 'layers.slide.edit' );
				expect( hookFireSpy ).toHaveBeenCalledWith( expect.objectContaining( {
					slideName: 'MySlide',
					lockMode: 'size',
					canvasWidth: 1024,
					canvasHeight: 768,
					backgroundColor: '#f0f0f0',
					layerSetName: 'annotations',
					isSlide: true
				} ) );
			} );
		} );

		describe( 'buildSlideEditorUrl', () => {
			it( 'should build URL with slide name', () => {
				global.mw.util = {
					getUrl: jest.fn( ( page ) => '/wiki/' + page )
				};

				const url = manager.buildSlideEditorUrl( {
					slideName: 'TestSlide',
					layerSetName: 'default',
					canvasWidth: 800,
					canvasHeight: 600
				} );

				expect( url ).toContain( 'Special:EditSlide/TestSlide' );
				// Canvas dimensions are NOT passed in URL - server loads from saved data
				expect( url ).not.toContain( 'canvaswidth' );
				expect( url ).not.toContain( 'canvasheight' );
			} );

			it( 'should include setname when not default', () => {
				global.mw.util = {
					getUrl: jest.fn( ( page ) => '/wiki/' + page )
				};

				const url = manager.buildSlideEditorUrl( {
					slideName: 'TestSlide',
					layerSetName: 'custom-set',
					canvasWidth: 800,
					canvasHeight: 600
				} );

				expect( url ).toContain( 'setname=custom-set' );
			} );

			it( 'should include lockmode when not none', () => {
				global.mw.util = {
					getUrl: jest.fn( ( page ) => '/wiki/' + page )
				};

				const url = manager.buildSlideEditorUrl( {
					slideName: 'TestSlide',
					layerSetName: 'default',
					lockMode: 'size',
					canvasWidth: 800,
					canvasHeight: 600
				} );

				expect( url ).toContain( 'lockmode=size' );
			} );

			it( 'should not include bgcolor in URL (server loads from saved data)', () => {
				global.mw.util = {
					getUrl: jest.fn( ( page ) => '/wiki/' + page )
				};

				const url = manager.buildSlideEditorUrl( {
					slideName: 'TestSlide',
					layerSetName: 'default',
					canvasWidth: 800,
					canvasHeight: 600,
					backgroundColor: '#ff0000'
				} );

				// Background color is NOT passed in URL - server loads from saved data
				expect( url ).not.toContain( 'bgcolor=' );
			} );

			it( 'should use fallback URL when mw.util not available', () => {
				delete global.mw.util;

				const url = manager.buildSlideEditorUrl( {
					slideName: 'TestSlide',
					layerSetName: 'custom',
					lockMode: 'all',
					canvasWidth: 800,
					canvasHeight: 600
				} );

				expect( url ).toContain( '/wiki/Special:EditSlide/TestSlide' );
				expect( url ).toContain( 'setname=custom' );
				expect( url ).toContain( 'lockmode=all' );
			} );
		} );

		describe( 'renderEmptySlide', () => {
			it( 'should set canvas dimensions', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="EmptySlide"
						data-background="#ffffff">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				const canvas = container.querySelector( 'canvas' );

				manager.renderEmptySlide( container, 1024, 768 );

				expect( canvas.width ).toBe( 1024 );
				expect( canvas.height ).toBe( 768 );
			} );

			it( 'should fill with background color', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="ColoredSlide"
						data-background="#ff0000">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				const canvas = container.querySelector( 'canvas' );

				// Mock canvas context since jsdom doesn't support it
				const mockCtx = {
					fillStyle: '',
					fillRect: jest.fn(),
					save: jest.fn(),
					restore: jest.fn(),
					fillText: jest.fn(),
					font: '',
					textAlign: '',
					textBaseline: ''
				};
				canvas.getContext = jest.fn( () => mockCtx );

				manager.renderEmptySlide( container, 800, 600 );

				expect( mockCtx.fillRect ).toHaveBeenCalledWith( 0, 0, 800, 600 );
			} );

			it( 'should use default white background when not specified', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="DefaultBgSlide">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				const canvas = container.querySelector( 'canvas' );

				// Mock canvas context
				const fillStyleHistory = [];
				const mockCtx = {
					get fillStyle() {
						return this._fillStyle;
					},
					set fillStyle( val ) {
						this._fillStyle = val;
						fillStyleHistory.push( val );
					},
					_fillStyle: '',
					fillRect: jest.fn(),
					save: jest.fn(),
					restore: jest.fn(),
					fillText: jest.fn(),
					font: '',
					textAlign: '',
					textBaseline: ''
				};
				canvas.getContext = jest.fn( () => mockCtx );

				manager.renderEmptySlide( container, 800, 600 );

				// First fillStyle should be the background color (white as default)
				expect( fillStyleHistory[ 0 ] ).toBe( '#ffffff' );
			} );

			it( 'should handle missing canvas gracefully', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="NoCanvas">
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );

				// Should not throw
				expect( () => manager.renderEmptySlide( container, 800, 600 ) ).not.toThrow();
			} );

			it( 'should set up edit button after rendering', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="WithButton"
						data-background="#ffffff">
						<canvas></canvas>
						<button class="layers-slide-edit-button">Edit</button>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				const button = container.querySelector( '.layers-slide-edit-button' );

				manager.renderEmptySlide( container, 800, 600 );

				expect( button.layersClickBound ).toBe( true );
			} );
		} );

		describe( 'getEmptyStateMessage', () => {
			it( 'should return i18n message when available', () => {
				global.mw.message = jest.fn( () => ( {
					text: () => 'Translated Empty Slide'
				} ) );

				const message = manager.getEmptyStateMessage();

				expect( global.mw.message ).toHaveBeenCalledWith( 'layers-slide-empty' );
				expect( message ).toBe( 'Translated Empty Slide' );
			} );

			it( 'should return fallback when mw.message not available', () => {
				delete global.mw.message;

				const message = manager.getEmptyStateMessage();

				expect( message ).toBe( 'Empty Slide' );
			} );
		} );

		describe( 'getEmptyStateHint', () => {
			it( 'should return i18n hint when available', () => {
				global.mw.message = jest.fn( () => ( {
					text: () => 'Translated Click to add'
				} ) );

				const hint = manager.getEmptyStateHint();

				expect( global.mw.message ).toHaveBeenCalledWith( 'layers-slide-empty-hint' );
				expect( hint ).toBe( 'Translated Click to add' );
			} );

			it( 'should return fallback when mw.message not available', () => {
				delete global.mw.message;

				const hint = manager.getEmptyStateHint();

				expect( hint ).toBe( 'Use the Edit button to add content' );
			} );
		} );

		describe( 'drawEmptyStateContent', () => {
			it( 'should draw content on canvas context', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="DrawTest">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				const canvas = container.querySelector( 'canvas' );
				canvas.width = 800;
				canvas.height = 600;
				const ctx = canvas.getContext( '2d' );

				const saveSpy = jest.spyOn( ctx, 'save' );
				const restoreSpy = jest.spyOn( ctx, 'restore' );
				const fillTextSpy = jest.spyOn( ctx, 'fillText' );

				manager.drawEmptyStateContent( ctx, 800, 600, container );

				// Should save and restore context
				expect( saveSpy ).toHaveBeenCalled();
				expect( restoreSpy ).toHaveBeenCalled();

				// Should draw text
				expect( fillTextSpy ).toHaveBeenCalled();
			} );

			it( 'should use placeholder from data attribute if present', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="PlaceholderTest"
						data-placeholder="Custom placeholder text">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				const canvas = container.querySelector( 'canvas' );
				canvas.width = 800;
				canvas.height = 600;
				const ctx = canvas.getContext( '2d' );

				const fillTextSpy = jest.spyOn( ctx, 'fillText' );

				manager.drawEmptyStateContent( ctx, 800, 600, container );

				// Should include placeholder text in one of the fillText calls
				const calls = fillTextSpy.mock.calls;
				const hasPlaceholder = calls.some( ( call ) => call[ 0 ] === 'Custom placeholder text' );
				expect( hasPlaceholder ).toBe( true );
			} );
		} );

		describe( 'reinitializeSlideViewer', () => {
			it( 'should re-render slide canvas with new layer data', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="RefreshTest"
						data-canvas-width="800"
						data-canvas-height="600"
						data-background="#ffffff">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				container.layersSlideInitialized = true;

				const canvas = container.querySelector( 'canvas' );
				const mockCtx = {
					fillStyle: '',
					fillRect: jest.fn(),
					clearRect: jest.fn(),
					save: jest.fn(),
					restore: jest.fn()
				};
				canvas.getContext = jest.fn( () => mockCtx );

				// Mock LayerRenderer
				const mockDrawLayer = jest.fn();
				window.Layers = window.Layers || {};
				window.Layers.LayerRenderer = jest.fn( () => ( {
					drawLayer: mockDrawLayer
				} ) );

				// Payload format as sent to reinitializeSlideViewer (already extracted from API response)
				const payload = {
					layers: [
						{ id: 'layer1', type: 'rectangle', x: 10, y: 10, width: 100, height: 50, visible: true }
					],
					baseWidth: 800,
					baseHeight: 600,
					backgroundColor: '#ffffff'
				};

				const result = manager.reinitializeSlideViewer( container, payload );

				expect( result ).toBe( true );
				// Canvas should have been cleared and redrawn
				expect( mockCtx.clearRect ).toHaveBeenCalled();
				expect( mockCtx.fillRect ).toHaveBeenCalled();
				// Layer should have been rendered
				expect( mockDrawLayer ).toHaveBeenCalled();
			} );

			it( 'should return false if container has no canvas', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="NoCanvasTest">
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				container.layersSlideInitialized = true;

				// Payload format as sent to reinitializeSlideViewer
				const payload = {
					layers: [],
					baseWidth: 800,
					baseHeight: 600
				};

				const result = manager.reinitializeSlideViewer( container, payload );

				expect( result ).toBe( false );
			} );

			it( 'should return false if LayerRenderer is not available', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="NoRendererTest">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );

				const canvas = container.querySelector( 'canvas' );
				canvas.getContext = jest.fn( () => ( {
					clearRect: jest.fn(),
					fillRect: jest.fn(),
					fillStyle: ''
				} ) );

				// Ensure LayerRenderer is NOT available
				delete window.Layers;
				delete window.LayerRenderer;

				// Payload format as sent to reinitializeSlideViewer
				const payload = {
					layers: [],
					baseWidth: 800,
					baseHeight: 600
				};

				const result = manager.reinitializeSlideViewer( container, payload );

				expect( result ).toBe( false );
			} );

			it( 'should handle empty layers by rendering empty slide', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="EmptyLayersTest"
						data-canvas-width="800"
						data-canvas-height="600">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				container.layersSlideInitialized = true;

				const canvas = container.querySelector( 'canvas' );
				const mockCtx = {
					fillStyle: '',
					fillRect: jest.fn(),
					clearRect: jest.fn(),
					save: jest.fn(),
					restore: jest.fn(),
					fillText: jest.fn(),
					font: '',
					textAlign: '',
					textBaseline: ''
				};
				canvas.getContext = jest.fn( () => mockCtx );

				// Mock LayerRenderer
				window.Layers = window.Layers || {};
				window.Layers.LayerRenderer = jest.fn( () => ( {
					drawLayer: jest.fn()
				} ) );

				// Empty layers (no layerset saved yet)
				const payload = {
					layers: [],
					baseWidth: 800,
					baseHeight: 600,
					backgroundColor: '#ffffff'
				};

				const result = manager.reinitializeSlideViewer( container, payload );

				expect( result ).toBe( true );
				// Should render background
				expect( mockCtx.fillRect ).toHaveBeenCalled();
			} );

			it( 'should use canvas dimensions from payload data', () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="DimensionsTest"
						data-canvas-width="400"
						data-canvas-height="300">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				container.layersSlideInitialized = true;

				const canvas = container.querySelector( 'canvas' );
				const mockCtx = {
					fillStyle: '',
					fillRect: jest.fn(),
					clearRect: jest.fn(),
					save: jest.fn(),
					restore: jest.fn()
				};
				canvas.getContext = jest.fn( () => mockCtx );

				// Mock LayerRenderer
				window.Layers = window.Layers || {};
				window.Layers.LayerRenderer = jest.fn( () => ( {
					drawLayer: jest.fn()
				} ) );

				// Payload with new dimensions
				const payload = {
					layers: [],
					baseWidth: 1024,
					baseHeight: 768,
					backgroundColor: '#000000'
				};

				manager.reinitializeSlideViewer( container, payload );

				// Canvas dimensions should be updated from payload
				expect( canvas.width ).toBe( 1024 );
				expect( canvas.height ).toBe( 768 );
			} );
		} );

		describe( 'refreshAllSlides', () => {
			it( 'should refresh all initialized slide containers', async () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="Slide1"
						data-layerset="default"
						data-canvas-width="800"
						data-canvas-height="600">
						<canvas></canvas>
					</div>
					<div class="layers-slide-container"
						data-slide-name="Slide2"
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

				const containers = document.querySelectorAll( '.layers-slide-container' );
				containers.forEach( ( c ) => {
					c.layersSlideInitialized = true;
					const canvas = c.querySelector( 'canvas' );
					const mockCtx = {
						fillStyle: '',
						fillRect: jest.fn(),
						clearRect: jest.fn(),
						save: jest.fn(),
						restore: jest.fn()
					};
					canvas.getContext = jest.fn( () => mockCtx );
				} );

				// Mock API to return layer data
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

				const result = await manager.refreshAllSlides();

				expect( result.total ).toBe( 2 );
				expect( result.refreshed ).toBe( 2 );
				expect( result.failed ).toBe( 0 );
			} );

			it( 'should refresh all slide containers regardless of initialization state', async () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="Slide1"
						data-layerset="default"
						data-canvas-width="800"
						data-canvas-height="600">
						<canvas></canvas>
					</div>
					<div class="layers-slide-container"
						data-slide-name="Slide2"
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

				// One is marked initialized, one is not (simulates bfcache state loss)
				const [ slide1, slide2 ] = document.querySelectorAll( '.layers-slide-container' );
				slide1.layersSlideInitialized = true;
				// slide2 does NOT have layersSlideInitialized set (simulates bfcache)

				// Set up canvas mocks for both
				[ slide1, slide2 ].forEach( ( c ) => {
					const canvas = c.querySelector( 'canvas' );
					const mockCtx = {
						fillStyle: '',
						fillRect: jest.fn(),
						clearRect: jest.fn(),
						save: jest.fn(),
						restore: jest.fn()
					};
					canvas.getContext = jest.fn( () => mockCtx );
				} );

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

				const result = await manager.refreshAllSlides();

				// Both slides should be refreshed (not just initialized ones)
				expect( result.total ).toBe( 2 );
				expect( result.refreshed ).toBe( 2 );
			} );

			it( 'should return zeros when no slides exist', async () => {
				document.body.innerHTML = '<div>No slides here</div>';

				const result = await manager.refreshAllSlides();

				expect( result.total ).toBe( 0 );
				expect( result.refreshed ).toBe( 0 );
				expect( result.failed ).toBe( 0 );
				expect( result.errors ).toEqual( [] );
			} );

			it( 'should handle API errors gracefully', async () => {
				document.body.innerHTML = `
					<div class="layers-slide-container"
						data-slide-name="ErrorSlide"
						data-layerset="default"
						data-canvas-width="800"
						data-canvas-height="600">
						<canvas></canvas>
					</div>
				`;

				const container = document.querySelector( '.layers-slide-container' );
				// Note: layersSlideInitialized no longer required for refresh

				const canvas = container.querySelector( 'canvas' );
				canvas.getContext = jest.fn( () => ( {
					fillStyle: '',
					fillRect: jest.fn(),
					clearRect: jest.fn(),
					save: jest.fn(),
					restore: jest.fn()
				} ) );

				global.mw.Api = jest.fn( () => ( {
					get: jest.fn().mockRejectedValue( new Error( 'Network error' ) )
				} ) );

				const result = await manager.refreshAllSlides();

				expect( result.total ).toBe( 1 );
				expect( result.failed ).toBe( 1 );
				expect( result.refreshed ).toBe( 0 );
				expect( result.errors.length ).toBe( 1 );
				expect( result.errors[ 0 ].slideName ).toBe( 'ErrorSlide' );
			} );
		} );

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
					fillRect: jest.fn(),
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

	describe( 'Slide Overlay Functionality', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( { debug: true } );
		} );

		describe( 'setupSlideOverlay', () => {
			it( 'should create overlay with edit and view buttons when user can edit', () => {
				global.mw.config.get = jest.fn( ( key ) => {
					if ( key === 'wgLayersCanEdit' ) return true;
					return null;
				} );

				const container = document.createElement( 'div' );
				container.setAttribute( 'data-slide-name', 'TestSlide' );
				document.body.appendChild( container );

				const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

				manager.setupSlideOverlay( container, payload );

				const overlay = container.querySelector( '.layers-slide-overlay' );
				expect( overlay ).toBeTruthy();

				const editBtn = overlay.querySelector( '.layers-slide-overlay-btn--edit' );
				const viewBtn = overlay.querySelector( '.layers-slide-overlay-btn--view' );

				expect( editBtn ).toBeTruthy();
				expect( viewBtn ).toBeTruthy();
			} );

			it( 'should create overlay with only view button when user cannot edit', () => {
				global.mw.config.get = jest.fn( ( key ) => {
					if ( key === 'wgLayersCanEdit' ) return false;
					return null;
				} );

				const container = document.createElement( 'div' );
				container.setAttribute( 'data-slide-name', 'TestSlide' );
				document.body.appendChild( container );

				const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

				manager.setupSlideOverlay( container, payload );

				const overlay = container.querySelector( '.layers-slide-overlay' );
				expect( overlay ).toBeTruthy();

				const editBtn = overlay.querySelector( '.layers-slide-overlay-btn--edit' );
				const viewBtn = overlay.querySelector( '.layers-slide-overlay-btn--view' );

				expect( editBtn ).toBeNull();
				expect( viewBtn ).toBeTruthy();
			} );

			it( 'should remove old edit button if present', () => {
				const container = document.createElement( 'div' );
				container.setAttribute( 'data-slide-name', 'TestSlide' );
				const oldButton = document.createElement( 'button' );
				oldButton.className = 'layers-slide-edit-button';
				container.appendChild( oldButton );
				document.body.appendChild( container );

				const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

				manager.setupSlideOverlay( container, payload );

				expect( container.querySelector( '.layers-slide-edit-button' ) ).toBeNull();
			} );

			it( 'should not create duplicate overlay', () => {
				const container = document.createElement( 'div' );
				container.setAttribute( 'data-slide-name', 'TestSlide' );
				document.body.appendChild( container );

				const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

				manager.setupSlideOverlay( container, payload );
				manager.setupSlideOverlay( container, payload );

				const overlays = container.querySelectorAll( '.layers-slide-overlay' );
				expect( overlays.length ).toBe( 1 );
			} );
		} );

		describe( 'handleSlideEditClick', () => {
			it( 'should call openSlideEditor with correct parameters', () => {
				const container = document.createElement( 'div' );
				container.setAttribute( 'data-slide-name', 'MySlide' );
				container.setAttribute( 'data-lock-mode', 'size' );
				container.setAttribute( 'data-canvas-width', '1024' );
				container.setAttribute( 'data-canvas-height', '768' );
				container.setAttribute( 'data-background', '#ff0000' );
				container.setAttribute( 'data-layerset', 'custom-set' );

				manager.openSlideEditor = jest.fn();
				manager.handleSlideEditClick( container );

				expect( manager.openSlideEditor ).toHaveBeenCalledWith( {
					slideName: 'MySlide',
					lockMode: 'size',
					canvasWidth: 1024,
					canvasHeight: 768,
					backgroundColor: '#ff0000',
					layerSetName: 'custom-set'
				} );
			} );

			it( 'should use default values for missing attributes', () => {
				const container = document.createElement( 'div' );
				container.setAttribute( 'data-slide-name', 'MinimalSlide' );

				manager.openSlideEditor = jest.fn();
				manager.handleSlideEditClick( container );

				expect( manager.openSlideEditor ).toHaveBeenCalledWith(
					expect.objectContaining( {
						slideName: 'MinimalSlide',
						lockMode: 'none',
						canvasWidth: 800,
						canvasHeight: 600,
						backgroundColor: '#ffffff',
						layerSetName: 'default'
					} )
				);
			} );
		} );

		describe( 'handleSlideViewClick', () => {
			it( 'should open lightbox with canvas data', () => {
				const mockLightbox = {
					open: jest.fn()
				};
				const MockLightboxClass = jest.fn( () => mockLightbox );
				window.Layers = window.Layers || {};
				window.Layers.Viewer = { Lightbox: MockLightboxClass };

				const container = document.createElement( 'div' );
				container.setAttribute( 'data-slide-name', 'ViewSlide' );
				const canvas = document.createElement( 'canvas' );
				canvas.width = 800;
				canvas.height = 600;
				canvas.getContext = jest.fn( () => ( {
					fillRect: jest.fn()
				} ) );
				canvas.toDataURL = jest.fn( () => 'data:image/png;base64,test' );
				container.appendChild( canvas );

				const payload = {
					layers: [ { id: '1', type: 'rectangle' } ],
					baseWidth: 800,
					baseHeight: 600,
					backgroundColor: '#ffffff'
				};

				manager.handleSlideViewClick( container, payload );

				expect( MockLightboxClass ).toHaveBeenCalledWith( { debug: true } );
				expect( mockLightbox.open ).toHaveBeenCalledWith(
					expect.objectContaining( {
						filename: 'ViewSlide',
						imageUrl: 'data:image/png;base64,test',
						layerData: expect.objectContaining( {
							layers: [ { id: '1', type: 'rectangle' } ],
							baseWidth: 800,
							baseHeight: 600
						} )
					} )
				);
			} );

			it( 'should handle missing lightbox class gracefully', () => {
				delete window.Layers;
				delete window.LayersLightbox;

				const container = document.createElement( 'div' );
				container.setAttribute( 'data-slide-name', 'ViewSlide' );
				const canvas = document.createElement( 'canvas' );
				container.appendChild( canvas );

				const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

				// Should not throw
				expect( () => manager.handleSlideViewClick( container, payload ) ).not.toThrow();
			} );

			it( 'should handle missing canvas gracefully', () => {
				const container = document.createElement( 'div' );
				container.setAttribute( 'data-slide-name', 'NoCanvasSlide' );

				const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

				// Should not throw
				expect( () => manager.handleSlideViewClick( container, payload ) ).not.toThrow();
			} );
		} );

		describe( '_createPencilIcon', () => {
			it( 'should create SVG icon', () => {
				const icon = manager._createPencilIcon();
				expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
				expect( icon.getAttribute( 'width' ) ).toBe( '16' );
				expect( icon.getAttribute( 'height' ) ).toBe( '16' );
			} );

			it( 'should use IconFactory if available', () => {
				const mockIcon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
				window.Layers = {
					UI: {
						IconFactory: {
							createPencilIcon: jest.fn( () => mockIcon )
						}
					}
				};

				const icon = manager._createPencilIcon();
				expect( window.Layers.UI.IconFactory.createPencilIcon ).toHaveBeenCalled();
				expect( icon ).toBe( mockIcon );
			} );
		} );

		describe( '_createExpandIcon', () => {
			it( 'should create SVG icon', () => {
				const icon = manager._createExpandIcon();
				expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
				expect( icon.getAttribute( 'width' ) ).toBe( '16' );
				expect( icon.getAttribute( 'height' ) ).toBe( '16' );
			} );

			it( 'should use IconFactory if available', () => {
				const mockIcon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
				window.Layers = {
					UI: {
						IconFactory: {
							createFullscreenIcon: jest.fn( () => mockIcon )
						}
					}
				};

				const icon = manager._createExpandIcon();
				expect( window.Layers.UI.IconFactory.createFullscreenIcon ).toHaveBeenCalled();
				expect( icon ).toBe( mockIcon );
			} );
		} );

		describe( '_msg helper', () => {
			it( 'should return message from mw.message if exists', () => {
				global.mw.message = jest.fn( () => ( {
					exists: () => true,
					text: () => 'Localized Message'
				} ) );

				const result = manager._msg( 'layers-test-key', 'Fallback' );
				expect( result ).toBe( 'Localized Message' );
			} );

			it( 'should return fallback if message does not exist', () => {
				global.mw.message = jest.fn( () => ( {
					exists: () => false,
					text: () => ''
				} ) );

				const result = manager._msg( 'layers-missing-key', 'Fallback Text' );
				expect( result ).toBe( 'Fallback Text' );
			} );

			it( 'should return fallback if mw.message not available', () => {
				delete global.mw.message;

				const result = manager._msg( 'layers-test-key', 'Fallback' );
				expect( result ).toBe( 'Fallback' );
			} );
		} );
	} );

	describe( 'initializeSlideViewer', () => {
		let manager;

		beforeEach( () => {
			manager = new ViewerManager( { debug: true } );
		} );

		it( 'should initialize slide with layers and render them', () => {
			const mockDrawLayer = jest.fn();
			window.Layers = {
				LayerRenderer: jest.fn( () => ( {
					drawLayer: mockDrawLayer
				} ) )
			};

			const container = document.createElement( 'div' );
			container.setAttribute( 'data-slide-name', 'RenderSlide' );
			const canvas = document.createElement( 'canvas' );
			const mockCtx = {
				clearRect: jest.fn(),
				fillRect: jest.fn(),
				fillStyle: ''
			};
			canvas.getContext = jest.fn( () => mockCtx );
			container.appendChild( canvas );
			document.body.appendChild( container );

			const payload = {
				layers: [
					{ id: '1', type: 'rectangle', visible: true },
					{ id: '2', type: 'circle', visible: true }
				],
				baseWidth: 1024,
				baseHeight: 768,
				backgroundColor: '#0000ff',
				backgroundVisible: true
			};

			manager.setupSlideOverlay = jest.fn();
			manager.initializeSlideViewer( container, payload );

			// Canvas dimensions should be set
			expect( canvas.width ).toBe( 1024 );
			expect( canvas.height ).toBe( 768 );

			// Background should be filled
			expect( mockCtx.fillRect ).toHaveBeenCalled();

			// Layers should be rendered
			expect( mockDrawLayer ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'should skip hidden layers', () => {
			const mockDrawLayer = jest.fn();
			window.Layers = {
				LayerRenderer: jest.fn( () => ( {
					drawLayer: mockDrawLayer
				} ) )
			};

			const container = document.createElement( 'div' );
			const canvas = document.createElement( 'canvas' );
			canvas.getContext = jest.fn( () => ( {
				clearRect: jest.fn(),
				fillRect: jest.fn(),
				fillStyle: ''
			} ) );
			container.appendChild( canvas );

			const payload = {
				layers: [
					{ id: '1', type: 'rectangle', visible: true },
					{ id: '2', type: 'circle', visible: false },
					{ id: '3', type: 'text', visible: 0 }
				],
				baseWidth: 800,
				baseHeight: 600,
				backgroundVisible: true
			};

			manager.setupSlideOverlay = jest.fn();
			manager.initializeSlideViewer( container, payload );

			// Only visible layer should be rendered
			expect( mockDrawLayer ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should handle transparent background', () => {
			window.Layers = {
				LayerRenderer: jest.fn( () => ( { drawLayer: jest.fn() } ) )
			};

			const container = document.createElement( 'div' );
			const canvas = document.createElement( 'canvas' );
			const mockCtx = {
				clearRect: jest.fn(),
				fillRect: jest.fn(),
				fillStyle: ''
			};
			canvas.getContext = jest.fn( () => mockCtx );
			container.appendChild( canvas );

			const payload = {
				layers: [],
				baseWidth: 800,
				baseHeight: 600,
				backgroundColor: 'transparent',
				backgroundVisible: true
			};

			manager.setupSlideOverlay = jest.fn();
			manager.initializeSlideViewer( container, payload );

			// fillRect should still be called for clearRect, but bg should not be filled
			expect( mockCtx.clearRect ).toHaveBeenCalled();
		} );

		it( 'should handle missing canvas gracefully', () => {
			const container = document.createElement( 'div' );

			const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

			// Should not throw
			expect( () => manager.initializeSlideViewer( container, payload ) ).not.toThrow();
		} );

		it( 'should handle missing LayerRenderer gracefully', () => {
			delete window.Layers;
			delete window.LayerRenderer;

			const container = document.createElement( 'div' );
			const canvas = document.createElement( 'canvas' );
			canvas.getContext = jest.fn( () => ( { clearRect: jest.fn() } ) );
			container.appendChild( canvas );

			const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

			// Should not throw
			expect( () => manager.initializeSlideViewer( container, payload ) ).not.toThrow();
		} );

		it( 'should hide placeholder after initialization', () => {
			window.Layers = {
				LayerRenderer: jest.fn( () => ( { drawLayer: jest.fn() } ) )
			};

			const container = document.createElement( 'div' );
			const canvas = document.createElement( 'canvas' );
			canvas.getContext = jest.fn( () => ( {
				clearRect: jest.fn(),
				fillRect: jest.fn(),
				fillStyle: ''
			} ) );
			container.appendChild( canvas );

			const placeholder = document.createElement( 'div' );
			placeholder.className = 'layers-slide-placeholder';
			container.appendChild( placeholder );

			const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

			manager.setupSlideOverlay = jest.fn();
			manager.initializeSlideViewer( container, payload );

			expect( placeholder.style.display ).toBe( 'none' );
		} );

		it( 'should scale canvas when display dimensions differ', () => {
			window.Layers = {
				LayerRenderer: jest.fn( () => ( { drawLayer: jest.fn() } ) )
			};

			const container = document.createElement( 'div' );
			container.setAttribute( 'data-display-width', '400' );
			container.setAttribute( 'data-display-height', '300' );
			container.setAttribute( 'data-display-scale', '0.5' );

			const canvas = document.createElement( 'canvas' );
			canvas.getContext = jest.fn( () => ( {
				clearRect: jest.fn(),
				fillRect: jest.fn(),
				fillStyle: ''
			} ) );
			container.appendChild( canvas );

			const payload = {
				layers: [],
				baseWidth: 800,
				baseHeight: 600,
				backgroundVisible: true
			};

			manager.setupSlideOverlay = jest.fn();
			manager.initializeSlideViewer( container, payload );

			// Canvas should be scaled via CSS
			expect( canvas.style.width ).toBe( '400px' );
			expect( canvas.style.height ).toBe( '300px' );
		} );
	} );
} );
