/**
 * EyedropperController Unit Tests
 *
 * Tests for the EyedropperController module which provides color
 * sampling from the canvas with magnified preview.
 *
 * @since 1.1.7
 */

/* eslint-env jest */

const EyedropperController = require( '../../resources/ext.layers.editor/canvas/EyedropperController.js' );

describe( 'EyedropperController', () => {
	let controller;
	let mockCanvasManager;
	let mockCanvas;
	let mockCtx;

	beforeEach( () => {
		// Create mock canvas context
		mockCtx = {
			getImageData: jest.fn().mockReturnValue( {
				data: new Uint8ClampedArray( [ 255, 128, 64, 255 ] ) // RGBA
			} ),
			save: jest.fn(),
			restore: jest.fn(),
			beginPath: jest.fn(),
			arc: jest.fn(),
			clip: jest.fn(),
			drawImage: jest.fn(),
			fillRect: jest.fn(),
			strokeRect: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			stroke: jest.fn(),
			fillText: jest.fn(),
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			font: '',
			textAlign: ''
		};

		// Create mock canvas
		mockCanvas = {
			style: { cursor: 'default' },
			width: 800,
			height: 600,
			getContext: jest.fn().mockReturnValue( mockCtx ),
			getBoundingClientRect: jest.fn().mockReturnValue( {
				left: 0,
				top: 0,
				width: 800,
				height: 600
			} ),
			addEventListener: jest.fn(),
			removeEventListener: jest.fn()
		};

		// Create mock canvas manager
		mockCanvasManager = {
			canvas: mockCanvas,
			editor: {
				layers: [],
				toolbar: {
					setFillColor: jest.fn(),
					setStrokeColor: jest.fn()
				},
				updateLayerProperties: jest.fn()
			},
			selectionManager: {
				getSelectedIds: jest.fn().mockReturnValue( [] )
			},
			requestRedraw: jest.fn()
		};

		controller = new EyedropperController( mockCanvasManager );
	} );

	afterEach( () => {
		if ( controller ) {
			controller.destroy();
		}
		document.removeEventListener( 'keydown', controller?.handleKeyDown );
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default values', () => {
			expect( controller ).toBeDefined();
			expect( controller.active ).toBe( false );
			expect( controller.target ).toBe( 'fill' );
			expect( controller.showPreview ).toBe( true );
			expect( controller.previewSize ).toBe( 100 );
			expect( controller.magnification ).toBe( 8 );
		} );

		it( 'should store canvas manager reference', () => {
			expect( controller.manager ).toBe( mockCanvasManager );
		} );

		it( 'should initialize with null sampled color', () => {
			expect( controller.sampledColor ).toBeNull();
		} );
	} );

	describe( 'activate', () => {
		it( 'should activate eyedropper mode', () => {
			controller.activate();
			expect( controller.active ).toBe( true );
		} );

		it( 'should default target to fill', () => {
			controller.activate();
			expect( controller.target ).toBe( 'fill' );
		} );

		it( 'should accept stroke as target', () => {
			controller.activate( 'stroke' );
			expect( controller.target ).toBe( 'stroke' );
		} );

		it( 'should change cursor to crosshair', () => {
			controller.activate();
			expect( mockCanvas.style.cursor ).toBe( 'crosshair' );
		} );

		it( 'should add event listeners', () => {
			controller.activate();
			expect( mockCanvas.addEventListener ).toHaveBeenCalledWith(
				'mousemove',
				controller.handleMouseMove
			);
			expect( mockCanvas.addEventListener ).toHaveBeenCalledWith(
				'mousedown',
				controller.handleMouseDown
			);
		} );

		it( 'should call onModeChange callback', () => {
			const callback = jest.fn();
			controller.onModeChange = callback;
			controller.activate( 'fill' );
			expect( callback ).toHaveBeenCalledWith( true, 'fill' );
		} );

		it( 'should not re-activate if already active', () => {
			controller.activate();
			mockCanvas.addEventListener.mockClear();
			controller.activate();
			expect( mockCanvas.addEventListener ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'deactivate', () => {
		beforeEach( () => {
			controller.activate();
		} );

		it( 'should deactivate eyedropper mode', () => {
			controller.deactivate();
			expect( controller.active ).toBe( false );
		} );

		it( 'should restore original cursor', () => {
			mockCanvas.style.cursor = 'crosshair';
			controller.originalCursor = 'pointer';
			controller.deactivate();
			expect( mockCanvas.style.cursor ).toBe( 'pointer' );
		} );

		it( 'should remove event listeners', () => {
			controller.deactivate();
			expect( mockCanvas.removeEventListener ).toHaveBeenCalledWith(
				'mousemove',
				controller.handleMouseMove
			);
			expect( mockCanvas.removeEventListener ).toHaveBeenCalledWith(
				'mousedown',
				controller.handleMouseDown
			);
		} );

		it( 'should call onModeChange with cancelled flag', () => {
			const callback = jest.fn();
			controller.onModeChange = callback;
			controller.deactivate( true );
			expect( callback ).toHaveBeenCalledWith( false, 'fill', true );
		} );

		it( 'should do nothing if not active', () => {
			controller.deactivate();
			mockCanvas.removeEventListener.mockClear();
			controller.deactivate();
			expect( mockCanvas.removeEventListener ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'toggle', () => {
		it( 'should activate when inactive', () => {
			const result = controller.toggle();
			expect( result ).toBe( true );
			expect( controller.active ).toBe( true );
		} );

		it( 'should deactivate when active', () => {
			controller.activate();
			const result = controller.toggle();
			expect( result ).toBe( false );
			expect( controller.active ).toBe( false );
		} );

		it( 'should pass target when activating', () => {
			controller.toggle( 'stroke' );
			expect( controller.target ).toBe( 'stroke' );
		} );
	} );

	describe( 'isActive', () => {
		it( 'should return false when inactive', () => {
			expect( controller.isActive() ).toBe( false );
		} );

		it( 'should return true when active', () => {
			controller.activate();
			expect( controller.isActive() ).toBe( true );
		} );
	} );

	describe( 'getTarget / setTarget', () => {
		it( 'should return current target', () => {
			expect( controller.getTarget() ).toBe( 'fill' );
		} );

		it( 'should set target to stroke', () => {
			controller.setTarget( 'stroke' );
			expect( controller.getTarget() ).toBe( 'stroke' );
		} );

		it( 'should default invalid target to fill', () => {
			controller.setTarget( 'invalid' );
			expect( controller.getTarget() ).toBe( 'fill' );
		} );
	} );

	describe( 'sampleColorAt', () => {
		it( 'should sample color from canvas', () => {
			const color = controller.sampleColorAt( 100, 100 );
			expect( mockCtx.getImageData ).toHaveBeenCalledWith( 100, 100, 1, 1 );
			expect( color ).toBe( '#ff8040' ); // RGB 255, 128, 64
		} );

		it( 'should return white for transparent pixels', () => {
			mockCtx.getImageData.mockReturnValue( {
				data: new Uint8ClampedArray( [ 0, 0, 0, 0 ] )
			} );
			const color = controller.sampleColorAt( 100, 100 );
			expect( color ).toBe( '#ffffff' );
		} );

		it( 'should average colors when sampleRadius > 0', () => {
			controller.sampleRadius = 1;
			// 3x3 = 9 pixels, all same color
			const pixels = new Uint8ClampedArray( 9 * 4 );
			for ( let i = 0; i < 9; i++ ) {
				pixels[ i * 4 ] = 100;     // R
				pixels[ i * 4 + 1 ] = 150; // G
				pixels[ i * 4 + 2 ] = 200; // B
				pixels[ i * 4 + 3 ] = 255; // A
			}
			mockCtx.getImageData.mockReturnValue( { data: pixels } );

			const color = controller.sampleColorAt( 100, 100 );
			expect( color ).toBe( '#6496c8' ); // RGB 100, 150, 200
		} );

		it( 'should return null if context unavailable', () => {
			controller.manager = null;
			const color = controller.sampleColorAt( 100, 100 );
			expect( color ).toBeNull();
		} );
	} );

	describe( 'rgbToHex', () => {
		it( 'should convert RGB to hex', () => {
			expect( controller.rgbToHex( 255, 0, 0 ) ).toBe( '#ff0000' );
			expect( controller.rgbToHex( 0, 255, 0 ) ).toBe( '#00ff00' );
			expect( controller.rgbToHex( 0, 0, 255 ) ).toBe( '#0000ff' );
			expect( controller.rgbToHex( 255, 255, 255 ) ).toBe( '#ffffff' );
			expect( controller.rgbToHex( 0, 0, 0 ) ).toBe( '#000000' );
		} );

		it( 'should pad single digit hex values', () => {
			expect( controller.rgbToHex( 1, 2, 3 ) ).toBe( '#010203' );
		} );

		it( 'should clamp values to 0-255', () => {
			expect( controller.rgbToHex( 300, -10, 128 ) ).toBe( '#ff0080' );
		} );
	} );

	describe( 'handleMouseMove', () => {
		beforeEach( () => {
			controller.activate();
		} );

		it( 'should update preview position', () => {
			const event = {
				clientX: 150,
				clientY: 200
			};
			controller.handleMouseMove( event );
			expect( controller.previewPosition ).toEqual( { x: 150, y: 200 } );
		} );

		it( 'should sample color at position', () => {
			const event = { clientX: 150, clientY: 200 };
			controller.handleMouseMove( event );
			expect( controller.sampledColor ).toBe( '#ff8040' );
		} );

		it( 'should switch to stroke target with Alt key', () => {
			const event = { clientX: 150, clientY: 200, altKey: true };
			controller.handleMouseMove( event );
			expect( controller.target ).toBe( 'stroke' );
		} );

		it( 'should switch to stroke target with Shift key', () => {
			const event = { clientX: 150, clientY: 200, shiftKey: true };
			controller.handleMouseMove( event );
			expect( controller.target ).toBe( 'stroke' );
		} );

		it( 'should request redraw', () => {
			controller.handleMouseMove( { clientX: 100, clientY: 100 } );
			expect( mockCanvasManager.requestRedraw ).toHaveBeenCalled();
		} );

		it( 'should do nothing when not active', () => {
			controller.deactivate();
			controller.handleMouseMove( { clientX: 100, clientY: 100 } );
			expect( controller.previewPosition ).toBeNull();
		} );
	} );

	describe( 'handleMouseDown', () => {
		beforeEach( () => {
			controller.activate();
		} );

		it( 'should sample color on click', () => {
			const event = {
				clientX: 100,
				clientY: 100,
				preventDefault: jest.fn(),
				stopPropagation: jest.fn()
			};
			controller.handleMouseDown( event );
			expect( controller.sampledColor ).toBe( '#ff8040' );
		} );

		it( 'should prevent default and stop propagation', () => {
			const event = {
				clientX: 100,
				clientY: 100,
				preventDefault: jest.fn(),
				stopPropagation: jest.fn()
			};
			controller.handleMouseDown( event );
			expect( event.preventDefault ).toHaveBeenCalled();
			expect( event.stopPropagation ).toHaveBeenCalled();
		} );

		it( 'should call onColorSampled callback', () => {
			const callback = jest.fn();
			controller.onColorSampled = callback;
			const event = {
				clientX: 100,
				clientY: 100,
				preventDefault: jest.fn(),
				stopPropagation: jest.fn()
			};
			controller.handleMouseDown( event );
			expect( callback ).toHaveBeenCalledWith( '#ff8040', 'fill', { x: 100, y: 100 } );
		} );

		it( 'should use stroke target with modifier key', () => {
			const callback = jest.fn();
			controller.onColorSampled = callback;
			const event = {
				clientX: 100,
				clientY: 100,
				altKey: true,
				preventDefault: jest.fn(),
				stopPropagation: jest.fn()
			};
			controller.handleMouseDown( event );
			expect( callback ).toHaveBeenCalledWith( '#ff8040', 'stroke', { x: 100, y: 100 } );
		} );

		it( 'should deactivate after sampling', () => {
			const event = {
				clientX: 100,
				clientY: 100,
				preventDefault: jest.fn(),
				stopPropagation: jest.fn()
			};
			controller.handleMouseDown( event );
			expect( controller.active ).toBe( false );
		} );
	} );

	describe( 'handleKeyDown', () => {
		beforeEach( () => {
			controller.activate();
		} );

		it( 'should cancel on Escape', () => {
			const event = {
				key: 'Escape',
				preventDefault: jest.fn()
			};
			controller.handleKeyDown( event );
			expect( controller.active ).toBe( false );
			expect( event.preventDefault ).toHaveBeenCalled();
		} );

		it( 'should do nothing when not active', () => {
			controller.deactivate();
			const event = {
				key: 'Escape',
				preventDefault: jest.fn()
			};
			controller.handleKeyDown( event );
			expect( event.preventDefault ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'applyColor', () => {
		it( 'should update selected layer fill', () => {
			mockCanvasManager.selectionManager.getSelectedIds.mockReturnValue( [ 'layer1' ] );
			mockCanvasManager.editor.layers = [
				{ id: 'layer1', type: 'rectangle', fill: '#000000' }
			];

			controller.applyColor( '#ff0000', 'fill' );

			expect( mockCanvasManager.editor.updateLayerProperties ).toHaveBeenCalledWith(
				'layer1',
				{ fill: '#ff0000' }
			);
		} );

		it( 'should update selected layer stroke', () => {
			mockCanvasManager.selectionManager.getSelectedIds.mockReturnValue( [ 'layer1' ] );
			mockCanvasManager.editor.layers = [
				{ id: 'layer1', type: 'rectangle', stroke: '#000000' }
			];

			controller.applyColor( '#00ff00', 'stroke' );

			expect( mockCanvasManager.editor.updateLayerProperties ).toHaveBeenCalledWith(
				'layer1',
				{ stroke: '#00ff00' }
			);
		} );

		it( 'should update toolbar fill color', () => {
			controller.applyColor( '#0000ff', 'fill' );
			expect( mockCanvasManager.editor.toolbar.setFillColor ).toHaveBeenCalledWith( '#0000ff' );
		} );

		it( 'should update toolbar stroke color', () => {
			controller.applyColor( '#ff00ff', 'stroke' );
			expect( mockCanvasManager.editor.toolbar.setStrokeColor ).toHaveBeenCalledWith( '#ff00ff' );
		} );
	} );

	describe( 'render', () => {
		it( 'should not render when not active', () => {
			controller.render( mockCtx );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		it( 'should not render when showPreview is false', () => {
			controller.activate();
			controller.previewPosition = { x: 100, y: 100 };
			controller.showPreview = false;
			controller.render( mockCtx );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		it( 'should not render when no preview position', () => {
			controller.activate();
			controller.render( mockCtx );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		it( 'should render preview when active with position', () => {
			controller.activate();
			controller.previewPosition = { x: 100, y: 100 };
			controller.sampledColor = '#ff0000';
			controller.render( mockCtx );
			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.arc ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );
	} );

	describe( 'setPreviewOptions', () => {
		it( 'should update preview size', () => {
			controller.setPreviewOptions( { size: 150 } );
			expect( controller.previewSize ).toBe( 150 );
		} );

		it( 'should update magnification', () => {
			controller.setPreviewOptions( { magnification: 12 } );
			expect( controller.magnification ).toBe( 12 );
		} );

		it( 'should update show flag', () => {
			controller.setPreviewOptions( { show: false } );
			expect( controller.showPreview ).toBe( false );
		} );

		it( 'should reject invalid values', () => {
			controller.setPreviewOptions( { size: -10, magnification: 0 } );
			expect( controller.previewSize ).toBe( 100 );
			expect( controller.magnification ).toBe( 8 );
		} );
	} );

	describe( 'getSampledColor', () => {
		it( 'should return null initially', () => {
			expect( controller.getSampledColor() ).toBeNull();
		} );

		it( 'should return sampled color after sampling', () => {
			controller.activate();
			controller.handleMouseMove( { clientX: 100, clientY: 100 } );
			expect( controller.getSampledColor() ).toBe( '#ff8040' );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should deactivate if active', () => {
			controller.activate();
			controller.destroy();
			expect( controller.active ).toBe( false );
		} );

		it( 'should clean up references', () => {
			controller.destroy();
			expect( controller.manager ).toBeNull();
			expect( controller.onColorSampled ).toBeNull();
			expect( controller.onModeChange ).toBeNull();
		} );
	} );
} );
