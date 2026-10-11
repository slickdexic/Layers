<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportReadService;
use MediaWiki\Extension\Layers\Revision\SourceRenditions;
use MediaWiki\Extension\Layers\Revision\SourceVersionResolver;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\MutableRevisionRecord;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead
 * @group Database
 * @group API
 */
class ApiLayersWorkingCopyImportReadProofTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use IsolatedLocalRepoFixture;

	private array $registration;
	private array $pair;
	private Authority $actor;
	private PageReadService $nativeReader;
	private PageWorkingCopyImportReadService $reader;
	private ?ApiMain $apiMain = null;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'ImportProof' . $role . wfRandomString( 8 ) );
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
			$page->getLatest(), json_encode( $this->slideDocument() ), 'Valid isolated Import proof fixture' );
			$this->pair[$role] = [ 'pageId' => $page->getId(), 'revisionId' => $revision,
	   'title' => $page->getTitle() ];
		}
		$services = $this->getServiceContainer();
		$access = new PageHistoryAccess( $services->getRevisionLookup() );
		$this->nativeReader = new PageReadService( $access,
		new SourceVersionResolver( $services->getRepoGroup()->getLocalRepo(), $services->getTitleFactory() ),
		new SourceRenditions( $services->getUrlUtils() ) );
		$this->reader = new PageWorkingCopyImportReadService(
		new PageOwnedIdentityResolver( $services->getTitleFactory(), $services->getRevisionLookup(), $access ),
		$services->getTitleFactory(), $this->nativeReader, PageOwnedScope::newFromServices( $services, [] ) );
		$this->overrideConfigValue( 'APIModules', array_replace( $services->getMainConfig()->get( 'APIModules' ), [
	  'layersworkingcopyimportread' => [ 'class' => ApiLayersWorkingCopyImportRead::class,
	'factory' => function ( $main, $name ) {
		$main->setCacheMode( 'public' );
		$main->setCacheMaxAge( 3600 );
		return new ApiLayersWorkingCopyImportRead( $main, $name, $this->reader );
	} ]
		] ) );
	}

	private function slideDocument(): array {
		return json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
	}

	private function state(): array {
		return [ 'revisions' => iterator_to_array( $this->getDb()->newSelectQueryBuilder()->select( '*' )
		->from( 'revision' )->orderBy( 'rev_id' )->caller( __METHOD__ )->fetchResultSet() ),
	  'heads' => iterator_to_array( $this->getDb()->newSelectQueryBuilder()->select( [ 'page_id', 'page_latest' ] )
		->from( 'page' )->orderBy( 'page_id' )->caller( __METHOD__ )->fetchResultSet() ) ];
	}

	private function witness( string $event, array $data ): void {
		$output = getenv( 'LAYERS_IMPORT_RESPONSE_WITNESS' );
		if ( $output ) {
			$this->assertSame( realpath( dirname( $output ) ), dirname( $output ) );
			$this->assertSame( dirname( dirname( realpath( wfTempDir() ) ) ), dirname( $output ) );
			file_put_contents( $output, json_encode( [ 'test' => $this->getName(), 'event' => $event,
	   'data' => $data ], JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION ) . "\n", FILE_APPEND | LOCK_EX );
		}
	}

	private function historical( array $document, bool $readable ): int {
		$db = $this->getDb();
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text' ] as $table ) {
			$tables[$table] = $db->tableName( $table );
			$this->assertStringContainsString( 'unittest_', $tables[$table] );
		}
		$before = $this->state();
		$text = json_encode( $document, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION );
		$content = new LayersDocumentContent( $text );
		$this->assertSame( $readable, $content->isReadable() );
		$this->assertFalse( $content->isValid() );
		$this->witness( 'before-historical-insertion', [ 'tables' => $tables,
	  'connectionClass' => get_class( $db ), 'heads' => $before['heads'], 'isReadable' => $content->isReadable(),
	  'isValid' => $content->isValid(), 'text' => $text ] );
		$owner = $this->pair['source'];
		$revision = new MutableRevisionRecord( $owner['title'] );
		$revision->setUser( $this->actor );
		$revision->setTimestamp( wfTimestampNow() );
		$revision->setComment( CommentStoreComment::newUnsavedComment(
			'Authorized isolated historical Import proof' ) );
		$revision->setParentId( $owner['revisionId'] );
		$revision->setContent( 'main', new WikitextContent( 'Isolated historical Import fixture' ) );
		$insertion = new class( $text ) extends LayersDocumentContent {
			private bool $allowed = false;

			public function allowInsertion(): void {
				$this->allowed = true;
			}

			public function revokeInsertion(): void {
				$this->allowed = false;
			}

			public function isValid() {
				return $this->allowed || parent::isValid();
			}
		};
		$this->assertFalse( $insertion->isValid() );
		$this->assertSame( $text, $insertion->getText() );
		$this->assertSame( $readable, $insertion->isReadable() );
		$revision->setContent( 'layers', $insertion );
		try {
			$insertion->allowInsertion();
			$id = $this->getServiceContainer()->getRevisionStore()->insertRevisionOn( $revision, $db )->getId();
		} catch ( \Throwable $error ) {
			$chain = [];
			for ( $cause = $error; $cause; $cause = $cause->getPrevious() ) {
				$chain[] = [ 'class' => get_class( $cause ), 'message' => $cause->getMessage(),
		   'file' => $cause->getFile(), 'line' => $cause->getLine() ];
			}
			$this->witness( 'historical-insertion-refused', [ 'class' => get_class( $error ),
	   'message' => $error->getMessage(), 'chain' => $chain, 'headsBeforeInsertion' => $before['heads'] ] );
			throw $error;
		} finally {
			$insertion->revokeInsertion();
			$this->assertFalse( $insertion->isValid() );
			$this->witness( 'insertion-validity-revoked', [ 'strictValidity' => $insertion->isValid(),
				'text' => $insertion->getText(), 'readability' => $insertion->isReadable(),
				'class' => get_class( $insertion ), 'overrideOnly' => 'isValid' ] );
			unset( $insertion, $revision );
		}
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$id, \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST );
		$this->assertSame( $id, $stored->getId() );
		$this->assertSame( $owner['pageId'], $stored->getPageId() );
		$slot = $stored->getSlot( 'layers', RevisionRecord::RAW );
		$this->assertSame( LayersDocumentContent::MODEL, $slot->getModel() );
		$this->assertInstanceOf( LayersDocumentContent::class, $slot->getContent() );
		$this->assertSame( $text, $slot->getContent()->getText() );
		$this->assertSame( $readable, $slot->getContent()->isReadable() );
		$this->assertSame( LayersDocumentContent::class, get_class( $slot->getContent() ) );
		$this->assertFalse( $slot->getContent()->isValid() );
		$handler = $this->getServiceContainer()->getContentHandlerFactory()->getContentHandler(
			LayersDocumentContent::MODEL );
		$this->assertSame( \MediaWiki\Extension\Layers\Content\LayersDocumentContentHandler::class,
			get_class( $handler ) );
		$this->assertSame( LayersDocumentContent::class, get_class( $handler->unserializeContent( $text ) ) );
		$after = $this->state();
		$this->assertEquals( $before['heads'], $after['heads'] );
		$this->assertCount( count( $before['revisions'] ) + 1, $after['revisions'] );
		$this->assertNotSame( $owner['revisionId'], $id );
		$this->witness( 'stored-historical-revision', [ 'tables' => $tables, 'pageId' => $stored->getPageId(),
	  'revisionId' => $id, 'model' => $slot->getModel(), 'text' => $slot->getContent()->getText(),
	  'isReadable' => $slot->getContent()->isReadable(), 'isValid' => $slot->getContent()->isValid(),
	  'beforeHeads' => $before['heads'], 'afterHeads' => $after['heads'], 'fixtureRevisionsCreated' => 1 ] );
		$this->witness( 'production-reload-boundary', [ 'class' => get_class( $slot->getContent() ),
			'handler' => get_class( $handler ), 'revisionId' => $id, 'pageId' => $stored->getPageId(),
			'model' => $slot->getModel(), 'text' => $slot->getContent()->getText(),
			'strictValidity' => $slot->getContent()->isValid(), 'readability' => $slot->getContent()->isReadable(),
			'lookup' => get_class( $this->getServiceContainer()->getRevisionLookup() ),
			'lookupFlag' => \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST, 'insertionObjectsDiscarded' => true ] );
		$saveBefore = $this->state();
		try {
			$this->registration['publisher']->publish( $owner['title'], $this->actor, $owner['revisionId'],
				$slot->getContent()->getText(), 'Strict production rejection companion' );
			$this->fail( 'Ordinary publication accepted invalid historical content' );
		} catch ( \MediaWiki\Extension\Layers\Revision\PublicationException $error ) {
			$this->assertSame( 'layers-invalid-snapshot', $error->getMessage() );
		}
		$this->assertEquals( $saveBefore, $this->state() );
		$this->witness( 'ordinary-publication-refused', [ 'revisionId' => $id,
			'productionClass' => get_class( $slot->getContent() ), 'code' => 'layers-invalid-snapshot',
			'stateBefore' => $saveBefore, 'stateAfter' => $this->state() ] );
		return $id;
	}

	private function params( ?int $revisionId = null, string $surfaceId = 'presentation' ): array {
		return [ 'action' => 'layersworkingcopyimportread', 'formatversion' => 2,
	  'targetpageid' => $this->pair['target']['pageId'], 'baserevid' => $this->pair['target']['revisionId'],
	  'targetsurface' => 'presentation', 'sourcepageid' => $this->pair['source']['pageId'],
	  'sourcerevid' => $revisionId ?? $this->pair['source']['revisionId'], 'sourcesurface' => $surfaceId,
	  'maxage' => 3600, 'smaxage' => 3600 ];
	}

	private function privatePolicy(): void {
		$this->assertSame( 'private', $this->apiMain->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
		TestingAccessWrapper::newFromObject( $this->apiMain )->mCacheControl );
	}

	private function request( ?int $revisionId = null, string $surfaceId = 'presentation' ): array {
		$before = $this->state();
		$context = new RequestContext();
		$context->setRequest( new FauxRequest( $this->params( $revisionId, $surfaceId ) ) );
		$context->setAuthority( $this->actor );
		$this->apiMain = new ApiMain( $context, true );
		try {
			$this->apiMain->execute();
			$formatter = new class( $this->apiMain, 'json' ) extends ApiFormatJson {
				public string $output = '';

				public function printText( $text ) {
					  $this->output .= $text;
				}
			};
			$formatter->execute();
			$this->assertStringNotContainsString( '_type', $formatter->output );
			$result = json_decode( $formatter->output, true, 64, JSON_THROW_ON_ERROR );
			$this->witness( 'api-json-v2', [ 'params' => $this->params( $revisionId, $surfaceId ),
	   'json' => $formatter->output, 'response' => $result ] );
			return $result;
		} finally {
			$this->privatePolicy();
			$this->assertEquals( $before, $this->state() );
		}
	}

	public function testValidCurrentSourcePositiveCompanion(): void {
		$expected = $this->reader->read( $this->pair['target']['pageId'], $this->pair['target']['revisionId'],
	  'presentation', $this->pair['source']['pageId'], $this->pair['source']['revisionId'],
	  'presentation', $this->actor );
		$this->assertSame( $expected, $this->request()['layersworkingcopyimportread'] );
	}

	public function testActualStoredDuplicateSourceRefusesWithoutFallback(): void {
		$document = $this->slideDocument();
		$document['surfaces'][0]['layers'][0]['text'] = 'Private duplicate historical payload ' . wfRandomString( 12 );
		$secret = $document['surfaces'][0]['layers'][0]['text'];
		$document['surfaces'][] = $document['surfaces'][0];
		$this->assertCount( 2, array_filter( $document['surfaces'],
		static fn ( $surface ) => $surface['id'] === 'presentation' ) );
		$historical = $this->historical( $document, false );
		try {
			$this->request( $historical );
			$this->fail( 'Malformed stored source returned module data' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, 'layers-working-copy-import-unavailable' ) );
			$data = $this->apiMain->getResult()->getResultData();
			$this->assertArrayNotHasKey( 'layersworkingcopyimportread', $data );
			$this->assertStringNotContainsString( $secret, $error->getMessage() . json_encode( $data ) );
			$this->witness( 'duplicate-api-refusal', [ 'revisionId' => $historical,
	   'code' => 'layers-working-copy-import-unavailable', 'result' => $data, 'heads' => $this->state()['heads'] ] );
		}
		$this->testValidCurrentSourcePositiveCompanion();
	}

	private function legacy(): array {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$input = $this->getNewTempFile();
		file_put_contents( $input, base64_decode(
	  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i8AAAAASUVORK5CYII=' ) );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			'File:ImportProof' . wfRandomString( 12 ) . '.png' );
		$file = $repo->newFile( $title );
		$this->assertStatusGood( $file->upload( $input, 'Isolated proof', 'Proof PNG', 0, false,
	  '20260906120000', $this->getTestSysop()->getUser() ) );
		$image = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/mixed-document-v1.json' ),
		true )['surfaces'][1];
		$image['source'] = [ 'repository' => 'local', 'fileTitle' => $title->getPrefixedDBkey(),
	  'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1(), 'page' => 1 ];
		$image['canvas']['width'] = $image['canvas']['height'] = 1;
		$document = $this->slideDocument();
		array_unshift( $document['surfaces'], $image );
		$owner = $this->pair['source'];
		$this->pair['source']['revisionId'] = $this->registration['publisher']->publish( $owner['title'], $this->actor,
		$owner['revisionId'], json_encode( $document ), 'Valid isolated pinned image and slide' );
		$missing = $image;
		$missing['id'] = 'unavailable-image';
		$missing['label'] = 'Unavailable independent sibling';
		$missing['source']['fileTitle'] = 'File:NeverUploadedImportProof' . wfRandomString( 12 ) . '.png';
		$document['surfaces'][] = $missing;
		foreach ( [ 0, 1 ] as $index ) {
			$document['surfaces'][$index]['layers'][0]['legacyNull'] = null;
			$document['surfaces'][$index]['layers'][0]['legacyImportWitness'] = [ 'null' => null, 'false' => false,
	   'zero' => 0, 'fraction' => 1.25, 'text' => "Legacy \u{4E16}\u{754C}",
	   'nested' => [ 'list' => [ null, false, 0, 1.25, [ 'empty' => [] ] ] ] ];
		}
		$revision = $this->historical( $document, true );
		$missingTitle = $this->getServiceContainer()->getTitleFactory()->newFromText( $missing['source']['fileTitle'] );
		$this->assertFalse( $repo->newFile( $missingTitle )->exists() );
		try {
			$this->nativeReader->read( $owner['title'], $revision, $this->actor, $owner['pageId'], [ $missing['id'] ] );
			$this->fail( 'Unavailable file sibling unexpectedly resolved' );
		} catch ( \DomainException $error ) {
			$this->assertSame( 'layers-revision-unavailable', $error->getMessage() );
		}
		$thumb = $file->transform( [ 'width' => 1 ] );
		$this->assertFalse( $thumb->isError() );
		$paths = self::guardIsolatedFixtureRepository( $repo );
		$this->assertStringStartsWith( $paths['public'] . '/', $file->getLocalRefPath() );
		$local = $thumb->getLocalCopyPath();
		$this->assertTrue( is_file( $local ) );
		$this->assertStringStartsWith( dirname( $paths['public'] ) . '/', $local );
		$this->witness( 'native-selected-source', [ 'fileTitle' => $title->getPrefixedDBkey(),
	  'pin' => $image['source'], 'paths' => $paths, 'transformPath' => $local,
	  'transformSha256' => hash_file( 'sha256', $local ), 'missingSibling' => $missing['source'],
	  'revisionId' => $revision, 'missingSiblingRefused' => true ] );
		return [ $revision, $document, $image['id'] ];
	}

	private function assertCompleteLegacy( bool $image ): void {
		[ $revision, $document, $imageId ] = $this->legacy();
		$selected = $image ? $imageId : 'presentation';
		$before = $this->state();
		$source = $this->pair['source'];
		$native = $this->nativeReader->read( $source['title'], $revision, $this->actor,
			$source['pageId'], [ $selected ] );
		$this->assertSame( $document, $native['snapshot'] );
		$expected = $this->reader->read( $this->pair['target']['pageId'], $this->pair['target']['revisionId'],
	  'presentation', $source['pageId'], $revision, $selected, $this->actor );
		$this->assertSame( $expected['sourceBundle'], $native );
		if ( $image ) {
			$this->assertSame( [ $selected ], array_keys( $native['sourceGeometry'] ) );
			$this->assertSame( [ $selected ], array_keys( $native['sourceRenditions'] ) );
			$this->assertSame( 1, $native['sourceGeometry'][$selected]['width'] );
			$this->assertSame( 1, $native['sourceGeometry'][$selected]['height'] );
			$this->assertSame( 1, $native['sourceRenditions'][$selected]['width'] );
			$this->assertSame( 1, $native['sourceRenditions'][$selected]['height'] );
			$this->assertMatchesRegularExpression( '#^https?://#', $native['sourceRenditions'][$selected]['url'] );
		} else {
			$this->assertSame( [], $native['sourceGeometry'] );
			$this->assertSame( [], $native['sourceRenditions'] );
		}
		$actual = $this->request( $revision, $selected )['layersworkingcopyimportread'];
		$this->witness( 'complete-bundle-comparison', [ 'native' => $native,
			'expected' => $expected, 'actual' => $actual ] );
		$this->assertSame( $expected, $actual );
		$this->assertEquals( $before, $this->state() );
	}

	public function testCompleteLegacyImagePreservesUnknownNullRenditionsAndUnavailableSibling(): void {
		$this->assertCompleteLegacy( true );
	}

	public function testCompleteLegacySlidePreservesUnknownNullAndUnavailableSibling(): void {
		$this->assertCompleteLegacy( false );
	}
}
