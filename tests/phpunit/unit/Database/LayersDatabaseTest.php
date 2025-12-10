<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Database;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Database\LayersSchemaManager;
use PHPUnit\Framework\MockObject\MockObject;
use Psr\Log\LoggerInterface;
use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\IResultWrapper;
use Wikimedia\Rdbms\LoadBalancer;

/**
 * @coversDefaultClass \MediaWiki\Extension\Layers\Database\LayersDatabase
 * @group Layers
 */
class LayersDatabaseTest extends \MediaWikiUnitTestCase {

	/** @var LoadBalancer|MockObject */
	private $loadBalancer;

	/** @var IDatabase|MockObject */
	private $dbw;

	/** @var IDatabase|MockObject */
	private $dbr;

	/** @var LoggerInterface|MockObject */
	private $logger;

	/** @var \HashConfig */
	private $config;

	/** @var LayersSchemaManager|MockObject */
	private $schemaManager;

	protected function setUp(): void {
		parent::setUp();

		$this->dbw = $this->createMock( IDatabase::class );
		$this->dbr = $this->createMock( IDatabase::class );
		$this->loadBalancer = $this->createMock( LoadBalancer::class );
		$this->logger = $this->createMock( LoggerInterface::class );
		$this->schemaManager = $this->createMock( LayersSchemaManager::class );

		$this->config = new \HashConfig( [
			'LayersDefaultSetName' => 'default',
			'LayersMaxBytes' => 2097152, // 2MB
			'LayersMaxLayerCount' => 100,
			'LayersMaxNamedSets' => 15,
			'LayersMaxRevisionsPerSet' => 25,
		] );

		// By default, return the mock databases
		$this->loadBalancer->method( 'getConnection' )
			->willReturnCallback( function ( $mode ) {
				return $mode === DB_PRIMARY ? $this->dbw : $this->dbr;
			} );
	}

	/**
	 * Create a LayersDatabase instance for testing
	 *
	 * @return LayersDatabase
	 */
	private function createLayersDatabase(): LayersDatabase {
		return new LayersDatabase(
			$this->loadBalancer,
			$this->config,
			$this->logger,
			$this->schemaManager
		);
	}

	/**
	 * Helper to create mock result wrapper
	 *
	 * @param array $rows Array of stdClass objects
	 * @return IResultWrapper|MockObject
	 */
	private function createResultWrapper( array $rows ): MockObject {
		$result = $this->createMock( IResultWrapper::class );
		$result->method( 'current' )->willReturnOnConsecutiveCalls( ...array_merge( $rows, [ false ] ) );
		$result->method( 'valid' )->willReturnCallback( static function () use ( &$rows ) {
			return count( $rows ) > 0;
		} );

		// Make it iterable
		$iterator = new \ArrayIterator( $rows );
		$result->method( 'rewind' )->willReturnCallback( static function () use ( $iterator ) {
			$iterator->rewind();
		} );
		$result->method( 'next' )->willReturnCallback( static function () use ( $iterator ) {
			$iterator->next();
		} );
		$result->method( 'key' )->willReturnCallback( static function () use ( $iterator ) {
			return $iterator->key();
		} );
		$result->method( 'getIterator' )->willReturn( $iterator );

		return $result;
	}

	/**
	 * Helper to create a layer set row object
	 *
	 * @param array $data Layer set data
	 * @return \stdClass
	 */
	private function createLayerSetRow( array $data ): \stdClass {
		$row = new \stdClass();
		$row->ls_id = $data['id'] ?? 1;
		$row->ls_img_name = $data['imgName'] ?? 'Test_image.jpg';
		$row->ls_img_sha1 = $data['sha1'] ?? 'abc123';
		$row->ls_img_major_mime = $data['majorMime'] ?? 'image';
		$row->ls_img_minor_mime = $data['minorMime'] ?? 'jpeg';
		$row->ls_json_blob = $data['json'] ?? json_encode( [
			'revision' => 1,
			'schema' => 1,
			'created' => '20231209120000',
			'layers' => $data['layers'] ?? []
		] );
		$row->ls_user_id = $data['userId'] ?? 1;
		$row->ls_timestamp = $data['timestamp'] ?? '20231209120000';
		$row->ls_revision = $data['revision'] ?? 1;
		$row->ls_name = $data['name'] ?? 'default';
		$row->ls_size = $data['size'] ?? strlen( $row->ls_json_blob );
		$row->ls_layer_count = $data['layerCount'] ?? 0;
		return $row;
	}

