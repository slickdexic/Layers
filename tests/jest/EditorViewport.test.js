/** @jest-environment jsdom */
const ZoomPanController = require( '../../resources/ext.layers.editor/canvas/ZoomPanController.js' );
const CanvasManager = require( '../../resources/ext.layers.editor/CanvasManager.js' );
const CanvasEvents = require( '../../resources/ext.layers.editor/CanvasEvents.js' );
const TransformController = require( '../../resources/ext.layers.editor/canvas/TransformController.js' );

describe( 'editor viewport geometry', () => {
	let cm, container, canvas, controller, events;
	beforeEach( () => {
		container = document.createElement( 'div' );
		container.style.padding = '20px';
		Object.defineProperties( container, {
			clientWidth: { value: 720, writable: true },
			clientHeight: { value: 540, writable: true }
		} );
		container.getBoundingClientRect = () => ( { left: 360, top: 120,
			width: container.clientWidth, height: container.clientHeight } );
		canvas = document.createElement( 'canvas' );
		canvas.width = 800; canvas.height = 600;
		canvas.style.width = '500px'; canvas.style.height = '375px';
		canvas.style.border = '2px solid black';
		container.appendChild( canvas );
		cm = { canvas, container, zoom: 1, panX: 0, panY: 0,
			userHasSetZoom: false, renderLayers: jest.fn(), currentTool: 'pointer',
			editor: { layers: [], markDirty: jest.fn(), saveState: jest.fn() } };
		canvas.getBoundingClientRect = () => {
			const width = parseFloat( canvas.style.width ) + 4;
			const height = parseFloat( canvas.style.height ) + 4;
			return { left: 360 + ( container.clientWidth - width ) / 2 + cm.panX,
				top: 120 + ( container.clientHeight - height ) / 2 + cm.panY,
				width: width * cm.zoom, height: height * cm.zoom };
		};
		controller = new ZoomPanController( cm );
		cm.zoomPanController = controller;
		cm.resizeCanvas = () => CanvasManager.prototype.resizeCanvas.call( cm );
		events = null;
	} );
	const centrePoint = () => {
		const rect = canvas.getBoundingClientRect();
		return { x: ( 360 + container.clientWidth / 2 - rect.left ) / rect.width,
			y: ( 120 + container.clientHeight / 2 - rect.top ) / rect.height };
	};
	const expectSamePoint = point => {
		expect( centrePoint().x ).toBeCloseTo( point.x, 5 );
		expect( centrePoint().y ).toBeCloseTo( point.y, 5 );
	};
	const touch = ( type, points, target = canvas ) => {
		const event = new Event( type, { bubbles: true, cancelable: true } );
		Object.defineProperty( event, 'touches', { value: points.map( point => ( {
			clientX: point.x, clientY: point.y, target: point.target || target
		} ) ) } );
		target.dispatchEvent( event );
		return event;
	};
	test( 'toolbar zoom keeps the content under the visible workspace centre', () => {
		controller.setPan( 73, -48 );
		const point = centrePoint();
		controller.setZoom( 2 );
		expectSamePoint( point );
	} );
	test( 'initial sizing fits the entire border inside the padded workspace', () => {
		cm.resizeCanvas();
		const rect = canvas.getBoundingClientRect();
		expect( rect.left ).toBeGreaterThanOrEqual( 380 );
		expect( rect.top ).toBeGreaterThanOrEqual( 140 );
		expect( rect.left + rect.width ).toBeLessThanOrEqual( 1060 );
		expect( rect.top + rect.height ).toBeLessThanOrEqual( 640 );
		expectSamePoint( { x: 0.5, y: 0.5 } );
	} );
	test( 'resizing a manually navigated workspace preserves zoom and its centre point', () => {
		cm.resizeCanvas();
		controller.setZoom( 2 );
		controller.setPan( 73, -48 );
		const point = centrePoint();
		container.clientWidth = 540; container.clientHeight = 420;
		cm.resizeCanvas();
		expect( cm.zoom ).toBe( 2 );
		expectSamePoint( point );
		expect( cm.editor.layers ).toEqual( [] );
	} );
	test( 'Fit recentres a panned canvas even when its zoom already fits', () => {
		cm.resizeCanvas();
		controller.setPan( 128, -64 );
		const now = jest.spyOn( performance, 'now' ).mockReturnValue( 0 );
		controller.fitToWindow();
		now.mockReturnValue( 500 ); controller.animateZoom(); now.mockRestore();
		expectSamePoint( { x: 0.5, y: 0.5 } );
		expect( cm.zoom ).toBeCloseTo( 1 );
	} );
	test( 'two fingers on blank workspace translate the viewport without editing content/history', () => {
		cm.resizeCanvas(); events = new CanvasEvents( cm );
		const layers = JSON.stringify( cm.editor.layers );
		touch( 'touchstart', [ { x: 400, y: 160 }, { x: 500, y: 160 } ], container );
		touch( 'touchmove', [ { x: 450, y: 135 }, { x: 550, y: 135 } ], container );
		expect( cm.panX ).toBe( 50 ); expect( cm.panY ).toBe( -25 );
		expect( cm.zoom ).toBe( 1 );
		touch( 'touchend', [], container );
		expect( JSON.stringify( cm.editor.layers ) ).toBe( layers );
		expect( cm.editor.markDirty ).not.toHaveBeenCalled();
		expect( cm.editor.saveState ).not.toHaveBeenCalled();
	} );
	test( 'combined pinch and translation keep the same content under the moving midpoint', () => {
		cm.resizeCanvas(); events = new CanvasEvents( cm );
		const point = centrePoint();
		touch( 'touchstart', [ { x: 670, y: 390 }, { x: 770, y: 390 } ] );
		const move = touch( 'touchmove', [ { x: 610, y: 365 }, { x: 910, y: 365 } ] );
		const rect = canvas.getBoundingClientRect();
		expect( cm.zoom ).toBe( 3 );
		expect( ( 760 - rect.left ) / rect.width ).toBeCloseTo( point.x, 5 );
		expect( ( 365 - rect.top ) / rect.height ).toBeCloseTo( point.y, 5 );
		expect( move.defaultPrevented ).toBe( true );
	} );
	test( 'remaining fingers cannot become a stray edit, and the next touch edits normally', () => {
		cm.resizeCanvas(); events = new CanvasEvents( cm );
		touch( 'touchstart', [ { x: 670, y: 390 }, { x: 770, y: 390 } ] );
		const move = jest.spyOn( events, 'handleMouseMove' ).mockImplementation( () => {} );
		touch( 'touchend', [ { x: 670, y: 390 } ] );
		touch( 'touchmove', [ { x: 680, y: 390 } ] );
		expect( move ).not.toHaveBeenCalled();
		touch( 'touchend', [] );
		expect( events.touchNavigation ).toBe( false );
		expect( cm.lastTouchTime ).toBe( 0 );
		const down = jest.spyOn( events, 'handleMouseDown' ).mockImplementation( () => {} );
		touch( 'touchstart', [ { x: 680, y: 390 } ] );
		expect( down ).toHaveBeenCalledTimes( 1 );
		expect( cm.editor.saveState ).not.toHaveBeenCalled();
	} );
	test( 'starting navigation restores a pending drag and cancels its deferred callback', () => {
		jest.useFakeTimers(); cm.resizeCanvas();
		const original = { id: 'one', x: 10, y: 20, type: 'rectangle', width: 40, height: 40 };
		cm.editor.layers = [ { ...original } ];
		cm.editor.getLayerById = id => cm.editor.layers.find( layer => layer.id === id );
		const transform = cm.transformController = new TransformController( cm );
		transform.originalLayerState = { ...original }; transform.isDragging = true;
		Object.assign( cm.editor.layers[ 0 ], { x: 99, previewOnly: true } );
		transform._dragRafId = requestAnimationFrame( () => { cm.editor.layers[ 0 ].x = 200; } );
		events = new CanvasEvents( cm );
		touch( 'touchstart', [ { x: 670, y: 390 }, { x: 770, y: 390 } ] );
		jest.runOnlyPendingTimers();
		expect( cm.editor.layers ).toEqual( [ original ] );
		expect( transform.isDragging ).toBe( false );
		expect( cm.editor.markDirty ).not.toHaveBeenCalled();
		expect( cm.editor.saveState ).not.toHaveBeenCalled();
		transform.destroy();
	} );
	test( 'a finger starting on a control is excluded from canvas navigation', () => {
		cm.resizeCanvas(); events = new CanvasEvents( cm );
		const down = jest.spyOn( events, 'handleMouseDown' ).mockImplementation( () => {} );
		touch( 'touchstart', [ { x: 670, y: 390 },
			{ x: 770, y: 390, target: document.createElement( 'button' ) } ] );
		expect( cm.isPinching ).not.toBe( true );
		expect( down ).toHaveBeenCalledTimes( 1 );
	} );
	afterEach( () => {
		events?.destroy(); controller.destroy(); jest.useRealTimers(); jest.restoreAllMocks();
	} );
} );
