/** Approved working-copy Import UI. Native preparation/application remain authoritative. */
( function () {
	'use strict';
	let nextDialog = 0;

	class PageOwnedImportControl {
		constructor( options ) {
			if ( !options || [ 'getTarget', 'message', 'canImport', 'allocateId', 'onApplied' ].some( key => typeof options[ key ] !== 'function' ) ||
				!options.catalog || !options.coordinator || !Number.isInteger( options.maxLayers ) || options.maxLayers < 1 ) {
				throw new Error( 'layers-working-copy-import-unavailable' );
			}
			this.options = options; this.disposed = false; this.dialog = null; this.button = null;
			this.generation = 0; this.timer = null; this.handle = null; this.busy = null;
			this.opener = () => this.open(); this.keydown = event => this._keydown( event );
		}

		mount( parent, before ) {
			if ( this.disposed || this.button || !parent ) { throw new Error( 'layers-invalid-mount-target' ); }
			const button = document.createElement( 'button' ); button.type = 'button';
			button.className = 'layers-page-drawing-rename layers-page-import-button';
			button.textContent = this.options.message( 'layers-page-import-button' );
			button.addEventListener( 'click', this.opener ); parent.insertBefore( button, before || null ); this.button = button;
		}

		open() {
			if ( this.disposed || this.dialog || !this.options.canImport() ) { return; }
			const root = document.createElement( 'div' ), panel = document.createElement( 'div' ), title = document.createElement( 'h2' );
			root.className = 'layers-page-import-overlay'; panel.className = 'layers-page-import-dialog';
			panel.setAttribute( 'role', 'dialog' ); panel.setAttribute( 'aria-modal', 'true' );
			title.id = 'layers-page-import-title-' + ++nextDialog; title.textContent = this.options.message( 'layers-page-import-title' );
			panel.setAttribute( 'aria-labelledby', title.id );
			const input = document.createElement( 'input' ); input.type = 'search'; input.className = 'layers-page-import-search';
			input.setAttribute( 'aria-label', this.options.message( 'layers-page-import-search' ) );
			input.placeholder = this.options.message( 'layers-page-import-search' );
			const status = document.createElement( 'p' ); status.className = 'layers-page-import-status'; status.setAttribute( 'role', 'status' );
			const list = document.createElement( 'ul' ); list.className = 'layers-page-import-results';
			const decision = document.createElement( 'div' ); decision.className = 'layers-page-import-decision'; decision.hidden = true;
			const cancel = this._button( 'layers-page-import-cancel', () => this.close() ); cancel.classList.add( 'layers-page-import-cancel' );
			panel.append( title, input, status, list, decision, cancel ); root.appendChild( panel ); document.body.appendChild( root );
			this.dialog = { root, panel, input, status, list, decision, cancel }; this.generation++;
			input.addEventListener( 'input', () => { clearTimeout( this.timer ); this.timer = setTimeout( () => this._search( input.value ), 250 ); } );
			root.addEventListener( 'mousedown', event => { if ( event.target === root ) { this.close(); } } );
			document.addEventListener( 'keydown', this.keydown, true ); input.focus(); this._search( '' );
		}

		_button( key, action ) {
			const button = document.createElement( 'button' ); button.type = 'button';
			button.textContent = this.options.message( key ); button.addEventListener( 'click', action ); return button;
		}

		_current( dialog, generation ) { return !this.disposed && this.dialog === dialog && this.generation === generation; }

		async _search( search ) {
			if ( !this.dialog || this.busy || this.handle ) { return; }
			const dialog = this.dialog, generation = ++this.generation;
			dialog.list.textContent = ''; dialog.status.textContent = this.options.message( 'layers-page-import-searching' );
			try {
				const target = this.options.getTarget();
				const choices = await this.options.catalog.search( { search, target: target.match } );
				if ( !this._current( dialog, generation ) ) { return; }
				dialog.status.textContent = this.options.message( choices.length ? 'layers-page-import-choose' : 'layers-page-import-none' );
				for ( const choice of choices ) {
					const item = document.createElement( 'li' ), button = this._button( 'layers-page-import-button', () => this._choose( choice ) );
					button.textContent = this.options.message( 'layers-page-import-result', choice.label, choice.title );
					item.appendChild( button );
					if ( choice.kind === 'slide' ) {
						const size = document.createElement( 'span' ); size.textContent = this.options.message( 'layers-page-import-size', choice.canvas.width, choice.canvas.height ); item.appendChild( size );
					}
					dialog.list.appendChild( item );
				}
			} catch ( error ) { if ( this._current( dialog, generation ) ) { this._failure(); } }
		}

		_lock( value ) {
			if ( !this.dialog ) { return; }
			this.dialog.input.disabled = !!value;
			for ( const button of this.dialog.root.querySelectorAll( 'button' ) ) { button.disabled = !!value; }
			// Choosing/preparing has no live effects and may be canceled. Apply already has explicit approval.
			this.dialog.cancel.disabled = value === 'applying';
		}

		async _choose( choice ) {
			if ( !this.dialog || this.busy || !this.options.canImport() ) { return; }
			clearTimeout( this.timer ); const dialog = this.dialog, generation = ++this.generation;
			this.busy = 'preparing'; this._lock( this.busy ); dialog.status.textContent = this.options.message( 'layers-page-import-preparing' );
			let handle;
			try {
				const target = this.options.getTarget(), mode = target.layerCount === 0 ? 'empty' : 'append';
				handle = await this.options.coordinator.prepare( choice.source, { mode, maxLayers: this.options.maxLayers, allocateId: this.options.allocateId } );
				if ( !this._current( dialog, generation ) ) { this._release( handle ); return; }
				this.handle = handle; const preview = this.options.coordinator.inspect( handle ); this.busy = null;
				if ( mode === 'empty' ) { await this._apply( dialog, generation ); return; }
				this._decision( choice, target, preview );
			} catch ( error ) {
				if ( this._current( dialog, generation ) ) { this._release(); this.busy = null; this._failure(); }
				else if ( handle ) { this._release( handle ); }
			}
		}

		_decision( choice, target, preview ) {
			const dialog = this.dialog, message = this.options.message;
			dialog.panel.classList.add( 'is-deciding' );
			dialog.list.hidden = true; dialog.input.hidden = true; dialog.decision.hidden = false; dialog.decision.textContent = '';
			const info = document.createElement( 'p' );
			info.className = 'layers-page-import-summary';
			info.textContent = message( 'layers-page-import-confirm', preview.source.label, choice.title, target.name, target.owner );
			const warning = document.createElement( 'p' ); warning.className = 'layers-page-import-warning';
			warning.textContent = message( 'layers-page-import-replace-warning', target.layerCount ); dialog.decision.append( info, warning );
			if ( target.kind === 'slide' ) {
				const sizes = document.createElement( 'p' ); sizes.className = 'layers-page-import-size-note'; sizes.textContent = message( 'layers-page-import-slide-sizes',
					target.canvas.width, target.canvas.height, choice.canvas.width, choice.canvas.height ); dialog.decision.appendChild( sizes );
			}
			if ( preview.differentFileVersion ) { const notice = document.createElement( 'p' ); notice.className = 'layers-page-import-version-note'; notice.textContent = message( 'layers-page-import-file-version' ); dialog.decision.appendChild( notice ); }
			const note = document.createElement( 'p' ); note.className = 'layers-page-import-working-note'; note.textContent = message( 'layers-page-import-working-copy' ); dialog.decision.appendChild( note );
			const actions = document.createElement( 'div' ); actions.className = 'layers-page-import-actions';
			const append = this._button( 'layers-page-import-append', () => this._apply( dialog, this.generation ) ); append.className = 'layers-page-import-append';
			const replace = this._button( 'layers-page-import-replace', () => this._replace( choice ) ); replace.className = 'layers-page-import-replace';
			actions.append( append, replace ); dialog.decision.appendChild( actions ); dialog.status.textContent = '';
			this._lock( null ); dialog.input.disabled = true;
			if ( this.options.canImport() ) { dialog.cancel.focus(); }
		}

		async _replace( choice ) {
			if ( this.busy || !this.dialog || !this.options.canImport() ) { return; }
			const dialog = this.dialog, generation = ++this.generation;
			this.busy = 'preparing'; this._lock( this.busy ); this._release();
			try {
				const handle = await this.options.coordinator.prepare( choice.source, { mode: 'replace', maxLayers: this.options.maxLayers, allocateId: this.options.allocateId } );
				if ( !this._current( dialog, generation ) ) { this._release( handle ); return; }
				this.handle = handle; this.busy = null; await this._apply( dialog, generation );
			} catch ( error ) { if ( this._current( dialog, generation ) ) { this.busy = null; this._release(); this._failure(); } }
		}

		async _apply( dialog, generation ) {
			if ( this.busy || !this._current( dialog, generation ) || !this.handle || !this.options.canImport() ) { return; }
			this.busy = 'applying'; this._lock( this.busy ); dialog.status.textContent = this.options.message( 'layers-page-import-preparing' );
			try {
				await this.options.coordinator.apply( this.handle );
				if ( !this._current( dialog, generation ) ) { return; }
				this._release(); this.busy = null;
				this.options.onApplied(); this.close();
			} catch ( error ) { if ( this._current( dialog, generation ) ) { this.busy = null; this._release(); this._failure(); } }
		}

		_release( handle = this.handle ) {
			if ( handle ) { try { this.options.coordinator.release( handle ); } catch ( error ) {} }
			if ( handle === this.handle ) { this.handle = null; }
		}

		_failure() {
			if ( !this.dialog ) { return; }
			this.dialog.status.textContent = this.options.message( 'layers-page-import-failed' );
			this._lock( null ); this.dialog.cancel.focus();
		}

		_keydown( event ) {
			if ( !this.dialog ) { return; }
			if ( event.key === 'Escape' ) { event.preventDefault(); event.stopImmediatePropagation(); this.close(); }
			if ( event.key === 'Tab' ) {
				const controls = Array.from( this.dialog.root.querySelectorAll( 'input, button' ) ).filter( node => !node.disabled && !node.hidden && !node.closest( '[hidden]' ) );
				const first = controls[ 0 ], last = controls[ controls.length - 1 ];
				if ( controls.length && ( event.shiftKey ? document.activeElement === first : document.activeElement === last ) ) {
					event.preventDefault(); ( event.shiftKey ? last : first ).focus();
				}
				event.stopPropagation();
			}
		}

		close( force = false ) {
			if ( !this.dialog || ( this.busy === 'applying' && !force ) ) { return; }
			clearTimeout( this.timer ); this.generation++; this._release(); this.busy = null;
			document.removeEventListener( 'keydown', this.keydown, true ); this.dialog.root.remove(); this.dialog = null;
			if ( !this.disposed && this.button ) { this.button.focus(); }
		}

		dispose() {
			this.disposed = true; this.close( true );
			if ( this.button ) { this.button.removeEventListener( 'click', this.opener ); this.button.remove(); this.button = null; }
		}
	}

	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedImportControl = PageOwnedImportControl;
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedImportControl; }
}() );
