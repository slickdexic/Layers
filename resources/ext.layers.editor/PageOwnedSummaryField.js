/** Optional edit summary for the page revision the next save creates; empty lets the server describe it. */
( function () {
	'use strict';

	class PageOwnedSummaryField {
		/**
		 * @param {Function} message Localization function (key) => string
		 */
		constructor( message ) {
			if ( typeof message !== 'function' ) {
				throw new Error( 'layers-invalid-summary-field' );
			}
			this.message = message;
			this.container = null;
			this.input = null;
		}

		/**
		 * @param {HTMLElement} parent Editor header
		 * @param {?HTMLElement} before Child of parent to insert before, or null to append
		 */
		mount( parent, before ) {
			if ( this.container || !parent || typeof parent.insertBefore !== 'function' ) {
				throw new Error( 'layers-invalid-mount-target' );
			}
			this.container = document.createElement( 'div' );
			this.container.className = 'layers-page-summary';
			const label = document.createElement( 'label' );
			label.htmlFor = 'layers-page-summary-input';
			label.textContent = this.message( 'layers-page-summary-label' );
			this.input = document.createElement( 'input' );
			this.input.type = 'text';
			this.input.id = 'layers-page-summary-input';
			// The page history keeps at most 500 characters of a summary.
			this.input.maxLength = 500;
			this.input.placeholder = this.message( 'layers-page-summary-placeholder' );
			this.container.appendChild( label );
			this.container.appendChild( this.input );
			parent.insertBefore( this.container, before || null );
		}

		/** @return {string} */
		getValue() {
			return this.input ? this.input.value.trim() : '';
		}

		/** Called once a save has been published. */
		clear() {
			if ( this.input ) {
				this.input.value = '';
			}
		}

		dispose() {
			if ( this.container ) {
				this.container.remove();
			}
			this.container = null;
			this.input = null;
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedSummaryField = PageOwnedSummaryField;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedSummaryField;
	}
}() );
