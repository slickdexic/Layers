/**
 * Layer Panel for Layers Editor
 * Manages the layer list, visibility, and layer properties
 */
( function () {
	'use strict';

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
			case 'layers-default-text-prefix':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-default-text-prefix' ).text() : null, fallback );
			case 'layers-default-empty':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-default-empty' ).text() : null, fallback );
			case 'layers-type-rectangle':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-rectangle' ).text() : null, fallback );
			case 'layers-type-circle':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-circle' ).text() : null, fallback );
			case 'layers-type-ellipse':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-ellipse' ).text() : null, fallback );
			case 'layers-type-polygon':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-polygon' ).text() : null, fallback );
			case 'layers-type-star':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-star' ).text() : null, fallback );
			case 'layers-type-blur':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-blur' ).text() : null, fallback );
			case 'layers-type-arrow':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-arrow' ).text() : null, fallback );
			case 'layers-type-line':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-line' ).text() : null, fallback );
			case 'layers-type-path':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-path' ).text() : null, fallback );
			case 'layers-type-highlight':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-highlight' ).text() : null, fallback );
			case 'layers-type-layer':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-layer' ).text() : null, fallback );
			case 'layers-type-text':
				return pick( ( window.mw && mw.message ) ? mw.message( 'layers-type-text' ).text() : null, fallback );
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

		// Create second divider for properties/code split
		var divider2 = document.createElement( 'div' );
		divider2.className = 'layers-panel-divider';
		divider2.setAttribute( 'tabindex', '0' );
		divider2.setAttribute( 'role', 'separator' );
		divider2.setAttribute( 'aria-orientation', 'horizontal' );
		divider2.title = msgFunction( 'layers-panel-divider', 'Drag to resize panels' );

		// Compose sidebar - all panels in one container for proper flex layout
		sidebarInner.appendChild( this.layerList );
		sidebarInner.appendChild( divider );
		sidebarInner.appendChild( this.propertiesPanel );
		sidebarInner.appendChild( divider2 );
		sidebarInner.appendChild( this.codePanel );
		this.container.appendChild( header );
		this.container.appendChild( sidebarInner );
		this.updateCodePanel();

		// Resizable divider logic
		var isDragging = false;
		var isDragging2 = false;
		var minListHeight = 60;
		var minPropsHeight = 80;
		var minCodeHeight = 60;

		// First divider (between layers and properties)
		divider.addEventListener( 'mousedown', function () {
			isDragging = true;
			document.body.style.cursor = 'row-resize';
			document.body.style.userSelect = 'none';
		} );

		// Second divider (between properties and code)
		divider2.addEventListener( 'mousedown', function () {
			isDragging2 = true;
			document.body.style.cursor = 'row-resize';
			document.body.style.userSelect = 'none';
		} );

		document.addEventListener( 'mousemove', function ( e ) {
			if ( !isDragging && !isDragging2 ) {
				return;
			}

			var rect = sidebarInner.getBoundingClientRect();
			var offset = e.clientY - rect.top;
			var totalHeight = sidebarInner.offsetHeight;
			var dividerHeight = divider.offsetHeight;
			var divider2Height = divider2.offsetHeight;
			var newListHeight, newPropsHeight, newCodeHeight;

			if ( isDragging ) {
				// Dragging first divider (layers/properties)
				newListHeight = offset;
				var remainingHeight = totalHeight - newListHeight - dividerHeight - divider2Height;
				var currentCodeHeight = sidebarInner.childNodes[ 4 ].offsetHeight; // codePanel
				newPropsHeight = remainingHeight - currentCodeHeight;

				if ( newListHeight < minListHeight || newPropsHeight < minPropsHeight ) {
					return;
				}

				sidebarInner.childNodes[ 0 ].style.flex = 'none'; // layerList
				sidebarInner.childNodes[ 0 ].style.height = newListHeight + 'px';
				sidebarInner.childNodes[ 2 ].style.flex = 'none'; // propertiesPanel
				sidebarInner.childNodes[ 2 ].style.height = newPropsHeight + 'px';
			}

			if ( isDragging2 ) {
				// Dragging second divider (properties/code)
				var currentListHeight = sidebarInner.childNodes[ 0 ].offsetHeight; // layerList
				newPropsHeight = offset - currentListHeight - dividerHeight;
				newCodeHeight = totalHeight - currentListHeight - dividerHeight -
					newPropsHeight - divider2Height;

				if ( newPropsHeight < minPropsHeight || newCodeHeight < minCodeHeight ) {
					return;
				}

				sidebarInner.childNodes[ 2 ].style.flex = 'none'; // propertiesPanel
				sidebarInner.childNodes[ 2 ].style.height = newPropsHeight + 'px';
				sidebarInner.childNodes[ 4 ].style.flex = 'none'; // codePanel
				sidebarInner.childNodes[ 4 ].style.height = newCodeHeight + 'px';
			}
		} );

		document.addEventListener( 'mouseup', function () {
			if ( isDragging || isDragging2 ) {
				isDragging = false;
				isDragging2 = false;
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

		divider2.addEventListener( 'touchstart', function () {
			isDragging2 = true;
			document.body.style.cursor = 'row-resize';
			document.body.style.userSelect = 'none';
		} );

		document.addEventListener( 'touchmove', function ( e ) {
			if ( !isDragging && !isDragging2 ) {
				return;
			}

			var rect = sidebarInner.getBoundingClientRect();
			var offset = e.touches[ 0 ].clientY - rect.top;
			var totalHeight = sidebarInner.offsetHeight;
			var dividerHeight = divider.offsetHeight;
			var divider2Height = divider2.offsetHeight;
			var newListHeight, newPropsHeight, newCodeHeight;

			if ( isDragging ) {
				// Dragging first divider (layers/properties)
				newListHeight = offset;
				var remainingHeight = totalHeight - newListHeight - dividerHeight - divider2Height;
				var currentCodeHeight = sidebarInner.childNodes[ 4 ].offsetHeight; // codePanel
				newPropsHeight = remainingHeight - currentCodeHeight;

				if ( newListHeight < minListHeight || newPropsHeight < minPropsHeight ) {
					return;
				}

				sidebarInner.childNodes[ 0 ].style.flex = 'none'; // layerList
				sidebarInner.childNodes[ 0 ].style.height = newListHeight + 'px';
				sidebarInner.childNodes[ 2 ].style.flex = 'none'; // propertiesPanel
				sidebarInner.childNodes[ 2 ].style.height = newPropsHeight + 'px';
			}

			if ( isDragging2 ) {
				// Dragging second divider (properties/code)
				var currentListHeight = sidebarInner.childNodes[ 0 ].offsetHeight; // layerList
				newPropsHeight = offset - currentListHeight - dividerHeight;
				newCodeHeight = totalHeight - currentListHeight - dividerHeight -
					newPropsHeight - divider2Height;

				if ( newPropsHeight < minPropsHeight || newCodeHeight < minCodeHeight ) {
					return;
				}

				sidebarInner.childNodes[ 2 ].style.flex = 'none'; // propertiesPanel
				sidebarInner.childNodes[ 2 ].style.height = newPropsHeight + 'px';
				sidebarInner.childNodes[ 4 ].style.flex = 'none'; // codePanel
				sidebarInner.childNodes[ 4 ].style.height = newCodeHeight + 'px';
			}
		}, { passive: false } );

		document.addEventListener( 'touchend', function () {
			if ( isDragging || isDragging2 ) {
				isDragging = false;
				isDragging2 = false;
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
		lockBtn.innerHTML = layer.locked ?
			'<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2" fill="#ff6b6b" stroke="#d63031" stroke-width="1.5"/><path d="M9 10V7a3 3 0 0 1 6 0v3" fill="none" stroke="#d63031" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="15" r="1.5" fill="#fff"/></svg>' :
			'<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2" fill="#a8e6cf" stroke="#27ae60" stroke-width="1.5"/><path d="M9 10V7a3 3 0 0 1 6 0v1" fill="none" stroke="#27ae60" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="15" r="1.5" fill="#27ae60"/></svg>';
		lockBtn.title = t( 'layers-toggle-lock', 'Toggle lock' );
		lockBtn.type = 'button';
		lockBtn.setAttribute( 'aria-label', t( 'layers-toggle-lock', 'Toggle lock' ) );
		lockBtn.style.width = '36px';
		lockBtn.style.height = '36px';

		// Delete button (SVG trash can, larger, accessible)
		var deleteBtn = document.createElement( 'button' );
		deleteBtn.className = 'layer-delete';
		deleteBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="11" x2="10" y2="17" stroke="#e74c3c" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="11" x2="14" y2="17" stroke="#e74c3c" stroke-width="2" stroke-linecap="round"/></svg>';
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
			case LAYER_TYPES.TEXT || 'text': {
				var prefix = t( 'layers-default-text-prefix', 'Text: ' );
				var emptyText = t( 'layers-default-empty', 'Empty' );
				return prefix + ( ( layer.text || emptyText ).slice( 0, 20 ) );
			}
			case LAYER_TYPES.RECTANGLE || 'rectangle':
				return t( 'layers-type-rectangle', 'Rectangle' );
			case LAYER_TYPES.BLUR || 'blur':
				return t( 'layers-type-blur', 'Blur/Redaction' );
			case LAYER_TYPES.CIRCLE || 'circle':
				return t( 'layers-type-circle', 'Circle' );
			case LAYER_TYPES.ELLIPSE || 'ellipse':
				return t( 'layers-type-ellipse', 'Ellipse' );
			case LAYER_TYPES.POLYGON || 'polygon':
				return t( 'layers-type-polygon', 'Polygon' );
			case LAYER_TYPES.STAR || 'star':
				return t( 'layers-type-star', 'Star' );
			case LAYER_TYPES.ARROW || 'arrow':
				return t( 'layers-type-arrow', 'Arrow' );
			case LAYER_TYPES.LINE || 'line':
				return t( 'layers-type-line', 'Line' );
			case LAYER_TYPES.PATH || 'path':
				return t( 'layers-type-path', 'Drawing' );
			case LAYER_TYPES.HIGHLIGHT || 'highlight':
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

		// Check if click is on buttons or their child elements (like SVGs)
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

		// Only notify canvas if this wasn't called from canvas (prevent circular calls)
		if ( !fromCanvas && this.editor.canvasManager ) {
			this.editor.canvasManager.selectLayer( layerId, true );
		}
	};

	LayerPanel.prototype.toggleLayerVisibility = function ( layerId ) {
		var layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.visible = !( layer.visible !== false );
			this.editor.renderLayers();
			this.renderLayerList();
			this.updateCodePanel(); // Update the code when visibility changes
			// Save state for undo/redo functionality
			this.editor.saveState( layer.visible ? 'Show Layer' : 'Hide Layer' );
		}
	};

	LayerPanel.prototype.toggleLayerLock = function ( layerId ) {
		var layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.locked = !layer.locked;
			this.renderLayerList();
			// Save state for undo/redo functionality
			this.editor.saveState( layer.locked ? 'Lock Layer' : 'Unlock Layer' );
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
					// Save state for undo/redo functionality
					this.editor.saveState( 'Delete Layer' );
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
				// Save state for undo/redo functionality
				this.editor.saveState( 'Delete Layer' );
			}
		}
	};

	LayerPanel.prototype.editLayerName = function ( layerId, nameElement ) {
		var self = this;
		var originalName = nameElement.textContent;
		var maxLength = 100; // Max length for layer names

		nameElement.addEventListener( 'input', function () {
			var currentText = nameElement.textContent;
			if ( currentText.length > maxLength ) {
				// Trim to max length
				nameElement.textContent = currentText.slice( 0, maxLength );
				// Move cursor to end
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
				// Save state for undo/redo functionality
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

	/**
	 * Creates the properties form for editing layer properties.
	 * Uses modern sectioned layout with visual groupings.
	 *
	 * CSS Classes:
	 * - property-section: Container for each property group
	 * - property-section-header: Section header with title and icon
	 * - property-section-header--transform: Transform section styling
	 * - property-section-header--appearance: Appearance section styling
	 * - property-section-header--effects: Effects section styling
	 * - property-section-body: Section content area
	 * - property-field: Individual form field wrapper
	 * - property-field--checkbox: Checkbox field variant
	 * - property-field--compound: Compound control (number + slider)
	 * - compact-controls: Container for number+slider pairs
	 * - compact-number: Number input in compound control
	 * - compact-range: Range slider in compound control
	 * - property-field-error: Error message display
	 * - color-display-button: Color picker trigger button
	 *
	 * @param {Object} layer The layer object to create properties for
	 * @return {HTMLFormElement} The created form element
	 */
	LayerPanel.prototype.createPropertiesForm = function ( layer ) {
		var form = document.createElement( 'form' );
		form.className = 'layer-properties-form';
		var t = this.msg.bind( this );

		// Helpers
		var self = this;
		var currentSection = null;
		var currentSectionBody = null;

		var addSection = function ( title, type ) {
			currentSection = document.createElement( 'div' );
			currentSection.className = 'property-section';

			var header = document.createElement( 'div' );
			header.className = 'property-section-header';
			// Add type-specific class
			if ( type === 'transform' ) {
				header.classList.add( 'property-section-header--transform' );
			} else if ( type === 'appearance' ) {
				header.classList.add( 'property-section-header--appearance' );
			} else if ( type === 'effects' ) {
				header.classList.add( 'property-section-header--effects' );
			}
			header.textContent = title;

			currentSectionBody = document.createElement( 'div' );
			currentSectionBody.className = 'property-section-body';

			currentSection.appendChild( header );
			currentSection.appendChild( currentSectionBody );
			form.appendChild( currentSection );
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
			if ( opts.decimals === 1 && input.type === 'number' && input.step === '' ) {
				input.step = '0.1';
			}
			if ( opts.maxLength !== undefined && input.type === 'text' ) {
				input.maxLength = opts.maxLength;
			}
			input.value = ( opts.value !== undefined && opts.value !== null ) ? opts.value : '';

			// Store the last valid value for fallback
			var lastValidValue = input.value;

			// Create error indicator
			var errorIndicator = document.createElement( 'span' );
			errorIndicator.className = 'property-field-error';

			// Validation function
			var validateInput = function ( value, showError ) {
				var isValid = true;
				var errorMessage = '';

				if ( input.type === 'number' ) {
					var num = parseFloat( value );

					if ( value.trim() === '' ) {
						isValid = false;
						errorMessage = 'This field is required';
					} else if ( isNaN( num ) ) {
						isValid = false;
						errorMessage = 'Please enter a valid number';
					} else if ( opts.min !== undefined && num < parseFloat( opts.min ) ) {
						isValid = false;
						errorMessage = 'Value must be at least ' + opts.min;
					} else if ( opts.max !== undefined && num > parseFloat( opts.max ) ) {
						isValid = false;
						errorMessage = 'Value must be at most ' + opts.max;
					}
				} else if ( input.type === 'text' ) {
					// Text length validation
					var textLength = value.length;
					var maxLength = opts.maxLength || 1000; // Default max length
					var warnLength = Math.floor( maxLength * 0.95 ); // Warn at 95% of limit

					if ( textLength > maxLength ) {
						isValid = false;
						errorMessage = 'Text is too long. Maximum ' + maxLength + ' characters allowed.';
					} else if ( textLength > warnLength && showError ) {
						// Show warning but don't mark as invalid
						errorMessage = 'Approaching character limit (' + textLength + '/' + maxLength + ')';
						errorIndicator.textContent = errorMessage;
						errorIndicator.classList.add( 'show', 'warning' );
						input.classList.add( 'warning' );
						input.classList.remove( 'error' );
						return true; // Still valid, just a warning
					}
				}

				// Visual feedback
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

			// Add input event handler for real-time validation
			input.addEventListener( 'input', function () {
				var value = input.value;
				// Show warnings for text inputs in real-time, errors only on blur/change
				var showWarnings = input.type === 'text';
				validateInput( value, showWarnings );

				if ( input.type === 'number' && opts.decimals === 1 ) {
					var n = parseFloat( value );
					if ( !isNaN( n ) ) {
						// Limit to 1 decimal place during input
						var rounded = Math.round( n * 10 ) / 10;
						if ( value !== String( rounded ) ) {
							setTimeout( function () {
								input.value = rounded.toFixed( 1 );
								lastValidValue = input.value;
							}, 0 );
						}
					}
				}
			} );

			input.addEventListener( 'change', function () {
				var value = input.value;
				var isValid = validateInput( value, true );

				if ( isValid ) {
					if ( input.type === 'number' && opts.decimals === 1 ) {
						var n = parseFloat( value );
						if ( !isNaN( n ) ) {
							var rounded = Math.round( n * 10 ) / 10;
							input.value = rounded.toFixed( 1 );
							opts.onChange( rounded );
						}
					} else if ( input.type === 'number' ) {
						var num = parseFloat( value );
						if ( !isNaN( num ) ) {
							// Ensure the value is within bounds
							if ( opts.min !== undefined ) {
								num = Math.max( num, parseFloat( opts.min ) );
							}
							if ( opts.max !== undefined ) {
								num = Math.min( num, parseFloat( opts.max ) );
							}
							input.value = String( num );
							opts.onChange( num );
						}
					} else if ( input.type === 'checkbox' ) {
						opts.onChange( input.checked );
					} else {
						opts.onChange( value );
					}
					lastValidValue = input.value;
				} else {
					// Revert to last valid value if current value is invalid
					setTimeout( function () {
						input.value = lastValidValue;
						validateInput( lastValidValue, false );
					}, 100 );
				}
			} );

			input.addEventListener( 'blur', function () {
				var value = input.value;
				var isValid = validateInput( value, true );

				if ( !isValid ) {
					// Revert to last valid value
					input.value = lastValidValue;
					validateInput( lastValidValue, false );
				} else if ( input.type === 'number' && opts.decimals === 1 ) {
					var n = parseFloat( value );
					if ( !isNaN( n ) ) {
						var rounded = Math.round( n * 10 ) / 10;
						input.value = rounded.toFixed( 1 );
						lastValidValue = input.value;
					}
				}
			} );

			// Add checkbox handling
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
			var wrapper = document.createElement( 'div' );
			wrapper.className = 'property-field property-field--color';
			var labelEl = document.createElement( 'label' );
			labelEl.textContent = opts.label;

			// Color display button that opens the picker
			var colorButton = document.createElement( 'button' );
			colorButton.type = 'button';
			colorButton.className = 'color-display-button';
			colorButton.style.width = '30px';
			colorButton.style.height = '30px';
			colorButton.style.border = '1px solid #ccc';
			colorButton.style.borderRadius = '4px';
			colorButton.style.cursor = 'pointer';
			colorButton.style.marginLeft = '8px';

			// Set initial color display
			var updateColorDisplay = function ( color ) {
				if ( !color || color === 'none' || color === 'transparent' ) {
					// Show transparent pattern
					colorButton.style.background = 'repeating-linear-gradient(45deg, #ff0000 0, #ff0000 4px, transparent 4px, transparent 8px)';
					colorButton.title = 'Transparent';
				} else {
					colorButton.style.background = color;
					colorButton.title = color;
				}
			};
			updateColorDisplay( opts.value );

			// Create professional color picker dialog
			var createColorPickerDialog = function () {
				// Get button position for positioning the dialog
				var buttonRect = colorButton.getBoundingClientRect();

				var overlay = document.createElement( 'div' );
				overlay.className = 'color-picker-overlay';
				overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); z-index: 999999;';

				var dialog = document.createElement( 'div' );
				dialog.className = 'color-picker-dialog';

				// Position dialog near the button
				var dialogTop = buttonRect.bottom + 5;
				var dialogLeft = buttonRect.left;

				// Ensure dialog stays within viewport
				var maxTop = window.innerHeight - 420; // Approximate dialog height
				var maxLeft = window.innerWidth - 300; // Approximate dialog width

				if ( dialogTop > maxTop ) {
					dialogTop = buttonRect.top - 420 - 5; // Position above button
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

				dialog.style.cssText = 'position: fixed; top: ' + Math.floor( dialogTop ) + 'px; left: ' + Math.floor( dialogLeft ) + 'px; background: white; border: 2px solid #333; border-radius: 6px; padding: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); width: 260px; z-index: 1000000;';

				// Title
				var title = document.createElement( 'h3' );
				title.textContent = 'Choose Color';
				title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px; color: #333;';
				dialog.appendChild( title );

				// Standard color palette grid
				var paletteContainer = document.createElement( 'div' );
				paletteContainer.style.cssText = 'margin-bottom: 16px;';

				var paletteTitle = document.createElement( 'div' );
				paletteTitle.textContent = 'Standard Colors';
				paletteTitle.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 8px;';
				paletteContainer.appendChild( paletteTitle );

				var paletteGrid = document.createElement( 'div' );
				paletteGrid.style.cssText = 'display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; margin-bottom: 12px;';

				// Standard color palette
				var standardColors = [
					'#000000', '#404040', '#808080', '#c0c0c0', '#ffffff', '#ff0000', '#ffff00', '#00ff00',
					'#00ffff', '#0000ff', '#ff00ff', '#800000', '#808000', '#008000', '#008080', '#000080',
					'#800080', '#ff4500', '#ffa500', '#ffff00', '#adff2f', '#00ff7f', '#00bfff', '#1e90ff',
					'#9370db', '#ff69b4', '#ffdab9', '#f0e68c', '#e0ffff', '#ffe4e1', '#dcdcdc', '#a9a9a9'
				];

				// Selection tracking
				var selectedColor = opts.value === 'none' ? 'none' : ( opts.value || '#000000' );
				var selectedButton = null;

				var updateSelection = function ( button ) {
					// Remove previous selection
					if ( selectedButton ) {
						selectedButton.style.borderColor = '#999';
						selectedButton.style.borderWidth = '1px';
					}
					// Highlight new selection
					if ( button ) {
						button.style.borderColor = '#007cba';
						button.style.borderWidth = '2px';
						selectedButton = button;
					}
				};

				// Add "none/transparent" as first option
				var noneButton = document.createElement( 'button' );
				noneButton.type = 'button';
				noneButton.style.cssText = 'width: 24px; height: 24px; border: 1px solid #999; border-radius: 3px; cursor: pointer; background: repeating-linear-gradient(45deg, #ff0000 0, #ff0000 2px, white 2px, white 4px); position: relative;';
				noneButton.title = 'No Fill (Transparent)';
				noneButton.addEventListener( 'click', function () {
					selectedColor = 'none';
					updateSelection( noneButton );
				} );
				paletteGrid.appendChild( noneButton );

				// Add standard colors
				standardColors.forEach( function ( color ) {
					var colorBtn = document.createElement( 'button' );
					colorBtn.type = 'button';
					colorBtn.style.cssText = 'width: 24px; height: 24px; border: 1px solid #999; border-radius: 3px; cursor: pointer; background-color: ' + color + ';';
					colorBtn.title = color;
					colorBtn.addEventListener( 'click', function () {
						selectedColor = color;
						updateSelection( colorBtn );
					} );
					paletteGrid.appendChild( colorBtn );
				} );

				paletteContainer.appendChild( paletteGrid );
				dialog.appendChild( paletteContainer );

				// Custom color slots (user-saved colors)
				var customContainer = document.createElement( 'div' );
				customContainer.style.cssText = 'margin-bottom: 16px;';

				var customTitle = document.createElement( 'div' );
				customTitle.textContent = 'Custom Colors';
				customTitle.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 8px;';
				customContainer.appendChild( customTitle );

				var customGrid = document.createElement( 'div' );
				customGrid.style.cssText = 'display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; margin-bottom: 12px;';

				// Create 16 custom color slots
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
					customBtn.style.cssText = 'width: 24px; height: 24px; border: 1px solid #999; border-radius: 3px; cursor: pointer;';
					customBtn.dataset.slot = i;
					if ( savedCustomColors[ i ] ) {
						customBtn.style.backgroundColor = savedCustomColors[ i ];
						customBtn.title = savedCustomColors[ i ];
						customBtn.addEventListener( 'click', createCustomButtonClickHandler( customBtn ) );
					} else {
						customBtn.style.backgroundColor = '#f5f5f5';
						customBtn.title = 'Empty slot - colors will be saved here automatically';
					}
					customGrid.appendChild( customBtn );
				}

				customContainer.appendChild( customGrid );
				dialog.appendChild( customContainer );

				// Custom color picker
				var customSection = document.createElement( 'div' );
				customSection.style.cssText = 'margin-bottom: 16px;';

				var customLabel = document.createElement( 'div' );
				customLabel.textContent = 'Custom Color';
				customLabel.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 8px;';
				customSection.appendChild( customLabel );

				var customInput = document.createElement( 'input' );
				customInput.type = 'color';
				customInput.style.cssText = 'width: 30px; height: 30px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;';
				customInput.addEventListener( 'change', function () {
					selectedColor = customInput.value;
				} );
				customSection.appendChild( customInput );

				dialog.appendChild( customSection );

				// Set initial selection
				if ( selectedColor === 'none' ) {
					updateSelection( noneButton );
				}

				// Buttons
				var buttonContainer = document.createElement( 'div' );
				buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;';

				var cancelBtn = document.createElement( 'button' );
				cancelBtn.type = 'button';
				cancelBtn.textContent = 'Cancel';
				cancelBtn.style.cssText = 'padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;';
				cancelBtn.addEventListener( 'click', function () {
					document.body.removeChild( overlay );
					document.body.removeChild( dialog );
				} );

				var okBtn = document.createElement( 'button' );
				okBtn.type = 'button';
				okBtn.textContent = 'OK';
				okBtn.style.cssText = 'padding: 8px 16px; border: 1px solid #007cba; border-radius: 4px; background: #007cba; color: white; cursor: pointer;';
				okBtn.addEventListener( 'click', function () {
					// Save to custom colors if it's a new color
					if ( selectedColor !== 'none' && selectedColor !== opts.value ) {
						var customColors = JSON.parse( localStorage.getItem( 'layers-custom-colors' ) || '[]' );
						if ( customColors.indexOf( selectedColor ) === -1 ) {
							customColors.unshift( selectedColor );
							customColors = customColors.slice( 0, 16 ); // Keep only 16 most recent
							localStorage.setItem( 'layers-custom-colors', JSON.stringify( customColors ) );
						}
					}

					// Apply the color
					opts.onChange( selectedColor );
					updateColorDisplay( selectedColor );
					document.body.removeChild( overlay );
					document.body.removeChild( dialog );
				} );

				buttonContainer.appendChild( cancelBtn );
				buttonContainer.appendChild( okBtn );
				dialog.appendChild( buttonContainer );

				// Close on overlay click
				overlay.addEventListener( 'click', function ( e ) {
					if ( e.target === overlay ) {
						document.body.removeChild( overlay );
						document.body.removeChild( dialog );
					}
				} );

				// Close on Escape key
				var escapeHandler = function ( e ) {
					if ( e.key === 'Escape' ) {
						document.body.removeChild( overlay );
						document.body.removeChild( dialog );
						document.removeEventListener( 'keydown', escapeHandler );
					}
				};
				document.addEventListener( 'keydown', escapeHandler );

				return { overlay: overlay, dialog: dialog };
			};

			// Open color picker on button click
			colorButton.addEventListener( 'click', function () {
				var components = createColorPickerDialog();
				document.body.appendChild( components.overlay );
				document.body.appendChild( components.dialog );
			} );

			wrapper.appendChild( labelEl );
			wrapper.appendChild( colorButton );
			( currentSectionBody || form ).appendChild( wrapper );
			return colorButton;
		};

		var addCheckbox = function ( opts ) {
			var wrapper = document.createElement( 'div' );
			wrapper.className = 'property-field property-field--checkbox';
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
			( currentSectionBody || form ).appendChild( wrapper );
			return input;
		};

		// Composite control: number input + range slider
		var addSliderInput = function ( opts ) {
			var wrapper = document.createElement( 'div' );
			wrapper.className = 'property-field property-field--compound';
			var labelEl = document.createElement( 'label' );
			labelEl.textContent = opts.label;

			var controls = document.createElement( 'div' );
			controls.className = 'compact-controls';

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

			// Sync inputs
			var updateValue = function ( value ) {
				var num = parseFloat( value );
				if ( !isNaN( num ) ) {
					num = Math.max( opts.min || 0, Math.min( opts.max || 100, num ) );
					numberInput.value = String( num );
					rangeInput.value = String( num );
					opts.onChange( num );
				}
			};

			numberInput.addEventListener( 'input', function () {
				updateValue( numberInput.value );
			} );

			rangeInput.addEventListener( 'input', function () {
				updateValue( rangeInput.value );
			} );

			controls.appendChild( numberInput );
			controls.appendChild( rangeInput );
			wrapper.appendChild( labelEl );
			wrapper.appendChild( controls );
			( currentSectionBody || form ).appendChild( wrapper );
			return { number: numberInput, range: rangeInput };
		};

		// Transform
		addSection( t( 'layers-section-transform', 'Transform' ), 'transform' );
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
		var LAYER_TYPES = window.LayersConstants ? window.LayersConstants.LAYER_TYPES : {};
		var DEFAULTS = window.LayersConstants ? window.LayersConstants.DEFAULTS : {};
		var LIMITS = window.LayersConstants ? window.LayersConstants.LIMITS : {};
		switch ( layer.type ) {
			case LAYER_TYPES.RECTANGLE || 'rectangle':
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
			case LAYER_TYPES.CIRCLE || 'circle':
				addInput( {
					label: t( 'layers-prop-radius', 'Radius' ),
					type: 'number',
					value: layer.radius || DEFAULTS.RADIUS || 50,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { radius: parseFloat( v ) } );
					}
				} );
				break;
			case LAYER_TYPES.ELLIPSE || 'ellipse':
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
			case LAYER_TYPES.POLYGON || 'polygon':
				addInput( {
					label: t( 'layers-prop-sides', 'Sides' ),
					type: 'number',
					value: layer.sides || DEFAULTS.POLYGON_SIDES || 6,
					min: LIMITS.MIN_POLYGON_SIDES || 3,
					max: LIMITS.MAX_POLYGON_SIDES || 20,
					step: 1,
					onChange: function ( v ) {
						var minSides = LIMITS.MIN_POLYGON_SIDES || 3;
						var sidesVal = Math.max( minSides, parseInt( v, 10 ) || 6 );
						self.editor.updateLayer( layer.id, { sides: sidesVal } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-radius', 'Radius' ),
					type: 'number',
					value: layer.radius || DEFAULTS.RADIUS || 50,
					step: 1,
					decimals: 1,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { radius: parseFloat( v ) } );
					}
				} );
				break;
			case LAYER_TYPES.STAR || 'star':
				addInput( {
					label: t( 'layers-prop-points', 'Points' ),
					type: 'number',
					value: layer.points || DEFAULTS.STAR_POINTS || 5,
					min: LIMITS.MIN_STAR_POINTS || 3,
					max: LIMITS.MAX_STAR_POINTS || 20,
					step: 1,
					onChange: function ( v ) {
						var minPoints = LIMITS.MIN_STAR_POINTS || 3;
						var ptsVal = Math.max( minPoints, parseInt( v, 10 ) || 5 );
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
			case LAYER_TYPES.LINE || 'line':
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
			case LAYER_TYPES.ARROW || 'arrow':
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
					maxLength: 1000,
					onChange: function ( v ) {
						self.editor.updateLayer( layer.id, { text: v } );
					}
				} );
				addInput( {
					label: t( 'layers-prop-font-size', 'Font Size' ),
					type: 'number',
					value: layer.fontSize || 16,
					min: 6,
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
					addColorPicker( {
						label: t( 'layers-prop-stroke-color', 'Text Stroke Color' ),
						value: layer.textStrokeColor,
						property: 'textStrokeColor',
						onChange: function ( newColor ) {
							self.editor.updateLayer( layer.id, {
								textStrokeColor: newColor
							} );
						}
					} );
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
		addSection( t( 'layers-section-appearance', 'Appearance' ), 'appearance' );
		// Stroke and fill color selectors (text layers use textStrokeColor instead)
		if ( layer.type !== 'text' ) {
			addColorPicker( {
				label: t( 'layers-prop-stroke-color', 'Stroke Color' ),
				value: layer.stroke,
				property: 'stroke',
				onChange: function ( newColor ) {
					self.editor.updateLayer( layer.id, { stroke: newColor } );
				}
			} );
		}
		addColorPicker( {
			label: t( 'layers-prop-fill-color', 'Fill Color' ),
			value: layer.fill,
			property: 'fill',
			onChange: function ( newColor ) {
				self.editor.updateLayer( layer.id, { fill: newColor } );
			}
		} );
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
		// Stroke opacity (number + slider, 0-100)
		addSliderInput( {
			label: t( 'layers-prop-stroke-opacity', 'Stroke Opacity' ),
			value: ( layer.strokeOpacity !== null && layer.strokeOpacity !== undefined ) ?
				Math.round( layer.strokeOpacity * 100 ) :
				100,
			min: 0,
			max: 100,
			step: 1,
			onChange: function ( v ) {
				self.editor.updateLayer( layer.id, { strokeOpacity: v / 100 } );
			}
		} );
		// Fill opacity (number + slider, 0-100)
		addSliderInput( {
			label: t( 'layers-prop-fill-opacity', 'Fill Opacity' ),
			value: ( layer.fillOpacity !== null && layer.fillOpacity !== undefined ) ?
				Math.round( layer.fillOpacity * 100 ) :
				100,
			min: 0,
			max: 100,
			step: 1,
			onChange: function ( v ) {
				self.editor.updateLayer( layer.id, { fillOpacity: v / 100 } );
			}
		} );

		// Effects (layer-level)
		addSection( t( 'layers-section-effects', 'Effects' ), 'effects' );
		var layerOpacityValue = (
			layer.opacity !== null &&
			layer.opacity !== undefined
		) ? layer.opacity : 1;
		layerOpacityValue = Math.round( layerOpacityValue * 100 );
		// Layer opacity: number + slider (0–100)
		addSliderInput( {
			label: t( 'layers-prop-opacity', 'Layer Opacity' ),
			value: layerOpacityValue,
			min: 0,
			max: 100,
			step: 1,
			onChange: function ( v ) {
				self.editor.updateLayer( layer.id, { opacity: v / 100 } );
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
			// Save state for undo/redo functionality
			this.editor.saveState( 'Reorder Layers' );
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
				return layer.id || ( 'layer_' + Math.random().toString( 36 ).slice( 2, 6 ) );
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
