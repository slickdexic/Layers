'use strict';

( function () {
	const MAX_ID = 2147483647;
	const SAFE_CODES = new Set( [ 'missingparam', 'outofrange', 'maxbytes', 'permissiondenied',
		'layers-reading-disabled', 'layers-revision-unavailable', 'layers-reading-failed' ] );
	const positive = value => Number.isInteger( value ) && value > 0 && value <= MAX_ID;
	const object = value => value !== null && typeof value === 'object' && !Array.isArray( value );
	const text = value => typeof value === 'string' && value.length > 0;
	const controls = value => Array.from( value ).some( character => character.charCodeAt( 0 ) < 32 );
	function failure( code ) {
		const error = new Error( code );
		error.code = code;
		return error;
	}
	function safeFailure( error ) {
		try {
			const code = typeof error === 'string' ? error : Array.isArray( error ) ? error[ 0 ] :
				error && ( error.code || ( error.error && error.error.code ) );
			return failure( SAFE_CODES.has( code ) ? code : 'layers-reading-failed' );
		} catch ( ignored ) {
			return failure( 'layers-reading-failed' );
		}
	}
	class PageOwnedPdfEditorReadClient {
		constructor( api ) {
			if ( !api || typeof api.get !== 'function' ) {
				throw failure( 'layers-invalid-read-request' );
			}
			this.api = api;
		}

		read( options ) {
			let owner, revisionId, binding, page, identity;
			try {
				if ( !object( options ) ) {
					throw failure( 'layers-invalid-read-request' );
				}
				( { owner, revisionId, binding, page } = options );
				identity = typeof binding === 'string' && /^v1:([1-9][0-9]*):([A-Za-z0-9_-]{1,64})$/.exec( binding );
				if ( !text( owner ) || owner.trim() !== owner || !positive( revisionId ) || !positive( page ) ||
					!identity || !positive( Number( identity[ 1 ] ) ) ) {
					throw failure( 'layers-invalid-read-request' );
				}
			} catch ( error ) {
				return Promise.reject( failure( 'layers-invalid-read-request' ) );
			}
			return new Promise( resolve => resolve( this.api.get( {
				action: 'layersread', formatversion: 2, owner, revid: revisionId, binding, editorpage: page
			} ) ) ).then( response => {
				if ( response && response.error ) {
					throw response;
				}
				// Prefer the registered browser dependency; only CommonJS modules can require a file.
				const Adapter = ( typeof window !== 'undefined' && window.Layers && window.Layers.Editor &&
					window.Layers.Editor.PageOwnedSnapshotAdapter ) ||
					( typeof module !== 'undefined' && module && typeof module.require === 'function' ?
						require( './PageOwnedSnapshotAdapter.js' ) : null );
				const adapter = new Adapter();
				const carrier = { id: 'context', kind: 'slide', canvas: {}, layers: [] };
				const data = adapter.withEditorState( { schemaVersion: 1, surfaces: [ carrier ],
					context: response.layersread.editor }, carrier.id, { canvas: {}, layers: [] } ).context;
				if ( !object( data ) || data.owner !== owner || data.revisionId !== revisionId ||
					data.binding !== binding || data.page !== page || !positive( data.pageId ) ||
					data.pageId !== Number( identity[ 1 ] ) || data.kind !== 'pdf' || !text( data.label ) ||
					!positive( data.pageCount ) || !positive( data.initialPage ) ||
					data.initialPage > data.pageCount || data.page > data.pageCount ||
					typeof data.stored !== 'boolean' || !Array.isArray( data.members ) ) {
					throw failure( 'layers-reading-failed' );
				}
				const ids = new Set();
				let previous = 0;
				for ( const member of data.members ) {
					if ( !object( member ) || !positive( member.page ) || member.page <= previous ||
						member.page > data.pageCount || !text( member.surfaceId ) || ids.has( member.surfaceId ) ) {
						throw failure( 'layers-reading-failed' );
					}
					previous = member.page;
					ids.add( member.surfaceId );
				}
				const initial = data.members.find( member => member.page === data.initialPage );
				const target = data.members.find( member => member.page === data.page );
				const surface = data.surface;
				adapter.toEditorState( { schemaVersion: 1, surfaces: [ surface ] }, surface.id );
				const source = surface.source;
				const geometry = data.sourceGeometry;
				const rendition = data.rendition;
				if ( !initial || initial.surfaceId !== identity[ 2 ] || surface.kind !== 'pdf' ||
					surface.label !== data.label || ( data.stored ? !target || target.surfaceId !== surface.id :
						target || ids.has( surface.id ) || surface.layers.length !== 0 ) ||
					!object( source ) || source.repository !== 'local' || !text( source.fileTitle ) ||
					!/^File:[^\s#]+$/.test( source.fileTitle ) || controls( source.fileTitle ) ||
					!text( source.timestamp ) || !/^\d{14}$/.test( source.timestamp ) ||
					!text( source.sha1 ) || !/^[a-z0-9]{31,40}$/.test( source.sha1 ) ||
					source.page !== data.page || !Number.isFinite( surface.canvas.width ) || surface.canvas.width <= 0 ||
					!Number.isFinite( surface.canvas.height ) || surface.canvas.height <= 0 ||
					!object( geometry ) || geometry.page !== data.page || !positive( geometry.width ) ||
					!positive( geometry.height ) || geometry.units !== 'file-handler-pixels' ||
					!object( rendition ) || !text( rendition.url ) ||
					!/^(?:https?:\/\/[^/\s]+\/|\/)[^\s]*$/.test( rendition.url ) || controls( rendition.url ) ||
					!positive( rendition.width ) || !positive( rendition.height ) ) {
					throw failure( 'layers-reading-failed' );
				}
				return data;
			} ).catch( error => {
				throw safeFailure( error );
			} );
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfEditorReadClient = PageOwnedPdfEditorReadClient;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedPdfEditorReadClient;
	}
}() );
