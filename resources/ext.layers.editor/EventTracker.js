/**
 * EventTracker - Utility for tracking and cleaning up event listeners
 *
 * This utility helps prevent memory leaks by ensuring all event listeners
 * are properly tracked and can be removed during cleanup.
 *
 * Usage:
 *   const tracker = new EventTracker();
 *   tracker.add( element, 'click', handler );
 *   tracker.add( window, 'resize', resizeHandler );
 *   // Later, clean up all listeners:
 *   tracker.destroy();
 *
 * @class EventTracker
 */
( function () {
	'use strict';

	/**
	 * EventTracker class
	 * @constructor
	 * @param {Object} [options] - Configuration options
	 * @param {boolean} [options.debug=false] - Enable debug logging
	 */
	function EventTracker( options ) {
		this.options = options || {};
		this.debug = this.options.debug || false;
		this.listeners = [];
		this.destroyed = false;
	}

	/**
	 * Add an event listener and track it for later cleanup
	 *
	 * @param {EventTarget} element - The element to attach the listener to
	 * @param {string} type - The event type (e.g., 'click', 'mousedown')
	 * @param {Function} handler - The event handler function
	 * @param {Object|boolean} [options] - Event listener options (passive, capture, etc.)
	 * @return {Object} Reference to the listener entry for manual removal
	 */
	EventTracker.prototype.add = function ( element, type, handler, options ) {
		if ( this.destroyed ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( '[EventTracker] Cannot add listener after destroy()' );
			}
			return null;
		}

		if ( !element || typeof element.addEventListener !== 'function' ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( '[EventTracker] Invalid element provided' );
			}
			return null;
		}

		if ( typeof handler !== 'function' ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( '[EventTracker] Handler must be a function' );
			}
			return null;
		}

		const entry = {
			element: element,
			type: type,
			handler: handler,
			options: options
		};

		element.addEventListener( type, handler, options );
		this.listeners.push( entry );

		if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
			mw.log( '[EventTracker] Added listener: ' + type );
		}

		return entry;
	};

	/**
	 * Remove a specific tracked listener
	 *
	 * @param {Object} entry - The listener entry returned by add()
	 * @return {boolean} True if the listener was found and removed
	 */
	EventTracker.prototype.remove = function ( entry ) {
		if ( !entry ) {
			return false;
		}

		const index = this.listeners.indexOf( entry );
		if ( index === -1 ) {
			return false;
		}

		try {
			entry.element.removeEventListener( entry.type, entry.handler, entry.options );
		} catch ( e ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( '[EventTracker] Error removing listener:', e.message );
			}
		}

		this.listeners.splice( index, 1 );
		return true;
	};

	/**
	 * Remove all listeners for a specific element
	 *
	 * @param {EventTarget} element - The element to remove listeners from
	 * @return {number} Number of listeners removed
	 */
	EventTracker.prototype.removeAllForElement = function ( element ) {
		let count = 0;
		const remaining = [];

		this.listeners.forEach( function ( entry ) {
			if ( entry.element === element ) {
				try {
					entry.element.removeEventListener( entry.type, entry.handler, entry.options );
					count++;
				} catch ( e ) {
					// Element may have been removed from DOM
				}
			} else {
				remaining.push( entry );
			}
		} );

		this.listeners = remaining;
		return count;
	};

	/**
	 * Remove all listeners of a specific type
	 *
	 * @param {string} type - The event type to remove
	 * @return {number} Number of listeners removed
	 */
	EventTracker.prototype.removeAllOfType = function ( type ) {
		let count = 0;
		const remaining = [];

		this.listeners.forEach( function ( entry ) {
			if ( entry.type === type ) {
				try {
					entry.element.removeEventListener( entry.type, entry.handler, entry.options );
					count++;
				} catch ( e ) {
					// Element may have been removed from DOM
				}
			} else {
				remaining.push( entry );
			}
		} );

		this.listeners = remaining;
		return count;
	};

	/**
	 * Get the count of tracked listeners
	 *
	 * @return {number} Number of active tracked listeners
	 */
	EventTracker.prototype.count = function () {
		return this.listeners.length;
	};

	/**
	 * Check if there are any tracked listeners
	 *
	 * @return {boolean} True if there are tracked listeners
	 */
	EventTracker.prototype.hasListeners = function () {
		return this.listeners.length > 0;
	};

	/**
	 * Destroy all tracked listeners and clean up
	 * After calling destroy(), this tracker should not be used
	 */
	EventTracker.prototype.destroy = function () {
		if ( this.destroyed ) {
			return;
		}

		const self = this;
		this.listeners.forEach( function ( entry ) {
			try {
				entry.element.removeEventListener( entry.type, entry.handler, entry.options );
			} catch ( e ) {
				if ( self.debug && typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
					mw.log.warn( '[EventTracker] Error during destroy:', e.message );
				}
			}
		} );

		if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
			mw.log( '[EventTracker] Destroyed ' + this.listeners.length + ' listeners' );
		}

		this.listeners = [];
		this.destroyed = true;
	};

	// Export for browser
	if ( typeof window !== 'undefined' ) {
		window.EventTracker = EventTracker;
	}

	// Export for CommonJS/Jest tests
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = EventTracker;
	}

}() );
