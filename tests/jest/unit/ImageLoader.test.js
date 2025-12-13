/**
 * Tests for ImageLoader module
 *
 * @jest-environment jsdom
 */

describe( 'ImageLoader', () => {
	let ImageLoader;
	let mockMw;

	beforeEach( () => {
		// Reset DOM
		document.body.innerHTML = '';

		// Mock mw global
		mockMw = {
			config: {
				get: jest.fn( ( key ) => {
					const config = {
						wgServer: 'https://wiki.example.com',
						wgScriptPath: '/w',
						wgArticlePath: '/wiki/$1'
					};
					return config[ key ];
				} )
			},
			log: {
				warn: jest.fn()
			}
		};
		global.mw = mockMw;

		// Load the module
		jest.isolateModules( () => {
			require( '../../../resources/ext.layers.editor/ImageLoader.js' );
		} );
		ImageLoader = window.Layers.Utils.ImageLoader;
	} );

	afterEach( () => {
		jest.clearAllMocks();
		delete global.mw;
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default options', () => {
			const loader = new ImageLoader( {} );

			expect( loader.filename ).toBe( '' );
			expect( loader.backgroundImageUrl ).toBe( '' );
			expect( loader.image ).toBeNull();
			expect( loader.isLoading ).toBe( false );
		} );

		it( 'should accept filename option', () => {
			const loader = new ImageLoader( { filename: 'Test.png' } );

			expect( loader.filename ).toBe( 'Test.png' );
		} );

		it( 'should accept backgroundImageUrl option', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.png'
			} );

			expect( loader.backgroundImageUrl ).toBe( 'https://example.com/image.png' );
		} );

		it( 'should accept callbacks', () => {
			const onLoad = jest.fn();
			const onError = jest.fn();
			const loader = new ImageLoader( { onLoad, onError } );

			expect( loader.onLoad ).toBe( onLoad );
			expect( loader.onError ).toBe( onError );
		} );
	} );

	describe( 'buildUrlList', () => {
		it( 'should include backgroundImageUrl first', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/direct.png'
			} );

			const urls = loader.buildUrlList();

			expect( urls[ 0 ] ).toBe( 'https://example.com/direct.png' );
		} );

		it( 'should find images from DOM', () => {
			// Add a test image to DOM
			document.body.innerHTML = `
				<div class="fullImageLink">
					<img src="https://example.com/page-image.png" />
				</div>
			`;

			const loader = new ImageLoader( { filename: 'Test.png' } );
			const urls = loader.buildUrlList();

			expect( urls ).toContain( 'https://example.com/page-image.png' );
		} );

		it( 'should build MediaWiki URLs when mw is available', () => {
			const loader = new ImageLoader( { filename: 'Test.png' } );
			const urls = loader.buildUrlList();

			expect( urls ).toContain(
				'https://wiki.example.com/w/index.php?title=Special:Redirect/file/Test.png'
			);
			expect( urls ).toContain(
				'https://wiki.example.com/w/index.php?title=File:Test.png'
			);
			expect( urls ).toContain(
				'https://wiki.example.com/wiki/File:Test.png'
			);
		} );

		it( 'should encode special characters in filename', () => {
			const loader = new ImageLoader( { filename: 'Test File (1).png' } );
			const urls = loader.buildUrlList();

			const encodedFilename = encodeURIComponent( 'Test File (1).png' );
			expect( urls.some( ( url ) => url.includes( encodedFilename ) ) ).toBe( true );
		} );

		it( 'should not duplicate URLs', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.png'
			} );

			// Add same image to DOM
			document.body.innerHTML = `
				<div class="fullImageLink">
					<img src="https://example.com/image.png" />
				</div>
			`;

			const urls = loader.buildUrlList();
			const count = urls.filter( ( url ) => url === 'https://example.com/image.png' ).length;

			expect( count ).toBe( 1 );
		} );

		it( 'should return empty array when no sources available', () => {
			delete global.mw;
			const loader = new ImageLoader( {} );
			const urls = loader.buildUrlList();

			expect( urls ).toEqual( [] );
		} );
	} );

	describe( 'createTestImageSvg', () => {
		it( 'should create valid SVG', () => {
			const loader = new ImageLoader( {} );
			const svg = loader.createTestImageSvg( 'Test.png' );

			expect( svg ).toContain( '<svg' );
			expect( svg ).toContain( '</svg>' );
			expect( svg ).toContain( 'width="800"' );
			expect( svg ).toContain( 'height="600"' );
		} );

		it( 'should include filename in SVG', () => {
			const loader = new ImageLoader( {} );
			const svg = loader.createTestImageSvg( 'MyImage.jpg' );

			expect( svg ).toContain( 'MyImage.jpg' );
		} );

		it( 'should escape HTML special characters', () => {
			const loader = new ImageLoader( {} );
			const svg = loader.createTestImageSvg( '<script>alert("xss")</script>' );

			expect( svg ).not.toContain( '<script>' );
			expect( svg ).toContain( '&lt;script&gt;' );
		} );

		it( 'should use default filename when none provided', () => {
			const loader = new ImageLoader( {} );
			const svg = loader.createTestImageSvg( '' );

			expect( svg ).toContain( 'Sample Image' );
		} );
	} );

	describe( 'load', () => {
		it( 'should set isLoading flag', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.png'
			} );

			loader.load();

			expect( loader.isLoading ).toBe( true );
		} );

		it( 'should not start new load while already loading', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.png'
			} );

			loader.load();
			loader.load(); // Second call should be ignored

			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[ImageLoader] Load already in progress'
			);
		} );

		it( 'should load test image when no URLs available', () => {
			delete global.mw;
			const onLoad = jest.fn();
			const loader = new ImageLoader( { onLoad } );

			// Spy on loadTestImage
			const spy = jest.spyOn( loader, 'loadTestImage' );
			loader.load();

			expect( spy ).toHaveBeenCalled();
		} );
	} );

	describe( 'tryLoadImage', () => {
		it( 'should create Image with crossOrigin', () => {
			const loader = new ImageLoader( {} );
			const urls = [ 'https://example.com/image.png' ];

			loader.tryLoadImage( urls, 0 );

			expect( loader.image ).toBeInstanceOf( Image );
			expect( loader.image.crossOrigin ).toBe( 'anonymous' );
		} );

		it( 'should call onLoad on successful load', () => {
			const onLoad = jest.fn();

			const loader = new ImageLoader( { onLoad } );

			// Start loading
			loader.tryLoadImage( [ 'https://example.com/image.png' ], 0 );

			// Simulate successful load by calling onload directly
			// (jsdom doesn't actually load images)
			Object.defineProperty( loader.image, 'width', { value: 100 } );
			Object.defineProperty( loader.image, 'height', { value: 100 } );
			loader.image.onload();

			expect( onLoad ).toHaveBeenCalled();
			const [ , info ] = onLoad.mock.calls[ 0 ];
			expect( info.source ).toBe( 'url' );
			expect( info.url ).toBe( 'https://example.com/image.png' );
			expect( loader.isLoading ).toBe( false );
		} );

		it( 'should try next URL on error', () => {
			const loader = new ImageLoader( {} );
			const urls = [ 'invalid://url', 'https://example.com/image.png' ];

			const spy = jest.spyOn( loader, 'tryLoadImage' );
			loader.tryLoadImage( urls, 0 );

			// Simulate error
			loader.image.onerror();

			expect( spy ).toHaveBeenCalledWith( urls, 1 );
		} );

		it( 'should fall back to test image when all URLs fail', () => {
			const loader = new ImageLoader( {} );
			const spy = jest.spyOn( loader, 'loadTestImage' );

			loader.tryLoadImage( [], 0 );

			expect( spy ).toHaveBeenCalled();
		} );
	} );

	describe( 'getImage', () => {
		it( 'should return null before loading', () => {
			const loader = new ImageLoader( {} );

			expect( loader.getImage() ).toBeNull();
		} );

		it( 'should return image after loading starts', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.png'
			} );

			loader.load();

			expect( loader.getImage() ).toBeInstanceOf( Image );
		} );
	} );

	describe( 'isLoadingImage', () => {
		it( 'should return false initially', () => {
			const loader = new ImageLoader( {} );

			expect( loader.isLoadingImage() ).toBe( false );
		} );

		it( 'should return true while loading', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.png'
			} );

			loader.load();

			expect( loader.isLoadingImage() ).toBe( true );
		} );
	} );

	describe( 'abort', () => {
		it( 'should clear loading state', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.png'
			} );

			loader.load();
			loader.abort();

			expect( loader.isLoading ).toBe( false );
		} );

		it( 'should clear image handlers', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.png'
			} );

			loader.load();
			const image = loader.image;
			loader.abort();

			expect( image.onload ).toBeNull();
			expect( image.onerror ).toBeNull();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all resources', () => {
			const onLoad = jest.fn();
			const onError = jest.fn();
			const loader = new ImageLoader( { onLoad, onError } );

			loader.load();
			loader.destroy();

			expect( loader.image ).toBeNull();
			expect( loader.onLoad ).toBeNull();
			expect( loader.onError ).toBeNull();
			expect( loader.isLoading ).toBe( false );
		} );
	} );

	describe( 'window export', () => {
		it( 'should export ImageLoader to window.Layers.Utils namespace', () => {
			expect( window.Layers.Utils.ImageLoader ).toBe( ImageLoader );
		} );

		it( 'should be a constructor function', () => {
			expect( typeof window.Layers.Utils.ImageLoader ).toBe( 'function' );
			expect( new window.Layers.Utils.ImageLoader( {} ) ).toBeInstanceOf( ImageLoader );
		} );
	} );
} );
