<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Database;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Database\LayersSchemaManager;
use PHPUnit\Framework\MockObject\MockObject;
use Psr\Log\LoggerInterface;
use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\IResultWrapper;
use Wikimedia\Rdbms\LoadBalancer;
use Wikimedia\Rdbms\Subquery;

/**
 * Tests for slide listing functionality in LayersDatabase.
 *
 * @coversDefaultClass \MediaWiki\Extension\Layers\Database\LayersDatabase
 * @group Layers
 */
class SlideListingTest extends \MediaWikiUnitTestCase {

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
			'LayersMaxBytes' => 2097152,
			'LayersMaxLayerCount' => 100,
			'LayersMaxNamedSets' => 15,
			'LayersMaxRevisionsPerSet' => 25,
		] );

		$this->loadBalancer->method( 'getConnection' )
			->willReturnCallback( function ( $mode ) {
				return $mode === DB_PRIMARY ? $this->dbw : $this->dbr;
			} );
	}

	private function createLayersDatabase(): LayersDatabase {
		return new LayersDatabase(
			$this->loadBalancer,
			$this->config,
			$this->logger,
			$this->schemaManager
		);
	}

	/**
	 * @covers ::countSlides
	 */
	public function testCountSlidesReturnsZeroWhenNoSlides(): void {
		$this->dbr->method( 'addQuotes' )
			->willReturnCallback( static function ( $value ) {
				return "'" . addslashes( $value ) . "'";
			} );

		$this->dbr->expects( $this->once() )
			->method( 'selectField' )
			->with(
				'layer_sets',
				'COUNT(DISTINCT ls_img_name)',
				$this->callback( static function ( $conditions ) {
					return isset( $conditions['ls_img_sha1'] ) && $conditions['ls_img_sha1'] === 'slide';
				} ),
				$this->anything()
			)
			->willReturn( 0 );

		$db = $this->createLayersDatabase();
		$count = $db->countSlides();

		$this->assertSame( 0, $count );
	}

	/**
	 * @covers ::countSlides
	 */
	public function testCountSlidesReturnsCorrectCount(): void {
		$this->dbr->method( 'addQuotes' )
			->willReturnCallback( static function ( $value ) {
				return "'" . addslashes( $value ) . "'";
			} );

		$this->dbr->expects( $this->once() )
			->method( 'selectField' )
			->willReturn( 42 );

		$db = $this->createLayersDatabase();
		$count = $db->countSlides();

		$this->assertSame( 42, $count );
	}

	/**
	 * @covers ::countSlides
	 */
	public function testCountSlidesWithPrefixFilter(): void {
		$this->dbr->method( 'addQuotes' )
			->willReturnCallback( static function ( $value ) {
				return "'" . addslashes( $value ) . "'";
			} );

		$this->dbr->expects( $this->once() )
			->method( 'selectField' )
			->with(
				'layer_sets',
				'COUNT(DISTINCT ls_img_name)',
				$this->callback( static function ( $conditions ) {
					// Check that prefix filter is applied
					return isset( $conditions['ls_img_sha1'] ) &&
						$conditions['ls_img_sha1'] === 'slide' &&
						isset( $conditions[0] ) &&
						strpos( $conditions[0], 'Slide:Process' ) !== false;
				} ),
				$this->anything()
			)
			->willReturn( 5 );

		$db = $this->createLayersDatabase();
		$count = $db->countSlides( 'Process' );

		$this->assertSame( 5, $count );
	}

	/**
	 * @covers ::listSlides
	 */
	public function testListSlidesReturnsEmptyArrayWhenNoSlides(): void {
		$emptyResult = $this->createMock( IResultWrapper::class );
		$emptyResult->method( 'current' )->willReturn( false );
		$emptyResult->method( 'valid' )->willReturn( false );

		$this->dbr->method( 'addQuotes' )
			->willReturnCallback( static function ( $value ) {
				return "'" . addslashes( $value ) . "'";
			} );

		$this->dbr->method( 'buildSelectSubquery' )
			->willReturn( $this->createMock( Subquery::class ) );

		$this->dbr->method( 'select' )
			->willReturn( $emptyResult );

		$db = $this->createLayersDatabase();
		$slides = $db->listSlides();

		$this->assertIsArray( $slides );
		$this->assertSame( [], $slides );
	}

	/**
	 * @covers ::listSlides
	 */
	public function testListSlidesReturnsSlideData(): void {
		$jsonData = json_encode( [
			'schema' => 2,
			'isSlide' => true,
			'canvasWidth' => 1200,
			'canvasHeight' => 800,
			'backgroundColor' => '#f0f0f0',
			'layers' => [ [ 'id' => 'layer1' ], [ 'id' => 'layer2' ] ]
		] );

		$slideRow = (object)[
			'slide_name' => 'Slide:TestSlide',
			'revision_count' => 3,
			'first_timestamp' => '20260120100000',
			'latest_timestamp' => '20260120143000',
			'ls_json_blob' => $jsonData,
			'ls_user_id' => 2,
			'ls_layer_count' => 2,
			'ls_revision' => 3
		];

		$firstRevisionRow = (object)[
			'ls_user_id' => 1
		];

		$mockResult = $this->createMock( IResultWrapper::class );
		$mockResult->method( 'rewind' );
		$mockResult->method( 'valid' )
			->willReturnOnConsecutiveCalls( true, false );
		$mockResult->method( 'current' )
			->willReturn( $slideRow );

		$this->dbr->method( 'addQuotes' )
			->willReturnCallback( static function ( $value ) {
				return "'" . addslashes( $value ) . "'";
			} );

		$this->dbr->method( 'buildSelectSubquery' )
			->willReturn( $this->createMock( Subquery::class ) );

		$this->dbr->method( 'select' )
			->willReturn( $mockResult );

		$this->dbr->method( 'selectRow' )
			->willReturn( $firstRevisionRow );

		$db = $this->createLayersDatabase();
		$slides = $db->listSlides();

		$this->assertCount( 1, $slides );
		$slide = $slides[0];

		$this->assertSame( 'TestSlide', $slide['name'] );
		$this->assertSame( 1200, $slide['canvasWidth'] );
		$this->assertSame( 800, $slide['canvasHeight'] );
		$this->assertSame( '#f0f0f0', $slide['backgroundColor'] );
		$this->assertSame( 2, $slide['layerCount'] );
		$this->assertSame( 3, $slide['revisionCount'] );
		$this->assertSame( 1, $slide['createdById'] );
		$this->assertSame( 2, $slide['modifiedById'] );
	}

	/**
	 * @covers ::listSlides
	 */
	public function testListSlidesRespectsPagination(): void {
		$emptyResult = $this->createMock( IResultWrapper::class );
		$emptyResult->method( 'valid' )->willReturn( false );

		$this->dbr->method( 'addQuotes' )
			->willReturnCallback( static function ( $value ) {
				return "'" . addslashes( $value ) . "'";
			} );

		$this->dbr->method( 'buildSelectSubquery' )
			->willReturn( $this->createMock( Subquery::class ) );

		$this->dbr->expects( $this->once() )
			->method( 'select' )
			->with(
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->callback( static function ( $options ) {
					return isset( $options['LIMIT'] ) && $options['LIMIT'] === 10 &&
						isset( $options['OFFSET'] ) && $options['OFFSET'] === 20;
				} )
			)
			->willReturn( $emptyResult );

		$db = $this->createLayersDatabase();
		$db->listSlides( '', 10, 20 );
	}

	/**
	 * @covers ::listSlides
	 */
	public function testListSlidesSortsByName(): void {
		$emptyResult = $this->createMock( IResultWrapper::class );
		$emptyResult->method( 'valid' )->willReturn( false );

		$this->dbr->method( 'addQuotes' )
			->willReturnCallback( static function ( $value ) {
				return "'" . addslashes( $value ) . "'";
			} );

		$this->dbr->method( 'buildSelectSubquery' )
			->willReturn( $this->createMock( Subquery::class ) );

		$this->dbr->expects( $this->once() )
			->method( 'select' )
			->with(
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->callback( static function ( $options ) {
					return isset( $options['ORDER BY'] ) &&
						strpos( $options['ORDER BY'], 'ls_img_name' ) !== false;
				} )
			)
			->willReturn( $emptyResult );

		$db = $this->createLayersDatabase();
		$db->listSlides( '', 50, 0, 'name' );
	}

	/**
	 * @covers ::listSlides
	 */
	public function testListSlidesSortsByModified(): void {
		$emptyResult = $this->createMock( IResultWrapper::class );
		$emptyResult->method( 'valid' )->willReturn( false );

		$this->dbr->method( 'addQuotes' )
			->willReturnCallback( static function ( $value ) {
				return "'" . addslashes( $value ) . "'";
			} );

		$this->dbr->method( 'buildSelectSubquery' )
			->willReturn( $this->createMock( Subquery::class ) );

		$this->dbr->expects( $this->once() )
			->method( 'select' )
			->with(
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->anything(),
				$this->callback( static function ( $options ) {
					return isset( $options['ORDER BY'] ) &&
						strpos( $options['ORDER BY'], 'latest_timestamp' ) !== false;
				} )
			)
			->willReturn( $emptyResult );

		$db = $this->createLayersDatabase();
		$db->listSlides( '', 50, 0, 'modified' );
	}

	/**
	 * @covers ::listSlides
	 */
	public function testListSlidesHandlesInvalidJson(): void {
		$slideRow = (object)[
			'slide_name' => 'Slide:BadJson',
			'revision_count' => 1,
			'first_timestamp' => '20260120100000',
			'latest_timestamp' => '20260120100000',
			'ls_json_blob' => 'not valid json',
			'ls_user_id' => 1,
			'ls_layer_count' => 0,
			'ls_revision' => 1
		];

		$mockResult = $this->createMock( IResultWrapper::class );
		$mockResult->method( 'valid' )
			->willReturnOnConsecutiveCalls( true, false );
		$mockResult->method( 'current' )
			->willReturn( $slideRow );

		$this->dbr->method( 'addQuotes' )
			->willReturnCallback( static function ( $value ) {
				return "'" . addslashes( $value ) . "'";
			} );

		$this->dbr->method( 'buildSelectSubquery' )
			->willReturn( $this->createMock( Subquery::class ) );

		$this->dbr->method( 'select' )
			->willReturn( $mockResult );

		$this->dbr->method( 'selectRow' )
			->willReturn( null );

		// Expect error to be logged
		$this->logger->expects( $this->once() )
			->method( 'error' );

		$db = $this->createLayersDatabase();
		$slides = $db->listSlides();

		// Should still return a result with defaults
		$this->assertCount( 1, $slides );
		$this->assertSame( 800, $slides[0]['canvasWidth'] );
		$this->assertSame( 600, $slides[0]['canvasHeight'] );
		$this->assertSame( '#ffffff', $slides[0]['backgroundColor'] );
	}
}
