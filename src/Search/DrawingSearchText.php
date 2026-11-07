<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Content\TextContent;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\LayersConstants;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\JobQueue\JobQueueGroup;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Page\PageLookup;
use MediaWiki\Page\PageReference;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Search\SearchUpdate;
use MediaWiki\Title\Title;
use Psr\Log\LoggerInterface;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;
use Wikimedia\Rdbms\IExpression;
use Wikimedia\Rdbms\LikeValue;

/**
 * Words readers can see in layer sets, for search: a page's own layer sets at the revision indexed, the shared
 * layer sets and slides it shows, and on a file description page the text of the file's layer sets.
 * Core indexes only the main slot.
 */
class DrawingSearchText {
	/** Pages reindexed at once after a shared set changes; more wait for their next edit or reindex. */
	private const MAX_PAGES_PER_CHANGE = 500;

	private PageOwnedPilot $pilot;
	private LayersDatabase $db;
	private RevisionLookup $revisions;
	private PageLookup $pages;
	private IConnectionProvider $connections;
	private VisibleLegacySearchProjection $visibleLegacy;
	private Authority $indexAuthority;
	private JobQueueGroup $jobs;
	private LoggerInterface $logger;

	/**
	 * @param PageOwnedPilot $pilot
	 * @param LayersDatabase $db
	 * @param RevisionLookup $revisions
	 * @param PageLookup $pages
	 * @param IConnectionProvider $connections
	 * @param VisibleLegacySearchProjection $visibleLegacy
	 * @param Authority $indexAuthority
	 * @param JobQueueGroup $jobs
	 * @param LoggerInterface $logger
	 */
	public function __construct( PageOwnedPilot $pilot, LayersDatabase $db, RevisionLookup $revisions,
		PageLookup $pages, IConnectionProvider $connections, VisibleLegacySearchProjection $visibleLegacy,
		Authority $indexAuthority, JobQueueGroup $jobs, LoggerInterface $logger
	) {
		$this->pilot = $pilot;
		$this->db = $db;
		$this->revisions = $revisions;
		$this->pages = $pages;
		$this->connections = $connections;
		$this->visibleLegacy = $visibleLegacy;
		$this->indexAuthority = $indexAuthority;
		$this->jobs = $jobs;
		$this->logger = $logger;
	}

