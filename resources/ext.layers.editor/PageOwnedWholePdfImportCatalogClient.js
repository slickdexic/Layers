/** Detached discovery choices for whole-PDF Import; choices never grant authority. */
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
		error.code = error.message;
		return error;
	}

	function fields( value, names ) {
		if ( !value || typeof value !== 'object' || Array.isArray( value ) ||
			![ Object.prototype, null ].includes( Object.getPrototypeOf( value ) ) || Reflect.ownKeys( value ).length !== names.length ) {
			throw unavailable();
		}
		const result = {};
		for ( const name of names ) {
			const descriptor = Object.getOwnPropertyDescriptor( value, name );
			if ( !descriptor || !descriptor.enumerable || !hasOwn( descriptor, 'value' ) ) { throw unavailable(); }
			result[ name ] = descriptor.value;
		}
		return result;
	}

	// Native JSON syntax is checked first; this pass rejects equivalent repeated object keys.
	function uniqueKeys( json ) {
		const stack = [];
		for ( let i = 0; i < json.length; i++ ) {
			const char = json[ i ];
			if ( char === '"' ) {
				const start = i++;
				while ( json[ i ] !== '"' ) {
					if ( json[ i ] === '\\' ) { i++; }
					i++;
				}
				let next = i + 1;
				while ( /\s/u.test( json[ next ] || '' ) ) { next++; }
				if ( json[ next ] === ':' ) {
					const key = JSON.parse( json.slice( start, i + 1 ) ), keys = stack[ stack.length - 1 ];
					if ( keys.has( key ) ) { throw unavailable(); }
					keys.add( key );
				}
			} else if ( char === '{' || char === '[' ) {
				stack.push( char === '{' ? new Set() : null );
			} else if ( char === '}' || char === ']' ) {
				stack.pop();
			}
		}
	}

	function ascii( value ) {
		for ( let i = 0; i < value.length; i++ ) {
			if ( value.charCodeAt( i ) > 127 ) { return false; }
		}
		return true;
	}

	function layerSet( value ) {
		const entry = fields( value, [ 'id', 'label', 'kind', 'canvas', 'fileTitle' ] );
		const canvas = fields( entry.canvas, [ 'width', 'height' ] );
		if ( typeof entry.id !== 'string' || !entry.id || byteLength( entry.id ) > 128 || typeof entry.label !== 'string' ||
			entry.kind !== 'pdf' || !file( entry.fileTitle ) || ![ canvas.width, canvas.height ].every( n => Number.isFinite( n ) && n > 0 ) ) {
			throw unavailable();
		}
		return { ...entry, canvas };
	}

	class PageOwnedWholePdfImportCatalogClient {
		constructor( api ) {
			if ( !api || typeof api.get !== 'function' ) { throw unavailable(); }
			state.set( this, { get: api.get.bind( api ), active: true, request: 0 } );
		}

		/** Return matching grouped metadata; the selected source is re-read by the native Import endpoint. */
		async search( request ) {
			try {
				const current = state.get( this );
				if ( !current || !current.active ) { throw unavailable(); }
				const captured = fields( request, [ 'search', 'target' ] );
				const target = fields( captured.target, [ 'pageId', 'kind', 'label', 'fileTitle' ] );
				if ( typeof captured.search !== 'string' || byteLength( captured.search ) > 255 || !numericId( target.pageId ) ||
					target.kind !== 'pdf' || typeof target.label !== 'string' || !file( target.fileTitle ) ) { throw unavailable(); }
				const search = captured.search.trim(), targetKey = nameKey( target.label ), generation = ++current.request;
				const response = await current.get( { action: 'layersworkingcopypdfimportcatalog', search,
					exclude: target.pageId, limit: 20, format: 'json', formatversion: 2 } );
				if ( !current.active || current.request !== generation ) { throw unavailable(); }
				const moduleResult = response && Object.getOwnPropertyDescriptor( response, 'layersworkingcopypdfimportcatalog' );
				if ( !moduleResult || !moduleResult.enumerable || !hasOwn( moduleResult, 'value' ) ) { throw unavailable(); }
				const envelope = fields( moduleResult.value, [ 'version', 'data' ] );
				if ( envelope.version !== 1 || typeof envelope.data !== 'string' || !ascii( envelope.data ) ) { throw unavailable(); }
				const decoded = JSON.parse( envelope.data ); uniqueKeys( envelope.data );
				const result = fields( decoded, [ 'pages' ] );
				if ( !Array.isArray( result.pages ) || result.pages.length > 20 ) { throw unavailable(); }
				const pageIds = new Set(), owners = new Set(), groups = new Set(), choices = [];
				for ( const value of result.pages ) {
					const page = fields( value, [ 'title', 'owner', 'pageid', 'revid', 'layerSets' ] );
					if ( !nonempty( page.title ) || !nonempty( page.owner ) || !numericId( page.pageid ) || !numericId( page.revid ) ||
						page.pageid === target.pageId || pageIds.has( page.pageid ) || owners.has( page.owner ) || !Array.isArray( page.layerSets ) ) {
						throw unavailable();
					}
					pageIds.add( page.pageid ); owners.add( page.owner );
					const ids = new Set();
					for ( const data of page.layerSets ) {
						const entry = layerSet( data ), groupKey = JSON.stringify( [ page.owner, entry.fileTitle, nameKey( entry.label ) ] );
						if ( ids.has( entry.id ) || groups.has( groupKey ) ) { throw unavailable(); }
						ids.add( entry.id ); groups.add( groupKey );
						if ( entry.fileTitle !== target.fileTitle || nameKey( entry.label ) !== targetKey ) { continue; }
						choices.push( { title: page.title, label: entry.label, kind: 'pdf', canvas: { ...entry.canvas }, fileTitle: entry.fileTitle,
							source: { owner: page.owner, pageId: page.pageid, revisionId: page.revid, surfaceId: entry.id } } );
					}
				}
				return choices;
			} catch ( error ) { throw unavailable(); }
		}

		dispose() {
			const current = state.get( this );
			if ( current ) { current.active = false; current.request++; }
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.PageOwnedWholePdfImportCatalogClient = PageOwnedWholePdfImportCatalogClient;
	}
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedWholePdfImportCatalogClient; }
}() );