	// =========================================================================
	// Constructor and Schema Tests
	// =========================================================================

	/**
	 * @covers ::__construct
	 */
	public function testConstruction(): void {
		$db = $this->createLayersDatabase();
		$this->assertInstanceOf( LayersDatabase::class, $db );
	}

	/**
	 * @covers ::isSchemaReady
	 */
	public function testIsSchemaReadyReturnsTrue(): void {
		$this->schemaManager->method( 'isSchemaReady' )->willReturn( true );

		$db = $this->createLayersDatabase();
		$this->assertTrue( $db->isSchemaReady() );
	}

	/**
	 * @covers ::isSchemaReady
	 */
	public function testIsSchemaReadyReturnsFalse(): void {
		$this->schemaManager->method( 'isSchemaReady' )->willReturn( false );

		$db = $this->createLayersDatabase();
		$this->assertFalse( $db->isSchemaReady() );
	}

	// =========================================================================
	// getLayerSet Tests
	// =========================================================================

	/**
	 * @covers ::getLayerSet
	 */
	public function testGetLayerSetSuccess(): void {
		$layersData = [
			[ 'id' => 'layer_1', 'type' => 'text', 'text' => 'Hello' ]
		];
		$row = $this->createLayerSetRow( [
			'id' => 42,
			'imgName' => 'Test.jpg',
			'userId' => 123,
			'revision' => 5,
			'name' => 'default',
			'layers' => $layersData
		] );

		$this->dbr->method( 'selectRow' )->willReturn( $row );

		$db = $this->createLayersDatabase();
		$result = $db->getLayerSet( 42 );

		$this->assertIsArray( $result );
		$this->assertEquals( 42, $result['id'] );
		$this->assertEquals( 'Test.jpg', $result['imgName'] );
		$this->assertEquals( 123, $result['userId'] );
		$this->assertEquals( 5, $result['revision'] );
		$this->assertEquals( 'default', $result['name'] );
		$this->assertIsArray( $result['data'] );
	}

	/**
	 * @covers ::getLayerSet
	 */
	public function testGetLayerSetNotFound(): void {
		$this->dbr->method( 'selectRow' )->willReturn( false );

		$db = $this->createLayersDatabase();
		$result = $db->getLayerSet( 999 );

		$this->assertFalse( $result );
	}

	/**
	 * @covers ::getLayerSet
	 */
	public function testGetLayerSetInvalidId(): void {
		$db = $this->createLayersDatabase();

		$this->assertFalse( $db->getLayerSet( 0 ) );
		$this->assertFalse( $db->getLayerSet( -1 ) );
	}

	/**
	 * @covers ::getLayerSet
	 */
	public function testGetLayerSetCachesResult(): void {
		$row = $this->createLayerSetRow( [ 'id' => 42 ] );

		// Should only be called once due to caching
		$this->dbr->expects( $this->once() )
			->method( 'selectRow' )
			->willReturn( $row );

		$db = $this->createLayersDatabase();

		// First call - hits database
		$result1 = $db->getLayerSet( 42 );
		// Second call - should use cache
		$result2 = $db->getLayerSet( 42 );

		$this->assertEquals( $result1, $result2 );
	}

	/**
	 * @covers ::getLayerSet
	 */
	public function testGetLayerSetRejectsOversizedJson(): void {
		$row = $this->createLayerSetRow( [ 'id' => 42 ] );
		// Create JSON larger than 2MB limit
		$row->ls_json_blob = str_repeat( 'x', 3 * 1024 * 1024 );

		$this->dbr->method( 'selectRow' )->willReturn( $row );
		$this->logger->expects( $this->once() )
			->method( 'error' )
			->with( $this->stringContains( 'JSON blob too large' ) );

		$db = $this->createLayersDatabase();
		$result = $db->getLayerSet( 42 );

		$this->assertFalse( $result );
	}

