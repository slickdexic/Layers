const { deepClone } = require( '../../resources/ext.layers.shared/DeepClone.js' );

describe( 'DeepClone circular fallback', () => {
	const nativeClone = global.structuredClone;

	afterEach( () => {
		global.structuredClone = nativeClone;
	} );

	it( 'clones a self-reference when structuredClone is unavailable', () => {
		global.structuredClone = undefined;
		const source = { value: 1 };
		source.self = source;
		const copy = deepClone( source );
		expect( copy ).not.toBe( source );
		expect( copy.self ).toBe( copy );
		copy.value = 2;
		expect( source.value ).toBe( 1 );
	} );

	it( 'clones cyclic arrays after an unsupported native clone', () => {
		global.structuredClone = () => {
			throw new Error( 'DataCloneError' );
		};
		const source = [];
		source.push( source );
		const copy = deepClone( source );
		expect( Array.isArray( copy ) ).toBe( true );
		expect( copy ).not.toBe( source );
		expect( copy[ 0 ] ).toBe( copy );
	} );

	it( 'preserves shared references within a mutually cyclic graph', () => {
		global.structuredClone = undefined;
		const child = { value: 1 };
		const source = { first: child, second: child };
		child.parent = source;
		const copy = deepClone( source );
		expect( copy.first ).toBe( copy.second );
		expect( copy.first ).not.toBe( child );
		expect( copy.first.parent ).toBe( copy );
	} );

	it( 'keeps sparse array length and holes in the fallback', () => {
		global.structuredClone = undefined;
		const source = new Array( 4 );
		source[ 1 ] = source;
		const copy = deepClone( source );
		expect( copy.length ).toBe( 4 );
		expect( 0 in copy ).toBe( false );
		expect( copy[ 1 ] ).toBe( copy );
	} );

	it( 'preserves a prototype-named own property as data', () => {
		global.structuredClone = undefined;
		const source = JSON.parse( '{"__proto__":{"value":1}}' );
		source.self = source;
		const copy = deepClone( source );
		const ownValue = Object.getOwnPropertyDescriptor( copy, '__proto__' ).value;
		expect( Object.getPrototypeOf( copy ) ).toBe( Object.prototype );
		expect( Object.prototype.hasOwnProperty.call( copy, '__proto__' ) ).toBe( true );
		expect( ownValue ).toEqual( { value: 1 } );
		expect( ownValue ).not.toBe( Object.getOwnPropertyDescriptor( source, '__proto__' ).value );
	} );
} );
