<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Validation;

use MediaWiki\Extension\Layers\Validation\LayerLinkValidator;
use MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator;

/**
 * @covers \MediaWiki\Extension\Layers\Validation\LayerLinkValidator
 * @covers \MediaWiki\Extension\Layers\Validation\ServerSideLayerValidator
 */
class LayerLinkValidatorTest extends \MediaWikiUnitTestCase {

	private const TEST_PROTOCOLS = 'https?:\/\/|ftp:\/\/|mailto:|\/\/';

	/**
	 * Create validator with a mock title validator for standalone tests.
	 *
	 * @param string|null $protocols
	 * @param callable|null $titleValidator
	 * @return LayerLinkValidator
	 */
	private function createValidator(
		?string $protocols = self::TEST_PROTOCOLS,
		?callable $titleValidator = null
	): LayerLinkValidator {
		$titleValidator = $titleValidator ?? static function ( string $text ) {
			// Standalone mock matching MediaWiki core title rules
			if ( $text === '' || preg_match( '/[<>[\]{}|\x00-\x1f\x7f]/', $text ) ) {
				return null;
			}
			return (object)[ 'text' => $text ];
		};
		return new LayerLinkValidator( $protocols, $titleValidator );
	}

	// =========================================================================
	// Acceptance tests
	// =========================================================================

	/**
	 * @dataProvider provideAcceptedLinks
	 */
	public function testAcceptsValidLinksUnchanged( string $link ): void {
		$validator = $this->createValidator();
		$result = $validator->validate( $link );

		$this->assertTrue( $result['valid'], "Link should be accepted: $link" );
		$this->assertSame( $link, $result['value'], 'Accepted link must be returned byte-for-byte unchanged' );
	}

	public static function provideAcceptedLinks(): array {
		return [
			'internal wiki link with section' => [ 'Operations/Intake#Procedure' ],
			'self page section link' => [ '#Section' ],
			'external https URL with query and fragment' => [ 'https://example.org/a?b=c#d' ],
			'mailto URL with destination' => [ 'mailto:a@example.org' ],
			'protocol-relative URL with host and path' => [ '//example.org/x' ],
			'internal link title with accent' => [ 'Café#Menu' ],
			'internal link title with spaces' => [ 'Visual ideas and concepts#Intro' ],
			'simple internal title' => [ 'Main Page' ],
			'internal subpage without section' => [ 'Help:Editing/Subpage' ],
			'File namespace page' => [ 'File:Example.png' ],
			'File namespace page with a slash' => [ 'File:Foo/bar.png#Summary' ],
			'Data namespace page' => [ 'Data:Population.tab' ],
			'external http URL' => [ 'http://example.com/test' ],
			'external ftp URL' => [ 'ftp://ftp.example.com/files' ],
		];
	}

	// =========================================================================
	// Refusal tests
	// =========================================================================

	/**
	 * @dataProvider provideNonStringValues
	 */
	public function testRefusesNonString( $value ): void {
		$validator = $this->createValidator();
		$result = $validator->validate( $value );

		$this->assertFalse( $result['valid'] );
		$this->assertSame( 'Link must be a string', $result['error'] );
	}

	public static function provideNonStringValues(): array {
		return [
			'null' => [ null ],
			'integer' => [ 12345 ],
			'float' => [ 12.34 ],
			'boolean true' => [ true ],
			'boolean false' => [ false ],
			'array' => [ [ 'url' => 'https://example.org' ] ],
			'object' => [ (object)[ 'href' => 'https://example.org' ] ],
		];
	}

	public function testRefusesEmptyString(): void {
		$validator = $this->createValidator();
		$result = $validator->validate( '' );

		$this->assertFalse( $result['valid'] );
		$this->assertSame( 'Link cannot be empty', $result['error'] );
	}

	public function testRefusesOverLongLink(): void {
		$validator = $this->createValidator();
		$longLink = 'https://example.org/' . str_repeat( 'a', 2040 );
		$this->assertGreaterThan( 2048, strlen( $longLink ) );

		$result = $validator->validate( $longLink );

		$this->assertFalse( $result['valid'] );
		$this->assertSame( 'Link cannot exceed 2048 bytes', $result['error'] );
	}

	/**
	 * @dataProvider provideControlCharacterLinks
	 */
	public function testRefusesControlCharacters( string $link ): void {
		$validator = $this->createValidator();
		$result = $validator->validate( $link );

		$this->assertFalse( $result['valid'] );
		$this->assertSame( 'Link cannot contain control characters', $result['error'] );
	}

	public static function provideControlCharacterLinks(): array {
		return [
			'null byte' => [ "https://example.org/\x00evil" ],
			'newline' => [ "https://example.org/\npath" ],
			'carriage return' => [ "https://example.org/\rpath" ],
			'tab character' => [ "Operations/Intake\t#Procedure" ],
			'DEL character 0x7F' => [ "https://example.org/\x7F" ],
			'bell character 0x07' => [ "#Section\x07" ],
		];
	}

	/**
	 * @dataProvider provideWhitespacePaddedLinks
	 */
	public function testRefusesLeadingOrTrailingWhitespace( string $link ): void {
		$validator = $this->createValidator();
		$result = $validator->validate( $link );

		$this->assertFalse( $result['valid'] );
		$this->assertSame( 'Link cannot have leading or trailing whitespace', $result['error'] );
	}

	public static function provideWhitespacePaddedLinks(): array {
		return [
			'leading space' => [ ' https://example.org' ],
			'trailing space' => [ 'https://example.org ' ],
			'leading and trailing spaces' => [ ' Operations/Intake ' ],
			'trailing newline' => [ "https://example.org\n" ],
			'leading tab' => [ "\t#Section" ],
		];
	}

