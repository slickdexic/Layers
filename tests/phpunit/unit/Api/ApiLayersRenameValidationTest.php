<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersRename;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Extension\Layers\Validation\SetNameSanitizer;
use MediaWiki\Title\Title;
use MediaWiki\User\UserIdentity;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * Validates set name validation and rename execution logic for ApiLayersRename (R6.15, task J04).
 * Exercises production SetNameSanitizer and ApiLayersRename execution paths directly without
 * duplicated test-harness regexes.
 *
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersRename
 * @covers \MediaWiki\Extension\Layers\Validation\SetNameSanitizer
 */
class ApiLayersRenameValidationTest extends TestCase {

	/**
	 * @dataProvider provideValidSetNames
	 */
	public function testProductionValidatorAcceptsValidSetNames( string $name ): void {
		$this->assertTrue(
			SetNameSanitizer::isValid( $name ),
			"Production validator SetNameSanitizer::isValid() should accept '$name'"
		);
	}

	/**
	 * Provide valid set names according to production specification:
	 * letters (any script), numbers, underscore, dash, spaces, up to 255 characters.
	 *
	 * @return array<string, array{0: string}>
	 */
	public static function provideValidSetNames(): array {
		return [
			'single character' => [ 'a' ],
			'simple name' => [ 'default' ],
			'with hyphen' => [ 'my-annotations' ],
			'with underscore' => [ 'anatomy_labels' ],
			'with numbers' => [ 'set123' ],
			'mixed case' => [ 'MyAnnotations' ],
			'all allowed standard chars' => [ 'Set_1-Test' ],
			'with spaces' => [ 'my annotations' ],
			'with multiple spaces' => [ 'set name with spaces' ],
			'Cyrillic unicode' => [ 'набор' ],
			'Latin accented unicode' => [ 'Étiquette' ],
			'Japanese CJK unicode' => [ '日本語' ],
			'Arabic unicode' => [ 'مجموعة' ],
			'max length (255 chars)' => [ str_repeat( 'a', 255 ) ],
			'multibyte unicode max length (255 chars)' => [ str_repeat( 'ä', 255 ) ],
		];
	}

	/**
	 * @dataProvider provideInvalidSetNames
	 */
	public function testProductionValidatorRejectsInvalidSetNames( string $name ): void {
		$this->assertFalse(
			SetNameSanitizer::isValid( $name ),
			"Production validator SetNameSanitizer::isValid() should reject '$name'"
		);
	}

	/**
	 * Provide invalid set names according to production specification:
	 * empty, whitespace-only, path separators, control characters, disallowed symbols, >255 chars.
	 *
	 * @return array<string, array{0: string}>
	 */
	public static function provideInvalidSetNames(): array {
		return [
			'empty string' => [ '' ],
			'whitespace only' => [ '   ' ],
			'too long (256 chars)' => [ str_repeat( 'a', 256 ) ],
			'multibyte too long (256 chars)' => [ str_repeat( 'ä', 256 ) ],
			'with dot' => [ 'set.name' ],
			'with forward slash' => [ 'path/name' ],
			'with backslash' => [ "path\\name" ],
			'with special chars' => [ 'set@name' ],
			'with emoji' => [ 'set🔥' ],
			'HTML injection attempt' => [ '<script>' ],
			'SQL injection attempt' => [ "'; DROP TABLE--" ],
			'control character null byte' => [ "set\x00name" ],
			'control character newline' => [ "set\nname" ],
		];
	}

	/**
	 * Test boundary conditions for production length limits (255 chars).
	 */
	public function testSetNameLengthBoundaries(): void {
		// Single character should pass
		$this->assertTrue( SetNameSanitizer::isValid( 'x' ) );

		// Exactly 255 characters should pass
		$this->assertTrue( SetNameSanitizer::isValid( str_repeat( 'x', 255 ) ) );

		// 256 characters should fail
		$this->assertFalse( SetNameSanitizer::isValid( str_repeat( 'x', 256 ) ) );

		// Multibyte 255 characters should pass
		$this->assertTrue( SetNameSanitizer::isValid( str_repeat( 'ü', 255 ) ) );

		// Multibyte 256 characters should fail
		$this->assertFalse( SetNameSanitizer::isValid( str_repeat( 'ü', 256 ) ) );

		// 0 characters should fail
		$this->assertFalse( SetNameSanitizer::isValid( '' ) );
	}

