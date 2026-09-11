<?php
// phpcs:disable MediaWiki.Files.OneClassPerFile,Generic.Files.OneObjectStructurePerFile,MediaWiki.Commenting.PropertyDocumentation.MissingDocumentationPrivate -- Test harness classes

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersSave;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use Psr\Log\NullLogger;

/**
 * Verifies that first unnamed saves respect the configured seed name
 * (LayersDefaultSetName, R6.17, task J02).
 *
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 * @covers \MediaWiki\Extension\Layers\Validation\SetNameSanitizer
 * @covers \MediaWiki\Extension\Layers\Database\LayersDatabase
 */
class ApiLayersSaveConfiguredSeedNameTest extends \MediaWikiUnitTestCase {

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
		string $configuredSeedName = 'default',
		$mockFile = null
	): ApiLayersSave {
		$user = $this->createMockUser();
		$rateLimiter = $this->createMockRateLimiter();
		$repoGroup = new SeedMockLayersRepoGroup( $mockFile ?? new SeedMockLayersFile() );

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
				'getResult',
			] )
			->getMock();

		$api->method( 'getUser' )->willReturn( $user );
		$api->method( 'extractRequestParams' )->willReturn( $requestParams );
		$api->method( 'getLayersDatabase' )->willReturn( $db );
		$api->method( 'getConfig' )->willReturn(
			new \HashConfig( [
				'LayersMaxBytes' => 2097152,
				'LayersDefaultSetName' => $configuredSeedName,
			] )
		);
		$api->method( 'createRateLimiter' )->willReturn( $rateLimiter );
		$api->method( 'getRepoGroup' )->willReturn( $repoGroup );
		$api->method( 'getLogger' )->willReturn( new NullLogger() );
		$api->method( 'getResult' )->willReturn( new SeedMockApiResult() );

		return $api;
	}

	public function testInitialUnnamedImageSaveWithConfiguredSeedCreatesConfiguredName(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		// No pre-existing latest set
		$db->method( 'getLatestLayerSet' )->willReturn( null );
		$db->method( 'namedSetExists' )->willReturn( false );

		$savedSetName = null;
		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback( static function (
				$imgName, $meta, $layers, $userId, $setName, $backgroundSettings
			) use ( &$savedSetName ) {
				$savedSetName = $setName;
				return 101;
			} );

		$api = $this->createApiSaveMock(
			[
				'filename' => 'Diagram.png',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Hello' ] ] ),
				// setname omitted
			],
			$db,
			'annotations'
		);

		$api->execute();

		$this->assertSame(
			'annotations',
			$savedSetName,
			'Initial unnamed image save must be seeded from LayersDefaultSetName ("annotations")'
		);
	}

	public function testSubsequentUnnamedImageSavePreservesExistingSet(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		// Pre-existing set called "custom_active"
		$db->method( 'getLatestLayerSet' )->willReturn( [
			'id' => 50,
			'name' => 'custom_active',
			'setName' => 'custom_active',
			'revision' => 2,
		] );
		$db->method( 'namedSetExists' )->willReturn( true );

		$savedSetName = null;
		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback( static function (
				$imgName, $meta, $layers, $userId, $setName, $backgroundSettings
			) use ( &$savedSetName ) {
				$savedSetName = $setName;
				return 102;
			} );

		$api = $this->createApiSaveMock(
			[
				'filename' => 'Diagram.png',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Updated' ] ] ),
				// setname omitted
			],
			$db,
			'annotations'
		);

		$api->execute();

		$this->assertSame(
			'custom_active',
			$savedSetName,
			'Subsequent unnamed save must target the existing latest set, not sprout a new seed set'
		);
	}

	public function testExplicitImageSavePreservesExplicitTargetUnderConfiguredSeed(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( null );
		$db->method( 'namedSetExists' )->willReturn( false );

		$savedSetName = null;
		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback( static function (
				$imgName, $meta, $layers, $userId, $setName, $backgroundSettings
			) use ( &$savedSetName ) {
				$savedSetName = $setName;
				return 103;
			} );

		$api = $this->createApiSaveMock(
			[
				'filename' => 'Diagram.png',
				'setname' => 'explicit_target',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Explicit' ] ] ),
			],
			$db,
			'annotations'
		);

		$api->execute();

		$this->assertSame(
			'explicit_target',
			$savedSetName,
			'Explicit set name must be honored literally even when seed name is configured'
		);
	}

	public function testInitialUnnamedSlideSaveWithConfiguredSeedCreatesConfiguredName(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( null );
		$db->method( 'namedSetExists' )->willReturn( false );

		$savedSetName = null;
		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback( static function (
				$imgName, $meta, $layers, $userId, $setName, $backgroundSettings
			) use ( &$savedSetName ) {
				$savedSetName = $setName;
				return 201;
			} );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'PresentationDeck',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Slide Text' ] ] ),
				// setname omitted
			],
			$db,
			'annotations'
		);

		$api->execute();

		$this->assertSame(
			'annotations',
			$savedSetName,
			'Initial unnamed slide save must be seeded from LayersDefaultSetName ("annotations")'
		);
	}

	public function testSubsequentUnnamedSlideSavePreservesExistingSet(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( [
			'id' => 88,
			'name' => 'deck_v1',
			'setName' => 'deck_v1',
			'revision' => 1,
		] );
		$db->method( 'namedSetExists' )->willReturn( true );

		$savedSetName = null;
		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback( static function (
				$imgName, $meta, $layers, $userId, $setName, $backgroundSettings
			) use ( &$savedSetName ) {
				$savedSetName = $setName;
				return 202;
			} );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'PresentationDeck',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Updated Slide' ] ] ),
				// setname omitted
			],
			$db,
			'annotations'
		);

		$api->execute();

		$this->assertSame(
			'deck_v1',
			$savedSetName,
			'Subsequent unnamed slide save must target existing set'
		);
	}

	public function testDefaultConfigurationUsesDefaultLiteral(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( null );
		$db->method( 'namedSetExists' )->willReturn( false );

		$savedNames = [];
		$db->method( 'saveLayerSet' )
			->willReturnCallback( static function (
				$imgName, $meta, $layers, $userId, $setName, $backgroundSettings
			) use ( &$savedNames ) {
				$savedNames[] = $setName;
				return 301;
			} );

		// 1. Image
		$apiImg = $this->createApiSaveMock(
			[
				'filename' => 'DefaultImage.png',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Hi' ] ] ),
			],
			$db,
			'default'
		);
		$apiImg->execute();

		// 2. Slide
		$apiSlide = $this->createApiSaveMock(
			[
				'slidename' => 'DefaultSlide',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Hi' ] ] ),
			],
			$db,
			'default'
		);
		$apiSlide->execute();

		$this->assertSame( [ 'default', 'default' ], $savedNames );
	}

	public function testMultiPagePdfSaveWithConfiguredSeedName(): void {
		$pdfFile = new SeedMockLayersFile( 5, 'application/pdf', 'pdf-sha1' );
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( null );
		$db->method( 'namedSetExists' )->willReturn( false );

		$savedSetName = null;
		$savedPage = null;
		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturnCallback( static function (
				$imgName, $meta, $layers, $userId, $setName, $backgroundSettings
			) use ( &$savedSetName, &$savedPage ) {
				$savedSetName = $setName;
				$savedPage = $meta['page'] ?? null;
				return 401;
			} );

		$api = $this->createApiSaveMock(
			[
				'filename' => 'Manual.pdf',
				'page' => 3,
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Page 3 Annotation' ] ] ),
			],
			$db,
			'annotations',
			$pdfFile
		);

		$api->execute();

		$this->assertSame( 'annotations', $savedSetName );
		$this->assertSame( 3, $savedPage );
	}

	public function testInvalidConfiguredSeedNameThrowsConfigException(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( null );

		$api = $this->createApiSaveMock(
			[
				'filename' => 'Diagram.png',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Hello' ] ] ),
			],
			$db,
			'invalid/slash_in_name'
		);

		$this->expectException( \ConfigException::class );
		$api->execute();
	}

	public function testInvalidConfiguredSeedNameOnSlideThrowsConfigException(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( null );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'PresentationDeck',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Hello' ] ] ),
			],
			$db,
			'invalid/slash_in_name'
		);

		$this->expectException( \ConfigException::class );
		$api->execute();
	}
}

class SeedMockLayersFile {
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

class SeedMockLayersRepoGroup {
	private $file;

	public function __construct( $file ) {
		$this->file = $file;
	}

	public function findFile( $title ) {
		return $this->file;
	}
}

class SeedMockApiResult {
	public array $data = [];

	public function addValue( $path, $name, $value ): void {
		if ( $path === null ) {
			$this->data[$name] = $value;
		} else {
			$this->data[$path][$name] = $value;
		}
	}
}
