/** Two-finger viewport navigation, separate from one-finger layer editing. */
( function () {
	'use strict';
	class TouchNavigationController {
		constructor( events ) { this.events = events; this.cm = events.cm; }

		/** Only fingers starting on the canvas or its blank workspace participate. */
		touches( e ) {
			return Array.from( e.touches || [] ).filter( touch => !touch.target ||
				touch.target === this.cm.canvas || touch.target === this.cm.container );
		}

		start( e ) {
			const cm = this.cm, touches = this.touches( e );
			if ( touches.length !== 2 || cm.interactionController?.shouldBlockInteraction() ) { return; }
			e.preventDefault?.();
			if ( !this.events.touchNavigation ) {
				cm.transformController?.cancelPreview?.();
				cm.drawingController?.cancelAngleDimension();
				cm.isDrawing = false;
				cm.tempLayer = null;
				cm.isMarqueeSelecting = false;
				cm.isDraggingGuide = false;
				cm.renderLayers( cm.editor.layers );
			}
			this.events.touchNavigation = true;
			cm.lastTouchTime = 0;
			cm.isPinching = true;
			const [ a, b ] = touches;
			const midpoint = { x: ( a.clientX + b.clientX ) / 2, y: ( a.clientY + b.clientY ) / 2 };
			this.anchor = cm.zoomPanController?.pointAtClient( midpoint );
			cm.initialPinchDistance = Math.hypot( b.clientX - a.clientX, b.clientY - a.clientY );
			cm.initialZoom = cm.zoom;
		}

		move( e ) {
			const cm = this.cm, touches = this.touches( e );
			if ( !cm.isPinching || touches.length !== 2 || !cm.initialPinchDistance ) { return; }
			e.preventDefault?.();
			const [ a, b ] = touches;
			const distance = Math.hypot( b.clientX - a.clientX, b.clientY - a.clientY );
			const zoom = Math.max( 0.1, Math.min( 5, cm.initialZoom * distance / cm.initialPinchDistance ) );
			if ( this.anchor && cm.zoomPanController ) {
				cm.zoomPanController.navigateAt( zoom, this.anchor,
					{ x: ( a.clientX + b.clientX ) / 2, y: ( a.clientY + b.clientY ) / 2 } );
			} else {
				cm.setZoom( zoom );
			}
		}

		/** Keep the remaining finger from becoming a stray layer edit. */
		end( e ) {
			if ( !this.events.touchNavigation && !this.cm.isPinching ) { return false; }
			e.preventDefault?.();
			const touches = this.touches( e );
			if ( touches.length === 2 && e.type !== 'touchcancel' ) {
				this.start( e );
			} else {
				this.finish();
				this.events.touchNavigation = touches.length > 0;
			}
			this.cm.lastTouchTime = 0;
			return true;
		}

		finish() {
			this.cm.isPinching = false;
			this.cm.initialPinchDistance = null;
			this.cm.initialZoom = null;
			this.anchor = null;
		}
	}
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.TouchNavigationController = TouchNavigationController;
	}
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = TouchNavigationController; }
}() );
