/**
 * Explicit publication client for an imported whole-PDF layer set.
 * Intentionally not registered with ResourceLoader.
 */
'use strict';

( function () {
	const privateState = new WeakMap();
	const sanitizedReasons = new WeakMap();
	const MAX_ID = 2147483647;
	const REQUEST_KEYS = [ 'pageId', 'baseRevisionId', 'snapshotJson', 'sources', 'admissionRevisions', 'summary' ];
	const SOURCE_KEYS = [ 'targetSurfaceId', 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ];
	const ORIGIN_KEYS = [ 'surfaceId', 'revisionId' ];
	const KNOWN_ERRORS = new Set( [
		'missingparam', 'badtoken', 'outofrange', 'maxbytes', 'permissiondenied', 'ratelimited', 'mustbeposted',
		'layers-owner-edit-denied', 'layers-invalid-publication-request', 'layers-main-model-change-denied',
		'layers-invalid-snapshot', 'layers-source-unavailable', 'layers-edit-conflict', 'layers-publication-disabled',
		'layers-admission-unauthorized', 'layers-slot-removal-denied', 'layers-content-not-renderable',
		'layers-edit-filtered', 'layers-working-copy-import-unavailable'
	] );

	function error( code, message ) {
		const e = new Error( message || ( code === 'layers-publication-outcome-unknown' ? 'Publication outcome is unknown' : 'Publication failed: ' + code ) );
		e.code = code;
		return e;
	}

	function plainRecord( value, keys ) {
		if ( !value || typeof value !== 'object' || Array.isArray( value ) ) {
			throw error( 'layers-invalid-publication-request' );
		}
		const proto = Object.getPrototypeOf( value );
		if ( proto !== Object.prototype && proto !== null ) {
			throw error( 'layers-invalid-publication-request' );
		}
		const own = Reflect.ownKeys( value );
		if ( own.length !== keys.length || own.some( ( key ) => typeof key !== 'string' || !keys.includes( key ) ) ) {
			throw error( 'layers-invalid-publication-request' );
		}
		const desc = Object.getOwnPropertyDescriptors( value ), captured = Object.create( null );
		for ( const key of keys ) {
			const d = desc[ key ];
			if ( !d || !Object.prototype.hasOwnProperty.call( d, 'value' ) || !d.enumerable ) {
				throw error( 'layers-invalid-publication-request' );
			}
			captured[ key ] = d.value;
		}
		return captured;
	}

	function isId( value ) {
		return Number.isInteger( value ) && value > 0 && value <= MAX_ID;
	}

	function utf8Length( value ) {
		return new TextEncoder().encode( value ).length;
	}

	function identifier( value ) {
		return typeof value === 'string' && value.length > 0 && utf8Length( value ) <= 128;
	}

	function captureArray( value, min, max, keys, convert ) {
		if ( !Array.isArray( value ) || Object.getPrototypeOf( value ) !== Array.prototype || value.length < min || value.length > max ||
			Reflect.ownKeys( value ).length !== value.length + 1 ) {
			throw error( 'layers-invalid-publication-request' );
		}
		const result = [];
		for ( let i = 0; i < value.length; i++ ) {
			const d = Object.getOwnPropertyDescriptor( value, String( i ) );
			if ( !d || !Object.prototype.hasOwnProperty.call( d, 'value' ) || !d.enumerable ) {
				throw error( 'layers-invalid-publication-request' );
			}
			result.push( convert( plainRecord( d.value, keys ) ) );
		}
		return result;
	}

	function captureMethod( api ) {
		if ( !api || ( typeof api !== 'object' && typeof api !== 'function' ) ) {
			throw error( 'layers-invalid-publication-request' );
		}
		for ( let obj = api; obj; obj = Object.getPrototypeOf( obj ) ) {
			const d = Object.getOwnPropertyDescriptor( obj, 'postWithToken' );
			if ( d ) {
				if ( !Object.prototype.hasOwnProperty.call( d, 'value' ) || typeof d.value !== 'function' ) {
					throw error( 'layers-invalid-publication-request' );
				}
				return d.value;
			}
		}
		throw error( 'layers-invalid-publication-request' );
	}

	function mapTransportError( raw ) {
		let code = typeof raw === 'string' ? raw : null;
		let info = null;
		try {
			if ( raw && typeof raw === 'object' && sanitizedReasons.has( raw ) ) {
				info = sanitizedReasons.get( raw );
			}
			if ( Array.isArray( raw ) ) {
				const first = Object.getOwnPropertyDescriptor( raw, '0' );
				if ( first && Object.prototype.hasOwnProperty.call( first, 'value' ) && typeof first.value === 'string' ) {
					code = first.value;
				}
			} else if ( raw && typeof raw === 'object' ) {
				const d = Object.getOwnPropertyDescriptors( raw );
				if ( d.code && Object.prototype.hasOwnProperty.call( d.code, 'value' ) && typeof d.code.value === 'string' ) {
					code = d.code.value;
				} else if ( d.error && Object.prototype.hasOwnProperty.call( d.error, 'value' ) && d.error.value && typeof d.error.value === 'object' ) {
					const ed = Object.getOwnPropertyDescriptors( d.error.value );
					if ( ed.code && Object.prototype.hasOwnProperty.call( ed.code, 'value' ) && typeof ed.code.value === 'string' ) {
						code = ed.code.value;
						if ( code === 'layers-invalid-snapshot' && ed.info &&
							Object.prototype.hasOwnProperty.call( ed.info, 'value' ) && typeof ed.info.value === 'string' && ed.info.value.length <= 300 ) {
							info = ed.info.value;
						}
					}
				}
			}
		} catch ( ignored ) {
			code = null;
		}
		const safeCode = code && KNOWN_ERRORS.has( code ) ? code : 'layers-publication-outcome-unknown';
		const mapped = error( safeCode, safeCode === 'layers-invalid-snapshot' && info ? info : undefined );
		if ( safeCode === 'layers-invalid-snapshot' && info ) {
			sanitizedReasons.set( mapped, info );
		}
		return mapped;
	}

	function mapApiRejection( code, result ) {
		try {
			const descriptors = result && typeof result === 'object' && Object.getOwnPropertyDescriptors( result );
			if ( descriptors && descriptors.error && Object.prototype.hasOwnProperty.call( descriptors.error, 'value' ) ) {
				return mapTransportError( result );
			}
		} catch ( ignored ) {
			return error( 'layers-publication-outcome-unknown' );
		}
		return mapTransportError( code );
	}

	class PageOwnedWholePdfImportPublishClient {
		constructor( api ) {
			privateState.set( this, { api: api, postWithToken: captureMethod( api ) } );
		}

		publish( request ) {
			let dto;
			try {
				if ( !request || typeof request !== 'object' || Array.isArray( request ) ||
					( Object.getPrototypeOf( request ) !== Object.prototype && Object.getPrototypeOf( request ) !== null ) ) {
					throw error( 'layers-invalid-publication-request' );
				}
				const requestKeys = Reflect.ownKeys( request );
				const requestDescriptors = Object.getOwnPropertyDescriptors( request );
				const requiredKeys = [ 'pageId', 'baseRevisionId', 'snapshotJson', 'sources' ];
				if ( requestKeys.some( ( key ) => typeof key !== 'string' || !REQUEST_KEYS.includes( key ) ) ||
					!requiredKeys.every( ( key ) => requestKeys.includes( key ) ) ||
					requestKeys.some( ( key ) => !requestDescriptors[ key ] ||
						!Object.prototype.hasOwnProperty.call( requestDescriptors[ key ], 'value' ) || !requestDescriptors[ key ].enumerable ) ) {
					throw error( 'layers-invalid-publication-request' );
				}
				const input = Object.create( null );
				for ( const key of REQUEST_KEYS ) {
					input[ key ] = requestDescriptors[ key ] ? requestDescriptors[ key ].value : undefined;
				}
				const summary = input.summary === undefined ? '' : input.summary;
				const sourcesInput = input.sources;
				const originsInput = input.admissionRevisions === undefined ? [] : input.admissionRevisions;
				if ( !isId( input.pageId ) || !isId( input.baseRevisionId ) || typeof input.snapshotJson !== 'string' || typeof summary !== 'string' ) {
					throw error( 'layers-invalid-publication-request' );
				}
				const sources = captureArray( sourcesInput, 1, 32, SOURCE_KEYS, ( s ) => {
					if ( !identifier( s.targetSurfaceId ) || !isId( s.sourcePageId ) || !isId( s.sourceRevisionId ) ||
						!identifier( s.sourceSurfaceId ) || s.sourcePageId === input.pageId ) {
						throw error( 'layers-invalid-publication-request' );
					}
					return { targetSurfaceId: s.targetSurfaceId, sourcePageId: s.sourcePageId,
						sourceRevisionId: s.sourceRevisionId, sourceSurfaceId: s.sourceSurfaceId };
				} );
				const origins = captureArray( originsInput, 0, 100, ORIGIN_KEYS, ( o ) => {
					if ( !identifier( o.surfaceId ) || !isId( o.revisionId ) || o.revisionId >= input.baseRevisionId ) {
						throw error( 'layers-invalid-publication-request' );
					}
					return { surfaceId: o.surfaceId, revisionId: o.revisionId };
				} );
				const sourceKeys = new Set(), originKeys = new Set();
				for ( const s of sources ) {
					const key = JSON.stringify( [ s.targetSurfaceId, s.sourcePageId, s.sourceRevisionId, s.sourceSurfaceId ] );
					if ( sourceKeys.has( key ) ) {
						throw error( 'layers-invalid-publication-request' );
					}
					sourceKeys.add( key );
				}
				for ( const o of origins ) {
					const key = o.surfaceId;
					if ( originKeys.has( key ) ) {
						throw error( 'layers-invalid-publication-request' );
					}
					originKeys.add( key );
				}
				dto = {
					action: 'layersworkingcopypdfimportpublish', targetpageid: input.pageId, baserevid: input.baseRevisionId,
					data: input.snapshotJson, importsources: JSON.stringify( sources ),
					admissionrevisions: JSON.stringify( origins ), summary: summary
				};
			} catch ( e ) {
				return Promise.reject( error( 'layers-invalid-publication-request' ) );
			}

			const state = privateState.get( this );
			return new Promise( ( resolve, reject ) => {
				let requestPromise;
				try {
					requestPromise = state.postWithToken.call( state.api, 'csrf', dto );
				} catch ( e ) {
					reject( mapTransportError( e ) );
					return;
				}
				if ( requestPromise && typeof requestPromise.then === 'function' ) {
					requestPromise.then( resolve, ( code, result ) => reject( mapApiRejection( code, result ) ) );
				} else {
					resolve( requestPromise );
				}
			} ).then( ( response ) => {
				const wrapper = response && Object.getOwnPropertyDescriptors( response );
				const errorDescriptor = wrapper && wrapper.error;
				if ( errorDescriptor && Object.prototype.hasOwnProperty.call( errorDescriptor, 'value' ) ) {
					throw mapTransportError( { error: errorDescriptor.value } );
				}
				const payloadDescriptor = wrapper && wrapper.layersworkingcopypdfimportpublish;
				const payload = payloadDescriptor && Object.prototype.hasOwnProperty.call( payloadDescriptor, 'value' ) && payloadDescriptor.value;
				const fields = payload && Object.getOwnPropertyDescriptors( payload );
				if ( wrapper && payload && !Array.isArray( payload ) &&
					Object.getPrototypeOf( payload ) === Object.prototype && fields && Reflect.ownKeys( fields ).length === 3 &&
					[ 'version', 'result', 'revid' ].every( ( key ) => fields[ key ] &&
						Object.prototype.hasOwnProperty.call( fields[ key ], 'value' ) && fields[ key ].enumerable ) &&
					fields.version.value === 1 && fields.result.value === 'Success' &&
					isId( fields.revid.value ) && fields.revid.value > dto.baserevid ) {
					return { revisionId: fields.revid.value };
				}
				throw error( 'layers-publication-outcome-unknown' );
			} ).catch( ( e ) => {
				throw mapTransportError( e );
			} );
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedWholePdfImportPublishClient = PageOwnedWholePdfImportPublishClient;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedWholePdfImportPublishClient;
	}
}() );
