<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Database;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Database\LayersSchemaManager;
use MediaWiki\Extension\Layers\LayersConstants;
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

		$this->loadBalancer->method( 'getPrimaryDatabase' )
			->willReturn( $this->dbw );
		$this->loadBalancer->method( 'getReplicaDatabase' )
			->willReturn( $this->dbr );
		$this->dbr->method( 'anyString' )->willReturn( '%' );
		$this->dbr->method( 'buildLike' )
			->willReturnCallback( static function ( ...$args ) {
				return 'LIKE ' . implode( '', array_map( static function ( $value ) {
					return is_scalar( $value ) ? (string)$value : '';
				}, $args ) );
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
	 * @param array $rows
	 * @return IResultWrapper|MockObject
	 */
	private function createResultWrapper( array $rows ): MockObject {
		$result = $this->createMock( IResultWrapper::class );
		$iterator = new \ArrayIterator( $rows );

		$result->method( 'rewind' )->willReturnCallback( static function () use ( $iterator ) {
			$iterator->rewind();
		} );
		$result->method( 'valid' )->willReturnCallback( static function () use ( $iterator ) {
			return $iterator->valid();
		} );
		$result->method( 'current' )->willReturnCallback( static function () use ( $iterator ) {
			return $iterator->current();
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
	 * @covers ::countSlides
	 */
	public function testCountSlidesReturnsZeroWhenNoSlides(): void {
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
		$emptyResult = $this->createResultWrapper( [] );

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

		$revisionCountRow = (object)[
			'ls_img_name' => 'Slide:TestSlide',
			'revision_count' => 3
		];

		$firstTimestampRow = (object)[
			'ls_img_name' => 'Slide:TestSlide',
			'first_timestamp' => '20260120100000'
		];

		$firstRevisionRow = (object)[
			'ls_img_name' => 'Slide:TestSlide',
			'ls_user_id' => 1
		];

		$mockResult = $this->createResultWrapper( [ $slideRow ] );
		$revisionCountResult = $this->createResultWrapper( [ $revisionCountRow ] );
		$firstTimestampResult = $this->createResultWrapper( [ $firstTimestampRow ] );
		$firstRevisionResult = $this->createResultWrapper( [ $firstRevisionRow ] );

		$this->dbr->method( 'buildSelectSubquery' )
			->willReturn( $this->createMock( Subquery::class ) );

		$this->dbr->method( 'select' )
			->willReturnOnConsecutiveCalls(
				$mockResult,
				$revisionCountResult,
				$firstTimestampResult,
				$firstRevisionResult
			);

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
		$emptyResult = $this->createResultWrapper( [] );

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
		$emptyResult = $this->createResultWrapper( [] );

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
						strpos( $options['ORDER BY'], 'slide_name ASC' ) !== false;
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
		$emptyResult = $this->createResultWrapper( [] );

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
			'latest_timestamp' => '20260120100000',
			'ls_json_blob' => 'not valid json',
			'ls_user_id' => 1,
			'ls_layer_count' => 0,
			'ls_revision' => 1
		];

		$revisionCountRow = (object)[
			'ls_img_name' => 'Slide:BadJson',
			'revision_count' => 1
		];

		$firstTimestampRow = (object)[
			'ls_img_name' => 'Slide:BadJson',
			'first_timestamp' => '20260120100000'
		];

		$firstRevisionRow = (object)[
			'ls_img_name' => 'Slide:BadJson',
			'ls_user_id' => 1
		];

		$mockResult = $this->createResultWrapper( [ $slideRow ] );
		$revisionCountResult = $this->createResultWrapper( [ $revisionCountRow ] );
		$firstTimestampResult = $this->createResultWrapper( [ $firstTimestampRow ] );
		$firstRevisionResult = $this->createResultWrapper( [ $firstRevisionRow ] );

		$this->dbr->method( 'buildSelectSubquery' )
			->willReturn( $this->createMock( Subquery::class ) );

		$this->dbr->method( 'select' )
			->willReturnOnConsecutiveCalls(
				$mockResult,
				$revisionCountResult,
				$firstTimestampResult,
				$firstRevisionResult
			);

		$db = $this->createLayersDatabase();
		$slides = $db->listSlides();

		// Should still return a result with defaults
		$this->assertCount( 1, $slides );
		$this->assertSame( 800, $slides[0]['canvasWidth'] );
		$this->assertSame( 600, $slides[0]['canvasHeight'] );
		$this->assertSame( '#ffffff', $slides[0]['backgroundColor'] );
	}

	/**
	 * @covers ::listSlides
	 */
	public function testListSlidesTruncatesVeryLongPrefix(): void {
		$emptyResult = $this->createResultWrapper( [] );

		// Create a very long prefix (300 characters)
		$longPrefix = str_repeat( 'a', 300 );
		$expectedTruncatedPrefix = str_repeat( 'a', 200 );

		// Capture the LIKE condition to verify prefix was truncated
		$capturedLikePrefix = null;
		$this->dbr->method( 'buildLike' )
			->willReturnCallback( static function ( ...$args ) use ( &$capturedLikePrefix ) {
				// The first arg should be SLIDE_PREFIX + truncated prefix
				if ( count( $args ) > 0 ) {
					$capturedLikePrefix = $args[0];
				}
				return "LIKE 'slide:%'";
			} );

		$this->dbr->method( 'anyString' )->willReturn( '%' );

		$subqueryMock = $this->createMock( Subquery::class );
		$subqueryMock->method( '__toString' )->willReturn( '(subquery)' );
		$this->dbr->method( 'buildSelectSubquery' )
			->willReturn( $subqueryMock );

		$this->dbr->method( 'select' )->willReturn( $emptyResult );

		$db = $this->createLayersDatabase();
		$db->listSlides( $longPrefix );

		// Verify the prefix was truncated to 200 characters
		$this->assertNotNull( $capturedLikePrefix, 'buildLike should have been called with a prefix' );
		$expectedFullPrefix = LayersConstants::SLIDE_PREFIX . $expectedTruncatedPrefix;
		$this->assertSame( $expectedFullPrefix, $capturedLikePrefix );
	}
}
