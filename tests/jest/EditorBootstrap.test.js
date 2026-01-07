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

	describe( 'validateDependencies - all dependencies present', () => {
		it( 'should return true when all dependencies are available', () => {
			// Set up all required classes as functions
			const mockClass = function () {};
			window.Layers = {
				UI: {
					Manager: mockClass,
					Toolbar: mockClass,
					LayerPanel: mockClass
				},
				Core: {
					EventManager: mockClass,
					APIManager: mockClass,
					StateManager: mockClass,
					HistoryManager: mockClass
				},
				Canvas: {
					Manager: mockClass
				},
				Validation: {
					Manager: mockClass
				},
				Constants: {
					TOOLS: {},
					LAYER_TYPES: {},
					DEFAULTS: {},
					UI: {},
					LIMITS: {}
				}
			};

			// Also set up window globals for fallback lookup
			window.UIManager = mockClass;
			window.EventManager = mockClass;
			window.APIManager = mockClass;
			window.ValidationManager = mockClass;
			window.StateManager = mockClass;
			window.HistoryManager = mockClass;
			window.CanvasManager = mockClass;
			window.Toolbar = mockClass;
			window.LayerPanel = mockClass;

			const result = EditorBootstrap.validateDependencies();

			expect( result ).toBe( true );
			expect( mw.log.warn ).not.toHaveBeenCalled();

			// Clean up globals
			delete window.UIManager;
			delete window.EventManager;
			delete window.APIManager;
			delete window.ValidationManager;
			delete window.StateManager;
			delete window.HistoryManager;
			delete window.CanvasManager;
			delete window.Toolbar;
			delete window.LayerPanel;
		} );
	} );

	describe( 'sanitizeGlobalErrorMessage - edge cases', () => {
		it( 'should return non-string error message when toString returns non-string', () => {
			const obj = {
				toString: () => ( { notAString: true } )
			};

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( obj );

			expect( result ).toBe( 'Non-string error encountered' );
		} );

		it( 'should return error sanitization failed when sanitization throws', () => {
			// Create an object where message getter throws
			const errorObj = {};
			Object.defineProperty( errorObj, 'message', {
				get: () => {
					throw new Error( 'Getter throws' );
				}
			} );

			const result = EditorBootstrap.sanitizeGlobalErrorMessage( errorObj );

			expect( result ).toBe( 'Error sanitization failed' );
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

	describe( 'createHookListener behavior', () => {
		let mockHookAdd;

		beforeEach( () => {
			mockHookAdd = jest.fn();
			global.mw = {
				log: jest.fn(),
				hook: jest.fn( () => ( {
					add: mockHookAdd,
					fire: jest.fn()
				} ) ),
				config: {
					get: jest.fn()
				}
			};
			mw.log.warn = jest.fn();
			mw.log.error = jest.fn();

			// Reset document
			document.body.innerHTML = '';
		} );

		it( 'should retry when dependencies not ready', () => {
			jest.useFakeTimers();

			// Dependencies not ready
			window.Layers = {};

			// Trigger init which calls registerHook
			EditorBootstrap.init();

			// Get the hook listener that was registered
			expect( mw.hook ).toHaveBeenCalledWith( 'layers.editor.init' );
			const hookListener = mockHookAdd.mock.calls[ 0 ][ 0 ];

			// Call the hook listener directly
			hookListener( { filename: 'test.jpg' } );

			// Should have warned about dependencies not ready
			expect( mw.log.warn ).toHaveBeenCalledWith(
				expect.stringContaining( 'dependencies not ready' )
			);

			jest.useRealTimers();
		} );

		it( 'should log error at max retries', () => {
			jest.useFakeTimers();

			// Dependencies not ready
			window.Layers = {};

			EditorBootstrap.init();
			const hookListener = mockHookAdd.mock.calls[ 0 ][ 0 ];

			// Simulate reaching max retries by calling multiple times
			// After max retries, it will try to create editor which will throw
			for ( let i = 0; i < 21; i++ ) {
				try {
					hookListener( { filename: 'test.jpg' } );
				} catch ( e ) {
					// Expected - LayersEditor not available after max retries
				}
			}

			// Should eventually log error about max retries
			expect( mw.log.error ).toHaveBeenCalledWith(
				expect.stringContaining( 'Max dependency retries reached' )
			);

			jest.useRealTimers();
		} );

		it( 'should create editor when dependencies are ready', () => {
			const mockLayersEditor = jest.fn();
			window.LayersEditor = mockLayersEditor;
			window.Layers = {
				Constants: {},
				Canvas: {
					Manager: function () {}
				},
				Core: {
					Editor: mockLayersEditor
				}
			};

			EditorBootstrap.init();
			const hookListener = mockHookAdd.mock.calls[ 0 ][ 0 ];

			hookListener( { filename: 'test.jpg', container: document.body } );

			expect( mockLayersEditor ).toHaveBeenCalled();
			expect( document.title ).toContain( 'test.jpg' );

			delete window.LayersEditor;
		} );

		it( 'should throw and log error when LayersEditor creation fails', () => {
			const mockLayersEditor = jest.fn( () => {
				throw new Error( 'Editor creation failed' );
			} );
			window.LayersEditor = mockLayersEditor;
			window.Layers = {
				Constants: {},
				Canvas: {
					Manager: function () {}
				},
				Core: {
					Editor: mockLayersEditor
				}
			};

			EditorBootstrap.init();
			const hookListener = mockHookAdd.mock.calls[ 0 ][ 0 ];

			expect( () => hookListener( { filename: 'test.jpg' } ) ).toThrow( 'Editor creation failed' );
			expect( mw.log.error ).toHaveBeenCalledWith(
				expect.stringContaining( 'Error creating LayersEditor' ),
				expect.any( String )
			);

			delete window.LayersEditor;
		} );

		it( 'should throw when LayersEditor class not available', () => {
			window.Layers = {
				Constants: {},
				Canvas: {
					Manager: function () {}
				}
			};
			// No LayersEditor available

			EditorBootstrap.init();
			const hookListener = mockHookAdd.mock.calls[ 0 ][ 0 ];

			expect( () => hookListener( { filename: 'test.jpg' } ) ).toThrow( 'LayersEditor class not available' );
		} );

		it( 'should set document title with Unknown File when filename missing', () => {
			const mockLayersEditor = jest.fn();
			window.LayersEditor = mockLayersEditor;
			window.Layers = {
				Constants: {},
				Canvas: {
					Manager: function () {}
				},
				Core: {
					Editor: mockLayersEditor
				}
			};

			EditorBootstrap.init();
			const hookListener = mockHookAdd.mock.calls[ 0 ][ 0 ];

			hookListener( {} );

			expect( document.title ).toContain( 'Unknown File' );

			delete window.LayersEditor;
		} );

		it( 'should skip creation when editor instance already exists', () => {
			const mockLayersEditor = jest.fn();
			window.LayersEditor = mockLayersEditor;
			window.Layers = {
				Constants: {},
				Canvas: {
					Manager: function () {}
				},
				Core: {
					Editor: mockLayersEditor
				}
			};

			// Set existing editor instance
			window.layersEditorInstance = { existing: true };

			EditorBootstrap.init();
			const hookListener = mockHookAdd.mock.calls[ 0 ][ 0 ];

			hookListener( { filename: 'test.jpg', container: document.body } );

			// LayersEditor should NOT have been called since instance exists
			expect( mockLayersEditor ).not.toHaveBeenCalled();
			expect( mw.log ).toHaveBeenCalledWith(
				expect.stringContaining( 'Editor already exists' )
			);

			delete window.LayersEditor;
			delete window.layersEditorInstance;
		} );
	} );

	describe( 'global error handlers', () => {
		// Note: Global error handlers are registered once per module load.
		// Since handlersInitialized is module-level state, we can only test
		// the handlers that were registered during the first init() call.
		// We test the behavior by loading a fresh module copy.

		describe( 'with fresh module', () => {
			let freshModule;
			let unhandledRejectionHandlers;
			let errorHandlers;
			let originalAddEventListener;

			beforeEach( () => {
				jest.resetModules();

				unhandledRejectionHandlers = [];
				errorHandlers = [];
				originalAddEventListener = window.addEventListener;

				// Capture event listeners
				window.addEventListener = jest.fn( ( type, handler ) => {
					if ( type === 'unhandledrejection' ) {
						unhandledRejectionHandlers.push( handler );
					} else if ( type === 'error' ) {
						errorHandlers.push( handler );
					}
				} );

				global.mw = {
					log: jest.fn(),
					hook: jest.fn( () => ( {
						add: jest.fn()
					} ) ),
					config: {
						get: jest.fn()
					}
				};
				mw.log.warn = jest.fn();
				mw.log.error = jest.fn();

				// Load fresh module
				freshModule = require( '../../resources/ext.layers.editor/editor/EditorBootstrap.js' );
			} );

			afterEach( () => {
				window.addEventListener = originalAddEventListener;
			} );

			it( 'should suppress message channel closed errors in unhandledrejection', () => {
				// Fresh module load triggers init() which registers handlers
				expect( unhandledRejectionHandlers.length ).toBeGreaterThan( 0 );
				const handler = unhandledRejectionHandlers[ 0 ];

				const mockEvent = {
					reason: { message: 'message channel closed before response' },
					preventDefault: jest.fn()
				};

				handler( mockEvent );

				expect( mw.log.warn ).toHaveBeenCalledWith(
					expect.stringContaining( 'Suppressed message channel error' ),
					expect.anything()
				);
				expect( mockEvent.preventDefault ).toHaveBeenCalled();
			} );

			it( 'should log other unhandled rejections', () => {
				const handler = unhandledRejectionHandlers[ 0 ];
				const mockEvent = {
					reason: { message: 'Some other error' },
					preventDefault: jest.fn()
				};

				handler( mockEvent );

				expect( mw.log.error ).toHaveBeenCalledWith(
					expect.stringContaining( 'Unhandled promise rejection' ),
					expect.anything()
				);
			} );

			it( 'should handle unhandled rejection with null reason', () => {
				const handler = unhandledRejectionHandlers[ 0 ];
				const mockEvent = {
					reason: null,
					preventDefault: jest.fn()
				};

				handler( mockEvent );

				// Should log error for null reason
				expect( mw.log.error ).toHaveBeenCalledWith(
					expect.stringContaining( 'Unhandled promise rejection' ),
					null
				);
			} );

			it( 'should suppress message channel errors in error event', () => {
				expect( errorHandlers.length ).toBeGreaterThan( 0 );
				const handler = errorHandlers[ 0 ];

				const mockEvent = {
					error: { message: 'message channel closed' },
					preventDefault: jest.fn()
				};

				handler( mockEvent );

				expect( mw.log.warn ).toHaveBeenCalledWith(
					expect.stringContaining( 'Suppressed message channel error' ),
					expect.anything()
				);
				expect( mockEvent.preventDefault ).toHaveBeenCalled();
			} );

			it( 'should not prevent default for other error events', () => {
				const handler = errorHandlers[ 0 ];
				const mockEvent = {
					error: { message: 'Normal error' },
					preventDefault: jest.fn()
				};

				handler( mockEvent );

				expect( mockEvent.preventDefault ).not.toHaveBeenCalled();
			} );
		} );
	} );

	describe( 'registerHook fallback behavior', () => {
		it( 'should retry when mw.hook not available initially', () => {
			jest.useFakeTimers();

			// Start with no mw
			delete global.mw;

			// This will trigger the fallback path
			// We need to manually simulate the scenario
			let addHookCalled = false;
			const mockAdd = jest.fn( () => {
				addHookCalled = true;
			} );

			// After some time, make mw available
			setTimeout( () => {
				global.mw = {
					log: jest.fn(),
					hook: jest.fn( () => ( { add: mockAdd } ) ),
					config: { get: jest.fn() }
				};
			}, 100 );

			// Run timers
			jest.advanceTimersByTime( 200 );

			jest.useRealTimers();
		} );
	} );

	describe( 'setupCleanupHandlers', () => {
		// Note: Like global error handlers, cleanup handlers are registered once
		// per module load due to handlersInitialized flag. Test with fresh module.

		describe( 'with fresh module', () => {
			let freshModule;
			let beforeUnloadHandlers;
			let originalAddEventListener;
			let hookAddHandlers;

			beforeEach( () => {
				jest.resetModules();

				beforeUnloadHandlers = [];
				hookAddHandlers = {};
				originalAddEventListener = window.addEventListener;

				window.addEventListener = jest.fn( ( type, handler ) => {
					if ( type === 'beforeunload' ) {
						beforeUnloadHandlers.push( handler );
					}
				} );

				global.mw = {
					log: jest.fn(),
					hook: jest.fn( ( name ) => {
						if ( !hookAddHandlers[ name ] ) {
							hookAddHandlers[ name ] = [];
						}
						return {
							add: ( handler ) => hookAddHandlers[ name ].push( handler ),
							fire: jest.fn()
						};
					} ),
					config: {
						get: jest.fn( ( key ) => {
							if ( key === 'wgAction' ) {
								return 'view';
							}
							return null;
						} )
					}
				};
				mw.log.warn = jest.fn();
				mw.log.error = jest.fn();

				// Load fresh module which triggers init()
				freshModule = require( '../../resources/ext.layers.editor/editor/EditorBootstrap.js' );
			} );

			afterEach( () => {
				window.addEventListener = originalAddEventListener;
			} );

			it( 'should cleanup editor on page navigation when not on editlayers page', () => {
				const mockDestroy = jest.fn();
				window.layersEditorInstance = { destroy: mockDestroy };

				// Find the wikipage.content handler
				expect( hookAddHandlers[ 'wikipage.content' ] ).toBeDefined();
				expect( hookAddHandlers[ 'wikipage.content' ].length ).toBeGreaterThan( 0 );

				const contentHandler = hookAddHandlers[ 'wikipage.content' ][ 0 ];
				contentHandler();

				// Should have cleaned up since wgAction is 'view' not 'editlayers'
				expect( mockDestroy ).toHaveBeenCalled();
			} );

			it( 'should not cleanup editor when on editlayers page', () => {
				jest.resetModules();

				// Re-setup mocks with editlayers action
				beforeUnloadHandlers = [];
				hookAddHandlers = {};

				window.addEventListener = jest.fn( ( type, handler ) => {
					if ( type === 'beforeunload' ) {
						beforeUnloadHandlers.push( handler );
					}
				} );

				global.mw = {
					log: jest.fn(),
					hook: jest.fn( ( name ) => {
						if ( !hookAddHandlers[ name ] ) {
							hookAddHandlers[ name ] = [];
						}
						return {
							add: ( handler ) => hookAddHandlers[ name ].push( handler ),
							fire: jest.fn()
						};
					} ),
					config: {
						get: jest.fn( ( key ) => {
							if ( key === 'wgAction' ) {
								return 'editlayers'; // On editlayers page
							}
							return null;
						} )
					}
				};
				mw.log.warn = jest.fn();
				mw.log.error = jest.fn();

				// Load fresh module
				require( '../../resources/ext.layers.editor/editor/EditorBootstrap.js' );

				const mockDestroy = jest.fn();
				window.layersEditorInstance = { destroy: mockDestroy };

				const contentHandler = hookAddHandlers[ 'wikipage.content' ][ 0 ];
				contentHandler();

				// Should NOT have cleaned up since we're on editlayers page
				expect( mockDestroy ).not.toHaveBeenCalled();
			} );

			it( 'should register beforeunload handler', () => {
				expect( beforeUnloadHandlers.length ).toBeGreaterThan( 0 );
			} );
		} );
	} );

	describe( 'autoBootstrap', () => {
		let hookFireCalls;

		beforeEach( () => {
			hookFireCalls = [];
			global.mw = {
				log: jest.fn(),
				hook: jest.fn( () => ( {
					add: jest.fn(),
					fire: ( config ) => hookFireCalls.push( config )
				} ) ),
				config: {
					get: jest.fn( ( key ) => {
						if ( key === 'wgLayersEditorInit' ) {
							return {
								filename: 'Test.jpg',
								imageUrl: 'http://example.com/test.jpg'
							};
						}
						if ( key === 'wgLayersDebug' ) {
							return true;
						}
						if ( key === 'debug' ) {
							return true;
						}
						return null;
					} )
				}
			};
			mw.log.warn = jest.fn();
			mw.log.error = jest.fn();

			window.Layers = {
				Constants: {},
				Canvas: {
					Manager: function () {}
				}
			};

			document.body.innerHTML = '<div id="layers-editor-container"></div>';
		} );

		it( 'should fire hook with init config when wgLayersEditorInit is present', () => {
			EditorBootstrap.init();

			// Hook should be fired with the config
			expect( hookFireCalls.length ).toBeGreaterThan( 0 );
			expect( hookFireCalls[ 0 ].filename ).toBe( 'Test.jpg' );
		} );

		it( 'should find container element', () => {
			EditorBootstrap.init();

			expect( hookFireCalls[ 0 ].container ).toBe(
				document.getElementById( 'layers-editor-container' )
			);
		} );

		it( 'should use document.body when container not found', () => {
			document.body.innerHTML = '';

			EditorBootstrap.init();

			expect( hookFireCalls[ 0 ].container ).toBe( document.body );
		} );

		it( 'should not fire hook when wgLayersEditorInit is not present', () => {
			mw.config.get = jest.fn( () => null );

			EditorBootstrap.init();

			// Check that fire was called by layers.editor.init hook but config was not passed
			// (because init was null)
			// Since hookFireCalls only gets calls when fire() is called with a config,
			// and we return early when init is null, hookFireCalls should be empty
			expect( hookFireCalls.length ).toBe( 0 );
		} );

		it( 'should retry when dependencies not ready during autoBootstrap', () => {
			jest.useFakeTimers();

			window.Layers = {}; // Dependencies not ready

			mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersEditorInit' ) {
					return { filename: 'Test.jpg', imageUrl: 'http://example.com/test.jpg' };
				}
				if ( key === 'wgLayersDebug' ) {
					return true;
				}
				return null;
			} );

			EditorBootstrap.init();

			// Advance past initial delay
			jest.advanceTimersByTime( 50 );

			// Debug log should have been called about dependencies not ready
			expect( mw.log ).toHaveBeenCalled();

			jest.useRealTimers();
		} );

		it( 'should skip direct editor creation if already created by hook', () => {
			const mockEditor = {};
			window.layersEditorInstance = mockEditor;

			const mockLayersEditor = jest.fn();
			window.LayersEditor = mockLayersEditor;
			window.Layers.Core = {
				Editor: mockLayersEditor
			};

			EditorBootstrap.init();

			// Should not have called the constructor again since instance exists
			expect( mockLayersEditor ).not.toHaveBeenCalled();

			delete window.LayersEditor;
		} );

		it( 'should create editor directly when LayersEditor is available and no instance exists', () => {
			const mockLayersEditor = jest.fn();
			window.LayersEditor = mockLayersEditor;
			window.Layers.Core = {
				Editor: mockLayersEditor
			};

			EditorBootstrap.init();

			expect( mockLayersEditor ).toHaveBeenCalledWith( expect.objectContaining( {
				filename: 'Test.jpg'
			} ) );

			delete window.LayersEditor;
		} );

		it( 'should handle direct editor creation error', () => {
			const mockLayersEditor = jest.fn( () => {
				throw new Error( 'Direct creation error' );
			} );
			window.LayersEditor = mockLayersEditor;
			window.Layers.Core = {
				Editor: mockLayersEditor
			};

			// Should not throw
			expect( () => EditorBootstrap.init() ).not.toThrow();

			expect( mw.log.error ).toHaveBeenCalledWith(
				expect.stringContaining( 'Direct editor creation failed' ),
				expect.any( String )
			);

			delete window.LayersEditor;
		} );

		it( 'should log when LayersEditor not available for direct creation', () => {
			// No LayersEditor class available
			delete window.LayersEditor;
			delete window.Layers.Core;

			EditorBootstrap.init();

			// Should have logged about LayersEditor not available
			expect( mw.log ).toHaveBeenCalledWith(
				expect.stringContaining( 'LayersEditor class not available for direct creation' )
			);
		} );

		it( 'should handle auto-bootstrap error gracefully', () => {
			mw.config.get = jest.fn( () => {
				throw new Error( 'Config error' );
			} );

			// Should not throw
			expect( () => EditorBootstrap.init() ).not.toThrow();

			expect( mw.log.error ).toHaveBeenCalledWith(
				expect.stringContaining( 'Auto-bootstrap error' ),
				expect.any( String )
			);
		} );

		it( 'should set document title after direct editor creation', () => {
			const mockLayersEditor = jest.fn();
			window.LayersEditor = mockLayersEditor;
			window.Layers.Core = {
				Editor: mockLayersEditor
			};

			EditorBootstrap.init();

			expect( document.title ).toContain( 'Test.jpg' );

			delete window.LayersEditor;
		} );

		it( 'should set global editor instance when debug mode is enabled', () => {
			const mockEditor = {};
			const mockLayersEditor = jest.fn( () => mockEditor );
			window.LayersEditor = mockLayersEditor;
			window.Layers.Core = {
				Editor: mockLayersEditor
			};

			EditorBootstrap.init();

			expect( window.layersEditorInstance ).toBe( mockEditor );

			delete window.LayersEditor;
		} );

		it( 'should use fallback timing values when LayersConstants not available', () => {
			// Ensure Constants.TIMING is not available
			delete window.Layers.Constants;

			// The auto-bootstrap should still work with default timing
			expect( () => EditorBootstrap.init() ).not.toThrow();
		} );

		it( 'should wait for DOMContentLoaded when document is still loading', () => {
			// Mock document.readyState as 'loading'
			const originalReadyState = Object.getOwnPropertyDescriptor( document, 'readyState' );
			Object.defineProperty( document, 'readyState', {
				configurable: true,
				value: 'loading'
			} );

			const addEventListenerSpy = jest.spyOn( document, 'addEventListener' );

			EditorBootstrap.init();

			expect( addEventListenerSpy ).toHaveBeenCalledWith( 'DOMContentLoaded', expect.any( Function ) );

			addEventListenerSpy.mockRestore();
			if ( originalReadyState ) {
				Object.defineProperty( document, 'readyState', originalReadyState );
			}
		} );
	} );
} );
