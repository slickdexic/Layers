<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersInfo;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Title\Title;
use MediaWiki\User\UserIdentity;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * Unit tests for ApiLayersInfo set name canonical validation, recency fallback,
 * and non-redirection.
 *
 * @group Layers
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersInfo
 */
class ApiLayersInfoValidationTest extends TestCase {

	/**
	 * @dataProvider provideNoncanonicalSetNames
	 */
	public function testApiLayersInfoRejectsNoncanonicalExplicitSetNames( array $params ): void {
		$api = $this->createMockApiLayersInfo( $params );

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( LayersConstants::ERROR_INVALID_SETNAME );
		$api->execute();
	}

	/**
	 * @return array<string, array{0: array<string, mixed>}>
	 */
	public static function provideNoncanonicalSetNames(): array {
		return [
			'file route whitespace only' => [ [
				'filename' => 'Test.png',
				'setname' => '   ',
			] ],
			'file route leading whitespace' => [ [
				'filename' => 'Test.png',
				'setname' => '  set-name',
			] ],
			'file route trailing whitespace' => [ [
				'filename' => 'Test.png',
				'setname' => 'set-name  ',
			] ],
			'file route consecutive spaces' => [ [
				'filename' => 'Test.png',
				'setname' => 'two  spaces',
			] ],
			'file route forward slash' => [ [
				'filename' => 'Test.png',
				'setname' => 'path/name',
			] ],
			'file route backslash' => [ [
				'filename' => 'Test.png',
				'setname' => "path\\name",
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
			'slide route whitespace only' => [ [
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

	public function testApiLayersInfoDoesNotFallbackWhenNoncanonicalSetSupplied(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );

		// Neither getLayerSetByName nor getLatestLayerSet should ever be called when setname is invalid
		$db->expects( $this->never() )->method( 'getLayerSetByName' );
		$db->expects( $this->never() )->method( 'getLatestLayerSet' );

		$api = $this->createMockApiLayersInfo(
			[
				'filename' => 'Test.png',
				'setname' => '<script>',
			],
			$db
		);

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( LayersConstants::ERROR_INVALID_SETNAME );
		$api->execute();
	}

	public function testApiLayersInfoAllowsOmissionForRecencyFallback(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Test.png', 'sha123', null, 1 )
			->willReturn( [
				'id' => 42,
				'imgName' => 'Test.png',
				'userId' => 10,
				'timestamp' => '20260910000000',
				'revision' => 1,
				'setName' => 'auto-recent',
				'data' => [],
			] );
		$db->method( 'getNamedSetsForImage' )->willReturn( [] );

		$result = $this->createResultMock();
		// Omitted setname
		$api = $this->createMockApiLayersInfo(
			[
				'filename' => 'Test.png',
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertArrayHasKey( 'layersinfo', $result->values );
		$this->assertSame( 42, $result->values['layersinfo']['layerset']['id'] );
		$this->assertSame( 'auto-recent', $result->values['layersinfo']['layerset']['name'] );
	}

	public function testApiLayersInfoAllowsEmptyStringForRecencyFallback(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Test.png', 'sha123', null, 1 )
			->willReturn( [
				'id' => 43,
				'imgName' => 'Test.png',
				'userId' => 10,
				'timestamp' => '20260910000000',
				'revision' => 2,
				'setName' => 'latest-set',
				'data' => [],
			] );
		$db->method( 'getNamedSetsForImage' )->willReturn( [] );

		$result = $this->createResultMock();
		// Empty string setname
		$api = $this->createMockApiLayersInfo(
			[
				'filename' => 'Test.png',
				'setname' => '',
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertArrayHasKey( 'layersinfo', $result->values );
		$this->assertSame( 43, $result->values['layersinfo']['layerset']['id'] );
		$this->assertSame( 'latest-set', $result->values['layersinfo']['layerset']['name'] );
	}

	public function testApiLayersInfoAllowsLiteralZero(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->expects( $this->once() )
			->method( 'getLayerSetByName' )
			->with( 'Test.png', 'sha123', '0', 1 )
			->willReturn( [
				'id' => 99,
				'imgName' => 'Test.png',
				'userId' => 10,
				'timestamp' => '20260910000000',
				'revision' => 1,
				'setName' => '0',
				'data' => [],
			] );
		$db->method( 'getSetRevisions' )->willReturn( [] );
		$db->method( 'getNamedSetsForImage' )->willReturn( [] );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersInfo(
			[
				'filename' => 'Test.png',
				'setname' => '0',
				'page' => 1,
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertArrayHasKey( 'layersinfo', $result->values );
		$this->assertSame( 99, $result->values['layersinfo']['layerset']['id'] );
		$this->assertSame( '0', $result->values['layersinfo']['layerset']['name'] );
	}

	public function testApiLayersInfoAllowsUnicodeAndSpacedNames(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->expects( $this->once() )
			->method( 'getLayerSetByName' )
			->with( 'Test.png', 'sha123', 'набор данных', 1 )
			->willReturn( [
				'id' => 101,
				'imgName' => 'Test.png',
				'userId' => 10,
				'timestamp' => '20260910000000',
				'revision' => 1,
				'setName' => 'набор данных',
				'data' => [],
			] );
		$db->method( 'getSetRevisions' )->willReturn( [] );
		$db->method( 'getNamedSetsForImage' )->willReturn( [] );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersInfo(
			[
				'filename' => 'Test.png',
				'setname' => 'набор данных',
				'page' => 1,
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertArrayHasKey( 'layersinfo', $result->values );
		$this->assertSame( 101, $result->values['layersinfo']['layerset']['id'] );
		$this->assertSame( 'набор данных', $result->values['layersinfo']['layerset']['name'] );
	}

	public function testApiLayersInfoSlideAllowsLiteralZero(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->expects( $this->once() )
			->method( 'getLayerSetByName' )
			->with( 'Slide:Deck1', LayersConstants::TYPE_SLIDE, '0' )
			->willReturn( [
				'id' => 200,
				'imgName' => 'Slide:Deck1',
				'userId' => 10,
				'timestamp' => '20260910000000',
				'revision' => 1,
				'setName' => '0',
				'data' => [],
			] );
		$db->method( 'getSetRevisions' )->willReturn( [] );
		$db->method( 'getNamedSetsForImage' )->willReturn( [] );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersInfo(
			[
				'slidename' => 'Deck1',
				'setname' => '0',
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertArrayHasKey( 'layersinfo', $result->values );
		$this->assertSame( 200, $result->values['layersinfo']['layerset']['id'] );
		$this->assertSame( '0', $result->values['layersinfo']['layerset']['name'] );
	}

	public function testApiLayersInfoSlideAllowsOmissionForRecencyFallback(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->expects( $this->once() )
			->method( 'getLatestLayerSet' )
			->with( 'Slide:Deck1', LayersConstants::TYPE_SLIDE )
			->willReturn( [
				'id' => 201,
				'imgName' => 'Slide:Deck1',
				'userId' => 10,
				'timestamp' => '20260910000000',
				'revision' => 1,
				'setName' => 'recent-slide-set',
				'data' => [],
			] );
		$db->method( 'getSetRevisions' )->willReturn( [] );
		$db->method( 'getNamedSetsForImage' )->willReturn( [] );

		$result = $this->createResultMock();
		$api = $this->createMockApiLayersInfo(
			[
				'slidename' => 'Deck1',
			],
			$db,
			$result
		);

		$api->execute();

		$this->assertArrayHasKey( 'layersinfo', $result->values );
		$this->assertSame( 201, $result->values['layersinfo']['layerset']['id'] );
		$this->assertSame( 'recent-slide-set', $result->values['layersinfo']['layerset']['name'] );
	}

	private function createMockUser( int $id = 10 ): UserIdentity {
		$user = $this->getMockBuilder( UserIdentity::class )
			->addMethods( [ 'isAllowed' ] )
			->getMockForAbstractClass();
		$user->method( 'getId' )->willReturn( $id );
		$user->method( 'getName' )->willReturn( 'Tester' );
		$user->method( 'isAllowed' )->willReturn( false );
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
			 * @param int $flags
			 */
			public function addValue( $path, $name, $value, int $flags = 0 ): void {
				if ( $path === null ) {
					$this->values[$name] = $value;
				} elseif ( is_array( $value ) ) {
					$this->values = array_merge( $this->values, $value );
				} else {
					$this->values[$name] = $value;
				}
			}
		};
	}

	private function createMockApiLayersInfo(
		array $params,
		?LayersDatabase $db = null,
		?object $result = null
	): ApiLayersInfo {
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

		$permissionManager = $this->getMockBuilder( \stdClass::class )
			->addMethods( [ 'userCan' ] )
			->getMock();
		$permissionManager->method( 'userCan' )->willReturn( true );

		$fileMock = new class {
			public function exists(): bool {
				return true;
			}

			public function getWidth( int $page = 1 ): int {
				return 800;
			}

			public function getHeight( int $page = 1 ): int {
				return 600;
			}

			public function getSha1(): string {
				return 'sha123';
			}
		};

		$repoGroup = $this->getMockBuilder( \stdClass::class )
			->addMethods( [ 'findFile' ] )
			->getMock();
		$repoGroup->method( 'findFile' )->willReturn( $fileMock );

		$api = $this->getMockBuilder( ApiLayersInfo::class )
			->disableOriginalConstructor()
			->onlyMethods( [
				'getUser', 'createRateLimiter', 'extractRequestParams', 'getTitleFromFilename',
				'getPermissionManager', 'getRepoGroup', 'getLayersDatabase', 'getLogger',
				'resolvePageParam', 'getPageCount', 'getFileSha1', 'isForeignFile',
				'getResult', 'getModuleName'
			] )
			->addMethods( [ 'msg' ] )
			->getMock();

		$api->method( 'getUser' )->willReturn( $user );
		$api->method( 'createRateLimiter' )->willReturn( $limiter );
		$api->method( 'extractRequestParams' )->willReturn( $params );

		$filename = $params['filename'] ?? 'Test.png';
		$title = Title::newFromText( $filename, NS_FILE );
		$api->method( 'getTitleFromFilename' )->willReturn( $title );
		$api->method( 'getPermissionManager' )->willReturn( $permissionManager );
		$api->method( 'getRepoGroup' )->willReturn( $repoGroup );
		$api->method( 'getLayersDatabase' )->willReturn( $db );
		$api->method( 'getLogger' )->willReturn( new NullLogger() );
		$api->method( 'resolvePageParam' )->willReturn( (int)( $params['page'] ?? 1 ) );
		$api->method( 'getPageCount' )->willReturn( 1 );
		$api->method( 'getFileSha1' )->willReturn( 'sha123' );
		$api->method( 'isForeignFile' )->willReturn( false );
		$msgMock = new class {
			public function text(): string {
				return 'No layers';
			}
		};
		$api->method( 'msg' )->willReturn( $msgMock );
		$api->method( 'getResult' )->willReturn( $result );
		$api->method( 'getModuleName' )->willReturn( 'layersinfo' );

		return $api;
	}
}
