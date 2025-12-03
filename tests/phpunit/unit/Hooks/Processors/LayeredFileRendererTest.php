<?php
/**
 * Unit tests for LayeredFileRenderer processor
 *
 * @file
 * @ingroup Extensions
 */

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks\Processors;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Hooks\Processors\LayeredFileRenderer;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @covers \MediaWiki\Extension\Layers\Hooks\Processors\LayeredFileRenderer
 * @group Layers
 */
class LayeredFileRendererTest extends TestCase {

	/**
	 * @var LoggerInterface|\PHPUnit\Framework\MockObject\MockObject
	 */
	private $mockLogger;

	/**
	 * @var LayersDatabase|\PHPUnit\Framework\MockObject\MockObject
	 */
	private $mockDb;

	protected function setUp(): void {
		parent::setUp();

		$this->mockLogger = $this->createMock( LoggerInterface::class );
		$this->mockDb = $this->createMock( LayersDatabase::class );
	}

	/**
	 * Create a LayeredFileRenderer with mocks
	 */
	private function createRenderer(): LayeredFileRenderer {
		return new LayeredFileRenderer( $this->mockLogger, $this->mockDb );
	}

	/**
	 * @covers ::__construct
	 */
	public function testConstructorWithDefaults(): void {
		$renderer = new LayeredFileRenderer();
		$this->assertInstanceOf( LayeredFileRenderer::class, $renderer );
	}

	/**
	 * @covers ::__construct
	 */
	public function testConstructorWithLogger(): void {
		$renderer = new LayeredFileRenderer( $this->mockLogger );
		$this->assertInstanceOf( LayeredFileRenderer::class, $renderer );
	}

	/**
	 * @covers ::__construct
	 */
	public function testConstructorWithDatabase(): void {
		$renderer = new LayeredFileRenderer( $this->mockLogger, $this->mockDb );
		$this->assertInstanceOf( LayeredFileRenderer::class, $renderer );
	}

	/**
	 * @covers ::render
	 */
	public function testRenderWithEmptyArgs(): void {
		$renderer = $this->createRenderer();

		$mockParser = $this->createMock( \stdClass::class );
		$mockFrame = $this->createMock( \stdClass::class );

		$result = $renderer->render( $mockParser, $mockFrame, [] );

		$this->assertStringContainsString( 'error', $result );
		$this->assertStringContainsString( 'No filename specified', $result );
	}

	/**
	 * @covers ::render
	 */
	public function testRenderWithEmptyFilename(): void {
		$renderer = $this->createRenderer();

		$mockParser = $this->createMock( \stdClass::class );
		$mockFrame = $this->createMockFrame( '' );

		$result = $renderer->render( $mockParser, $mockFrame, [ '' ] );

		$this->assertStringContainsString( 'error', $result );
		$this->assertStringContainsString( 'No filename specified', $result );
	}

	/**
	 * @covers ::render
	 */
	public function testRenderWithWhitespaceOnlyFilename(): void {
		$renderer = $this->createRenderer();

		$mockParser = $this->createMock( \stdClass::class );
		$mockFrame = $this->createMockFrame( '   ' );

		$result = $renderer->render( $mockParser, $mockFrame, [ '   ' ] );

		$this->assertStringContainsString( 'error', $result );
		$this->assertStringContainsString( 'No filename specified', $result );
	}

	/**
	 * @covers ::render
	 * Test with file not found (MediaWikiServices not available in unit tests)
	 */
	public function testRenderWithFileNotFound(): void {
		// This test would require integration setup
		// In unit test context, services are not available
		$this->markTestSkipped( 'Requires MediaWiki integration environment' );
	}

	/**
	 * Test error span output format
	 */
	public function testErrorSpanOutput(): void {
		$renderer = $this->createRenderer();

		$mockParser = $this->createMock( \stdClass::class );
		$mockFrame = $this->createMock( \stdClass::class );

		$result = $renderer->render( $mockParser, $mockFrame, [] );

		// Should have proper HTML error class
		$this->assertStringContainsString( '<span class="error">', $result );
		$this->assertStringContainsString( '</span>', $result );
	}

	/**
	 * Test that error messages are HTML-escaped
	 */
	public function testErrorMessagesAreEscaped(): void {
		$renderer = $this->createRenderer();

		$mockParser = $this->createMock( \stdClass::class );
		$mockFrame = $this->createMockFrame( '<script>alert("xss")</script>' );

		// This should not execute the script, even if filename contains malicious content
		$result = $renderer->render( $mockParser, $mockFrame, [ '<script>alert("xss")</script>' ] );

		// File won't be found, but filename in error should be escaped
		$this->assertStringNotContainsString( '<script>', $result );
	}

	/**
	 * Test parseLayersArg method via reflection
	 * @dataProvider provideLayersArguments
	 */
	public function testParseLayersArg( string $input, string $expected ): void {
		$renderer = $this->createRenderer();

		// Use reflection to test private method
		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'parseLayersArg' );
		$method->setAccessible( true );

