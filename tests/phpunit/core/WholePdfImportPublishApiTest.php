<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiBase;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyPdfImportPublish;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * The native route exposes complete-PDF publication while remaining unconnected to editor activation.
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyPdfImportPublish
 * @group Database
 * @group API
 */
class WholePdfImportPublishApiTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private PageOwnedPilot $pilot;
	private array $pair = [];
	private array $pin = [];
	private bool $posted = true;
	private ?\MediaWiki\Api\ApiMain $observedMain = null;
	private ?ApiLayersWorkingCopyPdfImportPublish $observedModule = null;

	protected function setUp(): void {
		parent::setUp();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->setUpIsolatedLocalRepoFixture();
		$this->setContentLang( 'en' );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'move', 'createpage' ] );
		$this->installRouteObserver();
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			'File:Whole-pdf-publish-api-' . wfRandomString( 8 ) . '.pdf' );
		$file = $repo->newFile( $title );
		$status = $file->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Isolated whole-PDF API asset', 'Fixture', 0, false, '20260906120000',
			$this->getTestSysop()->getUser() );
		$this->assertStatusGood( $status );
		self::guardIsolatedFixtureRepository( $repo );
		$this->pin = [ 'repository' => 'local', 'fileTitle' => 'File:' . $file->getName(),
			'timestamp' => $file->getTimestamp(), 'sha1' => $file->getSha1() ];
		foreach ( [ 'target', 'source' ] as $role ) {
			$page = $this->getExistingTestPage( 'WholePdfPublishApi ' . $role . ' ' . wfRandomString( 8 ) );
			$members = $role === 'target' ? [ $this->surface( 'target-two', 2 ) ] :
				[ $this->surface( 'source-two', 2 ), $this->surface( 'source-one', 1 ) ];
			$revision = $this->ordinary( $page->getTitle()->getPrefixedText(), $page->getLatest(), $members );
			$this->pair[$role] = [ 'pageId' => $page->getId(), 'title' => $page->getTitle(),
				'revisionId' => $revision, 'surfaceId' => $members[0]['id'] ];
		}
	}

	private function ordinary( string $owner, int $base, array $surfaces ): int {
		return $this->doApiRequestWithToken( [ 'action' => 'layerspublish', 'owner' => $owner,
			'baserevid' => $base, 'data' => $this->document( $surfaces ),
			'summary' => 'Isolated whole-PDF API fixture' ], null, $this->actor )[0]['layerspublish']['revid'];
	}

	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, $this->posted, $session );
	}

	private function installRouteObserver(): void {
		$configured = $this->getServiceContainer()->getMainConfig()->get( 'APIModules' );
		$definitions = PageOwnedPilotRegistration::apiModules();
		$factory = $definitions['layersworkingcopypdfimportpublish']['factory'];
		$definitions['layersworkingcopypdfimportpublish']['factory'] = function ( $main, $name ) use ( $factory ) {
			$this->observedMain = $main;
			$this->observedModule = $factory( $main, $name );
			return $this->observedModule;
		};
		$this->overrideConfigValue( 'APIModules', array_replace( $configured, $definitions ) );
	}

	private function surface( string $id, int $page, ?array $layers = null ): array {
		$layers ??= [ [ 'id' => 'text-' . $id, 'type' => 'text', 'text' => $id,
			'x' => 24, 'y' => 31, 'rotation' => 15 ] ];
		return [ 'id' => $id, 'kind' => 'pdf', 'label' => 'ABC',
			'canvas' => [ 'width' => 416, 'height' => 208, 'backgroundColor' => '#eeeeee',
				'backgroundVisible' => false, 'backgroundOpacity' => 0.5 ],
			'source' => $this->pin + [ 'page' => $page ], 'layers' => $layers,
			'readingOrder' => array_column( $layers, 'id' ) ];
	}

	private function document( array $surfaces ): string {
		return JsonSnapshotCodec::encode( [ 'schemaVersion' => 1, 'surfaces' => $surfaces ] );
	}

	private function descriptor( ?string $target = null, ?string $source = null,
		?int $revision = null, ?int $pageId = null
	): array {
		return [ 'targetSurfaceId' => $target ?? 'target-two',
			'sourcePageId' => $pageId ?? $this->pair['source']['pageId'],
			'sourceRevisionId' => $revision ?? $this->pair['source']['revisionId'],
			'sourceSurfaceId' => $source ?? 'source-two' ];
	}

	private function admission( ?int $revision = null, ?string $id = null ): array {
		$revision ??= $this->pair['target']['revisionId'];
		$id ??= NewPageDrawing::surfaceId( $this->pair['target']['pageId'], $revision,
			'ABC', $this->pin['fileTitle'], 1 );
		return $this->surface( $id, 1, [ [ 'id' => 'imported-text', 'type' => 'text',
			'text' => 'Imported whole-PDF page one', 'x' => 12, 'y' => 18 ] ] );
	}

	private function proposed( ?array $admission = null ): array {
		$two = $this->surface( 'target-two', 2 );
		$two['layers'][0]['text'] = 'Published whole-PDF page two';
		return [ 'schemaVersion' => 1, 'surfaces' => [ $two, $admission ?? $this->admission() ] ];
	}

	private function params( ?array $data = null, ?array $sources = null, ?array $origins = null ): array {
		$params = [ 'action' => 'layersworkingcopypdfimportpublish',
			'targetpageid' => $this->pair['target']['pageId'],
			'baserevid' => $this->pair['target']['revisionId'],
			'data' => $this->document( $data['surfaces'] ?? $this->proposed()['surfaces'] ),
			'importsources' => JsonSnapshotCodec::encode( $sources ?? [ $this->descriptor() ] ),
			'summary' => 'Whole-PDF Import API test' ];
		if ( $origins !== null ) {
			$params['admissionrevisions'] = JsonSnapshotCodec::encode( $origins );
		}
		return $params;
	}

	private function state(): array {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'page' => 'page_id', 'revision' => 'rev_id', 'slots' => [ 'slot_revision_id', 'slot_role_id' ],
			'content' => 'content_id', 'text' => 'old_id', 'comment' => 'comment_id',
			'change_tag' => 'ct_id', 'change_tag_def' => 'ctd_id' ] as $table => $order ) {
			$this->assertStringContainsString( 'unittest_', $this->getDb()->tableName( $table ) );
			$state[$table] = array_map( static fn ( $row ) => (array)$row, iterator_to_array(
				$this->getDb()->newSelectQueryBuilder()->select( '*' )->from( $table )->orderBy( $order )
					->caller( __METHOD__ )->fetchResultSet() ) );
		}
		return $state;
	}

	private function refused( array $params, string $code = 'layers-working-copy-import-unavailable',
		?Authority $actor = null, ?string $token = 'csrf'
	): void {
		$before = $this->state();
		try {
			$this->doApiRequest( $params, null, false, $actor ?? $this->actor, $token );
			$this->fail( 'Whole-PDF publication must be refused' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, $code ), $error->getMessage() );
		}
		$this->assertSame( $before, $this->state(), 'Refusal preserves all eight isolated database tables' );
	}

	public function testRegisteredRoutePublishesWholeGroupAndPreservesMainAndSource(): void {
		$svc = $this->getServiceContainer();
		$targetBase = $svc->getRevisionLookup()->getRevisionById( $this->pair['target']['revisionId'] );
		$sourceBefore = $svc->getRevisionLookup()->getRevisionById( $this->pair['source']['revisionId'] )
			->getContent( PageRevisionWriter::SLOT )->serialize();
		$before = $this->state();
		$result = $this->doApiRequestWithToken( $this->params(), null, $this->actor )[0]
			['layersworkingcopypdfimportpublish'];
		$this->assertSame( [ 'version', 'result', 'revid' ], array_keys( $result ) );
		$this->assertSame( 1, $result['version'] );
		$this->assertSame( 'Success', $result['result'] );
		$this->assertInstanceOf( ApiLayersWorkingCopyPdfImportPublish::class, $this->observedModule );
		$this->assertSame( 'private', $this->observedMain->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $this->observedMain )->mCacheControl );
		$this->assertGreaterThan( $targetBase->getId(), $result['revid'] );
		$revision = $svc->getRevisionLookup()->getRevisionById( $result['revid'], IDBAccessObject::READ_LATEST );
		$this->assertSame( $this->pair['target']['pageId'], $revision->getPageId() );
		$this->assertSame( $this->actor->getId(), $revision->getUser()->getId() );
		$this->assertSame( $targetBase->getContent( SlotRecord::MAIN )->serialize(),
			$revision->getContent( SlotRecord::MAIN )->serialize() );
		$stored = json_decode( $revision->getContent( PageRevisionWriter::SLOT )->serialize(), true,
			16, JSON_THROW_ON_ERROR );
		$this->assertSame( [ 'target-two', $this->admission()['id'] ],
			array_column( $stored['surfaces'], 'id' ) );
		$this->assertSame( [ 2, 1 ], array_column( array_column( $stored['surfaces'], 'source' ), 'page' ) );
		foreach ( $stored['surfaces'] as $surface ) {
			$this->assertSame( 'ABC', $surface['label'] );
			$this->assertSame( $this->pin['fileTitle'], $surface['source']['fileTitle'] );
			$this->assertSame( $this->pin['sha1'], $surface['source']['sha1'] );
			$this->assertSame( $this->pin['timestamp'], $surface['source']['timestamp'] );
		}
		$sourceLatest = $svc->getRevisionLookup()->getRevisionByTitle( $this->pair['source']['title'], 0,
			IDBAccessObject::READ_LATEST );
		$this->assertSame( $this->pair['source']['revisionId'], $sourceLatest->getId() );
		$this->assertSame( $sourceBefore, $sourceLatest->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertCount( count( $before['revision'] ) + 1, $this->state()['revision'] );
	}

	public function testHistoricalAdmissionIsForwardedToNativePublisher(): void {
		$historic = $this->pair['target']['revisionId'];
		$later = [ $this->surface( 'target-two', 2 ) ];
		$later[0]['layers'][0]['text'] = 'Intervening native target edit';
		$this->pair['target']['revisionId'] = $this->ordinary(
			$this->pair['target']['title']->getPrefixedText(), $historic, $later );
		$oldId = NewPageDrawing::surfaceId( $this->pair['target']['pageId'], $historic,
			'ABC', $this->pin['fileTitle'], 1 );
		$params = $this->params( $this->proposed( $this->admission( $historic, $oldId ) ), null,
			[ [ 'surfaceId' => $oldId, 'revisionId' => $historic ] ] );
		try {
			$result = $this->doApiRequestWithToken( $params, null, $this->actor )[0]
				['layersworkingcopypdfimportpublish'];
		} catch ( \Throwable $error ) {
			$this->fail( 'A valid historical admission should reach and pass native publication: ' .
				$error->getMessage() );
		}
		$this->assertSame( 'Success', $result['result'] );
		$this->assertGreaterThan( $this->pair['target']['revisionId'], $result['revid'] );
	}

	public function testDuplicateSourceMemberRefusesBeforePublication(): void {
		$params = $this->params();
		$valid = $this->descriptor();
		$params['importsources'] = '[{"sourcePageId":0,"sourcePageId":' . $valid['sourcePageId'] .
			',"sourceRevisionId":' . $valid['sourceRevisionId'] . ',"sourceSurfaceId":"' .
			$valid['sourceSurfaceId'] . '","targetSurfaceId":"' . $valid['targetSurfaceId'] . '"}]';
		$this->refused( $params );
	}

	public function testMalformedAndUnknownImportRecordsRefuseWithoutWrites(): void {
		foreach ( [ 'null', '[null]', '[[]]', '[{}]', '[{"unknown":1}]',
			JsonSnapshotCodec::encode( [ array_replace( $this->descriptor(),
				[ 'sourcePageId' => $this->pair['target']['pageId'] ] ) ] ),
			JsonSnapshotCodec::encode( [ array_replace( $this->descriptor(),
				[ 'sourceSurfaceId' => 'missing-source-member' ] ) ] ),
			JsonSnapshotCodec::encode( [ array_replace( $this->descriptor(),
				[ 'sourceRevisionId' => 0 ] ) ] ) ] as $sources ) {
			$this->refused( array_replace( $this->params(), [ 'importsources' => $sources ] ) );
		}
		$this->refused( array_replace( $this->params(), [ 'admissionrevisions' => '[{"unknown":1}]' ] ) );
	}

	public function testStaleBaseHiddenSourceAndNoOpRefuseWithoutWrites(): void {
		$this->refused( array_replace( $this->params(), [ 'baserevid' => 1 ] ) );
		$this->refused( array_replace( $this->params(), [ 'data' => $this->document(
			[ $this->surface( 'target-two', 2 ) ] ) ] ) );
		$source = $this->pair['source']['revisionId'];
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
			RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
			->where( [ 'rev_id' => $source ] )->caller( __METHOD__ )->execute();
		$this->refused( $this->params() );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
			->where( [ 'rev_id' => $source ] )->caller( __METHOD__ )->execute();
	}

	public function testPermissionPostCsrfMainTextAndRateRequirements(): void {
		$reader = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$this->refused( $this->params(), 'permissiondenied', $reader );
		$this->refused( $this->params(), 'missingparam', null, null );
		$this->posted = false;
		$this->refused( $this->params(), 'mustbeposted' );
		$this->posted = true;
		$this->refused( array_replace( $this->params(), [ 'maintext' => '' ] ) );
		$this->refused( array_replace( $this->params(), [ 'maintext' => 'must not replace main slot' ] ) );
		$entered = false;
		$this->setTemporaryHook( 'PingLimiter', static function ( $user, $action, &$result ) use ( &$entered ) {
			if ( $action === 'editlayers-save' ) {
				$entered = true;
				$result = true;
				return false;
			}
			return true;
		}, false );
		$this->refused( $this->params(), 'ratelimited' );
		$this->assertTrue( $entered, 'The actual native Save limiter must run' );
	}

	public function testNativeAliasAndVersionTwoFormatKeepThePublicationEnvelope(): void {
		$definitions = PageOwnedPilotRegistration::apiModules();
		$this->overrideConfigValue( 'APIModules', array_replace(
			$this->getServiceContainer()->getMainConfig()->get( 'APIModules' ),
			[ 'pdfpublishalias' => $definitions['layersworkingcopypdfimportpublish'] ] ) );
		$response = $this->doApiRequestWithToken( array_replace( $this->params(),
			[ 'action' => 'pdfpublishalias', 'formatversion' => 2 ] ), null, $this->actor )[0];
		$this->assertArrayNotHasKey( 'layersworkingcopypdfimportpublish', $response );
		$this->assertSame( 1, $response['pdfpublishalias']['version'] );
		$this->assertSame( 'Success', $response['pdfpublishalias']['result'] );
		$this->assertGreaterThan( $this->pair['target']['revisionId'], $response['pdfpublishalias']['revid'] );
	}

	public function testLostResultCapacityReportsUncertainCommittedSave(): void {
		$this->overrideConfigValue( 'APIMaxResultSize', 1 );
		$before = $this->state();
		try {
			$this->doApiRequestWithToken( $this->params(), null, $this->actor );
			$this->fail( 'A missing success envelope must not confirm or report a refused write' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, 'layers-publication-outcome-unknown' ) );
		}
		$latest = $this->getServiceContainer()->getRevisionLookup()->getRevisionByTitle(
			$this->pair['target']['title'], 0, IDBAccessObject::READ_LATEST );
		$this->assertGreaterThan( $this->pair['target']['revisionId'], $latest->getId() );
		$this->assertSame( $this->document( $this->proposed()['surfaces'] ),
			$latest->getContent( PageRevisionWriter::SLOT )->getCanonicalText() );
		$this->assertCount( count( $before['revision'] ) + 1, $this->state()['revision'] );
	}

	public function testRegisteredRouteIsLazyPrivateAndHasExactParameterContract(): void {
		$before = $this->getServiceContainer()->peekService( 'LayersPageOwnedPilot' );
		$definitions = PageOwnedPilotRegistration::apiModules();
		$this->assertSame( $before, $this->getServiceContainer()->peekService( 'LayersPageOwnedPilot' ) );
		$this->assertArrayHasKey( 'layersworkingcopypdfimportpublish', $definitions );
		$this->assertSame( ApiLayersWorkingCopyPdfImportPublish::class,
			$definitions['layersworkingcopypdfimportpublish']['class'] );
		$main = new ApiMain( new FauxRequest() );
		$module = $this->pilot->newWorkingCopyPdfImportPublishApi( $main, 'layersworkingcopypdfimportpublish' );
		$wrapper = TestingAccessWrapper::newFromObject( $module );
		$this->assertInstanceOf( \MediaWiki\Extension\Layers\Revision\PageWorkingCopyPdfImportPublicationService::class,
			$wrapper->publisher );
		$this->assertSame( 'csrf', $module->needsToken() );
		$this->assertTrue( $module->isWriteMode() && $module->mustBePosted() );
		$params = $module->getAllowedParams();
		$this->assertCount( 6, $params );
		$this->assertSame( '[]', $params['admissionrevisions'][ApiBase::PARAM_DFLT] );
		$this->assertArrayNotHasKey( 'maintext', $params );
		$this->assertSame( 'private', $main->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $main )->mCacheControl );
		$this->assertArrayHasKey( 'layerspublish', $definitions );
		$this->assertArrayHasKey( 'layersworkingcopypdfimportread', $definitions );
		$old = [ 'layersworkingcopypdfimportpublish' => 'UnrelatedModule', 'unrelated' => 'UnrelatedModule' ];
		$this->setMwGlobals( [ 'wgAPIModules' => $old ] );
		try {
			PageOwnedPilotRegistration::onRegistration( [] );
			$this->fail( 'A collision must refuse registration without replacing existing definitions' );
		} catch ( \LogicException $error ) {
			$this->assertSame( 'Conflicting Layers pilot API registration', $error->getMessage() );
		}
		$this->assertSame( $old, $GLOBALS['wgAPIModules'] );
	}
}
