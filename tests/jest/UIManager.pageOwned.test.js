/**
 * UIManager.pageOwned.test.js - Tests for UIManager in page-owned mode (J52)
 *
 * Verifies that page-owned editors omit legacy layer-set and revision selectors,
 * do not construct SetSelectorController, display the configured page-owned
 * owner in the header title, safely handle markup-like owner strings via textContent,
 * and preserve safe event setup/disposal and Close button wiring.
 */

'use strict';

describe( 'UIManager page-owned mode (J52)', () => {
	let UIManager;
	let mockEditor;

	beforeAll( () => {
		// Mock global MediaWiki dependencies
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: jest.fn( () => `[${ key }]` ),
				parse: jest.fn( () => `<p>[${ key }]</p>` ),
				exists: true
			} ) ),
			msg: jest.fn( ( key ) => `[${ key }]` ),
			config: {
				get: jest.fn( ( key ) => {
					const config = {
						wgUserName: 'TestUser',
						wgPageName: 'Test_Page',
						wgTitle: 'Test Page',
						wgNamespaceNumber: 0
					};
					return config[ key ] || null;
				} )
			},
			log: jest.fn(),
			notify: jest.fn()
		};

		global.$ = jest.fn( ( selector ) => {
			if ( typeof selector === 'string' ) {
				return { length: 0, html: jest.fn(), on: jest.fn() };
			}
			return {
				appendTo: jest.fn().mockReturnThis(),
				html: jest.fn().mockReturnThis(),
				on: jest.fn().mockReturnThis()
			};
		} );
		global.jQuery = global.$;

		// Clean namespace
		if ( global.window.Layers && global.window.Layers.UI ) {
			delete global.window.Layers.UI.Manager;
			delete global.window.Layers.UI.SetSelectorController;
		}

		// Load SetSelectorController and UIManager
		require( '../../resources/ext.layers.editor/ui/SetSelectorController.js' );

		require( '../../resources/ext.layers.editor/UIManager.js' );
		UIManager = global.window.Layers.UI.Manager;
	} );

	beforeEach( () => {
		document.body.innerHTML = '';
		document.body.classList.remove( 'layers-editor-open' );
		jest.clearAllMocks();
		if ( global.window.layersMessages ) {
			global.window.layersMessages.cache = {};
		}

		mockEditor = {
			config: {},
			close: jest.fn(),
			cancel: jest.fn(),
			loadRevisionById: jest.fn(),
			loadLayerSetByName: jest.fn()
		};
	} );

	afterEach( () => {
		document.body.innerHTML = '';
		document.body.classList.remove( 'layers-editor-open' );
	} );

	describe( 'ordinary mode unchanged', () => {
		it( 'initializes isPageOwned as false when editor has no config', () => {
			const uiManager = new UIManager( {} );
			expect( uiManager.isPageOwned ).toBe( false );
			expect( uiManager.setSelectorController ).not.toBeNull();
		} );

		it( 'initializes isPageOwned as false when config lacks pageOwned', () => {
			mockEditor.config = { filename: 'File:Sample.png' };
			mockEditor.filename = 'File:Sample.png';
			const uiManager = new UIManager( mockEditor );

			expect( uiManager.isPageOwned ).toBe( false );
			expect( uiManager.setSelectorController ).not.toBeNull();
		} );

		it( 'creates set selector, separator, revision selector, and close button in ordinary mode', () => {
			mockEditor.filename = 'File:Sample.png';
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const headerRight = uiManager.container.querySelector( '.layers-header-right' );
			expect( headerRight ).not.toBeNull();

			const children = Array.from( headerRight.children );
			expect( children.length ).toBe( 4 );
			expect( children[ 0 ].className ).toBe( 'layers-set-wrap' );
			expect( children[ 1 ].className ).toBe( 'layers-header-separator' );
			expect( children[ 2 ].className ).toBe( 'layers-revision-wrap' );
			expect( children[ 3 ].className ).toBe( 'layers-header-close' );

			expect( uiManager.setSelectEl ).toBeInstanceOf( HTMLElement );
			expect( uiManager.revSelectEl ).toBeInstanceOf( HTMLElement );
			expect( uiManager.revLoadBtnEl ).toBeInstanceOf( HTMLElement );
		} );

		it( 'displays filename in header title in ordinary mode', () => {
			mockEditor.filename = 'File:Sample.png';
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const title = uiManager.container.querySelector( '.layers-header-title' );
			expect( title.textContent ).toBe( '[layers-editor-title] — File:Sample.png' );
		} );

		it( 'displays bare editor title when filename is absent in ordinary mode', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const title = uiManager.container.querySelector( '.layers-header-title' );
			expect( title.textContent ).toBe( '[layers-editor-title]' );
		} );
	} );

	describe( 'mode detection isolation', () => {
		it( 'does not infer page-owned mode from filename, slideType, namespace, or globals', () => {
			mockEditor.filename = 'Slide:Annual_Report';
			mockEditor.slideType = 'presentation';
			mockEditor.namespace = 100;

			const uiManager = new UIManager( mockEditor );
			expect( uiManager.isPageOwned ).toBe( false );
			expect( uiManager.setSelectorController ).not.toBeNull();
		} );

		it( 'exclusively captures page-owned mode from editor.config.pageOwned', () => {
			mockEditor.config.pageOwned = {
				owner: 'Project:Roadmap',
				surfaceId: 'slide-1',
				revisionId: 42
			};

			const uiManager = new UIManager( mockEditor );
			expect( uiManager.isPageOwned ).toBe( true );
		} );

		it( 'treats truthy pageOwned as page-owned even if legacy properties coexist on editor', () => {
			mockEditor.filename = 'File:Deceptive_Name.png';
			mockEditor.imageName = 'Deceptive_Name.png';
			mockEditor.config = {
				filename: 'File:Deceptive_Name.png',
				pageOwned: {
					owner: 'RealOwner',
					surfaceId: 'surface-0'
				}
			};

			const uiManager = new UIManager( mockEditor );
			expect( uiManager.isPageOwned ).toBe( true );
		} );

		it( 'handles null, undefined, or primitive editor arguments safely', () => {
			expect( new UIManager( null ).isPageOwned ).toBe( false );
			expect( new UIManager( undefined ).isPageOwned ).toBe( false );
			expect( new UIManager( 'not an object' ).isPageOwned ).toBe( false );
			expect( new UIManager( 42 ).isPageOwned ).toBe( false );
		} );
	} );

	describe( 'zero SetSelectorController construction and setup in page-owned mode', () => {
		it( 'leaves setSelectorController as null in page-owned mode', () => {
			mockEditor.config.pageOwned = {
				owner: 'Project:Alpha',
				surfaceId: 'surface-1'
			};

			const uiManager = new UIManager( mockEditor );
			expect( uiManager.setSelectorController ).toBeNull();
		} );

		it( 'does not invoke SetSelectorController constructor in page-owned mode', () => {
			const originalConstructor = global.window.Layers.UI.SetSelectorController;
			const constructorSpy = jest.fn();
			function MockSetSelectorController( ...args ) {
				constructorSpy( ...args );
			}
			global.window.Layers.UI.SetSelectorController = MockSetSelectorController;

			try {
				mockEditor.config.pageOwned = { owner: 'Project:Beta', surfaceId: 'slide-1' };
				const pageOwnedUI = new UIManager( mockEditor );
				expect( pageOwnedUI.setSelectorController ).toBeNull();
				expect( constructorSpy ).not.toHaveBeenCalled();

				// Confirm ordinary mode DOES construct it
				const ordinaryEditor = { config: {} };
				const ordinaryUI = new UIManager( ordinaryEditor );
				expect( constructorSpy ).toHaveBeenCalledTimes( 1 );
				expect( ordinaryUI.setSelectorController ).toBeInstanceOf( MockSetSelectorController );
			} finally {
				global.window.Layers.UI.SetSelectorController = originalConstructor;
			}
		} );

		it( 'delegation methods are safe no-ops when setSelectorController is null', async () => {
			mockEditor.config.pageOwned = { owner: 'Test', surfaceId: 'slide-1' };
			const uiManager = new UIManager( mockEditor );

			expect( () => uiManager.setupSetSelectorControls() ).not.toThrow();
			expect( () => uiManager.showNewSetInput( true ) ).not.toThrow();
			expect( () => uiManager.createNewSet() ).not.toThrow();
			expect( () => uiManager.addSetOption( 'test-set', true ) ).not.toThrow();
			await expect( uiManager.deleteCurrentSet() ).resolves.toBeUndefined();
			await expect( uiManager.renameCurrentSet() ).resolves.toBeUndefined();
		} );
	} );

	describe( 'omission of legacy controls in writable and read-only page-owned headers', () => {
		it( 'omits set selector, separator, and revision selector in writable page-owned mode', () => {
			mockEditor.config.pageOwned = {
				owner: 'Writable:Page',
				surfaceId: 'surface-0',
				revisionId: 10,
				readOnly: false
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const headerRight = uiManager.container.querySelector( '.layers-header-right' );
			expect( headerRight ).not.toBeNull();

			// Only close button should be present
			expect( headerRight.children.length ).toBe( 1 );
			expect( headerRight.firstElementChild.className ).toBe( 'layers-header-close' );

			// Legacy selector wrappers must not exist
			expect( uiManager.container.querySelector( '.layers-set-wrap' ) ).toBeNull();
			expect( uiManager.container.querySelector( '.layers-header-separator' ) ).toBeNull();
			expect( uiManager.container.querySelector( '.layers-revision-wrap' ) ).toBeNull();
			expect( uiManager.container.querySelector( '.layers-revision-select' ) ).toBeNull();
			expect( uiManager.container.querySelector( '.layers-revision-load' ) ).toBeNull();

			// Selector element references must remain null
			expect( uiManager.setSelectEl ).toBeNull();
			expect( uiManager.newSetInputEl ).toBeNull();
			expect( uiManager.newSetBtnEl ).toBeNull();
			expect( uiManager.revSelectEl ).toBeNull();
			expect( uiManager.revLoadBtnEl ).toBeNull();
			expect( uiManager.revNameInputEl ).toBeNull();
		} );

		it( 'omits set selector, separator, and revision selector in read-only page-owned mode', () => {
			mockEditor.config.pageOwned = {
				owner: 'Historical:Page',
				surfaceId: 'surface-0',
				revisionId: 10,
				readOnly: true
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const headerRight = uiManager.container.querySelector( '.layers-header-right' );
			expect( headerRight ).not.toBeNull();

			expect( headerRight.children.length ).toBe( 1 );
			expect( headerRight.firstElementChild.className ).toBe( 'layers-header-close' );

			expect( uiManager.container.querySelector( '.layers-set-wrap' ) ).toBeNull();
			expect( uiManager.container.querySelector( '.layers-header-separator' ) ).toBeNull();
			expect( uiManager.container.querySelector( '.layers-revision-wrap' ) ).toBeNull();

			expect( uiManager.setSelectEl ).toBeNull();
			expect( uiManager.revSelectEl ).toBeNull();
			expect( uiManager.revLoadBtnEl ).toBeNull();
		} );

		it( 'does not construct elements and hide them; they are never created or appended', () => {
			mockEditor.config.pageOwned = {
				owner: 'Audit:Inspection',
				surfaceId: 'surface-0'
			};

			const createSetSelectorSpy = jest.spyOn( UIManager.prototype, 'createSetSelector' );
			const createRevisionSelectorSpy = jest.spyOn( UIManager.prototype, 'createRevisionSelector' );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( createSetSelectorSpy ).not.toHaveBeenCalled();
			expect( createRevisionSelectorSpy ).not.toHaveBeenCalled();

			createSetSelectorSpy.mockRestore();
			createRevisionSelectorSpy.mockRestore();
		} );
	} );

	describe( 'header title rendering and security', () => {
		it( 'uses configured page-owned owner name with localized editor-title prefix', () => {
			mockEditor.config.pageOwned = {
				owner: 'Project:Documentation',
				surfaceId: 'slide-1',
				revisionId: 105
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const title = uiManager.container.querySelector( '.layers-header-title' );
			expect( title.textContent ).toBe( '[layers-editor-title] — Project:Documentation' );
		} );

		it( 'ignores editor.filename in page-owned mode and displays owner name', () => {
			mockEditor.filename = 'File:WrongFileName.jpg';
			mockEditor.config = {
				filename: 'File:WrongFileName.jpg',
				pageOwned: {
					owner: 'CanonicalPageName',
					surfaceId: 'slide-0'
				}
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const title = uiManager.container.querySelector( '.layers-header-title' );
			expect( title.textContent ).toBe( '[layers-editor-title] — CanonicalPageName' );
			expect( title.textContent ).not.toContain( 'WrongFileName.jpg' );
		} );

		it( 'does not invent or display a revision label from configuration', () => {
			mockEditor.config.pageOwned = {
				owner: 'PageName',
				surfaceId: 'slide-0',
				revisionId: 9999
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const title = uiManager.container.querySelector( '.layers-header-title' );
			expect( title.textContent ).toBe( '[layers-editor-title] — PageName' );
			expect( title.textContent ).not.toContain( '9999' );
			expect( title.textContent ).not.toContain( 'rev' );
			expect( title.textContent ).not.toContain( 'Revision' );
		} );

		it( 'does not claim an editable surface is a legacy Slide or File page', () => {
			mockEditor.config.pageOwned = {
				owner: 'Marketing_Deck',
				surfaceId: 'presentation',
				revisionId: 1
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const title = uiManager.container.querySelector( '.layers-header-title' );
			expect( title.textContent ).toBe( '[layers-editor-title] — Marketing_Deck' );
			expect( title.textContent ).not.toContain( 'Slide:' );
			expect( title.textContent ).not.toContain( 'File:' );
		} );

		it( 'renders markup-like owner strings strictly as literal text without HTML injection', () => {
			const xssPayloads = [
				'<script>alert("xss")</script>',
				'<img src=x onerror="alert(1)">',
				'<b>Bold Title</b>',
				'"><svg onload=alert(1)>',
				'<a href="javascript:alert(1)">Click</a>'
			];

			xssPayloads.forEach( ( payload ) => {
				const editor = {
					config: {
						pageOwned: {
							owner: payload,
							surfaceId: 'slide-0'
						}
					}
				};

				const uiManager = new UIManager( editor );
				uiManager.createInterface();

				const title = uiManager.container.querySelector( '.layers-header-title' );
				expect( title.textContent ).toBe( `[layers-editor-title] — ${ payload }` );
				// Must contain zero HTML child nodes; textContent must be literal
				expect( title.children.length ).toBe( 0 );
				expect( title.querySelector( 'script, img, b, svg, a' ) ).toBeNull();

				uiManager.destroy();
			} );
		} );

		it( 'falls back to bare title if owner is empty, whitespace, or non-string', () => {
			const emptyOwnerCases = [ '', null, undefined, 123, {}, [] ];

			emptyOwnerCases.forEach( ( ownerVal ) => {
				const editor = {
					config: {
						pageOwned: {
							owner: ownerVal,
							surfaceId: 'slide-0'
						}
					}
				};

				const uiManager = new UIManager( editor );
				uiManager.createInterface();

				const title = uiManager.container.querySelector( '.layers-header-title' );
				expect( title.textContent ).toBe( '[layers-editor-title]' );

				uiManager.destroy();
			} );
		} );
	} );

	describe( 'Close button wiring in page-owned mode', () => {
		it( 'renders accessible Close button in header-right', () => {
			mockEditor.config.pageOwned = {
				owner: 'Test:Owner',
				surfaceId: 'slide-0'
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const closeBtn = uiManager.container.querySelector( '.layers-header-close' );
			expect( closeBtn ).not.toBeNull();
			expect( closeBtn.tagName ).toBe( 'BUTTON' );
			expect( closeBtn.getAttribute( 'type' ) ).toBe( 'button' );
			expect( closeBtn.getAttribute( 'aria-label' ) ).toBe( '[layers-editor-close]' );
			expect( closeBtn.title ).toBe( '[layers-editor-close] (Esc)' );

			const svg = closeBtn.querySelector( 'svg' );
			expect( svg ).not.toBeNull();
			expect( svg.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		} );

		it( 'remains queryable by editor close setup and triggers close action', () => {
			mockEditor.config.pageOwned = {
				owner: 'Test:Owner',
				surfaceId: 'slide-0'
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Simulate editor.setupCloseButton logic
			const closeBtn = uiManager.container.querySelector( '.layers-header-close' );
			expect( closeBtn ).not.toBeNull();

			closeBtn.addEventListener( 'click', () => {
				mockEditor.cancel( true );
			} );

			closeBtn.click();
			expect( mockEditor.cancel ).toHaveBeenCalledWith( true );
		} );
	} );

	describe( 'safe event setup and disposal with absent selectors', () => {
		it( 'setupRevisionControls completes safely when revision elements are absent', () => {
			mockEditor.config.pageOwned = {
				owner: 'Safe:Page',
				surfaceId: 'slide-0'
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Calling setupRevisionControls again or explicitly should not throw
			expect( () => uiManager.setupRevisionControls() ).not.toThrow();
			expect( uiManager.revLoadBtnEl ).toBeNull();
			expect( uiManager.revSelectEl ).toBeNull();
		} );

		it( 'destroy cleans up cleanly with absent selectors and null references', () => {
			mockEditor.config.pageOwned = {
				owner: 'Disposal:Page',
				surfaceId: 'slide-0'
			};

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( document.body.classList.contains( 'layers-editor-open' ) ).toBe( true );
			expect( uiManager.container ).not.toBeNull();

			expect( () => uiManager.destroy() ).not.toThrow();

			expect( document.body.classList.contains( 'layers-editor-open' ) ).toBe( false );
			expect( uiManager.container ).toBeNull();
			expect( uiManager.setSelectEl ).toBeNull();
			expect( uiManager.revSelectEl ).toBeNull();
			expect( uiManager.revLoadBtnEl ).toBeNull();
			expect( uiManager.eventTracker ).toBeNull();

			// Calling destroy again must be idempotent
			expect( () => uiManager.destroy() ).not.toThrow();
		} );
	} );
} );
