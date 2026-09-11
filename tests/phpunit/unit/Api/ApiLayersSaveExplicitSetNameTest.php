<?php
// phpcs:disable MediaWiki.Files.OneClassPerFile,Generic.Files.OneObjectStructurePerFile,MediaWiki.Commenting.PropertyDocumentation.MissingDocumentationPrivate -- Test harness classes

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersInfo;
use MediaWiki\Extension\Layers\Api\ApiLayersSave;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use Psr\Log\NullLogger;

/**
 * Verifies that explicit API set names are honored literally without being
 * discarded as wikitext display directives (R6.09, task J01).
 *
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersInfo
 * @covers \MediaWiki\Extension\Layers\Utility\SetNameResolver
 */
class ApiLayersSaveExplicitSetNameTest extends \MediaWikiUnitTestCase {

	/**
	 * Literal explicit names to test, covering wikitext display keywords and an ordinary name.
	 */
	public static function provideLiteralExplicitNames(): array {
		return [
			'literal-on' => [ 'on' ],
			'literal-off' => [ 'off' ],
			'literal-all' => [ 'all' ],
			'literal-true' => [ 'true' ],
			'literal-false' => [ 'false' ],
			'literal-1' => [ '1' ],
			'literal-0' => [ '0' ],
			'ordinary-name' => [ 'custom-notes' ],
		];
	}

	private function createMockUser(): \MediaWiki\User\User {
		$user = $this->createMock( \MediaWiki\User\User::class );
		$user->method( 'getId' )->willReturn( 42 );
		$user->method( 'getName' )->willReturn( 'Tester' );
		return $user;
	}

	private function createMockRateLimiter(): RateLimiter {
		$rateLimiter = $this->createMock( RateLimiter::class );
		$rateLimiter->method( 'isLayerCountAllowed' )->willReturn( true );
		$rateLimiter->method( 'isComplexityAllowed' )->willReturn( true );
		$rateLimiter->method( 'isImageSizeAllowed' )->willReturn( true );
		$rateLimiter->method( 'checkRateLimit' )->willReturn( true );
		return $rateLimiter;
	}

	private function createApiSaveMock(
		array $requestParams,
		LayersDatabase $db,
		$mockFile = null
	): ApiLayersSave {
		$user = $this->createMockUser();
		$rateLimiter = $this->createMockRateLimiter();
		$repoGroup = new MockLayersRepoGroup( $mockFile ?? new MockLayersFile() );

		$api = $this->getMockBuilder( ApiLayersSave::class )
			->disableOriginalConstructor()
			->onlyMethods( [
				'getUser',
				'extractRequestParams',
				'checkUserRightsAny',
				'requireTitleEditPermission',
				'getLayersDatabase',
				'getConfig',
				'createRateLimiter',
				'getRepoGroup',
				'invalidateCachesForFile',
				'createAuditTrailEntry',
				'getLogger',
			] )
			->getMock();

		$api->method( 'getUser' )->willReturn( $user );
		$api->method( 'extractRequestParams' )->willReturn( $requestParams );
		$api->method( 'getLayersDatabase' )->willReturn( $db );
		$api->method( 'getConfig' )->willReturn(
			new \HashConfig( [
				'LayersMaxBytes' => 2097152,
				'LayersDefaultSetName' => 'default',
			] )
		);
		$api->method( 'createRateLimiter' )->willReturn( $rateLimiter );
		$api->method( 'getRepoGroup' )->willReturn( $repoGroup );
		$api->method( 'getLogger' )->willReturn( new NullLogger() );

		return $api;
	}

