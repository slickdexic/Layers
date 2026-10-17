<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage;
use MediaWiki\Permissions\Authority;
use MediaWiki\Request\FauxRequest;
use RequestContext;

require_once __DIR__ . '/TestingAdmissionRegistration.php';
require_once __DIR__ . '/IsolatedLocalRepoFixture.php';

/**
 * Native Special:EditLayersPage composition for missing PDF layer sets.
 * @covers \MediaWiki\Extension\Layers\SpecialPages\SpecialEditLayersPage
 * @group Database
 */
class SpecialEditLayersPagePdfCreationTest extends \MediaWikiIntegrationTestCase {

	use IsolatedLocalRepoFixture;

	private array $registration;
	private Authority $actor;
	private PageOwnedPilot $pilot;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpIsolatedLocalRepoFixture();
		$this->overrideConfigValue( 'PdfHandlerDpi', 150 );
		$this->registration = TestingAdmissionRegistration::install( $this );
		$this->actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$this->assertStringContainsString( 'unittest', $this->getDb()->getDomainID() );
		MigrationState::markComplete( $this->getDb() );
		$this->pilot = new PageOwnedPilot( $this->getServiceContainer(), [], [ NS_MAIN ] );
	}

	protected function tearDown(): void {
		MigrationState::clear( $this->getDb() );
		parent::tearDown();
	}

	private function fixture( int $pageNumber = 2, bool $slot = false ): array {
		$repo = $this->getServiceContainer()->getRepoGroup()->getLocalRepo();
		self::guardIsolatedFixtureRepository( $repo );
		$fileTitle = $this->getServiceContainer()->getTitleFactory()->newFromText(
			'File:SpecialPdfCreation-' . wfRandomString( 8 ) . '.pdf' );
		$file = $repo->newFile( $fileTitle );
		$this->assertTrue( $file->upload( __DIR__ . '/../../fixtures/assets/test-multipage.pdf',
			'Isolated PDF editor fixture', 'Fixture only', 0, false, '20260906120000',
			$this->getTestSysop()->getUser() )->isOK() );
		$prefix = "Préface π\n";
		$expected = '[[' . $fileTitle->getPrefixedDBkey() . '|page=' . $pageNumber .
			'|layerset=ABC|Plain caption]]';
		$page = $this->getExistingTestPage();
		$revision = $this->editPage( $page, $prefix . $expected )->getNewRevision()->getId();
		$base = null;
		if ( $slot ) {
			$document = file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' );
			$revision = $this->registration['publisher']->publish( $page->getTitle(), $this->actor,
				$revision, $document, 'Preserve unrelated sibling' );
			$stored = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revision );
			$base = $stored->getContent( 'layers' )->serialize();
		}
		return [ 'file' => $file, 'page' => $page, 'revision' => $revision,
			'start' => strlen( $prefix ), 'expected' => $expected, 'main' => $prefix . $expected, 'base' => $base ];
	}

	private function witness(): string {
		$tables = [];
		foreach ( [ 'page', 'revision', 'slots', 'content', 'text', 'image', 'oldimage' ] as $table ) {
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

	private function execute( array $fixture, array $overrides = [] ): array {
		$params = array_replace( [ 'pageid' => (string)$fixture['page']->getId(),
			'revid' => (string)$fixture['revision'], 'start' => (string)$fixture['start'],
			'expected' => $fixture['expected'] ], $overrides );
		$context = new RequestContext();
		$context->setAuthority( $this->actor );
		$context->setTitle( $this->getServiceContainer()->getTitleFactory()->newFromText( 'Special:EditLayersPage' ) );
		$context->setRequest( new FauxRequest( $params + [ 'returnto' => 'https://external.invalid/' ] ) );
		$page = new SpecialEditLayersPage( $this->pilot );
		$page->setContext( $context );
		$page->execute( null );
		return $context->getOutput()->getJsConfigVars();
	}

	public static function provideInitialPagesAndBases(): array {
		return [ [ 1, false ], [ 2, false ], [ 1, true ], [ 2, true ] ];
	}

	/** @dataProvider provideInitialPagesAndBases */
	public function testBoundMissingPdfComposesExactNativePreparation( int $pageNumber, bool $slot ): void {
		$f = $this->fixture( $pageNumber, $slot );
		$before = $this->witness();
		$config = $this->execute( $f );
		$this->assertSame( $before, $this->witness() );
		$this->assertArrayHasKey( 'wgLayersEditorInit', $config );
		$this->assertSame( $f['page']->getTitle()->getPrefixedText(), $config['wgLayersEditorInit']['filename'] );
		$this->assertSame( $f['page']->getTitle()->getLocalURL(), $config['wgLayersReturnToUrl'] );
		$init = $config['wgLayersEditorInit'];
		$this->assertSame( $pageNumber, $init['page'] );
		$this->assertSame( 2, $init['pageCount'] );
		$this->assertSame( 'ABC', $init['initialSetName'] );
		$this->assertSame( $f['main'], $init['pageOwned']['pdfCreation']['mainText'] );
		$this->assertSame( $f['base'], $init['pageOwned']['pdfCreation']['baseText'] );
		$this->assertSame( $slot, $init['pageOwned']['pdfCreation']['hasLayersSlot'] );
		$pdf = $init['pageOwned']['pdfCreation'];
		$this->assertSame( $f['page']->getId(), $pdf['target']['pageId'] );
		$this->assertSame( $f['page']->getTitle()->getPrefixedDBkey(), $pdf['target']['owner'] );
		$this->assertSame( $f['revision'], $pdf['target']['revisionId'] );
		$this->assertSame( $init['pageOwned']['surfaceId'], $pdf['target']['surfaceId'] );
		$this->assertSame( $pageNumber, $pdf['context']['initialPage'] );
		$this->assertSame( $pageNumber, $pdf['context']['surface']['source']['page'] );
		$this->assertSame( $f['file']->getTimestamp(), $pdf['context']['surface']['source']['timestamp'] );
		$this->assertSame( $f['file']->getSha1(), $pdf['context']['surface']['source']['sha1'] );
		$this->assertSame( $pdf['context']['rendition']['url'], $init['imageUrl'] );
		$this->assertSame( $pdf['context']['surface']['canvas']['width'], $init['baseWidth'] );
		$this->assertSame( $pdf['context']['surface']['canvas']['height'], $init['baseHeight'] );
		$this->assertSame( $f['revision'], $this->getServiceContainer()->getRevisionLookup()
			->getRevisionById( $f['revision'] )->getId() );
		if ( $slot ) {
			$this->assertSame( json_decode( $f['base'], true ), $pdf['baseBundle']['snapshot'] );
		} else {
			$this->assertNull( $pdf['baseBundle'] );
		}
	}

	public function testStaleSelectionAndLostEditRightsEmitNoEditorConfig(): void {
		$f = $this->fixture();
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $this->execute( $f,
			[ 'expected' => '[[File:stale.pdf|page=2|layerset=ABC]]' ] ) );
		$this->overrideUserPermissions( $this->actor, [ 'read' ] );
		$this->assertArrayNotHasKey( 'wgLayersEditorInit', $this->execute( $f ) );
	}

	public function testSavedPdfRouteDoesNotReceiveMissingCreationPreparation(): void {
		$f = $this->fixture();
		$surface = $this->pilot->prepareBoundEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], $this->actor )['pageOwned']['newSurface'];
		$document = json_encode( [ 'schemaVersion' => 1, 'surfaces' => [ $surface ] ], JSON_THROW_ON_ERROR );
		$f['revision'] = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], $document, 'Create saved PDF layer set' );
		$config = $this->execute( $f );
		$this->assertArrayHasKey( 'wgLayersEditorInit', $config );
		$this->assertArrayNotHasKey( 'pdfCreation', $config['wgLayersEditorInit']['pageOwned'] );
		$this->assertArrayNotHasKey( 'newSurface', $config['wgLayersEditorInit']['pageOwned'] );
		$this->assertSame( $surface['id'], $config['wgLayersEditorInit']['pageOwned']['surfaceId'] );
	}

	public function testFirstPdfSavePublishesPreparedMembersAndRejectsStaleBase(): void {
		$f = $this->fixture( 2, true );
		$prepared = $this->pilot->prepareMissingPdfEditor( $f['page']->getId(), $f['revision'],
			$f['start'], $f['expected'], 1, $this->actor );
		$anchor = $prepared['anchorSurface'];
		$anchor['layers'] = [ [ 'id' => 'page-two-note', 'type' => 'text', 'x' => 10, 'y' => 20,
			'text' => 'Page two layer' ] ];
		$newMember = $prepared['context']['surface'];
		$newMember['layers'] = [ [ 'id' => 'page-one-note', 'type' => 'text', 'x' => 30, 'y' => 40,
			'text' => 'Page one layer' ] ];
		$baseSnapshot = json_decode( $f['base'], true, 512, JSON_THROW_ON_ERROR );
		$document = $baseSnapshot;
		$document['surfaces'][] = $anchor;
		$document['surfaces'][] = $newMember;
		$firstSave = json_encode( $document, JSON_THROW_ON_ERROR );
		$revisionCountBefore = $this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )->from( 'revision' )
			->where( [ 'rev_page' => $f['page']->getId() ] )->caller( __METHOD__ )->fetchField();

		$revisionId = $this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
			$f['revision'], $firstSave, 'Create both PDF page layers' );
		$saved = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $revisionId );
		$this->assertNotSame( $f['revision'], $revisionId );
		$this->assertSame( $f['revision'], $saved->getParentId() );
		$this->assertSame( (int)$revisionCountBefore + 1, (int)$this->getDb()->newSelectQueryBuilder()
			->select( 'COUNT(*)' )->from( 'revision' )->where( [ 'rev_page' => $f['page']->getId() ] )
			->caller( __METHOD__ )->fetchField() );
		$this->assertSame( $revisionId, $this->getServiceContainer()->getRevisionLookup()
			->getRevisionByTitle( $f['page']->getTitle() )->getId() );
		$this->assertSame( $f['main'], $saved->getContent( 'main' )->serialize() );
		$savedSnapshot = json_decode( $saved->getContent( PageRevisionWriter::SLOT )->serialize(), true, 512,
			JSON_THROW_ON_ERROR );
		$this->assertSame( $baseSnapshot['surfaces'], array_slice( $savedSnapshot['surfaces'], 0,
			count( $baseSnapshot['surfaces'] ) ) );
		$pdfMembers = array_values( array_filter( $savedSnapshot['surfaces'],
			static fn ( array $surface ): bool => ( $surface['kind'] ?? null ) === 'pdf' &&
				( $surface['label'] ?? null ) === 'ABC' ) );
		$this->assertCount( 2, $pdfMembers );
		$this->assertSame( [ 2, 1 ], array_column( array_column( $pdfMembers, 'source' ), 'page' ) );
		$this->assertSame( 'Page two layer', $pdfMembers[0]['layers'][0]['text'] );
		$this->assertSame( 'Page one layer', $pdfMembers[1]['layers'][0]['text'] );

		$afterSave = array_replace( $f, [ 'revision' => $revisionId ] );
		$config = $this->execute( $afterSave )['wgLayersEditorInit'];
		$this->assertArrayNotHasKey( 'pdfCreation', $config['pageOwned'] );
		$this->assertArrayNotHasKey( 'newSurface', $config['pageOwned'] );

		$beforeStale = $this->witness();
		try {
			$this->registration['publisher']->publish( $f['page']->getTitle(), $this->actor,
				$f['revision'], $firstSave, 'Stale original base must be refused' );
			$this->fail( 'Publication against the original base must be refused after first Save' );
		} catch ( PublicationException $error ) {
			$this->assertSame( 'layers-edit-conflict', $error->getMessage() );
		}
		$this->assertSame( $beforeStale, $this->witness() );
	}
}
