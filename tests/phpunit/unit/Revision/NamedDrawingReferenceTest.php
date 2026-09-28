<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\PageOwnedBinding;
use MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions;

/**
 * `<pageId>:<name>` embeds name one of the page's drawings.
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBinding
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions
 */
class NamedDrawingReferenceTest extends \MediaWikiUnitTestCase {

	private const SURFACES = [
		[ 'id' => 'photo', 'kind' => 'image', 'label' => 'Pump labels',
			'source' => [ 'fileTitle' => 'File:Pump.png' ] ],
		[ 'id' => 'deck', 'kind' => 'slide', 'label' => 'Overview' ],
		[ 'id' => 'twin-a', 'kind' => 'slide', 'label' => 'Twin' ],
		[ 'id' => 'twin-b', 'kind' => 'slide', 'label' => 'twin' ]
	];

	public function testParsesThePageIdAndName(): void {
		$this->assertSame( [ 'pageId' => 228, 'name' => 'Pump labels' ],
			PageOwnedBinding::parseNamed( ' 228: Pump  labels ' ) );
		$this->assertSame( [ 'pageId' => 2147483647, 'name' => 'x' ], PageOwnedBinding::parseNamed( '2147483647:x' ) );
		foreach ( [ 'default', 'id:5', 'name:Pump', 'on', '', 'Pump:labels' ] as $legacy ) {
			$this->assertNull( PageOwnedBinding::parseNamed( $legacy ), $legacy );
		}
		foreach ( [ '0:x', '01:x', '2147483648:x', '228:', '228: ', '228:a|b', '228:a:b' ] as $bad ) {
			try {
				PageOwnedBinding::parseNamed( $bad );
				$this->fail( "\"$bad\" must be refused" );
			} catch ( \InvalidArgumentException $e ) {
				$this->assertSame( 'layers-invalid-page-binding', $e->getMessage() );
			}
		}
	}

	public function testResolvesOnlyTheOneDrawingThatFitsTheEmbed(): void {
		$resolve = static function ( string $name, string $kind, ?string $file = null ) {
			return PageOwnedBinding::resolveNamed( [ 'pageId' => 1, 'name' => $name ], self::SURFACES, $kind, $file );
		};
		$this->assertSame( 'photo', $resolve( 'pump_LABELS', 'file', 'File:Pump.png' ) );
		$this->assertNull( $resolve( 'Pump labels', 'file', 'File:Other.png' ) );
		$this->assertNull( $resolve( 'Pump labels', 'slide' ) );
		$this->assertSame( 'deck', $resolve( 'overview', 'slide' ) );
		$this->assertNull( $resolve( 'Overview', 'file', 'File:Pump.png' ) );
		$this->assertNull( $resolve( 'Missing', 'slide' ) );
		// Drawings saved before names were unique are never guessed between.
		$this->assertNull( $resolve( 'Twin', 'slide' ) );
	}

	public function testEmbedOptionsCarryTheName(): void {
		$this->assertSame( [ 'pageId' => 7, 'name' => 'Pump labels' ], PageOwnedBindingOptions::named(
			[ '120px', 'layerset=7:Pump labels', 'A caption' ], 'file', 'File:Pump.png' ) );
		$this->assertSame( [ 'pageId' => 7, 'name' => 'Pump labels' ],
			PageOwnedBindingOptions::named( [ 'layers = 7:Pump labels' ], 'file', 'File:Pump.png' ) );
		$this->assertNull( PageOwnedBindingOptions::named( [ 'layerset=anatomy' ], 'file', 'File:Pump.png' ) );
		$this->assertSame( [ 'pageId' => 7, 'name' => 'Overview' ],
			PageOwnedBindingOptions::named( [ 'width=800' ], 'slide', '7:Overview' ) );
		$this->assertNull( PageOwnedBindingOptions::named( [], 'slide', 'LegacySlide' ) );
		$this->expectException( \InvalidArgumentException::class );
		PageOwnedBindingOptions::named( [ 'layerset=7:a', 'layers=7:b' ], 'file', 'File:Pump.png' );
	}
}
