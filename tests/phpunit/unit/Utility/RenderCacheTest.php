<?php

declare( strict_types=1 );
/**
 * @file
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Tests\Unit\Utility;

use MediaWiki\Config\Config;
use MediaWiki\Extension\Layers\Utility\RenderCache;
use MediaWikiUnitTestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Utility\RenderCache
 */
class RenderCacheTest extends MediaWikiUnitTestCase {

	/** @var string Temporary upload directory for this test */
	private string $uploadDir;

	protected function setUp(): void {
		parent::setUp();
		$this->uploadDir = sys_get_temp_dir() . '/layers-rendercache-' . bin2hex( random_bytes( 6 ) );
		mkdir( $this->uploadDir, 0777, true );
	}

	protected function tearDown(): void {
		$this->removeTree( $this->uploadDir );
		parent::tearDown();
	}

	/**
	 * @param string $path
	 */
	private function removeTree( string $path ): void {
		if ( !is_dir( $path ) ) {
			return;
		}
		foreach ( scandir( $path ) as $entry ) {
			if ( $entry === '.' || $entry === '..' ) {
				continue;
			}
			$full = $path . '/' . $entry;
			if ( is_dir( $full ) ) {
				$this->removeTree( $full );
			} else {
				unlink( $full );
			}
		}
		rmdir( $path );
	}

	/**
	 * @param array $extra
	 * @return Config
	 */
	private function makeConfig( array $extra = [] ): Config {
		return new Config( [
			'UploadDirectory' => $this->uploadDir,
			'LayersExportDirectory' => $this->uploadDir . '/private-export',
		] + $extra );
	}

	/**
	 * @param string $dir
	 * @param string $name
	 * @param int|null $mtime
	 * @return string
	 */
	private function writeArtefact( string $dir, string $name, ?int $mtime = null ): string {
		if ( !is_dir( $dir ) ) {
			mkdir( $dir, 0777, true );
		}
		$path = $dir . '/' . $name;
		file_put_contents( $path, 'x' );
		if ( $mtime !== null ) {
			touch( $path, $mtime );
		}
		return $path;
	}

	public function testDirectoriesAreDerivedFromUploadDirectory(): void {
		$config = $this->makeConfig();

		$this->assertSame( $this->uploadDir . '/thumb/layers', RenderCache::getThumbDir( $config ) );
		$this->assertSame( $this->uploadDir . '/private-export', RenderCache::getExportDir( $config ) );
	}

	/**
	 * Exports are full-content documents served through Special:LayersExport, so
	 * they must never default into the web-accessible upload tree.
	 */
	public function testExportDirDefaultsOutsideTheUploadDirectory(): void {
		$config = new Config( [
			'UploadDirectory' => $this->uploadDir,
			'TmpDirectory' => $this->uploadDir . '/../layers-tmp',
		] );

		$exportDir = RenderCache::getExportDir( $config );

		$this->assertSame( $this->uploadDir . '/../layers-tmp/layers-export', $exportDir );
		$this->assertStringNotContainsString( '/thumb/', $exportDir );
	}

	public function testExportDirFallsBackToSystemTempWhenNothingConfigured(): void {
		$config = new Config( [ 'UploadDirectory' => $this->uploadDir ] );

		$expected = rtrim( sys_get_temp_dir(), '/\\' ) . '/layers-export';
		$this->assertSame( $expected, RenderCache::getExportDir( $config ) );
	}

	public function testExportDirTrailingSeparatorIsNotDuplicated(): void {
		$config = new Config( [ 'LayersExportDirectory' => $this->uploadDir . '/x/' ] );

		$this->assertSame( $this->uploadDir . '/x', RenderCache::getExportDir( $config ) );
	}

	public function testTrailingSeparatorIsNotDuplicated(): void {
		$config = new Config( [ 'UploadDirectory' => $this->uploadDir . '/' ] );

		$this->assertSame( $this->uploadDir . '/thumb/layers', RenderCache::getThumbDir( $config ) );
	}

	public function testFallsBackToTempDirWhenUploadDirectoryUnset(): void {
		$config = new Config( [] );

		$expected = rtrim( sys_get_temp_dir(), '/\\' ) . '/thumb/layers';
		$this->assertSame( $expected, RenderCache::getThumbDir( $config ) );
	}

	public function testEnsureDirCreatesNestedDirectoriesAndIsIdempotent(): void {
		$config = $this->makeConfig();
		$dir = RenderCache::getExportDir( $config );

		$this->assertTrue( RenderCache::ensureDir( $config, $dir ) );
		$this->assertDirectoryExists( $dir );
		$this->assertTrue( RenderCache::ensureDir( $config, $dir ) );
	}

