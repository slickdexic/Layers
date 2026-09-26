<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\PermissionManager;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Storage\NameTableAccessException;
use MediaWiki\Storage\NameTableStore;
use MediaWiki\User\UserIdentity;
use Wikimedia\Rdbms\IConnectionProvider;
use Wikimedia\Rdbms\IDBAccessObject;

/**
 * Native reverts (rollback and similar tools) may restore the exact drawings of an earlier, visible
 * revision of the same page: that content passed publication when it was first saved.
 */
final class PageDrawingRevert {
	private IConnectionProvider $db;
	private NameTableStore $slotRoles;
	private RevisionLookup $revisions;
	private PermissionManager $permissions;

	/**
	 * @param IConnectionProvider $db
	 * @param NameTableStore $slotRoles
	 * @param RevisionLookup $revisions
	 * @param PermissionManager $permissions
	 */
	public function __construct( IConnectionProvider $db, NameTableStore $slotRoles, RevisionLookup $revisions,
		PermissionManager $permissions
	) {
		$this->db = $db;
		$this->slotRoles = $slotRoles;
		$this->revisions = $revisions;
		$this->permissions = $permissions;
	}

	/**
	 * @param RevisionRecord $proposed Unsaved revision of an existing page
	 * @param UserIdentity $user
	 * @return bool
	 */
	public function restoresEarlierDrawings( RevisionRecord $proposed, UserIdentity $user ): bool {
		$page = $proposed->getPage();
		if ( !$page->exists() || !$proposed->hasSlot( PageRevisionWriter::SLOT ) ||
			!$this->permissions->userHasRight( $user, 'editlayers' )
		) {
			return false;
		}
		try {
			$role = $this->slotRoles->getId( PageRevisionWriter::SLOT );
		} catch ( NameTableAccessException $e ) {
			return false;
		}
		$serialized = $proposed->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW )->serialize();
		$db = $this->db->getPrimaryDatabase();
		$candidates = $db->newSelectQueryBuilder()->select( 'rev_id' )->from( 'revision' )
			->join( 'slots', null, 'slot_revision_id = rev_id' )
			->join( 'content', null, 'content_id = slot_content_id' )
			->where( [ 'rev_page' => $page->getId(), 'slot_role_id' => $role,
				'content_sha1' => SlotRecord::base36Sha1( $serialized ) ] )
			->andWhere( $db->bitAnd( 'rev_deleted', RevisionRecord::DELETED_TEXT ) . ' = 0' )
			->limit( 5 )->caller( __METHOD__ )->fetchFieldValues();
		foreach ( $candidates as $id ) {
			$earlier = $this->revisions->getRevisionById( (int)$id, IDBAccessObject::READ_LATEST );
			$content = $earlier ? $earlier->getContent( PageRevisionWriter::SLOT, RevisionRecord::RAW ) : null;
			if ( $content && $earlier->getPage()->isSamePageAs( $page ) && $content->serialize() === $serialized ) {
				return true;
			}
		}
		return false;
	}
}
