<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersExport;
use MediaWiki\Extension\Layers\ThumbnailRenderer;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * Unit tests for ApiLayersExport pure helper logic.
 *
 * The module as a whole depends on MediaWiki services, the filesystem and
 * ImageMagick, so we exercise its dependency-free helpers directly via
 * reflection on an instance created without invoking the constructor.
 *
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersExport
 */
class ApiLayersExportTest extends TestCase {

	/**
	 * Create an ApiLayersExport instance without running its constructor.
	 *
	 * @return ApiLayersExport
	 */
	private function newModule(): ApiLayersExport {
		$ref = new ReflectionClass( ApiLayersExport::class );
		return $ref->newInstanceWithoutConstructor();
	}

	/**
	 * Invoke a private/protected method on the module.
	 *
	 * @param ApiLayersExport $module Module instance
	 * @param string $method Method name
	 * @param array $args Arguments
	 * @return mixed
	 */
	private function invoke( ApiLayersExport $module, string $method, array $args ) {
		$ref = new ReflectionClass( ApiLayersExport::class );
		$m = $ref->getMethod( $method );
		$m->setAccessible( true );
		return $m->invokeArgs( $module, $args );
	}

	public function testExtractLayersReturnsEmptyForNullSet(): void {
		$module = $this->newModule();
		$this->assertSame( [], $this->invoke( $module, 'extractLayers', [ null ] ) );
	}

	public function testExtractLayersReturnsEmptyWhenNoData(): void {
		$module = $this->newModule();
		$this->assertSame( [], $this->invoke( $module, 'extractLayers', [ [ 'id' => 5 ] ] ) );
	}

	public function testExtractLayersHandlesWrappedLayers(): void {
		$module = $this->newModule();
		$layers = [ [ 'type' => 'rectangle' ], [ 'type' => 'text' ] ];
		$set = [ 'id' => 1, 'data' => [ 'revision' => 3, 'layers' => $layers ] ];
		$this->assertSame( $layers, $this->invoke( $module, 'extractLayers', [ $set ] ) );
	}

	public function testExtractLayersHandlesBareLayersArray(): void {
		$module = $this->newModule();
		$layers = [ [ 'type' => 'arrow' ] ];
		$set = [ 'id' => 1, 'data' => $layers ];
		$this->assertSame( $layers, $this->invoke( $module, 'extractLayers', [ $set ] ) );
	}

	public function testExtractLayersReturnsEmptyForNonArrayData(): void {
		$module = $this->newModule();
		$set = [ 'id' => 1, 'data' => 'not-an-array' ];
		$this->assertSame( [], $this->invoke( $module, 'extractLayers', [ $set ] ) );
	}

	public function testExtractLayersReturnsEmptyForAssocNonLayerData(): void {
		$module = $this->newModule();
		// Assoc array with no 'layers' key and no numeric index 0.
		$set = [ 'id' => 1, 'data' => [ 'revision' => 2, 'schema' => 1 ] ];
		$this->assertSame( [], $this->invoke( $module, 'extractLayers', [ $set ] ) );
	}

	public function testFailedLayerCompositeDoesNotFallBackToPlainPage(): void {
		$renderer = $this->createMock( ThumbnailRenderer::class );
		$renderer->method( 'generateLayeredThumbnail' )->willReturn( null );
		$renderer->method( 'getDroppedLayerTypes' )->willReturn( [] );
		$module = $this->getMockBuilder( ApiLayersExport::class )->disableOriginalConstructor()
			->onlyMethods( [ 'createThumbnailRenderer' ] )->getMock();
		$module->method( 'createThumbnailRenderer' )->willReturn( $renderer );
		$db = new class {
			public function getLayerSetByName() {
				return [ 'data' => [ 'layers' => [ [ 'type' => 'text', 'text' => 'hello' ] ] ] ];
			}
		};
		$file = new class {
			public bool $transformed = false;

			public function transform() {
				$this->transformed = true;
				return null;
			}
		};
		$this->assertNull( $this->invoke( $module, 'renderPageImage',
			[ $file, $db, 'file.pdf', 'hash', 'Default', 1, 800, true ] ) );
		$this->assertFalse( $file->transformed );
	}

	public function testMissingSavedLayerSetDoesNotFallBackToPlainPage(): void {
		$module = $this->newModule();
		$db = new class {
			public function getLayerSetByName() {
				return null;
			}
		};
		$file = new class {
			public bool $transformed = false;

			public function transform() {
				$this->transformed = true;
				return null;
			}
		};
		$this->assertNull( $this->invoke( $module, 'renderPageImage',
			[ $file, $db, 'file.pdf', 'hash', 'Default', 1, 800, true ] ) );
		$this->assertFalse( $file->transformed );
	}