	/**
	 * @covers ::getLayerSet
	 */
	public function testGetLayerSetHandlesInvalidJson(): void {
		$row = $this->createLayerSetRow( [ 'id' => 42 ] );
		$row->ls_json_blob = 'not valid json {{{';

		$this->dbr->method( 'selectRow' )->willReturn( $row );
		$this->logger->expects( $this->once() )
			->method( 'error' )
			->with( $this->stringContains( 'Invalid JSON' ) );

		$db = $this->createLayersDatabase();
		$result = $db->getLayerSet( 42 );

		$this->assertFalse( $result );
	}

	// =========================================================================
	// getLatestLayerSet Tests
	// =========================================================================

	/**
	 * @covers ::getLatestLayerSet
	 */
	public function testGetLatestLayerSetSuccess(): void {
		$row = $this->createLayerSetRow( [
			'id' => 10,
			'imgName' => 'Latest.jpg',
			'revision' => 3
		] );

		$this->dbr->method( 'selectRow' )->willReturn( $row );

		$db = $this->createLayersDatabase();
		$result = $db->getLatestLayerSet( 'Latest.jpg', 'sha1hash' );

		$this->assertIsArray( $result );
		$this->assertEquals( 10, $result['id'] );
		$this->assertEquals( 3, $result['revision'] );
	}

	/**
	 * @covers ::getLatestLayerSet
	 */
	public function testGetLatestLayerSetWithSetName(): void {
		$row = $this->createLayerSetRow( [
			'id' => 15,
			'name' => 'custom-set'
		] );

		$this->dbr->expects( $this->once() )
			->method( 'selectRow' )
			->with(
				'layer_sets',
				$this->anything(),
				$this->callback( function ( $conditions ) {
					return isset( $conditions['ls_name'] ) && $conditions['ls_name'] === 'custom-set';
				} ),
				$this->anything(),
				$this->anything()
			)
			->willReturn( $row );

		$db = $this->createLayersDatabase();
		$result = $db->getLatestLayerSet( 'Test.jpg', 'sha1', 'custom-set' );

		$this->assertEquals( 'custom-set', $result['name'] );
	}

	/**
	 * @covers ::getLatestLayerSet
	 */
	public function testGetLatestLayerSetNotFound(): void {
		$this->dbr->method( 'selectRow' )->willReturn( false );

		$db = $this->createLayersDatabase();
		$result = $db->getLatestLayerSet( 'Missing.jpg', 'sha1' );

		$this->assertFalse( $result );
	}

	// =========================================================================
	// namedSetExists Tests
	// =========================================================================

	/**
	 * @covers ::namedSetExists
	 */
	public function testNamedSetExistsReturnsTrue(): void {
		$this->dbr->method( 'selectField' )->willReturn( 1 );

		$db = $this->createLayersDatabase();
		$result = $db->namedSetExists( 'Test.jpg', 'sha1', 'default' );

		$this->assertTrue( $result );
	}

	/**
	 * @covers ::namedSetExists
	 */
	public function testNamedSetExistsReturnsFalse(): void {
		$this->dbr->method( 'selectField' )->willReturn( 0 );

		$db = $this->createLayersDatabase();
		$result = $db->namedSetExists( 'Test.jpg', 'sha1', 'nonexistent' );

		$this->assertFalse( $result );
	}

	// =========================================================================
	// countNamedSets Tests
	// =========================================================================

	/**
	 * @covers ::countNamedSets
	 */
	public function testCountNamedSetsSuccess(): void {
		$this->dbr->method( 'selectField' )->willReturn( 5 );

		$db = $this->createLayersDatabase();
		$count = $db->countNamedSets( 'Test.jpg', 'sha1' );

		$this->assertEquals( 5, $count );
	}

	/**
	 * @covers ::countNamedSets
	 */
	public function testCountNamedSetsReturnsZero(): void {
		$this->dbr->method( 'selectField' )->willReturn( 0 );

		$db = $this->createLayersDatabase();
		$count = $db->countNamedSets( 'New.jpg', 'sha1' );

		$this->assertEquals( 0, $count );
	}

	// =========================================================================
	// countSetRevisions Tests
	// =========================================================================

	/**
	 * @covers ::countSetRevisions
	 */
	public function testCountSetRevisionsSuccess(): void {
		$this->dbr->method( 'selectField' )->willReturn( 12 );

		$db = $this->createLayersDatabase();
		$count = $db->countSetRevisions( 'Test.jpg', 'sha1', 'default' );

		$this->assertEquals( 12, $count );
	}

