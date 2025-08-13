// Backup of original renderLayers method for troubleshooting
// This version removes requestAnimationFrame to see if that's causing issues

/*
CanvasManager.prototype.renderLayers = function ( layers ) {
	// Avoid unnecessary redraws
	if ( this.isRendering ) {
		return;
	}
	this.isRendering = true;

	try {
		// Redraw background
		this.redraw();

		// Render each layer in order
		if ( layers && layers.length > 0 ) {
			// Batch operations for better performance
			this.ctx.save();

			layers.forEach( function ( layer ) {
				if ( layer.visible !== false ) { // Skip invisible layers early
					this.applyLayerEffects( layer, function () {
						this.drawLayer( layer );
					}.bind( this ) );
				}
			}.bind( this ) );

			this.ctx.restore();
		}

		// Draw selection indicators if any layer is selected
		if ( this.selectedLayerId ) {
			this.drawSelectionIndicators( this.selectedLayerId );

			// Update status with selection size
			try {
				var sel = null;
				if ( this.editor && this.editor.getLayerById ) {
					sel = this.editor.getLayerById( this.selectedLayerId );
				}
				if ( sel && this.editor && typeof this.editor.updateStatus === 'function' ) {
					var b = this.getLayerBounds( sel );
					if ( b ) {
						this.editor.updateStatus( {
							size: { width: b.width, height: b.height }
						} );
					}
				}
			} catch ( _e ) {}
		}

		// Draw guides on top
		this.drawGuides();

		// Draw preview guide while dragging from ruler
		this.drawGuidePreview();
	} catch ( error ) {
		// Log error to MediaWiki if available, otherwise to console as fallback
		if ( window.mw && window.mw.log ) {
			window.mw.log.error( 'Layers: Error during rendering:', error );
		}
	} finally {
		this.isRendering = false;
	}
};
*/
