/**
 * EditorBootstrap - Handles Layers Editor initialization and lifecycle
 *
 * Extracted from LayersEditor.js for better separation of concerns.
 * Manages dependency validation, hook registration, auto-bootstrap,
 * global error handling, and cleanup on page navigation.
 *
 * @module EditorBootstrap
 */
( function () {
	'use strict';

	// Use shared namespace helper
	const getClass = ( window.Layers && window.Layers.Utils && window.Layers.Utils.getClass ) ||
		window.layersGetClass ||
		function ( namespacePath, globalName ) {
			return window[ globalName ] || null;
		};

	/**
	 * Get timing constants from LayersConstants or use defaults
	 *
	 * @return {Object} Timing configuration
	 */
	function getTiming() {
		if ( window.Layers && window.Layers.Constants && window.Layers.Constants.TIMING ) {
			return window.Layers.Constants.TIMING;
		}
		return {
			BOOTSTRAP_RETRY_DELAY: 50,
			HOOK_LISTENER_DELAY: 50,
			DEPENDENCY_WAIT_DELAY: 100
		};
	}

	/**
	 * Required classes for editor initialization, mapped to their namespace paths
	 * @type {Object.<string, string>}
	 */
	const REQUIRED_CLASSES = {
		UIManager: 'UI.Manager',
		EventManager: 'Core.EventManager',
		APIManager: 'Core.APIManager',
		ValidationManager: 'Validation.Manager',
		StateManager: 'Core.StateManager',
		HistoryManager: 'Core.HistoryManager',
		CanvasManager: 'Canvas.Manager',
		Toolbar: 'UI.Toolbar',
		LayerPanel: 'UI.LayerPanel'
	};

	/**
	 * Required constant groups in LayersConstants
	 * @type {string[]}
	 */
	const REQUIRED_CONSTANT_GROUPS = [ 'TOOLS', 'LAYER_TYPES', 'DEFAULTS', 'UI', 'LIMITS' ];

	/**
	 * Maximum retry attempts for dependency loading
	 * @type {number}
	 */
	const MAX_DEPENDENCY_RETRIES = 20;

	/**
	 * Maximum retry attempts for mw.hook availability
	 * @type {number}
	 */
	const MAX_MW_HOOK_RETRIES = 40;

	/**
	 * Validate that required dependencies are loaded before editor initialization.
	 * Logs warning if a critical dependency is missing but allows initialization to continue.
	 *
	 * @return {boolean} True if all dependencies are present, false otherwise
	 */
	function validateDependencies() {
		const missing = [];

		// Check required classes via namespace paths
		Object.entries( REQUIRED_CLASSES ).forEach( ( [ name, path ] ) => {
			const cls = getClass( path, name );
			if ( typeof cls !== 'function' ) {
				missing.push( name );
			}
		} );

		// Check LayersConstants (critical for configuration) via namespace
		const LayersConstants = window.Layers && window.Layers.Constants;
		if ( !LayersConstants ) {
			missing.push( 'LayersConstants' );
		} else {
			// Validate critical constant groups exist
			REQUIRED_CONSTANT_GROUPS.forEach( ( group ) => {
				if ( !LayersConstants[ group ] ) {
					missing.push( 'LayersConstants.' + group );
				}
			} );
		}

		if ( missing.length > 0 ) {
			const errorMsg = 'Layers Editor: Missing dependencies: ' + missing.join( ', ' ) +
				'. Some features may not work correctly. Check ResourceLoader module order in extension.json.';
			if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( errorMsg );
			}
			return false;
		}
		return true;
	}

	/**
	 * Quick check if critical dependencies are available for editor initialization.
	 * @return {boolean} True if LayersConstants and CanvasManager are available
	 */
	function areEditorDependenciesReady() {
		return window.Layers && window.Layers.Constants &&
			window.Layers.Canvas &&
			typeof window.Layers.Canvas.Manager === 'function';
	}

	/**
	 * Global error message sanitizer for preventing information disclosure
	 * @param {Error|string|*} error Error object or message to sanitize
	 * @return {string} Sanitized error message
	 */
	function sanitizeGlobalErrorMessage( error ) {
		let message = 'An error occurred';

		try {
			if ( error && typeof error.message === 'string' ) {
				message = error.message;
			} else if ( typeof error === 'string' ) {
				message = error;
			} else if ( error && error.toString ) {
				message = error.toString();
			}

			// Apply sanitization
			if ( typeof message !== 'string' ) {
				return 'Non-string error encountered';
			}

			// Remove any token-like patterns (base64, hex, etc.)
			message = message.replace( /[a-zA-Z0-9+/=]{20,}/g, '[TOKEN]' );
			message = message.replace( /[a-fA-F0-9]{16,}/g, '[HEX]' );

			// Remove file paths completely
			message = message.replace( /[A-Za-z]:[\\/][\w\s\\.-]*/g, '[PATH]' );
			message = message.replace( /\/[\w\s.-]+/g, '[PATH]' );

			// Remove URLs and connection strings
			message = message.replace( /https?:\/\/[^\s'"<>&]*/gi, '[URL]' );
			message = message.replace( /\w+:\/\/[^\s'"<>&]*/gi, '[CONNECTION]' );

			// Remove IP addresses and ports
			message = message.replace( /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]' );

			// Remove email addresses
			message = message.replace( /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]' );

			// Limit length to prevent log flooding
			if ( message.length > 200 ) {
				message = message.slice( 0, 200 ) + '[TRUNCATED]';
			}

			return message;
		} catch ( sanitizeError ) {
			return 'Error sanitization failed';
		}
	}

	/**
	 * Create the editor hook listener
	 * @return {Function} Hook listener function
	 */
	function createHookListener() {
		let hookDependencyRetries = 0;

		const hookListener = function ( config ) {
			// Prevent double instantiation if editor already exists
			if ( window.layersEditorInstance ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log( '[EditorBootstrap] Editor already exists, skipping creation' );
				}
				return;
			}

			// Verify dependencies before creating editor
			if ( !areEditorDependenciesReady() ) {
				hookDependencyRetries++;
				if ( hookDependencyRetries < MAX_DEPENDENCY_RETRIES ) {
					if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
						mw.log.warn( '[EditorBootstrap] Hook fired but dependencies not ready (attempt ' +
							hookDependencyRetries + '/' + MAX_DEPENDENCY_RETRIES + '), deferring...' );
					}
					// Defer and retry
					setTimeout( function () {
						hookListener( config );
					}, 100 );
					return;
				}
				// Max retries reached - proceed anyway and let validateDependencies handle it
				if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
					mw.log.error( '[EditorBootstrap] Max dependency retries reached, proceeding with available dependencies' );
				}
			}

			document.title = '🎨 Layers Editor Initializing...';
			try {
				// Check for LayersEditor class via namespace
				const LayersEditor = getClass( 'Core.Editor', 'LayersEditor' );
				if ( typeof LayersEditor !== 'function' ) {
					throw new Error( 'LayersEditor class not available' );
				}

				const editor = new LayersEditor( config );
				document.title = '🎨 Layers Editor - ' + ( config.filename || 'Unknown File' );
				// Always set the global instance for duplicate prevention
				window.layersEditorInstance = editor;
			} catch ( e ) {
				const sanitizedError = sanitizeGlobalErrorMessage( e );
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[EditorBootstrap] Error creating LayersEditor:', sanitizedError );
				}
				throw e;
			}
		};

		return hookListener;
	}

	/**
	 * Register the editor initialization hook
	 */
	function registerHook() {
		const hookListener = createHookListener();

		if ( typeof mw !== 'undefined' && mw.hook ) {
			if ( mw && mw.log ) {
				mw.log( '[EditorBootstrap] Registering hook listener' );
			}
			mw.hook( 'layers.editor.init' ).add( hookListener );
		} else {
			// Fallback: try to add hook listener when mw becomes available
			let mwHookRetries = 0;
			const timing = getTiming();
			const addHookListener = function () {
				if ( typeof mw !== 'undefined' && mw.hook ) {
					mw.hook( 'layers.editor.init' ).add( hookListener );
				} else {
					mwHookRetries++;
					if ( mwHookRetries < MAX_MW_HOOK_RETRIES ) {
						setTimeout( addHookListener, timing.HOOK_LISTENER_DELAY );
					}
				}
			};
			addHookListener();
		}

		// Store reference for auto-bootstrap
		window._layersHookListener = hookListener;
	}

	/**
	 * Track if handlers have been set up (prevent duplicates on module reload)
	 */
	let handlersInitialized = false;

	/**
	 * Set up global error handlers for unhandled promise rejections
	 */
	function setupGlobalErrorHandlers() {
		if ( handlersInitialized ) {
			return; // Already set up
		}
		if ( typeof window !== 'undefined' && window.addEventListener ) {
			window.addEventListener( 'unhandledrejection', ( event ) => {
				const error = event.reason;
				if ( error && typeof error.message === 'string' &&
					error.message.includes( 'message channel closed' ) ) {
					// This is likely a browser extension or third-party script issue
					if ( mw && mw.log ) {
						mw.log.warn( '[Layers] Suppressed message channel error (likely browser extension):', error );
					}
					event.preventDefault();
				} else if ( mw && mw.log ) {
					mw.log.error( '[Layers] Unhandled promise rejection:', error );
				}
			} );

			window.addEventListener( 'error', ( event ) => {
				if ( event.error && typeof event.error.message === 'string' &&
					event.error.message.includes( 'message channel closed' ) ) {
					if ( mw && mw.log ) {
						mw.log.warn( '[Layers] Suppressed message channel error (likely browser extension):', event.error );
					}
					event.preventDefault();
				}
			} );
		}
	}

	/**
	 * Clean up global editor instance
	 */
	function cleanupGlobalEditorInstance() {
		if ( window.layersEditorInstance && typeof window.layersEditorInstance.destroy === 'function' ) {
			window.layersEditorInstance.destroy();
			window.layersEditorInstance = null;
		}
	}

	/**
	 * Set up cleanup handlers for page navigation
	 */
	function setupCleanupHandlers() {
		if ( handlersInitialized ) {
			return; // Already set up
		}
		if ( typeof window !== 'undefined' ) {
			window.addEventListener( 'beforeunload', cleanupGlobalEditorInstance );

			// MediaWiki page navigation cleanup
			if ( typeof mw !== 'undefined' && mw.hook ) {
				mw.hook( 'wikipage.content' ).add( function () {
					// Only cleanup if we're not on a layers editor page
					const isEditLayersPage = mw.config.get( 'wgAction' ) === 'editlayers';
					if ( !isEditLayersPage ) {
						cleanupGlobalEditorInstance();
					}
				} );
			}
		}
		handlersInitialized = true;
	}

	/**
	 * Auto-bootstrap if server provided config via wgLayersEditorInit
	 */
	function autoBootstrap() {
		let dependencyRetries = 0;
		const timing = getTiming();

		function tryBootstrap() {
			try {
				const debug = window.mw && mw.config && mw.config.get( 'wgLayersDebug' );

				const debugLog = function ( msg ) {
					if ( debug && mw.log ) {
						mw.log( '[EditorBootstrap] ' + msg );
					}
				};

				// Check if MediaWiki is available
				if ( !window.mw || !mw.config || !mw.config.get ) {
					debugLog( 'MediaWiki not ready, retrying...' );
					setTimeout( tryBootstrap, timing.DEPENDENCY_WAIT_DELAY );
					return;
				}

				// Try to get config from MediaWiki config vars
				const init = mw.config.get( 'wgLayersEditorInit' );
				debugLog( 'wgLayersEditorInit config: ' + ( init ? 'present' : 'not found' ) );

				if ( !init ) {
					return;
				}

				// Check if dependencies are ready before proceeding
				if ( !areEditorDependenciesReady() ) {
					dependencyRetries++;
					if ( dependencyRetries < MAX_DEPENDENCY_RETRIES ) {
						debugLog( 'Dependencies not ready (attempt ' + dependencyRetries + '/' +
							MAX_DEPENDENCY_RETRIES + '), retrying...' );
						setTimeout( tryBootstrap, timing.BOOTSTRAP_RETRY_DELAY );
						return;
					}
					debugLog( 'Max dependency retries reached, proceeding with available dependencies' );
				}

				const container = document.getElementById( 'layers-editor-container' );
				debugLog( 'Container element exists: ' + !!container );

				// Fire the hook for initialization
				mw.hook( 'layers.editor.init' ).fire( {
					filename: init.filename,
					imageUrl: init.imageUrl,
					initialSetName: init.initialSetName || null,
					autoCreate: init.autoCreate || false,
					container: container || document.body,
					// Slide-specific properties
					isSlide: init.isSlide || false,
					slideName: init.slideName || null,
					canvasWidth: init.canvasWidth || null,
					canvasHeight: init.canvasHeight || null,
					backgroundColor: init.backgroundColor || null,
					lockMode: init.lockMode || 'none'
				} );

				debugLog( 'Hook fired for: ' + init.filename +
					( init.initialSetName ? ' (initial set: ' + init.initialSetName + ')' : '' ) +
					( init.autoCreate ? ' (autoCreate enabled)' : '' ) );

				try {
					// Check if editor already exists (created by hook listener)
					if ( window.layersEditorInstance ) {
						debugLog( 'Editor already exists from hook listener' );
						return;
					}

					const LayersEditor = getClass( 'Core.Editor', 'LayersEditor' );
					if ( typeof LayersEditor !== 'function' ) {
						debugLog( 'LayersEditor class not available for direct creation' );
						return;
					}

					const editor = new LayersEditor( {
						filename: init.filename,
						imageUrl: init.imageUrl,
						initialSetName: init.initialSetName || null,
						autoCreate: init.autoCreate || false,
						container: container || document.body,
						// Slide-specific properties
						isSlide: init.isSlide || false,
						slideName: init.slideName || null,
						canvasWidth: init.canvasWidth || null,
						canvasHeight: init.canvasHeight || null,
						backgroundColor: init.backgroundColor || null,
						lockMode: init.lockMode || 'none'
					} );
					debugLog( 'Direct editor creation successful' );

					document.title = '🎨 Layers Editor - ' + ( init.filename || 'Unknown File' );
					if ( window.mw && window.mw.config.get( 'debug' ) ) {
						window.layersEditorInstance = editor;
					}
				} catch ( directError ) {
					if ( mw.log && mw.log.error ) {
						mw.log.error( '[EditorBootstrap] Direct editor creation failed:',
							sanitizeGlobalErrorMessage( directError ) );
					}
				}
			} catch ( e ) {
				if ( mw.log && mw.log.error ) {
					mw.log.error( '[EditorBootstrap] Auto-bootstrap error:', sanitizeGlobalErrorMessage( e ) );
				}
			}
		}

		// Try bootstrapping immediately, or when DOM is ready
		if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', tryBootstrap );
		} else {
			tryBootstrap();
		}
	}

	/**
	 * Initialize the editor bootstrap system
	 */
	function init() {
		registerHook();
		setupGlobalErrorHandlers();
		setupCleanupHandlers();
		autoBootstrap();
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.EditorBootstrap = {
			validateDependencies,
			areEditorDependenciesReady,
			sanitizeGlobalErrorMessage,
			cleanupGlobalEditorInstance,
			init
		};
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = {
			validateDependencies,
			areEditorDependenciesReady,
			sanitizeGlobalErrorMessage,
			cleanupGlobalEditorInstance,
			init
		};
	}

	// Auto-initialize
	init();

}() );
