<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Validation;

use MediaWiki\Extension\Layers\Validation\TextSanitizer;

/**
 * @covers \MediaWiki\Extension\Layers\Validation\TextSanitizer
 */
class TextSanitizerTest extends \MediaWikiUnitTestCase {

	private function createSanitizer(): TextSanitizer {
		return new TextSanitizer();
	}

	/**
	 * @covers ::sanitizeText
	 */
	public function testSanitizeTextBasic() {
		$sanitizer = $this->createSanitizer();

		// Normal text should pass through
		$this->assertEquals( 'Hello World', $sanitizer->sanitizeText( 'Hello World' ) );
		$this->assertEquals( 'Test 123', $sanitizer->sanitizeText( 'Test 123' ) );
	}

	/**
	 * @covers ::sanitizeText
	 */
	public function testSanitizeTextRemovesHtml() {
		$sanitizer = $this->createSanitizer();

		// HTML tags should be stripped
		$this->assertEquals( 'Hello World', $sanitizer->sanitizeText( '<b>Hello World</b>' ) );
		$this->assertEquals( 'Test', $sanitizer->sanitizeText( '<p>Test</p>' ) );
		$this->assertEquals( 'Link text', $sanitizer->sanitizeText( '<a href="http://example.com">Link text</a>' ) );
	}

	/**
	 * @covers ::sanitizeText
	 */
	public function testSanitizeTextRemovesScripts() {
		$sanitizer = $this->createSanitizer();

		// Script tags should be completely removed
		$result = $sanitizer->sanitizeText( '<script>alert("xss")</script>Hello' );
		$this->assertStringNotContainsString( '<script>', $result );
		// JS keywords followed by ( are neutralized with a zero-width space
		// The word 'alert' is preserved but 'alert(' becomes 'alert\u200B(' (not callable)
		$this->assertStringNotContainsString( 'alert(', $result );
		$this->assertStringContainsString( 'Hello', $result );
	}

	/**
	 * @covers ::sanitizeText
	 */
	public function testSanitizeTextRemovesEventHandlers() {
		$sanitizer = $this->createSanitizer();

		// Event handlers should be removed
		$result = $sanitizer->sanitizeText( 'Hello onclick="alert(1)" world' );
		$this->assertStringNotContainsString( 'onclick', $result );
		$this->assertStringNotContainsString( 'alert', $result );
		$this->assertStringContainsString( 'Hello', $result );
		$this->assertStringContainsString( 'world', $result );
	}

	/**
	 * @covers ::sanitizeText
	 */
	public function testSanitizeTextRemovesDangerousProtocols() {
		$sanitizer = $this->createSanitizer();

		// Dangerous protocols should be removed
		$this->assertStringNotContainsString(
			'javascript:',
			$sanitizer->sanitizeText( 'javascript:alert(1)' )
		);
		$this->assertStringNotContainsString( 'vbscript:', $sanitizer->sanitizeText( 'vbscript:msgbox(1)' ) );
		$this->assertStringNotContainsString(
			'data:',
			$sanitizer->sanitizeText( 'data:text/html,<script>alert(1)</script>' )
		);
	}

	/**
	 * @covers ::sanitizeText
	 */
	public function testSanitizeTextLengthLimit() {
		$sanitizer = $this->createSanitizer();

		// Very long text should be truncated
		$longText = str_repeat( 'A', 1500 );
		$result = $sanitizer->sanitizeText( $longText );
		$this->assertLessThanOrEqual( 1000, strlen( $result ) );
	}

	/**
	 * @covers ::sanitizeIdentifier
	 */
	public function testSanitizeIdentifier() {
		$sanitizer = $this->createSanitizer();

		// Valid identifiers should pass through
		$this->assertEquals( 'test_123', $sanitizer->sanitizeIdentifier( 'test_123' ) );
		$this->assertEquals( 'layer-name', $sanitizer->sanitizeIdentifier( 'layer-name' ) );
		$this->assertEquals( 'item.1', $sanitizer->sanitizeIdentifier( 'item.1' ) );

		// Invalid characters should be removed
		$this->assertEquals( 'test123', $sanitizer->sanitizeIdentifier( 'test@#$123' ) );
		$this->assertEquals( 'HelloWorld', $sanitizer->sanitizeIdentifier( 'Hello World' ) );

		// Identifiers starting with numbers should be prefixed
		$this->assertEquals( 'layer_123abc', $sanitizer->sanitizeIdentifier( '123abc' ) );
	}

