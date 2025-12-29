/**
 * Preset Dropdown UI Component for Layers Editor
 *
 * Provides a dropdown menu for selecting and managing style presets.
 * Integrates with PresetManager for storage and Toolbar for display.
 *
 * @class PresetDropdown
 */
( function () {
	'use strict';

	/**
	 * PresetDropdown class
	 */
	class PresetDropdown {
		/**
		 * Create a PresetDropdown instance
		 *
		 * @param {Object} options Configuration options
		 * @param {PresetManager} options.presetManager PresetManager instance
		 * @param {Function} options.onSelect Callback when preset selected
		 * @param {Function} options.onSave Callback for save current style
		 * @param {Function} [options.getMessage] i18n message function
		 * @param {HTMLElement} [options.container] Container element
		 */
		constructor( options ) {
			if ( !options || !options.presetManager ) {
				throw new Error( 'PresetDropdown requires presetManager option' );
			}

			/**
			 * PresetManager instance
			 *
			 * @type {PresetManager}
			 */
			this.presetManager = options.presetManager;

			/**
			 * Callback when preset is selected
			 *
			 * @type {Function}
			 */
			this.onSelect = options.onSelect || ( () => {} );

			/**
			 * Callback to get current style for saving
			 *
			 * @type {Function}
			 */
			this.onSave = options.onSave || ( () => {} );

			/**
			 * i18n message function
			 *
			 * @type {Function}
			 */
			this.getMessage = options.getMessage || ( ( key ) => key );

			/**
			 * DialogManager for accessible dialogs (optional but recommended)
			 *
			 * @type {Object|null}
			 */
			this.dialogManager = options.dialogManager || null;

			/**
			 * Current tool type
			 *
			 * @type {string|null}
			 */
			this.currentTool = null;

			/**
			 * DOM elements
			 *
			 * @type {Object}
			 */
			this.elements = {
				container: null,
				button: null,
				dropdown: null
			};

			/**
			 * Whether dropdown is open
			 *
			 * @type {boolean}
			 */
			this.isOpen = false;

			/**
			 * Bound event handlers for cleanup
			 *
			 * @type {Object}
			 */
			this.boundHandlers = {
				onDocumentClick: this.handleDocumentClick.bind( this ),
				onKeyDown: this.handleKeyDown.bind( this )
			};

			// Build UI
			this.buildUI( options.container );

			// Subscribe to preset changes
			this.unsubscribe = this.presetManager.subscribe(
				this.handlePresetChange.bind( this )
			);
		}

		/**
		 * Build the dropdown UI
		 *
		 * @param {HTMLElement} [container] Optional container
		 */
		buildUI( container ) {
			// Main container
			this.elements.container = document.createElement( 'div' );
			this.elements.container.className = 'layers-preset-dropdown';

			// Trigger button
			this.elements.button = document.createElement( 'button' );
			this.elements.button.type = 'button';
			this.elements.button.className = 'layers-preset-button';
			this.elements.button.setAttribute( 'aria-haspopup', 'listbox' );
			this.elements.button.setAttribute( 'aria-expanded', 'false' );
			this.elements.button.innerHTML = `
				<span class="layers-preset-button-icon">${ this.getPresetIcon() }</span>
				<span class="layers-preset-button-label">${ this.getMessage( 'layers-presets' ) }</span>
				<span class="layers-preset-button-arrow">▼</span>
			`;
			this.elements.button.addEventListener( 'click', () => this.toggle() );

			// Dropdown menu
			this.elements.dropdown = document.createElement( 'div' );
			this.elements.dropdown.className = 'layers-preset-menu';
			this.elements.dropdown.setAttribute( 'role', 'listbox' );
			this.elements.dropdown.style.display = 'none';

			// Assemble
			this.elements.container.appendChild( this.elements.button );
			this.elements.container.appendChild( this.elements.dropdown );

			if ( container ) {
				container.appendChild( this.elements.container );
			}
		}

		/**
		 * Get preset icon SVG
		 *
		 * @return {string} SVG markup
		 */
		getPresetIcon() {
			return `<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
				<path d="M17 3H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H3V5h14v10z"/>
				<path d="M5 7h2v2H5zM5 11h2v2H5zM9 7h6v2H9zM9 11h6v2H9z"/>
			</svg>`;
		}

		/**
		 * Set the current tool and refresh presets
		 *
		 * @param {string} tool Tool type
		 */
		setTool( tool ) {
			this.currentTool = tool;
			this.hasSelectedLayer = false;
			this.updateButtonState();
		}

		/**
		 * Set the layer type from a selected layer (takes precedence over tool)
		 *
		 * @param {string|null} layerType Layer type, or null if no selection
		 */
		setLayerType( layerType ) {
			if ( layerType ) {
				this.currentTool = layerType;
				this.hasSelectedLayer = true;
			} else {
				this.hasSelectedLayer = false;
			}
			this.updateButtonState();
		}

		/**
		 * Update button enabled/disabled state
		 */
		updateButtonState() {
			const supported = this.presetManager.isToolSupported( this.currentTool );
			this.elements.button.disabled = !supported;
			this.elements.button.setAttribute(
				'title',
				supported
					? this.getMessage( 'layers-presets-tooltip' )
					: this.getMessage( 'layers-presets-not-supported' )
			);
		}

		/**
		 * Toggle dropdown open/closed
		 */
		toggle() {
			if ( this.isOpen ) {
				this.close();
			} else {
				this.open();
			}
		}

		/**
		 * Open the dropdown
		 */
		open() {
			if ( !this.currentTool || !this.presetManager.isToolSupported( this.currentTool ) ) {
				return;
			}

			this.isOpen = true;
			this.renderMenu();
			this.elements.dropdown.style.display = 'block';
			this.elements.button.setAttribute( 'aria-expanded', 'true' );

			// Add document listeners for closing
			document.addEventListener( 'click', this.boundHandlers.onDocumentClick, true );
			document.addEventListener( 'keydown', this.boundHandlers.onKeyDown );
		}

		/**
		 * Close the dropdown
		 */
		close() {
			this.isOpen = false;
			this.elements.dropdown.style.display = 'none';
			this.elements.button.setAttribute( 'aria-expanded', 'false' );

			// Remove document listeners
			document.removeEventListener( 'click', this.boundHandlers.onDocumentClick, true );
			document.removeEventListener( 'keydown', this.boundHandlers.onKeyDown );
		}

		/**
		 * Render the dropdown menu content
		 */
		renderMenu() {
			const presets = this.presetManager.getPresetsForTool( this.currentTool );
			const defaultPreset = this.presetManager.getDefaultPreset( this.currentTool );
			const defaultId = defaultPreset ? defaultPreset.id : null;

			// Clear existing content
			this.elements.dropdown.innerHTML = '';

			// Preset list section
			if ( presets.length > 0 ) {
				const listSection = document.createElement( 'div' );
				listSection.className = 'layers-preset-section';

				presets.forEach( ( preset ) => {
					const item = this.createPresetItem( preset, preset.id === defaultId );
					listSection.appendChild( item );
				} );

				this.elements.dropdown.appendChild( listSection );
			} else {
				// No presets message
				const emptyMsg = document.createElement( 'div' );
				emptyMsg.className = 'layers-preset-empty';
				emptyMsg.textContent = this.getMessage( 'layers-presets-none' );
				this.elements.dropdown.appendChild( emptyMsg );
			}

			// Divider
			const divider = document.createElement( 'hr' );
			divider.className = 'layers-preset-divider';
			this.elements.dropdown.appendChild( divider );

			// Actions section
			const actionsSection = document.createElement( 'div' );
			actionsSection.className = 'layers-preset-actions';

			// Save current style
			const saveBtn = document.createElement( 'button' );
			saveBtn.type = 'button';
			saveBtn.className = 'layers-preset-action';
			saveBtn.innerHTML = `
				<span class="layers-preset-action-icon">+</span>
				${ this.getMessage( 'layers-presets-save-current' ) }
			`;
			saveBtn.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.handleSaveClick();
			} );
			actionsSection.appendChild( saveBtn );

			this.elements.dropdown.appendChild( actionsSection );
		}

		/**
		 * Create a preset item element
		 *
		 * @param {Object} preset Preset object
		 * @param {boolean} isDefault Whether this is the default
		 * @return {HTMLElement} Preset item element
		 */
		createPresetItem( preset, isDefault ) {
			const item = document.createElement( 'div' );
			item.className = 'layers-preset-item';
			item.setAttribute( 'role', 'option' );
			item.setAttribute( 'data-preset-id', preset.id );

			if ( isDefault ) {
				item.classList.add( 'layers-preset-item--default' );
			}
			if ( preset.builtIn ) {
				item.classList.add( 'layers-preset-item--builtin' );
			}

			// Color swatch preview
			const swatch = document.createElement( 'span' );
			swatch.className = 'layers-preset-swatch';
			swatch.style.backgroundColor = preset.style.stroke ||
				preset.style.fill ||
				preset.style.color ||
				'#000000';
			item.appendChild( swatch );

			// Name
			const name = document.createElement( 'span' );
			name.className = 'layers-preset-name';
			name.textContent = preset.name;
			item.appendChild( name );

			// Default star
			if ( isDefault ) {
				const star = document.createElement( 'span' );
				star.className = 'layers-preset-star';
				star.textContent = '★';
				star.title = this.getMessage( 'layers-presets-default' );
				item.appendChild( star );
			}

			// Actions (for user presets)
			if ( !preset.builtIn ) {
				const actions = document.createElement( 'span' );
				actions.className = 'layers-preset-item-actions';

				// Set as default button
				if ( !isDefault ) {
					const setDefaultBtn = document.createElement( 'button' );
					setDefaultBtn.type = 'button';
					setDefaultBtn.className = 'layers-preset-item-action';
					setDefaultBtn.innerHTML = '☆';
					setDefaultBtn.title = this.getMessage( 'layers-presets-set-default' );
					setDefaultBtn.addEventListener( 'click', ( e ) => {
						e.stopPropagation();
						this.handleSetDefault( preset.id );
					} );
					actions.appendChild( setDefaultBtn );
				}

				// Delete button
				const deleteBtn = document.createElement( 'button' );
				deleteBtn.type = 'button';
				deleteBtn.className = 'layers-preset-item-action layers-preset-item-action--delete';
				deleteBtn.innerHTML = '×';
				deleteBtn.title = this.getMessage( 'layers-presets-delete' );
				deleteBtn.addEventListener( 'click', ( e ) => {
					e.stopPropagation();
					this.handleDelete( preset.id, preset.name );
				} );
				actions.appendChild( deleteBtn );

				item.appendChild( actions );
			}

			// Click to apply
			item.addEventListener( 'click', () => {
				this.handlePresetClick( preset );
			} );

			return item;
		}

		/**
		 * Handle preset item click
		 *
		 * @param {Object} preset Preset object
		 */
		handlePresetClick( preset ) {
			this.close();
			this.onSelect( preset.style, preset );
		}

		/**
		 * Handle save current style click
		 * Uses accessible dialog if DialogManager is available
		 */
		async handleSaveClick() {
			this.close();

			// Prompt for name using accessible dialog
			let name = null;
			if ( this.dialogManager && typeof this.dialogManager.showPromptDialogAsync === 'function' ) {
				name = await this.dialogManager.showPromptDialogAsync( {
					title: this.getMessage( 'layers-presets-save-title', 'Save Preset' ),
					message: this.getMessage( 'layers-presets-enter-name', 'Enter a name for the preset:' ),
					placeholder: this.getMessage( 'layers-presets-name-placeholder', 'Preset name' )
				} );
			} else {
				// Fallback to native prompt only if DialogManager unavailable
				// eslint-disable-next-line no-alert
				name = window.prompt( this.getMessage( 'layers-presets-enter-name', 'Enter a name for the preset:' ) );
			}

			if ( !name || !name.trim() ) {
				return;
			}

			// Get current style from callback
			this.onSave( ( style ) => {
				if ( style ) {
					const preset = this.presetManager.addPreset(
						this.currentTool,
						name.trim(),
						style
					);
					if ( preset ) {
						this.showNotification(
							this.getMessage( 'layers-presets-saved' )
								.replace( '$1', preset.name )
						);
					}
				}
			} );
		}

		/**
		 * Handle set as default click
		 *
		 * @param {string} presetId Preset ID
		 */
		handleSetDefault( presetId ) {
			this.presetManager.setDefaultPreset( this.currentTool, presetId );
			this.renderMenu(); // Refresh
		}

		/**
		 * Handle delete click
		 * Uses accessible dialog if DialogManager is available
		 *
		 * @param {string} presetId Preset ID
		 * @param {string} name Preset name for confirmation
		 */
		async handleDelete( presetId, name ) {
			const confirmMsg = this.getMessage( 'layers-presets-confirm-delete', 'Delete preset "$1"?' )
				.replace( '$1', name );

			let confirmed = false;
			if ( this.dialogManager && typeof this.dialogManager.showConfirmDialog === 'function' ) {
				confirmed = await this.dialogManager.showConfirmDialog( {
					title: this.getMessage( 'layers-presets-delete-title', 'Delete Preset' ),
					message: confirmMsg,
					isDanger: true,
					confirmText: this.getMessage( 'layers-delete', 'Delete' ),
					cancelText: this.getMessage( 'layers-cancel', 'Cancel' )
				} );
			} else {
				// Fallback to native confirm only if DialogManager unavailable
				// eslint-disable-next-line no-alert
				confirmed = window.confirm( confirmMsg );
			}

			if ( confirmed ) {
				this.presetManager.deletePreset( this.currentTool, presetId );
				this.renderMenu(); // Refresh
			}
		}

		/**
		 * Handle document click (close on outside click)
		 *
		 * @param {Event} e Click event
		 */
		handleDocumentClick( e ) {
			if ( !this.elements.container.contains( e.target ) ) {
				this.close();
			}
		}

		/**
		 * Handle keyboard events
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 */
		handleKeyDown( e ) {
			if ( e.key === 'Escape' ) {
				this.close();
				this.elements.button.focus();
			}
		}

		/**
		 * Handle preset manager changes
		 */
		handlePresetChange() {
			if ( this.isOpen ) {
				this.renderMenu();
			}
		}

		/**
		 * Show notification
		 *
		 * @param {string} message Message to show
		 */
		showNotification( message ) {
			if ( typeof mw !== 'undefined' && mw.notify ) {
				mw.notify( message, { type: 'info', autoHide: true } );
			}
		}

		/**
		 * Get the container element
		 *
		 * @return {HTMLElement} Container element
		 */
		getElement() {
			return this.elements.container;
		}

		/**
		 * Destroy and clean up
		 */
		destroy() {
			this.close();

			if ( this.unsubscribe ) {
				this.unsubscribe();
			}

			if ( this.elements.container && this.elements.container.parentNode ) {
				this.elements.container.parentNode.removeChild( this.elements.container );
			}

			this.elements = {};
			this.presetManager = null;
			this.onSelect = null;
			this.onSave = null;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.PresetDropdown = PresetDropdown;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PresetDropdown;
	}
}() );
