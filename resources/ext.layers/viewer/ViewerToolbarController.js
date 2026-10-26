/** Bounded viewer toolbar, overflow affordances and measured Fit geometry. */
( function () {
	'use strict';

	class ViewerToolbarController {
		constructor( lightbox ) {
			this.lightbox = lightbox;
			this.toolbar = lightbox.toolbar;
			this.pages = document.createElement( 'span' );
			this.pages.className = 'layers-lightbox-pages';
			this.toolbar.insertBefore( this.pages, lightbox.prevBtn );
			this.pages.append( lightbox.prevBtn, lightbox.pageIndicator, lightbox.nextBtn );
			this.cues = [ this.createCue( 'M3 9l3-3 3 3' ), this.createCue( 'M3 3l3 3 3-3' ) ];
			this.onUpdate = () => this.update();
			this.onFocus = ( e ) => this.reveal( e.target );
			this.toolbar.addEventListener( 'scroll', this.onUpdate );
			this.toolbar.addEventListener( 'focusin', this.onFocus );
			window.addEventListener( 'resize', this.onUpdate );
			if ( typeof ResizeObserver === 'function' ) {
				this.resizeObserver = new ResizeObserver( this.onUpdate );
				this.resizeObserver.observe( this.toolbar );
				this.resizeObserver.observe( lightbox.zoomIndicator );
			}
			if ( typeof MutationObserver === 'function' ) {
				this.mutationObserver = new MutationObserver( this.onUpdate );
				this.mutationObserver.observe( this.toolbar, {
					childList: true, characterData: true, subtree: true,
					attributes: true, attributeFilter: [ 'style', 'hidden' ]
				} );
			}
			this.update();
		}

		createCue( path ) {
			const cue = document.createElement( 'span' );
			cue.className = 'layers-lightbox-toolbar-cue';
			cue.setAttribute( 'aria-hidden', 'true' );
			const icon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			icon.setAttribute( 'viewBox', '0 0 12 12' );
			const arrow = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
			arrow.setAttribute( 'd', path );
			icon.appendChild( arrow );
			cue.appendChild( icon );
			this.lightbox.overlay.appendChild( cue );
			return cue;
		}

		update() {
			const box = this.lightbox;
			if ( !box ) {
				return;
			}
			const hidden = !( box.pageCount > 1 );
			if ( this.pages.hidden !== hidden ) {
				this.pages.hidden = hidden;
			}
			const bar = this.toolbar.getBoundingClientRect();
			const overlay = box.overlay.getBoundingClientRect();
			const overflow = this.toolbar.scrollHeight > this.toolbar.clientHeight + 1;
			this.cues[ 0 ].hidden = !overflow || this.toolbar.scrollTop <= 1;
			this.cues[ 1 ].hidden = !overflow ||
				this.toolbar.scrollTop + this.toolbar.clientHeight >= this.toolbar.scrollHeight - 1;
			this.cues.forEach( ( cue, i ) => {
				cue.style.left = ( bar.right - overlay.left - 16 ) + 'px';
				cue.style.top = ( ( i ? bar.bottom - 16 : bar.top + 2 ) - overlay.top ) + 'px';
			} );
			if ( box.panController ) {
				box.panController.update();
			}
		}

		reveal( target ) {
			if ( !target || !this.toolbar.contains( target ) ) {
				return;
			}
			const bar = this.toolbar.getBoundingClientRect();
			const control = target.getBoundingClientRect();
			if ( control.top < bar.top + 4 ) {
				this.toolbar.scrollTop -= bar.top + 4 - control.top;
			} else if ( control.bottom > bar.bottom - 4 ) {
				this.toolbar.scrollTop += control.bottom - bar.bottom + 4;
			}
			this.update();
		}

		/** Return available display space; it is unrelated to saved canvas units. */
		viewBounds( withPan ) {
			const box = this.lightbox;
			const viewport = box.overlay.getBoundingClientRect();
			const close = box.overlay.querySelector( '.layers-lightbox-close' ).getBoundingClientRect();
			const top = Math.max( viewport.top + 16, this.toolbar.getBoundingClientRect().bottom + 12, close.bottom + 12 );
			let bottom = viewport.bottom - 16;
			if ( withPan && box.panController ) {
				const strip = box.panController.strip;
				const hidden = strip.hidden;
				strip.hidden = false;
				bottom = Math.min( bottom, strip.getBoundingClientRect().top - 12 );
				strip.hidden = hidden;
			}
			return { left: viewport.left + 16, top, width: viewport.width - 32, height: bottom - top };
		}

		fit() {
			const box = this.lightbox;
			const stage = box.imageWrapper;
			const w = stage.offsetWidth;
			const h = stage.offsetHeight;
			let view = this.viewBounds( false );
			if ( !w || !h || view.width <= 0 || view.height <= 0 ) {
				return;
			}
			let zoom = Math.min( view.width / w, view.height / h );
			if ( zoom > 1 && box.panController ) {
				const panned = this.viewBounds( true );
				const pannedZoom = Math.min( panned.width / w, panned.height / h );
				if ( pannedZoom > 1 ) {
					view = panned;
					zoom = pannedZoom;
				} else {
					// At 100% the strip hides, avoiding a show/hide fit oscillation.
					zoom = 1;
				}
			}
			const media = stage.getBoundingClientRect();
			const cx = media.left + media.width / 2 - ( box.panX || 0 );
			const cy = media.top + media.height / 2 - ( box.panY || 0 );
			box.setZoom( zoom );
			box.panX = view.left + view.width / 2 - cx;
			box.panY = view.top + view.height / 2 - cy;
			box.applyTransform();
		}

		destroy() {
			this.toolbar.removeEventListener( 'scroll', this.onUpdate );
			this.toolbar.removeEventListener( 'focusin', this.onFocus );
			window.removeEventListener( 'resize', this.onUpdate );
			if ( this.resizeObserver ) {
				this.resizeObserver.disconnect();
			}
			if ( this.mutationObserver ) {
				this.mutationObserver.disconnect();
			}
			this.cues.forEach( ( cue ) => cue.remove() );
			this.lightbox = null;
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Viewer = window.Layers.Viewer || {};
	window.Layers.Viewer.ToolbarController = ViewerToolbarController;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ViewerToolbarController;
	}
}() );
