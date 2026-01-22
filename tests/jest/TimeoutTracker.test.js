/**
 * Tests for TimeoutTracker utility
 *
 * @file
 */

'use strict';

const { TimeoutTracker } = require( '../../resources/ext.layers.shared/TimeoutTracker.js' );

describe( 'TimeoutTracker', () => {
	let tracker;

	beforeEach( () => {
		jest.useFakeTimers();
		tracker = new TimeoutTracker();
	} );

	afterEach( () => {
		tracker.destroy();
		jest.useRealTimers();
	} );

	describe( 'setTimeout', () => {
		it( 'should execute callback after delay', () => {
			const callback = jest.fn();
			tracker.setTimeout( 'test', callback, 1000 );

			expect( callback ).not.toHaveBeenCalled();

			jest.advanceTimersByTime( 1000 );

			expect( callback ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should return timeout ID', () => {
			const id = tracker.setTimeout( 'test', jest.fn(), 1000 );
			expect( typeof id ).toBe( 'number' );
		} );

		it( 'should clear previous timeout with same name', () => {
			const callback1 = jest.fn();
			const callback2 = jest.fn();

			tracker.setTimeout( 'test', callback1, 1000 );
			tracker.setTimeout( 'test', callback2, 1000 );

			jest.advanceTimersByTime( 1000 );

			expect( callback1 ).not.toHaveBeenCalled();
			expect( callback2 ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should not execute callback if destroyed', () => {
			const callback = jest.fn();
			tracker.setTimeout( 'test', callback, 1000 );

			tracker.destroy();
			jest.advanceTimersByTime( 1000 );

			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'should return null if destroyed', () => {
			tracker.destroy();
			const id = tracker.setTimeout( 'test', jest.fn(), 1000 );
			expect( id ).toBeNull();
		} );

		it( 'should remove timeout from map after execution', () => {
			tracker.setTimeout( 'test', jest.fn(), 1000 );
			expect( tracker.getTimeoutCount() ).toBe( 1 );

			jest.advanceTimersByTime( 1000 );

			expect( tracker.getTimeoutCount() ).toBe( 0 );
		} );
	} );

	describe( 'clearTimeout', () => {
		it( 'should prevent callback from executing', () => {
			const callback = jest.fn();
			tracker.setTimeout( 'test', callback, 1000 );

			tracker.clearTimeout( 'test' );
			jest.advanceTimersByTime( 1000 );

			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'should return true if timeout was cleared', () => {
			tracker.setTimeout( 'test', jest.fn(), 1000 );
			const result = tracker.clearTimeout( 'test' );
			expect( result ).toBe( true );
		} );

		it( 'should return false if no timeout with that name', () => {
			const result = tracker.clearTimeout( 'nonexistent' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'setDebounce', () => {
		it( 'should debounce multiple calls', () => {
			const callback = jest.fn();

			tracker.setDebounce( 'search', callback, 300 );
			jest.advanceTimersByTime( 100 );

			tracker.setDebounce( 'search', callback, 300 );
			jest.advanceTimersByTime( 100 );

			tracker.setDebounce( 'search', callback, 300 );
			jest.advanceTimersByTime( 300 );

			// Should only execute once (after the last call + 300ms)
			expect( callback ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should use default delay of 300ms', () => {
			const callback = jest.fn();
			tracker.setDebounce( 'test', callback );

			jest.advanceTimersByTime( 299 );
			expect( callback ).not.toHaveBeenCalled();

			jest.advanceTimersByTime( 1 );
			expect( callback ).toHaveBeenCalledTimes( 1 );
		} );
	} );

	describe( 'setInterval', () => {
		it( 'should execute callback repeatedly', () => {
			const callback = jest.fn();
			tracker.setInterval( 'tick', callback, 100 );

			jest.advanceTimersByTime( 350 );

			expect( callback ).toHaveBeenCalledTimes( 3 );
		} );

		it( 'should return interval ID', () => {
			const id = tracker.setInterval( 'tick', jest.fn(), 100 );
			expect( typeof id ).toBe( 'number' );
		} );

		it( 'should clear previous interval with same name', () => {
			const callback1 = jest.fn();
			const callback2 = jest.fn();

			tracker.setInterval( 'tick', callback1, 100 );
			tracker.setInterval( 'tick', callback2, 100 );

			jest.advanceTimersByTime( 250 );

			expect( callback1 ).not.toHaveBeenCalled();
			expect( callback2 ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'should not execute callback if destroyed', () => {
			const callback = jest.fn();
			tracker.setInterval( 'tick', callback, 100 );

			tracker.destroy();
			jest.advanceTimersByTime( 500 );

			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'should return null if destroyed', () => {
			tracker.destroy();
			const id = tracker.setInterval( 'tick', jest.fn(), 100 );
			expect( id ).toBeNull();
		} );
	} );

	describe( 'clearInterval', () => {
		it( 'should stop interval execution', () => {
			const callback = jest.fn();
			tracker.setInterval( 'tick', callback, 100 );

			jest.advanceTimersByTime( 250 );
			expect( callback ).toHaveBeenCalledTimes( 2 );

			tracker.clearInterval( 'tick' );
			jest.advanceTimersByTime( 500 );

			expect( callback ).toHaveBeenCalledTimes( 2 ); // No more calls
		} );

		it( 'should return true if interval was cleared', () => {
			tracker.setInterval( 'tick', jest.fn(), 100 );
			const result = tracker.clearInterval( 'tick' );
			expect( result ).toBe( true );
		} );

		it( 'should return false if no interval with that name', () => {
			const result = tracker.clearInterval( 'nonexistent' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'setOnce', () => {
		it( 'should execute only if not already pending', () => {
			const callback = jest.fn();

			const result1 = tracker.setOnce( 'init', callback, 1000 );
			const result2 = tracker.setOnce( 'init', callback, 1000 );

			expect( result1 ).toBe( true );
			expect( result2 ).toBe( false );

			jest.advanceTimersByTime( 1000 );

			expect( callback ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should allow setting again after completion', () => {
			const callback = jest.fn();

			tracker.setOnce( 'init', callback, 1000 );
			jest.advanceTimersByTime( 1000 );

			const result = tracker.setOnce( 'init', callback, 1000 );
			expect( result ).toBe( true );

			jest.advanceTimersByTime( 1000 );
			expect( callback ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'should return false if destroyed', () => {
			tracker.destroy();
			const result = tracker.setOnce( 'init', jest.fn(), 1000 );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'isPending', () => {
		it( 'should return true if timeout is pending', () => {
			tracker.setTimeout( 'test', jest.fn(), 1000 );
			expect( tracker.isPending( 'test' ) ).toBe( true );
		} );

		it( 'should return false if timeout completed', () => {
			tracker.setTimeout( 'test', jest.fn(), 1000 );
			jest.advanceTimersByTime( 1000 );
			expect( tracker.isPending( 'test' ) ).toBe( false );
		} );

		it( 'should return false if timeout was cleared', () => {
			tracker.setTimeout( 'test', jest.fn(), 1000 );
			tracker.clearTimeout( 'test' );
			expect( tracker.isPending( 'test' ) ).toBe( false );
		} );

		it( 'should return false for nonexistent timeout', () => {
			expect( tracker.isPending( 'nonexistent' ) ).toBe( false );
		} );
	} );

	describe( 'clearAllTimeouts', () => {
		it( 'should clear all pending timeouts', () => {
			const callbacks = [ jest.fn(), jest.fn(), jest.fn() ];

			tracker.setTimeout( 'a', callbacks[ 0 ], 1000 );
			tracker.setTimeout( 'b', callbacks[ 1 ], 2000 );
			tracker.setTimeout( 'c', callbacks[ 2 ], 3000 );

			tracker.clearAllTimeouts();
			jest.advanceTimersByTime( 5000 );

			callbacks.forEach( ( cb ) => expect( cb ).not.toHaveBeenCalled() );
			expect( tracker.getTimeoutCount() ).toBe( 0 );
		} );
	} );

	describe( 'clearAllIntervals', () => {
		it( 'should clear all active intervals', () => {
			const callbacks = [ jest.fn(), jest.fn() ];

			tracker.setInterval( 'a', callbacks[ 0 ], 100 );
			tracker.setInterval( 'b', callbacks[ 1 ], 200 );

			jest.advanceTimersByTime( 250 );

			tracker.clearAllIntervals();
			jest.advanceTimersByTime( 1000 );

			// Callbacks should have been called before clear
			expect( callbacks[ 0 ].mock.calls.length ).toBeGreaterThan( 0 );
			expect( callbacks[ 1 ].mock.calls.length ).toBeGreaterThan( 0 );

			// Count how many calls before clear
			const countA = callbacks[ 0 ].mock.calls.length;
			const countB = callbacks[ 1 ].mock.calls.length;

			jest.advanceTimersByTime( 1000 );

			// No more calls after clear
			expect( callbacks[ 0 ] ).toHaveBeenCalledTimes( countA );
			expect( callbacks[ 1 ] ).toHaveBeenCalledTimes( countB );

			expect( tracker.getIntervalCount() ).toBe( 0 );
		} );
	} );

	describe( 'getTimeoutCount / getIntervalCount', () => {
		it( 'should track timeout count correctly', () => {
			expect( tracker.getTimeoutCount() ).toBe( 0 );

			tracker.setTimeout( 'a', jest.fn(), 1000 );
			expect( tracker.getTimeoutCount() ).toBe( 1 );

			tracker.setTimeout( 'b', jest.fn(), 1000 );
			expect( tracker.getTimeoutCount() ).toBe( 2 );

			tracker.clearTimeout( 'a' );
			expect( tracker.getTimeoutCount() ).toBe( 1 );
		} );

		it( 'should track interval count correctly', () => {
			expect( tracker.getIntervalCount() ).toBe( 0 );

			tracker.setInterval( 'a', jest.fn(), 100 );
			expect( tracker.getIntervalCount() ).toBe( 1 );

			tracker.setInterval( 'b', jest.fn(), 100 );
			expect( tracker.getIntervalCount() ).toBe( 2 );

			tracker.clearInterval( 'a' );
			expect( tracker.getIntervalCount() ).toBe( 1 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clear all timeouts and intervals', () => {
			const timeoutCb = jest.fn();
			const intervalCb = jest.fn();

			tracker.setTimeout( 'timeout', timeoutCb, 1000 );
			tracker.setInterval( 'interval', intervalCb, 100 );

			tracker.destroy();

			jest.advanceTimersByTime( 5000 );

			expect( timeoutCb ).not.toHaveBeenCalled();
			expect( intervalCb ).not.toHaveBeenCalled();
		} );

		it( 'should set destroyed flag', () => {
			expect( tracker.destroyed ).toBe( false );
			tracker.destroy();
			expect( tracker.destroyed ).toBe( true );
		} );

		it( 'should be idempotent', () => {
			tracker.destroy();
			expect( () => tracker.destroy() ).not.toThrow();
		} );
	} );

	describe( 'multiple trackers', () => {
		it( 'should not interfere with each other', () => {
			const tracker2 = new TimeoutTracker();
			const callback1 = jest.fn();
			const callback2 = jest.fn();

			tracker.setTimeout( 'test', callback1, 1000 );
			tracker2.setTimeout( 'test', callback2, 1000 );

			tracker.destroy();
			jest.advanceTimersByTime( 1000 );

			expect( callback1 ).not.toHaveBeenCalled();
			expect( callback2 ).toHaveBeenCalledTimes( 1 );

			tracker2.destroy();
		} );
	} );
} );
