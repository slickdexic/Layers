<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Hook\PageHistoryLineEndingHook;
use MediaWiki\Linker\LinkRenderer;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\SpecialPage\SpecialPage;

/** Permission-checked exact-revision links in the native page history. */
class PageOwnedHistoryHooks implements PageHistoryLineEndingHook {
	private PageOwnedPilot $pilot;
	private LinkRenderer $links;

	public function __construct( PageOwnedPilot $pilot, LinkRenderer $links ) {
		$this->pilot = $pilot;
		$this->links = $links;
	}

	/** @inheritDoc */
	public function onPageHistoryLineEnding( $historyAction, &$row, &$s, &$classes, &$attribs ) {
		try {
			$owner = $historyAction->getTitle();
			$revisionId = (int)$row->rev_id;
			$surfaces = $this->pilot->getHistorySurfaces( $owner, $revisionId, $historyAction->getAuthority() );
			$extra = '';
			foreach ( $surfaces as $surface ) {
				$label = $historyAction->msg( 'layers-page-history-link', $surface['label'] )->text();
				$extra .= ' ' . $this->links->makeKnownLink( SpecialPage::getTitleFor( 'ViewLayersPage' ),
					$label, [ 'class' => 'layers-history-view-link' ], [
						'owner' => $owner->getPrefixedDBkey(), 'revid' => $revisionId, 'surface' => $surface['id']
					] );
			}
			$s .= $extra;
		} catch ( \DomainException $e ) {
			// Denied/hidden/missing snapshots expose no surface labels or links.
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Page-owned history navigation failed.',
				[ 'exception' => $e ] );
		}
	}
}
