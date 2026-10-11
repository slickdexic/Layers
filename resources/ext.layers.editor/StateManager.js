/**
 * State Manager for Layers Editor
 * Centralized state management with race condition prevention
 */

// Configuration constants
const MAX_PENDING_OPERATIONS = 100;
const LOCK_DETECTION_TIMEOUT_MS = 5000;
const LOCK_AUTO_RECOVERY_TIMEOUT_MS = 30000;

// Default values fallback (for test environments where mw.ext may not be fully mocked)
const DEFAULT_VALUES = {
	MAX_HISTORY_SIZE: 50
};

// Import defaults from centralized constants (lazy-loaded, with fallback for tests)
const getDefaults = () => {
	if ( typeof mw !== 'undefined' && mw.ext && mw.ext.layers && mw.ext.layers.LayerDefaults ) {
		return mw.ext.layers.LayerDefaults;
	}
	return DEFAULT_VALUES;
};

const workingCopyPatches = new WeakMap();
const workingCopyDestroyedStores = new WeakSet();
const workingCopyPatchCommits = new WeakSet();

function workingCopyPatchError() {
	const error = new Error( 'Working-copy state unavailable' );
	error.code = 'layers-working-copy-state-unavailable';
	return error;
}

function workingCopyFinite( value, ancestors = new Set() ) {
	if ( value === null || typeof value === 'boolean' || typeof value === 'string' ||
		( typeof value === 'number' && Number.isFinite( value ) ) ) {
		return value;
	}
	if ( !value || typeof value !== 'object' || ancestors.has( value ) ) {
		throw workingCopyPatchError();
	}
	const array = Array.isArray( value ), prototype = Object.getPrototypeOf( value ), keys = Reflect.ownKeys( value );
	if ( ( array ? prototype !== Array.prototype : ![ Object.prototype, null ].includes( prototype ) ) || keys.some( key => typeof key !== 'string' ) ||
		( array && ( keys.length !== value.length + 1 || keys.some( key => key !== 'length' &&
			( !/^(0|[1-9][0-9]*)$/.test( key ) || Number( key ) >= value.length ) ) ) ) ) {
		throw workingCopyPatchError();
	}
	const result = array ? [] : Object.create( prototype );
	ancestors.add( value );
	try {
		for ( const key of keys.filter( name => !array || name !== 'length' ) ) {
			const descriptor = Object.getOwnPropertyDescriptor( value, key );
			if ( !Object.hasOwn( descriptor, 'value' ) || !descriptor.enumerable ) {
				throw workingCopyPatchError();
			}
			Object.defineProperty( result, key, { value: workingCopyFinite( descriptor.value, ancestors ), enumerable: true, writable: true, configurable: true } );
		}
	} finally {
		ancestors.delete( value );
	}
	return result;
}

function workingCopyObserve( object, deep = true, ancestors = new Set() ) {
	if ( !object || typeof object !== 'object' || ancestors.has( object ) ) {
		throw workingCopyPatchError();
	}
	const observation = { object, prototype: Object.getPrototypeOf( object ), extensible: Object.isExtensible( object ),
		descriptors: Object.getOwnPropertyDescriptors( object ), children: [] };
	ancestors.add( object );
	try {
		if ( deep ) {
			for ( const key of Reflect.ownKeys( observation.descriptors ) ) {
				const descriptor = observation.descriptors[ key ];
				if ( !Object.hasOwn( descriptor, 'value' ) ) {
					throw workingCopyPatchError();
				}
				const value = descriptor.value;
				if ( value && typeof value === 'object' ) {
					observation.children.push( workingCopyObserve( value, true, ancestors ) );
				}
			}
		}
	} finally {
		ancestors.delete( object );
	}
	return observation;
}

function workingCopyCheck( observation ) {
	const { object, descriptors } = observation, current = Object.getOwnPropertyDescriptors( object );
	if ( Object.getPrototypeOf( object ) !== observation.prototype || Object.isExtensible( object ) !== observation.extensible ||
		Reflect.ownKeys( current ).length !== Reflect.ownKeys( descriptors ).length ) {
		throw workingCopyPatchError();
	}
	for ( const key of Reflect.ownKeys( descriptors ) ) {
		const expected = descriptors[ key ], actual = current[ key ];
		if ( !actual || Reflect.ownKeys( expected ).some( field => !Object.is( actual[ field ], expected[ field ] ) ) ) {
			throw workingCopyPatchError();
		}
	}
	observation.children.forEach( workingCopyCheck );
}

function workingCopyMethod( object, key ) {
	let owner = object;
	while ( owner ) {
		const descriptor = Object.getOwnPropertyDescriptor( owner, key );
		if ( descriptor ) {
			if ( !Object.hasOwn( descriptor, 'value' ) || typeof descriptor.value !== 'function' ) {
				throw workingCopyPatchError();
			}
			return { object, owner, key, descriptor, method: descriptor.value };
		}
		owner = Object.getPrototypeOf( owner );
	}
	throw workingCopyPatchError();
}

