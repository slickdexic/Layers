<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks\Processors;

use MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for LayersHtmlInjector
 *
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector
 * @group Layers
 */
class LayersHtmlInjectorTest extends TestCase {

	private LayersHtmlInjector $injector;

	protected function setUp(): void {
		parent::setUp();
		$this->injector = new LayersHtmlInjector();
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::buildPayload
	 */
	public function testBuildPayloadWithLayers(): void {
		$layers = [
			[ 'id' => '1', 'type' => 'rectangle', 'x' => 10, 'y' => 20 ]
		];

		$payload = $this->injector->buildPayload( $layers );

		$this->assertArrayHasKey( 'layers', $payload );
		$this->assertCount( 1, $payload['layers'] );
		$this->assertArrayNotHasKey( 'baseWidth', $payload );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::buildPayload
	 */
	public function testBuildPayloadWithDimensions(): void {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];

		$payload = $this->injector->buildPayload( $layers, 800, 600 );

		$this->assertArrayHasKey( 'baseWidth', $payload );
		$this->assertArrayHasKey( 'baseHeight', $payload );
		$this->assertEquals( 800, $payload['baseWidth'] );
		$this->assertEquals( 600, $payload['baseHeight'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::buildPayload
	 */
	public function testBuildPayloadIgnoresInvalidDimensions(): void {
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];

		$payload = $this->injector->buildPayload( $layers, 0, 600 );

		$this->assertArrayNotHasKey( 'baseWidth', $payload );
		$this->assertArrayNotHasKey( 'baseHeight', $payload );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::encodePayload
	 */
	public function testEncodePayload(): void {
		$payload = [ 'layers' => [], 'baseWidth' => 100 ];

		$encoded = $this->injector->encodePayload( $payload );

		$this->assertIsString( $encoded );
		$this->assertStringNotContainsString( '<', $encoded );
		$this->assertStringNotContainsString( '>', $encoded );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::addOrUpdateClass
	 */
	public function testAddClassToEmptyAttrs(): void {
		$result = $this->injector->addOrUpdateClass( '', 'layers-thumbnail' );

		$this->assertStringContainsString( 'class="layers-thumbnail"', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::addOrUpdateClass
	 */
	public function testAddClassToExistingClass(): void {
		$attrs = 'src="test.jpg" class="existing-class"';

		$result = $this->injector->addOrUpdateClass( $attrs, 'layers-thumbnail' );

		$this->assertStringContainsString( 'existing-class', $result );
		$this->assertStringContainsString( 'layers-thumbnail', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::addOrUpdateClass
	 */
	public function testAddClassDoesNotDuplicate(): void {
		$attrs = 'class="layers-thumbnail other-class"';

		$result = $this->injector->addOrUpdateClass( $attrs, 'layers-thumbnail' );

		// Should not add duplicate
		$count = substr_count( $result, 'layers-thumbnail' );
		$this->assertSame( 1, $count );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::addOrUpdateAttribute
	 */
	public function testAddNewAttribute(): void {
		$attrs = 'src="test.jpg"';

		$result = $this->injector->addOrUpdateAttribute( $attrs, 'data-test', 'value' );

		$this->assertStringContainsString( 'data-test="value"', $result );
		$this->assertStringContainsString( 'src="test.jpg"', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::addOrUpdateAttribute
	 */
	public function testUpdateExistingAttribute(): void {
		$attrs = 'src="test.jpg" data-test="old-value"';

		$result = $this->injector->addOrUpdateAttribute( $attrs, 'data-test', 'new-value' );

		$this->assertStringContainsString( 'data-test="new-value"', $result );
		$this->assertStringNotContainsString( 'old-value', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::injectIntoHtml
	 */
	public function testInjectIntoHtml(): void {
		$html = '<img src="test.jpg" alt="Test">';
		$layers = [ [ 'id' => '1', 'type' => 'rectangle' ] ];

		$result = $this->injector->injectIntoHtml( $html, $layers, 800, 600, 'test' );

		$this->assertStringContainsString( 'layers-thumbnail', $result );
		$this->assertStringContainsString( 'data-layer-data', $result );
		$this->assertStringContainsString( 'src="test.jpg"', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::injectIntoHtml
	 */
	public function testInjectIntoHtmlPreservesOtherTags(): void {
		$html = '<div><img src="test.jpg"><span>text</span></div>';
		$layers = [ [ 'id' => '1', 'type' => 'text' ] ];

		$result = $this->injector->injectIntoHtml( $html, $layers, null, null, 'test' );

		$this->assertStringContainsString( '<div>', $result );
		$this->assertStringContainsString( '<span>text</span>', $result );
		$this->assertStringContainsString( '</div>', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::injectIntentMarker
	 */
	public function testInjectIntentMarker(): void {
		$html = '<img src="test.jpg">';

		$result = $this->injector->injectIntentMarker( $html, 'on' );

		$this->assertStringContainsString( 'data-layers-intent="on"', $result );
		$this->assertStringContainsString( 'layers-thumbnail', $result );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::injectIntoAttributes
	 */
	public function testInjectIntoAttributes(): void {
		$attribs = [ 'src' => 'test.jpg', 'alt' => 'Test' ];
		$layers = [ [ 'id' => '1', 'type' => 'circle' ] ];

		$this->injector->injectIntoAttributes( $attribs, $layers, 800, 600 );

		$this->assertArrayHasKey( 'class', $attribs );
		$this->assertStringContainsString( 'layers-thumbnail', $attribs['class'] );
		$this->assertArrayHasKey( 'data-layer-data', $attribs );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::getFileDimensions
	 */
	public function testGetFileDimensionsWithNull(): void {
		$result = $this->injector->getFileDimensions( null );

		$this->assertNull( $result['width'] );
		$this->assertNull( $result['height'] );
	}

	/**
	 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayersHtmlInjector::getFileDimensions
	 */
	public function testGetFileDimensionsWithMockFile(): void {
		$mockFile = $this->createMock( \stdClass::class );

		// Since stdClass doesn't have getWidth/getHeight, dimensions should be null
		$result = $this->injector->getFileDimensions( $mockFile );

		$this->assertNull( $result['width'] );
		$this->assertNull( $result['height'] );
	}
}
