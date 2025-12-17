/**
 * @jest-environment jsdom
 */

/**
 * Tests for UrlParser
 *
 * UrlParser provides URL and parameter parsing utilities for Layers viewer:
 * - HTML entity decoding
 * - Layers parameter extraction from URLs
 * - Filename inference from image elements
 * - File namespace detection
 */

const UrlParser = require( '../../resources/ext.layers/viewer/UrlParser.js' );

describe( 'UrlParser', () => {
	let urlParser;

	beforeEach( () => {
		// Clear document body
		document.body.innerHTML = '';

		// Mock mw
		global.mw = {
			log: jest.fn(),
			config: {
				get: jest.fn( ( key, defaultValue ) => {
					if ( key === 'wgFormattedNamespaces' ) {
						return { '6': 'File' };
					}
					if ( key === 'wgNamespaceNumber' ) {
						return 0;
					}
					return defaultValue;
				} )
			},
			util: {
				getParamValue: jest.fn()
			}
		};
		mw.log.warn = jest.fn();

		// Register in namespace
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.UrlParser = UrlParser;

		urlParser = new UrlParser( { debug: false } );
	} );

	afterEach( () => {
		document.body.innerHTML = '';
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default debug off', () => {
			const parser = new UrlParser();
			expect( parser.debug ).toBeFalsy();
		} );

		it( 'should create instance with debug enabled', () => {
			const parser = new UrlParser( { debug: true } );
			expect( parser.debug ).toBe( true );
		} );
	} );

	describe( 'escapeRegExp', () => {
		it( 'should escape special regex characters', () => {
			const result = urlParser.escapeRegExp( 'test.file[1]' );
			expect( result ).toBe( 'test\\.file\\[1\\]' );
		} );

		it( 'should escape all special characters', () => {
			const result = urlParser.escapeRegExp( '.*+?^${}()|[]\\' );
			expect( result ).toBe( '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\' );
		} );

		it( 'should not modify strings without special chars', () => {
			const result = urlParser.escapeRegExp( 'simple-string_123' );
			expect( result ).toBe( 'simple-string_123' );
		} );
	} );

	describe( 'decodeHtmlEntities', () => {
		it( 'should decode &amp; to &', () => {
			const result = urlParser.decodeHtmlEntities( 'Tom &amp; Jerry' );
			expect( result ).toBe( 'Tom & Jerry' );
		} );

		it( 'should decode &quot; to quote', () => {
			const result = urlParser.decodeHtmlEntities( 'Say &quot;Hello&quot;' );
			expect( result ).toBe( 'Say "Hello"' );
		} );

		it( 'should decode &#34; to quote', () => {
			const result = urlParser.decodeHtmlEntities( 'Say &#34;Hello&#34;' );
			expect( result ).toBe( 'Say "Hello"' );
		} );

		it( 'should decode &#x22; to quote (case insensitive)', () => {
			const result = urlParser.decodeHtmlEntities( 'Say &#x22;Hello&#X22;' );
			expect( result ).toBe( 'Say "Hello"' );
		} );

		it( 'should handle nested &amp;quot;', () => {
			const result = urlParser.decodeHtmlEntities( '&amp;quot;test&amp;quot;' );
			expect( result ).toBe( '"test"' );
		} );

		it( 'should return null/undefined input unchanged', () => {
			expect( urlParser.decodeHtmlEntities( null ) ).toBe( null );
			expect( urlParser.decodeHtmlEntities( undefined ) ).toBe( undefined );
		} );

		it( 'should return non-string input unchanged', () => {
			expect( urlParser.decodeHtmlEntities( 123 ) ).toBe( 123 );
		} );
	} );

	describe( 'isAllowedLayersValue', () => {
		it( 'should return true for "on"', () => {
			expect( urlParser.isAllowedLayersValue( 'on' ) ).toBe( true );
		} );

		it( 'should return true for "ON" (case insensitive)', () => {
			expect( urlParser.isAllowedLayersValue( 'ON' ) ).toBe( true );
		} );

		it( 'should return true for "all"', () => {
			expect( urlParser.isAllowedLayersValue( 'all' ) ).toBe( true );
		} );

		it( 'should return true for "true"', () => {
			expect( urlParser.isAllowedLayersValue( 'true' ) ).toBe( true );
		} );

		it( 'should return true for "1"', () => {
			expect( urlParser.isAllowedLayersValue( '1' ) ).toBe( true );
		} );

		it( 'should return true for "yes"', () => {
			expect( urlParser.isAllowedLayersValue( 'yes' ) ).toBe( true );
		} );

		it( 'should return true for "id:123"', () => {
			expect( urlParser.isAllowedLayersValue( 'id:123' ) ).toBe( true );
		} );

		it( 'should return true for "name:anatomy"', () => {
			expect( urlParser.isAllowedLayersValue( 'name:anatomy' ) ).toBe( true );
		} );

		it( 'should return true for hex IDs', () => {
			expect( urlParser.isAllowedLayersValue( 'ab12cd' ) ).toBe( true );
			expect( urlParser.isAllowedLayersValue( 'ab,cd,ef' ) ).toBe( true );
		} );

		it( 'should return false for empty string', () => {
			expect( urlParser.isAllowedLayersValue( '' ) ).toBe( false );
		} );

		it( 'should return false for null', () => {
			expect( urlParser.isAllowedLayersValue( null ) ).toBe( false );
		} );

		it( 'should return false for "off"', () => {
			expect( urlParser.isAllowedLayersValue( 'off' ) ).toBe( false );
		} );

		it( 'should return false for "none"', () => {
			expect( urlParser.isAllowedLayersValue( 'none' ) ).toBe( false );
		} );

		it( 'should trim whitespace', () => {
			expect( urlParser.isAllowedLayersValue( '  on  ' ) ).toBe( true );
		} );

		it( 'should strip quotes', () => {
			expect( urlParser.isAllowedLayersValue( '"on"' ) ).toBe( true );
			expect( urlParser.isAllowedLayersValue( "'on'" ) ).toBe( true );
		} );
	} );

	describe( 'getPageLayersParam', () => {
		it( 'should return null when no layers param exists', () => {
			mw.config.get.mockReturnValue( null );
			mw.util.getParamValue.mockReturnValue( null );

			const result = urlParser.getPageLayersParam();

			expect( result ).toBeNull();
		} );

		it( 'should return server-provided wgLayersParam', () => {
			mw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgLayersParam' ) {
					return 'on';
				}
				return null;
			} );

			const result = urlParser.getPageLayersParam();

			expect( result ).toBe( 'on' );
		} );

		it( 'should use mw.util.getParamValue as fallback', () => {
			mw.config.get.mockReturnValue( null );
			mw.util.getParamValue.mockImplementation( ( param ) => {
				if ( param === 'layers' ) {
					return 'anatomy';
				}
				return null;
			} );

			const result = urlParser.getPageLayersParam();

			expect( result ).toBe( 'anatomy' );
		} );
	} );

	describe( 'getFileNamespace', () => {
		it( 'should return "File" from mw.config', () => {
			const result = urlParser.getFileNamespace();

			expect( result ).toBe( 'File' );
		} );

		it( 'should return default "File" when mw unavailable', () => {
			delete global.mw;

			const result = urlParser.getFileNamespace();

			expect( result ).toBe( 'File' );
		} );
	} );

	describe( 'getNamespaceNumber', () => {
		it( 'should return namespace from mw.config', () => {
			mw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgNamespaceNumber' ) {
					return 6;
				}
				return null;
			} );

			const result = urlParser.getNamespaceNumber();

			expect( result ).toBe( 6 );
		} );

		it( 'should return -1 when mw unavailable', () => {
			delete global.mw;

			const result = urlParser.getNamespaceNumber();

			expect( result ).toBe( -1 );
		} );
	} );

	describe( 'isFileLinkAnchor', () => {
		it( 'should return false for null anchor', () => {
			expect( urlParser.isFileLinkAnchor( null, 'File' ) ).toBe( false );
		} );

		it( 'should return false for anchor without href', () => {
			const anchor = document.createElement( 'a' );

			expect( urlParser.isFileLinkAnchor( anchor, 'File' ) ).toBe( false );
		} );

		it( 'should return true for ?title=File: URL', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/index.php?title=File:Test.jpg';

			expect( urlParser.isFileLinkAnchor( anchor, 'File' ) ).toBe( true );
		} );

		it( 'should return true for /wiki/File: URL', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/wiki/File:Test.jpg';

			expect( urlParser.isFileLinkAnchor( anchor, 'File' ) ).toBe( true );
		} );

		it( 'should return true for #/media/File: URL', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/wiki/Page#/media/File:Test.jpg';

			expect( urlParser.isFileLinkAnchor( anchor, 'File' ) ).toBe( true );
		} );

		it( 'should return true for Special:FilePath URL', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/wiki/Special:FilePath/Test.jpg';

			expect( urlParser.isFileLinkAnchor( anchor, 'File' ) ).toBe( true );
		} );

		it( 'should return true for anchor with mw-file-description class', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/some/path';
			anchor.className = 'mw-file-description';

			expect( urlParser.isFileLinkAnchor( anchor, 'File' ) ).toBe( true );
		} );

		it( 'should return true for anchor with File: title attribute', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/some/path';
			anchor.title = 'File:Test.jpg';

			expect( urlParser.isFileLinkAnchor( anchor, 'File' ) ).toBe( true );
		} );

		it( 'should return false for non-file anchor', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/wiki/Main_Page';

			expect( urlParser.isFileLinkAnchor( anchor, 'File' ) ).toBe( false );
		} );
	} );

	describe( 'inferFilename', () => {
		it( 'should extract filename from anchor href path', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/wiki/File:Test_Image.jpg';
			const img = document.createElement( 'img' );
			anchor.appendChild( img );
			document.body.appendChild( anchor );

			const result = urlParser.inferFilename( img, 'File' );

			expect( result ).toBe( 'Test Image.jpg' );
		} );

		it( 'should extract filename from anchor title attribute', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/some/path';
			anchor.title = 'File:Another_Image.png';
			const img = document.createElement( 'img' );
			anchor.appendChild( img );
			document.body.appendChild( anchor );

			const result = urlParser.inferFilename( img, 'File' );

			expect( result ).toBe( 'Another Image.png' );
		} );

		it( 'should extract filename from data-file attribute', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-file', 'DataFile_Test.gif' );
			document.body.appendChild( img );

			const result = urlParser.inferFilename( img, 'File' );

			expect( result ).toBe( 'DataFile Test.gif' );
		} );

		it( 'should extract filename from data-image-name attribute', () => {
			const img = document.createElement( 'img' );
			img.setAttribute( 'data-image-name', 'ImageName_Test.webp' );
			document.body.appendChild( img );

			const result = urlParser.inferFilename( img, 'File' );

			expect( result ).toBe( 'ImageName Test.webp' );
		} );

		it( 'should extract filename from image src path', () => {
			const img = document.createElement( 'img' );
			img.src = '/images/thumb/a/ab/Extracted_From_Src.jpg/220px-Extracted_From_Src.jpg';
			document.body.appendChild( img );

			const result = urlParser.inferFilename( img, 'File' );

			// Should match the filename pattern in the src
			expect( result ).toContain( '.jpg' );
		} );

		it( 'should return null when no filename can be inferred', () => {
			const img = document.createElement( 'img' );
			document.body.appendChild( img );

			const result = urlParser.inferFilename( img, 'File' );

			expect( result ).toBeNull();
		} );
	} );

	describe( 'detectLayersFromDataMw', () => {
		it( 'should detect layers from data-mw JSON', () => {
			const div = document.createElement( 'div' );
			div.setAttribute( 'data-mw', JSON.stringify( {
				parts: [ { template: { params: { layers: 'on' } } } ]
			} ) );
			const img = document.createElement( 'img' );
			div.appendChild( img );
			document.body.appendChild( div );

			const result = urlParser.detectLayersFromDataMw( img );

			expect( result ).toBe( 'on' );
		} );

		it( 'should detect layers from nested data-mw structure', () => {
			const div = document.createElement( 'div' );
			div.setAttribute( 'data-mw', JSON.stringify( {
				body: {
					content: 'layers=anatomy'
				}
			} ) );
			const img = document.createElement( 'img' );
			div.appendChild( img );
			document.body.appendChild( div );

			const result = urlParser.detectLayersFromDataMw( img );

			expect( result ).toBe( 'anatomy' );
		} );

		it( 'should return null when no layers in data-mw', () => {
			const div = document.createElement( 'div' );
			div.setAttribute( 'data-mw', JSON.stringify( { foo: 'bar' } ) );
			const img = document.createElement( 'img' );
			div.appendChild( img );
			document.body.appendChild( div );

			const result = urlParser.detectLayersFromDataMw( img );

			expect( result ).toBeNull();
		} );

		it( 'should return null when no data-mw ancestor', () => {
			const img = document.createElement( 'img' );
			document.body.appendChild( img );

			const result = urlParser.detectLayersFromDataMw( img );

			expect( result ).toBeNull();
		} );

		it( 'should handle invalid JSON in data-mw gracefully', () => {
			const div = document.createElement( 'div' );
			div.setAttribute( 'data-mw', 'not valid json' );
			const img = document.createElement( 'img' );
			div.appendChild( img );
			document.body.appendChild( div );

			// Should not throw
			expect( () => urlParser.detectLayersFromDataMw( img ) ).not.toThrow();
		} );

		it( 'should use regex fallback for malformed JSON with layers', () => {
			const div = document.createElement( 'div' );
			div.setAttribute( 'data-mw', 'invalid json but has layers=fallback' );
			const img = document.createElement( 'img' );
			div.appendChild( img );
			document.body.appendChild( div );

			const result = urlParser.detectLayersFromDataMw( img );

			expect( result ).toBe( 'fallback' );
		} );
	} );

	describe( 'debug logging', () => {
		it( 'should log when debug is enabled', () => {
			const debugParser = new UrlParser( { debug: true } );

			debugParser.debugLog( 'test message' );

			expect( mw.log ).toHaveBeenCalledWith( '[Layers:UrlParser]', 'test message' );
		} );

		it( 'should not log when debug is disabled', () => {
			urlParser.debugLog( 'test message' );

			expect( mw.log ).not.toHaveBeenCalled();
		} );

		it( 'should warn when debug is enabled', () => {
			const debugParser = new UrlParser( { debug: true } );

			debugParser.debugWarn( 'warning message' );

			expect( mw.log.warn ).toHaveBeenCalledWith( '[Layers:UrlParser]', 'warning message' );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export to window.Layers.Viewer namespace', () => {
			expect( window.Layers.Viewer.UrlParser ).toBe( UrlParser );
		} );
	} );
} );
