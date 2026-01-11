/**
 * MessageHelper - Centralized i18n message handling for the Layers extension
 *
 * Provides a consistent interface for retrieving localized messages from MediaWiki's
 * message system with proper fallback handling.
 *
 * Usage:
 *   const msg = window.LayersMessageHelper.get( 'layers-save-success', 'Saved!' );
 *   // Or via singleton:
 *   const helper = window.layersMessages;
 *   helper.get( 'layers-tool-select' );
 *
 * @module MessageHelper
 * @since 0.9.0
 */
( function () {
	'use strict';

	/**
	 * MessageHelper class for centralized i18n message handling
	 * @class MessageHelper
	 */
	class MessageHelper {
		/**
		 * Create a new MessageHelper instance
		 */
		constructor() {
			// Cache for messages to avoid repeated lookups
			this.cache = {};
			this.cacheEnabled = true;
		}

		/**
		 * Get a localized message with fallback support
		 *
		 * Tries the following in order:
		 * 1. mw.message( key ).text() - standard MediaWiki message API
		 * 2. mw.msg( key ) - legacy shorthand
		 * 3. fallback parameter - provided default text
		 *
		 * @param {string} key - Message key (e.g., 'layers-save-success')
		 * @param {string} [fallback=''] - Fallback text if message not found
		 * @return {string} The localized message or fallback
		 */
		get( key, fallback ) {
			if ( typeof key !== 'string' || !key ) {
				return fallback || '';
			}

			// Check cache first
			if ( this.cacheEnabled && Object.prototype.hasOwnProperty.call( this.cache, key ) ) {
				return this.cache[ key ];
			}

			let result = fallback || '';

			try {
				// Try standard mw.message API first
				if ( typeof mw !== 'undefined' && mw.message ) {
					const msg = mw.message( key );
					if ( msg && !msg.exists ) {
						// Message doesn't exist, use fallback
						result = fallback || key;
					} else if ( msg && typeof msg.text === 'function' ) {
						result = msg.text();
					}
				} else if ( typeof mw !== 'undefined' && mw.msg ) {
					// Fallback to legacy mw.msg
					result = mw.msg( key );
				}
			} catch ( e ) {
				// Silently fall back on any error
				result = fallback || key;
			}

			// Cache the result
			if ( this.cacheEnabled ) {
				this.cache[ key ] = result;
			}

			return result;
		}

		/**
		 * Get a localized message with parameter substitution
		 *
		 * @param {string} key - Message key
		 * @param {...string|number} params - Parameters to substitute ($1, $2, etc.)
		 * @return {string} The localized message with parameters substituted
		 */
		getWithParams( key, ...params ) {
			try {
				if ( typeof mw !== 'undefined' && mw.message ) {
					const msg = mw.message( key, ...params );
					if ( msg && typeof msg.text === 'function' ) {
						return msg.text();
					}
				}
			} catch ( e ) {
				// Fall through to simple substitution
			}

			// Manual fallback substitution
			let result = this.get( key, key );
			for ( let i = 0; i < params.length; i++ ) {
				result = result.replace( '$' + ( i + 1 ), String( params[ i ] ) );
			}
			return result;
		}

		/**
		 * Check if a message key exists
		 *
		 * @param {string} key - Message key to check
		 * @return {boolean} True if the message exists
		 */
		exists( key ) {
			try {
				if ( typeof mw !== 'undefined' && mw.message ) {
					const msg = mw.message( key );
					return msg && msg.exists !== false;
				}
			} catch ( e ) {
				// Assume it doesn't exist on error
			}
			return false;
		}

		/**
		 * Get color picker dialog strings (shared by Toolbar, ToolbarStyleControls, ColorControlFactory)
		 *
		 * This eliminates code duplication by providing a single source for color picker i18n strings.
		 *
		 * @return {Object} Color picker string map with keys: title, standard, saved, customSection,
		 *                  none, emptySlot, cancel, apply, transparent, swatchTemplate, previewTemplate
		 */
		getColorPickerStrings() {
			return {
				title: this.get( 'layers-color-picker-title', 'Choose color' ),
				standard: this.get( 'layers-color-picker-standard', 'Standard colors' ),
				saved: this.get( 'layers-color-picker-saved', 'Saved colors' ),
				customSection: this.get( 'layers-color-picker-custom-section', 'Custom color' ),
				none: this.get( 'layers-color-picker-none', 'No fill (transparent)' ),
				emptySlot: this.get( 'layers-color-picker-empty-slot', 'Empty slot - colors will be saved here automatically' ),
				cancel: this.get( 'layers-color-picker-cancel', 'Cancel' ),
				apply: this.get( 'layers-color-picker-apply', 'Apply' ),
				transparent: this.get( 'layers-color-picker-transparent', 'Transparent' ),
				swatchTemplate: this.get( 'layers-color-picker-color-swatch', 'Set color to $1' ),
				previewTemplate: this.get( 'layers-color-picker-color-preview', 'Current color: $1' )
			};
		}

		/**
		 * Clear the message cache
		 *
		 * Useful when language settings change or for testing
		 */
		clearCache() {
			this.cache = {};
		}

		/**
		 * Enable or disable caching
		 *
		 * @param {boolean} enabled - Whether to enable caching
		 */
		setCacheEnabled( enabled ) {
			this.cacheEnabled = !!enabled;
			if ( !enabled ) {
				this.clearCache();
			}
		}
	}

	// Create singleton instance
	const messageHelper = new MessageHelper();

	// Export to window namespace
	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.MessageHelper = MessageHelper;

		// Global singleton instance (intentional - widely used)
		window.layersMessages = messageHelper;
	}

	// Export via CommonJS for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { MessageHelper, messageHelper };
	}

} )();
