/**
 * Isolated synchronous storage utility for page-owned drafts.
 * Keyed strictly by (wiki, user, owner, baseRevisionId, surfaceId).
 * Preserves raw draft envelopes without sanitizing or evaluating recovery.
 */
( function () {
	'use strict';

	const STORAGE_KEY_PREFIX = 'layers-page-owned-draft-v1:';
	const PACKED_PREFIX = 'layers-packed-draft-v1:';
	const earlierCreationRecords = new WeakMap();

	// Repeated image data can make an otherwise valid Undo backup exceed browser quota.
	// Pack only after quota refusal; decoding restores the exact original JSON string.
	function packDraft( raw, parsed ) {
		const counts = new Map(), stack = [ parsed ];
		while ( stack.length ) {
			const value = stack.pop();
			if ( typeof value === 'string' && value.length >= 4096 ) {
				counts.set( value, ( counts.get( value ) || 0 ) + 1 );
			} else if ( value && typeof value === 'object' ) {
				for ( const child of Object.values( value ) ) { stack.push( child ); }
			}
		}
		const candidates = Array.from( counts ).filter( entry => entry[ 1 ] > 1 )
			.sort( ( a, b ) => b[ 0 ].length * ( b[ 1 ] - 1 ) - a[ 0 ].length * ( a[ 1 ] - 1 ) ).slice( 0, 32 );
		let index = 0, marker = '~layers-draft-0_';
		while ( raw.includes( marker ) ) { marker = '~layers-draft-' + ++index + '_'; }
		let data = raw;
		const literals = [];
		for ( const [ value ] of candidates ) {
			const literal = JSON.stringify( value ), pieces = data.split( literal );
			if ( pieces.length < 3 ) { continue; }
			data = pieces.join( marker + literals.length + '~' );
			literals.push( literal );
		}
		if ( !literals.length ) { return null; }
		const packed = PACKED_PREFIX + JSON.stringify( [ marker, literals, data ] );
		return packed.length < raw.length && unpackDraft( packed ) === raw ? packed : null;
	}

	function unpackDraft( raw ) {
		if ( !raw.startsWith( PACKED_PREFIX ) ) { return raw; }
		const packed = JSON.parse( raw.slice( PACKED_PREFIX.length ) );
		if ( !Array.isArray( packed ) || packed.length !== 3 || typeof packed[ 0 ] !== 'string' ||
			!/^~layers-draft-\d+_$/.test( packed[ 0 ] ) || !Array.isArray( packed[ 1 ] ) ||
			packed[ 1 ].length > 32 || typeof packed[ 2 ] !== 'string' ) { throw new Error(); }
		let data = packed[ 2 ];
		packed[ 1 ].forEach( ( literal, index ) => {
			if ( typeof literal !== 'string' || literal.length < 2 ) { throw new Error(); }
			const parts = data.split( packed[ 0 ] + index + '~' );
			if ( parts.length < 2 || data.length + ( parts.length - 1 ) * literal.length > 128 * 1024 * 1024 ) {
				throw new Error();
			}
			data = parts.join( literal );
		} );
		return data;
	}

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
		/** Inactive discovery: same wiki/user/owner only; keys and payloads grant no native authority. */
		listEarlierCreationCandidates( scope, pdf = false ) {
			const permitted = JSON.parse( this._validateAndBuildKey( scope ).slice( STORAGE_KEY_PREFIX.length ) );
			try {
				const found = [], records = earlierCreationRecords.get( this ) || new WeakMap();
				earlierCreationRecords.set( this, records );
				const length = this._storage.length;
				if ( !Number.isInteger( length ) || length < 0 || typeof this._storage.key !== 'function' ) { throw new Error(); }
				for ( let i = 0; i < length; i++ ) {
					const key = this._storage.key( i );
					if ( typeof key !== 'string' || !key.startsWith( STORAGE_KEY_PREFIX ) ) { continue; }
					let values, candidateScope, partition;
					try {
						const suffix = key.slice( STORAGE_KEY_PREFIX.length ), end = suffix.lastIndexOf( ']' );
						const encoded = suffix.slice( 0, end + 1 ); partition = suffix.slice( end + 1 );
						if ( partition && !/^#[a-f0-9]{32}$/.test( partition ) ) { continue; }
						values = JSON.parse( encoded );
						if ( !Array.isArray( values ) || values.length !== 5 || JSON.stringify( values ) !== encoded ||
							values[ 0 ] !== permitted[ 0 ] || values[ 1 ] !== permitted[ 1 ] || values[ 2 ] !== permitted[ 2 ] || values[ 3 ] >= permitted[ 3 ] ) { continue; }
						candidateScope = { wiki: values[ 0 ], user: values[ 1 ], owner: values[ 2 ], baseRevisionId: values[ 3 ], surfaceId: values[ 4 ] };
						if ( this._validateAndBuildKey( candidateScope ) !== STORAGE_KEY_PREFIX + encoded ) { continue; }
					} catch ( error ) { continue; }
					const raw = this._read( key );
					try {
						const envelope = typeof raw === 'string' ? JSON.parse( unpackDraft( raw ) ) : null;
						if ( !envelope || envelope.version !== 1 || !envelope.scope || Object.keys( envelope.scope ).length !== 5 ||
							Object.keys( candidateScope ).some( name => envelope.scope[ name ] !== candidateScope[ name ] ) ) { continue; }
						if ( pdf ) {
							const creation = envelope.pdfCreation, target = creation && creation.draft && creation.draft.creation && creation.draft.creation.target;
							if ( !creation || creation.version !== 4 || !creation.importPublication || !creation.importHistory || !target ||
								target.owner !== permitted[ 2 ] || target.revisionId !== values[ 3 ] || target.surfaceId !== values[ 4 ] ) { continue; }
						} else if ( !envelope.creationOrigin || envelope.creationOrigin.version !== 1 || !envelope.creationOrigin.origin ||
							envelope.creationOrigin.origin.owner !== permitted[ 2 ] || envelope.creationOrigin.origin.revisionId !== values[ 3 ] ||
							envelope.creationOrigin.origin.surfaceId !== values[ 4 ] || !envelope.workingCopyDraft ) { continue; }
						const handle = Object.freeze( Object.create( null ) );
						records.set( handle, { key, raw, scope: candidateScope, writerId: partition ? partition.slice( 1 ) : null,
							storage: this._storage, read: this._read, writer: this._writerId } ); found.push( handle );
					} catch ( error ) { /* Unprovable or corrupt records stay intact. */ }
				}
				return found;
			} catch ( error ) { throw failure( 'layers-draft-storage-failed' ); }
		}

		/** Same scoped discovery for complete PDF creation backups; native checks still decide eligibility. */
		listEarlierPdfCreationCandidates( scope ) { return this.listEarlierCreationCandidates( scope, true ); }

		/** Read an owned discovery handle without selecting its writer or altering any destination. */
		inspectEarlierCreationCandidate( handle ) {
			try {
				const record = earlierCreationRecords.get( this ) && earlierCreationRecords.get( this ).get( handle );
				if ( !record || this._storage !== record.storage || this._read !== record.read || this._writerId !== record.writer ||
					this._read( record.key ) !== record.raw ) { throw new Error(); }
				return { scope: { ...record.scope }, writerId: record.writerId, raw: unpackDraft( record.raw ) };
			} catch ( error ) { throw failure( 'layers-draft-storage-failed' ); }
		}

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
			this._ownedRecords = new Map();
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
				const recordKey = this._recordKey( key, this._writerId );
				const previous = this._ownedRecords.get( recordKey );
				const before = this._read( recordKey );
				if ( previous !== undefined ) {
					if ( before !== null && before !== undefined && before !== previous ) {
						throw new Error();
					}
				}
				let stored = draftJson;
				try {
					this._write( recordKey, stored );
				} catch ( error ) {
					if ( !error || ( error.name !== 'QuotaExceededError' && error.name !== 'NS_ERROR_DOM_QUOTA_REACHED' ) ||
						this._read( recordKey ) !== before ) { throw error; }
					stored = packDraft( draftJson, parsed );
					if ( stored === null ) { throw error; }
					this._write( recordKey, stored );
				}
				if ( this._writerId !== undefined ) {
					this._ownedRecords.set( recordKey, stored );
				}
			} catch ( e ) {
				throw failure( 'layers-draft-storage-failed' );
			}
		}

		/** Remove only an owned old base after its replacement has been verified. */
		retireConfirmed( previous, current ) {
			const oldKey = this._recordKey( this._validateAndBuildKey( previous ), this._writerId );
			const newKey = this._recordKey( this._validateAndBuildKey( current ), this._writerId );
			if ( this._writerId === undefined || oldKey === newKey ||
				[ 'wiki', 'user', 'owner', 'surfaceId' ].some( key => previous[ key ] !== current[ key ] ) ||
				current.baseRevisionId <= previous.baseRevisionId ) { return false; }
			const old = this._ownedRecords.get( oldKey ), replacement = this._ownedRecords.get( newKey );
			if ( old === undefined || replacement === undefined ) { return false; }
			try {
				const envelope = JSON.parse( unpackDraft( old ) );
				if ( Object.hasOwn( envelope, 'creationOrigin' ) || Object.hasOwn( envelope, 'pdfCreation' ) ) {
					return false;
				}
				if ( this._read( newKey ) !== replacement || this._read( oldKey ) !== old ||
					typeof this._storage.removeItem !== 'function' || this._read( newKey ) !== replacement ) { return false; }
				this._storage.removeItem( oldKey );
				if ( this._read( oldKey ) !== null ) { return false; }
				this._ownedRecords.delete( oldKey );
				return true;
			} catch ( error ) {
				return false;
			}
		}

		/** Retire only this instance's successful writes, including previous exact bases. */
		retireOwned() {
			if ( this._writerId === undefined ) {
				throw failure( 'layers-invalid-draft-storage-request' );
			}
			if ( this._ownedRecords.size === 0 ) {
				return;
			}
			const removed = [];
			try {
				const remove = this._storage.removeItem;
				if ( typeof remove !== 'function' ) {
					throw new Error();
				}
				for ( const [ key, raw ] of this._ownedRecords ) {
					const current = this._read( key );
					if ( current !== null && current !== raw ) {
						throw new Error();
					}
				}
				for ( const [ key, raw ] of this._ownedRecords ) {
					const current = this._read( key );
					if ( current !== null ) {
						if ( current !== raw ) {
							throw new Error();
						}
						removed.push( [ key, raw ] );
						remove.call( this._storage, key );
						if ( this._read( key ) !== null ) {
							throw new Error();
						}
					}
				}
			} catch ( error ) {
				for ( const [ key, raw ] of removed ) {
					try {
						if ( this._read( key ) === null ) {
							this._write( key, raw );
						}
					} catch ( restoreError ) {
						break;
					}
				}
				throw failure( 'layers-draft-storage-failed' );
			}
			this._ownedRecords.clear();
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
				raw = unpackDraft( raw );
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
