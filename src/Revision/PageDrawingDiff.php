<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;

/** Which drawings differ between two revisions of one page, for the diff view. */
final class PageDrawingDiff {
	private PageHistoryAccess $access;

	/**
	 * @param PageHistoryAccess $access
	 */
	public function __construct( PageHistoryAccess $access ) {
		$this->access = $access;
	}

	/**
	 * @param Title $owner
	 * @param RevisionRecord $old
	 * @param RevisionRecord $new
	 * @param Authority $authority
	 * @return array[] id, label, and whether the drawing exists in the old and new revision; one entry per
	 *  drawing that was added, removed or changed
	 * @throws \DomainException When either side's drawings are hidden from this reader
	 */
	public function changes( Title $owner, RevisionRecord $old, RevisionRecord $new, Authority $authority ): array {
		$before = $this->surfaces( $owner, $old, $authority );
		$after = $this->surfaces( $owner, $new, $authority );
		$changes = [];
		foreach ( $after as $id => $surface ) {
			if ( !isset( $before[$id] ) ||
				JsonSnapshotCodec::encode( $before[$id] ) !== JsonSnapshotCodec::encode( $surface )
			) {
				$changes[] = [ 'id' => (string)$id, 'label' => (string)( $surface->label ?? $id ),
					'old' => isset( $before[$id] ), 'new' => true ];
			}
		}
		foreach ( $before as $id => $surface ) {
			if ( !isset( $after[$id] ) ) {
				$changes[] = [ 'id' => (string)$id, 'label' => (string)( $surface->label ?? $id ),
					'old' => true, 'new' => false ];
			}
		}
		return $changes;
	}

	/**
	 * @param Title $owner
	 * @param RevisionRecord $revision
	 * @param Authority $authority
	 * @return \stdClass[] Keyed by surface ID
	 */
	private function surfaces( Title $owner, RevisionRecord $revision, Authority $authority ): array {
		if ( !$revision->hasSlot( PageRevisionWriter::SLOT ) ) {
			return [];
		}
		$surfaces = [];
		$text = $this->access->read( $owner, $revision->getId(), $authority )->getText();
		foreach ( json_decode( $text, false, 64, JSON_THROW_ON_ERROR )->surfaces as $surface ) {
			$surfaces[(string)$surface->id] = $surface;
		}
		return $surfaces;
	}
}
