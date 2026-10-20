'use strict';
const { setup, copy } = require( './PageOwnedWholePdfImportPublication.test.js' );
const Plan = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportDraftPlan.js' );
const opened = [];
async function fixture( savedLabel ) {
	const value = await setup( { sparse: false } ); opened.push( value );
	const draft = value.application.captureDraftForStorage(), expected = value.binding.captureImportDraftForStorage();
	for ( const holder of [ draft.session, expected ] ) {
		const base = JSON.parse( holder.scope.savedJson );
		for ( const snapshot of [ base, holder.snapshot ] ) {
			for ( const member of snapshot.surfaces ) { if ( member.source.fileTitle === 'File:Example.pdf' ) { member.label = savedLabel; } }
		}
		holder.scope.savedJson = JSON.stringify( base ); holder.context.label = savedLabel;
	}
	return { ...value, draft, expected };
}
describe( 'Whole-PDF draft names admitted under native historical rules', () => {
	afterEach( () => { for ( const value of opened.splice( 0 ).reverse() ) { value.work.close(); } } );
	it.each( [ ' ABC ', 'Older  spacing', 'Older:name', 'x'.repeat( 256 ) ] )( 'retains unchanged saved name %j without normalization', async label => {
		const { draft, expected } = await fixture( label ), before = JSON.stringify( { draft, expected } );
		const result = Plan.prepare( draft, expected ); expect( result ).toEqual( draft );
		expect( result.session.snapshot.surfaces.find( member => member.id === 'anchor' ).label ).toBe( label );
		expect( result.session.scope.savedJson ).toBe( expected.scope.savedJson ); expect( JSON.stringify( { draft, expected } ) ).toBe( before );
	} );
	it.each( [ ' ABC ', 'Older:name' ] )( 'permits a canonical pending name while preserving historical base %j', async label => {
		const { draft, expected } = await fixture( label );
		for ( const member of draft.session.snapshot.surfaces ) { if ( member.source.fileTitle === 'File:Example.pdf' ) { member.label = 'Renamed 001'; } }
		const result = Plan.prepare( draft, expected ); expect( result.session.scope.savedJson ).toBe( expected.scope.savedJson );
		expect( result.session.snapshot.surfaces.filter( member => member.source.fileTitle === 'File:Example.pdf' ).every( member => member.label === 'Renamed 001' ) ).toBe( true );
	} );
	it.each( [ ' New ', 'New:name', 'New|name', '' ] )( 'continues to reject a different noncanonical label %j', async label => {
		const { draft, expected } = await fixture( ' ABC ' );
		for ( const member of draft.session.snapshot.surfaces ) { if ( member.source.fileTitle === 'File:Example.pdf' ) { member.label = label; } }
		expect( () => Plan.prepare( draft, expected ) ).toThrow( 'layers-working-copy-import-unavailable' );
	} );
	it( 'does not borrow another file group historical label to admit a changed target name', async () => {
		const { draft, expected } = await fixture( ' ABC ' );
		for ( const holder of [ draft.session, expected ] ) {
			const base = JSON.parse( holder.scope.savedJson ); base.surfaces.find( member => member.id === 'other-file' ).label = 'Other:old';
			holder.scope.savedJson = JSON.stringify( base ); holder.snapshot.surfaces.find( member => member.id === 'other-file' ).label = 'Other:old';
		}
		for ( const member of draft.session.snapshot.surfaces ) { if ( member.source.fileTitle === 'File:Example.pdf' ) { member.label = 'Other:old'; } }
		expect( () => Plan.prepare( draft, expected ) ).toThrow();
	} );
	it( 'refuses a forged saved scope even when its name matches the changed target', async () => {
		const { draft, expected } = await fixture( ' ABC ' ); const altered = copy( draft );
		const base = JSON.parse( altered.session.scope.savedJson ); base.surfaces.find( member => member.id === 'anchor' ).label = 'Forged:name';
		altered.session.scope.savedJson = JSON.stringify( base );
		expect( () => Plan.prepare( altered, expected ) ).toThrow();
	} );
} );
