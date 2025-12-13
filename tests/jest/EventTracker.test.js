/**
 * Tests for EventTracker utility
 */

describe( 'EventTracker', () => {
	let EventTracker;
	let tracker;
	let mockElement;

	beforeEach( () => {
		// Set up mw mock
		global.mw = {
			log: jest.fn(),
		};
		global.mw.log.warn = jest.fn();

		// Reset modules
		jest.resetModules();
		
		// Load EventTracker
		EventTracker = require( '../../resources/ext.layers.editor/EventTracker.js' );
		
		// Create mock element
		mockElement = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn()
		};

		tracker = new EventTracker();
	} );

	afterEach( () => {
		if ( tracker && !tracker.destroyed ) {
			tracker.destroy();
		}
		delete global.mw;
	} );

	describe( 'constructor', () => {
		it( 'should create with default options', () => {
			expect( tracker.listeners ).toEqual( [] );
			expect( tracker.destroyed ).toBe( false );
			expect( tracker.debug ).toBe( false );
		} );

		it( 'should accept debug option', () => {
			const debugTracker = new EventTracker( { debug: true } );
			expect( debugTracker.debug ).toBe( true );
			debugTracker.destroy();
		} );
	} );

	describe( 'add', () => {
		it( 'should add event listener and track it', () => {
			const handler = jest.fn();
			
			const entry = tracker.add( mockElement, 'click', handler );

			expect( mockElement.addEventListener ).toHaveBeenCalledWith( 'click', handler, undefined );
			expect( tracker.listeners.length ).toBe( 1 );
			expect( entry ).toEqual( {
				element: mockElement,
				type: 'click',
				handler: handler,
				options: undefined
			} );
		} );

		it( 'should support event options', () => {
			const handler = jest.fn();
			const options = { passive: true, capture: true };
			
			tracker.add( mockElement, 'scroll', handler, options );

			expect( mockElement.addEventListener ).toHaveBeenCalledWith( 'scroll', handler, options );
		} );

		it( 'should return null for invalid element', () => {
			const debugTracker = new EventTracker( { debug: true } );
			const handler = jest.fn();
			
			const entry = debugTracker.add( null, 'click', handler );

			expect( entry ).toBeNull();
			expect( mw.log.warn ).toHaveBeenCalled();
			debugTracker.destroy();
		} );

		it( 'should return null for invalid handler', () => {
			const debugTracker = new EventTracker( { debug: true } );
			
			const entry = debugTracker.add( mockElement, 'click', 'not a function' );

			expect( entry ).toBeNull();
			expect( mw.log.warn ).toHaveBeenCalled();
			debugTracker.destroy();
		} );

		it( 'should return null after destroy', () => {
			const handler = jest.fn();
			tracker.destroy();
			
			const entry = tracker.add( mockElement, 'click', handler );

			expect( entry ).toBeNull();
		} );
	} );

	describe( 'remove', () => {
		it( 'should remove specific listener', () => {
			const handler = jest.fn();
			const entry = tracker.add( mockElement, 'click', handler );
			
			const result = tracker.remove( entry );

			expect( result ).toBe( true );
			expect( mockElement.removeEventListener ).toHaveBeenCalledWith( 'click', handler, undefined );
			expect( tracker.listeners.length ).toBe( 0 );
		} );

		it( 'should return false for null entry', () => {
			const result = tracker.remove( null );
			expect( result ).toBe( false );
		} );

		it( 'should return false for unknown entry', () => {
			const unknownEntry = { element: mockElement, type: 'click', handler: jest.fn() };
			
			const result = tracker.remove( unknownEntry );

			expect( result ).toBe( false );
		} );
	} );

	describe( 'removeAllForElement', () => {
		it( 'should remove all listeners for specific element', () => {
			const handler1 = jest.fn();
			const handler2 = jest.fn();
			const otherElement = {
				addEventListener: jest.fn(),
				removeEventListener: jest.fn()
			};
			
			tracker.add( mockElement, 'click', handler1 );
			tracker.add( mockElement, 'mousedown', handler2 );
			tracker.add( otherElement, 'click', jest.fn() );
			
			const count = tracker.removeAllForElement( mockElement );

			expect( count ).toBe( 2 );
			expect( tracker.listeners.length ).toBe( 1 );
		} );
	} );

	describe( 'removeAllOfType', () => {
		it( 'should remove all listeners of specific type', () => {
			const handler1 = jest.fn();
			const handler2 = jest.fn();
			
			tracker.add( mockElement, 'click', handler1 );
			tracker.add( mockElement, 'click', handler2 );
			tracker.add( mockElement, 'mousedown', jest.fn() );
			
			const count = tracker.removeAllOfType( 'click' );

			expect( count ).toBe( 2 );
			expect( tracker.listeners.length ).toBe( 1 );
		} );
	} );

	describe( 'count', () => {
		it( 'should return number of tracked listeners', () => {
			expect( tracker.count() ).toBe( 0 );
			
			tracker.add( mockElement, 'click', jest.fn() );
			expect( tracker.count() ).toBe( 1 );
			
			tracker.add( mockElement, 'mousedown', jest.fn() );
			expect( tracker.count() ).toBe( 2 );
		} );
	} );

	describe( 'hasListeners', () => {
		it( 'should return false when no listeners', () => {
			expect( tracker.hasListeners() ).toBe( false );
		} );

		it( 'should return true when has listeners', () => {
			tracker.add( mockElement, 'click', jest.fn() );
			expect( tracker.hasListeners() ).toBe( true );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should remove all listeners', () => {
			const handler1 = jest.fn();
			const handler2 = jest.fn();
			
			tracker.add( mockElement, 'click', handler1 );
			tracker.add( mockElement, 'mousedown', handler2 );
			
			tracker.destroy();

			expect( mockElement.removeEventListener ).toHaveBeenCalledTimes( 2 );
			expect( tracker.listeners ).toEqual( [] );
			expect( tracker.destroyed ).toBe( true );
		} );

		it( 'should be idempotent', () => {
			tracker.add( mockElement, 'click', jest.fn() );
			
			tracker.destroy();
			tracker.destroy();

			expect( mockElement.removeEventListener ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should handle errors during cleanup', () => {
			const debugTracker = new EventTracker( { debug: true } );
			const failingElement = {
				addEventListener: jest.fn(),
				removeEventListener: jest.fn( () => {
					throw new Error( 'Test error' );
				} )
			};
			
			debugTracker.add( failingElement, 'click', jest.fn() );
			
			// Should not throw
			expect( () => debugTracker.destroy() ).not.toThrow();
		} );
	} );

	describe( 'exports', () => {
		it( 'should export to window.Layers namespace', () => {
			expect( window.Layers.Utils.EventTracker ).toBe( EventTracker );
		} );

		it( 'should be available as CommonJS module', () => {
			// The module is loaded via require, so it should be available
			expect( typeof EventTracker ).toBe( 'function' );
			expect( EventTracker.name ).toBe( 'EventTracker' );
		} );
	} );
} );
