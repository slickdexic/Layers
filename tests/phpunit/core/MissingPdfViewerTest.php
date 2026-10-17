<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Rest\CreationPdfHandler;
use MediaWiki\Extension\Layers\Rest\PinnedPdfResponseHeaders;
use MediaWiki\Extension\Layers\Revision\PageMissingPdfViewerReadService;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Rest\Module\Module;
use MediaWiki\Rest\RequestData;
use MediaWiki\Rest\ResponseFactory;
use MediaWiki\Session\Session;
use MediaWiki\User\User;
use Wikimedia\FileBackend\FSFile\TempFSFile;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Revision\PageMissingPdfViewerReadService
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersPdfCreationView
 * @covers \MediaWiki\Extension\Layers\Rest\CreationPdfHandler
 * @group Database
 */
class MissingPdfViewerTest extends RealAssetTestCase {
	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		MigrationState::markComplete( $this->getDb() );
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repos->method( 'findFile' )->willReturnCallback( fn ( $title ) => $this->repo->findFile( $title ) );
		$this->setService( 'RepoGroup', $repos );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	private function reader(): PageMissingPdfViewerReadService {
		$services = $this->getServiceContainer();
		return new PageMissingPdfViewerReadService( $services,
			PageOwnedScope::newFromServices( $services, [], [ NS_MAIN ] ) );
	}

