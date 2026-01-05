/**
 * BackgroundLayerController - Manages background layer item UI
 * Extracted from LayerPanel.js for better separation of concerns
 *
 * Handles:
 * - Background layer item DOM creation
 * - Visibility toggle
 * - Opacity control
 * - State synchronization with StateManager
 */
( function () {
	'use strict';

	/**
	 * Helper to get a class from namespace or global fallback
	 *
	 * @param {string} namespacePath - Path under window.Layers
	 * @param {string} globalName - Global fallback name
	 * @return {Function|Object|null} The class/object or null if not found
	 */
	function getClass( namespacePath, globalName ) {
		if ( typeof window === 'undefined' ) {
			return null;
		}
		const parts = namespacePath.split( '.' );
		let obj = window.Layers;
		for ( const part of parts ) {
			obj = obj && obj[ part ];
		}
		return obj || window[ globalName ] || null;
	}

	/**
	 * Controller for the background layer item in the layer panel
	 */
	class BackgroundLayerController {
		/**
		 * Create a BackgroundLayerController instance
		 *
		 * @param {Object} config Configuration object
		 * @param {Object} config.editor Reference to the LayersEditor
		 * @param {HTMLElement} config.layerList The layer list container element
		 * @param {Function} config.msg Message function for i18n
		 * @param {Function} config.addTargetListener Function to add event listeners with cleanup
		 */
		constructor( config ) {
			this.config = config || {};
			this.editor = this.config.editor || null;
			this.layerList = this.config.layerList || null;
			this.msg = this.config.msg || ( ( key, fallback ) => fallback );
			this.addTargetListener = this.config.addTargetListener || null;
		}

		/**
		 * Render or update the background layer item in the layer list
		 * Creates the item if it doesn't exist, otherwise updates it
		 */
		render() {
			if ( !this.layerList ) {
				return;
			}

			let bgItem = this.layerList.querySelector( '.background-layer-item' );

			if ( !bgItem ) {
				bgItem = this.createBackgroundLayerItem();
				this.layerList.appendChild( bgItem );
			} else {
				this.updateBackgroundLayerItem( bgItem );
			}
		}

		/**
		 * Create the background layer item DOM element
		 *
		 * @return {HTMLElement} Background layer item element
		 */
		createBackgroundLayerItem() {
			const t = this.msg.bind( this );
			const item = document.createElement( 'div' );
			item.className = 'layer-item background-layer-item';
			item.dataset.layerId = '__background__';

			// ARIA attributes
			item.setAttribute( 'role', 'option' );
			item.setAttribute( 'aria-selected', 'false' );
			item.setAttribute( 'aria-label', t( 'layers-background-layer', 'Background Image' ) );

			// Background icon (image icon)
			const iconArea = this.createBackgroundIcon();

			// Visibility toggle
			const visibilityBtn = this.createVisibilityButton( t );

			// Name label
			const name = document.createElement( 'span' );
			name.className = 'layer-name background-name';
			name.textContent = t( 'layers-background-layer', 'Background Image' );
			// Not editable for background
			name.contentEditable = false;
			name.style.cursor = 'default';

			// Opacity slider container
			const opacityContainer = this.createOpacityControl( t );

			// Lock icon (always locked, not interactive)
			const lockIcon = this.createLockIcon( t );

			item.appendChild( iconArea );
			item.appendChild( visibilityBtn );
			item.appendChild( name );
			item.appendChild( opacityContainer );
			item.appendChild( lockIcon );

			return item;
		}

		/**
		 * Create the background icon (image icon)
		 *
		 * @return {HTMLElement} Icon area element
		 */
		createBackgroundIcon() {
			const iconArea = document.createElement( 'div' );
			iconArea.className = 'layer-background-icon';
			iconArea.style.cssText = 'width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;';

			const iconSvg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			iconSvg.setAttribute( 'width', '20' );
			iconSvg.setAttribute( 'height', '20' );
			iconSvg.setAttribute( 'viewBox', '0 0 24 24' );
			iconSvg.setAttribute( 'fill', 'none' );
			iconSvg.setAttribute( 'stroke', '#666' );
			iconSvg.setAttribute( 'stroke-width', '2' );
			iconSvg.setAttribute( 'aria-hidden', 'true' );

			// Image icon path (landscape with mountains)
			const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
			path.setAttribute( 'd', 'M3 5h18v14H3V5zm0 14l5-6 3 4 4-5 6 7' );
			path.setAttribute( 'stroke-linecap', 'round' );
			path.setAttribute( 'stroke-linejoin', 'round' );
			iconSvg.appendChild( path );

			// Sun circle
			const circle = document.createElementNS( 'http://www.w3.org/2000/svg', 'circle' );
			circle.setAttribute( 'cx', '16' );
			circle.setAttribute( 'cy', '9' );
			circle.setAttribute( 'r', '2' );
			iconSvg.appendChild( circle );

			iconArea.appendChild( iconSvg );
			return iconArea;
		}

		/**
		 * Create the visibility toggle button
		 *
		 * @param {Function} t Translation function
		 * @return {HTMLElement} Visibility button element
		 */
		createVisibilityButton( t ) {
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			const visibilityBtn = document.createElement( 'button' );
			visibilityBtn.className = 'layer-visibility background-visibility';
			visibilityBtn.type = 'button';

			const bgVisible = this.getBackgroundVisible();
			if ( IconFactory ) {
				visibilityBtn.appendChild( IconFactory.createEyeIcon( bgVisible ) );
			}

			visibilityBtn.title = t( 'layers-toggle-visibility', 'Toggle visibility' );
			visibilityBtn.setAttribute( 'aria-label', t( 'layers-background-visibility', 'Toggle background visibility' ) );
			visibilityBtn.setAttribute( 'aria-pressed', bgVisible ? 'true' : 'false' );

			const clickHandler = ( e ) => {
				e.stopPropagation();
				this.toggleBackgroundVisibility();
			};

			if ( this.addTargetListener ) {
				this.addTargetListener( visibilityBtn, 'click', clickHandler );
			} else {
				visibilityBtn.addEventListener( 'click', clickHandler );
			}

			return visibilityBtn;
		}

		/**
		 * Create the opacity slider control
		 *
		 * @param {Function} t Translation function
		 * @return {HTMLElement} Opacity container element
		 */
		createOpacityControl( t ) {
			const opacityContainer = document.createElement( 'div' );
			opacityContainer.className = 'background-opacity-container';
			opacityContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-left: auto;';

			const opacityLabel = document.createElement( 'span' );
			opacityLabel.className = 'background-opacity-label';
			opacityLabel.style.cssText = 'font-size: 11px; color: #666; min-width: 32px; text-align: right;';
			const currentOpacity = this.getBackgroundOpacity();
			opacityLabel.textContent = Math.round( currentOpacity * 100 ) + '%';

			const opacitySlider = document.createElement( 'input' );
			opacitySlider.type = 'range';
			opacitySlider.className = 'background-opacity-slider';
			opacitySlider.min = '0';
			opacitySlider.max = '100';
			opacitySlider.value = String( Math.round( currentOpacity * 100 ) );
			opacitySlider.title = t( 'layers-background-opacity', 'Background Opacity' );
			opacitySlider.setAttribute( 'aria-label', t( 'layers-background-opacity', 'Background Opacity' ) );
			opacitySlider.style.cssText = 'width: 60px; cursor: pointer;';

			const inputHandler = ( e ) => {
				const value = parseInt( e.target.value, 10 ) / 100;
				opacityLabel.textContent = Math.round( value * 100 ) + '%';
				this.setBackgroundOpacity( value );
			};

			if ( this.addTargetListener ) {
				this.addTargetListener( opacitySlider, 'input', inputHandler );
			} else {
				opacitySlider.addEventListener( 'input', inputHandler );
			}

			opacityContainer.appendChild( opacitySlider );
			opacityContainer.appendChild( opacityLabel );

			return opacityContainer;
		}

		/**
		 * Create the lock icon (always locked for background)
		 *
		 * @param {Function} t Translation function
		 * @return {HTMLElement} Lock icon element
		 */
		createLockIcon( t ) {
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			const lockIcon = document.createElement( 'div' );
			lockIcon.className = 'layer-lock background-lock';
			lockIcon.style.cssText = 'width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; opacity: 0.5;';
			lockIcon.title = t( 'layers-background-locked', 'Background is always locked' );

			if ( IconFactory ) {
				lockIcon.appendChild( IconFactory.createLockIcon( true ) );
			}

			return lockIcon;
		}

		/**
		 * Update the background layer item to reflect current state
		 *
		 * @param {HTMLElement} [item] The background layer item element (optional - will be found if not provided)
		 */
		updateBackgroundLayerItem( item ) {
			// If no item provided, find it
			if ( !item && this.layerList ) {
				item = this.layerList.querySelector( '.background-layer-item' );
			}

			// If still no item, nothing to update
			if ( !item ) {
				return;
			}

			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			const bgVisible = this.getBackgroundVisible();
			const bgOpacity = this.getBackgroundOpacity();

			// Update visibility icon
			const visibilityBtn = item.querySelector( '.background-visibility' );
			if ( visibilityBtn && IconFactory ) {
				while ( visibilityBtn.firstChild ) {
					visibilityBtn.removeChild( visibilityBtn.firstChild );
				}
				visibilityBtn.appendChild( IconFactory.createEyeIcon( bgVisible ) );
				visibilityBtn.setAttribute( 'aria-pressed', bgVisible ? 'true' : 'false' );
			}

			// Update opacity slider and label
			const opacitySlider = item.querySelector( '.background-opacity-slider' );
			const opacityLabel = item.querySelector( '.background-opacity-label' );
			if ( opacitySlider && document.activeElement !== opacitySlider ) {
				opacitySlider.value = String( Math.round( bgOpacity * 100 ) );
			}
			if ( opacityLabel ) {
				opacityLabel.textContent = Math.round( bgOpacity * 100 ) + '%';
			}
		}

		/**
		 * Get whether the background is visible
		 *
		 * @return {boolean} True if background is visible
		 */
		getBackgroundVisible() {
			if ( this.editor && this.editor.stateManager ) {
				const visible = this.editor.stateManager.get( 'backgroundVisible' );
				// Handle both boolean false and integer 0 (from API serialization)
				return visible !== false && visible !== 0;
			}
			return true;
		}

		/**
		 * Get the background opacity value
		 *
		 * @return {number} Opacity value between 0 and 1
		 */
		getBackgroundOpacity() {
			if ( this.editor && this.editor.stateManager ) {
				const opacity = this.editor.stateManager.get( 'backgroundOpacity' );
				return typeof opacity === 'number' ? opacity : 1.0;
			}
			return 1.0;
		}

		/**
		 * Toggle background visibility
		 */
		toggleBackgroundVisibility() {
			if ( this.editor && this.editor.stateManager ) {
				const current = this.getBackgroundVisible();
				const newValue = !current;
				this.editor.stateManager.set( 'backgroundVisible', newValue );
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.redraw();
				}
				this.render();
			}
		}

		/**
		 * Set background opacity
		 *
		 * @param {number} opacity Opacity value between 0 and 1
		 */
		setBackgroundOpacity( opacity ) {
			if ( this.editor && this.editor.stateManager ) {
				this.editor.stateManager.set( 'backgroundOpacity', Math.max( 0, Math.min( 1, opacity ) ) );
				if ( this.editor.canvasManager ) {
					// Use optimized redraw for slider interactions to avoid performance issues
					if ( this.editor.canvasManager.redrawOptimized ) {
						this.editor.canvasManager.redrawOptimized();
					} else {
						this.editor.canvasManager.redraw();
					}
				}
			}
		}

		/**
		 * Update the layer list reference
		 *
		 * @param {HTMLElement} layerList The new layer list container
		 */
		setLayerList( layerList ) {
			this.layerList = layerList;
		}

		/**
		 * Destroy the controller and clean up
		 */
		destroy() {
			this.editor = null;
			this.layerList = null;
			this.config = null;
		}
	}

	// Register in namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.BackgroundLayerController = BackgroundLayerController;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = BackgroundLayerController;
	}
}() );
