/**
 * Unit tests for LogSanitizer utility
 */

describe( 'LogSanitizer', () => {
	let sanitizeLogMessage;

	beforeEach( () => {
		jest.resetModules();

		global.window = {
			Layers: {}
		};

		const module = require( '../../resources/ext.layers.editor/utils/LogSanitizer.js' );
		sanitizeLogMessage = module.sanitizeLogMessage;
	} );

	afterEach( () => {
		delete global.window;
	} );

	describe( 'non-string inputs', () => {
		it( 'should return null unchanged', () => {
			expect( sanitizeLogMessage( null ) ).toBe( null );
		} );

		it( 'should return undefined unchanged', () => {
			expect( sanitizeLogMessage( undefined ) ).toBe( undefined );
		} );

		it( 'should return numbers unchanged', () => {
			expect( sanitizeLogMessage( 42 ) ).toBe( 42 );
			expect( sanitizeLogMessage( 0 ) ).toBe( 0 );
			expect( sanitizeLogMessage( -1 ) ).toBe( -1 );
		} );

		it( 'should return booleans unchanged', () => {
			expect( sanitizeLogMessage( true ) ).toBe( true );
			expect( sanitizeLogMessage( false ) ).toBe( false );
		} );
	} );

	describe( 'object sanitization', () => {
		it( 'should pass through safe keys', () => {
			const input = { type: 'rectangle', action: 'create', x: 10, y: 20 };
			const result = sanitizeLogMessage( input );
			expect( result ).toEqual( { type: 'rectangle', action: 'create', x: 10, y: 20 } );
		} );

		it( 'should filter unsafe keys', () => {
			const input = { type: 'save', token: 'abc123', password: 'secret' };
			const result = sanitizeLogMessage( input );
			expect( result.type ).toBe( 'save' );
			expect( result.token ).toBe( '[FILTERED]' );
			expect( result.password ).toBe( '[FILTERED]' );
		} );

		it( 'should handle all safe keys', () => {
			const input = {
				type: 'a', action: 'b', status: 'c', tool: 'd',
				layer: 'e', count: 1, x: 2, y: 3, width: 4, height: 5
			};
			const result = sanitizeLogMessage( input );
			expect( result ).toEqual( input );
		} );

		it( 'should handle empty objects', () => {
			expect( sanitizeLogMessage( {} ) ).toEqual( {} );
		} );

		it( 'should not include inherited properties', () => {
			const proto = { inherited: 'value' };
			const obj = Object.create( proto );
			obj.type = 'test';
			const result = sanitizeLogMessage( obj );
			expect( result ).toEqual( { type: 'test' } );
			expect( result.inherited ).toBeUndefined();
		} );
	} );

	describe( 'string sanitization — tokens', () => {
		it( 'should replace long base64-like tokens', () => {
			const result = sanitizeLogMessage( 'token=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef' );
			expect( result ).not.toContain( 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' );
			expect( result ).toContain( '[TOKEN]' );
		} );

		it( 'should replace long hex strings', () => {
			// Hex-only strings (no letters beyond a-f) that don't match TOKEN first
			const result = sanitizeLogMessage( 'hash=0123456789abcdef0123456789abcdef' );
			// TOKEN regex fires first on alphanumeric runs >= 20 chars
			expect( result ).not.toContain( '0123456789abcdef' );
		} );
	} );

	describe( 'string sanitization — paths', () => {
		it( 'should replace Windows paths', () => {
			const result = sanitizeLogMessage( 'File at C:\\Users\\Admin\\secret.txt' );
			expect( result ).not.toContain( 'Admin' );
			expect( result ).toContain( '[PATH]' );
		} );

		it( 'should replace Unix paths', () => {
			const result = sanitizeLogMessage( 'File at /home/user/secret.txt' );
			expect( result ).not.toContain( 'user' );
			expect( result ).toContain( '[PATH]' );
		} );
	} );

	describe( 'string sanitization — URLs', () => {
		it( 'should sanitize HTTP URLs (path regex fires first)', () => {
			const result = sanitizeLogMessage( 'Fetching http://internal.server.com/api/data' );
			expect( result ).not.toContain( 'internal.server.com' );
			expect( result ).not.toContain( '/api/data' );
		} );

		it( 'should sanitize HTTPS URLs (path regex fires first)', () => {
			const result = sanitizeLogMessage( 'Fetching https://secure.example.com/secret' );
			expect( result ).not.toContain( 'secure.example.com' );
			expect( result ).not.toContain( '/secret' );
		} );

		it( 'should sanitize connection strings', () => {
			const result = sanitizeLogMessage( 'Connect to mysql://user:pass@host:3306/db' );
			expect( result ).not.toContain( 'user:pass' );
			expect( result ).not.toContain( '/db' );
		} );
	} );

	describe( 'string sanitization — IP addresses', () => {
		it( 'should replace IPv4 addresses', () => {
			const result = sanitizeLogMessage( 'Client 192.168.1.100 connected' );
			expect( result ).not.toContain( '192.168.1.100' );
			expect( result ).toContain( '[IP]' );
		} );

		it( 'should replace IPv4 with port', () => {
			const result = sanitizeLogMessage( 'Listening on 10.0.0.1:8080' );
			expect( result ).not.toContain( '10.0.0.1:8080' );
			expect( result ).toContain( '[IP]' );
		} );
	} );

	describe( 'string sanitization — emails', () => {
		it( 'should replace email addresses', () => {
			const result = sanitizeLogMessage( 'Contact admin@example.com for help' );
			expect( result ).not.toContain( 'admin@example.com' );
			expect( result ).toContain( '[EMAIL]' );
		} );
	} );

	describe( 'truncation', () => {
		it( 'should truncate strings over 200 characters', () => {
			// Use spaces to avoid triggering TOKEN regex on long alphanumeric runs
			const longMessage = 'word '.repeat( 60 );
			const result = sanitizeLogMessage( longMessage );
			expect( result.length ).toBeLessThanOrEqual( 200 + '[TRUNCATED]'.length );
			expect( result ).toContain( '[TRUNCATED]' );
		} );

		it( 'should not truncate strings under 200 characters', () => {
			const shortMessage = 'This is a short log message';
			const result = sanitizeLogMessage( shortMessage );
			expect( result ).not.toContain( '[TRUNCATED]' );
		} );

		it( 'should not truncate strings at exactly 200 characters', () => {
			const exactMessage = 'a'.repeat( 200 );
			const result = sanitizeLogMessage( exactMessage );
			expect( result ).not.toContain( '[TRUNCATED]' );
		} );
	} );

	describe( 'safe messages', () => {
		it( 'should preserve simple log messages', () => {
			expect( sanitizeLogMessage( 'Layer created' ) ).toBe( 'Layer created' );
		} );

		it( 'should preserve empty strings', () => {
			expect( sanitizeLogMessage( '' ) ).toBe( '' );
		} );

		it( 'should preserve numeric strings', () => {
			expect( sanitizeLogMessage( '42' ) ).toBe( '42' );
		} );
	} );

	describe( 'window export', () => {
		it( 'should export to window.Layers.Utils namespace', () => {
			expect( global.window.Layers.Utils.sanitizeLogMessage ).toBe( sanitizeLogMessage );
		} );
	} );
} );
