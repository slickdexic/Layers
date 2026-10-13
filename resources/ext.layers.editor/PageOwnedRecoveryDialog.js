/** Accessible draft selection with text-only previews; never publishes or deletes drafts. */
( function () {
	'use strict';
	let sequence = 0;
	class PageOwnedRecoveryDialog {
		/** @param {Function} message Localized message lookup */
		constructor( message ) {
			this.message = message;
			this.close = null;
		}

		/** @param {Array} candidates Preview descriptors @return {Promise<?number>} */
		choose( candidates ) {
			return this._open( candidates, false );
		}

		/** Retain the cancelled choice so existing current-revision safeguards remain unchanged. */
		chooseEarlierCreation( candidates ) {
			let cancelled = null;
			return this._open( candidates, false, index => { cancelled = index; } )
				.then( selected => ( { selected, cancelled } ) );
		}

		/** @param {Object} candidate Inspected recovery state @return {Promise<boolean>} */
		confirm( candidate ) {
			return this._open( [ candidate ], true ).then( ( index ) => index === 0 );
		}

		/** @param {Array} candidates @param {boolean} confirm @return {Promise<?number>} @private */
		_open( candidates, confirm, onCancel ) {
			this.dispose();
			return new Promise( ( resolve ) => {
				const priorFocus = document.activeElement;
				const dialog = document.createElement( 'dialog' );
				dialog.className = 'layers-page-recovery';
				const title = document.createElement( 'h2' );
				title.id = 'layers-page-recovery-' + ++sequence;
				title.textContent = this.message( 'layers-page-draft-dialog-title' );
				dialog.setAttribute( 'aria-labelledby', title.id );
				const label = document.createElement( 'label' );
				label.textContent = this.message( 'layers-page-draft-dialog-select' );
				const select = document.createElement( 'select' );
				candidates.forEach( ( candidate, index ) => {
					const option = document.createElement( 'option' );
					option.value = String( index );
					option.textContent = this.message( candidate.earlierCreation ? 'layers-page-draft-dialog-earlier-number' :
						'layers-page-draft-dialog-number', candidate.earlierCreation ? candidate.earlierNumber : index + 1 );
					select.appendChild( option );
				} );
				label.appendChild( select );
				const intro = document.createElement( 'div' ); intro.className = 'layers-page-recovery-intro';
				intro.textContent = this.message( confirm ? 'layers-page-draft-dialog-confirm-intro' : 'layers-page-draft-dialog-choose-intro' );
				const badge = document.createElement( 'span' ); badge.className = 'layers-page-recovery-badge';
				badge.textContent = this.message( 'layers-page-draft-dialog-browser-badge' );
				const context = document.createElement( 'div' ); context.className = 'layers-page-recovery-context';
				label.hidden = confirm;
				const preview = document.createElement( 'pre' );
				preview.setAttribute( 'aria-live', 'polite' );
				const notice = document.createElement( 'p' ); notice.className = 'layers-page-recovery-notice';
				const noticeTitle = document.createElement( 'strong' );
				const noticeBox = document.createElement( 'div' ); noticeBox.className = 'layers-page-recovery-information';
				noticeBox.append( noticeTitle, notice );
				const warning = document.createElement( 'div' ); warning.className = 'layers-page-recovery-warning';
				const warningTitle = document.createElement( 'strong' ); warningTitle.textContent = this.message( 'layers-page-draft-dialog-check-title' );
				const warningText = document.createElement( 'div' ); warningText.textContent = this.message( 'layers-page-draft-dialog-check-body' );
				warning.append( warningTitle, warningText );
				const previewTitle = document.createElement( 'h3' ); previewTitle.textContent = this.message( 'layers-page-draft-dialog-preview-title' );
				const previewNote = document.createElement( 'div' ); previewNote.className = 'layers-page-recovery-preview-note';
				previewNote.textContent = this.message( 'layers-page-draft-dialog-preview-note' );
				const reminder = document.createElement( 'div' ); reminder.className = 'layers-page-recovery-reminder';
				reminder.textContent = this.message( 'layers-page-draft-dialog-save-reminder' );
				const cancellation = document.createElement( 'div' ); cancellation.className = 'layers-page-recovery-cancellation';
				const accept = document.createElement( 'button' );
				accept.type = 'button';
				accept.textContent = this.message( confirm ? 'layers-page-draft-dialog-restore' : 'layers-page-draft-dialog-review' );
				const cancel = document.createElement( 'button' );
				cancel.type = 'button';
				cancel.textContent = this.message( 'layers-page-draft-dialog-cancel' );
				const update = () => {
					const candidate = candidates[ Number( select.value ) ];
					const layers = candidate && candidate.editorState && candidate.editorState.layers;
					context.hidden = !( candidate && typeof candidate.label === 'string' );
					context.textContent = context.hidden ? '' : this.message( 'layers-page-draft-dialog-context', candidate.label );
					noticeTitle.hidden = !( candidate && candidate.earlierCreation );
					noticeTitle.textContent = this.message( 'layers-page-draft-dialog-earlier-title' );
					warning.hidden = !( candidate && candidate.publicationBlocked );
					cancellation.textContent = this.message( candidate && candidate.earlierCreation ? 'layers-page-draft-dialog-cancel-earlier' : 'layers-page-draft-dialog-cancel-current' );
					accept.disabled = !Array.isArray( layers );
					preview.textContent = Array.isArray( layers ) ? layers.slice( 0, 50 )
						.map( ( layer ) => layer && typeof layer.text === 'string' ? layer.text.slice( 0, 200 ) : '' )
						.filter( Boolean ).join( '\n' ).slice( 0, 2000 ) : '';
					if ( !preview.textContent && Array.isArray( layers ) ) { preview.textContent = this.message( 'layers-page-draft-dialog-preview-empty' ); }
					notice.textContent = this.message( accept.disabled ? 'layers-page-draft-dialog-unavailable' :
						candidate.earlierCreation ? 'layers-page-draft-dialog-earlier' :
							candidate.publicationBlocked ? 'layers-page-draft-blocked' : 'layers-page-draft-dialog-local' );
				};
				const finish = ( result ) => {
					if ( result === null && onCancel ) { onCancel( Number( select.value ) ); }
					this.close = null;
					dialog.close();
					dialog.remove();
					if ( priorFocus && priorFocus.isConnected ) {
						priorFocus.focus();
					}
					resolve( result );
				};
				select.addEventListener( 'change', update );
				accept.addEventListener( 'click', () => { if ( !accept.disabled ) { finish( Number( select.value ) ); } } );
				cancel.addEventListener( 'click', () => finish( null ) );
				dialog.addEventListener( 'cancel', ( event ) => { event.preventDefault(); finish( null ); } );
				const actions = document.createElement( 'div' ); actions.className = 'layers-page-recovery-actions'; actions.append( accept, cancel );
				accept.className = 'layers-page-recovery-primary';
				const header = document.createElement( 'div' ); header.className = 'layers-page-recovery-header'; header.append( badge, title, intro );
				const content = document.createElement( 'div' ); content.className = 'layers-page-recovery-content';
				content.append( label, context, noticeBox, warning, previewTitle, previewNote, preview, reminder, cancellation );
				dialog.append( header, content, actions );
				document.body.appendChild( dialog );
				this.close = () => finish( null );
				update();
				try {
					dialog.showModal();
					( confirm ? cancel : select ).focus();
				} catch ( error ) {
					this.close = null;
					dialog.remove();
					resolve( null );
				}
			} );
		}

		/** Cancel pending choices when the owning editor closes. */
		dispose() {
			if ( this.close ) {
				this.close();
			}
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedRecoveryDialog = PageOwnedRecoveryDialog;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedRecoveryDialog;
	}
}() );
