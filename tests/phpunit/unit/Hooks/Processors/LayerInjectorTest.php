<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks\Processors;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector;
use MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * Unit tests for LayerInjector
 *
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector
 * @group Layers
 */
class LayerInjectorTest extends TestCase {

	/** @var LayerInjector */
	private LayerInjector $injector;

	/** @var LayersDatabase|\PHPUnit\Framework\MockObject\MockObject */
	private $mockDb;

	/** @var LayersHtmlInjector|\PHPUnit\Framework\MockObject\MockObject */
	private $mockHtmlInjector;

	protected function setUp(): void {
		parent::setUp();
		$this->injector = new LayerInjector( new NullLogger() );

		// Create mocks
		$this->mockDb = $this->createMock( LayersDatabase::class );
		$this->mockHtmlInjector = $this->createMock( LayersHtmlInjector::class );

		// Inject mocks
		$this->injector->setDatabase( $this->mockDb );
		$this->injector->setHtmlInjector( $this->mockHtmlInjector );
	}

	/**
	 * Create a mock File object
	 *
	 * @param string $name File name
	 * @param string $sha1 SHA1 hash
	 * @return \stdClass Mock file
	 */
	private function createMockFile( string $name = 'Test.jpg', string $sha1 = 'abc123' ): \stdClass {
		$file = new \stdClass();
		$file->name = $name;
		$file->sha1 = $sha1;

		// Add methods as closures
		$file->getName = fn() => $file->name;
		$file->getSha1 = fn() => $file->sha1;

		return $file;
	}

