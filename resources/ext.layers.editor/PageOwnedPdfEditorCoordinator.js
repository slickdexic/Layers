( function () {
	'use strict';
	function canonical( value ) {
		if ( Array.isArray( value ) ) {
			return '[' + value.map( canonical ).join( ',' ) + ']';
		}
		if ( value && typeof value === 'object' ) {
			return '{' + Object.keys( value ).sort().map( key =>
				JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		}
		return JSON.stringify( value );
	}
	class PageOwnedPdfEditorCoordinator {
		constructor( bridge, reader ) {
			this.bridge = bridge;
			this.reader = reader;
			this.generation = 0;
			this.version = 0;
			this.timelines = new Map();
			this.stage = null;
			this.committing = false;
			this.recovering = false;
			this.unsubscribers = [];
		}

		initialize() {
			const editor = this.bridge.editor, pdf = this.bridge.session.getPdfStatus();
			editor.page = pdf.page;
			editor.pageCount = pdf.pageCount;
			this.timelines.set( pdf.page, editor.historyManager.captureTimeline() );
			for ( const key of [ 'layers', 'backgroundVisible', 'backgroundOpacity' ] ) {
				this.unsubscribers.push( editor.stateManager.subscribe( key, () => {
					if ( !this.committing && !this.bridge.disposed ) {
						this.version++;
						this.syncDirty();
					}
				} ) );
			}
		}

		syncDirty() {
			this.bridge.capture();
			const dirty = this.bridge.session.getStatus().dirty;
			this.bridge.editor.stateManager.set( 'isDirty', dirty );
			return dirty;
		}

		invalidate() {
			this.generation++;
			if ( this.recoveryOperation ) {
				this.bridge.session.cancelPreparedPdfDraft( this.recoveryOperation.handle || this.recoveryOperation.preparation );
				this.recoveryOperation = null;
				this.recovering = false;
			}
			if ( this.stage ) {
				this.stage.dispose();
				this.stage = null;
			}
		}

		witness( complete = false ) {
			const editor = this.bridge.editor;
			return canonical( { draft: this.bridge.session.getDraft(), live: this.bridge.getLiveState(),
				history: editor.historyManager.captureTimeline(), page: editor.page,
				url: window.location.href, imageUrl: editor.canvasManager.config.backgroundImageUrl,
				...( complete ? { dirty: editor.stateManager.get( 'isDirty' ), timelines: Array.from( this.timelines ),
					pageCount: editor.pageCount, editorImageUrl: editor.config.imageUrl,
					geometry: [ editor.canvasManager.baseWidth, editor.canvasManager.baseHeight,
						editor.stateManager.get( 'baseWidth' ), editor.stateManager.get( 'baseHeight' ) ] } : {} ) } );
		}

		assertReady() {
			const editor = this.bridge.editor, status = this.bridge.session.getStatus();
			if ( this.bridge.disposed || !this.bridge.loaded || this.bridge.saving || this.bridge.reconciling || this.recovering ||
				status.phase !== 'ready' || status.readOnly || editor.isDestroyed ||
				!editor.canvasManager || editor.canvasManager.isDestroyed ||
				!editor.historyManager || typeof editor.syncPageInUrl !== 'function' ||
				typeof editor.refreshPageControls !== 'function' ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			editor.historyManager.captureTimeline();
		}

		request( page ) {
			const draft = this.bridge.session.getDraft();
			return this.reader.read( { owner: draft.owner, revisionId: draft.baseRevisionId,
				binding: draft.pdf.binding, page } );
		}

		freshTimeline( state, saved = true ) {
			return this.bridge.editor.historyManager.copyTimeline( {
				history: [ { layers: state.layers, description: 'Initial state', timestamp: Date.now() } ],
				historyIndex: 0, lastSaveHistoryIndex: saved ? 0 : -1,
				maxHistorySteps: this.bridge.editor.historyManager.maxHistorySteps
			} );
		}

		captureDraftHistory() {
			const session = this.bridge.session, draft = session.getDraft();
			const anchor = draft.snapshot.surfaces.find( member => member.id === draft.surfaceId );
			const timelines = new Map( this.timelines );
			timelines.set( session.getPdfStatus().page, this.bridge.editor.historyManager.captureTimeline() );
			const members = Array.from( timelines, ( [ page, timeline ] ) => {
				const member = draft.snapshot.surfaces.find( surface => surface.kind === 'pdf' &&
					surface.label === anchor.label && surface.source.fileTitle === anchor.source.fileTitle &&
					surface.source.page === page ) || Array.from( session._pdf.temporary.values() )
					.find( surface => surface.source.page === page );
				if ( !member ) throw new Error( 'layers-invalid-page-owned-draft' );
				return { page, surfaceId: member.id, source: member.source,
					timeline: this.bridge.editor.historyManager.copyTimeline( timeline ) };
			} );
			return this.copyDraftHistory( { version: 1, owner: draft.owner,
				baseRevisionId: draft.baseRevisionId, surfaceId: draft.surfaceId,
				binding: draft.pdf.binding, pageCount: draft.pdf.pageCount, members }, draft );
		}

		copyDraftHistory( input, draft, contexts = null ) {
			const history = this.bridge.session._pdfCopy( input );
			const shape = ( value, keys ) => value && typeof value === 'object' && !Array.isArray( value ) &&
				Object.keys( value ).length === keys.length && keys.every( key =>
					Object.prototype.hasOwnProperty.call( value, key ) );
			const fail = () => { throw new Error( 'layers-invalid-page-owned-draft' ); };
			if ( !shape( history, [ 'version', 'owner', 'baseRevisionId', 'surfaceId', 'binding', 'pageCount', 'members' ] ) ||
				!draft.pdf || history.version !== 1 || history.owner !== draft.owner ||
				history.baseRevisionId !== draft.baseRevisionId || history.surfaceId !== draft.surfaceId ||
				history.binding !== draft.pdf.binding || history.pageCount !== draft.pdf.pageCount ||
				!Number.isInteger( history.pageCount ) || history.pageCount < 1 ||
				!Array.isArray( history.members ) || !history.members.length ) fail();
			const anchor = draft.snapshot.surfaces.find( member => member.id === draft.surfaceId );
			if ( !anchor || anchor.kind !== 'pdf' ) fail();
			const pages = new Set(), ids = new Set();
			for ( const member of history.members ) {
				if ( !shape( member, [ 'page', 'surfaceId', 'source', 'timeline' ] ) ||
					!Number.isInteger( member.page ) || member.page < 1 || member.page > history.pageCount ||
					pages.has( member.page ) || typeof member.surfaceId !== 'string' || !member.surfaceId ||
					ids.has( member.surfaceId ) || canonical( member.source ) !==
					canonical( { ...draft.pdf.original, page: member.page } ) ) fail();
				const stored = draft.snapshot.surfaces.find( surface => surface.kind === 'pdf' &&
					surface.label === anchor.label && surface.source.fileTitle === anchor.source.fileTitle &&
					surface.source.page === member.page );
				if ( stored && ( stored.id !== member.surfaceId || canonical( stored.source ) !== canonical( member.source ) ) ) fail();
				if ( !stored && contexts ) {
					const context = contexts.find( value => value.page === member.page );
					if ( !context || context.surface.id !== member.surfaceId ||
						canonical( context.surface.source ) !== canonical( member.source ) ) fail();
				}
				if ( !shape( member.timeline, [ 'history', 'historyIndex', 'lastSaveHistoryIndex', 'maxHistorySteps' ] ) ) fail();
				member.timeline = this.bridge.editor.historyManager.copyTimeline( member.timeline );
				if ( !member.timeline.history.length ) fail();
				pages.add( member.page );
				ids.add( member.surfaceId );
			}
			if ( !pages.has( draft.pdf.initialPage ) ) fail();
			return history;
		}

		async turn( page ) {
			let generation = this.generation;
			let stage;
			try {
				this.assertReady();
				this.invalidate();
				generation = this.generation;
				const editor = this.bridge.editor, session = this.bridge.session;
				const previous = session.getPdfStatus().page;
				this.bridge.capture();
				const witness = this.witness( true ), version = this.version;
				const image = editor.canvasManager.backgroundImage;
				const geometry = [ editor.canvasManager.canvas.width, editor.canvasManager.canvas.height ];
				const timeline = editor.historyManager.captureTimeline();
				const current = () => {
					this.assertReady();
					if ( generation !== this.generation || version !== this.version ||
						witness !== this.witness( true ) || image !== editor.canvasManager.backgroundImage ||
						geometry[ 0 ] !== editor.canvasManager.canvas.width ||
						geometry[ 1 ] !== editor.canvasManager.canvas.height || ( stage && this.stage !== stage ) ) {
						throw new Error( 'layers-page-load-failed' );
					}
				};
				const context = await this.request( page );
				current();
				stage = editor.canvasManager.stageExactBackground( context.rendition.url );
				this.stage = stage;
				await stage.promise;
				current();
				const draft = session.getDraft();
				const anchor = draft.snapshot.surfaces.find( member => member.id === draft.surfaceId );
				const member = draft.snapshot.surfaces.find( item => item.kind === 'pdf' &&
					item.label === anchor.label && item.source.fileTitle === anchor.source.fileTitle &&
					item.source.page === page ) || context.surface;
				const target = editor.historyManager.preflightTimeline( this.timelines.has( page ) ?
					this.timelines.get( page ) : this.freshTimeline( { layers: member.layers } ) );
				editor.canvasManager.preflightStagedBackground( stage );
				if ( stage.url !== context.rendition.url || stage.info.width !== context.rendition.width ||
					stage.info.height !== context.rendition.height ) {
					throw new Error( 'layers-page-load-failed' );
				}
				current();
				this.committing = true;
				try {
					const state = session.selectPdfPage( context );
					this.timelines.set( previous, timeline );
					this.bridge._applyState( state, false );
					editor.historyManager.restoreTimeline( target );
					editor.canvasManager.commitStagedBackground( stage );
					editor.config.imageUrl = context.rendition.url;
					editor.page = page;
					editor.pageCount = context.pageCount;
					editor.syncPageInUrl( page );
					editor.refreshPageControls();
					editor.stateManager.set( 'isDirty', session.getStatus().dirty );
				} finally {
					this.committing = false;
				}
				return true;
			} catch ( error ) {
				if ( !this.bridge.disposed && generation === this.generation ) {
					this.bridge.editor.notifyPdfPageNavigationFailure( page );
				}
				return false;
			} finally {
				if ( stage ) {
					stage.dispose();
					if ( this.stage === stage ) {
						this.stage = null;
					}
				}
			}
		}

		confirmBase() {
			const editor = this.bridge.editor, session = this.bridge.session;
			if ( session.getStatus().phase !== 'ready' || editor.historyManager.batchMode ) {
				return;
			}
			const active = session.getPdfStatus().page;
			this.timelines.set( active, editor.historyManager.captureTimeline() );
			const draft = session.getDraft(), anchor = draft.pdf.baseSnapshot.surfaces.find( member => member.id === draft.surfaceId );
			for ( const [ page, previous ] of this.timelines ) {
				const timeline = editor.historyManager.copyTimeline( previous );
				const member = draft.pdf.baseSnapshot.surfaces.find( surface => surface.kind === 'pdf' &&
					surface.label === anchor.label && surface.source.fileTitle === anchor.source.fileTitle && surface.source.page === page );
				timeline.lastSaveHistoryIndex = -1;
				if ( member ) {
					for ( let index = timeline.history.length - 1; index >= 0; index-- ) {
						if ( canonical( timeline.history[ index ].layers ) === canonical( member.layers ) ) {
							timeline.lastSaveHistoryIndex = index;
							break;
						}
					}
				}
				this.timelines.set( page, timeline );
			}
			editor.historyManager.restoreTimeline( this.timelines.get( active ) );
		}

		async restoreDraft( candidate ) {
			this.invalidate();
			this.assertReady();
			const editor = this.bridge.editor, session = this.bridge.session;
			candidate = session._pdfCopy( candidate );
			const pdf = session.getPdfStatus(), generation = this.generation, version = this.version;
			if ( pdf.page !== pdf.initialPage ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			this.bridge.capture();
			const witness = this.witness( true );
			const anchor = candidate.pdfDraft.snapshot.surfaces.find( member => member.id === candidate.pdfDraft.surfaceId );
			const history = candidate.pdfHistory === undefined ? null :
				this.copyDraftHistory( candidate.pdfHistory, candidate.pdfDraft );
			const preparedTimelines = new Map( history ? history.members.map( member => [ member.page,
				editor.historyManager.preflightTimeline( member.timeline ) ] ) : [] );
			const pages = new Set( [ pdf.initialPage ] );
			if ( history ) history.members.forEach( member => pages.add( member.page ) );
			for ( const member of candidate.pdfDraft.snapshot.surfaces ) {
				if ( member.kind === 'pdf' && member.label === anchor.label &&
					member.source.fileTitle === anchor.source.fileTitle ) {
					pages.add( member.source.page );
				}
			}
			this.recovering = true;
			const operation = {};
			this.recoveryOperation = operation;
			let stage, handle;
			const image = editor.canvasManager.backgroundImage;
			const current = () => {
				if ( this.bridge.disposed || editor.isDestroyed || editor.canvasManager.isDestroyed ||
					editor.historyManager.isDestroyed || editor.historyManager.batchMode ||
					this.bridge.saving || this.bridge.reconciling || this.recoveryOperation !== operation ||
					generation !== this.generation || version !== this.version || witness !== this.witness( true ) ||
					image !== editor.canvasManager.backgroundImage || session.getStatus().phase !== 'ready' ||
					session.getStatus().readOnly ||
					( stage && ( this.stage !== stage || !stage.ready || !editor.canvasManager.exactStages ||
						!editor.canvasManager.exactStages.has( stage ) ) ) ) {
					throw new Error( 'layers-editor-session-unavailable' );
				}
			};
			try {
				const contexts = [];
				for ( const page of pages ) {
					contexts.push( await this.request( page ) );
					current();
				}
				const initial = contexts.find( context => context.page === pdf.initialPage );
				stage = editor.canvasManager.stageExactBackground( initial.rendition.url );
				this.stage = stage;
				await stage.promise;
				current();
				if ( stage.info.width !== initial.rendition.width || stage.info.height !== initial.rendition.height ) {
					throw new Error( 'layers-page-load-failed' );
				}
				if ( history ) this.copyDraftHistory( history, candidate.pdfDraft, contexts );
				const timeline = history ? preparedTimelines.get( pdf.initialPage ) :
					this.freshTimeline( { layers: anchor.layers }, false );
				operation.preparation = session.preparePdfDraftWithHistory( candidate.pdfDraft, contexts );
				handle = await operation.preparation;
				operation.handle = handle;
				for ( const value of preparedTimelines.values() ) editor.historyManager.preflightTimeline( value );
				editor.historyManager.preflightTimeline( timeline );
				editor.canvasManager.preflightStagedBackground( stage );
				if ( stage.url !== initial.rendition.url || stage.info.width !== initial.rendition.width ||
					stage.info.height !== initial.rendition.height ) {
					throw new Error( 'layers-page-load-failed' );
				}
				current();
				this.committing = true;
				try {
					const state = session.commitPreparedPdfDraft( handle );
					this.timelines = preparedTimelines;
					this.bridge._applyState( state, false );
					editor.historyManager.restoreTimeline( timeline );
					editor.canvasManager.commitStagedBackground( stage );
					editor.config.imageUrl = initial.rendition.url;
					editor.page = pdf.initialPage;
					editor.pageCount = pdf.pageCount;
					editor.syncPageInUrl( pdf.initialPage );
					editor.refreshPageControls();
					editor.stateManager.set( 'isDirty', session.getStatus().dirty );
					if ( candidate.publicationBlocked ) {
						session.blockPublication();
					}
				} finally {
					this.committing = false;
				}
			} finally {
				session.cancelPreparedPdfDraft( handle || operation.preparation );
				if ( this.recoveryOperation === operation ) {
					this.recoveryOperation = null;
					this.recovering = false;
				}
				if ( stage ) {
					stage.dispose();
					if ( this.stage === stage ) this.stage = null;
				}
			}
		}

		dispose() {
			this.invalidate();
			this.unsubscribers.forEach( unsubscribe => unsubscribe() );
			this.unsubscribers = [];
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfEditorCoordinator = PageOwnedPdfEditorCoordinator;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedPdfEditorCoordinator;
	}
}() );