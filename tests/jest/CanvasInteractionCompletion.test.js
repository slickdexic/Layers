'use strict';

const Events = require( '../../resources/ext.layers.editor/CanvasEvents.js' );
const Drawing = require( '../../resources/ext.layers.editor/canvas/DrawingController.js' );
const TextInput = require( '../../resources/ext.layers.editor/canvas/TextInputController.js' );
const Host = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationHost.js' );
const { setup } = require( './fixtures/pdfCreationHost.js' );

describe( 'Completed canvas gestures release page-owned PDF editing', () => {
	let work, cm, events;
	const mouse = () => ( { button: 0, clientX: 104, clientY: 208 } );

	beforeEach( async () => {
		work = setup();
		expect( await work.host.load() ).toBe( true );
		cm = work.editor.canvasManager;
		cm.getMousePoint = () => ( { x: 104, y: 208 } );
		cm.showRulers = false;
		events = Object.create( Events.prototype );
		events.cm = cm;
	} );

	afterEach( () => work.close() );

	it( 'opens and cancels native Text without needing a canvas mouseup behind the modal', async () => {
		cm.drawingController = new Drawing( cm );
		cm.textInputController = new TextInput( cm );
		cm.currentTool = 'text';
		events.handleMouseDown( mouse() );
		expect( document.querySelector( '.layers-text-modal .text-input' ) ).not.toBeNull();
		expect( cm.drawingController.isDrawing ).toBe( false );
		// The modal receives the release event, so the canvas never receives mouseup.
		expect( () => work.host.capture() ).not.toThrow();
		cm.textInputController.hideTextInputModal();
		expect( await work.host.turn( 1 ) ).toBe( true );
		expect( work.editor.page ).toBe( 1 );
	} );

	it( 'captures and turns after a real pointer marquee completion', async () => {
		cm.currentTool = 'pointer';
		events.handleMouseDown( mouse() );
		expect( cm.isDrawing ).toBe( true );
		expect( () => work.host.capture() ).toThrow( 'layers-editor-session-unavailable' );
		events.handleMouseUp( mouse() );
		expect( () => work.host.capture() ).not.toThrow();
		expect( await work.host.turn( 1 ) ).toBe( true );
	} );

	it.each( [
		[ 'isArrowTipDragging', 'finishArrowTipDrag' ],
		[ 'isDimensionTextDragging', 'finishDimensionTextDrag' ],
		[ 'isAngleDimensionTextDragging', 'finishAngleDimensionTextDrag' ],
		[ 'isResizing', 'finishResize' ],
		[ 'isRotating', 'finishRotation' ],
		[ 'isDragging', 'finishDrag' ]
	] )( 'releases the canvas before %s completion captures history', ( flag, method ) => {
		cm.isDrawing = true;
		cm.transformController = { [ flag ]: true, [ method ]: jest.fn( () => {
			cm.transformController[ flag ] = false;
			expect( () => work.host.capture() ).not.toThrow();
		} ) };
		events.handleMouseUp( mouse() );
		expect( cm.transformController[ method ] ).toHaveBeenCalledTimes( 1 );
		expect( cm.isDrawing ).toBe( false );
	} );

	it.each( [ 'isPanning', 'isDraggingGuide', 'isMarqueeSelecting' ] )(
		'clears completed %s even when mouseup exits early', flag => {
			cm.isDrawing = true;
			cm[ flag ] = true;
			cm.finishMarqueeSelection = () => { cm.isMarqueeSelecting = false; };
			events.handleMouseUp( mouse() );
			expect( cm.isDrawing ).toBe( false );
			expect( () => work.host.capture() ).not.toThrow();
		}
	);

	it.each( [ 'rectangle', 'pen', 'marker' ] )( 'still finishes an active %s exactly once', tool => {
		cm.currentTool = tool;
		cm.isDrawing = true;
		cm.finishDrawing = jest.fn();
		events.handleMouseUp( mouse() );
		expect( cm.finishDrawing ).toHaveBeenCalledTimes( 1 );
		expect( cm.finishDrawing ).toHaveBeenCalledWith( { x: 104, y: 208 } );
		expect( cm.isDrawing ).toBe( false );
	} );

	it( 'does not finish an idle tool or advance an in-progress angle dimension', () => {
		cm.currentTool = 'rectangle';
		cm.isDrawing = false;
		cm.finishDrawing = jest.fn();
		events.handleMouseUp( mouse() );
		expect( cm.finishDrawing ).not.toHaveBeenCalled();
		cm.currentTool = 'angleDimension';
		cm.isDrawing = true;
		cm.drawingController = { isAngleDimensionInProgress: () => true };
		events.handleMouseUp( mouse() );
		expect( cm.finishDrawing ).not.toHaveBeenCalled();
		expect( cm.isDrawing ).toBe( false );
		cm.drawingController = null;
	} );

	it( 'releases a completed one-finger marquee through the native touch-end path', () => {
		cm.currentTool = 'pointer';
		events.handleMouseDown( mouse() );
		events.handleTouchEnd( { changedTouches: [ mouse() ] } );
		expect( () => work.host.capture() ).not.toThrow();
	} );

	it( 'allows page controls to read the fully committed PDF state during refresh', async () => {
		work.close(); work = setup(); work.host.dispose();
		const shown = [], errors = []; let active = false;
		work.editor.refreshPageControls = () => {
			if ( !active ) return;
			try {
				const envelope = work.host.captureExitEnvelope();
				shown.push( { page: work.editor.page, count: work.editor.pageCount,
					members: envelope.draft.snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === 'ABC' ) } );
			} catch ( error ) { errors.push( error.stack ); throw error; }
		};
		work.host = new Host( work.editor, work.native, { reader: work.reader, publisher: work.publisher } );
		try {
			expect( await work.host.load() ).toBe( true ); active = true; work.edit( 'Retained page two' );
			expect( { turned: await work.host.turn( 1 ), errors } ).toEqual( { turned: true, errors: [] } );
			expect( shown[ 0 ] ).toMatchObject( { page: 1, count: 2 } );
			expect( work.host.getStatus().needsRefresh ).toBe( false );
			expect( await work.host.turn( 2 ) ).toBe( true );
			expect( shown[ 1 ] ).toMatchObject( { page: 2, count: 2 } );
			expect( work.editor.layers[ 0 ].text ).toBe( 'Retained page two' );
		} finally { work.host.dispose(); }
	} );

	it.each( [ 'isDrawing', 'isDragging', 'isResizing', 'isRotating', 'isPanning' ] )(
		'retains strict refusal while %s is still active', flag => {
			cm[ flag ] = true;
			expect( () => work.host.capture() ).toThrow( 'layers-editor-session-unavailable' );
			cm[ flag ] = false;
		}
	);
} );
