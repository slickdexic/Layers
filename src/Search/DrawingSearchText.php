<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Content\TextContent;
use MediaWiki\Extension\Layers\Database\LayersDatabase;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Revision\PageOwnedPilot;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Page\PageLookup;
use MediaWiki\Page\PageReference;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Search\SearchUpdate;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Words readers can see in drawings, for search: a page's own drawings at the revision indexed, and on a
 * file description page the text of the file's layer sets. Core indexes only the main slot.
 */
class DrawingSearchText {
	private PageOwnedPilot $pilot;
	private LayersDatabase $db;
	private RevisionLookup $revisions;
	private PageLookup $pages;

	/**
	 * @param PageOwnedPilot $pilot
	 * @param LayersDatabase $db
	 * @param RevisionLookup $revisions
	 * @param PageLookup $pages
	 */
	public function __construct( PageOwnedPilot $pilot, LayersDatabase $db, RevisionLookup $revisions,
		PageLookup $pages
	) {
		$this->pilot = $pilot;
		$this->db = $db;
		$this->revisions = $revisions;
		$this->pages = $pages;
	}

	/**
	 * @param PageReference $page
	 * @param RevisionRecord|null $revision Revision indexed or shown; the page's own drawings are read from it
	 * @param bool $fromPrimary Read file layer sets from the primary database
	 * @return string One entry per line; empty when there is none
	 */
	public function get( PageReference $page, ?RevisionRecord $revision, bool $fromPrimary = false ): string {
		$parts = [];
		if ( $revision && $revision->hasSlot( PageRevisionWriter::SLOT ) &&
			!$revision->isDeleted( RevisionRecord::DELETED_TEXT ) &&
			$this->pilot->getScope()->includesRevision( $page, $revision )
		) {
			$parts[] = PageDrawingSearchText::extract(
				$revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW ) );
		}
		if ( $page->getNamespace() === NS_FILE ) {
			foreach ( $this->db->getFileSetsForSearch( $page->getDBkey(), $fromPrimary ) as $set ) {
				$parts[] = PageDrawingSearchText::layerText( $set );
			}
		}
		return implode( "\n", array_filter( $parts, 'strlen' ) );
	}

	/**
	 * Replace the page's index entry with its text followed by $drawingText.
	 *
	 * @param int $pageId
	 * @param PageIdentity $page
	 * @param RevisionRecord $revision Current revision
	 * @param string $drawingText From get()
	 */
	public function index( int $pageId, PageIdentity $page, RevisionRecord $revision, string $drawingText ): void {
		$main = $revision->isDeleted( RevisionRecord::DELETED_TEXT ) ? null :
			$revision->getContent( SlotRecord::MAIN, RevisionRecord::RAW );
		$text = ( $main ? $main->getTextForSearchIndex() : '' ) . "\n\n" . $drawingText;
		( new SearchUpdate( $pageId, $page, new TextContent( trim( $text ) ) ) )->doUpdate();
	}

	/**
	 * Reindex a file description page whose layer sets changed, which is not a page edit.
	 *
	 * @param PageReference $page
	 */
	public function updateFilePage( PageReference $page ): void {
		$record = $page->getNamespace() === NS_FILE ?
			$this->pages->getPageByReference( $page, IDBAccessObject::READ_LATEST ) : null;
		$revision = $record ? $this->revisions->getRevisionByPageId( $record->getId(), 0,
			IDBAccessObject::READ_LATEST ) : null;
		if ( $record && $revision ) {
			$this->index( $record->getId(), $record, $revision, $this->get( $record, $revision, true ) );
		}
	}
}
