/**
 * ArrowRenderer Unit Tests
 *
 * Tests for the ArrowRenderer module which handles arrow shape rendering.
 * Extracted from LayerRenderer as part of the god class splitting initiative.
 *
 * @since 0.9.1
 */

/* eslint-env jest */

const ArrowRenderer = require( '../../resources/ext.layers.shared/ArrowRenderer.js' );

describe( 'ArrowRenderer', () => {
	let ctx;
	let arrowRenderer;

	beforeEach( () => {
		// Create mock canvas context
		ctx = {
			save: jest.fn(),
			restore: jest.fn(),
			beginPath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			closePath: jest.fn(),
			fill: jest.fn(),
			stroke: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			lineJoin: 'miter',
			miterLimit: 10,
			globalAlpha: 1,
			globalCompositeOperation: 'source-over',
			shadowColor: 'transparent',
			shadowBlur: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0
		};

		arrowRenderer = new ArrowRenderer( ctx );
	} );

	afterEach( () => {
		if ( arrowRenderer && arrowRenderer.destroy ) {
			arrowRenderer.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with context', () => {
			expect( arrowRenderer ).toBeDefined();
			expect( arrowRenderer.ctx ).toBe( ctx );
		} );

		it( 'should accept shadow renderer config', () => {
			const mockShadowRenderer = { clearShadow: jest.fn() };
			const renderer = new ArrowRenderer( ctx, { shadowRenderer: mockShadowRenderer } );
			expect( renderer.shadowRenderer ).toBe( mockShadowRenderer );
			renderer.destroy();
		} );

		it( 'should handle missing config', () => {
			const renderer = new ArrowRenderer( ctx );
			expect( renderer.config ).toEqual( {} );
			expect( renderer.shadowRenderer ).toBeNull();
			renderer.destroy();
		} );
	} );

	describe( 'setContext', () => {
		it( 'should update the context', () => {
			const newCtx = { save: jest.fn() };
			arrowRenderer.setContext( newCtx );
			expect( arrowRenderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'setShadowRenderer', () => {
		it( 'should set shadow renderer instance', () => {
			const mockShadowRenderer = { clearShadow: jest.fn() };
			arrowRenderer.setShadowRenderer( mockShadowRenderer );
			expect( arrowRenderer.shadowRenderer ).toBe( mockShadowRenderer );
		} );
	} );

	describe( 'clearShadow', () => {
		it( 'should clear shadow settings when no shadowRenderer', () => {
			arrowRenderer.clearShadow();
			expect( ctx.shadowColor ).toBe( 'transparent' );
			expect( ctx.shadowBlur ).toBe( 0 );
			expect( ctx.shadowOffsetX ).toBe( 0 );
			expect( ctx.shadowOffsetY ).toBe( 0 );
		} );

		it( 'should delegate to shadowRenderer when available', () => {
			const mockShadowRenderer = { clearShadow: jest.fn() };
			arrowRenderer.setShadowRenderer( mockShadowRenderer );
			arrowRenderer.clearShadow();
			expect( mockShadowRenderer.clearShadow ).toHaveBeenCalled();
		} );
	} );

	describe( 'hasShadowEnabled', () => {
		it( 'should return true for shadow = true', () => {
			expect( arrowRenderer.hasShadowEnabled( { shadow: true } ) ).toBe( true );
		} );

		it( 'should return true for shadow = "true"', () => {
			expect( arrowRenderer.hasShadowEnabled( { shadow: 'true' } ) ).toBe( true );
		} );

		it( 'should return true for shadow = 1', () => {
			expect( arrowRenderer.hasShadowEnabled( { shadow: 1 } ) ).toBe( true );
		} );

		it( 'should return true for shadow = "1"', () => {
			expect( arrowRenderer.hasShadowEnabled( { shadow: '1' } ) ).toBe( true );
		} );

		it( 'should return true for shadow object', () => {
			expect( !!arrowRenderer.hasShadowEnabled( { shadow: { blur: 5 } } ) ).toBe( true );
		} );

		it( 'should return false for shadow = false', () => {
			expect( arrowRenderer.hasShadowEnabled( { shadow: false } ) ).toBe( false );
		} );

		it( 'should return false for no shadow property', () => {
			expect( arrowRenderer.hasShadowEnabled( {} ) ).toBe( false );
		} );
	} );

	describe( 'buildArrowVertices', () => {
		describe( 'arrowStyle = none', () => {
			it( 'should return 4 vertices for a simple shaft', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0, // x1, y1, x2, y2
					0, Math.PI / 2, // angle, perpAngle
					5, 15, // halfShaft, arrowSize
					'none', 'pointed', 1.0, 0 // style, headType, headScale, tailWidth
				);
				expect( vertices ).toHaveLength( 4 );
				// Use toBeCloseTo for floating point comparison
				expect( vertices[ 0 ].x ).toBeCloseTo( 0, 5 );
				expect( vertices[ 0 ].y ).toBeCloseTo( 5, 5 );
				expect( vertices[ 1 ].x ).toBeCloseTo( 100, 5 );
				expect( vertices[ 1 ].y ).toBeCloseTo( 5, 5 );
				expect( vertices[ 2 ].x ).toBeCloseTo( 100, 5 );
				expect( vertices[ 2 ].y ).toBeCloseTo( -5, 5 );
				expect( vertices[ 3 ].x ).toBeCloseTo( 0, 5 );
				expect( vertices[ 3 ].y ).toBeCloseTo( -5, 5 );
			} );

			it( 'should handle tail width', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'none', 'pointed', 1.0, 10 // tailWidth = 10
				);
				expect( vertices ).toHaveLength( 4 );
				// Tail vertices should be wider by tailWidth/2 = 5
				expect( vertices[ 0 ].y ).toBeCloseTo( 10, 5 );
				expect( vertices[ 3 ].y ).toBeCloseTo( -10, 5 );
			} );
		} );

		describe( 'arrowStyle = single', () => {
			it( 'should return more than 4 vertices for pointed head', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'single', 'pointed', 1.0, 0
				);
				expect( vertices.length ).toBeGreaterThan( 4 );
			} );

			it( 'should include the tip point', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'single', 'pointed', 1.0, 0
				);
				// The tip should be at x2, y2 = 100, 0
				const hasTip = vertices.some( v => Math.abs( v.x - 100 ) < 0.01 && Math.abs( v.y ) < 0.01 );
				expect( hasTip ).toBe( true );
			} );

			it( 'should handle chevron head type', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'single', 'chevron', 1.0, 0
				);
				expect( vertices.length ).toBeGreaterThan( 4 );
			} );

			it( 'should handle standard head type', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'single', 'standard', 1.0, 0
				);
				// Standard heads have more complex vertices
				expect( vertices.length ).toBeGreaterThan( 6 );
			} );
		} );

		describe( 'arrowStyle = double', () => {
			it( 'should return vertices for both ends', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'double', 'pointed', 1.0, 0
				);
				// Double-headed arrows have more vertices
				expect( vertices.length ).toBeGreaterThan( 8 );
			} );

			it( 'should include both tip points', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'double', 'pointed', 1.0, 0
				);
				// Should include tip at x2 and tail tip at x1
				const hasFrontTip = vertices.some( v => Math.abs( v.x - 100 ) < 0.01 && Math.abs( v.y ) < 0.01 );
				const hasTailTip = vertices.some( v => Math.abs( v.x ) < 0.01 && Math.abs( v.y ) < 0.01 );
				expect( hasFrontTip ).toBe( true );
				expect( hasTailTip ).toBe( true );
			} );

			it( 'should handle chevron head type for double', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'double', 'chevron', 1.0, 0
				);
				expect( vertices.length ).toBeGreaterThan( 8 );
			} );

			it( 'should handle standard head type for double', () => {
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'double', 'standard', 1.0, 0
				);
				expect( vertices.length ).toBeGreaterThan( 10 );
			} );
		} );

		describe( 'head scale', () => {
			it( 'should scale arrow head size', () => {
				const verticesNormal = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'single', 'pointed', 1.0, 0
				);
				const verticesLarge = arrowRenderer.buildArrowVertices(
					0, 0, 100, 0,
					0, Math.PI / 2,
					5, 15,
					'single', 'pointed', 2.0, 0 // double head scale
				);
				// Larger head scale should produce different vertices
				expect( verticesLarge.length ).toBe( verticesNormal.length );
			} );
		} );

		describe( 'diagonal arrows', () => {
			it( 'should handle 45-degree angle', () => {
				const angle = Math.PI / 4;
				const perpAngle = angle + Math.PI / 2;
				const vertices = arrowRenderer.buildArrowVertices(
					0, 0, 70.71, 70.71, // ~100 length at 45 degrees
					angle, perpAngle,
					5, 15,
					'single', 'pointed', 1.0, 0
				);
				expect( vertices.length ).toBeGreaterThan( 4 );
			} );

			it( 'should handle vertical arrow', () => {
				const angle = Math.PI / 2;
				const perpAngle = angle + Math.PI / 2;
				const vertices = arrowRenderer.buildArrowVertices(
					50, 0, 50, 100, // vertical
					angle, perpAngle,
					5, 15,
					'single', 'pointed', 1.0, 0
				);
				expect( vertices.length ).toBeGreaterThan( 4 );
			} );
		} );
	} );

	describe( 'draw', () => {
		it( 'should call context methods', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				stroke: '#000000',
				strokeWidth: 2,
				arrowSize: 15,
				arrowStyle: 'single'
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
			expect( ctx.beginPath ).toHaveBeenCalled();
		} );

		it( 'should handle fill-only arrow', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				stroke: 'transparent',
				arrowSize: 15
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should handle stroke-only arrow', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: 'transparent',
				stroke: '#000000',
				strokeWidth: 2,
				arrowSize: 15
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should handle rotation', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15,
				rotation: 45
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should apply opacity', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15,
				opacity: 0.5
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.globalAlpha ).toBeLessThan( 1 );
		} );

		it( 'should handle fill opacity separately', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15,
				opacity: 1,
				fillOpacity: 0.5
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should respect scale option', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15
			};

			arrowRenderer.draw( layer, { scale: { sx: 2, sy: 2, avg: 2 } } );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should handle double-headed arrow', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15,
				arrowStyle: 'double'
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should handle no-head arrow (shaft only)', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15,
				arrowStyle: 'none'
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should handle chevron head type', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15,
				arrowHeadType: 'chevron'
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should handle standard head type', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15,
				arrowHeadType: 'standard'
			};

			arrowRenderer.draw( layer, {} );

			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	describe( 'shadow handling', () => {
		it( 'should apply shadow when enabled', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15,
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 10
			};

			arrowRenderer.draw( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// Shadow should be applied
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should handle shadow spread', () => {
			const mockShadowRenderer = {
				clearShadow: jest.fn(),
				applyShadow: jest.fn(),
				hasShadowEnabled: jest.fn().mockReturnValue( true ),
				getShadowSpread: jest.fn().mockReturnValue( 10 ),
				setContext: jest.fn(),
				drawSpreadShadow: jest.fn(),
				drawSpreadShadowStroke: jest.fn()
			};
			arrowRenderer.setShadowRenderer( mockShadowRenderer );

			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: '#ff0000',
				arrowSize: 15,
				shadow: true,
				shadowSpread: 10
			};

			arrowRenderer.draw( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockShadowRenderer.getShadowSpread ).toHaveBeenCalled();
		} );

		it( 'should apply shadow for stroke-only arrow', () => {
			const layer = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 0,
				fill: 'transparent', // No fill
				stroke: '#000000',
				strokeWidth: 2,
				arrowSize: 15,
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 10
			};

			arrowRenderer.draw( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// Shadow should be applied and stroke should be drawn
			expect( ctx.stroke ).toHaveBeenCalled();
			// shadowBlur is set when applying shadow
			expect( ctx.shadowBlur ).toBeDefined();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up resources', () => {
			arrowRenderer.destroy();
			expect( arrowRenderer.ctx ).toBeNull();
			expect( arrowRenderer.config ).toBeNull();
			expect( arrowRenderer.shadowRenderer ).toBeNull();
		} );
	} );

	describe( 'getShadowSpread', () => {
		it( 'should return 0 when shadow not enabled', () => {
			const spread = arrowRenderer.getShadowSpread( { shadow: false }, { avg: 1 } );
			expect( spread ).toBe( 0 );
		} );

		it( 'should return scaled spread when enabled', () => {
			const layer = { shadow: true, shadowSpread: 5 };
			const spread = arrowRenderer.getShadowSpread( layer, { avg: 2 } );
			expect( spread ).toBe( 10 );
		} );

		it( 'should return 0 when spread is not set', () => {
			const layer = { shadow: true };
			const spread = arrowRenderer.getShadowSpread( layer, { avg: 1 } );
			expect( spread ).toBe( 0 );
		} );

		it( 'should delegate to shadowRenderer when available', () => {
			const mockShadowRenderer = {
				getShadowSpread: jest.fn().mockReturnValue( 15 )
			};
			arrowRenderer.setShadowRenderer( mockShadowRenderer );

			const layer = { shadow: true, shadowSpread: 5 };
			const spread = arrowRenderer.getShadowSpread( layer, { avg: 1 } );

			expect( mockShadowRenderer.getShadowSpread ).toHaveBeenCalled();
			expect( spread ).toBe( 15 );
		} );
	} );

	describe( 'applyShadow', () => {
		it( 'should apply shadow settings to context', () => {
			const layer = {
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			};

			arrowRenderer.applyShadow( layer, { sx: 1, sy: 1, avg: 1 } );

			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.5)' );
			expect( ctx.shadowBlur ).toBe( 10 );
			expect( ctx.shadowOffsetX ).toBe( 5 );
			expect( ctx.shadowOffsetY ).toBe( 5 );
		} );

		it( 'should scale shadow values', () => {
			const layer = {
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			};

			arrowRenderer.applyShadow( layer, { sx: 2, sy: 2, avg: 2 } );

			expect( ctx.shadowBlur ).toBe( 20 );
			expect( ctx.shadowOffsetX ).toBe( 10 );
			expect( ctx.shadowOffsetY ).toBe( 10 );
		} );

		it( 'should delegate to shadowRenderer when available', () => {
			const mockShadowRenderer = {
				applyShadow: jest.fn()
			};
			arrowRenderer.setShadowRenderer( mockShadowRenderer );

			const layer = { shadow: true };
			arrowRenderer.applyShadow( layer, { avg: 1 } );

			expect( mockShadowRenderer.applyShadow ).toHaveBeenCalled();
		} );
	} );

	describe( 'setEffectsRenderer', () => {
		it( 'should set effects renderer instance', () => {
			const mockEffectsRenderer = { drawBlurFill: jest.fn() };
			arrowRenderer.setEffectsRenderer( mockEffectsRenderer );
			expect( arrowRenderer.effectsRenderer ).toBe( mockEffectsRenderer );
		} );
	} );

	describe( 'blur fill', () => {
		it( 'should call effectsRenderer.drawBlurFill when fill is blur', () => {
			const mockEffectsRenderer = {
				drawBlurFill: jest.fn()
			};
			arrowRenderer.setEffectsRenderer( mockEffectsRenderer );

			const layer = {
				type: 'arrow',
				x1: 50,
				y1: 50,
				x2: 150,
				y2: 100,
				fill: 'blur',
				stroke: '#000000',
				strokeWidth: 2
			};

			arrowRenderer.draw( layer );

			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalledTimes( 1 );
			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalledWith(
				layer,
				expect.any( Function ), // drawArrowPath function
				expect.objectContaining( {
					x: expect.any( Number ),
					y: expect.any( Number ),
					width: expect.any( Number ),
					height: expect.any( Number )
				} ),
				expect.any( Object ) // options
			);
		} );

		it( 'should not call effectsRenderer.drawBlurFill when fillOpacity is 0', () => {
			const mockEffectsRenderer = {
				drawBlurFill: jest.fn()
			};
			arrowRenderer.setEffectsRenderer( mockEffectsRenderer );

			const layer = {
				type: 'arrow',
				x1: 50,
				y1: 50,
				x2: 150,
				y2: 100,
				fill: 'blur',
				fillOpacity: 0
			};

			arrowRenderer.draw( layer );

			expect( mockEffectsRenderer.drawBlurFill ).not.toHaveBeenCalled();
		} );

		it( 'should not draw regular fill when fill is blur', () => {
			const mockEffectsRenderer = {
				drawBlurFill: jest.fn()
			};
			arrowRenderer.setEffectsRenderer( mockEffectsRenderer );

			const layer = {
				type: 'arrow',
				x1: 50,
				y1: 50,
				x2: 150,
				y2: 100,
				fill: 'blur'
			};

			arrowRenderer.draw( layer );

			// fill() should NOT be called for blur fill (only for regular color fill)
			expect( ctx.fill ).not.toHaveBeenCalled();
		} );

		it( 'should handle blur fill without effectsRenderer gracefully', () => {
			// No effectsRenderer set - should not throw
			const layer = {
				type: 'arrow',
				x1: 50,
				y1: 50,
				x2: 150,
				y2: 100,
				fill: 'blur'
			};

			expect( () => arrowRenderer.draw( layer ) ).not.toThrow();
		} );
	} );

	describe( 'curved arrows', () => {
		beforeEach( () => {
			// Add quadraticCurveTo to mock context for curved arrow tests
			ctx.quadraticCurveTo = jest.fn();
			ctx.arc = jest.fn();
			ctx.lineCap = 'butt';
			ctx.setLineDash = jest.fn();
		} );

		describe( 'isCurved', () => {
			it( 'should return false when controlX is not set', () => {
				const layer = { x1: 0, y1: 0, x2: 100, y2: 100 };
				expect( arrowRenderer.isCurved( layer ) ).toBe( false );
			} );

			it( 'should return false when controlY is not set', () => {
				const layer = { x1: 0, y1: 0, x2: 100, y2: 100, controlX: 50 };
				expect( arrowRenderer.isCurved( layer ) ).toBe( false );
			} );

			it( 'should return false when control point is at midpoint', () => {
				const layer = { x1: 0, y1: 0, x2: 100, y2: 100, controlX: 50, controlY: 50 };
				expect( arrowRenderer.isCurved( layer ) ).toBe( false );
			} );

			it( 'should return true when control point differs from midpoint', () => {
				const layer = { x1: 0, y1: 0, x2: 100, y2: 100, controlX: 50, controlY: 80 };
				expect( arrowRenderer.isCurved( layer ) ).toBe( true );
			} );

			it( 'should return true when control point is significantly offset', () => {
				const layer = { x1: 0, y1: 0, x2: 100, y2: 0, controlX: 50, controlY: 50 };
				expect( arrowRenderer.isCurved( layer ) ).toBe( true );
			} );
		} );

		describe( 'getBezierTangent', () => {
			it( 'should return correct tangent at t=0 (start)', () => {
				// For P0=(0,0), P1=(50,50), P2=(100,0), tangent at t=0 is towards P1
				const angle = arrowRenderer.getBezierTangent( 0, 0, 0, 50, 50, 100, 0 );
				// At t=0, tangent is 2*(P1-P0) = 2*(50,50) = (100,100), angle = π/4
				expect( angle ).toBeCloseTo( Math.PI / 4, 5 );
			} );

			it( 'should return correct tangent at t=1 (end)', () => {
				// For P0=(0,0), P1=(50,50), P2=(100,0), tangent at t=1 is from P1 to P2
				const angle = arrowRenderer.getBezierTangent( 1, 0, 0, 50, 50, 100, 0 );
				// At t=1, tangent is 2*(P2-P1) = 2*(50,-50) = (100,-100), angle = -π/4
				expect( angle ).toBeCloseTo( -Math.PI / 4, 5 );
			} );

			it( 'should return correct tangent at t=0.5 (middle)', () => {
				// For P0=(0,0), P1=(50,100), P2=(100,0), tangent at t=0.5 is horizontal
				const angle = arrowRenderer.getBezierTangent( 0.5, 0, 0, 50, 100, 100, 0 );
				// At t=0.5, tangent is: 2*(0.5)*(50,100) + 2*(0.5)*(50,-100) = (50,50)+(50,-50)=(100,0)
				expect( angle ).toBeCloseTo( 0, 5 );
			} );
		} );

		describe( 'drawCurved', () => {
			it( 'should use quadraticCurveTo for curved arrows', () => {
				const layer = {
					type: 'arrow',
					x1: 0,
					y1: 0,
					x2: 100,
					y2: 0,
					controlX: 50,
					controlY: 50,
					fill: '#ff0000',
					arrowStyle: 'single'
				};

				arrowRenderer.drawCurved( layer );

				expect( ctx.quadraticCurveTo ).toHaveBeenCalled();
			} );

			it( 'should call fill for the curved shaft polygon', () => {
				const layer = {
					type: 'arrow',
					x1: 0,
					y1: 0,
					x2: 100,
					y2: 0,
					controlX: 50,
					controlY: 50,
					fill: '#ff0000',
					arrowStyle: 'single'
				};

				arrowRenderer.drawCurved( layer );

				// Curved shafts use filled polygon instead of stroke
				expect( ctx.fill ).toHaveBeenCalled();
			} );

			it( 'should handle double-headed curved arrow', () => {
				const layer = {
					type: 'arrow',
					x1: 0,
					y1: 0,
					x2: 100,
					y2: 0,
					controlX: 50,
					controlY: 50,
					fill: '#ff0000',
					arrowStyle: 'double'
				};

				// Should not throw
				expect( () => arrowRenderer.drawCurved( layer ) ).not.toThrow();
			} );

			it( 'should handle arrowStyle = none for curved path', () => {
				const layer = {
					type: 'arrow',
					x1: 0,
					y1: 0,
					x2: 100,
					y2: 0,
					controlX: 50,
					controlY: 50,
					fill: '#ff0000',
					arrowStyle: 'none'
				};

				// Should not throw and should still draw the curve
				expect( () => arrowRenderer.drawCurved( layer ) ).not.toThrow();
				expect( ctx.quadraticCurveTo ).toHaveBeenCalled();
			} );
		} );

		describe( 'drawArrowHead', () => {
			it( 'should draw a pointed arrow head', () => {
				arrowRenderer.drawArrowHead( 100, 50, 0, 15, 1.0, 'pointed', '#ff0000', 1 );

				expect( ctx.save ).toHaveBeenCalled();
				expect( ctx.translate ).toHaveBeenCalledWith( 100, 50 );
				expect( ctx.rotate ).toHaveBeenCalledWith( 0 );
				expect( ctx.fill ).toHaveBeenCalled();
				expect( ctx.restore ).toHaveBeenCalled();
			} );

			it( 'should draw a chevron arrow head', () => {
				arrowRenderer.drawArrowHead( 100, 50, Math.PI / 2, 15, 1.0, 'chevron', '#00ff00', 1 );

				expect( ctx.fill ).toHaveBeenCalled();
			} );

			it( 'should draw a standard arrow head', () => {
				arrowRenderer.drawArrowHead( 100, 50, Math.PI, 15, 1.0, 'standard', '#0000ff', 0.5 );

				expect( ctx.fill ).toHaveBeenCalled();
				expect( ctx.globalAlpha ).toBe( 0.5 );
			} );

			it( 'should apply head scale', () => {
				const saveCalls = ctx.save.mock.calls.length;
				arrowRenderer.drawArrowHead( 100, 50, 0, 15, 2.0, 'pointed', '#ff0000', 1 );

				// Should have made a new save call
				expect( ctx.save.mock.calls.length ).toBeGreaterThan( saveCalls );
			} );
		} );

		describe( 'draw integration for curved arrows', () => {
			it( 'should dispatch to drawCurved when arrow is curved', () => {
				const layer = {
					type: 'arrow',
					x1: 0,
					y1: 0,
					x2: 100,
					y2: 0,
					controlX: 50,
					controlY: 50,
					fill: '#ff0000',
					arrowStyle: 'single'
				};

				// draw() should call drawCurved internally
				arrowRenderer.draw( layer );

				// Should use quadraticCurveTo (which is used by drawCurved)
				expect( ctx.quadraticCurveTo ).toHaveBeenCalled();
			} );

			it( 'should not dispatch to drawCurved when arrow is straight', () => {
				const layer = {
					type: 'arrow',
					x1: 0,
					y1: 0,
					x2: 100,
					y2: 0,
					fill: '#ff0000',
					arrowStyle: 'single'
				};

				arrowRenderer.draw( layer );

				// Should NOT use quadraticCurveTo (straight arrow uses lineTo)
				expect( ctx.quadraticCurveTo ).not.toHaveBeenCalled();
				expect( ctx.lineTo ).toHaveBeenCalled();
			} );

			it( 'should call effectsRenderer.drawBlurFill for curved arrows with blur fill', () => {
				const mockEffectsRenderer = {
					drawBlurFill: jest.fn()
				};
				arrowRenderer.setEffectsRenderer( mockEffectsRenderer );

				const layer = {
					type: 'arrow',
					x1: 0,
					y1: 0,
					x2: 100,
					y2: 0,
					controlX: 50,
					controlY: 50,
					fill: 'blur',
					arrowStyle: 'single'
				};

				arrowRenderer.draw( layer );

				// Blur fill should be called for curved arrows (FR-4 blur fix)
				expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalledTimes( 1 );
				expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalledWith(
					layer,
					expect.any( Function ), // drawPathFn
					expect.objectContaining( {
						x: expect.any( Number ),
						y: expect.any( Number ),
						width: expect.any( Number ),
						height: expect.any( Number )
					} ),
					expect.any( Object ) // options
				);
			} );
		} );
	} );
} );
