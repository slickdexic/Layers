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

		/** @param {Object} candidate Inspected recovery state @return {Promise<boolean>} */
		confirm( candidate ) {
			return this._open( [ candidate ], true ).then( ( index ) => index === 0 );
		}

		/** @param {Array} candidates @param {boolean} confirm @return {Promise<?number>} @private */
		_open( candidates, confirm ) {
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
					option.textContent = this.message( 'layers-page-draft-dialog-number', index + 1 );
					select.appendChild( option );
				} );
				label.appendChild( select );
				label.hidden = confirm;
				const preview = document.createElement( 'pre' );
				preview.setAttribute( 'aria-live', 'polite' );
				const notice = document.createElement( 'p' );
				const accept = document.createElement( 'button' );
				accept.type = 'button';
				accept.textContent = this.message( confirm ? 'layers-page-draft-dialog-restore' : 'layers-page-draft-dialog-review' );
				const cancel = document.createElement( 'button' );
				cancel.type = 'button';
				cancel.textContent = this.message( 'layers-page-draft-dialog-cancel' );
				const update = () => {
					const candidate = candidates[ Number( select.value ) ];
					const layers = candidate && candidate.editorState && candidate.editorState.layers;
					accept.disabled = !Array.isArray( layers );
					preview.textContent = Array.isArray( layers ) ? layers.slice( 0, 50 )
						.map( ( layer ) => layer && typeof layer.text === 'string' ? layer.text.slice( 0, 200 ) : '' )
						.filter( Boolean ).join( '\n' ).slice( 0, 2000 ) : '';
					notice.textContent = this.message( accept.disabled ? 'layers-page-draft-dialog-unavailable' :
						candidate.publicationBlocked ? 'layers-page-draft-blocked' : 'layers-page-draft-dialog-local' );
				};
				const finish = ( result ) => {
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
				dialog.append( title, label, preview, notice, accept, cancel );
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
