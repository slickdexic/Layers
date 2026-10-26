<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportReadService;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead
 * @group Database
 * @group API
 */
class ApiLayersWorkingCopyImportReadTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use IsolatedLocalRepoFixture;

	private array $registration;
	private array $pair;
	private Authority $actor;
	private PageWorkingCopyImportReadService $reader;
	private ?ApiMain $apiMain = null;
	private array $denied = [];
	private array $checks = [];

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'move', 'createpage' ] );
		$this->pair = [];
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'ImportApi' . $role . wfRandomString( 8 ) );
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$page->getLatest(), json_encode( $this->document() ), 'Isolated Import API fixture' );
			$this->pair[$role] = [ 'pageId' => $page->getId(), 'revisionId' => $revision,
				'title' => $page->getTitle() ];
		}
		$this->reader = $this->service();
		$services = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', array_replace( $services->getMainConfig()->get( 'APIModules' ), [
			'layersworkingcopyimportread' => [ 'class' => ApiLayersWorkingCopyImportRead::class,
				'factory' => function ( $main, $name ) {
					$main->setCacheMode( 'public' );
					$main->setCacheMaxAge( 3600 );
					return new ApiLayersWorkingCopyImportRead( $main, $name, $this->reader );
				} ]
		] ) );
	}

	private function document(): array {
		$path = __DIR__ . '/../../fixtures/revisions/slide-document-v1.json';
		$document = json_decode( file_get_contents( $path ), true );
		$document['surfaces'][0]['canvas']['backgroundVisible'] = false;
		$document['surfaces'][0]['canvas']['backgroundOpacity'] = 0;
		return $document;
	}

	private function service( ?PageReadService $reader = null ): PageWorkingCopyImportReadService {
		$services = $this->getServiceContainer();
		$access = new PageHistoryAccess( $services->getRevisionLookup() );
		return new PageWorkingCopyImportReadService( new PageOwnedIdentityResolver( $services->getTitleFactory(),
			$services->getRevisionLookup(), $access ), $services->getTitleFactory(),
			$reader ?? new PageReadService( $access, new SourceVersionResolver(
				$services->getRepoGroup()->getLocalRepo(), $services->getTitleFactory() ) ),
			PageOwnedScope::newFromServices( $services, [] ) );
	}

	private function authority(): Authority {
		$authority = $this->createMock( Authority::class );
		$authority->method( 'getUser' )->willReturn( $this->actor->getUser() );
		$authority->method( 'isAllowed' )->willReturnCallback( fn ( $right ) => $this->actor->isAllowed( $right ) );
		$callback = function ( $right, $title ): bool {
			$id = $title->getArticleID( IDBAccessObject::READ_LATEST );
			$this->checks[] = [ $right, $id ];
			return !in_array( [ $right, $id ], $this->denied, true ) &&
				( $right === 'read' || $id === $this->pair['target']['pageId'] );
		};
		$authority->method( 'definitelyCan' )->willReturnCallback( $callback );
		$authority->method( 'authorizeRead' )->willReturnCallback( $callback );
		return $authority;
	}

	private function params(): array {
		return [ 'action' => 'layersworkingcopyimportread', 'formatversion' => 2,
			'targetpageid' => $this->pair['target']['pageId'], 'baserevid' => $this->pair['target']['revisionId'],
			'targetsurface' => 'presentation', 'sourcepageid' => $this->pair['source']['pageId'],
			'sourcerevid' => $this->pair['source']['revisionId'], 'sourcesurface' => 'presentation',
			'maxage' => 3600, 'smaxage' => 3600 ];
	}

	private function request( array $overrides = [], ?Authority $authority = null ): array {
		$before = $this->revisions();
		$context = new RequestContext();
		$context->setRequest( new FauxRequest( array_replace( $this->params(), $overrides ) ) );
		$context->setAuthority( $authority ?? $this->actor );
		$this->apiMain = new ApiMain( $context, true );
		$this->apiMain->execute();
		$formatter = new class( $this->apiMain, 'json' ) extends ApiFormatJson {
			public string $output = '';

			public function printText( $text ) {
				$this->output .= $text;
			}
		};
		$formatter->execute();
		$this->assertStringNotContainsString( '_type', $formatter->output );
		$this->assertEquals( $before, $this->revisions() );
		return json_decode( $formatter->output, true, 64, JSON_THROW_ON_ERROR );
	}

	private function privatePolicy(): void {
		$this->assertSame( 'private', $this->apiMain->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $this->apiMain )->mCacheControl );
	}

	private function revisions(): array {
		return iterator_to_array( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->orderBy( 'rev_id' )->caller( __METHOD__ )->fetchResultSet() );
	}

	private function refused( array $overrides = [], ?Authority $authority = null,
		string $code = 'layers-working-copy-import-unavailable'
	): void {
		$before = $this->revisions();
		try {
			$this->request( $overrides, $authority );
			$this->fail( 'Unavailable Import returned data' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, $code ) );
			$this->assertStringNotContainsString( 'private secret', $error->getMessage() );
			$this->assertArrayNotHasKey( 'layersworkingcopyimportread', $this->apiMain->getResult()->getResultData() );
			$this->privatePolicy();
		} finally {
			$this->assertEquals( $before, $this->revisions() );
		}
	}

	public function testActualAuthorizedCompleteSlideReadWithoutPublication(): void {
		$before = $this->revisions();
		$authority = $this->authority();
		$result = $this->request( [], $authority );
		$expected = $this->reader->read( $this->pair['target']['pageId'], $this->pair['target']['revisionId'],
			'presentation', $this->pair['source']['pageId'], $this->pair['source']['revisionId'],
			'presentation', $authority );
		$this->assertSame( $expected, $result['layersworkingcopyimportread'] );
		$this->assertFalse( $expected['sourceBundle']['snapshot']['surfaces'][0]['canvas']['backgroundVisible'] );
		$this->assertSame( 0, $expected['sourceBundle']['snapshot']['surfaces'][0]['canvas']['backgroundOpacity'] );
		$this->assertNotContains( [ 'edit', $this->pair['source']['pageId'] ], $this->checks );
		$this->assertNotContains( [ 'editlayers', $this->pair['source']['pageId'] ], $this->checks );
		$this->privatePolicy();
		$this->assertEquals( $before, $this->revisions() );
		$sink = getenv( 'LAYERS_IMPORT_RESPONSE_WITNESS' );
		if ( $sink ) {
			file_put_contents( $sink, json_encode( [ 'params' => $this->params(), 'response' => $result ] ) . "\n",
				FILE_APPEND | LOCK_EX );
		}
	}

	public function testPositiveBundleCompanion(): void {
		$result = $this->request()['layersworkingcopyimportread'];
		$this->assertSame( $this->pair['target']['pageId'], $result['target']['pageId'] );
		$this->assertSame( $this->pair['source']['revisionId'], $result['sourceBundle']['revisionId'] );
		$this->assertFalse( $result['sourceBundle']['snapshot']['surfaces'][0]['canvas']['backgroundVisible'] );
	}

	public function testOriginalAuthorityAndRealNativeDenials(): void {
		foreach ( [ 'read', 'edit', 'editlayers' ] as $right ) {
			$this->denied = [ [ $right, $this->pair['target']['pageId'] ] ];
			$this->refused( [], $this->authority() );
		}
		$this->denied = [ [ 'read', $this->pair['source']['pageId'] ] ];
		$this->refused( [], $this->authority() );
		$this->denied = [];
		$this->refused( [ 'sourcepageid' => $this->pair['target']['pageId'],
			'sourcerevid' => $this->pair['target']['revisionId'] ] );
		$this->refused( [ 'sourcerevid' => $this->pair['target']['revisionId'] ] );
		$this->refused( [ 'baserevid' => $this->pair['source']['revisionId'] ] );
	}

	public function testPrivacyOnBadParametersAndServiceRefusal(): void {
		foreach ( [ 'targetpageid', 'baserevid', 'sourcepageid', 'sourcerevid' ] as $key ) {
			$this->refused( [ $key => null ], null, 'missingparam' );
			foreach ( [ 0, -1, 2147483648 ] as $value ) {
				$this->refused( [ $key => $value ], null, 'outofrange' );
			}
		}
		foreach ( [ 'targetsurface', 'sourcesurface' ] as $key ) {
			$this->refused( [ $key => null ], null, 'missingparam' );
			$this->refused( [ $key => '' ], null, 'missingparam' );
			$this->refused( [ $key => str_repeat( 'a', 129 ) ], null, 'maxbytes' );
			$this->refused( [ $key => 'missing' ] );
		}
	}

	public function testFreshReadHistoricalVisibilityAndCurrentTarget(): void {
		$this->request();
		$this->denied = [ [ 'read', $this->pair['source']['pageId'] ] ];
		$this->refused( [], $this->authority() );
		$this->denied = [];
		$source = $this->pair['source'];
		$document = $this->document();
		$document['surfaces'][0]['layers'][0]['text'] = 'Later isolated source';
		$this->registration['publisher']->publish( $source['title'], $this->actor, $source['revisionId'],
			json_encode( $document ), 'Later source' );
		$this->assertNotSame( 'Later isolated source', $this->request()['layersworkingcopyimportread']
			['sourceBundle']['snapshot']['surfaces'][0]['layers'][0]['text'] );
		foreach ( [ RevisionRecord::DELETED_TEXT, RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ]
			as $bits
		) {
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => $bits ] )
				->where( [ 'rev_id' => $source['revisionId'] ] )->caller( __METHOD__ )->execute();
			$this->refused();
		}
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $source['revisionId'] ] )->caller( __METHOD__ )->execute();
		$target = $this->pair['target'];
		$this->registration['publisher']->publish( $target['title'], $this->actor, $target['revisionId'],
			json_encode( $document ), 'Later target' );
		$this->refused();
	}

	public function testMovedNativeIdsAndOldTitleRedirectRefusal(): void {
		$services = $this->getServiceContainer();
		foreach ( [ 'target', 'source' ] as $role ) {
			$old = $this->pair[$role]['title'];
			$new = $this->getNonexistingTestPage()->getTitle();
			$this->assertStatusGood( $services->getMovePageFactory()->newMovePage( $old, $new )
				->moveIfAllowed( $this->actor, 'Isolated API owner move' ) );
			if ( $role === 'target' ) {
				$this->pair[$role]['revisionId'] = $services->getRevisionLookup()
					->getRevisionByTitle( $new, 0, IDBAccessObject::READ_LATEST )->getId();
			}
			$result = $this->request()['layersworkingcopyimportread'][$role];
			$this->assertSame( $new->getPrefixedDBkey(), $result['owner'] );
			$this->assertSame( $this->pair[$role]['pageId'], $result['pageId'] );
			$redirect = $services->getTitleFactory()->newFromText( $old->getPrefixedText() );
			$this->assertNotSame( $result['pageId'], $redirect->getArticleID( IDBAccessObject::READ_LATEST ) );
			$this->refused( [ $role . 'pageid' => $redirect->getArticleID( IDBAccessObject::READ_LATEST ) ] );
		}
	}

	public function testAbsentSlotAndDuplicateFixtureAdmission(): void {
		$page = $this->getExistingTestPage();
		$this->refused( [ 'sourcepageid' => $page->getId(), 'sourcerevid' => $page->getLatest() ] );
		$document = $this->document();
		$document['surfaces'][] = $document['surfaces'][0];
		$before = $this->revisions();
		try {
			$this->registration['publisher']->publish( $this->pair['source']['title'], $this->actor,
				$this->pair['source']['revisionId'], json_encode( $document ), 'Duplicate isolated fixture' );
			$this->fail( 'Duplicate native member fixture was admitted' );
		} catch ( \MediaWiki\Extension\Layers\Revision\PublicationException $error ) {
			$this->assertSame( 'layers-invalid-snapshot', $error->getMessage() );
			$this->assertSame( 'duplicate-surface-id', $error->getPrevious()->getMessage() );
		}
		$this->assertEquals( $before, $this->revisions() );
	}

	public function testRealProtectedSourceNeedsNoEditAndProtectedTargetRefuses(): void {
		foreach ( [ 'source', 'target' ] as $role ) {
			$page = $this->getServiceContainer()->getWikiPageFactory()->newFromTitle( $this->pair[$role]['title'] );
			$cascade = false;
			$this->assertStatusGood( $page->doUpdateRestrictions( [ 'edit' => 'sysop' ],
				[ 'edit' => 'infinity' ], $cascade, 'Isolated Import protection', $this->getTestSysop()->getUser() ) );
			if ( $role === 'source' ) {
				$this->assertIsArray( $this->request()['layersworkingcopyimportread'] );
				$this->privatePolicy();
			} else {
				$this->refused();
			}
		}
	}

	public function testContractDoubleReceivesOriginalAuthorityAndExactArguments(): void {
		$authority = $this->authority();
		$params = $this->params();
		$this->reader = $this->createMock( PageWorkingCopyImportReadService::class );
		$this->reader->expects( $this->once() )->method( 'read' )->with( $params['targetpageid'],
			$params['baserevid'], $params['targetsurface'], $params['sourcepageid'], $params['sourcerevid'],
			$params['sourcesurface'], $this->identicalTo( $authority ) )
			->willThrowException( new \Error( 'private secret nested diagnostic' ) );
		$this->refused( [], $authority );
	}

	public function testRealIsolatedPdfSelectionRefuses(): void {
		$services = $this->getServiceContainer();
		$title = $services->getTitleFactory()->newFromText( 'File:ImportApi-' . wfRandomString( 8 ) . '.pdf' );
		$input = $this->getNewTempFile();
		file_put_contents( $input, file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' ) );
		$file = $services->getRepoGroup()->getLocalRepo()->newFile( $title );
		$this->assertStatusGood( $file->upload( $input, 'Isolated PDF', 'Import API PDF', 0, false,
			'20260906120000', $this->getTestSysop()->getUser() ) );
		$surface = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ),
			true )['surfaces'][2];
		$surface['source']['fileTitle'] = $title->getPrefixedDBkey();
		$surface['source']['timestamp'] = '20260906120000';
		$surface['source']['sha1'] = $file->getSha1();
		$source = $this->pair['source'];
		$this->pair['source']['revisionId'] = $this->registration['publisher']->publish( $source['title'],
			$this->actor, $source['revisionId'], json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ),
			'Isolated selected PDF' );
		$this->refused( [ 'sourcesurface' => $surface['id'] ] );
	}

	public function testRealIsolatedImageHistoricalPinAfterReupload(): void {
		$name = 'File:ImportApiPin-' . wfRandomString( 8 ) . '.png';
		$bytes = base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAA' .
			'C0lEQVR42mP8/x8AAwMCAO+j6X8AAAAASUVORK5CYII=' );
		$input = $this->getNewTempFile();
		file_put_contents( $input, $bytes );
		$services = $this->getServiceContainer();
		$title = $services->getTitleFactory()->newFromText( $name );
		$file = $services->getRepoGroup()->getLocalRepo()->newFile( $title );
		$this->assertStatusGood( $file->upload( $input, 'Isolated initial', 'Import API pin', 0, false,
			'20260906120000', $this->getTestSysop()->getUser() ) );
		$document = [ 'schemaVersion' => 1, 'surfaces' => [ json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ), true )['surfaces'][1] ] ];
		$surface = &$document['surfaces'][0];
		$surface['source']['fileTitle'] = $name;
		$surface['source']['timestamp'] = $file->getTimestamp();
		$surface['source']['sha1'] = $file->getSha1();
		$surface['canvas']['width'] = 1;
		$surface['canvas']['height'] = 1;
		$id = $surface['id'];
		foreach ( [ 'target', 'source' ] as $role ) {
			$this->pair[$role]['revisionId'] = $this->registration['publisher']->publish( $this->pair[$role]['title'],
				$this->actor, $this->pair[$role]['revisionId'], json_encode( $document ), 'Pinned isolated image' );
		}
		$before = $this->request( [ 'targetsurface' => $id, 'sourcesurface' => $id ] );
		file_put_contents( $input, $bytes . "\n" );
		$this->assertStatusGood( $file->upload( $input, 'Isolated replacement', 'Import API pin', 0, false,
			'20260907120000', $this->getTestSysop()->getUser() ) );
		$this->assertSame( $before, $this->request( [ 'targetsurface' => $id, 'sourcesurface' => $id ] ) );
		$this->privatePolicy();
		$this->getDb()->newUpdateQueryBuilder()->update( 'oldimage' )->set( [ 'oi_deleted' => File::DELETED_FILE ] )
			->where( [ 'oi_name' => $file->getName(), 'oi_timestamp' => '20260906120000' ] )
			->caller( __METHOD__ )->execute();
		$file->purgeCache();
		$this->refused( [ 'targetsurface' => $id, 'sourcesurface' => $id ] );
	}
}
