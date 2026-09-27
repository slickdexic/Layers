'use strict';
const DrawingFields = require( '../../resources/ext.layers.shared/DrawingFields.js' );

describe( 'DrawingFields', () => {
	const entry = ( ...parts ) => JSON.stringify( parts );
	let originalGet;
	beforeEach( () => {
		originalGet = mw.config.get;
		DrawingFields.reset();
	} );
	afterEach( () => {
		mw.config.get = originalGet;
		DrawingFields.reset();
	} );

	it( 'builds values from the page entries, leaving out conflicting and malformed ones', () => {
		expect( DrawingFields.fromConfig( {
			[ entry( 'presentation', 'pressure', '12 bar' ) ]: true,
			[ entry( 'presentation', 'status', 'OK' ) ]: true,
			[ entry( 'presentation', 'status', 'Stopped' ) ]: true,
			[ entry( 'File:Pump.png', 'a', '' ) ]: true,
			[ entry( 'bad', 5, 'x' ) ]: true,
			'not json': true
		} ) ).toEqual( { presentation: { pressure: '12 bar' }, 'File:Pump.png': { a: '' } } );
		expect( DrawingFields.fromConfig( null ) ).toEqual( {} );
	} );

	it( 'fills tokens in text and rich-text runs, keeping unknown names and the original layers', () => {
		const layers = [
			{ id: 'a', type: 'text', text: 'P {{ pressure }} {{unknown}}' },
			{ id: 'b', type: 'textbox', richText: [ { text: '{{status}}', style: { fontWeight: 'bold' } } ] },
			{ id: 'c', type: 'rectangle' }
		];
		const filled = DrawingFields.fillLayers( layers, { pressure: '12 bar', status: 'OK', unknown: 5 } );
		expect( filled[ 0 ].text ).toBe( 'P 12 bar {{unknown}}' );
		expect( filled[ 1 ].richText ).toEqual( [ { text: 'OK', style: { fontWeight: 'bold' } } ] );
		expect( filled[ 2 ] ).toEqual( layers[ 2 ] );
		expect( layers[ 0 ].text ).toBe( 'P {{ pressure }} {{unknown}}' );
		expect( DrawingFields.fillLayers( layers, undefined ) ).toBe( layers );
	} );

	it( 'reads the page values once and keys files and slides the way the server does', () => {
		mw.config.get = jest.fn( ( key ) => key === 'wgLayersDrawingFields' ?
			{ [ entry( 'File:Pump_diagram.png', 'pressure', '12 bar' ) ]: true,
				[ entry( 'Slide:Line_overview', 'status', 'OK' ) ]: true } : null );
		expect( DrawingFields.forDrawing( DrawingFields.fileKey( 'Pump diagram.png' ) ) ).toEqual( { pressure: '12 bar' } );
		expect( DrawingFields.forDrawing( DrawingFields.slideKey( ' Line_overview ' ) ) ).toEqual( { status: 'OK' } );
		expect( DrawingFields.forDrawing( 'presentation' ) ).toBeUndefined();
		expect( mw.config.get ).toHaveBeenCalledTimes( 1 );
	} );
} );
