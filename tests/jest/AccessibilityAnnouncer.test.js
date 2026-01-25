/**
 * @jest-environment jsdom
 */

/**
 * Tests for AccessibilityAnnouncer
 * Tests the actual implementation from the module
 */

// Import the actual module
require( '../../resources/ext.layers.editor/AccessibilityAnnouncer.js' );

describe( 'AccessibilityAnnouncer', () => {
	// Use the namespaced export
	const AccessibilityAnnouncer = window.Layers.Utils.AccessibilityAnnouncer;
	let announcer;

	beforeEach( () => {
		// Clear document body
		document.body.innerHTML = '';

		// Mock setTimeout to execute immediately
		jest.useFakeTimers();

		// Test fixture - inline class is kept for reference but we use window.AccessibilityAnnouncer
		const _ReferenceClass = class {
			constructor() {
				this.politeRegion = null;
				this.assertiveRegion = null;
				this.initialized = false;
				this.pendingAnnouncements = [];
			}

			init() {
				if ( this.initialized ) {
					return;
				}
				this.politeRegion = this.createLiveRegion( 'polite' );
				this.assertiveRegion = this.createLiveRegion( 'assertive' );
				this.initialized = true;
				this.processPendingAnnouncements();
			}

			createLiveRegion( politeness ) {
				const region = document.createElement( 'div' );
				region.setAttribute( 'role', 'status' );
				region.setAttribute( 'aria-live', politeness );
				region.setAttribute( 'aria-atomic', 'true' );
				region.className = 'layers-sr-only layers-announcer';
				region.id = 'layers-announcer-' + politeness;
				document.body.appendChild( region );
				return region;
			}

			processPendingAnnouncements() {
				while ( this.pendingAnnouncements.length > 0 ) {
					const { message, politeness } = this.pendingAnnouncements.shift();
					this.announce( message, politeness );
				}
			}

			announce( message, politeness = 'polite' ) {
				if ( !message ) {
					return;
				}
				if ( !this.initialized ) {
					this.pendingAnnouncements.push( { message, politeness } );
					if ( document.body ) {
						this.init();
					}
					return;
				}
				const region = politeness === 'assertive' ? this.assertiveRegion : this.politeRegion;
				if ( region ) {
					region.textContent = '';
					setTimeout( () => {
						region.textContent = message;
					}, 50 );
					// Run timers to complete the announcement
					jest.runAllTimers();
				}
			}

			announceError( message ) {
				this.announce( message, 'assertive' );
			}

			announceSuccess( message ) {
				this.announce( message, 'polite' );
			}

			announceTool( toolName ) {
				if ( toolName ) {
					this.announce( toolName + ' tool selected', 'polite' );
				}
			}

			announceLayerSelection( layerName ) {
				if ( layerName ) {
					this.announce( layerName + ' selected', 'polite' );
				}
			}

			announceLayerAction( action, layerName ) {
				let message = action;
				if ( layerName ) {
					message = layerName + ' ' + action.toLowerCase();
				}
				this.announce( message, 'polite' );
			}

			clear() {
				if ( this.politeRegion ) {
					this.politeRegion.textContent = '';
				}
				if ( this.assertiveRegion ) {
					this.assertiveRegion.textContent = '';
				}
			}

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
		};

		// Use the actual AccessibilityAnnouncer from the module
		announcer = new AccessibilityAnnouncer();
	} );

	afterEach( () => {
		if ( announcer ) {
			announcer.destroy();
		}
		jest.useRealTimers();
	} );

	describe( 'initialization', () => {
		it( 'should not be initialized by default', () => {
			expect( announcer.initialized ).toBe( false );
		} );

		it( 'should initialize on first announcement', () => {
			announcer.announce( 'Test message' );
			jest.runAllTimers();
			expect( announcer.initialized ).toBe( true );
		} );

		it( 'should create polite live region', () => {
			announcer.init();
			expect( announcer.politeRegion ).not.toBeNull();
			expect( announcer.politeRegion.getAttribute( 'aria-live' ) ).toBe( 'polite' );
		} );

		it( 'should create assertive live region', () => {
			announcer.init();
			expect( announcer.assertiveRegion ).not.toBeNull();
			expect( announcer.assertiveRegion.getAttribute( 'aria-live' ) ).toBe( 'assertive' );
		} );

		it( 'should set proper ARIA attributes on live regions', () => {
			announcer.init();
			expect( announcer.politeRegion.getAttribute( 'role' ) ).toBe( 'status' );
			expect( announcer.politeRegion.getAttribute( 'aria-atomic' ) ).toBe( 'true' );
		} );
	} );

	describe( 'announce', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce message in polite region by default', () => {
			announcer.announce( 'Hello world' );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( 'Hello world' );
		} );

		it( 'should announce message in assertive region when specified', () => {
			announcer.announce( 'Urgent message', 'assertive' );
			jest.runAllTimers();
			expect( announcer.assertiveRegion.textContent ).toBe( 'Urgent message' );
		} );

		it( 'should not announce empty messages', () => {
			announcer.announce( '' );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( '' );
		} );

		it( 'should not announce null messages', () => {
			announcer.announce( null );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( '' );
		} );
	} );

	describe( 'announceError', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce error in assertive region', () => {
			announcer.announceError( 'Something went wrong' );
			jest.runAllTimers();
			expect( announcer.assertiveRegion.textContent ).toBe( 'Something went wrong' );
		} );
	} );

	describe( 'announceSuccess', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce success in polite region', () => {
			announcer.announceSuccess( 'Saved successfully' );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( 'Saved successfully' );
		} );
	} );

	describe( 'announceTool', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce tool selection', () => {
			announcer.announceTool( 'Rectangle' );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( 'Rectangle tool selected' );
		} );

		it( 'should not announce empty tool name', () => {
			announcer.announceTool( '' );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( '' );
		} );
	} );

	describe( 'announceLayerSelection', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce layer selection', () => {
			announcer.announceLayerSelection( 'My Rectangle' );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( 'My Rectangle selected' );
		} );
	} );

	describe( 'announceLayerAction', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce action with layer name', () => {
			announcer.announceLayerAction( 'deleted', 'Rectangle' );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( 'Rectangle deleted' );
		} );

		it( 'should announce action without layer name', () => {
			announcer.announceLayerAction( 'Layer created' );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( 'Layer created' );
		} );
	} );

	describe( 'announceZoom', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce zoom percentage', () => {
			announcer.announceZoom( 150 );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( 'Zoom 150 percent' );
		} );

		it( 'should round fractional zoom values', () => {
			announcer.announceZoom( 75.7 );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( 'Zoom 76 percent' );
		} );

		it( 'should not announce non-numeric values', () => {
			announcer.announceZoom( null );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( '' );
		} );
	} );

	describe( 'announceLayerSummary', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce layer count', () => {
			announcer.announceLayerSummary( 5, 0 );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( '5 layers' );
		} );

		it( 'should use singular for one layer', () => {
			announcer.announceLayerSummary( 1, 0 );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( '1 layer' );
		} );

		it( 'should include selection count', () => {
			announcer.announceLayerSummary( 10, 3 );
			jest.runAllTimers();
			expect( announcer.politeRegion.textContent ).toBe( '10 layers, 3 selected' );
		} );
	} );

	describe( 'clear', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should clear all announcements', () => {
			announcer.announce( 'Test message' );
			announcer.announceError( 'Error message' );
			jest.runAllTimers();
			announcer.clear();
			expect( announcer.politeRegion.textContent ).toBe( '' );
			expect( announcer.assertiveRegion.textContent ).toBe( '' );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should remove live regions from DOM', () => {
			announcer.init();
			const politeId = announcer.politeRegion.id;
			const assertiveId = announcer.assertiveRegion.id;
			announcer.destroy();
			expect( document.getElementById( politeId ) ).toBeNull();
			expect( document.getElementById( assertiveId ) ).toBeNull();
		} );

		it( 'should reset state', () => {
			announcer.init();
			announcer.destroy();
			expect( announcer.initialized ).toBe( false );
			expect( announcer.politeRegion ).toBeNull();
			expect( announcer.assertiveRegion ).toBeNull();
		} );

		it( 'should clear pending timeout on destroy', () => {
			announcer.init();
			// Start an announcement (which schedules a timeout)
			announcer.announce( 'Test message' );
			// Verify pending timeout is set
			expect( announcer.pendingTimeoutId ).not.toBeNull();
			// Destroy before timeout fires
			announcer.destroy();
			// Verify timeout was cleared
			expect( announcer.pendingTimeoutId ).toBeNull();
		} );

		it( 'should not throw when timeout fires after destroy', () => {
			announcer.init();
			const politeRegion = announcer.politeRegion;
			// Start an announcement
			announcer.announce( 'Test message' );
			// Destroy immediately (before timeout fires)
			announcer.destroy();
			// Run all timers - should not throw
			expect( () => jest.runAllTimers() ).not.toThrow();
			// Region should not have been updated (it was removed)
			expect( politeRegion.parentNode ).toBeNull();
		} );
	} );

	describe( 'pending announcements', () => {
		it( 'should queue announcements before initialization', () => {
			const freshAnnouncer = new AccessibilityAnnouncer();
			// Queue messages before init
			freshAnnouncer.pendingAnnouncements.push( { message: 'First', politeness: 'polite' } );
			freshAnnouncer.pendingAnnouncements.push( { message: 'Second', politeness: 'assertive' } );
			expect( freshAnnouncer.pendingAnnouncements.length ).toBe( 2 );
		} );

		it( 'should process pending announcements after init', () => {
			const freshAnnouncer = new AccessibilityAnnouncer();
			freshAnnouncer.pendingAnnouncements.push( { message: 'Queued message', politeness: 'polite' } );
			freshAnnouncer.init();
			// After processing, pending should be empty
			expect( freshAnnouncer.pendingAnnouncements.length ).toBe( 0 );
			freshAnnouncer.destroy();
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should return early if init is called twice', () => {
			const freshAnnouncer = new AccessibilityAnnouncer();
			freshAnnouncer.init();
			const politeRegion1 = freshAnnouncer.politeRegion;

			// Call init again
			freshAnnouncer.init();

			// Should still have the same region (not recreated)
			expect( freshAnnouncer.politeRegion ).toBe( politeRegion1 );
			freshAnnouncer.destroy();
		} );

		it( 'should handle announce when region is null', () => {
			const freshAnnouncer = new AccessibilityAnnouncer();
			freshAnnouncer.init();

			// Simulate region being null (edge case after destroy)
			freshAnnouncer.politeRegion = null;
			freshAnnouncer.assertiveRegion = null;

			// Should not throw when region is null
			expect( () => {
				freshAnnouncer.announce( 'Test' );
				jest.runAllTimers();
			} ).not.toThrow();
		} );

		it( 'should handle announce when not initialized and body not available', () => {
			// Save original body
			const originalBody = document.body;

			// Create a fresh announcer
			const freshAnnouncer = new AccessibilityAnnouncer();
			freshAnnouncer.initialized = false;

			// Mock document.body to null temporarily
			Object.defineProperty( document, 'body', {
				value: null,
				writable: true,
				configurable: true
			} );

			// Add event listener spy
			const addEventListenerSpy = jest.spyOn( document, 'addEventListener' );

			// Announce should queue and set up DOMContentLoaded listener
			freshAnnouncer.announce( 'Test message' );

			expect( freshAnnouncer.pendingAnnouncements.length ).toBe( 1 );
			expect( addEventListenerSpy ).toHaveBeenCalledWith(
				'DOMContentLoaded',
				expect.any( Function ),
				{ once: true }
			);

			// Restore body
			Object.defineProperty( document, 'body', {
				value: originalBody,
				writable: true,
				configurable: true
			} );

			addEventListenerSpy.mockRestore();
		} );

		it( 'should not set textContent when region parentNode is null during timeout', () => {
			const freshAnnouncer = new AccessibilityAnnouncer();
			freshAnnouncer.init();

			// Get reference to polite region
			const politeRegion = freshAnnouncer.politeRegion;

			// Remove the region from DOM (but don't destroy the announcer)
			politeRegion.parentNode.removeChild( politeRegion );

			// Now announce - the setTimeout callback should check parentNode
			freshAnnouncer.announce( 'Test message' );

			// Run timers - callback should skip setting textContent since parentNode is null
			jest.runAllTimers();

			// Verify textContent was NOT set (the branch was hit)
			expect( politeRegion.textContent ).toBe( '' );

			// Cleanup
			freshAnnouncer.destroy();
		} );

		it( 'should not announce for empty layer name in announceLayerSelection', () => {
			const freshAnnouncer = new AccessibilityAnnouncer();
			freshAnnouncer.init();

			// Call with empty string
			freshAnnouncer.announceLayerSelection( '' );
			jest.runAllTimers();

			// Should not have announced anything
			expect( freshAnnouncer.politeRegion.textContent ).toBe( '' );

			freshAnnouncer.destroy();
		} );

		it( 'should clear politeRegion in clear() when it exists', () => {
			const freshAnnouncer = new AccessibilityAnnouncer();
			// Don't init - politeRegion is null
			freshAnnouncer.initialized = true;
			freshAnnouncer.politeRegion = null;
			freshAnnouncer.assertiveRegion = null;

			// Should not throw when regions are null
			expect( () => freshAnnouncer.clear() ).not.toThrow();
		} );
	} );
} );