	// ========== addLatestLayersToImage tests ==========

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addLatestLayersToImage
	 */
	public function testAddLatestLayersToImageWithDefaultSet(): void {
		$file = $this->createMockFile( 'Test.jpg', 'sha123' );
		$params = [];

		$layerSet = [
			'id' => 42,
			'data' => [
				'layers' => [
					[ 'id' => 'layer1', 'type' => 'rectangle' ]
				]
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Test.jpg', 'sha123' )
			->willReturn( $layerSet );

		$this->injector->addLatestLayersToImage( $file, $params );

		$this->assertSame( 42, $params['layerSetId'] );
		$this->assertCount( 1, $params['layerData'] );
		$this->assertSame( 'layer1', $params['layerData'][0]['id'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addLatestLayersToImage
	 */
	public function testAddLatestLayersToImageWithNamedSet(): void {
		$file = $this->createMockFile( 'Test.jpg', 'sha123' );
		$params = [];

		$layerSet = [
			'id' => 55,
			'data' => [
				'layers' => [
					[ 'id' => 'namedLayer', 'type' => 'circle' ]
				]
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLayerSetByName' )
			->with( 'Test.jpg', 'sha123', 'custom-set' )
			->willReturn( $layerSet );

		$this->injector->addLatestLayersToImage( $file, $params, 'custom-set' );

		$this->assertSame( 55, $params['layerSetId'] );
		$this->assertSame( 'namedLayer', $params['layerData'][0]['id'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addLatestLayersToImage
	 */
	public function testAddLatestLayersToImageWithOffSkipsLookup(): void {
		$file = $this->createMockFile();
		$params = [];

		// Should not call database at all
		$this->mockDb->expects( $this->never() )
			->method( 'getLatestLayerSet' );
		$this->mockDb->expects( $this->never() )
			->method( 'getLayerSetByName' );

		$this->injector->addLatestLayersToImage( $file, $params, 'off' );

		$this->assertArrayNotHasKey( 'layerSetId', $params );
		$this->assertArrayNotHasKey( 'layerData', $params );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addLatestLayersToImage
	 */
	public function testAddLatestLayersToImageWithNoneSkipsLookup(): void {
		$file = $this->createMockFile();
		$params = [];

		$this->mockDb->expects( $this->never() )
			->method( 'getLatestLayerSet' );

		$this->injector->addLatestLayersToImage( $file, $params, 'none' );

		$this->assertArrayNotHasKey( 'layerSetId', $params );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addLatestLayersToImage
	 */
	public function testAddLatestLayersToImageWhenNoLayerSetFound(): void {
		$file = $this->createMockFile();
		$params = [];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->willReturn( null );

		$this->injector->addLatestLayersToImage( $file, $params );

		$this->assertArrayNotHasKey( 'layerSetId', $params );
		$this->assertArrayNotHasKey( 'layerData', $params );
	}

	// ========== addSpecificLayersToImage tests ==========

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addSpecificLayersToImage
	 */
	public function testAddSpecificLayersById(): void {
		$file = $this->createMockFile();
		$params = [];

		$layerSet = [
			'id' => 123,
			'data' => [
				'layers' => [
					[ 'id' => 'byId', 'type' => 'text' ]
				]
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLayerSet' )
			->with( 123 )
			->willReturn( $layerSet );

		$this->injector->addSpecificLayersToImage( $file, 'id:123', $params );

		$this->assertSame( 123, $params['layerSetId'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addSpecificLayersToImage
	 */
	public function testAddSpecificLayersByName(): void {
		$file = $this->createMockFile( 'Image.png', 'hashval' );
		$params = [];

		$layerSet = [
			'id' => 456,
			'data' => [
				'layers' => [
					[ 'id' => 'byName', 'type' => 'arrow' ]
				]
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLayerSetByName' )
			->with( 'Image.png', 'hashval', 'myCustomSet' )
			->willReturn( $layerSet );

		$this->injector->addSpecificLayersToImage( $file, 'name:myCustomSet', $params );

		$this->assertSame( 456, $params['layerSetId'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addSpecificLayersToImage
	 */
	public function testAddSpecificLayersWithUnknownFormat(): void {
		$file = $this->createMockFile();
		$params = [];

		// Unknown format should not make any DB calls
		$this->mockDb->expects( $this->never() )
			->method( 'getLayerSet' );
		$this->mockDb->expects( $this->never() )
			->method( 'getLayerSetByName' );

		$this->injector->addSpecificLayersToImage( $file, 'unknown:format', $params );

		$this->assertArrayNotHasKey( 'layerSetId', $params );
	}

	// ========== addSubsetLayersToImage tests ==========

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addSubsetLayersToImage
	 */
	public function testAddSubsetLayersFiltersById(): void {
		$file = $this->createMockFile( 'Test.jpg', 'sha1val' );
		$params = [];

		$layerSet = [
			'id' => 99,
			'data' => [
				'layers' => [
					[ 'id' => 'abcd1234', 'type' => 'rectangle' ],
					[ 'id' => 'efgh5678', 'type' => 'circle' ],
					[ 'id' => 'ijkl9012', 'type' => 'text' ]
				]
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Test.jpg', 'sha1val' )
			->willReturn( $layerSet );

		// Request only 'abcd' and 'ijkl'
		$this->injector->addSubsetLayersToImage( $file, 'abcd,ijkl', $params );

		$this->assertSame( 99, $params['layerSetId'] );
		$this->assertCount( 2, $params['layerData'] );
		$this->assertSame( 'abcd1234', $params['layerData'][0]['id'] );
		$this->assertSame( 'ijkl9012', $params['layerData'][1]['id'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addSubsetLayersToImage
	 */
	public function testAddSubsetLayersNoMatch(): void {
		$file = $this->createMockFile();
		$params = [];

		$layerSet = [
			'id' => 99,
			'data' => [
				'layers' => [
					[ 'id' => 'abcd1234', 'type' => 'rectangle' ]
				]
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->willReturn( $layerSet );

		// Request non-existent IDs
		$this->injector->addSubsetLayersToImage( $file, 'xxxx,yyyy', $params );

		$this->assertArrayNotHasKey( 'layerSetId', $params );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addSubsetLayersToImage
	 */
	public function testAddSubsetLayersWhenNoLayerSet(): void {
		$file = $this->createMockFile();
		$params = [];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->willReturn( null );

		$this->injector->addSubsetLayersToImage( $file, 'abcd', $params );

		$this->assertArrayNotHasKey( 'layerSetId', $params );
	}

	// ========== injectIntoAttributes tests ==========

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::injectIntoAttributes
	 */
	public function testInjectIntoAttributesSuccess(): void {
		$file = $this->createMockFile( 'Photo.jpg', 'hashABC' );
		$attribs = [ 'src' => 'thumb.jpg' ];

		$layerSet = [
			'id' => 77,
			'data' => [
				'layers' => [
					[ 'id' => 'injected', 'type' => 'highlight' ]
				]
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Photo.jpg', 'hashABC' )
			->willReturn( $layerSet );

		$this->mockHtmlInjector->expects( $this->once() )
			->method( 'getFileDimensions' )
			->willReturn( [ 'width' => 800, 'height' => 600 ] );

		$this->mockHtmlInjector->expects( $this->once() )
			->method( 'injectIntoAttributes' )
			->with(
				$this->identicalTo( $attribs ),
				$this->callback( fn( $layers ) => count( $layers ) === 1 && $layers[0]['id'] === 'injected' ),
				800,
				600
			);

		$result = $this->injector->injectIntoAttributes( $attribs, $file );

		$this->assertTrue( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::injectIntoAttributes
	 */
	public function testInjectIntoAttributesWithNullFile(): void {
		$attribs = [];

		$result = $this->injector->injectIntoAttributes( $attribs, null );

		$this->assertFalse( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::injectIntoAttributes
	 */
	public function testInjectIntoAttributesNoLayerSetFound(): void {
		$file = $this->createMockFile();
		$attribs = [];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->willReturn( null );

		$result = $this->injector->injectIntoAttributes( $attribs, $file );

		$this->assertFalse( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::injectIntoAttributes
	 */
	public function testInjectIntoAttributesWithEmptyLayers(): void {
		$file = $this->createMockFile();
		$attribs = [];

		$layerSet = [
			'id' => 88,
			'data' => [
				// Empty layers array
				'layers' => []
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->willReturn( $layerSet );

		$result = $this->injector->injectIntoAttributes( $attribs, $file );

		$this->assertFalse( $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::injectIntoAttributes
	 */
	public function testInjectIntoAttributesWithNamedSet(): void {
		$file = $this->createMockFile( 'Named.jpg', 'hashDEF' );
		$attribs = [];

		$layerSet = [
			'id' => 111,
			'data' => [
				'layers' => [
					[ 'id' => 'namedLayer', 'type' => 'polygon' ]
				]
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Named.jpg', 'hashDEF', 'custom-set-name' )
			->willReturn( $layerSet );

		$this->mockHtmlInjector->method( 'getFileDimensions' )
			->willReturn( [ 'width' => null, 'height' => null ] );

		$this->mockHtmlInjector->expects( $this->once() )
			->method( 'injectIntoAttributes' );

		$result = $this->injector->injectIntoAttributes( $attribs, $file, 'custom-set-name' );

		$this->assertTrue( $result );
	}

	// ========== Edge cases ==========

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addLatestLayersToImage
	 */
	public function testAddLatestLayersHandlesDataWithoutLayersKey(): void {
		$file = $this->createMockFile();
		$params = [];

		// Simulating legacy format where data is directly the layers array
		$layerSet = [
			'id' => 200,
			'data' => [
				[ 'id' => 'legacy', 'type' => 'line' ]
			]
		];

		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->willReturn( $layerSet );

		$this->injector->addLatestLayersToImage( $file, $params );

		$this->assertSame( 200, $params['layerSetId'] );
		// When no 'layers' key, the entire data is used
		$this->assertIsArray( $params['layerData'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayerInjector::addLatestLayersToImage
	 */
	public function testOnTrueUsesDefaultSet(): void {
		$file = $this->createMockFile();
		$params = [];

		$layerSet = [
			'id' => 300,
			'data' => [ 'layers' => [] ]
		];

		// 'on' should use getLatestLayerSet (default), not getLayerSetByName
		$this->mockDb->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->willReturn( $layerSet );
		$this->mockDb->expects( $this->never() )
			->method( 'getLayerSetByName' );

		$this->injector->addLatestLayersToImage( $file, $params, 'on' );

		$this->assertSame( 300, $params['layerSetId'] );
	}
}
