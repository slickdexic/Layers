<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiUsageException;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use Wikimedia\TestingAccessWrapper;

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersRead
 * @group Database
 * @group API
 */
class ApiLayersReadTest extends \MediaWiki\Tests\Api\ApiTestCase {
	private bool $enabled = true;
	private array $ownerKeys = [];
	private ?PageReadService $reader = null;
	private ?\MediaWiki\Api\ApiMain $apiMain = null;
	/** @var callable|null */
	private $boundReader = null;
	private int $bindingMaxAge = 0;

	protected function setUp(): void {
		parent::setUp();
		$s = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', array_replace( $s->getMainConfig()->get( 'APIModules' ), [
			'layersread' => [ 'class' => ApiLayersRead::class, 'factory' => function ( $main, $name ) {
				$this->apiMain = $main;
				// Prove the module overrides an earlier public-cache choice.
				$main->setCacheMode( 'public' );
				$s = $this->getServiceContainer();
				$reader = $this->reader ?? new PageReadService( new PageHistoryAccess( $s->getRevisionLookup() ),
					new SourceVersionResolver( $s->getRepoGroup()->getLocalRepo(), $s->getTitleFactory() ) );
				return new ApiLayersRead( $main, $name, $reader, $s->getTitleFactory(),
					$this->enabled, PageOwnedScope::newFromServices( $s, $this->ownerKeys ), $this->boundReader,
					$this->bindingMaxAge );
			} ]
		] ) );
	}

	private function publish(): array {
		$registered = TestingAdmissionRegistration::install( $this );
		$page = $this->getNonexistingTestPage();
		$title = $page->getTitle();
		$this->ownerKeys[] = $title->getPrefixedDBkey();
		$user = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $user, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$json = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
		$id = $registered['publisher']->publish( $title, $user, 0, $json, 'First snapshot',
			new WikitextContent( 'Page-owned test' ) );
		return [ $title, $id, $user ];
	}

	public function testExactHistoricalReadAndNoWriteRightRequired(): void {
		[ $title, $id, $user ] = $this->publish();
		$registered = TestingAdmissionRegistration::install( $this );
		$newId = $registered['publisher']->publish( $title, $user, $id,
			'{"schemaVersion":1,"surfaces":[]}', 'Main edit', new WikitextContent( 'Later text' ) );
		$this->assertGreaterThan( $id, $newId );
		$this->overrideUserPermissions( $user, [ 'read' ] );
		$result = $this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(),
			'revid' => $id, 'maxage' => 3600, 'smaxage' => 3600 ], null, false, $user )[0]['layersread'];
		$this->assertSame( $id, $result['revisionId'] );
		$this->assertSame( 1, $result['snapshot']['schemaVersion'] );
		$this->assertCount( 1, $result['snapshot']['surfaces'] );
		$this->assertSame( 'Visual ideas — 世界', $result['snapshot']['surfaces'][0]['layers'][0]['text'] );
		$this->assertSame( [], $result['sourceGeometry'] );
		$this->assertSame( [ 'revisionId', 'snapshot', 'sourceGeometry' ], array_keys( $result ) );
		$this->assertSame( 'private', $this->apiMain->getCacheMode() );
	}

	public function testBindingReadReturnsOnlyAuthorizedSelectedDrawings(): void {
		[ $title, $id, $user ] = $this->publish();
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), true, $this->ownerKeys );
		$this->boundReader = [ $pilot, 'prepareBoundViewers' ];
		$surfaceId = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) )
			->surfaces[0]->id;
		$binding = 'v1:' . $title->getArticleID() . ':' . $surfaceId;
		$this->overrideUserPermissions( $user, [ 'read' ] );
		$result = $this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(),
			'revid' => $id, 'binding' => $binding . '|v1:2147483647:' . $surfaceId . '|not-a-binding',
			'smaxage' => 3600 ], null, false, $user )[0]['layersread'];
		$this->assertSame( [ $binding ], array_keys( $result['bindings'] ) );
		$this->assertSame( $id, $result['bindings'][$binding]['revisionId'] );
		$this->assertSame( $surfaceId, $result['bindings'][$binding]['surface']['id'] );
		$this->assertSame( $title->getPrefixedDBkey(), $result['bindings'][$binding]['owner'] );
		$this->assertSame( 'private', $this->apiMain->getCacheMode() );
		// Nothing available is an empty result, not an error distinguishing the reason.
		$this->assertSame( [], $this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(),
			'revid' => $id, 'binding' => 'v1:2147483647:' . $surfaceId ], null, false, $user )
			[0]['layersread']['bindings'] );
		$this->boundReader = null;
		$this->expectApiErrorCode( 'layers-revision-unavailable' );
		$this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(),
			'revid' => $id, 'binding' => $binding ], null, false, $user );
	}

	public function testAnonymousReadOfCurrentDrawingsIsBrieflyCacheable(): void {
		[ $title, $id, $user ] = $this->publish();
		$pilot = new PageOwnedPilot( $this->getServiceContainer(), true, $this->ownerKeys );
		$this->boundReader = [ $pilot, 'prepareBoundViewers' ];
		$this->bindingMaxAge = 300;
		$binding = 'v1:' . $title->getArticleID() . ':' . json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ) )->surfaces[0]->id;
		$anon = $this->getServiceContainer()->getUserFactory()->newAnonymous();
		$read = function ( int $revision, array $extra = [] ) use ( $title, $binding, $anon ): array {
			$result = $this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(),
				'revid' => $revision, 'binding' => $binding ] + $extra, null, false, $anon )[0]['layersread'];
			$control = TestingAccessWrapper::newFromObject( $this->apiMain )->mCacheControl;
			return [ array_keys( $result['bindings'] ), $this->apiMain->getCacheMode(), $control ];
		};
		// A client-chosen age does not apply; the module's does.
		$this->assertSame( [ [ $binding ], 'anon-public-user-private', [ 'max-age' => 300, 's-maxage' => 300 ] ],
			$read( $id, [ 'maxage' => 3600, 'smaxage' => 3600 ] ) );

		// Once the revision is no longer current it can be hidden, so reads of it stay private.
		$newId = TestingAdmissionRegistration::install( $this )['publisher']->publish( $title, $user, $id,
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), 'Later snapshot',
			new WikitextContent( 'Later text' ) );
		$this->assertSame( [ [ $binding ], 'private', [ 'max-age' => 0, 's-maxage' => 0 ] ], $read( $id ) );
		$this->assertSame( 'anon-public-user-private', $read( $newId )[1] );
		$this->bindingMaxAge = 0;
		$this->assertSame( 'private', $read( $newId )[1] );
	}

	public function testHiddenHistoricalContentIsUnavailable(): void {
		[ $title, $id, $user ] = $this->publish();
		$registered = TestingAdmissionRegistration::install( $this );
		$newId = $registered['publisher']->publish( $title, $user, $id,
			'{"schemaVersion":1,"surfaces":[]}', 'Later snapshot' );
		$this->assertGreaterThan( $id, $newId );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => \MediaWiki\Revision\RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $id ] )->caller( __METHOD__ )->execute();
		$this->expectApiErrorCode( 'layers-revision-unavailable' );
		$this->doApiRequest( [ 'action' => 'layersread', 'owner' => $title->getPrefixedText(),
			'revid' => $id ], null, false, $user );
	}

	public function testUnavailableSourceDoesNotExposeDiagnostics(): void {
		$this->ownerKeys = [ 'Pilot' ];
		$this->reader = $this->createMock( PageReadService::class );
		$this->reader->expects( $this->once() )->method( 'read' )
			->willThrowException( new \DomainException( 'private source path' ) );
		try {
			$this->doApiRequest( [ 'action' => 'layersread', 'owner' => 'Pilot', 'revid' => 1 ] );
			$this->fail( 'Unavailable source accepted' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-revision-unavailable' ) );
			$this->assertStringNotContainsString( 'private source path', $e->getMessage() );
			$this->assertSame( 'private', $this->apiMain->getCacheMode() );
		}
	}

	/** @dataProvider provideEarlyFailures */
	public function testEarlyFailureNeverReads( string $case, string $code ): void {
		$this->reader = $this->createMock( PageReadService::class );
		$this->reader->expects( $this->never() )->method( 'read' );
		$params = [ 'action' => 'layersread', 'owner' => 'Pilot', 'revid' => 1 ];
		$this->ownerKeys = [ 'Pilot' ];
		switch ( $case ) {
			case 'disabled':
				$this->enabled = false;
				break;
			case 'empty-scope':
				$this->ownerKeys = [];
				break;
			case 'outside-scope':
				$params['owner'] = 'Another';
				break;
			case 'fragment':
				$params['owner'] = 'Pilot#Section';
				break;
			case 'special':
				$params['owner'] = 'Special:Version';
				break;
			case 'missing-owner':
				unset( $params['owner'] );
				break;
			case 'missing-revision':
				unset( $params['revid'] );
				break;
			case 'zero':
				$params['revid'] = 0;
				break;
			case 'negative':
				$params['revid'] = -1;
				break;
			case 'overflow':
				$params['revid'] = 2147483648;
				break;
		}
		$this->expectApiErrorCode( $code );
		$this->doApiRequest( $params );
	}

	public static function provideEarlyFailures(): array {
		return [
			[ 'disabled', 'layers-reading-disabled' ], [ 'empty-scope', 'layers-revision-unavailable' ],
			[ 'outside-scope', 'layers-revision-unavailable' ], [ 'fragment', 'layers-revision-unavailable' ],
			[ 'special', 'layers-revision-unavailable' ], [ 'missing-owner', 'missingparam' ],
			[ 'missing-revision', 'missingparam' ], [ 'zero', 'outofrange' ],
			[ 'negative', 'outofrange' ], [ 'overflow', 'outofrange' ]
		];
	}

	public function testWrongOwnerDoesNotFallBack(): void {
		[ $title, $id ] = $this->publish();
		$other = $this->getExistingTestPage()->getTitle();
		$this->ownerKeys[] = $other->getPrefixedDBkey();
		$this->expectApiErrorCode( 'layers-revision-unavailable' );
		$this->doApiRequest( [ 'action' => 'layersread', 'owner' => $other->getPrefixedText(), 'revid' => $id ] );
	}

	public function testOperationalErrorsAreRedacted(): void {
		$this->ownerKeys = [ 'Pilot' ];
		$this->reader = $this->createMock( PageReadService::class );
		$this->reader->method( 'read' )->willThrowException( new \RuntimeException( 'secret diagnostic' ) );
		try {
			$this->doApiRequest( [ 'action' => 'layersread', 'owner' => 'Pilot', 'revid' => 1 ] );
			$this->fail( 'Operational exception accepted' );
		} catch ( ApiUsageException $e ) {
			$this->assertTrue( self::apiExceptionHasCode( $e, 'layers-reading-failed' ) );
			$this->assertStringNotContainsString( 'secret diagnostic', $e->getMessage() );
		}
	}

	public function testReadApiDefaultsToDisabled(): void {
		$manifest = json_decode( file_get_contents( __DIR__ . '/../../../extension.json' ), true );
		$this->assertFalse( $manifest['config']['LayersPageOwnedPilotEnabled']['value'] );
		$this->assertSame( [], $manifest['config']['LayersPageOwnedPilotOwners']['value'] );
	}
}
