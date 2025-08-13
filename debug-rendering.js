/**
 * Temporary debugging patch for LayersEditor
 * Add this to the end of LayersEditor.js to debug rendering issues
 */

// Override renderLayers method with debugging
if (window.LayersEditor && LayersEditor.prototype.renderLayers) {
    const originalRenderLayers = LayersEditor.prototype.renderLayers;
    LayersEditor.prototype.renderLayers = function() {
        console.log('DEBUG: LayersEditor.renderLayers called');
        console.log('DEBUG: this.layers =', this.layers);
        console.log('DEBUG: this.canvasManager =', this.canvasManager);
        
        if (this.layers) {
            console.log('DEBUG: Layer count:', this.layers.length);
            this.layers.forEach((layer, index) => {
                console.log(`DEBUG: Layer ${index}:`, layer);
            });
        }
        
        return originalRenderLayers.call(this);
    };
}

// Override CanvasManager renderLayers method with debugging  
if (window.CanvasManager && CanvasManager.prototype.renderLayers) {
    const originalCanvasRenderLayers = CanvasManager.prototype.renderLayers;
    CanvasManager.prototype.renderLayers = function(layers) {
        console.log('DEBUG: CanvasManager.renderLayers called');
        console.log('DEBUG: layers parameter =', layers);
        console.log('DEBUG: this.isRendering =', this.isRendering);
        console.log('DEBUG: this.ctx =', this.ctx);
        console.log('DEBUG: this.canvas =', this.canvas);
        
        if (layers) {
            console.log('DEBUG: Rendering', layers.length, 'layers');
        }
        
        return originalCanvasRenderLayers.call(this, layers);
    };
}

// Override drawLayer method with debugging
if (window.CanvasManager && CanvasManager.prototype.drawLayer) {
    const originalDrawLayer = CanvasManager.prototype.drawLayer;
    CanvasManager.prototype.drawLayer = function(layer) {
        console.log('DEBUG: CanvasManager.drawLayer called for layer:', layer);
        console.log('DEBUG: Layer type:', layer.type, 'visible:', layer.visible);
        
        try {
            const result = originalDrawLayer.call(this, layer);
            console.log('DEBUG: drawLayer completed successfully for', layer.type);
            return result;
        } catch (error) {
            console.error('DEBUG: drawLayer failed for', layer.type, ':', error);
            throw error;
        }
    };
}

console.log('DEBUG: Debugging patches applied to LayersEditor and CanvasManager');
