<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersDelete;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Title\Title;
use MediaWiki\User\UserIdentity;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * Unit tests for ApiLayersDelete set name validation, canonical literal checking,
 * non-redirection, and execution.
 *
 * @group Layers
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersDelete
 */
class ApiLayersDeleteValidationTest extends TestCase {

	/**
	 * @dataProvider provideInvalidApiDeleteParams
	 */
	public function testApiLayersDeleteRejectsNoncanonicalNames( array $params ): void {
		$api = $this->createMockApiLayersDelete( $params );

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( LayersConstants::ERROR_INVALID_SETNAME );
		$api->execute();
	}

	/**
	 * @return array<string, array{0: array<string, mixed>}>
	 */
	public static function provideInvalidApiDeleteParams(): array {
		return [
			'file route empty setname' => [ [
				'filename' => 'Test.png',
				'setname' => '',
			] ],
			'file route whitespace setname' => [ [
				'filename' => 'Test.png',
				'setname' => '   ',
			] ],
			'file route leading whitespace' => [ [
				'filename' => 'Test.png',
				'setname' => '  valid-name',
			] ],
			'file route trailing whitespace' => [ [
				'filename' => 'Test.png',
				'setname' => 'valid-name  ',
			] ],
			'file route consecutive spaces' => [ [
				'filename' => 'Test.png',
				'setname' => 'two  spaces',
			] ],
			'file route path slash' => [ [
				'filename' => 'Test.png',
				'setname' => '///',
			] ],
			'file route path traversal forward' => [ [
				'filename' => 'Test.png',
				'setname' => 'foo/bar',
			] ],
			'file route path traversal backslash' => [ [
				'filename' => 'Test.png',
				'setname' => "foo\\bar",
			] ],
			'file route HTML tag stripping attempt' => [ [
				'filename' => 'Test.png',
				'setname' => '<script>',
			] ],
			'file route emoji stripping attempt' => [ [
				'filename' => 'Test.png',
				'setname' => 'set🔥',
			] ],
			'file route truncation (>255 chars)' => [ [
				'filename' => 'Test.png',
				'setname' => str_repeat( 'a', 256 ),
			] ],
			'file route disallowed symbols' => [ [
				'filename' => 'Test.png',
				'setname' => '$$$',
			] ],
			'slide route empty setname' => [ [
				'slidename' => 'Deck1',
				'setname' => '',
			] ],
			'slide route whitespace setname' => [ [
				'slidename' => 'Deck1',
				'setname' => '   ',
			] ],
			'slide route HTML tag in setname' => [ [
				'slidename' => 'Deck1',
				'setname' => '<script>',
			] ],
			'slide route emoji in setname' => [ [
				'slidename' => 'Deck1',
				'setname' => 'slide🔥',
			] ],
			'slide route leading whitespace' => [ [
				'slidename' => 'Deck1',
				'setname' => '  slide-set',
			] ],
			'slide route trailing whitespace' => [ [
				'slidename' => 'Deck1',
				'setname' => 'slide-set  ',
			] ],
		];
	}

	public function testApiLayersDeleteDoesNotRedirectWhenSanitizedSetExists(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		// Suppose a set named 'script' legitimately exists in the database
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === 'script';
			}
		);
		// deleteNamedSet must NEVER be called!
		$db->expects( $this->never() )->method( 'deleteNamedSet' );

		// File route: calling delete with '<script>' must fail with invalidsetname,
		// never silently deleting 'script'
		$apiFile = $this->createMockApiLayersDelete(
			[
				'filename' => 'Test.png',
				'setname' => '<script>',
			],
			$db
		);

		try {
			$apiFile->execute();
			$this->fail( 'Expected invalidsetname exception for setname <script>' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( LayersConstants::ERROR_INVALID_SETNAME, $e->getMessage() );
		}

		// Slide route: calling delete with '<script>' must fail with invalidsetname,
		// never silently deleting 'script'
		$apiSlide = $this->createMockApiLayersDelete(
			[
				'slidename' => 'Deck1',
				'setname' => '<script>',
			],
			$db
		);

		try {
			$apiSlide->execute();
			$this->fail( 'Expected invalidsetname exception for slide setname <script>' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( LayersConstants::ERROR_INVALID_SETNAME, $e->getMessage() );
		}
	}

	public function testApiLayersDeleteAllowsLiteralZero(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === '0';
			}
		);
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'deleteNamedSet' )
			->with( 'Test.png', 'sha123', '0', 1, 10 )
			->willReturn( 1 );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersDelete(
			[
				'filename' => 'Test.png',
				'setname' => '0',
				'page' => 1,
			],
			$db,
			$result,
			[ 'id' => 1, 'name' => '0' ]
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( '0', $result->values['setname'] );
		$this->assertSame( 1, $result->values['revisionsDeleted'] );
	}

	public function testApiLayersDeleteExecutesWithValidUnicodeAndSpacedNames(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === 'набор данных';
			}
		);
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'deleteNamedSet' )
			->with( 'Test.png', 'sha123', 'набор данных', 1, 10 )
			->willReturn( 2 );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersDelete(
			[
				'filename' => 'Test.png',
				'setname' => 'набор данных',
				'page' => 1,
			],
			$db,
			$result,
			[ 'id' => 1, 'name' => 'набор данных' ]
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( 'набор данных', $result->values['setname'] );
		$this->assertSame( 2, $result->values['revisionsDeleted'] );
	}

	public function testApiLayersDeleteAllPagesDeletesAcrossPages(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'deleteNamedSet' )
			->with( 'Document.pdf', 'sha123', 'notes', null, 10 )
			->willReturn( 5 );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersDelete(
			[
				'filename' => 'Document.pdf',
				'setname' => 'notes',
				'allpages' => true,
			],
			$db,
			$result,
			[ 'id' => 1, 'name' => 'notes' ]
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( 'notes', $result->values['setname'] );
		$this->assertSame( 5, $result->values['revisionsDeleted'] );
	}

	public function testApiLayersDeleteSlideExecutesWithValidUnicodeAndSpacedNames(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === 'слайд набор';
			}
		);
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'deleteNamedSet' )
			->with( 'Slide:Deck1', LayersConstants::TYPE_SLIDE, 'слайд набор', 1, 10 )
			->willReturn( 1 );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersDelete(
			[
				'slidename' => 'Deck1',
				'setname' => 'слайд набор',
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( 'слайд набор', $result->values['setname'] );
	}

	public function testApiLayersDeleteSlideAllowsLiteralZero(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturnCallback(
			static function ( $imgName, $sha1, $name ) {
				return $name === '0';
			}
		);
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$db->expects( $this->once() )
			->method( 'deleteNamedSet' )
			->with( 'Slide:Deck1', LayersConstants::TYPE_SLIDE, '0', 1, 10 )
			->willReturn( 1 );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersDelete(
			[
				'slidename' => 'Deck1',
				'setname' => '0',
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( '0', $result->values['setname'] );
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

	private function createMockApiLayersDelete(
		array $params,
		?LayersDatabase $db = null,
		?object $result = null,
		?array $layerSet = [ 'id' => 1 ]
	): ApiLayersDelete {
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

		$api = $this->getMockBuilder( ApiLayersDelete::class )
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
		$fileMock = new class {
			public function getSha1(): string {
				return 'sha123';
			}
		};
		$api->method( 'validateAndGetFile' )->willReturn( [
			'title' => $title,
			'file' => $fileMock,
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
