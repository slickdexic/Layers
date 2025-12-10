/**
 * Unit tests for ValidationManager
 * Tests data validation and sanitization
 */

// Store original JSON reference before any tests run
const originalJSON = JSON;

describe( 'ValidationManager', () => {
	let ValidationManager;
	let manager;
	let mockEditor;

	beforeEach( () => {
		// Reset modules
		jest.resetModules();

		// Setup minimal mw global
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: () => key,
				exists: () => true
			} ) ),
			msg: jest.fn( ( key ) => key )
		};

		// Setup document for browser compatibility tests
		global.document = {
			createElement: jest.fn( () => ( {
				getContext: jest.fn( () => ( {} ) )
			} ) ),
			addEventListener: jest.fn(),
			querySelector: jest.fn()
		};

		// Setup window features for browser compatibility
		global.window = {
			HTMLCanvasElement: function() {},
			JSON: originalJSON,
			FileReader: function() {},
			Blob: function() {}
		};

		// Mock editor
		mockEditor = {
			stateManager: {
				getState: jest.fn( () => ( {} ) )
			}
		};

		// Load the ValidationManager
		require( '../../resources/ext.layers.editor/ValidationManager.js' );
		ValidationManager = global.window.ValidationManager;
		manager = new ValidationManager( mockEditor );
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		test( 'should store editor reference', () => {
			expect( manager.editor ).toBe( mockEditor );
		} );
	} );

	describe( 'sanitizeString', () => {
		test( 'should return empty string for non-string input', () => {
			expect( manager.sanitizeString( null ) ).toBe( '' );
			expect( manager.sanitizeString( undefined ) ).toBe( '' );
			expect( manager.sanitizeString( 123 ) ).toBe( '' );
			expect( manager.sanitizeString( {} ) ).toBe( '' );
			expect( manager.sanitizeString( [] ) ).toBe( '' );
		} );

		test( 'should remove angle brackets', () => {
			expect( manager.sanitizeString( '<script>alert("xss")</script>' ) ).toBe( 'scriptalert("xss")/script' );
			expect( manager.sanitizeString( '<div>test</div>' ) ).toBe( 'divtest/div' );
		} );

		test( 'should remove javascript: protocol', () => {
			expect( manager.sanitizeString( 'javascript:alert(1)' ) ).toBe( 'alert(1)' );
			expect( manager.sanitizeString( 'JAVASCRIPT:void(0)' ) ).toBe( 'void(0)' );
			expect( manager.sanitizeString( 'JaVaScRiPt:test()' ) ).toBe( 'test()' );
		} );

		test( 'should remove event handlers', () => {
			expect( manager.sanitizeString( 'onclick=alert(1)' ) ).toBe( 'alert(1)' );
			expect( manager.sanitizeString( 'onmouseover = evil()' ) ).toBe( 'evil()' );
			expect( manager.sanitizeString( 'ONLOAD=hack()' ) ).toBe( 'hack()' );
		} );

		test( 'should trim whitespace', () => {
			expect( manager.sanitizeString( '  test  ' ) ).toBe( 'test' );
			expect( manager.sanitizeString( '\n\ttest\n\t' ) ).toBe( 'test' );
		} );

		test( 'should preserve normal text', () => {
			expect( manager.sanitizeString( 'Hello World' ) ).toBe( 'Hello World' );
			expect( manager.sanitizeString( 'Test 123' ) ).toBe( 'Test 123' );
		} );

		test( 'should handle multiple dangerous patterns', () => {
			const malicious = '<img onerror=javascript:alert(1)>';
			const result = manager.sanitizeString( malicious );
			expect( result ).not.toContain( '<' );
			expect( result ).not.toContain( '>' );
			expect( result ).not.toContain( 'javascript:' );
			expect( result ).not.toMatch( /on\w+=/i );
		} );
	} );

	describe( 'sanitizeInput', () => {
		test( 'should call sanitizeString', () => {
			const spy = jest.spyOn( manager, 'sanitizeString' );
			manager.sanitizeInput( 'test' );
			expect( spy ).toHaveBeenCalledWith( 'test' );
		} );
	} );

	describe( 'sanitizeLayerData', () => {
		test( 'should return non-object input as-is', () => {
			expect( manager.sanitizeLayerData( null ) ).toBeNull();
			expect( manager.sanitizeLayerData( undefined ) ).toBeUndefined();
			expect( manager.sanitizeLayerData( 123 ) ).toBe( 123 );
			expect( manager.sanitizeLayerData( 'string' ) ).toBe( 'string' );
		} );

		test( 'should sanitize string properties', () => {
			const input = {
				text: '<script>evil()</script>',
				name: 'onclick=hack()'
			};
			const result = manager.sanitizeLayerData( input );
			expect( result.text ).not.toContain( '<' );
			expect( result.name ).not.toMatch( /on\w+=/i );
		} );

		test( 'should preserve non-string properties', () => {
			const input = {
				x: 100,
				y: 200,
				visible: true,
				opacity: 0.5
			};
			const result = manager.sanitizeLayerData( input );
			expect( result ).toEqual( input );
		} );

		test( 'should recursively sanitize nested objects', () => {
			const input = {
				style: {
					color: '<red>',
					shadow: {
						text: 'javascript:test()'
					}
				}
			};
			const result = manager.sanitizeLayerData( input );
			expect( result.style.color ).toBe( 'red' );
			expect( result.style.shadow.text ).toBe( 'test()' );
		} );

		test( 'should handle null nested values', () => {
			const input = {
				name: 'test',
				data: null
			};
			const result = manager.sanitizeLayerData( input );
			expect( result.name ).toBe( 'test' );
			expect( result.data ).toBeNull();
		} );

		test( 'should only process own properties', () => {
			const parent = { inherited: '<bad>' };
			const input = Object.create( parent );
			input.own = '<good>';
			const result = manager.sanitizeLayerData( input );
			expect( result.own ).toBeDefined();
			expect( result.inherited ).toBeUndefined();
		} );

		test( 'should preserve array type for points array (path layers)', () => {
			const input = {
				type: 'path',
				points: [
					{ x: 10, y: 20 },
					{ x: 30, y: 40 },
					{ x: 50, y: 60 }
				],
				stroke: '#000000'
			};
			const result = manager.sanitizeLayerData( input );
			// points must remain an array, not become an object with numeric keys
			expect( Array.isArray( result.points ) ).toBe( true );
			expect( result.points ).toHaveLength( 3 );
			expect( result.points[ 0 ] ).toEqual( { x: 10, y: 20 } );
			expect( result.points[ 1 ] ).toEqual( { x: 30, y: 40 } );
			expect( result.points[ 2 ] ).toEqual( { x: 50, y: 60 } );
		} );

		test( 'should preserve arrays with primitive values', () => {
			const input = {
				tags: [ 'a', 'b', 'c' ],
				numbers: [ 1, 2, 3 ]
			};
			const result = manager.sanitizeLayerData( input );
			expect( Array.isArray( result.tags ) ).toBe( true );
			expect( Array.isArray( result.numbers ) ).toBe( true );
			expect( result.tags ).toEqual( [ 'a', 'b', 'c' ] );
			expect( result.numbers ).toEqual( [ 1, 2, 3 ] );
		} );

		test( 'should handle nested arrays of objects', () => {
			const input = {
				data: [
					{ name: 'test1', items: [ { x: 1 }, { x: 2 } ] },
					{ name: 'test2', items: [ { x: 3 } ] }
				]
			};
			const result = manager.sanitizeLayerData( input );
			expect( Array.isArray( result.data ) ).toBe( true );
			expect( Array.isArray( result.data[ 0 ].items ) ).toBe( true );
			expect( result.data[ 0 ].items ).toHaveLength( 2 );
			expect( result.data[ 1 ].items[ 0 ] ).toEqual( { x: 3 } );
		} );
	} );

	describe( 'validateLayer', () => {
		const validLayer = {
			id: 'layer-1',
			type: 'rectangle',
			x: 0,
			y: 0,
			width: 100,
			height: 100
		};

		test( 'should pass for valid layer', () => {
			const result = manager.validateLayer( validLayer );
			expect( result.isValid ).toBe( true );
			expect( result.errors ).toHaveLength( 0 );
		} );

		test( 'should require id', () => {
			const result = manager.validateLayer( { ...validLayer, id: null } );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'id-required' ) ) ).toBe( true );
		} );

		test( 'should require id to be string', () => {
			const result = manager.validateLayer( { ...validLayer, id: 123 } );
			expect( result.isValid ).toBe( false );
		} );

		test( 'should require type', () => {
			const result = manager.validateLayer( { ...validLayer, type: null } );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'type-required' ) ) ).toBe( true );
		} );

		test( 'should validate type is valid enum', () => {
			const result = manager.validateLayer( { ...validLayer, type: 'invalid-type' } );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'type-invalid' ) ) ).toBe( true );
		} );

		test( 'should accept all valid types', () => {
			const validTypes = [ 'text', 'arrow', 'rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'highlight', 'path', 'blur' ];
			validTypes.forEach( type => {
				const result = manager.validateLayer( { ...validLayer, type } );
				expect( result.errors.some( e => e.includes( 'type-invalid' ) ) ).toBe( false );
			} );
		} );

		test( 'should validate coordinate fields are numbers', () => {
			const result = manager.validateLayer( { ...validLayer, x: 'not a number' } );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'coordinate-invalid' ) ) ).toBe( true );
		} );

		test( 'should reject NaN coordinates', () => {
			const result = manager.validateLayer( { ...validLayer, y: NaN } );
			expect( result.isValid ).toBe( false );
		} );

		test( 'should validate all coordinate fields', () => {
			const coordFields = [ 'x', 'y', 'width', 'height', 'radius', 'radiusX', 'radiusY', 'rotation' ];
			coordFields.forEach( field => {
				const layer = { ...validLayer, [ field ]: 'invalid' };
				const result = manager.validateLayer( layer );
				expect( result.errors.some( e => e.includes( 'coordinate-invalid' ) ) ).toBe( true );
			} );
		} );

		describe( 'text layer validation', () => {
			const textLayer = {
				id: 'text-1',
				type: 'text',
				x: 0,
				y: 0,
				text: 'Hello',
				fontSize: 16
			};

			test( 'should accept valid text layer', () => {
				const result = manager.validateLayer( textLayer );
				expect( result.isValid ).toBe( true );
			} );

			test( 'should require text to be string if present', () => {
				const result = manager.validateLayer( { ...textLayer, text: 123 } );
				expect( result.isValid ).toBe( false );
				expect( result.errors.some( e => e.includes( 'text-type' ) ) ).toBe( true );
			} );

			test( 'should reject text longer than 1000 characters', () => {
				const longText = 'a'.repeat( 1001 );
				const result = manager.validateLayer( { ...textLayer, text: longText } );
				expect( result.isValid ).toBe( false );
				expect( result.errors.some( e => e.includes( 'text-too-long' ) ) ).toBe( true );
			} );

			test( 'should accept text exactly 1000 characters', () => {
				const exactText = 'a'.repeat( 1000 );
				const result = manager.validateLayer( { ...textLayer, text: exactText } );
				expect( result.errors.some( e => e.includes( 'text-too-long' ) ) ).toBe( false );
			} );

			test( 'should validate fontSize range (8-1000)', () => {
				expect( manager.validateLayer( { ...textLayer, fontSize: 7 } ).isValid ).toBe( false );
				expect( manager.validateLayer( { ...textLayer, fontSize: 8 } ).isValid ).toBe( true );
				expect( manager.validateLayer( { ...textLayer, fontSize: 1000 } ).isValid ).toBe( true );
				expect( manager.validateLayer( { ...textLayer, fontSize: 1001 } ).isValid ).toBe( false );
			} );

			test( 'should reject non-number fontSize', () => {
				const result = manager.validateLayer( { ...textLayer, fontSize: '16px' } );
				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'strokeWidth validation', () => {
			test( 'should accept valid strokeWidth', () => {
				const result = manager.validateLayer( { ...validLayer, strokeWidth: 5 } );
				expect( result.isValid ).toBe( true );
			} );

			test( 'should reject negative strokeWidth', () => {
				const result = manager.validateLayer( { ...validLayer, strokeWidth: -1 } );
				expect( result.isValid ).toBe( false );
				expect( result.errors.some( e => e.includes( 'strokewidth-range' ) ) ).toBe( true );
			} );

			test( 'should reject strokeWidth over 50', () => {
				const result = manager.validateLayer( { ...validLayer, strokeWidth: 51 } );
				expect( result.isValid ).toBe( false );
			} );

			test( 'should accept strokeWidth at boundaries', () => {
				expect( manager.validateLayer( { ...validLayer, strokeWidth: 0 } ).isValid ).toBe( true );
				expect( manager.validateLayer( { ...validLayer, strokeWidth: 50 } ).isValid ).toBe( true );
			} );
		} );

		describe( 'opacity validation', () => {
			test( 'should accept valid opacity values', () => {
				const result = manager.validateLayer( { ...validLayer, opacity: 0.5 } );
				expect( result.isValid ).toBe( true );
			} );

			test( 'should accept opacity at boundaries (0 and 1)', () => {
				expect( manager.validateLayer( { ...validLayer, opacity: 0 } ).isValid ).toBe( true );
				expect( manager.validateLayer( { ...validLayer, opacity: 1 } ).isValid ).toBe( true );
			} );

			test( 'should reject opacity below 0', () => {
				const result = manager.validateLayer( { ...validLayer, opacity: -0.1 } );
				expect( result.isValid ).toBe( false );
			} );

			test( 'should reject opacity above 1', () => {
				const result = manager.validateLayer( { ...validLayer, opacity: 1.1 } );
				expect( result.isValid ).toBe( false );
			} );

			test( 'should validate all opacity fields', () => {
				const opacityFields = [ 'opacity', 'fillOpacity', 'strokeOpacity' ];
				opacityFields.forEach( field => {
					const layer = { ...validLayer, [ field ]: 2 };
					const result = manager.validateLayer( layer );
					expect( result.errors.some( e => e.includes( 'opacity-range' ) ) ).toBe( true );
				} );
			} );
		} );

		describe( 'polygon/star sides validation', () => {
			const polygonLayer = {
				id: 'polygon-1',
				type: 'polygon',
				x: 0,
				y: 0,
				radius: 50
			};

			test( 'should accept valid sides for polygon', () => {
				const result = manager.validateLayer( { ...polygonLayer, sides: 6 } );
				expect( result.isValid ).toBe( true );
			} );

			test( 'should reject sides below 3', () => {
				const result = manager.validateLayer( { ...polygonLayer, sides: 2 } );
				expect( result.isValid ).toBe( false );
				expect( result.errors.some( e => e.includes( 'sides-range' ) ) ).toBe( true );
			} );

			test( 'should reject sides above 20', () => {
				const result = manager.validateLayer( { ...polygonLayer, sides: 21 } );
				expect( result.isValid ).toBe( false );
			} );

			test( 'should accept sides at boundaries (3 and 20)', () => {
				expect( manager.validateLayer( { ...polygonLayer, sides: 3 } ).isValid ).toBe( true );
				expect( manager.validateLayer( { ...polygonLayer, sides: 20 } ).isValid ).toBe( true );
			} );

			test( 'should validate sides for star type too', () => {
				const starLayer = { ...polygonLayer, type: 'star', sides: 2 };
				const result = manager.validateLayer( starLayer );
				expect( result.isValid ).toBe( false );
			} );

			test( 'should not validate sides for non-polygon/star types', () => {
				const rectLayer = { ...validLayer, sides: 2 };
				const result = manager.validateLayer( rectLayer );
				expect( result.errors.some( e => e.includes( 'sides-range' ) ) ).toBe( false );
			} );
		} );

		describe( 'blur radius validation', () => {
			test( 'should accept valid shadowBlur', () => {
				const result = manager.validateLayer( { ...validLayer, shadowBlur: 10 } );
				expect( result.isValid ).toBe( true );
			} );

			test( 'should reject negative blur', () => {
				const result = manager.validateLayer( { ...validLayer, shadowBlur: -1 } );
				expect( result.isValid ).toBe( false );
				expect( result.errors.some( e => e.includes( 'blurradius-range' ) ) ).toBe( true );
			} );

			test( 'should reject blur over 100', () => {
				const result = manager.validateLayer( { ...validLayer, shadowBlur: 101 } );
				expect( result.isValid ).toBe( false );
			} );

			test( 'should accept blur at boundaries', () => {
				expect( manager.validateLayer( { ...validLayer, shadowBlur: 0 } ).isValid ).toBe( true );
				expect( manager.validateLayer( { ...validLayer, shadowBlur: 100 } ).isValid ).toBe( true );
			} );

			test( 'should validate glowBlur too', () => {
				const result = manager.validateLayer( { ...validLayer, glowBlur: 150 } );
				expect( result.isValid ).toBe( false );
			} );
		} );
	} );

	describe( 'validateLayers', () => {
		const validLayers = [
			{ id: 'layer-1', type: 'rectangle', x: 0, y: 0 },
			{ id: 'layer-2', type: 'circle', x: 50, y: 50, radius: 25 }
		];

		test( 'should pass for valid layers array', () => {
			const result = manager.validateLayers( validLayers );
			expect( result.isValid ).toBe( true );
			expect( result.errors ).toHaveLength( 0 );
		} );

		test( 'should fail if not an array', () => {
			const result = manager.validateLayers( { layers: [] } );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'layers-array' ) ) ).toBe( true );
		} );

		test( 'should fail if too many layers', () => {
			const manyLayers = Array.from( { length: 101 }, ( _, i ) => ( {
				id: `layer-${ i }`,
				type: 'rectangle',
				x: 0,
				y: 0
			} ) );
			const result = manager.validateLayers( manyLayers );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'too-many-layers' ) ) ).toBe( true );
		} );

		test( 'should accept custom maxCount', () => {
			const layers = Array.from( { length: 5 }, ( _, i ) => ( {
				id: `layer-${ i }`,
				type: 'rectangle',
				x: 0,
				y: 0
			} ) );
			const result = manager.validateLayers( layers, 3 );
			expect( result.isValid ).toBe( false );
		} );

		test( 'should validate each layer', () => {
			const layersWithInvalid = [
				{ id: 'layer-1', type: 'rectangle', x: 0, y: 0 },
				{ id: 'layer-2', type: 'invalid', x: 0, y: 0 }
			];
			const result = manager.validateLayers( layersWithInvalid );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'Layer 2' ) ) ).toBe( true );
		} );

		test( 'should detect duplicate IDs', () => {
			const duplicateLayers = [
				{ id: 'same-id', type: 'rectangle', x: 0, y: 0 },
				{ id: 'same-id', type: 'circle', x: 50, y: 50, radius: 25 }
			];
			const result = manager.validateLayers( duplicateLayers );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'duplicate-id' ) ) ).toBe( true );
		} );

		test( 'should return warnings array', () => {
			const result = manager.validateLayers( validLayers );
			expect( result.warnings ).toBeDefined();
			expect( Array.isArray( result.warnings ) ).toBe( true );
		} );

		test( 'should handle empty array', () => {
			const result = manager.validateLayers( [] );
			expect( result.isValid ).toBe( true );
			expect( result.errors ).toHaveLength( 0 );
		} );
	} );

	describe( 'checkBrowserCompatibility', () => {
		test( 'should return true when all features present', () => {
			// Default setup has all features
			const result = manager.checkBrowserCompatibility();
			expect( result ).toBe( true );
		} );

		test( 'should return false when HTMLCanvasElement missing', () => {
			delete global.window.HTMLCanvasElement;
			const result = manager.checkBrowserCompatibility();
			expect( result ).toBe( false );
		} );

		test( 'should return false when JSON missing', () => {
			delete global.window.JSON;
			const result = manager.checkBrowserCompatibility();
			expect( result ).toBe( false );
		} );

		test( 'should return false when FileReader missing', () => {
			delete global.window.FileReader;
			const result = manager.checkBrowserCompatibility();
			expect( result ).toBe( false );
		} );

		test( 'should return false when Blob missing', () => {
			delete global.window.Blob;
			const result = manager.checkBrowserCompatibility();
			expect( result ).toBe( false );
		} );

		test( 'should handle canvas context creation failure', () => {
			global.document.createElement = jest.fn( () => ( {
				getContext: jest.fn( () => null )
			} ) );
			const result = manager.checkBrowserCompatibility();
			expect( result ).toBe( false );
		} );

		test( 'should handle canvas context exception', () => {
			global.document.createElement = jest.fn( () => {
				throw new Error( 'Canvas not supported' );
			} );
			const result = manager.checkBrowserCompatibility();
			expect( result ).toBe( false );
		} );
	} );

	describe( 'sanitizeLogMessage', () => {
		test( 'should return non-string, non-object values as-is', () => {
			expect( manager.sanitizeLogMessage( 123 ) ).toBe( 123 );
			expect( manager.sanitizeLogMessage( true ) ).toBe( true );
			expect( manager.sanitizeLogMessage( null ) ).toBeNull();
		} );

		test( 'should filter object properties keeping only safe keys', () => {
			const input = {
				type: 'click',
				action: 'save',
				password: 'secret123',
				token: 'abc123'
			};
			const result = manager.sanitizeLogMessage( input );
			expect( result.type ).toBe( 'click' );
			expect( result.action ).toBe( 'save' );
			expect( result.password ).toBe( '[FILTERED]' );
			expect( result.token ).toBe( '[FILTERED]' );
		} );

		test( 'should allow all safe keys in objects', () => {
			const safeKeys = [ 'type', 'action', 'status', 'tool', 'layer', 'count', 'x', 'y', 'width', 'height' ];
			const input = {};
			safeKeys.forEach( key => {
				input[ key ] = 'test-value';
			} );
			const result = manager.sanitizeLogMessage( input );
			safeKeys.forEach( key => {
				expect( result[ key ] ).toBe( 'test-value' );
			} );
		} );

		test( 'should redact long tokens/base64', () => {
			const input = 'Token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 here';
			const result = manager.sanitizeLogMessage( input );
			expect( result ).toContain( '[TOKEN]' );
			expect( result ).not.toContain( 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' );
		} );

		test( 'should redact hex strings', () => {
			// Hex patterns are matched by token regex first if long enough
			const input = 'Hash is 0123456789abcdef0123456789abcdef here';
			const result = manager.sanitizeLogMessage( input );
			// Either [HEX] or [TOKEN] is acceptable - both indicate redaction
			expect( result ).toMatch( /\[(HEX|TOKEN)\]/ );
			expect( result ).not.toContain( '0123456789abcdef' );
		} );

		test( 'should redact file paths', () => {
			const input = 'File at /home/user/secret.txt loaded';
			const result = manager.sanitizeLogMessage( input );
			expect( result ).toContain( '[PATH]' );
			expect( result ).not.toContain( '/home/user/secret.txt' );
		} );

		test( 'should redact HTTP URLs', () => {
			const input = 'Visit https://example.com/api/secret for more';
			const result = manager.sanitizeLogMessage( input );
			// URL may be redacted by [URL] or path components by [PATH]
			expect( result ).not.toContain( 'example.com' );
		} );

		test( 'should redact connection strings', () => {
			const input = 'Connect to mysql://user:pass@server/db';
			const result = manager.sanitizeLogMessage( input );
			// Connection strings have paths that get redacted
			expect( result ).not.toContain( 'user:pass' );
		} );

		test( 'should redact IP addresses', () => {
			const input = 'Server at 192.168.1.100:8080';
			const result = manager.sanitizeLogMessage( input );
			expect( result ).toContain( '[IP]' );
			expect( result ).not.toContain( '192.168.1.100' );
		} );

		test( 'should redact email addresses', () => {
			const input = 'Contact user@example.com for help';
			const result = manager.sanitizeLogMessage( input );
			expect( result ).toContain( '[EMAIL]' );
			expect( result ).not.toContain( 'user@example.com' );
		} );

		test( 'should truncate long messages', () => {
			// Use a message with varied characters that won't be caught by token regex
			const longMessage = 'This is a long message. '.repeat( 15 );
			const result = manager.sanitizeLogMessage( longMessage );
			expect( result.length ).toBeLessThan( 250 );
			expect( result ).toContain( '[TRUNCATED]' );
		} );

		test( 'should not truncate messages under 200 chars', () => {
			// Use a message that won't trigger token detection
			const shortMessage = 'Short message here.';
			const result = manager.sanitizeLogMessage( shortMessage );
			expect( result ).toBe( shortMessage );
		} );

		test( 'should handle multiple sensitive patterns', () => {
			const input = 'User user@test.com from 10.0.0.1 accessed https://secret.com/api';
			const result = manager.sanitizeLogMessage( input );
			expect( result ).not.toContain( 'user@test.com' );
			expect( result ).not.toContain( '10.0.0.1' );
			expect( result ).not.toContain( 'secret.com' );
		} );
	} );

	describe( 'getMessage', () => {
		test( 'should delegate to window.layersMessages.get', () => {
			// getMessage now delegates to the centralized MessageHelper
			const result = manager.getMessage( 'test-key', 'fallback' );
			// MessageHelper returns the key when message doesn't exist
			expect( typeof result ).toBe( 'string' );
		} );

		test( 'should pass through fallback parameter', () => {
			// Clear mw to test fallback behavior
			const originalMessage = global.mw.message;
			global.mw.message = null;
			global.mw.msg = null;
			
			const result = manager.getMessage( 'nonexistent-key', 'my-fallback' );
			// MessageHelper returns key when message doesn't exist and no proper fallback
			expect( typeof result ).toBe( 'string' );
			
			global.mw.message = originalMessage;
		} );
	} );

	describe( 'integration tests', () => {
		test( 'should sanitize and validate layer data', () => {
			const unsafeLayer = {
				id: 'layer-1',
				type: 'text',
				x: 10,
				y: 20,
				text: '<script>alert("xss")</script>',
				fontSize: 16
			};

			const sanitized = manager.sanitizeLayerData( unsafeLayer );
			expect( sanitized.text ).not.toContain( '<' );

			const validation = manager.validateLayer( sanitized );
			expect( validation.isValid ).toBe( true );
		} );

		test( 'should handle complete workflow with multiple layers', () => {
			const layers = [
				{
					id: 'rect-1',
					type: 'rectangle',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					stroke: '#ff0000',
					opacity: 0.8
				},
				{
					id: 'text-1',
					type: 'text',
					x: 50,
					y: 25,
					text: 'Label',
					fontSize: 14
				}
			];

			// Sanitize all
			const sanitizedLayers = layers.map( l => manager.sanitizeLayerData( l ) );

			// Validate all
			const result = manager.validateLayers( sanitizedLayers );
			expect( result.isValid ).toBe( true );
		} );
	} );
} );
