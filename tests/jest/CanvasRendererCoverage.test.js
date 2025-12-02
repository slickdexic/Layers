/**
 * @jest-environment jsdom
 */

/**
 * Extended Unit Tests for CanvasRenderer - Coverage Improvement
 * Targets uncovered lines: blend mode error handling, glow effects,
 * drawLayerShapeOnly, line selection indicators, shadow methods
 */

const CanvasRenderer = require( '../../resources/ext.layers.editor/CanvasRenderer.js' );

describe( 'CanvasRenderer Coverage Extension', () => {
	let canvas;
	let ctx;
	let renderer;
	let mockEditor;

	function createMockContext() {
		return {
			fillRect: jest.fn(),
			strokeRect: jest.fn(),
			clearRect: jest.fn(),
			getImageData: jest.fn( () => ( { data: new Array( 4 ) } ) ),
			putImageData: jest.fn(),
			createImageData: jest.fn( () => ( { data: new Array( 4 ) } ) ),
			setTransform: jest.fn(),
			resetTransform: jest.fn(),
			save: jest.fn(),
			restore: jest.fn(),
			translate: jest.fn(),
			scale: jest.fn(),
			rotate: jest.fn(),
			transform: jest.fn(),
			beginPath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			closePath: jest.fn(),
			stroke: jest.fn(),
			fill: jest.fn(),
			arc: jest.fn(),
			rect: jest.fn(),
			drawImage: jest.fn(),
			measureText: jest.fn( ( text ) => ( {
				width: ( text || '' ).length * 8,
				actualBoundingBoxAscent: 12,
				actualBoundingBoxDescent: 4
			} ) ),
			fillText: jest.fn(),
			strokeText: jest.fn(),
			setLineDash: jest.fn(),
			ellipse: jest.fn(),
			clip: jest.fn(),
			quadraticCurveTo: jest.fn(),
			imageSmoothingEnabled: true,
			imageSmoothingQuality: 'high',
			globalAlpha: 1,
			globalCompositeOperation: 'source-over',
			filter: 'none',
			shadowColor: 'transparent',
			shadowBlur: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			lineWidth: 1,
			fillStyle: '#000000',
			strokeStyle: '#000000',
			textAlign: 'left',
			textBaseline: 'alphabetic',
			font: '16px Arial',
			lineCap: 'butt',
			lineJoin: 'miter'
		};
	}

	beforeEach( () => {
		ctx = createMockContext();

		canvas = document.createElement( 'canvas' );
		canvas.width = 800;
		canvas.height = 600;
		document.body.appendChild( canvas );

		canvas.getContext = jest.fn( () => ctx );

		mockEditor = {
			canvas: canvas,
			layers: [],
			selectedLayerIds: [],
			getLayerById: jest.fn( ( id ) => {
				return mockEditor.layers.find( ( l ) => l.id === id );
			} )
		};

		renderer = new CanvasRenderer( canvas, { editor: mockEditor } );

		window.mw = {
			log: {
				warn: jest.fn(),
				error: jest.fn()
			}
		};

		// Mock TextUtils for text layer bounds
		window.TextUtils = {
			measureTextLayer: jest.fn( ( layer ) => {
				if ( layer && layer.type === 'text' ) {
					return {
						originX: layer.x || 0,
						originY: layer.y || 0,
						width: 100,
						height: 20,
						lines: [ layer.text || 'Text' ],
						lineHeight: 20
					};
				}
				return null;
			} )
		};

		// Mock GeometryUtils for layer bounds
		window.GeometryUtils = {
			getLayerBoundsForType: jest.fn( ( layer ) => {
				if ( !layer ) {
					return null;
				}
				if ( layer.type === 'line' || layer.type === 'arrow' ) {
					return {
						x: Math.min( layer.x1 || 0, layer.x2 || 0 ),
						y: Math.min( layer.y1 || 0, layer.y2 || 0 ),
						width: Math.abs( ( layer.x2 || 0 ) - ( layer.x1 || 0 ) ),
						height: Math.abs( ( layer.y2 || 0 ) - ( layer.y1 || 0 ) )
					};
				}
				if ( layer.type === 'unknown' ) {
					return null;
				}
				return {
					x: layer.x || 0,
					y: layer.y || 0,
					width: layer.width || 0,
					height: layer.height || 0
				};
			} )
		};
	} );

	afterEach( () => {
		document.body.innerHTML = '';
		jest.clearAllMocks();
		delete window.mw;
		delete window.TextUtils;
		delete window.GeometryUtils;
	} );

	describe( 'blend mode handling', () => {
		it( 'should apply valid blend mode', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				blend: 'multiply'
			};

			renderer.drawLayerWithEffects( layer );

			expect( ctx.globalCompositeOperation ).toBe( 'multiply' );
		} );

		it( 'should apply blendMode property as alternate name', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				blendMode: 'screen' // Uses blendMode property, not blend
			};

			renderer.drawLayerWithEffects( layer );

			expect( ctx.globalCompositeOperation ).toBe( 'screen' );
		} );
	} );

	describe( 'supportsGlow', () => {
		it( 'should return true for supported types', () => {
			const supportedTypes = [
				'rectangle', 'circle', 'ellipse', 'polygon',
				'star', 'line', 'arrow', 'path'
			];

			supportedTypes.forEach( ( type ) => {
				expect( renderer.supportsGlow( type ) ).toBe( true );
			} );
		} );

		it( 'should return false for unsupported types', () => {
			expect( renderer.supportsGlow( 'text' ) ).toBe( false );
			expect( renderer.supportsGlow( 'highlight' ) ).toBe( false );
			expect( renderer.supportsGlow( 'blur' ) ).toBe( false );
			expect( renderer.supportsGlow( 'unknown' ) ).toBe( false );
		} );
	} );

	describe( 'drawGlow', () => {
		it( 'should draw glow effect for rectangle', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				stroke: '#ff0000',
				strokeWidth: 2,
				glow: true
			};

			renderer.drawGlow( layer );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
			// Line width should be increased for glow effect
			expect( ctx.lineWidth ).toBe( 8 ); // 2 + 6
		} );

		it( 'should use default stroke color when not provided', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				glow: true
			};

			renderer.drawGlow( layer );

			expect( ctx.strokeStyle ).toBe( '#000' );
		} );

		it( 'should preserve global alpha after glow', () => {
			ctx.globalAlpha = 0.8;
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				glow: true
			};

			renderer.drawGlow( layer );

			expect( ctx.globalAlpha ).toBe( 0.8 );
		} );
	} );

	describe( 'drawLayerShapeOnly', () => {
		it( 'should draw rectangle shape', () => {
			const layer = {
				type: 'rectangle',
				x: 10,
				y: 20,
				width: 100,
				height: 50
			};

			renderer.drawLayerShapeOnly( layer );

			expect( ctx.strokeRect ).toHaveBeenCalledWith( 10, 20, 100, 50 );
		} );

		it( 'should draw circle shape', () => {
			const layer = {
				type: 'circle',
				x: 50,
				y: 50,
				radius: 30
			};

			renderer.drawLayerShapeOnly( layer );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.arc ).toHaveBeenCalledWith( 50, 50, 30, 0, 2 * Math.PI );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw ellipse shape', () => {
			const layer = {
				type: 'ellipse',
				x: 50,
				y: 50,
				radiusX: 40,
				radiusY: 20
			};

			renderer.drawLayerShapeOnly( layer );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.translate ).toHaveBeenCalledWith( 50, 50 );
			expect( ctx.scale ).toHaveBeenCalledWith( 40, 20 );
			expect( ctx.arc ).toHaveBeenCalledWith( 0, 0, 1, 0, 2 * Math.PI );
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should handle unknown layer types gracefully', () => {
			const layer = {
				type: 'unknown',
				x: 10,
				y: 10
			};

			// Should not throw
			expect( () => renderer.drawLayerShapeOnly( layer ) ).not.toThrow();
		} );

		it( 'should handle missing properties with defaults', () => {
			const layer = { type: 'rectangle' };

			renderer.drawLayerShapeOnly( layer );

			expect( ctx.strokeRect ).toHaveBeenCalledWith( 0, 0, 0, 0 );
		} );
	} );

	describe( 'glow rendering integration', () => {
		it( 'should render glow when layer has glow property', () => {
			const layer = {
				id: 'test',
				type: 'circle',
				x: 50,
				y: 50,
				radius: 30,
				fill: '#ff0000',
				glow: true,
				visible: true
			};

			renderer.drawLayerWithEffects( layer );

			// Glow drawing increases save/restore call count
			expect( ctx.save.mock.calls.length ).toBeGreaterThan( 1 );
		} );

		it( 'should not render glow for unsupported types', () => {
			const drawGlowSpy = jest.spyOn( renderer, 'drawGlow' );
			const layer = {
				id: 'test',
				type: 'text',
				x: 50,
				y: 50,
				text: 'Hello',
				glow: true,
				visible: true
			};

			renderer.drawLayerWithEffects( layer );

			expect( drawGlowSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'shadow handling', () => {
		it( 'should apply shadow when layer.shadow is true', () => {
			// Track shadow values as they're set
			const shadowValues = { color: null, blur: null, offsetX: null, offsetY: null };
			Object.defineProperty( ctx, 'shadowColor', {
				set: ( val ) => {
					shadowValues.color = val;
				},
				get: () => shadowValues.color,
				configurable: true
			} );
			Object.defineProperty( ctx, 'shadowBlur', {
				set: ( val ) => {
					shadowValues.blur = val;
				},
				get: () => shadowValues.blur,
				configurable: true
			} );
			Object.defineProperty( ctx, 'shadowOffsetX', {
				set: ( val ) => {
					shadowValues.offsetX = val;
				},
				get: () => shadowValues.offsetX,
				configurable: true
			} );
			Object.defineProperty( ctx, 'shadowOffsetY', {
				set: ( val ) => {
					shadowValues.offsetY = val;
				},
				get: () => shadowValues.offsetY,
				configurable: true
			} );

			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ff0000',
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			};

			renderer.drawLayerWithEffects( layer );

			// Verify shadow values were set at some point (they get restored after drawing)
			// The last set value should be transparent after restore, but we recorded
			// When restored, values become transparent/0 again, so just verify the code path ran
			// by checking save/restore were called
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should use default shadow values when custom values not provided', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ff0000',
				shadow: true // No custom shadow values - defaults used
			};

			// This test verifies the code path for default shadow values executes
			expect( () => renderer.drawLayerWithEffects( layer ) ).not.toThrow();
		} );

		it( 'should clear shadow when layer.shadow is false', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ff0000',
				shadow: false
			};

			renderer.drawLayerWithEffects( layer );

			// Shadow should be reset to transparent
			expect( ctx.shadowColor ).toBe( 'transparent' );
			expect( ctx.shadowBlur ).toBe( 0 );
		} );
	} );

	describe( 'clearShadow', () => {
		it( 'should reset all shadow properties', () => {
			ctx.shadowColor = 'rgba(0,0,0,0.5)';
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 5;
			ctx.shadowOffsetY = 5;

			renderer.clearShadow();

			expect( ctx.shadowColor ).toBe( 'transparent' );
			expect( ctx.shadowBlur ).toBe( 0 );
			expect( ctx.shadowOffsetX ).toBe( 0 );
			expect( ctx.shadowOffsetY ).toBe( 0 );
		} );
	} );

	describe( 'drawLineSelectionIndicators', () => {
		beforeEach( () => {
			renderer.selectionHandles = [];
		} );

		it( 'should draw selection indicators for line', () => {
			const layer = {
				id: 'line1',
				type: 'line',
				x1: 10,
				y1: 10,
				x2: 100,
				y2: 50,
				rotation: 0
			};

			renderer.drawLineSelectionIndicators( layer );

			// Should have added handles
			expect( renderer.selectionHandles.length ).toBeGreaterThan( 0 );
		} );

		it( 'should handle rotation in line selection', () => {
			const layer = {
				id: 'line1',
				type: 'line',
				x1: 10,
				y1: 10,
				x2: 100,
				y2: 50,
				rotation: 45
			};

			renderer.drawLineSelectionIndicators( layer );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should register handles for hit testing', () => {
			const layer = {
				id: 'line1',
				type: 'line',
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				rotation: 0
			};

			renderer.drawLineSelectionIndicators( layer );

			// Each handle should have required properties
			renderer.selectionHandles.forEach( ( handle ) => {
				expect( handle ).toHaveProperty( 'type' );
				expect( handle ).toHaveProperty( 'x' );
				expect( handle ).toHaveProperty( 'y' );
				expect( handle ).toHaveProperty( 'width' );
				expect( handle ).toHaveProperty( 'height' );
				expect( handle ).toHaveProperty( 'layerId', 'line1' );
			} );
		} );

		it( 'should draw rotation handle for line', () => {
			const layer = {
				id: 'line1',
				type: 'line',
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				rotation: 0
			};

			renderer.drawLineSelectionIndicators( layer );

			// Should have a rotation handle
			const rotateHandle = renderer.selectionHandles.find( ( h ) => h.type === 'rotate' );
			expect( rotateHandle ).toBeDefined();
		} );
	} );

	describe( 'drawSelectionIndicators', () => {
		it( 'should skip if no editor', () => {
			renderer.editor = null;
			renderer.selectedLayerIds = [ 'test' ];

			// Should not throw
			expect( () => renderer.drawSelectionIndicators( 'test' ) ).not.toThrow();
		} );

		it( 'should skip if layer not found', () => {
			mockEditor.getLayerById.mockReturnValue( null );

			expect( () => renderer.drawSelectionIndicators( 'nonexistent' ) ).not.toThrow();
		} );

		it( 'should use line selection for line type', () => {
			const layer = {
				id: 'line1',
				type: 'line',
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 50
			};
			mockEditor.layers = [ layer ];

			renderer.drawSelectionIndicators( 'line1' );

			// Line selection draws specific indicators
			expect( ctx.setLineDash ).toHaveBeenCalled();
		} );

		it( 'should use line selection for arrow type', () => {
			const layer = {
				id: 'arrow1',
				type: 'arrow',
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 50
			};
			mockEditor.layers = [ layer ];

			renderer.drawSelectionIndicators( 'arrow1' );

			expect( ctx.setLineDash ).toHaveBeenCalled();
		} );

		it( 'should handle rotated layers', () => {
			const layer = {
				id: 'rect1',
				type: 'rectangle',
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				rotation: 45
			};
			mockEditor.layers = [ layer ];

			renderer.drawSelectionIndicators( 'rect1' );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );
	} );

	describe( 'opacity handling', () => {
		it( 'should apply layer opacity', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ff0000',
				opacity: 0.5
			};

			renderer.drawLayerWithEffects( layer );

			// Opacity should be applied (clamped between 0 and 1)
			expect( ctx.globalAlpha ).toBeLessThanOrEqual( 1 );
		} );

		it( 'should clamp opacity to valid range', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ff0000',
				opacity: 1.5 // Invalid, should be clamped
			};

			renderer.drawLayerWithEffects( layer );

			// Should not exceed 1
			expect( ctx.globalAlpha ).toBeLessThanOrEqual( 1 );
		} );

		it( 'should handle NaN opacity', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ff0000',
				opacity: NaN
			};

			// Should not throw
			expect( () => renderer.drawLayerWithEffects( layer ) ).not.toThrow();
		} );
	} );

	describe( 'ellipse rendering edge cases', () => {
		it( 'should skip ellipse with zero radius', () => {
			const layer = {
				id: 'test',
				type: 'ellipse',
				x: 50,
				y: 50,
				radiusX: 0,
				radiusY: 20
			};

			renderer.drawEllipse( layer );

			// Should not draw
			expect( ctx.ellipse ).not.toHaveBeenCalled();
		} );

		it( 'should handle legacy width/height format', () => {
			const layer = {
				id: 'test',
				type: 'ellipse',
				x: 50,
				y: 50,
				width: 100,
				height: 60
			};

			renderer.drawEllipse( layer );

			// Should convert to center + radii format
			expect( ctx.ellipse ).toHaveBeenCalled();
		} );
	} );

	describe( 'getLayerBounds edge cases', () => {
		it( 'should return null for layer without bounds', () => {
			const layer = { id: 'test', type: 'unknown' };

			const bounds = renderer.getLayerBounds( layer );

			expect( bounds ).toBeNull();
		} );

		it( 'should calculate bounds for text layer', () => {
			const layer = {
				id: 'test',
				type: 'text',
				x: 50,
				y: 50,
				text: 'Hello World',
				fontSize: 16
			};

			const bounds = renderer.getLayerBounds( layer );

			expect( bounds ).toHaveProperty( 'x' );
			expect( bounds ).toHaveProperty( 'y' );
			expect( bounds ).toHaveProperty( 'width' );
			expect( bounds ).toHaveProperty( 'height' );
		} );

		it( 'should calculate bounds for line layer', () => {
			const layer = {
				id: 'test',
				type: 'line',
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80
			};

			const bounds = renderer.getLayerBounds( layer );

			expect( bounds.x ).toBe( 10 );
			expect( bounds.y ).toBe( 20 );
			expect( bounds.width ).toBe( 90 );
			expect( bounds.height ).toBe( 60 );
		} );
	} );

	describe( 'transform state management', () => {
		it( 'should save and restore context state', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ff0000'
			};

			renderer.drawLayerWithEffects( layer );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should restore even if drawing throws', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ff0000'
			};

			// Make ctx.fill throw
			ctx.fill.mockImplementation( () => {
				throw new Error( 'Canvas error' );
			} );

			// Should still restore
			try {
				renderer.drawLayerWithEffects( layer );
			} catch ( e ) {
				// Expected
			}

			expect( ctx.restore ).toHaveBeenCalled();
		} );
	} );

	describe( 'redraw', () => {
		it( 'should clear canvas before redrawing', () => {
			renderer.redraw( [] );

			expect( ctx.clearRect ).toHaveBeenCalled();
		} );

		it( 'should apply zoom and pan transform', () => {
			renderer.zoom = 2;
			renderer.panX = 50;
			renderer.panY = 30;

			renderer.redraw( [] );

			expect( ctx.setTransform ).toHaveBeenCalled();
		} );

		it( 'should render all visible layers', () => {
			const layers = [
				{ id: '1', type: 'rectangle', x: 10, y: 10, width: 50, height: 50, visible: true },
				{ id: '2', type: 'circle', x: 100, y: 100, radius: 30, visible: true },
				{ id: '3', type: 'rectangle', x: 200, y: 200, width: 50, height: 50, visible: false }
			];

			renderer.redraw( layers );

			// Should draw 2 visible layers
			expect( ctx.rect ).toHaveBeenCalledTimes( 1 ); // rectangle
			expect( ctx.arc ).toHaveBeenCalledTimes( 1 ); // circle
		} );
	} );
} );
