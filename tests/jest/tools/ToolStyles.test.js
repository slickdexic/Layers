/**
 * Tests for ToolStyles module
 *
 * @jest-environment jsdom
 */

'use strict';

const ToolStyles = require( '../../../resources/ext.layers.editor/tools/ToolStyles.js' );

describe( 'ToolStyles', () => {
	let styles;

	beforeEach( () => {
		styles = new ToolStyles();
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default style', () => {
			const style = styles.get();
			expect( style.color ).toBeDefined();
			expect( style.strokeWidth ).toBeDefined();
		} );

		it( 'should initialize with empty listeners array', () => {
			expect( styles.listeners ).toEqual( [] );
		} );
	} );

	describe( 'DEFAULT_STYLE', () => {
		it( 'should have all required style properties', () => {
			const defaults = ToolStyles.DEFAULT_STYLE;
			expect( defaults.color ).toBeDefined();
			expect( defaults.fill ).toBeDefined();
			expect( defaults.strokeWidth ).toBeDefined();
			expect( defaults.fontFamily ).toBeDefined();
			expect( defaults.fontSize ).toBeDefined();
			expect( defaults.shadow ).toBeDefined();
		} );
	} );

	describe( 'get', () => {
		it( 'should return a copy of current style', () => {
			const style1 = styles.get();
			const style2 = styles.get();
			expect( style1 ).not.toBe( style2 );
			expect( style1 ).toEqual( style2 );
		} );

		it( 'should not allow mutation of internal state', () => {
			const style = styles.get();
			style.color = '#changed';
			expect( styles.getColor() ).not.toBe( '#changed' );
		} );
	} );

	describe( 'update', () => {
		it( 'should update single property', () => {
			styles.update( { color: '#00ff00' } );
			expect( styles.getColor() ).toBe( '#00ff00' );
		} );

		it( 'should update multiple properties', () => {
			styles.update( { color: '#00ff00', strokeWidth: 5 } );
			expect( styles.getColor() ).toBe( '#00ff00' );
			expect( styles.get().strokeWidth ).toBe( 5 );
		} );

		it( 'should preserve unmodified properties', () => {
			const originalFill = styles.get().fill;
			styles.update( { color: '#00ff00' } );
			expect( styles.get().fill ).toBe( originalFill );
		} );

		it( 'should notify listeners when style changes', () => {
			const listener = jest.fn();
			styles.subscribe( listener );
			styles.update( { color: '#00ff00' } );
			expect( listener ).toHaveBeenCalled();
		} );

		it( 'should handle null/undefined input', () => {
			expect( () => styles.update( null ) ).not.toThrow();
			expect( () => styles.update( undefined ) ).not.toThrow();
		} );
	} );

	describe( 'subscribe', () => {
		it( 'should add listener to list', () => {
			const listener = jest.fn();
			styles.subscribe( listener );
			expect( styles.listeners ).toContain( listener );
		} );

		it( 'should return unsubscribe function', () => {
			const listener = jest.fn();
			const unsubscribe = styles.subscribe( listener );
			expect( typeof unsubscribe ).toBe( 'function' );
		} );

		it( 'should remove listener when unsubscribe called', () => {
			const listener = jest.fn();
			const unsubscribe = styles.subscribe( listener );
			unsubscribe();
			expect( styles.listeners ).not.toContain( listener );
		} );

		it( 'should not call listener after unsubscribe', () => {
			const listener = jest.fn();
			const unsubscribe = styles.subscribe( listener );
			unsubscribe();
			styles.update( { color: '#00ff00' } );
			expect( listener ).not.toHaveBeenCalled();
		} );

		it( 'should support multiple listeners', () => {
			const listener1 = jest.fn();
			const listener2 = jest.fn();
			styles.subscribe( listener1 );
			styles.subscribe( listener2 );
			styles.update( { color: '#00ff00' } );
			expect( listener1 ).toHaveBeenCalled();
			expect( listener2 ).toHaveBeenCalled();
		} );
	} );

	describe( 'getColor / setColor', () => {
		it( 'should get current color', () => {
			expect( styles.getColor() ).toBe( ToolStyles.DEFAULT_STYLE.color );
		} );

		it( 'should set color', () => {
			styles.setColor( '#ff0000' );
			expect( styles.getColor() ).toBe( '#ff0000' );
		} );

		it( 'should notify listeners on setColor', () => {
			const listener = jest.fn();
			styles.subscribe( listener );
			styles.setColor( '#ff0000' );
			expect( listener ).toHaveBeenCalled();
		} );
	} );

	describe( 'getFill / setFill', () => {
		it( 'should get current fill', () => {
			expect( styles.getFill() ).toBe( ToolStyles.DEFAULT_STYLE.fill );
		} );

		it( 'should set fill', () => {
			styles.setFill( '#0000ff' );
			expect( styles.getFill() ).toBe( '#0000ff' );
		} );
	} );

	describe( 'getStrokeWidth / setStrokeWidth', () => {
		it( 'should get current stroke width', () => {
			expect( styles.getStrokeWidth() ).toBe( ToolStyles.DEFAULT_STYLE.strokeWidth );
		} );

		it( 'should set stroke width', () => {
			styles.setStrokeWidth( 10 );
			expect( styles.getStrokeWidth() ).toBe( 10 );
		} );
	} );

	describe( 'getShadow / setShadow', () => {
		it( 'should get current shadow properties', () => {
			const shadow = styles.getShadow();
			expect( shadow ).toHaveProperty( 'shadow' );
			expect( shadow ).toHaveProperty( 'shadowColor' );
			expect( shadow ).toHaveProperty( 'shadowBlur' );
		} );

		it( 'should get shadow enabled state', () => {
			expect( styles.getShadowEnabled() ).toBe( false );
		} );

		it( 'should set shadow enabled', () => {
			styles.setShadowEnabled( true );
			expect( styles.getShadowEnabled() ).toBe( true );
		} );

		it( 'should set shadow properties via setShadow', () => {
			styles.setShadow( {
				shadow: true,
				shadowBlur: 15
			} );
			expect( styles.getShadowEnabled() ).toBe( true );
			expect( styles.getShadow().shadowBlur ).toBe( 15 );
		} );
	} );

	describe( 'applyToLayer', () => {
		it( 'should apply stroke properties to shape layer', () => {
			const layer = { type: 'rectangle' };
			styles.setColor( '#ff0000' );
			styles.setStrokeWidth( 5 );
			styles.applyToLayer( layer );

			expect( layer.stroke ).toBe( '#ff0000' );
			expect( layer.strokeWidth ).toBe( 5 );
		} );

		it( 'should apply fill to rectangle', () => {
			const layer = { type: 'rectangle' };
			styles.setFill( '#0000ff' );
			styles.applyToLayer( layer );

			expect( layer.fill ).toBe( '#0000ff' );
		} );

		it( 'should apply shadow properties', () => {
			const layer = { type: 'rectangle' };
			styles.setShadowEnabled( true );
			styles.applyToLayer( layer );

			expect( layer.shadow ).toBe( true );
		} );

		it( 'should not overwrite existing layer properties', () => {
			const layer = { type: 'rectangle', stroke: '#existing' };
			styles.setColor( '#ff0000' );
			styles.applyToLayer( layer );

			expect( layer.stroke ).toBe( '#existing' );
		} );

		it( 'should return the layer for chaining', () => {
			const layer = { type: 'rectangle' };
			const result = styles.applyToLayer( layer );
			expect( result ).toBe( layer );
		} );
	} );

	describe( 'extractFromLayer', () => {
		it( 'should extract stroke color', () => {
			const layer = { type: 'rectangle', stroke: '#ff0000' };
			const extracted = styles.extractFromLayer( layer );
			expect( extracted.color ).toBe( '#ff0000' );
		} );

		it( 'should extract fill color', () => {
			const layer = { type: 'rectangle', fill: '#0000ff' };
			const extracted = styles.extractFromLayer( layer );
			expect( extracted.fill ).toBe( '#0000ff' );
		} );

		it( 'should extract stroke width', () => {
			const layer = { type: 'rectangle', strokeWidth: 10 };
			const extracted = styles.extractFromLayer( layer );
			expect( extracted.strokeWidth ).toBe( 10 );
		} );

		it( 'should extract font properties from text layer', () => {
			const layer = { type: 'text', fontFamily: 'Times', fontSize: 18 };
			const extracted = styles.extractFromLayer( layer );
			expect( extracted.fontFamily ).toBe( 'Times' );
			expect( extracted.fontSize ).toBe( 18 );
		} );

		it( 'should extract shadow properties', () => {
			const layer = {
				type: 'rectangle',
				shadow: true,
				shadowColor: '#333333',
				shadowBlur: 15
			};
			const extracted = styles.extractFromLayer( layer );
			expect( extracted.shadow ).toBe( true );
			expect( extracted.shadowColor ).toBe( '#333333' );
		} );

		it( 'should return style object for chaining', () => {
			const layer = { type: 'rectangle', stroke: '#ff0000' };
			const result = styles.extractFromLayer( layer );
			expect( typeof result ).toBe( 'object' );
		} );
	} );

	describe( 'reset', () => {
		it( 'should reset all styles to defaults', () => {
			styles.setColor( '#ff0000' );
			styles.setStrokeWidth( 20 );
			styles.reset();

			expect( styles.getColor() ).toBe( ToolStyles.DEFAULT_STYLE.color );
			expect( styles.getStrokeWidth() ).toBe( ToolStyles.DEFAULT_STYLE.strokeWidth );
		} );

		it( 'should notify listeners on reset', () => {
			const listener = jest.fn();
			styles.subscribe( listener );
			styles.reset();
			expect( listener ).toHaveBeenCalled();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clear all listeners', () => {
			const listener = jest.fn();
			styles.subscribe( listener );
			styles.destroy();
			expect( styles.listeners ).toEqual( [] );
		} );

		it( 'should set currentStyle to null', () => {
			styles.destroy();
			expect( styles.currentStyle ).toBeNull();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export ToolStyles class', () => {
			expect( typeof ToolStyles ).toBe( 'function' );
		} );

		it( 'should allow creating new instances', () => {
			const instance = new ToolStyles();
			expect( instance ).toBeInstanceOf( ToolStyles );
		} );
	} );
} );
