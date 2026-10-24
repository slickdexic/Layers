<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Hooks;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Utility\RenderCache;

require_once __DIR__ . '/LegacyMigrationFixtures.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * File deletion purges generated renders while retaining read-only migration sources.
 * @covers \MediaWiki\Extension\Layers\Hooks::onFileDeleteComplete
 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase::deleteLayerSetsForImage
 * @group Database
 */
class RetainedFileDeletionTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;
	use IsolatedLocalRepoFixture;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setUpMigration();
		MigrationState::clear( $this->getDb() );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	public static function provideFileKindsAndMigrationStates(): array {
		return [
			'image before migration' => [ 'test-image.png', false ],
			'image after migration' => [ 'test-image.png', true ],
			'PDF before migration' => [ 'test-multipage.pdf', false ],
			'PDF after migration' => [ 'test-multipage.pdf', true ]
		];
	}

	/** @dataProvider provideFileKindsAndMigrationStates */
	public function testRetainedRowsAndRenderCleanup( string $asset, bool $migrated ): void {
		$extension = pathinfo( $asset, PATHINFO_EXTENSION );
		$file = $this->upload( 'DeletionTarget-' . wfRandomString( 8 ) . '.' . $extension, $asset );
		$other = $this->upload( 'DeletionOther-' . wfRandomString( 8 ) . '.' . $extension, $asset );
		$this->saveSet( $file, 'ABC', 1, 'Earlier save' );
		$this->saveSet( $file, 'ABC', 2, 'Latest save', $extension === 'pdf' ? 2 : 1 );
		$this->saveSet( $file, 'Older source', 1, 'Retained older upload', 1, str_repeat( 'a', 31 ) );
		$this->saveSet( $other, 'ABC', 1, 'Another file with the same bytes' );
		$rows = $this->rows();

		$root = $this->getNewTempDirectory();
		$this->overrideConfigValues( [
			'UploadDirectory' => $root . '/uploads',
			'LayersExportDirectory' => $root . '/exports'
		] );
		$config = $this->getServiceContainer()->getMainConfig();
		$generated = [];
		$unrelated = [];
		foreach ( [ RenderCache::getThumbDir( $config ), RenderCache::getExportDir( $config ) ] as $directory ) {
			self::guardPhysicalPath( $directory, $root );
			$this->assertTrue( RenderCache::ensureDir( $config, $directory ) );
			$target = $directory . '/' . $file->getSha1() . '_fixture.png';
			$keep = $directory . '/zzzz_fixture.png';
			file_put_contents( $target, 'Generated render fixture' );
			file_put_contents( $keep, 'Unrelated generated render fixture' );
			$generated[] = $target;
			$unrelated[] = $keep;
		}
		if ( $migrated ) {
			MigrationState::markComplete( $this->getDb() );
		}
		Hooks::onFileDeleteComplete( $file, null, null, $this->actor, 'Native fixture deletion' );
		foreach ( $generated as $path ) {
			$this->assertFileDoesNotExist( $path, 'Deletion must still purge generated file content' );
		}
		foreach ( $unrelated as $path ) {
			$this->assertFileExists( $path, 'Another source cache entry must remain' );
		}
		if ( $migrated ) {
			$this->assertSame( $rows, $this->rows(), 'Completed migration makes every legacy source row read-only' );
		} else {
			$expected = array_values( array_filter( $rows, static fn ( array $row ): bool =>
				$row['ls_img_name'] !== $file->getName() || $row['ls_img_sha1'] !== $file->getSha1() ) );
			$this->assertSame( $expected, $this->rows(),
				'Existing cleanup before migration stays scoped to this file version' );
		}
	}

	/** @return array[] Complete legacy row values in stable order. */
	private function rows(): array {
		$rows = [];
		foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'layer_sets' )
			->orderBy( 'ls_id' )->caller( __METHOD__ )->fetchResultSet() as $row
		) {
			$rows[] = (array)$row;
		}
		return $rows;
	}
}