		$result = $method->invoke( $renderer, $input );
		$this->assertSame( $expected, $result );
	}

	/**
	 * Data provider for parseLayersArg tests
	 */
	public static function provideLayersArguments(): array {
		return [
			'empty string' => [ '', 'off' ],
			'layers keyword only' => [ 'layers', 'on' ],
			'on keyword' => [ 'on', 'on' ],
			'off keyword' => [ 'off', 'off' ],
			'layers=on' => [ 'layers=on', 'on' ],
			'layers=off' => [ 'layers=off', 'off' ],
			'layers=default' => [ 'layers=default', 'default' ],
			'layers=mysetname' => [ 'layers=mysetname', 'mysetname' ],
			'layers=id:123' => [ 'layers=id:123', 'id:123' ],
			'layers=name:anatomy' => [ 'layers=name:anatomy', 'name:anatomy' ],
			'random other value' => [ 'random', 'off' ],
		];
	}

	/**
	 * Test parseSize method via reflection
	 * @dataProvider provideSizeArguments
	 */
	public function testParseSize( string $input, int $expected ): void {
		$renderer = $this->createRenderer();

		// Use reflection to test private method
		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'parseSize' );
		$method->setAccessible( true );

		$result = $method->invoke( $renderer, $input );
		$this->assertSame( $expected, $result );
	}

	/**
	 * Data provider for parseSize tests
	 */
	public static function provideSizeArguments(): array {
		return [
			'width pixels' => [ '400px', 400 ],
			'height pixels' => [ 'x300px', 300 ],
			'thumb keyword' => [ 'thumb', 220 ],
			'empty string' => [ '', 300 ],
			'invalid value' => [ 'invalid', 300 ],
			'number without px' => [ '500', 300 ],
			'very large value' => [ '9999px', 9999 ],
			'zero' => [ '0px', 0 ],
		];
	}

	/**
	 * Test buildImageHtml method via reflection
	 */
	public function testBuildImageHtml(): void {
		$renderer = $this->createRenderer();

		// Use reflection to test private method
		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'buildImageHtml' );
		$method->setAccessible( true );

		$result = $method->invoke( $renderer, 'Test.jpg', 'http://example.com/thumb.jpg', 300, 'Test caption' );

		// Check required elements
		$this->assertStringContainsString( '<img', $result );
		$this->assertStringContainsString( 'src="http://example.com/thumb.jpg"', $result );
		$this->assertStringContainsString( 'width="300"', $result );
		$this->assertStringContainsString( 'alt="Test caption"', $result );
		$this->assertStringContainsString( 'mw-file-element', $result );
		$this->assertStringContainsString( '<a href=', $result );
		$this->assertStringContainsString( 'File:Test.jpg', $result );
	}

	/**
	 * Test buildImageHtml escapes HTML in filename
	 */
	public function testBuildImageHtmlEscapesFilename(): void {
		$renderer = $this->createRenderer();

		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'buildImageHtml' );
		$method->setAccessible( true );

		$result = $method->invoke( $renderer, 'Test<script>.jpg', 'http://example.com/thumb.jpg', 300, '' );

		// Script tag should be escaped
		$this->assertStringNotContainsString( '<script>', $result );
		$this->assertStringContainsString( '&lt;script&gt;', $result );
	}

	/**
	 * Test buildImageHtml escapes HTML in caption
	 */
	public function testBuildImageHtmlEscapesCaption(): void {
		$renderer = $this->createRenderer();

		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'buildImageHtml' );
		$method->setAccessible( true );

		$result = $method->invoke( $renderer, 'Test.jpg', 'http://example.com/thumb.jpg', 300, '<script>xss</script>' );

		// Script tag should be escaped
		$this->assertStringNotContainsString( '<script>xss</script>', $result );
	}

	/**
	 * Test buildImageHtml with empty caption uses filename
	 */
	public function testBuildImageHtmlEmptyCaptionUsesFilename(): void {
		$renderer = $this->createRenderer();

		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'buildImageHtml' );
		$method->setAccessible( true );

		$result = $method->invoke( $renderer, 'Test.jpg', 'http://example.com/thumb.jpg', 300, '' );

		$this->assertStringContainsString( 'alt="Test.jpg"', $result );
	}

	/**
	 * Test that errorSpan method produces proper HTML
	 */
	public function testErrorSpan(): void {
		$renderer = $this->createRenderer();

		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'errorSpan' );
		$method->setAccessible( true );

		$result = $method->invoke( $renderer, 'Test error message' );

		$this->assertSame( '<span class="error">Test error message</span>', $result );
	}

	/**
	 * Test that errorSpan escapes HTML
	 */
	public function testErrorSpanEscapesHtml(): void {
		$renderer = $this->createRenderer();

		$reflection = new \ReflectionClass( $renderer );
		$method = $reflection->getMethod( 'errorSpan' );
		$method->setAccessible( true );

		$result = $method->invoke( $renderer, '<script>xss</script>' );

		$this->assertStringNotContainsString( '<script>', $result );
		$this->assertStringContainsString( '&lt;script&gt;', $result );
	}

	/**
	 * Create a mock frame that expands arguments
	 *
	 * @param string $expandValue Value to return from expand()
	 * @return \PHPUnit\Framework\MockObject\MockObject
	 */
	private function createMockFrame( string $expandValue ) {
		$frame = $this->createMock( \stdClass::class );
		$frame->method( '__call' )
			->willReturnCallback( static function ( $name, $args ) use ( $expandValue ) {
				if ( $name === 'expand' ) {
					return $expandValue;
				}
				return null;
			} );
		return $frame;
	}
}
