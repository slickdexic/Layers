/**
 * Tests for GradientEditor UI component
 */

'use strict';

// Mock mw object
global.mw = {
	message: jest.fn( ( key ) => ( {
		exists: jest.fn( () => false ),
		text: jest.fn( () => key )
	} ) )
};

// Mock window object
global.window = global.window || {};
global.window.Layers = global.window.Layers || {};
global.window.Layers.Renderers = global.window.Layers.Renderers || {};

// Mock GradientRenderer presets
global.window.Layers.Renderers.GradientRenderer = {
	getPresets: jest.fn( () => ( {
		sunset: {
			type: 'linear',
			angle: 180,
			colors: [ { offset: 0, color: '#ff512f' }, { offset: 1, color: '#f09819' } ]
		},
		ocean: {
			type: 'linear',
			angle: 135,
			colors: [ { offset: 0, color: '#2193b0' }, { offset: 1, color: '#6dd5ed' } ]
		}
	} ) )
};

const GradientEditor = require( '../../../../resources/ext.layers.editor/ui/GradientEditor.js' );

describe( 'GradientEditor', () => {
	let container;
	let onChange;
	let layer;

	beforeEach( () => {
		container = document.createElement( 'div' );
		onChange = jest.fn();
		layer = {
			id: 'test-layer',
			type: 'rectangle',
			fill: '#ff0000',
			gradient: null
		};
	} );

	afterEach( () => {
		container = null;
		onChange = null;
		layer = null;
	} );

	describe( 'constructor', () => {
		it( 'should initialize with solid fill type when no gradient', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			expect( editor.fillType ).toBe( 'solid' );
			expect( container.querySelector( '.gradient-type-select' ) ).toBeTruthy();
			editor.destroy();
		} );

		it( 'should initialize with linear type when layer has linear gradient', () => {
			layer.gradient = {
				type: 'linear',
				angle: 90,
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );
			expect( editor.fillType ).toBe( 'linear' );
			editor.destroy();
		} );

		it( 'should initialize with radial type when layer has radial gradient', () => {
			layer.gradient = {
				type: 'radial',
				centerX: 0.5,
				centerY: 0.5,
				radius: 0.7,
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );
			expect( editor.fillType ).toBe( 'radial' );
			editor.destroy();
		} );
	} );

	describe( 'fill type selector', () => {
		it( 'should create fill type dropdown', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const select = container.querySelector( '.gradient-type-select' );
			expect( select ).toBeTruthy();
			expect( select.options.length ).toBe( 3 );
			editor.destroy();
		} );

		it( 'should have solid, linear, and radial options', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const select = container.querySelector( '.gradient-type-select' );
			const values = Array.from( select.options ).map( o => o.value );
			expect( values ).toContain( 'solid' );
			expect( values ).toContain( 'linear' );
			expect( values ).toContain( 'radial' );
			editor.destroy();
		} );

		it( 'should switch to linear gradient when selected', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const select = container.querySelector( '.gradient-type-select' );

			select.value = 'linear';
			select.dispatchEvent( new Event( 'change' ) );

			expect( editor.fillType ).toBe( 'linear' );
			expect( editor.currentGradient ).toBeTruthy();
			expect( editor.currentGradient.type ).toBe( 'linear' );
			expect( onChange ).toHaveBeenCalled();
			editor.destroy();
		} );

		it( 'should switch to radial gradient when selected', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const select = container.querySelector( '.gradient-type-select' );

			select.value = 'radial';
			select.dispatchEvent( new Event( 'change' ) );

			expect( editor.fillType ).toBe( 'radial' );
			expect( editor.currentGradient.type ).toBe( 'radial' );
			expect( editor.currentGradient.centerX ).toBe( 0.5 );
			expect( editor.currentGradient.centerY ).toBe( 0.5 );
			expect( onChange ).toHaveBeenCalled();
			editor.destroy();
		} );

		it( 'should switch back to solid and clear gradient', () => {
			layer.gradient = {
				type: 'linear',
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );

			const select = container.querySelector( '.gradient-type-select' );
			select.value = 'solid';
			select.dispatchEvent( new Event( 'change' ) );

			expect( editor.fillType ).toBe( 'solid' );
			expect( editor.currentGradient ).toBeNull();
			expect( onChange ).toHaveBeenCalledWith( { gradient: null } );
			editor.destroy();
		} );

		it( 'should call onFillTypeChange when switching between solid and gradient', () => {
			const onFillTypeChange = jest.fn();
			const editor = new GradientEditor( { layer, container, onChange, onFillTypeChange } );

			// Switch from solid to linear - should trigger callback
			const select = container.querySelector( '.gradient-type-select' );
			select.value = 'linear';
			select.dispatchEvent( new Event( 'change' ) );

			expect( onFillTypeChange ).toHaveBeenCalledTimes( 1 );
			editor.destroy();
		} );

		it( 'should not call onFillTypeChange when switching between gradient types', () => {
			layer.gradient = {
				type: 'linear',
				angle: 90,
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const onFillTypeChange = jest.fn();
			const editor = new GradientEditor( { layer, container, onChange, onFillTypeChange } );

			// Switch from linear to radial - should NOT trigger callback (both are gradients)
			const select = container.querySelector( '.gradient-type-select' );
			select.value = 'radial';
			select.dispatchEvent( new Event( 'change' ) );

			expect( onFillTypeChange ).not.toHaveBeenCalled();
			editor.destroy();
		} );
	} );

	describe( 'gradient controls', () => {
		it( 'should show angle slider for linear gradient', () => {
			layer.gradient = {
				type: 'linear',
				angle: 90,
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );

			const angleSlider = container.querySelector( '.gradient-angle-slider' );
			expect( angleSlider ).toBeTruthy();
			expect( angleSlider.value ).toBe( '90' );
			editor.destroy();
		} );

		it( 'should update angle on slider change', () => {
			layer.gradient = {
				type: 'linear',
				angle: 90,
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );

			const angleSlider = container.querySelector( '.gradient-angle-slider' );
			angleSlider.value = '180';
			angleSlider.dispatchEvent( new Event( 'input' ) );

			expect( editor.currentGradient.angle ).toBe( 180 );
			expect( onChange ).toHaveBeenCalled();
			editor.destroy();
		} );

		it( 'should show radius slider for radial gradient', () => {
			layer.gradient = {
				type: 'radial',
				radius: 0.7,
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );

			const radiusSlider = container.querySelector( '.gradient-radius-slider' );
			expect( radiusSlider ).toBeTruthy();
			editor.destroy();
		} );

		it( 'should update radius on slider change', () => {
			layer.gradient = {
				type: 'radial',
				radius: 0.7,
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );

			const radiusSlider = container.querySelector( '.gradient-radius-slider' );
			radiusSlider.value = '1.2';
			radiusSlider.dispatchEvent( new Event( 'input' ) );

			expect( editor.currentGradient.radius ).toBe( 1.2 );
			expect( onChange ).toHaveBeenCalled();
			editor.destroy();
		} );
	} );

	describe( 'color stops editor', () => {
		beforeEach( () => {
			layer.gradient = {
				type: 'linear',
				angle: 90,
				colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' } ]
			};
		} );

		it( 'should show color stops editor for gradient', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const stopsEditor = container.querySelector( '.gradient-stops-editor' );
			expect( stopsEditor ).toBeTruthy();
			editor.destroy();
		} );

		it( 'should show correct number of color stops', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const stopRows = container.querySelectorAll( '.gradient-stop-row' );
			expect( stopRows.length ).toBe( 2 );
			editor.destroy();
		} );

		it( 'should update color on color input change', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const colorInputs = container.querySelectorAll( '.gradient-stop-color' );

			colorInputs[ 0 ].value = '#00ff00';
			colorInputs[ 0 ].dispatchEvent( new Event( 'input' ) );

			expect( editor.currentGradient.colors[ 0 ].color ).toBe( '#00ff00' );
			expect( onChange ).toHaveBeenCalled();
			editor.destroy();
		} );

		it( 'should update offset on slider change', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const offsetInputs = container.querySelectorAll( '.gradient-stop-offset' );

			offsetInputs[ 0 ].value = '25';
			offsetInputs[ 0 ].dispatchEvent( new Event( 'input' ) );

			expect( editor.currentGradient.colors[ 0 ].offset ).toBe( 0.25 );
			expect( onChange ).toHaveBeenCalled();
			editor.destroy();
		} );

		it( 'should add new color stop when add button clicked', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const addButton = container.querySelector( '.gradient-add-stop' );

			addButton.click();

			expect( editor.currentGradient.colors.length ).toBe( 3 );
			expect( onChange ).toHaveBeenCalled();
			editor.destroy();
		} );

		it( 'should not add more than 10 color stops', () => {
			layer.gradient.colors = [];
			for ( let i = 0; i < 10; i++ ) {
				layer.gradient.colors.push( { offset: i / 9, color: '#000' } );
			}

			const editor = new GradientEditor( { layer, container, onChange } );
			const addButton = container.querySelector( '.gradient-add-stop' );

			addButton.click();

			expect( editor.currentGradient.colors.length ).toBe( 10 );
			editor.destroy();
		} );

		it( 'should remove color stop when delete button clicked', () => {
			layer.gradient.colors.push( { offset: 0.5, color: '#00ff00' } );

			const editor = new GradientEditor( { layer, container, onChange } );
			const deleteButtons = container.querySelectorAll( '.gradient-stop-delete' );

			// First two buttons should be enabled now (3 stops)
			expect( deleteButtons[ 0 ].disabled ).toBe( false );

			deleteButtons[ 0 ].click();

			expect( editor.currentGradient.colors.length ).toBe( 2 );
			expect( onChange ).toHaveBeenCalled();
			editor.destroy();
		} );

		it( 'should disable delete buttons when only 2 stops remain', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const deleteButtons = container.querySelectorAll( '.gradient-stop-delete' );

			// Both should be disabled with only 2 stops
			expect( deleteButtons[ 0 ].disabled ).toBe( true );
			expect( deleteButtons[ 1 ].disabled ).toBe( true );
			editor.destroy();
		} );
	} );

	describe( 'preset swatches', () => {
		beforeEach( () => {
			layer.gradient = {
				type: 'linear',
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
		} );

		it( 'should show preset swatches for gradient', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const swatches = container.querySelectorAll( '.gradient-preset-swatch' );
			expect( swatches.length ).toBeGreaterThan( 0 );
			editor.destroy();
		} );

		it( 'should apply preset when swatch clicked', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const swatches = container.querySelectorAll( '.gradient-preset-swatch' );

			swatches[ 0 ].click();

			expect( editor.currentGradient.colors.length ).toBeGreaterThanOrEqual( 2 );
			expect( onChange ).toHaveBeenCalled();
			editor.destroy();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up resources', () => {
			const editor = new GradientEditor( { layer, container, onChange } );

			editor.destroy();

			expect( editor.layer ).toBeNull();
			expect( editor.onChange ).toBeNull();
			expect( editor.container ).toBeNull();
			expect( editor.currentGradient ).toBeNull();
		} );

		it( 'should clear container content', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			expect( container.children.length ).toBeGreaterThan( 0 );

			editor.destroy();

			expect( container.children.length ).toBe( 0 );
		} );
	} );

	describe( '_gradientToCss', () => {
		it( 'should convert linear gradient to CSS', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const css = editor._gradientToCss( {
				type: 'linear',
				angle: 90,
				colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' } ]
			} );

			expect( css ).toContain( 'linear-gradient' );
			expect( css ).toContain( '#ff0000' );
			expect( css ).toContain( '#0000ff' );
			editor.destroy();
		} );

		it( 'should convert radial gradient to CSS', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const css = editor._gradientToCss( {
				type: 'radial',
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			} );

			expect( css ).toContain( 'radial-gradient' );
			editor.destroy();
		} );

		it( 'should return fallback for invalid gradient', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const css = editor._gradientToCss( null );
			expect( css ).toBe( '#cccccc' );

			const css2 = editor._gradientToCss( { type: 'linear', colors: [ { offset: 0, color: '#000' } ] } );
			expect( css2 ).toBe( '#cccccc' );
			editor.destroy();
		} );
	} );

	describe( '_cloneGradient', () => {
		it( 'should return null for null input', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			expect( editor._cloneGradient( null ) ).toBeNull();
			editor.destroy();
		} );

		it( 'should create deep clone of gradient', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			const original = {
				type: 'linear',
				angle: 90,
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const clone = editor._cloneGradient( original );

			expect( clone ).toEqual( original );
			expect( clone ).not.toBe( original );
			expect( clone.colors ).not.toBe( original.colors );
			editor.destroy();
		} );
	} );

	describe( 'integration with window namespace', () => {
		it( 'should export to window.Layers.UI namespace', () => {
			expect( window.Layers.UI.GradientEditor ).toBe( GradientEditor );
		} );
	} );

	describe( 'edge cases and defensive code', () => {
		it( 'should handle _addColorStop when no gradient exists', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			// Manually clear the gradient to test defensive code
			editor.currentGradient = null;

			// Should not throw
			expect( () => editor._addColorStop() ).not.toThrow();
			editor.destroy();
		} );

		it( 'should initialize colors array if missing in _addColorStop', () => {
			layer.gradient = {
				type: 'linear',
				angle: 90
				// no colors array
			};
			const editor = new GradientEditor( { layer, container, onChange } );
			// Manually remove colors to test
			delete editor.currentGradient.colors;

			editor._addColorStop();

			expect( editor.currentGradient.colors ).toBeTruthy();
			expect( editor.currentGradient.colors.length ).toBe( 1 );
			editor.destroy();
		} );

		it( 'should handle _removeColorStop when no gradient exists', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			editor.currentGradient = null;

			// Should not throw
			expect( () => editor._removeColorStop( 0 ) ).not.toThrow();
			editor.destroy();
		} );

		it( 'should not remove when only 2 stops remain via direct method call', () => {
			layer.gradient = {
				type: 'linear',
				angle: 90,
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );

			// Direct call to test the guard
			editor._removeColorStop( 0 );

			// Should still have 2 colors
			expect( editor.currentGradient.colors.length ).toBe( 2 );
			editor.destroy();
		} );

		it( 'should handle _updateColorStop when no gradient exists', () => {
			const editor = new GradientEditor( { layer, container, onChange } );
			editor.currentGradient = null;

			// Should not throw
			expect( () => editor._updateColorStop( 0, 'color', '#fff' ) ).not.toThrow();
			editor.destroy();
		} );

		it( 'should handle _updateColorStop with invalid index', () => {
			layer.gradient = {
				type: 'linear',
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );
			onChange.mockClear();

			// Out of bounds
			editor._updateColorStop( 10, 'color', '#fff' );

			// Should not have called onChange
			expect( onChange ).not.toHaveBeenCalled();
			editor.destroy();
		} );
	} );

	describe( 'message helper', () => {
		it( 'should use localized message when exists', () => {
			// Temporarily mock mw.message to return existing message
			const originalMw = global.mw;
			global.mw = {
				message: jest.fn( () => ( {
					exists: jest.fn( () => true ),
					text: jest.fn( () => 'Localized Text' )
				} ) )
			};

			// Force reload by creating new editor
			const editor = new GradientEditor( { layer, container, onChange } );

			// The labels in the UI should use message system
			const labels = container.querySelectorAll( 'label' );
			expect( labels.length ).toBeGreaterThan( 0 );

			global.mw = originalMw;
			editor.destroy();
		} );
	} );

	describe( 'fallback presets', () => {
		it( 'should use fallback presets when GradientRenderer not available', () => {
			// Temporarily remove the renderer
			const original = global.window.Layers.Renderers.GradientRenderer;
			delete global.window.Layers.Renderers.GradientRenderer;

			layer.gradient = {
				type: 'linear',
				colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
			};
			const editor = new GradientEditor( { layer, container, onChange } );

			// Should still have presets displayed
			const swatches = container.querySelectorAll( '.gradient-preset-swatch' );
			expect( swatches.length ).toBeGreaterThan( 0 );

			global.window.Layers.Renderers.GradientRenderer = original;
			editor.destroy();
		} );
	} );
} );
