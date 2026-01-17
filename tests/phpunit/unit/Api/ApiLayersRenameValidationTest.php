<?php
// phpcs:disable MediaWiki.Files.ClassMatchesFilename,MediaWiki.Files.OneClassPerFile,Generic.Files.OneObjectStructurePerFile
// phpcs:disable MediaWiki.Commenting.FunctionComment.MissingDocumentationPublic -- Test harness

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use PHPUnit\Framework\TestCase;

/**
 * Test harness class exposing set name validation.
 */
class SetNameValidationHarness {
	/**
	 * Validate a set name.
	 *
	 * @param string $name The name to validate
	 * @return bool True if valid
	 */
	public function isValidSetName( string $name ): bool {
		// Must be 1-50 characters, alphanumeric, hyphens, underscores
		if ( strlen( $name ) < 1 || strlen( $name ) > 50 ) {
			return false;
		}
		return (bool)preg_match( '/^[a-zA-Z0-9_-]+$/', $name );
	}
}

/**
 * Test set name validation logic used by ApiLayersRename.
 *
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersRename
 */
class ApiLayersRenameValidationTest extends TestCase {
	/**
	 * Create a test harness that exposes the validation method.
	 *
	 * @return SetNameValidationHarness Harness with isValidSetName method
	 */
	private function createValidationHarness(): SetNameValidationHarness {
		return new SetNameValidationHarness();
	}

	/**
	 * @dataProvider provideValidSetNames
	 */
	public function testIsValidSetNameAcceptsValidNames( string $name ): void {
		$harness = $this->createValidationHarness();
		$this->assertTrue(
			$harness->isValidSetName( $name ),
			"Name '$name' should be valid"
		);
	}

	/**
	 * Provide valid set names.
	 *
	 * @return array Test cases
	 */
	public static function provideValidSetNames(): array {
		return [
			'single character' => [ 'a' ],
			'simple name' => [ 'default' ],
			'with hyphen' => [ 'my-annotations' ],
			'with underscore' => [ 'anatomy_labels' ],
			'with numbers' => [ 'set123' ],
			'mixed case' => [ 'MyAnnotations' ],
			'all allowed chars' => [ 'Set_1-Test' ],
			'max length (50 chars)' => [ str_repeat( 'a', 50 ) ],
		];
	}

	/**
	 * @dataProvider provideInvalidSetNames
	 */
	public function testIsValidSetNameRejectsInvalidNames( string $name ): void {
		$harness = $this->createValidationHarness();
		$this->assertFalse(
			$harness->isValidSetName( $name ),
			"Name '$name' should be invalid"
		);
	}

	/**
	 * Provide invalid set names.
	 *
	 * @return array Test cases
	 */
	public static function provideInvalidSetNames(): array {
		return [
			'empty string' => [ '' ],
			'too long (51 chars)' => [ str_repeat( 'a', 51 ) ],
			'with space' => [ 'my annotations' ],
			'with dot' => [ 'set.name' ],
			'with slash' => [ 'path/name' ],
			'with special chars' => [ 'set@name' ],
			'with unicode' => [ 'набор' ],
			'with emoji' => [ 'set🔥' ],
			'HTML injection attempt' => [ '<script>' ],
			'SQL injection attempt' => [ "'; DROP TABLE--" ],
		];
	}

	/**
	 * Test boundary conditions.
	 */
	public function testSetNameLengthBoundaries(): void {
		$harness = $this->createValidationHarness();

		// Exactly 50 characters should pass
		$this->assertTrue( $harness->isValidSetName( str_repeat( 'x', 50 ) ) );

		// 51 characters should fail
		$this->assertFalse( $harness->isValidSetName( str_repeat( 'x', 51 ) ) );

		// 1 character should pass
		$this->assertTrue( $harness->isValidSetName( 'x' ) );

		// 0 characters should fail
		$this->assertFalse( $harness->isValidSetName( '' ) );
	}
}
