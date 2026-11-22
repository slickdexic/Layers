const EditorFocusBoundary = require( '../../resources/ext.layers.editor/ui/EditorFocusBoundary.js' );

describe( 'editor keyboard boundary', () => {
	let boundary, root, wiki, origin;
	const tick = () => Promise.resolve();
	const tab = ( shiftKey = false ) => {
		const event = new KeyboardEvent( 'keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true } );
		document.activeElement.dispatchEvent( event ); return event;
	};
	const dialog = ( className = 'layers-test-dialog', role = 'dialog' ) => {
		const node = document.createElement( 'div' ); node.className = className;
		node.setAttribute( 'role', role );
		if ( role === 'dialog' ) { node.setAttribute( 'aria-modal', 'true' ); }
		node.innerHTML = '<button>First</button><button>Last</button>';
		document.body.appendChild( node ); node.firstChild.focus(); return node;
	};
	beforeEach( () => {
		jest.spyOn( HTMLElement.prototype, 'getClientRects' ).mockImplementation( function () {
			return this.closest( '[hidden]' ) || this.style.display === 'none' ? [] : [ { width: 20, height: 20 } ];
		} );
		document.body.innerHTML = '<main><button>Open</button></main><div class="layers-editor">' +
			'<a href="#canvas">Skip</a><button disabled>Disabled</button><button hidden>Hidden</button><button>Last</button></div>';
		wiki = document.querySelector( 'main' ); root = document.querySelector( '.layers-editor' ); origin = wiki.firstChild;
		origin.focus(); boundary = new EditorFocusBoundary( root );
	} );
	afterEach( () => { boundary.destroy(); document.body.innerHTML = ''; jest.restoreAllMocks(); } );
	test( 'isolates wiki content from keyboard and accessibility navigation', () => {
		expect( wiki.hasAttribute( 'inert' ) ).toBe( true );
		expect( wiki.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		expect( document.activeElement ).toBe( root );
	} );
	test( 'wraps both directions past hidden and disabled controls, preserving skip links', () => {
		root.lastChild.focus(); expect( tab().defaultPrevented ).toBe( true );
		expect( document.activeElement ).toBe( root.firstChild );
		expect( tab( true ).defaultPrevented ).toBe( true ); expect( document.activeElement ).toBe( root.lastChild );
	} );
	test( 'redirects programmatic background focus without changing browser shortcuts', () => {
		origin.focus(); expect( document.activeElement ).toBe( root.firstChild );
		const event = new KeyboardEvent( 'keydown', { key: 'Tab', ctrlKey: true, bubbles: true, cancelable: true } );
		document.activeElement.dispatchEvent( event ); expect( event.defaultPrevented ).toBe( false );
	} );
	test( 'admits a new body portal, traps its dialog and restores its invoking control', async () => {
		root.lastChild.focus(); const portal = dialog(); await tick();
		expect( portal.hasAttribute( 'inert' ) ).toBe( false );
		root.lastChild.focus(); expect( document.activeElement ).toBe( portal.firstChild );
		portal.lastChild.focus(); tab(); expect( document.activeElement ).toBe( portal.firstChild );
		tab( true ); expect( document.activeElement ).toBe( portal.lastChild );
		portal.remove(); await tick(); expect( document.activeElement ).toBe( root.lastChild );
	} );
	test( 'returns from nested dialogs through their original focus stack', async () => {
		root.lastChild.focus(); const outer = dialog(); await tick();
		outer.lastChild.focus(); const inner = dialog( 'layers-inner-dialog' ); await tick();
		inner.remove(); await tick(); expect( document.activeElement ).toBe( outer.lastChild );
		outer.remove(); await tick(); expect( document.activeElement ).toBe( root.lastChild );
	} );
	test( 'admits the existing colour picker whose class lacks the layers prefix', async () => {
		root.lastChild.focus(); const picker = dialog( 'color-picker-dialog' ); await tick();
		expect( picker.hasAttribute( 'inert' ) ).toBe( false );
		picker.lastChild.focus(); tab(); expect( document.activeElement ).toBe( picker.firstChild );
		picker.remove(); await tick(); expect( document.activeElement ).toBe( root.lastChild );
	} );
	test.each( [ 'EmojiPickerPanel', 'ShapeLibraryPanel' ] )(
		'%s wraps Tab in both directions and restores its opener on Escape and Close',
		async ( pickerName ) => {
			mw.message = key => ( { text: () => key } );
			window.Layers.EmojiLibrary = { getCategories: () => [] };
			window.Layers.ShapeLibrary = {
				getCategories: () => [], isCategoryLoaded: () => true, getShapesByCategory: () => []
			};
			require( '../../resources/ext.layers.editor/shapeLibrary/EmojiPickerPanel.js' );
			require( '../../resources/ext.layers.editor/shapeLibrary/ShapeLibraryPanel.js' );
			const picker = new window.Layers[ pickerName ]();
			const opener = root.lastChild;
			try {
				for ( const dismissal of [ 'Escape', 'Close' ] ) {
					// The toolbar module may finish loading after focus moves to another control.
					root.firstChild.focus();
					picker.open( opener );
					await tick();
					expect( document.activeElement ).toBe( picker.searchInput );
					const closeButton = picker.panel.querySelector( 'button' );
					closeButton.focus();
					expect( tab( true ).defaultPrevented ).toBe( true );
					expect( document.activeElement ).toBe( picker.searchInput );
					expect( tab().defaultPrevented ).toBe( true );
					expect( document.activeElement ).toBe( closeButton );
					if ( dismissal === 'Escape' ) {
						closeButton.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true } ) );
					} else {
						closeButton.click();
					}
					await tick();
					expect( picker.isOpen ).toBe( false );
					expect( document.activeElement ).toBe( opener );
				}
			} finally {
				picker.destroy();
			}
		}
	);
	test( 'keeps a body-mounted menu reachable and restores its origin', async () => {
		root.lastChild.focus(); const menu = dialog( 'layers-context-menu', 'menu' ); await tick();
		expect( document.activeElement ).toBe( menu.firstChild );
		menu.remove(); await tick(); expect( document.activeElement ).toBe( root.lastChild );
	} );
	test( 'isolates later wiki nodes but leaves live announcements usable', async () => {
		const late = document.createElement( 'aside' ); document.body.appendChild( late );
		const announcement = document.createElement( 'div' ); announcement.className = 'layers-live-region';
		announcement.setAttribute( 'aria-live', 'polite' ); document.body.appendChild( announcement ); await tick();
		expect( late.hasAttribute( 'inert' ) ).toBe( true ); expect( announcement.hasAttribute( 'inert' ) ).toBe( false );
	} );
	test( 'restores exact original attributes and removes listeners on close/reopen', () => {
		boundary.destroy(); wiki.setAttribute( 'inert', 'retained' ); wiki.setAttribute( 'aria-hidden', 'false' );
		boundary = new EditorFocusBoundary( root ); boundary.destroy();
		expect( wiki.getAttribute( 'inert' ) ).toBe( 'retained' ); expect( wiki.getAttribute( 'aria-hidden' ) ).toBe( 'false' );
		origin.focus(); expect( document.activeElement ).toBe( origin );
	} );
} );
