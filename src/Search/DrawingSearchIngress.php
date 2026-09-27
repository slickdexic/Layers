<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\DomainEvent\DomainEventIngress;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Page\Event\PageLatestRevisionChangedEvent;
use MediaWiki\Page\Event\PageLatestRevisionChangedListener;
use MediaWiki\Revision\SlotRecord;

/** Keeps drawing text in the search index; registered after core's ingress, so its update is the one that stays. */
class DrawingSearchIngress extends DomainEventIngress implements PageLatestRevisionChangedListener {
	private DrawingSearchText $text;

	/**
	 * @param DrawingSearchText $text
	 */
	public function __construct( DrawingSearchText $text ) {
		$this->text = $text;
	}

	/**
	 * @param PageLatestRevisionChangedEvent $event
	 */
	public function handlePageLatestRevisionChangedEvent( PageLatestRevisionChangedEvent $event ): void {
		$drawingChanged = $event->isModifiedSlot( PageRevisionWriter::SLOT );
		if ( !( $drawingChanged || $event->isModifiedSlot( SlotRecord::MAIN ) ||
			$event->hasCause( PageLatestRevisionChangedEvent::CAUSE_MOVE ) || $event->isReconciliationRequest() )
		) {
			return;
		}
		$page = $event->getPageRecordAfter();
		$revision = $event->getLatestRevisionAfter();
		$drawingText = $this->text->get( $page, $revision );
		// Core has indexed the page text alone. Add drawing words, or drop those a changed drawing no longer has.
		if ( $drawingText !== '' || $drawingChanged ) {
			$this->text->index( $event->getPageId(), $page, $revision, $drawingText );
		}
	}
}
