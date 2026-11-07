<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Api\ApiMain;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Context\RequestContext;
use MediaWiki\Deferred\DeferredUpdates;
use MediaWiki\Extension\Layers\Revision\PageHistoryAccess;
use MediaWiki\Extension\Layers\Search\PageOwnedSourceScan;
use MediaWiki\Extension\Layers\Search\VisiblePageSearchProjection;
use MediaWiki\FileRepo\File\File;
use MediaWiki\FileRepo\RepoGroup;
use MediaWiki\Request\FauxRequest;

require_once __DIR__ . '/RealAssetTestCase.php';

/**
 * Historical option B experiment, not the approved page-owned search policy.
 * Its temporary source-filtering callback must not be registered in production under option A.
 * @covers \MediaWiki\Extension\Layers\Search\PageOwnedSourceScan
 * @covers \MediaWiki\Extension\Layers\Search\VisiblePageSearchProjection
 * @group Database
 */
class ArchivedVisibilitySearchRepairTest extends RealAssetTestCase {
	private function apiRevisionHasText( string $title, string $text, $actor, ?int $revisionId = null ): bool {
		$context = new RequestContext();
		$context->setUser( $actor );
		$params = [ 'action' => 'query', 'prop' => 'revisions', 'rvprop' => 'content',
			'rvslots' => 'layers', 'formatversion' => 2 ];
		$params[$revisionId === null ? 'titles' : 'revids'] = $revisionId ?? $title;
		$context->setRequest( new FauxRequest( $params ) );
		$api = new ApiMain( $context, true );
		$api->execute();
		$data = $api->getResult()->getResultData( null, [ 'Strip' => 'all' ] );
		$pages = $data['query']['pages'] ?? [];
		$page = reset( $pages ) ?: [];
		$revisions = $page['revisions'] ?? [];
		$revision = reset( $revisions ) ?: [];
		$content = $revision['slots']['layers']['content'] ?? $revision['slots']['layers']['*'] ?? '';
		return is_string( $content ) && str_contains( $content, $text );
	}

	private function apiSearchHasTitle( string $term, string $title, $actor ): bool {
		$context = new RequestContext();
		$context->setUser( $actor );
		$context->setRequest( new FauxRequest( [ 'action' => 'query', 'list' => 'search',
			'srsearch' => $term, 'srwhat' => 'text', 'srnamespace' => NS_MAIN, 'formatversion' => 2 ] ) );
		$api = new ApiMain( $context, true );
		$api->execute();
		$data = $api->getResult()->getResultData( null, [ 'Strip' => 'all' ] );
		foreach ( $data['query']['search'] ?? [] as $item ) {
			if ( ( $item['title'] ?? null ) === $title ) {
				return true;
			}
		}
		return false;
	}

	private function searchHasTitle( string $term, string $key ): bool {
		$engine = $this->getServiceContainer()->getSearchEngineFactory()->create();
		$engine->setNamespaces( [ NS_MAIN ] );
		foreach ( $engine->searchText( $term ) ?: [] as $result ) {
			if ( $result->getTitle()->getPrefixedDBkey() === $key ) {
				return true;
			}
		}
		return false;
	}

