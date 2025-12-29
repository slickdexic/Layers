/**
 * ArrowStyleControl - Manages arrow style dropdown UI
 * Extracted from ToolbarStyleControls for separation of concerns
 *
 * @module ArrowStyleControl
 */
( function () {
	'use strict';

	/**
	 * ArrowStyleControl class
	 *
	 * @class
	 */
	class ArrowStyleControl {
		/**
		 * @param {Object} config Configuration object
		 * @param {Function} config.msg Message lookup function for i18n
		 * @param {Function} config.addListener Event listener registration function
		 * @param {Function} config.notifyStyleChange Callback when style changes
		 */
		constructor( config ) {
			this.config = config || {};
			this.msgFn = this.config.msg || function ( key, fallback ) {
				return fallback || key;
			};
			this.addListenerFn = this.config.addListener || function () {};
			this.notifyStyleChange = this.config.notifyStyleChange || function () {};

			// DOM references
			this.container = null;
			this.selectElement = null;
		}

		/**
		 * Get localized message
		 *
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string} Localized message
		 */
		msg( key, fallback ) {
			return this.msgFn( key, fallback );
		}

		/**
		 * Add event listener (delegates to parent's tracker)
		 *
		 * @param {Element} element Target element
		 * @param {string} event Event type
		 * @param {Function} handler Event handler
		 * @param {Object} [options] Event listener options
		 */
		addListener( element, event, handler, options ) {
			if ( this.addListenerFn ) {
				this.addListenerFn( element, event, handler, options );
			} else {
				element.addEventListener( event, handler, options );
			}
		}

		/**
		 * Create the arrow style control
		 *
		 * @return {HTMLElement} The arrow style container
		 */
		create() {
			const container = document.createElement( 'div' );
			container.className = 'arrow-style-container';
			container.style.display = 'none';
			this.container = container;

			const label = document.createElement( 'label' );
			label.textContent = this.msg( 'layers-tool-arrow', 'Arrow' ) + ':';
			label.className = 'arrow-label';
			container.appendChild( label );

			const select = document.createElement( 'select' );
			select.className = 'arrow-style-select';
			select.setAttribute( 'aria-label', this.msg( 'layers-tool-arrow', 'Arrow Style' ) );

			const optSingle = document.createElement( 'option' );
			optSingle.value = 'single';
			optSingle.textContent = this.msg( 'layers-arrow-single', 'Single →' );
			select.appendChild( optSingle );

			const optDouble = document.createElement( 'option' );
			optDouble.value = 'double';
			optDouble.textContent = this.msg( 'layers-arrow-double', 'Double ↔' );
			select.appendChild( optDouble );

			const optNone = document.createElement( 'option' );
			optNone.value = 'none';
			optNone.textContent = this.msg( 'layers-arrow-none', 'Line only' );
			select.appendChild( optNone );

			container.appendChild( select );
			this.selectElement = select;

			this.addListener( select, 'change', () => {
				this.notifyStyleChange();
			} );

			return container;
		}

		/**
		 * Get the container element
		 *
		 * @return {HTMLElement|null} The container element
		 */
		getContainer() {
			return this.container;
		}

		/**
		 * Get the select element
		 *
		 * @return {HTMLSelectElement|null} The select element
		 */
		getSelectElement() {
			return this.selectElement;
		}

		/**
		 * Get the current arrow style value
		 *
		 * @return {string} Arrow style ('single', 'double', or 'none')
		 */
		getValue() {
			return this.selectElement ? this.selectElement.value : 'single';
		}

		/**
		 * Set the arrow style value
		 *
		 * @param {string} value Arrow style ('single', 'double', or 'none')
		 */
		setValue( value ) {
			if ( this.selectElement && [ 'single', 'double', 'none' ].includes( value ) ) {
				this.selectElement.value = value;
			}
		}

		/**
		 * Show or hide the arrow style control
		 *
		 * @param {boolean} visible Whether to show the control
		 */
		setVisible( visible ) {
			if ( this.container ) {
				this.container.style.display = visible ? 'block' : 'none';
			}
		}

		/**
		 * Update visibility based on the current tool
		 *
		 * @param {string} toolId The currently selected tool
		 */
		updateForTool( toolId ) {
			this.setVisible( toolId === 'arrow' );
		}

		/**
		 * Apply style from a preset
		 *
		 * @param {Object} style Style properties from the preset
		 */
		applyStyle( style ) {
			if ( style && style.arrowStyle !== undefined ) {
				this.setValue( style.arrowStyle );
			}
		}

		/**
		 * Get style values for the current state
		 *
		 * @return {Object} Object with arrowStyle property
		 */
		getStyleValues() {
			return {
				arrowStyle: this.getValue()
			};
		}

		/**
		 * Destroy and cleanup
		 */
		destroy() {
			// Event listeners are cleaned up by parent's EventTracker
			this.container = null;
			this.selectElement = null;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.ArrowStyleControl = ArrowStyleControl;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ArrowStyleControl;
	}

}() );
