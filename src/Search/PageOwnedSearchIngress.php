<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\DomainEvent\DomainEventIngress;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Page\Event\PageLatestRevisionChangedEvent;
use MediaWiki\Page\Event\PageLatestRevisionChangedListener;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;

/** Keeps drawing text in the search index; registered after core's ingress, so its update is the one that stays. */
class PageOwnedSearchIngress extends DomainEventIngress implements PageLatestRevisionChangedListener {
	private PageOwnedPilot $pilot;

	/**
	 * @param PageOwnedPilot $pilot
	 */
	public function __construct( PageOwnedPilot $pilot ) {
		$this->pilot = $pilot;
	}

	/**
	 * @param PageLatestRevisionChangedEvent $event
	 */
	public function handlePageLatestRevisionChangedEvent( PageLatestRevisionChangedEvent $event ): void {
		$revision = $event->getLatestRevisionAfter();
		if ( !$revision->hasSlot( PageRevisionWriter::SLOT ) || $revision->isDeleted( RevisionRecord::DELETED_TEXT ) ||
			!( $event->isModifiedSlot( SlotRecord::MAIN ) || $event->isModifiedSlot( PageRevisionWriter::SLOT ) ||
				$event->hasCause( PageLatestRevisionChangedEvent::CAUSE_MOVE ) || $event->isReconciliationRequest() ) ||
			!$this->pilot->getScope()->includesRevision( $event->getPageRecordAfter(), $revision )
		) {
			return;
		}
		PageDrawingSearchIndex::update( $event->getPageId(), $event->getPageRecordAfter(), $revision );
	}
}