function workingCopyMethodsCheck( methods ) {
	for ( const method of methods ) {
		const current = workingCopyMethod( method.object, method.key );
		if ( current.owner !== method.owner || Reflect.ownKeys( method.descriptor ).some( key => !Object.is( current.descriptor[ key ], method.descriptor[ key ] ) ) ) {
			throw workingCopyPatchError();
		}
	}
}

function workingCopyPatchRecord( store, handle, committed = false ) {
	const record = workingCopyPatches.get( handle );
	if ( !record || record.store !== store || record.committed !== committed ) {
		throw workingCopyPatchError();
	}
	if ( !committed ) {
		if ( workingCopyDestroyedStores.has( store ) ) {
			throw workingCopyPatchError();
		}
		workingCopyCheck( record.owner );
		workingCopyCheck( record.state );
		workingCopyCheck( record.pending );
		workingCopyCheck( record.queue );
		workingCopyMethodsCheck( record.methods );
	}
	return record;
}

class StateManager {
		static isWorkingCopyPatchCommit( value ) {
			return workingCopyPatchCommits.has( value );
		}

		prepareWorkingCopyPatchCommit( handle ) {
			const record = workingCopyPatchRecord( this, handle );
			const store = this, version = this._layersVersion + ( record.changes.some( change => change.key === 'layers' ) ? 1 : 0 );
			const assignments = record.changes.map( change => ( { key: change.key, descriptor: { value: change.value,
				...( Object.hasOwn( store.state, change.key ) ? {} : { enumerable: true, configurable: true, writable: true } ) } } ) );
			const commit = Object.freeze( {
				preflight: () => { workingCopyPatchRecord( store, handle ); },
				commit: () => {
					workingCopyPatchRecord( store, handle );
					for ( const assignment of assignments ) { Object.defineProperty( record.state.object, assignment.key, assignment.descriptor ); }
					store._layersVersion = version;
					record.committed = true;
				}
			} );
			workingCopyPatchCommits.add( commit );
			return commit;
		}

	isWorkingCopyAlive() {
		return !workingCopyDestroyedStores.has( this );
	}

	static copyWorkingCopyValue( value ) {
		return workingCopyFinite( value );
	}

	static observeWorkingCopyObject( value, deep = true ) {
		return workingCopyObserve( value, deep );
	}

	static checkWorkingCopyObservation( observation ) {
		workingCopyCheck( observation );
	}

	static captureWorkingCopyMethod( object, key ) {
		return workingCopyMethod( object, key );
	}

	static checkWorkingCopyMethods( methods ) {
		workingCopyMethodsCheck( methods );
	}

	prepareWorkingCopyPatch( patch ) {
		try {
			const owner = workingCopyObserve( this, false ), state = workingCopyObserve( this.state );
			if ( workingCopyDestroyedStores.has( this ) || this.isLocked || this._isProcessingPending || this.pendingOperations.length || this.lockingQueue.length ||
				this.lockTimeout !== null || this.lockAutoRecoveryTimeout !== null || !Object.hasOwn( this.state, 'layers' ) ) {
				throw workingCopyPatchError();
			}
			const copied = workingCopyFinite( patch ), allowed = [ 'layers', 'selectedLayerIds', 'isDirty', 'isSlide', 'baseWidth', 'baseHeight',
				'slideCanvasWidth', 'slideCanvasHeight', 'slideBackgroundColor', 'backgroundVisible', 'backgroundOpacity' ];
			if ( !copied || Array.isArray( copied ) || Object.keys( copied ).length !== 2 || !copied.values || Array.isArray( copied.values ) ||
				!Object.hasOwn( copied, 'clear' ) || !Object.hasOwn( copied, 'values' ) || !Array.isArray( copied.clear ) || new Set( copied.clear ).size !== copied.clear.length ) {
				throw workingCopyPatchError();
			}
			const keys = [ ...Object.keys( copied.values ), ...copied.clear ];
			if ( keys.some( key => !allowed.includes( key ) ) || copied.clear.some( key => Object.hasOwn( copied.values, key ) ) ) {
				throw workingCopyPatchError();
			}
			for ( const [ key, value ] of Object.entries( copied.values ) ) {
				if ( ( key === 'layers' && !Array.isArray( value ) ) ||
					( key === 'selectedLayerIds' && ( !Array.isArray( value ) || value.some( id => typeof id !== 'string' ) || new Set( value ).size !== value.length ) ) ||
					( [ 'isDirty', 'isSlide', 'backgroundVisible' ].includes( key ) && typeof value !== 'boolean' ) ||
					( [ 'baseWidth', 'baseHeight', 'slideCanvasWidth', 'slideCanvasHeight' ].includes( key ) && ( typeof value !== 'number' || value < 0 ) ) ||
					( key === 'backgroundOpacity' && ( typeof value !== 'number' || value < 0 || value > 1 ) ) ||
					( key === 'slideBackgroundColor' && typeof value !== 'string' ) ) {
					throw workingCopyPatchError();
				}
			}
			const changes = keys.map( key => {
				const descriptor = Object.getOwnPropertyDescriptor( this.state, key );
				if ( descriptor ? !Object.hasOwn( descriptor, 'value' ) || !descriptor.writable : !Object.isExtensible( this.state ) ) {
					throw workingCopyPatchError();
				}
				if ( !descriptor && key in this.state ) {
					throw workingCopyPatchError();
				}
				return { key, oldValue: descriptor && descriptor.value, value: Object.hasOwn( copied.values, key ) ? copied.values[ key ] : undefined };
			} ).filter( change => !Object.is( change.oldValue, change.value ) );
			if ( changes.some( change => change.key === 'layers' ) && !Object.getOwnPropertyDescriptor( this, '_layersVersion' ).writable ) {
				throw workingCopyPatchError();
			}
			const handle = Object.freeze( Object.create( null ) );
			workingCopyPatches.set( handle, { store: this, owner, state, pending: workingCopyObserve( this.pendingOperations ), queue: workingCopyObserve( this.lockingQueue ),
				methods: [ workingCopyMethod( this, 'notifyListeners' ), workingCopyMethod( this, 'commitWorkingCopyPatch' ), workingCopyMethod( this, 'preflightWorkingCopyPatch' ), workingCopyMethod( this, 'isWorkingCopyAlive' ) ],
				changes, committed: false, notified: false } );
			workingCopyPatchRecord( this, handle );
			return handle;
		} catch ( error ) {
			throw workingCopyPatchError();
		}
	}

