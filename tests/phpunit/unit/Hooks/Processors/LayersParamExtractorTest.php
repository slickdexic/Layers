<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks\Processors;

use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for LayersParamExtractor.
 *
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor
 * @group Layers
 */
class LayersParamExtractorTest extends TestCase {

	private LayersParamExtractor $extractor;

	protected function setUp(): void {
		parent::setUp();
		$this->extractor = new LayersParamExtractor();
	}

	/**
	 * @covers ::extractFromParams
	 */
	public function testExtractFromParamsPrefersHandlerParams(): void {
		$result = $this->extractor->extractFromParams(
			[ 'layers' => 'On' ],
			[ 'layers' => 'off' ]
		);

		$this->assertSame( 'on', $result );
	}

	/**
	 * @covers ::extractFromParams
	 */
	public function testExtractFromParamsFallsBackToFrameParams(): void {
		$result = $this->extractor->extractFromParams(
			[ 'alt' => 'Test' ],
			[ 'layers' => 'anatomy-labels' ]
		);

		$this->assertSame( 'anatomy-labels', $result );
	}

	/**
	 * @covers ::extractFromParams
	 */
	public function testExtractFromParamsSupportsLayerAlias(): void {
		$result = $this->extractor->extractFromParams(
			[ 'layer' => 'OFF' ],
			[]
		);

		$this->assertSame( 'off', $result );
	}

	/**
	 * @covers ::extractFromParams
	 */
	public function testExtractFromParamsReturnsNullWhenMissing(): void {
		$this->assertNull( $this->extractor->extractFromParams( [], [] ) );
	}

	/**
	 * @covers ::extractFromHref
	 */
	public function testExtractFromHrefWithLayersParam(): void {
		$this->assertSame(
			'on',
			$this->extractor->extractFromHref( '/wiki/File:Example.jpg?layers=on' )
		);
	}

	/**
	 * @covers ::extractFromHref
	 */
	public function testExtractFromHrefWithNamedSet(): void {
		$this->assertSame(
			'my-annotations',
			$this->extractor->extractFromHref( '/wiki/File:Example.jpg?layers=my-annotations&other=param' )
		);
	}

	/**
	 * @covers ::extractFromHref
	 */
	public function testExtractFromHrefReturnsRawValue(): void {
		$this->assertSame(
			'<script>alert(1)</script>',
			$this->extractor->extractFromHref( '/wiki/File:Example.jpg?layers=%3Cscript%3Ealert(1)%3C%2Fscript%3E' )
		);
	}

	/**
	 * @covers ::extractFromHref
	 */
	public function testExtractFromHrefWithoutLayersParam(): void {
		$this->assertNull( $this->extractor->extractFromHref( '/wiki/File:Example.jpg?width=300' ) );
		$this->assertNull( $this->extractor->extractFromHref( '/wiki/File:Example.jpg' ) );
		$this->assertNull( $this->extractor->extractFromHref( '' ) );
	}

	/**
	 * @covers ::extractFromDataMw
	 */
	public function testExtractFromDataMwReadsOriginalArgsArray(): void {
		$dataMw = htmlspecialchars( json_encode( [
			'attrs' => [
				'originalArgs' => [ 'thumb', 'layers=on' ]
			]
		] ), ENT_QUOTES, 'UTF-8' );

		$html = '<img data-mw="' . $dataMw . '">';

		$this->assertSame( 'on', $this->extractor->extractFromDataMw( $html ) );
	}

	/**
	 * @covers ::extractFromDataMw
	 */
	public function testExtractFromDataMwReadsAssociativeOptions(): void {
		$dataMw = htmlspecialchars( json_encode( [
			'attrs' => [
				'options' => [
					'layers' => 'anatomy'
				]
			]
		] ), ENT_QUOTES, 'UTF-8' );

		$html = '<span data-mw="' . $dataMw . '"></span>';

		$this->assertSame( 'anatomy', $this->extractor->extractFromDataMw( $html ) );
	}

