<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Validation;

use MediaWiki\Extension\Layers\Validation\SetNameSanitizer;

/**
 * @covers \MediaWiki\Extension\Layers\Validation\SetNameSanitizer
 */
class SetNameSanitizerTest extends \MediaWikiUnitTestCase {

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeBasicText() {
		// Normal text should pass through unchanged
		$this->assertEquals( 'my-layer-set', SetNameSanitizer::sanitize( 'my-layer-set' ) );
		$this->assertEquals( 'annotations_2024', SetNameSanitizer::sanitize( 'annotations_2024' ) );
		$this->assertEquals( 'Anatomy Labels', SetNameSanitizer::sanitize( 'Anatomy Labels' ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeTrimsWhitespace() {
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( '  test  ' ) );
		$this->assertEquals( 'hello world', SetNameSanitizer::sanitize( "  hello   world  " ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeRemovesControlCharacters() {
		// Null byte
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( "te\x00st" ) );
		// Tab
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( "te\x09st" ) );
		// Newline
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( "te\x0Ast" ) );
		// Carriage return
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( "te\x0Dst" ) );
		// DEL character
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( "te\x7Fst" ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeRemovesPathSeparators() {
		// Forward slash - path traversal prevention
		$this->assertEquals( 'parentchild', SetNameSanitizer::sanitize( 'parent/child' ) );
		$this->assertEquals( 'etcpasswd', SetNameSanitizer::sanitize( '../etc/passwd' ) );

		// Backslash - Windows path traversal prevention
		$this->assertEquals( 'parentchild', SetNameSanitizer::sanitize( 'parent\\child' ) );
		$this->assertEquals( 'Systemsecret', SetNameSanitizer::sanitize( '..\\System\\secret' ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeRemovesSpecialCharacters() {
		// Various special characters that should be removed
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te@st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te#st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te$st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te%st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te^st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te&st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te*st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te(st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te)st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te+st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te=st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te[st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te]st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te{st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te}st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te|st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te`st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te~st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te!st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( "te'st" ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te"st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te<st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te>st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te?st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te:st' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'te;st' ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeAllowsUnderscore() {
		$this->assertEquals( 'my_layer_set', SetNameSanitizer::sanitize( 'my_layer_set' ) );
		$this->assertEquals( '_prefix', SetNameSanitizer::sanitize( '_prefix' ) );
		$this->assertEquals( 'suffix_', SetNameSanitizer::sanitize( 'suffix_' ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeAllowsDash() {
		$this->assertEquals( 'my-layer-set', SetNameSanitizer::sanitize( 'my-layer-set' ) );
		$this->assertEquals( '-prefix', SetNameSanitizer::sanitize( '-prefix' ) );
		$this->assertEquals( 'suffix-', SetNameSanitizer::sanitize( 'suffix-' ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeAllowsSpaces() {
		$this->assertEquals( 'my layer set', SetNameSanitizer::sanitize( 'my layer set' ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeCollapsesMultipleSpaces() {
		$this->assertEquals( 'hello world', SetNameSanitizer::sanitize( 'hello   world' ) );
		$this->assertEquals( 'a b c', SetNameSanitizer::sanitize( 'a    b    c' ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeReturnsDefaultForEmpty() {
		$this->assertEquals( 'default', SetNameSanitizer::sanitize( '' ) );
		$this->assertEquals( 'default', SetNameSanitizer::sanitize( '   ' ) );
		// String that becomes empty after sanitization
		$this->assertEquals( 'default', SetNameSanitizer::sanitize( '@#$%^&*()' ) );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeTruncatesLongStrings() {
		$longName = str_repeat( 'a', 300 );
		$result = SetNameSanitizer::sanitize( $longName );
		$length = function_exists( 'mb_strlen' ) ? mb_strlen( $result ) : strlen( $result );
		$this->assertLessThanOrEqual( 255, $length );
	}

	/**
	 * @covers ::sanitize
	 */
	public function testSanitizeHandlesUnicode() {
		// Unicode letters should be preserved
		$this->assertEquals( '日本語', SetNameSanitizer::sanitize( '日本語' ) );
		$this->assertEquals( 'Ελληνικά', SetNameSanitizer::sanitize( 'Ελληνικά' ) );
		$this->assertEquals( 'العربية', SetNameSanitizer::sanitize( 'العربية' ) );
		$this->assertEquals( 'Ümläuts', SetNameSanitizer::sanitize( 'Ümläuts' ) );

		// Unicode numbers should be preserved
		$this->assertEquals( '١٢٣', SetNameSanitizer::sanitize( '١٢٣' ) );

		// Unicode special characters should be removed
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'test★' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'test™' ) );
		$this->assertEquals( 'test', SetNameSanitizer::sanitize( 'test©' ) );
	}

	/**
	 * @covers ::sanitize
	 * Tests for potential log injection attacks
	 */
	public function testSanitizePreventsLogInjection() {
		// Newline injection
		$result = SetNameSanitizer::sanitize( "test\nINJECTED LINE" );
		$this->assertStringNotContainsString( "\n", $result );

		// Carriage return injection
		$result = SetNameSanitizer::sanitize( "test\rINJECTED" );
		$this->assertStringNotContainsString( "\r", $result );

		// CRLF injection
		$result = SetNameSanitizer::sanitize( "test\r\nINJECTED" );
		$this->assertStringNotContainsString( "\r", $result );
		$this->assertStringNotContainsString( "\n", $result );
	}

	/**
	 * @covers ::isValid
	 */
	public function testIsValidBasicText() {
		$this->assertTrue( SetNameSanitizer::isValid( 'my-layer-set' ) );
		$this->assertTrue( SetNameSanitizer::isValid( 'annotations_2024' ) );
		$this->assertTrue( SetNameSanitizer::isValid( 'Anatomy Labels' ) );
		$this->assertTrue( SetNameSanitizer::isValid( 'default' ) );
	}

	/**
	 * @covers ::isValid
	 */
	public function testIsValidRejectsEmpty() {
		$this->assertFalse( SetNameSanitizer::isValid( '' ) );
		$this->assertFalse( SetNameSanitizer::isValid( '   ' ) );
	}

	/**
	 * @covers ::isValid
	 */
	public function testIsValidRejectsControlCharacters() {
		$this->assertFalse( SetNameSanitizer::isValid( "te\x00st" ) );
		$this->assertFalse( SetNameSanitizer::isValid( "te\x09st" ) );
		$this->assertFalse( SetNameSanitizer::isValid( "te\x0Ast" ) );
		$this->assertFalse( SetNameSanitizer::isValid( "te\x7Fst" ) );
	}

	/**
	 * @covers ::isValid
	 */
	public function testIsValidRejectsPathSeparators() {
		$this->assertFalse( SetNameSanitizer::isValid( 'parent/child' ) );
		$this->assertFalse( SetNameSanitizer::isValid( '../etc/passwd' ) );
		$this->assertFalse( SetNameSanitizer::isValid( 'parent\\child' ) );
		$this->assertFalse( SetNameSanitizer::isValid( '..\\System\\secret' ) );
	}

	/**
	 * @covers ::isValid
	 */
	public function testIsValidRejectsTooLong() {
		$this->assertTrue( SetNameSanitizer::isValid( str_repeat( 'a', 255 ) ) );
		$this->assertFalse( SetNameSanitizer::isValid( str_repeat( 'a', 256 ) ) );
	}

	/**
	 * @covers ::isValid
	 * Note: isValid() does not check for special characters - it only validates
	 * that input doesn't contain dangerous characters (control chars, path separators)
	 */
	public function testIsValidAllowsSpecialCharacters() {
		// isValid() is less strict than sanitize() - it only rejects dangerous chars
		$this->assertTrue( SetNameSanitizer::isValid( 'test@example' ) );
		$this->assertTrue( SetNameSanitizer::isValid( 'test#123' ) );
	}

	/**
	 * @covers ::isValid
	 */
	public function testIsValidHandlesUnicode() {
		$this->assertTrue( SetNameSanitizer::isValid( '日本語' ) );
		$this->assertTrue( SetNameSanitizer::isValid( 'Ελληνικά' ) );
		$this->assertTrue( SetNameSanitizer::isValid( 'Ümläuts' ) );
	}

	/**
	 * @covers ::getDefaultName
	 */
	public function testGetDefaultName() {
		$this->assertEquals( 'default', SetNameSanitizer::getDefaultName() );
	}

	/**
	 * Data provider for testing sanitize/isValid consistency
	 *
	 * @return array Test cases with [input, expectedSanitized, expectedValid]
	 */
	public static function provideConsistencyTestCases(): array {
		return [
			'normal text' => [ 'my-set', 'my-set', true ],
			'empty string' => [ '', 'default', false ],
			'whitespace only' => [ '   ', 'default', false ],
			'with control char' => [ "te\x00st", 'test', false ],
			'with path separator' => [ 'parent/child', 'parentchild', false ],
			'unicode text' => [ '日本語セット', '日本語セット', true ],
		];
	}

	/**
	 * @covers ::sanitize
	 * @covers ::isValid
	 * @dataProvider provideConsistencyTestCases
	 */
	public function testSanitizeAndIsValidConsistency( string $input, string $expectedSanitized, bool $expectedValid ) {
		$this->assertEquals( $expectedSanitized, SetNameSanitizer::sanitize( $input ) );
		$this->assertEquals( $expectedValid, SetNameSanitizer::isValid( $input ) );
	}

	/**
	 * @covers ::sanitize
	 * Tests that sanitize is idempotent (applying twice gives same result)
	 */
	public function testSanitizeIsIdempotent() {
		$inputs = [
			'normal-text',
			'te@st#123',
			'  spaces  ',
			"control\x00char",
			'path/sep',
			'日本語',
		];

		foreach ( $inputs as $input ) {
			$once = SetNameSanitizer::sanitize( $input );
			$twice = SetNameSanitizer::sanitize( $once );
			$this->assertEquals( $once, $twice, "sanitize() should be idempotent for input: $input" );
		}
	}

	/**
	 * @covers ::sanitize
	 * Tests that output from sanitize always passes isValid
	 */
	public function testSanitizedOutputIsAlwaysValid() {
		$inputs = [
			'normal-text',
			'@#$%^&*()',
			'',
			'   ',
			"te\x00st",
			'path/sep',
			str_repeat( 'a', 300 ),
		];

		foreach ( $inputs as $input ) {
			$sanitized = SetNameSanitizer::sanitize( $input );
			$this->assertTrue(
				SetNameSanitizer::isValid( $sanitized ),
				"sanitize() output should always be valid, but failed for input: " . json_encode( $input )
			);
		}
	}
}
