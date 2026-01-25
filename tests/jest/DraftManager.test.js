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
} );
