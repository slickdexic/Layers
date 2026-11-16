/** Transactional browser backup storage. No write counts before commit and exact readback. */
( function () {
	'use strict';
	const failed = error => Object.assign( new Error( error && error.name === 'QuotaExceededError' ?
		'layers-draft-storage-quota' : 'layers-draft-storage-failed' ), {
		code: error && error.name === 'QuotaExceededError' ? 'layers-draft-storage-quota' : 'layers-draft-storage-failed'
	} );
	class PageOwnedIndexedDBDraftStore {
		constructor( factory, timeout = 10000 ) {
			this.factory = factory; this.timeout = timeout; this.database = null;
		}

		async open() {
			if ( this.database ) return this.database;
			if ( this.opening ) return this.opening;
			this.opening = new Promise( ( resolve, reject ) => {
				let request, done = false;
				const finish = ( error, database ) => {
					if ( done ) { if ( database ) database.close(); return; }
					done = true; clearTimeout( timer );
					if ( error ) reject( failed( error ) ); else {
						this.database = database;
						database.onversionchange = () => { database.close(); this.database = null; this.opening = null; };
						resolve( database );
					}
				};
				const timer = setTimeout( () => finish( new Error() ), this.timeout );
				try {
					request = this.factory.open( 'layers-page-owned-drafts-v1', 1 );
					request.onupgradeneeded = () => {
						if ( done ) { request.transaction.abort(); return; }
						if ( !request.result.objectStoreNames.contains( 'drafts' ) ) request.result.createObjectStore( 'drafts' );
					};
					request.onblocked = () => finish( new Error() );
					request.onerror = () => finish( request.error );
					request.onsuccess = () => finish( null, request.result );
				} catch ( error ) { finish( error ); }
			} );
			try { return await this.opening; } catch ( error ) { this.opening = null; throw error; }
		}

		async transaction( mode, work ) {
			const database = await this.open();
			return new Promise( ( resolve, reject ) => {
				let transaction, result, problem, settled = false;
				const finish = error => {
					if ( settled ) return; settled = true; clearTimeout( timer );
					if ( error ) reject( failed( error ) ); else resolve( result );
				};
				const abort = error => { problem = error; try { transaction.abort(); } catch ( ignored ) {} finish( error ); };
				const timer = setTimeout( () => abort( new Error() ), this.timeout );
				try {
					transaction = database.transaction( 'drafts', mode );
					transaction.oncomplete = () => finish( problem );
					transaction.onabort = () => finish( transaction.error || problem || new Error() );
					transaction.onerror = event => { problem = transaction.error || ( event.target && event.target.error ) || new Error(); };
					work( transaction.objectStore( 'drafts' ), value => { result = value; }, abort );
				} catch ( error ) { abort( error ); }
			} );
		}

		async read( key ) {
			return this.transaction( 'readonly', ( store, result ) => {
				const request = store.get( key ); request.onsuccess = () => result( request.result === undefined ? null : request.result );
			} );
		}

		async list( prefix ) {
			return this.transaction( 'readonly', ( store, result, abort ) => {
				const records = new Map(), request = store.openCursor();
				request.onsuccess = () => {
					const cursor = request.result;
					if ( !cursor ) { result( records ); return; }
					if ( typeof cursor.key === 'string' && cursor.key.startsWith( prefix ) ) {
						if ( typeof cursor.value !== 'string' ) { abort( new Error() ); return; }
						records.set( cursor.key, cursor.value );
					}
					cursor.continue();
				};
			} );
		}

		/** Compare all old bytes before any mutation; abort rolls the entire batch back. */
		async change( entries ) {
			if ( !Array.isArray( entries ) || !entries.length || new Set( entries.map( entry => entry.key ) ).size !== entries.length ||
				entries.some( entry => typeof entry.key !== 'string' || !entry.key.startsWith( 'layers-page-owned-draft-v1:' ) ||
					( entry.before !== null && typeof entry.before !== 'string' ) ||
					( entry.after !== null && ( typeof entry.after !== 'string' || entry.after.length > 128 * 1024 * 1024 ) ) ) ) throw failed();
			await this.transaction( 'readwrite', ( store, result, abort ) => {
				let remaining = entries.length;
				for ( const entry of entries ) {
					const request = store.get( entry.key );
					request.onsuccess = () => {
						if ( ( request.result === undefined ? null : request.result ) !== entry.before ) { abort( new Error() ); return; }
						if ( --remaining ) return;
						try {
							for ( const change of entries ) {
								if ( change.after === null ) store.delete( change.key ); else store.put( change.after, change.key );
							}
							result( true );
						} catch ( error ) { abort( error ); }
					};
				}
			} );
			try {
				await this.transaction( 'readonly', ( store, result, abort ) => {
					for ( const entry of entries ) {
						const request = store.get( entry.key );
						request.onsuccess = () => {
							if ( ( request.result === undefined ? null : request.result ) !== entry.after ) abort( new Error() );
						};
					}
				} );
			} catch ( error ) {
				// Verification failure does not undo the transaction that already committed.
				// Callers may recover ownership or restore deleted bytes, but cannot claim durability.
				error.committed = true; throw error;
			}
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedIndexedDBDraftStore = PageOwnedIndexedDBDraftStore;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedIndexedDBDraftStore;
}() );
