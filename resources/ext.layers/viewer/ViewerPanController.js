/** Touch and accessible non-drag panning for the full-size viewer. */
( function () {
	'use strict';

	class ViewerPanController {
		constructor( lightbox ) {
			this.lightbox = lightbox;
			this.stage = lightbox.imageWrapper;
			this.touch = null;
			this.blocked = false;
			this.createStrip();
			this.onStart = ( e ) => this.startTouch( e );
			this.onMove = ( e ) => this.moveTouch( e );
			this.onEnd = ( e ) => {
				this.cancelTouch();
				this.blocked = e.touches.length > 0;
			};
			this.onResize = () => {
				this.cancelTouch();
				this.update();
			};
			this.stage.addEventListener( 'touchstart', this.onStart, { passive: true } );
			this.stage.addEventListener( 'touchmove', this.onMove, { passive: false } );
			this.stage.addEventListener( 'touchend', this.onEnd );
			this.stage.addEventListener( 'touchcancel', this.onEnd );
			window.addEventListener( 'resize', this.onResize );
			this.update();
		}

		createStrip() {
			const box = this.lightbox;
			this.strip = document.createElement( 'div' );
			this.strip.className = 'layers-lightbox-pan';
			this.strip.setAttribute( 'role', 'group' );
			const label = document.createElement( 'span' );
			label.textContent = box.getMessage( 'layers-lightbox-pan', 'Pan' );
			label.setAttribute( 'aria-hidden', 'true' );
			this.strip.setAttribute( 'aria-label', label.textContent );
			this.strip.appendChild( label );
			const directions = [
				[ 'left', 'M19 12H5m6-6-6 6 6 6', 'layers-lightbox-pan-left', 'Pan left',
					'layers-lightbox-pan-left-tooltip', 'Pan left (Shift+Left Arrow)' ],
				[ 'up', 'M12 19V5m-6 6 6-6 6 6', 'layers-lightbox-pan-up', 'Pan up',
					'layers-lightbox-pan-up-tooltip', 'Pan up (Shift+Up Arrow)' ],
				[ 'down', 'M12 5v14m-6-6 6 6 6-6', 'layers-lightbox-pan-down', 'Pan down',
					'layers-lightbox-pan-down-tooltip', 'Pan down (Shift+Down Arrow)' ],
				[ 'right', 'M5 12h14m-6-6 6 6-6 6', 'layers-lightbox-pan-right', 'Pan right',
					'layers-lightbox-pan-right-tooltip', 'Pan right (Shift+Right Arrow)' ]
			];
			this.buttons = {};
			for ( const [ direction, arrowPath, key, fallback, tooltipKey, tooltip ] of directions ) {
				const button = document.createElement( 'button' );
				button.type = 'button';
				const icon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
				icon.setAttribute( 'viewBox', '0 0 24 24' );
				icon.setAttribute( 'aria-hidden', 'true' );
				const arrow = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
				arrow.setAttribute( 'd', arrowPath );
				icon.appendChild( arrow );
				button.appendChild( icon );
				button.setAttribute( 'aria-label', box.getMessage( key, fallback ) );
				button.title = box.getMessage( tooltipKey, tooltip );
				button.addEventListener( 'click', ( e ) => {
					e.stopPropagation();
					this.pan( direction );
				} );
				this.buttons[ direction ] = button;
				this.strip.appendChild( button );
			}
			box.overlay.appendChild( this.strip );
		}

		/** Bounds use transformed display geometry, never PDF source pixels. */
		bounds() {
			const box = this.lightbox;
			const viewport = box.overlay.getBoundingClientRect();
			const media = this.stage.getBoundingClientRect();
			if ( !media.width || !media.height ) {
				return null;
			}
			const top = Math.max( viewport.top + 16,
				box.toolbar.getBoundingClientRect().bottom + 12,
				box.overlay.querySelector( '.layers-lightbox-close' ).getBoundingClientRect().bottom + 12 );
			const bottom = Math.min( viewport.bottom - 16, this.strip.getBoundingClientRect().top - 12 );
			const left = viewport.left + 16;
			const right = viewport.right - 16;
			const width = right - left;
			const height = bottom - top;
			if ( width <= 0 || height <= 0 ) {
				return null;
			}
			const cx = media.left + media.width / 2 - ( box.panX || 0 );
			const cy = media.top + media.height / 2 - ( box.panY || 0 );
			return {
				width, height,
				x: media.width > width ? [ right - cx - media.width / 2, left - cx + media.width / 2 ] :
					[ ( left + right ) / 2 - cx, ( left + right ) / 2 - cx ],
				y: media.height > height ? [ bottom - cy - media.height / 2, top - cy + media.height / 2 ] :
					[ ( top + bottom ) / 2 - cy, ( top + bottom ) / 2 - cy ],
				overflowX: media.width > width,
				overflowY: media.height > height
			};
		}

		update() {
			const box = this.lightbox;
			const visible = ( box.zoom || 1 ) > 1;
			if ( !visible && this.strip.contains( document.activeElement ) ) {
				box.zoomIndicator.focus();
			}
			this.strip.hidden = !visible;
			const bounds = visible ? this.bounds() : null;
			const x = box.panX || 0;
			const y = box.panY || 0;
			this.buttons.left.disabled = !bounds || !bounds.overflowX || x >= bounds.x[ 1 ] - 0.5;
			this.buttons.right.disabled = !bounds || !bounds.overflowX || x <= bounds.x[ 0 ] + 0.5;
			this.buttons.up.disabled = !bounds || !bounds.overflowY || y >= bounds.y[ 1 ] - 0.5;
			this.buttons.down.disabled = !bounds || !bounds.overflowY || y <= bounds.y[ 0 ] + 0.5;
		}

		pan( direction ) {
			if ( !this.lightbox || this.strip.hidden || this.buttons[ direction ].disabled ) {
				return;
			}
			const box = this.lightbox;
			const bounds = this.bounds();
			if ( !bounds ) {
				return;
			}
			this.cancelTouch();
			box.endPan();
			const dx = direction === 'left' ? 1 : direction === 'right' ? -1 : 0;
			const dy = direction === 'up' ? 1 : direction === 'down' ? -1 : 0;
			box.panX = Math.max( bounds.x[ 0 ], Math.min( bounds.x[ 1 ], ( box.panX || 0 ) + dx * bounds.width / 5 ) );
			box.panY = Math.max( bounds.y[ 0 ], Math.min( bounds.y[ 1 ], ( box.panY || 0 ) + dy * bounds.height / 5 ) );
			box.applyTransform();
		}

		handleKeyDown( e ) {
			const directions = { ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'right' };
			if ( e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && directions[ e.key ] ) {
				e.preventDefault();
				this.pan( directions[ e.key ] );
				return true;
			}
			return false;
		}

		startTouch( e ) {
			if ( e.touches.length !== 1 ) {
				this.cancelTouch();
				this.blocked = true;
				return;
			}
			if ( this.blocked || ( this.lightbox.zoom || 1 ) <= 1 ) {
				return;
			}
			const point = e.touches[ 0 ];
			this.touch = { id: point.identifier, x: point.clientX, y: point.clientY,
				panX: this.lightbox.panX || 0, panY: this.lightbox.panY || 0 };
		}

		moveTouch( e ) {
			if ( e.touches.length !== 1 ) {
				this.cancelTouch();
				this.blocked = true;
				return;
			}
			if ( !this.touch || ( this.lightbox.zoom || 1 ) <= 1 ) {
				return;
			}
			const point = e.touches[ 0 ];
			if ( point.identifier !== this.touch.id ) {
				this.cancelTouch();
				return;
			}
			const dx = point.clientX - this.touch.x;
			const dy = point.clientY - this.touch.y;
			if ( !this.touch.active && Math.hypot( dx, dy ) < 6 ) {
				return;
			}
			// Leave taps, double-taps and all multi-touch events to the browser.
			if ( !e.cancelable ) {
				this.cancelTouch();
				return;
			}
			e.preventDefault();
			this.touch.active = true;
			this.lightbox.panX = this.touch.panX + dx;
			this.lightbox.panY = this.touch.panY + dy;
			this.lightbox.applyTransform();
		}

		cancelTouch() {
			this.touch = null;
			this.blocked = false;
		}

		destroy() {
			this.cancelTouch();
			this.stage.removeEventListener( 'touchstart', this.onStart );
			this.stage.removeEventListener( 'touchmove', this.onMove );
			this.stage.removeEventListener( 'touchend', this.onEnd );
			this.stage.removeEventListener( 'touchcancel', this.onEnd );
			window.removeEventListener( 'resize', this.onResize );
			this.strip.remove();
			this.stage = null;
			this.lightbox = null;
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Viewer = window.Layers.Viewer || {};
	window.Layers.Viewer.PanController = ViewerPanController;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ViewerPanController;
	}
}() );
