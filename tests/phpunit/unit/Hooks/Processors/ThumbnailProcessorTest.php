<?php
/**
 * Unit tests for ThumbnailProcessor
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks\Processors;

use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use MediaWiki\Extension\Layers\Hooks\Processors\ThumbnailProcessor;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\ThumbnailProcessor
 * @group Layers
 */
class ThumbnailProcessorTest extends TestCase {

	/** @var LayersParamExtractor|\PHPUnit\Framework\MockObject\MockObject */
	private $mockExtractor;

	/** @var ThumbnailProcessor */
	private ThumbnailProcessor $processor;

	protected function setUp(): void {
		parent::setUp();
		$this->mockExtractor = $this->createMock( LayersParamExtractor::class );
		$this->processor = new ThumbnailProcessor( $this->mockExtractor );
	}

	/**
	 * @covers ::__construct
	 */
	public function testConstructor(): void {
		$processor = new ThumbnailProcessor( $this->mockExtractor );
		$this->assertInstanceOf( ThumbnailProcessor::class, $processor );
	}

	/**
	 * @covers ::pageHasLayers
	 */
	public function testPageHasLayersInitiallyFalse(): void {
		$this->assertFalse( $this->processor->pageHasLayers() );
	}

	/**
	 * @covers ::resetPageHasLayers
	 */
	public function testResetPageHasLayers(): void {
		// Use reflection to set the internal flag
		$reflection = new \ReflectionClass( $this->processor );
		$property = $reflection->getProperty( 'pageHasLayers' );
		$property->setAccessible( true );
		$property->setValue( $this->processor, true );

		$this->assertTrue( $this->processor->pageHasLayers() );
		$this->processor->resetPageHasLayers();
		$this->assertFalse( $this->processor->pageHasLayers() );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithNullThumbnail(): void {
		$attribs = [];
		$linkAttribs = [];

		// Should handle null gracefully
		$result = $this->processor->processThumbnail( null, $attribs, $linkAttribs );

		$this->assertTrue( $result );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailAddsInstanceMarker(): void {
		$thumbnail = $this->createMockThumbnail();
		$attribs = [];
		$linkAttribs = [];

		$this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertArrayHasKey( 'data-layers-instance', $attribs );
		$this->assertMatchesRegularExpression( '/^layers-[a-f0-9]{8}$/', $attribs['data-layers-instance'] );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithExplicitOff(): void {
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [ 'layers' => 'off' ] );
		$attribs = [];
		$linkAttribs = [];

		$result = $this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertTrue( $result );
		$this->assertFalse( $this->processor->pageHasLayers() );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithExplicitNone(): void {
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [ 'layers' => 'none' ] );
		$attribs = [];
		$linkAttribs = [];

		$result = $this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertTrue( $result );
		$this->assertFalse( $this->processor->pageHasLayers() );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithLayerDataInParams(): void {
		$layerData = [
			[ 'id' => 'layer1', 'type' => 'rectangle', 'x' => 10, 'y' => 20 ]
		];
		$mockFile = $this->createMockFile( 'Test.jpg', 800, 600 );
		$thumbnail = $this->createMockThumbnail( $mockFile, [
			'layerData' => $layerData
		] );
		$attribs = [];
		$linkAttribs = [];

		$this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertTrue( $this->processor->pageHasLayers() );
		$this->assertArrayHasKey( 'data-layer-data', $attribs );
		$this->assertStringContainsString( 'layers-thumbnail', $attribs['class'] ?? '' );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithLayersJsonParam(): void {
		$layers = [ [ 'id' => 'layer1', 'type' => 'text' ] ];
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [
			'layersjson' => json_encode( [ 'layers' => $layers ] )
		] );
		$attribs = [];
		$linkAttribs = [];

		$this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertTrue( $this->processor->pageHasLayers() );
		$this->assertArrayHasKey( 'data-layer-data', $attribs );

		$decoded = json_decode( $attribs['data-layer-data'], true );
		$this->assertIsArray( $decoded );
		$this->assertArrayHasKey( 'layers', $decoded );
		$this->assertCount( 1, $decoded['layers'] );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithInvalidLayersJson(): void {
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [
			'layersjson' => 'not-valid-json'
		] );
		$attribs = [];
		$linkAttribs = [];

		// Should not throw, should handle gracefully
		$result = $this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertTrue( $result );
		$this->assertFalse( $this->processor->pageHasLayers() );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithHrefLayersParam(): void {
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [] );
		$attribs = [];
		$linkAttribs = [ 'href' => '/wiki/File:Test.jpg?layers=on' ];

		$this->mockExtractor->method( 'extractFromHref' )
			->willReturn( 'on' );

		$this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		// Should add layers-intent since no data but intent is on
		$this->assertArrayHasKey( 'data-layers-instance', $attribs );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithHrefLayersOff(): void {
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [] );
		$attribs = [];
		$linkAttribs = [ 'href' => '/wiki/File:Test.jpg?layers=off' ];

		$this->mockExtractor->method( 'extractFromHref' )
			->willReturn( 'off' );

		$result = $this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertTrue( $result );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithCallbackSetName(): void {
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [] );
		$attribs = [];
		$linkAttribs = [];

		// Callback returns a set name
		$callback = static function ( $filename ) {
			return 'anatomy-labels';
		};

		$this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs, $callback );

		// Should have processed (instance marker added)
		$this->assertArrayHasKey( 'data-layers-instance', $attribs );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithCallbackReturnsOff(): void {
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [] );
		$attribs = [];
		$linkAttribs = [];

		// Callback returns 'off'
		$callback = static function ( $filename ) {
			return 'off';
		};

		$result = $this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs, $callback );

		$this->assertTrue( $result );
		$this->assertFalse( $this->processor->pageHasLayers() );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailAddsBaseDimensions(): void {
		$layers = [ [ 'id' => 'layer1', 'type' => 'arrow' ] ];
		$mockFile = $this->createMockFile( 'Test.jpg', 1920, 1080 );
		$thumbnail = $this->createMockThumbnail( $mockFile, [
			'layerData' => $layers
		] );
		$attribs = [];
		$linkAttribs = [];

		$this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertArrayHasKey( 'data-layer-data', $attribs );
		$decoded = json_decode( $attribs['data-layer-data'], true );
		$this->assertSame( 1920, $decoded['baseWidth'] );
		$this->assertSame( 1080, $decoded['baseHeight'] );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailPreservesExistingClass(): void {
		$layers = [ [ 'id' => 'layer1', 'type' => 'circle' ] ];
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [
			'layerData' => $layers
		] );
		$attribs = [ 'class' => 'existing-class another-class' ];
		$linkAttribs = [];

		$this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertStringContainsString( 'existing-class', $attribs['class'] );
		$this->assertStringContainsString( 'another-class', $attribs['class'] );
		$this->assertStringContainsString( 'layers-thumbnail', $attribs['class'] );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithLayerFlagVariant(): void {
		// Test 'layer' param (singular) vs 'layers' (plural)
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [ 'layer' => 'off' ] );
		$attribs = [];
		$linkAttribs = [];

		$result = $this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		$this->assertTrue( $result );
	}

	/**
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailWithLayersIntent(): void {
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [ 'layers' => 'on' ] );
		$attribs = [];
		$linkAttribs = [];

		$this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		// No layer data, but intent is on - should add intent marker
		$this->assertArrayHasKey( 'data-layers-intent', $attribs );
		$this->assertSame( 'on', $attribs['data-layers-intent'] );
	}

	/**
	 * Test extractLayerDataFromThumbnail via reflection
	 *
	 * @covers ::extractLayerDataFromThumbnail
	 */
	public function testExtractLayerDataFromThumbnailWithoutGetParams(): void {
		// Thumbnail without getParams method
		$thumbnail = new \stdClass();

		$reflection = new \ReflectionClass( $this->processor );
		$method = $reflection->getMethod( 'extractLayerDataFromThumbnail' );
		$method->setAccessible( true );

		$result = $method->invoke( $this->processor, $thumbnail );

		$this->assertSame( [ null, null ], $result );
	}

	/**
	 * Test flag normalization
	 *
	 * @dataProvider provideLayerFlags
	 * @covers ::processThumbnail
	 */
	public function testProcessThumbnailFlagNormalization( string $flag, bool $shouldDisable ): void {
		$mockFile = $this->createMockFile( 'Test.jpg' );
		$thumbnail = $this->createMockThumbnail( $mockFile, [ 'layers' => $flag ] );
		$attribs = [];
		$linkAttribs = [];

		$this->processor->processThumbnail( $thumbnail, $attribs, $linkAttribs );

		// Instance marker should always be added
		$this->assertArrayHasKey( 'data-layers-instance', $attribs );
	}

	/**
	 * Data provider for flag normalization tests
	 */
	public static function provideLayerFlags(): array {
		return [
			'lowercase off' => [ 'off', true ],
			'uppercase OFF' => [ 'OFF', true ],
			'mixed case Off' => [ 'Off', true ],
			'none' => [ 'none', true ],
			'NONE uppercase' => [ 'NONE', true ],
			'on' => [ 'on', false ],
			'ON uppercase' => [ 'ON', false ],
			'all' => [ 'all', false ],
			'true' => [ 'true', false ],
			'named set' => [ 'anatomy-labels', false ],
		];
	}

	/**
	 * Create a mock file object
	 *
	 * @param string $name
	 * @param int $width
	 * @param int $height
	 * @return \stdClass
	 */
	private function createMockFile(
		string $name = 'Test.jpg',
		int $width = 800,
		int $height = 600
	): \stdClass {
		$file = new \stdClass();
		$file->name = $name;
		$file->width = $width;
		$file->height = $height;
		$file->sha1 = 'abc123';

		// Use closure binding for method simulation
		$file->getName = static fn() => $name;
		$file->getWidth = static fn() => $width;
		$file->getHeight = static fn() => $height;
		$file->getSha1 = static fn() => 'abc123';

		return $file;
	}

	/**
	 * Create a mock thumbnail object
	 *
	 * @param \stdClass|null $file
	 * @param array $params
	 * @return \stdClass
	 */
	private function createMockThumbnail( ?\stdClass $file = null, array $params = [] ): \stdClass {
		$thumbnail = new \stdClass();

		// Add methods as closures
		$thumbnail->getFile = static fn() => $file;
		$thumbnail->getParams = static fn() => $params;

		return $thumbnail;
	}
}
