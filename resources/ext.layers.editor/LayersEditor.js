/**
 * Main Layers Editor Controller
 * Manages the overall editing interface and coordinates between components
 */
( function () {
	'use strict';

	/**
	 * LayersEditor main class
	 *
	 * @class
	 * @param {Object} config Configuration object
	 * @param {string} config.filename The name of the file being edited.
	 * @param {string} config.imageUrl The direct URL to the image being edited.
	 */
	function LayersEditor( config ) {
		this.config = config || {};
		this.filename = this.config.filename;
		this.containerElement = this.config.container; // Optional legacy container
		this.canvasManager = null;
		this.layerPanel = null;
		this.toolbar = null;
		this.layers = [];
		this.allLayerSets = [];
		this.currentLayerSetId = null;
		this.currentTool = 'pointer';
		this.isDirty = false;
		// Debug mode - only enable console logging when explicitly set
		this.debug = this.config.debug || false;

		this.init();
	}

	/**
	 * Debug logging utility that only logs when debug mode is enabled
	 * Sanitizes messages to prevent information disclosure
	 *
	 * @param {...*} args Arguments to log
	 */
	LayersEditor.prototype.debugLog = function () {
		if ( this.debug ) {
			// Sanitize arguments to prevent sensitive data exposure
			var sanitizedArgs = Array.prototype.slice.call( arguments ).map( function ( arg ) {
				return LayersEditor.prototype.sanitizeLogMessage( arg );
			} );

			// Using MediaWiki's logging system for consistent debug output
			if ( mw.log ) {
				mw.log.apply( mw, sanitizedArgs );
			}
		}
	};

	/**
	 * Error logging utility with message sanitization
	 * Ensures no sensitive information is exposed in console logs
	 *
	 * @param {...*} args Arguments to log
	 */
	LayersEditor.prototype.errorLog = function () {
		// Sanitize error messages before logging
		var sanitizedArgs = Array.prototype.slice.call( arguments ).map( function ( arg ) {
			return LayersEditor.prototype.sanitizeLogMessage( arg );
		} );

		// Always log errors using MediaWiki's error handling
		if ( mw.log ) {
			mw.log.error.apply( mw.log, sanitizedArgs );
		}
	};

	/**
	 * Sanitize log messages to prevent sensitive information disclosure
	 * Uses a whitelist approach for better security
	 *
	 * @param {*} message The message to sanitize
	 * @return {*} Sanitized message
	 */
	LayersEditor.prototype.sanitizeLogMessage = function ( message ) {
		// Don't modify non-string values
		if ( typeof message !== 'string' ) {
			// For objects, use a whitelist approach for safety
			if ( typeof message === 'object' && message !== null ) {
				var safeKeys = [ 'type', 'action', 'status', 'tool', 'layer', 'count', 'x', 'y', 'width', 'height' ];
				var obj = {};
				for ( var key in message ) {
					if ( Object.prototype.hasOwnProperty.call( message, key ) ) {
						if ( safeKeys.indexOf( key ) !== -1 ) {
							obj[ key ] = message[ key ];
						} else {
							obj[ key ] = '[FILTERED]';
						}
					}
				}
				return obj;
			}
			return message;
		}

		// For strings, apply comprehensive sanitization
		var result = String( message );

		// Remove any token-like patterns (base64, hex, etc.)
		result = result.replace( /[a-zA-Z0-9+/=]{20,}/g, '[TOKEN]' );
		result = result.replace( /[a-fA-F0-9]{16,}/g, '[HEX]' );

		// Remove file paths completely
		result = result.replace( /[A-Za-z]:[\\/]][\w\s\\.-]*/g, '[PATH]' );
		result = result.replace( /\/[\w\s.-]+/g, '[PATH]' );

		// Remove URLs and connection strings
		result = result.replace( /https?:\/\/[^\s'"<>&]*/gi, '[URL]' );
		result = result.replace( /\w+:\/\/[^\s'"<>&]*/gi, '[CONNECTION]' );

		// Remove IP addresses and ports
		result = result.replace( /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]' );

		// Remove email addresses
		result = result.replace( /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]' );

		// Limit length to prevent log flooding
		if ( result.length > 200 ) {
			result = result.slice( 0, 200 ) + '[TRUNCATED]';
		}

		return result;
	};

	LayersEditor.prototype.init = function () {
		// Add immediate visual feedback
		document.title = '🔄 Layers Editor Loading...';

		// Check browser compatibility first
		if ( !this.checkBrowserCompatibility() ) {
			this.showBrowserCompatibilityWarning();
			return;
		}

		// Create the main editor interface
		this.createInterface();

		// Initialize undo/redo system
		this.undoStack = [];
		this.redoStack = [];
		this.maxUndoSteps = 50;

		// Wait for all dependencies to be available, then initialize components
		this.waitForDependencies();
	};

	/**
	 * Check if the browser supports required features
	 *
	 * @return {boolean} True if browser is compatible
	 */
	LayersEditor.prototype.checkBrowserCompatibility = function () {
		// Check for essential APIs
		var requiredFeatures = [
			'HTMLCanvasElement' in window,
			'JSON' in window,
			'addEventListener' in document,
			'querySelector' in document,
			'FileReader' in window,
			'Blob' in window
		];

		// Check for Canvas 2D context support
		if ( window.HTMLCanvasElement ) {
			try {
				var testCanvas = document.createElement( 'canvas' );
				var ctx = testCanvas.getContext( '2d' );
				requiredFeatures.push( !!ctx );
			} catch ( e ) {
				requiredFeatures.push( false );
			}
		}

		// Check if all required features are available
		return requiredFeatures.every( function ( feature ) {
			return feature === true;
		} );
	};

	/**
	 * Show browser compatibility warning
	 */
	LayersEditor.prototype.showBrowserCompatibilityWarning = function () {
		var message = mw.message ?
			mw.message( 'layers-browser-compatibility' ).text() :
			'Your browser may not support all layer features';

		if ( window.mw && window.mw.notify ) {
			mw.notify( message, { type: 'warn', autoHide: false } );
		} else {
			// Fallback notification for very old browsers
			// eslint-disable-next-line no-alert
			alert( message );
		}

		// Try to show a basic interface anyway
		this.createBasicInterface();
	};

	/**
	 * Create a basic interface for unsupported browsers
	 */
	LayersEditor.prototype.createBasicInterface = function () {
		this.container = document.createElement( 'div' );
		this.container.className = 'layers-editor layers-editor-basic';

		var wrap = document.createElement( 'div' );
		wrap.className = 'layers-unsupported';

		var h3 = document.createElement( 'h3' );
		h3.textContent = 'Browser Not Fully Supported';
		wrap.appendChild( h3 );

		var p1 = document.createElement( 'p' );
		p1.textContent = 'The Layers editor requires a modern browser with Canvas support.';
		wrap.appendChild( p1 );

		var p2 = document.createElement( 'p' );
		p2.textContent = 'Please consider upgrading your browser for the full experience.';
		wrap.appendChild( p2 );

		var closeBtn = document.createElement( 'button' );
		closeBtn.type = 'button';
		closeBtn.textContent = 'Close';
		closeBtn.addEventListener( 'click', function () {
			if ( wrap && wrap.parentNode ) {
				wrap.parentNode.style.display = 'none';
			}
		} );
		wrap.appendChild( closeBtn );

		this.container.appendChild( wrap );
		document.body.appendChild( this.container );
	};

	LayersEditor.prototype.waitForDependencies = function () {
		var self = this;
		var maxAttempts = 50; // Wait up to 5 seconds
		var attempt = 0;

		function checkDependencies() {
			attempt++;

			// Log what we have available for debugging
			if ( window.mw && window.mw.log ) {
				mw.log( 'Layers: Dependency check attempt ' + attempt );
				mw.log( 'Layers: CanvasManager available:', !!window.CanvasManager );
				mw.log( 'Layers: LayerPanel available:', !!window.LayerPanel );
				mw.log( 'Layers: Toolbar available:', !!window.Toolbar );
			}

			if ( window.CanvasManager && window.LayerPanel && window.Toolbar ) {
				// Use MediaWiki logging if available
				if ( window.mw && window.mw.log ) {
					mw.log( 'Layers: All dependencies loaded, initializing components' );
				}
				self.initializeComponents();
			} else if ( attempt < maxAttempts ) {
				setTimeout( checkDependencies, 100 );
			} else {
				var missing = [];
				if ( !window.CanvasManager ) {
					missing.push( 'CanvasManager' );
				}
				if ( !window.LayerPanel ) {
					missing.push( 'LayerPanel' );
				}
				if ( !window.Toolbar ) {
					missing.push( 'Toolbar' );
				}
				if ( window.mw && window.mw.log ) {
					mw.log.error( 'Layers: Missing dependencies after 5 seconds: ' + missing.join( ', ' ) );
				}
				// Do not initialize if core dependencies failed to load
				self.showError( ( mw.message ? mw.message( 'layers-error-init' ).text() : 'Failed to initialize Layers editor' ) + ' (' + missing.join( ', ' ) + ')' );
			}
		}

		checkDependencies();
	};

	LayersEditor.prototype.initializeComponents = function () {
		// Initialize components
		try {
			if ( window.mw && window.mw.log ) {
				mw.log( 'Layers: Initializing components...' );
				mw.log( 'Layers: Canvas container:', this.$canvasContainer.get( 0 ) );
				mw.log( 'Layers: Layer panel container:', this.$layerPanel.get( 0 ) );
				mw.log( 'Layers: Toolbar container:', this.$toolbar.get( 0 ) );
			}

			// Check for required dependencies
			if ( !window.CanvasManager ) {
				throw new Error( 'CanvasManager not available' );
			}
			if ( !window.LayerPanel ) {
				throw new Error( 'LayerPanel not available' );
			}
			if ( !window.Toolbar ) {
				throw new Error( 'Toolbar not available' );
			}

			// Get the parent image URL
			var parentImageUrl = this.getParentImageUrl();
			if ( window.mw && window.mw.log ) {
				mw.log( 'Layers: Parent image URL:', parentImageUrl );
			}

			this.canvasManager = new window.CanvasManager( {
				container: this.$canvasContainer.get( 0 ),
				editor: this,
				backgroundImageUrl: parentImageUrl
			} );

			this.layerPanel = new window.LayerPanel( {
				container: this.$layerPanel.get( 0 ),
				editor: this,
				inspectorContainer: this.inspectorContainer
			} );

			this.toolbar = new window.Toolbar( {
				container: this.$toolbar.get( 0 ),
				editor: this
			} );

			if ( window.mw && window.mw.log ) {
				mw.log( 'Layers: Editor components initialized successfully' );
				mw.log( 'Layers: CanvasManager:', this.canvasManager );
				mw.log( 'Layers: LayerPanel:', this.layerPanel );
				mw.log( 'Layers: Toolbar:', this.toolbar );
			}
		} catch ( error ) {
			if ( window.mw && window.mw.log ) {
				mw.log.error( 'Layers: Error initializing editor components:', error );
			}
			this.showError( 'Failed to initialize editor: ' + error.message );
			return;
		}

		// Load existing layers if any
		this.loadLayers();

		// Set up event handlers
		this.setupEventHandlers();

		// Seed status bar with initial values
		if ( typeof this.updateStatus === 'function' ) {
			this.updateStatus( {
				tool: this.currentTool || 'pointer',
				zoomPercent: 100,
				pos: { x: 0, y: 0 },
				selectionCount: 0
			} );
		}

		if ( window.mw && window.mw.log ) {
			mw.log( 'Layers: Editor fully initialized for file:', this.filename );
		}
	};

	LayersEditor.prototype.createInterface = function () {
		// Always create a full-screen overlay container at body level
		this.container = document.createElement( 'div' );
		this.container.className = 'layers-editor';
		this.container.setAttribute( 'role', 'application' );
		this.container.setAttribute( 'aria-label', 'Layers Image Editor' );
		document.body.appendChild( this.container );

		// Add body class to hide skin chrome while editor is open
		document.body.classList.add( 'layers-editor-open' );

		// Header
		var header = document.createElement( 'div' );
		header.className = 'layers-header';
		header.setAttribute( 'role', 'banner' );
		var title = document.createElement( 'div' );
		title.className = 'layers-header-title';
		title.setAttribute( 'role', 'heading' );
		title.setAttribute( 'aria-level', '1' );
		title.textContent = ( mw.message ? mw.message( 'layers-editor-title' ).text() : ( mw.msg ? mw.msg( 'layers-editor-title' ) : 'Layers Editor' ) ) +
			( this.filename ? ' — ' + this.filename : '' );
		header.appendChild( title );
		var headerRight = document.createElement( 'div' );
		headerRight.className = 'layers-header-right';
		// Zoom readout mirrors toolbar
		var zoomReadout = document.createElement( 'span' );
		zoomReadout.className = 'layers-zoom-readout';
		zoomReadout.setAttribute( 'aria-label', 'Current zoom level' );
		zoomReadout.textContent = '100%';
		headerRight.appendChild( zoomReadout );

		// Revision selector container
		var revWrap = document.createElement( 'div' );
		revWrap.className = 'layers-revision-wrap';
		var revLabel = document.createElement( 'label' );
		revLabel.className = 'layers-revision-label';
		revLabel.textContent = ( mw.message ? mw.message( 'layers-revision-label' ).text() : 'Revision' ) + ':';
		revWrap.appendChild( revLabel );
		var revSelect = document.createElement( 'select' );
		revSelect.className = 'layers-revision-select';
		revSelect.setAttribute( 'aria-label', 'Select revision to load' );
		revLabel.setAttribute( 'for', 'layers-revision-select-' + Math.random().toString( 36 ).slice( 2, 11 ) );
		revSelect.id = revLabel.getAttribute( 'for' );
		revWrap.appendChild( revSelect );

		// Optional revision name input used on next save
		var revName = document.createElement( 'input' );
		revName.type = 'text';
		revName.className = 'layers-revision-name';
		revName.placeholder = ( mw.message ? mw.message( 'layers-revision-name-placeholder' ).text() : 'Revision name (optional)' );
		revName.setAttribute( 'aria-label', 'Revision name for next save (optional)' );
		revName.maxLength = 255;
		revWrap.appendChild( revName );
		var revLoadBtn = document.createElement( 'button' );
		revLoadBtn.type = 'button';
		revLoadBtn.className = 'layers-revision-load';
		revLoadBtn.textContent = ( mw.message ? mw.message( 'layers-revision-load' ).text() : 'Load' );
		revLoadBtn.setAttribute( 'aria-label', 'Load selected revision' );
		revWrap.appendChild( revLoadBtn );
		headerRight.appendChild( revWrap );

		// Close button (returns to File: page)
		var closeBtn = document.createElement( 'button' );
		closeBtn.className = 'layers-header-close';
		closeBtn.type = 'button';
		closeBtn.setAttribute( 'aria-label', ( mw.message ? mw.message( 'layers-editor-close' ).text() : 'Close' ) );
		closeBtn.title = ( mw.message ? mw.message( 'layers-editor-close' ).text() : 'Close' );
		closeBtn.innerHTML = '&times;';
		headerRight.appendChild( closeBtn );
		header.appendChild( headerRight );
		this.container.appendChild( header );

		// Create toolbar
		this.toolbarContainer = document.createElement( 'div' );
		this.toolbarContainer.className = 'layers-toolbar';
		this.container.appendChild( this.toolbarContainer );

		// Create main content area (column layout)
		this.content = document.createElement( 'div' );
		this.content.className = 'layers-content';
		this.container.appendChild( this.content );

		// Main row holds sidebar and canvas
		var mainRow = document.createElement( 'div' );
		mainRow.className = 'layers-main';
		this.content.appendChild( mainRow );

		// Create layer panel (sidebar)
		this.layerPanelContainer = document.createElement( 'div' );
		this.layerPanelContainer.className = 'layers-panel';
		mainRow.appendChild( this.layerPanelContainer );

		// Create canvas container (stage)
		this.canvasContainer = document.createElement( 'div' );
		this.canvasContainer.className = 'layers-canvas-container';
		mainRow.appendChild( this.canvasContainer );

		// No separate bottom inspector; properties are shown under the Layers panel

		// Status bar at the very bottom (with right-aligned Wikitext code slot)
		this.statusBar = document.createElement( 'div' );
		this.statusBar.className = 'layers-statusbar';
		this.statusBar.innerHTML = '' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-tool' ).text() : 'Tool' ) + ':</span> <span class="status-value" data-status="tool">pointer</span></span>' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-zoom' ).text() : 'Zoom' ) + ':</span> <span class="status-value" data-status="zoom">100%</span></span>' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-pos' ).text() : 'Pos' ) + ':</span> <span class="status-value" data-status="pos">0,0</span></span>' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-size' ).text() : 'Size' ) + ':</span> <span class="status-value" data-status="size">-</span></span>' +
			'<span class="status-item"><span class="status-label">' + ( mw.message ? mw.message( 'layers-status-selection' ).text() : 'Selection' ) + ':</span> <span class="status-value" data-status="selection">0</span></span>' +
			'<span class="status-spacer"></span>' +
			'<span class="status-code" aria-label="' + ( mw.message ? mw.message( 'layers-code-title' ).text() : 'Wikitext Code' ) + '">' +
				'<code class="status-code-text" title="' + ( mw.message ? mw.message( 'layers-code-title' ).text() : 'Wikitext Code' ) + '"></code>' +
				'<button class="status-copy-btn" type="button">' + ( mw.message ? mw.message( 'layers-code-copy' ).text() : 'Copy' ) + '</button>' +
			'</span>';
		this.container.appendChild( this.statusBar );

		// Create jQuery-style references for compatibility
		this.$canvasContainer = $( this.canvasContainer );
		this.$layerPanel = $( this.layerPanelContainer );
		this.$toolbar = $( this.toolbarContainer );

		// Bridge toolbar zoom display to header readout
		var self = this;
		Object.defineProperty( this, 'zoomReadoutEl', { value: zoomReadout } );
		// Toolbar will update zoom; also update from CanvasManager hook
		this.updateZoomReadout = function ( percent ) {
			self.zoomReadoutEl.textContent = percent + '%';
		};

		// Wire revision selector
		Object.defineProperty( this, 'revSelectEl', { value: revSelect } );
		Object.defineProperty( this, 'revLoadBtnEl', { value: revLoadBtn } );
		Object.defineProperty( this, 'revNameInputEl', { value: revName } );
		revLoadBtn.addEventListener( 'click', function () {
			var val = 0;
			if ( self.revSelectEl && self.revSelectEl.value ) {
				val = parseInt( self.revSelectEl.value, 10 );
			}
			if ( val ) {
				self.loadRevisionById( val );
			}
		} );

		// Disable Load button if currently selected revision is already loaded
		revSelect.addEventListener( 'change', function () {
			var v = parseInt( this.value, 10 ) || 0;
			if ( self.revLoadBtnEl ) {
				var isCurrent = ( self.currentLayerSetId && v === self.currentLayerSetId );
				self.revLoadBtnEl.disabled = !v || isCurrent;
			}
		} );

		// Expose simple status update helpers used by CanvasManager
		this.updateStatus = function ( fields ) {
			if ( !fields ) {
				return;
			}
			var root = self.statusBar;
			if ( !root ) {
				return;
			}
			if ( fields.tool !== null && fields.tool !== undefined ) {
				var elTool = root.querySelector( '[data-status="tool"]' );
				if ( elTool ) {
					elTool.textContent = String( fields.tool );
				}
			}
			if ( fields.zoomPercent !== null && fields.zoomPercent !== undefined ) {
				var elZoom = root.querySelector( '[data-status="zoom"]' );
				if ( elZoom ) {
					elZoom.textContent = Math.round( fields.zoomPercent ) + '%';
				}
			}
			if ( fields.pos !== null && fields.pos !== undefined &&
				typeof fields.pos.x === 'number' && typeof fields.pos.y === 'number' ) {
				var elPos = root.querySelector( '[data-status="pos"]' );
				if ( elPos ) {
					elPos.textContent = Math.round( fields.pos.x ) + ',' + Math.round( fields.pos.y );
				}
			}
			if ( fields.size !== null && fields.size !== undefined &&
				typeof fields.size.width === 'number' && typeof fields.size.height === 'number' ) {
				var elSize = root.querySelector( '[data-status="size"]' );
				if ( elSize ) {
					elSize.textContent = Math.round( fields.size.width ) + '×' + Math.round( fields.size.height );
				}
			}
			if ( fields.selectionCount !== null && fields.selectionCount !== undefined ) {
				var elSel = root.querySelector( '[data-status="selection"]' );
				if ( elSel ) {
					elSel.textContent = String( fields.selectionCount );
				}
			}
		};

		// Wire close button
		closeBtn.addEventListener( 'click', function () {
			// navigateBack=true
			self.cancel( true );
		} );
	};

	LayersEditor.prototype.setupEventHandlers = function () {
		var self = this;

		// Bind and store handlers so we can remove them on destroy
		this.onResizeHandler = function () {
			self.handleResize();
		};
		this.onBeforeUnloadHandler = function ( e ) {
			if ( self.isDirty ) {
				e.preventDefault();
				e.returnValue = '';
			}
		};

		// Handle window resize
		window.addEventListener( 'resize', this.onResizeHandler );

		// Handle unsaved changes warning
		window.addEventListener( 'beforeunload', this.onBeforeUnloadHandler );
	};

	LayersEditor.prototype.loadLayers = function () {
		var self = this;

		// Debug: Log loadLayers call (only in debug mode)
		if ( this.debug ) {
			this.debugLog( 'loadLayers called for filename:', this.filename );
		}

		// Show loading spinner
		self.showSpinner( mw.message ? mw.message( 'layers-loading' ).text() : 'Loading...' );

		// Load existing layers from API
		var api = new mw.Api();
		// Debug: Log API call (only in debug mode)
		if ( this.debug ) {
			this.debugLog( 'Making API call to layersinfo for filename:', this.filename );
		}
		api.get( {
			action: 'layersinfo',
			filename: this.filename,
			format: 'json'
		} ).done( function ( data ) {
			// Debug: Log API response (only in debug mode)
			if ( self.debug ) {
				self.debugLog( 'API call successful, received data:', data );
			}
			self.hideSpinner();

			// Debug: Log raw API response (only in debug mode)
			if ( self.debug ) {
				self.debugLog( 'Raw layersinfo API response:', data );
				if ( data.layersinfo && data.layersinfo.layerset ) {
					self.debugLog( 'Raw layerset data:', data.layersinfo.layerset );
					if ( data.layersinfo.layerset.data && data.layersinfo.layerset.data.layers ) {
						self.debugLog( 'Raw layers array:', data.layersinfo.layerset.data.layers );
						// Show each raw layer in detail
						data.layersinfo.layerset.data.layers.forEach( function ( layer, index ) {
							self.debugLog( 'Raw Layer ' + index + ':', JSON.stringify( layer, null, 2 ) );
						} );
					}
				}
			}

			if ( data.layersinfo && data.layersinfo.layerset ) {
				// Debug: Log layerset processing (only in debug mode)
				if ( self.debug ) {
					self.debugLog( 'Found layerset data, processing layers...' );
					self.debugLog( 'Raw layerset data:', data.layersinfo.layerset );
				}

				var rawLayers = data.layersinfo.layerset.data.layers || [];
				// Debug: Log raw layers (only in debug mode)
				if ( self.debug ) {
					self.debugLog( 'Raw layers array length:', rawLayers.length );
					self.debugLog( 'Raw layers array:', rawLayers );
				}

				self.layers = rawLayers
					.map( function ( layer ) {
						// Ensure every layer has an id
						if ( !layer.id ) {
							layer.id = 'layer_' + Date.now() + '_' +
								Math.random().toString( 36 ).slice( 2, 9 );
						}

						// Fix boolean properties that may have been converted to empty strings
						var booleanProps = [ 'shadow', 'textShadow', 'glow', 'visible', 'locked' ];
						booleanProps.forEach( function ( prop ) {
							if ( layer[ prop ] === '0' || layer[ prop ] === 'false' ) {
								layer[ prop ] = false;
							} else if ( layer[ prop ] === '' || layer[ prop ] === '1' || layer[ prop ] === 'true' ) {
								// Treat empty string as true since it indicates the property was
								// set. This handles the MediaWiki boolean serialization issue
								layer[ prop ] = true;
							}
							// Leave actual booleans unchanged
						} );

						return layer;
					} );
				self.currentLayerSetId = data.layersinfo.layerset.id || null;

				// Debug: Log processed layers (only in debug mode)
				if ( self.debug ) {
					self.debugLog( 'Processed layers count:', self.layers.length );
					self.debugLog( 'Processed layers array:', self.layers );
				}

				// Debug: Log loaded layers and their shadow properties
				if ( self.debug ) {
					self.debugLog( 'Loaded layers count:', self.layers.length );
					self.layers.forEach( function ( layer, index ) {
						self.debugLog( 'Loaded Layer ' + index + ':', layer );
						// Show shadow properties specifically
						self.debugLog( '  Shadow after normalization:', {
							shadow: layer.shadow,
							shadowType: typeof layer.shadow,
							shadowColor: layer.shadowColor,
							shadowBlur: layer.shadowBlur,
							shadowOffsetX: layer.shadowOffsetX,
							shadowOffsetY: layer.shadowOffsetY
						} );
					} );
				}
			} else {
				// Debug: Log when no layerset data found (only in debug mode)
				if ( self.debug ) {
					self.debugLog( 'No layerset data found in API response' );
				}
				self.layers = [];
			}

			// Debug: Log final layers array (only in debug mode)
			if ( self.debug ) {
				self.debugLog( 'Final layers array length before renderLayers:', self.layers.length );
			}

			// Populate revision list if provided
			if ( data.layersinfo && Array.isArray( data.layersinfo.all_layersets ) ) {
				self.allLayerSets = data.layersinfo.all_layersets.slice();
				self.buildRevisionSelector();
			}
			self.renderLayers();

			// Save initial state for undo system
			self.saveState( 'initial' );
		} ).fail( function ( code, result ) {
			// Debug: Log API failure (only in debug mode)
			if ( self.debug ) {
				self.debugLog( 'API call failed with code:', code, 'result:', result );
			}
			self.hideSpinner();
			self.layers = [];
			self.renderLayers();
			self.saveState( 'initial' );
			var errorMsg = ( mw.message ? mw.message( 'layers-load-error' ).text() : 'Failed to load layers' );
			if ( result && result.error && result.error.info ) {
				errorMsg = result.error.info;
			}
			mw.notify( errorMsg, { type: 'error' } );
		} );
	};

	// Show/hide spinner for long operations
	LayersEditor.prototype.showSpinner = function ( message ) {
		if ( this.spinnerEl ) {
			this.spinnerEl.remove();
		}
		this.spinnerEl = document.createElement( 'div' );
		this.spinnerEl.className = 'layers-spinner';
		this.spinnerEl.setAttribute( 'role', 'status' );
		this.spinnerEl.setAttribute( 'aria-live', 'polite' );
		var spinnerIcon = document.createElement( 'span' );
		spinnerIcon.className = 'spinner';
		var textNode = document.createElement( 'span' );
		textNode.className = 'spinner-text';
		textNode.textContent = ' ' + ( message || '' );
		this.spinnerEl.appendChild( spinnerIcon );
		this.spinnerEl.appendChild( textNode );
		this.container.appendChild( this.spinnerEl );
	};

	LayersEditor.prototype.hideSpinner = function () {
		if ( this.spinnerEl ) {
			this.spinnerEl.remove();
			this.spinnerEl = null;
		}
	};

	LayersEditor.prototype.buildRevisionSelector = function () {
		var select = this.revSelectEl;
		if ( !select ) {
			return;
		}
		select.innerHTML = '';
		// Latest option
		var optLatest = document.createElement( 'option' );
		optLatest.value = String( this.currentLayerSetId || 0 );
		optLatest.textContent = ( mw.message ? mw.message( 'layers-revision-latest' ).text() : 'Latest' );
		select.appendChild( optLatest );
		// Other revisions
		var self = this;
		// Sort by numeric revision desc, then timestamp desc for stability
		var sorted = this.allLayerSets.slice().sort( function ( a, b ) {
			var ra = parseInt( a.ls_revision, 10 ) || 0;
			var rb = parseInt( b.ls_revision, 10 ) || 0;
			if ( rb !== ra ) {
				return rb - ra;
			}
			var ta = a.ls_timestamp || '';
			var tb = b.ls_timestamp || '';
			return tb.localeCompare( ta );
		} );
		sorted.forEach( function ( row ) {
			var rid = parseInt( row.ls_id, 10 );
			var rev = parseInt( row.ls_revision, 10 );
			var whenRaw = row.ls_timestamp || '';
			var when = self.formatTimestamp( whenRaw );
			var name = row.ls_name || '';
			var uname = row.ls_user_name || ( row.ls_user_id ? ( 'User ' + row.ls_user_id ) : '' );
			var byTxt = ( mw.message ? mw.message( 'layers-revision-by', uname ).text() : ( uname ? ( 'by ' + uname ) : '' ) );
			var isCurrentRev = ( self.currentLayerSetId && rid === self.currentLayerSetId );
			var currentSuffix = isCurrentRev ? (
				mw.message ? mw.message( 'layers-revision-current-suffix' ).text() : ' (current)'
			) : '';
			var label = '#' + rev +
				( name ? ( ' — ' + name ) : '' ) +
				( when ? ( ' — ' + when ) : '' ) +
				( byTxt ? ( ' — ' + byTxt ) : '' ) +
				currentSuffix;
			var opt = document.createElement( 'option' );
			opt.value = String( rid );
			opt.textContent = label;
			select.appendChild( opt );
		} );

		// Ensure Load button state reflects selection
		if ( this.revLoadBtnEl ) {
			var latestIsCurrent = (
				this.currentLayerSetId && String( this.currentLayerSetId ) === optLatest.value
			);
			this.revLoadBtnEl.disabled = !!latestIsCurrent;
		}
	};

	// Convert MediaWiki DB timestamp (YYYYMMDDHHMMSS) or ISO to a short local string
	LayersEditor.prototype.formatTimestamp = function ( ts ) {
		if ( !ts || typeof ts !== 'string' ) {
			return '';
		}
		var d;
		if ( /^\d{14}$/.test( ts ) ) {
			// YYYYMMDDHHMMSS
			var y = parseInt( ts.slice( 0, 4 ), 10 );
			var m = parseInt( ts.slice( 4, 6 ), 10 ) - 1;
			var day = parseInt( ts.slice( 6, 8 ), 10 );
			var hh = parseInt( ts.slice( 8, 10 ), 10 );
			var mm = parseInt( ts.slice( 10, 12 ), 10 );
			var ss = parseInt( ts.slice( 12, 14 ), 10 );
			d = new Date( Date.UTC( y, m, day, hh, mm, ss ) );
		} else {
			// Try native parse
			d = new Date( ts );
		}
		if ( isNaN( d.getTime() ) ) {
			return ts;
		}
		try {
			return d.toLocaleString();
		} catch ( e ) {
			return ts;
		}
	};

	LayersEditor.prototype.loadRevisionById = function ( layerSetId ) {
		// Prevent redundant load
		if ( this.currentLayerSetId && layerSetId === this.currentLayerSetId ) {
			mw.notify( ( mw.message ? mw.message( 'layers-revision-already-current' ).text() : 'That revision is already loaded' ), { type: 'info' } );
			return;
		}
		// Confirm if there are unsaved changes
		if ( this.isDirty ) {
			var confirmMsg = ( mw.message ? mw.message( 'layers-load-revision-unsaved-confirm' ).text() : 'You have unsaved changes. Load revision anyway?' );
			// eslint-disable-next-line no-alert
			if ( !window.confirm( confirmMsg ) ) {
				return;
			}
		}
		var found = null;
		for ( var i = 0; i < this.allLayerSets.length; i++ ) {
			if ( parseInt( this.allLayerSets[ i ].ls_id, 10 ) === layerSetId ) {
				found = this.allLayerSets[ i ];
				break;
			}
		}
		if ( !found ) {
			mw.notify( ( mw.message ? mw.message( 'layers-revision-not-found' ).text() : 'Revision not found' ), { type: 'warn' } );
			return;
		}
		try {
			var blob = typeof found.ls_json_blob === 'string' ? JSON.parse( found.ls_json_blob ) : ( found.ls_json_blob || {} );
			var layers = Array.isArray( blob.layers ) ? blob.layers : [];
			// Save state and replace
			this.saveState( 'load-revision' );
			this.layers = layers.map( function ( layer ) {
				if ( !layer.id ) {
					layer.id = 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 9 );
				}
				return layer;
			} );
			this.currentLayerSetId = layerSetId;
			this.renderLayers();
			this.markDirty();
			mw.notify( ( mw.message ? mw.message( 'layers-revision-loaded' ).text() : 'Revision loaded' ), { type: 'info' } );
		} catch ( e ) {
			mw.notify( ( mw.message ? mw.message( 'layers-revision-load-error' ).text() : 'Failed to load revision' ), { type: 'error' } );
		}
	};

	LayersEditor.prototype.reloadRevisions = function () {
		var self = this;
		var api = new mw.Api();
		api.get( {
			action: 'layersinfo',
			filename: this.filename,
			format: 'json'
		} ).done( function ( data ) {
			if ( data.layersinfo ) {
				if ( Array.isArray( data.layersinfo.all_layersets ) ) {
					self.allLayerSets = data.layersinfo.all_layersets.slice();
				}
				if ( data.layersinfo.layerset && data.layersinfo.layerset.id ) {
					self.currentLayerSetId = data.layersinfo.layerset.id;
				}
				self.buildRevisionSelector();
				if ( self.revNameInputEl ) {
					self.revNameInputEl.value = '';
				}
			}
		} );
	};

	LayersEditor.prototype.renderLayers = function () {
		// Render layers on canvas
		if ( this.canvasManager ) {
			this.canvasManager.renderLayers( this.layers );
		}

		// Update layer panel
		if ( this.layerPanel ) {
			this.layerPanel.updateLayers( this.layers );
			// Populate compact code slot in status bar
			if ( typeof this.layerPanel.renderCodeSnippet === 'function' && this.statusBar ) {
				var codeHtml = this.layerPanel.renderCodeSnippet( this.layers );
				var codeTextMatch = codeHtml.match( /<code[^>]*>([\s\S]*?)<\/code>/i );
				var codeParamMatch = codeHtml.match( /data-code="([^"]+)"/i );
				var codeStr = codeTextMatch ? codeTextMatch[ 1 ] : '';
				var codeParam = codeParamMatch ? codeParamMatch[ 1 ] : '';
				var codeEl = this.statusBar.querySelector( '.status-code-text' );
				var copyBtn = this.statusBar.querySelector( '.status-copy-btn' );
				if ( codeEl ) {
					codeEl.textContent = codeStr;
				}
				if ( copyBtn ) {
					var t = this.layerPanel.msg ?
						this.layerPanel.msg.bind( this.layerPanel ) :
						function ( k, d ) { return d; };
					copyBtn.onclick = function () {
						var toCopy = codeParam || codeStr;
						var onSuccess = function () {
							copyBtn.textContent = t( 'layers-code-copied', 'Copied!' );
							setTimeout( function () {
								copyBtn.textContent = t( 'layers-code-copy', 'Copy' );
							}, 1500 );
						};
						var onFailure = function () {
							copyBtn.textContent = t( 'layers-code-copy-failed', 'Copy failed' );
							setTimeout( function () {
								copyBtn.textContent = t( 'layers-code-copy', 'Copy' );
							}, 1500 );
						};
						if ( navigator.clipboard && navigator.clipboard.writeText ) {
							navigator.clipboard
								.writeText( toCopy )
								.then( onSuccess )
								.catch( function () {
									var ta = document.createElement( 'textarea' );
									ta.value = toCopy;
									document.body.appendChild( ta );
									ta.select();
									try {
										if ( document.execCommand( 'copy' ) ) {
											onSuccess();
										} else {
											onFailure();
										}
									} catch ( e ) {
										onFailure();
									}
									document.body.removeChild( ta );
								} );
						} else {
							var textArea = document.createElement( 'textarea' );
							textArea.value = toCopy;
							document.body.appendChild( textArea );
							textArea.select();
							try {
								if ( document.execCommand( 'copy' ) ) {
									onSuccess();
								} else {
									onFailure();
								}
							} catch ( err ) {
								onFailure();
							}
							document.body.removeChild( textArea );
						}
					};
				}
			}
		}

		// Update UI state
		this.updateUIState();
	};

	LayersEditor.prototype.addLayer = function ( layerData ) {
		// Save current state for undo
		this.saveState();

		// Add new layer
		layerData.id = this.generateLayerId();
		layerData.visible = layerData.visible !== false; // Default to visible

		// Insert at top so top of list = top of draw order
		this.layers.unshift( layerData );
		this.renderLayers();
		this.markDirty();

		// Select the newly created layer
		this.selectLayer( layerData.id );

		// console.log( 'Added layer:', layerData );
	};

	LayersEditor.prototype.updateLayer = function ( layerId, changes ) {
		// Save current state for undo
		this.saveState();

		// Update existing layer
		var layer = this.getLayerById( layerId );
		if ( layer ) {
			$.extend( layer, changes );
			this.renderLayers();
			this.markDirty();
		}
	};

	LayersEditor.prototype.removeLayer = function ( layerId ) {
		// Save current state for undo
		this.saveState();

		// Remove layer
		this.layers = this.layers.filter( function ( layer ) {
			return layer.id !== layerId;
		} );
		this.renderLayers();
		this.markDirty();

		// Update UI state
		this.updateUIState();
	};

	LayersEditor.prototype.getLayerById = function ( layerId ) {
		return this.layers.find( function ( layer ) {
			return layer.id === layerId;
		} );
	};

	LayersEditor.prototype.generateLayerId = function () {
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	};

	LayersEditor.prototype.setCurrentTool = function ( tool ) {
		this.currentTool = tool;
		if ( this.canvasManager ) {
			this.canvasManager.setTool( tool );
		}
	};

	// Undo/Redo System
	LayersEditor.prototype.saveState = function ( action ) {
		// Delegate to canvas manager's history system
		if ( this.canvasManager ) {
			this.canvasManager.saveState( action );
		}
	};

	LayersEditor.prototype.undo = function () {
		// Delegate to canvas manager's undo system
		if ( this.canvasManager ) {
			return this.canvasManager.undo();
		}
		return false;
	};

	LayersEditor.prototype.redo = function () {
		// Delegate to canvas manager's redo system
		if ( this.canvasManager ) {
			return this.canvasManager.redo();
		}
		return false;
	};

	// Selection Management
	LayersEditor.prototype.selectLayer = function ( layerId ) {
		this.selectedLayerId = layerId;

		// Update canvas selection
		if ( this.canvasManager ) {
			this.canvasManager.selectLayer( layerId );
		}

		// Update layer panel selection
		if ( this.layerPanel ) {
			this.layerPanel.selectLayer( layerId );
		}

		// Update UI state (toolbar buttons, etc.)
		this.updateUIState();

		// console.log( 'Selected layer:', layerId );
	};

	LayersEditor.prototype.deleteSelected = function () {
		if ( this.selectedLayerId ) {
			this.removeLayer( this.selectedLayerId );
			this.selectedLayerId = null;
		}
	};

	LayersEditor.prototype.duplicateSelected = function () {
		if ( this.selectedLayerId ) {
			var layer = this.getLayerById( this.selectedLayerId );
			if ( layer ) {
				var duplicate = JSON.parse( JSON.stringify( layer ) );
				duplicate.x = ( duplicate.x || 0 ) + 10;
				duplicate.y = ( duplicate.y || 0 ) + 10;
				delete duplicate.id; // Will be regenerated
				this.addLayer( duplicate );
			}
		}
	};

	LayersEditor.prototype.updateUIState = function () {
		// Update toolbar state
		if ( this.toolbar ) {
			var canUndo = this.canvasManager ? this.canvasManager.historyIndex > 0 : false;
			var canRedo = this.canvasManager ? (
				this.canvasManager.historyIndex <
				this.canvasManager.history.length - 1
			) : false;
			this.toolbar.updateUndoRedoState( canUndo, canRedo );
			this.toolbar.updateDeleteState( !!this.selectedLayerId );
		}
	};

	// Apply a mutator function to all selected layers; saves state and marks dirty
	LayersEditor.prototype.applyToSelection = function ( mutator ) {
		if ( typeof mutator !== 'function' ) {
			return;
		}
		var ids = this.getSelectedLayerIds();
		if ( !ids.length ) {
			return;
		}
		this.saveState();
		for ( var i = 0; i < ids.length; i++ ) {
			var layer = this.getLayerById( ids[ i ] );
			if ( layer ) {
				mutator( layer );
			}
		}
		this.renderLayers();
		this.markDirty();
	};

	// Return selected layer ids from CanvasManager or fallback to single selection
	LayersEditor.prototype.getSelectedLayerIds = function () {
		if ( this.canvasManager && Array.isArray( this.canvasManager.selectedLayerIds ) ) {
			return this.canvasManager.selectedLayerIds.slice();
		}
		return this.selectedLayerId ? [ this.selectedLayerId ] : [];
	};

	LayersEditor.prototype.cancel = function ( navigateBack ) {
		if ( this.isDirty ) {
			var confirmMessage = ( mw.message ? mw.message( 'layers-unsaved-cancel-confirm' ).text() : 'You have unsaved changes. Are you sure you want to cancel?' );
			// Use OOUI confirm dialog if available, otherwise fallback to browser confirm
			if ( window.OO && window.OO.ui && window.OO.ui.confirm ) {
				window.OO.ui.confirm( confirmMessage ).done( function ( confirmed ) {
					if ( confirmed ) {
						this.destroy();
						this.navigateBackToFile();
					}
				}.bind( this ) );
			} else {
				// eslint-disable-next-line no-alert
				if ( window.confirm( confirmMessage ) ) {
					this.destroy();
					this.navigateBackToFile();
				}
			}
		} else {
			this.destroy();
			if ( navigateBack ) {
				this.navigateBackToFile();
			}
		}
	};

	LayersEditor.prototype.navigateBackToFile = function () {
		try {
			if ( this.filename && mw && mw.util && typeof mw.util.getUrl === 'function' ) {
				var url = mw.util.getUrl( 'File:' + this.filename );
				window.location.href = url;
				return;
			}
			// Fallbacks
			if ( window.history && window.history.length > 1 ) {
				window.history.back();
			} else {
				window.location.reload();
			}
		} catch ( e ) {
			// As a last resort, reload
			window.location.reload();
		}
	};

	LayersEditor.prototype.save = function () {
		var self = this;

		// Client-side validation before saving
		if ( window.LayersValidator ) {
			var validator = new window.LayersValidator();
			// Use default max layers
			var validationResult = validator.validateLayers( this.layers, 100 );

			if ( !validationResult.isValid ) {
				// Show validation errors to user
				validator.showValidationErrors( validationResult.errors, 'save' );
				return; // Don't proceed with save
			}

			// Show warnings if any (but still allow save)
			if ( validationResult.warnings && validationResult.warnings.length > 0 ) {
				if ( window.mw && window.mw.notify ) {
					var warningMsg = 'Warnings: ' + validationResult.warnings.join( '; ' );
					mw.notify( warningMsg, { type: 'warn' } );
				}
			}
		}

		// Show saving spinner
		self.showSpinner( mw.message ? mw.message( 'layers-saving' ).text() : 'Saving...' );

		// Disable save button briefly
		if ( this.toolbar && this.toolbar.saveButton ) {
			this.toolbar.saveButton.disabled = true;
			setTimeout( function () {
				self.toolbar.saveButton.disabled = false;
			}, 2000 );
		}

		// Save layers to API with client-side size check
		var api = new mw.Api();
		var layersJson = JSON.stringify( this.layers );
		var serverMax = ( mw.config && mw.config.get ) ? ( mw.config.get( 'wgLayersMaxBytes' ) || 0 ) : 0;
		if ( serverMax && layersJson.length > serverMax ) {
			self.hideSpinner();
			mw.notify( ( mw.message ? mw.message( 'layers-data-too-large' ).text() : 'Layer data is too large to save.' ), { type: 'error' } );
			return;
		}
		var payload = {
			action: 'layerssave',
			filename: this.filename,
			data: layersJson,
			format: 'json'
		};
		if ( this.revNameInputEl && this.revNameInputEl.value ) {
			var setname = this.revNameInputEl.value.trim();
			if ( setname ) {
				payload.setname = setname;
			}
		}
		this.debugLog( 'Layers save payload:', payload );
		// Debug: Show detailed layer data
		this.debugLog( 'Layer count:', this.layers.length );
		this.layers.forEach( function ( layer, index ) {
			self.debugLog( 'Layer ' + index + ':', layer );
			if ( layer.shadow ) {
				self.debugLog( '  Shadow properties:', {
					shadow: layer.shadow,
					shadowColor: layer.shadowColor,
					shadowBlur: layer.shadowBlur,
					shadowOffsetX: layer.shadowOffsetX,
					shadowOffsetY: layer.shadowOffsetY,
					shadowSpread: layer.shadowSpread
				} );
			}
		} );
		api.postWithToken( 'csrf', payload ).done( function ( data ) {
			self.hideSpinner();

			// Debug: Log the actual API response
			self.debugLog( 'Layers save API response:', data );

			if ( data.layerssave && data.layerssave.success ) {
				self.markClean();
				mw.notify( ( mw.message ? mw.message( 'layers-save-success' ).text() : ( mw.msg ? mw.msg( 'layers-save-success' ) : 'Saved' ) ), { type: 'success' } );
				self.reloadRevisions();
			} else {
				var errorMsg = ( data.error && data.error.info ) ||
						( data.layerssave && data.layerssave.error ) ||
						( mw.message ? mw.message( 'layers-save-error' ).text() : 'Error saving layers' );

				// Debug: Show what we're looking for vs what we got
				self.debugLog( 'Save failed. Expected data.layerssave.success, got:' );
				self.debugLog( 'data.layerssave:', data.layerssave );
				self.debugLog( 'data.error:', data.error );

				mw.notify( 'Save failed: ' + errorMsg, { type: 'error' } );
				// Always show a modal with error details
				self.showError( 'Save failed: ' + errorMsg );
				// Log full API response for debugging
				self.errorLog( 'Layers save API error:', data );
			}
		} ).fail( function ( code, result ) {
			self.hideSpinner();
			var errorMsg = ( mw.message ? mw.message( 'layers-save-error' ).text() : 'Error saving layers' );
			if ( result && result.error && result.error.info ) {
				errorMsg = result.error.info;
			}
			mw.notify( 'API Error: ' + errorMsg, { type: 'error' } );
			// Always show a modal with error details
			self.showError( 'API Error: ' + errorMsg );
			// Log full API error for debugging
			self.errorLog( 'Layers save API failure:', code, result );
		} );
	};
	// Accessibility: Add ARIA roles and keyboard navigation stubs
	// TODO: Implement more comprehensive keyboard navigation and screen reader support

	// Security: Input sanitization before rendering user content
	// TODO: Ensure all user-generated content is sanitized before rendering in the DOM or canvas

	// Analytics: Stub for usage tracking
	// TODO: Add analytics hooks for editor usage (e.g., save, load, tool usage)

	// Testing: Stub for unit/E2E tests
	// TODO: Add unit and integration tests for LayersEditor and CanvasManager

	LayersEditor.prototype.markDirty = function () {
		this.isDirty = true;
		// Update UI to show unsaved changes
	};

	LayersEditor.prototype.markClean = function () {
		this.isDirty = false;
		// Update UI to show saved state
	};

	LayersEditor.prototype.getParentImageUrl = function () {
		// Priority 1: Use imageUrl from config (passed by MediaWiki)
		if ( this.config.imageUrl ) {
			// console.log('Layers: Using imageUrl from config:', this.config.imageUrl);
			return this.config.imageUrl;
		}

		// Priority 2: Try to construct URL using MediaWiki file path
		if ( this.filename ) {
			// Method 1: Construct URL using MediaWiki file path
			var imageUrl = mw.config.get( 'wgServer' ) + mw.config.get( 'wgScriptPath' ) +
				'/index.php?title=Special:Redirect/file/' + encodeURIComponent( this.filename );
			// console.log('Layers: Using MediaWiki file URL:', imageUrl);
			return imageUrl;
		}

		// Priority 3: Look for current page image
		var pageImage = document.querySelector( '.mw-file-element img, .fullImageLink img, .filehistory img' );
		if ( pageImage ) {
			var pageImageUrl = pageImage.getAttribute( 'src' );
			// console.log('Layers: Using page image URL:', pageImageUrl);
			return pageImageUrl;
		}

		// Priority 4: Use a default fallback
		// console.log('Layers: No parent image found, using fallback');
		return null;
	};

	LayersEditor.prototype.showError = function ( message ) {
		// Create error display in the editor with safe textContent
		var errorEl = document.createElement( 'div' );
		errorEl.className = 'layers-error';
		errorEl.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border: 2px solid #d63638; border-radius: 8px; z-index: 10001; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';

		var h = document.createElement( 'h3' );
		h.textContent = 'Error';
		errorEl.appendChild( h );

		var p = document.createElement( 'p' );
		p.textContent = String( message || '' );
		errorEl.appendChild( p );

		this.container.appendChild( errorEl );

		// Auto-hide after 10 seconds
		setTimeout( function () {
			errorEl.style.opacity = '0';
			setTimeout( function () {
				if ( errorEl.parentNode ) {
					errorEl.parentNode.removeChild( errorEl );
				}
			}, 500 ); // Allow fade out transition
		}, 10000 );
	};

	LayersEditor.prototype.handleResize = function () {
		// console.log( 'Layers: Handling window resize...' );
		if ( this.canvasManager ) {
			this.canvasManager.handleCanvasResize();
		}

		// Also trigger a canvas resize to ensure proper sizing
		if ( this.canvasManager && this.canvasManager.resizeCanvas ) {
			var self = this;
			setTimeout( function () {
				self.canvasManager.resizeCanvas();
			}, 100 ); // Small delay to let CSS settle
		}
	};

	LayersEditor.prototype.destroy = function () {
		// Cleanup canvas manager first to prevent memory leaks
		if ( this.canvasManager && typeof this.canvasManager.destroy === 'function' ) {
			this.canvasManager.destroy();
		}

		// Cleanup other components
		if ( this.layerPanel && typeof this.layerPanel.destroy === 'function' ) {
			this.layerPanel.destroy();
		}

		if ( this.toolbar && typeof this.toolbar.destroy === 'function' ) {
			this.toolbar.destroy();
		}

		// Remove event listeners to prevent memory leaks
		if ( this.onResizeHandler ) {
			window.removeEventListener( 'resize', this.onResizeHandler );
			this.onResizeHandler = null;
		}
		if ( this.onBeforeUnloadHandler ) {
			window.removeEventListener( 'beforeunload', this.onBeforeUnloadHandler );
			this.onBeforeUnloadHandler = null;
		}

		// Clean up DOM elements
		if ( this.container && this.container.parentNode ) {
			this.container.parentNode.removeChild( this.container );
		}

		// Remove spinner if still showing
		if ( this.spinnerEl && this.spinnerEl.parentNode ) {
			this.spinnerEl.parentNode.removeChild( this.spinnerEl );
			this.spinnerEl = null;
		}

		// Clear object references to prevent memory leaks
		this.canvasManager = null;
		this.layerPanel = null;
		this.toolbar = null;
		this.container = null;
		this.containerElement = null;
		this.$canvasContainer = null;
		this.$layerPanel = null;
		this.$toolbar = null;

		// Clear arrays
		this.layers = [];
		this.allLayerSets = [];
		this.undoStack = [];
		this.redoStack = [];

		// Remove body class when editor closes
		document.body.classList.remove( 'layers-editor-open' );

		// Reset document title
		if ( document.title.indexOf( 'Layers Editor' ) !== -1 ) {
			document.title = document.title.replace( /🎨 Layers Editor.*/, '' ).trim();
		}
	};

	// Export LayersEditor to global scope
	window.LayersEditor = LayersEditor;

	// Initialize editor when appropriate
	mw.hook( 'layers.editor.init' ).add( function ( config ) {
		document.title = '🎨 Layers Editor Initializing...';
		var editor = new LayersEditor( config );
		document.title = '🎨 Layers Editor - ' + ( config.filename || 'Unknown File' );
		if ( window.mw && window.mw.config.get( 'debug' ) ) {
			window.layersEditorInstance = editor;
		}
	} );

	// Auto-bootstrap if server provided config via wgLayersEditorInit
	( function autoBootstrap() {
		function tryBootstrap() {
			try {
				// Add debug logging (only if explicitly enabled)
				var debug = ( window.location && window.location.search && window.location.search.indexOf( 'layers_debug=1' ) > -1 ) ||
					( window.mw && mw.config && mw.config.get( 'wgLayersDebug' ) );

				if ( debug ) {
					if ( mw.log ) {
						mw.log( 'Layers: Auto-bootstrap starting...' );
					}
				}

				// Ensure MediaWiki is available
				// Check if MediaWiki is available
				if ( !window.mw || !mw.config || !mw.config.get ) {
					if ( debug && mw.log ) {
						mw.log( 'Layers: MediaWiki not ready, retrying in 100ms...' );
					}
					setTimeout( tryBootstrap, 100 );
					return;
				}

				// Try to get config from MediaWiki config vars
				var init = mw.config.get( 'wgLayersEditorInit' );
				if ( debug && mw.log ) {
					mw.log( 'Layers: wgLayersEditorInit config:', init );
				}

				if ( !init ) {
					if ( debug && mw.log ) {
						mw.log( 'Layers: No wgLayersEditorInit config found, not auto-bootstrapping' );
					}
					return;
				}

				var container = document.getElementById( 'layers-editor-container' );
				if ( debug && mw.log ) {
					mw.log( 'Layers: Container element:', container );
				}

				mw.hook( 'layers.editor.init' ).fire( {
					filename: init.filename,
					imageUrl: init.imageUrl,
					container: container || document.body
				} );

				if ( debug && mw.log ) {
					mw.log( 'Layers: Auto-bootstrap fired layers.editor.init hook' );
				}
			} catch ( e ) {
				if ( mw.log ) {
					mw.log.error( 'Layers: Auto-bootstrap error:', e );
				}
			}
		}

		// Try bootstrapping immediately, or when DOM is ready
		if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', tryBootstrap );
		} else {
			tryBootstrap();
		}
	}() );

}() );
