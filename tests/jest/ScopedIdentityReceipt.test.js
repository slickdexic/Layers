/** @jest-environment jsdom */
'use strict';

const { scopedRestorePlan } = require( '../e2e/helpers/scoped-identity-receipt.js' );

function receiptFixture() {
	const baselines = [
		{ owner: 'Layers_browser_acceptance', pageId: 228, revision: 2789,
			main: 'Dedicated automated Layers history acceptance page.',
			snapshot: { schemaVersion: 1, surfaces: [ { id: 'presentation', kind: 'slide', label: 'Welcome Slide',
				canvas: { width: 800, height: 600 }, layers: [] } ] } },
		{ owner: 'Layers_browser_scoped_source', pageId: 272, revision: 2790,
			main: 'Dedicated automated Layers scoped source acceptance page.',
			snapshot: { schemaVersion: 1, surfaces: [] } }
	].map( ( item ) => ( { owner: item.owner, pageId: item.pageId, revision: item.revision, snapshot: item.snapshot,
		slots: {
			main: { content: item.main, contentmodel: 'wikitext', contentformat: 'text/x-wiki' },
			layers: { content: JSON.stringify( item.snapshot ), contentmodel: 'layers-document',
				contentformat: 'application/json' }
		} } ) );
	return { base: 'http://localhost:8080', baselines, steps: baselines.map( ( baseline, index ) => ( {
		owner: baseline.owner, revision: 2792 + index, parent: baseline.revision,
		main: baseline.slots.main.content + '\nTest changes.', snapshot: baseline.snapshot
	} ) ) };
}

describe( 'Scoped acceptance cleanup receipts', () => {
	test( 'accepts both dedicated owners and selects each last continuous acknowledgement', () => {
		const receipt = receiptFixture();
		receipt.steps.push( { ...receipt.steps[ 0 ], revision: 2799, parent: 2792 } );
		const original = JSON.stringify( receipt );
		const plan = scopedRestorePlan( receipt );
		expect( plan.map( ( item ) => [ item.baseline.pageId, item.acknowledged.revision ] ) )
			.toEqual( [ [ 228, 2799 ], [ 272, 2793 ] ] );
		expect( JSON.stringify( receipt ) ).toBe( original );
	} );

	test( 'allows an older receipt without base and does not adopt refused revisions', () => {
		const receipt = receiptFixture();
		delete receipt.base;
		receipt.steps.push( { owner: receipt.baselines[ 0 ].owner, refused: { code: 'layers-edit-conflict' } } );
		expect( scopedRestorePlan( receipt )[ 0 ].acknowledged.revision ).toBe( 2792 );
	} );

	test.each( [
		[ 'ordinary owner', ( r ) => { r.baselines[ 1 ].owner = 'Ordinary_page'; } ],
		[ 'read-only isolation witness', ( r ) => {
			r.baselines[ 1 ].owner = 'Layers_browser_acceptance_isolation'; r.baselines[ 1 ].pageId = 230;
		} ],
		[ 'known title at another PageID', ( r ) => { r.baselines[ 1 ].pageId = 230; } ],
		[ 'duplicate owner', ( r ) => { r.baselines[ 1 ] = r.baselines[ 0 ]; } ],
		[ 'another wiki', ( r ) => { r.base = 'https://example.org'; } ],
		[ 'a page URL instead of the exact approved origin', ( r ) => { r.base += '/index.php'; } ],
		[ 'missing Layers slot', ( r ) => { delete r.baselines[ 1 ].slots.layers; } ],
		[ 'an extra slot', ( r ) => { r.baselines[ 1 ].slots.extra = r.baselines[ 1 ].slots.main; } ],
		[ 'missing serialized bytes', ( r ) => { delete r.baselines[ 1 ].slots.layers.content; } ],
		[ 'wrong model', ( r ) => { r.baselines[ 1 ].slots.layers.contentmodel = 'json'; } ],
		[ 'wrong format', ( r ) => { r.baselines[ 1 ].slots.layers.contentformat = 'text/plain'; } ],
		[ 'nonbaseline main', ( r ) => { r.baselines[ 1 ].slots.main.content += '\nSomebody is working.'; } ],
		[ 'absent snapshot', ( r ) => { delete r.baselines[ 1 ].snapshot; } ],
		[ 'unsupported schema', ( r ) => { r.baselines[ 1 ].snapshot.schemaVersion = 2; } ],
		[ 'snapshot disagreement', ( r ) => { r.baselines[ 1 ].slots.layers.content = '{"schemaVersion":1,"surfaces":[{}]}'; } ],
		[ 'nonempty source baseline', ( r ) => {
			r.baselines[ 1 ].snapshot.surfaces.push( { id: 'unexpected', kind: 'slide', label: 'ABC' } );
			r.baselines[ 1 ].slots.layers.content = JSON.stringify( r.baselines[ 1 ].snapshot );
		} ],
		[ 'missing owner acknowledgement', ( r ) => { r.steps.pop(); } ],
		[ 'acknowledgement from an unrelated owner', ( r ) => { r.steps[ 1 ].owner = 'Ordinary_page'; } ],
		[ 'zero acknowledged revision', ( r ) => { r.steps[ 1 ].revision = 0; } ],
		[ 'string acknowledged revision', ( r ) => { r.steps[ 1 ].revision = '2793'; } ],
		[ 'noninteger acknowledged revision', ( r ) => { r.steps[ 1 ].revision = 2793.5; } ],
		[ 'a stale or reordered acknowledgement', ( r ) => { r.steps[ 1 ].revision = 2788; } ],
		[ 'another parent', ( r ) => { r.steps[ 1 ].parent = 2789; } ],
		[ 'missing acknowledged content', ( r ) => { delete r.steps[ 1 ].snapshot; } ]
	] )( 'rejects %s before any owner can be restored', ( _name, corrupt ) => {
		const receipt = receiptFixture();
		corrupt( receipt );
		const write = jest.fn();
		expect( () => {
			const plan = scopedRestorePlan( receipt );
			for ( const item of plan ) {
				write( item );
			}
		} ).toThrow();
		expect( write ).not.toHaveBeenCalled();
	} );
} );
