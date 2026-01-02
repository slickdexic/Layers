/**
 * PresetDropdown unit tests
 *
 * Tests for the preset dropdown UI component.
 */
'use strict';

const PresetDropdown = require( '../../../resources/ext.layers.editor/presets/PresetDropdown.js' );

describe( 'PresetDropdown', () => {
	let dropdown;
	let mockPresetManager;
	let mockOnSelect;
	let mockOnSave;
	let mockGetMessage;
	let mockUnsubscribe;

	beforeEach( () => {
		mockUnsubscribe = jest.fn();
		mockPresetManager = {
			subscribe: jest.fn( () => mockUnsubscribe ),
			isToolSupported: jest.fn( () => true ),
			getPresetsForTool: jest.fn( () => [] ),
			getDefaultPreset: jest.fn( () => null ),
			addPreset: jest.fn( ( tool, name, style ) => ( { id: 'new-1', name, style, tool } ) ),
			setDefaultPreset: jest.fn(),
			deletePreset: jest.fn()
		};
		mockOnSelect = jest.fn();
		mockOnSave = jest.fn();
		mockGetMessage = jest.fn( ( key ) => key );
	} );

	afterEach( () => {
		if ( dropdown ) {
			dropdown.destroy();
			dropdown = null;
		}
	} );

	describe( 'constructor', () => {
		it( 'should throw error without presetManager', () => {
			expect( () => {
				new PresetDropdown( {} );
			} ).toThrow( 'PresetDropdown requires presetManager option' );
		} );

		it( 'should throw error with null options', () => {
			expect( () => {
				new PresetDropdown( null );
			} ).toThrow();
		} );

		it( 'should create instance with required options', () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			expect( dropdown ).toBeInstanceOf( PresetDropdown );
		} );

		it( 'should store presetManager reference', () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			expect( dropdown.presetManager ).toBe( mockPresetManager );
		} );

		it( 'should use provided callbacks', () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				onSelect: mockOnSelect,
				onSave: mockOnSave,
				getMessage: mockGetMessage
			} );
			expect( dropdown.onSelect ).toBe( mockOnSelect );
			expect( dropdown.onSave ).toBe( mockOnSave );
			expect( dropdown.getMessage ).toBe( mockGetMessage );
		} );

		it( 'should use default callbacks when not provided', () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			expect( typeof dropdown.onSelect ).toBe( 'function' );
			expect( typeof dropdown.onSave ).toBe( 'function' );
			expect( typeof dropdown.getMessage ).toBe( 'function' );
		} );

		it( 'should initialize currentTool as null', () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			expect( dropdown.currentTool ).toBeNull();
		} );

		it( 'should initialize isOpen as false', () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			expect( dropdown.isOpen ).toBe( false );
		} );

		it( 'should subscribe to preset changes', () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			expect( mockPresetManager.subscribe ).toHaveBeenCalled();
		} );

		it( 'should append to container when provided', () => {
			const container = document.createElement( 'div' );
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				container: container
			} );
			expect( container.contains( dropdown.getElement() ) ).toBe( true );
		} );
	} );

	describe( 'buildUI', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				getMessage: mockGetMessage
			} );
		} );

		it( 'should create container element', () => {
			expect( dropdown.elements.container ).toBeInstanceOf( HTMLElement );
			expect( dropdown.elements.container.className ).toBe( 'layers-preset-dropdown' );
		} );

		it( 'should create button element', () => {
			expect( dropdown.elements.button ).toBeInstanceOf( HTMLButtonElement );
			expect( dropdown.elements.button.className ).toBe( 'layers-preset-button' );
		} );

		it( 'should set button ARIA attributes', () => {
			expect( dropdown.elements.button.getAttribute( 'aria-haspopup' ) ).toBe( 'listbox' );
			expect( dropdown.elements.button.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
		} );

		it( 'should create dropdown menu element', () => {
			expect( dropdown.elements.dropdown ).toBeInstanceOf( HTMLElement );
			expect( dropdown.elements.dropdown.className ).toBe( 'layers-preset-menu' );
		} );

		it( 'should set dropdown role', () => {
			expect( dropdown.elements.dropdown.getAttribute( 'role' ) ).toBe( 'listbox' );
		} );

		it( 'should hide dropdown by default', () => {
			expect( dropdown.elements.dropdown.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'getPresetIcon', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
		} );

		it( 'should return SVG markup', () => {
			const icon = dropdown.getPresetIcon();
			expect( icon ).toContain( '<svg' );
			expect( icon ).toContain( '</svg>' );
		} );

		it( 'should include viewBox attribute', () => {
			const icon = dropdown.getPresetIcon();
			expect( icon ).toContain( 'viewBox' );
		} );
	} );

	describe( 'setTool', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
		} );

		it( 'should update currentTool', () => {
			dropdown.setTool( 'rectangle' );
			expect( dropdown.currentTool ).toBe( 'rectangle' );
		} );

		it( 'should reset hasSelectedLayer to false', () => {
			dropdown.hasSelectedLayer = true;
			dropdown.setTool( 'arrow' );
			expect( dropdown.hasSelectedLayer ).toBe( false );
		} );

		it( 'should update button state', () => {
			mockPresetManager.isToolSupported.mockReturnValue( false );
			dropdown.setTool( 'unsupported' );
			expect( dropdown.elements.button.disabled ).toBe( true );
		} );
	} );

	describe( 'setLayerType', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
		} );

		it( 'should set currentTool when layerType provided', () => {
			dropdown.setLayerType( 'circle' );
			expect( dropdown.currentTool ).toBe( 'circle' );
		} );

		it( 'should set hasSelectedLayer to true when layerType provided', () => {
			dropdown.setLayerType( 'text' );
			expect( dropdown.hasSelectedLayer ).toBe( true );
		} );

		it( 'should set hasSelectedLayer to false when layerType is null', () => {
			dropdown.hasSelectedLayer = true;
			dropdown.setLayerType( null );
			expect( dropdown.hasSelectedLayer ).toBe( false );
		} );
	} );

	describe( 'updateButtonState', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				getMessage: mockGetMessage
			} );
			dropdown.currentTool = 'rectangle';
		} );

		it( 'should enable button for supported tool', () => {
			mockPresetManager.isToolSupported.mockReturnValue( true );
			dropdown.updateButtonState();
			expect( dropdown.elements.button.disabled ).toBe( false );
		} );

		it( 'should disable button for unsupported tool', () => {
			mockPresetManager.isToolSupported.mockReturnValue( false );
			dropdown.updateButtonState();
			expect( dropdown.elements.button.disabled ).toBe( true );
		} );

		it( 'should set appropriate tooltip', () => {
			mockPresetManager.isToolSupported.mockReturnValue( true );
			dropdown.updateButtonState();
			expect( dropdown.elements.button.title ).toBe( 'layers-presets-tooltip' );
		} );

		it( 'should set not-supported tooltip when disabled', () => {
			mockPresetManager.isToolSupported.mockReturnValue( false );
			dropdown.updateButtonState();
			expect( dropdown.elements.button.title ).toBe( 'layers-presets-not-supported' );
		} );
	} );

	describe( 'toggle', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			dropdown.currentTool = 'rectangle';
		} );

		it( 'should open when closed', () => {
			dropdown.isOpen = false;
			dropdown.toggle();
			expect( dropdown.isOpen ).toBe( true );
		} );

		it( 'should close when open', () => {
			dropdown.isOpen = true;
			dropdown.toggle();
			expect( dropdown.isOpen ).toBe( false );
		} );
	} );

	describe( 'open', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
		} );

		it( 'should not open without currentTool', () => {
			dropdown.currentTool = null;
			dropdown.open();
			expect( dropdown.isOpen ).toBe( false );
		} );

		it( 'should not open for unsupported tool', () => {
			dropdown.currentTool = 'unsupported';
			mockPresetManager.isToolSupported.mockReturnValue( false );
			dropdown.open();
			expect( dropdown.isOpen ).toBe( false );
		} );

		it( 'should open for supported tool', () => {
			dropdown.currentTool = 'rectangle';
			mockPresetManager.isToolSupported.mockReturnValue( true );
			dropdown.open();
			expect( dropdown.isOpen ).toBe( true );
		} );

		it( 'should show dropdown element', () => {
			dropdown.currentTool = 'rectangle';
			dropdown.open();
			expect( dropdown.elements.dropdown.style.display ).toBe( 'block' );
		} );

		it( 'should update aria-expanded', () => {
			dropdown.currentTool = 'rectangle';
			dropdown.open();
			expect( dropdown.elements.button.getAttribute( 'aria-expanded' ) ).toBe( 'true' );
		} );

		it( 'should call renderMenu', () => {
			dropdown.currentTool = 'rectangle';
			const spy = jest.spyOn( dropdown, 'renderMenu' );
			dropdown.open();
			expect( spy ).toHaveBeenCalled();
		} );
	} );

	describe( 'close', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			dropdown.currentTool = 'rectangle';
			dropdown.open();
		} );

		it( 'should set isOpen to false', () => {
			dropdown.close();
			expect( dropdown.isOpen ).toBe( false );
		} );

		it( 'should hide dropdown element', () => {
			dropdown.close();
			expect( dropdown.elements.dropdown.style.display ).toBe( 'none' );
		} );

		it( 'should update aria-expanded', () => {
			dropdown.close();
			expect( dropdown.elements.button.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
		} );
	} );

	describe( 'renderMenu', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				getMessage: mockGetMessage
			} );
			dropdown.currentTool = 'rectangle';
		} );

		it( 'should show empty message when no presets', () => {
			mockPresetManager.getPresetsForTool.mockReturnValue( [] );
			dropdown.renderMenu();
			expect( dropdown.elements.dropdown.textContent ).toContain( 'layers-presets-none' );
		} );

		it( 'should render preset items when presets exist', () => {
			mockPresetManager.getPresetsForTool.mockReturnValue( [
				{ id: '1', name: 'Test Preset', style: { stroke: '#ff0000' } }
			] );
			dropdown.renderMenu();
			expect( dropdown.elements.dropdown.querySelector( '.layers-preset-item' ) ).not.toBeNull();
		} );

		it( 'should include save action button', () => {
			dropdown.renderMenu();
			expect( dropdown.elements.dropdown.querySelector( '.layers-preset-action' ) ).not.toBeNull();
		} );

		it( 'should include divider', () => {
			dropdown.renderMenu();
			expect( dropdown.elements.dropdown.querySelector( '.layers-preset-divider' ) ).not.toBeNull();
		} );
	} );

	describe( 'createPresetItem', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				getMessage: mockGetMessage
			} );
		} );

		it( 'should create preset item element', () => {
			const preset = { id: '1', name: 'Test', style: { stroke: '#000' } };
			const item = dropdown.createPresetItem( preset, false );
			expect( item.className ).toContain( 'layers-preset-item' );
		} );

		it( 'should set data-preset-id attribute', () => {
			const preset = { id: 'preset-123', name: 'Test', style: {} };
			const item = dropdown.createPresetItem( preset, false );
			expect( item.getAttribute( 'data-preset-id' ) ).toBe( 'preset-123' );
		} );

		it( 'should add default class when isDefault', () => {
			const preset = { id: '1', name: 'Test', style: {} };
			const item = dropdown.createPresetItem( preset, true );
			expect( item.classList.contains( 'layers-preset-item--default' ) ).toBe( true );
		} );

		it( 'should add builtin class when preset is built-in', () => {
			const preset = { id: '1', name: 'Test', style: {}, builtIn: true };
			const item = dropdown.createPresetItem( preset, false );
			expect( item.classList.contains( 'layers-preset-item--builtin' ) ).toBe( true );
		} );

		it( 'should create color swatch', () => {
			const preset = { id: '1', name: 'Test', style: { stroke: '#ff0000' } };
			const item = dropdown.createPresetItem( preset, false );
			const swatch = item.querySelector( '.layers-preset-swatch' );
			expect( swatch ).not.toBeNull();
			expect( swatch.style.backgroundColor ).toBe( 'rgb(255, 0, 0)' );
		} );

		it( 'should display preset name', () => {
			const preset = { id: '1', name: 'My Preset', style: {} };
			const item = dropdown.createPresetItem( preset, false );
			expect( item.textContent ).toContain( 'My Preset' );
		} );

		it( 'should show star for default preset', () => {
			const preset = { id: '1', name: 'Test', style: {} };
			const item = dropdown.createPresetItem( preset, true );
			expect( item.querySelector( '.layers-preset-star' ) ).not.toBeNull();
		} );

		it( 'should show delete button for user presets', () => {
			const preset = { id: '1', name: 'Test', style: {}, builtIn: false };
			const item = dropdown.createPresetItem( preset, false );
			expect( item.querySelector( '.layers-preset-item-action--delete' ) ).not.toBeNull();
		} );

		it( 'should not show actions for built-in presets', () => {
			const preset = { id: '1', name: 'Test', style: {}, builtIn: true };
			const item = dropdown.createPresetItem( preset, false );
			expect( item.querySelector( '.layers-preset-item-actions' ) ).toBeNull();
		} );

		it( 'should show set-default button for non-default user presets', () => {
			const preset = { id: '1', name: 'Test', style: {}, builtIn: false };
			const item = dropdown.createPresetItem( preset, false );
			const actions = item.querySelector( '.layers-preset-item-actions' );
			expect( actions.children.length ).toBeGreaterThan( 1 ); // delete + set default
		} );

		it( 'should use fill color for swatch when no stroke', () => {
			const preset = { id: '1', name: 'Test', style: { fill: '#00ff00' } };
			const item = dropdown.createPresetItem( preset, false );
			const swatch = item.querySelector( '.layers-preset-swatch' );
			expect( swatch.style.backgroundColor ).toBe( 'rgb(0, 255, 0)' );
		} );

		it( 'should use color for swatch as last resort', () => {
			const preset = { id: '1', name: 'Test', style: { color: '#0000ff' } };
			const item = dropdown.createPresetItem( preset, false );
			const swatch = item.querySelector( '.layers-preset-swatch' );
			expect( swatch.style.backgroundColor ).toBe( 'rgb(0, 0, 255)' );
		} );
	} );

	describe( 'handlePresetClick', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				onSelect: mockOnSelect
			} );
			dropdown.currentTool = 'rectangle';
			dropdown.open();
		} );

		it( 'should close dropdown', () => {
			const preset = { id: '1', name: 'Test', style: { stroke: '#000' } };
			dropdown.handlePresetClick( preset );
			expect( dropdown.isOpen ).toBe( false );
		} );

		it( 'should call onSelect with style and preset', () => {
			const preset = { id: '1', name: 'Test', style: { stroke: '#000' } };
			dropdown.handlePresetClick( preset );
			expect( mockOnSelect ).toHaveBeenCalledWith( preset.style, preset );
		} );
	} );

	describe( 'handleSaveClick', () => {
		let originalPrompt;

		beforeEach( () => {
			originalPrompt = window.prompt;
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				onSave: mockOnSave,
				getMessage: mockGetMessage
			} );
			dropdown.currentTool = 'rectangle';
			dropdown.open();
		} );

		afterEach( () => {
			window.prompt = originalPrompt;
		} );

		it( 'should close dropdown', () => {
			window.prompt = jest.fn( () => null );
			dropdown.handleSaveClick();
			expect( dropdown.isOpen ).toBe( false );
		} );

		it( 'should not save when prompt cancelled', () => {
			window.prompt = jest.fn( () => null );
			dropdown.handleSaveClick();
			expect( mockOnSave ).not.toHaveBeenCalled();
		} );

		it( 'should not save when name is empty', () => {
			window.prompt = jest.fn( () => '   ' );
			dropdown.handleSaveClick();
			expect( mockOnSave ).not.toHaveBeenCalled();
		} );

		it( 'should call onSave with callback when name provided', () => {
			window.prompt = jest.fn( () => 'My Preset' );
			dropdown.handleSaveClick();
			expect( mockOnSave ).toHaveBeenCalledWith( expect.any( Function ) );
		} );

		it( 'should add preset when onSave callback provides style', () => {
			window.prompt = jest.fn( () => 'New Preset' );
			mockOnSave.mockImplementation( ( callback ) => {
				callback( { stroke: '#ff0000', strokeWidth: 2 } );
			} );
			dropdown.handleSaveClick();
			expect( mockPresetManager.addPreset ).toHaveBeenCalledWith(
				'rectangle',
				'New Preset',
				{ stroke: '#ff0000', strokeWidth: 2 }
			);
		} );

		it( 'should show notification after saving preset', () => {
			global.mw = { notify: jest.fn() };
			window.prompt = jest.fn( () => 'Saved Preset' );
			mockOnSave.mockImplementation( ( callback ) => {
				callback( { stroke: '#00ff00' } );
			} );
			dropdown.handleSaveClick();
			expect( global.mw.notify ).toHaveBeenCalled();
		} );

		it( 'should not add preset when onSave callback provides null style', () => {
			window.prompt = jest.fn( () => 'Test' );
			mockOnSave.mockImplementation( ( callback ) => {
				callback( null );
			} );
			dropdown.handleSaveClick();
			expect( mockPresetManager.addPreset ).not.toHaveBeenCalled();
		} );

		it( 'should use DialogManager when available', async () => {
			const mockDialogManager = {
				showPromptDialogAsync: jest.fn( () => Promise.resolve( 'Dialog Preset' ) )
			};
			dropdown.dialogManager = mockDialogManager;
			mockOnSave.mockImplementation( ( callback ) => {
				callback( { stroke: '#0000ff' } );
			} );

			await dropdown.handleSaveClick();

			expect( mockDialogManager.showPromptDialogAsync ).toHaveBeenCalled();
			expect( mockPresetManager.addPreset ).toHaveBeenCalledWith(
				'rectangle',
				'Dialog Preset',
				{ stroke: '#0000ff' }
			);
		} );
	} );

	describe( 'handleSetDefault', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			dropdown.currentTool = 'rectangle';
			dropdown.open();
		} );

		it( 'should call presetManager.setDefaultPreset', () => {
			dropdown.handleSetDefault( 'preset-1' );
			expect( mockPresetManager.setDefaultPreset ).toHaveBeenCalledWith( 'rectangle', 'preset-1' );
		} );

		it( 'should refresh menu', () => {
			const spy = jest.spyOn( dropdown, 'renderMenu' );
			dropdown.handleSetDefault( 'preset-1' );
			expect( spy ).toHaveBeenCalled();
		} );
	} );

	describe( 'preset item click handlers', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				onSelect: mockOnSelect,
				getMessage: mockGetMessage
			} );
			dropdown.currentTool = 'rectangle';
		} );

		it( 'should call handlePresetClick when clicking preset item', () => {
			const preset = { id: 'test-1', name: 'Test', style: { stroke: '#000' }, builtIn: false };
			const item = dropdown.createPresetItem( preset, false );
			const spy = jest.spyOn( dropdown, 'handlePresetClick' );

			item.click();

			expect( spy ).toHaveBeenCalledWith( preset );
		} );

		it( 'should call handleSetDefault when clicking set-default button', () => {
			const preset = { id: 'user-preset-1', name: 'User Preset', style: { stroke: '#000' }, builtIn: false };
			const item = dropdown.createPresetItem( preset, false );
			const setDefaultBtn = item.querySelector( '.layers-preset-item-action:not(.layers-preset-item-action--delete)' );
			const spy = jest.spyOn( dropdown, 'handleSetDefault' );

			if ( setDefaultBtn ) {
				setDefaultBtn.click();
				expect( spy ).toHaveBeenCalledWith( 'user-preset-1' );
			}
		} );

		it( 'should call handleDelete when clicking delete button', () => {
			const preset = { id: 'user-preset-2', name: 'Delete Me', style: { stroke: '#000' }, builtIn: false };
			const item = dropdown.createPresetItem( preset, false );
			const deleteBtn = item.querySelector( '.layers-preset-item-action--delete' );
			const spy = jest.spyOn( dropdown, 'handleDelete' );

			if ( deleteBtn ) {
				deleteBtn.click();
				expect( spy ).toHaveBeenCalledWith( 'user-preset-2', 'Delete Me' );
			}
		} );

		it( 'should stop propagation when clicking action buttons', () => {
			const preset = { id: 'user-preset-3', name: 'Test', style: { stroke: '#000' }, builtIn: false };
			const item = dropdown.createPresetItem( preset, false );
			const deleteBtn = item.querySelector( '.layers-preset-item-action--delete' );
			const handlePresetClickSpy = jest.spyOn( dropdown, 'handlePresetClick' );

			if ( deleteBtn ) {
				deleteBtn.click();
				// handlePresetClick should NOT be called because propagation was stopped
				expect( handlePresetClickSpy ).not.toHaveBeenCalled();
			}
		} );
	} );

	describe( 'save button click in actions section', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				onSave: mockOnSave,
				getMessage: mockGetMessage
			} );
			dropdown.currentTool = 'rectangle';
			dropdown.open();
		} );

		it( 'should call handleSaveClick when clicking save button', () => {
			const spy = jest.spyOn( dropdown, 'handleSaveClick' );
			const saveBtn = dropdown.elements.dropdown.querySelector( '.layers-preset-action' );

			if ( saveBtn ) {
				saveBtn.click();
				expect( spy ).toHaveBeenCalled();
			}
		} );
	} );

	describe( 'handleDelete', () => {
		let originalConfirm;

		beforeEach( () => {
			originalConfirm = window.confirm;
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager,
				getMessage: mockGetMessage
			} );
			dropdown.currentTool = 'rectangle';
			dropdown.open();
		} );

		afterEach( () => {
			window.confirm = originalConfirm;
		} );

		it( 'should not delete when not confirmed', () => {
			window.confirm = jest.fn( () => false );
			dropdown.handleDelete( 'preset-1', 'Test' );
			expect( mockPresetManager.deletePreset ).not.toHaveBeenCalled();
		} );

		it( 'should delete when confirmed', () => {
			window.confirm = jest.fn( () => true );
			dropdown.handleDelete( 'preset-1', 'Test' );
			expect( mockPresetManager.deletePreset ).toHaveBeenCalledWith( 'rectangle', 'preset-1' );
		} );

		it( 'should refresh menu when confirmed', () => {
			window.confirm = jest.fn( () => true );
			const spy = jest.spyOn( dropdown, 'renderMenu' );
			dropdown.handleDelete( 'preset-1', 'Test' );
			expect( spy ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleDocumentClick', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			dropdown.currentTool = 'rectangle';
			dropdown.open();
		} );

		it( 'should close when clicking outside', () => {
			const outsideElement = document.createElement( 'div' );
			document.body.appendChild( outsideElement );
			dropdown.handleDocumentClick( { target: outsideElement } );
			expect( dropdown.isOpen ).toBe( false );
			document.body.removeChild( outsideElement );
		} );

		it( 'should not close when clicking inside', () => {
			dropdown.handleDocumentClick( { target: dropdown.elements.button } );
			expect( dropdown.isOpen ).toBe( true );
		} );
	} );

	describe( 'handleKeyDown', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			dropdown.currentTool = 'rectangle';
			dropdown.open();
		} );

		it( 'should close on Escape key', () => {
			dropdown.handleKeyDown( { key: 'Escape' } );
			expect( dropdown.isOpen ).toBe( false );
		} );

		it( 'should focus button after closing', () => {
			const focusSpy = jest.spyOn( dropdown.elements.button, 'focus' );
			dropdown.handleKeyDown( { key: 'Escape' } );
			expect( focusSpy ).toHaveBeenCalled();
		} );

		it( 'should not close on other keys', () => {
			dropdown.handleKeyDown( { key: 'Enter' } );
			expect( dropdown.isOpen ).toBe( true );
		} );
	} );

	describe( 'handlePresetChange', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			dropdown.currentTool = 'rectangle';
		} );

		it( 'should refresh menu when open', () => {
			dropdown.open();
			const spy = jest.spyOn( dropdown, 'renderMenu' );
			dropdown.handlePresetChange();
			expect( spy ).toHaveBeenCalled();
		} );

		it( 'should not refresh menu when closed', () => {
			const spy = jest.spyOn( dropdown, 'renderMenu' );
			dropdown.handlePresetChange();
			expect( spy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'showNotification', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
		} );

		it( 'should call mw.notify when available', () => {
			const mockNotify = jest.fn();
			global.mw = { notify: mockNotify };
			dropdown.showNotification( 'Test message' );
			expect( mockNotify ).toHaveBeenCalledWith( 'Test message', { type: 'info', autoHide: true } );
		} );

		it( 'should not throw when mw.notify not available', () => {
			delete global.mw;
			expect( () => {
				dropdown.showNotification( 'Test message' );
			} ).not.toThrow();
		} );
	} );

	describe( 'getElement', () => {
		beforeEach( () => {
			dropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
		} );

		it( 'should return container element', () => {
			expect( dropdown.getElement() ).toBe( dropdown.elements.container );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should close dropdown', () => {
			const testDropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			testDropdown.currentTool = 'rectangle';
			testDropdown.open();
			testDropdown.destroy();
			expect( testDropdown.isOpen ).toBe( false );
		} );

		it( 'should call unsubscribe', () => {
			const testDropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			testDropdown.destroy();
			expect( mockUnsubscribe ).toHaveBeenCalled();
		} );

		it( 'should remove container from DOM', () => {
			const testDropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			const parent = document.createElement( 'div' );
			parent.appendChild( testDropdown.elements.container );
			testDropdown.destroy();
			expect( parent.children.length ).toBe( 0 );
		} );

		it( 'should clear element references', () => {
			const testDropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			testDropdown.destroy();
			expect( testDropdown.elements ).toEqual( {} );
		} );

		it( 'should clear presetManager reference', () => {
			const testDropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			testDropdown.destroy();
			expect( testDropdown.presetManager ).toBeNull();
		} );

		it( 'should clear callbacks', () => {
			const testDropdown = new PresetDropdown( {
				presetManager: mockPresetManager
			} );
			testDropdown.destroy();
			expect( testDropdown.onSelect ).toBeNull();
			expect( testDropdown.onSave ).toBeNull();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export PresetDropdown class', () => {
			// Don't create an instance - just test the export
			expect( PresetDropdown ).toBeDefined();
			expect( typeof PresetDropdown ).toBe( 'function' );
		} );
	} );
} );
