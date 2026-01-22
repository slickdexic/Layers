<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Validation;

use MediaWiki\Extension\Layers\Validation\SlideNameValidator;

/**
 * @covers \MediaWiki\Extension\Layers\Validation\SlideNameValidator
 */
class SlideNameValidatorTest extends \MediaWikiUnitTestCase {

	private function createValidator(): SlideNameValidator {
		return new SlideNameValidator();
	}

	/**
	 * @covers ::isValid
	 * @dataProvider provideValidNames
	 */
	public function testIsValidWithValidNames( string $name ) {
		$validator = $this->createValidator();
		$this->assertTrue( $validator->isValid( $name ), "Name '$name' should be valid" );
	}

	public static function provideValidNames(): array {
		return [
			'simple name' => [ 'myslide' ],
			'with numbers' => [ 'slide123' ],
			'with hyphen' => [ 'my-slide' ],
			'with underscore' => [ 'my_slide' ],
			'mixed' => [ 'My-Slide_123' ],
			'single character' => [ 'a' ],
			'max length' => [ str_repeat( 'a', 100 ) ],
			'starting with number' => [ '123slide' ],
			'complex mix' => [ 'my_cool-slide-2024_v1' ],
		];
	}

	/**
	 * @covers ::isValid
	 * @dataProvider provideInvalidNames
	 */
	public function testIsValidWithInvalidNames( string $name ) {
		$validator = $this->createValidator();
		$this->assertFalse( $validator->isValid( $name ), "Name '$name' should be invalid" );
	}

	public static function provideInvalidNames(): array {
		return [
			'empty string' => [ '' ],
			'too long' => [ str_repeat( 'a', 101 ) ],
			'with space' => [ 'my slide' ],
			'with dot' => [ 'my.slide' ],
			'with slash' => [ 'my/slide' ],
			'with colon' => [ 'my:slide' ],
			'with special chars' => [ 'slide@#$%' ],
			'with quotes' => [ 'slide"test' ],
			'with angle brackets' => [ 'slide<test>' ],
			'with pipe' => [ 'slide|test' ],
		];
	}

	/**
	 * @covers ::isValid
	 * @dataProvider provideReservedNames
	 */
	public function testIsValidRejectsReservedNames( string $name ) {
		$validator = $this->createValidator();
		$this->assertFalse( $validator->isValid( $name ), "Reserved name '$name' should be invalid" );
	}

	public static function provideReservedNames(): array {
		return [
			'new' => [ 'new' ],
			'create' => [ 'create' ],
			'delete' => [ 'delete' ],
			'edit' => [ 'edit' ],
			'list' => [ 'list' ],
			'all' => [ 'all' ],
			'none' => [ 'none' ],
			'null' => [ 'null' ],
			'undefined' => [ 'undefined' ],
			// Case variations
			'NEW uppercase' => [ 'NEW' ],
			'Delete mixed case' => [ 'Delete' ],
		];
	}

	/**
	 * @covers ::validate
	 */
	public function testValidateReturnsNullForValidNames() {
		$validator = $this->createValidator();
		$this->assertNull( $validator->validate( 'valid-name' ) );
		$this->assertNull( $validator->validate( 'my_slide_123' ) );
	}

	/**
	 * @covers ::validate
	 */
	public function testValidateReturnsErrorKeyForInvalidNames() {
		$validator = $this->createValidator();

		$this->assertEquals( 'layers-slide-name-required', $validator->validate( '' ) );
		$this->assertEquals( 'layers-slide-invalid-name', $validator->validate( 'my slide' ) );
		$this->assertEquals( 'layers-slide-name-too-long', $validator->validate( str_repeat( 'a', 101 ) ) );
		$this->assertEquals( 'layers-slide-name-reserved', $validator->validate( 'new' ) );
		$this->assertEquals( 'layers-slide-name-reserved', $validator->validate( 'DELETE' ) );
	}

	/**
	 * @covers ::sanitize
	 * @dataProvider provideSanitizationCases
	 */
	public function testSanitize( string $input, string $expected ) {
		$validator = $this->createValidator();
		$this->assertEquals( $expected, $validator->sanitize( $input ) );
	}

	public static function provideSanitizationCases(): array {
		return [
			'already valid' => [ 'myslide', 'myslide' ],
			'spaces to hyphens' => [ 'my slide', 'my-slide' ],
			'multiple spaces' => [ 'my  long  slide', 'my-long-slide' ],
			'trim spaces' => [ '  myslide  ', 'myslide' ],
			'remove special chars' => [ 'my@slide#123', 'myslide123' ],
			'preserve allowed chars' => [ 'My-Slide_123', 'My-Slide_123' ],
			'truncate long name' => [ str_repeat( 'a', 150 ), str_repeat( 'a', 100 ) ],
		];
	}

	/**
	 * @covers ::isValid
	 */
	public function testIsValidHandlesNullInput() {
		$validator = $this->createValidator();
		$this->assertFalse( $validator->isValid( '' ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeRemovesLeadingHyphens() {
		$validator = $this->createValidator();
		// After removing special chars, leading/trailing hyphens should be cleaned
		$result = $validator->sanitize( '--slide--' );
		$this->assertStringNotMatches( '/^-/', $result );
		$this->assertStringNotMatches( '/-$/', $result );
	}
}
