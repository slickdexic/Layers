/**
 * ContextMenuController - Handles context menu display and actions for layers
 *
 * Extracted from LayerPanel.js to reduce its size and improve separation of concerns.
 * Provides right-click context menu functionality with layer operations.
 *
 * @class ContextMenuController
 */
( function () {
	'use strict';

	/**
	 * ContextMenuController handles the context menu for layers
	 *
	 * @class
	 */
	class ContextMenuController {
		/**
		 * Create a ContextMenuController instance
		 *
		 * @param {Object} options Configuration options
		 * @param {Object} options.editor Editor instance reference
		 * @param {Function} options.msg i18n message function
		 * @param {Function} options.getSelectedLayerIds Function to get selected layer IDs
		 * @param {Function} options.selectLayer Function to select a layer
		 * @param {Function} options.createGroupFromSelection Function to create group
		 * @param {Function} options.ungroupLayer Function to ungroup a layer
		 * @param {Function} options.deleteLayer Function to delete a layer
		 * @param {Function} options.editLayerName Function to edit layer name
		 */
		constructor( options ) {
			this.editor = options.editor;
			this.msg = options.msg;
			this.getSelectedLayerIds = options.getSelectedLayerIds;
			this.selectLayer = options.selectLayer;
			this.createGroupFromSelection = options.createGroupFromSelection;
			this.ungroupLayer = options.ungroupLayer;
			this.deleteLayer = options.deleteLayer;
			this.editLayerName = options.editLayerName;

			this.activeContextMenu = null;

			// Store bound handlers for proper cleanup (prevents memory leak)
			this._boundCloseHandler = null;
			this._boundEscHandler = null;
		}

		/**
		 * Handle right-click context menu on layer list
		 *
		 * Provides quick access to layer actions like Group, Ungroup, etc.
		 *
		 * @param {MouseEvent} e Mouse event
		 */
		handleLayerContextMenu( e ) {
			e.preventDefault();

			const target = e.target;
			const layerItem = target.closest( '.layer-item' );

			// Close any existing context menu
			this.closeLayerContextMenu();

			// Determine clicked layer and select it if not already selected
			const clickedLayerId = layerItem ? layerItem.dataset.layerId : null;
			if ( clickedLayerId && !this.getSelectedLayerIds().includes( clickedLayerId ) ) {
				this.selectLayer( clickedLayerId, false, false );
			}

			// Get selection state AFTER any selectLayer call so menu reflects
			// the actual current selection
			const selectedIds = this.getSelectedLayerIds();

			// Create context menu
			const menu = document.createElement( 'div' );
			menu.className = 'layers-context-menu';
			menu.setAttribute( 'role', 'menu' );
			menu.style.position = 'fixed';
			menu.style.left = e.clientX + 'px';
			menu.style.top = e.clientY + 'px';
			menu.style.zIndex = String( window.Layers.Constants.Z_INDEX.CONTEXT_MENU );
			menu.style.backgroundColor = '#fff';
			menu.style.border = '1px solid #ccc';
			menu.style.borderRadius = '4px';
			menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
			menu.style.padding = '4px 0';
			menu.style.minWidth = '160px';

			const addMenuItem = ( label, icon, callback, disabled ) => {
				const item = document.createElement( 'button' );
				item.className = 'layers-context-menu-item';
				item.type = 'button';
				item.setAttribute( 'role', 'menuitem' );
				item.setAttribute( 'tabindex', '-1' );
				item.style.display = 'flex';
				item.style.alignItems = 'center';
				item.style.width = '100%';
				item.style.padding = '8px 12px';
				item.style.border = 'none';
				item.style.background = 'none';
				item.style.cursor = disabled ? 'default' : 'pointer';
				item.style.textAlign = 'left';
				item.style.fontSize = '13px';
				item.style.color = disabled ? '#999' : '#333';
				item.style.gap = '8px';
				if ( !disabled ) {
					item.addEventListener( 'mouseenter', () => {
						item.style.backgroundColor = '#f0f0f0';
					} );
					item.addEventListener( 'mouseleave', () => {
						item.style.backgroundColor = 'transparent';
					} );
				}
				if ( icon ) {
					const iconSpan = document.createElement( 'span' );
					iconSpan.textContent = icon;
					iconSpan.style.width = '16px';
					item.appendChild( iconSpan );
				}
				const labelSpan = document.createElement( 'span' );
				labelSpan.textContent = label;
				item.appendChild( labelSpan );
				if ( disabled ) {
					item.disabled = true;
				} else {
					item.addEventListener( 'click', () => {
						this.closeLayerContextMenu();
						callback();
					} );
				}
				menu.appendChild( item );
			};

			const addSeparator = () => {
				const sep = document.createElement( 'div' );
				sep.style.height = '1px';
				sep.style.backgroundColor = '#e0e0e0';
				sep.style.margin = '4px 0';
				menu.appendChild( sep );
			};

			// Determine context based on selection
			const hasMultipleSelected = selectedIds.length >= 2;
			const hasSingleSelected = selectedIds.length === 1;
			const clickedLayer = clickedLayerId ? this.editor.getLayerById( clickedLayerId ) : null;
			const isGroup = clickedLayer && clickedLayer.type === 'group';

			// Group option (requires 2+ layers selected)
			addMenuItem(
				this.msg( 'layers-context-group', 'Group (Ctrl+G)' ),
				'📁',
				() => this.createGroupFromSelection(),
				!hasMultipleSelected
			);

			// Ungroup option (only for group layers)
			addMenuItem(
				this.msg( 'layers-context-ungroup', 'Ungroup (Ctrl+Shift+G)' ),
				'📂',
				() => this.ungroupLayer( clickedLayerId ),
				!isGroup
			);

			addSeparator();

			// Standard layer operations
			addMenuItem(
				this.msg( 'layers-context-rename', 'Rename' ),
				'✏️',
				() => {
					if ( layerItem ) {
						const nameEl = layerItem.querySelector( '.layer-name' );
						if ( nameEl ) {
							this.editLayerName( clickedLayerId, nameEl );
							nameEl.focus();
						}
					}
				},
				!hasSingleSelected && !clickedLayerId
			);

			addMenuItem(
				this.msg( 'layers-context-duplicate', 'Duplicate' ),
				'📋',
				() => {
					if ( this.editor && this.editor.duplicateSelected ) {
						this.editor.duplicateSelected();
					}
				},
				selectedIds.length === 0
			);

			addMenuItem(
				this.msg( 'layers-context-delete', 'Delete' ),
				'🗑️',
				() => {
					if ( clickedLayerId ) {
						this.deleteLayer( clickedLayerId );
					}
				},
				selectedIds.length === 0 && !clickedLayerId
			);

			document.body.appendChild( menu );
			this.activeContextMenu = menu;

			// Close menu when clicking outside - store reference for cleanup
			this._boundCloseHandler = ( evt ) => {
				if ( !menu.contains( evt.target ) ) {
					this.closeLayerContextMenu();
				}
			};
			setTimeout( () => {
				document.addEventListener( 'click', this._boundCloseHandler );
			}, 0 );

			// Close on Escape, arrow-key navigation (WCAG 2.1 SC 4.1.2)
			this._boundEscHandler = ( evt ) => {
				if ( evt.key === 'Escape' ) {
					this.closeLayerContextMenu();
					return;
				}
				if ( evt.key === 'ArrowDown' || evt.key === 'ArrowUp' ) {
					evt.preventDefault();
					const items = Array.from(
						menu.querySelectorAll( '[role="menuitem"]:not([disabled])' )
					);
					if ( items.length === 0 ) {
						return;
					}
					const current = menu.querySelector( '[role="menuitem"]:focus' );
					let idx = items.indexOf( current );
					if ( evt.key === 'ArrowDown' ) {
						idx = idx < items.length - 1 ? idx + 1 : 0;
					} else {
						idx = idx > 0 ? idx - 1 : items.length - 1;
					}
					items[ idx ].focus();
				}
			};
			document.addEventListener( 'keydown', this._boundEscHandler );

			// Focus the first enabled menu item for keyboard accessibility
			requestAnimationFrame( () => {
				const firstItem = menu.querySelector( '[role="menuitem"]:not([disabled])' );
				if ( firstItem ) {
					firstItem.focus();
				}
			} );
		}

		/**
		 * Close the active layer context menu if open
		 */
		closeLayerContextMenu() {
			// Remove document event listeners to prevent memory leaks
			if ( this._boundCloseHandler ) {
				document.removeEventListener( 'click', this._boundCloseHandler );
				this._boundCloseHandler = null;
			}
			if ( this._boundEscHandler ) {
				document.removeEventListener( 'keydown', this._boundEscHandler );
				this._boundEscHandler = null;
			}

			if ( this.activeContextMenu && this.activeContextMenu.parentNode ) {
				this.activeContextMenu.parentNode.removeChild( this.activeContextMenu );
			}
			this.activeContextMenu = null;
		}

		/**
		 * Clean up resources and event listeners
		 */
		destroy() {
			// Close any open menu (which also removes its event listeners)
			this.closeLayerContextMenu();

			// Clear references
			this.editor = null;
			this.msg = null;
			this.getSelectedLayerIds = null;
			this.selectLayer = null;
			this.createGroupFromSelection = null;
			this.ungroupLayer = null;
			this.deleteLayer = null;
			this.editLayerName = null;
		}
	}

	// Export to namespace
	window.Layers = window.Layers || {};
	window.Layers.UI = window.Layers.UI || {};
	window.Layers.UI.ContextMenuController = ContextMenuController;

	// Legacy global export for compatibility
	window.ContextMenuController = ContextMenuController;

	// CommonJS export for Jest
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ContextMenuController;
	}

} )();
