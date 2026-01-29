/**
 * Export Controller for Layers Editor
 *
 * Handles image export operations - extracting and downloading
 * canvas content as PNG or JPEG images.
 *
 * @module editor/ExportController
 */
( function () {
	'use strict';

	/**
	 * ExportController class - manages canvas export to images
	 */
	class ExportController {
		/**
		 * Create an ExportController instance.
		 *
		 * @param {Object} editor - The LayersEditor instance
		 */
		constructor( editor ) {
			this.editor = editor;
		}

		/**
		 * Get a message from MediaWiki i18n or return fallback.
		 *
		 * @private
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string} Message text
		 */
		_msg( key, fallback = '' ) {
			if ( typeof mw !== 'undefined' && mw.message ) {
				const msg = mw.message( key );
				if ( msg.exists() ) {
					return msg.text();
				}
			}
			return fallback;
		}

		/**
		 * Show the loading spinner.
		 *
		 * @private
		 */
		_showSpinner() {
			if ( this.editor.uiManager && typeof this.editor.uiManager.showSpinner === 'function' ) {
				this.editor.uiManager.showSpinner();
			}
		}

		/**
		 * Hide the loading spinner.
		 *
		 * @private
		 */
		_hideSpinner() {
			if ( this.editor.uiManager && typeof this.editor.uiManager.hideSpinner === 'function' ) {
				this.editor.uiManager.hideSpinner();
			}
		}

		/**
		 * Sanitize a filename by removing/replacing characters that are problematic for filesystems.
		 *
		 * @param {string} name - Filename to sanitize
		 * @return {string} Sanitized filename
		 */
		sanitizeFilename( name ) {
			if ( typeof name !== 'string' ) {
				return 'image';
			}
			// Replace filesystem-problematic characters with underscores
			// Windows forbidden: < > : " / \ | ? *
			// Also remove control characters and leading/trailing whitespace
			return name
				// eslint-disable-next-line no-control-regex
				.replace( /[<>:"/\\|?*\x00-\x1f]/g, '_' )
				.replace( /^[\s.]+|[\s.]+$/g, '' )
				.substring( 0, 200 ) || 'image';
		}

		/**
		 * Export the current canvas content as an image blob.
		 *
		 * @param {Object} options Export options
		 * @param {boolean} [options.includeBackground=true] Include background image
		 * @param {number} [options.scale=1] Export scale factor
		 * @param {string} [options.format='png'] Export format (png|jpeg)
		 * @param {number} [options.quality=0.92] JPEG quality 0-1
		 * @return {Promise<Blob>} Resolves with image blob
		 */
		exportAsImage( options = {} ) {
			return new Promise( ( resolve, reject ) => {
				// Respect current background visibility unless explicitly overridden
				const backgroundVisible = this.editor.stateManager.get( 'backgroundVisible' );
				const backgroundOpacity = this.editor.stateManager.get( 'backgroundOpacity' );
				const includeBackground = options.includeBackground !== undefined ?
					options.includeBackground :
					( backgroundVisible !== false && backgroundOpacity > 0 );
				const scale = options.scale || 1;
				const format = options.format || 'png';
				const quality = options.quality || 0.92;

				try {
					const canvasManager = this.editor.canvasManager;
					if ( !canvasManager ) {
						reject( new Error( 'Canvas manager not available' ) );
						return;
					}

					// Create an offscreen canvas for export
					const baseWidth = this.editor.stateManager.get( 'baseWidth' ) || canvasManager.canvas.width;
					const baseHeight = this.editor.stateManager.get( 'baseHeight' ) || canvasManager.canvas.height;
					const exportWidth = Math.round( baseWidth * scale );
					const exportHeight = Math.round( baseHeight * scale );

					const exportCanvas = document.createElement( 'canvas' );
					exportCanvas.width = exportWidth;
					exportCanvas.height = exportHeight;
					const ctx = exportCanvas.getContext( '2d' );

					// Check if canvas context creation failed
					if ( !ctx ) {
						reject( new Error( 'Failed to create canvas context for export' ) );
						return;
					}

					// Draw background if requested and available
					// For PNG exports with hidden background, leave transparent
					if ( includeBackground && canvasManager.backgroundImage ) {
						const opacity = backgroundOpacity !== undefined ? backgroundOpacity : 1;
						if ( opacity < 1 ) {
							ctx.globalAlpha = opacity;
						}
						ctx.drawImage( canvasManager.backgroundImage, 0, 0, exportWidth, exportHeight );
						ctx.globalAlpha = 1;
					} else if ( format === 'jpeg' ) {
						// JPEG doesn't support transparency, use white background
						ctx.fillStyle = '#ffffff';
						ctx.fillRect( 0, 0, exportWidth, exportHeight );
					}
					// For PNG with no background: leave transparent

					// Draw all visible layers
					const layers = this.editor.stateManager.get( 'layers' ) || [];
					const visibleLayers = layers.filter( ( layer ) => layer.visible !== false );

					// Use the canvas renderer to draw layers
					if ( canvasManager.renderer &&
						typeof canvasManager.renderer.renderLayersToContext === 'function' ) {
						canvasManager.renderer.renderLayersToContext( ctx, visibleLayers, scale );
					} else {
						// Fallback: draw the current canvas content
						ctx.drawImage( canvasManager.canvas, 0, 0, exportWidth, exportHeight );
					}

					// Convert to blob
					const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
					exportCanvas.toBlob( ( blob ) => {
						if ( blob ) {
							resolve( blob );
						} else {
							reject( new Error( 'Failed to create image blob' ) );
						}
					}, mimeType, quality );

				} catch ( error ) {
					reject( error );
				}
			} );
		}

		/**
		 * Export and download the current canvas as an image file.
		 *
		 * @param {Object} options Export options (see exportAsImage)
		 * @param {string} [options.filename] Custom filename (optional)
		 */
		downloadAsImage( options = {} ) {
			const filename = this.editor.stateManager.get( 'filename' ) || 'image';
			const currentSetName = this.editor.stateManager.get( 'currentSetName' ) || 'default';

			// Remove File: prefix and extension from filename
			const baseName = filename
				.replace( /^File:/i, '' )
				.replace( /\.[^/.]+$/, '' );
			const format = options.format || 'png';
			const ext = format === 'jpeg' ? '.jpg' : '.png';

			// Format: ImageName-LayerSetName.ext (omit -default for default set)
			const setNamePart = currentSetName === 'default' ? '' : `-${ currentSetName }`;

			// Sanitize the final filename to prevent filesystem issues
			let downloadName;
			if ( options.filename ) {
				const sanitized = this.sanitizeFilename( options.filename );
				// Don't add extension if user already provided one
				const hasExt = /\.(png|jpg|jpeg)$/i.test( sanitized );
				downloadName = hasExt ? sanitized : sanitized + ext;
			} else {
				downloadName = this.sanitizeFilename( `${ baseName }${ setNamePart }` ) + ext;
			}

			this._showSpinner();

			this.exportAsImage( options ).then( ( blob ) => {
				this._hideSpinner();

				// Create download link
				const url = URL.createObjectURL( blob );
				const a = document.createElement( 'a' );
				a.href = url;
				a.download = downloadName;
				document.body.appendChild( a );
				a.click();
				document.body.removeChild( a );
				URL.revokeObjectURL( url );

				const msg = this._msg( 'layers-export-success', 'Image exported successfully' );
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify( msg, { type: 'success' } );
				}
			} ).catch( ( error ) => {
				this._hideSpinner();
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[ExportController] Export failed:', error );
				}
				const msg = this._msg( 'layers-export-failed', 'Failed to export image' );
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify( msg, { type: 'error' } );
				}
			} );
		}
	}

	// Export to namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Editor = window.Layers.Editor || {};
		window.Layers.Editor.ExportController = ExportController;
		// Also expose at top level for backwards compatibility
		window.ExportController = ExportController;
	}

	// Export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ExportController;
	}
}() );
