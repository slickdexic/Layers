/**
 * Tests for TextInputController
 * Extracted from CanvasManager as part of P1.1 modularization
 */

// Mock document methods
const mockModal = {
	remove: jest.fn(),
	appendChild: jest.fn(),
	style: { cssText: '' },
	className: '',
	addEventListener: jest.fn()
};

const mockInput = {
	type: '',
	className: '',
	style: { cssText: '' },
	placeholder: '',
	value: 'test text',
	addEventListener: jest.fn(),
	focus: jest.fn()
};

const mockButton = {
	textContent: '',
	style: { cssText: '' },
	addEventListener: jest.fn()
};

const mockContainer = {
	style: { cssText: '' },
	appendChild: jest.fn()
};

const mockLabel = {
	textContent: '',
	style: { cssText: '' }
};

const mockButtonsDiv = {
	style: { cssText: '' },
	appendChild: jest.fn()
};

// Save originals
const originalCreateElement = document.createElement;

// Setup mocks
beforeEach( () => {
	let elementIndex = 0;
	const elements = [ mockModal, mockContainer, mockLabel, mockInput, mockButtonsDiv, mockButton, mockButton ];

	document.createElement = jest.fn( () => {
		const el = elements[ elementIndex++ ] || mockModal;
		// Reset for each test
		el.remove = jest.fn();
		el.appendChild = jest.fn();
		el.addEventListener = jest.fn();
		return el;
	} );

	jest.clearAllMocks();
} );

afterEach( () => {
	document.createElement = originalCreateElement;
} );

// Load the module
const TextInputController = require( '../../../resources/ext.layers.editor/canvas/TextInputController.js' );

describe( 'TextInputController', () => {
	let controller;
	let mockCanvasManager;

	beforeEach( () => {
		mockCanvasManager = {
			editor: {
				addLayer: jest.fn(),
				setCurrentTool: jest.fn(),
				layers: []
			},
			renderLayers: jest.fn(),
			textInputModal: null
		};

		controller = new TextInputController( mockCanvasManager );
	} );

	describe( 'constructor', () => {
		it( 'should initialize with canvasManager reference', () => {
			expect( controller.canvasManager ).toBe( mockCanvasManager );
		} );

		it( 'should initialize textInputModal as null', () => {
			expect( controller.textInputModal ).toBeNull();
		} );
	} );

	describe( 'createTextInputModal', () => {
		it( 'should create a modal element', () => {
			const point = { x: 100, y: 200 };
			const style = { fontSize: 20, fontFamily: 'Helvetica' };

			const modal = controller.createTextInputModal( point, style );

			expect( document.createElement ).toHaveBeenCalledWith( 'div' );
			expect( modal ).toBeDefined();
		} );

		it( 'should store modal reference', () => {
			const point = { x: 100, y: 200 };
			const style = {};

			controller.createTextInputModal( point, style );

			expect( controller.textInputModal ).not.toBeNull();
		} );

		it( 'should hide existing modal before creating new one', () => {
			const existingModal = { remove: jest.fn() };
			controller.textInputModal = existingModal;

			controller.createTextInputModal( { x: 0, y: 0 }, {} );

			expect( existingModal.remove ).toHaveBeenCalled();
		} );
	} );

	describe( 'finishTextInput', () => {
		it( 'should create text layer with provided values', () => {
			const input = { value: '  Hello World  ' };
			const point = { x: 50, y: 75 };
			const style = { fontSize: 24, fontFamily: 'Times', color: '#FF0000' };

			controller.finishTextInput( input, point, style );

			expect( mockCanvasManager.editor.addLayer ).toHaveBeenCalledWith( {
				type: 'text',
				x: 50,
				y: 75,
				text: 'Hello World',
				fontSize: 24,
				fontFamily: 'Times',
				color: '#FF0000'
			} );
		} );

		it( 'should use default values when style is incomplete', () => {
			const input = { value: 'Test' };
			const point = { x: 0, y: 0 };
			const style = {};

			controller.finishTextInput( input, point, style );

			expect( mockCanvasManager.editor.addLayer ).toHaveBeenCalledWith(
				expect.objectContaining( {
					fontSize: 16,
					fontFamily: 'Arial',
					color: '#000000'
				} )
			);
		} );

		it( 'should not create layer for empty text', () => {
			const input = { value: '   ' };
			const point = { x: 0, y: 0 };
			const style = {};

			controller.finishTextInput( input, point, style );

			expect( mockCanvasManager.editor.addLayer ).not.toHaveBeenCalled();
		} );

		it( 'should switch to pointer tool after adding layer', () => {
			const input = { value: 'Test' };
			const point = { x: 0, y: 0 };
			const style = {};

			controller.finishTextInput( input, point, style );

			expect( mockCanvasManager.editor.setCurrentTool ).toHaveBeenCalledWith( 'pointer' );
		} );

		it( 'should render layers after adding', () => {
			const input = { value: 'Test' };
			const point = { x: 0, y: 0 };
			const style = {};

			controller.finishTextInput( input, point, style );

			expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should hide modal after finishing', () => {
			controller.textInputModal = { remove: jest.fn() };
			const input = { value: 'Test' };

			controller.finishTextInput( input, { x: 0, y: 0 }, {} );

			expect( controller.textInputModal ).toBeNull();
		} );
	} );

	describe( 'hideTextInputModal', () => {
		it( 'should remove modal if exists', () => {
			const modal = { remove: jest.fn() };
			controller.textInputModal = modal;

			controller.hideTextInputModal();

			expect( modal.remove ).toHaveBeenCalled();
			expect( controller.textInputModal ).toBeNull();
		} );

		it( 'should clear canvasManager reference', () => {
			controller.textInputModal = { remove: jest.fn() };

			controller.hideTextInputModal();

			expect( mockCanvasManager.textInputModal ).toBeNull();
		} );

		it( 'should handle null modal gracefully', () => {
			controller.textInputModal = null;

			expect( () => controller.hideTextInputModal() ).not.toThrow();
		} );
	} );

	describe( 'isModalVisible', () => {
		it( 'should return true when modal exists', () => {
			controller.textInputModal = { remove: jest.fn() };

			expect( controller.isModalVisible() ).toBe( true );
		} );

		it( 'should return false when modal is null', () => {
			controller.textInputModal = null;

			expect( controller.isModalVisible() ).toBe( false );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should hide modal and clear references', () => {
			controller.textInputModal = { remove: jest.fn() };

			controller.destroy();

			expect( controller.textInputModal ).toBeNull();
			expect( controller.canvasManager ).toBeNull();
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should handle missing editor gracefully', () => {
			mockCanvasManager.editor = null;
			const input = { value: 'Test' };

			expect( () => {
				controller.finishTextInput( input, { x: 0, y: 0 }, {} );
			} ).not.toThrow();
		} );

		it( 'should handle missing setCurrentTool gracefully', () => {
			delete mockCanvasManager.editor.setCurrentTool;
			const input = { value: 'Test' };

			expect( () => {
				controller.finishTextInput( input, { x: 0, y: 0 }, {} );
			} ).not.toThrow();
		} );
	} );
} );
