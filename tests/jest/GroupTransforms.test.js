const Geometry = require( '../../resources/ext.layers.editor/canvas/GroupTransformGeometry.js' );
const GroupController = require( '../../resources/ext.layers.editor/canvas/GroupTransformController.js' );
const TransformController = require( '../../resources/ext.layers.editor/canvas/TransformController.js' );
const LayerBounds = require( '../../resources/ext.layers.shared/LayerBounds.js' );
const SelectionRenderer = require( '../../resources/ext.layers.editor/canvas/SelectionRenderer.js' );

describe( 'Folder group transforms', () => {
	let manager, controller, group, rect, arrow, history;
	const clone = ( value ) => JSON.parse( JSON.stringify( value ) );
	beforeEach( () => {
		window.Layers.Canvas.GroupTransformController = GroupController;
		window.requestAnimationFrame = jest.fn( () => 1 );
		window.cancelAnimationFrame = jest.fn();
		group = { id: 'g', type: 'group', children: [ 'r', 'a' ], expanded: false };
		rect = { id: 'r', type: 'rectangle', parentGroup: 'g', x: 10, y: 20, width: 40, height: 20, rotation: 0, strokeWidth: 2 };
		arrow = { id: 'a', type: 'arrow', parentGroup: 'g', x1: 100, y1: 20, x2: 140, y2: 40, controlX: 120, controlY: 0, rotation: 0 };
		history = [];
		const editor = {
			layers: [ group, rect, arrow ], markDirty: jest.fn(),
			getLayerById: ( id ) => editor.layers.find( ( l ) => l.id === id ),
			saveState: jest.fn( () => history.push( clone( editor.layers ) ) ),
			apiManager: { showUserNotification: jest.fn() }
		};
		manager = { editor, canvas: { style: {} }, currentTool: 'pointer',
			getSelectedLayerIds: () => [ 'g' ], getSelectedLayerId: () => 'g',
			getToolCursor: () => 'default', renderLayers: jest.fn(),
			getLayerBounds: ( l ) => LayerBounds.getBounds( l, { includeRotation: false, includeStroke: false,
				measureText: () => ( { width: 60, height: 16 } ) } ) };
		controller = new TransformController( manager );
		manager.transformController = controller;
	} );

	it( 'works with the real state store and its copying legacy layers getter', () => {
		const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
		const store = new StateManager();
		store.set( 'layers', manager.editor.layers );
		manager.editor.stateManager = store;
		Object.defineProperty( manager.editor, 'layers', { get: () => store.getLayers() } );
		controller.startDrag( { x: 0, y: 0 } );
		controller.handleDrag( { x: 20, y: 10 } );
		controller.finishDrag();
		expect( store.getLayer( 'r' ).x ).toBe( 30 );
		expect( history ).toHaveLength( 1 );
		store.destroy();
	} );
	afterEach( () => controller.groupTransform?.finish( true ) );

	it.each( [ 'line', 'arrow' ] )( 'rotates a horizontal %s about its rendered midpoint', ( type ) => {
		const layer = { type, x1: 0, y1: 0, x2: 100, y2: 0 };
		const result = Geometry.transform( layer, { anchor: { x: 0, y: 0 }, angle: 90 }, manager );
		expect( ( result.x1 + result.x2 ) / 2 ).toBeCloseTo( 0 );
		expect( ( result.y1 + result.y2 ) / 2 ).toBeCloseTo( 50 );
	} );

	it( 'scales the rendered default stroke of a sparse path', () => {
		const result = Geometry.transform( { type: 'path', points: [ { x: 0, y: 0 }, { x: 20, y: 30 } ] },
			{ anchor: { x: 0, y: 0 }, scale: 2 }, manager );
		expect( result.strokeWidth ).toBe( 4 );
	} );

	it( 'loads under ResourceLoader without requesting a relative package file', () => {
		const vm = require( 'node:vm' );
		const fs = require( 'node:fs' );
		const requireModule = jest.fn( () => { throw new Error( 'Not a package module' ); } );
		const browser = { Layers: { Canvas: { GroupTransformGeometry: Geometry } } };
		vm.runInNewContext( fs.readFileSync( require.resolve(
			'../../resources/ext.layers.editor/canvas/GroupTransformController.js' ), 'utf8' ),
		{ window: browser, module: { exports: {} }, require: requireModule } );
		expect( requireModule ).not.toHaveBeenCalled();
		expect( browser.Layers.Canvas.GroupTransformController ).toEqual( expect.any( Function ) );
	} );

	it( 'scales sparse and legacy shadow styles without changing their originals', () => {
		const layer = { ...rect, shadow: { color: '#000', blur: 6, offsetX: 3, offsetY: -2 }, textShadow: true };
		const before = clone( layer );
		const result = Geometry.transform( layer, { anchor: { x: 0, y: 0 }, scale: 2 }, manager );
		expect( result.shadow ).toEqual( { color: '#000', blur: 12, offsetX: 6, offsetY: -4 } );
		expect( result ).toMatchObject( { textShadowBlur: 8, textShadowOffsetX: 4, textShadowOffsetY: 4 } );
		expect( layer ).toEqual( before );
	} );

	it( 'moves valid sparse origins and blocks numeric legacy locks', () => {
		const layer = { type: 'rectangle', width: 50, height: 50 };
		expect( Geometry.transform( layer, { anchor: { x: 0, y: 0 }, dx: 5, dy: 6 }, manager ) )
			.toMatchObject( { x: 5, y: 6 } );
		arrow.locked = 1;
		controller.startDrag( { x: 0, y: 0 } );
		expect( controller.groupTransform.session ).toBeNull();
		expect( manager.editor.apiManager.showUserNotification ).toHaveBeenCalled();
	} );

	it( 'draws exactly one frame with four corners and a rotation handle for a collapsed folder', () => {
		const ctx = { save: jest.fn(), restore: jest.fn(), setLineDash: jest.fn(), strokeRect: jest.fn(),
			fillRect: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), stroke: jest.fn(),
			arc: jest.fn(), fill: jest.fn(), translate: jest.fn(), rotate: jest.fn() };
		const renderer = new SelectionRenderer( { ctx, getLayerById: manager.editor.getLayerById,
			getGroupSelection: ( id ) => controller.groupTransform.selection( id ) } );
		renderer.drawMultiSelectionIndicators( [ 'g', 'r', 'a' ] );
		expect( renderer.getHandles().map( ( h ) => h.type ).sort() ).toEqual( [ 'ne', 'nw', 'rotate', 'se', 'sw' ] );
		expect( ctx.strokeRect ).toHaveBeenCalled();
		expect( controller.groupTransform.hit( { x: 80, y: 30 } ) ).toBe( true );
	} );

	it( 'preserves a new lock while rolling back an interrupted gesture', () => {
		controller.startDrag( { x: 0, y: 0 } );
		controller.handleDrag( { x: 20, y: 10 } );
		arrow.locked = true;
		arrow.name = 'New label';
		controller.finishDrag();
		expect( rect.x ).toBe( 10 );
		expect( arrow ).toMatchObject( { x1: 100, locked: true, name: 'New label' } );
		expect( history ).toHaveLength( 0 );
	} );

	it( 'does not write previews into a newly loaded page', () => {
		controller.startDrag( { x: 0, y: 0 } );
		const next = clone( manager.editor.layers );
		manager.editor.layers = next;
		controller.handleDrag( { x: 20, y: 10 } );
		controller.finishDrag();
		expect( next[ 1 ].x ).toBe( 10 );
		expect( history ).toHaveLength( 0 );
	} );

	it( 'uses keyboard movement, rotation and uniform resizing for the folder', () => {
		controller.groupTransform.keyboard( { key: 'ArrowRight', shiftKey: true } );
		expect( rect.x ).toBe( 20 );
		expect( arrow.x1 ).toBe( 110 );
		controller.groupTransform.keyboard( { key: 'ArrowRight', altKey: true, shiftKey: true } );
		expect( rect.rotation ).toBeCloseTo( 15 );
		controller.groupTransform.keyboard( { key: 'ArrowRight', ctrlKey: true } );
		expect( rect.width ).toBeGreaterThan( 40 );
		expect( rect.width / rect.height ).toBeCloseTo( 2 );
		expect( history ).toHaveLength( 3 );
	} );

	it( 'scales around the center with Alt and snaps rotation with Shift', () => {
		const b = controller.groupTransform.selection( 'g' ).bounds;
		const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
		const start = { x: b.x + b.width, y: b.y + b.height };
		controller.startResize( { type: 'se' }, start );
		controller.handleResize( { x: start.x + b.width / 2, y: start.y + b.height / 2 }, { altKey: true } );
		expect( rect.width ).toBeCloseTo( 80 );
		expect( rect.x ).toBeCloseTo( center.x + ( 10 - center.x ) * 2 );
		controller.groupTransform.finish( true );
		controller.startRotation( { x: center.x + 100, y: center.y } );
		controller.handleRotation( Geometry.point( { x: center.x + 100, y: center.y },
			{ anchor: center, angle: 22 } ), { shiftKey: true } );
		controller.finishRotation();
		expect( rect.rotation ).toBeCloseTo( 15 );
	} );

	it( 'scales a numeric-point star and keeps angular label offsets in degrees', () => {
		const star = { type: 'star', x: 20, y: 30, outerRadius: 40, innerRadius: 20, points: 5 };
		const transform = { anchor: { x: 0, y: 0 }, angle: 90, scale: 2 };
		const scaled = Geometry.transform( star, transform, manager );
		expect( scaled ).toMatchObject( {
			outerRadius: 80, innerRadius: 40, points: 5, rotation: 90
		} );
		expect( scaled.x ).toBeCloseTo( -60 );
		expect( scaled.y ).toBeCloseTo( 40 );
		const angle = { type: 'angleDimension', cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100,
			arcRadius: 40, textOffset: 30 };
		const result = Geometry.transform( angle, transform, manager );
		expect( result.textOffset ).toBe( 30 );
		expect( result.arcRadius ).toBe( 80 );
		expect( result.ay ).toBeCloseTo( 200 );
	} );

	it( 'includes offset dimensions and large arcs in the folder bounds', () => {
		const dimension = { type: 'dimension', x1: 0, y1: 0, x2: 100, y2: 0, dimensionOffset: 200 };
		expect( Geometry.geometry( dimension, manager ).bounds.y ).toBeLessThan( -210 );
		const angle = { type: 'angleDimension', cx: 0, cy: 0, ax: 10, ay: 0, bx: 0, by: 10, arcRadius: 200 };
		expect( Geometry.geometry( angle, manager ).bounds.width ).toBeGreaterThan( 400 );
	} );

	it( 'moves nested hidden members exactly once and commits one history step', () => {
		const nested = { id: 'n', type: 'group', parentGroup: 'g', children: [ 'a' ] };
		group.children = [ 'r', 'n' ];
		arrow.parentGroup = 'n';
		arrow.visible = false;
		manager.editor.layers.push( nested );
		manager.getSelectedLayerIds = () => [ 'g', 'n', 'r', 'a' ];
		controller.startDrag( { x: 0, y: 0 } );
		controller.handleDrag( { x: 10, y: -5 } );
		controller.handleDrag( { x: 20, y: 10 } );
		controller.finishDrag();
		expect( rect ).toMatchObject( { x: 30, y: 30, parentGroup: 'g' } );
		expect( arrow ).toMatchObject( { x1: 120, y1: 30, controlX: 140, controlY: 10, visible: false } );
		expect( nested.children ).toEqual( [ 'a' ] );
		expect( history ).toHaveLength( 1 );
		expect( manager.editor.saveState ).toHaveBeenCalledWith( 'Move group' );
	} );

	it( 'orbits member centers around one pivot while preserving their local geometry', () => {
		const b = controller.groupTransform.selection( 'g' ).bounds;
		const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
		const before = clone( rect );
		controller.startRotation( { x: center.x + 100, y: center.y } );
		controller.handleRotation( { x: center.x, y: center.y + 100 }, {} );
		controller.finishRotation();
		const expected = Geometry.point( { x: before.x + 20, y: before.y + 10 }, { anchor: center, angle: 90 } );
		expect( rect.x + rect.width / 2 ).toBeCloseTo( expected.x );
		expect( rect.y + rect.height / 2 ).toBeCloseTo( expected.y );
		expect( rect.rotation ).toBeCloseTo( 90 );
		expect( arrow.rotation ).toBeCloseTo( 90 );
		expect( history ).toHaveLength( 1 );
	} );

	it( 'scales all members from the opposite corner, including strokes and curved-arrow controls', () => {
		const b = controller.groupTransform.selection( 'g' ).bounds;
		const start = { x: b.x + b.width, y: b.y + b.height };
		controller.startResize( { type: 'se' }, start );
		controller.handleResize( { x: start.x + b.width, y: start.y + b.height }, {} );
		controller.finishResize();
		expect( rect.width ).toBe( 80 );
		expect( rect.height ).toBe( 40 );
		expect( rect.strokeWidth ).toBe( 4 );
		expect( arrow.controlX ).toBe( b.x + ( 120 - b.x ) * 2 );
		expect( history ).toHaveLength( 1 );
	} );

	it( 'restores every member on Escape and prevents editor-close keyboard handlers', () => {
		const before = clone( manager.editor.layers );
		controller.startDrag( { x: 0, y: 0 } );
		controller.handleDrag( { x: 50, y: 30 } );
		const close = jest.fn();
		document.addEventListener( 'keydown', close );
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true, cancelable: true } ) );
		document.removeEventListener( 'keydown', close );
		expect( manager.editor.layers ).toEqual( before );
		expect( close ).not.toHaveBeenCalled();
		expect( history ).toHaveLength( 0 );
		expect( controller.isDragging ).toBe( false );
	} );

	it( 'finishes a drag released outside the canvas and cancels on window blur', () => {
		manager.getMousePoint = ( event ) => ( { x: event.clientX, y: event.clientY } );
		controller.startDrag( { x: 0, y: 0 } );
		document.dispatchEvent( new MouseEvent( 'mouseup', { clientX: 20, clientY: 10 } ) );
		expect( rect.x ).toBe( 30 );
		expect( history ).toHaveLength( 1 );
		controller.startDrag( { x: 0, y: 0 } );
		controller.handleDrag( { x: 50, y: 30 } );
		window.dispatchEvent( new Event( 'blur' ) );
		expect( rect.x ).toBe( 30 );
		expect( history ).toHaveLength( 1 );
		expect( controller.groupTransform.session ).toBeNull();
	} );

	it.each( [ 'group', 'member', 'ancestor' ] )( 'blocks the entire group for a locked %s', ( which ) => {
		if ( which === 'group' ) group.locked = true;
		if ( which === 'member' ) arrow.locked = true;
		if ( which === 'ancestor' ) {
			group.parentGroup = 'parent';
			manager.editor.layers.push( { id: 'parent', type: 'group', locked: true, children: [ 'g' ] } );
		}
		const before = clone( manager.editor.layers );
		controller.startDrag( { x: 0, y: 0 } );
		expect( controller.isDragging ).toBe( false );
		expect( manager.editor.layers ).toEqual( before );
		expect( manager.editor.apiManager.showUserNotification.mock.calls[ 0 ][ 0 ] ).toMatch( /Unlock/ );
	} );

	it( 'rolls back the entire gesture when any member exceeds a scale limit', () => {
		rect.strokeWidth = 80;
		const before = clone( manager.editor.layers );
		const b = controller.groupTransform.selection( 'g' ).bounds;
		const start = { x: b.x + b.width, y: b.y + b.height };
		controller.startResize( { type: 'se' }, start );
		controller.handleResize( { x: start.x + b.width * 0.1, y: start.y + b.height * 0.1 }, {} );
		controller.handleResize( { x: start.x + b.width, y: start.y + b.height }, {} );
		controller.finishResize();
		expect( manager.editor.layers ).toEqual( before );
		expect( history ).toHaveLength( 0 );
		expect( manager.editor.apiManager.showUserNotification.mock.calls[ 0 ][ 0 ] ).toMatch( /supported size/ );
	} );

	it( 'creates no history for a click, a return to origin, or an empty group', () => {
		controller.startDrag( { x: 0, y: 0 } );
		controller.finishDrag();
		controller.startDrag( { x: 0, y: 0 } );
		controller.handleDrag( { x: 10, y: 0 } );
		controller.handleDrag( { x: 0, y: 0 } );
		controller.finishDrag();
		group.children = [];
		manager.editor.layers = [ group ];
		controller.startDrag( { x: 0, y: 0 } );
		expect( controller.groupTransform.selection( 'g' ) ).toBeNull();
		expect( history ).toHaveLength( 0 );
	} );

	it( 'rejects malformed and cyclic folders instead of moving a subset', () => {
		group.children.push( 'missing' );
		expect( () => Geometry.resolve( [ 'g' ], manager.editor.layers ) ).toThrow();
		group.children = [ 'g' ]; group.parentGroup = 'g';
		expect( () => Geometry.resolve( [ 'g' ], manager.editor.layers ) ).toThrow();
	} );

	it( 'preserves rich text and scales local callout offsets without rotating them twice', () => {
		const callout = { type: 'callout', x: 20, y: 30, width: 80, height: 40, rotation: 30,
			tailTipX: 10, tailTipY: 70, fontSize: 16, richText: [ { text: 'Keep', style: { fontSize: 20, bold: true } } ] };
		const before = clone( callout );
		const result = Geometry.transform( callout, { anchor: { x: 0, y: 0 }, scale: 2, angle: 90 }, manager );
		expect( result ).toMatchObject( { rotation: 120, tailTipX: 20, tailTipY: 140, fontSize: 32 } );
		expect( result.richText[ 0 ].style.fontSize ).toBe( 40 );
		expect( callout ).toEqual( before );
	} );

	it.each( [ 'rectangle', 'textbox', 'callout', 'image', 'customShape', 'blur', 'text',
		'circle', 'ellipse', 'polygon', 'star', 'marker', 'path', 'line', 'arrow', 'dimension', 'angleDimension' ] )(
		'round-trips a %s through a group move and its inverse', ( type ) => {
			const layer = { type, x: 20, y: 30, width: 40, height: 50, radius: 20,
				radiusX: 20, radiusY: 15, x1: 1, y1: 2, x2: 30, y2: 40,
				cx: 20, cy: 30, ax: 10, ay: 10, bx: 40, by: 40, rotation: 30 };
			if ( type === 'path' ) layer.points = [ { x: 1, y: 2 }, { x: 10, y: 30 } ];
			if ( type === 'star' ) layer.points = 5;
			const moved = Geometry.transform( layer, { anchor: { x: 0, y: 0 }, dx: 15, dy: -10 }, manager );
			const restored = Geometry.transform( moved, { anchor: { x: 0, y: 0 }, dx: -15, dy: 10 }, manager );
			expect( restored ).toEqual( layer );
		} );
} );
