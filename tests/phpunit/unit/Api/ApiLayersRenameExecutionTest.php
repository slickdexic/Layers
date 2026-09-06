<?php

namespace MediaWiki\Extension\Layers\Tests\Unit\Api;

use MediaWiki\Extension\Layers\Api\ApiLayersRename;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Title\Title;
use MediaWiki\User\UserIdentity;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/** @covers \MediaWiki\Extension\Layers\Api\ApiLayersRename */
class ApiLayersRenameExecutionTest extends TestCase {

	/**
	 * @dataProvider provideScopes
	 * @param bool $allPages
	 * @param bool $denied
	 */
	public function testFileRenameExecutesAuthorizedMutation( bool $allPages, bool $denied ): void {
		$db = $this->createMock( LayersDatabase::class );
		$db->method( 'isSchemaReady' )->willReturn( true );
		$db->method( 'namedSetExists' )->willReturn( false );
		$db->method( 'getNamedSetOwner' )->willReturn( 10 );
		$mutation = $db->expects( $this->once() )->method( 'renameNamedSet' )->with(
			'Test.pdf', 'abc123', 'notes', 'renamed', $allPages ? null : 2, 10
		);
		if ( $denied ) {
			$mutation->willThrowException( new \DomainException( 'ownership denied' ) );
		} else {
			$mutation->willReturn( true );
		}

		$user = $this->getMockBuilder( UserIdentity::class )->addMethods( [ 'isAllowed' ] )->getMockForAbstractClass();
		$user->method( 'getId' )->willReturn( 10 );
		$user->method( 'getName' )->willReturn( 'Alice' );
		$user->method( 'isAllowed' )->willReturn( false );
		$limiter = new class extends RateLimiter {
			public function checkRateLimit( $user, string $action ): bool {
				return true;
			}
		};
		$result = new class {
			public array $values = [];

			public function addValue( $path, $name, $value ): void {
				$this->values[$name] = $value;
			}
		};
		$api = $this->getMockBuilder( ApiLayersRename::class )->disableOriginalConstructor()->onlyMethods( [
			'getUser', 'extractRequestParams', 'checkUserRightsAny', 'getLayersDatabase', 'createRateLimiter',
			'validateAndGetFile', 'requireTitleEditPermission', 'getFileSha1', 'resolvePageParam',
			'getLayerSetWithFallback', 'getLogger', 'invalidateCachesForFile', 'createAuditTrailEntry', 'getResult'
		] )->getMock();
		$api->method( 'getUser' )->willReturn( $user );
		$api->method( 'extractRequestParams' )->willReturn( [
			'filename' => 'Test.pdf', 'oldname' => 'notes', 'newname' => 'renamed', 'page' => 2, 'allpages' => $allPages
		] );
		$api->expects( $this->once() )->method( 'checkUserRightsAny' )->with( 'editlayers' );
		$api->method( 'getLayersDatabase' )->willReturn( $db );
		$api->method( 'createRateLimiter' )->willReturn( $limiter );
		$title = Title::newFromText( 'Test.pdf', NS_FILE );
		$api->method( 'validateAndGetFile' )->willReturn( [
			'title' => $title, 'file' => new \stdClass(), 'imgName' => 'Test.pdf'
		] );
		$api->expects( $this->once() )->method( 'requireTitleEditPermission' )->with( $title );
		$api->method( 'getFileSha1' )->willReturn( 'abc123' );
		$api->method( 'resolvePageParam' )->willReturn( 2 );
		$api->method( 'getLayerSetWithFallback' )->willReturn( [ 'id' => 1 ] );
		$api->method( 'getLogger' )->willReturn( new NullLogger() );
		$api->method( 'getResult' )->willReturn( $result );
		if ( $denied ) {
			$this->expectException( \RuntimeException::class );
			$this->expectExceptionMessage( 'layers-rename-permission-denied' );
		}
		$api->execute();
		$this->assertSame( 1, $result->values['success'] );
		$this->assertSame( 'renamed', $result->values['newname'] );
	}

	/** @return array */
	public static function provideScopes(): array {
		return [ 'one page' => [ false, false ], 'all pages' => [ true, false ], 'denied' => [ true, true ] ];
	}
}
