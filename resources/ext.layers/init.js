// mw.layers bootstrap
// Initializes viewers for annotated images and refreshes on content changes
mw.layers = {
	/** Initialize lightweight viewers and bind refresh on content changes */
	init: function () {
		var self = this;

		// Initialize viewers for images annotated by server hooks
		self.initializeLayerViewers();

		// Re-scan when the page content changes
		mw.hook( 'wikipage.content' ).add( function () {
			self.initializeLayerViewers();
		} );
	},

	/**
	 * Find all images with server-provided layer data and overlay a canvas viewer.
	 */
	initializeLayerViewers: function () {
		var images = document.querySelectorAll( 'img.layers-thumbnail[data-layer-data]' );

		images.forEach( function ( img ) {
			if ( img.layersViewer ) {
				return; // Already initialized
			}
			try {
				var json = img.getAttribute( 'data-layer-data' );
				if ( !json ) {
					return;
				}
				var layerData = JSON.parse( json );
				if ( !layerData || !layerData.layers ) {
					return;
				}
				// Instantiate viewer overlaying the image
				img.layersViewer = new window.LayersViewer( {
					container: img.parentNode || img,
					imageElement: img,
					layerData: layerData
				} );
			} catch ( e ) {
				// swallow to avoid breaking page rendering
			}
		} );
	}
};

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', function () {
		mw.layers.init();
	} );
} else {
	mw.layers.init();
}
