/**
 * ImportExportManager - Handles layer import/export functionality
 *
 * This module provides JSON import and export capabilities for layer data,
 * supporting both modern and legacy browsers.
 *
 * @since 0.9.0
 */
( function () {
	'use strict';

	/**
	 * ImportExportManager class
	 *
	 * @class ImportExportManager
	 * @param {Object} config Configuration object
	 * @param {Object} config.editor Reference to the LayersEditor instance
	 */
	function ImportExportManager( config ) {
		this.editor = config.editor;
	}

	/**
	 * Get a localized message with fallback
	 * Delegates to centralized MessageHelper for consistent i18n handling.
	 *
	 * @private
	 * @param {string} key Message key
	 * @param {string} fallback Fallback text
	 * @return {string} The localized message or fallback
	 */
	ImportExportManager.prototype.msg = function ( key, fallback ) {
		// Try centralized MessageHelper first
		if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
			return window.layersMessages.get( key, fallback );
		}
		// Fall back to direct mw.message if MessageHelper unavailable
		if ( window.mw && window.mw.message ) {
			try {
				return mw.message( key ).text();
			} catch ( e ) {
				// Fall through to return fallback
			}
		}
		return fallback || '';
	};

	/**
	 * Notify the user with a message
	 *
	 * @private
	 * @param {string} message The message to display
	 * @param {string} type Message type ('success', 'error', 'info')
	 */
	ImportExportManager.prototype.notify = function ( message, type ) {
		if ( window.mw && window.mw.notify ) {
			mw.notify( message, { type: type || 'info' } );
		}
	};

	/**
	 * Import layers from a JSON file
	 *
	 * @param {File} file The JSON file to import
	 * @param {Object} [options] Import options
	 * @param {boolean} [options.confirmOverwrite=true] Prompt for confirmation if unsaved changes
	 * @return {Promise<Array>} Resolves with imported layers or rejects on error
	 */
	ImportExportManager.prototype.importFromFile = function ( file, options ) {
		options = options || {};
		const confirmOverwrite = options.confirmOverwrite !== false;

		return new Promise( ( resolve, reject ) => {
			if ( !file ) {
				reject( new Error( 'No file provided' ) );
				return;
			}

			// Confirm overwrite if there are unsaved changes
			if ( confirmOverwrite && this.editor && this.editor.isDirty ) {
				const msg = this.msg( 'layers-import-unsaved-confirm', 'You have unsaved changes. Import anyway?' );
				// eslint-disable-next-line no-alert
				if ( !window.confirm( msg ) ) {
					reject( new Error( 'Import cancelled by user' ) );
					return;
				}
			}

			const reader = new FileReader();

			reader.onload = () => {
				try {
					const text = String( reader.result || '' );
					const layers = this.parseLayersJSON( text );
					this.applyImportedLayers( layers );
					this.notify(
						this.msg( 'layers-import-success', 'Import complete' ),
						'success'
					);
					resolve( layers );
				} catch ( err ) {
					this.notify(
						this.msg( 'layers-import-error', 'Import failed' ),
						'error'
					);
					reject( err );
				}
			};

			reader.onerror = () => {
				this.notify(
					this.msg( 'layers-import-error', 'Import failed' ),
					'error'
				);
				reject( new Error( 'File read error' ) );
			};

			reader.readAsText( file );
		} );
	};

	/**
	 * Parse layers from JSON text
	 *
	 * @param {string} text JSON text to parse
	 * @return {Array} Array of layer objects
	 * @throws {Error} If JSON is invalid or format is unrecognized
	 */
	ImportExportManager.prototype.parseLayersJSON = function ( text ) {
		const parsed = JSON.parse( text );
		let layers;

		if ( Array.isArray( parsed ) ) {
			layers = parsed;
		} else if ( parsed && Array.isArray( parsed.layers ) ) {
			layers = parsed.layers;
		} else {
			throw new Error( 'Invalid JSON format' );
		}

		if ( !Array.isArray( layers ) ) {
			throw new Error( 'Invalid layers data' );
		}

		// Ensure each layer has an ID
		return layers.map( function ( layer ) {
			const obj = layer || {};
			if ( !obj.id ) {
				obj.id = 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 9 );
			}
			return obj;
		} );
	};

	/**
	 * Apply imported layers to the editor
	 *
	 * @private
	 * @param {Array} layers Array of layer objects
	 */
	ImportExportManager.prototype.applyImportedLayers = function ( layers ) {
		const editor = this.editor;

		if ( !editor ) {
			return;
		}

		// Save state before import
		if ( typeof editor.saveState === 'function' ) {
			editor.saveState( 'import' );
		}

		// Apply layers via StateManager or directly
		if ( editor.stateManager ) {
			editor.stateManager.set( 'layers', layers );
		} else {
			editor.layers = layers;
		}

		// Re-render
		if ( editor.canvasManager && typeof editor.canvasManager.renderLayers === 'function' ) {
			const currentLayers = editor.stateManager ?
				( editor.stateManager.get( 'layers' ) || [] ) : [];
			editor.canvasManager.renderLayers( currentLayers );
		}

		// Mark as dirty
		if ( typeof editor.markDirty === 'function' ) {
			editor.markDirty();
		}
	};

	/**
	 * Export layers to a JSON file
	 *
	 * @param {Object} [options] Export options
	 * @param {string} [options.filename] Base filename (without extension)
	 * @param {boolean} [options.pretty=true] Pretty-print the JSON
	 * @return {boolean} True if export was initiated successfully
	 */
	ImportExportManager.prototype.exportToFile = function ( options ) {
		options = options || {};

		try {
			const layers = this.getLayersForExport();
			const pretty = options.pretty !== false;
			const json = JSON.stringify( layers, null, pretty ? 2 : 0 );

			// Generate filename
			let baseName = options.filename;
			if ( !baseName && this.editor ) {
				baseName = this.editor.filename || 'layers';
			}
			baseName = baseName || 'layers';
			const filename = baseName + '.layers.json';

			// Create and trigger download
			this.triggerDownload( json, filename, 'application/json' );
			return true;
		} catch ( e ) {
			this.notify(
				this.msg( 'layers-export-error', 'Export failed' ),
				'error'
			);
			return false;
		}
	};

	/**
	 * Get layers data for export
	 *
	 * @return {Array} Array of layer objects
	 */
	ImportExportManager.prototype.getLayersForExport = function () {
		const editor = this.editor;

		if ( editor && editor.stateManager && typeof editor.stateManager.getLayers === 'function' ) {
			return editor.stateManager.getLayers();
		}

		if ( editor && Array.isArray( editor.layers ) ) {
			return editor.layers;
		}

		return [];
	};

	/**
	 * Trigger a file download in the browser
	 *
	 * @private
	 * @param {string} content File content
	 * @param {string} filename Filename for the download
	 * @param {string} mimeType MIME type of the file
	 */
	ImportExportManager.prototype.triggerDownload = function ( content, filename, mimeType ) {
		const blob = new Blob( [ content ], { type: mimeType } );

		// IE 11 and old Edge
		if ( window.navigator && window.navigator.msSaveOrOpenBlob ) {
			window.navigator.msSaveOrOpenBlob( blob, filename );
			return;
		}

		// Modern browsers - use Blob URL (safer than data: URL)
		const url = URL.createObjectURL( blob );
		const a = document.createElement( 'a' );
		a.style.display = 'none';
		a.download = filename;
		a.href = url;

		document.body.appendChild( a );
		a.click();

		// Clean up: remove element and revoke Blob URL
		setTimeout( function () {
			document.body.removeChild( a );
			URL.revokeObjectURL( url );
		}, 100 );
	};

	/**
	 * Create an import button with file input
	 *
	 * @param {Object} [options] Button options
	 * @param {string} [options.buttonText] Text for the import button
	 * @param {Function} [options.onSuccess] Callback on successful import
	 * @param {Function} [options.onError] Callback on import error
	 * @return {Object} Object with { button, input } elements
	 */
	ImportExportManager.prototype.createImportButton = function ( options ) {
		options = options || {};

		const button = document.createElement( 'button' );
		button.className = 'toolbar-button import-button';
		button.textContent = options.buttonText || this.msg( 'layers-import-layers', 'Import Layers' );
		button.title = button.textContent;
		button.type = 'button';

		const input = document.createElement( 'input' );
		input.type = 'file';
		input.accept = '.json,application/json';
		input.style.display = 'none';

		button.addEventListener( 'click', () => {
			input.click();
		} );

		input.addEventListener( 'change', () => {
			const file = input.files && input.files[ 0 ];
			if ( !file ) {
				return;
			}

			this.importFromFile( file )
				.then( ( layers ) => {
					if ( options.onSuccess ) {
						options.onSuccess( layers );
					}
				} )
				.catch( ( err ) => {
					if ( options.onError ) {
						options.onError( err );
					}
				} )
				.finally( () => {
					// Reset input so same file can be selected again
					input.value = '';
				} );
		} );

		return { button: button, input: input };
	};

	/**
	 * Create an export button
	 *
	 * @param {Object} [options] Button options
	 * @param {string} [options.buttonText] Text for the export button
	 * @param {Function} [options.onSuccess] Callback on successful export
	 * @param {Function} [options.onError] Callback on export error
	 * @return {HTMLButtonElement} The export button element
	 */
	ImportExportManager.prototype.createExportButton = function ( options ) {
		options = options || {};

		const button = document.createElement( 'button' );
		button.className = 'toolbar-button export-button';
		button.textContent = options.buttonText || this.msg( 'layers-export-layers', 'Export Layers' );
		button.title = button.textContent;
		button.type = 'button';

		button.addEventListener( 'click', () => {
			const success = this.exportToFile();
			if ( success && options.onSuccess ) {
				options.onSuccess();
			} else if ( !success && options.onError ) {
				options.onError( new Error( 'Export failed' ) );
			}
		} );

		return button;
	};

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.ImportExportManager = ImportExportManager;

		// Backward compatibility - direct window export
		window.ImportExportManager = ImportExportManager;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ImportExportManager;
	}
}() );
