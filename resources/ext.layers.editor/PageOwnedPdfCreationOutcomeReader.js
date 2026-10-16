/** Read-only current PDF creation outcome inspection; no callers or writes are activated. */
( function () {
	'use strict';
	const unavailable = () => Object.assign( new Error( 'layers-editor-session-unavailable' ), { code: 'layers-editor-session-unavailable' } );
	const positive = value => Number.isInteger( value ) && value > 0 && value <= 2147483647;
	function classes() {
		return typeof module !== 'undefined' && module && typeof module.require === 'function' ? {
			Store: require( './StateManager.js' ), Session: require( './PageOwnedEditorSession.js' ),
			Adapter: require( './PageOwnedSnapshotAdapter.js' ), Transaction: require( './PageOwnedPdfCreationTransaction.js' ),
			Ids: require( './PageOwnedPdfWorkingSet.js' )
		} : { Store: window.Layers.Core.StateManager, Session: window.Layers.Editor.PageOwnedEditorSession,
			Adapter: window.Layers.Editor.PageOwnedSnapshotAdapter, Transaction: window.Layers.Editor.PageOwnedPdfCreationTransaction,
			Ids: window.Layers.Editor.PageOwnedPdfWorkingSet };
	}
	function canonical( value ) {
		if ( Array.isArray( value ) ) return '[' + value.map( canonical ).join( ',' ) + ']';
		if ( value && typeof value === 'object' ) return '{' + Object.keys( value ).sort()
			.map( key => JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		return JSON.stringify( value );
	}
	const equal = ( left, right ) => canonical( left ) === canonical( right );
	const title = value => typeof value === 'string' ? value.replace( /_/g, ' ' ) : null;
	class PageOwnedPdfCreationOutcomeReader {
		/** Classification is point-in-time evidence, never permission to retry or to clear a hold. */
		static async inspect( input, dependencies, guard, extraPages = [] ) {
			const { Store, Session, Adapter, Transaction, Ids } = classes(), evidence = Store.copyWorkingCopyValue( input );
			const pagesInput = Store.copyWorkingCopyValue( extraPages ), draft = evidence && evidence.draft, attempt = evidence && evidence.attempt;
			const creation = draft && draft.creation, target = creation && creation.target, anchor = creation && creation.anchorSurface;
			if ( !target || !anchor || !attempt || attempt.version !== 1 || !positive( attempt.sequence ) ||
				attempt.baseRevisionId !== target.revisionId || !positive( draft.pageCount ) || draft.pageCount > 100 ||
				!positive( draft.activePage ) || draft.activePage > draft.pageCount || !attempt.snapshot || !Array.isArray( attempt.snapshot.surfaces ) ||
				!draft.snapshot || !Array.isArray( draft.snapshot.surfaces ) || !Array.isArray( pagesInput ) || pagesInput.length > 100 ||
				typeof guard !== 'function' || !dependencies ) throw unavailable();
			const methods = [ [ dependencies.api, 'get' ], [ dependencies.creationReader, 'read' ], [ dependencies.reader, 'read' ], [ dependencies.pdfReader, 'read' ] ]
				.map( ( [ object, key ] ) => Store.captureWorkingCopyMethod( object, key ) );
			const dependenciesObservation = Store.observeWorkingCopyObject( dependencies, false );
			const check = () => {
				Store.checkWorkingCopyMethods( methods ); Store.checkWorkingCopyObservation( dependenciesObservation );
				const result = guard(); if ( result !== undefined ) { Promise.resolve( result ).catch( () => {} ); throw unavailable(); }
				Store.checkWorkingCopyMethods( methods ); Store.checkWorkingCopyObservation( dependenciesObservation );
			};
			const read = async ( object, request ) => { check(); const result = await object.read( request ); check(); return Store.copyWorkingCopyValue( result ); };
			const current = async () => {
				check(); const response = Store.copyWorkingCopyValue( await dependencies.api.get( { action: 'query', prop: 'revisions', titles: target.owner,
					rvprop: 'ids|content|contentmodel', rvslots: 'main', rvlimit: 1, formatversion: 2, maxage: 0, smaxage: 0 } ) ); check();
				const pages = response && !response.error && response.query && !response.query.redirects && response.query.pages;
				const page = Array.isArray( pages ) && pages.length === 1 && pages[ 0 ];
				const revisions = page && !Object.hasOwn( page, 'missing' ) && !Object.hasOwn( page, 'invalid' ) && page.revisions;
				const revision = Array.isArray( revisions ) && revisions.length === 1 && revisions[ 0 ], main = revision && revision.slots && revision.slots.main;
				if ( !page || page.pageid !== target.pageId || title( page.title ) !== title( target.owner ) || !revision ||
					!positive( revision.revid ) || !Number.isInteger( revision.parentid ) || revision.parentid < 0 || revision.parentid > 2147483647 || revision.parentid >= revision.revid || revision.revid < target.revisionId ||
					[ 'texthidden', 'suppressed', 'contenthidden' ].some( key => Object.hasOwn( revision, key ) || ( main && Object.hasOwn( main, key ) ) ) ||
					!main || main.contentmodel !== 'wikitext' || typeof main.content !== 'string' ) throw unavailable();
				return { pageId: page.pageid, owner: title( page.title ), revisionId: revision.revid, parentId: revision.parentid, mainText: main.content };
			};
			let session;
			try {
				const first = await current();
				const wanted = new Set( [ anchor.source.page, draft.activePage, ...pagesInput ] );
				const baseLength = creation.baseBundle ? creation.baseBundle.snapshot.surfaces.length : 0;
				for ( const snapshot of [ draft.snapshot, attempt.snapshot ] ) for ( const member of snapshot.surfaces.slice( baseLength ) ) {
					if ( !member || !member.source ) throw unavailable(); wanted.add( member.source.page );
				}
				if ( wanted.size > 100 || Array.from( wanted ).some( page => !positive( page ) || page > draft.pageCount ) ) throw unavailable();
				let outcome = 'changed';
				const sameMain = first.mainText === creation.mainText;
				if ( first.revisionId === target.revisionId && sameMain ) {
					const request = page => ( { ...target, selection: creation.selection, page } );
					for ( let pass = 0; pass < 2; pass++ ) for ( const page of wanted ) {
						const prepared = await read( dependencies.creationReader, request( page ) );
						const identity = { ...prepared }; delete identity.context;
						if ( !equal( identity, creation ) ) throw unavailable();
						const model = new Transaction( prepared, { reader: dependencies.creationReader, publisher: { publish() { throw unavailable(); } } } );
						try { if ( model.getStatus().pageCount !== draft.pageCount || model.getStatus().page !== page ) throw unavailable(); }
						finally { model.dispose(); }
					}
					outcome = 'base-current';
				} else if ( first.revisionId > target.revisionId && first.parentId === target.revisionId && sameMain ) {
					const binding = 'v1:' + target.pageId + ':' + target.surfaceId;
					const request = page => ( { owner: target.owner, revisionId: first.revisionId, binding, page } );
					const initial = await read( dependencies.pdfReader, request( anchor.source.page ) );
					let stored;
					const reader = { read: async options => {
						const bundle = await read( dependencies.reader, options );
						if ( !bundle || bundle.revisionId !== first.revisionId || ( stored && !equal( stored, bundle.snapshot ) ) ) throw unavailable();
						stored = bundle.snapshot; return bundle;
					} };
					session = new Session( { owner: target.owner, pageId: target.pageId, revisionId: first.revisionId,
						surfaceId: target.surfaceId, pdfContext: initial }, { reader, adapter: new Adapter(), publisher: { publish() { throw unavailable(); } } } );
					await session.load(); check();
					if ( initial.pageCount !== draft.pageCount || initial.label !== anchor.label || !equal( initial.surface.source, anchor.source ) ) throw unavailable();
					const contexts = new Map();
					for ( let pass = 0; pass < 2; pass++ ) for ( const page of wanted ) {
						const context = await read( dependencies.pdfReader, request( page ) );
						session.selectPdfPage( context );
						if ( ( contexts.has( page ) && !equal( contexts.get( page ), context ) ) || ( !context.stored &&
							context.surface.id !== Ids.surfaceId( target.pageId, first.revisionId, anchor.source.fileTitle, anchor.label, page ) ) ) throw unavailable();
						contexts.set( page, context );
					}
					await session.revalidate(); check(); outcome = equal( stored, attempt.snapshot ) ? 'payload-current' : 'changed';
				}
				// An unchanged base is only current at check time; a delayed POST may still arrive afterward.
				if ( !equal( await current(), first ) ) throw unavailable(); check();
				return { version: 1, outcome, revisionId: first.revisionId, baseRevisionId: target.revisionId,
					attemptSequence: attempt.sequence, publicationRetried: false, holdCleared: false };
			} catch ( error ) { throw unavailable(); } finally { if ( session ) session.dispose(); }
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationOutcomeReader = PageOwnedPdfCreationOutcomeReader;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationOutcomeReader;
}() );
