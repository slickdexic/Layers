<?php
/**
 * Tests for ImageLinkProcessor
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Tests\Hooks\Processors;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\Processors\ImageLinkProcessor;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersParamExtractor;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\ImageLinkProcessor
 */
class ImageLinkProcessorTest extends TestCase {

	/** @var LayersHtmlInjector|\PHPUnit\Framework\MockObject\MockObject */
	private $mockHtmlInjector;

	/** @var LayersParamExtractor|\PHPUnit\Framework\MockObject\MockObject */
	private $mockParamExtractor;

	/** @var ImageLinkProcessor */
	private $processor;

	protected function setUp(): void {
		parent::setUp();

		$this->mockHtmlInjector = $this->createMock( LayersHtmlInjector::class );
		$this->mockParamExtractor = $this->createMock( LayersParamExtractor::class );

		$this->processor = new ImageLinkProcessor(
			$this->mockHtmlInjector,
			$this->mockParamExtractor
		);
	}

	/**
	 * Create a mock File object
	 *
	 * @param string $name
	 * @param string $sha1
	 * @param int $width
	 * @param int $height
	 * @return \PHPUnit\Framework\MockObject\MockObject
	 */
	private function createMockFile(
		string $name = 'Test.jpg',
		string $sha1 = 'abc123',
		int $width = 800,
		int $height = 600
	) {
		$file = $this->createMock( \File::class );
		$file->method( 'getName' )->willReturn( $name );
		$file->method( 'getSha1' )->willReturn( $sha1 );
		$file->method( 'getWidth' )->willReturn( $width );
		$file->method( 'getHeight' )->willReturn( $height );
		return $file;
	}

	/**
	 * Set private database property via reflection
	 *
	 * @param LayersDatabase|\PHPUnit\Framework\MockObject\MockObject $database
	 */
	private function injectDatabase( $database ): void {
		$reflection = new ReflectionClass( $this->processor );
		$prop = $reflection->getProperty( 'database' );
		$prop->setAccessible( true );
		$prop->setValue( $this->processor, $database );
	}

	/**
	 * Call private method via reflection
	 *
	 * @param string $methodName
	 * @param array $args
	 * @return mixed
	 */
	private function callPrivateMethod( string $methodName, array $args ) {
		$reflection = new ReflectionClass( $this->processor );
		$method = $reflection->getMethod( $methodName );
		$method->setAccessible( true );
		return $method->invokeArgs( $this->processor, $args );
	}

	// ========== Constructor / Initial State Tests ==========

	/**
	 * @covers ::__construct
	 */
	public function testConstructorInitializesProcessor() {
		$processor = new ImageLinkProcessor(
			$this->mockHtmlInjector,
			$this->mockParamExtractor
		);

		$this->assertInstanceOf( ImageLinkProcessor::class, $processor );
	}

	/**
	 * @covers ::pageHasLayers
	 */
	public function testPageHasLayersInitiallyFalse() {
		$this->assertFalse( $this->processor->pageHasLayers() );
	}

	// ========== processImageLink Tests ==========

	/**
	 * @covers ::processImageLink
	 */
	public function testProcessImageLinkReturnsTrue() {
		$this->mockParamExtractor->method( 'extractFromAll' )->willReturn( null );
		$this->mockParamExtractor->method( 'isDisabled' )->willReturn( false );

		$file = $this->createMockFile();
		$html = '<img src="test.jpg">';

		$result = $this->processor->processImageLink(
			$file,
			[],
			[],
			$html
		);

		$this->assertTrue( $result );
	}

	/**
	 * @covers ::processImageLink
	 */
	public function testProcessImageLinkWithNullFile() {
		$this->mockParamExtractor->method( 'extractFromAll' )->willReturn( 'on' );
		$this->mockParamExtractor->method( 'isDisabled' )->willReturn( false );

		$html = '<img src="test.jpg">';

		$result = $this->processor->processImageLink(
			null,
			[],
			[],
			$html
		);

		$this->assertTrue( $result );
		// HTML should be unchanged when file is null
		$this->assertSame( '<img src="test.jpg">', $html );
	}

	/**
	 * @covers ::processImageLink
	 */
	public function testProcessImageLinkWithDisabledFlag() {
		$this->mockParamExtractor->method( 'extractFromAll' )->willReturn( 'off' );
		$this->mockParamExtractor->method( 'isDisabled' )->willReturn( true );

		$file = $this->createMockFile();
		$html = '<img src="test.jpg">';

		$result = $this->processor->processImageLink(
			$file,
			[],
			[],
			$html
		);

		$this->assertTrue( $result );
		// HTML should be unchanged when layers are disabled
		$this->assertSame( '<img src="test.jpg">', $html );
	}

