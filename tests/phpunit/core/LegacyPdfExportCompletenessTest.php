<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Api\ApiLayersExport;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Shell\Shell;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersExport
 * @group Database
 * @group API
 */
class LegacyPdfExportCompletenessTest extends \MediaWiki\Tests\Api\ApiTestCase {
	private string $dir;
	private string $image;
	private int $failPage = 0;

	protected function setUp(): void {
		parent::setUp();
		$convert = $this->getServiceContainer()->getMainConfig()->get( 'ImageMagickConvertCommand' );
		if ( !$convert ) {
			$this->markTestSkipped( 'ImageMagick is not configured' );
		}
		$this->dir = sys_get_temp_dir() . '/layers-export-api-' . bin2hex( random_bytes( 8 ) );
		mkdir( $this->dir );
		$this->image = $this->dir . '/page.png';
		$this->assertSame( 0, Shell::command( $convert, '-size', '8x8', 'xc:white', $this->image )
			->includeStderr()->execute()->getExitCode() );
		$this->overrideConfigValue( 'LayersExportDirectory', $this->dir );
		$s = $this->getServiceContainer();
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLayerSetByName' )->willReturn( null );
		$title = $s->getTitleFactory()->newFromText( 'File:LayersExportSynthetic.pdf' );
		$test = $this;
		$this->overrideConfigValue( 'APIModules', array_replace( $s->getMainConfig()->get( 'APIModules' ), [
			'layerspdfexport' => [ 'class' => ApiLayersExport::class, 'factory' => static function ( $main, $name )
				use ( $db, $title, $test ) {
				return new class( $main, $name, $db, $title, $test->image, $test->failPage ) extends ApiLayersExport {
					private $testDb;
					private $testTitle;
					private string $image;
					private int $failPage;

					public function __construct( $main, $name, $db, $title, $image, $failPage ) {
						parent::__construct( $main, $name );
						$this->testDb = $db;
						$this->testTitle = $title;
						$this->image = $image;
						$this->failPage = $failPage;
					}

					protected function getLayersDatabase() {
						return $this->testDb;
					}

					protected function validateAndGetFile( string $filename ): array {
						return [ 'title' => $this->testTitle, 'file' => new \stdClass(), 'imgName' => $filename ];
					}

					protected function getFileSha1( $file, string $imgName ): string {
						return str_repeat( 'a', 31 );
					}

					protected function getPageCount( $file ): int {
						return 3;
					}

					protected function renderPageImage(
						$file, $db, string $imgName, string $sha1, string $setName, int $page, int $width,
						bool $hasLayers
					): ?string {
						return $page === $this->failPage ? null : $this->image;
					}
				};
			} ]
		] ) );
	}

	protected function tearDown(): void {
		if ( isset( $this->dir ) && is_dir( $this->dir ) ) {
			foreach ( glob( $this->dir . '/*' ) ?: [] as $file ) {
				unlink( $file );
			}
			rmdir( $this->dir );
		}
		parent::tearDown();
	}

	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, true, $session );
	}

	private function request(): array {
		return [ 'action' => 'layerspdfexport', 'filename' => 'LayersExportSynthetic.pdf', 'setname' => 'Default' ];
	}

	public function testFailedMiddlePageProducesNoCachedPdf(): void {
		$this->failPage = 2;
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read' ] );
		try {
			$this->doApiRequestWithToken( $this->request(), null, $user );
			$this->fail( 'An incomplete PDF must be refused' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'exportfailed' ) );
		}
		$this->assertSame( [], glob( $this->dir . '/*.pdf' ) );
	}

	public function testCompleteExportCanBeReused(): void {
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read' ] );
		$first = $this->doApiRequestWithToken( $this->request(), null, $user )[0]['layerspdfexport'];
		$this->assertSame( 3, $first['pageCount'] );
		$this->assertSame( 0, $first['cached'] );
		$files = glob( $this->dir . '/*.pdf' );
		$this->assertCount( 1, $files );
		$info = Shell::command( 'pdfinfo', $files[0] )->includeStderr()->execute();
		$this->assertSame( 0, $info->getExitCode() );
		$this->assertMatchesRegularExpression( '/^Pages:\s+3$/m', $info->getStdout() );
		$second = $this->doApiRequestWithToken( $this->request(), null, $user )[0]['layerspdfexport'];
		$this->assertSame( 1, $second['cached'] );
		$this->assertSame( $first['url'], $second['url'] );
	}
}
