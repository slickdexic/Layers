/** Explicit native first-Save transport for an imported, previously absent PDF layer set. */
( function () {
	'use strict';
	const clients = new WeakMap(), confirmations = new WeakMap();
	const MAX_ID = 2147483647, MAX_BYTES = 2097152;
	const refused = new Set( [ 'missingparam', 'badtoken', 'outofrange', 'maxbytes', 'permissiondenied', 'ratelimited',
		'mustbeposted', 'layers-owner-edit-denied', 'layers-invalid-publication-request', 'layers-invalid-snapshot',
		'layers-source-unavailable', 'layers-edit-conflict', 'layers-revision-save-failed', 'layers-admission-unauthorized',
		'layers-slot-removal-denied', 'layers-content-not-renderable', 'layers-edit-filtered', 'layers-working-copy-import-unavailable' ] );
	const failure = code => Object.assign( new Error( code ), { code } );
	const invalid = () => failure( 'layers-invalid-publication-request' );
	const id = value => Number.isInteger( value ) && value > 0 && value <= MAX_ID;
	function fields( value, names ) {
		if ( !value || ![ Object.prototype, null ].includes( Object.getPrototypeOf( value ) ) ||
			Reflect.ownKeys( value ).length !== names.length ) throw invalid();
		const properties = Object.getOwnPropertyDescriptors( value ), result = {};
		for ( const name of names ) {
			const property = properties[ name ];
			if ( !property || !property.enumerable || !Object.hasOwn( property, 'value' ) ) throw invalid();
			result[ name ] = property.value;
		}
		return result;
	}
	function text( value, maximum ) {
		if ( typeof value !== 'string' ) throw invalid();
		for ( const character of value ) {
			const point = character.codePointAt( 0 ); if ( point >= 0xd800 && point <= 0xdfff ) throw invalid();
		}
		if ( new TextEncoder().encode( value ).length > maximum ) throw invalid();
		return value;
	}
	function capture( request ) {
		const value = fields( request, [ 'pageId', 'baseRevisionId', 'selection', 'snapshotJson', 'sources', 'summary' ] );
		if ( !id( value.pageId ) || !id( value.baseRevisionId ) ) throw invalid();
		const selection = fields( value.selection, [ 'start', 'expected' ] );
		if ( !Number.isInteger( selection.start ) || selection.start < 0 || selection.start > MAX_ID ) throw invalid();
		text( selection.expected, MAX_BYTES ); text( value.snapshotJson, MAX_BYTES ); text( value.summary, MAX_BYTES );
		if ( !selection.expected || !value.snapshotJson || Array.from( value.summary ).length > 500 ) throw invalid();
		const array = value.sources;
		if ( !Array.isArray( array ) || Object.getPrototypeOf( array ) !== Array.prototype || array.length < 1 || array.length > 32 ||
			Reflect.ownKeys( array ).length !== array.length + 1 ) throw invalid();
		const sources = [], seen = new Set();
		for ( let index = 0; index < array.length; index++ ) {
			const property = Object.getOwnPropertyDescriptor( array, String( index ) );
			if ( !property || !property.enumerable || !Object.hasOwn( property, 'value' ) ) throw invalid();
			const source = fields( property.value, [ 'sourcePageId', 'sourceRevisionId', 'sourceSurfaceId' ] );
			if ( !id( source.sourcePageId ) || source.sourcePageId === value.pageId || !id( source.sourceRevisionId ) ||
				typeof source.sourceSurfaceId !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test( source.sourceSurfaceId ) ) throw invalid();
			const key = JSON.stringify( source ); if ( !seen.has( key ) ) { seen.add( key ); sources.push( source ); }
		}
		return { pageId: value.pageId, baseRevisionId: value.baseRevisionId, selection,
			snapshotJson: value.snapshotJson, sources, summary: value.summary };
	}
	function postMethod( api ) {
		for ( let object = api; object; object = Object.getPrototypeOf( object ) ) {
			const property = Object.getOwnPropertyDescriptor( object, 'postWithToken' );
			if ( property ) {
				if ( !Object.hasOwn( property, 'value' ) || typeof property.value !== 'function' ) throw invalid();
				return property.value;
			}
		}
		throw invalid();
	}
	function mapped( raw, result ) {
		let code = typeof raw === 'string' ? raw : null;
		try { for ( const candidate of [ raw, result ] ) {
			if ( !candidate || typeof candidate !== 'object' ) continue;
			const properties = Object.getOwnPropertyDescriptors( candidate ), nested = properties.error;
			const values = nested && Object.hasOwn( nested, 'value' ) && nested.value && typeof nested.value === 'object' ?
				Object.getOwnPropertyDescriptors( nested.value ) : properties;
			if ( values.code && Object.hasOwn( values.code, 'value' ) && typeof values.code.value === 'string' ) code = values.code.value;
		} } catch ( ignored ) { code = null; }
		return failure( refused.has( code ) ? code : 'layers-publication-outcome-unknown' );
	}
	class PageOwnedMissingPdfImportPublishClient {
		constructor( api ) { clients.set( this, { api, post: postMethod( api ) } ); }

		publish( request ) {
			let value;
			try { value = capture( request ); } catch ( ignored ) { return Promise.reject( invalid() ); }
			const state = clients.get( this ); if ( !state ) return Promise.reject( invalid() );
			const dto = { action: 'layersmissingpdfimportpublish', targetpageid: value.pageId, baserevid: value.baseRevisionId,
				embedstart: value.selection.start, embedtext: value.selection.expected, data: value.snapshotJson,
				importsources: JSON.stringify( value.sources ), summary: value.summary };
			return new Promise( ( resolve, reject ) => {
				try {
					const pending = state.post.call( state.api, 'csrf', dto );
					if ( pending && typeof pending.then === 'function' ) pending.then( resolve, ( code, result ) => reject( mapped( code, result ) ) );
					else resolve( pending );
				} catch ( error ) { reject( mapped( error ) ); }
			} ).then( response => {
				if ( !response || ![ Object.prototype, null ].includes( Object.getPrototypeOf( response ) ) ) throw failure( 'layers-publication-outcome-unknown' );
				const properties = Object.getOwnPropertyDescriptors( response );
				if ( properties.error ) {
					if ( !Object.hasOwn( properties.error, 'value' ) ) throw failure( 'layers-publication-outcome-unknown' );
					throw mapped( { error: properties.error.value } );
				}
				const payload = properties.layersmissingpdfimportpublish;
				if ( !payload || !Object.hasOwn( payload, 'value' ) ) throw failure( 'layers-publication-outcome-unknown' );
				let output; try { output = fields( payload.value, [ 'version', 'result', 'revid' ] ); }
				catch ( ignored ) { throw failure( 'layers-publication-outcome-unknown' ); }
				if ( output.version !== 1 || output.result !== 'Success' || !id( output.revid ) || output.revid <= value.baseRevisionId ) {
					throw failure( 'layers-publication-outcome-unknown' );
				}
				const proof = Object.freeze( { revisionId: output.revid } );
				confirmations.set( proof, { client: this, request: JSON.stringify( value ) } ); return proof;
			} ).catch( error => { throw mapped( error ); } );
		}

		/** Only this actual client's completed request can acknowledge the exact captured publication. */
		static isConfirmationFor( proof, client, request ) {
			try {
				const stored = confirmations.get( proof );
				return !!stored && stored.client === client && stored.request === JSON.stringify( capture( request ) );
			} catch ( ignored ) { return false; }
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedMissingPdfImportPublishClient = PageOwnedMissingPdfImportPublishClient;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedMissingPdfImportPublishClient;
}() );
