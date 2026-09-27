<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Content\Hook\SearchDataForIndex2Hook;
use MediaWiki\Html\Html;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Search\Hook\ShowSearchHitHook;
use SearchHighlighter;

/**
 * Search engines that build documents from ContentHandler data, such as CirrusSearch, get drawing text too,
 * and a result found only through a drawing shows the matching drawing text as its snippet.
 */
class DrawingSearchHooks implements SearchDataForIndex2Hook, ShowSearchHitHook {
	private DrawingSearchText $text;
	private RevisionLookup $revisions;

	/**
	 * @param DrawingSearchText $text
	 * @param RevisionLookup $revisions
	 */
	public function __construct( DrawingSearchText $text, RevisionLookup $revisions ) {
		$this->text = $text;
		$this->revisions = $revisions;
	}

	/** @inheritDoc */
	public function onSearchDataForIndex2( array &$fields, $handler, $page, $output, $engine, $revision ) {
		$text = $this->text->get( $page, $revision );
		if ( $text !== '' ) {
			$fields['auxiliary_text'] = array_merge( (array)( $fields['auxiliary_text'] ?? [] ), [ $text ] );
		}
	}

	/** @inheritDoc Core runs this hook for results outside the File namespace only. */
	public function onShowSearchHit( $searchPage, $result, $terms, &$link,
		&$redirect, &$section, &$extract, &$score, &$size, &$date, &$related, &$html
	) {
		$title = $result->getTitle();
		// Core shows the page-text snippet when it matched; the result widget already checked read access.
		if ( !$terms || !$title || str_contains( (string)$extract, 'searchmatch' ) ) {
			return;
		}
		$text = $this->text->get( $title, $this->revisions->getRevisionByTitle( $title ) );
		$snippet = $text === '' ? '' : ( new SearchHighlighter() )->highlightSimple( $text, $terms );
		if ( str_contains( $snippet, 'searchmatch' ) ) {
			$extract = Html::rawElement( 'div', [ 'class' => 'searchresult' ],
				$snippet . $searchPage->msg( 'ellipsis' )->escaped() );
		}
	}
}