	/**
	 * @covers ::isValidLength
	 */
	public function testIsValidLength() {
		$sanitizer = $this->createSanitizer();

		$this->assertTrue( $sanitizer->isValidLength( 'Short text' ) );
		$this->assertTrue( $sanitizer->isValidLength( str_repeat( 'A', 1000 ) ) );
		$this->assertFalse( $sanitizer->isValidLength( str_repeat( 'A', 1001 ) ) );
	}

	/**
	 * @covers ::isSafeText
	 */
	public function testIsSafeText() {
		$sanitizer = $this->createSanitizer();

		// Safe text
		$this->assertTrue( $sanitizer->isSafeText( 'Hello World' ) );
		$this->assertTrue( $sanitizer->isSafeText( 'Test 123' ) );
		$this->assertTrue( $sanitizer->isSafeText( 'Normal text with punctuation!' ) );

		// Unsafe text
		$this->assertFalse( $sanitizer->isSafeText( '<script>alert(1)</script>' ) );
		$this->assertFalse( $sanitizer->isSafeText( 'javascript:alert(1)' ) );
		$this->assertFalse( $sanitizer->isSafeText( 'Hello onclick="bad()" world' ) );
		$this->assertFalse( $sanitizer->isSafeText( 'vbscript:msgbox(1)' ) );
		$this->assertFalse( $sanitizer->isSafeText( 'data:text/html,<script>' ) );
	}

	/**
	 * Regression test: entity-encoded HTML tags must be stripped after decoding.
	 * Input like &lt;script&gt; should not survive sanitization as <script>.
	 *
	 * @covers ::sanitizeText
	 */
	public function testSanitizeTextStripsEntityEncodedTags() {
		$sanitizer = $this->createSanitizer();

		// Entity-encoded <script> tag should be fully stripped after decoding
		$result = $sanitizer->sanitizeText( '&lt;script&gt;alert(1)&lt;/script&gt;' );
		$this->assertStringNotContainsString( '<script>', $result );
		$this->assertStringNotContainsString( '</script>', $result );

		// Entity-encoded <img> with event handler
		$result = $sanitizer->sanitizeText( '&lt;img src=x onerror=alert(1)&gt;' );
		$this->assertStringNotContainsString( '<img', $result );
		$this->assertStringNotContainsString( 'onerror', $result );

		// Double-encoded should still be safe (first decode produces entities, second produces tags)
		$result = $sanitizer->sanitizeText( '&amp;lt;b&amp;gt;bold&amp;lt;/b&amp;gt;' );
		$this->assertStringNotContainsString( '<b>', $result );

		// Mixed content: normal text with entity-encoded tags
		$result = $sanitizer->sanitizeText( 'Hello &lt;b&gt;world&lt;/b&gt; test' );
		$this->assertStringContainsString( 'Hello', $result );
		$this->assertStringContainsString( 'test', $result );
		$this->assertStringNotContainsString( '<b>', $result );
	}

