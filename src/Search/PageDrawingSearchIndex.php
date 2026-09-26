<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Content\TextContent;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Search\SearchUpdate;

/** Core indexes only the main slot; pages that own drawings are indexed with their drawings' text too. */
final class PageDrawingSearchIndex {
	/**
	 * @param int $pageId
	 * @param PageIdentity $page
	 * @param RevisionRecord $revision Current revision, carrying the drawing slot
	 */
	public static function update( int $pageId, PageIdentity $page, RevisionRecord $revision ): void {
		$main = $revision->getContent( SlotRecord::MAIN, RevisionRecord::RAW );
		$text = ( $main ? $main->getTextForSearchIndex() : '' ) . "\n\n" .
			PageDrawingSearchText::extract( $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW ) );
		( new SearchUpdate( $pageId, $page, new TextContent( trim( $text ) ) ) )->doUpdate();
	}
}