	/**
	 * @covers ::processImageLink
	 */
	public function testProcessImageLinkWithNoLayersFlag() {
		$this->mockParamExtractor->method( 'extractFromAll' )->willReturn( null );
		$this->mockParamExtractor->method( 'isDisabled' )->willReturn( false );

		$file = $this->createMockFile();
		$html = '<img src="test.jpg">';

		$result = $this->processor->processImageLink(
			$file,
			[],
			[],
			$html
		);

		$this->assertTrue( $result );
		// HTML should be unchanged with no layers flag
		$this->assertSame( '<img src="test.jpg">', $html );
	}

	/**
	 * @covers ::processImageLink
	 */
	public function testProcessImageLinkWithDirectJson() {
		$layersArray = [ [ 'id' => '1', 'type' => 'text', 'text' => 'Test' ] ];

		$this->mockParamExtractor->method( 'extractFromAll' )->willReturn( 'on' );
		$this->mockParamExtractor->method( 'isDisabled' )->willReturn( false );
		$this->mockParamExtractor->method( 'extractLayersJson' )
			->willReturn( $layersArray );

		$this->mockHtmlInjector->method( 'getFileDimensions' )
			->willReturn( [ 'width' => 800, 'height' => 600 ] );
		$this->mockHtmlInjector->method( 'injectIntoHtml' )
			->willReturn( '<img src="test.jpg" data-layer-data="injected">' );

		$file = $this->createMockFile();
		$html = '<img src="test.jpg">';

		$result = $this->processor->processImageLink(
			$file,
			[ 'layers-json' => json_encode( $layersArray ) ],
			[],
			$html
		);

		$this->assertTrue( $result );
		$this->assertStringContainsString( 'data-layer-data', $html );
		$this->assertTrue( $this->processor->pageHasLayers() );
	}

	/**
	 * @covers ::processImageLink
	 */
	public function testProcessImageLinkAddsIntentMarkerWhenNoLayersFound() {
		$this->mockParamExtractor->method( 'extractFromAll' )->willReturn( 'on' );
		$this->mockParamExtractor->method( 'isDisabled' )->willReturn( false );
		$this->mockParamExtractor->method( 'extractLayersJson' )->willReturn( null );
		$this->mockParamExtractor->method( 'getSetName' )->willReturn( null );

		$this->mockHtmlInjector->method( 'injectIntentMarker' )
			->willReturn( '<img src="test.jpg" data-layers-intent="on">' );

		// Create mock database that returns null (no layers)
		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->method( 'getLatestLayerSet' )->willReturn( null );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$html = '<img src="test.jpg">';

		$this->processor->processImageLink(
			$file,
			[],
			[],
			$html
		);

		$this->assertStringContainsString( 'data-layers-intent', $html );
	}

	// ========== processMediaLink Tests ==========

	/**
	 * @covers ::processMediaLink
	 */
	public function testProcessMediaLinkWithNullFile() {
		$html = '<a href="test.jpg">Link</a>';
		$attribs = [];

		$result = $this->processor->processMediaLink( null, $html, $attribs );

		$this->assertTrue( $result );
		$this->assertSame( '<a href="test.jpg">Link</a>', $html );
	}

	/**
	 * @covers ::processMediaLink
	 */
	public function testProcessMediaLinkWithNoLayersParam() {
		$file = $this->createMockFile();
		$html = '<a href="test.jpg">Link</a>';
		$attribs = [ 'href' => '/wiki/File:Test.jpg' ];

		$result = $this->processor->processMediaLink( $file, $html, $attribs );

		$this->assertTrue( $result );
	}

	/**
	 * @covers ::processMediaLink
	 */
	public function testProcessMediaLinkWithDisabledParam() {
		$this->mockParamExtractor->method( 'isDisabled' )->willReturn( true );

		$file = $this->createMockFile();
		$html = '<a href="test.jpg?layers=off">Link</a>';
		$attribs = [];

		$result = $this->processor->processMediaLink( $file, $html, $attribs );

		$this->assertTrue( $result );
	}

	/**
	 * @covers ::processMediaLink
	 */
	public function testProcessMediaLinkAddsIntentMarkerWhenNoData() {
		$this->mockParamExtractor->method( 'isDisabled' )->willReturn( false );

		$this->mockHtmlInjector->method( 'injectIntentMarker' )
			->willReturn( '<a href="test.jpg" data-layers-intent="on">Link</a>' );

		// Create mock database that returns null
		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->method( 'getLatestLayerSet' )->willReturn( null );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$html = '<a href="test.jpg?layers=on">Link</a>';
		$attribs = [ 'class' => '' ];

		$result = $this->processor->processMediaLink( $file, $html, $attribs );

		$this->assertTrue( $result );
		$this->assertStringContainsString( 'layers-thumbnail', $attribs['class'] );
		$this->assertSame( 'on', $attribs['data-layers-intent'] );
	}

