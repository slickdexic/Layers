<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersSave;
use MediaWikiUnitTestCase;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 */
class ApiLayersSaveTest extends MediaWikiUnitTestCase {

	public function testValidateLayersDataValid() {
		$api = $this->createPartialMock( ApiLayersSave::class, [] );

		$validData = [
			[
				'id' => 'layer_123',
				'type' => 'text',
				'x' => 100,
				'y' => 50,
				'text' => 'Hello World'
			],
			[
				'id' => 'layer_124',
				'type' => 'rectangle',
				'x' => 0,
				'y' => 0,
				'width' => 100,
				'height' => 50
			]
		];

		$method = new \ReflectionMethod( $api, 'validateLayersData' );
		$method->setAccessible( true );

		$this->assertTrue( $method->invoke( $api, $validData ) );
	}

	public function testValidateLayersDataInvalid() {
		$api = $this->createPartialMock( ApiLayersSave::class, [] );

		$method = new \ReflectionMethod( $api, 'validateLayersData' );
		$method->setAccessible( true );

		// Test invalid type
		$invalidData = [
			[
				'id' => 'layer_123',
				'type' => 'invalid_type',
				'x' => 100,
				'y' => 50
			]
		];

		$this->assertFalse( $method->invoke( $api, $invalidData ) );

		// Test missing required fields
		$invalidData2 = [
			[
				'x' => 100,
				'y' => 50
			]
		];

		$this->assertFalse( $method->invoke( $api, $invalidData2 ) );

		// Test too many layers
		$tooManyLayers = [];
		for ( $i = 0; $i < 101; $i++ ) {
			$tooManyLayers[] = [
				'id' => "layer_$i",
				'type' => 'text'
			];
		}

		$this->assertFalse( $method->invoke( $api, $tooManyLayers ) );
	}

	public function testSanitizeColor() {
		$api = $this->createPartialMock( ApiLayersSave::class, [] );

		$method = new \ReflectionMethod( $api, 'sanitizeColor' );
		$method->setAccessible( true );

		// Valid hex colors
		$this->assertEquals( '#ff0000', $method->invoke( $api, '#ff0000' ) );
		$this->assertEquals( '#FF0000', $method->invoke( $api, '#FF0000' ) );
		$this->assertEquals( '#f00', $method->invoke( $api, '#f00' ) );

		// Valid RGB colors
		$this->assertEquals( 'rgb(255, 0, 0)', $method->invoke( $api, 'rgb(255, 0, 0)' ) );
		$this->assertEquals( 'rgba(255, 0, 0, 0.5)', $method->invoke( $api, 'rgba(255, 0, 0, 0.5)' ) );

		// Valid named colors
		$this->assertEquals( 'red', $method->invoke( $api, 'red' ) );
		$this->assertEquals( 'blue', $method->invoke( $api, 'blue' ) );

		// Invalid colors should default to black
		$this->assertEquals( '#000000', $method->invoke( $api, 'invalid' ) );
		$this->assertEquals( '#000000', $method->invoke( $api, 'javascript:alert(1)' ) );
		$this->assertEquals( '#000000', $method->invoke( $api, 123 ) );
	}
}
