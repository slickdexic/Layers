'use strict';
const HistoryManager = require( '../../resources/ext.layers.editor/HistoryManager.js' );
describe( 'Complete PDF in-memory timelines', () => {
	it( 'copies steps, metadata, index and saved marker without sharing mutable references', () => {
		const manager = new HistoryManager();
		const input = { history: [ { layers: [], description: 'Initial', timestamp: 1, extra: { value: null } },
			{ layers: [ { id: 'edit', x: -17, gradient: { angle: 999 } } ], timestamp: 2 } ],
			historyIndex: 0, lastSaveHistoryIndex: 1, maxHistorySteps: 50 };
		manager.restoreTimeline( input );
		const output = manager.captureTimeline();
		expect( output ).toStrictEqual( input );
		input.history[ 0 ].extra.value = 'caller';
		output.history[ 1 ].layers[ 0 ].x = 100;
		expect( manager.captureTimeline().history[ 0 ].extra.value ).toBeNull();
		expect( manager.captureTimeline().history[ 1 ].layers[ 0 ].x ).toBe( -17 );
		expect( manager.canRedo() ).toBe( true );
	} );
	it( 'refuses invalid restore and active batches without severing their alias or changing a timeline', () => {
		const manager = new HistoryManager(), before = manager.captureTimeline();
		expect( () => manager.restoreTimeline( { ...before, historyIndex: 1 } ) ).toThrow();
		expect( manager.captureTimeline() ).toStrictEqual( before );
		manager.batchMode = true;
		manager.batchChanges.push( { description: 'Pending' } );
		expect( () => manager.captureTimeline() ).toThrow();
		expect( manager.batchOperations ).toBe( manager.batchChanges );
		expect( manager.batchOperations ).toHaveLength( 1 );
	} );
} );