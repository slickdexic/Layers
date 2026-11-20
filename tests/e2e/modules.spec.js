/* eslint-env node */
/**
 * Layers JavaScript Module Tests
 * 
 * These tests verify that the Layers JavaScript modules load correctly
 * and their core functions work, without requiring a MediaWiki instance.
 * 
 * This provides confidence that the JavaScript code is valid and works
 * in a real browser environment, complementing the Jest unit tests.
 */

const { test, expect } = require( '@playwright/test' );
const path = require( 'path' );
const fs = require( 'fs' );

// Read the JavaScript source files
const resourcesDir = path.join( __dirname, '../../resources' );

/**
 * Helper to load a JavaScript file into the page
 */
async function loadScript( page, filePath ) {
	const content = fs.readFileSync( filePath, 'utf8' );
	await page.evaluate( ( code ) => {
		const script = document.createElement( 'script' );
		script.textContent = code;
		document.head.appendChild( script );
	}, content );
}

/**
 * Setup the MediaWiki global mocks
 */
async function setupMWMocks( page ) {
	await page.evaluate( () => {
		// Mock MediaWiki globals
		window.mw = {
			config: {
				get: function ( key ) {
					const config = {
						wgLayersDebug: false,
						wgLayersMaxBytes: 2097152,
						wgLayersMaxLayerCount: 100
					};
					return config[ key ];
				}
			},
			message: function ( key ) {
				return { text: function () { return key; } };
			},
			msg: function ( key ) { return key; },
			log: function () {},
			Api: function () {
				return {
					postWithToken: function () { return Promise.resolve( {} ); },
					get: function () { return Promise.resolve( {} ); }
				};
			}
		};
		
		// Mock jQuery (minimal)
		window.$ = window.jQuery = function ( selector ) {
			if ( typeof selector === 'string' ) {
				return document.querySelectorAll( selector );
			}
			return selector;
		};
		window.$.extend = Object.assign;
		
		// Setup Layers namespace
		window.Layers = {
			Utils: {},
			Core: {},
			UI: {},
			Canvas: {},
			Validation: {},
			Shared: {}
		};
	} );
}

test.describe( 'Layers Module Loading', () => {
	test.beforeEach( async ( { page } ) => {
		await page.goto( 'about:blank' );
		await setupMWMocks( page );
	} );

	test( 'LayerDataNormalizer loads and works', async ( { page } ) => {
		// Load the normalizer
		const normalizerPath = path.join( resourcesDir, 'ext.layers.shared/LayerDataNormalizer.js' );
		await loadScript( page, normalizerPath );
		
		// Test normalization
		const result = await page.evaluate( () => {
			const normalizer = window.Layers.Shared.LayerDataNormalizer ||
				window.LayerDataNormalizer ||
				window.Layers.Utils.LayerDataNormalizer;
			
			if ( !normalizer ) {
				return { error: 'LayerDataNormalizer not found' };
			}
			
			// Check that the static method exists
			if ( typeof normalizer.normalizeLayer !== 'function' ) {
				return { error: 'normalizeLayer method not found' };
			}
			
			// Test boolean normalization
			const layer = {
				visible: 'true',
				locked: 'false',
				shadow: 'true',
				opacity: '0.5',
				x: '100',
				y: '200'
			};
			
			const normalized = normalizer.normalizeLayer( layer );
			return {
				visible: normalized.visible,
				locked: normalized.locked,
				shadow: normalized.shadow,
				opacity: normalized.opacity,
				x: normalized.x,
				y: normalized.y,
				visibleType: typeof normalized.visible,
				opacityType: typeof normalized.opacity
			};
		} );
		
		expect( result.error ).toBeUndefined();
		expect( result.visible ).toBe( true );
		expect( result.locked ).toBe( false );
		expect( result.shadow ).toBe( true );
		expect( result.visibleType ).toBe( 'boolean' );
		expect( result.opacityType ).toBe( 'number' );
	} );

	test( 'LayersValidator loads and validates', async ( { page } ) => {
		// Load the validator
		const validatorPath = path.join( resourcesDir, 'ext.layers.editor/LayersValidator.js' );
		await loadScript( page, validatorPath );
		
		const result = await page.evaluate( () => {
			const LayersValidation = window.Layers && window.Layers.Validation;
			const LayersShared = window.Layers && window.Layers.Shared;
			const validator = ( LayersValidation && LayersValidation.LayersValidator ) ||
				( LayersShared && LayersShared.LayersValidator ) ||
				window.LayersValidator;
			
			if ( !validator ) {
				return { error: 'LayersValidator not found' };
			}
			
			// Test instantiation and methods
			try {
				const instance = new validator();
				return {
					hasValidateLayer: typeof instance.validateLayer === 'function',
					hasValidateAll: typeof instance.validateAll === 'function',
					loaded: true
				};
			} catch ( e ) {
				return { error: 'Failed to instantiate: ' + e.message };
			}
		} );
		
		expect( result.error ).toBeUndefined();
		expect( result.loaded ).toBe( true );
	} );

	test( 'EventTracker loads and tracks events', async ( { page } ) => {
		// Load EventTracker
		const trackerPath = path.join( resourcesDir, 'ext.layers.editor/EventTracker.js' );
		await loadScript( page, trackerPath );
		
		const result = await page.evaluate( () => {
			const LayersUtils = window.Layers && window.Layers.Utils;
			const EventTracker = ( LayersUtils && LayersUtils.EventTracker ) || window.EventTracker;
			
			if ( !EventTracker ) {
				return { error: 'EventTracker not found' };
			}
			
			try {
				const tracker = new EventTracker();
				let callCount = 0;
				
				const element = document.createElement( 'div' );
				document.body.appendChild( element );
				
				const handler = function () { callCount++; };
				tracker.add( element, 'click', handler );
				
				// Trigger click
				element.click();
				const countAfterClick = callCount;
				
				// Cleanup
				tracker.destroy();
				element.click();
				const countAfterDestroy = callCount;
				
				return {
					countAfterClick,
					countAfterDestroy,
					eventWasTracked: countAfterClick === 1,
					eventWasRemoved: countAfterDestroy === 1
				};
			} catch ( e ) {
				return { error: 'Failed: ' + e.message };
			}
		} );
		
		expect( result.error ).toBeUndefined();
		expect( result.eventWasTracked ).toBe( true );
		expect( result.eventWasRemoved ).toBe( true );
	} );
} );

