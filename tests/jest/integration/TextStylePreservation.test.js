/**
 * Font controls must not apply unrelated tool defaults to existing text.
 * Exercises the property control, editor state update and actual text renderer.
 *
 * @jest-environment jsdom
 */
'use strict';

const StateManager = require( '../../../resources/ext.layers.editor/StateManager.js' );
const ValidationManager = require( '../../../resources/ext.layers.editor/ValidationManager.js' );
const CanvasManager = require( '../../../resources/ext.layers.editor/CanvasManager.js' );
const StyleController = require( '../../../resources/ext.layers.editor/StyleController.js' );
const TextRenderer = require( '../../../resources/ext.layers.shared/TextRenderer.js' );
require( '../../../resources/ext.layers.editor/LayersEditor.js' );
require( '../../../resources/ext.layers.editor/ui/PropertyBuilders.js' );

describe( 'Text style preservation', () => {
	let editor;
	let canvasManager;
	let context;

	beforeEach( () => {
		jest.useFakeTimers();
		editor = Object.create( window.Layers.Core.Editor.prototype );
		editor.stateManager = new StateManager( editor );
		editor.validationManager = new ValidationManager( editor );
		editor.markDirty = jest.fn();
		editor.saveState = jest.fn();
		canvasManager = Object.create( CanvasManager.prototype );
		canvasManager.editor = editor;
		canvasManager.styleController = new StyleController( editor );
		canvasManager.getSelectedLayerIds = () => editor.stateManager.get( 'selectedLayerIds' );
		canvasManager.renderLayers = jest.fn();
		canvasManager.redraw = jest.fn();
		editor.canvasManager = canvasManager;
		context = {
			save: jest.fn(), restore: jest.fn(), translate: jest.fn(), rotate: jest.fn(),
			measureText: () => ( { width: 100 } ), fillText: jest.fn(), strokeText: jest.fn()
		};
	} );

	afterEach( () => {
		editor.stateManager.destroy();
		jest.clearAllTimers();
		jest.useRealTimers();
	} );

	test.each( [
		[ 'green color fallback', { color: '#11a261' }, '#11a261' ],
		[ 'red color fallback', { color: '#d22b2b' }, '#d22b2b' ],
		[ 'explicit fill and font', {
			color: '#11a261', fill: '#2367e0', fontFamily: 'Georgia'
		}, '#2367e0' ],
		[ 'transparent fill', { color: '#11a261', fill: 'transparent' }, 'transparent' ]
	] )( 'Font Size preserves %s through state and rendering', ( name, style, expectedColor ) => {
		const original = {
			id: 'existing-text', type: 'text', text: 'Acceptance text',
			x: 80, y: 60, fontSize: 32, ...style
		};
		const sibling = {
			id: 'selected-shape', type: 'rectangle', x: 4, y: 5,
			width: 30, height: 40, stroke: '#9225a9', strokeWidth: 7, fill: '#facc15'
		};
		editor.stateManager.set( 'layers', [ original, { ...sibling } ] );
		editor.stateManager.set( 'selectedLayerIds', [ original.id, sibling.id ] );
		const addInput = jest.fn();
		window.Layers.UI.PropertyBuilders.addSimpleTextProperties( {
			layer: original, editor, addInput, addColorPicker: jest.fn()
		} );
		const fontSize = addInput.mock.calls.find( ( call ) => call[ 0 ].prop === 'fontSize' )[ 0 ];

		new TextRenderer( context ).draw( original );
		expect( context.fillStyle ).toBe( expectedColor );
		fontSize.onChange( '36' );
		const edited = editor.getLayerById( original.id );
		new TextRenderer( context ).draw( edited );

		expect( context.fillStyle ).toBe( expectedColor );
		expect( edited ).toStrictEqual( { ...original, fontSize: 36 } );
		expect( editor.getLayerById( sibling.id ) ).toStrictEqual( sibling );
		expect( original.fontSize ).toBe( 32 );
		expect( canvasManager.currentStyle.fontSize ).toBe( 36 );
		expect( canvasManager.currentStyle.color ).toBe( '#000000' );
		expect( canvasManager.currentStyle.fontFamily ).toBe( 'Arial, sans-serif' );
		expect( editor.markDirty ).toHaveBeenCalled();
	} );

	test( 'explicit color changes still apply without adding a default font', () => {
		const original = { id: 'text', type: 'text', text: 'Color', color: '#11a261' };
		editor.stateManager.set( 'layers', [ { ...original } ] );
		editor.stateManager.set( 'selectedLayerIds', [ original.id ] );
		canvasManager.updateStyleOptions( { color: '#2367e0' } );
		const edited = editor.getLayerById( original.id );
		new TextRenderer( context ).draw( edited );
		expect( context.fillStyle ).toBe( '#2367e0' );
		expect( edited ).toStrictEqual( { ...original, fill: '#2367e0' } );
	} );
} );
