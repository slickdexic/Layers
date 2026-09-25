<?php

declare( strict_types=1 );

namespace MediaWiki\Extension\Layers\Revision;

use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\Rdbms\IDBAccessObject;

/** Internal edit preflight. Publication must repeat identity and authority checks. */
class PageOwnedIdentityResolver {
	private TitleFactory $titles;
	private RevisionLookup $revisions;
	private PageHistoryAccess $access;

	/**
	 * @param TitleFactory $titles
	 * @param RevisionLookup $revisions
	 * @param PageHistoryAccess $access
	 */
	public function __construct( TitleFactory $titles, RevisionLookup $revisions, PageHistoryAccess $access ) {
		$this->titles = $titles;
		$this->revisions = $revisions;
		$this->access = $access;
	}

	/**
	 * Resolve an existing owner by ID, never by an old title or a redirect target.
	 * Supports adoption before a Layers slot exists. Does not authorize publication.
	 *
	 * @param int $pageId
	 * @param int $baseRevisionId Explicit current revision; zero/creation is not supported
	 * @param Authority $authority Original requesting authority
	 * @return Title Current owner title after authorized preflight
	 * @throws \DomainException Fixed unavailable or conflict code
	 */
	public function resolveForEdit( int $pageId, int $baseRevisionId, Authority $authority ): Title {
		if ( $pageId < 1 || $pageId > 2147483647 || $baseRevisionId < 1 || $baseRevisionId > 2147483647 ) {
			throw new \DomainException( 'layers-owner-unavailable' );
		}
		$owner = $this->titles->newFromID( $pageId, IDBAccessObject::READ_LATEST );
		if ( !$owner || $owner->getArticleID( IDBAccessObject::READ_LATEST ) !== $pageId ) {
			throw new \DomainException( 'layers-owner-unavailable' );
		}
		try {
			$this->access->assertCanPrepareEdit( $owner, $authority );
		} catch ( \DomainException $e ) {
			throw new \DomainException( 'layers-owner-unavailable' );
		}
		$base = $this->revisions->getRevisionById( $baseRevisionId, IDBAccessObject::READ_LATEST );
		if ( !$base || $base->getPageId() !== $pageId ||
			!RevisionRecord::userCanBitfield( $base->getVisibility(), RevisionRecord::DELETED_TEXT,
				$authority, $base->getPage() ) ) {
			throw new \DomainException( 'layers-owner-unavailable' );
		}
		$current = $this->revisions->getRevisionByTitle( $owner, 0, IDBAccessObject::READ_LATEST );
		if ( !$current || $current->getPageId() !== $pageId || $current->getId() !== $baseRevisionId ) {
			throw new \DomainException( 'layers-edit-conflict' );
		}
		return $owner;
	}
}