	/**
	 * @dataProvider provideLiteralExplicitNames
	 */
	public function testExplicitSaveOnImageHonorsLiteralNameAndDoesNotOverwritePriorLatest(
		string $literalName
	): void {
		$savedSets = [];
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturn( true );

		// Prior latest set exists under a different name
		$db->method( 'getLatestLayerSet' )->willReturn( [
			'id' => 10,
			'setName' => 'prior-active-set',
			'revision' => 5,
		] );

		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback(
				static function ( $imgName, $imgMetadata, $data, $userId, $setName, $bgSettings ) use ( &$savedSets ) {
					$savedSets[] = [
						'imgName' => $imgName,
						'page' => $imgMetadata['page'],
						'setName' => $setName,
					];
					return 101;
				}
			);

		$api = $this->createApiSaveMock(
			[
				'filename' => 'Photo.png',
				'setname' => $literalName,
				'data' => json_encode( [
					'layers' => [
						[ 'id' => 'l1', 'type' => 'text', 'text' => 'Hello', 'x' => 10, 'y' => 10 ]
					]
				] ),
			],
			$db,
			new MockLayersFile( 1, 'image/png', 'sha1-photo' )
		);

		$api->execute();

		$this->assertCount( 1, $savedSets );
		$this->assertSame( $literalName, $savedSets[0]['setName'] );
		$this->assertNotSame( 'prior-active-set', $savedSets[0]['setName'] );
		$this->assertSame( 1, $savedSets[0]['page'] );
	}

	/**
	 * @dataProvider provideLiteralExplicitNames
	 */
	public function testExplicitSaveOnSlideHonorsLiteralNameAndDoesNotOverwritePriorLatest(
		string $literalName
	): void {
		$savedSets = [];
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );

