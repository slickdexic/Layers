/**
 * History Manager for managing undo/redo operations
 * Separated from CanvasManager to improve modularity
 */

( function () {
	'use strict';

	/**
	 * History Manager class
	 *
	 * @param {number} maxSteps Maximum number of history steps to keep
	 * @class
	 */
	function HistoryManager( maxSteps ) {
		this.history = [];
		this.historyIndex = -1;
		this.maxHistorySteps = maxSteps || 50;
	}

	/**
	 * Add a state to history
	 *
	 * @param {Object} state - The state object to save
	 */
	HistoryManager.prototype.addState = function ( state ) {
		// Remove any history after current index (when undoing then making new changes)
		this.history = this.history.slice( 0, this.historyIndex + 1 );

		// Add new state
		var stateCopy = this.deepClone( state );
		this.history.push( stateCopy );

		// Limit history size
		if ( this.history.length > this.maxHistorySteps ) {
			this.history.shift();
		} else {
			this.historyIndex++;
		}
	};

	/**
	 * Undo the last action
	 *
	 * @return {Object|null} Previous state or null if nothing to undo
	 */
	HistoryManager.prototype.undo = function () {
		if ( this.historyIndex > 0 ) {
			this.historyIndex--;
			return this.deepClone( this.history[ this.historyIndex ] );
		}
		return null;
	};

	/**
	 * Redo the next action
	 *
	 * @return {Object|null} Next state or null if nothing to redo
	 */
	HistoryManager.prototype.redo = function () {
		if ( this.historyIndex < this.history.length - 1 ) {
			this.historyIndex++;
			return this.deepClone( this.history[ this.historyIndex ] );
		}
		return null;
	};

	/**
	 * Check if undo is available
	 *
	 * @return {boolean}
	 */
	HistoryManager.prototype.canUndo = function () {
		return this.historyIndex > 0;
	};

	/**
	 * Check if redo is available
	 *
	 * @return {boolean}
	 */
	HistoryManager.prototype.canRedo = function () {
		return this.historyIndex < this.history.length - 1;
	};

	/**
	 * Clear all history
	 */
	HistoryManager.prototype.clear = function () {
		this.history = [];
		this.historyIndex = -1;
	};

	/**
	 * Deep clone an object - more efficient than JSON.parse(JSON.stringify())
	 * for our specific use case
	 *
	 * @param {Object} obj - Object to clone
	 * @return {Object} Cloned object
	 */
	HistoryManager.prototype.deepClone = function ( obj ) {
		var i, cloned, key;

		if ( obj === null || typeof obj !== 'object' ) {
			return obj;
		}

		if ( obj instanceof Date ) {
			return new Date( obj.getTime() );
		}

		if ( obj instanceof Array ) {
			cloned = [];
			for ( i = 0; i < obj.length; i++ ) {
				cloned[ i ] = this.deepClone( obj[ i ] );
			}
			return cloned;
		}

		if ( typeof obj === 'object' ) {
			cloned = {};
			for ( key in obj ) {
				if ( Object.prototype.hasOwnProperty.call( obj, key ) ) {
					cloned[ key ] = this.deepClone( obj[ key ] );
				}
			}
			return cloned;
		}

		return obj;
	};

	// Export for use in other modules
	window.LayersHistoryManager = HistoryManager;

}() );
