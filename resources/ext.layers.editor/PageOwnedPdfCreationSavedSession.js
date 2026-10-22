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
		/** Convert inert creation history into the existing saved-PDF recovery contract. */
		static importHistory( input, current, timelines, remapping, creationPages ) {
			const { Store } = classes(), copy = Store.copyWorkingCopyValue, envelope = copy( input ), template = copy( current );
			if ( envelope.version !== 4 || !envelope.importHistory || envelope.importHistory.version !== 1 ||
				!Array.isArray( envelope.importHistory.groups ) || !envelope.importPublication || !template.scope ) throw unavailable();
			const anchor = envelope.draft.creation.anchorSurface, base = JSON.parse( template.scope.savedJson );
			const selected = member => member.kind === 'pdf' && member.source && member.source.fileTitle === anchor.source.fileTitle && member.label === anchor.label;
			const references = [ ...template.snapshot.surfaces.filter( selected ), ...template.temporary.map( row => row[ 1 ] ) ];
			const sources = capsule => capsule.sources.map( citation => {
				if ( citation.targetSurfaceId !== envelope.draft.creation.target.surfaceId ) throw unavailable();
				return { targetSurfaceId: template.scope.surfaceId, sourcePageId: citation.source.pageId,
					sourceRevisionId: citation.source.revisionId, sourceSurfaceId: citation.source.surfaceId };
			} );
			const checkpoint = capsule => {
				if ( !capsule || capsule.version !== 1 || !equal( capsule.draft.creation, envelope.draft.creation ) ||
					capsule.draft.pageCount !== envelope.draft.pageCount ) throw unavailable();
				const locals = capsule.draft.snapshot.surfaces.filter( selected ), next = copy( base );
				next.surfaces = next.surfaces.filter( member => !selected( member ) );
				for ( const row of remapping ) {
					const reference = references.find( member => member.id === row.surfaceId );
					const local = locals.find( member => member.source.page === row.page );
					const stored = base.surfaces.find( member => member.id === row.surfaceId );
					if ( !reference || local && ( !equal( fixed( local ), { ...fixed( reference ), id: local.id } ) ||
						local.canvas.width !== reference.canvas.width || local.canvas.height !== reference.canvas.height ) ) throw unavailable();
					if ( local ) next.surfaces.push( { ...copy( local ), id: row.surfaceId } );
					else if ( stored ) {
						const blank = creationPages.find( context => context.page === row.page ); if ( !blank ) throw unavailable();
						next.surfaces.push( { ...copy( reference ), canvas: copy( blank.surface.canvas ), layers: [] } );
					}
				}
				const values = new Map( next.surfaces.map( member => [ member.id, member ] ) );
				next.surfaces = template.snapshot.surfaces.flatMap( member => {
					const value = values.get( member.id ); values.delete( member.id ); return value ? [ value ] : [];
				} ).concat( Array.from( values.values() ) );
				const admissionRevisions = next.surfaces.filter( member => selected( member ) && !base.surfaces.some( value => value.id === member.id ) )
					.map( member => { const origin = template.admissions.find( row => row[ 0 ] === member.id ); if ( !origin ) throw unavailable();
						return origin[ 1 ].revisionId < template.scope.baseRevisionId ? { surfaceId: member.id, revisionId: origin[ 1 ].revisionId } : null; } )
					.filter( Boolean ).sort( ( left, right ) => left.surfaceId.localeCompare( right.surfaceId ) );
				return { snapshot: next, temporary: copy( template.temporary ), admissions: copy( template.admissions ), sources: sources( capsule ), admissionRevisions };
			};
			const markSaved = ( timeline, page ) => {
				const result = copy( timeline ), saved = base.surfaces.find( member => selected( member ) && member.source.page === page );
				result.lastSaveHistoryIndex = -1;
				if ( saved ) for ( let index = result.history.length - 1; index >= 0; index-- ) if ( equal( result.history[ index ].layers, saved.layers ) ) {
					result.lastSaveHistoryIndex = index; break;
				}
				return result;
			};
			const groups = envelope.importHistory.groups.flatMap( group => {
				const entries = [], before = [], after = []; let retired = false;
				for ( const row of group.entries ) {
					const timeline = timelines.get( row.page ); if ( !timeline ) throw unavailable();
					const found = timeline.history.flatMap( ( entry, index ) => entry.pdfImportGroup && entry.pdfImportGroup.id === group.id ? [ index ] : [] );
					if ( found.length > 1 ) throw unavailable(); if ( !found.length ) { retired = true; continue; }
					const index = found[ 0 ]; if ( !equal( timeline.history[ index ], row.entry ) ) throw unavailable();
					entries.push( { page: row.page, entry: copy( row.entry ) } );
					if ( index < 1 ) { retired = true; continue; }
					if ( !equal( timeline.history[ index - 1 ], row.previous ) ) throw unavailable();
					before.push( { page: row.page, timeline: markSaved( { ...timeline, history: timeline.history.slice( 0, index ), historyIndex: index - 1 }, row.page ) } );
					after.push( { page: row.page, timeline: markSaved( { ...timeline, history: timeline.history.slice( 0, index + 1 ), historyIndex: index }, row.page ) } );
				}
				if ( !entries.length ) return [];
				return [ { id: group.id, phase: group.phase, retired, entries,
					checkpoints: retired ? null : { before: checkpoint( group.before ), after: checkpoint( group.after ) },
					timelines: retired ? null : { pages: entries.map( row => row.page ), before, after } } ];
			} );
			const live = checkpoint( envelope.importPublication.capsule );
			if ( !equal( live.snapshot, template.snapshot ) ) throw unavailable();
			return { format: 'layers-whole-pdf-import-draft', version: 1, session: { ...template, ...live },
				history: { version: 1, activePage: template.pdf.page,
					timelines: Array.from( timelines, ( [ page, timeline ] ) => ( { page, timeline: markSaved( timeline, page ) } ) ), groups } };
		}

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
						...( Object.getOwnPropertyDescriptor( reader, 'api' ) && Object.hasOwn( Object.getOwnPropertyDescriptor( reader, 'api' ), 'value' ) ?
							{ api: Object.getOwnPropertyDescriptor( reader, 'api' ).value } : {} ),
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
