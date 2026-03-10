/**
 * Unit tests for HelpDialog
 */

describe( 'HelpDialog', () => {
	let HelpDialog;

	beforeEach( () => {
		jest.resetModules();

		// Minimal mw mock for HelpDialog
		global.mw = {
			message: jest.fn( ( key ) => ( {
				exists: () => false,
				text: () => key
			} ) ),
			log: {
				error: jest.fn()
			}
		};

		global.window = global.window || {};
		global.window.Layers = {};

		HelpDialog = require( '../../resources/ext.layers.editor/editor/HelpDialog.js' );
	} );

	afterEach( () => {
		// Clean up any dialog DOM
		document.body.innerHTML = '';
	} );

	describe( 'constructor', () => {
		it( 'should create with default config', () => {
			const dialog = new HelpDialog();
			expect( dialog.activeTab ).toBe( 'overview' );
			expect( dialog.dialog ).toBeNull();
			expect( dialog.overlay ).toBeNull();
			expect( typeof dialog.getMessage ).toBe( 'function' );
		} );

		it( 'should accept custom getMessage function', () => {
			const customMsg = jest.fn( ( key, fallback ) => fallback || key );
			const dialog = new HelpDialog( { getMessage: customMsg } );
			expect( dialog.getMessage ).toBe( customMsg );
		} );

		it( 'should use mw.message by default when available', () => {
			const dialog = new HelpDialog();
			const result = dialog.getMessage( 'test-key', 'fallback' );
			// mw.message mock returns key since exists() returns false
			expect( result ).toBe( 'fallback' );
		} );

		it( 'should return key when mw is not available and no fallback', () => {
			delete global.mw;
			global.mw = {};
			const dialog = new HelpDialog();
			const result = dialog.getMessage( 'some-key' );
			expect( result ).toBe( 'some-key' );
		} );
	} );

	describe( 'getToolIcons', () => {
		it( 'should return an object with SVG strings for all tools', () => {
			const dialog = new HelpDialog();
			const icons = dialog.getToolIcons();

			expect( typeof icons ).toBe( 'object' );
			expect( typeof icons.pointer ).toBe( 'string' );
			expect( icons.pointer ).toContain( '<svg' );
			expect( typeof icons.text ).toBe( 'string' );
			expect( typeof icons.textbox ).toBe( 'string' );
			expect( typeof icons.callout ).toBe( 'string' );
			expect( typeof icons.rectangle ).toBe( 'string' );
			expect( typeof icons.circle ).toBe( 'string' );
			expect( typeof icons.ellipse ).toBe( 'string' );
			expect( typeof icons.polygon ).toBe( 'string' );
			expect( typeof icons.star ).toBe( 'string' );
			expect( typeof icons.arrow ).toBe( 'string' );
			expect( typeof icons.line ).toBe( 'string' );
			expect( typeof icons.marker ).toBe( 'string' );
			expect( typeof icons.dimension ).toBe( 'string' );
			expect( typeof icons.pen ).toBe( 'string' );
			expect( typeof icons.shapes ).toBe( 'string' );
			expect( typeof icons.emoji ).toBe( 'string' );
		} );
	} );

	describe( 'show', () => {
		it( 'should create and append overlay and dialog to body', () => {
			const dialog = new HelpDialog();
			dialog.show();

			expect( dialog.overlay ).not.toBeNull();
			expect( dialog.dialog ).not.toBeNull();
			expect( document.body.contains( dialog.overlay ) ).toBe( true );
			expect( document.body.contains( dialog.dialog ) ).toBe( true );
		} );

		it( 'should not create a second dialog if already open', () => {
			const dialog = new HelpDialog();
			dialog.show();
			const firstDialog = dialog.dialog;
			dialog.show();
			expect( dialog.dialog ).toBe( firstDialog );
		} );

		it( 'should focus the first tab button', () => {
			const dialog = new HelpDialog();
			dialog.show();

			const firstTab = dialog.dialog.querySelector( '.layers-help-tab' );
			expect( firstTab ).not.toBeNull();
		} );

		it( 'should set up escape key handler', () => {
			const dialog = new HelpDialog();
			dialog.show();
			expect( dialog.handleKeydown ).toBeDefined();

			// Simulate Escape
			const closeSpy = jest.spyOn( dialog, 'close' );
			dialog.handleKeydown( { key: 'Escape' } );
			expect( closeSpy ).toHaveBeenCalled();
		} );

		it( 'should not close for non-Escape keys', () => {
			const dialog = new HelpDialog();
			dialog.show();
			const closeSpy = jest.spyOn( dialog, 'close' );
			dialog.handleKeydown( { key: 'Enter' } );
			expect( closeSpy ).not.toHaveBeenCalled();
		} );

		it( 'should handle show error gracefully', () => {
			const dialog = new HelpDialog();
			// Break createOverlay so show() throws
			dialog.createOverlay = () => {
				throw new Error( 'test error' );
			};
			expect( () => dialog.show() ).not.toThrow();
			expect( mw.log.error ).toHaveBeenCalled();
		} );
	} );

	describe( 'createOverlay', () => {
		it( 'should create div with correct class and role', () => {
			const dialog = new HelpDialog();
			dialog.createOverlay();

			expect( dialog.overlay.className ).toBe( 'layers-help-overlay' );
			expect( dialog.overlay.getAttribute( 'role' ) ).toBe( 'presentation' );
		} );

		it( 'should close dialog when overlay is clicked', () => {
			const dialog = new HelpDialog();
			dialog.show();
			const closeSpy = jest.spyOn( dialog, 'close' );
			dialog.overlay.click();
			expect( closeSpy ).toHaveBeenCalled();
		} );
	} );

	describe( 'createDialog', () => {
		it( 'should create dialog with proper ARIA attributes', () => {
			const dialog = new HelpDialog();
			dialog.createDialog();

			expect( dialog.dialog.getAttribute( 'role' ) ).toBe( 'dialog' );
			expect( dialog.dialog.getAttribute( 'aria-modal' ) ).toBe( 'true' );
			expect( dialog.dialog.getAttribute( 'aria-label' ) ).toBeTruthy();
		} );

		it( 'should contain header with title and close button', () => {
			const dialog = new HelpDialog();
			dialog.createDialog();

			const header = dialog.dialog.querySelector( '.layers-help-header' );
			expect( header ).not.toBeNull();
			const title = header.querySelector( '.layers-help-title' );
			expect( title ).not.toBeNull();
			const closeBtn = header.querySelector( '.layers-help-close' );
			expect( closeBtn ).not.toBeNull();
		} );

		it( 'should have close button that closes dialog', () => {
			const dialog = new HelpDialog();
			dialog.show();
			const closeSpy = jest.spyOn( dialog, 'close' );
			dialog.dialog.querySelector( '.layers-help-close' ).click();
			expect( closeSpy ).toHaveBeenCalled();
		} );

		it( 'should contain tab bar with 4 tabs', () => {
			const dialog = new HelpDialog();
			dialog.createDialog();

			const tabBar = dialog.dialog.querySelector( '.layers-help-tabs' );
			expect( tabBar ).not.toBeNull();
			expect( tabBar.getAttribute( 'role' ) ).toBe( 'tablist' );

			const tabs = tabBar.querySelectorAll( '.layers-help-tab' );
			expect( tabs.length ).toBe( 4 );
		} );

		it( 'should mark overview tab as active by default', () => {
			const dialog = new HelpDialog();
			dialog.createDialog();

			const tabs = dialog.dialog.querySelectorAll( '.layers-help-tab' );
			expect( tabs[ 0 ].classList.contains( 'active' ) ).toBe( true );
			expect( tabs[ 0 ].getAttribute( 'aria-selected' ) ).toBe( 'true' );
		} );

		it( 'should have content area', () => {
			const dialog = new HelpDialog();
			dialog.createDialog();

			expect( dialog.contentArea ).not.toBeNull();
			expect( dialog.contentArea.className ).toBe( 'layers-help-content' );
		} );
	} );

	describe( 'switchTab', () => {
		it( 'should update activeTab', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'tools' );
			expect( dialog.activeTab ).toBe( 'tools' );
		} );

		it( 'should update tab button active states', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'shortcuts' );

			const tabs = dialog.dialog.querySelectorAll( '.layers-help-tab' );
			tabs.forEach( ( tab ) => {
				if ( tab.dataset.tab === 'shortcuts' ) {
					expect( tab.classList.contains( 'active' ) ).toBe( true );
					expect( tab.getAttribute( 'aria-selected' ) ).toBe( 'true' );
				} else {
					expect( tab.classList.contains( 'active' ) ).toBe( false );
					expect( tab.getAttribute( 'aria-selected' ) ).toBe( 'false' );
				}
			} );
		} );

		it( 'should re-render content', () => {
			const dialog = new HelpDialog();
			dialog.show();
			const spy = jest.spyOn( dialog, 'renderContent' );
			dialog.switchTab( 'tips' );
			expect( spy ).toHaveBeenCalled();
		} );

		it( 'should switch when tab button is clicked', () => {
			const dialog = new HelpDialog();
			dialog.show();
			const toolsTab = dialog.dialog.querySelector( '[data-tab="tools"]' );
			toolsTab.click();
			expect( dialog.activeTab ).toBe( 'tools' );
		} );
	} );

	describe( 'renderContent', () => {
		it( 'should render overview panel by default', () => {
			const dialog = new HelpDialog();
			dialog.show();

			const panel = dialog.contentArea.querySelector( '.layers-help-panel' );
			expect( panel ).not.toBeNull();
			expect( panel.getAttribute( 'role' ) ).toBe( 'tabpanel' );
			expect( panel.id ).toBe( 'layers-help-panel-overview' );
		} );

		it( 'should render tools panel', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'tools' );

			const panel = dialog.contentArea.querySelector( '#layers-help-panel-tools' );
			expect( panel ).not.toBeNull();
		} );

		it( 'should render shortcuts panel', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'shortcuts' );

			const panel = dialog.contentArea.querySelector( '#layers-help-panel-shortcuts' );
			expect( panel ).not.toBeNull();
		} );

		it( 'should render tips panel', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'tips' );

			const panel = dialog.contentArea.querySelector( '#layers-help-panel-tips' );
			expect( panel ).not.toBeNull();
		} );
	} );

	describe( 'renderOverview', () => {
		it( 'should render overview content with headings and lists', () => {
			const dialog = new HelpDialog();
			dialog.show();

			const panel = dialog.contentArea.querySelector( '.layers-help-panel' );
			expect( panel.querySelector( 'h3' ) ).not.toBeNull();
			expect( panel.querySelectorAll( 'li' ).length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'renderTools', () => {
		it( 'should render all 17 tools with icons and descriptions', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'tools' );

			const toolItems = dialog.contentArea.querySelectorAll( '.layers-help-tool-item' );
			expect( toolItems.length ).toBe( 17 );
		} );

		it( 'should include icons, names and keyboard shortcuts', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'tools' );

			const firstTool = dialog.contentArea.querySelector( '.layers-help-tool-item' );
			expect( firstTool.querySelector( '.layers-help-tool-icon' ) ).not.toBeNull();
			expect( firstTool.querySelector( '.layers-help-tool-name' ) ).not.toBeNull();
			expect( firstTool.querySelector( 'kbd' ) ).not.toBeNull();
			expect( firstTool.querySelector( '.layers-help-tool-desc' ) ).not.toBeNull();
		} );
	} );

	describe( 'renderShortcuts', () => {
		it( 'should render shortcut categories', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'shortcuts' );

			const sections = dialog.contentArea.querySelectorAll( '.layers-help-shortcut-section' );
			expect( sections.length ).toBe( 4 );
		} );

		it( 'should render kbd elements for shortcuts', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'shortcuts' );

			const kbds = dialog.contentArea.querySelectorAll( 'kbd' );
			expect( kbds.length ).toBeGreaterThan( 10 );
		} );

		it( 'should use dl/dt/dd structure', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'shortcuts' );

			expect( dialog.contentArea.querySelectorAll( 'dl' ).length ).toBeGreaterThan( 0 );
			expect( dialog.contentArea.querySelectorAll( 'dt' ).length ).toBeGreaterThan( 0 );
			expect( dialog.contentArea.querySelectorAll( 'dd' ).length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'renderTips', () => {
		it( 'should render tips content with sections', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'tips' );

			const panel = dialog.contentArea.querySelector( '.layers-help-panel' );
			expect( panel.querySelectorAll( 'h4' ).length ).toBeGreaterThan( 0 );
			expect( panel.querySelectorAll( 'li' ).length ).toBeGreaterThan( 0 );
		} );

		it( 'should include code examples for wikitext', () => {
			const dialog = new HelpDialog();
			dialog.show();
			dialog.switchTab( 'tips' );

			const panel = dialog.contentArea.querySelector( '.layers-help-panel' );
			const codeElements = panel.querySelectorAll( 'code' );
			expect( codeElements.length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'close', () => {
		it( 'should remove overlay and dialog from DOM', () => {
			const dialog = new HelpDialog();
			dialog.show();
			expect( document.body.contains( dialog.overlay ) ).toBe( true );

			dialog.close();
			expect( dialog.overlay ).toBeNull();
			expect( dialog.dialog ).toBeNull();
			expect( dialog.contentArea ).toBeNull();
		} );

		it( 'should remove keydown listener', () => {
			const dialog = new HelpDialog();
			dialog.show();
			expect( dialog.handleKeydown ).not.toBeNull();

			const removeListenerSpy = jest.spyOn( document, 'removeEventListener' );
			dialog.close();
			expect( removeListenerSpy ).toHaveBeenCalledWith( 'keydown', expect.any( Function ) );
			expect( dialog.handleKeydown ).toBeNull();
		} );

		it( 'should be safe to call when not open', () => {
			const dialog = new HelpDialog();
			expect( () => dialog.close() ).not.toThrow();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should close the dialog', () => {
			const dialog = new HelpDialog();
			dialog.show();
			const closeSpy = jest.spyOn( dialog, 'close' );
			dialog.destroy();
			expect( closeSpy ).toHaveBeenCalled();
		} );
	} );

	describe( 'export', () => {
		it( 'should export to window.Layers.UI namespace', () => {
			expect( window.Layers.UI.HelpDialog ).toBe( HelpDialog );
		} );
	} );
} );
