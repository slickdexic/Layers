<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\PageOwnedBinding;

/** @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBinding */
class PageOwnedBindingTest extends \MediaWikiUnitTestCase {

	public function testPreservesDrawingIdentityAndReturnsIndependentValues(): void {
		$first = PageOwnedBinding::parse( 'v1:123:Drawing_A-2' );
		$this->assertSame( [ 'pageId' => 123, 'surfaceId' => 'Drawing_A-2' ], $first );
		$first['surfaceId'] = 'changed';
		$this->assertSame( 'Drawing_A-2', PageOwnedBinding::parse( 'v1:123:Drawing_A-2' )['surfaceId'] );
		$this->assertNotSame( PageOwnedBinding::parse( 'v1:123:Drawing_A-2' ),
			PageOwnedBinding::parse( 'v1:123:drawing_a-2' ) );
	}

	public function testAcceptsSupportedIdentityBounds(): void {
		$this->assertSame( 1, PageOwnedBinding::parse( 'v1:1:a' )['pageId'] );
		$this->assertSame( 2147483647,
			PageOwnedBinding::parse( 'v1:2147483647:' . str_repeat( 'a', 64 ) )['pageId'] );
	}

	/**
	 * @dataProvider provideInvalidBindings
	 * @param mixed $value
	 */
	public function testRejectsAmbiguousBindingsWithoutExposingInput( $value ): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-invalid-page-binding' );
		PageOwnedBinding::parse( $value );
	}

	/** @return array */
	public static function provideInvalidBindings(): array {
		return array_map( static function ( $value ) {
			return [ $value ];
		}, [
			null, false, 123, [], new \stdClass(), '', 'default', 'v2:1:a', 'V1:1:a',
			'v1:0:a', 'v1:01:a', 'v1:-1:a', 'v1:+1:a', 'v1:1.0:a', 'v1:1e2:a',
			'v1:2147483648:a', 'v1:999999999999999999999:a', 'v1:1:',
			'v1:1:' . str_repeat( 'a', 65 ), ' v1:1:a', 'v1:1:a ', "v1:1:a\n",
			"v1:1:a\0", 'v1:1:../../secret', 'v1:1:a:b', 'v1:1:%61',
			'v1:1:概要', 'v1:1:<script>', 'v1:1:a|layerset=default'
		] );
	}
}
