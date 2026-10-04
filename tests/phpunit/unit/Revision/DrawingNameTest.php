<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\DrawingName;
use MediaWiki\Extension\Layers\Revision\PublicationException;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\DrawingName
 * @covers \MediaWiki\Extension\Layers\Revision\PublicationException
 */
class DrawingNameTest extends \MediaWikiUnitTestCase {

	public function testNamesMustBeWritableIntoAnEmbed(): void {
		$this->assertSame( 'Pump labels', DrawingName::normalize( "  Pump \t labels " ) );
		$this->assertSame( 'presentation/Welcome Slide', DrawingName::normalize( 'presentation/Welcome Slide' ) );
		$this->assertSame( 'Überblick 2', DrawingName::normalize( 'Überblick 2' ) );
		foreach ( [ '', '   ', 'a|b', 'a[b', 'a]b', 'a{b', 'a}b', 'a<b', 'a>b', '228:anatomy', "a\x7fb",
			str_repeat( 'x', 256 ) ] as $bad
		) {
			$this->assertNull( DrawingName::normalize( $bad ), $bad );
		}
		$this->assertSame( str_repeat( 'é', 255 ), DrawingName::normalize( str_repeat( 'é', 255 ) ) );
	}

	public function testCaseSpacingAndUnderscoresDoNotMakeANewName(): void {
		$this->assertSame( DrawingName::key( 'Pump labels' ), DrawingName::key( 'pump_LABELS' ) );
		$this->assertSame( DrawingName::key( 'Pump labels' ), DrawingName::key( ' Pump   labels' ) );
		$this->assertNotSame( DrawingName::key( 'Pump labels' ), DrawingName::key( 'Pump-labels' ) );
	}

	public function testUnusedAppendsTheFirstFreeNumber(): void {
		$this->assertSame( 'default', DrawingName::unused( 'default', [ 'other' ] ) );
		$this->assertSame( 'default 2', DrawingName::unused( 'default', [ 'Default' ] ) );
		$this->assertSame( 'default 4', DrawingName::unused( 'default', [ 'default', 'default 2', 'DEFAULT_3' ] ) );
		$long = str_repeat( 'a', 255 );
		$this->assertSame( str_repeat( 'a', 253 ) . ' 2', DrawingName::unused( $long, [ $long ] ) );
	}

	public function testOnlyNewOrChangedDrawingsAreChecked(): void {
		$surfaces = [
			(object)[ 'id' => 'a', 'kind' => 'slide', 'label' => 'Legacy|name' ],
			(object)[ 'id' => 'b', 'kind' => 'slide', 'label' => 'Twin' ],
			(object)[ 'id' => 'c', 'kind' => 'slide', 'label' => 'twin' ],
			(object)[ 'id' => 'd', 'kind' => 'slide', 'label' => 'Fresh' ]
		];
		DrawingName::assertPublishable( $surfaces, [ 'd' ] );
		foreach ( [
			[ 'a', 'layers-invalid-snapshot-name', 'Legacy|name' ],
			[ 'c', 'layers-invalid-snapshot-name-taken', 'twin' ]
		] as [ $changed, $message, $name ] ) {
			try {
				DrawingName::assertPublishable( $surfaces, [ $changed ] );
				$this->fail( "Drawing $changed must be refused" );
			} catch ( PublicationException $e ) {
				$this->assertSame( 'layers-invalid-snapshot', $e->getMessage() );
				$this->assertSame( [ $message, $name ], $e->getUserMessage() );
			}
		}
	}
}
