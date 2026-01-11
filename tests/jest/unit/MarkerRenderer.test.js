/**
 * MarkerRenderer tests
 */
const MarkerRenderer = require( '../../../resources/ext.layers.shared/MarkerRenderer.js' );

describe( 'MarkerRenderer', () => {
	let ctx;
	let renderer;

	beforeEach( () => {
		// Mock canvas context
		ctx = {
			save: jest.fn(),
			restore: jest.fn(),
			beginPath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			arc: jest.fn(),
			fill: jest.fn(),
			stroke: jest.fn(),
			fillText: jest.fn(),
			strokeText: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			lineCap: 'butt',
			lineJoin: 'miter',
			font: '',
			textAlign: 'left',
			textBaseline: 'alphabetic',
			globalAlpha: 1
		};

		renderer = new MarkerRenderer( ctx );
	} );

	describe( 'constructor', () => {
		it( 'should create instance with context', () => {
			expect( renderer ).toBeInstanceOf( MarkerRenderer );
			expect( renderer.ctx ).toBe( ctx );
		} );

		it( 'should create instance with config', () => {
			const config = { debug: true };
			const r = new MarkerRenderer( ctx, config );
			expect( r.config ).toEqual( config );
		} );
	} );

	describe( 'setContext', () => {
		it( 'should update the context', () => {
			const newCtx = { save: jest.fn() };
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'setShadowRenderer', () => {
		it( 'should set the shadow renderer', () => {
			const shadowRenderer = {
				hasShadowEnabled: jest.fn(),
				applyShadow: jest.fn(),
				clearShadow: jest.fn()
			};

			expect( renderer.shadowRenderer ).toBeNull();
			renderer.setShadowRenderer( shadowRenderer );
			expect( renderer.shadowRenderer ).toBe( shadowRenderer );
		} );
	} );

	describe( 'formatValue', () => {
		it( 'should format circled style as plain number', () => {
			expect( renderer.formatValue( 1, 'circled' ) ).toBe( '1' );
			expect( renderer.formatValue( 5, 'circled' ) ).toBe( '5' );
			expect( renderer.formatValue( 42, 'circled' ) ).toBe( '42' );
		} );

		it( 'should format parentheses style', () => {
			expect( renderer.formatValue( 1, 'parentheses' ) ).toBe( '(1)' );
			expect( renderer.formatValue( 10, 'parentheses' ) ).toBe( '(10)' );
		} );

		it( 'should format plain style with period', () => {
			expect( renderer.formatValue( 1, 'plain' ) ).toBe( '1.' );
			expect( renderer.formatValue( 99, 'plain' ) ).toBe( '99.' );
		} );

		it( 'should format letter style', () => {
			expect( renderer.formatValue( 1, 'letter' ) ).toBe( 'A' );
			expect( renderer.formatValue( 2, 'letter' ) ).toBe( 'B' );
			expect( renderer.formatValue( 26, 'letter' ) ).toBe( 'Z' );
		} );

		it( 'should format letter style beyond Z', () => {
			expect( renderer.formatValue( 27, 'letter' ) ).toBe( 'AA' );
			expect( renderer.formatValue( 28, 'letter' ) ).toBe( 'AB' );
		} );

		it( 'should format letter-circled same as letter', () => {
			expect( renderer.formatValue( 1, 'letter-circled' ) ).toBe( 'A' );
			expect( renderer.formatValue( 3, 'letter-circled' ) ).toBe( 'C' );
		} );

		it( 'should handle invalid input gracefully', () => {
			expect( renderer.formatValue( null, 'circled' ) ).toBe( '1' );
			expect( renderer.formatValue( undefined, 'circled' ) ).toBe( '1' );
			// Custom text values are now supported (e.g., '1A', '1.1')
			expect( renderer.formatValue( 'abc', 'circled' ) ).toBe( 'abc' );
		} );

		it( 'should default to circled style', () => {
			expect( renderer.formatValue( 5, 'unknown' ) ).toBe( '5' );
			expect( renderer.formatValue( 5, null ) ).toBe( '5' );
		} );
	} );

	describe( 'draw', () => {
		it( 'should return early if no context', () => {
			renderer.ctx = null;
			renderer.draw( { type: 'marker', x: 100, y: 100 } );
			expect( ctx.save ).not.toHaveBeenCalled();
		} );

		it( 'should return early if no layer', () => {
			renderer.draw( null );
			expect( ctx.save ).not.toHaveBeenCalled();
		} );

		it( 'should draw a basic circled marker', () => {
			const layer = {
				type: 'marker',
				x: 100,
				y: 100,
				value: 1,
				style: 'circled',
				size: 24,
				fill: '#ffffff',
				stroke: '#000000'
			};

			renderer.draw( layer );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 12, 0, Math.PI * 2 );
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
			expect( ctx.fillText ).toHaveBeenCalledWith( '1', 100, 100 );
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw parentheses style without circle', () => {
			const layer = {
				type: 'marker',
				x: 50,
				y: 50,
				value: 3,
				style: 'parentheses'
			};

			renderer.draw( layer );

			expect( ctx.fillText ).toHaveBeenCalledWith( '(3)', 50, 50 );
			// Should NOT draw circle for parentheses style
			expect( ctx.arc ).not.toHaveBeenCalled();
		} );

		it( 'should apply rotation when specified', () => {
			const layer = {
				type: 'marker',
				x: 100,
				y: 100,
				value: 1,
				rotation: 45
			};

			renderer.draw( layer );

			expect( ctx.translate ).toHaveBeenCalledWith( 100, 100 );
			expect( ctx.rotate ).toHaveBeenCalledWith( ( 45 * Math.PI ) / 180 );
		} );

		it( 'should apply opacity when specified', () => {
			const layer = {
				type: 'marker',
				x: 100,
				y: 100,
				value: 1,
				opacity: 0.5
			};

			renderer.draw( layer );

			expect( ctx.globalAlpha ).toBe( 0.5 );
		} );

		it( 'should draw arrow when hasArrow is true', () => {
			const layer = {
				type: 'marker',
				x: 100,
				y: 100,
				value: 1,
				hasArrow: true,
				arrowX: 200,
				arrowY: 200
			};

			renderer.draw( layer );

			// Should draw line to arrow target
			expect( ctx.moveTo ).toHaveBeenCalled();
			expect( ctx.lineTo ).toHaveBeenCalled();
		} );

		it( 'should apply text stroke when specified', () => {
			const layer = {
				type: 'marker',
				x: 100,
				y: 100,
				value: 1,
				textStrokeWidth: 2,
				textStrokeColor: '#ffffff'
			};

			renderer.draw( layer );

			expect( ctx.strokeText ).toHaveBeenCalled();
		} );

		it( 'should apply shadow when shadowRenderer is provided and shadow is enabled', () => {
			const shadowRenderer = {
				hasShadowEnabled: jest.fn().mockReturnValue( true ),
				applyShadow: jest.fn(),
				clearShadow: jest.fn()
			};

			renderer = new MarkerRenderer( ctx, { shadowRenderer } );

			const layer = {
				type: 'marker',
				x: 100,
				y: 100,
				value: 1,
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			};

			renderer.draw( layer );

			expect( shadowRenderer.hasShadowEnabled ).toHaveBeenCalledWith( layer );
			expect( shadowRenderer.applyShadow ).toHaveBeenCalledWith(
				layer,
				{ sx: 1, sy: 1, avg: 1 }
			);
			expect( shadowRenderer.clearShadow ).toHaveBeenCalled();
		} );

		it( 'should not apply shadow when shadow is disabled', () => {
			const shadowRenderer = {
				hasShadowEnabled: jest.fn().mockReturnValue( false ),
				applyShadow: jest.fn(),
				clearShadow: jest.fn()
			};

			renderer = new MarkerRenderer( ctx, { shadowRenderer } );

			const layer = {
				type: 'marker',
				x: 100,
				y: 100,
				value: 1,
				shadow: false
			};

			renderer.draw( layer );

			expect( shadowRenderer.hasShadowEnabled ).toHaveBeenCalledWith( layer );
			expect( shadowRenderer.applyShadow ).not.toHaveBeenCalled();
			expect( shadowRenderer.clearShadow ).not.toHaveBeenCalled();
		} );

		it( 'should not apply shadow when no shadowRenderer is provided', () => {
			const layer = {
				type: 'marker',
				x: 100,
				y: 100,
				value: 1,
				shadow: true
			};

			// No shadowRenderer configured
			renderer.draw( layer );

			// Should still draw without errors
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.fillText ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );
	} );

	describe( 'getBounds', () => {
		it( 'should return correct bounds for simple marker', () => {
			const layer = {
				x: 100,
				y: 100,
				size: 24,
				strokeWidth: 2
			};

			const bounds = renderer.getBounds( layer );

			expect( bounds.x ).toBe( 100 - 12 - 2 ); // x - radius - strokeWidth
			expect( bounds.y ).toBe( 100 - 12 - 2 );
			expect( bounds.width ).toBe( 28 ); // (radius + strokeWidth) * 2
			expect( bounds.height ).toBe( 28 );
		} );

		it( 'should include arrow in bounds', () => {
			const layer = {
				x: 100,
				y: 100,
				size: 24,
				strokeWidth: 2,
				hasArrow: true,
				arrowX: 50,
				arrowY: 200
			};

			const bounds = renderer.getBounds( layer );

			expect( bounds.x ).toBeLessThanOrEqual( 50 );
			expect( bounds.y ).toBeLessThanOrEqual( 100 );
			expect( bounds.y + bounds.height ).toBeGreaterThanOrEqual( 200 );
		} );
	} );

	describe( 'hitTest', () => {
		it( 'should detect hit within marker circle', () => {
			const layer = {
				x: 100,
				y: 100,
				size: 24
			};

			expect( renderer.hitTest( layer, 100, 100 ) ).toBe( true ); // center
			expect( renderer.hitTest( layer, 110, 100 ) ).toBe( true ); // edge
			expect( renderer.hitTest( layer, 90, 100 ) ).toBe( true ); // edge
		} );

		it( 'should not detect hit outside marker', () => {
			const layer = {
				x: 100,
				y: 100,
				size: 24
			};

			expect( renderer.hitTest( layer, 150, 100 ) ).toBe( false );
			expect( renderer.hitTest( layer, 100, 150 ) ).toBe( false );
		} );

		it( 'should detect hit on arrow line', () => {
			const layer = {
				x: 100,
				y: 100,
				size: 24,
				hasArrow: true,
				arrowX: 200,
				arrowY: 100
			};

			// Point on the line between marker and arrow target
			expect( renderer.hitTest( layer, 150, 100 ) ).toBe( true );
		} );
	} );

	describe( 'static methods', () => {
		describe( 'getNextValue', () => {
			it( 'should return 1 for empty layers array', () => {
				expect( MarkerRenderer.getNextValue( [] ) ).toBe( 1 );
			} );

			it( 'should return 1 for null/undefined', () => {
				expect( MarkerRenderer.getNextValue( null ) ).toBe( 1 );
				expect( MarkerRenderer.getNextValue( undefined ) ).toBe( 1 );
			} );

			it( 'should return next value after highest marker', () => {
				const layers = [
					{ type: 'marker', value: 1 },
					{ type: 'marker', value: 2 },
					{ type: 'marker', value: 5 }
				];
				expect( MarkerRenderer.getNextValue( layers ) ).toBe( 6 );
			} );

			it( 'should only count matching style when specified', () => {
				const layers = [
					{ type: 'marker', value: 1, style: 'circled' },
					{ type: 'marker', value: 3, style: 'letter' },
					{ type: 'marker', value: 2, style: 'circled' }
				];
				expect( MarkerRenderer.getNextValue( layers, 'circled' ) ).toBe( 3 );
			} );

			it( 'should ignore non-marker layers', () => {
				const layers = [
					{ type: 'rectangle', value: 100 },
					{ type: 'marker', value: 2 },
					{ type: 'text', value: 50 }
				];
				expect( MarkerRenderer.getNextValue( layers ) ).toBe( 3 );
			} );
		} );

		describe( 'createMarkerLayer', () => {
			it( 'should create layer with defaults', () => {
				const layer = MarkerRenderer.createMarkerLayer( 100, 200 );

				expect( layer.type ).toBe( 'marker' );
				expect( layer.x ).toBe( 100 );
				expect( layer.y ).toBe( 200 );
				expect( layer.value ).toBe( 1 );
				expect( layer.style ).toBe( 'circled' );
				expect( layer.size ).toBe( 24 );
				expect( layer.visible ).toBe( true );
				expect( layer.locked ).toBe( false );
			} );

			it( 'should apply custom options', () => {
				const layer = MarkerRenderer.createMarkerLayer( 50, 75, {
					value: 5,
					style: 'letter',
					size: 32,
					fill: '#ff0000'
				} );

				expect( layer.value ).toBe( 5 );
				expect( layer.style ).toBe( 'letter' );
				expect( layer.size ).toBe( 32 );
				expect( layer.fill ).toBe( '#ff0000' );
			} );

			it( 'should include arrow properties when specified', () => {
				const layer = MarkerRenderer.createMarkerLayer( 100, 100, {
					hasArrow: true,
					arrowX: 200,
					arrowY: 150
				} );

				expect( layer.hasArrow ).toBe( true );
				expect( layer.arrowX ).toBe( 200 );
				expect( layer.arrowY ).toBe( 150 );
			} );
		} );

		describe( 'STYLES', () => {
			it( 'should expose style constants', () => {
				expect( MarkerRenderer.STYLES.CIRCLED ).toBe( 'circled' );
				expect( MarkerRenderer.STYLES.PARENTHESES ).toBe( 'parentheses' );
				expect( MarkerRenderer.STYLES.PLAIN ).toBe( 'plain' );
				expect( MarkerRenderer.STYLES.LETTER ).toBe( 'letter' );
				expect( MarkerRenderer.STYLES.LETTER_CIRCLED ).toBe( 'letter-circled' );
			} );
		} );

		describe( 'DEFAULTS', () => {
			it( 'should expose default values', () => {
				const defaults = MarkerRenderer.DEFAULTS;
				expect( defaults.size ).toBe( 24 );
				// fontSize is now calculated dynamically (size * 0.58 + fontSizeAdjust)
				expect( defaults.fontSizeAdjust ).toBe( 0 );
				expect( defaults.fill ).toBe( '#ffffff' );
				expect( defaults.stroke ).toBe( '#000000' );
			} );
		} );
	} );
} );
