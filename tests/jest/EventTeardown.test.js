const path = '../../resources/ext.layers.editor/';

describe('Event Listener Teardown', () => {
	let originalAdd;
	let originalRemove;
	let listenerMap = new Map();
	let count = () => listenerMap.size;

	beforeAll(() => {
		// Wrap addEventListener/removeEventListener to track listeners
		originalAdd = window.addEventListener;
		originalRemove = window.removeEventListener;

		window.addEventListener = function ( type, listener, opts ) {
			const key = type + '|' + ( listener && listener.toString ? listener.toString() : String( listener ) );
			listenerMap.set( key, ( listenerMap.get( key ) || 0 ) + 1 );
			return originalAdd.call( window, type, listener, opts );
		};

		window.removeEventListener = function ( type, listener, opts ) {
			const key = type + '|' + ( listener && listener.toString ? listener.toString() : String( listener ) );
			const val = ( listenerMap.get( key ) || 0 ) - 1;
			if ( val <= 0 ) {
				listenerMap.delete( key );
			} else {
				listenerMap.set( key, val );
			}
			return originalRemove.call( window, type, listener, opts );
		};
	});

	test('LayersEditor create/destroy does not grow window listeners', () => {
		require( path + 'LayersEditor.js' );
		const Editor = window.LayersEditor;
		// Baseline count
		const baseline = count();

		for ( let i = 0; i < 3; i++ ) {
			const container = document.createElement( 'div' );
			document.body.appendChild( container );
			const editor = new Editor( { filename: 'Test.jpg', container: container } );
			if ( typeof editor.destroy === 'function' ) {
				editor.destroy();
			} else {
				// If no destroy() is present, attempt to cleanup via UIManager/Toolbar
				if ( editor.uiManager && typeof editor.uiManager.destroy === 'function' ) {
					editor.uiManager.destroy();
				}
				if ( editor.canvasManager && typeof editor.canvasManager.destroy === 'function' ) {
					editor.canvasManager.destroy();
				}
			}
			if ( container.parentNode ) {
				container.parentNode.removeChild( container );
			}
		}

		const after = count();
		expect( after ).toBe( baseline );
	});

	afterAll(() => {
		// Restore
		window.addEventListener = originalAdd;
		window.removeEventListener = originalRemove;
	});
});
