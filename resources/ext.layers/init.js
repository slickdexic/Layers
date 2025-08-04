/**
 * @class mw.layers
 * @singleton
 */
mw.layers = {
    /**
     * Initialize layers viewer for images with layer data
     */
    init: function () {
        // Auto-initialize viewers will be handled by LayersViewer.js
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
