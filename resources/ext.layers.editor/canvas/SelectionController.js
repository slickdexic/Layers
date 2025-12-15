( function () {
	'use strict';

	class SelectionController {
		/**
		 * @param {CanvasManager} manager
		 */
		constructor( manager ) {
			this.manager = manager;
		}

		selectLayer( layerId, fromPanel ) {
			if ( !this.manager ) {
				return;
			}
			this.manager.setSelectedLayerIds( layerId ? [ layerId ] : [] );
			this.manager.selectionHandles = [];
			this.manager.renderLayers( this.manager.editor.layers );
			if ( this.manager.editor && typeof this.manager.editor.updateStatus === 'function' ) {
				this.manager.editor.updateStatus( { selection: this.manager.getSelectedLayerIds().length } );
			}
			if ( !fromPanel && this.manager.editor && this.manager.editor.layerPanel ) {
				this.manager.editor.layerPanel.selectLayer( layerId, true );
			}
		}

		selectAll() {
			if ( !this.manager ) {
				return;
			}
			const allIds = ( this.manager.editor.layers || [] )
				.filter( function ( layer ) { return layer.visible !== false; } )
				.map( function ( layer ) { return layer.id; } );
			this.manager.setSelectedLayerIds( allIds );
			this.manager.renderLayers( this.manager.editor.layers );
			this.manager.drawMultiSelectionIndicators();
			if ( this.manager.editor && typeof this.manager.editor.updateStatus === 'function' ) {
				this.manager.editor.updateStatus( { selection: this.manager.getSelectedLayerIds().length } );
			}
		}

		deselectAll() {
			if ( !this.manager ) {
				return;
			}
			this.manager.setSelectedLayerIds( [] );
			this.manager.selectionHandles = [];
			this.manager.rotationHandle = null;
			this.manager.renderLayers( this.manager.editor.layers );
			if ( this.manager.editor && typeof this.manager.editor.updateStatus === 'function' ) {
				this.manager.editor.updateStatus( { selection: 0, size: { width: 0, height: 0 } } );
			}
		}

		handleLayerSelection( point, isCtrlClick ) {
			if ( !this.manager ) {
				return null;
			}
			const hit = this.manager.getLayerAtPoint( point );
			if ( !hit ) {
				if ( !isCtrlClick ) {
					this.deselectAll();
				}
				return null;
			}

			const currentIds = this.manager.getSelectedLayerIds().slice();
			let newIds;

			if ( isCtrlClick ) {
				const idx = currentIds.indexOf( hit.id );
				if ( idx === -1 ) {
					currentIds.push( hit.id );
				} else {
					currentIds.splice( idx, 1 );
				}
				newIds = currentIds;
			} else {
				newIds = [ hit.id ];
			}

			this.manager.setSelectedLayerIds( newIds );
			this.manager.renderLayers( this.manager.editor.layers );
			this.manager.drawMultiSelectionIndicators();

			if ( this.manager.editor && this.manager.editor.layerPanel ) {
				this.manager.editor.layerPanel.selectLayer( this.manager.getSelectedLayerId(), true );
			}

			if ( this.manager.editor && typeof this.manager.editor.updateStatus === 'function' ) {
				this.manager.editor.updateStatus( { selection: this.manager.getSelectedLayerIds().length } );
			}

			return hit;
		}

		drawMultiSelectionIndicators() {
			if ( !this.manager ) {
				return;
			}
			const selectedIds = this.manager.getSelectedLayerIds();
			if ( !selectedIds || selectedIds.length <= 1 ) {
				return;
			}
			for ( let i = 0; i < selectedIds.length; i++ ) {
				this.manager.drawSelectionIndicators( selectedIds[ i ] );
			}
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.SelectionController = SelectionController;
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.SelectionController = SelectionController;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SelectionController;
	}

}() );
