/**
 * Page-owned publication stores exactly what the editor sends, so every layer a drawing tool
 * creates with the editor's own defaults must pass the server validator unchanged.
 * The server half of this contract is DocumentSchemaTest::testEditorCreatedLayersPublishUnchanged,
 * which canonicalizes the same fixture. After an intended change to a tool's output, regenerate
 * the fixture with LAYERS_UPDATE_FIXTURES=1 and run both tests.
 */
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const FIXTURE = path.join( __dirname, '../fixtures/revisions/editor-created-document-v1.json' );

// Each tool is driven the way the canvas events drive it: press, drag, release.
const GESTURES = [
	[ 'rectangle', [ 100, 100 ], [ 180, 160 ] ],
	[ 'circle', [ 100, 100 ], [ 130, 140 ] ],
	[ 'ellipse', [ 200, 200 ], [ 260, 230 ] ],
	[ 'polygon', [ 300, 300 ], [ 330, 340 ] ],
	[ 'star', [ 400, 300 ], [ 430, 340 ] ],
	[ 'line', [ 50, 50 ], [ 150, 80 ] ],
	[ 'arrow', [ 60, 200 ], [ 200, 260 ] ],
	[ 'pen', [ 100, 400 ], [ 160, 440 ], [ 220, 420 ] ],
	[ 'textbox', [ 450, 50 ], [ 650, 150 ] ],
	[ 'callout', [ 450, 200 ], [ 650, 280 ] ],
	[ 'marker', [ 700, 400 ], [ 700, 400 ] ],
	[ 'dimension', [ 100, 500 ], [ 300, 500 ] ]
];

function createCanvasManager( added ) {
	window.Layers = window.Layers || {};
	window.Layers.Canvas = window.Layers.Canvas || {};
	window.Layers.Canvas.DrawingController = require( '../../resources/ext.layers.editor/canvas/DrawingController.js' );
	window.Layers.Canvas.TextInputController = require( '../../resources/ext.layers.editor/canvas/TextInputController.js' );
	const ValidationManager = require( '../../resources/ext.layers.editor/ValidationManager.js' );
	const CanvasManager = require( '../../resources/ext.layers.editor/CanvasManager.js' );
	const validation = new ValidationManager( {} );
	const editor = {
		layers: [],
		// As LayersEditor.addLayer does before storing the layer.
		addLayer: ( layer ) => {
			const stored = validation.sanitizeLayerData( layer );
			stored.visible = stored.visible !== false && stored.visible !== 0;
			added.push( stored );
		},
		addLayerWithoutSelection: ( layer ) => editor.addLayer( layer ),
		setCurrentTool: () => {},
		stateManager: { get: () => null, set: () => {}, subscribe: () => {} }
	};
	const canvas = document.createElement( 'canvas' );
	canvas.getContext = () => ( { save() {}, restore() {}, clearRect() {}, setTransform() {} } );
	const cm = new CanvasManager( { container: document.createElement( 'div' ), editor, canvas } );
	cm.renderLayers = () => {};
	return cm;
}

function drawEveryTool() {
	const created = [];
	const cm = createCanvasManager( created );
	const point = ( [ x, y ] ) => ( { x, y } );
	for ( const [ tool, start, ...moves ] of GESTURES ) {
		cm.currentTool = tool;
		cm.startDrawing( point( start ) );
		moves.forEach( ( move ) => cm.continueDrawing( point( move ) ) );
		cm.finishDrawing( point( moves[ moves.length - 1 ] ) );
	}
	// Angle dimensions take three clicks: arm end, vertex, other arm end.
	cm.currentTool = 'angleDimension';
	cm.startDrawing( { x: 500, y: 500 } );
	cm.finishDrawing( { x: 400, y: 550 } );
	cm.finishDrawing( { x: 500, y: 580 } );
	// The text tool finishes through its input box.
	cm.textInputController.finishTextInput( { value: 'Caption' }, { x: 40, y: 580 }, cm.currentStyle );
	return created.map( ( layer, index ) => ( { id: 'layer-' + ( index + 1 ), ...layer } ) );
}

describe( 'Layers created by the drawing tools', () => {
	beforeEach( () => {
		jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation( () => 0 );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
	} );

	it( 'match the fixture the server publishes unchanged', () => {
		const layers = drawEveryTool();
		expect( layers.map( ( layer ) => layer.type ) ).toEqual( [
			'rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'arrow', 'path',
			'textbox', 'callout', 'marker', 'dimension', 'angleDimension', 'text'
		] );
		if ( process.env.LAYERS_UPDATE_FIXTURES === '1' ) {
			const document = {
				schemaVersion: 1,
				surfaces: [ {
					id: 'editor-tools',
					kind: 'slide',
					label: 'Every drawing tool with editor defaults',
					canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
					layers
				} ]
			};
			fs.writeFileSync( FIXTURE, JSON.stringify( document, null, 2 ) + '\n' );
		}
		expect( layers ).toStrictEqual( JSON.parse( fs.readFileSync( FIXTURE, 'utf8' ) ).surfaces[ 0 ].layers );
		// The client refuses undefined, NaN and other non-JSON values before any request is sent.
		const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
		const document = JSON.parse( fs.readFileSync( FIXTURE, 'utf8' ) );
		expect( () => new Adapter().withEditorState( document, 'editor-tools',
			{ canvas: document.surfaces[ 0 ].canvas, layers } ) ).not.toThrow();
	} );
} );
