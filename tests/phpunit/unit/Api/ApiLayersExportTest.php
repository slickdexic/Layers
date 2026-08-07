<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersExport;
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