	/**
	 * @covers ::extractFromDataMw
	 */
	public function testExtractFromDataMwReturnsNullWhenMissingOrMalformed(): void {
		$this->assertNull( $this->extractor->extractFromDataMw( '<img src="test.jpg">' ) );
		$this->assertNull( $this->extractor->extractFromDataMw( '<img data-mw="not-json">' ) );
	}

	/**
	 * @covers ::extractFromAll
	 */
	public function testExtractFromAllPrioritizesParams(): void {
		$result = $this->extractor->extractFromAll(
			[ 'layers' => 'from-handler' ],
			[],
			[ 'href' => '?layers=from-link' ],
			'<img data-mw="{}">'
		);

		$this->assertSame( 'from-handler', $result );
	}

	/**
	 * @covers ::extractFromAll
	 */
	public function testExtractFromAllFallsBackToLinkAttribs(): void {
		$result = $this->extractor->extractFromAll(
			[],
			[],
			[ 'href' => '?layers=from-link' ]
		);

		$this->assertSame( 'from-link', $result );
	}

	/**
	 * @covers ::extractFromAll
	 */
	public function testExtractFromAllFallsBackToFrameLinkUrl(): void {
		$result = $this->extractor->extractFromAll(
			[],
			[ 'link-url' => '/wiki/File:Test.jpg?layers=from-frame-link' ]
		);

		$this->assertSame( 'from-frame-link', $result );
	}

	/**
	 * @covers ::extractFromAll
	 */
	public function testExtractFromAllFallsBackToDataMwHtml(): void {
		$dataMw = htmlspecialchars( json_encode( [
			'attrs' => [
				'options' => [ 'layers' => 'from-datamw' ]
			]
		] ), ENT_QUOTES, 'UTF-8' );

		$result = $this->extractor->extractFromAll(
			[],
			[],
			[],
			'<span data-mw="' . $dataMw . '"></span>'
		);

		$this->assertSame( 'from-datamw', $result );
	}

	/**
	 * @covers ::extractLayersJson
	 */
	public function testExtractLayersJsonSupportsWrappedAndLegacyFormats(): void {
		$wrapped = $this->extractor->extractLayersJson( [
			'layersjson' => json_encode( [
				'layers' => [ [ 'id' => 'one' ] ],
				'backgroundVisible' => false,
				'backgroundOpacity' => 0.4
			] )
		] );

		$legacy = $this->extractor->extractLayersJson( [
			'layerData' => [ [ 'id' => 'legacy' ] ]
		] );

		$this->assertSame( [ [ 'id' => 'one' ] ], $wrapped['layers'] );
		$this->assertFalse( $wrapped['backgroundVisible'] );
		$this->assertSame( 0.4, $wrapped['backgroundOpacity'] );
		$this->assertSame( [ [ 'id' => 'legacy' ] ], $legacy['layers'] );
		$this->assertTrue( $legacy['backgroundVisible'] );
	}

	/**
	 * @covers ::isDisabled
	 * @covers ::isDefaultEnabled
	 * @covers ::isNamedSet
	 * @covers ::getSetName
	 */
	public function testFlagHelpersReflectCurrentContract(): void {
		$this->assertTrue( $this->extractor->isDisabled( 'off' ) );
		$this->assertTrue( $this->extractor->isDisabled( 'none' ) );
		$this->assertFalse( $this->extractor->isDisabled( 'on' ) );

		$this->assertTrue( $this->extractor->isDefaultEnabled( 'on' ) );
		$this->assertTrue( $this->extractor->isDefaultEnabled( 'all' ) );
		$this->assertFalse( $this->extractor->isDefaultEnabled( 'annotations' ) );

		$this->assertTrue( $this->extractor->isNamedSet( 'annotations' ) );
		$this->assertFalse( $this->extractor->isNamedSet( 'on' ) );
		$this->assertFalse( $this->extractor->isNamedSet( 'off' ) );

		$this->assertSame( 'annotations', $this->extractor->getSetName( 'annotations' ) );
		$this->assertNull( $this->extractor->getSetName( 'on' ) );
		$this->assertNull( $this->extractor->getSetName( null ) );
	}
}
