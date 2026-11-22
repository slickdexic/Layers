/** Dual-store recovery with explicit awaited persistence; synchronous calls never start a write. */
( function () {
	'use strict';
	const Store = typeof module !== 'undefined' && module.require ? module.require( './PageOwnedDraftStore.js' ) : window.Layers.Editor.PageOwnedDraftStore;
	const fail = code => Object.assign( new Error( code || 'layers-draft-storage-failed' ), { code: code || 'layers-draft-storage-failed' } );
	const pending = new WeakMap(), selections = new WeakMap(), earlier = new WeakMap();
	class PageOwnedFallbackDraftStore extends Store {
		readReviewedCopy( key, local ) { return local ? this._read( key ) : this.cached.get( key ); }

		/** Delete just the reviewed record, including an identical duplicate in the other store. */
		prepareRecoveryDiscard( scope, writer = this._readWriterId, expected ) {
			const selected = selections.get( writer );
			if ( selected ) { if ( selected.store !== this ) throw fail(); writer = selected.writer; }
			const key = this._recordKey( this._validateAndBuildKey( scope ), writer === null ? undefined : writer );
			const raw = expected === undefined ? this.read( scope ) : expected;
			const matches = value => typeof value === 'string' && Store.unpack( value ) === raw;
			const local = matches( this._read( key ) ) ? super.prepareRecoveryDiscard( scope, writer, raw ) : null;
			const saved = this.cached.get( key ), database = matches( saved ) ? saved : null;
			if ( !local && database === null ) throw fail();
			const rollback = async ( restoreLocal = true ) => {
				let error;
				if ( local && restoreLocal ) { try { local.restore(); } catch ( failure ) { error = failure; } }
				if ( database !== null ) {
					try {
						const current = await this.database.read( key );
						if ( current === null ) await this.database.change( [ { key, before: null, after: database } ] );
						else if ( current !== database ) throw fail();
						this.cached.set( key, database );
					} catch ( failure ) { error = failure; }
				}
				if ( error ) throw error;
			};
			const preflight = async () => {
				if ( local ) local.preflight();
				if ( database !== null && await this.database.read( key ) !== database ) throw fail( 'layers-draft-record-changed' );
				if ( local ) local.preflight();
			};
			const receipt = () => Store.discardReceipt( scope, writer, raw, Boolean( local ), database !== null );
			return Object.freeze( { restore: rollback, preflight, receipt, discard: async ( guard = () => {} ) => {
				if ( this.busy ) throw fail(); guard(); this.busy = true; let removed = false, localRemoved = false;
				try {
					if ( database !== null ) {
						guard();
						try { await this.database.change( [ { key, before: database, after: null } ] ); removed = true; }
						catch ( error ) { removed = error.committed === true; throw error; }
					}
					guard();
					if ( local ) { local.discard( guard ); localRemoved = true; }
					guard();
					if ( database !== null ) this.cached.delete( key );
				} catch ( error ) {
					if ( removed || localRemoved ) await rollback( localRemoved );
					throw error;
				} finally { this.busy = false; }
			} } );
		}

		constructor( storage, writer, verify, database ) {
			super( storage, writer, verify );
			this.database = database; this.cached = new Map(); this.committed = new Map(); this.ownedFallback = new Map();
			this.unverified = new Map();
			this.selectedFallback = null; this.busy = false; this.loaded = new Set(); this.currentFallback = new Set();
			this.captureChecks = null;
			const cache = this.cached;
			this.fallback = new Store( { getItem: key => cache.get( key ) ?? null,
				setItem: () => { throw fail(); }, key: index => Array.from( cache.keys() )[ index ], get length() { return cache.size; } }, writer, true );
		}

		async initialize( scope ) {
			this._validateAndBuildKey( scope );
			const prefix = Store.STORAGE_KEY_PREFIX + JSON.stringify( [ scope.wiki, scope.user, scope.owner ] ).slice( 0, -1 ) + ',';
			if ( this.loaded.has( prefix ) ) return;
			try {
				const records = await this.database.list( prefix );
				for ( const [ key, raw ] of records ) this.cached.set( key, raw );
				this.loaded.add( prefix ); this.unavailable = null;
			} catch ( error ) { this.unavailable = error; }
		}

		write( scope, json ) {
			const key = this._recordKey( this._validateAndBuildKey( scope ), this._writerId );
			try { super.write( scope, json ); this.currentFallback.delete( key );
				if ( this.committed.has( key ) ) {
					this.ownedFallback.set( key, this.committed.get( key ) ); this.cached.set( key, this.committed.get( key ) ); this.committed.delete( key );
				}
				return;
			} catch ( error ) {
				if ( !error.quota ) throw error;
			}
			if ( !this.captureChecks && this.unverified.has( key ) ) throw fail();
			const verified = this.committed.get( key ) ?? this.ownedFallback.get( key );
			if ( verified === json && ( !this.captureChecks || this.captureChecks.has( key ) ) ) {
				this.cached.set( key, json ); this.ownedFallback.set( key, json ); this.currentFallback.add( key ); this.committed.delete( key ); return;
			}
			const error = fail(); pending.set( error, { store: this, scope: { ...scope }, key, json } ); throw error;
		}

		/** Re-run synchronous capture after each completed write; never accept a stale capture as current. */
		async persistDurably( capture ) {
			if ( this.busy ) throw fail(); this.busy = true;
			const checked = new Set();
			try {
				for ( let attempt = 0; attempt < 4; attempt++ ) {
					let request;
					this.captureChecks = checked;
					try { return capture(); } catch ( error ) {
						request = pending.get( error );
						if ( !request || request.store !== this ) throw error;
					} finally { this.captureChecks = null; }

					// Only a capture that needs the fallback depends on IndexedDB.
					const { key, json } = request;
					await this.initialize( request.scope );
					if ( this.unavailable ) throw fail();
					const previous = this.unverified.get( key ) ?? this.committed.get( key ) ?? this.ownedFallback.get( key ) ?? null;
					if ( previous === null && this.cached.has( key ) ) throw fail();
					try {
						if ( previous === json ) {
							if ( await this.database.read( key ) !== json ) throw fail();
						} else {
							await this.database.change( [ { key, before: previous, after: json } ] );
						}
					} catch ( failure ) {
						if ( failure.committed ) this.unverified.set( key, json );
						throw failure;
					}
					this.unverified.delete( key );
					this.committed.set( key, json );
					checked.add( key );
				}
				throw fail();
			} finally { this.busy = false; }
		}

		isFallbackCandidate( value ) { const record = selections.get( value ); return Boolean( record && record.store === this ); }

		listCandidates( scope ) {
			const local = super.listCandidates( scope );
			for ( const writer of this.fallback.listCandidates( scope ) ) {
				const key = this._recordKey( this._validateAndBuildKey( scope ), writer === null ? undefined : writer );
				// Exact duplicate copies need only one offer. Distinct contents remain separate choices.
				if ( local.includes( writer ) ) {
					const old = this._readWriterId;
					try {
						this.fallback.selectRecovery( writer ); super.selectRecovery( writer );
						if ( super.read( scope ) === this.fallback.read( scope ) ) continue;
					} catch ( error ) { /* Corrupt records remain independent recovery choices. */ }
					finally { this._readWriterId = old; }
				}
				const handle = Object.freeze( {} ); selections.set( handle, { store: this, writer, key, raw: this.cached.get( key ) } ); local.push( handle );
			}
			return local;
		}

		selectRecovery( candidate ) {
			if ( this.isFallbackCandidate( candidate ) ) {
				this.selectedFallback = selections.get( candidate ); this._readWriterId = candidate;
				this.fallback.selectRecovery( this.selectedFallback.writer );
			} else { super.selectRecovery( candidate ); this.selectedFallback = null; }
		}

		read( scope ) {
			if ( this.selectedFallback ) {
				const key = this._recordKey( this._validateAndBuildKey( scope ), this.selectedFallback.writer === null ? undefined : this.selectedFallback.writer );
				if ( key !== this.selectedFallback.key || this.cached.get( key ) !== this.selectedFallback.raw ) throw fail();
				return this.fallback.read( scope );
			}
			const key = this._recordKey( this._validateAndBuildKey( scope ), this._readWriterId );
			if ( this._readWriterId === this._writerId && this.currentFallback.has( key ) ) {
				this.fallback.selectRecovery( this._writerId ); return this.fallback.read( scope );
			}
			return super.read( scope );
		}

		async revalidateRecovery( handle ) {
			const candidate = earlier.get( handle ), selected = this.selectedFallback;
			if ( candidate ) {
				if ( candidate.store !== this ) throw fail();
				const record = candidate.record, key = this._recordKey( this._validateAndBuildKey( record.scope ), record.writerId === null ? undefined : record.writerId );
				if ( await this.database.read( key ) !== this.cached.get( key ) ) throw fail();
			} else if ( selected && await this.database.read( selected.key ) !== selected.raw ) throw fail();
		}

		listEarlierCreationCandidates( scope, pdf = false ) {
			const local = super.listEarlierCreationCandidates( scope, pdf );
			for ( const source of this.fallback.listEarlierCreationCandidates( scope, pdf ) ) {
				const record = this.fallback.inspectEarlierCreationCandidate( source ), handle = Object.freeze( {} );
				earlier.set( handle, { store: this, source, record } ); local.push( handle );
			}
			return local;
		}

		inspectEarlierCreationCandidate( handle ) {
			const candidate = earlier.get( handle );
			if ( !candidate ) return super.inspectEarlierCreationCandidate( handle );
			if ( candidate.store !== this ) throw fail();
			return this.fallback.inspectEarlierCreationCandidate( candidate.source );
		}

		retireOwned() {
			if ( this.busy || this.ownedFallback.size || this.committed.size || this.unverified.size ) throw fail();
			return super.retireOwned();
		}

		async retireOwnedAsync( guard = () => {} ) { return this.retireGroupAsync( [ this ], guard ); }

		async retireGroupAsync( stores, guard = () => {} ) {
			if ( !stores.length || new Set( stores ).size !== stores.length || stores.some( store =>
				!( store instanceof PageOwnedFallbackDraftStore ) || store.database !== this.database || store.busy || store.committed.size || store.unverified.size ) ) throw fail();
			const entries = stores.flatMap( store => Array.from( store.ownedFallback, ( [ key, before ] ) => ( { key, before, after: null } ) ) );
			const locals = stores.flatMap( store => Array.from( store._ownedRecords, ( [ key, raw ] ) => ( { store, key, raw } ) ) );
			const check = () => {
				guard();
				for ( const item of locals ) if ( item.store._read( item.key ) !== item.raw ) throw fail();
			};
			check(); stores.forEach( store => { store.busy = true; } ); let removed = false;
			try {
				if ( entries.length ) {
					try { await this.database.change( entries ); removed = true; }
					catch ( failure ) { removed = failure.committed === true; throw failure; }
				}
				check();
				for ( const item of locals ) {
					guard(); item.store._storage.removeItem( item.key );
					if ( item.store._read( item.key ) !== null ) throw fail();
				}
				guard();
				for ( const store of stores ) {
					for ( const key of store.ownedFallback.keys() ) store.cached.delete( key );
					store.ownedFallback.clear(); store.currentFallback.clear(); store._ownedRecords.clear();
				}
			} catch ( error ) {
				for ( const item of locals ) {
					try { if ( item.store._read( item.key ) === null ) item.store._write( item.key, item.raw ); } catch ( restoreError ) { /* Continue restoring the other store. */ }
				}
				if ( removed ) {
					for ( const entry of entries ) {
						try { await this.database.change( [ { key: entry.key, before: null, after: entry.before } ] ); }
						catch ( restoreError ) { /* Preserve concurrent bytes and still attempt the other owned copies. */ }
					}
				}
				throw error;
			} finally { stores.forEach( store => { store.busy = false; } ); }
		}

		async retireConfirmedAsync( previous, current ) {
			if ( this.busy || current.baseRevisionId <= previous.baseRevisionId ||
				[ 'wiki', 'user', 'owner', 'surfaceId' ].some( key => previous[ key ] !== current[ key ] ) ) return false;
			const key = this._recordKey( this._validateAndBuildKey( previous ), this._writerId );
			const replacement = this._recordKey( this._validateAndBuildKey( current ), this._writerId );
			const raw = this.ownedFallback.get( key ), next = this.ownedFallback.get( replacement );
			if ( raw === undefined || next === undefined ) return super.retireConfirmed( previous, current );
			const envelope = JSON.parse( raw );
			if ( Object.hasOwn( envelope, 'creationOrigin' ) || Object.hasOwn( envelope, 'pdfCreation' ) ) return false;
			try { await this.database.change( [ { key, before: raw, after: null }, { key: replacement, before: next, after: next } ] ); }
			catch ( error ) {
				if ( error.committed ) { this.cached.delete( key ); this.ownedFallback.delete( key ); this.currentFallback.delete( key ); }
				throw error;
			}
			this.cached.delete( key ); this.ownedFallback.delete( key ); this.currentFallback.delete( key ); return true;
		}
	}
	window.Layers.Editor.PageOwnedFallbackDraftStore = PageOwnedFallbackDraftStore;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedFallbackDraftStore;
}() );
