/** Explicit empty PDF viewing; never queries legacy layers or pretends the set is stored. */
( function () {
	'use strict';
	const copy = value => JSON.parse( JSON.stringify( value ) );
	function canonical( value ) {
		if ( Array.isArray( value ) ) return '[' + value.map( canonical ).join( ',' ) + ']';
		if ( value && typeof value === 'object' ) return '{' + Object.keys( value ).sort()
			.map( key => JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		return JSON.stringify( value );
	}
	class PageOwnedPdfCreationViewerAdapter extends window.Layers.Viewer.PageOwnedViewerAdapter {
		constructor( options ) {
			const viewer = copy( options.viewer ), selection = copy( options.selection );
			if ( !viewer || viewer.kind !== 'pdf' || !Array.isArray( viewer.pages ) || viewer.pages.length !== 1 ||
				!viewer.pages[ 0 ].surface || !Array.isArray( viewer.pages[ 0 ].surface.layers ) ||
				viewer.pages[ 0 ].surface.layers.length || !/^[a-f0-9]{64}$/.test( viewer.sourceKey ) ||
				!Number.isInteger( viewer.pageId ) || viewer.pageId < 1 ||
				!Number.isInteger( viewer.revisionId ) || viewer.revisionId < 1 ||
				viewer.binding !== 'v1:' + viewer.pageId + ':' + viewer.pages[ 0 ].surface.id ||
				!selection || selection.pageId !== viewer.pageId || selection.revisionId !== viewer.revisionId ||
				!Number.isInteger( selection.start ) || selection.start < 0 ||
				typeof selection.expected !== 'string' || !selection.expected ) {
				throw new Error( 'layers-revision-unavailable' );
			}
			super( { api: options.api, bundle: { owner: viewer.owner, pageId: viewer.pageId,
				revisionId: viewer.revisionId, surface: viewer.pages[ 0 ].surface },
			binding: viewer.binding, pdfRenderer: options.pdfRenderer } );
			this.preview = viewer;
			this.selection = selection;
			this.validate( viewer );
		}

		read() {
			const selected = this.selection;
			return Promise.resolve().then( () => {
				if ( this.disposed ) throw this.unavailable();
				return this.api.post( { action: 'layerspdfcreationview', formatversion: 2,
					pageid: selected.pageId, baserevid: selected.revisionId,
					embedstart: selected.start, embedtext: selected.expected } );
			} ).then( response => {
				if ( this.disposed ) throw this.unavailable();
				const viewer = response && response.layerspdfcreationview;
				if ( canonical( viewer ) !== canonical( this.preview ) ) throw this.unavailable();
				return this.validate( viewer );
			} );
		}
	}
	window.Layers.Viewer.PageOwnedPdfCreationViewerAdapter = PageOwnedPdfCreationViewerAdapter;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationViewerAdapter;
}() );
