'use strict';

// Event-driven IDB test boundary: request success, commit and abort are distinct.
// Writes live in a transaction snapshot and never reach records before commit.
module.exports = function indexedDatabase() {
	const records = new Map(), held = [], transactions = [];
	const controls = { records, held, transactions, hold: false, commitError: null, read: value => value };
	const database = {
		close: jest.fn(),
		transaction: ( name, mode ) => {
			const snapshot = new Map( records );
			let count = 0, ended = false, queued = false;
			const transaction = { mode, error: null };
			transactions.push( transaction );
			transaction.abort = () => {
				if ( ended ) throw new Error( 'inactive' );
				ended = true; queueMicrotask( () => transaction.onabort && transaction.onabort() );
			};
			const finish = () => {
				if ( ended || count ) return;
				if ( mode === 'readwrite' && controls.commitError ) {
					transaction.error = controls.commitError;
					if ( transaction.onerror ) transaction.onerror( { target: transaction } );
					transaction.abort(); return;
				}
				ended = true;
				if ( mode === 'readwrite' ) { records.clear(); for ( const entry of snapshot ) records.set( ...entry ); }
				if ( transaction.oncomplete ) transaction.oncomplete();
			};
			const check = () => {
				if ( count || ended || queued ) return;
				queued = true;
				queueMicrotask( () => {
					queued = false;
					if ( count || ended ) return;
					if ( mode === 'readwrite' && controls.hold ) held.push( finish ); else finish();
				} );
			};
			const request = operation => {
				const req = {}; count++;
				queueMicrotask( () => {
					if ( ended ) return;
					req.result = operation();
					if ( req.onsuccess ) req.onsuccess();
					count--; check();
				} );
				return req;
			};
			transaction.objectStore = () => ( {
				get: key => request( () => mode === 'readonly' ? controls.read( snapshot.get( key ), key ) : snapshot.get( key ) ),
				put: ( value, key ) => request( () => snapshot.set( key, value ) ),
				delete: key => request( () => snapshot.delete( key ) ),
				openCursor: () => {
					const entries = Array.from( snapshot ), req = {}; let index = 0;
					const next = () => {
						count++;
						queueMicrotask( () => {
							if ( ended ) return;
							const entry = entries[ index++ ];
							req.result = entry ? { key: entry[ 0 ], value: entry[ 1 ], continue: next } : null;
							if ( req.onsuccess ) req.onsuccess(); count--; check();
						} );
					}; next(); return req;
				}
			} );
			check(); return transaction;
		}
	};
	controls.factory = { open: () => {
		const request = {};
		queueMicrotask( () => { request.result = database; request.onsuccess(); } ); return request;
	} };
	controls.flush = async () => { for ( let index = 0; index < 40; index++ ) await Promise.resolve(); };
	controls.commit = () => { controls.hold = false; while ( held.length ) held.shift()(); };
	return controls;
};
