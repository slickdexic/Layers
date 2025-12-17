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
} );