test.describe( 'Canvas Rendering', () => {
	test.beforeEach( async ( { page } ) => {
		await page.goto( 'about:blank' );
		await setupMWMocks( page );
	} );

	test( 'can render basic shapes on canvas', async ( { page } ) => {
		const result = await page.evaluate( () => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = 400;
			canvas.height = 300;
			document.body.appendChild( canvas );
			
			const ctx = canvas.getContext( '2d' );
			
			// Draw rectangle
			ctx.fillStyle = '#ff0000';
			ctx.fillRect( 50, 50, 100, 80 );
			
			// Draw circle
			ctx.fillStyle = '#00ff00';
			ctx.beginPath();
			ctx.arc( 250, 100, 40, 0, Math.PI * 2 );
			ctx.fill();
			
			// Draw line
			ctx.strokeStyle = '#0000ff';
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo( 50, 200 );
			ctx.lineTo( 350, 250 );
			ctx.stroke();
			
			// Check pixels
			const rectPixel = ctx.getImageData( 100, 90, 1, 1 ).data;
			const circlePixel = ctx.getImageData( 250, 100, 1, 1 ).data;
			
			return {
				rectIsRed: rectPixel[ 0 ] === 255 && rectPixel[ 1 ] === 0,
				circleIsGreen: circlePixel[ 1 ] === 255 && circlePixel[ 0 ] === 0
			};
		} );
		
		expect( result.rectIsRed ).toBe( true );
		expect( result.circleIsGreen ).toBe( true );
	} );

	test( 'can apply transformations', async ( { page } ) => {
		const result = await page.evaluate( () => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = 200;
			canvas.height = 200;
			document.body.appendChild( canvas );
			
			const ctx = canvas.getContext( '2d' );
			
			// Test rotation
			ctx.save();
			ctx.translate( 100, 100 );
			ctx.rotate( Math.PI / 4 ); // 45 degrees
			ctx.fillStyle = '#ff0000';
			ctx.fillRect( -25, -25, 50, 50 );
			ctx.restore();
			
			// The rotated square should have red pixels at the center
			const centerPixel = ctx.getImageData( 100, 100, 1, 1 ).data;
			
			// Test scale
			ctx.save();
			ctx.scale( 2, 2 );
			ctx.fillStyle = '#00ff00';
			ctx.fillRect( 10, 10, 10, 10 );
			ctx.restore();
			
			// Scaled rectangle should be at (20, 20) with size (20, 20)
			const scaledPixel = ctx.getImageData( 30, 30, 1, 1 ).data;
			
			return {
				rotationWorks: centerPixel[ 0 ] === 255,
				scaleWorks: scaledPixel[ 1 ] === 255
			};
		} );
		
		expect( result.rotationWorks ).toBe( true );
		expect( result.scaleWorks ).toBe( true );
	} );

	test( 'can render text', async ( { page } ) => {
		const result = await page.evaluate( () => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = 300;
			canvas.height = 100;
			document.body.appendChild( canvas );
			
			const ctx = canvas.getContext( '2d' );
			ctx.fillStyle = '#ffffff';
			ctx.fillRect( 0, 0, 300, 100 );
			
			ctx.font = '24px Arial';
			ctx.fillStyle = '#000000';
			ctx.fillText( 'Test Text', 50, 50 );
			
			// Check that some pixels were drawn (not all white)
			const imageData = ctx.getImageData( 0, 0, 300, 100 );
			let hasBlackPixel = false;
			for ( let i = 0; i < imageData.data.length; i += 4 ) {
				if ( imageData.data[ i ] === 0 &&
					imageData.data[ i + 1 ] === 0 &&
					imageData.data[ i + 2 ] === 0 ) {
					hasBlackPixel = true;
					break;
				}
			}
			
			return { textRendered: hasBlackPixel };
		} );
		
		expect( result.textRendered ).toBe( true );
	} );

	test( 'can apply shadows', async ( { page } ) => {
		const result = await page.evaluate( () => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = 200;
			canvas.height = 200;
			document.body.appendChild( canvas );
			
			const ctx = canvas.getContext( '2d' );
			ctx.fillStyle = '#ffffff';
			ctx.fillRect( 0, 0, 200, 200 );
			
			// Draw with shadow
			ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 5;
			ctx.shadowOffsetY = 5;
			ctx.fillStyle = '#ff0000';
			ctx.fillRect( 50, 50, 80, 80 );
			
			// Check for shadow (gray pixels outside the red rectangle)
			const shadowPixel = ctx.getImageData( 140, 140, 1, 1 ).data;
			const hasShadow = shadowPixel[ 0 ] < 255 && shadowPixel[ 0 ] > 0;
			
			return { shadowRendered: hasShadow };
		} );
		
		expect( result.shadowRendered ).toBe( true );
	} );
} );

