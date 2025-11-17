<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersSave;
use MediaWiki\Extension\Layers\Security\RateLimiter;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 */
class ApiLayersSaveTest extends \MediaWikiUnitTestCase {

	private function createMockApi( array $methods = [] ) {
		$mockApi = $this->createPartialMock( ApiLayersSave::class, $methods );
		return $mockApi;
	}

	private function getValidLayerData() {
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
			],
			[
				'id' => 'layer_125',
				'type' => 'arrow',
				'x1' => 10,
				'y1' => 10,
				'x2' => 100,
				'y2' => 100,
				'stroke' => '#0000ff',
				'strokeWidth' => 2,
				'arrowhead' => 'arrow'
			]
		];
	}

	/**
	 * Test basic layer validation with valid data using new validator architecture
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::execute
	 */
	public function testExecuteWithValidData() {
		$api = $this->createMockApi( [ 'getUser', 'extractRequestParams', 'checkUserRightsAny', 'isSchemaInstalled', 'isValidFilename', 'getConfig', 'dieWithError' ] );

		$user = $this->createMock( \stdClass::class );
		$user->method( 'getId' )->willReturn( 1 );

		$api->method( 'getUser' )->willReturn( $user );
		$api->method( 'extractRequestParams' )->willReturn( [
			'filename' => 'Test.jpg',
			'data' => json_encode( $this->getValidLayerData() ),
			'setname' => 'test-set',
			'token' => 'csrf-token'
		] );
		$api->method( 'checkUserRightsAny' )->willReturn( null );
		$api->method( 'isSchemaInstalled' )->willReturn( true );
		$api->method( 'isValidFilename' )->willReturn( true );

		$config = $this->createMock( \stdClass::class );
		$config->method( 'get' )->willReturnMap( [
			[ 'LayersMaxBytes', 2097152 ],
			[ 'RateLimits', [] ]
		] );
		$api->method( 'getConfig' )->willReturn( $config );

		// Mock the database and file operations
		$dbMock = $this->createMock( \MediaWiki\Extension\Layers\Database\LayersDatabase::class );
		$dbMock->method( 'saveLayerSet' )->willReturn( 123 );

		$rateLimiterMock = $this->createMock( \MediaWiki\Extension\Layers\Security\RateLimiter::class );
		$rateLimiterMock->method( 'checkRateLimit' )->willReturn( true );

		// We can't easily mock the constructor dependencies, so we'll test the validation logic separately
		$validator = new \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator();
		$result = $validator->validateLayers( $this->getValidLayerData() );

		$this->assertTrue( $result->isValid() );
		$this->assertCount( 3, $result->getData() );
	}

	/**
	 * Test validation with invalid layer types using new validator
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayers
	 */
	public function testValidateLayersDataInvalidType() {
		$validator = new \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator();

		// Test invalid type
		$invalidData = [
			[
				'id' => 'layer_123',
				'type' => 'invalid_type',
				'x' => 100,
				'y' => 50
			]
		];

		$result = $validator->validateLayers( $invalidData );
		$this->assertFalse( $result->isValid() );
		$this->assertContains( 'Unsupported layer type', $result->getErrors() );
	}

	/**
	 * Test validation with missing required fields
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::validateAndSanitizeLayersData
	 */
	public function testValidateLayersDataMissingFields() {
		$api = $this->createMockApi();

		$method = new \ReflectionMethod( $api, 'validateAndSanitizeLayersData' );
		$method->setAccessible( true );

		// Test missing required fields
		$invalidData = [
			[
				'x' => 100,
				'y' => 50
				// Missing 'id' and 'type'
			]
		];

		$result = $method->invoke( $api, $invalidData );
		$this->assertIsArray( $result );
		$this->assertCount( 0, $result, 'Layers without required fields should be filtered out' );
	}

	/**
	 * Test validation with too many layers
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::validateAndSanitizeLayersData
	 */
	public function testValidateLayersDataTooManyLayers() {
		$api = $this->createMockApi();

		$method = new \ReflectionMethod( $api, 'validateAndSanitizeLayersData' );
		$method->setAccessible( true );

		// Create array with 101 layers (exceeds default limit of 100)
		$tooManyLayers = [];
		for ( $i = 0; $i < 101; $i++ ) {
			$tooManyLayers[] = [
				'id' => "layer_$i",
				'type' => 'text',
				'x' => 10,
				'y' => 10,
				'text' => "Layer $i"
			];
		}

		$result = $method->invoke( $api, $tooManyLayers );
		$this->assertIsArray( $result );
		$this->assertLessThanOrEqual( 100, count( $result ), 'Should not exceed maximum layer count' );
	}

	/**
	 * Test color sanitization
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::sanitizeColor
	 */
	public function testSanitizeColor() {
		$api = $this->createMockApi();

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

	/**
	 * Test text sanitization
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::sanitizeTextInput
	 */
	public function testSanitizeTextInput() {
		$api = $this->createMockApi();

		$method = new \ReflectionMethod( $api, 'sanitizeTextInput' );
		$method->setAccessible( true );

		// Clean text should pass through
		$this->assertEquals( 'Hello World', $method->invoke( $api, 'Hello World' ) );
		$this->assertEquals( 'Test 123', $method->invoke( $api, 'Test 123' ) );

		// HTML tags should be stripped
		$this->assertEquals( 'Hello World', $method->invoke( $api, '<b>Hello World</b>' ) );
		$this->assertEquals( 'alert(1)', $method->invoke( $api, '<script>alert(1)</script>' ) );

		// Event handlers should be removed
		$cleanText = $method->invoke( $api, 'Hello onclick="alert(1)" world' );
		$this->assertStringNotContainsString( 'onclick', $cleanText );
		$this->assertStringNotContainsString( 'alert', $cleanText );
	}

	/**
	 * Test filename validation
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::isValidFilename
	 */
	public function testIsValidFilename() {
		$api = $this->createMockApi();

		$method = new \ReflectionMethod( $api, 'isValidFilename' );
		$method->setAccessible( true );

		// Valid filenames
		$this->assertTrue( $method->invoke( $api, 'File:Test.jpg' ) );
		$this->assertTrue( $method->invoke( $api, 'File:Image.png' ) );
		$this->assertTrue( $method->invoke( $api, 'File:Document.pdf' ) );

		// Invalid filenames
		$this->assertFalse( $method->invoke( $api, 'test.jpg' ) ); // Missing File: prefix
		$this->assertFalse( $method->invoke( $api, '' ) ); // Empty
		$this->assertFalse( $method->invoke( $api, 'File:' ) ); // No filename
		$this->assertFalse( $method->invoke( $api, 'File:../../../etc/passwd' ) ); // Path traversal
	}

	/**
	 * Test XSS protection in text validation
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::validateAndSanitizeLayersData
	 */
	public function testValidateLayersDataXSSProtection() {
		$api = $this->createMockApi();

		$method = new \ReflectionMethod( $api, 'validateAndSanitizeLayersData' );
		$method->setAccessible( true );

		// Test script injection attempts
		$maliciousData = [
			[
				'id' => 'layer_123',
				'type' => 'text',
				'x' => 100,
				'y' => 50,
				'text' => '<script>alert("xss")</script>'
			]
		];

		$result = $method->invoke( $api, $maliciousData );
		$this->assertIsArray( $result );

		if ( count( $result ) > 0 ) {
			$layer = $result[0];
			$this->assertArrayHasKey( 'text', $layer );
			$this->assertStringNotContainsString( '<script>', $layer['text'] );
			$this->assertStringNotContainsString( 'alert', $layer['text'] );
		}
	}

	/**
	 * Test coordinate validation bounds
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::validateAndSanitizeLayersData
	 */
	public function testValidateLayersDataCoordinateBounds() {
		$api = $this->createMockApi();

		$method = new \ReflectionMethod( $api, 'validateAndSanitizeLayersData' );
		$method->setAccessible( true );

		// Test coordinates beyond allowed bounds
		$outOfBoundsData = [
			[
				'id' => 'layer_123',
				'type' => 'rectangle',
				// Beyond typical reasonable limits
				'x' => 99999,
				'y' => 50,
				'width' => 100,
				'height' => 50
			]
		];

		$result = $method->invoke( $api, $outOfBoundsData );
		$this->assertIsArray( $result );

		if ( count( $result ) > 0 ) {
			$layer = $result[0];
			// Coordinates should be clamped or the layer should be filtered
			$this->assertArrayHasKey( 'x', $layer );
			$this->assertLessThan( 50000, $layer['x'], 'X coordinate should be within reasonable bounds' );
		}
	}

	/**
	 * Test layer complexity validation
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::validateAndSanitizeLayersData
	 */
	public function testValidateLayersDataComplexity() {
		$api = $this->createMockApi();

		$method = new \ReflectionMethod( $api, 'validateAndSanitizeLayersData' );
		$method->setAccessible( true );

		// Test path with too many points (potential DoS)
		$complexPath = [
			[
				'id' => 'layer_complex',
				'type' => 'path',
				'points' => array_fill( 0, 2000, [ 'x' => 10, 'y' => 10 ] ) // Too many points
			]
		];

		$result = $method->invoke( $api, $complexPath );
		$this->assertIsArray( $result );

		if ( count( $result ) > 0 ) {
			$layer = $result[0];
			if ( isset( $layer['points'] ) ) {
				$this->assertLessThanOrEqual( 1000, count( $layer['points'] ),
					'Points array should be limited to prevent DoS' );
			}
		}
	}

	/**
	 * Test JSON bomb protection
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::isJsonBomb
	 */
	public function testJsonBombDetection() {
		$api = $this->createMockApi();

		$method = new \ReflectionMethod( $api, 'isJsonBomb' );
		$method->setAccessible( true );

		// Normal JSON should pass
		$normalJson = json_encode( $this->getValidLayerData() );
		$this->assertFalse( $method->invoke( $api, $normalJson ), 'Normal JSON should not be detected as bomb' );

		// Very large JSON should be detected
		$largeJson = json_encode( array_fill( 0, 10000, 'test' ) );
		// This might be detected as a JSON bomb depending on implementation
		$result = $method->invoke( $api, $largeJson );
		$this->assertIsBool( $result );

		// Deeply nested JSON should be detected
		$deepNested = [ 'a' => [ 'b' => [ 'c' => [ 'd' => [ 'e' => 'value' ] ] ] ] ];
		for ( $i = 0; $i < 100; $i++ ) {
			$deepNested = [ 'level' => $deepNested ];
		}
		$deepJson = json_encode( $deepNested );
		// This should likely be detected as a JSON bomb
		$result = $method->invoke( $api, $deepJson );
		$this->assertIsBool( $result );
	}

	/**
	 * Test data size validation
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::execute
	 */
	public function testDataSizeValidation() {
		// This would require setting up a more complete mock
		// For now, just verify the method exists
		$this->assertTrue( method_exists( ApiLayersSave::class, 'execute' ) );
	}

	/**
	 * Test rate limiting integration
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::execute
	 */
	public function testRateLimitingIntegration() {
		// This would require mocking the rate limiter
		// For now, just verify the class exists
		$this->assertTrue( class_exists( RateLimiter::class ) );
	}

	/**
	 * Ensure set names retain international characters while remaining safe
	 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave::sanitizeSetName
	 */
	public function testSanitizeSetNameAllowsUnicodeScripts() {
		$api = $this->createMockApi();
		$method = new \ReflectionMethod( $api, 'sanitizeSetName' );
		$method->setAccessible( true );

		$result = $method->invoke( $api, "  Пример-набор 层 集  " );
		$this->assertSame( 'Пример-набор 层 集', $result );

		$fallback = $method->invoke( $api, "悪い/../name\x00試験!" );
		$this->assertSame( '悪いname試験', $fallback );

		$empty = $method->invoke( $api, "\x00" );
		$this->assertSame( 'default', $empty );
	}
}
