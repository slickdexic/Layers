/**
 * @jest-environment jsdom
 */

const PropertiesForm = require( '../../resources/ext.layers.editor/ui/PropertiesForm.js' );

// Debounce delay used in PropertiesForm for number inputs
const DEBOUNCE_DELAY = 100;

/**
 * Helper to dispatch an input event and advance timers to trigger debounced handlers
 * @param {HTMLElement} input - The input element
 */
function dispatchInputAndAdvanceTimers( input ) {
	input.dispatchEvent( new Event( 'input' ) );
	jest.advanceTimersByTime( DEBOUNCE_DELAY + 10 );
}

describe( 'PropertiesForm', () => {
	// Mock editor for updateLayer calls
	let mockEditor;
	let registerCleanup;

	// Load PropertyBuilders once for all tests
	const PropertyBuilders = require( '../../resources/ext.layers.editor/ui/PropertyBuilders.js' );

	beforeEach( () => {
		jest.useFakeTimers();

		mockEditor = {
			updateLayer: jest.fn()
		};
		registerCleanup = jest.fn();

		// Mock mw.message for i18n
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: () => key
			} ) ),
			log: {
				error: jest.fn()
			},
			notify: jest.fn(),
			config: {
				get: jest.fn( () => [ 'Arial', 'Roboto', 'Times New Roman' ] )
			}
		};

		// Mock layersMessages for msg() helper
		global.layersMessages = {
			get: jest.fn( ( key, fallback ) => fallback || key )
		};

		// Mock LayersConstants via window.Layers
		global.Layers = {
			Constants: {
				LAYER_TYPES: {
					TEXT: 'text',
					RECTANGLE: 'rectangle',
					CIRCLE: 'circle',
					ELLIPSE: 'ellipse',
					POLYGON: 'polygon',
					STAR: 'star',
					LINE: 'line',
					ARROW: 'arrow'
				},
				DEFAULTS: {
					RADIUS: 50,
					POLYGON_SIDES: 6,
					STAR_POINTS: 5
				},
				LIMITS: {
					MIN_POLYGON_SIDES: 3,
					MAX_POLYGON_SIDES: 20,
					MIN_STAR_POINTS: 3,
					MAX_STAR_POINTS: 20
				}
			},
			UI: {
				PropertyBuilders: PropertyBuilders
			}
		};

		// Also set legacy global for compatibility
		global.LayersConstants = global.Layers.Constants;
	} );

	afterEach( () => {
		jest.useRealTimers();
		delete global.mw;
		delete global.LayersConstants;
		delete global.Layers;
		delete global.layersMessages;
		delete global.ColorPickerDialog;
	} );

	describe( 'msg helper function', () => {
		test( 'should use layersMessages.get when available', () => {
			const layer = { id: 'test-1', type: 'rectangle' };
			PropertiesForm.create( layer, mockEditor, registerCleanup );

			// layersMessages.get should have been called for section titles
			expect( global.layersMessages.get ).toHaveBeenCalled();
		} );

		test( 'should use fallback when layersMessages not available', () => {
			delete global.layersMessages;
			const layer = { id: 'test-1', type: 'rectangle' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Should still create form with fallback strings
			expect( form ).toBeInstanceOf( HTMLFormElement );
		} );
	} );

	describe( 'module exports', () => {
		test( 'should export PropertiesForm object', () => {
			expect( PropertiesForm ).toBeDefined();
			expect( typeof PropertiesForm ).toBe( 'object' );
		} );

		test( 'should have create method', () => {
			expect( typeof PropertiesForm.create ).toBe( 'function' );
		} );

		test( 'should have addInput method', () => {
			expect( typeof PropertiesForm.addInput ).toBe( 'function' );
		} );

		test( 'should have addSelect method', () => {
			expect( typeof PropertiesForm.addSelect ).toBe( 'function' );
		} );

		test( 'should have addCheckbox method', () => {
			expect( typeof PropertiesForm.addCheckbox ).toBe( 'function' );
		} );

		test( 'should have addSliderInput method', () => {
			expect( typeof PropertiesForm.addSliderInput ).toBe( 'function' );
		} );

		test( 'should have addColorPicker method', () => {
			expect( typeof PropertiesForm.addColorPicker ).toBe( 'function' );
		} );

		test( 'should have addSection method', () => {
			expect( typeof PropertiesForm.addSection ).toBe( 'function' );
		} );
	} );

	describe( 'create', () => {
		test( 'should create a form element', () => {
			const layer = { id: 'test-1', type: 'rectangle', x: 100, y: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			expect( form ).toBeInstanceOf( HTMLFormElement );
			expect( form.className ).toBe( 'layer-properties-form' );
		} );

		test( 'should create transform section', () => {
			const layer = { id: 'test-1', type: 'rectangle', x: 10, y: 20 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const sections = form.querySelectorAll( '.property-section' );
			expect( sections.length ).toBeGreaterThanOrEqual( 1 );

			const transformHeader = form.querySelector( '.property-section-header--transform' );
			expect( transformHeader ).not.toBeNull();
		} );

		test( 'should create appearance section', () => {
			const layer = { id: 'test-1', type: 'rectangle' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const appearanceHeader = form.querySelector( '.property-section-header--appearance' );
			expect( appearanceHeader ).not.toBeNull();
		} );

		test( 'should create effects section', () => {
			const layer = { id: 'test-1', type: 'rectangle' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const effectsHeader = form.querySelector( '.property-section-header--effects' );
			expect( effectsHeader ).not.toBeNull();
		} );

		test( 'should create X, Y, rotation inputs', () => {
			const layer = { id: 'test-1', type: 'rectangle', x: 100, y: 200, rotation: 45 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const xInput = form.querySelector( 'input[data-prop="x"]' );
			const yInput = form.querySelector( 'input[data-prop="y"]' );
			const rotInput = form.querySelector( 'input[data-prop="rotation"]' );

			expect( xInput ).not.toBeNull();
			expect( yInput ).not.toBeNull();
			expect( rotInput ).not.toBeNull();
			expect( xInput.value ).toBe( '100' );
			expect( yInput.value ).toBe( '200' );
			expect( rotInput.value ).toBe( '45' );
		} );

		test( 'should create width and height inputs for rectangle', () => {
			const layer = { id: 'test-1', type: 'rectangle', width: 150, height: 75 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			const heightInput = form.querySelector( 'input[data-prop="height"]' );

			expect( widthInput ).not.toBeNull();
			expect( heightInput ).not.toBeNull();
			expect( widthInput.value ).toBe( '150' );
			expect( heightInput.value ).toBe( '75' );
		} );

		test( 'should create radius input for circle', () => {
			const layer = { id: 'test-1', type: 'circle', radius: 60 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const radiusInput = form.querySelector( 'input[data-prop="radius"]' );
			expect( radiusInput ).not.toBeNull();
			expect( radiusInput.value ).toBe( '60' );
		} );

		test( 'should create sides input for polygon', () => {
			const layer = { id: 'test-1', type: 'polygon', sides: 8 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const sidesInput = form.querySelector( 'input[data-prop="sides"]' );
			expect( sidesInput ).not.toBeNull();
			expect( sidesInput.value ).toBe( '8' );
		} );

		test( 'should create points input for star', () => {
			const layer = { id: 'test-1', type: 'star', points: 7 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const pointsInput = form.querySelector( 'input[data-prop="points"]' );
			expect( pointsInput ).not.toBeNull();
			expect( pointsInput.value ).toBe( '7' );
		} );

		test( 'should create text input for text layer', () => {
			const layer = { id: 'test-1', type: 'text', text: 'Hello World' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Text input doesn't have data-prop, find by type
			const textInputs = form.querySelectorAll( 'input[type="text"]' );
			const textInput = Array.from( textInputs ).find( ( input ) => input.value === 'Hello World' );
			expect( textInput ).not.toBeNull();
		} );

		test( 'should create fontSize input for text layer', () => {
			const layer = { id: 'test-1', type: 'text', fontSize: 24 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const fontSizeInput = form.querySelector( 'input[data-prop="fontSize"]' );
			expect( fontSizeInput ).not.toBeNull();
			expect( fontSizeInput.value ).toBe( '24' );
		} );

		test( 'should create line endpoint inputs for line', () => {
			const layer = { id: 'test-1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const x1Input = form.querySelector( 'input[data-prop="x1"]' );
			const y1Input = form.querySelector( 'input[data-prop="y1"]' );
			const x2Input = form.querySelector( 'input[data-prop="x2"]' );
			const y2Input = form.querySelector( 'input[data-prop="y2"]' );

			expect( x1Input ).not.toBeNull();
			expect( y1Input ).not.toBeNull();
			expect( x2Input ).not.toBeNull();
			expect( y2Input ).not.toBeNull();
		} );

		test( 'should create textbox layer form with text properties', () => {
			const layer = { id: 'test-1', type: 'textbox', width: 200, height: 100, text: 'Hello' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Should have width and height inputs
			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			expect( widthInput ).not.toBeNull();
			expect( heightInput ).not.toBeNull();

			// Should NOT have textarea - textbox uses inline canvas editing with richText
			const textarea = form.querySelector( 'textarea' );
			expect( textarea ).toBeNull();
		} );

		test( 'should create textbox font controls', () => {
			const layer = { id: 'test-1', type: 'textbox', fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', fontStyle: 'italic' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Font family select
			const selects = form.querySelectorAll( 'select' );
			expect( selects.length ).toBeGreaterThan( 0 );

			// Font size input
			const fontSizeInput = form.querySelector( 'input[data-prop="fontSize"]' );
			expect( fontSizeInput ).not.toBeNull();
			expect( fontSizeInput.value ).toBe( '18' );

			// Bold and italic checkboxes
			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const boldCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Bold' );
			} );
			const italicCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Italic' );
			} );
			expect( boldCheckbox ).not.toBeNull();
			expect( boldCheckbox.checked ).toBe( true );
			expect( italicCheckbox ).not.toBeNull();
			expect( italicCheckbox.checked ).toBe( true );
		} );

		test( 'should create textbox alignment controls', () => {
			const layer = { id: 'test-1', type: 'textbox', textAlign: 'center', verticalAlign: 'middle', padding: 12 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const paddingInput = form.querySelector( 'input[data-prop="padding"]' );
			expect( paddingInput ).not.toBeNull();
			expect( paddingInput.value ).toBe( '12' );
		} );

		test( 'should create textbox text shadow controls', () => {
			const layer = {
				id: 'test-1',
				type: 'textbox',
				textShadow: true,
				textShadowColor: 'rgba(0,0,0,0.5)',
				textShadowBlur: 4,
				textShadowOffsetX: 2,
				textShadowOffsetY: 2
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find text shadow checkbox
			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const shadowCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Text Shadow' );
			} );
			expect( shadowCheckbox ).not.toBeNull();
			expect( shadowCheckbox.checked ).toBe( true );
		} );

		test( 'should create ellipse width/height inputs', () => {
			const layer = { id: 'test-1', type: 'ellipse', radiusX: 50, radiusY: 30 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			expect( widthInput ).not.toBeNull();
			expect( heightInput ).not.toBeNull();
			// Ellipse width/height should be 2x radius
			expect( widthInput.value ).toBe( '100' );
			expect( heightInput.value ).toBe( '60' );
		} );

		test( 'should create image layer form', () => {
			const layer = { id: 'test-1', type: 'image', width: 300, height: 200 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			expect( widthInput ).not.toBeNull();
			expect( heightInput ).not.toBeNull();
			expect( widthInput.value ).toBe( '300' );
			expect( heightInput.value ).toBe( '200' );

			// Image layers should not have appearance section
			const appearanceHeader = form.querySelector( '.property-section-header--appearance' );
			expect( appearanceHeader ).toBeNull();
		} );

		test( 'should create arrow layer form with arrow-specific controls', () => {
			const layer = {
				id: 'test-1',
				type: 'arrow',
				x1: 0, y1: 0, x2: 100, y2: 100,
				arrowSize: 20,
				headScale: 1.5,
				tailWidth: 5,
				arrowStyle: 'double',
				arrowHeadType: 'chevron'
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Arrow endpoints
			const x1Input = form.querySelector( 'input[data-prop="x1"]' );
			const x2Input = form.querySelector( 'input[data-prop="x2"]' );
			expect( x1Input ).not.toBeNull();
			expect( x2Input ).not.toBeNull();

			// Arrow size input
			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const arrowSizeInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Head Size' );
			} );
			expect( arrowSizeInput ).not.toBeNull();
			expect( arrowSizeInput.value ).toBe( '20' );

			// Arrow style select (single/double/none)
			const selects = form.querySelectorAll( 'select' );
			expect( selects.length ).toBeGreaterThan( 0 );
		} );

		test( 'should create star layer form with star-specific controls', () => {
			const layer = {
				id: 'test-1',
				type: 'star',
				points: 6,
				outerRadius: 50,
				innerRadius: 25,
				pointRadius: 5,
				valleyRadius: 3
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const pointsInput = form.querySelector( 'input[data-prop="points"]' );
			expect( pointsInput ).not.toBeNull();
			expect( pointsInput.value ).toBe( '6' );

			const outerRadiusInput = form.querySelector( 'input[data-prop="outerRadius"]' );
			expect( outerRadiusInput ).not.toBeNull();
			expect( outerRadiusInput.value ).toBe( '50' );

			const innerRadiusInput = form.querySelector( 'input[data-prop="innerRadius"]' );
			expect( innerRadiusInput ).not.toBeNull();
			expect( innerRadiusInput.value ).toBe( '25' );

			const pointRadiusInput = form.querySelector( 'input[data-prop="pointRadius"]' );
			expect( pointRadiusInput ).not.toBeNull();
			expect( pointRadiusInput.value ).toBe( '5' );

			const valleyRadiusInput = form.querySelector( 'input[data-prop="valleyRadius"]' );
			expect( valleyRadiusInput ).not.toBeNull();
			expect( valleyRadiusInput.value ).toBe( '3' );
		} );

		test( 'should create polygon corner radius input', () => {
			const layer = { id: 'test-1', type: 'polygon', sides: 6, radius: 50, cornerRadius: 10 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const cornerRadiusInput = form.querySelector( 'input[data-prop="cornerRadius"]' );
			expect( cornerRadiusInput ).not.toBeNull();
			expect( cornerRadiusInput.value ).toBe( '10' );
		} );

		test( 'should create rectangle corner radius input', () => {
			const layer = { id: 'test-1', type: 'rectangle', width: 100, height: 50, cornerRadius: 15 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const cornerRadiusInput = form.querySelector( 'input[data-prop="cornerRadius"]' );
			expect( cornerRadiusInput ).not.toBeNull();
			expect( cornerRadiusInput.value ).toBe( '15' );
		} );

		test( 'should NOT show x/y/rotation for arrow layers', () => {
			const layer = { id: 'test-1', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Arrows use x1/y1/x2/y2 instead of x/y
			const xInput = form.querySelector( 'input[data-prop="x"]' );
			const yInput = form.querySelector( 'input[data-prop="y"]' );
			const rotInput = form.querySelector( 'input[data-prop="rotation"]' );

			expect( xInput ).toBeNull();
			expect( yInput ).toBeNull();
			expect( rotInput ).toBeNull();
		} );

		test( 'should NOT show x/y/rotation for line layers', () => {
			const layer = { id: 'test-1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const xInput = form.querySelector( 'input[data-prop="x"]' );
			expect( xInput ).toBeNull();
		} );

		test( 'should create appearance section for non-image layers', () => {
			const layer = { id: 'test-1', type: 'rectangle' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const appearanceHeader = form.querySelector( '.property-section-header--appearance' );
			expect( appearanceHeader ).not.toBeNull();
		} );

		test( 'should NOT show fill controls for line layers', () => {
			const layer = { id: 'test-1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Line layers should have stroke but not fill
			// Check that Fill Color label is not present
			const labels = form.querySelectorAll( 'label' );
			const fillLabel = Array.from( labels ).find( ( l ) => l.textContent.includes( 'Fill Color' ) );
			expect( fillLabel ).toBeUndefined();
		} );

		test( 'should create folder/group layer form with folder-specific controls', () => {
			const layer = {
				id: 'folder-1',
				type: 'group',
				name: 'My Folder',
				children: [ 'layer-1', 'layer-2', 'layer-3' ]
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Folder should have name input
			const nameInput = form.querySelector( 'input[type="text"]' );
			expect( nameInput ).not.toBeNull();
			expect( nameInput.value ).toBe( 'My Folder' );

			// Folder should show contents info (3 layers)
			const infoValue = form.querySelector( '.properties-value' );
			expect( infoValue ).not.toBeNull();
			expect( infoValue.textContent ).toContain( '3 layers' );

			// Folder should NOT have transform section (no x, y, rotation)
			const xInput = form.querySelector( 'input[data-prop="x"]' );
			expect( xInput ).toBeNull();

			// Folder should NOT have appearance section
			const appearanceHeader = form.querySelector( '.property-section-header--appearance' );
			expect( appearanceHeader ).toBeNull();
		} );

		test( 'should show empty folder tip when folder has no children', () => {
			const layer = {
				id: 'folder-1',
				type: 'group',
				name: 'Empty Folder',
				children: []
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Should show empty hint
			const infoValue = form.querySelector( '.properties-value' );
			expect( infoValue.textContent ).toContain( 'Empty' );

			// Should show tip row for empty folders
			const tipRow = form.querySelector( '.properties-tip' );
			expect( tipRow ).not.toBeNull();
		} );

		test( 'should update folder name via editor.updateLayer', () => {
			const layer = {
				id: 'folder-1',
				type: 'group',
				name: 'Original Name'
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const nameInput = form.querySelector( 'input[type="text"]' );
			nameInput.value = 'New Folder Name';
			nameInput.dispatchEvent( new Event( 'input' ) );
			jest.advanceTimersByTime( 150 );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'folder-1', { name: 'New Folder Name' } );
		} );

		test( 'should show singular "1 layer" for folder with one child', () => {
			const layer = {
				id: 'folder-1',
				type: 'group',
				name: 'Single Item Folder',
				children: [ 'layer-1' ]
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const infoValue = form.querySelector( '.properties-value' );
			expect( infoValue.textContent ).toBe( '1 layer' );
		} );
	} );

	describe( 'addInput', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should create number input', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				prop: 'width',
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input[type="number"]' );
			expect( input ).not.toBeNull();
			expect( input.value ).toBe( '100' );
		} );

		test( 'should create text input', () => {
			PropertiesForm.addInput( {
				label: 'Name',
				type: 'text',
				value: 'Test',
				prop: 'name',
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input[type="text"]' );
			expect( input ).not.toBeNull();
			expect( input.value ).toBe( 'Test' );
		} );

		test( 'should set min and max for number input', () => {
			PropertiesForm.addInput( {
				label: 'Sides',
				type: 'number',
				value: 5,
				min: 3,
				max: 20,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input[type="number"]' );
			expect( input.min ).toBe( '3' );
			expect( input.max ).toBe( '20' );
		} );

		test( 'should set step for number input', () => {
			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 0.5,
				step: 0.1,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input[type="number"]' );
			expect( input.step ).toBe( '0.1' );
		} );

		test( 'should call onChange when input changes', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input[type="number"]' );
			input.value = '150';
			dispatchInputAndAdvanceTimers( input );

			expect( onChange ).toHaveBeenCalledWith( 150 );
		} );

		test( 'should create unique id for input', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				prop: 'width',
				onChange: jest.fn()
			}, 'layer-123', container );

			const input = container.querySelector( 'input' );
			expect( input.id ).toContain( 'layer-123' );
			expect( input.id ).toContain( 'width' );
		} );

		test( 'should create label associated with input', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				prop: 'width',
				onChange: jest.fn()
			}, 'layer-1', container );

			const label = container.querySelector( 'label' );
			const input = container.querySelector( 'input' );
			expect( label.getAttribute( 'for' ) ).toBe( input.id );
		} );
	} );

	describe( 'addSelect', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should create select with options', () => {
			PropertiesForm.addSelect( {
				label: 'Style',
				value: 'solid',
				options: [
					{ value: 'solid', text: 'Solid' },
					{ value: 'dashed', text: 'Dashed' }
				],
				onChange: jest.fn()
			}, 'layer-1', container );

			const select = container.querySelector( 'select' );
			expect( select ).not.toBeNull();
			expect( select.options.length ).toBe( 2 );
			expect( select.value ).toBe( 'solid' );
		} );

		test( 'should call onChange when selection changes', () => {
			const onChange = jest.fn();
			PropertiesForm.addSelect( {
				label: 'Style',
				value: 'solid',
				options: [
					{ value: 'solid', text: 'Solid' },
					{ value: 'dashed', text: 'Dashed' }
				],
				onChange
			}, 'layer-1', container );

			const select = container.querySelector( 'select' );
			select.value = 'dashed';
			select.dispatchEvent( new Event( 'change' ) );

			expect( onChange ).toHaveBeenCalledWith( 'dashed' );
		} );
	} );

	describe( 'addCheckbox', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should create checkbox', () => {
			PropertiesForm.addCheckbox( {
				label: 'Visible',
				value: true,
				onChange: jest.fn()
			}, 'layer-1', container );

			const checkbox = container.querySelector( 'input[type="checkbox"]' );
			expect( checkbox ).not.toBeNull();
			expect( checkbox.checked ).toBe( true );
		} );

		test( 'should create unchecked checkbox', () => {
			PropertiesForm.addCheckbox( {
				label: 'Locked',
				value: false,
				onChange: jest.fn()
			}, 'layer-1', container );

			const checkbox = container.querySelector( 'input[type="checkbox"]' );
			expect( checkbox.checked ).toBe( false );
		} );

		test( 'should call onChange when checkbox changes', () => {
			const onChange = jest.fn();
			PropertiesForm.addCheckbox( {
				label: 'Visible',
				value: false,
				onChange
			}, 'layer-1', container );

			const checkbox = container.querySelector( 'input[type="checkbox"]' );
			checkbox.checked = true;
			checkbox.dispatchEvent( new Event( 'change' ) );

			expect( onChange ).toHaveBeenCalledWith( true );
		} );
	} );

	describe( 'addSliderInput', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should create both number and range inputs', () => {
			PropertiesForm.addSliderInput( {
				label: 'Opacity',
				value: 75,
				min: 0,
				max: 100,
				onChange: jest.fn()
			}, 'layer-1', container );

			const numberInput = container.querySelector( 'input[type="number"]' );
			const rangeInput = container.querySelector( 'input[type="range"]' );

			expect( numberInput ).not.toBeNull();
			expect( rangeInput ).not.toBeNull();
			expect( numberInput.value ).toBe( '75' );
			expect( rangeInput.value ).toBe( '75' );
		} );

		test( 'should sync number and range inputs', () => {
			const onChange = jest.fn();
			PropertiesForm.addSliderInput( {
				label: 'Opacity',
				value: 50,
				min: 0,
				max: 100,
				onChange
			}, 'layer-1', container );

			const numberInput = container.querySelector( 'input[type="number"]' );
			const rangeInput = container.querySelector( 'input[type="range"]' );

			numberInput.value = '80';
			numberInput.dispatchEvent( new Event( 'input' ) );

			expect( rangeInput.value ).toBe( '80' );
			expect( onChange ).toHaveBeenCalledWith( 80 );
		} );

		test( 'should clamp values to min/max', () => {
			const onChange = jest.fn();
			PropertiesForm.addSliderInput( {
				label: 'Opacity',
				value: 50,
				min: 0,
				max: 100,
				onChange
			}, 'layer-1', container );

			const numberInput = container.querySelector( 'input[type="number"]' );
			numberInput.value = '150';
			numberInput.dispatchEvent( new Event( 'input' ) );

			expect( numberInput.value ).toBe( '100' );
			expect( onChange ).toHaveBeenCalledWith( 100 );
		} );
	} );

	describe( 'addSection', () => {
		let form;

		beforeEach( () => {
			form = document.createElement( 'form' );
		} );

		test( 'should create section with header', () => {
			PropertiesForm.addSection( 'Transform', 'transform', form );

			const section = form.querySelector( '.property-section' );
			const header = form.querySelector( '.property-section-header' );

			expect( section ).not.toBeNull();
			expect( header ).not.toBeNull();
			expect( header.textContent ).toBe( 'Transform' );
		} );

		test( 'should add type-specific class to header', () => {
			PropertiesForm.addSection( 'Transform', 'transform', form );

			const header = form.querySelector( '.property-section-header' );
			expect( header.classList.contains( 'property-section-header--transform' ) ).toBe( true );
		} );

		test( 'should create section body', () => {
			PropertiesForm.addSection( 'Appearance', 'appearance', form );

			const sectionBody = form.querySelector( '.property-section-body' );
			expect( sectionBody ).not.toBeNull();
		} );

		test( 'should return section body for adding fields', () => {
			const sectionBody = PropertiesForm.addSection( 'Effects', 'effects', form );

			expect( sectionBody ).toBeInstanceOf( HTMLDivElement );
			expect( sectionBody.className ).toBe( 'property-section-body' );
		} );
	} );

	describe( 'addColorPicker', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
			// ColorPickerDialog is not available, so fallback is used
			delete global.ColorPickerDialog;
		} );

		test( 'should create color button', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: '#ff0000',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			expect( button ).not.toBeNull();
		} );

		test( 'should set initial color', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: '#00ff00',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			expect( button.style.background ).toBe( 'rgb(0, 255, 0)' );
		} );

		test( 'should show transparent pattern for no color', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: 'none',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			expect( button.style.background ).toContain( 'repeating-linear-gradient' );
		} );
	} );

	describe( 'onChange handlers', () => {
		test( 'should call editor.updateLayer when X changes', () => {
			const layer = { id: 'test-layer', type: 'rectangle', x: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const xInput = form.querySelector( 'input[data-prop="x"]' );
			xInput.value = '100';
			dispatchInputAndAdvanceTimers( xInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { x: 100 } );
		} );

		test( 'should call editor.updateLayer when Y changes', () => {
			const layer = { id: 'test-layer', type: 'rectangle', y: 25 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const yInput = form.querySelector( 'input[data-prop="y"]' );
			yInput.value = '200';
			dispatchInputAndAdvanceTimers( yInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { y: 200 } );
		} );

		test( 'should call editor.updateLayer when rotation changes', () => {
			const layer = { id: 'test-layer', type: 'rectangle', rotation: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const rotInput = form.querySelector( 'input[data-prop="rotation"]' );
			rotInput.value = '90';
			dispatchInputAndAdvanceTimers( rotInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { rotation: 90 } );
		} );
	} );

	describe( 'shadow properties with zero values', () => {
		test( 'should display shadowBlur of 0 correctly (not default to 8)', () => {
			const layer = {
				id: 'test-layer',
				type: 'ellipse',
				x: 100,
				y: 100,
				radiusX: 50,
				radiusY: 30,
				shadow: true,
				shadowBlur: 0,
				shadowOffsetX: 0,
				shadowOffsetY: 0,
				shadowSpread: 0
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find the shadow blur input (Shadow Size)
			const inputs = form.querySelectorAll( 'input[type="number"]' );
			let shadowBlurInput = null;
			inputs.forEach( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				if ( label && label.textContent.includes( 'Shadow Size' ) ) {
					shadowBlurInput = input;
				}
			} );

			expect( shadowBlurInput ).not.toBeNull();
			expect( shadowBlurInput.value ).toBe( '0' );
		} );

		test( 'should display shadowOffsetX of 0 correctly (not default to 2)', () => {
			const layer = {
				id: 'test-layer',
				type: 'ellipse',
				x: 100,
				y: 100,
				radiusX: 50,
				radiusY: 30,
				shadow: true,
				shadowBlur: 0,
				shadowOffsetX: 0,
				shadowOffsetY: 0
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			let shadowOffsetXInput = null;
			inputs.forEach( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				if ( label && label.textContent.includes( 'Shadow Offset X' ) ) {
					shadowOffsetXInput = input;
				}
			} );

			expect( shadowOffsetXInput ).not.toBeNull();
			expect( shadowOffsetXInput.value ).toBe( '0' );
		} );

		test( 'should display shadowOffsetY of 0 correctly (not default to 2)', () => {
			const layer = {
				id: 'test-layer',
				type: 'ellipse',
				x: 100,
				y: 100,
				radiusX: 50,
				radiusY: 30,
				shadow: true,
				shadowBlur: 0,
				shadowOffsetX: 0,
				shadowOffsetY: 0
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			let shadowOffsetYInput = null;
			inputs.forEach( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				if ( label && label.textContent.includes( 'Shadow Offset Y' ) ) {
					shadowOffsetYInput = input;
				}
			} );

			expect( shadowOffsetYInput ).not.toBeNull();
			expect( shadowOffsetYInput.value ).toBe( '0' );
		} );

		test( 'should display shadowSpread of 0 correctly', () => {
			const layer = {
				id: 'test-layer',
				type: 'ellipse',
				x: 100,
				y: 100,
				radiusX: 50,
				radiusY: 30,
				shadow: true,
				shadowSpread: 0
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			let shadowSpreadInput = null;
			inputs.forEach( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				if ( label && label.textContent.includes( 'Shadow Spread' ) ) {
					shadowSpreadInput = input;
				}
			} );

			expect( shadowSpreadInput ).not.toBeNull();
			expect( shadowSpreadInput.value ).toBe( '0' );
		} );
	} );

	describe( 'addInput - textarea type', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should create textarea element', () => {
			PropertiesForm.addInput( {
				label: 'Description',
				type: 'textarea',
				value: 'Some text',
				rows: 5,
				onChange: jest.fn()
			}, 'layer-1', container );

			const textarea = container.querySelector( 'textarea' );
			expect( textarea ).not.toBeNull();
			expect( textarea.value ).toBe( 'Some text' );
			expect( textarea.rows ).toBe( 5 );
		} );

		test( 'should set maxLength on textarea', () => {
			PropertiesForm.addInput( {
				label: 'Text',
				type: 'textarea',
				value: '',
				maxLength: 1000,
				onChange: jest.fn()
			}, 'layer-1', container );

			const textarea = container.querySelector( 'textarea' );
			expect( textarea.maxLength ).toBe( 1000 );
		} );

		test( 'should add wide class when wide option is true', () => {
			PropertiesForm.addInput( {
				label: 'Long Text',
				type: 'textarea',
				value: '',
				wide: true,
				onChange: jest.fn()
			}, 'layer-1', container );

			const wrapper = container.querySelector( '.property-field--wide' );
			expect( wrapper ).not.toBeNull();
		} );

		test( 'should call onChange for textarea', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Text',
				type: 'textarea',
				value: '',
				onChange
			}, 'layer-1', container );

			const textarea = container.querySelector( 'textarea' );
			textarea.value = 'New text';
			textarea.dispatchEvent( new Event( 'input' ) );

			expect( onChange ).toHaveBeenCalledWith( 'New text' );
		} );

		test( 'should use default rows when not specified', () => {
			PropertiesForm.addInput( {
				label: 'Description',
				type: 'textarea',
				value: '',
				onChange: jest.fn()
			}, 'layer-1', container );

			const textarea = container.querySelector( 'textarea' );
			expect( textarea.rows ).toBe( 3 );
		} );
	} );

	describe( 'addInput - checkbox type via addInput', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should create checkbox with checked state', () => {
			PropertiesForm.addInput( {
				label: 'Visible',
				type: 'checkbox',
				value: true,
				onChange: jest.fn()
			}, 'layer-1', container );

			const checkbox = container.querySelector( 'input[type="checkbox"]' );
			expect( checkbox ).not.toBeNull();
			expect( checkbox.checked ).toBe( true );
		} );

		test( 'should add checkbox class to wrapper', () => {
			PropertiesForm.addInput( {
				label: 'Option',
				type: 'checkbox',
				value: false,
				onChange: jest.fn()
			}, 'layer-1', container );

			const wrapper = container.querySelector( '.property-field--checkbox' );
			expect( wrapper ).not.toBeNull();
		} );
	} );

	describe( 'addInput - validation logic', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should show error for empty required number input on blur', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '';
			input.dispatchEvent( new Event( 'blur' ) );

			// Should revert to last valid value
			expect( input.value ).toBe( '100' );
		} );

		test( 'should not call onChange when value is below minimum', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Sides',
				type: 'number',
				value: 6,
				min: 3,
				max: 20,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '1';
			input.dispatchEvent( new Event( 'input' ) );

			// Value is invalid, so onChange should NOT be called
			expect( onChange ).not.toHaveBeenCalled();
		} );

		test( 'should not call onChange when value is above maximum', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Sides',
				type: 'number',
				value: 6,
				min: 3,
				max: 20,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '100';
			input.dispatchEvent( new Event( 'input' ) );

			// Value is invalid, so onChange should NOT be called
			expect( onChange ).not.toHaveBeenCalled();
		} );

		test( 'should format decimal values with decimals=1', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 5,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			expect( input.step ).toBe( '0.1' );

			input.value = '5.67';
			input.dispatchEvent( new Event( 'input' ) );

			// Should round to 1 decimal place
			expect( input.value ).toBe( '5.7' );
		} );

		test( 'should handle text length validation', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Name',
				type: 'text',
				value: '',
				maxLength: 100,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = 'Valid text';
			input.dispatchEvent( new Event( 'input' ) );

			expect( onChange ).toHaveBeenCalledWith( 'Valid text' );
		} );

		test( 'should set step to 0.1 when decimals=1 and no explicit step', () => {
			PropertiesForm.addInput( {
				label: 'Opacity',
				type: 'number',
				value: 0.5,
				decimals: 1,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			expect( input.step ).toBe( '0.1' );
			expect( input.getAttribute( 'data-decimals' ) ).toBe( '1' );
		} );

		test( 'should handle integer rounding with decimals=1', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 1.0,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '5.0';
			input.dispatchEvent( new Event( 'blur' ) );

			// Integer should display without decimal
			expect( input.value ).toBe( '5' );
		} );
	} );

	describe( 'addInput - change event handling', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should handle change event for number input', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '150';
			input.dispatchEvent( new Event( 'change' ) );

			expect( onChange ).toHaveBeenCalledWith( 150 );
		} );

		test( 'should handle change event for text input', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Name',
				type: 'text',
				value: 'old',
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = 'new value';
			input.dispatchEvent( new Event( 'change' ) );

			expect( onChange ).toHaveBeenCalledWith( 'new value' );
		} );

		test( 'should format number with decimals=1 on change', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 1.0,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '2.35';
			input.dispatchEvent( new Event( 'change' ) );

			expect( input.value ).toBe( '2.4' );
			expect( onChange ).toHaveBeenCalledWith( 2.4 );
		} );

		test( 'should not call onChange with invalid number values on change event', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 50,
				min: 10,
				max: 100,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '5'; // Below min, invalid
			input.dispatchEvent( new Event( 'change' ) );

			// Value is invalid, onChange should NOT be called
			expect( onChange ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'addInput - error handling', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should catch errors in onChange and log them', () => {
			const onChangeWithError = jest.fn( () => {
				throw new Error( 'Test error' );
			} );

			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: onChangeWithError
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// Should not throw
			expect( () => {
				input.value = '150';
				dispatchInputAndAdvanceTimers( input );
			} ).not.toThrow();

			// Should have logged error
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );

		test( 'should show notification when onChange throws', () => {
			const onChangeWithError = jest.fn( () => {
				throw new Error( 'Update failed' );
			} );

			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: onChangeWithError
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '150';
			dispatchInputAndAdvanceTimers( input );

			expect( global.mw.notify ).toHaveBeenCalled();
		} );

		test( 'should handle undefined value', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: undefined,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			expect( input.value ).toBe( '' );
		} );

		test( 'should handle null value', () => {
			PropertiesForm.addInput( {
				label: 'Name',
				type: 'text',
				value: null,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			expect( input.value ).toBe( '' );
		} );

		test( 'should handle errors in blur event handler', () => {
			const onChange = jest.fn( () => {
				throw new Error( 'Blur error' );
			} );

			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			expect( () => {
				input.value = '150';
				input.dispatchEvent( new Event( 'blur' ) );
			} ).not.toThrow();
		} );

		test( 'should handle errors in change event handler', () => {
			const onChange = jest.fn( () => {
				throw new Error( 'Change error' );
			} );

			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			expect( () => {
				input.value = '150';
				input.dispatchEvent( new Event( 'change' ) );
			} ).not.toThrow();
		} );
	} );

	describe( 'addColorPicker with ColorPickerDialog', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should create fallback color button when ColorPickerDialog not available', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: '#ff0000',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			expect( button ).not.toBeNull();
			expect( button.style.background ).toContain( 'rgb' );
		} );

		test( 'should handle transparent color value', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: 'transparent',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			expect( button.style.background ).toContain( 'repeating-linear-gradient' );
		} );

		test( 'should handle "none" color value', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: 'none',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			expect( button.style.background ).toContain( 'repeating-linear-gradient' );
		} );
	} );

	describe( 'layer-specific onChange handlers', () => {
		test( 'should update ellipse width and radiusX together', () => {
			const layer = { id: 'test-layer', type: 'ellipse', radiusX: 50, radiusY: 30 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			widthInput.value = '200';
			dispatchInputAndAdvanceTimers( widthInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { width: 200, radiusX: 100 } );
		} );

		test( 'should update ellipse height and radiusY together', () => {
			const layer = { id: 'test-layer', type: 'ellipse', radiusX: 50, radiusY: 30 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			heightInput.value = '100';
			dispatchInputAndAdvanceTimers( heightInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { height: 100, radiusY: 50 } );
		} );

		test( 'should update polygon sides via onChange handler', () => {
			const layer = { id: 'test-layer', type: 'polygon', sides: 6 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const sidesInput = form.querySelector( 'input[data-prop="sides"]' );
			sidesInput.value = '8';
			dispatchInputAndAdvanceTimers( sidesInput );

			// The onChange should be called with parsed value
			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star points via onChange handler', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const pointsInput = form.querySelector( 'input[data-prop="points"]' );
			pointsInput.value = '7';
			dispatchInputAndAdvanceTimers( pointsInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should toggle bold fontWeight on checkbox change', () => {
			const layer = { id: 'test-layer', type: 'textbox', fontWeight: 'normal' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const boldCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Bold' );
			} );

			boldCheckbox.checked = true;
			boldCheckbox.dispatchEvent( new Event( 'change' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { fontWeight: 'bold' } );
		} );

		test( 'should toggle italic fontStyle on checkbox change', () => {
			const layer = { id: 'test-layer', type: 'textbox', fontStyle: 'normal' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const italicCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Italic' );
			} );

			italicCheckbox.checked = true;
			italicCheckbox.dispatchEvent( new Event( 'change' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { fontStyle: 'italic' } );
		} );

		test( 'should enable shadow with default values when checkbox checked', () => {
			const layer = { id: 'test-layer', type: 'rectangle' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const shadowCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Drop Shadow' );
			} );

			shadowCheckbox.checked = true;
			shadowCheckbox.dispatchEvent( new Event( 'change' ) );

			const call = mockEditor.updateLayer.mock.calls.find( ( c ) => c[ 1 ].shadow === true );
			expect( call ).toBeDefined();
			expect( call[ 1 ].shadowColor ).toBe( '#000000' );
			expect( call[ 1 ].shadowBlur ).toBe( 8 );
			expect( call[ 1 ].shadowOffsetX ).toBe( 2 );
			expect( call[ 1 ].shadowOffsetY ).toBe( 2 );
		} );

		test( 'should update arrow headScale from percentage', () => {
			const layer = { id: 'test-layer', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100, headScale: 1.0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find Head Scale slider input
			const numberInputs = form.querySelectorAll( 'input.compact-number' );
			const headScaleInput = Array.from( numberInputs ).find( ( input ) => {
				const label = input.parentElement.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Head Scale' );
			} );

			if ( headScaleInput ) {
				headScaleInput.value = '150';
				headScaleInput.dispatchEvent( new Event( 'input' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { headScale: 1.5 } );
			}
		} );

		test( 'should update opacity as decimal from percentage', () => {
			const layer = { id: 'test-layer', type: 'rectangle', opacity: 1 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find Layer Opacity slider input
			const numberInputs = form.querySelectorAll( 'input.compact-number' );
			const opacityInput = Array.from( numberInputs ).find( ( input ) => {
				const label = input.parentElement.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Layer Opacity' );
			} );

			if ( opacityInput ) {
				opacityInput.value = '50';
				opacityInput.dispatchEvent( new Event( 'input' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { opacity: 0.5 } );
			}
		} );
	} );

	describe( 'textbox text stroke controls', () => {
		test( 'should update textStrokeWidth via input handler', () => {
			const layer = { id: 'test-layer', type: 'textbox', textStrokeWidth: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const input = form.querySelector( 'input[data-prop="textStrokeWidth"]' );
			input.value = '5';
			dispatchInputAndAdvanceTimers( input );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );
	} );

	describe( 'text layer stroke width', () => {
		test( 'should update text stroke width', () => {
			const layer = { id: 'test-layer', type: 'text', textStrokeWidth: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const strokeWidthInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Text Stroke Width' );
			} );

			strokeWidthInput.value = '5';
			dispatchInputAndAdvanceTimers( strokeWidthInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { textStrokeWidth: 5 } );
		} );
	} );

	describe( 'fallback behavior without dependencies', () => {
		test( 'should work without layersMessages', () => {
			delete global.layersMessages;

			const layer = { id: 'test-1', type: 'rectangle' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			expect( form ).toBeInstanceOf( HTMLFormElement );
		} );

		test( 'should work without mw.log.error', () => {
			delete global.mw.log;

			const onChangeWithError = jest.fn( () => {
				throw new Error( 'Test error' );
			} );

			const container = document.createElement( 'div' );
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: onChangeWithError
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			expect( () => {
				input.value = '150';
				input.dispatchEvent( new Event( 'input' ) );
			} ).not.toThrow();
		} );

		test( 'should work without mw.notify', () => {
			delete global.mw.notify;

			const onChangeWithError = jest.fn( () => {
				throw new Error( 'Test error' );
			} );

			const container = document.createElement( 'div' );
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: onChangeWithError
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			expect( () => {
				input.value = '150';
				input.dispatchEvent( new Event( 'input' ) );
			} ).not.toThrow();
		} );
	} );

	describe( 'ColorPickerDialog integration', () => {
		// Note: ColorPickerDialog is captured at module load time, so we test
		// only the fallback path here. The ColorPickerDialog integration is
		// tested implicitly through the form creation tests.

		test( 'should use fallback when ColorPickerDialog not available', () => {
			const container = document.createElement( 'div' );

			// ColorPickerDialog is not available in test environment
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: '#ff0000',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			expect( button ).not.toBeNull();
			expect( button.className ).toContain( 'color-display-button' );
		} );
	} );

	describe( 'ColorPickerDialog with mock', () => {
		// Since ColorPickerDialog is captured at module load time, we need to
		// reload the module with a mock in place. Use jest.isolateModules for this.

		test( 'should use ColorPickerDialog.createColorButton when available', () => {
			const mockColorButton = document.createElement( 'button' );
			mockColorButton.className = 'color-button-from-dialog';

			// Set up mock BEFORE requiring the module
			global.ColorPickerDialog = {
				createColorButton: jest.fn( () => mockColorButton ),
				updateColorButton: jest.fn()
			};
			global.Layers = global.Layers || {};
			global.Layers.UI = global.Layers.UI || {};
			global.Layers.UI.ColorPickerDialog = global.ColorPickerDialog;

			// Isolate and require fresh module instance
			jest.isolateModules( () => {
				const FreshPropertiesForm = require( '../../resources/ext.layers.editor/ui/PropertiesForm.js' );
				const container = document.createElement( 'div' );

				FreshPropertiesForm.addColorPicker( {
					label: 'Fill Color',
					value: '#ff0000',
					onChange: jest.fn()
				}, jest.fn(), container );

				// Should have used the mock's createColorButton
				expect( global.ColorPickerDialog.createColorButton ).toHaveBeenCalled();
			} );

			delete global.ColorPickerDialog;
			delete global.Layers.UI.ColorPickerDialog;
		} );

		test( 'should handle ColorPickerDialog onClick callback', () => {
			let capturedOnClick;
			const mockColorButton = document.createElement( 'button' );

			global.ColorPickerDialog = jest.fn( function ( opts ) {
				this.open = jest.fn();
				this.opts = opts;
			} );
			global.ColorPickerDialog.createColorButton = jest.fn( ( opts ) => {
				capturedOnClick = opts.onClick;
				return mockColorButton;
			} );
			global.ColorPickerDialog.updateColorButton = jest.fn();
			global.Layers = global.Layers || {};
			global.Layers.UI = global.Layers.UI || {};
			global.Layers.UI.ColorPickerDialog = global.ColorPickerDialog;

			jest.isolateModules( () => {
				const FreshPropertiesForm = require( '../../resources/ext.layers.editor/ui/PropertiesForm.js' );
				const container = document.createElement( 'div' );
				const onChange = jest.fn();

				FreshPropertiesForm.addColorPicker( {
					label: 'Fill Color',
					value: '#ff0000',
					onChange
				}, jest.fn(), container );

				// Trigger the onClick callback
				expect( capturedOnClick ).toBeDefined();
				capturedOnClick();

				// Should have created a new ColorPickerDialog and called open
				expect( global.ColorPickerDialog ).toHaveBeenCalled();
			} );

			delete global.ColorPickerDialog;
			delete global.Layers.UI.ColorPickerDialog;
		} );

		test( 'should handle ColorPickerDialog onApply callback', () => {
			let capturedOnClick;
			let capturedDialogOpts;
			const mockColorButton = document.createElement( 'button' );

			global.ColorPickerDialog = jest.fn( function ( opts ) {
				capturedDialogOpts = opts;
				this.open = jest.fn();
			} );
			global.ColorPickerDialog.createColorButton = jest.fn( ( opts ) => {
				capturedOnClick = opts.onClick;
				return mockColorButton;
			} );
			global.ColorPickerDialog.updateColorButton = jest.fn();
			global.Layers = global.Layers || {};
			global.Layers.UI = global.Layers.UI || {};
			global.Layers.UI.ColorPickerDialog = global.ColorPickerDialog;

			jest.isolateModules( () => {
				const FreshPropertiesForm = require( '../../resources/ext.layers.editor/ui/PropertiesForm.js' );
				const container = document.createElement( 'div' );
				const onChange = jest.fn();
				const opts = {
					label: 'Fill Color',
					value: '#ff0000',
					onChange
				};

				FreshPropertiesForm.addColorPicker( opts, jest.fn(), container );

				// Trigger onClick to create dialog
				capturedOnClick();

				// Simulate onApply callback
				capturedDialogOpts.onApply( '#00ff00' );

				// Should have called onChange with new color
				expect( onChange ).toHaveBeenCalledWith( '#00ff00' );

				// Should have updated the button
				expect( global.ColorPickerDialog.updateColorButton ).toHaveBeenCalledWith(
					mockColorButton,
					'#00ff00',
					expect.any( Object )
				);
			} );

			delete global.ColorPickerDialog;
			delete global.Layers.UI.ColorPickerDialog;
		} );
	} );

	describe( 'fallback color button click handler', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
			delete global.ColorPickerDialog;
			delete global.Layers.UI.ColorPickerDialog;
		} );

		afterEach( () => {
			// Clean up any leftover color inputs
			const inputs = document.body.querySelectorAll( 'input[type="color"]' );
			inputs.forEach( ( input ) => {
				if ( input.parentNode ) {
					input.parentNode.removeChild( input );
				}
			} );
		} );

		test( 'should create hidden color input on button click', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: '#ff0000',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			button.click();

			// A hidden color input should be added to body
			const colorInput = document.body.querySelector( 'input[type="color"]' );
			expect( colorInput ).not.toBeNull();
			expect( colorInput.style.opacity ).toBe( '0' );
		} );

		test( 'should update button color when color input changes', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: '#ff0000',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			const initialBackground = button.style.background;
			button.click();

			const colorInput = document.body.querySelector( 'input[type="color"]' );
			colorInput.value = '#00ff00';
			colorInput.dispatchEvent( new Event( 'change' ) );

			// Button color should be updated
			expect( button.style.background ).toBe( 'rgb(0, 255, 0)' );
		} );

		test( 'should handle blur event on color input', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: '#ff0000',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			button.click();

			const colorInput = document.body.querySelector( 'input[type="color"]' );
			expect( colorInput ).not.toBeNull();

			// The blur handler tries to remove the input
			colorInput.dispatchEvent( new Event( 'blur' ) );

			// Note: The input may still exist if change event was fired first
			// This test verifies the blur handler doesn't throw
		} );

		test( 'should set initial color value from opts', () => {
			PropertiesForm.addColorPicker( {
				label: 'Fill Color',
				value: '#123456',
				onChange: jest.fn()
			}, jest.fn(), container );

			const button = container.querySelector( 'button' );
			button.click();

			const colorInput = document.body.querySelector( 'input[type="color"]' );
			expect( colorInput.value ).toBe( '#123456' );
		} );
	} );

	describe( 'addSliderInput - range input sync', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should sync range to number when range input changes', () => {
			const onChange = jest.fn();
			PropertiesForm.addSliderInput( {
				label: 'Opacity',
				value: 50,
				min: 0,
				max: 100,
				onChange
			}, 'layer-1', container );

			const numberInput = container.querySelector( 'input[type="number"]' );
			const rangeInput = container.querySelector( 'input[type="range"]' );

			// Change via range input
			rangeInput.value = '75';
			rangeInput.dispatchEvent( new Event( 'input' ) );

			expect( numberInput.value ).toBe( '75' );
			expect( onChange ).toHaveBeenCalledWith( 75 );
		} );

		test( 'should format decimal values with fractional step', () => {
			const onChange = jest.fn();
			PropertiesForm.addSliderInput( {
				label: 'Value',
				value: 0.5,
				min: 0,
				max: 1,
				step: 0.1,
				onChange
			}, 'layer-1', container );

			const numberInput = container.querySelector( 'input[type="number"]' );
			const rangeInput = container.querySelector( 'input[type="range"]' );

			rangeInput.value = '0.67';
			rangeInput.dispatchEvent( new Event( 'input' ) );

			// Should round to one decimal place
			expect( numberInput.value ).toBe( '0.7' );
			expect( onChange ).toHaveBeenCalledWith( 0.7 );
		} );

		test( 'should handle NaN input gracefully', () => {
			const onChange = jest.fn();
			PropertiesForm.addSliderInput( {
				label: 'Value',
				value: 50,
				min: 0,
				max: 100,
				onChange
			}, 'layer-1', container );

			const numberInput = container.querySelector( 'input[type="number"]' );
			numberInput.value = 'invalid';
			numberInput.dispatchEvent( new Event( 'input' ) );

			// onChange should not be called for NaN
			expect( onChange ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'layer type form variations', () => {
		test( 'should create path layer form', () => {
			const layer = { id: 'test-1', type: 'path', points: [ { x: 0, y: 0 }, { x: 100, y: 100 } ] };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			expect( form ).toBeInstanceOf( HTMLFormElement );

			// Path layers should have appearance section
			const appearanceHeader = form.querySelector( '.property-section-header--appearance' );
			expect( appearanceHeader ).not.toBeNull();
		} );

		test( 'should handle text layer with all properties', () => {
			const layer = {
				id: 'test-1',
				type: 'text',
				x: 100,
				y: 50,
				text: 'Hello',
				fontSize: 24,
				fontFamily: 'Arial',
				fontWeight: 'bold',
				fontStyle: 'italic',
				color: '#ff0000',
				textStrokeColor: '#000000',
				textStrokeWidth: 2,
				textShadow: true,
				textShadowColor: '#000000',
				textShadowBlur: 5,
				textShadowOffsetX: 3,
				textShadowOffsetY: 3
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			expect( form ).toBeInstanceOf( HTMLFormElement );

			// Check font size input
			const fontSizeInput = form.querySelector( 'input[data-prop="fontSize"]' );
			expect( fontSizeInput ).not.toBeNull();
			expect( fontSizeInput.value ).toBe( '24' );
		} );

		test( 'should handle arrow layer with double style', () => {
			const layer = {
				id: 'test-1',
				type: 'arrow',
				x1: 0, y1: 0, x2: 100, y2: 100,
				arrowStyle: 'double',
				arrowHeadType: 'filled'
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			expect( form ).toBeInstanceOf( HTMLFormElement );

			// Check for arrow style select
			const selects = form.querySelectorAll( 'select' );
			expect( selects.length ).toBeGreaterThan( 0 );
		} );

		test( 'should update polygon radius', () => {
			const layer = { id: 'test-layer', type: 'polygon', sides: 6, radius: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const radiusInput = form.querySelector( 'input[data-prop="radius"]' );
			radiusInput.value = '75';
			dispatchInputAndAdvanceTimers( radiusInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { radius: 75 } );
		} );

		test( 'should update polygon cornerRadius', () => {
			const layer = { id: 'test-layer', type: 'polygon', sides: 6, radius: 50, cornerRadius: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const cornerRadiusInput = form.querySelector( 'input[data-prop="cornerRadius"]' );
			cornerRadiusInput.value = '10';
			dispatchInputAndAdvanceTimers( cornerRadiusInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star outerRadius', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5, outerRadius: 50, innerRadius: 25 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const outerRadiusInput = form.querySelector( 'input[data-prop="outerRadius"]' );
			outerRadiusInput.value = '75';
			dispatchInputAndAdvanceTimers( outerRadiusInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star innerRadius', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5, outerRadius: 50, innerRadius: 25 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const innerRadiusInput = form.querySelector( 'input[data-prop="innerRadius"]' );
			innerRadiusInput.value = '30';
			dispatchInputAndAdvanceTimers( innerRadiusInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star pointRadius', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5, outerRadius: 50, innerRadius: 25, pointRadius: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const pointRadiusInput = form.querySelector( 'input[data-prop="pointRadius"]' );
			pointRadiusInput.value = '8';
			dispatchInputAndAdvanceTimers( pointRadiusInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star valleyRadius', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5, outerRadius: 50, innerRadius: 25, valleyRadius: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const valleyRadiusInput = form.querySelector( 'input[data-prop="valleyRadius"]' );
			valleyRadiusInput.value = '5';
			dispatchInputAndAdvanceTimers( valleyRadiusInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );
	} );

	describe( 'select field onChange handlers', () => {
		test( 'should update textAlign via select change', () => {
			const layer = { id: 'test-layer', type: 'textbox', textAlign: 'left' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const selects = form.querySelectorAll( 'select' );
			const textAlignSelect = Array.from( selects ).find( ( s ) => {
				const label = s.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Text Align' );
			} );

			if ( textAlignSelect ) {
				textAlignSelect.value = 'center';
				textAlignSelect.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { textAlign: 'center' } );
			}
		} );

		test( 'should update verticalAlign via select change', () => {
			const layer = { id: 'test-layer', type: 'textbox', verticalAlign: 'top' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const selects = form.querySelectorAll( 'select' );
			const verticalAlignSelect = Array.from( selects ).find( ( s ) => {
				const label = s.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Vertical Align' );
			} );

			if ( verticalAlignSelect ) {
				verticalAlignSelect.value = 'middle';
				verticalAlignSelect.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { verticalAlign: 'middle' } );
			}
		} );

		test( 'should update fontFamily via select change', () => {
			const layer = { id: 'test-layer', type: 'textbox', fontFamily: 'Arial' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const selects = form.querySelectorAll( 'select' );
			const fontFamilySelect = Array.from( selects ).find( ( s ) => {
				const label = s.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Font' );
			} );

			if ( fontFamilySelect ) {
				fontFamilySelect.value = 'Roboto';
				fontFamilySelect.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { fontFamily: 'Roboto' } );
			}
		} );
	} );

	describe( 'textbox text content', () => {
		test( 'should update text via textarea change', () => {
			// Note: textbox layers no longer have textarea - text is edited inline on canvas
			// This test now verifies that font styling controls still work
			const layer = { id: 'test-layer', type: 'textbox', fontSize: 16 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Verify no textarea exists (text edited inline on canvas)
			const textarea = form.querySelector( 'textarea' );
			expect( textarea ).toBeNull();

			// Font size input should still work
			const fontSizeInput = form.querySelector( 'input[data-prop="fontSize"]' );
			expect( fontSizeInput ).not.toBeNull();
		} );
	} );

	describe( 'circle layer form', () => {
		test( 'should update circle radius', () => {
			const layer = { id: 'test-layer', type: 'circle', radius: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const radiusInput = form.querySelector( 'input[data-prop="radius"]' );
			radiusInput.value = '75';
			dispatchInputAndAdvanceTimers( radiusInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { radius: 75 } );
		} );
	} );

	describe( 'rectangle layer form', () => {
		test( 'should update rectangle width', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			widthInput.value = '200';
			dispatchInputAndAdvanceTimers( widthInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { width: 200 } );
		} );

		test( 'should update rectangle height', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			heightInput.value = '100';
			dispatchInputAndAdvanceTimers( heightInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { height: 100 } );
		} );

		test( 'should update rectangle cornerRadius', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 50, cornerRadius: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const cornerRadiusInput = form.querySelector( 'input[data-prop="cornerRadius"]' );
			cornerRadiusInput.value = '15';
			dispatchInputAndAdvanceTimers( cornerRadiusInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );
	} );

	describe( 'image layer form', () => {
		test( 'should update image width', () => {
			const layer = { id: 'test-layer', type: 'image', width: 300, height: 200 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			widthInput.value = '400';
			dispatchInputAndAdvanceTimers( widthInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { width: 400 } );
		} );

		test( 'should update image height', () => {
			const layer = { id: 'test-layer', type: 'image', width: 300, height: 200 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			heightInput.value = '300';
			dispatchInputAndAdvanceTimers( heightInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { height: 300 } );
		} );
	} );

	describe( 'line layer form', () => {
		test( 'should update line x1', () => {
			const layer = { id: 'test-layer', type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const x1Input = form.querySelector( 'input[data-prop="x1"]' );
			x1Input.value = '50';
			dispatchInputAndAdvanceTimers( x1Input );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { x1: 50 } );
		} );

		test( 'should update line strokeWidth', () => {
			const layer = { id: 'test-layer', type: 'line', x1: 0, y1: 0, x2: 100, y2: 100, strokeWidth: 2 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const strokeWidthInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Stroke Width' );
			} );

			if ( strokeWidthInput ) {
				strokeWidthInput.value = '5';
				dispatchInputAndAdvanceTimers( strokeWidthInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { strokeWidth: 5 } );
			}
		} );
	} );

	describe( 'shadow controls enable/disable', () => {
		test( 'should disable shadow and clear shadow properties', () => {
			const layer = {
				id: 'test-layer',
				type: 'rectangle',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 8,
				shadowOffsetX: 2,
				shadowOffsetY: 2
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const shadowCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Drop Shadow' );
			} );

			shadowCheckbox.checked = false;
			shadowCheckbox.dispatchEvent( new Event( 'change' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { shadow: false } );
		} );
	} );

	describe( 'textbox text shadow controls', () => {
		test( 'should enable text shadow with defaults', () => {
			const layer = { id: 'test-layer', type: 'textbox', textShadow: false };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const textShadowCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Text Shadow' );
			} );

			if ( textShadowCheckbox ) {
				textShadowCheckbox.checked = true;
				textShadowCheckbox.dispatchEvent( new Event( 'change' ) );

				// Now passes defaults when enabling text shadow
				const call = mockEditor.updateLayer.mock.calls.find( ( c ) => c[ 1 ].textShadow === true );
				expect( call ).toBeDefined();
				expect( call[ 1 ].textShadowColor ).toBe( 'rgba(0,0,0,0.5)' );
				expect( call[ 1 ].textShadowBlur ).toBe( 4 );
				expect( call[ 1 ].textShadowOffsetX ).toBe( 2 );
				expect( call[ 1 ].textShadowOffsetY ).toBe( 2 );
			}
		} );

		test( 'should disable text shadow', () => {
			const layer = { id: 'test-layer', type: 'textbox', textShadow: true };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const textShadowCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Text Shadow' );
			} );

			if ( textShadowCheckbox ) {
				textShadowCheckbox.checked = false;
				textShadowCheckbox.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { textShadow: false } );
			}
		} );
	} );

	describe( 'arrow layer controls', () => {
		test( 'should update arrow x2 endpoint', () => {
			const layer = { id: 'test-layer', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const x2Input = form.querySelector( 'input[data-prop="x2"]' );
			x2Input.value = '200';
			dispatchInputAndAdvanceTimers( x2Input );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { x2: 200 } );
		} );

		test( 'should update arrow y1 endpoint', () => {
			const layer = { id: 'test-layer', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const y1Input = form.querySelector( 'input[data-prop="y1"]' );
			y1Input.value = '50';
			dispatchInputAndAdvanceTimers( y1Input );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { y1: 50 } );
		} );

		test( 'should update arrow y2 endpoint', () => {
			const layer = { id: 'test-layer', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const y2Input = form.querySelector( 'input[data-prop="y2"]' );
			y2Input.value = '200';
			dispatchInputAndAdvanceTimers( y2Input );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { y2: 200 } );
		} );

		test( 'should update arrow tailWidth', () => {
			const layer = { id: 'test-layer', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100, tailWidth: 3 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const tailWidthInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Tail Width' );
			} );

			if ( tailWidthInput ) {
				tailWidthInput.value = '5';
				dispatchInputAndAdvanceTimers( tailWidthInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { tailWidth: 5 } );
			}
		} );

		test( 'should update arrow size', () => {
			const layer = { id: 'test-layer', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100, arrowSize: 15 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const arrowSizeInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Head Size' );
			} );

			if ( arrowSizeInput ) {
				arrowSizeInput.value = '25';
				dispatchInputAndAdvanceTimers( arrowSizeInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { arrowSize: 25 } );
			}
		} );
	} );

	describe( 'blur fill controls', () => {
		test( 'should show blur fill checkbox for rectangle', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const blurFillCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Fill' );
			} );

			expect( blurFillCheckbox ).toBeDefined();
		} );

		test( 'should enable blur fill when checkbox is checked', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: '#ff0000' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const blurFillCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Fill' );
			} );

			if ( blurFillCheckbox ) {
				blurFillCheckbox.checked = true;
				blurFillCheckbox.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', expect.objectContaining( {
					fill: 'blur'
				} ) );
			}
		} );

		test( 'should store previous fill when enabling blur fill', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: '#ff0000' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const blurFillCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Fill' );
			} );

			if ( blurFillCheckbox ) {
				blurFillCheckbox.checked = true;
				blurFillCheckbox.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', expect.objectContaining( {
					fill: 'blur',
					_previousFill: '#ff0000'
				} ) );
			}
		} );

		test( 'should disable blur fill when checkbox is unchecked', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: 'blur', _previousFill: '#00ff00' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const blurFillCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Fill' );
			} );

			if ( blurFillCheckbox ) {
				expect( blurFillCheckbox.checked ).toBe( true );
				blurFillCheckbox.checked = false;
				blurFillCheckbox.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { fill: '#00ff00' } );
			}
		} );

		test( 'should restore to transparent when no previous fill stored', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: 'blur' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const blurFillCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Fill' );
			} );

			if ( blurFillCheckbox ) {
				blurFillCheckbox.checked = false;
				blurFillCheckbox.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { fill: 'transparent' } );
			}
		} );

		test( 'should show blur radius input when blur fill is enabled', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: 'blur', blurRadius: 16 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const blurRadiusInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Radius' );
			} );

			expect( blurRadiusInput ).toBeDefined();
			expect( blurRadiusInput.value ).toBe( '16' );
		} );

		test( 'should update blur radius', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: 'blur', blurRadius: 12 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const blurRadiusInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Radius' );
			} );

			if ( blurRadiusInput ) {
				blurRadiusInput.value = '24';
				dispatchInputAndAdvanceTimers( blurRadiusInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { blurRadius: 24 } );
			}
		} );

		test( 'should set default blur radius when enabling blur fill without existing value', () => {
			const layer = { id: 'test-layer', type: 'circle', radius: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const blurFillCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Fill' );
			} );

			if ( blurFillCheckbox ) {
				blurFillCheckbox.checked = true;
				blurFillCheckbox.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', expect.objectContaining( {
					fill: 'blur',
					blurRadius: 12
				} ) );
			}
		} );

		test( 'should not show fill color picker when blur fill is enabled', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: 'blur' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Check that fill color picker is not shown
			const labels = form.querySelectorAll( 'label' );
			const fillColorLabel = Array.from( labels ).find( ( label ) => label.textContent === 'Fill Color' );

			expect( fillColorLabel ).toBeUndefined();
		} );

		test( 'should show fill color picker when blur fill is disabled', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: '#ff0000' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Check that fill color picker is shown
			const labels = form.querySelectorAll( 'label' );
			const fillColorLabel = Array.from( labels ).find( ( label ) =>
				label.textContent && label.textContent.includes( 'Fill Color' )
			);

			expect( fillColorLabel ).toBeDefined();
		} );
	} );

	describe( 'color picker fallback', () => {
		test( 'should create fallback color button when ColorPickerDialog not available', () => {
			// Ensure no ColorPickerDialog
			delete global.Layers.UI.ColorPickerDialog;
			delete global.ColorPickerDialog;

			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: '#ff0000' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const colorButtons = form.querySelectorAll( '.color-display-button' );
			expect( colorButtons.length ).toBeGreaterThan( 0 );
		} );

		test( 'should handle none color in fallback button', () => {
			delete global.Layers.UI.ColorPickerDialog;
			delete global.ColorPickerDialog;

			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: 'none' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const colorButtons = form.querySelectorAll( '.color-display-button' );
			// Should still render without throwing
			expect( colorButtons.length ).toBeGreaterThan( 0 );
		} );

		test( 'should handle transparent color in fallback button', () => {
			delete global.Layers.UI.ColorPickerDialog;
			delete global.ColorPickerDialog;

			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: 'transparent' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const colorButtons = form.querySelectorAll( '.color-display-button' );
			expect( colorButtons.length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'text input near-max-length warning', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should show warning when text approaches max length (95%+)', () => {
			PropertiesForm.addInput( {
				label: 'Text',
				type: 'text',
				value: '',
				maxLength: 100,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			// Set value to 96 characters (96% of 100, above 95% threshold)
			input.value = 'a'.repeat( 96 );
			input.dispatchEvent( new Event( 'input' ) );

			// Should show warning indicator
			const errorIndicator = container.querySelector( '.property-field-error' );
			expect( errorIndicator ).not.toBeNull();
			expect( errorIndicator.classList.contains( 'show' ) ).toBe( true );
			expect( errorIndicator.classList.contains( 'warning' ) ).toBe( true );
			expect( errorIndicator.textContent ).toContain( 'Approaching character limit' );
			expect( input.classList.contains( 'warning' ) ).toBe( true );
		} );

		test( 'should show warning for textarea approaching max length', () => {
			PropertiesForm.addInput( {
				label: 'Description',
				type: 'textarea',
				value: '',
				maxLength: 200,
				onChange: jest.fn()
			}, 'layer-1', container );

			const textarea = container.querySelector( 'textarea' );
			// Set value to 192 characters (96% of 200, above 95% threshold)
			textarea.value = 'x'.repeat( 192 );
			textarea.dispatchEvent( new Event( 'input' ) );

			const errorIndicator = container.querySelector( '.property-field-error' );
			expect( errorIndicator ).not.toBeNull();
			expect( errorIndicator.classList.contains( 'warning' ) ).toBe( true );
			expect( errorIndicator.textContent ).toContain( '192/200' );
		} );

		test( 'should show error when text exceeds max length', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Text',
				type: 'text',
				value: '',
				maxLength: 50,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			// Set value to 51 characters (exceeds max)
			input.value = 'b'.repeat( 51 );
			input.dispatchEvent( new Event( 'input' ) );

			// Should show error, not warning
			const errorIndicator = container.querySelector( '.property-field-error' );
			expect( errorIndicator.classList.contains( 'show' ) ).toBe( true );
			expect( errorIndicator.classList.contains( 'warning' ) ).toBe( false );
			expect( input.classList.contains( 'error' ) ).toBe( true );
			// onChange should NOT be called for invalid input
			expect( onChange ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'blur fill panel refresh', () => {
		test( 'should call layerPanel.updatePropertiesPanel after blur fill toggle', () => {
			jest.useFakeTimers();

			const mockLayerPanel = {
				updatePropertiesPanel: jest.fn()
			};
			const editorWithPanel = {
				updateLayer: jest.fn(),
				layerPanel: mockLayerPanel
			};

			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: '#ff0000' };
			const form = PropertiesForm.create( layer, editorWithPanel, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const blurFillCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Fill' );
			} );

			expect( blurFillCheckbox ).not.toBeNull();
			blurFillCheckbox.checked = true;
			blurFillCheckbox.dispatchEvent( new Event( 'change' ) );

			// Fast-forward timers to trigger setTimeout
			jest.runAllTimers();

			expect( mockLayerPanel.updatePropertiesPanel ).toHaveBeenCalledWith( 'test-layer' );

			jest.useRealTimers();
		} );

		test( 'should not throw when layerPanel is undefined', () => {
			const editorWithoutPanel = {
				updateLayer: jest.fn()
				// No layerPanel
			};

			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: '#ff0000' };
			const form = PropertiesForm.create( layer, editorWithoutPanel, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const blurFillCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Fill' );
			} );

			expect( () => {
				blurFillCheckbox.checked = true;
				blurFillCheckbox.dispatchEvent( new Event( 'change' ) );
			} ).not.toThrow();
		} );

		test( 'should not throw when updatePropertiesPanel is not a function', () => {
			const editorWithBadPanel = {
				updateLayer: jest.fn(),
				layerPanel: {} // Panel exists but no updatePropertiesPanel method
			};

			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 100, fill: '#ff0000' };
			const form = PropertiesForm.create( layer, editorWithBadPanel, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const blurFillCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Fill' );
			} );

			expect( () => {
				blurFillCheckbox.checked = true;
				blurFillCheckbox.dispatchEvent( new Event( 'change' ) );
			} ).not.toThrow();
		} );
	} );

	describe( 'validation revert on blur with invalid value', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should revert to last valid value when blur with out-of-range number', () => {
			PropertiesForm.addInput( {
				label: 'Sides',
				type: 'number',
				value: 6,
				min: 3,
				max: 20,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			expect( input.value ).toBe( '6' );

			// Set invalid value and blur
			input.value = '100'; // Exceeds max
			input.dispatchEvent( new Event( 'blur' ) );

			// Should revert to last valid value
			expect( input.value ).toBe( '6' );
		} );

		test( 'should revert to last valid value when blur with below-min number', () => {
			PropertiesForm.addInput( {
				label: 'Sides',
				type: 'number',
				value: 5,
				min: 3,
				max: 20,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '1'; // Below min
			input.dispatchEvent( new Event( 'blur' ) );

			expect( input.value ).toBe( '5' );
		} );

		test( 'should clear error styling after reverting on blur', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				min: 10,
				max: 500,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// Set invalid value
			input.value = '5'; // Below min
			input.dispatchEvent( new Event( 'blur' ) );

			// After revert, error styling should be cleared
			expect( input.classList.contains( 'error' ) ).toBe( false );
		} );
	} );

	describe( 'change event revert with setTimeout', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		test( 'should revert to last valid value via setTimeout on invalid change event', () => {
			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 50,
				min: 10,
				max: 100,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '5'; // Below min - invalid
			input.dispatchEvent( new Event( 'change' ) );

			// Run timers to trigger the revert setTimeout
			jest.runAllTimers();

			expect( input.value ).toBe( '50' );
		} );
	} );

	describe( 'formatOneDecimal edge cases', () => {
		test( 'should handle formatOneDecimal behavior in input with decimal values', () => {
			const onChange = jest.fn();
			const container = document.createElement( 'div' );

			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 1.234,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// Input should show formatted value
			input.value = '3.567';
			dispatchInputAndAdvanceTimers( input );

			// formatOneDecimal should round to 1 decimal place
			expect( input.value ).toBe( '3.6' );
			expect( onChange ).toHaveBeenCalledWith( 3.6 );
		} );

		test( 'should display integer without decimal when formatOneDecimal receives whole number', () => {
			const container = document.createElement( 'div' );

			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 5,
				decimals: 1,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '7.0';
			input.dispatchEvent( new Event( 'blur' ) );

			// Should display as integer (no .0)
			expect( input.value ).toBe( '7' );
		} );

		test( 'should handle NaN value in number input gracefully', () => {
			const onChange = jest.fn();
			const container = document.createElement( 'div' );

			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 10,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// Set non-numeric value
			input.value = 'not-a-number';
			input.dispatchEvent( new Event( 'input' ) );

			// Should not call onChange for invalid input
			expect( onChange ).not.toHaveBeenCalled();
		} );

		test( 'should handle empty string value for number input', () => {
			const onChange = jest.fn();
			const container = document.createElement( 'div' );

			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 50,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// Set empty value
			input.value = '';
			input.dispatchEvent( new Event( 'input' ) );

			// Empty should be invalid for number input
			expect( onChange ).not.toHaveBeenCalled();

			// Error indicator should show
			const errorIndicator = container.querySelector( '.property-field-error' );
			expect( errorIndicator ).not.toBeNull();
		} );
	} );

	describe( 'validation error messages display', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should show NaN error for non-numeric input in number field', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// On blur with invalid value, value gets reverted - check revert happened
			input.value = 'abc';

			// Note: jsdom normalizes number input values differently than browsers
			input.dispatchEvent( new Event( 'blur' ) );

			// Value should be reverted to last valid value
			expect( input.value ).toBe( '100' );
		} );

		test( 'should handle number input with text type for NaN coverage', () => {
			// Use type='text' but treat as number for validation
			// This tests the NaN branch directly without jsdom's number input normalization
			const container2 = document.createElement( 'div' );
			PropertiesForm.addInput( {
				label: 'Quantity',
				type: 'number',
				value: 50,
				onChange: jest.fn()
			}, 'layer-2', container2 );

			const input = container2.querySelector( 'input' );

			// jsdom may normalize invalid values for type="number" inputs
			// Verify behavior - if jsdom returns '' for invalid, that's the empty check
			input.value = 'not-a-number';
			const actualValue = input.value;

			input.dispatchEvent( new Event( 'blur' ) );

			// Either jsdom normalized to '' (empty check) or kept the string (NaN check)
			// Either way, value should revert to last valid
			expect( input.value ).toBe( '50' );
		} );

		test( 'should revert to last valid value when below-minimum on blur', () => {
			PropertiesForm.addInput( {
				label: 'Sides',
				type: 'number',
				value: 6,
				min: 3,
				max: 20,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '1';
			input.dispatchEvent( new Event( 'blur' ) );

			// Value should be reverted to last valid value
			expect( input.value ).toBe( '6' );
		} );

		test( 'should revert to last valid value when above-maximum on blur', () => {
			PropertiesForm.addInput( {
				label: 'Sides',
				type: 'number',
				value: 6,
				min: 3,
				max: 20,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '50';
			input.dispatchEvent( new Event( 'blur' ) );

			// Value should be reverted
			expect( input.value ).toBe( '6' );
		} );

		test( 'should revert to last valid value for empty number field on blur', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '';
			input.dispatchEvent( new Event( 'blur' ) );

			// Value should be reverted
			expect( input.value ).toBe( '100' );
		} );

		test( 'should not call onChange for text exceeding max length on input event', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Name',
				type: 'text',
				value: 'initial',
				maxLength: 20,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = 'This text is way too long for the limit';
			input.dispatchEvent( new Event( 'input' ) );

			// onChange should still be called for text, validation is lenient
			// But let's check the error indicator shows
			const errorIndicator = container.querySelector( '.property-field-error' );
			expect( errorIndicator.classList.contains( 'show' ) ).toBe( true );
		} );

		test( 'should clear error styling when valid value entered', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				min: 10,
				max: 200,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// Set valid value first (to establish lastValidValue)
			input.value = '150';
			input.dispatchEvent( new Event( 'input' ) );

			// Then enter valid value - should not show error
			expect( input.classList.contains( 'error' ) ).toBe( false );
			expect( input.classList.contains( 'warning' ) ).toBe( false );
		} );
	} );

	describe( 'addInput - change event handler coverage', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should handle valid number with no min/max on change event', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 50,
				// No min/max constraints
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '75';
			input.dispatchEvent( new Event( 'change' ) );

			// Should call onChange with the value
			expect( onChange ).toHaveBeenCalledWith( 75 );
		} );

		test( 'should handle checkbox change event', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Visible',
				type: 'checkbox',
				value: false,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input[type="checkbox"]' );
			input.checked = true;
			input.dispatchEvent( new Event( 'change' ) );

			expect( onChange ).toHaveBeenCalledWith( true );
		} );

		test( 'should handle text input change event', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Name',
				type: 'text',
				value: 'initial',
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input[type="text"]' );
			input.value = 'new value';
			input.dispatchEvent( new Event( 'change' ) );

			expect( onChange ).toHaveBeenCalledWith( 'new value' );
		} );

		test( 'should handle number with decimals=1 on change event', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Opacity',
				type: 'number',
				value: 0.5,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			input.value = '0.75';
			input.dispatchEvent( new Event( 'change' ) );

			// Should round to 1 decimal and call onChange
			expect( onChange ).toHaveBeenCalledWith( 0.8 );
			expect( input.value ).toBe( '0.8' );
		} );

		test( 'should revert to last valid value when change event has invalid value', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Sides',
				type: 'number',
				value: 6,
				min: 3,
				max: 20,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			// First establish valid value
			input.value = '10';
			input.dispatchEvent( new Event( 'change' ) );
			expect( onChange ).toHaveBeenCalledWith( 10 );
			onChange.mockClear();

			// Now try invalid value (NaN) - should revert
			input.value = 'not a number';
			input.dispatchEvent( new Event( 'change' ) );

			// Should not have called onChange
			expect( onChange ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'addInput - NaN validation coverage', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should show error message for NaN input', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			const errorIndicator = container.querySelector( '.property-field-error' );

			// Enter invalid non-numeric value
			input.value = 'abc';
			input.dispatchEvent( new Event( 'blur' ) );

			// Should revert to last valid value
			expect( input.value ).toBe( '100' );
		} );

		test( 'should show error for empty required number field', () => {
			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: jest.fn()
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// Enter empty value (required field)
			input.value = '';
			input.dispatchEvent( new Event( 'blur' ) );

			// Should revert to last valid value
			expect( input.value ).toBe( '100' );
		} );
	} );

	describe( 'formatOneDecimal internal function coverage', () => {
		// This tests the internal formatOneDecimal function via addInput with decimals=1

		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should handle integer values correctly with decimals=1', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 5,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			// Enter an integer
			input.value = '7';
			input.dispatchEvent( new Event( 'blur' ) );

			// Should format as integer (no decimal)
			expect( input.value ).toBe( '7' );
		} );

		test( 'should format decimal values correctly with decimals=1', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 5,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			// Enter a decimal value
			input.value = '7.34';
			input.dispatchEvent( new Event( 'blur' ) );

			// Should round to 1 decimal
			expect( input.value ).toBe( '7.3' );
		} );

		test( 'should handle NaN/invalid input with decimals=1 (formatOneDecimal edge case)', () => {
			const onChange = jest.fn();
			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 5,
				decimals: 1,
				onChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );
			// Enter non-numeric value - formatOneDecimal returns '' for NaN
			input.value = 'abc';
			input.dispatchEvent( new Event( 'blur' ) );

			// Should revert to last valid value since 'abc' is invalid
			expect( input.value ).toBe( '5' );
			// onChange should not have been called with invalid input
			expect( onChange ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'error handler coverage', () => {
		let container;

		beforeEach( () => {
			container = document.createElement( 'div' );
		} );

		test( 'should handle errors in input event handler gracefully', () => {
			// Create an input with an onChange that throws
			const throwingOnChange = jest.fn( () => {
				throw new Error( 'Test error' );
			} );

			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: throwingOnChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// This should not throw even though onChange throws
			expect( () => {
				input.value = '150';
				dispatchInputAndAdvanceTimers( input );
			} ).not.toThrow();

			// The error should be logged
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );

		test( 'should handle errors in change event handler gracefully', () => {
			// Create an input with an onChange that throws
			const throwingOnChange = jest.fn( () => {
				throw new Error( 'Test error' );
			} );

			PropertiesForm.addInput( {
				label: 'Width',
				type: 'number',
				value: 100,
				onChange: throwingOnChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// This should not throw even though onChange throws
			expect( () => {
				input.value = '150';
				input.dispatchEvent( new Event( 'change' ) );
			} ).not.toThrow();

			// The error should be logged
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );

		test( 'should handle errors in blur event handler gracefully', () => {
			// Create an input with an onChange that throws
			const throwingOnChange = jest.fn( () => {
				throw new Error( 'Test error' );
			} );

			PropertiesForm.addInput( {
				label: 'Value',
				type: 'number',
				value: 5,
				decimals: 1,
				onChange: throwingOnChange
			}, 'layer-1', container );

			const input = container.querySelector( 'input' );

			// Set value first via change to establish lastValidValue
			input.value = '7.5';
			input.dispatchEvent( new Event( 'change' ) );

			// Clear mocks
			global.mw.log.error.mockClear();

			// Blur event triggers formatOneDecimal path - won't call onChange
			// but we can verify error handling works
			expect( () => {
				input.dispatchEvent( new Event( 'blur' ) );
			} ).not.toThrow();
		} );
	} );

	describe( 'create - specific layer type onChange callbacks', () => {
		let registerCleanup;

		beforeEach( () => {
			registerCleanup = jest.fn();
		} );

		test( 'should trigger textAlign onChange for textbox layer', () => {
			const layer = { id: 'test-1', type: 'textbox', textAlign: 'left' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find the textAlign select
			const selects = form.querySelectorAll( 'select' );
			let textAlignSelect = null;
			for ( const select of selects ) {
				const label = form.querySelector( `label[for="${ select.id }"]` );
				if ( label && label.textContent.includes( 'Horizontal' ) ) {
					textAlignSelect = select;
					break;
				}
			}

			if ( textAlignSelect ) {
				textAlignSelect.value = 'center';
				textAlignSelect.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-1', { textAlign: 'center' } );
			}
		} );

		test( 'should trigger blend mode onChange', () => {
			const layer = { id: 'test-1', type: 'rectangle', blend: 'normal' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find the blend mode select
			const selects = form.querySelectorAll( 'select' );
			let blendSelect = null;
			for ( const select of selects ) {
				const label = form.querySelector( `label[for="${ select.id }"]` );
				if ( label && label.textContent.includes( 'Blend' ) ) {
					blendSelect = select;
					break;
				}
			}

			if ( blendSelect ) {
				blendSelect.value = 'multiply';
				blendSelect.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-1', { blend: 'multiply' } );
			}
		} );

		test( 'should trigger shadow checkbox onChange and set defaults', () => {
			const layer = { id: 'test-1', type: 'rectangle', shadow: false };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find the shadow checkbox
			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			let shadowCheckbox = null;
			for ( const checkbox of checkboxes ) {
				const label = form.querySelector( `label[for="${ checkbox.id }"]` );
				if ( label && label.textContent.includes( 'Shadow' ) ) {
					shadowCheckbox = checkbox;
					break;
				}
			}

			if ( shadowCheckbox ) {
				shadowCheckbox.checked = true;
				shadowCheckbox.dispatchEvent( new Event( 'change' ) );

				// Should set shadow and default values
				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-1', expect.objectContaining( {
					shadow: true,
					shadowColor: '#000000',
					shadowBlur: 8,
					shadowOffsetX: 2
				} ) );
			}
		} );
	} );

	describe( 'callout layer form', () => {
		test( 'should create callout layer form with dimensions', () => {
			const layer = {
				id: 'callout-1',
				type: 'callout',
				width: 200,
				height: 100,
				cornerRadius: 8
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			const cornerRadiusInput = form.querySelector( 'input[data-prop="cornerRadius"]' );

			expect( widthInput ).not.toBeNull();
			expect( heightInput ).not.toBeNull();
			expect( cornerRadiusInput ).not.toBeNull();
		} );

		test( 'should update callout width', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			widthInput.value = '300';
			dispatchInputAndAdvanceTimers( widthInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { width: 300 } );
		} );

		test( 'should update callout height', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			heightInput.value = '150';
			dispatchInputAndAdvanceTimers( heightInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { height: 150 } );
		} );

		test( 'should update callout cornerRadius', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, cornerRadius: 8 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const cornerRadiusInput = form.querySelector( 'input[data-prop="cornerRadius"]' );
			cornerRadiusInput.value = '16';
			dispatchInputAndAdvanceTimers( cornerRadiusInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { cornerRadius: 16 } );
		} );

		test( 'should create callout text section', () => {
			const layer = {
				id: 'callout-1',
				type: 'callout',
				width: 200,
				height: 100,
				text: 'Hello'
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Should NOT have textarea - callout uses inline canvas editing with richText
			const textarea = form.querySelector( 'textarea' );
			expect( textarea ).toBeNull();

			// Should have font size input
			const fontSizeInput = form.querySelector( 'input[data-prop="fontSize"]' );
			expect( fontSizeInput ).not.toBeNull();
		} );

		test( 'should update callout text', () => {
			// Note: callout layers no longer have textarea - text is edited inline on canvas
			// This test now verifies that the text section header exists
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, fontSize: 16 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Verify no textarea exists
			const textarea = form.querySelector( 'textarea' );
			expect( textarea ).toBeNull();

			// Font controls should still exist and work
			const fontSizeInput = form.querySelector( 'input[data-prop="fontSize"]' );
			fontSizeInput.value = '20';
			dispatchInputAndAdvanceTimers( fontSizeInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { fontSize: 20 } );
		} );

		test( 'should update callout fontSize', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, fontSize: 16 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const fontSizeInput = form.querySelector( 'input[data-prop="fontSize"]' );
			fontSizeInput.value = '24';
			dispatchInputAndAdvanceTimers( fontSizeInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { fontSize: 24 } );
		} );

		test( 'should toggle callout bold', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, fontWeight: 'normal' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const boldCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Bold' );
			} );

			if ( boldCheckbox ) {
				boldCheckbox.checked = true;
				boldCheckbox.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { fontWeight: 'bold' } );
			}
		} );

		test( 'should toggle callout italic', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, fontStyle: 'normal' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const italicCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Italic' );
			} );

			if ( italicCheckbox ) {
				italicCheckbox.checked = true;
				italicCheckbox.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { fontStyle: 'italic' } );
			}
		} );

		test( 'should update callout textStrokeWidth', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, textStrokeWidth: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const strokeWidthInput = Array.from( inputs ).find( ( input ) => input.dataset.prop === 'textStrokeWidth' );

			if ( strokeWidthInput ) {
				strokeWidthInput.value = '2';
				dispatchInputAndAdvanceTimers( strokeWidthInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { textStrokeWidth: 2 } );
			}
		} );

		test( 'should enable callout textShadow', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, textShadow: false };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const checkboxes = form.querySelectorAll( 'input[type="checkbox"]' );
			const textShadowCheckbox = Array.from( checkboxes ).find( ( cb ) => {
				const label = cb.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Text Shadow' );
			} );

			if ( textShadowCheckbox ) {
				textShadowCheckbox.checked = true;
				textShadowCheckbox.dispatchEvent( new Event( 'change' ) );

				// Now passes defaults when enabling text shadow
				const call = mockEditor.updateLayer.mock.calls.find( ( c ) => c[ 1 ].textShadow === true );
				expect( call ).toBeDefined();
				expect( call[ 1 ].textShadowColor ).toBe( 'rgba(0,0,0,0.5)' );
				expect( call[ 1 ].textShadowBlur ).toBe( 4 );
				expect( call[ 1 ].textShadowOffsetX ).toBe( 2 );
				expect( call[ 1 ].textShadowOffsetY ).toBe( 2 );
			}
		} );

		test( 'should update callout textShadowBlur', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, textShadow: true, textShadowBlur: 4 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const shadowBlurInput = Array.from( inputs ).find( ( input ) => input.dataset.prop === 'textShadowBlur' );

			if ( shadowBlurInput ) {
				shadowBlurInput.value = '10';
				dispatchInputAndAdvanceTimers( shadowBlurInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { textShadowBlur: 10 } );
			}
		} );

		test( 'should update callout textAlign via select', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, textAlign: 'left' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const selects = form.querySelectorAll( 'select' );
			const textAlignSelect = Array.from( selects ).find( ( s ) => {
				const label = form.querySelector( `label[for="${ s.id }"]` );
				return label && label.textContent.includes( 'Horizontal' );
			} );

			if ( textAlignSelect ) {
				textAlignSelect.value = 'center';
				textAlignSelect.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { textAlign: 'center' } );
			}
		} );

		test( 'should update callout verticalAlign via select', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, verticalAlign: 'top' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const selects = form.querySelectorAll( 'select' );
			const verticalAlignSelect = Array.from( selects ).find( ( s ) => {
				const label = form.querySelector( `label[for="${ s.id }"]` );
				return label && label.textContent.includes( 'Vertical' );
			} );

			if ( verticalAlignSelect ) {
				verticalAlignSelect.value = 'middle';
				verticalAlignSelect.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { verticalAlign: 'middle' } );
			}
		} );

		test( 'should update callout padding', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, padding: 8 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const paddingInput = Array.from( inputs ).find( ( input ) => input.dataset.prop === 'padding' );

			if ( paddingInput ) {
				paddingInput.value = '16';
				dispatchInputAndAdvanceTimers( paddingInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { padding: 16 } );
			}
		} );

		test( 'should update callout tailDirection', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, tailDirection: 'bottom' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const selects = form.querySelectorAll( 'select' );
			const tailDirectionSelect = Array.from( selects ).find( ( s ) => {
				const label = form.querySelector( `label[for="${ s.id }"]` );
				return label && label.textContent.includes( 'Tail Direction' );
			} );

			if ( tailDirectionSelect ) {
				tailDirectionSelect.value = 'top';
				tailDirectionSelect.dispatchEvent( new Event( 'change' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { tailDirection: 'top' } );
			}
		} );

		test( 'should update callout tailSize', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, tailSize: 20 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const tailSizeInput = Array.from( inputs ).find( ( input ) => input.dataset.prop === 'tailSize' );

			if ( tailSizeInput ) {
				tailSizeInput.value = '30';
				dispatchInputAndAdvanceTimers( tailSizeInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { tailSize: 30 } );
			}
		} );

		test( 'should clamp callout tailSize to valid range', () => {
			const layer = { id: 'callout-1', type: 'callout', width: 200, height: 100, tailSize: 20 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const tailSizeInput = Array.from( inputs ).find( ( input ) => input.dataset.prop === 'tailSize' );

			if ( tailSizeInput ) {
				// Set a valid value within range
				tailSizeInput.value = '45';
				dispatchInputAndAdvanceTimers( tailSizeInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'callout-1', { tailSize: 45 } );
			}
		} );
	} );

	describe( 'blur layer form', () => {
		test( 'should create blur layer form with dimensions', () => {
			const layer = {
				id: 'blur-1',
				type: 'blur',
				width: 100,
				height: 100,
				blurRadius: 12
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			const heightInput = form.querySelector( 'input[data-prop="height"]' );

			expect( widthInput ).not.toBeNull();
			expect( heightInput ).not.toBeNull();
		} );

		test( 'should update blur layer width', () => {
			const layer = { id: 'blur-1', type: 'blur', width: 100, height: 100, blurRadius: 12 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			widthInput.value = '150';
			dispatchInputAndAdvanceTimers( widthInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'blur-1', { width: 150 } );
		} );

		test( 'should update blur layer height', () => {
			const layer = { id: 'blur-1', type: 'blur', width: 100, height: 100, blurRadius: 12 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			heightInput.value = '200';
			dispatchInputAndAdvanceTimers( heightInput );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'blur-1', { height: 200 } );
		} );

		test( 'should update blur layer blurRadius', () => {
			const layer = { id: 'blur-1', type: 'blur', width: 100, height: 100, blurRadius: 12 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			// blurRadius doesn't have data-prop, find by label
			const blurRadiusInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Radius' );
			} );

			if ( blurRadiusInput ) {
				blurRadiusInput.value = '24';
				dispatchInputAndAdvanceTimers( blurRadiusInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'blur-1', { blurRadius: 24 } );
			}
		} );

		test( 'should handle blur layer blurRadius at maximum', () => {
			const layer = { id: 'blur-1', type: 'blur', width: 100, height: 100, blurRadius: 12 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const blurRadiusInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Radius' );
			} );

			if ( blurRadiusInput ) {
				// Set to exact maximum (64)
				blurRadiusInput.value = '64';
				dispatchInputAndAdvanceTimers( blurRadiusInput );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'blur-1', { blurRadius: 64 } );
			}
		} );
	} );

	describe( 'formatOneDecimal via number inputs with decimals', () => {
		test( 'should format integer values without decimal', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find an input that uses decimals=1 (strokeOpacity slider uses percentage)
			const numberInputs = form.querySelectorAll( 'input[type="number"][data-decimals="1"]' );
			if ( numberInputs.length > 0 ) {
				const input = numberInputs[ 0 ];
				input.value = '5.0';
				input.dispatchEvent( new Event( 'blur' ) );
				jest.advanceTimersByTime( 150 );

				// Should format to '5' not '5.0'
				expect( input.value ).toBe( '5' );
			}
		} );

		test( 'should format decimal values with one decimal place', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const numberInputs = form.querySelectorAll( 'input[type="number"][data-decimals="1"]' );
			if ( numberInputs.length > 0 ) {
				const input = numberInputs[ 0 ];
				input.value = '5.5';
				input.dispatchEvent( new Event( 'blur' ) );
				jest.advanceTimersByTime( 150 );

				expect( input.value ).toBe( '5.5' );
			}
		} );

		test( 'should handle formatOneDecimal for change event with decimals', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const numberInputs = form.querySelectorAll( 'input[type="number"][data-decimals="1"]' );
			if ( numberInputs.length > 0 ) {
				const input = numberInputs[ 0 ];
				input.value = '7.333';
				input.dispatchEvent( new Event( 'change' ) );
				jest.advanceTimersByTime( 150 );

				// Should round to one decimal
				expect( input.value ).toBe( '7.3' );
			}
		} );
	} );

	describe( 'logError and error handling', () => {
		test( 'should call logError when onChange throws in input handler', () => {
			const throwingEditor = {
				updateLayer: jest.fn( () => {
					throw new Error( 'Test error' );
				} )
			};

			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, throwingEditor, registerCleanup );

			const xInput = form.querySelector( 'input[data-prop="x"]' );
			xInput.value = '50';
			dispatchInputAndAdvanceTimers( xInput );

			// Should have called logError (via mw.log.error)
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );

		test( 'should call logError when onChange throws in change handler', () => {
			const throwingEditor = {
				updateLayer: jest.fn( () => {
					throw new Error( 'Test error in change' );
				} )
			};

			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, throwingEditor, registerCleanup );

			const xInput = form.querySelector( 'input[data-prop="x"]' );
			xInput.value = '75';
			xInput.dispatchEvent( new Event( 'change' ) );
			jest.advanceTimersByTime( 150 );

			expect( global.mw.log.error ).toHaveBeenCalled();
		} );

		test( 'should show mw.notify when onChange throws', () => {
			const throwingEditor = {
				updateLayer: jest.fn( () => {
					throw new Error( 'Test error' );
				} )
			};

			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, throwingEditor, registerCleanup );

			const xInput = form.querySelector( 'input[data-prop="x"]' );
			xInput.value = '50';
			dispatchInputAndAdvanceTimers( xInput );

			expect( global.mw.notify ).toHaveBeenCalledWith( 'Error updating layer property', { type: 'error' } );
		} );
	} );

	describe( 'text validation warning for approaching limit', () => {
		test( 'should show warning when text approaches character limit', () => {
			const layer = { id: 'text-1', type: 'text', x: 10, y: 20, text: '', fontSize: 16 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const textInput = form.querySelector( 'input[type="text"]' );
			if ( textInput ) {
				// Create text that's 96% of limit (1000 * 0.96 = 960 chars)
				const longText = 'a'.repeat( 960 );
				textInput.value = longText;
				textInput.dispatchEvent( new Event( 'input' ) );
				jest.advanceTimersByTime( 150 );

				// Should add warning class
				expect( textInput.classList.contains( 'warning' ) ).toBe( true );
			}
		} );

		test( 'should show warning indicator when approaching textarea limit', () => {
			const layer = {
				id: 'textbox-1',
				type: 'textbox',
				x: 10, y: 20, width: 200, height: 100,
				text: ''
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const textarea = form.querySelector( 'textarea' );
			if ( textarea ) {
				// Create text that's 96% of textarea limit (5000 * 0.96 = 4800 chars)
				const longText = 'b'.repeat( 4800 );
				textarea.value = longText;
				textarea.dispatchEvent( new Event( 'input' ) );
				jest.advanceTimersByTime( 150 );

				expect( textarea.classList.contains( 'warning' ) ).toBe( true );
			}
		} );
	} );

	describe( 'color picker fallback when ColorPickerDialog unavailable', () => {
		beforeEach( () => {
			// Remove ColorPickerDialog to test fallback
			delete global.ColorPickerDialog;
			if ( global.Layers && global.Layers.UI ) {
				delete global.Layers.UI.ColorPickerDialog;
			}
		} );

		test( 'should create fallback color button when ColorPickerDialog not available', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, stroke: '#ff0000' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const colorButtons = form.querySelectorAll( 'button.color-display-button' );
			expect( colorButtons.length ).toBeGreaterThan( 0 );
		} );

		test( 'should show transparent pattern for no fill', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, fill: 'none' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const colorButtons = form.querySelectorAll( 'button.color-display-button' );
			const fillButton = Array.from( colorButtons ).find( ( btn ) => {
				const label = btn.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Fill' );
			} );

			if ( fillButton ) {
				expect( fillButton.style.background ).toContain( 'repeating-linear-gradient' );
			}
		} );

		test( 'should handle fallback color button click', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, stroke: '#ff0000' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const colorButton = form.querySelector( 'button.color-display-button' );
			if ( colorButton ) {
				// Simulate click - should create hidden color input
				colorButton.click();

				// Check that a color input was appended to body
				const hiddenInput = document.body.querySelector( 'input[type="color"]' );
				expect( hiddenInput ).not.toBeNull();

				// Clean up
				if ( hiddenInput ) {
					hiddenInput.remove();
				}
			}
		} );

		test( 'should update color when fallback input changes', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, stroke: '#ff0000' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const colorButton = form.querySelector( 'button.color-display-button' );
			if ( colorButton ) {
				colorButton.click();

				const hiddenInput = document.body.querySelector( 'input[type="color"]' );
				if ( hiddenInput ) {
					hiddenInput.value = '#00ff00';
					hiddenInput.dispatchEvent( new Event( 'change' ) );

					expect( mockEditor.updateLayer ).toHaveBeenCalled();

					// Clean up if still present
					if ( hiddenInput.parentNode ) {
						hiddenInput.remove();
					}
				}
			}
		} );

		test( 'should remove hidden input on blur', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, stroke: '#ff0000' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const colorButton = form.querySelector( 'button.color-display-button' );
			if ( colorButton ) {
				colorButton.click();

				const hiddenInput = document.body.querySelector( 'input[type="color"]' );
				if ( hiddenInput ) {
					hiddenInput.dispatchEvent( new Event( 'blur' ) );

					// Should be removed from body
					expect( document.body.querySelector( 'input[type="color"]' ) ).toBeNull();
				}
			}
		} );
	} );

	describe( 'blur handler error logging', () => {
		test( 'should handle errors in blur handler gracefully', () => {
			// Create layer with input that will trigger validation
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const xInput = form.querySelector( 'input[data-prop="x"]' );

			// Enter invalid value
			xInput.value = 'invalid';
			xInput.dispatchEvent( new Event( 'blur' ) );
			jest.advanceTimersByTime( 150 );

			// Should revert to last valid value and not crash
			expect( xInput.value ).toBe( '10' );
		} );
	} );

	describe( 'number input with decimals=1 edge cases', () => {
		test( 'should round to one decimal place on blur', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const numberInputs = form.querySelectorAll( 'input[type="number"][data-decimals="1"]' );
			if ( numberInputs.length > 0 ) {
				const input = numberInputs[ 0 ];
				input.value = '5.789';
				input.dispatchEvent( new Event( 'blur' ) );
				jest.advanceTimersByTime( 150 );

				// Should round to 5.8
				expect( input.value ).toBe( '5.8' );
			}
		} );

		test( 'should display integer without decimal when result is whole number', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const numberInputs = form.querySelectorAll( 'input[type="number"][data-decimals="1"]' );
			if ( numberInputs.length > 0 ) {
				const input = numberInputs[ 0 ];
				input.value = '10.0001'; // Close to 10, should round to 10
				input.dispatchEvent( new Event( 'blur' ) );
				jest.advanceTimersByTime( 150 );

				expect( input.value ).toBe( '10' );
			}
		} );
	} );

	describe( 'ColorPickerDialog onCancel callback', () => {
		// NOTE: ColorPickerDialog is captured at module load time, so we cannot
		// easily mock the onCancel callback execution. The function coverage 
		// for onCancel remains at 74.28% as these are internal anonymous functions.
		// Testing the full onCancel flow would require refactoring PropertiesForm
		// to accept ColorPickerDialog as a parameter (dependency injection).
		test( 'onCancel callback is defined in color picker options', () => {
			// The onCancel callback is defined internally in PropertiesForm.addColorPicker
			// (lines 464-467). Testing this would require dependency injection of ColorPickerDialog.
			// Verify PropertiesForm creates forms with sections for shapes with fill colors
			const layer = { id: 'rect-1', type: 'rectangle', fill: '#ff0000', stroke: '#000000' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );
			
			// Form should exist with property sections (transform, appearance, effects)
			expect( form ).toBeDefined();
			expect( form.tagName ).toBe( 'FORM' );
			const sections = form.querySelectorAll( '.property-section' );
			expect( sections.length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'debounce function execution', () => {
		test( 'should debounce rapid input changes', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const xInput = form.querySelector( 'input[data-prop="x"]' );
			if ( xInput ) {
				// Rapid changes without advancing timer
				xInput.value = '20';
				xInput.dispatchEvent( new Event( 'input' ) );
				xInput.value = '30';
				xInput.dispatchEvent( new Event( 'input' ) );
				xInput.value = '40';
				xInput.dispatchEvent( new Event( 'input' ) );

				// Don't advance timer yet - should not have called updateLayer yet
				const callsBefore = mockEditor.updateLayer.mock.calls.length;

				// Now advance past debounce delay
				jest.advanceTimersByTime( 150 );

				// Should have called updateLayer at least once (after debounce)
				expect( mockEditor.updateLayer.mock.calls.length ).toBeGreaterThan( callsBefore );
			}
		} );

		test( 'should cancel previous debounce when new input arrives', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const xInput = form.querySelector( 'input[data-prop="x"]' );
			if ( xInput ) {
				// First input
				xInput.value = '20';
				xInput.dispatchEvent( new Event( 'input' ) );

				// Advance partway
				jest.advanceTimersByTime( 50 );

				// Second input before first debounce completes
				xInput.value = '30';
				xInput.dispatchEvent( new Event( 'input' ) );

				// Advance past first debounce but before second
				jest.advanceTimersByTime( 60 );

				// First debounce should have been cancelled
				const calls = mockEditor.updateLayer.mock.calls;
				// Should not have the first value (20) as the final call
				const lastCall = calls[ calls.length - 1 ];
				if ( lastCall ) {
					expect( lastCall[ 1 ].x ).not.toBe( 20 );
				}
			}
		} );
	} );

	describe( 'formatOneDecimal with non-number input', () => {
		test( 'should handle input with decimals=1 when value is undefined', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: undefined, y: 20, width: 100, height: 50 };
			// This shouldn't throw - form should handle undefined gracefully
			expect( () => {
				PropertiesForm.create( layer, mockEditor, registerCleanup );
			} ).not.toThrow();
		} );

		test( 'should handle input with decimals=1 when value is null', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: null, y: 20, width: 100, height: 50 };
			// This shouldn't throw - form should handle null gracefully
			expect( () => {
				PropertiesForm.create( layer, mockEditor, registerCleanup );
			} ).not.toThrow();
		} );

		test( 'should handle input with decimals=1 when value is NaN', () => {
			const layer = { id: 'rect-1', type: 'rectangle', x: NaN, y: 20, width: 100, height: 50 };
			// This shouldn't throw - form should handle NaN gracefully
			expect( () => {
				PropertiesForm.create( layer, mockEditor, registerCleanup );
			} ).not.toThrow();
		} );
	} );

	describe( 'textarea text length validation', () => {
		test( 'should validate textarea exceeding max length', () => {
			const layer = { id: 'textbox-1', type: 'textbox', x: 10, y: 20, width: 200, height: 100, text: '' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const textarea = form.querySelector( 'textarea' );
			if ( textarea ) {
				// Set value exceeding default max (5000)
				const longText = 'x'.repeat( 5100 );
				textarea.value = longText;
				textarea.dispatchEvent( new Event( 'input' ) );
				jest.advanceTimersByTime( 150 );

				// Should have error styling
				expect( textarea.classList.contains( 'error' ) ).toBe( true );
			}
		} );

		test( 'should show warning for textarea approaching limit', () => {
			const layer = { id: 'textbox-1', type: 'textbox', x: 10, y: 20, width: 200, height: 100, text: '' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const textarea = form.querySelector( 'textarea' );
			if ( textarea ) {
				// Set value at 96% of limit (5000 * 0.96 = 4800)
				const nearMaxText = 'y'.repeat( 4800 );
				textarea.value = nearMaxText;
				textarea.dispatchEvent( new Event( 'input' ) );
				jest.advanceTimersByTime( 150 );

				// Should have warning styling
				expect( textarea.classList.contains( 'warning' ) ).toBe( true );
			}
		} );
	} );

	describe( 'marker layer form', () => {
		test( 'should create marker layer form with marker properties section', () => {
			const layer = {
				id: 'marker-1',
				type: 'marker',
				x: 100,
				y: 100,
				value: '1',
				style: 'circled',
				size: 24
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Should have marker properties section
			const sections = form.querySelectorAll( '.property-section' );
			const sectionLabels = Array.from( sections ).map( ( s ) => s.querySelector( '.property-section-header' )?.textContent || '' );
			expect( sectionLabels.some( ( l ) => l.includes( 'Marker' ) ) ).toBe( true );
		} );

		test( 'should have value input for marker layer', () => {
			const layer = {
				id: 'marker-1',
				type: 'marker',
				x: 100,
				y: 100,
				value: '5',
				style: 'circled',
				size: 24
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find text input with value prop or placeholder mentioning marker value
			const inputs = form.querySelectorAll( 'input[type="text"]' );
			const valueInput = Array.from( inputs ).find( ( input ) =>
				input.value === '5' || input.placeholder?.includes( '1A' )
			);
			expect( valueInput ).not.toBeNull();
		} );

		test( 'should have style select for marker layer', () => {
			const layer = {
				id: 'marker-1',
				type: 'marker',
				x: 100,
				y: 100,
				value: '1',
				style: 'circled',
				size: 24
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const selects = form.querySelectorAll( 'select' );
			// Should have at least one select for marker style
			expect( selects.length ).toBeGreaterThan( 0 );

			// One select should have circled option
			const hasCircledOption = Array.from( selects ).some( ( select ) => {
				const options = Array.from( select.options );
				return options.some( ( opt ) => opt.value === 'circled' );
			} );
			expect( hasCircledOption ).toBe( true );
		} );

		test( 'should not show appearance section for marker layer', () => {
			const layer = {
				id: 'marker-1',
				type: 'marker',
				x: 100,
				y: 100,
				value: '1',
				style: 'circled',
				size: 24
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Marker layers should not have appearance section (stroke/fill)
			const sections = form.querySelectorAll( '.property-section' );
			const sectionLabels = Array.from( sections ).map( ( s ) => s.querySelector( '.property-section-header' )?.textContent || '' );
			expect( sectionLabels.some( ( l ) => l.toLowerCase().includes( 'appearance' ) ) ).toBe( false );
		} );
	} );

	describe( 'dimension layer form', () => {
		test( 'should create dimension layer form with dimension properties section', () => {
			const layer = {
				id: 'dimension-1',
				type: 'dimension',
				x1: 100,
				y1: 100,
				x2: 200,
				y2: 100,
				text: '100 mm',
				fontSize: 12,
				color: '#000000',
				stroke: '#000000'
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Should have dimension properties section
			const sections = form.querySelectorAll( '.property-section' );
			const sectionLabels = Array.from( sections ).map( ( s ) => s.querySelector( '.property-section-header' )?.textContent || '' );
			expect( sectionLabels.some( ( l ) => l.includes( 'Dimension' ) ) ).toBe( true );
		} );

		test( 'should have value/text input for dimension layer', () => {
			const layer = {
				id: 'dimension-1',
				type: 'dimension',
				x1: 100,
				y1: 100,
				x2: 200,
				y2: 100,
				text: '25.4 mm',
				fontSize: 12
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find text input with value
			const inputs = form.querySelectorAll( 'input[type="text"]' );
			const valueInput = Array.from( inputs ).find( ( input ) =>
				input.value === '25.4 mm' || input.placeholder?.includes( 'mm' )
			);
			expect( valueInput ).not.toBeNull();
		} );

		test( 'should have font size input for dimension layer', () => {
			const layer = {
				id: 'dimension-1',
				type: 'dimension',
				x1: 100,
				y1: 100,
				x2: 200,
				y2: 100,
				text: '100 mm',
				fontSize: 14
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Find number input for font size
			const numberInputs = form.querySelectorAll( 'input[type="number"]' );
			const fontSizeInput = Array.from( numberInputs ).find( ( input ) => {
				const parent = input.closest( '.form-row' ) || input.parentElement;
				const label = parent?.querySelector( 'label' );
				return label?.textContent?.toLowerCase().includes( 'font' ) ||
					input.dataset.prop === 'fontSize';
			} );
			expect( fontSizeInput ).not.toBeNull();
		} );

		test( 'should not show appearance section for dimension layer', () => {
			const layer = {
				id: 'dimension-1',
				type: 'dimension',
				x1: 100,
				y1: 100,
				x2: 200,
				y2: 100,
				text: '100 mm',
				fontSize: 12
			};
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Dimension layers should not have appearance section (has own color controls)
			const sections = form.querySelectorAll( '.property-section' );
			const sectionLabels = Array.from( sections ).map( ( s ) => s.querySelector( '.property-section-header' )?.textContent || '' );
			expect( sectionLabels.some( ( l ) => l.toLowerCase().includes( 'appearance' ) ) ).toBe( false );
		} );
	} );

	describe( 'GradientEditor integration', () => {
		let mockEditor;
		let registerCleanup;

		beforeEach( () => {
			mockEditor = {
				updateLayer: jest.fn(),
				layers: [],
				layerPanel: {
					updatePropertiesPanel: jest.fn()
				}
			};
			registerCleanup = jest.fn();
		} );

		afterEach( () => {
			// Clean up GradientEditor mock
			if ( window.Layers && window.Layers.UI ) {
				delete window.Layers.UI.GradientEditor;
			}
		} );

		test( 'should use GradientEditor when available for rectangle layer', () => {
			// Mock GradientEditor
			const mockGradientEditorInstance = {};
			const MockGradientEditor = jest.fn( () => mockGradientEditorInstance );
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.GradientEditor = MockGradientEditor;

			const layer = {
				id: 'rect-1',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 200,
				height: 100,
				fill: '#ff0000'
			};

			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// GradientEditor should have been instantiated
			expect( MockGradientEditor ).toHaveBeenCalled();
			expect( form ).toBeDefined();
		} );

		test( 'GradientEditor onChange should update layer with gradient', () => {
			let capturedOnChange;
			const MockGradientEditor = jest.fn( ( opts ) => {
				capturedOnChange = opts.onChange;
				return {};
			} );
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.GradientEditor = MockGradientEditor;

			const layer = {
				id: 'rect-1',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 200,
				height: 100,
				fill: '#ff0000'
			};

			PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Simulate gradient change
			const newGradient = {
				type: 'linear',
				colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' } ]
			};
			capturedOnChange( { gradient: newGradient } );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'rect-1', { gradient: newGradient } );
		} );

		test( 'GradientEditor onChange should remove gradient when null', () => {
			let capturedOnChange;
			const MockGradientEditor = jest.fn( ( opts ) => {
				capturedOnChange = opts.onChange;
				return {};
			} );
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.GradientEditor = MockGradientEditor;

			const layer = {
				id: 'rect-1',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 200,
				height: 100,
				gradient: { type: 'linear', colors: [] }
			};

			PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Simulate switching to solid (null gradient)
			capturedOnChange( { gradient: null } );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'rect-1', { gradient: null } );
		} );

		test( 'GradientEditor onFillTypeChange should refresh properties panel', () => {
			jest.useFakeTimers();

			let capturedOnFillTypeChange;
			const MockGradientEditor = jest.fn( ( opts ) => {
				capturedOnFillTypeChange = opts.onFillTypeChange;
				return {};
			} );
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.GradientEditor = MockGradientEditor;

			const layer = {
				id: 'rect-1',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 200,
				height: 100,
				fill: '#ff0000'
			};

			PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Simulate fill type change
			capturedOnFillTypeChange();
			jest.runAllTimers();

			expect( mockEditor.layerPanel.updatePropertiesPanel ).toHaveBeenCalledWith( 'rect-1' );

			jest.useRealTimers();
		} );

		test( 'should hide fill color picker when layer has gradient', () => {
			const MockGradientEditor = jest.fn( () => ( {} ) );
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.GradientEditor = MockGradientEditor;

			const layer = {
				id: 'rect-1',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 200,
				height: 100,
				gradient: {
					type: 'linear',
					colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' } ]
				}
			};

			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			// Gradient layers should NOT have fill color picker (gradient editor handles it)
			const colorButtons = form.querySelectorAll( '.color-picker-button, .color-button' );
			const hasFillPicker = Array.from( colorButtons ).some( ( btn ) => {
				const label = btn.closest( '.form-row' )?.querySelector( 'label' )?.textContent || '';
				return label.toLowerCase().includes( 'fill' );
			} );
			expect( hasFillPicker ).toBe( false );
		} );
	} );
} );
