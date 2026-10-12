<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationPublish;
use MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRead;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Revision\PageOwnedIdentityResolver;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageReadService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationService;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportCreationTarget;
use MediaWiki\Extension\Layers\Revision\PageWorkingCopyImportReadService;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use MediaWiki\Revision\RevisionRecord;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';
require_once __DIR__ . '/../../../maintenance/migrateLayersToPageHistory.php';

/**
 * Real native current revisions and guarded isolated file storage; no editor/API activation.
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRead
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationPublish
 * @covers \MediaWiki\Extension\Layers\Revision\PageOwnedPilot
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration
 * @group Database
 */
class NativeCreationImportApiTest extends \MediaWiki\Tests\Api\ApiTestCase {

	use IsolatedLocalRepoFixture;

	private array $registration;
	private Authority $actor;
	private PageOwnedPilot $pilot;
	private ?ApiMain $readMain = null;
	private bool $posted = true;

	protected function setUp(): void {
		parent::setUp();
		$this->setContentLang( 'en' );
		$this->setUpIsolatedLocalRepoFixture();
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$services = $this->getServiceContainer();
		$this->assertNull( $services->peekService( 'LayersPageOwnedPilot' ) );
		$definitions = PageOwnedPilotRegistration::apiModules();
		$this->assertNull( $services->peekService( 'LayersPageOwnedPilot' ) );
		$this->overrideConfigValue( 'APIModules', array_replace( $services->getMainConfig()->get( 'APIModules' ),
			$definitions ) );
		$this->pilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
		$this->registration = [ 'publisher' => TestingAccessWrapper::newFromObject( $this->pilot )->publisher ];
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		$maintenance = new \MigrateLayersToPageHistory();
		$maintenance->setDB( $this->getDb() );
		$maintenance->setOption( 'user', $this->getTestSysop()->getUser()->getName() );
		$maintenance->setOption( 'commit', true );
		ob_start();
		try {
			$this->assertTrue( $maintenance->execute() );
		} finally {
			ob_end_clean();
		}
	}

	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage',
			'comment', 'change_tag', 'change_tag_def' ] as $table ) {
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

	private function upload( string $letter = 'A' ): \MediaWiki\FileRepo\File\LocalFile {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
			'File:ImportCreation' . $letter . wfRandomString( 8 ) . '.png' );
		$input = $this->getNewTempFile();
		copy( __DIR__ . '/../../fixtures/assets/test-image.png', $input );
		$file = $repo->newFile( $title );
		$this->assertTrue( $file->upload( $input, 'Isolated creation target', 'Fixture only', 0, false,
			'20260906120000', $this->getTestSysop()->getUser() )->isOK() );
		return $file;
	}

	private function fixture( string $kind = 'slide', bool $slot = false,
		string $selector = 'ABC', bool $linkedCaption = false
	): array {
		$file = $kind === 'image' ? $this->upload() : null;
		$embed = $file ? '[[' . $file->getTitle()->getPrefixedDBkey() . '|layerset=' . $selector .
			( $linkedCaption ? '|A [[Main Page|linked caption]]]]' : '|Plain caption]]' ) :
			'{{#Slide:' . $selector . '}}';
		$prefix = "Préface π\n";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $prefix . $embed )->getNewRevision()->getId();
		$document = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
		$document['surfaces'][0]['label'] = 'Preserved sibling';
		if ( $slot ) {
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$revision, json_encode( $document ), 'Isolated sibling setup' );
			$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
			$document = json_decode( $stored->getContent( 'layers' )->getText(), true );
		}
		$pilot = $this->pilot;
		$label = $selector === 'on' ? 'Default' : $selector;
		$id = NewPageDrawing::surfaceId( $page->getId(), $revision, $label,
			$file ? $file->getTitle()->getPrefixedDBkey() : null );
		return [ 'page' => $page, 'revision' => $revision, 'id' => $id, 'start' => strlen( $prefix ),
			'expected' => $embed, 'pilot' => $pilot, 'document' => $document, 'file' => $file, 'label' => $label ];
	}

	private function nativeReader(): PageReadService {
		return TestingAccessWrapper::newFromObject( $this->pilot )->reader;
	}

	private function service( array $f, ?PageReadService $reader = null ): PageWorkingCopyImportCreationService {
		$s = $this->getServiceContainer();
		$identities = new PageOwnedIdentityResolver( $s->getTitleFactory(), $s->getRevisionLookup(),
			new PageHistoryAccess( $s->getRevisionLookup() ) );
		$native = $this->nativeReader();
		$creation = new PageWorkingCopyImportCreationTarget( $f['pilot'], $identities,
			$s->getRevisionLookup(), $native );
		$stored = new PageWorkingCopyImportReadService( $identities, $s->getTitleFactory(), $native,
			$f['pilot']->getScope() );
		return new PageWorkingCopyImportCreationService( $creation, $reader ?? $native, $stored,
			$this->registration['publisher'], $s->getTitleFactory(), $f['pilot']->getScope(),
			$s->getConnectionProvider() );
	}

	private function pair( string $kind = 'slide', bool $slot = false, string $selector = 'ABC' ): array {
		$f = $this->fixture( $kind, $slot, $selector );
		$new = $f['pilot']->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$member = $f['document']['surfaces'][0];
		$member['label'] = $f['label'];
		$member['kind'] = $kind;
		if ( $kind === 'image' ) {
			$member['source'] = $new['source'];
			$member['canvas'] = $new['canvas'];
		} else {
			$member['canvas']['width'] = 500;
			$member['canvas']['height'] = 280;
		}
		$member['layers'][0]['text'] = 'Independent native source';
		$document = [ 'schemaVersion' => 1, 'surfaces' => [ $member ] ];
		$source = $this->getExistingTestPage();
		$sourceRevision = $this->registration['publisher']->publish( $source->getTitle(), $this->actor,
			$source->getLatest(), JsonSnapshotCodec::encode( $document ), 'Isolated source setup' );
		$f['sourcePage'] = $source;
		$f['source'] = [ 'sourcePageId' => $source->getId(), 'sourceRevisionId' => $sourceRevision,
			'sourceSurfaceId' => $member['id'] ];
		$f['sourceDocument'] = $document;
		$f['newSurface'] = $new;
		$f['proposed'] = $slot ? $f['document'] : [ 'schemaVersion' => 1, 'surfaces' => [] ];
		$new['canvas'] = $member['canvas'];
		$new['layers'] = $member['layers'];
		$new['readingOrder'] = $member['readingOrder'];
		$new['layers'][0]['text'] .= ' with newer local edits';
		$f['proposed']['surfaces'][] = $new;
		return $f;
	}

	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, $this->posted, $session );
	}

	private function params( array $f, bool $write = false ): array {
		$params = [ 'action' => $write ? 'layersworkingcopyimportcreationpublish' :
			'layersworkingcopyimportcreationread', 'formatversion' => 2,
			'targetpageid' => $f['page']->getId(), 'baserevid' => $f['revision'], 'targetsurface' => $f['id'],
			'embedstart' => $f['start'], 'embedtext' => $f['expected'] ];
		return $write ? $params + [ 'data' => JsonSnapshotCodec::encode( $f['proposed'] ),
			'importsources' => JsonSnapshotCodec::encode( [ $f['source'] ] ), 'summary' => 'Owner note 世界' ] :
			$params + [ 'sourcepageid' => $f['source']['sourcePageId'],
				'sourcerevid' => $f['source']['sourceRevisionId'], 'sourcesurface' => $f['source']['sourceSurfaceId'],
				'maxage' => 3600, 'smaxage' => 3600 ];
	}

	private function readRequest( array $params, ?Authority $actor = null ): array {
		$context = new RequestContext();
		$context->setRequest( new FauxRequest( $params, $this->posted ) );
		$context->setAuthority( $actor ?? $this->actor );
		$this->readMain = new ApiMain( $context, true );
		$this->readMain->execute();
		$formatter = new class( $this->readMain, 'json' ) extends ApiFormatJson {
			public string $output = '';

			public function printText( $text ) {
				$this->output .= $text;
			}
		};
		$formatter->execute();
		$this->assertStringNotContainsString( '_type', $formatter->output );
		return json_decode( $formatter->output, true, 64, JSON_THROW_ON_ERROR );
	}

	private function privatePolicy( ApiMain $main ): void {
		$this->assertSame( 'private', $main->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $main )->mCacheControl );
	}

	private function refused( array $params, bool $write = false,
		string $code = 'layers-working-copy-import-unavailable', ?Authority $actor = null,
		?string $token = 'csrf'
	): void {
		$this->runDeferredUpdates();
		$before = $this->witness();
		try {
			if ( $write ) {
				$this->doApiRequest( $params, null, false, $actor ?? $this->actor, $token );
			} else {
				$this->readRequest( $params, $actor );
			}
			$this->fail( 'Expected native creation Import refusal' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, $code ), $error->getMessage() );
			if ( !$write ) {
				$this->assertArrayNotHasKey( $params['action'], $this->readMain->getResult()->getResultData() );
				$this->privatePolicy( $this->readMain );
			}
		}
		$this->runDeferredUpdates();
		$this->assertSame( $before, $this->witness(), 'Ten complete fixture tables survive refusal' );
	}

	/** @return array */
	public static function provideTargets(): array {
		return [ [ 'slide', false ], [ 'slide', true ], [ 'image', false ], [ 'image', true ] ];
	}

	/** @dataProvider provideTargets @param string $kind @param bool $slot */
	public function testRegisteredReadAndFirstSavePreserveCompleteNativeState( string $kind, bool $slot ): void {
		$f = $this->pair( $kind, $slot );
		$before = $this->witness();
		$data = $this->readRequest( $this->params( $f ) )['layersworkingcopyimportcreationread'];
		$this->assertSame( [ 'creation', 'source', 'sourceBundle' ], array_keys( $data ) );
		$this->assertSame( $this->service( $f )->read( $f['page']->getId(), $f['revision'], $f['id'],
			$f['start'], $f['expected'], $f['source'], $this->actor ), $data );
		$this->assertSame( $slot, $data['creation']['hasLayersSlot'] );
		$this->assertSame( $slot ? $f['document'] : null, $data['creation']['baseBundle']['snapshot'] ?? null );
		$this->privatePolicy( $this->readMain );
		$this->assertSame( $before, $this->witness() );
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$base = $lookup->getRevisionById( $f['revision'] );
		$count = $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->caller( __METHOD__ )->fetchResultSet()->numRows();
		$result = $this->doApiRequestWithToken( $this->params( $f, true ), null, $this->actor )[0]
			['layersworkingcopyimportcreationpublish'];
		$this->assertSame( [ 'result', 'revid' ], array_keys( $result ) );
		$this->assertSame( 'Success', $result['result'] );
		$revision = $lookup->getRevisionById( $result['revid'], IDBAccessObject::READ_LATEST );
		$this->assertSame( $f['page']->getId(), $revision->getPageId() );
		$this->assertSame( $f['revision'], $revision->getParentId() );
		$this->assertSame( $this->actor->getUser()->getId(), $revision->getUser()->getId() );
		$this->assertSame( $base->getContent( 'main' )->serialize(), $revision->getContent( 'main' )->serialize() );
		$this->assertSame( JsonSnapshotCodec::encode( $f['proposed'] ),
			$revision->getContent( 'layers' )->serialize() );
		$this->assertSame( $count + 1, $this->getDb()->newSelectQueryBuilder()->select( '*' )->from( 'revision' )
			->caller( __METHOD__ )->fetchResultSet()->numRows() );
		$summary = wfMessage( 'layers-copy-summary' )->plaintextParams( $f['label'] )
			->params( $f['sourcePage']->getTitle()->getPrefixedText(), (string)$f['source']['sourceRevisionId'] )
			->inContentLanguage()->text() . ': Owner note 世界';
		$this->assertSame( $summary, $revision->getComment()->text );
		$this->assertSame( JsonSnapshotCodec::encode( $f['sourceDocument'] ),
			$lookup->getRevisionById( $f['source']['sourceRevisionId'] )->getContent( 'layers' )->serialize() );
	}

	public function testReadCachePolicyAndAliasesRemainNativeAndPrivate(): void {
		$f = $this->pair();
		$definitions = PageOwnedPilotRegistration::apiModules();
		$this->overrideConfigValue( 'APIModules', array_replace(
			$this->getServiceContainer()->getMainConfig()->get( 'APIModules' ),
			[ 'creationreadalias' => $definitions['layersworkingcopyimportcreationread'] ] ) );
		$params = array_replace( $this->params( $f ), [ 'action' => 'creationreadalias' ] );
		$data = $this->readRequest( $params );
		$this->assertArrayHasKey( 'creationreadalias', $data );
		$this->assertArrayNotHasKey( 'layersworkingcopyimportcreationread', $data );
		$this->privatePolicy( $this->readMain );
	}

	public function testPostTokenPermissionAndParameterGuards(): void {
		$f = $this->pair();
		$this->refused( $this->params( $f, true ), true, 'missingparam', null, null );
		$this->posted = false;
		$this->refused( $this->params( $f ), false, 'mustbeposted' );
		$this->refused( $this->params( $f, true ), true, 'mustbeposted' );
		$this->posted = true;
		$reader = $this->getTestUser( [ 'user' ] )->getUser();
		$this->overrideUserPermissions( $reader, [ 'read' ] );
		$this->refused( $this->params( $f ), false, 'layers-working-copy-import-unavailable', $reader );
		$this->refused( $this->params( $f, true ), true, 'permissiondenied', $reader );
		$params = $this->params( $f );
		unset( $params['embedtext'] );
		$this->refused( $params, false, 'missingparam' );
		$this->refused( array_replace( $this->params( $f ), [ 'embedstart' => -1 ] ), false, 'outofrange' );
		$this->refused( array_replace( $this->params( $f, true ),
			[ 'importsources' => str_repeat( ' ', 16385 ) ] ), true, 'maxbytes' );
	}

	public function testNativeSaveLimiterRefusesBeforePublication(): void {
		$f = $this->pair();
		$entered = false;
		$this->setTemporaryHook( 'PingLimiter', static function ( $user, $action, &$result ) use ( &$entered ) {
			if ( $action === 'editlayers-save' ) {
				$entered = true;
				$result = true;
				return false;
			}
			return true;
		}, false );
		$this->refused( $this->params( $f, true ), true, 'ratelimited' );
		$this->assertTrue( $entered, 'Actual native limiter hook must run' );
	}

	public function testDuplicateEscapedDescriptorKeyRefusesBeforeSave(): void {
		$f = $this->pair();
		$params = $this->params( $f, true );
		$id = $f['source']['sourcePageId'];
		$params['importsources'] = str_replace( '"sourcePageId":' . $id,
			'"sourcePageId":' . $id . ',"sourcePage\\u0049d":' . $id, $params['importsources'] );
		$this->refused( $params, true );
	}

	/** @return array */
	public static function provideMalformedSources(): array {
		return [ [ 'null' ], [ '{}' ], [ '[]' ], [ '[[]]' ], [ '[' ], [ '[true]' ] ];
	}

	/** @dataProvider provideMalformedSources @param string $json */
	public function testMalformedClaimsRefuseWithoutWrites( string $json ): void {
		$f = $this->pair();
		$this->refused( array_replace( $this->params( $f, true ), [ 'importsources' => $json ] ), true );
	}

	public function testWrongEmbeddingForeignSourceAndFabricatedIdentityRefuse(): void {
		$f = $this->pair();
		foreach ( [ [ 'embedtext' => $f['expected'] . ' forged' ], [ 'embedstart' => 0 ],
			[ 'targetsurface' => 'forged' ], [ 'sourcerevid' => $f['revision'] ],
			[ 'sourcepageid' => $f['page']->getId() ] ] as $change ) {
			$this->refused( array_replace( $this->params( $f ), $change ) );
		}
		$this->refused( array_replace( $this->params( $f, true ), [ 'maintext' => '' ] ), true );
	}

	public function testStaleSavePreservesNewerNativeRevision(): void {
		$f = $this->pair();
		$this->editPage( $f['page'], $f['expected'] . ' concurrent native change' );
		$this->refused( $this->params( $f, true ), true );
	}

	public function testLateSourceSuppressionRollsBackThroughRegisteredSave(): void {
		$f = $this->pair();
		$entered = false;
		$caller = __METHOD__;
		$this->setTemporaryHook( 'RevisionFromEditComplete', function () use ( &$entered, $f, $caller ) {
			if ( !$entered ) {
				$entered = true;
				$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' =>
					RevisionRecord::DELETED_TEXT | RevisionRecord::DELETED_RESTRICTED ] )
					->where( [ 'rev_id' => $f['source']['sourceRevisionId'] ] )->caller( $caller )->execute();
			}
			return true;
		}, false );
		$this->refused( $this->params( $f, true ), true );
		$this->assertTrue( $entered );
		$this->assertSame( 'Success', $this->doApiRequestWithToken( $this->params( $f, true ), null,
			$this->actor )[0]['layersworkingcopyimportcreationpublish']['result'] );
	}

	public function testFactoriesAndWholeRegistryCollisionPreserveExistingContracts(): void {
		$definitions = PageOwnedPilotRegistration::apiModules();
		$main = new ApiMain( new FauxRequest() );
		$this->assertSame( ApiLayersWorkingCopyImportCreationRead::class,
			$definitions['layersworkingcopyimportcreationread']['class'] );
		$this->assertSame( ApiLayersWorkingCopyImportCreationPublish::class,
			$definitions['layersworkingcopyimportcreationpublish']['class'] );
		foreach ( [ 'layersworkingcopyimportcreationread', 'layersworkingcopyimportcreationpublish' ] as $name ) {
			$module = ( $definitions[$name]['factory'] )( $main, $name );
			$this->assertSame( $name, $module->getModuleName() );
			$this->privatePolicy( $main );
			$this->assertTrue( $module->mustBePosted() );
			$isWrite = str_ends_with( $name, 'publish' );
			$this->assertSame( $isWrite, $module->isWriteMode() );
			if ( $isWrite ) {
				$this->assertSame( 'csrf', $module->needsToken() );
			}
			$native = TestingAccessWrapper::newFromObject( $module );
			$service = TestingAccessWrapper::newFromObject( $isWrite ? $native->publisher : $native->reader );
			$livePilot = $this->getServiceContainer()->getService( 'LayersPageOwnedPilot' );
			$this->assertSame( $livePilot->getScope(), $service->scope );
			$this->assertSame( TestingAccessWrapper::newFromObject( $livePilot )->reader, $service->reader );
			$this->assertSame( $livePilot, TestingAccessWrapper::newFromObject( $service->creation )->pilot );
			$modules = [ $name => 'UnrelatedModule', 'unrelated' => 'Preserved' ];
			$this->setMwGlobals( [ 'wgAPIModules' => $modules ] );
			try {
				PageOwnedPilotRegistration::onRegistration( [] );
				$this->fail( 'Expected complete registration refusal' );
			} catch ( \LogicException $error ) {
				$this->assertSame( $modules, $GLOBALS['wgAPIModules'] );
			}
		}
		$this->assertSame( [ 'targetpageid', 'baserevid', 'targetsurface', 'sourcepageid',
			'sourcerevid', 'sourcesurface' ], array_keys(
			$this->pilot->newWorkingCopyImportReadApi( $main, 'oldread' )->getAllowedParams() ) );
	}
}
