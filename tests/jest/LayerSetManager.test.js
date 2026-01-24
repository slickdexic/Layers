/**
 * LayerSetManager unit tests
 */
'use strict';

// Mock mw object
global.mw = {
	message: jest.fn( ( key ) => ( {
		text: () => key
	} ) ),
	msg: jest.fn( ( key ) => key ),
	config: {
		get: jest.fn( ( key, defaultValue ) => {
			const config = {
				wgLayersMaxNamedSets: 15,
				wgUserName: 'TestUser'
			};
			return config[ key ] !== undefined ? config[ key ] : defaultValue;
		} )
	},
	log: jest.fn(),
	notify: jest.fn()
};
mw.log.error = jest.fn();

// Load LayerSetManager
const LayerSetManager = require( '../../resources/ext.layers.editor/LayerSetManager.js' );

describe( 'LayerSetManager', () => {
	let layerSetManager;
	let mockStateManager;
	let mockApiManager;
	let mockUIManager;
	let mockEditor;

	beforeEach( () => {
		jest.clearAllMocks();

		// Mock StateManager
		const state = {
			allLayerSets: [],
			currentLayerSetId: null,
			namedSets: [],
			currentSetName: 'default',
			layers: [],
			hasUnsavedChanges: false,
			setRevisions: []
		};

		mockStateManager = {
			get: jest.fn( ( key ) => state[ key ] ),
			set: jest.fn( ( key, value ) => {
				state[ key ] = value;
			} )
		};

		// Mock APIManager
		mockApiManager = {
			loadLayersBySetName: jest.fn().mockResolvedValue( {} ),
			loadRevisionById: jest.fn(),
			fetchLayerSetInfo: jest.fn().mockResolvedValue( {} )
		};

		// Mock UIManager with DOM elements
		mockUIManager = {
			revSelectEl: document.createElement( 'select' ),
			revLoadBtnEl: document.createElement( 'button' ),
			setSelectEl: document.createElement( 'select' ),
			setNewBtnEl: document.createElement( 'button' )
		};

		// Mock Editor
		mockEditor = {
			canvasManager: {
				clearLayers: jest.fn(),
				render: jest.fn()
			},
			layerPanel: {
				updateLayerList: jest.fn()
			},
			updateSaveButtonState: jest.fn()
		};

		layerSetManager = new LayerSetManager( {
			editor: mockEditor,
			stateManager: mockStateManager,
			apiManager: mockApiManager,
			uiManager: mockUIManager,
			debug: false
		} );
	} );

	afterEach( () => {
		if ( layerSetManager ) {
			layerSetManager.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should initialize with config', () => {
			expect( layerSetManager.editor ).toBe( mockEditor );
			expect( layerSetManager.stateManager ).toBe( mockStateManager );
			expect( layerSetManager.apiManager ).toBe( mockApiManager );
			expect( layerSetManager.uiManager ).toBe( mockUIManager );
		} );

		it( 'should handle empty config', () => {
			const emptyManager = new LayerSetManager( {} );
			expect( emptyManager.editor ).toBeNull();
			expect( emptyManager.stateManager ).toBeNull();
			emptyManager.destroy();
		} );

		it( 'should set debug mode from config', () => {
			const debugManager = new LayerSetManager( { debug: true } );
			expect( debugManager.debug ).toBe( true );
			debugManager.destroy();
		} );
	} );

	describe( 'parseMWTimestamp', () => {
		it( 'should parse valid MediaWiki binary(14) timestamp', () => {
			const date = layerSetManager.parseMWTimestamp( '20250115143022' );
			expect( date.getFullYear() ).toBe( 2025 );
			expect( date.getMonth() ).toBe( 0 ); // January (0-indexed)
			expect( date.getDate() ).toBe( 15 );
			expect( date.getHours() ).toBe( 14 );
			expect( date.getMinutes() ).toBe( 30 );
			expect( date.getSeconds() ).toBe( 22 );
		} );

		it( 'should return current date for null input', () => {
			const before = Date.now();
			const date = layerSetManager.parseMWTimestamp( null );
			const after = Date.now();
			expect( date.getTime() ).toBeGreaterThanOrEqual( before );
			expect( date.getTime() ).toBeLessThanOrEqual( after );
		} );

		it( 'should return current date for undefined input', () => {
			const date = layerSetManager.parseMWTimestamp( undefined );
			expect( date instanceof Date ).toBe( true );
		} );

		it( 'should return current date for non-string input', () => {
			const date = layerSetManager.parseMWTimestamp( 123456 );
			expect( date instanceof Date ).toBe( true );
		} );

		it( 'should parse midnight correctly', () => {
			const date = layerSetManager.parseMWTimestamp( '20250101000000' );
			expect( date.getHours() ).toBe( 0 );
			expect( date.getMinutes() ).toBe( 0 );
			expect( date.getSeconds() ).toBe( 0 );
		} );
	} );

	describe( 'buildRevisionSelector', () => {
		it( 'should build empty selector with default option', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'allLayerSets' ) {
					return [];
				}
				if ( key === 'currentLayerSetId' ) {
					return null;
				}
				return null;
			} );

			layerSetManager.buildRevisionSelector();

			expect( mockUIManager.revSelectEl.children.length ).toBe( 1 );
			expect( mockUIManager.revSelectEl.children[ 0 ].value ).toBe( '' );
		} );

		it( 'should add revision options from allLayerSets', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'allLayerSets' ) {
					return [
						{ ls_id: 1, ls_timestamp: '20250115143022', ls_user_name: 'User1', ls_name: 'default' },
						{ ls_id: 2, ls_timestamp: '20250116100000', ls_user_name: 'User2', ls_name: 'test' }
					];
				}
				if ( key === 'currentLayerSetId' ) {
					return 1;
				}
				return null;
			} );

			layerSetManager.buildRevisionSelector();

			expect( mockUIManager.revSelectEl.children.length ).toBe( 3 ); // default + 2 revisions
			expect( mockUIManager.revSelectEl.children[ 1 ].value ).toBe( '1' );
			expect( mockUIManager.revSelectEl.children[ 2 ].value ).toBe( '2' );
		} );

		it( 'should select current revision', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'allLayerSets' ) {
					return [
						{ ls_id: 1, ls_timestamp: '20250115143022', ls_user_name: 'User1' },
						{ ls_id: 2, ls_timestamp: '20250116100000', ls_user_name: 'User2' }
					];
				}
				if ( key === 'currentLayerSetId' ) {
					return 2;
				}
				return null;
			} );

			layerSetManager.buildRevisionSelector();

			expect( mockUIManager.revSelectEl.children[ 2 ].selected ).toBe( true );
		} );

		it( 'should handle missing UI element gracefully', () => {
			layerSetManager.uiManager.revSelectEl = null;
			expect( () => layerSetManager.buildRevisionSelector() ).not.toThrow();
		} );
	} );

	describe( 'updateRevisionLoadButton', () => {
		it( 'should disable button when no revision selected', () => {
			mockUIManager.revSelectEl.value = '';
			mockStateManager.get.mockReturnValue( null );

			layerSetManager.updateRevisionLoadButton();

			expect( mockUIManager.revLoadBtnEl.disabled ).toBe( true );
		} );

		it( 'should disable button when current revision is selected', () => {
			mockUIManager.revSelectEl.value = '5';
			mockStateManager.get.mockReturnValue( 5 );

			layerSetManager.updateRevisionLoadButton();

			expect( mockUIManager.revLoadBtnEl.disabled ).toBe( true );
		} );

		it( 'should enable button when different revision is selected', () => {
			// Create fresh elements for this test with an actual option
			const btn = document.createElement( 'button' );
			btn.disabled = true; // Start disabled
			const sel = document.createElement( 'select' );
			const opt = document.createElement( 'option' );
			opt.value = '3';
			opt.selected = true;
			sel.appendChild( opt );

			layerSetManager.uiManager = {
				revLoadBtnEl: btn,
				revSelectEl: sel
			};

			// Set up mock to return 5 for currentLayerSetId
			layerSetManager.stateManager = {
				get: function ( key ) {
					if ( key === 'currentLayerSetId' ) {
						return 5; // Different from selected '3'
					}
					return null;
				}
			};

			layerSetManager.updateRevisionLoadButton();

			// 3 !== 5, so isCurrent should be false
			// selectedValue is '3' (truthy)
			// disabled = !selectedValue || isCurrent = !true || false = false
			expect( btn.disabled ).toBe( false );
		} );

		it( 'should handle missing UI elements gracefully', () => {
			layerSetManager.uiManager.revLoadBtnEl = null;
			expect( () => layerSetManager.updateRevisionLoadButton() ).not.toThrow();
		} );
	} );

	describe( 'buildSetSelector', () => {
		it( 'should build default option when no sets exist', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return [];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			layerSetManager.buildSetSelector();

			expect( mockUIManager.setSelectEl.children.length ).toBe( 2 ); // default + new option
			expect( mockUIManager.setSelectEl.children[ 0 ].value ).toBe( 'default' );
		} );

		it( 'should build options from named sets', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return [
						{ name: 'default', revision_count: 3 },
						{ name: 'anatomy', revision_count: 1 }
					];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			layerSetManager.buildSetSelector();

			expect( mockUIManager.setSelectEl.children.length ).toBe( 3 ); // 2 sets + new option
			expect( mockUIManager.setSelectEl.children[ 0 ].value ).toBe( 'default' );
			expect( mockUIManager.setSelectEl.children[ 1 ].value ).toBe( 'anatomy' );
			expect( mockUIManager.setSelectEl.children[ 2 ].value ).toBe( '__new__' );
		} );

		it( 'should not show new option when at limit', () => {
			const maxSets = [];
			for ( let i = 0; i < 15; i++ ) {
				maxSets.push( { name: 'set' + i, revision_count: 1 } );
			}

			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return maxSets;
				}
				if ( key === 'currentSetName' ) {
					return 'set0';
				}
				return null;
			} );

			layerSetManager.buildSetSelector();

			// Should have 15 sets but no __new__ option
			const options = mockUIManager.setSelectEl.children;
			const hasNew = Array.from( options ).some( ( opt ) => opt.value === '__new__' );
			expect( hasNew ).toBe( false );
		} );

		it( 'should select current set', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return [
						{ name: 'default', revision_count: 1 },
						{ name: 'active', revision_count: 2 }
					];
				}
				if ( key === 'currentSetName' ) {
					return 'active';
				}
				return null;
			} );

			layerSetManager.buildSetSelector();

			expect( mockUIManager.setSelectEl.children[ 1 ].selected ).toBe( true );
		} );
	} );

	describe( 'updateNewSetButtonState', () => {
		it( 'should disable button when at limit', () => {
			const maxSets = [];
			for ( let i = 0; i < 15; i++ ) {
				maxSets.push( { name: 'set' + i } );
			}

			mockStateManager.get.mockReturnValue( maxSets );

			layerSetManager.updateNewSetButtonState();

			expect( mockUIManager.setNewBtnEl.disabled ).toBe( true );
		} );

		it( 'should enable button when under limit', () => {
			mockStateManager.get.mockReturnValue( [ { name: 'default' } ] );

			layerSetManager.updateNewSetButtonState();

			expect( mockUIManager.setNewBtnEl.disabled ).toBe( false );
		} );

		it( 'should handle missing button gracefully', () => {
			layerSetManager.uiManager.setNewBtnEl = null;
			expect( () => layerSetManager.updateNewSetButtonState() ).not.toThrow();
		} );
	} );

	describe( 'loadLayerSetByName', () => {
		it( 'should call API to load set', async () => {
			mockStateManager.get.mockReturnValue( false ); // no unsaved changes

			await layerSetManager.loadLayerSetByName( 'anatomy' );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'anatomy' );
			expect( mockApiManager.loadLayersBySetName ).toHaveBeenCalledWith( 'anatomy' );
		} );

		it( 'should check for unsaved changes', async () => {
			mockStateManager.get.mockReturnValue( true ); // has unsaved changes
			global.confirm = jest.fn().mockReturnValue( false );

			await layerSetManager.loadLayerSetByName( 'anatomy' );

			expect( global.confirm ).toHaveBeenCalled();
			expect( mockApiManager.loadLayersBySetName ).not.toHaveBeenCalled();
		} );

		it( 'should proceed when user confirms', async () => {
			mockStateManager.get.mockReturnValue( true ); // has unsaved changes
			global.confirm = jest.fn().mockReturnValue( true );

			await layerSetManager.loadLayerSetByName( 'anatomy' );

			expect( mockApiManager.loadLayersBySetName ).toHaveBeenCalledWith( 'anatomy' );
		} );

		it( 'should handle empty set name', async () => {
			await layerSetManager.loadLayerSetByName( '' );

			expect( mockApiManager.loadLayersBySetName ).not.toHaveBeenCalled();
		} );

		it( 'should show notification on success', async () => {
			mockStateManager.get.mockReturnValue( false );

			await layerSetManager.loadLayerSetByName( 'test-set' );

			expect( mw.notify ).toHaveBeenCalled();
		} );
	} );

	describe( 'createNewLayerSet', () => {
		beforeEach( () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return [ { name: 'default', revision_count: 1 } ];
				}
				return null;
			} );
		} );

		it( 'should create set with valid name', async () => {
			const result = await layerSetManager.createNewLayerSet( 'new-set' );

			expect( result ).toBe( true );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'new-set' );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'layers', [] );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'hasUnsavedChanges', true );
		} );

		it( 'should reject empty name', async () => {
			const result = await layerSetManager.createNewLayerSet( '' );

			expect( result ).toBe( false );
			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should reject whitespace-only name', async () => {
			const result = await layerSetManager.createNewLayerSet( '   ' );

			expect( result ).toBe( false );
		} );

		it( 'should reject invalid characters in name', async () => {
			const result = await layerSetManager.createNewLayerSet( 'invalid name!' );

			expect( result ).toBe( false );
			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should reject duplicate name (case insensitive)', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return [ { name: 'existing' } ];
				}
				return null;
			} );

			const result = await layerSetManager.createNewLayerSet( 'EXISTING' );

			expect( result ).toBe( false );
		} );

		it( 'should reject when at limit', async () => {
			const maxSets = [];
			for ( let i = 0; i < 15; i++ ) {
				maxSets.push( { name: 'set' + i } );
			}

			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'namedSets' ) {
					return maxSets;
				}
				return null;
			} );

			const result = await layerSetManager.createNewLayerSet( 'new-set' );

			expect( result ).toBe( false );
		} );

		it( 'should clear canvas on creation', async () => {
			const result = await layerSetManager.createNewLayerSet( 'fresh-set' );

			expect( result ).toBe( true );
			expect( mockEditor.canvasManager.clearLayers ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.render ).toHaveBeenCalled();
		} );

		it( 'should update layer panel on creation', async () => {
			const result = await layerSetManager.createNewLayerSet( 'fresh-set' );

			expect( result ).toBe( true );
			expect( mockEditor.layerPanel.updateLayerList ).toHaveBeenCalledWith( [] );
		} );

		it( 'should accept valid names with hyphens and underscores', async () => {
			const result = await layerSetManager.createNewLayerSet( 'my_new-set123' );

			expect( result ).toBe( true );
		} );

		it( 'should trim whitespace from name', async () => {
			const result = await layerSetManager.createNewLayerSet( '  trimmed  ' );

			expect( result ).toBe( true );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'trimmed' );
		} );
	} );

	describe( 'hasUnsavedChanges', () => {
		it( 'should return true when state has unsaved changes', () => {
			mockStateManager.get.mockReturnValue( true );

			expect( layerSetManager.hasUnsavedChanges() ).toBe( true );
		} );

		it( 'should return false when no unsaved changes', () => {
			mockStateManager.get.mockReturnValue( false );

			expect( layerSetManager.hasUnsavedChanges() ).toBe( false );
		} );

		it( 'should return false when stateManager is null', () => {
			layerSetManager.stateManager = null;

			expect( layerSetManager.hasUnsavedChanges() ).toBe( false );
		} );
	} );

	describe( 'loadRevisionById', () => {
		it( 'should call API to load revision', () => {
			layerSetManager.loadRevisionById( 123 );

			expect( mockApiManager.loadRevisionById ).toHaveBeenCalledWith( 123 );
		} );

		it( 'should handle missing API gracefully', () => {
			layerSetManager.apiManager = null;

			expect( () => layerSetManager.loadRevisionById( 123 ) ).not.toThrow();
		} );
	} );

	describe( 'reloadRevisions', () => {
		it( 'should fetch info and rebuild selectors', async () => {
			await layerSetManager.reloadRevisions();

			expect( mockApiManager.fetchLayerSetInfo ).toHaveBeenCalled();
		} );

		it( 'should handle API error gracefully', async () => {
			mockApiManager.fetchLayerSetInfo.mockRejectedValue( new Error( 'API error' ) );

			await expect( layerSetManager.reloadRevisions() ).resolves.not.toThrow();
		} );
	} );

	describe( 'getCurrentSetName', () => {
		it( 'should return current set name from state', () => {
			mockStateManager.get.mockReturnValue( 'anatomy' );

			expect( layerSetManager.getCurrentSetName() ).toBe( 'anatomy' );
		} );

		it( 'should return default when not set', () => {
			mockStateManager.get.mockReturnValue( null );

			expect( layerSetManager.getCurrentSetName() ).toBe( 'default' );
		} );

		it( 'should return default when stateManager is null', () => {
			layerSetManager.stateManager = null;

			expect( layerSetManager.getCurrentSetName() ).toBe( 'default' );
		} );
	} );

	describe( 'getNamedSets', () => {
		it( 'should return named sets from state', () => {
			const sets = [ { name: 'a' }, { name: 'b' } ];
			mockStateManager.get.mockReturnValue( sets );

			expect( layerSetManager.getNamedSets() ).toBe( sets );
		} );

		it( 'should return empty array when no sets', () => {
			mockStateManager.get.mockReturnValue( null );

			expect( layerSetManager.getNamedSets() ).toEqual( [] );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should null all references', () => {
			layerSetManager.destroy();

			expect( layerSetManager.editor ).toBeNull();
			expect( layerSetManager.stateManager ).toBeNull();
			expect( layerSetManager.apiManager ).toBeNull();
			expect( layerSetManager.uiManager ).toBeNull();
			expect( layerSetManager.config ).toBeNull();
		} );
	} );

	describe( 'getMessage', () => {
		it( 'should use mw.message when available', () => {
			// Clear layersMessages to test mw.message fallback path
			const originalLayersMessages = global.layersMessages;
			delete global.layersMessages;

			const result = layerSetManager.getMessage( 'test-key', 'fallback' );

			expect( mw.message ).toHaveBeenCalledWith( 'test-key' );
			expect( result ).toBe( 'test-key' );

			global.layersMessages = originalLayersMessages;
		} );

		it( 'should return fallback when mw not available', () => {
			const originalMw = global.mw;
			global.mw = undefined;

			const noMwManager = new LayerSetManager( {} );
			const result = noMwManager.getMessage( 'test-key', 'fallback' );

			expect( result ).toBe( 'fallback' );

			global.mw = originalMw;
			noMwManager.destroy();
		} );

		it( 'should return fallback when mw.message throws exception', () => {
			const originalLayersMessages = global.layersMessages;
			delete global.layersMessages;

			mw.message.mockImplementation( () => {
				throw new Error( 'mw.message failed' );
			} );

			const result = layerSetManager.getMessage( 'test-key', 'fallback-value' );

			expect( result ).toBe( 'fallback-value' );

			global.layersMessages = originalLayersMessages;
		} );
	} );

	describe( 'parseMWTimestamp', () => {
		it( 'should return current date for null timestamp', () => {
			const before = Date.now();
			const result = layerSetManager.parseMWTimestamp( null );
			const after = Date.now();

			expect( result ).toBeInstanceOf( Date );
			expect( result.getTime() ).toBeGreaterThanOrEqual( before );
			expect( result.getTime() ).toBeLessThanOrEqual( after );
		} );

		it( 'should return current date for non-string timestamp', () => {
			const before = Date.now();
			const result = layerSetManager.parseMWTimestamp( 12345 );
			const after = Date.now();

			expect( result ).toBeInstanceOf( Date );
			expect( result.getTime() ).toBeGreaterThanOrEqual( before );
			expect( result.getTime() ).toBeLessThanOrEqual( after );
		} );

		it( 'should return current date for timestamp shorter than 14 chars', () => {
			const before = Date.now();
			const result = layerSetManager.parseMWTimestamp( '2024010112' ); // Only 10 chars
			const after = Date.now();

			expect( result ).toBeInstanceOf( Date );
			expect( result.getTime() ).toBeGreaterThanOrEqual( before );
			expect( result.getTime() ).toBeLessThanOrEqual( after );
		} );

		it( 'should parse valid MediaWiki timestamp', () => {
			// YYYYMMDDHHmmss format
			const result = layerSetManager.parseMWTimestamp( '20240315143025' );

			expect( result ).toBeInstanceOf( Date );
			expect( result.getFullYear() ).toBe( 2024 );
			expect( result.getMonth() ).toBe( 2 ); // 0-indexed, so March = 2
			expect( result.getDate() ).toBe( 15 );
			expect( result.getHours() ).toBe( 14 );
			expect( result.getMinutes() ).toBe( 30 );
			expect( result.getSeconds() ).toBe( 25 );
		} );
	} );

	describe( 'showConfirmDialog', () => {
		it( 'should use dialogManager when available', async () => {
			const mockDialogManager = {
				showConfirmDialog: jest.fn().mockResolvedValue( true )
			};
			layerSetManager.editor = { dialogManager: mockDialogManager };

			const result = await layerSetManager.showConfirmDialog( {
				message: 'Are you sure?',
				title: 'Confirm'
			} );

			expect( mockDialogManager.showConfirmDialog ).toHaveBeenCalledWith( {
				message: 'Are you sure?',
				title: 'Confirm'
			} );
			expect( result ).toBe( true );
		} );

		it( 'should fall back to native confirm when dialogManager unavailable', async () => {
			layerSetManager.editor = null;
			const originalConfirm = window.confirm;
			window.confirm = jest.fn().mockReturnValue( true );

			const result = await layerSetManager.showConfirmDialog( {
				message: 'Are you sure?'
			} );

			expect( window.confirm ).toHaveBeenCalledWith( 'Are you sure?' );
			expect( result ).toBe( true );

			window.confirm = originalConfirm;
		} );

		it( 'should return false from native confirm when declined', async () => {
			layerSetManager.editor = {};
			const originalConfirm = window.confirm;
			window.confirm = jest.fn().mockReturnValue( false );

			const result = await layerSetManager.showConfirmDialog( {
				message: 'Delete item?'
			} );

			expect( result ).toBe( false );

			window.confirm = originalConfirm;
		} );
	} );

	describe( 'debugLog', () => {
		it( 'should log when debug is enabled', () => {
			layerSetManager.debug = true;
			layerSetManager.debugLog( 'test message' );

			expect( mw.log ).toHaveBeenCalled();
		} );

		it( 'should not log when debug is disabled', () => {
			layerSetManager.debug = false;
			layerSetManager.debugLog( 'test message' );

			expect( mw.log ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'errorLog', () => {
		it( 'should log errors', () => {
			layerSetManager.errorLog( 'error message' );

			expect( mw.log.error ).toHaveBeenCalled();
		} );
	} );

	describe( 'getMessageWithParams', () => {
		it( 'should use layersMessages.getWithParams when available', () => {
			const originalLayersMessages = window.layersMessages;
			window.layersMessages = {
				getWithParams: jest.fn().mockReturnValue( 'Loaded set: test' )
			};

			const result = layerSetManager.getMessageWithParams(
				'layers-set-loaded',
				[ 'test' ],
				'fallback'
			);

			expect( window.layersMessages.getWithParams ).toHaveBeenCalledWith(
				'layers-set-loaded',
				[ 'test' ],
				'fallback'
			);
			expect( result ).toBe( 'Loaded set: test' );

			window.layersMessages = originalLayersMessages;
		} );

		it( 'should fall back to mw.message with params', () => {
			const originalLayersMessages = window.layersMessages;
			window.layersMessages = null;

			mw.message.mockImplementation( ( key, ...params ) => ( {
				text: () => `${key} with ${params.join( ', ' )}`
			} ) );

			const result = layerSetManager.getMessageWithParams(
				'test-key',
				[ 'param1', 'param2' ],
				'fallback'
			);

			expect( result ).toBe( 'test-key with param1, param2' );

			window.layersMessages = originalLayersMessages;
		} );

		it( 'should use manual substitution as last resort', () => {
			const originalMw = window.mw;
			const originalLayersMessages = window.layersMessages;
			window.mw = undefined;
			window.layersMessages = null;

			const newManager = new LayerSetManager( {} );
			const result = newManager.getMessageWithParams(
				'test-key',
				[ 'foo', 'bar' ],
				'Value $1 and $2'
			);

			expect( result ).toBe( 'Value foo and bar' );

			window.mw = originalMw;
			window.layersMessages = originalLayersMessages;
			newManager.destroy();
		} );

		it( 'should handle mw.message exception gracefully', () => {
			const originalLayersMessages = window.layersMessages;
			window.layersMessages = null;

			mw.message.mockImplementation( () => {
				throw new Error( 'mw.message failed' );
			} );

			const result = layerSetManager.getMessageWithParams(
				'test-key',
				[ 'param1' ],
				'Default $1'
			);

			expect( result ).toBe( 'Default param1' );

			window.layersMessages = originalLayersMessages;
		} );
	} );

	describe( 'createNewLayerSet', () => {
		it( 'should return false for empty name', async () => {
			const result = await layerSetManager.createNewLayerSet( '' );

			expect( result ).toBe( false );
		} );

		it( 'should return false for whitespace-only name', async () => {
			const result = await layerSetManager.createNewLayerSet( '   ' );

			expect( result ).toBe( false );
		} );

		it( 'should return false for invalid name characters', async () => {
			const result = await layerSetManager.createNewLayerSet( 'my set!' );

			expect( result ).toBe( false );
		} );

		it( 'should return false for name with spaces', async () => {
			const result = await layerSetManager.createNewLayerSet( 'my set name' );

			expect( result ).toBe( false );
		} );
	} );

	describe( 'loadRevisionById', () => {
		it( 'should delegate to apiManager when available', () => {
			const mockApiManager = {
				loadRevisionById: jest.fn()
			};
			layerSetManager.apiManager = mockApiManager;

			layerSetManager.loadRevisionById( 123 );

			expect( mockApiManager.loadRevisionById ).toHaveBeenCalledWith( 123 );
		} );

		it( 'should handle error when apiManager throws', () => {
			const mockApiManager = {
				loadRevisionById: jest.fn().mockImplementation( () => {
					throw new Error( 'API error' );
				} )
			};
			layerSetManager.apiManager = mockApiManager;

			expect( () => layerSetManager.loadRevisionById( 123 ) ).not.toThrow();
			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should do nothing when apiManager unavailable', () => {
			layerSetManager.apiManager = null;

			expect( () => layerSetManager.loadRevisionById( 123 ) ).not.toThrow();
		} );
	} );

	describe( 'reloadRevisions', () => {
		it( 'should fetch and rebuild selectors', async () => {
			const mockApiManager = {
				fetchLayerSetInfo: jest.fn().mockResolvedValue( undefined )
			};
			layerSetManager.apiManager = mockApiManager;
			jest.spyOn( layerSetManager, 'buildRevisionSelector' ).mockImplementation( () => {} );
			jest.spyOn( layerSetManager, 'buildSetSelector' ).mockImplementation( () => {} );

			await layerSetManager.reloadRevisions();

			expect( mockApiManager.fetchLayerSetInfo ).toHaveBeenCalled();
			expect( layerSetManager.buildRevisionSelector ).toHaveBeenCalled();
			expect( layerSetManager.buildSetSelector ).toHaveBeenCalled();
		} );

		it( 'should handle errors gracefully', async () => {
			const mockApiManager = {
				fetchLayerSetInfo: jest.fn().mockRejectedValue( new Error( 'Network error' ) )
			};
			layerSetManager.apiManager = mockApiManager;

			await expect( layerSetManager.reloadRevisions() ).resolves.not.toThrow();
		} );
	} );

	describe( 'buildRevisionSelector error handling', () => {
		it( 'should handle errors in revision selector building', () => {
			// Force an error by setting stateManager.get to throw
			layerSetManager.stateManager = {
				get: jest.fn().mockImplementation( () => {
					throw new Error( 'State error' );
				} )
			};

			// Should not throw
			expect( () => layerSetManager.buildRevisionSelector() ).not.toThrow();
		} );
	} );

	describe( 'updateRevisionLoadButton edge cases', () => {
		it( 'should return early when revLoadBtnEl is missing', () => {
			layerSetManager.uiManager = { revLoadBtnEl: null, revSelectEl: {} };

			expect( () => layerSetManager.updateRevisionLoadButton() ).not.toThrow();
		} );

		it( 'should return early when revSelectEl is missing', () => {
			layerSetManager.uiManager = { revLoadBtnEl: {}, revSelectEl: null };

			expect( () => layerSetManager.updateRevisionLoadButton() ).not.toThrow();
		} );

		it( 'should handle errors in updateRevisionLoadButton', () => {
			layerSetManager.uiManager = {
				get revLoadBtnEl() {
					throw new Error( 'Access error' );
				}
			};

			// Should not throw
			expect( () => layerSetManager.updateRevisionLoadButton() ).not.toThrow();
		} );
	} );

	describe( 'buildSetSelector edge cases', () => {
		it( 'should return early when setSelectEl is null', () => {
			layerSetManager.uiManager = { setSelectEl: null };
			layerSetManager.stateManager = {
				get: jest.fn( ( key ) => {
					if ( key === 'namedSets' ) {
						return [ { name: 'test' } ];
					}
					return null;
				} )
			};

			// Should not throw and return early
			expect( () => layerSetManager.buildSetSelector() ).not.toThrow();
		} );
	} );

	describe( 'loadLayerSetByName error handling', () => {
		it( 'should handle errors during layer set loading', async () => {
			const mockApiManager = {
				loadLayersBySetName: jest.fn().mockRejectedValue( new Error( 'API error' ) )
			};
			layerSetManager.apiManager = mockApiManager;
			layerSetManager.stateManager = {
				get: jest.fn( () => false ), // No unsaved changes
				set: jest.fn()
			};

			// Should not throw
			await expect( layerSetManager.loadLayerSetByName( 'test-set' ) ).resolves.not.toThrow();

			// Should show error notification
			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);
		} );
	} );

	describe( 'createNewLayerSet error handling', () => {
		it( 'should handle errors during layer set creation', async () => {
			// Force an error in the creation process
			layerSetManager.stateManager = {
				get: jest.fn( () => [] ) // empty namedSets
			};
			layerSetManager.apiManager = {
				saveCurrentLayers: jest.fn().mockRejectedValue( new Error( 'Save error' ) )
			};

			const result = await layerSetManager.createNewLayerSet( 'new-set' );

			// Should return false on error
			expect( result ).toBe( false );

			// Should show error notification
			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);
		} );
	} );
} );
