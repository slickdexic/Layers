<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\CommentStore\CommentStoreComment;
use MediaWiki\Content\Content;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Storage\PageUpdater;

/**
 * Internal MCR persistence primitive; not a public save service.
 *
 * The caller must authorize the page edit and validate content before calling.
 * No slot registration, API endpoint or legacy migration is enabled by this class.
 * See docs/PAGE_OWNED_HISTORY_IMPLEMENTATION.md for the remaining publication gates.
 */
class PageRevisionWriter {
	public const SLOT = 'layers';

	/**
	 * Save one revision while preserving all slots not explicitly changed.
	 *
	 * @param PageUpdater $updater Fresh updater for an authorized page and actor
	 * @param int $baseRevisionId Client's base revision, or zero for a new page
	 * @param Content $layersContent Validated revision snapshot
	 * @param CommentStoreComment $summary Edit summary
	 * @param Content|null $mainContent Optional main-slot edit; required for new pages
	 * @return RevisionRecord New revision, or unchanged parent for a no-op
	 * @throws \DomainException On a stale client revision
	 * @throws \InvalidArgumentException On invalid creation arguments
	 * @throws \RuntimeException If core rejects the write
	 */
	public function save(
		PageUpdater $updater,
		int $baseRevisionId,
		Content $layersContent,
		CommentStoreComment $summary,
		?Content $mainContent = null
	): RevisionRecord {
		if ( $baseRevisionId < 0 ) {
			throw new \InvalidArgumentException( 'Base revision must be non-negative.' );
		}
		// Capture the primary-database parent before modifying content. Core checks
		// this compare-and-swap token again at commit to reject intervening writes.
		$parent = $updater->grabParentRevision();
		if ( ( $parent ? $parent->getId() : 0 ) !== $baseRevisionId ) {
			throw new \DomainException( 'layers-edit-conflict' );
		}
		if ( !$parent && !$mainContent ) {
			throw new \InvalidArgumentException( 'New owner pages require main-slot content.' );
		}
		$updater->setContent( self::SLOT, $layersContent );
		if ( $mainContent !== null ) {
			$updater->setContent( SlotRecord::MAIN, $mainContent );
		}
		$revision = $updater->saveRevision( $summary );
		if ( !$updater->wasSuccessful() ) {
			throw new \RuntimeException( 'layers-revision-save-failed' );
		}
		if ( $revision ) {
			return $revision;
		}
		if ( $parent ) {
			return $parent;
		}
		throw new \RuntimeException( 'layers-revision-save-failed' );
	}
}
