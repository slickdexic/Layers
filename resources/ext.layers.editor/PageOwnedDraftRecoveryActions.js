/** Approved Continue/Discard/Cancel decisions around the existing recovery transactions. */
( function () {
	'use strict';
	const intentKey = 'layers-page-owned-open-saved-v1';
	const failed = () => Object.assign( new Error( 'layers-draft-storage-failed' ), { code: 'layers-draft-storage-failed' } );

	// Read the native editor's JSON configuration without executing returned scripts.
	function configuration( html ) {
		const marker = '"wgLayersEditorInit":', offset = html.indexOf( marker );
		if ( offset < 0 ) throw failed();
		const start = html.indexOf( '{', offset + marker.length );
		let depth = 0, quoted = false, escaped = false;
		for ( let index = start; index < html.length; index++ ) {
			const character = html[ index ];
			if ( quoted ) {
				if ( escaped ) escaped = false;
				else if ( character === '\\' ) escaped = true;
				else if ( character === '"' ) quoted = false;
			} else if ( character === '"' ) quoted = true;
			else if ( character === '{' ) depth++;
			else if ( character === '}' && --depth === 0 ) return JSON.parse( html.slice( start, index + 1 ) );
		}
		throw failed();
	}

	class PageOwnedDraftRecoveryActions {
		constructor( manager, controller, dialog ) {
			this.manager = manager; this.editor = manager.editor; this.controller = controller; this.dialog = dialog;
			this.departing = false;
		}

		/** Only an exact native destination can consume this tab's pending confirmation. */
		consumeSavedOpen() {
			try {
				const storage = window.sessionStorage, raw = storage.getItem( intentKey );
				if ( raw === null ) return false;
				const value = JSON.parse( raw ), scope = this.controller.getRecoveryScope(), current = this.editor.config.pageOwned;
				storage.removeItem( intentKey );
				if ( storage.getItem( intentKey ) !== null || value.path !== window.location.pathname + window.location.search ||
					value.wiki !== scope.wiki || value.user !== scope.user ||
					value.owner !== scope.owner || value.surfaceId !== scope.surfaceId || value.revisionId !== current.revisionId ) return false;
				// Older versions already retired their reviewed copy before navigating.
				if ( value.receipt === undefined ) return true;
				const receipt = value.receipt, source = receipt.scope;
				if ( !source || source.wiki !== scope.wiki || source.user !== scope.user || source.owner !== scope.owner ||
					source.baseRevisionId > current.revisionId || !/^[0-9a-f]{64}$/.test( receipt.digest ) ||
					( receipt.writer !== null && !/^[0-9a-f]{32}$/.test( receipt.writer ) ) ) return false;
				this.pendingDiscard = value;
				return true;
			} catch ( error ) { return false; }
		}

		/** Called only after the authorized editor, its draft lifecycle and its controls are ready. */
		async finishSavedOpen( store ) {
			const pending = this.pendingDiscard;
			if ( !pending ) return;
			this.pendingDiscard = null;
			const guard = () => {
				if ( this.manager.editor !== this.editor || this.editor.isDestroyed || this.editor._closeCompleted ||
					this.disposed || this.departing ) throw failed();
				const scope = this.controller.getRecoveryScope(), current = this.editor.config.pageOwned;
				if ( current.readOnly || current.revisionId !== pending.revisionId || scope.surfaceId !== pending.surfaceId ||
					scope.wiki !== pending.wiki || scope.owner !== pending.owner || scope.user !== pending.user ) throw failed();
			};
			try {
				guard();
				await store.finishRecoveryDiscard( pending.receipt, guard );
			} catch ( error ) {
				guard();
				mw.notify( mw.msg( 'layers-page-draft-failed' ), { type: 'error' } );
				// Re-enter normal review with the retained backup. Keep any new edits
				// made here while the storage transaction was settling.
				if ( !this.editor.hasUnsavedChanges() ) this.leave( window.location.href );
			}
		}

		leave( url ) {
			this.departing = true;
			this.editor._closeCompleted = true;
			if ( this.editor.uiManager && this.editor.uiManager.container ) this.editor.uiManager.container.inert = true;
			window.location.assign( url );
		}

		cancel() {
			if ( this.disposed || !this.manager.editor || this.editor.isDestroyed ) return;
			if ( typeof this.editor.navigateBackToFileWithName === 'function' ) {
				this.departing = true; this.editor._closeCompleted = true;
				if ( this.editor.uiManager && this.editor.uiManager.container ) this.editor.uiManager.container.inert = true;
				this.editor.navigateBackToFileWithName( this.editor.filename ); return;
			}
			this.leave( mw.config.get( 'wgLayersReturnToUrl' ) || mw.util.getUrl( this.controller.getRecoveryScope().owner ) );
		}

		async choose( candidates, earlier = false ) {
			const choice = earlier ? await this.dialog.chooseEarlierCreation( candidates ) : await this.dialog.choose( candidates );
			if ( this.disposed || !this.manager.editor || this.editor.isDestroyed ) return choice;
			if ( earlier ? !choice || choice.selected === null : choice === null ) this.cancel();
			return choice;
		}

		async confirm( candidate, source ) {
			const editor = this.editor, config = editor.config, scope = this.controller.getRecoveryScope();
			const content = () => JSON.stringify( [ editor.stateManager.get( 'layers' ), ...[ 'slideCanvasWidth', 'slideCanvasHeight',
				'slideBackgroundColor', 'backgroundVisible', 'backgroundOpacity', 'baseWidth', 'baseHeight' ].map( key => editor.stateManager.get( key ) ),
				this.manager.pageOwnedBridge && this.manager.pageOwnedBridge.pdfCoordinator ? this.manager.pageOwnedBridge.pdfCoordinator.witness( true ) : null,
				!this.manager.pageOwnedBridge && this.manager.pageOwnedCreation && this.manager.pageOwnedCreation.host ?
					this.manager.pageOwnedCreation.host.getDraft() : null ] );
			const before = content();
			const guard = () => {
				if ( this.disposed || this.departing || this.manager.editor !== editor || editor.isDestroyed || editor._closeCompleted ||
					editor.config !== config || content() !== before ||
					JSON.stringify( this.controller.getRecoveryScope() ) !== JSON.stringify( scope ) ) {
					throw Object.assign( new Error( 'layers-editor-session-unavailable' ), { code: 'layers-editor-session-unavailable' } );
				}
			};
			const plan = this.controller.prepareRecoveryDiscard( source );
			while ( !this.departing ) {
				const decision = await this.dialog.decide( candidate );
				if ( this.disposed || !this.manager.editor || editor.isDestroyed ) return false;
				if ( decision !== 'continue' && decision !== 'discard' ) { this.cancel(); return false; }
				try {
					guard(); await plan.preflight(); guard();
					if ( decision === 'continue' ) return true;
					await this.discardAndOpen( plan, scope, guard ); return false;
				} catch ( error ) {
					if ( this.departing ) return false;
					if ( error.code === 'layers-editor-session-unavailable' ) throw error;
					mw.notify( mw.msg( 'layers-page-draft-failed' ), { type: 'error' } );
					if ( error.code === 'layers-draft-record-changed' ) { this.leave( window.location.href ); return false; }
				}
			}
			return false;
		}

		async discardAndOpen( plan, scope, guard ) {
			const response = await this.manager.api.get( { action: 'query', titles: scope.owner,
				prop: 'revisions', rvprop: 'ids', rvlimit: 1, format: 'json', formatversion: 2 } );
			guard(); const page = response.query && response.query.pages && response.query.pages[ 0 ];
			const revision = page && page.revisions && page.revisions[ 0 ].revid;
			if ( !Number.isInteger( revision ) || revision < 1 ) throw failed();
			const url = new URL( window.location.href ); url.searchParams.set( 'revid', String( revision ) );
			const result = await window.fetch( url.href, { credentials: 'same-origin', cache: 'no-store' } );
			guard(); if ( !result.ok ) throw failed();
			const init = configuration( await result.text() ); guard();
			const current = init && init.pageOwned;
			if ( !current || current.readOnly || current.owner !== scope.owner || !current.surfaceId || current.revisionId !== revision ) throw failed();
			const receipt = await plan.receipt();
			await plan.preflight(); guard();
			const storage = window.sessionStorage, intent = JSON.stringify( { path: url.pathname + url.search,
				wiki: scope.wiki, user: scope.user, owner: scope.owner, surfaceId: current.surfaceId, revisionId: revision, receipt } );
			storage.setItem( intentKey, intent ); if ( storage.getItem( intentKey ) !== intent ) throw failed();
			try {
				this.leave( url.href );
			} catch ( error ) {
				this.departing = false; this.editor._closeCompleted = false;
				if ( this.editor.uiManager && this.editor.uiManager.container ) this.editor.uiManager.container.inert = false;
				if ( storage.getItem( intentKey ) === intent ) storage.removeItem( intentKey );
				throw error;
			}
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedDraftRecoveryActions = PageOwnedDraftRecoveryActions;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedDraftRecoveryActions;
}() );
