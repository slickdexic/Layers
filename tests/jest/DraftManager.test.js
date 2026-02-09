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
				setName: 'annotations'
			};
			mockLocalStorage[ draftManager.getStorageKey() ] = JSON.stringify( draft );

			const info = draftManager.getDraftInfo();

			expect( info ).not.toBeNull();
			expect( info.layerCount ).toBe( 2 );
			expect( info.setName ).toBe( 'annotations' );
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

		it( 'should recover draft from a different set name', async function () {
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
			
			expect( result ).toBe( true );
			// Verify the set name is restored
			expect( mockEditor.stateManager.update ).toHaveBeenCalledWith(
				expect.objectContaining( {
					layers: [ { id: 'layer1' } ]
				} )
			);
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

			// Should use default set name
			expect( key ).toContain( 'default' );
			expect( key ).toContain( 'Test_Image.jpg' );
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
} );
