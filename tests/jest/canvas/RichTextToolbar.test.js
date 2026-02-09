/**
 * Tests for RichTextToolbar - floating formatting toolbar for inline text editing
 *
 * Extracted from InlineTextEditor as part of the God Class Reduction Initiative.
 */

'use strict';

// Import the module
const RichTextToolbar = require( '../../../resources/ext.layers.editor/canvas/RichTextToolbar.js' );

describe( 'RichTextToolbar', () => {
	let toolbar;
	let mockLayer;
	let mockEditorElement;
	let mockContainerElement;
	let mockOnFormat;
	let mockOnSaveSelection;
	let mockOnFocusEditor;
	let mockMsg;

	beforeEach( () => {
		// Setup mock layer
		mockLayer = {
			id: 'layer-1',
			type: 'textbox',
			fontFamily: 'Arial',
			fontSize: 16,
			fontWeight: 'normal',
			fontStyle: 'normal',
			color: '#000000',
			textAlign: 'left'
		};

		// Setup mock DOM elements
		mockEditorElement = document.createElement( 'div' );
		mockEditorElement.contentEditable = 'true';
		mockEditorElement.getBoundingClientRect = jest.fn( () => ( {
			left: 100,
			top: 200,
			right: 300,
			bottom: 250,
			width: 200,
			height: 50
		} ) );
		document.body.appendChild( mockEditorElement );

		mockContainerElement = document.createElement( 'div' );
		mockContainerElement.getBoundingClientRect = jest.fn( () => ( {
			left: 0,
			top: 0,
			right: 800,
			bottom: 600,
			width: 800,
			height: 600
		} ) );
		document.body.appendChild( mockContainerElement );

		// Setup mock callbacks
		mockOnFormat = jest.fn();
		mockOnSaveSelection = jest.fn();
		mockOnFocusEditor = jest.fn();
		mockMsg = jest.fn( ( key, fallback ) => fallback );

		// Setup global namespace
		window.Layers = window.Layers || {};
		window.Layers.FontConfig = {
			getFonts: jest.fn( () => [ 'Arial', 'Times New Roman', 'Courier New' ] ),
			findMatchingFont: jest.fn( ( font ) => font )
		};
	} );

	afterEach( () => {
		if ( toolbar ) {
			toolbar.destroy();
		}
		if ( mockEditorElement.parentNode ) {
			mockEditorElement.parentNode.removeChild( mockEditorElement );
		}
		if ( mockContainerElement.parentNode ) {
			mockContainerElement.parentNode.removeChild( mockContainerElement );
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with options', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onSaveSelection: mockOnSaveSelection,
				onFocusEditor: mockOnFocusEditor,
				msg: mockMsg
			} );

			expect( toolbar ).toBeDefined();
			expect( toolbar.layer ).toBe( mockLayer );
			expect( toolbar.isRichTextMode ).toBe( true );
		} );

		it( 'should use default callbacks when not provided', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer
			} );

			// Should not throw when callbacks are called
			expect( () => toolbar.onFormat( 'fontWeight', 'bold' ) ).not.toThrow();
			expect( () => toolbar.onSaveSelection() ).not.toThrow();
			expect( () => toolbar.onFocusEditor() ).not.toThrow();
		} );

		it( 'should default isRichTextMode to false', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer
			} );

			expect( toolbar.isRichTextMode ).toBe( false );
		} );
	} );

	describe( 'create()', () => {
		it( 'should return null if layer is not provided', () => {
			toolbar = new RichTextToolbar( {} );
			const element = toolbar.create();
			expect( element ).toBeNull();
		} );

		it( 'should create toolbar DOM element', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			const element = toolbar.create();

			expect( element ).not.toBeNull();
			expect( element.className ).toBe( 'layers-text-toolbar' );
		} );

		it( 'should append toolbar to container', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			expect( mockContainerElement.contains( toolbar.toolbarElement ) ).toBe( true );
		} );

		it( 'should include drag handle', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const handle = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-handle' );
			expect( handle ).not.toBeNull();
		} );

		it( 'should include font select dropdown', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const fontSelect = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-font' );
			expect( fontSelect ).not.toBeNull();
			expect( fontSelect.tagName ).toBe( 'SELECT' );
		} );

		it( 'should include font size input', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			expect( sizeInput ).not.toBeNull();
			expect( sizeInput.type ).toBe( 'number' );
			expect( sizeInput.value ).toBe( '16' );
		} );

		it( 'should include bold and italic buttons', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const boldBtn = toolbar.toolbarElement.querySelector( '[data-format="bold"]' );
			const italicBtn = toolbar.toolbarElement.querySelector( '[data-format="italic"]' );

			expect( boldBtn ).not.toBeNull();
			expect( italicBtn ).not.toBeNull();
		} );

		it( 'should include underline and strikethrough in rich text mode', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const underlineBtn = toolbar.toolbarElement.querySelector( '[data-format="underline"]' );
			const strikeBtn = toolbar.toolbarElement.querySelector( '[data-format="strikethrough"]' );

			expect( underlineBtn ).not.toBeNull();
			expect( strikeBtn ).not.toBeNull();
		} );

		it( 'should NOT include underline and strikethrough when not in rich text mode', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: false,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const underlineBtn = toolbar.toolbarElement.querySelector( '[data-format="underline"]' );
			const strikeBtn = toolbar.toolbarElement.querySelector( '[data-format="strikethrough"]' );

			expect( underlineBtn ).toBeNull();
			expect( strikeBtn ).toBeNull();
		} );

		it( 'should include alignment buttons', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const alignLeft = toolbar.toolbarElement.querySelector( '[data-align="left"]' );
			const alignCenter = toolbar.toolbarElement.querySelector( '[data-align="center"]' );
			const alignRight = toolbar.toolbarElement.querySelector( '[data-align="right"]' );

			expect( alignLeft ).not.toBeNull();
			expect( alignCenter ).not.toBeNull();
			expect( alignRight ).not.toBeNull();
		} );

		it( 'should mark current alignment as active', () => {
			mockLayer.textAlign = 'center';

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const alignCenter = toolbar.toolbarElement.querySelector( '[data-align="center"]' );
			expect( alignCenter.classList.contains( 'active' ) ).toBe( true );
		} );
	} );

	describe( 'isInteracting()', () => {
		it( 'should return false initially', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			expect( toolbar.isInteracting() ).toBe( false );
		} );
	} );

	describe( 'position()', () => {
		it( 'should position toolbar above editor', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const style = toolbar.toolbarElement.style;
			expect( style.left ).toBeDefined();
			expect( style.top ).toBeDefined();
		} );

		it( 'should not throw if elements are missing', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer
			} );

			toolbar.toolbarElement = document.createElement( 'div' );
			expect( () => toolbar.position() ).not.toThrow();
		} );
	} );

	describe( 'destroy()', () => {
		it( 'should remove toolbar from DOM', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();
			expect( mockContainerElement.contains( toolbar.toolbarElement ) ).toBe( true );

			toolbar.destroy();
			expect( toolbar.toolbarElement ).toBeNull();
		} );

		it( 'should not throw if called multiple times', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();
			expect( () => {
				toolbar.destroy();
				toolbar.destroy();
			} ).not.toThrow();
		} );
	} );

	describe( 'format button interactions', () => {
		it( 'should call onFormat when bold button clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const boldBtn = toolbar.toolbarElement.querySelector( '[data-format="bold"]' );
			boldBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontWeight', 'bold' );
		} );

		it( 'should toggle bold button state', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const boldBtn = toolbar.toolbarElement.querySelector( '[data-format="bold"]' );

			// First click - activate
			boldBtn.click();
			expect( boldBtn.classList.contains( 'active' ) ).toBe( true );
			expect( mockOnFormat ).toHaveBeenLastCalledWith( 'fontWeight', 'bold' );

			// Second click - deactivate
			boldBtn.click();
			expect( boldBtn.classList.contains( 'active' ) ).toBe( false );
			expect( mockOnFormat ).toHaveBeenLastCalledWith( 'fontWeight', 'normal' );
		} );

		it( 'should call onFormat when italic button clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const italicBtn = toolbar.toolbarElement.querySelector( '[data-format="italic"]' );
			italicBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontStyle', 'italic' );
		} );

		it( 'should call onFormat when alignment button clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const centerBtn = toolbar.toolbarElement.querySelector( '[data-align="center"]' );
			centerBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'textAlign', 'center' );
		} );

		it( 'should deactivate other alignment buttons when one is clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const leftBtn = toolbar.toolbarElement.querySelector( '[data-align="left"]' );
			const centerBtn = toolbar.toolbarElement.querySelector( '[data-align="center"]' );

			// Initially left is active (default)
			expect( leftBtn.classList.contains( 'active' ) ).toBe( true );

			// Click center
			centerBtn.click();

			expect( centerBtn.classList.contains( 'active' ) ).toBe( true );
			expect( leftBtn.classList.contains( 'active' ) ).toBe( false );
		} );
	} );

	describe( 'font select interactions', () => {
		it( 'should call onFormat when font changed', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const fontSelect = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-font' );
			fontSelect.value = 'Times New Roman';
			fontSelect.dispatchEvent( new Event( 'change' ) );

			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontFamily', 'Times New Roman' );
			expect( mockOnFocusEditor ).toHaveBeenCalled();
		} );

		it( 'should call onSaveSelection on mousedown', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onSaveSelection: mockOnSaveSelection
			} );

			toolbar.create();

			const fontSelect = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-font' );
			fontSelect.dispatchEvent( new Event( 'mousedown' ) );

			expect( mockOnSaveSelection ).toHaveBeenCalled();
		} );
	} );

	describe( 'font size interactions', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'should call onFormat when font size changed', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			sizeInput.value = '24';
			sizeInput.dispatchEvent( new Event( 'change' ) );

			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontSize', 24 );

			// onFocusEditor is called after a short delay
			jest.advanceTimersByTime( 100 );
			expect( mockOnFocusEditor ).toHaveBeenCalled();
		} );

		it( 'should clamp font size to valid range', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );

			// Test below minimum
			sizeInput.value = '4';
			sizeInput.dispatchEvent( new Event( 'change' ) );
			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontSize', 8 );
			expect( sizeInput.value ).toBe( '8' );

			// Test above maximum
			sizeInput.value = '300';
			sizeInput.dispatchEvent( new Event( 'change' ) );
			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontSize', 200 );
			expect( sizeInput.value ).toBe( '200' );
		} );
	} );

	describe( 'drag functionality', () => {
		it( 'should have drag handle that responds to mousedown', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const handle = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-handle' );

			// Simulate mousedown to start drag
			const event = new MouseEvent( 'mousedown', {
				clientX: 50,
				clientY: 50,
				bubbles: true
			} );
			handle.dispatchEvent( event );

			expect( toolbar._isDragging ).toBe( true );
		} );

		it( 'should stop drag on mouseup', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const handle = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-handle' );

			// Start drag
			handle.dispatchEvent( new MouseEvent( 'mousedown', {
				clientX: 50,
				clientY: 50
			} ) );
			expect( toolbar._isDragging ).toBe( true );

			// Trigger mouseup on document
			document.dispatchEvent( new MouseEvent( 'mouseup' ) );
			expect( toolbar._isDragging ).toBe( false );
		} );
	} );

	describe( 'i18n support', () => {
		it( 'should use msg callback for tooltips', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				msg: mockMsg
			} );

			toolbar.create();

			expect( mockMsg ).toHaveBeenCalledWith( 'layers-text-toolbar-drag', 'Drag to move' );
			expect( mockMsg ).toHaveBeenCalledWith( 'layers-text-toolbar-bold', 'Bold' );
			expect( mockMsg ).toHaveBeenCalledWith( 'layers-text-toolbar-italic', 'Italic' );
		} );
	} );

	describe( 'highlight button', () => {
		it( 'should include highlight button in rich text mode', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const highlightBtn = toolbar.toolbarElement.querySelector( '[data-format="highlight"]' );
			expect( highlightBtn ).not.toBeNull();
		} );

		it( 'should call onFormat with default yellow when highlight clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const highlightBtn = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-highlight-main' );
			highlightBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'highlight', '#ffff00' );
		} );
	} );

	describe( 'layer initial state', () => {
		it( 'should mark bold button active if layer has bold weight', () => {
			mockLayer.fontWeight = 'bold';

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const boldBtn = toolbar.toolbarElement.querySelector( '[data-format="bold"]' );
			expect( boldBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should mark italic button active if layer has italic style', () => {
			mockLayer.fontStyle = 'italic';

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const italicBtn = toolbar.toolbarElement.querySelector( '[data-format="italic"]' );
			expect( italicBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should use layer font size in input', () => {
			mockLayer.fontSize = 32;

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			expect( sizeInput.value ).toBe( '32' );
		} );

		it( 'should preserve large font size (regression test for #72 showing as 17)', () => {
			// This test verifies that when a layer has fontSize 72,
			// the toolbar correctly shows 72 (not some scaled value like 17)
			mockLayer.fontSize = 72;

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			expect( sizeInput.value ).toBe( '72' );

			// Verify that updateFromSelection without fontSizeFromDOM doesn't change value
			toolbar.updateFromSelection( { fontSize: 17 } );
			expect( sizeInput.value ).toBe( '72' ); // Should NOT change to 17

			// Verify that updateFromSelection WITH fontSizeFromDOM does change value
			toolbar.updateFromSelection( { fontSize: 36, fontSizeFromDOM: true } );
			expect( sizeInput.value ).toBe( '36' ); // Should change when from DOM
		} );
	} );

	describe( 'underline and strikethrough buttons', () => {
		it( 'should include underline button in rich text mode', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const underlineBtn = toolbar.toolbarElement.querySelector( '[data-format="underline"]' );
			expect( underlineBtn ).not.toBeNull();
		} );

		it( 'should include strikethrough button in rich text mode', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const strikeBtn = toolbar.toolbarElement.querySelector( '[data-format="strikethrough"]' );
			expect( strikeBtn ).not.toBeNull();
		} );

		it( 'should toggle underline on click', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const underlineBtn = toolbar.toolbarElement.querySelector( '[data-format="underline"]' );
			underlineBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'underline', true );
		} );

		it( 'should toggle strikethrough on click', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const strikeBtn = toolbar.toolbarElement.querySelector( '[data-format="strikethrough"]' );
			strikeBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'strikethrough', true );
		} );

		it( 'should turn off underline when already active', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const underlineBtn = toolbar.toolbarElement.querySelector( '[data-format="underline"]' );
			// First click activates
			underlineBtn.click();
			// Second click deactivates
			underlineBtn.click();

			expect( mockOnFormat ).toHaveBeenLastCalledWith( 'underline', false );
		} );
	} );

	describe( 'highlight dropdown button', () => {
		it( 'should include dropdown button for highlight picker', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const dropdownBtn = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-highlight-dropdown' );
			expect( dropdownBtn ).not.toBeNull();
		} );

		it( 'should save selection on dropdown mousedown', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onSaveSelection: mockOnSaveSelection
			} );

			toolbar.create();

			const dropdownBtn = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-highlight-dropdown' );
			dropdownBtn.dispatchEvent( new MouseEvent( 'mousedown', { bubbles: true } ) );

			expect( mockOnSaveSelection ).toHaveBeenCalled();
		} );

		it( 'should set isInteracting on main highlight mousedown', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onSaveSelection: mockOnSaveSelection
			} );

			toolbar.create();

			const mainBtn = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-highlight-main' );
			mainBtn.dispatchEvent( new MouseEvent( 'mousedown', { bubbles: true } ) );

			expect( toolbar._isInteracting ).toBe( true );
		} );

		it( 'should use native color input when ColorPickerDialog unavailable', () => {
			// Keep FontConfig but remove ColorPickerDialog
			window.Layers = {
				FontConfig: {
					getFonts: jest.fn( () => [ 'Arial', 'Times New Roman' ] ),
					findMatchingFont: jest.fn( ( font ) => font )
				}
			};

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const dropdownBtn = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-highlight-dropdown' );

			// The dropdown click should work (native fallback path uses color input)
			// Just verify the dropdown exists and can be clicked without error
			expect( () => dropdownBtn.click() ).not.toThrow();
		} );
	} );

	describe( 'color picker', () => {
		it( 'should include color picker wrapper', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const colorWrapper = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-color-wrapper' );
			expect( colorWrapper ).not.toBeNull();
		} );

		it( 'should use fallback color input when ColorPickerDialog unavailable', () => {
			// Keep FontConfig but remove ColorPickerDialog
			window.Layers = {
				FontConfig: {
					getFonts: jest.fn( () => [ 'Arial', 'Times New Roman' ] ),
					findMatchingFont: jest.fn( ( font ) => font )
				}
			};

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const colorInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-color' );
			expect( colorInput ).not.toBeNull();
			expect( colorInput.type ).toBe( 'color' );
		} );

		it( 'should call onFormat when fallback color changes', () => {
			// Keep FontConfig but remove ColorPickerDialog
			window.Layers = {
				FontConfig: {
					getFonts: jest.fn( () => [ 'Arial', 'Times New Roman' ] ),
					findMatchingFont: jest.fn( ( font ) => font )
				}
			};

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const colorInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-color' );
			colorInput.value = '#ff0000';
			colorInput.dispatchEvent( new Event( 'change' ) );

			expect( mockOnFormat ).toHaveBeenCalledWith( 'color', '#ff0000' );
		} );

		it( 'should save selection on fallback color mousedown', () => {
			// Keep FontConfig but remove ColorPickerDialog
			window.Layers = {
				FontConfig: {
					getFonts: jest.fn( () => [ 'Arial', 'Times New Roman' ] ),
					findMatchingFont: jest.fn( ( font ) => font )
				}
			};

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onSaveSelection: mockOnSaveSelection
			} );

			toolbar.create();

			const colorInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-color' );
			colorInput.dispatchEvent( new MouseEvent( 'mousedown' ) );

			expect( mockOnSaveSelection ).toHaveBeenCalled();
		} );

		it( 'should set isInteracting on fallback color focus', () => {
			// Keep FontConfig but remove ColorPickerDialog
			window.Layers = {
				FontConfig: {
					getFonts: jest.fn( () => [ 'Arial', 'Times New Roman' ] ),
					findMatchingFont: jest.fn( ( font ) => font )
				}
			};

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const colorInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-color' );
			colorInput.dispatchEvent( new Event( 'focus' ) );

			expect( toolbar._isInteracting ).toBe( true );
		} );

		it( 'should use ColorPickerDialog when available', () => {
			const mockOpen = jest.fn();
			window.Layers = {
				FontConfig: {
					getFonts: jest.fn( () => [ 'Arial', 'Times New Roman' ] ),
					findMatchingFont: jest.fn( ( font ) => font )
				},
				UI: {
					ColorPickerDialog: class MockColorPickerDialog {
						constructor() {}
						open() {
							mockOpen();
						}
						static createColorButton( options ) {
							const btn = document.createElement( 'button' );
							btn.className = 'mock-color-button';
							btn.addEventListener( 'click', options.onClick );
							return btn;
						}
						static updateColorButton() {}
					}
				}
			};

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onSaveSelection: mockOnSaveSelection
			} );

			toolbar.create();

			const colorBtn = toolbar.toolbarElement.querySelector( '.mock-color-button' );
			expect( colorBtn ).not.toBeNull();

			colorBtn.click();
			expect( mockOpen ).toHaveBeenCalled();
		} );
	} );

	describe( 'updateFromSelection', () => {
		test( 'should update font size input when fontSizeFromDOM is true', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );
			toolbar.create();

			toolbar.updateFromSelection( { fontSize: 32, fontSizeFromDOM: true } );

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			expect( sizeInput.value ).toBe( '32' );
		} );

		test( 'should NOT update font size input when fontSizeFromDOM is false', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );
			toolbar.create();

			// Initial value is from layer (16)
			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			expect( sizeInput.value ).toBe( '16' );

			// Try to update without fontSizeFromDOM flag - should NOT change
			toolbar.updateFromSelection( { fontSize: 32 } );
			expect( sizeInput.value ).toBe( '16' );

			// Try with explicit false - should NOT change
			toolbar.updateFromSelection( { fontSize: 48, fontSizeFromDOM: false } );
			expect( sizeInput.value ).toBe( '16' );
		} );

		test( 'should update font family select', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );
			toolbar.create();

			const fontSelect = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-font' );

			// Verify Times New Roman option exists (from mock FontConfig)
			const timesOption = Array.from( fontSelect.options ).find( ( o ) => o.value === 'Times New Roman' );
			expect( timesOption ).toBeDefined();

			toolbar.updateFromSelection( { fontFamily: 'Times New Roman' } );

			expect( fontSelect.value ).toBe( 'Times New Roman' );
		} );

		test( 'should handle null selectionInfo', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );
			toolbar.create();

			expect( () => toolbar.updateFromSelection( null ) ).not.toThrow();
		} );

		test( 'should handle missing toolbarElement', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );
			// Don't call create() so toolbarElement is null

			expect( () => toolbar.updateFromSelection( { fontSize: 32, fontSizeFromDOM: true } ) ).not.toThrow();
		} );

		test( 'should update both font and size together', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );
			toolbar.create();

			toolbar.updateFromSelection( { fontSize: 24, fontFamily: 'Courier New', fontSizeFromDOM: true } );

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			const fontSelect = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-font' );
			expect( sizeInput.value ).toBe( '24' );
			expect( fontSelect.value ).toBe( 'Courier New' );
		} );
	} );
} );
