/**
 * ToolDropdown - Dropdown component for grouped toolbar tools
 *
 * Displays a primary tool button with a dropdown menu for related tools.
 * Tracks the most recently used tool in each group as the visible button.
 *
 * @class ToolDropdown
 */
( function () {
	'use strict';

	/**
	 * Static registry of all ToolDropdown instances for coordinated closing
	 *
	 * @type {Set<ToolDropdown>}
	 */
	const dropdownRegistry = new Set();

	/**
	 * Close all open dropdowns except the specified one
	 *
	 * @param {ToolDropdown} [exceptDropdown] Dropdown to keep open
	 */
	function closeAllExcept( exceptDropdown ) {
		dropdownRegistry.forEach( ( dropdown ) => {
			if ( dropdown !== exceptDropdown && dropdown.isOpen ) {
				dropdown.close();
			}
		} );
	}

	/**
	 * ToolDropdown class
	 */
	class ToolDropdown {
		/**
		 * Create a new ToolDropdown
		 *
		 * @param {Object} config Configuration object
		 * @param {string} config.groupId Unique identifier for this tool group
		 * @param {string} config.groupLabel Label for the group (for accessibility)
		 * @param {Array<Object>} config.tools Array of tool definitions
		 * @param {string} config.tools[].id Tool identifier
		 * @param {string} config.tools[].icon SVG icon HTML
		 * @param {string} config.tools[].title Localized tool title
		 * @param {string} [config.tools[].key] Keyboard shortcut
		 * @param {string} [config.defaultTool] Initial tool to show (defaults to first)
		 * @param {Function} config.onToolSelect Callback when tool is selected
		 * @param {Function} [config.msg] Message function for i18n
		 */
		constructor( config ) {
			this.groupId = config.groupId;
			this.groupLabel = config.groupLabel || config.groupId;
			this.tools = config.tools || [];
			this.onToolSelect = config.onToolSelect;
			this.msg = config.msg || ( ( key, fallback ) => fallback );

			// Track the most recently used tool (persisted in localStorage)
			this.mruStorageKey = 'layers-mru-' + this.groupId;
			this.currentToolId = this.loadMRU() || config.defaultTool || this.tools[ 0 ]?.id;

			// DOM elements
			this.container = null;
			this.triggerButton = null;
			this.dropdownMenu = null;
			this.isOpen = false;

			// Bound handlers for cleanup
			this.boundHandleDocumentClick = this.handleDocumentClick.bind( this );
			this.boundHandleKeyDown = this.handleKeyDown.bind( this );
		}

		/**
		 * Load the most recently used tool from localStorage
		 *
		 * @return {string|null} Tool ID or null
		 */
		loadMRU() {
			try {
				const stored = localStorage.getItem( this.mruStorageKey );
				// Validate it's still a valid tool
				if ( stored && this.tools.some( ( t ) => t.id === stored ) ) {
					return stored;
				}
			} catch ( e ) {
				// localStorage not available
			}
			return null;
		}

		/**
		 * Save the most recently used tool to localStorage
		 *
		 * @param {string} toolId Tool ID
		 */
		saveMRU( toolId ) {
			try {
				localStorage.setItem( this.mruStorageKey, toolId );
			} catch ( e ) {
				// localStorage not available
			}
		}

		/**
		 * Get the current tool definition
		 *
		 * @return {Object|null} Current tool object
		 */
		getCurrentTool() {
			return this.tools.find( ( t ) => t.id === this.currentToolId ) || this.tools[ 0 ];
		}

		/**
		 * Create and return the dropdown container element
		 *
		 * @return {HTMLElement} The dropdown container
		 */
		create() {
			this.container = document.createElement( 'div' );
			this.container.className = 'tool-dropdown';
			this.container.dataset.groupId = this.groupId;

			// Create trigger button with current tool + dropdown indicator
			this.triggerButton = document.createElement( 'button' );
			this.triggerButton.className = 'toolbar-button tool-button tool-dropdown-trigger';
			this.triggerButton.type = 'button';
			this.triggerButton.setAttribute( 'aria-haspopup', 'true' );
			this.triggerButton.setAttribute( 'aria-expanded', 'false' );
			this.updateTriggerButton();

			// Click on trigger opens dropdown
			this.triggerButton.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();
				this.toggle();
			} );

			// Create dropdown menu
			this.dropdownMenu = document.createElement( 'div' );
			this.dropdownMenu.className = 'tool-dropdown-menu';
			this.dropdownMenu.setAttribute( 'role', 'menu' );
			this.dropdownMenu.setAttribute( 'aria-label', this.groupLabel );

			// Add tool items to menu
			this.tools.forEach( ( tool, index ) => {
				const item = this.createMenuItem( tool, index );
				this.dropdownMenu.appendChild( item );
			} );

			this.container.appendChild( this.triggerButton );
			this.container.appendChild( this.dropdownMenu );

			// Register this dropdown for coordinated closing
			dropdownRegistry.add( this );

			return this.container;
		}

		/**
		 * Create a menu item for a tool
		 *
		 * @param {Object} tool Tool definition
		 * @param {number} index Index in the tools array
		 * @return {HTMLElement} Menu item element
		 */
		createMenuItem( tool, index ) {
			const item = document.createElement( 'button' );
			item.className = 'tool-dropdown-item';
			item.type = 'button';
			item.dataset.tool = tool.id;
			item.setAttribute( 'role', 'menuitem' );
			item.setAttribute( 'tabindex', index === 0 ? '0' : '-1' );

			// Icon
			const iconSpan = document.createElement( 'span' );
			iconSpan.className = 'tool-dropdown-icon';
			iconSpan.innerHTML = tool.icon;
			item.appendChild( iconSpan );

			// Label
			const labelSpan = document.createElement( 'span' );
			labelSpan.className = 'tool-dropdown-label';
			labelSpan.textContent = tool.title;
			item.appendChild( labelSpan );

			// Shortcut indicator
			if ( tool.key ) {
				const shortcutSpan = document.createElement( 'span' );
				shortcutSpan.className = 'tool-dropdown-shortcut';
				shortcutSpan.textContent = tool.key;
				item.appendChild( shortcutSpan );
			}

			// Mark current tool
			if ( tool.id === this.currentToolId ) {
				item.classList.add( 'current' );
				item.setAttribute( 'aria-current', 'true' );
			}

			item.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();
				this.selectTool( tool.id );
			} );

			return item;
		}

		/**
		 * Update the trigger button to show the current tool
		 */
		updateTriggerButton() {
			const tool = this.getCurrentTool();
			if ( !tool || !this.triggerButton ) {
				return;
			}

			// Clear existing content
			this.triggerButton.innerHTML = '';

			// Add icon
			const iconWrapper = document.createElement( 'span' );
			iconWrapper.className = 'tool-dropdown-trigger-icon';
			iconWrapper.innerHTML = tool.icon;
			this.triggerButton.appendChild( iconWrapper );

			// Add dropdown arrow indicator
			const arrow = document.createElement( 'span' );
			arrow.className = 'tool-dropdown-arrow';
			arrow.innerHTML = '<svg width="8" height="8" viewBox="0 0 8 8"><path d="M0 2l4 4 4-4z" fill="currentColor"/></svg>';
			this.triggerButton.appendChild( arrow );

			// Update attributes
			this.triggerButton.dataset.tool = tool.id;
			this.triggerButton.title = tool.title + ( tool.key ? ' (' + tool.key + ')' : '' ) +
				' - ' + this.msg( 'layers-tool-dropdown-hint', 'Click to see more tools' );
			this.triggerButton.setAttribute( 'aria-label', tool.title );
			if ( tool.key ) {
				this.triggerButton.setAttribute( 'aria-keyshortcuts', tool.key );
			}
		}

		/**
		 * Open the dropdown menu
		 */
		open() {
			if ( this.isOpen ) {
				return;
			}

			// Close all other open dropdowns first
			closeAllExcept( this );

			this.isOpen = true;
			this.dropdownMenu.classList.add( 'open' );
			this.triggerButton.setAttribute( 'aria-expanded', 'true' );
			this.triggerButton.classList.add( 'dropdown-open' );

			// Focus first item
			const firstItem = this.dropdownMenu.querySelector( '.tool-dropdown-item' );
			if ( firstItem ) {
				firstItem.focus();
			}

			// Add document listeners for closing
			document.addEventListener( 'click', this.boundHandleDocumentClick );
			document.addEventListener( 'keydown', this.boundHandleKeyDown );
		}

		/**
		 * Close the dropdown menu
		 */
		close() {
			if ( !this.isOpen ) {
				return;
			}

			this.isOpen = false;
			this.dropdownMenu.classList.remove( 'open' );
			this.triggerButton.setAttribute( 'aria-expanded', 'false' );
			this.triggerButton.classList.remove( 'dropdown-open' );

			// Remove document listeners
			document.removeEventListener( 'click', this.boundHandleDocumentClick );
			document.removeEventListener( 'keydown', this.boundHandleKeyDown );
		}

		/**
		 * Toggle the dropdown menu
		 */
		toggle() {
			if ( this.isOpen ) {
				this.close();
			} else {
				this.open();
			}
		}

		/**
		 * Handle document click to close dropdown
		 *
		 * @param {Event} e Click event
		 */
		handleDocumentClick( e ) {
			if ( this.container && !this.container.contains( e.target ) ) {
				this.close();
			}
		}

		/**
		 * Handle keyboard navigation in dropdown
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 */
		handleKeyDown( e ) {
			if ( !this.isOpen ) {
				return;
			}

			const items = Array.from( this.dropdownMenu.querySelectorAll( '.tool-dropdown-item' ) );
			const currentIndex = items.indexOf( document.activeElement );

			switch ( e.key ) {
				case 'Escape':
					e.preventDefault();
					this.close();
					this.triggerButton.focus();
					break;

				case 'ArrowDown':
					e.preventDefault();
					if ( currentIndex < items.length - 1 ) {
						items[ currentIndex + 1 ].focus();
					} else {
						items[ 0 ].focus();
					}
					break;

				case 'ArrowUp':
					e.preventDefault();
					if ( currentIndex > 0 ) {
						items[ currentIndex - 1 ].focus();
					} else {
						items[ items.length - 1 ].focus();
					}
					break;

				case 'Home':
					e.preventDefault();
					items[ 0 ].focus();
					break;

				case 'End':
					e.preventDefault();
					items[ items.length - 1 ].focus();
					break;

				case 'Tab':
					// Let tab close the dropdown and move focus naturally
					this.close();
					break;
			}
		}

		/**
		 * Select a tool from the dropdown
		 *
		 * @param {string} toolId Tool ID to select
		 * @param {boolean} [fromKeyboard=false] Whether selection was from keyboard shortcut
		 * @param {boolean} [skipCallback=false] Skip calling onToolSelect (used for internal sync)
		 */
		selectTool( toolId, fromKeyboard = false, skipCallback = false ) {
			const tool = this.tools.find( ( t ) => t.id === toolId );
			if ( !tool ) {
				return;
			}

			// Update MRU
			this.currentToolId = toolId;
			this.saveMRU( toolId );

			// Update UI
			this.updateTriggerButton();

			// Update menu items
			if ( this.dropdownMenu ) {
				this.dropdownMenu.querySelectorAll( '.tool-dropdown-item' ).forEach( ( item ) => {
					if ( item.dataset.tool === toolId ) {
						item.classList.add( 'current' );
						item.setAttribute( 'aria-current', 'true' );
					} else {
						item.classList.remove( 'current' );
						item.removeAttribute( 'aria-current' );
					}
				} );
			}

			// Close dropdown (unless from keyboard shortcut)
			if ( !fromKeyboard ) {
				this.close();
			}

			// Notify callback (unless skipped for internal sync)
			if ( !skipCallback && typeof this.onToolSelect === 'function' ) {
				this.onToolSelect( toolId, this.groupId );
			}
		}

		/**
		 * Check if this dropdown contains a specific tool
		 *
		 * @param {string} toolId Tool ID to check
		 * @return {boolean} True if the tool is in this dropdown
		 */
		hasTool( toolId ) {
			return this.tools.some( ( t ) => t.id === toolId );
		}

		/**
		 * Set the active state of the trigger button
		 *
		 * @param {boolean} active Whether the button should appear active
		 */
		setActive( active ) {
			if ( this.triggerButton ) {
				if ( active ) {
					this.triggerButton.classList.add( 'active' );
					this.triggerButton.setAttribute( 'aria-pressed', 'true' );
				} else {
					this.triggerButton.classList.remove( 'active' );
					this.triggerButton.setAttribute( 'aria-pressed', 'false' );
				}
			}
		}

		/**
		 * Clean up event listeners and unregister from dropdown registry
		 */
		destroy() {
			this.close();
			document.removeEventListener( 'click', this.boundHandleDocumentClick );
			document.removeEventListener( 'keydown', this.boundHandleKeyDown );
			dropdownRegistry.delete( this );
		}
	}

	// Export to namespace
	window.Layers = window.Layers || {};
	window.Layers.UI = window.Layers.UI || {};
	window.Layers.UI.ToolDropdown = ToolDropdown;
	window.ToolDropdown = ToolDropdown;

}() );
