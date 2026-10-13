'use strict';
const { creationContext, clone, choose } = require( './fixtures/creationImportContext.js' );
const { rebaseContext } = require( './fixtures/creationRebaseContext.js' );

function ownEnvelope( c ) {
	const identity = c.session.getDraft();
	return Array.from( c.records.values() ).map( JSON.parse ).find( value => value.scope.surfaceId === identity.surfaceId &&
		value.scope.baseRevisionId === identity.baseRevisionId );
}

describe( 'creation Import draft admission retention', () => {
	test.each( [ [ 'image', false ], [ 'image', true ], [ 'slide', false ], [ 'slide', true ] ] )(
		'%s / slot %s retains the native empty member separately from imported work', async ( kind, slot ) => {
			const c = await creationContext( kind, slot );
			try {
				await choose( c ); c.controller.persist();
				const envelope = ownEnvelope( c );
				expect( envelope.version ).toBe( 1 );
				expect( envelope.creationOrigin ).toStrictEqual( { version: 1, origin: { pageId: 7, owner: 'Target Page',
					revisionId: 12, surfaceId: 'target', selection: clone( c.selection ) }, newSurface: clone( c.added ), hasLayersSlot: slot } );
				expect( envelope.creationOrigin.newSurface.layers ).toHaveLength( 0 );
				expect( envelope.workingCopyDraft.workingState.layers ).toHaveLength( 3 );
				expect( envelope.workingCopyDraft.workingState.importProvenance ).toHaveLength( 1 );
				if ( kind === 'image' ) {
					expect( envelope.creationOrigin.newSurface.source.sha1 ).toBe( 'pin' );
					expect( envelope.creationOrigin.newSurface.source.sha1 ).not.toBe( c.bundle.snapshot.surfaces[ 0 ].source.sha1 );
				}
				const origin = c.session.captureCreationImportOrigin(); origin.newSurface.canvas.width = 999;
				origin.origin.selection.expected = 'Changed copy';
				expect( c.session.captureCreationImportOrigin() ).toStrictEqual( envelope.creationOrigin );
				expect( c.api.postWithToken ).not.toHaveBeenCalled();
			} finally { c.dispose(); }
		} );
	test.each( [ 'ready', 'saving', 'conflict', 'uncertain' ] )( '%s backup retains provenance even when local edits are invalid for Save', async phase => {
		const c = await creationContext( 'image', true );
		try {
			await choose( c ); c.session._phase = phase;
			c.store.set( 'layers', c.editor.layers.concat( { id: 'bad', type: 'unknown', retained: null } ) );
			c.controller.persist(); const envelope = ownEnvelope( c );
			expect( envelope.phase ).toBe( phase ); expect( envelope.creationOrigin.newSurface.layers ).toEqual( [] );
			expect( envelope.editorState.layers.at( -1 ).retained ).toBeNull();
			expect( envelope.workingCopyDraft.workingState.layers.at( -1 ).type ).toBe( 'unknown' );
		} finally { c.dispose(); }
	} );
	test( 'successful creation reconciliation retains each draft’s own native admission', async () => {
		const c = await rebaseContext( 'image', true );
		try {
			await choose( c ); c.controller.persist(); const old = clone( Array.from( c.records.entries() ) );
			await c.drafts.reconcile( async () => 20 ); const envelope = ownEnvelope( c );
			expect( envelope.creationOrigin.origin ).toMatchObject( { revisionId: 20, surfaceId: 'current', selection: c.currentSelection } );
			expect( envelope.creationOrigin.newSurface ).toStrictEqual( c.creation.newSurface );
			expect( envelope.workingCopyDraft.workingState.importProvenance[ 0 ].targetSurfaceId ).toBe( 'current' );
			old.forEach( ( [ key, value ] ) => expect( c.records.get( key ) ).toBe( value ) );
		} finally { c.dispose(); }
	} );
	test( 'existing exact-base recovery works with and without the optional origin hints', async () => {
		const c = await creationContext( 'slide', true );
		try {
			await choose( c ); c.controller.persist(); const envelope = ownEnvelope( c );
			const current = c.controller.inspectRecovery();
			delete envelope.creationOrigin; c.controller.store.write( envelope.scope, JSON.stringify( envelope ) );
			expect( c.controller.inspectRecovery() ).toStrictEqual( current );
			expect( current.editorState.layers ).toHaveLength( 3 ); expect( current.workingCopyDraft.timeline.history ).toHaveLength( 2 );
		} finally { c.dispose(); }
	} );
	test( 'confirmed first Save stops recording pending admission while retaining the prior backup’s origin', async () => {
		const c = await creationContext( 'image', true );
		try {
			await choose( c ); c.controller.persist(); const old = clone( Array.from( c.records.entries() ) );
			await c.drafts.save(); c.controller.persist(); const envelope = ownEnvelope( c );
			expect( envelope.scope.baseRevisionId ).toBe( 13 ); expect( envelope ).not.toHaveProperty( 'creationOrigin' );
			await expect( Promise.resolve().then( () => c.session.captureCreationImportOrigin() ) ).rejects.toThrow();
			old.forEach( ( [ key, value ] ) => {
				const retained = JSON.parse( c.records.get( key ) ), previous = JSON.parse( value );
				// Existing Save flushes the same writer's backup in its saving phase.
				expect( retained.phase ).toBe( 'saving' ); previous.phase = 'saving';
				expect( retained ).toStrictEqual( previous );
			} );
		} finally { c.dispose(); }
	} );
} );
