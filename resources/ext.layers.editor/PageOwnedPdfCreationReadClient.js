/** Exact, uncached read transport for the explicit missing-PDF creation transaction. */
( function () {
	'use strict';
	const positive = value => Number.isInteger( value ) && value > 0 && value <= 2147483647;
	const codes = new Set( [ 'missingparam', 'outofrange', 'maxbytes', 'permissiondenied',
		'mustbeposted', 'layers-revision-unavailable', 'layers-reading-failed' ] );
	const failure = code => Object.assign( new Error( code ), { code } );
	function safeFailure( error ) {
		try {
			const code = typeof error === 'string' ? error : Array.isArray( error ) ? error[ 0 ] :
				error && ( error.code || ( error.error && error.error.code ) );
			return failure( codes.has( code ) ? code : 'layers-reading-failed' );
		} catch ( ignored ) { return failure( 'layers-reading-failed' ); }
	}
	function classes() {
		return typeof module !== 'undefined' && module && typeof module.require === 'function' ? {
			Adapter: require( './PageOwnedSnapshotAdapter.js' ),
			Transaction: require( './PageOwnedPdfCreationTransaction.js' )
		} : { Adapter: window.Layers.Editor.PageOwnedSnapshotAdapter,
			Transaction: window.Layers.Editor.PageOwnedPdfCreationTransaction };
	}
	function clone( adapter, value ) {
		return adapter.toEditorState( { schemaVersion: 1, surfaces: [ {
			id: 'transport-copy', kind: 'slide', canvas: { value }, layers: []
		} ] }, 'transport-copy' ).canvas.value;
	}
	class PageOwnedPdfCreationReadClient {
		constructor( api ) {
			if ( !api || typeof api.post !== 'function' ) throw failure( 'layers-invalid-read-request' );
			this.api = api;
		}

		/** Every call reaches native admission; a preparation is never cached or a write token. */
		read( input ) {
			let options, adapter, Transaction;
			try {
				const types = classes(); adapter = new types.Adapter(); Transaction = types.Transaction;
				options = clone( adapter, input );
				if ( !options || typeof options.owner !== 'string' || !options.owner || options.owner.trim() !== options.owner ||
					!positive( options.pageId ) || !positive( options.revisionId ) ||
					typeof options.surfaceId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test( options.surfaceId ) ||
					!positive( options.page ) || options.page > 100 || !options.selection ||
					!Number.isInteger( options.selection.start ) || options.selection.start < 0 || options.selection.start > 2147483647 ||
					typeof options.selection.expected !== 'string' || !options.selection.expected ) throw failure( 'layers-invalid-read-request' );
			} catch ( error ) { return Promise.reject( failure( 'layers-invalid-read-request' ) ); }
			return new Promise( ( resolve, reject ) => {
				const request = this.api.post( { action: 'layerspdfcreationread', formatversion: 2,
					pageid: options.pageId, baserevid: options.revisionId, embedstart: options.selection.start,
					embedtext: options.selection.expected, pdfpage: options.page } );
				// MediaWiki deferreds supply (code, result); preserve safe codes, never diagnostic text.
				if ( request && typeof request.then === 'function' ) request.then( resolve, ( code, result ) =>
					reject( result && result.error ? result : code ) );
				else resolve( request );
			} ).then( response => {
				response = clone( adapter, response );
				if ( response && response.error ) throw response;
				const value = clone( adapter, response.layerspdfcreationread ), target = value && value.target;
				if ( !target || target.owner !== options.owner || target.pageId !== options.pageId ||
					target.revisionId !== options.revisionId || target.surfaceId !== options.surfaceId ||
					!value.selection || value.selection.start !== options.selection.start || value.selection.expected !== options.selection.expected ||
					!value.context || value.context.page !== options.page ) throw failure( 'layers-reading-failed' );
				// Reuse the model's strict preparation validation; this disposable instance never reads or publishes.
				const validation = new Transaction( value, { reader: this,
					publisher: { publish() { throw failure( 'layers-reading-failed' ); } } } );
				validation.dispose();
				return value;
			} ).catch( error => { throw safeFailure( error ); } );
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationReadClient = PageOwnedPdfCreationReadClient;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationReadClient;
}() );
