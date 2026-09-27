<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Content\Hook\SearchDataForIndex2Hook;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Html\Html;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Search\Hook\ShowSearchHitHook;
use SearchHighlighter;

/**
 * Search engines that build documents from ContentHandler data, such as CirrusSearch, get drawing text too,
 * and a result found only through a drawing shows the matching drawing text as its snippet.
 */
class PageOwnedSearchHooks implements SearchDataForIndex2Hook, ShowSearchHitHook {
	private PageOwnedPilot $pilot;
	private RevisionLookup $revisions;

	/**
	 * @param PageOwnedPilot $pilot
	 * @param RevisionLookup $revisions
	 */
	public function __construct( PageOwnedPilot $pilot, RevisionLookup $revisions ) {
		$this->pilot = $pilot;
		$this->revisions = $revisions;
	}

	/** @inheritDoc */
	public function onSearchDataForIndex2( array &$fields, $handler, $page, $output, $engine, $revision ) {
		$text = $this->drawingText( $page, $revision );
		if ( $text !== '' ) {
			$fields['auxiliary_text'] = array_merge( (array)( $fields['auxiliary_text'] ?? [] ), [ $text ] );
		}
	}

	/** @inheritDoc */
	public function onShowSearchHit( $searchPage, $result, $terms, &$link,
		&$redirect, &$section, &$extract, &$score, &$size, &$date, &$related, &$html
	) {
		$title = $result->getTitle();
		// Core shows the page-text snippet when it matched; the result widget already checked read access.
		if ( !$terms || !$title || str_contains( (string)$extract, 'searchmatch' ) ) {
			return;
		}
		$revision = $this->revisions->getRevisionByTitle( $title );
		$text = $revision ? $this->drawingText( $title, $revision ) : '';
		$snippet = $text === '' ? '' : ( new SearchHighlighter() )->highlightSimple( $text, $terms );
		if ( str_contains( $snippet, 'searchmatch' ) ) {
			$extract = Html::rawElement( 'div', [ 'class' => 'searchresult' ],
				$snippet . $searchPage->msg( 'ellipsis' )->escaped() );
		}
	}

	/**
	 * @param \MediaWiki\Page\PageReference $page
	 * @param RevisionRecord $revision
	 * @return string Visible drawing text of that revision; empty outside the pilot or when hidden
	 */
	private function drawingText( $page, RevisionRecord $revision ): string {
		if ( !$revision->hasSlot( PageRevisionWriter::SLOT ) || $revision->isDeleted( RevisionRecord::DELETED_TEXT ) ||
			!$this->pilot->getScope()->includesRevision( $page, $revision )
		) {
			return '';
		}
		return PageDrawingSearchText::extract( $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW ) );
	}
}
