/** Reopen a retained creation backup against its real saved successor, without retrying Save. */
( function () {
	'use strict';
	const unavailable = () => Object.assign( new Error( 'layers-invalid-page-owned-draft' ), { code: 'layers-invalid-page-owned-draft' } );
	function load( name, core = false ) {
		return typeof module !== 'undefined' && module.require ? module.require( './' + name + '.js' ) :
			window.Layers[ core ? 'Core' : 'Editor' ][ name ];
	}
	function canonical( value ) {
		if ( Array.isArray( value ) ) return '[' + value.map( canonical ).join( ',' ) + ']';
		if ( value && typeof value === 'object' ) return '{' + Object.keys( value ).sort()
			.map( key => JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		return JSON.stringify( value );
	}
	const equal = ( left, right ) => canonical( left ) === canonical( right );
	class PageOwnedPdfCreationReloadRecovery {
		/** All serialized fields are inert. Current native reads and the saved application supply authority. */
		static async prepare( input, current, dependencies, assertCurrent ) {
			const Store = load( 'StateManager', true ), Saved = load( 'PageOwnedPdfCreationSavedSession' );
			const Binding = load( 'PageOwnedWholePdfImportSession' ), Client = load( 'PageOwnedMissingPdfImportPublishClient' );
			const Outcome = load( 'PageOwnedPdfCreationOutcomeReader' ), Ids = load( 'PageOwnedPdfWorkingSet' );
			const copy = Store.copyWorkingCopyValue, envelope = copy( input ), template = copy( current );
			const publication = envelope && envelope.importPublication, attempt = publication && publication.attempt;
			const creation = envelope && envelope.draft && envelope.draft.creation, target = creation && creation.target;
			const anchor = creation && creation.anchorSurface, scope = template && template.scope;
			if ( !target || !anchor || !scope || envelope.version !== 4 || publication.version !== 1 ||
				!attempt || ![ 1, 2 ].includes( attempt.version ) || !Number.isInteger( attempt.sequence ) || attempt.sequence < 1 ||
				![ 'ready', 'saving', 'conflict', 'uncertain', 'confirmed' ].includes( envelope.phase ) ||
				!equal( publication.capsule && publication.capsule.draft, envelope.draft ) ||
				!equal( attempt.capsule && attempt.capsule.draft.creation, creation ) ||
				target.pageId !== scope.pageId || target.owner !== scope.owner || target.surfaceId !== scope.surfaceId ||
				target.revisionId >= scope.baseRevisionId || typeof assertCurrent !== 'function' || !dependencies ) throw unavailable();
			const request = attempt.request, sent = request && JSON.parse( request.snapshotJson );
			if ( !request || request.pageId !== target.pageId || request.baseRevisionId !== target.revisionId ||
				!equal( sent, attempt.capsule.draft.snapshot ) || !equal( sent, JSON.parse( scope.savedJson ) ) ||
				( attempt.version === 1 ? !equal( request.selection, creation.selection ) : request.owner !== target.owner ) ) throw unavailable();
			const citations = attempt.capsule.sources;
			if ( !Array.isArray( citations ) || ( attempt.version === 1 ? !citations.length : citations.length !== 0 ) ) throw unavailable();
			if ( attempt.version === 1 ) {
				const sources = citations.map( citation => {
					if ( citation.targetSurfaceId !== target.surfaceId || !citation.source ) throw unavailable();
					return { sourcePageId: citation.source.pageId, sourceRevisionId: citation.source.revisionId, sourceSurfaceId: citation.source.surfaceId };
				} );
				if ( !equal( request.sources, Array.from( new Map( sources.map( value => [ canonical( value ), value ] ) ).values() ) ) ||
					!( dependencies.outcomeClient instanceof Client ) ) throw unavailable();
			}
			const observation = Store.observeWorkingCopyObject( dependencies, false );
			const methods = [ [ Saved, 'prepare' ], [ Saved, 'importHistory' ], [ Outcome, 'inspect' ], [ Ids, 'surfaceId' ],
				[ this, 'prepare' ], [ dependencies.reader, 'read' ], [ dependencies.pdfReader, 'read' ], [ dependencies.publisher, 'publish' ],
				...( attempt.version === 1 ? [ [ dependencies.outcomeClient, 'check' ], [ Client, 'isOutcomeConfirmationFor' ] ] :
					[ [ dependencies.api, 'get' ], [ dependencies.creationReader, 'read' ] ] ) ]
				.map( ( [ object, key ] ) => Store.captureWorkingCopyMethod( object, key ) );
			if ( attempt.version === 1 && methods.find( value => value.key === 'check' ).owner !== Client.prototype ) throw unavailable();
			let released = false, returned = false, prepared, binding;
			const check = () => {
				if ( released ) throw unavailable(); Store.checkWorkingCopyObservation( observation ); Store.checkWorkingCopyMethods( methods );
				const result = assertCurrent(); if ( result !== undefined ) { Promise.resolve( result ).catch( () => {} ); throw unavailable(); }
				Store.checkWorkingCopyObservation( observation ); Store.checkWorkingCopyMethods( methods );
			};
			const confirm = async () => {
				check();
				if ( attempt.version === 1 ) {
					const proof = await dependencies.outcomeClient.check( request, target.owner ); check();
					if ( !Client.isOutcomeConfirmationFor( proof, dependencies.outcomeClient, request, target.owner ) ||
						proof.revisionId !== scope.baseRevisionId ) throw unavailable();
				} else {
					const result = await Outcome.inspect( { draft: attempt.capsule.draft, attempt: { version: 1,
						sequence: attempt.sequence, baseRevisionId: target.revisionId, snapshot: sent } },
					{ api: dependencies.api, reader: dependencies.reader, pdfReader: dependencies.pdfReader, creationReader: dependencies.creationReader },
					check, envelope.history.members.map( member => member.page ) ); check();
					if ( result.outcome !== 'payload-current' || result.revisionId !== scope.baseRevisionId ) throw unavailable();
				}
			};
			try {
				check(); await confirm(); check();
				const blanks = [], pages = new Set( envelope.history.members.map( row => row.page ) );
				if ( pages.size !== envelope.history.members.length || pages.size > 100 ) throw unavailable();
				for ( const page of pages ) {
					const context = copy( await dependencies.pdfReader.read( { owner: target.owner, revisionId: scope.baseRevisionId,
						binding: 'v1:' + target.pageId + ':' + target.surfaceId, page } ) ); check();
					if ( context.page !== page || context.revisionId !== scope.baseRevisionId || context.pageCount !== envelope.draft.pageCount ||
						!equal( context.surface.source, { ...anchor.source, page } ) ) throw unavailable();
					// Creation pages shared the retained anchor's canvas defaults. Only page dimensions vary;
					// obtain those from the exact pinned native page, never from a thumbnail or another page.
					blanks.push( { page, surface: { ...copy( context.surface ), id: Ids.surfaceId( target.pageId, target.revisionId,
						anchor.source.fileTitle, anchor.label, page ), canvas: { ...copy( anchor.canvas ),
							width: context.surface.canvas.width, height: context.surface.canvas.height }, layers: [] } } );
				}
				prepared = await Saved.prepare( { version: 1, phase: 'confirmed', draft: envelope.draft, history: envelope.history,
					confirmation: { revisionId: scope.baseRevisionId, snapshot: sent }, publicationBlocked: false }, dependencies, check, blanks ); check();
				binding = new Binding( prepared.session, dependencies.importSource, dependencies.pdfReader );
				const converted = Saved.importHistory( envelope, binding.captureImportDraft(), prepared.timelines, prepared.remapping, blanks );
				const state = copy( prepared.state ); check();
				const plan = Object.freeze( { draft: copy( converted ), editorState: state, preflight: check,
					revalidate: async () => { check(); await prepared.revalidate(); check(); await confirm(); check(); },
					release: () => { if ( released ) return; released = true;
						try { binding.dispose(); } finally { prepared.session.dispose(); } } } );
				returned = true; return plan;
			} catch ( error ) { released = true; throw unavailable(); }
			finally { if ( !returned ) { if ( binding ) binding.dispose(); if ( prepared ) prepared.session.dispose(); } }
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationReloadRecovery = PageOwnedPdfCreationReloadRecovery;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationReloadRecovery;
}() );