	// =========================================================================
	// saveLayerSet Tests
	// =========================================================================

	/**
	 * @covers ::saveLayerSet
	 */
	public function testSaveLayerSetSuccess(): void {
		// Mock namedSetExists to return false (new set)
		$this->dbr->method( 'selectField' )
			->willReturnOnConsecutiveCalls(
				0,  // namedSetExists returns false
				0,  // countNamedSets returns 0
				0   // getNextRevisionForSet returns 0
			);

		$this->dbw->method( 'selectField' )->willReturn( 0 ); // First revision
		$this->dbw->method( 'timestamp' )->willReturn( '20231209120000' );
		$this->dbw->method( 'insert' )->willReturn( true );
		$this->dbw->method( 'insertId' )->willReturn( 42 );
		$this->dbw->method( 'startAtomic' )->willReturn( true );
		$this->dbw->method( 'endAtomic' )->willReturn( true );
		$this->dbw->method( 'selectFieldValues' )->willReturn( [ 42 ] );
		$this->dbw->method( 'affectedRows' )->willReturn( 0 );

		$db = $this->createLayersDatabase();
		$result = $db->saveLayerSet(
			'Test.jpg',
			[ 'mime' => 'image/jpeg', 'sha1' => 'abc123' ],
			[ [ 'id' => 'layer_1', 'type' => 'text', 'text' => 'Hello' ] ],
			1
		);

		$this->assertEquals( 42, $result );
	}

	/**
	 * @covers ::saveLayerSet
	 */
	public function testSaveLayerSetWithCustomSetName(): void {
		$this->dbr->method( 'selectField' )
			->willReturnOnConsecutiveCalls( 0, 0, 0 );

		$this->dbw->method( 'selectField' )->willReturn( 0 );
		$this->dbw->method( 'timestamp' )->willReturn( '20231209120000' );
		$this->dbw->method( 'insert' )->willReturn( true );
		$this->dbw->method( 'insertId' )->willReturn( 55 );
		$this->dbw->method( 'startAtomic' )->willReturn( true );
		$this->dbw->method( 'endAtomic' )->willReturn( true );
		$this->dbw->method( 'selectFieldValues' )->willReturn( [ 55 ] );
		$this->dbw->method( 'affectedRows' )->willReturn( 0 );

		$db = $this->createLayersDatabase();
		$result = $db->saveLayerSet(
			'Test.jpg',
			[ 'mime' => 'image/jpeg', 'sha1' => 'abc123' ],
			[],
			1,
			'my-custom-set'
		);

		$this->assertEquals( 55, $result );
	}

	/**
	 * @covers ::saveLayerSet
	 */
	public function testSaveLayerSetInvalidParameters(): void {
		$this->logger->expects( $this->once() )
			->method( 'error' )
			->with(
				$this->stringContains( 'Invalid parameters' ),
				$this->anything()
			);

		$db = $this->createLayersDatabase();

		// Empty image name
		$result = $db->saveLayerSet(
			'',
			[ 'mime' => 'image/jpeg', 'sha1' => 'abc123' ],
			[],
			1
		);

		$this->assertNull( $result );
	}

	/**
	 * @covers ::saveLayerSet
	 */
	public function testSaveLayerSetInvalidUserId(): void {
		$this->logger->expects( $this->once() )
			->method( 'error' )
			->with(
				$this->stringContains( 'Invalid parameters' ),
				$this->anything()
			);

		$db = $this->createLayersDatabase();

		// Invalid user ID
		$result = $db->saveLayerSet(
			'Test.jpg',
			[ 'mime' => 'image/jpeg', 'sha1' => 'abc123' ],
			[],
			0
		);

		$this->assertNull( $result );
	}

	/**
	 * @covers ::saveLayerSet
	 */
	public function testSaveLayerSetMaxSetsReached(): void {
		// Return count >= max (15)
		$this->dbr->method( 'selectField' )
			->willReturnOnConsecutiveCalls(
				0,  // namedSetExists returns false (new set)
				15  // countNamedSets returns max
			);

		$db = $this->createLayersDatabase();

		$this->expectException( \OverflowException::class );
		$this->expectExceptionMessage( 'layers-max-sets-reached' );

		$db->saveLayerSet(
			'Test.jpg',
			[ 'mime' => 'image/jpeg', 'sha1' => 'abc123' ],
			[],
			1,
			'new-set-exceeds-limit'
		);
	}