	/**
	 * @dataProvider provideInvalidApiRenameParams
	 */
	public function testApiLayersRenameRejectsInvalidNames( array $params ): void {
		$api = $this->createMockApiLayersRename( $params );

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( LayersConstants::ERROR_INVALID_SETNAME );
		$api->execute();
	}

	/**
	 * @return array<string, array{0: array<string, mixed>}>
	 */
	public static function provideInvalidApiRenameParams(): array {
		return [
			'file route empty oldname' => [ [
				'filename' => 'Test.png',
				'oldname' => '',
				'newname' => 'valid-name',
			] ],
			'file route whitespace oldname' => [ [
				'filename' => 'Test.png',
				'oldname' => '   ',
				'newname' => 'valid-name',
			] ],
			'file route path traversal only oldname' => [ [
				'filename' => 'Test.png',
				'oldname' => '///',
				'newname' => 'valid-name',
			] ],
			'file route HTML tag stripping in oldname' => [ [
				'filename' => 'Test.png',
				'oldname' => '<script>',
				'newname' => 'valid-name',
			] ],
			'file route emoji in oldname' => [ [
				'filename' => 'Test.png',
				'oldname' => 'set🔥',
				'newname' => 'valid-name',
			] ],
			'file route leading whitespace in oldname' => [ [
				'filename' => 'Test.png',
				'oldname' => '  valid-old',
				'newname' => 'valid-name',
			] ],
			'file route consecutive spaces in oldname' => [ [
				'filename' => 'Test.png',
				'oldname' => 'old  name',
				'newname' => 'valid-name',
			] ],
			'file route truncation oldname (>255 chars)' => [ [
				'filename' => 'Test.png',
				'oldname' => str_repeat( 'a', 256 ),
				'newname' => 'valid-name',
			] ],
			'file route empty newname' => [ [
				'filename' => 'Test.png',
				'oldname' => 'valid-old',
				'newname' => '',
			] ],
			'file route whitespace newname' => [ [
				'filename' => 'Test.png',
				'oldname' => 'valid-old',
				'newname' => '   ',
			] ],
			'file route disallowed chars only newname' => [ [
				'filename' => 'Test.png',
				'oldname' => 'valid-old',
				'newname' => '$$$',
			] ],
			'file route HTML tag stripping in newname' => [ [
				'filename' => 'Test.png',
				'oldname' => 'valid-old',
				'newname' => '<script>',
			] ],
			'file route emoji in newname' => [ [
				'filename' => 'Test.png',
				'oldname' => 'valid-old',
				'newname' => 'new🔥set',
			] ],
			'file route trailing whitespace in newname' => [ [
				'filename' => 'Test.png',
				'oldname' => 'valid-old',
				'newname' => 'valid-new  ',
			] ],
			'file route consecutive spaces in newname' => [ [
				'filename' => 'Test.png',
				'oldname' => 'valid-old',
				'newname' => 'new  name',
			] ],
			'file route truncation newname (>255 chars)' => [ [
				'filename' => 'Test.png',
				'oldname' => 'valid-old',
				'newname' => str_repeat( 'b', 256 ),
			] ],
			'slide route empty oldname' => [ [
				'slidename' => 'Deck1',
				'oldname' => '',
				'newname' => 'valid-name',
			] ],
			'slide route whitespace newname' => [ [
				'slidename' => 'Deck1',
				'oldname' => 'valid-old',
				'newname' => '   ',
			] ],
			'slide route HTML tag in oldname' => [ [
				'slidename' => 'Deck1',
				'oldname' => '<script>',
				'newname' => 'valid-new',
			] ],
			'slide route HTML tag in newname' => [ [
				'slidename' => 'Deck1',
				'oldname' => 'valid-old',
				'newname' => '<script>',
			] ],
			'slide route emoji in newname' => [ [
				'slidename' => 'Deck1',
				'oldname' => 'valid-old',
				'newname' => 'slide🔥',
			] ],
		];
	}

