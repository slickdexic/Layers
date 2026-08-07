<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api\Traits;

use MediaWiki\Logger\LoggerFactory;
use MediaWiki\MediaWikiServices;

/**
 * Trait for invalidating caches after layer data changes.
 *
 * Used by API modules that modify layer data (save, delete, rename) to ensure
 * that pages displaying layers are refreshed with the latest data.
 *
 * Cache invalidation targets:
 * 1. The file description page itself (parser cache)
 * 2. CDN/Squid caches for the file page URL
 * 3. Pages embedding the file via [[File:...]] wikitext, through an
 *    HTMLCacheUpdateJob over the `imagelinks` backlinks
 *
 * Compatible with MediaWiki 1.39+.
 */
trait CacheInvalidationTrait {
	/**
	 * Invalidate caches for a file page and pages that embed it.
	 *
	 * This ensures that pages using [[File:X.jpg|layerset=on]] or similar
	 * wikitext will re-render with current layer data after a save/delete/rename.
	 *
	 * @param \MediaWiki\Title\Title $title The file page title
	 */
	protected function invalidateCachesForFile( $title ): void {
		if ( !$title || !$title->exists() ) {
			return;
		}

		try {
			$services = MediaWikiServices::getInstance();

			// 1. Invalidate the page's link cache timestamp
			// This marks the page as "modified" so parser cache is invalidated
			$title->invalidateCache();

			// 2. Purge the file description page's parser cache
			$wikiPageFactory = $services->getWikiPageFactory();
			$wikiPage = $wikiPageFactory->newFromTitle( $title );
			$wikiPage->doPurge();

			// 3. Purge CDN/Squid caches for the file description page itself
			// HtmlCacheUpdater was added in MW 1.35
			if ( method_exists( $services, 'getHtmlCacheUpdater' ) ) {
				$htmlCacheUpdater = $services->getHtmlCacheUpdater();
				$htmlCacheUpdater->purgeTitleUrls(
					[ $title ],
					$htmlCacheUpdater::PURGE_INTENT_TXROUND_REFLECTED
				);
			}

			// 4. Purge every page that embeds this file.
			// Steps 1-3 only touch the File: page. Layer data is stored outside
			// the wikitext, so an article containing [[File:X|layerset=on]] keeps
			// serving its parser-cached HTML with the *old* layer set until
			// something unrelated invalidates it. Walking the imagelinks
			// backlinks is what makes a save visible where the file is used.
			$this->purgeFileBacklinks( $title );
		} catch ( \Throwable $e ) {
			// Cache invalidation is best-effort; don't fail the save/delete/rename
			// if cache purging encounters an error
			LoggerFactory::getInstance( 'Layers' )->warning(
				'Cache invalidation failed for {title}',
				[ 'title' => $title->getPrefixedText(), 'exception' => $e ]
			);
		}
	}

	/**
	 * Queue an HTMLCacheUpdateJob over the file's `imagelinks` backlinks.
	 *
	 * Deliberately a job rather than an inline purge: a widely-used file can have
	 * hundreds of thousands of backlinks, and this runs inside an API write.
	 *
	 * @param \MediaWiki\Title\Title $title The file page title
	 */
	private function purgeFileBacklinks( $title ): void {
		// Namespaced in MW 1.44+, global on the 1.39/1.43 LTS branches.
		$jobClass = null;
		foreach ( [ 'MediaWiki\\JobQueue\\Jobs\\HTMLCacheUpdateJob', 'HTMLCacheUpdateJob' ] as $candidate ) {
			if ( class_exists( $candidate ) ) {
				$jobClass = $candidate;
				break;
			}
		}
		if ( $jobClass === null || !method_exists( $jobClass, 'newForBacklinks' ) ) {
			return;
		}

		$job = $jobClass::newForBacklinks( $title, 'imagelinks', [
			'causeAction' => 'layers-layerset-change',
		] );

		$services = MediaWikiServices::getInstance();
		if ( method_exists( $services, 'getJobQueueGroup' ) ) {
			$services->getJobQueueGroup()->lazyPush( $job );
		}
	}
}
