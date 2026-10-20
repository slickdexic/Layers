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
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportRead
 * @covers \MediaWiki\Extension\Layers\Api\ApiLayersWorkingCopyImportCreationDraftRebase
 * Exact saved Import and historical draft transport preserve complete native data.
 * @group Database
 * @group API
 */
class ImportExactTextTest extends \MediaWiki\Tests\Api\ApiTestCase {

	use IsolatedLocalRepoFixture;

	private Authority $actor;
	private PageOwnedPilot $pilot;
	private ?ApiMain $readMain = null;
	private array $wire = [];

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
		$context->setRequest( new FauxRequest( $params, $params['action'] !== 'layersworkingcopyimportread' ) );
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
		$this->wire = $result;
		if ( !$exact || !isset( $result['version'] ) ) {
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

	private function storedParams( array $f ): array {
		return [ 'action' => 'layersworkingcopyimportread', 'formatversion' => 2,
			'targetpageid' => $f['page']->getId(), 'baserevid' => $f['revision'],
			'targetsurface' => $f['baseDocument']['surfaces'][0]['id'],
			'sourcepageid' => $f['source']['sourcePageId'], 'sourcerevid' => $f['source']['sourceRevisionId'],
			'sourcesurface' => $f['source']['sourceSurfaceId'] ];
	}

	private function draftParams( array $f ): array {
		$prefix = "Current e\u{0301} π\n";
		$current = $f['baseDocument'] !== null ? $this->publishFixture( $f['page'], $f['revision'],
			$f['baseDocument'], $prefix . $f['embed'] ) :
			$this->editPage( $f['page'], $prefix . $f['embed'] )->getNewRevision()->getId();
		return [ 'action' => 'layersworkingcopyimportcreationdraftrebase', 'formatversion' => 2,
			'targetpageid' => $f['page']->getId(), 'baserevid' => $current,
			'originrevid' => $f['revision'], 'originsurface' => $f['surfaceId'] ];
	}

	public function testExactStoredReadPreservesCompleteSnapshots(): void {
		$f = $this->fixture( 'slide', true );
		$before = $this->state();
		$data = $this->readRequest( $this->storedParams( $f ) );
		$this->assertSame( JsonSnapshotCodec::encode( $f['baseDocument'] ),
			JsonSnapshotCodec::encode( $data['targetBundle']['snapshot'] ) );
		$this->assertSame( JsonSnapshotCodec::encode( $f['sourceDocument'] ),
			JsonSnapshotCodec::encode( $data['sourceBundle']['snapshot'] ) );
		$this->assertSame( $f['revision'], $data['target']['revisionId'] );
		$this->assertSame( $before, $this->state() );
	}

	/** @return array */
	public static function provideSlots(): array {
		return [ [ false ], [ true ] ];
	}

	/** @dataProvider provideSlots @param bool $slot */
	public function testExactDraftRebasePreservesHistoricalWitnessAndSiblings( bool $slot ): void {
		$f = $this->fixture( 'image', $slot );
		$params = $this->draftParams( $f );
		$expected = $this->pilot->prepareCreationDraftRebase( $params['targetpageid'], $params['baserevid'],
			$params['originsurface'], $params['originrevid'], $this->actor );
		$before = $this->state();
		$data = $this->readRequest( $params );
		$this->assertSame( $f['embed'], $data['origin']['selection']['expected'] );
		$this->assertSame( JsonSnapshotCodec::encode( $expected ), JsonSnapshotCodec::encode( $data ) );
		$this->assertSame( $before, $this->state() );
	}

	/** @return array */
	public static function provideRoutes(): array {
		return [ [ false ], [ true ] ];
	}

	/** @dataProvider provideRoutes @param bool $draft */
	public function testLegacyShapeAndStrictExactEnvelope( bool $draft ): void {
		$f = $this->fixture( $draft ? 'image' : 'slide', true );
		$params = $draft ? $this->draftParams( $f ) : $this->storedParams( $f );
		$before = $this->state();
		$legacy = $this->readRequest( $params, false );
		$this->assertSame( $draft ? [ 'origin', 'creation' ] :
			[ 'target', 'source', 'targetBundle', 'sourceBundle' ], array_keys( $legacy ) );
		$this->readRequest( $params );
		$this->assertSame( [ 'version', 'data' ], array_keys( $this->wire ) );
		$this->assertSame( 1, $this->wire['version'] );
		$this->assertSame( 0, preg_match( '/[^\x00-\x7f]/', $this->wire['data'] ) );
		$this->assertSame( $before, $this->state() );
	}

	/** @dataProvider provideRoutes @param bool $draft */
	public function testExactCapacityRefusesWithoutPartialPayloadOrWrites( bool $draft ): void {
		$f = $this->fixture( $draft ? 'image' : 'slide', true );
		$params = $draft ? $this->draftParams( $f ) : $this->storedParams( $f );
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
}