	public function testApiLayersRenameExecutesWithValidUnicodeAndSpacedNames(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturn( false );
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'renameNamedSet' )
			->with( 'Test.png', 'sha123', 'набор', 'новый набор', 1, 10 )
			->willReturn( true );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersRename(
			[
				'filename' => 'Test.png',
				'oldname' => 'набор',
				'newname' => 'новый набор',
				'page' => 1,
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( 'новый набор', $result->values['newname'] );
		$this->assertSame( 'набор', $result->values['oldname'] );
	}

	public function testApiLayersRenameAllPagesWithValidUnicodeAndSpacedNames(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturn( false );
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'renameNamedSet' )
			->with( 'Document.pdf', 'sha123', 'draft notes', 'final notes', null, 10 )
			->willReturn( true );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersRename(
			[
				'filename' => 'Document.pdf',
				'oldname' => 'draft notes',
				'newname' => 'final notes',
				'allpages' => true,
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( 'final notes', $result->values['newname'] );
		$this->assertSame( 'draft notes', $result->values['oldname'] );
	}

	public function testApiLayersRenameSlideExecutesWithValidUnicodeAndSpacedNames(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		// Source set exists, target set does not exist
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === 'старый слайд';
			}
		);
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'renameNamedSet' )
			->with( 'Slide:Deck1', LayersConstants::TYPE_SLIDE, 'старый слайд', 'новый слайд', 1, 10 )
			->willReturn( true );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersRename(
			[
				'slidename' => 'Deck1',
				'oldname' => 'старый слайд',
				'newname' => 'новый слайд',
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( 'старый слайд', $result->values['oldname'] );
		$this->assertSame( 'новый слайд', $result->values['newname'] );
	}

	public function testApiLayersRenameSlidePrefixExecutesWithValidUnicodeAndSpacedNames(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === 'section a';
			}
		);
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'renameNamedSet' )
			->with( 'Slide:Presentation', LayersConstants::TYPE_SLIDE, 'section a', 'section b', 1, 10 )
			->willReturn( true );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersRename(
			[
				'filename' => 'Slide:Presentation',
				'oldname' => 'section a',
				'newname' => 'section b',
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( 'section a', $result->values['oldname'] );
		$this->assertSame( 'section b', $result->values['newname'] );
	}

	public function testApiLayersRenameRejectsCollisionWhenTargetSetExists(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		// Collision: target set already exists!
		$db->method( 'namedSetExists' )->willReturn( true );

		$api = $this->createMockApiLayersRename(
			[
				'filename' => 'Test.png',
				'oldname' => 'set-a',
				'newname' => 'set-b',
			],
			$db
		);

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( LayersConstants::ERROR_SETNAME_EXISTS );
		$api->execute();
	}

	public function testApiLayersRenameRejectsMissingSourceSet(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		// Source set does not exist!
		$api = $this->createMockApiLayersRename(
			[
				'filename' => 'Test.png',
				'oldname' => 'nonexistent',
				'newname' => 'valid-new',
			],
			$db,
			null,
			// null layerSet
			null
		);

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( LayersConstants::ERROR_LAYERSET_NOT_FOUND );
		$api->execute();
	}

	public function testApiLayersRenameRejectsNonOwner(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturn( false );
		// Owner is user 999, but current user is 10
		$db->method( 'getNamedSetOwner' )->willReturn( 999 );

		$api = $this->createMockApiLayersRename(
			[
				'filename' => 'Test.png',
				'oldname' => 'set-a',
				'newname' => 'set-b',
			],
			$db
		);

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( LayersConstants::ERROR_RENAME_PERMISSION_DENIED );
		$api->execute();
	}

	public function testApiLayersRenameDoesNotRedirectWhenSanitizedSetExists(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		// Suppose a set named 'script' legitimately exists in the database
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === 'script';
			}
		);
		// renameNamedSet must NEVER be called!
		$db->expects( $this->never() )->method( 'renameNamedSet' );

		// 1. Calling rename with '<script>' as oldname must fail, not silently rename 'script'
		$apiOld = $this->createMockApiLayersRename(
			[
				'filename' => 'Test.png',
				'oldname' => '<script>',
				'newname' => 'target',
			],
			$db
		);

		try {
			$apiOld->execute();
			$this->fail( 'Expected invalidsetname exception for oldname <script>' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( LayersConstants::ERROR_INVALID_SETNAME, $e->getMessage() );
		}

		// 2. Calling rename with '<script>' as newname must fail, not silently rename to 'script'
		$apiNew = $this->createMockApiLayersRename(
			[
				'filename' => 'Test.png',
				'oldname' => 'valid-source',
				'newname' => '<script>',
			],
			$db
		);

		try {
			$apiNew->execute();
			$this->fail( 'Expected invalidsetname exception for newname <script>' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( LayersConstants::ERROR_INVALID_SETNAME, $e->getMessage() );
		}
	}

	public function testApiLayersRenameAllowsLiteralZero(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === '0';
			}
		);
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'renameNamedSet' )
			->with( 'Test.png', 'sha123', '0', '1', 1, 10 )
			->willReturn( true );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersRename(
			[
				'filename' => 'Test.png',
				'oldname' => '0',
				'newname' => '1',
				'page' => 1,
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( '0', $result->values['oldname'] );
		$this->assertSame( '1', $result->values['newname'] );
	}

	public function testApiLayersRenameSlideAllowsLiteralZero(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === '0';
			}
		);
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'renameNamedSet' )
			->with( 'Slide:Deck1', LayersConstants::TYPE_SLIDE, '0', 'default', 1, 10 )
			->willReturn( true );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersRename(
			[
				'slidename' => 'Deck1',
				'oldname' => '0',
				'newname' => 'default',
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( '0', $result->values['oldname'] );
		$this->assertSame( 'default', $result->values['newname'] );
	}

	private function createMockUser( int $id = 10, bool $isAdmin = false ): UserIdentity {
		$user = $this->getMockBuilder( UserIdentity::class )
			->addMethods( [ 'isAllowed' ] )
			->getMockForAbstractClass();
		$user->method( 'getId' )->willReturn( $id );
		$user->method( 'getName' )->willReturn( 'Tester' );
		$user->method( 'isAllowed' )->willReturn( $isAdmin );
		return $user;
	}

	private function createResultMock(): object {
		return new class {
			/** @var array<string, mixed> */
			public array $values = [];

			/**
			 * @param mixed $path
			 * @param string $name
			 * @param mixed $value
			 */
			public function addValue( $path, $name, $value ): void {
				if ( is_array( $value ) ) {
					$this->values = array_merge( $this->values, $value );
				} else {
					$this->values[$name] = $value;
				}
			}
		};
	}

	private function createMockApiLayersRename(
		array $params,
		?LayersDatabase $db = null,
		?object $result = null,
		?array $layerSet = [ 'id' => 1 ]
	): ApiLayersRename {
		if ( $db === null ) {
			$db = $this->createMock( LayersDatabase::class );
			$db->method( 'isSchemaReady' )->willReturn( true );
		}
		if ( $result === null ) {
			$result = $this->createResultMock();
		}

		$user = $this->createMockUser();
		$limiter = new class extends RateLimiter {
			public function checkRateLimit( $user, string $action ): bool {
				return true;
			}
		};

		$api = $this->getMockBuilder( ApiLayersRename::class )
			->disableOriginalConstructor()
			->onlyMethods( [
				'getUser', 'extractRequestParams', 'checkUserRightsAny', 'getLayersDatabase',
				'createRateLimiter', 'validateAndGetFile', 'requireTitleEditPermission',
				'getFileSha1', 'resolvePageParam', 'getLayerSetWithFallback', 'getLogger',
				'invalidateCachesForFile', 'createAuditTrailEntry', 'getResult'
			] )
			->getMock();

		$api->method( 'getUser' )->willReturn( $user );
		$api->method( 'extractRequestParams' )->willReturn( $params );
		$api->method( 'getLayersDatabase' )->willReturn( $db );
		$api->method( 'createRateLimiter' )->willReturn( $limiter );

		$filename = $params['filename'] ?? 'Test.png';
		$title = Title::newFromText( $filename, NS_FILE );
		$api->method( 'validateAndGetFile' )->willReturn( [
			'title' => $title,
			'file' => new \stdClass(),
			'imgName' => $filename,
		] );
		$api->method( 'getFileSha1' )->willReturn( 'sha123' );
		$api->method( 'resolvePageParam' )->willReturn( (int)( $params['page'] ?? 1 ) );
		$api->method( 'getLayerSetWithFallback' )->willReturn( $layerSet );
		$api->method( 'getLogger' )->willReturn( new NullLogger() );
		$api->method( 'getResult' )->willReturn( $result );

		return $api;
	}
}
