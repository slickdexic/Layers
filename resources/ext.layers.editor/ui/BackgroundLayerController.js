/**
 * BackgroundLayerController - Manages background layer item UI
 * Extracted from LayerPanel.js for better separation of concerns
 *
 * Handles:
 * - Background layer item DOM creation
 * - Visibility toggle
 * - Opacity control
 * - Color picker for slide mode
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
		 * Check if editor is in slide mode
		 *
		 * @return {boolean} True if in slide mode
		 */
		isSlideMode() {
			if ( this.editor && this.editor.stateManager ) {
				return !!this.editor.stateManager.get( 'isSlide' );
			}
			return false;
		}

		/**
		 * Get the current slide background color
		 *
		 * @return {string} Background color (hex string)
		 */
		getSlideBackgroundColor() {
			if ( this.editor && this.editor.stateManager ) {
				return this.editor.stateManager.get( 'slideBackgroundColor' ) || '#ffffff';
			}
			return '#ffffff';
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
				// CRITICAL: Also update color swatch in slide mode
				if ( this.isSlideMode() ) {
					const colorIcon = bgItem.querySelector( '.background-icon' );
					if ( colorIcon ) {
						const currentColor = this.getSlideBackgroundColor();
						const isTransparent = !currentColor || currentColor === 'transparent' || currentColor === 'none';
						if ( isTransparent ) {
							colorIcon.style.cssText = `width: 20px; height: 20px; border: 1px solid #999; border-radius: 3px; cursor: pointer; margin-right: 6px; flex-shrink: 0; background-color: #fff; background-image: linear-gradient(45deg, #ff0000 25%, transparent 25%), linear-gradient(-45deg, #ff0000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ff0000 75%), linear-gradient(-45deg, transparent 75%, #ff0000 75%); background-size: 6px 6px; background-position: 0 0, 0 3px, 3px -3px, -3px 0px;`;
						} else {
							colorIcon.style.cssText = `width: 20px; height: 20px; border: 1px solid #999; border-radius: 3px; cursor: pointer; margin-right: 6px; flex-shrink: 0; background-color: ${ currentColor };`;
						}
					}
				}
			}
		}

		/**
		 * Create the background layer item DOM element
		 *
		 * @return {HTMLElement} Background layer item element
		 */
		createBackgroundLayerItem() {
			const t = this.msg.bind( this );
			const isSlide = this.isSlideMode();
			const item = document.createElement( 'div' );
			item.className = 'layer-item background-layer-item';
			if ( isSlide ) {
				item.classList.add( 'background-layer-item--slide' );
				item.classList.add( 'canvas-layer-item' );
			}
			item.dataset.layerId = '__background__';

			// ARIA attributes - use "Canvas" for slides, "Background Image" for images
			item.setAttribute( 'role', 'option' );
			item.setAttribute( 'aria-selected', 'false' );
			const label = isSlide ?
				t( 'layers-slide-canvas-layer', 'Canvas' ) :
				t( 'layers-background-layer', 'Background Image' );
			item.setAttribute( 'aria-label', label );

			if ( isSlide ) {
				// For slides, create a Canvas layer with size and color controls
				return this.createCanvasLayerContent( item, t );
			} else {
				// For images, use the existing background layer style
				return this.createImageBackgroundContent( item, t );
			}
		}

		/**
		 * Create Canvas layer content for slides with size and color controls
		 *
		 * @param {HTMLElement} item The layer item container
		 * @param {Function} t Translation function
		 * @return {HTMLElement} The populated item
		 */
		createCanvasLayerContent( item, t ) {
			// Create a simple row layout for the canvas layer - like other layers
			// W/H and color controls are in the properties panel when selected

			// Color swatch (clickable)
			const colorSwatch = this.createColorSwatchIcon();

			// Visibility toggle
			const visibilityBtn = this.createVisibilityButton( t );

			// Name label - "Canvas"
			const name = document.createElement( 'span' );
			name.className = 'layer-name canvas-name';
			name.textContent = t( 'layers-slide-canvas-layer', 'Canvas' );
			name.style.cssText = 'font-weight: 600; flex: 1;';

			// Opacity slider container
			const opacityContainer = this.createOpacityControl( t );

			item.appendChild( colorSwatch );
			item.appendChild( visibilityBtn );
			item.appendChild( name );
			item.appendChild( opacityContainer );

			// Make this item selectable
			const clickHandler = ( e ) => {
				// Don't select if clicking on controls
				if ( e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' ) {
					return;
				}
				// Stop propagation to prevent LayerPanel's generic click handler from firing
				e.stopPropagation();
				this.selectCanvasLayer();
			};

			if ( this.addTargetListener ) {
				this.addTargetListener( item, 'click', clickHandler );
			} else {
				item.addEventListener( 'click', clickHandler );
			}

			return item;
		}

		/**
		 * Select the canvas layer (shows properties in properties panel)
		 */
		selectCanvasLayer() {
			if ( this.editor && this.editor.stateManager ) {
				// CRITICAL: Update properties panel FIRST, before touching state
				// This prevents the subscription handler from showing "Layer not found"
				if ( this.editor.layerPanel && typeof this.editor.layerPanel.showCanvasProperties === 'function' ) {
					this.editor.layerPanel.showCanvasProperties();
				} else {
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.warn( '[BackgroundLayerController] showCanvasProperties not available' );
					}
				}

				// Now set state (this triggers subscriptions)
				// Set canvas selection flag FIRST (before clearing selectedLayerIds)
				this.editor.stateManager.set( 'canvasLayerSelected', true );
				// Clear regular layer selection
				this.editor.stateManager.set( 'selectedLayerIds', [] );
			}

			// Update visual selection state
			const item = this.layerList && this.layerList.querySelector( '.background-layer-item' );
			if ( item ) {
				// Remove selection from other items
				const allItems = this.layerList.querySelectorAll( '.layer-item' );
				allItems.forEach( ( i ) => i.classList.remove( 'selected' ) );
				// Add selection to canvas item
				item.classList.add( 'selected' );
				item.setAttribute( 'aria-selected', 'true' );
			}
		}

		/**
		 * Set canvas dimension (width or height)
		 * Called from the properties panel when canvas is selected
		 *
		 * @param {string} dimension 'width' or 'height'
		 * @param {number} value New dimension value
		 */
		setCanvasDimension( dimension, value ) {
			if ( !this.editor || !this.editor.stateManager ) {
				return;
			}

			const stateKey = dimension === 'width' ? 'slideCanvasWidth' : 'slideCanvasHeight';
			this.editor.stateManager.set( stateKey, value );

			// Also update baseWidth/baseHeight for consistency
			const baseKey = dimension === 'width' ? 'baseWidth' : 'baseHeight';
			this.editor.stateManager.set( baseKey, value );

			// Mark dirty
			this.editor.stateManager.set( 'isDirty', true );

			// Resize canvas using setBaseDimensions which actually updates canvas element
			if ( this.editor.canvasManager ) {
				const width = this.editor.stateManager.get( 'slideCanvasWidth' ) || 800;
				const height = this.editor.stateManager.get( 'slideCanvasHeight' ) || 600;
				if ( this.editor.canvasManager.setBaseDimensions ) {
					this.editor.canvasManager.setBaseDimensions( width, height );
				} else {
					// Fallback
					if ( this.editor.canvasManager.resizeCanvas ) {
						this.editor.canvasManager.resizeCanvas();
					}
					this.editor.canvasManager.redraw();
				}
			}
		}

		/**
		 * Create image background layer content (original design)
		 *
		 * @param {HTMLElement} item The layer item container
		 * @param {Function} t Translation function
		 * @return {HTMLElement} The populated item
		 */
		createImageBackgroundContent( item, t ) {
			// Background icon
			const iconArea = this.createBackgroundIcon();

			// Visibility toggle
			const visibilityBtn = this.createVisibilityButton( t );

			// Name label
			const name = document.createElement( 'span' );
			name.className = 'layer-name background-name';
			name.textContent = t( 'layers-background-layer', 'Background Image' );
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
		 * Create the background icon (image icon) for image mode
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
		 * Create a color swatch icon for slide mode (display only)
		 * The actual color picker is in the Properties Panel
		 *
		 * @return {HTMLElement} Color swatch display element
		 */
		createColorSwatchIcon() {
			const t = this.msg.bind( this );
			const color = this.getSlideBackgroundColor();

			// Use span instead of button - this is now display-only
			const swatchDisplay = document.createElement( 'span' );
			swatchDisplay.className = 'layer-background-color-swatch';
			swatchDisplay.title = t( 'layers-canvas-color-preview', 'Canvas color (edit in Properties panel)' );
			swatchDisplay.setAttribute( 'aria-label', t( 'layers-canvas-color-preview', 'Canvas color' ) );
			// Use red diagonal stripe for transparent (matching ColorPickerDialog exactly)
			const isTransparent = !color || color === 'transparent' || color === 'none';
			swatchDisplay.style.cssText = `
				display: inline-block;
				width: 20px;
				height: 20px;
				margin: 4px;
				border: 2px solid #ccc;
				border-radius: 4px;
				background: ${ isTransparent ? 'repeating-linear-gradient(45deg, #ff0000 0, #ff0000 4px, transparent 4px, transparent 8px)' : color };
			`;

			return swatchDisplay;
		}

		/**
		 * Open color picker for slide background
		 *
		 * @param {HTMLElement} anchorElement Element to anchor picker to
		 */
		openColorPicker( anchorElement ) {
			const currentColor = this.getSlideBackgroundColor();

			// Use toolbar's color picker if available
			if ( this.editor && this.editor.toolbar &&
				typeof this.editor.toolbar.openColorPickerDialog === 'function' ) {
				this.editor.toolbar.openColorPickerDialog( anchorElement, currentColor, {
					allowTransparent: true,
					onApply: ( newColor ) => {
						this.setSlideBackgroundColor( newColor );
					}
				} );
			} else {
				// Fallback: use browser's native color input
				const colorInput = document.createElement( 'input' );
				colorInput.type = 'color';
				colorInput.value = currentColor === 'transparent' ? '#ffffff' : currentColor;
				colorInput.style.position = 'absolute';
				colorInput.style.opacity = '0';
				colorInput.style.pointerEvents = 'none';
				document.body.appendChild( colorInput );

				colorInput.addEventListener( 'change', () => {
					this.setSlideBackgroundColor( colorInput.value );
					document.body.removeChild( colorInput );
				} );

				colorInput.addEventListener( 'blur', () => {
					setTimeout( () => {
						if ( colorInput.parentNode ) {
							document.body.removeChild( colorInput );
						}
					}, 100 );
				} );

				colorInput.click();
			}
		}

		/**
		 * Set slide background color
		 *
		 * @param {string} color New background color
		 */
		setSlideBackgroundColor( color ) {
			if ( this.editor && this.editor.stateManager ) {
				this.editor.stateManager.set( 'slideBackgroundColor', color );

				// Update canvas
				if ( this.editor.canvasManager && this.editor.canvasManager.setBackgroundColor ) {
					this.editor.canvasManager.setBackgroundColor( color );
				}

				// Mark dirty
				this.editor.stateManager.set( 'isDirty', true );

				// Redraw
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.redraw();
				}

				// Re-render the background layer item to update color swatch
				this.render();

				// Update Properties Panel swatch if it exists
				if ( this.editor.layerPanel && this.editor.layerPanel.updateCanvasColorSwatch ) {
					this.editor.layerPanel.updateCanvasColorSwatch( color );
				}
			}
		}

		/**
		 * Create the visibility toggle button
		 *
		 * @param {Function} t Translation function
		 * @return {HTMLElement} Visibility button element
		 */
		createVisibilityButton( t ) {
		const bgVisible = this.getBackgroundVisible();
		const visibilityBtn = document.createElement( 'button' );
		visibilityBtn.type = 'button';
		visibilityBtn.className = 'background-visibility-btn';
		visibilityBtn.innerHTML = bgVisible ?
			'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 4c-2.5 0-4.7 1.5-6 4 1.3 2.5 3.5 4 6 4s4.7-1.5 6-4c-1.3-2.5-3.5-4-6-4zm0 6.5c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z"/></svg>' :
			'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M13.5 3l-11 11m-0.5-6c1.3 2.5 3.5 4 6 4 0.7 0 1.4-0.1 2-0.3m3-1.7c1-1 1.7-2.3 2-3-1.3-2.5-3.5-4-6-4-0.7 0-1.4 0.1-2 0.3"/></svg>';
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
			const isSlide = this.isSlideMode();

			// Update visibility icon
			const visibilityBtn = item.querySelector( '.background-visibility-btn' );
			if ( visibilityBtn && IconFactory ) {
				while ( visibilityBtn.firstChild ) {
					visibilityBtn.removeChild( visibilityBtn.firstChild );
				}
				visibilityBtn.appendChild( IconFactory.createEyeIcon( bgVisible ) );
				visibilityBtn.setAttribute( 'aria-pressed', bgVisible ? 'true' : 'false' );
			}

			// Update opacity slider and label (both image mode and slide mode)
			const bgOpacity = this.getBackgroundOpacity();
			const opacitySlider = item.querySelector( '.background-opacity-slider' );
			const opacityLabel = item.querySelector( '.background-opacity-label' );
			if ( opacitySlider && document.activeElement !== opacitySlider ) {
				opacitySlider.value = String( Math.round( bgOpacity * 100 ) );
			}
			if ( opacityLabel ) {
				opacityLabel.textContent = Math.round( bgOpacity * 100 ) + '%';
			}

			// Update slide-specific controls
			if ( isSlide ) {
				// Update color swatch - use red diagonal stripe for transparent (matching ColorPickerDialog)
				const colorSwatch = item.querySelector( '.layer-background-color-swatch' );
				if ( colorSwatch ) {
					const color = this.getSlideBackgroundColor();
					const isTransparent = !color || color === 'transparent' || color === 'none';
					colorSwatch.style.background = isTransparent ?
						'repeating-linear-gradient(45deg, #ff0000 0, #ff0000 4px, transparent 4px, transparent 8px)' :
						color;
				}

				// Update canvas size inputs (if not focused)
				const widthInput = item.querySelector( '.canvas-width-input' );
				const heightInput = item.querySelector( '.canvas-height-input' );
				if ( this.editor && this.editor.stateManager ) {
					if ( widthInput && document.activeElement !== widthInput ) {
						widthInput.value = String( this.editor.stateManager.get( 'slideCanvasWidth' ) || 800 );
					}
					if ( heightInput && document.activeElement !== heightInput ) {
						heightInput.value = String( this.editor.stateManager.get( 'slideCanvasHeight' ) || 600 );
					}
				}
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
