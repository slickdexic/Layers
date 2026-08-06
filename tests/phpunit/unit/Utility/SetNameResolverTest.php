<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Utility;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Utility\SetNameResolver;

/**
 * @covers \MediaWiki\Extension\Layers\Utility\SetNameResolver
 */
class SetNameResolverTest extends \MediaWikiUnitTestCase {

	/**
	 * Build a LayersDatabase stub whose getLatestLayerSet() returns $latest.
	 *
	 * @param array|null $latest Row the stub should return
	 * @return LayersDatabase
	 */
	private function makeDb( ?array $latest ) {
		$db = $this->getMockBuilder( LayersDatabase::class )
			->disableOriginalConstructor()
			->onlyMethods( [ 'getLatestLayerSet' ] )
			->getMock();
		$db->method( 'getLatestLayerSet' )->willReturn( $latest );
		return $db;
	}

	/**
	 * @covers ::isShowIntent
	 */
	public function testIsShowIntent() {
		foreach ( [ 'on', 'true', 'all', '1', ' ON ', 'True' ] as $value ) {
			$this->assertTrue( SetNameResolver::isShowIntent( $value ), $value );
		}
		foreach ( [ 'off', 'default', '001', '', null ] as $value ) {
			$this->assertFalse( SetNameResolver::isShowIntent( $value ), (string)$value );
		}
	}

	/**
	 * @covers ::isHideIntent
	 */
	public function testIsHideIntent() {
		foreach ( [ 'off', 'none', 'false', '0', ' OFF ' ] as $value ) {
			$this->assertTrue( SetNameResolver::isHideIntent( $value ), $value );
		}
		foreach ( [ 'on', 'default', '001', '', null ] as $value ) {
			$this->assertFalse( SetNameResolver::isHideIntent( $value ), (string)$value );
		}
	}

	/**
	 * @covers ::isGenericIntent
	 */
	public function testIsGenericIntent() {
		$this->assertTrue( SetNameResolver::isGenericIntent( 'on' ) );
		$this->assertTrue( SetNameResolver::isGenericIntent( 'none' ) );
		$this->assertFalse( SetNameResolver::isGenericIntent( 'anatomy' ) );
	}

	/**
	 * No name is reserved, so ordinary-looking names are all specific.
	 *
	 * @covers ::isSpecificName
	 */
	public function testIsSpecificName() {
		foreach ( [ '001', 'default', 'Whatever-I-Want', 'true story' ] as $value ) {
			$this->assertTrue( SetNameResolver::isSpecificName( $value ), $value );
		}
		foreach ( [ '', '   ', 'on', 'off', null ] as $value ) {
			$this->assertFalse( SetNameResolver::isSpecificName( $value ), (string)$value );
		}
	}

	/**
	 * @covers ::resolve
	 */
	public function testResolveReturnsNullForHideIntent() {
		$db = $this->makeDb( [ 'name' => '001' ] );
		$this->assertNull( SetNameResolver::resolve( $db, 'Foo.jpg', 'sha1', 'off' ) );
		$this->assertNull( SetNameResolver::resolve( $db, 'Foo.jpg', 'sha1', 'none' ) );
	}

	/**
	 * @covers ::resolve
	 */
	public function testResolveUsesSpecificNameVerbatim() {
		$db = $this->makeDb( [ 'name' => '001' ] );
		$this->assertSame(
			'Whatever-I-Want',
			SetNameResolver::resolve( $db, 'Foo.jpg', 'sha1', '  Whatever-I-Want  ' )
		);
	}

	/**
	 * An image whose only set is called "001" must resolve to "001".
	 *
	 * @covers ::resolve
	 */
	public function testResolveFallsBackToNewestSet() {
		$db = $this->makeDb( [ 'name' => '001' ] );
		$this->assertSame( '001', SetNameResolver::resolve( $db, 'Foo.jpg', 'sha1', null ) );
		$this->assertSame( '001', SetNameResolver::resolve( $db, 'Foo.jpg', 'sha1', 'on' ) );
		$this->assertSame( '001', SetNameResolver::resolve( $db, 'Foo.jpg', 'sha1', '' ) );
	}

	/**
	 * @covers ::latestName
	 */
	public function testLatestNamePrefersSetNameKey() {
		$db = $this->makeDb( [ 'setName' => 'from-setName', 'name' => 'from-name' ] );
		$this->assertSame( 'from-setName', SetNameResolver::latestName( $db, 'Foo.jpg', 'sha1' ) );
	}

	/**
	 * @covers ::latestName
	 */
	public function testLatestNameReturnsNullWhenNoSetExists() {
		$this->assertNull( SetNameResolver::latestName( $this->makeDb( null ), 'Foo.jpg', 'sha1' ) );
		$this->assertNull(
			SetNameResolver::latestName( $this->makeDb( [] ), 'Foo.jpg', 'sha1' )
		);
		$this->assertNull(
			SetNameResolver::latestName( $this->makeDb( [ 'name' => '' ] ), 'Foo.jpg', 'sha1' )
		);
	}

	/**
	 * @covers ::resolve
	 */
	public function testResolveReturnsNullWhenImageHasNoSets() {
		$this->assertNull( SetNameResolver::resolve( $this->makeDb( null ), 'Foo.jpg', 'sha1', null ) );
	}
}
