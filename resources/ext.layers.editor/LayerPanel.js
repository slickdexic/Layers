/**
 * Layer Panel for Layers Editor
 * Manages the layer list, visibility, and layer properties
 */
( function () {
	'use strict';

	function layersMsgDefault( k, d ) {
		return d;
	}

	/**
	 * LayerPanel class
	 *
	 * @class
	 * @param {Object} config Configuration object
	 * @param {HTMLElement} config.container The container element for the panel
	 * @param {window.LayersEditor} config.editor A reference to the main editor instance
	 */
	function LayerPanel( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.editor = this.config.editor;
		this.inspectorContainer = this.config.inspectorContainer || null;
		this.layers = [];
		this.selectedLayerId = null;

		this.init();
	}

	LayerPanel.prototype.init = function () {
		this.createInterface();
		this.setupEventHandlers();
	};

	// Resolve i18n text with a whitelist of known keys to avoid dynamic mw.message usage
	LayerPanel.prototype.msg = function ( key, fallback ) {
		function pick( txt, fb ) {
			if ( txt && txt.indexOf && txt.indexOf( '⧼' ) === -1 ) {
				return txt;
			}
			return fb;
		}
		switch ( key ) {
			case 'layers-panel-title':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-panel-title' ).text() : null, fallback );
			case 'layers-panel-subtitle':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-panel-subtitle' ).text() : null, fallback );
			case 'layers-empty':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-empty' ).text() : null, fallback );
			case 'layers-properties-title':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-properties-title' ).text() : null, fallback );
			case 'layers-code-title':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-code-title' ).text() : null, fallback );
			case 'layers-delete-confirm':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-delete-confirm' ).text() : null, fallback );
			case 'layers-no-layer-selected':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-no-layer-selected' ).text() : null, fallback );
			case 'layers-layer-not-found':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-layer-not-found' ).text() : null, fallback );
			case 'layers-section-transform':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-section-transform' ).text() : null, fallback );
			case 'layers-prop-x':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-x' ).text() : null, fallback );
			case 'layers-prop-y':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-y' ).text() : null, fallback );
			case 'layers-prop-rotation':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-rotation' ).text() : null, fallback );
			case 'layers-prop-width':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-width' ).text() : null, fallback );
			case 'layers-prop-height':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-height' ).text() : null, fallback );
			case 'layers-prop-radius':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-radius' ).text() : null, fallback );
			case 'layers-prop-sides':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-sides' ).text() : null, fallback );
			case 'layers-prop-points':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-points' ).text() : null, fallback );
			case 'layers-prop-outer-radius':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-outer-radius' ).text() : null, fallback );
			case 'layers-prop-inner-radius':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-inner-radius' ).text() : null, fallback );
			case 'layers-prop-text':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-text' ).text() : null, fallback );
			case 'layers-prop-font-size':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-font-size' ).text() : null, fallback );
			case 'layers-prop-arrow-size':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-arrow-size' ).text() : null, fallback );
			case 'layers-prop-arrow-style':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-arrow-style' ).text() : null, fallback );
			case 'layers-arrow-single':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-arrow-single' ).text() : null, fallback );
			case 'layers-arrow-double':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-arrow-double' ).text() : null, fallback );
			case 'layers-arrow-none':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-arrow-none' ).text() : null, fallback );
			case 'layers-section-appearance':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-section-appearance' ).text() : null, fallback );
			case 'layers-prop-stroke-color':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-stroke-color' ).text() : null, fallback );
			case 'layers-prop-stroke-width':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-stroke-width' ).text() : null, fallback );
			case 'layers-prop-stroke-opacity':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-stroke-opacity' ).text() : null, fallback );
			case 'layers-prop-fill-color':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-fill-color' ).text() : null, fallback );
			case 'layers-prop-fill-opacity':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-fill-opacity' ).text() : null, fallback );
			case 'layers-section-effects':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-section-effects' ).text() : null, fallback );
			case 'layers-prop-opacity':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-opacity' ).text() : null, fallback );
			case 'layers-prop-blend':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-prop-blend' ).text() : null, fallback );
			case 'layers-blend-normal':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-normal' ).text() : null, fallback );
			case 'layers-blend-multiply':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-multiply' ).text() : null, fallback );
			case 'layers-blend-screen':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-screen' ).text() : null, fallback );
			case 'layers-blend-overlay':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-overlay' ).text() : null, fallback );
			case 'layers-blend-soft-light':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-soft-light' ).text() : null, fallback );
			case 'layers-blend-hard-light':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-hard-light' ).text() : null, fallback );
			case 'layers-blend-color-dodge':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-color-dodge' ).text() : null, fallback );
			case 'layers-blend-color-burn':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-color-burn' ).text() : null, fallback );
			case 'layers-blend-darken':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-darken' ).text() : null, fallback );
			case 'layers-blend-lighten':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-lighten' ).text() : null, fallback );
			case 'layers-blend-difference':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-difference' ).text() : null, fallback );
			case 'layers-blend-exclusion':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-blend-exclusion' ).text() : null, fallback );
			case 'layers-effect-shadow':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-effect-shadow' ).text() : null, fallback );
			case 'layers-effect-shadow-color':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-effect-shadow-color' ).text() : null, fallback );
			case 'layers-effect-shadow-blur':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-effect-shadow-blur' ).text() : null, fallback );
			case 'layers-effect-shadow-spread':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-effect-shadow-spread' ).text() : null, fallback );
			case 'layers-effect-shadow-offset-x':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-effect-shadow-offset-x' ).text() : null, fallback );
			case 'layers-effect-shadow-offset-y':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-effect-shadow-offset-y' ).text() : null, fallback );
			case 'layers-code-none':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-code-none' ).text() : null, fallback );
			case 'layers-code-enable':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-code-enable' ).text() : null, fallback );
			case 'layers-code-all-visible':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-code-all-visible' ).text() : null, fallback );
			case 'layers-code-caption':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-code-caption' ).text() : null, fallback );
			case 'layers-code-copy':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-code-copy' ).text() : null, fallback );
			case 'layers-code-selected-visible':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-code-selected-visible' ).text() : null, fallback );
			case 'layers-code-copied':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-code-copied' ).text() : null, fallback );
			case 'layers-code-copy-failed':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-code-copy-failed' ).text() : null, fallback );
			default:
				return fallback;
		}
	};

	LayerPanel.prototype.createInterface = function () {
		this.container.innerHTML = '';
		this.container.setAttribute( 'role', 'region' );
		var msgFunction = this.msg ? this.msg.bind( this ) : function ( k, d ) {
			return d;
		};
		this.container.setAttribute( 'aria-label', msgFunction( 'layers-panel-title', 'Layers' ) );

		// Create header
		var header = document.createElement( 'div' );
		header.className = 'layers-panel-header';
		var title = document.createElement( 'h3' );
		title.className = 'layers-panel-title';
		title.textContent = msgFunction( 'layers-panel-title', 'Layers' );
		header.appendChild( title );
		var subtitle = document.createElement( 'div' );
		subtitle.className = 'layers-panel-subtitle';
		subtitle.textContent = msgFunction( 'layers-panel-subtitle', 'Drag to reorder • Click name to rename' );
		header.appendChild( subtitle );
		this.container.appendChild( header );

		// Create sidebar inner container for resizable layout
		var sidebarInner = document.createElement( 'div' );
		sidebarInner.className = 'layers-panel-inner';
		sidebarInner.style.display = 'flex';
		sidebarInner.style.flexDirection = 'column';
		sidebarInner.style.height = '100%';

		// Create layer list container
		this.layerList = document.createElement( 'div' );
		this.layerList.className = 'layers-list';
		this.layerList.setAttribute( 'role', 'listbox' );
		this.layerList.setAttribute( 'aria-label', msgFunction( 'layers-panel-title', 'Layers' ) );
		var emptyState = document.createElement( 'div' );
		emptyState.className = 'layers-empty';
		emptyState.textContent = msgFunction( 'layers-empty', 'No layers yet. Choose a tool to begin.' );
		this.layerList.appendChild( emptyState );

		// Divider
		var divider = document.createElement( 'div' );
		divider.className = 'layers-panel-divider';
		divider.setAttribute( 'tabindex', '0' );
		divider.setAttribute( 'role', 'separator' );
		divider.setAttribute( 'aria-orientation', 'horizontal' );
		divider.title = msgFunction( 'layers-panel-divider', 'Drag to resize panels' );

		// Create properties and code panels
		this.propertiesPanel = document.createElement( 'div' );
		this.propertiesPanel.className = 'layers-properties';
		this.propertiesPanel.setAttribute( 'role', 'region' );
		this.propertiesPanel.setAttribute( 'aria-label', msgFunction( 'layers-properties-title', 'Properties' ) );
		this.propertiesPanel.innerHTML = '<h4>' + msgFunction( 'layers-properties-title', 'Properties' ) + '</h4><div class="properties-content"></div>';

		this.codePanel = document.createElement( 'div' );
		this.codePanel.className = 'layers-code-panel';
		this.codePanel.setAttribute( 'role', 'region' );
		this.codePanel.setAttribute( 'aria-label', msgFunction( 'layers-code-title', 'Wikitext Code' ) );
		this.codePanel.innerHTML = '<h4>' + msgFunction( 'layers-code-title', 'Wikitext Code' ) + '</h4><div class="code-content"></div>';

		// Compose sidebar
		sidebarInner.appendChild( this.layerList );
		sidebarInner.appendChild( divider );
		sidebarInner.appendChild( this.propertiesPanel );
		this.container.appendChild( header );
		this.container.appendChild( sidebarInner );
		this.container.appendChild( this.codePanel );
		this.updateCodePanel();

		// Resizable divider logic
		var isDragging = false;
		var minListHeight = 60;
		var minPropsHeight = 80;
		divider.addEventListener( 'mousedown', function () {
			isDragging = true;
			document.body.style.cursor = 'row-resize';
			document.body.style.userSelect = 'none';
		} );
		document.addEventListener( 'mousemove', function ( e ) {
			if ( !isDragging ) {
				return;
			}
			var rect = sidebarInner.getBoundingClientRect();
			var offset = e.clientY - rect.top;
			var totalHeight = sidebarInner.offsetHeight;
			var newListHeight = offset;
			var newPropsHeight = totalHeight - offset - divider.offsetHeight;
			if ( newListHeight < minListHeight || newPropsHeight < minPropsHeight ) {
				return;
			}
			// Set heights
			sidebarInner.childNodes[ 0 ].style.flex = 'none';
			sidebarInner.childNodes[ 0 ].style.height = newListHeight + 'px';
			sidebarInner.childNodes[ 2 ].style.flex = 'none';
			sidebarInner.childNodes[ 2 ].style.height = newPropsHeight + 'px';
		} );
		document.addEventListener( 'mouseup', function () {
			if ( isDragging ) {
				isDragging = false;
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			}
		} );
		// Touch support
		divider.addEventListener( 'touchstart', function () {
			isDragging = true;
			document.body.style.cursor = 'row-resize';
			document.body.style.userSelect = 'none';
		} );
		document.addEventListener( 'touchmove', function ( e ) {
			if ( !isDragging ) {
				return;
			}
			var rect = sidebarInner.getBoundingClientRect();
			var offset = e.touches[ 0 ].clientY - rect.top;
			var totalHeight = sidebarInner.offsetHeight;
			var newListHeight = offset;
			var newPropsHeight = totalHeight - offset - divider.offsetHeight;
			if ( newListHeight < minListHeight || newPropsHeight < minPropsHeight ) {
				return;
			}
			sidebarInner.childNodes[ 0 ].style.flex = 'none';
			sidebarInner.childNodes[ 0 ].style.height = newListHeight + 'px';
			sidebarInner.childNodes[ 2 ].style.flex = 'none';
			sidebarInner.childNodes[ 2 ].style.height = newPropsHeight + 'px';
		}, { passive: false } );
		document.addEventListener( 'touchend', function () {
			if ( isDragging ) {
				isDragging = false;
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			}
		} );
	};

	LayerPanel.prototype.setupEventHandlers = function () {
		var self = this;

		// Layer list interactions
		this.layerList.addEventListener( 'click', function ( e ) {
			self.handleLayerListClick( e );
		} );

		// Drag and drop for reordering
		this.setupDragAndDrop();
	};

	LayerPanel.prototype.updateLayers = function ( layers ) {
		this.layers = layers || [];
		this.renderLayerList();
		this.updateCodePanel();
	};

	LayerPanel.prototype.renderLayerList = function () {
		this.layerList.innerHTML = '';
		var t = this.msg.bind( this );

		this.layers.forEach( function ( layer, index ) {
			var layerItem = this.createLayerItem( layer, index );
			this.layerList.appendChild( layerItem );
		}.bind( this ) );

		if ( this.layers.length === 0 ) {
			var empty = document.createElement( 'div' );
			empty.className = 'layers-empty';
			empty.textContent = t( 'layers-empty', 'No layers yet. Choose a tool to begin.' );
			this.layerList.appendChild( empty );
		}
	};

	LayerPanel.prototype.createLayerItem = function ( layer, index ) {
		var item = document.createElement( 'div' );
		item.className = 'layer-item';
		item.dataset.layerId = layer.id;
		item.dataset.index = index;
		var t = this.msg.bind( this );

		if ( layer.id === this.selectedLayerId ) {
			item.classList.add( 'selected' );
		}

		// Add a wide grab area for layer selection/move, larger and accessible
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
		grabArea.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="7" r="2.5" fill="#bbb"/><circle cx="17" cy="7" r="2.5" fill="#bbb"/><circle cx="7" cy="17" r="2.5" fill="#bbb"/><circle cx="17" cy="17" r="2.5" fill="#bbb"/></svg>';

		// Visibility toggle (SVG eye icon, larger, accessible)
		var visibilityBtn = document.createElement( 'button' );
		visibilityBtn.className = 'layer-visibility';
		visibilityBtn.innerHTML = layer.visible !== false ? '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="7" fill="none" stroke="#666" stroke-width="2.5"/><circle cx="12" cy="12" r="3.5" fill="#666"/></svg>' : '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="7" fill="none" stroke="#aaa" stroke-width="2.5"/><line x1="5" y1="21" x2="21" y2="5" stroke="#c00" stroke-width="2.5"/></svg>';
		visibilityBtn.title = t( 'layers-toggle-visibility', 'Toggle visibility' );
		visibilityBtn.type = 'button';
		visibilityBtn.setAttribute( 'aria-label', t( 'layers-toggle-visibility', 'Toggle visibility' ) );
		visibilityBtn.style.width = '36px';
		visibilityBtn.style.height = '36px';

		// Layer name
		var name = document.createElement( 'span' );
		name.className = 'layer-name';
		name.textContent = layer.name || this.getDefaultLayerName( layer );
		name.contentEditable = true;

		// Lock toggle (SVG padlock, larger, accessible)
		var lockBtn = document.createElement( 'button' );
		lockBtn.className = 'layer-lock';
		lockBtn.innerHTML = layer.locked ? '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="8" rx="3" fill="#eee" stroke="#666" stroke-width="2"/><rect x="10" y="16" width="4" height="3" rx="1.5" fill="#bbb"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#666" stroke-width="2"/></svg>' : '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="8" rx="3" fill="#fff" stroke="#aaa" stroke-width="2"/><rect x="10" y="16" width="4" height="3" rx="1.5" fill="#ccc"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#aaa" stroke-width="2"/></svg>';
		lockBtn.title = t( 'layers-toggle-lock', 'Toggle lock' );
		lockBtn.type = 'button';
		lockBtn.setAttribute( 'aria-label', t( 'layers-toggle-lock', 'Toggle lock' ) );
		lockBtn.style.width = '36px';
		lockBtn.style.height = '36px';

		// Delete button (SVG trash can, larger, accessible)
		var deleteBtn = document.createElement( 'button' );
		deleteBtn.className = 'layer-delete';
		deleteBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="8" rx="2.5" fill="#fff" stroke="#c00" stroke-width="2"/><rect x="10" y="5" width="4" height="3" rx="1.5" fill="#c00"/><line x1="9" y1="13" x2="15" y2="19" stroke="#c00" stroke-width="1.8"/><line x1="15" y1="13" x2="9" y2="19" stroke="#c00" stroke-width="1.8"/></svg>';
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
		var t;
		if ( this.msg && this.msg.bind ) {
			t = this.msg.bind( this );
		} else {
			t = layersMsgDefault;
		}
		switch ( layer.type ) {
			case 'text': {
				var prefix = ( window.mw ? t( 'layers-default-text-prefix', 'Text: ' ) : 'Text: ' );
				var emptyText = ( window.mw ? t( 'layers-default-empty', 'Empty' ) : 'Empty' );
				return prefix + ( ( layer.text || emptyText ).slice( 0, 20 ) );
			}
			case 'rectangle':
				return ( window.mw ? t( 'layers-type-rectangle', 'Rectangle' ) : 'Rectangle' );
			case 'blur':
				return ( window.mw ? t( 'layers-type-blur', 'Blur/Redaction' ) : 'Blur/Redaction' );
			case 'circle':
				return ( window.mw ? t( 'layers-type-circle', 'Circle' ) : 'Circle' );
			case 'ellipse':
				return ( window.mw ? t( 'layers-type-ellipse', 'Ellipse' ) : 'Ellipse' );
			case 'polygon':
				return ( window.mw ? t( 'layers-type-polygon', 'Polygon' ) : 'Polygon' );
			case 'star':
				return ( window.mw ? t( 'layers-type-star', 'Star' ) : 'Star' );
			case 'arrow':
				return ( window.mw ? t( 'layers-type-arrow', 'Arrow' ) : 'Arrow' );
			case 'line':
				return ( window.mw ? t( 'layers-type-line', 'Line' ) : 'Line' );
			case 'path':
				return ( window.mw ? t( 'layers-type-path', 'Drawing' ) : 'Drawing' );
			case 'highlight':
				return ( window.mw ? t( 'layers-type-highlight', 'Highlight' ) : 'Highlight' );
			default:
				return ( window.mw ? t( 'layers-type-layer', 'Layer' ) : 'Layer' );
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

		if ( target.classList.contains( 'layer-visibility' ) ) {
			this.toggleLayerVisibility( layerId );
		} else if ( target.classList.contains( 'layer-lock' ) ) {
			this.toggleLayerLock( layerId );
		} else if ( target.classList.contains( 'layer-delete' ) ) {
			this.deleteLayer( layerId );
		} else if ( target.classList.contains( 'layer-name' ) ) {
			this.editLayerName( layerId, target );
		} else {
			this.selectLayer( layerId );
		}
	};

	LayerPanel.prototype.selectLayer = function ( layerId ) {
		this.selectedLayerId = layerId;
		this.renderLayerList();
		this.updatePropertiesPanel( layerId );

		// Notify editor of selection
		if ( this.editor.canvasManager ) {
			this.editor.canvasManager.selectLayer( layerId );
		}
	};

	LayerPanel.prototype.toggleLayerVisibility = function ( layerId ) {
		var layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.visible = !( layer.visible !== false );
			this.editor.renderLayers();
			this.renderLayerList();
			this.updateCodePanel(); // Update the code when visibility changes
		}
	};

	LayerPanel.prototype.toggleLayerLock = function ( layerId ) {
		var layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.locked = !layer.locked;
			this.renderLayerList();
		}
	};

	LayerPanel.prototype.deleteLayer = function ( layerId ) {
		// Use MediaWiki's OO.ui.confirm when available, fallback to confirm
		var t = this.msg.bind( this );
		var confirmMessage = ( window.mw ? t( 'layers-delete-confirm', 'Are you sure you want to delete this layer?' ) : 'Are you sure you want to delete this layer?' );
		if ( window.OO && window.OO.ui && window.OO.ui.confirm ) {
			OO.ui.confirm( confirmMessage ).done( function ( confirmed ) {
				if ( confirmed ) {
					this.editor.removeLayer( layerId );
					if ( this.selectedLayerId === layerId ) {
						this.selectedLayerId = null;
						this.updatePropertiesPanel( null );
					}
				}
			}.bind( this ) );
		} else {
			// Use MediaWiki's OO.ui.confirm if available, otherwise fall back to browser confirm
			var confirmResult = false;
			if ( window.OO && OO.ui && OO.ui.confirm ) {
				// Note: OO.ui.confirm is async, but we'll use sync confirm for simplicity here
				// In a real implementation, this should be refactored to handle async confirmation
				confirmResult = confirm( confirmMessage ); // eslint-disable-line no-alert
			} else {
				confirmResult = confirm( confirmMessage ); // eslint-disable-line no-alert
			}
			if ( confirmResult ) {
				this.editor.removeLayer( layerId );
				if ( this.selectedLayerId === layerId ) {
					this.selectedLayerId = null;
				}
				this.updatePropertiesPanel( null );
			}
		}
	};

	LayerPanel.prototype.editLayerName = function ( layerId, nameElement ) {
		var self = this;
		var originalName = nameElement.textContent;

		nameElement.addEventListener( 'blur', function () {
			var newName = nameElement.textContent.trim();
			if ( newName && newName !== originalName ) {
				self.editor.updateLayer( layerId, { name: newName } );
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
			contentDiv.innerHTML = '<p>' + t( 'layers-no-layer-selected', 'No layer selected' ) + '</p>';
			return;
		}

		var layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			contentDiv.innerHTML = '<p>' + t( 'layers-layer-not-found', 'Layer not found' ) + '</p>';
			return;
		}

		// Create properties form based on layer type
		var form = this.createPropertiesForm( layer );
		contentDiv.innerHTML = '';
		contentDiv.appendChild( form );
	};

	LayerPanel.prototype.createPropertiesForm = function ( layer ) {
		var form = document.createElement( 'form' );
		form.className = 'layer-properties-form';
		var t = this.msg.bind( this );

		// Helpers
		var self = this;
		var addSection = function ( title ) {
			var h = document.createElement( 'h5' );
			h.textContent = title;
			form.appendChild( h );
		};
		var addInput = function ( opts ) {
			var wrapper = document.createElement( 'div' );
			wrapper.className = 'property-field';
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
			if ( opts.decimals === 1 && input.type === 'number' && input.step === '' ) {
				input.step = '0.1';
			}
			input.value = ( opts.value !== undefined && opts.value !== null ) ? opts.value : '';
			input.addEventListener( 'change', function () {
				opts.onChange( input.value );
			} );
			if ( opts.decimals === 1 && input.type === 'number' ) {
				input.addEventListener( 'blur', function () {
					var n = parseFloat( input.value );
					if ( !isNaN( n ) ) {
						input.value = n.toFixed( 1 );
					}
				} );
			}
			wrapper.appendChild( labelEl );
			wrapper.appendChild( input );
			form.appendChild( wrapper );
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
			form.appendChild( wrapper );
			return select;
		};
		var addCheckbox = function ( opts ) {
			var wrapper = document.createElement( 'div' );
			wrapper.className = 'property-field';
			var labelEl = document.createElement( 'label' );
			labelEl.textContent = opts.label;
			var input = document.createElement( 'input' );
			input.type = 'checkbox';
			input.checked = !!opts.value;
			input.addEventListener( 'change', function () {
				opts.onChange( input.checked );
			} );
			wrapper.appendChild( labelEl );
			wrapper.appendChild( input );
			form.appendChild( wrapper );
			return input;
		};

		// Transform
		addSection( t( 'layers-section-transform', 'Transform' ) );
		addInput( {
			label: t( 'layers-prop-x', 'X' ),
			type: 'number',
			value: layer.x || 0,
			step: 1,
			decimals: 1,
			onChange: function ( v ) {
				self.editor.updateLayer( layer.id, { x: parseFloat( v ) } );
			}
		} );
		addInput( {
			label: t( 'layers-prop-y', 'Y' ),
			type: 'number',
			value: layer.y || 0,
			step: 1,
			decimals: 1,
			onChange: function ( v ) {
				self.editor.updateLayer( layer.id, { y: parseFloat( v ) } );
			}
		} );
		addInput( {
			label: t( 'layers-prop-rotation', 'Rotation' ),
			type: 'number',
			value: layer.rotation || 0,
			step: 1,
			decimals: 1,
			onChange: function ( v ) {
				self.editor.updateLayer( layer.id, { rotation: parseFloat( v ) } );
			}
		} );

		// Size/geometry per type
		switch ( layer.type ) {
			case 'rectangle':
				addInput( {
					label: t( 'layers-prop-width', 'Width' ),
					type: 'number',
					value: layer.width || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { width: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-height', 'Height' ),
					type: 'number',
					value: layer.height || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { height: parseFloat( v ) } );
					}
				} );
				break;
			case 'circle':
				addInput( {
					label: t( 'layers-prop-radius', 'Radius' ),
					type: 'number',
					value: layer.radius || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { radius: parseFloat( v ) } );
					}
				} );
				break;
			case 'ellipse':
				addInput( {
					label: t( 'layers-prop-width', 'Width' ),
					type: 'number',
					value: layer.width || ( ( layer.radiusX || 0 ) * 2 ),
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						var valX = parseFloat( v );
						self.editor.updateLayer( layer.id, { width: valX, radiusX: valX / 2 } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-height', 'Height' ),
					type: 'number',
					value: layer.height || ( ( layer.radiusY || 0 ) * 2 ),
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						var valY = parseFloat( v );
						self.editor.updateLayer( layer.id, { height: valY, radiusY: valY / 2 } );
					}
				} );
				break;
			case 'polygon':
				addInput( {
					label: t( 'layers-prop-sides', 'Sides' ),
					type: 'number',
					value: layer.sides || 6,
					min: 3,
					step: 1,
					onChange: function ( v ) {
						var sidesVal = Math.max( 3, parseInt( v, 10 ) || 6 );
						self.editor.updateLayer( layer.id, { sides: sidesVal } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-radius', 'Radius' ),
					type: 'number',
					value: layer.radius || 50,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { radius: parseFloat( v ) } );
					}
				} );
				break;
			case 'star':
				addInput( {
					label: t( 'layers-prop-points', 'Points' ),
					type: 'number',
					value: layer.points || 5,
					min: 3,
					step: 1,
					onChange: function ( v ) {
						var ptsVal = Math.max( 3, parseInt( v, 10 ) || 5 );
						self.editor.updateLayer( layer.id, { points: ptsVal } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-outer-radius', 'Outer Radius' ),
					type: 'number',
					value: layer.outerRadius || layer.radius || 50,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { outerRadius: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-inner-radius', 'Inner Radius' ),
					type: 'number',
					value: layer.innerRadius || ( ( layer.outerRadius || 50 ) * 0.5 ),
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { innerRadius: parseFloat( v ) } );
					}
				} );
				break;
			case 'line':
				addInput( {
					label: 'x1',
					type: 'number',
					value: layer.x1 || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { x1: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: 'y1',
					type: 'number',
					value: layer.y1 || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { y1: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: 'x2',
					type: 'number',
					value: layer.x2 || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { x2: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: 'y2',
					type: 'number',
					value: layer.y2 || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { y2: parseFloat( v ) } );
					}
				} );
				break;
			case 'arrow':
				addInput( {
					label: 'x1',
					type: 'number',
					value: layer.x1 || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { x1: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: 'y1',
					type: 'number',
					value: layer.y1 || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { y1: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: 'x2',
					type: 'number',
					value: layer.x2 || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { x2: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: 'y2',
					type: 'number',
					value: layer.y2 || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { y2: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-arrow-size', 'Arrow Size' ),
					type: 'number',
					value: layer.arrowSize || 10,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { arrowSize: parseFloat( v ) } );
					}
				} );
				addSelect( {
					label: t( 'layers-prop-arrow-style', 'Arrow Style' ),
					value: layer.arrowStyle || 'single',
					options: [
						{ value: 'single', text: t( 'layers-arrow-single', 'Single' ) },
						{ value: 'double', text: t( 'layers-arrow-double', 'Double' ) },
						{ value: 'none', text: t( 'layers-arrow-none', 'Line only' ) }
					],
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { arrowStyle: v } );
					}
				} );
				break;
			case 'text':
				addInput( {
					label: t( 'layers-prop-text', 'Text' ),
					type: 'text',
					value: layer.text || '',
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { text: v } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-font-size', 'Font Size' ),
					type: 'number',
					value: layer.fontSize || 16,
					min: 1,
					step: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { fontSize: parseInt( v, 10 ) } );
					}
				} );
				// Text stroke width
				addInput( {
					label: t( 'layers-prop-stroke-width', 'Text Stroke Width' ),
					type: 'number',
					value: layer.textStrokeWidth || 0,
					min: 0,
					max: 10,
					step: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { textStrokeWidth: parseInt( v, 10 ) } );
					}
				} );
				// Text stroke color (only show if stroke width > 0)
				if ( ( layer.textStrokeWidth || 0 ) > 0 ) {
					var textStrokeColorRow = document.createElement( 'div' );
					textStrokeColorRow.className = 'property-field';
					var textStrokeLabel = document.createElement( 'label' );
					textStrokeLabel.textContent = t( 'layers-prop-stroke-color', 'Text Stroke Color' );
					var textStrokeInput = document.createElement( 'input' );
					textStrokeInput.type = 'color';
					textStrokeInput.value = layer.textStrokeColor || '#000000';
					textStrokeInput.addEventListener( 'change', function () {
						self.editor.updateLayer( layer.id, {
							textStrokeColor: textStrokeInput.value
						} );
					} );
					textStrokeColorRow.appendChild( textStrokeLabel );
					textStrokeColorRow.appendChild( textStrokeInput );
					form.appendChild( textStrokeColorRow );
				}
				break;
			case 'highlight':
				addInput( {
					label: t( 'layers-prop-width', 'Width' ),
					type: 'number',
					value: layer.width || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { width: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-height', 'Height' ),
					type: 'number',
					value: layer.height || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { height: parseFloat( v ) } );
					}
				} );
				break;
			case 'blur':
				addInput( {
					label: t( 'layers-prop-width', 'Width' ),
					type: 'number',
					value: layer.width || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { width: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-height', 'Height' ),
					type: 'number',
					value: layer.height || 0,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { height: parseFloat( v ) } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-blur-radius', 'Blur Radius' ),
					type: 'number',
					value: layer.blurRadius || 12,
					min: 1,
					max: 64,
					step: 1,
					onChange: function ( v ) {
						var br = Math.max( 1, Math.min( 64, parseInt( v, 10 ) || 12 ) );
						self.editor.updateLayer( layer.id, { blurRadius: br } );
					}
				} );
				break;
		}

		// Appearance
		addSection( t( 'layers-section-appearance', 'Appearance' ) );
		// Stroke and fill color selectors, side by side, with clear labels
		var colorRow = document.createElement( 'div' );
		colorRow.className = 'property-field property-field--compound';
		var strokeLabel = document.createElement( 'label' );
		strokeLabel.textContent = t( 'layers-prop-stroke-color', 'Stroke Color' );
		strokeLabel.setAttribute( 'for', 'stroke-color-input' );
		var strokeInput = document.createElement( 'input' );
		strokeInput.type = 'color';
		strokeInput.id = 'stroke-color-input';
		strokeInput.value = layer.stroke || '#000000';
		strokeInput.setAttribute( 'aria-label', t( 'layers-prop-stroke-color', 'Stroke Color' ) );
		strokeInput.addEventListener( 'change', function () {
			self.editor.updateLayer( layer.id, { stroke: strokeInput.value } );
		} );
		var fillLabel = document.createElement( 'label' );
		fillLabel.textContent = t( 'layers-prop-fill-color', 'Fill Color' );
		fillLabel.setAttribute( 'for', 'fill-color-input' );
		var fillInput = document.createElement( 'input' );
		fillInput.type = 'color';
		fillInput.id = 'fill-color-input';
		fillInput.value = layer.fill || '#ffffff';
		fillInput.setAttribute( 'aria-label', t( 'layers-prop-fill-color', 'Fill Color' ) );
		fillInput.addEventListener( 'change', function () {
			self.editor.updateLayer( layer.id, { fill: fillInput.value } );
		} );
		colorRow.appendChild( strokeLabel );
		colorRow.appendChild( strokeInput );
		colorRow.appendChild( fillLabel );
		colorRow.appendChild( fillInput );
		form.appendChild( colorRow );
		// Stroke width (no slider, up to 200)
		addInput( {
			label: t( 'layers-prop-stroke-width', 'Stroke Width' ),
			type: 'number',
			value: layer.strokeWidth || 1,
			min: 0,
			max: 200,
			step: 1,
			onChange: function ( v ) {
				var val = Math.max( 0, Math.min( 200, parseFloat( v ) ) );
				self.editor.updateLayer( layer.id, { strokeWidth: val } );
			}
		} );
		// Stroke opacity (number only, 0-100)
		addInput( {
			label: t( 'layers-prop-stroke-opacity', 'Stroke Opacity' ),
			type: 'number',
			value: ( layer.strokeOpacity !== null && layer.strokeOpacity !== undefined ) ?
				Math.round( layer.strokeOpacity * 100 ) :
				100,
			min: 0,
			max: 100,
			step: 1,
			onChange: function ( v ) {
				var so = Math.max( 0, Math.min( 100, parseInt( v, 10 ) || 100 ) );
				self.editor.updateLayer( layer.id, { strokeOpacity: so / 100 } );
			}
		} );
		// Fill opacity (number only, 0-100)
		addInput( {
			label: t( 'layers-prop-fill-opacity', 'Fill Opacity' ),
			type: 'number',
			value: ( layer.fillOpacity !== null && layer.fillOpacity !== undefined ) ?
				Math.round( layer.fillOpacity * 100 ) :
				100,
			min: 0,
			max: 100,
			step: 1,
			onChange: function ( v ) {
				var fo = Math.max( 0, Math.min( 100, parseInt( v, 10 ) || 100 ) );
				self.editor.updateLayer( layer.id, { fillOpacity: fo / 100 } );
			}
		} );

		// Effects (layer-level)
		addSection( t( 'layers-section-effects', 'Effects' ) );
		var layerOpacityValue = (
			layer.opacity !== null &&
			layer.opacity !== undefined
		) ? layer.opacity : 1;
		layerOpacityValue = Math.round( layerOpacityValue * 100 );
		// Layer opacity: number (0–100) only, no slider
		addInput( {
			label: t( 'layers-prop-opacity', 'Layer Opacity' ),
			type: 'number',
			value: layerOpacityValue,
			min: 0,
			max: 100,
			step: 1,
			onChange: function ( v ) {
				var val = Math.max( 0, Math.min( 100, parseInt( v, 10 ) || 0 ) );
				self.editor.updateLayer( layer.id, { opacity: val / 100 } );
			}
		} );
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

		addCheckbox( {
			label: t( 'layers-effect-shadow', 'Drop Shadow' ),
			value: !!layer.shadow,
			onChange: function ( checked ) {
				var updates = { shadow: !!checked };
				// Set default shadow properties if enabling shadow and they don't exist
				if ( checked ) {
					if ( !layer.shadowColor ) {
						updates.shadowColor = '#000000';
					}
					if ( typeof layer.shadowBlur === 'undefined' ) {
						updates.shadowBlur = 8;
					}
					if ( typeof layer.shadowOffsetX === 'undefined' ) {
						updates.shadowOffsetX = 2;
					}
					if ( typeof layer.shadowOffsetY === 'undefined' ) {
						updates.shadowOffsetY = 2;
					}
				}
				self.editor.updateLayer( layer.id, updates );
			}
		} );
		addInput( {
			label: t( 'layers-effect-shadow-color', 'Shadow Color' ),
			type: 'color',
			value: layer.shadowColor || '#000000',
			onChange: function ( v ) {
				self.editor.updateLayer( layer.id, { shadowColor: v } );
			}
		} );
		addInput( {
			label: t( 'layers-effect-shadow-blur', 'Shadow Size' ),
			type: 'number',
			value: layer.shadowBlur || 8,
			min: 0,
			max: 64,
			step: 1,
			onChange: function ( v ) {
				var s = Math.max( 0, Math.min( 64, parseInt( v, 10 ) || 0 ) );
				self.editor.updateLayer( layer.id, { shadowBlur: s } );
			}
		} );
		addInput( {
			label: t( 'layers-effect-shadow-spread', 'Shadow Spread' ),
			type: 'number',
			value: layer.shadowSpread || 0,
			min: 0,
			max: 64,
			step: 1,
			onChange: function ( v ) {
				var sp = Math.max( 0, parseInt( v, 10 ) || 0 );
				self.editor.updateLayer( layer.id, { shadowSpread: sp } );
			}
		} );
		addInput( {
			label: t( 'layers-effect-shadow-offset-x', 'Shadow Offset X' ),
			type: 'number',
			value: layer.shadowOffsetX || 2,
			step: 1,
			onChange: function ( v ) {
				self.editor.updateLayer( layer.id, { shadowOffsetX: parseFloat( v ) } );
			}
		} );
		addInput( {
			label: t( 'layers-effect-shadow-offset-y', 'Shadow Offset Y' ),
			type: 'number',
			value: layer.shadowOffsetY || 2,
			step: 1,
			onChange: function ( v ) {
				self.editor.updateLayer( layer.id, { shadowOffsetY: parseFloat( v ) } );
			}
		} );

		return form;
	};

	LayerPanel.prototype.addPropertyField = function ( form, label, type, value, onChange ) {
		var wrapper = document.createElement( 'div' );
		wrapper.className = 'property-field';

		var labelEl = document.createElement( 'label' );
		labelEl.textContent = label;

		var input = document.createElement( 'input' );
		input.type = type;
		input.value = value;
		input.addEventListener( 'change', function () {
			onChange( input.value );
		} );

		wrapper.appendChild( labelEl );
		wrapper.appendChild( input );
		form.appendChild( wrapper );
	};

	LayerPanel.prototype.addTextProperties = function () {
		// Back-compat helper; new system builds fields in createPropertiesForm
	};

	LayerPanel.prototype.addRectangleProperties = function () {};

	LayerPanel.prototype.addCircleProperties = function () {};

	LayerPanel.prototype.addBlurProperties = function () {};

	LayerPanel.prototype.setupDragAndDrop = function () {
		var self = this;

		// Enable drag and drop for layer reordering
		this.layerList.addEventListener( 'dragstart', function ( e ) {
			if ( e.target.classList.contains( 'layer-item' ) ) {
				e.dataTransfer.setData( 'text/plain', e.target.dataset.layerId );
				e.target.classList.add( 'dragging' );
			}
		} );

		this.layerList.addEventListener( 'dragend', function ( e ) {
			e.target.classList.remove( 'dragging' );
		} );

		this.layerList.addEventListener( 'dragover', function ( e ) {
			e.preventDefault();
		} );

		this.layerList.addEventListener( 'drop', function ( e ) {
			e.preventDefault();
			var draggedId = e.dataTransfer.getData( 'text/plain' );
			var targetItem = e.target.closest( '.layer-item' );

			if ( targetItem && draggedId !== targetItem.dataset.layerId ) {
				self.reorderLayers( draggedId, targetItem.dataset.layerId );
			}
		} );

		// Make layer items draggable
		this.layerList.addEventListener( 'mousedown', function ( e ) {
			var layerItem = e.target.closest( '.layer-item' );
			if ( layerItem ) {
				layerItem.draggable = true;
			}
		} );
	};

	LayerPanel.prototype.reorderLayers = function ( draggedId, targetId ) {
		var draggedIndex = -1;
		for ( var i = 0; i < this.layers.length; i++ ) {
			if ( this.layers[ i ].id === draggedId ) {
				draggedIndex = i;
				break;
			}
		}

		var targetIndex = -1;
		for ( var j = 0; j < this.layers.length; j++ ) {
			if ( this.layers[ j ].id === targetId ) {
				targetIndex = j;
				break;
			}
		}

		if ( draggedIndex !== -1 && targetIndex !== -1 ) {
			// Move layer
			var draggedLayer = this.layers.splice( draggedIndex, 1 )[ 0 ];
			this.layers.splice( targetIndex, 0, draggedLayer );

			// Update editor
			this.editor.layers = this.layers;
			this.editor.renderLayers();
			this.renderLayerList();
		}
	};

	LayerPanel.prototype.updateCodePanel = function () {
		if ( !this.codePanel ) {
			return;
		}

		var content = this.codePanel.querySelector( '.code-content' );
		if ( !content ) {
			return;
		}

		var t = this.msg.bind( this );

		// Get visible layers
		var visibleLayers = this.layers.filter( function ( layer ) {
			return layer.visible !== false;
		} );

		var filename = this.editor && this.editor.filename ? this.editor.filename : 'YourImage.jpg';
		var codeHtml = '';

		if ( visibleLayers.length === 0 ) {
			codeHtml = '<p><strong>' + t( 'layers-code-none', 'No layers visible.' ) + '</strong> ' + t( 'layers-code-enable', 'Enable layers to see the code.' ) + '</p>';
		} else if ( visibleLayers.length === this.layers.length ) {
			// All layers visible
			codeHtml = '<p><strong>' + t( 'layers-code-all-visible', 'All layers visible:' ) + '</strong></p>' +
				'<code class="layers-code">[[File:' + filename + '|500px|layers=all|' + t( 'layers-code-caption', 'Your caption' ) + ']]</code>' +
				'<button class="copy-btn" data-code="layers=all">' + t( 'layers-code-copy', 'Copy' ) + '</button>';
		} else {
			// Specific layers visible
			var layerIds = visibleLayers.map( function ( layer ) {
				return layer.id ? layer.id.slice( 0, 4 ) : 'unknown';
			} );
			var layersParam = layerIds.join( ',' );

			codeHtml = '<p><strong>' + t( 'layers-code-selected-visible', 'Selected layers visible:' ) + '</strong></p>' +
				'<code class="layers-code">[[File:' + filename + '|500px|layers=' + layersParam + '|' + t( 'layers-code-caption', 'Your caption' ) + ']]</code>' +
				'<button class="copy-btn" data-code="layers=' + layersParam + '">' + t( 'layers-code-copy', 'Copy' ) + '</button>';
		}

		content.innerHTML = codeHtml;

		// Add click handlers for copy buttons
		var copyBtns = content.querySelectorAll( '.copy-btn' );
		copyBtns.forEach( function ( btn ) {
			btn.addEventListener( 'click', function () {
				var code = btn.getAttribute( 'data-code' );

				var onSuccess = function () {
					btn.textContent = t( 'layers-code-copied', 'Copied!' );
					setTimeout( function () {
						btn.textContent = t( 'layers-code-copy', 'Copy' );
					}, 2000 );
				};
				var onFailure = function () {
					btn.textContent = t( 'layers-code-copy-failed', 'Copy failed' );
					setTimeout( function () {
						btn.textContent = t( 'layers-code-copy', 'Copy' );
					}, 2000 );
				};

				if ( navigator.clipboard && navigator.clipboard.writeText ) {
					navigator.clipboard.writeText( code ).then( onSuccess ).catch( function () {
						// Fallback to execCommand
						var ta = document.createElement( 'textarea' );
						ta.value = code;
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
					// Fallback method for older browsers
					var textArea = document.createElement( 'textarea' );
					textArea.value = code;
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
			} );
		} );
	};

	// Export LayerPanel to global scope
	window.LayerPanel = LayerPanel;

}() );