	/**
	 * @covers ::sanitizeFontFamily
	 */
	public function testSanitizeFontFamilyPreservesSpaces() {
		$sanitizer = $this->createSanitizer();

		// Font names with spaces should be preserved
		$this->assertEquals( 'Times New Roman', $sanitizer->sanitizeFontFamily( 'Times New Roman' ) );
		$this->assertEquals( 'Courier New', $sanitizer->sanitizeFontFamily( 'Courier New' ) );
		$this->assertEquals( 'Open Sans', $sanitizer->sanitizeFontFamily( 'Open Sans' ) );
		$this->assertEquals( 'Noto Sans', $sanitizer->sanitizeFontFamily( 'Noto Sans' ) );
		$this->assertEquals( 'Source Sans 3', $sanitizer->sanitizeFontFamily( 'Source Sans 3' ) );

		// Single-word fonts should work fine
		$this->assertEquals( 'Arial', $sanitizer->sanitizeFontFamily( 'Arial' ) );
		$this->assertEquals( 'Roboto', $sanitizer->sanitizeFontFamily( 'Roboto' ) );

		// Special characters should be stripped
		$this->assertEquals( 'Bad Font', $sanitizer->sanitizeFontFamily( 'Bad<script> Font' ) );
		$this->assertEquals( 'Test Font', $sanitizer->sanitizeFontFamily( 'Test@#$ Font' ) );

		// Multiple spaces should be collapsed
		$this->assertEquals( 'Times New Roman', $sanitizer->sanitizeFontFamily( 'Times  New  Roman' ) );

		// Leading/trailing whitespace should be trimmed
		$this->assertEquals( 'Arial', $sanitizer->sanitizeFontFamily( '  Arial  ' ) );
	}

	/**
	 * @covers ::sanitizeText
	 * Regression test for P3-254: invalid UTF-8 should be cleaned, not passed through
	 */
	public function testSanitizeTextInvalidUtf8() {
		$sanitizer = $this->createSanitizer();

		// Invalid UTF-8 byte sequence should not cause errors
		$invalidUtf8 = "Hello \x80\x81 World";
		$result = $sanitizer->sanitizeText( $invalidUtf8 );
		$this->assertTrue( mb_check_encoding( $result, 'UTF-8' ), 'Result must be valid UTF-8' );
		$this->assertStringContainsString( 'Hello', $result );
		$this->assertStringContainsString( 'World', $result );
	}

	/**
	 * @covers ::sanitizeText
	 * Regression test for P3-254: zero-width characters must be stripped
	 */
	public function testSanitizeTextStripsZeroWidthChars() {
		$sanitizer = $this->createSanitizer();

		// Zero-width space (U+200B), zero-width non-joiner (U+200C), zero-width joiner (U+200D)
		$textWithZeroWidth = "Hel\u{200B}lo\u{200C}Wor\u{200D}ld";
		$result = $sanitizer->sanitizeText( $textWithZeroWidth );
		$this->assertEquals( 'HelloWorld', $result );

		// BOM (U+FEFF)
		$textWithBom = "\u{FEFF}Hello";
		$result = $sanitizer->sanitizeText( $textWithBom );
		$this->assertEquals( 'Hello', $result );
	}

	/**
	 * @covers ::sanitizeText
	 * Regression test for P3-254: bidi override characters must be stripped
	 */
	public function testSanitizeTextStripsBidiOverrides() {
		$sanitizer = $this->createSanitizer();

		// Left-to-right embedding (U+202A), right-to-left override (U+202E)
		$textWithBidi = "Hello\u{202A}World\u{202E}Test";
		$result = $sanitizer->sanitizeText( $textWithBidi );
		$this->assertEquals( 'HelloWorldTest', $result );

		// Left-to-right mark (U+200E), right-to-left mark (U+200F)
		$textWithMarks = "AB\u{200E}CD\u{200F}EF";
		$result = $sanitizer->sanitizeText( $textWithMarks );
		$this->assertEquals( 'ABCDEF', $result );
	}

	/**
	 * @covers ::sanitizeText
	 * Regression test for P3-254: normal Unicode text should be preserved
	 */
	public function testSanitizeTextPreservesValidUnicode() {
		$sanitizer = $this->createSanitizer();

		// CJK, emoji, accented chars should all survive
		$this->assertEquals( '日本語テスト', $sanitizer->sanitizeText( '日本語テスト' ) );
		$this->assertEquals( 'café résumé', $sanitizer->sanitizeText( 'café résumé' ) );
		$this->assertEquals( 'Ñoño', $sanitizer->sanitizeText( 'Ñoño' ) );
	}
}