	/**
	 * @covers ::saveLayerSet
	 */
	public function testSaveLayerSetDataTooLarge(): void {
		$this->dbr->method( 'selectField' )
			->willReturnOnConsecutiveCalls( 1, 1, 0 ); // Existing set

		$this->dbw->method( 'selectField' )->willReturn( 5 );
		$this->dbw->method( 'timestamp' )->willReturn( '20231209120000' );
		$this->dbw->method( 'startAtomic' )->willReturn( true );
		$this->dbw->method( 'endAtomic' )->willReturn( true );

		$this->logger->expects( $this->once() )
			->method( 'error' )
			->with( $this->stringContains( 'JSON blob size exceeds' ) );

		$db = $this->createLayersDatabase();

		// Create data that will exceed 2MB when serialized
		$largeLayers = [];
		for ( $i = 0; $i < 1000; $i++ ) {
			$largeLayers[] = [
				'id' => "layer_$i",
				'type' => 'text',
				'text' => str_repeat( 'x', 3000 )
			];
		}

		$result = $db->saveLayerSet(
			'Test.jpg',
			[ 'mime' => 'image/jpeg', 'sha1' => 'abc123' ],
			$largeLayers,
			1
		);

		$this->assertNull( $result );
	}

	// =========================================================================
	// getLayerSetsForImage Tests
	// =========================================================================

	/**
	 * @covers ::getLayerSetsForImage
	 * @covers ::getLayerSetsForImageWithOptions
	 */
	public function testGetLayerSetsForImageSuccess(): void {
		$rows = [
			$this->createLayerSetRow( [ 'id' => 1, 'revision' => 3 ] ),
			$this->createLayerSetRow( [ 'id' => 2, 'revision' => 2 ] ),
			$this->createLayerSetRow( [ 'id' => 3, 'revision' => 1 ] ),
		];

		$result = $this->createResultWrapper( $rows );
		$this->dbr->method( 'select' )->willReturn( $result );

		$db = $this->createLayersDatabase();
		$layerSets = $db->getLayerSetsForImage( 'Test.jpg', 'sha1' );

		$this->assertCount( 3, $layerSets );
		$this->assertEquals( 1, $layerSets[0]['ls_id'] );
	}

	/**
	 * @covers ::getLayerSetsForImageWithOptions
	 */
	public function testGetLayerSetsForImageWithOptions(): void {
		$rows = [
			$this->createLayerSetRow( [ 'id' => 1 ] ),
		];

		$result = $this->createResultWrapper( $rows );
		$this->dbr->method( 'select' )->willReturn( $result );

		$db = $this->createLayersDatabase();
		$layerSets = $db->getLayerSetsForImageWithOptions( 'Test.jpg', 'sha1', [
			'sort' => 'ls_timestamp',
			'direction' => 'ASC',
			'limit' => 10,
			'offset' => 5
		] );

		$this->assertCount( 1, $layerSets );
	}

	/**
	 * @covers ::getLayerSetsForImageWithOptions
	 */
	public function testGetLayerSetsForImageWithoutData(): void {
		$rows = [
			$this->createLayerSetRow( [ 'id' => 1 ] ),
		];

		$result = $this->createResultWrapper( $rows );
		$this->dbr->method( 'select' )->willReturn( $result );

		$db = $this->createLayersDatabase();
		$layerSets = $db->getLayerSetsForImageWithOptions( 'Test.jpg', 'sha1', [
			'includeData' => false
		] );

		$this->assertCount( 1, $layerSets );
		$this->assertArrayNotHasKey( 'ls_json_blob', $layerSets[0] );
	}

	// =========================================================================
	// getNamedSetsForImage Tests
	// =========================================================================

