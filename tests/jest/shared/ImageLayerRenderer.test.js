/**
 * Tests for ImageLayerRenderer module
 *
 * @jest-environment jsdom
 */

'use strict';

// Mock DOM globals
global.Image = class {
	constructor() {
		this.onload = null;
		this.onerror = null;
		this._src = '';
		this.complete = false;
		this.naturalWidth = 100;
		this.naturalHeight = 100;
	}

	set src( value ) {
		this._src = value;
		// Simulate async load
		setTimeout( () => {
			this.complete = true;
			if ( this.onload ) {
				this.onload();
			}
		}, 0 );
	}

	get src() {
		return this._src;
	}
};

// Mock mw for MediaWiki compatibility
global.mw = {
	log: {
		warn: jest.fn()
	}
};

// Set up window.Layers namespace
global.window = global.window || {};
global.window.Layers = {};

// Import the module
const ImageLayerRenderer = require( '../../../resources/ext.layers.shared/ImageLayerRenderer.js' );

describe( 'ImageLayerRenderer', () => {
	let mockCtx;
	let renderer;

	beforeEach( () => {
		// Create mock canvas context
		mockCtx = {
			save: jest.fn(),
			restore: jest.fn(),
			drawImage: jest.fn(),
			strokeRect: jest.fn(),
			beginPath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			stroke: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			setLineDash: jest.fn(),
			globalAlpha: 1,
			strokeStyle: '',
			lineWidth: 1
		};

		// Reset the mock Image class state
		global.Image = class {
			constructor() {
				this.onload = null;
				this.onerror = null;
				this._src = '';
				this.complete = false;
				this.naturalWidth = 100;
				this.naturalHeight = 100;
			}

			set src( value ) {
				this._src = value;
			}

			get src() {
				return this._src;
			}
		};

		renderer = new ImageLayerRenderer( mockCtx );
	} );

	afterEach( () => {
		if ( renderer ) {
			renderer.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default config', () => {
			expect( renderer ).toBeDefined();
			expect( renderer.ctx ).toBe( mockCtx );
			expect( renderer.shadowRenderer ).toBeNull();
			expect( renderer.onImageLoad ).toBeNull();
		} );

		it( 'should accept custom config', () => {
			const mockShadowRenderer = { apply: jest.fn() };
			const mockCallback = jest.fn();

			const customRenderer = new ImageLayerRenderer( mockCtx, {
				shadowRenderer: mockShadowRenderer,
				onImageLoad: mockCallback
			} );

			expect( customRenderer.shadowRenderer ).toBe( mockShadowRenderer );
			expect( customRenderer.onImageLoad ).toBe( mockCallback );

			customRenderer.destroy();
		} );
	} );

	describe( 'setContext', () => {
		it( 'should update the canvas context', () => {
			const newCtx = { draw: jest.fn() };
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'setShadowRenderer', () => {
		it( 'should update the shadow renderer', () => {
			const mockShadowRenderer = { apply: jest.fn() };
			renderer.setShadowRenderer( mockShadowRenderer );
			expect( renderer.shadowRenderer ).toBe( mockShadowRenderer );
		} );
	} );

	describe( 'setOnImageLoad', () => {
		it( 'should update the image load callback', () => {
			const callback = jest.fn();
			renderer.setOnImageLoad( callback );
			expect( renderer.onImageLoad ).toBe( callback );
		} );
	} );

	describe( 'draw', () => {
		it( 'should draw placeholder when image is not loaded', () => {
			const layer = {
				id: 'test-image-1',
				src: 'data:image/png;base64,test',
				x: 10,
				y: 20,
				width: 100,
				height: 80
			};

			renderer.draw( layer );

			// Should draw placeholder (strokeRect and diagonal lines)
			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [ 5, 5 ] );
			expect( mockCtx.strokeRect ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw image when loaded', () => {
			// Override Image to be immediately complete
			global.Image = class {
				constructor() {
					this.complete = true;
					this.naturalWidth = 200;
					this.naturalHeight = 150;
				}

				set src( value ) {
					this._src = value;
				}

				get src() {
					return this._src;
				}
			};

			// Create a fresh renderer to use the new Image mock
			const newRenderer = new ImageLayerRenderer( mockCtx );

			const layer = {
				id: 'test-image-2',
				src: 'data:image/png;base64,test',
				x: 10,
				y: 20,
				width: 100,
				height: 80
			};

			newRenderer.draw( layer );

			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.drawImage ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();

			newRenderer.destroy();
		} );

		it( 'should apply opacity when specified', () => {
			global.Image = class {
				constructor() {
					this.complete = true;
					this.naturalWidth = 100;
					this.naturalHeight = 100;
				}

				set src( value ) {
					this._src = value;
				}

				get src() {
					return this._src;
				}
			};

			const newRenderer = new ImageLayerRenderer( mockCtx );

			const layer = {
				id: 'opacity-test',
				src: 'data:image/png;base64,test',
				x: 0,
				y: 0,
				width: 50,
				height: 50,
				opacity: 0.5
			};

			newRenderer.draw( layer );

			expect( mockCtx.globalAlpha ).toBe( 0.5 );

			newRenderer.destroy();
		} );

		it( 'should apply rotation when specified', () => {
			global.Image = class {
				constructor() {
					this.complete = true;
					this.naturalWidth = 100;
					this.naturalHeight = 100;
				}

				set src( value ) {
					this._src = value;
				}

				get src() {
					return this._src;
				}
			};

			const newRenderer = new ImageLayerRenderer( mockCtx );

			const layer = {
				id: 'rotation-test',
				src: 'data:image/png;base64,test',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 45
			};

			newRenderer.draw( layer );

			expect( mockCtx.translate ).toHaveBeenCalled();
			expect( mockCtx.rotate ).toHaveBeenCalled();

			newRenderer.destroy();
		} );

		it( 'should apply scaling from options', () => {
			global.Image = class {
				constructor() {
					this.complete = true;
					this.naturalWidth = 100;
					this.naturalHeight = 100;
				}

				set src( value ) {
					this._src = value;
				}

				get src() {
					return this._src;
				}
			};

			const newRenderer = new ImageLayerRenderer( mockCtx );

			const layer = {
				id: 'scale-test',
				src: 'data:image/png;base64,test',
				x: 10,
				y: 20,
				width: 50,
				height: 40
			};

			newRenderer.draw( layer, { scale: { sx: 2, sy: 2 } } );

			// Check drawImage was called with scaled values
			expect( mockCtx.drawImage ).toHaveBeenCalledWith(
				expect.anything(),
				20, // x * 2
				40, // y * 2
				100, // width * 2
				80 // height * 2
			);

			newRenderer.destroy();
		} );
	} );

	describe( 'caching', () => {
		it( 'should cache loaded images', () => {
			const layer = {
				id: 'cache-test',
				src: 'data:image/png;base64,test'
			};

			// Draw twice
			renderer.draw( layer );
			renderer.draw( layer );

			// Should have 1 cached entry
			expect( renderer.getCacheSize() ).toBe( 1 );
		} );

		it( 'should evict oldest entry when cache is full', () => {
			// Fill cache beyond MAX_CACHE_SIZE
			for ( let i = 0; i < ImageLayerRenderer.MAX_CACHE_SIZE + 5; i++ ) {
				const layer = {
					id: `layer-${ i }`,
					src: `data:image/png;base64,test${ i }`
				};
				renderer.draw( layer );
			}

			// Cache should be at max size
			expect( renderer.getCacheSize() ).toBe( ImageLayerRenderer.MAX_CACHE_SIZE );
		} );

		it( 'should check if image is cached', () => {
			const layer = {
				id: 'check-cache-test',
				src: 'data:image/png;base64,test'
			};

			renderer.draw( layer );

			expect( renderer.isCached( 'check-cache-test' ) ).toBe( true );
			expect( renderer.isCached( 'nonexistent' ) ).toBe( false );
		} );

		it( 'should clear cache', () => {
			const layer = {
				id: 'clear-test',
				src: 'data:image/png;base64,test'
			};

			renderer.draw( layer );
			expect( renderer.getCacheSize() ).toBe( 1 );

			renderer.clearCache();
			expect( renderer.getCacheSize() ).toBe( 0 );
		} );
	} );

	describe( 'MAX_CACHE_SIZE', () => {
		it( 'should return 50 as the max cache size', () => {
			expect( ImageLayerRenderer.MAX_CACHE_SIZE ).toBe( 50 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up resources', () => {
			// Add some cached images
			renderer.draw( { id: 'destroy-test', src: 'data:image/png;base64,test' } );

			renderer.destroy();

			expect( renderer.ctx ).toBeNull();
			expect( renderer._imageCache ).toBeNull();
			expect( renderer.shadowRenderer ).toBeNull();
			expect( renderer.onImageLoad ).toBeNull();
		} );
	} );

	describe( 'integration with shadow renderer', () => {
		it( 'should apply shadow when shadow renderer is present', () => {
			global.Image = class {
				constructor() {
					this.complete = true;
					this.naturalWidth = 100;
					this.naturalHeight = 100;
				}

				set src( value ) {
					this._src = value;
				}

				get src() {
					return this._src;
				}
			};

			const mockShadowRenderer = {
				hasShadowEnabled: jest.fn().mockReturnValue( true ),
				applyShadow: jest.fn(),
				clearShadow: jest.fn()
			};

			const shadowRenderer = new ImageLayerRenderer( mockCtx, {
				shadowRenderer: mockShadowRenderer
			} );

			const layer = {
				id: 'shadow-test',
				src: 'data:image/png;base64,test',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shadowRenderer.draw( layer );

			expect( mockShadowRenderer.hasShadowEnabled ).toHaveBeenCalledWith( layer );
			expect( mockShadowRenderer.applyShadow ).toHaveBeenCalled();
			expect( mockShadowRenderer.clearShadow ).toHaveBeenCalled();

			shadowRenderer.destroy();
		} );
	} );
} );
