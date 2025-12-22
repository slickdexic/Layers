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

		it( 'should apply initial style if provided', () => {
			const customStyles = new ToolStyles( { color: '#custom', strokeWidth: 10 } );
			expect( customStyles.getColor() ).toBe( '#custom' );
			expect( customStyles.getStrokeWidth() ).toBe( 10 );
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

		it( 'should not add non-function listeners', () => {
			styles.subscribe( 'not a function' );
			styles.subscribe( null );
			styles.subscribe( {} );
			expect( styles.listeners.length ).toBe( 0 );
		} );

		it( 'should handle unsubscribe of non-existent listener gracefully', () => {
			const listener = jest.fn();
			const unsubscribe = styles.subscribe( listener );
			unsubscribe();
			// Call unsubscribe again - should not throw
			expect( () => unsubscribe() ).not.toThrow();
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

	describe( 'getFontSize / setFontSize', () => {
		it( 'should get current font size', () => {
			expect( styles.getFontSize() ).toBe( ToolStyles.DEFAULT_STYLE.fontSize );
		} );

		it( 'should set font size', () => {
			styles.setFontSize( 24 );
			expect( styles.getFontSize() ).toBe( 24 );
		} );

		it( 'should enforce minimum font size of 8', () => {
			styles.setFontSize( 4 );
			expect( styles.getFontSize() ).toBe( 8 );

			styles.setFontSize( -10 );
			expect( styles.getFontSize() ).toBe( 8 );
		} );
	} );

	describe( 'getFontFamily / setFontFamily', () => {
		it( 'should get current font family', () => {
			expect( styles.getFontFamily() ).toBe( ToolStyles.DEFAULT_STYLE.fontFamily );
		} );

		it( 'should set font family', () => {
			styles.setFontFamily( 'Times New Roman' );
			expect( styles.getFontFamily() ).toBe( 'Times New Roman' );
		} );
	} );

	describe( 'getArrowStyle / setArrowStyle', () => {
		it( 'should get current arrow style', () => {
			expect( styles.getArrowStyle() ).toBe( ToolStyles.DEFAULT_STYLE.arrowStyle );
		} );

		it( 'should set arrow style', () => {
			styles.setArrowStyle( 'double' );
			expect( styles.getArrowStyle() ).toBe( 'double' );
		} );
	} );

	describe( 'getProperty / setProperty', () => {
		it( 'should get specific property', () => {
			expect( styles.getProperty( 'color' ) ).toBe( ToolStyles.DEFAULT_STYLE.color );
		} );

		it( 'should set specific property', () => {
			styles.setProperty( 'opacity', 0.5 );
			expect( styles.getProperty( 'opacity' ) ).toBe( 0.5 );
		} );

		it( 'should not notify when value unchanged', () => {
			const listener = jest.fn();
			styles.subscribe( listener );

			const originalColor = styles.getColor();
			styles.setProperty( 'color', originalColor );

			expect( listener ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'update - no changes', () => {
		it( 'should not notify listeners when no values change', () => {
			const listener = jest.fn();
			styles.subscribe( listener );

			// Update with same values
			styles.update( {
				color: ToolStyles.DEFAULT_STYLE.color,
				strokeWidth: ToolStyles.DEFAULT_STYLE.strokeWidth
			} );

			expect( listener ).not.toHaveBeenCalled();
		} );

		it( 'should handle non-object input', () => {
			expect( () => styles.update( 'not an object' ) ).not.toThrow();
			expect( () => styles.update( 123 ) ).not.toThrow();
		} );
	} );

	describe( 'notifyListeners - error handling', () => {
		let originalMw;

		beforeEach( () => {
			originalMw = global.mw;
			global.mw = {
				log: {
					error: jest.fn()
				}
			};
		} );

		afterEach( () => {
			global.mw = originalMw;
		} );

		it( 'should catch and log listener errors', () => {
			const errorListener = jest.fn( () => {
				throw new Error( 'Listener error' );
			} );
			const normalListener = jest.fn();

			styles.subscribe( errorListener );
			styles.subscribe( normalListener );

			// Should not throw
			expect( () => styles.setColor( '#ff0000' ) ).not.toThrow();

			// Error should be logged
			expect( global.mw.log.error ).toHaveBeenCalledWith(
				'[ToolStyles] Listener error:',
				expect.any( Error )
			);

			// Other listeners should still be called
			expect( normalListener ).toHaveBeenCalled();
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

		it( 'should enforce minimum stroke width of 0.5', () => {
			styles.setStrokeWidth( 0 );
			expect( styles.getStrokeWidth() ).toBe( 0.5 );

			styles.setStrokeWidth( -5 );
			expect( styles.getStrokeWidth() ).toBe( 0.5 );
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

		it( 'should set all shadow properties', () => {
			styles.setShadow( {
				shadow: true,
				shadowColor: '#333333',
				shadowBlur: 20,
				shadowOffsetX: 5,
				shadowOffsetY: 10
			} );
			const shadow = styles.getShadow();
			expect( shadow.shadow ).toBe( true );
			expect( shadow.shadowColor ).toBe( '#333333' );
			expect( shadow.shadowBlur ).toBe( 20 );
			expect( shadow.shadowOffsetX ).toBe( 5 );
			expect( shadow.shadowOffsetY ).toBe( 10 );
		} );

		it( 'should enforce minimum shadowBlur of 0', () => {
			styles.setShadow( { shadowBlur: -10 } );
			expect( styles.getShadow().shadowBlur ).toBe( 0 );
		} );

		it( 'should convert shadow to boolean', () => {
			styles.setShadow( { shadow: 1 } );
			expect( styles.getShadowEnabled() ).toBe( true );

			styles.setShadow( { shadow: 0 } );
			expect( styles.getShadowEnabled() ).toBe( false );
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

		it( 'should apply position when includePosition option is true', () => {
			const layer = { type: 'rectangle' };
			styles.update( { x: 100, y: 200 } );
			styles.applyToLayer( layer, { includePosition: true } );

			expect( layer.x ).toBe( 100 );
			expect( layer.y ).toBe( 200 );
		} );

		it( 'should not apply position when includePosition is false', () => {
			const layer = { type: 'rectangle' };
			styles.update( { x: 100, y: 200 } );
			styles.applyToLayer( layer, { includePosition: false } );

			expect( layer.x ).toBeUndefined();
			expect( layer.y ).toBeUndefined();
		} );

		it( 'should apply text properties to text layers', () => {
			const layer = { type: 'text' };
			styles.setFontSize( 24 );
			styles.setFontFamily( 'Georgia' );
			styles.setColor( '#00ff00' );
			styles.applyToLayer( layer );

			expect( layer.fontSize ).toBe( 24 );
			expect( layer.fontFamily ).toBe( 'Georgia' );
			expect( layer.color ).toBe( '#00ff00' );
		} );

		it( 'should not overwrite existing text layer properties', () => {
			const layer = { type: 'text', fontSize: 18, fontFamily: 'Verdana', color: '#333' };
			styles.setFontSize( 24 );
			styles.setFontFamily( 'Georgia' );
			styles.setColor( '#00ff00' );
			styles.applyToLayer( layer );

			expect( layer.fontSize ).toBe( 18 );
			expect( layer.fontFamily ).toBe( 'Verdana' );
			expect( layer.color ).toBe( '#333' );
		} );

		it( 'should apply arrow style to arrow layers', () => {
			const layer = { type: 'arrow' };
			styles.setArrowStyle( 'double' );
			styles.applyToLayer( layer );

			expect( layer.arrowStyle ).toBe( 'double' );
		} );

		it( 'should not overwrite existing arrow layer properties', () => {
			const layer = { type: 'arrow', arrowStyle: 'existing' };
			styles.setArrowStyle( 'double' );
			styles.applyToLayer( layer );

			expect( layer.arrowStyle ).toBe( 'existing' );
		} );

		it( 'should handle null options', () => {
			const layer = { type: 'rectangle' };
			expect( () => styles.applyToLayer( layer, null ) ).not.toThrow();
		} );

		it( 'should apply all shadow properties', () => {
			const layer = { type: 'rectangle' };
			styles.setShadow( {
				shadow: true,
				shadowColor: '#333',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			} );
			styles.applyToLayer( layer );

			expect( layer.shadowColor ).toBe( '#333' );
			expect( layer.shadowBlur ).toBe( 10 );
			expect( layer.shadowOffsetX ).toBe( 5 );
			expect( layer.shadowOffsetY ).toBe( 5 );
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

		it( 'should extract shadowOffsetX and shadowOffsetY', () => {
			const layer = {
				type: 'rectangle',
				shadowOffsetX: 3,
				shadowOffsetY: 5
			};
			const extracted = styles.extractFromLayer( layer );
			expect( extracted.shadowOffsetX ).toBe( 3 );
			expect( extracted.shadowOffsetY ).toBe( 5 );
		} );

		it( 'should extract arrowStyle from arrow layer', () => {
			const layer = {
				type: 'arrow',
				arrowStyle: 'double'
			};
			const extracted = styles.extractFromLayer( layer );
			expect( extracted.arrowStyle ).toBe( 'double' );
		} );

		it( 'should extract opacity', () => {
			const layer = {
				type: 'rectangle',
				opacity: 0.5
			};
			const extracted = styles.extractFromLayer( layer );
			expect( extracted.opacity ).toBe( 0.5 );
		} );

		it( 'should handle layer with no extractable properties', () => {
			const layer = { type: 'rectangle' };
			const extracted = styles.extractFromLayer( layer );
			expect( typeof extracted ).toBe( 'object' );
		} );

		it( 'should extract color from text layer', () => {
			const layer = {
				type: 'text',
				color: '#ff00ff'
			};
			const extracted = styles.extractFromLayer( layer );
			expect( extracted.color ).toBe( '#ff00ff' );
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
