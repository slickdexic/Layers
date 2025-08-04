/**
 * @class mw.layers
 * @singleton
 */
mw.layers = {
    /**
     * Initialize layers viewer for images with layer data
     */
    init: function () {
        // Find and initialize all thumbnails with layer data
        this.initializeLayerThumbnails();
        
        // Re-initialize when content changes
        var self = this;
        mw.hook( 'wikipage.content' ).add( function () {
            self.initializeLayerThumbnails();
        } );
    },
    
    /**
     * Initialize layer viewers on thumbnails
     */
    initializeLayerThumbnails: function () {
        var thumbnails = document.querySelectorAll( '.layers-thumbnail[data-layer-data]' );
        
        thumbnails.forEach( function ( thumbnail ) {
            // Skip if already initialized
            if ( thumbnail.layersViewer ) {
                return;
            }
            
            try {
                var layerData = JSON.parse( thumbnail.getAttribute( 'data-layer-data' ) );
                if ( layerData && layerData.layers ) {
                    // Create overlay canvas for this thumbnail
                    var canvas = document.createElement( 'canvas' );
                    canvas.className = 'layers-overlay';
                    canvas.style.position = 'absolute';
                    canvas.style.top = '0';
                    canvas.style.left = '0';
                    canvas.style.pointerEvents = 'none';
                    
                    // Make thumbnail container relative for overlay positioning
                    var container = thumbnail.parentNode;
                    container.style.position = 'relative';
                    container.appendChild( canvas );
                    
                    // Create viewer
                    var viewer = new window.LayersViewer( {
                        canvas: canvas,
                        baseImage: thumbnail,
                        layers: layerData.layers,
                        readonly: true
                    } );
                    
                    thumbnail.layersViewer = viewer;
                }
            } catch ( e ) {
                if ( window.console && console.warn ) {
                    console.warn( 'Layers: Failed to initialize thumbnail viewer:', e );
                }
            }
        } );
    },
    
    /**
     * Create a new layers viewer
     * @param {Object} config Configuration object
     * @return {LayersViewer} New viewer instance
     */
    createViewer: function ( config ) {
        return new window.LayersViewer( config );
    }
};

// Auto-initialize when DOM is ready
if ( document.readyState === 'loading' ) {
    document.addEventListener( 'DOMContentLoaded', function () {
        mw.layers.init();
    } );
} else {
    mw.layers.init();
}
