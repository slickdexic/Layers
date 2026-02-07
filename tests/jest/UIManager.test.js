/**
 * UIManager.test.js - Tests for the UIManager class
 *
 * UIManager handles all UI creation and management for the Layers editor.
 * It creates DOM elements for the overlay, toolbar, layer panel,
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
			delete global.window.Layers.UI.SetSelectorController;
		}

		// Load SetSelectorController first (dependency of UIManager)
		require( '../../resources/ext.layers.editor/ui/SetSelectorController.js' );

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

			expect( uiManager.container ).toBeInstanceOf( HTMLElement );
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
			expect( header ).not.toBeNull();
		} );

		it( 'should create main content area', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const main = uiManager.container.querySelector( '.layers-main' );
			expect( main ).not.toBeNull();
		} );

		it( 'should create toolbar', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const toolbar = uiManager.container.querySelector( '.layers-toolbar' );
			expect( toolbar ).not.toBeNull();
		} );

		it( 'should create canvas container', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const canvasContainer = uiManager.container.querySelector( '.layers-canvas-container' );
			expect( canvasContainer ).not.toBeNull();
		} );

		it( 'should create layer panel container', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const layerPanel = uiManager.container.querySelector( '.layers-panel' );
			expect( layerPanel ).not.toBeNull();
		} );
	} );

	describe( 'createHeader', () => {
		it( 'should create header with title', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const title = uiManager.container.querySelector( '.layers-header-title' );
			expect( title ).not.toBeNull();
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
			expect( headerRight ).not.toBeNull();
		} );
	} );

	describe( 'createZoomReadout', () => {
		it( 'should create zoom readout element', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.zoomReadoutEl ).toBeInstanceOf( HTMLElement );
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

			expect( uiManager.setSelectEl ).toBeInstanceOf( HTMLElement );
		} );

		it( 'should create new set input (hidden by default)', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.newSetInputEl ).toBeInstanceOf( HTMLElement );
			expect( uiManager.newSetInputEl.style.display ).toBe( 'none' );
		} );

		it( 'should create new set button (hidden by default)', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.newSetBtnEl ).toBeInstanceOf( HTMLElement );
			expect( uiManager.newSetBtnEl.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'createRevisionSelector', () => {
		it( 'should create revision selector element', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.revSelectEl ).toBeInstanceOf( HTMLElement );
		} );

		it( 'should create load revision button', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( uiManager.revLoadBtnEl ).toBeInstanceOf( HTMLElement );
		} );
	} );

	describe( 'createCloseButton', () => {
		it( 'should create close button', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const closeBtn = uiManager.container.querySelector( '.layers-header-close' );
			expect( closeBtn ).not.toBeNull();
		} );

		it( 'should set ARIA label on close button', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const closeBtn = uiManager.container.querySelector( '.layers-header-close' );
			expect( typeof closeBtn.getAttribute( 'aria-label' ) ).toBe( 'string' );
		} );

		it( 'should have close button with SVG icon', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const closeBtn = uiManager.container.querySelector( '.layers-header-close' );
			const svg = closeBtn.querySelector( 'svg' );
			expect( svg ).not.toBeNull();
			expect( svg.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
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

		it( 'should confirm before switching when dirty', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'isDirty' ) return true;
				if ( key === 'currentSetName' ) return 'default';
				return null;
			} );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the confirm dialog helper to reject
			uiManager.showConfirmDialog = jest.fn().mockResolvedValue( false );

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

			// Wait for async handler to complete
			await Promise.resolve();
			await Promise.resolve();

			expect( uiManager.showConfirmDialog ).toHaveBeenCalled();
			expect( mockEditor.loadLayerSetByName ).not.toHaveBeenCalled();
			expect( uiManager.setSelectEl.value ).toBe( 'default' );
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

			expect( uiManager.spinnerEl ).toBeInstanceOf( HTMLElement );
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
			expect( errorEl ).not.toBeNull();
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
			expect( errorEl ).not.toBeNull();

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

		it( 'should clear activeTimeouts when destroying', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Add some tracked timeouts
			const clearTimeoutSpy = jest.spyOn( global, 'clearTimeout' );
			uiManager.activeTimeouts = new Set( [ 100, 200, 300 ] );

			uiManager.destroy();

			expect( clearTimeoutSpy ).toHaveBeenCalledWith( 100 );
			expect( clearTimeoutSpy ).toHaveBeenCalledWith( 200 );
			expect( clearTimeoutSpy ).toHaveBeenCalledWith( 300 );
			clearTimeoutSpy.mockRestore();
		} );

		it( 'should call eventTracker.destroy when destroying', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Create mock event tracker
			const mockDestroy = jest.fn();
			uiManager.eventTracker = { destroy: mockDestroy };

			uiManager.destroy();

			expect( mockDestroy ).toHaveBeenCalled();
			expect( uiManager.eventTracker ).toBeNull();
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

			expect( uiManager.spinnerEl ).toBeInstanceOf( HTMLElement );
		} );

		it( 'should handle null error message', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( () => uiManager.showError( null ) ).not.toThrow();
		} );
	} );

	describe( 'deleteCurrentSet', () => {
		it( 'should do nothing when currentSet is not set', async () => {
			mockStateManager.get.mockReturnValue( null );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the confirm dialog helper
			uiManager.showConfirmDialog = jest.fn();

			await uiManager.deleteCurrentSet();

			// No confirm called since there's no set
			expect( uiManager.showConfirmDialog ).not.toHaveBeenCalled();
		} );

		it( 'should show info message when default set has no layers', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'default';
				if ( key === 'layers' ) return [];
				return null;
			} );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			await uiManager.deleteCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'No layers to clear',
				{ type: 'info' }
			);
		} );

		it( 'should prompt to clear layers for default set', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'default';
				if ( key === 'layers' ) return [ { id: 'layer1' } ];
				return null;
			} );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the confirm dialog helper to reject
			uiManager.showConfirmDialog = jest.fn().mockResolvedValue( false );

			await uiManager.deleteCurrentSet();

			expect( uiManager.showConfirmDialog ).toHaveBeenCalledWith(
				expect.objectContaining( {
					message: 'Clear all layers from the default set? This will remove all annotations.',
					isDanger: true
				} )
			);
		} );

		it( 'should clear layers when user confirms default set clear', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'default';
				if ( key === 'layers' ) return [ { id: 'layer1' } ];
				return null;
			} );

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
			// Mock the confirm dialog helper to confirm
			uiManager.showConfirmDialog = jest.fn().mockResolvedValue( true );

			await uiManager.deleteCurrentSet();

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

			const mockApiManager = { saveLayers: jest.fn().mockResolvedValue( {} ) };
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the confirm dialog helper to confirm
			uiManager.showConfirmDialog = jest.fn().mockResolvedValue( true );

			await uiManager.deleteCurrentSet();

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

			const mockApiManager = {
				saveLayers: jest.fn().mockRejectedValue( new Error( 'Save failed' ) )
			};
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the confirm dialog helper to confirm
			uiManager.showConfirmDialog = jest.fn().mockResolvedValue( true );

			await uiManager.deleteCurrentSet();

			// Wait for the internal .then().catch() chain to complete
			await new Promise( process.nextTick );

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'Failed to save changes',
				{ type: 'error' }
			);
		} );

		it( 'should confirm and delete non-default set', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'annotations';
				if ( key === 'namedSets' ) {
					return [
						{ name: 'annotations', revision_count: 3 }
					];
				}
				return null;
			} );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the confirm dialog helper to cancel
			uiManager.showConfirmDialog = jest.fn().mockResolvedValue( false );

			await uiManager.deleteCurrentSet();

			expect( uiManager.showConfirmDialog ).toHaveBeenCalledWith(
				expect.objectContaining( {
					message: 'layers-delete-set-confirm',
					isDanger: true
				} )
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

			const mockApiManager = {
				deleteLayerSet: jest.fn().mockResolvedValue( {} )
			};
			const mockRevisionManager = { buildSetSelector: jest.fn() };
			mockEditor.apiManager = mockApiManager;
			mockEditor.revisionManager = mockRevisionManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the confirm dialog helper to confirm
			uiManager.showConfirmDialog = jest.fn().mockResolvedValue( true );

			await uiManager.deleteCurrentSet();

			expect( mockApiManager.deleteLayerSet ).toHaveBeenCalledWith( 'annotations' );
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

			const mockApiManager = {
				deleteLayerSet: jest.fn().mockRejectedValue( new Error( 'Delete failed' ) )
			};
			mockEditor.apiManager = mockApiManager;

			global.mw.log.error = jest.fn();

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the confirm dialog helper to confirm
			uiManager.showConfirmDialog = jest.fn().mockResolvedValue( true );

			await uiManager.deleteCurrentSet();

			// Wait for the internal .then().catch() chain to complete
			await new Promise( process.nextTick );

			expect( global.mw.log.error ).toHaveBeenCalledWith(
				'[SetSelectorController] deleteCurrentSet error:',
				expect.any( Error )
			);
		} );

		it( 'should show error when apiManager is not available', async () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'currentSetName' ) return 'annotations';
				if ( key === 'namedSets' ) {
					return [ { name: 'annotations', revision_count: 1 } ];
				}
				return null;
			} );

			mockEditor.apiManager = null;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the confirm dialog helper to confirm
			uiManager.showConfirmDialog = jest.fn().mockResolvedValue( true );

			await uiManager.deleteCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'layers-delete-failed',
				{ type: 'error' }
			);
		} );
	} );

	describe( 'renameCurrentSet', () => {
		it( 'should not allow renaming default set', async () => {
			mockStateManager.get.mockReturnValue( 'default' );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			await uiManager.renameCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'The default layer set cannot be renamed',
				{ type: 'warn' }
			);
		} );

		it( 'should do nothing when user cancels prompt', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to cancel
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( null );

			await uiManager.renameCurrentSet();

			expect( uiManager.showPromptDialog ).toHaveBeenCalled();
			// No API call should be made
			expect( mockEditor.apiManager ).toBeUndefined();
		} );

		it( 'should do nothing when new name is empty', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );

			const mockApiManager = { renameLayerSet: jest.fn() };
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to return whitespace
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( '   ' );

			await uiManager.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).not.toHaveBeenCalled();
		} );

		it( 'should do nothing when new name is same as current', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			const mockApiManager = { renameLayerSet: jest.fn() };
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to return same name
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( 'annotations' );

			await uiManager.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).not.toHaveBeenCalled();
		} );

		it( 'should reject invalid set name format', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to return invalid name
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( 'invalid name!' );

			await uiManager.renameCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'layers-invalid-setname' ),
				expect.objectContaining( { type: 'error' } )
			);
		} );

		it( 'should reject set name that is too long', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to return long name (>255 chars)
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( 'a'.repeat( 256 ) );

			await uiManager.renameCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'layers-invalid-setname' ),
				expect.objectContaining( { type: 'error' } )
			);
		} );

		it( 'should call API to rename with valid name', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );

			const mockApiManager = {
				renameLayerSet: jest.fn().mockResolvedValue( {} )
			};
			const mockRevisionManager = { buildSetSelector: jest.fn() };
			mockEditor.apiManager = mockApiManager;
			mockEditor.revisionManager = mockRevisionManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to return valid name
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( 'new-name' );

			await uiManager.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).toHaveBeenCalledWith( 'annotations', 'new-name' );
			expect( mockRevisionManager.buildSetSelector ).toHaveBeenCalled();
		} );

		it( 'should trim whitespace from new name', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );

			const mockApiManager = {
				renameLayerSet: jest.fn().mockResolvedValue( {} )
			};
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to return name with whitespace
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( '  trimmed-name  ' );

			await uiManager.renameCurrentSet();

			expect( mockApiManager.renameLayerSet ).toHaveBeenCalledWith(
				'annotations',
				'trimmed-name'
			);
		} );

		it( 'should handle rename API error gracefully', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );

			const mockApiManager = {
				renameLayerSet: jest.fn().mockRejectedValue( new Error( 'Rename failed' ) )
			};
			mockEditor.apiManager = mockApiManager;

			global.mw.log.error = jest.fn();

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to return valid name
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( 'new-name' );

			await uiManager.renameCurrentSet();

			// Wait for the internal .then().catch() chain to complete
			await new Promise( process.nextTick );

			expect( global.mw.log.error ).toHaveBeenCalledWith(
				'[SetSelectorController] renameCurrentSet error:',
				expect.any( Error )
			);
		} );

		it( 'should show error when apiManager is not available', async () => {
			mockStateManager.get.mockReturnValue( 'annotations' );
			mockEditor.apiManager = null;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to return valid name
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( 'new-name' );

			await uiManager.renameCurrentSet();

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'Failed to rename layer set',
				{ type: 'error' }
			);
		} );

		it( 'should accept valid alphanumeric names with hyphens and underscores', async () => {
			mockStateManager.get.mockReturnValue( 'old-set' );

			const mockApiManager = {
				renameLayerSet: jest.fn().mockResolvedValue( {} )
			};
			mockEditor.apiManager = mockApiManager;

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();
			// Mock the prompt dialog helper to return valid name
			uiManager.showPromptDialog = jest.fn().mockResolvedValue( 'my_new-Set123' );

			await uiManager.renameCurrentSet();

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

	describe( 'dialog fallbacks', () => {
		it( 'showConfirmDialog should fallback to window.confirm when dialogManager not available', async () => {
			const editorWithoutDialog = {
				...mockEditor,
				dialogManager: null
			};
			const uiManager = new UIManager( editorWithoutDialog );

			const mockConfirm = jest.fn( () => true );
			window.confirm = mockConfirm;

			const result = await uiManager.showConfirmDialog( { message: 'Test message' } );

			expect( mockConfirm ).toHaveBeenCalledWith( 'Test message' );
			expect( result ).toBe( true );
		} );

		it( 'showConfirmDialog should use dialogManager when available', async () => {
			const mockShowConfirm = jest.fn().mockResolvedValue( false );
			const editorWithDialog = {
				...mockEditor,
				dialogManager: {
					showConfirmDialog: mockShowConfirm
				}
			};
			const uiManager = new UIManager( editorWithDialog );

			const result = await uiManager.showConfirmDialog( { message: 'Test', title: 'Title' } );

			expect( mockShowConfirm ).toHaveBeenCalledWith( { message: 'Test', title: 'Title' } );
			expect( result ).toBe( false );
		} );

		it( 'showAlertDialog should fallback to window.alert when dialogManager not available', async () => {
			const editorWithoutDialog = {
				...mockEditor,
				dialogManager: null
			};
			const uiManager = new UIManager( editorWithoutDialog );

			const mockAlert = jest.fn();
			window.alert = mockAlert;

			await uiManager.showAlertDialog( { message: 'Alert message' } );

			expect( mockAlert ).toHaveBeenCalledWith( 'Alert message' );
		} );

		it( 'showAlertDialog should use dialogManager when available', async () => {
			const mockShowAlert = jest.fn().mockResolvedValue();
			const editorWithDialog = {
				...mockEditor,
				dialogManager: {
					showAlertDialog: mockShowAlert
				}
			};
			const uiManager = new UIManager( editorWithDialog );

			await uiManager.showAlertDialog( { message: 'Alert', isError: true } );

			expect( mockShowAlert ).toHaveBeenCalledWith( { message: 'Alert', isError: true } );
		} );

		it( 'showPromptDialog should fallback to window.prompt when dialogManager not available', async () => {
			const editorWithoutDialog = {
				...mockEditor,
				dialogManager: null
			};
			const uiManager = new UIManager( editorWithoutDialog );

			const mockPrompt = jest.fn( () => 'user input' );
			window.prompt = mockPrompt;

			const result = await uiManager.showPromptDialog( {
				message: 'Enter value',
				defaultValue: 'default'
			} );

			expect( mockPrompt ).toHaveBeenCalledWith( 'Enter value', 'default' );
			expect( result ).toBe( 'user input' );
		} );

		it( 'showPromptDialog should use dialogManager when available', async () => {
			const mockShowPrompt = jest.fn().mockResolvedValue( 'dialog input' );
			const editorWithDialog = {
				...mockEditor,
				dialogManager: {
					showPromptDialogAsync: mockShowPrompt
				}
			};
			const uiManager = new UIManager( editorWithDialog );

			const result = await uiManager.showPromptDialog( { message: 'Prompt', placeholder: 'hint' } );

			expect( mockShowPrompt ).toHaveBeenCalledWith( { message: 'Prompt', placeholder: 'hint' } );
			expect( result ).toBe( 'dialog input' );
		} );
	} );

	describe( 'namespace fallback getClass', () => {
		it( 'should use window.Layers.UI namespace when available', () => {
			// This tests the getClass fallback logic indirectly
			// The UIManager loads EventTracker via getClass
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.EventTracker = class MockEventTracker {
				add() {}
				destroy() {}
			};

			const uiManager = new UIManager( mockEditor );
			expect( uiManager ).toBeDefined();
		} );

		it( 'should use window.Layers.Utils namespace when available', () => {
			const originalLayers = window.Layers;
			window.Layers = { Utils: { TestUtil: class {} } };

			const uiManager = new UIManager( mockEditor );
			expect( uiManager ).toBeDefined();

			window.Layers = originalLayers;
		} );

		it( 'should use window.Layers.Core namespace when available', () => {
			const originalLayers = window.Layers;
			window.Layers = { Core: { TestCore: class {} } };

			const uiManager = new UIManager( mockEditor );
			expect( uiManager ).toBeDefined();

			window.Layers = originalLayers;
		} );
	} );

	describe( 'skip links accessibility', () => {
		it( 'should create skip links container', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const skipLinks = uiManager.container.querySelector( '.layers-skip-links' );
			expect( skipLinks ).not.toBeNull();
		} );

		it( 'should create three skip links', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			const links = uiManager.container.querySelectorAll( '.layers-skip-link' );
			expect( links.length ).toBe( 3 );
		} );

		it( 'should navigate to target element when skip link clicked', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Get skip link for canvas
			const canvasLink = uiManager.container.querySelector( 'a[href="#layers-canvas-section"]' );
			expect( canvasLink ).not.toBeNull();

			// Create mock for focus and scrollIntoView
			const canvasSection = document.getElementById( 'layers-canvas-section' );
			const focusSpy = jest.spyOn( canvasSection, 'focus' );
			canvasSection.scrollIntoView = jest.fn();

			// Click the skip link
			const clickEvent = new MouseEvent( 'click', { bubbles: true } );
			Object.defineProperty( clickEvent, 'preventDefault', { value: jest.fn() } );
			canvasLink.dispatchEvent( clickEvent );

			expect( clickEvent.preventDefault ).toHaveBeenCalled();
			expect( focusSpy ).toHaveBeenCalled();
			expect( canvasSection.scrollIntoView ).toHaveBeenCalledWith(
				expect.objectContaining( { behavior: 'smooth' } )
			);
		} );

		it( 'should handle missing target element gracefully', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			// Remove the target element
			const canvasSection = document.getElementById( 'layers-canvas-section' );
			canvasSection.remove();

			// Get skip link for canvas
			const canvasLink = uiManager.container.querySelector( 'a[href="#layers-canvas-section"]' );

			// Should not throw when clicked
			expect( () => {
				canvasLink.dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );
			} ).not.toThrow();
		} );
	} );

	describe( 'addListener edge cases', () => {
		it( 'should handle null element gracefully', () => {
			const uiManager = new UIManager( mockEditor );

			expect( () => {
				uiManager.addListener( null, 'click', jest.fn() );
			} ).not.toThrow();
		} );

		it( 'should handle element without addEventListener', () => {
			const uiManager = new UIManager( mockEditor );
			const invalidElement = { addEventListener: 'not a function' };

			expect( () => {
				uiManager.addListener( invalidElement, 'click', jest.fn() );
			} ).not.toThrow();
		} );

		it( 'should use direct addEventListener when eventTracker not available', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.eventTracker = null; // Disable eventTracker

			const element = document.createElement( 'button' );
			const handler = jest.fn();
			const addEventSpy = jest.spyOn( element, 'addEventListener' );

			uiManager.addListener( element, 'click', handler );

			expect( addEventSpy ).toHaveBeenCalledWith( 'click', handler, undefined );
		} );
	} );

	describe( 'debug logging', () => {
		it( 'should log when wgLayersDebug is enabled', () => {
			// Enable debug mode
			global.mw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgLayersDebug' ) return true;
				return null;
			} );

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( global.mw.log ).toHaveBeenCalledWith(
				'[UIManager] createInterface() completed'
			);
		} );

		it( 'should not log when wgLayersDebug is disabled', () => {
			// Disable debug mode
			global.mw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgLayersDebug' ) return false;
				return null;
			} );

			// Clear previous calls
			global.mw.log.mockClear();

			const uiManager = new UIManager( mockEditor );
			uiManager.createInterface();

			expect( global.mw.log ).not.toHaveBeenCalledWith(
				'[UIManager] createInterface() completed'
			);
		} );
	} );

	describe( 'createSetSelector fallback', () => {
		it( 'should create minimal wrapper when setSelectorController not available', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.setSelectorController = null;

			const wrapper = uiManager.createSetSelector();

			expect( wrapper ).not.toBeNull();
			expect( wrapper.className ).toBe( 'layers-set-wrap' );
		} );
	} );

	describe( 'delegation methods without controller', () => {
		it( 'showNewSetInput should do nothing without controller', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.setSelectorController = null;

			expect( () => uiManager.showNewSetInput( true ) ).not.toThrow();
		} );

		it( 'createNewSet should do nothing without controller', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.setSelectorController = null;

			expect( () => uiManager.createNewSet() ).not.toThrow();
		} );

		it( 'addSetOption should do nothing without controller', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.setSelectorController = null;

			expect( () => uiManager.addSetOption( 'test' ) ).not.toThrow();
		} );

		it( 'deleteCurrentSet should resolve without controller', async () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.setSelectorController = null;

			await expect( uiManager.deleteCurrentSet() ).resolves.toBeUndefined();
		} );

		it( 'renameCurrentSet should resolve without controller', async () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.setSelectorController = null;

			await expect( uiManager.renameCurrentSet() ).resolves.toBeUndefined();
		} );

		it( 'setupSetSelectorControls should do nothing without controller', () => {
			const uiManager = new UIManager( mockEditor );
			uiManager.setSelectorController = null;

			expect( () => uiManager.setupSetSelectorControls() ).not.toThrow();
		} );
	} );
} );
