/** Explicit native Import read for a missing PDF layer set. No editor callers are activated. */
( function () {
	'use strict';
	const instances = new WeakMap();
	const fail = () => Object.assign( new Error( 'layers-working-copy-import-unavailable' ),
		{ code: 'layers-working-copy-import-unavailable' } );
	const positive = value => Number.isInteger( value ) && value > 0 && value <= 2147483647;
	const object = value => value !== null && typeof value === 'object' && !Array.isArray( value );
	const keys = ( value, expected ) => object( value ) && Object.keys( value ).length === expected.length &&
		expected.every( key => Object.hasOwn( value, key ) );
	const nameKey = value => value.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
	function canonical( value ) {
		if ( Array.isArray( value ) ) return '[' + value.map( canonical ).join( ',' ) + ']';
		if ( object( value ) ) return '{' + Object.keys( value ).sort().map( key =>
			JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		return JSON.stringify( value );
	}
	const equal = ( left, right ) => canonical( left ) === canonical( right );
	function types() {
		return typeof module !== 'undefined' && module && typeof module.require === 'function' ? {
			Adapter: require( './PageOwnedSnapshotAdapter.js' ), Transaction: require( './PageOwnedPdfCreationTransaction.js' ),
			Source: require( './PageOwnedWholePdfImportReadClient.js' )
		} : { Adapter: window.Layers.Editor.PageOwnedSnapshotAdapter,
			Transaction: window.Layers.Editor.PageOwnedPdfCreationTransaction, Source: window.Layers.Editor.PageOwnedWholePdfImportReadClient };
	}
	function clone( record, value ) {
		return record.adapter.toEditorState( { schemaVersion: 1, surfaces: [ {
			id: 'missing-pdf-import-copy', kind: 'slide', canvas: { value }, layers: []
		} ] }, 'missing-pdf-import-copy' ).canvas.value;
	}
	function identifier( value ) {
		if ( typeof value !== 'string' || !value ) return false;
		encodeURIComponent( value );
		return new TextEncoder().encode( value ).length <= 128;
	}
	function descriptor( value ) {
		return keys( value, [ 'owner', 'pageId', 'revisionId', 'surfaceId' ] ) && positive( value.pageId ) &&
			positive( value.revisionId ) && identifier( value.surfaceId ) && typeof value.owner === 'string' &&
			!!value.owner && value.owner.trim() === value.owner;
	}
	function request( record, input ) {
		const value = clone( record, input );
		if ( !keys( value, [ 'target', 'selection', 'source' ] ) || !descriptor( value.target ) || !descriptor( value.source ) ||
			value.target.pageId === value.source.pageId || value.target.owner === value.source.owner ||
			!keys( value.selection, [ 'start', 'expected' ] ) || !Number.isInteger( value.selection.start ) ||
			value.selection.start < 0 || value.selection.start > 2147483647 ||
			typeof value.selection.expected !== 'string' || !value.selection.expected ) throw fail();
		encodeURIComponent( value.selection.expected );
		if ( new TextEncoder().encode( value.selection.expected ).length > 2097152 ) throw fail();
		return value;
	}
	// JSON syntax is checked first; equivalent escaped object names still count as duplicates.
	function uniqueKeys( json ) {
		const stack = [];
		for ( let i = 0; i < json.length; i++ ) {
			const char = json[ i ];
			if ( char === '"' ) {
				const start = i++;
				while ( json[ i ] !== '"' ) { if ( json[ i ] === '\\' ) i++; i++; }
				let next = i + 1;
				while ( /\s/u.test( json[ next ] || '' ) ) next++;
				if ( json[ next ] === ':' ) {
					const key = JSON.parse( json.slice( start, i + 1 ) ), seen = stack[ stack.length - 1 ];
					if ( seen.has( key ) ) throw fail();
					seen.add( key );
				}
			} else if ( char === '{' || char === '[' ) stack.push( char === '{' ? new Set() : null );
			else if ( char === '}' || char === ']' ) stack.pop();
		}
	}
	function decode( record, response ) {
		const safe = clone( record, response ), envelope = safe && safe.layersmissingpdfimportread;
		if ( !object( safe ) || Object.hasOwn( safe, 'error' ) || !keys( envelope, [ 'version', 'data' ] ) ||
			envelope.version !== 1 || typeof envelope.data !== 'string' ) throw fail();
		for ( let i = 0; i < envelope.data.length; i++ ) if ( envelope.data.charCodeAt( i ) > 127 ) throw fail();
		const result = JSON.parse( envelope.data ); uniqueKeys( envelope.data );
		return clone( record, result );
	}
	function check( client, record, generation ) {
		if ( instances.get( client ) !== record || !record.active || record.generation !== generation ||
			record.api.post !== record.post || record.Source.validateSourcePreparation !== record.validateSource ) throw fail();
	}
	function validate( record, value, input ) {
		if ( !keys( value, [ 'targetAdmission', 'source', 'sourceBundle', 'sourceGroup' ] ) ||
			!equal( value.source, input.source ) ) throw fail();
		const target = value.targetAdmission;
		if ( !keys( target, [ 'target', 'selection', 'hasLayersSlot', 'mainText', 'baseText', 'baseBundle',
			'label', 'initialPage', 'pageCount', 'source', 'pages' ] ) || !equal( target.target, input.target ) ||
			!equal( target.selection, input.selection ) || typeof target.mainText !== 'string' ||
			!positive( target.pageCount ) || target.pageCount > 100 || !positive( target.initialPage ) ||
			target.initialPage > target.pageCount || !Array.isArray( target.pages ) || target.pages.length !== target.pageCount ) throw fail();
		if ( !keys( target.source, [ 'repository', 'fileTitle', 'timestamp', 'sha1' ] ) ||
			target.source.repository !== 'local' || typeof target.source.timestamp !== 'string' ||
			!/^\d{14}$/.test( target.source.timestamp ) || typeof target.source.sha1 !== 'string' ||
			!/^[0-9a-z]{31}$/.test( target.source.sha1 ) ) throw fail();
		const timestamp = target.source.timestamp, date = new Date( timestamp.slice( 0, 4 ) + '-' + timestamp.slice( 4, 6 ) + '-' +
			timestamp.slice( 6, 8 ) + 'T' + timestamp.slice( 8, 10 ) + ':' + timestamp.slice( 10, 12 ) + ':' + timestamp.slice( 12, 14 ) + 'Z' );
		if ( !Number.isFinite( date.getTime() ) || date.toISOString().replace( /\D/g, '' ).slice( 0, 14 ) !== timestamp ) throw fail();
		const bytes = new TextEncoder().encode( target.mainText ), embed = new TextEncoder().encode( input.selection.expected );
		if ( input.selection.start + embed.length > bytes.length ||
			!embed.every( ( byte, index ) => byte === bytes[ input.selection.start + index ] ) ) throw fail();
		const anchor = target.pages[ target.initialPage - 1 ].surface;
		// Build only actual per-page creation admissions. Neither baseBundle nor baseText is augmented.
		for ( let i = 0; i < target.pages.length; i++ ) {
			const entry = target.pages[ i ];
			if ( !keys( entry, [ 'page', 'surface', 'sourceGeometry', 'rendition' ] ) || entry.page !== i + 1 ||
				!entry.surface || entry.surface.label !== target.label || !entry.surface.source ||
				!equal( entry.surface.source, { ...target.source, page: entry.page } ) ) throw fail();
			const preparation = { target: target.target, selection: target.selection, hasLayersSlot: target.hasLayersSlot,
				mainText: target.mainText, baseText: target.baseText, baseBundle: target.baseBundle, anchorSurface: anchor,
				context: { owner: target.target.owner, pageId: target.target.pageId, revisionId: target.target.revisionId,
					binding: 'v1:' + target.target.pageId + ':' + target.target.surfaceId, kind: 'pdf', label: target.label,
					initialPage: target.initialPage, pageCount: target.pageCount, page: entry.page, members: [], stored: false,
					surface: entry.surface, sourceGeometry: entry.sourceGeometry, rendition: entry.rendition } };
			const transaction = new record.Transaction( preparation, {
				reader: { read() { throw fail(); } }, publisher: { publish() { throw fail(); } }
			} );
			transaction.dispose();
		}
		record.validateSource.call( record.Source, value.source, value.sourceBundle, value.sourceGroup );
		if ( target.source.fileTitle !== value.sourceGroup.source.fileTitle ||
			nameKey( target.label ) !== nameKey( value.sourceGroup.label ) ||
			value.sourceGroup.members.some( member => member.page > target.pageCount ) ) throw fail();
		return value;
	}
	class PageOwnedMissingPdfImportReadClient {
		constructor( api ) {
			try {
				const { Adapter, Transaction, Source } = types();
				if ( !api || typeof api.post !== 'function' || typeof Source.validateSourcePreparation !== 'function' ) throw fail();
				instances.set( this, { api, post: api.post, adapter: new Adapter(), Transaction, Source,
					validateSource: Source.validateSourcePreparation, active: true, generation: 0 } );
			} catch ( error ) { throw fail(); }
		}
		/** Every selection and revalidation is a fresh native POST, never cached authority. */
		async read( input ) {
			try {
				const record = instances.get( this );
				if ( !record || !record.active ) throw fail();
				const generation = ++record.generation, captured = request( record, input );
				check( this, record, generation );
				const response = await record.post.call( record.api, { action: 'layersmissingpdfimportread', formatversion: 2,
					targetpageid: captured.target.pageId, baserevid: captured.target.revisionId,
					embedstart: captured.selection.start, embedtext: captured.selection.expected,
					sourcepageid: captured.source.pageId, sourcerevid: captured.source.revisionId, sourcesurface: captured.source.surfaceId } );
				check( this, record, generation );
				const result = validate( record, decode( record, response ), captured );
				check( this, record, generation ); return result;
			} catch ( error ) { throw fail(); }
		}
		dispose() { const record = instances.get( this ); if ( record ) { record.active = false; record.generation++; } }
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedMissingPdfImportReadClient = PageOwnedMissingPdfImportReadClient;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedMissingPdfImportReadClient;
}() );
