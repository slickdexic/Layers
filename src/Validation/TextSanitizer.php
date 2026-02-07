<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Validation;

/**
 * Text sanitization service for layer data
 *
 * This class handles sanitization of user-provided text content
 * to prevent XSS attacks and ensure data consistency.
 */
class TextSanitizer {

	/** @var int Maximum text length */
	private const MAX_TEXT_LENGTH = 1000;

	/**
	 * Sanitize user text input
	 *
	 * Note: This method does NOT HTML-encode the output because the data
	 * is stored as JSON in the database. HTML encoding should only happen
	 * at render time when outputting to HTML context.
	 *
	 * @param string $text Raw text input
	 * @return string Sanitized text
	 */
	public function sanitizeText( string $text ): string {
		// Basic length check
		if ( strlen( $text ) > self::MAX_TEXT_LENGTH ) {
			$text = substr( $text, 0, self::MAX_TEXT_LENGTH );
		}

		// Strip HTML tags
		$text = strip_tags( $text );

		// Decode any HTML entities that might have been passed in
		// (e.g., from copy-paste of HTML content)
		$text = html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

		// Remove dangerous protocols
		$text = $this->removeDangerousProtocols( $text );

		// Remove event handlers and JavaScript
		$text = $this->removeEventHandlers( $text );

		// Strip leading '@' to prevent ImageMagick file read injection.
		// IM interprets '@filename' as "read contents from file" in -annotate.
		$text = ltrim( $text, '@' );

		// Do NOT re-encode with htmlspecialchars - this is JSON storage, not HTML output
		// HTML encoding should happen at render time only

		return trim( $text );
	}

	/**
	 * Sanitize identifier strings (IDs, type names, etc.)
	 *
	 * @param string $identifier Raw identifier
	 * @return string Sanitized identifier
	 */
	public function sanitizeIdentifier( string $identifier ): string {
		// Remove any non-alphanumeric characters except underscore, hyphen, and dot
		$identifier = preg_replace( '/[^a-zA-Z0-9_.-]/', '', $identifier );

		// Limit length
		if ( strlen( $identifier ) > 255 ) {
			$identifier = substr( $identifier, 0, 255 );
		}

		// Ensure it doesn't start with a number (for CSS compatibility)
		if ( preg_match( '/^[0-9]/', $identifier ) ) {
			$identifier = 'layer_' . $identifier;
		}

		return $identifier;
	}

	/**
	 * Remove dangerous protocols from text
	 *
	 * @param string $text Input text
	 * @return string Cleaned text
	 */
	private function removeDangerousProtocols( string $text ): string {
		$dangerousProtocols = [
			'javascript:', 'vbscript:', 'data:', 'about:', 'chrome:',
			'chrome-extension:', 'ms-its:', 'mhtml:', 'file:'
		];

		// Loop until no more replacements occur to prevent bypass via nesting
		// e.g. "javajavaScript:script:alert(1)" → "javascript:alert(1)" on single pass
		do {
			$before = $text;
			foreach ( $dangerousProtocols as $protocol ) {
				$text = str_ireplace( $protocol, '', $text );
			}
		} while ( $text !== $before );

		return $text;
	}

	/**
	 * Remove event handlers and JavaScript code
	 *
	 * @param string $text Input text
	 * @return string Cleaned text
	 */
	private function removeEventHandlers( string $text ): string {
		// Remove common event handlers
		$eventHandlers = [
			'onclick', 'onload', 'onmouseover', 'onmouseout', 'onfocus', 'onblur',
			'onchange', 'onsubmit', 'ondblclick', 'onkeydown', 'onkeyup', 'onkeypress',
			'onmousedown', 'onmouseup', 'onmousemove', 'onscroll', 'onresize',
			'onerror', 'onabort'
		];

		foreach ( $eventHandlers as $handler ) {
			$text = preg_replace( '/' . preg_quote( $handler, '/' ) . '\s*=\s*["\'][^"\']*["\']?/i', '', $text );
		}

		// Remove <script> tags and their content
		$text = preg_replace( '/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/mi', '', $text );

		// Neutralize JavaScript keywords followed by '(' by inserting a zero-width space
		// This prevents code execution while preserving legitimate text like "Use alert() carefully"
		// The zero-width space (\u200B) makes "alert(" become "alert\u200B(" which is not callable
		$jsKeywords = [ 'alert', 'confirm', 'prompt', 'eval', 'setTimeout', 'setInterval' ];
		foreach ( $jsKeywords as $keyword ) {
			// Insert a zero-width space before the opening paren to neutralize the call
			$text = preg_replace(
				'/\b(' . preg_quote( $keyword, '/' ) . ')\s*\(/i',
				'$1' . "\xE2\x80\x8B" . '(',
				$text
			);
		}

		return $text;
	}

	/**
	 * Sanitize text for rich text runs (preserves whitespace)
	 *
	 * Unlike sanitizeText(), this method does NOT trim whitespace because
	 * whitespace at the boundaries of rich text runs is significant.
	 * For example, "Hello " + "World" should not become "Hello" + "World".
	 *
	 * @param string $text Raw text input
	 * @return string Sanitized text with preserved whitespace
	 */
	public function sanitizeRichTextRun( string $text ): string {
		// Basic length check
		if ( strlen( $text ) > self::MAX_TEXT_LENGTH ) {
			$text = substr( $text, 0, self::MAX_TEXT_LENGTH );
		}

		// Strip HTML tags
		$text = strip_tags( $text );

		// Decode any HTML entities that might have been passed in
		$text = html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

		// Remove dangerous protocols
		$text = $this->removeDangerousProtocols( $text );

		// Remove event handlers and JavaScript
		$text = $this->removeEventHandlers( $text );

		// Do NOT trim - whitespace is significant in rich text runs
		return $text;
	}

	/**
	 * Validate text length
	 *
	 * @param string $text Text to validate
	 * @return bool True if within limits
	 */
	public function isValidLength( string $text ): bool {
		return strlen( $text ) <= self::MAX_TEXT_LENGTH;
	}

	/**
	 * Check if text contains potentially dangerous content
	 *
	 * @param string $text Text to check
	 * @return bool True if text appears safe
	 */
	public function isSafeText( string $text ): bool {
		// Check for script tags
		if ( preg_match( '/<script/i', $text ) ) {
			return false;
		}

		// Check for dangerous protocols
		$dangerousPatterns = [
			'/javascript:/i',
			'/vbscript:/i',
			'/data:/i',
			'/onclick/i',
			'/onload/i',
			'/onerror/i'
		];

		foreach ( $dangerousPatterns as $pattern ) {
			if ( preg_match( $pattern, $text ) ) {
				return false;
			}
		}

		return true;
	}
}
