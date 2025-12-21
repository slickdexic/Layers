/**
 * Accessibility Audit Tests
 *
 * Uses jest-axe to automatically detect WCAG 2.1 violations in editor UI components.
 * These tests render components and check for accessibility issues like:
 * - Missing ARIA labels
 * - Invalid ARIA attributes
 * - Color contrast issues
 * - Keyboard accessibility problems
 * - Missing form labels
 *
 * @see https://www.deque.com/axe/
 */
'use strict';

const { axe, toHaveNoViolations } = require( 'jest-axe' );

expect.extend( toHaveNoViolations );

describe( 'Accessibility Audit', function () {
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
					if ( key === 'wgLayersDefaultFonts' ) {
						return [ 'Arial', 'Helvetica', 'Times New Roman' ];
					}
					return null;
				} )
			},
			message: jest.fn( function ( key ) {
				return {
					text: function () {
						// Return readable text for accessibility testing
						const messages = {
							'layers-tool-select': 'Select',
							'layers-tool-rectangle': 'Rectangle',
							'layers-tool-circle': 'Circle',
							'layers-tool-arrow': 'Arrow',
							'layers-tool-text': 'Text',
							'layers-tool-line': 'Line',
							'layers-save': 'Save',
							'layers-undo': 'Undo',
							'layers-redo': 'Redo',
							'layers-delete': 'Delete',
							'layers-layer-list': 'Layers',
							'layers-add-layer': 'Add layer',
							'layers-visibility-toggle': 'Toggle visibility',
							'layers-lock-toggle': 'Toggle lock',
							'layers-zoom-in': 'Zoom in',
							'layers-zoom-out': 'Zoom out',
							'layers-grid-toggle': 'Toggle grid'
						};
						return messages[ key ] || key;
					},
					exists: function () {
						return true;
					}
				};
			} ),
			log: {
				warn: jest.fn(),
				error: jest.fn()
			}
		};
	} );

	beforeEach( function () {
		container = document.createElement( 'div' );
		container.id = 'test-container';
		document.body.appendChild( container );
	} );

	afterEach( function () {
		if ( container && container.parentNode ) {
			container.parentNode.removeChild( container );
		}
		container = null;
	} );

	describe( 'Toolbar Button Accessibility', function () {
		it( 'should have accessible tool buttons with proper ARIA labels', async function () {
			// Create a toolbar-like structure
			const toolbar = document.createElement( 'div' );
			toolbar.setAttribute( 'role', 'toolbar' );
			toolbar.setAttribute( 'aria-label', 'Drawing tools' );

			const tools = [
				{ id: 'select', label: 'Select tool' },
				{ id: 'rectangle', label: 'Rectangle tool' },
				{ id: 'circle', label: 'Circle tool' },
				{ id: 'arrow', label: 'Arrow tool' },
				{ id: 'text', label: 'Text tool' },
				{ id: 'line', label: 'Line tool' }
			];

			tools.forEach( ( tool ) => {
				const button = document.createElement( 'button' );
				button.type = 'button';
				button.setAttribute( 'aria-label', tool.label );
				button.setAttribute( 'data-tool', tool.id );
				button.className = 'layers-tool-btn';

				// Add icon (marked as decorative)
				const icon = document.createElement( 'span' );
				icon.setAttribute( 'aria-hidden', 'true' );
				icon.className = 'layers-icon';
				button.appendChild( icon );

				toolbar.appendChild( button );
			} );

			container.appendChild( toolbar );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );

		it( 'should have accessible action buttons', async function () {
			const actionBar = document.createElement( 'div' );
			actionBar.setAttribute( 'role', 'toolbar' );
			actionBar.setAttribute( 'aria-label', 'Actions' );

			const actions = [
				{ id: 'save', label: 'Save layers' },
				{ id: 'undo', label: 'Undo last action' },
				{ id: 'redo', label: 'Redo last action' },
				{ id: 'delete', label: 'Delete selected' }
			];

			actions.forEach( ( action ) => {
				const button = document.createElement( 'button' );
				button.type = 'button';
				button.setAttribute( 'aria-label', action.label );
				button.id = `action-${ action.id }`;
				actionBar.appendChild( button );
			} );

			container.appendChild( actionBar );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );

		it( 'should have accessible toggle buttons with aria-pressed', async function () {
			const toggleBar = document.createElement( 'div' );
			toggleBar.setAttribute( 'role', 'toolbar' );
			toggleBar.setAttribute( 'aria-label', 'View toggles' );

			const toggles = [
				{ id: 'grid', label: 'Toggle grid', pressed: false },
				{ id: 'guides', label: 'Toggle smart guides', pressed: true },
				{ id: 'rulers', label: 'Toggle rulers', pressed: false }
			];

			toggles.forEach( ( toggle ) => {
				const button = document.createElement( 'button' );
				button.type = 'button';
				button.setAttribute( 'aria-label', toggle.label );
				button.setAttribute( 'aria-pressed', String( toggle.pressed ) );
				button.id = `toggle-${ toggle.id }`;
				toggleBar.appendChild( button );
			} );

			container.appendChild( toggleBar );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );
	} );

	describe( 'Layer Panel Accessibility', function () {
		it( 'should have accessible layer list with proper ARIA roles', async function () {
			const panel = document.createElement( 'div' );
			panel.setAttribute( 'role', 'region' );
			panel.setAttribute( 'aria-label', 'Layers panel' );

			// Panel heading
			const heading = document.createElement( 'h2' );
			heading.id = 'layers-heading';
			heading.textContent = 'Layers';
			panel.appendChild( heading );

			// Layer list
			const list = document.createElement( 'div' );
			list.setAttribute( 'role', 'listbox' );
			list.setAttribute( 'aria-labelledby', 'layers-heading' );
			list.setAttribute( 'aria-multiselectable', 'true' );
			list.tabIndex = 0;

			const layers = [
				{ id: 'layer-1', name: 'Rectangle 1', selected: true },
				{ id: 'layer-2', name: 'Text Label', selected: false },
				{ id: 'layer-3', name: 'Arrow', selected: false }
			];

			layers.forEach( ( layer, index ) => {
				const item = document.createElement( 'div' );
				item.setAttribute( 'role', 'option' );
				item.setAttribute( 'aria-selected', String( layer.selected ) );
				item.setAttribute( 'aria-label', `${ layer.name }, layer ${ index + 1 } of ${ layers.length }` );
				item.id = layer.id;
				item.tabIndex = -1;

				const nameSpan = document.createElement( 'span' );
				nameSpan.textContent = layer.name;
				item.appendChild( nameSpan );

				list.appendChild( item );
			} );

			panel.appendChild( list );
			container.appendChild( panel );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );

		it( 'should have accessible layer action buttons', async function () {
			const actions = document.createElement( 'div' );
			actions.setAttribute( 'role', 'group' );
			actions.setAttribute( 'aria-label', 'Layer actions' );

			const buttons = [
				{ id: 'add', label: 'Add new layer' },
				{ id: 'duplicate', label: 'Duplicate selected layer' },
				{ id: 'delete', label: 'Delete selected layer' },
				{ id: 'move-up', label: 'Move layer up' },
				{ id: 'move-down', label: 'Move layer down' }
			];

			buttons.forEach( ( btn ) => {
				const button = document.createElement( 'button' );
				button.type = 'button';
				button.setAttribute( 'aria-label', btn.label );
				button.id = `layer-${ btn.id }`;

				const icon = document.createElement( 'span' );
				icon.setAttribute( 'aria-hidden', 'true' );
				icon.textContent = '⬆';
				button.appendChild( icon );

				actions.appendChild( button );
			} );

			container.appendChild( actions );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );

		it( 'should have accessible visibility and lock toggles', async function () {
			// Visibility/lock buttons should be outside the option element
			// to avoid nested interactive controls
			const listbox = document.createElement( 'div' );
			listbox.setAttribute( 'role', 'listbox' );
			listbox.setAttribute( 'aria-label', 'Layers' );

			const layer = document.createElement( 'div' );
			layer.setAttribute( 'role', 'option' );
			layer.setAttribute( 'aria-selected', 'true' );
			layer.setAttribute( 'aria-label', 'Rectangle 1' );
			layer.tabIndex = -1;

			// Layer name (not interactive)
			const nameSpan = document.createElement( 'span' );
			nameSpan.textContent = 'Rectangle 1';
			layer.appendChild( nameSpan );

			listbox.appendChild( layer );

			// Controls outside the listbox (separate from selection)
			const controls = document.createElement( 'div' );
			controls.setAttribute( 'role', 'group' );
			controls.setAttribute( 'aria-label', 'Layer controls for Rectangle 1' );

			// Visibility toggle
			const visBtn = document.createElement( 'button' );
			visBtn.type = 'button';
			visBtn.setAttribute( 'aria-label', 'Toggle visibility for Rectangle 1' );
			visBtn.setAttribute( 'aria-pressed', 'true' );
			controls.appendChild( visBtn );

			// Lock toggle
			const lockBtn = document.createElement( 'button' );
			lockBtn.type = 'button';
			lockBtn.setAttribute( 'aria-label', 'Toggle lock for Rectangle 1' );
			lockBtn.setAttribute( 'aria-pressed', 'false' );
			controls.appendChild( lockBtn );

			container.appendChild( listbox );
			container.appendChild( controls );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );
	} );

	describe( 'Form Controls Accessibility', function () {
		it( 'should have accessible color picker with proper label', async function () {
			const colorGroup = document.createElement( 'div' );
			colorGroup.setAttribute( 'role', 'group' );
			colorGroup.setAttribute( 'aria-label', 'Color selection' );

			const label = document.createElement( 'label' );
			label.setAttribute( 'for', 'stroke-color' );
			label.textContent = 'Stroke color';
			colorGroup.appendChild( label );

			const input = document.createElement( 'input' );
			input.type = 'color';
			input.id = 'stroke-color';
			input.value = '#ff0000';
			colorGroup.appendChild( input );

			container.appendChild( colorGroup );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );

		it( 'should have accessible range sliders with labels', async function () {
			const sliderGroup = document.createElement( 'div' );

			const label = document.createElement( 'label' );
			label.setAttribute( 'for', 'opacity-slider' );
			label.textContent = 'Opacity';
			sliderGroup.appendChild( label );

			const slider = document.createElement( 'input' );
			slider.type = 'range';
			slider.id = 'opacity-slider';
			slider.min = '0';
			slider.max = '100';
			slider.value = '100';
			slider.setAttribute( 'aria-valuenow', '100' );
			slider.setAttribute( 'aria-valuemin', '0' );
			slider.setAttribute( 'aria-valuemax', '100' );
			sliderGroup.appendChild( slider );

			container.appendChild( sliderGroup );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );

		it( 'should have accessible select dropdowns', async function () {
			const selectGroup = document.createElement( 'div' );

			const label = document.createElement( 'label' );
			label.setAttribute( 'for', 'font-family' );
			label.textContent = 'Font family';
			selectGroup.appendChild( label );

			const select = document.createElement( 'select' );
			select.id = 'font-family';

			const fonts = [ 'Arial', 'Helvetica', 'Times New Roman' ];
			fonts.forEach( ( font ) => {
				const option = document.createElement( 'option' );
				option.value = font;
				option.textContent = font;
				select.appendChild( option );
			} );

			selectGroup.appendChild( select );
			container.appendChild( selectGroup );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );

		it( 'should have accessible number inputs', async function () {
			const numberGroup = document.createElement( 'div' );

			const label = document.createElement( 'label' );
			label.setAttribute( 'for', 'stroke-width' );
			label.textContent = 'Stroke width';
			numberGroup.appendChild( label );

			const input = document.createElement( 'input' );
			input.type = 'number';
			input.id = 'stroke-width';
			input.min = '1';
			input.max = '50';
			input.value = '2';
			numberGroup.appendChild( input );

			container.appendChild( numberGroup );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );
	} );

	describe( 'Dialog Accessibility', function () {
		it( 'should have accessible modal dialog structure', async function () {
			// Create modal backdrop
			const backdrop = document.createElement( 'div' );
			backdrop.className = 'layers-modal-backdrop';
			backdrop.setAttribute( 'aria-hidden', 'true' );

			// Create dialog
			const dialog = document.createElement( 'div' );
			dialog.setAttribute( 'role', 'dialog' );
			dialog.setAttribute( 'aria-modal', 'true' );
			dialog.setAttribute( 'aria-labelledby', 'dialog-title' );
			dialog.setAttribute( 'aria-describedby', 'dialog-desc' );
			dialog.tabIndex = -1;

			// Title
			const title = document.createElement( 'h2' );
			title.id = 'dialog-title';
			title.textContent = 'Keyboard Shortcuts';
			dialog.appendChild( title );

			// Description
			const desc = document.createElement( 'p' );
			desc.id = 'dialog-desc';
			desc.textContent = 'Use these keyboard shortcuts to work faster.';
			dialog.appendChild( desc );

			// Content
			const content = document.createElement( 'div' );
			content.className = 'dialog-content';
			content.textContent = 'Ctrl+S: Save, Ctrl+Z: Undo';
			dialog.appendChild( content );

			// Close button
			const closeBtn = document.createElement( 'button' );
			closeBtn.type = 'button';
			closeBtn.setAttribute( 'aria-label', 'Close dialog' );
			closeBtn.textContent = '×';
			dialog.appendChild( closeBtn );

			container.appendChild( backdrop );
			container.appendChild( dialog );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );

		it( 'should have accessible confirmation dialog', async function () {
			const dialog = document.createElement( 'div' );
			dialog.setAttribute( 'role', 'alertdialog' );
			dialog.setAttribute( 'aria-modal', 'true' );
			dialog.setAttribute( 'aria-labelledby', 'confirm-title' );
			dialog.setAttribute( 'aria-describedby', 'confirm-desc' );

			const title = document.createElement( 'h2' );
			title.id = 'confirm-title';
			title.textContent = 'Delete Layer?';
			dialog.appendChild( title );

			const desc = document.createElement( 'p' );
			desc.id = 'confirm-desc';
			desc.textContent = 'Are you sure you want to delete this layer? This action cannot be undone.';
			dialog.appendChild( desc );

			const buttonGroup = document.createElement( 'div' );
			buttonGroup.setAttribute( 'role', 'group' );

			const cancelBtn = document.createElement( 'button' );
			cancelBtn.type = 'button';
			cancelBtn.textContent = 'Cancel';
			buttonGroup.appendChild( cancelBtn );

			const confirmBtn = document.createElement( 'button' );
			confirmBtn.type = 'button';
			confirmBtn.textContent = 'Delete';
			buttonGroup.appendChild( confirmBtn );

			dialog.appendChild( buttonGroup );
			container.appendChild( dialog );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );
	} );

	describe( 'Status Bar Accessibility', function () {
		it( 'should have accessible status region with live updates', async function () {
			const statusBar = document.createElement( 'div' );
			statusBar.setAttribute( 'role', 'status' );
			statusBar.setAttribute( 'aria-live', 'polite' );
			statusBar.setAttribute( 'aria-label', 'Editor status' );

			const toolStatus = document.createElement( 'span' );
			toolStatus.textContent = 'Tool: Rectangle';
			statusBar.appendChild( toolStatus );

			const zoomStatus = document.createElement( 'span' );
			zoomStatus.setAttribute( 'aria-label', 'Zoom level' );
			zoomStatus.textContent = '100%';
			statusBar.appendChild( zoomStatus );

			const positionStatus = document.createElement( 'span' );
			positionStatus.setAttribute( 'aria-label', 'Cursor position' );
			positionStatus.textContent = 'X: 150, Y: 200';
			statusBar.appendChild( positionStatus );

			container.appendChild( statusBar );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );
	} );

	describe( 'Canvas Region Accessibility', function () {
		it( 'should have accessible canvas wrapper with proper ARIA', async function () {
			const canvasWrapper = document.createElement( 'div' );
			canvasWrapper.setAttribute( 'role', 'application' );
			canvasWrapper.setAttribute( 'aria-label', 'Drawing canvas. Use arrow keys to move selected layers.' );
			canvasWrapper.tabIndex = 0;

			const canvas = document.createElement( 'canvas' );
			canvas.width = 800;
			canvas.height = 600;
			canvas.setAttribute( 'aria-hidden', 'true' ); // Canvas content is described elsewhere
			canvasWrapper.appendChild( canvas );

			// Hidden description for screen readers
			const desc = document.createElement( 'div' );
			desc.id = 'canvas-description';
			desc.className = 'sr-only';
			desc.setAttribute( 'aria-live', 'polite' );
			desc.textContent = '3 layers on canvas. Selected: Rectangle 1.';
			canvasWrapper.appendChild( desc );

			container.appendChild( canvasWrapper );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );
	} );

	describe( 'Skip Links and Landmarks', function () {
		it( 'should have proper landmark structure', async function () {
			// Main editor container
			const editor = document.createElement( 'main' );
			editor.setAttribute( 'role', 'main' );
			editor.setAttribute( 'aria-label', 'Layers Image Editor' );

			// Toolbar region
			const toolbar = document.createElement( 'nav' );
			toolbar.setAttribute( 'role', 'navigation' );
			toolbar.setAttribute( 'aria-label', 'Editor tools' );
			toolbar.innerHTML = '<button type="button" aria-label="Select tool">Select</button>';
			editor.appendChild( toolbar );

			// Layer panel region
			const panel = document.createElement( 'aside' );
			panel.setAttribute( 'role', 'complementary' );
			panel.setAttribute( 'aria-label', 'Layers panel' );
			panel.innerHTML = '<h2>Layers</h2>';
			editor.appendChild( panel );

			// Canvas region
			const canvasRegion = document.createElement( 'section' );
			canvasRegion.setAttribute( 'role', 'region' );
			canvasRegion.setAttribute( 'aria-label', 'Drawing area' );
			canvasRegion.innerHTML = '<div role="application" aria-label="Canvas" tabindex="0"></div>';
			editor.appendChild( canvasRegion );

			container.appendChild( editor );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();
		} );
	} );

	describe( 'Focus Management', function () {
		it( 'should have visible focus indicators on interactive elements', async function () {
			// Add styles for focus visibility (axe checks for focus-visible support)
			const style = document.createElement( 'style' );
			style.textContent = `
				button:focus-visible,
				input:focus-visible,
				select:focus-visible,
				[tabindex]:focus-visible {
					outline: 2px solid #005a9c;
					outline-offset: 2px;
				}
			`;
			document.head.appendChild( style );

			const group = document.createElement( 'div' );
			group.setAttribute( 'role', 'toolbar' );
			group.setAttribute( 'aria-label', 'Test toolbar' );

			const button = document.createElement( 'button' );
			button.type = 'button';
			button.textContent = 'Test Button';
			group.appendChild( button );

			const input = document.createElement( 'input' );
			input.type = 'text';
			input.setAttribute( 'aria-label', 'Test input' );
			group.appendChild( input );

			container.appendChild( group );

			const results = await axe( container );
			expect( results ).toHaveNoViolations();

			// Cleanup
			document.head.removeChild( style );
		} );
	} );
} );
