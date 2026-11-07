<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;

require_once __DIR__ . '/TestingAdmissionRegistration.php';

/**
 * @covers \ReindexPageDrawings
 * @group Database
 */
class SearchReindexEmptyTest extends \MediaWikiIntegrationTestCase {
	/** @return string[] */
	private function searchTitles( string $term ): array {
		$engine = $this->getServiceContainer()->getSearchEngineFactory()->create();
		$engine->setNamespaces( [ NS_MAIN ] );
		$titles = [];
		foreach ( $engine->searchText( $term ) ?: [] as $result ) {
			$titles[] = $result->getTitle()->getPrefixedDBkey();
		}
		return $titles;
	}

	public function testRepairClearsStaleLayerTextForEmptySnapshotAndKeepsPageText(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null,
			'LayersPageDrawingNamespaces' => null ] );
		$page = $this->getNonexistingTestPage();
		$actor = $this->getTestUser()->getUser();
		$this->overrideUserPermissions( $actor, [ 'read', 'edit', 'editlayers', 'createpage' ] );
		$publisher = TestingAdmissionRegistration::install( $this )['publisher'];
		$id = $publisher->publish( $page->getTitle(), $actor, 0, '{"schemaVersion":1,"surfaces":[]}',
			'Empty fixture', new WikitextContent( 'syntheticordinaryword' ) );
		$revision = $this->getServiceContainer()->getRevisionLookup()->getRevisionById( $id );
		$pageId = $revision->getPageId();
		$projection = $this->getServiceContainer()->getService( 'LayersDrawingSearchText' );
		$projection->index( $pageId, $page->getTitle(), $revision, 'syntheticstalevoltage' );
		$key = $page->getTitle()->getPrefixedDBkey();
		$this->assertContains( $key, $this->searchTitles( 'syntheticstalevoltage' ) );
		$this->assertContains( $key, $this->searchTitles( 'syntheticordinaryword' ) );

		require_once __DIR__ . '/../../../maintenance/reindexPageDrawings.php';
		ob_start();
		try {
			( new \ReindexPageDrawings() )->execute();
			( new \ReindexPageDrawings() )->execute();
		} finally {
			ob_end_clean();
		}
		$this->assertNotContains( $key, $this->searchTitles( 'syntheticstalevoltage' ) );
		$this->assertContains( $key, $this->searchTitles( 'syntheticordinaryword' ) );
	}
}
