/**
 * Jest tests for PresetManager
 *
 * Tests for style preset storage, retrieval, and management.
 */
'use strict';

const PresetManager = require( '../../resources/ext.layers.editor/presets/PresetManager.js' );

describe( 'PresetManager', () => {
	let manager;
	let mockStorage;

	beforeEach( () => {
		// Mock localStorage
		mockStorage = {};
		global.localStorage = {
			getItem: jest.fn( ( key ) => mockStorage[ key ] || null ),
			setItem: jest.fn( ( key, value ) => {
				mockStorage[ key ] = value;
			} ),
			removeItem: jest.fn( ( key ) => {
				delete mockStorage[ key ];
			} ),
			clear: jest.fn( () => {
				mockStorage = {};
			} )
		};

		manager = new PresetManager();
	} );

	afterEach( () => {
		if ( manager ) {
			manager.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default storage key', () => {
			expect( manager.storageKey ).toBe( PresetManager.STORAGE_KEY );
		} );

		it( 'should accept custom storage key', () => {
			const custom = new PresetManager( { storageKey: 'custom-key' } );
			expect( custom.storageKey ).toBe( 'custom-key' );
			custom.destroy();
		} );

		it( 'should initialize empty cache', () => {
			expect( manager.cache ).toBeDefined();
			expect( manager.cache.version ).toBe( PresetManager.SCHEMA_VERSION );
		} );
	} );

	describe( 'load', () => {
		it( 'should load presets from localStorage', () => {
			const stored = {
				version: PresetManager.SCHEMA_VERSION,
				toolPresets: {
					arrow: [ { id: 'test', name: 'Test', style: {} } ]
				},
				defaultPresets: {}
			};
			mockStorage[ PresetManager.STORAGE_KEY ] = JSON.stringify( stored );

			manager.load();

			expect( manager.cache.toolPresets.arrow ).toHaveLength( 1 );
			expect( manager.cache.toolPresets.arrow[ 0 ].id ).toBe( 'test' );
		} );

		it( 'should initialize empty data if localStorage is empty', () => {
			manager.load();

			expect( manager.cache.version ).toBe( PresetManager.SCHEMA_VERSION );
			expect( manager.cache.toolPresets ).toBeDefined();
		} );

		it( 'should handle invalid JSON gracefully', () => {
			mockStorage[ PresetManager.STORAGE_KEY ] = 'invalid json';

			expect( () => manager.load() ).not.toThrow();
			expect( manager.cache.version ).toBe( PresetManager.SCHEMA_VERSION );
		} );
	} );

	describe( 'save', () => {
		it( 'should save presets to localStorage', () => {
			manager.save();

			expect( localStorage.setItem ).toHaveBeenCalledWith(
				PresetManager.STORAGE_KEY,
				expect.any( String )
			);
		} );

		it( 'should notify listeners on save', () => {
			const listener = jest.fn();
			manager.subscribe( listener );

			manager.save();

			expect( listener ).toHaveBeenCalledWith( 'save', undefined );
		} );
	} );

	describe( 'getPresetsForTool', () => {
		it( 'should return built-in presets for supported tools', () => {
			const presets = manager.getPresetsForTool( 'arrow' );

			expect( presets.length ).toBeGreaterThan( 0 );
			expect( presets[ 0 ].builtIn ).toBe( true );
		} );

		it( 'should return empty array for unsupported tools', () => {
			const presets = manager.getPresetsForTool( 'unsupported' );

			expect( presets ).toEqual( [] );
		} );

		it( 'should combine built-in and user presets', () => {
			manager.addPreset( 'arrow', 'My Arrow', { stroke: '#ff0000' } );

			const presets = manager.getPresetsForTool( 'arrow' );
			const userPresets = presets.filter( ( p ) => !p.builtIn );

			expect( userPresets ).toHaveLength( 1 );
			expect( userPresets[ 0 ].name ).toBe( 'My Arrow' );
		} );
	} );

	describe( 'addPreset', () => {
		it( 'should add a new user preset', () => {
			const preset = manager.addPreset( 'arrow', 'Test Arrow', {
				stroke: '#ff0000',
				strokeWidth: 3
			} );

			expect( preset ).toBeDefined();
			expect( preset.id ).toContain( 'arrow-test-arrow' );
			expect( preset.name ).toBe( 'Test Arrow' );
			expect( preset.builtIn ).toBe( false );
			expect( preset.style.stroke ).toBe( '#ff0000' );
		} );

		it( 'should save to localStorage after adding', () => {
			manager.addPreset( 'arrow', 'Test', { stroke: '#000' } );

			expect( localStorage.setItem ).toHaveBeenCalled();
		} );

		it( 'should set as default if option is provided', () => {
			const preset = manager.addPreset( 'arrow', 'My Custom Arrow', { stroke: '#000' }, {
				setAsDefault: true
			} );

			const defaultPreset = manager.getDefaultPreset( 'arrow' );
			expect( defaultPreset.id ).toBe( preset.id );
		} );

		it( 'should return null for unsupported tool', () => {
			const preset = manager.addPreset( 'unsupported', 'Test', {} );

			expect( preset ).toBeNull();
		} );

		it( 'should return null for invalid name', () => {
			const preset = manager.addPreset( 'arrow', '', {} );

			expect( preset ).toBeNull();
		} );

		it( 'should sanitize style properties', () => {
			const preset = manager.addPreset( 'arrow', 'Test', {
				stroke: '#ff0000',
				invalidProp: 'should be removed',
				malicious: '<script>'
			} );

			expect( preset.style.stroke ).toBe( '#ff0000' );
			expect( preset.style.invalidProp ).toBeUndefined();
			expect( preset.style.malicious ).toBeUndefined();
		} );

		it( 'should notify listeners', () => {
			const listener = jest.fn();
			manager.subscribe( listener );

			manager.addPreset( 'arrow', 'Test', { stroke: '#000' } );

			expect( listener ).toHaveBeenCalledWith( 'preset-added', expect.any( Object ) );
		} );
	} );

	describe( 'getPreset', () => {
		it( 'should return preset by ID', () => {
			const added = manager.addPreset( 'arrow', 'Test', { stroke: '#000' } );
			const found = manager.getPreset( 'arrow', added.id );

			expect( found ).toEqual( added );
		} );

		it( 'should return built-in preset by ID', () => {
			const builtInId = PresetManager.BUILT_IN_PRESETS.arrow[ 0 ].id;
			const found = manager.getPreset( 'arrow', builtInId );

			expect( found ).toBeDefined();
			expect( found.builtIn ).toBe( true );
		} );

		it( 'should return null for non-existent preset', () => {
			const found = manager.getPreset( 'arrow', 'non-existent' );

			expect( found ).toBeNull();
		} );
	} );

	describe( 'updatePreset', () => {
		it( 'should update preset name', () => {
			const preset = manager.addPreset( 'arrow', 'Old Name', { stroke: '#000' } );

			const success = manager.updatePreset( 'arrow', preset.id, { name: 'New Name' } );

			expect( success ).toBe( true );
			const updated = manager.getPreset( 'arrow', preset.id );
			expect( updated.name ).toBe( 'New Name' );
		} );

		it( 'should update preset style', () => {
			const preset = manager.addPreset( 'arrow', 'Test', { stroke: '#000' } );

			manager.updatePreset( 'arrow', preset.id, { style: { stroke: '#ff0000' } } );

			const updated = manager.getPreset( 'arrow', preset.id );
			expect( updated.style.stroke ).toBe( '#ff0000' );
		} );

		it( 'should not update built-in presets', () => {
			const builtInId = PresetManager.BUILT_IN_PRESETS.arrow[ 0 ].id;

			const success = manager.updatePreset( 'arrow', builtInId, { name: 'Hacked' } );

			expect( success ).toBe( false );
		} );

		it( 'should return false for non-existent preset', () => {
			const success = manager.updatePreset( 'arrow', 'non-existent', { name: 'Test' } );

			expect( success ).toBe( false );
		} );
	} );

	describe( 'deletePreset', () => {
		it( 'should delete user preset', () => {
			const preset = manager.addPreset( 'arrow', 'To Delete', { stroke: '#000' } );

			const success = manager.deletePreset( 'arrow', preset.id );

			expect( success ).toBe( true );
			expect( manager.getPreset( 'arrow', preset.id ) ).toBeNull();
		} );

		it( 'should not delete built-in presets', () => {
			const builtInId = PresetManager.BUILT_IN_PRESETS.arrow[ 0 ].id;

			const success = manager.deletePreset( 'arrow', builtInId );

			expect( success ).toBe( false );
			expect( manager.getPreset( 'arrow', builtInId ) ).not.toBeNull();
		} );

		it( 'should clear default if deleted preset was default', () => {
			const preset = manager.addPreset( 'arrow', 'Default', { stroke: '#000' }, {
				setAsDefault: true
			} );

			manager.deletePreset( 'arrow', preset.id );

			// Should fall back to first built-in
			const defaultPreset = manager.getDefaultPreset( 'arrow' );
			expect( defaultPreset.builtIn ).toBe( true );
		} );

		it( 'should notify listeners', () => {
			const listener = jest.fn();
			const preset = manager.addPreset( 'arrow', 'Test', { stroke: '#000' } );
			manager.subscribe( listener );

			manager.deletePreset( 'arrow', preset.id );

			expect( listener ).toHaveBeenCalledWith( 'preset-deleted', expect.any( Object ) );
		} );
	} );

	describe( 'getDefaultPreset', () => {
		it( 'should return user-set default', () => {
			const preset = manager.addPreset( 'arrow', 'My Default', { stroke: '#000' }, {
				setAsDefault: true
			} );

			const defaultPreset = manager.getDefaultPreset( 'arrow' );

			expect( defaultPreset.id ).toBe( preset.id );
		} );

		it( 'should return first built-in if no user default', () => {
			const defaultPreset = manager.getDefaultPreset( 'arrow' );

			expect( defaultPreset ).toBeDefined();
			expect( defaultPreset.builtIn ).toBe( true );
		} );

		it( 'should return null for unsupported tool', () => {
			const defaultPreset = manager.getDefaultPreset( 'unsupported' );

			expect( defaultPreset ).toBeNull();
		} );
	} );

	describe( 'setDefaultPreset', () => {
		it( 'should set preset as default', () => {
			const preset = manager.addPreset( 'arrow', 'Test', { stroke: '#000' } );

			const success = manager.setDefaultPreset( 'arrow', preset.id );

			expect( success ).toBe( true );
			expect( manager.cache.defaultPresets.arrow ).toBe( preset.id );
		} );

		it( 'should allow built-in preset as default', () => {
			const builtInId = PresetManager.BUILT_IN_PRESETS.arrow[ 0 ].id;

			const success = manager.setDefaultPreset( 'arrow', builtInId );

			expect( success ).toBe( true );
		} );

		it( 'should return false for non-existent preset', () => {
			const success = manager.setDefaultPreset( 'arrow', 'non-existent' );

			expect( success ).toBe( false );
		} );
	} );

	describe( 'createFromLayer', () => {
		it( 'should create preset from arrow layer', () => {
			const layer = {
				type: 'arrow',
				stroke: '#ff0000',
				strokeWidth: 3,
				arrowStyle: 'double'
			};

			const preset = manager.createFromLayer( layer, 'From Layer' );

			expect( preset ).toBeDefined();
			expect( preset.style.stroke ).toBe( '#ff0000' );
			expect( preset.style.strokeWidth ).toBe( 3 );
			expect( preset.style.arrowStyle ).toBe( 'double' );
		} );

		it( 'should create preset from text layer', () => {
			const layer = {
				type: 'text',
				color: '#0000ff',
				fontSize: 24,
				fontFamily: 'Georgia'
			};

			const preset = manager.createFromLayer( layer, 'Text Style' );

			expect( preset ).toBeDefined();
			expect( preset.style.color ).toBe( '#0000ff' );
			expect( preset.style.fontSize ).toBe( 24 );
		} );

		it( 'should return null for unsupported layer type', () => {
			const layer = { type: 'unknown' }; // unknown type not in supported tools

			const preset = manager.createFromLayer( layer, 'Test' );

			expect( preset ).toBeNull();
		} );

		it( 'should return null for invalid layer', () => {
			expect( manager.createFromLayer( null, 'Test' ) ).toBeNull();
			expect( manager.createFromLayer( {}, 'Test' ) ).toBeNull();
		} );
	} );

	describe( 'exportPresets', () => {
		it( 'should export user presets as JSON', () => {
			manager.addPreset( 'arrow', 'Export Test', { stroke: '#000' } );

			const exported = manager.exportPresets();
			const parsed = JSON.parse( exported );

			expect( parsed.version ).toBe( PresetManager.SCHEMA_VERSION );
			expect( parsed.toolPresets.arrow ).toHaveLength( 1 );
			expect( parsed.toolPresets.arrow[ 0 ].name ).toBe( 'Export Test' );
		} );

		it( 'should not export built-in presets', () => {
			const exported = manager.exportPresets();
			const parsed = JSON.parse( exported );

			// Only user presets are exported
			const arrowPresets = parsed.toolPresets.arrow || [];
			const builtIn = arrowPresets.filter( ( p ) => p.builtIn );

			expect( builtIn ).toHaveLength( 0 );
		} );

		it( 'should include default preferences', () => {
			const preset = manager.addPreset( 'arrow', 'Default', { stroke: '#000' }, {
				setAsDefault: true
			} );

			const exported = manager.exportPresets();
			const parsed = JSON.parse( exported );

			expect( parsed.defaultPresets.arrow ).toBe( preset.id );
		} );
	} );

	describe( 'importPresets', () => {
		it( 'should import presets from JSON', () => {
			const importData = JSON.stringify( {
				version: PresetManager.SCHEMA_VERSION,
				toolPresets: {
					arrow: [ {
						id: 'imported-1',
						name: 'Imported Arrow',
						style: { stroke: '#00ff00' }
					} ]
				},
				defaultPresets: {}
			} );

			const result = manager.importPresets( importData );

			expect( result.success ).toBe( true );
			expect( result.imported ).toBe( 1 );

			const preset = manager.getPreset( 'arrow', 'imported-1' );
			expect( preset ).toBeDefined();
			expect( preset.name ).toBe( 'Imported Arrow' );
		} );

		it( 'should merge with existing presets by default', () => {
			manager.addPreset( 'arrow', 'Existing', { stroke: '#000' } );

			const importData = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'new-1', name: 'New', style: {} } ]
				},
				defaultPresets: {}
			} );

			manager.importPresets( importData );

			const presets = manager.getPresetsForTool( 'arrow' );
			const userPresets = presets.filter( ( p ) => !p.builtIn );

			expect( userPresets.length ).toBeGreaterThanOrEqual( 2 );
		} );

		it( 'should replace existing when merge is false', () => {
			manager.addPreset( 'arrow', 'Existing', { stroke: '#000' } );

			const importData = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [ { id: 'new-1', name: 'New', style: {} } ]
				},
				defaultPresets: {}
			} );

			manager.importPresets( importData, { merge: false } );

			const presets = manager.getPresetsForTool( 'arrow' );
			const userPresets = presets.filter( ( p ) => !p.builtIn );

			expect( userPresets ).toHaveLength( 1 );
			expect( userPresets[ 0 ].name ).toBe( 'New' );
		} );

		it( 'should handle invalid JSON', () => {
			const result = manager.importPresets( 'not json' );

			expect( result.success ).toBe( false );
			expect( result.errors ).toContain( 'Invalid JSON format' );
		} );

		it( 'should handle invalid format', () => {
			const result = manager.importPresets( JSON.stringify( { foo: 'bar' } ) );

			expect( result.success ).toBe( false );
			expect( result.errors ).toContain( 'Invalid preset file format' );
		} );

		it( 'should skip presets with missing required fields', () => {
			const importData = JSON.stringify( {
				version: 1,
				toolPresets: {
					arrow: [
						{ id: 'valid', name: 'Valid', style: {} },
						{ name: 'No ID' }, // Missing id
						{ id: 'no-name' } // Missing name
					]
				},
				defaultPresets: {}
			} );

			const result = manager.importPresets( importData );

			expect( result.imported ).toBe( 1 );
			expect( result.skipped ).toBe( 2 );
		} );
	} );

	describe( 'getSupportedTools', () => {
		it( 'should return list of supported tools', () => {
			const tools = manager.getSupportedTools();

			expect( tools ).toContain( 'arrow' );
			expect( tools ).toContain( 'text' );
			expect( tools ).toContain( 'rectangle' );
		} );

		it( 'should return a copy of the list', () => {
			const tools1 = manager.getSupportedTools();
			const tools2 = manager.getSupportedTools();

			expect( tools1 ).not.toBe( tools2 );
			expect( tools1 ).toEqual( tools2 );
		} );
	} );

	describe( 'isToolSupported', () => {
		it( 'should return true for supported tools', () => {
			expect( manager.isToolSupported( 'arrow' ) ).toBe( true );
			expect( manager.isToolSupported( 'text' ) ).toBe( true );
		} );

		it( 'should return false for unsupported tools', () => {
			expect( manager.isToolSupported( 'unknown' ) ).toBe( false );
			expect( manager.isToolSupported( 'select' ) ).toBe( false );
		} );
	} );

	describe( 'subscribe', () => {
		it( 'should add listener and return unsubscribe function', () => {
			const listener = jest.fn();

			const unsubscribe = manager.subscribe( listener );
			manager.save();

			expect( listener ).toHaveBeenCalled();

			unsubscribe();
			listener.mockClear();
			manager.save();

			expect( listener ).not.toHaveBeenCalled();
		} );

		it( 'should handle listener errors gracefully', () => {
			const badListener = jest.fn( () => {
				throw new Error( 'Listener error' );
			} );
			const goodListener = jest.fn();

			manager.subscribe( badListener );
			manager.subscribe( goodListener );

			expect( () => manager.save() ).not.toThrow();
			expect( goodListener ).toHaveBeenCalled();
		} );
	} );

	describe( 'reset', () => {
		it( 'should clear all user presets', () => {
			manager.addPreset( 'arrow', 'Test 1', { stroke: '#000' } );
			manager.addPreset( 'text', 'Test 2', { color: '#000' } );

			manager.reset();

			const arrowPresets = manager.getPresetsForTool( 'arrow' );
			const userArrowPresets = arrowPresets.filter( ( p ) => !p.builtIn );

			expect( userArrowPresets ).toHaveLength( 0 );
		} );

		it( 'should keep built-in presets', () => {
			manager.reset();

			const presets = manager.getPresetsForTool( 'arrow' );
			const builtIn = presets.filter( ( p ) => p.builtIn );

			expect( builtIn.length ).toBeGreaterThan( 0 );
		} );

		it( 'should notify listeners', () => {
			const listener = jest.fn();
			manager.subscribe( listener );

			manager.reset();

			expect( listener ).toHaveBeenCalledWith( 'reset', undefined );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up resources', () => {
			const listener = jest.fn();
			manager.subscribe( listener );

			manager.destroy();

			expect( manager.listeners ).toEqual( [] );
			expect( manager.cache ).toBeNull();
		} );
	} );

	describe( 'static properties', () => {
		it( 'should expose STORAGE_KEY', () => {
			expect( PresetManager.STORAGE_KEY ).toBe( 'mw-layers-style-presets' );
		} );

		it( 'should expose SCHEMA_VERSION', () => {
			expect( PresetManager.SCHEMA_VERSION ).toBe( 1 );
		} );

		it( 'should expose SUPPORTED_TOOLS', () => {
			expect( PresetManager.SUPPORTED_TOOLS ).toContain( 'arrow' );
		} );

		it( 'should expose BUILT_IN_PRESETS', () => {
			expect( PresetManager.BUILT_IN_PRESETS.arrow ).toBeDefined();
			expect( PresetManager.BUILT_IN_PRESETS.arrow.length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'fallback behavior without storage', () => {
		it( 'should handle storage being null', () => {
			const mgr = new PresetManager();
			mgr.storage = null; // Simulate missing storage

			// createEmptyData fallback
			const emptyData = mgr.createEmptyData();
			expect( emptyData.version ).toBe( 1 );
			expect( emptyData.toolPresets ).toBeDefined();
			expect( emptyData.defaultPresets ).toBeDefined();

			mgr.destroy();
		} );

		it( 'should handle save when storage is null', () => {
			const mgr = new PresetManager();
			mgr.storage = null;

			const success = mgr.save();

			expect( success ).toBe( false );
			mgr.destroy();
		} );

		it( 'should use fallback generateId when storage is null', () => {
			const mgr = new PresetManager();
			mgr.storage = null;

			const id = mgr.generateId( 'arrow', 'Test Name' );

			expect( id ).toContain( 'arrow-test-name' );
			mgr.destroy();
		} );

		it( 'should use fallback sanitizeStyle when storage is null', () => {
			const mgr = new PresetManager();
			mgr.storage = null;

			const sanitized = mgr.sanitizeStyle( { stroke: '#ff0000', extra: 'value' } );

			expect( sanitized ).toEqual( { stroke: '#ff0000', extra: 'value' } );
			mgr.destroy();
		} );

		it( 'should handle importPresets when storage is null', () => {
			const mgr = new PresetManager();
			mgr.storage = null;

			const result = mgr.importPresets( '{}' );

			expect( result.success ).toBe( false );
			expect( result.errors ).toContain( 'Storage not available' );
			mgr.destroy();
		} );

		it( 'should handle exportPresets when storage is null', () => {
			const mgr = new PresetManager();
			mgr.storage = null;

			// Set up cache directly
			mgr.cache = {
				version: 1,
				toolPresets: { arrow: [] },
				defaultPresets: {}
			};

			const exported = mgr.exportPresets();
			const parsed = JSON.parse( exported );

			expect( parsed.version ).toBe( 1 );
			mgr.destroy();
		} );

		it( 'should use fallback extractStyleFromLayer when storage is null', () => {
			const mgr = new PresetManager();
			mgr.storage = null;

			const layer = { type: 'arrow', stroke: '#ff0000', x: 100 };
			const style = mgr.extractStyleFromLayer( layer );

			// Fallback just clones via sanitizeStyle
			expect( style.stroke ).toBe( '#ff0000' );
			mgr.destroy();
		} );
	} );

	describe( 'fallback behavior without builtInPresets', () => {
		it( 'should return empty array when builtInPresets is null in getPresetsForTool', () => {
			const mgr = new PresetManager();
			mgr.builtInPresets = null;

			const presets = mgr.getPresetsForTool( 'arrow' );

			// Should return only user presets (empty initially)
			expect( presets ).toEqual( [] );
			mgr.destroy();
		} );

		it( 'should return null default preset when builtInPresets is null', () => {
			const mgr = new PresetManager();
			mgr.builtInPresets = null;

			const defaultPreset = mgr.getDefaultPreset( 'arrow' );

			expect( defaultPreset ).toBeNull();
			mgr.destroy();
		} );

		it( 'should use fallback getSupportedTools when builtInPresets is null', () => {
			const mgr = new PresetManager();
			mgr.builtInPresets = null;

			const tools = mgr.getSupportedTools();

			expect( tools ).toContain( 'arrow' );
			expect( tools ).toContain( 'text' );
			expect( tools ).toContain( 'rectangle' );
			mgr.destroy();
		} );

		it( 'should use fallback isToolSupported when builtInPresets is null', () => {
			const mgr = new PresetManager();
			mgr.builtInPresets = null;

			expect( mgr.isToolSupported( 'arrow' ) ).toBe( true );
			expect( mgr.isToolSupported( 'unsupported' ) ).toBe( false );
			mgr.destroy();
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should handle null style in addPreset', () => {
			const preset = manager.addPreset( 'arrow', 'Test', null );

			expect( preset ).toBeNull();
		} );

		it( 'should handle non-object style in addPreset', () => {
			const preset = manager.addPreset( 'arrow', 'Test', 'invalid' );

			expect( preset ).toBeNull();
		} );

		it( 'should handle non-string name in addPreset', () => {
			const preset = manager.addPreset( 'arrow', 123, {} );

			expect( preset ).toBeNull();
		} );

		it( 'should handle null cache in getDefaultPreset', () => {
			manager.cache = null;

			const defaultPreset = manager.getDefaultPreset( 'arrow' );

			expect( defaultPreset ).toBeNull();
		} );

		it( 'should return false when setting default for unsupported tool', () => {
			const success = manager.setDefaultPreset( 'unsupported', 'some-id' );

			expect( success ).toBe( false );
		} );

		it( 'should handle deletePreset for non-existent tool', () => {
			const success = manager.deletePreset( 'notatool', 'some-id' );

			expect( success ).toBe( false );
		} );

		it( 'should handle updatePreset for non-existent tool', () => {
			const success = manager.updatePreset( 'notatool', 'some-id', { name: 'Test' } );

			expect( success ).toBe( false );
		} );

		it( 'should ignore non-function listeners in subscribe', () => {
			const unsubscribe = manager.subscribe( 'not a function' );

			expect( typeof unsubscribe ).toBe( 'function' );
			expect( () => unsubscribe() ).not.toThrow();
		} );

		it( 'should handle clearDefaultPreset when no default exists', () => {
			// Should not throw
			expect( () => manager.clearDefaultPreset( 'arrow' ) ).not.toThrow();
		} );

		it( 'should initialize toolPresets for tool if missing in addPreset', () => {
			// Clear tool presets
			manager.cache.toolPresets = {};

			const preset = manager.addPreset( 'arrow', 'Test', { stroke: '#000' } );

			expect( preset ).toBeDefined();
			expect( manager.cache.toolPresets.arrow ).toHaveLength( 1 );
		} );

		it( 'should return error for duplicate preset name', () => {
			// Add an initial preset
			manager.addPreset( 'arrow', 'My Preset', { stroke: '#000' } );

			// Try to add a duplicate (case insensitive)
			const result = manager.addPreset( 'arrow', 'my preset', { stroke: '#fff' } );

			expect( result ).toHaveProperty( 'error', 'duplicate' );
			expect( result ).toHaveProperty( 'existingName' );
		} );

		it( 'should prevent updating built-in preset in cache', () => {
			// Manually add a built-in preset to the cache (simulating loaded state)
			manager.cache.toolPresets.arrow = [
				{
					id: 'builtin-1',
					name: 'Built-in Arrow',
					builtIn: true,
					style: { stroke: '#000' }
				}
			];

			// Try to update the built-in preset
			const result = manager.updatePreset( 'arrow', 'builtin-1', { name: 'Hacked' } );

			expect( result ).toBe( false );
		} );

		it( 'should prevent deleting built-in preset in cache', () => {
			// Manually add a built-in preset to the cache
			manager.cache.toolPresets.arrow = [
				{
					id: 'builtin-1',
					name: 'Built-in Arrow',
					builtIn: true,
					style: { stroke: '#000' }
				}
			];

			// Try to delete the built-in preset
			const result = manager.deletePreset( 'arrow', 'builtin-1' );

			expect( result ).toBe( false );
			// Preset should still exist
			expect( manager.cache.toolPresets.arrow ).toHaveLength( 1 );
		} );

		it( 'should clear existing default preset', () => {
			// Directly set a default in the cache
			manager.cache.defaultPresets.arrow = 'test-preset-id';

			// Verify it's set
			expect( manager.cache.defaultPresets.arrow ).toBe( 'test-preset-id' );

			// Clear the default
			manager.clearDefaultPreset( 'arrow' );

			// Verify it's cleared
			expect( manager.cache.defaultPresets.arrow ).toBeUndefined();
		} );
	} );
} );
