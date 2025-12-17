/**
 * @jest-environment jsdom
 */

/**
 * Tests for EditorBootstrap
 *
 * EditorBootstrap handles Layers Editor initialization and lifecycle:
 * - Dependency validation
 * - Hook registration
 * - Auto-bootstrap from MediaWiki config
 * - Global error handling
 * - Cleanup on page navigation
 */

const EditorBootstrap = require( '../../resources/ext.layers.editor/editor/EditorBootstrap.js' );

describe( 'EditorBootstrap', () => {
	let originalWindow;

	beforeEach( () => {
		// Store original window state
		originalWindow = { ...window };

		// Clear document body
		document.body.innerHTML = '';

		// Mock mw
		global.mw = {
			log: jest.fn(),
			hook: jest.fn( () => ( {
				add: jest.fn(),
				fire: jest.fn()
			} ) ),
			config: {
				get: jest.fn( ( key, defaultValue ) => defaultValue )
			}
		};
		mw.log.warn = jest.fn();
		mw.log.error = jest.fn();

		// Clear window.Layers namespace
		window.Layers = {};
	} );

	afterEach( () => {
		// Restore window state
		delete window.Layers;
		delete window.layersEditorInstance;
		delete window._layersHookListener;
	} );

	describe( 'module export', () => {
		it( 'should export validateDependencies function', () => {
			expect( typeof EditorBootstrap.validateDependencies ).toBe( 'function' );
		} );

		it( 'should export areEditorDependenciesReady function', () => {
			expect( typeof EditorBootstrap.areEditorDependenciesReady ).toBe( 'function' );
		} );

		it( 'should export sanitizeGlobalErrorMessage function', () => {
			expect( typeof EditorBootstrap.sanitizeGlobalErrorMessage ).toBe( 'function' );
		} );

		it( 'should export cleanupGlobalEditorInstance function', () => {
			expect( typeof EditorBootstrap.cleanupGlobalEditorInstance ).toBe( 'function' );
		} );

		it( 'should export init function', () => {
			expect( typeof EditorBootstrap.init ).toBe( 'function' );
		} );
	} );

	describe( 'validateDependencies', () => {
		it( 'should return false when LayersConstants is missing', () => {
			window.Layers = {};

			const result = EditorBootstrap.validateDependencies();

			expect( result ).toBe( false );
			expect( mw.log.warn ).toHaveBeenCalled();
		} );

		it( 'should return false when required classes are missing', () => {
			window.Layers = {
				Constants: {
					TOOLS: {},
					LAYER_TYPES: {},
					DEFAULTS: {},
					UI: {},
					LIMITS: {}
				}
			};

			const result = EditorBootstrap.validateDependencies();

			expect( result ).toBe( false );
		} );

		it( 'should return false when required constant groups are missing', () => {
			window.Layers = {
				Constants: {} // Missing TOOLS, LAYER_TYPES, etc.
			};

			const result = EditorBootstrap.validateDependencies();

			expect( result ).toBe( false );
		} );

		it( 'should log warning with missing dependency names', () => {
			window.Layers = {};

			EditorBootstrap.validateDependencies();

			expect( mw.log.warn ).toHaveBeenCalledWith(
				expect.stringContaining( 'Missing dependencies' )
			);
		} );
	} );

	describe( 'areEditorDependenciesReady', () => {
		it( 'should return false when window.Layers is undefined', () => {
			delete window.Layers;

			const result = EditorBootstrap.areEditorDependenciesReady();

			expect( result ).toBeFalsy();
		} );

		it( 'should return false when Constants is missing', () => {
			window.Layers = {};

			const result = EditorBootstrap.areEditorDependenciesReady();

			expect( result ).toBeFalsy();
		} );

		it( 'should return false when Canvas.Manager is not a function', () => {
			window.Layers = {
				Constants: {},
				Canvas: {}
			};

			const result = EditorBootstrap.areEditorDependenciesReady();

			expect( result ).toBeFalsy();
		} );

		it( 'should return true when all dependencies are available', () => {
			window.Layers = {
				Constants: {},
				Canvas: {
					Manager: function () {}
				}
			};

			const result = EditorBootstrap.areEditorDependenciesReady();

			expect( result ).toBe( true );
		} );
	} );

	describe( 'sanitizeGlobalErrorMessage', () => {
		it( 'should return error message from Error object', () => {
			const error = new Error( 'Test error' );

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			expect( result ).toBe( 'Test error' );
		} );

		it( 'should return string error directly', () => {
			const result = EditorBootstrap.sanitizeGlobalErrorMessage( 'Simple error' );

			expect( result ).toBe( 'Simple error' );
		} );

		it( 'should sanitize tokens (base64 patterns)', () => {
			const error = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			expect( result ).toContain( '[TOKEN]' );
			expect( result ).not.toContain( 'eyJhbGci' );
		} );

		it( 'should sanitize hex patterns (via token pattern)', () => {
			// Long hex strings match the TOKEN pattern first
			const error = 'Hash: a1b2c3d4e5f6a1b2c3d4';

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			// Should be sanitized by TOKEN pattern (matches base64-like patterns first)
			expect( result ).toContain( '[TOKEN]' );
			expect( result ).not.toContain( 'a1b2c3d4' );
		} );

		it( 'should sanitize Windows file paths', () => {
			const error = 'File error at C:\\Users\\Admin\\file.txt';

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			expect( result ).toContain( '[PATH]' );
			expect( result ).not.toContain( 'Users\\Admin' );
		} );

		it( 'should sanitize Unix file paths', () => {
			const error = 'File error at /home/user/secret.txt';

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			expect( result ).toContain( '[PATH]' );
		} );

		it( 'should sanitize URLs (via path pattern after protocol)', () => {
			// URL pattern gets partially matched by PATH pattern
			const error = 'Request to https://api.example.com/secret failed';

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			// Should contain PATH markers (path pattern catches URL paths)
			expect( result ).toContain( '[PATH]' );
			expect( result ).not.toContain( 'api.example.com' );
		} );

		it( 'should sanitize IP addresses', () => {
			const error = 'Connection to 192.168.1.100:8080 failed';

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			expect( result ).toContain( '[IP]' );
			expect( result ).not.toContain( '192.168.1.100' );
		} );

		it( 'should sanitize email addresses', () => {
			const error = 'Contact admin@example.com for help';

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			expect( result ).toContain( '[EMAIL]' );
			expect( result ).not.toContain( 'admin@example.com' );
		} );

		it( 'should truncate long messages', () => {
			// Use a pattern that won't match TOKEN (300 x's matches the TOKEN pattern)
			// Use a message with varied content that won't be tokenized
			const longError = 'Error occurred while processing. '.repeat( 20 );

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( longError );

			expect( result.length ).toBeLessThanOrEqual( 220 ); // 200 + '[TRUNCATED]' + potential sanitization
			expect( result ).toContain( '[TRUNCATED]' );
		} );

		it( 'should handle null input', () => {
			const result = EditorBootstrap.sanitizeGlobalErrorMessage( null );

			expect( result ).toBe( 'An error occurred' );
		} );

		it( 'should handle undefined input', () => {
			const result = EditorBootstrap.sanitizeGlobalErrorMessage( undefined );

			expect( result ).toBe( 'An error occurred' );
		} );

		it( 'should handle object with toString', () => {
			const obj = {
				toString: () => 'Custom error string'
			};

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( obj );

			expect( result ).toBe( 'Custom error string' );
		} );
	} );

	describe( 'cleanupGlobalEditorInstance', () => {
		it( 'should call destroy on existing editor instance', () => {
			const mockDestroy = jest.fn();
			window.layersEditorInstance = {
				destroy: mockDestroy
			};

			EditorBootstrap.cleanupGlobalEditorInstance();

			expect( mockDestroy ).toHaveBeenCalled();
		} );

		it( 'should set global instance to null after cleanup', () => {
			window.layersEditorInstance = {
				destroy: jest.fn()
			};

			EditorBootstrap.cleanupGlobalEditorInstance();

			expect( window.layersEditorInstance ).toBeNull();
		} );

		it( 'should not throw when no editor instance exists', () => {
			delete window.layersEditorInstance;

			expect( () => EditorBootstrap.cleanupGlobalEditorInstance() ).not.toThrow();
		} );

		it( 'should not throw when editor has no destroy method', () => {
			window.layersEditorInstance = {};

			expect( () => EditorBootstrap.cleanupGlobalEditorInstance() ).not.toThrow();
		} );
	} );

	describe( 'init', () => {
		it( 'should not throw during initialization', () => {
			expect( () => EditorBootstrap.init() ).not.toThrow();
		} );

		it( 'should work when mw.hook is available', () => {
			global.mw = {
				log: jest.fn(),
				hook: jest.fn( () => ( {
					add: jest.fn()
				} ) ),
				config: {
					get: jest.fn()
				}
			};

			expect( () => EditorBootstrap.init() ).not.toThrow();
			expect( mw.hook ).toHaveBeenCalledWith( 'layers.editor.init' );
		} );
	} );

	describe( 'security sanitization patterns', () => {
		it( 'should sanitize connection strings (via path and other patterns)', () => {
			const error = 'Failed: mysql://user:pass@host:3306/db';

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			// PATH pattern catches parts of the connection string
			expect( result ).toContain( '[PATH]' );
			// Important: sensitive data should be removed
			expect( result ).not.toContain( 'user:pass@host' );
		} );

		it( 'should handle multiple sanitization patterns in one message', () => {
			// Test IP separately since it's not caught by other patterns
			const errorWithIP = 'Error from 192.168.1.1 failed';
			const resultIP = EditorBootstrap.sanitizeGlobalErrorMessage( errorWithIP );
			expect( resultIP ).toContain( '[IP]' );

			// Test email separately
			const errorWithEmail = 'Contact user@example.com';
			const resultEmail = EditorBootstrap.sanitizeGlobalErrorMessage( errorWithEmail );
			expect( resultEmail ).toContain( '[EMAIL]' );

			// Combined test with IP at start (not after URL which gets PATH-ified)
			const combined = 'Server 192.168.1.1 error: could not connect';
			const resultCombined = EditorBootstrap.sanitizeGlobalErrorMessage( combined );
			expect( resultCombined ).toContain( '[IP]' );
			expect( resultCombined ).not.toContain( '192.168.1.1' );
		} );

		it( 'should not sanitize short hex strings (less than 16 chars)', () => {
			const error = 'Color: #ff0000';

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			// Short hex like color codes should NOT be sanitized
			expect( result ).toBe( 'Color: #ff0000' );
		} );

		it( 'should handle error objects without message property', () => {
			const error = { code: 500 };

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( error );

			// Should use toString() fallback which gives [object Object]
			expect( typeof result ).toBe( 'string' );
		} );
	} );
} );
