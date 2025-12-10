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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayers
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayers
	 */
	public function testValidateLayersEmpty() {
		$validator = $this->createValidator();

		$result = $validator->validateLayers( [] );

		$this->assertTrue( $result->isValid() );
		$this->assertSame( [], $result->getData() );
		$this->assertTrue( $result->hasWarnings() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayers
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::getMaxLayerCount
	 */
	public function testGetMaxLayerCount() {
		$validator = $this->createValidator();

		$maxCount = $validator->getMaxLayerCount();
		$this->assertIsInt( $maxCount );
		$this->assertGreaterThan( 0, $maxCount );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::getSupportedLayerTypes
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
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::isLayerTypeSupported
	 */
	public function testIsLayerTypeSupported() {
		$validator = $this->createValidator();

		$this->assertTrue( $validator->isLayerTypeSupported( 'text' ) );
		$this->assertTrue( $validator->isLayerTypeSupported( 'rectangle' ) );
		$this->assertTrue( $validator->isLayerTypeSupported( 'circle' ) );
		$this->assertFalse( $validator->isLayerTypeSupported( 'unsupported' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateLayerNumericConstraints() {
		$validator = $this->createValidator();

		// Test opacity constraints
		$layer = [
			'type' => 'text',
			'text' => 'Hello',
			// Invalid opacity > 1
			'opacity' => 1.5
		];

		$result = $validator->validateLayer( $layer );
		// Should generate warning for invalid opacity
		$this->assertTrue( $result->hasWarnings() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
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

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateLayerPolygonParametricDefinition() {
		$validator = $this->createValidator();

		$layer = [
			'type' => 'polygon',
			'x' => 100,
			'y' => 120,
			'radius' => 45,
			'sides' => 6,
			'stroke' => '#000000'
		];

		$result = $validator->validateLayer( $layer );
		$this->assertTrue( $result->isValid(), 'Polygon defined via radius/sides should validate' );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateLayerPolygonMissingGeometry() {
		$validator = $this->createValidator();

		$layer = [ 'type' => 'polygon' ];
		$result = $validator->validateLayer( $layer );

		$this->assertFalse( $result->isValid() );
		$this->assertStringContainsString( 'Polygon layer must', $result->getErrors()[0] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateLayerEllipseWithRadii() {
		$validator = $this->createValidator();

		// Ellipse defined with radiusX/radiusY (client-side format)
		$layer = [
			'type' => 'ellipse',
			'x' => 100,
			'y' => 100,
			'radiusX' => 50,
			'radiusY' => 30,
			'stroke' => '#ff0000',
			'fill' => '#00ff00'
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid(), 'Ellipse with radiusX/radiusY should validate' );
		$data = $result->getData();
		$this->assertEquals( 'ellipse', $data['type'] );
		$this->assertEquals( 50, $data['radiusX'] );
		$this->assertEquals( 30, $data['radiusY'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateLayerEllipseWithWidthHeight() {
		$validator = $this->createValidator();

		// Ellipse defined with width/height (legacy format)
		$layer = [
			'type' => 'ellipse',
			'x' => 100,
			'y' => 100,
			'width' => 100,
			'height' => 60,
			'stroke' => '#ff0000'
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid(), 'Ellipse with width/height should validate' );
		$data = $result->getData();
		$this->assertEquals( 'ellipse', $data['type'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateLayerEllipseMissingDimensions() {
		$validator = $this->createValidator();

		// Ellipse without any dimensions should fail
		$layer = [
			'type' => 'ellipse',
			'x' => 100,
			'y' => 100
		];

		$result = $validator->validateLayer( $layer );

		$this->assertFalse( $result->isValid() );
		$this->assertStringContainsString( 'ellipse layer must have', $result->getErrors()[0] );
	}
}
