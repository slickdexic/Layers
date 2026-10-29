<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Database\LayersSchemaManager;
use MediaWiki\Installer\DatabaseUpdater;
use Wikimedia\Rdbms\IDatabase;
use Wikimedia\Rdbms\IResultWrapper;

/**
 * @covers \MediaWiki\Extension\Layers\Database\LayersSchemaManager::widenFileIdentifier
 * @covers \MediaWiki\Extension\Layers\Database\LayersSchemaManager::onLoadExtensionSchemaUpdates
 * @group Database
 */
class ForeignIdentifierSchemaUpgradeTest extends \MediaWikiIntegrationTestCase {
	public function testSqliteNeedsNoSchemaChange(): void {
		$db = $this->createMock( IDatabase::class );
		$db->method( 'getType' )->willReturn( 'sqlite' );
		$db->expects( $this->never() )->method( 'query' );
		$updater = $this->createMock( DatabaseUpdater::class );
		$updater->method( 'getDB' )->willReturn( $db );
		$this->assertTrue( LayersSchemaManager::widenFileIdentifier( $updater ) );
	}

	public function testUnexpectedColumnTypeIsNotChanged(): void {
		$result = $this->createMock( IResultWrapper::class );
		$result->method( 'fetchObject' )->willReturn( (object)[ 'Type' => 'int' ] );
		$db = $this->createMock( IDatabase::class );
		$db->method( 'getType' )->willReturn( 'mysql' );
		$db->method( 'tableName' )->willReturn( 'layer_sets' );
		$db->expects( $this->once() )->method( 'query' )->willReturn( $result );
		$updater = $this->createMock( DatabaseUpdater::class );
		$updater->method( 'getDB' )->willReturn( $db );
		$this->expectException( \RuntimeException::class );
		LayersSchemaManager::widenFileIdentifier( $updater );
	}

	public function testExistingTextColumnIsNotChanged(): void {
		$result = $this->createMock( IResultWrapper::class );
		$result->method( 'fetchObject' )->willReturn( (object)[ 'Type' => 'text' ] );
		$db = $this->createMock( IDatabase::class );
		$db->method( 'getType' )->willReturn( 'mysql' );
		$db->method( 'tableName' )->willReturn( 'layer_sets' );
		$db->expects( $this->once() )->method( 'query' )->willReturn( $result );
		$updater = $this->createMock( DatabaseUpdater::class );
		$updater->method( 'getDB' )->willReturn( $db );
		$this->assertTrue( LayersSchemaManager::widenFileIdentifier( $updater ) );
	}

	public function testUpdaterRegistersIdentifierUpgradeForMysqlAndSqlite(): void {
		foreach ( [ 'mysql', 'sqlite' ] as $type ) {
			$db = $this->createMock( IDatabase::class );
			$db->method( 'getType' )->willReturn( $type );
			$updater = $this->createMock( DatabaseUpdater::class );
			$updater->method( 'getDB' )->willReturn( $db );
			$updates = [];
			$updater->method( 'addExtensionUpdate' )->willReturnCallback(
				static function ( $update ) use ( &$updates ) {
					$updates[] = $update;
				}
			);
			LayersSchemaManager::onLoadExtensionSchemaUpdates( $updater );
			$this->assertContains(
				[ LayersSchemaManager::class . '::widenFileIdentifier' ], $updates
			);
		}
	}

	public function testUpgradeKeepsIdentifiersAndAcceptsFullForeignFallback(): void {
		$db = $this->getDb();
		if ( $db->getType() !== 'mysql' ) {
			$this->markTestSkipped( 'MySQL-specific schema upgrade' );
		}
		$table = $db->tableName( 'layers_foreign_schema_test' );
		$db->query( "CREATE TEMPORARY TABLE {$table} (ls_img_sha1 varchar(32) NOT NULL)" );
		try {
			$old = str_repeat( 'a', 31 );
			$db->query( "INSERT INTO {$table} (ls_img_sha1) VALUES ('$old')" );
			$proxy = $this->createMock( IDatabase::class );
			$proxy->method( 'getType' )->willReturn( 'mysql' );
			$proxy->method( 'tableName' )->willReturn( $table );
			$proxy->method( 'query' )->willReturnCallback(
				static function ( $sql, $method ) use ( $db ) {
					return $db->query( $sql, $method );
				}
			);
			$updater = $this->createMock( DatabaseUpdater::class );
			$updater->method( 'getDB' )->willReturn( $proxy );
			$this->assertTrue( LayersSchemaManager::widenFileIdentifier( $updater ) );
			$this->assertTrue( LayersSchemaManager::widenFileIdentifier( $updater ) );
			$foreign = 'foreign_' . sha1( 'Example.jpg' );
			$db->query( "INSERT INTO {$table} (ls_img_sha1) VALUES ('$foreign')" );
			$result = $db->query( "SELECT ls_img_sha1 FROM {$table} ORDER BY ls_img_sha1" );
			$values = [];
			foreach ( $result as $row ) {
				$values[] = $row->ls_img_sha1;
			}
			$this->assertSame( [ $old, $foreign ], $values );
			$db->query( "ALTER TABLE {$table} MODIFY COLUMN ls_img_sha1 varchar(64) NOT NULL" );
			$this->assertTrue( LayersSchemaManager::widenFileIdentifier( $updater ) );
			$field = $db->query( "SHOW COLUMNS FROM {$table} LIKE 'ls_img_sha1'" )->fetchObject();
			$this->assertSame( 'varchar(64)', $field->Type );
		} finally {
			$db->query( "DROP TEMPORARY TABLE {$table}" );
		}
	}
}
