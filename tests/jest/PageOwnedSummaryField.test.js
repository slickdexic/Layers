'use strict';
const SummaryField = require( '../../resources/ext.layers.editor/PageOwnedSummaryField.js' );

describe( 'PageOwnedSummaryField', () => {
	let header, right, field;
	beforeEach( () => {
		header = document.createElement( 'div' );
		right = document.createElement( 'div' );
		header.appendChild( right );
		field = new SummaryField( ( key ) => key );
	} );

	it( 'requires a message function and a mount target', () => {
		expect( () => new SummaryField() ).toThrow( 'layers-invalid-summary-field' );
		expect( () => field.mount( null ) ).toThrow( 'layers-invalid-mount-target' );
	} );

	it( 'mounts a labelled input before the header controls, limited to the history\'s 500 characters', () => {
		field.mount( header, right );
		const input = header.querySelector( 'input' );
		expect( header.lastChild ).toBe( right );
		expect( header.querySelector( 'label' ).htmlFor ).toBe( input.id );
		expect( header.querySelector( 'label' ).textContent ).toBe( 'layers-page-summary-label' );
		expect( input.placeholder ).toBe( 'layers-page-summary-placeholder' );
		expect( input.maxLength ).toBe( 500 );
		expect( () => field.mount( header, right ) ).toThrow( 'layers-invalid-mount-target' );
	} );

	it( 'returns the trimmed text, clears it, and returns empty once disposed', () => {
		expect( field.getValue() ).toBe( '' );
		field.mount( header, right );
		header.querySelector( 'input' ).value = '  Fixed the labels ';
		expect( field.getValue() ).toBe( 'Fixed the labels' );
		field.clear();
		expect( field.getValue() ).toBe( '' );
		field.dispose();
		field.dispose();
		expect( header.querySelector( 'input' ) ).toBeNull();
		expect( field.getValue() ).toBe( '' );
	} );
} );