	public function testDeferredArchivedPurgeCanRefreshSearchAfterSuppressionAndRestoration(): void {
		$this->overrideConfigValues( [ 'DisableSearchUpdate' => false, 'SearchType' => null ] );
		$services = $this->getServiceContainer();
		$file = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Archived-search-' . wfRandomString( 8 ) . '.png' );
		$other = $this->uploadFixtureFile( __DIR__ . '/../../fixtures/assets/test-image.png',
			'File:Other-search-' . wfRandomString( 8 ) . '.png' );
		$actor = $this->actor( [ 'read', 'edit', 'editlayers', 'createpage', 'createtalk',
			'deleterevision', 'suppressrevision', 'viewsuppressed', 'deletedhistory' ] );
		$page = $this->getExistingTestPage();
		$image = $this->makeImageSurface( 'image', 'Image', $file->getTitle()->getPrefixedDBkey(),
			$file->getTimestamp(), $file->getSha1() );
		$image['layers'] = $this->makeSlideSurface()['layers'];
		$image['layers'][0]['text'] = 'archivedsyntheticsecret';
		$image['readingOrder'] = [ 'title' ];
		$otherImage = $this->makeImageSurface( 'other', 'Other', $other->getTitle()->getPrefixedDBkey(),
			$other->getTimestamp(), $other->getSha1() );
		$otherImage['layers'] = $this->makeSlideSurface()['layers'];
		$otherImage['layers'][0]['text'] = 'otherfileindependentword';
		$otherImage['readingOrder'] = [ 'title' ];
		$slide = $this->makeSlideSurface( 'slide', 'Slide' );
		$slide['layers'][0]['text'] = 'archivedsyntheticslide';
		$id = $this->publisher->publish( $page->getTitle(), $actor, $page->getLatest(),
			$this->buildDocument( [ $image, $otherImage, $slide ] ), 'Fixture',
			new WikitextContent( 'ordinarysynthetictext' ),
			$page->getId() );
		$this->assertStatusGood( $file->upload( __DIR__ . '/../../fixtures/assets/test-image-replacement.png',
			'Fixture replacement', '', 0, false, '20260907120000', $actor ) );
		$oldId = $id;
		$slide['layers'][0]['text'] = 'archivedsyntheticslide updated';
		$id = $this->publisher->publish( $page->getTitle(), $actor, $oldId,
			$this->buildDocument( [ $image, $otherImage, $slide ] ), 'Newer fixture revision', null, $page->getId() );
		$revision = $services->getRevisionLookup()->getRevisionById( $id );
		$content = ( new PageHistoryAccess( $services->getRevisionLookup() ) )->read( $page->getTitle(), $id, $actor );
		$repo = $this->createMock( RepoGroup::class );
		$repo->method( 'getLocalRepo' )->willReturn( $this->repo );
		$repo->method( 'findFile' )->willReturnCallback( fn ( $title, $options = [] ) =>
			$this->repo->findFile( $title, $options ) );
		$this->setService( 'RepoGroup', $repo );
		DeferredUpdates::doUpdates();
		$search = $services->getService( 'LayersDrawingSearchText' );
		$projection = new VisiblePageSearchProjection( $this->resolver );
		$search->index( $page->getId(), $page->getTitle(), $revision, $projection->get( $content, $actor ) );
		$key = $page->getTitle()->getPrefixedDBkey();
		$this->assertTrue( $this->searchHasTitle( 'archivedsyntheticsecret', $key ) );
		$scan = new PageOwnedSourceScan( $services->getConnectionProvider(), $services->getSlotRoleStore(),
			$services->getPageStore(), $services->getRevisionLookup() );
		$observations = [];
		$this->setTemporaryHook( 'LocalFilePurgeThumbnails', static function ( $target, $archive ) use (
			&$observations, $scan, $page, $search, $revision, $projection, $content, $actor
		) {
			if ( $archive === false ) {
				return;
			}
			$observations[] = $archive;
			$found = $scan->scan( $target->getTitle(), $page->getId() - 1, 1 );
			if ( in_array( $page->getId(), $found['pageIds'], true ) ) {
				$search->index( $page->getId(), $page->getTitle(), $revision, $projection->get( $content, $actor ) );
			}
		} );
		$context = new RequestContext();
		$administrator = $this->getTestSysop()->getUser();
		$this->overrideUserPermissions( $administrator, [ 'read', 'deleterevision', 'suppressrevision',
			'viewsuppressed' ] );
		$context->setUser( $administrator );
		$context->setTitle( $file->getTitle() );
		$context->setRequest( new FauxRequest() );
		$archiveName = $this->getDb()->newSelectQueryBuilder()->select( 'oi_archive_name' )->from( 'oldimage' )
			->where( [ 'oi_name' => $file->getName(), 'oi_sha1' => $image['source']['sha1'] ] )
			->caller( __METHOD__ )->fetchField();
		$this->assertIsString( $archiveName );
		$archiveId = explode( '!', $archiveName, 2 )[0];
		$list = \RevisionDeleter::createList( 'oldimage', $context, $file->getTitle(), [ $archiveId ] );
		$this->assertStatusGood( $list->setVisibility( [ 'value' => [ File::DELETED_FILE => 1,
			File::DELETED_RESTRICTED => 1 ], 'comment' => 'Synthetic suppression' ] ) );
		$this->assertSame( [], $observations, 'The purge notification is deferred.' );
		$this->assertTrue( $this->searchHasTitle( 'archivedsyntheticsecret', $key ),
			'The current shared index still matches before the deferred notification runs.' );
		$this->assertTrue( $this->apiSearchHasTitle( 'archivedsyntheticsecret', $page->getTitle()->getPrefixedText(),
			$actor ), 'The search API can also return the stale match before the deferred update.' );
		DeferredUpdates::doUpdates();
		$this->assertNotEmpty( $observations );
		$this->assertFalse( $this->searchHasTitle( 'archivedsyntheticsecret', $key ) );
		$this->assertFalse( $this->apiSearchHasTitle( 'archivedsyntheticsecret', $page->getTitle()->getPrefixedText(),
			$actor ) );
		$this->assertTrue( $this->searchHasTitle( 'archivedsyntheticslide', $key ) );
		$this->assertTrue( $this->searchHasTitle( 'ordinarysynthetictext', $key ) );
		$this->assertTrue( $this->apiSearchHasTitle( 'otherfileindependentword', $page->getTitle()->getPrefixedText(),
			$actor ), 'Another file\'s permitted layer text remains searchable.' );
		$anonymous = $services->getUserFactory()->newAnonymous();
		$visible = $this->resolver->resolveIndividually( $content, $anonymous, [ 'image', 'other' ] );
		$this->assertArrayNotHasKey( 'image', $visible, 'The suppressed source is refused to this reader.' );
		$this->assertArrayHasKey( 'other', $visible, 'The independent source remains available.' );
		$this->assertTrue( $this->apiRevisionHasText( $page->getTitle()->getPrefixedText(),
			'archivedsyntheticsecret', $anonymous ),
			'Core revision API can expose the page-owned slot even when its file source is suppressed.' );
		$this->assertTrue( $this->apiRevisionHasText( $page->getTitle()->getPrefixedText(),
			'archivedsyntheticsecret', $anonymous, $oldId ),
			'Suppressing the file must not hide an independently readable older page revision.' );
		$observations = [];
		$list = \RevisionDeleter::createList( 'oldimage', $context, $file->getTitle(), [ $archiveId ] );
		$this->assertStatusGood( $list->setVisibility( [ 'value' => [ File::DELETED_FILE => 0,
			File::DELETED_RESTRICTED => 0 ], 'comment' => 'Synthetic restoration' ] ) );
		DeferredUpdates::doUpdates();
		$this->assertNotEmpty( $observations );
		$this->assertTrue( $this->searchHasTitle( 'archivedsyntheticsecret', $key ) );
		$this->assertTrue( $this->apiSearchHasTitle( 'archivedsyntheticsecret', $page->getTitle()->getPrefixedText(),
			$actor ) );
	}
}
