/**
 * Tests for ToolDropdown component
 * resources/ext.layers.editor/ui/ToolDropdown.js
 */

'use strict';

// Mock localStorage
const localStorageMock = ( function () {
	let store = {};
	return {
		getItem: jest.fn( ( key ) => store[ key ] || null ),
		setItem: jest.fn( ( key, value ) => {
			store[ key ] = value.toString();
		} ),
		clear: jest.fn( () => {
			store = {};
		} ),
		removeItem: jest.fn( ( key ) => {
			delete store[ key ];
		} )
	};
}() );

Object.defineProperty( window, 'localStorage', {
	value: localStorageMock
} );

// Load the ToolDropdown module
require( '../../resources/ext.layers.editor/ui/ToolDropdown.js' );

describe( 'ToolDropdown', () => {
	let ToolDropdown;
	let mockTools;
	let mockOnToolSelect;

	beforeEach( () => {
		ToolDropdown = window.ToolDropdown;
		localStorageMock.clear();
		jest.clearAllMocks();

		// Sample tool definitions
		mockTools = [
			{ id: 'rectangle', icon: '<svg>R</svg>', title: 'Rectangle', key: 'R' },
			{ id: 'circle', icon: '<svg>C</svg>', title: 'Circle', key: 'C' },
			{ id: 'ellipse', icon: '<svg>E</svg>', title: 'Ellipse', key: 'E' }
		];

		mockOnToolSelect = jest.fn();
	} );

	afterEach( () => {
		// Clean up any open dropdowns
		document.body.innerHTML = '';
	} );

	describe( 'constructor', () => {
		test( 'should initialize with provided config', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				groupLabel: 'Shape Tools',
				tools: mockTools,
				defaultTool: 'circle',
				onToolSelect: mockOnToolSelect
			} );

			expect( dropdown.groupId ).toBe( 'shapes' );
			expect( dropdown.groupLabel ).toBe( 'Shape Tools' );
			expect( dropdown.tools ).toEqual( mockTools );
			expect( dropdown.currentToolId ).toBe( 'circle' );
		} );

		test( 'should default to first tool if no default specified', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			expect( dropdown.currentToolId ).toBe( 'rectangle' );
		} );

		test( 'should load MRU from localStorage', () => {
			localStorage.setItem( 'layers-mru-shapes', 'ellipse' );

			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				defaultTool: 'rectangle',
				onToolSelect: mockOnToolSelect
			} );

			expect( dropdown.currentToolId ).toBe( 'ellipse' );
		} );

		test( 'should ignore invalid MRU from localStorage', () => {
			localStorage.setItem( 'layers-mru-shapes', 'invalid-tool' );

			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				defaultTool: 'rectangle',
				onToolSelect: mockOnToolSelect
			} );

			expect( dropdown.currentToolId ).toBe( 'rectangle' );
		} );
	} );

	describe( 'create', () => {
		test( 'should create dropdown container with correct structure', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();

			expect( container.className ).toBe( 'tool-dropdown' );
			expect( container.dataset.groupId ).toBe( 'shapes' );
			expect( container.querySelector( '.tool-dropdown-trigger' ) ).toBeTruthy();
			expect( container.querySelector( '.tool-dropdown-menu' ) ).toBeTruthy();
		} );

		test( 'should create menu items for all tools', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const items = container.querySelectorAll( '.tool-dropdown-item' );

			expect( items.length ).toBe( 3 );
			expect( items[ 0 ].dataset.tool ).toBe( 'rectangle' );
			expect( items[ 1 ].dataset.tool ).toBe( 'circle' );
			expect( items[ 2 ].dataset.tool ).toBe( 'ellipse' );
		} );

		test( 'should show keyboard shortcuts in menu items', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const shortcuts = container.querySelectorAll( '.tool-dropdown-shortcut' );

			expect( shortcuts.length ).toBe( 3 );
			expect( shortcuts[ 0 ].textContent ).toBe( 'R' );
			expect( shortcuts[ 1 ].textContent ).toBe( 'C' );
			expect( shortcuts[ 2 ].textContent ).toBe( 'E' );
		} );

		test( 'should mark current tool in menu', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				defaultTool: 'circle',
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const currentItem = container.querySelector( '.tool-dropdown-item.current' );

			expect( currentItem.dataset.tool ).toBe( 'circle' );
		} );

		test( 'should have dropdown arrow indicator', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const arrow = container.querySelector( '.tool-dropdown-arrow' );

			expect( arrow ).toBeTruthy();
			expect( arrow.querySelector( 'svg' ) ).toBeTruthy();
		} );
	} );

	describe( 'open/close', () => {
		test( 'should open dropdown menu on click', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			const trigger = container.querySelector( '.tool-dropdown-trigger' );
			trigger.click();

			expect( dropdown.isOpen ).toBe( true );
			expect( container.querySelector( '.tool-dropdown-menu.open' ) ).toBeTruthy();
			expect( trigger.getAttribute( 'aria-expanded' ) ).toBe( 'true' );
		} );

		test( 'should close dropdown on second click', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			const trigger = container.querySelector( '.tool-dropdown-trigger' );
			trigger.click(); // open
			trigger.click(); // close

			expect( dropdown.isOpen ).toBe( false );
			expect( container.querySelector( '.tool-dropdown-menu.open' ) ).toBeFalsy();
			expect( trigger.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
		} );

		test( 'should close dropdown when clicking outside', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			const trigger = container.querySelector( '.tool-dropdown-trigger' );
			trigger.click(); // open

			expect( dropdown.isOpen ).toBe( true );

			// Click outside
			document.body.click();

			expect( dropdown.isOpen ).toBe( false );
		} );

		test( 'should close other dropdowns when opening a new one', () => {
			const dropdown1 = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const dropdown2 = new ToolDropdown( {
				groupId: 'lines',
				tools: [
					{ id: 'arrow', icon: '<svg>A</svg>', title: 'Arrow', key: 'A' },
					{ id: 'line', icon: '<svg>L</svg>', title: 'Line', key: 'L' }
				],
				onToolSelect: mockOnToolSelect
			} );

			const container1 = dropdown1.create();
			const container2 = dropdown2.create();
			document.body.appendChild( container1 );
			document.body.appendChild( container2 );

			// Open first dropdown
			container1.querySelector( '.tool-dropdown-trigger' ).click();
			expect( dropdown1.isOpen ).toBe( true );
			expect( dropdown2.isOpen ).toBe( false );

			// Open second dropdown - first should close
			container2.querySelector( '.tool-dropdown-trigger' ).click();
			expect( dropdown1.isOpen ).toBe( false );
			expect( dropdown2.isOpen ).toBe( true );

			// Clean up
			dropdown1.destroy();
			dropdown2.destroy();
		} );

		test( 'should close all other dropdowns when opening third', () => {
			const dropdown1 = new ToolDropdown( {
				groupId: 'text',
				tools: [
					{ id: 'text', icon: '<svg>T</svg>', title: 'Text', key: 'T' }
				],
				onToolSelect: mockOnToolSelect
			} );

			const dropdown2 = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const dropdown3 = new ToolDropdown( {
				groupId: 'lines',
				tools: [
					{ id: 'arrow', icon: '<svg>A</svg>', title: 'Arrow', key: 'A' }
				],
				onToolSelect: mockOnToolSelect
			} );

			const container1 = dropdown1.create();
			const container2 = dropdown2.create();
			const container3 = dropdown3.create();
			document.body.appendChild( container1 );
			document.body.appendChild( container2 );
			document.body.appendChild( container3 );

			// Open first
			dropdown1.open();
			expect( dropdown1.isOpen ).toBe( true );

			// Open second - first closes
			dropdown2.open();
			expect( dropdown1.isOpen ).toBe( false );
			expect( dropdown2.isOpen ).toBe( true );

			// Open third - second closes
			dropdown3.open();
			expect( dropdown1.isOpen ).toBe( false );
			expect( dropdown2.isOpen ).toBe( false );
			expect( dropdown3.isOpen ).toBe( true );

			// Clean up
			dropdown1.destroy();
			dropdown2.destroy();
			dropdown3.destroy();
		} );
	} );

	describe( 'tool selection', () => {
		test( 'should select tool and call callback', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.selectTool( 'ellipse' );

			expect( dropdown.currentToolId ).toBe( 'ellipse' );
			expect( mockOnToolSelect ).toHaveBeenCalledWith( 'ellipse', 'shapes' );
		} );

		test( 'should update MRU in localStorage', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			dropdown.create();
			dropdown.selectTool( 'circle' );

			expect( localStorage.setItem ).toHaveBeenCalledWith( 'layers-mru-shapes', 'circle' );
		} );

		test( 'should update trigger button icon', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				defaultTool: 'rectangle',
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();

			// Initially shows rectangle
			expect( container.querySelector( '.tool-dropdown-trigger' ).dataset.tool ).toBe( 'rectangle' );

			dropdown.selectTool( 'ellipse' );

			// Now shows ellipse
			expect( container.querySelector( '.tool-dropdown-trigger' ).dataset.tool ).toBe( 'ellipse' );
		} );

		test( 'should update current marker in menu', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				defaultTool: 'rectangle',
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();

			dropdown.selectTool( 'circle' );

			const currentItems = container.querySelectorAll( '.tool-dropdown-item.current' );
			expect( currentItems.length ).toBe( 1 );
			expect( currentItems[ 0 ].dataset.tool ).toBe( 'circle' );
		} );

		test( 'should close dropdown on item click', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			// Open dropdown
			container.querySelector( '.tool-dropdown-trigger' ).click();
			expect( dropdown.isOpen ).toBe( true );

			// Click on an item
			container.querySelectorAll( '.tool-dropdown-item' )[ 2 ].click();

			expect( dropdown.isOpen ).toBe( false );
			expect( mockOnToolSelect ).toHaveBeenCalledWith( 'ellipse', 'shapes' );
		} );

		test( 'should not close dropdown when fromKeyboard is true', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.open();
			dropdown.selectTool( 'circle', true ); // fromKeyboard = true

			expect( dropdown.isOpen ).toBe( true );
		} );

		test( 'should not call callback when skipCallback is true', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			dropdown.create();
			dropdown.selectTool( 'circle', false, true ); // skipCallback = true

			expect( dropdown.currentToolId ).toBe( 'circle' );
			expect( mockOnToolSelect ).not.toHaveBeenCalled();
		} );

		test( 'should ignore invalid tool ID', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				defaultTool: 'rectangle',
				onToolSelect: mockOnToolSelect
			} );

			dropdown.create();
			dropdown.selectTool( 'invalid' );

			expect( dropdown.currentToolId ).toBe( 'rectangle' );
			expect( mockOnToolSelect ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'keyboard navigation', () => {
		test( 'should close on Escape', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.open();

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( dropdown.isOpen ).toBe( false );
		} );

		test( 'should navigate with ArrowDown', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.open();

			const items = container.querySelectorAll( '.tool-dropdown-item' );
			items[ 0 ].focus();

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowDown' } );
			document.dispatchEvent( event );

			expect( document.activeElement ).toBe( items[ 1 ] );
		} );

		test( 'should navigate with ArrowUp', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.open();

			const items = container.querySelectorAll( '.tool-dropdown-item' );
			items[ 1 ].focus();

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowUp' } );
			document.dispatchEvent( event );

			expect( document.activeElement ).toBe( items[ 0 ] );
		} );

		test( 'should wrap around at bottom', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.open();

			const items = container.querySelectorAll( '.tool-dropdown-item' );
			items[ 2 ].focus(); // last item

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowDown' } );
			document.dispatchEvent( event );

			expect( document.activeElement ).toBe( items[ 0 ] );
		} );

		test( 'should wrap around at top', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.open();

			const items = container.querySelectorAll( '.tool-dropdown-item' );
			items[ 0 ].focus(); // first item

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowUp' } );
			document.dispatchEvent( event );

			expect( document.activeElement ).toBe( items[ 2 ] );
		} );

		test( 'should jump to first with Home', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.open();

			const items = container.querySelectorAll( '.tool-dropdown-item' );
			items[ 2 ].focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Home' } );
			document.dispatchEvent( event );

			expect( document.activeElement ).toBe( items[ 0 ] );
		} );

		test( 'should jump to last with End', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.open();

			const items = container.querySelectorAll( '.tool-dropdown-item' );
			items[ 0 ].focus();

			const event = new KeyboardEvent( 'keydown', { key: 'End' } );
			document.dispatchEvent( event );

			expect( document.activeElement ).toBe( items[ 2 ] );
		} );
	} );

	describe( 'hasTool', () => {
		test( 'should return true for tools in the dropdown', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			expect( dropdown.hasTool( 'rectangle' ) ).toBe( true );
			expect( dropdown.hasTool( 'circle' ) ).toBe( true );
			expect( dropdown.hasTool( 'ellipse' ) ).toBe( true );
		} );

		test( 'should return false for tools not in the dropdown', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			expect( dropdown.hasTool( 'arrow' ) ).toBe( false );
			expect( dropdown.hasTool( 'text' ) ).toBe( false );
		} );
	} );

	describe( 'setActive', () => {
		test( 'should add active class to trigger', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const trigger = container.querySelector( '.tool-dropdown-trigger' );

			dropdown.setActive( true );

			expect( trigger.classList.contains( 'active' ) ).toBe( true );
			expect( trigger.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		} );

		test( 'should remove active class from trigger', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const trigger = container.querySelector( '.tool-dropdown-trigger' );

			dropdown.setActive( true );
			dropdown.setActive( false );

			expect( trigger.classList.contains( 'active' ) ).toBe( false );
			expect( trigger.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		} );
	} );

	describe( 'destroy', () => {
		test( 'should close dropdown and remove listeners', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			document.body.appendChild( container );

			dropdown.open();
			expect( dropdown.isOpen ).toBe( true );

			dropdown.destroy();
			expect( dropdown.isOpen ).toBe( false );
		} );
	} );

	describe( 'accessibility', () => {
		test( 'should have proper ARIA attributes on trigger', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				groupLabel: 'Shape Tools',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const trigger = container.querySelector( '.tool-dropdown-trigger' );

			expect( trigger.getAttribute( 'aria-haspopup' ) ).toBe( 'true' );
			expect( trigger.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
			expect( trigger.getAttribute( 'type' ) ).toBe( 'button' );
		} );

		test( 'should have proper ARIA attributes on menu', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				groupLabel: 'Shape Tools',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const menu = container.querySelector( '.tool-dropdown-menu' );

			expect( menu.getAttribute( 'role' ) ).toBe( 'menu' );
			expect( menu.getAttribute( 'aria-label' ) ).toBe( 'Shape Tools' );
		} );

		test( 'should have proper ARIA attributes on items', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const items = container.querySelectorAll( '.tool-dropdown-item' );

			items.forEach( ( item ) => {
				expect( item.getAttribute( 'role' ) ).toBe( 'menuitem' );
			} );

			// Current item should have aria-current
			const currentItem = container.querySelector( '.tool-dropdown-item.current' );
			expect( currentItem.getAttribute( 'aria-current' ) ).toBe( 'true' );
		} );

		test( 'should expose keyboard shortcut via aria-keyshortcuts', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				defaultTool: 'rectangle',
				onToolSelect: mockOnToolSelect
			} );

			const container = dropdown.create();
			const trigger = container.querySelector( '.tool-dropdown-trigger' );

			expect( trigger.getAttribute( 'aria-keyshortcuts' ) ).toBe( 'R' );
		} );

		test( 'should handle Tab key to close dropdown', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			dropdown.create();
			dropdown.open();
			expect( dropdown.isOpen ).toBe( true );

			const event = new KeyboardEvent( 'keydown', { key: 'Tab' } );
			document.dispatchEvent( event );

			expect( dropdown.isOpen ).toBe( false );
		} );

		test( 'should ignore keydown events when closed', () => {
			const dropdown = new ToolDropdown( {
				groupId: 'shapes',
				tools: mockTools,
				onToolSelect: mockOnToolSelect
			} );

			dropdown.create();
			// Don't open the dropdown
			expect( dropdown.isOpen ).toBe( false );

			// Dispatch a keydown - should be ignored since dropdown is closed
			const event = new KeyboardEvent( 'keydown', { key: 'ArrowDown' } );
			document.dispatchEvent( event );

			// Dropdown should still be closed
			expect( dropdown.isOpen ).toBe( false );
		} );
	} );
} );