	public function testPurgeBySha1RemovesOnlyMatchingArtefacts(): void {
		$config = $this->makeConfig();
		$thumbDir = RenderCache::getThumbDir( $config );
		$exportDir = RenderCache::getExportDir( $config );

		$mine = [
			$this->writeArtefact( $thumbDir, 'abc123_800px.png' ),
			$this->writeArtefact( $thumbDir, 'abc123_thumb.png' ),
			$this->writeArtefact( $exportDir, 'abc123_rev4.pdf' ),
		];
		$other = $this->writeArtefact( $thumbDir, 'def456_800px.png' );

		$this->assertSame( 3, RenderCache::purgeBySha1( $config, 'abc123' ) );
		foreach ( $mine as $path ) {
			$this->assertFileDoesNotExist( $path );
		}
		$this->assertFileExists( $other );
	}

	/**
	 * A malformed SHA1 must never be allowed to glob an entire cache directory.
	 *
	 * @dataProvider provideInvalidSha1
	 * @param string $sha1
	 */
	public function testPurgeBySha1RejectsMalformedInput( string $sha1 ): void {
		$config = $this->makeConfig();
		$thumbDir = RenderCache::getThumbDir( $config );
		$path = $this->writeArtefact( $thumbDir, 'abc123_800px.png' );

		$this->assertSame( 0, RenderCache::purgeBySha1( $config, $sha1 ) );
		$this->assertFileExists( $path );
	}

	public static function provideInvalidSha1(): array {
		return [
			'empty' => [ '' ],
			'wildcard' => [ '*' ],
			'too short' => [ 'ab' ],
			'path traversal' => [ '../..' ],
			'uppercase' => [ 'ABC123' ],
			'separator' => [ 'abc/123' ],
		];
	}

	public function testPurgeBySha1IsSafeWhenDirectoriesAreAbsent(): void {
		$this->assertSame( 0, RenderCache::purgeBySha1( $this->makeConfig(), 'abc123' ) );
	}

	public function testPurgeOlderThanRemovesOnlyStaleArtefacts(): void {
		$config = $this->makeConfig();
		$thumbDir = RenderCache::getThumbDir( $config );

		$stale = $this->writeArtefact( $thumbDir, 'abc123_old.png', time() - 7200 );
		$fresh = $this->writeArtefact( $thumbDir, 'abc123_new.png', time() );

		$result = RenderCache::purgeOlderThan( $config, 3600 );

		$this->assertSame( 1, $result['deleted'] );
		$this->assertSame( 1, $result['bytes'] );
		$this->assertFileDoesNotExist( $stale );
		$this->assertFileExists( $fresh );
	}

	public function testPurgeOlderThanDryRunLeavesFilesInPlace(): void {
		$config = $this->makeConfig();
		$thumbDir = RenderCache::getThumbDir( $config );
		$stale = $this->writeArtefact( $thumbDir, 'abc123_old.png', time() - 7200 );

		$result = RenderCache::purgeOlderThan( $config, 3600, true );

		$this->assertSame( 1, $result['deleted'] );
		$this->assertFileExists( $stale );
	}

	public function testPurgeOlderThanIgnoresSubdirectories(): void {
		$config = $this->makeConfig();
		$thumbDir = RenderCache::getThumbDir( $config );
		$this->writeArtefact( $thumbDir, 'abc123_rev1.png', time() - 7200 );
		$nested = $thumbDir . '/nested';
		mkdir( $nested, 0777, true );
		touch( $nested, time() - 7200 );

		$result = RenderCache::purgeOlderThan( $config, 3600 );

		$this->assertSame( 1, $result['deleted'] );
		$this->assertDirectoryExists( $nested );
	}

	/**
	 * The export directory is admin-configurable, so a sweep must not remove files
	 * that do not follow the "<sha1>_<hash>.<ext>" artefact naming.
	 */
	public function testPurgeOlderThanLeavesForeignFilesAlone(): void {
		$config = $this->makeConfig();
		$exportDir = RenderCache::getExportDir( $config );

		$artefact = $this->writeArtefact( $exportDir, 'abc123_rev1.pdf', time() - 7200 );
		$foreign = $this->writeArtefact( $exportDir, 'important-backup.sql', time() - 7200 );

		$result = RenderCache::purgeOlderThan( $config, 3600 );

		$this->assertSame( 1, $result['deleted'] );
		$this->assertFileDoesNotExist( $artefact );
		$this->assertFileExists( $foreign );
	}
}
