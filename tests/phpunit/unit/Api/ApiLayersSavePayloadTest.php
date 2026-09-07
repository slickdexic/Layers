<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersSave;

/**
 * Exercises the production decoder, not a substitute validator.
 *
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::parseSavePayload
 */
class ApiLayersSavePayloadTest extends \MediaWikiUnitTestCase {

	private function parse( string $json ): array {
		$api = new class extends ApiLayersSave {
			public function dieWithError( $message, $code = null ): void {
				throw new \RuntimeException( $code );
			}
		};
		$method = new \ReflectionMethod( ApiLayersSave::class, 'parseSavePayload' );
		$method->setAccessible( true );
		return $method->invoke( $api, $json );
	}

	/** @dataProvider provideInvalidContainers */
	public function testRejectsInvalidContainers( string $json ): void {
		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'validationfailed' );
		$this->parse( $json );
	}

	public static function provideInvalidContainers(): array {
		return array_map( static fn ( $json ) => [ $json ], [
			'null', 'true', 'false', '0', '42', '""', '"layers"', '{}',
			'{"backgroundVisible":false}', '{"layers":null}', '{"layers":false}',
			'{"layers":"[]"}', '{"layers":{}}', '{"layers":{"0":{"type":"text"}}}',
			'{"0":{"type":"text"}}', '[null]', '[false]', '[1]', '["text"]', '[[]]',
			'{"layers":[[]]}', '{"layers":[{"type":"text"},null]}'
		] );
	}

	public function testSyntaxErrorKeepsExistingErrorCode(): void {
		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'invalidjson' );
		$this->parse( '{"layers":[' );
	}

	/** @dataProvider provideValidContainers */
	public function testPreservesSupportedPayloads( string $json ): void {
		$this->assertSame( json_decode( $json, true ), $this->parse( $json ) );
	}

	public static function provideValidContainers(): array {
		return array_map( static fn ( $json ) => [ $json ], [
			'[]', '{"layers":[]}',
			'[{"id":"label","type":"text","text":"Hello 世界","x":10,"y":20}]',
			'{"layers":[],"backgroundVisible":false,"backgroundOpacity":0}',
			'{"layers":[{"type":"path","points":[{"x":1,"y":2}]}],"canvasWidth":800,' .
				'"canvasHeight":600,"backgroundColor":"#ffffff"}'
		] );
	}

	/**
	 * @dataProvider provideRejectedSaveRequests
	 * @param array $target Save route
	 * @param string $json Malformed payload
	 */
	public function testRejectedRequestNeverWrites( array $target, string $json ): void {
		$db = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->expects( $this->never() )->method( 'saveLayerSet' );
		$api = $this->getMockBuilder( ApiLayersSave::class )->disableOriginalConstructor()->onlyMethods( [
			'getUser', 'extractRequestParams', 'checkUserRightsAny', 'getLayersDatabase',
			'getConfig', 'requireTitleEditPermission', 'dieWithError', 'getResult', 'createRateLimiter'
		] )->getMock();
		$api->method( 'getLayersDatabase' )->willReturn( $db );
		$api->method( 'getConfig' )->willReturn( new \HashConfig( [ 'LayersMaxBytes' => 2097152 ] ) );
		$api->method( 'extractRequestParams' )->willReturn( $target + [
			'filename' => null, 'slidename' => null, 'setname' => 'notes', 'data' => $json, 'page' => 1
		] );
		$api->expects( $this->once() )->method( 'checkUserRightsAny' )->with( 'editlayers' );
		$api->expects( $this->never() )->method( 'createRateLimiter' );
		$api->expects( $this->never() )->method( 'getResult' );
		$api->method( 'dieWithError' )->willReturnCallback( static function ( $message, $code ) {
			throw new \MediaWiki\Api\ApiUsageException( $code );
		} );
		$this->expectException( \MediaWiki\Api\ApiUsageException::class );
		$this->expectExceptionMessage( 'validationfailed' );
		$api->execute();
	}

	/** @return array */
	public static function provideRejectedSaveRequests(): array {
		$cases = [];
		foreach ( [
			'image' => [ 'filename' => 'Example.png' ],
			'pdf-page-2' => [ 'filename' => 'Example.pdf', 'page' => 2 ],
			'slide' => [ 'slidename' => 'Presentation' ],
			'slide-filename-alias' => [ 'filename' => 'Slide:Diagram' ]
		] as $route => $target ) {
			foreach ( self::provideInvalidContainers() as $index => [ $json ] ) {
				$cases[$route . '-' . $index] = [ $target, $json ];
			}
		}
		return $cases;
	}

}
