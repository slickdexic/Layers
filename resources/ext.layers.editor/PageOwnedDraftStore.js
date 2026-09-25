/**
 * Isolated synchronous storage utility for page-owned drafts.
 * Keyed strictly by (wiki, user, owner, baseRevisionId, surfaceId).
 * Preserves raw draft envelopes without sanitizing or evaluating recovery.
 */
( function () {
	'use strict';

	const STORAGE_KEY_PREFIX = 'layers-page-owned-draft-v1:';

	/**
	 * Create a safe error with no diagnostic leakage.
	 *
	 * @param {string} code Fixed error code
	 * @return {Error}
	 */
	function failure( code ) {
		const error = new Error( code );
		error.code = code;
		return error;
	}

	class PageOwnedDraftStore {
		/**
		 * @param {Object} storage Injected Storage-compatible object with getItem and setItem
		 * @param {string} [writerId] Unique 32-hex editor instance ID; separate records prevent cross-tab overwrite
		 */
		constructor( storage, writerId ) {
			if ( writerId !== undefined && ( typeof writerId !== 'string' || !/^[a-f0-9]{32}$/.test( writerId ) ) ) {
				throw failure( 'layers-invalid-draft-storage-request' );
			}
			this._writerId = writerId;
			this._readWriterId = writerId;
			this._storage = storage;
			try {
				const read = storage && storage.getItem;
				const write = storage && storage.setItem;
				if ( typeof read !== 'function' || typeof write !== 'function' ) {
					throw new Error();
				}
				this._read = read.bind( storage );
				this._write = write.bind( storage );
			} catch ( error ) {
				throw failure( 'layers-draft-storage-failed' );
			}
		}

		/**
		 * Synchronously store a draft envelope string.
		 *
		 * @param {Object} scope Exact { wiki, user, owner, baseRevisionId, surfaceId }
		 * @param {string} draftJson Nonempty string parsing as a non-null JSON object
		 */
		write( scope, draftJson ) {
			const key = this._validateAndBuildKey( scope );

			if ( typeof draftJson !== 'string' || draftJson.length === 0 ) {
				throw failure( 'layers-invalid-draft-storage-request' );
			}

			let parsed;
			try {
				parsed = JSON.parse( draftJson );
			} catch ( e ) {
				throw failure( 'layers-invalid-draft-storage-request' );
			}

			if ( !parsed || typeof parsed !== 'object' || Array.isArray( parsed ) ) {
				throw failure( 'layers-invalid-draft-storage-request' );
			}

			try {
				this._write( this._recordKey( key, this._writerId ), draftJson );
			} catch ( e ) {
				throw failure( 'layers-draft-storage-failed' );
			}
		}

		/**
		 * Synchronously retrieve a stored draft envelope string.
		 *
		 * @param {Object} scope Exact { wiki, user, owner, baseRevisionId, surfaceId }
		 * @return {?string} Exact stored string, or null if absent
		 */
		read( scope ) {
			const key = this._validateAndBuildKey( scope );

			let raw;
			try {
				raw = this._read( this._recordKey( key, this._readWriterId ) );
			} catch ( e ) {
				throw failure( 'layers-draft-storage-failed' );
			}

			if ( raw === null || raw === undefined ) {
				return null;
			}

			if ( typeof raw !== 'string' || raw.length === 0 ) {
				throw failure( 'layers-draft-storage-failed' );
			}

			let parsed;
			try {
				parsed = JSON.parse( raw );
			} catch ( e ) {
				throw failure( 'layers-draft-storage-failed' );
			}

			if ( !parsed || typeof parsed !== 'object' || Array.isArray( parsed ) ) {
				throw failure( 'layers-draft-storage-failed' );
			}

			return raw;
		}

		/**
		 * Choose an existing record for recovery without changing the destination for writes.
		 * @param {?string} writerId Null selects the older, unpartitioned record for read-only recovery
		 */
		selectRecovery( writerId ) {
			if ( this._writerId === undefined || ( writerId !== null &&
				( typeof writerId !== 'string' || !/^[a-f0-9]{32}$/.test( writerId ) ) ) ) {
				throw failure( 'layers-invalid-draft-storage-request' );
			}
			this._readWriterId = writerId === null ? undefined : writerId;
		}

		/**
		 * Discover only records for the exact authorized scope. No shared index and no deletion.
		 * @param {Object} scope Exact scope
		 * @return {Array} Candidate writer IDs (null for the legacy unpartitioned record)
		 */
		listCandidates( scope ) {
			const key = this._validateAndBuildKey( scope );
			try {
				const found = new Set();
				if ( this._read( key ) !== null ) {
					found.add( null );
				}
				const prefix = key + '#';
				const length = this._storage.length;
				if ( !Number.isInteger( length ) || length < 0 || typeof this._storage.key !== 'function' ) {
					throw new Error();
				}
				for ( let i = 0; i < length; i++ ) {
					const storedKey = this._storage.key( i );
					if ( typeof storedKey === 'string' && storedKey.startsWith( prefix ) ) {
						const id = storedKey.slice( prefix.length );
						if ( /^[a-f0-9]{32}$/.test( id ) ) {
							found.add( id );
						}
					}
				}
				return Array.from( found );
			} catch ( error ) {
				throw failure( 'layers-draft-storage-failed' );
			}
		}

		/** @param {string} key @param {string} writerId @return {string} @private */
		_recordKey( key, writerId ) {
			return writerId === undefined ? key : key + '#' + writerId;
		}

		/**
		 * Validate scope object and construct the injective storage key.
		 *
		 * @private
		 * @param {Object} scope
		 * @return {string}
		 */
		_validateAndBuildKey( scope ) {
			if ( !scope || typeof scope !== 'object' || Array.isArray( scope ) ) {
				throw failure( 'layers-invalid-draft-storage-request' );
			}

			let values;
			try {
				const expected = [ 'wiki', 'user', 'owner', 'baseRevisionId', 'surfaceId' ];
				const keys = Reflect.ownKeys( scope );
				if ( keys.length !== expected.length || keys.some( ( key ) => !expected.includes( key ) ) ) {
					throw new Error();
				}
				values = expected.map( ( key ) => {
					const descriptor = Object.getOwnPropertyDescriptor( scope, key );
					if ( !descriptor || !Object.prototype.hasOwnProperty.call( descriptor, 'value' ) ) {
						throw new Error();
					}
					return descriptor.value;
				} );
			} catch ( error ) {
				throw failure( 'layers-invalid-draft-storage-request' );
			}
			const [ wiki, user, owner, baseRevisionId, surfaceId ] = values;

			if ( typeof wiki !== 'string' || wiki.length === 0 ||
				typeof user !== 'string' || user.length === 0 ||
				typeof owner !== 'string' || owner.length === 0 ||
				typeof surfaceId !== 'string' || surfaceId.length === 0 ||
				!Number.isInteger( baseRevisionId ) || baseRevisionId < 1 || baseRevisionId > 2147483647 ) {
				throw failure( 'layers-invalid-draft-storage-request' );
			}

			return STORAGE_KEY_PREFIX + JSON.stringify( [
				wiki,
				user,
				owner,
				baseRevisionId,
				surfaceId
			] );
		}
	}

	PageOwnedDraftStore.STORAGE_KEY_PREFIX = STORAGE_KEY_PREFIX;

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedDraftStore = PageOwnedDraftStore;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedDraftStore;
	}
}() );
