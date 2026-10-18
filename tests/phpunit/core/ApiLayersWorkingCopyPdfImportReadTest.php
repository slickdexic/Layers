<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyPdfImportRead;
use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportReadService;
use MediaWiki\Extension\Layers\Security\RateLimiter;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\MutableRevisionRecord;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';
require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyPdfImportRead
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration
 * @group Database
 * @group API
 */
class ApiLayersWorkingCopyPdfImportReadTest extends \MediaWiki\Tests\Api\ApiTestCase {

	use IsolatedLocalRepoFixture;

	private array $registration;
	private array $pair;
	private array $pin;
	private Authority $actor;
	private ?ApiMain $main = null;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->setUpIsolatedLocalRepoFixture();
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$services = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', array_replace(
			$services->getMainConfig()->get( 'APIModules' ), PageOwnedPilotRegistration::apiModules() ) );
		$repo = $services->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $services->getTitleFactory()->makeTitle( NS_FILE, 'PdfImportWire' . wfRandomString( 8 ) . '.pdf' );
		$file = $repo->newFile( $title );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Isolated PDF transport asset', 'Fixture', 0, false, '20260906120000',
			$this->getTestSysop()->getUser() ) );
		self::guardIsolatedFixtureRepository( $repo );
		$this->pin = [ 'repository' => 'local', 'fileTitle' => $title->getPrefixedDBkey(),
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1() ];
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'PdfImportWire' . $role . wfRandomString( 8 ) );
			$surfaces = [ $this->surface( $role . '-two', 2 ) ];
			if ( $role === 'source' ) {
				$surfaces[] = $this->surface( 'source-one', 1 );
			}
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$page->getLatest(), json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ),
				'Isolated PDF Import transport fixture' );
			$this->pair[$role] = [ 'pageId' => $page->getId(), 'revisionId' => $revision,
				'title' => $page->getTitle(), 'surfaceId' => $role . '-two' ];
		}
	}

	private function surface( string $id, int $page ): array {
		return [ 'id' => $id, 'kind' => 'pdf', 'label' => 'ABC',
			'canvas' => [ 'width' => 416, 'height' => 208, 'backgroundColor' => '#ffffff',
				'backgroundVisible' => true, 'backgroundOpacity' => 1 ],
			'source' => $this->pin + [ 'page' => $page ],
			'layers' => [ [ 'id' => 'text', 'type' => 'text', 'text' => $id, 'x' => 20, 'y' => 30 ] ] ];
	}

	private function params(): array {
		return [ 'action' => 'layersworkingcopypdfimportread', 'formatversion' => 2,
			'targetpageid' => $this->pair['target']['pageId'], 'baserevid' => $this->pair['target']['revisionId'],
			'targetsurface' => $this->pair['target']['surfaceId'], 'sourcepageid' => $this->pair['source']['pageId'],
			'sourcerevid' => $this->pair['source']['revisionId'], 'sourcesurface' => $this->pair['source']['surfaceId'],
			'maxage' => 3600, 'smaxage' => 3600 ];
	}

	private function state(): string {
		$rows = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$rows[$table] = iterator_to_array( $this->getDb()->newSelectQueryBuilder()->select( '*' )
				->from( $table )->caller( __METHOD__ )->fetchResultSet() );
		}
		return serialize( $rows );
	}

	private function request( array $overrides = [], ?Authority $authority = null, bool $posted = true ): array {
		$before = $this->state();
		$context = new RequestContext();
		$context->setRequest( new FauxRequest( array_replace( $this->params(), $overrides ), $posted ) );
		$context->setAuthority( $authority ?? $this->actor );
		$this->main = new ApiMain( $context, true );
		try {
			$this->main->execute();
			$formatter = new class( $this->main, 'json' ) extends ApiFormatJson {
				public string $output = '';

				public function printText( $text ) {
					$this->output .= $text;
				}
			};
			$formatter->execute();
			return json_decode( $formatter->output, true, 512, JSON_THROW_ON_ERROR );
		} finally {
			$this->assertSame( $before, $this->state(), 'A whole-PDF read never writes any fixture table' );
		}
	}

	private function privatePolicy(): void {
		$this->assertSame( 'private', $this->main->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $this->main )->mCacheControl );
	}

	private function refused( array $overrides = [], ?Authority $authority = null, bool $posted = true,
		string $code = 'layers-working-copy-import-unavailable'
	): void {
		try {
			$this->request( $overrides, $authority, $posted );
			$this->fail( 'Unavailable complete PDF data must refuse' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, $code ) );
			$this->assertArrayNotHasKey( 'layersworkingcopypdfimportread',
				$this->main->getResult()->getResultData() );
			$this->privatePolicy();
		}
	}

	private function decoded( array $response, string $module = 'layersworkingcopypdfimportread' ): array {
		$envelope = $response[$module];
		$this->assertSame( [ 'version', 'data' ], array_keys( $envelope ) );
		$this->assertSame( 1, $envelope['version'] );
		$this->assertIsString( $envelope['data'] );
		$this->assertDoesNotMatchRegularExpression( '/[^\x00-\x7f]/', $envelope['data'] );
		return (array)json_decode( $envelope['data'], false, 512, JSON_THROW_ON_ERROR );
	}

	private function witness( string $name, array $response ): void {
		$output = getenv( 'LAYERS_PDF_IMPORT_RESPONSE_WITNESS' );
		if ( $output ) {
			$this->assertSame( dirname( dirname( realpath( wfTempDir() ) ) ), dirname( $output ) );
			file_put_contents( $output, json_encode( [ 'name' => $name, 'params' => $this->params(),
				'response' => $response ], JSON_THROW_ON_ERROR ) . "\n", FILE_APPEND | LOCK_EX );
		}
	}

	public function testRegisteredCompleteGroupsAndNativeAdmissionsStayExact(): void {
		$response = $this->request();
		$data = $this->decoded( $response );
		$this->assertCount( 9, $data );
		$this->assertSame( [ 1, 2 ], array_column( $data['sourceGroup']->members, 'page' ) );
		$this->assertSame( [ 2 ], array_column( $data['targetGroup']->members, 'page' ) );
		$this->assertSame( 2, $data['targetGroup']->pageCount );
		$this->assertCount( 1, $data['admittedTargetSurfaces'] );
		$admitted = $data['admittedTargetSurfaces'][0];
		$this->assertSame( 'ABC', $admitted->label );
		$this->assertSame( $this->pin + [ 'page' => 1 ], (array)$admitted->source );
		$this->assertSame( [], $admitted->layers );
		$this->assertSame( 416, $data['admittedTargetGeometry']->{$admitted->id}->width );
		$this->assertSame( 208, $data['admittedTargetGeometry']->{$admitted->id}->height );
		$this->assertSame( 1, $data['admittedTargetGeometry']->{$admitted->id}->page );
		$this->assertCount( 2, $data['sourceBundle']->snapshot->surfaces );
		$this->assertCount( 1, $data['targetBundle']->snapshot->surfaces );
		$this->privatePolicy();
		$module = $this->main->getModuleManager()->getModule( 'layersworkingcopypdfimportread' );
		$this->assertInstanceOf( ApiLayersWorkingCopyPdfImportRead::class, $module );
		$reader = TestingAccessWrapper::newFromObject( $module )->reader;
		$this->assertInstanceOf( PageWorkingCopyPdfImportReadService::class, $reader );
		$this->assertInstanceOf( PageOwnedPilot::class,
			$this->getServiceContainer()->getService( 'LayersPageOwnedPilot' ) );
		$this->assertSame( $this->getServiceContainer()->getService( 'LayersRateLimiter' ),
			TestingAccessWrapper::newFromObject( $module )->rateLimiter );
		$this->witness( 'complete-native', $response );
	}

	public function testRegistrationIsLazyCollisionSafeAndExistingDefinitionsRemain(): void {
		$before = $this->getServiceContainer()->peekService( 'LayersPageOwnedPilot' );
		$definitions = PageOwnedPilotRegistration::apiModules();
		$this->assertSame( $before, $this->getServiceContainer()->peekService( 'LayersPageOwnedPilot' ) );
		$this->assertSame( ApiLayersWorkingCopyPdfImportRead::class,
			$definitions['layersworkingcopypdfimportread']['class'] );
		$this->assertInstanceOf( \Closure::class, $definitions['layersworkingcopypdfimportread']['factory'] );
		$this->assertArrayHasKey( 'layersworkingcopyimportread', $definitions );
		$this->assertArrayHasKey( 'layerspublish', $definitions );
		$old = [ 'layersworkingcopypdfimportread' => 'UnrelatedModule', 'unrelated' => 'UnrelatedModule' ];
		$this->setMwGlobals( [ 'wgAPIModules' => $old ] );
		try {
			PageOwnedPilotRegistration::onRegistration( [] );
			$this->fail( 'A collision must refuse the complete registration' );
		} catch ( \LogicException $error ) {
			$this->assertSame( 'Conflicting Layers pilot API registration', $error->getMessage() );
		}
		$this->assertSame( $old, $GLOBALS['wgAPIModules'] );
	}

	public function testAliasAndBothNativeJsonFormatsKeepEnvelope(): void {
		$definitions = PageOwnedPilotRegistration::apiModules();
		$this->overrideConfigValue( 'APIModules', array_replace(
			$this->getServiceContainer()->getMainConfig()->get( 'APIModules' ),
			[ 'pdfimportalias' => $definitions['layersworkingcopypdfimportread'] ] ) );
		foreach ( [ 1, 2 ] as $version ) {
			$response = $this->request( [ 'action' => 'pdfimportalias', 'formatversion' => $version ] );
			$this->assertArrayNotHasKey( 'layersworkingcopypdfimportread', $response );
			$this->assertSame( 'ABC', $this->decoded( $response, 'pdfimportalias' )['sourceGroup']->label );
			$this->privatePolicy();
		}
	}

	public function testPostParametersPermissionsAndNativeIdentityRefusals(): void {
		$this->refused( [], null, false, 'mustbeposted' );
		$this->refused( [ 'targetsurface' => '' ], null, true, 'missingparam' );
		$this->refused( [ 'sourcesurface' => 'foreign-anchor' ] );
		$this->refused( [ 'sourcepageid' => $this->pair['target']['pageId'] ] );
		$this->refused( [ 'sourcerevid' => $this->pair['target']['revisionId'] ] );
		$viewer = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $viewer, [ 'read' ] );
		$this->refused( [], $viewer );
		$module = $this->main->getModuleManager()->getModule( 'layersworkingcopypdfimportread' );
		$allowed = $module->getAllowedParams();
		$this->assertSame( [ 'targetpageid', 'baserevid', 'targetsurface', 'sourcepageid',
			'sourcerevid', 'sourcesurface' ], array_keys( $allowed ) );
		$this->assertSame( 2147483647, $allowed['baserevid'][ApiBase::PARAM_MAX] );
		$this->assertSame( 128, $allowed['targetsurface'][ApiBase::PARAM_MAX_BYTES] );
	}

	public function testNativeResultSizeLimitRefusesWholeResponse(): void {
		$this->overrideConfigValue( 'APIMaxResultSize', 32 );
		$this->refused();
	}

	public function testRateLimitRefusesBeforeReaderInvocation(): void {
		$reader = $this->createMock( PageWorkingCopyPdfImportReadService::class );
		$reader->expects( $this->never() )->method( 'read' );
		$limiter = $this->createMock( RateLimiter::class );
		$limiter->expects( $this->once() )->method( 'checkRateLimit' )->with( $this->actor, 'render' )
			->willReturn( false );
		$this->overrideConfigValue( 'APIModules', array_replace(
			$this->getServiceContainer()->getMainConfig()->get( 'APIModules' ), [
				'layersworkingcopypdfimportread' => [ 'class' => ApiLayersWorkingCopyPdfImportRead::class,
					'factory' => static fn ( $main, $name ) =>
						new ApiLayersWorkingCopyPdfImportRead( $main, $name, $reader, $limiter ) ] ] ) );
		$this->refused();
	}

	public function testHiddenSourceAndStaleTargetRefuseWithoutPayload(): void {
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 1 ] )
			->where( [ 'rev_id' => $this->pair['source']['revisionId'] ] )->caller( __METHOD__ )->execute();
		$this->refused();
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $this->pair['source']['revisionId'] ] )->caller( __METHOD__ )->execute();
		$target = $this->pair['target'];
		$surface = $this->surface( 'target-two', 2 );
		$surface['layers'][0]['text'] = 'Newer owning-page work';
		$new = $this->registration['publisher']->publish( $target['title'], $this->actor, $target['revisionId'],
			json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ] ), 'Later isolated target revision' );
		$this->assertNotSame( $target['revisionId'], $new );
		$this->refused();
	}

	public function testHistoricalMetadataAndJsonTypesSurviveNativeFormatterExactly(): void {
		$surfaces = [ $this->surface( 'source-two', 2 ), $this->surface( 'source-one', 1 ) ];
		$document = json_decode( json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) );
		$document->surfaces[0]->layers[0]->future = (object)[ '_type' => 'not API metadata',
			'_content' => 'keep this property', 'emptyObject' => new \stdClass(), 'emptyList' => [],
			'nullable' => null, 'false' => false, 'fraction' => 1.25, 'zero' => 0.0,
			'numericObject' => (object)[ '0' => 'numeric property' ], 'unicode' => "e\u{0301} Ω 世界" ];
		$text = json_encode( $document, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION );
		$content = new LayersDocumentContent( $text );
		$this->assertTrue( $content->isReadable() );
		$this->assertFalse( $content->isValid() );
		$owner = $this->pair['source'];
		$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( 'revision' ) );
		$record = new MutableRevisionRecord( $owner['title'] );
		$record->setUser( $this->actor );
		$record->setTimestamp( wfTimestampNow() );
		$record->setComment( CommentStoreComment::newUnsavedComment( 'Isolated historical PDF transport proof' ) );
		$record->setParentId( $owner['revisionId'] );
		$record->setContent( 'main', new WikitextContent( 'Isolated historical transport fixture' ) );
		// The insertion-time fixture exception is revoked before an uncached production-class reload.
		$insertion = new class( $text ) extends LayersDocumentContent {
			public bool $allowInsertion = false;

			public function isValid() {
				return $this->allowInsertion || parent::isValid();
			}
		};
		$record->setContent( 'layers', $insertion );
		try {
			$insertion->allowInsertion = true;
			$id = $this->getServiceContainer()->getRevisionStore()
				->insertRevisionOn( $record, $this->getDb() )->getId();
		} finally {
			$insertion->allowInsertion = false;
			$this->assertFalse( $insertion->isValid() );
			unset( $record, $insertion );
		}
		$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$id, IDBAccessObject::READ_LATEST )->getContent( 'layers', RevisionRecord::RAW );
		$this->assertSame( LayersDocumentContent::class, get_class( $stored ) );
		$this->assertSame( $text, $stored->getText() );
		$this->assertFalse( $stored->isValid() );
		$response = $this->request( [ 'sourcerevid' => $id ] );
		$data = $this->decoded( $response );
		$this->assertSame( JsonSnapshotCodec::encode( $document ),
			JsonSnapshotCodec::encode( $data['sourceBundle']->snapshot ) );
		$future = $data['sourceBundle']->snapshot->surfaces[0]->layers[0]->future;
		$this->assertInstanceOf( \stdClass::class, $future->emptyObject );
		$this->assertSame( [], $future->emptyList );
		$this->assertSame( "e\u{0301} Ω 世界", $future->unicode );
		$this->assertSame( 'not API metadata', $future->_type );
		$this->assertSame( 'keep this property', $future->_content );
		$this->assertSame( 'numeric property', $future->numericObject->{'0'} );
		$this->assertSame( 0.0, $future->zero );
		$this->privatePolicy();
		$this->witness( 'historical-json-types', $response );
	}
}
