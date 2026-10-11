/** Matching native source choices for image/slide working-copy Import; choices never grant authority. */
'use strict';

( function () {
	const state = new WeakMap();
	const hasOwn = ( value, key ) => Object.prototype.hasOwnProperty.call( value, key );
	const numericId = value => Number.isInteger( value ) && value > 0 && value <= 2147483647;
	const nonempty = value => typeof value === 'string' && value.trim().length > 0;
	const file = value => nonempty( value ) && value.startsWith( 'File:' ) && value.length > 5;
	const nameKey = value => value.replace( /[\s_]+/g, ' ' ).trim().toLowerCase();
	const byteLength = value => encodeURIComponent( value ).replace( /%[A-F\d]{2}|./g, 'x' ).length;

	function unavailable() {
		const error = new Error( 'layers-working-copy-import-unavailable' );
		error.code = 'layers-working-copy-import-unavailable';
		return error;
	}

	function fields( value, names ) {
		if ( !value || typeof value !== 'object' || Array.isArray( value ) ||
			![ Object.prototype, null ].includes( Object.getPrototypeOf( value ) ) ||
			Reflect.ownKeys( value ).length !== names.length ) {
			throw unavailable();
		}
		const result = {};
		for ( const name of names ) {
			const descriptor = Object.getOwnPropertyDescriptor( value, name );
			if ( !descriptor || !descriptor.enumerable || !hasOwn( descriptor, 'value' ) ) {
				throw unavailable();
			}
			result[ name ] = descriptor.value;
		}
		return result;
	}

	function member( value ) {
		const entry = fields( value, [ 'id', 'label', 'kind', 'canvas', 'fileTitle' ] );
		const canvas = fields( entry.canvas, [ 'width', 'height' ] );
		if ( !nonempty( entry.id ) || byteLength( entry.id ) > 128 || typeof entry.label !== 'string' ||
			![ 'image', 'slide' ].includes( entry.kind ) ||
			![ canvas.width, canvas.height ].every( n => Number.isFinite( n ) && n > 0 ) ||
			( entry.kind === 'image' ? !file( entry.fileTitle ) : entry.fileTitle !== null ) ) {
			throw unavailable();
		}
		return { ...entry, canvas };
	}

	class PageOwnedWorkingCopyImportCatalogClient {
		constructor( api ) {
			if ( !api || typeof api.get !== 'function' ) {
				throw unavailable();
			}
			state.set( this, { get: api.get.bind( api ), active: true, request: 0 } );
		}

		/**
		 * @param {Object} request Search and current working-copy matching fields; not admission
		 * @return {Promise<Array>} Detached metadata and four-field source choices for J116J
		 */
		async search( request ) {
			try {
				const current = state.get( this );
				if ( !current || !current.active ) { throw unavailable(); }
				const captured = fields( request, [ 'search', 'target' ] );
				const target = fields( captured.target, [ 'pageId', 'kind', 'label', 'fileTitle' ] );
				if ( typeof captured.search !== 'string' || byteLength( captured.search ) > 255 ||
					!numericId( target.pageId ) || typeof target.label !== 'string' ||
					![ 'image', 'slide' ].includes( target.kind ) ||
					( target.kind === 'image' ? !file( target.fileTitle ) : target.fileTitle !== null ) ) {
					throw unavailable();
				}
				const generation = ++current.request;
				const response = await current.get( { action: 'layersdrawings', purpose: 'import',
					search: captured.search.trim(), exclude: target.pageId, limit: 20, format: 'json', formatversion: 2 } );
				if ( !current.active || current.request !== generation ) { throw unavailable(); }
				const moduleResult = response && Object.getOwnPropertyDescriptor( response, 'layersdrawings' );
				if ( !moduleResult || !moduleResult.enumerable || !hasOwn( moduleResult, 'value' ) ) { throw unavailable(); }
				const result = fields( moduleResult.value, [ 'pages' ] );
				if ( !Array.isArray( result.pages ) || result.pages.length > 20 ) { throw unavailable(); }
				const pages = new Set(), choices = [];
				for ( const value of result.pages ) {
					const page = fields( value, [ 'title', 'owner', 'pageid', 'revid', 'drawings' ] );
					if ( !nonempty( page.title ) || !nonempty( page.owner ) || !numericId( page.pageid ) ||
						!numericId( page.revid ) || page.pageid === target.pageId || pages.has( page.pageid ) ||
						!Array.isArray( page.drawings ) ) { throw unavailable(); }
					pages.add( page.pageid );
					const members = new Set();
					for ( const data of page.drawings ) {
						const entry = member( data );
						if ( members.has( entry.id ) ) { throw unavailable(); }
						members.add( entry.id );
						if ( entry.kind !== target.kind || nameKey( entry.label ) !== nameKey( target.label ) ||
							( target.kind === 'image' && entry.fileTitle !== target.fileTitle ) ) { continue; }
						choices.push( { title: page.title, label: entry.label, kind: entry.kind,
							canvas: entry.canvas, fileTitle: entry.fileTitle,
							source: { owner: page.owner, pageId: page.pageid, revisionId: page.revid, surfaceId: entry.id } } );
					}
				}
				return choices;
			} catch ( error ) {
				throw unavailable();
			}
		}

		dispose() {
			const current = state.get( this );
			if ( current ) { current.active = false; current.request++; }
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.PageOwnedWorkingCopyImportCatalogClient = PageOwnedWorkingCopyImportCatalogClient;
	}
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedWorkingCopyImportCatalogClient; }
}() );
