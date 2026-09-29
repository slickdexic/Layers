<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Migration;

use MediaWiki\ChangeTags\ChangeTagsStore;
use MediaWiki\Content\WikitextContent;
use MediaWiki\Extension\Layers\Revision\DocumentSchema;
use MediaWiki\Extension\Layers\Revision\PagePublicationService;
use MediaWiki\Extension\Layers\Revision\PageRevisionWriter;
use MediaWiki\Extension\Layers\Revision\PublicationException;
use MediaWiki\Page\DeletePageFactory;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Undoes the D3 migration page by page: a page whose latest revisions are the migration's goes back to the
 * revision before them, and a page the migration created is deleted. A page edited since is left alone.
 * layer_sets was never changed, so the shared sets and slides are all still there.
 */
class MigrationUndo {
	private IConnectionProvider $db;
	private RevisionLookup $revisions;
	private TitleFactory $titles;
	private ChangeTagsStore $tags;
	private DeletePageFactory $deletes;
	private PagePublicationService $publisher;

	/**
	 * @param IConnectionProvider $db
	 * @param RevisionLookup $revisions
	 * @param TitleFactory $titles
	 * @param ChangeTagsStore $tags
	 * @param DeletePageFactory $deletes
	 * @param PagePublicationService $publisher
	 */
	public function __construct( IConnectionProvider $db, RevisionLookup $revisions, TitleFactory $titles,
		ChangeTagsStore $tags, DeletePageFactory $deletes, PagePublicationService $publisher
	) {
		$this->db = $db;
		$this->revisions = $revisions;
		$this->titles = $titles;
		$this->tags = $tags;
		$this->deletes = $deletes;
		$this->publisher = $publisher;
	}

	/**
	 * @param int|null $pageId Only this page
	 * @return int[] Pages with a revision the migration made, in ID order
	 */
	public function pages( ?int $pageId = null ): array {
		$db = $this->db->getReplicaDatabase();
		$query = $db->newSelectQueryBuilder()->select( 'rev_page' )->distinct()
			->from( 'change_tag' )->join( 'change_tag_def', null, 'ctd_id = ct_tag_id' )
			->join( 'revision', null, 'rev_id = ct_rev_id' )
			->where( [ 'ctd_name' => PagePublicationService::MIGRATION_TAG ] );
		if ( $pageId !== null ) {
			$query->where( [ 'rev_page' => $pageId ] );
		}
		return array_map( 'intval', $query->orderBy( 'rev_page' )->caller( __METHOD__ )->fetchFieldValues() );
	}

	/**
	 * @param int $pageId
	 * @return array title (?Title); pageId; latestRevisionId; revisions (the migration's, newest first);
	 *  baseRevisionId (the revision before them; 0 when the migration created the page); problem (?string)
	 */
	public function plan( int $pageId ): array {
		$plan = [ 'title' => null, 'pageId' => $pageId, 'latestRevisionId' => 0, 'revisions' => [],
			'baseRevisionId' => 0, 'problem' => null ];
		$title = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		$revision = $title ? $this->revisions->getRevisionByPageId( $pageId, 0, IDBAccessObject::READ_LATEST ) : null;
		if ( !$title || !$revision ) {
			$plan['problem'] = 'no-page';
			return $plan;
		}
		$plan['title'] = $title;
		$plan['latestRevisionId'] = $revision->getId();
		if ( $this->hasTag( $revision, PagePublicationService::MIGRATION_UNDO_TAG ) ) {
			$plan['problem'] = 'already-undone';
			return $plan;
		}
		while ( $revision && $this->hasTag( $revision, PagePublicationService::MIGRATION_TAG ) ) {
			$plan['revisions'][] = $revision->getId();
			$revision = $revision->getParentId() ?
				$this->revisions->getRevisionById( $revision->getParentId(), IDBAccessObject::READ_LATEST ) : null;
		}
		if ( !$plan['revisions'] ) {
			$plan['problem'] = in_array( $pageId, $this->pages( $pageId ), true ) ?
				'edited-since-migration' : 'not-migrated';
			return $plan;
		}
		$plan['baseRevisionId'] = $revision ? $revision->getId() : 0;
		return $plan;
	}

	/**
	 * @param array $plan From plan()
	 * @param Authority $authority
	 * @return int|null The revision that undoes the migration, 0 when the page was deleted, null for nothing
	 * @throws PublicationException When the page changed since planning or cannot be written
	 */
	public function commit( array $plan, Authority $authority ): ?int {
		if ( $plan['problem'] !== null || !$plan['revisions'] ) {
			return null;
		}
		$summary = wfMessage( 'layers-migration-undo-summary' )->numParams( count( $plan['revisions'] ) )
			->params( implode( wfMessage( 'comma-separator' )->inContentLanguage()->text(),
				array_reverse( $plan['revisions'] ) ) )->inContentLanguage()->text();
		if ( $plan['baseRevisionId'] === 0 ) {
			$status = $this->deletes->newDeletePage( $plan['title']->toPageIdentity(), $authority )
				->deleteUnsafe( $summary );
			if ( !$status->isGood() ) {
				throw new PublicationException( 'layers-revision-save-failed' );
			}
			return 0;
		}
		$base = $this->revisions->getRevisionById( $plan['baseRevisionId'], IDBAccessObject::READ_LATEST );
		$main = $base ? $base->getContent( SlotRecord::MAIN, RevisionRecord::RAW ) : null;
		if ( !$main instanceof WikitextContent ) {
			throw new PublicationException( 'layers-main-model-change-denied' );
		}
		// A page with no drawings before keeps an empty drawing slot: publication never removes the slot.
		$document = $base->hasSlot( PageRevisionWriter::SLOT ) ?
			$base->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW )->getText() :
			json_encode( [ 'schemaVersion' => DocumentSchema::VERSION, 'surfaces' => [] ] );
		return $this->publisher->publish( $plan['title'], $authority, $plan['latestRevisionId'], $document, $summary,
			$main, $plan['pageId'], PagePublicationService::MIGRATION_UNDO_TAG );
	}

	/**
	 * @param RevisionRecord $revision
	 * @param string $tag
	 * @return bool
	 */
	private function hasTag( RevisionRecord $revision, string $tag ): bool {
		return in_array( $tag, $this->tags->getTags( $this->db->getPrimaryDatabase(), null, $revision->getId() ),
			true );
	}
}
