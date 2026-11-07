<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\JsonSnapshotCodec;
use MediaWiki\Extension\Layers\Revision\PageOwnedScope;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;

/** Combined projection only; callers remain responsible for authorization and index lifecycle. */
final class VisibleSearchText {
	public function __construct(
		private PageOwnedScope $scope,
		private VisiblePageSearchProjection $owned,
		private VisibleLegacySearchProjection $legacy
	) {
	}

	/**
	 * The caller must authorize the owning page and supply its exact revision and current shown-set property.
	 * @param PageIdentity $page
	 * @param RevisionRecord $revision
	 * @param Authority $authority Intended source-visibility boundary
	 * @param array[] $shown Entries from ShownLayerSets::decode
	 * @param bool $fromPrimary
	 * @return string
	 */
	public function get( PageIdentity $page, RevisionRecord $revision, Authority $authority, array $shown,
		bool $fromPrimary = false
	): string {
		if ( $revision->getPageId() !== $page->getId() || $revision->isDeleted( RevisionRecord::DELETED_TEXT ) ) {
			return '';
		}
		$parts = [];
		if ( $revision->hasSlot( PageRevisionWriter::SLOT ) && $this->scope->includesRevision( $page, $revision ) ) {
			$content = $revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW );
			if ( !$content instanceof LayersDocumentContent || !$content->isReadable() ) {
				return '';
			}
			$parts[] = $this->owned->get( $content, $authority );
		}
		if ( $page->getNamespace() === NS_FILE ) {
			$parts[] = $this->legacy->file( $page->getDBkey(), $authority, $fromPrimary );
		}
		$seen = [];
		foreach ( $shown as $entry ) {
			$kind = $entry[0] ?? null;
			$name = $entry[1] ?? null;
			$set = $entry[2] ?? null;
			if ( !in_array( $kind, [ ShownLayerSets::FILE, ShownLayerSets::SLIDE ], true ) ||
				!is_string( $name ) || $name === '' || !is_string( $set ) ) {
				continue;
			}
			$key = JsonSnapshotCodec::encode( [ $kind, $name, $set ] );
			if ( isset( $seen[$key] ) ) {
				continue;
			}
			$seen[$key] = true;
			$parts[] = $this->legacy->shown( $name, $set, $kind === ShownLayerSets::SLIDE, $authority,
				$fromPrimary );
		}
		return implode( "\n", array_filter( $parts, 'strlen' ) );
	}
}
