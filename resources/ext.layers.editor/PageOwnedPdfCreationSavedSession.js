/** Fresh native admission after a confirmed PDF first Save; no UI callers are activated. */
( function () {
	'use strict';
	const unavailable = () => Object.assign( new Error( 'layers-editor-session-unavailable' ), { code: 'layers-editor-session-unavailable' } );
	function classes() {
		return typeof module !== 'undefined' && module && typeof module.require === 'function' ? {
			Session: require( './PageOwnedEditorSession.js' ), Adapter: require( './PageOwnedSnapshotAdapter.js' ),
			Store: require( './StateManager.js' ), Ids: require( './PageOwnedPdfWorkingSet.js' )
		} : { Session: window.Layers.Editor.PageOwnedEditorSession, Adapter: window.Layers.Editor.PageOwnedSnapshotAdapter,
			Store: window.Layers.Core.StateManager, Ids: window.Layers.Editor.PageOwnedPdfWorkingSet };
	}
	function canonical( value ) {
		if ( Array.isArray( value ) ) return '[' + value.map( canonical ).join( ',' ) + ']';
		if ( value && typeof value === 'object' ) return '{' + Object.keys( value ).sort()
			.map( key => JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		return JSON.stringify( value );
	}
	const equal = ( left, right ) => canonical( left ) === canonical( right );
	const fixed = surface => { const result = { ...surface }; delete result.canvas; delete result.layers; return result; };
	class PageOwnedPdfCreationSavedSession {
		/** Prepare a real saved session privately. The caller owns the complete editor witness. */
		static async prepare( input, dependencies, guard, creationPages = [] ) {
			const { Session, Adapter, Store, Ids } = classes(), envelope = Store.copyWorkingCopyValue( input );
			const blanks = Store.copyWorkingCopyValue( creationPages ); if ( !Array.isArray( blanks ) ) throw unavailable();
			if ( typeof guard !== 'function' || !dependencies || !dependencies.reader || !dependencies.pdfReader ||
				!dependencies.publisher || typeof dependencies.publisher.publish !== 'function' ||
				!envelope || envelope.version !== 1 || envelope.phase !== 'confirmed' || envelope.publicationBlocked ||
				!envelope.confirmation || !envelope.draft || !envelope.history ) throw unavailable();
			const { draft, history, confirmation } = envelope, creation = draft.creation, target = creation && creation.target;
			const anchor = creation && creation.anchorSurface, revisionId = confirmation.revisionId;
			if ( !target || !anchor || !Number.isInteger( revisionId ) || revisionId <= target.revisionId || revisionId > 2147483647 ||
				!Number.isInteger( draft.pageCount ) || draft.pageCount < 1 || draft.pageCount > 100 ||
				!Number.isInteger( draft.activePage ) || draft.activePage < 1 || draft.activePage > draft.pageCount ||
				history.version !== 1 || !equal( history.creation, creation ) || history.pageCount !== draft.pageCount ||
				history.activePage !== draft.activePage || !Array.isArray( history.members ) || !history.members.length ) throw unavailable();
			const dependenciesObservation = Store.observeWorkingCopyObject( dependencies, false );
			const reader = dependencies.reader, pdfReader = dependencies.pdfReader, publisher = dependencies.publisher;
			const methods = [ [ dependencies.reader, 'read' ], [ dependencies.pdfReader, 'read' ], [ dependencies.publisher, 'publish' ] ]
				.map( ( [ object, key ] ) => Store.captureWorkingCopyMethod( object, key ) );
			const check = () => {
				Store.checkWorkingCopyMethods( methods ); Store.checkWorkingCopyObservation( dependenciesObservation );
				const result = guard();
				if ( result !== undefined ) { Promise.resolve( result ).catch( () => {} ); throw unavailable(); }
				Store.checkWorkingCopyMethods( methods ); Store.checkWorkingCopyObservation( dependenciesObservation );
			};
			check();
			const binding = 'v1:' + target.pageId + ':' + target.surfaceId;
			const pdfRead = async page => {
				check(); const context = Store.copyWorkingCopyValue( await pdfReader.read( {
					owner: target.owner, revisionId, binding, page } ) ); check(); return context;
			};
			let session, preparing = true;
			try {
				// Keep the existing saved-session admission: a real stored initial anchor, never a blank placeholder.
				const initial = await pdfRead( anchor.source.page ); check();
				session = new Session( { owner: target.owner, pageId: target.pageId, revisionId,
					surfaceId: target.surfaceId, pdfContext: initial }, { publisher, adapter: new Adapter(), reader: {
						read: async request => {
							if ( preparing ) check(); const bundle = Store.copyWorkingCopyValue( await reader.read( request ) );
							if ( preparing ) { check();
								if ( !bundle || bundle.revisionId !== revisionId || !equal( bundle.snapshot, confirmation.snapshot ) ) throw unavailable();
							}
							return bundle;
						}
					} } );
				await session.load(); check();
				if ( initial.pageCount !== draft.pageCount || !equal( initial.surface.source, anchor.source ) ||
					initial.surface.id !== anchor.id || initial.label !== anchor.label ) throw unavailable();
				const base = session.getDraft(), contexts = new Map( [ [ initial.page, initial ] ] );
				const oldBase = creation.baseBundle ? creation.baseBundle.snapshot : { schemaVersion: 1, surfaces: [] };
				const root = snapshot => { const result = { ...snapshot }; delete result.surfaces; return result; };
				if ( !equal( root( draft.snapshot ), root( oldBase ) ) ||
					!equal( draft.snapshot.surfaces.slice( 0, oldBase.surfaces.length ), oldBase.surfaces ) ||
					!equal( confirmation.snapshot.surfaces.slice( 0, oldBase.surfaces.length ), oldBase.surfaces ) ) throw unavailable();
				const added = draft.snapshot.surfaces.slice( oldBase.surfaces.length ), originals = new Map(), ids = new Set();
				for ( const member of history.members ) {
					if ( !member || !Number.isInteger( member.page ) || member.page < 1 || member.page > draft.pageCount ||
						originals.has( member.page ) || ids.has( member.surfaceId ) ||
						member.surfaceId !== Ids.surfaceId( target.pageId, target.revisionId, anchor.source.fileTitle, anchor.label, member.page ) ||
						!equal( member.source, { ...anchor.source, page: member.page } ) ) throw unavailable();
					originals.set( member.page, member ); ids.add( member.surfaceId );
					if ( !contexts.has( member.page ) ) contexts.set( member.page, await pdfRead( member.page ) ); check();
				}
				if ( !originals.has( draft.activePage ) || !originals.has( anchor.source.page ) || added.some( member =>
					!member.source || !originals.has( member.source.page ) || originals.get( member.source.page ).surfaceId !== member.id ) ) throw unavailable();
				const next = Store.copyWorkingCopyValue( base );
				const timelines = new Map(), remapping = [];
				for ( const [ page, member ] of originals ) {
					const context = contexts.get( page ); session.selectPdfPage( context );
					const timeline = Store.copyWorkingCopyValue( member.timeline ), local = added.find( surface => surface.id === member.surfaceId );
					const surface = context.surface, currentLayers = timeline.history && timeline.history[ timeline.historyIndex ];
					if ( !currentLayers || !equal( currentLayers.layers, local ? local.layers : [] ) ||
						( local && ( !equal( fixed( local ), { ...fixed( surface ), id: local.id } ) ||
							local.canvas.width !== surface.canvas.width || local.canvas.height !== surface.canvas.height ) ) ||
						!equal( surface.source, member.source ) ||
						( context.stored ? surface.id !== member.surfaceId :
							surface.id !== Ids.surfaceId( target.pageId, revisionId, anchor.source.fileTitle, anchor.label, page ) ) ) throw unavailable();
					if ( local ) {
						const value = { ...Store.copyWorkingCopyValue( surface ), canvas: local.canvas, layers: local.layers };
						const index = next.snapshot.surfaces.findIndex( value => value.id === surface.id );
						if ( index < 0 ) next.snapshot.surfaces.push( value ); else next.snapshot.surfaces[ index ] = value;
					}
					timeline.lastSaveHistoryIndex = -1;
					if ( context.stored ) for ( let index = timeline.history.length - 1; index >= 0; index-- ) {
						if ( equal( timeline.history[ index ].layers, surface.layers ) ) { timeline.lastSaveHistoryIndex = index; break; }
					}
					timelines.set( page, timeline );
					remapping.push( { page, previous: member.surfaceId, surfaceId: surface.id } );
				}
				// Current optional blanks disappear from the creation snapshot after Undo; a confirmed member still exists.
				for ( const surface of next.snapshot.surfaces.slice( oldBase.surfaces.length ) ) {
					if ( !originals.has( surface.source.page ) ) throw unavailable();
					const local = added.find( value => value.source.page === surface.source.page );
					if ( !local ) {
						const blank = blanks.find( value => value.surface && value.surface.source.page === surface.source.page );
						if ( !blank || !equal( blank.surface.layers, [] ) ||
							!equal( fixed( blank.surface ), fixed( surface ) ) || blank.surface.canvas.width !== surface.canvas.width ||
							blank.surface.canvas.height !== surface.canvas.height ) throw unavailable();
						surface.layers = []; surface.canvas = Store.copyWorkingCopyValue( blank.surface.canvas );
					}
				}
				next.pdf.activePage = draft.activePage;
				await session.restorePdfDraftWithHistory( next, Array.from( contexts.values() ) ); check();
				const context = contexts.get( draft.activePage ); session.selectPdfPage( context ); check();
				// Recheck every authorized page after private application, including history-only Redo pages.
				for ( const [ page, previous ] of contexts ) {
					if ( !equal( await pdfRead( page ), previous ) ) throw unavailable(); check();
				}
				return { session, state: session.getEditorState(), context, timelines, remapping, creationBackup: envelope,
					activate: () => { preparing = false; }, revalidate: async () => {
						await session.revalidate(); check();
						for ( const [ page, previous ] of contexts ) {
							if ( !equal( await pdfRead( page ), previous ) ) throw unavailable(); check();
						}
					} };
			} catch ( error ) { if ( session ) session.dispose(); throw unavailable(); }
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationSavedSession = PageOwnedPdfCreationSavedSession;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationSavedSession;
}() );