	preflightWorkingCopyPatch( handle ) {
		workingCopyPatchRecord( this, handle );
	}

	commitWorkingCopyPatch( handle ) {
		const record = workingCopyPatchRecord( this, handle );
		for ( const change of record.changes ) {
			Object.defineProperty( this.state, change.key, { value: change.value,
				...( Object.hasOwn( this.state, change.key ) ? {} : { enumerable: true, configurable: true, writable: true } ) } );
		}
		if ( record.changes.some( change => change.key === 'layers' ) ) {
			this._layersVersion++;
		}
		record.committed = true;
	}

	notifyWorkingCopyPatch( handle ) {
		const record = workingCopyPatchRecord( this, handle, true );
		if ( record.notified ) {
			throw workingCopyPatchError();
		}
		record.notified = true;
		const diagnostics = [];
		for ( const change of record.changes ) {
			try {
				this.notifyListeners( change.key, this.state[ change.key ], change.oldValue );
			} catch ( error ) {
				diagnostics.push( 'working-copy-notification-failed' );
			}
		}
		return diagnostics;
	}

	releaseWorkingCopyPatch( handle ) {
		const record = workingCopyPatches.get( handle );
		if ( !record || record.store !== this ) {
			throw workingCopyPatchError();
		}
		workingCopyPatches.delete( handle );
	}

	constructor( editor ) {
		this.editor = editor;
		this._layersVersion = 0;
		this.state = {
			// Core editor state
			isDirty: false,
			isLoading: false, // Prevents user interactions during API load
			currentTool: 'pointer',
			selectedLayerIds: [],
			layers: [],
			currentLayerSetId: null,
			allLayerSets: [],

			// Canvas/viewport state
			zoom: 1.0,
			panX: 0,
			panY: 0,
			canvasWidth: 0,
			canvasHeight: 0,

			// UI state
			showGrid: false,
			showRulers: false,
			showGuides: false,
			snapToGrid: false,
			snapToGuides: false,

			// Background image state
			backgroundVisible: true,
			backgroundOpacity: 1.0,

			// Canvas/slide layer selection state
			canvasLayerSelected: false,

			// Slide mode: canvas geometry and identity, populated from config
			// or the API before first render.
			slideName: null,
			slideCanvasWidth: null,
			slideCanvasHeight: null,
			slideBackgroundColor: null,

			// History state
			history: [],
			historyIndex: -1,
			maxHistorySize: getDefaults().MAX_HISTORY_SIZE
		};

		this.listeners = {};
		
		// State locking mechanism to prevent race conditions
		this.isLocked = false;
		this.pendingOperations = [];
		this.lockingQueue = [];
		this.lockTimeout = null;
		this.lockAutoRecoveryTimeout = null;
		this.lockStuckSince = null;
		this._isProcessingPending = false;
		
		this.initializeState();
	}

