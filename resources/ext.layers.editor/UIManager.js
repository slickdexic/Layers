/**
 * UI Manager for Layers Editor
 * Handles all UI creation and management
 */
class UIManager {
	constructor( editor ) {
		this.editor = editor;
		this.container = null;
		this.statusBar = null;
		this.spinnerEl = null;
		this.revSelectEl = null;
		this.revLoadBtnEl = null;
		this.revNameInputEl = null;
		this.zoomReadoutEl = null;
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

		this.createHeader();
		this.createToolbar();
		this.createMainContent();
		this.createStatusBar();

		// Create jQuery-style references for compatibility
		this.editor.$canvasContainer = $( this.canvasContainer );
		this.editor.$layerPanel = $( this.layerPanelContainer );
		this.editor.$toolbar = $( this.toolbarContainer );

		this.setupStatusUpdates();
		this.setupRevisionControls();

		// SECURITY FIX: Use mw.log instead of console.log
		if ( mw.log && mw.config.get( 'wgLayersDebug' ) ) {
			mw.log( '[UIManager] createInterface() completed' );
		}
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

		// Revision selector
		const revWrap = this.createRevisionSelector();
		headerRight.appendChild( revWrap );

		// Close button
		const closeBtn = this.createCloseButton();
		headerRight.appendChild( closeBtn );

		return headerRight;
	}

	createRevisionSelector() {
		const revWrap = document.createElement( 'div' );
		revWrap.className = 'layers-revision-wrap';

		const revLabel = document.createElement( 'label' );
		revLabel.className = 'layers-revision-label';
		revLabel.textContent = this.getMessage( 'layers-revision-label' ) + ':';
		revWrap.appendChild( revLabel );

		this.revSelectEl = document.createElement( 'select' );
		this.revSelectEl.className = 'layers-revision-select';
		this.revSelectEl.setAttribute( 'aria-label', 'Select revision to load' );
		revLabel.setAttribute( 'for', 'layers-revision-select-' + Math.random().toString( 36 ).slice( 2, 11 ) );
		this.revSelectEl.id = revLabel.getAttribute( 'for' );
		revWrap.appendChild( this.revSelectEl );

		this.revNameInputEl = document.createElement( 'input' );
		this.revNameInputEl.type = 'text';
		this.revNameInputEl.className = 'layers-revision-name';
		this.revNameInputEl.placeholder = this.getMessage( 'layers-revision-name-placeholder' );
		this.revNameInputEl.setAttribute( 'aria-label', 'Revision name for next save (optional)' );
		this.revNameInputEl.maxLength = 255;
		revWrap.appendChild( this.revNameInputEl );

		this.revLoadBtnEl = document.createElement( 'button' );
		this.revLoadBtnEl.type = 'button';
		this.revLoadBtnEl.className = 'layers-revision-load';
		this.revLoadBtnEl.textContent = this.getMessage( 'layers-revision-load' );
		this.revLoadBtnEl.setAttribute( 'aria-label', 'Load selected revision' );
		revWrap.appendChild( this.revLoadBtnEl );

		return revWrap;
	}

	createCloseButton() {
		const closeBtn = document.createElement( 'button' );
		closeBtn.className = 'layers-header-close';
		closeBtn.type = 'button';
		closeBtn.setAttribute( 'aria-label', this.getMessage( 'layers-editor-close' ) );
		closeBtn.title = this.getMessage( 'layers-editor-close' );
		closeBtn.textContent = '×';
		return closeBtn;
	}

	createToolbar() {
		this.toolbarContainer = document.createElement( 'div' );
		this.toolbarContainer.className = 'layers-toolbar';
		this.container.appendChild( this.toolbarContainer );
	}

	createMainContent() {

		this.content = document.createElement( 'div' );
		this.content.className = 'layers-content';
		this.container.appendChild( this.content );

		const mainRow = document.createElement( 'div' );
		mainRow.className = 'layers-main';
		this.content.appendChild( mainRow );

		this.layerPanelContainer = document.createElement( 'div' );
		this.layerPanelContainer.className = 'layers-panel';
		mainRow.appendChild( this.layerPanelContainer );

		this.canvasContainer = document.createElement( 'div' );
		this.canvasContainer.className = 'layers-canvas-container';
		mainRow.appendChild( this.canvasContainer );
	}

