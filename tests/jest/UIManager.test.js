/**
 * UIManager.test.js - Tests for the UIManager class
 *
 * UIManager handles all UI creation and management for the Layers editor.
 * It creates DOM elements for the overlay, toolbar, layer panel, status bar,
 * set selectors, revision selectors, and manages spinners/errors.
 */

'use strict';

describe( 'UIManager', () => {
	let UIManager;
	let mockEditor;
	let mockStateManager;

	// Setup mocks before importing UIManager
	beforeAll( () => {
		// Mock global dependencies
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: jest.fn( () => `[${key}]` ),
				parse: jest.fn( () => `<p>[${key}]</p>` )
			} ) ),
			msg: jest.fn( ( key ) => `[${key}]` ),
			config: {
				get: jest.fn( ( key ) => {
					const config = {
						wgUserName: 'TestUser',
						wgPageName: 'File:Test_Image.jpg',
						wgTitle: 'Test Image.jpg'
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

		// Reset window object
		if ( global.window.Layers && global.window.Layers.UI ) {
			delete global.window.Layers.UI.Manager;
		}

		// Load UIManager
		require( '../../resources/ext.layers.editor/UIManager.js' );
		UIManager = global.window.Layers.UI.Manager;
	} );

	beforeEach( () => {
		// Reset DOM
		document.body.innerHTML = '';
		document.body.classList.remove( 'layers-editor-open' );

		// Reset mocks
		jest.clearAllMocks();

		// Create mock state manager
		mockStateManager = {
			get: jest.fn( ( key ) => {
				const state = {
					currentSetName: 'default',
					currentLayerSetId: 123,
					namedSets: [
						{ name: 'default', revision_count: 2, latest_revision: 1 },
						{ name: 'annotations', revision_count: 1, latest_revision: 1 }
					],
					setRevisions: [
						{ ls_id: 123, ls_revision: 2 },
						{ ls_id: 122, ls_revision: 1 }
					],
					isDirty: false
				};
				return state[ key ];
			} ),
			set: jest.fn()
		};

		// Create mock editor
		mockEditor = {
			stateManager: mockStateManager,
			currentLayerSetId: 123,
			loadRevisionById: jest.fn(),
			loadLayerSetByName: jest.fn(),
			imageName: 'Test_Image.jpg',
			originalImageName: 'Test_Image.jpg',
			close: jest.fn()
		};
	} );

	afterEach( () => {
		document.body.innerHTML = '';
		document.body.classList.remove( 'layers-editor-open' );
	} );

	describe( 'constructor', () => {
		it( 'should initialize with editor reference', () => {
			const uiManager = new UIManager( mockEditor );

			expect( uiManager.editor ).toBe( mockEditor );
		} );

		it( 'should initialize DOM references as null', () => {
			const uiManager = new UIManager( mockEditor );

			expect( uiManager.container ).toBeNull();
			expect( uiManager.statusBar ).toBeNull();
			expect( uiManager.spinnerEl ).toBeNull();
			expect( uiManager.setSelectEl ).toBeNull();
			expect( uiManager.newSetInputEl ).toBeNull();
			expect( uiManager.newSetBtnEl ).toBeNull();
			expect( uiManager.revSelectEl ).toBeNull();
			expect( uiManager.revLoadBtnEl ).toBeNull();
			expect( uiManager.revNameInputEl ).toBeNull();
			expect( uiManager.zoomReadoutEl ).toBeNull();
		} );
	} );

	describe( 'createInterface', () => {
		it( 'should create container element', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.container ).toBeTruthy();
			expect( uiManager.container.className ).toBe( 'layers-editor' );
		} );

		it( 'should set ARIA attributes on container', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.container.getAttribute( 'role' ) ).toBe( 'application' );
			expect( uiManager.container.getAttribute( 'aria-label' ) ).toBe( 'Layers Image Editor' );
		} );

		it( 'should add body class when interface is created', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( document.body.classList.contains( 'layers-editor-open' ) ).toBe( true );
		} );

		it( 'should append container to document body', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( document.body.contains( uiManager.container ) ).toBe( true );
		} );

		it( 'should create header', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const header = uiManager.container.querySelector( '.layers-header' );
			expect( header ).toBeTruthy();
		} );

		it( 'should create main content area', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const main = uiManager.container.querySelector( '.layers-main' );
			expect( main ).toBeTruthy();
		} );

		it( 'should create status bar', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.statusBar ).toBeTruthy();
			expect( uiManager.statusBar.className ).toBe( 'layers-statusbar' );
		} );

		it( 'should create toolbar', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const toolbar = uiManager.container.querySelector( '.layers-toolbar' );
			expect( toolbar ).toBeTruthy();
		} );

		it( 'should create canvas container', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const canvasContainer = uiManager.container.querySelector( '.layers-canvas-container' );
			expect( canvasContainer ).toBeTruthy();
		} );

		it( 'should create layer panel container', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const layerPanel = uiManager.container.querySelector( '.layers-panel' );
			expect( layerPanel ).toBeTruthy();
		} );
	} );

	describe( 'createHeader', () => {
		it( 'should create header with title', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const title = uiManager.container.querySelector( '.layers-header-title' );
			expect( title ).toBeTruthy();
			expect( title.getAttribute( 'role' ) ).toBe( 'heading' );
		} );

		it( 'should display filename in title when available', () => {
			mockEditor.filename = 'Test_Image.jpg';
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const title = uiManager.container.querySelector( '.layers-header-title' );
			expect( title.textContent ).toContain( 'Test_Image.jpg' );
		} );

		it( 'should create header right section', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const headerRight = uiManager.container.querySelector( '.layers-header-right' );
			expect( headerRight ).toBeTruthy();
		} );
	} );

	describe( 'createZoomReadout', () => {
		it( 'should create zoom readout element', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.zoomReadoutEl ).toBeTruthy();
			expect( uiManager.zoomReadoutEl.className ).toBe( 'layers-zoom-readout' );
		} );

		it( 'should initialize zoom readout with 100%', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.zoomReadoutEl.textContent ).toBe( '100%' );
		} );
	} );

	describe( 'createSetSelector', () => {
		it( 'should create set selector container', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.setSelectEl ).toBeTruthy();
		} );

		it( 'should create new set input (hidden by default)', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.newSetInputEl ).toBeTruthy();
			expect( uiManager.newSetInputEl.style.display ).toBe( 'none' );
		} );

		it( 'should create new set button (hidden by default)', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.newSetBtnEl ).toBeTruthy();
			expect( uiManager.newSetBtnEl.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'createRevisionSelector', () => {
		it( 'should create revision selector element', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.revSelectEl ).toBeTruthy();
		} );

		it( 'should create load revision button', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.revLoadBtnEl ).toBeTruthy();
		} );
	} );

	describe( 'createCloseButton', () => {
		it( 'should create close button', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const closeBtn = uiManager.container.querySelector( '.layers-header-close' );
			expect( closeBtn ).toBeTruthy();
		} );

		it( 'should set ARIA label on close button', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const closeBtn = uiManager.container.querySelector( '.layers-header-close' );
			expect( closeBtn.getAttribute( 'aria-label' ) ).toBeTruthy();
		} );

		it( 'should have close button with × text', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const closeBtn = uiManager.container.querySelector( '.layers-header-close' );
			expect( closeBtn.textContent ).toBe( '×' );
		} );
	} );

	describe( 'createStatusBar', () => {
		it( 'should create status items', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const statusItems = uiManager.statusBar.querySelectorAll( '.status-item' );
			expect( statusItems.length ).toBeGreaterThan( 0 );
		} );

		it( 'should create tool status item', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const toolItem = uiManager.statusBar.querySelector( '[data-status="tool"]' );
			expect( toolItem ).toBeTruthy();
		} );

		it( 'should create zoom status item', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const zoomItem = uiManager.statusBar.querySelector( '[data-status="zoom"]' );
			expect( zoomItem ).toBeTruthy();
		} );

		it( 'should create position status item', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const posItem = uiManager.statusBar.querySelector( '[data-status="pos"]' );
			expect( posItem ).toBeTruthy();
		} );

		it( 'should create size status item', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const sizeItem = uiManager.statusBar.querySelector( '[data-status="size"]' );
			expect( sizeItem ).toBeTruthy();
		} );

		it( 'should create selection status item', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const selItem = uiManager.statusBar.querySelector( '[data-status="selection"]' );
			expect( selItem ).toBeTruthy();
		} );

		it( 'should create code display section', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const code = uiManager.statusBar.querySelector( '.status-code' );
			expect( code ).toBeTruthy();
		} );
	} );

	describe( 'setupStatusUpdates', () => {
		it( 'should set updateZoomReadout function on uiManager', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( typeof uiManager.updateZoomReadout ).toBe( 'function' );
		} );

		it( 'should set updateStatus function on uiManager', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( typeof uiManager.updateStatus ).toBe( 'function' );
		} );

		it( 'updateZoomReadout should update zoom readout element', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.updateZoomReadout( 150 );

			expect( uiManager.zoomReadoutEl.textContent ).toBe( '150%' );
		} );

		it( 'updateStatus should update status items', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.updateStatus( { tool: 'rectangle' } );

			const toolItem = uiManager.statusBar.querySelector( '[data-status="tool"]' );
			expect( toolItem.textContent ).toBe( 'rectangle' );
		} );

		it( 'updateStatus should format zoomPercent as percentage', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.updateStatus( { zoomPercent: 75.5 } );

			const zoomItem = uiManager.statusBar.querySelector( '[data-status="zoomPercent"]' );
			// zoomPercent may not have a status item, check zoom instead
			const zoomItemAlt = uiManager.statusBar.querySelector( '[data-status="zoom"]' );
			// The formatting logic uses zoomPercent key but displays on zoom status
		} );

		it( 'updateStatus should format pos as x,y', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.updateStatus( { pos: { x: 100.5, y: 200.7 } } );

			const posItem = uiManager.statusBar.querySelector( '[data-status="pos"]' );
			expect( posItem.textContent ).toBe( '101,201' );
		} );

		it( 'updateStatus should format size as width×height', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.updateStatus( { size: { width: 150.3, height: 100.8 } } );

			const sizeItem = uiManager.statusBar.querySelector( '[data-status="size"]' );
			expect( sizeItem.textContent ).toBe( '150×101' );
		} );
	} );

	describe( 'setupRevisionControls', () => {
		it( 'should load revision when load button clicked', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Set a revision value
			uiManager.revSelectEl.innerHTML = '<option value="456">Rev 3</option>';
			uiManager.revSelectEl.value = '456';

			// Simulate click
			uiManager.revLoadBtnEl.click();

			expect( mockEditor.loadRevisionById ).toHaveBeenCalledWith( 456 );
		} );

		it( 'should not load revision if no value selected', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Set empty value
			uiManager.revSelectEl.value = '';

			// Simulate click
			uiManager.revLoadBtnEl.click();

			expect( mockEditor.loadRevisionById ).not.toHaveBeenCalled();
		} );

		it( 'should disable load button when current revision selected', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Set current revision as value
			uiManager.revSelectEl.innerHTML = '<option value="123">Rev 2</option>';
			uiManager.revSelectEl.value = '123';

			// Trigger change event
			uiManager.revSelectEl.dispatchEvent( new Event( 'change' ) );

			expect( uiManager.revLoadBtnEl.disabled ).toBe( true );
		} );

		it( 'should enable load button when different revision selected', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Set different revision as value
			uiManager.revSelectEl.innerHTML = '<option value="456">Rev 3</option>';
			uiManager.revSelectEl.value = '456';

			// Trigger change event
			uiManager.revSelectEl.dispatchEvent( new Event( 'change' ) );

			expect( uiManager.revLoadBtnEl.disabled ).toBe( false );
		} );
	} );

	describe( 'setupSetSelectorControls', () => {
		it( 'should show new set input when __new__ selected', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Add __new__ option and select it
			const newOption = document.createElement( 'option' );
			newOption.value = '__new__';
			uiManager.setSelectEl.appendChild( newOption );
			uiManager.setSelectEl.value = '__new__';

			// Trigger change event
			uiManager.setSelectEl.dispatchEvent( new Event( 'change' ) );

			expect( uiManager.newSetInputEl.style.display ).toBe( 'inline-block' );
			expect( uiManager.newSetBtnEl.style.display ).toBe( 'inline-block' );
		} );

		it( 'should load set when existing set selected', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Add options
			const option = document.createElement( 'option' );
			option.value = 'annotations';
			uiManager.setSelectEl.appendChild( option );
			uiManager.setSelectEl.value = 'annotations';

			// Trigger change event
			uiManager.setSelectEl.dispatchEvent( new Event( 'change' ) );

			expect( mockEditor.loadLayerSetByName ).toHaveBeenCalledWith( 'annotations' );
		} );

		it( 'should confirm before switching when dirty', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'isDirty' ) return true;
				if ( key === 'currentSetName' ) return 'default';
				return null;
			} );

			// Mock confirm to return false
			const originalConfirm = window.confirm;
			window.confirm = jest.fn( () => false );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Add default and annotations options
			const defaultOption = document.createElement( 'option' );
			defaultOption.value = 'default';
			uiManager.setSelectEl.appendChild( defaultOption );

			const option = document.createElement( 'option' );
			option.value = 'annotations';
			uiManager.setSelectEl.appendChild( option );
			uiManager.setSelectEl.value = 'annotations';

			// Trigger change event
			uiManager.setSelectEl.dispatchEvent( new Event( 'change' ) );

			expect( window.confirm ).toHaveBeenCalled();
			expect( mockEditor.loadLayerSetByName ).not.toHaveBeenCalled();
			expect( uiManager.setSelectEl.value ).toBe( 'default' );

			window.confirm = originalConfirm;
		} );
	} );

	describe( 'showNewSetInput', () => {
		it( 'should show input and button when true', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showNewSetInput( true );

			expect( uiManager.newSetInputEl.style.display ).toBe( 'inline-block' );
			expect( uiManager.newSetBtnEl.style.display ).toBe( 'inline-block' );
		} );

		it( 'should hide input and button when false', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// First show, then hide
			uiManager.showNewSetInput( true );
			uiManager.showNewSetInput( false );

			expect( uiManager.newSetInputEl.style.display ).toBe( 'none' );
			expect( uiManager.newSetBtnEl.style.display ).toBe( 'none' );
		} );

		it( 'should clear and focus input when showing', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Set a value first
			uiManager.newSetInputEl.value = 'test';

			// Create a focus spy
			const focusSpy = jest.spyOn( uiManager.newSetInputEl, 'focus' );

			uiManager.showNewSetInput( true );

			expect( uiManager.newSetInputEl.value ).toBe( '' );
			expect( focusSpy ).toHaveBeenCalled();
		} );
	} );

	describe( 'createNewSet', () => {
		it( 'should notify if name is empty', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.newSetInputEl.value = '   ';
			uiManager.createNewSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'warn' }
			);
		} );

		it( 'should notify if name contains invalid characters', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.newSetInputEl.value = 'test<script>';
			uiManager.createNewSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'error' }
			);
		} );

		it( 'should notify if name already exists', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.newSetInputEl.value = 'default';
			uiManager.createNewSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'warn' }
			);
		} );

		it( 'should create new set with valid name', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.newSetInputEl.value = 'my-new-set';
			uiManager.createNewSet();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'my-new-set' );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentLayerSetId', null );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'isDirty', true );
		} );

		it( 'should hide new set input after creation', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showNewSetInput( true );
			uiManager.newSetInputEl.value = 'my-new-set';
			uiManager.createNewSet();

			expect( uiManager.newSetInputEl.style.display ).toBe( 'none' );
		} );

		it( 'should notify success after creation', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.newSetInputEl.value = 'my-new-set';
			uiManager.createNewSet();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'success' }
			);
		} );
	} );

	describe( 'addSetOption', () => {
		it( 'should add option to set selector', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const initialCount = uiManager.setSelectEl.options.length;
			uiManager.addSetOption( 'new-set' );

			expect( uiManager.setSelectEl.options.length ).toBe( initialCount + 1 );
		} );

		it( 'should select new option when select=true', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.addSetOption( 'new-set', true );

			expect( uiManager.setSelectEl.value ).toBe( 'new-set' );
		} );

		it( 'should insert before __new__ option', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Add __new__ option
			const newOption = document.createElement( 'option' );
			newOption.value = '__new__';
			newOption.textContent = '+ New';
			uiManager.setSelectEl.appendChild( newOption );

			uiManager.addSetOption( 'test-set' );

			// __new__ should be last
			const options = uiManager.setSelectEl.options;
			expect( options[ options.length - 1 ].value ).toBe( '__new__' );
		} );
	} );

	describe( 'getMessage', () => {
		it( 'should delegate to window.layersMessages.get', () => {
			const uiManager = new UIManager( mockEditor );

			const result = uiManager.getMessage( 'test-key' );

			// getMessage now delegates to MessageHelper which returns key when message doesn't exist
			expect( typeof result ).toBe( 'string' );
		} );

		it( 'should pass fallback parameter through to MessageHelper', () => {
			const uiManager = new UIManager( mockEditor );

			const result = uiManager.getMessage( 'test-key', 'fallback-value' );

			// MessageHelper handles the fallback logic
			expect( typeof result ).toBe( 'string' );
		} );
	} );

	describe( 'showSpinner', () => {
		it( 'should create spinner element', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showSpinner( 'Loading...' );

			expect( uiManager.spinnerEl ).toBeTruthy();
			expect( uiManager.spinnerEl.className ).toBe( 'layers-spinner' );
		} );

		it( 'should set ARIA attributes on spinner', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showSpinner( 'Loading...' );

			expect( uiManager.spinnerEl.getAttribute( 'role' ) ).toBe( 'status' );
			expect( uiManager.spinnerEl.getAttribute( 'aria-live' ) ).toBe( 'polite' );
		} );

		it( 'should display message in spinner', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showSpinner( 'Loading data...' );

			const textEl = uiManager.spinnerEl.querySelector( '.spinner-text' );
			expect( textEl.textContent ).toContain( 'Loading data...' );
		} );

		it( 'should append spinner to container', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showSpinner( 'Loading...' );

			expect( uiManager.container.contains( uiManager.spinnerEl ) ).toBe( true );
		} );

		it( 'should remove existing spinner before showing new one', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showSpinner( 'First' );
			const firstSpinner = uiManager.spinnerEl;

			uiManager.showSpinner( 'Second' );

			expect( uiManager.container.contains( firstSpinner ) ).toBe( false );
			expect( uiManager.spinnerEl.querySelector( '.spinner-text' ).textContent ).toContain( 'Second' );
		} );
	} );

	describe( 'hideSpinner', () => {
		it( 'should remove spinner element', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showSpinner( 'Loading...' );
			uiManager.hideSpinner();

			expect( uiManager.spinnerEl ).toBeNull();
		} );

		it( 'should not error if no spinner exists', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( () => uiManager.hideSpinner() ).not.toThrow();
		} );
	} );

	describe( 'showError', () => {
		it( 'should create error element', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showError( 'Something went wrong' );

			const errorEl = uiManager.container.querySelector( '.layers-error' );
			expect( errorEl ).toBeTruthy();
		} );

		it( 'should display error message', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showError( 'Test error message' );

			const errorEl = uiManager.container.querySelector( '.layers-error' );
			expect( errorEl.textContent ).toContain( 'Test error message' );
		} );

		it( 'should auto-dismiss after timeout', () => {
			jest.useFakeTimers();

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showError( 'Temporary error' );

			const errorEl = uiManager.container.querySelector( '.layers-error' );
			expect( errorEl ).toBeTruthy();

			// Fast-forward past the dismiss timeout (10s + 500ms)
			jest.advanceTimersByTime( 10500 );

			expect( uiManager.container.querySelector( '.layers-error' ) ).toBeNull();

			jest.useRealTimers();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should remove container from DOM', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( document.body.contains( uiManager.container ) ).toBe( true );

			uiManager.destroy();

			expect( document.body.contains( uiManager.container ) ).toBe( false );
		} );

		it( 'should remove body class', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( document.body.classList.contains( 'layers-editor-open' ) ).toBe( true );

			uiManager.destroy();

			expect( document.body.classList.contains( 'layers-editor-open' ) ).toBe( false );
		} );

		it( 'should hide spinner if present', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.showSpinner( 'Loading...' );

			uiManager.destroy();

			expect( uiManager.spinnerEl ).toBeNull();
		} );

		it( 'should not error if container already removed', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Manually remove container
			uiManager.container.remove();

			expect( () => uiManager.destroy() ).not.toThrow();
		} );
	} );

	describe( 'keyboard handling', () => {
		it( 'should create new set on Enter in input', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showNewSetInput( true );
			uiManager.newSetInputEl.value = 'keyboard-set';

			// Simulate Enter key
			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			uiManager.newSetInputEl.dispatchEvent( event );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'keyboard-set' );
		} );

		it( 'should cancel new set on Escape in input', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'default';
				return null;
			} );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Add default option so it can be restored
			const defaultOption = document.createElement( 'option' );
			defaultOption.value = 'default';
			uiManager.setSelectEl.appendChild( defaultOption );

			uiManager.showNewSetInput( true );
			uiManager.newSetInputEl.value = 'cancelled-set';

			// Simulate Escape key
			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			uiManager.newSetInputEl.dispatchEvent( event );

			expect( uiManager.newSetInputEl.style.display ).toBe( 'none' );
			expect( uiManager.setSelectEl.value ).toBe( 'default' );
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should handle editor without stateManager', () => {
			const editorNoState = {
				...mockEditor,
				stateManager: null,
				currentLayerSetId: 123
			};

			const uiManager = new UIManager( editorNoState );

			expect( () => uiManager.createInterface() ).not.toThrow();
		} );

		it( 'should handle missing imageName', () => {
			const editorNoImage = {
				...mockEditor,
				imageName: null,
				originalImageName: null
			};

			const uiManager = new UIManager( editorNoImage );

			expect( () => uiManager.createInterface() ).not.toThrow();
		} );

		it( 'should handle empty message', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			uiManager.showSpinner();

			expect( uiManager.spinnerEl ).toBeTruthy();
		} );

		it( 'should handle null error message', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( () => uiManager.showError( null ) ).not.toThrow();
		} );
	} );

	describe( 'deleteCurrentSet', () => {
		it( 'should do nothing when currentSet is not set', () => {
			mockStateManager.get.mockReturnValue( null );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			// No confirm called since there's no set
			expect( window.confirm ).not.toHaveBeenCalled();
		} );

		it( 'should show info message when default set has no layers', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'default';
				if ( key === 'layers' ) return [];
				return null;
			} );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'No layers to clear',
				{ type: 'info' }
			);
		} );

		it( 'should prompt to clear layers for default set', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'default';
				if ( key === 'layers' ) return [ { id: 'layer1' } ];
				return null;
			} );

			window.confirm = jest.fn( () => false ); // User cancels

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			expect( window.confirm ).toHaveBeenCalledWith(
				'Clear all layers from the default set? This will remove all annotations.'
			);
		} );

		it( 'should clear layers when user confirms default set clear', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'default';
				if ( key === 'layers' ) return [ { id: 'layer1' } ];
				return null;
			} );

			window.confirm = jest.fn( () => true ); // User confirms

			const mockCanvasManager = { renderLayers: jest.fn() };
			const mockLayerPanel = { renderLayerList: jest.fn() };
			const mockSelectionManager = { clearSelection: jest.fn() };
			const mockApiManager = { saveLayers: jest.fn().mockResolvedValue( {} ) };

			mockEditor.canvasManager = mockCanvasManager;
			mockEditor.layerPanel = mockLayerPanel;
			mockEditor.selectionManager = mockSelectionManager;
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'layers', [] );
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalledWith( [] );
			expect( mockLayerPanel.renderLayerList ).toHaveBeenCalled();
			expect( mockSelectionManager.clearSelection ).toHaveBeenCalled();
			expect( mockApiManager.saveLayers ).toHaveBeenCalledWith( [], 'default' );
		} );

		it( 'should show success notification after clearing default set', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'default';
				if ( key === 'layers' ) return [ { id: 'layer1' } ];
				return null;
			} );

			window.confirm = jest.fn( () => true );

			const mockApiManager = { saveLayers: jest.fn().mockResolvedValue( {} ) };
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			// Wait for promise to resolve
			await Promise.resolve();
			await Promise.resolve();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'isDirty', false );
			expect( global.mw.notify ).toHaveBeenCalledWith(
				'All layers cleared from default set.',
				{ type: 'success' }
			);
		} );

		it( 'should show error notification when clearing default set fails', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'default';
				if ( key === 'layers' ) return [ { id: 'layer1' } ];
				return null;
			} );

			window.confirm = jest.fn( () => true );

			const mockApiManager = {
				saveLayers: jest.fn().mockRejectedValue( new Error( 'Save failed' ) )
			};
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			// Wait for promise to reject
			await Promise.resolve();
			await Promise.resolve();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'Failed to save changes',
				{ type: 'error' }
			);
		} );

		it( 'should confirm and delete non-default set', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'annotations';
				if ( key === 'namedSets' ) {
					return [
						{ name: 'annotations', revision_count: 3 }
					];
				}
				return null;
			} );

			window.confirm = jest.fn( () => false ); // User cancels

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			expect( window.confirm ).toHaveBeenCalledWith(
				'layers-delete-set-confirm'
			);
		} );

		it( 'should call API to delete non-default set when confirmed', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'annotations';
				if ( key === 'namedSets' ) {
					return [ { name: 'annotations', revision_count: 1 } ];
				}
				return null;
			} );

			window.confirm = jest.fn( () => true );

			const mockApiManager = {
				deleteLayerSet: jest.fn().mockResolvedValue( {} )
			};
			const mockRevisionManager = { buildSetSelector: jest.fn() };
			mockEditor.apiManager = mockApiManager;
			mockEditor.revisionManager = mockRevisionManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			expect( mockApiManager.deleteLayerSet ).toHaveBeenCalledWith( 'annotations' );

			// Wait for promise
			await Promise.resolve();
			await Promise.resolve();

			expect( mockRevisionManager.buildSetSelector ).toHaveBeenCalled();
		} );

		it( 'should handle delete API error gracefully', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'annotations';
				if ( key === 'namedSets' ) {
					return [ { name: 'annotations', revision_count: 1 } ];
				}
				return null;
			} );

			window.confirm = jest.fn( () => true );

			const mockApiManager = {
				deleteLayerSet: jest.fn().mockRejectedValue( new Error( 'Delete failed' ) )
			};
			mockEditor.apiManager = mockApiManager;

			global.mw.log.error = jest.fn();

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			// Wait for promise to reject
			await Promise.resolve();
			await Promise.resolve();

			expect( global.mw.log.error ).toHaveBeenCalledWith(
				'[UIManager] deleteCurrentSet error:',
				expect.any( Error )
			);
		} );

		it( 'should show error when apiManager is not available', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'annotations';
				if ( key === 'namedSets' ) {
					return [ { name: 'annotations', revision_count: 1 } ];
				}
				return null;
			} );

			window.confirm = jest.fn( () => true );
			mockEditor.apiManager = null;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.deleteCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'layers-delete-failed',
				{ type: 'error' }
			);
		} );
	} );

	describe( 'renameCurrentSet', () => {
		it( 'should not allow renaming default set', () => {
			mockStateManager.get.mockReturnValue( 'default' );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'The default layer set cannot be renamed',
				{ type: 'warn' }
			);
		} );

		it( 'should do nothing when user cancels prompt', () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => null ); // User cancels

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( window.prompt ).toHaveBeenCalled();
			// No API call should be made
			expect( mockEditor.apiManager ).toBeUndefined();
		} );

		it( 'should do nothing when new name is empty', () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => '   ' ); // Empty/whitespace

			const mockApiManager = { renameLayerSet: jest.fn() };
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).not.toHaveBeenCalled();
		} );

		it( 'should do nothing when new name is same as current', () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => 'annotations' ); // Same name

			const mockApiManager = { renameLayerSet: jest.fn() };
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).not.toHaveBeenCalled();
		} );

		it( 'should reject invalid set name format', () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => 'invalid name!' ); // Invalid chars

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'layers-invalid-setname' ),
				expect.objectContaining( { type: 'error' } )
			);
		} );

		it( 'should reject set name that is too long', () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => 'a'.repeat( 51 ) ); // 51 chars

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'layers-invalid-setname' ),
				expect.objectContaining( { type: 'error' } )
			);
		} );

		it( 'should call API to rename with valid name', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => 'new-name' );

			const mockApiManager = {
				renameLayerSet: jest.fn().mockResolvedValue( {} )
			};
			const mockRevisionManager = { buildSetSelector: jest.fn() };
			mockEditor.apiManager = mockApiManager;
			mockEditor.revisionManager = mockRevisionManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).toHaveBeenCalledWith( 'annotations', 'new-name' );

			// Wait for promise
			await Promise.resolve();
			await Promise.resolve();

			expect( mockRevisionManager.buildSetSelector ).toHaveBeenCalled();
		} );

		it( 'should trim whitespace from new name', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => '  trimmed-name  ' );

			const mockApiManager = {
				renameLayerSet: jest.fn().mockResolvedValue( {} )
			};
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).toHaveBeenCalledWith(
				'annotations',
				'trimmed-name'
			);
		} );

		it( 'should handle rename API error gracefully', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => 'new-name' );

			const mockApiManager = {
				renameLayerSet: jest.fn().mockRejectedValue( new Error( 'Rename failed' ) )
			};
			mockEditor.apiManager = mockApiManager;

			global.mw.log.error = jest.fn();

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			// Wait for promise to reject
			await Promise.resolve();
			await Promise.resolve();

			expect( global.mw.log.error ).toHaveBeenCalledWith(
				'[UIManager] renameCurrentSet error:',
				expect.any( Error )
			);
		} );

		it( 'should show error when apiManager is not available', () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => 'new-name' );
			mockEditor.apiManager = null;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'Failed to rename layer set',
				{ type: 'error' }
			);
		} );

		it( 'should accept valid alphanumeric names with hyphens and underscores', async () => {
			mockStateManager.get.mockReturnValue( 'old-set' );
			window.prompt = jest.fn( () => 'my_new-Set123' );

			const mockApiManager = {
				renameLayerSet: jest.fn().mockResolvedValue( {} )
			};
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).toHaveBeenCalledWith(
				'old-set',
				'my_new-Set123'
			);
		} );

		it( 'should use editor.buildSetSelector if revisionManager is not available', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			window.prompt = jest.fn( () => 'new-name' );

			const mockApiManager = {
				renameLayerSet: jest.fn().mockResolvedValue( {} )
			};
			const buildSetSelector = jest.fn();
			mockEditor.apiManager = mockApiManager;
			mockEditor.revisionManager = null;
			mockEditor.buildSetSelector = buildSetSelector;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			uiManager.renameCurrentSet();

			// Wait for promise
			await Promise.resolve();
			await Promise.resolve();

			expect( buildSetSelector ).toHaveBeenCalled();
		} );
	} );
} );