	/**
	 * @param PageReference $page
	 * @param RevisionRecord|null $revision Revision indexed or shown; the page's own drawings are read from it
	 * @param bool $fromPrimary Read layer sets from the primary database
	 * @param array|null $shown Shared sets the page shows (ShownLayerSets entries); null reads its page property
	 * @return string One entry per line; empty when there is none
	 */
	public function get( PageReference $page, ?RevisionRecord $revision, bool $fromPrimary = false,
		?array $shown = null
	): string {
		$parts = [];
		if ( $revision && $revision->hasSlot( PageRevisionWriter::SLOT ) &&
			!$revision->isDeleted( RevisionRecord::DELETED_TEXT ) &&
			$this->pilot->getScope()->includesRevision( $page, $revision )
		) {
			$parts[] = PageDrawingSearchText::extract(
				$revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW ) );
		}
		if ( $page->getNamespace() === NS_FILE ) {
			$parts[] = $this->visibleLegacy->file( $page->getDBkey(), $this->indexAuthority, $fromPrimary );
		}
		$queried = [];
		foreach ( $shown ?? $this->shown( $page, $fromPrimary ) as [ $kind, $name, $setName ] ) {
			// The shared query already returns member pages; their internal selectors do not change it.
			$key = JsonSnapshotCodec::encode( [ $kind, $name, $setName ] );
			if ( isset( $queried[$key] ) ) {
				continue;
			}
			$queried[$key] = true;
			$slide = $kind === ShownLayerSets::SLIDE;
			if ( !$slide ) {
				$parts[] = $this->visibleLegacy->shown( $name, $setName, false, $this->indexAuthority,
					$fromPrimary );
				continue;
			}
			foreach ( $this->db->getSetForSearch( LayersConstants::SLIDE_PREFIX . $name, $setName,
				true, $fromPrimary ) as $set
			) {
				$parts[] = PageDrawingSearchText::layerText( $set );
			}
		}
		return implode( "\n", array_filter( $parts, 'strlen' ) );
	}

	/**
	 * Replace the page's index entry with its text followed by $drawingText.
	 *
	 * @param int $pageId
	 * @param PageIdentity $page
	 * @param RevisionRecord $revision Current revision
	 * @param string $drawingText From get()
	 */
	public function index( int $pageId, PageIdentity $page, RevisionRecord $revision, string $drawingText ): void {
		$main = $revision->isDeleted( RevisionRecord::DELETED_TEXT ) ? null :
			$revision->getContent( SlotRecord::MAIN, RevisionRecord::RAW );
		$text = ( $main ? $main->getTextForSearchIndex() : '' ) . "\n\n" . $drawingText;
		( new SearchUpdate( $pageId, $page, new TextContent( trim( $text ) ) ) )->doUpdate();
	}

	/**
	 * Write from fresh primary state and recheck it after the transaction commits.
	 * The supplied revision and projection identify the triggering work, but may
	 * have been prepared before a source changed; neither is trusted for the write.
	 * @param int $pageId
	 * @param PageIdentity $page
	 * @param RevisionRecord $revision
	 * @param string $drawingText
	 * @param array|null $shown Fresh parser properties when available
	 */
	public function indexWithFence( int $pageId, PageIdentity $page, RevisionRecord $revision,
		string $drawingText, ?array $shown = null
	): void {
		$record = $this->pages->getPageById( $pageId, IDBAccessObject::READ_LATEST );
		$current = $record ? $this->revisions->getRevisionByPageId( $pageId, 0, IDBAccessObject::READ_LATEST ) : null;
		if ( !$record || !$record->isSamePageAs( $page ) || $revision->getPageId() !== $pageId || !$current ) {
			return;
		}
		$entries = $shown ?? $this->shown( $record, true );
		$text = $this->get( $record, $current, true, $entries );
		$this->index( $pageId, $record, $current, $text );
		$hasLegacyFile = $record->getNamespace() === NS_FILE &&
			( $text !== '' || $this->db->hasFileSetsForSearch( $record->getDBkey() ) );
		foreach ( $entries as $entry ) {
			$hasLegacyFile = $hasLegacyFile || ( $entry[0] ?? null ) === ShownLayerSets::FILE;
		}
		if ( !$hasLegacyFile ) {
			return;
		}
		$indexedRevision = $current->getId();
		$this->connections->getPrimaryDatabase()->onTransactionCommitOrIdle( function () use (
			$pageId, $text, $indexedRevision, $record
		): void {
			try {
				$latestPage = $this->pages->getPageById( $pageId, IDBAccessObject::READ_LATEST );
				$latest = $latestPage ? $this->revisions->getRevisionByPageId( $pageId, 0,
					IDBAccessObject::READ_LATEST ) : null;
				if ( $latest && ( $latest->getId() !== $indexedRevision ||
					$this->get( $latestPage, $latest, true ) !== $text ) ) {
					$this->update( $latestPage );
				}
			} catch ( \Throwable $e ) {
				$this->logger->error( 'Search write verification failed',
					[ 'exception' => $e, 'pageId' => $pageId ] );
				try {
					$this->jobs->push( new PageSearchRefreshJob( Title::newFromPageReference( $record ),
						[ 'pageId' => $pageId ] ) );
				} catch ( \Throwable $queueError ) {
					$this->logger->error( 'Search verification retry scheduling failed',
						[ 'exception' => $queueError, 'pageId' => $pageId ] );
				}
			}
		}, __METHOD__ );
	}

	/**
	 * Reindex the current revision of a page after a shared layer set it shows changes, which is not a page edit.
	 *
	 * @param PageReference $page
	 * @param array|null $shown As for get()
	 */
	public function update( PageReference $page, ?array $shown = null ): void {
		$record = $this->pages->getPageByReference( $page, IDBAccessObject::READ_LATEST );
		$revision = $record ? $this->revisions->getRevisionByPageId( $record->getId(), 0,
			IDBAccessObject::READ_LATEST ) : null;
		if ( $record && $revision ) {
			$this->indexWithFence( $record->getId(), $record, $revision, '', $shown );
		}
	}

	/**
	 * Reindex a file description page whose layer sets changed.
	 *
	 * @param PageReference $page
	 */
	public function updateFilePage( PageReference $page ): void {
		if ( $page->getNamespace() === NS_FILE ) {
			$this->update( $page );
		}
	}

	/**
	 * Reindex every page that shows a set of this file or slide.
	 *
	 * @param string $kind ShownLayerSets::FILE or ShownLayerSets::SLIDE
	 * @param string $name File DB key or slide name
	 */
	public function updatePagesShowing( string $kind, string $name ): void {
		$db = $this->connections->getPrimaryDatabase();
		$ids = $db->newSelectQueryBuilder()->select( 'pp_page' )->from( 'page_props' )
			->where( [ 'pp_propname' => ShownLayerSets::PROPERTY, $db->expr( 'pp_value', IExpression::LIKE,
				new LikeValue( $db->anyString(), ShownLayerSets::fragment( $kind, $name ), $db->anyString() ) ) ] )
			->orderBy( 'pp_page' )->limit( self::MAX_PAGES_PER_CHANGE )->caller( __METHOD__ )->fetchFieldValues();
		foreach ( $ids as $id ) {
			$page = $this->pages->getPageById( (int)$id, IDBAccessObject::READ_LATEST );
			if ( $page ) {
				$this->update( $page );
			}
		}
	}

	/**
	 * @param PageReference $page
	 * @param bool $fromPrimary
	 * @return string[][] ShownLayerSets entries from the stored page property, read without PageProps' cache
	 */
	protected function shown( PageReference $page, bool $fromPrimary ): array {
		$record = $this->pages->getPageByReference( $page,
			$fromPrimary ? IDBAccessObject::READ_LATEST : IDBAccessObject::READ_NORMAL );
		if ( !$record ) {
			return [];
		}
		$db = $fromPrimary ? $this->connections->getPrimaryDatabase() : $this->connections->getReplicaDatabase();
		return ShownLayerSets::decode( $db->newSelectQueryBuilder()->select( 'pp_value' )->from( 'page_props' )
			->where( [ 'pp_page' => $record->getId(), 'pp_propname' => ShownLayerSets::PROPERTY ] )
			->caller( __METHOD__ )->fetchField() );
	}
}
