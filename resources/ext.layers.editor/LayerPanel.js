/* eslint-disable */
/**
 * Layer Panel for Layers Editor
 * Manages the layer list, visibility, ordering, and layer properties
 */
( function () {
	'use strict';

	/**
	 * @class LayerPanel
	 * @param {Object} config
	 * @param {HTMLElement} config.container The container element for the panel
	 * @param {window.LayersEditor} config.editor A reference to the main editor instance
	 * @param {HTMLElement} [config.inspectorContainer] Optional inspector container
	 */
	function LayerPanel( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.editor = this.config.editor;
		this.inspectorContainer = this.config.inspectorContainer || null;
		this.layers = [];
		this.selectedLayerId = null;
		this.documentListeners = [];
		this.targetListeners = [];
		this.dialogCleanups = [];

		this.createInterface();
		this.setupEventHandlers();
		}

		LayerPanel.prototype.isDebugEnabled = function () {
			return !!( window.mw && window.mw.config && window.mw.config.get( 'wgLayersDebug' ) );
		};

		LayerPanel.prototype.logDebug = function () {
			if ( this.isDebugEnabled() && window.mw && window.mw.log ) {
				var args = Array.prototype.slice.call( arguments );
				args.unshift( '[LayerPanel]' );
				window.mw.log.apply( window.mw, args );
			}
		};

		LayerPanel.prototype.logWarn = function () {
			if ( window.mw && window.mw.log && typeof window.mw.log.warn === 'function' ) {
				var args = Array.prototype.slice.call( arguments );
				args.unshift( '[LayerPanel]' );
				window.mw.log.warn.apply( window.mw.log, args );
			}
		};

		LayerPanel.prototype.logError = function () {
			if ( window.mw && window.mw.log && typeof window.mw.log.error === 'function' ) {
				var args = Array.prototype.slice.call( arguments );
				args.unshift( '[LayerPanel]' );
				window.mw.log.error.apply( window.mw.log, args );
			}
		};

		LayerPanel.prototype.addDocumentListener = function ( event, handler, options ) {
			if ( !event || typeof handler !== 'function' ) {
				return;
			}
			document.addEventListener( event, handler, options );
			this.documentListeners.push( { event: event, handler: handler, options: options } );
		};

		LayerPanel.prototype.addTargetListener = function ( target, event, handler, options ) {
			if ( !target || typeof target.addEventListener !== 'function' || typeof handler !== 'function' ) {
				return;
			}
			target.addEventListener( event, handler, options );
			this.targetListeners.push( { target: target, event: event, handler: handler, options: options } );
		};

		LayerPanel.prototype.removeDocumentListeners = function () {
			if ( !this.documentListeners ) {
				return;
			}
			while ( this.documentListeners.length ) {
				var info = this.documentListeners.pop();
				document.removeEventListener( info.event, info.handler, info.options );
			}
		};

		LayerPanel.prototype.removeTargetListeners = function () {
			if ( !this.targetListeners ) {
				return;
			}
			while ( this.targetListeners.length ) {
				var info = this.targetListeners.pop();
				if ( info.target && typeof info.target.removeEventListener === 'function' ) {
					info.target.removeEventListener( info.event, info.handler, info.options );
				}
			}
		};

		LayerPanel.prototype.registerDialogCleanup = function ( cleanupFn ) {
			if ( typeof cleanupFn === 'function' ) {
				this.dialogCleanups.push( cleanupFn );
			}
		};

		LayerPanel.prototype.runDialogCleanups = function () {
			while ( this.dialogCleanups && this.dialogCleanups.length ) {
				var cleanup = this.dialogCleanups.pop();
				try {
					cleanup();
				} catch ( _err ) {
					// Ignore cleanup errors to avoid cascading failures during teardown
				}
			}
			this.dialogCleanups = [];
		};

		LayerPanel.prototype.destroy = function () {
			this.runDialogCleanups();
			this.removeDocumentListeners();
			this.removeTargetListeners();
			document.body.classList.remove( 'layers-resize-cursor' );
			this.dialogCleanups = [];
			this.documentListeners = [];
			this.targetListeners = [];
		};

	// Minimal i18n helper with safe fallbacks
	LayerPanel.prototype.msg = function ( key, fallback ) {
		var txt = null;
		try {
			if ( window.mw && typeof mw.message === 'function' ) {
				txt = mw.message( key ).text();
			}
		} catch ( _e ) {}
		// MediaWiki shows ⧼key⧽ for missing messages; treat as missing
		if ( typeof txt === 'string' && txt.indexOf && txt.indexOf( '\u29fc' ) === -1 && txt.indexOf( '⧼' ) === -1 ) {
			return txt;
		}
		return fallback;
	};

	// Helper function to set multiple attributes on an element
	LayerPanel.prototype.setAttributes = function ( element, attributes ) {
		for ( var key in attributes ) {
			if ( Object.prototype.hasOwnProperty.call( attributes, key ) ) {
				element.setAttribute( key, attributes[ key ] );
			}
		}
	};

	// SVG Helper Functions
	LayerPanel.prototype.createSVGElement = function ( tag, attributes ) {
		var element = document.createElementNS( 'http://www.w3.org/2000/svg', tag );
		if ( attributes ) {
			this.setAttributes( element, attributes );
		}
		return element;
	};

	LayerPanel.prototype.createEyeIcon = function ( visible ) {
		var svg = this.createSVGElement( 'svg', {
			width: '24',
			height: '24',
			viewBox: '0 0 24 24',
			'aria-hidden': 'true'
		} );

		var ellipse = this.createSVGElement( 'ellipse', {
			cx: '12',
			cy: '12',
			rx: '9',
			ry: '7',
			fill: 'none',
			'stroke-width': '2.5',
			stroke: visible ? '#666' : '#aaa'
		} );
		svg.appendChild( ellipse );

		if ( visible ) {
			var pupil = this.createSVGElement( 'circle', {
				cx: '12',
				cy: '12',
				r: '3.5',
				fill: '#666'
			} );
			svg.appendChild( pupil );
		} else {
			var slash = this.createSVGElement( 'line', {
				x1: '5',
				y1: '21',
				x2: '21',
				y2: '5',
				stroke: '#c00',
				'stroke-width': '2.5'
			} );
			svg.appendChild( slash );
		}

		return svg;
	};

	LayerPanel.prototype.createLockIcon = function ( locked ) {
		var svg = this.createSVGElement( 'svg', {
			width: '20',
			height: '20',
			viewBox: '0 0 24 24',
			'aria-hidden': 'true',
			style: 'opacity: ' + ( locked ? '1' : '0.4' )
		} );

		var rect = this.createSVGElement( 'rect', {
			x: '6',
			y: '10',
			width: '12',
			height: '10',
			rx: '1',
			ry: '1',
			fill: 'none',
			stroke: locked ? '#d63031' : '#27ae60',
			'stroke-width': '2'
		} );
		svg.appendChild( rect );

		var path = this.createSVGElement( 'path', {
			fill: 'none',
			stroke: locked ? '#d63031' : '#27ae60',
			'stroke-width': '2',
			d: locked ? 'M9 10V8a3 3 0 0 1 6 0v2' : 'M9 10V6a3 3 0 0 1 6 0'
		} );
		svg.appendChild( path );

		var dot = this.createSVGElement( 'circle', {
			cx: '12',
			cy: '15',
			r: '1.5',
			fill: locked ? '#d63031' : '#27ae60'
		} );
		svg.appendChild( dot );

		return svg;
	};

	LayerPanel.prototype.createDeleteIcon = function () {
		var svg = this.createSVGElement( 'svg', {
			width: '20',
			height: '20',
			viewBox: '0 0 24 24',
			'aria-hidden': 'true',
			style: 'opacity: 0.6'
		} );

		var path = this.createSVGElement( 'path', {
			d: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
			fill: 'none',
			stroke: '#888',
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round'
		} );
		svg.appendChild( path );

		var l1 = this.createSVGElement( 'line', {
			x1: '10',
			y1: '11',
			x2: '10',
			y2: '17',
			stroke: '#888',
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( l1 );

		var l2 = this.createSVGElement( 'line', {
			x1: '14',
			y1: '11',
			x2: '14',
			y2: '17',
			stroke: '#888',
			'stroke-width': '2',
			'stroke-linecap': 'round'
		} );
		svg.appendChild( l2 );

		return svg;
	};

	// No-op kept for backward compatibility
	LayerPanel.prototype.updateCodePanel = function () {};

	LayerPanel.prototype.createInterface = function () {
		var self = this;
		// Clear container safely without innerHTML
		while ( this.container.firstChild ) {
			this.container.removeChild( this.container.firstChild );
		}
		this.container.setAttribute( 'role', 'region' );
		this.container.setAttribute( 'aria-label', this.msg( 'layers-panel-title', 'Layers' ) );

		// Header
		var header = document.createElement( 'div' );
		header.className = 'layers-panel-header';
		var title = document.createElement( 'h3' );
		title.className = 'layers-panel-title';
		title.textContent = this.msg( 'layers-panel-title', 'Layers' );
		header.appendChild( title );
		var subtitle = document.createElement( 'div' );
		subtitle.className = 'layers-panel-subtitle';
		subtitle.textContent = this.msg( 'layers-panel-subtitle', 'Drag to reorder • Click name to rename' );
		header.appendChild( subtitle );
		this.container.appendChild( header );

		// Inner flex container to prevent underlap and allow resizing
		var sidebarInner = document.createElement( 'div' );
		sidebarInner.className = 'layers-panel-inner layers-flex-layout';

		// Layer list
		this.layerList = document.createElement( 'div' );
		this.layerList.className = 'layers-list';
		this.layerList.setAttribute( 'role', 'listbox' );
		this.layerList.setAttribute( 'aria-label', this.msg( 'layers-panel-title', 'Layers' ) );
		var emptyState = document.createElement( 'div' );
		emptyState.className = 'layers-empty';
		emptyState.textContent = this.msg( 'layers-empty', 'No layers yet. Choose a tool to begin.' );
		this.layerList.appendChild( emptyState );

		// Divider (resizer)
		var divider = document.createElement( 'div' );
		divider.className = 'layers-panel-divider';
		divider.setAttribute( 'tabindex', '0' );
		divider.setAttribute( 'role', 'separator' );
		divider.setAttribute( 'aria-orientation', 'horizontal' );
		divider.title = this.msg( 'layers-panel-divider', 'Drag to resize panels' );

		// Properties panel
		this.propertiesPanel = document.createElement( 'div' );
		this.propertiesPanel.className = 'layers-properties';
		this.propertiesPanel.setAttribute( 'role', 'region' );
		this.propertiesPanel.setAttribute( 'aria-label', this.msg( 'layers-properties-title', 'Properties' ) );
		// Build properties panel header/content without innerHTML
		while ( this.propertiesPanel.firstChild ) {
			this.propertiesPanel.removeChild( this.propertiesPanel.firstChild );
		}
		var propsHeader = document.createElement( 'h4' );
		propsHeader.textContent = this.msg( 'layers-properties-title', 'Properties' );
		var propsContent = document.createElement( 'div' );
		propsContent.className = 'properties-content';
		this.propertiesPanel.appendChild( propsHeader );
		this.propertiesPanel.appendChild( propsContent );

		sidebarInner.appendChild( this.layerList );
		sidebarInner.appendChild( divider );
		sidebarInner.appendChild( this.propertiesPanel );
		this.container.appendChild( sidebarInner );


		// Resizable divider logic
		var isDragging = false;
		var minListHeight = 60;
		var minPropsHeight = 80;
		this.addTargetListener( divider, 'mousedown', function () {
			isDragging = true;
			document.body.classList.add( 'layers-resize-cursor' );
		} );
		var handleMouseMove = function ( e ) {
			if ( !isDragging ) {
				return;
			}
			var rect = sidebarInner.getBoundingClientRect();
			var offset = e.clientY - rect.top;
			var totalHeight = sidebarInner.offsetHeight;
			var dividerHeight = divider.offsetHeight;
			var maxListHeight = totalHeight - dividerHeight - minPropsHeight;
			var newListHeight = Math.max( minListHeight, Math.min( offset, maxListHeight ) );
			var newPropsHeight = totalHeight - newListHeight - dividerHeight;
			if ( self.layerList && self.layerList.classList ) {
				self.layerList.classList.add( 'layers-fixed-height' );
				self.layerList.style.height = newListHeight + 'px';
			}
			if ( self.propertiesPanel && self.propertiesPanel.classList ) {
				self.propertiesPanel.classList.add( 'layers-fixed-height' );
				self.propertiesPanel.style.height = newPropsHeight + 'px';
			}
		};
		this.addDocumentListener( 'mousemove', handleMouseMove );
		var handleMouseUp = function () {
			if ( isDragging ) {
				isDragging = false;
				document.body.classList.remove( 'layers-resize-cursor' );
			}
		};
		this.addDocumentListener( 'mouseup', handleMouseUp );

		// Touch support
		this.addTargetListener( divider, 'touchstart', function () {
			isDragging = true;
			document.body.classList.add( 'layers-resize-cursor' );
		} );
		var handleTouchMove = function ( e ) {
			if ( !isDragging ) {
				return;
			}
			var rect = sidebarInner.getBoundingClientRect();
			var offset = e.touches[ 0 ].clientY - rect.top;
			var totalHeight = sidebarInner.offsetHeight;
			var dividerHeight = divider.offsetHeight;
			var maxListHeight = totalHeight - dividerHeight - minPropsHeight;
			var newListHeight = Math.max( minListHeight, Math.min( offset, maxListHeight ) );
			var newPropsHeight = totalHeight - newListHeight - dividerHeight;
			if ( self.layerList && self.layerList.classList ) {
				self.layerList.classList.add( 'layers-fixed-height' );
				self.layerList.style.height = newListHeight + 'px';
			}
			if ( self.propertiesPanel && self.propertiesPanel.classList ) {
				self.propertiesPanel.classList.add( 'layers-fixed-height' );
				self.propertiesPanel.style.height = newPropsHeight + 'px';
			}
		};
		this.addDocumentListener( 'touchmove', handleTouchMove, { passive: false } );
		var handleTouchEnd = function () {
			if ( isDragging ) {
				isDragging = false;
				document.body.classList.remove( 'layers-resize-cursor' );
			}
		};
		this.addDocumentListener( 'touchend', handleTouchEnd );
	};

	LayerPanel.prototype.setupEventHandlers = function () {
		var self = this;
		// Clicks in the list
		if ( this.layerList ) {
			this.addTargetListener( this.layerList, 'click', function ( e ) {
				self.handleLayerListClick( e );
			} );
		}
		// Drag and drop reordering
		this.setupDragAndDrop();
		// Live transform sync from CanvasManager during manipulation
		try {
			var target = ( this.editor && this.editor.container ) || document;
			this.addTargetListener( target, 'layers:transforming', function ( e ) {
				var detail = e && e.detail || {};
				if ( !detail || !detail.id ) {
					return;
				}
				if ( String( detail.id ) !== String( self.selectedLayerId ) ) {
					return;
				}
				self.syncPropertiesFromLayer( detail.layer || detail );
			} );
		} catch ( _err ) { /* ignore */ }
	};

	LayerPanel.prototype.updateLayers = function ( layers ) {
		this.layers = layers || [];
		this.renderLayerList();
	};

	LayerPanel.prototype.renderLayerList = function () {
		// Clear layer list safely without innerHTML
		while ( this.layerList.firstChild ) {
			this.layerList.removeChild( this.layerList.firstChild );
		}
		var self = this;
		var layers = this.editor.stateManager ? this.editor.stateManager.get( 'layers' ) || [] : this.layers || [];
		layers.forEach( function ( layer, index ) {
			var layerItem = self.createLayerItem( layer, index );
			self.layerList.appendChild( layerItem );
		} );
		if ( layers.length === 0 ) {
			var empty = document.createElement( 'div' );
			empty.className = 'layers-empty';
			empty.textContent = this.msg( 'layers-empty', 'No layers yet. Choose a tool to begin.' );
			this.layerList.appendChild( empty );
		}
	};

	LayerPanel.prototype.createLayerItem = function ( layer, index ) {
		var t = this.msg.bind( this );
		var item = document.createElement( 'div' );
		item.className = 'layer-item';
		item.dataset.layerId = layer.id;
		item.dataset.index = index;
		item.draggable = true;
		if ( layer.id === this.selectedLayerId ) {
			item.classList.add( 'selected' );
		}

		// Grab area
		var grabArea = document.createElement( 'div' );
		grabArea.className = 'layer-grab-area';
		grabArea.title = t( 'layers-grab-area', 'Drag to move/select' );
		grabArea.setAttribute( 'tabindex', '0' );
		grabArea.setAttribute( 'role', 'button' );
		grabArea.setAttribute( 'aria-label', t( 'layers-grab-area', 'Drag to move/select' ) );
		grabArea.style.width = '36px';
		grabArea.style.height = '36px';
		grabArea.style.display = 'flex';
		grabArea.style.alignItems = 'center';
		grabArea.style.justifyContent = 'center';
		grabArea.style.cursor = 'grab';
		// Build grab icon via DOM to avoid innerHTML
		var grabSvg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		grabSvg.setAttribute( 'width', '24' );
		grabSvg.setAttribute( 'height', '24' );
		grabSvg.setAttribute( 'viewBox', '0 0 24 24' );
		grabSvg.setAttribute( 'aria-hidden', 'true' );
		var mkCircle = function ( cx, cy ) {
			var c = document.createElementNS( 'http://www.w3.org/2000/svg', 'circle' );
			c.setAttribute( 'cx', String( cx ) );
			c.setAttribute( 'cy', String( cy ) );
			c.setAttribute( 'r', '2.5' );
			c.setAttribute( 'fill', '#bbb' );
			return c;
		};
		grabSvg.appendChild( mkCircle( 7, 7 ) );
		grabSvg.appendChild( mkCircle( 17, 7 ) );
		grabSvg.appendChild( mkCircle( 7, 17 ) );
		grabSvg.appendChild( mkCircle( 17, 17 ) );
		grabArea.appendChild( grabSvg );

		// Visibility toggle
		var visibilityBtn = document.createElement( 'button' );
		visibilityBtn.className = 'layer-visibility';
		visibilityBtn.appendChild( this.createEyeIcon( layer.visible !== false ) );
		visibilityBtn.title = t( 'layers-toggle-visibility', 'Toggle visibility' );
		visibilityBtn.type = 'button';
		visibilityBtn.setAttribute( 'aria-label', t( 'layers-toggle-visibility', 'Toggle visibility' ) );
		visibilityBtn.style.width = '36px';
		visibilityBtn.style.height = '36px';

		// Name (editable)
		var name = document.createElement( 'span' );
		name.className = 'layer-name';
		name.textContent = layer.name || this.getDefaultLayerName( layer );
		name.contentEditable = true;

		// Lock toggle
		var lockBtn = document.createElement( 'button' );
		lockBtn.className = 'layer-lock';
		lockBtn.appendChild( this.createLockIcon( !!layer.locked ) );
		lockBtn.title = t( 'layers-toggle-lock', 'Toggle lock' );
		lockBtn.type = 'button';
		lockBtn.setAttribute( 'aria-label', t( 'layers-toggle-lock', 'Toggle lock' ) );
		lockBtn.style.width = '36px';
		lockBtn.style.height = '36px';

		// Delete button
		var deleteBtn = document.createElement( 'button' );
		deleteBtn.className = 'layer-delete';
		deleteBtn.appendChild( this.createDeleteIcon() );
		deleteBtn.title = t( 'layers-delete-layer-button', 'Delete layer' );
		deleteBtn.type = 'button';
		deleteBtn.setAttribute( 'aria-label', t( 'layers-delete-layer-button', 'Delete layer' ) );
		deleteBtn.style.width = '36px';
		deleteBtn.style.height = '36px';

		item.appendChild( grabArea );
		item.appendChild( visibilityBtn );
		item.appendChild( name );
		item.appendChild( lockBtn );
		item.appendChild( deleteBtn );
		return item;
	};

	LayerPanel.prototype.getDefaultLayerName = function ( layer ) {
		var t = this.msg.bind( this );
		var LAYER_TYPES = window.LayersConstants ? window.LayersConstants.LAYER_TYPES : {};
		switch ( layer.type ) {
			case ( LAYER_TYPES.TEXT || 'text' ):
				var prefix = t( 'layers-default-text-prefix', 'Text: ' );
				var emptyText = t( 'layers-default-empty', 'Empty' );
				return prefix + ( ( layer.text || emptyText ).slice( 0, 20 ) );
			case ( LAYER_TYPES.RECTANGLE || 'rectangle' ):
				return t( 'layers-type-rectangle', 'Rectangle' );
			case ( LAYER_TYPES.BLUR || 'blur' ):
				return t( 'layers-type-blur', 'Blur/Redaction' );
			case ( LAYER_TYPES.CIRCLE || 'circle' ):
				return t( 'layers-type-circle', 'Circle' );
			case ( LAYER_TYPES.ELLIPSE || 'ellipse' ):
				return t( 'layers-type-ellipse', 'Ellipse' );
			case ( LAYER_TYPES.POLYGON || 'polygon' ):
				return t( 'layers-type-polygon', 'Polygon' );
			case ( LAYER_TYPES.STAR || 'star' ):
				return t( 'layers-type-star', 'Star' );
			case ( LAYER_TYPES.ARROW || 'arrow' ):
				return t( 'layers-type-arrow', 'Arrow' );
			case ( LAYER_TYPES.LINE || 'line' ):
				return t( 'layers-type-line', 'Line' );
			case ( LAYER_TYPES.PATH || 'path' ):
				return t( 'layers-type-path', 'Drawing' );
			case ( LAYER_TYPES.HIGHLIGHT || 'highlight' ):
				return t( 'layers-type-highlight', 'Highlight' );
			default:
				return t( 'layers-type-layer', 'Layer' );
		}
	};

	LayerPanel.prototype.handleLayerListClick = function ( e ) {
		var target = e.target;
		var layerItem = target.closest( '.layer-item' );
		if ( !layerItem ) {
			return;
		}
		var layerId = layerItem.dataset.layerId;
		var layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			return;
		}
		var visibilityBtn = target.closest( '.layer-visibility' );
		var lockBtn = target.closest( '.layer-lock' );
		var deleteBtn = target.closest( '.layer-delete' );
		var nameEl = target.closest( '.layer-name' );
		if ( visibilityBtn ) {
			this.toggleLayerVisibility( layerId );
		} else if ( lockBtn ) {
			this.toggleLayerLock( layerId );
		} else if ( deleteBtn ) {
			this.deleteLayer( layerId );
		} else if ( nameEl ) {
			this.editLayerName( layerId, nameEl );
		} else {
			this.selectLayer( layerId );
		}
	};

	LayerPanel.prototype.selectLayer = function ( layerId, fromCanvas ) {
		this.selectedLayerId = layerId;
		this.renderLayerList();
		this.updatePropertiesPanel( layerId );
		if ( !fromCanvas && this.editor.canvasManager ) {
			this.editor.canvasManager.selectLayer( layerId, true );
		}
	};

	LayerPanel.prototype.toggleLayerVisibility = function ( layerId ) {
		var layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.visible = !( layer.visible !== false );
			if ( this.editor.canvasManager ) {
				const layers = this.editor.stateManager ? this.editor.stateManager.get( 'layers' ) || [] : [];
				this.editor.canvasManager.renderLayers( layers );
			}
			this.renderLayerList();
			this.updateCodePanel();
			this.editor.saveState( layer.visible ? 'Show Layer' : 'Hide Layer' );
		}
	};

	LayerPanel.prototype.toggleLayerLock = function ( layerId ) {
		var layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.locked = !layer.locked;
			this.renderLayerList();
			this.editor.saveState( layer.locked ? 'Lock Layer' : 'Unlock Layer' );
		}
	};

	LayerPanel.prototype.deleteLayer = function ( layerId ) {
		var self = this;
		var t = this.msg.bind( this );
		var confirmMessage = t( 'layers-delete-confirm', 'Are you sure you want to delete this layer?' );
		if ( window.OO && window.OO.ui && window.OO.ui.confirm ) {
			OO.ui.confirm( confirmMessage ).done( function ( userConfirmed ) {
				if ( userConfirmed ) {
					self.editor.removeLayer( layerId );
					self.renderLayerList();
					self.updateCodePanel();
					if ( self.selectedLayerId === layerId ) {
						self.selectedLayerId = null;
						self.updatePropertiesPanel( null );
					}
					self.editor.saveState( 'Delete Layer' );
				}
			} );
		} else {
			// Fallback confirmation for environments without OO.ui
			if ( this.simpleConfirm( confirmMessage ) ) {
				this.editor.removeLayer( layerId );
				this.renderLayerList();
				this.updateCodePanel();
				if ( this.selectedLayerId === layerId ) {
					this.selectedLayerId = null;
				}
				this.updatePropertiesPanel( null );
				this.editor.saveState( 'Delete Layer' );
			}
		}
	};

	LayerPanel.prototype.editLayerName = function ( layerId, nameElement ) {
		var self = this;
		var originalName = nameElement.textContent;
		var maxLength = 100;
		nameElement.addEventListener( 'input', function () {
			var currentText = nameElement.textContent;
			if ( currentText.length > maxLength ) {
				nameElement.textContent = currentText.slice( 0, maxLength );
				var range = document.createRange();
				var sel = window.getSelection();
				range.selectNodeContents( nameElement );
				range.collapse( false );
				sel.removeAllRanges();
				sel.addRange( range );
			}
		} );
		nameElement.addEventListener( 'blur', function () {
			var newName = nameElement.textContent.trim();
			if ( newName && newName !== originalName ) {
				self.editor.updateLayer( layerId, { name: newName } );
				self.editor.saveState( 'Rename Layer' );
			}
		} );
		nameElement.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Enter' ) {
				nameElement.blur();
			} else if ( e.key === 'Escape' ) {
				nameElement.textContent = originalName;
				nameElement.blur();
			}
		} );
	};

	LayerPanel.prototype.updatePropertiesPanel = function ( layerId ) {
		var contentDiv = this.propertiesPanel.querySelector( '.properties-content' );
		var t = this.msg.bind( this );
		if ( !layerId ) {
			while ( contentDiv.firstChild ) {
				contentDiv.removeChild( contentDiv.firstChild );
			}
			var p1 = document.createElement( 'p' );
			p1.textContent = t( 'layers-no-layer-selected', 'No layer selected' );
			contentDiv.appendChild( p1 );
			return;
		}
		var layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			while ( contentDiv.firstChild ) {
				contentDiv.removeChild( contentDiv.firstChild );
			}
			var p2 = document.createElement( 'p' );
			p2.textContent = t( 'layers-layer-not-found', 'Layer not found' );
			contentDiv.appendChild( p2 );
			return;
		}
		var form = this.createPropertiesForm( layer );
		while ( contentDiv.firstChild ) {
			contentDiv.removeChild( contentDiv.firstChild );
		}
		contentDiv.appendChild( form );
	};

	// Build properties form with sections; numeric inputs round to 0.1 and display ≤1 decimal
	LayerPanel.prototype.createPropertiesForm = function ( layer ) {
		var form = document.createElement( 'form' );
		form.className = 'layer-properties-form';
		var t = this.msg.bind( this );
		var self = this;
		var currentSectionBody = null;

		var addSection = function ( title, type ) {
			var section = document.createElement( 'div' );
			section.className = 'property-section';
			var header = document.createElement( 'div' );
			header.className = 'property-section-header';
			if ( type === 'transform' ) {
				header.classList.add( 'property-section-header--transform' );
			}
			if ( type === 'appearance' ) {
				header.classList.add( 'property-section-header--appearance' );
			}
			if ( type === 'effects' ) {
				header.classList.add( 'property-section-header--effects' );
			}
			header.textContent = title;
			currentSectionBody = document.createElement( 'div' );
			currentSectionBody.className = 'property-section-body';
			section.appendChild( header );
			section.appendChild( currentSectionBody );
			form.appendChild( section );
		};

		var addInput = function ( opts ) {
			var wrapper = document.createElement( 'div' );
			wrapper.className = opts.type === 'checkbox' ? 'property-field property-field--checkbox' : 'property-field';
			var labelEl = document.createElement( 'label' );
			labelEl.textContent = opts.label;
			var input = document.createElement( 'input' );
			input.type = opts.type || 'text';
			if ( opts.min !== undefined ) {
				input.min = String( opts.min );
			}
			if ( opts.max !== undefined ) {
				input.max = String( opts.max );
			}
			if ( opts.step !== undefined ) {
				input.step = String( opts.step );
			}
			if ( opts.decimals === 1 && input.type === 'number' && !input.step ) {
				input.step = '0.1';
			}
			if ( opts.maxLength !== undefined && input.type === 'text' ) {
				input.maxLength = opts.maxLength;
			}
			input.value = ( opts.value !== undefined && opts.value !== null ) ? String( opts.value ) : '';
			
			// Set appropriate width for different input types
			if ( input.type === 'number' ) {
				input.style.width = '80px'; // Narrower for number inputs
			} else if ( input.type === 'text' && opts.prop !== 'text' ) {
				input.style.width = '120px'; // Moderate width for short text
			} else {
				input.style.width = '100%'; // Full width for long text content
			}
			
			if ( opts.prop ) {
				input.setAttribute( 'data-prop', String( opts.prop ) );
			}
			if ( opts.decimals === 1 ) {
				input.setAttribute( 'data-decimals', '1' );
			}
			var lastValidValue = input.value;
			var errorIndicator = document.createElement( 'span' );
			errorIndicator.className = 'property-field-error';
			var formatOneDecimal = function ( num ) {
				if ( typeof num !== 'number' || isNaN( num ) ) {
					return '';
				}
				var isInt = Math.abs( num - Math.round( num ) ) < 1e-9;
				return isInt ? String( Math.round( num ) ) : num.toFixed( 1 );
			};
			var validateInput = function ( value, showError ) {
				var isValid = true;
				var errorMessage = '';
				if ( input.type === 'number' ) {
					var num = parseFloat( value );
					if ( value.trim() === '' ) {
						isValid = false;
						errorMessage = 'This field is required';
					}
					else if ( isNaN( num ) ) {
						isValid = false;
						errorMessage = 'Please enter a valid number';
					}
					else if ( opts.min !== undefined && num < parseFloat( opts.min ) ) {
						isValid = false;
						errorMessage = 'Value must be at least ' + opts.min;
					}
					else if ( opts.max !== undefined && num > parseFloat( opts.max ) ) {
						isValid = false;
						errorMessage = 'Value must be at most ' + opts.max;
					}
				} else if ( input.type === 'text' ) {
					var textLength = value.length;
					var maxLength = opts.maxLength || 1000;
					var warnLength = Math.floor( maxLength * 0.95 );
					if ( textLength > maxLength ) {
						isValid = false;
						errorMessage = 'Text is too long. Maximum ' + maxLength + ' characters allowed.';
					}
					else if ( textLength > warnLength && showError ) {
						errorIndicator.textContent = 'Approaching character limit (' + textLength + '/' + maxLength + ')';
						errorIndicator.classList.add( 'show', 'warning' );
						input.classList.add( 'warning' );
						input.classList.remove( 'error' );
						return true;
					}
				}
				if ( isValid ) {
					input.classList.remove( 'error', 'warning' );
					errorIndicator.classList.remove( 'show', 'warning' );
					lastValidValue = value;
				} else if ( showError ) {
					input.classList.add( 'error' );
					input.classList.remove( 'warning' );
					errorIndicator.classList.remove( 'warning' );
					errorIndicator.textContent = errorMessage;
					errorIndicator.classList.add( 'show' );
				}
				return isValid;
			};
			var safeOnChange = function ( value ) {
				try {
					if ( typeof opts.onChange === 'function' ) {
						// Call onChange synchronously to ensure proper state updates
						// Removed setTimeout wrapper that was causing async corruption
						opts.onChange( value );
					}
				} catch ( error ) {
					// Log error but don't re-throw to prevent breaking the UI
					if ( window.mw && window.mw.log ) {
						mw.log.error( 'LayerPanel: Error in onChange handler:', error );
					} else if ( self && typeof self.logError === 'function' ) {
						self.logError( 'LayerPanel: Error in onChange handler:', error );
					}
					// Try to show user-friendly error
					if ( window.mw && window.mw.notify ) {
						mw.notify( 'Error updating layer property', { type: 'error' } );
					}
				}
			};
			input.addEventListener( 'input', function () {
				try {
					var value = input.value;
					var showWarnings = input.type === 'text';
					var valid = validateInput( value, showWarnings );
					if ( input.type === 'number' ) {
						var n = parseFloat( value );
						if ( !isNaN( n ) ) {
							if ( opts.min !== undefined ) {
								n = Math.max( n, parseFloat( opts.min ) );
							}
							if ( opts.max !== undefined ) {
								n = Math.min( n, parseFloat( opts.max ) );
							}
							if ( opts.decimals === 1 ) {
								n = Math.round( n * 10 ) / 10;
								var isInteger = Math.abs( n - Math.round( n ) ) < 1e-9;
								var s = isInteger ? String( Math.round( n ) ) : n.toFixed( 1 );
								if ( input.value !== s ) {
									input.value = s;
								}
							}
							lastValidValue = input.value;
							if ( valid ) {
								safeOnChange( n );
							}
						}
					} else if ( input.type === 'text' && valid ) {
						safeOnChange( value );
					}
				} catch ( error ) {
					if ( window.mw && window.mw.log ) {
						mw.log.error( 'LayerPanel: Error in input event handler:', error );
					} else if ( self && typeof self.logError === 'function' ) {
						self.logError( 'LayerPanel: Error in input event handler:', error );
					}
				}
			} );
			input.addEventListener( 'change', function () {
				try {
					var value = input.value;
					var isValid = validateInput( value, true );
					if ( isValid ) {
						if ( input.type === 'number' && opts.decimals === 1 ) {
							var n = parseFloat( value );
							if ( !isNaN( n ) ) {
								var rounded = Math.round( n * 10 ) / 10;
								input.value = formatOneDecimal( rounded );
								safeOnChange( rounded );
							}
						} else if ( input.type === 'number' ) {
							var num = parseFloat( value );
							if ( !isNaN( num ) ) {
								if ( opts.min !== undefined ) {
									num = Math.max( num, parseFloat( opts.min ) );
								}
								if ( opts.max !== undefined ) {
									num = Math.min( num, parseFloat( opts.max ) );
								}
								input.value = String( num );
								safeOnChange( num );
							}
						} else if ( input.type === 'checkbox' ) {
							safeOnChange( input.checked );
						} else {
							safeOnChange( value );
						}
						lastValidValue = input.value;
					} else {
						setTimeout( function () {
							input.value = lastValidValue;
							validateInput( lastValidValue, false );
						}, 100 );
					}
				} catch ( error ) {
					if ( window.mw && window.mw.log ) {
						mw.log.error( 'LayerPanel: Error in change event handler:', error );
					} else if ( self && typeof self.logError === 'function' ) {
						self.logError( 'LayerPanel: Error in change event handler:', error );
					}
				}
			} );
			input.addEventListener( 'blur', function () {
				try {
					var value = input.value;
					var isValid = validateInput( value, true );
					if ( !isValid ) {
						input.value = lastValidValue;
						validateInput( lastValidValue, false );
					} else if ( input.type === 'number' && opts.decimals === 1 ) {
						var n = parseFloat( value );
						if ( !isNaN( n ) ) {
							var rounded = Math.round( n * 10 ) / 10;
							input.value = formatOneDecimal( rounded );
							lastValidValue = input.value;
						}
					}
				} catch ( error ) {
					if ( window.mw && window.mw.log ) {
						mw.log.error( 'LayerPanel: Error in blur event handler:', error );
					} else if ( self && typeof self.logError === 'function' ) {
						self.logError( 'LayerPanel: Error in blur event handler:', error );
					}
				}
			} );
			if ( input.type === 'checkbox' ) {
				input.checked = !!opts.value;
			}
			wrapper.appendChild( labelEl );
			wrapper.appendChild( input );
			wrapper.appendChild( errorIndicator );
			( currentSectionBody || form ).appendChild( wrapper );
			return input;
		};

		var addSelect = function ( opts ) {
			var wrapper = document.createElement( 'div' );
			wrapper.className = 'property-field';
			var labelEl = document.createElement( 'label' );
			labelEl.textContent = opts.label;
			var select = document.createElement( 'select' );
			( opts.options || [] ).forEach( function ( o ) {
				var opt = document.createElement( 'option' );
				opt.value = o.value;
				opt.textContent = o.text;
				if ( o.value === opts.value ) {
					opt.selected = true;
				}
				select.appendChild( opt );
			} );
			select.addEventListener( 'change', function () {
				opts.onChange( select.value );
			} );
			wrapper.appendChild( labelEl );
			wrapper.appendChild( select );
			( currentSectionBody || form ).appendChild( wrapper );
			return select;
		};

		var addColorPicker = function ( opts ) {
			var colorPickerStrings = {
				title: t( 'layers-color-picker-title', 'Choose color' ),
				standard: t( 'layers-color-picker-standard', 'Standard colors' ),
				saved: t( 'layers-color-picker-saved', 'Saved colors' ),
				customSection: t( 'layers-color-picker-custom-section', 'Custom color' ),
				none: t( 'layers-color-picker-none', 'No fill (transparent)' ),
				emptySlot: t( 'layers-color-picker-empty-slot', 'Empty slot - colors will be saved here automatically' ),
				cancel: t( 'layers-color-picker-cancel', 'Cancel' ),
				apply: t( 'layers-color-picker-apply', 'Apply' ),
				transparent: t( 'layers-color-picker-transparent', 'Transparent' ),
				swatchTemplate: t( 'layers-color-picker-color-swatch', 'Set color to $1' ),
				previewTemplate: t( 'layers-color-picker-color-preview', 'Current color: $1' )
			};
			var formatTemplate = function ( template, value ) {
				if ( typeof template !== 'string' ) {
					return value;
				}
				return template.indexOf( '$1' ) !== -1 ? template.replace( '$1', value ) : template + ' ' + value;
			};
			var wrapper = document.createElement( 'div' );
			wrapper.className = 'property-field property-field--color';
			var labelEl = document.createElement( 'label' );
			labelEl.textContent = opts.label;
			var colorButton = document.createElement( 'button' );
			colorButton.type = 'button';
			colorButton.className = 'color-display-button';
			colorButton.style.width = '30px';
			colorButton.style.height = '30px';
			colorButton.style.border = '1px solid #ccc';
			colorButton.style.borderRadius = '4px';
			colorButton.style.cursor = 'pointer';
			colorButton.style.marginLeft = '8px';
			colorButton.setAttribute( 'aria-haspopup', 'dialog' );
			colorButton.setAttribute( 'aria-expanded', 'false' );
			colorButton.setAttribute( 'aria-label', formatTemplate( colorPickerStrings.previewTemplate, colorPickerStrings.transparent ) );
			var updateColorDisplay = function ( color ) {
				var labelValue = color;
				if ( !color || color === 'none' || color === 'transparent' ) {
					colorButton.style.background = 'repeating-linear-gradient(45deg, #ff0000 0, #ff0000 4px, transparent 4px, transparent 8px)';
					labelValue = colorPickerStrings.transparent;
				} else {
					colorButton.style.background = color;
				}
				colorButton.title = labelValue;
				colorButton.setAttribute( 'aria-label', formatTemplate( colorPickerStrings.previewTemplate, labelValue ) );
			};
			updateColorDisplay( opts.value );
			var createColorPickerDialog = function () {
				var buttonRect = colorButton.getBoundingClientRect();
				var previouslyFocused = document.activeElement;
				var overlay = document.createElement( 'div' );
				overlay.className = 'color-picker-overlay';
				overlay.setAttribute( 'role', 'presentation' );
				overlay.setAttribute( 'aria-hidden', 'true' );
				var dialog = document.createElement( 'div' );
				dialog.className = 'color-picker-dialog';
				dialog.setAttribute( 'role', 'dialog' );
				dialog.setAttribute( 'aria-modal', 'true' );
				dialog.setAttribute( 'tabindex', '-1' );
				var dialogTop = buttonRect.bottom + 5;
				var dialogLeft = buttonRect.left;
				var maxTop = window.innerHeight - 420;
				var maxLeft = window.innerWidth - 300;
				if ( dialogTop > maxTop ) {
					dialogTop = buttonRect.top - 420 - 5;
				}
				if ( dialogLeft > maxLeft ) {
					dialogLeft = maxLeft;
				}
				if ( dialogLeft < 10 ) {
					dialogLeft = 10;
				}
				if ( dialogTop < 10 ) {
					dialogTop = 10;
				}
				dialog.style.top = Math.floor( dialogTop ) + 'px';
				dialog.style.left = Math.floor( dialogLeft ) + 'px';
				var dialogId = 'layers-color-picker-' + Math.random().toString( 36 ).slice( 2 );
				var title = document.createElement( 'h3' );
				title.className = 'color-picker-title';
				title.id = dialogId + '-title';
				title.textContent = colorPickerStrings.title;
				dialog.setAttribute( 'aria-labelledby', title.id );
				dialog.appendChild( title );
				var paletteContainer = document.createElement( 'div' );
				paletteContainer.className = 'color-picker-section';
				var paletteTitle = document.createElement( 'div' );
				paletteTitle.className = 'color-picker-section-title';
				paletteTitle.id = dialogId + '-standard';
				paletteTitle.textContent = colorPickerStrings.standard;
				dialog.setAttribute( 'aria-describedby', paletteTitle.id );
				paletteContainer.appendChild( paletteTitle );
				var paletteGrid = document.createElement( 'div' );
				paletteGrid.className = 'color-picker-grid';
				var standardColors = [ '#000000', '#404040', '#808080', '#c0c0c0', '#ffffff', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#ff4500', '#ffa500', '#ffff00', '#adff2f', '#00ff7f', '#00bfff', '#1e90ff', '#9370db', '#ff69b4', '#ffdab9', '#f0e68c', '#e0ffff', '#ffe4e1', '#dcdcdc', '#a9a9a9' ];
				var selectedColor = opts.value === 'none' ? 'none' : ( opts.value || '#000000' );
				var selectedButton = null;
				var updateSelection = function ( button ) {
					if ( selectedButton ) {
						selectedButton.classList.remove( 'selected' );
					}
					if ( button ) {
						button.classList.add( 'selected' );
						selectedButton = button;
					}
				};
				var noneButton = document.createElement( 'button' );
				noneButton.type = 'button';
				noneButton.className = 'color-picker-none-btn';
				noneButton.title = colorPickerStrings.none;
				noneButton.setAttribute( 'aria-label', colorPickerStrings.none );
				noneButton.addEventListener( 'click', function () {
					selectedColor = 'none';
					updateSelection( noneButton );
				} );
				paletteGrid.appendChild( noneButton );
				standardColors.forEach( function ( color ) {
					var colorBtn = document.createElement( 'button' );
					colorBtn.type = 'button';
					colorBtn.className = 'color-picker-swatch-btn';
					colorBtn.style.backgroundColor = color;
					colorBtn.title = color;
					colorBtn.setAttribute( 'aria-label', formatTemplate( colorPickerStrings.swatchTemplate, color ) );
					colorBtn.addEventListener( 'click', function () {
						selectedColor = color;
						updateSelection( colorBtn );
					} );
					paletteGrid.appendChild( colorBtn );
				} );
				paletteContainer.appendChild( paletteGrid );
				dialog.appendChild( paletteContainer );
				var customContainer = document.createElement( 'div' );
				customContainer.className = 'color-picker-section';
				var customTitle = document.createElement( 'div' );
				customTitle.className = 'color-picker-section-title';
				customTitle.textContent = colorPickerStrings.saved;
				customContainer.appendChild( customTitle );
				var customGrid = document.createElement( 'div' ); customGrid.className = 'color-picker-grid';
				var savedCustomColors = JSON.parse( localStorage.getItem( 'layers-custom-colors' ) || '[]' );
				var createCustomButtonClickHandler = function ( button ) {
					return function () {
						selectedColor = button.style.backgroundColor;
						updateSelection( button );
					};
				};
				for ( var i = 0; i < 16; i++ ) {
					var customBtn = document.createElement( 'button' );
					customBtn.type = 'button';
					customBtn.className = 'color-picker-swatch-btn';
					customBtn.dataset.slot = i;
					if ( savedCustomColors[ i ] ) {
						customBtn.style.backgroundColor = savedCustomColors[ i ];
						customBtn.title = savedCustomColors[ i ];
						customBtn.setAttribute( 'aria-label', formatTemplate( colorPickerStrings.swatchTemplate, savedCustomColors[ i ] ) );
						customBtn.addEventListener( 'click', createCustomButtonClickHandler( customBtn ) );
					} else {
						customBtn.style.backgroundColor = '#f5f5f5';
						customBtn.title = colorPickerStrings.emptySlot;
						customBtn.setAttribute( 'aria-label', colorPickerStrings.emptySlot );
					}
					customGrid.appendChild( customBtn );
				}
				customContainer.appendChild( customGrid );
				dialog.appendChild( customContainer );
				var customSection = document.createElement( 'div' );
				customSection.className = 'color-picker-section';
				var customLabel = document.createElement( 'div' );
				customLabel.className = 'color-picker-section-title';
				customLabel.textContent = colorPickerStrings.customSection;
				customSection.appendChild( customLabel );
				var customInput = document.createElement( 'input' );
				customInput.type = 'color';
				customInput.className = 'color-picker-custom-input';
				customInput.setAttribute( 'aria-label', colorPickerStrings.customSection );
				customInput.addEventListener( 'change', function () {
					selectedColor = customInput.value;
				} );
				customSection.appendChild( customInput );
				dialog.appendChild( customSection );
				if ( selectedColor === 'none' ) { updateSelection( noneButton ); }
				var buttonContainer = document.createElement( 'div' );
				buttonContainer.className = 'color-picker-actions';
				var cancelBtn = document.createElement( 'button' );
				cancelBtn.type = 'button';
				cancelBtn.className = 'color-picker-btn color-picker-btn--secondary';
				cancelBtn.textContent = colorPickerStrings.cancel;
				var escapeHandler = null;
				var focusTrapHandler = null;
				var focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
				var cleanup = function () {
					if ( escapeHandler ) {
						document.removeEventListener( 'keydown', escapeHandler );
						escapeHandler = null;
					}
					if ( focusTrapHandler ) {
						dialog.removeEventListener( 'keydown', focusTrapHandler );
						focusTrapHandler = null;
					}
					if ( overlay && overlay.parentNode ) {
						overlay.parentNode.removeChild( overlay );
					}
					if ( dialog && dialog.parentNode ) {
						dialog.parentNode.removeChild( dialog );
					}
					colorButton.setAttribute( 'aria-expanded', 'false' );
					if ( previouslyFocused && typeof previouslyFocused.focus === 'function' ) {
						previouslyFocused.focus();
					}
					if ( self && Array.isArray( self.dialogCleanups ) ) {
						self.dialogCleanups = self.dialogCleanups.filter( function ( fn ) {
							return fn !== cleanup;
						} );
					}
				};
				self.registerDialogCleanup( cleanup );
				cancelBtn.addEventListener( 'click', function () {
					cleanup();
				} );
				var okBtn = document.createElement( 'button' );
				okBtn.type = 'button';
				okBtn.className = 'color-picker-btn color-picker-btn--primary';
				okBtn.textContent = colorPickerStrings.apply;
				okBtn.addEventListener( 'click', function () {
					if ( selectedColor !== 'none' && selectedColor !== opts.value ) {
						var customColors = JSON.parse( localStorage.getItem( 'layers-custom-colors' ) || '[]' );
						
						if ( customColors.indexOf( selectedColor ) === -1 ) {
							customColors.unshift( selectedColor );
							customColors = customColors.slice( 0, 16 );
							localStorage.setItem( 'layers-custom-colors', JSON.stringify( customColors ) );
						}
					}
					opts.onChange( selectedColor );
					updateColorDisplay( selectedColor );
					cleanup();
				} );
				buttonContainer.appendChild( cancelBtn );
				buttonContainer.appendChild( okBtn );
				dialog.appendChild( buttonContainer );
				overlay.addEventListener( 'click', function ( e ) {
					if ( e.target === overlay ) {
						cleanup();
					}
				} );
				escapeHandler = function ( e ) {
					if ( e.key === 'Escape' ) {
						cleanup();
					}
				};
				document.addEventListener( 'keydown', escapeHandler );
				focusTrapHandler = function ( e ) {
					if ( e.key !== 'Tab' ) {
						return;
					}
					var focusable = dialog.querySelectorAll( focusableSelector );
					if ( !focusable.length ) {
						return;
					}
					var first = focusable[ 0 ];
					var last = focusable[ focusable.length - 1 ];
					if ( e.shiftKey && document.activeElement === first ) {
						e.preventDefault();
						last.focus();
					} else if ( !e.shiftKey && document.activeElement === last ) {
						e.preventDefault();
						first.focus();
					}
				};
				dialog.addEventListener( 'keydown', focusTrapHandler );
				var focusInitial = function () {
					var focusable = dialog.querySelectorAll( focusableSelector );
					if ( focusable.length ) {
						focusable[ 0 ].focus();
					} else {
						dialog.focus();
					}
				};
				return { overlay: overlay, dialog: dialog, cleanup: cleanup, focusInitial: focusInitial };
			};
			colorButton.addEventListener( 'click', function () {
				var components = createColorPickerDialog();
				document.body.appendChild( components.overlay );
				document.body.appendChild( components.dialog );
				colorButton.setAttribute( 'aria-expanded', 'true' );
				components.focusInitial();
			} );
			wrapper.appendChild( labelEl ); wrapper.appendChild( colorButton ); ( currentSectionBody || form ).appendChild( wrapper );
			return colorButton;
		};

		var addCheckbox = function ( opts ) {
			var wrapper = document.createElement( 'div' ); wrapper.className = 'property-field property-field--checkbox';
			var labelEl = document.createElement( 'label' ); labelEl.textContent = opts.label;
			var input = document.createElement( 'input' ); input.type = 'checkbox'; input.checked = !!opts.value;
			input.addEventListener( 'change', function () { opts.onChange( input.checked ); } );
			wrapper.appendChild( labelEl );
			wrapper.appendChild( input );
			( currentSectionBody || form ).appendChild( wrapper );
			return input;
		};

		var addSliderInput = function ( opts ) {
			var wrapper = document.createElement( 'div' ); wrapper.className = 'property-field property-field--compound';
			var labelEl = document.createElement( 'label' ); labelEl.textContent = opts.label;
			var controls = document.createElement( 'div' ); controls.className = 'compact-controls';
			var numberInput = document.createElement( 'input' );
			numberInput.type = 'number';
			numberInput.className = 'compact-number';
			numberInput.min = String( opts.min || 0 );
			numberInput.max = String( opts.max || 100 );
			numberInput.step = String( opts.step || 1 );
			numberInput.value = String( opts.value || 0 );
			var rangeInput = document.createElement( 'input' );
			rangeInput.type = 'range';
			rangeInput.className = 'compact-range';
			rangeInput.min = String( opts.min || 0 );
			rangeInput.max = String( opts.max || 100 );
			rangeInput.step = String( opts.step || 1 );
			rangeInput.value = String( opts.value || 0 );
			var updateValue = function ( value ) {
				var num = parseFloat( value );
				
				if ( !isNaN( num ) ) {
					num = Math.max( opts.min || 0, Math.min( opts.max || 100, num ) );
					
					if ( ( parseFloat( opts.step || 1 ) ) < 1 ) {
						num = Math.round( num * 10 ) / 10;
						var isInt2 = Math.abs( num - Math.round( num ) ) < 1e-9;
						numberInput.value = isInt2 ? String( Math.round( num ) ) : num.toFixed( 1 );
					} else {
						numberInput.value = String( num );
					}
					rangeInput.value = String( num );
					opts.onChange( num );
				}
			};
			numberInput.addEventListener( 'input', function () { updateValue( numberInput.value ); } );
			rangeInput.addEventListener( 'input', function () { updateValue( rangeInput.value ); } );
			controls.appendChild( numberInput );
			controls.appendChild( rangeInput );
			wrapper.appendChild( labelEl );
			wrapper.appendChild( controls );
			( currentSectionBody || form ).appendChild( wrapper );
			return { number: numberInput, range: rangeInput };
		};

		// Transform - Position should be integers (no decimals)
		addSection( t( 'layers-section-transform', 'Transform' ), 'transform' );
		addInput( { label: t( 'layers-prop-x', 'X' ), type: 'number', value: Math.round( layer.x || 0 ), step: 1, prop: 'x', onChange: function ( v ) { self.editor.updateLayer( layer.id, { x: Math.round( parseFloat( v ) ) } ); } } );
		addInput( { label: t( 'layers-prop-y', 'Y' ), type: 'number', value: Math.round( layer.y || 0 ), step: 1, prop: 'y', onChange: function ( v ) { self.editor.updateLayer( layer.id, { y: Math.round( parseFloat( v ) ) } ); } } );
		addInput( { label: t( 'layers-prop-rotation', 'Rotation' ), type: 'number', value: Math.round( layer.rotation || 0 ), step: 1, prop: 'rotation', onChange: function ( v ) { self.editor.updateLayer( layer.id, { rotation: Math.round( parseFloat( v ) ) } ); } } );

		// Size/geometry by type
		var LAYER_TYPES = window.LayersConstants ? window.LayersConstants.LAYER_TYPES : {};
		var DEFAULTS = window.LayersConstants ? window.LayersConstants.DEFAULTS : {};
		var LIMITS = window.LayersConstants ? window.LayersConstants.LIMITS : {};
		switch ( layer.type ) {
			case ( LAYER_TYPES.RECTANGLE || 'rectangle' ):
				addInput( { label: t( 'layers-prop-width', 'Width' ), type: 'number', value: Math.round( layer.width || 0 ), step: 1, prop: 'width', onChange: function ( v ) { self.editor.updateLayer( layer.id, { width: Math.round( parseFloat( v ) ) } ); } } );
				addInput( { label: t( 'layers-prop-height', 'Height' ), type: 'number', value: Math.round( layer.height || 0 ), step: 1, prop: 'height', onChange: function ( v ) { self.editor.updateLayer( layer.id, { height: Math.round( parseFloat( v ) ) } ); } } );
				break;
			case ( LAYER_TYPES.CIRCLE || 'circle' ):
				addInput( { label: t( 'layers-prop-radius', 'Radius' ), type: 'number', value: Math.round( layer.radius || DEFAULTS.RADIUS || 50 ), step: 1, prop: 'radius', onChange: function ( v ) { self.editor.updateLayer( layer.id, { radius: Math.round( parseFloat( v ) ) } ); } } );
				break;
			case ( LAYER_TYPES.ELLIPSE || 'ellipse' ):
				addInput( { label: t( 'layers-prop-width', 'Width' ), type: 'number', value: layer.width || ( ( layer.radiusX || 0 ) * 2 ), step: 1, prop: 'width', onChange: function ( v ) { var valX = parseFloat( v ); self.editor.updateLayer( layer.id, { width: valX, radiusX: valX / 2 } ); } } );
				addInput( { label: t( 'layers-prop-height', 'Height' ), type: 'number', value: layer.height || ( ( layer.radiusY || 0 ) * 2 ), step: 1, prop: 'height', onChange: function ( v ) { var valY = parseFloat( v ); self.editor.updateLayer( layer.id, { height: valY, radiusY: valY / 2 } ); } } );
				break;
			case ( LAYER_TYPES.POLYGON || 'polygon' ):
				addInput( {
					label: t( 'layers-prop-sides', 'Sides' ),
					type: 'number',
					value: layer.sides || DEFAULTS.POLYGON_SIDES || 6,
					min: LIMITS.MIN_POLYGON_SIDES || 3,
					max: LIMITS.MAX_POLYGON_SIDES || 20,
					step: 1,
					prop: 'sides',
					onChange: function ( v ) {
						var minSides = LIMITS.MIN_POLYGON_SIDES || 3;
						var sidesVal = Math.max( minSides, parseInt( v, 10 ) || 6 );
						self.editor.updateLayer( layer.id, { sides: sidesVal } );
					}
				} );
				addInput( { label: t( 'layers-prop-radius', 'Radius' ), type: 'number', value: layer.radius || DEFAULTS.RADIUS || 50, step: 1, prop: 'radius', onChange: function ( v ) { self.editor.updateLayer( layer.id, { radius: parseFloat( v ) } ); } } );
				break;
			case ( LAYER_TYPES.STAR || 'star' ):
				addInput( {
					label: t( 'layers-prop-points', 'Points' ),
					type: 'number',
					value: layer.points || DEFAULTS.STAR_POINTS || 5,
					min: LIMITS.MIN_STAR_POINTS || 3,
					max: LIMITS.MAX_STAR_POINTS || 20,
					step: 1,
					prop: 'points',
					onChange: function ( v ) {
						var minPoints = LIMITS.MIN_STAR_POINTS || 3;
						var ptsVal = Math.max( minPoints, parseInt( v, 10 ) || 5 );
						self.editor.updateLayer( layer.id, { points: ptsVal } );
					}
				} );
				addInput( { label: t( 'layers-prop-outer-radius', 'Outer Radius' ), type: 'number', value: layer.outerRadius || layer.radius || 50, step: 1, prop: 'outerRadius', onChange: function ( v ) { self.editor.updateLayer( layer.id, { outerRadius: parseFloat( v ) } ); } } );
				addInput( { label: t( 'layers-prop-inner-radius', 'Inner Radius' ), type: 'number', value: layer.innerRadius || ( ( layer.outerRadius || 50 ) * 0.5 ), step: 1, prop: 'innerRadius', onChange: function ( v ) { self.editor.updateLayer( layer.id, { innerRadius: parseFloat( v ) } ); } } );
				break;
			case ( LAYER_TYPES.LINE || 'line' ):
				addInput( { label: 'x1', type: 'number', value: layer.x1 || 0, step: 1, prop: 'x1', onChange: function ( v ) { self.editor.updateLayer( layer.id, { x1: parseFloat( v ) } ); } } );
				addInput( { label: 'y1', type: 'number', value: layer.y1 || 0, step: 1, prop: 'y1', onChange: function ( v ) { self.editor.updateLayer( layer.id, { y1: parseFloat( v ) } ); } } );
				addInput( { label: 'x2', type: 'number', value: layer.x2 || 0, step: 1, prop: 'x2', onChange: function ( v ) { self.editor.updateLayer( layer.id, { x2: parseFloat( v ) } ); } } );
				addInput( { label: 'y2', type: 'number', value: layer.y2 || 0, step: 1, prop: 'y2', onChange: function ( v ) { self.editor.updateLayer( layer.id, { y2: parseFloat( v ) } ); } } );
				break;
			case ( LAYER_TYPES.ARROW || 'arrow' ):
				addInput( { label: 'x1', type: 'number', value: layer.x1 || 0, step: 1, prop: 'x1', onChange: function ( v ) { self.editor.updateLayer( layer.id, { x1: parseFloat( v ) } ); } } );
				addInput( { label: 'y1', type: 'number', value: layer.y1 || 0, step: 1, prop: 'y1', onChange: function ( v ) { self.editor.updateLayer( layer.id, { y1: parseFloat( v ) } ); } } );
				addInput( { label: 'x2', type: 'number', value: layer.x2 || 0, step: 1, prop: 'x2', onChange: function ( v ) { self.editor.updateLayer( layer.id, { x2: parseFloat( v ) } ); } } );
				addInput( { label: 'y2', type: 'number', value: layer.y2 || 0, step: 1, prop: 'y2', onChange: function ( v ) { self.editor.updateLayer( layer.id, { y2: parseFloat( v ) } ); } } );
				addInput( { label: t( 'layers-prop-arrow-size', 'Arrow Size' ), type: 'number', value: layer.arrowSize || 10, step: 1, onChange: function ( v ) { self.editor.updateLayer( layer.id, { arrowSize: parseFloat( v ) } ); } } );
				addSelect( { label: t( 'layers-prop-arrow-style', 'Arrow Style' ), value: layer.arrowStyle || 'single', options: [ { value: 'single', text: t( 'layers-arrow-single', 'Single' ) }, { value: 'double', text: t( 'layers-arrow-double', 'Double' ) }, { value: 'none', text: t( 'layers-arrow-none', 'Line only' ) } ], onChange: function ( v ) { self.editor.updateLayer( layer.id, { arrowStyle: v } ); } } );
				break;
			case 'text':
				addInput( { label: t( 'layers-prop-text', 'Text' ), type: 'text', value: layer.text || '', maxLength: 1000, onChange: function ( v ) { self.editor.updateLayer( layer.id, { text: v } ); } } );
				addInput( { label: t( 'layers-prop-font-size', 'Font Size' ), type: 'number', value: layer.fontSize || 16, min: 6, max: 1000, step: 1, prop: 'fontSize', onChange: function ( v ) { var fs = Math.max( 6, Math.min( 1000, parseInt( v, 10 ) ) ); self.editor.updateLayer( layer.id, { fontSize: fs } ); } } );
				// FIX 2025-11-14: Increased max from 10 to 200 to match shape stroke width
			addInput( { label: t( 'layers-prop-stroke-width', 'Text Stroke Width' ), type: 'number', value: layer.textStrokeWidth || 0, min: 0, max: 200, step: 1, onChange: function ( v ) { self.editor.updateLayer( layer.id, { textStrokeWidth: parseInt( v, 10 ) } ); } } );
				addColorPicker( { label: t( 'layers-prop-stroke-color', 'Text Stroke Color' ), value: layer.textStrokeColor || '#000000', property: 'textStrokeColor', onChange: function ( newColor ) { self.editor.updateLayer( layer.id, { textStrokeColor: newColor } ); } } );
				break;
			case 'highlight':
				addInput( { label: t( 'layers-prop-width', 'Width' ), type: 'number', value: layer.width || 0, step: 1, decimals: 1, prop: 'width', onChange: function ( v ) { self.editor.updateLayer( layer.id, { width: parseFloat( v ) } ); } } );
				addInput( { label: t( 'layers-prop-height', 'Height' ), type: 'number', value: layer.height || 0, step: 1, decimals: 1, prop: 'height', onChange: function ( v ) { self.editor.updateLayer( layer.id, { height: parseFloat( v ) } ); } } );
				break;
			case 'blur':
				addInput( { label: t( 'layers-prop-width', 'Width' ), type: 'number', value: layer.width || 0, step: 1, decimals: 1, prop: 'width', onChange: function ( v ) { self.editor.updateLayer( layer.id, { width: parseFloat( v ) } ); } } );
				addInput( { label: t( 'layers-prop-height', 'Height' ), type: 'number', value: layer.height || 0, step: 1, decimals: 1, prop: 'height', onChange: function ( v ) { self.editor.updateLayer( layer.id, { height: parseFloat( v ) } ); } } );
				addInput( { label: t( 'layers-prop-blur-radius', 'Blur Radius' ), type: 'number', value: layer.blurRadius || 12, min: 1, max: 64, step: 1, onChange: function ( v ) { var br = Math.max( 1, Math.min( 64, parseInt( v, 10 ) || 12 ) ); self.editor.updateLayer( layer.id, { blurRadius: br } ); } } );
				break;
		}

		// Appearance
		addSection( t( 'layers-section-appearance', 'Appearance' ), 'appearance' );
		if ( layer.type !== 'text' ) {
			addColorPicker( { label: t( 'layers-prop-stroke-color', 'Stroke Color' ), value: layer.stroke, property: 'stroke', onChange: function ( newColor ) { self.editor.updateLayer( layer.id, { stroke: newColor } ); } } );
			addInput( { label: t( 'layers-prop-stroke-width', 'Stroke Width' ), type: 'number', value: layer.strokeWidth || 1, min: 0, max: 200, step: 1, onChange: function ( v ) { var val = Math.max( 0, Math.min( 200, parseInt( v, 10 ) ) ); self.editor.updateLayer( layer.id, { strokeWidth: val } ); } } );
		}
		addSliderInput( { label: t( 'layers-prop-stroke-opacity', 'Stroke Opacity' ), value: ( layer.strokeOpacity != null ) ? Math.round( layer.strokeOpacity * 100 ) : 100, min: 0, max: 100, step: 1, onChange: function ( v ) { self.editor.updateLayer( layer.id, { strokeOpacity: v / 100 } ); } } );
		addColorPicker( { label: t( 'layers-prop-fill-color', 'Fill Color' ), value: layer.fill, property: 'fill', onChange: function ( newColor ) { self.editor.updateLayer( layer.id, { fill: newColor } ); } } );
		addSliderInput( { label: t( 'layers-prop-fill-opacity', 'Fill Opacity' ), value: ( layer.fillOpacity != null ) ? Math.round( layer.fillOpacity * 100 ) : 100, min: 0, max: 100, step: 1, onChange: function ( v ) { self.editor.updateLayer( layer.id, { fillOpacity: v / 100 } ); } } );

		// Effects
		addSection( t( 'layers-section-effects', 'Effects' ), 'effects' );
		var layerOpacityValue = ( layer.opacity != null ) ? layer.opacity : 1; layerOpacityValue = Math.round( layerOpacityValue * 100 );
		addSliderInput( { label: t( 'layers-prop-opacity', 'Layer Opacity' ), value: layerOpacityValue, min: 0, max: 100, step: 1, onChange: function ( v ) { self.editor.updateLayer( layer.id, { opacity: v / 100 } ); } } );
		addSelect( { label: t( 'layers-prop-blend', 'Blend' ), value: layer.blend || 'normal', options: [
			{ value: 'normal', text: t( 'layers-blend-normal', 'Normal' ) },
			{ value: 'multiply', text: t( 'layers-blend-multiply', 'Multiply' ) },
			{ value: 'screen', text: t( 'layers-blend-screen', 'Screen' ) },
			{ value: 'overlay', text: t( 'layers-blend-overlay', 'Overlay' ) },
			{ value: 'soft-light', text: t( 'layers-blend-soft-light', 'Soft Light' ) },
			{ value: 'hard-light', text: t( 'layers-blend-hard-light', 'Hard Light' ) },
			{ value: 'color-dodge', text: t( 'layers-blend-color-dodge', 'Color Dodge' ) },
			{ value: 'color-burn', text: t( 'layers-blend-color-burn', 'Color Burn' ) },
			{ value: 'darken', text: t( 'layers-blend-darken', 'Darken' ) },
			{ value: 'lighten', text: t( 'layers-blend-lighten', 'Lighten' ) },
			{ value: 'difference', text: t( 'layers-blend-difference', 'Difference' ) },
			{ value: 'exclusion', text: t( 'layers-blend-exclusion', 'Exclusion' ) }
		], onChange: function ( v ) { self.editor.updateLayer( layer.id, { blend: v } ); } } );
		addCheckbox( { label: t( 'layers-effect-shadow', 'Drop Shadow' ), value: !!layer.shadow, onChange: function ( checked ) {
			var updates = { shadow: !!checked };
			if ( checked ) {
				if ( !layer.shadowColor ) { updates.shadowColor = '#000000'; }
				if ( typeof layer.shadowBlur === 'undefined' ) { updates.shadowBlur = 8; }
				if ( typeof layer.shadowOffsetX === 'undefined' ) { updates.shadowOffsetX = 2; }
				if ( typeof layer.shadowOffsetY === 'undefined' ) { updates.shadowOffsetY = 2; }
			}
			self.editor.updateLayer( layer.id, updates );
		} } );
		addInput( { label: t( 'layers-effect-shadow-color', 'Shadow Color' ), type: 'color', value: layer.shadowColor || '#000000', onChange: function ( v ) { self.editor.updateLayer( layer.id, { shadowColor: v } ); } } );
		addInput( { label: t( 'layers-effect-shadow-blur', 'Shadow Size' ), type: 'number', value: layer.shadowBlur || 8, min: 0, max: 64, step: 1, onChange: function ( v ) { var s = Math.max( 0, Math.min( 64, parseInt( v, 10 ) || 0 ) ); self.editor.updateLayer( layer.id, { shadowBlur: s } ); } } );
		addInput( { label: t( 'layers-effect-shadow-spread', 'Shadow Spread' ), type: 'number', value: layer.shadowSpread || 0, min: 0, max: 64, step: 1, onChange: function ( v ) { var sp = Math.max( 0, parseInt( v, 10 ) || 0 ); self.editor.updateLayer( layer.id, { shadowSpread: sp } ); } } );
		addInput( { label: t( 'layers-effect-shadow-offset-x', 'Shadow Offset X' ), type: 'number', value: layer.shadowOffsetX || 2, step: 1, onChange: function ( v ) { self.editor.updateLayer( layer.id, { shadowOffsetX: parseInt( v, 10 ) } ); } } );
		addInput( { label: t( 'layers-effect-shadow-offset-y', 'Shadow Offset Y' ), type: 'number', value: layer.shadowOffsetY || 2, step: 1, onChange: function ( v ) { self.editor.updateLayer( layer.id, { shadowOffsetY: parseInt( v, 10 ) } ); } } );

		return form;
	};

	// Live sync selected layer's transform props into current form inputs
	LayerPanel.prototype.syncPropertiesFromLayer = function ( layer ) {
		if ( !layer || !this.propertiesPanel ) {
			return;
		}
		var root = this.propertiesPanel.querySelector( '.layer-properties-form' ) || this.propertiesPanel;
		var inputs = root.querySelectorAll( 'input[data-prop]' );
		var formatOne = function ( n, decimalsAttr ) {
			if ( typeof n !== 'number' || isNaN( n ) ) {
				return '';
			}
			if ( String( decimalsAttr ) === '1' ) { var r = Math.round( n * 10 ) / 10; var isInt = Math.abs( r - Math.round( r ) ) < 1e-9; return isInt ? String( Math.round( r ) ) : r.toFixed( 1 ); }
			return String( n );
		};
		inputs.forEach( function ( input ) {
			var prop = input.getAttribute( 'data-prop' );
			if ( !prop ) {
				return;
			}
			if ( document.activeElement === input ) {
				return;
			}
			var val;
			if ( prop === 'width' && ( layer.type === 'ellipse' ) ) { val = ( layer.width != null ) ? layer.width : ( ( layer.radiusX || 0 ) * 2 ); }
			else if ( prop === 'height' && ( layer.type === 'ellipse' ) ) { val = ( layer.height != null ) ? layer.height : ( ( layer.radiusY || 0 ) * 2 ); }
			else { val = layer[ prop ]; }
			if ( typeof val === 'number' ) { var formatted = formatOne( val, input.getAttribute( 'data-decimals' ) ); if ( input.value !== formatted ) { input.value = formatted; } }
		} );
	};

	LayerPanel.prototype.setupDragAndDrop = function () {
		var self = this;
		if ( !this.layerList ) {
			return;
		}
		this.addTargetListener( this.layerList, 'dragstart', function ( e ) {
			var li = e.target.closest( '.layer-item' );
			if ( li ) { e.dataTransfer.setData( 'text/plain', li.dataset.layerId ); li.classList.add( 'dragging' ); }
		} );
		this.addTargetListener( this.layerList, 'dragend', function ( e ) { var li = e.target.closest( '.layer-item' ); if ( li ) { li.classList.remove( 'dragging' ); } } );
		this.addTargetListener( this.layerList, 'dragover', function ( e ) { e.preventDefault(); } );
		this.addTargetListener( this.layerList, 'drop', function ( e ) {
			e.preventDefault();
			var draggedId = e.dataTransfer.getData( 'text/plain' );
			var targetItem = e.target.closest( '.layer-item' );
			if ( targetItem && draggedId && draggedId !== targetItem.dataset.layerId ) { self.reorderLayers( draggedId, targetItem.dataset.layerId ); }
		} );
	};

	LayerPanel.prototype.reorderLayers = function ( draggedId, targetId ) {
		var layers = this.editor.stateManager ? this.editor.stateManager.get( 'layers' ) || [] : this.layers || [];
		var draggedIndex = -1;
		var targetIndex = -1;
		var i;
		for ( i = 0; i < layers.length; i++ ) {
			if ( layers[ i ].id === draggedId ) {
				draggedIndex = i;
				break;
			}
		}
		for ( i = 0; i < layers.length; i++ ) {
			if ( layers[ i ].id === targetId ) {
				targetIndex = i;
				break;
			}
		}
		if ( draggedIndex !== -1 && targetIndex !== -1 ) {
			var draggedLayer = layers.splice( draggedIndex, 1 )[ 0 ];
			layers.splice( targetIndex, 0, draggedLayer );
			if ( this.editor.stateManager ) {
				this.editor.stateManager.set( 'layers', layers );
			} else {
				this.layers = layers;
				this.editor.layers = layers;
			}
			if ( this.editor.canvasManager ) {
				// Redraw canvas to reflect new layer order
				this.editor.canvasManager.redraw();
			}
			this.renderLayerList();
			this.editor.saveState( 'Reorder Layers' );
		}
	};

	/**
	 * Simple confirmation dialog fallback
	 * @param {string} message - The confirmation message
	 * @return {boolean} - User's choice
	 */
	LayerPanel.prototype.simpleConfirm = function ( message ) {
		if ( typeof window !== 'undefined' && typeof window.confirm === 'function' ) {
			return window.confirm( message );
		}
		if ( typeof this.logWarn === 'function' ) {
			this.logWarn( 'Confirmation dialog unavailable; auto-confirming action', message );
		}
		return true;
	};

	// Pure renderer for Wikitext code so LayersEditor can embed it in the footer
	LayerPanel.prototype.renderCodeSnippet = function ( layers ) {
		var t = this.msg.bind( this );
		var list = Array.isArray( layers ) ? layers : ( this.editor.stateManager ? this.editor.stateManager.get( 'layers' ) || [] : this.layers || [] );
		var visibleLayers = list.filter( function ( layer ) { return layer.visible !== false; } );
		var filename = this.editor && this.editor.filename ? this.editor.filename : 'YourImage.jpg';
		var codeHtml = '';
		if ( visibleLayers.length === 0 ) {
			codeHtml = '<p><strong>' + t( 'layers-code-none', 'No layers visible.' ) + '</strong> ' + t( 'layers-code-enable', 'Enable layers to see the code.' ) + '</p>';
		} else if ( visibleLayers.length === list.length ) {
			codeHtml = '<p><strong>' + t( 'layers-code-all-visible', 'All layers visible:' ) + '</strong></p>' +
				'<code class="layers-code">[[File:' + filename + '|500px|layers=all|' + t( 'layers-code-caption', 'Your caption' ) + ']]</code>' +
				'<button class="copy-btn" data-code="layers=all">' + t( 'layers-code-copy', 'Copy' ) + '</button>';
		} else {
			var layerIds = visibleLayers.map( function ( layer ) { return layer.id || ( 'layer_' + Math.random().toString( 36 ).slice( 2, 6 ) ); } );
			var layersParam = layerIds.join( ',' );
			codeHtml = '<p><strong>' + t( 'layers-code-selected-visible', 'Selected layers visible:' ) + '</strong></p>' +
				'<code class="layers-code">[[File:' + filename + '|500px|layers=' + layersParam + '|' + t( 'layers-code-caption', 'Your caption' ) + ']]</code>' +
				'<button class="copy-btn" data-code="layers=' + layersParam + '">' + t( 'layers-code-copy', 'Copy' ) + '</button>';
		}
		return codeHtml;
	};

	// Export LayerPanel
	window.LayerPanel = LayerPanel;
}());
