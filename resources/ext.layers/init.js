/**
 * @class mw.layers
 * @singleton
 */
mw.layers = {
	/**
	 * Initialize layers functionality
	 */
	init: function () {
		// Initialize layer thumbnails
		this.initializeLayerThumbnails();

		// Initialize edit layer functionality on file pages
		this.initializeFilePageIntegration();

		// Listen for editor initialization from PHP hook
		var self = this;
		mw.hook( 'layers.editor.init' ).add( function ( config ) {
			self.createEditor( config.filename, config.container );
		} );

		// Re-initialize when content changes
		mw.hook( 'wikipage.content' ).add( function () {
			self.initializeLayerThumbnails();
			self.initializeFilePageIntegration();
		} );
	},

	/**
	 * Initialize file page edit layer functionality
	 */
	initializeFilePageIntegration: function () {
		// Only on file namespace pages
		if ( mw.config.get( 'wgNamespaceNumber' ) !== 6 ) {
			return;
		}

		// Check if user has edit layers permission
		if ( mw.config.get( 'wgUserGroups' ).indexOf( 'user' ) === -1 ) {
			return; // Basic permission check - should be more sophisticated
		}

		// Add "Edit Layers" tab to file pages
		this.addEditLayersTab();

		// console.log( 'Layers: File page integration initialized' );
	},

	/**
	 * Add Edit Layers tab to file page
	 */
	addEditLayersTab: function () {
		var self = this;

		// Check if tab already exists to prevent duplicates
		if ( document.getElementById( 'ca-editlayers' ) ) {
			// console.log( 'Layers: Edit Layers tab already exists, skipping creation' );
			return;
		}

		// Find the views section where tabs are located
		var views = document.querySelector( '#p-views ul' ) ||
                   document.querySelector( '.vector-menu-content-list' ) ||
                   document.querySelector( '#ca-nstab-file' ).parentNode;

		if ( !views ) {
			// console.warn( 'Layers: Could not find views section to add tab' );
			return;
		}

		// Create Edit Layers tab
		var editLayersTab = document.createElement( 'li' );
		editLayersTab.id = 'ca-editlayers';
		editLayersTab.className = 'collapsible';

		var link = document.createElement( 'a' );
		link.href = '#';
		link.textContent = 'Edit Layers';
		link.title = 'Edit image layers and annotations';

		editLayersTab.appendChild( link );
		views.appendChild( editLayersTab );

		// Add click handler
		link.addEventListener( 'click', function ( e ) {
			e.preventDefault();
			self.launchEditor();
		} );

		// console.log( 'Layers: Added Edit Layers tab to file page' );
	},

	/**
	 * Launch the layers editor
	 */
	launchEditor: function () {
		var self = this;

		// Get current file name
		var filename = mw.config.get( 'wgTitle' );
		if ( !filename ) {
			mw.notify( 'Could not determine file name', { type: 'error' } );
			return;
		}

		// Load editor resources if not already loaded
		if ( typeof window.LayersEditor === 'undefined' ) {
			mw.loader.using( 'ext.layers.editor' ).then( function () {
				self.createEditor( filename );
			} ).catch( function () {
				// console.error( 'Failed to load layers editor:', err );
				mw.notify( 'Failed to load layers editor', { type: 'error' } );
			} );
		} else {
			this.createEditor( filename );
		}
	},

	/**
	 * Create and launch the editor
	 *
	 * @param {string} filename The file to edit
	 * @param {Element} container Optional container element for the editor
	 */
	createEditor: function ( filename, container ) {
		// console.log( 'Layers: Launching editor for file:', filename );

		// Create editor instance
		var editorConfig = {
			filename: filename
		};

		// If container is provided, use it
		if ( container ) {
			editorConfig.container = container;
		}

		var editor = new window.LayersEditor( editorConfig );

		// Store reference for cleanup
		this.activeEditor = editor;

		mw.notify( 'Layers editor loaded. You can now draw on the image!', { type: 'success' } );
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
					thumbnail.layersViewer = this.createViewer( {
						container: thumbnail,
						layers: layerData.layers
					} );
				}
			} catch ( error ) {
				// console.warn( 'Layers: Error parsing layer data for thumbnail:', error );
			}
		}.bind( this ) );
	},

	/**
	 * Create a layer viewer for a thumbnail
	 *
	 * @param {Object} config Configuration object
	 */
	createViewer: function () {
		// TODO: Implement layer viewer for thumbnails
		// console.log( 'Layers: Creating viewer for thumbnail with', config.layers.length, 'layers' );
	}
};

// Initialize when page is ready
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', function () {
		mw.layers.init();
	} );
} else {
	mw.layers.init();
}
