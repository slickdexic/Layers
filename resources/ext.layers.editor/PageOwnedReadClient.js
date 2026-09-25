/**
 * Page-owned exact-revision read client for Layers
 * Sends read requests to the MediaWiki layersread API.
 * Unregistered component - requires an injected MediaWiki API instance.
 */
'use strict';

( function () {
	const RECOGNIZED_ERROR_CODES = new Set( [
		'missingparam',
		'outofrange',
		'maxbytes',
		'permissiondenied',
		'layers-reading-disabled',
		'layers-revision-unavailable',
		'layers-reading-failed'
	] );

	/**
	 * Create a safe fixed error object without exposing sensitive server payloads or traces.
	 *
	 * @param {string} code
	 * @param {string} [message]
	 * @return {Error}
	 */
	function createError( code, message ) {
		const err = new Error( message || code );
		err.code = code;
		return err;
	}

	class PageOwnedReadClient {
		/**
		 * @param {Object} api Injected MediaWiki API-compatible object with get method.
		 */
		constructor( api ) {
			if ( !api || typeof api.get !== 'function' ) {
				throw createError( 'layers-invalid-read-request', 'A valid API instance with get is required' );
			}
			this.api = api;
		}

		/**
		 * Read an exact page-owned revision bundle from the server.
		 *
		 * @param {Object} options
		 * @param {string} options.owner Nonempty owner page title
		 * @param {number} options.revisionId Integer revision ID (1 to 2147483647)
		 * @return {Promise<{ revisionId: number, snapshot: Object, sourceGeometry: Object|Array }>}
		 */
		read( options ) {
			if ( !options || typeof options !== 'object' ) {
				return Promise.reject( createError( 'layers-invalid-read-request', 'Request options must be an object' ) );
			}

			// Capture primitive fields immediately at invocation to avoid external mutation
			const owner = options.owner;
			const revisionId = options.revisionId;

			// Local validation
			if ( typeof owner !== 'string' || owner.trim().length === 0 ) {
				return Promise.reject( createError( 'layers-invalid-read-request', 'Owner must be a nonempty string' ) );
			}

			if ( typeof revisionId !== 'number' || !Number.isInteger( revisionId ) ||
				revisionId < 1 || revisionId > 2147483647 ) {
				return Promise.reject( createError( 'layers-invalid-read-request', 'Revision ID must be an integer between 1 and 2147483647' ) );
			}

			const getParams = {
				action: 'layersread',
				// Legacy API JSON encodes true as "" and removes false properties.
				// Snapshot values must survive an exact read/edit/publish round trip.
				formatversion: 2,
				owner: owner,
				revid: revisionId
			};

			// Invoke immediately, but route synchronous transport failures through safe error mapping too.
			return new Promise( ( resolve ) => {
				resolve( this.api.get( getParams ) );
			} )
				.then( ( response ) => {
					if ( response && response.error ) {
						throw response;
					}

					if (
						response &&
						typeof response.layersread === 'object' &&
						response.layersread !== null &&
						!Array.isArray( response.layersread )
					) {
						const data = response.layersread;

						// Require exact requested revisionId, snapshot with schemaVersion 1 and surfaces array,
						// and sourceGeometry as an object or empty array.
						if (
							typeof data.revisionId === 'number' &&
							Number.isInteger( data.revisionId ) &&
							data.revisionId === revisionId &&
							data.snapshot &&
							typeof data.snapshot === 'object' &&
							!Array.isArray( data.snapshot ) &&
							data.snapshot.schemaVersion === 1 &&
							Array.isArray( data.snapshot.surfaces ) &&
							(
								( data.sourceGeometry && typeof data.sourceGeometry === 'object' && !Array.isArray( data.sourceGeometry ) ) ||
								( Array.isArray( data.sourceGeometry ) && data.sourceGeometry.length === 0 )
							)
						) {
							return {
								revisionId: data.revisionId,
								snapshot: data.snapshot,
								sourceGeometry: data.sourceGeometry
							};
						}
					}

					throw createError( 'layers-reading-failed', 'Reading failed: layers-reading-failed' );
				} )
				.catch( ( err ) => {
					let rawCode = null;
					if ( typeof err === 'string' ) {
						rawCode = err;
					} else if ( Array.isArray( err ) && typeof err[ 0 ] === 'string' ) {
						rawCode = err[ 0 ];
					} else if ( err && typeof err === 'object' ) {
						if ( typeof err.code === 'string' ) {
							rawCode = err.code;
						} else if ( err.error && typeof err.error.code === 'string' ) {
							rawCode = err.error.code;
						}
					}

					if ( rawCode && RECOGNIZED_ERROR_CODES.has( rawCode ) ) {
						throw createError( rawCode, 'Reading failed: ' + rawCode );
					}

					throw createError( 'layers-reading-failed', 'Reading failed: layers-reading-failed' );
				} );
		}
	}

	// Export for ResourceLoader
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedReadClient = PageOwnedReadClient;

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedReadClient;
	}
}() );
