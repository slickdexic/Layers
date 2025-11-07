<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Validation;

use MediaWiki\Extension\Layers\Validation\ColorValidator;

/**
 * @covers \MediaWiki\Extension\Layers\Validation\ColorValidator
 */
class ColorValidatorTest extends \MediaWikiUnitTestCase {

	private function createValidator(): ColorValidator {
		return new ColorValidator();
	}

	/**
	 * @covers ::sanitizeColor
	 */
	public function testSanitizeColorHex() {
		$validator = $this->createValidator();

		// Valid hex colors
		$this->assertEquals( '#ff0000', $validator->sanitizeColor( '#ff0000' ) );
		$this->assertEquals( '#FF0000', $validator->sanitizeColor( '#FF0000' ) );
		$this->assertEquals( '#000000', $validator->sanitizeColor( '#000' ) );

		// 3-digit hex should be expanded
		$this->assertEquals( '#ff0000', $validator->sanitizeColor( '#f00' ) );
	}

	/**
	 * @covers ::sanitizeColor
	 */
	public function testSanitizeColorRgb() {
		$validator = $this->createValidator();

		// Valid RGB colors
		$this->assertEquals( 'rgb(255, 0, 0)', $validator->sanitizeColor( 'rgb(255, 0, 0)' ) );
		$this->assertEquals( 'rgba(255, 0, 0, 0.5)', $validator->sanitizeColor( 'rgba(255, 0, 0, 0.5)' ) );

		// RGB with extra whitespace should be normalized
		$this->assertEquals( 'rgb(255, 128, 64)', $validator->sanitizeColor( 'rgb( 255 , 128 , 64 )' ) );
	}

	/**
	 * @covers ::sanitizeColor
	 */
	public function testSanitizeColorNamed() {
		$validator = $this->createValidator();

		// Valid named colors
		$this->assertEquals( 'red', $validator->sanitizeColor( 'red' ) );
		$this->assertEquals( 'blue', $validator->sanitizeColor( 'blue' ) );
		$this->assertEquals( 'transparent', $validator->sanitizeColor( 'transparent' ) );
	}

	/**
	 * @covers ::sanitizeColor
	 */
	public function testSanitizeColorInvalid() {
		$validator = $this->createValidator();

		// Invalid colors should return default black
		$this->assertEquals( '#000000', $validator->sanitizeColor( 'invalid' ) );
		$this->assertEquals( '#000000', $validator->sanitizeColor( '' ) );
		$this->assertEquals( '#000000', $validator->sanitizeColor( 123 ) );
		$this->assertEquals( '#000000', $validator->sanitizeColor( null ) );
	}

	/**
	 * @covers ::sanitizeColor
	 */
	public function testSanitizeColorDangerous() {
		$validator = $this->createValidator();

		// Dangerous content should return default
		$this->assertEquals( '#000000', $validator->sanitizeColor( 'javascript:alert(1)' ) );
		$this->assertEquals( '#000000', $validator->sanitizeColor( 'expression(alert(1))' ) );
		$this->assertEquals( '#000000', $validator->sanitizeColor( '<script>alert(1)</script>' ) );
	}

	/**
	 * @covers ::isNamedColor
	 */
	public function testIsNamedColor() {
		$validator = $this->createValidator();

		$this->assertTrue( $validator->isNamedColor( 'red' ) );
		$this->assertTrue( $validator->isNamedColor( 'blue' ) );
		$this->assertTrue( $validator->isNamedColor( 'transparent' ) );
		$this->assertTrue( $validator->isNamedColor( 'cornflowerblue' ) );

		$this->assertFalse( $validator->isNamedColor( 'notacolor' ) );
		$this->assertFalse( $validator->isNamedColor( '#ff0000' ) );
		$this->assertFalse( $validator->isNamedColor( 'rgb(255,0,0)' ) );
	}

