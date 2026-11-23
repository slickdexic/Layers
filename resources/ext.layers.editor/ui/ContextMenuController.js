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
			this.panel = options.panel;

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
			this.openMenu( e.target.closest( '.layer-item' ), e.clientX, e.clientY );
		}

		appendLayerActions( container ) {
			const button = document.createElement( 'button' );
			button.type = 'button';
			button.className = 'layers-btn layers-btn-icon layers-layer-actions';
			button.textContent = '…';
			button.title = this.msg( 'layers-layer-actions', 'Layer actions' );
			button.setAttribute( 'aria-label', button.title );
			button.setAttribute( 'aria-haspopup', 'menu' );
			button.setAttribute( 'aria-expanded', 'false' );
			this.actionButton = button;
			this.updateActionButton();
			this.panel.addTargetListener( button, 'click', () => {
				const id = this.selectedLayerId();
				if ( id ) {
					this.openForLayer( button, this.panel.layerListRenderer?.findLayerRow( id ), id );
				}
			} );
			container.appendChild( button );
		}

		selectedLayerId() {
			const [ id, other ] = this.getSelectedLayerIds();
			return id && !other && id !== '__background__' && this.editor.getLayerById( id ) ? id : null;
		}

		updateActionButton() {
			if ( this.actionButton ) {
				this.actionButton.disabled = !this.selectedLayerId();
			}
		}

		moveSibling( id, direction ) {
			const order = this.selectedLayerId() === id && this.editor.groupManager?.getSiblingOrder( id, direction );
			if ( !order ) {
				this.actionButton.focus();
				return;
			}
			this.editor.stateManager.set( 'layers', order );
			this.editor.canvasManager?.redraw();
			this.editor.saveState( 'Reorder Layers' );
			const row = this.panel.layerListRenderer?.findLayerRow( id, true );
			( row?.querySelector( '.layer-grab-area' ) || this.actionButton ).focus();
			this.panel.announceToScreenReader( direction < 0 ?
				this.msg( 'layers-aria-moved-up', 'Moved up one layer.' ) :
				this.msg( 'layers-aria-moved-down', 'Moved down one layer.' ) );
		}

		openForLayer( opener, row, id ) {
			if ( this.opener === opener ) {
				this.closeLayerContextMenu( true );
			} else {
				this.openMenu( row, 0, 0, opener, id );
			}
		}

		openMenu( layerItem, x, y, opener, clickedLayerId = layerItem?.dataset.layerId ) {
			this.closeLayerContextMenu();

			// Determine clicked layer and select it if not already selected
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
			menu.style.left = x + 'px';
			menu.style.top = y + 'px';
			const zIndex = window.Layers.Constants.Z_INDEX;
			menu.style.zIndex = String( opener ? zIndex.EDITOR_FULLSCREEN + 1 : zIndex.CONTEXT_MENU );

			const addMenuItem = ( label, icon, callback, disabled ) => {
				const item = document.createElement( 'button' );
				item.className = 'layers-context-menu-item';
				item.type = 'button';
				item.setAttribute( 'role', 'menuitem' );
				item.setAttribute( 'tabindex', '-1' );
				if ( icon ) {
					const iconSpan = document.createElement( 'span' );
					iconSpan.textContent = icon;
					iconSpan.className = 'layers-context-menu-icon';
					item.appendChild( iconSpan );
				}
				item.append( label );
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
				sep.className = 'layers-context-menu-separator';
				menu.appendChild( sep );
			};

			// Determine context based on selection
			const hasMultipleSelected = selectedIds.length >= 2;
			const hasSingleSelected = selectedIds.length === 1;
			const clickedLayer = clickedLayerId ? this.editor.getLayerById( clickedLayerId ) : null;
			const isGroup = clickedLayer && clickedLayer.type === 'group';

			if ( opener ) {
				const group = this.editor.groupManager;
				addMenuItem( this.msg( 'layers-context-move-up', 'Move up' ), null,
					() => this.moveSibling( clickedLayerId, -1 ), !group?.getSiblingOrder( clickedLayerId, -1 ) );
				addMenuItem( this.msg( 'layers-context-move-down', 'Move down' ), null,
					() => this.moveSibling( clickedLayerId, 1 ), !group?.getSiblingOrder( clickedLayerId, 1 ) );
				addSeparator();
			}

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
				opener ? !layerItem : !hasSingleSelected && !clickedLayerId
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
			const firstItem = menu.querySelector( '[role="menuitem"]:not([disabled])' );
			if ( opener ) {
				this.opener = opener;
				opener.setAttribute( 'aria-expanded', 'true' );
				menu.setAttribute( 'aria-label', opener.title );
				menu.classList.add( 'layers-context-menu-anchored' );
				this.placeMenu = () => this.positionAtOpener( menu, opener );
				this.placeMenu();
				window.addEventListener( 'resize', this.placeMenu );
				firstItem?.focus();
			} else {
				requestAnimationFrame( () => firstItem?.focus() );
			}

			// Close menu when clicking outside - store reference for cleanup
			this._boundCloseHandler = ( evt ) => {
				if ( !menu.contains( evt.target ) && !opener?.contains( evt.target ) ) {
					this.closeLayerContextMenu();
				}
			};
			document.addEventListener( 'click', this._boundCloseHandler );

			// Close on Escape, arrow-key navigation (WCAG 2.1 SC 4.1.2)
			this._boundEscHandler = ( evt ) => {
				if ( evt.key === 'Escape' || ( opener && evt.key === 'Tab' ) ) {
					if ( opener && evt.key === 'Escape' ) {
						evt.preventDefault();
					}
					this.closeLayerContextMenu( true );
					return;
				}
				if ( evt.key === 'ArrowDown' || evt.key === 'ArrowUp' ||
					evt.key === 'Home' || evt.key === 'End' ) {
					evt.preventDefault();
					const items = Array.from(
						menu.querySelectorAll( '[role="menuitem"]:not([disabled])' )
					);
					if ( items.length === 0 ) {
						return;
					}
					const current = items.indexOf( document.activeElement );
					const destinations = {
						ArrowDown: ( current + 1 ) % items.length,
						ArrowUp: current > 0 ? current - 1 : items.length - 1,
						Home: 0,
						End: items.length - 1
					};
					items[ destinations[ evt.key ] ].focus();
				}
			};
			document.addEventListener( 'keydown', this._boundEscHandler );
		}

		positionAtOpener( menu, opener ) {
			const anchor = opener.getBoundingClientRect();
			const { width, height } = menu.getBoundingClientRect();
			const bottom = window.innerHeight - 4;
			const preferredTop = anchor.bottom + height <= bottom ? anchor.bottom : anchor.top - height;
			menu.style.left = Math.max( 4, Math.min( anchor.left, window.innerWidth - width - 4 ) ) + 'px';
			menu.style.top = Math.max( 4, Math.min( preferredTop, bottom - height ) ) + 'px';
		}

		/**
		 * Close the active layer context menu if open
		 */
		closeLayerContextMenu( restoreFocus ) {
			// Remove document event listeners to prevent memory leaks
			if ( this._boundCloseHandler ) {
				document.removeEventListener( 'click', this._boundCloseHandler );
				this._boundCloseHandler = null;
			}
			if ( this._boundEscHandler ) {
				document.removeEventListener( 'keydown', this._boundEscHandler );
				this._boundEscHandler = null;
			}

			this.activeContextMenu?.remove();
			this.activeContextMenu = null;
			if ( this.opener ) {
				window.removeEventListener( 'resize', this.placeMenu );
				this.placeMenu = null;
				this.opener.setAttribute( 'aria-expanded', 'false' );
				if ( restoreFocus ) {
					this.opener.focus();
				}
				this.opener = null;
			}
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
			this.panel = null;
			this.actionButton = null;
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
