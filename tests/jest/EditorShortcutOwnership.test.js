require( '../../resources/ext.layers.editor/EventManager.js' );
const EventManager = window.Layers.Core.EventManager;
const CanvasEvents = require( '../../resources/ext.layers.editor/CanvasEvents.js' );
const { ToolbarKeyboard } = require( '../../resources/ext.layers.editor/ToolbarKeyboard.js' );

test.each( [ 'dialog', 'alertdialog', 'menu' ] )( '%s keeps editor commands out of all global shortcut handlers', role => {
	const widget = document.createElement( 'div' ); widget.setAttribute( 'role', role );
	const target = document.createElement( 'button' ); widget.appendChild( target );
	const context = new Proxy( {}, { get() { throw new Error( 'A widget key reached editor command handling' ); } } );
	for ( const handle of [ EventManager.prototype.handleKeyDown, CanvasEvents.prototype.handleKeyDown,
		ToolbarKeyboard.prototype.handleKeyboardShortcuts ] ) {
		for ( const [ key, ctrlKey ] of [ [ 'Escape', false ], [ 'Delete', false ], [ 's', true ], [ 'x', true ], [ 'g', true ] ] ) {
			expect( () => handle.call( context, { key, ctrlKey, target } ) ).not.toThrow();
		}
	}
} );
