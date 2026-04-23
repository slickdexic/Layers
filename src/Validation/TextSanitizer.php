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
		// Validate UTF-8 encoding; replace invalid sequences
		if ( !mb_check_encoding( $text, 'UTF-8' ) ) {
			$text = mb_convert_encoding( $text, 'UTF-8', 'UTF-8' );
		}

		// Strip zero-width characters and Unicode directional overrides.
		// Zero-width chars (U+200B-U+200F, U+FEFF) enable text spoofing;
		// bidi overrides (U+202A-U+202E) can mask content direction.
		$text = preg_replace(
			'/[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{FEFF}]/u',
			'',
			$text
		);

		// Basic length check
		if ( mb_strlen( $text, 'UTF-8' ) > self::MAX_TEXT_LENGTH ) {
			$text = mb_substr( $text, 0, self::MAX_TEXT_LENGTH );
		}

		// Remove script blocks before stripping tags so their contents do not survive.
		$text = $this->removeScriptBlocks( $text );

		// Strip HTML tags
		$text = strip_tags( $text );

		// Decode any HTML entities that might have been passed in
		// (e.g., from copy-paste of HTML content)
		$text = html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

		// Re-run script removal after entity decoding in case encoded tags were reconstructed.
		$text = $this->removeScriptBlocks( $text );

		// Re-strip tags: entity decoding can reconstruct HTML tags
		// from encoded input like &lt;script&gt; → <script>
		$text = strip_tags( $text );

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
	 * Sanitize font family names, preserving spaces.
	 *
	 * Unlike sanitizeIdentifier(), this allows spaces in the value
	 * since CSS font family names commonly contain them
	 * (e.g. "Times New Roman", "Courier New").
	 *
	 * @param string $fontFamily Raw font family name
	 * @return string Sanitized font family name
	 */
	public function sanitizeFontFamily( string $fontFamily ): string {
		// Strip HTML tags first so inputs like "Bad<script> Font" do not leak tag names.
		$fontFamily = strip_tags( $fontFamily );
		$fontFamily = html_entity_decode( $fontFamily, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$fontFamily = strip_tags( $fontFamily );

		// Allow alphanumeric, spaces, underscores, hyphens, and dots
		$fontFamily = preg_replace( '/[^a-zA-Z0-9 _.-]/', '', $fontFamily );

		// Collapse multiple spaces to single space and trim
		$fontFamily = trim( preg_replace( '/\s+/', ' ', $fontFamily ) );

		// Limit length
		if ( strlen( $fontFamily ) > 255 ) {
			$fontFamily = substr( $fontFamily, 0, 255 );
		}

		return $fontFamily;
	}

	/**
	 * Sanitize shape ID strings - allows forward slash for category paths
	 *
	 * Shape IDs use category/shape format like 'iso7010-w/iso_7010_w001'
	 *
	 * @param string $shapeId Raw shape ID
	 * @return string Sanitized shape ID
	 */
	public function sanitizeShapeId( string $shapeId ): string {
		// Remove any non-alphanumeric characters except underscore, hyphen, dot, and forward slash
		$shapeId = preg_replace( '/[^a-zA-Z0-9_.\\/-]/', '', $shapeId );

		// Prevent path traversal attempts
		$shapeId = preg_replace( '/\\.{2,}/', '', $shapeId );
		$shapeId = preg_replace( '#/{2,}#', '/', $shapeId );
		$shapeId = trim( $shapeId, '/' );

		// Limit length
		if ( strlen( $shapeId ) > 255 ) {
			$shapeId = substr( $shapeId, 0, 255 );
		}

		return $shapeId;
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
	 * Remove script tags together with their contents.
	 *
	 * @param string $text Input text
	 * @return string Cleaned text
	 */
	private function removeScriptBlocks( string $text ): string {
		return preg_replace( '/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/mi', '', $text );
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
		if ( mb_strlen( $text, 'UTF-8' ) > self::MAX_TEXT_LENGTH ) {
			$text = mb_substr( $text, 0, self::MAX_TEXT_LENGTH );
		}

		// Remove script blocks before stripping tags so their contents do not survive.
		$text = $this->removeScriptBlocks( $text );

		// Strip HTML tags
		$text = strip_tags( $text );

		// Decode any HTML entities that might have been passed in
		$text = html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

		// Re-run script removal after entity decoding in case encoded tags were reconstructed.
		$text = $this->removeScriptBlocks( $text );

		// Re-strip tags: entity decoding can reconstruct HTML tags
		$text = strip_tags( $text );

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
		return mb_strlen( $text, 'UTF-8' ) <= self::MAX_TEXT_LENGTH;
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
