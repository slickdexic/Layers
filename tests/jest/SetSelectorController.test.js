/**
 * @jest-environment jsdom
 */

/**
 * SetSelectorController unit tests
 *
 * Tests for the Named Layer Set selector controller
 */

'use strict';

describe( 'SetSelectorController', () => {
	let SetSelectorController;
	let controller;
	let mockUiManager;
	let mockEditor;
	let mockStateManager;
	let mockApiManager;

	beforeEach( () => {
		// Reset modules
		jest.resetModules();

		// Set up mw mock
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: () => key,
				parse: () => key
			} ) ),
			notify: jest.fn(),
			log: {
				error: jest.fn(),
				warn: jest.fn()
			},
			config: {
				get: jest.fn( () => 'TestUser' )
			}
		};

		// Set up Layers namespace
		window.Layers = { UI: {} };

		// Create mock stateManager
		mockStateManager = {
			get: jest.fn( ( key ) => {
				const state = {
					currentSetName: 'test-set',
					namedSets: [ { name: 'default' }, { name: 'test-set' } ],
					layers: [ { id: 'layer1' } ],
					isDirty: false
				};
				return state[ key ];
			} ),
			set: jest.fn()
		};

		// Create mock apiManager
		mockApiManager = {
			deleteLayerSet: jest.fn( () => Promise.resolve() ),
			renameLayerSet: jest.fn( () => Promise.resolve() ),
			saveLayers: jest.fn( () => Promise.resolve() )
		};

		// Create mock editor
		mockEditor = {
			stateManager: mockStateManager,
			apiManager: mockApiManager,
			loadLayerSetByName: jest.fn(),
			buildSetSelector: jest.fn(),
			revisionManager: {
				buildSetSelector: jest.fn()
			},
			canvasManager: {
				renderLayers: jest.fn()
			},
			layerPanel: {
				renderLayerList: jest.fn()
			},
			selectionManager: {
				clearSelection: jest.fn()
			}
		};

		// Create mock uiManager
		mockUiManager = {
			editor: mockEditor,
			getMessage: jest.fn( ( key, fallback ) => fallback || key ),
			addListener: jest.fn( ( element, event, handler ) => {
				element.addEventListener( event, handler );
			} ),
			showConfirmDialog: jest.fn( () => Promise.resolve( true ) ),
			showPromptDialog: jest.fn( () => Promise.resolve( 'new-name' ) )
		};

		// Load the module
		jest.resetModules();
		require( '../../resources/ext.layers.editor/ui/SetSelectorController.js' );
		SetSelectorController = global.window.Layers.UI.SetSelectorController;

		// Create controller
		controller = new SetSelectorController( mockUiManager );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete global.mw;
	} );

	describe( 'constructor', () => {
		it( 'should initialize with uiManager reference', () => {
			expect( controller.uiManager ).toBe( mockUiManager );
			expect( controller.editor ).toBe( mockEditor );
		} );

		it( 'should have null element references initially', () => {
			expect( controller.setSelectEl ).toBeNull();
			expect( controller.newSetInputEl ).toBeNull();
			expect( controller.newSetBtnEl ).toBeNull();
			expect( controller.setRenameBtnEl ).toBeNull();
			expect( controller.setDeleteBtnEl ).toBeNull();
		} );
	} );

	describe( 'getMessage', () => {
		it( 'should delegate to uiManager.getMessage', () => {
			controller.getMessage( 'test-key', 'fallback' );
			expect( mockUiManager.getMessage ).toHaveBeenCalledWith( 'test-key', 'fallback' );
		} );
	} );

	describe( 'addListener', () => {
		it( 'should delegate to uiManager.addListener', () => {
			const el = document.createElement( 'button' );
			const handler = jest.fn();
			controller.addListener( el, 'click', handler );
			expect( mockUiManager.addListener ).toHaveBeenCalledWith( el, 'click', handler, undefined );
		} );
	} );

	describe( 'createSetSelector', () => {
		it( 'should create set selector wrapper with all elements', () => {
			const wrapper = controller.createSetSelector();

			expect( wrapper.className ).toBe( 'layers-set-wrap' );
			expect( wrapper.getAttribute( 'role' ) ).toBe( 'group' );
			expect( controller.setSelectEl ).not.toBeNull();
			expect( controller.newSetInputEl ).not.toBeNull();
			expect( controller.newSetBtnEl ).not.toBeNull();
			expect( controller.setRenameBtnEl ).not.toBeNull();
			expect( controller.setDeleteBtnEl ).not.toBeNull();
		} );

		it( 'should set input elements to hidden by default', () => {
			controller.createSetSelector();

			expect( controller.newSetInputEl.style.display ).toBe( 'none' );
			expect( controller.newSetBtnEl.style.display ).toBe( 'none' );
		} );

		it( 'should store references in uiManager for backward compatibility', () => {
			controller.createSetSelector();

			expect( mockUiManager.setSelectEl ).toBe( controller.setSelectEl );
			expect( mockUiManager.newSetInputEl ).toBe( controller.newSetInputEl );
			expect( mockUiManager.newSetBtnEl ).toBe( controller.newSetBtnEl );
		} );
	} );

	describe( 'setupControls', () => {
		it( 'should return early if setSelectEl is null', () => {
			controller.setSelectEl = null;
			controller.setupControls();
			expect( mockUiManager.addListener ).not.toHaveBeenCalled();
		} );

		it( 'should add change listener to select element', () => {
			controller.createSetSelector();
			controller.setupControls();

			// Verify addListener was called for the select
			const calls = mockUiManager.addListener.mock.calls;
			const hasChangeListener = calls.some(
				( args ) => args[ 0 ] === controller.setSelectEl && args[ 1 ] === 'change'
			);
			expect( hasChangeListener ).toBe( true );
		} );

		it( 'should add click listener to new set button', () => {
			controller.createSetSelector();
			controller.setupControls();

			// Check that addListener was called with newSetBtnEl and 'click'
			const calls = mockUiManager.addListener.mock.calls;
			const hasNewSetBtnListener = calls.some(
				( args ) => args[ 0 ] === controller.newSetBtnEl && args[ 1 ] === 'click'
			);
			expect( hasNewSetBtnListener ).toBe( true );
		} );

		it( 'should add click listener to delete button', () => {
			controller.createSetSelector();
			controller.setupControls();

			const calls = mockUiManager.addListener.mock.calls;
			const hasDeleteBtnListener = calls.some(
				( args ) => args[ 0 ] === controller.setDeleteBtnEl && args[ 1 ] === 'click'
			);
			expect( hasDeleteBtnListener ).toBe( true );
		} );

		it( 'should add click listener to rename button', () => {
			controller.createSetSelector();
			controller.setupControls();

			const calls = mockUiManager.addListener.mock.calls;
			const hasRenameBtnListener = calls.some(
				( args ) => args[ 0 ] === controller.setRenameBtnEl && args[ 1 ] === 'click'
			);
			expect( hasRenameBtnListener ).toBe( true );
		} );

		it( 'should add keydown listener to new set input', () => {
			controller.createSetSelector();
			controller.setupControls();

			const calls = mockUiManager.addListener.mock.calls;
			const hasKeydownListener = calls.some(
				( args ) => args[ 0 ] === controller.newSetInputEl && args[ 1 ] === 'keydown'
			);
			expect( hasKeydownListener ).toBe( true );
		} );
	} );

	describe( 'showNewSetInput', () => {
		beforeEach( () => {
			controller.createSetSelector();
		} );

		it( 'should show input and button when true', () => {
			controller.showNewSetInput( true );

			expect( controller.newSetInputEl.style.display ).toBe( 'inline-block' );
			expect( controller.newSetBtnEl.style.display ).toBe( 'inline-block' );
		} );

		it( 'should hide input and button when false', () => {
			controller.showNewSetInput( true );
			controller.showNewSetInput( false );

			expect( controller.newSetInputEl.style.display ).toBe( 'none' );
			expect( controller.newSetBtnEl.style.display ).toBe( 'none' );
		} );

		it( 'should clear input value when showing', () => {
			controller.newSetInputEl.value = 'previous-value';
			controller.showNewSetInput( true );

			expect( controller.newSetInputEl.value ).toBe( '' );
		} );
	} );

	describe( 'createNewSet', () => {
		beforeEach( () => {
			controller.createSetSelector();
		} );

		it( 'should return early if newSetInputEl is null', () => {
			controller.newSetInputEl = null;
			controller.createNewSet();
			expect( mw.notify ).not.toHaveBeenCalled();
		} );

		it( 'should show warning if name is empty', () => {
			controller.newSetInputEl.value = '';
			controller.createNewSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'warn' }
			);
		} );

		it( 'should show warning if name is whitespace only', () => {
			controller.newSetInputEl.value = '   ';
			controller.createNewSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'warn' }
			);
		} );

		it( 'should show error for invalid characters', () => {
			controller.newSetInputEl.value = 'test@invalid';
			controller.createNewSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'error' }
			);
		} );

		it( 'should show warning if name already exists', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return [ { name: 'existing-set' } ];
				}
				return null;
			} );
			controller.newSetInputEl.value = 'existing-set';
			controller.createNewSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'warn' }
			);
		} );

		it( 'should create new set successfully', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return [];
				}
				return null;
			} );
			controller.newSetInputEl.value = 'new-valid-set';
			controller.createNewSet();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'new-valid-set' );
			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'success' }
			);
		} );

		it( 'should allow unicode characters in set name', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return [];
				}
				return null;
			} );
			controller.newSetInputEl.value = '日本語セット';
			controller.createNewSet();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', '日本語セット' );
		} );
	} );

	describe( 'deleteCurrentSet', () => {
		beforeEach( () => {
			controller.createSetSelector();
		} );

		it( 'should return early if no current set', async () => {
			mockStateManager.get.mockReturnValue( null );
			await controller.deleteCurrentSet();

			expect( mockUiManager.showConfirmDialog ).not.toHaveBeenCalled();
		} );

		it( 'should call clearDefaultSet for default set', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				if ( key === 'layers' ) {
					return [ { id: 'layer1' } ];
				}
				return null;
			} );

			await controller.deleteCurrentSet();

			// Should prompt for clearing, not deleting
			expect( mockUiManager.showConfirmDialog ).toHaveBeenCalled();
		} );

		it( 'should call API to delete non-default set', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) {
					return 'test-set';
				}
				if ( key === 'namedSets' ) {
					return [ { name: 'test-set', revision_count: 3 } ];
				}
				return null;
			} );

			await controller.deleteCurrentSet();

			expect( mockApiManager.deleteLayerSet ).toHaveBeenCalledWith( 'test-set' );
		} );

		it( 'should do nothing if user cancels confirmation', async () => {
			mockUiManager.showConfirmDialog.mockResolvedValue( false );
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) {
					return 'test-set';
				}
				return [];
			} );

			await controller.deleteCurrentSet();

			expect( mockApiManager.deleteLayerSet ).not.toHaveBeenCalled();
		} );

		it( 'should use revisionManager.buildSetSelector as fallback', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) {
					return 'test-set';
				}
				return [];
			} );
			delete mockEditor.buildSetSelector;

			await controller.deleteCurrentSet();

			// Wait for promise
			await new Promise( resolve => setTimeout( resolve, 0 ) );
			expect( mockEditor.revisionManager.buildSetSelector ).toHaveBeenCalled();
		} );

		it( 'should log error on API failure', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) {
					return 'test-set';
				}
				return [];
			} );
			mockApiManager.deleteLayerSet.mockRejectedValue( new Error( 'API error' ) );

			await controller.deleteCurrentSet();

			// Wait for promise rejection
			await new Promise( resolve => setTimeout( resolve, 0 ) );
			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should show error if apiManager is not available', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) {
					return 'test-set';
				}
				return [];
			} );
			mockEditor.apiManager = null;

			await controller.deleteCurrentSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'error' }
			);
		} );
	} );

	describe( 'clearDefaultSet', () => {
		beforeEach( () => {
			controller.createSetSelector();
		} );

		it( 'should show info message if no layers to clear', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'layers' ) {
					return [];
				}
				return null;
			} );

			await controller.clearDefaultSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'info' }
			);
		} );

		it( 'should do nothing if user cancels', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'layers' ) {
					return [ { id: 'layer1' } ];
				}
				return null;
			} );
			mockUiManager.showConfirmDialog.mockResolvedValue( false );

			await controller.clearDefaultSet();

			expect( mockStateManager.set ).not.toHaveBeenCalled();
		} );

		it( 'should clear layers and save on confirmation', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'layers' ) {
					return [ { id: 'layer1' } ];
				}
				return null;
			} );

			await controller.clearDefaultSet();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'layers', [] );
			expect( mockApiManager.saveLayers ).toHaveBeenCalledWith( [], 'default' );
		} );

		it( 'should show error on save failure', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'layers' ) {
					return [ { id: 'layer1' } ];
				}
				return null;
			} );
			mockApiManager.saveLayers.mockRejectedValue( new Error( 'Save failed' ) );

			await controller.clearDefaultSet();

			// Wait for promise rejection
			await new Promise( resolve => setTimeout( resolve, 0 ) );
			expect( mw.log.error ).toHaveBeenCalled();
			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'error' }
			);
		} );

		it( 'should show success when apiManager not available', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'layers' ) {
					return [ { id: 'layer1' } ];
				}
				return null;
			} );
			mockEditor.apiManager = null;

			await controller.clearDefaultSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'success' }
			);
		} );
	} );

	describe( 'renameCurrentSet', () => {
		beforeEach( () => {
			controller.createSetSelector();
		} );

		it( 'should show warning for default set', async () => {
			mockStateManager.get.mockReturnValue( 'default' );

			await controller.renameCurrentSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'warn' }
			);
		} );

		it( 'should do nothing if user cancels prompt', async () => {
			mockStateManager.get.mockReturnValue( 'test-set' );
			mockUiManager.showPromptDialog.mockResolvedValue( null );

			await controller.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).not.toHaveBeenCalled();
		} );

		it( 'should do nothing if new name is same as current', async () => {
			mockStateManager.get.mockReturnValue( 'test-set' );
			mockUiManager.showPromptDialog.mockResolvedValue( 'test-set' );

			await controller.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).not.toHaveBeenCalled();
		} );

		it( 'should show error for invalid name format', async () => {
			mockStateManager.get.mockReturnValue( 'test-set' );
			mockUiManager.showPromptDialog.mockResolvedValue( 'invalid name with spaces!' );

			await controller.renameCurrentSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'error' }
			);
		} );

		it( 'should call API to rename with valid name', async () => {
			mockStateManager.get.mockReturnValue( 'test-set' );
			mockUiManager.showPromptDialog.mockResolvedValue( 'new-valid-name' );

			await controller.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).toHaveBeenCalledWith( 'test-set', 'new-valid-name' );
		} );

		it( 'should log error on API failure', async () => {
			mockStateManager.get.mockReturnValue( 'test-set' );
			mockUiManager.showPromptDialog.mockResolvedValue( 'new-name' );
			mockApiManager.renameLayerSet.mockRejectedValue( new Error( 'API error' ) );

			await controller.renameCurrentSet();

			// Wait for promise rejection
			await new Promise( resolve => setTimeout( resolve, 0 ) );
			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should show error if apiManager is not available', async () => {
			mockStateManager.get.mockReturnValue( 'test-set' );
			mockUiManager.showPromptDialog.mockResolvedValue( 'new-name' );
			mockEditor.apiManager = null;

			await controller.renameCurrentSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'error' }
			);
		} );
	} );

	describe( 'addSetOption', () => {
		it( 'should return early if setSelectEl is null', () => {
			controller.setSelectEl = null;
			controller.addSetOption( 'test' );
			// No error thrown
		} );

		it( 'should add option to select element', () => {
			controller.createSetSelector();
			controller.addSetOption( 'new-option' );

			const options = controller.setSelectEl.querySelectorAll( 'option' );
			const values = Array.from( options ).map( o => o.value );
			expect( values ).toContain( 'new-option' );
		} );

		it( 'should select the option when select=true', () => {
			controller.createSetSelector();
			controller.addSetOption( 'selected-option', true );

			expect( controller.setSelectEl.value ).toBe( 'selected-option' );
		} );

		it( 'should insert before __new__ option if present', () => {
			controller.createSetSelector();
			// Add __new__ option
			const newOpt = document.createElement( 'option' );
			newOpt.value = '__new__';
			controller.setSelectEl.appendChild( newOpt );

			controller.addSetOption( 'before-new' );

			const options = Array.from( controller.setSelectEl.querySelectorAll( 'option' ) );
			const newIndex = options.findIndex( o => o.value === '__new__' );
			const addedIndex = options.findIndex( o => o.value === 'before-new' );
			expect( addedIndex ).toBeLessThan( newIndex );
		} );
	} );

	describe( 'getSelectElement', () => {
		it( 'should return null before createSetSelector', () => {
			expect( controller.getSelectElement() ).toBeNull();
		} );

		it( 'should return select element after createSetSelector', () => {
			controller.createSetSelector();
			expect( controller.getSelectElement() ).toBe( controller.setSelectEl );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all references', () => {
			controller.createSetSelector();
			controller.destroy();

			expect( controller.setSelectEl ).toBeNull();
			expect( controller.newSetInputEl ).toBeNull();
			expect( controller.newSetBtnEl ).toBeNull();
			expect( controller.setRenameBtnEl ).toBeNull();
			expect( controller.setDeleteBtnEl ).toBeNull();
			expect( controller.uiManager ).toBeNull();
			expect( controller.editor ).toBeNull();
		} );
	} );

	describe( 'keyboard handlers', () => {
		beforeEach( () => {
			controller.createSetSelector();
			controller.setupControls();
		} );

		it( 'should call createNewSet on Enter key in input', () => {
			const spy = jest.spyOn( controller, 'createNewSet' );
			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );

			controller.newSetInputEl.dispatchEvent( event );

			expect( spy ).toHaveBeenCalled();
		} );

		it( 'should hide input and restore selection on Escape', () => {
			mockStateManager.get.mockReturnValue( 'current-set' );
			controller.showNewSetInput( true );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			controller.newSetInputEl.dispatchEvent( event );

			expect( controller.newSetInputEl.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'set selection with unsaved changes', () => {
		beforeEach( () => {
			controller.createSetSelector();
			controller.setupControls();
		} );

		it( 'should prompt for confirmation when dirty and switching sets', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'isDirty' ) {
					return true;
				}
				if ( key === 'currentSetName' ) {
					return 'original-set';
				}
				return null;
			} );

			// Add an option to the select
			const opt = document.createElement( 'option' );
			opt.value = 'other-set';
			controller.setSelectEl.appendChild( opt );

			// Trigger change
			controller.setSelectEl.value = 'other-set';
			const event = new Event( 'change' );
			controller.setSelectEl.dispatchEvent( event );

			// Wait for async handler
			await new Promise( resolve => setTimeout( resolve, 0 ) );

			expect( mockUiManager.showConfirmDialog ).toHaveBeenCalled();
		} );

		it( 'should restore previous selection if user cancels', async () => {
			mockUiManager.showConfirmDialog.mockResolvedValue( false );
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'isDirty' ) {
					return true;
				}
				if ( key === 'currentSetName' ) {
					return 'original-set';
				}
				return null;
			} );

			// Add options
			const opt1 = document.createElement( 'option' );
			opt1.value = 'original-set';
			controller.setSelectEl.appendChild( opt1 );
			const opt2 = document.createElement( 'option' );
			opt2.value = 'other-set';
			controller.setSelectEl.appendChild( opt2 );

			// Trigger change
			controller.setSelectEl.value = 'other-set';
			const event = new Event( 'change' );
			controller.setSelectEl.dispatchEvent( event );

			// Wait for async handler
			await new Promise( resolve => setTimeout( resolve, 50 ) );

			expect( controller.setSelectEl.value ).toBe( 'original-set' );
		} );
	} );
} );
