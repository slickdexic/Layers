/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests for ContextMenuController
 *
 * Tests right-click context menu functionality for layers
 */

'use strict';

describe( 'ContextMenuController', () => {
	let ContextMenuController;
	let controller;
	let mockEditor;
	let mockCallbacks;
	let mockLayers;

	/**
	 * Helper to create a mock event with a DOM element target
	 *
	 * @param {string} layerId Layer ID to attach to the target element
	 * @param {number} clientX X position
	 * @param {number} clientY Y position
	 * @return {Object} Mock event object
	 */
	function createMockEvent( layerId, clientX = 100, clientY = 200 ) {
		// Create a layer item element in the DOM
		const layerItem = document.createElement( 'div' );
		layerItem.className = 'layer-item';
		layerItem.dataset.layerId = layerId;
		document.body.appendChild( layerItem );

		return {
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
			clientX,
			clientY,
			target: layerItem
		};
	}

	beforeEach( () => {
		// Set up mock layers
		mockLayers = [
			{ id: 'layer1', type: 'rectangle', name: 'Layer 1', visible: true },
			{ id: 'layer2', type: 'circle', name: 'Layer 2', visible: true },
			{ id: 'folder1', type: 'group', name: 'Folder 1', visible: true, children: [ 'layer3' ] },
			{ id: 'layer3', type: 'text', name: 'Layer 3', visible: true, parentGroup: 'folder1' }
		];

		// Setup window globals
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};

		// Mock mw object
		global.mw = {
			log: Object.assign( jest.fn(), {
				error: jest.fn(),
				warn: jest.fn()
			} ),
			config: {
				get: jest.fn( () => false )
			},
			notify: jest.fn()
		};

		// Create mock editor
		mockEditor = {
			stateManager: {
				get: jest.fn( ( key ) => {
					if ( key === 'layers' ) {
						return mockLayers;
					}
					if ( key === 'selectedLayerIds' ) {
						return [];
					}
					return null;
				} ),
				set: jest.fn()
			},
			getLayerById: jest.fn( ( id ) => mockLayers.find( ( l ) => l.id === id ) ),
			removeLayer: jest.fn(),
			saveState: jest.fn(),
			duplicateSelected: jest.fn( () => ( { id: 'duplicated-layer' } ) ),
			layers: mockLayers
		};

		// Create mock callbacks
		mockCallbacks = {
			msg: jest.fn( ( key, fallback ) => {
				// Extract the label text from the fallback (e.g., "Group (Ctrl+G)" -> "Group")
				const match = fallback.match( /^([^(]+)/ );
				return match ? match[ 1 ].trim() : fallback;
			} ),
			getSelectedLayerIds: jest.fn( () => [] ),
			selectLayer: jest.fn(),
			createGroupFromSelection: jest.fn(),
			ungroupLayer: jest.fn(),
			deleteLayer: jest.fn(),
			editLayerName: jest.fn()
		};

		// Reset DOM and module cache
		document.body.innerHTML = '';
		jest.resetModules();

		ContextMenuController = require( '../../resources/ext.layers.editor/ui/ContextMenuController.js' );

		controller = new ContextMenuController( {
			editor: mockEditor,
			msg: mockCallbacks.msg,
			getSelectedLayerIds: mockCallbacks.getSelectedLayerIds,
			selectLayer: mockCallbacks.selectLayer,
			createGroupFromSelection: mockCallbacks.createGroupFromSelection,
			ungroupLayer: mockCallbacks.ungroupLayer,
			deleteLayer: mockCallbacks.deleteLayer,
			editLayerName: mockCallbacks.editLayerName
		} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete global.mw;
		document.body.innerHTML = '';
	} );

	describe( 'constructor', () => {
		it( 'should store editor reference', () => {
			expect( controller.editor ).toBe( mockEditor );
		} );

		it( 'should store callback functions', () => {
			expect( typeof controller.msg ).toBe( 'function' );
			expect( typeof controller.getSelectedLayerIds ).toBe( 'function' );
			expect( typeof controller.selectLayer ).toBe( 'function' );
		} );

		it( 'should initialize activeContextMenu to null', () => {
			expect( controller.activeContextMenu ).toBeNull();
		} );
	} );

	describe( 'handleLayerContextMenu', () => {
		it( 'should prevent default event behavior', () => {
			const mockEvent = createMockEvent( 'layer1' );

			controller.handleLayerContextMenu( mockEvent );

			expect( mockEvent.preventDefault ).toHaveBeenCalled();
		} );

		it( 'should create context menu element', () => {
			const mockEvent = createMockEvent( 'layer1' );

			controller.handleLayerContextMenu( mockEvent );

			expect( document.querySelector( '.layers-context-menu' ) ).toBeTruthy();
		} );

		it( 'should position menu at click coordinates', () => {
			const mockEvent = createMockEvent( 'layer1', 100, 200 );

			controller.handleLayerContextMenu( mockEvent );

			const menu = document.querySelector( '.layers-context-menu' );
			expect( menu.style.left ).toBe( '100px' );
			expect( menu.style.top ).toBe( '200px' );
		} );

		it( 'should include group action for non-group layers', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			const mockEvent = createMockEvent( 'layer1' );

			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			const menuTexts = Array.from( menuItems ).map( ( el ) => el.textContent );
			expect( menuTexts.some( ( text ) => text.includes( 'Group' ) ) ).toBe( true );
		} );

		it( 'should include ungroup action for group layers', () => {
			const mockEvent = createMockEvent( 'folder1' );

			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			const menuTexts = Array.from( menuItems ).map( ( el ) => el.textContent );
			expect( menuTexts.some( ( text ) => text.includes( 'Ungroup' ) ) ).toBe( true );
		} );

		it( 'should include rename action', () => {
			const mockEvent = createMockEvent( 'layer1' );

			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			const menuTexts = Array.from( menuItems ).map( ( el ) => el.textContent );
			expect( menuTexts.some( ( text ) => text.includes( 'Rename' ) ) ).toBe( true );
		} );

		it( 'should include duplicate action', () => {
			const mockEvent = createMockEvent( 'layer1' );

			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			const menuTexts = Array.from( menuItems ).map( ( el ) => el.textContent );
			expect( menuTexts.some( ( text ) => text.includes( 'Duplicate' ) ) ).toBe( true );
		} );

		it( 'should include delete action', () => {
			const mockEvent = createMockEvent( 'layer1' );

			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			const menuTexts = Array.from( menuItems ).map( ( el ) => el.textContent );
			expect( menuTexts.some( ( text ) => text.includes( 'Delete' ) ) ).toBe( true );
		} );

		it( 'should have accessible role=menu attribute', () => {
			const mockEvent = createMockEvent( 'layer1' );

			controller.handleLayerContextMenu( mockEvent );

			const menu = document.querySelector( '.layers-context-menu' );
			expect( menu.getAttribute( 'role' ) ).toBe( 'menu' );
		} );

		it( 'should close any existing context menu before opening new one', () => {
			const mockEvent1 = createMockEvent( 'layer1' );
			const mockEvent2 = createMockEvent( 'layer2' );

			controller.handleLayerContextMenu( mockEvent1 );
			controller.handleLayerContextMenu( mockEvent2 );

			const menus = document.querySelectorAll( '.layers-context-menu' );
			expect( menus.length ).toBe( 1 );
		} );

		it( 'should select the layer when context menu is opened', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [] );
			const mockEvent = createMockEvent( 'layer1' );

			controller.handleLayerContextMenu( mockEvent );

			expect( mockCallbacks.selectLayer ).toHaveBeenCalledWith( 'layer1', false, false );
		} );
	} );

	describe( 'closeLayerContextMenu', () => {
		it( 'should remove context menu from DOM', () => {
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );
			expect( document.querySelector( '.layers-context-menu' ) ).toBeTruthy();

			controller.closeLayerContextMenu();

			expect( document.querySelector( '.layers-context-menu' ) ).toBeFalsy();
		} );

		it( 'should set activeContextMenu to null', () => {
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );

			controller.closeLayerContextMenu();

			expect( controller.activeContextMenu ).toBeNull();
		} );

		it( 'should not throw when no menu exists', () => {
			expect( () => controller.closeLayerContextMenu() ).not.toThrow();
		} );
	} );

	describe( 'menu actions', () => {
		it( 'should call createGroupFromSelection when group action clicked', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			const groupItem = Array.from( menuItems ).find( ( el ) => el.textContent.includes( 'Group' ) && !el.textContent.includes( 'Ungroup' ) );
			groupItem.click();

			expect( mockCallbacks.createGroupFromSelection ).toHaveBeenCalled();
		} );

		it( 'should call ungroupLayer when ungroup action clicked', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [ 'folder1' ] );
			const mockEvent = createMockEvent( 'folder1' );
			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			const ungroupItem = Array.from( menuItems ).find( ( el ) => el.textContent.includes( 'Ungroup' ) );
			ungroupItem.click();

			expect( mockCallbacks.ungroupLayer ).toHaveBeenCalledWith( 'folder1' );
		} );

		it( 'should call deleteLayer when delete action clicked', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [ 'layer1' ] );
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			const deleteItem = Array.from( menuItems ).find( ( el ) => el.textContent.includes( 'Delete' ) );
			deleteItem.click();

			expect( mockCallbacks.deleteLayer ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should close menu after action is clicked', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [ 'layer1' ] );
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			const deleteItem = Array.from( menuItems ).find( ( el ) => el.textContent.includes( 'Delete' ) );
			deleteItem.click();

			expect( document.querySelector( '.layers-context-menu' ) ).toBeFalsy();
		} );
	} );

	describe( 'menu keyboard accessibility', () => {
		it( 'should have menuitem role on items', () => {
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );

			const menuItems = document.querySelectorAll( '.layers-context-menu-item' );
			menuItems.forEach( ( item ) => {
				expect( item.getAttribute( 'role' ) ).toBe( 'menuitem' );
			} );
		} );
	} );

	describe( 'outside click handling', () => {
		it( 'should close menu when clicking outside after timeout', ( done ) => {
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );
			expect( document.querySelector( '.layers-context-menu' ) ).toBeTruthy();

			// Need to wait for the setTimeout(0) in the controller
			setTimeout( () => {
				// Simulate click outside
				document.body.click();

				expect( document.querySelector( '.layers-context-menu' ) ).toBeFalsy();
				done();
			}, 10 );
		} );

		it( 'should not close menu when clicking inside', ( done ) => {
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );
			const menu = document.querySelector( '.layers-context-menu' );
			expect( menu ).toBeTruthy();

			// Need to wait for the setTimeout(0) in the controller
			setTimeout( () => {
				// Click inside menu should not close it
				menu.click();
				expect( document.querySelector( '.layers-context-menu' ) ).toBeTruthy();
				done();
			}, 10 );
		} );
	} );

	describe( 'escape key handling', () => {
		it( 'should close menu when Escape key is pressed', () => {
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );
			expect( document.querySelector( '.layers-context-menu' ) ).toBeTruthy();

			// Simulate Escape key press
			const escapeEvent = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( escapeEvent );

			expect( document.querySelector( '.layers-context-menu' ) ).toBeFalsy();
		} );

		it( 'should not close menu on other key presses', () => {
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );
			expect( document.querySelector( '.layers-context-menu' ) ).toBeTruthy();

			// Simulate Enter key press
			const enterEvent = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			document.dispatchEvent( enterEvent );

			expect( document.querySelector( '.layers-context-menu' ) ).toBeTruthy();
		} );
	} );

	describe( 'menu item interactions', () => {
		it( 'should highlight menu item on mouseenter', () => {
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );

			const menu = document.querySelector( '.layers-context-menu' );
			const menuItems = menu.querySelectorAll( 'button' );
			const enabledItem = Array.from( menuItems ).find( ( btn ) => !btn.disabled );

			if ( enabledItem ) {
				const enterEvent = new Event( 'mouseenter' );
				enabledItem.dispatchEvent( enterEvent );

				expect( enabledItem.style.backgroundColor ).toBe( 'rgb(240, 240, 240)' );
			}
		} );

		it( 'should remove highlight on mouseleave', () => {
			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );

			const menu = document.querySelector( '.layers-context-menu' );
			const menuItems = menu.querySelectorAll( 'button' );
			const enabledItem = Array.from( menuItems ).find( ( btn ) => !btn.disabled );

			if ( enabledItem ) {
				enabledItem.dispatchEvent( new Event( 'mouseenter' ) );
				enabledItem.dispatchEvent( new Event( 'mouseleave' ) );

				expect( enabledItem.style.backgroundColor ).toBe( 'transparent' );
			}
		} );

		it( 'should call editLayerName when rename is clicked', () => {
			// Create layer item with name element
			const layerItem = document.createElement( 'div' );
			layerItem.className = 'layer-item';
			layerItem.dataset.layerId = 'layer1';
			const nameEl = document.createElement( 'span' );
			nameEl.className = 'layer-name';
			nameEl.focus = jest.fn();
			layerItem.appendChild( nameEl );
			document.body.appendChild( layerItem );

			const mockEvent = {
				preventDefault: jest.fn(),
				stopPropagation: jest.fn(),
				clientX: 100,
				clientY: 200,
				target: layerItem
			};

			controller.handleLayerContextMenu( mockEvent );

			const menu = document.querySelector( '.layers-context-menu' );
			const renameBtn = Array.from( menu.querySelectorAll( 'button' ) )
				.find( ( btn ) => btn.textContent.includes( 'Rename' ) );

			if ( renameBtn && !renameBtn.disabled ) {
				renameBtn.click();
				expect( mockCallbacks.editLayerName ).toHaveBeenCalledWith( 'layer1', nameEl );
			}
		} );

		it( 'should call editor.duplicateSelected when duplicate is clicked', () => {
			mockEditor.duplicateSelected = jest.fn();
			mockCallbacks.getSelectedLayerIds = jest.fn( () => [ 'layer1' ] );

			// Recreate controller with updated mock
			controller = new ContextMenuController( {
				editor: mockEditor,
				...mockCallbacks
			} );

			const mockEvent = createMockEvent( 'layer1' );
			controller.handleLayerContextMenu( mockEvent );

			const menu = document.querySelector( '.layers-context-menu' );
			const duplicateBtn = Array.from( menu.querySelectorAll( 'button' ) )
				.find( ( btn ) => btn.textContent.includes( 'Duplicate' ) );

			if ( duplicateBtn && !duplicateBtn.disabled ) {
				duplicateBtn.click();
				expect( mockEditor.duplicateSelected ).toHaveBeenCalled();
			}
		} );
	} );
} );