	/**
	 * @dataProvider provideForbiddenProtocols
	 */
	public function testRefusesForbiddenProtocolsByName( string $link ): void {
		$validator = $this->createValidator();
		$result = $validator->validate( $link );

		$this->assertFalse( $result['valid'] );
		$this->assertSame( 'Link protocol is forbidden', $result['error'] );
	}

	public static function provideForbiddenProtocols(): array {
		return [
			'javascript scheme' => [ 'javascript:alert(1)' ],
			'javascript uppercase' => [ 'JAVASCRIPT:alert(document.cookie)' ],
			'javascript mixed case' => [ 'JavaScript:void(0)' ],
			'data URI scheme' => [ 'data:text/html,<script>alert(1)</script>' ],
			'data image URI' => [ 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' ],
			'vbscript scheme' => [ 'vbscript:msgbox("test")' ],
			'file protocol' => [ 'file:///etc/passwd' ],
			'file windows path' => [ 'file://C:/Windows/System32' ],
			'blob URL' => [ 'blob:https://example.org/uuid-string' ],
		];
	}

	/**
	 * @dataProvider provideInvalidExternalUrls
	 */
	public function testRefusesInvalidExternalUrls( string $link ): void {
		$validator = $this->createValidator();
		$result = $validator->validate( $link );

		$this->assertFalse( $result['valid'] );
		$this->assertSame( 'Invalid external link URL', $result['error'] );
	}

	public static function provideInvalidExternalUrls(): array {
		return [
			'http scheme missing host' => [ 'http://' ],
			'https scheme missing host' => [ 'https://' ],
			'https with path only' => [ 'https:///some/path' ],
			'protocol relative missing host' => [ '//' ],
			'mailto missing address' => [ 'mailto:' ],
			'space inside host' => [ 'https://exa mple.org/path' ],
			'space inside path' => [ 'https://example.org/a b' ],
			'quote inside URL' => [ 'https://example.org/"x' ],
		];
	}

	/**
	 * @dataProvider provideInvalidInternalTitles
	 */
	public function testRefusesInvalidInternalTitles( string $link ): void {
		$validator = $this->createValidator();
		$result = $validator->validate( $link );

		$this->assertFalse( $result['valid'] );
		$this->assertContains( $result['error'], [
			'Invalid wiki page title in link',
			'Link section anchor cannot be empty'
		] );
	}

	public static function provideInvalidInternalTitles(): array {
		return [
			'hash alone with empty anchor' => [ '#' ],
			'title containing angle brackets' => [ 'Bad<Title>#Section' ],
			'title containing square brackets' => [ 'Bad[Title]' ],
			'title containing curly braces' => [ 'Bad{Title}' ],
			'title containing pipe' => [ 'Bad|Title' ],
		];
	}

	// =========================================================================
	// ServerSideLayerValidator integration tests
	// =========================================================================

	public function testServerSideLayerValidatorAcceptsValidLink(): void {
		$linkValidator = $this->createValidator();
		$validator = new ServerSideLayerValidator( null, null, $linkValidator );

		$layer = [
			'id' => 'box1',
			'type' => 'rectangle',
			'x' => 10,
			'y' => 20,
			'width' => 100,
			'height' => 50,
			'link' => 'Operations/Intake#Procedure'
		];

		$result = $validator->validateLayer( $layer );
		$this->assertTrue( $result->isValid(), 'Valid link on layer should pass validation' );
		$data = $result->getData();
		$this->assertArrayHasKey( 'link', $data );
		$this->assertSame( 'Operations/Intake#Procedure', $data['link'] );
	}

	public function testServerSideLayerValidatorFailsOnInvalidLinkBecauseStrict(): void {
		$linkValidator = $this->createValidator();
		$validator = new ServerSideLayerValidator( null, null, $linkValidator );

		$layer = [
			'id' => 'box1',
			'type' => 'rectangle',
			'x' => 10,
			'y' => 20,
			'width' => 100,
			'height' => 50,
			'link' => 'javascript:alert(1)'
		];

		$result = $validator->validateLayer( $layer );
		$this->assertFalse( $result->isValid(), 'Invalid link must fail layer validation under STRICT_PROPERTIES' );
		$this->assertTrue( $result->hasErrors() );
		$this->assertStringContainsString( "Invalid property 'link'", $result->getErrors()[0] );
	}

	public function testServerSideLayerValidatorFailsOnNullLink(): void {
		$linkValidator = $this->createValidator();
		$validator = new ServerSideLayerValidator( null, null, $linkValidator );

		$layer = [
			'id' => 'box1',
			'type' => 'rectangle',
			'x' => 10,
			'y' => 20,
			'width' => 100,
			'height' => 50,
			'link' => null
		];

		$result = $validator->validateLayer( $layer );
		$this->assertFalse( $result->isValid(), 'Null link must fail layer validation under STRICT_PROPERTIES' );
		$this->assertTrue( $result->hasErrors() );
		$this->assertStringContainsString( "Invalid property 'link'", $result->getErrors()[0] );
	}

	public function testServerSideLayerValidatorRefusesLinkOnGroupLayer(): void {
		$linkValidator = $this->createValidator();
		$validator = new ServerSideLayerValidator( null, null, $linkValidator );

		$layer = [
			'id' => 'grp1',
			'type' => 'group',
			'children' => [ 'child1' ],
			'link' => 'https://example.org'
		];

		$result = $validator->validateLayer( $layer );
		$this->assertFalse( $result->isValid(), 'Group layers must not carry link property' );
		$this->assertTrue( $result->hasErrors() );
		$this->assertStringContainsString( 'Group layers cannot have a link', $result->getErrors()[0] );
	}
}