	// ========== extractLayersParamFromMediaLink Tests ==========

	/**
	 * @covers ::extractLayersParamFromMediaLink
	 * @dataProvider extractLayersParamFromMediaLinkProvider
	 */
	public function testExtractLayersParamFromMediaLink(
		string $html,
		array $attribs,
		?string $expected
	) {
		$result = $this->callPrivateMethod( 'extractLayersParamFromMediaLink', [ $html, $attribs ] );
		$this->assertSame( $expected, $result );
	}

	/**
	 * Data provider for extractLayersParamFromMediaLink tests
	 *
	 * @return array
	 */
	public static function extractLayersParamFromMediaLinkProvider(): array {
		return [
			'no param in html or attribs' => [
				'<a href="test.jpg">Link</a>',
				[],
				null,
			],
			'layers=on in html query string' => [
				'<a href="test.jpg?layers=on">Link</a>',
				[],
				'on',
			],
			'layers=off in html' => [
				'<a href="test.jpg?layers=off">Link</a>',
				[],
				'off',
			],
			'layers=mysetname in html' => [
				'<a href="test.jpg?layers=MySetName">Link</a>',
				[],
				'mysetname',
			],
			'layers in href attribute' => [
				'<a>Link</a>',
				[ 'href' => '/wiki/File:Test.jpg?layers=on' ],
				'on',
			],
			'layers in data-mw-href attribute' => [
				'<a>Link</a>',
				[ 'data-mw-href' => '/wiki/File:Test.jpg?layers=annotations' ],
				'annotations',
			],
			'URL encoded param' => [
				'<a href="test.jpg?layers=my%20set">Link</a>',
				[],
				'my set',
			],
			'layers with hash fragment' => [
				'<a href="test.jpg#layers=on">Link</a>',
				[],
				'on',
			],
			'layers with ampersand' => [
				'<a href="test.jpg?foo=bar&layers=on">Link</a>',
				[],
				'on',
			],
			'pipe separator (wikitext style)' => [
				'<img src="test.jpg|layers=on">',
				[],
				'on',
			],
		];
	}

	// ========== extractLayersFromSet Tests ==========

	/**
	 * @covers ::extractLayersFromSet
	 */
	public function testExtractLayersFromSetWithNull() {
		$result = $this->callPrivateMethod( 'extractLayersFromSet', [ null ] );
		$this->assertNull( $result );
	}

