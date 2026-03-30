<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersSave;
use MediaWiki\Extension\Layers\Validation\ColorValidator;
use MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator;
use MediaWiki\Extension\Layers\Validation\SetNameSanitizer;
use MediaWiki\Extension\Layers\Validation\TextSanitizer;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 * @group Layers
 */
class ApiLayersSaveTest extends \MediaWikiUnitTestCase {

	private function createApi(): ApiLayersSave {
		return new ApiLayersSave();
	}

	private function getValidLayerData(): array {
		return [
			[
				'id' => 'layer_123',
				'type' => 'text',
				'x' => 100,
				'y' => 50,
				'text' => 'Hello World',
				'fontSize' => 16,
				'color' => '#000000'
			],
			[
				'id' => 'layer_124',
				'type' => 'rectangle',
				'x' => 0,
				'y' => 0,
				'width' => 100,
				'height' => 50,
				'stroke' => '#ff0000',
				'fill' => '#00ff00'
			]
		];
	}

	/**
	 * @covers ::needsToken
	 * @covers ::isWriteMode
	 * @covers ::mustBePosted
	 */
	public function testWriteModeSecurityContract(): void {
		$api = $this->createApi();

		$this->assertSame( 'csrf', $api->needsToken() );
		$this->assertTrue( $api->isWriteMode() );
		$this->assertTrue( $api->mustBePosted() );
	}

	/**
	 * @covers ::getAllowedParams
	 */
	public function testGetAllowedParamsContract(): void {
		$api = $this->createApi();
		$params = $api->getAllowedParams();

		$this->assertArrayHasKey( 'filename', $params );
		$this->assertArrayHasKey( 'slidename', $params );
		$this->assertArrayHasKey( 'data', $params );
		$this->assertArrayHasKey( 'setname', $params );

		$this->assertSame( 'string', $params['filename'][ApiLayersSave::PARAM_TYPE] );
		$this->assertFalse( $params['filename'][ApiLayersSave::PARAM_REQUIRED] );
		$this->assertSame( 'string', $params['slidename'][ApiLayersSave::PARAM_TYPE] );
		$this->assertFalse( $params['slidename'][ApiLayersSave::PARAM_REQUIRED] );
		$this->assertSame( 'string', $params['data'][ApiLayersSave::PARAM_TYPE] );
		$this->assertTrue( $params['data'][ApiLayersSave::PARAM_REQUIRED] );
		$this->assertSame( 'string', $params['setname'][ApiLayersSave::PARAM_TYPE] );
		$this->assertFalse( $params['setname'][ApiLayersSave::PARAM_REQUIRED] );
	}

	public function testServerSideLayerValidatorAcceptsValidLayers(): void {
		$validator = new ServerSideLayerValidator();
		$result = $validator->validateLayers( $this->getValidLayerData() );

		$this->assertTrue( $result->isValid() );
		$this->assertCount( 2, $result->getData() );
	}

	public function testServerSideLayerValidatorRejectsInvalidType(): void {
		$validator = new ServerSideLayerValidator();
		$result = $validator->validateLayers( [
			[
				'id' => 'layer_123',
				'type' => 'invalid_type',
				'x' => 100,
				'y' => 50
			]
		] );

		$this->assertFalse( $result->isValid() );
		$this->assertNotEmpty( $result->getErrors() );
	}

	public function testServerSideLayerValidatorFiltersLayersMissingRequiredFields(): void {
		$validator = new ServerSideLayerValidator();
		$result = $validator->validateLayers( [
			[
				'x' => 100,
				'y' => 50
			]
		] );

		$this->assertFalse( $result->isValid() );
		$this->assertSame( [], $result->getData() );
	}

	public function testServerSideLayerValidatorLimitsLayerCount(): void {
		$validator = new ServerSideLayerValidator();
		$tooManyLayers = [];

		for ( $index = 0; $index < 101; $index++ ) {
			$tooManyLayers[] = [
				'id' => 'layer_' . $index,
				'type' => 'text',
				'x' => 10,
				'y' => 10,
				'text' => 'Layer ' . $index
			];
		}

		$result = $validator->validateLayers( $tooManyLayers );

		$this->assertFalse( $result->isValid() );
		$this->assertNotEmpty( $result->getErrors() );
	}

	public function testColorSanitizerHandlesValidAndInvalidValues(): void {
		$validator = new ColorValidator();

		$this->assertSame( '#ff0000', $validator->sanitizeColor( '#ff0000' ) );
		$this->assertSame( '#ff0000', $validator->sanitizeColor( '#FF0000' ) );
		$this->assertSame( '#ff0000ff', $validator->sanitizeColor( '#f00f' ) );
		$this->assertSame( 'rgb(255, 0, 0)', $validator->sanitizeColor( 'rgb(255, 0, 0)' ) );
		$this->assertSame( 'red', $validator->sanitizeColor( 'red' ) );
		$this->assertSame( '#000000', $validator->sanitizeColor( 'javascript:alert(1)' ) );
		$this->assertSame( '#000000', $validator->sanitizeColor( 123 ) );
	}

	public function testTextSanitizerRemovesScriptsProtocolsAndHandlers(): void {
		$sanitizer = new TextSanitizer();

		$this->assertSame( 'Hello World', $sanitizer->sanitizeText( '<b>Hello World</b>' ) );
		$this->assertSame( 'Hello  world', $sanitizer->sanitizeText( 'Hello onclick="alert(1)" world' ) );
		$this->assertStringNotContainsString( 'javascript:', $sanitizer->sanitizeText( 'javascript:alert(1)' ) );
		$this->assertSame( 'Hello', $sanitizer->sanitizeText( '<script>alert(1)</script>Hello' ) );
	}

	public function testSetNameSanitizerAllowsUnicodeScripts(): void {
		$this->assertSame( 'Пример-набор 层 集', SetNameSanitizer::sanitize( '  Пример-набор 层 集  ' ) );
		$this->assertSame( '悪いname試験', SetNameSanitizer::sanitize( "悪い/../name\x00試験!" ) );
		$this->assertSame( 'default', SetNameSanitizer::sanitize( "\x00" ) );
	}
}
