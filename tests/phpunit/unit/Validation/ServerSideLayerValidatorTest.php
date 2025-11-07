<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Validation;

use MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator;
use MediaWiki\Extension\Layers\Validation\ValidationResult;

/**
 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator
 */
class ServerSideLayerValidatorTest extends \MediaWikiUnitTestCase {

	private function createValidator(): ServerSideLayerValidator {
		return new ServerSideLayerValidator();
	}

	private function getValidTextLayer(): array {
		return [
			'id' => 'layer_1',
			'type' => 'text',
			'x' => 100,
			'y' => 50,
			'text' => 'Hello World',
			'fontSize' => 16,
			'color' => '#000000'
		];
	}

	private function getValidRectangleLayer(): array {
		return [
			'id' => 'layer_2',
			'type' => 'rectangle',
			'x' => 0,
			'y' => 0,
			'width' => 200,
			'height' => 100,
			'stroke' => '#ff0000',
			'fill' => '#00ff00'
		];
	}

	/**
	 * @covers ::validateLayers
	 */
	public function testValidateLayersSuccess() {
		$validator = $this->createValidator();

		$layers = [
			$this->getValidTextLayer(),
			$this->getValidRectangleLayer()
		];

		$result = $validator->validateLayers( $layers );

		$this->assertInstanceOf( ValidationResult::class, $result );
		$this->assertTrue( $result->isValid() );
		$this->assertCount( 2, $result->getData() );
		$this->assertFalse( $result->hasErrors() );
	}

	/**
	 * @covers ::validateLayers
	 */
	public function testValidateLayersEmpty() {
		$validator = $this->createValidator();

		$result = $validator->validateLayers( [] );

		$this->assertTrue( $result->isValid() );
		$this->assertEmpty( $result->getData() );
		$this->assertTrue( $result->hasWarnings() );
	}

	/**
	 * @covers ::validateLayers
	 */
	public function testValidateLayersTooMany() {
		$validator = $this->createValidator();

		// Create more layers than the limit
		$layers = array_fill( 0, 101, $this->getValidTextLayer() );

		$result = $validator->validateLayers( $layers );

		$this->assertFalse( $result->isValid() );
		$this->assertTrue( $result->hasErrors() );
		$this->assertStringContainsString( 'Too many layers', $result->getErrors()[0] );
	}

