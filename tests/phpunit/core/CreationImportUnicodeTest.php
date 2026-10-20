<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiFormatJson;
use MediaWiki\Api\ApiMain;
use MediaWiki\Api\ApiUsageException;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\PageOwnedPilotRegistration;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\NewPageDrawing;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\TestingAccessWrapper;

require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Literal content must survive creation Import and historical admission unchanged.
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRead
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationPublish
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationRebase
 * @group Database
 * @group API
 */
class CreationImportUnicodeTest extends \MediaWiki\Tests\Api\ApiTestCase {

	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private PageOwnedPilot $pilot;
	private ?ApiMain $readMain = null;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->setContentLang( 'en' );
		$this->overrideConfigValue( 'LayersPageDrawingNamespaces', [ NS_MAIN ] );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		MigrationState::markComplete( $this->getDb() );
		$services = $this->getServiceContainer();
		$this->overrideConfigValue( 'APIModules', array_replace( $services->getMainConfig()->get( 'APIModules' ),
			PageOwnedPilotRegistration::apiModules() ) );
		$this->pilot = $services->getService( 'LayersPageOwnedPilot' );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	protected function buildFauxRequest( $params, $session ) {
		return new FauxRequest( $params, true, $session );
	}

	private function text(): string {
		return "NFD e\u{0301} / NFC \u{00E9} / \u{65E5}\u{672C}";
	}

	private function publishFixture( $page, int $base, array $document, ?string $main = null ): int {
		$publisher = TestingAccessWrapper::newFromObject( $this->pilot )->publisher;
		return $publisher->publish( $page->getTitle(), $this->actor, $base,
			JsonSnapshotCodec::encode( $document ), 'Isolated Unicode fixture',
			$main !== null ? new WikitextContent( $main ) : null );
	}

	private function revision( int $id ) {
		return $this->getServiceContainer()->getRevisionLookup()->getRevisionById(
			$id, IDBAccessObject::READ_LATEST );
	}

	private function fixture( string $kind, bool $slot ): array {
		$fileTitle = null;
		if ( $kind === 'image' ) {
			$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
			self::guardIsolatedFixtureRepository( $repo );
			$title = $this->getServiceContainer()->getTitleFactory()->newFromText(
				'File:Creation-Unicode-' . wfRandomString( 8 ) . '.png' );
			$file = $repo->newFile( $title );
			$input = $this->getNewTempFile();
			copy( __DIR__ . '/../../fixtures/assets/test-image.png', $input );
			$this->assertStatusGood( $file->upload( $input, 'Isolated creation Unicode fixture', 'Fixture',
				0, false, '20260906120000', $this->getTestSysop()->getUser() ) );
			$fileTitle = $file->getTitle()->getPrefixedDBkey();
		}
		$embed = $fileTitle ? '[[' . $fileTitle . '|layerset=ABC|Caption ' . $this->text() . ']]' :
			'{{#Slide:ABC}}';
		$prefix = "Préface e\u{0301} π\n";
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $prefix . $embed )->getNewRevision()->getId();
		$baseDocument = json_decode( file_get_contents(
			__DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true, 16, JSON_THROW_ON_ERROR );
		$baseDocument['surfaces'][0]['label'] = 'Preserved sibling';
		$baseDocument['surfaces'][0]['layers'][0]['text'] = $this->text() . ' sibling';
		if ( $slot ) {
			$revision = $this->publishFixture( $page, $revision, $baseDocument );
			$baseDocument = json_decode( $this->revision( $revision )->getContent( PageRevisionWriter::SLOT )
				->serialize(), true, 16, JSON_THROW_ON_ERROR );
		}
		$this->assertSame( $prefix . $embed, $this->revision( $revision )->getContent( 'main' )->serialize(),
			'Fixture must actually store the intended Unicode bytes before testing a request' );
		$id = NewPageDrawing::surfaceId( $page->getId(), $revision, 'ABC', $fileTitle );
		$new = $this->pilot->prepareBoundEditor( $page->getId(), $revision, strlen( $prefix ), $embed,
			$this->actor )['pageOwned']['newSurface'];
		$this->assertSame( $id, $new['id'] );
		$sourceMember = $baseDocument['surfaces'][0];
		$sourceMember['label'] = 'ABC';
		$sourceMember['kind'] = $kind;
		if ( $kind === 'image' ) {
			$sourceMember['source'] = $new['source'];
			$sourceMember['canvas'] = $new['canvas'];
		}
		$sourceMember['layers'][0]['text'] = $this->text() . ' source';
		$sourcePage = $this->getExistingTestPage();
		$sourceDocument = [ 'schemaVersion' => 1, 'surfaces' => [ $sourceMember ] ];
		$sourceRevision = $this->publishFixture( $sourcePage, $sourcePage->getLatest(), $sourceDocument );
		$new['layers'] = $sourceMember['layers'];
		$new['readingOrder'] = $sourceMember['readingOrder'];
		$new['layers'][0]['text'] .= ' with local edits';
		$proposed = $slot ? $baseDocument : [ 'schemaVersion' => 1, 'surfaces' => [] ];
		$proposed['surfaces'][] = $new;
		return [ 'page' => $page, 'revision' => $revision, 'surfaceId' => $id,
			'prefix' => $prefix, 'embed' => $embed, 'start' => strlen( $prefix ), 'fileTitle' => $fileTitle,
			'baseDocument' => $slot ? $baseDocument : null, 'proposed' => $proposed,
			'sourcePage' => $sourcePage, 'sourceDocument' => $sourceDocument,
			'source' => [ 'sourcePageId' => $sourcePage->getId(), 'sourceRevisionId' => $sourceRevision,
				'sourceSurfaceId' => $sourceMember['id'] ] ];
	}

