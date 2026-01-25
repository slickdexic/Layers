<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Hooks;

use MediaWiki\Extension\Layers\Hooks\SlideHooks;

/**
 * Unit tests for SlideHooks.
 *
 * Tests the private helper methods using reflection. These tests focus on
 * the parsing and validation logic that doesn't require MediaWiki services.
 *
 * @covers \MediaWiki\Extension\Layers\Hooks\SlideHooks
 */
class SlideHooksTest extends \MediaWikiUnitTestCase {

	/**
	 * Create a mock Config object for testing.
	 *
	 * @param int $maxWidth Max slide width
	 * @param int $maxHeight Max slide height
	 * @return \Config
	 */
	private function createMockConfig( int $maxWidth = 4096, int $maxHeight = 4096 ) {
		$config = $this->createMock( \Config::class );
		$config->method( 'get' )
			->willReturnCallback( static function ( $key ) use ( $maxWidth, $maxHeight ) {
				switch ( $key ) {
					case 'LayersSlideMaxWidth':
						return $maxWidth;
					case 'LayersSlideMaxHeight':
						return $maxHeight;
					default:
						return null;
				}
			} );
		return $config;
	}

	/**
	 * Create a mock PPFrame for testing parseArguments.
	 *
	 * The mock frame simply returns the argument as-is (treats it as already expanded).
	 *
	 * @return \PPFrame
	 */
	private function createMockFrame() {
		$frame = $this->createMock( \PPFrame::class );
		$frame->method( 'expand' )
			->willReturnCallback( static function ( $arg ) {
				// In real usage, $arg is a PPNode; for tests we pass strings
				return is_string( $arg ) ? $arg : (string)$arg;
			} );
		return $frame;
	}

	/**
	 * @covers ::parseCanvasDimensions
	 * @dataProvider provideValidCanvasDimensions
	 */
	public function testParseCanvasDimensionsWithValidInput(
		string $input,
		int $expectedWidth,
		int $expectedHeight
	) {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'parseCanvasDimensions' );
		$method->setAccessible( true );

		$config = $this->createMockConfig();
		$result = $method->invoke( null, $input, $config );