	/**
	 * @covers ::validateLayer
	 */
	public function testValidateLayerSuccess() {
		$validator = $this->createValidator();

		$layer = $this->getValidTextLayer();
		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid() );
		$this->assertArrayHasKey( 'type', $result->getData() );
		$this->assertEquals( 'text', $result->getData()['type'] );
	}

	/**
	 * @covers ::validateLayer
	 */
	public function testValidateLayerMissingType() {
		$validator = $this->createValidator();

		$layer = [
			'x' => 100,
			'y' => 50,
			'text' => 'Hello'
		];

		$result = $validator->validateLayer( $layer );

		$this->assertFalse( $result->isValid() );
		$this->assertTrue( $result->hasErrors() );
		$this->assertStringContainsString( 'Missing or invalid layer type', $result->getErrors()[0] );
	}

	/**
	 * @covers ::validateLayer
	 */
	public function testValidateLayerUnsupportedType() {
		$validator = $this->createValidator();

		$layer = [
			'type' => 'unsupported_type',
			'x' => 100,
			'y' => 50
		];

		$result = $validator->validateLayer( $layer );

		$this->assertFalse( $result->isValid() );
		$this->assertTrue( $result->hasErrors() );
		$this->assertStringContainsString( 'Unsupported layer type', $result->getErrors()[0] );
	}

	/**
	 * @covers ::validateLayer
	 */
	public function testValidateLayerTextSpecific() {
		$validator = $this->createValidator();

		// Text layer without text should fail
		$layer = [
			'type' => 'text',
			'x' => 100,
			'y' => 50
		];

		$result = $validator->validateLayer( $layer );

		$this->assertFalse( $result->isValid() );
		$this->assertStringContainsString( 'Text layer must have text content', $result->getErrors()[0] );
	}

	/**
	 * @covers ::validateLayer
	 */
	public function testValidateLayerRectangleSpecific() {
		$validator = $this->createValidator();

		// Rectangle layer without dimensions should fail
		$layer = [
			'type' => 'rectangle',
			'x' => 100,
			'y' => 50
		];

		$result = $validator->validateLayer( $layer );

		$this->assertFalse( $result->isValid() );
		$this->assertStringContainsString( 'rectangle layer must have width and height', $result->getErrors()[0] );
	}

	/**
	 * @covers ::validateLayer
	 */
	public function testValidateLayerCircleSpecific() {
		$validator = $this->createValidator();

		// Circle layer without radius should fail
		$layer = [
			'type' => 'circle',
			'x' => 100,
			'y' => 50
		];

		$result = $validator->validateLayer( $layer );

		$this->assertFalse( $result->isValid() );
		$this->assertStringContainsString( 'Circle layer must have radius', $result->getErrors()[0] );
	}

	/**
	 * @covers ::validateLayer
	 */
	public function testValidateLayerBlendModeAlias() {
		$validator = $this->createValidator();

		$layer = [
			'type' => 'text',
			'x' => 100,
			'y' => 50,
			'text' => 'Hello',
			'blend' => 'multiply'
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid() );
		$data = $result->getData();
		$this->assertArrayHasKey( 'blendMode', $data );
		$this->assertEquals( 'multiply', $data['blendMode'] );
		$this->assertArrayNotHasKey( 'blend', $data );
	}

	/**
	 * @covers ::getMaxLayerCount
	 */
	public function testGetMaxLayerCount() {
		$validator = $this->createValidator();

		$maxCount = $validator->getMaxLayerCount();
		$this->assertIsInt( $maxCount );
		$this->assertGreaterThan( 0, $maxCount );
	}

	/**
	 * @covers ::getSupportedLayerTypes
	 */
	public function testGetSupportedLayerTypes() {
		$validator = $this->createValidator();

		$types = $validator->getSupportedLayerTypes();
		$this->assertIsArray( $types );
		$this->assertContains( 'text', $types );
		$this->assertContains( 'rectangle', $types );
		$this->assertContains( 'circle', $types );
	}

	/**
	 * @covers ::isLayerTypeSupported
	 */
	public function testIsLayerTypeSupported() {
		$validator = $this->createValidator();

		$this->assertTrue( $validator->isLayerTypeSupported( 'text' ) );
		$this->assertTrue( $validator->isLayerTypeSupported( 'rectangle' ) );
		$this->assertTrue( $validator->isLayerTypeSupported( 'circle' ) );
		$this->assertFalse( $validator->isLayerTypeSupported( 'unsupported' ) );
	}

	/**
	 * @covers ::validateLayer
	 */
	public function testValidateLayerNumericConstraints() {
		$validator = $this->createValidator();

		// Test opacity constraints
		$layer = [
			'type' => 'text',
			'text' => 'Hello',
			'opacity' => 1.5 // Invalid opacity > 1
		];

		$result = $validator->validateLayer( $layer );
		$this->assertTrue( $result->hasWarnings() ); // Should generate warning for invalid opacity
	}

	/**
	 * @covers ::validateLayer
	 */
	public function testValidateLayerArrayProperties() {
		$validator = $this->createValidator();

		$layer = [
			'type' => 'polygon',
			'points' => [
				[ 'x' => 10, 'y' => 10 ],
				[ 'x' => 50, 'y' => 10 ],
				[ 'x' => 30, 'y' => 50 ]
			]
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid() );
		$data = $result->getData();
		$this->assertArrayHasKey( 'points', $data );
		$this->assertCount( 3, $data['points'] );
	}
}
