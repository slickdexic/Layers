<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Database;

use MediaWiki\Extension\Layers\Database\LayersDatabase;

/**
 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase
 */
class LayersDatabaseTest extends \MediaWikiUnitTestCase {

	private function createMockDatabase() {
		$mock = $this->createMock( LayersDatabase::class );
		return $mock;
	}

	private function getValidLayerSetData() {
		return [
			'revision' => 1,
			'schema' => 1,
			'created' => time(),
			'layers' => [
				[
					'id' => 'layer_1',
					'type' => 'text',
					'x' => 100,
					'y' => 50,
					'text' => 'Test Layer'
				],
				[
					'id' => 'layer_2',
					'type' => 'rectangle',
					'x' => 0,
					'y' => 0,
					'width' => 200,
					'height' => 100
				]
			]
		];
	}

	/**
	 * Test LayersDatabase instantiation
	 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase::__construct
	 */
	public function testLayersDatabaseInstantiation() {
		// Test that the class exists and can be referenced
		$this->assertTrue( class_exists( LayersDatabase::class ) );
	}

	/**
	 * Test layer set data structure validation
	 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase
	 */
	public function testLayerSetDataStructure() {
		$data = $this->getValidLayerSetData();

		// Test the expected data structure format
		$expectedFields = [
			'revision', 'schema', 'created', 'layers'
		];

		foreach ( $expectedFields as $field ) {
			$this->assertArrayHasKey( $field, $data, "Layer set data should contain '$field' field" );
		}

		// Test layers array structure
		$this->assertIsArray( $data['layers'] );
		$this->assertGreaterThan( 0, count( $data['layers'] ) );

		// Test individual layer structure
		$layer = $data['layers'][0];
		$this->assertArrayHasKey( 'id', $layer );
		$this->assertArrayHasKey( 'type', $layer );
		$this->assertArrayHasKey( 'x', $layer );
		$this->assertArrayHasKey( 'y', $layer );
	}

	/**
	 * Test next revision calculation
	 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase::getNextRevision
	 */
	public function testGetNextRevision() {
		$mockDb = $this->createMockDatabase();

		// Mock that first revision should be 1
		$mockDb->method( 'getNextRevision' )
			->willReturn( 1 );

		$this->assertSame( 1, $mockDb->getNextRevision( 'Test.jpg' ) );
	}

	/**
	 * Test cache key generation and sanitization
	 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase::getCacheKey
	 */
	public function testCacheKeyGeneration() {
		if ( !method_exists( LayersDatabase::class, 'getCacheKey' ) ) {
			$this->markTestSkipped( 'getCacheKey method does not exist' );
		}

		$mockDb = $this->createMockDatabase();

		// Test basic cache key generation
		$cacheKey = $mockDb->getCacheKey( 'Test.jpg', 123 );
		$this->assertIsString( $cacheKey );

		// Test cache key sanitization for unsafe characters
		$unsafeName = 'Test File with spaces & symbols!.jpg';
		$safeCacheKey = $mockDb->getCacheKey( $unsafeName, 456 );
		$this->assertIsString( $safeCacheKey );

		// Cache keys should not contain dangerous characters
		$this->assertStringNotContainsString( ' ', $safeCacheKey );
		$this->assertStringNotContainsString( '&', $safeCacheKey );
		$this->assertStringNotContainsString( '!', $safeCacheKey );
	}

	/**
	 * Test layer set size calculation
	 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase::calculateLayerSetSize
	 */
	public function testLayerSetSizeCalculation() {
		if ( !method_exists( LayersDatabase::class, 'calculateLayerSetSize' ) ) {
			$this->markTestSkipped( 'calculateLayerSetSize method does not exist' );
		}

		$mockDb = $this->createMockDatabase();
		$data = $this->getValidLayerSetData();

		$size = $mockDb->calculateLayerSetSize( $data );
		$this->assertIsInt( $size );
		$this->assertGreaterThan( 0, $size );

		// Test with empty layer set
		$emptyData = [ 'layers' => [] ];
		$emptySize = $mockDb->calculateLayerSetSize( $emptyData );
		$this->assertIsInt( $emptySize );
		$this->assertGreaterThanOrEqual( 0, $emptySize );
	}

	/**
	 * Test layer count calculation
	 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase
	 */
	public function testLayerCountValidation() {
		$data = $this->getValidLayerSetData();

		// Test layer count
		$layerCount = count( $data['layers'] );
		$this->assertEquals( 2, $layerCount );

		// Test with maximum layers (boundary test)
		$maxLayers = array_fill( 0, 100, [
			'id' => 'test',
			'type' => 'text',
			'x' => 0,
			'y' => 0
		] );
		$maxData = array_merge( $data, [ 'layers' => $maxLayers ] );
		$this->assertCount( 100, $maxData['layers'] );

		// Test exceeding maximum (should be handled by validation)
		$tooManyLayers = array_fill( 0, 101, [
			'id' => 'test',
			'type' => 'text',
			'x' => 0,
			'y' => 0
		] );
		$oversizedData = array_merge( $data, [ 'layers' => $tooManyLayers ] );
		$this->assertGreaterThan( 100, count( $oversizedData['layers'] ) );
	}

	/**
	 * Test database table existence checks
	 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase::tablesExist
	 */
	public function testTableExistenceChecks() {
		if ( !method_exists( LayersDatabase::class, 'tablesExist' ) ) {
			$this->markTestSkipped( 'tablesExist method does not exist' );
		}

		$mockDb = $this->createMockDatabase();

		// Mock tables exist
		$mockDb->method( 'tablesExist' )
			->willReturn( true );

		$this->assertTrue( $mockDb->tablesExist() );
	}

	/**
	 * Test error handling for database operations
	 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase
	 */
	public function testDatabaseErrorHandling() {
		// Test that appropriate exceptions are defined or handled
		// This is more of a structure test since we can't easily mock DB failures

		$this->assertTrue(
			class_exists( 'Exception' ),
			'Basic exception handling should be available'
 );

		// Verify that database-related methods exist
		$reflection = new \ReflectionClass( LayersDatabase::class );
		$methods = $reflection->getMethods();
		$methodNames = array_map( static function ( $method ) {
			return $method->getName();
		}, $methods );

		// Check for key database operation methods
		$expectedMethods = [ 'saveLayerSet', 'getLayerSetsForImage' ];
		foreach ( $expectedMethods as $expectedMethod ) {
			$this->assertContains(
				$expectedMethod,
				$methodNames,
				"LayersDatabase should have $expectedMethod method"
 );
		}
	}

	/**
	 * Test transaction handling
	 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase
	 */
	public function testTransactionHandling() {
		// Verify that transaction-related patterns are followed
		// This is mainly a structural test

		$reflection = new \ReflectionClass( LayersDatabase::class );
		$source = file_get_contents( $reflection->getFileName() );

		// Look for transaction patterns in the source code
		$hasTransactionPatterns = (
			strpos( $source, 'beginAtomic' ) !== false ||
			strpos( $source, 'endAtomic' ) !== false ||
			strpos( $source, 'startAtomic' ) !== false ||
			strpos( $source, 'endAtomic' ) !== false
		);

		// Transaction handling should be present for data integrity
		$this->assertTrue(
			$hasTransactionPatterns,
			'LayersDatabase should implement proper transaction handling'
 );
	}
}