	private function params( array $fixture, bool $write = false ): array {
		$params = [ 'action' => $write ? 'layersworkingcopyimportcreationpublish' :
			'layersworkingcopyimportcreationread', 'formatversion' => 2,
			'targetpageid' => $fixture['page']->getId(), 'baserevid' => $fixture['revision'],
			'targetsurface' => $fixture['surfaceId'], 'embedstart' => $fixture['start'],
			'embedtext' => $fixture['embed'] ];
		return $write ? $params + [ 'data' => JsonSnapshotCodec::encode( $fixture['proposed'] ),
			'importsources' => JsonSnapshotCodec::encode( [ $fixture['source'] ] ), 'summary' => 'Owner note' ] :
			$params + [ 'sourcepageid' => $fixture['source']['sourcePageId'],
				'sourcerevid' => $fixture['source']['sourceRevisionId'],
				'sourcesurface' => $fixture['source']['sourceSurfaceId'], 'maxage' => 3600, 'smaxage' => 3600 ];
	}

	private function readRequest( array $params, bool $exact = true ): array {
		if ( $exact ) {
			$params['exacttext'] = true;
		}
		$context = new RequestContext();
		$context->setRequest( new FauxRequest( $params, true ) );
		$context->setAuthority( $this->actor );
		$this->readMain = new ApiMain( $context, true );
		$this->readMain->execute();
		$formatter = new class( $this->readMain, 'json' ) extends ApiFormatJson {
			public string $output = '';

			public function printText( $text ) {
				$this->output .= $text;
			}
		};
		$formatter->execute();
		$this->assertSame( 'private', $this->readMain->getCacheMode() );
		$this->assertSame( [ 'max-age' => 0, 's-maxage' => 0 ],
			TestingAccessWrapper::newFromObject( $this->readMain )->mCacheControl );
		$result = json_decode( $formatter->output, true, 64, JSON_THROW_ON_ERROR )[$params['action']];
		if ( !$exact ) {
			return $result;
		}
		$this->assertSame( [ 'version', 'data' ], array_keys( $result ) );
		$this->assertSame( 1, $result['version'] );
		$this->assertSame( 0, preg_match( '/[^\x00-\x7f]/', $result['data'] ), 'Exact transport is ASCII JSON' );
		return json_decode( $result['data'], true, 64, JSON_THROW_ON_ERROR );
	}

