/** Unregistered native working-copy Import transport; requires an injected API. */
'use strict';

( function () {
	const CODE = 'layers-working-copy-import-unavailable';
	const FIELDS = [ 'targetPageId', 'targetBaseRevisionId', 'targetSurfaceId',
		'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ];
	const DESCRIPTOR_FIELDS = [ 'pageId', 'owner', 'revisionId', 'surfaceId' ];
	const unsafeKeys = new Set( [ '__proto__', 'prototype', 'constructor' ] );

	function unavailable() {
		const error = new Error( CODE );
		error.code = CODE;
		return error;
	}

	function integer( value ) {
		return Number.isInteger( value ) && value >= 1 && value <= 2147483647;
	}

	function member( value ) {
		return typeof value === 'string' && value.length > 0 &&
			new TextEncoder().encode( value ).length <= 128;
	}

	function object( value ) {
		return value !== null && typeof value === 'object' && !Array.isArray( value );
	}

	function exactKeys( value, keys ) {
		return object( value ) && Reflect.ownKeys( value ).length === keys.length &&
			keys.every( ( key ) => Object.hasOwn( value, key ) );
	}

	function detach( value, ancestors = new Set(), depth = 0 ) {
		if ( depth > 64 ) {
			throw unavailable();
		}
		if ( value === null || typeof value === 'string' || typeof value === 'boolean' ) {
			return value;
		}
		if ( typeof value === 'number' && Number.isFinite( value ) &&
			( !Number.isInteger( value ) || Number.isSafeInteger( value ) ) ) {
			return value;
		}
		if ( typeof value !== 'object' || ancestors.has( value ) ||
			( !Array.isArray( value ) && Object.getPrototypeOf( value ) !== Object.prototype &&
				Object.getPrototypeOf( value ) !== null ) ) {
			throw unavailable();
		}
		ancestors.add( value );
		const descriptors = Object.getOwnPropertyDescriptors( value );
		const result = Array.isArray( value ) ? [] : {};
		const keys = Reflect.ownKeys( descriptors );
		if ( Array.isArray( value ) && keys.length !== value.length + 1 ) {
			throw unavailable();
		}
		for ( const key of keys ) {
			if ( Array.isArray( value ) && key === 'length' ) {
				continue;
			}
			const descriptor = descriptors[ key ];
			if ( typeof key !== 'string' || unsafeKeys.has( key ) ||
				!Object.hasOwn( descriptor, 'value' ) || !descriptor.enumerable ||
				( Array.isArray( value ) && ( !/^(0|[1-9][0-9]*)$/.test( key ) ||
					Number( key ) >= value.length ) ) ) {
				throw unavailable();
			}
			result[ key ] = detach( descriptor.value, ancestors, depth + 1 );
		}
		ancestors.delete( value );
		return result;
	}

	function descriptorMatches( descriptor, pageId, revisionId, surfaceId ) {
		return exactKeys( descriptor, DESCRIPTOR_FIELDS ) && descriptor.pageId === pageId &&
			descriptor.revisionId === revisionId && descriptor.surfaceId === surfaceId &&
			typeof descriptor.owner === 'string' && descriptor.owner.length > 0;
	}

	function validBundle( bundle, revisionId, surfaceId ) {
		if ( !object( bundle ) || bundle.revisionId !== revisionId || !object( bundle.snapshot ) ||
			bundle.snapshot.schemaVersion !== 1 || !Array.isArray( bundle.snapshot.surfaces ) ||
			!( object( bundle.sourceGeometry ) ||
				( Array.isArray( bundle.sourceGeometry ) && bundle.sourceGeometry.length === 0 ) ) ) {
			return false;
		}
		const selected = bundle.snapshot.surfaces.filter( ( surface ) =>
			object( surface ) && surface.id === surfaceId );
		if ( selected.length !== 1 || ![ 'image', 'slide' ].includes( selected[ 0 ].kind ) ) {
			return false;
		}
		return Object.values( bundle.sourceGeometry ).every( ( geometry ) =>
			object( geometry ) && typeof geometry.width === 'number' && geometry.width > 0 &&
			typeof geometry.height === 'number' && geometry.height > 0 );
	}

	class PageOwnedWorkingCopyImportReadClient {
		/** @param {Object} api Injected MediaWiki-compatible API with get. */
		constructor( api ) {
			if ( !api || typeof api.get !== 'function' ) {
				throw unavailable();
			}
			this.api = api;
		}

		/**
		 * @param {Object} options Six native identity fields, not owner titles or capabilities.
		 * @return {Promise<Object>} Detached complete target/source descriptors and bundles.
		 */
		read( options ) {
			let captured;
			try {
				if ( !exactKeys( options, FIELDS ) ) {
					throw unavailable();
				}
				captured = {};
				for ( const field of FIELDS ) {
					captured[ field ] = options[ field ];
				}
				if ( !integer( captured.targetPageId ) || !integer( captured.targetBaseRevisionId ) ||
					!integer( captured.sourcePageId ) || !integer( captured.sourceRevisionId ) ||
					!member( captured.targetSurfaceId ) || !member( captured.sourceSurfaceId ) ||
					captured.targetPageId === captured.sourcePageId ) {
					throw unavailable();
				}
			} catch ( error ) {
				return Promise.reject( unavailable() );
			}
			return new Promise( ( resolve ) => {
				resolve( this.api.get( {
					action: 'layersworkingcopyimportread', formatversion: 2,
					targetpageid: captured.targetPageId, baserevid: captured.targetBaseRevisionId,
					targetsurface: captured.targetSurfaceId, sourcepageid: captured.sourcePageId,
					sourcerevid: captured.sourceRevisionId, sourcesurface: captured.sourceSurfaceId
				} ) );
			} ).then( ( response ) => {
				const safe = detach( response );
				const data = safe && safe.layersworkingcopyimportread;
				if ( safe.error || !exactKeys( data, [ 'target', 'source', 'targetBundle', 'sourceBundle' ] ) ||
					!descriptorMatches( data.target, captured.targetPageId,
						captured.targetBaseRevisionId, captured.targetSurfaceId ) ||
					!descriptorMatches( data.source, captured.sourcePageId,
						captured.sourceRevisionId, captured.sourceSurfaceId ) ||
					!validBundle( data.targetBundle, captured.targetBaseRevisionId, captured.targetSurfaceId ) ||
					!validBundle( data.sourceBundle, captured.sourceRevisionId, captured.sourceSurfaceId ) ) {
					throw unavailable();
				}
				return data;
			} ).catch( () => {
				throw unavailable();
			} );
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedWorkingCopyImportReadClient = PageOwnedWorkingCopyImportReadClient;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedWorkingCopyImportReadClient;
	}
}() );
