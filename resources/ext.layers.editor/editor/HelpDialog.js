/**
 * HelpDialog - Built-in user guide for the Layers Editor
 *
 * Provides a tabbed help interface with:
 * - Overview: Getting started basics
 * - Tools: All drawing tools with icons and descriptions
 * - Shortcuts: Keyboard shortcuts reference
 * - Tips: Best practices and troubleshooting
 *
 * @class HelpDialog
 */
( function () {
	'use strict';

	/**
	 * HelpDialog provides comprehensive in-editor help
	 *
	 * @param {Object} config Configuration object
	 * @param {Function} config.getMessage Function to get localized messages (optional, uses mw.message by default)
	 */
	class HelpDialog {
		constructor( config = {} ) {
			// Use mw.message by default if available
			this.getMessage = config.getMessage || ( ( key, fallback ) => {
				if ( typeof mw !== 'undefined' && mw.message ) {
					const msg = mw.message( key );
					if ( msg.exists() ) {
						return msg.text();
					}
				}
				return fallback || key;
			} );
			this.activeTab = 'overview';
			this.dialog = null;
			this.overlay = null;
		}

		/**
		 * Get tool icon SVGs (subset from Toolbar)
		 * @return {Object} Tool icons
		 * @private
		 */
		getToolIcons() {
			const size = 20;
			const stroke = 'currentColor';
			const fill = 'none';
			const sw = 2;

			return {
				pointer: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>`,
				text: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
				textbox: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="12" y2="16"/></svg>`,
				callout: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
				rectangle: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
				circle: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>`,
				ellipse: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>`,
				polygon: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 9 18.5 21 5.5 21 2 9 12 2"/></svg>`,
				star: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
				arrow: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="12 5 19 5 19 12"/></svg>`,
				line: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>`,
				marker: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="7"/><text x="12" y="13" font-size="9" font-weight="bold" text-anchor="middle" fill="${stroke}" stroke="none">1</text><line x1="12" y1="17" x2="12" y2="22"/><polyline points="9,19 12,22 15,19"/></svg>`,
				dimension: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="8" x2="4" y2="16"/><line x1="20" y1="8" x2="20" y2="16"/><polyline points="7,10 4,12 7,14" fill="none"/><polyline points="17,10 20,12 17,14" fill="none"/></svg>`,
				pen: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`,
				shapes: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><polygon points="6.5 21 3 14 10 14 6.5 21"/><circle cx="17.5" cy="17.5" r="3.5"/></svg>`,
				emoji: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`
			};
		}

		/**
		 * Show the help dialog
		 */
		show() {
			if ( this.dialog ) {
				return; // Already open
			}

			try {
				this.createOverlay();
				this.createDialog();
				this.renderContent();

				document.body.appendChild( this.overlay );
				document.body.appendChild( this.dialog );

				// Focus first tab button
				const firstTab = this.dialog.querySelector( '.layers-help-tab' );
				if ( firstTab ) {
					firstTab.focus();
				}

				// Setup keyboard handling
				this.handleKeydown = ( e ) => {
					if ( e.key === 'Escape' ) {
						this.close();
					}
				};
				document.addEventListener( 'keydown', this.handleKeydown );
			} catch ( error ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[HelpDialog] show() error:', error );
				}
			}
		}

		/**
		 * Create modal overlay
		 * @private
		 */
		createOverlay() {
			this.overlay = document.createElement( 'div' );
			this.overlay.className = 'layers-help-overlay';
			this.overlay.setAttribute( 'role', 'presentation' );
			this.overlay.addEventListener( 'click', () => this.close() );
		}

		/**
		 * Create dialog container
		 * @private
		 */
		createDialog() {
			this.dialog = document.createElement( 'div' );
			this.dialog.className = 'layers-help-dialog';
			this.dialog.setAttribute( 'role', 'dialog' );
			this.dialog.setAttribute( 'aria-modal', 'true' );
			this.dialog.setAttribute( 'aria-label', this.getMessage( 'layers-help-title', 'Layers Editor Help' ) );

			// Header with title and close button
			const header = document.createElement( 'div' );
			header.className = 'layers-help-header';

			const title = document.createElement( 'h2' );
			title.className = 'layers-help-title';
			title.textContent = this.getMessage( 'layers-help-title', 'Layers Editor Help' );
			header.appendChild( title );

			const closeBtn = document.createElement( 'button' );
			closeBtn.className = 'layers-help-close';
			closeBtn.innerHTML = '&times;';
			closeBtn.setAttribute( 'aria-label', this.getMessage( 'layers-help-close', 'Close' ) );
			closeBtn.addEventListener( 'click', () => this.close() );
			header.appendChild( closeBtn );

			this.dialog.appendChild( header );

			// Tab bar
			const tabBar = document.createElement( 'div' );
			tabBar.className = 'layers-help-tabs';
			tabBar.setAttribute( 'role', 'tablist' );

			const tabs = [
				{ id: 'overview', label: this.getMessage( 'layers-help-tab-overview', 'Overview' ) },
				{ id: 'tools', label: this.getMessage( 'layers-help-tab-tools', 'Tools' ) },
				{ id: 'shortcuts', label: this.getMessage( 'layers-help-tab-shortcuts', 'Shortcuts' ) },
				{ id: 'tips', label: this.getMessage( 'layers-help-tab-tips', 'Tips' ) }
			];

			tabs.forEach( ( tab ) => {
				const btn = document.createElement( 'button' );
				btn.className = 'layers-help-tab' + ( tab.id === this.activeTab ? ' active' : '' );
				btn.setAttribute( 'role', 'tab' );
				btn.setAttribute( 'aria-selected', tab.id === this.activeTab );
				btn.setAttribute( 'aria-controls', 'layers-help-panel-' + tab.id );
				btn.dataset.tab = tab.id;
				btn.textContent = tab.label;
				btn.addEventListener( 'click', () => this.switchTab( tab.id ) );
				tabBar.appendChild( btn );
			} );

			this.dialog.appendChild( tabBar );

			// Content area
			this.contentArea = document.createElement( 'div' );
			this.contentArea.className = 'layers-help-content';
			this.dialog.appendChild( this.contentArea );
		}

		/**
		 * Switch to a different tab
		 * @param {string} tabId Tab identifier
		 * @private
		 */
		switchTab( tabId ) {
			this.activeTab = tabId;

			// Update tab buttons
			const tabs = this.dialog.querySelectorAll( '.layers-help-tab' );
			tabs.forEach( ( tab ) => {
				const isActive = tab.dataset.tab === tabId;
				tab.classList.toggle( 'active', isActive );
				tab.setAttribute( 'aria-selected', isActive );
			} );

			// Re-render content
			this.renderContent();
		}

		/**
		 * Render content for current tab
		 * @private
		 */
		renderContent() {
			this.contentArea.innerHTML = '';

			const panel = document.createElement( 'div' );
			panel.className = 'layers-help-panel';
			panel.setAttribute( 'role', 'tabpanel' );
			panel.id = 'layers-help-panel-' + this.activeTab;

			switch ( this.activeTab ) {
				case 'overview':
					this.renderOverview( panel );
					break;
				case 'tools':
					this.renderTools( panel );
					break;
				case 'shortcuts':
					this.renderShortcuts( panel );
					break;
				case 'tips':
					this.renderTips( panel );
					break;
			}

			this.contentArea.appendChild( panel );
		}

		/**
		 * Render overview tab content
		 * @param {HTMLElement} panel Panel element
		 * @private
		 */
		renderOverview( panel ) {
			const msg = this.getMessage.bind( this );

			const content = `
				<h3>${msg( 'layers-help-overview-title', 'Getting Started' )}</h3>
				<p>${msg( 'layers-help-overview-intro', 'The Layers Editor lets you add annotations, shapes, and text overlays to images on your wiki.' )}</p>

				<h4>${msg( 'layers-help-overview-interface', 'Interface' )}</h4>
				<ul>
					<li><strong>${msg( 'layers-help-overview-toolbar', 'Toolbar' )}</strong> — ${msg( 'layers-help-overview-toolbar-desc', 'Located at the top. Contains drawing tools, zoom controls, and action buttons.' )}</li>
					<li><strong>${msg( 'layers-help-overview-canvas', 'Canvas' )}</strong> — ${msg( 'layers-help-overview-canvas-desc', 'The main drawing area showing the image with your annotations.' )}</li>
					<li><strong>${msg( 'layers-help-overview-panel', 'Layer Panel' )}</strong> — ${msg( 'layers-help-overview-panel-desc', 'Located on the right. Shows all layers, visibility controls, and properties.' )}</li>
				</ul>

				<h4>${msg( 'layers-help-overview-workflow', 'Basic Workflow' )}</h4>
				<ol>
					<li>${msg( 'layers-help-overview-step1', 'Select a tool from the toolbar (or press its keyboard shortcut).' )}</li>
					<li>${msg( 'layers-help-overview-step2', 'Click and drag on the canvas to create a shape or annotation.' )}</li>
					<li>${msg( 'layers-help-overview-step3', 'Use the Properties panel to customize colors, size, and other settings.' )}</li>
					<li>${msg( 'layers-help-overview-step4', 'Click Save when finished to store your annotations.' )}</li>
				</ol>

				<h4>${msg( 'layers-help-overview-selection', 'Selecting & Editing' )}</h4>
				<ul>
					<li>${msg( 'layers-help-overview-select-single', 'Click a layer to select it.' )}</li>
					<li>${msg( 'layers-help-overview-select-multi', 'Ctrl+Click to add layers to selection.' )}</li>
					<li>${msg( 'layers-help-overview-select-range', 'Shift+Click to select a range of layers.' )}</li>
					<li>${msg( 'layers-help-overview-resize', 'Drag corner handles to resize selected layers.' )}</li>
					<li>${msg( 'layers-help-overview-rotate', 'Drag the rotation handle (above selection) to rotate.' )}</li>
				</ul>
			`;

			panel.innerHTML = content;
		}

		/**
		 * Render tools tab content
		 * @param {HTMLElement} panel Panel element
		 * @private
		 */
		renderTools( panel ) {
			const msg = this.getMessage.bind( this );
			const icons = this.getToolIcons();

			const tools = [
				{
					id: 'pointer',
					name: msg( 'layers-tool-select', 'Select' ),
					key: 'V',
					desc: msg( 'layers-help-tool-pointer', 'Select, move, and resize layers. Click to select, drag to move, use handles to resize or rotate.' )
				},
				{
					id: 'text',
					name: msg( 'layers-tool-text', 'Text' ),
					key: 'T',
					desc: msg( 'layers-help-tool-text', 'Add simple text labels. Click to place text, then type. Best for short labels.' )
				},
				{
					id: 'textbox',
					name: msg( 'layers-tool-textbox', 'Text Box' ),
					key: 'X',
					desc: msg( 'layers-help-tool-textbox', 'Add text in a resizable box. Supports word wrap, background color, and borders. Best for longer text.' )
				},
				{
					id: 'callout',
					name: msg( 'layers-tool-callout', 'Callout' ),
					key: 'B',
					desc: msg( 'layers-help-tool-callout', 'Create speech bubbles or callout boxes with a pointer tail. Great for annotations pointing to specific areas.' )
				},
				{
					id: 'rectangle',
					name: msg( 'layers-tool-rectangle', 'Rectangle' ),
					key: 'R',
					desc: msg( 'layers-help-tool-rectangle', 'Draw rectangles and squares. Hold Shift for perfect squares. Adjust corner radius for rounded corners.' )
				},
				{
					id: 'circle',
					name: msg( 'layers-tool-circle', 'Circle' ),
					key: 'C',
					desc: msg( 'layers-help-tool-circle', 'Draw perfect circles. Use for highlighting circular areas or creating bullet points.' )
				},
				{
					id: 'ellipse',
					name: msg( 'layers-tool-ellipse', 'Ellipse' ),
					key: 'E',
					desc: msg( 'layers-help-tool-ellipse', 'Draw ovals and ellipses. More flexible than circles for highlighting irregular areas.' )
				},
				{
					id: 'polygon',
					name: msg( 'layers-tool-polygon', 'Polygon' ),
					key: 'Y',
					desc: msg( 'layers-help-tool-polygon', 'Draw multi-sided shapes. Adjust the number of sides in properties (3 for triangle, 6 for hexagon, etc.).' )
				},
				{
					id: 'star',
					name: msg( 'layers-tool-star', 'Star' ),
					key: 'S',
					desc: msg( 'layers-help-tool-star', 'Draw stars with customizable points. Adjust inner/outer radius for different star styles.' )
				},
				{
					id: 'arrow',
					name: msg( 'layers-tool-arrow', 'Arrow' ),
					key: 'A',
					desc: msg( 'layers-help-tool-arrow', 'Draw arrows for pointing or indicating direction. Choose from various head styles and make curved arrows.' )
				},
				{
					id: 'line',
					name: msg( 'layers-tool-line', 'Line' ),
					key: 'L',
					desc: msg( 'layers-help-tool-line', 'Draw straight lines. Use for underlining, connecting elements, or simple diagrams.' )
				},
				{
					id: 'marker',
					name: msg( 'layers-tool-marker', 'Marker' ),
					key: 'M',
					desc: msg( 'layers-help-tool-marker', 'Add numbered or lettered markers. Auto-numbers sequentially. Great for step-by-step instructions.' )
				},
				{
					id: 'dimension',
					name: msg( 'layers-tool-dimension', 'Dimension' ),
					key: 'D',
					desc: msg( 'layers-help-tool-dimension', 'Add measurement annotations with extension lines. Shows distance with customizable units.' )
				},
				{
					id: 'pen',
					name: msg( 'layers-tool-pen', 'Pen' ),
					key: 'P',
					desc: msg( 'layers-help-tool-pen', 'Draw freeform paths by clicking to add points. Double-click to finish. Creates smooth curves.' )
				},
				{
					id: 'shapes',
					name: msg( 'layers-shape-library', 'Shape Library' ),
					key: 'G',
					desc: msg( 'layers-help-tool-shapes', 'Browse 5,000+ pre-made shapes including arrows, flowchart symbols, icons, and more.' )
				},
				{
					id: 'emoji',
					name: msg( 'layers-help-tool-emoji-name', 'Emoji' ),
					key: 'J',
					desc: msg( 'layers-help-tool-emoji', 'Add emoji from a searchable picker with 2,800+ emoji. Great for reactions and visual indicators.' )
				}
			];

			const heading = document.createElement( 'h3' );
			heading.textContent = msg( 'layers-help-tools-title', 'Drawing Tools' );
			panel.appendChild( heading );

			const intro = document.createElement( 'p' );
			intro.textContent = msg( 'layers-help-tools-intro', 'Press the keyboard shortcut or click the tool in the toolbar to activate it.' );
			panel.appendChild( intro );

			const list = document.createElement( 'div' );
			list.className = 'layers-help-tools-list';

			tools.forEach( ( tool ) => {
				const item = document.createElement( 'div' );
				item.className = 'layers-help-tool-item';

				const iconWrap = document.createElement( 'span' );
				iconWrap.className = 'layers-help-tool-icon';
				iconWrap.innerHTML = icons[ tool.id ] || '';

				const info = document.createElement( 'div' );
				info.className = 'layers-help-tool-info';

				const nameRow = document.createElement( 'div' );
				nameRow.className = 'layers-help-tool-name';
				nameRow.innerHTML = `<strong>${tool.name}</strong> <kbd>${tool.key}</kbd>`;

				const desc = document.createElement( 'div' );
				desc.className = 'layers-help-tool-desc';
				desc.textContent = tool.desc;

				info.appendChild( nameRow );
				info.appendChild( desc );

				item.appendChild( iconWrap );
				item.appendChild( info );
				list.appendChild( item );
			} );

			panel.appendChild( list );
		}

		/**
		 * Render shortcuts tab content
		 * @param {HTMLElement} panel Panel element
		 * @private
		 */
		renderShortcuts( panel ) {
			const msg = this.getMessage.bind( this );

			const categories = [
				{
					title: msg( 'layers-help-shortcuts-editing', 'Editing' ),
					shortcuts: [
						{ key: 'Ctrl+Z', action: msg( 'layers-undo', 'Undo' ) },
						{ key: 'Ctrl+Y', action: msg( 'layers-redo', 'Redo' ) },
						{ key: 'Ctrl+S', action: msg( 'layers-editor-save', 'Save' ) },
						{ key: 'Ctrl+C', action: msg( 'layers-help-shortcut-copy', 'Copy' ) },
						{ key: 'Ctrl+X', action: msg( 'layers-help-shortcut-cut', 'Cut' ) },
						{ key: 'Ctrl+V', action: msg( 'layers-help-shortcut-paste', 'Paste' ) },
						{ key: 'Ctrl+D', action: msg( 'layers-duplicate-selected', 'Duplicate' ) },
						{ key: 'Delete', action: msg( 'layers-delete-selected', 'Delete' ) },
						{ key: 'Ctrl+A', action: msg( 'layers-help-shortcut-select-all', 'Select All' ) },
						{ key: 'Escape', action: msg( 'layers-help-shortcut-deselect', 'Deselect / Cancel' ) }
					]
				},
				{
					title: msg( 'layers-help-shortcuts-organization', 'Organization' ),
					shortcuts: [
						{ key: 'Ctrl+G', action: msg( 'layers-help-shortcut-group', 'Group Layers' ) },
						{ key: 'Ctrl+Shift+G', action: msg( 'layers-help-shortcut-ungroup', 'Ungroup' ) }
					]
				},
				{
					title: msg( 'layers-help-shortcuts-tools', 'Tools' ),
					shortcuts: [
						{ key: 'V', action: msg( 'layers-tool-select', 'Select' ) },
						{ key: 'T', action: msg( 'layers-tool-text', 'Text' ) },
						{ key: 'X', action: msg( 'layers-tool-textbox', 'Text Box' ) },
						{ key: 'B', action: msg( 'layers-tool-callout', 'Callout' ) },
						{ key: 'R', action: msg( 'layers-tool-rectangle', 'Rectangle' ) },
						{ key: 'C', action: msg( 'layers-tool-circle', 'Circle' ) },
						{ key: 'E', action: msg( 'layers-tool-ellipse', 'Ellipse' ) },
						{ key: 'Y', action: msg( 'layers-tool-polygon', 'Polygon' ) },
						{ key: 'S', action: msg( 'layers-tool-star', 'Star' ) },
						{ key: 'A', action: msg( 'layers-tool-arrow', 'Arrow' ) },
						{ key: 'L', action: msg( 'layers-tool-line', 'Line' ) },
						{ key: 'M', action: msg( 'layers-tool-marker', 'Marker' ) },
						{ key: 'D', action: msg( 'layers-tool-dimension', 'Dimension' ) },
						{ key: 'P', action: msg( 'layers-tool-pen', 'Pen' ) },
						{ key: 'G', action: msg( 'layers-shape-library', 'Shape Library' ) },
						{ key: 'J', action: msg( 'layers-help-tool-emoji-name', 'Emoji' ) }
					]
				},
				{
					title: msg( 'layers-help-shortcuts-view', 'View' ),
					shortcuts: [
						{ key: '+/=', action: msg( 'layers-zoom-in', 'Zoom In' ) },
						{ key: '-', action: msg( 'layers-zoom-out', 'Zoom Out' ) },
						{ key: '0', action: msg( 'layers-zoom-fit', 'Fit to Window' ) },
						{ key: ';', action: msg( 'layers-help-shortcut-guides', 'Toggle Smart Guides' ) },
						{ key: 'Shift+B', action: msg( 'layers-toggle-background', 'Toggle Background' ) },
						{ key: 'Shift+?', action: msg( 'layers-help-shortcut-help', 'Show Help' ) }
					]
				}
			];

			const heading = document.createElement( 'h3' );
			heading.textContent = msg( 'layers-help-shortcuts-title', 'Keyboard Shortcuts' );
			panel.appendChild( heading );

			categories.forEach( ( cat ) => {
				const section = document.createElement( 'div' );
				section.className = 'layers-help-shortcut-section';

				const catTitle = document.createElement( 'h4' );
				catTitle.textContent = cat.title;
				section.appendChild( catTitle );

				const list = document.createElement( 'dl' );
				list.className = 'layers-help-shortcuts-list';

				cat.shortcuts.forEach( ( shortcut ) => {
					const dt = document.createElement( 'dt' );
					const kbd = document.createElement( 'kbd' );
					kbd.textContent = shortcut.key;
					dt.appendChild( kbd );

					const dd = document.createElement( 'dd' );
					dd.textContent = shortcut.action;

					list.appendChild( dt );
					list.appendChild( dd );
				} );

				section.appendChild( list );
				panel.appendChild( section );
			} );
		}

		/**
		 * Render tips tab content
		 * @param {HTMLElement} panel Panel element
		 * @private
		 */
		renderTips( panel ) {
			const msg = this.getMessage.bind( this );

			const content = `
				<h3>${msg( 'layers-help-tips-title', 'Tips & Best Practices' )}</h3>

				<h4>${msg( 'layers-help-tips-workflow', 'Efficient Workflow' )}</h4>
				<ul>
					<li>${msg( 'layers-help-tips-keyboard', 'Use keyboard shortcuts for faster tool switching.' )}</li>
					<li>${msg( 'layers-help-tips-layer-names', 'Give layers descriptive names by double-clicking their name in the panel.' )}</li>
					<li>${msg( 'layers-help-tips-groups', 'Group related layers together (Ctrl+G) to move and edit them as a unit.' )}</li>
					<li>${msg( 'layers-help-tips-lock', 'Lock layers you\'re finished with to prevent accidental changes.' )}</li>
					<li>${msg( 'layers-help-tips-visibility', 'Toggle layer visibility (eye icon) to work on overlapping elements.' )}</li>
				</ul>

				<h4>${msg( 'layers-help-tips-quality', 'Quality Annotations' )}</h4>
				<ul>
					<li>${msg( 'layers-help-tips-contrast', 'Use high-contrast colors that stand out from the background image.' )}</li>
					<li>${msg( 'layers-help-tips-consistent', 'Keep styling consistent—use the same colors and stroke widths throughout.' )}</li>
					<li>${msg( 'layers-help-tips-presets', 'Save frequently used styles as presets for quick reuse.' )}</li>
					<li>${msg( 'layers-help-tips-guides', 'Use Smart Guides (;) to align elements precisely.' )}</li>
				</ul>

				<h4>${msg( 'layers-help-tips-troubleshooting', 'Troubleshooting' )}</h4>
				<ul>
					<li><strong>${msg( 'layers-help-tips-cant-select', 'Can\'t select a layer?' )}</strong> — ${msg( 'layers-help-tips-cant-select-fix', 'It may be locked. Click the layer in the panel and check the lock icon.' )}</li>
					<li><strong>${msg( 'layers-help-tips-layer-hidden', 'Layer disappeared?' )}</strong> — ${msg( 'layers-help-tips-layer-hidden-fix', 'Check if visibility is turned off (eye icon) in the layer panel.' )}</li>
					<li><strong>${msg( 'layers-help-tips-changes-lost', 'Changes not saving?' )}</strong> — ${msg( 'layers-help-tips-changes-lost-fix', 'Make sure to click Save before closing. Check for any error messages.' )}</li>
					<li><strong>${msg( 'layers-help-tips-undo', 'Made a mistake?' )}</strong> — ${msg( 'layers-help-tips-undo-fix', 'Press Ctrl+Z to undo. You can undo multiple steps.' )}</li>
				</ul>

				<h4>${msg( 'layers-help-tips-display', 'Displaying Layers' )}</h4>
				<p>${msg( 'layers-help-tips-display-intro', 'To show layers on a wiki page, use wikitext syntax:' )}</p>
				<ul>
					<li><code>[[File:Example.jpg|layerset=on]]</code> — ${msg( 'layers-help-tips-display-default', 'Shows the default layer set' )}</li>
					<li><code>[[File:Example.jpg|layerset=myname]]</code> — ${msg( 'layers-help-tips-display-named', 'Shows a specific named layer set' )}</li>
				</ul>
			`;

			panel.innerHTML = content;
		}

		/**
		 * Close the help dialog
		 */
		close() {
			if ( this.handleKeydown ) {
				document.removeEventListener( 'keydown', this.handleKeydown );
				this.handleKeydown = null;
			}

			if ( this.overlay && this.overlay.parentNode ) {
				this.overlay.parentNode.removeChild( this.overlay );
			}
			if ( this.dialog && this.dialog.parentNode ) {
				this.dialog.parentNode.removeChild( this.dialog );
			}

			this.overlay = null;
			this.dialog = null;
			this.contentArea = null;
		}

		/**
		 * Destroy the dialog and clean up
		 */
		destroy() {
			this.close();
		}
	}

	// Export to window.Layers.UI namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.HelpDialog = HelpDialog;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = HelpDialog;
	}
}() );
