/**
 * Layer Item Events Handler
 * Handles click, keyboard, and focus events for layer list items
 * Extracted from LayerPanel.js for better separation of concerns
 */
( function () {
	'use strict';

	/**
	 * LayerItemEvents class
	 * Manages event handling for layer list items
	 */
	class LayerItemEvents {
		/**
		 * Create a LayerItemEvents instance
		 *
		 * @param {Object} config Configuration object
		 * @param {HTMLElement} config.layerList The layer list container element
		 * @param {Function} config.getLayers Function to get current layers array
		 * @param {Function} config.getSelectedLayerId Function to get currently selected layer ID
		 * @param {Object} config.callbacks Event callbacks
		 * @param {Function} config.callbacks.onSelect Called when a layer is selected
		 * @param {Function} config.callbacks.onToggleVisibility Called when visibility is toggled
		 * @param {Function} config.callbacks.onToggleLock Called when lock is toggled
		 * @param {Function} config.callbacks.onDelete Called when delete is requested
		 * @param {Function} config.callbacks.onEditName Called when name editing starts
		 * @param {Function} [config.addTargetListener] Optional event listener registration function
		 */
		constructor( config ) {
			this.config = config || {};
			this.layerList = this.config.layerList;
			this.getLayers = this.config.getLayers || ( () => [] );
			this.getSelectedLayerId = this.config.getSelectedLayerId || ( () => null );
			this.callbacks = this.config.callbacks || {};
			this.addTargetListener = this.config.addTargetListener || null;

			// Bind methods
			this.handleClick = this.handleClick.bind( this );
			this.handleKeydown = this.handleKeydown.bind( this );

			// Set up event listeners if layer list is provided
			if ( this.layerList ) {
				this.setupEventListeners();
			}
		}

		/**
		 * Set up event listeners on the layer list
		 */
		setupEventListeners() {
			if ( this.addTargetListener ) {
				this.addTargetListener( this.layerList, 'click', this.handleClick );
				this.addTargetListener( this.layerList, 'keydown', this.handleKeydown );
			} else {
				this.layerList.addEventListener( 'click', this.handleClick );
				this.layerList.addEventListener( 'keydown', this.handleKeydown );
			}
		}

		/**
		 * Handle click events in the layer list
		 *
		 * @param {MouseEvent} e Click event
		 */
		handleClick( e ) {
			const target = e.target;
			const layerItem = target.closest( '.layer-item' );

			if ( !layerItem ) {
				return;
			}

			const layerId = layerItem.dataset.layerId;
			if ( !layerId ) {
				return;
			}

			// Determine which element was clicked
			const visibilityBtn = target.closest( '.layer-visibility' );
			const lockBtn = target.closest( '.layer-lock' );
			const deleteBtn = target.closest( '.layer-delete' );
			const nameEl = target.closest( '.layer-name' );

			if ( visibilityBtn ) {
				this.triggerCallback( 'onToggleVisibility', layerId );
			} else if ( lockBtn ) {
				this.triggerCallback( 'onToggleLock', layerId );
			} else if ( deleteBtn ) {
				this.triggerCallback( 'onDelete', layerId );
			} else if ( nameEl ) {
				this.triggerCallback( 'onEditName', layerId, nameEl );
			} else {
				this.triggerCallback( 'onSelect', layerId );
			}
		}

		/**
		 * Handle keyboard events in the layer list
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 */
		handleKeydown( e ) {
			const target = e.target;
			const layerItem = target.closest( '.layer-item' );

			// Only handle navigation keys when focused on a layer item
			if ( !layerItem ) {
				return;
			}

			const layers = this.getLayers();
			if ( layers.length === 0 ) {
				return;
			}

			const layerId = layerItem.dataset.layerId;
			const currentIndex = this.findLayerIndex( layerId );

			if ( currentIndex === -1 ) {
				return;
			}

			switch ( e.key ) {
				case 'ArrowUp':
					e.preventDefault();
					if ( currentIndex > 0 ) {
						this.focusLayerAtIndex( currentIndex - 1 );
					}
					break;

				case 'ArrowDown':
					e.preventDefault();
					if ( currentIndex < layers.length - 1 ) {
						this.focusLayerAtIndex( currentIndex + 1 );
					}
					break;

				case 'Home':
					e.preventDefault();
					this.focusLayerAtIndex( 0 );
					break;

				case 'End':
					e.preventDefault();
					this.focusLayerAtIndex( layers.length - 1 );
					break;

				case 'Enter':
				case ' ':
					// Don't intercept if focused on a button or editable element
					if ( target.tagName === 'BUTTON' || target.contentEditable === 'true' ) {
						return;
					}
					e.preventDefault();
					this.triggerCallback( 'onSelect', layerId );
					break;

				case 'Delete':
				case 'Backspace':
					// Only handle if not focused on an editable element
					if ( target.contentEditable === 'true' ) {
						return;
					}
					e.preventDefault();
					this.triggerCallback( 'onDelete', layerId );
					break;

				case 'v':
				case 'V':
					// Toggle visibility with V key
					if ( !e.ctrlKey && !e.metaKey && target.contentEditable !== 'true' ) {
						e.preventDefault();
						this.triggerCallback( 'onToggleVisibility', layerId );
					}
					break;

				case 'l':
				case 'L':
					// Toggle lock with L key
					if ( !e.ctrlKey && !e.metaKey && target.contentEditable !== 'true' ) {
						e.preventDefault();
						this.triggerCallback( 'onToggleLock', layerId );
					}
					break;
			}
		}

		/**
		 * Find the index of a layer by ID
		 *
		 * @param {string} layerId Layer ID to find
		 * @return {number} Index of the layer, or -1 if not found
		 */
		findLayerIndex( layerId ) {
			const layers = this.getLayers();
			for ( let i = 0; i < layers.length; i++ ) {
				if ( String( layers[ i ].id ) === String( layerId ) ) {
					return i;
				}
			}
			return -1;
		}

		/**
		 * Focus a layer item by index
		 *
		 * @param {number} index Layer index to focus
		 */
		focusLayerAtIndex( index ) {
			const layers = this.getLayers();
			if ( index < 0 || index >= layers.length ) {
				return;
			}

			const layerId = layers[ index ].id;
			this.focusLayerById( layerId );
		}

		/**
		 * Focus a layer item by ID
		 *
		 * @param {string} layerId Layer ID to focus
		 */
		focusLayerById( layerId ) {
			if ( !this.layerList ) {
				return;
			}

			const layerItem = this.layerList.querySelector(
				'.layer-item[data-layer-id="' + layerId + '"]'
			);

			if ( layerItem ) {
				// Focus the grab area (which is the focusable element within the layer item)
				const grabArea = layerItem.querySelector( '.layer-grab-area' );
				if ( grabArea ) {
					grabArea.focus();
				}
			}
		}

		/**
		 * Get the currently focused layer ID
		 *
		 * @return {string|null} Focused layer ID or null
		 */
		getFocusedLayerId() {
			const focused = document.activeElement;
			if ( !focused || !this.layerList || !this.layerList.contains( focused ) ) {
				return null;
			}

			const layerItem = focused.closest( '.layer-item' );
			return layerItem ? layerItem.dataset.layerId : null;
		}

		/**
		 * Check if a specific layer item is focused
		 *
		 * @param {string} layerId Layer ID to check
		 * @return {boolean} True if the layer is focused
		 */
		isLayerFocused( layerId ) {
			return this.getFocusedLayerId() === layerId;
		}

		/**
		 * Trigger a callback if it exists
		 *
		 * @param {string} name Callback name
		 * @param {...*} args Arguments to pass to the callback
		 */
		triggerCallback( name, ...args ) {
			if ( this.callbacks && typeof this.callbacks[ name ] === 'function' ) {
				this.callbacks[ name ]( ...args );
			}
		}

		/**
		 * Update the layer list reference
		 *
		 * @param {HTMLElement} layerList New layer list element
		 */
		setLayerList( layerList ) {
			this.layerList = layerList;
		}

		/**
		 * Update callbacks
		 *
		 * @param {Object} callbacks New callbacks object
		 */
		setCallbacks( callbacks ) {
			this.callbacks = callbacks || {};
		}

		/**
		 * Check if a key event should trigger selection
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 * @return {boolean} True if the event should trigger selection
		 */
		isSelectionKey( e ) {
			return e.key === 'Enter' || e.key === ' ';
		}

		/**
		 * Check if a key event is a navigation key
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 * @return {boolean} True if the event is a navigation key
		 */
		isNavigationKey( e ) {
			return [ 'ArrowUp', 'ArrowDown', 'Home', 'End' ].indexOf( e.key ) !== -1;
		}

		/**
		 * Check if a key event is a delete key
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 * @return {boolean} True if the event is a delete key
		 */
		isDeleteKey( e ) {
			return e.key === 'Delete' || e.key === 'Backspace';
		}

		/**
		 * Check if a key event is a shortcut key (V for visibility, L for lock)
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 * @return {string|null} Shortcut type ('visibility', 'lock') or null
		 */
		getShortcutType( e ) {
			if ( e.ctrlKey || e.metaKey ) {
				return null;
			}

			const key = e.key.toLowerCase();
			if ( key === 'v' ) {
				return 'visibility';
			}
			if ( key === 'l' ) {
				return 'lock';
			}
			return null;
		}

		/**
		 * Get navigation direction from key event
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 * @return {number|null} Direction (-1 for up/home, 1 for down/end, null for first/last)
		 */
		getNavigationDirection( e ) {
			switch ( e.key ) {
				case 'ArrowUp':
					return -1;
				case 'ArrowDown':
					return 1;
				case 'Home':
					return 'first';
				case 'End':
					return 'last';
				default:
					return null;
			}
		}

		/**
		 * Destroy the event handler and clean up
		 */
		destroy() {
			// Note: If addTargetListener was used, the EventTracker should handle cleanup
			// If not, we can't remove listeners without stored references
			this.layerList = null;
			this.callbacks = {};
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.LayerItemEvents = LayerItemEvents;

		// Backward compatibility - direct window export
		window.LayerItemEvents = LayerItemEvents;
	}

	// CommonJS export for testing
	/* eslint-disable-next-line no-undef */
	if ( typeof module !== 'undefined' && module.exports ) {
		/* eslint-disable-next-line no-undef */
		module.exports = LayerItemEvents;
	}
}() );
