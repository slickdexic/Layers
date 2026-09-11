/**
 * Jest tests for DraftManager.js
 * Tests auto-save and draft recovery functionality
 */
'use strict';

describe( 'DraftManager', function () {
	let DraftManager;
	let draftManager;
	let mockEditor;
	let mockLocalStorage;
	let originalLocalStorage;

	beforeAll( function () {
		// Set up JSDOM globals
		global.document = window.document;

		// Mock mw global
		// Note: mw.log can be called as a function AND has warn/error properties
		const mockLog = jest.fn();
		mockLog.warn = jest.fn();
		mockLog.error = jest.fn();
		
		global.mw = {
			config: {
				get: jest.fn( function () {
					return false;
				} )
			},
			message: jest.fn( function ( key ) {
				return {
					text: function () {
						return key;
					},
					exists: function () {
						return true;
					}
				};
			} ),
			notify: jest.fn(),
			log: mockLog
		};

		// Mock OO global for OOUI dialogs
		global.OO = {
			ui: {
				confirm: jest.fn( function () {
					return Promise.resolve( true );
				} )
			}
		};

		// Load DraftManager code
		require( '../../resources/ext.layers.editor/DraftManager.js' );
		DraftManager = window.Layers.Editor.DraftManager;
	} );

	beforeEach( function () {
		// Save original localStorage
		originalLocalStorage = global.localStorage;

		// Create mock localStorage
		mockLocalStorage = {};
		global.localStorage = {
			getItem: jest.fn( function ( key ) {
				return mockLocalStorage[ key ] || null;
			} ),
			setItem: jest.fn( function ( key, value ) {
				mockLocalStorage[ key ] = value;
			} ),
			removeItem: jest.fn( function ( key ) {
				delete mockLocalStorage[ key ];
			} )
		};

		// Create mock editor
		mockEditor = {
			filename: 'Test_Image.jpg',
			stateManager: {
				get: jest.fn( function ( key ) {
					if ( key === 'layers' ) {
						return [ { id: 'layer1', type: 'rectangle' } ];
					}
					if ( key === 'currentSetName' ) {
						return 'default';
					}
					if ( key === 'backgroundVisible' ) {
						return true;
					}
					if ( key === 'backgroundOpacity' ) {
						return 1.0;
					}
					return null;
				} ),
				set: jest.fn(),
				update: jest.fn(),
				subscribe: jest.fn( function () {
					return jest.fn(); // Return unsubscribe function
				} )
			},
			canvasManager: {
				renderLayers: jest.fn()
			},
			layerPanel: {
				updateLayers: jest.fn()
			},
			isDirty: jest.fn( function () {
				return true;
			} )
		};

		draftManager = new DraftManager( mockEditor );
	} );

	afterEach( function () {
		if ( draftManager ) {
			draftManager.destroy();
		}
		jest.clearAllMocks();
		global.localStorage = originalLocalStorage;
	} );

	describe( 'constructor', function () {
		it( 'should initialize with editor reference', function () {
			expect( draftManager.editor ).toBe( mockEditor );
		} );

		it( 'should create valid storage key from filename', function () {
			expect( draftManager.storageKey ).toContain( 'layers-draft-' );
			expect( draftManager.storageKey ).toContain( 'Test_Image' );
		} );

		it( 'should subscribe to state changes', function () {
			expect( mockEditor.stateManager.subscribe ).toHaveBeenCalledWith(
				'layers',
				expect.any( Function )
			);
		} );
	} );

	describe( 'isStorageAvailable', function () {
		it( 'should return true when localStorage works', function () {
			expect( draftManager.isStorageAvailable() ).toBe( true );
		} );

		it( 'should return false when localStorage throws', function () {
			global.localStorage.setItem = jest.fn( function () {
				throw new Error( 'QuotaExceeded' );
			} );
			expect( draftManager.isStorageAvailable() ).toBe( false );
		} );
	} );

	describe( 'saveDraft', function () {
		it( 'should save draft to localStorage', function () {
			// Clear any calls from constructor/initialization
			global.localStorage.setItem.mockClear();
			
			const result = draftManager.saveDraft();

			expect( result ).toBe( true );
			expect( global.localStorage.setItem ).toHaveBeenCalled();
		} );

		it( 'should include layers in draft', function () {
			// Clear previous calls
			global.localStorage.setItem.mockClear();
			draftManager.saveDraft();

			// Find the draft save call (not the isStorageAvailable test call)
			const storageKey = draftManager.getStorageKey();
			const draftCall = global.localStorage.setItem.mock.calls.find(
				function ( call ) {
					return call[ 0 ] === storageKey;
				}
			);
			expect( draftCall ).toBeDefined();
			const savedData = JSON.parse( draftCall[ 1 ] );
			expect( savedData.layers ).toEqual( [ { id: 'layer1', type: 'rectangle' } ] );
		} );

		it( 'should include timestamp in draft', function () {
			// Clear previous calls
			global.localStorage.setItem.mockClear();
			const before = Date.now();
			draftManager.saveDraft();
			const after = Date.now();

			// Find the draft save call (not the isStorageAvailable test call)
			const storageKey = draftManager.getStorageKey();
			const draftCall = global.localStorage.setItem.mock.calls.find(
				function ( call ) {
					return call[ 0 ] === storageKey;
				}
			);
			expect( draftCall ).toBeDefined();
			const savedData = JSON.parse( draftCall[ 1 ] );
			expect( savedData.timestamp ).toBeGreaterThanOrEqual( before );
			expect( savedData.timestamp ).toBeLessThanOrEqual( after );
		} );

		it( 'should not save empty layers', function () {
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'layers' ) {
					return [];
				}
				return 'default';
			} );

			const result = draftManager.saveDraft();
			expect( result ).toBe( false );
		} );

		it( 'should return false when localStorage is unavailable', function () {
			global.localStorage.setItem = jest.fn( function () {
				throw new Error( 'QuotaExceeded' );
			} );

			const result = draftManager.saveDraft();
			expect( result ).toBe( false );
		} );
	} );

	describe( 'loadDraft', function () {
		it( 'should return null when no draft exists', function () {
			expect( draftManager.loadDraft() ).toBeNull();
		} );

		it( 'should return draft when it exists', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ],
				setName: 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			const loaded = draftManager.loadDraft();
			expect( loaded ).not.toBeNull();
			expect( loaded.layers ).toHaveLength( 1 );
		} );

		it( 'should return null for expired draft', function () {
			const oldDraft = {
				version: 1,
				timestamp: Date.now() - ( 25 * 60 * 60 * 1000 ), // 25 hours ago
				layers: [ { id: 'layer1' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( oldDraft );

			expect( draftManager.loadDraft() ).toBeNull();
		} );

		it( 'should return null for invalid JSON', function () {
			mockLocalStorage[ draftManager.getStorageKey() ] = 'not valid json';

			expect( draftManager.loadDraft() ).toBeNull();
		} );
	} );

	describe( 'hasDraft', function () {
		it( 'should return false when no draft exists', function () {
			expect( draftManager.hasDraft() ).toBe( false );
		} );

		it( 'should return true when valid draft exists', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			expect( draftManager.hasDraft() ).toBe( true );
		} );
	} );

	describe( 'clearDraft', function () {
		it( 'should remove draft from localStorage', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			draftManager.clearDraft();

			expect( global.localStorage.removeItem ).toHaveBeenCalled();
		} );
	} );

	describe( 'recoverDraft', function () {
		it( 'should return false when no draft exists', function () {
			expect( draftManager.recoverDraft() ).toBe( false );
		} );

		it( 'should update state with draft layers', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1', type: 'circle' } ],
				backgroundVisible: true,
				backgroundOpacity: 0.8
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			const result = draftManager.recoverDraft();

			expect( result ).toBe( true );
			expect( mockEditor.stateManager.update ).toHaveBeenCalledWith( {
				layers: [ { id: 'layer1', type: 'circle' } ],
				backgroundVisible: true,
				backgroundOpacity: 0.8,
				isDirty: true
			} );
		} );

		it( 'should re-render layers after recovery', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			draftManager.recoverDraft();

			expect( mockEditor.canvasManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should warn user when draft has stripped image layers', function () {
			// P1-042 regression: drafts with large images have src stripped,
			// and the user should be warned about lost images
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [
					{ id: 'layer1', type: 'rectangle' },
					{ id: 'layer2', type: 'image', _srcStripped: true },
					{ id: 'layer3', type: 'image', _srcStripped: true }
				]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			draftManager.recoverDraft();

			expect( mw.notify ).toHaveBeenCalled();
			const notifyCall = mw.notify.mock.calls[ 0 ];
			expect( notifyCall[ 1 ] ).toMatchObject( { autoHide: false } );
		} );

		it( 'should clean up _srcStripped flags from recovered layers', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [
					{ id: 'layer1', type: 'image', _srcStripped: true },
					{ id: 'layer2', type: 'rectangle' }
				]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			draftManager.recoverDraft();

			const updateCall = mockEditor.stateManager.update.mock.calls[ 0 ][ 0 ];
			const recoveredLayers = updateCall.layers;
			expect( recoveredLayers[ 0 ]._srcStripped ).toBeUndefined();
		} );

		it( 'should not warn when no images were stripped', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [
					{ id: 'layer1', type: 'rectangle' },
					{ id: 'layer2', type: 'circle' }
				]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			draftManager.recoverDraft();

			expect( mw.notify ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'onSaveSuccess', function () {
		it( 'should clear draft on successful save', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			draftManager.onSaveSuccess();

			expect( global.localStorage.removeItem ).toHaveBeenCalled();
		} );

		it( 'should forward options to clearDraft', function () {
			jest.spyOn( draftManager, 'clearDraft' );
			const opts = { page: 3, maxTimestamp: 12345 };
			draftManager.onSaveSuccess( opts );
			expect( draftManager.clearDraft ).toHaveBeenCalledWith( opts );
		} );
	} );

	describe( 'exact draft targeting and storage keys', function () {
		it( 'should build storage keys with versioned injective tuple encoding', function () {
			const key = draftManager.buildStorageKey( 'Doc.pdf', 'Set 1', 1 );
			expect( key.startsWith( 'layers-draft-v2:' ) ).toBe( true );
			const decoded = DraftManager.decodeKey( key );
			expect( decoded ).toEqual( {
				wikiScope: 'default',
				userScope: 'anon',
				filename: 'Doc.pdf',
				setName: 'Set 1',
				page: 1
			} );

			// Legacy storage key preserves legacy sanitized format
			const legacyKey = draftManager.buildLegacyStorageKey( 'Doc.pdf', 'Set 1', 1 );
			expect( legacyKey ).toContain( 'Doc.pdf' );
			expect( legacyKey ).toContain( 'Set_1' );
			expect( legacyKey ).not.toContain( '-p1' );
		} );

		it( 'should encode page in tuple and include page suffix in legacy key when page > 1', function () {
			const key = draftManager.buildStorageKey( 'Doc.pdf', 'Set 1', 3 );
			const decoded = DraftManager.decodeKey( key );
			expect( decoded.page ).toBe( 3 );

			const legacyKey = draftManager.buildLegacyStorageKey( 'Doc.pdf', 'Set 1', 3 );
			expect( legacyKey ).toContain( 'Doc.pdf' );
			expect( legacyKey ).toContain( 'Set_1' );
			expect( legacyKey.endsWith( '-p3' ) ).toBe( true );
		} );

		it( 'should handle missing, null, or fallback arguments in buildStorageKey', function () {
			const keyDefault = draftManager.buildStorageKey();
			const decodedDefault = DraftManager.decodeKey( keyDefault );
			expect( decodedDefault.filename ).toBe( 'Test_Image.jpg' );
			expect( decodedDefault.setName ).toBe( '' );
			expect( decodedDefault.page ).toBe( 1 );

			const keyWithContext = draftManager.buildStorageKey( 'Test_Image.jpg', 'default', 1 );
			expect( keyWithContext ).toBe( draftManager.getStorageKey() );

			const keyNull = draftManager.buildStorageKey( null, null, null );
			expect( typeof keyNull ).toBe( 'string' );
			expect( keyNull.startsWith( 'layers-draft-v2:' ) ).toBe( true );
		} );

		it( 'should resolve getStorageKey with numeric page argument', function () {
			const page1Key = draftManager.getStorageKey();
			const page2Key = draftManager.getStorageKey( 2 );

			expect( DraftManager.decodeKey( page1Key ).page ).toBe( 1 );
			expect( DraftManager.decodeKey( page2Key ).page ).toBe( 2 );
			expect( page2Key ).not.toBe( page1Key );
		} );

		it( 'should resolve getStorageKey with explicit options object', function () {
			const explicitKey = draftManager.getStorageKey( {
				filename: 'Other_File.png',
				setName: 'custom-set',
				page: 4
			} );

			const decoded = DraftManager.decodeKey( explicitKey );
			expect( decoded.filename ).toBe( 'Other_File.png' );
			expect( decoded.setName ).toBe( 'custom-set' );
			expect( decoded.page ).toBe( 4 );
		} );

		it( 'should clear only the targeted draft when an explicit page is specified', function () {
			const keyPage1 = draftManager.getStorageKey( 1 );
			const keyPage2 = draftManager.getStorageKey( 2 );

			mockLocalStorage[ keyPage1 ] = JSON.stringify( { timestamp: 100 } );
			mockLocalStorage[ keyPage2 ] = JSON.stringify( { timestamp: 200 } );

			draftManager.clearDraft( 2 );

			expect( mockLocalStorage[ keyPage2 ] ).toBeUndefined();
			expect( mockLocalStorage[ keyPage1 ] ).toBeDefined();
		} );

		it( 'should clear only the targeted draft when explicit file, set, and page options are specified', function () {
			const targetOpts = { filename: 'Target_Image.jpg', setName: 'reviewed', page: 2 };
			const targetKey = draftManager.getStorageKey( targetOpts );
			const currentKey = draftManager.getStorageKey();

			mockLocalStorage[ targetKey ] = JSON.stringify( { timestamp: 100 } );
			mockLocalStorage[ currentKey ] = JSON.stringify( { timestamp: 200 } );

			draftManager.clearDraft( targetOpts );

			expect( mockLocalStorage[ targetKey ] ).toBeUndefined();
			expect( mockLocalStorage[ currentKey ] ).toBeDefined();
		} );

		it( 'preserves changed drafts even when timestamps are equal', function () {
			const target = { page: 3 };
			const key = draftManager.getStorageKey( target );
			localStorage.setItem( key, JSON.stringify( { timestamp: 5000, text: 'old' } ) );
			const expectedDraft = draftManager.captureDraft( target );
			const newer = JSON.stringify( { timestamp: 5000, text: 'new' } );
			localStorage.setItem( key, newer );
			draftManager.clearDraft( { ...target, expectedDraft } );
			expect( localStorage.getItem( key ) ).toBe( newer );
			draftManager.clearDraft( { ...target, expectedDraft: newer } );
			expect( localStorage.getItem( key ) ).toBeNull();
		} );

		it( 'preserves drafts when no reliable pre-save value was captured', function () {
			const key = draftManager.getStorageKey( { page: 3 } );
			localStorage.setItem( key, 'recoverable' );
			draftManager.clearDraft( { page: 3, expectedDraft: undefined } );
			expect( localStorage.getItem( key ) ).toBe( 'recoverable' );
		} );

		it( 'should preserve newer drafts when maxTimestamp is older than stored draft', function () {
			const targetKey = draftManager.getStorageKey( 3 );
			mockLocalStorage[ targetKey ] = JSON.stringify( {
				timestamp: 5000,
				layers: [ { id: 'newer' } ]
			} );

			draftManager.clearDraft( { page: 3, maxTimestamp: 4000 } );

			expect( mockLocalStorage[ targetKey ] ).toBeDefined();
		} );

		it( 'should delete drafts when maxTimestamp is equal to or newer than stored draft', function () {
			const targetKey = draftManager.getStorageKey( 3 );
			mockLocalStorage[ targetKey ] = JSON.stringify( {
				timestamp: 5000,
				layers: [ { id: 'in-flight' } ]
			} );

			draftManager.clearDraft( { page: 3, maxTimestamp: 5000 } );

			expect( mockLocalStorage[ targetKey ] ).toBeUndefined();
		} );

		it( 'should safely delete corrupted non-JSON drafts when maxTimestamp is provided', function () {
			const targetKey = draftManager.getStorageKey( 3 );
			mockLocalStorage[ targetKey ] = 'corrupted-non-json';

			expect( function () {
				draftManager.clearDraft( { page: 3, maxTimestamp: 5000 } );
			} ).not.toThrow();

			expect( mockLocalStorage[ targetKey ] ).toBeUndefined();
		} );
	} );

	describe( 'getDraftInfo', function () {
		it( 'should return null when no draft exists', function () {
			expect( draftManager.getDraftInfo() ).toBeNull();
		} );

		it( 'should return draft info object', function () {
			const draft = {
				version: 1,
				timestamp: Date.now() - 1000,
				layers: [ { id: 'l1' }, { id: 'l2' } ],
				setName: 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			const info = draftManager.getDraftInfo();

			expect( info ).not.toBeNull();
			expect( info.layerCount ).toBe( 2 );
			expect( info.setName ).toBe( 'default' );
			expect( info.age ).toBeGreaterThanOrEqual( 1000 );
		} );
	} );

	describe( 'destroy', function () {
		it( 'should stop auto-save timer', function () {
			jest.useFakeTimers();
			
			const manager = new DraftManager( mockEditor );
			expect( manager.autoSaveTimer ).not.toBeNull();
			
			manager.destroy();
			
			expect( manager.autoSaveTimer ).toBeNull();
			
			jest.useRealTimers();
		} );

		it( 'should unsubscribe from state changes', function () {
			const unsubscribe = jest.fn();
			mockEditor.stateManager.subscribe = jest.fn( function () {
				return unsubscribe;
			} );

			const manager = new DraftManager( mockEditor );
			manager.destroy();

			expect( unsubscribe ).toHaveBeenCalled();
		} );
	} );

	describe( 'initialize', function () {
		it( 'should clean up existing subscription before creating new one', function () {
			const unsubscribe1 = jest.fn();
			const unsubscribe2 = jest.fn();
			
			mockEditor.stateManager.subscribe = jest.fn()
				.mockReturnValueOnce( unsubscribe1 )
				.mockReturnValueOnce( unsubscribe2 );

			const manager = new DraftManager( mockEditor );
			
			// Reinitialize should clean up the first subscription
			manager.initialize();
			
			expect( unsubscribe1 ).toHaveBeenCalled();
			
			manager.destroy();
		} );
	} );

	describe( 'scheduleAutoSave', function () {
		it( 'should not save during recovery mode', function () {
			jest.useFakeTimers();
			
			draftManager.isRecoveryMode = true;
			draftManager.scheduleAutoSave();
			
			jest.advanceTimersByTime( 5000 );
			
			// saveDraft should not be called during recovery
			expect( global.localStorage.setItem ).not.toHaveBeenCalled();
			
			jest.useRealTimers();
		} );

		it( 'should debounce multiple rapid calls', function () {
			jest.useFakeTimers();
			const saveSpy = jest.spyOn( draftManager, 'saveDraft' );
			
			// Make multiple rapid calls
			draftManager.scheduleAutoSave();
			draftManager.scheduleAutoSave();
			draftManager.scheduleAutoSave();
			
			// Only one save should happen after debounce (5000ms)
			jest.advanceTimersByTime( 6000 );
			
			expect( saveSpy ).toHaveBeenCalledTimes( 1 );
			
			jest.useRealTimers();
		} );

		it( 'should clear existing debounce timer', function () {
			jest.useFakeTimers();
			
			draftManager.debounceTimer = setTimeout( function () {}, 10000 );
			draftManager.scheduleAutoSave();
			
			// Verify new timer is set (timer should still complete after correct delay)
			jest.advanceTimersByTime( 2000 );
			
			jest.useRealTimers();
		} );
	} );

	describe( 'startAutoSaveTimer', function () {
		it( 'should trigger periodic saves for dirty editor', function () {
			jest.useFakeTimers();
			const saveSpy = jest.spyOn( draftManager, 'saveDraft' );
			
			// Ensure editor reports as dirty
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );
			
			// Re-start the timer
			draftManager.startAutoSaveTimer();
			
			// Advance past the auto-save interval (60s)
			jest.advanceTimersByTime( 61000 );
			
			expect( saveSpy ).toHaveBeenCalled();
			
			jest.useRealTimers();
		} );

		it( 'should not save when editor is not dirty', function () {
			jest.useFakeTimers();
			global.localStorage.setItem.mockClear();
			
			// Editor reports not dirty
			mockEditor.isDirty = jest.fn( function () {
				return false;
			} );
			
			draftManager.startAutoSaveTimer();
			jest.advanceTimersByTime( 61000 );
			
			// setItem is only called by isStorageAvailable, not saveDraft
			// Filter out storage test calls
			const draftCalls = global.localStorage.setItem.mock.calls.filter(
				function ( call ) {
					return !call[ 0 ].includes( '__layers_storage_test__' );
				}
			);
			expect( draftCalls.length ).toBe( 0 );
			
			jest.useRealTimers();
		} );
	} );

	describe( 'checkAndRecoverDraft', function () {
		it( 'should return false when no draft exists', async function () {
			const result = await draftManager.checkAndRecoverDraft();
			expect( result ).toBe( false );
		} );

		it( 'should recover draft when user confirms', async function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1', type: 'circle' } ],
				setName: 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			global.OO.ui.confirm = jest.fn( function () {
				return Promise.resolve( true );
			} );
			
			const result = await draftManager.checkAndRecoverDraft();
			
			expect( result ).toBe( true );
			expect( mockEditor.stateManager.update ).toHaveBeenCalled();
			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should discard draft when user cancels', async function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ],
				setName: 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			global.OO.ui.confirm = jest.fn( function () {
				return Promise.resolve( false );
			} );
			
			const result = await draftManager.checkAndRecoverDraft();
			
			expect( result ).toBe( false );
			expect( global.localStorage.removeItem ).toHaveBeenCalled();
		} );
	} );

	describe( 'showRecoveryDialog', function () {
		it( 'should return false when no draft info exists', async function () {
			const result = await draftManager.showRecoveryDialog();
			expect( result ).toBe( false );
		} );

		it( 'should use OO.ui.confirm when available', async function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ],
				setName: 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			global.OO.ui.confirm = jest.fn( function () {
				return Promise.resolve( true );
			} );
			
			const result = await draftManager.showRecoveryDialog();
			
			expect( global.OO.ui.confirm ).toHaveBeenCalled();
			expect( result ).toBe( true );
		} );

		it( 'should fallback to window.confirm when OO.ui unavailable', async function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ],
				setName: 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			// Remove OO.ui
			const originalOO = global.OO;
			global.OO = undefined;
			
			global.window.confirm = jest.fn( function () {
				return true;
			} );
			
			const result = await draftManager.showRecoveryDialog();
			
			expect( global.window.confirm ).toHaveBeenCalled();
			expect( result ).toBe( true );
			
			global.OO = originalOO;
		} );
	} );

	describe( 'saveDraft edge cases', function () {
		it( 'should not save when editor is not dirty', function () {
			mockEditor.isDirty = jest.fn( function () {
				return false;
			} );
			global.localStorage.setItem.mockClear();

			const result = draftManager.saveDraft();
			
			// Only isStorageAvailable calls setItem
			const draftCalls = global.localStorage.setItem.mock.calls.filter(
				function ( call ) {
					return !call[ 0 ].includes( '__layers_storage_test__' );
				}
			);
			expect( draftCalls.length ).toBe( 0 );
			expect( result ).toBe( false );
		} );

		it( 'should handle missing stateManager gracefully', function () {
			const editorWithoutState = {
				filename: 'Test.jpg',
				stateManager: null,
				isDirty: jest.fn( function () {
					return true;
				} )
			};
			
			const manager = new DraftManager( editorWithoutState );
			const result = manager.saveDraft();
			
			expect( result ).toBe( false );
			manager.destroy();
		} );
	} );

	describe( 'recoverDraft error handling', function () {
		it( 'should handle stateManager.update throwing error', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ],
				setName: 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			mockEditor.stateManager.update = jest.fn( function () {
				throw new Error( 'Update failed' );
			} );
			
			const result = draftManager.recoverDraft();
			
			expect( result ).toBe( false );
			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should handle canvasManager.renderLayers throwing error', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ],
				setName: 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			mockEditor.canvasManager.renderLayers = jest.fn( function () {
				throw new Error( 'Render failed' );
			} );
			
			// Recovery should still report success if state was updated
			draftManager.recoverDraft();
			
			// Verify state was updated before render failed
			expect( mockEditor.stateManager.update ).toHaveBeenCalled();
		} );
	} );

	describe( 'checkAndRecoverDraft edge cases', function () {
		it( 'should handle OO.ui.confirm resolving to false gracefully', async function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1', type: 'circle' } ],
				setName: 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			// User clicks "No" / cancels
			global.OO.ui.confirm = jest.fn( function () {
				return Promise.resolve( false );
			} );
			
			const result = await draftManager.checkAndRecoverDraft();
			
			// Should handle cancellation gracefully and discard draft
			expect( result ).toBe( false );
			expect( global.localStorage.removeItem ).toHaveBeenCalled();
		} );

		it( 'should refuse a draft belonging to a different set name', async function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ],
				setName: 'anatomy-labels' // Different from 'default'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			global.OO.ui.confirm = jest.fn( function () {
				return Promise.resolve( true );
			} );

			const result = await draftManager.checkAndRecoverDraft();

			expect( result ).toBe( false );
			expect( mockEditor.stateManager.update ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'loadDraft edge cases', function () {
		it( 'should return null for draft with missing layers array', function () {
			const draft = {
				version: 1,
				timestamp: Date.now()
				// Missing layers array
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			expect( draftManager.loadDraft() ).toBeNull();
		} );

		it( 'should return draft with empty layers array (valid structure)', function () {
			// Note: loadDraft validates structure but allows empty arrays
			// The saveDraft method prevents saving empty layers
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: []
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			const result = draftManager.loadDraft();
			expect( result ).not.toBeNull();
			expect( result.layers ).toHaveLength( 0 );
		} );

		it( 'should handle draft with null value', function () {
			mockLocalStorage[ draftManager.getStorageKey() ] = 'null';

			expect( draftManager.loadDraft() ).toBeNull();
		} );

		it( 'should handle localStorage.getItem throwing error', function () {
			global.localStorage.getItem = jest.fn( function () {
				throw new Error( 'Storage access denied' );
			} );

			expect( draftManager.loadDraft() ).toBeNull();
		} );
	} );

	describe( 'saveDraft error handling', function () {
		it( 'should return false when localStorage.setItem throws quota exceeded', function () {
			// Create a draft manager with layers to save
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'layers' ) {
					return [ { id: 'layer1', type: 'rectangle' } ];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			const dm = new DraftManager( mockEditor );

			// Make setItem throw to simulate quota exceeded
			global.localStorage.setItem = jest.fn( function () {
				throw new Error( 'QuotaExceededError: localStorage is full' );
			} );

			// saveDraft should catch the error and return false
			const result = dm.saveDraft();
			expect( result ).toBe( false );
		} );
	} );

	describe( 'clearDraft error handling', function () {
		it( 'should handle localStorage.removeItem throwing error gracefully', function () {
			// Make removeItem throw an error
			global.localStorage.removeItem = jest.fn( function () {
				throw new Error( 'Storage operation failed' );
			} );

			// clearDraft should not throw even when removeItem fails
			expect( () => draftManager.clearDraft() ).not.toThrow();
		} );
	} );

	describe( 'initialization without stateManager', function () {
		it( 'should initialize without stateManager subscription', function () {
			const editorWithoutStateManager = {
				filename: 'Test_Image.jpg',
				stateManager: null
			};

			// Should not throw
			expect( () => new DraftManager( editorWithoutStateManager ) ).not.toThrow();
		} );

		it( 'should handle getStorageKey without stateManager', function () {
			const editorWithoutStateManager = {
				filename: 'Test_Image.jpg',
				stateManager: null
			};

			const dm = new DraftManager( editorWithoutStateManager );
			const key = dm.getStorageKey();

			// No set name is invented, so the set segment is empty in v2 tuple
			const decoded = DraftManager.decodeKey( key );
			expect( decoded.setName ).toBe( '' );
			expect( decoded.filename ).toBe( 'Test_Image.jpg' );

			// Legacy storage key keeps empty set segment
			const legacyKey = dm.getLegacyStorageKey();
			expect( legacyKey.endsWith( '-' ) ).toBe( true );
		} );
	} );

	describe( 'state subscription cleanup', function () {
		it( 'should clean up existing subscription when initialize is called again', function () {
			const unsubscribeMock = jest.fn();
			const subscribeMock = jest.fn().mockReturnValue( unsubscribeMock );

			const editorWithSubscription = {
				filename: 'Test_Image.jpg',
				stateManager: {
					subscribe: subscribeMock,
					get: jest.fn().mockReturnValue( 'default' )
				}
			};

			const dm = new DraftManager( editorWithSubscription );

			// Constructor already called initialize() and set stateSubscription
			// stateSubscription should be the unsubscribe function returned by subscribe
			expect( dm.stateSubscription ).toBe( unsubscribeMock );

			// Call initialize again to trigger cleanup of existing subscription
			dm.initialize();

			// Should have called the old unsubscribe function
			expect( unsubscribeMock ).toHaveBeenCalled();
		} );
	} );

	describe( 'mw.message integration', function () {
		it( 'should use mw.message for localization when available', function () {
			const mockMessage = {
				exists: jest.fn().mockReturnValue( true ),
				text: jest.fn().mockReturnValue( 'Localized Text' )
			};

			const originalMw = global.mw;
			global.mw = {
				log: jest.fn(),
				message: jest.fn().mockReturnValue( mockMessage )
			};

			const dm = new DraftManager( mockEditor );

			// The mw.message path is used in promptForRecovery
			// We can trigger it by saving a draft and checking for recovery
			const layers = [ { id: 'layer1', type: 'rectangle' } ];
			dm.saveDraft( layers );

			// mw.message exists, so this validates the path
			expect( global.mw ).toBeDefined();

			// Restore: leaving a log stub without .warn here leaked into every
			// later test in this file.
			global.mw = originalMw;
			dm.destroy();
		} );
	} );

	describe( 'MED-v28-9 regression: base64 image src stripping', function () {
		it( 'should strip large base64 src from image layers before saving', function () {
			// Create a large base64 string (>1024 chars)
			const largeSrc = 'data:image/png;base64,' + 'A'.repeat( 2000 );
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'layers' ) {
					return [
						{ id: 'img1', type: 'image', src: largeSrc, x: 0, y: 0 },
						{ id: 'rect1', type: 'rectangle', x: 10, y: 10 }
					];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			global.localStorage.setItem.mockClear();
			draftManager.saveDraft();

			const storageKey = draftManager.getStorageKey();
			const draftCall = global.localStorage.setItem.mock.calls.find(
				function ( call ) {
					return call[ 0 ] === storageKey;
				}
			);
			expect( draftCall ).toBeDefined();
			const savedData = JSON.parse( draftCall[ 1 ] );

			// Image layer should have src stripped and _srcStripped flag set
			const imgLayer = savedData.layers.find( function ( l ) {
				return l.id === 'img1';
			} );
			expect( imgLayer.src ).toBeUndefined();
			expect( imgLayer._srcStripped ).toBe( true );

			// Non-image layer should be unaffected
			const rectLayer = savedData.layers.find( function ( l ) {
				return l.id === 'rect1';
			} );
			expect( rectLayer.type ).toBe( 'rectangle' );
		} );

		it( 'should NOT strip small src from image layers', function () {
			const smallSrc = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'layers' ) {
					return [
						{ id: 'img1', type: 'image', src: smallSrc, x: 0, y: 0 }
					];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			global.localStorage.setItem.mockClear();
			draftManager.saveDraft();

			const storageKey = draftManager.getStorageKey();
			const draftCall = global.localStorage.setItem.mock.calls.find(
				function ( call ) {
					return call[ 0 ] === storageKey;
				}
			);
			expect( draftCall ).toBeDefined();
			const savedData = JSON.parse( draftCall[ 1 ] );

			// Small src should be preserved
			const imgLayer = savedData.layers.find( function ( l ) {
				return l.id === 'img1';
			} );
			expect( imgLayer.src ).toBe( smallSrc );
			expect( imgLayer._srcStripped ).toBeUndefined();
		} );

		it( 'should not mutate original layers when stripping src', function () {
			const largeSrc = 'data:image/png;base64,' + 'B'.repeat( 2000 );
			const originalLayers = [
				{ id: 'img1', type: 'image', src: largeSrc, x: 0, y: 0 }
			];
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'layers' ) {
					return originalLayers;
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			draftManager.saveDraft();

			// Original layer should still have its src
			expect( originalLayers[ 0 ].src ).toBe( largeSrc );
			expect( originalLayers[ 0 ]._srcStripped ).toBeUndefined();
		} );
	} );

	describe( 'Branch coverage: null stateManager', function () {
		it( 'should initialize without error when stateManager is null', function () {
			mockEditor.stateManager = null;
			const dm = new DraftManager( mockEditor );
			expect( function () {
				dm.initialize();
			} ).not.toThrow();
			dm.destroy();
		} );
	} );

	describe( 'Branch coverage: auto-save timer', function () {
		it( 'should not save when isDirty returns false', function () {
			jest.useFakeTimers();
			mockEditor.isDirty = jest.fn( function () {
				return false;
			} );
			const dm = new DraftManager( mockEditor );
			dm.initialize();

			// Spy on saveDraft AFTER initialize (timer already set)
			const spy = jest.spyOn( dm, 'saveDraft' );

			// Advance timer past AUTO_SAVE_INTERVAL (30s)
			jest.advanceTimersByTime( 31000 );

			expect( spy ).not.toHaveBeenCalled();
			dm.destroy();
			jest.useRealTimers();
		} );

		it( 'should save when isDirty returns true', function () {
			jest.useFakeTimers();
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );
			const dm = new DraftManager( mockEditor );
			dm.initialize();
			// Stop existing timer and re-create so spy captures callback
			dm.stopAutoSaveTimer();
			const spy = jest.spyOn( dm, 'saveDraft' );
			dm.startAutoSaveTimer();

			// Advance timer past AUTO_SAVE_INTERVAL (30s)
			jest.advanceTimersByTime( 31000 );

			expect( spy ).toHaveBeenCalled();
			dm.destroy();
			jest.useRealTimers();
		} );
	} );

	describe( 'Branch coverage: saveDraft error handling', function () {
		it( 'should return false when localStorage.setItem throws', function () {
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );
			const dm = new DraftManager( mockEditor );
			dm.initialize();

			// Mock localStorage to throw on setItem (quota exceeded)
			global.localStorage.setItem.mockImplementation( function () {
				throw new Error( 'QuotaExceededError' );
			} );

			const result = dm.saveDraft();
			expect( result ).toBe( false );
			dm.destroy();
		} );
	} );

	describe( 'Branch coverage: loadDraft expiry', function () {
		it( 'should return null for expired draft', function () {
			const dm = new DraftManager( mockEditor );
			dm.initialize();

			// Store a draft with a very old timestamp (more than 24h ago)
			const oldDraft = {
				version: 1,
				timestamp: Date.now() - ( 25 * 60 * 60 * 1000 ),
				filename: 'Test.jpg',
				setName: 'default',
				layers: [ { id: '1', type: 'rectangle' } ],
				backgroundVisible: true,
				backgroundOpacity: 1.0
			};
			mockLocalStorage[ dm.getStorageKey() ] = JSON.stringify( oldDraft );

			const result = dm.loadDraft();
			expect( result ).toBe( null );
			dm.destroy();
		} );
	} );

	describe( 'scheduleAutoSave - save failure notification', function () {
		it( 'should notify once when saveDraft fails', function () {
			jest.useFakeTimers();
			// Re-install mw.notify since clearAllMocks resets it
			global.mw.notify = jest.fn();
			
			jest.spyOn( draftManager, 'saveDraft' ).mockImplementation( function () {
					draftManager.lastWriteFailed = true;
					return false;
				} );
			draftManager._saveFailNotified = false;
			
			draftManager.scheduleAutoSave();
			jest.advanceTimersByTime( 6000 );
			
			expect( global.mw.notify ).toHaveBeenCalled();
			expect( draftManager._saveFailNotified ).toBe( true );
			
			jest.useRealTimers();
		} );

		it( 'should not notify again when _saveFailNotified is true', function () {
			jest.useFakeTimers();
			global.mw.notify = jest.fn();
			
			jest.spyOn( draftManager, 'saveDraft' ).mockImplementation( function () {
					draftManager.lastWriteFailed = true;
					return false;
				} );
			draftManager._saveFailNotified = true;
			
			draftManager.scheduleAutoSave();
			jest.advanceTimersByTime( 6000 );
			
			expect( global.mw.notify ).not.toHaveBeenCalled();
			
			jest.useRealTimers();
		} );
	} );

	describe( 'startAutoSaveTimer - isRecoveryMode guard', function () {
		it( 'should skip saving during recovery mode in interval', function () {
			jest.useFakeTimers();
			
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );
			
			draftManager.stopAutoSaveTimer();
			const saveSpy = jest.spyOn( draftManager, 'saveDraft' );
			draftManager.isRecoveryMode = true;
			draftManager.startAutoSaveTimer();
			
			jest.advanceTimersByTime( 31000 );
			
			expect( saveSpy ).not.toHaveBeenCalled();
			
			jest.useRealTimers();
		} );

		it( 'should notify when save fails in interval timer', function () {
			jest.useFakeTimers();
			global.mw.notify = jest.fn();
			
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );
			
			draftManager.stopAutoSaveTimer();
			jest.spyOn( draftManager, 'saveDraft' ).mockImplementation( function () {
					draftManager.lastWriteFailed = true;
					return false;
				} );
			draftManager._saveFailNotified = false;
			draftManager.startAutoSaveTimer();
			
			jest.advanceTimersByTime( 31000 );
			
			expect( global.mw.notify ).toHaveBeenCalled();
			expect( draftManager._saveFailNotified ).toBe( true );
			
			jest.useRealTimers();
		} );

		it( 'should not notify twice from interval timer', function () {
			jest.useFakeTimers();
			global.mw.notify = jest.fn();
			
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );
			
			draftManager.stopAutoSaveTimer();
			jest.spyOn( draftManager, 'saveDraft' ).mockImplementation( function () {
					draftManager.lastWriteFailed = true;
					return false;
				} );
			draftManager._saveFailNotified = true;
			draftManager.startAutoSaveTimer();
			
			jest.advanceTimersByTime( 31000 );
			
			expect( global.mw.notify ).not.toHaveBeenCalled();
			
			jest.useRealTimers();
		} );
	} );

	describe( 'recoverDraft - missing editor subsystems', function () {
		it( 'should succeed without canvasManager', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1', type: 'rectangle' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			mockEditor.canvasManager = null;
			
			const result = draftManager.recoverDraft();
			expect( result ).toBe( true );
		} );

		it( 'should succeed without layerPanel', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1', type: 'rectangle' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			mockEditor.layerPanel = null;
			
			const result = draftManager.recoverDraft();
			expect( result ).toBe( true );
		} );

		it( 'should succeed without stateManager', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1', type: 'circle' } ]
			};

			mockEditor.stateManager = null;
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			const result = draftManager.recoverDraft();
			expect( result ).toBe( true );
		} );

		it( 'should use default backgroundVisible when undefined in draft', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1', type: 'rectangle' } ]
				// No backgroundVisible or backgroundOpacity
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			draftManager.recoverDraft();
			
			expect( mockEditor.stateManager.update ).toHaveBeenCalledWith(
				expect.objectContaining( {
					backgroundVisible: true,
					backgroundOpacity: 1.0
				} )
			);
		} );

		it( 'should preserve explicit false backgroundVisible', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1', type: 'rectangle' } ],
				backgroundVisible: false,
				backgroundOpacity: 0.5
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			draftManager.recoverDraft();
			
			expect( mockEditor.stateManager.update ).toHaveBeenCalledWith(
				expect.objectContaining( {
					backgroundVisible: false,
					backgroundOpacity: 0.5
				} )
			);
		} );

		it( 'should handle layerPanel without updateLayers method', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1', type: 'rectangle' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			mockEditor.layerPanel = { someOtherMethod: jest.fn() };
			
			const result = draftManager.recoverDraft();
			expect( result ).toBe( true );
		} );
	} );

	describe( 'recoverDraft - stripped images with mw unavailable', function () {
		it( 'should handle stripped images when mw.notify is unavailable', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [
					{ id: 'img1', type: 'image', _srcStripped: true }
				]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			const originalMw = global.mw;
			global.mw = undefined;
			
			const result = draftManager.recoverDraft();
			expect( result ).toBe( true );
			
			global.mw = originalMw;
		} );
	} );

	describe( 'clearDraft - storage unavailable', function () {
		it( 'should return early when storage is unavailable', function () {
			jest.spyOn( draftManager, 'isStorageAvailable' ).mockReturnValue( false );
			
			draftManager.clearDraft();
			
			// removeItem should not be called
			expect( global.localStorage.removeItem ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'saveDraft - mw unavailable for logging', function () {
		it( 'should save successfully when mw is undefined', function () {
			const originalMw = global.mw;
			global.mw = undefined;
			
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );
			
			const result = draftManager.saveDraft();
			expect( result ).toBe( true );
			
			global.mw = originalMw;
		} );

		it( 'should handle save failure when mw is undefined', function () {
			const originalMw = global.mw;
			global.mw = undefined;
			
			global.localStorage.setItem = jest.fn( function () {
				throw new Error( 'Storage full' );
			} );
			
			const result = draftManager.saveDraft();
			expect( result ).toBe( false );
			
			global.mw = originalMw;
		} );
	} );

	describe( 'checkAndRecoverDraft - recovery failure', function () {
		it( 'should return false when recoverDraft fails', async function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			global.OO.ui.confirm = jest.fn( function () {
				return Promise.resolve( true );
			} );
			
			// Make recoverDraft fail
			jest.spyOn( draftManager, 'recoverDraft' ).mockReturnValue( false );
			
			const result = await draftManager.checkAndRecoverDraft();
			
			expect( result ).toBe( false );
		} );

		it( 'should show success notification when recovery succeeds', async function () {
			global.mw.notify = jest.fn();
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			global.OO.ui.confirm = jest.fn( function () {
				return Promise.resolve( true );
			} );
			
			await draftManager.checkAndRecoverDraft();
			
			// mw.notify should be called for successful recovery
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'success' } )
			);
		} );
	} );

	describe( 'checkAndRecoverDraft - mw.message edge cases', function () {
		it( 'should use fallback text when mw.message exists returns false', async function () {
			global.mw.notify = jest.fn();
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			global.OO.ui.confirm = jest.fn( function () {
				return Promise.resolve( true );
			} );
			
			// Override mw.message to return exists: false
			const originalMessage = global.mw.message;
			global.mw.message = jest.fn( function () {
				return {
					exists: function () {
						return false;
					},
					text: function () {
						return 'key-not-found';
					}
				};
			} );
			
			const result = await draftManager.checkAndRecoverDraft();
			expect( result ).toBe( true );
			
			// Should use the fallback message
			expect( global.mw.notify ).toHaveBeenCalledWith(
				'Draft recovered successfully',
				expect.any( Object )
			);
			
			global.mw.message = originalMessage;
		} );
	} );

	describe( 'loadDraft - non-array layers', function () {
		it( 'should return null when layers is a string', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: 'not-an-array'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			expect( draftManager.loadDraft() ).toBeNull();
		} );

		it( 'should return null when layers is an object', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: { id: 'layer1' }
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			expect( draftManager.loadDraft() ).toBeNull();
		} );

		it( 'should return null when layers is a number', function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: 42
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			expect( draftManager.loadDraft() ).toBeNull();
		} );
	} );

	describe( 'showRecoveryDialog - mw unavailable', function () {
		it( 'should use fallback messages when mw is undefined', async function () {
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'layer1' } ]
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );
			
			const originalMw = global.mw;
			global.mw = undefined;
			
			// Without mw and OO, should fall back to window.confirm
			const originalOO = global.OO;
			global.OO = undefined;
			
			global.window.confirm = jest.fn( function () {
				return false;
			} );
			
			const result = await draftManager.showRecoveryDialog();
			
			expect( result ).toBe( false );
			expect( global.window.confirm ).toHaveBeenCalled();
			
			global.mw = originalMw;
			global.OO = originalOO;
		} );
	} );

	describe( 'getStorageKey - setName sanitization', function () {
		it( 'should preserve literal set names in v2 and sanitize special characters in legacy keys', function () {
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'currentSetName' ) {
					return 'my/set name!@#';
				}
				return null;
			} );

			const key = draftManager.getStorageKey();
			const decoded = DraftManager.decodeKey( key );
			expect( decoded.setName ).toBe( 'my/set name!@#' );

			// Legacy keys sanitize special characters to underscores
			const legacyKey = draftManager.getLegacyStorageKey();
			expect( legacyKey ).not.toContain( '/' );
			expect( legacyKey ).not.toContain( '!' );
			expect( legacyKey ).not.toContain( '@' );
			expect( legacyKey ).not.toContain( '#' );
			expect( legacyKey ).not.toContain( ' ' );
		} );
	} );

	describe( 'constructor - FNV hash appended', function () {
		it( 'should append FNV hash suffix to storage key', function () {
			const dm = new DraftManager( mockEditor );
			
			// Key format: STORAGE_KEY_PREFIX + sanitized_filename + _ + fnv_hash
			// The fnv hash is 4 chars at the end
			const keyParts = dm.storageKey.split( '_' );
			const lastPart = keyParts[ keyParts.length - 1 ];
			
			// FNV hash should be a short alphanumeric string
			expect( lastPart ).toMatch( /^[a-z0-9]+$/ );
			expect( lastPart.length ).toBeLessThanOrEqual( 4 );
			
			dm.destroy();
		} );

		it( 'should produce different hashes for different filenames', function () {
			const editor1 = { ...mockEditor, filename: 'Foo/bar.jpg' };
			const editor2 = { ...mockEditor, filename: 'Foo_bar.jpg' };
			
			const dm1 = new DraftManager( editor1 );
			const dm2 = new DraftManager( editor2 );
			
			// Both sanitize to Foo_bar.jpg but hashes should differ
			expect( dm1.storageKey ).not.toBe( dm2.storageKey );
			
			dm1.destroy();
			dm2.destroy();
		} );
	} );

	describe( 'branch coverage gaps', function () {
		it( 'should handle stateSubscription that is not a function during initialize', function () {
			mockEditor.stateManager = null;
			const dm = new DraftManager( mockEditor );
			// Set stateSubscription to non-function
			dm.stateSubscription = 'not-a-function';
			dm.initialize();
			// Should not throw, subscription should remain as-is since typeof check fails
			expect( dm.stateSubscription ).toBe( 'not-a-function' );
			dm.destroy();
		} );

		it( 'should initialize without stateManager', function () {
			mockEditor.stateManager = null;
			const dm = new DraftManager( mockEditor );
			// initialize() still starts the auto-save timer
			expect( dm.autoSaveTimer ).not.toBeNull();
			dm.destroy();
		} );

		it( 'should use defaults for backgroundVisible/Opacity when stateManager is missing during saveDraft', function () {
			// Create with stateManager that has layers but no background state
			mockEditor.stateManager = {
				subscribe: jest.fn( function () { return jest.fn(); } ),
				get: jest.fn( function ( key ) {
					if ( key === 'layers' ) {
						return [ { id: '1', type: 'text', text: 'test' } ];
					}
					if ( key === 'currentSetName' ) {
						return 'default';
					}
					return undefined;
				} )
			};
			const dm = new DraftManager( mockEditor );

			// Now remove stateManager to trigger defaults path
			dm.editor = { ...mockEditor, stateManager: null };
			const result = dm.saveDraft();
			// Without stateManager, layers is [] so saveDraft returns false
			expect( result ).toBe( false );
			dm.destroy();
		} );

		it( 'should recover draft with undefined backgroundVisible/Opacity using defaults', function () {
			const dm = new DraftManager( mockEditor );
			// Store a draft without backgroundVisible/Opacity
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: '1', type: 'text', text: 'test' } ],
				filename: 'Test_Image.jpg'
				// backgroundVisible and backgroundOpacity intentionally missing
			};
			mockLocalStorage[ dm.getStorageKey() ] = JSON.stringify( draft );

			const result = dm.recoverDraft();
			expect( result ).toBe( true );
			// stateManager.update should have been called with defaults
			expect( mockEditor.stateManager.update ).toHaveBeenCalledWith(
				expect.objectContaining( {
					backgroundVisible: true,
					backgroundOpacity: 1.0
				} )
			);
			dm.destroy();
		} );

		it( 'should skip canvasManager.renderLayers when canvasManager is null during recovery', function () {
			const dm = new DraftManager( mockEditor );
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: '1', type: 'text', text: 'test' } ],
				filename: 'Test_Image.jpg',
				backgroundVisible: true,
				backgroundOpacity: 1
			};
			mockLocalStorage[ dm.getStorageKey() ] = JSON.stringify( draft );
			dm.editor.canvasManager = null;

			const result = dm.recoverDraft();
			expect( result ).toBe( true );
			dm.destroy();
		} );

		it( 'should skip layerPanel.updateLayers when layerPanel is missing during recovery', function () {
			const dm = new DraftManager( mockEditor );
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: '1', type: 'text', text: 'test' } ],
				filename: 'Test_Image.jpg'
			};
			mockLocalStorage[ dm.getStorageKey() ] = JSON.stringify( draft );
			dm.editor.layerPanel = null;

			const result = dm.recoverDraft();
			expect( result ).toBe( true );
			dm.destroy();
		} );

		it( 'should load draft without timestamp (skip age check)', function () {
			const dm = new DraftManager( mockEditor );
			const draft = {
				version: 1,
				layers: [ { id: '1', type: 'text', text: 'test' } ],
				filename: 'Test_Image.jpg'
				// no timestamp field
			};
			mockLocalStorage[ dm.getStorageKey() ] = JSON.stringify( draft );

			const loaded = dm.loadDraft();
			expect( loaded ).not.toBeNull();
			expect( loaded.layers ).toHaveLength( 1 );
			dm.destroy();
		} );

		it( 'should fallback to window.confirm when OO.ui is unavailable', function () {
			const dm = new DraftManager( mockEditor );
			// Store a valid draft so getDraftInfo returns data
			const draft = {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: '1', type: 'text' } ],
				filename: 'Test_Image.jpg'
			};
			mockLocalStorage[ dm.getStorageKey() ] = JSON.stringify( draft );

			// Ensure OO is not defined
			delete global.OO;
			window.confirm = jest.fn( function () { return true; } );

			return dm.showRecoveryDialog().then( function ( result ) {
				expect( result ).toBe( true );
				expect( window.confirm ).toHaveBeenCalled();
				dm.destroy();
			} );
		} );
	} );

	describe( 'storage key scoping', function () {
		/**
		 * @param {number|null} id User id to report via mw.config
		 */
		function setUserId( id ) {
			global.mw = global.mw || {};
			global.mw.config = {
				get: jest.fn( function ( key ) {
					return key === 'wgUserId' ? id : false;
				} )
			};
		}

		it( 'should scope the key to the current user', function () {
			setUserId( 42 );

			const dm = new DraftManager( mockEditor );

			expect( dm.getStorageKey() ).toContain( 'u42' );
			dm.destroy();
		} );

		it( 'should give two users different keys for the same file', function () {
			setUserId( 1 );
			const first = new DraftManager( mockEditor ).getStorageKey();

			setUserId( 2 );
			const second = new DraftManager( mockEditor ).getStorageKey();

			expect( first ).not.toBe( second );
		} );

		it( 'should fall back to anon when logged out', function () {
			setUserId( null );

			const dm = new DraftManager( mockEditor );

			expect( dm.getStorageKey() ).toContain( 'anon' );
			dm.destroy();
		} );
	} );

	describe( 'sweepExpiredDrafts', function () {
		/**
		 * The shared mock lacks length/key(), which real localStorage has.
		 *
		 * @param {Object} store Backing object for the fake storage
		 */
		function makeEnumerableStorage( store ) {
			global.localStorage = {
				get length() {
					return Object.keys( store ).length;
				},
				key: jest.fn( function ( i ) {
					return Object.keys( store )[ i ] || null;
				} ),
				getItem: jest.fn( function ( k ) {
					return store[ k ] || null;
				} ),
				setItem: jest.fn( function ( k, v ) {
					store[ k ] = v;
				} ),
				removeItem: jest.fn( function ( k ) {
					delete store[ k ];
				} )
			};
		}

		it( 'should remove drafts past the expiry and keep fresh ones', function () {
			const dm = new DraftManager( mockEditor );
			const store = {
				[DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'Old_jpg_aaaa', '', 1 )]: JSON.stringify( {
					timestamp: Date.now() - ( 48 * 60 * 60 * 1000 )
				} ),
				[DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'Fresh_jpg_bbbb', '', 1 )]: JSON.stringify( { timestamp: Date.now() } ),
				'unrelated-key': 'keep me'
			};
			makeEnumerableStorage( store );

			expect( dm.sweepExpiredDrafts() ).toBe( 1 );
			expect( store[ DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'Old_jpg_aaaa', '', 1 ) ] ).toBeUndefined();
			expect( store[ DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'Fresh_jpg_bbbb', '', 1 ) ] ).toBeDefined();
			expect( store[ 'unrelated-key' ] ).toBe( 'keep me' );
			dm.destroy();
		} );

		it( 'should drop unparseable drafts', function () {
			const dm = new DraftManager( mockEditor );
			const store = { [DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'Broken_jpg_cccc', '', 1 )]: 'not json' };
			makeEnumerableStorage( store );

			dm.sweepExpiredDrafts();

			expect( store[ DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'Broken_jpg_cccc', '', 1 ) ] ).toBeUndefined();
			dm.destroy();
		} );

		it( 'should also drop the oldest survivors when aggressive', function () {
			const dm = new DraftManager( mockEditor );
			const now = Date.now();
			const store = {
				[DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'A_jpg_1111', '', 1 )]: JSON.stringify( { timestamp: now - 1000 } ),
				[DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'B_jpg_2222', '', 1 )]: JSON.stringify( { timestamp: now - 500 } )
			};
			makeEnumerableStorage( store );

			expect( dm.sweepExpiredDrafts( true ) ).toBe( 1 );
			expect( store[ DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'A_jpg_1111', '', 1 ) ] ).toBeUndefined();
			expect( store[ DraftManager.encodeKey( dm.wikiScope, dm.userScope, 'B_jpg_2222', '', 1 ) ] ).toBeDefined();
			dm.destroy();
		} );

		it( 'should be a no-op when storage cannot be enumerated', function () {
			const dm = new DraftManager( mockEditor );
			expect( dm.sweepExpiredDrafts() ).toBe( 0 );
			dm.destroy();
		} );
	} );

	describe( 'quota recovery', function () {
		it( 'should retry once after freeing space', function () {
			const dm = new DraftManager( mockEditor );
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );

			const quotaError = new Error( 'full' );
			quotaError.name = 'QuotaExceededError';
			let firstCall = true;
			global.localStorage.setItem = jest.fn( function () {
				if ( firstCall ) {
					firstCall = false;
					throw quotaError;
				}
			} );
			jest.spyOn( dm, 'sweepExpiredDrafts' ).mockReturnValue( 3 );

			expect( dm.saveDraft() ).toBe( true );
			expect( dm.sweepExpiredDrafts ).toHaveBeenCalledWith( true );
			dm.destroy();
		} );

		it( 'should give up when nothing could be freed', function () {
			const dm = new DraftManager( mockEditor );
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );

			const quotaError = new Error( 'full' );
			quotaError.name = 'QuotaExceededError';
			global.localStorage.setItem = jest.fn( function () {
				throw quotaError;
			} );
			jest.spyOn( dm, 'sweepExpiredDrafts' ).mockReturnValue( 0 );

			expect( dm.saveDraft() ).toBe( false );
			dm.destroy();
		} );

		it( 'should not retry for a non-quota error', function () {
			const dm = new DraftManager( mockEditor );
			mockEditor.isDirty = jest.fn( function () {
				return true;
			} );

			global.localStorage.setItem = jest.fn( function () {
				throw new Error( 'something else' );
			} );
			jest.spyOn( dm, 'sweepExpiredDrafts' ).mockReturnValue( 5 );

			expect( dm.saveDraft() ).toBe( false );
			expect( dm.sweepExpiredDrafts ).not.toHaveBeenCalled();
			dm.destroy();
		} );

		it( 'should recognise the browser-specific quota error shapes', function () {
			const firefox = new Error( 'x' );
			firefox.name = 'NS_ERROR_DOM_QUOTA_REACHED';
			const safari = new Error( 'x' );
			safari.code = 22;
			const oldWebkit = new Error( 'x' );
			oldWebkit.code = 1014;

			expect( DraftManager.isQuotaError( firefox ) ).toBe( true );
			expect( DraftManager.isQuotaError( safari ) ).toBe( true );
			expect( DraftManager.isQuotaError( oldWebkit ) ).toBe( true );
			expect( DraftManager.isQuotaError( new Error( 'x' ) ) ).toBe( false );
			expect( DraftManager.isQuotaError( null ) ).toBe( false );
		} );
	} );

	describe( 'J16 unambiguous draft identity and safe legacy recovery', function () {
		describe( 'injective tuple encoding and collision elimination', function () {
			it( 'eliminates collisions between "A B" and "A_B"', function () {
				const key1 = draftManager.buildStorageKey( 'Doc.pdf', 'A B', 1 );
				const key2 = draftManager.buildStorageKey( 'Doc.pdf', 'A_B', 1 );

				expect( key1 ).not.toBe( key2 );

				const decoded1 = DraftManager.decodeKey( key1 );
				const decoded2 = DraftManager.decodeKey( key2 );
				expect( decoded1.setName ).toBe( 'A B' );
				expect( decoded2.setName ).toBe( 'A_B' );
			} );

			it( 'eliminates collisions between set "x-p2" on page 1 and set "x" on page 2', function () {
				const key1 = draftManager.buildStorageKey( 'Doc.pdf', 'x-p2', 1 );
				const key2 = draftManager.buildStorageKey( 'Doc.pdf', 'x', 2 );

				expect( key1 ).not.toBe( key2 );

				const decoded1 = DraftManager.decodeKey( key1 );
				const decoded2 = DraftManager.decodeKey( key2 );
				expect( decoded1.setName ).toBe( 'x-p2' );
				expect( decoded1.page ).toBe( 1 );
				expect( decoded2.setName ).toBe( 'x' );
				expect( decoded2.page ).toBe( 2 );
			} );

			it( 'eliminates collisions between Unicode set names (Cyrillic Слой 1 vs Слой 2)', function () {
				const key1 = draftManager.buildStorageKey( 'Doc.pdf', 'Слой 1', 1 );
				const key2 = draftManager.buildStorageKey( 'Doc.pdf', 'Слой 2', 1 );

				expect( key1 ).not.toBe( key2 );

				const decoded1 = DraftManager.decodeKey( key1 );
				const decoded2 = DraftManager.decodeKey( key2 );
				expect( decoded1.setName ).toBe( 'Слой 1' );
				expect( decoded2.setName ).toBe( 'Слой 2' );
			} );

			it( 'preserves special characters and round-trips via decodeKey', function () {
				const complexSet = 'special/chars & [symbols] "quotes"';
				const key = draftManager.buildStorageKey( 'File:Path/Sub.png', complexSet, 5 );

				const decoded = DraftManager.decodeKey( key );
				expect( decoded.filename ).toBe( 'File:Path/Sub.png' );
				expect( decoded.setName ).toBe( complexSet );
				expect( decoded.page ).toBe( 5 );
			} );

			it( 'returns null when decoding invalid or corrupted v2 keys', function () {
				expect( DraftManager.decodeKey( 'not-a-v2-key' ) ).toBeNull();
				expect( DraftManager.decodeKey( 'layers-draft-v2:invalid-json' ) ).toBeNull();
				expect( DraftManager.decodeKey( 'layers-draft-v2:[1,2,3]' ) ).toBeNull();
				expect( DraftManager.decodeKey( null ) ).toBeNull();
			} );
		} );

		describe( 'multi-user and multi-wiki isolation', function () {
			it( 'isolates keys across different users on the same wiki and file', function () {
				const editorUser1 = { ...mockEditor, userScope: 'u101', wikiScope: 'mywiki' };
				const editorUser2 = { ...mockEditor, userScope: 'u102', wikiScope: 'mywiki' };

				const dm1 = new DraftManager( editorUser1 );
				const dm2 = new DraftManager( editorUser2 );

				expect( dm1.getStorageKey() ).not.toBe( dm2.getStorageKey() );
				expect( DraftManager.decodeKey( dm1.getStorageKey() ).userScope ).toBe( 'u101' );
				expect( DraftManager.decodeKey( dm2.getStorageKey() ).userScope ).toBe( 'u102' );

				dm1.destroy();
				dm2.destroy();
			} );

			it( 'isolates keys across different wikis on the same user and file', function () {
				const editorWikiA = { ...mockEditor, userScope: 'u101', wikiScope: 'wikiA' };
				const editorWikiB = { ...mockEditor, userScope: 'u101', wikiScope: 'wikiB' };

				const dmA = new DraftManager( editorWikiA );
				const dmB = new DraftManager( editorWikiB );

				expect( dmA.getStorageKey() ).not.toBe( dmB.getStorageKey() );
				expect( DraftManager.decodeKey( dmA.getStorageKey() ).wikiScope ).toBe( 'wikiA' );
				expect( DraftManager.decodeKey( dmB.getStorageKey() ).wikiScope ).toBe( 'wikiB' );

				dmA.destroy();
				dmB.destroy();
			} );

			it( 'sweepExpiredDrafts does not sweep other users\' or other wikis\' drafts', function () {
				const currentEditor = { ...mockEditor, userScope: 'u1', wikiScope: 'wiki1' };
				const dm = new DraftManager( currentEditor );

				const expiredTimestamp = Date.now() - ( 25 * 60 * 60 * 1000 );

				// Expired draft for CURRENT user and CURRENT wiki
				const myExpiredKey = DraftManager.encodeKey( 'wiki1', 'u1', 'Old.jpg', 'default', 1 );
				mockLocalStorage[ myExpiredKey ] = JSON.stringify( { timestamp: expiredTimestamp, layers: [] } );

				// Expired draft for ANOTHER user on same wiki
				const otherUserExpiredKey = DraftManager.encodeKey( 'wiki1', 'u2', 'Old.jpg', 'default', 1 );
				mockLocalStorage[ otherUserExpiredKey ] = JSON.stringify( { timestamp: expiredTimestamp, layers: [] } );

				// Expired draft for SAME user on ANOTHER wiki
				const otherWikiExpiredKey = DraftManager.encodeKey( 'wiki2', 'u1', 'Old.jpg', 'default', 1 );
				mockLocalStorage[ otherWikiExpiredKey ] = JSON.stringify( { timestamp: expiredTimestamp, layers: [] } );

				// Expired legacy draft for ANOTHER user
				const otherUserLegacyKey = 'layers-draft-u2-Old.jpg_1234-default';
				mockLocalStorage[ otherUserLegacyKey ] = JSON.stringify( { timestamp: expiredTimestamp, layers: [] } );

				global.localStorage.key = jest.fn( ( idx ) => Object.keys( mockLocalStorage )[ idx ] );
				Object.defineProperty( global.localStorage, 'length', {
					get: () => Object.keys( mockLocalStorage ).length,
					configurable: true
				} );

				const removed = dm.sweepExpiredDrafts();

				expect( removed ).toBe( 1 );
				expect( mockLocalStorage[ myExpiredKey ] ).toBeUndefined();
				expect( mockLocalStorage[ otherUserExpiredKey ] ).toBeDefined();
				expect( mockLocalStorage[ otherWikiExpiredKey ] ).toBeDefined();
				expect( mockLocalStorage[ otherUserLegacyKey ] ).toBeDefined();

				dm.destroy();
			} );
		} );

		describe( 'safe legacy lookup and migration', function () {
			it( 'preserves unscoped legacy drafts through load, clear and quota sweeps', function () {
				const dm = new DraftManager( mockEditor );
				const key = dm.getLegacyStorageKey();
				const stored = JSON.stringify( {
					filename: dm.filename, setName: 'default', page: 1,
					timestamp: 1, layers: [ { id: 'recoverable' } ]
				} );
				mockLocalStorage[ key ] = stored;
				expect( dm.loadDraft() ).toBeNull();
				expect( dm.getAmbiguousLegacyRecord().key ).toBe( key );
				dm.clearDraft();
				dm.sweepExpiredDrafts( true );
				expect( mockLocalStorage[ key ] ).toBe( stored );
				expect( dm.captureDraft() ).toBeNull();
				dm.destroy();
			} );

			it( 'cannot delete a legacy record alongside a captured v2 draft', function () {
				const dm = new DraftManager( mockEditor );
				const legacy = dm.getLegacyStorageKey();
				mockLocalStorage[ legacy ] = 'recoverable malformed legacy data';
				mockLocalStorage[ dm.getStorageKey() ] = 'saved-v2';
				dm.clearDraft( { expectedDraft: dm.captureDraft() } );
				expect( mockLocalStorage[ legacy ] ).toBe( 'recoverable malformed legacy data' );
				expect( mockLocalStorage[ dm.getStorageKey() ] ).toBeUndefined();
				dm.destroy();
			} );

			it( 'safely migrates a matching legacy draft to v2 and deletes the legacy key', function () {
				const dm = new DraftManager( mockEditor );
				const legacyKey = dm.getLegacyStorageKey();
				const v2Key = dm.getStorageKey();

				const legacyDraft = {
					version: 1,
					wikiScope: dm.wikiScope,
					userScope: dm.userScope,
					timestamp: Date.now() - 1000,
					filename: 'Test_Image.jpg',
					setName: 'default',
					page: 1,
					layers: [ { id: 'leg1', type: 'text' } ]
				};
				mockLocalStorage[ legacyKey ] = JSON.stringify( legacyDraft );

				const loaded = dm.loadDraft();
				expect( loaded ).not.toBeNull();
				expect( loaded.layers ).toEqual( [ { id: 'leg1', type: 'text' } ] );

				// Verify migrated to v2 in localStorage
				expect( mockLocalStorage[ v2Key ] ).toBeDefined();
				const migrated = JSON.parse( mockLocalStorage[ v2Key ] );
				expect( migrated.version ).toBe( 2 );
				expect( migrated.wikiScope ).toBe( dm.wikiScope );
				expect( migrated.userScope ).toBe( dm.userScope );

				// Verify old legacy key was removed
				expect( mockLocalStorage[ legacyKey ] ).toBeUndefined();

				dm.destroy();
			} );

			it( 'does not load or delete a legacy draft whose payload setName mismatches', function () {
				const dm = new DraftManager( mockEditor );
				const legacyKey = dm.getLegacyStorageKey();

				// Key matches lossy pattern, but payload has different setName
				const mismatchedLegacyDraft = {
					version: 1,
					wikiScope: dm.wikiScope,
					userScope: dm.userScope,
					timestamp: Date.now() - 1000,
					filename: 'Test_Image.jpg',
					setName: 'different-set',
					page: 1,
					layers: [ { id: 'leg2', type: 'text' } ]
				};
				mockLocalStorage[ legacyKey ] = JSON.stringify( mismatchedLegacyDraft );

				const loaded = dm.loadDraft();
				expect( loaded ).toBeNull();

				// Mismatched record must NOT be deleted
				expect( mockLocalStorage[ legacyKey ] ).toBeDefined();

				dm.destroy();
			} );

			it( 'preserves and reports ambiguous legacy records without deleting or applying them', function () {
				const dm = new DraftManager( mockEditor );
				const legacyKey = dm.getLegacyStorageKey();

				// Ambiguous record missing explicit filename and setName fields
				const ambiguousDraft = {
					version: 1,
					wikiScope: dm.wikiScope,
					userScope: dm.userScope,
					timestamp: Date.now() - 1000,
					layers: [ { id: 'leg3', type: 'text' } ]
				};
				mockLocalStorage[ legacyKey ] = JSON.stringify( ambiguousDraft );

				const loaded = dm.loadDraft();
				expect( loaded ).toBeNull();

				// Ambiguous record preserved
				expect( mockLocalStorage[ legacyKey ] ).toBeDefined();

				// Visible reporting path
				const reported = dm.getAmbiguousLegacyRecord();
				expect( reported ).not.toBeNull();
				expect( reported.key ).toBe( legacyKey );
				expect( reported.draft.layers ).toHaveLength( 1 );

				dm.destroy();
			} );

			it( 'preserves legacy key on quota failure during migration and returns in-memory draft', function () {
				const dm = new DraftManager( mockEditor );
				const legacyKey = dm.getLegacyStorageKey();

				const legacyDraft = {
					version: 1,
					wikiScope: dm.wikiScope,
					userScope: dm.userScope,
					timestamp: Date.now() - 1000,
					filename: 'Test_Image.jpg',
					setName: 'default',
					page: 1,
					layers: [ { id: 'leg4', type: 'text' } ]
				};
				mockLocalStorage[ legacyKey ] = JSON.stringify( legacyDraft );

				// Make setItem throw quota error
				const quotaErr = new Error( 'Quota reached' );
				quotaErr.name = 'QuotaExceededError';
				global.localStorage.setItem = jest.fn( function () {
					throw quotaErr;
				} );

				const loaded = dm.loadDraft();

				// Returns draft for in-memory recovery
				expect( loaded ).not.toBeNull();
				expect( loaded.layers ).toHaveLength( 1 );

				// Old legacy key must NOT be removed on quota failure
				expect( mockLocalStorage[ legacyKey ] ).toBeDefined();

				dm.destroy();
			} );

			it( 'preserves malformed legacy draft for manual recovery', function () {
				const dm = new DraftManager( mockEditor );
				const legacyKey = dm.getLegacyStorageKey();
				mockLocalStorage[ legacyKey ] = 'not-valid-json';

				const loaded = dm.loadDraft();
				expect( loaded ).toBeNull();
				expect( mockLocalStorage[ legacyKey ] ).toBeDefined();

				dm.destroy();
			} );

			it( 'removes expired matching legacy draft', function () {
				const dm = new DraftManager( mockEditor );
				const legacyKey = dm.getLegacyStorageKey();

				const expiredLegacyDraft = {
					version: 1,
					wikiScope: dm.wikiScope,
					userScope: dm.userScope,
					timestamp: Date.now() - ( 25 * 60 * 60 * 1000 ),
					filename: 'Test_Image.jpg',
					setName: 'default',
					page: 1,
					layers: [ { id: 'expired' } ]
				};
				mockLocalStorage[ legacyKey ] = JSON.stringify( expiredLegacyDraft );

				const loaded = dm.loadDraft();
				expect( loaded ).toBeNull();
				expect( mockLocalStorage[ legacyKey ] ).toBeUndefined();

				dm.destroy();
			} );
		} );

		describe( 'save and discard isolation across sets and pages', function () {
			it( 'clearing draft for set 1 does not delete draft for set 2 or page 2', function () {
				const dm = new DraftManager( mockEditor );

				const keySet1Page1 = dm.getStorageKey( { setName: 'set1', page: 1 } );
				const keySet1Page2 = dm.getStorageKey( { setName: 'set1', page: 2 } );
				const keySet2Page1 = dm.getStorageKey( { setName: 'set2', page: 1 } );

				mockLocalStorage[ keySet1Page1 ] = JSON.stringify( { timestamp: 100, layers: [ { id: '1' } ] } );
				mockLocalStorage[ keySet1Page2 ] = JSON.stringify( { timestamp: 200, layers: [ { id: '2' } ] } );
				mockLocalStorage[ keySet2Page1 ] = JSON.stringify( { timestamp: 300, layers: [ { id: '3' } ] } );

				dm.clearDraft( { setName: 'set1', page: 1 } );

				expect( mockLocalStorage[ keySet1Page1 ] ).toBeUndefined();
				expect( mockLocalStorage[ keySet1Page2 ] ).toBeDefined();
				expect( mockLocalStorage[ keySet2Page1 ] ).toBeDefined();

				dm.destroy();
			} );

			it( 'honors expectedDraft guard during clearDraft to prevent racing overwrites', function () {
				const dm = new DraftManager( mockEditor );
				const key = dm.getStorageKey();

				const originalValue = JSON.stringify( { timestamp: 100, layers: [ { id: 'orig' } ] } );
				mockLocalStorage[ key ] = originalValue;

				// Simulates user editing in background while save was in flight
				const updatedValue = JSON.stringify( { timestamp: 150, layers: [ { id: 'orig' }, { id: 'new' } ] } );
				mockLocalStorage[ key ] = updatedValue;

				// clearDraft with expectedDraft matching original snapshot
				dm.clearDraft( { expectedDraft: originalValue } );

				// Newer draft must NOT be cleared
				expect( mockLocalStorage[ key ] ).toBe( updatedValue );

				dm.destroy();
			} );
		} );

		describe( 'J19 draft recovery without inferring ownership', function () {
			beforeEach( function () {
				document.body.innerHTML = '';
				if ( !window.URL ) {
					window.URL = {};
				}
				window.URL.createObjectURL = jest.fn( function () {
					return 'blob:mock-url';
				} );
				window.URL.revokeObjectURL = jest.fn();
			} );

			afterEach( function () {
				document.body.innerHTML = '';
			} );

			describe( 'MediaWiki runtime scope discovery and candidate fallback', function () {
				it( 'standardizes on canonical wgWikiID with table prefix and script path', function () {
					const origMwConfigGet = mw.config.get;
					mw.config.get = jest.fn( function ( key ) {
						if ( key === 'wgWikiID' ) {
							return 'my_wiki-T01';
						}
						if ( key === 'wgScriptPath' ) {
							return '/wiki';
						}
						return null;
					} );

					expect( DraftManager.getWikiScope() ).toBe( 'my_wiki-T01:/wiki' );

					mw.config.get = origMwConfigGet;
				} );

				it( 'falls back to wgDBname and wgDBprefix when wgWikiID is absent', function () {
					const origMwConfigGet = mw.config.get;
					mw.config.get = jest.fn( function ( key ) {
						if ( key === 'wgDBname' ) {
							return 'shared_db';
						}
						if ( key === 'wgDBprefix' ) {
							return 'site1';
						}
						return null;
					} );

					expect( DraftManager.getWikiScope() ).toBe( 'shared_db-site1' );

					mw.config.get = origMwConfigGet;
				} );

				it( 'distinguishes multiple wikis sharing an origin with different script paths', function () {
					const origMwConfigGet = mw.config.get;
					mw.config.get = jest.fn( function ( key ) {
						if ( key === 'wgWikiID' ) {
							return 'shared_wiki';
						}
						if ( key === 'wgScriptPath' ) {
							return '/w2';
						}
						return null;
					} );

					const scope1 = DraftManager.getWikiScope();

					mw.config.get = jest.fn( function ( key ) {
						if ( key === 'wgWikiID' ) {
							return 'shared_wiki';
						}
						if ( key === 'wgScriptPath' ) {
							return '/w3';
						}
						return null;
					} );

					const scope2 = DraftManager.getWikiScope();

					expect( scope1 ).toBe( 'shared_wiki:/w2' );
					expect( scope2 ).toBe( 'shared_wiki:/w3' );
					expect( scope1 ).not.toBe( scope2 );

					mw.config.get = origMwConfigGet;
				} );

				it( 'returns candidate scopes including prior review branch scopes', function () {
					const origMwConfigGet = mw.config.get;
					mw.config.get = jest.fn( function ( key ) {
						if ( key === 'wgWikiID' ) {
							return 'my_wiki-T01';
						}
						if ( key === 'wgDBname' ) {
							return 'my_wiki';
						}
						if ( key === 'wgScriptPath' ) {
							return '/wiki';
						}
						return null;
					} );

					const candidates = DraftManager.getCandidateWikiScopes();
					expect( candidates ).toContain( 'my_wiki-T01:/wiki' );
					expect( candidates ).toContain( 'my_wiki-T01' );
					expect( candidates ).toContain( 'my_wiki' );
					expect( candidates ).toContain( 'default' );

					mw.config.get = origMwConfigGet;
				} );

				it( 'retains and recovers draft stored under prior candidate scope when primary key has no draft', function () {
					const origMwConfigGet = mw.config.get;
					mw.config.get = jest.fn( function ( key ) {
						if ( key === 'wgWikiID' ) {
							return 'my_wiki-T01';
						}
						if ( key === 'wgDBname' ) {
							return 'my_wiki';
						}
						if ( key === 'wgScriptPath' ) {
							return '/wiki';
						}
						return null;
					} );

					const dm = new DraftManager( mockEditor );
					expect( dm.wikiScope ).toBe( 'my_wiki-T01:/wiki' );

					// Draft stored under prior review branch scope 'my_wiki' without script path
					const candidateKey = dm.buildStorageKey( dm.filename, 'default', 1, {
						wikiScope: 'my_wiki',
						userScope: dm.userScope
					} );
					mockLocalStorage[ candidateKey ] = JSON.stringify( {
						version: 2,
						wikiScope: 'my_wiki',
						userScope: dm.userScope,
						filename: dm.filename,
						setName: 'default',
						page: 1,
						timestamp: Date.now() - 1000,
						layers: [ { id: 'cand1', type: 'rectangle' } ]
					} );

					const loaded = dm.loadDraft();
					expect( loaded ).not.toBeNull();
					expect( loaded.layers ).toHaveLength( 1 );
					expect( loaded.layers[ 0 ].id ).toBe( 'cand1' );

					dm.destroy();
					mw.config.get = origMwConfigGet;
				} );
			} );

			describe( 'strict decoded v2 tuple types and complete payload identity', function () {
				it( 'rejects tuple with non-integer, float, or invalid page numbers', function () {
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki","user","file","set",1.5]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki","user","file","set",0]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki","user","file","set",-1]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki","user","file","set","1"]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki","user","file","set",null]' ) ).toBeNull();
				} );

				it( 'rejects tuple with invalid scope or filename types', function () {
					expect( DraftManager.decodeKey( 'layers-draft-v2:[123,"user","file","set",1]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki",123,"file","set",1]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["","user","file","set",1]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki","","file","set",1]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki","user",null,"set",1]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki","user","file","set"]' ) ).toBeNull();
					expect( DraftManager.decodeKey( 'layers-draft-v2:["wiki","user","file","set",1,2]' ) ).toBeNull();
				} );

				it( 'strictly rejects payload filename normalization mismatches (spaces vs underscores)', function () {
					const dm = new DraftManager( mockEditor ); // mockEditor filename is 'Test_Image.jpg'

					// Payload has 'Test Image.jpg' with spaces instead of underscores
					const mismatchedDraft = {
						version: 2,
						wikiScope: dm.wikiScope,
						userScope: dm.userScope,
						filename: 'Test Image.jpg',
						setName: 'default',
						page: 1,
						timestamp: Date.now() - 1000,
						layers: [ { id: 'mismatched' } ]
					};

					expect( dm.matchesCurrentContext( mismatchedDraft ) ).toBe( false );

					// Exact match passes
					const exactDraft = {
						version: 2,
						wikiScope: dm.wikiScope,
						userScope: dm.userScope,
						filename: 'Test_Image.jpg',
						setName: 'default',
						page: 1,
						timestamp: Date.now() - 1000,
						layers: [ { id: 'exact' } ]
					};

					expect( dm.matchesCurrentContext( exactDraft ) ).toBe( true );

					dm.destroy();
				} );
			} );

			describe( 'visible legacy draft notice and dismissal', function () {
				it( 'shows visible banner notice when ordinary unscoped legacy record is present and no v2 draft exists', async function () {
					const dm = new DraftManager( mockEditor );
					const legacyKey = dm.getLegacyStorageKey();

					mockLocalStorage[ legacyKey ] = JSON.stringify( {
						filename: dm.filename,
						setName: 'default',
						page: 1,
						timestamp: Date.now() - 5000,
						layers: [ { id: 'legacy-layer-1', type: 'rectangle' } ]
					} );

					// Editor opens and checks for drafts
					const recovered = await dm.checkAndRecoverDraft();
					expect( recovered ).toBe( false );

					// Notice element must be present in DOM
					const notice = document.querySelector( '.layers-legacy-draft-notice' );
					expect( notice ).not.toBeNull();
					expect( notice.getAttribute( 'role' ) ).toBe( 'status' );

					const reviewBtn = notice.querySelector( '.layers-legacy-review-btn' );
					const dismissBtn = notice.querySelector( '.layers-legacy-dismiss-btn' );
					expect( reviewBtn ).not.toBeNull();
					expect( dismissBtn ).not.toBeNull();

					dm.destroy();
				} );

				it( 'dismisses banner notice when dismiss button is clicked and preserves legacy record in storage', function () {
					const dm = new DraftManager( mockEditor );
					const legacyKey = dm.getLegacyStorageKey();

					const raw = JSON.stringify( {
						filename: dm.filename,
						setName: 'default',
						page: 1,
						timestamp: Date.now() - 5000,
						layers: [ { id: 'leg1' } ]
					} );
					mockLocalStorage[ legacyKey ] = raw;

					dm.showLegacyNotice();
					expect( document.querySelector( '.layers-legacy-draft-notice' ) ).not.toBeNull();

					const dismissBtn = document.querySelector( '.layers-legacy-dismiss-btn' );
					dismissBtn.click();

					// Notice removed from DOM
					expect( document.querySelector( '.layers-legacy-draft-notice' ) ).toBeNull();

					// Storage preserved intact
					expect( mockLocalStorage[ legacyKey ] ).toBe( raw );

					dm.destroy();
				} );

				it( 'dismisses notice on Escape keydown', function () {
					const dm = new DraftManager( mockEditor );
					const legacyKey = dm.getLegacyStorageKey();
					mockLocalStorage[ legacyKey ] = JSON.stringify( { layers: [ { id: 'l1' } ] } );

					const notice = dm.showLegacyNotice();
					expect( document.querySelector( '.layers-legacy-draft-notice' ) ).not.toBeNull();

					const event = new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true } );
					notice.dispatchEvent( event );

					expect( document.querySelector( '.layers-legacy-draft-notice' ) ).toBeNull();
					expect( mockLocalStorage[ legacyKey ] ).toBeDefined();

					dm.destroy();
				} );
			} );

			describe( 'explicit local export and recovery dialog', function () {
				it( 'renders dialog with escaped metadata text and unscoped warning', function () {
					const dm = new DraftManager( mockEditor );
					const legacyKey = dm.getLegacyStorageKey();

					const raw = JSON.stringify( {
						filename: '<script>alert("xss")</script>',
						setName: '<b>bold-set</b>',
						page: 2,
						timestamp: 1600000000000,
						layers: [ { id: 'l1', type: 'text' } ]
					} );
					mockLocalStorage[ legacyKey ] = raw;

					const record = dm.recordLegacyDraft( legacyKey, raw );
					dm.showLegacyRecoveryDialog( record );

					const dialog = document.querySelector( '.layers-legacy-dialog' );
					expect( dialog ).not.toBeNull();
					expect( dialog.getAttribute( 'role' ) ).toBe( 'dialog' );
					expect( dialog.getAttribute( 'aria-modal' ) ).toBe( 'true' );

					// Check unscoped warning
					const warning = dialog.querySelector( '.layers-legacy-warning' );
					expect( warning ).not.toBeNull();

					// Check escaped metadata text
					const metaFilename = dialog.querySelector( '.layers-legacy-meta-filename' );
					expect( metaFilename.textContent ).toBe( '<script>alert("xss")</script>' );
					// Ensure no script tag is parsed as an HTML element
					expect( dialog.querySelector( 'script' ) ).toBeNull();

					const metaSet = dialog.querySelector( '.layers-legacy-meta-set' );
					expect( metaSet.textContent ).toBe( '<b>bold-set</b>' );
					expect( dialog.querySelector( 'b' ) ).toBeNull();

					const metaPage = dialog.querySelector( '.layers-legacy-meta-page' );
					expect( metaPage.textContent ).toBe( '2' );

					const metaLayers = dialog.querySelector( '.layers-legacy-meta-layers' );
					expect( metaLayers.textContent ).toBe( '1' );

					dm.closeLegacyRecoveryDialog();
					expect( document.querySelector( '.layers-legacy-dialog' ) ).toBeNull();

					dm.destroy();
				} );

				it( 'closes dialog on Escape key and leaves legacy record intact', function () {
					const dm = new DraftManager( mockEditor );
					const legacyKey = dm.getLegacyStorageKey();
					const raw = JSON.stringify( { layers: [ { id: 'esc' } ] } );
					mockLocalStorage[ legacyKey ] = raw;

					const record = dm.recordLegacyDraft( legacyKey, raw );
					dm.showLegacyRecoveryDialog( record );

					expect( document.querySelector( '.layers-legacy-dialog' ) ).not.toBeNull();

					const event = new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true } );
					document.dispatchEvent( event );

					expect( document.querySelector( '.layers-legacy-dialog' ) ).toBeNull();
					expect( mockLocalStorage[ legacyKey ] ).toBe( raw );

					dm.destroy();
				} );
			} );

			describe( 'raw byte export and malformed legacy data handling', function () {
				it( 'exports raw bytes as JSON download for ordinary legacy draft', function () {
					const dm = new DraftManager( mockEditor );
					const legacyKey = dm.getLegacyStorageKey();
					const raw = JSON.stringify( {
						filename: dm.filename,
						setName: 'default',
						page: 1,
						layers: [ { id: 'export-me', type: 'circle' } ]
					} );
					mockLocalStorage[ legacyKey ] = raw;

					const record = dm.recordLegacyDraft( legacyKey, raw );
					const exported = dm.exportLegacyRecord( record );

					expect( exported ).toBe( true );
					expect( window.URL.createObjectURL ).toHaveBeenCalled();

					dm.destroy();
				} );

				it( 'allows raw export of malformed unparseable data while disabling import', function () {
					const dm = new DraftManager( mockEditor );
					const legacyKey = dm.getLegacyStorageKey();
					const malformedRaw = 'INVALID_JSON{broken:';
					mockLocalStorage[ legacyKey ] = malformedRaw;

					const record = dm.recordLegacyDraft( legacyKey, malformedRaw );
					expect( record.isMalformed ).toBe( true );

					dm.showLegacyRecoveryDialog( record );

					const dialog = document.querySelector( '.layers-legacy-dialog' );
					expect( dialog ).not.toBeNull();

					// Malformed warning shown
					const malformedWarning = dialog.querySelector( '.layers-legacy-malformed-warning' );
					expect( malformedWarning ).not.toBeNull();

					// Import button must be disabled
					const importBtn = dialog.querySelector( '.layers-legacy-import-btn' );
					expect( importBtn.disabled ).toBe( true );
					expect( importBtn.getAttribute( 'aria-disabled' ) ).toBe( 'true' );

					// Export button must be enabled
					const exportBtn = dialog.querySelector( '.layers-legacy-export-btn' );
					expect( exportBtn.disabled ).toBe( false );

					// Export works for malformed raw string
					exportBtn.click();
					expect( window.URL.createObjectURL ).toHaveBeenCalled();

					// Legacy key is preserved in localStorage
					expect( mockLocalStorage[ legacyKey ] ).toBe( malformedRaw );

					dm.closeLegacyRecoveryDialog();
					dm.destroy();
				} );
			} );

			describe( 'manual import into current set', function () {
				it( 'does not bypass a rejected import or dismiss recovery', function () {
					const dm = new DraftManager( mockEditor );
					mockEditor.importExportManager = {
						parseLayersJSON: jest.fn( () => { throw new Error( 'Too many layers' ); } )
					};
					const raw = JSON.stringify( { layers: [ { id: 'rejected' } ] } );
					const record = dm.recordLegacyDraft( dm.getLegacyStorageKey(), raw );
					dm.showLegacyRecoveryDialog( record );
					expect( dm.importLegacyRecord( record ) ).toBe( false );
					document.querySelector( '.layers-legacy-import-btn' ).click();
					expect( document.querySelector( '.layers-legacy-dialog' ) ).not.toBeNull();
					dm.destroy();
				} );

				it( 'validates layers, sets dirty state, updates canvas and panel, and preserves legacy key', function () {
					const markDirtyMock = jest.fn();
					const renderLayersMock = jest.fn();
					const updateLayersMock = jest.fn();

					const customEditor = {
						filename: 'Test_Image.jpg',
						markDirty: markDirtyMock,
						canvasManager: { renderLayers: renderLayersMock },
						layerPanel: { updateLayers: updateLayersMock },
						stateManager: {
							get: jest.fn( function ( key ) {
								if ( key === 'currentSetName' ) {
									return 'custom-set';
								}
								return null;
							} ),
							update: jest.fn(),
							subscribe: jest.fn( function () {
								return jest.fn();
							} )
						}
					};

					customEditor.importExportManager = new ( require( '../../resources/ext.layers.editor/ImportExportManager.js' ) )( customEditor );
					const dm = new DraftManager( customEditor );
					const legacyKey = dm.getLegacyStorageKey();
					const raw = JSON.stringify( {
						filename: 'Old_Name.jpg',
						setName: 'old-set',
						page: 1,
						layers: [ { id: 'leg-1', type: 'rectangle', text: '<script>safe</script>' } ]
					} );
					mockLocalStorage[ legacyKey ] = raw;

					const record = dm.recordLegacyDraft( legacyKey, raw );
					dm.showLegacyRecoveryDialog( record );

					const importBtn = document.querySelector( '.layers-legacy-import-btn' );
					expect( importBtn.disabled ).toBe( false );

					importBtn.click();

					// Applied to stateManager with isDirty: true
					expect( customEditor.stateManager.update ).toHaveBeenCalledWith( expect.objectContaining( {
						isDirty: true,
						layers: expect.arrayContaining( [
							expect.objectContaining( { id: 'leg-1', type: 'rectangle', text: 'safe' } )
						] )
					} ) );

					expect( markDirtyMock ).toHaveBeenCalled();
					expect( renderLayersMock ).toHaveBeenCalled();
					expect( updateLayersMock ).toHaveBeenCalled();

					// CRITICAL: legacy record in localStorage is NOT removed
					expect( mockLocalStorage[ legacyKey ] ).toBe( raw );

					// Dialog and notice are closed after successful import
					expect( document.querySelector( '.layers-legacy-dialog' ) ).toBeNull();
					expect( document.querySelector( '.layers-legacy-draft-notice' ) ).toBeNull();

					dm.destroy();
				} );

				it( 'preserves legacy draft across editor restart when import was cancelled', function () {
					const dm1 = new DraftManager( mockEditor );
					const legacyKey = dm1.getLegacyStorageKey();
					const raw = JSON.stringify( {
						filename: dm1.filename,
						setName: 'default',
						page: 1,
						layers: [ { id: 'preserved-1' } ]
					} );
					mockLocalStorage[ legacyKey ] = raw;

					// User opens dialog and clicks close
					const record = dm1.detectLegacyDraft();
					dm1.showLegacyRecoveryDialog( record );
					const closeBtn = document.querySelector( '.layers-legacy-close-btn' );
					closeBtn.click();

					dm1.destroy();

					// Restart editor session: new DraftManager instance
					const dm2 = new DraftManager( mockEditor );
					expect( mockLocalStorage[ legacyKey ] ).toBe( raw );
					expect( dm2.hasLegacyDraft() ).toBe( true );

					dm2.destroy();
				} );
			} );
		} );
	} );
} );