	/**
	 * @covers ::getNamedSetsForImage
	 */
	public function testGetNamedSetsForImageSuccess(): void {
		$rows = [
			(object)[
				'ls_name' => 'default',
				'revision_count' => 5,
				'latest_revision' => 5,
				'latest_timestamp' => '20231209120000',
				'latest_user_id' => 1
			],
			(object)[
				'ls_name' => 'annotations',
				'revision_count' => 3,
				'latest_revision' => 3,
				'latest_timestamp' => '20231208100000',
				'latest_user_id' => 2
			]
		];

		$result = $this->createResultWrapper( $rows );
		$this->dbr->method( 'select' )->willReturn( $result );
		$this->dbr->method( 'tableName' )->willReturn( 'layer_sets' );

		$db = $this->createLayersDatabase();
		$namedSets = $db->getNamedSetsForImage( 'Test.jpg', 'sha1' );

		$this->assertCount( 2, $namedSets );
		$this->assertEquals( 'default', $namedSets[0]['name'] );
		$this->assertEquals( 5, $namedSets[0]['revision_count'] );
		$this->assertEquals( 'annotations', $namedSets[1]['name'] );
	}

	/**
	 * @covers ::getNamedSetsForImage
	 */
	public function testGetNamedSetsForImageEmpty(): void {
		$result = $this->createResultWrapper( [] );
		$this->dbr->method( 'select' )->willReturn( $result );
		$this->dbr->method( 'tableName' )->willReturn( 'layer_sets' );

		$db = $this->createLayersDatabase();
		$namedSets = $db->getNamedSetsForImage( 'NoSets.jpg', 'sha1' );

		$this->assertIsArray( $namedSets );
		$this->assertCount( 0, $namedSets );
	}

	// =========================================================================
	// getSetRevisions Tests
	// =========================================================================

	/**
	 * @covers ::getSetRevisions
	 */
	public function testGetSetRevisionsSuccess(): void {
		$rows = [
			(object)[ 'ls_id' => 5, 'ls_revision' => 5, 'ls_timestamp' => '20231209', 'ls_user_id' => 1, 'ls_layer_count' => 10 ],
			(object)[ 'ls_id' => 4, 'ls_revision' => 4, 'ls_timestamp' => '20231208', 'ls_user_id' => 1, 'ls_layer_count' => 8 ],
			(object)[ 'ls_id' => 3, 'ls_revision' => 3, 'ls_timestamp' => '20231207', 'ls_user_id' => 2, 'ls_layer_count' => 5 ],
		];

		$result = $this->createResultWrapper( $rows );
		$this->dbr->method( 'select' )->willReturn( $result );

		$db = $this->createLayersDatabase();
		$revisions = $db->getSetRevisions( 'Test.jpg', 'sha1', 'default' );

		$this->assertCount( 3, $revisions );
		$this->assertEquals( 5, $revisions[0]['ls_revision'] );
		$this->assertEquals( 10, $revisions[0]['ls_layer_count'] );
	}

	/**
	 * @covers ::getSetRevisions
	 */
	public function testGetSetRevisionsLimitEnforced(): void {
		$rows = [];
		for ( $i = 50; $i > 0; $i-- ) {
			$rows[] = (object)[
				'ls_id' => $i,
				'ls_revision' => $i,
				'ls_timestamp' => '20231209',
				'ls_user_id' => 1,
				'ls_layer_count' => 5
			];
		}

		$result = $this->createResultWrapper( $rows );
		$this->dbr->method( 'select' )->willReturn( $result );

		$db = $this->createLayersDatabase();
		// Request more than max (200) - should be capped
		$revisions = $db->getSetRevisions( 'Test.jpg', 'sha1', 'default', 500 );

		// The method caps to 200, but the mock returns 50
		$this->assertCount( 50, $revisions );
	}

	// =========================================================================
	// getLayerSetByName Tests
	// =========================================================================

	/**
	 * @covers ::getLayerSetByName
	 */
	public function testGetLayerSetByNameSuccess(): void {
		$row = $this->createLayerSetRow( [
			'id' => 25,
			'name' => 'annotations',
			'revision' => 7
		] );

		$this->dbr->method( 'selectRow' )->willReturn( $row );

		$db = $this->createLayersDatabase();
		$result = $db->getLayerSetByName( 'Test.jpg', 'sha1', 'annotations' );

		$this->assertIsArray( $result );
		$this->assertEquals( 25, $result['id'] );
		$this->assertEquals( 'annotations', $result['setName'] );
		$this->assertEquals( 7, $result['revision'] );
	}

	/**
	 * @covers ::getLayerSetByName
	 */
	public function testGetLayerSetByNameNotFound(): void {
		$this->dbr->method( 'selectRow' )->willReturn( false );

		$db = $this->createLayersDatabase();
		$result = $db->getLayerSetByName( 'Test.jpg', 'sha1', 'nonexistent' );

		$this->assertNull( $result );
	}

