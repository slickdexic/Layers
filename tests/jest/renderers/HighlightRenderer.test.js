/**
 * Tests for HighlightRenderer
 *
 * @jest-environment jsdom
 */
'use strict';

const HighlightRenderer = require( '../../../resources/ext.layers.shared/renderers/HighlightRenderer.js' );

describe( 'HighlightRenderer', () => {
	let ctx;
	let renderer;
	let mockParent;

	beforeEach( () => {
		// Mock canvas context
		ctx = {
			save: jest.fn(),
			restore: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			fillRect: jest.fn(),
			fillStyle: '',
			globalAlpha: 1
		};

		// Mock parent LayerRenderer
		mockParent = {
			ctx: ctx,
			getScale: jest.fn().mockReturnValue( 1 )
		};

		renderer = new HighlightRenderer( ctx, mockParent );
	} );

	describe( 'constructor', () => {
		test( 'initializes with context and parent', () => {
			expect( renderer.ctx ).toBe( ctx );
			expect( renderer.parent ).toBe( mockParent );
		} );

		test( 'works without BaseShapeRenderer available', () => {
			// The renderer should still function even if BaseShapeRenderer isn't loaded
			const standaloneRenderer = new HighlightRenderer( ctx, null );
			expect( standaloneRenderer.ctx ).toBe( ctx );
		} );
	} );

	describe( 'draw()', () => {
		test( 'draws highlight with default values', () => {
			renderer.draw( {} );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.fillRect ).toHaveBeenCalledWith( 0, 0, 100, 20 );
			expect( ctx.fillStyle ).toBe( '#ffff00' );
			expect( ctx.globalAlpha ).toBe( 0.3 );
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'draws highlight at specified position', () => {
			renderer.draw( {
				x: 50,
				y: 100,
				width: 200,
				height: 40
			} );

			expect( ctx.fillRect ).toHaveBeenCalledWith( 50, 100, 200, 40 );
		} );

		test( 'uses custom color', () => {
			renderer.draw( {
				color: '#ff0000'
			} );

			expect( ctx.fillStyle ).toBe( '#ff0000' );
		} );

		test( 'falls back to fill property for color', () => {
			renderer.draw( {
				fill: '#00ff00'
			} );

			expect( ctx.fillStyle ).toBe( '#00ff00' );
		} );

		test( 'uses custom opacity', () => {
			renderer.draw( {
				opacity: 0.5
			} );

			expect( ctx.globalAlpha ).toBe( 0.5 );
		} );

		test( 'clamps opacity to valid range - too low', () => {
			renderer.draw( {
				opacity: -0.5
			} );

			expect( ctx.globalAlpha ).toBe( 0 );
		} );

		test( 'clamps opacity to valid range - too high', () => {
			renderer.draw( {
				opacity: 1.5
			} );

			expect( ctx.globalAlpha ).toBe( 1 );
		} );

		test( 'handles NaN opacity gracefully', () => {
			renderer.draw( {
				opacity: NaN
			} );

			// Should use default 0.3 when opacity is NaN
			expect( ctx.globalAlpha ).toBe( 0.3 );
		} );

		test( 'uses fillOpacity when opacity is not set', () => {
			renderer.draw( {
				fillOpacity: 0.7
			} );

			expect( ctx.globalAlpha ).toBe( 0.7 );
		} );

		test( 'handles rotation', () => {
			const layer = {
				x: 100,
				y: 50,
				width: 200,
				height: 40,
				rotation: 45
			};

			renderer.draw( layer );

			// Should translate to center, rotate, then draw from -half dimensions
			expect( ctx.translate ).toHaveBeenCalledWith( 200, 70 ); // x + width/2, y + height/2
			expect( ctx.rotate ).toHaveBeenCalledWith( ( 45 * Math.PI ) / 180 );
			expect( ctx.fillRect ).toHaveBeenCalledWith( -100, -20, 200, 40 );
		} );

		test( 'skips rotation when rotation is 0', () => {
			renderer.draw( {
				x: 100,
				y: 50,
				rotation: 0
			} );

			expect( ctx.translate ).not.toHaveBeenCalled();
			expect( ctx.rotate ).not.toHaveBeenCalled();
		} );

		test( 'skips rotation when rotation is not a number', () => {
			renderer.draw( {
				x: 100,
				y: 50,
				rotation: 'invalid'
			} );

			expect( ctx.translate ).not.toHaveBeenCalled();
			expect( ctx.rotate ).not.toHaveBeenCalled();
		} );

		test( 'handles 90 degree rotation', () => {
			renderer.draw( {
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				rotation: 90
			} );

			expect( ctx.rotate ).toHaveBeenCalledWith( Math.PI / 2 );
		} );

		test( 'handles 180 degree rotation', () => {
			renderer.draw( {
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				rotation: 180
			} );

			expect( ctx.rotate ).toHaveBeenCalledWith( Math.PI );
		} );

		test( 'handles negative rotation', () => {
			renderer.draw( {
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				rotation: -45
			} );

			expect( ctx.rotate ).toHaveBeenCalledWith( ( -45 * Math.PI ) / 180 );
		} );

		test( 'preserves canvas state with save/restore', () => {
			renderer.draw( {} );

			// save should be called before any operations
			expect( ctx.save.mock.invocationCallOrder[ 0 ] )
				.toBeLessThan( ctx.fillRect.mock.invocationCallOrder[ 0 ] );

			// restore should be called after all operations
			expect( ctx.restore.mock.invocationCallOrder[ 0 ] )
				.toBeGreaterThan( ctx.fillRect.mock.invocationCallOrder[ 0 ] );
		} );

		test( 'handles complete layer with all properties', () => {
			renderer.draw( {
				x: 50,
				y: 100,
				width: 300,
				height: 60,
				rotation: 30,
				opacity: 0.6,
				color: '#00ffff'
			} );

			expect( ctx.translate ).toHaveBeenCalledWith( 200, 130 );
			expect( ctx.rotate ).toHaveBeenCalledWith( ( 30 * Math.PI ) / 180 );
			expect( ctx.globalAlpha ).toBe( 0.6 );
			expect( ctx.fillStyle ).toBe( '#00ffff' );
			expect( ctx.fillRect ).toHaveBeenCalledWith( -150, -30, 300, 60 );
		} );
	} );

	describe( 'exports', () => {
		test( 'exports HighlightRenderer constructor', () => {
			expect( typeof HighlightRenderer ).toBe( 'function' );
		} );

		test( 'instances have draw method', () => {
			expect( typeof renderer.draw ).toBe( 'function' );
		} );
	} );
} );
