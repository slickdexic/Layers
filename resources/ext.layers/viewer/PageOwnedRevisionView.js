/**
 * Page-owned accessible read-only historical revision view host.
 * Presentation and lifecycle component for displaying an authorized exact snapshot.
 *
 * Never fetches data, chooses a revision, renders individual layer types, or edits content.
 *
 * Unregistered presentation component.
 */
'use strict';

( function () {
	const ERROR_CODE = 'layers-invalid-revision-view';
	const ERROR_MESSAGE = 'Invalid revision view';
	const MAX_DIMENSION = 16384;
	const MAX_AREA = 16777216;

	/**
	 * Create a safe fixed error object with code layers-invalid-revision-view.
	 * Never exposes internal or adapter diagnostics.
	 *
	 * @return {Error}
	 */
	function createInvalidRevisionViewError() {
		const err = new Error( ERROR_MESSAGE );
		err.code = ERROR_CODE;
		return err;
	}

	/**
	 * Server-issued rendition of the surface's exact source version.
	 *
	 * @param {*} source
	 * @return {boolean}
	 */
	function isValidSource( source ) {
		return typeof source === 'object' && source !== null && !Array.isArray( source ) &&
			typeof source.url === 'string' && /^https?:\/\//i.test( source.url ) &&
			Number.isInteger( source.width ) && source.width > 0 && source.width <= MAX_DIMENSION &&
			Number.isInteger( source.height ) && source.height > 0 && source.height <= MAX_DIMENSION;
	}

	class PageOwnedRevisionView {
		/**
		 * @param {Object} options
		 * @param {Object} options.bundle Authorized exact snapshot bundle from prepareViewer
		 * @param {string} options.bundle.owner Nonempty owner title
		 * @param {number} options.bundle.revisionId Positive integer revision ID (1..2147483647)
		 * @param {Object} options.bundle.surface Selected slide, image or PDF surface object
		 * @param {Object} [options.bundle.source] Exact source rendition { url, width, height }; required for image/PDF
		 * @param {Object} options.adapter PageOwnedSnapshotAdapter-compatible instance
		 * @param {Function} options.render Injected synchronous renderer factory
		 * @param {Function} options.message Injected localization function
		 * @param {boolean} [options.inline] Replace an embedded image: no caption block, canvas fills the host
		 * @param {string} [options.label] Accessible name for an inline canvas, such as the image's alt text
		 */
		constructor( options ) {
			if ( typeof options !== 'object' || options === null || Array.isArray( options ) ) {
				throw createInvalidRevisionViewError();
			}

			const bundle = options.bundle;
			if ( typeof bundle !== 'object' || bundle === null || Array.isArray( bundle ) ) {
				throw createInvalidRevisionViewError();
			}

			const owner = bundle.owner;
			if ( typeof owner !== 'string' || owner.length === 0 ) {
				throw createInvalidRevisionViewError();
			}

			const revisionId = bundle.revisionId;
			if ( !Number.isInteger( revisionId ) || revisionId < 1 || revisionId > 2147483647 ) {
				throw createInvalidRevisionViewError();
			}

			const surface = bundle.surface;
			if ( typeof surface !== 'object' || surface === null || Array.isArray( surface ) ) {
				throw createInvalidRevisionViewError();
			}

			if ( ![ 'slide', 'image', 'pdf' ].includes( surface.kind ) ) {
				throw createInvalidRevisionViewError();
			}

			const source = surface.kind === 'slide' ? null : bundle.source;
			if ( surface.kind !== 'slide' && !isValidSource( source ) ) {
				throw createInvalidRevisionViewError();
			}

			if ( typeof surface.id !== 'string' || surface.id.length === 0 ) {
				throw createInvalidRevisionViewError();
			}

			const adapter = options.adapter;
			if (
				typeof adapter !== 'object' ||
				adapter === null ||
				typeof adapter.toEditorState !== 'function' ||
				typeof adapter.withEditorState !== 'function'
			) {
				throw createInvalidRevisionViewError();
			}

			const render = options.render;
			if ( typeof render !== 'function' ) {
				throw createInvalidRevisionViewError();
			}

			const message = options.message;
			if ( typeof message !== 'function' ) {
				throw createInvalidRevisionViewError();
			}

			// Validate and deep-copy the surface using the adapter
			const wrapper = {
				schemaVersion: 1,
				surfaces: [ surface ]
			};

			let clonedDoc;
			try {
				const editorState = adapter.toEditorState( wrapper, surface.id );
				clonedDoc = adapter.withEditorState( wrapper, surface.id, editorState );
			} catch ( e ) {
				throw createInvalidRevisionViewError();
			}

			if ( !clonedDoc || !Array.isArray( clonedDoc.surfaces ) || clonedDoc.surfaces.length !== 1 ) {
				throw createInvalidRevisionViewError();
			}

			// Capture immutable owner and revision values and validated surface deep copy
			this._owner = owner;
			this._revisionId = revisionId;
			this._surface = clonedDoc.surfaces[ 0 ];
			this._source = source ? { url: source.url, width: source.width, height: source.height } : null;
			this._render = render;
			this._message = message;
			this._inline = options.inline === true;
			this._label = typeof options.label === 'string' ? options.label : '';

			this._mounted = false;
			this._disposed = false;
			this._figure = null;
			this._cleanupFn = null;
			this._cleanupRun = false;
			this._doCleanup = null;
		}

		/**
		 * Mount the view into the parent element.
		 * Can only be called once per instance.
		 *
		 * @param {HTMLElement} parent
		 */
		mount( parent ) {
			if ( this._mounted || this._disposed ) {
				throw createInvalidRevisionViewError();
			}

			if ( !parent || typeof parent.appendChild !== 'function' || parent.nodeType !== 1 ) {
				throw createInvalidRevisionViewError();
			}

			const canvasConfig = this._surface.canvas;
			if ( typeof canvasConfig !== 'object' || canvasConfig === null ) {
				throw createInvalidRevisionViewError();
			}

			const width = canvasConfig.width;
			const height = canvasConfig.height;

			if (
				!Number.isInteger( width ) || width <= 0 ||
				!Number.isInteger( height ) || height <= 0 ||
				width > MAX_DIMENSION || height > MAX_DIMENSION ||
				( width * height ) > MAX_AREA
			) {
				throw createInvalidRevisionViewError();
			}

			this._mounted = true;
			const inline = this._inline;

			const figure = document.createElement( inline ? 'span' : 'figure' );
			figure.className = inline ? 'ext-layers-historical-view ext-layers-historical-view--inline' :
				'ext-layers-historical-view';

			const caption = document.createElement( 'figcaption' );
			caption.className = 'ext-layers-historical-caption';

			const label = typeof this._surface.label === 'string' ?
				this._surface.label :
				this._surface.id;

			const captionText = String( this._message(
				'layers-page-history-caption',
				this._owner,
				this._revisionId,
				label
			) );
			caption.textContent = captionText;

			const canvas = document.createElement( 'canvas' );
			canvas.className = 'ext-layers-historical-canvas';
			canvas.width = width;
			canvas.height = height;
			canvas.setAttribute( 'aria-label', inline && this._label ? this._label : captionText );
			if ( inline ) {
				canvas.setAttribute( 'role', 'img' );
				canvas.style.width = '100%';
			}
			canvas.style.maxWidth = '100%';
			canvas.style.height = 'auto';

			const status = document.createElement( inline ? 'span' : 'div' );
			status.className = 'ext-layers-historical-status';
			status.setAttribute( 'role', 'status' );
			status.setAttribute( 'aria-live', 'polite' );

			if ( !inline ) {
				figure.appendChild( caption );
			}
			figure.appendChild( canvas );
			figure.appendChild( status );
			parent.appendChild( figure );

			this._figure = figure;

			let renderFailed = false;

			const doCleanup = () => {
				if ( this._cleanupRun ) {
					return;
				}
				if ( typeof this._cleanupFn === 'function' ) {
					this._cleanupRun = true;
					try {
						this._cleanupFn();
					} catch ( e ) {
						// Cleanup exceptions must not prevent owned DOM removal or cause diagnostic leakage
					}
				}
			};
			this._doCleanup = doCleanup;

			const handleFailure = () => {
				if ( this._disposed || renderFailed ) {
					return;
				}
				renderFailed = true;
				if ( canvas.parentNode ) {
					canvas.parentNode.removeChild( canvas );
				}
				status.textContent = String( this._message( 'layers-page-history-render-failed' ) );
				doCleanup();
			};

			// Pass a separate deep copy of the surface to the renderer
			const surfaceCopy = JSON.parse( JSON.stringify( this._surface ) );

			let returnedCleanup;
			try {
				returnedCleanup = this._render( canvas, surfaceCopy, handleFailure,
					this._source ? Object.assign( {}, this._source ) : null );
			} catch ( err ) {
				handleFailure();
				return;
			}

			if ( typeof returnedCleanup !== 'function' ) {
				handleFailure();
				return;
			}

			this._cleanupFn = returnedCleanup;
			if ( renderFailed || this._disposed ) {
				doCleanup();
			}
		}

		/**
		 * Idempotent disposal of this component.
		 * Removes only this component's DOM, invokes cleanup once, and makes late callbacks inert.
		 */
		dispose() {
			if ( this._disposed ) {
				return;
			}
			this._disposed = true;

			if ( this._figure && this._figure.parentNode ) {
				this._figure.parentNode.removeChild( this._figure );
			}

			if ( typeof this._doCleanup === 'function' ) {
				this._doCleanup();
			}
		}
	}

	// Export for ResourceLoader
	window.Layers = window.Layers || {};
	window.Layers.Viewer = window.Layers.Viewer || {};
	window.Layers.Viewer.PageOwnedRevisionView = PageOwnedRevisionView;

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedRevisionView;
	}
}() );
