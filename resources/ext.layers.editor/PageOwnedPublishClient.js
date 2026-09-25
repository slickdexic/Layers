/**
 * Page-owned publication client for Layers
 * Sends publication requests to the MediaWiki layerspublish API.
 * Unregistered component - requires an injected MediaWiki API instance.
 */
'use strict';

( function () {
	const RECOGNIZED_ERROR_CODES = new Set( [
		'missingparam',
		'badtoken',
		'outofrange',
		'maxbytes',
		'permissiondenied',
		'ratelimited',
		'mustbeposted',
		'layers-owner-edit-denied',
		'layers-invalid-publication-request',
		'layers-main-model-change-denied',
		'layers-invalid-snapshot',
		'layers-source-unavailable',
		'layers-edit-conflict',
		'layers-publication-disabled',
		'layers-admission-unauthorized',
		'layers-slot-removal-denied'
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

	class PageOwnedPublishClient {
		/**
		 * @param {Object} api Injected MediaWiki API-compatible object with postWithToken method.
		 */
		constructor( api ) {
			if ( !api || typeof api.postWithToken !== 'function' ) {
				throw createError( 'layers-invalid-publication-request', 'A valid API instance with postWithToken is required' );
			}
			this.api = api;
		}

		/**
		 * Publish a page-owned snapshot to the server.
		 *
		 * @param {Object} options
		 * @param {string} options.owner Nonempty owner page title
		 * @param {number} options.baseRevisionId Integer base revision ID (0 for new page, up to 2147483647)
		 * @param {string} options.snapshotJson Serialized document snapshot JSON string
		 * @param {string} [options.summary] Optional edit summary (defaults to empty string)
		 * @param {string} [options.mainText] Optional main wikitext content (omitted if undefined/null, preserved if empty string)
		 * @param {number} [options.pageId] Optional expected owner PageID (integer 1..2147483647; requires baseRevisionId > 0)
		 * @return {Promise<{ revisionId: number }>}
		 */
		publish( options ) {
			if ( !options || typeof options !== 'object' ) {
				return Promise.reject( createError( 'layers-invalid-publication-request', 'Request options must be an object' ) );
			}

			// Capture fields immediately at invocation to avoid external mutation
			const owner = options.owner;
			const baseRevisionId = options.baseRevisionId;
			const snapshotJson = options.snapshotJson;
			const summary = options.summary;
			const mainText = options.mainText;
			const pageId = options.pageId;

			// Local validation
			if ( typeof owner !== 'string' || owner.trim().length === 0 ) {
				return Promise.reject( createError( 'layers-invalid-publication-request', 'Owner must be a nonempty string' ) );
			}

			if ( typeof baseRevisionId !== 'number' || !Number.isInteger( baseRevisionId ) ||
				baseRevisionId < 0 || baseRevisionId > 2147483647 ) {
				return Promise.reject( createError( 'layers-invalid-publication-request', 'Base revision ID must be an integer between 0 and 2147483647' ) );
			}

			if ( typeof snapshotJson !== 'string' ) {
				return Promise.reject( createError( 'layers-invalid-publication-request', 'Snapshot JSON must be a string' ) );
			}

			if ( ( summary !== undefined && typeof summary !== 'string' ) ||
				( mainText !== undefined && mainText !== null && typeof mainText !== 'string' ) ) {
				return Promise.reject( createError( 'layers-invalid-publication-request', 'Summary and main text must be strings when provided' ) );
			}

			if ( pageId !== undefined ) {
				if ( typeof pageId !== 'number' || !Number.isInteger( pageId ) ||
					pageId < 1 || pageId > 2147483647 ) {
					return Promise.reject( createError( 'layers-invalid-publication-request', 'Page ID must be an integer between 1 and 2147483647 when provided' ) );
				}
				if ( baseRevisionId <= 0 ) {
					return Promise.reject( createError( 'layers-invalid-publication-request', 'Base revision ID must be greater than zero when page ID is provided' ) );
				}
			}

			const postParams = {
				action: 'layerspublish',
				owner: owner,
				baserevid: baseRevisionId,
				data: snapshotJson,
				summary: typeof summary === 'string' ? summary : ''
			};

			if ( pageId !== undefined ) {
				postParams.pageid = pageId;
			}

			if ( typeof mainText === 'string' ) {
				postParams.maintext = mainText;
			}

			// Invoke immediately, but route synchronous transport failures through safe error mapping too.
			return new Promise( ( resolve ) => {
				resolve( this.api.postWithToken( 'csrf', postParams ) );
			} )
				.then( ( response ) => {
					if ( response && response.error ) {
						throw response;
					}

					if (
						response &&
						response.layerspublish &&
						response.layerspublish.result === 'Success' &&
						typeof response.layerspublish.revid === 'number' &&
						Number.isInteger( response.layerspublish.revid ) &&
						response.layerspublish.revid >= 1 &&
						response.layerspublish.revid <= 2147483647
					) {
						return { revisionId: response.layerspublish.revid };
					}

					throw createError( 'layers-publication-outcome-unknown', 'Publication outcome is unknown' );
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
						throw createError( rawCode, 'Publication failed: ' + rawCode );
					}

					throw createError( 'layers-publication-outcome-unknown', 'Publication outcome is unknown' );
				} );
		}
	}

	// Export for ResourceLoader
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPublishClient = PageOwnedPublishClient;

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedPublishClient;
	}
}() );
