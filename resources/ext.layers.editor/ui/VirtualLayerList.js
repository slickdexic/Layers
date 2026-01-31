/**
 * Virtual Layer List - Performance optimization for large layer counts
 *
 * Implements virtual scrolling to only render visible layer items,
 * preventing UI slowdowns when layer counts exceed ~50.
 *
 * @module VirtualLayerList
 * @since 1.5.20
 */
( function () {
	'use strict';

	/**
	 * VirtualLayerList class
	 * Provides virtual scrolling for layer lists with many items
	 */
	class VirtualLayerList {
		/**
		 * Create a VirtualLayerList instance
		 *
		 * @param {Object} config Configuration object
		 * @param {HTMLElement} config.container Scrollable container element
		 * @param {HTMLElement} config.listElement Layer list element inside container
		 * @param {Function} config.getLayers Function returning array of layers
		 * @param {Function} config.createItem Function to create a layer item DOM element
		 * @param {Function} config.updateItem Function to update an existing layer item
		 * @param {number} [config.itemHeight=44] Fixed height per layer item in pixels
		 * @param {number} [config.overscan=5] Number of extra items to render above/below viewport
		 * @param {number} [config.threshold=30] Minimum layer count to enable virtualization
		 */
		constructor( config ) {
			this.container = config.container;
			this.listElement = config.listElement;
			this.getLayers = config.getLayers;
			this.createItem = config.createItem;
			this.updateItem = config.updateItem;
			this.itemHeight = config.itemHeight || 44;
			this.overscan = config.overscan || 5;
			this.threshold = config.threshold || 30;

			// Internal state
			this._scrollTop = 0;
			this._containerHeight = 0;
			this._renderedRange = { start: 0, end: 0 };
			this._itemPool = new Map(); // Recycled DOM elements by layer ID
			this._spacerTop = null;
			this._spacerBottom = null;
			this._scrollHandler = null;
			this._resizeObserver = null;
			this._isEnabled = false;
			this._pendingRender = null;
			this._destroyed = false;

			this._init();
		}

		/**
		 * Initialize the virtual list
		 *
		 * @private
		 */
		_init() {
			// Create spacer elements for maintaining scroll height
			this._spacerTop = document.createElement( 'div' );
			this._spacerTop.className = 'layers-virtual-spacer-top';
			this._spacerTop.style.height = '0px';
			this._spacerTop.setAttribute( 'aria-hidden', 'true' );

			this._spacerBottom = document.createElement( 'div' );
			this._spacerBottom.className = 'layers-virtual-spacer-bottom';
			this._spacerBottom.style.height = '0px';
			this._spacerBottom.setAttribute( 'aria-hidden', 'true' );

			// Bind scroll handler with throttling
			this._scrollHandler = this._throttle( () => {
				this._onScroll();
			}, 16 ); // ~60fps

			// Observe container size changes
			if ( typeof ResizeObserver !== 'undefined' ) {
				this._resizeObserver = new ResizeObserver( () => {
					this._updateContainerHeight();
					this._scheduleRender();
				} );
			}
		}

		/**
		 * Check if virtualization should be enabled based on layer count
		 *
		 * @return {boolean} True if virtualization is active
		 */
		isEnabled() {
			const layers = this.getLayers();
			return layers.length >= this.threshold;
		}

		/**
		 * Enable virtual scrolling
		 */
		enable() {
			if ( this._isEnabled ) {
				return;
			}

			this._isEnabled = true;
			this.container.addEventListener( 'scroll', this._scrollHandler, { passive: true } );

			if ( this._resizeObserver ) {
				this._resizeObserver.observe( this.container );
			}

			this._updateContainerHeight();
		}

		/**
		 * Disable virtual scrolling and clean up
		 */
		disable() {
			if ( !this._isEnabled ) {
				return;
			}

			this._isEnabled = false;
			this.container.removeEventListener( 'scroll', this._scrollHandler );

			if ( this._resizeObserver ) {
				this._resizeObserver.disconnect();
			}

			// Remove spacers
			if ( this._spacerTop.parentNode ) {
				this._spacerTop.parentNode.removeChild( this._spacerTop );
			}
			if ( this._spacerBottom.parentNode ) {
				this._spacerBottom.parentNode.removeChild( this._spacerBottom );
			}

			// Clear state
			this._renderedRange = { start: 0, end: 0 };
			this._itemPool.clear();

			if ( this._pendingRender ) {
				cancelAnimationFrame( this._pendingRender );
				this._pendingRender = null;
			}
		}

		/**
		 * Render the virtual list
		 * Call this when layers change
		 */
		render() {
			const layers = this.getLayers();

			// Check if we should use virtualization
			if ( layers.length < this.threshold ) {
				// Below threshold - disable virtualization and let normal rendering handle it
				if ( this._isEnabled ) {
					this.disable();
				}
				return false; // Signal that virtualization is not handling this render
			}

			// Enable virtualization if not already
			if ( !this._isEnabled ) {
				this.enable();
			}

			this._performRender();
			return true; // Signal that virtualization handled the render
		}

		/**
		 * Perform the actual render
		 *
		 * @private
		 */
		_performRender() {
			const layers = this.getLayers();

			// Calculate visible range
			this._scrollTop = this.container.scrollTop;
			const startIndex = Math.max( 0, Math.floor( this._scrollTop / this.itemHeight ) - this.overscan );
			const visibleCount = Math.ceil( this._containerHeight / this.itemHeight );
			const endIndex = Math.min( layers.length, startIndex + visibleCount + ( this.overscan * 2 ) );

			// Update spacers
			const topSpacerHeight = startIndex * this.itemHeight;
			const bottomSpacerHeight = ( layers.length - endIndex ) * this.itemHeight;

			this._spacerTop.style.height = topSpacerHeight + 'px';
			this._spacerBottom.style.height = bottomSpacerHeight + 'px';

			// Ensure spacers are in DOM
			if ( !this._spacerTop.parentNode ) {
				this.listElement.insertBefore( this._spacerTop, this.listElement.firstChild );
			}

			// Get current layer items in DOM (excluding spacers and background layer)
			const existingItems = new Map();
			const domItems = this.listElement.querySelectorAll( '.layer-item:not(.background-layer-item)' );
			domItems.forEach( ( item ) => {
				existingItems.set( item.dataset.layerId, item );
			} );

			// Determine which items to show
			const visibleLayers = layers.slice( startIndex, endIndex );
			const visibleIds = new Set( visibleLayers.map( ( l ) => String( l.id ) ) );

			// Remove items that are no longer visible
			existingItems.forEach( ( item, id ) => {
				if ( !visibleIds.has( id ) ) {
					// Move to pool for recycling
					this._itemPool.set( id, item );
					item.remove();
				}
			} );

			// Render visible items
			const insertBefore = this._spacerBottom.parentNode ? this._spacerBottom : null;
			visibleLayers.forEach( ( layer, i ) => {
				const layerId = String( layer.id );
				const globalIndex = startIndex + i;
				let item = existingItems.get( layerId ) || this._itemPool.get( layerId );

				if ( item ) {
					// Update existing/pooled item
					this.updateItem( item, layer, globalIndex );
					this._itemPool.delete( layerId );
				} else {
					// Create new item
					item = this.createItem( layer, globalIndex );
				}

				// Ensure item is in correct position
				if ( item.parentNode !== this.listElement ) {
					this.listElement.insertBefore( item, insertBefore );
				}
			} );

			// Ensure bottom spacer is at end
			if ( !this._spacerBottom.parentNode ) {
				this.listElement.appendChild( this._spacerBottom );
			}

			// Update rendered range
			this._renderedRange = { start: startIndex, end: endIndex };

			// Clean up old pooled items (keep pool size reasonable)
			if ( this._itemPool.size > 50 ) {
				const toRemove = this._itemPool.size - 50;
				let removed = 0;
				for ( const [ id ] of this._itemPool ) {
					if ( removed >= toRemove ) {
						break;
					}
					this._itemPool.delete( id );
					removed++;
				}
			}
		}

		/**
		 * Handle scroll events
		 *
		 * @private
		 */
		_onScroll() {
			if ( !this._isEnabled ) {
				return;
			}
			this._scheduleRender();
		}

		/**
		 * Schedule a render on next animation frame
		 *
		 * @private
		 */
		_scheduleRender() {
			if ( this._pendingRender ) {
				return;
			}
			this._pendingRender = requestAnimationFrame( () => {
				this._pendingRender = null;
				// Guard against execution after destroy() was called
				if ( this._destroyed ) {
					return;
				}
				this._performRender();
			} );
		}

		/**
		 * Update container height measurement
		 *
		 * @private
		 */
		_updateContainerHeight() {
			this._containerHeight = this.container.clientHeight || 400;
		}

		/**
		 * Scroll to make a specific layer visible
		 *
		 * @param {string} layerId Layer ID to scroll to
		 */
		scrollToLayer( layerId ) {
			const layers = this.getLayers();
			const index = layers.findIndex( ( l ) => String( l.id ) === String( layerId ) );

			if ( index === -1 ) {
				return;
			}

			const itemTop = index * this.itemHeight;
			const itemBottom = itemTop + this.itemHeight;
			const viewTop = this.container.scrollTop;
			const viewBottom = viewTop + this._containerHeight;

			if ( itemTop < viewTop ) {
				// Scroll up to show item
				this.container.scrollTop = itemTop;
			} else if ( itemBottom > viewBottom ) {
				// Scroll down to show item
				this.container.scrollTop = itemBottom - this._containerHeight;
			}

			// Re-render after scroll
			this._scheduleRender();
		}

		/**
		 * Get the currently visible range
		 *
		 * @return {Object} Object with start and end indices
		 */
		getVisibleRange() {
			return { ...this._renderedRange };
		}

		/**
		 * Throttle function execution
		 *
		 * @param {Function} fn Function to throttle
		 * @param {number} limit Time limit in ms
		 * @return {Function} Throttled function
		 * @private
		 */
		_throttle( fn, limit ) {
			let inThrottle = false;
			return function ( ...args ) {
				if ( !inThrottle ) {
					fn.apply( this, args );
					inThrottle = true;
					setTimeout( () => {
						inThrottle = false;
					}, limit );
				}
			};
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this._destroyed = true;
			this.disable();
			this._itemPool.clear();
			this._spacerTop = null;
			this._spacerBottom = null;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.VirtualLayerList = VirtualLayerList;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = VirtualLayerList;
	}
}() );
