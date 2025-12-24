/**
 * @jest-environment jsdom
 */

const PropertiesForm = require( '../../resources/ext.layers.editor/ui/PropertiesForm.js' );

describe( 'PropertiesForm', () => {
	// Mock editor for updateLayer calls
	let mockEditor;
	let registerCleanup;

	beforeEach( () => {
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
			UI: {}
		};

		// Also set legacy global for compatibility
		global.LayersConstants = global.Layers.Constants;
	} );

	afterEach( () => {
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

			// Should have textarea for text
			const textarea = form.querySelector( 'textarea' );
			expect( textarea ).not.toBeNull();
			expect( textarea.value ).toBe( 'Hello' );
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

		test( 'should create blur layer form with blur radius', () => {
			const layer = { id: 'test-1', type: 'blur', width: 100, height: 100, blurRadius: 20 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			expect( widthInput ).not.toBeNull();
			expect( heightInput ).not.toBeNull();

			// Find blur radius input by label
			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const blurRadiusInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Radius' );
			} );
			expect( blurRadiusInput ).not.toBeNull();
			expect( blurRadiusInput.value ).toBe( '20' );
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
			input.dispatchEvent( new Event( 'input' ) );

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
			xInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { x: 100 } );
		} );

		test( 'should call editor.updateLayer when Y changes', () => {
			const layer = { id: 'test-layer', type: 'rectangle', y: 25 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const yInput = form.querySelector( 'input[data-prop="y"]' );
			yInput.value = '200';
			yInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { y: 200 } );
		} );

		test( 'should call editor.updateLayer when rotation changes', () => {
			const layer = { id: 'test-layer', type: 'rectangle', rotation: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const rotInput = form.querySelector( 'input[data-prop="rotation"]' );
			rotInput.value = '90';
			rotInput.dispatchEvent( new Event( 'input' ) );

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
				input.dispatchEvent( new Event( 'input' ) );
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
			input.dispatchEvent( new Event( 'input' ) );

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
			widthInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { width: 200, radiusX: 100 } );
		} );

		test( 'should update ellipse height and radiusY together', () => {
			const layer = { id: 'test-layer', type: 'ellipse', radiusX: 50, radiusY: 30 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			heightInput.value = '100';
			heightInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { height: 100, radiusY: 50 } );
		} );

		test( 'should update polygon sides via onChange handler', () => {
			const layer = { id: 'test-layer', type: 'polygon', sides: 6 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const sidesInput = form.querySelector( 'input[data-prop="sides"]' );
			sidesInput.value = '8';
			sidesInput.dispatchEvent( new Event( 'input' ) );

			// The onChange should be called with parsed value
			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star points via onChange handler', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const pointsInput = form.querySelector( 'input[data-prop="points"]' );
			pointsInput.value = '7';
			pointsInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update blur radius via input handler', () => {
			const layer = { id: 'test-layer', type: 'blur', width: 100, height: 100, blurRadius: 12 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const inputs = form.querySelectorAll( 'input[type="number"]' );
			const blurInput = Array.from( inputs ).find( ( input ) => {
				const label = input.parentElement.querySelector( 'label' );
				return label && label.textContent.includes( 'Blur Radius' );
			} );

			blurInput.value = '30';
			blurInput.dispatchEvent( new Event( 'input' ) );

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
			input.dispatchEvent( new Event( 'input' ) );

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
			strokeWidthInput.dispatchEvent( new Event( 'input' ) );

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
			radiusInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { radius: 75 } );
		} );

		test( 'should update polygon cornerRadius', () => {
			const layer = { id: 'test-layer', type: 'polygon', sides: 6, radius: 50, cornerRadius: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const cornerRadiusInput = form.querySelector( 'input[data-prop="cornerRadius"]' );
			cornerRadiusInput.value = '10';
			cornerRadiusInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star outerRadius', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5, outerRadius: 50, innerRadius: 25 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const outerRadiusInput = form.querySelector( 'input[data-prop="outerRadius"]' );
			outerRadiusInput.value = '75';
			outerRadiusInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star innerRadius', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5, outerRadius: 50, innerRadius: 25 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const innerRadiusInput = form.querySelector( 'input[data-prop="innerRadius"]' );
			innerRadiusInput.value = '30';
			innerRadiusInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star pointRadius', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5, outerRadius: 50, innerRadius: 25, pointRadius: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const pointRadiusInput = form.querySelector( 'input[data-prop="pointRadius"]' );
			pointRadiusInput.value = '8';
			pointRadiusInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );

		test( 'should update star valleyRadius', () => {
			const layer = { id: 'test-layer', type: 'star', points: 5, outerRadius: 50, innerRadius: 25, valleyRadius: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const valleyRadiusInput = form.querySelector( 'input[data-prop="valleyRadius"]' );
			valleyRadiusInput.value = '5';
			valleyRadiusInput.dispatchEvent( new Event( 'input' ) );

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
			const layer = { id: 'test-layer', type: 'textbox', text: 'Hello' };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const textarea = form.querySelector( 'textarea' );
			textarea.value = 'New text content';
			textarea.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { text: 'New text content' } );
		} );
	} );

	describe( 'circle layer form', () => {
		test( 'should update circle radius', () => {
			const layer = { id: 'test-layer', type: 'circle', radius: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const radiusInput = form.querySelector( 'input[data-prop="radius"]' );
			radiusInput.value = '75';
			radiusInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { radius: 75 } );
		} );
	} );

	describe( 'blur layer form', () => {
		test( 'should update blur width', () => {
			const layer = { id: 'test-layer', type: 'blur', width: 100, height: 100, blurRadius: 12 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			widthInput.value = '150';
			widthInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { width: 150 } );
		} );

		test( 'should update blur height', () => {
			const layer = { id: 'test-layer', type: 'blur', width: 100, height: 100, blurRadius: 12 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			heightInput.value = '150';
			heightInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { height: 150 } );
		} );
	} );

	describe( 'rectangle layer form', () => {
		test( 'should update rectangle width', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			widthInput.value = '200';
			widthInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { width: 200 } );
		} );

		test( 'should update rectangle height', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 50 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			heightInput.value = '100';
			heightInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { height: 100 } );
		} );

		test( 'should update rectangle cornerRadius', () => {
			const layer = { id: 'test-layer', type: 'rectangle', width: 100, height: 50, cornerRadius: 0 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const cornerRadiusInput = form.querySelector( 'input[data-prop="cornerRadius"]' );
			cornerRadiusInput.value = '15';
			cornerRadiusInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalled();
		} );
	} );

	describe( 'image layer form', () => {
		test( 'should update image width', () => {
			const layer = { id: 'test-layer', type: 'image', width: 300, height: 200 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const widthInput = form.querySelector( 'input[data-prop="width"]' );
			widthInput.value = '400';
			widthInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { width: 400 } );
		} );

		test( 'should update image height', () => {
			const layer = { id: 'test-layer', type: 'image', width: 300, height: 200 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const heightInput = form.querySelector( 'input[data-prop="height"]' );
			heightInput.value = '300';
			heightInput.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { height: 300 } );
		} );
	} );

	describe( 'line layer form', () => {
		test( 'should update line x1', () => {
			const layer = { id: 'test-layer', type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const x1Input = form.querySelector( 'input[data-prop="x1"]' );
			x1Input.value = '50';
			x1Input.dispatchEvent( new Event( 'input' ) );

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
				strokeWidthInput.dispatchEvent( new Event( 'input' ) );

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

				const call = mockEditor.updateLayer.mock.calls.find( ( c ) => c[ 1 ].textShadow === true );
				expect( call ).toBeDefined();
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
			x2Input.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { x2: 200 } );
		} );

		test( 'should update arrow y1 endpoint', () => {
			const layer = { id: 'test-layer', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const y1Input = form.querySelector( 'input[data-prop="y1"]' );
			y1Input.value = '50';
			y1Input.dispatchEvent( new Event( 'input' ) );

			expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { y1: 50 } );
		} );

		test( 'should update arrow y2 endpoint', () => {
			const layer = { id: 'test-layer', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			const form = PropertiesForm.create( layer, mockEditor, registerCleanup );

			const y2Input = form.querySelector( 'input[data-prop="y2"]' );
			y2Input.value = '200';
			y2Input.dispatchEvent( new Event( 'input' ) );

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
				tailWidthInput.dispatchEvent( new Event( 'input' ) );

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
				arrowSizeInput.dispatchEvent( new Event( 'input' ) );

				expect( mockEditor.updateLayer ).toHaveBeenCalledWith( 'test-layer', { arrowSize: 25 } );
			}
		} );
	} );
} );
