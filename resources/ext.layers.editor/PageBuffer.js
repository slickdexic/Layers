/**
 * Holds unsaved edits for pages of a multi-page file that the reader has left.
 *
 * Turning a page used to force a decision — save now, or throw the work away —
 * so annotating ten pages of a PDF meant ten modal dialogs and ten save round
 * trips. The dialog was also answering a question nobody asked: the reader
 * wanted to turn a page, not to publish.
 *
 * Holding the work here makes a page turn just a page turn. One Save writes
 * every page that changed.
 *
 * Only dirty pages are kept. A clean page is re-fetched on return, which the
 * APIManager response cache already makes cheap, so merely paging through a
 * document never grows the buffer. There is deliberately no cap: the only way
 * to bound it would be to silently drop somebody's edits.
 */
( function () {
	'use strict';

	class PageBuffer {
		constructor() {
			this.pages = new Map();
		}

		/**
		 * Hold a page's unsaved work.
		 *
		 * @param {number} page 1-based page number
		 * @param {Object} entry Layers plus the context needed to restore the
		 *   page without a server round trip
		 */
		stash( page, entry ) {
			const key = parseInt( page, 10 );
			if ( !key || key < 1 || !entry ) {
				return;
			}
			this.pages.set( key, entry );
		}

		/**
		 * @param {number} page 1-based page number
		 * @return {Object|null} Held entry, or null if this page has none
		 */
		get( page ) {
			return this.pages.get( parseInt( page, 10 ) ) || null;
		}

		/**
		 * @param {number} page 1-based page number
		 * @return {boolean}
		 */
		has( page ) {
			return this.pages.has( parseInt( page, 10 ) );
		}

		/**
		 * Release a page, normally because its work reached the server.
		 *
		 * @param {number} page 1-based page number
		 */
		forget( page ) {
			this.pages.delete( parseInt( page, 10 ) );
		}

		clear() {
			this.pages.clear();
		}

		/**
		 * @return {number[]} Held page numbers, ascending, so a multi-page save
		 *   writes and reports them in reading order
		 */
		dirtyPages() {
			return Array.from( this.pages.keys() ).sort( ( a, b ) => a - b );
		}

		/**
		 * @return {boolean}
		 */
		isEmpty() {
			return this.pages.size === 0;
		}

		/**
		 * @return {number} Count of pages carrying unsaved work
		 */
		size() {
			return this.pages.size;
		}
	}

	// Export to namespace
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageBuffer = PageBuffer;

	// Legacy global export
	window.PageBuffer = PageBuffer;

}() );
