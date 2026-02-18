<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Api\Traits;

use MediaWiki\MediaWikiServices;

/**
 * Trait for invalidating caches after layer data changes.
 *
 * Used by API modules that modify layer data (save, delete, rename) to ensure
 * that pages displaying layers are refreshed with the latest data.
 *
 * Cache invalidation targets:
 * 1. The file description page itself (parser cache)
 * 2. Pages embedding the file via [[File:...]] wikitext (backlinks)
 * 3. CDN/Squid caches for the file page URL
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
	 * @param \Title|\MediaWiki\Title\Title $title The file page title
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

			// 3. Purge CDN/Squid caches and backlink pages (pages embedding this file)
			// HtmlCacheUpdater was added in MW 1.35
			if ( method_exists( $services, 'getHtmlCacheUpdater' ) ) {
				$htmlCacheUpdater = $services->getHtmlCacheUpdater();
				$htmlCacheUpdater->purgeTitleUrls(
					[ $title ],
					$htmlCacheUpdater::PURGE_INTENT_TXROUND_REFLECTED
				);
			}
		} catch ( \Throwable $e ) {
			// Cache invalidation is best-effort; don't fail the save/delete/rename
			// if cache purging encounters an error
			// phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
		}
	}
}