		$this->assertIsArray( $result, 'Result should be an array' );
		$this->assertEquals( $expectedWidth, $result['width'], 'Width mismatch' );
		$this->assertEquals( $expectedHeight, $result['height'], 'Height mismatch' );
	}

	public static function provideValidCanvasDimensions(): array {
		return [
			'WxH format lowercase' => [ '800x600', 800, 600 ],
			'WxH format uppercase' => [ '800X600', 800, 600 ],
			'WxH with spaces' => [ ' 800 x 600 ', 800, 600 ],
			'large dimensions' => [ '1920x1080', 1920, 1080 ],
			'square' => [ '500x500', 500, 500 ],
			'wide format' => [ '1600x900', 1600, 900 ],
			'tall format' => [ '600x800', 600, 800 ],
			'minimum valid' => [ '50x50', 50, 50 ],
			'unicode multiplication sign' => [ '800×600', 800, 600 ],
		];
	}

	/**
	 * @covers ::parseCanvasDimensions
	 * @dataProvider provideInvalidCanvasDimensions
	 */
	public function testParseCanvasDimensionsWithInvalidInput( string $input ) {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'parseCanvasDimensions' );
		$method->setAccessible( true );

		$config = $this->createMockConfig();
		$result = $method->invoke( null, $input, $config );

		$this->assertNull( $result, "Invalid input '$input' should return null" );
	}

	public static function provideInvalidCanvasDimensions(): array {
		return [
			'invalid format' => [ 'invalid' ],
			'empty string' => [ '' ],
			'single number' => [ '800' ],
			'negative width' => [ '-100x600' ],
			'negative height' => [ '800x-100' ],
			'zero width' => [ '0x600' ],
			'zero height' => [ '800x0' ],
			'below minimum' => [ '49x49' ],
			'text with numbers' => [ 'widthx600' ],
			'special characters' => [ '800@600' ],
		];
	}

	/**
	 * @covers ::parseCanvasDimensions
	 */
	public function testParseCanvasDimensionsClampsToMaximum() {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'parseCanvasDimensions' );
		$method->setAccessible( true );

		$config = $this->createMockConfig( 4096, 4096 );
		$result = $method->invoke( null, '5000x6000', $config );

		$this->assertIsArray( $result );
		$this->assertLessThanOrEqual( 4096, $result['width'], 'Width should be clamped to max' );
		$this->assertLessThanOrEqual( 4096, $result['height'], 'Height should be clamped to max' );
	}

	/**
	 * @covers ::parseArguments
	 */
	public function testParseArgumentsExtractsSlideName() {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'parseArguments' );
		$method->setAccessible( true );

		$frame = $this->createMockFrame();
		$args = [ 'MySlideName' ];

		$result = $method->invoke( null, $frame, $args );

		$this->assertArrayHasKey( 'name', $result );
		$this->assertEquals( 'MySlideName', $result['name'] );
	}

	/**
	 * @covers ::parseArguments
	 */
	public function testParseArgumentsExtractsKeyValuePairs() {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'parseArguments' );
		$method->setAccessible( true );

		$frame = $this->createMockFrame();
		$args = [
			'MySlideName',
			'canvas=1024x768',
			'lock=size',
			'background=#ff0000',
			'class=my-custom-class',
			'placeholder=Click to add content',
			'editable=yes',
			'layerset=annotations',
		];

		$result = $method->invoke( null, $frame, $args );

		$this->assertEquals( 'MySlideName', $result['name'] );
		$this->assertEquals( '1024x768', $result['canvas'] );
		$this->assertEquals( 'size', $result['lock'] );
		$this->assertEquals( '#ff0000', $result['background'] );
		$this->assertEquals( 'my-custom-class', $result['class'] );
		$this->assertEquals( 'Click to add content', $result['placeholder'] );
		$this->assertEquals( 'yes', $result['editable'] );
		$this->assertEquals( 'annotations', $result['layerset'] );
	}

	/**
	 * @covers ::parseArguments
	 */
	public function testParseArgumentsTrimsWhitespace() {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'parseArguments' );
		$method->setAccessible( true );

		$frame = $this->createMockFrame();
		$args = [
			'  MySlideName  ',
			'  canvas = 800x600  ',
			'  lock = all  ',
		];

		$result = $method->invoke( null, $frame, $args );

		$this->assertEquals( 'MySlideName', $result['name'] );
		$this->assertEquals( '800x600', $result['canvas'] );
		$this->assertEquals( 'all', $result['lock'] );
	}

	/**
	 * @covers ::parseArguments
	 */
	public function testParseArgumentsLowercasesKeys() {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'parseArguments' );
		$method->setAccessible( true );

		$frame = $this->createMockFrame();
		$args = [
			'MySlideName',
			'Canvas=800x600',
			'LOCK=size',
			'LayerSet=mySet',
		];

		$result = $method->invoke( null, $frame, $args );

		$this->assertArrayHasKey( 'canvas', $result );
		$this->assertArrayHasKey( 'lock', $result );
		$this->assertArrayHasKey( 'layerset', $result );
	}

	/**
	 * @covers ::parseArguments
	 */
	public function testParseArgumentsHandlesEmptyArgs() {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'parseArguments' );
		$method->setAccessible( true );

		$frame = $this->createMockFrame();
		$result = $method->invoke( null, $frame, [] );

		$this->assertIsArray( $result );
		$this->assertArrayNotHasKey( 'name', $result );
	}

	/**
	 * @covers ::sanitizeCssClasses
	 * @dataProvider provideValidCssClasses
	 */
	public function testSanitizeCssClassesWithValidInput( string $input, array $expected ) {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'sanitizeCssClasses' );
		$method->setAccessible( true );

		$result = $method->invoke( null, $input );

		$this->assertEquals( $expected, $result );
	}

	public static function provideValidCssClasses(): array {
		return [
			'simple class' => [ 'myclass', [ 'myclass' ] ],
			'multiple classes' => [ 'class1 class2 class3', [ 'class1', 'class2', 'class3' ] ],
			'with hyphen' => [ 'my-class', [ 'my-class' ] ],
			'with underscore' => [ 'my_class', [ 'my_class' ] ],
			'with numbers' => [ 'class123', [ 'class123' ] ],
			'mixed valid' => [ 'one two-three four_5', [ 'one', 'two-three', 'four_5' ] ],
		];
	}

	/**
	 * @covers ::sanitizeCssClasses
	 * @dataProvider provideInvalidCssClasses
	 */
	public function testSanitizeCssClassesFiltersInvalidClasses( string $input, array $expected ) {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'sanitizeCssClasses' );
		$method->setAccessible( true );

		$result = $method->invoke( null, $input );

		$this->assertEquals( $expected, $result );
	}

	public static function provideInvalidCssClasses(): array {
		return [
			'starts with number' => [ '123class', [] ],
			'starts with hyphen' => [ '-myclass', [] ],
			'starts with underscore' => [ '_myclass', [] ],
			'special chars' => [ 'class@special', [] ],
			'mixed valid and invalid' => [ 'valid 123invalid another-valid', [ 'valid', 'another-valid' ] ],
			'empty string' => [ '', [] ],
			'only whitespace' => [ '   ', [] ],
			'html injection attempt' => [ '<script>', [] ],
		];
	}

	/**
	 * @covers ::isValidColor
	 * @dataProvider provideValidColors
	 */
	public function testIsValidColorWithValidInput( string $color ) {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'isValidColor' );
		$method->setAccessible( true );

		$result = $method->invoke( null, $color );

		$this->assertTrue( $result, "Color '$color' should be valid" );
	}

	public static function provideValidColors(): array {
		return [
			'hex 3' => [ '#fff' ],
			'hex 6' => [ '#ffffff' ],
			'hex 8' => [ '#ffffff00' ],
			'uppercase hex' => [ '#FFFFFF' ],
			'mixed case hex' => [ '#FfFfFf' ],
			'rgb' => [ 'rgb(255, 255, 255)' ],
			'rgba' => [ 'rgba(255, 255, 255, 0.5)' ],
			'transparent' => [ 'transparent' ],
			'TRANSPARENT' => [ 'TRANSPARENT' ],
			'named white' => [ 'white' ],
			'named black' => [ 'black' ],
			'named red' => [ 'red' ],
			'named blue' => [ 'blue' ],
		];
	}

	/**
	 * @covers ::isValidColor
	 * @dataProvider provideInvalidColors
	 */
	public function testIsValidColorWithInvalidInput( string $color ) {
		$reflection = new \ReflectionClass( SlideHooks::class );
		$method = $reflection->getMethod( 'isValidColor' );
		$method->setAccessible( true );

		$result = $method->invoke( null, $color );

		$this->assertFalse( $result, "Color '$color' should be invalid" );
	}

	public static function provideInvalidColors(): array {
		return [
			'empty' => [ '' ],
			'hex without #' => [ 'ffffff' ],
			'hex wrong length' => [ '#ffff' ],
			'invalid named color' => [ 'notacolor' ],
			'javascript' => [ 'javascript:alert(1)' ],
			'expression' => [ 'expression(alert(1))' ],
			'url' => [ 'url(image.png)' ],
		];
	}
}
