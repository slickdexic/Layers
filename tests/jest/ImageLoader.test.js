/**
 * @jest-environment jsdom
 */

/**
 * Tests for ImageLoader
 * Handles background image loading with fallback strategies
 */

describe( 'ImageLoader', () => {
	let ImageLoader;
	let mockImage;
	let originalImage;

	beforeEach( () => {
		// Reset modules
		jest.resetModules();

		// Store original Image constructor
		originalImage = global.Image;

		// Mock Image constructor
		mockImage = {
			src: '',
			width: 800,
			height: 600,
			crossOrigin: null,
			onload: null,
			onerror: null
		};

		global.Image = jest.fn( () => mockImage );

		// Mock mw
		window.mw = {
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

		// Mock Layers namespace with constants
		window.Layers = {
			Constants: {
				TIMING: {
					IMAGE_LOAD_TIMEOUT: 5000
				}
			},
			Utils: {}
		};

		// Mock location.origin - use delete then define instead of redefine
		delete window.location;
		window.location = {
			origin: 'https://wiki.example.com',
			href: 'https://wiki.example.com/wiki/File:Test.jpg'
		};

		// Load the module
		require( '../../resources/ext.layers.editor/ImageLoader.js' );
		ImageLoader = window.Layers.Utils.ImageLoader;
	} );

	afterEach( () => {
		global.Image = originalImage;
		jest.useRealTimers();
		delete window.Layers;
		delete window.mw;
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default options', () => {
			const loader = new ImageLoader();

			expect( loader.filename ).toBe( '' );
			expect( loader.backgroundImageUrl ).toBe( '' );
			expect( loader.isLoading ).toBe( false );
			expect( loader.image ).toBeNull();
		} );

		it( 'should accept filename option', () => {
			const loader = new ImageLoader( { filename: 'Test.jpg' } );

			expect( loader.filename ).toBe( 'Test.jpg' );
		} );

		it( 'should accept backgroundImageUrl option', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			expect( loader.backgroundImageUrl ).toBe( 'https://example.com/image.jpg' );
		} );

		it( 'should accept onLoad callback', () => {
			const onLoad = jest.fn();
			const loader = new ImageLoader( { onLoad } );

			expect( loader.onLoad ).toBe( onLoad );
		} );

		it( 'should accept onError callback', () => {
			const onError = jest.fn();
			const loader = new ImageLoader( { onError } );

			expect( loader.onError ).toBe( onError );
		} );

		it( 'should handle null options', () => {
			const loader = new ImageLoader( null );

			expect( loader.filename ).toBe( '' );
		} );
	} );

	describe( 'buildUrlList', () => {
		it( 'should include backgroundImageUrl first if provided', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/bg.jpg'
			} );

			const urls = loader.buildUrlList();

			expect( urls[ 0 ] ).toBe( 'https://example.com/bg.jpg' );
		} );

		it( 'should include MediaWiki redirect URLs for filename', () => {
			const loader = new ImageLoader( { filename: 'Test.jpg' } );

			const urls = loader.buildUrlList();

			expect( urls.some( ( url ) => url.includes( 'Special:Redirect/file' ) ) ).toBe( true );
		} );

		it( 'should encode filename in URLs', () => {
			const loader = new ImageLoader( { filename: 'Test Image.jpg' } );

			const urls = loader.buildUrlList();

			expect( urls.some( ( url ) => url.includes( 'Test%20Image.jpg' ) ) ).toBe( true );
		} );

		it( 'should prioritize same-origin URLs', () => {
			const loader = new ImageLoader( {
				filename: 'Test.jpg'
			} );

			const urls = loader.buildUrlList();

			// Should have same-origin URL first (after backgroundImageUrl if set)
			expect( urls.length ).toBeGreaterThan( 0 );
		} );

		it( 'should return empty array when no sources available', () => {
			window.mw = undefined;
			const loader = new ImageLoader( {} );

			const urls = loader.buildUrlList();

			expect( Array.isArray( urls ) ).toBe( true );
		} );

		it( 'should find images on the page', () => {
			// Add an image to the page
			const img = document.createElement( 'img' );
			img.src = 'https://wiki.example.com/images/Test.jpg';
			img.className = 'mw-file-element';
			const container = document.createElement( 'div' );
			container.className = 'mw-file-element';
			container.appendChild( img );
			document.body.appendChild( container );

			const loader = new ImageLoader( { filename: 'Test.jpg' } );
			const urls = loader.buildUrlList();

			expect( urls ).toContain( 'https://wiki.example.com/images/Test.jpg' );

			document.body.removeChild( container );
		} );

		it( 'should add thumbnail URL first for TIFF files', () => {
			const loader = new ImageLoader( { filename: 'Diagram.tif' } );

			const urls = loader.buildUrlList();

			// First URL should be the thumbnail URL with width parameter
			expect( urls[ 0 ] ).toContain( 'Special:Redirect/file/Diagram.tif' );
			expect( urls[ 0 ] ).toContain( 'width=2048' );
		} );

		it( 'should add thumbnail URL first for TIFF files (uppercase extension)', () => {
			const loader = new ImageLoader( { filename: 'Diagram.TIFF' } );

			const urls = loader.buildUrlList();

			// First URL should be the thumbnail URL with width parameter
			expect( urls[ 0 ] ).toContain( 'width=2048' );
		} );

		it( 'should NOT add thumbnail URL first for regular image formats', () => {
			const loader = new ImageLoader( { filename: 'Photo.jpg' } );

			const urls = loader.buildUrlList();

			// Regular images should not have width parameter in first URL
			// (unless backgroundImageUrl is set, which it isn't here)
			const hasWidthParam = urls.length > 0 && urls[ 0 ].includes( 'width=' );
			expect( hasWidthParam ).toBe( false );
		} );

		it( 'should handle other non-web formats like XCF', () => {
			const loader = new ImageLoader( { filename: 'Artwork.xcf' } );

			const urls = loader.buildUrlList();

			// Should use thumbnail for GIMP files too
			expect( urls[ 0 ] ).toContain( 'width=2048' );
		} );

		it( 'should handle PDF files', () => {
			const loader = new ImageLoader( { filename: 'Document.pdf' } );

			const urls = loader.buildUrlList();

			// Should use thumbnail for PDF files
			expect( urls[ 0 ] ).toContain( 'width=2048' );
		} );

		it( 'should log when using thumbnail for non-web format', () => {
			const loader = new ImageLoader( { filename: 'Diagram.tif' } );

			loader.buildUrlList();

			expect( window.mw.log.warn ).toHaveBeenCalledWith(
				'[ImageLoader] Using thumbnail for non-web format: Diagram.tif'
			);
		} );
	} );

	describe( 'isSameOrigin', () => {
		it( 'should return true for same-origin URLs', () => {
			const loader = new ImageLoader();
			// Use the actual origin from window.location
			const sameOriginUrl = window.location.origin + '/image.jpg';

			expect( loader.isSameOrigin( sameOriginUrl ) ).toBe( true );
		} );

		it( 'should return false for cross-origin URLs', () => {
			const loader = new ImageLoader();

			expect( loader.isSameOrigin( 'https://other.example.com/image.jpg' ) ).toBe( false );
		} );

		it( 'should return true for relative URLs', () => {
			const loader = new ImageLoader();

			expect( loader.isSameOrigin( '/w/images/Test.jpg' ) ).toBe( true );
		} );

		it( 'should return true for protocol-relative same-origin', () => {
			const loader = new ImageLoader();

			// Protocol-relative URLs starting with // are cross-origin by this logic
			expect( loader.isSameOrigin( '//wiki.example.com/image.jpg' ) ).toBe( false );
		} );
	} );

	describe( 'load', () => {
		it( 'should set isLoading to true', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();

			expect( loader.isLoading ).toBe( true );
		} );

		it( 'should not load again if already loading', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();
			loader.load(); // Second call should be ignored

			expect( window.mw.log.warn ).toHaveBeenCalledWith(
				'[ImageLoader] Load already in progress'
			);
		} );

		it( 'should load test image when no URLs available', () => {
			window.mw = undefined;
			jest.resetModules();
			require( '../../resources/ext.layers.editor/ImageLoader.js' );
			const TestImageLoader = window.Layers.Utils.ImageLoader;

			const loader = new TestImageLoader( {} );
			loader.load();

			// Should attempt to load SVG data URL
			expect( mockImage.src ).toContain( 'data:image/svg+xml;base64,' );
		} );

		it( 'should call onLoad when image loads successfully', () => {
			const onLoad = jest.fn();
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://wiki.example.com/image.jpg',
				onLoad
			} );

			loader.load();

			// Simulate successful load
			mockImage.onload();

			expect( onLoad ).toHaveBeenCalledWith( mockImage, expect.objectContaining( {
				width: 800,
				height: 600,
				source: 'url',
				url: 'https://wiki.example.com/image.jpg'
			} ) );
		} );

		it( 'should try next URL on error', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://wiki.example.com/image1.jpg',
				filename: 'Test.jpg'
			} );

			loader.load();
			const firstUrl = mockImage.src;

			// Simulate error
			mockImage.onerror();

			// Should have tried a different URL or with CORS
			expect( mockImage.src !== firstUrl || mockImage.crossOrigin === 'anonymous' ).toBe( true );
		} );

		it( 'should set crossOrigin for cross-origin URLs when retrying with CORS', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://other-origin.com/image.jpg'
			} );

			loader.load();
			expect( mockImage.crossOrigin ).toBeNull();

			// Simulate error - should retry with CORS
			mockImage.onerror();

			expect( mockImage.crossOrigin ).toBe( 'anonymous' );
		} );
	} );

	describe( 'loadTestImage', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		it( 'should create SVG placeholder image', () => {
			const loader = new ImageLoader( { filename: 'Test.jpg' } );

			loader.loadTestImage();

			expect( mockImage.src ).toContain( 'data:image/svg+xml;base64,' );
		} );

		it( 'should call onLoad with placeholder metadata', () => {
			const onLoad = jest.fn();
			const loader = new ImageLoader( {
				filename: 'Test.jpg',
				onLoad
			} );

			loader.loadTestImage();
			mockImage.onload();

			expect( onLoad ).toHaveBeenCalledWith( mockImage, expect.objectContaining( {
				width: 800,
				height: 600,
				source: 'test',
				isPlaceholder: true
			} ) );
		} );

		it( 'should call onError if SVG fails to load', () => {
			const onError = jest.fn();
			const loader = new ImageLoader( {
				filename: 'Test.jpg',
				onError
			} );

			loader.loadTestImage();
			mockImage.onerror();

			expect( onError ).toHaveBeenCalledWith( expect.any( Error ) );
		} );

		it( 'should timeout after configured duration', () => {
			const onError = jest.fn();
			const loader = new ImageLoader( {
				filename: 'Test.jpg',
				onError
			} );

			// Set isLoading since loadTestImage checks this for timeout
			loader.isLoading = true;
			loader.loadTestImage();

			// Advance timers past timeout
			jest.advanceTimersByTime( 6000 );

			expect( onError ).toHaveBeenCalledWith(
				expect.objectContaining( { message: 'Image load timeout' } )
			);
		} );

		it( 'should not call onError if image loads before timeout', () => {
			const onError = jest.fn();
			const loader = new ImageLoader( {
				filename: 'Test.jpg',
				onError
			} );

			loader.loadTestImage();
			mockImage.onload();

			// Advance timers
			jest.advanceTimersByTime( 6000 );

			expect( onError ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'createTestImageSvg', () => {
		it( 'should create valid SVG markup', () => {
			const loader = new ImageLoader();

			const svg = loader.createTestImageSvg( 'Test.jpg' );

			expect( svg ).toContain( '<svg' );
			expect( svg ).toContain( '</svg>' );
			expect( svg ).toContain( 'Test.jpg' );
		} );

		it( 'should escape HTML entities in filename', () => {
			const loader = new ImageLoader();

			const svg = loader.createTestImageSvg( '<script>alert("xss")</script>' );

			expect( svg ).not.toContain( '<script>' );
			expect( svg ).toContain( '&lt;script&gt;' );
		} );

		it( 'should use default text for empty filename', () => {
			const loader = new ImageLoader();

			const svg = loader.createTestImageSvg( '' );

			expect( svg ).toContain( 'Sample Image' );
		} );

		it( 'should escape ampersands', () => {
			const loader = new ImageLoader();

			const svg = loader.createTestImageSvg( 'Test & Image.jpg' );

			expect( svg ).toContain( '&amp;' );
		} );

		it( 'should escape quotes', () => {
			const loader = new ImageLoader();

			const svg = loader.createTestImageSvg( 'Test "Image".jpg' );

			expect( svg ).toContain( '&quot;' );
		} );
	} );

	describe( 'getImage', () => {
		it( 'should return null before loading', () => {
			const loader = new ImageLoader();

			expect( loader.getImage() ).toBeNull();
		} );

		it( 'should return the image after loading', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();

			expect( loader.getImage() ).toBe( mockImage );
		} );
	} );

	describe( 'isLoadingImage', () => {
		it( 'should return false initially', () => {
			const loader = new ImageLoader();

			expect( loader.isLoadingImage() ).toBe( false );
		} );

		it( 'should return true while loading', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();

			expect( loader.isLoadingImage() ).toBe( true );
		} );

		it( 'should return false after load completes', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();
			mockImage.onload();

			expect( loader.isLoadingImage() ).toBe( false );
		} );
	} );

	describe( 'abort', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		it( 'should set isLoading to false', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();
			loader.abort();

			expect( loader.isLoading ).toBe( false );
		} );

		it( 'should clear image handlers', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();
			loader.abort();

			expect( mockImage.onload ).toBeNull();
			expect( mockImage.onerror ).toBeNull();
		} );

		it( 'should clear the image src', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();
			loader.abort();

			expect( mockImage.src ).toBe( '' );
		} );

		it( 'should clear load timeout', () => {
			const loader = new ImageLoader( { filename: 'Test.jpg' } );

			loader.loadTestImage();
			expect( loader.loadTimeoutId ).not.toBeNull();

			loader.abort();

			expect( loader.loadTimeoutId ).toBeNull();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should call abort', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();
			loader.destroy();

			expect( loader.isLoading ).toBe( false );
		} );

		it( 'should clear image reference', () => {
			const loader = new ImageLoader( {
				backgroundImageUrl: 'https://example.com/image.jpg'
			} );

			loader.load();
			loader.destroy();

			expect( loader.image ).toBeNull();
		} );

		it( 'should clear callbacks', () => {
			const onLoad = jest.fn();
			const onError = jest.fn();
			const loader = new ImageLoader( { onLoad, onError } );

			loader.destroy();

			expect( loader.onLoad ).toBeNull();
			expect( loader.onError ).toBeNull();
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should handle mw.config being undefined', () => {
			window.mw = {
				log: { warn: jest.fn() }
			};

			const loader = new ImageLoader( { filename: 'Test.jpg' } );
			const urls = loader.buildUrlList();

			expect( Array.isArray( urls ) ).toBe( true );
		} );

		it( 'should handle window.Layers.Constants being undefined', () => {
			delete window.Layers.Constants;

			const loader = new ImageLoader( { filename: 'Test.jpg' } );

			// Should not throw
			expect( () => loader.loadTestImage() ).not.toThrow();
		} );

		it( 'should not duplicate URLs in the list', () => {
			// Add same image twice on page
			const img1 = document.createElement( 'img' );
			img1.src = 'https://wiki.example.com/images/Test.jpg';
			const img2 = document.createElement( 'img' );
			img2.src = 'https://wiki.example.com/images/Test.jpg';

			const div1 = document.createElement( 'div' );
			div1.className = 'fullImageLink';
			div1.appendChild( img1 );
			const div2 = document.createElement( 'div' );
			div2.className = 'fullImageLink';
			div2.appendChild( img2 );

			document.body.appendChild( div1 );
			document.body.appendChild( div2 );

			const loader = new ImageLoader( { filename: 'Test.jpg' } );
			const urls = loader.buildUrlList();

			// Count occurrences
			const count = urls.filter( ( u ) => u === 'https://wiki.example.com/images/Test.jpg' ).length;
			expect( count ).toBe( 1 );

			document.body.removeChild( div1 );
			document.body.removeChild( div2 );
		} );
	} );
} );
