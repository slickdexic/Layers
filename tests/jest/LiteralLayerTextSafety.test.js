'use strict';

const ValidationManager = require( '../../resources/ext.layers.editor/ValidationManager.js' );
require( '../../resources/ext.layers.editor/canvas/RichTextConverter.js' );
require( '../../resources/ext.layers.editor/LayersEditor.js' );

describe( 'literal layer text', () => {
	it( 'keeps plain and rich text unchanged in a real editor layer update', () => {
		const editor = Object.create( window.Layers.Core.Editor.prototype );
		let layers = [ { id: 'one', type: 'text', text: 'Before' } ];
		editor.stateManager = { get: key => key === 'layers' ? layers : undefined,
			set: ( key, value ) => { if ( key === 'layers' ) { layers = value; } } };
		editor.validationManager = new ValidationManager( editor );
		editor.markDirty = jest.fn();
		editor.saveState = jest.fn();
		const text = 'a<b>c <button>';
		const richText = [ { text: ' <button> ' } ];
		editor.updateLayer( 'one', { text, richText } );
		expect( layers[ 0 ].text ).toBe( text );
		expect( layers[ 0 ].richText ).toEqual( richText );
		clearTimeout( editor._updateLayerSaveTimer );
	} );

	it( 'renders markup-looking plain and rich text without creating elements', () => {
		const converter = window.Layers.Canvas.RichTextConverter;
		const text = '<button><img src=x onerror=alert(1)><script>evil()</script>';
		const panel = document.createElement( 'div' );
		panel.innerHTML = converter.richTextToHtml( [ { text } ] );
		expect( panel.textContent ).toBe( text );
		expect( panel.querySelector( 'button, img, script' ) ).toBeNull();
	} );
} );
