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

    test.each( [ 'transparent', 'none' ].flatMap( fill => [ 'linear', 'radial' ].flatMap( type =>
        [ 'single', 'double', 'none', 'curved-single', 'curved-double' ].map( style => [ fill, type, style ] ) ) ) )(
        '%s underlying fill preserves %s gradient on %s arrows', ( fill, type, style ) => {
            const layer = { x1: 40, y1: 120, x2: 360, y2: 120, arrowSize: 40, tailWidth: 24,
                fill, stroke: 'none', fillOpacity: 0.25, rotation: 45,
                arrowStyle: style.replace( 'curved-', '' ), gradient: { type, angle: 0,
                    centerX: 0, centerY: 0, radius: 0.7,
                    colors: [ { offset: 0, color: 'rgba(255, 0, 0, 0.5)' }, { offset: 1, color: '#0000ff' } ] } };
            if ( style.startsWith( 'curved-' ) ) { layer.controlX = 200; layer.controlY = 20; }
            const original = JSON.parse( JSON.stringify( layer ) );
            renderer.draw( layer );
            expect( ctx.fill ).toHaveBeenCalledTimes( 1 );
            expect( ctx.globalAlpha ).toBe( 0.25 );
            expect( ctx.fillStyle ).toBe( canvasGradient );
            expect( canvasGradient.addColorStop.mock.calls ).toEqual( [ [ 0, 'rgba(255, 0, 0, 0.5)' ], [ 1, '#0000ff' ] ] );
            expect( layer ).toEqual( original );
            ctx.fill.mockClear();
            renderer.draw( { ...layer, gradient: null } );
            expect( ctx.fill ).not.toHaveBeenCalled();
        }
    );

    test.each( [ null, { type: 'linear', colors: [ null, null ] },
        { type: 'linear', angle: NaN, colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ] },
        { type: 'linear', colors: [ { offset: -1, color: '#fff' }, { offset: 1, color: '#000' } ] },
        { type: 'linear', colors: [ { offset: 0, color: 'not-a-color' }, { offset: 1, color: '#000' } ] } ] )(
        'malformed gradient does not enable transparent arrow fill: %j', gradient => {
            renderer.draw( { x1: 40, y1: 120, x2: 360, y2: 120, fill: 'transparent', stroke: 'none', gradient } );
            expect( ctx.fill ).not.toHaveBeenCalled();
        }
    );

    test( 'zero opacity and an unsupported gradient painter keep transparent arrows unfilled', () => {
        const layer = { x1: 40, y1: 120, x2: 360, y2: 120, fill: 'transparent', stroke: 'none',
            gradient: { type: 'linear', colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ] } };
        renderer.draw( { ...layer, fillOpacity: 0 } );
        renderer.setGradientRenderer( null ); renderer.draw( layer );
        expect( ctx.fill ).not.toHaveBeenCalled();
    } );
} );

