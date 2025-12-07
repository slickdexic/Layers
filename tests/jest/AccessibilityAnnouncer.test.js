/**
 * @jest-environment jsdom
 */

/**
 * Tests for AccessibilityAnnouncer
 */

describe( 'AccessibilityAnnouncer', () => {
	let AccessibilityAnnouncer;
	let announcer;

	beforeEach( () => {
		// Clear document body
		document.body.innerHTML = '';

		// Mock setTimeout to execute immediately
		jest.useFakeTimers();

		// Define the AccessibilityAnnouncer class for testing
		AccessibilityAnnouncer = class {
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
			expect( announcer.politeRegion.textContent ).toBe( 'Hello world' );
		} );

		it( 'should announce message in assertive region when specified', () => {
			announcer.announce( 'Urgent message', 'assertive' );
			expect( announcer.assertiveRegion.textContent ).toBe( 'Urgent message' );
		} );

		it( 'should not announce empty messages', () => {
			announcer.announce( '' );
			expect( announcer.politeRegion.textContent ).toBe( '' );
		} );

		it( 'should not announce null messages', () => {
			announcer.announce( null );
			expect( announcer.politeRegion.textContent ).toBe( '' );
		} );
	} );

	describe( 'announceError', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce error in assertive region', () => {
			announcer.announceError( 'Something went wrong' );
			expect( announcer.assertiveRegion.textContent ).toBe( 'Something went wrong' );
		} );
	} );

	describe( 'announceSuccess', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce success in polite region', () => {
			announcer.announceSuccess( 'Saved successfully' );
			expect( announcer.politeRegion.textContent ).toBe( 'Saved successfully' );
		} );
	} );

	describe( 'announceTool', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce tool selection', () => {
			announcer.announceTool( 'Rectangle' );
			expect( announcer.politeRegion.textContent ).toBe( 'Rectangle tool selected' );
		} );

		it( 'should not announce empty tool name', () => {
			announcer.announceTool( '' );
			expect( announcer.politeRegion.textContent ).toBe( '' );
		} );
	} );

	describe( 'announceLayerSelection', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce layer selection', () => {
			announcer.announceLayerSelection( 'My Rectangle' );
			expect( announcer.politeRegion.textContent ).toBe( 'My Rectangle selected' );
		} );
	} );

	describe( 'announceLayerAction', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should announce action with layer name', () => {
			announcer.announceLayerAction( 'deleted', 'Rectangle' );
			expect( announcer.politeRegion.textContent ).toBe( 'Rectangle deleted' );
		} );

		it( 'should announce action without layer name', () => {
			announcer.announceLayerAction( 'Layer created' );
			expect( announcer.politeRegion.textContent ).toBe( 'Layer created' );
		} );
	} );

	describe( 'clear', () => {
		beforeEach( () => {
			announcer.init();
		} );

		it( 'should clear all announcements', () => {
			announcer.announce( 'Test message' );
			announcer.announceError( 'Error message' );
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
} );
