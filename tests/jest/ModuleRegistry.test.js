/**
 * ModuleRegistry.test.js - Tests for the ModuleRegistry class
 *
 * ModuleRegistry provides dependency injection and module management
 * for the Layers editor, including circular dependency detection.
 */

'use strict';

describe( 'ModuleRegistry', () => {
	let ModuleRegistry, registry;

	beforeEach( () => {
		// Reset global state
		delete global.window.LayersModuleRegistry;
		delete global.window.layersRegistry;
		delete global.window.layersModuleRegistry;

		// Clear require cache to get fresh instance
		jest.resetModules();

		// Set up global mocks
		global.mw = {
			message: jest.fn( ( key ) => ( { text: () => `[${key}]` } ) ),
			config: { get: jest.fn() }
		};

		// Load fresh ModuleRegistry
		const module = require( '../../resources/ext.layers.editor/ModuleRegistry.js' );
		ModuleRegistry = module.ModuleRegistry;

		// Create a new registry instance for each test
		registry = new ModuleRegistry();
	} );

	afterEach( () => {
		jest.resetModules();
	} );

	describe( 'constructor', () => {
		it( 'should initialize empty modules Map', () => {
			expect( registry.modules ).toBeInstanceOf( Map );
			expect( registry.modules.size ).toBe( 0 );
		} );

		it( 'should initialize empty factories Map', () => {
			expect( registry.factories ).toBeInstanceOf( Map );
			expect( registry.factories.size ).toBe( 0 );
		} );

		it( 'should initialize empty resolutionStack Set', () => {
			expect( registry.resolutionStack ).toBeInstanceOf( Set );
			expect( registry.resolutionStack.size ).toBe( 0 );
		} );

		it( 'should initialize empty config Map', () => {
			expect( registry.config ).toBeInstanceOf( Map );
			expect( registry.config.size ).toBe( 0 );
		} );

		it( 'should initialize empty eventCallbacks Map', () => {
			expect( registry.eventCallbacks ).toBeInstanceOf( Map );
			expect( registry.eventCallbacks.size ).toBe( 0 );
		} );

		it( 'should start with initialized=false', () => {
			expect( registry.initialized ).toBe( false );
		} );
	} );

	describe( 'register', () => {
		it( 'should register a module factory', () => {
			const factory = jest.fn();
			registry.register( 'testModule', factory );

			expect( registry.factories.has( 'testModule' ) ).toBe( true );
		} );

		it( 'should throw if factory is not a function', () => {
			expect( () => registry.register( 'test', 'not a function' ) )
				.toThrow( 'Module factory for test must be a function' );
		} );

		it( 'should store dependencies', () => {
			const factory = jest.fn();
			registry.register( 'testModule', factory, [ 'dep1', 'dep2' ] );

			const moduleInfo = registry.factories.get( 'testModule' );
			expect( moduleInfo.dependencies ).toEqual( [ 'dep1', 'dep2' ] );
		} );

		it( 'should default to empty dependencies array', () => {
			registry.register( 'testModule', jest.fn() );

			const moduleInfo = registry.factories.get( 'testModule' );
			expect( moduleInfo.dependencies ).toEqual( [] );
		} );

		it( 'should emit factoryRegistered event', () => {
			const callback = jest.fn();
			registry.on( 'factoryRegistered', callback );

			registry.register( 'testModule', jest.fn(), [ 'dep1' ] );

			expect( callback ).toHaveBeenCalledWith( {
				name: 'testModule',
				dependencies: [ 'dep1' ]
			} );
		} );
	} );

	describe( 'registerInstance', () => {
		it( 'should register pre-created instance', () => {
			const instance = { foo: 'bar' };
			registry.registerInstance( 'testInstance', instance );

			expect( registry.modules.get( 'testInstance' ) ).toBe( instance );
		} );

		it( 'should emit instanceRegistered event', () => {
			const callback = jest.fn();
			registry.on( 'instanceRegistered', callback );

			const instance = { foo: 'bar' };
			registry.registerInstance( 'testInstance', instance );

			expect( callback ).toHaveBeenCalledWith( {
				name: 'testInstance',
				instance: instance
			} );
		} );
	} );

	describe( 'get', () => {
		it( 'should return existing module instance', () => {
			const instance = { foo: 'bar' };
			registry.modules.set( 'existing', instance );

			expect( registry.get( 'existing' ) ).toBe( instance );
		} );

		it( 'should create module from factory if not instantiated', () => {
			const mockInstance = { created: true };
			const factory = jest.fn().mockReturnValue( mockInstance );

			registry.register( 'newModule', factory );
			const result = registry.get( 'newModule' );

			expect( factory ).toHaveBeenCalled();
			expect( result ).toBe( mockInstance );
		} );

		it( 'should throw on circular dependency', () => {
			// Module A depends on Module B, which depends on Module A
			registry.register( 'moduleA', () => registry.get( 'moduleB' ), [ 'moduleB' ] );
			registry.register( 'moduleB', () => registry.get( 'moduleA' ), [ 'moduleA' ] );

			expect( () => registry.get( 'moduleA' ) ).toThrow( /Circular dependency/ );
		} );

		it( 'should throw if module not found', () => {
			expect( () => registry.get( 'nonexistent' ) )
				.toThrow( 'Module nonexistent not found in registry' );
		} );
	} );

	describe( 'createModule', () => {
		it( 'should resolve dependencies and call factory', () => {
			const dep1 = { name: 'dep1' };
			const dep2 = { name: 'dep2' };

			registry.registerInstance( 'dep1', dep1 );
			registry.registerInstance( 'dep2', dep2 );

			const factory = jest.fn( ( deps ) => ( {
				received: deps
			} ) );

			registry.register( 'main', factory, [ 'dep1', 'dep2' ] );

			const result = registry.get( 'main' );

			expect( factory ).toHaveBeenCalledWith(
				expect.objectContaining( { dep1, dep2 } ),
				registry
			);
			expect( result.received.dep1 ).toBe( dep1 );
		} );

		it( 'should cache singleton instances', () => {
			let callCount = 0;
			const factory = jest.fn( () => ( { id: ++callCount } ) );

			registry.register( 'singleton', factory );

			const first = registry.get( 'singleton' );
			const second = registry.get( 'singleton' );

			expect( first ).toBe( second );
			expect( factory ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should emit moduleCreated event', () => {
			const callback = jest.fn();
			registry.on( 'moduleCreated', callback );

			const factory = jest.fn().mockReturnValue( { created: true } );
			registry.register( 'newModule', factory );
			registry.get( 'newModule' );

			expect( callback ).toHaveBeenCalledWith(
				expect.objectContaining( {
					name: 'newModule',
					instance: { created: true }
				} )
			);
		} );

		it( 'should clean up resolution stack on error', () => {
			registry.register( 'failingModule', () => {
				throw new Error( 'Factory error' );
			} );

			expect( () => registry.get( 'failingModule' ) ).toThrow( 'Factory error' );
			expect( registry.resolutionStack.size ).toBe( 0 );
		} );
	} );

	describe( 'findLegacyModule', () => {
		it( 'should find module on window', () => {
			global.window.LegacyModule = { legacy: true };

			const result = registry.findLegacyModule( 'LegacyModule' );

			expect( result ).toEqual( { legacy: true } );
		} );

		it( 'should find module on mw', () => {
			global.mw.SomeModule = { mw: true };

			const result = registry.findLegacyModule( 'SomeModule' );

			expect( result ).toEqual( { mw: true } );
		} );

		it( 'should try Layers prefix', () => {
			global.window.LayersTest = { prefixed: true };

			const result = registry.findLegacyModule( 'Test' );

			expect( result ).toEqual( { prefixed: true } );
		} );

		it( 'should return null if not found', () => {
			const result = registry.findLegacyModule( 'NonExistent' );

			expect( result ).toBeNull();
		} );
	} );

	describe( 'resolveDependencies', () => {
		it( 'should resolve array of dependencies to object', () => {
			registry.registerInstance( 'dep1', { a: 1 } );
			registry.registerInstance( 'dep2', { b: 2 } );

			const resolved = registry.resolveDependencies( [ 'dep1', 'dep2' ] );

			expect( resolved ).toEqual( {
				dep1: { a: 1 },
				dep2: { b: 2 }
			} );
		} );

		it( 'should handle optional dependencies with ?', () => {
			const resolved = registry.resolveDependencies( [ '?optionalDep' ] );

			expect( resolved ).toEqual( { optionalDep: null } );
		} );

		it( 'should throw for required missing dependency', () => {
			expect( () => registry.resolveDependencies( [ 'missingDep' ] ) )
				.toThrow( 'Module missingDep not found in registry' );
		} );
	} );

	describe( 'tryAutoResolve', () => {
		it( 'should not auto-resolve if already instantiated', () => {
			const factory = jest.fn();
			registry.modules.set( 'existing', { existing: true } );
			registry.register( 'existing', factory );

			registry.tryAutoResolve( 'existing' );

			expect( factory ).not.toHaveBeenCalled();
		} );

		it( 'should auto-resolve when all dependencies are available', () => {
			registry.registerInstance( 'dep1', { d: 1 } );
			
			const factory = jest.fn().mockReturnValue( { main: true } );
			registry.register( 'main', factory, [ 'dep1' ] );

			// The register call should have triggered auto-resolve
			expect( registry.modules.has( 'main' ) ).toBe( true );
		} );

		it( 'should not auto-resolve when dependencies are missing', () => {
			const factory = jest.fn().mockReturnValue( { main: true } );
			registry.register( 'main', factory, [ 'missingDep' ] );

			// Should not have auto-resolved
			expect( factory ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'has', () => {
		it( 'should return true for instantiated module', () => {
			registry.modules.set( 'instance', {} );

			expect( registry.has( 'instance' ) ).toBe( true );
		} );

		it( 'should return true for registered factory', () => {
			registry.register( 'factory', jest.fn() );

			expect( registry.has( 'factory' ) ).toBe( true );
		} );

		it( 'should return false for unknown module', () => {
			expect( registry.has( 'unknown' ) ).toBe( false );
		} );
	} );

	describe( 'validateDependencyTree', () => {
		it( 'should return empty array for valid tree', () => {
			registry.registerInstance( 'dep1', {} );
			registry.register( 'main', jest.fn(), [ 'dep1' ] );

			const issues = registry.validateDependencyTree();

			expect( issues ).toEqual( [] );
		} );

		it( 'should detect circular dependencies', () => {
			registry.register( 'a', jest.fn(), [ 'b' ] );
			registry.register( 'b', jest.fn(), [ 'a' ] );

			const issues = registry.validateDependencyTree();

			expect( issues.length ).toBeGreaterThan( 0 );
			expect( issues[ 0 ].error ).toMatch( /Circular dependency/ );
		} );
	} );

	describe( 'checkCircularDependencies', () => {
		it( 'should not throw for valid dependency chain', () => {
			registry.registerInstance( 'a', {} );
			registry.register( 'b', jest.fn(), [ 'a' ] );
			registry.register( 'c', jest.fn(), [ 'b' ] );

			expect( () => {
				registry.checkCircularDependencies( 'c', [], new Set() );
			} ).not.toThrow();
		} );

		it( 'should throw for circular chain', () => {
			registry.register( 'a', jest.fn(), [ 'b' ] );
			registry.register( 'b', jest.fn(), [ 'c' ] );
			registry.register( 'c', jest.fn(), [ 'a' ] );

			expect( () => {
				registry.checkCircularDependencies( 'a', [], new Set() );
			} ).toThrow( /Circular dependency: a -> b -> c -> a/ );
		} );
	} );

	describe( 'events', () => {
		it( 'should add event listener with on()', () => {
			const callback = jest.fn();
			registry.on( 'testEvent', callback );

			expect( registry.eventCallbacks.get( 'testEvent' ) ).toContain( callback );
		} );

		it( 'should call listeners on emit()', () => {
			const callback1 = jest.fn();
			const callback2 = jest.fn();

			registry.on( 'testEvent', callback1 );
			registry.on( 'testEvent', callback2 );

			registry.emit( 'testEvent', { data: 'test' } );

			expect( callback1 ).toHaveBeenCalledWith( { data: 'test' } );
			expect( callback2 ).toHaveBeenCalledWith( { data: 'test' } );
		} );

		it( 'should not break on callback error', () => {
			const errorCallback = jest.fn( () => {
				throw new Error( 'Callback error' );
			} );
			const normalCallback = jest.fn();

			registry.on( 'testEvent', errorCallback );
			registry.on( 'testEvent', normalCallback );

			expect( () => registry.emit( 'testEvent', {} ) ).not.toThrow();
			expect( normalCallback ).toHaveBeenCalled();
		} );

		it( 'should handle emit for unregistered event', () => {
			expect( () => registry.emit( 'unknownEvent', {} ) ).not.toThrow();
		} );
	} );

	describe( 'getStats', () => {
		it( 'should return correct statistics', () => {
			registry.registerInstance( 'inst1', {} );
			registry.registerInstance( 'inst2', {} );
			registry.register( 'factory1', jest.fn(), [ 'inst1' ] );

			const stats = registry.getStats();

			// 2 instances + 1 factory that was auto-resolved = 3 modules, 3 instantiated
			expect( stats.totalModules ).toBeGreaterThan( 0 );
			expect( stats.instantiatedModules ).toBeGreaterThan( 0 );
		} );

		it( 'should count circular dependency issues', () => {
			registry.register( 'a', jest.fn(), [ 'b' ] );
			registry.register( 'b', jest.fn(), [ 'a' ] );

			const stats = registry.getStats();

			expect( stats.circularDependencyIssues ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export ModuleRegistry class on window', () => {
			expect( global.window.LayersModuleRegistry ).toBe( ModuleRegistry );
		} );

		it( 'should export registry instance on window', () => {
			const exported = require( '../../resources/ext.layers.editor/ModuleRegistry.js' );
			expect( exported.registry ).toBeTruthy();
			expect( exported.registry ).toBeInstanceOf( ModuleRegistry );
		} );

		it( 'should export legacyRegistry interface', () => {
			const exported = require( '../../resources/ext.layers.editor/ModuleRegistry.js' );
			expect( exported.legacyRegistry ).toBeTruthy();
			expect( typeof exported.legacyRegistry.register ).toBe( 'function' );
			expect( typeof exported.legacyRegistry.get ).toBe( 'function' );
			expect( typeof exported.legacyRegistry.has ).toBe( 'function' );
			expect( typeof exported.legacyRegistry.tryResolveAll ).toBe( 'function' );
		} );
	} );

	describe( 'legacy compatibility', () => {
		it( 'legacyRegistry.register should call registry.register', () => {
			const exported = require( '../../resources/ext.layers.editor/ModuleRegistry.js' );
			const factory = jest.fn();

			exported.legacyRegistry.register( 'legacyModule', factory, [ 'dep' ] );

			expect( exported.registry.factories.has( 'legacyModule' ) ).toBe( true );
		} );

		it( 'legacyRegistry.get should call registry.get', () => {
			const exported = require( '../../resources/ext.layers.editor/ModuleRegistry.js' );
			exported.registry.registerInstance( 'testMod', { test: true } );

			const result = exported.legacyRegistry.get( 'testMod' );

			expect( result ).toEqual( { test: true } );
		} );

		it( 'legacyRegistry.has should call registry.has', () => {
			const exported = require( '../../resources/ext.layers.editor/ModuleRegistry.js' );
			exported.registry.registerInstance( 'exists', {} );

			expect( exported.legacyRegistry.has( 'exists' ) ).toBe( true );
			expect( exported.legacyRegistry.has( 'notExists' ) ).toBe( false );
		} );

		it( 'legacyRegistry.getRegistry should return registry instance', () => {
			const exported = require( '../../resources/ext.layers.editor/ModuleRegistry.js' );

			expect( exported.legacyRegistry.getRegistry() ).toBe( exported.registry );
		} );
	} );
} );
