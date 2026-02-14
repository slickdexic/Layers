/**
 * GradientEditor - UI component for editing gradient fills
 *
 * Provides controls for:
 * - Fill type selection (solid/linear/radial)
 * - Gradient angle (for linear)
 * - Gradient center position (for radial)
 * - Color stop editor
 * - Preset gradients
 *
 * @module GradientEditor
 */
( function () {
	'use strict';

	/**
	 * Get message text with fallback
	 * @param {string} key - Message key
	 * @param {string} fallback - Fallback text
	 * @return {string} Message text
	 */
	function msg( key, fallback ) {
		if ( typeof mw !== 'undefined' && mw.message ) {
			const message = mw.message( key );
			if ( message.exists() ) {
				return message.text();
			}
		}
		return fallback;
	}

	/**
	 * Get EventTracker class
	 * @private
	 * @return {Function|null} EventTracker constructor
	 */
	function getEventTracker() {
		if ( typeof window !== 'undefined' &&
			window.Layers &&
			window.Layers.EventTracker ) {
			return window.Layers.EventTracker;
		}
		return null;
	}

	/**
	 * GradientEditor class
	 */
	class GradientEditor {
		/**
		 * Create a gradient editor
		 * @param {Object} options - Configuration options
		 * @param {Object} options.layer - Layer being edited
		 * @param {Function} options.onChange - Callback when gradient changes
		 * @param {HTMLElement} options.container - Container element
		 */
		constructor( options ) {
			this.layer = options.layer;
			this.onChange = options.onChange;
			this.onFillTypeChange = options.onFillTypeChange || null;
			this.container = options.container;
			this.currentGradient = this.layer.gradient ? this._cloneGradient( this.layer.gradient ) : null;
			this.fillType = this._determineFillType();

			// Create EventTracker for listener cleanup
			const EventTracker = getEventTracker();
			this.eventTracker = EventTracker ? new EventTracker() : null;

			this._build();
		}

		/**
		 * Determine current fill type
		 * @private
		 * @return {string} 'solid', 'linear', or 'radial'
		 */
		_determineFillType() {
			if ( this.layer.gradient && this.layer.gradient.type ) {
				return this.layer.gradient.type;
			}
			return 'solid';
		}

		/**
		 * Clone a gradient object
		 * @private
		 * @param {Object} gradient - Gradient to clone
		 * @return {Object} Cloned gradient
		 */
		_cloneGradient( gradient ) {
			if ( !gradient ) {
				return null;
			}
			return {
				type: gradient.type,
				angle: gradient.angle,
				centerX: gradient.centerX,
				centerY: gradient.centerY,
				radius: gradient.radius,
				colors: gradient.colors ? gradient.colors.map( ( c ) => ( { offset: c.offset, color: c.color } ) ) : []
			};
		}

		/**
		 * Add event listener with tracking for cleanup
		 * @private
		 * @param {EventTarget} element - Element to attach listener to
		 * @param {string} type - Event type
		 * @param {Function} handler - Handler function
		 */
		_addListener( element, type, handler ) {
			if ( this.eventTracker ) {
				this.eventTracker.add( element, type, handler );
			} else {
				element.addEventListener( type, handler );
			}
		}

		/**
		 * Build the editor UI
		 * @private
		 */
		_build() {
			// Clean up tracked listeners before destroying DOM
			if ( this.eventTracker ) {
				this.eventTracker.destroy();
				const EventTracker = getEventTracker();
				this.eventTracker = EventTracker ? new EventTracker() : null;
			}
			this.container.innerHTML = '';
			this.container.className = 'gradient-editor';

			// Fill type selector
			this._buildFillTypeSelector();

			// Gradient-specific controls (shown when gradient selected)
			if ( this.fillType !== 'solid' ) {
				this._buildGradientControls();
			}
		}

		/**
		 * Build fill type selector
		 * @private
		 */
		_buildFillTypeSelector() {
			const row = document.createElement( 'div' );
			row.className = 'property-field';

			const label = document.createElement( 'label' );
			label.textContent = msg( 'layers-prop-fill-type', 'Fill Type' );

			const select = document.createElement( 'select' );
			select.className = 'gradient-type-select';

			const options = [
				{ value: 'solid', text: msg( 'layers-fill-solid', 'Solid Color' ) },
				{ value: 'linear', text: msg( 'layers-fill-linear', 'Linear Gradient' ) },
				{ value: 'radial', text: msg( 'layers-fill-radial', 'Radial Gradient' ) }
			];

			options.forEach( ( opt ) => {
				const optionEl = document.createElement( 'option' );
				optionEl.value = opt.value;
				optionEl.textContent = opt.text;
				if ( opt.value === this.fillType ) {
					optionEl.selected = true;
				}
				select.appendChild( optionEl );
			} );

			this._addListener( select, 'change', this._onFillTypeChange.bind( this ) );

			row.appendChild( label );
			row.appendChild( select );
			this.container.appendChild( row );
		}

		/**
		 * Build gradient-specific controls
		 * @private
		 */
		_buildGradientControls() {
			// Preset selector
			this._buildPresetSelector();

			// Angle control (linear only)
			if ( this.fillType === 'linear' ) {
				this._buildAngleControl();
			}

			// Center controls (radial only)
			if ( this.fillType === 'radial' ) {
				this._buildRadialControls();
			}

			// Color stops editor
			this._buildColorStopsEditor();
		}

		/**
		 * Build preset gradient selector
		 * @private
		 */
		_buildPresetSelector() {
			const row = document.createElement( 'div' );
			row.className = 'property-field gradient-presets';

			const label = document.createElement( 'label' );
			label.textContent = msg( 'layers-gradient-preset', 'Preset' );

			const presetContainer = document.createElement( 'div' );
			presetContainer.className = 'gradient-preset-swatches';

			// Get presets from GradientRenderer
			const presets = this._getPresets();
			const presetNames = Object.keys( presets );

			presetNames.forEach( ( name ) => {
				const preset = presets[ name ];
				const swatch = document.createElement( 'button' );
				swatch.type = 'button';
				swatch.className = 'gradient-preset-swatch';
				swatch.title = name.charAt( 0 ).toUpperCase() + name.slice( 1 );
				swatch.style.background = this._gradientToCss( preset );

				this._addListener( swatch, 'click', () => {
					this._applyPreset( preset );
				} );

				presetContainer.appendChild( swatch );
			} );

			row.appendChild( label );
			row.appendChild( presetContainer );
			this.container.appendChild( row );
		}

		/**
		 * Get gradient presets
		 * @private
		 * @return {Object} Map of preset names to gradient definitions
		 */
		_getPresets() {
			if ( typeof window !== 'undefined' && window.Layers &&
				window.Layers.Renderers && window.Layers.Renderers.GradientRenderer ) {
				return window.Layers.Renderers.GradientRenderer.getPresets();
			}
			// Fallback presets
			return {
				'sunset': {
					type: 'linear', angle: 180,
					colors: [ { offset: 0, color: '#ff512f' }, { offset: 1, color: '#f09819' } ]
				},
				'ocean': {
					type: 'linear', angle: 135,
					colors: [ { offset: 0, color: '#2193b0' }, { offset: 1, color: '#6dd5ed' } ]
				},
				'forest': {
					type: 'linear', angle: 90,
					colors: [ { offset: 0, color: '#134e5e' }, { offset: 1, color: '#71b280' } ]
				}
			};
		}

		/**
		 * Convert gradient definition to CSS
		 * @private
		 * @param {Object} gradient - Gradient definition
		 * @return {string} CSS gradient string
		 */
		_gradientToCss( gradient ) {
			if ( !gradient || !gradient.colors || gradient.colors.length < 2 ) {
				return '#cccccc';
			}

			const stops = gradient.colors
				.map( ( c ) => c.color + ' ' + ( c.offset * 100 ) + '%' )
				.join( ', ' );

			if ( gradient.type === 'radial' ) {
				return 'radial-gradient(circle, ' + stops + ')';
			}

			const angle = ( gradient.angle || 0 ) + 90; // CSS uses different angle convention
			return 'linear-gradient(' + angle + 'deg, ' + stops + ')';
		}

		/**
		 * Apply a preset gradient
		 * @private
		 * @param {Object} preset - Preset gradient definition
		 */
		_applyPreset( preset ) {
			// Clone the preset and ensure correct type
			this.currentGradient = this._cloneGradient( preset );
			this.currentGradient.type = this.fillType; // Keep current type

			this._notifyChange();
			this._build(); // Rebuild to update controls
		}

		/**
		 * Build angle control for linear gradients
		 * @private
		 */
		_buildAngleControl() {
			const row = document.createElement( 'div' );
			row.className = 'property-field';

			const label = document.createElement( 'label' );
			label.textContent = msg( 'layers-gradient-angle', 'Angle' );

			const input = document.createElement( 'input' );
			input.type = 'range';
			input.min = 0;
			input.max = 360;
			input.step = 15;
			input.value = ( this.currentGradient && this.currentGradient.angle ) || 90;
			input.className = 'gradient-angle-slider';

			const valueDisplay = document.createElement( 'span' );
			valueDisplay.className = 'gradient-angle-value';
			valueDisplay.textContent = input.value + '°';

			this._addListener( input, 'input', ( e ) => {
				const angle = parseInt( e.target.value, 10 );
				valueDisplay.textContent = angle + '°';
				if ( this.currentGradient ) {
					this.currentGradient.angle = angle;
					this._notifyChange();
				}
			} );

			row.appendChild( label );
			row.appendChild( input );
			row.appendChild( valueDisplay );
			this.container.appendChild( row );
		}

		/**
		 * Build radial gradient controls
		 * @private
		 */
		_buildRadialControls() {
			// Radius control
			const radiusRow = document.createElement( 'div' );
			radiusRow.className = 'property-field';

			const radiusLabel = document.createElement( 'label' );
			radiusLabel.textContent = msg( 'layers-gradient-radius', 'Radius' );

			const radiusInput = document.createElement( 'input' );
			radiusInput.type = 'range';
			radiusInput.min = 0.1;
			radiusInput.max = 1.5;
			radiusInput.step = 0.1;
			radiusInput.value = ( this.currentGradient && this.currentGradient.radius ) || 0.7;
			radiusInput.className = 'gradient-radius-slider';

			const radiusValue = document.createElement( 'span' );
			radiusValue.className = 'gradient-radius-value';
			radiusValue.textContent = Math.round( radiusInput.value * 100 ) + '%';

			this._addListener( radiusInput, 'input', ( e ) => {
				const radius = parseFloat( e.target.value );
				radiusValue.textContent = Math.round( radius * 100 ) + '%';
				if ( this.currentGradient ) {
					this.currentGradient.radius = radius;
					this._notifyChange();
				}
			} );

			radiusRow.appendChild( radiusLabel );
			radiusRow.appendChild( radiusInput );
			radiusRow.appendChild( radiusValue );
			this.container.appendChild( radiusRow );
		}

		/**
		 * Build color stops editor
		 * @private
		 */
		_buildColorStopsEditor() {
			const container = document.createElement( 'div' );
			container.className = 'gradient-stops-editor';

			const header = document.createElement( 'div' );
			header.className = 'gradient-stops-header';

			const headerLabel = document.createElement( 'label' );
			headerLabel.textContent = msg( 'layers-gradient-colors', 'Colors' );

			const addButton = document.createElement( 'button' );
			addButton.type = 'button';
			addButton.className = 'gradient-add-stop';
			addButton.textContent = '+';
			addButton.title = msg( 'layers-gradient-add-stop', 'Add color stop' );
			this._addListener( addButton, 'click', this._addColorStop.bind( this ) );

			header.appendChild( headerLabel );
			header.appendChild( addButton );
			container.appendChild( header );

			// Color stops list
			const stopsList = document.createElement( 'div' );
			stopsList.className = 'gradient-stops-list';

			const colors = ( this.currentGradient && this.currentGradient.colors ) || [
				{ offset: 0, color: '#ffffff' },
				{ offset: 1, color: '#000000' }
			];

			colors.forEach( ( stop, index ) => {
				const stopRow = this._createColorStopRow( stop, index, colors.length );
				stopsList.appendChild( stopRow );
			} );

			container.appendChild( stopsList );
			this.container.appendChild( container );
			this.stopsListEl = stopsList;
		}

		/**
		 * Create a color stop row
		 * @private
		 * @param {Object} stop - Color stop { offset, color }
		 * @param {number} index - Stop index
		 * @param {number} totalStops - Total number of stops
		 * @return {HTMLElement} Stop row element
		 */
		_createColorStopRow( stop, index, totalStops ) {
			const row = document.createElement( 'div' );
			row.className = 'gradient-stop-row';
			row.dataset.index = index;

			// Color input
			const colorInput = document.createElement( 'input' );
			colorInput.type = 'color';
			colorInput.value = stop.color || '#000000';
			colorInput.className = 'gradient-stop-color';
			this._addListener( colorInput, 'input', ( e ) => {
				this._updateColorStop( index, 'color', e.target.value );
			} );

			// Offset slider
			const offsetInput = document.createElement( 'input' );
			offsetInput.type = 'range';
			offsetInput.min = 0;
			offsetInput.max = 100;
			offsetInput.value = Math.round( ( stop.offset || 0 ) * 100 );
			offsetInput.className = 'gradient-stop-offset';
			this._addListener( offsetInput, 'input', ( e ) => {
				const offset = parseInt( e.target.value, 10 ) / 100;
				offsetValue.textContent = e.target.value + '%';
				this._updateColorStop( index, 'offset', offset );
			} );

			const offsetValue = document.createElement( 'span' );
			offsetValue.className = 'gradient-stop-offset-value';
			offsetValue.textContent = offsetInput.value + '%';

			// Delete button (only if more than 2 stops)
			const deleteButton = document.createElement( 'button' );
			deleteButton.type = 'button';
			deleteButton.className = 'gradient-stop-delete';
			deleteButton.textContent = '×';
			deleteButton.title = msg( 'layers-gradient-remove-stop', 'Remove color stop' );
			deleteButton.disabled = totalStops <= 2;
			this._addListener( deleteButton, 'click', () => {
				this._removeColorStop( index );
			} );

			row.appendChild( colorInput );
			row.appendChild( offsetInput );
			row.appendChild( offsetValue );
			row.appendChild( deleteButton );

			return row;
		}

		/**
		 * Add a new color stop
		 * @private
		 */
		_addColorStop() {
			if ( !this.currentGradient ) {
				return;
			}
			if ( !this.currentGradient.colors ) {
				this.currentGradient.colors = [];
			}
			if ( this.currentGradient.colors.length >= 10 ) {
				return; // Max 10 stops
			}

			// Add a stop at 50% with a mid-gray color
			this.currentGradient.colors.push( { offset: 0.5, color: '#888888' } );

			// Sort by offset
			this.currentGradient.colors.sort( ( a, b ) => a.offset - b.offset );

			this._notifyChange();
			this._build(); // Rebuild UI
		}

		/**
		 * Remove a color stop
		 * @private
		 * @param {number} index - Stop index
		 */
		_removeColorStop( index ) {
			if ( !this.currentGradient || !this.currentGradient.colors ) {
				return;
			}
			if ( this.currentGradient.colors.length <= 2 ) {
				return; // Need at least 2 stops
			}

			this.currentGradient.colors.splice( index, 1 );
			this._notifyChange();
			this._build(); // Rebuild UI
		}

		/**
		 * Update a color stop property
		 * @private
		 * @param {number} index - Stop index
		 * @param {string} prop - Property name ('color' or 'offset')
		 * @param {*} value - New value
		 */
		_updateColorStop( index, prop, value ) {
			if ( !this.currentGradient || !this.currentGradient.colors ) {
				return;
			}
			if ( index >= 0 && index < this.currentGradient.colors.length ) {
				this.currentGradient.colors[ index ][ prop ] = value;
				this._notifyChange();
			}
		}

		/**
		 * Handle fill type change
		 * @private
		 * @param {Event} e - Change event
		 */
		_onFillTypeChange( e ) {
			const newType = e.target.value;
			const previousType = this.fillType;
			this.fillType = newType;

			if ( newType === 'solid' ) {
				// Switching to solid - clear gradient
				this.currentGradient = null;
				this.onChange( { gradient: null } );
			} else {
				// Switching to gradient
				if ( !this.currentGradient ) {
					// Create default gradient using current fill color
					const startColor = this.layer.fill || '#ffffff';
					this.currentGradient = {
						type: newType,
						colors: [
							{ offset: 0, color: startColor },
							{ offset: 1, color: '#000000' }
						]
					};
					if ( newType === 'linear' ) {
						this.currentGradient.angle = 90;
					} else {
						this.currentGradient.centerX = 0.5;
						this.currentGradient.centerY = 0.5;
						this.currentGradient.radius = 0.7;
					}
				} else {
					this.currentGradient.type = newType;
				}
				this._notifyChange();
			}

			// Notify parent to refresh UI if switching between solid and gradient
			const wasSolid = previousType === 'solid';
			const isSolid = newType === 'solid';
			if ( wasSolid !== isSolid && this.onFillTypeChange ) {
				this.onFillTypeChange();
			}

			this._build(); // Rebuild UI
		}

		/**
		 * Notify parent of gradient change
		 * @private
		 */
		_notifyChange() {
			if ( this.onChange ) {
				this.onChange( { gradient: this._cloneGradient( this.currentGradient ) } );
			}
		}

		/**
		 * Destroy the editor
		 */
		destroy() {
			// Clean up event listeners first
			if ( this.eventTracker ) {
				this.eventTracker.destroy();
				this.eventTracker = null;
			}

			if ( this.container ) {
				this.container.innerHTML = '';
			}
			this.layer = null;
			this.onChange = null;
			this.onFillTypeChange = null;
			this.container = null;
			this.currentGradient = null;
			this.stopsListEl = null;
		}
	}

	// Export to window namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.GradientEditor = GradientEditor;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = GradientEditor;
	}
}() );