test.describe( 'Gradient envelope pixels', () => {
	test.beforeEach( async ( { page } ) => {
		await page.setContent( '<!doctype html><html><body></body></html>' );
		await setupMWMocks( page );
		await loadScript( page, path.join( resourcesDir, 'ext.layers.shared/GradientRenderer.js' ) );
		await loadScript( page, path.join( resourcesDir, 'ext.layers.shared/TextRenderer.js' ) );
	} );

	test( 'radial percentages, moved centres and zero produce the expected colours', async ( { page } ) => {
		const samples = await page.evaluate( () => {
			const canvas = document.createElement( 'canvas' ); canvas.width = 400; canvas.height = 300;
			const ctx = canvas.getContext( '2d' ), renderer = new window.Layers.GradientRenderer( ctx );
			const colors = [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' } ], samples = [];
			for ( const [ radius, centerX, centerY ] of [ [ 0.5, 0.5, 0.5 ], [ 1, 0.5, 0.5 ], [ 2, 0.5, 0.5 ], [ 1, 0, 0 ], [ 1, 1, 1 ] ] ) {
				ctx.clearRect( 0, 0, 400, 300 );
				ctx.fillStyle = renderer.createGradient( { gradient: { type: 'radial', radius, centerX, centerY, colors } }, { x: 0, y: 0, width: 400, height: 300 } );
				ctx.fillRect( 0, 0, 400, 300 );
				for ( const [ x, y ] of [ [ 0, 0 ], [ 199, 149 ], [ 399, 299 ], [ 99, 74 ] ] ) {
					const t = Math.min( 1, Math.hypot( x + 0.5 - centerX * 400, y + 0.5 - centerY * 300 ) / ( radius * 500 ) );
					samples.push( { actual: Array.from( ctx.getImageData( x, y, 1, 1 ).data ), expected: [ 255 * ( 1 - t ), 0, 255 * t, 255 ] } );
				}
			}
			ctx.clearRect( 0, 0, 400, 300 );
			ctx.fillStyle = renderer.createGradient( { gradient: { type: 'radial', radius: 0,
				colors: [ { offset: 1, color: 'rgba(0,0,255,0.25)' }, { offset: 0, color: '#f00' } ] } }, { x: 0, y: 0, width: 400, height: 300 } );
			ctx.fillRect( 0, 0, 400, 300 );
			samples.push( { actual: Array.from( ctx.getImageData( 200, 150, 1, 1 ).data ), expected: [ 0, 0, 255, 64 ] } );
			return samples;
		} );
		for ( const sample of samples ) { sample.actual.forEach( ( value, index ) => expect( Math.abs( value - sample.expected[ index ] ) ).toBeLessThanOrEqual( 2 ) ); }
	} );

	test( 'radial Text paint follows alignment, rotation and zoom without changing its parameters', async ( { page } ) => {
		const result = await page.evaluate( () => {
			let samples = 0, maxError = 0;
			for ( const align of [ 'left', 'center', 'right' ] ) for ( const rotation of [ 0, 37 ] ) for ( const zoom of [ 0.5, 1, 2 ] ) for ( const radius of [ 0, 0.5, 2 ] ) {
				const canvas = document.createElement( 'canvas' ); canvas.width = 1200; canvas.height = 700;
				const ctx = canvas.getContext( '2d' ); ctx.font = '48px Arial'; const width = ctx.measureText( 'GRADIENT TEXT' ).width;
				ctx.translate( 600, 350 ); ctx.scale( zoom, zoom );
				const gradient = { type: 'radial', radius, centerX: 0.125, centerY: 0.7325,
					colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' } ] };
				const before = JSON.stringify( gradient ), renderer = new window.Layers.GradientRenderer( ctx ), create = renderer.createGradient.bind( renderer );
				let bounds, inverse;
				renderer.createGradient = ( layer, value, options ) => { bounds = value; inverse = ctx.getTransform().inverse(); return create( layer, value, options ); };
				new window.Layers.TextRenderer( ctx, { gradientRenderer: renderer } ).draw( { text: 'GRADIENT TEXT',
					x: align === 'center' ? 0 : align === 'right' ? width / 2 : -width / 2, y: 12,
					fontSize: 48, fontFamily: 'Arial', textAlign: align, rotation, gradient } );
				if ( JSON.stringify( gradient ) !== before ) throw new Error( 'Rendering changed gradient data' );
				const data = ctx.getImageData( 0, 0, 1200, 700 ).data;
				for ( let y = 0; y < 700; y += 7 ) for ( let x = 0; x < 1200; x += 7 ) {
					const index = ( y * 1200 + x ) * 4; if ( data[ index + 3 ] !== 255 ) continue;
					const p = inverse.transformPoint( { x: x + 0.5, y: y + 0.5 } );
					const t = radius === 0 ? 1 : Math.min( 1, Math.hypot( p.x - bounds.x - bounds.width * gradient.centerX,
						p.y - bounds.y - bounds.height * gradient.centerY ) / ( Math.hypot( bounds.width, bounds.height ) * radius ) );
					maxError = Math.max( maxError, Math.abs( data[ index ] - 255 * ( 1 - t ) ), Math.abs( data[ index + 2 ] - 255 * t ) ); samples++;
				}
			}
			return { samples, maxError };
		} );
		expect( result.samples ).toBeGreaterThan( 100 ); expect( result.maxError ).toBeLessThanOrEqual( 3 );
	} );

	test( 'wide Text vertical gradients reach both end colours at different font sizes', async ( { page } ) => {
		const rows = await page.evaluate( () => {
			const results = [];
			for ( const fontSize of [ 36, 72, 108 ] ) {
				const canvas = document.createElement( 'canvas' ); canvas.width = 1200; canvas.height = 200;
				const ctx = canvas.getContext( '2d' ), text = 'GRADIENT TEXT', y = 150;
				ctx.font = fontSize + 'px Arial'; const m = ctx.measureText( text ), h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
				new window.Layers.TextRenderer( ctx, { gradientRenderer: new window.Layers.GradientRenderer( ctx ) } ).draw( {
					text, x: 20, y, fontSize, fontFamily: 'Arial', gradient: { type: 'linear', angle: 90,
						colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' } ] }
				} );
				for ( const t of [ 0.1, 0.9 ] ) {
					const data = ctx.getImageData( 0, Math.round( y - m.actualBoundingBoxAscent + t * h ), canvas.width, 1 ).data;
					const pixels = [];
					for ( let x = 0; x < data.length; x += 4 ) { if ( data[ x + 3 ] > 250 ) pixels.push( [ data[ x ], data[ x + 2 ] ] ); }
					results.push( { t, count: pixels.length, red: pixels.reduce( ( sum, p ) => sum + p[ 0 ], 0 ) / pixels.length,
						blue: pixels.reduce( ( sum, p ) => sum + p[ 1 ], 0 ) / pixels.length } );
				}
			}
			return results;
		} );
		for ( const row of rows ) {
			expect( row.count ).toBeGreaterThan( 5 );
			expect( row.t < 0.5 ? row.red : row.blue ).toBeGreaterThan( 200 );
			expect( row.t < 0.5 ? row.blue : row.red ).toBeLessThan( 55 );
		}
	} );
} );

test.describe( 'Browser Compatibility', () => {
	test( 'supports required APIs', async ( { page } ) => {
		await page.goto( 'about:blank' );
		
		const result = await page.evaluate( () => {
			return {
				hasCanvas: !!document.createElement( 'canvas' ).getContext,
				hasPromise: typeof Promise !== 'undefined',
				hasMap: typeof Map !== 'undefined',
				hasSet: typeof Set !== 'undefined',
				hasSymbol: typeof Symbol !== 'undefined',
				hasArrayFrom: typeof Array.from !== 'undefined',
				hasObjectAssign: typeof Object.assign !== 'undefined',
				hasRequestAnimationFrame: typeof requestAnimationFrame !== 'undefined',
				hasCustomEvent: typeof CustomEvent !== 'undefined',
				hasMutationObserver: typeof MutationObserver !== 'undefined',
				hasIntersectionObserver: typeof IntersectionObserver !== 'undefined',
				hasResizeObserver: typeof ResizeObserver !== 'undefined'
			};
		} );
		
		expect( result.hasCanvas ).toBe( true );
		expect( result.hasPromise ).toBe( true );
		expect( result.hasMap ).toBe( true );
		expect( result.hasSet ).toBe( true );
		expect( result.hasSymbol ).toBe( true );
		expect( result.hasArrayFrom ).toBe( true );
		expect( result.hasObjectAssign ).toBe( true );
		expect( result.hasRequestAnimationFrame ).toBe( true );
		expect( result.hasCustomEvent ).toBe( true );
		expect( result.hasMutationObserver ).toBe( true );
	} );

	test( 'supports ES6 features used by Layers', async ( { page } ) => {
		await page.goto( 'about:blank' );
		
		const result = await page.evaluate( () => {
			try {
				// Test class syntax
				class TestClass {
					constructor( value ) {
						this.value = value;
					}
					getValue() {
						return this.value;
					}
				}
				const instance = new TestClass( 42 );
				
				// Test arrow functions
				const arrowFn = ( x ) => x * 2;
				
				// Test template literals
				const template = `Value: ${ instance.getValue() }`;
				
				// Test destructuring
				const { value } = instance;
				const [ first ] = [ 1, 2 ];
				
				// Test spread operator
				const arr1 = [ 1, 2, 3 ];
				const arr2 = [ ...arr1, 4, 5 ];
				
				// Test default parameters
				const defaultFn = ( x = 10 ) => x;
				
				// Test async/await (just check syntax support)
				const asyncFn = async () => await Promise.resolve( 1 );
				
				return {
					classWorks: instance.getValue() === 42,
					arrowWorks: arrowFn( 5 ) === 10,
					templateWorks: template === 'Value: 42',
					destructuringWorks: value === 42 && first === 1,
					spreadWorks: arr2.length === 5,
					defaultParamsWork: defaultFn() === 10,
					asyncWorks: typeof asyncFn === 'function'
				};
			} catch ( e ) {
				return { error: e.message };
			}
		} );
		
		expect( result.error ).toBeUndefined();
		expect( result.classWorks ).toBe( true );
		expect( result.arrowWorks ).toBe( true );
		expect( result.templateWorks ).toBe( true );
		expect( result.destructuringWorks ).toBe( true );
		expect( result.spreadWorks ).toBe( true );
		expect( result.defaultParamsWork ).toBe( true );
		expect( result.asyncWorks ).toBe( true );
	} );
} );
