<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Tests\Core;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Hooks\PageOwnedHistoryHooks;
use MediaWiki\Title\Title;

require_once __DIR__ . '/LegacyMigrationFixtures.php';

/**
 * Core's undo restores only the page text, so an edit that changed drawings gets a link per drawing instead.
 * @covers \MediaWiki\Extension\Layers\Hooks\PageOwnedHistoryHooks::onHistoryTools
 * @group Database
 * @group API
 */
class HistoryUndoToolsTest extends \MediaWiki\Tests\Api\ApiTestCase {
	use LegacyMigrationFixtures;

	protected function setUp(): void {
		parent::setUp();
		$this->setUpMigration();
		$this->setContentLang( 'en' );
		RequestContext::getMain()->setUser( $this->actor );
		RequestContext::getMain()->setLanguage( 'en' );
	}

	/**
	 * @param Title $title
	 * @param int $base
	 * @param callable $mutate Changes the decoded snapshot
	 * @param string|null $text New page text, or null to keep it
	 * @return int New revision
	 */
	private function publish( Title $title, int $base, callable $mutate, ?string $text = null ): int {
		$fixture = json_decode(
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ),
			true
		);
		$mutate( $fixture );
		$params = [ 'action' => 'layerspublish', 'owner' => $title->getPrefixedText(), 'baserevid' => $base,
			'data' => json_encode( $fixture ) ];
		if ( $text !== null ) {
			$params['maintext'] = $text;
		}
		return $this->doApiRequestWithToken( $params, null, $this->actor )[0]['layerspublish']['revid'];
	}

	/**
	 * @param int $newId
	 * @param int $oldId
	 * @param array $tools Tools core offers for the revision
	 * @return array Tools after the hook
	 */
	private function tools( int $newId, int $oldId, array $tools ): array {
		$lookup = $this->getServiceContainer()->getRevisionLookup();
		$hooks = new PageOwnedHistoryHooks( $this->pilot, $this->getServiceContainer()->getLinkRenderer() );
		$hooks->onHistoryTools( $lookup->getRevisionById( $newId ), $tools, $lookup->getRevisionById( $oldId ),
			$this->actor );
		return $tools;
	}

	public function testAnEditThatChangedADrawingOffersThatDrawingsEarlierVersionInsteadOfCoresUndo(): void {
		$title = Title::newFromText( 'History undo page' );
		$first = $this->publish( $title, 0, static function ( array &$s ) {
		}, 'Text' );
		$second = $this->publish( $title, $first, static function ( array &$s ) {
			$s['surfaces'][0]['layers'][0]['x'] = 222;
		} );

		$tools = $this->tools( $second, $first,
			[ 'mw-undo' => '<span>undo</span>', 'mw-rollback' => '<span>rollback</span>' ] );
		$this->assertArrayNotHasKey( 'mw-undo', $tools );
		$this->assertArrayHasKey( 'mw-rollback', $tools, 'other tools stay' );
		$ids = array_values( array_filter( array_keys( $tools ),
			static fn ( $k ) => str_starts_with( $k, 'layers-undo-' ) ) );
		$this->assertCount( 1, $ids );
		$link = $tools[$ids[0]];
		$this->assertStringContainsString( 'undo layer set: Welcome Slide', $link );
		$this->assertStringContainsString( 'ViewLayersPage', $link );
		$this->assertStringContainsString( 'revid=' . $first, $link, 'the version before the edit' );

		// An edit of the text alone keeps core's undo.
		$this->editPage( $title, 'Different text', '', NS_MAIN, $this->actor );
		$latest = $title->getLatestRevID( \Wikimedia\Rdbms\IDBAccessObject::READ_LATEST );
		$kept = $this->tools( $latest, $second, [ 'mw-undo' => '<span>undo</span>' ] );
		$this->assertSame( [ 'mw-undo' ], array_keys( $kept ) );
	}

	public function testAddedDrawingsOfferNoLinkAndReadersWithoutEditRightsNoneEither(): void {
		$title = Title::newFromText( 'History undo added' );
		$first = $this->publish( $title, 0, static function ( array &$s ) {
		}, 'Text' );
		$second = $this->publish( $title, $first, static function ( array &$s ) {
			$copy = $s['surfaces'][0];
			$copy['id'] = 'extra';
			$copy['label'] = 'Extra';
			$s['surfaces'][] = $copy;
		} );
		$tools = $this->tools( $second, $first, [ 'mw-undo' => '<span>undo</span>' ] );
		$this->assertSame( [], $tools, 'nothing of the added drawing existed before the edit' );

		RequestContext::getMain()->setUser( $this->getServiceContainer()->getUserFactory()->newAnonymous() );
		$this->overrideUserPermissions( RequestContext::getMain()->getUser(), [ 'read' ] );
		$this->assertSame( [], $this->tools( $second, $first, [ 'mw-undo' => '<span>undo</span>' ] ) );
	}

	public function testHistoryViewLinksShowOnlySetsChangedInThatRevision(): void {
		$title = Title::newFromText( 'History changed sets' );
		$two = static function ( array &$snapshot, bool $change = false ): void {
			$other = $snapshot['surfaces'][0];
			$other['id'] = 'other';
			$other['label'] = 'Other slide';
			$snapshot['surfaces'][] = $other;
			if ( $change ) {
				$snapshot['surfaces'][0]['layers'][0]['x'] = 222;
			}
		};
		$first = $this->publish( $title, 0, static function ( array &$s ) use ( $two ) {
			$two( $s );
		}, 'Text' );
		$second = $this->publish( $title, $first, static function ( array &$s ) use ( $two ) {
			$two( $s, true );
		} );
		$firstViews = $this->pilot->getChangedHistorySurfaces( $title, $first, $this->actor );
		$this->assertSame( [ 'presentation', 'other' ], array_column( $firstViews, 'id' ) );
		$changed = $this->pilot->getChangedHistorySurfaces( $title, $second, $this->actor );
		$this->assertSame( [ 'presentation' ], array_column( $changed, 'id' ) );
		$context = new RequestContext();
		$context->setTitle( $title );
		$context->setUser( $this->actor );
		$context->setLanguage( 'en' );
		$hook = new PageOwnedHistoryHooks( $this->pilot, $this->getServiceContainer()->getLinkRenderer() );
		$row = (object)[ 'rev_id' => $second ];
		$html = 'Existing history';
		$classes = [];
		$attributes = [];
		$hook->onPageHistoryLineEnding( $context, $row, $html, $classes, $attributes );
		$this->assertStringContainsString( 'View Layers: Welcome Slide', $html );
		$this->assertStringNotContainsString( 'Other slide', $html );
		$third = $this->publish( $title, $second, static function ( array &$s ) use ( $two ) {
			$two( $s, true );
		}, 'Changed text' );
		$this->assertSame( [], $this->pilot->getChangedHistorySurfaces( $title, $third, $this->actor ) );
		$fourth = $this->publish( $title, $third, static function ( array &$s ) {
			$s['surfaces'][0]['layers'][0]['x'] = 222;
		} );
		$this->assertSame( [], $this->pilot->getChangedHistorySurfaces( $title, $fourth, $this->actor ),
			'A removed set has no current version to view' );
	}

	public function testHistoryViewLinksGroupPdfPagesButNotDifferentFilesWithSameName(): void {
		$file = $this->upload( 'History-group-' . wfRandomString( 8 ) . '.pdf', 'test-multipage.pdf' );
		$other = $this->upload( 'History-other-' . wfRandomString( 8 ) . '.pdf', 'test-multipage.pdf' );
		$fixture = json_decode(
			file_get_contents( __DIR__ . '/../../fixtures/revisions/slide-document-v1.json' ), true );
		$make = static function ( $source, int $page, string $id ) use ( $fixture ): array {
			$surface = $fixture['surfaces'][0];
			$surface['id'] = $id;
			$surface['kind'] = 'pdf';
			$surface['label'] = 'ABC';
			$surface['canvas']['width'] = $source->getWidth( $page );
			$surface['canvas']['height'] = $source->getHeight( $page );
			$surface['source'] = [ 'repository' => 'local', 'fileTitle' => $source->getTitle()->getPrefixedDBkey(),
				'timestamp' => $source->getTimestamp(), 'sha1' => $source->getSha1(), 'page' => $page ];
			return $surface;
		};
		$surfaces = [ $make( $file, 1, 'pdf-one' ), $make( $file, 2, 'pdf-two' ),
			$make( $other, 1, 'other-file' ) ];
		$title = Title::newFromText( 'History grouped PDFs' );
		$first = $this->publish( $title, 0, static function ( array &$s ) use ( $surfaces ) {
			$s['surfaces'] = $surfaces;
		}, 'PDFs' );
		$second = $this->publish( $title, $first, static function ( array &$s ) use ( $surfaces ) {
			$s['surfaces'] = $surfaces;
			foreach ( $s['surfaces'] as &$surface ) {
				$surface['layers'][0]['x'] = 222;
			}
		} );
		$changed = $this->pilot->getChangedHistorySurfaces( $title, $second, $this->actor );
		$this->assertSame( [ 'pdf-one', 'other-file' ], array_column( $changed, 'id' ) );
		$this->assertSame( [ 'ABC', 'ABC' ], array_column( $changed, 'label' ) );
	}

	public function testHistoryViewLinksIncludeEachIndependentlyChangedAndRenamedSet(): void {
		$title = Title::newFromText( 'History multiple changed sets' );
		$first = $this->publish( $title, 0, static function ( array &$s ) {
			$other = $s['surfaces'][0];
			$other['id'] = 'other';
			$other['label'] = 'Other slide';
			$s['surfaces'][] = $other;
		}, 'Text' );
		$second = $this->publish( $title, $first, static function ( array &$s ) {
			$other = $s['surfaces'][0];
			$other['id'] = 'other';
			$other['label'] = 'Other slide';
			$other['layers'][0]['x'] = 223;
			$s['surfaces'][0]['label'] = 'Renamed slide';
			$s['surfaces'][] = $other;
		} );
		$changed = $this->pilot->getChangedHistorySurfaces( $title, $second, $this->actor );
		$this->assertSame( [ 'presentation', 'other' ], array_column( $changed, 'id' ) );
		$this->assertSame( [ 'Renamed slide', 'Other slide' ], array_column( $changed, 'label' ) );
	}

	public function testHiddenParentDoesNotExposeChangedLayerSetLinks(): void {
		$title = Title::newFromText( 'History hidden parent' );
		$first = $this->publish( $title, 0, static function ( array &$s ) {
		}, 'Text' );
		$second = $this->publish( $title, $first, static function ( array &$s ) {
			$s['surfaces'][0]['layers'][0]['x'] = 222;
		} );
		$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )
			->set( [ 'rev_deleted' => \MediaWiki\Revision\RevisionRecord::DELETED_TEXT ] )
			->where( [ 'rev_id' => $first ] )->caller( __METHOD__ )->execute();
		try {
			$reader = $this->getServiceContainer()->getUserFactory()->newAnonymous();
			$this->overrideUserPermissions( $reader, [ 'read' ] );
			$this->assertSame( [], $this->pilot->getChangedHistorySurfaces( $title, $second, $reader ) );
		} finally {
			$this->getDb()->newUpdateQueryBuilder()->update( 'revision' )->set( [ 'rev_deleted' => 0 ] )
				->where( [ 'rev_id' => $first ] )->caller( __METHOD__ )->execute();
		}
	}
}