		// Prior latest slide set exists
		$db->method( 'getLatestLayerSet' )->willReturn( [
			'id' => 20,
			'setName' => 'prior-slide-set',
			'revision' => 3,
		] );

		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback(
				static function ( $imgName, $imgMetadata, $data, $userId, $setName, $bgSettings ) use ( &$savedSets ) {
					$savedSets[] = [
						'imgName' => $imgName,
						'setName' => $setName,
						'sha1' => $imgMetadata['sha1'],
					];
					return 201;
				}
			);

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'MyDeck',
				'setname' => $literalName,
				'data' => json_encode( [
					'layers' => [
						[ 'id' => 's1', 'type' => 'text', 'text' => 'Slide Content', 'x' => 50, 'y' => 50 ]
					],
					'canvasWidth' => 800,
					'canvasHeight' => 600,
				] ),
			],
			$db
		);

		$api->execute();

		$this->assertCount( 1, $savedSets );
		$this->assertSame( 'Slide:MyDeck', $savedSets[0]['imgName'] );
		$this->assertSame( $literalName, $savedSets[0]['setName'] );
		$this->assertNotSame( 'prior-slide-set', $savedSets[0]['setName'] );
		$this->assertSame( LayersConstants::TYPE_SLIDE, $savedSets[0]['sha1'] );
	}

	/**
	 * @dataProvider provideLiteralExplicitNames
	 */
	public function testExplicitSaveOnPdfPreservesPageIdentityAndHonorsLiteralName( string $literalName ): void {
		$savedSets = [];
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturn( true );

		// Prior latest sets exist per page
		$db->method( 'getLatestLayerSet' )->willReturnCallback(
			static function ( $img, $sha, $set, $page ) {
				return [
					'id' => 30,
					'setName' => 'page-' . $page . '-active',
					'revision' => 1,
				];
			}
		);

		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback(
				static function ( $imgName, $imgMetadata, $data, $userId, $setName, $bgSettings ) use ( &$savedSets ) {
					$savedSets[] = [
						'imgName' => $imgName,
						'page' => $imgMetadata['page'],
						'setName' => $setName,
					];
					return 301;
				}
			);

		$mockPdf = new MockLayersFile( 4, 'application/pdf', 'sha1-pdf' );
		$api = $this->createApiSaveMock(
			[
				'filename' => 'Manual.pdf',
				'page' => 2,
				'setname' => $literalName,
				'data' => json_encode( [
					'layers' => [
						[ 'id' => 'p1', 'type' => 'text', 'text' => 'Page 2 Note', 'x' => 20, 'y' => 20 ]
					]
				] ),
			],
			$db,
			$mockPdf
		);

		$api->execute();

		$this->assertCount( 1, $savedSets );
		$this->assertSame( 'Manual.pdf', $savedSets[0]['imgName'] );
		$this->assertSame( 2, $savedSets[0]['page'] );
		$this->assertSame( $literalName, $savedSets[0]['setName'] );
		$this->assertNotSame( 'page-2-active', $savedSets[0]['setName'] );
	}

	public function testOmittedSetNameResolvesToPriorLatestSet(): void {
		$savedSets = [];
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( [
			'id' => 40,
			'setName' => 'prior-latest',
			'revision' => 2,
		] );

		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback(
				static function ( $imgName, $imgMetadata, $data, $userId, $setName, $bgSettings ) use ( &$savedSets ) {
					$savedSets[] = [ 'setName' => $setName ];
					return 401;
				}
			);

		// setname omitted completely
		$api = $this->createApiSaveMock(
			[
				'filename' => 'Diagram.png',
				'data' => json_encode( [
					'layers' => [
						[ 'id' => 'd1', 'type' => 'text', 'text' => 'Diagram', 'x' => 10, 'y' => 10 ]
					]
				] ),
			],
			$db,
			new MockLayersFile( 1, 'image/png', 'sha1-diagram' )
		);

		$api->execute();

		$this->assertCount( 1, $savedSets );
		$this->assertSame( 'prior-latest', $savedSets[0]['setName'] );
	}

	/**
	 * @dataProvider provideInvalidExplicitNames
	 */
	public function testMalformedNameCannotRedirectSave( string $filename, string $name ): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->expects( $this->never() )->method( 'getLatestLayerSet' );
		$db->expects( $this->never() )->method( 'saveLayerSet' );
		$api = $this->createApiSaveMock( [
			'filename' => $filename,
			'setname' => $name,
			'data' => '{"layers":[]}',
		], $db );
		$this->expectException( \ApiUsageException::class );
		$this->expectExceptionMessage( 'layers-invalid-setname' );
		$api->execute();
	}

	public static function provideInvalidExplicitNames(): array {
		$cases = [];
		foreach ( [ 'Photo.png', 'Document.pdf', 'Slide:MyDeck' ] as $file ) {
			foreach ( [ '///', 'bad/name', '   ', 'a  b', str_repeat( 'a', 256 ) ] as $name ) {
				$cases[] = [ $file, $name ];
			}
		}
		return $cases;
	}

	public function testOmittedSetNameSeedsWithDefaultWhenNoPriorSetExists(): void {
		$savedSets = [];
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturn( false );
		$db->method( 'getLatestLayerSet' )->willReturn( null );

		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback(
				static function ( $imgName, $imgMetadata, $data, $userId, $setName, $bgSettings ) use ( &$savedSets ) {
					$savedSets[] = [ 'setName' => $setName ];
					return 501;
				}
			);

		$api = $this->createApiSaveMock(
			[
				'filename' => 'Fresh.png',
				// Explicitly empty string
				'setname' => '',
				'data' => json_encode( [
					'layers' => [
						[ 'id' => 'f1', 'type' => 'text', 'text' => 'Fresh', 'x' => 10, 'y' => 10 ]
					]
				] ),
			],
			$db,
			new MockLayersFile( 1, 'image/png', 'sha1-fresh' )
		);

		$api->execute();

		$this->assertCount( 1, $savedSets );
		$this->assertSame( 'default', $savedSets[0]['setName'] );
	}

	/**
	 * Verifies save and load agreement for ApiLayersInfo on literal names, including '0'.
	 *
	 * @dataProvider provideLiteralExplicitNames
	 */
	public function testApiLayersInfoQueriesLiteralSetByNameAcrossImageAndSlide( string $literalName ): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );

		$dbRow = [
			'id' => 99,
			'imgName' => 'Test.png',
			'userId' => 42,
			'timestamp' => '20260910120000',
			'revision' => 1,
			'setName' => $literalName,
			'data' => [ 'layers' => [] ],
		];

		// getLayerSetByName must be called with the literal name, NOT getLatestLayerSet
		$db->expects( $this->exactly( 2 ) )
			->method( 'getLayerSetByName' )
			->willReturnCallback(
				static function ( $img, $sha, $setName, $page = 1 ) use ( $literalName, $dbRow ) {
					\PHPUnit\Framework\Assert::assertSame(
						$literalName,
						$setName,
						"Info must query literal set name '$literalName'"
					);
					return $dbRow;
				}
			);

		$user = $this->createMockUser();
		$permissionManager = new class extends \MediaWiki\Permissions\PermissionManager {
			public function userCan( $action, $user, $title ): bool {
				return true;
			}
		};

		$resultMock = new class {
			public array $data = [];

			public function addValue( $path, $name, $value, $flags = null ): void {
				$this->data[$name] = $value;
			}
		};

		// 1. Test image route
		$apiImage = $this->getMockBuilder( ApiLayersInfo::class )
			->disableOriginalConstructor()
			->onlyMethods( [
				'extractRequestParams',
				'getUser',
				'getRepoGroup',
				'getLayersDatabase',
				'getPermissionManager',
				'createRateLimiter',
				'getLogger',
				'getResult',
				'checkUserRightsAny',
			] )
			->getMock();

		$apiImage->method( 'extractRequestParams' )->willReturn( [
			'filename' => 'Test.png',
			'setname' => $literalName,
		] );
		$apiImage->method( 'getUser' )->willReturn( $user );
		$apiImage->method( 'getRepoGroup' )->willReturn(
			new MockLayersRepoGroup( new MockLayersFile( 1, 'image/png', 'sha1-test' ) )
		);
		$apiImage->method( 'getLayersDatabase' )->willReturn( $db );
		$apiImage->method( 'getPermissionManager' )->willReturn( $permissionManager );
		$apiImage->method( 'createRateLimiter' )->willReturn( $this->createMockRateLimiter() );
		$apiImage->method( 'getResult' )->willReturn( $resultMock );
		$apiImage->method( 'getLogger' )->willReturn( new NullLogger() );

		$apiImage->execute();

		// 2. Test slide route
		$apiSlide = $this->getMockBuilder( ApiLayersInfo::class )
			->disableOriginalConstructor()
			->onlyMethods( [
				'extractRequestParams',
				'getUser',
				'getLayersDatabase',
				'createRateLimiter',
				'getLogger',
				'getResult',
				'checkUserRightsAny',
			] )
			->getMock();

		$apiSlide->method( 'extractRequestParams' )->willReturn( [
			'slidename' => 'Deck',
			'setname' => $literalName,
		] );
		$apiSlide->method( 'getUser' )->willReturn( $user );
		$apiSlide->method( 'getLayersDatabase' )->willReturn( $db );
		$apiSlide->method( 'createRateLimiter' )->willReturn( $this->createMockRateLimiter() );
		$apiSlide->method( 'getResult' )->willReturn( $resultMock );
		$apiSlide->method( 'getLogger' )->willReturn( new NullLogger() );

		$apiSlide->execute();
	}
}

/**
 * Mock File for unit testing.
 */
class MockLayersFile {
	private int $pageCount;
	private string $mime;
	private string $sha1;

	public function __construct( int $pageCount = 1, string $mime = 'image/png', string $sha1 = 'testsha1' ) {
		$this->pageCount = $pageCount;
		$this->mime = $mime;
		$this->sha1 = $sha1;
	}

	public function exists(): bool {
		return true;
	}

	public function getWidth( int $page = 1 ): int {
		return 800;
	}

	public function getHeight( int $page = 1 ): int {
		return 600;
	}

	public function getMimeType(): string {
		return $this->mime;
	}

	public function getSha1(): string {
		return $this->sha1;
	}

	public function getRepo() {
		return null;
	}

	public function isMultipage(): bool {
		return $this->pageCount > 1;
	}

	public function pageCount(): int {
		return $this->pageCount;
	}
}

/**
 * Mock RepoGroup for unit testing.
 */
class MockLayersRepoGroup {
	private $file;

	public function __construct( $file ) {
		$this->file = $file;
	}

	public function findFile( $title ) {
		return $this->file;
	}
}
