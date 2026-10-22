<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersMissingPdfImportPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersMissingPdfImportRead;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\Rdbms\IDBAccessObject as RdbmsAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Registered request and first-Save boundary for missing-target whole-PDF Import.
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersMissingPdfImportRead
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersMissingPdfImportPublish
 * @group Database
 */
class MissingPdfImportApiTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private PageOwnedPilot $pilot;
	private array $target = [];
	private array $source = [];
	private array $pin = [];
	private bool $posted = true;
	private ?ApiMain $readMain = null;
	private ?ApiMain $publishMain = null;
	private ?ApiMain $outcomeMain = null;
	private ?ApiLayersMissingPdfImportRead $readModule = null;
	private ?ApiLayersMissingPdfImportPublish $publishModule = null;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->setUpIsolatedLocalRepoFixture();
		$this->setContentLang( 'en' );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		MigrationState::markComplete( $this->getDb() );
		$services = $this->getServiceContainer();
		$this->pilot = $services->getService( 'LayersPageOwnedPilot' );
		$this->installRoutes();
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, $this->posted, $session );
	}

	private function installRoutes(): void {
		$services = $this->getServiceContainer();
		$definitions = PageOwnedPilotRegistration::apiModules();
		$definitions['layersmissingpdfimportread']['factory'] = function ( $main, $name ) {
			$this->readMain = $main;
			$factory = PageOwnedPilotRegistration::apiModules()['layersmissingpdfimportread']['factory'];
			$this->readModule = $factory( $main, $name );
			return $this->readModule;
		};
		$definitions['layersmissingpdfimportpublish']['factory'] = function ( $main, $name ) {
			$this->publishMain = $main;
			$factory = PageOwnedPilotRegistration::apiModules()['layersmissingpdfimportpublish']['factory'];
			$this->publishModule = $factory( $main, $name );
			return $this->publishModule;
		};
		$definitions['layersmissingpdfimportoutcome']['factory'] = function ( $main, $name ) {
			$this->outcomeMain = $main;
			$factory = PageOwnedPilotRegistration::apiModules()['layersmissingpdfimportoutcome']['factory'];
			return $factory( $main, $name );
		};
		$this->overrideConfigValue( 'APIModules', array_replace(
			$services->getMainConfig()->get( 'APIModules' ), $definitions ) );
	}

	private function uploadPdf( ?string $title = null ): \MediaWiki\FileRepo\File\LocalFile {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			$title ?? 'File:MissingPdfApi-' . wfRandomString( 8 ) . '.pdf' );
		$file = $repo->newFile( $title );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Isolated missing-PDF Import', 'Fixture', 0, false, '20260906120000',
			$this->getTestSysop()->getUser() ) );
		return $file;
	}

	private function uploadUpdatedPdf( \MediaWiki\FileRepo\File\LocalFile $file ): void {
		self::guardIsolatedFixtureRepository( $this->getServiceContainer()->getRepoGroup()->getLocalRepo() );
		$bytes = file_get_contents( __DIR__ . '/../../fixtures/assets/test-multipage.pdf' );
		$this->assertIsString( $bytes );
		$updated = str_replace( [ 'Page one', 'Page two' ], [ 'Fresh 01', 'Fresh 02' ], $bytes, $count );
		$this->assertSame( 2, $count );
		$this->assertSame( strlen( $bytes ), strlen( $updated ) );
		$this->assertNotSame( sha1( $bytes ), sha1( $updated ) );
		$path = tempnam( sys_get_temp_dir(), 'layers-missing-import-' );
		$this->assertNotFalse( $path );
		try {
			$this->assertSame( strlen( $updated ), file_put_contents( $path, $updated ) );
			$this->assertStatusGood( $file->upload( $path, 'Same file, updated PDF version', 'Fixture', 0,
				false, '20260907120000', $this->getTestSysop()->getUser() ) );
		} finally {
			if ( file_exists( $path ) ) {
				unlink( $path );
			}
		}
		$file->purgeCache();
	}

	private function ordinary( string $owner, int $base, array $surfaces ): int {
		$params = [ 'action' => 'layerspublish', 'owner' => $owner, 'baserevid' => $base,
			'data' => json_encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ], JSON_THROW_ON_ERROR ),
			'summary' => 'Isolated missing-PDF API fixture' ];
		return $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layerspublish']['revid'];
	}

	private function prepareFixtures( bool $withSlot = false, string $sourceLabel = 'ABC' ): void {
		$file = $this->uploadPdf();
		$embed = '[[' . $file->getTitle()->getPrefixedDBkey() . "|page=2|layerset=ABC|Caption e\u{0301}]]";
		$prefix = "Éditorial π\n";
		$page = $this->getExistingTestPage( 'Missing PDF target ' . wfRandomString( 8 ) );
		$revision = $this->editPage( $page, $prefix . $embed )->getNewRevision()->getId();
		if ( $withSlot ) {
			$sibling = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
			$revision = $this->ordinary( $page->getTitle()->getPrefixedText(), $revision,
				json_decode( $sibling, true, 64, JSON_THROW_ON_ERROR )['surfaces'] );
		}
		$record = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
		$this->target = [ 'page' => $page, 'revision' => $revision, 'start' => strlen( $prefix ),
			'embed' => $embed, 'main' => $record->getContent( SlotRecord::MAIN )->serialize(),
			'base' => $withSlot ? $record->getContent( PageRevisionWriter::SLOT )->serialize() : null,
			'file' => $file ];
		$this->pin = [ 'repository' => 'local', 'fileTitle' => $file->getTitle()->getPrefixedDBkey(),
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1() ];

		$sourcePage = $this->getExistingTestPage( 'Missing PDF source ' . wfRandomString( 8 ) );
		$admitted = $this->pilot->prepareBoundEditor( $page->getId(), $revision,
			$this->target['start'], $embed, $this->actor )['pageOwned']['newSurface'];
		$surfaces = [];
		foreach ( [ 2, 1 ] as $number ) {
			$surface = $admitted;
			$surface['id'] = 'api-source-' . $number;
			$surface['source']['page'] = $number;
			$surface['label'] = $sourceLabel;
			$surface['layers'] = [ [ 'id' => 'api-text-' . $number, 'type' => 'text',
				'text' => "Old source e\u{0301} π page " . $number, 'x' => 17, 'y' => 23 ] ];
			$surfaces[] = $surface;
		}
		$sourceRevision = $this->ordinary( $sourcePage->getTitle()->getPrefixedText(),
			$sourcePage->getLatest(), $surfaces );
		$this->source = [ 'page' => $sourcePage, 'revision' => $sourceRevision,
			'anchor' => $surfaces[0]['id'], 'surfaces' => $surfaces,
			'text' => JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] ) ];
	}

	private function readParams( array $overrides = [] ): array {
		return array_replace( [ 'action' => 'layersmissingpdfimportread', 'formatversion' => 2,
			'targetpageid' => $this->target['page']->getId(), 'baserevid' => $this->target['revision'],
			'embedstart' => $this->target['start'], 'embedtext' => $this->target['embed'],
			'sourcepageid' => $this->source['page']->getId(), 'sourcerevid' => $this->source['revision'],
			'sourcesurface' => $this->source['anchor'], 'maxage' => 3600, 'smaxage' => 3600 ], $overrides );
	}

	private function publishParams( ?array $document = null, ?string $sources = null ): array {
		$read = $this->readData();
		$document ??= $this->proposed( $read );
		$sources ??= JsonSnapshotCodec::encode( [ [ 'sourcePageId' => $this->source['page']->getId(),
			'sourceRevisionId' => $this->source['revision'], 'sourceSurfaceId' => $this->source['anchor'] ] ] );
		return [ 'action' => 'layersmissingpdfimportpublish', 'targetpageid' => $this->target['page']->getId(),
			'baserevid' => $this->target['revision'], 'embedstart' => $this->target['start'],
			'embedtext' => $this->target['embed'],
			'data' => JsonSnapshotCodec::encode( $document ), 'importsources' => $sources,
			'summary' => 'Missing-PDF API Import' ];
	}

	private function readData( array $overrides = [], ?Authority $authority = null ): array {
		$context = new RequestContext();
		$context->setRequest( new FauxRequest( $this->readParams( $overrides ), $this->posted ) );
		$context->setAuthority( $authority ?? $this->actor );
		$this->readMain = new ApiMain( $context, true );
		try {
			$this->readMain->execute();
		} catch ( \MediaWiki\Api\ApiUsageException $error ) {
			$this->fail( 'Exact missing-target preparation must succeed: ' . $error->getMessage() );
		}
		$formatter = new class( $this->readMain, 'json' ) extends ApiFormatJson {
			public string $output = '';

			public function printText( $text ) {
				$this->output .= $text;
			}
		};
		$formatter->execute();
		$response = json_decode( $formatter->output, true, 512, JSON_THROW_ON_ERROR );
		$envelope = $response['layersmissingpdfimportread'];
		$this->assertSame( 1, $envelope['version'] );
		$this->assertIsString( $envelope['data'] );
		$this->assertSame( 1, preg_match( '/^[\x00-\x7f]*$/D', $envelope['data'] ) );
		return json_decode( $envelope['data'], true, 64, JSON_THROW_ON_ERROR );
	}

	private function proposed( array $read ): array {
		$target = $read['targetAdmission'];
		$base = $target['baseBundle']['snapshot'] ?? [ 'schemaVersion' => 1, 'surfaces' => [] ];
		$sourceByPage = [];
		foreach ( $read['sourceBundle']['snapshot']['surfaces'] as $surface ) {
			$sourceByPage[$surface['source']['page']] = $surface;
		}
		foreach ( $target['pages'] as $entry ) {
			$surface = $entry['surface'];
			if ( isset( $sourceByPage[$entry['page']] ) ) {
				$surface['layers'] = $sourceByPage[$entry['page']]['layers'];
				$surface['readingOrder'] = array_column( $surface['layers'], 'id' );
			}
			$base['surfaces'][] = $surface;
		}
		return $base;
	}

	private function state(): array {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage', 'comment',
			'change_tag', 'change_tag_def' ] as $table ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$rows = [];
			foreach ( $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )
				->caller( __METHOD__ )->fetchResultSet() as $row ) {
				$values = (array)$row;
				ksort( $values );
				$rows[] = serialize( $values );
			}
			sort( $rows, SORT_STRING );
			$state[$table] = $rows;
		}
		return $state;
	}

	private function privatePolicy( ?ApiMain $main ): void {
		$this->assertNotNull( $main );
		$this->assertSame( 'private', $main->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $main )->mCacheControl );
	}

	private function refusedRead( array $overrides, string $code = 'layers-working-copy-import-unavailable',
		?Authority $authority = null, bool $posted = true
	): void {
		$before = $this->state();
		$this->posted = $posted;
		try {
			$this->doApiRequest( $this->readParams( $overrides ), null, false, $authority ?? $this->actor );
			$this->fail( 'Missing-target read must be refused' );
		} catch ( \MediaWiki\Api\ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, $code ), $error->getMessage() );
		}
		$this->posted = true;
		$this->privatePolicy( $this->readMain );
		$this->assertSame( $before, $this->state() );
	}

	private function refusedPublish( array $params, string $code = 'layers-working-copy-import-unavailable',
		?Authority $authority = null, ?string $token = 'csrf', bool $posted = true
	): void {
		$before = $this->state();
		$this->posted = $posted;
		try {
			$this->doApiRequest( $params, null, false, $authority ?? $this->actor, $token );
			$this->fail( 'Missing-target publication must be refused' );
		} catch ( \MediaWiki\Api\ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, $code ), $error->getMessage() );
		}
		$this->posted = true;
		$this->privatePolicy( $this->publishMain );
		$this->assertSame( $before, $this->state() );
	}

	/** @dataProvider provideTargetSlots */
	public function testRegisteredReadAndFirstSavePreserveExactBaseAcrossPdfVersions( bool $withSlot ): void {
		// Fixtures need separate targets per provider invocation, so seed this case's optional sibling now.
		$this->prepareFixtures( $withSlot );
		$this->uploadUpdatedPdf( $this->target['file'] );
		$beforeRead = $this->state();
		$read = $this->readData();
		$this->privatePolicy( $this->readMain );
		$this->assertSame( $beforeRead, $this->state(), 'Read preparation performs no writes' );
		$this->assertSame( $this->target['page']->getId(), $read['targetAdmission']['target']['pageId'] );
		$this->assertSame( $this->target['revision'], $read['targetAdmission']['target']['revisionId'] );
		$this->assertSame( $this->pin['fileTitle'], $read['sourceGroup']['source']['fileTitle'] );
		$this->assertSame( $this->pin['timestamp'], $read['sourceGroup']['source']['timestamp'] );
		$this->assertSame( $this->pin['sha1'], $read['sourceGroup']['source']['sha1'] );
		$sourceTextByPage = [];
		foreach ( $read['sourceBundle']['snapshot']['surfaces'] as $surface ) {
			$sourceTextByPage[$surface['source']['page']] = $surface['layers'][0]['text'];
		}
		ksort( $sourceTextByPage, SORT_NUMERIC );
		$this->assertSame( [ 1 => "Old source e\u{0301} π page 1", 2 => "Old source e\u{0301} π page 2" ],
			$sourceTextByPage );
		$this->assertSame( [ 1, 2 ], array_column( $read['targetAdmission']['pages'], 'page' ) );
		$this->assertNotSame( $this->pin['sha1'], $read['targetAdmission']['source']['sha1'] );
		$this->assertNotSame( $this->pin['timestamp'], $read['targetAdmission']['source']['timestamp'] );

		$document = $this->proposed( $read );
		$this->runDeferredUpdates();
		$count = count( $this->state()['revision'] );
		try {
			$response = $this->doApiRequestWithToken( $this->publishParams( $document ), null, $this->actor )[0];
		} catch ( \Throwable $error ) {
			$this->fail( 'Cross-version registered Import must save: ' . $error->getMessage() );
		}
		$this->privatePolicy( $this->publishMain );
		$this->assertSame( 1, $response['layersmissingpdfimportpublish']['version'] );
		$this->assertSame( 'Success', $response['layersmissingpdfimportpublish']['result'] );
		$id = $response['layersmissingpdfimportpublish']['revid'];
		$this->runDeferredUpdates();
		$record = $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$id, RdbmsAccessObject::READ_LATEST );
		$this->assertGreaterThan( $this->target['revision'], $id );
		$this->assertSame( $this->target['page']->getId(), $record->getPageId() );
		$this->assertSame( $this->target['revision'], $record->getParentId() );
		$this->assertSame( $this->target['main'], $record->getContent( SlotRecord::MAIN )->serialize() );
		$storedBytes = $record->getContent( PageRevisionWriter::SLOT )->serialize();
		$this->assertSame( JsonSnapshotCodec::encode( $document ), $storedBytes );
		$stored = json_decode( $storedBytes, true, 64, JSON_THROW_ON_ERROR );
		$members = array_slice( $stored['surfaces'], -2 );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( $members, 'label' ) );
		$this->assertSame( [ 1, 2 ], array_column( array_column( $members, 'source' ), 'page' ) );
		$this->assertSame( [ 17, 17 ], array_column( array_column( array_column( $members, 'layers' ), 0 ), 'x' ) );
		$this->assertSame( [ 23, 23 ], array_column( array_column( array_column( $members, 'layers' ), 0 ), 'y' ) );
		$this->assertSame( [ $read['targetAdmission']['source']['sha1'], $read['targetAdmission']['source']['sha1'] ],
			array_column( array_column( $members, 'source' ), 'sha1' ) );
		foreach ( $read['targetAdmission']['pages'] as $index => $entry ) {
			$this->assertSame( $entry['surface']['id'], $members[$index]['id'] );
			$this->assertSame( JsonSnapshotCodec::encode( $entry['surface']['canvas'] ),
				JsonSnapshotCodec::encode( $members[$index]['canvas'] ) );
			$this->assertSame( NewPageDrawing::surfaceId( $this->target['page']->getId(),
				$this->target['revision'], 'ABC', $read['targetAdmission']['source']['fileTitle'],
				$entry['page'] ), $members[$index]['id'] );
		}
		if ( $withSlot ) {
			$original = json_decode( $this->target['base'], true, 64, JSON_THROW_ON_ERROR );
			$this->assertSame( $original['surfaces'], array_slice( $stored['surfaces'], 0, -2 ) );
		}
		$sourceBytes = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $this->source['revision'] )
			->getContent( PageRevisionWriter::SLOT )->serialize();
		$this->assertSame( $this->source['text'], $sourceBytes );
		$this->assertStringContainsString( (string)$this->source['revision'], $record->getComment()->text );
		$this->assertStringContainsString( $this->source['page']->getTitle()->getPrefixedText(),
			$record->getComment()->text );
		$this->assertCount( $count + 1, $this->state()['revision'] );
		$this->assertContains( PagePublicationService::CHANGE_TAG,
			$this->getServiceContainer()->getChangeTagsStore()->getTags( $this->getDb(), null, $id ) );
	}

	public static function provideTargetSlots(): array {
		return [ 'absent slot' => [ false ], 'unrelated sibling slot' => [ true ] ];
	}

	public function testReadContractAndPrivateCacheOnRequestedMaxAge(): void {
		$this->prepareFixtures();
		$this->uploadUpdatedPdf( $this->target['file'] );
		$before = $this->state();
		$data = $this->readData();
		$this->assertSame( 'ABC', $data['sourceGroup']['label'] );
		$this->assertSame( [ 1, 2 ], array_column( $data['targetAdmission']['pages'], 'page' ) );
		$this->privatePolicy( $this->readMain );
		$this->assertSame( [ 'targetpageid', 'baserevid', 'embedstart', 'embedtext', 'sourcepageid',
			'sourcerevid', 'sourcesurface' ], array_keys( $this->readModule->getAllowedParams() ) );
		$this->assertTrue( $this->readModule->mustBePosted() );
		$this->assertSame( $before, $this->state() );
	}

	public function testReadWitnessOwnerSourceAndMethodRefusals(): void {
		$this->prepareFixtures();
		$this->uploadUpdatedPdf( $this->target['file'] );
		$this->refusedRead( [ 'embedstart' => $this->target['start'] + 1 ] );
		$this->refusedRead( [ 'embedtext' => $this->target['embed'] . 'x' ] );
		$this->refusedRead( [ 'baserevid' => 1 ] );
		$this->refusedRead( [ 'sourcesurface' => 'foreign-anchor' ] );
		$this->refusedRead( [ 'sourcepageid' => $this->target['page']->getId() ] );
		$this->refusedRead( [], 'mustbeposted', null, false );
		$viewer = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $viewer, [ 'read' ] );
		$this->refusedRead( [], 'layers-working-copy-import-unavailable', $viewer );
		$this->prepareFixtures( false, 'XYZ' );
		$this->uploadUpdatedPdf( $this->target['file'] );
		$this->refusedRead( [] );
	}

	public function testReadHiddenSourceAndRateLimitRefusePrivately(): void {
		$this->prepareFixtures();
		$this->uploadUpdatedPdf( $this->target['file'] );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 1 ] )
			->where( [ 'rev_id' => $this->source['revision'] ] )->caller( __METHOD__ )->execute();
		$this->refusedRead( [] );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $this->source['revision'] ] )->caller( __METHOD__ )->execute();
		$entered = false;
		$this->setTemporaryHook( 'PingLimiter', static function ( $user, $action, &$result ) use ( &$entered ) {
			if ( $action === 'editlayers-render' ) {
				$entered = true;
				$result = true;
				return false;
			}
			return true;
		}, false );
		$this->refusedRead( [] );
		$this->assertTrue( $entered, 'The read render limiter must run' );
	}

	public function testWriteWitnessAndDescriptorRefusalsPreserveAllTables(): void {
		$this->prepareFixtures();
		$this->uploadUpdatedPdf( $this->target['file'] );
		$this->readData();
		$base = $this->publishParams();
		$this->refusedPublish( array_replace( $base, [ 'embedstart' => $this->target['start'] + 1 ] ) );
		$this->refusedPublish( array_replace( $base, [ 'embedtext' => $this->target['embed'] . 'x' ] ) );
		$this->refusedPublish( array_replace( $base, [ 'baserevid' => 1 ] ) );
		$this->refusedPublish( array_replace( $base, [ 'importsources' => '[null]' ] ) );
		$this->refusedPublish( array_replace( $base, [ 'importsources' => '[{"extra":true}]' ] ) );
		$wrongOwner = [ 'sourcePageId' => $this->target['page']->getId(),
			'sourceRevisionId' => $this->target['revision'], 'sourceSurfaceId' => $this->source['anchor'] ];
		$this->refusedPublish( array_replace( $base,
			[ 'importsources' => JsonSnapshotCodec::encode( [ $wrongOwner ] ) ] ) );
		$changed = json_decode( $base['data'], true, 64, JSON_THROW_ON_ERROR );
		$changed['surfaces'][0]['source']['sha1'] = str_repeat( '1', 31 );
		$this->refusedPublish( array_replace( $base, [ 'data' => JsonSnapshotCodec::encode( $changed ) ] ) );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 1 ] )
			->where( [ 'rev_id' => $this->source['revision'] ] )->caller( __METHOD__ )->execute();
		$this->refusedPublish( $base );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $this->source['revision'] ] )->caller( __METHOD__ )->execute();
	}

	public function testLiteralDuplicateSourceKeysRefuseBeforePublication(): void {
		$this->prepareFixtures();
		$this->uploadUpdatedPdf( $this->target['file'] );
		$base = $this->publishParams();
		$descriptor = [ 'sourcePageId' => $this->source['page']->getId(),
			'sourceRevisionId' => $this->source['revision'], 'sourceSurfaceId' => $this->source['anchor'] ];
		$raw = '[{"sourcePageId":0,"sourcePageId":' . $descriptor['sourcePageId'] .
			',"sourceRevisionId":' . $descriptor['sourceRevisionId'] .
			',"sourceSurfaceId":"' . $descriptor['sourceSurfaceId'] . '"}]';
		$this->refusedPublish( array_replace( $base, [ 'importsources' => $raw ] ) );
	}

	public function testWritePermissionPostCsrfMainTextAndRateRequirements(): void {
		$this->prepareFixtures();
		$this->uploadUpdatedPdf( $this->target['file'] );
		$base = $this->publishParams();
		$viewer = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $viewer, [ 'read' ] );
		$this->refusedPublish( $base, 'permissiondenied', $viewer );
		$this->refusedPublish( $base, 'missingparam', null, null );
		$this->refusedPublish( $base, 'mustbeposted', null, 'csrf', false );
		$this->refusedPublish( array_replace( $base, [ 'maintext' => '' ] ) );
		$entered = false;
		$this->setTemporaryHook( 'PingLimiter', static function ( $user, $action, &$result ) use ( &$entered ) {
			if ( $action === 'editlayers-save' ) {
				$entered = true;
				$result = true;
				return false;
			}
			return true;
		}, false );
		$this->refusedPublish( $base, 'ratelimited' );
		$this->assertTrue( $entered, 'The native Save limiter must run' );
	}

	public function testRepeatedSourceDescriptorCreatesOneCitationAndOneRevision(): void {
		$this->prepareFixtures();
		$this->uploadUpdatedPdf( $this->target['file'] );
		$descriptor = [ 'sourcePageId' => $this->source['page']->getId(),
			'sourceRevisionId' => $this->source['revision'], 'sourceSurfaceId' => $this->source['anchor'] ];
		$params = $this->publishParams( null, JsonSnapshotCodec::encode( [ $descriptor, $descriptor ] ) );
		$this->runDeferredUpdates();
		$before = count( $this->state()['revision'] );
		$response = $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layersmissingpdfimportpublish'];
		$this->runDeferredUpdates();
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $response['revid'] );
		$this->assertCount( $before + 1, $this->state()['revision'] );
		$this->assertStringContainsString( (string)$this->source['revision'], $revision->getComment()->text );
		$citation = wfMessage( 'layers-copy-summary' )->plaintextParams( 'ABC' )
			->params( $this->source['page']->getTitle()->getPrefixedText(), (string)$this->source['revision'] )
			->inContentLanguage()->text();
		$this->assertSame( $citation . wfMessage( 'colon-separator' )->inContentLanguage()->text() .
			'Missing-PDF API Import', $revision->getComment()->text );
	}

	public function testCommittedSaveWithoutResponseCapacityReportsUnknownOutcome(): void {
		$this->prepareFixtures();
		$this->uploadUpdatedPdf( $this->target['file'] );
		$params = $this->publishParams();
		$document = $params['data'];
		$this->runDeferredUpdates();
		$count = count( $this->state()['revision'] );
		$this->overrideConfigValue( 'APIMaxResultSize', 1 );
		try {
			$this->doApiRequestWithToken( $params, null, $this->actor );
			$this->fail( 'A lost publication envelope must not be reported as a clean refusal' );
		} catch ( \MediaWiki\Api\ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, 'layers-publication-outcome-unknown' ),
				$error->getMessage() );
		}
		$latest = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$this->target['page']->getTitle(), 0, RdbmsAccessObject::READ_LATEST );
		$this->assertGreaterThan( $this->target['revision'], $latest->getId() );
		$this->assertSame( $document, $latest->getContent( PageRevisionWriter::SLOT )->getCanonicalText() );
		$this->assertCount( $count + 1, $this->state()['revision'] );
	}

	private function outcomeParams( array $sent ): array {
		return array_replace( $sent, [ 'action' => 'layersmissingpdfimportoutcome',
			'owner' => $this->target['page']->getTitle()->getPrefixedDBkey(), 'maxage' => 3600, 'smaxage' => 3600 ] );
	}

	/** @dataProvider provideTargetSlots */
	public function testOutcomeConfirmsExactParsedRequestWithoutNativeWrites( bool $slot ): void {
		$this->prepareFixtures( $slot );
		$this->uploadUpdatedPdf( $this->target['file'] );
		$params = $this->publishParams();
		$params['data'] = json_encode( json_decode( $params['data'] ), JSON_PRETTY_PRINT |
			JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR );
		$params['summary'] = " Owner cafe\u{0301} π 日本 😀 ";
		$saved = $this->doApiRequestWithToken( $params, null, $this->actor )[0];
		$before = $this->state();
		$checked = $this->doApiRequestWithToken( $this->outcomeParams( $params ), null, $this->actor )[0];
		$this->assertSame( [ 'version' => 1, 'result' => 'Confirmed',
			'revid' => $saved['layersmissingpdfimportpublish']['revid'] ], $checked['layersmissingpdfimportoutcome'] );
		$this->privatePolicy( $this->outcomeMain );
		$this->assertSame( $before, $this->state(), 'Confirmation creates no native rows' );
	}

	public function testOutcomeMethodTokenAndDuplicateMemberRefusalsPreserveNativeRows(): void {
		$this->prepareFixtures();
		$params = $this->publishParams();
		$this->doApiRequestWithToken( $params, null, $this->actor );
		$base = $this->outcomeParams( $params );
		$descriptor = json_decode( $params['importsources'], true )[0];
		$duplicate = '[{"sourcePageId":' . $descriptor['sourcePageId'] . ',"sourcePageId":' .
			$descriptor['sourcePageId'] . ',"sourceRevisionId":' . $descriptor['sourceRevisionId'] .
			',"sourceSurfaceId":' . json_encode( $descriptor['sourceSurfaceId'] ) . '}]';
		$cases = [
			[ [ 'summary' => 'Different note' ], 'layers-working-copy-import-unavailable', 'csrf', true ],
			[ [ 'importsources' => $duplicate ], 'layers-working-copy-import-unavailable', 'csrf', true ],
			[ [ 'maintext' => '' ], 'layers-working-copy-import-unavailable', 'csrf', true ],
			[ [], 'missingparam', null, true ],
			[ [], 'mustbeposted', 'csrf', false ]
		];
		foreach ( $cases as [ $overrides, $code, $token, $posted ] ) {
			$before = $this->state();
			$this->posted = $posted;
			try {
				$this->doApiRequest( array_replace( $base, $overrides ), null, false, $this->actor, $token );
				$this->fail( 'Outcome refusal must preserve the uncertain editor' );
			} catch ( \MediaWiki\Api\ApiUsageException $error ) {
				$this->assertTrue( self::apiExceptionHasCode( $error, $code ), $error->getMessage() );
			} finally {
				$this->posted = true;
			}
			$this->privatePolicy( $this->outcomeMain );
			$this->assertSame( $before, $this->state() );
		}
	}

	public function testOutcomeFindsCommittedSaveAfterItsSuccessEnvelopeWasLost(): void {
		$this->prepareFixtures();
		$params = $this->publishParams();
		$maximum = $this->getServiceContainer()->getMainConfig()->get( 'APIMaxResultSize' );
		$this->overrideConfigValue( 'APIMaxResultSize', 1 );
		try {
			$this->doApiRequestWithToken( $params, null, $this->actor );
			$this->fail( 'Response capacity must reproduce the lost confirmation' );
		} catch ( \MediaWiki\Api\ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, 'layers-publication-outcome-unknown' ) );
		}
		$this->overrideConfigValue( 'APIMaxResultSize', $maximum );
		$current = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$this->target['page']->getTitle(), 0, RdbmsAccessObject::READ_LATEST );
		$before = $this->state();
		$checked = $this->doApiRequestWithToken( $this->outcomeParams( $params ), null, $this->actor )[0];
		$this->assertSame( $current->getId(), $checked['layersmissingpdfimportoutcome']['revid'] );
		$this->assertSame( $before, $this->state(), 'A lost envelope never requires a second Save' );
		$this->privatePolicy( $this->outcomeMain );
	}

	public function testRegistrationIsLazyPrivateAndCollisionSafe(): void {
		$before = $this->getServiceContainer()->peekService( 'LayersPageOwnedPilot' );
		$definitions = PageOwnedPilotRegistration::apiModules();
		$this->assertSame( $before, $this->getServiceContainer()->peekService( 'LayersPageOwnedPilot' ) );
		$this->assertSame( ApiLayersMissingPdfImportRead::class, $definitions['layersmissingpdfimportread']['class'] );
		$this->assertSame( ApiLayersMissingPdfImportPublish::class,
			$definitions['layersmissingpdfimportpublish']['class'] );
		$readMain = new ApiMain( new FauxRequest() );
		$read = $this->pilot->newMissingPdfImportReadApi( $readMain, 'layersmissingpdfimportread' );
		$this->assertTrue( $read->mustBePosted() );
		$this->assertSame( 'private', $readMain->getCacheMode() );
		$readParams = $read->getAllowedParams();
		$this->assertSame( [ 'targetpageid', 'baserevid', 'embedstart', 'embedtext', 'sourcepageid',
			'sourcerevid', 'sourcesurface' ], array_keys( $readParams ) );
		$this->assertSame( 0, $readParams['embedstart'][\MediaWiki\Api\ApiBase::PARAM_MIN] );
		$this->assertSame( DocumentSchema::MAX_BYTES,
			$readParams['embedtext'][\MediaWiki\Api\ApiBase::PARAM_MAX_BYTES] );
		$writeMain = new ApiMain( new FauxRequest() );
		$write = $this->pilot->newMissingPdfImportPublishApi( $writeMain, 'layersmissingpdfimportpublish' );
		$this->assertTrue( $write->mustBePosted() && $write->isWriteMode() );
		$this->assertSame( 'csrf', $write->needsToken() );
		$this->assertArrayNotHasKey( 'maintext', $write->getAllowedParams() );
		$this->assertSame( 0, $write->getAllowedParams()['embedstart'][\MediaWiki\Api\ApiBase::PARAM_MIN] );
		$this->assertSame( DocumentSchema::MAX_BYTES,
			$write->getAllowedParams()['data'][\MediaWiki\Api\ApiBase::PARAM_MAX_BYTES] );
		$this->assertSame( 'private', $writeMain->getCacheMode() );
		$this->assertArrayHasKey( 'layersworkingcopypdfimportread', $definitions );
		$this->assertArrayHasKey( 'layersworkingcopypdfimportpublish', $definitions );
		$old = [ 'layersmissingpdfimportread' => 'UnrelatedModule', 'unrelated' => 'UnrelatedModule' ];
		$this->setMwGlobals( [ 'wgAPIModules' => $old ] );
		try {
			PageOwnedPilotRegistration::onRegistration( [] );
			$this->fail( 'A collision must refuse paired registration' );
		} catch ( \LogicException $error ) {
			$this->assertSame( 'Conflicting Layers pilot API registration', $error->getMessage() );
		}
		$this->assertSame( $old, $GLOBALS['wgAPIModules'] );
	}
}
