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

	public function testEqualLabelsOnDifferentFilesAndSlidesResolveIndependently(): void {
		$surfaces = [
			[ 'id' => 'photo-a', 'kind' => 'image', 'label' => 'ABC',
				'source' => [ 'fileTitle' => 'File:A.jpg', 'page' => 1 ] ],
			[ 'id' => 'photo-b', 'kind' => 'image', 'label' => 'abc',
				'source' => [ 'fileTitle' => 'File:B.jpg', 'page' => 1 ] ],
			[ 'id' => 'slide', 'kind' => 'slide', 'label' => 'ABC' ]
		];
		$named = [ 'pageId' => 150, 'name' => 'ABC' ];
		foreach ( [ $surfaces, array_reverse( $surfaces ) ] as $ordered ) {
			$this->assertSame( 'photo-a', PageOwnedBinding::resolveNamed( $named, $ordered, 'file', 'File:A.jpg' ) );
			$this->assertSame( 'photo-b', PageOwnedBinding::resolveNamed( $named, $ordered, 'file', 'File:B.jpg' ) );
			$this->assertSame( 'slide', PageOwnedBinding::resolveNamed( $named, $ordered, 'slide', null ) );
			$this->assertNull( PageOwnedBinding::resolveNamed( $named, $ordered, 'file', 'File:Missing.jpg' ) );
			// A caller with no file/kind context must not select the first equal label.
			$this->assertNull( PageOwnedBinding::resolveNamed( $named, $ordered, null, null ) );
		}
	}

	public function testPdfPageSelectsAnInternalRecordOfTheSameLayerSet(): void {
		$surfaces = [
			[ 'id' => 'page-1', 'kind' => 'pdf', 'label' => 'Pump labels',
				'source' => [ 'fileTitle' => 'File:Manual.pdf', 'page' => 1 ] ],
			[ 'id' => 'page-3', 'kind' => 'pdf', 'label' => 'Pump labels',
				'source' => [ 'fileTitle' => 'File:Manual.pdf', 'page' => 3 ] ],
			[ 'id' => 'other-file', 'kind' => 'pdf', 'label' => 'Pump labels',
				'source' => [ 'fileTitle' => 'File:Other.pdf', 'page' => 3 ] ]
		];
		$named = [ 'pageId' => 150, 'name' => 'pump_LABELS' ];
		foreach ( [ $surfaces, array_reverse( $surfaces ) ] as $ordered ) {
			$this->assertSame( 'page-1', PageOwnedBinding::resolveNamed(
				$named, $ordered, 'file', 'File:Manual.pdf', 1 ) );
			$this->assertSame( 'page-3', PageOwnedBinding::resolveNamed(
				$named, $ordered, 'file', 'File:Manual.pdf', 3 ) );
			$this->assertNull( PageOwnedBinding::resolveNamed(
				$named, $ordered, 'file', 'File:Manual.pdf', 2 ) );
			$this->assertNull( PageOwnedBinding::resolveNamed(
				$named, $ordered, 'file', 'File:Manual.pdf' ) );
			$this->assertNull( PageOwnedBinding::resolveNamed( $named, $ordered, 'slide', null, 3 ) );
		}
	}

	public function testDuplicatePdfPageIdentityRemainsAmbiguous(): void {
		$page = [ 'id' => 'page-3', 'kind' => 'pdf', 'label' => 'ABC',
			'source' => [ 'fileTitle' => 'File:Manual.pdf', 'page' => 3 ] ];
		$duplicate = $page;
		$duplicate['id'] = 'duplicate';
		$duplicate['label'] = 'abc';
		$this->assertNull( PageOwnedBinding::resolveNamed(
			[ 'pageId' => 150, 'name' => 'ABC' ], [ $page, $duplicate ], 'file', 'File:Manual.pdf', 3 ) );
	}

	public function testExplicitPdfPageNeverFallsBackToTheOnlyStoredPage(): void {
		$surfaces = [ [ 'id' => 'legacy-page-3', 'kind' => 'pdf', 'label' => 'ABC',
			'source' => [ 'fileTitle' => 'File:Manual.pdf', 'page' => 3 ] ] ];
		$named = [ 'pageId' => 150, 'name' => 'ABC' ];
		// Existing callers retain their one-match lookup until they carry the effective PDF page.
		$this->assertSame( 'legacy-page-3', PageOwnedBinding::resolveNamed(
			$named, $surfaces, 'file', 'File:Manual.pdf' ) );
		$this->assertSame( 'legacy-page-3', PageOwnedBinding::resolveNamed(
			$named, $surfaces, 'file', 'File:Manual.pdf', 3 ) );
		foreach ( [ -1, 0, 1, 2, 4 ] as $page ) {
			$this->assertNull( PageOwnedBinding::resolveNamed(
				$named, $surfaces, 'file', 'File:Manual.pdf', $page ) );
		}
	}

	public function testCanonicalFileIdentityIsNotCaseFoldedWithTheLayerSetName(): void {
		$surfaces = [
			[ 'id' => 'upper', 'kind' => 'image', 'label' => 'ABC',
				'source' => [ 'fileTitle' => 'File:Diagram.jpg', 'page' => 1 ] ],
			[ 'id' => 'lower', 'kind' => 'image', 'label' => 'abc',
				'source' => [ 'fileTitle' => 'File:DIAGRAM.jpg', 'page' => 1 ] ]
		];
		$named = [ 'pageId' => 150, 'name' => 'abc' ];
		$this->assertSame( 'upper', PageOwnedBinding::resolveNamed(
			$named, $surfaces, 'file', 'File:Diagram.jpg', 1 ) );
		$this->assertSame( 'lower', PageOwnedBinding::resolveNamed(
			$named, $surfaces, 'file', 'File:DIAGRAM.jpg', 1 ) );
	}
}