	initializeState() {
		// Initialize with default values
		this.state.layers = [];
		this.state.selectedLayerIds = [];
		this.state.history = [];
		this.state.historyIndex = -1;

		// Save initial state to history for proper undo/redo
		this.saveToHistory( 'initial' );
	}

	/**
	 * Get current state
	 */
	getState() {
		return { ...this.state };
	}

	/**
	 * Get specific state property
	 */
	get( key ) {
		return this.state[ key ];
	}

	/**
	 * Set state property and notify listeners (with race condition protection)
	 */
	set( key, value ) {
		if ( this.isLocked ) {
			// Queue the operation if state is locked (with coalescing to prevent data loss)
			this._queueSetOperation( key, value );
			return;
		}

		const oldValue = this.state[ key ];
		this.state[ key ] = value;

		// Bump version counter when layers change (used by SmartGuidesController cache)
		if ( key === 'layers' ) {
			this._layersVersion++;
		}

		// Notify listeners of the change
		this.notifyListeners( key, value, oldValue );
	}

	/**
	 * Queue a set operation with coalescing
	 * If an operation for the same key exists, update it instead of adding a new one
	 * @private
	 */
	_queueSetOperation( key, value ) {
		// Look for existing 'set' operation with same key
		for ( let i = 0; i < this.pendingOperations.length; i++ ) {
			const op = this.pendingOperations[ i ];
			if ( op.type === 'set' && op.key === key ) {
				// Coalesce: update existing operation with new value
				op.value = value;
				return;
			}
		}

		// No existing operation for this key, add new one
		if ( this.pendingOperations.length >= MAX_PENDING_OPERATIONS ) {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( `[StateManager] Pending operations queue full (${MAX_PENDING_OPERATIONS}), coalescing operations` );
			}
			// Try to coalesce with update operations instead of dropping
			this._coalesceIntoUpdate( key, value );
			return;
		}
		this.pendingOperations.push( { type: 'set', key: key, value: value } );
	}

	/**
	 * Coalesce a set operation into the most recent update operation
	 * @private
	 */
	_coalesceIntoUpdate( key, value ) {
		// Look for an existing update operation to merge into
		for ( let i = this.pendingOperations.length - 1; i >= 0; i-- ) {
			const op = this.pendingOperations[ i ];
			if ( op.type === 'update' ) {
				// Merge this key into the update
				op.updates[ key ] = value;
				return;
			}
		}
		// No update operation found, convert the oldest set to an update and add this key
		for ( let i = 0; i < this.pendingOperations.length; i++ ) {
			const op = this.pendingOperations[ i ];
			if ( op.type === 'set' ) {
				// Convert to update and add new key
				this.pendingOperations[ i ] = {
					type: 'update',
					updates: { [ op.key ]: op.value, [ key ]: value }
				};
				return;
			}
		}
		// Fallback: replace oldest operation (should rarely happen)
		if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( '[StateManager] Queue full with no coalesceable operations, replacing oldest' );
		}
		this.pendingOperations[ 0 ] = { type: 'set', key: key, value: value };
	}

	/**
	 * Update multiple state properties at once (with race condition protection)
	 */
	update( updates ) {
		if ( this.isLocked ) {
			// Queue the operation if state is locked (with coalescing to prevent data loss)
			this._queueUpdateOperation( updates );
			return;
		}

		this.lockState();

		try {
			const oldState = { ...this.state };
			const changedKeys = [];

			Object.keys( updates ).forEach( key => {
				if ( this.state[ key ] !== updates[ key ] ) {
					this.state[ key ] = updates[ key ];
					changedKeys.push( key );
				}
			} );

			// Bump version counter when layers change
			if ( changedKeys.includes( 'layers' ) ) {
				this._layersVersion++;
			}

			// Notify listeners for each changed key
			changedKeys.forEach( key => {
				this.notifyListeners( key, this.state[ key ], oldState[ key ] );
			} );
		} finally {
			this.unlockState();
		}
	}

	/**
	 * Queue an update operation with coalescing
	 * Merge with existing update operations to prevent queue overflow
	 * @private
	 */
	_queueUpdateOperation( updates ) {
		// Look for existing 'update' operation to merge with
		for ( let i = this.pendingOperations.length - 1; i >= 0; i-- ) {
			const op = this.pendingOperations[ i ];
			if ( op.type === 'update' ) {
				// Coalesce: merge updates (new values override old)
				Object.assign( op.updates, updates );
				return;
			}
		}

		// No existing update operation, add new one or coalesce with sets
		if ( this.pendingOperations.length >= MAX_PENDING_OPERATIONS ) {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( `[StateManager] Pending operations queue full (${MAX_PENDING_OPERATIONS}), coalescing update operations` );
			}
			// Convert pending set operations into a single update
			const coalescedUpdates = { ...updates };
			let foundSets = false;
			for ( let i = 0; i < this.pendingOperations.length; i++ ) {
				const op = this.pendingOperations[ i ];
				if ( op.type === 'set' ) {
					coalescedUpdates[ op.key ] = op.value;
					foundSets = true;
				}
			}
			if ( foundSets ) {
				// Remove all set operations and add a single update
				this.pendingOperations = this.pendingOperations.filter( op => op.type !== 'set' );
				this.pendingOperations.push( { type: 'update', updates: coalescedUpdates } );
				return;
			}
		}
		this.pendingOperations.push( { type: 'update', updates: updates } );
	}

	/**
	 * Atomically update state with a function to prevent race conditions
	 */
	atomic( updateFunction ) {
		if ( typeof updateFunction !== 'function' ) {
			throw new Error( 'Atomic update requires a function' );
		}

		this.lockState();

		try {
			const oldState = { ...this.state };
			
			// Apply the update function to get new state
			const newState = updateFunction( oldState );
			
			if ( newState && typeof newState === 'object' ) {
				const changedKeys = [];

				Object.keys( newState ).forEach( key => {
					if ( this.state[ key ] !== newState[ key ] ) {
						this.state[ key ] = newState[ key ];
						changedKeys.push( key );
					}
				} );

				// Bump version counter when layers change
				if ( changedKeys.includes( 'layers' ) ) {
					this._layersVersion++;
				}

				// Notify listeners for each changed key
				changedKeys.forEach( key => {
					this.notifyListeners( key, this.state[ key ], oldState[ key ] );
				} );
			}
		} finally {
			this.unlockState();
		}
	}

	/**
	 * Lock the state to prevent concurrent modifications
	 */
	lockState() {
		// CORE-7 FIX: Check if previous lock was stuck and log recovery
		if ( this.lockStuckSince ) {
			const stuckDuration = Date.now() - this.lockStuckSince;
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( `[StateManager] Recovered from stuck lock after ${stuckDuration}ms` );
			}
			this.lockStuckSince = null;
		}
		
		this.isLocked = true;
		
		// Set a timeout to detect stuck locks (but don't force unlock - that could corrupt state)
		if ( this.lockTimeout ) {
			clearTimeout( this.lockTimeout );
		}
		this.lockTimeout = setTimeout( () => {
			// Log error but DON'T force unlock immediately - give more time for slow operations
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[StateManager] Lock held for >5s - monitoring for deadlock.' );
			}
			this.lockStuckSince = Date.now();
		}, LOCK_DETECTION_TIMEOUT_MS );

		// Auto-recovery after extended lock - last resort to prevent permanent deadlock
		if ( this.lockAutoRecoveryTimeout ) {
			clearTimeout( this.lockAutoRecoveryTimeout );
		}
		this.lockAutoRecoveryTimeout = setTimeout( () => {
			if ( this.isLocked ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[StateManager] Lock held for >30s - forcing unlock to recover. Some state may be inconsistent.' );
				}
				this.forceUnlock( 'auto-recovery' );
			}
		}, LOCK_AUTO_RECOVERY_TIMEOUT_MS );
	}

	/**
	 * Unlock the state and process any pending operations
	 */
	unlockState() {
		this.isLocked = false;
		this.lockStuckSince = null;
		
		if ( this.lockTimeout ) {
			clearTimeout( this.lockTimeout );
			this.lockTimeout = null;
		}
		if ( this.lockAutoRecoveryTimeout ) {
			clearTimeout( this.lockAutoRecoveryTimeout );
			this.lockAutoRecoveryTimeout = null;
		}

		// Prevent reentrant processing: if we're already draining the queue
		// from an outer unlockState(), let that outer call handle it
		if ( this._isProcessingPending ) {
			return;
		}

		this._isProcessingPending = true;

		try {
			// Process any pending operations in order
			// Wrap in try-catch to prevent deadlock if an operation throws
			while ( this.pendingOperations.length > 0 ) {
				const operation = this.pendingOperations.shift();
				
				try {
					if ( operation.type === 'set' ) {
						this.set( operation.key, operation.value );
					} else if ( operation.type === 'update' ) {
						this.update( operation.updates );
					}
				} catch ( error ) {
					// Log the error but continue processing remaining operations
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.error( '[StateManager] Error processing pending operation:', error.message || error );
					}
				}
			}
		} finally {
			this._isProcessingPending = false;
		}
	}

	/**
	 * Force unlock the state - use only for emergency recovery.
	 * This may leave state in an inconsistent condition if an operation was in progress.
	 *
	 * @param {string} [reason='manual'] - Reason for force unlock (for logging)
	 * @return {boolean} True if state was locked and is now unlocked
	 */
	forceUnlock( reason ) {
		const wasLocked = this.isLocked;
		const pendingCount = this.pendingOperations.length;

		if ( wasLocked ) {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( `[StateManager] Force unlock triggered (${reason || 'manual'}), ${pendingCount} pending operations` );
			}
		}

		// Clear lock state
		this.isLocked = false;
		this.lockStuckSince = null;

		// Clear timeouts
		if ( this.lockTimeout ) {
			clearTimeout( this.lockTimeout );
			this.lockTimeout = null;
		}
		if ( this.lockAutoRecoveryTimeout ) {
			clearTimeout( this.lockAutoRecoveryTimeout );
			this.lockAutoRecoveryTimeout = null;
		}

		// Process pending operations (they may fail if state is inconsistent)
		while ( this.pendingOperations.length > 0 ) {
			const operation = this.pendingOperations.shift();

			try {
				if ( operation.type === 'set' ) {
					this.set( operation.key, operation.value );
				} else if ( operation.type === 'update' ) {
					this.update( operation.updates );
				}
			} catch ( error ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[StateManager] Error in forceUnlock pending operation:', error.message || error );
				}
			}
		}

		return wasLocked;
	}

	/**
	 * Check if state is currently locked
	 *
	 * @return {boolean} True if state is locked
	 */
	isStateLocked() {
		return this.isLocked;
	}

	/**
	 * Get count of pending operations (for debugging/monitoring)
	 *
	 * @return {number} Number of pending operations in queue
	 */
	getPendingOperationCount() {
		return this.pendingOperations.length;
	}

	/**
	 * Subscribe to state changes
	 */
	subscribe( key, callback ) {
		if ( !this.listeners[ key ] ) {
			this.listeners[ key ] = [];
		}
		this.listeners[ key ].push( callback );

		// Return unsubscribe function
		return () => {
			// Guard against destroyed state or missing key
			if ( !this.listeners || !this.listeners[ key ] ) {
				return;
			}
			const index = this.listeners[ key ].indexOf( callback );
			if ( index > -1 ) {
				this.listeners[ key ].splice( index, 1 );
			}
		};
	}

	/**
	 * Notify listeners of state changes
	 */
	notifyListeners( key, newValue, oldValue ) {
		if ( this.listeners[ key ] ) {
			this.listeners[ key ].forEach( callback => {
				try {
					callback( newValue, oldValue, key );
				} catch ( error ) {
					// SECURITY FIX: Use mw.log instead of console.error
					if ( mw.log ) {
						mw.log.error( 'State listener error:', error.message || 'Unknown error' );
					}
				}
			} );
		}

		// Also notify global listeners
		if ( this.listeners[ '*' ] ) {
			this.listeners[ '*' ].forEach( callback => {
				try {
					callback( key, newValue, oldValue );
				} catch ( error ) {
					// SECURITY FIX: Use mw.log instead of console.error
					if ( mw.log ) {
						mw.log.error( 'Global state listener error:', error.message || 'Unknown error' );
					}
				}
			} );
		}
	}

	/**
	 * Layer management methods with atomic operations
	 */
	addLayer( layerData ) {
		const layer = {
			...layerData,
			id: layerData.id || (
				( window.Layers && window.Layers.Utils && window.Layers.Utils.generateLayerId )
					? window.Layers.Utils.generateLayerId()
					: 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 )
			),
			visible: layerData.visible !== false && layerData.visible !== 0,
			locked: layerData.locked || false
		};

		this.atomic( ( state ) => {
			const newLayers = [ layer, ...state.layers ]; // Add to top
			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		// Save state AFTER modification for proper undo/redo
		this.saveToHistory( 'add-layer' );

		return layer;
	}

	removeLayer( layerId ) {
		const existingLayer = this.state.layers.find( layer => layer.id === layerId );
		if ( !existingLayer ) {
			return; // Layer doesn't exist, nothing to remove
		}

		this.atomic( ( state ) => {
			const newLayers = state.layers.filter( layer => layer.id !== layerId );
			const newSelectedLayerIds = state.selectedLayerIds.filter( id => id !== layerId );
			
			return {
				layers: newLayers,
				selectedLayerIds: newSelectedLayerIds,
				isDirty: true
			};
		} );

		// Save state AFTER modification for proper undo/redo
		this.saveToHistory( 'remove-layer' );
	}

	updateLayer( layerId, updates ) {
		const existingLayer = this.state.layers.find( layer => layer.id === layerId );
		if ( !existingLayer ) {
			return; // Layer doesn't exist, nothing to update
		}

		this.atomic( ( state ) => {
			const layerIndex = state.layers.findIndex( layer => layer.id === layerId );
			// Guard against race condition where layer was removed between check and update
			if ( layerIndex === -1 ) {
				return null; // No changes - layer was removed
			}
			const newLayers = [ ...state.layers ];
			newLayers[ layerIndex ] = { ...newLayers[ layerIndex ], ...updates };
			
			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		// Save state AFTER modification for proper undo/redo
		this.saveToHistory( 'update-layer' );
	}

	getLayer( layerId ) {
		return this.state.layers.find( layer => layer.id === layerId );
	}

	getLayers() {
		return this.state.layers.slice();
	}

	/**
	 * Get the layers version counter.
	 * Incremented every time the layers array is replaced via set/update/atomic.
	 * Used by SmartGuidesController to determine cache validity without
	 * relying on reference equality (which fails because getLayers returns a copy).
	 *
	 * @return {number} Current layers version
	 */
	getLayersVersion() {
		return this._layersVersion;
	}

	/**
	 * Layer ordering methods
	 *
	 * @param {string} layerId The ID of the layer to move
	 * @param {string} targetId The ID of the target layer
	 * @param {boolean} [insertAfter=false] If true, insert after the target; if false, insert before
	 * @return {boolean} True if reorder succeeded, false otherwise
	 */
	reorderLayer( layerId, targetId, insertAfter = false ) {
		const layers = this.state.layers;
		const draggedLayer = layers.find( layer => layer.id === layerId );
		const draggedIndex = layers.findIndex( layer => layer.id === layerId );
		const targetIndex = layers.findIndex( layer => layer.id === targetId );

		if ( draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex ) {
			return false;
		}

		// Check if the dragged layer is a folder (group) with children
		const isFolder = draggedLayer && draggedLayer.type === 'group';
		const folderChildren = isFolder && draggedLayer.children ? draggedLayer.children : [];

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];

			// Collect all layers to move: the folder + its children (in order)
			const layersToMove = [];
			const indicesToRemove = [];

			// First, find the folder
			const folderIdx = newLayers.findIndex( l => l.id === layerId );
			if ( folderIdx !== -1 ) {
				layersToMove.push( newLayers[ folderIdx ] );
				indicesToRemove.push( folderIdx );
			}

			// If it's a folder, also find its children in their current order
			if ( isFolder && folderChildren.length > 0 ) {
				for ( let i = 0; i < newLayers.length; i++ ) {
					if ( folderChildren.includes( newLayers[ i ].id ) ) {
						layersToMove.push( newLayers[ i ] );
						indicesToRemove.push( i );
					}
				}
			}

			// Remove all the layers to move (in reverse order to maintain indices)
			indicesToRemove.sort( ( a, b ) => b - a );
			for ( const idx of indicesToRemove ) {
				newLayers.splice( idx, 1 );
			}

			// Find the new target position in the modified array
			let newTargetIndex = newLayers.findIndex( l => l.id === targetId );
			if ( newTargetIndex === -1 ) {
				// Target was removed (shouldn't happen, but handle gracefully)
				newTargetIndex = newLayers.length;
			}

			// If insertAfter is true, we want to place the layers after the target
			if ( insertAfter ) {
				newTargetIndex = newTargetIndex + 1;
			}

			// Insert all layers at the target position (maintaining their relative order)
			newLayers.splice( newTargetIndex, 0, ...layersToMove );

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'reorder-layer' );
		return true;
	}

	moveLayerUp( layerId ) {
		const layers = this.state.layers;
		const index = layers.findIndex( layer => layer.id === layerId );

		if ( index <= 0 ) {
			return false; // Already at top or not found
		}

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];
			[ newLayers[ index - 1 ], newLayers[ index ] ] = [ newLayers[ index ], newLayers[ index - 1 ] ];

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'move-layer-up' );
		return true;
	}

	moveLayerDown( layerId ) {
		const layers = this.state.layers;
		const index = layers.findIndex( layer => layer.id === layerId );

		if ( index === -1 || index >= layers.length - 1 ) {
			return false; // At bottom or not found
		}

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];
			[ newLayers[ index ], newLayers[ index + 1 ] ] = [ newLayers[ index + 1 ], newLayers[ index ] ];

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'move-layer-down' );
		return true;
	}

	bringToFront( layerId ) {
		const layers = this.state.layers;
		const index = layers.findIndex( layer => layer.id === layerId );

		if ( index === -1 || index === 0 ) {
			return false; // Already at front or not found
		}

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];
			const [ layer ] = newLayers.splice( index, 1 );
			newLayers.unshift( layer );

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'bring-to-front' );
		return true;
	}

	sendToBack( layerId ) {
		const layers = this.state.layers;
		const index = layers.findIndex( layer => layer.id === layerId );

		if ( index === -1 || index === layers.length - 1 ) {
			return false; // Already at back or not found
		}

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];
			const [ layer ] = newLayers.splice( index, 1 );
			newLayers.push( layer );

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'send-to-back' );
		return true;
	}

	/**
	 * Selection management with atomic operations
	 */
	selectLayer( layerId, multiSelect = false ) {
		this.atomic( ( state ) => {
			let newSelectedLayerIds;
			
			if ( multiSelect ) {
				if ( !state.selectedLayerIds.includes( layerId ) ) {
					newSelectedLayerIds = [ ...state.selectedLayerIds, layerId ];
				} else {
					return {}; // Already selected
				}
			} else {
				newSelectedLayerIds = [ layerId ];
			}
			
			return {
				selectedLayerIds: newSelectedLayerIds
			};
		} );
	}

	deselectLayer( layerId ) {
		this.atomic( ( state ) => {
			const newSelectedLayerIds = state.selectedLayerIds.filter( id => id !== layerId );
			
			if ( newSelectedLayerIds.length !== state.selectedLayerIds.length ) {
				return {
					selectedLayerIds: newSelectedLayerIds
				};
			}
			
			return {}; // No changes
		} );
	}

	clearSelection() {
		this.atomic( ( state ) => {
			if ( state.selectedLayerIds.length > 0 ) {
				return {
					selectedLayerIds: []
				};
			}
			
			return {}; // No changes
		} );
	}

	getSelectedLayers() {
		return this.state.layers.filter( layer =>
			this.state.selectedLayerIds.includes( layer.id )
		);
	}

	/**
	 * History management
	 *
	 * NOTE: StateManager's internal history is DISABLED because LayersEditor
	 * uses HistoryManager for undo/redo. StateManager.undo()/redo() are never
	 * called in the codebase, so saveToHistory was wasting CPU cycles cloning
	 * the entire layers array (including 500KB+ image data) on every change.
	 *
	 * Performance impact: Cloning a 1MB layer set 50 times = 50MB memory overhead.
	 */
	saveToHistory( /* action */ ) {
		// Disabled - HistoryManager handles undo/redo
		// See comment above for rationale
		return;

		// Original code (kept for reference, unreachable):
		// Remove any history after current index (for when we're not at the end)
		// this.state.history = this.state.history.slice( 0, this.state.historyIndex + 1 );
		// ... etc
	}

	// CORE-6 FIX: Removed dead undo(), redo(), restoreState() methods.
	// HistoryManager handles all undo/redo functionality.
	// See HistoryManager.js for the active implementation.

	/**
	 * Utility methods
	 */
	setDirty( isDirty ) {
		this.set( 'isDirty', isDirty );
	}

	isDirty() {
		return this.state.isDirty;
	}

	markClean() {
		this.setDirty( false );
	}

	markDirty() {
		this.setDirty( true );
	}

	/**
	 * Load state from external source
	 */
	loadState( externalState ) {
		if ( externalState.layers ) {
			this.state.layers = externalState.layers;
		}
		if ( externalState.currentLayerSetId !== undefined ) {
			this.state.currentLayerSetId = externalState.currentLayerSetId;
		}
		if ( externalState.allLayerSets ) {
			this.state.allLayerSets = externalState.allLayerSets;
		}

		// Save initial state to history
		this.saveToHistory( 'load-state' );
		this.markClean();

		// Notify listeners
		this.notifyListeners( 'layers', this.state.layers );
	}

	/**
	 * Export current state
	 */
	exportState() {
		return {
			layers: JSON.parse( JSON.stringify( this.state.layers ) ),
			selectedLayerIds: this.state.selectedLayerIds.slice(),
			currentLayerSetId: this.state.currentLayerSetId,
			isDirty: this.state.isDirty
		};
	}

	/**
	 * Reset state to initial values
	 */
	reset() {
		this.initializeState();
		this.notifyListeners( 'layers', this.state.layers );
		this.notifyListeners( 'selectedLayerIds', this.state.selectedLayerIds );
		this.markClean();
	}

	/**
	 * Destroy state manager and clean up resources
	 */
	destroy() {
		workingCopyDestroyedStores.add( this );
		// Cancel any pending lock timeouts
		if ( this.lockTimeout ) {
			clearTimeout( this.lockTimeout );
			this.lockTimeout = null;
		}
		if ( this.lockAutoRecoveryTimeout ) {
			clearTimeout( this.lockAutoRecoveryTimeout );
			this.lockAutoRecoveryTimeout = null;
		}

		// Force unlock if locked
		if ( this.isLocked ) {
			this.isLocked = false;
			this.lockStuckSince = null;
		}

		// Clear pending operations
		this.pendingOperations = [];
		this.lockingQueue = [];

		// Clear all listeners
		this.listeners = {};

		// Reset state
		this.reset();
	}
}

// Export to window.Layers namespace (preferred)
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.Core = window.Layers.Core || {};
	window.Layers.Core.StateManager = StateManager;
	// NOTE: Do NOT create a global singleton here.
	// Each LayersEditor instance creates its own StateManager via the ModuleRegistry.
	// Creating a singleton at load time causes bugs with multiple editors and memory leaks.
}

// Export for CommonJS/Jest tests
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = StateManager;
}