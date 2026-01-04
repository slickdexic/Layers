/**
 * UI Manager for Layers Editor
 * Handles all UI creation and management
 */
( function () {
	'use strict';

	// Use shared namespace helper (loaded via utils/NamespaceHelper.js)
	const getClass = ( typeof window !== 'undefined' && window.Layers && window.Layers.Utils && window.Layers.Utils.getClass ) ||
		( typeof window !== 'undefined' && window.layersGetClass ) ||
		function ( namespacePath, globalName ) {
			// Minimal fallback for environments where NamespaceHelper hasn't loaded
			if ( typeof window !== 'undefined' ) {
				// Check global first
				if ( window[ globalName ] ) {
					return window[ globalName ];
				}
				// Check in Layers namespace hierarchy
				if ( window.Layers ) {
					// Check common namespaces
					if ( namespacePath.startsWith( 'UI.' ) && window.Layers.UI && window.Layers.UI[ globalName ] ) {
						return window.Layers.UI[ globalName ];
					}
					if ( namespacePath.startsWith( 'Utils.' ) && window.Layers.Utils && window.Layers.Utils[ globalName ] ) {
						return window.Layers.Utils[ globalName ];
					}
					if ( namespacePath.startsWith( 'Core.' ) && window.Layers.Core && window.Layers.Core[ globalName ] ) {
						return window.Layers.Core[ globalName ];
					}
				}
			}
			return null;
		};

	class UIManager {
	constructor( editor ) {
		this.editor = editor;
		this.container = null;
		this.spinnerEl = null;
		// Named Set selector elements (managed by SetSelectorController)
		this.setSelectEl = null;
		this.newSetInputEl = null;
		this.newSetBtnEl = null;
		// Revision selector elements
		this.revSelectEl = null;
		this.revLoadBtnEl = null;
		this.revNameInputEl = null;
		this.zoomReadoutEl = null;

		/**
		 * Tracked timeout IDs for cleanup
		 * @type {Set<number>}
		 */
		this.activeTimeouts = new Set();

		// Initialize EventTracker for memory-safe event listener management
		const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
		this.eventTracker = EventTracker ? new EventTracker() : null;

		// Initialize SetSelectorController for managing named layer sets
		const SetSelectorController = getClass( 'UI.SetSelectorController', 'SetSelectorController' );
		this.setSelectorController = SetSelectorController ? new SetSelectorController( this ) : null;
	}

	/**
	 * Schedule a timeout with automatic tracking for cleanup.
	 *
	 * @param {Function} callback - Function to execute after delay
	 * @param {number} delay - Delay in milliseconds
	 * @return {number} Timeout ID
	 * @private
	 */
	_scheduleTimeout( callback, delay ) {
		const timeoutId = setTimeout( () => {
			this.activeTimeouts.delete( timeoutId );
			callback();
		}, delay );
		this.activeTimeouts.add( timeoutId );
		return timeoutId;
	}

	/**
	 * Add event listener with memory-safe tracking
	 * @param {EventTarget} element - Element to attach listener to
	 * @param {string} event - Event type
	 * @param {Function} handler - Event handler
	 * @param {Object|boolean} [options] - Event listener options
	 */
	addListener( element, event, handler, options ) {
		if ( !element || typeof element.addEventListener !== 'function' ) {
			return;
		}
		if ( this.eventTracker ) {
			this.eventTracker.add( element, event, handler, options );
		} else {
			// Fallback if EventTracker not available
			element.addEventListener( event, handler, options );
		}
	}

	/**
	 * Create the main editor interface
	 */
	createInterface() {
		// Always create a full-screen overlay container at body level
		this.container = document.createElement( 'div' );
		this.container.className = 'layers-editor';
		this.container.setAttribute( 'role', 'application' );
		this.container.setAttribute( 'aria-label', 'Layers Image Editor' );
		document.body.appendChild( this.container );

		// Add body class to hide skin chrome while editor is open
		document.body.classList.add( 'layers-editor-open' );

		// Add skip links for accessibility
		this.createSkipLinks();

		this.createHeader();
		this.createToolbar();
		this.createMainContent();

		// Create jQuery-style references for compatibility
		this.editor.$canvasContainer = $( this.canvasContainer );
		this.editor.$layerPanel = $( this.layerPanelContainer );
		this.editor.$toolbar = $( this.toolbarContainer );

		this.setupRevisionControls();

		// SECURITY FIX: Use mw.log instead of console.log
		if ( mw.log && mw.config.get( 'wgLayersDebug' ) ) {
			mw.log( '[UIManager] createInterface() completed' );
		}
	}

	/**
	 * Create skip links for keyboard navigation accessibility
	 * @see https://www.w3.org/WAI/tutorials/page-structure/bypass/
	 */
	createSkipLinks() {
		const skipLinksContainer = document.createElement( 'div' );
		skipLinksContainer.className = 'layers-skip-links';

		const skipLinks = [
			{ target: 'layers-toolbar-section', label: this.getMessage( 'layers-skip-to-toolbar', 'Skip to toolbar' ) },
			{ target: 'layers-canvas-section', label: this.getMessage( 'layers-skip-to-canvas', 'Skip to canvas' ) },
			{ target: 'layers-panel-section', label: this.getMessage( 'layers-skip-to-layers', 'Skip to layers panel' ) }
		];

		skipLinks.forEach( link => {
			const a = document.createElement( 'a' );
			a.href = '#' + link.target;
			a.className = 'layers-skip-link';
			a.textContent = link.label;
			// Handle click to focus the target element
			this.addListener( a, 'click', ( e ) => {
				e.preventDefault();
				const target = document.getElementById( link.target );
				if ( target ) {
					target.focus();
					target.scrollIntoView( { behavior: 'smooth', block: 'start' } );
				}
			} );
			skipLinksContainer.appendChild( a );
		} );

		this.container.appendChild( skipLinksContainer );
	}

	createHeader() {
		const header = document.createElement( 'div' );
		header.className = 'layers-header';
		header.setAttribute( 'role', 'banner' );

		const title = document.createElement( 'div' );
		title.className = 'layers-header-title';
		title.setAttribute( 'role', 'heading' );
		title.setAttribute( 'aria-level', '1' );
		title.textContent = this.getMessage( 'layers-editor-title' ) +
			( this.editor.filename ? ' — ' + this.editor.filename : '' );
		header.appendChild( title );

		const headerRight = this.createHeaderRight();
		header.appendChild( headerRight );

		this.container.appendChild( header );
	}

	createHeaderRight() {
		const headerRight = document.createElement( 'div' );
		headerRight.className = 'layers-header-right';

		// Zoom readout
		this.zoomReadoutEl = document.createElement( 'span' );
		this.zoomReadoutEl.className = 'layers-zoom-readout';
		this.zoomReadoutEl.setAttribute( 'aria-label', 'Current zoom level' );
		this.zoomReadoutEl.textContent = '100%';
		headerRight.appendChild( this.zoomReadoutEl );

		// Named Set selector (primary grouping)
		const setWrap = this.createSetSelector();
		headerRight.appendChild( setWrap );

		// Separator
		const separator = document.createElement( 'span' );
		separator.className = 'layers-header-separator';
		separator.setAttribute( 'aria-hidden', 'true' );
		headerRight.appendChild( separator );

		// Revision selector (within the selected set)
		const revWrap = this.createRevisionSelector();
		headerRight.appendChild( revWrap );

		// Close button
		const closeBtn = this.createCloseButton();
		headerRight.appendChild( closeBtn );

		return headerRight;
	}

	/**
	 * Create the Named Set selector UI
	 * Delegates to SetSelectorController for implementation
	 * @return {HTMLElement} The set selector wrapper element
	 */
	createSetSelector() {
		// Delegate to SetSelectorController if available
		if ( this.setSelectorController ) {
			return this.setSelectorController.createSetSelector();
		}

		// Minimal fallback if controller not available
		const setWrap = document.createElement( 'div' );
		setWrap.className = 'layers-set-wrap';
		return setWrap;
	}

	createRevisionSelector() {
		const revWrap = document.createElement( 'div' );
		revWrap.className = 'layers-revision-wrap';
		revWrap.setAttribute( 'role', 'group' );
		revWrap.setAttribute( 'aria-label', this.getMessage( 'layers-revision-group' ) );

		const revLabel = document.createElement( 'label' );
		revLabel.className = 'layers-revision-label';
		revLabel.textContent = this.getMessage( 'layers-revision-label' ) + ':';
		const revSelectId = 'layers-revision-select-' + Math.random().toString( 36 ).slice( 2, 11 );
		revLabel.setAttribute( 'for', revSelectId );
		revWrap.appendChild( revLabel );

		this.revSelectEl = document.createElement( 'select' );
		this.revSelectEl.className = 'layers-revision-select';
		this.revSelectEl.id = revSelectId;
		this.revSelectEl.setAttribute( 'aria-label', this.getMessage( 'layers-revision-select-aria' ) );
		revWrap.appendChild( this.revSelectEl );

		this.revLoadBtnEl = document.createElement( 'button' );
		this.revLoadBtnEl.type = 'button';
		this.revLoadBtnEl.className = 'layers-revision-load';
		this.revLoadBtnEl.textContent = this.getMessage( 'layers-revision-load' );
		this.revLoadBtnEl.setAttribute( 'aria-label', this.getMessage( 'layers-revision-load-aria' ) );
		revWrap.appendChild( this.revLoadBtnEl );

		return revWrap;
	}

	createCloseButton() {
		const closeBtn = document.createElement( 'button' );
		closeBtn.className = 'layers-header-close';
		closeBtn.type = 'button';
		closeBtn.setAttribute( 'aria-label', this.getMessage( 'layers-editor-close' ) );
		closeBtn.title = this.getMessage( 'layers-editor-close' ) + ' (Esc)';
		// SVG close icon - larger and more visible than × character
		closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
		return closeBtn;
	}

	createToolbar() {
		this.toolbarContainer = document.createElement( 'div' );
		this.toolbarContainer.id = 'layers-toolbar-section';
		this.toolbarContainer.className = 'layers-toolbar';
		this.toolbarContainer.setAttribute( 'role', 'navigation' );
		this.toolbarContainer.setAttribute( 'aria-label', this.getMessage( 'layers-toolbar-region', 'Editor tools' ) );
		this.toolbarContainer.setAttribute( 'tabindex', '-1' );
		this.container.appendChild( this.toolbarContainer );
	}

	createMainContent() {

		this.content = document.createElement( 'div' );
		this.content.className = 'layers-content';
		this.content.setAttribute( 'role', 'main' );
		this.content.setAttribute( 'aria-label', this.getMessage( 'layers-main-region', 'Editor workspace' ) );
		this.container.appendChild( this.content );

		const mainRow = document.createElement( 'div' );
		mainRow.className = 'layers-main';
		this.content.appendChild( mainRow );

		this.layerPanelContainer = document.createElement( 'div' );
		this.layerPanelContainer.id = 'layers-panel-section';
		this.layerPanelContainer.className = 'layers-panel';
		this.layerPanelContainer.setAttribute( 'role', 'complementary' );
		this.layerPanelContainer.setAttribute( 'aria-label', this.getMessage( 'layers-panel-region', 'Layers panel' ) );
		this.layerPanelContainer.setAttribute( 'tabindex', '-1' );
		mainRow.appendChild( this.layerPanelContainer );

		this.canvasContainer = document.createElement( 'div' );
		this.canvasContainer.id = 'layers-canvas-section';
		this.canvasContainer.className = 'layers-canvas-container';
		this.canvasContainer.setAttribute( 'role', 'region' );
		this.canvasContainer.setAttribute( 'aria-label', this.getMessage( 'layers-canvas-region', 'Drawing canvas' ) );
		this.canvasContainer.setAttribute( 'tabindex', '-1' );
		mainRow.appendChild( this.canvasContainer );
	}

	setupRevisionControls() {
		// Set selector controls
		this.setupSetSelectorControls();

		// Revision load button
		if ( this.revLoadBtnEl ) {
			this.addListener( this.revLoadBtnEl, 'click', () => {
				const val = this.revSelectEl ? parseInt( this.revSelectEl.value, 10 ) || 0 : 0;
				if ( val ) {
					this.editor.loadRevisionById( val );
				}
			} );
		}

		// Revision selector change
		if ( this.revSelectEl ) {
			this.addListener( this.revSelectEl, 'change', () => {
				const v = parseInt( this.revSelectEl.value, 10 ) || 0;
				if ( this.revLoadBtnEl ) {
					const currentId = this.editor.stateManager ?
						this.editor.stateManager.get( 'currentLayerSetId' ) :
						this.editor.currentLayerSetId;
					const isCurrent = ( currentId && v === currentId );
					this.revLoadBtnEl.disabled = !v || isCurrent;
				}
			} );
		}
	}

	/**
	 * Set up event handlers for the Named Set selector
	 * Delegates to SetSelectorController for implementation
	 */
	setupSetSelectorControls() {
		// Delegate to SetSelectorController if available
		if ( this.setSelectorController ) {
			this.setSelectorController.setupControls();
		}
	}

	/**
	 * Show or hide the new set input field
	 * Delegates to SetSelectorController
	 * @param {boolean} show Whether to show the input
	 */
	showNewSetInput( show ) {
		if ( this.setSelectorController ) {
			this.setSelectorController.showNewSetInput( show );
		}
	}

	/**
	 * Create a new named set from the input field
	 * Delegates to SetSelectorController
	 */
	createNewSet() {
		if ( this.setSelectorController ) {
			this.setSelectorController.createNewSet();
		}
	}

	/**
	 * Delete the current layer set with confirmation
	 * Delegates to SetSelectorController
	 * @return {Promise<void>}
	 */
	async deleteCurrentSet() {
		if ( this.setSelectorController ) {
			return this.setSelectorController.deleteCurrentSet();
		}
	}

	/**
	 * Rename the current layer set
	 * Delegates to SetSelectorController
	 * @return {Promise<void>}
	 */
	async renameCurrentSet() {
		if ( this.setSelectorController ) {
			return this.setSelectorController.renameCurrentSet();
		}
	}

	/**
	 * Add a new option to the set selector
	 * Delegates to SetSelectorController
	 * @param {string} name Set name
	 * @param {boolean} select Whether to select the new option
	 */
	addSetOption( name, select = false ) {
		if ( this.setSelectorController ) {
			this.setSelectorController.addSetOption( name, select );
		}
	}

	getMessage( key, fallback = '' ) {
		const messages = getClass( 'Core.Messages', 'layersMessages' );
		return messages ? messages.get( key, fallback ) : fallback;
	}

	/**
	 * Show a confirmation dialog using DialogManager
	 * Replaces window.confirm() with an accessible, styled dialog
	 *
	 * @param {Object} options - Dialog options
	 * @param {string} options.message - The confirmation message
	 * @param {string} [options.title] - Dialog title
	 * @param {string} [options.confirmText] - Text for confirm button
	 * @param {string} [options.cancelText] - Text for cancel button
	 * @param {boolean} [options.isDanger] - Whether this is a dangerous action
	 * @return {Promise<boolean>} Resolves to true if confirmed, false if cancelled
	 */
	async showConfirmDialog( options ) {
		if ( this.editor && this.editor.dialogManager ) {
			return this.editor.dialogManager.showConfirmDialog( options );
		}
		// Fallback to native confirm if DialogManager not available
		// eslint-disable-next-line no-alert
		return window.confirm( options.message );
	}

	/**
	 * Show an alert dialog using DialogManager
	 * Replaces window.alert() with an accessible, styled dialog
	 *
	 * @param {Object} options - Dialog options
	 * @param {string} options.message - The alert message
	 * @param {string} [options.title] - Dialog title
	 * @param {string} [options.buttonText] - Text for the OK button
	 * @param {boolean} [options.isError] - Whether this is an error message
	 * @return {Promise<void>} Resolves when dialog is dismissed
	 */
	async showAlertDialog( options ) {
		if ( this.editor && this.editor.dialogManager ) {
			return this.editor.dialogManager.showAlertDialog( options );
		}
		// Fallback to native alert if DialogManager not available
		// eslint-disable-next-line no-alert
		window.alert( options.message );
	}

	/**
	 * Show a prompt dialog using DialogManager
	 * Replaces window.prompt() with an accessible, styled dialog
	 *
	 * @param {Object} options - Dialog options
	 * @param {string} options.message - The prompt message
	 * @param {string} [options.title] - Dialog title
	 * @param {string} [options.defaultValue] - Default input value
	 * @param {string} [options.placeholder] - Input placeholder
	 * @param {string} [options.confirmText] - Text for confirm button
	 * @param {string} [options.cancelText] - Text for cancel button
	 * @return {Promise<string|null>} Resolves to input value if confirmed, null if cancelled
	 */
	async showPromptDialog( options ) {
		if ( this.editor && this.editor.dialogManager ) {
			return this.editor.dialogManager.showPromptDialogAsync( options );
		}
		// Fallback to native prompt if DialogManager not available
		// eslint-disable-next-line no-alert
		return window.prompt( options.message, options.defaultValue || '' );
	}

	showSpinner( message ) {
		this.hideSpinner();
		this.spinnerEl = document.createElement( 'div' );
		this.spinnerEl.className = 'layers-spinner';
		this.spinnerEl.setAttribute( 'role', 'status' );
		this.spinnerEl.setAttribute( 'aria-live', 'polite' );

		const spinnerIcon = document.createElement( 'span' );
		spinnerIcon.className = 'spinner';
		this.spinnerEl.appendChild( spinnerIcon );

		const textNode = document.createElement( 'span' );
		textNode.className = 'spinner-text';
		textNode.textContent = ' ' + ( message || '' );
		this.spinnerEl.appendChild( textNode );

		this.container.appendChild( this.spinnerEl );
	}

	hideSpinner() {
		if ( this.spinnerEl ) {
			this.spinnerEl.remove();
			this.spinnerEl = null;
		}
	}

	showError( message ) {
		const errorEl = document.createElement( 'div' );
		errorEl.className = 'layers-error';
		errorEl.style.cssText = `
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: white;
			padding: 20px;
			border: 2px solid #d63638;
			border-radius: 8px;
			z-index: 10001;
			max-width: 400px;
			box-shadow: 0 4px 20px rgba(0,0,0,0.3);
		`;

		const h = document.createElement( 'h3' );
		h.textContent = this.getMessage( 'layers-alert-title', 'Error' );
		errorEl.appendChild( h );

		const p = document.createElement( 'p' );
		p.textContent = String( message || '' );
		errorEl.appendChild( p );

		this.container.appendChild( errorEl );

		this._scheduleTimeout( () => {
			errorEl.style.opacity = '0';
			this._scheduleTimeout( () => {
				if ( errorEl.parentNode ) {
					errorEl.parentNode.removeChild( errorEl );
				}
			}, 500 );
		}, 10000 );
	}

	destroy() {
		// Cancel all tracked timeouts to prevent memory leaks
		if ( this.activeTimeouts ) {
			this.activeTimeouts.forEach( ( timeoutId ) => {
				clearTimeout( timeoutId );
			} );
			this.activeTimeouts.clear();
		}

		// Clean up all tracked event listeners
		if ( this.eventTracker ) {
			this.eventTracker.destroy();
			this.eventTracker = null;
		}

		if ( this.container && this.container.parentNode ) {
			this.container.parentNode.removeChild( this.container );
		}
		this.hideSpinner();
		document.body.classList.remove( 'layers-editor-open' );

		// Clear element references
		this.container = null;
		this.setSelectEl = null;
		this.newSetInputEl = null;
		this.newSetBtnEl = null;
		this.revSelectEl = null;
		this.revLoadBtnEl = null;
		this.zoomReadoutEl = null;
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.Manager = UIManager;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = UIManager;
	}

}() );