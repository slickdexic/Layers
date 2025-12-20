/**
 * Tests for PresetStorage module
 *
 * @file
 */

'use strict';

const PresetStorage = require( '../../resources/ext.layers.editor/presets/PresetStorage.js' );

describe( 'PresetStorage', () => {
	let storage;
	let mockLocalStorage;

	beforeEach( () => {
		// Mock localStorage
		mockLocalStorage = {};
		global.localStorage = {
			getItem: jest.fn( ( key ) => mockLocalStorage[ key ] || null ),
			setItem: jest.fn( ( key, value ) => {
				mockLocalStorage[ key ] = value;
			} ),
			removeItem: jest.fn( ( key ) => {
				delete mockLocalStorage[ key ];
			} )
		};

		storage = new PresetStorage();
	} );

	afterEach( () => {
		delete global.localStorage;
	} );

	describe( 'constructor', () => {
		test( 'uses default storage key', () => {
			expect( storage.storageKey ).toBe( 'mw-layers-style-presets' );
		} );

		test( 'accepts custom storage key', () => {
			const custom = new PresetStorage( { storageKey: 'custom-key' } );
			expect( custom.storageKey ).toBe( 'custom-key' );
		} );

		test( 'has default supported tools', () => {
			expect( storage.supportedTools ).toContain( 'arrow' );
			expect( storage.supportedTools ).toContain( 'text' );
		} );

		test( 'accepts custom supported tools', () => {
			const custom = new PresetStorage( { supportedTools: [ 'custom' ] } );
			expect( custom.supportedTools ).toEqual( [ 'custom' ] );
		} );
	} );

	describe( 'load', () => {
		test( 'returns null when no data stored', () => {
			const result = storage.load();
			expect( result ).toBeNull();
		} );

		test( 'returns parsed data when valid', () => {
			const data = { version: 1, toolPresets: {}, defaultPresets: {} };
			mockLocalStorage[ storage.storageKey ] = JSON.stringify( data );
			const result = storage.load();
			expect( result ).toEqual( data );
		} );

		test( 'returns null for invalid JSON', () => {
			mockLocalStorage[ storage.storageKey ] = 'not json';
			const result = storage.load();
			expect( result ).toBeNull();
		} );

		test( 'returns null for wrong schema version', () => {
			const data = { version: 999, toolPresets: {} };
			mockLocalStorage[ storage.storageKey ] = JSON.stringify( data );
			const result = storage.load();
			expect( result ).toBeNull();
		} );
	} );

	describe( 'save', () => {
		test( 'saves data to localStorage', () => {
			const data = { toolPresets: {}, defaultPresets: {} };
			const result = storage.save( data );
			expect( result ).toBe( true );
			expect( global.localStorage.setItem ).toHaveBeenCalled();
		} );

		test( 'adds version to saved data', () => {
			storage.save( { toolPresets: {} } );
			const savedData = JSON.parse( mockLocalStorage[ storage.storageKey ] );
			expect( savedData.version ).toBe( 1 );
		} );

		test( 'returns false on error', () => {
			global.localStorage.setItem = jest.fn( () => {
				throw new Error( 'Storage full' );
			} );
			const result = storage.save( {} );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'createEmptyData', () => {
		test( 'creates valid empty structure', () => {
			const data = storage.createEmptyData();
			expect( data.version ).toBe( 1 );
			expect( data.toolPresets ).toBeDefined();
			expect( data.defaultPresets ).toEqual( {} );
		} );

		test( 'initializes empty arrays for supported tools', () => {
			const data = storage.createEmptyData();
			expect( data.toolPresets.arrow ).toEqual( [] );
			expect( data.toolPresets.text ).toEqual( [] );
		} );
	} );

	describe( 'clear', () => {
		test( 'removes data from localStorage', () => {
			mockLocalStorage[ storage.storageKey ] = 'data';
			const result = storage.clear();
			expect( result ).toBe( true );
			expect( global.localStorage.removeItem ).toHaveBeenCalledWith( storage.storageKey );
		} );
	} );

	describe( 'isAvailable', () => {
		test( 'returns true when localStorage works', () => {
			expect( storage.isAvailable() ).toBe( true );
		} );

		test( 'returns false when localStorage throws', () => {
			global.localStorage.setItem = jest.fn( () => {
				throw new Error( 'Disabled' );
			} );
			expect( storage.isAvailable() ).toBe( false );
		} );
	} );

	describe( 'exportToJson', () => {
		test( 'exports data as JSON string', () => {
			const data = {
				toolPresets: { arrow: [ { id: 'test', name: 'Test', style: {} } ] },
				defaultPresets: { arrow: 'test' }
			};
			const json = storage.exportToJson( data );
			const parsed = JSON.parse( json );
			expect( parsed.version ).toBe( 1 );
			expect( parsed.exportedAt ).toBeDefined();
		} );

		test( 'excludes built-in presets by default', () => {
			const data = {
				toolPresets: {
					arrow: [
						{ id: 'builtin-1', builtIn: true, name: 'Built-in', style: {} },
						{ id: 'user-1', builtIn: false, name: 'User', style: {} }
					]
				},
				defaultPresets: {}
			};
			const json = storage.exportToJson( data );
			const parsed = JSON.parse( json );
			expect( parsed.toolPresets.arrow ).toHaveLength( 1 );
			expect( parsed.toolPresets.arrow[ 0 ].id ).toBe( 'user-1' );
		} );

		test( 'includes built-in when option set', () => {
			const data = {
				toolPresets: {
					arrow: [
						{ id: 'builtin-1', builtIn: true, name: 'Built-in', style: {} }
					]
				},
				defaultPresets: {}
			};
			const json = storage.exportToJson( data, { includeBuiltIn: true } );
			const parsed = JSON.parse( json );
			expect( parsed.toolPresets.arrow ).toHaveLength( 1 );
		} );
	} );

	describe( 'importFromJson', () => {
		test( 'imports valid JSON', () => {
			const importJson = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'import-1', name: 'Imported', style: { stroke: '#000' } } ]
				}
			} );
			const result = storage.importFromJson( importJson, storage.createEmptyData() );
			expect( result.success ).toBe( true );
			expect( result.imported ).toBe( 1 );
			expect( result.data.toolPresets.arrow ).toHaveLength( 1 );
		} );

		test( 'returns error for invalid JSON', () => {
			const result = storage.importFromJson( 'not json', {} );
			expect( result.success ).toBe( false );
			expect( result.errors ).toContain( 'Invalid JSON format' );
		} );

		test( 'returns error for invalid format', () => {
			const result = storage.importFromJson( '{"invalid": true}', {} );
			expect( result.success ).toBe( false );
			expect( result.errors ).toContain( 'Invalid preset file format' );
		} );

		test( 'merges with existing data by default', () => {
			const currentData = {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'existing', name: 'Existing', style: {} } ]
				},
				defaultPresets: {}
			};
			const importJson = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'new', name: 'New', style: {} } ]
				}
			} );
			const result = storage.importFromJson( importJson, currentData );
			expect( result.data.toolPresets.arrow ).toHaveLength( 2 );
		} );

		test( 'replaces when merge is false', () => {
			const currentData = {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'existing', name: 'Existing', style: {} } ]
				},
				defaultPresets: {}
			};
			const importJson = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'new', name: 'New', style: {} } ]
				}
			} );
			const result = storage.importFromJson( importJson, currentData, { merge: false } );
			expect( result.data.toolPresets.arrow ).toHaveLength( 1 );
			expect( result.data.toolPresets.arrow[ 0 ].id ).toBe( 'new' );
		} );

		test( 'skips duplicates by default', () => {
			const currentData = {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'same-id', name: 'Existing', style: {} } ]
				},
				defaultPresets: {}
			};
			const importJson = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'same-id', name: 'Imported', style: {} } ]
				}
			} );
			const result = storage.importFromJson( importJson, currentData );
			expect( result.skipped ).toBe( 1 );
			expect( result.data.toolPresets.arrow[ 0 ].name ).toBe( 'Existing' );
		} );

		test( 'overwrites duplicates when option set', () => {
			const currentData = {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'same-id', name: 'Existing', style: {} } ]
				},
				defaultPresets: {}
			};
			const importJson = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'same-id', name: 'Imported', style: {} } ]
				}
			} );
			const result = storage.importFromJson( importJson, currentData, { overwrite: true } );
			expect( result.imported ).toBe( 1 );
			expect( result.data.toolPresets.arrow[ 0 ].name ).toBe( 'Imported' );
		} );

		test( 'adds importedAt timestamp', () => {
			const importJson = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'test', name: 'Test', style: {} } ]
				}
			} );
			const result = storage.importFromJson( importJson, storage.createEmptyData() );
			expect( result.data.toolPresets.arrow[ 0 ].importedAt ).toBeDefined();
		} );

		test( 'skips presets missing required fields', () => {
			const importJson = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [
						{ id: 'valid', name: 'Valid', style: {} },
						{ name: 'Missing ID', style: {} },
						{ id: 'missing-name', style: {} },
						{ id: 'missing-style', name: 'No Style' }
					]
				}
			} );
			const result = storage.importFromJson( importJson, storage.createEmptyData() );
			expect( result.imported ).toBe( 1 );
			expect( result.skipped ).toBe( 3 );
		} );
	} );

	describe( 'sanitizeStyle', () => {
		test( 'keeps allowed properties', () => {
			const style = {
				stroke: '#000',
				strokeWidth: 2,
				fill: '#fff',
				fontSize: 14
			};
			const sanitized = storage.sanitizeStyle( style );
			expect( sanitized ).toEqual( style );
		} );

		test( 'removes unknown properties', () => {
			const style = {
				stroke: '#000',
				unknownProp: 'value',
				anotherUnknown: 123
			};
			const sanitized = storage.sanitizeStyle( style );
			expect( sanitized ).toEqual( { stroke: '#000' } );
			expect( sanitized ).not.toHaveProperty( 'unknownProp' );
		} );

		test( 'handles empty style', () => {
			const sanitized = storage.sanitizeStyle( {} );
			expect( sanitized ).toEqual( {} );
		} );
	} );

	describe( 'extractStyleFromLayer', () => {
		test( 'extracts style properties from layer', () => {
			const layer = {
				id: 'layer-1',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 50,
				height: 50,
				stroke: '#000',
				strokeWidth: 2,
				fill: '#fff'
			};
			const style = storage.extractStyleFromLayer( layer );
			expect( style.stroke ).toBe( '#000' );
			expect( style.strokeWidth ).toBe( 2 );
			expect( style.fill ).toBe( '#fff' );
			// Should not include geometry
			expect( style ).not.toHaveProperty( 'x' );
			expect( style ).not.toHaveProperty( 'id' );
		} );
	} );

	describe( 'generateId', () => {
		test( 'generates ID with timestamp component', () => {
			const id1 = storage.generateId( 'arrow', 'Test Preset' );
			// Should have format: tool-slug-timestamp
			expect( id1 ).toMatch( /^arrow-test-preset-[a-z0-9]+$/ );
		} );

		test( 'includes tool type in ID', () => {
			const id = storage.generateId( 'arrow', 'Test' );
			expect( id.startsWith( 'arrow-' ) ).toBe( true );
		} );

		test( 'slugifies name', () => {
			const id = storage.generateId( 'arrow', 'Test Preset Name!' );
			expect( id ).toMatch( /^arrow-test-preset-name-/ );
		} );
	} );

	describe( 'getStorageSize', () => {
		test( 'returns 0 for empty storage', () => {
			expect( storage.getStorageSize() ).toBe( 0 );
		} );

		test( 'returns size in bytes when data exists', () => {
			mockLocalStorage[ storage.storageKey ] = '{"test": true}';
			const size = storage.getStorageSize();
			expect( size ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'static constants', () => {
		test( 'exposes STORAGE_KEY', () => {
			expect( PresetStorage.STORAGE_KEY ).toBe( 'mw-layers-style-presets' );
		} );

		test( 'exposes SCHEMA_VERSION', () => {
			expect( PresetStorage.SCHEMA_VERSION ).toBe( 1 );
		} );

		test( 'exposes ALLOWED_STYLE_PROPERTIES', () => {
			expect( Array.isArray( PresetStorage.ALLOWED_STYLE_PROPERTIES ) ).toBe( true );
			expect( PresetStorage.ALLOWED_STYLE_PROPERTIES ).toContain( 'stroke' );
			expect( PresetStorage.ALLOWED_STYLE_PROPERTIES ).toContain( 'fill' );
		} );
	} );
} );
