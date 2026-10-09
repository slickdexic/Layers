<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Revision;

use MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter;
use MediaWiki\Extension\Layers\Revision\PageOwnedBinding;
use MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions;

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBindingOptions
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedBinding
 * @covers \MediaWiki\Extension\Layers\Revision\DirectEmbeddingRewriter
 */
class DefaultShortcutOptionsTest extends \MediaWikiUnitTestCase {
	/**
	 * @dataProvider provideShortcuts
	 * @param array $options
	 */
	public function testOnlyAnUnambiguousOnWithAValidFileOwnerNamesDefault( array $options ): void {
		$this->assertSame( [ 'pageId' => 7, 'name' => 'Default' ],
			PageOwnedBindingOptions::named( $options, 'file', 'File:Photo.png', 7 ) );
	}

	/** @return array */
	public static function provideShortcuts(): array {
		return [ [ [ 'layerset=on' ] ], [ [ 'layers=on' ] ],
			[ [ " thumb ", " LayerSet \t=\t ON \f", 'alt=on' ] ],
			[ [ 'layers = On', 'caption', 'noedit', 'page=2' ] ] ];
	}

	/**
	 * @dataProvider provideInvalidOwners
	 * @param int|null $owner
	 */
	public function testLegacyAndInvalidOwnersDoNotAcquireDefault( ?int $owner ): void {
		$this->assertNull( PageOwnedBindingOptions::named( [ 'layerset=on' ], 'file', 'File:A.png', $owner ) );
	}

	/** @return array */
	public static function provideInvalidOwners(): array {
		return [ [ null ], [ 0 ], [ -1 ], [ 2147483648 ], [ PHP_INT_MAX ] ];
	}

	/**
	 * @dataProvider provideOtherIntents
	 * @param string $intent
	 */
	public function testOtherGenericAndHideIntentsRemainUnchanged( string $intent ): void {
		$this->assertNull( PageOwnedBindingOptions::named( [ 'layerset=' . $intent ], 'file', 'File:A.png', 7 ) );
	}

	/** @return array */
	public static function provideOtherIntents(): array {
		return array_map( static fn ( string $intent ): array => [ $intent ],
			[ 'true', 'all', '1', 'off', 'none', 'false', '0' ] );
	}

	public function testLiteralExplicitForeignAndSlideNamesAreNotReinterpreted(): void {
		$this->assertSame( [ 'pageId' => 7, 'name' => 'on' ],
			PageOwnedBindingOptions::named( [ 'layerset=name:on' ], 'file', 'File:A.png', 7 ) );
		$this->assertSame( [ 'pageId' => 8, 'name' => 'on' ],
			PageOwnedBindingOptions::named( [ 'layerset=8:on' ], 'file', 'File:A.png', 7 ) );
		$this->assertSame( [ 'pageId' => 7, 'name' => 'on' ],
			PageOwnedBindingOptions::named( [], 'slide', 'on', 7 ) );
		$this->assertSame( [ 'pageId' => 8, 'name' => 'Default' ],
			PageOwnedBindingOptions::named( [], 'slide', '8:Default', 7 ) );
		$this->assertSame( [ 'pageId' => 7, 'name' => 'Other' ],
			PageOwnedBindingOptions::named( [ 'layerset=Other' ], 'file', 'File:A.png', 7 ) );
	}

	/**
	 * @dataProvider provideConflicts
	 * @param array $options
	 */
	public function testDefaultCannotAcquireAnAmbiguousOrBoundSelector( array $options ): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->expectExceptionMessage( 'layers-invalid-page-binding' );
		PageOwnedBindingOptions::named( $options, 'file', 'File:A.png', 7 );
	}

	/** @return array */
	public static function provideConflicts(): array {
		return [ [ [ 'layerset=on', 'layerset=on' ] ], [ [ 'layerset=on', 'layers=on' ] ],
			[ [ 'layerset=on', 'layerset=Default' ] ], [ [ 'layerset=7:Default', 'layers=on' ] ],
			[ [ 'layerset=on', 'layer=1' ] ], [ [ 'layerset=on', 'layersetid=2' ] ],
			[ [ 'layerset=on', 'layers' ] ], [ [ 'layerset=on', 'layersbinding=v1:7:saved' ] ] ];
	}

	public function testNamedReferenceKeepsExactFileIdentityAndStoredSpelling(): void {
		$surfaces = [ [ 'id' => 'first', 'kind' => 'image', 'label' => 'dEfAuLt',
			'source' => [ 'fileTitle' => 'File:A.png' ] ],
			[ 'id' => 'second', 'kind' => 'image', 'label' => 'Default',
				'source' => [ 'fileTitle' => 'File:B.png' ] ],
			[ 'id' => 'slide', 'kind' => 'slide', 'label' => 'Default' ] ];
		$before = serialize( $surfaces );
		$named = PageOwnedBindingOptions::named( [ 'layerset=on' ], 'file', 'File:A.png', 7 );
		$this->assertSame( 'first',
			PageOwnedBinding::resolveNamed( $named, $surfaces, 'file', 'File:A.png' ) );
		$this->assertSame( 'second',
			PageOwnedBinding::resolveNamed( $named, $surfaces, 'file', 'File:B.png' ) );
		$this->assertNull( PageOwnedBinding::resolveNamed( $named, $surfaces, 'file', 'File:C.png' ) );
		$this->assertSame( $before, serialize( $surfaces ) );
	}

	public function testScannerKeepsOriginalOnBytesOffsetsAndLiteralNames(): void {
		$embed = '[[File:A.png| LayerSet = ON |caption]]';
		$text = $embed . "\n" . $embed . "\n[[File:B.png|layerset=name:on]]\n{{#Slide:on}}";
		$before = $text;
		$candidates = ( new DirectEmbeddingRewriter() )->scan( $text,
			static fn ( string $target ): ?string => str_starts_with( $target, 'File:' ) ? $target : null );
		$this->assertCount( 4, $candidates );
		$this->assertSame( $embed, $candidates[0]['raw'] );
		$this->assertSame( strlen( $embed ) + 1, $candidates[1]['start'] );
		$this->assertSame( [ 'pageId' => 7, 'name' => 'Default' ], PageOwnedBindingOptions::named(
			$candidates[0]['options'], $candidates[0]['kind'], $candidates[0]['target'], 7 ) );
		$this->assertSame( [ 'pageId' => 7, 'name' => 'on' ], PageOwnedBindingOptions::named(
			$candidates[2]['options'], $candidates[2]['kind'], $candidates[2]['target'], 7 ) );
		$this->assertSame( [ 'pageId' => 7, 'name' => 'on' ], PageOwnedBindingOptions::named(
			$candidates[3]['options'], $candidates[3]['kind'], $candidates[3]['target'], 7 ) );
		$this->assertSame( $before, $text );
	}
}