	createStatusBar() {
		this.statusBar = document.createElement( 'div' );
		this.statusBar.className = 'layers-statusbar';

		const statusItems = [
			{ label: this.getMessage( 'layers-status-tool' ), key: 'tool', value: 'pointer' },
			{ label: this.getMessage( 'layers-status-zoom' ), key: 'zoom', value: '100%' },
			{ label: this.getMessage( 'layers-status-pos' ), key: 'pos', value: '0,0' },
			{ label: this.getMessage( 'layers-status-size' ), key: 'size', value: '-' },
			{ label: this.getMessage( 'layers-status-selection' ), key: 'selection', value: '0' }
		];

		statusItems.forEach( item => {
			this.statusBar.appendChild( this.createStatusItem( item.label, item.key, item.value ) );
		} );

		const spacer = document.createElement( 'span' );
		spacer.className = 'status-spacer';
		this.statusBar.appendChild( spacer );

		const statusCode = this.createStatusCode();
		this.statusBar.appendChild( statusCode );

		this.container.appendChild( this.statusBar );
	}

	createStatusItem( labelText, dataKey, initialText ) {
		const item = document.createElement( 'span' );
		item.className = 'status-item';

		const label = document.createElement( 'span' );
		label.className = 'status-label';
		label.textContent = labelText + ':';
		item.appendChild( label );

		const value = document.createElement( 'span' );
		value.className = 'status-value';
		if ( dataKey ) {
			value.setAttribute( 'data-status', dataKey );
		}
		value.textContent = initialText;
		item.appendChild( value );

		return item;
	}

	createStatusCode() {
		const statusCode = document.createElement( 'span' );
		statusCode.className = 'status-code';
		statusCode.setAttribute( 'aria-label', this.getMessage( 'layers-code-title' ) );

		const codeEl = document.createElement( 'code' );
		codeEl.className = 'status-code-text';
		codeEl.title = this.getMessage( 'layers-code-title' );
		statusCode.appendChild( codeEl );

		const copyBtn = document.createElement( 'button' );
		copyBtn.className = 'status-copy-btn';
		copyBtn.type = 'button';
		copyBtn.textContent = this.getMessage( 'layers-code-copy' );
		statusCode.appendChild( copyBtn );

		return statusCode;
	}

	setupStatusUpdates() {
		this.updateZoomReadout = ( percent ) => {
			if ( this.zoomReadoutEl ) {
				this.zoomReadoutEl.textContent = percent + '%';
			}
		};

		this.updateStatus = ( fields ) => {
			if ( !fields || !this.statusBar ) {
				return;
			}

			Object.keys( fields ).forEach( key => {
				const el = this.statusBar.querySelector( `[data-status="${ key }"]` );
				if ( el ) {
					let value = fields[ key ];
					if ( key === 'zoomPercent' ) {
						value = Math.round( value ) + '%';
					} else if ( key === 'pos' && value.x !== undefined && value.y !== undefined ) {
						value = Math.round( value.x ) + ',' + Math.round( value.y );
					} else if ( key === 'size' && value.width !== undefined && value.height !== undefined ) {
						value = Math.round( value.width ) + '×' + Math.round( value.height );
					}
					el.textContent = value;
				}
			} );
		};
	}

	setupRevisionControls() {
		if ( this.revLoadBtnEl ) {
			this.revLoadBtnEl.addEventListener( 'click', () => {
				const val = this.revSelectEl ? parseInt( this.revSelectEl.value, 10 ) || 0 : 0;
				if ( val ) {
					this.editor.loadRevisionById( val );
				}
			} );
		}

		if ( this.revSelectEl ) {
			this.revSelectEl.addEventListener( 'change', () => {
				const v = parseInt( this.revSelectEl.value, 10 ) || 0;
				if ( this.revLoadBtnEl ) {
					const isCurrent = ( this.editor.currentLayerSetId && v === this.editor.currentLayerSetId );
					this.revLoadBtnEl.disabled = !v || isCurrent;
				}
			} );
		}
	}

	getMessage( key, fallback = '' ) {
		return ( mw.message ? mw.message( key ).text() : ( mw.msg ? mw.msg( key ) : fallback ) );
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
		h.textContent = typeof mw !== 'undefined' && mw.message ? 
			mw.message( 'layers-alert-title' ).text() : 'Error';
		errorEl.appendChild( h );

		const p = document.createElement( 'p' );
		p.textContent = String( message || '' );
		errorEl.appendChild( p );

		this.container.appendChild( errorEl );

		setTimeout( () => {
			errorEl.style.opacity = '0';
			setTimeout( () => {
				if ( errorEl.parentNode ) {
					errorEl.parentNode.removeChild( errorEl );
				}
			}, 500 );
		}, 10000 );
	}

	destroy() {
		if ( this.container && this.container.parentNode ) {
			this.container.parentNode.removeChild( this.container );
		}
		this.hideSpinner();
		document.body.classList.remove( 'layers-editor-open' );
	}
}

// Export UIManager to global scope
window.UIManager = UIManager;