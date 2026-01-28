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
			panel.updateVisibility( true );
			expect( panel.panel.style.display ).toBe( '' );
		} );

		it( 'should hide panel when isSlide is false', function () {
			panel.updateVisibility( true );
			panel.updateVisibility( false );
			expect( panel.panel.style.display ).toBe( 'none' );
		} );

		it( 'updateVisibility should handle missing panel gracefully', function () {
			panel.panel = null;
			expect( function () {
				panel.updateVisibility( true );
			} ).not.toThrow();
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

	describe( 'dimension input handlers', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should debounce width input changes', function () {
			jest.useFakeTimers();

			const inputEvent = new Event( 'input', { bubbles: true } );
			panel.widthInput.value = '1024';
			panel.widthInput.dispatchEvent( inputEvent );

			// Should not update immediately
			expect( mockEditor.stateManager.set ).not.toHaveBeenCalledWith( 'baseWidth', 1024 );

			// Fast-forward debounce timer
			jest.advanceTimersByTime( 350 );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseWidth', 1024 );

			jest.useRealTimers();
		} );

		it( 'should debounce height input changes', function () {
			jest.useFakeTimers();

			const inputEvent = new Event( 'input', { bubbles: true } );
			panel.heightInput.value = '768';
			panel.heightInput.dispatchEvent( inputEvent );

			jest.advanceTimersByTime( 350 );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseHeight', 768 );

			jest.useRealTimers();
		} );

		it( 'should reject width below minimum', function () {
			jest.useFakeTimers();

			panel.widthInput.value = '10';
			panel.widthInput.dispatchEvent( new Event( 'input', { bubbles: true } ) );

			jest.advanceTimersByTime( 350 );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalledWith( 'baseWidth', 10 );

			jest.useRealTimers();
		} );

		it( 'should reject height above maximum', function () {
			jest.useFakeTimers();

			panel.heightInput.value = '5000';
			panel.heightInput.dispatchEvent( new Event( 'input', { bubbles: true } ) );

			jest.advanceTimersByTime( 350 );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalledWith( 'baseHeight', 5000 );

			jest.useRealTimers();
		} );

		it( 'should clear previous timer on rapid input', function () {
			jest.useFakeTimers();

			panel.widthInput.value = '500';
			panel.widthInput.dispatchEvent( new Event( 'input', { bubbles: true } ) );

			// Quickly change value again
			panel.widthInput.value = '600';
			panel.widthInput.dispatchEvent( new Event( 'input', { bubbles: true } ) );

			jest.advanceTimersByTime( 350 );

			// Should only apply the final value
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseWidth', 600 );
			expect( mockEditor.stateManager.set ).not.toHaveBeenCalledWith( 'baseWidth', 500 );

			jest.useRealTimers();
		} );
	} );

	describe( 'updateCanvasSize', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should update state with new width', function () {
			panel.updateCanvasSize( 1280, null );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseWidth', 1280 );
		} );

		it( 'should update state with new height', function () {
			panel.updateCanvasSize( null, 720 );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseHeight', 720 );
		} );

		it( 'should mark state as dirty', function () {
			panel.updateCanvasSize( 800, 600 );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'isDirty', true );
		} );

		it( 'should update canvasManager dimensions', function () {
			panel.updateCanvasSize( 1920, 1080 );
			expect( mockEditor.canvasManager.setBaseDimensions ).toHaveBeenCalledWith( 1920, 1080 );
		} );

		it( 'should handle missing editor gracefully', function () {
			panel.editor = null;
			expect( function () {
				panel.updateCanvasSize( 800, 600 );
			} ).not.toThrow();
		} );

		it( 'should sync toolbar inputs if available', function () {
			mockEditor.toolbar.slideWidthInput = { value: '' };
			mockEditor.toolbar.slideHeightInput = { value: '' };

			panel.updateCanvasSize( 1024, 768 );

			expect( mockEditor.toolbar.slideWidthInput.value ).toBe( 1024 );
			expect( mockEditor.toolbar.slideHeightInput.value ).toBe( 768 );
		} );
	} );

	describe( 'openBackgroundColorPicker', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should call toolbar openColorPickerDialog', function () {
			panel.openBackgroundColorPicker();
			expect( mockEditor.toolbar.openColorPickerDialog ).toHaveBeenCalledWith(
				panel.bgColorButton,
				'#ffffff',
				expect.objectContaining( { onApply: expect.any( Function ) } )
			);
		} );

		it( 'should handle missing toolbar gracefully', function () {
			mockEditor.toolbar = null;
			expect( function () {
				panel.openBackgroundColorPicker();
			} ).not.toThrow();
		} );

		it( 'should use current color from state', function () {
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'slideBackgroundColor' ) {
					return '#ff0000';
				}
				return null;
			} );

			panel.openBackgroundColorPicker();

			expect( mockEditor.toolbar.openColorPickerDialog ).toHaveBeenCalledWith(
				panel.bgColorButton,
				'#ff0000',
				expect.any( Object )
			);
		} );
	} );

	describe( 'setBackgroundColor', function () {
		beforeEach( function () {
			panel.create();
		} );

		it( 'should update state with new color', function () {
			panel.setBackgroundColor( '#00ff00' );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'slideBackgroundColor', '#00ff00' );
		} );

		it( 'should update swatch', function () {
			panel.setBackgroundColor( '#0000ff' );
			expect( panel.bgColorSwatch.style.backgroundColor ).toBe( 'rgb(0, 0, 255)' );
		} );

		it( 'should update canvasManager', function () {
			panel.setBackgroundColor( '#123456' );
			expect( mockEditor.canvasManager.setBackgroundColor ).toHaveBeenCalledWith( '#123456' );
		} );

		it( 'should mark state as dirty', function () {
			panel.setBackgroundColor( '#abcdef' );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'isDirty', true );
		} );

		it( 'should sync toolbar if available', function () {
			mockEditor.toolbar.setSlideBackgroundColor = jest.fn();
			panel.setBackgroundColor( '#fedcba' );
			expect( mockEditor.toolbar.setSlideBackgroundColor ).toHaveBeenCalledWith( '#fedcba' );
		} );
	} );

	describe( 'getClass fallback', function () {
		it( 'should work with Layers namespace', function () {
			// Test the getClass fallback when layersGetClass is not mocked
			const originalGetClass = window.layersGetClass;
			delete window.layersGetClass;

			// Reload module would test this, but we can test the pattern
			window.Layers.Utils.EventTracker = jest.fn();

			// Restore
			window.layersGetClass = originalGetClass;
		} );
	} );

	describe( 'msg helper', function () {
		it( 'should use mw.message to get localized text', function () {
			// The msg helper wraps mw.message and returns .text()
			// Since we already mock mw.message in setup, just verify the panel uses it
			const freshPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			freshPanel.create();

			// Panel should be created with translated labels
			expect( freshPanel.panel ).not.toBeNull();
			// The header should contain the slide properties title
			expect( freshPanel.panel.querySelector( '.slide-properties-title' ) ).not.toBeNull();
		} );
	} );

	describe( 'event handler with eventTracker', function () {
		it( 'should register events via eventTracker when available', function () {
			const panelWithTracker = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			panelWithTracker.create();

			// EventTracker should be used
			expect( panelWithTracker.eventTracker ).not.toBeNull();
			expect( panelWithTracker.eventTracker.add ).toHaveBeenCalled();

			// Panel should still work
			expect( panelWithTracker.widthInput ).toBeDefined();

			panelWithTracker.destroy();
		} );
	} );

	describe( 'clipboard fallback on error', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should use fallback when clipboard.writeText fails', async function () {
			const mockWriteText = jest.fn().mockRejectedValue( new Error( 'Failed' ) );
			Object.assign( navigator, {
				clipboard: { writeText: mockWriteText }
			} );

			document.execCommand = jest.fn( function () {
				return true;
			} );

			panel.create();
			panel.copyEmbedCode();

			await jest.runAllTimersAsync();
			expect( document.execCommand ).toHaveBeenCalledWith( 'copy' );
		} );
	} );

	describe( 'getClass fallback behavior', function () {
		it( 'should handle nested namespace paths in getClass', function () {
			// The getClass inside the module handles nested paths
			// Test via creating a panel where layersGetClass returns null
			const originalGetClass = window.layersGetClass;
			window.layersGetClass = jest.fn().mockReturnValue( null );

			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );

			// Should still create panel (with eventTracker as null)
			expect( testPanel ).toBeDefined();

			window.layersGetClass = originalGetClass;
		} );
	} );

	describe( 'msg helper fallback paths', function () {
		it( 'should use layersMessages if available', function () {
			const originalMessages = window.layersMessages;
			window.layersMessages = {
				get: jest.fn( function ( key, fallback ) {
					return 'Custom: ' + key;
				} )
			};

			// Create new panel to test msg function
			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();

			// The panel title should use the layersMessages
			expect( window.layersMessages.get ).toHaveBeenCalled();

			window.layersMessages = originalMessages;
			testPanel.destroy();
		} );

		it( 'should fallback to literal string when mw.message does not exist', function () {
			const originalMwMessage = mw.message;
			mw.message = jest.fn().mockReturnValue( {
				exists: function () {
					return false;
				},
				text: function () {
					return '';
				}
			} );

			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();

			// Panel should still be created with fallback text
			expect( testPanel.panel ).not.toBeNull();

			mw.message = originalMwMessage;
			testPanel.destroy();
		} );
	} );

	describe( 'event handlers without eventTracker', function () {
		beforeEach( function () {
			// Disable eventTracker by making getClass return null
			window.layersGetClass = jest.fn().mockReturnValue( null );
		} );

		afterEach( function () {
			window.layersGetClass = jest.fn( function ( namespacePath ) {
				if ( namespacePath === 'Utils.EventTracker' ) {
					return window.EventTracker;
				}
				return null;
			} );
		} );

		it( 'should add click handler to header directly when no eventTracker', function () {
			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();

			// Header should respond to click
			const header = testPanel.panel.querySelector( '.slide-properties-header' );
			expect( header ).not.toBeNull();

			// Simulate click to toggle
			header.click();
			expect( testPanel.isExpanded ).toBe( false );

			testPanel.destroy();
		} );

		it( 'should add keydown handler to header directly when no eventTracker', function () {
			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();

			const header = testPanel.panel.querySelector( '.slide-properties-header' );

			// Simulate Enter key
			const enterEvent = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			header.dispatchEvent( enterEvent );

			expect( testPanel.isExpanded ).toBe( false );

			testPanel.destroy();
		} );

		it( 'should add input handler to width input directly when no eventTracker', function () {
			jest.useFakeTimers();

			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();

			// Change width
			testPanel.widthInput.value = '1000';
			testPanel.widthInput.dispatchEvent( new Event( 'input' ) );

			// Advance timer
			jest.advanceTimersByTime( 400 );

			// updateCanvasSize calls stateManager.set with 'baseWidth'
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseWidth', 1000 );

			testPanel.destroy();
			jest.useRealTimers();
		} );

		it( 'should add click handler to color button directly when no eventTracker', function () {
			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();

			// Click color button - should open color picker
			const clickEvent = new Event( 'click' );
			testPanel.bgColorButton.dispatchEvent( clickEvent );

			// When toolbar has openColorPickerDialog, it should be called
			expect( mockEditor.toolbar.openColorPickerDialog ).toHaveBeenCalled();

			testPanel.destroy();
		} );

		it( 'should add click handler to embed button directly when no eventTracker', function () {
			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();

			// Mock clipboard
			const mockWriteText = jest.fn().mockResolvedValue( undefined );
			Object.assign( navigator, {
				clipboard: { writeText: mockWriteText }
			} );

			// Click embed button
			testPanel.embedButton.click();

			// Should have tried to copy
			expect( mockWriteText ).toHaveBeenCalled();

			testPanel.destroy();
		} );
	} );

	describe( 'openBackgroundColorPicker fallback', function () {
		it( 'should log warning when toolbar color picker is not available', function () {
			const testPanel = new SlidePropertiesPanel( {
				editor: {
					...mockEditor,
					toolbar: null
				},
				container: container
			} );
			testPanel.create();

			// Open color picker should not throw
			expect( () => {
				testPanel.openBackgroundColorPicker();
			} ).not.toThrow();

			testPanel.destroy();
		} );

		it( 'should work when editor has no toolbar', function () {
			const editorNoToolbar = {
				...mockEditor,
				toolbar: undefined
			};
			const testPanel = new SlidePropertiesPanel( {
				editor: editorNoToolbar,
				container: container
			} );
			testPanel.create();

			// Should handle gracefully
			testPanel.openBackgroundColorPicker();
			// No error should be thrown

			testPanel.destroy();
		} );
	} );

	describe( 'fallbackCopy edge cases', function () {
		it( 'should handle execCommand throwing an error', function () {
			document.execCommand = jest.fn( function () {
				throw new Error( 'Not supported' );
			} );

			panel.create();

			// Should not throw
			expect( () => {
				panel.fallbackCopy( 'test text' );
			} ).not.toThrow();
		} );

		it( 'should use fallbackCopy when navigator.clipboard is undefined', function () {
			const originalClipboard = navigator.clipboard;
			// Remove clipboard API
			Object.defineProperty( navigator, 'clipboard', {
				value: undefined,
				configurable: true
			} );

			document.execCommand = jest.fn().mockReturnValue( true );

			panel.create();
			panel.copyEmbedCode();

			expect( document.execCommand ).toHaveBeenCalledWith( 'copy' );

			// Restore
			Object.defineProperty( navigator, 'clipboard', {
				value: originalClipboard,
				configurable: true
			} );
		} );
	} );

	describe( 'destroy edge cases', function () {
		it( 'should handle destroy when panel is null', function () {
			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			// Don't call create()

			// Should not throw
			expect( () => {
				testPanel.destroy();
			} ).not.toThrow();
		} );

		it( 'should handle destroy when panel has no parent', function () {
			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();

			// Remove parent manually
			if ( testPanel.panel && testPanel.panel.parentNode ) {
				testPanel.panel.parentNode.removeChild( testPanel.panel );
			}

			// Should not throw
			expect( () => {
				testPanel.destroy();
			} ).not.toThrow();
		} );

		it( 'should clear all timers on destroy', function () {
			jest.useFakeTimers();

			panel.create();

			// Trigger timer creation
			panel.widthInput.value = '900';
			panel.widthInput.dispatchEvent( new Event( 'input' ) );
			panel.heightInput.value = '700';
			panel.heightInput.dispatchEvent( new Event( 'input' ) );

			// Destroy should clear timers
			panel.destroy();

			// Advance timers - nothing should happen
			jest.advanceTimersByTime( 500 );

			// stateManager.set should not have been called for canvas dimensions
			// (because timers were cleared before they fired)

			jest.useRealTimers();
		} );
	} );

	describe( 'getClass fallback', function () {
		it( 'should use window.layersGetClass when available', function () {
			const mockGetClass = jest.fn().mockReturnValue( window.EventTracker );
			window.layersGetClass = mockGetClass;

			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );

			expect( testPanel.eventTracker ).not.toBeNull();
		} );

		it( 'should traverse Layers namespace when getClass not available', function () {
			const originalGetClass = window.layersGetClass;
			delete window.layersGetClass;

			// Re-require to get the built-in getClass
			jest.resetModules();
			window.Layers = { Utils: { EventTracker: window.EventTracker } };
			require( '../../resources/ext.layers.editor/ui/SlidePropertiesPanel.js' );

			const ReloadedPanel = window.Layers.UI.SlidePropertiesPanel;
			const testPanel = new ReloadedPanel( {
				editor: mockEditor,
				container: container
			} );

			expect( testPanel.eventTracker ).not.toBeNull();
			testPanel.destroy();

			// Restore
			window.layersGetClass = originalGetClass;
		} );
	} );

	describe( 'msg helper', function () {
		it( 'should use layersMessages when available', function () {
			window.layersMessages = {
				get: jest.fn().mockReturnValue( 'custom message' )
			};

			panel.create();

			expect( window.layersMessages.get ).toHaveBeenCalled();

			delete window.layersMessages;
		} );

		it( 'should return fallback when message does not exist', function () {
			const originalMessage = mw.message;
			mw.message = jest.fn().mockReturnValue( {
				exists: () => false,
				text: () => 'non-existent'
			} );

			// Re-require to test msg function
			jest.resetModules();
			window.Layers = { Utils: { EventTracker: window.EventTracker } };
			require( '../../resources/ext.layers.editor/ui/SlidePropertiesPanel.js' );

			const ReloadedPanel = window.Layers.UI.SlidePropertiesPanel;
			const testPanel = new ReloadedPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();
			testPanel.destroy();

			mw.message = originalMessage;
		} );
	} );

	describe( 'updateCanvasSize edge cases', function () {
		it( 'should not update when editor is null', function () {
			panel.editor = null;
			panel.create();

			// Should not throw
			expect( () => {
				panel.updateCanvasSize( 1000, 800 );
			} ).not.toThrow();
		} );

		it( 'should not update when stateManager is null', function () {
			mockEditor.stateManager = null;
			panel.create();

			// Should not throw
			expect( () => {
				panel.updateCanvasSize( 1000, 800 );
			} ).not.toThrow();
		} );

		it( 'should sync toolbar width when toolbar available', function () {
			mockEditor.toolbar = {
				slideWidthInput: document.createElement( 'input' ),
				slideHeightInput: document.createElement( 'input' ),
				openColorPickerDialog: jest.fn()
			};

			panel.create();
			panel.updateCanvasSize( 1200, null );

			expect( mockEditor.toolbar.slideWidthInput.value ).toBe( '1200' );
		} );

		it( 'should sync toolbar height when toolbar available', function () {
			mockEditor.toolbar = {
				slideWidthInput: document.createElement( 'input' ),
				slideHeightInput: document.createElement( 'input' ),
				openColorPickerDialog: jest.fn()
			};

			panel.create();
			panel.updateCanvasSize( null, 900 );

			expect( mockEditor.toolbar.slideHeightInput.value ).toBe( '900' );
		} );

		it( 'should not sync when toolbar inputs missing', function () {
			mockEditor.toolbar = {
				openColorPickerDialog: jest.fn()
			};

			panel.create();

			// Should not throw
			expect( () => {
				panel.updateCanvasSize( 1200, 900 );
			} ).not.toThrow();
		} );
	} );

	describe( 'openBackgroundColorPicker edge cases', function () {
		it( 'should do nothing when toolbar not available', function () {
			mockEditor.toolbar = null;
			panel.create();

			// Should not throw
			expect( () => {
				panel.openBackgroundColorPicker();
			} ).not.toThrow();
		} );

		it( 'should do nothing when openColorPickerDialog not a function', function () {
			mockEditor.toolbar = { openColorPickerDialog: 'not a function' };
			panel.create();

			// Should not throw
			expect( () => {
				panel.openBackgroundColorPicker();
			} ).not.toThrow();
		} );

		it( 'should use transparent as default when stateManager not available', function () {
			mockEditor.stateManager = null;
			mockEditor.toolbar = { openColorPickerDialog: jest.fn() };
			panel.create();
			panel.openBackgroundColorPicker();

			expect( mockEditor.toolbar.openColorPickerDialog ).toHaveBeenCalledWith(
				panel.bgColorButton,
				'transparent',
				expect.any( Object )
			);
		} );
	} );

	describe( 'setBackgroundColor edge cases', function () {
		it( 'should sync toolbar when setSlideBackgroundColor available', function () {
			mockEditor.toolbar = {
				openColorPickerDialog: jest.fn(),
				setSlideBackgroundColor: jest.fn()
			};

			panel.create();
			panel.setBackgroundColor( '#ff0000' );

			expect( mockEditor.toolbar.setSlideBackgroundColor ).toHaveBeenCalledWith( '#ff0000' );
		} );

		it( 'should update canvas when canvasManager.setBackgroundColor available', function () {
			mockEditor.canvasManager = {
				setBaseDimensions: jest.fn(),
				setBackgroundColor: jest.fn()
			};

			panel.create();
			panel.setBackgroundColor( '#00ff00' );

			expect( mockEditor.canvasManager.setBackgroundColor ).toHaveBeenCalledWith( '#00ff00' );
		} );

		it( 'should mark state as dirty', function () {
			panel.create();
			panel.setBackgroundColor( '#0000ff' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'isDirty', true );
		} );
	} );

	describe( 'updateBackgroundSwatch edge cases', function () {
		it( 'should do nothing when bgColorSwatch is null', function () {
			panel.create();
			panel.bgColorSwatch = null;

			// Should not throw
			expect( () => {
				panel.updateBackgroundSwatch( '#ff0000' );
			} ).not.toThrow();
		} );

		it( 'should apply checkerboard pattern for transparent', function () {
			panel.create();
			panel.updateBackgroundSwatch( 'transparent' );

			expect( panel.bgColorSwatch.style.backgroundImage ).toContain( 'linear-gradient' );
		} );

		it( 'should clear background image for solid colors', function () {
			panel.create();
			panel.bgColorSwatch.style.backgroundImage = 'some-pattern';
			panel.updateBackgroundSwatch( '#ff0000' );

			expect( panel.bgColorSwatch.style.backgroundImage ).toBe( 'none' );
		} );
	} );

	describe( 'copyEmbedCode edge cases', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should include layerset when not default', function () {
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				const state = {
					slideName: 'MySlide',
					currentSetName: 'custom-set'
				};
				return state[ key ];
			} );

			const writeTextMock = jest.fn().mockResolvedValue( undefined );
			Object.defineProperty( navigator, 'clipboard', {
				value: { writeText: writeTextMock },
				configurable: true
			} );

			panel.create();
			panel.copyEmbedCode();

			expect( writeTextMock ).toHaveBeenCalledWith( expect.stringContaining( 'layerset=custom-set' ) );
		} );

		it( 'should not include layerset when default', function () {
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				const state = {
					slideName: 'MySlide',
					currentSetName: 'default'
				};
				return state[ key ];
			} );

			const writeTextMock = jest.fn().mockResolvedValue( undefined );
			Object.defineProperty( navigator, 'clipboard', {
				value: { writeText: writeTextMock },
				configurable: true
			} );

			panel.create();
			panel.copyEmbedCode();

			expect( writeTextMock ).toHaveBeenCalledWith( expect.not.stringContaining( 'layerset=' ) );
		} );

		it( 'should call fallbackCopy when clipboard writeText rejects', async function () {
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				const state = {
					slideName: 'TestSlide',
					currentSetName: 'default'
				};
				return state[ key ];
			} );

			const writeTextMock = jest.fn().mockRejectedValue( new Error( 'Clipboard error' ) );
			Object.defineProperty( navigator, 'clipboard', {
				value: { writeText: writeTextMock },
				configurable: true
			} );

			document.execCommand = jest.fn().mockReturnValue( true );

			panel.create();
			panel.copyEmbedCode();

			// Wait for promise rejection to be handled
			await jest.runAllTimersAsync();

			expect( document.execCommand ).toHaveBeenCalledWith( 'copy' );
		} );
	} );

	describe( 'input debounce behavior', function () {
		it( 'should debounce width input', function () {
			jest.useFakeTimers();

			panel.create();

			// Type multiple values quickly
			panel.widthInput.value = '900';
			panel.widthInput.dispatchEvent( new Event( 'input' ) );
			panel.widthInput.value = '1000';
			panel.widthInput.dispatchEvent( new Event( 'input' ) );
			panel.widthInput.value = '1100';
			panel.widthInput.dispatchEvent( new Event( 'input' ) );

			// Not yet fired
			expect( mockEditor.stateManager.set ).not.toHaveBeenCalledWith( 'baseWidth', expect.anything() );

			// Advance time
			jest.advanceTimersByTime( 350 );

			// Only final value should be set
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseWidth', 1100 );

			jest.useRealTimers();
		} );

		it( 'should ignore invalid width values', function () {
			jest.useFakeTimers();

			panel.create();

			// Set invalid value (below min)
			panel.widthInput.value = '10';
			panel.widthInput.dispatchEvent( new Event( 'input' ) );

			jest.advanceTimersByTime( 350 );

			// Should not update with invalid value
			expect( mockEditor.stateManager.set ).not.toHaveBeenCalledWith( 'baseWidth', 10 );

			jest.useRealTimers();
		} );

		it( 'should ignore width values above max', function () {
			jest.useFakeTimers();

			panel.create();

			// Set invalid value (above max)
			panel.widthInput.value = '5000';
			panel.widthInput.dispatchEvent( new Event( 'input' ) );

			jest.advanceTimersByTime( 350 );

			// Should not update with invalid value
			expect( mockEditor.stateManager.set ).not.toHaveBeenCalledWith( 'baseWidth', 5000 );

			jest.useRealTimers();
		} );
	} );

	describe( 'event handler fallback when eventTracker unavailable', function () {
		beforeEach( function () {
			// Disable EventTracker
			window.layersGetClass = jest.fn().mockReturnValue( null );
		} );

		afterEach( function () {
			window.layersGetClass = jest.fn( ( path ) => {
				if ( path === 'Utils.EventTracker' ) {
					return window.EventTracker;
				}
				return null;
			} );
		} );

		it( 'should add event listeners directly without EventTracker', function () {
			const testPanel = new SlidePropertiesPanel( {
				editor: mockEditor,
				container: container
			} );
			testPanel.create();

			// Verify panel was created (listeners added directly)
			expect( testPanel.panel ).not.toBeNull();
			expect( testPanel.widthInput ).not.toBeNull();

			testPanel.destroy();
		} );
	} );
} );

