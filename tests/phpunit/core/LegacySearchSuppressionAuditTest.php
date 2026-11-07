<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Context\RequestContext;
use MediaWiki\Deferred\DeferredUpdates;
use MediaWiki\Extension\Layers\Migration\MigrationState;
use MediaWiki\Extension\Layers\Search\LegacySearchRefreshJob;
use MediaWiki\Extension\Layers\Search\LegacySearchSourceAdmission;
use MediaWiki\Extension\Layers\Search\PageSearchRefreshJob;
use MediaWiki\FileRepo\File\File;
use MediaWiki\Request\FauxRequest;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Characterizes the active legacy shared-set search path using isolated fixtures.
 * @covers \MediaWiki\Extension\Layers\Search\DrawingSearchText
 * @group Database
 */
class LegacySearchSuppressionAuditTest extends \MediaWikiIntegrationTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->assertSame( 'unittest_', $this->getDb()->tablePrefix() );
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$this->overrideConfigValue( 'GroupPermissions', array_replace_recursive(
			$this->getServiceContainer()->getMainConfig()->get( 'GroupPermissions' ), [ '*' => [ 'read' => true ] ] ) );
		$this->setUpMigration();
	}

	private function searchResults( string $term, $reader ): array {
		$context = new RequestContext();
		$context->setUser( $reader );
		$context->setRequest( new FauxRequest( [ 'action' => 'query', 'list' => 'search',
			'srsearch' => $term, 'srwhat' => 'text', 'srnamespace' => '0|6', 'formatversion' => 2 ] ) );
		$api = new ApiMain( $context, true );
		$api->execute();
		$data = $api->getResult()->getResultData( null, [ 'Strip' => 'all' ] );
		return $data['query']['search'] ?? [];
	}

	private function searchTitles( string $term, $reader ): array {
		return array_column( $this->searchResults( $term, $reader ), 'title' );
	}

	private function generatorTitles( string $term, $reader ): array {
		$context = new RequestContext();
		$context->setUser( $reader );
		$context->setRequest( new FauxRequest( [ 'action' => 'query', 'generator' => 'search',
			'gsrsearch' => $term, 'gsrwhat' => 'text', 'gsrnamespace' => '0|6', 'formatversion' => 2 ] ) );
		$api = new ApiMain( $context, true );
		$api->execute();
		$data = $api->getResult()->getResultData( null, [ 'Strip' => 'all' ] );
		return array_column( $data['query']['pages'] ?? [], 'title' );
	}

	public function testActiveSearchAfterLegacySourceSuppression(): void {
		$services = $this->getServiceContainer();
		$file = $this->upload( 'Legacy-search-audit-' . wfRandomString( 8 ) . '.png' );
		$other = $this->upload( 'Legacy-search-other-' . wfRandomString( 8 ) . '.png' );
		$this->assertFalse( $services->getService( 'LayersDatabase' )->hasFileSetsForSearch( $file->getName() ) );
		$this->saveSet( $file, 'Example', 1, 'legacyisolatedsearchmarker' );
		$this->saveSet( $other, 'Example', 1, 'independentlegacyfileword' );
		$this->assertTrue( $services->getService( 'LayersDatabase' )->hasFileSetsForSearch( $file->getName() ) );
		$oldHash = $file->getSha1();
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-image-replacement.png',
			'Fixture replacement', '', 0, false, '20260907120000', $this->actor ) );
		$page = $this->getNonexistingTestPage();
		$this->editPage( $page->getTitle(), 'ordinarylegacyindependent [[File:' . $file->getName() .
			'|layerset=Example]] [[File:' . $other->getName() . '|layerset=Example]]' );
		DeferredUpdates::doUpdates();
		$this->runJobs();
		$search = $services->getService( 'LayersDrawingSearchText' );
		$search->updateFilePage( $file->getTitle() );
		$search->update( $page->getTitle() );
		$reader = $services->getUserFactory()->newAnonymous();
		$admission = new LegacySearchSourceAdmission( $services->getRepoGroup()->getLocalRepo() );
		$this->assertTrue( $admission->allows( $file->getTitle(), $oldHash, 1, $reader ) );
		$fileTitle = $file->getTitle()->getPrefixedText();
		$pageTitle = $page->getTitle()->getPrefixedText();
		$this->assertContains( $fileTitle, $this->searchTitles( 'legacyisolatedsearchmarker', $reader ) );
		$this->assertContains( $pageTitle, $this->searchTitles( 'legacyisolatedsearchmarker', $reader ) );
		$this->assertContains( $pageTitle, $this->generatorTitles( 'legacyisolatedsearchmarker', $reader ) );
		$record = $services->getPageStore()->getPageByReference( $page->getTitle() );
		$revision = $services->getRevisionLookup()->getRevisionByPageId( $record->getId() );
		$beforeSuppression = $search->get( $record, $revision, true );
		$this->assertStringContainsString( 'legacyisolatedsearchmarker', $beforeSuppression );
		$archive = $this->getDb()->newSelectQueryBuilder()->select( 'oi_archive_name' )->from( 'oldimage' )
			->where( [ 'oi_name' => $file->getName(), 'oi_sha1' => $oldHash ] )
			->caller( __METHOD__ )->fetchField();
		$this->assertIsString( $archive );
		$this->overrideUserPermissions( $this->actor, [ 'read', 'edit', 'deleterevision', 'suppressrevision',
			'viewsuppressed' ] );
		$context = new RequestContext();
		$context->setUser( $this->actor );
		$context->setTitle( $file->getTitle() );
		$context->setRequest( new FauxRequest() );
		$list = \RevisionDeleter::createList( 'oldimage', $context, $file->getTitle(),
			[ explode( '!', $archive, 2 )[0] ] );
		$this->assertStatusGood( $list->setVisibility( [ 'value' => [ File::DELETED_FILE => 1,
			File::DELETED_RESTRICTED => 1 ], 'comment' => 'Synthetic suppression' ] ) );
		DeferredUpdates::doUpdates();
		$this->assertContains( $pageTitle, $this->searchTitles( 'legacyisolatedsearchmarker', $reader ),
			'The existing index remains stale until the scheduled refresh runs.' );
		$this->assertContains( $pageTitle, $this->generatorTitles( 'legacyisolatedsearchmarker', $reader ) );
		$this->runJobs();
		$this->assertFalse( $admission->allows( $file->getTitle(), $oldHash, 1, $reader ) );
		$this->assertNotContains( $fileTitle, $this->searchTitles( 'legacyisolatedsearchmarker', $reader ) );
		$this->assertNotContains( $pageTitle, $this->searchTitles( 'legacyisolatedsearchmarker', $reader ) );
		$this->assertNotContains( $pageTitle, $this->generatorTitles( 'legacyisolatedsearchmarker', $reader ) );
		$this->assertContains( $pageTitle, $this->searchTitles( 'ordinarylegacyindependent', $reader ) );
		$this->assertContains( $pageTitle, $this->searchTitles( 'independentlegacyfileword', $reader ) );
		$this->assertContains( $pageTitle, $this->generatorTitles( 'independentlegacyfileword', $reader ) );
		// Simulate an older production writer resuming with a pre-suppression projection.
		$search->indexWithFence( $record->getId(), $record, $revision, $beforeSuppression );
		$this->assertNotContains( $pageTitle, $this->searchTitles( 'legacyisolatedsearchmarker', $reader ),
			'A delayed stale write must not remain after the post-commit check.' );
		// A normal active-path refresh must not reinsert terms from a suppressed source.
		$search->updateFilePage( $file->getTitle() );
		$search->update( $page->getTitle() );
		$this->assertNotContains( $fileTitle, $this->searchTitles( 'legacyisolatedsearchmarker', $reader ) );
		$this->assertNotContains( $pageTitle, $this->searchTitles( 'legacyisolatedsearchmarker', $reader ) );
		$this->assertContains( $pageTitle, $this->searchTitles( 'ordinarylegacyindependent', $reader ) );
		$list = \RevisionDeleter::createList( 'oldimage', $context, $file->getTitle(),
			[ explode( '!', $archive, 2 )[0] ] );
		$this->assertStatusGood( $list->setVisibility( [ 'value' => [ File::DELETED_FILE => 0,
			File::DELETED_RESTRICTED => 0 ], 'comment' => 'Synthetic restoration' ] ) );
		DeferredUpdates::doUpdates();
		$this->runJobs();
		$this->assertTrue( $admission->allows( $file->getTitle(), $oldHash, 1, $reader ) );
		$this->assertContains( $pageTitle, $this->searchTitles( 'legacyisolatedsearchmarker', $reader ) );
		$this->assertContains( $pageTitle, $this->generatorTitles( 'legacyisolatedsearchmarker', $reader ) );
	}

	public function testFileDeletionClearsSearchAfterItsLastLegacyRowIsRemoved(): void {
		MigrationState::clear( $this->getDb() );
		$services = $this->getServiceContainer();
		$file = $this->upload( 'Legacy-search-delete-' . wfRandomString( 8 ) . '.png' );
		$this->saveSet( $file, 'Example', 1, 'legacydeletedonlymarker' );
		$page = $this->getNonexistingTestPage();
		$this->editPage( $page->getTitle(), 'legacyordinarykeep [[File:' . $file->getName() .
			'|layerset=Example]]' );
		DeferredUpdates::doUpdates();
		$this->runJobs();
		$search = $services->getService( 'LayersDrawingSearchText' );
		$search->updateFilePage( $file->getTitle() );
		$search->update( $page->getTitle() );
		$reader = $services->getUserFactory()->newAnonymous();
		$pageTitle = $page->getTitle()->getPrefixedText();
		$this->assertContains( $pageTitle, $this->searchTitles( 'legacydeletedonlymarker', $reader ) );
		$this->assertStatusGood( $file->deleteFile( 'Synthetic deletion', $this->actor, true ) );
		// The native deletion form emits this hook after LocalFile::deleteFile succeeds.
		$services->getHookContainer()->run( 'FileDeleteComplete',
			[ $file, null, null, $this->actor, 'Synthetic deletion' ] );
		DeferredUpdates::doUpdates();
		$this->runJobs();
		$this->assertFalse( $services->getService( 'LayersDatabase' )->hasFileSetsForSearch( $file->getName() ) );
		$this->assertNotContains( $pageTitle, $this->searchTitles( 'legacydeletedonlymarker', $reader ) );
		$this->assertContains( $pageTitle, $this->searchTitles( 'legacyordinarykeep', $reader ) );
	}

	public function testDeletionHookQueuesCleanupWithoutRetainedRows(): void {
		$services = $this->getServiceContainer();
		$file = $this->upload( 'Legacy-search-empty-' . wfRandomString( 8 ) . '.png' );
		DeferredUpdates::doUpdates();
		$this->runJobs();
		$this->assertFalse( $services->getService( 'LayersDatabase' )->hasFileSetsForSearch( $file->getName() ) );
		$services->getHookContainer()->run( 'FileDeleteComplete',
			[ $file, null, null, $this->actor, 'Synthetic deletion hook' ] );
		DeferredUpdates::doUpdates();
		$queued = $services->getJobQueueGroup()->get( 'layersLegacySearchRefresh' )->pop();
		$this->assertInstanceOf( LegacySearchRefreshJob::class, $queued );
	}

	public function testPageRetryJobRefreshesCurrentContent(): void {
		$services = $this->getServiceContainer();
		$page = $this->getNonexistingTestPage();
		$this->editPage( $page->getTitle(), 'ordinaryretryword' );
		DeferredUpdates::doUpdates();
		$this->runJobs();
		$record = $services->getPageStore()->getPageByReference( $page->getTitle() );
		$revision = $services->getRevisionLookup()->getRevisionByPageId( $record->getId() );
		$search = $services->getService( 'LayersDrawingSearchText' );
		// Seed an obsolete term using the raw test-only write boundary.
		$search->index( $record->getId(), $record, $revision, 'obsoletecheckword' );
		$reader = $services->getUserFactory()->newAnonymous();
		$title = $page->getTitle()->getPrefixedText();
		$this->assertContains( $title, $this->searchTitles( 'obsoletecheckword', $reader ) );
		$queue = $services->getJobQueueGroup();
		$queue->push( new PageSearchRefreshJob( $page->getTitle(), [ 'pageId' => $record->getId() ] ) );
		$job = $queue->get( 'layersPageSearchRefresh' )->pop();
		$this->assertInstanceOf( PageSearchRefreshJob::class, $job );
		$this->assertTrue( $job->run() );
		$this->assertNotContains( $title, $this->searchTitles( 'obsoletecheckword', $reader ) );
		$this->assertContains( $title, $this->searchTitles( 'ordinaryretryword', $reader ) );
	}
}
