/* eslint-env node */
'use strict';

const assert = require( 'assert' );

const OWNERS = {
	Layers_browser_acceptance: { pageId: 228, main: 'Dedicated automated Layers history acceptance page.' },
	Layers_browser_scoped_source: { pageId: 272, main: 'Dedicated automated Layers scoped source acceptance page.' }
};

function positiveId( value ) {
	return Number.isSafeInteger( value ) && value > 0;
}

function snapshotShape( snapshot ) {
	assert( snapshot && snapshot.schemaVersion === 1 && Array.isArray( snapshot.surfaces ),
		'A complete schema-version-1 snapshot is required' );
}

/**
 * Validate the entire saved receipt before any cleanup request can be sent.
 * The caller must additionally verify historical baseline bytes and current CAS bases.
 *
 * @param {Object} receipt Parsed receipt, never a source of additional authorized owners
 * @return {Array} Validated baseline/last-acknowledgement pairs
 */
function scopedRestorePlan( receipt ) {
	assert( receipt && typeof receipt === 'object', 'A receipt object is required' );
	if ( Object.prototype.hasOwnProperty.call( receipt, 'base' ) ) {
		assert.strictEqual( receipt.base, 'http://localhost:8080', 'Receipt belongs to another wiki' );
	}
	assert( Array.isArray( receipt.baselines ) && receipt.baselines.length > 0 && receipt.baselines.length <= 2,
		'Only the dedicated owners may be restored' );
	assert( Array.isArray( receipt.steps ), 'Acknowledgement history is required' );
	const plans = new Map();
	for ( const baseline of receipt.baselines ) {
		assert( baseline && Object.prototype.hasOwnProperty.call( OWNERS, baseline.owner ),
			'Cleanup owner is not authorized' );
		const allowed = OWNERS[ baseline.owner ];
		assert.strictEqual( baseline.pageId, allowed.pageId, 'Cleanup PageID is not authorized' );
		assert( !plans.has( baseline.owner ), 'Duplicate cleanup owner' );
		assert( positiveId( baseline.revision ), 'Baseline revision must be a positive integer' );
		assert( baseline.slots && typeof baseline.slots === 'object', 'Complete baseline slots are required' );
		assert.deepStrictEqual( Object.keys( baseline.slots ).sort(), [ 'layers', 'main' ],
			'Only a captured main/layers baseline can be restored' );
		for ( const [ role, model, format ] of [ [ 'main', 'wikitext', 'text/x-wiki' ],
			[ 'layers', 'layers-document', 'application/json' ] ] ) {
			const slot = baseline.slots[ role ];
			assert( slot && typeof slot.content === 'string', 'Serialized baseline content is required' );
			assert.strictEqual( slot.contentmodel, model, 'Unexpected baseline content model' );
			assert.strictEqual( slot.contentformat, format, 'Unexpected baseline content format' );
		}
		assert.strictEqual( baseline.slots.main.content, allowed.main, 'Not the provisioned owner baseline' );
		snapshotShape( baseline.snapshot );
		assert.deepStrictEqual( JSON.parse( baseline.slots.layers.content ), baseline.snapshot,
			'Baseline serialized content and snapshot disagree' );
		if ( baseline.owner === 'Layers_browser_scoped_source' ) {
			assert.deepStrictEqual( baseline.snapshot, { schemaVersion: 1, surfaces: [] },
				'Source baseline must be the captured empty Layers slot' );
		} else {
			assert.deepStrictEqual( baseline.snapshot.surfaces.map( ( surface ) =>
				[ surface.id, surface.kind, surface.label ] ), [ [ 'presentation', 'slide', 'Welcome Slide' ] ],
			'Unexpected destination baseline surface' );
		}
		plans.set( baseline.owner, { baseline, acknowledged: null } );
	}
	for ( const step of receipt.steps ) {
		assert( step && plans.has( step.owner ), 'Acknowledgement belongs to an unauthorized owner' );
		if ( !Object.prototype.hasOwnProperty.call( step, 'revision' ) ) {
			assert( step.refused, 'Unacknowledged steps must record a refusal' );
			continue;
		}
		const plan = plans.get( step.owner );
		const previous = plan.acknowledged ? plan.acknowledged.revision : plan.baseline.revision;
		assert( positiveId( step.revision ) && step.revision > previous, 'Invalid acknowledged revision' );
		assert.strictEqual( step.parent, previous, 'Acknowledged owner history is not continuous' );
		assert( typeof step.main === 'string', 'Acknowledged main content is required' );
		snapshotShape( step.snapshot );
		plan.acknowledged = step;
	}
	for ( const plan of plans.values() ) {
		assert( plan.acknowledged, 'Every cleanup owner requires its own acknowledged revision' );
	}
	return Array.from( plans.values() );
}

module.exports = { scopedRestorePlan };
