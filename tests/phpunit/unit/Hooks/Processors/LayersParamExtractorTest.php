<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks\Processors;

use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for LayersParamExtractor
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

	// ==================== extractFromParams tests ====================

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromParams
	 */
	public function testExtractFromParamsWithLayersOn(): void {
		$params = [ 'alt' => 'Test', 'layers' => 'on', 'thumb' => true ];

		$result = $this->extractor->extractFromParams( $params );

		$this->assertEquals( 'on', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromParams
	 */
	public function testExtractFromParamsWithLayersOff(): void {
		$params = [ 'layers' => 'off' ];

		$result = $this->extractor->extractFromParams( $params );

		$this->assertEquals( 'off', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromParams
	 */
	public function testExtractFromParamsWithNamedSet(): void {
		$params = [ 'layers' => 'anatomy-labels' ];

		$result = $this->extractor->extractFromParams( $params );

		$this->assertEquals( 'anatomy-labels', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromParams
	 */
	public function testExtractFromParamsWithoutLayers(): void {
		$params = [ 'alt' => 'Test', 'thumb' => true ];

		$result = $this->extractor->extractFromParams( $params );

		$this->assertNull( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromParams
	 */
	public function testExtractFromEmptyParams(): void {
		$result = $this->extractor->extractFromParams( [] );

		$this->assertNull( $result );
	}

	// ==================== extractFromHref tests ====================

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromHref
	 */
	public function testExtractFromHrefWithLayersParam(): void {
		$href = '/wiki/File:Example.jpg?layers=on';

		$result = $this->extractor->extractFromHref( $href );

		$this->assertEquals( 'on', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromHref
	 */
	public function testExtractFromHrefWithNamedSet(): void {
		$href = '/wiki/File:Example.jpg?layers=my-annotations&other=param';

		$result = $this->extractor->extractFromHref( $href );

		$this->assertEquals( 'my-annotations', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromHref
	 */
	public function testExtractFromHrefWithoutLayersParam(): void {
		$href = '/wiki/File:Example.jpg?width=300';

		$result = $this->extractor->extractFromHref( $href );

		$this->assertNull( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromHref
	 */
	public function testExtractFromHrefWithoutQueryString(): void {
		$href = '/wiki/File:Example.jpg';

		$result = $this->extractor->extractFromHref( $href );

		$this->assertNull( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromHref
	 */
	public function testExtractFromEmptyHref(): void {
		$result = $this->extractor->extractFromHref( '' );

		$this->assertNull( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromHref
	 */
	public function testExtractFromHrefSanitizesInput(): void {
		$href = '/wiki/File:Example.jpg?layers=<script>alert(1)</script>';

		$result = $this->extractor->extractFromHref( $href );

		// Should return null or sanitized value, not the script tag
		$this->assertNotEquals( '<script>alert(1)</script>', $result );
	}

	// ==================== extractFromDataMw tests ====================

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromDataMw
	 */
	public function testExtractFromDataMwWithLayersAttrib(): void {
		$dataMw = [
			'attribs' => [
				[ 'layers', 'on' ]
			]
		];

		$result = $this->extractor->extractFromDataMw( $dataMw );

		$this->assertEquals( 'on', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromDataMw
	 */
	public function testExtractFromDataMwWithNamedSet(): void {
		$dataMw = [
			'attribs' => [
				[ 'alt', 'Test image' ],
				[ 'layers', 'anatomy' ],
				[ 'thumb', '' ]
			]
		];

		$result = $this->extractor->extractFromDataMw( $dataMw );

		$this->assertEquals( 'anatomy', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromDataMw
	 */
	public function testExtractFromDataMwWithoutLayers(): void {
		$dataMw = [
			'attribs' => [
				[ 'alt', 'Test image' ]
			]
		];

		$result = $this->extractor->extractFromDataMw( $dataMw );

		$this->assertNull( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromDataMw
	 */
	public function testExtractFromEmptyDataMw(): void {
		$result = $this->extractor->extractFromDataMw( [] );

		$this->assertNull( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromDataMw
	 */
	public function testExtractFromDataMwWithMalformedAttribs(): void {
		$dataMw = [
			'attribs' => [
				'not-an-array',
				[ 'single-element' ],
			]
		];

		$result = $this->extractor->extractFromDataMw( $dataMw );

		$this->assertNull( $result );
	}

	// ==================== extractFromAll tests ====================

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromAll
	 */
	public function testExtractFromAllPrioritizesParams(): void {
		$params = [ 'layers' => 'from-params' ];
		$href = '?layers=from-href';
		$dataMw = [ 'attribs' => [ [ 'layers', 'from-datamw' ] ] ];

		$result = $this->extractor->extractFromAll( $params, $href, $dataMw );

		$this->assertEquals( 'from-params', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromAll
	 */
	public function testExtractFromAllFallsBackToHref(): void {
		$params = [ 'other' => 'value' ];
		$href = '?layers=from-href';
		$dataMw = [ 'attribs' => [ [ 'layers', 'from-datamw' ] ] ];

		$result = $this->extractor->extractFromAll( $params, $href, $dataMw );

		$this->assertEquals( 'from-href', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromAll
	 */
	public function testExtractFromAllFallsBackToDataMw(): void {
		$params = [];
		$href = '/wiki/File:Test.jpg';
		$dataMw = [ 'attribs' => [ [ 'layers', 'from-datamw' ] ] ];

		$result = $this->extractor->extractFromAll( $params, $href, $dataMw );

		$this->assertEquals( 'from-datamw', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::extractFromAll
	 */
	public function testExtractFromAllWithNullInputs(): void {
		$result = $this->extractor->extractFromAll( null, null, null );

		$this->assertNull( $result );
	}

	// ==================== isLayersEnabled tests ====================

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::isLayersEnabled
	 */
	public function testIsLayersEnabledWithOn(): void {
		$this->assertTrue( $this->extractor->isLayersEnabled( 'on' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::isLayersEnabled
	 */
	public function testIsLayersEnabledWithNamedSet(): void {
		$this->assertTrue( $this->extractor->isLayersEnabled( 'anatomy' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::isLayersEnabled
	 */
	public function testIsLayersEnabledWithOff(): void {
		$this->assertFalse( $this->extractor->isLayersEnabled( 'off' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::isLayersEnabled
	 */
	public function testIsLayersEnabledWithNone(): void {
		$this->assertFalse( $this->extractor->isLayersEnabled( 'none' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::isLayersEnabled
	 */
	public function testIsLayersEnabledWithNull(): void {
		$this->assertFalse( $this->extractor->isLayersEnabled( null ) );
	}

	// ==================== getSetName tests ====================

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::getSetName
	 */
	public function testGetSetNameWithOn(): void {
		$result = $this->extractor->getSetName( 'on' );

		$this->assertEquals( 'default', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::getSetName
	 */
	public function testGetSetNameWithNamedSet(): void {
		$result = $this->extractor->getSetName( 'my-annotations' );

		$this->assertEquals( 'my-annotations', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::getSetName
	 */
	public function testGetSetNameWithOff(): void {
		$result = $this->extractor->getSetName( 'off' );

		$this->assertNull( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::getSetName
	 */
	public function testGetSetNameWithNull(): void {
		$result = $this->extractor->getSetName( null );

		$this->assertNull( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor::getSetName
	 */
	public function testGetSetNameUsesCustomDefault(): void {
		$result = $this->extractor->getSetName( 'on', 'primary' );

		$this->assertEquals( 'primary', $result );
	}
}
