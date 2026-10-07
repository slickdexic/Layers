<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersRead;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersRead
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @group Database
 * @group API
 */
class ApiLayersPdfEditorReadTest extends RealAssetTestCase {
	private PageOwnedPilot $pilot;
	private ?ApiMain $apiMain = null;
	private bool $withoutCallback = false;

	protected function setUp(): void {
		parent::setUp();
		$repos = $this->createMock( RepoGroup::class );
		$repos->method( 'getLocalRepo' )->willReturn( $this->repo );
		$this->setService( 'RepoGroup', $repos );
		$this->overrideConfigValue( 'LayersBindingReadMaxAge', 300 );
		$services = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', array_replace( $services->getMainConfig()->get( 'APIModules' ), [
			'layersread' => [ 'class' => ApiLayersRead::class, 'factory' => function ( $main, $name ) {
				$main->setCacheMode( 'public' );
				if ( !$this->withoutCallback ) {
					return $this->pilot->newReadApi( $main, $name );
				}
				$services = $this->getServiceContainer();
				$reader = TestingAccessWrapper::newFromObject( $this->pilot )->reader;
				return new ApiLayersRead( $main, $name, $reader, $services->getTitleFactory(),
					$this->pilot->getScope() );
			} ]
		] ) );
	}

	private function fixture( ?array $extra = null ): array {
		$name = 'File:Transport-' . wfRandomString( 8 ) . '.pdf';
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage.pdf', $name );
		$surface = $this->makePdfSurface( 'anchor', 'ABC', $name, $file->getTimestamp(), $file->getSha1(), 2 );
		$surface['canvas']['backgroundVisible'] = false;
		$surface['canvas']['backgroundOpacity'] = 0;
		$surface['layers'] = [ [ 'id' => 'text', 'type' => 'text', 'text' => 'Page two', 'x' => 17, 'y' => 29 ] ];
		$surface['readingOrder'] = [ 'text' ];
		$owner = $this->getExistingTestPage()->getTitle();
		$actor = $this->actor();
		$revision = $this->publisher->publish( $owner, $actor, $owner->getLatestRevID(),
			$this->buildDocument( array_merge( [ $surface ], $extra ?? [] ) ), 'Native PDF transport fixture' );
		$this->pilot = new PageOwnedPilot( $this->getServiceContainer() );
		return [ $owner, $revision, $actor, 'v1:' . $owner->getArticleID() . ':anchor', $file, $surface ];
	}

	private function request( array $fixture, array $extra = [], ?Authority $actor = null ): array {
		[ $owner, $revision, $fixtureActor, $binding ] = $fixture;
		$params = array_replace( [ 'action' => 'layersread', 'formatversion' => 2,
			'owner' => $owner->getPrefixedDBkey(), 'revid' => $revision, 'binding' => $binding,
			'editorpage' => 2, 'maxage' => 3600, 'smaxage' => 3600 ], $extra );
		$context = new RequestContext();
		$context->setRequest( new FauxRequest( $params ) );
		$context->setAuthority( $actor ?? $fixtureActor );
		$this->apiMain = new ApiMain( $context, true );
		$this->apiMain->execute();
		return $this->apiMain->getResult()->getResultData( null, [ 'Strip' => 'all' ] );
	}

	private function privatePolicy(): void {
		$this->assertSame( 'private', $this->apiMain->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $this->apiMain )->mCacheControl );
	}

	private function witness( $owner ): array {
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$owner, 0, IDBAccessObject::READ_LATEST );
		$witness = [ 'revision' => $revision->getId(), 'main' => $revision->getContent( SlotRecord::MAIN,
			RevisionRecord::RAW )->serialize(), 'layers' => $revision->getContent( 'layers',
			RevisionRecord::RAW )->serialize() ];
		$sink = getenv( 'LAYERS_PDF_TRANSPORT_WITNESSES' );
		if ( $sink ) {
			$loaded = [];
			foreach ( [ ApiLayersRead::class, PageOwnedPilot::class,
				'MediaWiki\\Extension\\Layers\\Revision\\PagePdfEditorReadService' ] as $class ) {
				if ( class_exists( $class, false ) ) {
					$file = ( new \ReflectionClass( $class ) )->getFileName();
					$loaded[$class] = [ 'file' => $file, 'sha256' => hash_file( 'sha256', $file ) ];
				}
			}
			file_put_contents( $sink, json_encode( [ 'test' => $this->getName(),
				'witness' => $witness, 'loaded' => $loaded ] ) . "\n", FILE_APPEND | LOCK_EX );
		}
		return $witness;
	}

	private function refused( array $fixture, array $extra = [], ?Authority $actor = null,
		string $code = 'layers-revision-unavailable'
	): void {
		$before = $this->witness( $fixture[0] );
		try {
			$this->request( $fixture, $extra, $actor );
			$this->fail( 'Unavailable editor transport returned data' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( \MediaWiki\Tests\Api\ApiTestCase::apiExceptionHasCode( $error, $code ) );
			$this->assertStringNotContainsString( 'private path', $error->getMessage() );
			$this->assertArrayNotHasKey( 'layersread', $this->apiMain->getResult()->getResultData() );
			$this->privatePolicy();
		} finally {
			$this->assertSame( $before, $this->witness( $fixture[0] ) );
		}
	}

	public function testActualFactoryExactStoredAndSparseMissingPayloadRemainPrivateWithoutWrites(): void {
		$fixture = $this->fixture();
		[ $owner, $revision, $actor, $binding, $file, $surface ] = $fixture;
		$before = $this->witness( $owner );
		foreach ( [ 2, 1 ] as $page ) {
			$result = $this->request( $fixture, [ 'editorpage' => $page ] );
			$this->assertSame( [ 'editor' ], array_keys( $result['layersread'] ) );
			$editor = $result['layersread']['editor'];
			$this->assertEquals( $this->pilot->preparePdfEditorPage( $owner, $revision, $binding, $page, $actor ),
				$editor );
			$this->assertSame( $owner->getPrefixedDBkey(), $editor['owner'] );
			$this->assertSame( $owner->getArticleID(), $editor['pageId'] );
			$this->assertSame( $revision, $editor['revisionId'] );
			$this->assertSame( $binding, $editor['binding'] );
			$this->assertSame( 2, $editor['pageCount'] );
			$this->assertSame( 2, $editor['initialPage'] );
			$this->assertSame( $page, $editor['page'] );
			$this->assertSame( $page === 2, $editor['stored'] );
			$this->assertSame( [ [ 'page' => 2, 'surfaceId' => 'anchor' ] ], $editor['members'] );
			$this->assertSame( [ 'page' => $page, 'width' => $file->getWidth( $page ),
				'height' => $file->getHeight( $page ), 'units' => 'file-handler-pixels' ], $editor['sourceGeometry'] );
			$this->assertEquals( array_replace( $surface['source'], [ 'page' => $page ] ),
				$editor['surface']['source'] );
			$this->assertIsString( $editor['rendition']['url'] );
			if ( $page === 2 ) {
				$this->assertEquals( $surface, $editor['surface'] );
				$this->assertFalse( $editor['surface']['canvas']['backgroundVisible'] );
				$this->assertSame( 0, $editor['surface']['canvas']['backgroundOpacity'] );
			} else {
				$this->assertSame( [], $editor['surface']['layers'] );
				$this->assertSame( NewPageDrawing::surfaceId( $owner->getArticleID(), $revision,
					'ABC', $surface['source']['fileTitle'], 1 ), $editor['surface']['id'] );
			}
			$this->privatePolicy();
		}
		$this->assertSame( $before, $this->witness( $owner ) );
	}

	public function testSameNameFileAndOwnerIsolation(): void {
		$other = $this->fixture();
		$otherSurface = $other[5];
		$otherSurface['id'] = 'other-file';
		$fixture = $this->fixture( [ $otherSurface ] );
		$before = $this->witness( $other[0] );
		foreach ( [ $other, $fixture ] as $selected ) {
			$result = $this->request( $selected )['layersread']['editor'];
			$this->assertEquals( $selected[5], $result['surface'] );
			$this->assertSame( $selected[0]->getArticleID(), $result['pageId'] );
			$this->assertSame( [ [ 'page' => 2, 'surfaceId' => 'anchor' ] ], $result['members'] );
		}
		$this->refused( $fixture, [ 'binding' => $other[3] ] );
		$this->assertSame( $before, $this->witness( $other[0] ) );
	}

	/** @dataProvider provideBadSelection */
	public function testInvalidSelectionAndConflictingModesStayPrivate( array $extra, string $code ): void {
		$this->refused( $this->fixture(), $extra, null, $code );
	}

	public static function provideBadSelection(): array {
		return [ [ [ 'binding' => null ], 'layers-revision-unavailable' ],
			[ [ 'binding' => 'bad' ], 'layers-revision-unavailable' ],
			[ [ 'binding' => 'v1:2147483647:anchor' ], 'layers-revision-unavailable' ],
			[ [ 'binding' => 'v1:1:a|v1:1:b' ], 'layers-revision-unavailable' ],
			[ [ 'viewer' => true ], 'layers-revision-unavailable' ],
			[ [ 'controls' => true ], 'layers-revision-unavailable' ],
			[ [ 'editorpage' => 0 ], 'outofrange' ], [ [ 'editorpage' => -1 ], 'outofrange' ],
			[ [ 'editorpage' => 2147483648 ], 'outofrange' ],
			[ [ 'editorpage' => 3 ], 'layers-revision-unavailable' ],
			[ [ 'owner' => 'Special:Version' ], 'layers-revision-unavailable' ] ];
	}

	public function testAbsentCallbackCannotFallbackToOtherMode(): void {
		$fixture = $this->fixture();
		$this->withoutCallback = true;
		$this->refused( $fixture );
	}

	/** @dataProvider provideDeniedRight */
	public function testActorAndSourceAdmission( string $right ): void {
		$fixture = $this->fixture();
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $fixture[2]->getUser() );
		$authority->method( 'definitelyCan' )->willReturnCallback( static fn ( $name ): bool => $name !== $right );
		$authority->method( 'authorizeRead' )->willReturnCallback(
			static fn ( $name, $title ): bool => $right !== 'source' || $title->getNamespace() !== NS_FILE );
		$this->refused( $fixture, [], $authority );
	}

	public static function provideDeniedRight(): array {
		return [ [ 'read' ], [ 'edit' ], [ 'editlayers' ], [ 'source' ] ];
	}

	public function testAnonymousAndStaleHistoricalBaseRefused(): void {
		$fixture = $this->fixture();
		$this->refused( $fixture, [], $this->getServiceContainer()->getUserFactory()->newAnonymous() );
		$later = $fixture[5];
		$later['layers'][0]['text'] = 'Later disposable content';
		$this->publisher->publish( $fixture[0], $fixture[2], $fixture[1],
			$this->buildDocument( [ $later ] ), 'Later disposable revision' );
		$this->refused( $fixture );
	}

	public function testProtectedOwnerRefusedWithoutSlotChanges(): void {
		$fixture = $this->fixture();
		$page = $this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $fixture[0] );
		$cascade = false;
		$this->assertStatusGood( $page->doUpdateRestrictions( [ 'edit' => 'sysop' ],
			[ 'edit' => 'infinity' ], $cascade, 'Disposable transport protection',
			$this->getTestSysop()->getUser() ) );
		$this->refused( $fixture );
	}

	public function testBlockedActorRefusedWithoutSlotChanges(): void {
		$fixture = $this->fixture();
		$services = $this->getServiceContainer();
		$this->assertStatusGood( $services->getBlockUserFactory()->newBlockUser( $fixture[2]->getUser(),
			$this->getTestSysop()->getUser(), 'infinity', 'Disposable transport actor block' )->placeBlock() );
		$actor = $services->getUserFactory()->newFromId( $fixture[2]->getUser()->getId() );
		$this->refused( $fixture, [], $actor );
	}

	public function testUnavailablePinnedSourceRefusedWithoutSlotChanges(): void {
		$fixture = $this->fixture();
		$this->getDb()->newDeleteQueryBuilder()->deleteFrom( 'image' )
			->where( [ 'img_name' => $fixture[4]->getName() ] )->caller( __METHOD__ )->execute();
		$fixture[4]->purgeCache();
		$this->refused( $fixture );
	}

	public function testHiddenRevisionRefusedWithoutPartialData(): void {
		$fixture = $this->fixture();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => RevisionRecord::DELETED_TEXT ] )->where( [ 'rev_id' => $fixture[1] ] )
			->caller( __METHOD__ )->execute();
		$this->refused( $fixture );
	}

	public function testHiddenPinnedSourceRefusedForStoredAndMissingPage(): void {
		$fixture = $this->fixture();
		$this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			$fixture[5]['source']['fileTitle'], '20261007130000' );
		$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )->set( [ 'oi_deleted' => File::DELETED_FILE ] )
			->where( [ 'oi_name' => $fixture[4]->getName(), 'oi_timestamp' => $fixture[5]['source']['timestamp'] ] )
			->caller( __METHOD__ )->execute();
		$fixture[4]->purgeCache();
		foreach ( [ 2, 1 ] as $page ) {
			$this->refused( $fixture, [ 'editorpage' => $page ] );
		}
	}

	public function testOperationalFailureStaysPrivateAndRedacted(): void {
		$fixture = $this->fixture();
		$this->pilot = new class( $this->getServiceContainer() ) extends PageOwnedPilot {
			public function preparePdfEditorPage( \MediaWiki\Title\Title $owner, int $revisionId,
				string $binding, int $targetPage, Authority $authority
			): array {
				throw new \RuntimeException( 'private path diagnostic' );
			}
		};
		$this->refused( $fixture, [], null, 'layers-reading-failed' );
	}

	public function testShorterReuploadRetainsExactArchivedOriginalWithoutSlotChanges(): void {
		$fixture = $this->fixture();
		$before = $this->witness( $fixture[0] );
		$stored = $this->request( $fixture )['layersread']['editor'];
		$missing = $this->request( $fixture, [ 'editorpage' => 1 ] )['layersread']['editor'];
		$current = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-multipage-replacement.pdf',
			$fixture[5]['source']['fileTitle'], '20261007130000' );
		$this->assertSame( 1, $current->pageCount() );
		foreach ( [ [ 2, $stored ], [ 1, $missing ] ] as [ $page, $earlier ] ) {
			$result = $this->request( $fixture, [ 'editorpage' => $page ] )['layersread']['editor'];
			$this->assertSame( 2, $result['pageCount'] );
			$this->assertSame( $earlier['sourceGeometry'], $result['sourceGeometry'] );
			$this->assertEquals( $earlier['surface'], $result['surface'] );
			$this->assertStringContainsString( '/archive/', $result['rendition']['url'] );
			$this->privatePolicy();
		}
		$original = $this->resolver->resolve( new LayersDocumentContent( $before['layers'] ), $fixture[2] )['anchor'];
		$this->assertSame( file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ),
			file_get_contents( $original->getLocalRefPath() ) );
		$this->assertSame( $before, $this->witness( $fixture[0] ) );
	}

	public function testProductionCompositionPropagatesFinalExactReadRefusal(): void {
		$fixture = $this->fixture();
		$native = $this->getServiceContainer()->getRevisionLookup();
		$reads = 0;
		$lookup = $this->createMock( RevisionLookup::class );
		$lookup->method( 'getRevisionByTitle' )->willReturnCallback(
			static fn ( ...$args ) => $native->getRevisionByTitle( ...$args ) );
		$lookup->method( 'getRevisionById' )->willReturnCallback( static function ( ...$args ) use (
			&$reads, $native
		) {
			if ( ++$reads > 1 ) {
				throw new \DomainException( 'private path final read refused' );
			}
			return $native->getRevisionById( ...$args );
		} );
		$this->setService( 'RevisionLookup', $lookup );
		$this->pilot = new PageOwnedPilot( $this->getServiceContainer() );
		$this->refused( $fixture );
		$this->assertGreaterThan( 1, $reads );
	}
}
