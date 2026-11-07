<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Search\PageOwnedSourceScan;
use MediaWiki\Extension\Layers\Search\VisiblePageSearchProjection;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * @covers \MediaWiki\Extension\Layers\Search\PageOwnedSourceScan
 * @covers \MediaWiki\Extension\Layers\Search\VisiblePageSearchProjection
 * @group Database
 */
class PageOwnedSourceRepairTest extends RealAssetTestCase {
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

	public function testManuallyRebuildingSuppressedSourceRemovesOnlyItsTerms(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$services = $this->getServiceContainer();
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Search-repair-' . wfRandomString( 8 ) . '.png' );
		$page = $this->getExistingTestPage();
		$actor = $this->actor();
		$image = $this->makeImageSurface( 'image', 'Image', $file->getTitle()->getPrefixedDBkey(),
			$file->getTimestamp(), $file->getSha1() );
		$image['layers'] = $this->makeSlideSurface()['layers'];
		$image['layers'][0]['text'] = 'syntheticremovedword';
		$image['readingOrder'] = [ 'title' ];
		$slide = $this->makeSlideSurface( 'slide', 'Slide' );
		$slide['layers'][0]['text'] = 'syntheticretainedword';
		$id = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(),
			$this->buildDocument( [ $image, $slide ] ), 'Fixture', new WikitextContent( 'ordinarypageword' ),
			$page->getId() );
		$revision = $services->getRevisionLookup()->getRevisionById( $id );
		$content = ( new PageHistoryAccess( $services->getRevisionLookup() ) )
			->read( $page->getTitle(), $id, $actor );
		$search = $services->getService( 'LayersDrawingSearchText' );
		$search->index( $page->getId(), $page->getTitle(), $revision,
			'syntheticremovedword syntheticretainedword' );
		$key = $page->getTitle()->getPrefixedDBkey();
		$this->assertContains( $key, $this->searchTitles( 'syntheticremovedword' ) );
		$this->assertStatusGood( $file->deleteFile( 'Synthetic fixture', $this->getTestSysop()->getUser(), true ) );
		$scan = new PageOwnedSourceScan( $services->getConnectionProvider(), $services->getSlotRoleStore(),
			$services->getPageStore(), $services->getRevisionLookup() );
		$this->assertContains( $page->getId(), $scan->scan( $file->getTitle(), 0, 500 )['pageIds'] );
		$safe = ( new VisiblePageSearchProjection( $this->resolver ) )->get( $content, $actor );
		$search->index( $page->getId(), $page->getTitle(), $revision, $safe );
		$this->assertNotContains( $key, $this->searchTitles( 'syntheticremovedword' ) );
		$this->assertContains( $key, $this->searchTitles( 'syntheticretainedword' ) );
		$this->assertContains( $key, $this->searchTitles( 'ordinarypageword' ) );
	}
}