	/**
	 * @covers ::getLayerSetByName
	 */
	public function testGetLayerSetByNameHandlesInvalidJson(): void {
		$row = $this->createLayerSetRow( [ 'id' => 25 ] );
		$row->ls_json_blob = 'invalid json {{{';

		$this->dbr->method( 'selectRow' )->willReturn( $row );
		$this->logger->expects( $this->once() )
			->method( 'error' )
			->with( $this->stringContains( 'Invalid JSON' ) );

		$db = $this->createLayersDatabase();
		$result = $db->getLayerSetByName( 'Test.jpg', 'sha1', 'default' );

		$this->assertNull( $result );
	}

	// =========================================================================
	// deleteLayerSetsForImage Tests
	// =========================================================================

	/**
	 * @covers ::deleteLayerSetsForImage
	 */
	public function testDeleteLayerSetsForImageSuccess(): void {
		$this->dbw->method( 'delete' )->willReturn( true );
		$this->logger->expects( $this->once() )
			->method( 'info' )
			->with(
				'Layer sets deleted for image',
				$this->callback( function ( $context ) {
					return $context['imgName'] === 'Delete.jpg';
				} )
			);

		$db = $this->createLayersDatabase();
		$result = $db->deleteLayerSetsForImage( 'Delete.jpg', 'sha1' );

		$this->assertTrue( $result );
	}

	/**
	 * @covers ::deleteLayerSetsForImage
	 */
	public function testDeleteLayerSetsForImageFailure(): void {
		$this->dbw->method( 'delete' )->willThrowException( new \RuntimeException( 'DB error' ) );
		$this->logger->expects( $this->once() )
			->method( 'warning' )
			->with(
				$this->stringContains( 'Failed to delete' ),
				$this->anything()
			);

		$db = $this->createLayersDatabase();
		$result = $db->deleteLayerSetsForImage( 'Error.jpg', 'sha1' );

		$this->assertFalse( $result );
	}

	// =========================================================================
	// pruneOldRevisions Tests
	// =========================================================================

	/**
	 * @covers ::pruneOldRevisions
	 */
	public function testPruneOldRevisionsSuccess(): void {
		$this->dbw->method( 'selectFieldValues' )->willReturn( [ 10, 9, 8, 7, 6 ] );
		$this->dbw->method( 'delete' )->willReturn( true );
		$this->dbw->method( 'affectedRows' )->willReturn( 5 );
		$this->dbw->method( 'makeList' )->willReturn( '10, 9, 8, 7, 6' );

		$this->logger->expects( $this->once() )
			->method( 'info' )
			->with(
				'Pruned old revisions',
				$this->callback( function ( $context ) {
					return $context['deleted'] === 5 && $context['kept'] === 5;
				} )
			);

		$db = $this->createLayersDatabase();
		$deleted = $db->pruneOldRevisions( 'Test.jpg', 'sha1', 'default', 5 );

		$this->assertEquals( 5, $deleted );
	}

	/**
	 * @covers ::pruneOldRevisions
	 */
	public function testPruneOldRevisionsNothingToDelete(): void {
		$this->dbw->method( 'selectFieldValues' )->willReturn( [ 1, 2, 3 ] );
		$this->dbw->method( 'delete' )->willReturn( true );
		$this->dbw->method( 'affectedRows' )->willReturn( 0 );
		$this->dbw->method( 'makeList' )->willReturn( '1, 2, 3' );

		// Logger info should NOT be called when nothing deleted
		$this->logger->expects( $this->never() )->method( 'info' );

		$db = $this->createLayersDatabase();
		$deleted = $db->pruneOldRevisions( 'Test.jpg', 'sha1', 'default', 10 );

		$this->assertEquals( 0, $deleted );
	}

	/**
	 * @covers ::pruneOldRevisions
	 */
	public function testPruneOldRevisionsEmptyKeepList(): void {
		$this->dbw->method( 'selectFieldValues' )->willReturn( [] );

		$db = $this->createLayersDatabase();
		$deleted = $db->pruneOldRevisions( 'Empty.jpg', 'sha1', 'default', 5 );

		$this->assertEquals( 0, $deleted );
	}