describe( 'Authoritative gradient settlement across real form, panel and editor boundaries', () => {
    const PropertyBuilders = require( '../../resources/ext.layers.editor/ui/PropertyBuilders.js' );
    const PropertiesForm = require( '../../resources/ext.layers.editor/ui/PropertiesForm.js' );
    const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
    require( '../../resources/ext.layers.editor/LayerPanel.js' );
    require( '../../resources/ext.layers.editor/LayersEditor.js' );
    const LayerPanel = window.Layers.UI.LayerPanel;
    const LayersEditor = window.Layers.Core.Editor;
    let editor, panel, capture;
    const input = ( node, value, event = 'input' ) => {
        node.value = String( value ); node.dispatchEvent( new Event( event, { bubbles: true } ) );
    };
    const controls = () => panel.propertiesPanel.querySelector( '.gradient-editor' );
    const model = () => editor.stateManager.get( 'layers' )[ 0 ];
    const select = type => input( controls().querySelector( '.gradient-type-select' ), type, 'change' );
    const edit = ( type = 'linear' ) => {
        select( type );
        input( controls().querySelector( '.gradient-stop-color' ), '#ff0000' );
        input( controls().querySelector( type === 'linear' ? '.gradient-angle-slider' : '.gradient-radius-slider' ), type === 'linear' ? 0 : 0.9 );
    };
    beforeEach( () => {
        jest.useFakeTimers();
        window.Layers.UI.GradientEditor = GradientEditor;
        window.Layers.UI.PropertyBuilders = PropertyBuilders;
        window.Layers.UI.PropertiesForm = PropertiesForm;
        window.layersMessages = { get: ( key, fallback ) => fallback || key };
        window.mw = { message: () => ( { exists: () => false } ), config: { get: () => false }, notify: jest.fn(), log: { error: jest.fn() } };
        editor = Object.create( LayersEditor.prototype );
        editor.config = { pageOwned: true };
        editor.validationManager = { sanitizeLayerData: value => value };
        editor.historyManager = { saveState: jest.fn() };
        editor.stateManager = new StateManager( editor );
        editor.markDirty = () => editor.stateManager.set( 'isDirty', true );
        editor.uiManager = { destroy: jest.fn(), showSpinner: jest.fn() };
        editor.apiManager = { saveLayers: jest.fn( () => {
            capture = JSON.parse( JSON.stringify( editor.stateManager.get( 'layers' ) ) );
            editor.stateManager.set( 'isDirty', false );
            return Promise.resolve( { dirty: false, editorStateValid: true, draftPersisted: true } );
        } ) };
        panel = Object.create( LayerPanel.prototype ); panel.editor = editor; panel.dialogCleanups = [];
        panel.msg = ( key, fallback ) => fallback || key;
        panel.propertiesPanel = document.createElement( 'div' );
        panel.propertiesPanel.innerHTML = '<div class="properties-content"></div>';
        document.body.appendChild( panel.propertiesPanel ); editor.layerPanel = panel;
        editor.stateManager.set( 'layers', [ { id: 'arrow', type: 'arrow', fill: 'transparent', stroke: '#000000', x1: 40, y1: 100, x2: 360, y2: 100 } ] );
        panel.updatePropertiesPanel( 'arrow' );
    } );
    afterEach( () => {
        panel.settleGradientControls( false, true ); panel.runDialogCleanups();
        editor.stateManager.destroy(); panel.propertiesPanel.remove(); jest.clearAllTimers(); jest.useRealTimers();
    } );

    test.each( [ 0, 45, undefined ] )( 'angle %s reconstructs without changing metadata', angle => {
        const gradient = { type: 'linear', colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ] };
        if ( angle !== undefined ) gradient.angle = angle;
        editor.updateLayer( 'arrow', { gradient } ); panel.updatePropertiesPanel( 'arrow' );
        expect( controls().querySelector( '.gradient-angle-slider' ).value ).toBe( String( angle === undefined ? 90 : angle ) );
        expect( model().gradient ).toEqual( gradient );
    } );

    test.each( [ 'linear', 'radial' ] )( '%s rapid stops and pending numeric edits survive reconstruction and immediate Save', async type => {
        edit( type );
        const stale = controls();
        jest.advanceTimersByTime( 0 );
        input( controls().querySelectorAll( '.gradient-stop-color' )[ 1 ], '#0000ff' );
        const complete = { ...controls()._gradientEditor.currentGradient };
        expect( await editor.saveCurrentPage() ).toBe( true );
        expect( capture[ 0 ].gradient ).toEqual( complete );
        expect( capture[ 0 ].gradient.colors.map( stop => stop.color ) ).toEqual( [ '#ff0000', '#0000ff' ] );
        expect( capture[ 0 ].gradient[ type === 'linear' ? 'angle' : 'radius' ] ).toBe( type === 'linear' ? 0 : 0.9 );
        expect( capture[ 0 ].fill ).toBe( 'transparent' );
        input( stale.querySelector( '.gradient-stop-color' ) || document.createElement( 'input' ), '#00ff00' );
        jest.advanceTimersByTime( 1000 ); expect( model().gradient ).toEqual( complete );
        expect( editor.historyManager.saveState ).toHaveBeenCalledTimes( 1 );
        for ( let repeat = 0; repeat < 3; repeat++ ) {
            panel.updatePropertiesPanel( 'arrow' );
            expect( controls()._gradientEditor.currentGradient ).toEqual( complete );
        }
    } );

    test( 'pending offset zero survives immediate Save along with the complete gradient', async () => {
        edit(); input( controls().querySelectorAll( '.gradient-stop-offset' )[ 1 ], 0 );
        const expected = controls()._gradientEditor._cloneGradient( controls()._gradientEditor.currentGradient );
        await editor.saveCurrentPage(); expect( capture[ 0 ].gradient ).toEqual( expected );
        expect( capture[ 0 ].gradient.colors[ 1 ].offset ).toBe( 0 );
    } );

    test( 'Solid cancels old pending work and detached inputs cannot resurrect Gradient', () => {
        edit(); const staleInput = controls().querySelector( '.gradient-stop-color' );
        jest.advanceTimersByTime( 0 ); select( 'solid' ); input( staleInput, '#00ff00' );
        jest.advanceTimersByTime( 1000 ); expect( model().gradient ).toBeNull(); expect( model().fill ).toBe( 'transparent' );
    } );

    test( 'selection commits the prior layer but a replaced instance cannot affect the next layer', () => {
        edit(); const staleInput = controls().querySelector( '.gradient-stop-color' );
        editor.stateManager.set( 'layers', [ model(), { ...model(), id: 'other', gradient: null } ] );
        panel.updatePropertiesPanel( 'other' ); input( staleInput, '#00ff00' ); jest.advanceTimersByTime( 1000 );
        expect( model().gradient.colors[ 0 ].color ).toBe( '#ff0000' );
        expect( editor.stateManager.get( 'layers' )[ 1 ].gradient ).toBeNull();
    } );

    test( 'a newer model gradient or owner config invalidates pending control writes', () => {
        edit(); const newer = { ...controls()._gradientEditor.currentGradient, angle: 135 };
        editor.updateLayer( 'arrow', { gradient: newer } ); jest.advanceTimersByTime( 1000 );
        expect( model().gradient ).toEqual( newer );
        panel.updatePropertiesPanel( 'arrow' ); input( controls().querySelector( '.gradient-angle-slider' ), 0 );
        editor.config = { pageOwned: true }; jest.advanceTimersByTime( 1000 ); expect( model().gradient ).toEqual( newer );
    } );

    test( 'Save-on-Close commits pending changes and closes once; Cancel keeps edits; Discard prohibits late writes', async () => {
        edit(); editor.dialogManager = { showSaveDiscardDialog: jest.fn( () => Promise.resolve( 'cancel' ) ) };
        editor.cancel( false ); await Promise.resolve(); expect( editor._closeCompleted ).not.toBe( true );
        input( controls().querySelector( '.gradient-angle-slider' ), 45 );
        editor.dialogManager.showSaveDiscardDialog.mockResolvedValue( 'save' );
        editor.cancel( false ); for ( let step = 0; step < 8; step++ ) await Promise.resolve();
        expect( capture[ 0 ].gradient.angle ).toBe( 45 ); expect( editor._closeCompleted ).toBe( true );
        const dirty = editor.stateManager.get( 'isDirty' ); jest.advanceTimersByTime( 1000 );
        expect( editor.stateManager.get( 'isDirty' ) ).toBe( dirty ); expect( editor.uiManager.destroy ).toHaveBeenCalledTimes( 1 );
    } );

    test( 'Discard cancels controls and teardown never flushes discarded pending work', async () => {
        edit(); const staleInput = controls().querySelector( '.gradient-stop-color' );
        editor.dialogManager = { showSaveDiscardDialog: () => Promise.resolve( 'discard' ) };
        editor.cancel( false ); await Promise.resolve(); input( staleInput, '#00ff00' ); jest.advanceTimersByTime( 1000 );
        expect( editor.apiManager.saveLayers ).not.toHaveBeenCalled(); expect( editor.stateManager.get( 'isDirty' ) ).toBe( false );
        expect( model().gradient.colors[ 0 ].color ).toBe( '#ff0000' );
    } );

    test( 'destroy cancels instead of committing pending controls', () => {
        edit(); const instance = controls()._gradientEditor; const before = model().gradient;
        instance.destroy(); jest.advanceTimersByTime( 1000 ); expect( model().gradient ).toBe( before );
        expect( model().gradient.colors[ 0 ].color ).toBe( 'transparent' );
    } );

    test( 'a pending edit during an in-flight Save remains dirty and prevents successful Close', async () => {
        edit(); let resolveSave;
        editor.apiManager.saveLayers = jest.fn( () => new Promise( resolve => { resolveSave = resolve; } ) );
        const saving = editor.saveCurrentPage();
        input( controls().querySelector( '.gradient-angle-slider' ), 45 );
        editor.stateManager.set( 'isDirty', false );
        resolveSave( { dirty: false, editorStateValid: true, draftPersisted: true } );
        expect( await saving ).toBe( false ); expect( model().gradient.angle ).toBe( 45 );
        expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
    } );
} );
