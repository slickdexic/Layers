/**
 * TimeoutTracker - Utility for tracking and cleaning up setTimeout/setInterval calls
 *
 * Prevents memory leaks by ensuring all timeouts and intervals are properly
 * cleared when a component is destroyed. Provides a consistent API for
 * debouncing, throttling, and delayed execution.
 *
 * Usage:
 *   const tracker = new TimeoutTracker();
 *   tracker.setTimeout('update', () => this.update(), 300);
 *   tracker.setDebounce('search', () => this.search(), 300);
 *   // On destroy:
 *   tracker.destroy();
 *
 * @module TimeoutTracker
 */
( function () {
	'use strict';

	/**
	 * TimeoutTracker class
	 *
	 * @class
	 */
	class TimeoutTracker {
		constructor() {
			/**
			 * Map of named timeouts
			 *
			 * @type {Map<string, number>}
			 */
			this.timeouts = new Map();

			/**
			 * Map of named intervals
			 *
			 * @type {Map<string, number>}
			 */
			this.intervals = new Map();

			/**
			 * Whether the tracker has been destroyed
			 *
			 * @type {boolean}
			 */
			this.destroyed = false;
		}

		/**
		 * Set a named timeout. Automatically clears any existing timeout with the same name.
		 *
		 * @param {string} name - Unique name for this timeout
		 * @param {Function} callback - Function to execute after delay
		 * @param {number} delay - Delay in milliseconds
		 * @return {number|null} The timeout ID, or null if destroyed
		 */
		setTimeout( name, callback, delay ) {
			if ( this.destroyed ) {
				return null;
			}

			// Clear existing timeout with this name
			this.clearTimeout( name );

			const id = setTimeout( () => {
				this.timeouts.delete( name );
				if ( !this.destroyed ) {
					callback();
				}
			}, delay );

			this.timeouts.set( name, id );
			return id;
		}

		/**
		 * Clear a named timeout
		 *
		 * @param {string} name - Name of the timeout to clear
		 * @return {boolean} True if a timeout was cleared
		 */
		clearTimeout( name ) {
			const id = this.timeouts.get( name );
			if ( id !== undefined ) {
				clearTimeout( id );
				this.timeouts.delete( name );
				return true;
			}
			return false;
		}

		/**
		 * Set a debounced callback. Each call resets the timer.
		 * Alias for setTimeout with the same name.
		 *
		 * @param {string} name - Unique name for this debounce
		 * @param {Function} callback - Function to execute after delay
		 * @param {number} delay - Delay in milliseconds (default 300)
		 * @return {number|null} The timeout ID, or null if destroyed
		 */
		setDebounce( name, callback, delay ) {
			return this.setTimeout( name, callback, delay || 300 );
		}

		/**
		 * Set a named interval. Automatically clears any existing interval with the same name.
		 *
		 * @param {string} name - Unique name for this interval
		 * @param {Function} callback - Function to execute on each interval
		 * @param {number} delay - Interval in milliseconds
		 * @return {number|null} The interval ID, or null if destroyed
		 */
		setInterval( name, callback, delay ) {
			if ( this.destroyed ) {
				return null;
			}

			// Clear existing interval with this name
			this.clearInterval( name );

			const id = setInterval( () => {
				if ( !this.destroyed ) {
					callback();
				}
			}, delay );

			this.intervals.set( name, id );
			return id;
		}

		/**
		 * Clear a named interval
		 *
		 * @param {string} name - Name of the interval to clear
		 * @return {boolean} True if an interval was cleared
		 */
		clearInterval( name ) {
			const id = this.intervals.get( name );
			if ( id !== undefined ) {
				clearInterval( id );
				this.intervals.delete( name );
				return true;
			}
			return false;
		}

		/**
		 * Execute a callback after a delay, only if not already pending.
		 * Unlike setTimeout, this won't reset the timer on subsequent calls.
		 *
		 * @param {string} name - Unique name for this delayed execution
		 * @param {Function} callback - Function to execute after delay
		 * @param {number} delay - Delay in milliseconds
		 * @return {boolean} True if a new timeout was set, false if one was already pending
		 */
		setOnce( name, callback, delay ) {
			if ( this.destroyed || this.timeouts.has( name ) ) {
				return false;
			}
			this.setTimeout( name, callback, delay );
			return true;
		}

		/**
		 * Check if a named timeout is currently pending
		 *
		 * @param {string} name - Name of the timeout
		 * @return {boolean} True if the timeout is pending
		 */
		isPending( name ) {
			return this.timeouts.has( name );
		}

		/**
		 * Clear all timeouts
		 */
		clearAllTimeouts() {
			for ( const id of this.timeouts.values() ) {
				clearTimeout( id );
			}
			this.timeouts.clear();
		}

		/**
		 * Clear all intervals
		 */
		clearAllIntervals() {
			for ( const id of this.intervals.values() ) {
				clearInterval( id );
			}
			this.intervals.clear();
		}

		/**
		 * Get count of active timeouts
		 *
		 * @return {number} Number of active timeouts
		 */
		getTimeoutCount() {
			return this.timeouts.size;
		}

		/**
		 * Get count of active intervals
		 *
		 * @return {number} Number of active intervals
		 */
		getIntervalCount() {
			return this.intervals.size;
		}

		/**
		 * Destroy the tracker and clear all timeouts/intervals.
		 * After calling destroy, no new timeouts/intervals can be set.
		 */
		destroy() {
			this.destroyed = true;
			this.clearAllTimeouts();
			this.clearAllIntervals();
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.TimeoutTracker = TimeoutTracker;
	}

	// CommonJS export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { TimeoutTracker };
	}

}() );
