/**
 * Quick debug script to inject into browser console
 * to check the state of the Layers editor
 */

// Function to debug the layers editor state
function debugLayersEditor() {
    console.log('=== Layers Editor Debug ===');
    
    // Check if editor exists globally
    if (window.layersEditor) {
        console.log('✓ Global layersEditor found:', window.layersEditor);
        
        // Check layers data
        if (window.layersEditor.layers) {
            console.log('✓ Layers data:', window.layersEditor.layers);
            console.log('  - Layer count:', window.layersEditor.layers.length);
            window.layersEditor.layers.forEach((layer, index) => {
                console.log(`  - Layer ${index}:`, layer);
            });
        } else {
            console.log('✗ No layers data found');
        }
        
        // Check canvas manager
        if (window.layersEditor.canvasManager) {
            console.log('✓ CanvasManager found:', window.layersEditor.canvasManager);
            
            // Check canvas element
            if (window.layersEditor.canvasManager.canvas) {
                console.log('✓ Canvas element found:', window.layersEditor.canvasManager.canvas);
                console.log('  - Canvas size:', window.layersEditor.canvasManager.canvas.width, 'x', window.layersEditor.canvasManager.canvas.height);
                
                // Check if canvas has any content
                const canvas = window.layersEditor.canvasManager.canvas;
                const ctx = canvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const hasContent = imageData.data.some(pixel => pixel !== 0);
                console.log('  - Canvas has content:', hasContent);
            } else {
                console.log('✗ No canvas element found');
            }
            
            // Check rendering state
            console.log('  - Is rendering:', window.layersEditor.canvasManager.isRendering);
            console.log('  - Selected layer ID:', window.layersEditor.canvasManager.selectedLayerId);
            console.log('  - Selected layer IDs:', window.layersEditor.canvasManager.selectedLayerIds);
        } else {
            console.log('✗ No CanvasManager found');
        }
        
        // Try to force a re-render
        console.log('--- Attempting force re-render ---');
        try {
            if (window.layersEditor.canvasManager && typeof window.layersEditor.canvasManager.renderLayers === 'function') {
                window.layersEditor.canvasManager.renderLayers(window.layersEditor.layers);
                console.log('✓ Force re-render attempted');
            }
        } catch (error) {
            console.log('✗ Force re-render failed:', error);
        }
        
    } else {
        console.log('✗ No global layersEditor found');
        
        // Check for any Layers-related globals
        console.log('Checking for other Layers globals...');
        Object.keys(window).filter(key => key.toLowerCase().includes('layer')).forEach(key => {
            console.log('Found global:', key, window[key]);
        });
    }
    
    console.log('=== End Debug ===');
}

// Also provide a simple test render function
function testLayerRendering() {
    console.log('=== Testing Layer Rendering ===');
    
    if (!window.layersEditor || !window.layersEditor.canvasManager) {
        console.log('✗ No editor or canvas manager available');
        return;
    }
    
    const cm = window.layersEditor.canvasManager;
    const testLayer = {
        id: 'debug-test',
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        fill: '#ff0000',
        visible: true
    };
    
    try {
        console.log('Drawing test layer:', testLayer);
        cm.ctx.save();
        cm.drawLayer(testLayer);
        cm.ctx.restore();
        console.log('✓ Test layer drawn successfully');
    } catch (error) {
        console.log('✗ Test layer drawing failed:', error);
    }
}

// Export to global scope for easy console access
window.debugLayersEditor = debugLayersEditor;
window.testLayerRendering = testLayerRendering;

console.log('Debug functions loaded. Run debugLayersEditor() or testLayerRendering() in console.');
