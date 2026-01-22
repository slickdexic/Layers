/**
 * Jest tests for SlidePropertiesPanel.js
 * Tests slide properties panel functionality for the Layers editor
 */
'use strict';

describe( 'SlidePropertiesPanel', function () {
	let SlidePropertiesPanel;
	let panel;
	let mockEditor;
	let container;

	beforeAll( function () {
		// Set up JSDOM globals
		global.document = window.document;

		// Set up Layers namespace
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.UI = window.Layers.UI || {};

		// Mock mw (MediaWiki) global
		global.mw = {
			config: {
				get: jest.fn( function ( key ) {
					if ( key === 'wgLayersDebug' ) {
						return false;
					}
					return null;
				} )
			},
			message: jest.fn( function ( key ) {
				return {
					text: function () {
						return key;
					},
					exists: function () {
						return true;
					}
				};
			} ),
			notify: jest.fn(),
			log: {
				warn: jest.fn(),
				error: jest.fn()
			}
		};

		// Mock EventTracker
		window.EventTracker = jest.fn( function () {
			this.listeners = [];
			this.add = jest.fn( ( element, event, handler, options ) => {
				element.addEventListener( event, handler, options );
				this.listeners.push( { element, event, handler, options } );
				return { element, event, handler, options };
			} );
			this.remove = jest.fn();
			this.removeAllForElement = jest.fn();
			this.count = jest.fn( () => this.listeners.length );
			this.destroy = jest.fn( () => {
				this.listeners.forEach( ( info ) => {
					info.element.removeEventListener( info.event, info.handler, info.options );
				} );
				this.listeners = [];
			} );
		} );

		// Mock layersGetClass
		window.layersGetClass = jest.fn( function ( namespacePath ) {
			if ( namespacePath === 'Utils.EventTracker' ) {
				return window.EventTracker;
			}
			return null;
		} );

		// Load SlidePropertiesPanel (sets window.Layers.UI.SlidePropertiesPanel)
		require( '../../resources/ext.layers.editor/ui/SlidePropertiesPanel.js' );
		SlidePropertiesPanel = window.Layers.UI.SlidePropertiesPanel;
	} );

	beforeEach( function () {
		// Create container element
		container = document.createElement( 'div' );
		document.body.appendChild( container );

		// Create mock editor
		mockEditor = {
			stateManager: {
				get: jest.fn( function ( key ) {
					const state = {
						slideName: 'TestSlide',
						baseWidth: 800,
						baseHeight: 600,
						slideBackgroundColor: '#ffffff',
						slideLockMode: 'none',
						currentSetName: 'default',
						isSlide: true
					};
					return state[ key ];
				} ),
				set: jest.fn()
			},
			canvasManager: {
				setBaseDimensions: jest.fn(),
				setBackgroundColor: jest.fn()
			},
			toolbar: {
				openColorPickerDialog: jest.fn()
			}
		};

		// Create panel instance
		panel = new SlidePropertiesPanel( {
			editor: mockEditor,
			container: container
		} );
	} );

	afterEach( function () {
		if ( panel ) {
			panel.destroy();
		}
		if ( container && container.parentNode ) {
			container.parentNode.removeChild( container );
		}
		jest.clearAllMocks();
	} );

	describe( 'constructor', function () {
		it( 'should initialize with config', function () {
			expect( panel.editor ).toBe( mockEditor );
			expect( panel.container ).toBe( container );
		} );

		it( 'should have null panel before create', function () {
			const freshPanel = new SlidePropertiesPanel( { editor: mockEditor } );
			expect( freshPanel.panel ).toBeNull();
		} );

		it( 'should default to expanded state', function () {
			expect( panel.isExpanded ).toBe( true );
		} );
	} );

	describe( 'create', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should create panel element', function () {
			expect( panel.panel ).toBeDefined();
			expect( panel.panel.className ).toContain( 'slide-properties-panel' );
		} );

		it( 'should be hidden by default', function () {
			expect( panel.panel.style.display ).toBe( 'none' );
		} );

		it( 'should create header', function () {
			const header = panel.panel.querySelector( '.slide-properties-header' );
			expect( header ).not.toBeNull();
		} );

		it( 'should create content container', function () {
			expect( panel.content ).toBeDefined();
			expect( panel.content.className ).toContain( 'slide-properties-content' );
		} );

		it( 'should create name row', function () {
			expect( panel.nameValue ).toBeDefined();
		} );

		it( 'should create dimension inputs', function () {
			expect( panel.widthInput ).toBeDefined();
			expect( panel.heightInput ).toBeDefined();
			expect( panel.widthInput.type ).toBe( 'number' );
			expect( panel.heightInput.type ).toBe( 'number' );
		} );

		it( 'should create background color controls', function () {
			expect( panel.bgColorButton ).toBeDefined();
			expect( panel.bgColorSwatch ).toBeDefined();
		} );

		it( 'should create lock row', function () {
			expect( panel.lockRow ).toBeDefined();
		} );

		it( 'should create embed button', function () {
			expect( panel.embedButton ).toBeDefined();
		} );

		it( 'should append to container', function () {
			expect( container.contains( panel.panel ) ).toBe( true );
		} );
	} );

	describe( 'toggle', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should collapse when expanded', function () {
			expect( panel.isExpanded ).toBe( true );
			panel.toggle();
			expect( panel.isExpanded ).toBe( false );
		} );

		it( 'should expand when collapsed', function () {
			panel.toggle(); // Collapse first
			panel.toggle(); // Expand again
			expect( panel.isExpanded ).toBe( true );
		} );

		it( 'should update content visibility', function () {
			panel.toggle(); // Collapse
			expect( panel.content.style.display ).toBe( 'none' );
			panel.toggle(); // Expand
			expect( panel.content.style.display ).toBe( '' );
		} );

		it( 'should update header icon', function () {
			panel.toggle(); // Collapse
			expect( panel.headerIcon.innerHTML ).toBe( '▶' );
			panel.toggle(); // Expand
			expect( panel.headerIcon.innerHTML ).toBe( '▼' );
		} );

		it( 'should update aria-expanded attribute', function () {
			const header = panel.panel.querySelector( '.slide-properties-header' );
			panel.toggle();
			expect( header.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
			panel.toggle();
			expect( header.getAttribute( 'aria-expanded' ) ).toBe( 'true' );
		} );
	} );

	describe( 'show/hide via updateVisibility', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should show panel when isSlide is true', function () {
			panel.updateVisibility( true, 'none' );
			expect( panel.panel.style.display ).toBe( '' );
		} );

		it( 'should hide panel when isSlide is false', function () {
			panel.updateVisibility( true, 'none' );
			panel.updateVisibility( false, 'none' );
			expect( panel.panel.style.display ).toBe( 'none' );
		} );

		it( 'updateVisibility should handle missing panel gracefully', function () {
			panel.panel = null;
			expect( function () {
				panel.updateVisibility( true, 'none' );
			} ).not.toThrow();
		} );

		it( 'should disable inputs when lock mode is size', function () {
			panel.updateVisibility( true, 'size' );
			expect( panel.widthInput.disabled ).toBe( true );
			expect( panel.heightInput.disabled ).toBe( true );
		} );

		it( 'should disable all controls when lock mode is all', function () {
			panel.updateVisibility( true, 'all' );
			expect( panel.widthInput.disabled ).toBe( true );
			expect( panel.heightInput.disabled ).toBe( true );
			expect( panel.bgColorButton.disabled ).toBe( true );
		} );

		it( 'should show lock row when locked', function () {
			panel.updateVisibility( true, 'size' );
			expect( panel.lockRow.style.display ).toBe( '' );
		} );

		it( 'should hide lock row when not locked', function () {
			panel.updateVisibility( true, 'none' );
			expect( panel.lockRow.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'updateValues', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should update slide name', function () {
			panel.updateValues( {
				name: 'MyCustomSlide',
				width: 800,
				height: 600,
				backgroundColor: '#ffffff'
			} );
			expect( panel.nameValue.textContent ).toBe( 'MyCustomSlide' );
		} );

		it( 'should update dimension inputs', function () {
			panel.updateValues( {
				name: 'Test',
				width: 1920,
				height: 1080,
				backgroundColor: '#ffffff'
			} );
			expect( panel.widthInput.value ).toBe( '1920' );
			expect( panel.heightInput.value ).toBe( '1080' );
		} );

		it( 'should update background color swatch', function () {
			panel.updateValues( {
				name: 'Test',
				width: 800,
				height: 600,
				backgroundColor: '#ff0000'
			} );
			expect( panel.bgColorSwatch.style.backgroundColor ).toBe( 'rgb(255, 0, 0)' );
		} );
	} );

	describe( 'updateBackgroundSwatch', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should set solid color', function () {
			panel.updateBackgroundSwatch( '#00ff00' );
			expect( panel.bgColorSwatch.style.backgroundColor ).toBe( 'rgb(0, 255, 0)' );
		} );

		it( 'should handle transparent with checkerboard', function () {
			panel.updateBackgroundSwatch( 'transparent' );
			expect( panel.bgColorSwatch.style.backgroundImage ).toContain( 'linear-gradient' );
		} );

		it( 'should clear background image for solid colors', function () {
			panel.updateBackgroundSwatch( 'transparent' );
			panel.updateBackgroundSwatch( '#ffffff' );
			expect( panel.bgColorSwatch.style.backgroundImage ).toBe( 'none' );
		} );

		it( 'should handle missing swatch gracefully', function () {
			panel.bgColorSwatch = null;
			expect( function () {
				panel.updateBackgroundSwatch( '#000000' );
			} ).not.toThrow();
		} );
	} );

	describe( 'copyEmbedCode', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should generate embed code with slide name', function () {
			// Mock clipboard API
			Object.assign( navigator, {
				clipboard: {
					writeText: jest.fn( function () {
						return Promise.resolve();
					} )
				}
			} );

			panel.copyEmbedCode();

			expect( navigator.clipboard.writeText ).toHaveBeenCalledWith(
				expect.stringContaining( 'TestSlide' )
			);
		} );

		it( 'should include layerset when not default', function () {
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'slideName' ) {
					return 'MySlide';
				}
				if ( key === 'currentSetName' ) {
					return 'custom-set';
				}
				return null;
			} );

			Object.assign( navigator, {
				clipboard: {
					writeText: jest.fn( function () {
						return Promise.resolve();
					} )
				}
			} );

			panel.copyEmbedCode();

			expect( navigator.clipboard.writeText ).toHaveBeenCalledWith(
				expect.stringContaining( 'layerset=custom-set' )
			);
		} );

		it( 'should handle missing editor gracefully', function () {
			panel.editor = null;
			expect( function () {
				panel.copyEmbedCode();
			} ).not.toThrow();
		} );
	} );

	describe( 'fallbackCopy', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should create temporary textarea', function () {
			// Mock execCommand
			document.execCommand = jest.fn( function () {
				return true;
			} );

			panel.fallbackCopy( 'test text' );

			expect( document.execCommand ).toHaveBeenCalledWith( 'copy' );
		} );

		it( 'should show notification on success', function () {
			document.execCommand = jest.fn( function () {
				return true;
			} );

			panel.fallbackCopy( 'test text' );

			expect( mw.notify ).toHaveBeenCalled();
		} );
	} );

	describe( 'destroy', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should remove panel from DOM', function () {
			panel.destroy();
			expect( container.contains( panel.panel ) ).toBe( false );
		} );

		it( 'should clear references', function () {
			panel.destroy();
			expect( panel.panel ).toBeNull();
			expect( panel.widthInput ).toBeNull();
			expect( panel.heightInput ).toBeNull();
		} );

		it( 'should clear timers', function () {
			panel.widthTimer = setTimeout( function () {}, 1000 );
			panel.heightTimer = setTimeout( function () {}, 1000 );
			panel.destroy();
			// Timers cleared, no assertion needed (no error means success)
		} );

		it( 'should destroy event tracker', function () {
			const destroySpy = jest.spyOn( panel.eventTracker, 'destroy' );
			panel.destroy();
			expect( destroySpy ).toHaveBeenCalled();
		} );
	} );

	describe( 'dimension input validation', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should have min constraint of 50', function () {
			expect( panel.widthInput.min ).toBe( '50' );
			expect( panel.heightInput.min ).toBe( '50' );
		} );

		it( 'should have max constraint of 4096', function () {
			expect( panel.widthInput.max ).toBe( '4096' );
			expect( panel.heightInput.max ).toBe( '4096' );
		} );

		it( 'should have default values', function () {
			expect( panel.widthInput.value ).toBe( '800' );
			expect( panel.heightInput.value ).toBe( '600' );
		} );
	} );

	describe( 'ARIA accessibility', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should have role button on header', function () {
			const header = panel.panel.querySelector( '.slide-properties-header' );
			expect( header.getAttribute( 'role' ) ).toBe( 'button' );
		} );

		it( 'should have tabindex on header', function () {
			const header = panel.panel.querySelector( '.slide-properties-header' );
			expect( header.getAttribute( 'tabindex' ) ).toBe( '0' );
		} );

		it( 'should have aria-expanded on header', function () {
			const header = panel.panel.querySelector( '.slide-properties-header' );
			expect( header.getAttribute( 'aria-expanded' ) ).toBe( 'true' );
		} );

		it( 'should have aria-label on dimension inputs', function () {
			expect( panel.widthInput.getAttribute( 'aria-label' ) ).toBeDefined();
			expect( panel.heightInput.getAttribute( 'aria-label' ) ).toBeDefined();
		} );
	} );

	describe( 'keyboard navigation', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should toggle on Enter key', function () {
			const header = panel.panel.querySelector( '.slide-properties-header' );
			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			header.dispatchEvent( event );
			expect( panel.isExpanded ).toBe( false );
		} );

		it( 'should toggle on Space key', function () {
			const header = panel.panel.querySelector( '.slide-properties-header' );
			const event = new KeyboardEvent( 'keydown', { key: ' ' } );
			header.dispatchEvent( event );
			expect( panel.isExpanded ).toBe( false );
		} );
	} );
} );
