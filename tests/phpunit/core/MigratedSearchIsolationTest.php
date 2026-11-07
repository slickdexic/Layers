<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Deferred\DeferredUpdates;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Search\DrawingSearchText;
use MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission;
use MediaWiki\Extension\Layers\Search\ShownLayerSets;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Request\FauxRequest;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Retained migration rows must not resurrect text removed from a current owner.
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchText
 * @covers \ReindexPageDrawings
 * @group Database
 */
class MigratedSearchIsolationTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->assertSame( 'unittest_', $this->getDb()->tablePrefix() );
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$this->overrideConfigValue( 'GroupPermissions', array_replace_recursive(
			$this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' ), [ '*' => [ 'read' => true ] ] ) );
		$this->setUpMigration();
		MigrationState::clear( $this->getDb() );
	}

	private function titles( string $term ): array {
		$engine = $this->getServiceContainer()->getSearchEngineFactory()->create();
		$engine->setNamespaces( [ NS_MAIN, NS_FILE ] );
		$titles = [];
		foreach ( $engine->searchText( $term ) ?: [] as $result ) {
			$titles[] = $result->getTitle()->getPrefixedDBkey();
		}
		return $titles;
	}

	private function assertEndpoints( string $term, int $count ): void {
		$services = $this->getServiceContainer();
		foreach ( [ false, true ] as $generator ) {
			$context = new RequestContext();
			$context->setUser( $services->getUserFactory()->newAnonymous() );
			$context->setRequest( new FauxRequest( [ 'action' => 'query', 'formatversion' => 2 ] +
				( $generator ? [ 'generator' => 'search', 'gsrsearch' => $term,
					'gsrwhat' => 'text', 'gsrnamespace' => '0|6' ] : [ 'list' => 'search',
					'srsearch' => $term, 'srwhat' => 'text', 'srnamespace' => '0|6', 'srinfo' => 'totalhits' ] ) ) );
			$api = new ApiMain( $context, true );
			$api->execute();
			$data = $api->getResult()->getResultData( null, [ 'Strip' => 'all' ] );
			$this->assertCount( $count, $data['query'][$generator ? 'pages' : 'search'] ?? [] );
			if ( !$generator ) {
				$this->assertSame( $count, $data['query']['searchinfo']['totalhits'] );
			}
			$this->assertArrayNotHasKey( 'continue', $data );
		}
		$context = new RequestContext();
		$context->setUser( $services->getUserFactory()->newAnonymous() );
		$context->setLanguage( 'en' );
		$context->setRequest( new FauxRequest( [ 'search' => $term, 'fulltext' => 1,
			'ns0' => 1, 'ns6' => 1 ] ) );
		$special = $services->getSpecialPageFactory()->getPage( 'Search' );
		$context->setTitle( $special->getPageTitle() );
		$special->setContext( $context );
		$special->execute( null );
		$this->assertSame( $count, substr_count( $context->getOutput()->getHTML(),
			'class="mw-search-result-heading"' ), 'Special:Search visible matches for ' . $term );
	}

	public function testCurrentOwnerDoesNotSearchDeletedLayersFromRetainedMigrationRows(): void {
		$file = $this->upload( 'Migrated-search-' . wfRandomString( 8 ) . '.png' );
		$this->saveSet( $file, 'Notes', 1, 'retainedoriginalsecretword' );
		$migration = $this->pilot->newFilePageMigration();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$base = $migration->commit( $plan, $this->actor );
		MigrationState::markComplete( $this->getDb() );
		$registration = TestingAdmissionRegistration::install( $this );
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$registration['publisher']->publish( $file->getTitle(), $this->actor, $base,
			'{"schemaVersion":1,"surfaces":[]}', 'Remove current layers',
			new WikitextContent( 'independentordinarysearchword' ), $file->getTitle()->getArticleID() );
		DeferredUpdates::doUpdates();
		$this->runJobs();
		$title = $file->getTitle()->getPrefixedDBkey();
		$this->assertContains( $title, $this->titles( 'independentordinarysearchword' ) );
		$this->assertNotContains( $title, $this->titles( 'retainedoriginalsecretword' ),
			'Current search must not resurrect original migration data after the owning page removes it.' );
		$this->assertEndpoints( 'retainedoriginalsecretword', 0 );
		$this->assertEndpoints( 'independentordinarysearchword', 1 );
		$this->assertSame( 1, (int)$this->getDb()->newSelectQueryBuilder()->select( 'COUNT(*)' )
			->from( 'layer_sets' )->where( [ 'ls_img_name' => $file->getName() ] )
			->caller( __METHOD__ )->fetchField(), 'Recovery rows remain intact.' );
	}

	public function testCompletedMigrationReindexFindsStaleTextWithoutAnyRemainingAssociation(): void {
		$page = $this->getNonexistingTestPage();
		$this->editPage( $page->getTitle(), 'ordinaryorphansearchword' );
		DeferredUpdates::doUpdates();
		$services = $this->getServiceContainer();
		$revision = $services->getRevisionLookup()->getRevisionByTitle( $page->getTitle() );
		$search = $services->getService( 'LayersDrawingSearchText' );
		$search->index( $revision->getPageId(), $page->getTitle(), $revision, 'orphanlegacysearchword' );
		$title = $page->getTitle()->getPrefixedDBkey();
		$this->assertContains( $title, $this->titles( 'orphanlegacysearchword' ) );
		MigrationState::markComplete( $this->getDb() );
		require_once __DIR__ . '/../../../maintenance/reindexPageDrawings.php';
		ob_start();
		try {
			( new \ReindexPageDrawings() )->execute();
			( new \ReindexPageDrawings() )->execute();
		} finally {
			ob_end_clean();
		}
		$this->assertNotContains( $title, $this->titles( 'orphanlegacysearchword' ) );
		$this->assertContains( $title, $this->titles( 'ordinaryorphansearchword' ) );
		$this->assertEndpoints( 'orphanlegacysearchword', 0 );
		$this->assertSame( $revision->getId(), $services->getRevisionLookup()
			->getRevisionByTitle( $page->getTitle() )->getId(), 'Reindex does not edit wiki content.' );
	}

	public function testMigratedPageTextSurvivesSourceSuppressionWithoutAnyRefreshJob(): void {
		$services = $this->getServiceContainer();
		$file = $this->upload( 'Migrated-search-policy-' . wfRandomString( 8 ) . '.png' );
		$this->saveSet( $file, 'Notes', 1, 'independentmigratedword' );
		$migration = $this->pilot->newFilePageMigration();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$migration->commit( $plan, $this->actor );
		MigrationState::markComplete( $this->getDb() );
		$sha1 = $file->getSha1();
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-image-replacement.png',
			'Fixture replacement', '', 0, false, '20260907120000', $this->actor ) );
		DeferredUpdates::doUpdates();
		$services->getService( 'LayersDrawingSearchText' )->updateFilePage( $file->getTitle() );
		$this->assertEndpoints( 'independentmigratedword', 1 );
		$archive = $this->getDb()->newSelectQueryBuilder()->select( 'oi_archive_name' )->from( 'oldimage' )
			->where( [ 'oi_name' => $file->getName(), 'oi_sha1' => $sha1 ] )
			->caller( __METHOD__ )->fetchField();
		$this->assertIsString( $archive );
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'deleterevision',
			'suppressrevision', 'viewsuppressed' ] );
		$context = new RequestContext();
		$context->setUser( $this->actor );
		$context->setTitle( $file->getTitle() );
		$context->setRequest( new FauxRequest() );
		$admission = new LegacySearchSourceAdmission( $services->getRepoGroup()->getLocalRepo() );
		foreach ( [ 1, 0 ] as $hidden ) {
			$list = \RevisionDeleter::createList( 'oldimage', $context, $file->getTitle(),
				[ explode( '!', $archive, 2 )[0] ] );
			$this->assertStatusGood( $list->setVisibility( [ 'value' => [ File::DELETED_FILE => $hidden,
				File::DELETED_RESTRICTED => $hidden ], 'comment' => 'Synthetic migration policy transition' ] ) );
			$this->assertEndpoints( 'independentmigratedword', 1 );
			$this->assertSame( !$hidden, $admission->allows( $file->getTitle(), $sha1, 1,
				$services->getUserFactory()->newAnonymous() ) );
		}
	}

	public function testCleanupRefusesDisabledSearchUpdates(): void {
		MigrationState::markComplete( $this->getDb() );
		$this->overrideConfigValue( 'DisableSearchUpdate', true );
		require_once __DIR__ . '/../../../maintenance/reindexPageDrawings.php';
		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'Search updates are disabled' );
		( new \ReindexPageDrawings() )->execute();
	}

	public function testMigratedPdfKeepsSearchableTextFromEveryMember(): void {
		$file = $this->upload( 'Migrated-search-' . wfRandomString( 8 ) . '.pdf', 'test-multipage.pdf' );
		$this->saveSet( $file, 'Notes', 1, 'migratedpdffirstword' );
		$this->saveSet( $file, 'Notes', 1, 'migratedpdfsecondword', 2 );
		$migration = $this->pilot->newFilePageMigration();
		$plan = $migration->plan( $file->getName(), $this->actor );
		$this->assertNull( $plan['problem'] );
		$migration->commit( $plan, $this->actor );
		MigrationState::markComplete( $this->getDb() );
		DeferredUpdates::doUpdates();
		$this->getServiceContainer()->getService( 'LayersDrawingSearchText' )->updateFilePage( $file->getTitle() );
		$this->assertEndpoints( 'migratedpdffirstword', 1 );
		$this->assertEndpoints( 'migratedpdfsecondword', 1 );
	}

	public function testStaleEmbedPropertyAndPreparedWriteCannotRestoreLegacySlideText(): void {
		$this->saveSlide( 'Search_recovery_slide', 'Notes', 'retainedslidesearchword' );
		$page = $this->getNonexistingTestPage();
		$document = json_decode( file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			true );
		$document['surfaces'][0]['layers'][0]['text'] = 'currentownedslidesearchword';
		$registration = TestingAdmissionRegistration::install( $this );
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$id = $registration['publisher']->publish( $page->getTitle(), $this->actor, 0,
			json_encode( $document ), 'Independent slide', new WikitextContent( 'ordinarystaleslideword' ) );
		DeferredUpdates::doUpdates();
		$services = $this->getServiceContainer();
		$revision = $services->getRevisionLookup()->getRevisionById( $id );
		$shown = [ [ ShownLayerSets::SLIDE, 'Search_recovery_slide', 'Notes' ] ];
		$this->getDb()->newInsertQueryBuilder()->insertInto( 'page_props' )->row( [
			'pp_page' => $revision->getPageId(), 'pp_propname' => ShownLayerSets::PROPERTY,
			'pp_value' => json_encode( $shown )
		] )->caller( __METHOD__ )->execute();
		$search = $services->getService( 'LayersDrawingSearchText' );
		$prepared = $search->get( $page->getTitle(), $revision, true );
		$this->assertStringContainsString( 'retainedslidesearchword', $prepared );
		$search->index( $revision->getPageId(), $page->getTitle(), $revision, $prepared );
		MigrationState::markComplete( $this->getDb() );
		require_once __DIR__ . '/../../../maintenance/reindexPageDrawings.php';
		ob_start();
		try {
			$cleanup = new class extends \ReindexPageDrawings {
				public function __construct() {
					parent::__construct();
					$this->setBatchSize( 1 );
				}
			};
			$this->assertTrue( $cleanup->execute() );
		} finally {
			ob_end_clean();
		}
		// Simulate work prepared before completion arriving after the cleanup.
		$search->indexWithFence( $revision->getPageId(), $page->getTitle(), $revision, $prepared, $shown );
		$this->assertEndpoints( 'retainedslidesearchword', 0 );
		$this->assertEndpoints( 'currentownedslidesearchword', 1 );
		$this->assertEndpoints( 'ordinarystaleslideword', 1 );
	}

	public function testCleanupDoesNotReportSuccessWhenAnIndexWriteFails(): void {
		$this->getExistingTestPage();
		MigrationState::markComplete( $this->getDb() );
		$search = $this->createMock( DrawingSearchText::class );
		$search->method( 'update' )->willThrowException( new \RuntimeException( 'Synthetic index failure' ) );
		$this->setService( 'LayersDrawingSearchText', $search );
		require_once __DIR__ . '/../../../maintenance/reindexPageDrawings.php';
		$this->expectOutputString( '' );
		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( 'Synthetic index failure' );
		( new \ReindexPageDrawings() )->execute();
	}
}
