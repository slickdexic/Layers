/** Canvas display geometry and navigation; saved layer coordinates never change. */
( function () {
	'use strict';
	class ZoomPanController {
		constructor( canvasManager ) {
			this.manager = canvasManager;
			this.minZoom = 0.1;
			this.maxZoom = 5;
			this.isAnimatingZoom = false;
			this.zoomAnimationDuration = 300;
			this.zoomAnimationStartTime = 0;
			this.zoomAnimationStartZoom = 1;
			this.zoomAnimationTargetZoom = 1;
			this.animationFrameId = null;
			this.fitted = !canvasManager.userHasSetZoom;
			this.resizeFrame = null;
			this.onResize = () => {
				if ( this.resizeFrame === null ) {
					this.resizeFrame = requestAnimationFrame( () => {
						this.resizeFrame = null;
						this.manager?.resizeCanvas();
					} );
				}
			};
			const container = canvasManager.container || canvasManager.canvas.parentNode;
			if ( typeof ResizeObserver === 'function' && container ) {
				this.observer = new ResizeObserver( this.onResize );
				this.observer.observe( container );
			}
			window.visualViewport?.addEventListener( 'resize', this.onResize );
		}

		getZoom() { return this.manager.zoom; }
		getPan() { return { x: this.manager.panX, y: this.manager.panY }; }
		clamp( zoom ) { return Math.max( this.minZoom, Math.min( this.maxZoom, zoom ) ); }
		style( element ) { return element.nodeType === 1 ? getComputedStyle( element ) : {}; }

		/** Visible padded workspace, independent of the image's intrinsic width. */
		viewport() {
			const container = this.manager.container || this.manager.canvas.parentNode;
			if ( !container ) { return null; }
			const rect = container.getBoundingClientRect?.() || { left: 0, top: 0 };
			const style = this.style( container ), n = key => parseFloat( style[ key ] ) || 0;
			const left = rect.left + ( container.clientLeft || 0 ) + n( 'paddingLeft' );
			const top = rect.top + ( container.clientTop || 0 ) + n( 'paddingTop' );
			const width = Math.max( 0, container.clientWidth - n( 'paddingLeft' ) - n( 'paddingRight' ) );
			const height = Math.max( 0, container.clientHeight - n( 'paddingTop' ) - n( 'paddingBottom' ) );
			return { left, top, width, height, x: left + width / 2, y: top + height / 2 };
		}

		/** The untransformed border box and its layout origin. */
		geometry() {
			const cm = this.manager, canvas = cm.canvas, viewport = this.viewport();
			const style = this.style( canvas ), n = key => parseFloat( style[ key ] ) || 0;
			const width = canvas.offsetWidth || ( parseFloat( canvas.style.width ) || canvas.width ) +
				n( 'borderLeftWidth' ) + n( 'borderRightWidth' );
			const height = canvas.offsetHeight || ( parseFloat( canvas.style.height ) || canvas.height ) +
				n( 'borderTopWidth' ) + n( 'borderBottomWidth' );
			const rect = canvas.getBoundingClientRect();
			return { width, height,
				x: rect.width ? rect.left - cm.panX : ( viewport?.x || 0 ) - width / 2,
				y: rect.height ? rect.top - cm.panY : ( viewport?.y || 0 ) - height / 2 };
		}

		pointAtClient( point ) {
			const g = this.geometry(), cm = this.manager;
			return { x: ( point.x - g.x - cm.panX ) / cm.zoom,
				y: ( point.y - g.y - cm.panY ) / cm.zoom };
		}

		panForPoint( zoom, point, client ) {
			const g = this.geometry();
			return { x: client.x - g.x - point.x * zoom, y: client.y - g.y - point.y * zoom };
		}

		rememberViewport() {
			const v = this.viewport();
			if ( v?.width > 0 && v.height > 0 ) {
				const g = this.geometry(), p = this.pointAtClient( v );
				this.anchor = { x: p.x / g.width, y: p.y / g.height };
			}
		}

		resizeCanvas() {
			const cm = this.manager, canvas = cm.canvas, v = this.viewport();
			if ( !v?.width || !v.height ) { return; }
			this.stopAnimation();
			const style = this.style( canvas ), n = key => parseFloat( style[ key ] ) || 0;
			const borderX = n( 'borderLeftWidth' ) + n( 'borderRightWidth' );
			const borderY = n( 'borderTopWidth' ) + n( 'borderBottomWidth' );
			const scale = Math.min( ( v.width - borderX ) / canvas.width,
				( v.height - borderY ) / canvas.height );
			if ( !( scale > 0 ) ) { return; }
			canvas.style.width = Math.floor( canvas.width * scale ) + 'px';
			canvas.style.height = Math.floor( canvas.height * scale ) + 'px';
			const g = this.geometry(), anchor = this.anchor || { x: 0.5, y: 0.5 };
			if ( this.fitted || !cm.userHasSetZoom ) { cm.zoom = 1; }
			const pan = this.panForPoint( cm.zoom,
				{ x: anchor.x * g.width, y: anchor.y * g.height }, v );
			cm.panX = this.fitted ? v.x - g.x - g.width / 2 : pan.x;
			cm.panY = this.fitted ? v.y - g.y - g.height / 2 : pan.y;
			cm.viewportBounds = { x: 0, y: 0, width: canvas.width, height: canvas.height };
			this.updateCanvasTransform();
		}

		zoomIn() { this.smoothZoomTo( this.manager.zoom + 0.2 ); this.userNavigated(); }
		zoomOut() { this.smoothZoomTo( this.manager.zoom - 0.2 ); this.userNavigated(); }
		userNavigated() { this.fitted = false; this.manager.userHasSetZoom = true; }

		setZoom( zoom ) {
			this.stopAnimation();
			this.setZoomDirect( zoom );
			this.userNavigated();
		}

		setZoomDirect( zoom, pan ) {
			zoom = this.clamp( zoom );
			const v = this.viewport();
			pan = pan || ( v ? this.panForPoint( zoom, this.pointAtClient( v ), v ) : this.getPan() );
			this.manager.zoom = zoom;
			this.manager.panX = pan.x;
			this.manager.panY = pan.y;
			this.updateCanvasTransform();
			this.manager.editor?.updateStatus?.( { zoomPercent: zoom * 100 } );
		}

		updateCanvasTransform() {
			const cm = this.manager;
			cm.editor?.toolbar?.updateZoomDisplay( Math.round( cm.zoom * 100 ) );
			cm.editor?.updateZoomReadout?.( Math.round( cm.zoom * 100 ) );
			cm.canvas.style.transform = 'translate(' + cm.panX + 'px, ' + cm.panY + 'px) scale(' + cm.zoom + ')';
			cm.canvas.style.transformOrigin = '0 0';
			cm.inlineTextEditor?.reposition?.();
			this.rememberViewport();
		}

		resetZoom() {
			const v = this.viewport(), g = this.geometry();
			this.userNavigated();
			this.smoothZoomTo( 1, undefined, v ?
				this.panForPoint( 1, { x: g.width / 2, y: g.height / 2 }, v ) : { x: 0, y: 0 } );
		}

		stopAnimation() {
			if ( this.animationFrameId !== null ) { cancelAnimationFrame( this.animationFrameId ); }
			this.animationFrameId = null;
			this.isAnimatingZoom = false;
		}

		/** Interpolating pan with scale preserves the same anchored content throughout. */
		smoothZoomTo( target, duration, pan ) {
			target = this.clamp( target );
			if ( !pan && Math.abs( this.manager.zoom - target ) < 0.01 ) { return; }
			this.stopAnimation();
			const v = this.viewport();
			this.animationStartPan = this.getPan();
			this.animationTargetPan = pan || ( v ?
				this.panForPoint( target, this.pointAtClient( v ), v ) : this.getPan() );
			this.isAnimatingZoom = true;
			this.zoomAnimationStartTime = performance.now();
			this.zoomAnimationStartZoom = this.manager.zoom;
			this.zoomAnimationTargetZoom = target;
			this.currentAnimationDuration = duration || this.zoomAnimationDuration;
			this.animateZoom();
		}

		animateZoom() {
			if ( !this.isAnimatingZoom ) { return; }
			const duration = this.currentAnimationDuration || this.zoomAnimationDuration;
			const progress = Math.min( ( performance.now() - this.zoomAnimationStartTime ) / duration, 1 );
			const eased = 1 - Math.pow( 1 - progress, 3 );
			const zoom = this.zoomAnimationStartZoom +
				( this.zoomAnimationTargetZoom - this.zoomAnimationStartZoom ) * eased;
			const from = this.animationStartPan || this.getPan(), to = this.animationTargetPan || from;
			this.setZoomDirect( zoom, { x: from.x + ( to.x - from.x ) * eased,
				y: from.y + ( to.y - from.y ) * eased } );
			if ( progress < 1 ) {
				this.animationFrameId = requestAnimationFrame( () => this.animateZoom() );
			} else {
				this.isAnimatingZoom = false;
				this.animationFrameId = null;
			}
		}

		fitToWindow() {
			if ( !this.manager.canvas ) { return; }
			const v = this.viewport();
			if ( !v?.width || !v.height ) { return; }
			const g = this.geometry(), zoom = this.clamp( Math.min( v.width / g.width, v.height / g.height ) );
			this.manager.userHasSetZoom = true;
			this.fitted = true;
			this.smoothZoomTo( zoom, undefined,
				this.panForPoint( zoom, { x: g.width / 2, y: g.height / 2 }, v ) );
		}

		zoomToFitLayers() {
			const layers = this.manager.editor?.layers || [];
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for ( const layer of layers ) {
				if ( !layer.visible ) { continue; }
				const bounds = this.manager.getLayerBounds( layer );
				if ( bounds ) {
					minX = Math.min( minX, bounds.left ); minY = Math.min( minY, bounds.top );
					maxX = Math.max( maxX, bounds.right ); maxY = Math.max( maxY, bounds.bottom );
				}
			}
			if ( !Number.isFinite( minX ) ) { this.fitToWindow(); return; }
			const v = this.viewport();
			if ( !v ) { return; }
			const g = this.geometry(), rx = g.width / this.manager.canvas.width,
				ry = g.height / this.manager.canvas.height;
			const zoom = this.clamp( Math.min( v.width / ( ( maxX - minX + 100 ) * rx ),
				v.height / ( ( maxY - minY + 100 ) * ry ) ) );
			this.userNavigated();
			this.smoothZoomTo( zoom, undefined, this.panForPoint( zoom,
				{ x: ( minX + maxX ) * rx / 2, y: ( minY + maxY ) * ry / 2 }, v ) );
		}

		zoomBy( delta, point ) {
			const zoom = this.clamp( this.manager.zoom + delta );
			if ( zoom === this.manager.zoom ) { return; }
			const g = this.geometry();
			const p = { x: point.x * g.width / this.manager.canvas.width,
				y: point.y * g.height / this.manager.canvas.height };
			const client = { x: g.x + this.manager.panX + p.x * this.manager.zoom,
				y: g.y + this.manager.panY + p.y * this.manager.zoom };
			this.navigateAt( zoom, p, client );
		}

		navigateAt( zoom, point, client ) {
			this.stopAnimation();
			zoom = this.clamp( zoom );
			this.setZoomDirect( zoom, this.panForPoint( zoom, point, client ) );
			this.userNavigated();
		}

		setPan( x, y ) {
			this.stopAnimation();
			this.manager.panX = x; this.manager.panY = y;
			this.userNavigated();
			this.updateCanvasTransform();
		}
		panBy( dx, dy ) { this.setPan( this.manager.panX + dx, this.manager.panY + dy ); }

		destroy() {
			this.stopAnimation();
			if ( this.resizeFrame !== null ) { cancelAnimationFrame( this.resizeFrame ); }
			this.observer?.disconnect();
			window.visualViewport?.removeEventListener( 'resize', this.onResize );
			this.isPanning = false;
			this.panStart = null;
			this.manager = null;
		}
	}
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.ZoomPanController = ZoomPanController;
	}
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = ZoomPanController; }
}() );
