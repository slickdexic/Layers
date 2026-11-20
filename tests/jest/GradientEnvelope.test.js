'use strict';
const GradientRenderer = require( '../../resources/ext.layers.shared/GradientRenderer.js' );
const GradientEditor = require( '../../resources/ext.layers.editor/ui/GradientEditor.js' );

describe( 'approved gradient envelope and centre contract', () => {
	const colors = [ { offset: 1, color: '#0000ff' }, { offset: 0, color: '#ff0000' } ];
	let ctx, renderer;
	beforeEach( () => {
		ctx = { createLinearGradient: jest.fn( () => ( { addColorStop: jest.fn() } ) ),
			createRadialGradient: jest.fn( () => ( { addColorStop: jest.fn() } ) ) };
		renderer = new GradientRenderer( ctx );
	} );

	test.each( [ 0.5, 1, 1.5, 2 ] )( 'radius %s uses the full diagonal independently of its centre', radius => {
		for ( const [ centerX, centerY ] of [ [ 0, 0 ], [ 0.5, 0.5 ], [ 1, 1 ], [ 0.125, 0.75 ] ] ) {
			const gradient = { type: 'radial', radius, centerX, centerY, colors };
			renderer.createGradient( { gradient }, { x: 10, y: 20, width: 400, height: 300 } );
			expect( ctx.createRadialGradient ).toHaveBeenLastCalledWith( 10 + centerX * 400,
				20 + centerY * 300, 0, 10 + centerX * 400, 20 + centerY * 300, 500 * radius );
		}
	} );

	test( 'zero uses the outermost stop, preserves transparency and does not mutate stored stops', () => {
		const stops = [ { offset: 1, color: 'rgba(0,0,255,0.25)' }, ...colors,
			{ offset: 0.7, color: '#00ff00' }, { offset: 1, color: '#12345678' } ];
		const gradient = { type: 'radial', radius: 0, colors: stops }, before = JSON.stringify( gradient );
		const paint = renderer.createGradient( { gradient }, { x: 0, y: 0, width: 400, height: 40 } );
		expect( ctx.createRadialGradient ).not.toHaveBeenCalled();
		expect( paint.addColorStop.mock.calls ).toEqual( [ [ 0, '#12345678' ], [ 1, '#12345678' ] ] );
		expect( JSON.stringify( gradient ) ).toBe( before );
	} );

	test.each( [ 0, 45, 90, 135, 180, 270, 360 ] )( 'Text linear angle %s reaches its projected envelope ends', angle => {
		const gradient = { type: 'linear', angle, colors }, bounds = { x: 10, y: 20, width: 400, height: 40 };
		renderer.createGradient( { gradient }, bounds, { fitLinearToBounds: true } );
		const [ x0, y0, x1, y1 ] = ctx.createLinearGradient.mock.calls[ 0 ];
		const radians = angle * Math.PI / 180, dx = Math.cos( radians ), dy = Math.sin( radians );
		const projections = [ [ 10, 20 ], [ 410, 20 ], [ 10, 60 ], [ 410, 60 ] ].map( ( [ x, y ] ) => x * dx + y * dy );
		expect( x0 * dx + y0 * dy ).toBeCloseTo( Math.min( ...projections ) );
		expect( x1 * dx + y1 * dy ).toBeCloseTo( Math.max( ...projections ) );
	} );

	test( 'other linear layers retain their existing diagonal, while scaling also scales radial centres and radius', () => {
		renderer.createGradient( { gradient: { type: 'linear', angle: 90, colors } }, { x: 0, y: 0, width: 400, height: 40 } );
		const endpoints = ctx.createLinearGradient.mock.calls[ 0 ];
		expect( endpoints[ 3 ] - endpoints[ 1 ] ).toBeCloseTo( Math.hypot( 400, 40 ) );
		renderer.createGradient( { gradient: { type: 'radial', radius: 1, centerX: 1, centerY: 0, colors } },
			{ x: 10, y: 20, width: 400, height: 300 }, { scale: 2 } );
		expect( ctx.createRadialGradient ).toHaveBeenCalledWith( 820, 40, 0, 820, 40, 1000 );
	} );
} );

describe( 'radial percentage controls', () => {
	let editor, container, onChange;
	beforeEach( () => {
		jest.useFakeTimers(); container = document.createElement( 'div' ); onChange = jest.fn();
		editor = new GradientEditor( { container, onChange, layer: { gradient: { type: 'radial', radius: 0,
			centerX: 0, centerY: 1, colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ] } } } );
	} );
	afterEach( () => { editor.destroy(); jest.useRealTimers(); } );
	const input = ( node, value ) => { node.value = value; node.dispatchEvent( new Event( 'input' ) ); };

	test( 'zero and edge centres remain exact across control rebuilds and fractional numeric entry', () => {
		expect( container.querySelector( '.gradient-radius-number' ).value ).toBe( '0' );
		expect( container.querySelector( '.gradient-center-x-number' ).value ).toBe( '0' );
		expect( container.querySelector( '.gradient-center-y-number' ).value ).toBe( '100' );
		input( container.querySelector( '.gradient-center-x-number' ), '12.5' );
		input( container.querySelector( '.gradient-center-y-number' ), '73.25' );
		input( container.querySelector( '.gradient-radius-number' ), '200' );
		jest.advanceTimersByTime( 150 );
		expect( onChange ).toHaveBeenLastCalledWith( { gradient: expect.objectContaining( { radius: 2, centerX: 0.125, centerY: 0.7325 } ) } );
		input( container.querySelector( '.gradient-radius-slider' ), '0' ); editor._build();
		expect( container.querySelector( '.gradient-radius-number' ).value ).toBe( '0' );
		expect( container.querySelector( '.gradient-center-x-number' ).value ).toBe( '12.5' );
		jest.advanceTimersByTime( 150 ); expect( onChange.mock.calls.at( -1 )[ 0 ].gradient.radius ).toBe( 0 );
	} );

	test( 'empty numeric entry preserves the model and restores its display on leaving the field', () => {
		const number = container.querySelector( '.gradient-radius-number' );
		input( number, '' ); jest.advanceTimersByTime( 200 ); expect( onChange ).not.toHaveBeenCalled();
		number.dispatchEvent( new Event( 'change' ) ); expect( number.value ).toBe( '0' );
		input( number, '300' ); number.dispatchEvent( new Event( 'change' ) );
		expect( number.value ).toBe( '200' );
		jest.advanceTimersByTime( 150 ); expect( editor.currentGradient.radius ).toBe( 2 );
	} );
} );
