/** Isolate the full-screen editor while retaining its body-mounted dialogs. */
( function () {
	'use strict';
	const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex], [contenteditable="true"]';
	class EditorFocusBoundary {
		constructor( root ) {
			this.root = root;
			this.origin = document.activeElement;
			this.background = new Map();
			this.lastFocus = root;
			this.modalOrigins = new Map();
			root.tabIndex = -1;
			root.focus();
			this.sync = () => this.isolate();
			this.keydown = ( event ) => this.handleTab( event );
			this.resize = () => {
				const active = document.activeElement;
				if ( active !== root && root.contains( active ) && root.scrollHeight > root.clientHeight ) {
					active.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
				}
			};
			this.focusin = ( event ) => {
				const roots = this.scope();
				if ( roots.some( node => node.contains( event.target ) ) ||
					( event.target.closest( '[role="menu"]' ) && this.roots().some( node => node.contains( event.target ) ) ) ) {
					const modal = event.target.closest( '[aria-modal="true"], [role="menu"]' );
					if ( modal && !this.modalOrigins.has( modal ) ) { this.modalOrigins.set( modal, this.lastFocus ); }
					this.lastFocus = event.target;
				} else {
					this.focus( this.scope(), false );
				}
			};
			this.observer = new MutationObserver( this.sync );
			this.observer.observe( document.body, { childList: true } );
			document.addEventListener( 'keydown', this.keydown );
			document.addEventListener( 'focusin', this.focusin );
			window.addEventListener( 'resize', this.resize );
			this.isolate();
		}

		roots() {
			return Array.from( document.body.children ).filter( node => node === this.root ||
				Array.from( node.classList ).some( name => name.startsWith( 'layers-' ) ) ||
				node.matches( '.color-picker-dialog, .color-picker-overlay, .oo-ui-windowManager, input[type="color"], input[type="file"]' ) );
		}

		visible( node ) {
			return node.isConnected && !node.closest( '[inert], [hidden]' ) &&
				node.getClientRects().length > 0 && getComputedStyle( node ).visibility !== 'hidden';
		}

		isolate() {
			const roots = this.roots();
			for ( const node of document.body.children ) {
				if ( roots.includes( node ) || node.matches( 'script, style, link' ) || this.background.has( node ) ) { continue; }
				this.background.set( node, [ node.getAttribute( 'inert' ), node.getAttribute( 'aria-hidden' ) ] );
				node.setAttribute( 'inert', '' );
				node.setAttribute( 'aria-hidden', 'true' );
			}
			const modals = roots.flatMap( node => [ node, ...node.querySelectorAll( '[aria-modal="true"], [role="menu"]' ) ] )
				.filter( node => node.matches( '[aria-modal="true"], [role="menu"]' ) && this.visible( node ) );
			for ( const modal of modals ) {
				if ( !this.modalOrigins.has( modal ) ) { this.modalOrigins.set( modal, this.lastFocus ); }
			}
			for ( const [ modal, origin ] of this.modalOrigins ) {
				if ( !modals.includes( modal ) ) {
					this.modalOrigins.delete( modal );
					if ( document.activeElement === document.body && this.visible( origin ) ) { origin.focus(); }
				}
			}
		}

		scope() {
			const roots = this.roots();
			const modals = roots.flatMap( node => [ node, ...node.querySelectorAll( '[aria-modal="true"]' ) ] )
				.filter( node => node.getAttribute( 'aria-modal' ) === 'true' && this.visible( node ) );
			return modals.length ? [ modals[ modals.length - 1 ] ] : roots;
		}

		focus( roots, reverse ) {
			const controls = roots.flatMap( node => Array.from( node.querySelectorAll( FOCUSABLE ) ) )
				.filter( node => node.tabIndex >= 0 && !node.matches( ':disabled' ) && this.visible( node ) );
			const target = reverse ? controls[ controls.length - 1 ] : controls[ 0 ];
			const fallback = roots[ 0 ] || this.root;
			if ( !target ) { fallback.tabIndex = -1; }
			( target || fallback ).focus();
			return controls;
		}

		handleTab( event ) {
			if ( event.key !== 'Tab' || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey ) { return; }
			const roots = this.scope();
			const controls = roots.flatMap( node => Array.from( node.querySelectorAll( FOCUSABLE ) ) )
				.filter( node => node.tabIndex >= 0 && !node.matches( ':disabled' ) && this.visible( node ) );
			const active = document.activeElement;
			if ( !roots.some( node => node.contains( active ) ) || !controls.length ||
				active === ( event.shiftKey ? controls[ 0 ] : controls[ controls.length - 1 ] ) ) {
				event.preventDefault();
				this.focus( roots, event.shiftKey );
			}
		}

		destroy() {
			this.observer.disconnect();
			document.removeEventListener( 'keydown', this.keydown );
			document.removeEventListener( 'focusin', this.focusin );
			window.removeEventListener( 'resize', this.resize );
			for ( const [ node, values ] of this.background ) {
				[ 'inert', 'aria-hidden' ].forEach( ( name, i ) => {
					if ( values[ i ] === null ) { node.removeAttribute( name ); } else { node.setAttribute( name, values[ i ] ); }
				} );
			}
			this.background.clear();
			this.modalOrigins.clear();
			if ( this.origin && this.origin.isConnected ) { this.origin.focus(); }
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.UI = window.Layers.UI || {};
	window.Layers.UI.EditorFocusBoundary = EditorFocusBoundary;
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = EditorFocusBoundary; }
}() );
