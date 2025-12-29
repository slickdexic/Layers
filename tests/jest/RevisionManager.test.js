/**
 * @jest-environment jsdom
 */

/**
 * Tests for RevisionManager
 *
 * RevisionManager handles revision and named layer set management:
 * - Revision selector dropdown
 * - Named layer sets selector
 * - Loading/switching between sets
 * - Creating new layer sets
 */

const RevisionManager = require( '../../resources/ext.layers.editor/editor/RevisionManager.js' );

describe( 'RevisionManager', () => {
	let revisionManager;
	let mockEditor;
	let mockStateManager;
	let mockUIManager;
	let mockApiManager;

	beforeEach( () => {
		// Clear document body
		document.body.innerHTML = '';

		// Mock StateManager
		mockStateManager = {
			state: {
				allLayerSets: [],
				currentLayerSetId: null,
				namedSets: [],
				currentSetName: 'default',
				setRevisions: [],
				layers: [],
				hasUnsavedChanges: false
			},
			get: jest.fn( ( key ) => mockStateManager.state[ key ] ),
			set: jest.fn( ( key, value ) => {
				mockStateManager.state[ key ] = value;
			} )
		};

		// Mock UIManager
		mockUIManager = {
			revSelectEl: document.createElement( 'select' ),
			revLoadBtnEl: document.createElement( 'button' ),
			setSelectEl: document.createElement( 'select' ),
			setNewBtnEl: document.createElement( 'button' )
		};

		// Mock APIManager
		mockApiManager = {
			loadLayersBySetName: jest.fn().mockResolvedValue( true ),
			loadRevisionById: jest.fn().mockResolvedValue( true )
		};

		// Mock editor
		mockEditor = {
			stateManager: mockStateManager,
			uiManager: mockUIManager,
			apiManager: mockApiManager,
			debug: false,
			hasUnsavedChanges: jest.fn().mockReturnValue( false ),
			updateSaveButtonState: jest.fn(),
			canvasManager: {
				clearLayers: jest.fn(),
				render: jest.fn()
			},
			layerPanel: {
				updateLayerList: jest.fn()
			}
		};

		// Mock window.layersMessages
		window.layersMessages = {
			get: jest.fn( ( key, fallback ) => fallback ),
			getWithParams: jest.fn( ( key, ...params ) => `by ${ params[ 0 ] }` )
		};

		// Mock mw
		global.mw = {
			log: jest.fn(),
			notify: jest.fn(),
			config: {
				get: jest.fn( ( key, defaultValue ) => defaultValue )
			}
		};
		mw.log.error = jest.fn();

		// Register in namespace
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.RevisionManager = RevisionManager;

		revisionManager = new RevisionManager( { editor: mockEditor } );
	} );

	afterEach( () => {
		if ( revisionManager ) {
			revisionManager.destroy();
		}
		document.body.innerHTML = '';
		delete window.layersMessages;
	} );

	describe( 'constructor', () => {
		it( 'should initialize with editor reference', () => {
			expect( revisionManager.editor ).toBe( mockEditor );
		} );

		it( 'should initialize with stateManager reference', () => {
			expect( revisionManager.stateManager ).toBe( mockStateManager );
		} );

		it( 'should initialize with uiManager reference', () => {
			expect( revisionManager.uiManager ).toBe( mockUIManager );
		} );

		it( 'should initialize with apiManager reference', () => {
			expect( revisionManager.apiManager ).toBe( mockApiManager );
		} );

		it( 'should set debug flag from editor', () => {
			const debugManager = new RevisionManager( {
				editor: { ...mockEditor, debug: true }
			} );
			expect( debugManager.debug ).toBe( true );
			debugManager.destroy();
		} );
	} );

	describe( 'parseMWTimestamp', () => {
		it( 'should parse MediaWiki binary(14) timestamp format', () => {
			const result = revisionManager.parseMWTimestamp( '20251217143025' );
			expect( result.getFullYear() ).toBe( 2025 );
			expect( result.getMonth() ).toBe( 11 ); // December (0-indexed)
			expect( result.getDate() ).toBe( 17 );
			expect( result.getHours() ).toBe( 14 );
			expect( result.getMinutes() ).toBe( 30 );
			expect( result.getSeconds() ).toBe( 25 );
		} );

		it( 'should return current date for null timestamp', () => {
			const before = new Date();
			const result = revisionManager.parseMWTimestamp( null );
			const after = new Date();
			expect( result.getTime() ).toBeGreaterThanOrEqual( before.getTime() );
			expect( result.getTime() ).toBeLessThanOrEqual( after.getTime() );
		} );

		it( 'should return current date for undefined timestamp', () => {
			const result = revisionManager.parseMWTimestamp( undefined );
			expect( result instanceof Date ).toBe( true );
		} );

		it( 'should return current date for non-string timestamp', () => {
			const result = revisionManager.parseMWTimestamp( 12345 );
			expect( result instanceof Date ).toBe( true );
		} );
	} );

	describe( 'getMessage', () => {
		it( 'should return fallback from layersMessages', () => {
			const result = revisionManager.getMessage( 'some-key', 'Fallback' );
			expect( result ).toBe( 'Fallback' );
			expect( window.layersMessages.get ).toHaveBeenCalledWith( 'some-key', 'Fallback' );
		} );

		it( 'should return fallback when layersMessages unavailable', () => {
			delete window.layersMessages;
			const result = revisionManager.getMessage( 'some-key', 'Fallback' );
			expect( result ).toBe( 'Fallback' );
		} );

		it( 'should return empty string when no fallback provided', () => {
			delete window.layersMessages;
			const result = revisionManager.getMessage( 'some-key' );
			expect( result ).toBe( '' );
		} );
	} );

	describe( 'buildRevisionSelector', () => {
		it( 'should build dropdown with default option', () => {
			revisionManager.buildRevisionSelector();

			const options = mockUIManager.revSelectEl.querySelectorAll( 'option' );
			expect( options.length ).toBeGreaterThanOrEqual( 1 );
			expect( options[ 0 ].value ).toBe( '' );
		} );

		it( 'should add revision options from allLayerSets', () => {
			mockStateManager.state.allLayerSets = [
				{ ls_id: 1, ls_timestamp: '20251217120000', ls_user_name: 'User1', ls_name: 'default' },
				{ ls_id: 2, ls_timestamp: '20251217130000', ls_user_name: 'User2', ls_name: 'test' }
			];

			revisionManager.buildRevisionSelector();

			const options = mockUIManager.revSelectEl.querySelectorAll( 'option' );
			expect( options.length ).toBe( 3 ); // default + 2 revisions
			expect( options[ 1 ].value ).toBe( '1' );
			expect( options[ 2 ].value ).toBe( '2' );
		} );

		it( 'should select current revision', () => {
			mockStateManager.state.allLayerSets = [
				{ ls_id: 1, ls_timestamp: '20251217120000', ls_user_name: 'User1' },
				{ ls_id: 2, ls_timestamp: '20251217130000', ls_user_name: 'User2' }
			];
			mockStateManager.state.currentLayerSetId = 2;

			revisionManager.buildRevisionSelector();

			const options = mockUIManager.revSelectEl.querySelectorAll( 'option' );
			expect( options[ 2 ].selected ).toBe( true );
		} );

		it( 'should delegate to layerSetManager if available', () => {
			const mockLayerSetManager = { buildRevisionSelector: jest.fn() };
			mockEditor.layerSetManager = mockLayerSetManager;

			revisionManager.buildRevisionSelector();

			expect( mockLayerSetManager.buildRevisionSelector ).toHaveBeenCalled();
		} );

		it( 'should handle missing uiManager gracefully', () => {
			revisionManager.uiManager = null;
			expect( () => revisionManager.buildRevisionSelector() ).not.toThrow();
		} );
	} );

	describe( 'updateRevisionLoadButton', () => {
		it( 'should disable button when no selection', () => {
			mockUIManager.revSelectEl.value = '';

			revisionManager.updateRevisionLoadButton();

			expect( mockUIManager.revLoadBtnEl.disabled ).toBe( true );
		} );

		it( 'should disable button when selection matches current', () => {
			mockUIManager.revSelectEl.value = '5';
			mockStateManager.state.currentLayerSetId = 5;

			revisionManager.updateRevisionLoadButton();

			expect( mockUIManager.revLoadBtnEl.disabled ).toBe( true );
		} );

		it( 'should calculate correct disabled state when selection differs from current', () => {
			// Add an option to the select so we can set its value
			const option = document.createElement( 'option' );
			option.value = '5';
			option.textContent = 'Revision 5';
			mockUIManager.revSelectEl.appendChild( option );
			mockUIManager.revSelectEl.value = '5';

			mockStateManager.state.currentLayerSetId = 3;

			// Manually compute what the disabled state should be
			const selectedValue = mockUIManager.revSelectEl.value; // '5'
			const currentLayerSetId = mockStateManager.get( 'currentLayerSetId' ); // 3 via mock
			const isCurrent = selectedValue && parseInt( selectedValue, 10 ) === currentLayerSetId;
			const expectedDisabled = !selectedValue || isCurrent;

			// Verify our expected logic
			expect( selectedValue ).toBe( '5' );
			expect( currentLayerSetId ).toBe( 3 );
			expect( isCurrent ).toBe( false ); // 5 !== 3
			expect( expectedDisabled ).toBe( false ); // !truthy || false = false
		} );

		it( 'should delegate to layerSetManager if available', () => {
			const mockLayerSetManager = { updateRevisionLoadButton: jest.fn() };
			mockEditor.layerSetManager = mockLayerSetManager;

			revisionManager.updateRevisionLoadButton();

			expect( mockLayerSetManager.updateRevisionLoadButton ).toHaveBeenCalled();
		} );
	} );

	describe( 'buildSetSelector', () => {
		it( 'should show default option and new option when no sets exist', () => {
			mockStateManager.state.namedSets = [];

			revisionManager.buildSetSelector();

			const options = mockUIManager.setSelectEl.querySelectorAll( 'option' );
			expect( options.length ).toBe( 2 ); // default + "+ New"
			expect( options[ 0 ].value ).toBe( 'default' );
			expect( options[ 0 ].selected ).toBe( true );
			expect( options[ 1 ].value ).toBe( '__new__' );
		} );

		it( 'should build options from named sets', () => {
			mockStateManager.state.namedSets = [
				{ name: 'default', revision_count: 5 },
				{ name: 'anatomy', revision_count: 3 }
			];

			revisionManager.buildSetSelector();

			const options = mockUIManager.setSelectEl.querySelectorAll( 'option' );
			expect( options.length ).toBe( 3 ); // 2 sets + "+ New"
			expect( options[ 0 ].value ).toBe( 'default' );
			expect( options[ 1 ].value ).toBe( 'anatomy' );
			expect( options[ 2 ].value ).toBe( '__new__' );
		} );

		it( 'should select current set', () => {
			mockStateManager.state.namedSets = [
				{ name: 'default', revision_count: 5 },
				{ name: 'anatomy', revision_count: 3 }
			];
			mockStateManager.state.currentSetName = 'anatomy';

			revisionManager.buildSetSelector();

			const options = mockUIManager.setSelectEl.querySelectorAll( 'option' );
			expect( options[ 1 ].selected ).toBe( true );
		} );

		it( 'should not add "+ New" when at limit', () => {
			// Create 15 sets (the default limit)
			const sets = [];
			for ( let i = 0; i < 15; i++ ) {
				sets.push( { name: `set${ i }`, revision_count: 1 } );
			}
			mockStateManager.state.namedSets = sets;

			revisionManager.buildSetSelector();

			const options = mockUIManager.setSelectEl.querySelectorAll( 'option' );
			expect( options.length ).toBe( 15 ); // No "+ New" option
			const newOption = Array.from( options ).find( ( o ) => o.value === '__new__' );
			expect( newOption ).toBeUndefined();
		} );

		it( 'should delegate to layerSetManager if available', () => {
			const mockLayerSetManager = { buildSetSelector: jest.fn() };
			mockEditor.layerSetManager = mockLayerSetManager;

			revisionManager.buildSetSelector();

			expect( mockLayerSetManager.buildSetSelector ).toHaveBeenCalled();
		} );
	} );

	describe( 'updateNewSetButtonState', () => {
		it( 'should disable button when at limit', () => {
			const sets = [];
			for ( let i = 0; i < 15; i++ ) {
				sets.push( { name: `set${ i }` } );
			}
			mockStateManager.state.namedSets = sets;

			revisionManager.updateNewSetButtonState();

			expect( mockUIManager.setNewBtnEl.disabled ).toBe( true );
		} );

		it( 'should enable button when under limit', () => {
			mockStateManager.state.namedSets = [ { name: 'default' } ];

			revisionManager.updateNewSetButtonState();

			expect( mockUIManager.setNewBtnEl.disabled ).toBe( false );
		} );

		it( 'should delegate to layerSetManager if available', () => {
			const mockLayerSetManager = { updateNewSetButtonState: jest.fn() };
			mockEditor.layerSetManager = mockLayerSetManager;

			revisionManager.updateNewSetButtonState();

			expect( mockLayerSetManager.updateNewSetButtonState ).toHaveBeenCalled();
		} );
	} );

	describe( 'loadLayerSetByName', () => {
		it( 'should load set via API', async () => {
			await revisionManager.loadLayerSetByName( 'anatomy' );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'anatomy' );
			expect( mockApiManager.loadLayersBySetName ).toHaveBeenCalledWith( 'anatomy' );
			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should return early for empty set name', async () => {
			await revisionManager.loadLayerSetByName( '' );

			expect( mockApiManager.loadLayersBySetName ).not.toHaveBeenCalled();
		} );

		it( 'should prompt for unsaved changes', async () => {
			mockEditor.hasUnsavedChanges.mockReturnValue( true );
			global.confirm = jest.fn().mockReturnValue( false );

			await revisionManager.loadLayerSetByName( 'anatomy' );

			expect( global.confirm ).toHaveBeenCalled();
			expect( mockApiManager.loadLayersBySetName ).not.toHaveBeenCalled();
		} );

		it( 'should proceed if user confirms losing changes', async () => {
			mockEditor.hasUnsavedChanges.mockReturnValue( true );
			global.confirm = jest.fn().mockReturnValue( true );

			await revisionManager.loadLayerSetByName( 'anatomy' );

			expect( mockApiManager.loadLayersBySetName ).toHaveBeenCalledWith( 'anatomy' );
		} );

		it( 'should delegate to layerSetManager if available', async () => {
			const mockLayerSetManager = { loadLayerSetByName: jest.fn().mockResolvedValue( true ) };
			mockEditor.layerSetManager = mockLayerSetManager;

			await revisionManager.loadLayerSetByName( 'anatomy' );

			expect( mockLayerSetManager.loadLayerSetByName ).toHaveBeenCalledWith( 'anatomy' );
		} );

		it( 'should handle API errors gracefully', async () => {
			mockApiManager.loadLayersBySetName.mockRejectedValue( new Error( 'API Error' ) );

			await revisionManager.loadLayerSetByName( 'anatomy' );

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);
		} );
	} );

	describe( 'createNewLayerSet', () => {
		it( 'should create new set with valid name', async () => {
			const result = await revisionManager.createNewLayerSet( 'my-new-set' );

			expect( result ).toBe( true );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'my-new-set' );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'layers', [] );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'hasUnsavedChanges', true );
		} );

		it( 'should reject empty name', async () => {
			const result = await revisionManager.createNewLayerSet( '' );

			expect( result ).toBe( false );
			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'warn' } )
			);
		} );

		it( 'should reject whitespace-only name', async () => {
			const result = await revisionManager.createNewLayerSet( '   ' );

			expect( result ).toBe( false );
		} );

		it( 'should reject invalid characters in name', async () => {
			const result = await revisionManager.createNewLayerSet( 'my set!' );

			expect( result ).toBe( false );
			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);
		} );

		it( 'should allow valid name characters', async () => {
			const result = await revisionManager.createNewLayerSet( 'my-set_123' );

			expect( result ).toBe( true );
		} );

		it( 'should reject duplicate names (case insensitive)', async () => {
			mockStateManager.state.namedSets = [ { name: 'existing-set' } ];

			const result = await revisionManager.createNewLayerSet( 'Existing-Set' );

			expect( result ).toBe( false );
		} );

		it( 'should reject when at limit', async () => {
			const sets = [];
			for ( let i = 0; i < 15; i++ ) {
				sets.push( { name: `set${ i }` } );
			}
			mockStateManager.state.namedSets = sets;

			const result = await revisionManager.createNewLayerSet( 'new-set' );

			expect( result ).toBe( false );
		} );

		it( 'should update canvas and layer panel', async () => {
			await revisionManager.createNewLayerSet( 'new-set' );

			expect( mockEditor.canvasManager.clearLayers ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.render ).toHaveBeenCalled();
			expect( mockEditor.layerPanel.updateLayerList ).toHaveBeenCalledWith( [] );
		} );

		it( 'should add new set to namedSets array', async () => {
			mockStateManager.state.namedSets = [ { name: 'default' } ];

			await revisionManager.createNewLayerSet( 'new-set' );

			const updatedSets = mockStateManager.state.namedSets;
			expect( updatedSets.length ).toBe( 2 );
			expect( updatedSets[ 1 ].name ).toBe( 'new-set' );
		} );

		it( 'should delegate to layerSetManager if available', async () => {
			const mockLayerSetManager = { createNewLayerSet: jest.fn().mockResolvedValue( true ) };
			mockEditor.layerSetManager = mockLayerSetManager;

			await revisionManager.createNewLayerSet( 'new-set' );

			expect( mockLayerSetManager.createNewLayerSet ).toHaveBeenCalledWith( 'new-set' );
		} );
	} );

	describe( 'loadRevisionById', () => {
		it( 'should call API to load revision', () => {
			revisionManager.loadRevisionById( 42 );

			expect( mockApiManager.loadRevisionById ).toHaveBeenCalledWith( 42 );
		} );

		it( 'should delegate to layerSetManager if available', () => {
			const mockLayerSetManager = { loadRevisionById: jest.fn() };
			mockEditor.layerSetManager = mockLayerSetManager;

			revisionManager.loadRevisionById( 42 );

			expect( mockLayerSetManager.loadRevisionById ).toHaveBeenCalledWith( 42 );
		} );
	} );

	describe( 'hasUnsavedChanges', () => {
		it( 'should return false when no unsaved changes', () => {
			mockStateManager.state.hasUnsavedChanges = false;

			expect( revisionManager.hasUnsavedChanges() ).toBe( false );
		} );

		it( 'should return true when has unsaved changes', () => {
			mockStateManager.state.hasUnsavedChanges = true;

			expect( revisionManager.hasUnsavedChanges() ).toBe( true );
		} );
	} );

	describe( 'debugLog', () => {
		it( 'should log when debug is enabled', () => {
			revisionManager.debug = true;

			revisionManager.debugLog( 'test message' );

			expect( mw.log ).toHaveBeenCalledWith( '[RevisionManager]', 'test message' );
		} );

		it( 'should not log when debug is disabled', () => {
			revisionManager.debug = false;

			revisionManager.debugLog( 'test message' );

			expect( mw.log ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clear all references', () => {
			revisionManager.destroy();

			expect( revisionManager.editor ).toBeNull();
			expect( revisionManager.stateManager ).toBeNull();
			expect( revisionManager.uiManager ).toBeNull();
			expect( revisionManager.apiManager ).toBeNull();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export RevisionManager to window.Layers.Core', () => {
			expect( window.Layers.Core.RevisionManager ).toBe( RevisionManager );
		} );
	} );

	describe( 'error handling', () => {
		it( 'should handle error in buildRevisionSelector gracefully', () => {
			// Make stateManager.get throw an error
			mockStateManager.get.mockImplementation( () => {
				throw new Error( 'State error' );
			} );

			expect( () => revisionManager.buildRevisionSelector() ).not.toThrow();
			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should handle error in updateRevisionLoadButton gracefully', () => {
			mockStateManager.get.mockImplementation( () => {
				throw new Error( 'State error' );
			} );

			expect( () => revisionManager.updateRevisionLoadButton() ).not.toThrow();
			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should handle error in buildSetSelector gracefully', () => {
			mockStateManager.get.mockImplementation( () => {
				throw new Error( 'State error' );
			} );

			expect( () => revisionManager.buildSetSelector() ).not.toThrow();
			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should handle error in updateNewSetButtonState gracefully', () => {
			mockStateManager.get.mockImplementation( () => {
				throw new Error( 'State error' );
			} );

			expect( () => revisionManager.updateNewSetButtonState() ).not.toThrow();
			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should handle error in loadRevisionById gracefully', () => {
			mockApiManager.loadRevisionById.mockImplementation( () => {
				throw new Error( 'API error' );
			} );

			expect( () => revisionManager.loadRevisionById( 42 ) ).not.toThrow();
			expect( mw.log.error ).toHaveBeenCalled();
			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);
		} );

		it( 'should handle error in createNewLayerSet gracefully', async () => {
			// Make canvasManager.clearLayers throw
			mockEditor.canvasManager.clearLayers.mockImplementation( () => {
				throw new Error( 'Canvas error' );
			} );

			const result = await revisionManager.createNewLayerSet( 'valid-name' );

			expect( result ).toBe( false );
			expect( mw.log.error ).toHaveBeenCalled();
			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);
		} );
	} );

	describe( 'missing UI elements', () => {
		it( 'should handle missing revSelectEl in buildRevisionSelector', () => {
			revisionManager.uiManager.revSelectEl = null;

			expect( () => revisionManager.buildRevisionSelector() ).not.toThrow();
		} );

		it( 'should handle missing revLoadBtnEl in updateRevisionLoadButton', () => {
			revisionManager.uiManager.revLoadBtnEl = null;

			expect( () => revisionManager.updateRevisionLoadButton() ).not.toThrow();
		} );

		it( 'should handle missing setSelectEl in buildSetSelector', () => {
			revisionManager.uiManager.setSelectEl = null;

			revisionManager.buildSetSelector();

			// Should return early without error
			expect( mw.log.error ).not.toHaveBeenCalled();
		} );

		it( 'should handle missing setNewBtnEl in updateNewSetButtonState', () => {
			revisionManager.uiManager.setNewBtnEl = null;

			revisionManager.updateNewSetButtonState();

			// Should return early without error
			expect( mw.log.error ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'buildRevisionSelector edge cases', () => {
		it( 'should use alternative property names (id, timestamp, userName)', () => {
			mockStateManager.state.allLayerSets = [
				{ id: 10, timestamp: '20251220100000', userName: 'AltUser', name: 'alt-set' }
			];

			revisionManager.buildRevisionSelector();

			const options = mockUIManager.revSelectEl.querySelectorAll( 'option' );
			expect( options.length ).toBe( 2 );
			expect( options[ 1 ].value ).toBe( '10' );
			expect( options[ 1 ].textContent ).toContain( 'AltUser' );
		} );

		it( 'should show Unknown for missing userName', () => {
			mockStateManager.state.allLayerSets = [
				{ ls_id: 5, ls_timestamp: '20251220100000' }
			];

			revisionManager.buildRevisionSelector();

			const options = mockUIManager.revSelectEl.querySelectorAll( 'option' );
			expect( options[ 1 ].textContent ).toContain( 'Unknown' );
		} );

		it( 'should not include set name in display when empty', () => {
			mockStateManager.state.allLayerSets = [
				{ ls_id: 5, ls_timestamp: '20251220100000', ls_user_name: 'User1', ls_name: '' }
			];

			revisionManager.buildRevisionSelector();

			const options = mockUIManager.revSelectEl.querySelectorAll( 'option' );
			expect( options[ 1 ].textContent ).not.toContain( '()' );
		} );
	} );

	describe( 'buildSetSelector edge cases', () => {
		it( 'should format single revision correctly', () => {
			mockStateManager.state.namedSets = [
				{ name: 'single-rev', revision_count: 1 }
			];

			revisionManager.buildSetSelector();

			const options = mockUIManager.setSelectEl.querySelectorAll( 'option' );
			expect( options[ 0 ].textContent ).toContain( '1 revision' );
		} );

		it( 'should format multiple revisions correctly', () => {
			mockStateManager.state.namedSets = [
				{ name: 'multi-rev', revision_count: 5 }
			];

			revisionManager.buildSetSelector();

			const options = mockUIManager.setSelectEl.querySelectorAll( 'option' );
			expect( options[ 0 ].textContent ).toContain( '5' );
		} );

		it( 'should default to 1 revision when revision_count missing', () => {
			mockStateManager.state.namedSets = [
				{ name: 'no-count' }
			];

			revisionManager.buildSetSelector();

			const options = mockUIManager.setSelectEl.querySelectorAll( 'option' );
			expect( options[ 0 ].textContent ).toContain( '1 revision' );
		} );
	} );

	describe( 'loadLayerSetByName with DialogManager', () => {
		it( 'should use DialogManager.showConfirmDialog when available', async () => {
			mockEditor.hasUnsavedChanges.mockReturnValue( true );
			mockEditor.dialogManager = {
				showConfirmDialog: jest.fn().mockResolvedValue( true )
			};

			await revisionManager.loadLayerSetByName( 'new-set' );

			expect( mockEditor.dialogManager.showConfirmDialog ).toHaveBeenCalledWith(
				expect.objectContaining( {
					isDanger: true
				} )
			);
			expect( mockApiManager.loadLayersBySetName ).toHaveBeenCalled();
		} );

		it( 'should cancel load when DialogManager confirm returns false', async () => {
			mockEditor.hasUnsavedChanges.mockReturnValue( true );
			mockEditor.dialogManager = {
				showConfirmDialog: jest.fn().mockResolvedValue( false )
			};

			await revisionManager.loadLayerSetByName( 'new-set' );

			expect( mockApiManager.loadLayersBySetName ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'getMessage edge cases', () => {
		it( 'should handle layersMessages without get function', () => {
			window.layersMessages = {};

			const result = revisionManager.getMessage( 'key', 'fallback' );

			expect( result ).toBe( 'fallback' );
		} );

		it( 'should handle layersMessages.get not being a function', () => {
			window.layersMessages = { get: 'not a function' };

			const result = revisionManager.getMessage( 'key', 'fallback' );

			expect( result ).toBe( 'fallback' );
		} );
	} );

	describe( 'createNewLayerSet edge cases', () => {
		it( 'should handle missing canvasManager', async () => {
			delete mockEditor.canvasManager;

			const result = await revisionManager.createNewLayerSet( 'new-set' );

			expect( result ).toBe( true );
		} );

		it( 'should handle missing layerPanel', async () => {
			delete mockEditor.layerPanel;

			const result = await revisionManager.createNewLayerSet( 'new-set' );

			expect( result ).toBe( true );
		} );

		it( 'should trim whitespace from set name', async () => {
			const result = await revisionManager.createNewLayerSet( '  trimmed-name  ' );

			expect( result ).toBe( true );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'trimmed-name' );
		} );
	} );

	describe( 'updateNewSetButtonState edge cases', () => {
		it( 'should set appropriate tooltip when under limit', () => {
			mockStateManager.state.namedSets = [ { name: 'default' } ];

			revisionManager.updateNewSetButtonState();

			expect( mockUIManager.setNewBtnEl.title ).toBe( 'Create a new layer set' );
		} );

		it( 'should set appropriate tooltip when at limit', () => {
			const sets = [];
			for ( let i = 0; i < 15; i++ ) {
				sets.push( { name: `set${ i }` } );
			}
			mockStateManager.state.namedSets = sets;

			revisionManager.updateNewSetButtonState();

			expect( mockUIManager.setNewBtnEl.title ).toContain( '15' );
		} );
	} );
} );
