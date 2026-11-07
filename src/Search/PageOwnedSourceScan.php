<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Search;

use MediaWiki\Extension\Layers\Content\LayersDocumentContent;
use MediaWiki\Extension\Layers\Revision\PageDrawingSearchText;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Page\PageLookup;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Storage\NameTableAccessException;
use MediaWiki\Storage\NameTableStore;
use MediaWiki\Title\Title;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;

/** Bounded internal discovery of current page-owned snapshots referencing a file. */
final class PageOwnedSourceScan {
	public function __construct(
		private IConnectionProvider $connections,
		private NameTableStore $roles,
		private PageLookup $pages,
		private RevisionLookup $revisions
	) {
	}

	/**
	 * Inspect a stable page-ID window on the primary database.
	 * A full window returns its last scanned ID as the continuation, even when no owner matches.
	 * Unreadable snapshots are included so a caller can fail closed rather than miss stale text.
	 * @param Title $file Canonical local file title
	 * @param int $after Exclusive page-ID cursor
	 * @param int $limit Maximum page records to inspect, 1–500
	 * @return array{pageIds:int[],next:?int}
	 */
	public function scan( Title $file, int $after, int $limit ): array {
		if ( $file->getNamespace() !== NS_FILE || !$file->canExist() || $file->hasFragment() ||
			$after < 0 || $limit < 1 || $limit > 500 ) {
			throw new \InvalidArgumentException( 'Invalid source scan request' );
		}
		try {
			$role = $this->roles->getId( PageRevisionWriter::SLOT );
		} catch ( NameTableAccessException $e ) {
			return [ 'pageIds' => [], 'next' => null ];
		}
		$db = $this->connections->getPrimaryDatabase();
		$ids = $db->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
			->join( 'slots', null, 'slot_revision_id = page_latest' )
			->where( [ 'slot_role_id' => $role, $db->expr( 'page_id', '>', $after ) ] )
			->orderBy( 'page_id' )->limit( $limit )->caller( __METHOD__ )->fetchFieldValues();
		$matches = [];
		foreach ( $ids as $id ) {
			$pageId = (int)$id;
			$page = $this->pages->getPageById( $pageId, IDBAccessObject::READ_LATEST );
			$revision = $page ? $this->revisions->getRevisionByPageId( $pageId, 0,
				IDBAccessObject::READ_LATEST ) : null;
			$content = $revision && $revision->hasSlot( PageRevisionWriter::SLOT ) ?
				$revision->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW ) : null;
			if ( !$content instanceof LayersDocumentContent || !$content->isReadable() ) {
				$matches[] = $pageId;
				continue;
			}
			foreach ( PageDrawingSearchText::surfaces( $content ) as $surface ) {
				if ( !in_array( $surface['kind'] ?? null, [ 'image', 'pdf' ], true ) ) {
					continue;
				}
				$name = $surface['source']['fileTitle'] ?? null;
				$title = is_string( $name ) ? Title::newFromText( $name ) : null;
				// Malformed identities may have left text in an older index. Include the owner
				// conservatively; a repair must not depend on their original spelling.
				if ( !$title || $title->getNamespace() !== NS_FILE || $title->hasFragment() ||
					$title->getDBkey() === $file->getDBkey() ) {
					$matches[] = $pageId;
					break;
				}
			}
		}
		return [ 'pageIds' => $matches,
			'next' => count( $ids ) === $limit ? (int)end( $ids ) : null ];
	}
}