	/**
	 * @covers ::isValidHexColor
	 */
	public function testIsValidHexColor() {
		$validator = $this->createValidator();

		// Valid hex colors
		$this->assertTrue( $validator->isValidHexColor( '#ff0000' ) );
		$this->assertTrue( $validator->isValidHexColor( '#FF0000' ) );
		$this->assertTrue( $validator->isValidHexColor( '#f00' ) );
		$this->assertTrue( $validator->isValidHexColor( '#000' ) );

		// Invalid hex colors
		$this->assertFalse( $validator->isValidHexColor( 'ff0000' ) ); // No #
		$this->assertFalse( $validator->isValidHexColor( '#ff00' ) ); // Wrong length
		$this->assertFalse( $validator->isValidHexColor( '#gggggg' ) ); // Invalid characters
		$this->assertFalse( $validator->isValidHexColor( '#ff00000' ) ); // Too long
	}

	/**
	 * @covers ::isValidRgbColor
	 */
	public function testIsValidRgbColor() {
		$validator = $this->createValidator();

		// Valid RGB colors
		$this->assertTrue( $validator->isValidRgbColor( 'rgb(255, 0, 0)' ) );
		$this->assertTrue( $validator->isValidRgbColor( 'rgb(0, 128, 255)' ) );
		$this->assertTrue( $validator->isValidRgbColor( 'rgba(255, 0, 0, 0.5)' ) );
		$this->assertTrue( $validator->isValidRgbColor( 'rgba(128, 128, 128, 1)' ) );

		// Invalid RGB colors
		$this->assertFalse( $validator->isValidRgbColor( 'rgb(256, 0, 0)' ) ); // Out of range
		$this->assertFalse( $validator->isValidRgbColor( 'rgb(-1, 0, 0)' ) ); // Negative
		$this->assertFalse( $validator->isValidRgbColor( 'rgb(255, 0)' ) ); // Missing component
		$this->assertFalse( $validator->isValidRgbColor( 'rgba(255, 0, 0, 2)' ) ); // Alpha out of range
	}

	/**
	 * @covers ::isValidHslColor
	 */
	public function testIsValidHslColor() {
		$validator = $this->createValidator();

		// Valid HSL colors
		$this->assertTrue( $validator->isValidHslColor( 'hsl(0, 100%, 50%)' ) );
		$this->assertTrue( $validator->isValidHslColor( 'hsl(180, 50%, 25%)' ) );
		$this->assertTrue( $validator->isValidHslColor( 'hsla(360, 100%, 50%, 0.5)' ) );

		// Invalid HSL colors
		$this->assertFalse( $validator->isValidHslColor( 'hsl(361, 100%, 50%)' ) ); // Hue out of range
		$this->assertFalse( $validator->isValidHslColor( 'hsl(0, 101%, 50%)' ) ); // Saturation out of range
		$this->assertFalse( $validator->isValidHslColor( 'hsl(0, 100%, 101%)' ) ); // Lightness out of range
	}

	/**
	 * @covers ::isSafeColor
	 */
	public function testIsSafeColor() {
		$validator = $this->createValidator();

		// Safe colors
		$this->assertTrue( $validator->isSafeColor( '#ff0000' ) );
		$this->assertTrue( $validator->isSafeColor( 'rgb(255, 0, 0)' ) );
		$this->assertTrue( $validator->isSafeColor( 'red' ) );
		$this->assertTrue( $validator->isSafeColor( 'hsl(0, 100%, 50%)' ) );

		// Unsafe colors
		$this->assertFalse( $validator->isSafeColor( 'javascript:alert(1)' ) );
		$this->assertFalse( $validator->isSafeColor( 'expression(alert(1))' ) );
		$this->assertFalse( $validator->isSafeColor( 'url(javascript:alert(1))' ) );
		$this->assertFalse( $validator->isSafeColor( '<script>alert(1)</script>' ) );
		$this->assertFalse( $validator->isSafeColor( 'eval(malicious())' ) );
	}
}
