/**
 * Page history draws every layer type, so page-owned editors get the same tools as ordinary ones.
 */
'use strict';

describe( 'Toolbar in page-owned mode', () => {
	let Toolbar;
	let container;
	let toolbar;

	function editor( pageOwned ) {
		return {
			config: pageOwned ? { pageOwned: { owner: 'Owner_page', revisionId: 5, surfaceId: 's1' } } : {},
			canvasManager: { updateStyleOptions: jest.fn() },
			toolManager: { updateStyle: jest.fn() },
			stateManager: {
				get: jest.fn( ( key ) => ( key === 'layers' ? [] : null ) ),
				set: jest.fn(),
				subscribe: jest.fn( () => jest.fn() )
			},
			setCurrentTool: jest.fn(),
			save: jest.fn()
		};
	}

	beforeAll( () => {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.UI = window.Layers.UI || {};
		require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );
		global.mw = {
			config: { get: jest.fn( () => null ) },
			message: jest.fn( ( key ) => ( { text: () => key, exists: () => true } ) ),
			log: { warn: jest.fn(), error: jest.fn() }
		};
		window.ToolbarKeyboard = jest.fn( function ( ref ) {
			this.toolbar = ref;
			this.handleKeyboardShortcuts = jest.fn();
		} );
		Toolbar = require( '../../resources/ext.layers.editor/Toolbar.js' );
	} );

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
	} );

	afterEach( () => {
		if ( toolbar ) {
			toolbar.destroy();
			toolbar = null;
		}
		container.remove();
	} );

	it.each( [ false, true ] )( 'offers markers, shapes, emoji and image import (page-owned: %s)', ( pageOwned ) => {
		toolbar = new Toolbar( { container, editor: editor( pageOwned ) } );
		expect( container.querySelector( '[data-tool="marker"]' ) ).not.toBeNull();
		expect( container.querySelector( '[data-tool="dimension"]' ) ).not.toBeNull();
		expect( container.querySelector( '.import-image-button' ).hidden ).toBe( false );
		expect( container.querySelector( '.shape-library-button' ) ).not.toBeNull();
		expect( container.querySelector( '.emoji-picker-button' ) ).not.toBeNull();
		toolbar.selectTool( 'marker' );
		expect( toolbar.currentTool ).toBe( 'marker' );
	} );
} );
