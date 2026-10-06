'use strict';
const GradientEditor = require( '../../resources/ext.layers.editor/ui/GradientEditor.js' );

describe( 'Discrete gradient fill choices and parent refresh', () => {
    let editors;
    beforeEach( () => { jest.useFakeTimers(); editors = []; } );
    afterEach( () => { editors.forEach( editor => editor.destroy() ); jest.useRealTimers(); } );
    test.each( [ 'linear', 'radial' ] )( '%s reaches the model before a parent reads it for reconstruction', type => {
        let layer = { id: 'arrow', type: 'arrow', fill: '#ff0000' };
        const calls = [];
        let reconstructed;
        const container = document.createElement( 'div' );
        const editor = new GradientEditor( { layer, container,
            onChange: updates => { calls.push( 'change' ); layer = { ...layer, ...updates }; },
            onFillTypeChange: () => {
                calls.push( 'refresh' );
                reconstructed = new GradientEditor( { layer, container: document.createElement( 'div' ), onChange: () => {} } );
                editors.push( reconstructed );
            }
        } );
        editors.push( editor );
        const select = container.querySelector( '.gradient-type-select' );
        select.value = type; select.dispatchEvent( new Event( 'change' ) );
        expect( calls ).toEqual( [ 'change', 'refresh' ] );
        expect( reconstructed.fillType ).toBe( type );
        expect( reconstructed.container.querySelector( '.gradient-type-select' ).value ).toBe( type );
    } );
    test( 'solid selection cancels a pending stop/angle notification and publishes once', () => {
        const onChange = jest.fn();
        const container = document.createElement( 'div' );
        const editor = new GradientEditor( { layer: { fill: '#ff0000', gradient: { type: 'linear', angle: 90,
            colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#000000' } ] } }, container, onChange } );
        editors.push( editor );
        const angle = container.querySelector( '.gradient-angle-slider' );
        angle.value = '20'; angle.dispatchEvent( new Event( 'input' ) );
        const select = container.querySelector( '.gradient-type-select' );
        select.value = 'solid'; select.dispatchEvent( new Event( 'change' ) );
        expect( onChange ).toHaveBeenCalledTimes( 1 );
        expect( onChange ).toHaveBeenCalledWith( { gradient: null } );
        jest.advanceTimersByTime( 1000 );
        expect( onChange ).toHaveBeenCalledTimes( 1 );
    } );
    test( 'slider input still coalesces for 150ms and preserves its latest angle', () => {
        const onChange = jest.fn();
        const container = document.createElement( 'div' );
        const editor = new GradientEditor( { layer: { fill: '#ff0000', gradient: { type: 'linear', angle: 90,
            colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#000000' } ] } }, container, onChange } );
        editors.push( editor );
        const angle = container.querySelector( '.gradient-angle-slider' );
        for ( const value of [ 10, 14, 18 ] ) {
            angle.value = String( value ); angle.dispatchEvent( new Event( 'input' ) );
        }
        jest.advanceTimersByTime( 149 );
        expect( onChange ).not.toHaveBeenCalled();
        jest.advanceTimersByTime( 1 );
        expect( onChange ).toHaveBeenCalledTimes( 1 );
        expect( onChange ).toHaveBeenCalledWith( expect.objectContaining( {
            gradient: expect.objectContaining( { angle: 18 } )
        } ) );
    } );
} );

describe( 'Gradient fill reaches the arrow canvas', () => {
    const ArrowGeometry = require( '../../resources/ext.layers.shared/ArrowGeometry.js' );
    window.Layers = window.Layers || {};
    window.Layers.ArrowGeometry = ArrowGeometry;
    const ArrowRenderer = require( '../../resources/ext.layers.shared/ArrowRenderer.js' );
    const GradientRenderer = require( '../../resources/ext.layers.shared/GradientRenderer.js' );
    let ctx;
    let renderer;
    let canvasGradient;

    beforeEach( () => {
        canvasGradient = { addColorStop: jest.fn() };
        ctx = { globalAlpha: 1, fillStyle: '', lineWidth: 1 };
        for ( const method of [ 'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo',
            'quadraticCurveTo', 'fill', 'stroke', 'translate', 'rotate' ] ) {
            ctx[ method ] = jest.fn();
        }
        ctx.createLinearGradient = jest.fn( () => canvasGradient );
        ctx.createRadialGradient = jest.fn( () => canvasGradient );
        renderer = new ArrowRenderer( ctx, { gradientRenderer: new GradientRenderer( ctx ) } );
    } );
    afterEach( () => renderer.destroy() );

    test.each( [ [ 'linear', false ], [ 'radial', false ], [ 'linear', true ], [ 'radial', true ] ] )(
        '%s paints the filled path when curved=%s', ( type, curved ) => {
            const layer = { x1: 40, y1: 120, x2: 360, y2: 120, arrowSize: 40,
                fill: '#ff0000', stroke: 'none', gradient: { type, angle: 0,
                    colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#000000' } ] } };
            if ( curved ) {
                layer.controlX = 200; layer.controlY = 20;
            }
            ctx.fill.mockImplementation( () => expect( ctx.fillStyle ).toBe( canvasGradient ) );
            renderer.draw( layer );
            expect( ctx.fill ).toHaveBeenCalledTimes( 1 );
            expect( type === 'linear' ? ctx.createLinearGradient : ctx.createRadialGradient ).toHaveBeenCalledTimes( 1 );
            expect( canvasGradient.addColorStop.mock.calls ).toEqual( [ [ 0, '#ff0000' ], [ 1, '#000000' ] ] );
        }
    );

    test( 'already scaled canvas coordinates center the gradient without another scale', () => {
        renderer.draw( { x1: 80, y1: 240, x2: 720, y2: 240, arrowSize: 80,
            fill: '#ff0000', stroke: 'none', gradient: { type: 'linear', angle: 0,
                colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#000000' } ] } },
        { scaled: true, scale: { sx: 2, sy: 2, avg: 2 } } );
        const [ x0, y0, x1, y1 ] = ctx.createLinearGradient.mock.calls[ 0 ];
        expect( ( x0 + x1 ) / 2 ).toBeCloseTo( 400 );
        expect( y0 ).toBeCloseTo( 240 );
        expect( y1 ).toBeCloseTo( 240 );
    } );

    test( 'quadratic bounds use the actual peak and include head vertices', () => {
        const bounds = renderer._gradientBounds( path => {
            path.beginPath(); path.moveTo( 0, 0 );
            path.quadraticCurveTo( 50, 100, 100, 0 );
            path.lineTo( 120, -30 ); path.lineTo( -20, -10 ); path.closePath();
        } );
        expect( bounds ).toEqual( { x: -20, y: -30, width: 140, height: 80 } );
    } );
} );
