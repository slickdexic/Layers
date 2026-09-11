<?php
// phpcs:disable MediaWiki.Files.OneClassPerFile,Generic.Files.OneObjectStructurePerFile,MediaWiki.Commenting.PropertyDocumentation.MissingDocumentationPrivate -- Test harness classes

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersSave;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use Psr\Log\NullLogger;

/**
 * Verifies that slide creation and new named slide sets enforce the 'create' rate limit
 * bucket while existing-set updates follow the save-only policy (R6.14, task J03).
 *
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersSave
 * @covers \MediaWiki\Extension\Layers\Security\RateLimiter
 */
class ApiLayersSaveSlideRateLimitTest extends \MediaWikiUnitTestCase {

	private function createMockUser(): \MediaWiki\User\User {
		$user = $this->createMock( \MediaWiki\User\User::class );
		$user->method( 'getId' )->willReturn( 42 );
		$user->method( 'getName' )->willReturn( 'Tester' );
		return $user;
	}

	private function createMockRateLimiter( bool $allowSave, bool $allowCreate ): RateLimiter {
		$rateLimiter = $this->createMock( RateLimiter::class );
		$rateLimiter->method( 'isLayerCountAllowed' )->willReturn( true );
		$rateLimiter->method( 'isComplexityAllowed' )->willReturn( true );
		$rateLimiter->method( 'isImageSizeAllowed' )->willReturn( true );
		$rateLimiter->method( 'checkRateLimit' )
			->willReturnCallback( static function ( $user, string $action ) use ( $allowSave, $allowCreate ): bool {
				if ( $action === 'save' ) {
					return $allowSave;
				}
				if ( $action === 'create' ) {
					return $allowCreate;
				}
				return true;
			} );
		return $rateLimiter;
	}

	private function createApiSaveMock(
		array $requestParams,
		LayersDatabase $db,
		RateLimiter $rateLimiter
	): ApiLayersSave {
		$user = $this->createMockUser();

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
				'LayersDefaultSetName' => 'default',
			] )
		);
		$api->method( 'createRateLimiter' )->willReturn( $rateLimiter );
		$api->method( 'getLogger' )->willReturn( new NullLogger() );
		$api->method( 'getResult' )->willReturn( new SlideRateLimitMockApiResult() );

		return $api;
	}

	public function testNewSlideCreationDeniedWhenCreateRateLimitExceeded(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( null );
		// New slide does not exist
		$db->method( 'namedSetExists' )->willReturn( false );
		// Ensure saveLayerSet is NEVER called
		$db->expects( $this->never() )->method( 'saveLayerSet' );

		// Allows general save, but denies create bucket
		$rateLimiter = $this->createMockRateLimiter( true, false );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'NewDeck',
				'setname' => 'deck_v1',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Slide 1' ] ] ),
			],
			$db,
			$rateLimiter
		);

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'layers-rate-limited' );
		$api->execute();
	}

	public function testNewSlideCreationAllowedWhenCreateRateLimitPermitted(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( null );
		$db->method( 'namedSetExists' )->willReturn( false );
		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturn( 101 );

		$rateLimiter = $this->createMockRateLimiter( true, true );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'NewDeck',
				'setname' => 'deck_v1',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Slide 1' ] ] ),
			],
			$db,
			$rateLimiter
		);

		$api->execute();
		// Test reaches here cleanly: save succeeded
		$this->assertTrue( true );
	}

	public function testNewNamedSetOnExistingSlideDeniedWhenCreateRateLimitExceeded(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		// Slide has existing latest set 'deck_v1'
		$db->method( 'getLatestLayerSet' )->willReturn( [
			'id' => 88,
			'name' => 'deck_v1',
			'setName' => 'deck_v1',
			'revision' => 1,
		] );
		// But the caller is asking to save into brand-new set 'deck_v2'
		$db->method( 'namedSetExists' )
			->willReturnCallback( static function ( $img, $sha1, $set ): bool {
				return $set === 'deck_v1';
			} );
		$db->expects( $this->never() )->method( 'saveLayerSet' );

		// Save allowed, but create bucket exhausted
		$rateLimiter = $this->createMockRateLimiter( true, false );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'ExistingDeck',
				'setname' => 'deck_v2',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Slide 1 v2' ] ] ),
			],
			$db,
			$rateLimiter
		);

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'layers-rate-limited' );
		$api->execute();
	}

	public function testExistingSlideSetUpdateAllowedEvenWhenCreateRateLimitExceeded(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( [
			'id' => 88,
			'name' => 'deck_v1',
			'setName' => 'deck_v1',
			'revision' => 1,
		] );
		// Set 'deck_v1' already exists
		$db->method( 'namedSetExists' )->willReturn( true );
		// Must be saved
		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturn( 102 );

		// Save allowed, but create bucket exhausted!
		$rateLimiter = $this->createMockRateLimiter( true, false );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'ExistingDeck',
				'setname' => 'deck_v1',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Slide 1 revision 2' ] ] ),
			],
			$db,
			$rateLimiter
		);

		$api->execute();
		// Existing set update follows save-only policy and succeeds despite create limit denial
		$this->assertTrue( true );
	}

	public function testExistingSlideSetUpdateDeniedWhenSaveRateLimitExceeded(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->expects( $this->never() )->method( 'saveLayerSet' );

		// Save bucket exhausted
		$rateLimiter = $this->createMockRateLimiter( false, true );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'ExistingDeck',
				'setname' => 'deck_v1',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Slide update' ] ] ),
			],
			$db,
			$rateLimiter
		);

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'layers-rate-limited' );
		$api->execute();
	}

	public function testUnnamedNewSlideCreationDeniedWhenCreateRateLimitExceeded(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'getLatestLayerSet' )->willReturn( null );
		// Unnamed new slide will resolve to seed 'default', which does not exist yet
		$db->method( 'namedSetExists' )->willReturn( false );
		$db->expects( $this->never() )->method( 'saveLayerSet' );

		// Save allowed, create denied
		$rateLimiter = $this->createMockRateLimiter( true, false );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'BrandNewDeck',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Unnamed Slide' ] ] ),
			],
			$db,
			$rateLimiter
		);

		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'layers-rate-limited' );
		$api->execute();
	}

	public function testUnnamedExistingSlideUpdateAllowedWhenCreateRateLimitExceeded(): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		// Existing latest set is 'default'
		$db->method( 'getLatestLayerSet' )->willReturn( [
			'id' => 99,
			'name' => 'default',
			'setName' => 'default',
			'revision' => 1,
		] );
		$db->method( 'namedSetExists' )->willReturn( true );
		$db->expects( $this->once() )
			->method( 'saveLayerSet' )
			->willReturn( 103 );

		// Save allowed, create denied
		$rateLimiter = $this->createMockRateLimiter( true, false );

		$api = $this->createApiSaveMock(
			[
				'slidename' => 'ExistingDeck',
				'data' => json_encode( [ [ 'type' => 'text', 'id' => '1', 'text' => 'Updated Unnamed' ] ] ),
			],
			$db,
			$rateLimiter
		);

		$api->execute();
		$this->assertTrue( true );
	}
}

class SlideRateLimitMockApiResult {
	public array $data = [];

	public function addValue( $path, $name, $value ): void {
		if ( $path === null ) {
			$this->data[$name] = $value;
		} else {
			$this->data[$path][$name] = $value;
		}
	}
}
