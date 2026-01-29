/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Tests for ApiFallback
 *
 * ApiFallback handles loading layer data via API when server-side
 * injection is missing. It determines which images should have
 * layers loaded based on various criteria.
 */

describe( 'ApiFallback', () => {
	let ApiFallback;
	let mockUrlParser;
	let mockViewerManager;
	let mockApi;
	let mockMw;

	beforeEach( () => {
		jest.resetModules();
		document.body.innerHTML = '';

		// Create mock URL parser
		mockUrlParser = {
			isAllowedLayersValue: jest.fn( ( val ) =>
				[ 'on', 'true', '1', 'default' ].includes( val.toLowerCase() )
			),
			isFileLinkAnchor: jest.fn( () => false ),
			detectLayersFromDataMw: jest.fn( () => null ),
			inferFilename: jest.fn( () => null ),
			getPageLayersParam: jest.fn( () => null ),
			getNamespaceNumber: jest.fn( () => 0 ),
			getFileNamespace: jest.fn( () => 'File' )
		};

		// Create mock viewer manager
		mockViewerManager = {
			initializeViewer: jest.fn(),
			initializeOverlayOnly: jest.fn()
		};

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
			loader: {
				using: jest.fn( () => Promise.resolve() )
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
			if ( namespacePath === 'Viewer.Manager' ) {
				return function () { return mockViewerManager; };
			}
			return null;
		} );

		// Load module
		ApiFallback = require( '../../resources/ext.layers/viewer/ApiFallback.js' );
	} );

	afterEach( () => {
		delete global.mw;
		delete window.layersGetClass;
		delete window.Layers;
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default options', () => {
			const fallback = new ApiFallback();
			expect( fallback.debug ).toBeUndefined();
		} );

		it( 'should enable debug mode when specified', () => {
			const fallback = new ApiFallback( { debug: true } );
			expect( fallback.debug ).toBe( true );
		} );

		it( 'should use provided urlParser', () => {
			const fallback = new ApiFallback( { urlParser: mockUrlParser } );
			expect( fallback.urlParser ).toBe( mockUrlParser );
		} );

		it( 'should use provided viewerManager', () => {
			const fallback = new ApiFallback( { viewerManager: mockViewerManager } );
			expect( fallback.viewerManager ).toBe( mockViewerManager );
		} );

		it( 'should create default urlParser if not provided', () => {
			const fallback = new ApiFallback();
			expect( fallback.urlParser ).toBeDefined();
		} );

		it( 'should create default viewerManager if not provided', () => {
			const fallback = new ApiFallback();
			expect( fallback.viewerManager ).toBeDefined();
		} );
	} );

	describe( 'getClass fallback (internal helper)', () => {
		// These tests cover lines 14-28: the internal getClass helper function
		// used when window.layersGetClass is undefined

		it( 'should use window.Layers namespace when layersGetClass is undefined', () => {
			// Remove layersGetClass so internal fallback is used
			delete window.layersGetClass;
			jest.resetModules();

			// Create mock classes
			const MockUrlParser = function () {
				return mockUrlParser;
			};
			const MockViewerManager = function () {
				return mockViewerManager;
			};

			// Set up window.Layers namespace
			window.Layers = {
				Utils: {
					UrlParser: MockUrlParser
				},
				Viewer: {
					Manager: MockViewerManager
				}
			};

			const ApiFallbackLocal = require( '../../resources/ext.layers/viewer/ApiFallback.js' );
			const fallback = new ApiFallbackLocal();

			expect( fallback.urlParser ).toBe( mockUrlParser );
			expect( fallback.viewerManager ).toBe( mockViewerManager );
		} );

		it( 'should fall back to global name when namespace traversal fails', () => {
			delete window.layersGetClass;
			jest.resetModules();

			// Create mock classes as globals
			window.LayersUrlParser = function () {
				return mockUrlParser;
			};
			window.LayersViewerManager = function () {
				return mockViewerManager;
			};

			// Set up incomplete Layers namespace (missing nested properties)
			window.Layers = {
				Utils: {} // Missing UrlParser
			};

			const ApiFallbackLocal = require( '../../resources/ext.layers/viewer/ApiFallback.js' );
			const fallback = new ApiFallbackLocal();

			expect( fallback.urlParser ).toBe( mockUrlParser );
			expect( fallback.viewerManager ).toBe( mockViewerManager );

			// Clean up
			delete window.LayersUrlParser;
			delete window.LayersViewerManager;
		} );

		it( 'should use global fallback when namespace result is not a function', () => {
			delete window.layersGetClass;
			jest.resetModules();

			// Create mock classes as globals
			window.LayersUrlParser = function () {
				return mockUrlParser;
			};
			window.LayersViewerManager = function () {
				return mockViewerManager;
			};

			// Set up Layers namespace with non-function values
			window.Layers = {
				Utils: {
					UrlParser: 'not a function' // Wrong type
				},
				Viewer: {
					Manager: 12345 // Wrong type
				}
			};

			const ApiFallbackLocal = require( '../../resources/ext.layers/viewer/ApiFallback.js' );
			const fallback = new ApiFallbackLocal();

			expect( fallback.urlParser ).toBe( mockUrlParser );
			expect( fallback.viewerManager ).toBe( mockViewerManager );

			// Clean up
			delete window.LayersUrlParser;
			delete window.LayersViewerManager;
		} );

		it( 'should use global fallback when window.Layers is undefined', () => {
			delete window.layersGetClass;
			delete window.Layers;
			jest.resetModules();

			// Create mock classes as globals
			window.LayersUrlParser = function () {
				return mockUrlParser;
			};
			window.LayersViewerManager = function () {
				return mockViewerManager;
			};

			const ApiFallbackLocal = require( '../../resources/ext.layers/viewer/ApiFallback.js' );
			const fallback = new ApiFallbackLocal();

			expect( fallback.urlParser ).toBe( mockUrlParser );
			expect( fallback.viewerManager ).toBe( mockViewerManager );

			// Clean up
			delete window.LayersUrlParser;
			delete window.LayersViewerManager;
		} );
	} );

	describe( 'debugLog', () => {
		it( 'should log when debug is true', () => {
			const fallback = new ApiFallback( { debug: true } );
			fallback.debugLog( 'test message' );
			expect( mockMw.log ).toHaveBeenCalledWith(
				'[Layers:ApiFallback]',
				'test message'
			);
		} );

		it( 'should not log when debug is false', () => {
			const fallback = new ApiFallback( { debug: false } );
			fallback.debugLog( 'test message' );
			expect( mockMw.log ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'debugWarn', () => {
		it( 'should warn when debug is true', () => {
			const fallback = new ApiFallback( { debug: true } );
			fallback.debugWarn( 'test warning' );
			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ApiFallback]',
				'test warning'
			);
		} );

		it( 'should not warn when debug is false', () => {
			const fallback = new ApiFallback( { debug: false } );
			fallback.debugWarn( 'test warning' );
			expect( mockMw.log.warn ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'buildCandidateList', () => {
		it( 'should find images with layers-thumbnail class missing data', () => {
			document.body.innerHTML = '<img class="layers-thumbnail" src="test.jpg">';

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( false );

			expect( candidates ).toHaveLength( 1 );
			expect( candidates[ 0 ].className ).toBe( 'layers-thumbnail' );
		} );

		it( 'should find images with data-layers-intent attribute', () => {
			document.body.innerHTML = '<img data-layers-intent="on" src="test.jpg">';

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( false );

			expect( candidates ).toHaveLength( 1 );
		} );

		it( 'should find images inside links with layers parameter', () => {
			document.body.innerHTML = `
				<a href="/wiki/File:Test.jpg?layers=on"><img src="test.jpg"></a>
			`;

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( false );

			expect( candidates ).toHaveLength( 1 );
		} );

		it( 'should find thumbimage class images', () => {
			document.body.innerHTML = '<img class="thumbimage" src="test.jpg">';

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( false );

			expect( candidates ).toHaveLength( 1 );
		} );

		it( 'should find mw-file-element class images', () => {
			document.body.innerHTML = '<img class="mw-file-element" src="test.jpg">';

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( false );

			expect( candidates ).toHaveLength( 1 );
		} );

		it( 'should find images in a.image links', () => {
			document.body.innerHTML = '<a class="image"><img src="test.jpg"></a>';

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( false );

			expect( candidates ).toHaveLength( 1 );
		} );

		it( 'should not include images that already have data-layer-data', () => {
			document.body.innerHTML = `
				<img class="layers-thumbnail" data-layer-data='[]' src="test.jpg">
			`;

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( false );

			expect( candidates ).toHaveLength( 0 );
		} );

		it( 'should not duplicate candidates', () => {
			document.body.innerHTML = `
				<a href="/wiki/File:Test.jpg?layers=on" class="image">
					<img class="layers-thumbnail thumbimage mw-file-element" src="test.jpg">
				</a>
			`;

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( true );

			expect( candidates ).toHaveLength( 1 );
		} );

		it( 'should find File: link images when pageAllow is true', () => {
			document.body.innerHTML = `
				<a href="/wiki/File:Test.jpg"><img src="test.jpg"></a>
			`;

			const fallback = new ApiFallback();
			const candidatesWithoutAllow = fallback.buildCandidateList( false );
			const candidatesWithAllow = fallback.buildCandidateList( true );

			expect( candidatesWithoutAllow ).toHaveLength( 0 );
			expect( candidatesWithAllow ).toHaveLength( 1 );
		} );

		it( 'should find images with title=File: in href', () => {
			document.body.innerHTML = `
				<a href="/w/index.php?title=File:Test.jpg"><img src="test.jpg"></a>
			`;

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( true );

			expect( candidates ).toHaveLength( 1 );
		} );

		it( 'should find images in links with title attribute', () => {
			document.body.innerHTML = `
				<a title="File:Test.jpg"><img src="test.jpg"></a>
			`;

			const fallback = new ApiFallback();
			const candidates = fallback.buildCandidateList( true );

			expect( candidates ).toHaveLength( 1 );
		} );
	} );

	describe( 'checkImageAllowed', () => {
		let fallback;

		beforeEach( () => {
			fallback = new ApiFallback( {
				urlParser: mockUrlParser,
				viewerManager: mockViewerManager
			} );
		} );

		it( 'should allow on File page with pageAllow true', () => {
			const img = document.createElement( 'img' );

			const result = fallback.checkImageAllowed( img, true, 6, 'File' );

			expect( result.allow ).toBe( true );
			expect( result.reason ).toContain( 'File page' );
		} );

		it( 'should not allow on File page with pageAllow false', () => {
			const img = document.createElement( 'img' );

			const result = fallback.checkImageAllowed( img, false, 6, 'File' );

			expect( result.allow ).toBe( false );
		} );

		it( 'should allow image with per-image layers=on in href', () => {
			document.body.innerHTML = `
				<a href="/wiki/File:Test.jpg?layers=on"><img src="test.jpg"></a>
			`;
			const img = document.querySelector( 'img' );

			const result = fallback.checkImageAllowed( img, false, 0, 'File' );

			expect( result.allow ).toBe( true );
			expect( result.reason ).toContain( 'per-image layers parameter' );
		} );

		it( 'should allow image with layers=default in href', () => {
			document.body.innerHTML = `
				<a href="/wiki/File:Test.jpg?layers=default"><img src="test.jpg"></a>
			`;
			const img = document.querySelector( 'img' );

			const result = fallback.checkImageAllowed( img, false, 0, 'File' );

			expect( result.allow ).toBe( true );
		} );

		it( 'should allow image when isFileLinkAnchor returns true', () => {
			document.body.innerHTML = '<a href="/wiki/File:Test.jpg"><img src="test.jpg"></a>';
			const img = document.querySelector( 'img' );
			mockUrlParser.isFileLinkAnchor.mockReturnValue( true );

			const result = fallback.checkImageAllowed( img, true, 0, 'File' );

			expect( result.allow ).toBe( true );
			expect( result.reason ).toContain( 'file link detected' );
		} );

		it( 'should allow content images on non-File pages with pageAllow', () => {
			document.body.innerHTML = '<a><img class="thumbimage" src="test.jpg"></a>';
			const img = document.querySelector( 'img' );

			const result = fallback.checkImageAllowed( img, true, 0, 'File' );

			expect( result.allow ).toBe( true );
			expect( result.reason ).toContain( 'content image class' );
		} );

		it( 'should allow mw-file-element images on non-File pages with pageAllow', () => {
			document.body.innerHTML = '<a><img class="mw-file-element" src="test.jpg"></a>';
			const img = document.querySelector( 'img' );

			const result = fallback.checkImageAllowed( img, true, 0, 'File' );

			expect( result.allow ).toBe( true );
		} );

		it( 'should allow images in a.image links with pageAllow', () => {
			document.body.innerHTML = '<a class="image"><img src="test.jpg"></a>';
			const img = document.querySelector( 'img' );

			const result = fallback.checkImageAllowed( img, true, 0, 'File' );

			expect( result.allow ).toBe( true );
		} );

		it( 'should allow based on data-mw layers value', () => {
			const img = document.createElement( 'img' );
			mockUrlParser.detectLayersFromDataMw.mockReturnValue( 'on' );

			const result = fallback.checkImageAllowed( img, false, 0, 'File' );

			expect( result.allow ).toBe( true );
			expect( result.reason ).toContain( 'data-mw' );
		} );

		it( 'should allow based on data-layers-intent=on', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-layers-intent', 'on' );

			const result = fallback.checkImageAllowed( img, false, 0, 'File' );

			expect( result.allow ).toBe( true );
			expect( result.reason ).toContain( 'server-marked intent' );
		} );

		it( 'should deny based on data-layers-intent=none', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-layers-intent', 'none' );

			const result = fallback.checkImageAllowed( img, false, 0, 'File' );

			expect( result.allow ).toBe( false );
			expect( result.reason ).toContain( 'explicit no-layers intent' );
		} );

		it( 'should deny based on data-layers-intent=off', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-layers-intent', 'off' );

			const result = fallback.checkImageAllowed( img, false, 0, 'File' );

			expect( result.allow ).toBe( false );
		} );

		it( 'should return no matching criteria for unqualified images', () => {
			const img = document.createElement( 'img' );

			const result = fallback.checkImageAllowed( img, false, 0, 'File' );

			expect( result.allow ).toBe( false );
			expect( result.reason ).toBe( 'no matching criteria' );
		} );
	} );

	describe( 'inferFilenameWithFallback', () => {
		let fallback;

		beforeEach( () => {
			fallback = new ApiFallback( {
				urlParser: mockUrlParser,
				viewerManager: mockViewerManager
			} );
		} );

		it( 'should return filename from urlParser if available', () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			const img = document.createElement( 'img' );

			const result = fallback.inferFilenameWithFallback( img, 'File' );

			expect( result ).toBe( 'Test.jpg' );
		} );

		it( 'should fallback to wgPageName on File pages', () => {
			mockUrlParser.inferFilename.mockReturnValue( null );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgNamespaceNumber' ) {
					return 6;
				}
				if ( key === 'wgPageName' ) {
					return 'File:Test_Image.jpg';
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const result = fallback.inferFilenameWithFallback( img, 'File' );

			expect( result ).toBe( 'Test Image.jpg' );
		} );

		it( 'should return null when no filename can be inferred', () => {
			mockUrlParser.inferFilename.mockReturnValue( null );
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgNamespaceNumber' ) {
					return 0;
				}
				return null;
			} );

			const img = document.createElement( 'img' );
			const result = fallback.inferFilenameWithFallback( img, 'File' );

			expect( result ).toBeNull();
		} );
	} );

	describe( 'processCandidate', () => {
		let fallback;

		beforeEach( () => {
			jest.useFakeTimers();
			fallback = new ApiFallback( {
				urlParser: mockUrlParser,
				viewerManager: mockViewerManager,
				debug: true
			} );
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'should skip images that already have layersViewer', () => {
			const img = document.createElement( 'img' );
			img.layersViewer = {};

			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should skip images with explicit no-layers intent', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-layers-intent', 'off' );

			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			expect( mockApi.get ).not.toHaveBeenCalled();
			expect( mockMw.log ).toHaveBeenCalled();
		} );

		it( 'should skip images when filename cannot be inferred', () => {
			mockUrlParser.inferFilename.mockReturnValue( null );
			mockMw.config.get.mockReturnValue( 0 );

			const img = document.createElement( 'img' );

			fallback.processCandidate( img, mockApi, true, 0, 'File' );

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should skip images that are not allowed', () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			const img = document.createElement( 'img' );

			fallback.processCandidate( img, mockApi, false, 0, 'File' );

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should call API for allowed images', () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			const img = document.createElement( 'img' );

			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			expect( mockApi.get ).toHaveBeenCalledWith( {
				action: 'layersinfo',
				format: 'json',
				filename: 'Test.jpg'
			} );
		} );

		it( 'should initialize viewer when API returns layers', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1', type: 'text' } ]
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).toHaveBeenCalledWith(
				img,
				expect.objectContaining( {
					layers: [ { id: 'layer1', type: 'text' } ],
					baseWidth: 800,
					baseHeight: 600
				} )
			);
		} );

		it( 'should not initialize viewer or overlay when API returns no layerset and no intent', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( { layersinfo: {} } );

			const img = document.createElement( 'img' );
			// No data-layers-intent attribute set
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).not.toHaveBeenCalled();
			expect( mockViewerManager.initializeOverlayOnly ).not.toHaveBeenCalled();
		} );

		it( 'should initialize overlay-only when layerset missing but intent specified', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( { layersinfo: {} } );

			const img = document.createElement( 'img' );
			img.setAttribute( 'data-layers-intent', 'my-custom-set' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).not.toHaveBeenCalled();
			expect( mockViewerManager.initializeOverlayOnly ).toHaveBeenCalledWith(
				img,
				'my-custom-set'
			);
		} );

		it( 'should initialize overlay-only with default when intent is "on"', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( { layersinfo: {} } );

			const img = document.createElement( 'img' );
			img.setAttribute( 'data-layers-intent', 'on' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).not.toHaveBeenCalled();
			expect( mockViewerManager.initializeOverlayOnly ).toHaveBeenCalledWith(
				img,
				'default'
			);
		} );

		it( 'should not initialize viewer when layers array is empty', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] }
					}
				}
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).not.toHaveBeenCalled();
		} );

		it( 'should handle data as array directly', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: [ { id: 'layer1', type: 'text' } ],
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).toHaveBeenCalled();
		} );

		it( 'should use image dimensions as fallback for baseWidth/Height', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1', type: 'text' } ]
						}
					}
				}
			} );

			const img = document.createElement( 'img' );
			Object.defineProperty( img, 'naturalWidth', { value: 1024 } );
			Object.defineProperty( img, 'naturalHeight', { value: 768 } );

			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).toHaveBeenCalledWith(
				img,
				expect.objectContaining( {
					baseWidth: 1024,
					baseHeight: 768
				} )
			);
		} );

		it( 'should normalize backgroundVisible false to false', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1', type: 'text' } ],
							backgroundVisible: false
						}
					}
				}
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).toHaveBeenCalledWith(
				img,
				expect.objectContaining( {
					backgroundVisible: false
				} )
			);
		} );

		it( 'should normalize backgroundVisible 0 to false', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1', type: 'text' } ],
							backgroundVisible: 0
						}
					}
				}
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).toHaveBeenCalledWith(
				img,
				expect.objectContaining( {
					backgroundVisible: false
				} )
			);
		} );

		it( 'should normalize backgroundVisible string "0" to false', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1', type: 'text' } ],
							backgroundVisible: '0'
						}
					}
				}
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).toHaveBeenCalledWith(
				img,
				expect.objectContaining( {
					backgroundVisible: false
				} )
			);
		} );

		it( 'should normalize backgroundVisible string "false" to false', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1', type: 'text' } ],
							backgroundVisible: 'false'
						}
					}
				}
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).toHaveBeenCalledWith(
				img,
				expect.objectContaining( {
					backgroundVisible: false
				} )
			);
		} );

		it( 'should parse backgroundOpacity from data', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1', type: 'text' } ],
							backgroundOpacity: '0.75'
						}
					}
				}
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockViewerManager.initializeViewer ).toHaveBeenCalledWith(
				img,
				expect.objectContaining( {
					backgroundOpacity: 0.75
				} )
			);
		} );

		it( 'should handle processing error gracefully', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			// This will cause an error when accessing .data
			mockViewerManager.initializeViewer.mockImplementation( () => {
				throw new Error( 'Processing error' );
			} );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1', type: 'text' } ]
						}
					}
				}
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			// Should log the processing error
			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ApiFallback]',
				'API fallback processing error:',
				expect.any( Error )
			);
		} );
	} );

	describe( 'initialize', () => {
		let fallback;

		beforeEach( () => {
			fallback = new ApiFallback( {
				urlParser: mockUrlParser,
				viewerManager: mockViewerManager,
				debug: true
			} );
		} );

		it( 'should not run when mw is undefined', () => {
			delete global.mw;

			expect( () => fallback.initialize() ).not.toThrow();
		} );

		it( 'should use mw.loader.using to load mediawiki.api', () => {
			fallback.initialize();

			expect( mockMw.loader.using ).toHaveBeenCalledWith( 'mediawiki.api' );
		} );

		it( 'should process candidates after API module loads', async () => {
			document.body.innerHTML = '<img class="layers-thumbnail" src="test.jpg">';
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );

			fallback.initialize();

			await jest.runAllTimersAsync();

			expect( mockMw.Api ).toHaveBeenCalled();
		} );

		it( 'should not process when no candidates found', async () => {
			document.body.innerHTML = '';

			fallback.initialize();

			await jest.runAllTimersAsync();

			expect( mockMw.Api ).not.toHaveBeenCalled();
		} );

		it( 'should detect page-level layers permission', async () => {
			mockUrlParser.getPageLayersParam.mockReturnValue( 'on' );
			document.body.innerHTML = '<a href="/wiki/File:Test.jpg"><img src="test.jpg"></a>';

			fallback.initialize();

			await jest.runAllTimersAsync();

			expect( mockMw.log ).toHaveBeenCalledWith(
				'[Layers:ApiFallback]',
				'API fallback: pageAllow=',
				true,
				'ns=',
				expect.any( Number ),
				'candidates=',
				expect.any( Number )
			);
		} );

		it( 'should handle initialization errors gracefully', () => {
			// Force mw.loader.using to throw
			mockMw.loader.using.mockImplementation( () => {
				throw new Error( 'Module load failed' );
			} );

			expect( () => fallback.initialize() ).not.toThrow();
			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ApiFallback]',
				'API fallback initialization failed:',
				'Module load failed'
			);
		} );

		it( 'should not run when mw.loader is undefined', () => {
			delete mockMw.loader;

			expect( () => fallback.initialize() ).not.toThrow();
		} );

		it( 'should not run when mw.loader.using is not a function', () => {
			mockMw.loader.using = null;

			expect( () => fallback.initialize() ).not.toThrow();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export to window.Layers.Viewer namespace', () => {
			expect( window.Layers.Viewer.ApiFallback ).toBe( ApiFallback );
		} );
	} );

	describe( 'error handling edge cases', () => {
		it( 'should handle processing errors in API response handler', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'layer1', type: 'text' } ]
						}
					}
				}
			} );

			// Make initializeViewer throw
			mockViewerManager.initializeViewer.mockImplementation( () => {
				throw new Error( 'Viewer init failed' );
			} );

			const fallback = new ApiFallback( {
				debug: true,
				urlParser: mockUrlParser,
				viewerManager: mockViewerManager
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ApiFallback]',
				'API fallback processing error:',
				expect.any( Error )
			);
		} );

		it( 'should handle mw.loader.using rejection', async () => {
			mockMw.loader.using.mockReturnValue( Promise.reject( new Error( 'Module load failed' ) ) );

			const fallback = new ApiFallback( {
				debug: true,
				urlParser: mockUrlParser,
				viewerManager: mockViewerManager
			} );

			fallback.initialize();

			await jest.runAllTimersAsync();

			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ApiFallback]',
				'Failed to load mediawiki.api module:',
				expect.any( Error )
			);
		} );

		it( 'should handle API request failure', async () => {
			mockUrlParser.inferFilename.mockReturnValue( 'Test.jpg' );
			mockApi.get.mockRejectedValue( new Error( 'Network error' ) );

			const fallback = new ApiFallback( {
				debug: true,
				urlParser: mockUrlParser,
				viewerManager: mockViewerManager
			} );

			const img = document.createElement( 'img' );
			fallback.processCandidate( img, mockApi, true, 6, 'File' );

			await jest.runAllTimersAsync();

			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers:ApiFallback]',
				'API fallback request failed for',
				'Test.jpg',
				expect.any( Error )
			);
		} );
	} );
} );
