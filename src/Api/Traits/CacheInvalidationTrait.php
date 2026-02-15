<?php

declare( strict_types=1 );
/**
 * Trait providing cache invalidation for Layers API modules.
 *
 * After saving, deleting, or renaming layer sets, the File: page and
 * all pages embedding the file must be purged so they re-render with
 * updated layer data.
 *
 * @file
 * @ingroup Extensions
 * @license GPL-2.0-or-later
 */

namespace MediaWiki\Extension\Layers\Api\Traits;

use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;

/**
 * Provides cache invalidation methods for Layers API modules.
 *
 * Requires: ApiBase (for getUser, getLogger methods).
 */
trait CacheInvalidationTrait {
	/**
	 * Maximum number of backlinks to purge synchronously.
	 * This is a fallback limit when job queue is unavailable.
	 */
	private const SYNC_BACKLINK_PURGE_LIMIT = 100;

	/**
	 * Invalidate caches for a file after a layer set operation.
	 *
	 * This ensures pages using [[File:X.jpg|layerset=on]] will re-render
	 * with updated layer data instead of showing stale cached content.
	 *
	 * @param Title $fileTitle The title of the file whose layers were modified
	 */
	protected function invalidateCachesForFile( Title $fileTitle ): void {
		try {
			$services = MediaWikiServices::getInstance();

			// 1. Purge the File: page itself synchronously (fast, always needed)
			$wikiPage = $services->getWikiPageFactory()->newFromTitle( $fileTitle );
			if ( $wikiPage->exists() ) {
				$wikiPage->doPurge();
			}

			// 2. Queue job to purge all pages embedding this file
			// Using HTMLCacheUpdateJob ensures:
			// - No race condition with client navigation
			// - Handles images embedded in many pages (no artificial limit)
			// - MediaWiki handles batching and retries automatically
			try {
				$job = \HTMLCacheUpdateJob::newForBacklinks(
					$fileTitle,
					'imagelinks',
					[ 'causeAction' => 'layers-update', 'causeAgent' => $this->getUser()->getName() ]
				);
				$services->getJobQueueGroup()->lazyPush( $job );

				$this->getLogger()->debug(
					'Queued cache invalidation job for file: {filename}',
					[ 'filename' => $fileTitle->getText() ]
				);
			} catch ( \Throwable $e ) {
				// Fallback to synchronous purge of limited backlinks if job queue fails
				$this->getLogger()->debug(
					'Job queue unavailable, falling back to synchronous purge: {error}',
					[ 'error' => $e->getMessage() ]
				);
				$this->purgeBacklinksSynchronously( $fileTitle, $services );
			}
		} catch ( \Throwable $e ) {
			// Log but don't fail the API operation
			$this->getLogger()->warning(
				'Failed to invalidate caches for file: {filename}, error: {error}',
				[
					'filename' => $fileTitle->getText(),
					'error' => $e->getMessage()
				]
			);
		}
	}

	/**
	 * Fallback: Purge backlinks synchronously when job queue is unavailable.
	 *
	 * @param Title $fileTitle The file title
	 * @param MediaWikiServices $services Service container
	 */
	private function purgeBacklinksSynchronously( Title $fileTitle, MediaWikiServices $services ): void {
		$backlinkCache = $services->getBacklinkCacheFactory()->getBacklinkCache( $fileTitle );
		$backlinkTitles = $backlinkCache->getLinkPages(
			'imagelinks',
			null,
			self::SYNC_BACKLINK_PURGE_LIMIT
		);

		$purgedCount = 0;
		foreach ( $backlinkTitles as $backlinkTitle ) {
			$backlinkPage = $services->getWikiPageFactory()->newFromTitle( $backlinkTitle );
			if ( $backlinkPage->exists() ) {
				$backlinkPage->doPurge();
				$purgedCount++;
			}
		}

		$this->getLogger()->debug(
			'Synchronously purged {count} backlinks for file: {filename}',
			[ 'count' => $purgedCount, 'filename' => $fileTitle->getText() ]
		);
	}
}
