( function () {
	'use strict';

	class MarqueeController {
		/**
		 * @param {CanvasManager} manager
		 */
		constructor( manager ) {
			this.manager = manager;
			this.isMarqueeSelecting = false;
			this.marqueeStart = { x: 0, y: 0 };
			this.marqueeEnd = { x: 0, y: 0 };
		}

		startMarqueeSelection( point ) {
			this.isMarqueeSelecting = true;
			this.marqueeStart = { x: point.x, y: point.y };
			this.marqueeEnd = { x: point.x, y: point.y };
			if ( this.manager.selectionManager && typeof this.manager.selectionManager.startMarqueeSelection === 'function' ) {
				this.manager.selectionManager.startMarqueeSelection( point );
			}
		}

		updateMarqueeSelection( point ) {
			if ( !this.isMarqueeSelecting ) {
				return;
			}
			this.marqueeEnd = { x: point.x, y: point.y };
			if ( this.manager.selectionManager && typeof this.manager.selectionManager.updateMarqueeSelection === 'function' ) {
				this.manager.selectionManager.updateMarqueeSelection( point );
			}
			if ( this.manager && typeof this.manager.renderLayers === 'function' ) {
				this.manager.renderLayers( this.manager.editor.layers );
			}
			if ( this.manager && typeof this.manager.drawMarqueeBox === 'function' ) {
				this.manager.drawMarqueeBox();
			}
		}

		finishMarqueeSelection() {
			if ( !this.isMarqueeSelecting ) {
				return;
			}
			if ( this.manager.selectionManager && typeof this.manager.selectionManager.finishMarqueeSelection === 'function' ) {
				this.manager.selectionManager.finishMarqueeSelection();
				const selectedIds = this.manager.selectionManager.getSelectedLayerIds ?
					this.manager.selectionManager.getSelectedLayerIds() : [];
				if ( selectedIds.length > 0 ) {
					this.manager.setSelectedLayerIds( selectedIds );
					if ( typeof this.manager.drawMultiSelectionIndicators === 'function' ) {
						this.manager.drawMultiSelectionIndicators();
					}
				} else {
					if ( typeof this.manager.deselectAll === 'function' ) {
						this.manager.deselectAll();
					}
				}
			}
			this.isMarqueeSelecting = false;
			if ( this.manager && typeof this.manager.renderLayers === 'function' ) {
				this.manager.renderLayers( this.manager.editor.layers );
			}
			if ( this.manager && typeof this.manager.drawMultiSelectionIndicators === 'function' ) {
				this.manager.drawMultiSelectionIndicators();
			}
			if ( this.manager && this.manager.editor && typeof this.manager.editor.updateStatus === 'function' ) {
				this.manager.editor.updateStatus( { selection: this.manager.getSelectedLayerIds().length } );
			}
		}

		getMarqueeRect() {
			const x1 = Math.min( this.marqueeStart.x, this.marqueeEnd.x );
			const y1 = Math.min( this.marqueeStart.y, this.marqueeEnd.y );
			const x2 = Math.max( this.marqueeStart.x, this.marqueeEnd.x );
			const y2 = Math.max( this.marqueeStart.y, this.marqueeEnd.y );
			return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
		}

		getLayersInRect( rect ) {
			const layersInRect = [];
			const layers = ( this.manager && this.manager.editor && this.manager.editor.layers ) ? this.manager.editor.layers : [];
			for ( let i = 0; i < layers.length; i++ ) {
				const layer = layers[ i ];
				const layerBounds = this.manager.getLayerBounds( layer );
				if ( layerBounds && this.rectsIntersect( rect, layerBounds ) ) {
					layersInRect.push( layer );
				}
			}
			return layersInRect;
		}

		rectsIntersect( rect1, rect2 ) {
			const a = this._rectToAabb( rect1 );
			const b = this._rectToAabb( rect2 );
			return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
		}

		_rectToAabb( rect ) {
			if ( !rect ) {
				return { left: 0, top: 0, right: 0, bottom: 0 };
			}
			if ( typeof rect.left === 'number' && typeof rect.right === 'number' && typeof rect.top === 'number' && typeof rect.bottom === 'number' ) {
				return rect;
			}
			const x = rect.x || 0;
			const y = rect.y || 0;
			const width = rect.width || 0;
			const height = rect.height || 0;
			return { left: x, top: y, right: x + width, bottom: y + height };
		}

		destroy() {
			this.manager = null;
			this.pool = null;
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.MarqueeController = MarqueeController;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = MarqueeController;
	}

}() );