	private function state(): string {
		$this->runDeferredUpdates();
		$state = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage',
			'comment', 'change_tag', 'change_tag_def' ] as $table ) {
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
		return serialize( $state );
	}

	/** @return array */
	public static function provideSlots(): array {
		return [ 'absent slot' => [ false ], 'unrelated sibling' => [ true ] ];
	}

	/** @return array */
	public static function provideTargets(): array {
		return [ [ 'image', false ], [ 'image', true ], [ 'slide', false ], [ 'slide', true ] ];
	}

	/** @dataProvider provideSlots @param bool $slot */
	public function testUnicodeImageReadPreservesExactEmbedding( bool $slot ): void {
		$f = $this->fixture( 'image', $slot );
		$before = $this->state();
		try {
			$data = $this->readRequest( $this->params( $f ) );
		} catch ( ApiUsageException $error ) {
			$this->fail( 'Literal Unicode embedding must reach native read: ' . $error->getMessage() );
		}
		$this->assertSame( [ 'start' => $f['start'], 'expected' => $f['embed'] ],
			$data['creation']['selection'] );
		$this->assertSame( $f['baseDocument'], $data['creation']['baseBundle']['snapshot'] ?? null );
		$this->assertSame( JsonSnapshotCodec::encode( $f['sourceDocument'] ),
			JsonSnapshotCodec::encode( $data['sourceBundle']['snapshot'] ) );
		$this->assertSame( $before, $this->state() );
	}

	/** @dataProvider provideTargets @param string $kind @param bool $slot */
	public function testUnicodeFirstSavePreservesCompleteContent( string $kind, bool $slot ): void {
		$f = $this->fixture( $kind, $slot );
		$params = $this->params( $f, true );
		try {
			$result = $this->doApiRequestWithToken( $params, null, $this->actor )[0]
				['layersworkingcopyimportcreationpublish'];
		} catch ( ApiUsageException $error ) {
			$this->fail( 'Literal Unicode first Save must succeed: ' . $error->getMessage() );
		}
		$this->assertSame( 'Success', $result['result'] );
		$revision = $this->revision( $result['revid'] );
		$this->assertSame( $f['page']->getId(), $revision->getPageId() );
		$this->assertSame( $f['revision'], $revision->getParentId() );
		$this->assertSame( $this->actor->getUser()->getId(), $revision->getUser()->getId() );
		$this->assertSame( $f['prefix'] . $f['embed'], $revision->getContent( 'main' )->serialize() );
		$this->assertSame( JsonSnapshotCodec::encode( $f['proposed'] ),
			$revision->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame( JsonSnapshotCodec::encode( $f['sourceDocument'] ),
			$this->revision( $f['source']['sourceRevisionId'] )->getContent( PageRevisionWriter::SLOT )->serialize() );
		$this->assertSame( $f['source']['sourceRevisionId'], $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $f['sourcePage']->getTitle(), 0, IDBAccessObject::READ_LATEST )->getId() );
		$summary = wfMessage( 'layers-copy-summary' )->plaintextParams( 'ABC' )
			->params( $f['sourcePage']->getTitle()->getPrefixedText(), (string)$f['source']['sourceRevisionId'] )
			->inContentLanguage()->text() . ': Owner note';
		$this->assertSame( $summary, $revision->getComment()->text );
	}

	/** @dataProvider provideSlots @param bool $slot */
	public function testUnicodeHistoricalRebasePreservesExactWitness( bool $slot ): void {
		$f = $this->fixture( 'image', $slot );
		$prefix = "Newer π e\u{0301} heading\n";
		$current = $slot ? $this->publishFixture( $f['page'], $f['revision'], $f['baseDocument'],
			$prefix . $f['embed'] ) :
			$this->editPage( $f['page'], $prefix . $f['embed'] )->getNewRevision()->getId();
		$this->assertSame( $prefix . $f['embed'], $this->revision( $current )->getContent( 'main' )->serialize() );
		$params = [ 'action' => 'layersworkingcopyimportcreationrebase', 'formatversion' => 2,
			'targetpageid' => $f['page']->getId(), 'baserevid' => $current, 'targetsurface' => $f['surfaceId'],
			'originrevid' => $f['revision'], 'originstart' => $f['start'], 'origintext' => $f['embed'] ];
		$before = $this->state();
		try {
			$data = $this->readRequest( $params );
		} catch ( ApiUsageException $error ) {
			$this->fail( 'Literal Unicode origin must prove native history: ' . $error->getMessage() );
		}
		$this->assertSame( [ 'start' => $f['start'], 'expected' => $f['embed'] ], $data['origin']['selection'] );
		$this->assertSame( $f['page']->getId(), $data['origin']['pageId'] );
		$this->assertSame( $f['revision'], $data['origin']['revisionId'] );
		$this->assertSame( $f['surfaceId'], $data['origin']['surfaceId'] );
		$this->assertSame( [ 'start' => strlen( $prefix ), 'expected' => $f['embed'] ],
			$data['creation']['selection'] );
		$this->assertSame( NewPageDrawing::surfaceId( $f['page']->getId(), $current, 'ABC', $f['fileTitle'] ),
			$data['creation']['newSurface']['id'] );
		$this->assertSame( $f['baseDocument'], $data['creation']['baseBundle']['snapshot'] ?? null );
		$this->assertSame( $before, $this->state() );
	}

	public function testLegacyDefaultResponseRemainsCompatible(): void {
		$f = $this->fixture( 'slide', false );
		$before = $this->state();
		$data = $this->readRequest( $this->params( $f ), false );
		$this->assertSame( [ 'creation', 'source', 'sourceBundle' ], array_keys( $data ) );
		$this->assertSame( $f['source']['sourceRevisionId'], $data['source']['revisionId'] );
		$this->assertSame( $f['surfaceId'], $data['creation']['newSurface']['id'] );
		$this->assertSame( $before, $this->state() );
	}

	/** @return array */
	public static function provideExactRoutes(): array {
		return [ [ false ], [ true ] ];
	}

	/** @dataProvider provideExactRoutes @param bool $rebase */
	public function testExactResponseCapacityRefusesWithoutPartialData( bool $rebase ): void {
		$f = $this->fixture( 'image', true );
		$params = $rebase ? [ 'action' => 'layersworkingcopyimportcreationrebase', 'formatversion' => 2,
			'targetpageid' => $f['page']->getId(), 'baserevid' => $f['revision'], 'targetsurface' => $f['surfaceId'],
			'originrevid' => $f['revision'], 'originstart' => $f['start'], 'origintext' => $f['embed'] ] :
			$this->params( $f );
		$this->overrideConfigValue( 'APIMaxResultSize', 1 );
		$before = $this->state();
		try {
			$this->readRequest( $params );
			$this->fail( 'Oversized exact response must refuse' );
		} catch ( ApiUsageException $error ) {
			$this->assertTrue( self::apiExceptionHasCode( $error, 'layers-working-copy-import-unavailable' ) );
		}
		$this->assertArrayNotHasKey( $params['action'], $this->readMain->getResult()->getResultData() );
		$this->assertSame( $before, $this->state() );
	}

	public function testUnicodeRefusalsPreserveAllTablesAndLimits(): void {
		$f = $this->fixture( 'image', true );
		foreach ( [
			[ array_replace( $this->params( $f ), [ 'embedtext' => str_repeat( ' ', 2097153 ) ] ), 'maxbytes' ],
			[ array_replace( $this->params( $f, true ), [ 'embedtext' => str_repeat( ' ', 2097153 ) ] ), 'maxbytes' ],
			[ array_replace( $this->params( $f, true ), [ 'data' => str_repeat( ' ', 2097153 ) ] ), 'maxbytes' ],
			[ array_replace( $this->params( $f ), [ 'embedstart' => $f['start'] + 1 ] ),
				'layers-working-copy-import-unavailable' ],
			[ array_replace( $this->params( $f, true ), [ 'embedtext' => $f['embed'] . ' forged' ] ),
				'layers-working-copy-import-unavailable' ],
			[ array_replace( $this->params( $f, true ), [ 'data' => '{}' ] ),
				'layers-working-copy-import-unavailable' ]
		] as [ $params, $code ] ) {
			$before = $this->state();
			try {
				$this->doApiRequest( $params, null, false, $this->actor,
					str_ends_with( $params['action'], 'publish' ) ? 'csrf' : null );
				$this->fail( 'Invalid creation request must refuse without writing' );
			} catch ( ApiUsageException $error ) {
				$this->assertTrue( self::apiExceptionHasCode( $error, $code ), $error->getMessage() );
			}
			$this->assertSame( $before, $this->state() );
		}
	}
}
