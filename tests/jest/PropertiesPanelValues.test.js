/**
 * Every value the properties panel can write must be one page-owned publication stores unchanged.
 * This drives each control of every layer type's panel to its lowest and its highest choice;
 * DocumentSchemaTest publishes the resulting fixture. After an intended panel change, regenerate
 * it with LAYERS_UPDATE_FIXTURES=1 and run both tests.
 */
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const FIXTURE = path.join( __dirname, '../fixtures/revisions/properties-panel-document-v1.json' );
const TOOL_FIXTURE = path.join( __dirname, '../fixtures/revisions/editor-created-document-v1.json' );

const EXTRA_LAYERS = [
	{ id: 'photo', type: 'image', x: 10, y: 10, width: 40, height: 40, originalWidth: 1, originalHeight: 1,
		src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		visible: true },
	{ id: 'shape', type: 'customShape', shapeId: 'test/blue', x: 60, y: 10, width: 40, height: 40,
		viewBox: [ 0, 0, 10, 10 ], stroke: '#000000', fill: 'none', visible: true,
		svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#0000ff"/></svg>' }
];

function seedLayers() {
	return JSON.parse( fs.readFileSync( TOOL_FIXTURE, 'utf8' ) ).surfaces[ 0 ].layers.concat( EXTRA_LAYERS );
}

function makeEditor( state ) {
	const noop = () => {};
	return {
		get layers() {
			return [ state.layer ];
		},
		getLayerById: ( id ) => ( id === state.layer.id ? state.layer : undefined ),
		updateLayer: ( id, changes ) => {
			if ( id === state.layer.id ) {
				state.layer = { ...state.layer, ...changes };
			}
		},
		stateManager: { get: ( key ) => ( key === 'layers' ? [ state.layer ] : undefined ), set: noop },
		canvasManager: {
			updateMarkerDefaults: noop, updateDimensionDefaults: noop, updateAngleDimensionDefaults: noop,
			renderLayers: noop, redraw: noop
		},
		layerPanel: { updatePropertiesPanel: noop },
		saveState: noop,
		markDirty: noop
	};
}

function choose( control, mode ) {
	const events = [ 'change' ];
	if ( control.tagName === 'SELECT' ) {
		if ( !control.options.length ) {
			return;
		}
		control.value = control.options[ mode === 'min' ? 0 : control.options.length - 1 ].value;
	} else if ( control.type === 'checkbox' ) {
		control.checked = mode === 'max';
	} else if ( control.type === 'number' || control.type === 'range' ) {
		const bound = control.getAttribute( mode );
		if ( bound === null ) {
			return;
		}
		control.value = bound;
		events.unshift( 'input' );
	} else if ( control.type === 'color' ) {
		control.value = mode === 'min' ? '#000000' : '#ffffff';
	} else if ( control.type === 'text' || control.tagName === 'TEXTAREA' ) {
		control.value = mode === 'min' ? '0.1' : 'Panel text 2';
		events.unshift( 'input' );
	} else {
		return;
	}
	events.forEach( ( type ) => control.dispatchEvent( new Event( type, { bubbles: true } ) ) );
}

// Two passes: some controls (tolerance values, tail options) only appear after another control is set.
function driveEveryControl( layer, mode ) {
	const PropertiesForm = require( '../../resources/ext.layers.editor/ui/PropertiesForm.js' );
	const state = { layer: JSON.parse( JSON.stringify( layer ) ) };
	const editor = makeEditor( state );
	for ( let pass = 0; pass < 2; pass++ ) {
		const form = PropertiesForm.create( state.layer, editor, () => {} );
		form.querySelectorAll( 'input, select, textarea' ).forEach( ( control ) => choose( control, mode ) );
		jest.runOnlyPendingTimers();
	}
	// As PageOwnedEditorBridge does before publishing: a cleared property is absent.
	return Object.fromEntries( Object.entries( state.layer ).filter( ( [ , value ] ) => value !== null && value !== undefined ) );
}

describe( 'Values written by the properties panel', () => {
	let errors;
	beforeEach( () => {
		jest.useFakeTimers();
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.PropertyBuilders = require( '../../resources/ext.layers.editor/ui/PropertyBuilders.js' );
		window.Layers.UI.GradientEditor = require( '../../resources/ext.layers.editor/ui/GradientEditor.js' );
		errors = [];
		jest.spyOn( mw.log, 'error' ).mockImplementation( ( ...args ) => errors.push( args.join( ' ' ) ) );
	} );

	afterEach( () => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	} );

	it( 'match the fixture the server publishes unchanged', () => {
		const surfaces = [ 'min', 'max' ].map( ( mode ) => ( {
			id: 'panel-' + mode,
			kind: 'slide',
			label: 'Every properties panel control at its ' + mode + ' choice',
			canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
			layers: seedLayers().map( ( layer ) => driveEveryControl( layer, mode ) )
		} ) );
		expect( errors ).toEqual( [] );
		if ( process.env.LAYERS_UPDATE_FIXTURES === '1' ) {
			fs.writeFileSync( FIXTURE, JSON.stringify( { schemaVersion: 1, surfaces }, null, 2 ) + '\n' );
		}
		expect( surfaces ).toStrictEqual( JSON.parse( fs.readFileSync( FIXTURE, 'utf8' ) ).surfaces );
	} );
} );
