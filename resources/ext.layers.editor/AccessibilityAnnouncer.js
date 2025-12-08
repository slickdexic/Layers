/**
 * AccessibilityAnnouncer - ARIA live region announcements for screen readers
 *
 * This module provides a centralized way to announce status changes to screen readers.
 * It creates hidden ARIA live regions that automatically announce changes.
 *
 * Usage:
 *   window.layersAnnouncer.announce( 'Layers saved successfully' );
 *   window.layersAnnouncer.announce( 'Tool changed to Rectangle', 'polite' );
 *   window.layersAnnouncer.announceError( 'Failed to save layers' );
 *
 * @class AccessibilityAnnouncer
 */
( function () {
	'use strict';

	/**
	 * AccessibilityAnnouncer class
	 * @constructor
	 */
	class AccessibilityAnnouncer {
		constructor() {
			this.politeRegion = null;
			this.assertiveRegion = null;
			this.initialized = false;
			this.pendingAnnouncements = [];
		}

		/**
		 * Initialize the ARIA live regions
		 * Called automatically on first announcement
		 */
		init() {
			if ( this.initialized ) {
				return;
			}

			// Create polite live region (for non-urgent updates)
			this.politeRegion = this.createLiveRegion( 'polite' );

			// Create assertive live region (for urgent updates like errors)
			this.assertiveRegion = this.createLiveRegion( 'assertive' );

			this.initialized = true;

			// Process any pending announcements
			this.processPendingAnnouncements();
		}

		/**
		 * Create a visually hidden ARIA live region
		 * @param {string} politeness 'polite' or 'assertive'
		 * @return {HTMLElement} The live region element
		 * @private
		 */
		createLiveRegion( politeness ) {
			const region = document.createElement( 'div' );
			region.setAttribute( 'role', 'status' );
			region.setAttribute( 'aria-live', politeness );
			region.setAttribute( 'aria-atomic', 'true' );
			region.className = 'layers-sr-only layers-announcer';
			region.id = 'layers-announcer-' + politeness;

			// Visually hidden but accessible to screen readers
			// Using CSS class instead of inline styles for maintainability
			region.style.cssText = [
				'position: absolute',
				'width: 1px',
				'height: 1px',
				'padding: 0',
				'margin: -1px',
				'overflow: hidden',
				'clip: rect(0, 0, 0, 0)',
				'white-space: nowrap',
				'border: 0'
			].join( '; ' );

			document.body.appendChild( region );
			return region;
		}

		/**
		 * Process any announcements that were queued before initialization
		 * @private
		 */
		processPendingAnnouncements() {
			while ( this.pendingAnnouncements.length > 0 ) {
				const { message, politeness } = this.pendingAnnouncements.shift();
				this.announce( message, politeness );
			}
		}

		/**
		 * Announce a message to screen readers
		 * @param {string} message The message to announce
		 * @param {string} [politeness='polite'] 'polite' for non-urgent, 'assertive' for urgent
		 */
		announce( message, politeness = 'polite' ) {
			if ( !message ) {
				return;
			}

			// Queue if not initialized
			if ( !this.initialized ) {
				this.pendingAnnouncements.push( { message, politeness } );
				// Try to initialize
				if ( document.body ) {
					this.init();
				} else {
					// Wait for DOM
					document.addEventListener( 'DOMContentLoaded', () => this.init(), { once: true } );
				}
				return;
			}

			const region = politeness === 'assertive' ? this.assertiveRegion : this.politeRegion;
			if ( !region ) {
				return;
			}

			// Clear and re-announce to trigger screen reader
			// Using a slight delay ensures the change is detected
			region.textContent = '';
			setTimeout( () => {
				region.textContent = message;
			}, 50 );
		}

		/**
		 * Announce an error message (uses assertive politeness)
		 * @param {string} message The error message
		 */
		announceError( message ) {
			this.announce( message, 'assertive' );
		}

		/**
		 * Announce a success message
		 * @param {string} message The success message
		 */
		announceSuccess( message ) {
			this.announce( message, 'polite' );
		}

		/**
		 * Announce tool change
		 * @param {string} toolName The name of the selected tool
		 */
		announceTool( toolName ) {
			if ( toolName ) {
				this.announce( toolName + ' tool selected', 'polite' );
			}
		}

		/**
		 * Announce layer selection
		 * @param {string} layerName The name of the selected layer
		 */
		announceLayerSelection( layerName ) {
			if ( layerName ) {
				this.announce( layerName + ' selected', 'polite' );
			}
		}

		/**
		 * Announce layer action (delete, duplicate, etc.)
		 * @param {string} action The action performed
		 * @param {string} [layerName] Optional layer name
		 */
		announceLayerAction( action, layerName ) {
			let message = action;
			if ( layerName ) {
				message = layerName + ' ' + action.toLowerCase();
			}
			this.announce( message, 'polite' );
		}

		/**
		 * Clear announcements
		 */
		clear() {
			if ( this.politeRegion ) {
				this.politeRegion.textContent = '';
			}
			if ( this.assertiveRegion ) {
				this.assertiveRegion.textContent = '';
			}
		}

		/**
		 * Clean up and remove live regions
		 */
		destroy() {
			if ( this.politeRegion && this.politeRegion.parentNode ) {
				this.politeRegion.parentNode.removeChild( this.politeRegion );
			}
			if ( this.assertiveRegion && this.assertiveRegion.parentNode ) {
				this.assertiveRegion.parentNode.removeChild( this.assertiveRegion );
			}
			this.politeRegion = null;
			this.assertiveRegion = null;
			this.initialized = false;
			this.pendingAnnouncements = [];
		}
	}

	// Create singleton instance
	const announcer = new AccessibilityAnnouncer();

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.AccessibilityAnnouncer = AccessibilityAnnouncer;

		// Backward compatibility - direct window exports
		window.layersAnnouncer = announcer;
		window.AccessibilityAnnouncer = AccessibilityAnnouncer;
	}

	// Export via CommonJS for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { AccessibilityAnnouncer };
	}

}() );
