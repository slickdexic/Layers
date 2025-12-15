( function () {
	'use strict';

	class CanvasImageController {
		/**
		 * @param {CanvasManager} manager
		 */
		constructor( manager ) {
			this.manager = manager;
			this.imageLoader = null;
		}

		load( filename, backgroundImageUrl ) {
			// Prefer existing ImageLoader utility when available
			try {
				let ImageLoaderClass = null;
				try {
					if ( typeof window !== 'undefined' && window.Layers && window.Layers.Utils && window.Layers.Utils.ImageLoader ) {
						ImageLoaderClass = window.Layers.Utils.ImageLoader;
					} else if ( typeof window !== 'undefined' && window.ImageLoader ) {
						ImageLoaderClass = window.ImageLoader;
					} else {
						// Obtain global object without referencing `global` or `globalThis`
						const globalObj = Function('return this')();
						if ( globalObj && globalObj.ImageLoader ) {
							ImageLoaderClass = globalObj.ImageLoader;
						}
					}
				} catch ( e ) {
					// ignore and fallthrough to fallback
				}

				if ( ImageLoaderClass ) {
					this.imageLoader = new ImageLoaderClass( {
						filename: filename,
						backgroundImageUrl: backgroundImageUrl,
						onLoad: ( image, info ) => {
							this._handleLoaded( image, info );
						},
						onError: () => {
							this._handleError();
						}
					} );
					this.imageLoader.load();
					return;
				}
			} catch ( e ) {
				// ignore and fallthrough to fallback
			}

			// Fallback: try to use manager's legacy loader
			if ( this.manager && typeof this.manager.loadBackgroundImageFallback === 'function' ) {
				this.manager.loadBackgroundImageFallback();
				return;
			}

			// Nothing to do
		}

		_handleLoaded( image, info ) {
			if ( this.manager && typeof this.manager.handleImageLoaded === 'function' ) {
				this.manager.handleImageLoaded( image, info );
			}
		}

		_handleError() {
			if ( this.manager && typeof this.manager.handleImageLoadError === 'function' ) {
				this.manager.handleImageLoadError();
			}
		}

		destroy() {
			this.imageLoader = null;
			this.manager = null;
		}
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.CanvasImageController = CanvasImageController;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CanvasImageController;
	}

}() );
