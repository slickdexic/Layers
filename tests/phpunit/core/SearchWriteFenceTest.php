<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Search\DrawingSearchText;
use MediaWiki\Extension\Layers\Search\PageSearchRefreshJob;
use MediaWiki\Extension\Layers\Search\VisibleLegacySearchProjection;
use MediaWiki\JobQueue\JobQueueGroup;
use MediaWiki\Page\ExistingPageRecord;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Page\PageLookup;
use MediaWiki\Page\PageReference;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use Psr\Log\NullLogger;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDatabase;

/** @covers \MediaWiki\Extension\Layers\Search\DrawingSearchText */
class SearchWriteFenceTest extends \MediaWikiIntegrationTestCase {
	public function testPostCommitRechecksProjectionAndRepairsChangedSource(): void {
		$page = $this->createMock( ExistingPageRecord::class );
		$page->method( 'getId' )->willReturn( 81 );
		$page->method( 'getNamespace' )->willReturn( NS_MAIN );
		$page->method( 'getDBkey' )->willReturn( 'Search_fence_fixture' );
		$page->method( 'isSamePageAs' )->willReturn( true );
		$revision = $this->createMock( RevisionRecord::class );
		$revision->method( 'getId' )->willReturn( 92 );
		$revision->method( 'getPageId' )->willReturn( 81 );
		$pages = $this->createMock( PageLookup::class );
		$pages->method( 'getPageById' )->willReturn( $page );
		$pages->method( 'getPageByReference' )->willReturn( $page );
		$revisions = $this->createMock( RevisionLookup::class );
		$revisions->method( 'getRevisionByPageId' )->willReturn( $revision );
		$callbacks = [];
		$db = $this->createMock( IDatabase::class );
		$db->method( 'onTransactionCommitOrIdle' )->willReturnCallback(
			static function ( callable $callback ) use ( &$callbacks ): void {
				$callbacks[] = $callback;
			} );
		$connections = $this->createMock( IConnectionProvider::class );
		$connections->method( 'getPrimaryDatabase' )->willReturn( $db );
		$legacy = ( new \ReflectionClass( VisibleLegacySearchProjection::class ) )->newInstanceWithoutConstructor();
		$pilot = $this->createMock( PageOwnedPilot::class );
		$database = $this->createMock( LayersDatabase::class );
		$authority = $this->createMock( Authority::class );
		$jobs = $this->createMock( JobQueueGroup::class );
		$jobs->expects( $this->once() )->method( 'push' )
			->with( $this->isInstanceOf( PageSearchRefreshJob::class ) );
		$search = new class( $pilot, $database,
			$revisions, $pages, $connections, $legacy, $authority, $jobs, new NullLogger() ) extends DrawingSearchText {
			public string $currentText = 'visible source';
			public array $writes = [];
			public array $shownEntries = [ [ 'file', 'Example.png', 'Example' ] ];
			public bool $failRead = false;

			protected function shown( PageReference $page, bool $fromPrimary ): array {
				return $this->shownEntries;
			}

			public function get( PageReference $page, ?RevisionRecord $revision, bool $fromPrimary = false,
				?array $shown = null
			): string {
				if ( $this->failRead ) {
					throw new \RuntimeException( 'Synthetic verification failure' );
				}
				return $this->currentText;
			}

			public function index( int $pageId, PageIdentity $page, RevisionRecord $revision,
				string $drawingText
			): void {
				$this->writes[] = $drawingText;
			}
		};
		$search->indexWithFence( 81, $page, $revision, 'earlier text' );
		$this->assertSame( [ 'visible source' ], $search->writes );
		$this->assertCount( 1, $callbacks );
		// A source changes after the write but before its transaction commits.
		$search->currentText = '';
		$callback = array_shift( $callbacks );
		$callback();
		$this->assertSame( [ 'visible source', '' ], $search->writes );
		$this->assertCount( 1, $callbacks );
		// Restoration before the verification of the corrective write must converge too.
		$search->currentText = 'restored source';
		$callback = array_shift( $callbacks );
		$callback();
		$this->assertSame( [ 'visible source', '', 'restored source' ], $search->writes );
		$this->assertCount( 1, $callbacks );
		$callback = array_shift( $callbacks );
		$callback();
		$this->assertSame( [ 'visible source', '', 'restored source' ], $search->writes );
		$this->assertSame( [], $callbacks );
		$search->shownEntries = [ [ 'slide', 'Example', 'Example' ] ];
		$search->currentText = 'slide text';
		$search->indexWithFence( 81, $page, $revision, '' );
		$this->assertSame( [ 'visible source', '', 'restored source', 'slide text' ], $search->writes );
		$this->assertSame( [], $callbacks, 'Slide-only pages do not schedule source verification.' );
		$search->shownEntries = [ [ 'file', 'Example.png', 'Example' ] ];
		$search->indexWithFence( 81, $page, $revision, '' );
		$search->failRead = true;
		$callback = array_shift( $callbacks );
		$callback();
	}
}
