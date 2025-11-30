/**
 * Advanced Module Registry for Layers Editor
 * Provides comprehensive dependency management and circular dependency resolution
 */
( function () {
	'use strict';

	class ModuleRegistry {
		constructor() {
			this.modules = new Map();
			this.factories = new Map();
			this.resolutionStack = new Set();
			this.config = new Map();
			this.eventCallbacks = new Map();
			this.initialized = false;
		}

		/**
		 * Register a module factory function
		 * @param {string} name Module name
		 * @param {Function} factory Factory function that creates the module
		 * @param {Array} dependencies Array of dependency names
		 */
		register( name, factory, dependencies = [] ) {
			if ( typeof factory !== 'function' ) {
				throw new Error( `Module factory for ${name} must be a function` );
			}

			this.factories.set( name, {
				factory: factory,
				dependencies: dependencies,
				created: false,
				singleton: true
			} );

			this.emit( 'factoryRegistered', { name, dependencies } );
			
			// Try to auto-resolve if all dependencies are available
			this.tryAutoResolve( name );
		}

		/**
		 * Register a pre-created module instance
		 * @param {string} name Module name
		 * @param {*} instance Module instance
		 */
		registerInstance( name, instance ) {
			this.modules.set( name, instance );
			this.emit( 'instanceRegistered', { name, instance } );
		}

		/**
		 * Get a module instance, creating it if necessary
		 * @param {string} name Module name
		 * @return {*} Module instance
		 */
		get( name ) {
			// Check if already instantiated
			if ( this.modules.has( name ) ) {
				return this.modules.get( name );
			}

			// Check for circular dependency
			if ( this.resolutionStack.has( name ) ) {
				const stackArray = Array.from( this.resolutionStack );
				throw new Error( `Circular dependency detected: ${stackArray.join( ' -> ' )} -> ${name}` );
			}

			return this.createModule( name );
		}

		/**
		 * Create a module instance safely
		 * @param {string} name Module name
		 * @return {*} Module instance
		 */
		createModule( name ) {
			// Check if factory exists
			if ( !this.factories.has( name ) ) {
				// Try to find the module in legacy global namespaces
				const instance = this.findLegacyModule( name );
				if ( instance ) {
					this.modules.set( name, instance );
					return instance;
				}
				throw new Error( `Module ${name} not found in registry` );
			}

			// Mark as being resolved
			this.resolutionStack.add( name );

			try {
				const moduleInfo = this.factories.get( name );
				
				// Resolve dependencies first
				const dependencies = this.resolveDependencies( moduleInfo.dependencies );
				
				// Create the module instance
				const instance = moduleInfo.factory( dependencies, this );
				
				// Cache the instance if it's a singleton
				if ( moduleInfo.singleton ) {
					this.modules.set( name, instance );
				}
				
				moduleInfo.created = true;
				this.emit( 'moduleCreated', { name, instance, dependencies } );
				
				return instance;
			} finally {
				// Always clean up resolution stack
				this.resolutionStack.delete( name );
			}
		}

		/**
		 * Try to find module in legacy global namespaces
		 * @param {string} name Module name
		 * @return {*} Module instance or null
		 */
		findLegacyModule( name ) {
			// Try window namespace
			if ( typeof window !== 'undefined' && window[ name ] ) {
				return window[ name ];
			}

			// Try mw namespace
			if ( typeof mw !== 'undefined' && mw[ name ] ) {
				return mw[ name ];
			}

			// Try specialized patterns
			const patterns = [
				`Layers${name}`,
				`layers${name}`,
				name.charAt( 0 ).toUpperCase() + name.slice( 1 ),
				name.toLowerCase()
			];

			for ( const pattern of patterns ) {
				if ( typeof window !== 'undefined' && window[ pattern ] ) {
					return window[ pattern ];
				}
				if ( typeof mw !== 'undefined' && mw[ pattern ] ) {
					return mw[ pattern ];
				}
			}

			return null;
		}

		/**
		 * Resolve an array of dependencies
		 * @param {Array} dependencyNames Array of dependency names
		 * @return {Object} Object with dependency instances
		 */
		resolveDependencies( dependencyNames ) {
			const resolved = {};
			
			for ( const depName of dependencyNames ) {
				try {
					resolved[ depName ] = this.get( depName );
				} catch ( error ) {
					// Allow optional dependencies to fail
					if ( depName.startsWith( '?' ) ) {
						const optionalName = depName.slice( 1 );
						resolved[ optionalName ] = null;
					} else {
						throw error;
					}
				}
			}
			
			return resolved;
		}

		/**
		 * Try to auto-resolve a module if all dependencies are available
		 * @param {string} name Module name
		 */
		tryAutoResolve( name ) {
			if ( this.modules.has( name ) || !this.factories.has( name ) ) {
				return;
			}

			const moduleInfo = this.factories.get( name );
			
			// Check if all dependencies are available
			for ( const depName of moduleInfo.dependencies ) {
				const cleanDepName = depName.startsWith( '?' ) ? depName.slice( 1 ) : depName;
				if ( !this.has( cleanDepName ) && !this.findLegacyModule( cleanDepName ) ) {
					return; // Not ready yet
				}
			}

			// Try to create the module
			try {
				this.get( name );
			} catch ( error ) {
				// Auto-resolution failed, will try again later
			}
		}

		/**
		 * Check if a module exists (factory or instance)
		 * @param {string} name Module name
		 * @return {boolean} True if module exists
		 */
		has( name ) {
			return this.modules.has( name ) || this.factories.has( name );
		}

		/**
		 * Validate dependency tree for circular dependencies
		 * @return {Array} Array of issues found
		 */
		validateDependencyTree() {
			const issues = [];
			
			for ( const [ name ] of this.factories ) {
				try {
					this.checkCircularDependencies( name, [], new Set() );
				} catch ( error ) {
					issues.push( {
						module: name,
						error: error.message
					} );
				}
			}
			
			return issues;
		}

		/**
		 * Recursively check for circular dependencies
		 * @param {string} name Module name
		 * @param {Array} path Current dependency path
		 * @param {Set} visited Set of visited modules
		 */
		checkCircularDependencies( name, path, visited ) {
			if ( visited.has( name ) ) {
				const cycleStart = path.indexOf( name );
				const cycle = path.slice( cycleStart ).concat( [ name ] );
				throw new Error( `Circular dependency: ${cycle.join( ' -> ' )}` );
			}

			if ( !this.factories.has( name ) ) {
				return; // External dependency or missing module
			}

			visited.add( name );
			const newPath = path.concat( [ name ] );
			
			const moduleInfo = this.factories.get( name );
			for ( const dep of moduleInfo.dependencies ) {
				const cleanDep = dep.startsWith( '?' ) ? dep.slice( 1 ) : dep;
				this.checkCircularDependencies( cleanDep, newPath, new Set( visited ) );
			}
		}

		/**
		 * Add event listener
		 * @param {string} event Event name
		 * @param {Function} callback Callback function
		 */
		on( event, callback ) {
			if ( !this.eventCallbacks.has( event ) ) {
				this.eventCallbacks.set( event, [] );
			}
			this.eventCallbacks.get( event ).push( callback );
		}

		/**
		 * Emit event
		 * @param {string} event Event name
		 * @param {*} data Event data
		 */
		emit( event, data ) {
			if ( this.eventCallbacks.has( event ) ) {
				for ( const callback of this.eventCallbacks.get( event ) ) {
					try {
						callback( data );
					} catch ( error ) {
						// Don't let event errors break the registry
					}
				}
			}
		}

		/**
		 * Get registry statistics
		 * @return {Object} Statistics
		 */
		getStats() {
			return {
				totalModules: this.modules.size + this.factories.size,
				instantiatedModules: this.modules.size,
				registeredFactories: this.factories.size,
				circularDependencyIssues: this.validateDependencyTree().length
			};
		}
	}

	// Create global registry instance
	const registry = new ModuleRegistry();

	// Legacy compatibility - keep the old simple interface
	const legacyRegistry = {
		register: ( name, factory, dependencies ) => registry.register( name, factory, dependencies ),
		get: ( name ) => registry.get( name ),
		has: ( name ) => registry.has( name ),
		tryResolveAll: () => {
			// Try to resolve all pending modules
			const moduleNames = Array.from( registry.factories.keys() );
			for ( const name of moduleNames ) {
				registry.tryAutoResolve( name );
			}
		},
		getRegistry: () => registry
	};

	// Export the registry - ALWAYS set on window first for cross-file dependencies
	if ( typeof window !== 'undefined' ) {
		window.LayersModuleRegistry = ModuleRegistry;
		window.layersRegistry = registry;
		window.layersModuleRegistry = legacyRegistry; // Legacy compatibility
	}

	// Also export via CommonJS if available (for Node.js/Jest testing)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { ModuleRegistry, registry, legacyRegistry };
	}

	if ( typeof mw !== 'undefined' ) {
		mw.LayersModuleRegistry = ModuleRegistry;
		mw.layersRegistry = registry;
		mw.layersModuleRegistry = legacyRegistry; // Legacy compatibility
	}

	// Initialize core dependencies
	if ( typeof window !== 'undefined' ) {
		registry.registerInstance( 'window', window );
	}
	if ( typeof document !== 'undefined' ) {
		registry.registerInstance( 'document', document );
	}
	if ( typeof mw !== 'undefined' ) {
		registry.registerInstance( 'mw', mw );
	}

	// Return the legacy interface for immediate use
	return legacyRegistry;

} )();