	public function testPageWithoutLayersUsesItsPlainPage(): void {
		$path = tempnam( sys_get_temp_dir(), 'layers-plain-page-' );
		try {
			$file = new class( $path ) {
				private string $path;

				public function __construct( string $path ) {
					$this->path = $path;
				}

				public function transform() {
					return new class( $this->path ) {
						private string $path;

						public function __construct( string $path ) {
							$this->path = $path;
						}

						public function getLocalCopyPath(): string {
							return $this->path;
						}
					};
				}
			};
			$this->assertSame( $path, $this->invoke( $this->newModule(), 'renderPageImage',
				[ $file, null, 'file.pdf', 'hash', 'Default', 1, 800, false ] ) );
		} finally {
			unlink( $path );
		}
	}

	public function testFailedMiddlePageRefusesTheWholeExport(): void {
		$module = $this->getMockBuilder( ApiLayersExport::class )->disableOriginalConstructor()
			->onlyMethods( [ 'renderPageImage' ] )->getMock();
		$module->expects( $this->exactly( 2 ) )->method( 'renderPageImage' )
			->willReturnOnConsecutiveCalls( '/page-one.png', null );
		$this->assertNull( $this->invoke( $module, 'renderAllPages',
			[ null, null, 'file.pdf', 'hash', 'Default', 800, [ 1 => 'none', 2 => 'set', 3 => 'none' ] ] ) );
	}

	public function testCompletePagesKeepTheirOrder(): void {
		$module = $this->getMockBuilder( ApiLayersExport::class )->disableOriginalConstructor()
			->onlyMethods( [ 'renderPageImage' ] )->getMock();
		$module->expects( $this->exactly( 3 ) )->method( 'renderPageImage' )
			->willReturnOnConsecutiveCalls( '/one.png', '/two.png', '/three.png' );
		$this->assertSame( [ '/one.png', '/two.png', '/three.png' ], $this->invoke( $module, 'renderAllPages',
			[ null, null, 'file.pdf', 'hash', 'Default', 800, [ 1 => 'none', 2 => 'set', 3 => 'none' ] ] ) );
	}

	public function testDroppedLayersRefuseEveryFreshRender(): void {
		$root = sys_get_temp_dir() . '/layers-export-test-' . bin2hex( random_bytes( 8 ) );
		mkdir( $root . '/thumb/layers', 0777, true );
		$path = $root . '/thumb/layers/composite.png';
		file_put_contents( $path, 'test' );
		try {
			$config = $this->createMock( \MediaWiki\Config\Config::class );
			$config->method( 'get' )->with( 'UploadDirectory' )->willReturn( $root );
			$renderer = $this->createMock( ThumbnailRenderer::class );
			$nonces = [];
			$renderer->method( 'generateLayeredThumbnail' )->willReturnCallback(
				static function ( $file, $params ) use ( &$nonces, $path ) {
					$nonces[] = $params['layersExportNonce'];
					return $path;
				}
			);
			$renderer->method( 'getDroppedLayerTypes' )->willReturn( [ 'image' ] );
			$module = $this->getMockBuilder( ApiLayersExport::class )->disableOriginalConstructor()
				->onlyMethods( [ 'createThumbnailRenderer', 'getConfig' ] )->getMock();
			$module->method( 'createThumbnailRenderer' )->willReturn( $renderer );
			$module->method( 'getConfig' )->willReturn( $config );
			$db = new class {
				public function getLayerSetByName() {
					return [ 'data' => [ 'layers' => [ [ 'type' => 'image' ] ] ] ];
				}
			};
			foreach ( [ 1, 2 ] as $attempt ) {
				$this->assertNull( $this->invoke( $module, 'renderPageImage',
					[ null, $db, 'file.pdf', 'hash', 'Default', 1, 800, true ] ), (string)$attempt );
			}
			$this->assertCount( 2, array_unique( $nonces ) );
		} finally {
			unlink( $path );
			rmdir( $root . '/thumb/layers' );
			rmdir( $root . '/thumb' );
			rmdir( $root );
		}
	}

	public function testIsReadModeTrueAndWriteModeFalse(): void {
		$module = $this->newModule();
		$this->assertTrue( $module->isReadMode() );
		// No layer data is mutated...
		$this->assertFalse( $module->isWriteMode() );
	}

	/**
	 * ...but the export spends unbounded server CPU and writes a PDF to disk, so
	 * it must not be reachable as a token-less GET from a third-party page.
	 */
	public function testExportRequiresPostAndCsrfToken(): void {
		$module = $this->newModule();
		$this->assertSame( 'csrf', $module->needsToken() );
		$this->assertTrue( $module->mustBePosted() );
	}
}