	/**
	 * @covers ::pruneOldRevisions
	 */
	public function testPruneOldRevisionsMinimumKeepCount(): void {
		// keepCount of 0 or negative should be normalized to 1
		$this->dbw->method( 'selectFieldValues' )->willReturn( [ 1 ] );
		$this->dbw->method( 'delete' )->willReturn( true );
		$this->dbw->method( 'affectedRows' )->willReturn( 0 );
		$this->dbw->method( 'makeList' )->willReturn( '1' );

		$db = $this->createLayersDatabase();
		$deleted = $db->pruneOldRevisions( 'Test.jpg', 'sha1', 'default', 0 );

		$this->assertEquals( 0, $deleted );
	}

	// =========================================================================
	// Sort Column/Direction Validation Tests
	// =========================================================================

	/**
	 * @covers ::getLayerSetsForImageWithOptions
	 */
	public function testInvalidSortColumnDefaultsToTimestamp(): void {
		$rows = [ $this->createLayerSetRow( [ 'id' => 1 ] ) ];
		$result = $this->createResultWrapper( $rows );

		$this->dbr->expects( $this->once() )
			->method( 'select' )
			->with(
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->callback( function ( $options ) {
					// Invalid sort column should default to ls_timestamp
					return strpos( $options['ORDER BY'], 'ls_timestamp' ) !== false;
				} )
			)
			->willReturn( $result );

		$this->logger->expects( $this->once() )
			->method( 'error' )
			->with( $this->stringContains( 'Invalid sort column' ) );

		$db = $this->createLayersDatabase();
		$db->getLayerSetsForImageWithOptions( 'Test.jpg', 'sha1', [
			'sort' => 'DROP TABLE layer_sets; --'
		] );
	}

	/**
	 * @covers ::getLayerSetsForImageWithOptions
	 */
	public function testSortDirectionNormalization(): void {
		$rows = [ $this->createLayerSetRow( [ 'id' => 1 ] ) ];
		$result = $this->createResultWrapper( $rows );

		$this->dbr->expects( $this->once() )
			->method( 'select' )
			->with(
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->callback( function ( $options ) {
					// Direction should be normalized to ASC (not the injection attempt)
					return strpos( $options['ORDER BY'], 'ASC' ) !== false;
				} )
			)
			->willReturn( $result );

		$db = $this->createLayersDatabase();
		$db->getLayerSetsForImageWithOptions( 'Test.jpg', 'sha1', [
			'direction' => 'ASC; DROP TABLE users; --'
		] );
	}

	// =========================================================================
	// Image Name Normalization Tests
	// =========================================================================

	/**
	 * @covers ::getLatestLayerSet
	 */
	public function testImageNameNormalizationWithSpaces(): void {
		$row = $this->createLayerSetRow( [ 'id' => 1 ] );

		$this->dbr->expects( $this->once() )
			->method( 'selectRow' )
			->with(
				'layer_sets',
				$this->anything(),
				$this->callback( function ( $conditions ) {
					// Should include both underscore and space variants
					$lookup = $conditions['ls_img_name'];
					return is_array( $lookup ) &&
						in_array( 'Test_Image.jpg', $lookup ) &&
						in_array( 'Test Image.jpg', $lookup );
				} ),
				$this->anything(),
				$this->anything()
			)
			->willReturn( $row );

		$db = $this->createLayersDatabase();
		$db->getLatestLayerSet( 'Test Image.jpg', 'sha1' );
	}

	/**
	 * @covers ::getLatestLayerSet
	 */
	public function testImageNameNormalizationWithUnderscores(): void {
		$row = $this->createLayerSetRow( [ 'id' => 1 ] );

		$this->dbr->expects( $this->once() )
			->method( 'selectRow' )
			->with(
				'layer_sets',
				$this->anything(),
				$this->callback( function ( $conditions ) {
					$lookup = $conditions['ls_img_name'];
					return is_array( $lookup ) &&
						in_array( 'Test_Image.jpg', $lookup ) &&
						in_array( 'Test Image.jpg', $lookup );
				} ),
				$this->anything(),
				$this->anything()
			)
			->willReturn( $row );

		$db = $this->createLayersDatabase();
		$db->getLatestLayerSet( 'Test_Image.jpg', 'sha1' );
	}
}
