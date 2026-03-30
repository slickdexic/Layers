<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Database;

use MediaWiki\Extension\Layers\Database\LayersSchemaManager;
use MediaWiki\Installer\DatabaseUpdater;
use PHPUnit\Framework\MockObject\MockObject;
use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\IResultWrapper;

/**
 * @coversDefaultClass \MediaWiki\Extension\Layers\Database\LayersSchemaManager
 * @group Layers
 */
class LayersSchemaManagerTest extends \MediaWikiUnitTestCase {

	/** @var IDatabase|MockObject */
	private $dbw;

	/** @var DatabaseUpdater|MockObject */
	private $updater;

	protected function setUp(): void {
		parent::setUp();

		$this->dbw = $this->createMock( IDatabase::class );
		$this->updater = $this->createMock( DatabaseUpdater::class );
		$this->updater->method( 'getDB' )->willReturn( $this->dbw );
		$this->dbw->method( 'anyString' )->willReturn( '%' );
		$this->dbw->method( 'buildLike' )->willReturn( "LIKE '% %'" );
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
	 * @covers ::normalizeLegacyLayerSetImageNames
	 */
	public function testNormalizeLegacyLayerSetImageNamesRenamesLegacyRowsWithoutRevisionConflicts(): void {
		$legacyRows = $this->createResultWrapper( [
			(object)[
				'ls_img_name' => 'Legacy Image.jpg',
				'ls_img_sha1' => 'sha1',
				'ls_name' => 'default'
			]
		] );

		$groupRows = $this->createResultWrapper( [
			(object)[
				'ls_id' => 10,
				'ls_img_name' => 'Legacy Image.jpg',
				'ls_revision' => 3,
				'ls_timestamp' => '20240301010101'
			]
		] );

		$this->dbw->expects( $this->exactly( 2 ) )
			->method( 'select' )
			->willReturnOnConsecutiveCalls( $legacyRows, $groupRows );
		$this->dbw->expects( $this->once() )->method( 'startAtomic' );
		$this->dbw->expects( $this->once() )->method( 'endAtomic' );
		$this->dbw->expects( $this->once() )
			->method( 'update' )
			->with(
				'layer_sets',
				[ 'ls_img_name' => 'Legacy_Image.jpg' ],
				[ 'ls_id' => 10 ],
				$this->anything()
			);

		$this->assertTrue( LayersSchemaManager::normalizeLegacyLayerSetImageNames( $this->updater ) );
	}

	/**
	 * @covers ::normalizeLegacyLayerSetImageNames
	 */
	public function testNormalizeLegacyLayerSetImageNamesRenumbersConflictingGroups(): void {
		$legacyRows = $this->createResultWrapper( [
			(object)[
				'ls_img_name' => 'Legacy Image.jpg',
				'ls_img_sha1' => 'sha1',
				'ls_name' => 'default'
			]
		] );

		$groupRows = $this->createResultWrapper( [
			(object)[
				'ls_id' => 10,
				'ls_img_name' => 'Legacy Image.jpg',
				'ls_revision' => 1,
				'ls_timestamp' => '20240301010101'
			],
			(object)[
				'ls_id' => 11,
				'ls_img_name' => 'Legacy_Image.jpg',
				'ls_revision' => 1,
				'ls_timestamp' => '20240302010101'
			],
			(object)[
				'ls_id' => 12,
				'ls_img_name' => 'Legacy Image.jpg',
				'ls_revision' => 2,
				'ls_timestamp' => '20240303010101'
			]
		] );

		$this->dbw->expects( $this->exactly( 2 ) )
			->method( 'select' )
			->willReturnOnConsecutiveCalls( $legacyRows, $groupRows );
		$this->dbw->expects( $this->once() )->method( 'startAtomic' );
		$this->dbw->expects( $this->once() )->method( 'endAtomic' );

		$updateCalls = [];
		$this->dbw->expects( $this->exactly( 6 ) )
			->method( 'update' )
			->willReturnCallback( static function ( $table, $set, $conds ) use ( &$updateCalls ) {
				$updateCalls[] = [
					'table' => $table,
					'set' => $set,
					'conds' => $conds,
				];
				return true;
			} );

		$this->assertTrue( LayersSchemaManager::normalizeLegacyLayerSetImageNames( $this->updater ) );

		$this->assertSame(
			[
				[
					'table' => 'layer_sets',
					'set' => [
						'ls_img_name' => 'Legacy_Image.jpg',
						'ls_revision' => 3,
					],
					'conds' => [ 'ls_id' => 10 ],
				],
				[
					'table' => 'layer_sets',
					'set' => [
						'ls_img_name' => 'Legacy_Image.jpg',
						'ls_revision' => 4,
					],
					'conds' => [ 'ls_id' => 11 ],
				],
				[
					'table' => 'layer_sets',
					'set' => [
						'ls_img_name' => 'Legacy_Image.jpg',
						'ls_revision' => 5,
					],
					'conds' => [ 'ls_id' => 12 ],
				],
				[
					'table' => 'layer_sets',
					'set' => [ 'ls_revision' => 1 ],
					'conds' => [ 'ls_id' => 10 ],
				],
				[
					'table' => 'layer_sets',
					'set' => [ 'ls_revision' => 2 ],
					'conds' => [ 'ls_id' => 11 ],
				],
				[
					'table' => 'layer_sets',
					'set' => [ 'ls_revision' => 3 ],
					'conds' => [ 'ls_id' => 12 ],
				],
			],
			$updateCalls
		);
	}
}