	/**
	 * @covers ::extractLayersFromSet
	 */
	public function testExtractLayersFromSetWithJsonString() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$result = $this->callPrivateMethod( 'extractLayersFromSet', [ $layerSet ] );
		$this->assertSame( $layers, $result );
	}

	/**
	 * @covers ::extractLayersFromSet
	 */
	public function testExtractLayersFromSetWithArray() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];
		$layerSet = [
			'ls_data' => [ 'layers' => $layers ]
		];

		$result = $this->callPrivateMethod( 'extractLayersFromSet', [ $layerSet ] );
		$this->assertSame( $layers, $result );
	}

	/**
	 * @covers ::extractLayersFromSet
	 */
	public function testExtractLayersFromSetWithDirectLayersArray() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ], [ 'id' => '2', 'type' => 'arrow' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( $layers )
		];

		$result = $this->callPrivateMethod( 'extractLayersFromSet', [ $layerSet ] );
		$this->assertSame( $layers, $result );
	}

	/**
	 * @covers ::extractLayersFromSet
	 */
	public function testExtractLayersFromSetWithInvalidJson() {
		$layerSet = (object)[
			'ls_data' => 'invalid json {'
		];

		$result = $this->callPrivateMethod( 'extractLayersFromSet', [ $layerSet ] );
		$this->assertNull( $result );
	}

	/**
	 * @covers ::extractLayersFromSet
	 */
	public function testExtractLayersFromSetWithMissingData() {
		$layerSet = (object)[];

		$result = $this->callPrivateMethod( 'extractLayersFromSet', [ $layerSet ] );
		$this->assertNull( $result );
	}

	// ========== resolveLayerSetFromParam Tests ==========

	/**
	 * @covers ::resolveLayerSetFromParam
	 */
	public function testResolveLayerSetFromParamWithOn() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->method( 'getLatestLayerSet' )->willReturn( $layerSet );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$result = $this->callPrivateMethod( 'resolveLayerSetFromParam', [ $file, 'on' ] );

		$this->assertSame( $layers, $result );
	}

	/**
	 * @covers ::resolveLayerSetFromParam
	 */
	public function testResolveLayerSetFromParamWithAll() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->method( 'getLatestLayerSet' )->willReturn( $layerSet );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$result = $this->callPrivateMethod( 'resolveLayerSetFromParam', [ $file, 'all' ] );

		$this->assertSame( $layers, $result );
	}

	/**
	 * @covers ::resolveLayerSetFromParam
	 */
	public function testResolveLayerSetFromParamWithIdPrefix() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->expects( $this->once() )
			->method( 'getLayerSet' )
			->with( 123 )
			->willReturn( $layerSet );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$result = $this->callPrivateMethod( 'resolveLayerSetFromParam', [ $file, 'id:123' ] );

		$this->assertSame( $layers, $result );
	}

	/**
	 * @covers ::resolveLayerSetFromParam
	 */
	public function testResolveLayerSetFromParamWithNamePrefix() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Test.jpg', 'abc123', 'mysetname' )
			->willReturn( $layerSet );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$result = $this->callPrivateMethod( 'resolveLayerSetFromParam', [ $file, 'name:mysetname' ] );

		$this->assertSame( $layers, $result );
	}

	/**
	 * @covers ::resolveLayerSetFromParam
	 */
	public function testResolveLayerSetFromParamWithShortIds() {
		$layers = [
			[ 'id' => 'layer-abc1', 'type' => 'text' ],
			[ 'id' => 'layer-def2', 'type' => 'arrow' ],
			[ 'id' => 'layer-xyz9', 'type' => 'circle' ],
		];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->method( 'getLatestLayerSet' )->willReturn( $layerSet );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$result = $this->callPrivateMethod( 'resolveLayerSetFromParam', [ $file, 'abc1,def2' ] );

		// Should only return layers matching the short IDs
		$this->assertCount( 2, $result );
		$this->assertSame( 'layer-abc1', $result[0]['id'] );
		$this->assertSame( 'layer-def2', $result[1]['id'] );
	}

	/**
	 * @covers ::resolveLayerSetFromParam
	 */
	public function testResolveLayerSetFromParamWithPlainSetName() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Test.jpg', 'abc123', 'annotations' )
			->willReturn( $layerSet );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$result = $this->callPrivateMethod( 'resolveLayerSetFromParam', [ $file, 'annotations' ] );

		$this->assertSame( $layers, $result );
	}

	/**
	 * @covers ::resolveLayerSetFromParam
	 */
	public function testResolveLayerSetFromParamWithNoDatabase() {
		// Don't inject a database - simulates service unavailable
		$file = $this->createMockFile();
		$result = $this->callPrivateMethod( 'resolveLayerSetFromParam', [ $file, 'on' ] );

		$this->assertNull( $result );
	}

	// ========== injectLayersFromDatabase Tests ==========

	/**
	 * @covers ::injectLayersFromDatabase
	 */
	public function testInjectLayersFromDatabaseWithValidData() {
		$layers = [ [ 'id' => '1', 'type' => 'text', 'text' => 'Hello' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->method( 'getLatestLayerSet' )->willReturn( $layerSet );
		$this->injectDatabase( $mockDb );

		$this->mockHtmlInjector->method( 'getFileDimensions' )
			->willReturn( [ 'width' => 800, 'height' => 600 ] );
		$this->mockHtmlInjector->method( 'injectIntoHtml' )
			->willReturn( '<img src="test.jpg" data-layer-data="injected">' );

		$file = $this->createMockFile();
		$result = $this->callPrivateMethod( 'injectLayersFromDatabase', [
			'<img src="test.jpg">',
			$file,
			null,
			'TestContext'
		] );

		$this->assertStringContainsString( 'data-layer-data', $result );
	}

	/**
	 * @covers ::injectLayersFromDatabase
	 */
	public function testInjectLayersFromDatabaseWithNamedSet() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Test.jpg', 'abc123', 'mysetname' )
			->willReturn( $layerSet );
		$this->injectDatabase( $mockDb );

		$this->mockHtmlInjector->method( 'getFileDimensions' )
			->willReturn( [ 'width' => 800, 'height' => 600 ] );
		$this->mockHtmlInjector->method( 'injectIntoHtml' )
			->willReturn( '<img data-layer-data="injected">' );

		$file = $this->createMockFile();
		$this->callPrivateMethod( 'injectLayersFromDatabase', [
			'<img src="test.jpg">',
			$file,
			'mysetname',
			'TestContext'
		] );

		// The assertion is in the expects() call
		$this->assertTrue( true );
	}

	/**
	 * @covers ::injectLayersFromDatabase
	 */
	public function testInjectLayersFromDatabaseWithDefaultSetName() {
		$mockDb = $this->createMock( LayersDatabase::class );
		// When setName is 'default', should call without the third parameter
		$mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Test.jpg', 'abc123' )
			->willReturn( null );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$this->callPrivateMethod( 'injectLayersFromDatabase', [
			'<img src="test.jpg">',
			$file,
			'default',
			'TestContext'
		] );

		$this->assertTrue( true );
	}

	/**
	 * @covers ::injectLayersFromDatabase
	 */
	public function testInjectLayersFromDatabaseWithNoLayerSet() {
		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->method( 'getLatestLayerSet' )->willReturn( null );
		$this->injectDatabase( $mockDb );

		$file = $this->createMockFile();
		$html = '<img src="test.jpg">';
		$result = $this->callPrivateMethod( 'injectLayersFromDatabase', [
			$html,
			$file,
			null,
			'TestContext'
		] );

		// HTML should be unchanged
		$this->assertSame( $html, $result );
	}

	// ========== injectLayersDirect Tests ==========

	/**
	 * @covers ::injectLayersDirect
	 */
	public function testInjectLayersDirect() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];

		$this->mockHtmlInjector->method( 'getFileDimensions' )
			->willReturn( [ 'width' => 800, 'height' => 600 ] );
		$this->mockHtmlInjector->expects( $this->once() )
			->method( 'injectIntoHtml' )
			->with(
				'<img src="test.jpg">',
				$layers,
				800,
				600,
				'TestContext'
			)
			->willReturn( '<img src="test.jpg" data-layer-data="injected">' );

		$file = $this->createMockFile();
		$result = $this->callPrivateMethod( 'injectLayersDirect', [
			'<img src="test.jpg">',
			$file,
			$layers,
			'TestContext'
		] );

		$this->assertStringContainsString( 'data-layer-data', $result );
		$this->assertTrue( $this->processor->pageHasLayers() );
	}

	// ========== Exception Handling Tests ==========

	/**
	 * @covers ::processImageLink
	 */
	public function testProcessImageLinkHandlesExceptions() {
		$this->mockParamExtractor->method( 'extractFromAll' )
			->willThrowException( new \Exception( 'Test exception' ) );

		$file = $this->createMockFile();
		$html = '<img src="test.jpg">';

		// Should not throw, just return true
		$result = $this->processor->processImageLink(
			$file,
			[],
			[],
			$html
		);

		$this->assertTrue( $result );
	}

	/**
	 * @covers ::processMediaLink
	 */
	public function testProcessMediaLinkHandlesExceptions() {
		$file = $this->createMock( \File::class );
		$file->method( 'getName' )->willThrowException( new \Exception( 'Test exception' ) );

		$html = '<a href="test.jpg?layers=on">Link</a>';
		$attribs = [];

		// Should not throw, just return true
		$result = $this->processor->processMediaLink( $file, $html, $attribs );

		$this->assertTrue( $result );
	}

	// ========== Integration-like Tests ==========

	/**
	 * @covers ::processImageLink
	 */
	public function testProcessImageLinkWithSetNameFromQueue() {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];
		$layerSet = (object)[
			'ls_data' => json_encode( [ 'layers' => $layers ] )
		];

		$this->mockParamExtractor->method( 'extractFromAll' )->willReturn( 'on' );
		$this->mockParamExtractor->method( 'isDisabled' )->willReturn( false );
		$this->mockParamExtractor->method( 'extractLayersJson' )->willReturn( null );
		$this->mockParamExtractor->method( 'getSetName' )->willReturn( null );

		$mockDb = $this->createMock( LayersDatabase::class );
		$mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Test.jpg', 'abc123', 'fromqueue' )
			->willReturn( $layerSet );
		$this->injectDatabase( $mockDb );

		$this->mockHtmlInjector->method( 'getFileDimensions' )
			->willReturn( [ 'width' => 800, 'height' => 600 ] );
		$this->mockHtmlInjector->method( 'injectIntoHtml' )
			->willReturn( '<img data-layer-data="injected">' );

		$file = $this->createMockFile();
		$html = '<img src="test.jpg">';

		$this->processor->processImageLink(
			$file,
			[],
			[],
			$html,
			'fromqueue'
		);

		$this->assertTrue( $this->processor->pageHasLayers() );
	}
}
