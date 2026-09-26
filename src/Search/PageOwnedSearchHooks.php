<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Content\Hook\SearchDataForIndex2Hook;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Revision\RevisionRecord;

/** Search engines that build documents from ContentHandler data, such as CirrusSearch, get drawing text too. */
class PageOwnedSearchHooks implements SearchDataForIndex2Hook {
	private PageOwnedPilot $pilot;

	/**
	 * @param PageOwnedPilot $pilot
	 */
	public function __construct( PageOwnedPilot $pilot ) {
		$this->pilot = $pilot;
	}

	/** @inheritDoc */
	public function onSearchDataForIndex2( array &$fields, $handler, $page, $output, $engine, $revision ) {
		if ( !$revision->hasSlot( PageRevisionWriter::SLOT ) || $revision->isDeleted( RevisionRecord::DELETED_TEXT ) ||
			!$this->pilot->getScope()->includesRevision( $page, $revision )
		) {
			return;
		}
		$text = PageDrawingSearchText::extract(
			$revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW ) );
		if ( $text !== '' ) {
			$fields['auxiliary_text'] = array_merge( (array)( $fields['auxiliary_text'] ?? [] ), [ $text ] );
		}
	}
}
