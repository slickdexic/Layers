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
			} ) )
		};

		// Mock LayersConstants
		global.LayersConstants = {
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
		};
	} );

	afterEach( () => {
		delete global.mw;
		delete global.LayersConstants;
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
} );
