<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Hooks;

use MediaWiki\Context\RequestContext;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Hook\HistoryToolsHook;
use MediaWiki\Hook\PageHistoryLineEndingHook;
use MediaWiki\Linker\LinkRenderer;
use MediaWiki\Logger\LoggerFactory;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;

/** Permission-checked exact-revision links in the native page history. */
class PageOwnedHistoryHooks implements PageHistoryLineEndingHook, HistoryToolsHook {
	private PageOwnedPilot $pilot;
	private LinkRenderer $links;

	public function __construct( PageOwnedPilot $pilot, LinkRenderer $links ) {
		$this->pilot = $pilot;
		$this->links = $links;
	}

	/**
	 * Core's undo link restores the page text only, so on an edit that changed drawings it would do nothing or
	 * half of the job. It is replaced by one link per changed drawing that opens that drawing's earlier version,
	 * where an editor can make it current again.
	 * @inheritDoc
	 */
	public function onHistoryTools( $revRecord, &$links, $prevRevRecord, $userIdentity ) {
		if ( !$prevRevRecord || !self::changedDrawings( $revRecord, $prevRevRecord ) ) {
			return true;
		}
		unset( $links['mw-undo'] );
		try {
			$authority = RequestContext::getMain()->getAuthority();
			$owner = Title::newFromLinkTarget( $revRecord->getPageAsLinkTarget() );
			if ( !$authority->probablyCan( 'edit', $owner ) || !$authority->isAllowed( 'editlayers' ) ) {
				return true;
			}
			$context = RequestContext::getMain();
			foreach ( $this->pilot->getDrawingChanges( $owner, $prevRevRecord, $revRecord, $authority ) as $change ) {
				if ( !$change['old'] ) {
					continue;
				}
				$links['layers-undo-' . $change['id']] = $this->links->makeKnownLink(
					SpecialPage::getTitleFor( 'ViewLayersPage' ),
					$context->msg( 'layers-page-history-undo', $change['label'] )->text(),
					[ 'class' => 'layers-history-undo-link' ],
					[ 'owner' => $owner->getPrefixedDBkey(), 'revid' => $prevRevRecord->getId(),
						'surface' => $change['id'] ] );
			}
		} catch ( \DomainException $e ) {
			// Hidden drawings offer nothing to undo.
		} catch ( \Throwable $e ) {
			LoggerFactory::getInstance( 'Layers' )->error( 'Page-owned history tools failed.', [ 'exception' => $e ] );
		}
		return true;
	}

	/**
	 * @param \MediaWiki\Revision\RevisionRecord $new
	 * @param \MediaWiki\Revision\RevisionRecord $old
	 * @return bool Whether the two revisions hold different drawings documents
	 */
	private static function changedDrawings( $new, $old ): bool {
		$has = $new->hasSlot( PageRevisionWriter::SLOT );
		$had = $old->hasSlot( PageRevisionWriter::SLOT );
		if ( !$has && !$had ) {
			return false;
		}
		return !$has || !$had ||
			$new->getSlot( PageRevisionWriter::SLOT )->getSha1() !==
			$old->getSlot( PageRevisionWriter::SLOT )->getSha1();
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
