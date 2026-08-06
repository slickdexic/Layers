/**
 * Tests for SetNameUtil - shared layer set reference rules.
 *
 * Mirrors tests/phpunit/unit/Utility/SetNameResolverTest.php so the client and
 * server agree on what counts as a set name.
 */
'use strict';

const SetNameUtil = require( '../../../resources/ext.layers.shared/SetNameUtil.js' );

describe( 'SetNameUtil', () => {

	describe( 'isShowIntent', () => {
		it( 'recognises generic show values regardless of case or padding', () => {
			[ 'on', 'true', 'all', '1', ' ON ', 'True' ].forEach( ( value ) => {
				expect( SetNameUtil.isShowIntent( value ) ).toBe( true );
			} );
		} );

		it( 'does not treat set names or hide values as a show intent', () => {
			[ 'off', 'default', '001', '', null, undefined, 1, {} ].forEach( ( value ) => {
				expect( SetNameUtil.isShowIntent( value ) ).toBe( false );
			} );
		} );
	} );

	describe( 'isHideIntent', () => {
		it( 'recognises generic hide values', () => {
			[ 'off', 'none', 'false', '0', ' OFF ' ].forEach( ( value ) => {
				expect( SetNameUtil.isHideIntent( value ) ).toBe( true );
			} );
		} );

		it( 'does not treat set names or show values as a hide intent', () => {
			[ 'on', 'default', '001', '', null, undefined ].forEach( ( value ) => {
				expect( SetNameUtil.isHideIntent( value ) ).toBe( false );
			} );
		} );
	} );

	describe( 'isGenericIntent', () => {
		it( 'covers both show and hide intents', () => {
			expect( SetNameUtil.isGenericIntent( 'on' ) ).toBe( true );
			expect( SetNameUtil.isGenericIntent( 'none' ) ).toBe( true );
			expect( SetNameUtil.isGenericIntent( 'anatomy' ) ).toBe( false );
		} );
	} );

	describe( 'isSpecificName', () => {
		it( 'accepts any user-defined name, including "default"', () => {
			[ '001', 'default', 'Whatever-I-Want', 'true story', '日本語' ].forEach( ( value ) => {
				expect( SetNameUtil.isSpecificName( value ) ).toBe( true );
			} );
		} );

		it( 'rejects empty values and generic intents', () => {
			[ '', '   ', 'on', 'off', null, undefined, 5 ].forEach( ( value ) => {
				expect( SetNameUtil.isSpecificName( value ) ).toBe( false );
			} );
		} );
	} );

	describe( 'applyToParams', () => {
		it( 'adds a trimmed setname for a specific name', () => {
			const params = { action: 'layersinfo' };
			SetNameUtil.applyToParams( params, '  anatomy  ' );
			expect( params.setname ).toBe( 'anatomy' );
		} );

		it( 'adds setname for a set literally named "default"', () => {
			const params = {};
			SetNameUtil.applyToParams( params, 'default' );
			expect( params.setname ).toBe( 'default' );
		} );

		it( 'omits setname for generic intents so the server resolves the set', () => {
			[ 'on', 'off', 'all', 'none' ].forEach( ( value ) => {
				const params = {};
				SetNameUtil.applyToParams( params, value );
				expect( params.setname ).toBeUndefined();
			} );
		} );

		it( 'omits setname for empty or non-string values', () => {
			[ '', '   ', null, undefined, 0 ].forEach( ( value ) => {
				const params = {};
				SetNameUtil.applyToParams( params, value );
				expect( params.setname ).toBeUndefined();
			} );
		} );

		it( 'returns the same params object for chaining', () => {
			const params = {};
			expect( SetNameUtil.applyToParams( params, 'set' ) ).toBe( params );
		} );
	} );

	describe( 'exports', () => {
		it( 'is frozen so call sites cannot alter the shared rules', () => {
			expect( Object.isFrozen( SetNameUtil ) ).toBe( true );
		} );

		it( 'is published on the window.Layers namespace', () => {
			expect( window.Layers.SetNameUtil ).toBe( SetNameUtil );
		} );
	} );
} );
