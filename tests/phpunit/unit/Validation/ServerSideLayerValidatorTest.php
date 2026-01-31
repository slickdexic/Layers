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

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateLayerGroupType() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'group_1',
			'type' => 'group',
			'name' => 'My Group',
			'children' => [ 'layer_1', 'layer_2' ],
			'expanded' => true
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid(), 'Group layer should validate successfully' );
		$data = $result->getData();
		$this->assertEquals( 'group', $data['type'] );
		$this->assertEquals( 'My Group', $data['name'] );
		$this->assertEquals( [ 'layer_1', 'layer_2' ], $data['children'] );
		$this->assertTrue( $data['expanded'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateLayerGroupWithParentGroup() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'nested_group',
			'type' => 'group',
			'name' => 'Nested Group',
			'children' => [ 'layer_3' ],
			'parentGroup' => 'group_1',
			'expanded' => false
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid(), 'Nested group with parentGroup should validate' );
		$data = $result->getData();
		$this->assertEquals( 'group_1', $data['parentGroup'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateLayerGroupEmptyChildren() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'empty_group',
			'type' => 'group',
			'name' => 'Empty Group',
			'children' => []
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid(), 'Group with empty children array should validate' );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::isLayerTypeSupported
	 */
	public function testGroupTypeIsSupported() {
		$validator = $this->createValidator();

		$this->assertTrue( $validator->isLayerTypeSupported( 'group' ) );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::getSupportedLayerTypes
	 */
	public function testGetSupportedLayerTypesIncludesGroup() {
		$validator = $this->createValidator();

		$types = $validator->getSupportedLayerTypes();
		$this->assertContains( 'group', $types );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateCustomShapeWithSvg() {
		$validator = $this->createValidator();

		// This mimics what the JavaScript client sends for a shape library SVG symbol
		$layer = [
			'id' => 'layer_1',
			'type' => 'customShape',
			'shapeId' => 'iso7010-w/iso_7010_w001',
			'viewBox' => [ 0, 0, 600, 524 ],
			'x' => 100,
			'y' => 100,
			'width' => 200,
			'height' => 175,
			'name' => 'W001',
			'svg' => '<svg viewBox="0 0 600 524" xmlns="http://www.w3.org/2000/svg">' .
				'<path d="m300 16 284 492h-568z" fill="#F9A800" stroke-linejoin="round" ' .
				'stroke="#000" stroke-width="32"/>' .
				'<path d="m337 192a37 37 0 0 0-74 0l11 143a26 26 0 0 0 52 0m12 85a38 38 0 1 1 0-1"/>' .
				'</svg>',
			'stroke' => '#000000',
			'fill' => 'none'
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid(), 'customShape with SVG should validate: ' .
			implode( '; ', $result->getErrors() ) );
		$data = $result->getData();
		$this->assertEquals( 'customShape', $data['type'] );
		$this->assertEquals( 'iso7010-w/iso_7010_w001', $data['shapeId'] );
		$this->assertEquals( [ 0, 0, 600, 524 ], $data['viewBox'] );
		$this->assertStringContainsString( '<svg', $data['svg'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateCustomShapeWithIsMultiPath() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'layer_2',
			'type' => 'customShape',
			'shapeId' => 'safety/warning',
			'viewBox' => [ 0, 0, 100, 100 ],
			'x' => 50,
			'y' => 50,
			'width' => 100,
			'height' => 100,
			'name' => 'Warning Sign',
			'paths' => [
				[ 'path' => 'M0,0 L50,100 L100,0 Z', 'fill' => '#ff0000' ],
				[ 'path' => 'M25,25 L50,75 L75,25 Z', 'fill' => '#ffffff' ]
			],
			'isMultiPath' => true
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid(), 'customShape with paths and isMultiPath should validate: ' .
			implode( '; ', $result->getErrors() ) );
		$data = $result->getData();
		$this->assertTrue( $data['isMultiPath'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateCustomShapeWithStrokeOnly() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'layer_3',
			'type' => 'customShape',
			'shapeId' => 'icons/arrow',
			'viewBox' => [ 0, 0, 24, 24 ],
			'x' => 10,
			'y' => 10,
			'width' => 48,
			'height' => 48,
			'name' => 'Arrow Icon',
			'path' => 'M12,4 L20,12 L12,20 M4,12 L20,12',
			'stroke' => '#000000',
			'fill' => 'transparent',
			'strokeOnly' => true
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid(), 'customShape with strokeOnly should validate: ' .
			implode( '; ', $result->getErrors() ) );
		$data = $result->getData();
		$this->assertTrue( $data['strokeOnly'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::getSupportedLayerTypes
	 */
	public function testGetSupportedLayerTypesIncludesCustomShape() {
		$validator = $this->createValidator();

		$types = $validator->getSupportedLayerTypes();
		$this->assertContains( 'customShape', $types );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateTextboxWithRichText() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'layer_rich1',
			'type' => 'textbox',
			'x' => 10,
			'y' => 10,
			'width' => 200,
			'height' => 100,
			'text' => 'Hello',
			'richText' => [
				[ 'text' => 'Hello ', 'style' => [ 'fontWeight' => 'bold' ] ],
				[ 'text' => 'World', 'style' => [ 'fontStyle' => 'italic' ] ]
			]
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid(), 'textbox with richText should validate: ' .
			implode( '; ', $result->getErrors() ) );
		$data = $result->getData();
		$this->assertArrayHasKey( 'richText', $data );
		$this->assertCount( 2, $data['richText'] );
		$this->assertSame( 'Hello ', $data['richText'][0]['text'] );
		$this->assertSame( 'bold', $data['richText'][0]['style']['fontWeight'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateRichTextWithUnderline() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'layer_rich2',
			'type' => 'textbox',
			'x' => 10,
			'y' => 10,
			'width' => 200,
			'height' => 100,
			'richText' => [
				[ 'text' => 'Underlined', 'style' => [ 'textDecoration' => 'underline' ] ]
			]
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid() );
		$data = $result->getData();
		$this->assertSame( 'underline', $data['richText'][0]['style']['textDecoration'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateRichTextWithStrikethrough() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'layer_rich3',
			'type' => 'callout',
			'x' => 10,
			'y' => 10,
			'width' => 200,
			'height' => 100,
			'richText' => [
				[ 'text' => 'Crossed out', 'style' => [ 'textDecoration' => 'line-through' ] ]
			]
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid() );
		$data = $result->getData();
		$this->assertSame( 'line-through', $data['richText'][0]['style']['textDecoration'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateRichTextWithHighlight() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'layer_rich4',
			'type' => 'textbox',
			'x' => 10,
			'y' => 10,
			'width' => 200,
			'height' => 100,
			'richText' => [
				[ 'text' => 'Highlighted', 'style' => [ 'backgroundColor' => 'rgba(255, 255, 0, 0.5)' ] ]
			]
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid() );
		$data = $result->getData();
		$this->assertArrayHasKey( 'backgroundColor', $data['richText'][0]['style'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateRichTextTooManyRuns() {
		$validator = $this->createValidator();

		// Create 101 runs (exceeds limit of 100)
		$runs = [];
		for ( $i = 0; $i < 101; $i++ ) {
			$runs[] = [ 'text' => 'Run ' . $i ];
		}

		$layer = [
			'id' => 'layer_rich5',
			'type' => 'textbox',
			'x' => 10,
			'y' => 10,
			'width' => 200,
			'height' => 100,
			'richText' => $runs
		];

		$result = $validator->validateLayer( $layer );

		$this->assertFalse( $result->isValid() );
		$this->assertTrue( $result->hasErrors() );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateRichTextInvalidTextDecoration() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'layer_rich6',
			'type' => 'textbox',
			'x' => 10,
			'y' => 10,
			'width' => 200,
			'height' => 100,
			'richText' => [
				[ 'text' => 'Test', 'style' => [ 'textDecoration' => 'invalid-value' ] ]
			]
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid() );
		$data = $result->getData();
		// Invalid textDecoration should be stripped
		$this->assertArrayNotHasKey( 'textDecoration', $data['richText'][0]['style'] ?? [] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateLayer
	 */
	public function testValidateRichTextPreservesMultipleStyles() {
		$validator = $this->createValidator();

		$layer = [
			'id' => 'layer_rich7',
			'type' => 'textbox',
			'x' => 10,
			'y' => 10,
			'width' => 200,
			'height' => 100,
			'richText' => [
				[
					'text' => 'Multi-styled',
					'style' => [
						'fontWeight' => 'bold',
						'fontStyle' => 'italic',
						'textDecoration' => 'underline',
						'backgroundColor' => '#ffff00',
						'color' => '#ff0000'
					]
				]
			]
		];

		$result = $validator->validateLayer( $layer );

		$this->assertTrue( $result->isValid() );
		$data = $result->getData();
		$style = $data['richText'][0]['style'];
		$this->assertSame( 'bold', $style['fontWeight'] );
		$this->assertSame( 'italic', $style['fontStyle'] );
		$this->assertSame( 'underline', $style['textDecoration'] );
		$this->assertArrayHasKey( 'backgroundColor', $style );
		$this->assertArrayHasKey( 'color', $style );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateSvgContent
	 * Tests that entity-encoded script bypass is blocked.
	 */
	public function testValidateSvgBlocksEntityEncodedScript() {
		$validator = $this->createValidator();
		$method = new \ReflectionMethod( $validator, 'validateSvgContent' );
		$method->setAccessible( true );

		// Entity-encoded <script> tag: &lt;script&gt;
		$svg = '<svg xmlns="http://www.w3.org/2000/svg">&lt;script&gt;alert(1)&lt;/script&gt;</svg>';
		$result = $method->invoke( $validator, $svg );

		$this->assertFalse( $result['valid'], 'Entity-encoded script should be blocked' );
		$this->assertStringContainsString( 'script', $result['error'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateSvgContent
	 * Tests that entity-encoded javascript: URL bypass is blocked.
	 */
	public function testValidateSvgBlocksEntityEncodedJavascriptUrl() {
		$validator = $this->createValidator();
		$method = new \ReflectionMethod( $validator, 'validateSvgContent' );
		$method->setAccessible( true );

		// Entity-encoded javascript: (java&#115;cript:)
		$svg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="java&#115;cript:alert(1)">click</a></svg>';
		$result = $method->invoke( $validator, $svg );

		$this->assertFalse( $result['valid'], 'Entity-encoded javascript: URL should be blocked' );
		$this->assertStringContainsString( 'javascript', $result['error'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateSvgContent
	 * Tests that entity-encoded event handler bypass is blocked.
	 */
	public function testValidateSvgBlocksEntityEncodedEventHandler() {
		$validator = $this->createValidator();
		$method = new \ReflectionMethod( $validator, 'validateSvgContent' );
		$method->setAccessible( true );

		// Entity-encoded onload (&#111;nload)
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" &#111;nload="alert(1)"></svg>';
		$result = $method->invoke( $validator, $svg );

		$this->assertFalse( $result['valid'], 'Entity-encoded event handler should be blocked' );
		$this->assertStringContainsString( 'event handler', $result['error'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateSvgContent
	 * Tests that valid SVG still passes validation.
	 */
	public function testValidateSvgAcceptsValidSvg() {
		$validator = $this->createValidator();
		$method = new \ReflectionMethod( $validator, 'validateSvgContent' );
		$method->setAccessible( true );

		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
		$result = $method->invoke( $validator, $svg );

		$this->assertTrue( $result['valid'], 'Valid SVG should pass validation' );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator::validateSvgContent
	 * Tests that vbscript: URLs are blocked.
	 */
	public function testValidateSvgBlocksVbscriptUrl() {
		$validator = $this->createValidator();
		$method = new \ReflectionMethod( $validator, 'validateSvgContent' );
		$method->setAccessible( true );

		$svg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="vbscript:msgbox(1)">click</a></svg>';
		$result = $method->invoke( $validator, $svg );

		$this->assertFalse( $result['valid'], 'vbscript: URLs should be blocked' );
		$this->assertStringContainsString( 'vbscript', $result['error'] );
	}
}
