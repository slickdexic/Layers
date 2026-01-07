/**
 * Properties Form Factory for Layers Editor
 * Creates layer properties forms with sections for transform, appearance, and effects
 *
 * This module delegates to PropertyBuilders for reusable property group creation.
 * @see PropertyBuilders for the extracted builders
 */
( function () {
	'use strict';

	/**
	 * Get INTEGER_EPSILON from MathUtils namespace (with fallback)
	 * @return {number}
	 */
	function getIntegerEpsilon() {
		if ( window.Layers && window.Layers.MathUtils && window.Layers.MathUtils.MATH ) {
			return window.Layers.MathUtils.MATH.INTEGER_EPSILON;
		}
		// Fallback if MathUtils not loaded
		return 1e-9;
	}

	// Import UI components (available from Layers namespace or legacy global)
	const ColorPickerDialog = ( window.Layers && window.Layers.UI && window.Layers.UI.ColorPickerDialog ) ||
		window.ColorPickerDialog;

	/**
	 * Get PropertyBuilders from namespace (lazy loaded)
	 * @return {Object|null}
	 */
	function getPropertyBuilders() {
		return ( window.Layers && window.Layers.UI && window.Layers.UI.PropertyBuilders ) || null;
	}

	/**
	 * PropertiesForm - Factory for creating layer property editing forms
	 * @namespace
	 */
	const PropertiesForm = {};

	/**
	 * Helper to get translated message - delegates to MessageHelper
	 * @param {string} key - Message key
	 * @param {string} fallback - Fallback text
	 * @return {string}
	 */
	function msg( key, fallback ) {
		// Delegate to MessageHelper singleton if available
		if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
			return window.layersMessages.get( key, fallback );
		}
		return fallback || '';
	}

	/**
	 * Format a number with at most 1 decimal place
	 * @param {number} num - Number to format
	 * @return {string}
	 */
	function formatOneDecimal( num ) {
		if ( typeof num !== 'number' || isNaN( num ) ) {
			return '';
		}
		const isInt = Math.abs( num - Math.round( num ) ) < getIntegerEpsilon();
		return isInt ? String( Math.round( num ) ) : num.toFixed( 1 );
	}

	/**
	 * Debounce delay for number inputs in milliseconds
	 * @constant {number}
	 */
	const DEBOUNCE_DELAY = 100;

	/**
	 * Simple debounce utility for input handlers
	 * @param {Function} fn - Function to debounce
	 * @param {number} delay - Delay in milliseconds
	 * @return {Function} Debounced function
	 */
	function debounce( fn, delay ) {
		let timer = null;
		return function () {
			const context = this;
			const args = arguments;
			if ( timer !== null ) {
				clearTimeout( timer );
			}
			timer = setTimeout( function () {
				fn.apply( context, args );
				timer = null;
			}, delay );
		};
	}

	/**
	 * Safe error logging
	 * @param {...*} args - Arguments to log
	 */
	function logError() {
		if ( window.mw && window.mw.log && typeof window.mw.log.error === 'function' ) {
			const args = Array.prototype.slice.call( arguments );
			args.unshift( '[PropertiesForm]' );
			window.mw.log.error.apply( window.mw.log, args );
		}
	}

	/**
	 * Create a text/number input field
	 * @param {Object} opts - Input options
	 * @param {string} opts.label - Label text
	 * @param {string} [opts.type='text'] - Input type
	 * @param {*} opts.value - Current value
	 * @param {string} [opts.prop] - Property name for data attribute
	 * @param {number} [opts.min] - Minimum value for number inputs
	 * @param {number} [opts.max] - Maximum value for number inputs
	 * @param {number} [opts.step] - Step value for number inputs
	 * @param {number} [opts.decimals] - Decimal places (1 for one decimal)
	 * @param {number} [opts.maxLength] - Max length for text inputs
	 * @param {Function} opts.onChange - Change callback
	 * @param {string} layerId - Layer ID for unique input IDs
	 * @param {HTMLElement} container - Container to append to
	 * @return {HTMLInputElement}
	 */
	PropertiesForm.addInput = function ( opts, layerId, container ) {
		const wrapper = document.createElement( 'div' );
		let wrapperClass = 'property-field';
		if ( opts.type === 'checkbox' ) {
			wrapperClass = 'property-field property-field--checkbox';
		} else if ( opts.type === 'textarea' ) {
			wrapperClass = 'property-field property-field--textarea';
			if ( opts.wide ) {
				wrapperClass += ' property-field--wide';
			}
		}
		wrapper.className = wrapperClass;
		const inputId = 'layer-prop-' + ( opts.prop || Math.random().toString( 36 ).slice( 2 ) ) + '-' + layerId;
		const labelEl = document.createElement( 'label' );
		labelEl.textContent = opts.label;
		labelEl.setAttribute( 'for', inputId );

		// Create input or textarea element based on type
		let input;
		if ( opts.type === 'textarea' ) {
			input = document.createElement( 'textarea' );
			input.rows = opts.rows || 3;
			if ( opts.maxLength !== undefined ) {
				input.maxLength = opts.maxLength;
			}
		} else {
			input = document.createElement( 'input' );
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
			if ( opts.decimals === 1 && input.type === 'number' && !input.step ) {
				input.step = '0.1';
			}
			if ( opts.maxLength !== undefined && input.type === 'text' ) {
				input.maxLength = opts.maxLength;
			}
		}

		input.id = inputId;
		input.value = ( opts.value !== undefined && opts.value !== null ) ? String( opts.value ) : '';

		// Set appropriate width for different input types
		if ( opts.type !== 'textarea' ) {
			if ( input.type === 'number' ) {
				input.style.width = '80px'; // Narrower for number inputs
			} else if ( input.type === 'text' && opts.prop !== 'text' ) {
				input.style.width = '120px'; // Moderate width for short text
			} else {
				input.style.width = '100%'; // Full width for long text content
			}
		}

		if ( opts.prop ) {
			input.setAttribute( 'data-prop', String( opts.prop ) );
		}
		if ( opts.decimals === 1 ) {
			input.setAttribute( 'data-decimals', '1' );
		}
		let lastValidValue = input.value;
		const errorIndicator = document.createElement( 'span' );
		errorIndicator.className = 'property-field-error';

		const validateInput = function ( value, showError ) {
			let isValid = true;
			let errorMessage = '';
			const isTextarea = opts.type === 'textarea';
			const inputType = isTextarea ? 'text' : input.type;
			if ( inputType === 'number' ) {
				const num = parseFloat( value );
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
			} else if ( inputType === 'text' || isTextarea ) {
				const textLength = value.length;
				const maxLength = opts.maxLength || ( isTextarea ? 5000 : 1000 );
				const warnLength = Math.floor( maxLength * 0.95 );
				if ( textLength > maxLength ) {
					isValid = false;
					errorMessage = 'Text is too long. Maximum ' + maxLength + ' characters allowed.';
				} else if ( textLength > warnLength && showError ) {
					errorIndicator.textContent = 'Approaching character limit (' + textLength + '/' + maxLength + ')';
					errorIndicator.classList.add( 'show', 'warning' );
					input.classList.add( 'warning' );
					input.classList.remove( 'error' );
					return true;
				}
			}
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

		const safeOnChange = function ( value ) {
			try {
				if ( typeof opts.onChange === 'function' ) {
					// Call onChange synchronously to ensure proper state updates
					opts.onChange( value );
				}
			} catch ( error ) {
				logError( 'Error in onChange handler:', error );
				// Try to show user-friendly error
				if ( window.mw && window.mw.notify ) {
					mw.notify( 'Error updating layer property', { type: 'error' } );
				}
			}
		};

		// Debounced version for number inputs to avoid excessive updates while typing
		const debouncedOnChange = debounce( safeOnChange, DEBOUNCE_DELAY );

		input.addEventListener( 'input', function () {
			try {
				const value = input.value;
				const isTextarea = opts.type === 'textarea';
				const showWarnings = input.type === 'text' || isTextarea;
				const valid = validateInput( value, showWarnings );
				if ( input.type === 'number' ) {
					let n = parseFloat( value );
					if ( !isNaN( n ) ) {
						if ( opts.min !== undefined ) {
							n = Math.max( n, parseFloat( opts.min ) );
						}
						if ( opts.max !== undefined ) {
							n = Math.min( n, parseFloat( opts.max ) );
						}
						if ( opts.decimals === 1 ) {
							n = Math.round( n * 10 ) / 10;
							const isInteger = Math.abs( n - Math.round( n ) ) < getIntegerEpsilon();
							const s = isInteger ? String( Math.round( n ) ) : n.toFixed( 1 );
							if ( input.value !== s ) {
								input.value = s;
							}
						}
						lastValidValue = input.value;
						if ( valid ) {
							// Use debounced version for number inputs to reduce render thrashing
							debouncedOnChange( n );
						}
					}
				} else if ( ( input.type === 'text' || isTextarea ) && valid ) {
					safeOnChange( value );
				}
			} catch ( error ) {
				logError( 'Error in input event handler:', error );
			}
		} );

		input.addEventListener( 'change', function () {
			try {
				const value = input.value;
				const isValid = validateInput( value, true );
				if ( isValid ) {
					if ( input.type === 'number' && opts.decimals === 1 ) {
						const n = parseFloat( value );
						if ( !isNaN( n ) ) {
							const rounded = Math.round( n * 10 ) / 10;
							input.value = formatOneDecimal( rounded );
							safeOnChange( rounded );
						}
					} else if ( input.type === 'number' ) {
						let num = parseFloat( value );
						if ( !isNaN( num ) ) {
							if ( opts.min !== undefined ) {
								num = Math.max( num, parseFloat( opts.min ) );
							}
							if ( opts.max !== undefined ) {
								num = Math.min( num, parseFloat( opts.max ) );
							}
							input.value = String( num );
							safeOnChange( num );
						}
					} else if ( input.type === 'checkbox' ) {
						safeOnChange( input.checked );
					} else {
						safeOnChange( value );
					}
					lastValidValue = input.value;
				} else {
					setTimeout( function () {
						input.value = lastValidValue;
						validateInput( lastValidValue, false );
					}, 100 );
				}
			} catch ( error ) {
				logError( 'Error in change event handler:', error );
			}
		} );

		input.addEventListener( 'blur', function () {
			try {
				const value = input.value;
				const isValid = validateInput( value, true );
				if ( !isValid ) {
					input.value = lastValidValue;
					validateInput( lastValidValue, false );
				} else if ( input.type === 'number' && opts.decimals === 1 ) {
					const n = parseFloat( value );
					if ( !isNaN( n ) ) {
						const rounded = Math.round( n * 10 ) / 10;
						input.value = formatOneDecimal( rounded );
						lastValidValue = input.value;
					}
				}
			} catch ( error ) {
				logError( 'Error in blur event handler:', error );
			}
		} );

		if ( input.type === 'checkbox' ) {
			input.checked = !!opts.value;
		}
		// Handle disabled state
		if ( opts.disabled ) {
			input.disabled = true;
			input.classList.add( 'disabled' );
			wrapper.classList.add( 'property-field--disabled' );
		}
		wrapper.appendChild( labelEl );
		wrapper.appendChild( input );
		wrapper.appendChild( errorIndicator );
		container.appendChild( wrapper );
		return input;
	};

	/**
	 * Create a select dropdown field
	 * @param {Object} opts - Select options
	 * @param {string} opts.label - Label text
	 * @param {*} opts.value - Current value
	 * @param {Array<{value: string, text: string}>} opts.options - Options list
	 * @param {Function} opts.onChange - Change callback
	 * @param {string} layerId - Layer ID for unique input IDs
	 * @param {HTMLElement} container - Container to append to
	 * @return {HTMLSelectElement}
	 */
	PropertiesForm.addSelect = function ( opts, layerId, container ) {
		const wrapper = document.createElement( 'div' );
		wrapper.className = 'property-field';
		const inputId = 'layer-prop-select-' + ( opts.label || Math.random().toString( 36 ).slice( 2 ) ).replace( /\s+/g, '-' ) + '-' + layerId;
		const labelEl = document.createElement( 'label' );
		labelEl.textContent = opts.label;
		labelEl.setAttribute( 'for', inputId );
		const select = document.createElement( 'select' );
		select.id = inputId;
		( opts.options || [] ).forEach( function ( o ) {
			const opt = document.createElement( 'option' );
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
		container.appendChild( wrapper );
		return select;
	};

	/**
	 * Create a color picker field
	 * @param {Object} opts - Color picker options
	 * @param {string} opts.label - Label text
	 * @param {string} opts.value - Current color value
	 * @param {Function} opts.onChange - Change callback
	 * @param {Function} registerCleanup - Cleanup registration function
	 * @param {HTMLElement} container - Container to append to
	 * @return {HTMLButtonElement}
	 */
	PropertiesForm.addColorPicker = function ( opts, registerCleanup, container ) {
		const colorPickerStrings = {
			title: msg( 'layers-color-picker-title', 'Choose color' ),
			standard: msg( 'layers-color-picker-standard', 'Standard colors' ),
			saved: msg( 'layers-color-picker-saved', 'Saved colors' ),
			customSection: msg( 'layers-color-picker-custom-section', 'Custom color' ),
			none: msg( 'layers-color-picker-none', 'No fill (transparent)' ),
			emptySlot: msg( 'layers-color-picker-empty-slot', 'Empty slot - colors will be saved here automatically' ),
			cancel: msg( 'layers-color-picker-cancel', 'Cancel' ),
			apply: msg( 'layers-color-picker-apply', 'Apply' ),
			transparent: msg( 'layers-color-picker-transparent', 'Transparent' ),
			swatchTemplate: msg( 'layers-color-picker-color-swatch', 'Set color to $1' ),
			previewTemplate: msg( 'layers-color-picker-color-preview', 'Current color: $1' )
		};

		const wrapper = document.createElement( 'div' );
		wrapper.className = 'property-field property-field--color';
		const labelEl = document.createElement( 'label' );
		labelEl.textContent = opts.label;

		// Use extracted ColorPickerDialog component if available
		let colorButton;
		if ( ColorPickerDialog && typeof ColorPickerDialog.createColorButton === 'function' ) {
			colorButton = ColorPickerDialog.createColorButton( {
				color: opts.value,
				strings: colorPickerStrings,
				onClick: function () {
					const originalColor = opts.value; // Store for cancel restoration
					const dialog = new ColorPickerDialog( {
						currentColor: opts.value,
						strings: colorPickerStrings,
						anchorElement: colorButton,
						registerCleanup: registerCleanup,
						onApply: function ( newColor ) {
							opts.onChange( newColor );
							opts.value = newColor; // Update for next dialog open
							ColorPickerDialog.updateColorButton( colorButton, newColor, colorPickerStrings );
						},
						onPreview: function ( previewColor ) {
							// Apply preview to selected layer
							opts.onChange( previewColor );
						},
						onCancel: function () {
							// Restore original color on cancel
							opts.onChange( originalColor );
						}
					} );
					dialog.open();
				}
			} );
		} else {
			// Fallback: create basic color button
			colorButton = document.createElement( 'button' );
			colorButton.type = 'button';
			colorButton.className = 'color-display-button';
			colorButton.style.width = '30px';
			colorButton.style.height = '30px';
			colorButton.style.border = '1px solid #ccc';
			colorButton.style.borderRadius = '4px';
			colorButton.style.cursor = 'pointer';
			colorButton.style.marginLeft = '8px';

			// Set initial color
			if ( !opts.value || opts.value === 'none' || opts.value === 'transparent' ) {
				colorButton.style.background = 'repeating-linear-gradient(45deg, #ff0000 0, #ff0000 4px, transparent 4px, transparent 8px)';
			} else {
				colorButton.style.background = opts.value;
			}
			colorButton.title = opts.value || colorPickerStrings.transparent;

			// Simple color input fallback
			colorButton.addEventListener( 'click', function () {
				const input = document.createElement( 'input' );
				input.type = 'color';
				input.value = opts.value && opts.value !== 'none' ? opts.value : '#000000';
				input.style.position = 'absolute';
				input.style.opacity = '0';
				document.body.appendChild( input );
				input.addEventListener( 'change', function () {
					opts.onChange( input.value );
					opts.value = input.value;
					colorButton.style.background = input.value;
					colorButton.title = input.value;
					document.body.removeChild( input );
				} );
				input.addEventListener( 'blur', function () {
					if ( input.parentNode ) {
						document.body.removeChild( input );
					}
				} );
				input.click();
			} );
		}

		wrapper.appendChild( labelEl );
		wrapper.appendChild( colorButton );
		container.appendChild( wrapper );
		return colorButton;
	};

	/**
	 * Create a checkbox field
	 * @param {Object} opts - Checkbox options
	 * @param {string} opts.label - Label text
	 * @param {boolean} opts.value - Current checked state
	 * @param {Function} opts.onChange - Change callback
	 * @param {string} layerId - Layer ID for unique input IDs
	 * @param {HTMLElement} container - Container to append to
	 * @return {HTMLInputElement}
	 */
	PropertiesForm.addCheckbox = function ( opts, layerId, container ) {
		const wrapper = document.createElement( 'div' );
		wrapper.className = 'property-field property-field--checkbox';
		const inputId = 'layer-prop-check-' + ( opts.label || Math.random().toString( 36 ).slice( 2 ) ).replace( /\s+/g, '-' ) + '-' + layerId;
		const labelEl = document.createElement( 'label' );
		labelEl.textContent = opts.label;
		labelEl.setAttribute( 'for', inputId );
		const input = document.createElement( 'input' );
		input.type = 'checkbox';
		input.checked = !!opts.value;
		input.id = inputId;
		input.addEventListener( 'change', function () {
			opts.onChange( input.checked );
		} );
		wrapper.appendChild( labelEl );
		wrapper.appendChild( input );
		container.appendChild( wrapper );
		return input;
	};

	/**
	 * Create a compound slider + number input field
	 * @param {Object} opts - Slider options
	 * @param {string} opts.label - Label text
	 * @param {number} opts.value - Current value
	 * @param {number} [opts.min=0] - Minimum value
	 * @param {number} [opts.max=100] - Maximum value
	 * @param {number} [opts.step=1] - Step value
	 * @param {Function} opts.onChange - Change callback
	 * @param {string} layerId - Layer ID for unique input IDs
	 * @param {HTMLElement} container - Container to append to
	 * @return {{number: HTMLInputElement, range: HTMLInputElement}}
	 */
	PropertiesForm.addSliderInput = function ( opts, layerId, container ) {
		const wrapper = document.createElement( 'div' );
		wrapper.className = 'property-field property-field--compound';
		const baseId = 'layer-prop-slider-' + ( opts.label || Math.random().toString( 36 ).slice( 2 ) ).replace( /\s+/g, '-' ) + '-' + layerId;
		const labelEl = document.createElement( 'label' );
		labelEl.textContent = opts.label;
		labelEl.setAttribute( 'for', baseId + '-num' );
		const controls = document.createElement( 'div' );
		controls.className = 'compact-controls';
		const numberInput = document.createElement( 'input' );
		numberInput.id = baseId + '-num';
		numberInput.type = 'number';
		numberInput.className = 'compact-number';
		numberInput.min = String( opts.min || 0 );
		numberInput.max = String( opts.max || 100 );
		numberInput.step = String( opts.step || 1 );
		numberInput.value = String( opts.value || 0 );
		const rangeInput = document.createElement( 'input' );
		rangeInput.type = 'range';
		rangeInput.setAttribute( 'aria-label', opts.label + ' slider' );
		rangeInput.className = 'compact-range';
		rangeInput.min = String( opts.min || 0 );
		rangeInput.max = String( opts.max || 100 );
		rangeInput.step = String( opts.step || 1 );
		rangeInput.value = String( opts.value || 0 );
		const updateValue = function ( value ) {
			let num = parseFloat( value );
			if ( !isNaN( num ) ) {
				num = Math.max( opts.min || 0, Math.min( opts.max || 100, num ) );
				if ( ( parseFloat( opts.step || 1 ) ) < 1 ) {
					num = Math.round( num * 10 ) / 10;
					const isInt = Math.abs( num - Math.round( num ) ) < getIntegerEpsilon();
					numberInput.value = isInt ? String( Math.round( num ) ) : num.toFixed( 1 );
				} else {
					numberInput.value = String( num );
				}
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
		container.appendChild( wrapper );
		return { number: numberInput, range: rangeInput };
	};

	/**
	 * Create a section header and body
	 * @param {string} title - Section title
	 * @param {string} type - Section type (transform, appearance, effects)
	 * @param {HTMLFormElement} form - Form to append to
	 * @return {HTMLDivElement} Section body element for adding fields
	 */
	PropertiesForm.addSection = function ( title, type, form ) {
		const section = document.createElement( 'div' );
		section.className = 'property-section';
		const header = document.createElement( 'div' );
		header.className = 'property-section-header';
		if ( type === 'transform' ) {
			header.classList.add( 'property-section-header--transform' );
		}
		if ( type === 'appearance' ) {
			header.classList.add( 'property-section-header--appearance' );
		}
		if ( type === 'effects' ) {
			header.classList.add( 'property-section-header--effects' );
		}
		header.textContent = title;
		const sectionBody = document.createElement( 'div' );
		sectionBody.className = 'property-section-body';
		section.appendChild( header );
		section.appendChild( sectionBody );
		form.appendChild( section );
		return sectionBody;
	};

	/**
	 * Create a complete properties form for a layer
	 * @param {Object} layer - The layer object
	 * @param {Object} editor - The editor instance (for updateLayer calls)
	 * @param {Function} registerCleanup - Cleanup registration function
	 * @return {HTMLFormElement}
	 */
	PropertiesForm.create = function ( layer, editor, registerCleanup ) {
		const form = document.createElement( 'form' );
		form.className = 'layer-properties-form';
		const t = msg;
		let currentSectionBody = null;

		// Helper functions for this form
		const addSection = function ( title, type ) {
			currentSectionBody = PropertiesForm.addSection( title, type, form );
		};

		const addInput = function ( opts ) {
			return PropertiesForm.addInput( opts, layer.id, currentSectionBody || form );
		};

		const addSelect = function ( opts ) {
			return PropertiesForm.addSelect( opts, layer.id, currentSectionBody || form );
		};

		const addColorPicker = function ( opts ) {
			return PropertiesForm.addColorPicker( opts, registerCleanup, currentSectionBody || form );
		};

		const addCheckbox = function ( opts ) {
			return PropertiesForm.addCheckbox( opts, layer.id, currentSectionBody || form );
		};

		const addSliderInput = function ( opts ) {
			return PropertiesForm.addSliderInput( opts, layer.id, currentSectionBody || form );
		};

		// Build context object for PropertyBuilders
		const ctx = {
			layer: layer,
			editor: editor,
			addSection: addSection,
			addInput: addInput,
			addSelect: addSelect,
			addColorPicker: addColorPicker,
			addCheckbox: addCheckbox,
			addSliderInput: addSliderInput
		};

		// Get PropertyBuilders (if loaded)
		const Builders = getPropertyBuilders();

		// Special handling for folder/group layers - they don't have transform/appearance properties
		if ( layer.type === 'group' ) {
			// Folder Info section
			addSection( t( 'layers-section-folder', 'Folder' ), 'folder' );

			// Folder name (editable)
			addInput( {
				label: t( 'layers-prop-name', 'Name' ),
				type: 'text',
				value: layer.name || t( 'layers-type-folder', 'Folder' ),
				maxLength: 100,
				onChange: function ( v ) {
					editor.updateLayer( layer.id, { name: v } );
				}
			} );

			// Children count (read-only info)
			const childCount = ( layer.children && layer.children.length ) || 0;
			const infoRow = document.createElement( 'div' );
			infoRow.className = 'properties-row properties-info';
			const infoLabel = document.createElement( 'span' );
			infoLabel.className = 'properties-label';
			infoLabel.textContent = t( 'layers-folder-contents', 'Contents' );
			const infoValue = document.createElement( 'span' );
			infoValue.className = 'properties-value';
			infoValue.textContent = childCount === 0 ?
				t( 'layers-folder-empty-hint', 'Empty — drag layers here' ) :
				( childCount === 1 ? '1 layer' : childCount + ' layers' );
			infoRow.appendChild( infoLabel );
			infoRow.appendChild( infoValue );
			( currentSectionBody || form ).appendChild( infoRow );

			// Tip for empty folders
			if ( childCount === 0 ) {
				const tipRow = document.createElement( 'div' );
				tipRow.className = 'properties-row properties-tip';
				const tipText = document.createElement( 'em' );
				tipText.className = 'properties-tip-text';
				tipText.textContent = t( 'layers-folder-empty-tip', 'Tip: Drag layers onto this folder in the layer panel to add them.' );
				tipRow.appendChild( tipText );
				( currentSectionBody || form ).appendChild( tipRow );
			}

			// That's all for folders - no transform, appearance, or other properties
			return form;
		}

		// Transform - Position should be integers (no decimals)
		// Note: arrows and lines use x1/y1/x2/y2 instead of x/y
		addSection( t( 'layers-section-transform', 'Transform' ), 'transform' );
		if ( layer.type !== 'arrow' && layer.type !== 'line' ) {
			Builders.addPosition( ctx );
		}

		// Size/geometry by type - uses PropertyBuilders
		const LayersConstants = ( window.Layers && window.Layers.Constants ) || {};
		const LAYER_TYPES = LayersConstants.LAYER_TYPES || {};
		switch ( layer.type ) {
			case ( LAYER_TYPES.RECTANGLE || 'rectangle' ):
				Builders.addDimensions( ctx, { cornerRadius: true } );
				break;

			case 'textbox':
				Builders.addDimensions( ctx, { cornerRadius: true } );
				// Textbox-specific: text properties
				addSection( t( 'layers-section-text', 'Text' ), 'text' );
				Builders.addTextProperties( ctx );
				Builders.addTextShadowSection( ctx );
				Builders.addAlignmentSection( ctx );
				break;

			case 'callout':
				// Callout dimensions (like textbox)
				Builders.addDimensions( ctx, { cornerRadius: true, maxCornerRadius: 100 } );
				// Text properties (same as textbox)
				addSection( t( 'layers-section-text', 'Text' ), 'text' );
				Builders.addTextProperties( ctx );
				Builders.addTextShadowSection( ctx );
				Builders.addAlignmentSection( ctx );
				Builders.addCalloutTailSection( ctx );
				break;

			case ( LAYER_TYPES.CIRCLE || 'circle' ):
				Builders.addCircleRadius( ctx );
				break;

			case ( LAYER_TYPES.ELLIPSE || 'ellipse' ):
				Builders.addEllipseProperties( ctx );
				break;

			case ( LAYER_TYPES.POLYGON || 'polygon' ):
				Builders.addPolygonProperties( ctx );
				break;

			case ( LAYER_TYPES.STAR || 'star' ):
				Builders.addStarProperties( ctx );
				break;

			case ( LAYER_TYPES.LINE || 'line' ):
				Builders.addEndpoints( ctx );
				break;

			case ( LAYER_TYPES.ARROW || 'arrow' ):
				Builders.addEndpoints( ctx );
				Builders.addArrowProperties( ctx );
				break;

			case 'text':
				Builders.addSimpleTextProperties( ctx );
				break;

			case 'image':
				Builders.addDimensions( ctx );
				break;

			case 'blur':
				Builders.addBlurProperties( ctx );
				break;
		}

		// Appearance (not applicable to image layers)
		if ( layer.type !== 'image' ) {
			addSection( t( 'layers-section-appearance', 'Appearance' ), 'appearance' );
			if ( layer.type !== 'text' ) {
				addColorPicker( { label: t( 'layers-prop-stroke-color', 'Stroke Color' ), value: layer.stroke, property: 'stroke', onChange: function ( newColor ) { editor.updateLayer( layer.id, { stroke: newColor } ); } } );
				addInput( { label: t( 'layers-prop-stroke-width', 'Stroke Width' ), type: 'number', value: layer.strokeWidth || 1, min: 0, max: 200, step: 1, onChange: function ( v ) { const val = Math.max( 0, Math.min( 200, parseInt( v, 10 ) ) ); editor.updateLayer( layer.id, { strokeWidth: val } ); } } );
			}
			addSliderInput( { label: t( 'layers-prop-stroke-opacity', 'Stroke Opacity' ), value: ( layer.strokeOpacity != null ) ? Math.round( layer.strokeOpacity * 100 ) : 100, min: 0, max: 100, step: 1, onChange: function ( v ) { editor.updateLayer( layer.id, { strokeOpacity: v / 100 } ); } } );
			// Fill controls for shapes that use fill (lines are stroke-only, but arrows support fill)
			if ( layer.type !== 'line' ) {
				// Blur fill checkbox (mutually exclusive with color fill)
				const isBlurFill = layer.fill === 'blur';
				addCheckbox( { label: t( 'layers-prop-blur-fill', 'Blur Fill' ), value: isBlurFill, onChange: function ( checked ) {
					if ( checked ) {
						// Enable blur fill - store current fill color and set fill to 'blur'
						const updates = { fill: 'blur' };
						// Store the current fill color for restoration later (only if it's a valid color)
						if ( layer.fill && layer.fill !== 'blur' && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
							updates._previousFill = layer.fill;
						} else if ( !layer._previousFill ) {
							// If no previous fill stored and current is not a color, default to transparent
							updates._previousFill = 'transparent';
						}
						if ( typeof layer.blurRadius === 'undefined' ) {
							updates.blurRadius = 12;
						}
						editor.updateLayer( layer.id, updates );
					} else {
						// Disable blur fill - restore to previous fill color or transparent
						const restoredFill = layer._previousFill || 'transparent';
						editor.updateLayer( layer.id, { fill: restoredFill } );
					}
					// Refresh properties panel to show/hide blur radius and fill color picker
					if ( editor.layerPanel && typeof editor.layerPanel.updatePropertiesPanel === 'function' ) {
						// Use setTimeout to let the layer update complete first
						setTimeout( function () {
							editor.layerPanel.updatePropertiesPanel( layer.id );
						}, 0 );
					}
				} } );
				// Blur radius (only shown when blur fill is enabled)
				if ( isBlurFill ) {
					addInput( { label: t( 'layers-prop-blur-radius', 'Blur Radius' ), type: 'number', value: layer.blurRadius || 12, min: 1, max: 64, step: 1, onChange: function ( v ) { const br = Math.max( 1, Math.min( 64, parseInt( v, 10 ) || 12 ) ); editor.updateLayer( layer.id, { blurRadius: br } ); } } );
				}
				// Color fill (only shown when blur fill is disabled)
				if ( !isBlurFill ) {
					addColorPicker( { label: t( 'layers-prop-fill-color', 'Fill Color' ), value: layer.fill, property: 'fill', onChange: function ( newColor ) { editor.updateLayer( layer.id, { fill: newColor } ); } } );
				}
				addSliderInput( { label: t( 'layers-prop-fill-opacity', 'Fill Opacity' ), value: ( layer.fillOpacity != null ) ? Math.round( layer.fillOpacity * 100 ) : 100, min: 0, max: 100, step: 1, onChange: function ( v ) { editor.updateLayer( layer.id, { fillOpacity: v / 100 } ); } } );
			}
		}

		// Effects
		addSection( t( 'layers-section-effects', 'Effects' ), 'effects' );
		let layerOpacityValue = ( layer.opacity != null ) ? layer.opacity : 1;
		layerOpacityValue = Math.round( layerOpacityValue * 100 );
		addSliderInput( { label: t( 'layers-prop-opacity', 'Layer Opacity' ), value: layerOpacityValue, min: 0, max: 100, step: 1, onChange: function ( v ) { editor.updateLayer( layer.id, { opacity: v / 100 } ); } } );
		// Note: 'blur' removed from blend options - use fill='blur' for frosted glass effect instead
		addSelect( { label: t( 'layers-prop-blend', 'Blend' ), value: layer.blend || layer.blendMode || 'normal', options: [
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
		], onChange: function ( v ) { editor.updateLayer( layer.id, { blend: v } ); } } );
		addCheckbox( { label: t( 'layers-effect-shadow', 'Drop Shadow' ), value: !!layer.shadow, onChange: function ( checked ) {
			const updates = { shadow: !!checked };
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
			editor.updateLayer( layer.id, updates );
		} } );
		addInput( { label: t( 'layers-effect-shadow-color', 'Shadow Color' ), type: 'color', value: layer.shadowColor || '#000000', onChange: function ( v ) { editor.updateLayer( layer.id, { shadowColor: v } ); } } );
		addInput( { label: t( 'layers-effect-shadow-blur', 'Shadow Size' ), type: 'number', value: typeof layer.shadowBlur === 'number' ? layer.shadowBlur : 8, min: 0, max: 64, step: 1, onChange: function ( v ) { const s = Math.max( 0, Math.min( 64, parseInt( v, 10 ) || 0 ) ); editor.updateLayer( layer.id, { shadowBlur: s } ); } } );
		addInput( { label: t( 'layers-effect-shadow-spread', 'Shadow Spread' ), type: 'number', value: typeof layer.shadowSpread === 'number' ? layer.shadowSpread : 0, min: 0, max: 64, step: 1, onChange: function ( v ) { const sp = Math.max( 0, parseInt( v, 10 ) || 0 ); editor.updateLayer( layer.id, { shadowSpread: sp } ); } } );
		addInput( { label: t( 'layers-effect-shadow-offset-x', 'Shadow Offset X' ), type: 'number', value: typeof layer.shadowOffsetX === 'number' ? layer.shadowOffsetX : 2, step: 1, onChange: function ( v ) { editor.updateLayer( layer.id, { shadowOffsetX: parseInt( v, 10 ) } ); } } );
		addInput( { label: t( 'layers-effect-shadow-offset-y', 'Shadow Offset Y' ), type: 'number', value: typeof layer.shadowOffsetY === 'number' ? layer.shadowOffsetY : 2, step: 1, onChange: function ( v ) { editor.updateLayer( layer.id, { shadowOffsetY: parseInt( v, 10 ) } ); } } );

		return form;
	};

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.PropertiesForm = PropertiesForm;
	}

	// Node.js/Jest compatibility
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PropertiesForm;
	}
}() );
