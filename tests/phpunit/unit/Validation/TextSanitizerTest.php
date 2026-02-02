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
}