	private function fixture( bool $slot = true, int $pageNumber = 2 ): array {
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'File:MissingViewer-' . wfRandomString( 8 ) . '.pdf' );
		$page = $this->getExistingTestPage();
		$prefix = "Préface π\n";
		$embed = '[[' . $file->getTitle()->getPrefixedDBkey() . '|page=' . $pageNumber . '|layerset=ABC|Caption]]';
		$revision = $this->editPage( $page, $prefix . $embed )->getNewRevision()->getId();
		$actor = $this->actor();
		if ( $slot ) {
			$revision = $this->publisher->publish( $page->getTitle(), $actor, $revision,
				$this->buildDocument( [ $this->makeSlideSurface( 'unrelated', 'ABC' ) ] ), 'Independent slide' );
		}
		return [ 'page' => $page, 'revision' => $revision, 'start' => strlen( $prefix ),
			'expected' => $embed, 'actor' => $actor, 'file' => $file ];
	}

	private function read( array $fixture, ?Authority $authority = null ): array {
		return $this->reader()->read( $fixture['page']->getId(), $fixture['revision'], $fixture['start'],
			$fixture['expected'], $authority ?? $fixture['actor'] );
	}

	private function change( array $fixture, string $text ): void {
		$this->publisher->publish( $fixture['page']->getTitle(), $fixture['actor'], $fixture['revision'],
			$this->buildDocument( [ $this->makeSlideSurface( 'unrelated', 'ABC' ) ] ), 'Concurrent edit',
			new WikitextContent( $text ) );
	}

	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$tables[$table] = $rows;
		}
		return serialize( $tables );
	}

	public static function provideInitialPages(): array {
		return [ [ false, 1, 1 ], [ true, 1, 1 ], [ false, 2, 2 ], [ true, 2, 2 ], [ true, 99, 2 ] ];
	}

	/** @dataProvider provideInitialPages */
	public function testNativeEmptyViewerKeepsExactSelectionAndNeverWrites( bool $slot, int $requested,
		int $effective
	): void {
		$fixture = $this->fixture( $slot, $requested );
		$before = $this->witness();
		$viewer = $this->read( $fixture );
		$this->assertSame( $effective, $viewer['initialPage'] );
		$this->assertSame( 2, $viewer['pageCount'] );
		$this->assertSame( 'ABC', $viewer['label'] );
		$this->assertCount( 1, $viewer['pages'] );
		$this->assertSame( [], $viewer['pages'][0]['surface']['layers'] );
		$this->assertSame( $fixture['file']->getSha1(), $viewer['pages'][0]['surface']['source']['sha1'] );
		$this->assertSame( $fixture['file']->getTimestamp(), $viewer['pages'][0]['surface']['source']['timestamp'] );
		$this->assertTrue( $viewer['source']['exactVersion'] );
		$this->assertStringContainsString( '/layers/v0/pdf/creation?', $viewer['source']['url'] );
		$this->assertStringNotContainsString( 'mwstore:', json_encode( $viewer ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testReadOnlyAndAnonymousAuthoritiesCanViewWhenCorePermits(): void {
		$fixture = $this->fixture();
		$before = $this->witness();
		$reader = $this->actor( [ 'read' ] );
		$this->assertSame( $this->read( $fixture ), $this->read( $fixture, $reader ) );
		$this->overrideConfigValue( 'GroupPermissions', [ '*' => [ 'read' => true ] ] );
		$this->assertSame( $this->read( $fixture ), $this->read( $fixture, User::newFromId( 0 ) ) );
		$this->assertSame( $before, $this->witness() );
	}

	public function testForeignChangedMissingAndOffSelectorsRefuseWithoutWrites(): void {
		$fixture = $this->fixture();
		$other = $this->getExistingTestPage();
		$cases = [ array_replace( $fixture, [ 'page' => $other ] ),
			array_replace( $fixture, [ 'start' => $fixture['start'] + 1 ] ),
			array_replace( $fixture, [ 'expected' => str_replace( 'ABC', 'Other', $fixture['expected'] ) ] ) ];
		foreach ( $cases as $case ) {
			$before = $this->witness();
			try {
				$this->read( $case );
				$this->fail( 'Invalid selection returned a viewer' );
			} catch ( \DomainException $error ) {
				$this->assertSame( 'layers-revision-unavailable', $error->getMessage() );
			}
			$this->assertSame( $before, $this->witness() );
		}
		$this->change( $fixture, 'Changed current owner' );
		$before = $this->witness();
		try {
			$this->read( $fixture );
			$this->fail( 'Stale owner returned a viewer' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-revision-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->witness() );
	}

	public function testCaptureVerifiesBytesAndRefusesWrongDigestWithoutWrites(): void {
		$fixture = $this->fixture();
		$viewer = $this->read( $fixture );
		$before = $this->witness();
		$stream = $this->reader()->capture( $fixture['page']->getId(), $fixture['revision'], $fixture['start'],
			$fixture['expected'], $viewer['sourceKey'], $fixture['actor'] );
		$body = $stream->toResponseBody();
		try {
			$body->assertCanDeliver();
			$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
				$body->getContents() );
		} finally {
			$body->close();
		}
		try {
			$this->reader()->capture( $fixture['page']->getId(), $fixture['revision'], $fixture['start'],
				$fixture['expected'], str_repeat( '0', 64 ), $fixture['actor'] );
			$this->fail( 'Caller digest selected a source' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-revision-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->witness() );
	}

	public function testOwnerChangeDuringCaptureRefusesAndPurgesPrivateCopy(): void {
		$fixture = $this->fixture();
		$viewer = $this->read( $fixture );
		$path = null;
		$change = function ( string $copy ) use ( $fixture, &$path ) {
			$path = $copy;
			$this->change( $fixture, 'Changed during native capture' );
		};
		$services = $this->getServiceContainer();
		$reader = new class( $services, PageOwnedScope::newFromServices( $services, [], [ NS_MAIN ] ), $change )
			extends PageMissingPdfViewerReadService {
			public function __construct( $services, $scope, private \Closure $change ) {
				parent::__construct( $services, $scope );
			}

			protected function copyFile( File $file ): TempFSFile {
				$copy = parent::copyFile( $file );
				( $this->change )( $copy->getPath() );
				return $copy;
			}
		};
		try {
			$reader->capture( $fixture['page']->getId(), $fixture['revision'], $fixture['start'],
				$fixture['expected'], $viewer['sourceKey'], $fixture['actor'] );
			$this->fail( 'Changed owner returned captured bytes' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-revision-unavailable', $error->getMessage() );
		}
		$this->assertNotNull( $path );
		$this->assertFileDoesNotExist( $path );
	}

	public function testRegisteredApiReturnsOnlyPrivateReadData(): void {
		$fixture = $this->fixture();
		$before = $this->witness();
		$context = new RequestContext();
		$context->setAuthority( $fixture['actor'] );
		$context->setRequest( new FauxRequest( [ 'action' => 'layerspdfcreationview',
			'pageid' => $fixture['page']->getId(), 'baserevid' => $fixture['revision'],
			'embedstart' => $fixture['start'], 'embedtext' => $fixture['expected'],
			'maxage' => 3600, 'smaxage' => 3600 ], true ) );
		$api = new ApiMain( $context, true );
		$api->execute();
		$this->assertSame( 'private', $api->getCacheMode() );
		$viewer = $api->getResult()->getResultData()['layerspdfcreationview'];
		$this->assertSame( 'pdf', $viewer['kind'] );
		$this->assertSame( $before, $this->witness() );
	}

	public function testReuploadInvalidatesTheComparedCreationSourceWithoutSubstitution(): void {
		$fixture = $this->fixture();
		$original = $this->read( $fixture );
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			$fixture['file']->getTitle()->getPrefixedDBkey(), '20261017120000' );
		$before = $this->witness();
		$replacement = $this->read( $fixture );
		$this->assertNotSame( $original['sourceKey'], $replacement['sourceKey'] );
		try {
			$this->reader()->capture( $fixture['page']->getId(), $fixture['revision'], $fixture['start'],
				$fixture['expected'], $original['sourceKey'], $fixture['actor'] );
			$this->fail( 'Old creation descriptor substituted the new upload' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-revision-unavailable', $error->getMessage() );
		}
		$this->assertSame( $before, $this->witness() );
	}

	public static function provideRevokedPermissions(): array {
		return [ [ NS_MAIN ], [ NS_FILE ] ];
	}

	/** @dataProvider provideRevokedPermissions */
	public function testFreshDeliveryRefusesRevokedReadPermission( int $namespace ): void {
		$fixture = $this->fixture();
		$denied = false;
		$actor = $fixture['actor'];
		$authority = $this->createMock( Authority::class );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static function ( $permission, $title ) use ( &$denied, $namespace, $actor ) {
				return !( $denied && $title->getNamespace() === $namespace ) &&
					$actor->authorizeRead( $permission, $title );
			} );
		$viewer = $this->read( $fixture, $authority );
		$before = $this->witness();
		$stream = $this->reader()->capture( $fixture['page']->getId(), $fixture['revision'], $fixture['start'],
			$fixture['expected'], $viewer['sourceKey'], $authority );
		$body = $stream->toResponseBody();
		$denied = true;
		try {
			$body->assertCanDeliver();
			$this->fail( 'Revoked reader received a PDF' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-revision-unavailable', $error->getMessage() );
		} finally {
			$body->close();
		}
		$this->assertSame( $before, $this->witness() );
	}

	public function testRestDeliveryAndFailuresRetainPrivateFullBodyPolicy(): void {
		$fixture = $this->fixture();
		$viewer = $this->read( $fixture );
		parse_str( parse_url( $viewer['source']['url'], PHP_URL_QUERY ), $query );
		$services = $this->getServiceContainer();
		$limiter = $this->createMock( RateLimiter::class );
		$limiter->method( 'checkRateLimit' )->willReturn( true );
		$before = $this->witness();
		foreach ( [ 'GET', 'HEAD', 'wrong-key', 'conditional', 'extra' ] as $mode ) {
			$handler = new CreationPdfHandler( $this->reader(), $services->getUserFactory(), $limiter );
			$handler->initContext( $this->createMock( Module::class ), '/layers/v0/pdf/creation', [] );
			$handler->initServices( $fixture['actor'], new ResponseFactory( [ 'en' =>
				$services->getMessageFormatterFactory()->getTextFormatter( 'en' ) ] ), $services->getHookContainer() );
			$handler->initSession( $this->createMock( Session::class ) );
			$params = $query;
			if ( $mode === 'wrong-key' ) {
				$params['sourcekey'] = str_repeat( '0', 64 );
			}
			if ( $mode === 'extra' ) {
				$params['filename'] = 'Other.pdf';
			}
			$handler->initForExecute( new RequestData( [ 'method' => $mode === 'HEAD' ? 'HEAD' : 'GET',
				'queryParams' => $params, 'headers' => $mode === 'conditional' ? [ 'If-None-Match' => '*' ] :
					[ 'Range' => 'bytes=0-3' ] ] ) );
			$response = $handler->execute();
			$handler->applyCacheControl( $response );
			foreach ( PinnedPdfResponseHeaders::HEADERS as $header => $value ) {
				$this->assertSame( $value, $response->getHeaderLine( $header ) );
			}
			$this->assertSame( in_array( $mode, [ 'GET', 'HEAD' ], true ) ? 200 :
				( $mode === 'conditional' ? 400 : 404 ), $response->getStatusCode() );
			if ( $mode === 'GET' ) {
				$this->assertSame( 'none', $response->getHeaderLine( 'Accept-Ranges' ) );
				$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
					$response->getBody()->getContents() );
			}
			$response->getBody()->close();
		}
		$this->assertSame( $before, $this->witness() );
	}

	public function testLongSavedCaptionKeepsTheDeliveryUrlBounded(): void {
		$fixture = $this->fixture( false );
		$fixture['expected'] = str_replace( '|Caption]]', '|' . str_repeat( 'Long caption ', 6000 ) . ']]',
			$fixture['expected'] );
		$fixture['revision'] = $this->editPage( $fixture['page'], "Préface π\n" . $fixture['expected'] )
			->getNewRevision()->getId();
		$before = $this->witness();
		$viewer = $this->read( $fixture );
		$this->assertLessThan( 512, strlen( $viewer['source']['url'] ) );
		parse_str( parse_url( $viewer['source']['url'], PHP_URL_QUERY ), $query );
		$this->assertArrayNotHasKey( 'expected', $query );
		$this->assertSame( $before, $this->witness() );
	}

}
